import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  ConfigurationError,
  loadProtectedCorsOrigins,
  loadServerRuntimeConfig,
  loadSolvedClientCredentials,
  type ServerRuntimeDefaults,
} from '../src/infrastructure/runtime-config.js';

const serverRuntimeDefaults: ServerRuntimeDefaults = Object.freeze({
  host: '0.0.0.0',
  port: 3_000,
  timeoutMs: 8_000,
  maxResponseBytes: 5 * 1_024 * 1_024,
  maxConcurrentRequests: 8,
});

function credentialFiles(
  clientId = 'client-id',
  clientSecret = 'client-secret',
): { readonly directory: string; readonly environment: NodeJS.ProcessEnv } {
  const directory = mkdtempSync(join(tmpdir(), 'solved-proxy-config-'));
  const clientIdPath = join(directory, 'client-id');
  const clientSecretPath = join(directory, 'client-secret');
  writeFileSync(clientIdPath, clientId, { encoding: 'utf8', mode: 0o600 });
  writeFileSync(clientSecretPath, clientSecret, {
    encoding: 'utf8',
    mode: 0o600,
  });
  return {
    directory,
    environment: {
      SOLVED_CLIENT_ID_FILE: clientIdPath,
      SOLVED_CLIENT_SECRET_FILE: clientSecretPath,
    },
  };
}

test('uses reviewed server runtime defaults only when values are omitted', () => {
  const actual = loadServerRuntimeConfig({}, serverRuntimeDefaults);
  assert.deepEqual(actual, serverRuntimeDefaults);
  assert.equal(Object.isFrozen(actual), true);
});

test('accepts the inclusive server runtime configuration boundaries', () => {
  assert.deepEqual(
    loadServerRuntimeConfig(
      {
        PORT: '1',
        REQUEST_TIMEOUT_MS: '1',
        MAX_RESPONSE_BYTES: '1',
        MAX_CONCURRENT_REQUESTS: '1',
      },
      serverRuntimeDefaults,
    ),
    {
      host: '0.0.0.0',
      port: 1,
      timeoutMs: 1,
      maxResponseBytes: 1,
      maxConcurrentRequests: 1,
    },
  );
  assert.deepEqual(
    loadServerRuntimeConfig(
      {
        PORT: '65535',
        REQUEST_TIMEOUT_MS: '10000',
        MAX_RESPONSE_BYTES: '5242880',
        MAX_CONCURRENT_REQUESTS: '8',
      },
      serverRuntimeDefaults,
    ),
    {
      host: '0.0.0.0',
      port: 65_535,
      timeoutMs: 10_000,
      maxResponseBytes: 5_242_880,
      maxConcurrentRequests: 8,
    },
  );
});

test('accepts an explicit non-empty listen host', () => {
  assert.equal(
    loadServerRuntimeConfig(
      { HOST: '::1' },
      serverRuntimeDefaults,
    ).host,
    '::1',
  );
});

for (const invalidValue of [
  '',
  ' ',
  ' localhost',
  'localhost ',
  'line\nbreak',
  'host\u007f',
  'x'.repeat(254),
]) {
  test(`rejects invalid HOST configuration of length ${invalidValue.length}`, () => {
    assert.throws(
      () =>
        loadServerRuntimeConfig(
          { HOST: invalidValue },
          serverRuntimeDefaults,
        ),
      (error: unknown) =>
        error instanceof ConfigurationError &&
        error.message === 'HOST contains an invalid value',
    );
  });
}

const invalidServerRuntimeValues = [
  ['PORT', '65536'],
  ['REQUEST_TIMEOUT_MS', '10001'],
  ['MAX_RESPONSE_BYTES', '5242881'],
  ['MAX_CONCURRENT_REQUESTS', '9'],
] as const;

for (const [variableName, overMaximum] of invalidServerRuntimeValues) {
  for (const invalidValue of [
    '',
    '0',
    '-1',
    ' 1',
    '1 ',
    '+1',
    '1.0',
    '01',
    '9007199254740992',
    overMaximum,
  ]) {
    test(`rejects invalid ${variableName} configuration of length ${invalidValue.length}`, () => {
      assert.throws(
        () =>
          loadServerRuntimeConfig(
            { [variableName]: invalidValue },
            serverRuntimeDefaults,
          ),
        (error: unknown) =>
          error instanceof ConfigurationError &&
          error.message === `${variableName} contains an invalid value`,
      );
    });
  }
}

test('rejects an invalid internal server runtime default', () => {
  assert.throws(
    () =>
      loadServerRuntimeConfig({}, {
        ...serverRuntimeDefaults,
        maxConcurrentRequests: 9,
      }),
    (error: unknown) =>
      error instanceof TypeError &&
      error.message === 'Invalid default for MAX_CONCURRENT_REQUESTS',
  );
});

test('rejects an invalid internal listen host default', () => {
  assert.throws(
    () =>
      loadServerRuntimeConfig({}, {
        ...serverRuntimeDefaults,
        host: '',
      }),
    (error: unknown) =>
      error instanceof TypeError && error.message === 'Invalid default for HOST',
  );
});

test('loads credentials from files and removes one trailing newline', () => {
  const fixture = credentialFiles('client-id\n', 'client-secret\r\n');
  try {
    assert.deepEqual(loadSolvedClientCredentials(fixture.environment), {
      clientId: 'client-id',
      clientSecret: 'client-secret',
    });
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test('requires both credential file paths without echoing values', () => {
  assert.throws(
    () => loadSolvedClientCredentials({}),
    (error: unknown) =>
      error instanceof ConfigurationError &&
      error.message === 'SOLVED_CLIENT_ID_FILE is required',
  );
});

for (const invalidValue of [
  '',
  ' leading-space',
  'trailing-space ',
  'first\nsecond',
  'value\0suffix',
]) {
  test(`rejects an invalid credential value of length ${invalidValue.length}`, () => {
    const fixture = credentialFiles('client-id', invalidValue);
    try {
      assert.throws(
        () => loadSolvedClientCredentials(fixture.environment),
        (error: unknown) =>
          error instanceof ConfigurationError &&
          error.message ===
            'SOLVED_CLIENT_SECRET_FILE contains an invalid value' &&
          (invalidValue.length === 0 || !error.message.includes(invalidValue)),
      );
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });
}

test('does not expose an unreadable credential path', () => {
  const missingPath = '/definitely/not/a/credential';
  assert.throws(
    () =>
      loadSolvedClientCredentials({
        SOLVED_CLIENT_ID_FILE: missingPath,
        SOLVED_CLIENT_SECRET_FILE: missingPath,
      }),
    (error: unknown) =>
      error instanceof ConfigurationError &&
      error.message === 'SOLVED_CLIENT_ID_FILE could not be read' &&
      !error.message.includes(missingPath),
  );
});

test('rejects an oversized credential file before reading its contents', () => {
  const fixture = credentialFiles('client-id', 's'.repeat(4_099));
  try {
    assert.throws(
      () => loadSolvedClientCredentials(fixture.environment),
      (error: unknown) =>
        error instanceof ConfigurationError &&
        error.message ===
          'SOLVED_CLIENT_SECRET_FILE contains an invalid value',
    );
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test('loads a bounded canonical protected CORS origin allowlist', () => {
  assert.deepEqual(loadProtectedCorsOrigins({}), []);
  assert.deepEqual(
    loadProtectedCorsOrigins({
      SOLVED_PROTECTED_CORS_ORIGINS:
        'https://app.example,http://localhost:3000',
    }),
    ['https://app.example', 'http://localhost:3000'],
  );
});

for (const invalidValue of [
  '*',
  'null',
  'file:///tmp/app',
  'https://user:password@app.example',
  'https://app.example/path',
  'https://app.example/',
  'https://app.example?query=yes',
  'https://app.example#fragment',
  'HTTPS://app.example',
  'https://app.example,https://app.example',
  'https://app.example,',
  Array.from(
    { length: 33 },
    (_unused, index) => `https://app-${index}.example`,
  ).join(','),
  'x'.repeat(8_193),
]) {
  test(`rejects invalid protected CORS origin configuration of length ${invalidValue.length}`, () => {
    assert.throws(
      () =>
        loadProtectedCorsOrigins({
          SOLVED_PROTECTED_CORS_ORIGINS: invalidValue,
        }),
      (error: unknown) =>
        error instanceof ConfigurationError &&
        error.message ===
          'SOLVED_PROTECTED_CORS_ORIGINS contains an invalid value' &&
        !error.message.includes(invalidValue),
    );
  });
}
