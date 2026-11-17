import { matchesSchemaPattern } from './schema-pattern.js';
import type {
  V4ArraySchema,
  V4BooleanSchema,
  V4IntegerSchema,
  V4ObjectSchema,
  V4RequestSchema,
  V4StringSchema,
} from './v4-operation-contract.js';

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

function unsupportedSchema(_schema: never): false {
  return false;
}

function nullableEnumAllowsNull(schema: V4RequestSchema): boolean {
  if (!schema.nullable) {
    return false;
  }
  switch (schema.kind) {
    case 'string':
    case 'integer':
    case 'boolean':
      return schema.enum === undefined || schema.enum.includes(null);
    case 'array':
    case 'object':
    case 'anyOf':
      return true;
  }
  return unsupportedSchema(schema);
}

function validateString(value: string, schema: V4StringSchema): boolean {
  const length = [...value].length;
  return (
    (schema.minLength === undefined || length >= schema.minLength) &&
    (schema.maxLength === undefined || length <= schema.maxLength) &&
    (schema.enum === undefined || schema.enum.includes(value)) &&
    (schema.pattern === undefined ||
      matchesSchemaPattern(value, schema.pattern))
  );
}

function validateInteger(value: number, schema: V4IntegerSchema): boolean {
  return (
    Number.isSafeInteger(value) &&
    (schema.minimum === undefined || value >= schema.minimum) &&
    (schema.maximum === undefined || value <= schema.maximum) &&
    (schema.exclusiveMinimum === undefined ||
      value > schema.exclusiveMinimum) &&
    (schema.enum === undefined || schema.enum.includes(value))
  );
}

function validateBoolean(value: boolean, schema: V4BooleanSchema): boolean {
  return schema.enum === undefined || schema.enum.includes(value);
}

function validateArray(
  value: readonly unknown[],
  schema: V4ArraySchema,
): boolean {
  if (
    Object.getPrototypeOf(value) !== Array.prototype ||
    (schema.minItems !== undefined && value.length < schema.minItems) ||
    (schema.maxItems !== undefined && value.length > schema.maxItems)
  ) {
    return false;
  }
  for (const key of Reflect.ownKeys(value)) {
    if (key === 'length') {
      continue;
    }
    if (
      typeof key !== 'string' ||
      !/^(?:0|[1-9]\d*)$/u.test(key) ||
      Number(key) >= value.length
    ) {
      return false;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !Object.hasOwn(descriptor, 'value')
    ) {
      return false;
    }
  }
  for (let index = 0; index < value.length; index += 1) {
    if (
      !Object.hasOwn(value, index) ||
      !validateJsonValue(value[index], schema.items)
    ) {
      return false;
    }
  }
  return true;
}

function isPlainJsonObject(
  value: object,
): value is Readonly<Record<string, unknown>> {
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function validateObject(value: object, schema: V4ObjectSchema): boolean {
  if (!isPlainJsonObject(value)) {
    return false;
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== 'string')) {
    return false;
  }
  const keys = ownKeys as string[];
  if (
    keys.some((key) => !Object.hasOwn(schema.properties, key)) ||
    schema.required.some((key) => !Object.hasOwn(value, key))
  ) {
    return false;
  }
  for (const key of keys) {
    const propertySchema = schema.properties[key];
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      propertySchema === undefined ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      !Object.hasOwn(descriptor, 'value') ||
      !validateJsonValue(descriptor.value, propertySchema)
    ) {
      return false;
    }
  }
  return true;
}

export function validateJsonValue(
  value: unknown,
  schema: V4RequestSchema,
): value is JsonValue {
  if (value === null) {
    if (schema.kind === 'anyOf') {
      return (
        schema.nullable ||
        schema.options.some((option) => validateJsonValue(null, option))
      );
    }
    return nullableEnumAllowsNull(schema);
  }
  switch (schema.kind) {
    case 'string':
      return typeof value === 'string' && validateString(value, schema);
    case 'integer':
      return typeof value === 'number' && validateInteger(value, schema);
    case 'boolean':
      return typeof value === 'boolean' && validateBoolean(value, schema);
    case 'array':
      return Array.isArray(value) && validateArray(value, schema);
    case 'object':
      return typeof value === 'object' && validateObject(value, schema);
    case 'anyOf':
      return schema.options.some((option) => validateJsonValue(value, option));
  }
  return unsupportedSchema(schema);
}
