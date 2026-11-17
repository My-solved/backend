export type UniqueRawHeader =
  | { readonly kind: 'absent' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'value'; readonly value: string };

export function readUniqueRawHeader(
  rawHeaders: readonly string[] | undefined,
  expectedName: string,
): UniqueRawHeader {
  if (rawHeaders === undefined) {
    return { kind: 'absent' };
  }
  if (rawHeaders.length % 2 !== 0) {
    return { kind: 'invalid' };
  }

  let value: string | undefined;
  for (let index = 0; index < rawHeaders.length; index += 2) {
    const name = rawHeaders[index];
    const candidate = rawHeaders[index + 1];
    if (name === undefined || candidate === undefined) {
      return { kind: 'invalid' };
    }
    if (name.toLowerCase() !== expectedName) {
      continue;
    }
    if (value !== undefined) {
      return { kind: 'invalid' };
    }
    value = candidate;
  }
  return value === undefined
    ? { kind: 'absent' }
    : { kind: 'value', value };
}

export function rawHeadersContain(
  rawHeaders: readonly string[] | undefined,
  expectedName: string,
): boolean {
  if (rawHeaders === undefined) {
    return false;
  }
  const normalized = expectedName.toLowerCase();
  for (let index = 0; index < rawHeaders.length; index += 2) {
    if (rawHeaders[index]?.toLowerCase() === normalized) {
      return true;
    }
  }
  return false;
}
