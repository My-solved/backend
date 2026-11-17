import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';

import {
  ContractError,
  resolveProxyRequest,
  SOLVED_API_BASE_URLS,
  type SolvedApiBaseUrls,
} from './contract.js';
import {
  proxyRequest,
  type ProxyDependencies,
  UpstreamError,
} from './proxy-handler.js';
import { findRoute } from './routes.js';

const MAX_REQUEST_TARGET_BYTES = 8_192;
export const DEFAULT_MAX_CONCURRENT_REQUESTS = 8;

const CORS_HEADERS = Object.freeze({
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-max-age': '86400',
  'x-content-type-options': 'nosniff',
});

export interface GatewayRequest {
  readonly method?: string | undefined;
  readonly url?: string | undefined;
}

export interface GatewayResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array;
}

export interface GatewayDependencies extends ProxyDependencies {
  /** Test-only override. Production always uses the fixed solved.ac API bases. */
  readonly upstreamBaseUrls?: SolvedApiBaseUrls;
}

export interface RequestHandlerOptions extends GatewayDependencies {
  readonly maxConcurrentRequests?: number;
}

const encoder = new TextEncoder();

function response(
  status: number,
  body: string | Uint8Array = new Uint8Array(),
  headers: Readonly<Record<string, string>> = {},
): GatewayResponse {
  return Object.freeze({
    status,
    headers: Object.freeze({ ...CORS_HEADERS, ...headers }),
    body: typeof body === 'string' ? encoder.encode(body) : body,
  });
}

function jsonResponse(
  status: number,
  value: Readonly<Record<string, unknown>>,
  headers: Readonly<Record<string, string>> = {},
): GatewayResponse {
  return response(status, JSON.stringify(value), {
    'content-type': 'application/json; charset=utf-8',
    ...headers,
  });
}

function errorResponse(
  status: number,
  code: string,
  headers: Readonly<Record<string, string>> = {},
): GatewayResponse {
  return jsonResponse(
    status,
    { error: code },
    {
      'cache-control': 'no-store',
      ...headers,
    },
  );
}

function parseRequestUrl(rawUrl: string | undefined): URL | undefined {
  if (
    rawUrl === undefined ||
    !rawUrl.startsWith('/') ||
    rawUrl.startsWith('//') ||
    rawUrl.includes('#') ||
    /[\u0000-\u0020\u007f]/u.test(rawUrl) ||
    Buffer.byteLength(rawUrl, 'utf8') > MAX_REQUEST_TARGET_BYTES
  ) {
    return undefined;
  }

  const rawPath = rawUrl.split('?', 1)[0] ?? '';
  for (const segment of rawPath.split('/')) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return undefined;
    }
    if (
      decoded === '.' ||
      decoded === '..' ||
      decoded.includes('/') ||
      decoded.includes('\\')
    ) {
      return undefined;
    }
  }
  try {
    return new URL(rawUrl, 'http://gateway.invalid');
  } catch {
    return undefined;
  }
}

function isKnownPath(pathname: string): boolean {
  return pathname === '/healthz' || findRoute(pathname) !== undefined;
}

function hasRequestBody(request: IncomingMessage): boolean {
  if (request.headers['transfer-encoding'] !== undefined) {
    return true;
  }
  const contentLength = request.headers['content-length'];
  if (contentLength === undefined) {
    return false;
  }
  return !/^0+$/u.test(contentLength);
}

function bypassesConcurrencyLimit(request: GatewayRequest): boolean {
  const method = request.method?.toUpperCase() ?? 'GET';
  if (method === 'OPTIONS') {
    return true;
  }
  if (method !== 'GET') {
    return false;
  }
  const requestUrl = parseRequestUrl(request.url);
  return requestUrl?.pathname === '/healthz';
}

export async function handleGatewayRequest(
  request: GatewayRequest,
  dependencies: GatewayDependencies = {},
): Promise<GatewayResponse> {
  const requestUrl = parseRequestUrl(request.url);
  if (requestUrl === undefined) {
    return errorResponse(400, 'invalid_request');
  }

  if (!isKnownPath(requestUrl.pathname)) {
    return errorResponse(404, 'not_found');
  }

  const method = request.method?.toUpperCase() ?? 'GET';
  if (method === 'OPTIONS') {
    return response(204, new Uint8Array(), { allow: 'GET, OPTIONS' });
  }
  if (method !== 'GET') {
    return errorResponse(405, 'method_not_allowed', {
      allow: 'GET, OPTIONS',
    });
  }

  if (requestUrl.pathname === '/healthz') {
    return jsonResponse(200, { status: 'ok' }, { 'cache-control': 'no-store' });
  }
  try {
    const { upstreamUrl, apiVersion } = resolveProxyRequest(
      requestUrl,
      dependencies.upstreamBaseUrls ?? SOLVED_API_BASE_URLS,
    );
    const {
      upstreamBaseUrls: _upstreamBaseUrls,
      credentials,
      ...proxyDependencies
    } = dependencies;
    let upstreamResponse;
    if (apiVersion === 'v4') {
      if (credentials === undefined) {
        return errorResponse(503, 'service_unavailable');
      }
      upstreamResponse = await proxyRequest(upstreamUrl, {
        ...proxyDependencies,
        credentials,
      });
    } else {
      upstreamResponse = await proxyRequest(upstreamUrl, proxyDependencies);
    }
    return response(
      upstreamResponse.status,
      upstreamResponse.body,
      upstreamResponse.headers,
    );
  } catch (error) {
    if (error instanceof ContractError || error instanceof UpstreamError) {
      return errorResponse(error.status, error.code);
    }
    return errorResponse(500, 'internal_error');
  }
}

function writeResponse(
  serverResponse: ServerResponse,
  gatewayResponse: GatewayResponse,
): void {
  serverResponse.writeHead(gatewayResponse.status, gatewayResponse.headers);
  serverResponse.end(gatewayResponse.body);
}

export function createRequestHandler(
  options: RequestHandlerOptions = {},
): RequestListener {
  const maxConcurrentRequests =
    options.maxConcurrentRequests ?? DEFAULT_MAX_CONCURRENT_REQUESTS;
  if (
    !Number.isSafeInteger(maxConcurrentRequests) ||
    maxConcurrentRequests < 1
  ) {
    throw new RangeError('maxConcurrentRequests must be a positive integer');
  }

  const { maxConcurrentRequests: _maximum, ...dependencies } = options;
  let activeRequests = 0;

  return (request: IncomingMessage, serverResponse: ServerResponse): void => {
    let requestAbortController: AbortController | undefined;
    let releaseRequest = (): void => {};
    const handleStreamError = (): void => {
      requestAbortController?.abort();
      releaseRequest();
    };
    request.on('error', handleStreamError);
    serverResponse.on('error', handleStreamError);
    request.resume();
    if (hasRequestBody(request)) {
      writeResponse(
        serverResponse,
        errorResponse(400, 'request_body_not_allowed', {
          connection: 'close',
        }),
      );
      return;
    }

    const isLimited = !bypassesConcurrencyLimit(request);
    if (isLimited && activeRequests >= maxConcurrentRequests) {
      writeResponse(
        serverResponse,
        errorResponse(503, 'overloaded', { 'retry-after': '1' }),
      );
      return;
    }

    if (isLimited) {
      activeRequests += 1;
    }

    const clientAbortController = new AbortController();
    requestAbortController = clientAbortController;
    const abortFromParent = (): void => clientAbortController.abort();
    dependencies.signal?.addEventListener('abort', abortFromParent, {
      once: true,
    });
    if (dependencies.signal?.aborted === true) {
      clientAbortController.abort();
    }
    let clientClosed = false;
    let released = false;
    const release = (): void => {
      if (released) {
        return;
      }
      released = true;
      dependencies.signal?.removeEventListener('abort', abortFromParent);
      if (isLimited) {
        activeRequests -= 1;
      }
    };
    releaseRequest = release;

    serverResponse.once('finish', release);
    serverResponse.once('close', () => {
      clientClosed = true;
      if (!serverResponse.writableFinished) {
        clientAbortController.abort();
      }
      release();
    });

    const send = (gatewayResponse: GatewayResponse): void => {
      if (
        clientClosed ||
        serverResponse.destroyed ||
        serverResponse.writableEnded
      ) {
        release();
        return;
      }
      try {
        writeResponse(serverResponse, gatewayResponse);
      } catch {
        clientAbortController.abort();
        release();
        serverResponse.destroy();
      }
    };

    void handleGatewayRequest(request, {
      ...dependencies,
      signal: clientAbortController.signal,
    })
      .then(send)
      .catch(() => send(errorResponse(500, 'internal_error')));
  };
}
