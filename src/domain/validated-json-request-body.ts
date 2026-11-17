import {
  validateJsonValue,
  type JsonValue,
} from './request-json-schema.js';
import type { V4RequestSchema } from './v4-operation-contract.js';

declare const validatedJsonRequestBodyBrand: unique symbol;

/** Opaque, immutable JSON bytes which passed an official request schema. */
export interface ValidatedJsonRequestBody {
  readonly [validatedJsonRequestBodyBrand]: true;
}

const encodedBodies = new WeakMap<ValidatedJsonRequestBody, Uint8Array>();
const encoder = new TextEncoder();

export function createValidatedJsonRequestBody(
  value: JsonValue,
  schema: V4RequestSchema,
): ValidatedJsonRequestBody | undefined {
  if (!validateJsonValue(value, schema)) {
    return undefined;
  }

  // Canonicalize only after validation, then keep the bytes module-private.
  const encoded = encoder.encode(JSON.stringify(value));
  const body = Object.freeze(
    Object.create(null) as ValidatedJsonRequestBody,
  );
  encodedBodies.set(body, encoded);
  return body;
}

export function validatedJsonRequestBodyBytes(
  body: ValidatedJsonRequestBody,
): Uint8Array {
  const bytes = encodedBodies.get(body);
  if (bytes === undefined) {
    throw new TypeError('Invalid validated JSON request body');
  }
  return bytes.slice();
}
