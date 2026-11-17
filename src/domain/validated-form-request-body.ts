import {
  validateJsonValue,
  type JsonValue,
} from './request-json-schema.js';
import type { V4RequestSchema } from './v4-operation-contract.js';

declare const validatedFormRequestBodyBrand: unique symbol;

/** Opaque, immutable form bytes which passed a reviewed request schema. */
export interface ValidatedFormRequestBody {
  readonly [validatedFormRequestBodyBrand]: true;
}

const encodedBodies = new WeakMap<ValidatedFormRequestBody, Uint8Array>();
const encoder = new TextEncoder();

function hasOnlyUnicodeScalars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const current = value.charCodeAt(index);
    if (current >= 0xd800 && current <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (
        index + 1 >= value.length ||
        next < 0xdc00 ||
        next > 0xdfff
      ) {
        return false;
      }
      index += 1;
    } else if (current >= 0xdc00 && current <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function encodeFormComponent(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/gu, '+')
    .replace(/[!'()~]/gu, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
}

function formEntries(
  value: JsonValue,
): readonly (readonly [string, string])[] | undefined {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    return undefined;
  }

  const entries: [string, string][] = [];
  for (const key of Object.keys(value).sort()) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !Object.hasOwn(descriptor, 'value') ||
      typeof descriptor.value !== 'string' ||
      !hasOnlyUnicodeScalars(key) ||
      !hasOnlyUnicodeScalars(descriptor.value)
    ) {
      return undefined;
    }
    entries.push([key, descriptor.value]);
  }
  return entries;
}

export function createValidatedFormRequestBody(
  value: JsonValue,
  schema: V4RequestSchema,
): ValidatedFormRequestBody | undefined {
  if (!validateJsonValue(value, schema)) {
    return undefined;
  }
  const entries = formEntries(value);
  if (entries === undefined) {
    return undefined;
  }

  const encoded = encoder.encode(
    entries
      .map(([key, item]) =>
        `${encodeFormComponent(key)}=${encodeFormComponent(item)}`,
      )
      .join('&'),
  );
  const body = Object.freeze(
    Object.create(null) as ValidatedFormRequestBody,
  );
  encodedBodies.set(body, encoded);
  return body;
}

export function validatedFormRequestBodyBytes(
  body: ValidatedFormRequestBody,
): Uint8Array {
  const bytes = encodedBodies.get(body);
  if (bytes === undefined) {
    throw new TypeError('Invalid validated form request body');
  }
  return bytes.slice();
}
