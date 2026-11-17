import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { SNAPSHOT_PATH } from '../tool/openapi-contract.mjs';
import {
  assertLocalReferences,
  collectOperations,
  generateWireTypes,
} from '../tool/generate-v4-wire-types.mjs';

const generatedWireTypesUrl = new URL(
  '../src/generated/v4-wire-types.d.ts',
  import.meta.url,
);
const packageJsonUrl = new URL('../package.json', import.meta.url);

async function loadDocument() {
  return JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8'));
}

test('generator maps all operations to unique sorted stable keys', async () => {
  const operations = collectOperations(await loadDocument());
  const keys = operations.map(({ key }) => key);

  assert.equal(operations.length, 83);
  assert.equal(new Set(keys).size, 83);
  assert.deepEqual(keys, [...keys].sort());
  assert.ok(keys.includes('GET /api/v4/health'));
  assert.ok(keys.includes('POST /api/v4/oauth/token'));
  assert.ok(keys.includes('DELETE /api/v4/account/bookmarks/{slug}'));
});

test('generator output exactly matches the committed type map', async () => {
  const [document, committed] = await Promise.all([
    loadDocument(),
    readFile(generatedWireTypesUrl, 'utf8'),
  ]);

  assert.equal(generateWireTypes(document), committed);
});

test('generator refuses references that could make CI access the network', async () => {
  const document = await loadDocument();
  assert.doesNotThrow(() => assertLocalReferences(document));

  const withExternalReference = structuredClone(document);
  withExternalReference.components.schemas.HelpTreeNode = {
    $ref: 'https://example.invalid/schema.json',
  };

  assert.throws(
    () => collectOperations(withExternalReference),
    /external OpenAPI references are not allowed/u,
  );
});

test('type scripts validate references before invoking the third-party CLI', async () => {
  const packageJson = JSON.parse(await readFile(packageJsonUrl, 'utf8'));

  for (const scriptName of ['openapi:types:update', 'openapi:types:check']) {
    const script = packageJson.scripts[scriptName];
    const validationIndex = script.indexOf(
      'node tool/generate-v4-wire-types.mjs',
    );
    const cliIndex = script.indexOf('openapi-typescript');

    assert.ok(validationIndex >= 0, `${scriptName} must validate the input`);
    assert.ok(
      cliIndex > validationIndex,
      `${scriptName} must validate before invoking openapi-typescript`,
    );
  }
});
