import type { V4ResponseContract } from '../domain/v4-operation-contract.js';
import { validateUriValue } from '../domain/uri-schema.js';
import type { ParsedRequestTarget } from './parsed-request-target.js';
import { findRoute, type MatchedV4Route } from './v4-router.js';

export const SOLVED_API_BASE_URL = 'https://solved.ac/' as const;

const PATH_PARAMETER = /\{([A-Za-z][A-Za-z0-9]*)\}/gu;

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
  readonly operationKey: string;
  readonly upstreamUrl: URL;
  readonly responsePolicy: Readonly<Record<string, V4ResponseContract>>;
}

function resolveUpstreamPath(
  template: string,
  pathValues: Readonly<Record<string, string>>,
): string {
  const resolved = template.replace(PATH_PARAMETER, (_placeholder, rawName) => {
    const name = rawName as string;
    const value = pathValues[name];
    if (value === undefined) {
      throw new ContractError(404, 'not_found', 'Route not found');
    }
    return encodeURIComponent(value);
  });
  if (resolved.includes('{') || resolved.includes('}')) {
    throw new ContractError(404, 'not_found', 'Route not found');
  }
  return resolved;
}

export function resolveMatchedProxyRequest(
  requestTarget: ParsedRequestTarget,
  route: MatchedV4Route,
  upstreamBaseUrl: string | URL = SOLVED_API_BASE_URL,
): ResolvedProxyRequest {
  const allowedNames = new Set(
    route.operation.parameters.query.map(({ name }) => name),
  );
  for (const name of requestTarget.url.searchParams.keys()) {
    if (!allowedNames.has(name)) {
      throw new ContractError(
        400,
        'invalid_query',
        `Unsupported query parameter: ${name}`,
      );
    }
  }

  const upstreamPath = resolveUpstreamPath(
    route.operation.upstreamPath,
    route.pathValues,
  );
  const upstreamUrl = new URL(upstreamPath, upstreamBaseUrl);
  for (const parameter of route.operation.parameters.query) {
    const values = requestTarget.url.searchParams.getAll(parameter.name);
    if (values.length > 1) {
      throw new ContractError(
        400,
        'invalid_query',
        `Query parameter must be provided once: ${parameter.name}`,
      );
    }
    const value = values[0];
    if (value === undefined) {
      if (parameter.required) {
        throw new ContractError(
          400,
          'invalid_query',
          `Missing query parameter: ${parameter.name}`,
        );
      }
      continue;
    }
    if (!validateUriValue(value, parameter.schema)) {
      throw new ContractError(
        400,
        'invalid_query',
        `Invalid query parameter: ${parameter.name}`,
      );
    }
    upstreamUrl.searchParams.set(parameter.name, value);
  }

  return Object.freeze({
    operationKey: route.key,
    upstreamUrl,
    responsePolicy: route.operation.responses,
  });
}

/** GET-only compatibility wrapper for callers which do not dispatch methods. */
export function resolveProxyRequest(
  requestTarget: ParsedRequestTarget,
  upstreamBaseUrl: string | URL = SOLVED_API_BASE_URL,
): ResolvedProxyRequest {
  const route = findRoute(requestTarget.decodedPathSegments);
  if (route === undefined) {
    throw new ContractError(404, 'not_found', 'Route not found');
  }
  return resolveMatchedProxyRequest(requestTarget, route, upstreamBaseUrl);
}
