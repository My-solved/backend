import assert from 'node:assert/strict';
import test from 'node:test';

import { parseBearerAuthorization } from '../src/adapters/http/bearer-authorization.js';
import { bearerAuthorizationHeader } from '../src/domain/bearer-authorization.js';

test('parses one bounded RFC 6750 Bearer value and normalizes the scheme', () => {
  for (const value of [
    'Bearer abc-._~+/=',
    'bearer header.payload.signature',
    'BEARER token==',
  ]) {
    const result = parseBearerAuthorization(['Authorization', value]);
    assert.equal(result.kind, 'valid');
    if (result.kind === 'valid') {
      assert.equal(
        bearerAuthorizationHeader(result.authorization),
        `Bearer ${value.slice(value.indexOf(' ') + 1)}`,
      );
    }
  }

  const maximum = parseBearerAuthorization([
    'Authorization',
    `Bearer ${'a'.repeat(4_089)}`,
  ]);
  assert.equal(maximum.kind, 'valid');
});

test('distinguishes an absent authorization header', () => {
  assert.deepEqual(parseBearerAuthorization(undefined), { kind: 'absent' });
  assert.deepEqual(parseBearerAuthorization(['Accept', 'application/json']), {
    kind: 'absent',
  });
});

for (const rawHeaders of [
  ['Authorization'],
  ['Authorization', 'Basic abc'],
  ['Authorization', 'Bearer'],
  ['Authorization', 'Bearer  token'],
  ['Authorization', 'Bearer token '],
  ['Authorization', 'Bearer tok,en'],
  ['Authorization', 'Bearer 토큰'],
  ['Authorization', 'Bearer abc', 'authorization', 'Bearer def'],
  ['Authorization', `Bearer ${'a'.repeat(4_090)}`],
] as const) {
  test(`rejects malformed or duplicate raw authorization (${rawHeaders.length} fields)`, () => {
    assert.deepEqual(parseBearerAuthorization(rawHeaders), { kind: 'invalid' });
  });
}
