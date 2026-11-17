import {
  createBearerAuthorization,
  type BearerAuthorization,
} from '../../domain/bearer-authorization.js';
import { readUniqueRawHeader } from './request-headers.js';

const MAX_BEARER_HEADER_BYTES = 4_096;

export type BearerAuthorizationResult =
  | { readonly kind: 'absent' }
  | { readonly kind: 'invalid' }
  | {
      readonly kind: 'valid';
      readonly authorization: BearerAuthorization;
    };

export function parseBearerAuthorization(
  rawHeaders: readonly string[] | undefined,
): BearerAuthorizationResult {
  const header = readUniqueRawHeader(rawHeaders, 'authorization');
  if (header.kind !== 'value') {
    return header;
  }
  if (Buffer.byteLength(header.value, 'utf8') > MAX_BEARER_HEADER_BYTES) {
    return { kind: 'invalid' };
  }
  const separator = header.value.indexOf(' ');
  const scheme = header.value.slice(0, separator);
  const token = header.value.slice(separator + 1);
  const authorization = createBearerAuthorization(token);
  if (
    separator < 1 ||
    scheme.toLowerCase() !== 'bearer' ||
    authorization === undefined
  ) {
    return { kind: 'invalid' };
  }
  return {
    kind: 'valid',
    authorization,
  };
}
