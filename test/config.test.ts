import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  ConfigurationError,
  loadSolvedClientCredentials,
} from '../src/config.js';

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
