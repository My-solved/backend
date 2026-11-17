import {
  bearerAuthorizationHeader,
  type BearerAuthorization,
} from '../../domain/bearer-authorization.js';
import type { SolvedClientCredentials } from '../../domain/solved-client-credentials.js';
import {
  validatedFormRequestBodyBytes,
  type ValidatedFormRequestBody,
} from '../../domain/validated-form-request-body.js';
import {
  validatedJsonRequestBodyBytes,
  type ValidatedJsonRequestBody,
} from '../../domain/validated-json-request-body.js';
import type { V4ResponseContract } from '../../domain/v4-operation-contract.js';

export const DEFAULT_UPSTREAM_TIMEOUT_MS = 8_000;
export const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1_024 * 1_024;

const SAFE_RESPONSE_HEADERS = Object.freeze([
  'content-type',
  'retry-after',
  'cache-control',
  'etag',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
] as const);

export interface ProxyDependencies {
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
  readonly maxResponseBytes?: number;
  readonly signal?: AbortSignal;
  readonly credentials?: SolvedClientCredentials;
}

export interface ProxyResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array;
}

type NoProxyRequestBody = { readonly kind: 'none' };
type JsonProxyRequestBody = {
  readonly kind: 'json';
  readonly body: ValidatedJsonRequestBody;
};
type FormProxyRequestBody = {
  readonly kind: 'form';
  readonly body: ValidatedFormRequestBody;
};

export type ProxyRequestPolicy =
  | {
      readonly method: 'GET';
      readonly responses: Readonly<Record<string, V4ResponseContract>>;
      readonly responseCache: 'upstream';
      readonly authentication?: never;
      readonly authorization?: never;
      readonly responsePragma?: never;
      readonly requestBody?: never;
    }
  | {
      readonly method: 'GET';
      readonly responses: Readonly<Record<string, V4ResponseContract>>;
      readonly responseCache: 'no-store';
      readonly authentication?: never;
      readonly authorization?: BearerAuthorization;
      readonly responsePragma?: never;
      readonly requestBody?: never;
    }
  | {
      readonly method: 'POST';
      readonly responses: Readonly<Record<string, V4ResponseContract>>;
      readonly responseCache: 'no-store';
      readonly authentication?: never;
      readonly authorization: BearerAuthorization;
      readonly responsePragma?: never;
      readonly requestBody: NoProxyRequestBody | JsonProxyRequestBody;
    }
  | {
      readonly method: 'POST';
      readonly authentication: 'app-oauth';
      readonly responses: Readonly<Record<string, V4ResponseContract>>;
      readonly responseCache: 'no-store';
      readonly responsePragma: 'no-cache';
      readonly authorization?: never;
      readonly requestBody: FormProxyRequestBody;
    }
  | {
      readonly method: 'PATCH';
      readonly responses: Readonly<Record<string, V4ResponseContract>>;
      readonly responseCache: 'no-store';
      readonly authentication?: never;
      readonly authorization: BearerAuthorization;
      readonly responsePragma?: never;
      readonly requestBody: JsonProxyRequestBody;
    }
  | {
      readonly method: 'DELETE';
      readonly responses: Readonly<Record<string, V4ResponseContract>>;
      readonly responseCache: 'no-store';
      readonly authentication?: never;
      readonly authorization: BearerAuthorization;
      readonly responsePragma?: never;
      readonly requestBody: NoProxyRequestBody;
    };

export class UpstreamError extends Error {
  constructor(
    readonly status: 502 | 504,
    readonly code:
      | 'upstream_unavailable'
      | 'upstream_timeout'
      | 'upstream_redirect'
      | 'upstream_contract'
      | 'upstream_response_too_large',
    message: string,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

function requestBytesFor(policy: ProxyRequestPolicy): Uint8Array | undefined {
  const method = (policy as { readonly method?: unknown }).method;
  if (method === 'GET') {
    if ('authentication' in policy || 'responsePragma' in policy) {
      throw new TypeError('Invalid proxy request policy');
    }
    if (
      policy.responseCache !== 'upstream' &&
      policy.responseCache !== 'no-store'
    ) {
      throw new TypeError('Invalid proxy request policy');
    }
    if (
      policy.responseCache === 'upstream' &&
      policy.authorization !== undefined
    ) {
      throw new TypeError('Invalid proxy request policy');
    }
    if ((policy as { readonly requestBody?: unknown }).requestBody !== undefined) {
      throw new TypeError('Invalid proxy request policy');
    }
    return undefined;
  }
  if (method !== 'POST' && method !== 'PATCH' && method !== 'DELETE') {
    throw new TypeError('Invalid proxy request policy');
  }
  const mutation = policy as Extract<
    ProxyRequestPolicy,
    { readonly method: 'POST' | 'PATCH' | 'DELETE' }
  >;
  if ('authentication' in mutation) {
    if (
      method !== 'POST' ||
      mutation.authentication !== 'app-oauth' ||
      mutation.responseCache !== 'no-store' ||
      mutation.responsePragma !== 'no-cache' ||
      'authorization' in mutation ||
      mutation.requestBody?.kind !== 'form'
    ) {
      throw new TypeError('Invalid proxy request policy');
    }
    return validatedFormRequestBodyBytes(mutation.requestBody.body);
  }
  if ('responsePragma' in mutation) {
    throw new TypeError('Invalid proxy request policy');
  }
  if (
    mutation.responseCache !== 'no-store' ||
    mutation.authorization === undefined ||
    mutation.requestBody === undefined
  ) {
    throw new TypeError('Invalid proxy request policy');
  }
  if (
    (method === 'DELETE' && mutation.requestBody.kind !== 'none') ||
    (method === 'PATCH' && mutation.requestBody.kind !== 'json')
  ) {
    throw new TypeError('Invalid proxy request policy');
  }
  if (mutation.requestBody.kind === 'none') {
    return undefined;
  }
  if (mutation.requestBody.kind !== 'json') {
    throw new TypeError('Invalid proxy request policy');
  }
  return validatedJsonRequestBodyBytes(mutation.requestBody.body);
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // The contract error is authoritative; cancellation is best effort.
  }
}

async function validateResponseContract(
  response: Response,
  responsePolicy: Readonly<Record<string, V4ResponseContract>>,
): Promise<V4ResponseContract> {
  const contract = responsePolicy[String(response.status)];
  if (contract === undefined) {
    await cancelResponseBody(response);
    throw new UpstreamError(
      502,
      'upstream_contract',
      'Upstream returned an undeclared status',
    );
  }

  for (const name of contract.requiredHeaders) {
    const value = response.headers.get(name);
    if (value === null || value.trim().length === 0) {
      await cancelResponseBody(response);
      throw new UpstreamError(
        502,
        'upstream_contract',
        'Upstream omitted a required response header',
      );
    }
  }

  const contentType = response.headers.get('content-type');
  const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase();
  const mediaTypeAllowed =
    contract.mediaTypes.length === 0
      ? contentType === null
      : mediaType !== undefined &&
        contract.mediaTypes.some((candidate) => candidate === mediaType);
  if (!mediaTypeAllowed) {
    await cancelResponseBody(response);
    throw new UpstreamError(
      502,
      'upstream_contract',
      'Upstream returned an undeclared media type',
    );
  }
  return contract;
}

async function readLimitedBody(
  response: Response,
  maximumBytes: number,
): Promise<Uint8Array> {
  const contentLength = response.headers.get('content-length');
  if (contentLength !== null) {
    const parsedLength = Number(contentLength);
    if (Number.isFinite(parsedLength) && parsedLength > maximumBytes) {
      await response.body?.cancel();
      throw new UpstreamError(
        502,
        'upstream_response_too_large',
        'Upstream response exceeded the size limit',
      );
    }
  }

  if (response.body === null) {
    return new Uint8Array();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel();
        throw new UpstreamError(
          502,
          'upstream_response_too_large',
          'Upstream response exceeded the size limit',
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function proxyRequest(
  upstreamUrl: URL,
  policy: ProxyRequestPolicy,
  dependencies: ProxyDependencies = {},
): Promise<ProxyResponse> {
  const requestBody = requestBytesFor(policy);
  const fetchImplementation = dependencies.fetch ?? globalThis.fetch;
  const timeoutMs = dependencies.timeoutMs ?? DEFAULT_UPSTREAM_TIMEOUT_MS;
  const maxResponseBytes =
    dependencies.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromCaller = (): void => controller.abort();
  dependencies.signal?.addEventListener('abort', abortFromCaller, {
    once: true,
  });
  if (dependencies.signal?.aborted === true) {
    controller.abort();
  }

  try {
    if (controller.signal.aborted) {
      throw new UpstreamError(
        502,
        'upstream_unavailable',
        'Upstream request was aborted before dispatch',
      );
    }
    const requestHeaders: Record<string, string> = {
      accept: 'application/json',
    };
    if (dependencies.credentials !== undefined) {
      requestHeaders['x-client-id'] = dependencies.credentials.clientId;
      requestHeaders['x-client-secret'] = dependencies.credentials.clientSecret;
    }
    if (
      'authentication' in policy &&
      policy.authentication === 'app-oauth' &&
      dependencies.credentials === undefined
    ) {
      throw new TypeError('OAuth requests require server credentials');
    }
    if (policy.authorization !== undefined) {
      requestHeaders.authorization = bearerAuthorizationHeader(
        policy.authorization,
      );
    }
    if (requestBody !== undefined) {
      requestHeaders['content-type'] =
        'authentication' in policy && policy.authentication === 'app-oauth'
          ? 'application/x-www-form-urlencoded'
          : 'application/json';
    }
    const response = await fetchImplementation(upstreamUrl, {
      method: policy.method,
      headers: requestHeaders,
      redirect: 'manual',
      signal: controller.signal,
      ...(requestBody === undefined
        ? {}
        : { body: Buffer.from(requestBody) }),
    });

    if (response.status >= 300 && response.status < 400) {
      await cancelResponseBody(response);
      throw new UpstreamError(
        502,
        'upstream_redirect',
        'Upstream redirects are not allowed',
      );
    }

    const responseContract = await validateResponseContract(
      response,
      policy.responses,
    );

    const responseHeaders: Record<string, string> = {};
    for (const name of SAFE_RESPONSE_HEADERS) {
      if (
        policy.responseCache === 'no-store' &&
        (name === 'cache-control' || name === 'etag')
      ) {
        continue;
      }
      const value = response.headers.get(name);
      if (value !== null) {
        responseHeaders[name] = value;
      }
    }
    if (policy.responseCache === 'no-store') {
      responseHeaders['cache-control'] = 'no-store';
    }
    if (
      'responsePragma' in policy &&
      policy.responsePragma === 'no-cache'
    ) {
      responseHeaders.pragma = 'no-cache';
    }

    const body = await readLimitedBody(response, maxResponseBytes);
    if (responseContract.mediaTypes.length === 0 && body.byteLength !== 0) {
      throw new UpstreamError(
        502,
        'upstream_contract',
        'Upstream returned a body for a bodyless response',
      );
    }
    return Object.freeze({
      status: response.status,
      headers: Object.freeze(responseHeaders),
      body,
    });
  } catch (error) {
    if (error instanceof UpstreamError) {
      throw error;
    }
    if (timedOut) {
      throw new UpstreamError(
        504,
        'upstream_timeout',
        'Upstream request timed out',
      );
    }
    throw new UpstreamError(
      502,
      'upstream_unavailable',
      error instanceof Error ? error.message : 'Upstream request failed',
    );
  } finally {
    clearTimeout(timer);
    dependencies.signal?.removeEventListener('abort', abortFromCaller);
  }
}
