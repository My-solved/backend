import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';

import type { BearerAuthorization } from '../../domain/bearer-authorization.js';
import type {
  V4HttpMethod,
  V4RequestSchema,
  V4SupplementRequestBodyContract,
} from '../../domain/v4-operation-contract.js';
import {
  ContractError,
  resolveMatchedProxyRequest,
  SOLVED_API_BASE_URL,
} from '../../application/v4-request-contract.js';
import {
  findRuntimePath,
  findRuntimeRoute,
  type MatchedV4Route,
} from '../../application/v4-router.js';
import { parseBearerAuthorization } from './bearer-authorization.js';
import {
  corsDecision,
} from './cors-policy.js';
import {
  oauthRequestBodyEncoding,
  parseAndValidateOAuthRequestBody,
  type OAuthRequestBodyEncoding,
} from './oauth-request-body.js';
import {
  inspectRequestBodyHeaders,
  isStrictJsonContentType,
  readIncomingBody,
  type RequestBodyHeaders,
} from './request-body.js';
import { parseRequestTarget } from './request-target.js';
import { rawHeadersContain } from './request-headers.js';
import { parseAndValidateJsonBody } from './strict-json-body.js';
import { v4PathPolicy } from './v4-route-policy.js';
import {
  proxyRequest,
  type ProxyDependencies,
  type ProxyRequestPolicy,
  UpstreamError,
} from '../solved/solved-client.js';

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
  /** Direct-call test input. The Node adapter streams IncomingMessage bodies. */
  readonly body?: Uint8Array | undefined;
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

type BodyPolicy =
  | { readonly kind: 'legacy-none' }
  | { readonly kind: 'mutation-none' }
  | { readonly kind: 'json'; readonly schema: V4RequestSchema }
  | {
      readonly kind: 'oauth';
      readonly contract: V4SupplementRequestBodyContract;
    };

interface PreparedBase {
  readonly bodyPolicy: BodyPolicy;
  readonly corsHeaders: Readonly<Record<string, string>>;
  readonly responseHeaders: Readonly<Record<string, string>>;
}

interface PreparedLocal extends PreparedBase {
  readonly kind: 'local';
  readonly response: GatewayResponse;
}

interface PreparedProxy extends PreparedBase {
  readonly kind: 'proxy';
  readonly route: MatchedV4Route;
  readonly upstreamUrl: URL;
  readonly authorization: BearerAuthorization | undefined;
}

type PreparedGatewayRequest = PreparedLocal | PreparedProxy;
type GatewayPlan =
  | { readonly kind: 'response'; readonly response: GatewayResponse }
  | PreparedGatewayRequest;

type BodyPreparation =
  | {
      readonly kind: 'ready';
      readonly headers: RequestBodyHeaders;
      readonly body: Uint8Array | undefined;
      readonly oauthEncoding?: OAuthRequestBodyEncoding;
    }
  | { readonly kind: 'response'; readonly response: GatewayResponse };

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
    { 'content-type': 'application/json; charset=utf-8', ...headers },
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
    { 'cache-control': 'no-store', ...headers },
    corsHeaders,
  );
}

function preparedErrorResponse(
  prepared: PreparedBase,
  status: number,
  code: string,
  headers: Readonly<Record<string, string>> = {},
): GatewayResponse {
  return errorResponse(
    status,
    code,
    { ...prepared.responseHeaders, ...headers },
    prepared.corsHeaders,
  );
}

function withConnectionClose(value: GatewayResponse): GatewayResponse {
  if (value.headers.connection === 'close') {
    return value;
  }
  return Object.freeze({
    ...value,
    headers: Object.freeze({ ...value.headers, connection: 'close' }),
  });
}

function allowedMethods(methods: readonly V4HttpMethod[]): string {
  return [...methods, 'OPTIONS'].join(', ');
}

function asV4Method(method: string): V4HttpMethod | undefined {
  return method === 'GET' ||
    method === 'POST' ||
    method === 'PATCH' ||
    method === 'DELETE'
    ? method
    : undefined;
}

function planGatewayRequest(
  request: GatewayRequest,
  dependencies: GatewayDependencies,
): GatewayPlan {
  const requestTarget = parseRequestTarget(request.url);
  if (requestTarget === undefined) {
    return { kind: 'response', response: errorResponse(400, 'invalid_request') };
  }

  const method = request.method?.toUpperCase() ?? 'GET';
  if (requestTarget.pathname === '/healthz') {
    const healthPolicy = {
      exactOrigin: false,
      allowedMethods: ['GET'],
      authorizationMethods: [],
      contentTypeMethods: [],
    } as const;
    const cors = corsDecision(
      request.rawHeaders,
      method === 'OPTIONS',
      healthPolicy,
      [],
    );
    if (!cors.allowed) {
      return {
        kind: 'response',
        response: errorResponse(403, 'cors_forbidden', {}, cors.headers),
      };
    }
    if (method === 'OPTIONS') {
      return {
        kind: 'local',
        bodyPolicy: { kind: 'legacy-none' },
        corsHeaders: cors.headers,
        responseHeaders: {},
        response: response(
          204,
          new Uint8Array(),
          { allow: 'GET, OPTIONS' },
          cors.headers,
        ),
      };
    }
    if (method !== 'GET') {
      return {
        kind: 'response',
        response: errorResponse(
          405,
          'method_not_allowed',
          { allow: 'GET, OPTIONS' },
          cors.headers,
        ),
      };
    }
    return {
      kind: 'local',
      bodyPolicy: { kind: 'legacy-none' },
      corsHeaders: cors.headers,
      responseHeaders: {},
      response: jsonResponse(
        200,
        { status: 'ok' },
        { 'cache-control': 'no-store' },
        cors.headers,
      ),
    };
  }

  const path = findRuntimePath(requestTarget.decodedPathSegments);
  if (path === undefined) {
    return { kind: 'response', response: errorResponse(404, 'not_found') };
  }
  const routePolicy = v4PathPolicy(
    path,
    requestTarget.decodedPathSegments,
  );
  const cors = corsDecision(
    request.rawHeaders,
    method === 'OPTIONS',
    routePolicy.cors,
    dependencies.protectedCorsOrigins ?? [],
  );
  if (!cors.allowed) {
    return {
      kind: 'response',
      response: errorResponse(
        403,
        'cors_forbidden',
        routePolicy.responseHeaders,
        cors.headers,
      ),
    };
  }
  const allow = allowedMethods(path.allowedMethods);
  if (method === 'OPTIONS') {
    return {
      kind: 'local',
      bodyPolicy: { kind: 'legacy-none' },
      corsHeaders: cors.headers,
      responseHeaders: routePolicy.responseHeaders,
      response: response(
        204,
        new Uint8Array(),
        { ...routePolicy.responseHeaders, allow },
        cors.headers,
      ),
    };
  }

  const v4Method = asV4Method(method);
  if (v4Method === undefined || !path.allowedMethods.includes(v4Method)) {
    return {
      kind: 'response',
      response: errorResponse(
        405,
        'method_not_allowed',
        { ...routePolicy.responseHeaders, allow },
        cors.headers,
      ),
    };
  }
  const route = findRuntimeRoute(
    v4Method,
    requestTarget.decodedPathSegments,
  );
  if (route === undefined) {
    return { kind: 'response', response: errorResponse(404, 'not_found') };
  }

  try {
    const { upstreamUrl } = resolveMatchedProxyRequest(
      requestTarget,
      route,
      dependencies.upstreamBaseUrl ?? SOLVED_API_BASE_URL,
    );
    const bearerPolicy = route.operation.access.bearer;
    let authorization: BearerAuthorization | undefined;
    if (
      route.operation.runtime.policy === 'supplemented' &&
      rawHeadersContain(request.rawHeaders, 'authorization')
    ) {
      return {
        kind: 'response',
        response: errorResponse(
          400,
          'invalid_authorization',
          routePolicy.responseHeaders,
          cors.headers,
        ),
      };
    }
    if (bearerPolicy !== 'none') {
      const parsed = parseBearerAuthorization(request.rawHeaders);
      if (parsed.kind === 'invalid') {
        return {
          kind: 'response',
          response: errorResponse(
            400,
            'invalid_authorization',
            routePolicy.responseHeaders,
            cors.headers,
          ),
        };
      }
      if (parsed.kind === 'absent' && bearerPolicy === 'required') {
        return {
          kind: 'response',
          response: errorResponse(
            401,
            'unauthorized',
            {
              ...routePolicy.responseHeaders,
              'www-authenticate': 'Bearer',
            },
            cors.headers,
          ),
        };
      }
      if (parsed.kind === 'valid') {
        authorization = parsed.authorization;
      }
    }
    if (dependencies.credentials === undefined) {
      return {
        kind: 'response',
        response: errorResponse(
          503,
          'service_unavailable',
          routePolicy.responseHeaders,
          cors.headers,
        ),
      };
    }

    const bodyPolicy: BodyPolicy =
      route.operation.method === 'GET'
        ? { kind: 'legacy-none' }
        : route.operation.requestBody === null
          ? { kind: 'mutation-none' }
          : route.operation.requestBody.source === 'gateway-supplement'
            ? { kind: 'oauth', contract: route.operation.requestBody }
            : { kind: 'json', schema: route.operation.requestBody.schema };
    return {
      kind: 'proxy',
      route,
      upstreamUrl,
      authorization,
      bodyPolicy,
      corsHeaders: cors.headers,
      responseHeaders: routePolicy.responseHeaders,
    };
  } catch (error) {
    if (error instanceof ContractError) {
      return {
        kind: 'response',
        response: errorResponse(
          error.status,
          error.code,
          routePolicy.responseHeaders,
          cors.headers,
        ),
      };
    }
    return {
      kind: 'response',
      response: errorResponse(
        500,
        'internal_error',
        routePolicy.responseHeaders,
        cors.headers,
      ),
    };
  }
}

function prepareRequestBody(
  prepared: PreparedGatewayRequest,
  request: GatewayRequest,
): BodyPreparation {
  const knownBody = request.body;
  const inspection = inspectRequestBodyHeaders(
    request.rawHeaders,
    knownBody?.byteLength ?? 0,
  );
  if (inspection.kind === 'too-large') {
    return {
      kind: 'response',
      response:
        prepared.bodyPolicy.kind === 'json' ||
        prepared.bodyPolicy.kind === 'oauth'
          ? preparedErrorResponse(prepared, 413, 'payload_too_large')
          : preparedErrorResponse(prepared, 400, 'request_body_not_allowed'),
    };
  }
  if (inspection.kind === 'invalid-media') {
    if (prepared.bodyPolicy.kind === 'legacy-none') {
      if (inspection.value.hasUnreadBody) {
        return {
          kind: 'response',
          response: preparedErrorResponse(
            prepared,
            400,
            'request_body_not_allowed',
          ),
        };
      }
      return { kind: 'ready', headers: inspection.value, body: knownBody };
    }
    return {
      kind: 'response',
      response:
        prepared.bodyPolicy.kind === 'json' ||
        prepared.bodyPolicy.kind === 'oauth'
          ? preparedErrorResponse(prepared, 415, 'unsupported_media_type')
          : preparedErrorResponse(prepared, 400, 'request_body_not_allowed'),
    };
  }
  if (inspection.kind === 'invalid') {
    return {
      kind: 'response',
      response: preparedErrorResponse(prepared, 400, 'invalid_request'),
    };
  }

  const headers = inspection.value;
  if (prepared.bodyPolicy.kind === 'legacy-none') {
    if (headers.hasUnreadBody) {
      return {
        kind: 'response',
        response: preparedErrorResponse(
          prepared,
          400,
          'request_body_not_allowed',
        ),
      };
    }
    return { kind: 'ready', headers, body: knownBody };
  }
  if (prepared.bodyPolicy.kind === 'mutation-none') {
    if (
      headers.hasUnreadBody ||
      headers.contentType !== undefined ||
      headers.contentEncoding !== undefined
    ) {
      return {
        kind: 'response',
        response: preparedErrorResponse(
          prepared,
          400,
          'request_body_not_allowed',
        ),
      };
    }
    return { kind: 'ready', headers, body: knownBody };
  }

  const bodyPresent =
    headers.chunked ||
    (headers.contentLength !== undefined && headers.contentLength > 0) ||
    (knownBody !== undefined && knownBody.byteLength > 0);
  if (!bodyPresent) {
    return {
      kind: 'response',
      response: preparedErrorResponse(prepared, 400, 'request_body_required'),
    };
  }
  const oauthEncoding =
    prepared.bodyPolicy.kind === 'oauth' && headers.contentType !== undefined
      ? oauthRequestBodyEncoding(
          headers.contentType,
          prepared.bodyPolicy.contract,
        )
      : undefined;
  if (
    headers.contentEncoding !== undefined ||
    headers.contentType === undefined ||
    (prepared.bodyPolicy.kind === 'json'
      ? !isStrictJsonContentType(headers.contentType)
      : oauthEncoding === undefined)
  ) {
    return {
      kind: 'response',
      response: preparedErrorResponse(prepared, 415, 'unsupported_media_type'),
    };
  }
  if (
    knownBody !== undefined &&
    headers.contentLength !== undefined &&
    knownBody.byteLength !== headers.contentLength
  ) {
    return {
      kind: 'response',
      response: preparedErrorResponse(prepared, 400, 'invalid_request_body'),
    };
  }
  return {
    kind: 'ready',
    headers,
    body: knownBody,
    ...(oauthEncoding === undefined ? {} : { oauthEncoding }),
  };
}

async function executePreparedRequest(
  prepared: PreparedGatewayRequest,
  body: Uint8Array | undefined,
  oauthEncoding: OAuthRequestBodyEncoding | undefined,
  dependencies: GatewayDependencies,
): Promise<GatewayResponse> {
  if (prepared.kind === 'local') {
    return prepared.response;
  }

  let validatedBody;
  let validatedOAuthBody;
  if (prepared.bodyPolicy.kind === 'json') {
    if (body === undefined || body.byteLength === 0) {
      return preparedErrorResponse(prepared, 400, 'request_body_required');
    }
    validatedBody =
      parseAndValidateJsonBody(body, prepared.bodyPolicy.schema);
    if (validatedBody === undefined) {
      return preparedErrorResponse(prepared, 400, 'invalid_request_body');
    }
  } else if (prepared.bodyPolicy.kind === 'oauth') {
    if (body === undefined || body.byteLength === 0) {
      return preparedErrorResponse(prepared, 400, 'request_body_required');
    }
    if (oauthEncoding === undefined) {
      return preparedErrorResponse(prepared, 500, 'internal_error');
    }
    validatedOAuthBody = parseAndValidateOAuthRequestBody(
      body,
      oauthEncoding,
      prepared.bodyPolicy.contract,
    );
    if (validatedOAuthBody === undefined) {
      return preparedErrorResponse(prepared, 400, 'invalid_request_body');
    }
  }

  const operation = prepared.route.operation;
  let proxyPolicy: ProxyRequestPolicy;
  if (operation.runtime.policy === 'supplemented') {
    if (
      operation.method !== 'POST' ||
      prepared.authorization !== undefined ||
      validatedOAuthBody === undefined
    ) {
      return preparedErrorResponse(prepared, 500, 'internal_error');
    }
    proxyPolicy = {
      method: 'POST',
      authentication: 'app-oauth',
      responses: operation.responses,
      requestBody: { kind: 'form', body: validatedOAuthBody },
      responseCache: 'no-store',
      responsePragma: 'no-cache',
    };
  } else if (operation.method === 'GET') {
    proxyPolicy =
      operation.access.bearer === 'none'
        ? {
            method: 'GET',
            responses: operation.responses,
            responseCache: 'upstream',
          }
        : {
            method: 'GET',
            responses: operation.responses,
            ...(prepared.authorization === undefined
              ? {}
              : { authorization: prepared.authorization }),
            responseCache: 'no-store',
          };
  } else {
    if (prepared.authorization === undefined) {
      return preparedErrorResponse(prepared, 500, 'internal_error');
    }
    if (operation.method === 'DELETE') {
      proxyPolicy = {
        method: 'DELETE',
        responses: operation.responses,
        authorization: prepared.authorization,
        requestBody: { kind: 'none' },
        responseCache: 'no-store',
      };
    } else if (operation.method === 'PATCH') {
      if (validatedBody === undefined) {
        return preparedErrorResponse(prepared, 500, 'internal_error');
      }
      proxyPolicy = {
        method: 'PATCH',
        responses: operation.responses,
        authorization: prepared.authorization,
        requestBody: { kind: 'json', body: validatedBody },
        responseCache: 'no-store',
      };
    } else {
      proxyPolicy = {
        method: 'POST',
        responses: operation.responses,
        authorization: prepared.authorization,
        requestBody:
          validatedBody === undefined
            ? { kind: 'none' }
            : { kind: 'json', body: validatedBody },
        responseCache: 'no-store',
      };
    }
  }

  const {
    upstreamBaseUrl: _upstreamBaseUrl,
    protectedCorsOrigins: _protectedCorsOrigins,
    credentials,
    ...proxyDependencies
  } = dependencies;
  if (credentials === undefined) {
    return preparedErrorResponse(prepared, 503, 'service_unavailable');
  }
  try {
    const upstreamResponse = await proxyRequest(
      prepared.upstreamUrl,
      proxyPolicy,
      { ...proxyDependencies, credentials },
    );
    return response(
      upstreamResponse.status,
      upstreamResponse.body,
      { ...upstreamResponse.headers, ...prepared.responseHeaders },
      prepared.corsHeaders,
    );
  } catch (error) {
    if (error instanceof UpstreamError) {
      return preparedErrorResponse(prepared, error.status, error.code);
    }
    return preparedErrorResponse(prepared, 500, 'internal_error');
  }
}

export async function handleGatewayRequest(
  request: GatewayRequest,
  dependencies: GatewayDependencies = {},
): Promise<GatewayResponse> {
  const plan = planGatewayRequest(request, dependencies);
  if (plan.kind === 'response') {
    return plan.response;
  }
  const body = prepareRequestBody(plan, request);
  if (body.kind === 'response') {
    return body.response;
  }
  return executePreparedRequest(
    plan,
    body.body,
    body.oauthEncoding,
    dependencies,
  );
}

function writeResponse(
  serverResponse: ServerResponse,
  gatewayResponse: GatewayResponse,
): void {
  if (gatewayResponse.headers.connection === 'close') {
    serverResponse.shouldKeepAlive = false;
  }
  serverResponse.writeHead(gatewayResponse.status, gatewayResponse.headers);
  serverResponse.end(gatewayResponse.body);
}

function rawRequestMayHaveUnreadBody(request: IncomingMessage): boolean {
  const inspection = inspectRequestBodyHeaders(request.rawHeaders);
  if (inspection.kind === 'valid') {
    return inspection.value.hasUnreadBody;
  }
  for (let index = 0; index + 1 < request.rawHeaders.length; index += 2) {
    const name = request.rawHeaders[index]?.toLowerCase();
    const value = request.rawHeaders[index + 1] ?? '';
    if (name === 'transfer-encoding') {
      return true;
    }
    if (name === 'content-length' && !/^0+$/u.test(value.trim())) {
      return true;
    }
  }
  return false;
}

export function createExpectationRejectionHandler(
  options: GatewayDependencies = {},
): RequestListener {
  return (request, serverResponse): void => {
    request.on('error', () => {});
    serverResponse.on('error', () => {});
    const target = parseRequestTarget(request.url);
    let corsHeaders: Readonly<Record<string, string>> = PUBLIC_CORS_HEADERS;
    let responseHeaders: Readonly<Record<string, string>> = {};
    if (target !== undefined && target.pathname !== '/healthz') {
      const path = findRuntimePath(target.decodedPathSegments);
      if (path !== undefined) {
        const routePolicy = v4PathPolicy(
          path,
          target.decodedPathSegments,
        );
        const cors = corsDecision(
          request.rawHeaders,
          false,
          routePolicy.cors,
          options.protectedCorsOrigins ?? [],
        );
        corsHeaders = cors.headers;
        responseHeaders = routePolicy.responseHeaders;
      }
    }
    writeResponse(
      serverResponse,
      errorResponse(
        417,
        'expectation_failed',
        { ...responseHeaders, connection: 'close' },
        corsHeaders,
      ),
    );
  };
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
    // IncomingMessage can report a late parser/socket error after a response.
    // Keep it handled even on synchronous rejection paths.
    request.on('error', () => {});
    serverResponse.on('error', () => {});
    const plan = planGatewayRequest(request, dependencies);
    if (plan.kind === 'response') {
      const unread = rawRequestMayHaveUnreadBody(request);
      if (!unread) {
        request.resume();
      }
      writeResponse(
        serverResponse,
        unread ? withConnectionClose(plan.response) : plan.response,
      );
      return;
    }

    const bodyPreparation = prepareRequestBody(plan, request);
    if (bodyPreparation.kind === 'response') {
      const unread = rawRequestMayHaveUnreadBody(request);
      if (!unread) {
        request.resume();
      }
      writeResponse(
        serverResponse,
        unread
          ? withConnectionClose(bodyPreparation.response)
          : bodyPreparation.response,
      );
      return;
    }

    const isLimited = plan.kind === 'proxy';
    if (isLimited && activeRequests >= maxConcurrentRequests) {
      const unread = rawRequestMayHaveUnreadBody(request);
      if (!unread) {
        request.resume();
      }
      const overloaded = preparedErrorResponse(
        plan,
        503,
        'overloaded',
        { 'retry-after': '1' },
      );
      writeResponse(
        serverResponse,
        unread ? withConnectionClose(overloaded) : overloaded,
      );
      return;
    }
    if (isLimited) {
      activeRequests += 1;
    }

    const controller = new AbortController();
    const abort = (): void => controller.abort();
    dependencies.signal?.addEventListener('abort', abort, { once: true });
    request.once('aborted', abort);
    request.once('error', abort);
    serverResponse.once('error', abort);
    if (
      dependencies.signal?.aborted === true ||
      request.aborted ||
      request.destroyed
    ) {
      controller.abort();
    }

    let clientClosed = false;
    let released = false;
    const release = (): void => {
      if (released) {
        return;
      }
      released = true;
      dependencies.signal?.removeEventListener('abort', abort);
      request.removeListener('aborted', abort);
      request.removeListener('error', abort);
      serverResponse.removeListener('error', abort);
      if (isLimited) {
        activeRequests -= 1;
      }
    };
    serverResponse.once('finish', release);
    serverResponse.once('close', () => {
      clientClosed = true;
      if (!serverResponse.writableFinished) {
        controller.abort();
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
        controller.abort();
        release();
        serverResponse.destroy();
      }
    };

    void (async () => {
      let body = bodyPreparation.body;
      if (
        plan.bodyPolicy.kind === 'json' ||
        plan.bodyPolicy.kind === 'oauth'
      ) {
        const incoming = await readIncomingBody(
          request,
          bodyPreparation.headers.contentLength,
          controller.signal,
        );
        if (incoming.kind === 'aborted') {
          if (!serverResponse.destroyed) {
            serverResponse.destroy();
          }
          release();
          return;
        }
        if (incoming.kind === 'too-large') {
          send(
            withConnectionClose(
              preparedErrorResponse(plan, 413, 'payload_too_large'),
            ),
          );
          return;
        }
        if (incoming.kind === 'invalid') {
          send(
            withConnectionClose(
              preparedErrorResponse(plan, 400, 'invalid_request_body'),
            ),
          );
          return;
        }
        body = incoming.body;
      } else {
        request.resume();
      }
      if (controller.signal.aborted) {
        if (!serverResponse.destroyed) {
          serverResponse.destroy();
        }
        release();
        return;
      }
      send(
        await executePreparedRequest(
          plan,
          body,
          bodyPreparation.oauthEncoding,
          {
            ...dependencies,
            signal: controller.signal,
          },
        ),
      );
    })().catch(() =>
      send(preparedErrorResponse(plan, 500, 'internal_error')),
    );
  };
}
