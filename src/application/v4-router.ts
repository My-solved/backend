import type {
  V4HttpMethod,
  V4OperationContract,
  V4OperationParameter,
} from '../domain/v4-operation-contract.js';
import {
  assertUriSchemaSupported,
  validateUriValue,
} from '../domain/uri-schema.js';
import { V4_OPERATION_MANIFEST } from '../generated/v4-operations.js';

const PATH_PARAMETER = /^\{([A-Za-z][A-Za-z0-9]*)\}$/u;
const HTTP_METHOD_ORDER = Object.freeze([
  'GET',
  'POST',
  'PATCH',
  'DELETE',
] as const satisfies readonly V4HttpMethod[]);
const EXPECTED_RUNTIME_METHOD_COUNTS = Object.freeze({
  GET: 71,
  POST: 7,
  PATCH: 3,
  DELETE: 2,
} satisfies Readonly<Record<V4HttpMethod, number>>);

export interface V4Route {
  readonly key: string;
  readonly operation: V4OperationContract;
}

export interface MatchedV4Route extends V4Route {
  readonly pathValues: Readonly<Record<string, string>>;
}

export interface MatchedV4Path {
  readonly allowedMethods: readonly V4HttpMethod[];
  readonly pathValues: Readonly<Record<string, string>>;
}

export type V4GetRoute = V4Route;
export type MatchedV4GetRoute = MatchedV4Route;

interface ParameterEdge {
  readonly name: string;
  readonly parameter: V4OperationParameter;
  readonly node: RouteNode;
}

interface RouteNode {
  readonly literals: Map<string, RouteNode>;
  readonly routes: Map<V4HttpMethod, V4Route>;
  parameter?: ParameterEdge;
}

interface InternalPathMatch {
  readonly node: RouteNode;
  readonly pathValues: Readonly<Record<string, string>>;
}

export interface V4Router {
  readonly operationKeys: readonly string[];
  readonly match: (
    method: V4HttpMethod,
    decodedPathSegments: readonly string[],
  ) => MatchedV4Route | undefined;
  readonly matchPath: (
    decodedPathSegments: readonly string[],
  ) => MatchedV4Path | undefined;
}

export interface V4GetRouter {
  readonly operationKeys: readonly string[];
  readonly match: (
    decodedPathSegments: readonly string[],
  ) => MatchedV4GetRoute | undefined;
}

function createNode(): RouteNode {
  return {
    literals: new Map<string, RouteNode>(),
    routes: new Map<V4HttpMethod, V4Route>(),
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function runtimeEntries(): V4Route[] {
  const entries: V4Route[] = [];
  const methodCounts: Record<V4HttpMethod, number> = {
    GET: 0,
    POST: 0,
    PATCH: 0,
    DELETE: 0,
  };
  for (const [key, narrowOperation] of Object.entries(V4_OPERATION_MANIFEST)) {
    const operation: V4OperationContract = narrowOperation;
    if (!operation.runtime.enabled) {
      continue;
    }
    entries.push({ key, operation });
    methodCounts[operation.method] += 1;
  }
  entries.sort((left, right) => compareText(left.key, right.key));
  for (const method of HTTP_METHOD_ORDER) {
    if (methodCounts[method] !== EXPECTED_RUNTIME_METHOD_COUNTS[method]) {
      throw new Error(`v4 ${method} operation count changed`);
    }
  }
  if (entries.length !== 83) {
    throw new Error('v4 runtime operation count changed');
  }
  return entries;
}

function parameterFor(
  operation: V4OperationContract,
  name: string,
): V4OperationParameter {
  const parameter = operation.parameters.path.find(
    (candidate) => candidate.name === name,
  );
  if (parameter === undefined || !parameter.required) {
    throw new Error('route template has an unsupported path parameter');
  }
  assertUriSchemaSupported(parameter.schema);
  return parameter;
}

function sameParameter(
  left: V4OperationParameter,
  right: V4OperationParameter,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function insertRoute(root: RouteNode, route: V4Route): void {
  if (!route.operation.gatewayPath.startsWith('/solved/v4/')) {
    throw new Error('gateway route escaped the solved v4 namespace');
  }
  const segments = route.operation.gatewayPath.split('/').slice(1);
  if (segments.length === 0 || segments.some((segment) => segment.length === 0)) {
    throw new Error('gateway route contains an empty segment');
  }

  let node = root;
  const usedParameters = new Set<string>();
  for (const segment of segments) {
    const match = PATH_PARAMETER.exec(segment);
    if (match === null) {
      let child = node.literals.get(segment);
      if (child === undefined) {
        child = createNode();
        node.literals.set(segment, child);
      }
      node = child;
      continue;
    }

    const name = match[1];
    if (name === undefined || usedParameters.has(name)) {
      throw new Error('gateway route contains an invalid path parameter');
    }
    usedParameters.add(name);
    const parameter = parameterFor(route.operation, name);
    if (node.parameter === undefined) {
      node.parameter = { name, parameter, node: createNode() };
    } else if (
      node.parameter.name !== name ||
      !sameParameter(node.parameter.parameter, parameter)
    ) {
      throw new Error('gateway route has an ambiguous parameter sibling');
    }
    node = node.parameter.node;
  }

  if (usedParameters.size !== route.operation.parameters.path.length) {
    throw new Error('gateway route path parameters do not match the template');
  }
  if (node.routes.has(route.operation.method)) {
    throw new Error('gateway route has a duplicate leaf for method');
  }
  node.routes.set(route.operation.method, route);
}

function matchPathNode(
  node: RouteNode,
  segments: readonly string[],
  index: number,
  values: Record<string, string>,
): InternalPathMatch | undefined {
  if (index === segments.length) {
    return node.routes.size === 0
      ? undefined
      : Object.freeze({
          node,
          pathValues: Object.freeze({ ...values }),
        });
  }
  const value = segments[index];
  if (value === undefined) {
    return undefined;
  }

  const literal = node.literals.get(value);
  if (literal !== undefined) {
    const matched = matchPathNode(literal, segments, index + 1, values);
    if (matched !== undefined) {
      return matched;
    }
  }

  const parameter = node.parameter;
  if (
    parameter !== undefined &&
    validateUriValue(value, parameter.parameter.schema)
  ) {
    values[parameter.name] = value;
    const matched = matchPathNode(
      parameter.node,
      segments,
      index + 1,
      values,
    );
    delete values[parameter.name];
    return matched;
  }
  return undefined;
}

function allowedMethods(node: RouteNode): readonly V4HttpMethod[] {
  return Object.freeze(
    HTTP_METHOD_ORDER.filter((method) => node.routes.has(method)),
  );
}

export function compileRouter(routes: readonly V4Route[]): V4Router {
  const root = createNode();
  const sortedRoutes = [...routes].sort((left, right) =>
    compareText(left.key, right.key),
  );
  for (const route of sortedRoutes) {
    insertRoute(root, route);
    for (const parameter of route.operation.parameters.query) {
      assertUriSchemaSupported(parameter.schema);
    }
  }

  const matchPath = (
    segments: readonly string[],
  ): InternalPathMatch | undefined =>
    matchPathNode(
      root,
      segments,
      0,
      Object.create(null) as Record<string, string>,
    );

  return Object.freeze({
    operationKeys: Object.freeze(sortedRoutes.map(({ key }) => key)),
    match: (method: V4HttpMethod, segments: readonly string[]) => {
      const path = matchPath(segments);
      if (path === undefined) {
        return undefined;
      }
      const route = path.node.routes.get(method);
      return route === undefined
        ? undefined
        : Object.freeze({ ...route, pathValues: path.pathValues });
    },
    matchPath: (segments: readonly string[]) => {
      const path = matchPath(segments);
      return path === undefined
        ? undefined
        : Object.freeze({
            allowedMethods: allowedMethods(path.node),
            pathValues: path.pathValues,
          });
    },
  });
}

export function compileGetRouter(
  routes: readonly V4GetRoute[],
): V4GetRouter {
  if (routes.some(({ operation }) => operation.method !== 'GET')) {
    throw new Error('GET router received a non-GET operation');
  }
  const router = compileRouter(routes);
  return Object.freeze({
    operationKeys: router.operationKeys,
    match: (segments: readonly string[]) => router.match('GET', segments),
  });
}

export const RUNTIME_ROUTES = Object.freeze(runtimeEntries());
export const GET_ROUTES = Object.freeze(
  RUNTIME_ROUTES.filter(({ operation }) => operation.method === 'GET'),
);
export const MUTATION_ROUTES = Object.freeze(
  RUNTIME_ROUTES.filter(({ operation }) => operation.method !== 'GET'),
);

const runtimeRouter = compileRouter(RUNTIME_ROUTES);
const getRouter = compileGetRouter(GET_ROUTES);

export const RUNTIME_OPERATION_KEYS = runtimeRouter.operationKeys;
export const GET_OPERATION_KEYS = getRouter.operationKeys;
export const MUTATION_OPERATION_KEYS = Object.freeze(
  MUTATION_ROUTES.map(({ key }) => key),
);

export function findRuntimeRoute(
  method: V4HttpMethod,
  decodedPathSegments: readonly string[],
): MatchedV4Route | undefined {
  return runtimeRouter.match(method, decodedPathSegments);
}

export function findRuntimePath(
  decodedPathSegments: readonly string[],
): MatchedV4Path | undefined {
  return runtimeRouter.matchPath(decodedPathSegments);
}

export function findRoute(
  decodedPathSegments: readonly string[],
): MatchedV4GetRoute | undefined {
  return getRouter.match(decodedPathSegments);
}
