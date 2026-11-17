import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
const expectedDirectories = [
  'adapters',
  'application',
  'domain',
  'generated',
  'infrastructure',
];
const allowedDependencies = {
  'adapters/http': new Set([
    'adapters/http',
    'application',
    'domain',
  ]),
  'adapters/solved': new Set(['adapters/solved', 'domain']),
  application: new Set(['application', 'domain', 'generated']),
  domain: new Set(['domain']),
  generated: new Set(['domain', 'generated']),
  infrastructure: new Set(['domain', 'infrastructure']),
};
const relativeImport = /(?:\bfrom\s*|\bimport\s*)['"](\.[^'"]+)['"]/gu;
const gatewayOrchestrationPath = `adapters${sep}http${sep}gateway-handler.ts`;

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        return sourceFiles(path);
      }
      return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
    }),
  );
  return nested.flat();
}

function layerOf(path) {
  const pathFromRoot = relative(sourceRoot, path);
  assert.equal(
    pathFromRoot.startsWith(`..${sep}`) || pathFromRoot === '..',
    false,
    `source import escapes src/: ${pathFromRoot}`,
  );
  const parts = pathFromRoot.split(sep);
  return parts[0] === 'adapters'
    ? `adapters/${parts[1] ?? ''}`
    : parts[0];
}

function typescriptTarget(sourceFile, specifier) {
  const target = resolve(dirname(sourceFile), specifier);
  return target.endsWith('.js') ? `${target.slice(0, -3)}.ts` : target;
}

function dependenciesFor(sourceFile, sourceLayer) {
  const allowed = allowedDependencies[sourceLayer];
  assert.notEqual(allowed, undefined, `unknown source layer: ${sourceLayer}`);
  return relative(sourceRoot, sourceFile) === gatewayOrchestrationPath
    ? new Set([...allowed, 'adapters/solved'])
    : allowed;
}

test('source root contains only the composition root and reviewed layers', async () => {
  const entries = await readdir(sourceRoot, { withFileTypes: true });
  assert.deepEqual(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(),
    expectedDirectories,
  );
  assert.deepEqual(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
      .map((entry) => entry.name)
      .sort(),
    ['server.ts'],
  );
});

test('lower source layers do not import outward', async () => {
  for (const sourceFile of await sourceFiles(sourceRoot)) {
    const sourceLayer = layerOf(sourceFile);
    if (sourceLayer === 'server.ts') {
      continue;
    }
    const allowed = dependenciesFor(sourceFile, sourceLayer);
    const source = await readFile(sourceFile, 'utf8');
    for (const match of source.matchAll(relativeImport)) {
      const specifier = match[1];
      assert.notEqual(specifier, undefined);
      const targetLayer = layerOf(typescriptTarget(sourceFile, specifier));
      assert.equal(
        allowed.has(targetLayer),
        true,
        `${relative(sourceRoot, sourceFile)} imports outward to ${targetLayer}`,
      );
    }
  }
});
