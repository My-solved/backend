import {
  findRuntimeRoute,
  type MatchedV4Path,
} from '../../application/v4-router.js';
import type { V4HttpMethod } from '../../domain/v4-operation-contract.js';
import type { CorsRoutePolicy } from './cors-policy.js';

const NO_RESPONSE_HEADERS = Object.freeze({});
const SENSITIVE_RESPONSE_HEADERS = Object.freeze({
  'cache-control': 'no-store',
  pragma: 'no-cache',
});

export interface V4PathPolicy {
  readonly cors: CorsRoutePolicy;
  readonly responseHeaders: Readonly<Record<string, string>>;
}

export function v4PathPolicy(
  path: MatchedV4Path,
  decodedSegments: readonly string[],
): V4PathPolicy {
  const routes = path.allowedMethods.map((method) => {
    const route = findRuntimeRoute(method, decodedSegments);
    if (route === undefined) {
      throw new Error('Runtime path and method catalogs disagree');
    }
    return route;
  });
  const sensitive = routes.some(
    ({ operation }) => operation.runtime.policy === 'supplemented',
  );
  const methodsFor = (
    predicate: (route: (typeof routes)[number]) => boolean,
  ): readonly V4HttpMethod[] =>
    Object.freeze(
      routes
        .filter(predicate)
        .map(({ operation }) => operation.method),
    );

  return Object.freeze({
    cors: Object.freeze({
      exactOrigin:
        sensitive ||
        routes.some(
          ({ operation }) => operation.access.bearer !== 'none',
        ),
      allowedMethods: path.allowedMethods,
      authorizationMethods: methodsFor(
        ({ operation }) => operation.access.bearer !== 'none',
      ),
      contentTypeMethods: methodsFor(
        ({ operation }) => operation.requestBody !== null,
      ),
    }),
    responseHeaders: sensitive
      ? SENSITIVE_RESPONSE_HEADERS
      : NO_RESPONSE_HEADERS,
  });
}
