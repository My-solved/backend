import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import test from 'node:test';

import { createRequestHandler, handleGatewayRequest } from '../src/app.js';

const text = (body: Uint8Array): string => new TextDecoder().decode(body);

class FakeServerResponse extends EventEmitter {
  status: number | undefined;
  headers: Readonly<Record<string, string>> | undefined;
  body = new Uint8Array();
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
  return Object.assign(new EventEmitter(), {
    method: 'GET',
    url,
    headers,
    resume() {},
  }) as unknown as IncomingMessage;
}

const asServerResponse = (response: FakeServerResponse): ServerResponse =>
  response as unknown as ServerResponse;

test('health endpoints never call upstream', async () => {
  let calls = 0;
  const fetchMock: typeof fetch = async () => {
    calls += 1;
    throw new Error('must not run');
  };

  const health = await handleGatewayRequest(
    { method: 'GET', url: '/healthz' },
    { fetch: fetchMock },
  );
  const compatibility = await handleGatewayRequest(
    { method: 'GET', url: '/api' },
    { fetch: fetchMock },
  );

  assert.equal(health.status, 200);
  assert.deepEqual(JSON.parse(text(health.body)), { status: 'ok' });
  assert.equal(health.headers['cache-control'], 'no-store');
  assert.equal(compatibility.status, 200);
  assert.deepEqual(JSON.parse(text(compatibility.body)), {
    service: 'solved-proxy',
    status: 'ok',
  });
  assert.equal(calls, 0);
});

test('returns public CORS preflight without calling upstream', async () => {
  let calls = 0;
  const result = await handleGatewayRequest(
    { method: 'OPTIONS', url: '/solved/site/stats' },
    {
      fetch: async () => {
        calls += 1;
        return new Response('{}');
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
      url: '/solved/site/stats',
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
        return new Response('{}');
      },
    },
  );
  assert.equal(result.status, 404);
  assert.equal(calls, 0);
});

const invalidTargets = [
  'https://evil.invalid/solved/site/stats',
  '//evil.invalid/solved/site/stats',
  '/solved/site/stats#fragment',
  '/solved/../site/stats',
  '/solved/%2e%2e/site/stats',
  '/solved/foo/../site/stats',
  '/solved/foo/%2e%2e/site/stats',
  '/solved/%2Fsite/stats',
  '/solved/%5csite/stats',
  '/solved/si\tte/stats',
  '/solved/site/stats\0',
  '/solved/site/stats ',
  `/solved/site/stats?padding=${'a'.repeat(8_192)}`,
] as const;

for (const url of invalidTargets) {
  test(`rejects invalid request-target: ${url.slice(0, 60)}`, async () => {
    const result = await handleGatewayRequest({ method: 'GET', url });
    assert.equal(result.status, 400);
  });
}

for (const url of ['/solved/unknown/site/stats']) {
  test(`does not route traversal-like target: ${url}`, async () => {
    const result = await handleGatewayRequest({ method: 'GET', url });
    assert.equal(result.status, 404);
  });
}

test('maps contract, network, and timeout errors without leaking details', async () => {
  const invalid = await handleGatewayRequest({
    method: 'GET',
    url: '/solved/user/show',
  });
  assert.equal(invalid.status, 400);
  assert.deepEqual(JSON.parse(text(invalid.body)), { error: 'invalid_query' });
  assert.equal(invalid.headers['cache-control'], 'no-store');

  const failed = await handleGatewayRequest(
    { method: 'GET', url: '/solved/site/stats' },
    {
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
    { method: 'GET', url: '/solved/site/stats' },
    {
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

test('forwards a valid request without any caller header input', async () => {
  let observedUrl = '';
  let observedHeaders: RequestInit['headers'] | undefined;
  const result = await handleGatewayRequest(
    {
      method: 'GET',
      url: '/solved/user/show?handle=tourist',
    },
    {
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
    'https://solved.ac/api/v3/user/show?handle=tourist',
  );
  assert.deepEqual(observedHeaders, { accept: 'application/json' });
  assert.equal(text(result.body), '{"handle":"tourist"}');
});

test('rejects request bodies before calling upstream', () => {
  let calls = 0;
  const handler = createRequestHandler({
    fetch: async () => {
      calls += 1;
      return new Response('{}');
    },
  });
  const response = new FakeServerResponse();
  const request = incomingRequest('/solved/site/stats', {
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
    maxConcurrentRequests: 1,
    fetch: () =>
      new Promise<Response>((resolve) => {
        pending.push(resolve);
      }),
  });

  const first = new FakeServerResponse();
  handler(
    incomingRequest('/solved/site/stats'),
    asServerResponse(first),
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(pending.length, 1);

  const overloaded = new FakeServerResponse();
  handler(
    incomingRequest('/solved/arena/contests'),
    asServerResponse(overloaded),
  );
  assert.equal(overloaded.status, 503);
  assert.equal(overloaded.headers?.['retry-after'], '1');

  const health = new FakeServerResponse();
  handler(incomingRequest('/healthz'), asServerResponse(health));
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(health.status, 200);

  const firstFinished = once(first, 'finish');
  pending[0]?.(new Response('{}'));
  await firstFinished;

  const next = new FakeServerResponse();
  handler(
    incomingRequest('/solved/arena/contests'),
    asServerResponse(next),
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(pending.length, 2);
  const nextFinished = once(next, 'finish');
  pending[1]?.(new Response('{}'));
  await nextFinished;
});

test('aborts upstream work when the client disconnects', async () => {
  const signals: AbortSignal[] = [];
  const handler = createRequestHandler({
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
    incomingRequest('/solved/site/stats'),
    asServerResponse(response),
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(signals.length, 1);

  response.disconnect();
  assert.equal(signals[0]?.aborted, true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(response.status, undefined);
});
