import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseAndValidateOAuthRequestBody,
} from '../src/adapters/http/oauth-request-body.js';
import { parseStrictFormBody } from '../src/adapters/http/strict-form-body.js';
import {
  createValidatedFormRequestBody,
  validatedFormRequestBodyBytes,
  type ValidatedFormRequestBody,
} from '../src/domain/validated-form-request-body.js';
import type { V4SupplementRequestBodyContract } from '../src/domain/v4-operation-contract.js';
import { V4_OPERATION_MANIFEST } from '../src/generated/v4-operations.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const bytes = (value: string): Uint8Array => encoder.encode(value);
const plain = (value: unknown): unknown =>
  value === null || typeof value !== 'object'
    ? value
    : Object.fromEntries(Object.entries(value));

function supplement(
  key: 'POST /api/v4/oauth/revoke' | 'POST /api/v4/oauth/token',
): V4SupplementRequestBodyContract {
  const contract = V4_OPERATION_MANIFEST[key].requestBody;
  assert.equal(contract?.source, 'gateway-supplement');
  if (contract?.source !== 'gateway-supplement') {
    throw new Error('missing OAuth supplement');
  }
  return contract;
}

const tokenContract = supplement('POST /api/v4/oauth/token');
const revokeContract = supplement('POST /api/v4/oauth/revoke');

test('parses strict form components with plus-space and percent decoding', () => {
  const parsed = parseStrictFormBody(
    bytes(
      'grant_type=refresh_token&refresh_token=a+b%2Bc&scope=profile+offline.access',
    ),
  );
  assert.deepEqual(plain(parsed), {
    grant_type: 'refresh_token',
    refresh_token: 'a b+c',
    scope: 'profile offline.access',
  });
  assert.equal(Object.getPrototypeOf(parsed as object), null);
  assert.equal(Object.isFrozen(parsed), true);
});

test('rejects malformed UTF-8, percent escapes, components, and names', () => {
  const invalidBytes = [
    new Uint8Array(),
    Uint8Array.of(0xff),
    Uint8Array.of(0xc0, 0xaf),
    Uint8Array.of(0xe2, 0x82),
    Uint8Array.of(0xef, 0xbb, 0xbf, 0x61, 0x3d, 0x62),
  ];
  for (const value of invalidBytes) {
    assert.equal(parseStrictFormBody(value), undefined);
  }

  for (const source of [
    'name',
    '=value',
    '&name=value',
    'name=value&',
    'name=value&&other=value',
    'name=%',
    'name=%0',
    'name=%GG',
    'name=%FF',
    'name=%C0%AF',
    'name=%E2%82',
    'name=value&name=other',
    'grant_type=x&grant%5Ftype=y',
    'a+b=x&a%20b=y',
  ]) {
    assert.equal(parseStrictFormBody(bytes(source)), undefined, source);
  }
});

test('supplement validation rejects unknown and cross-variant form fields', () => {
  for (const source of [
    'token=value&token_type_hint=access_token',
    'grant_type=refresh_token&refresh_token=value&code=other',
    'grant_type=authorization_code&code=x&redirect_uri=app%3A%2F%2Fcb&code_verifier=short',
    'grant_type=refresh_token&refresh_token=value&scope=profile++email',
    'grant_type=refresh_token&refresh_token=',
  ]) {
    const contract = source.startsWith('token=')
      ? revokeContract
      : tokenContract;
    assert.equal(
      parseAndValidateOAuthRequestBody(bytes(source), 'form', contract),
      undefined,
      source,
    );
  }
});

test('JSON OAuth values reject every lone surrogate instead of replacing it', () => {
  for (const escaped of ['\\ud800x', 'x\\ud800', 'x\\ud800y', 'x\\udc00y']) {
    const source =
      `{"grant_type":"refresh_token","refresh_token":"${escaped}"}`;
    assert.equal(
      parseAndValidateOAuthRequestBody(bytes(source), 'json', tokenContract),
      undefined,
      escaped,
    );
  }
  assert.notEqual(
    parseAndValidateOAuthRequestBody(
      bytes('{"grant_type":"refresh_token","refresh_token":"x\\ud83d\\ude00"}'),
      'json',
      tokenContract,
    ),
    undefined,
  );
});

test('JSON and form inputs canonicalize to identical deterministic form bytes', () => {
  const json = parseAndValidateOAuthRequestBody(
    bytes(
      '{"scope":"profile offline.access","refresh_token":"a +/한글~!","grant_type":"refresh_token"}',
    ),
    'json',
    tokenContract,
  );
  const form = parseAndValidateOAuthRequestBody(
    bytes(
      'scope=profile+offline.access&grant_type=refresh_token&refresh_token=a+%2B%2F%ED%95%9C%EA%B8%80%7E%21',
    ),
    'form',
    tokenContract,
  );
  assert.notEqual(json, undefined);
  assert.notEqual(form, undefined);
  if (json === undefined || form === undefined) {
    throw new Error('missing validated OAuth body');
  }
  const expected =
    'grant_type=refresh_token&refresh_token=a+%2B%2F%ED%95%9C%EA%B8%80%7E%21&scope=profile+offline.access';
  assert.equal(decoder.decode(validatedFormRequestBodyBytes(json)), expected);
  assert.equal(decoder.decode(validatedFormRequestBodyBytes(form)), expected);

  const first = validatedFormRequestBodyBytes(form);
  first.fill(0);
  assert.equal(decoder.decode(validatedFormRequestBodyBytes(form)), expected);
});

test('opaque form bodies fail closed for invalid shapes and forged values', () => {
  const numericSchema = {
    kind: 'object',
    nullable: false,
    properties: { value: { kind: 'integer', nullable: false } },
    required: ['value'],
    unknownProperties: 'reject',
  } as const;
  assert.equal(
    createValidatedFormRequestBody({ value: 1 }, numericSchema),
    undefined,
  );

  if (false) {
    // @ts-expect-error The opaque brand cannot be constructed by callers.
    const invalid: ValidatedFormRequestBody = {};
    void invalid;
  }
  assert.throws(
    () => validatedFormRequestBodyBytes({} as ValidatedFormRequestBody),
    /Invalid validated form request body/u,
  );
});
