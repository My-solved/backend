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
  EXPECTED_SUPPLEMENT_SCHEMA_METRICS,
  GATEWAY_OVERRIDES_PATH,
  OPERATION_MANIFEST_PATH,
  REQUEST_SUPPLEMENTS_PATH,
  generateOperationManifest,
  normalizeRequestSchema,
  renderOperationManifest,
  validateGatewayOverrides,
  validateRequestSupplements,
} from '../tool/generate-v4-operation-manifest.mjs';

async function loadInputs() {
  const [
    snapshotBytes,
    snapshotManifestBytes,
    overrideBytes,
    supplementBytes,
  ] =
    await Promise.all([
      readFile(SNAPSHOT_PATH),
      readFile(MANIFEST_PATH),
      readFile(GATEWAY_OVERRIDES_PATH),
      readFile(REQUEST_SUPPLEMENTS_PATH),
    ]);
  const { manifest } = checkSnapshotBytes(
    snapshotBytes,
    snapshotManifestBytes,
  );
  return {
    document: JSON.parse(snapshotBytes.toString('utf8')),
    overrides: JSON.parse(overrideBytes.toString('utf8')),
    supplements: JSON.parse(supplementBytes.toString('utf8')),
    snapshotSha256: manifest.snapshotSha256,
  };
}

test('generator emits the committed deterministic 83-operation manifest', async () => {
  const { document, overrides, supplements, snapshotSha256 } = await loadInputs();
  const generated = generateOperationManifest(
    document,
    overrides,
    supplements,
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
  assert.deepEqual(
    generated.supplementMetrics,
    EXPECTED_SUPPLEMENT_SCHEMA_METRICS,
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
  const { document, overrides, supplements, snapshotSha256 } = await loadInputs();
  const withReference = structuredClone(document);
  const problemQuery = withReference.paths['/api/v4/problems'].get.parameters
    .find((parameter) => parameter.name === 'q');
  problemQuery.schema = { $ref: '#/components/schemas/HelpTreeNode' };
  assert.throws(
    () => generateOperationManifest(
      withReference,
      overrides,
      supplements,
      snapshotSha256,
    ),
    /request-side references are not supported/u,
  );

  const withMedia = structuredClone(document);
  const createBookmark = withMedia.paths['/api/v4/account/bookmarks'].post;
  createBookmark.requestBody.content = {
    'text/plain': { schema: { type: 'string' } },
  };
  assert.throws(
    () => generateOperationManifest(
      withMedia,
      overrides,
      supplements,
      snapshotSha256,
    ),
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

  for (const mutate of [
    (candidate) => { candidate.operationOverrides[1].runtimeEnabled = false; },
    (candidate) => {
      candidate.operationOverrides[1].policy = 'implementation-required';
    },
    (candidate) => {
      candidate.operationOverrides[1].supplement = 'oauth-token';
    },
  ]) {
    const changedRuntime = structuredClone(overrides);
    mutate(changedRuntime);
    assert.throws(
      () => validateGatewayOverrides(
        changedRuntime,
        document,
        snapshotSha256,
      ),
      /OAuth supplement boundary changed/u,
    );
  }
});

test('OAuth request supplements are snapshot and source-description bound', async () => {
  const { document, supplements, snapshotSha256 } = await loadInputs();
  const reviewed = validateRequestSupplements(
    supplements,
    document,
    snapshotSha256,
  );
  assert.deepEqual(reviewed.metrics, EXPECTED_SUPPLEMENT_SCHEMA_METRICS);
  assert.deepEqual([...reviewed.byOperation.keys()], [
    'POST /api/v4/oauth/revoke',
    'POST /api/v4/oauth/token',
  ]);
});

test('OAuth request supplements fail closed on source, shape, and security drift', async () => {
  const { document, supplements, snapshotSha256 } = await loadInputs();
  const cases = [];

  const stale = structuredClone(supplements);
  stale.snapshotSha256 = '0'.repeat(64);
  cases.push([stale, document, /reviewed snapshot/u]);

  const reordered = structuredClone(supplements);
  reordered.operations.reverse();
  cases.push([reordered, document, /changed or are not sorted/u]);

  const duplicate = structuredClone(supplements);
  duplicate.operations[1] = structuredClone(duplicate.operations[0]);
  cases.push([duplicate, document, /changed or are not sorted/u]);

  const unknownField = structuredClone(supplements);
  unknownField.operations[0].unreviewed = true;
  cases.push([unknownField, document, /unexpected fields/u]);

  const wrongMedia = structuredClone(supplements);
  wrongMedia.operations[0].mediaTypes = ['application/json'];
  cases.push([wrongMedia, document, /media or body policy/u]);

  const unsafeCors = structuredClone(supplements);
  unsafeCors.operations[1].security.browserCors = 'wildcard';
  cases.push([unsafeCors, document, /security policy no longer matches/u]);

  const changedGrant = structuredClone(supplements);
  changedGrant.operations[1].schema.oneOf[0].properties.grant_type.enum = [
    'refresh_token',
  ];
  cases.push([changedGrant, document, /schema no longer matches/u]);

  const changedDescriptionDocument = structuredClone(document);
  changedDescriptionDocument.paths['/api/v4/oauth/token'].post.description +=
    ' changed';
  cases.push([
    supplements,
    changedDescriptionDocument,
    /source description changed/u,
  ]);

  const sourceBodyDocument = structuredClone(document);
  sourceBodyDocument.paths['/api/v4/oauth/revoke'].post.requestBody = {
    content: {
      'application/x-www-form-urlencoded': {
        schema: { type: 'object', properties: {} },
      },
    },
  };
  cases.push([supplements, sourceBodyDocument, /source boundary changed/u]);

  for (const [candidate, candidateDocument, pattern] of cases) {
    assert.throws(
      () =>
        validateRequestSupplements(
          candidate,
          candidateDocument,
          snapshotSha256,
        ),
      pattern,
    );
  }
});

test('affiliation override is bound to the exact anomalous source shape', async () => {
  const { document, overrides, supplements, snapshotSha256 } = await loadInputs();
  const changed = structuredClone(document);
  const affiliation = changed.paths[
    '/api/v4/rankings/affiliations/{affiliationId}'
  ].get.parameters.find((parameter) => parameter.name === 'affiliationId');
  affiliation.required = true;
  affiliation.schema = { type: 'integer' };

  assert.throws(
    () => generateOperationManifest(
      changed,
      overrides,
      supplements,
      snapshotSha256,
    ),
    /affiliation override source/u,
  );
});
