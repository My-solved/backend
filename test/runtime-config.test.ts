import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  ConfigurationError,
  loadProtectedCorsOrigins,
  loadSolvedClientCredentials,
} from '../src/infrastructure/runtime-config.js';

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
