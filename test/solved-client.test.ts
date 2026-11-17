import assert from 'node:assert/strict';
import { ReadableStream } from 'node:stream/web';
import test from 'node:test';

import { parseBearerAuthorization } from '../src/adapters/http/bearer-authorization.js';
import { parseAndValidateOAuthRequestBody } from '../src/adapters/http/oauth-request-body.js';
import { V4_OPERATION_MANIFEST } from '../src/generated/v4-operations.js';
import {
  proxyRequest as proxyUpstream,
  type ProxyDependencies,
  type ProxyRequestPolicy,
  UpstreamError,
} from '../src/adapters/solved/solved-client.js';
import type { V4ResponseContract } from '../src/domain/v4-operation-contract.js';

const upstreamUrl = new URL('https://solved.ac/api/v4/users/tourist');
const responsePolicy =
  V4_OPERATION_MANIFEST['GET /api/v4/users/{handle}'].responses;
const oauthOperation = V4_OPERATION_MANIFEST['POST /api/v4/oauth/token'];
const oauthRequestBody = oauthOperation.requestBody;
if (oauthRequestBody?.source !== 'gateway-supplement') {
  throw new Error('missing OAuth supplement');
}
function oauthBody() {
  const value = parseAndValidateOAuthRequestBody(
    new TextEncoder().encode('grant_type=refresh_token&refresh_token=value'),
    'form',
    oauthRequestBody,
  );
  if (value === undefined) {
    throw new Error('invalid OAuth fixture');
  }
  return value;
}
const validOAuthBody = oauthBody();

const proxyRequest = (
  url: URL,
  responses: Readonly<Record<string, V4ResponseContract>>,
  dependencies: ProxyDependencies = {},
) =>
  proxyUpstream(
    url,
    { method: 'GET', responses, responseCache: 'upstream' },
    dependencies,
  );

function bearer(value = 'Bearer caller-token') {
  const parsed = parseBearerAuthorization(['Authorization', value]);
  assert.equal(parsed.kind, 'valid');
  if (parsed.kind !== 'valid') {
    throw new Error('invalid bearer test fixture');
  }
  return parsed.authorization;
}

if (false) {
  // @ts-expect-error Bearer forwarding must always select the no-store variant.
  const invalidPolicy: ProxyRequestPolicy = {
    method: 'GET',
    responses: responsePolicy,
    responseCache: 'upstream',
    authorization: bearer(),
  };
  void invalidPolicy;

  // @ts-expect-error App OAuth policies cannot carry caller Authorization.
  const oauthWithBearer: ProxyRequestPolicy = {
    method: 'POST',
    authentication: 'app-oauth',
    responses: oauthOperation.responses,
    responseCache: 'no-store',
    responsePragma: 'no-cache',
    authorization: bearer(),
    requestBody: { kind: 'form', body: validOAuthBody },
  };
  void oauthWithBearer;
}

function jsonResponse(
  body: string | Uint8Array = '{}',
  init: Omit<ResponseInit, 'headers'> & {
    readonly headers?: Readonly<Record<string, string>>;
  } = {},
): Response {
  return new Response(body, {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
}

test('uses a fixed GET request without forwarding caller credentials', async () => {
  let capturedInput: URL | Request | string | undefined;
  let capturedInit: RequestInit | undefined;
  const fetchMock: typeof fetch = async (input, init) => {
    capturedInput = input;
    capturedInit = init;
    return jsonResponse('{"ok":true}');
  };

  await proxyRequest(upstreamUrl, responsePolicy, { fetch: fetchMock });

  assert.equal(capturedInput, upstreamUrl);
  assert.equal(capturedInit?.method, 'GET');
  assert.equal(capturedInit?.redirect, 'manual');
  assert.deepEqual(capturedInit?.headers, { accept: 'application/json' });
  assert.equal(new Headers(capturedInit?.headers).has('authorization'), false);
  assert.equal(new Headers(capturedInit?.headers).has('cookie'), false);
});

test('injects only server-owned solved.ac credentials for v4', async () => {
  let capturedInit: RequestInit | undefined;
  const fetchMock: typeof fetch = async (_input, init) => {
    capturedInit = init;
    return jsonResponse();
  };

  await proxyRequest(upstreamUrl, responsePolicy, {
    fetch: fetchMock,
    credentials: {
      clientId: 'server-client-id',
      clientSecret: 'server-client-secret',
    },
  });

  assert.deepEqual(capturedInit?.headers, {
    accept: 'application/json',
    'x-client-id': 'server-client-id',
    'x-client-secret': 'server-client-secret',
  });
  const headers = new Headers(capturedInit?.headers);
  assert.equal(headers.has('authorization'), false);
  assert.equal(headers.has('cookie'), false);
});

test('sends opaque OAuth form bodies with app-only policy and cache guards', async () => {
  let capturedInit: RequestInit | undefined;
  const actual = await proxyUpstream(
    new URL('https://solved.ac/api/v4/oauth/token'),
    {
      method: 'POST',
      authentication: 'app-oauth',
      responses: oauthOperation.responses,
      responseCache: 'no-store',
      responsePragma: 'no-cache',
      requestBody: { kind: 'form', body: validOAuthBody },
    },
    {
      credentials: {
        clientId: 'server-client-id',
        clientSecret: 'server-client-secret',
      },
      fetch: async (_input, init) => {
        capturedInit = init;
        return jsonResponse('{}', {
          headers: {
            'cache-control': 'public',
            etag: '"private"',
          },
        });
      },
    },
  );

  assert.deepEqual(capturedInit?.headers, {
    accept: 'application/json',
    'x-client-id': 'server-client-id',
    'x-client-secret': 'server-client-secret',
    'content-type': 'application/x-www-form-urlencoded',
  });
  assert.ok(capturedInit?.body instanceof Uint8Array);
  assert.equal(
    new TextDecoder().decode(capturedInit.body),
    'grant_type=refresh_token&refresh_token=value',
  );
  assert.equal(actual.headers['cache-control'], 'no-store');
  assert.equal(actual.headers.pragma, 'no-cache');
  assert.equal(actual.headers.etag, undefined);
});

test('rejects forged OAuth and supplemented GET policies before fetch', async () => {
  const unsafePolicies = [
    {
      method: 'GET', responses: responsePolicy, responseCache: 'upstream',
      authentication: 'app-oauth', responsePragma: 'no-cache',
    },
    {
      method: 'GET', responses: responsePolicy, responseCache: 'upstream',
      responsePragma: 'no-cache',
    },
    {
      method: 'POST', authentication: 'app-oauth',
      responses: oauthOperation.responses, responseCache: 'no-store',
      responsePragma: 'no-cache', authorization: bearer(),
      requestBody: { kind: 'form', body: validOAuthBody },
    },
    {
      method: 'POST', authentication: 'app-oauth',
      responses: oauthOperation.responses, responseCache: 'no-store',
      responsePragma: 'no-cache',
      requestBody: { kind: 'form', body: {} },
    },
  ];
  for (const unsafe of unsafePolicies) {
    let calls = 0;
    await assert.rejects(
      proxyUpstream(
        new URL('https://solved.ac/api/v4/oauth/token'),
        unsafe as unknown as ProxyRequestPolicy,
        {
          credentials: {
            clientId: 'server-client-id',
            clientSecret: 'server-client-secret',
          },
          fetch: async () => { calls += 1; return jsonResponse(); },
        },
      ),
      TypeError,
    );
    assert.equal(calls, 0);
  }

  let missingCredentialCalls = 0;
  await assert.rejects(
    proxyUpstream(
      new URL('https://solved.ac/api/v4/oauth/token'),
      {
        method: 'POST', authentication: 'app-oauth',
        responses: oauthOperation.responses, responseCache: 'no-store',
        responsePragma: 'no-cache',
        requestBody: { kind: 'form', body: validOAuthBody },
      },
      {
        fetch: async () => {
          missingCredentialCalls += 1;
          return jsonResponse();
        },
      },
    ),
    /OAuth requests require server credentials/u,
  );
  assert.equal(missingCredentialCalls, 0);
});

test('forwards only a validated typed Bearer value with server credentials', async () => {
  let capturedInit: RequestInit | undefined;
  await proxyUpstream(
    upstreamUrl,
    {
      method: 'GET',
      responses: responsePolicy,
      authorization: bearer('bearer opaque.token-_~+/='),
      responseCache: 'no-store',
    },
    {
      credentials: {
        clientId: 'server-client-id',
        clientSecret: 'server-client-secret',
      },
      fetch: async (_input, init) => {
        capturedInit = init;
        return jsonResponse();
      },
    },
  );

  assert.deepEqual(capturedInit?.headers, {
    accept: 'application/json',
    'x-client-id': 'server-client-id',
    'x-client-secret': 'server-client-secret',
    authorization: 'Bearer opaque.token-_~+/=',
  });
});

test('rejects an unsafe runtime Bearer/cache combination before fetch', async () => {
  let calls = 0;
  const unsafePolicy = {
    method: 'GET',
    responses: responsePolicy,
    responseCache: 'upstream',
    authorization: bearer(),
  } as unknown as ProxyRequestPolicy;

  await assert.rejects(
    proxyUpstream(upstreamUrl, unsafePolicy, {
      fetch: async () => {
        calls += 1;
        return jsonResponse();
      },
    }),
    (error: unknown) =>
      error instanceof TypeError &&
      error.message === 'Invalid proxy request policy' &&
      !error.message.includes('caller-token'),
  );
  assert.equal(calls, 0);
});

test('rejects cast-invalid method, body, and cache combinations before fetch', async () => {
  const unsafePolicies = [
    { method: 'GET', responses: responsePolicy, responseCache: 'private' },
    {
      method: 'GET', responses: responsePolicy, responseCache: 'upstream',
      requestBody: { kind: 'none' },
    },
    {
      method: 'POST', responses: responsePolicy, responseCache: 'no-store',
      requestBody: { kind: 'none' },
    },
    {
      method: 'PATCH', responses: responsePolicy, responseCache: 'no-store',
      authorization: bearer(), requestBody: { kind: 'none' },
    },
    {
      method: 'DELETE', responses: responsePolicy, responseCache: 'no-store',
      authorization: bearer(), requestBody: { kind: 'json', body: {} },
    },
    {
      method: 'PUT', responses: responsePolicy, responseCache: 'no-store',
      authorization: bearer(), requestBody: { kind: 'none' },
    },
  ];
  for (const unsafe of unsafePolicies) {
    let calls = 0;
    await assert.rejects(
      proxyUpstream(upstreamUrl, unsafe as unknown as ProxyRequestPolicy, {
        fetch: async () => { calls += 1; return jsonResponse(); },
      }),
      (error: unknown) => error instanceof TypeError &&
        error.message === 'Invalid proxy request policy',
    );
    assert.equal(calls, 0);
  }
});

test('does not dispatch a pre-aborted request', async () => {
  let calls = 0;
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    proxyRequest(upstreamUrl, responsePolicy, {
      signal: controller.signal,
      fetch: async () => { calls += 1; return jsonResponse(); },
    }),
    (error: unknown) => error instanceof UpstreamError &&
      error.code === 'upstream_unavailable',
  );
  assert.equal(calls, 0);
});

test('forces no-store and drops ETag for every token-aware response', async () => {
  for (const authorization of [undefined, bearer()]) {
    const actual = await proxyUpstream(
      upstreamUrl,
      {
        method: 'GET',
        responses: responsePolicy,
        ...(authorization === undefined ? {} : { authorization }),
        responseCache: 'no-store',
      },
      {
        fetch: async () =>
          jsonResponse('{}', {
            headers: {
              'cache-control': 'public, max-age=3600',
              etag: '"private"',
            },
          }),
      },
    );
    assert.equal(actual.headers['cache-control'], 'no-store');
    assert.equal(actual.headers.etag, undefined);
  }
});

test('preserves declared JSON bytes and only safe response headers', async () => {
  const body = new TextEncoder().encode(' \n{"limited":true}\n');
  const fetchMock: typeof fetch = async () =>
    jsonResponse(body, {
      status: 429,
      headers: {
        'retry-after': '30',
        'cache-control': 'public, max-age=10',
        etag: '"abc"',
        'x-ratelimit-limit': '300',
        'x-ratelimit-remaining': '299',
        'set-cookie': 'session=secret',
        location: 'https://evil.invalid/',
        'x-upstream-internal': 'hidden',
      },
    });

  const actual = await proxyRequest(upstreamUrl, responsePolicy, {
    fetch: fetchMock,
  });

  assert.equal(actual.status, 429);
  assert.deepEqual(actual.body, body);
  assert.deepEqual(actual.headers, {
    'content-type': 'application/json',
    'retry-after': '30',
    'cache-control': 'public, max-age=10',
    etag: '"abc"',
    'x-ratelimit-limit': '300',
    'x-ratelimit-remaining': '299',
  });
});

for (const status of [200, 404]) {
  test(`preserves declared upstream ${status}`, async () => {
    const fetchMock: typeof fetch = async () =>
      jsonResponse(`{"status":${status}}`, { status });
    const actual = await proxyRequest(upstreamUrl, responsePolicy, {
      fetch: fetchMock,
    });
    assert.equal(actual.status, status);
    assert.equal(new TextDecoder().decode(actual.body), `{"status":${status}}`);
  });
}

test('rejects undeclared status before reading the body', async () => {
  let cancelled = false;
  const fetchMock: typeof fetch = async () =>
    new Response(
      new ReadableStream<Uint8Array>({
        cancel() {
          cancelled = true;
        },
      }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
  await assert.rejects(
    proxyRequest(upstreamUrl, responsePolicy, { fetch: fetchMock }),
    (error: unknown) =>
      error instanceof UpstreamError &&
      error.status === 502 &&
      error.code === 'upstream_contract',
  );
  assert.equal(cancelled, true);
});

for (const contentType of [undefined, 'text/plain']) {
  test(`rejects ${contentType ?? 'missing'} response media type`, async () => {
    let cancelled = false;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        cancel() {
          cancelled = true;
        },
      }),
      {
        status: 200,
        headers:
          contentType === undefined ? {} : { 'content-type': contentType },
      },
    );
    if (contentType === undefined) {
      assert.equal(response.headers.get('content-type'), null);
    }
    const fetchMock: typeof fetch = async () => response;
    await assert.rejects(
      proxyRequest(upstreamUrl, responsePolicy, { fetch: fetchMock }),
      (error: unknown) =>
        error instanceof UpstreamError && error.code === 'upstream_contract',
    );
    assert.equal(cancelled, true);
  });
}

test('accepts JSON media parameters', async () => {
  const actual = await proxyRequest(upstreamUrl, responsePolicy, {
    fetch: async () =>
      new Response('{}', {
        headers: { 'content-type': 'Application/JSON; Charset=UTF-8' },
      }),
  });
  assert.equal(actual.status, 200);
});

test('requires Retry-After on the global 429 response', async () => {
  let cancelled = false;
  await assert.rejects(
    proxyRequest(upstreamUrl, responsePolicy, {
      fetch: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            cancel() {
              cancelled = true;
            },
          }),
          { status: 429, headers: { 'content-type': 'application/json' } },
        ),
    }),
    (error: unknown) =>
      error instanceof UpstreamError && error.code === 'upstream_contract',
  );
  assert.equal(cancelled, true);
});

test('supports an explicitly bodyless response policy', async () => {
  const bodylessPolicy: Readonly<Record<string, V4ResponseContract>> = {
    '204': {
      mediaTypes: [],
      requiredHeaders: [],
      source: 'openapi',
    },
  };
  const actual = await proxyRequest(upstreamUrl, bodylessPolicy, {
    fetch: async () => new Response(null, { status: 204 }),
  });
  assert.equal(actual.status, 204);
  assert.equal(actual.body.byteLength, 0);
});

test('maps a network failure to 502', async () => {
  const fetchMock: typeof fetch = async () => {
    throw new TypeError('network failed');
  };
  await assert.rejects(
    proxyRequest(upstreamUrl, responsePolicy, { fetch: fetchMock }),
    (error: unknown) =>
      error instanceof UpstreamError &&
      error.status === 502 &&
      error.code === 'upstream_unavailable',
  );
});

test('maps an aborted upstream request to 504', async () => {
  const fetchMock: typeof fetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener(
        'abort',
        () => reject(new Error('aborted')),
        { once: true },
      );
    });

  await assert.rejects(
    proxyRequest(upstreamUrl, responsePolicy, {
      fetch: fetchMock,
      timeoutMs: 1,
    }),
    (error: unknown) =>
      error instanceof UpstreamError &&
      error.status === 504 &&
      error.code === 'upstream_timeout',
  );
});

test('maps an aborted body read to 504', async () => {
  const fetchMock: typeof fetch = async (_input, init) =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener(
            'abort',
            () => controller.error(new Error('aborted')),
            { once: true },
          );
        },
      }),
      { headers: { 'content-type': 'application/json' } },
    );

  await assert.rejects(
    proxyRequest(upstreamUrl, responsePolicy, {
      fetch: fetchMock,
      timeoutMs: 1,
    }),
    (error: unknown) =>
      error instanceof UpstreamError &&
      error.status === 504 &&
      error.code === 'upstream_timeout',
  );
});

test('maps a failed body read to 502', async () => {
  const fetchMock: typeof fetch = async () =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(new Error('stream failed'));
        },
      }),
      { headers: { 'content-type': 'application/json' } },
    );

  await assert.rejects(
    proxyRequest(upstreamUrl, responsePolicy, { fetch: fetchMock }),
    (error: unknown) =>
      error instanceof UpstreamError &&
      error.status === 502 &&
      error.code === 'upstream_unavailable',
  );
});

test('rejects redirects instead of following or forwarding Location', async () => {
  const fetchMock: typeof fetch = async () =>
    new Response(null, {
      status: 302,
      headers: { location: 'https://evil.invalid/' },
    });
  await assert.rejects(
    proxyRequest(upstreamUrl, responsePolicy, { fetch: fetchMock }),
    (error: unknown) =>
      error instanceof UpstreamError &&
      error.status === 502 &&
      error.code === 'upstream_redirect',
  );
});

test('rejects a declared response larger than the limit', async () => {
  const fetchMock: typeof fetch = async () =>
    jsonResponse('small', { headers: { 'content-length': '100' } });
  await assert.rejects(
    proxyRequest(upstreamUrl, responsePolicy, {
      fetch: fetchMock,
      maxResponseBytes: 10,
    }),
    (error: unknown) =>
      error instanceof UpstreamError &&
      error.code === 'upstream_response_too_large',
  );
});

test('rejects a streamed response that crosses the limit', async () => {
  const fetchMock: typeof fetch = async () =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.enqueue(new Uint8Array([4, 5, 6]));
          controller.close();
        },
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  await assert.rejects(
    proxyRequest(upstreamUrl, responsePolicy, {
      fetch: fetchMock,
      maxResponseBytes: 5,
    }),
    (error: unknown) =>
      error instanceof UpstreamError &&
      error.code === 'upstream_response_too_large',
  );
});
