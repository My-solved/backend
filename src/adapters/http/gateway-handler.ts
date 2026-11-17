import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';

import type { BearerAuthorization } from '../../domain/bearer-authorization.js';
import { parseBearerAuthorization } from './bearer-authorization.js';
import {
  ContractError,
  resolveProxyRequest,
  SOLVED_API_BASE_URL,
} from '../../application/v4-request-contract.js';
import { corsDecision } from './cors-policy.js';
import {
  proxyRequest,
  type ProxyDependencies,
  type ProxyRequestPolicy,
  UpstreamError,
} from '../solved/solved-client.js';
import { parseRequestTarget } from './request-target.js';
import { findRoute } from '../../application/v4-router.js';

export const DEFAULT_MAX_CONCURRENT_REQUESTS = 8;

const PUBLIC_CORS_HEADERS = Object.freeze({
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-max-age': '86400',
});
const SECURITY_HEADERS = Object.freeze({ 'x-content-type-options': 'nosniff' });

export interface GatewayRequest {
  readonly method?: string | undefined;
  readonly url?: string | undefined;
  readonly rawHeaders?: readonly string[] | undefined;
}

export interface GatewayResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array;
}

export interface GatewayDependencies extends ProxyDependencies {
  /** Test-only override. Production always uses the fixed solved.ac v4 base. */
  readonly upstreamBaseUrl?: string | URL;
  readonly protectedCorsOrigins?: readonly string[];
}

export interface RequestHandlerOptions extends GatewayDependencies {
  readonly maxConcurrentRequests?: number;
}

const encoder = new TextEncoder();

function response(
  status: number,
  body: string | Uint8Array = new Uint8Array(),
  headers: Readonly<Record<string, string>> = {},
  corsHeaders: Readonly<Record<string, string>> = PUBLIC_CORS_HEADERS,
): GatewayResponse {
  return Object.freeze({
    status,
    headers: Object.freeze({ ...SECURITY_HEADERS, ...corsHeaders, ...headers }),
    body: typeof body === 'string' ? encoder.encode(body) : body,
  });
}

function jsonResponse(
  status: number,
  value: Readonly<Record<string, unknown>>,
  headers: Readonly<Record<string, string>> = {},
  corsHeaders: Readonly<Record<string, string>> = PUBLIC_CORS_HEADERS,
): GatewayResponse {
  return response(
    status,
    JSON.stringify(value),
    {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
    corsHeaders,
  );
}

function errorResponse(
  status: number,
  code: string,
  headers: Readonly<Record<string, string>> = {},
  corsHeaders: Readonly<Record<string, string>> = PUBLIC_CORS_HEADERS,
): GatewayResponse {
  return jsonResponse(
    status,
    { error: code },
    {
      'cache-control': 'no-store',
      ...headers,
    },
    corsHeaders,
  );
}

function immediateCorsDecision(
  request: GatewayRequest,
  protectedOrigins: readonly string[],
): ReturnType<typeof corsDecision> {
  const requestTarget = parseRequestTarget(request.url);
  if (requestTarget === undefined || requestTarget.pathname === '/healthz') {
    return { allowed: true, headers: PUBLIC_CORS_HEADERS };
  }
  const route = findRoute(requestTarget.decodedPathSegments);
  if (route === undefined) {
    return { allowed: true, headers: PUBLIC_CORS_HEADERS };
  }
  return corsDecision(
    request.rawHeaders,
    request.method?.toUpperCase() === 'OPTIONS',
    route.operation.access.bearer !== 'none',
    protectedOrigins,
  );
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
  const requestTarget = parseRequestTarget(request.url);
  return requestTarget?.pathname === '/healthz';
}

export async function handleGatewayRequest(
  request: GatewayRequest,
  dependencies: GatewayDependencies = {},
): Promise<GatewayResponse> {
  const requestTarget = parseRequestTarget(request.url);
  if (requestTarget === undefined) {
    return errorResponse(400, 'invalid_request');
  }

  const isHealth = requestTarget.pathname === '/healthz';
  const route = isHealth
    ? undefined
    : findRoute(requestTarget.decodedPathSegments);
  if (!isHealth && route === undefined) {
    return errorResponse(404, 'not_found');
  }

  const method = request.method?.toUpperCase() ?? 'GET';
  const policy = route === undefined ? 'none' : route.operation.access.bearer;
  const cors = corsDecision(
    request.rawHeaders,
    method === 'OPTIONS',
    policy !== 'none',
    dependencies.protectedCorsOrigins ?? [],
  );
  if (!cors.allowed) {
    return errorResponse(403, 'cors_forbidden', {}, cors.headers);
  }
  if (method === 'OPTIONS') {
    return response(
      204,
      new Uint8Array(),
      { allow: 'GET, OPTIONS' },
      cors.headers,
    );
  }
  if (method !== 'GET') {
    return errorResponse(
      405,
      'method_not_allowed',
      { allow: 'GET, OPTIONS' },
      cors.headers,
    );
  }

  if (isHealth) {
    return jsonResponse(200, { status: 'ok' }, { 'cache-control': 'no-store' });
  }
  if (route === undefined) {
    return errorResponse(404, 'not_found');
  }

  try {
    const { upstreamUrl, responsePolicy } = resolveProxyRequest(
      requestTarget,
      dependencies.upstreamBaseUrl ?? SOLVED_API_BASE_URL,
    );

    let authorization: BearerAuthorization | undefined;
    if (policy !== 'none') {
      const parsedAuthorization = parseBearerAuthorization(request.rawHeaders);
      if (parsedAuthorization.kind === 'invalid') {
        return errorResponse(
          400,
          'invalid_authorization',
          {},
          cors.headers,
        );
      }
      if (parsedAuthorization.kind === 'absent' && policy === 'required') {
        return errorResponse(
          401,
          'unauthorized',
          { 'www-authenticate': 'Bearer' },
          cors.headers,
        );
      }
      if (parsedAuthorization.kind === 'valid') {
        authorization = parsedAuthorization.authorization;
      }
    }

    const {
      upstreamBaseUrl: _upstreamBaseUrl,
      protectedCorsOrigins: _protectedCorsOrigins,
      credentials,
      ...proxyDependencies
    } = dependencies;
    if (credentials === undefined) {
      return errorResponse(503, 'service_unavailable', {}, cors.headers);
    }
    const proxyPolicy: ProxyRequestPolicy =
      policy === 'none'
        ? { responses: responsePolicy, responseCache: 'upstream' }
        : {
            responses: responsePolicy,
            ...(authorization === undefined ? {} : { authorization }),
            responseCache: 'no-store',
          };
    const upstreamResponse = await proxyRequest(
      upstreamUrl,
      proxyPolicy,
      {
        ...proxyDependencies,
        credentials,
      },
    );
    return response(
      upstreamResponse.status,
      upstreamResponse.body,
      upstreamResponse.headers,
      cors.headers,
    );
  } catch (error) {
    if (error instanceof ContractError || error instanceof UpstreamError) {
      return errorResponse(error.status, error.code, {}, cors.headers);
    }
    return errorResponse(500, 'internal_error', {}, cors.headers);
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
    const immediateCors = immediateCorsDecision(
      request,
      dependencies.protectedCorsOrigins ?? [],
    );
    const corsHeaders = immediateCors.headers;
    const requestHasBody = hasRequestBody(request);
    if (!immediateCors.allowed) {
      writeResponse(
        serverResponse,
        errorResponse(
          403,
          'cors_forbidden',
          requestHasBody ? { connection: 'close' } : {},
          corsHeaders,
        ),
      );
      return;
    }
    if (requestHasBody) {
      writeResponse(
        serverResponse,
        errorResponse(
          400,
          'request_body_not_allowed',
          { connection: 'close' },
          corsHeaders,
        ),
      );
      return;
    }

    const isLimited = !bypassesConcurrencyLimit(request);
    if (isLimited && activeRequests >= maxConcurrentRequests) {
      writeResponse(
        serverResponse,
        errorResponse(
          503,
          'overloaded',
          { 'retry-after': '1' },
          corsHeaders,
        ),
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
      .catch(() =>
        send(errorResponse(500, 'internal_error', {}, corsHeaders)),
      );
  };
}
