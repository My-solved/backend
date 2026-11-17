import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_REQUEST_TARGET_BYTES,
  parseRequestTarget,
} from '../src/request-target.js';

test('parses path and query components exactly once', () => {
  const parsed = parseRequestTarget(
    '/solved/v4/users/%ED%95%9C%EA%B8%80?q=a+b&%71=%252F',
  );
  assert.ok(parsed);
  assert.deepEqual(parsed.decodedPathSegments, [
    'solved',
    'v4',
    'users',
    '한글',
  ]);
  assert.equal(parsed.pathname, '/solved/v4/users/한글');
  assert.deepEqual([...parsed.url.searchParams.entries()], [
    ['q', 'a b'],
    ['q', '%2F'],
  ]);
});

const invalidTargets = [
  undefined,
  '',
  'https://evil.invalid/solved/v4/tags',
  '//evil.invalid/solved/v4/tags',
  '/solved/v4/tags#fragment',
  '/solved/../v4/tags',
  '/solved/%2e%2e/v4/tags',
  '/solved/v4/foo/../tags',
  '/solved/v4/foo/%2e%2e/tags',
  '/solved/v4/%2Ftags',
  '/solved/v4/%5ctags',
  '/solved/v4/%252Ftags',
  '/solved/v4/%25',
  '/solved/v4/%',
  '/solved/v4/%2',
  '/solved/v4/%GG',
  '/solved/v4/%FF',
  '/solved/v4/tags?q=%FF',
  '/solved/v4/tags?q=%0A',
  '/solved/v4/tags?q=%C2%80',
  '/solved/v4/tags?&',
  '/solved/v4/tags?&&',
  '/solved/v4/tags?=value',
  '/solved/v4/tags?q=value&',
  '/solved/v4/tags?&q=value',
  '/solved/v4/ta\tgs',
  '/solved/v4/tags\0',
  '/solved/v4/tags ',
  `/solved/v4/tags?padding=${'a'.repeat(MAX_REQUEST_TARGET_BYTES)}`,
] as const;

for (const target of invalidTargets) {
  test(`rejects invalid raw target: ${String(target).slice(0, 70)}`, () => {
    assert.equal(parseRequestTarget(target), undefined);
  });
}

test('rejects C1 controls in raw and percent-decoded input', () => {
  assert.equal(parseRequestTarget('/solved/v4/ta\u0080gs'), undefined);
  assert.equal(parseRequestTarget('/solved/v4/tags?q=\u0080'), undefined);
  assert.equal(parseRequestTarget('/solved/v4/tags?q=%C2%9F'), undefined);
});

test('accepts exactly the request-target byte limit', () => {
  const prefix = '/solved/v4/problems?q=';
  const target = `${prefix}${'a'.repeat(MAX_REQUEST_TARGET_BYTES - prefix.length)}`;
  assert.equal(Buffer.byteLength(target), MAX_REQUEST_TARGET_BYTES);
  assert.notEqual(parseRequestTarget(target), undefined);
});
