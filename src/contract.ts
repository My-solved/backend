import { findRoute } from './routes.js';

export const SOLVED_API_BASE_URL = 'https://solved.ac/api/v4/' as const;

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
}

export function resolveProxyRequest(
  requestUrl: URL,
  upstreamBaseUrl: string | URL = SOLVED_API_BASE_URL,
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

  const upstreamUrl = new URL(route.upstreamPath, upstreamBaseUrl);
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

  return Object.freeze({ upstreamUrl });
}
