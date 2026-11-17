import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  MANIFEST_PATH,
  SNAPSHOT_PATH,
  checkSnapshotBytes,
} from '../tool/openapi-contract.mjs';
import {
  EXPECTED_REQUEST_SCHEMA_METRICS,
  GATEWAY_OVERRIDES_PATH,
  OPERATION_MANIFEST_PATH,
  generateOperationManifest,
  normalizeRequestSchema,
  renderOperationManifest,
  validateGatewayOverrides,
} from '../tool/generate-v4-operation-manifest.mjs';

async function loadInputs() {
  const [snapshotBytes, snapshotManifestBytes, overrideBytes] =
    await Promise.all([
      readFile(SNAPSHOT_PATH),
      readFile(MANIFEST_PATH),
      readFile(GATEWAY_OVERRIDES_PATH),
    ]);
  const { manifest } = checkSnapshotBytes(
    snapshotBytes,
    snapshotManifestBytes,
  );
  return {
    document: JSON.parse(snapshotBytes.toString('utf8')),
    overrides: JSON.parse(overrideBytes.toString('utf8')),
    snapshotSha256: manifest.snapshotSha256,
  };
}

test('generator emits the committed deterministic 83-operation manifest', async () => {
  const { document, overrides, snapshotSha256 } = await loadInputs();
  const generated = generateOperationManifest(
    document,
    overrides,
    snapshotSha256,
  );
  const expected = renderOperationManifest(
    generated.manifest,
    snapshotSha256,
  );
  const committed = await readFile(OPERATION_MANIFEST_PATH, 'utf8');

  assert.equal(Object.keys(generated.manifest).length, 83);
  assert.equal(generated.publicOpenGetCount, 53);
  assert.deepEqual(generated.bearerPolicyCounts, {
    none: 51,
    optional: 4,
    required: 28,
  });
  assert.deepEqual(generated.getBearerPolicyCounts, {
    none: 49,
    optional: 4,
    required: 18,
  });
  assert.deepEqual(
    generated.requestMetrics,
    EXPECTED_REQUEST_SCHEMA_METRICS,
  );
  assert.equal(renderOperationManifest(generated.manifest, snapshotSha256), expected);
  assert.equal(committed, expected);
});

test('request schema grammar rejects unreviewed keywords and patterns', () => {
  assert.throws(
    () => normalizeRequestSchema({ type: 'string', format: 'date' }),
    /unsupported schema keyword/u,
  );
  assert.throws(
    () => normalizeRequestSchema({ type: 'string', pattern: '^.*$' }),
    /pattern is not reviewed/u,
  );
  assert.throws(
    () =>
      normalizeRequestSchema({
        type: 'object',
        properties: {},
        additionalProperties: { type: 'string' },
      }),
    /additionalProperties is unsupported/u,
  );
  assert.throws(
    () => normalizeRequestSchema({ $ref: '#/components/schemas/Elsewhere' }),
    /unsupported schema keyword|unsupported type declaration/u,
  );
});

test('generator rejects request references and unreviewed media types', async () => {
  const { document, overrides, snapshotSha256 } = await loadInputs();
  const withReference = structuredClone(document);
  const problemQuery = withReference.paths['/api/v4/problems'].get.parameters
    .find((parameter) => parameter.name === 'q');
  problemQuery.schema = { $ref: '#/components/schemas/HelpTreeNode' };
  assert.throws(
    () => generateOperationManifest(withReference, overrides, snapshotSha256),
    /request-side references are not supported/u,
  );

  const withMedia = structuredClone(document);
  const createBookmark = withMedia.paths['/api/v4/account/bookmarks'].post;
  createBookmark.requestBody.content = {
    'text/plain': { schema: { type: 'string' } },
  };
  assert.throws(
    () => generateOperationManifest(withMedia, overrides, snapshotSha256),
    /request body media type|unexpected request body/u,
  );
});

test('reviewed overrides reject stale, duplicate, and unknown targets', async () => {
  const { document, overrides, snapshotSha256 } = await loadInputs();

  const stale = structuredClone(overrides);
  stale.snapshotSha256 = '0'.repeat(64);
  assert.throws(
    () => validateGatewayOverrides(stale, document, snapshotSha256),
    /reviewed snapshot/u,
  );

  const duplicate = structuredClone(overrides);
  duplicate.operationOverrides.push(
    structuredClone(duplicate.operationOverrides.at(-1)),
  );
  assert.throws(
    () => validateGatewayOverrides(duplicate, document, snapshotSha256),
    /duplicated|stable key order/u,
  );

  const unknown = structuredClone(overrides);
  unknown.operationOverrides[0].operation = 'GET /api/v4/unknown';
  assert.throws(
    () => validateGatewayOverrides(unknown, document, snapshotSha256),
    /unknown operation/u,
  );

  const unknownField = structuredClone(overrides);
  unknownField.unreviewed = true;
  assert.throws(
    () => validateGatewayOverrides(unknownField, document, snapshotSha256),
    /unexpected fields/u,
  );
});

test('affiliation override is bound to the exact anomalous source shape', async () => {
  const { document, overrides, snapshotSha256 } = await loadInputs();
  const changed = structuredClone(document);
  const affiliation = changed.paths[
    '/api/v4/rankings/affiliations/{affiliationId}'
  ].get.parameters.find((parameter) => parameter.name === 'affiliationId');
  affiliation.required = true;
  affiliation.schema = { type: 'integer' };

  assert.throws(
    () => generateOperationManifest(changed, overrides, snapshotSha256),
    /affiliation override source/u,
  );
});
