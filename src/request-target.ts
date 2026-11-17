export const MAX_REQUEST_TARGET_BYTES = 8_192;

const INVALID_RAW_TARGET = /[\p{Cc}\u0020]/u;
const INVALID_DECODED_COMPONENT = /\p{Cc}/u;
const VALID_PERCENT_ESCAPE = /^[0-9A-Fa-f]{2}$/u;

export interface ParsedRequestTarget {
  readonly url: URL;
  readonly pathname: string;
  readonly decodedPathSegments: readonly string[];
}

function hasValidPercentEncoding(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '%') {
      continue;
    }
    const escape = value.slice(index + 1, index + 3);
    if (escape.length !== 2 || !VALID_PERCENT_ESCAPE.test(escape)) {
      return false;
    }
    index += 2;
  }
  return true;
}

function decodeComponent(
  value: string,
  plusAsSpace: boolean,
): string | undefined {
  if (!hasValidPercentEncoding(value)) {
    return undefined;
  }
  try {
    return decodeURIComponent(plusAsSpace ? value.replaceAll('+', ' ') : value);
  } catch {
    return undefined;
  }
}

function validateRawQuery(rawQuery: string): boolean {
  if (rawQuery.length === 0) {
    return true;
  }
  for (const pair of rawQuery.split('&')) {
    if (pair.length === 0) {
      return false;
    }
    const separator = pair.indexOf('=');
    const rawName = separator === -1 ? pair : pair.slice(0, separator);
    const rawValue = separator === -1 ? '' : pair.slice(separator + 1);
    const name = decodeComponent(rawName, true);
    const value = decodeComponent(rawValue, true);
    // A decoded percent is safe in a query value: the gateway rebuilds the
    // upstream query from this decoded scalar, so URLSearchParams encodes it
    // again and neither the path nor the upstream query is decoded twice.
    if (
      name === undefined ||
      name.length === 0 ||
      value === undefined ||
      INVALID_DECODED_COMPONENT.test(name) ||
      INVALID_DECODED_COMPONENT.test(value)
    ) {
      return false;
    }
  }
  return true;
}

export function parseRequestTarget(
  rawTarget: string | undefined,
): ParsedRequestTarget | undefined {
  if (
    rawTarget === undefined ||
    !rawTarget.startsWith('/') ||
    rawTarget.startsWith('//') ||
    rawTarget.includes('#') ||
    INVALID_RAW_TARGET.test(rawTarget) ||
    Buffer.byteLength(rawTarget, 'utf8') > MAX_REQUEST_TARGET_BYTES
  ) {
    return undefined;
  }

  const queryIndex = rawTarget.indexOf('?');
  const rawPath = queryIndex === -1 ? rawTarget : rawTarget.slice(0, queryIndex);
  const rawQuery = queryIndex === -1 ? '' : rawTarget.slice(queryIndex + 1);
  if (!validateRawQuery(rawQuery)) {
    return undefined;
  }

  const rawSegments = rawPath.split('/');
  if (rawSegments[0] !== '') {
    return undefined;
  }
  const decodedPathSegments: string[] = [];
  for (const rawSegment of rawSegments.slice(1)) {
    const decoded = decodeComponent(rawSegment, false);
    if (
      decoded === undefined ||
      decoded === '.' ||
      decoded === '..' ||
      decoded.includes('/') ||
      decoded.includes('\\') ||
      decoded.includes('%') ||
      INVALID_DECODED_COMPONENT.test(decoded)
    ) {
      return undefined;
    }
    decodedPathSegments.push(decoded);
  }

  let url: URL;
  try {
    url = new URL(rawTarget, 'http://gateway.invalid');
  } catch {
    return undefined;
  }
  const pathname = `/${decodedPathSegments.join('/')}`;
  return Object.freeze({
    url,
    pathname,
    decodedPathSegments: Object.freeze(decodedPathSegments),
  });
}
