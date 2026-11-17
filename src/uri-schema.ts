import type { V4RequestSchema } from './v4-operation-contract.js';

const INVALID_URI_VALUE = /\p{Cc}/u;
const CANONICAL_INTEGER = /^(?:0|-?[1-9]\d*)$/u;
const compiledPatterns = new Map<string, RegExp>();

function patternMatches(value: string, pattern: string): boolean {
  let expression = compiledPatterns.get(pattern);
  if (expression === undefined) {
    expression = new RegExp(pattern, 'u');
    compiledPatterns.set(pattern, expression);
  }
  return expression.test(value);
}

function validateString(
  value: string,
  schema: Extract<V4RequestSchema, { readonly kind: 'string' }>,
): boolean {
  if (schema.nullable && value === 'null') {
    return false;
  }
  const length = [...value].length;
  if (
    (schema.minLength !== undefined && length < schema.minLength) ||
    (schema.maxLength !== undefined && length > schema.maxLength)
  ) {
    return false;
  }
  if (
    schema.enum !== undefined &&
    !schema.enum.some((candidate) => candidate !== null && candidate === value)
  ) {
    return false;
  }
  return schema.pattern === undefined || patternMatches(value, schema.pattern);
}

function validateInteger(
  value: string,
  schema: Extract<V4RequestSchema, { readonly kind: 'integer' }>,
): boolean {
  if (
    (schema.nullable && value === 'null') ||
    !CANONICAL_INTEGER.test(value)
  ) {
    return false;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || String(parsed) !== value) {
    return false;
  }
  if (
    (schema.minimum !== undefined && parsed < schema.minimum) ||
    (schema.maximum !== undefined && parsed > schema.maximum) ||
    (schema.exclusiveMinimum !== undefined &&
      parsed <= schema.exclusiveMinimum)
  ) {
    return false;
  }
  return (
    schema.enum === undefined ||
    schema.enum.some((candidate) => candidate !== null && candidate === parsed)
  );
}

export function validateUriValue(
  value: string,
  schema: V4RequestSchema,
): boolean {
  if (INVALID_URI_VALUE.test(value)) {
    return false;
  }
  switch (schema.kind) {
    case 'string':
      return validateString(value, schema);
    case 'integer':
      return validateInteger(value, schema);
    case 'anyOf':
      return schema.options.some((option) => validateUriValue(value, option));
    case 'boolean':
    case 'array':
    case 'object':
      return false;
  }
}

export function assertUriSchemaSupported(schema: V4RequestSchema): void {
  switch (schema.kind) {
    case 'string':
    case 'integer':
      return;
    case 'anyOf':
      for (const option of schema.options) {
        assertUriSchemaSupported(option);
      }
      return;
    case 'boolean':
    case 'array':
    case 'object':
      throw new Error('URI parameter uses an unsupported schema kind');
  }
}
