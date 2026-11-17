import assert from 'node:assert/strict';
import test from 'node:test';

import { handleGatewayRequest } from '../src/adapters/http/gateway-handler.js';

const credentials = Object.freeze({
  clientId: 'trusted-client-id',
  clientSecret: 'trusted-client-secret',
});
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const codeVerifier = 'v'.repeat(43);

function assertSensitive(headers: Readonly<Record<string, string>>): void {
  assert.equal(headers['cache-control'], 'no-store');
  assert.equal(headers.pragma, 'no-cache');
  assert.equal(headers.etag, undefined);
}

function jsonResponse(
  status = 200,
  headers: Readonly<Record<string, string>> = {},
): Response {
  return new Response('{}', {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=3600',
      etag: '"oauth-secret"',
      ...headers,
    },
  });
}

const fixtures = [
  {
    name: 'authorization-code form token',
    path: '/solved/v4/oauth/token',
    upstreamPath: '/api/v4/oauth/token',
    contentType: 'application/x-www-form-urlencoded',
    source:
      `redirect_uri=my.solved%3A%2F%2Fcallback&grant_type=authorization_code&code=issued-code&code_verifier=${codeVerifier}`,
    canonical:
      `code=issued-code&code_verifier=${codeVerifier}&grant_type=authorization_code&redirect_uri=my.solved%3A%2F%2Fcallback`,
  },
  {
    name: 'refresh JSON token',
    path: '/solved/v4/oauth/token',
    upstreamPath: '/api/v4/oauth/token',
    contentType: 'application/json; charset=utf-8',
    source:
      '{"scope":"profile offline.access","refresh_token":"refresh +/","grant_type":"refresh_token"}',
    canonical:
      'grant_type=refresh_token&refresh_token=refresh+%2B%2F&scope=profile+offline.access',
  },
  {
    name: 'form revoke',
    path: '/solved/v4/oauth/revoke',
    upstreamPath: '/api/v4/oauth/revoke',
    contentType: 'Application/X-WWW-Form-Urlencoded; Charset=UTF-8',
    source: 'token=access%2Btoken%2Fvalue',
    canonical: 'token=access%2Btoken%2Fvalue',
  },
] as const;

for (const fixture of fixtures) {
  test(`proxies ${fixture.name} as one canonical app-authenticated POST`, async () => {
    const body = encoder.encode(fixture.source);
    let calls = 0;
    let observedInput: URL | Request | string | undefined;
    let observedInit: RequestInit | undefined;
    const result = await handleGatewayRequest(
      {
        method: 'POST',
        url: fixture.path,
        body,
        rawHeaders: [
          'Origin', 'https://app.example',
          'Content-Type', fixture.contentType,
          'Content-Length', String(body.byteLength),
          'Cookie', 'session=caller-secret',
          'X-Client-Id', 'caller-client-id',
          'X-Client-Secret', 'caller-client-secret',
        ],
      },
      {
        credentials,
        protectedCorsOrigins: ['https://app.example'],
        fetch: async (input, init) => {
          calls += 1;
          observedInput = input;
          observedInit = init;
          return jsonResponse();
        },
      },
    );

    assert.equal(calls, 1);
    assert.equal(
      observedInput?.toString(),
      `https://solved.ac${fixture.upstreamPath}`,
    );
    assert.equal(observedInit?.method, 'POST');
    assert.equal(observedInit?.redirect, 'manual');
    assert.ok(observedInit?.body instanceof Uint8Array);
    assert.equal(decoder.decode(observedInit.body), fixture.canonical);
    const headers = new Headers(observedInit.headers);
    assert.deepEqual(Object.fromEntries(headers), {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
      'x-client-id': credentials.clientId,
      'x-client-secret': credentials.clientSecret,
    });
    for (const forbidden of [
      'authorization',
      'cookie',
      'content-length',
      'transfer-encoding',
    ]) {
      assert.equal(headers.has(forbidden), false);
    }
    assert.equal(result.status, 200);
    assert.equal(
      result.headers['access-control-allow-origin'],
      'https://app.example',
    );
    assertSensitive(result.headers);
  });
}

test('preserves every declared OAuth status while enforcing cache policy', async () => {
  const source = 'grant_type=refresh_token&refresh_token=value';
  const body = encoder.encode(source);
  for (const status of [200, 400, 401, 429]) {
    let calls = 0;
    const result = await handleGatewayRequest(
      {
        method: 'POST',
        url: '/solved/v4/oauth/token',
        body,
        rawHeaders: [
          'Content-Type', 'application/x-www-form-urlencoded',
          'Content-Length', String(body.byteLength),
        ],
      },
      {
        credentials,
        fetch: async () => {
          calls += 1;
          return jsonResponse(
            status,
            status === 429 ? { 'retry-after': '30' } : {},
          );
        },
      },
    );
    assert.equal(calls, 1);
    assert.equal(result.status, status);
    assert.equal(
      result.headers['retry-after'],
      status === 429 ? '30' : undefined,
    );
    assertSensitive(result.headers);
  }
});

test('rejects every caller Authorization before body parsing or fetch', async () => {
  for (const authorizationHeaders of [
    ['Authorization', 'Bearer caller-token'],
    ['Authorization', 'Basic caller-secret'],
    ['Authorization', ''],
    ['Authorization', 'one', 'authorization', 'two'],
  ]) {
    let calls = 0;
    const result = await handleGatewayRequest(
      {
        method: 'POST',
        url: '/solved/v4/oauth/token',
        rawHeaders: authorizationHeaders,
      },
      {
        credentials,
        fetch: async () => {
          calls += 1;
          return jsonResponse();
        },
      },
    );
    assert.equal(result.status, 400);
    assert.deepEqual(JSON.parse(decoder.decode(result.body)), {
      error: 'invalid_authorization',
    });
    assertSensitive(result.headers);
    assert.equal(calls, 0);
  }
});

test('rejects OAuth media, schema, size, and encoding before fetch', async () => {
  const cases = [
    {
      path: '/solved/v4/oauth/token', source: '', headers: [] as string[],
      status: 400, error: 'request_body_required',
    },
    {
      path: '/solved/v4/oauth/token', source: '{}',
      headers: ['Content-Type', 'text/plain', 'Content-Length', '2'],
      status: 415, error: 'unsupported_media_type',
    },
    {
      path: '/solved/v4/oauth/revoke', source: '{"token":"value"}',
      headers: ['Content-Type', 'application/json'],
      status: 415, error: 'unsupported_media_type',
    },
    {
      path: '/solved/v4/oauth/token',
      source: 'grant_type=refresh_token&refresh_token=value&code=other',
      headers: ['Content-Type', 'application/x-www-form-urlencoded'],
      status: 400, error: 'invalid_request_body',
    },
    {
      path: '/solved/v4/oauth/revoke',
      source: 'token=value&unknown=private',
      headers: ['Content-Type', 'application/x-www-form-urlencoded'],
      status: 400, error: 'invalid_request_body',
    },
    {
      path: '/solved/v4/oauth/token',
      source: 'grant_type=refresh_token&refresh_token=value',
      headers: [
        'Content-Type', 'application/x-www-form-urlencoded',
        'Content-Encoding', 'identity',
      ],
      status: 415, error: 'unsupported_media_type',
    },
  ];
  for (const fixture of cases) {
    let calls = 0;
    const body = encoder.encode(fixture.source);
    const result = await handleGatewayRequest(
      {
        method: 'POST', url: fixture.path,
        ...(fixture.source.length === 0 ? {} : { body }),
        rawHeaders: fixture.headers,
      },
      {
        credentials,
        fetch: async () => { calls += 1; return jsonResponse(); },
      },
    );
    assert.equal(result.status, fixture.status);
    assert.deepEqual(JSON.parse(decoder.decode(result.body)), {
      error: fixture.error,
    });
    assertSensitive(result.headers);
    assert.equal(calls, 0);
  }

  let oversizedCalls = 0;
  const oversized = await handleGatewayRequest(
    {
      method: 'POST', url: '/solved/v4/oauth/revoke',
      body: new Uint8Array(65_537),
      rawHeaders: [
        'Content-Type', 'application/x-www-form-urlencoded',
        'Content-Length', '65537',
      ],
    },
    {
      credentials,
      fetch: async () => { oversizedCalls += 1; return jsonResponse(); },
    },
  );
  assert.equal(oversized.status, 413);
  assertSensitive(oversized.headers);
  assert.equal(oversizedCalls, 0);
});

test('uses exact-origin OAuth CORS with Content-Type-only preflight', async () => {
  const protectedCorsOrigins = ['https://app.example'];
  const allowed = await handleGatewayRequest(
    {
      method: 'OPTIONS', url: '/solved/v4/oauth/token',
      rawHeaders: [
        'Origin', 'https://app.example',
        'Access-Control-Request-Method', 'POST',
        'Access-Control-Request-Headers', 'Content-Type',
      ],
    },
    { protectedCorsOrigins },
  );
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers['access-control-allow-origin'], 'https://app.example');
  assert.equal(allowed.headers['access-control-allow-methods'], 'POST, OPTIONS');
  assert.equal(allowed.headers['access-control-allow-headers'], 'Content-Type');
  assertSensitive(allowed.headers);

  for (const rawHeaders of [
    [
      'Origin', 'https://app.example',
      'Access-Control-Request-Method', 'POST',
      'Access-Control-Request-Headers', 'Authorization, Content-Type',
    ],
    [
      'Origin', 'https://evil.example',
      'Access-Control-Request-Method', 'POST',
      'Access-Control-Request-Headers', 'Content-Type',
    ],
    [
      'Access-Control-Request-Method', 'POST',
      'Access-Control-Request-Headers', 'Content-Type',
    ],
  ]) {
    const denied = await handleGatewayRequest(
      { method: 'OPTIONS', url: '/solved/v4/oauth/token', rawHeaders },
      { protectedCorsOrigins },
    );
    assert.equal(denied.status, 403);
    assert.equal(denied.headers['access-control-allow-origin'], undefined);
    assertSensitive(denied.headers);
  }

  const wrongMethod = await handleGatewayRequest(
    {
      method: 'GET', url: '/solved/v4/oauth/token',
      rawHeaders: ['Origin', 'https://app.example'],
    },
    { protectedCorsOrigins },
  );
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.allow, 'POST, OPTIONS');
  assertSensitive(wrongMethod.headers);
});

test('requires server credentials before consuming an OAuth body', async () => {
  let calls = 0;
  const result = await handleGatewayRequest(
    { method: 'POST', url: '/solved/v4/oauth/token' },
    { fetch: async () => { calls += 1; return jsonResponse(); } },
  );
  assert.equal(result.status, 503);
  assertSensitive(result.headers);
  assert.equal(calls, 0);
});

test('OAuth upstream failures, redirects, and timeouts make one attempt', async () => {
  const body = encoder.encode('grant_type=refresh_token&refresh_token=value');
  const request = {
    method: 'POST' as const, url: '/solved/v4/oauth/token', body,
    rawHeaders: [
      'Content-Type', 'application/x-www-form-urlencoded',
      'Content-Length', String(body.byteLength),
    ],
  };
  const cases: readonly {
    readonly expected: number;
    readonly timeoutMs?: number;
    readonly fetch: typeof fetch;
  }[] = [
    {
      expected: 502,
      fetch: async () => { throw new Error('private network detail'); },
    },
    {
      expected: 502,
      fetch: async () => new Response(null, {
        status: 302, headers: { location: 'https://evil.example/' },
      }),
    },
    {
      expected: 504, timeoutMs: 1,
      fetch: async (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort', () => reject(new Error('aborted')), { once: true },
          );
        }),
    },
  ];
  for (const fixture of cases) {
    let calls = 0;
    const result = await handleGatewayRequest(request, {
      credentials,
      ...(fixture.timeoutMs === undefined ? {} : { timeoutMs: fixture.timeoutMs }),
      fetch: async (input, init) => {
        calls += 1;
        return fixture.fetch(input, init);
      },
    });
    assert.equal(result.status, fixture.expected);
    assertSensitive(result.headers);
    assert.equal(calls, 1);
  }
});

test('allows native OAuth but rejects a disallowed browser before fetch', async () => {
  const body = encoder.encode('token=value');
  let nativeCalls = 0;
  const native = await handleGatewayRequest(
    {
      method: 'POST', url: '/solved/v4/oauth/revoke', body,
      rawHeaders: [
        'Content-Type', 'application/x-www-form-urlencoded',
        'Content-Length', String(body.byteLength),
      ],
    },
    {
      credentials,
      protectedCorsOrigins: ['https://app.example'],
      fetch: async () => { nativeCalls += 1; return jsonResponse(); },
    },
  );
  assert.equal(native.status, 200);
  assert.equal(nativeCalls, 1);
  assert.equal(native.headers['access-control-allow-origin'], undefined);
  assert.equal(native.headers.vary, 'Origin');
  assertSensitive(native.headers);

  let browserCalls = 0;
  const browser = await handleGatewayRequest(
    {
      method: 'POST', url: '/solved/v4/oauth/revoke', body,
      rawHeaders: [
        'Origin', 'https://evil.example',
        'Content-Type', 'application/x-www-form-urlencoded',
        'Content-Length', String(body.byteLength),
      ],
    },
    {
      credentials,
      protectedCorsOrigins: ['https://app.example'],
      fetch: async () => { browserCalls += 1; return jsonResponse(); },
    },
  );
  assert.equal(browser.status, 403);
  assert.equal(browser.headers['access-control-allow-origin'], undefined);
  assertSensitive(browser.headers);
  assert.equal(browserCalls, 0);
});

test('maps undeclared OAuth status and media to one contract failure', async () => {
  const body = encoder.encode('token=value');
  const request = {
    method: 'POST' as const, url: '/solved/v4/oauth/revoke', body,
    rawHeaders: [
      'Content-Type', 'application/x-www-form-urlencoded',
      'Content-Length', String(body.byteLength),
    ],
  };
  for (const upstream of [
    new Response('{}', {
      status: 500, headers: { 'content-type': 'application/json' },
    }),
    new Response('private', {
      status: 200, headers: { 'content-type': 'text/plain' },
    }),
  ]) {
    let calls = 0;
    const result = await handleGatewayRequest(request, {
      credentials,
      fetch: async () => { calls += 1; return upstream; },
    });
    assert.equal(result.status, 502);
    assert.deepEqual(JSON.parse(decoder.decode(result.body)), {
      error: 'upstream_contract',
    });
    assertSensitive(result.headers);
    assert.equal(calls, 1);
  }
});

test('does not dispatch OAuth after a parent pre-abort', async () => {
  const body = encoder.encode('token=value');
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const result = await handleGatewayRequest(
    {
      method: 'POST', url: '/solved/v4/oauth/revoke', body,
      rawHeaders: [
        'Content-Type', 'application/x-www-form-urlencoded',
        'Content-Length', String(body.byteLength),
      ],
    },
    {
      credentials,
      signal: controller.signal,
      fetch: async () => { calls += 1; return jsonResponse(); },
    },
  );
  assert.equal(result.status, 502);
  assertSensitive(result.headers);
  assert.equal(calls, 0);
});
