import {
  createValidatedFormRequestBody,
  type ValidatedFormRequestBody,
} from '../../domain/validated-form-request-body.js';
import type { V4SupplementRequestBodyContract } from '../../domain/v4-operation-contract.js';
import {
  isStrictFormContentType,
  isStrictJsonContentType,
} from './request-body.js';
import { parseStrictFormBody } from './strict-form-body.js';
import { parseStrictJsonValue } from './strict-json-body.js';

export type OAuthRequestBodyEncoding = 'form' | 'json';

export function oauthRequestBodyEncoding(
  contentType: string,
  contract: V4SupplementRequestBodyContract,
): OAuthRequestBodyEncoding | undefined {
  if (
    isStrictJsonContentType(contentType) &&
    contract.mediaTypes.includes('application/json')
  ) {
    return 'json';
  }
  if (
    isStrictFormContentType(contentType) &&
    contract.mediaTypes.includes('application/x-www-form-urlencoded')
  ) {
    return 'form';
  }
  return undefined;
}

export function parseAndValidateOAuthRequestBody(
  bytes: Uint8Array,
  encoding: OAuthRequestBodyEncoding,
  contract: V4SupplementRequestBodyContract,
): ValidatedFormRequestBody | undefined {
  const value =
    encoding === 'json'
      ? parseStrictJsonValue(bytes)
      : parseStrictFormBody(bytes);
  return value === undefined
    ? undefined
    : createValidatedFormRequestBody(value, contract.schema);
}
