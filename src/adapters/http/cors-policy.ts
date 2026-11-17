import { readUniqueRawHeader } from './request-headers.js';
import type { V4HttpMethod } from '../../domain/v4-operation-contract.js';

const PUBLIC_CORS_HEADERS = Object.freeze({
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-max-age': '86400',
});

const PROTECTED_VARY = 'Origin';
const PROTECTED_PREFLIGHT_VARY =
  'Origin, Access-Control-Request-Method, Access-Control-Request-Headers';

export interface CorsDecision {
  readonly allowed: boolean;
  readonly headers: Readonly<Record<string, string>>;
}

export interface CorsRoutePolicy {
  readonly tokenAware: boolean;
  readonly allowedMethods: readonly V4HttpMethod[];
  readonly jsonBodyMethods: readonly V4HttpMethod[];
}

function normalizedPolicy(
  policy: boolean | CorsRoutePolicy,
): CorsRoutePolicy {
  return typeof policy === 'boolean'
    ? {
        tokenAware: policy,
        allowedMethods: ['GET'],
        jsonBodyMethods: [],
      }
    : policy;
}

function allowMethods(methods: readonly V4HttpMethod[]): string {
  return [...methods, 'OPTIONS'].join(', ');
}

function deniedProtectedCors(preflight: boolean): CorsDecision {
  return Object.freeze({
    allowed: false,
    headers: Object.freeze({
      vary: preflight ? PROTECTED_PREFLIGHT_VARY : PROTECTED_VARY,
    }),
  });
}

function requestedHeaderNames(value: string): readonly string[] | undefined {
  if (value.trim().length === 0) {
    return [];
  }
  const names = value.split(',').map((name) => name.trim().toLowerCase());
  if (
    names.some(
      (name) => name.length === 0 || !/^[!#$%&'*+.^_`|~0-9a-z-]+$/u.test(name),
    ) ||
    new Set(names).size !== names.length
  ) {
    return undefined;
  }
  return names;
}

function publicCorsDecision(
  rawHeaders: readonly string[] | undefined,
  preflight: boolean,
): CorsDecision {
  if (!preflight) {
    return { allowed: true, headers: PUBLIC_CORS_HEADERS };
  }
  const requestedMethod = readUniqueRawHeader(
    rawHeaders,
    'access-control-request-method',
  );
  if (
    requestedMethod.kind === 'invalid' ||
    (requestedMethod.kind === 'value' &&
      requestedMethod.value.toUpperCase() !== 'GET')
  ) {
    return { allowed: false, headers: PUBLIC_CORS_HEADERS };
  }
  const requestedHeaders = readUniqueRawHeader(
    rawHeaders,
    'access-control-request-headers',
  );
  if (requestedHeaders.kind === 'invalid') {
    return { allowed: false, headers: PUBLIC_CORS_HEADERS };
  }
  if (requestedHeaders.kind === 'value') {
    const names = requestedHeaderNames(requestedHeaders.value);
    if (names === undefined || names.length !== 0) {
      return { allowed: false, headers: PUBLIC_CORS_HEADERS };
    }
  }
  return { allowed: true, headers: PUBLIC_CORS_HEADERS };
}

export function corsDecision(
  rawHeaders: readonly string[] | undefined,
  preflight: boolean,
  routePolicy: boolean | CorsRoutePolicy,
  protectedOrigins: readonly string[],
): CorsDecision {
  const policy = normalizedPolicy(routePolicy);
  if (!policy.tokenAware) {
    return publicCorsDecision(rawHeaders, preflight);
  }

  const origin = readUniqueRawHeader(rawHeaders, 'origin');
  if (origin.kind === 'absent') {
    return preflight
      ? deniedProtectedCors(true)
      : Object.freeze({
          allowed: true,
          headers: Object.freeze({ vary: PROTECTED_VARY }),
        });
  }
  if (
    origin.kind === 'invalid' ||
    origin.value === 'null' ||
    !protectedOrigins.includes(origin.value)
  ) {
    return deniedProtectedCors(preflight);
  }

  const headers: Record<string, string> = {
    'access-control-allow-origin': origin.value,
    'access-control-allow-methods': allowMethods(policy.allowedMethods),
    'access-control-max-age': '86400',
    vary: preflight ? PROTECTED_PREFLIGHT_VARY : PROTECTED_VARY,
  };
  if (!preflight) {
    return Object.freeze({ allowed: true, headers: Object.freeze(headers) });
  }

  const requestedMethod = readUniqueRawHeader(
    rawHeaders,
    'access-control-request-method',
  );
  if (
    requestedMethod.kind !== 'value' ||
    !policy.allowedMethods.includes(
      requestedMethod.value.toUpperCase() as V4HttpMethod,
    )
  ) {
    return deniedProtectedCors(true);
  }
  const method = requestedMethod.value.toUpperCase() as V4HttpMethod;
  const requestedHeaders = readUniqueRawHeader(
    rawHeaders,
    'access-control-request-headers',
  );
  if (requestedHeaders.kind === 'invalid') {
    return deniedProtectedCors(true);
  }
  if (requestedHeaders.kind === 'value') {
    const names = requestedHeaderNames(requestedHeaders.value);
    const allowedNames = new Set([
      'authorization',
      ...(policy.jsonBodyMethods.includes(method) ? ['content-type'] : []),
    ]);
    if (
      names === undefined ||
      names.some((name) => !allowedNames.has(name))
    ) {
      return deniedProtectedCors(true);
    }
  }
  headers['access-control-allow-headers'] = policy.jsonBodyMethods.includes(
    method,
  )
    ? 'Authorization, Content-Type'
    : 'Authorization';
  return Object.freeze({ allowed: true, headers: Object.freeze(headers) });
}
