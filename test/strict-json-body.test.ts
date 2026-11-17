import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_JSON_NESTING_DEPTH,
  parseAndValidateJsonBody,
} from '../src/adapters/http/strict-json-body.js';
import { validatedJsonRequestBodyBytes } from '../src/domain/validated-json-request-body.js';
import type { V4RequestSchema } from '../src/domain/v4-operation-contract.js';

const encoder = new TextEncoder();
const text = (value: string): Uint8Array => encoder.encode(value);
const stringSchema: V4RequestSchema = { kind: 'string', nullable: false };
const nestedObjectSchema: V4RequestSchema = {
  kind: 'object',
  nullable: false,
  properties: {
    nested: {
      kind: 'object',
      nullable: false,
      properties: { name: stringSchema },
      required: ['name'],
      unknownProperties: 'reject',
    },
  },
  required: ['nested'],
  unknownProperties: 'reject',
};

test('accepts strict UTF-8 JSON and canonicalizes after validation', () => {
  const body = parseAndValidateJsonBody(
    text(' \r\n { "nested" : { "name" : "한글😀" } } \t'),
    nestedObjectSchema,
  );
  assert.notEqual(body, undefined);
  if (body === undefined) throw new Error('missing validated body');
  assert.equal(
    new TextDecoder().decode(validatedJsonRequestBodyBytes(body)),
    '{"nested":{"name":"한글😀"}}',
  );
});

test('rejects invalid UTF-8 and a leading BOM', () => {
  for (const bytes of [
    Uint8Array.of(0xc0, 0xaf),
    Uint8Array.of(0xed, 0xa0, 0x80),
    Uint8Array.of(0xe2, 0x82),
    Uint8Array.of(0xef, 0xbb, 0xbf, 0x22, 0x61, 0x22),
  ]) {
    assert.equal(parseAndValidateJsonBody(bytes, stringSchema), undefined);
  }
  assert.notEqual(
    parseAndValidateJsonBody(text('"before\ufeffafter"'), stringSchema),
    undefined,
  );
});

test('rejects malformed, extended, and trailing JSON grammar', () => {
  const invalid = [
    '', '   \r\n\t', '// comment\n"value"', "'value'",
    '{name:"value"}', '{"name":"value",}', '[1,]',
    '"value" false', '"\\x20"', '"\\u123"', '"raw\ncontrol"',
    '+1', '01', '1.', '1e', 'NaN', 'Infinity', '\u00a0"value"',
  ];
  for (const source of invalid) {
    assert.equal(parseAndValidateJsonBody(text(source), stringSchema), undefined, source);
  }
});

test('rejects decoded duplicate object keys at every nesting level', () => {
  const schema: V4RequestSchema = {
    kind: 'object', nullable: false,
    properties: { name: stringSchema },
    required: ['name'], unknownProperties: 'reject',
  };
  for (const source of [
    '{"name":"a","name":"b"}',
    '{"name":"a","\\u006eame":"b"}',
  ]) {
    assert.equal(parseAndValidateJsonBody(text(source), schema), undefined);
  }
  assert.equal(
    parseAndValidateJsonBody(
      text('{"nested":{"name":"a","\\u006eame":"b"}}'),
      nestedObjectSchema,
    ),
    undefined,
  );

  const slashSchema: V4RequestSchema = {
    kind: 'object', nullable: false,
    properties: { 'a/b': stringSchema },
    required: ['a/b'], unknownProperties: 'reject',
  };
  assert.equal(
    parseAndValidateJsonBody(text('{"a/b":"a","a\\/b":"b"}'), slashSchema),
    undefined,
  );

  const emojiSchema: V4RequestSchema = {
    kind: 'object', nullable: false,
    properties: { '😀': stringSchema },
    required: ['😀'], unknownProperties: 'reject',
  };
  assert.equal(
    parseAndValidateJsonBody(
      text('{"😀":"a","\\ud83d\\ude00":"b"}'),
      emojiSchema,
    ),
    undefined,
  );
});

test('allows equal keys in separate objects and preserves key case', () => {
  const item: V4RequestSchema = {
    kind: 'object', nullable: false,
    properties: { a: stringSchema, A: stringSchema },
    required: ['a', 'A'], unknownProperties: 'reject',
  };
  const schema: V4RequestSchema = {
    kind: 'array', nullable: false, items: item,
  };
  assert.notEqual(
    parseAndValidateJsonBody(
      text('[{"a":"1","A":"2"},{"a":"3","A":"4"}]'),
      schema,
    ),
    undefined,
  );
});

test('accepts the reviewed nesting depth and rejects one level more', () => {
  const recursive = {
    kind: 'anyOf', nullable: false, options: [] as V4RequestSchema[],
  } as V4RequestSchema & { options: V4RequestSchema[] };
  recursive.options.push(
    { kind: 'array', nullable: false, items: recursive },
    { kind: 'integer', nullable: false },
  );
  const nested = (depth: number): string =>
    `${'['.repeat(depth)}1${']'.repeat(depth)}`;
  assert.notEqual(
    parseAndValidateJsonBody(text(nested(MAX_JSON_NESTING_DEPTH)), recursive),
    undefined,
  );
  assert.equal(
    parseAndValidateJsonBody(text(nested(MAX_JSON_NESTING_DEPTH + 1)), recursive),
    undefined,
  );
});
