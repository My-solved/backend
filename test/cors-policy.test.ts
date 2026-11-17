import assert from 'node:assert/strict';
import test from 'node:test';

import { corsDecision } from '../src/cors-policy.js';

const allowedOrigins = ['https://app.example', 'http://localhost:3000'];

test('keeps unscoped public GET wildcard without granting Authorization', () => {
  const actual = corsDecision(
    ['Origin', 'https://anything.example'],
    false,
    false,
    [],
  );
  assert.equal(actual.allowed, true);
  assert.equal(actual.headers['access-control-allow-origin'], '*');
  assert.equal(actual.headers['access-control-allow-headers'], undefined);

  const preflight = corsDecision(
    [
      'Origin',
      'https://anything.example',
      'Access-Control-Request-Method',
      'GET',
      'Access-Control-Request-Headers',
      'Authorization',
    ],
    true,
    false,
    [],
  );
  assert.equal(preflight.allowed, false);
  assert.equal(preflight.headers['access-control-allow-headers'], undefined);
});

test('allows protected native GET without an Origin but varies caches', () => {
  const actual = corsDecision(undefined, false, true, []);
  assert.equal(actual.allowed, true);
  assert.equal(actual.headers.vary, 'Origin');
  assert.equal(actual.headers['access-control-allow-origin'], undefined);
});

test('allows only an exact configured protected browser origin', () => {
  const allowed = corsDecision(
    ['Origin', 'https://app.example'],
    false,
    true,
    allowedOrigins,
  );
  assert.equal(allowed.allowed, true);
  assert.equal(
    allowed.headers['access-control-allow-origin'],
    'https://app.example',
  );
  assert.equal(allowed.headers.vary, 'Origin');
  assert.equal(allowed.headers['access-control-allow-credentials'], undefined);

  for (const rawHeaders of [
    ['Origin', 'https://evil.example'],
    ['Origin', 'null'],
    ['Origin', 'https://app.example', 'origin', 'https://app.example'],
  ]) {
    assert.equal(
      corsDecision(rawHeaders, false, true, allowedOrigins).allowed,
      false,
    );
  }
});

test('approves only protected GET preflight headers within Authorization', () => {
  const allowed = corsDecision(
    [
      'Origin',
      'https://app.example',
      'Access-Control-Request-Method',
      'get',
      'Access-Control-Request-Headers',
      'authorization',
    ],
    true,
    true,
    allowedOrigins,
  );
  assert.equal(allowed.allowed, true);
  assert.equal(
    allowed.headers['access-control-allow-headers'],
    'Authorization',
  );
  assert.equal(
    allowed.headers.vary,
    'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
  );

  for (const rawHeaders of [
    [
      'Origin',
      'https://app.example',
      'Access-Control-Request-Method',
      'POST',
    ],
    [
      'Origin',
      'https://app.example',
      'Access-Control-Request-Method',
      'GET',
      'Access-Control-Request-Headers',
      'Authorization, Content-Type',
    ],
    [
      'Access-Control-Request-Method',
      'GET',
      'Access-Control-Request-Headers',
      'Authorization',
    ],
  ]) {
    assert.equal(
      corsDecision(rawHeaders, true, true, allowedOrigins).allowed,
      false,
    );
  }
});
