import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  EXPECTED_CONTRACT,
  SNAPSHOT_PATH,
  parseJsonBuffer,
  validateOpenApiDocument,
  writeFileAtomically,
} from './openapi-contract.mjs';

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputPath = join(
  repositoryRoot,
  'src',
  'generated',
  'v4-wire-types.d.ts',
);
const supportedMethods = Object.freeze(['get', 'post', 'patch', 'delete']);

function operationKey(method, path) {
  return `${method.toUpperCase()} ${path}`;
}

function compareText(left, right) {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

export function assertLocalReferences(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      assertLocalReferences(item);
    }
    return;
  }
  if (value === null || typeof value !== 'object') {
    return;
  }

  for (const [key, item] of Object.entries(value)) {
    if (
      key === '$ref' &&
      (typeof item !== 'string' || !item.startsWith('#/'))
    ) {
      throw new Error('external OpenAPI references are not allowed');
    }
    assertLocalReferences(item);
  }
}

export function collectOperations(document) {
  assertLocalReferences(document);
  const metrics = validateOpenApiDocument(document);
  const operations = [];
  const keys = new Set();

  for (const [path, pathItem] of Object.entries(document.paths)) {
    for (const method of supportedMethods) {
      if (!Object.hasOwn(pathItem, method)) {
        continue;
      }

      const key = operationKey(method, path);
      if (keys.has(key)) {
        throw new Error('the OpenAPI document contains a duplicate operation');
      }
      keys.add(key);
      operations.push({ key, method, path });
    }
  }

  if (
    operations.length !== EXPECTED_CONTRACT.operationCount ||
    operations.length !== metrics.operationCount
  ) {
    throw new Error('the generated operation count changed');
  }

  return operations.sort((left, right) => compareText(left.key, right.key));
}

export function generateWireTypes(document) {
  const operations = collectOperations(document);
  const mappings = operations.map(
    ({ key, method, path }) =>
      `    ${JSON.stringify(key)}: NonNullable<paths[${JSON.stringify(path)}][${JSON.stringify(method)}]>;`,
  );

  return `/**
 * This file is generated from openapi/solved-v4.openapi.json.
 * Do not edit it directly; run npm run openapi:types:update.
 */
import type { paths } from './solved-v4.openapi.js';

/** Official wire operations keyed by a stable HTTP method and path pair. */
export interface V4WireOperations {
${mappings.join('\n')}
}

export type V4OperationKey = keyof V4WireOperations;

export type V4Operation<K extends V4OperationKey> = V4WireOperations[K];

type ValueAt<T, Key extends PropertyKey> = T extends unknown
    ? Key extends keyof T
        ? NonNullable<T[Key]>
        : never
    : never;

type OperationParameters<K extends V4OperationKey> = ValueAt<
    V4Operation<K>,
    'parameters'
>;

type OperationResponses<K extends V4OperationKey> = ValueAt<
    V4Operation<K>,
    'responses'
>;

type MediaBody<T> = T extends { content: infer Content }
    ? Content[keyof Content]
    : never;

export type PathParams<K extends V4OperationKey> = ValueAt<
    OperationParameters<K>,
    'path'
>;

export type Query<K extends V4OperationKey> = ValueAt<
    OperationParameters<K>,
    'query'
>;

/**
 * The declared request payload shape. This does not imply that a body is
 * optional or required; runtime policy is owned by the operation manifest.
 */
export type RequestBody<K extends V4OperationKey> = MediaBody<
    ValueAt<V4Operation<K>, 'requestBody'>
>;

export type ResponseStatus<K extends V4OperationKey> = keyof OperationResponses<K>;

export type ResponseBody<
    K extends V4OperationKey,
    Status extends ResponseStatus<K>,
> = MediaBody<ValueAt<OperationResponses<K>, Status>>;
`;
}

function parseMode(arguments_) {
  if (arguments_.length === 0) {
    return 'update';
  }
  if (arguments_.length === 1 && arguments_[0] === '--check') {
    return 'check';
  }
  throw new Error('usage: node tool/generate-v4-wire-types.mjs [--check]');
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  const snapshotBytes = await readFile(SNAPSHOT_PATH);
  const document = parseJsonBuffer(snapshotBytes);
  const generated = generateWireTypes(document);

  if (mode === 'check') {
    const committed = await readFile(outputPath, 'utf8');
    if (committed !== generated) {
      throw new Error('the generated v4 wire operation types are stale');
    }
    process.stdout.write(
      `Official v4 wire operation types verified: ${EXPECTED_CONTRACT.operationCount} operations.\n`,
    );
    return;
  }

  await writeFileAtomically(outputPath, generated);
  process.stdout.write(
    `Generated official v4 wire operation types: ${EXPECTED_CONTRACT.operationCount} operations.\n`,
  );
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'wire type generation failed'}\n`,
    );
    process.exitCode = 1;
  }
}
