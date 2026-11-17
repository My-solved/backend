import assert from 'node:assert/strict';
import { ReadableStream } from 'node:stream/web';
import test from 'node:test';

import { proxyRequest, UpstreamError } from '../src/proxy-handler.js';

const upstreamUrl = new URL('https://solved.ac/api/v3/site/stats');
const v4UpstreamUrl = new URL('https://solved.ac/api/v4/users/tourist');

test('uses a fixed GET request without forwarding caller credentials', async () => {
  let capturedInput: URL | Request | string | undefined;
  let capturedInit: RequestInit | undefined;
  const fetchMock: typeof fetch = async (input, init) => {
    capturedInput = input;
    capturedInit = init;
    return new Response('{"ok":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  await proxyRequest(upstreamUrl, { fetch: fetchMock });

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
    return new Response('{}');
  };

  await proxyRequest(v4UpstreamUrl, {
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

test('preserves upstream status, bytes, and only safe response headers', async () => {
  const body = new Uint8Array([0, 1, 127, 128, 255]);
  const fetchMock: typeof fetch = async () =>
    new Response(body, {
      status: 429,
      headers: {
        'content-type': 'application/octet-stream',
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

  const actual = await proxyRequest(upstreamUrl, { fetch: fetchMock });

  assert.equal(actual.status, 429);
  assert.deepEqual(actual.body, body);
  assert.deepEqual(actual.headers, {
    'content-type': 'application/octet-stream',
    'retry-after': '30',
    'cache-control': 'public, max-age=10',
    etag: '"abc"',
    'x-ratelimit-limit': '300',
    'x-ratelimit-remaining': '299',
  });
});

for (const status of [400, 404, 500]) {
  test(`preserves an upstream ${status} response`, async () => {
    const fetchMock: typeof fetch = async () =>
      new Response(`{"status":${status}}`, {
        status,
        headers: { 'content-type': 'application/json' },
      });
    const actual = await proxyRequest(upstreamUrl, { fetch: fetchMock });
    assert.equal(actual.status, status);
    assert.equal(
      new TextDecoder().decode(actual.body),
      `{"status":${status}}`,
    );
  });
}

test('maps a network failure to 502', async () => {
  const fetchMock: typeof fetch = async () => {
    throw new TypeError('network failed');
  };
  await assert.rejects(
    proxyRequest(upstreamUrl, { fetch: fetchMock }),
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
    proxyRequest(upstreamUrl, { fetch: fetchMock, timeoutMs: 1 }),
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
    );

  await assert.rejects(
    proxyRequest(upstreamUrl, { fetch: fetchMock, timeoutMs: 1 }),
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
    );

  await assert.rejects(
    proxyRequest(upstreamUrl, { fetch: fetchMock }),
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
    proxyRequest(upstreamUrl, { fetch: fetchMock }),
    (error: unknown) =>
      error instanceof UpstreamError &&
      error.status === 502 &&
      error.code === 'upstream_redirect',
  );
});

test('rejects a declared response larger than the limit', async () => {
  const fetchMock: typeof fetch = async () =>
    new Response('small', {
      headers: { 'content-length': '100' },
    });
  await assert.rejects(
    proxyRequest(upstreamUrl, { fetch: fetchMock, maxResponseBytes: 10 }),
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
    );
  await assert.rejects(
    proxyRequest(upstreamUrl, { fetch: fetchMock, maxResponseBytes: 5 }),
    (error: unknown) =>
      error instanceof UpstreamError &&
      error.code === 'upstream_response_too_large',
  );
});
