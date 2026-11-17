import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';
import test from 'node:test';

import {
  inspectRequestBodyHeaders,
  isStrictJsonContentType,
  MAX_REQUEST_BODY_BYTES,
  readIncomingBody,
} from '../src/adapters/http/request-body.js';

class FakeIncoming extends EventEmitter {
  complete = false;
  aborted = false;
  destroyed = false;
  resumes = 0;
  pauses = 0;
  resume(): this { this.resumes += 1; return this; }
  pause(): this { this.pauses += 1; return this; }
}

const incoming = (value: FakeIncoming): IncomingMessage =>
  value as unknown as IncomingMessage;

test('parses reviewed framing and exact Content-Length bounds', () => {
  for (const value of ['0', '00', '65536', '00065536']) {
    assert.equal(inspectRequestBodyHeaders(['Content-Length', value]).kind, 'valid');
  }
  for (const value of ['65537', '999999999999999999999999999999']) {
    assert.equal(inspectRequestBodyHeaders(['Content-Length', value]).kind, 'too-large');
  }
  for (const headers of [
    ['Content-Length', '-1'],
    ['Content-Length', '1.0'],
    ['Content-Length', '1', 'content-length', '1'],
    ['Content-Length', '1', 'Transfer-Encoding', 'chunked'],
    ['Transfer-Encoding', 'gzip'],
    ['Transfer-Encoding', 'chunked, gzip'],
  ]) {
    assert.equal(inspectRequestBodyHeaders(headers).kind, 'invalid');
  }
  assert.equal(inspectRequestBodyHeaders(['Transfer-Encoding', 'Chunked']).kind, 'valid');
});

test('classifies duplicate media headers separately', () => {
  assert.equal(inspectRequestBodyHeaders([
    'Content-Type', 'application/json', 'content-type', 'application/json',
  ]).kind, 'invalid-media');
  assert.equal(inspectRequestBodyHeaders([
    'Content-Encoding', 'identity', 'content-encoding', 'identity',
  ]).kind, 'invalid-media');
});

test('accepts only JSON with one optional UTF-8 charset', () => {
  for (const value of [
    'application/json', 'Application/JSON',
    ' application/json ; charset = UTF-8\t',
  ]) assert.equal(isStrictJsonContentType(value), true, value);
  for (const value of [
    'text/json', 'application/json-patch+json',
    'application/json; charset=utf-16',
    'application/json; charset="utf-8"',
    'application/json; charset=utf-8; profile=x',
    'application/json\n;charset=utf-8',
  ]) assert.equal(isStrictJsonContentType(value), false, value);
});

test('streams exactly 65,536 bytes and rejects the next byte', async () => {
  const exact = new FakeIncoming();
  const exactResult = readIncomingBody(
    incoming(exact), MAX_REQUEST_BODY_BYTES, new AbortController().signal,
  );
  exact.emit('data', new Uint8Array(32_768));
  exact.emit('data', new Uint8Array(32_768));
  exact.complete = true;
  exact.emit('end');
  const accepted = await exactResult;
  assert.equal(accepted.kind, 'ok');
  if (accepted.kind === 'ok') {
    assert.equal(accepted.body.byteLength, MAX_REQUEST_BODY_BYTES);
  }

  const over = new FakeIncoming();
  const overResult = readIncomingBody(
    incoming(over), undefined, new AbortController().signal,
  );
  over.emit('data', new Uint8Array(MAX_REQUEST_BODY_BYTES));
  over.emit('data', Uint8Array.of(1));
  assert.deepEqual(await overResult, { kind: 'too-large' });
  assert.equal(over.pauses, 1);
});

test('handles length mismatch, parent abort, and stream error', async () => {
  const short = new FakeIncoming();
  const shortResult = readIncomingBody(
    incoming(short), 2, new AbortController().signal,
  );
  short.emit('data', Uint8Array.of(1));
  short.complete = true;
  short.emit('end');
  assert.deepEqual(await shortResult, { kind: 'invalid' });

  const aborted = new FakeIncoming();
  const controller = new AbortController();
  const abortedResult = readIncomingBody(incoming(aborted), undefined, controller.signal);
  controller.abort();
  assert.deepEqual(await abortedResult, { kind: 'aborted' });
  assert.equal(aborted.pauses, 1);

  const failed = new FakeIncoming();
  const failedResult = readIncomingBody(
    incoming(failed), undefined, new AbortController().signal,
  );
  failed.emit('error', new Error('private detail'));
  assert.deepEqual(await failedResult, { kind: 'aborted' });
});
