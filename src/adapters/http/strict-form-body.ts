import type { JsonValue } from '../../domain/request-json-schema.js';

function startsWithUtf8Bom(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  );
}

function decodeComponent(value: string): string | undefined {
  try {
    return decodeURIComponent(value.replace(/\+/gu, ' '));
  } catch {
    return undefined;
  }
}

/** Strict application/x-www-form-urlencoded parser with no key aliases. */
export function parseStrictFormBody(
  bytes: Uint8Array,
): JsonValue | undefined {
  if (bytes.byteLength === 0 || startsWithUtf8Bom(bytes)) {
    return undefined;
  }

  let source: string;
  try {
    source = new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
  } catch {
    return undefined;
  }
  if (source.length === 0 || source.charCodeAt(0) === 0xfeff) {
    return undefined;
  }

  const result = Object.create(null) as Record<string, string>;
  const names = new Set<string>();
  for (const component of source.split('&')) {
    if (component.length === 0) {
      return undefined;
    }
    const separator = component.indexOf('=');
    if (separator === -1) {
      return undefined;
    }
    const encodedName = component.slice(0, separator);
    const encodedValue = component.slice(separator + 1);
    const name = decodeComponent(encodedName);
    const value = decodeComponent(encodedValue);
    if (
      name === undefined ||
      name.length === 0 ||
      value === undefined ||
      names.has(name)
    ) {
      return undefined;
    }
    names.add(name);
    result[name] = value;
  }
  return Object.freeze(result);
}
