import assert from 'node:assert/strict';
import test from 'node:test';

import { validateJsonValue } from '../src/domain/request-json-schema.js';
import type { V4RequestSchema } from '../src/domain/v4-operation-contract.js';
import { V4_OPERATION_MANIFEST } from '../src/generated/v4-operations.js';

const mutationBodyFixtures = [
  {
    key: 'PATCH /api/v4/account/bookmarks/{slug}',
    valid: [
      {},
      {
        color: null,
        description: '',
        name: '새 북마크',
        slug: 'dynamic_programming',
        visibility: 'unlisted',
      },
    ],
    invalid: [
      { unknown: true },
      { color: 'green' },
      { name: '' },
      { slug: 'UPPERCASE' },
      { description: 'x'.repeat(2_049) },
    ],
  },
  {
    key: 'PATCH /api/v4/account/bookmarks/{slug}/problems/{problemId}',
    valid: [{}, { after: 1, before: null, note: null }],
    invalid: [
      { after: 0 },
      { before: 0 },
      { note: 'x'.repeat(2_049) },
      { after: 1.5 },
      { extra: 1 },
    ],
  },
  {
    key: 'PATCH /api/v4/account/settings',
    valid: [
      {},
      {
        alwaysShowUnrated: true,
        iconTheme: null,
        iconWarnAbsolute: 30,
        iconWarnRelative: -30,
        problemSort: 'average_try',
        theme: 'system',
      },
    ],
    invalid: [
      { iconWarnAbsolute: 31 },
      { iconWarnRelative: -31 },
      { theme: 'sepia' },
      { alwaysShowUnrated: 'true' },
      { extra: false },
    ],
  },
  {
    key: 'POST /api/v4/account/bookmarks',
    valid: [
      { name: 'Algorithms', slug: 'algorithms' },
      {
        color: 'blue',
        description: '',
        name: 'Algorithms',
        slug: 'algorithms',
        visibility: 'private',
      },
    ],
    invalid: [
      {},
      { name: 'Algorithms' },
      { name: '', slug: 'algorithms' },
      { name: 'Algorithms', slug: 'bad-slug' },
      { name: 'Algorithms', slug: 'algorithms', extra: true },
    ],
  },
  {
    key: 'POST /api/v4/account/bookmarks/order',
    valid: [{ slugs: ['algorithms'] }, { slugs: ['a', 'b', 'c'] }],
    invalid: [
      {},
      { slugs: [] },
      { slugs: Array.from({ length: 21 }, (_, index) => `s${index}`) },
      { slugs: ['bad-slug'] },
      { slugs: [1] },
    ],
  },
  {
    key: 'POST /api/v4/account/bookmarks/{slug}/problems',
    valid: [{ problemIds: [1] }, { problemIds: [1, 1_000_000] }],
    invalid: [
      {},
      { problemIds: [] },
      { problemIds: [0] },
      { problemIds: [1.5] },
      { problemIds: Array.from({ length: 101 }, (_, index) => index + 1) },
    ],
  },
  {
    key: 'POST /api/v4/account/bookmarks/{slug}/problems/remove',
    valid: [{ problemIds: [1] }, { problemIds: [1, 2, 3] }],
    invalid: [
      {},
      { problemIds: [] },
      { problemIds: [-1] },
      { problemIds: [Number.MAX_SAFE_INTEGER + 1] },
      { problemIds: ['1000'] },
    ],
  },
] as const;

test('fixtures cover exactly all seven official mutation body schemas', () => {
  const bodyOperationKeys = Object.entries(V4_OPERATION_MANIFEST)
    .filter(
      ([, operation]) => operation.requestBody?.source === 'openapi',
    )
    .map(([key]) => key)
    .sort();
  assert.deepEqual(
    mutationBodyFixtures.map(({ key }) => key).sort(),
    bodyOperationKeys,
  );
});

test('validates the reviewed OAuth supplement body contracts', () => {
  const token = V4_OPERATION_MANIFEST['POST /api/v4/oauth/token'].requestBody;
  const revoke = V4_OPERATION_MANIFEST['POST /api/v4/oauth/revoke'].requestBody;
  assert.equal(token?.source, 'gateway-supplement');
  assert.equal(revoke?.source, 'gateway-supplement');
  if (token === null || revoke === null) {
    throw new Error('missing OAuth supplement body');
  }

  const verifier = 'A'.repeat(43);
  for (const value of [
    {
      grant_type: 'authorization_code',
      code: 'opaque-code',
      redirect_uri: 'my.solved://oauth/callback?exact=yes',
      code_verifier: verifier,
    },
    {
      grant_type: 'authorization_code',
      code: 'opaque-code',
      redirect_uri: 'my.solved://oauth/callback',
      code_verifier: '~'.repeat(128),
    },
    {
      grant_type: 'refresh_token',
      refresh_token: 'opaque-refresh-token',
    },
    {
      grant_type: 'refresh_token',
      refresh_token: 'opaque-refresh-token',
      scope: 'profile offline.access',
    },
  ]) {
    assert.equal(validateJsonValue(value, token.schema), true);
  }
  for (const value of [
    {},
    { grant_type: 'authorization_code' },
    {
      grant_type: 'authorization_code',
      code: 'opaque-code',
      redirect_uri: 'my.solved://oauth/callback',
      code_verifier: 'A'.repeat(42),
    },
    {
      grant_type: 'authorization_code',
      code: 'opaque-code',
      redirect_uri: 'my.solved://oauth/callback',
      code_verifier: 'A'.repeat(129),
    },
    {
      grant_type: 'authorization_code',
      code: 'opaque-code',
      redirect_uri: 'my.solved://oauth/callback',
      code_verifier: `${'A'.repeat(42)}!`,
    },
    {
      grant_type: 'refresh_token',
      refresh_token: 'opaque-refresh-token',
      code: 'cross-variant-field',
    },
    {
      grant_type: 'refresh_token',
      refresh_token: 'opaque-refresh-token',
      scope: 'profile  offline.access',
    },
    {
      grant_type: 'refresh_token',
      refresh_token: 'opaque-refresh-token',
      scope: ' profile',
    },
    {
      grant_type: 'refresh_token',
      refresh_token: 'opaque-refresh-token',
      scope: 'profile ',
    },
    {
      grant_type: 'refresh_token',
      refresh_token: 'opaque-refresh-token',
      scope: 'pro"file',
    },
    {
      grant_type: 'refresh_token',
      refresh_token: 'opaque-refresh-token',
      scope: 'pro\\file',
    },
    {
      grant_type: 'refresh_token',
      refresh_token: '',
    },
  ]) {
    assert.equal(validateJsonValue(value, token.schema), false);
  }

  assert.equal(validateJsonValue({ token: 'opaque-token' }, revoke.schema), true);
  assert.equal(validateJsonValue({}, revoke.schema), false);
  assert.equal(validateJsonValue({ token: '' }, revoke.schema), false);
  assert.equal(
    validateJsonValue(
      { token: 'opaque-token', token_type_hint: 'access_token' },
      revoke.schema,
    ),
    false,
  );
});

for (const fixture of mutationBodyFixtures) {
  test(`validates the generated JSON body contract: ${fixture.key}`, () => {
    const operation = V4_OPERATION_MANIFEST[fixture.key];
    assert.notEqual(operation, undefined);
    assert.notEqual(operation.requestBody, null);
    const schema = operation.requestBody?.schema;
    assert.notEqual(schema, undefined);
    if (schema === undefined) {
      throw new Error('missing request body schema');
    }
    for (const value of fixture.valid) {
      assert.equal(
        validateJsonValue(value, schema),
        true,
        `expected valid: ${JSON.stringify(value)}`,
      );
    }
    for (const value of fixture.invalid) {
      assert.equal(
        validateJsonValue(value, schema),
        false,
        `expected invalid: ${JSON.stringify(value)}`,
      );
    }
  });
}

test('JSON validation handles null, anyOf, Unicode length, and safe integers', () => {
  const nullableEnum: V4RequestSchema = {
    kind: 'string',
    nullable: true,
    enum: ['value', null],
  };
  assert.equal(validateJsonValue(null, nullableEnum), true);
  assert.equal(validateJsonValue('value', nullableEnum), true);
  assert.equal(validateJsonValue('other', nullableEnum), false);

  const nullableButEnumRejectsNull: V4RequestSchema = {
    kind: 'string',
    nullable: true,
    enum: ['value'],
  };
  assert.equal(validateJsonValue(null, nullableButEnumRejectsNull), false);

  const anyOf: V4RequestSchema = {
    kind: 'anyOf',
    nullable: false,
    options: [
      { kind: 'boolean', nullable: false },
      { kind: 'integer', nullable: false, minimum: 1 },
    ],
  };
  assert.equal(validateJsonValue(true, anyOf), true);
  assert.equal(validateJsonValue(1, anyOf), true);
  assert.equal(validateJsonValue(0, anyOf), false);
  assert.equal(validateJsonValue(null, anyOf), false);

  const nullableAnyOf: V4RequestSchema = {
    kind: 'anyOf',
    nullable: false,
    options: [
      { kind: 'string', nullable: true },
      { kind: 'integer', nullable: false },
    ],
  };
  assert.equal(validateJsonValue(null, nullableAnyOf), true);

  const exclusive: V4RequestSchema = {
    kind: 'oneOf',
    nullable: false,
    options: [
      { kind: 'integer', nullable: false, minimum: 0 },
      { kind: 'integer', nullable: false, minimum: 1 },
    ],
  };
  assert.equal(validateJsonValue(0, exclusive), true);
  assert.equal(validateJsonValue(1, exclusive), false);

  const oneCodePoint: V4RequestSchema = {
    kind: 'string',
    nullable: false,
    minLength: 1,
    maxLength: 1,
  };
  assert.equal(validateJsonValue('😀', oneCodePoint), true);
  assert.equal(validateJsonValue('😀a', oneCodePoint), false);

  const integer: V4RequestSchema = { kind: 'integer', nullable: false };
  assert.equal(validateJsonValue(Number.MAX_SAFE_INTEGER, integer), true);
  assert.equal(validateJsonValue(Number.MAX_SAFE_INTEGER + 1, integer), false);
  assert.equal(validateJsonValue(1.5, integer), false);

  const integerEnum: V4RequestSchema = {
    kind: 'integer',
    nullable: false,
    enum: [1, 3],
  };
  assert.equal(validateJsonValue(1, integerEnum), true);
  assert.equal(validateJsonValue(2, integerEnum), false);

  const booleanEnum: V4RequestSchema = {
    kind: 'boolean',
    nullable: false,
    enum: [true],
  };
  assert.equal(validateJsonValue(true, booleanEnum), true);
  assert.equal(validateJsonValue(false, booleanEnum), false);
});

test('JSON validation rejects non-JSON object and array shapes', () => {
  const stringSchema: V4RequestSchema = {
    kind: 'string',
    nullable: false,
  };
  const arraySchema: V4RequestSchema = {
    kind: 'array',
    nullable: false,
    items: stringSchema,
  };
  const sparse = new Array(1);
  assert.equal(validateJsonValue(sparse, arraySchema), false);
  const decorated = ['value'] as string[] & { extra?: boolean };
  decorated.extra = true;
  assert.equal(validateJsonValue(decorated, arraySchema), false);
  const nonPlain = ['value'];
  Object.setPrototypeOf(nonPlain, null);
  assert.equal(validateJsonValue(nonPlain, arraySchema), false);
  const accessorArray = ['value'];
  Object.defineProperty(accessorArray, '0', {
    enumerable: true,
    get: () => {
      throw new Error('must not execute accessors');
    },
  });
  assert.equal(validateJsonValue(accessorArray, arraySchema), false);

  const objectSchema: V4RequestSchema = {
    kind: 'object',
    nullable: false,
    properties: { value: stringSchema },
    required: ['value'],
    unknownProperties: 'reject',
  };
  assert.equal(validateJsonValue({ value: 'ok' }, objectSchema), true);
  assert.equal(
    validateJsonValue({ value: 'ok', extra: true }, objectSchema),
    false,
  );
  assert.equal(validateJsonValue(new Date(), objectSchema), false);
  const accessor = {} as { value?: string };
  Object.defineProperty(accessor, 'value', {
    enumerable: true,
    get: () => {
      throw new Error('must not execute accessors');
    },
  });
  assert.equal(validateJsonValue(accessor, objectSchema), false);
});

test('official object bodies reject root scalars and validation injects no defaults', () => {
  const operation = V4_OPERATION_MANIFEST['POST /api/v4/account/bookmarks'];
  const schema = operation.requestBody?.schema;
  assert.notEqual(schema, undefined);
  if (schema === undefined) {
    throw new Error('missing bookmark request schema');
  }
  for (const value of [null, [], 'value', 1, true]) {
    assert.equal(validateJsonValue(value, schema), false);
  }

  const value = { name: 'Algorithms', slug: 'algorithms' };
  const valueBefore = structuredClone(value);
  const schemaBefore = structuredClone(schema);
  assert.equal(validateJsonValue(value, schema), true);
  assert.deepEqual(value, valueBefore);
  assert.deepEqual(schema, schemaBefore);
  assert.deepEqual(Object.keys(value).sort(), ['name', 'slug']);
});
