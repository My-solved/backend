import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const OFFICIAL_OPENAPI_URL =
  'https://backstage.solved.ac/api/v4/openapi';
export const PRODUCTION_SERVER_URL = 'https://solved.ac';
export const FETCH_TIMEOUT_MS = 30_000;
export const MAX_OPENAPI_BYTES = 5 * 1024 * 1024;

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export const SNAPSHOT_PATH = join(
  repositoryRoot,
  'openapi',
  'solved-v4.openapi.json',
);
export const MANIFEST_PATH = join(
  repositoryRoot,
  'openapi',
  'solved-v4.openapi.manifest.json',
);

export const EXPECTED_CONTRACT = Object.freeze({
  pathCount: 79,
  operationCount: 83,
  methods: Object.freeze({
    get: 71,
    post: 7,
    patch: 3,
    delete: 2,
  }),
  access: Object.freeze({
    open: 1,
    app: 2,
    public: 52,
    user: 28,
  }),
  methodAccess: Object.freeze({
    get: Object.freeze({ open: 1, public: 52, user: 18 }),
    post: Object.freeze({ app: 2, user: 5 }),
    patch: Object.freeze({ user: 3 }),
    delete: Object.freeze({ user: 2 }),
  }),
  parameters: Object.freeze({ path: 52, query: 92 }),
  requestBodies: Object.freeze({ json: 7 }),
  responses: Object.freeze({ jsonSchema: 163, bodyless204: 2 }),
  operationIds: 0,
  componentSchemas: 1,
});

const expectedMethods = new Set(Object.keys(EXPECTED_CONTRACT.methods));
const expectedAccessClasses = new Set(Object.keys(EXPECTED_CONTRACT.access));
const standardHttpMethods = new Set([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
]);
const pathItemFields = new Set([
  '$ref',
  'summary',
  'description',
  'parameters',
]);

const credentialPatterns = [
  /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/u,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/u,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/u,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/u,
];
const sensitiveNamePattern =
  /authorization|cookie|credential|password|secret|token/iu;
const sampleKeys = new Set(['default', 'example', 'examples']);

function isJsonObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertJsonObject(value, label) {
  if (!isJsonObject(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
}

function assertExactCounts(actual, expected, label) {
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();

  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(`${label} keys changed`);
  }

  for (const key of expectedKeys) {
    if (actual[key] !== expected[key]) {
      throw new Error(`${label}.${key} changed`);
    }
  }
}

function countParameterSchemas(parameterList, counts) {
  if (!Array.isArray(parameterList)) {
    throw new Error('parameters must be an array');
  }
  for (const parameter of parameterList) {
    assertJsonObject(parameter, 'parameter');
    assertJsonObject(parameter.schema, 'parameter schema');
    if (!Object.hasOwn(counts, parameter.in)) {
      throw new Error('an unexpected parameter location is present');
    }
    counts[parameter.in] += 1;
  }
}

function hasMaterialSample(value) {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.length > 0;
  }
  if (Array.isArray(value)) {
    return value.some(hasMaterialSample);
  }
  if (isJsonObject(value)) {
    return Object.keys(value).length > 0;
  }
  return true;
}

export function assertNoSecretMaterial(document) {
  const serialized = JSON.stringify(document);
  if (credentialPatterns.some((pattern) => pattern.test(serialized))) {
    throw new Error('the OpenAPI document contains credential-like material');
  }

  function visit(value, sensitiveContext = false) {
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item, sensitiveContext);
      }
      return;
    }

    if (!isJsonObject(value)) {
      return;
    }

    for (const [key, item] of Object.entries(value)) {
      const keyIsSensitive = sensitiveNamePattern.test(key);
      if (
        keyIsSensitive &&
        (typeof item === 'string' || typeof item === 'number') &&
        hasMaterialSample(item)
      ) {
        throw new Error('a sensitive field contains material');
      }
      if (
        sensitiveContext &&
        sampleKeys.has(key) &&
        hasMaterialSample(item)
      ) {
        throw new Error('a sensitive field contains sample material');
      }
      visit(item, sensitiveContext || keyIsSensitive);
    }
  }

  visit(document);
}

export function validateOpenApiDocument(document) {
  assertJsonObject(document, 'document');

  if (typeof document.openapi !== 'string' || !/^3\.1(?:\.\d+)?$/u.test(document.openapi)) {
    throw new Error('the document is not OpenAPI 3.1');
  }

  if (
    !Array.isArray(document.servers) ||
    document.servers.length !== 1 ||
    !isJsonObject(document.servers[0]) ||
    document.servers[0].url !== PRODUCTION_SERVER_URL ||
    Object.keys(document.servers[0]).length !== 1
  ) {
    throw new Error('the production server changed');
  }

  assertJsonObject(document.paths, 'paths');
  const pathEntries = Object.entries(document.paths);
  if (pathEntries.length !== EXPECTED_CONTRACT.pathCount) {
    throw new Error('the path count changed');
  }

  const methods = Object.fromEntries(
    Object.keys(EXPECTED_CONTRACT.methods).map((method) => [method, 0]),
  );
  const access = Object.fromEntries(
    Object.keys(EXPECTED_CONTRACT.access).map((accessClass) => [accessClass, 0]),
  );
  const methodAccess = Object.fromEntries(
    Object.keys(EXPECTED_CONTRACT.methods).map((method) => [method, {}]),
  );
  const parameters = { path: 0, query: 0 };
  const requestBodies = { json: 0 };
  const responses = { jsonSchema: 0, bodyless204: 0 };
  let operationCount = 0;
  let operationIds = 0;

  for (const [path, pathItem] of pathEntries) {
    if (!path.startsWith('/api/v4/')) {
      throw new Error('an operation is outside the official v4 namespace');
    }
    assertJsonObject(pathItem, `path item ${path}`);
    if (pathItem.parameters !== undefined) {
      countParameterSchemas(pathItem.parameters, parameters);
    }

    for (const [key, operation] of Object.entries(pathItem)) {
      const method = key.toLowerCase();
      if (!standardHttpMethods.has(method)) {
        if (pathItemFields.has(key) || key.startsWith('x-')) {
          continue;
        }
        throw new Error('an unexpected path item field is present');
      }
      if (key !== method || !expectedMethods.has(method)) {
        throw new Error('an unexpected HTTP method is present');
      }

      assertJsonObject(operation, `operation ${method} ${path}`);
      if (Object.hasOwn(operation, 'servers')) {
        throw new Error('an operation-level server override is present');
      }
      assertJsonObject(operation['x-access'], `x-access ${method} ${path}`);
      const accessClass = operation['x-access'].class;
      if (
        typeof accessClass !== 'string' ||
        !expectedAccessClasses.has(accessClass)
      ) {
        throw new Error('an operation has an unexpected access class');
      }

      operationCount += 1;
      methods[method] += 1;
      access[accessClass] += 1;
      const crossCount = methodAccess[method];
      crossCount[accessClass] = (crossCount[accessClass] ?? 0) + 1;

      if (Object.hasOwn(operation, 'operationId')) {
        operationIds += 1;
      }

      if (operation.parameters !== undefined) {
        countParameterSchemas(operation.parameters, parameters);
      }

      if (Object.hasOwn(operation, 'requestBody')) {
        assertJsonObject(operation.requestBody, 'request body');
        assertJsonObject(operation.requestBody.content, 'request body content');
        const mediaTypes = Object.keys(operation.requestBody.content);
        if (
          mediaTypes.length !== 1 ||
          mediaTypes[0] !== 'application/json'
        ) {
          throw new Error('an unexpected request body media type is present');
        }
        assertJsonObject(
          operation.requestBody.content['application/json'],
          'JSON request body',
        );
        assertJsonObject(
          operation.requestBody.content['application/json'].schema,
          'JSON request body schema',
        );
        requestBodies.json += 1;
      }

      assertJsonObject(operation.responses, 'responses');
      for (const [status, response] of Object.entries(operation.responses)) {
        assertJsonObject(response, 'response');
        const jsonSchema = response.content?.['application/json']?.schema;
        if (jsonSchema !== undefined) {
          if (
            Object.keys(response.content).length !== 1 ||
            !Object.hasOwn(response.content, 'application/json')
          ) {
            throw new Error('an unexpected response media type is present');
          }
          assertJsonObject(jsonSchema, 'JSON response schema');
          responses.jsonSchema += 1;
        } else if (status === '204' && response.content === undefined) {
          responses.bodyless204 += 1;
        } else {
          throw new Error('an unexpected response body shape is present');
        }
      }
    }
  }

  if (operationCount !== EXPECTED_CONTRACT.operationCount) {
    throw new Error('the operation count changed');
  }
  assertExactCounts(methods, EXPECTED_CONTRACT.methods, 'methods');
  assertExactCounts(access, EXPECTED_CONTRACT.access, 'access');
  for (const method of Object.keys(EXPECTED_CONTRACT.methodAccess)) {
    assertExactCounts(
      methodAccess[method],
      EXPECTED_CONTRACT.methodAccess[method],
      `methodAccess.${method}`,
    );
  }
  assertExactCounts(parameters, EXPECTED_CONTRACT.parameters, 'parameters');
  assertExactCounts(
    requestBodies,
    EXPECTED_CONTRACT.requestBodies,
    'requestBodies',
  );
  assertExactCounts(responses, EXPECTED_CONTRACT.responses, 'responses');
  if (operationIds !== EXPECTED_CONTRACT.operationIds) {
    throw new Error('the operationId count changed');
  }

  assertJsonObject(document.components, 'components');
  assertJsonObject(document.components.schemas, 'component schemas');
  const componentSchemas = Object.keys(document.components.schemas).length;
  if (componentSchemas !== EXPECTED_CONTRACT.componentSchemas) {
    throw new Error('the component schema count changed');
  }

  assertNoSecretMaterial(document);

  return {
    pathCount: pathEntries.length,
    operationCount,
    methods,
    access,
    methodAccess,
    parameters,
    requestBodies,
    responses,
    operationIds,
    componentSchemas,
  };
}

function sortJson(value) {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (!isJsonObject(value)) {
    return value;
  }

  const result = Object.create(null);
  for (const key of Object.keys(value).sort()) {
    result[key] = sortJson(value[key]);
  }
  return result;
}

export function canonicalJson(value) {
  return `${JSON.stringify(sortJson(value), null, 2)}\n`;
}

export function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

export function createOfficialRequestInit() {
  return {
    method: 'GET',
    headers: { accept: 'application/json' },
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  };
}

export function validateJsonContentType(contentType) {
  if (typeof contentType !== 'string') {
    throw new Error('the response has no content type');
  }
  const mediaType = contentType.split(';', 1)[0].trim().toLowerCase();
  if (mediaType !== 'application/json' && !mediaType.endsWith('+json')) {
    throw new Error('the response is not JSON');
  }
}

export async function readLimitedResponseBody(response) {
  const declaredLength = response.headers.get('content-length');
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (
      !Number.isSafeInteger(parsedLength) ||
      parsedLength < 0 ||
      parsedLength > MAX_OPENAPI_BYTES
    ) {
      throw new Error('the response size is invalid');
    }
  }

  if (response.body === null) {
    throw new Error('the response has no body');
  }

  const chunks = [];
  let totalBytes = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      totalBytes += value.byteLength;
      if (totalBytes > MAX_OPENAPI_BYTES) {
        await reader.cancel();
        throw new Error('the response is too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, totalBytes);
}

export function parseJsonBuffer(buffer) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  return JSON.parse(text);
}

export function createManifest(sourceBytes, snapshotBytes) {
  return {
    sourceUrl: OFFICIAL_OPENAPI_URL,
    sourceBytes: sourceBytes.byteLength,
    sourceSha256: sha256(sourceBytes),
    snapshotBytes: snapshotBytes.byteLength,
    snapshotSha256: sha256(snapshotBytes),
  };
}

export async function writeFileAtomically(path, data) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  let temporaryFileExists = false;

  try {
    await writeFile(temporaryPath, data, { flag: 'wx', mode: 0o644 });
    temporaryFileExists = true;
    await rename(temporaryPath, path);
    temporaryFileExists = false;
  } finally {
    if (temporaryFileExists) {
      await rm(temporaryPath, { force: true });
    }
  }
}

export function checkSnapshotBytes(snapshotBytes, manifestBytes) {
  if (snapshotBytes.byteLength > MAX_OPENAPI_BYTES) {
    throw new Error('the snapshot is too large');
  }

  const document = parseJsonBuffer(snapshotBytes);
  const metrics = validateOpenApiDocument(document);
  const canonicalSnapshot = canonicalJson(document);
  if (!snapshotBytes.equals(Buffer.from(canonicalSnapshot, 'utf8'))) {
    throw new Error('the snapshot is not canonical');
  }

  const manifest = parseJsonBuffer(manifestBytes);
  assertJsonObject(manifest, 'manifest');
  if (
    JSON.stringify(Object.keys(manifest).sort()) !==
    JSON.stringify([
      'snapshotBytes',
      'snapshotSha256',
      'sourceBytes',
      'sourceSha256',
      'sourceUrl',
    ])
  ) {
    throw new Error('the manifest shape changed');
  }
  if (manifest.sourceUrl !== OFFICIAL_OPENAPI_URL) {
    throw new Error('the source URL changed');
  }
  if (
    !Number.isSafeInteger(manifest.sourceBytes) ||
    manifest.sourceBytes <= 0 ||
    manifest.sourceBytes > MAX_OPENAPI_BYTES ||
    !/^[a-f0-9]{64}$/u.test(manifest.sourceSha256)
  ) {
    throw new Error('the source provenance is invalid');
  }
  if (manifest.snapshotBytes !== snapshotBytes.byteLength) {
    throw new Error('the snapshot byte count does not match');
  }
  if (
    !/^[a-f0-9]{64}$/u.test(manifest.snapshotSha256) ||
    manifest.snapshotSha256 !== sha256(snapshotBytes)
  ) {
    throw new Error('the snapshot checksum does not match');
  }
  if (!manifestBytes.equals(Buffer.from(canonicalJson(manifest), 'utf8'))) {
    throw new Error('the manifest is not canonical');
  }

  return { manifest, metrics };
}

export async function checkSnapshot() {
  const [snapshotBytes, manifestBytes] = await Promise.all([
    readFile(SNAPSHOT_PATH),
    readFile(MANIFEST_PATH),
  ]);
  return checkSnapshotBytes(snapshotBytes, manifestBytes);
}
