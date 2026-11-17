import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import test from 'node:test';

import { createRequestHandler, handleGatewayRequest } from '../src/app.js';

const text = (body: Uint8Array): string => new TextDecoder().decode(body);
const credentials = Object.freeze({
  clientId: 'trusted-client-id',
  clientSecret: 'trusted-client-secret',
});
const jsonUpstreamResponse = (
  body = '{}',
  init: Omit<ResponseInit, 'headers'> & {
    readonly headers?: Readonly<Record<string, string>>;
  } = {},
): Response =>
  new Response(body, {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  });

class FakeServerResponse extends EventEmitter {
  status: number | undefined;
  headers: Readonly<Record<string, string>> | undefined;
  body: Uint8Array = new Uint8Array();
  destroyed = false;
  writableEnded = false;
  writableFinished = false;

  writeHead(
    status: number,
    headers: Readonly<Record<string, string>>,
  ): this {
    this.status = status;
    this.headers = headers;
    return this;
  }

  end(body: Uint8Array): this {
    this.body = body;
    this.writableEnded = true;
    this.writableFinished = true;
    this.emit('finish');
    return this;
  }

  destroy(): this {
    this.destroyed = true;
    this.emit('close');
    return this;
  }

  disconnect(): void {
    this.destroyed = true;
    this.emit('close');
  }
}

function incomingRequest(
  url: string,
  headers: Readonly<Record<string, string>> = {},
): IncomingMessage {
  const rawHeaders = Object.entries(headers).flatMap(([name, value]) => [
    name,
    value,
  ]);
  return Object.assign(new EventEmitter(), {
    method: 'GET',
    url,
    headers,
    rawHeaders,
    resume() {},
  }) as unknown as IncomingMessage;
}

const asServerResponse = (response: FakeServerResponse): ServerResponse =>
  response as unknown as ServerResponse;

test('health endpoint never calls upstream', async () => {
  let calls = 0;
  const fetchMock: typeof fetch = async () => {
    calls += 1;
    throw new Error('must not run');
  };

  const health = await handleGatewayRequest(
    { method: 'GET', url: '/healthz' },
    { fetch: fetchMock },
  );
  assert.equal(health.status, 200);
  assert.deepEqual(JSON.parse(text(health.body)), { status: 'ok' });
  assert.equal(health.headers['cache-control'], 'no-store');
  assert.equal(calls, 0);
});

test('official v4 health remains a credentialed upstream operation', async () => {
  let observedUrl = '';
  const result = await handleGatewayRequest(
    { method: 'GET', url: '/solved/v4/health' },
    {
      credentials,
      fetch: async (input) => {
        observedUrl = input.toString();
        return jsonUpstreamResponse('{"status":"ok"}');
      },
    },
  );
  assert.equal(result.status, 200);
  assert.equal(observedUrl, 'https://solved.ac/api/v4/health');
});

test('does not expose an unrelated compatibility health route', async () => {
  const result = await handleGatewayRequest({ method: 'GET', url: '/api' });

  assert.equal(result.status, 404);
  assert.deepEqual(JSON.parse(text(result.body)), { error: 'not_found' });
});

test('returns public CORS preflight without calling upstream', async () => {
  let calls = 0;
  const result = await handleGatewayRequest(
    { method: 'OPTIONS', url: '/solved/v4/tags' },
    {
      fetch: async () => {
        calls += 1;
        return jsonUpstreamResponse();
      },
    },
  );
  assert.equal(result.status, 204);
  assert.equal(result.headers['access-control-allow-origin'], '*');
  assert.equal(result.headers['access-control-allow-methods'], 'GET, OPTIONS');
  assert.equal(result.headers.allow, 'GET, OPTIONS');
  assert.equal(calls, 0);
});

for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'HEAD']) {
  test(`rejects ${method}`, async () => {
    const result = await handleGatewayRequest({
      method,
      url: '/solved/v4/tags',
    });
    assert.equal(result.status, 405);
    assert.equal(result.headers.allow, 'GET, OPTIONS');
  });
}

test('rejects an unknown path before calling upstream', async () => {
  let calls = 0;
  const result = await handleGatewayRequest(
    { method: 'GET', url: '/solved/anything' },
    {
      fetch: async () => {
        calls += 1;
        return jsonUpstreamResponse();
      },
    },
  );
  assert.equal(result.status, 404);
  assert.equal(calls, 0);
});

const removedV3Targets = [
  '/solved/user/show?handle=tourist',
  '/solved/user/grass?handle=tourist',
  '/solved/user/problem_stats?handle=tourist',
  '/solved/user/tag_ratings?handle=tourist',
  '/solved/background/show?backgroundId=balloon',
  '/solved/badge/show?badgeId=bronze',
  '/solved/search/problem?query=rsa',
  '/solved/search/user?query=rsa',
  '/solved/search/tag?query=rsa',
  '/solved/user/organizations?handle=tourist',
  '/solved/user/available_badges?handle=tourist',
  '/solved/user/top_100?handle=tourist',
  '/solved/search/suggestion?query=rsa',
  '/solved/arena/contests',
  '/solved/site/stats',
] as const;

for (const url of removedV3Targets) {
  test(`rejects removed v3 route before calling upstream: ${url}`, async () => {
    let calls = 0;
    const result = await handleGatewayRequest(
      { method: 'GET', url },
      {
        fetch: async () => {
          calls += 1;
          return jsonUpstreamResponse();
        },
      },
    );

    assert.equal(result.status, 404);
    assert.deepEqual(JSON.parse(text(result.body)), { error: 'not_found' });
    assert.equal(calls, 0);
  });
}

const invalidTargets = [
  'https://evil.invalid/solved/v4/tags',
  '//evil.invalid/solved/v4/tags',
  '/solved/v4/tags#fragment',
  '/solved/../v4/tags',
  '/solved/%2e%2e/v4/tags',
  '/solved/v4/foo/../tags',
  '/solved/v4/foo/%2e%2e/tags',
  '/solved/v4/%2Ftags',
  '/solved/v4/%5ctags',
  '/solved/v4/ta\tgs',
  '/solved/v4/tags\0',
  '/solved/v4/tags ',
  `/solved/v4/tags?padding=${'a'.repeat(8_192)}`,
] as const;

for (const url of invalidTargets) {
  test(`rejects invalid request-target: ${url.slice(0, 60)}`, async () => {
    const result = await handleGatewayRequest({ method: 'GET', url });
    assert.equal(result.status, 400);
  });
}

for (const url of ['/solved/v4/unknown/tags']) {
  test(`does not route traversal-like target: ${url}`, async () => {
    const result = await handleGatewayRequest({ method: 'GET', url });
    assert.equal(result.status, 404);
  });
}

test('maps contract, network, and timeout errors without leaking details', async () => {
  const invalid = await handleGatewayRequest({
    method: 'GET',
    url: '/solved/v4/users/tourist/activity/days',
  });
  assert.equal(invalid.status, 400);
  assert.deepEqual(JSON.parse(text(invalid.body)), { error: 'invalid_query' });
  assert.equal(invalid.headers['cache-control'], 'no-store');

  const failed = await handleGatewayRequest(
    { method: 'GET', url: '/solved/v4/users/tourist' },
    {
      credentials,
      fetch: async () => {
        throw new Error('private upstream detail');
      },
    },
  );
  assert.equal(failed.status, 502);
  assert.deepEqual(JSON.parse(text(failed.body)), {
    error: 'upstream_unavailable',
  });

  const timedOut = await handleGatewayRequest(
    { method: 'GET', url: '/solved/v4/users/tourist' },
    {
      credentials,
      timeoutMs: 1,
      fetch: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new Error('aborted')),
            { once: true },
          );
        }),
    },
  );
  assert.equal(timedOut.status, 504);
  assert.deepEqual(JSON.parse(text(timedOut.body)), {
    error: 'upstream_timeout',
  });
});

test('forwards a valid request with only server-owned credentials', async () => {
  let observedUrl = '';
  let observedHeaders: RequestInit['headers'] | undefined;
  const result = await handleGatewayRequest(
    {
      method: 'GET',
      url: '/solved/v4/users/tourist',
    },
    {
      credentials,
      fetch: async (input, init) => {
        observedUrl = input.toString();
        observedHeaders = init?.headers;
        return new Response('{"handle":"tourist"}', {
          headers: { 'content-type': 'application/json' },
        });
      },
    },
  );
  assert.equal(result.status, 200);
  assert.equal(
    observedUrl,
    'https://solved.ac/api/v4/users/tourist',
  );
  assert.deepEqual(observedHeaders, {
    accept: 'application/json',
    'x-client-id': 'trusted-client-id',
    'x-client-secret': 'trusted-client-secret',
  });
  assert.equal(text(result.body), '{"handle":"tourist"}');
});

test('requires server credentials before making a v4 request', async () => {
  let calls = 0;
  const result = await handleGatewayRequest(
    { method: 'GET', url: '/solved/v4/users/tourist' },
    {
      fetch: async () => {
        calls += 1;
        return jsonUpstreamResponse();
      },
    },
  );

  assert.equal(result.status, 503);
  assert.deepEqual(JSON.parse(text(result.body)), {
    error: 'service_unavailable',
  });
  assert.equal(calls, 0);
});

test('uses only server credentials for v4 even when the caller sends headers', async () => {
  let observedHeaders: RequestInit['headers'] | undefined;
  const handler = createRequestHandler({
    credentials: {
      clientId: 'trusted-client-id',
      clientSecret: 'trusted-client-secret',
    },
    fetch: async (_input, init) => {
      observedHeaders = init?.headers;
      return jsonUpstreamResponse();
    },
  });
  const response = new FakeServerResponse();
  const finished = once(response, 'finish');
  handler(
    incomingRequest('/solved/v4/users/tourist', {
      authorization: 'Bearer caller-token',
      cookie: 'session=caller-cookie',
      'x-client-id': 'caller-client-id',
      'x-client-secret': 'caller-client-secret',
    }),
    asServerResponse(response),
  );
  await finished;

  assert.equal(response.status, 200);
  assert.deepEqual(observedHeaders, {
    accept: 'application/json',
    'x-client-id': 'trusted-client-id',
    'x-client-secret': 'trusted-client-secret',
  });
});

const userGetTargets = [
  '/solved/v4/account/backgrounds',
  '/solved/v4/account/bans',
  '/solved/v4/account/bookmark-favorites',
  '/solved/v4/account/bookmarks',
  '/solved/v4/account/collection',
  '/solved/v4/account/consents',
  '/solved/v4/account/items',
  '/solved/v4/account/profile',
  '/solved/v4/account/settings',
  '/solved/v4/account/standing',
  '/solved/v4/account/wallet',
  '/solved/v4/account/wallet/history',
  '/solved/v4/me',
  '/solved/v4/me/emoticons',
  '/solved/v4/me/tag-progress',
  '/solved/v4/problems/1000/votes/me',
  '/solved/v4/rankings/reverse-rivals',
  '/solved/v4/rankings/rivals',
] as const;

for (const url of userGetTargets) {
  test(`requires a Bearer value before every user GET: ${url}`, async () => {
    let calls = 0;
    const result = await handleGatewayRequest(
      { method: 'GET', url },
      {
        credentials,
        fetch: async () => {
          calls += 1;
          return jsonUpstreamResponse();
        },
      },
    );
    assert.equal(result.status, 401);
    assert.deepEqual(JSON.parse(text(result.body)), { error: 'unauthorized' });
    assert.equal(result.headers['www-authenticate'], 'Bearer');
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(result.headers['access-control-allow-origin'], undefined);
    assert.equal(result.headers.vary, 'Origin');
    assert.equal(calls, 0);
  });
}

test('forwards one validated user Bearer value and keeps the response private', async () => {
  let observedHeaders: RequestInit['headers'] | undefined;
  const result = await handleGatewayRequest(
    {
      method: 'GET',
      url: '/solved/v4/account/settings',
      rawHeaders: ['Authorization', 'bearer opaque.token-_~+/='],
    },
    {
      credentials,
      fetch: async (_input, init) => {
        observedHeaders = init?.headers;
        return jsonUpstreamResponse('{}', {
          headers: {
            'cache-control': 'public, max-age=3600',
            etag: '"private"',
          },
        });
      },
    },
  );
  assert.equal(result.status, 200);
  assert.deepEqual(observedHeaders, {
    accept: 'application/json',
    'x-client-id': 'trusted-client-id',
    'x-client-secret': 'trusted-client-secret',
    authorization: 'Bearer opaque.token-_~+/=',
  });
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.equal(result.headers.etag, undefined);
});

for (const rawHeaders of [
  ['Authorization', 'Basic caller'],
  ['Authorization', 'Bearer first', 'authorization', 'Bearer second'],
] as const) {
  test('rejects malformed or duplicate authorization without upstream fallback', async () => {
    let calls = 0;
    const result = await handleGatewayRequest(
      {
        method: 'GET',
        url: '/solved/v4/account/settings',
        rawHeaders,
      },
      {
        credentials,
        fetch: async () => {
          calls += 1;
          return jsonUpstreamResponse();
        },
      },
    );
    assert.equal(result.status, 400);
    assert.deepEqual(JSON.parse(text(result.body)), {
      error: 'invalid_authorization',
    });
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(calls, 0);
  });
}

test('never downgrades malformed scoped-public authorization to anonymous', async () => {
  let calls = 0;
  const result = await handleGatewayRequest(
    {
      method: 'GET',
      url: '/solved/v4/users/tourist/bookmarks',
      rawHeaders: ['Authorization', 'Basic caller'],
    },
    {
      credentials,
      fetch: async () => {
        calls += 1;
        return jsonUpstreamResponse();
      },
    },
  );
  assert.equal(result.status, 400);
  assert.deepEqual(JSON.parse(text(result.body)), {
    error: 'invalid_authorization',
  });
  assert.equal(calls, 0);
});

const scopedPublicTargets = [
  '/solved/v4/problems/1000',
  '/solved/v4/users/tourist/bookmarks',
  '/solved/v4/users/tourist/bookmarks/example',
  '/solved/v4/users/tourist/contributions',
] as const;

for (const url of scopedPublicTargets) {
  test(`keeps scoped-public GET anonymous but never cacheable: ${url}`, async () => {
    let observedHeaders: RequestInit['headers'] | undefined;
    const result = await handleGatewayRequest(
      { method: 'GET', url },
      {
        credentials,
        fetch: async (_input, init) => {
          observedHeaders = init?.headers;
          return jsonUpstreamResponse('{}', {
            headers: {
              'cache-control': 'public, max-age=3600',
              etag: '"anonymous-private-surface"',
            },
          });
        },
      },
    );
    assert.equal(result.status, 200);
    assert.equal(new Headers(observedHeaders).has('authorization'), false);
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(result.headers.etag, undefined);
    assert.equal(result.headers['access-control-allow-origin'], undefined);
    assert.equal(result.headers.vary, 'Origin');
  });
}

test('forwards an optional scoped-public Bearer without introspecting scopes', async () => {
  let observedHeaders: RequestInit['headers'] | undefined;
  const result = await handleGatewayRequest(
    {
      method: 'GET',
      url: '/solved/v4/users/tourist/bookmarks',
      rawHeaders: ['Authorization', 'Bearer opaque-with-unknown-scope'],
    },
    {
      credentials,
      fetch: async (_input, init) => {
        observedHeaders = init?.headers;
        return jsonUpstreamResponse();
      },
    },
  );
  assert.equal(result.status, 200);
  assert.equal(
    new Headers(observedHeaders).get('authorization'),
    'Bearer opaque-with-unknown-scope',
  );
});

for (const url of scopedPublicTargets) {
  for (const status of [401, 403]) {
    test(`rejects undeclared scoped-public upstream ${status}: ${url}`, async () => {
      const result = await handleGatewayRequest(
        {
          method: 'GET',
          url,
          rawHeaders: ['Authorization', 'Bearer opaque-token'],
        },
        {
          credentials,
          fetch: async () => jsonUpstreamResponse('{}', { status }),
        },
      );
      assert.equal(result.status, 502);
      assert.deepEqual(JSON.parse(text(result.body)), {
        error: 'upstream_contract',
      });
      assert.equal(result.headers['cache-control'], 'no-store');
    });
  }
}

for (const status of [401, 403]) {
  test(`preserves declared user upstream ${status} without cache validators`, async () => {
    const result = await handleGatewayRequest(
      {
        method: 'GET',
        url: '/solved/v4/account/settings',
        rawHeaders: ['Authorization', 'Bearer opaque-token'],
      },
      {
        credentials,
        fetch: async () =>
          jsonUpstreamResponse('{}', {
            status,
            headers: {
              'cache-control': 'private, max-age=60',
              etag: '"user-error"',
            },
          }),
      },
    );
    assert.equal(result.status, status);
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(result.headers.etag, undefined);
  });
}

test('resolves the operation and query before parsing authorization', async () => {
  const result = await handleGatewayRequest({
    method: 'GET',
    url: '/solved/v4/account/settings?unknown=value',
    rawHeaders: ['Authorization', 'Basic malformed'],
  });
  assert.equal(result.status, 400);
  assert.deepEqual(JSON.parse(text(result.body)), { error: 'invalid_query' });
});

test('applies exact protected CORS and authorizes only its GET preflight', async () => {
  let calls = 0;
  const protectedCorsOrigins = ['https://app.example'];
  const disallowed = await handleGatewayRequest(
    {
      method: 'GET',
      url: '/solved/v4/account/settings',
      rawHeaders: [
        'Origin',
        'https://evil.example',
        'Authorization',
        'Bearer token',
      ],
    },
    {
      credentials,
      protectedCorsOrigins,
      fetch: async () => {
        calls += 1;
        return jsonUpstreamResponse();
      },
    },
  );
  assert.equal(disallowed.status, 403);
  assert.equal(disallowed.headers['access-control-allow-origin'], undefined);

  const preflight = await handleGatewayRequest(
    {
      method: 'OPTIONS',
      url: '/solved/v4/account/settings',
      rawHeaders: [
        'Origin',
        'https://app.example',
        'Access-Control-Request-Method',
        'GET',
        'Access-Control-Request-Headers',
        'Authorization',
      ],
    },
    { protectedCorsOrigins },
  );
  assert.equal(preflight.status, 204);
  assert.equal(
    preflight.headers['access-control-allow-origin'],
    'https://app.example',
  );
  assert.equal(
    preflight.headers['access-control-allow-headers'],
    'Authorization',
  );
  assert.equal(preflight.headers['access-control-allow-credentials'], undefined);
  assert.equal(calls, 0);
});

test('closes a denied protected CORS request that carries a body', () => {
  let calls = 0;
  const handler = createRequestHandler({
    credentials,
    protectedCorsOrigins: ['https://app.example'],
    fetch: async () => {
      calls += 1;
      return jsonUpstreamResponse();
    },
  });
  const response = new FakeServerResponse();
  handler(
    incomingRequest('/solved/v4/account/settings', {
      origin: 'https://evil.example',
      authorization: 'Bearer opaque-token',
      'transfer-encoding': 'chunked',
    }),
    asServerResponse(response),
  );

  assert.equal(response.status, 403);
  assert.equal(response.headers?.connection, 'close');
  assert.equal(response.headers?.vary, 'Origin');
  assert.equal(response.headers?.['access-control-allow-origin'], undefined);
  assert.equal(calls, 0);
});

test('maps undeclared upstream status to a generic contract error', async () => {
  const result = await handleGatewayRequest(
    { method: 'GET', url: '/solved/v4/users/tourist' },
    {
      credentials,
      fetch: async () =>
        new Response('{"private":"detail"}', {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }),
    },
  );
  assert.equal(result.status, 502);
  assert.deepEqual(JSON.parse(text(result.body)), {
    error: 'upstream_contract',
  });
  assert.doesNotMatch(text(result.body), /private/u);
});

test('rejects request bodies before calling upstream', () => {
  let calls = 0;
  const handler = createRequestHandler({
    credentials,
    fetch: async () => {
      calls += 1;
      return jsonUpstreamResponse();
    },
  });
  const response = new FakeServerResponse();
  const request = incomingRequest('/solved/v4/users/tourist', {
    'content-length': '1',
  });

  handler(request, asServerResponse(response));

  assert.equal(response.status, 400);
  assert.deepEqual(JSON.parse(text(response.body)), {
    error: 'request_body_not_allowed',
  });
  assert.equal(response.headers?.connection, 'close');
  assert.equal(calls, 0);
  assert.doesNotThrow(() => request.emit('error', new Error('reset')));
  assert.doesNotThrow(() => response.emit('error', new Error('reset')));
});

test('caps concurrent proxy requests while health remains available', async () => {
  const pending: Array<(response: Response) => void> = [];
  const handler = createRequestHandler({
    credentials,
    maxConcurrentRequests: 1,
    fetch: () =>
      new Promise<Response>((resolve) => {
        pending.push(resolve);
      }),
  });

  const first = new FakeServerResponse();
  handler(
    incomingRequest('/solved/v4/users/first'),
    asServerResponse(first),
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(pending.length, 1);

  const overloaded = new FakeServerResponse();
  handler(
    incomingRequest('/solved/v4/users/second'),
    asServerResponse(overloaded),
  );
  assert.equal(overloaded.status, 503);
  assert.equal(overloaded.headers?.['retry-after'], '1');

  const health = new FakeServerResponse();
  handler(incomingRequest('/healthz'), asServerResponse(health));
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(health.status, 200);

  const firstFinished = once(first, 'finish');
  pending[0]?.(jsonUpstreamResponse());
  await firstFinished;

  const next = new FakeServerResponse();
  handler(
    incomingRequest('/solved/v4/users/second'),
    asServerResponse(next),
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(pending.length, 2);
  const nextFinished = once(next, 'finish');
  pending[1]?.(jsonUpstreamResponse());
  await nextFinished;
});

test('aborts upstream work when the client disconnects', async () => {
  const signals: AbortSignal[] = [];
  const handler = createRequestHandler({
    credentials,
    fetch: (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        assert.ok(signal);
        signals.push(signal);
        signal.addEventListener(
          'abort',
          () => reject(new Error('aborted')),
          { once: true },
        );
      }),
  });
  const response = new FakeServerResponse();

  handler(
    incomingRequest('/solved/v4/users/tourist'),
    asServerResponse(response),
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(signals.length, 1);

  response.disconnect();
  assert.equal(signals[0]?.aborted, true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(response.status, undefined);
});
