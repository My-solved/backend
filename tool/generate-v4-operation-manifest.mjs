import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  MANIFEST_PATH,
  SNAPSHOT_PATH,
  checkSnapshotBytes,
  parseJsonBuffer,
  validateOpenApiDocument,
  writeFileAtomically,
} from './openapi-contract.mjs';

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export const GATEWAY_OVERRIDES_PATH = join(
  repositoryRoot,
  'openapi',
  'solved-v4.gateway-overrides.json',
);
export const REQUEST_SUPPLEMENTS_PATH = join(
  repositoryRoot,
  'openapi',
  'solved-v4.request-supplements.json',
);
export const OPERATION_MANIFEST_PATH = join(
  repositoryRoot,
  'src',
  'generated',
  'v4-operations.ts',
);

const supportedMethods = Object.freeze(['get', 'post', 'patch', 'delete']);
const expectedSnapshotSha256 =
  '98177dc4232bcd2f59a284235126b22a4881e9772d3501dd8539cc665b6bbdc1';
const expectedOperationCount = 83;
const expectedPublicOpenGetCount = 53;
const expectedBearerPolicyCounts = Object.freeze({
  none: 51,
  optional: 4,
  required: 28,
});
const expectedGetBearerPolicyCounts = Object.freeze({
  none: 49,
  optional: 4,
  required: 18,
});
const expectedOAuthSupplements = Object.freeze({
  'POST /api/v4/oauth/revoke': Object.freeze({
    supplement: 'oauth-revoke',
    sourceDescriptionSha256:
      '15ed35b8d2cca48237a743a65e2db8aba2966ac89dc5ea8df9de4917761d95e1',
    mediaTypes: Object.freeze(['application/x-www-form-urlencoded']),
  }),
  'POST /api/v4/oauth/token': Object.freeze({
    supplement: 'oauth-token',
    sourceDescriptionSha256:
      '23370b8ad7f346040583efa6d933c5b3d9cbb5df87f7de2e71ff072065fd4201',
    mediaTypes: Object.freeze([
      'application/json',
      'application/x-www-form-urlencoded',
    ]),
  }),
});
const expectedOAuthSecurity = Object.freeze({
  browserCors: 'exact-origin',
  responseCache: 'no-store',
  responsePragma: 'no-cache',
  forwardEtag: false,
  upstreamAttempts: 1,
  appAuthentication: 'server-owned-x-client-headers',
  callerAuthorization: 'reject',
});

const allowedPatterns = new Set([
  '^[0-9a-z_]{1,32}$',
  '^\\d{4}-(0[1-9]|1[0-2])$',
  '^[a-z0-9]+(?:-[a-z0-9]+)*$',
  '^(v\\d{1,3}|beta)$',
  '^\\d{8}$',
  '^[a-z0-9]+(?:-[a-z0-9]+)*(?:\\/[a-z0-9]+(?:-[a-z0-9]+)*)*$',
  '^\\d{4}-\\d{2}-\\d{2}$',
  '^[A-Za-z0-9._~-]{43,128}$',
  '^[\\x21\\x23-\\x5B\\x5D-\\x7E]+(?: [\\x21\\x23-\\x5B\\x5D-\\x7E]+)*$',
]);

const allowedSchemaKeys = Object.freeze({
  string: new Set([
    'type',
    'enum',
    'default',
    'minLength',
    'maxLength',
    'pattern',
  ]),
  integer: new Set([
    'type',
    'default',
    'minimum',
    'maximum',
    'exclusiveMinimum',
  ]),
  boolean: new Set(['type']),
  array: new Set(['type', 'items', 'minItems', 'maxItems']),
  object: new Set([
    'type',
    'properties',
    'required',
    'additionalProperties',
  ]),
  anyOf: new Set(['anyOf']),
  oneOf: new Set(['oneOf']),
});

export const EXPECTED_REQUEST_SCHEMA_METRICS = Object.freeze({
  roots: 151,
  nodes: 199,
  types: Object.freeze({
    string: 121,
    'string|null': 24,
    integer: 33,
    'integer|null': 6,
    'boolean|null': 4,
    array: 3,
    object: 7,
    anyOf: 1,
  }),
  keywords: Object.freeze({
    type: 198,
    enum: 48,
    default: 55,
    minimum: 28,
    maximum: 11,
    exclusiveMinimum: 10,
    minLength: 33,
    maxLength: 68,
    pattern: 22,
    minItems: 3,
    maxItems: 3,
    items: 3,
    properties: 7,
    required: 4,
    additionalProperties: 1,
    anyOf: 1,
  }),
  patterns: Object.freeze({
    '^[0-9a-z_]{1,32}$': 11,
    '^\\d{4}-(0[1-9]|1[0-2])$': 2,
    '^[a-z0-9]+(?:-[a-z0-9]+)*$': 2,
    '^(v\\d{1,3}|beta)$': 1,
    '^\\d{8}$': 1,
    '^[a-z0-9]+(?:-[a-z0-9]+)*(?:\\/[a-z0-9]+(?:-[a-z0-9]+)*)*$': 1,
    '^\\d{4}-\\d{2}-\\d{2}$': 4,
  }),
});

export const EXPECTED_SUPPLEMENT_SCHEMA_METRICS = Object.freeze({
  roots: 2,
  nodes: 12,
  types: Object.freeze({
    oneOf: 1,
    object: 3,
    string: 8,
  }),
  keywords: Object.freeze({
    oneOf: 1,
    type: 11,
    properties: 3,
    required: 3,
    additionalProperties: 3,
    enum: 2,
    minLength: 6,
    maxLength: 1,
    pattern: 2,
  }),
  patterns: Object.freeze({
    '^[A-Za-z0-9._~-]{43,128}$': 1,
    '^[\\x21\\x23-\\x5B\\x5D-\\x7E]+(?: [\\x21\\x23-\\x5B\\x5D-\\x7E]+)*$': 1,
  }),
});

function isJsonObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertJsonObject(value, label) {
  if (!isJsonObject(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
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

function sortJson(value) {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (!isJsonObject(value)) {
    return value;
  }

  const result = Object.create(null);
  for (const key of Object.keys(value).sort(compareText)) {
    result[key] = sortJson(value[key]);
  }
  return result;
}

function stableJson(value) {
  return JSON.stringify(sortJson(value), null, 2);
}

function assertExactKeys(value, expected, label) {
  assertJsonObject(value, label);
  const actual = Object.keys(value).sort(compareText);
  const sortedExpected = [...expected].sort(compareText);
  if (JSON.stringify(actual) !== JSON.stringify(sortedExpected)) {
    throw new Error(`${label} has unexpected fields`);
  }
}

function assertSubsetKeys(value, allowed, label) {
  assertJsonObject(value, label);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${label} uses unsupported schema keyword: ${key}`);
    }
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertSafeInteger(value, label, minimum = Number.MIN_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${label} must be a safe integer`);
  }
}

function assertDeepEqual(actual, expected, label) {
  if (stableJson(actual) !== stableJson(expected)) {
    throw new Error(`${label} no longer matches the reviewed source`);
  }
}

function typeDescriptor(schema) {
  if (Object.hasOwn(schema, 'anyOf')) {
    return { kind: 'anyOf', nullable: false };
  }
  if (Object.hasOwn(schema, 'oneOf')) {
    return { kind: 'oneOf', nullable: false };
  }
  const rawType = schema.type;
  if (typeof rawType === 'string') {
    return { kind: rawType, nullable: false };
  }
  if (
    Array.isArray(rawType) &&
    rawType.length === 2 &&
    typeof rawType[0] === 'string' &&
    rawType[1] === 'null'
  ) {
    return { kind: rawType[0], nullable: true };
  }
  throw new Error('request schema has an unsupported type declaration');
}

function assertScalar(value, kind, nullable, label) {
  if (value === null) {
    if (!nullable) {
      throw new Error(`${label} cannot be null`);
    }
    return;
  }
  if (
    (kind === 'string' && typeof value !== 'string') ||
    (kind === 'integer' && !Number.isSafeInteger(value)) ||
    (kind === 'boolean' && typeof value !== 'boolean')
  ) {
    throw new Error(`${label} does not match its schema type`);
  }
}

function normalizeEnum(schema, kind, nullable) {
  if (!Object.hasOwn(schema, 'enum')) {
    return undefined;
  }
  if (kind !== 'string' || !Array.isArray(schema.enum) || schema.enum.length === 0) {
    throw new Error('only non-empty string enums are supported');
  }
  const seen = new Set();
  for (const value of schema.enum) {
    assertScalar(value, kind, nullable, 'enum value');
    const key = JSON.stringify(value);
    if (seen.has(key)) {
      throw new Error('request schema enum contains a duplicate value');
    }
    seen.add(key);
  }
  return [...schema.enum];
}

function normalizeDefault(schema, kind, nullable) {
  if (!Object.hasOwn(schema, 'default')) {
    return undefined;
  }
  assertScalar(schema.default, kind, nullable, 'schema default');
  return schema.default;
}

function addIfDefined(target, key, value) {
  if (value !== undefined) {
    target[key] = value;
  }
}

export function normalizeRequestSchema(
  schema,
  unknownPropertiesPolicy = 'reject',
) {
  assertJsonObject(schema, 'request schema');
  const { kind, nullable } = typeDescriptor(schema);
  if (!Object.hasOwn(allowedSchemaKeys, kind)) {
    throw new Error(`request schema type is unsupported: ${kind}`);
  }
  assertSubsetKeys(schema, allowedSchemaKeys[kind], 'request schema');

  if (kind === 'anyOf') {
    if (!Array.isArray(schema.anyOf) || schema.anyOf.length !== 2) {
      throw new Error('the reviewed anyOf shape must contain exactly two branches');
    }
    const options = schema.anyOf.map((item) =>
      normalizeRequestSchema(item, unknownPropertiesPolicy),
    );
    if (options.some((item) => item.kind !== 'string' || item.nullable)) {
      throw new Error('the reviewed anyOf shape only allows non-null strings');
    }
    return { kind: 'anyOf', nullable: false, options };
  }

  if (kind === 'oneOf') {
    if (!Array.isArray(schema.oneOf) || schema.oneOf.length !== 2) {
      throw new Error('the reviewed oneOf shape must contain exactly two branches');
    }
    const options = schema.oneOf.map((item) =>
      normalizeRequestSchema(item, unknownPropertiesPolicy),
    );
    if (options.some((item) => item.kind !== 'object' || item.nullable)) {
      throw new Error('the reviewed oneOf shape only allows non-null objects');
    }
    return { kind: 'oneOf', nullable: false, options };
  }

  if (kind === 'string') {
    const result = { kind, nullable };
    addIfDefined(result, 'enum', normalizeEnum(schema, kind, nullable));
    addIfDefined(
      result,
      'annotationDefault',
      normalizeDefault(schema, kind, nullable),
    );
    for (const key of ['minLength', 'maxLength']) {
      if (Object.hasOwn(schema, key)) {
        assertSafeInteger(schema[key], key, 0);
        result[key] = schema[key];
      }
    }
    if (
      result.minLength !== undefined &&
      result.maxLength !== undefined &&
      result.minLength > result.maxLength
    ) {
      throw new Error('request string schema has inverted length bounds');
    }
    if (Object.hasOwn(schema, 'pattern')) {
      if (typeof schema.pattern !== 'string' || !allowedPatterns.has(schema.pattern)) {
        throw new Error('request schema pattern is not reviewed');
      }
      new RegExp(schema.pattern, 'u');
      result.pattern = schema.pattern;
    }
    return result;
  }

  if (kind === 'integer') {
    const result = { kind, nullable };
    addIfDefined(
      result,
      'annotationDefault',
      normalizeDefault(schema, kind, nullable),
    );
    for (const key of ['minimum', 'maximum', 'exclusiveMinimum']) {
      if (Object.hasOwn(schema, key)) {
        assertSafeInteger(schema[key], key);
        result[key] = schema[key];
      }
    }
    if (
      result.minimum !== undefined &&
      result.maximum !== undefined &&
      result.minimum > result.maximum
    ) {
      throw new Error('request integer schema has inverted bounds');
    }
    return result;
  }

  if (kind === 'boolean') {
    return { kind, nullable };
  }

  if (nullable) {
    throw new Error(`${kind} request schemas cannot be nullable`);
  }

  if (kind === 'array') {
    assertJsonObject(schema.items, 'array items');
    const result = {
      kind,
      nullable: false,
      items: normalizeRequestSchema(schema.items, unknownPropertiesPolicy),
    };
    for (const key of ['minItems', 'maxItems']) {
      if (Object.hasOwn(schema, key)) {
        assertSafeInteger(schema[key], key, 0);
        result[key] = schema[key];
      }
    }
    if (
      result.minItems !== undefined &&
      result.maxItems !== undefined &&
      result.minItems > result.maxItems
    ) {
      throw new Error('request array schema has inverted item bounds');
    }
    return result;
  }

  if (kind === 'object') {
    assertJsonObject(schema.properties, 'object properties');
    if (
      Object.hasOwn(schema, 'additionalProperties') &&
      schema.additionalProperties !== false
    ) {
      throw new Error('schema-valued or true additionalProperties is unsupported');
    }
    if (unknownPropertiesPolicy !== 'reject') {
      throw new Error('unknown request properties must fail closed');
    }
    const required = schema.required ?? [];
    if (!Array.isArray(required) || !required.every((item) => typeof item === 'string')) {
      throw new Error('object required must be a string array');
    }
    if (new Set(required).size !== required.length) {
      throw new Error('object required contains duplicates');
    }
    const properties = {};
    for (const name of Object.keys(schema.properties).sort(compareText)) {
      assertNonEmptyString(name, 'property name');
      properties[name] = normalizeRequestSchema(
        schema.properties[name],
        unknownPropertiesPolicy,
      );
    }
    for (const name of required) {
      if (!Object.hasOwn(properties, name)) {
        throw new Error('object required names an unknown property');
      }
    }
    return {
      kind,
      nullable: false,
      properties,
      required: [...required].sort(compareText),
      unknownProperties: 'reject',
    };
  }

  throw new Error(`request schema type is unsupported: ${kind}`);
}

function emptyMetrics() {
  return {
    roots: 0,
    nodes: 0,
    types: {},
    keywords: {},
    patterns: {},
  };
}

function schemaTypeMetric(schema) {
  if (Object.hasOwn(schema, 'anyOf')) {
    return 'anyOf';
  }
  if (Object.hasOwn(schema, 'oneOf')) {
    return 'oneOf';
  }
  return Array.isArray(schema.type) ? schema.type.join('|') : schema.type;
}

function recordSchemaMetrics(schema, metrics, root = false) {
  if (root) {
    metrics.roots += 1;
  }
  metrics.nodes += 1;
  const typeKey = schemaTypeMetric(schema);
  metrics.types[typeKey] = (metrics.types[typeKey] ?? 0) + 1;
  for (const key of Object.keys(schema)) {
    metrics.keywords[key] = (metrics.keywords[key] ?? 0) + 1;
  }
  if (typeof schema.pattern === 'string') {
    metrics.patterns[schema.pattern] = (metrics.patterns[schema.pattern] ?? 0) + 1;
  }
  if (schema.items !== undefined) {
    recordSchemaMetrics(schema.items, metrics);
  }
  if (isJsonObject(schema.properties)) {
    for (const property of Object.values(schema.properties)) {
      recordSchemaMetrics(property, metrics);
    }
  }
  if (Array.isArray(schema.anyOf)) {
    for (const option of schema.anyOf) {
      recordSchemaMetrics(option, metrics);
    }
  }
  if (Array.isArray(schema.oneOf)) {
    for (const option of schema.oneOf) {
      recordSchemaMetrics(option, metrics);
    }
  }
}

function assertExactRecord(actual, expected, label) {
  if (stableJson(actual) !== stableJson(expected)) {
    throw new Error(`${label} changed`);
  }
}

function operationKey(method, path) {
  return `${method.toUpperCase()} ${path}`;
}

function operationIndex(document) {
  const operations = new Map();
  for (const [path, pathItem] of Object.entries(document.paths)) {
    for (const method of supportedMethods) {
      if (Object.hasOwn(pathItem, method)) {
        const key = operationKey(method, path);
        if (operations.has(key)) {
          throw new Error('the OpenAPI document contains duplicate operations');
        }
        operations.set(key, { method, path, pathItem, operation: pathItem[method] });
      }
    }
  }
  return operations;
}

export function validateGatewayOverrides(overrides, document, snapshotSha256) {
  assertExactKeys(
    overrides,
    [
      'version',
      'snapshotSha256',
      'requestObjectUnknownProperties',
      'declaredRequestBodyPolicy',
      'globalResponses',
      'accessClassResponses',
      'operationOverrides',
    ],
    'gateway overrides',
  );
  if (overrides.version !== 1) {
    throw new Error('gateway override version changed');
  }
  if (
    snapshotSha256 !== expectedSnapshotSha256 ||
    overrides.snapshotSha256 !== snapshotSha256
  ) {
    throw new Error('gateway overrides do not match the reviewed snapshot');
  }
  if (overrides.requestObjectUnknownProperties !== 'reject') {
    throw new Error('request object policy must reject unknown properties');
  }
  if (overrides.declaredRequestBodyPolicy !== 'require-when-declared') {
    throw new Error('declared request bodies must be required by gateway policy');
  }

  if (!Array.isArray(overrides.globalResponses) || overrides.globalResponses.length !== 1) {
    throw new Error('exactly one reviewed global response is required');
  }
  const globalResponse = overrides.globalResponses[0];
  assertExactKeys(
    globalResponse,
    ['status', 'mediaTypes', 'requiredHeaders', 'reason'],
    'global response override',
  );
  if (
    globalResponse.status !== '429' ||
    stableJson(globalResponse.mediaTypes) !== stableJson(['application/json']) ||
    stableJson(globalResponse.requiredHeaders) !== stableJson(['retry-after'])
  ) {
    throw new Error('the reviewed global 429 response changed');
  }
  assertNonEmptyString(globalResponse.reason, 'global response reason');

  if (
    !Array.isArray(overrides.accessClassResponses) ||
    overrides.accessClassResponses.length !== 2
  ) {
    throw new Error('the reviewed user access responses changed');
  }
  const accessClassResponses = new Map();
  const accessResponseOrder = [];
  for (const response of overrides.accessClassResponses) {
    assertExactKeys(
      response,
      [
        'accessClass',
        'status',
        'mediaTypes',
        'requiredHeaders',
        'reason',
      ],
      'access-class response override',
    );
    if (
      response.accessClass !== 'user' ||
      !['401', '403'].includes(response.status) ||
      stableJson(response.mediaTypes) !== stableJson(['application/json']) ||
      stableJson(response.requiredHeaders) !== stableJson([])
    ) {
      throw new Error('the reviewed user access response changed');
    }
    assertNonEmptyString(response.reason, 'access response reason');
    const key = `${response.accessClass}:${response.status}`;
    if (accessClassResponses.has(key)) {
      throw new Error('access-class response override is duplicated');
    }
    accessClassResponses.set(key, response);
    accessResponseOrder.push(key);
  }
  if (
    stableJson(accessResponseOrder) !==
    stableJson(['user:401', 'user:403'])
  ) {
    throw new Error('access-class responses must use stable reviewed order');
  }

  if (!Array.isArray(overrides.operationOverrides)) {
    throw new Error('operationOverrides must be an array');
  }
  const operations = operationIndex(document);
  const byOperation = new Map();
  const orderedKeys = [];
  for (const override of overrides.operationOverrides) {
    assertJsonObject(override, 'operation override');
    assertNonEmptyString(override.operation, 'override operation');
    if (!operations.has(override.operation)) {
      throw new Error('operation override targets an unknown operation');
    }
    if (byOperation.has(override.operation)) {
      throw new Error('operation override target is duplicated');
    }
    byOperation.set(override.operation, override);
    orderedKeys.push(override.operation);
  }
  if (stableJson(orderedKeys) !== stableJson([...orderedKeys].sort(compareText))) {
    throw new Error('operation overrides must use stable key order');
  }

  const affiliationKey =
    'GET /api/v4/rankings/affiliations/{affiliationId}';
  const affiliationOverride = byOperation.get(affiliationKey);
  assertExactKeys(
    affiliationOverride,
    ['operation', 'parameterOverrides'],
    'affiliation override',
  );
  if (
    !Array.isArray(affiliationOverride.parameterOverrides) ||
    affiliationOverride.parameterOverrides.length !== 1
  ) {
    throw new Error('affiliation override must contain one parameter override');
  }
  const parameterOverride = affiliationOverride.parameterOverrides[0];
  assertExactKeys(
    parameterOverride,
    ['in', 'name', 'source', 'effective', 'policy', 'reason'],
    'affiliation parameter override',
  );
  if (
    parameterOverride.in !== 'path' ||
    parameterOverride.name !== 'affiliationId' ||
    parameterOverride.policy !== 'required-non-null-path'
  ) {
    throw new Error('affiliation parameter override target changed');
  }
  assertNonEmptyString(parameterOverride.reason, 'affiliation override reason');
  assertExactKeys(
    parameterOverride.source,
    ['required', 'schema'],
    'affiliation source expectation',
  );
  assertExactKeys(
    parameterOverride.effective,
    ['required', 'schema'],
    'affiliation effective policy',
  );
  const affiliationOperation = operations.get(affiliationKey).operation;
  const affiliationParameter = affiliationOperation.parameters.find(
    (parameter) =>
      parameter.in === parameterOverride.in &&
      parameter.name === parameterOverride.name,
  );
  if (affiliationParameter === undefined) {
    throw new Error('affiliation override parameter no longer exists');
  }
  assertDeepEqual(
    {
      required: affiliationParameter.required,
      schema: affiliationParameter.schema,
    },
    parameterOverride.source,
    'affiliation override source',
  );
  assertDeepEqual(
    parameterOverride.effective,
    { required: true, schema: { type: 'integer' } },
    'affiliation effective policy',
  );

  for (const [key, expected] of Object.entries(expectedOAuthSupplements)) {
    const override = byOperation.get(key);
    assertExactKeys(
      override,
      [
        'operation',
        'expectRequestBody',
        'runtimeEnabled',
        'policy',
        'supplement',
        'reason',
      ],
      'OAuth operation override',
    );
    if (
      override.expectRequestBody !== 'absent' ||
      override.runtimeEnabled !== true ||
      override.policy !== 'supplemented' ||
      override.supplement !== expected.supplement ||
      Object.hasOwn(operations.get(key).operation, 'requestBody')
    ) {
      throw new Error('OAuth supplement boundary changed');
    }
    assertNonEmptyString(override.reason, 'OAuth override reason');
  }

  const expectedTargets = [
    affiliationKey,
    ...Object.keys(expectedOAuthSupplements),
  ].sort(
    compareText,
  );
  if (stableJson([...byOperation.keys()].sort(compareText)) !== stableJson(expectedTargets)) {
    throw new Error('gateway override targets changed');
  }

  return {
    byOperation,
    globalResponse,
    accessClassResponses,
    declaredRequestBodyPolicy: overrides.declaredRequestBodyPolicy,
    requestObjectUnknownProperties:
      overrides.requestObjectUnknownProperties,
  };
}

function sha256Text(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function expectedSupplementSchema(supplement) {
  const nonEmptyString = { kind: 'string', nullable: false, minLength: 1 };
  if (supplement === 'oauth-revoke') {
    return {
      kind: 'object',
      nullable: false,
      properties: { token: nonEmptyString },
      required: ['token'],
      unknownProperties: 'reject',
    };
  }
  if (supplement !== 'oauth-token') {
    throw new Error('OAuth supplement name is not reviewed');
  }
  return {
    kind: 'oneOf',
    nullable: false,
    options: [
      {
        kind: 'object',
        nullable: false,
        properties: {
          code: nonEmptyString,
          code_verifier: {
            kind: 'string',
            nullable: false,
            minLength: 43,
            maxLength: 128,
            pattern: '^[A-Za-z0-9._~-]{43,128}$',
          },
          grant_type: {
            kind: 'string',
            nullable: false,
            enum: ['authorization_code'],
          },
          redirect_uri: nonEmptyString,
        },
        required: ['code', 'code_verifier', 'grant_type', 'redirect_uri'],
        unknownProperties: 'reject',
      },
      {
        kind: 'object',
        nullable: false,
        properties: {
          grant_type: {
            kind: 'string',
            nullable: false,
            enum: ['refresh_token'],
          },
          refresh_token: nonEmptyString,
          scope: {
            kind: 'string',
            nullable: false,
            minLength: 1,
            pattern:
              '^[\\x21\\x23-\\x5B\\x5D-\\x7E]+(?: [\\x21\\x23-\\x5B\\x5D-\\x7E]+)*$',
          },
        },
        required: ['grant_type', 'refresh_token'],
        unknownProperties: 'reject',
      },
    ],
  };
}

export function validateRequestSupplements(
  supplements,
  document,
  snapshotSha256,
) {
  assertExactKeys(
    supplements,
    ['version', 'snapshotSha256', 'operations'],
    'request supplements',
  );
  if (supplements.version !== 1) {
    throw new Error('request supplement version changed');
  }
  if (
    snapshotSha256 !== expectedSnapshotSha256 ||
    supplements.snapshotSha256 !== snapshotSha256
  ) {
    throw new Error('request supplements do not match the reviewed snapshot');
  }
  if (!Array.isArray(supplements.operations)) {
    throw new Error('request supplement operations must be an array');
  }

  const expectedKeys = Object.keys(expectedOAuthSupplements).sort(compareText);
  const actualKeys = supplements.operations.map((item) => item?.operation);
  if (stableJson(actualKeys) !== stableJson(expectedKeys)) {
    throw new Error('request supplement operations changed or are not sorted');
  }

  const operations = operationIndex(document);
  const metrics = emptyMetrics();
  const byOperation = new Map();
  for (const item of supplements.operations) {
    assertExactKeys(
      item,
      [
        'operation',
        'supplement',
        'sourceRequestBody',
        'sourceDescriptionSha256',
        'effectiveRequired',
        'mediaTypes',
        'canonicalMediaType',
        'security',
        'schema',
        'provenance',
        'reason',
      ],
      'request supplement operation',
    );
    if (byOperation.has(item.operation)) {
      throw new Error('request supplement operation is duplicated');
    }
    const expected = expectedOAuthSupplements[item.operation];
    const source = operations.get(item.operation);
    if (expected === undefined || source === undefined) {
      throw new Error('request supplement targets an unknown operation');
    }
    if (
      source.method !== 'post' ||
      source.operation['x-access'].class !== 'app' ||
      Object.hasOwn(source.operation, 'requestBody') ||
      item.sourceRequestBody !== 'absent'
    ) {
      throw new Error('request supplement source boundary changed');
    }
    if (
      typeof source.operation.description !== 'string' ||
      sha256Text(source.operation.description) !==
        expected.sourceDescriptionSha256 ||
      item.sourceDescriptionSha256 !== expected.sourceDescriptionSha256
    ) {
      throw new Error('request supplement source description changed');
    }
    if (
      item.supplement !== expected.supplement ||
      item.effectiveRequired !== true ||
      stableJson(item.mediaTypes) !== stableJson(expected.mediaTypes) ||
      item.canonicalMediaType !== 'application/x-www-form-urlencoded' ||
      !item.mediaTypes.includes(item.canonicalMediaType)
    ) {
      throw new Error('request supplement media or body policy changed');
    }
    assertExactKeys(
      item.security,
      Object.keys(expectedOAuthSecurity),
      'request supplement security policy',
    );
    assertDeepEqual(
      item.security,
      expectedOAuthSecurity,
      'request supplement security policy',
    );
    assertNonEmptyString(item.provenance, 'request supplement provenance');
    assertNonEmptyString(item.reason, 'request supplement reason');

    recordSchemaMetrics(item.schema, metrics, true);
    const schema = normalizeRequestSchema(item.schema, 'reject');
    assertDeepEqual(
      schema,
      expectedSupplementSchema(item.supplement),
      'request supplement schema',
    );
    byOperation.set(item.operation, {
      requestBody: {
        source: 'gateway-supplement',
        supplement: item.supplement,
        sourceDescriptionSha256: item.sourceDescriptionSha256,
        effectiveRequired: true,
        mediaTypes: [...item.mediaTypes],
        canonicalMediaType: item.canonicalMediaType,
        schema,
      },
      security: { ...item.security },
    });
  }
  assertExactRecord(
    metrics,
    EXPECTED_SUPPLEMENT_SCHEMA_METRICS,
    'request supplement schema grammar',
  );
  return { byOperation, metrics };
}

function findParameterOverride(operationOverride, location, name) {
  return operationOverride?.parameterOverrides?.find(
    (candidate) => candidate.in === location && candidate.name === name,
  );
}

function normalizeParameters(
  parameters,
  location,
  operationOverride,
  unknownPropertiesPolicy,
  metrics,
) {
  const normalized = [];
  const seen = new Set();
  for (const parameter of parameters) {
    assertExactKeys(
      parameter,
      ['in', 'name', 'required', 'schema'],
      'operation parameter',
    );
    if (parameter.in !== location) {
      continue;
    }
    assertNonEmptyString(parameter.name, 'parameter name');
    if (typeof parameter.required !== 'boolean') {
      throw new Error('parameter required must be boolean');
    }
    if (seen.has(parameter.name)) {
      throw new Error('operation contains a duplicate parameter');
    }
    seen.add(parameter.name);
    recordSchemaMetrics(parameter.schema, metrics, true);

    const override = findParameterOverride(
      operationOverride,
      location,
      parameter.name,
    );
    const effectiveRequired = override?.effective.required ?? parameter.required;
    const effectiveSchema = override?.effective.schema ?? parameter.schema;
    const schema = normalizeRequestSchema(
      effectiveSchema,
      unknownPropertiesPolicy,
    );
    if (schema.kind === 'array' || schema.kind === 'object') {
      throw new Error('array and object parameters need reviewed serialization');
    }
    if (location === 'path' && !effectiveRequired) {
      throw new Error('path parameters must be required after gateway policy');
    }

    const item = {
      name: parameter.name,
      sourceRequired: parameter.required,
      required: effectiveRequired,
      schema,
    };
    if (override !== undefined) {
      item.gatewayOverride = override.policy;
    }
    normalized.push(item);
  }
  return normalized.sort((left, right) => compareText(left.name, right.name));
}

function mergeParameters(pathItem, operation) {
  const merged = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])];
  const seen = new Set();
  for (const parameter of merged) {
    const key = `${parameter.in}:${parameter.name}`;
    if (seen.has(key)) {
      throw new Error('path-item and operation parameters overlap');
    }
    seen.add(key);
  }
  return merged;
}

function assertPathParameters(path, parameters) {
  const placeholders = [...path.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/gu)].map(
    (match) => match[1],
  );
  const names = parameters.map((parameter) => parameter.name);
  if (stableJson(placeholders.sort(compareText)) !== stableJson(names.sort(compareText))) {
    throw new Error('path template and path parameters do not match');
  }
}

function normalizeRequestBody(
  operation,
  unknownPropertiesPolicy,
  declaredRequestBodyPolicy,
  metrics,
) {
  if (!Object.hasOwn(operation, 'requestBody')) {
    return null;
  }
  assertExactKeys(operation.requestBody, ['content'], 'requestBody');
  assertExactKeys(
    operation.requestBody.content,
    ['application/json'],
    'requestBody content',
  );
  const media = operation.requestBody.content['application/json'];
  assertExactKeys(media, ['schema'], 'requestBody media type');
  recordSchemaMetrics(media.schema, metrics, true);
  if (declaredRequestBodyPolicy !== 'require-when-declared') {
    throw new Error('declared request body policy changed');
  }
  return {
    source: 'openapi',
    declaredRequired: false,
    effectiveRequired: true,
    mediaType: 'application/json',
    schema: normalizeRequestSchema(media.schema, unknownPropertiesPolicy),
  };
}

function normalizeResponses(
  operation,
  accessClass,
  globalResponse,
  accessClassResponses,
) {
  const responses = {};
  for (const status of Object.keys(operation.responses).sort(compareText)) {
    if (!/^[1-5][0-9]{2}$/u.test(status)) {
      throw new Error('response status is not a concrete HTTP status');
    }
    const response = operation.responses[status];
    assertExactKeys(
      response,
      response.content === undefined
        ? ['description']
        : ['content', 'description'],
      'operation response',
    );
    assertNonEmptyString(response.description, 'response description');
    if (response.content !== undefined) {
      assertExactKeys(
        response.content,
        ['application/json'],
        'response content',
      );
      assertExactKeys(
        response.content['application/json'],
        ['schema'],
        'response media type',
      );
    }
    const mediaTypes = response.content === undefined
      ? []
      : Object.keys(response.content).sort(compareText);
    if (
      mediaTypes.length > 1 ||
      (mediaTypes.length === 1 && mediaTypes[0] !== 'application/json')
    ) {
      throw new Error('response media type needs review');
    }
    responses[status] = {
      mediaTypes,
      requiredHeaders: [],
      source: 'openapi',
    };
  }
  for (const status of ['401', '403']) {
    const accessResponse = accessClassResponses.get(`${accessClass}:${status}`);
    if (accessResponse === undefined) {
      continue;
    }
    if (Object.hasOwn(responses, status)) {
      if (
        stableJson(responses[status].mediaTypes) !==
          stableJson(accessResponse.mediaTypes) ||
        stableJson(responses[status].requiredHeaders) !==
          stableJson(accessResponse.requiredHeaders)
      ) {
        throw new Error('access response conflicts with the operation response');
      }
      continue;
    }
    responses[status] = {
      mediaTypes: [...accessResponse.mediaTypes],
      requiredHeaders: [...accessResponse.requiredHeaders],
      source: 'access-global',
    };
  }
  if (Object.hasOwn(responses, globalResponse.status)) {
    throw new Error('global response now overlaps an operation response');
  }
  responses[globalResponse.status] = {
    mediaTypes: [...globalResponse.mediaTypes],
    requiredHeaders: [...globalResponse.requiredHeaders],
    source: 'gateway-global',
  };
  return sortJson(responses);
}

function runtimePolicy(operationOverride, requestSupplement) {
  if (operationOverride?.policy === 'supplemented') {
    if (
      operationOverride.runtimeEnabled !== true ||
      requestSupplement === undefined ||
      requestSupplement.requestBody.supplement !== operationOverride.supplement
    ) {
      throw new Error('OAuth runtime boundary lacks its supplement');
    }
    return {
      enabled: true,
      policy: 'supplemented',
      supplement: operationOverride.supplement,
      requiredSecurity: requestSupplement.security,
    };
  }
  if (requestSupplement !== undefined) {
    throw new Error('request supplement is not bound to a supplemented runtime');
  }
  return { enabled: true, policy: 'generated' };
}

function bearerPolicy(access) {
  if (access.class === 'user') {
    return 'required';
  }
  if (access.class === 'public') {
    return access.scope === undefined ? 'none' : 'optional';
  }
  if (access.scope !== undefined) {
    throw new Error('open and app access cannot declare a bearer scope');
  }
  return 'none';
}

export function generateOperationManifest(
  document,
  overrides,
  supplements,
  snapshotSha256,
) {
  const contractMetrics = validateOpenApiDocument(document);
  if (contractMetrics.operationCount !== expectedOperationCount) {
    throw new Error('operation count changed before manifest generation');
  }
  const reviewed = validateGatewayOverrides(
    overrides,
    document,
    snapshotSha256,
  );
  const reviewedSupplements = validateRequestSupplements(
    supplements,
    document,
    snapshotSha256,
  );
  const operations = operationIndex(document);
  const requestMetrics = emptyMetrics();
  const manifest = {};
  let publicOpenGetCount = 0;
  const bearerPolicyCounts = { none: 0, optional: 0, required: 0 };
  const getBearerPolicyCounts = { none: 0, optional: 0, required: 0 };

  for (const key of [...operations.keys()].sort(compareText)) {
    const { method, path, pathItem, operation } = operations.get(key);
    const methodUpper = method.toUpperCase();
    const operationOverride = reviewed.byOperation.get(key);
    const mergedParameters = mergeParameters(pathItem, operation);
    const pathParameters = normalizeParameters(
      mergedParameters,
      'path',
      operationOverride,
      reviewed.requestObjectUnknownProperties,
      requestMetrics,
    );
    const queryParameters = normalizeParameters(
      mergedParameters,
      'query',
      operationOverride,
      reviewed.requestObjectUnknownProperties,
      requestMetrics,
    );
    assertPathParameters(path, pathParameters);
    const sourceRequestBody = normalizeRequestBody(
      operation,
      reviewed.requestObjectUnknownProperties,
      reviewed.declaredRequestBodyPolicy,
      requestMetrics,
    );
    const requestSupplement = reviewedSupplements.byOperation.get(key);
    if (requestSupplement !== undefined && sourceRequestBody !== null) {
      throw new Error('request supplement conflicts with a source request body');
    }
    const requestBody =
      requestSupplement?.requestBody ?? sourceRequestBody;

    const access = { class: operation['x-access'].class };
    if (operation['x-access'].scope !== undefined) {
      access.scope = operation['x-access'].scope;
    }
    access.bearer = bearerPolicy(access);
    bearerPolicyCounts[access.bearer] += 1;
    if (method === 'get') {
      getBearerPolicyCounts[access.bearer] += 1;
    }
    if (
      method === 'get' &&
      (access.class === 'open' || access.class === 'public')
    ) {
      publicOpenGetCount += 1;
    }

    manifest[key] = {
      method: methodUpper,
      upstreamPath: path,
      gatewayPath: path.replace(/^\/api\/v4\//u, '/solved/v4/'),
      access,
      runtime: runtimePolicy(operationOverride, requestSupplement),
      parameters: {
        path: pathParameters,
        query: queryParameters,
      },
      requestBody,
      responses: normalizeResponses(
        operation,
        access.class,
        reviewed.globalResponse,
        reviewed.accessClassResponses,
      ),
    };
  }

  if (Object.keys(manifest).length !== expectedOperationCount) {
    throw new Error('generated manifest operation count changed');
  }
  if (publicOpenGetCount !== expectedPublicOpenGetCount) {
    throw new Error('public/open GET operation count changed');
  }
  assertExactRecord(
    bearerPolicyCounts,
    expectedBearerPolicyCounts,
    'bearer policy distribution',
  );
  assertExactRecord(
    getBearerPolicyCounts,
    expectedGetBearerPolicyCounts,
    'GET bearer policy distribution',
  );
  assertExactRecord(
    requestMetrics,
    EXPECTED_REQUEST_SCHEMA_METRICS,
    'request schema grammar',
  );

  return {
    manifest,
    requestMetrics,
    publicOpenGetCount,
    bearerPolicyCounts,
    getBearerPolicyCounts,
    supplementMetrics: reviewedSupplements.metrics,
  };
}

export function renderOperationManifest(manifest, snapshotSha256) {
  return `/**
 * Generated from the official solved.ac v4 OpenAPI snapshot plus the
 * snapshot-bound reviewed gateway request supplement.
 * Snapshot SHA-256: ${snapshotSha256}
 * Do not edit directly; run npm run openapi:operations:update.
 */
import type { V4OperationManifest } from '../domain/v4-operation-contract.js';

export const V4_OPERATION_SNAPSHOT_SHA256 = ${JSON.stringify(snapshotSha256)} as const;

export const V4_OPERATION_MANIFEST = ${stableJson(manifest)} as const satisfies V4OperationManifest;

export type GeneratedV4OperationKey = keyof typeof V4_OPERATION_MANIFEST;
`;
}

function parseMode(arguments_) {
  if (arguments_.length === 0) {
    return 'update';
  }
  if (arguments_.length === 1 && arguments_[0] === '--check') {
    return 'check';
  }
  throw new Error(
    'usage: node tool/generate-v4-operation-manifest.mjs [--check]',
  );
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
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
  const { manifest: snapshotManifest } = checkSnapshotBytes(
    snapshotBytes,
    snapshotManifestBytes,
  );
  const document = parseJsonBuffer(snapshotBytes);
  const overrides = parseJsonBuffer(overrideBytes);
  const supplements = parseJsonBuffer(supplementBytes);
  const generated = generateOperationManifest(
    document,
    overrides,
    supplements,
    snapshotManifest.snapshotSha256,
  );
  const output = renderOperationManifest(
    generated.manifest,
    snapshotManifest.snapshotSha256,
  );

  if (mode === 'check') {
    const committed = await readFile(OPERATION_MANIFEST_PATH, 'utf8');
    if (committed !== output) {
      throw new Error('generated v4 operation manifest is stale');
    }
    process.stdout.write(
      `Official v4 operation manifest verified: ${expectedOperationCount} operations.\n`,
    );
    return;
  }

  await writeFileAtomically(OPERATION_MANIFEST_PATH, output);
  process.stdout.write(
    `Generated official v4 operation manifest: ${expectedOperationCount} operations.\n`,
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
      `${error instanceof Error ? error.message : 'operation manifest generation failed'}\n`,
    );
    process.exitCode = 1;
  }
}
