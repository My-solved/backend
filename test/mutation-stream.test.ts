import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import test from 'node:test';

import {
  createExpectationRejectionHandler,
  createRequestHandler,
} from '../src/adapters/http/gateway-handler.js';

const credentials = Object.freeze({
  clientId: 'trusted-client-id',
  clientSecret: 'trusted-client-secret',
});

class FakeRequest extends EventEmitter {
  readonly headers: Readonly<Record<string, string>> = {};
  complete = false;
  aborted = false;
  destroyed = false;
  resumes = 0;
  pauses = 0;

  constructor(
    readonly method: string,
    readonly url: string,
    readonly rawHeaders: string[],
  ) { super(); }

  resume(): this { this.resumes += 1; return this; }
  pause(): this { this.pauses += 1; return this; }
}

class FakeResponse extends EventEmitter {
  status: number | undefined;
  headers: Readonly<Record<string, string>> | undefined;
  body: Uint8Array = new Uint8Array();
  destroyed = false;
  writableEnded = false;
  writableFinished = false;
  shouldKeepAlive = true;

  writeHead(status: number, headers: Readonly<Record<string, string>>): this {
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
}

const asRequest = (value: FakeRequest): IncomingMessage =>
  value as unknown as IncomingMessage;
const asResponse = (value: FakeResponse): ServerResponse =>
  value as unknown as ServerResponse;

function jsonStreamRequest(
  rawFraming: readonly string[] = ['Transfer-Encoding', 'chunked'],
): FakeRequest {
  return new FakeRequest('PATCH', '/solved/v4/account/settings', [
    'Authorization', 'Bearer caller-token',
    'Content-Type', 'application/json',
    ...rawFraming,
  ]);
}

async function finishBody(
  request: FakeRequest,
  response: FakeResponse,
  chunks: readonly Uint8Array[],
): Promise<void> {
  const finished = once(response, 'finish');
  for (const chunk of chunks) request.emit('data', chunk);
  request.complete = true;
  request.emit('end');
  await finished;
}

test('streams the exact cap and rejects cap plus one', async () => {
  let calls = 0;
  let forwardedBody = '';
  const handler = createRequestHandler({
    credentials,
    fetch: async (_input, init) => {
      calls += 1;
      assert.ok(init?.body instanceof Uint8Array);
      forwardedBody = new TextDecoder().decode(init.body);
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    },
  });
  const exactBody = new Uint8Array(65_536).fill(0x20);
  exactBody[0] = 0x7b;
  exactBody[1] = 0x7d;
  const exactRequest = jsonStreamRequest();
  const exactResponse = new FakeResponse();
  handler(asRequest(exactRequest), asResponse(exactResponse));
  assert.equal(exactRequest.resumes, 1);
  await finishBody(exactRequest, exactResponse, [
    exactBody.subarray(0, 32_768), exactBody.subarray(32_768),
  ]);
  assert.equal(exactResponse.status, 200);
  assert.equal(calls, 1);
  assert.equal(forwardedBody, '{}');

  const overRequest = jsonStreamRequest();
  const overResponse = new FakeResponse();
  handler(asRequest(overRequest), asResponse(overResponse));
  const finished = once(overResponse, 'finish');
  overRequest.emit('data', exactBody);
  overRequest.emit('data', Uint8Array.of(0x20));
  await finished;
  assert.equal(overResponse.status, 413);
  assert.equal(overResponse.headers?.connection, 'close');
  assert.equal(overRequest.pauses, 1);
  assert.equal(calls, 1);
});

test('prechecks oversized Content-Length without reading', () => {
  let calls = 0;
  const handler = createRequestHandler({
    credentials,
    fetch: async () => { calls += 1; return new Response(); },
  });
  const request = jsonStreamRequest(['Content-Length', '65537']);
  const response = new FakeResponse();
  handler(asRequest(request), asResponse(response));
  assert.equal(response.status, 413);
  assert.equal(response.headers?.connection, 'close');
  assert.equal(request.resumes, 0);
  assert.equal(calls, 0);
});

test('treats an empty chunked JSON body as missing', async () => {
  let calls = 0;
  const handler = createRequestHandler({
    credentials,
    fetch: async () => {
      calls += 1;
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    },
  });
  const request = jsonStreamRequest();
  const response = new FakeResponse();
  handler(asRequest(request), asResponse(response));
  await finishBody(request, response, []);
  assert.equal(response.status, 400);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(response.body)), {
    error: 'request_body_required',
  });
  assert.equal(calls, 0);
});

test('rejects auth, query, and CORS before consuming framed bodies', () => {
  let calls = 0;
  const handler = createRequestHandler({
    credentials,
    protectedCorsOrigins: ['https://app.example'],
    fetch: async () => { calls += 1; return new Response(); },
  });
  const cases = [
    new FakeRequest('PATCH', '/solved/v4/account/settings', [
      'Content-Type', 'application/json', 'Transfer-Encoding', 'chunked',
    ]),
    new FakeRequest('PATCH', '/solved/v4/account/settings?unknown=x', [
      'Authorization', 'Bearer token', 'Content-Type', 'application/json',
      'Transfer-Encoding', 'chunked',
    ]),
    new FakeRequest('PATCH', '/solved/v4/account/settings', [
      'Origin', 'https://evil.example', 'Authorization', 'Bearer token',
      'Content-Type', 'application/json', 'Transfer-Encoding', 'chunked',
    ]),
  ];
  const expected = [401, 400, 403];
  for (const [index, request] of cases.entries()) {
    const response = new FakeResponse();
    handler(asRequest(request), asResponse(response));
    assert.equal(response.status, expected[index]);
    assert.equal(response.headers?.connection, 'close');
    assert.equal(request.resumes, 0);
    assert.doesNotThrow(() => request.emit('error', new Error('reset')));
    assert.doesNotThrow(() => response.emit('error', new Error('reset')));
  }
  assert.equal(calls, 0);
});

test('rejects missing server credentials before consuming a body', () => {
  let calls = 0;
  const handler = createRequestHandler({
    fetch: async () => { calls += 1; return new Response(); },
  });
  const request = jsonStreamRequest();
  const response = new FakeResponse();
  handler(asRequest(request), asResponse(response));
  assert.equal(response.status, 503);
  assert.equal(response.headers?.connection, 'close');
  assert.equal(request.resumes, 0);
  assert.equal(calls, 0);
});

test('body reads occupy a slot and client abort releases it', async () => {
  let calls = 0;
  const handler = createRequestHandler({
    credentials,
    maxConcurrentRequests: 1,
    fetch: async () => {
      calls += 1;
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    },
  });
  const first = jsonStreamRequest();
  const firstResponse = new FakeResponse();
  handler(asRequest(first), asResponse(firstResponse));
  assert.equal(first.resumes, 1);

  const overloaded = jsonStreamRequest();
  const overloadedResponse = new FakeResponse();
  handler(asRequest(overloaded), asResponse(overloadedResponse));
  assert.equal(overloadedResponse.status, 503);
  assert.equal(overloadedResponse.headers?.connection, 'close');
  assert.equal(overloaded.resumes, 0);
  assert.equal(calls, 0);

  first.aborted = true;
  first.emit('aborted');
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(firstResponse.destroyed, true);
  assert.equal(calls, 0);

  const next = jsonStreamRequest();
  const nextResponse = new FakeResponse();
  handler(asRequest(next), asResponse(nextResponse));
  await finishBody(next, nextResponse, [new TextEncoder().encode('{}')]);
  assert.equal(nextResponse.status, 200);
  assert.equal(calls, 1);
});

test('a parent-aborted body read terminates with zero fetches', async () => {
  let calls = 0;
  const controller = new AbortController();
  controller.abort();
  const handler = createRequestHandler({
    credentials,
    signal: controller.signal,
    fetch: async () => { calls += 1; return new Response(); },
  });
  const request = jsonStreamRequest();
  const response = new FakeResponse();
  handler(asRequest(request), asResponse(response));
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(response.destroyed, true);
  assert.equal(request.resumes, 0);
  assert.equal(calls, 0);
});

test('rejects Expect without reading or fetching and handles late errors', () => {
  let calls = 0;
  const handler = createExpectationRejectionHandler({
    protectedCorsOrigins: ['https://app.example'],
    fetch: async () => { calls += 1; return new Response(); },
  });
  const request = new FakeRequest('PATCH', '/solved/v4/account/settings', [
    'Origin', 'https://app.example',
    'Authorization', 'Bearer caller-token',
    'Content-Type', 'application/json',
    'Content-Length', '2',
    'Expect', '100-continue',
  ]);
  const response = new FakeResponse();
  handler(asRequest(request), asResponse(response));
  assert.equal(response.status, 417);
  assert.equal(response.headers?.connection, 'close');
  assert.equal(response.headers?.['access-control-allow-origin'], 'https://app.example');
  assert.equal(request.resumes, 0);
  assert.equal(calls, 0);
  assert.doesNotThrow(() => request.emit('error', new Error('reset')));
  assert.doesNotThrow(() => response.emit('error', new Error('reset')));
});

test('real checkContinue returns 417 without interim 100', async (context) => {
  let calls = 0;
  const options = {
    credentials,
    fetch: async () => { calls += 1; return new Response(); },
  };
  const server = createServer();
  context.after(async () => {
    if (!server.listening) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  server.on('request', createRequestHandler(options));
  server.on('checkContinue', createExpectationRejectionHandler(options));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');

  let continued = false;
  const result = await new Promise<{ status: number; connection?: string }>(
    (resolve, reject) => {
      const request = httpRequest({
        host: '127.0.0.1', port: address.port,
        method: 'PATCH', path: '/solved/v4/account/settings',
        headers: {
          Expect: '100-continue', Authorization: 'Bearer caller-token',
          'Content-Type': 'application/json', 'Content-Length': '2',
        },
      }, (response) => {
        response.resume();
        response.once('end', () => resolve({
          status: response.statusCode ?? 0,
          ...(response.headers.connection === undefined
            ? {} : { connection: response.headers.connection }),
        }));
      });
      request.once('continue', () => { continued = true; });
      request.once('error', reject);
      request.end('{}');
    },
  );
  assert.equal(result.status, 417);
  assert.equal(result.connection, 'close');
  assert.equal(continued, false);
  assert.equal(calls, 0);
  await new Promise<void>((resolve, reject) =>
    server.close((error) => error === undefined ? resolve() : reject(error)),
  );
});
