import assert from 'node:assert/strict';
import test from 'node:test';

import { handleGatewayRequest } from '../src/adapters/http/gateway-handler.js';

const credentials = Object.freeze({
  clientId: 'trusted-client-id',
  clientSecret: 'trusted-client-secret',
});
const encoder = new TextEncoder();
const decode = (value: Uint8Array): string => new TextDecoder().decode(value);

interface MutationFixture {
  readonly method: 'POST' | 'PATCH' | 'DELETE';
  readonly gatewayPath: string;
  readonly upstreamPath: string;
  readonly body?: string;
  readonly status: number;
}

const mutationFixtures: readonly MutationFixture[] = [
  {
    method: 'DELETE',
    gatewayPath: '/solved/v4/account/bookmark-favorites/tourist/example',
    upstreamPath: '/api/v4/account/bookmark-favorites/tourist/example',
    status: 200,
  },
  {
    method: 'DELETE', gatewayPath: '/solved/v4/account/bookmarks/example',
    upstreamPath: '/api/v4/account/bookmarks/example', status: 204,
  },
  {
    method: 'PATCH', gatewayPath: '/solved/v4/account/bookmarks/example',
    upstreamPath: '/api/v4/account/bookmarks/example', body: '{}', status: 200,
  },
  {
    method: 'PATCH',
    gatewayPath: '/solved/v4/account/bookmarks/example/problems/1000',
    upstreamPath: '/api/v4/account/bookmarks/example/problems/1000',
    body: '{}', status: 200,
  },
  {
    method: 'PATCH', gatewayPath: '/solved/v4/account/settings',
    upstreamPath: '/api/v4/account/settings', body: '{}', status: 200,
  },
  {
    method: 'POST',
    gatewayPath: '/solved/v4/account/bookmark-favorites/tourist/example',
    upstreamPath: '/api/v4/account/bookmark-favorites/tourist/example',
    status: 200,
  },
  {
    method: 'POST', gatewayPath: '/solved/v4/account/bookmarks',
    upstreamPath: '/api/v4/account/bookmarks',
    body: '{"name":"Algorithms","slug":"algorithms"}', status: 201,
  },
  {
    method: 'POST', gatewayPath: '/solved/v4/account/bookmarks/order',
    upstreamPath: '/api/v4/account/bookmarks/order',
    body: '{"slugs":["algorithms"]}', status: 204,
  },
  {
    method: 'POST', gatewayPath: '/solved/v4/account/bookmarks/example/problems',
    upstreamPath: '/api/v4/account/bookmarks/example/problems',
    body: '{"problemIds":[1,1000]}', status: 200,
  },
  {
    method: 'POST',
    gatewayPath: '/solved/v4/account/bookmarks/example/problems/remove',
    upstreamPath: '/api/v4/account/bookmarks/example/problems/remove',
    body: '{"problemIds":[1,2]}', status: 200,
  },
];

function upstreamResponse(status: number): Response {
  return status === 204
    ? new Response(null, { status })
    : new Response('{}', {
        status,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'public, max-age=60',
          etag: '"private"',
        },
      });
}

for (const fixture of mutationFixtures) {
  test(`proxies exact mutation ${fixture.method} ${fixture.gatewayPath}`, async () => {
    let calls = 0;
    let observedUrl = '';
    let observedInit: RequestInit | undefined;
    const bodyBytes =
      fixture.body === undefined ? undefined : encoder.encode(fixture.body);
    const result = await handleGatewayRequest(
      {
        method: fixture.method,
        url: fixture.gatewayPath,
        body: bodyBytes,
        rawHeaders: [
          'Authorization', 'bearer caller-token',
          'Cookie', 'session=caller',
          'X-Client-Id', 'caller-client',
          'X-Client-Secret', 'caller-secret',
          ...(bodyBytes === undefined
            ? ['Content-Length', '00']
            : [
                'Content-Type', 'Application/JSON; Charset=UTF-8',
                'Content-Length', String(bodyBytes.byteLength),
              ]),
        ],
      },
      {
        credentials,
        fetch: async (input, init) => {
          calls += 1;
          observedUrl = input.toString();
          observedInit = init;
          return upstreamResponse(fixture.status);
        },
      },
    );

    assert.equal(calls, 1);
    assert.equal(result.status, fixture.status);
    assert.equal(observedUrl, `https://solved.ac${fixture.upstreamPath}`);
    assert.equal(observedInit?.method, fixture.method);
    const headers = new Headers(observedInit?.headers);
    assert.equal(headers.get('authorization'), 'Bearer caller-token');
    assert.equal(headers.get('x-client-id'), credentials.clientId);
    assert.equal(headers.get('x-client-secret'), credentials.clientSecret);
    assert.equal(headers.has('cookie'), false);
    assert.equal(headers.has('content-length'), false);
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(result.headers.etag, undefined);

    if (fixture.body === undefined) {
      assert.equal(headers.has('content-type'), false);
      assert.equal(observedInit?.body, undefined);
    } else {
      assert.equal(headers.get('content-type'), 'application/json');
      assert.ok(observedInit?.body instanceof Uint8Array);
      assert.deepEqual(
        JSON.parse(decode(observedInit.body)),
        JSON.parse(fixture.body),
      );
    }
  });
}

const invalidBodies = new Map<string, string>([
  ['/solved/v4/account/bookmarks/example', '{"unknown":true}'],
  ['/solved/v4/account/bookmarks/example/problems/1000', '{"after":0}'],
  ['/solved/v4/account/settings', '{"theme":"sepia"}'],
  ['/solved/v4/account/bookmarks', '{}'],
  ['/solved/v4/account/bookmarks/order', '{"slugs":[]}'],
  ['/solved/v4/account/bookmarks/example/problems', '{"problemIds":[]}'],
  ['/solved/v4/account/bookmarks/example/problems/remove', '{"problemIds":[0]}'],
]);

for (const fixture of mutationFixtures.filter(({ body }) => body !== undefined)) {
  test(`enforces required JSON schema for ${fixture.gatewayPath}`, async () => {
    let calls = 0;
    const missing = await handleGatewayRequest(
      {
        method: fixture.method,
        url: fixture.gatewayPath,
        rawHeaders: ['Authorization', 'Bearer caller-token'],
      },
      { credentials, fetch: async () => { calls += 1; return upstreamResponse(fixture.status); } },
    );
    assert.equal(missing.status, 400);
    assert.deepEqual(JSON.parse(decode(missing.body)), { error: 'request_body_required' });

    const invalidSource = invalidBodies.get(fixture.gatewayPath);
    assert.notEqual(invalidSource, undefined);
    const invalidBytes = encoder.encode(invalidSource ?? '');
    const invalid = await handleGatewayRequest(
      {
        method: fixture.method,
        url: fixture.gatewayPath,
        body: invalidBytes,
        rawHeaders: [
          'Authorization', 'Bearer caller-token',
          'Content-Type', 'application/json',
          'Content-Length', String(invalidBytes.byteLength),
        ],
      },
      { credentials, fetch: async () => { calls += 1; return upstreamResponse(fixture.status); } },
    );
    assert.equal(invalid.status, 400);
    assert.deepEqual(JSON.parse(decode(invalid.body)), { error: 'invalid_request_body' });
    assert.equal(calls, 0);
  });
}

for (const fixture of mutationFixtures.filter(({ body }) => body === undefined)) {
  test(`rejects body and media on bodyless ${fixture.method} ${fixture.gatewayPath}`, async () => {
    for (const request of [
      { rawHeaders: ['Content-Length', '1'], body: Uint8Array.of(0x7b) },
      { rawHeaders: ['Transfer-Encoding', 'chunked'], body: undefined },
      { rawHeaders: ['Content-Type', 'application/json'], body: undefined },
      { rawHeaders: ['Content-Encoding', 'identity'], body: undefined },
    ] as const) {
      let calls = 0;
      const result = await handleGatewayRequest(
        {
          method: fixture.method,
          url: fixture.gatewayPath,
          ...(request.body === undefined ? {} : { body: request.body }),
          rawHeaders: [
            'Authorization', 'Bearer caller-token', ...request.rawHeaders,
          ],
        },
        { credentials, fetch: async () => { calls += 1; return upstreamResponse(fixture.status); } },
      );
      assert.equal(result.status, 400);
      assert.deepEqual(JSON.parse(decode(result.body)), { error: 'request_body_not_allowed' });
      assert.equal(calls, 0);
    }
  });
}

test('enforces JSON media and encoding before parsing bytes', async () => {
  const body = encoder.encode('{}');
  for (const headers of [
    ['Content-Length', '2'],
    ['Content-Type', 'text/plain', 'Content-Length', '2'],
    ['Content-Type', 'application/json; profile=x', 'Content-Length', '2'],
    ['Content-Type', 'application/json', 'Content-Encoding', 'identity', 'Content-Length', '2'],
    ['Content-Type', 'application/json', 'content-type', 'application/json', 'Content-Length', '2'],
  ]) {
    let calls = 0;
    const result = await handleGatewayRequest(
      {
        method: 'PATCH', url: '/solved/v4/account/settings', body,
        rawHeaders: ['Authorization', 'Bearer caller-token', ...headers],
      },
      { credentials, fetch: async () => { calls += 1; return upstreamResponse(200); } },
    );
    assert.equal(result.status, 415);
    assert.deepEqual(JSON.parse(decode(result.body)), { error: 'unsupported_media_type' });
    assert.equal(calls, 0);
  }
});

test('returns generic JSON errors for malformed bytes and exact size overflow', async () => {
  let calls = 0;
  const malformed = encoder.encode('{"theme":"system"} trailing-private-data');
  const invalid = await handleGatewayRequest(
    {
      method: 'PATCH', url: '/solved/v4/account/settings', body: malformed,
      rawHeaders: [
        'Authorization', 'Bearer caller-token',
        'Content-Type', 'application/json',
        'Content-Length', String(malformed.byteLength),
      ],
    },
    { credentials, fetch: async () => { calls += 1; return upstreamResponse(200); } },
  );
  assert.equal(invalid.status, 400);
  assert.deepEqual(JSON.parse(decode(invalid.body)), { error: 'invalid_request_body' });
  assert.doesNotMatch(decode(invalid.body), /private-data/u);

  const oversized = new Uint8Array(65_537);
  const over = await handleGatewayRequest(
    {
      method: 'PATCH', url: '/solved/v4/account/settings', body: oversized,
      rawHeaders: [
        'Authorization', 'Bearer caller-token',
        'Content-Type', 'application/json',
        'Content-Length', '65537',
      ],
    },
    { credentials, fetch: async () => { calls += 1; return upstreamResponse(200); } },
  );
  assert.equal(over.status, 413);
  assert.deepEqual(JSON.parse(decode(over.body)), { error: 'payload_too_large' });
  assert.equal(calls, 0);
});

test('rejects duplicate or wrong authorization before body validation', async () => {
  for (const authorizationHeaders of [
    ['Authorization', 'Basic private'],
    ['Authorization', 'Bearer one', 'authorization', 'Bearer two'],
  ]) {
    let calls = 0;
    const result = await handleGatewayRequest(
      {
        method: 'PATCH', url: '/solved/v4/account/settings',
        rawHeaders: authorizationHeaders,
      },
      { credentials, fetch: async () => { calls += 1; return upstreamResponse(200); } },
    );
    assert.equal(result.status, 400);
    assert.deepEqual(JSON.parse(decode(result.body)), { error: 'invalid_authorization' });
    assert.equal(calls, 0);
  }
});

test('keeps the bookmarks/order literal strict before method fallback', async () => {
  for (const method of ['GET', 'PATCH', 'DELETE']) {
    const result = await handleGatewayRequest({
      method,
      url: '/solved/v4/account/bookmarks/order',
      rawHeaders: ['Authorization', 'Bearer caller-token'],
    }, { credentials });
    assert.equal(result.status, 405);
    assert.equal(result.headers.allow, 'POST, OPTIONS');
  }
});

test('uses exact mutation method and body-aware protected preflight', async () => {
  const protectedCorsOrigins = ['https://app.example'];
  const settings = await handleGatewayRequest(
    {
      method: 'OPTIONS', url: '/solved/v4/account/settings',
      rawHeaders: [
        'Origin', 'https://app.example',
        'Access-Control-Request-Method', 'PATCH',
        'Access-Control-Request-Headers', 'Authorization, Content-Type',
      ],
    },
    { protectedCorsOrigins },
  );
  assert.equal(settings.status, 204);
  assert.equal(settings.headers['access-control-allow-origin'], 'https://app.example');
  assert.equal(settings.headers['access-control-allow-methods'], 'GET, PATCH, OPTIONS');
  assert.equal(settings.headers['access-control-allow-headers'], 'Authorization, Content-Type');
  assert.equal(settings.headers['access-control-allow-credentials'], undefined);

  const favorite = await handleGatewayRequest(
    {
      method: 'OPTIONS',
      url: '/solved/v4/account/bookmark-favorites/tourist/example',
      rawHeaders: [
        'Origin', 'https://app.example',
        'Access-Control-Request-Method', 'POST',
        'Access-Control-Request-Headers', 'Authorization',
      ],
    },
    { protectedCorsOrigins },
  );
  assert.equal(favorite.status, 204);
  assert.equal(favorite.headers['access-control-allow-methods'], 'POST, DELETE, OPTIONS');
  assert.equal(favorite.headers['access-control-allow-headers'], 'Authorization');

  for (const request of [
    {
      url: '/solved/v4/account/settings',
      method: 'GET', headers: 'Authorization, Content-Type',
    },
    {
      url: '/solved/v4/account/bookmark-favorites/tourist/example',
      method: 'POST', headers: 'Authorization, Content-Type',
    },
    {
      url: '/solved/v4/account/bookmarks/order',
      method: 'PATCH', headers: 'Authorization, Content-Type',
    },
  ]) {
    const denied = await handleGatewayRequest(
      {
        method: 'OPTIONS', url: request.url,
        rawHeaders: [
          'Origin', 'https://app.example',
          'Access-Control-Request-Method', request.method,
          'Access-Control-Request-Headers', request.headers,
        ],
      },
      { protectedCorsOrigins },
    );
    assert.equal(denied.status, 403);
    assert.equal(denied.headers['access-control-allow-origin'], undefined);
  }
});

test('rejects null and duplicate protected mutation origins', async () => {
  for (const originHeaders of [
    ['Origin', 'null'],
    ['Origin', 'https://app.example', 'origin', 'https://app.example'],
  ]) {
    const result = await handleGatewayRequest(
      {
        method: 'OPTIONS', url: '/solved/v4/account/settings',
        rawHeaders: [
          ...originHeaders,
          'Access-Control-Request-Method', 'PATCH',
          'Access-Control-Request-Headers', 'Authorization, Content-Type',
        ],
      },
      { protectedCorsOrigins: ['https://app.example'] },
    );
    assert.equal(result.status, 403);
    assert.equal(result.headers['access-control-allow-origin'], undefined);
  }
});

test('never retries mutation rate limits, failures, or timeouts', async () => {
  const body = encoder.encode('{}');
  const request = {
    method: 'PATCH' as const, url: '/solved/v4/account/settings', body,
    rawHeaders: [
      'Authorization', 'Bearer caller-token',
      'Content-Type', 'application/json',
      'Content-Length', String(body.byteLength),
    ],
  };
  let rateCalls = 0;
  const limited = await handleGatewayRequest(request, {
    credentials,
    fetch: async () => {
      rateCalls += 1;
      return new Response('{}', {
        status: 429,
        headers: { 'content-type': 'application/json', 'retry-after': '30' },
      });
    },
  });
  assert.equal(limited.status, 429);
  assert.equal(rateCalls, 1);

  let failedCalls = 0;
  const failed = await handleGatewayRequest(request, {
    credentials,
    fetch: async () => { failedCalls += 1; throw new Error('private detail'); },
  });
  assert.equal(failed.status, 502);
  assert.equal(failedCalls, 1);

  let timeoutCalls = 0;
  const timedOut = await handleGatewayRequest(request, {
    credentials, timeoutMs: 1,
    fetch: (_input, init) => {
      timeoutCalls += 1;
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort', () => reject(new Error('abort')), { once: true },
        );
      });
    },
  });
  assert.equal(timedOut.status, 504);
  assert.equal(timeoutCalls, 1);
});

for (const fixture of mutationFixtures) {
  test(`requires one Bearer before ${fixture.method} ${fixture.gatewayPath}`, async () => {
    let calls = 0;
    const result = await handleGatewayRequest(
      {
        method: fixture.method,
        url: fixture.gatewayPath,
        rawHeaders: fixture.body === undefined
          ? ['Cookie', 'session=not-auth']
          : ['Content-Type', 'application/json', 'Cookie', 'session=not-auth'],
        ...(fixture.body === undefined ? {} : { body: encoder.encode(fixture.body) }),
      },
      {
        credentials,
        fetch: async () => {
          calls += 1;
          return upstreamResponse(fixture.status);
        },
      },
    );
    assert.equal(result.status, 401);
    assert.equal(result.headers['www-authenticate'], 'Bearer');
    assert.equal(calls, 0);
  });
}
