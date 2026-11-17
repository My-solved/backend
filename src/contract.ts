import { findRoute } from './routes.js';
import type { SolvedApiVersion } from './routes.js';

export const SOLVED_API_V3_BASE_URL = 'https://solved.ac/api/v3/' as const;
export const SOLVED_API_V4_BASE_URL = 'https://solved.ac/api/v4/' as const;

export interface SolvedApiBaseUrls {
  readonly v3: string | URL;
  readonly v4: string | URL;
}

export const SOLVED_API_BASE_URLS: SolvedApiBaseUrls = Object.freeze({
  v3: SOLVED_API_V3_BASE_URL,
  v4: SOLVED_API_V4_BASE_URL,
});

export class ContractError extends Error {
  constructor(
    readonly status: 400 | 404,
    readonly code: 'invalid_query' | 'not_found',
    message: string,
  ) {
    super(message);
    this.name = 'ContractError';
  }
}

export interface ResolvedProxyRequest {
  readonly upstreamUrl: URL;
  readonly apiVersion: SolvedApiVersion;
}

export function resolveProxyRequest(
  requestUrl: URL,
  upstreamBaseUrls: SolvedApiBaseUrls = SOLVED_API_BASE_URLS,
): ResolvedProxyRequest {
  const route = findRoute(requestUrl.pathname);
  if (route === undefined) {
    throw new ContractError(404, 'not_found', 'Route not found');
  }

  const allowedNames = new Set(route.query.map(({ name }) => name));
  for (const name of requestUrl.searchParams.keys()) {
    if (!allowedNames.has(name)) {
      throw new ContractError(
        400,
        'invalid_query',
        `Unsupported query parameter: ${name}`,
      );
    }
  }

  const upstreamUrl = new URL(
    route.upstreamPath,
    route.apiVersion === 'v4' ? upstreamBaseUrls.v4 : upstreamBaseUrls.v3,
  );
  for (const parameter of route.query) {
    const values = requestUrl.searchParams.getAll(parameter.name);
    if (values.length > 1) {
      throw new ContractError(
        400,
        'invalid_query',
        `Query parameter must be provided once: ${parameter.name}`,
      );
    }

    const value = values[0] ?? parameter.defaultValue;
    if (value === undefined) {
      if (parameter.required === true) {
        throw new ContractError(
          400,
          'invalid_query',
          `Missing query parameter: ${parameter.name}`,
        );
      }
      continue;
    }

    if (parameter.validate !== undefined && !parameter.validate(value)) {
      throw new ContractError(
        400,
        'invalid_query',
        `Invalid query parameter: ${parameter.name}`,
      );
    }

    upstreamUrl.searchParams.set(parameter.name, value);
  }

  return Object.freeze({ upstreamUrl, apiVersion: route.apiVersion });
}
