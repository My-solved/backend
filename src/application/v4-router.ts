import { V4_OPERATION_MANIFEST } from '../generated/v4-operations.js';
import type {
  V4OperationContract,
  V4OperationParameter,
} from '../domain/v4-operation-contract.js';
import {
  assertUriSchemaSupported,
  validateUriValue,
} from '../domain/uri-schema.js';

const PATH_PARAMETER = /^\{([A-Za-z][A-Za-z0-9]*)\}$/u;
const EXPECTED_GET_OPERATIONS = 71;

export interface V4GetRoute {
  readonly key: string;
  readonly operation: V4OperationContract;
}

export interface MatchedV4GetRoute extends V4GetRoute {
  readonly pathValues: Readonly<Record<string, string>>;
}

interface ParameterEdge {
  readonly name: string;
  readonly parameter: V4OperationParameter;
  readonly node: RouteNode;
}

interface RouteNode {
  readonly literals: Map<string, RouteNode>;
  parameter?: ParameterEdge;
  route?: V4GetRoute;
}

export interface V4GetRouter {
  readonly operationKeys: readonly string[];
  readonly match: (
    decodedPathSegments: readonly string[],
  ) => MatchedV4GetRoute | undefined;
}

function createNode(): RouteNode {
  return { literals: new Map<string, RouteNode>() };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function getEntries(): V4GetRoute[] {
  const entries: V4GetRoute[] = [];
  for (const [key, narrowOperation] of Object.entries(V4_OPERATION_MANIFEST)) {
    const operation: V4OperationContract = narrowOperation;
    if (
      operation.method === 'GET' &&
      operation.runtime.enabled &&
      (operation.access.class === 'open' ||
        operation.access.class === 'public' ||
        operation.access.class === 'user')
    ) {
      entries.push({ key, operation });
    }
  }
  entries.sort((left, right) => compareText(left.key, right.key));
  if (entries.length !== EXPECTED_GET_OPERATIONS) {
    throw new Error('v4 GET operation count changed');
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

function insertRoute(root: RouteNode, route: V4GetRoute): void {
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
  if (node.route !== undefined) {
    throw new Error('gateway route has a duplicate leaf');
  }
  node.route = route;
}

function matchNode(
  node: RouteNode,
  segments: readonly string[],
  index: number,
  values: Record<string, string>,
): MatchedV4GetRoute | undefined {
  if (index === segments.length) {
    return node.route === undefined
      ? undefined
      : Object.freeze({
          ...node.route,
          pathValues: Object.freeze({ ...values }),
        });
  }
  const value = segments[index];
  if (value === undefined) {
    return undefined;
  }

  const literal = node.literals.get(value);
  if (literal !== undefined) {
    const matched = matchNode(literal, segments, index + 1, values);
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
    const matched = matchNode(parameter.node, segments, index + 1, values);
    delete values[parameter.name];
    return matched;
  }
  return undefined;
}

export function compileGetRouter(
  routes: readonly V4GetRoute[],
): V4GetRouter {
  const root = createNode();
  const operationKeys: string[] = [];
  for (const route of routes) {
    insertRoute(root, route);
    operationKeys.push(route.key);
    for (const parameter of route.operation.parameters.query) {
      assertUriSchemaSupported(parameter.schema);
    }
  }
  return Object.freeze({
    operationKeys: Object.freeze(operationKeys),
    match: (segments: readonly string[]) =>
      matchNode(root, segments, 0, Object.create(null) as Record<string, string>),
  });
}

export const GET_ROUTES = Object.freeze(getEntries());
const getRouter = compileGetRouter(GET_ROUTES);

export const GET_OPERATION_KEYS = getRouter.operationKeys;

export function findRoute(
  decodedPathSegments: readonly string[],
): MatchedV4GetRoute | undefined {
  return getRouter.match(decodedPathSegments);
}
