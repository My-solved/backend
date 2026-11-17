import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  FETCH_TIMEOUT_MS,
  MANIFEST_PATH,
  MAX_OPENAPI_BYTES,
  OFFICIAL_OPENAPI_URL,
  PRODUCTION_SERVER_URL,
  SNAPSHOT_PATH,
  assertNoSecretMaterial,
  canonicalJson,
  checkSnapshotBytes,
  createManifest,
  createOfficialRequestInit,
  readLimitedResponseBody,
  validateJsonContentType,
  validateOpenApiDocument,
} from '../tool/openapi-contract.mjs';

const allowedMethods = new Set(['get', 'post', 'patch', 'delete']);
const standardMethods = new Set([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
]);

async function loadSnapshot() {
  const [snapshotBytes, manifestBytes] = await Promise.all([
    readFile(SNAPSHOT_PATH),
    readFile(MANIFEST_PATH),
  ]);
  return {
    snapshotBytes,
    document: JSON.parse(snapshotBytes.toString('utf8')),
    manifestBytes,
    manifest: JSON.parse(manifestBytes.toString('utf8')),
  };
}

test('official request is bounded, redirect-free, and credential-free', () => {
  const init = createOfficialRequestInit();

  assert.equal(OFFICIAL_OPENAPI_URL, 'https://backstage.solved.ac/api/v4/openapi');
  assert.equal(FETCH_TIMEOUT_MS, 30_000);
  assert.equal(init.method, 'GET');
  assert.equal(init.credentials, 'omit');
  assert.equal(init.redirect, 'error');
  assert.deepEqual(init.headers, { accept: 'application/json' });
  assert.ok(init.signal instanceof AbortSignal);
  assert.equal(init.signal.aborted, false);
});

test('snapshot and manifest are canonical and checksum-pinned', async () => {
  const { document, manifest, manifestBytes, snapshotBytes } =
    await loadSnapshot();
  const checksum = createHash('sha256').update(snapshotBytes).digest('hex');

  assert.deepEqual(manifest, {
    snapshotBytes: snapshotBytes.byteLength,
    snapshotSha256: checksum,
    sourceBytes: 177_369,
    sourceSha256:
      '052ab72f544140447778df687463ea5fdfe9cbd24dbefa1b1ff4793f6adbaf0a',
    sourceUrl: 'https://backstage.solved.ac/api/v4/openapi',
  });
  assert.equal(snapshotBytes.toString('utf8'), canonicalJson(document));
  assert.equal(manifestBytes.toString('utf8'), canonicalJson(manifest));
  assert.equal(snapshotBytes.at(-1), 0x0a);
  assert.match(checksum, /^[a-f0-9]{64}$/u);
});

test('snapshot contains the complete expected method and access catalog', async () => {
  const { document } = await loadSnapshot();
  const methodCounts = { get: 0, post: 0, patch: 0, delete: 0 };
  const accessCounts = { open: 0, app: 0, public: 0, user: 0 };
  const methodAccessCounts = {
    get: { open: 0, public: 0, user: 0 },
    post: { app: 0, user: 0 },
    patch: { user: 0 },
    delete: { user: 0 },
  };
  const parameterCounts = { path: 0, query: 0 };
  let requestBodyCount = 0;
  let responseCount = 0;
  let jsonResponseCount = 0;
  let bodyless204Count = 0;
  let operationIdCount = 0;
  let operationCount = 0;

  assert.equal(document.openapi, '3.1.0');
  assert.equal(Object.keys(document.paths).length, 79);
  assert.deepEqual(document.servers, [{ url: PRODUCTION_SERVER_URL }]);

  for (const [path, pathItem] of Object.entries(document.paths)) {
    assert.match(path, /^\/api\/v4\//u);
    for (const parameter of pathItem.parameters ?? []) {
      assert.ok(Object.hasOwn(parameterCounts, parameter.in));
      assert.equal(typeof parameter.schema, 'object');
      parameterCounts[parameter.in] += 1;
    }
    for (const [key, operation] of Object.entries(pathItem)) {
      const method = key.toLowerCase();
      if (!standardMethods.has(method)) {
        continue;
      }

      assert.equal(key, method, `HTTP method must be lowercase at ${path}`);
      assert.ok(allowedMethods.has(method), `unexpected ${method} at ${path}`);
      assert.ok(
        Object.hasOwn(methodAccessCounts[method], operation['x-access'].class),
        `unexpected access class at ${method.toUpperCase()} ${path}`,
      );

      methodCounts[method] += 1;
      accessCounts[operation['x-access'].class] += 1;
      methodAccessCounts[method][operation['x-access'].class] += 1;
      operationCount += 1;

      if (Object.hasOwn(operation, 'operationId')) {
        operationIdCount += 1;
      }
      for (const parameter of operation.parameters ?? []) {
        assert.ok(Object.hasOwn(parameterCounts, parameter.in));
        assert.equal(typeof parameter.schema, 'object');
        parameterCounts[parameter.in] += 1;
      }
      if (operation.requestBody !== undefined) {
        assert.deepEqual(Object.keys(operation.requestBody.content), [
          'application/json',
        ]);
        assert.equal(
          typeof operation.requestBody.content['application/json'].schema,
          'object',
        );
        requestBodyCount += 1;
      }
      for (const [status, response] of Object.entries(operation.responses)) {
        responseCount += 1;
        if (response.content?.['application/json']?.schema !== undefined) {
          assert.deepEqual(Object.keys(response.content), ['application/json']);
          jsonResponseCount += 1;
        } else if (status === '204' && response.content === undefined) {
          bodyless204Count += 1;
        } else {
          assert.fail(`unexpected response shape at ${method} ${path} ${status}`);
        }
      }
    }
  }

  assert.equal(operationCount, 83);
  assert.deepEqual(methodCounts, { get: 71, post: 7, patch: 3, delete: 2 });
  assert.deepEqual(accessCounts, { open: 1, app: 2, public: 52, user: 28 });
  assert.deepEqual(methodAccessCounts, {
    get: { open: 1, public: 52, user: 18 },
    post: { app: 2, user: 5 },
    patch: { user: 3 },
    delete: { user: 2 },
  });
  assert.equal(parameterCounts.path + parameterCounts.query, 144);
  assert.deepEqual(parameterCounts, { path: 52, query: 92 });
  assert.equal(requestBodyCount, 7);
  assert.equal(responseCount, 165);
  assert.equal(jsonResponseCount, 163);
  assert.equal(bodyless204Count, 2);
  assert.equal(operationIdCount, 0);
  assert.equal(Object.keys(document.components.schemas).length, 1);
});

test('source transport and document validation fail closed', async () => {
  assert.doesNotThrow(() => validateJsonContentType('application/json'));
  assert.doesNotThrow(() =>
    validateJsonContentType('application/problem+json; charset=utf-8'),
  );
  assert.throws(() => validateJsonContentType('text/html'));
  assert.throws(() => validateJsonContentType(null));

  const oversized = new Response('x', {
    headers: { 'content-length': String(MAX_OPENAPI_BYTES + 1) },
  });
  await assert.rejects(readLimitedResponseBody(oversized));

  const streamedOversized = new Response(
    new Uint8Array(MAX_OPENAPI_BYTES + 1),
  );
  assert.equal(streamedOversized.headers.get('content-length'), null);
  await assert.rejects(readLimitedResponseBody(streamedOversized));

  const { document } = await loadSnapshot();
  const wrongServer = structuredClone(document);
  wrongServer.servers = [{ url: 'https://example.invalid' }];
  assert.throws(() => validateOpenApiDocument(wrongServer));

  const pathServerOverride = structuredClone(document);
  pathServerOverride.paths['/api/v4/health'].servers = [
    { url: PRODUCTION_SERVER_URL },
  ];
  assert.throws(() => validateOpenApiDocument(pathServerOverride));

  const operationServerOverride = structuredClone(document);
  operationServerOverride.paths['/api/v4/health'].get.servers = [
    { url: PRODUCTION_SERVER_URL },
  ];
  assert.throws(() => validateOpenApiDocument(operationServerOverride));
});

test('offline verification rejects checksum and canonicalization drift', async () => {
  const { manifest, snapshotBytes } = await loadSnapshot();

  const wrongChecksum = {
    ...manifest,
    snapshotSha256: '0'.repeat(64),
  };
  assert.throws(() =>
    checkSnapshotBytes(
      snapshotBytes,
      Buffer.from(canonicalJson(wrongChecksum), 'utf8'),
    ),
  );

  const nonCanonicalSnapshot = Buffer.concat([
    snapshotBytes,
    Buffer.from('\n', 'utf8'),
  ]);
  const matchingManifest = createManifest(snapshotBytes, nonCanonicalSnapshot);
  assert.throws(() =>
    checkSnapshotBytes(
      nonCanonicalSnapshot,
      Buffer.from(canonicalJson(matchingManifest), 'utf8'),
    ),
  );
});

test('snapshot contains no credential material or sensitive samples', async () => {
  const { document } = await loadSnapshot();
  assert.doesNotThrow(() => assertNoSecretMaterial(document));

  const withCredential = structuredClone(document);
  withCredential.components.leakedExample = {
    value: ['ghp', 'A'.repeat(32)].join('_'),
  };
  assert.throws(() => assertNoSecretMaterial(withCredential));

  const withTokenSample = structuredClone(document);
  withTokenSample.components.schemas = {
    access_token: { type: 'string', example: 'not-a-real-token' },
  };
  assert.throws(() => assertNoSecretMaterial(withTokenSample));
});

test('offline checker verifies the committed snapshot without network', () => {
  const result = spawnSync(process.execPath, ['tool/check-openapi.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '' },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /79 paths, 83 operations/u);
  assert.match(result.stdout, /Source SHA-256: [a-f0-9]{64}/u);
  assert.match(result.stdout, /Snapshot SHA-256: [a-f0-9]{64}/u);
  assert.equal(result.stderr, '');
});

test('raw source gaps stay visible instead of being silently invented', async () => {
  const { document } = await loadSnapshot();
  const operations = Object.values(document.paths).flatMap((pathItem) =>
    Object.entries(pathItem)
      .filter(([key]) => standardMethods.has(key))
      .map(([, operation]) => operation),
  );
  const declaredBodies = operations.filter((operation) => operation.requestBody);

  assert.equal(document.paths['/api/v4/oauth/token'].post.requestBody, undefined);
  assert.equal(document.paths['/api/v4/oauth/revoke'].post.requestBody, undefined);
  const affiliationId = document.paths[
    '/api/v4/rankings/affiliations/{affiliationId}'
  ].get.parameters.find((parameter) => parameter.name === 'affiliationId');
  assert.equal(affiliationId.required, false);
  assert.deepEqual(affiliationId.schema.type, ['integer', 'null']);
  assert.equal(declaredBodies.length, 7);
  assert.ok(
    declaredBodies.every(
      (operation) => !Object.hasOwn(operation.requestBody, 'required'),
    ),
  );
});
