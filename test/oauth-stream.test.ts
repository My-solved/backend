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
const encoder = new TextEncoder();
const decoder = new TextDecoder();

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

function formStreamRequest(
  path = '/solved/v4/oauth/revoke',
  extraHeaders: readonly string[] = [],
): FakeRequest {
  return new FakeRequest('POST', path, [
    'Content-Type', 'application/x-www-form-urlencoded',
    'Transfer-Encoding', 'chunked',
    ...extraHeaders,
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

function assertSensitive(response: FakeResponse): void {
  assert.equal(response.headers?.['cache-control'], 'no-store');
  assert.equal(response.headers?.pragma, 'no-cache');
  assert.equal(response.headers?.etag, undefined);
}

test('streams exactly 64 KiB OAuth form and rejects the next byte', async () => {
  let calls = 0;
  let forwardedLength = 0;
  const handler = createRequestHandler({
    credentials,
    fetch: async (_input, init) => {
      calls += 1;
      assert.ok(init?.body instanceof Uint8Array);
      forwardedLength = init.body.byteLength;
      return new Response('{}', {
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  const exactBody = encoder.encode(`token=${'a'.repeat(65_530)}`);
  assert.equal(exactBody.byteLength, 65_536);
  const exactRequest = formStreamRequest();
  const exactResponse = new FakeResponse();
  handler(asRequest(exactRequest), asResponse(exactResponse));
  assert.equal(exactRequest.resumes, 1);
  await finishBody(exactRequest, exactResponse, [
    exactBody.subarray(0, 32_768),
    exactBody.subarray(32_768),
  ]);
  assert.equal(exactResponse.status, 200);
  assert.equal(calls, 1);
  assert.equal(forwardedLength, 65_536);
  assertSensitive(exactResponse);

  const overRequest = formStreamRequest();
  const overResponse = new FakeResponse();
  handler(asRequest(overRequest), asResponse(overResponse));
  const finished = once(overResponse, 'finish');
  overRequest.emit('data', exactBody);
  overRequest.emit('data', Uint8Array.of(0x61));
  await finished;
  assert.equal(overResponse.status, 413);
  assert.equal(overResponse.headers?.connection, 'close');
  assert.equal(overRequest.pauses, 1);
  assertSensitive(overResponse);
  assert.equal(calls, 1);
});

test('empty chunked OAuth is missing and every local failure is non-cacheable', async () => {
  let calls = 0;
  const handler = createRequestHandler({
    credentials,
    fetch: async () => { calls += 1; return new Response(); },
  });
  const request = formStreamRequest();
  const response = new FakeResponse();
  handler(asRequest(request), asResponse(response));
  await finishBody(request, response, []);
  assert.equal(response.status, 400);
  assert.deepEqual(JSON.parse(decoder.decode(response.body)), {
    error: 'request_body_required',
  });
  assertSensitive(response);
  assert.equal(calls, 0);
});

test('OAuth body reads occupy a slot and abort releases it', async () => {
  let calls = 0;
  const handler = createRequestHandler({
    credentials,
    maxConcurrentRequests: 1,
    fetch: async () => {
      calls += 1;
      return new Response('{}', {
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  const first = formStreamRequest();
  const firstResponse = new FakeResponse();
  handler(asRequest(first), asResponse(firstResponse));

  const overloaded = formStreamRequest();
  const overloadedResponse = new FakeResponse();
  handler(asRequest(overloaded), asResponse(overloadedResponse));
  assert.equal(overloadedResponse.status, 503);
  assert.equal(overloadedResponse.headers?.['retry-after'], '1');
  assert.equal(overloadedResponse.headers?.connection, 'close');
  assertSensitive(overloadedResponse);
  assert.equal(overloaded.resumes, 0);
  assert.equal(calls, 0);

  first.aborted = true;
  first.emit('aborted');
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(firstResponse.destroyed, true);

  const next = formStreamRequest();
  const nextResponse = new FakeResponse();
  handler(asRequest(next), asResponse(nextResponse));
  await finishBody(next, nextResponse, [encoder.encode('token=value')]);
  assert.equal(nextResponse.status, 200);
  assertSensitive(nextResponse);
  assert.equal(calls, 1);
});

test('OAuth authorization, CORS, and credentials reject before stream reads', () => {
  let calls = 0;
  const configured = createRequestHandler({
    credentials,
    protectedCorsOrigins: ['https://app.example'],
    fetch: async () => { calls += 1; return new Response(); },
  });
  const cases = [
    formStreamRequest('/solved/v4/oauth/token', [
      'Authorization', 'Bearer caller-token',
    ]),
    formStreamRequest('/solved/v4/oauth/token', [
      'Origin', 'https://evil.example',
    ]),
  ];
  for (const request of cases) {
    const response = new FakeResponse();
    configured(asRequest(request), asResponse(response));
    assert.equal(response.status, request === cases[0] ? 400 : 403);
    assert.equal(response.headers?.connection, 'close');
    assert.equal(request.resumes, 0);
    assertSensitive(response);
  }

  const unconfigured = createRequestHandler({
    fetch: async () => { calls += 1; return new Response(); },
  });
  const request = formStreamRequest('/solved/v4/oauth/token');
  const response = new FakeResponse();
  unconfigured(asRequest(request), asResponse(response));
  assert.equal(response.status, 503);
  assert.equal(response.headers?.connection, 'close');
  assert.equal(request.resumes, 0);
  assertSensitive(response);
  assert.equal(calls, 0);
});

test('rejects OAuth Expect with exact CORS and sensitive headers', () => {
  let calls = 0;
  const handler = createExpectationRejectionHandler({
    protectedCorsOrigins: ['https://app.example'],
    fetch: async () => { calls += 1; return new Response(); },
  });
  const request = new FakeRequest('POST', '/solved/v4/oauth/token', [
    'Origin', 'https://app.example',
    'Content-Type', 'application/x-www-form-urlencoded',
    'Content-Length', '44',
    'Expect', '100-continue',
  ]);
  const response = new FakeResponse();
  handler(asRequest(request), asResponse(response));
  assert.equal(response.status, 417);
  assert.equal(response.headers?.connection, 'close');
  assert.equal(
    response.headers?.['access-control-allow-origin'],
    'https://app.example',
  );
  assertSensitive(response);
  assert.equal(request.resumes, 0);
  assert.equal(calls, 0);
});

test('real server handles OAuth POST and Content-Type-only OPTIONS', async (context) => {
  let calls = 0;
  let forwarded = '';
  const options = {
    credentials,
    protectedCorsOrigins: ['https://app.example'],
    fetch: async (_input: URL | Request | string, init?: RequestInit) => {
      calls += 1;
      assert.ok(init?.body instanceof Uint8Array);
      forwarded = decoder.decode(init.body);
      return new Response('{}', {
        headers: { 'content-type': 'application/json' },
      });
    },
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

  const send = async (
    method: string,
    path: string,
    headers: Readonly<Record<string, string>>,
    body = '',
  ): Promise<{
    readonly status: number;
    readonly headers: IncomingMessage['headers'];
    readonly body: string;
  }> => new Promise((resolve, reject) => {
    const request = httpRequest({
      host: '127.0.0.1', port: address.port, method, path, headers,
    }, (response) => {
      const chunks: Uint8Array[] = [];
      response.on('data', (chunk: Uint8Array) => chunks.push(chunk));
      response.once('end', () => resolve({
        status: response.statusCode ?? 0,
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    request.once('error', reject);
    request.end(body);
  });

  const preflight = await send('OPTIONS', '/solved/v4/oauth/token', {
    Origin: 'https://app.example',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'Content-Type',
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers['access-control-allow-headers'], 'Content-Type');
  assert.equal(preflight.headers.pragma, 'no-cache');
  assert.equal(calls, 0);

  const source =
    '{"refresh_token":"real-server","grant_type":"refresh_token"}';
  const result = await send('POST', '/solved/v4/oauth/token', {
    Origin: 'https://app.example',
    'Content-Type': 'application/json',
    'Content-Length': String(Buffer.byteLength(source)),
  }, source);
  assert.equal(result.status, 200);
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.equal(result.headers.pragma, 'no-cache');
  assert.equal(result.headers.etag, undefined);
  assert.equal(result.body, '{}');
  assert.equal(forwarded, 'grant_type=refresh_token&refresh_token=real-server');
  assert.equal(calls, 1);

  await new Promise<void>((resolve, reject) =>
    server.close((error) => error === undefined ? resolve() : reject(error)),
  );
});

test('real OAuth checkContinue returns 417 without interim 100', async (context) => {
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

  const source = 'token=value';
  let continued = false;
  const result = await new Promise<{
    readonly status: number;
    readonly pragma?: string;
  }>((resolve, reject) => {
    const request = httpRequest({
      host: '127.0.0.1', port: address.port,
      method: 'POST', path: '/solved/v4/oauth/revoke',
      headers: {
        Expect: '100-continue',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': String(Buffer.byteLength(source)),
      },
    }, (response) => {
      response.resume();
      response.once('end', () => resolve({
        status: response.statusCode ?? 0,
        ...(response.headers.pragma === undefined
          ? {}
          : { pragma: response.headers.pragma }),
      }));
    });
    request.once('continue', () => { continued = true; });
    request.once('error', reject);
    request.end(source);
  });
  assert.equal(result.status, 417);
  assert.equal(result.pragma, 'no-cache');
  assert.equal(continued, false);
  assert.equal(calls, 0);

  await new Promise<void>((resolve, reject) =>
    server.close((error) => error === undefined ? resolve() : reject(error)),
  );
});
