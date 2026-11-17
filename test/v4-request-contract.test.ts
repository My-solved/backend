import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ContractError,
  resolveProxyRequest,
} from '../src/application/v4-request-contract.js';
import { parseRequestTarget } from '../src/adapters/http/request-target.js';
import {
  compileGetRouter,
  compileRouter,
  findRuntimePath,
  findRuntimeRoute,
  GET_OPERATION_KEYS,
  GET_ROUTES,
  MUTATION_OPERATION_KEYS,
  MUTATION_ROUTES,
  RUNTIME_OPERATION_KEYS,
  RUNTIME_ROUTES,
  type V4GetRoute,
} from '../src/application/v4-router.js';
import type { V4RequestSchema } from '../src/domain/v4-operation-contract.js';
import { validateUriValue } from '../src/domain/uri-schema.js';

function requestTarget(raw: string) {
  const parsed = parseRequestTarget(raw);
  assert.ok(parsed, `invalid test request target: ${raw}`);
  return parsed;
}

function sampleUriValue(schema: V4RequestSchema): string {
  if (schema.kind === 'integer') {
    const lowerBound = Math.max(
      schema.minimum ?? Number.MIN_SAFE_INTEGER,
      schema.exclusiveMinimum === undefined
        ? Number.MIN_SAFE_INTEGER
        : schema.exclusiveMinimum + 1,
      0,
    );
    assert.ok(schema.maximum === undefined || lowerBound <= schema.maximum);
    const value = String(lowerBound);
    assert.equal(validateUriValue(value, schema), true);
    return value;
  }
  if (schema.kind === 'anyOf') {
    for (const option of schema.options) {
      try {
        return sampleUriValue(option);
      } catch {
        // Try the next reviewed alternative.
      }
    }
    throw new Error('could not build an anyOf URI sample');
  }
  assert.equal(schema.kind, 'string');
  const enumValue = schema.enum?.find(
    (candidate): candidate is string => candidate !== null,
  );
  const minimumText = 'a'.repeat(Math.max(schema.minLength ?? 1, 1));
  const candidates = [
    enumValue,
    minimumText,
    'a',
    'aa',
    'tourist',
    'ko',
    '2026-01-01',
    '2026-01',
    '20260101',
    'v1',
    'foo/bar',
    'dynamic_programming',
  ].filter((candidate): candidate is string => candidate !== undefined);
  const value = candidates.find((candidate) =>
    validateUriValue(candidate, schema),
  );
  if (value === undefined) {
    throw new Error(`could not build a URI sample for ${JSON.stringify(schema)}`);
  }
  return value;
}

function replacePathParameters(
  template: string,
  values: Readonly<Record<string, string>>,
): string {
  return template.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/gu, (_all, name) => {
    const value = values[name as string];
    assert.notEqual(value, undefined);
    return encodeURIComponent(value ?? '');
  });
}

test('runtime surface contains exactly all 71 v4 GET operations', () => {
  assert.equal(GET_ROUTES.length, 71);
  assert.equal(GET_OPERATION_KEYS.length, 71);
  assert.equal(
    GET_ROUTES.every(
      ({ operation }) =>
        operation.method === 'GET' &&
        operation.runtime.enabled &&
        (operation.access.class === 'open' ||
          operation.access.class === 'public' ||
          operation.access.class === 'user') &&
        operation.requestBody === null,
    ),
    true,
  );
  assert.deepEqual(
    GET_OPERATION_KEYS,
    [...GET_OPERATION_KEYS].sort(),
  );
  assert.equal(new Set(GET_OPERATION_KEYS).size, 71);
  assert.ok(GET_OPERATION_KEYS.includes('GET /api/v4/health'));
  assert.equal(
    GET_OPERATION_KEYS.filter((key) => key.includes('/api/v4/account/')).length,
    12,
  );
  assert.equal(
    GET_OPERATION_KEYS.some((key) => key.startsWith('POST ')),
    false,
  );
  assert.deepEqual(
    GET_ROUTES.filter(
      ({ operation }) => operation.access.bearer === 'optional',
    ).map(({ key }) => key),
    [
      'GET /api/v4/problems/{problemId}',
      'GET /api/v4/users/{handle}/bookmarks',
      'GET /api/v4/users/{handle}/bookmarks/{slug}',
      'GET /api/v4/users/{handle}/contributions',
    ],
  );
  assert.equal(
    GET_ROUTES.filter(({ operation }) => operation.access.bearer === 'required')
      .length,
    18,
  );
  assert.equal(
    GET_ROUTES.filter(({ operation }) => operation.access.bearer === 'none')
      .length,
    49,
  );
  assert.equal(
    GET_ROUTES.every(
      ({ operation }) =>
        operation.access.bearer !== 'required' ||
        operation.access.class === 'user',
    ),
    true,
  );
  assert.equal(
    GET_ROUTES.some(({ operation }) => operation.access.class === 'app'),
    false,
  );
});

const expectedMutationKeys = [
  'DELETE /api/v4/account/bookmark-favorites/{handle}/{slug}',
  'DELETE /api/v4/account/bookmarks/{slug}',
  'PATCH /api/v4/account/bookmarks/{slug}',
  'PATCH /api/v4/account/bookmarks/{slug}/problems/{problemId}',
  'PATCH /api/v4/account/settings',
  'POST /api/v4/account/bookmark-favorites/{handle}/{slug}',
  'POST /api/v4/account/bookmarks',
  'POST /api/v4/account/bookmarks/order',
  'POST /api/v4/account/bookmarks/{slug}/problems',
  'POST /api/v4/account/bookmarks/{slug}/problems/remove',
] as const;

test('method-aware runtime catalog locks all 81 reviewed operations', () => {
  assert.equal(RUNTIME_ROUTES.length, 81);
  assert.equal(RUNTIME_OPERATION_KEYS.length, 81);
  assert.deepEqual(
    RUNTIME_OPERATION_KEYS,
    [...RUNTIME_OPERATION_KEYS].sort(),
  );
  assert.equal(new Set(RUNTIME_OPERATION_KEYS).size, 81);
  assert.deepEqual(MUTATION_OPERATION_KEYS, expectedMutationKeys);
  assert.equal(MUTATION_ROUTES.length, 10);
  assert.deepEqual(
    Object.fromEntries(
      ['GET', 'POST', 'PATCH', 'DELETE'].map((method) => [
        method,
        RUNTIME_ROUTES.filter(
          ({ operation }) => operation.method === method,
        ).length,
      ]),
    ),
    { GET: 71, POST: 5, PATCH: 3, DELETE: 2 },
  );
  assert.equal(
    MUTATION_ROUTES.every(
      ({ operation }) =>
        operation.runtime.enabled &&
        operation.access.class === 'user' &&
        operation.access.bearer === 'required' &&
        operation.parameters.query.length === 0,
    ),
    true,
  );
  assert.equal(
    MUTATION_ROUTES.filter(({ operation }) => operation.requestBody !== null)
      .length,
    7,
  );
  assert.equal(
    MUTATION_ROUTES.filter(({ operation }) => operation.requestBody === null)
      .length,
    3,
  );
  assert.equal(
    RUNTIME_OPERATION_KEYS.some((key) => key.includes('/api/v4/oauth/')),
    false,
  );

  const methodsByPath = new Map<string, string[]>();
  for (const { operation } of RUNTIME_ROUTES) {
    const methods = methodsByPath.get(operation.gatewayPath) ?? [];
    methods.push(operation.method);
    methodsByPath.set(operation.gatewayPath, methods);
  }
  assert.equal(methodsByPath.size, 77);
  const methodOrder = ['GET', 'POST', 'PATCH', 'DELETE'];
  assert.deepEqual(
    [...methodsByPath]
      .filter(([, methods]) => methods.length > 1)
      .map(([path, methods]) => ({
        path,
        methods: methods.sort(
          (left, right) =>
            methodOrder.indexOf(left) - methodOrder.indexOf(right),
        ),
      }))
      .sort((left, right) =>
        left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
      ),
    [
      {
        path: '/solved/v4/account/bookmark-favorites/{handle}/{slug}',
        methods: ['POST', 'DELETE'],
      },
      {
        path: '/solved/v4/account/bookmarks',
        methods: ['GET', 'POST'],
      },
      {
        path: '/solved/v4/account/bookmarks/{slug}',
        methods: ['PATCH', 'DELETE'],
      },
      {
        path: '/solved/v4/account/settings',
        methods: ['GET', 'PATCH'],
      },
    ],
  );

  const bodyRoutes = MUTATION_ROUTES.filter(
    ({ operation }) => operation.requestBody !== null,
  );
  assert.equal(
    bodyRoutes.every(
      ({ operation }) =>
        operation.requestBody?.source === 'openapi' &&
        operation.requestBody.declaredRequired === false &&
        operation.requestBody.effectiveRequired === true &&
        operation.requestBody.mediaType === 'application/json',
    ),
    true,
  );
  assert.deepEqual(
    MUTATION_ROUTES.filter(({ operation }) => operation.requestBody === null)
      .map(({ key }) => key),
    [
      'DELETE /api/v4/account/bookmark-favorites/{handle}/{slug}',
      'DELETE /api/v4/account/bookmarks/{slug}',
      'POST /api/v4/account/bookmark-favorites/{handle}/{slug}',
    ],
  );
});

for (const route of MUTATION_ROUTES) {
  test(`resolves generated mutation route ${route.key}`, () => {
    const pathValues = Object.fromEntries(
      route.operation.parameters.path.map((parameter) => [
        parameter.name,
        sampleUriValue(parameter.schema),
      ]),
    );
    const gatewayPath = replacePathParameters(
      route.operation.gatewayPath,
      pathValues,
    );
    const parsed = requestTarget(gatewayPath);
    const matched = findRuntimeRoute(
      route.operation.method,
      parsed.decodedPathSegments,
    );
    assert.equal(matched?.key, route.key);
    assert.deepEqual(matched?.pathValues, pathValues);
  });
}

test('path literals win before method lookup on the order overlap', () => {
  const path = requestTarget('/solved/v4/account/bookmarks/order');
  assert.deepEqual(findRuntimePath(path.decodedPathSegments)?.allowedMethods, [
    'POST',
  ]);
  assert.equal(
    findRuntimeRoute('POST', path.decodedPathSegments)?.key,
    'POST /api/v4/account/bookmarks/order',
  );
  assert.equal(findRuntimeRoute('PATCH', path.decodedPathSegments), undefined);
  assert.equal(findRuntimeRoute('DELETE', path.decodedPathSegments), undefined);
});

test('router stores distinct methods at the same exact path leaf', () => {
  const favorites = MUTATION_ROUTES.filter(({ key }) =>
    key.includes('/api/v4/account/bookmark-favorites/'),
  );
  assert.equal(favorites.length, 2);
  const router = compileRouter(favorites);
  const segments = requestTarget(
    '/solved/v4/account/bookmark-favorites/tourist/example',
  ).decodedPathSegments;
  assert.match(router.match('POST', segments)?.key ?? '', /^POST /u);
  assert.match(router.match('DELETE', segments)?.key ?? '', /^DELETE /u);
  assert.deepEqual(router.matchPath(segments)?.allowedMethods, [
    'POST',
    'DELETE',
  ]);
});

for (const route of GET_ROUTES) {
  test(`resolves generated GET route ${route.key}`, () => {
    const pathValues = Object.fromEntries(
      route.operation.parameters.path.map((parameter) => [
        parameter.name,
        sampleUriValue(parameter.schema),
      ]),
    );
    const gatewayPath = replacePathParameters(
      route.operation.gatewayPath,
      pathValues,
    );
    const upstreamPath = replacePathParameters(
      route.operation.upstreamPath,
      pathValues,
    );
    const query = new URLSearchParams();
    for (const parameter of route.operation.parameters.query) {
      if (parameter.required) {
        query.set(parameter.name, sampleUriValue(parameter.schema));
      }
    }
    const target = query.size === 0 ? gatewayPath : `${gatewayPath}?${query}`;
    const resolved = resolveProxyRequest(requestTarget(target));

    assert.equal(resolved.operationKey, route.key);
    assert.equal(resolved.upstreamUrl.origin, 'https://solved.ac');
    assert.equal(resolved.upstreamUrl.pathname, upstreamPath);
    assert.deepEqual(
      [...resolved.upstreamUrl.searchParams.entries()],
      [...query.entries()].sort(([left], [right]) => left.localeCompare(right)),
    );
    assert.equal(resolved.responsePolicy, route.operation.responses);
  });
}

const compatibilityMappings = [
  ['/solved/v4/users/tourist', '/api/v4/users/tourist'],
  [
    '/solved/v4/users/tourist/activity/days?from=2026-01-01&to=2026-11-17',
    '/api/v4/users/tourist/activity/days',
  ],
  [
    '/solved/v4/users/tourist/reputation?range=1y',
    '/api/v4/users/tourist/reputation',
  ],
  [
    '/solved/v4/users/tourist/contributions?page=2&limit=20&sort=helpful&only=vouched&commented=true',
    '/api/v4/users/tourist/contributions',
  ],
  [
    '/solved/v4/problems?q=%23dp&page=2&sort=solved&direction=desc&seed=stable',
    '/api/v4/problems',
  ],
  [
    '/solved/v4/rankings/users/search?q=tourist&sort=rating',
    '/api/v4/rankings/users/search',
  ],
  ['/solved/v4/tags', '/api/v4/tags'],
  ['/solved/v4/tags/dynamic_programming', '/api/v4/tags/dynamic_programming'],
  [
    '/solved/v4/achievements/items/background/anniversary_1st?lang=ko',
    '/api/v4/achievements/items/background/anniversary_1st',
  ],
] as const;

for (const [target, expectedPath] of compatibilityMappings) {
  test(`preserves existing public mapping ${target}`, () => {
    const resolved = resolveProxyRequest(requestTarget(target));
    assert.equal(resolved.upstreamUrl.pathname, expectedPath);
    const incoming = requestTarget(target).url.searchParams;
    assert.equal(
      [...resolved.upstreamUrl.searchParams].length,
      [...incoming].length,
    );
    for (const [name, value] of incoming) {
      assert.equal(resolved.upstreamUrl.searchParams.get(name), value);
    }
  });
}

test('encodes path and query Unicode exactly once', () => {
  const profile = resolveProxyRequest(
    requestTarget('/solved/v4/users/%ED%95%9C%EA%B8%80'),
  );
  assert.equal(profile.upstreamUrl.pathname, '/api/v4/users/%ED%95%9C%EA%B8%80');
  assert.doesNotMatch(profile.upstreamUrl.href, /%25ED/u);

  const search = resolveProxyRequest(
    requestTarget('/solved/v4/problems?q=%23dp+%40tourist+%ED%95%9C%EA%B8%80'),
  );
  assert.equal(search.upstreamUrl.searchParams.get('q'), '#dp @tourist 한글');
  assert.doesNotMatch(search.upstreamUrl.href, /%2523/u);
});

test('keeps defaults as annotations and preserves explicit empty query text', () => {
  const withoutPage = resolveProxyRequest(requestTarget('/solved/v4/problems'));
  assert.equal(withoutPage.upstreamUrl.search, '');
  const empty = resolveProxyRequest(requestTarget('/solved/v4/problems?q='));
  assert.equal(empty.upstreamUrl.searchParams.get('q'), '');
});

test('does not invent a query limit absent from the manifest schema', () => {
  const query = 'q'.repeat(101);
  const resolved = resolveProxyRequest(
    requestTarget(`/solved/v4/problems?q=${query}`),
  );
  assert.equal(resolved.upstreamUrl.searchParams.get('q'), query);
});

test('uses code-point string lengths and never coerces nullable URI null', () => {
  assert.doesNotThrow(() =>
    resolveProxyRequest(
      requestTarget(`/solved/v4/achievements?lang=${encodeURIComponent('😀'.repeat(16))}`),
    ),
  );
  assert.throws(() =>
    resolveProxyRequest(
      requestTarget(`/solved/v4/achievements?lang=${encodeURIComponent('😀'.repeat(17))}`),
    ),
  );
  assert.doesNotThrow(() =>
    resolveProxyRequest(
      requestTarget('/solved/v4/users/tourist/collection?offset=0'),
    ),
  );
  assert.throws(() =>
    resolveProxyRequest(
      requestTarget('/solved/v4/users/tourist/collection?offset=null'),
    ),
  );
});

const invalidQueries = [
  '/solved/v4/users/tourist/activity/days',
  '/solved/v4/users/tourist/activity/days?from=2026-01-01&to=invalid',
  '/solved/v4/users/tourist/reputation?range=forever',
  '/solved/v4/users/tourist/contributions?limit=21',
  '/solved/v4/problems?page=0',
  '/solved/v4/problems?page=01',
  '/solved/v4/problems?page=-0',
  '/solved/v4/problems?page=1e2',
  '/solved/v4/problems?direction=descending',
  '/solved/v4/problems?q=a&%71=b',
  '/solved/v4/rankings/users/search',
  '/solved/v4/rankings/users/search?q=a&page=1',
] as const;

for (const target of invalidQueries) {
  test(`rejects invalid query contract: ${target}`, () => {
    assert.throws(
      () => resolveProxyRequest(requestTarget(target)),
      (error: unknown) =>
        error instanceof ContractError &&
        error.status === 400 &&
        error.code === 'invalid_query',
    );
  });
}

test('re-encodes a literal query percent without a second decode', () => {
  const resolved = resolveProxyRequest(
    requestTarget('/solved/v4/problems?q=%252Fetc'),
  );
  assert.equal(resolved.upstreamUrl.searchParams.get('q'), '%2Fetc');
  assert.match(resolved.upstreamUrl.href, /q=%252Fetc/u);
});

test('route matching gives a literal segment precedence over a parameter', () => {
  const profile = GET_ROUTES.find(
    ({ key }) => key === 'GET /api/v4/users/{handle}',
  );
  const tags = GET_ROUTES.find(
    ({ key }) => key === 'GET /api/v4/tags',
  );
  assert.ok(profile);
  assert.ok(tags);

  const parameterRoute = structuredClone(profile) as unknown as {
    key: string;
    operation: { gatewayPath: string };
  };
  parameterRoute.key = 'GET /api/v4/example/{handle}';
  parameterRoute.operation.gatewayPath = '/solved/v4/example/{handle}';
  const literalRoute = structuredClone(tags) as unknown as {
    key: string;
    operation: { gatewayPath: string };
  };
  literalRoute.key = 'GET /api/v4/example/collection';
  literalRoute.operation.gatewayPath = '/solved/v4/example/collection';

  const router = compileGetRouter([
    parameterRoute as unknown as V4GetRoute,
    literalRoute as unknown as V4GetRoute,
  ]);
  assert.equal(
    router.match(['solved', 'v4', 'example', 'collection'])?.key,
    literalRoute.key,
  );
  assert.equal(
    router.match(['solved', 'v4', 'example', 'tourist'])?.key,
    parameterRoute.key,
  );
});

const closedRoutes = [
  '/solved/v4/oauth/token',
  '/solved/problem/show?problemId=1000',
  '/solved/v4/achievements/items/title/unknown',
] as const;

for (const target of closedRoutes) {
  test(`keeps non-public route closed: ${target}`, () => {
    assert.throws(
      () => resolveProxyRequest(requestTarget(target)),
      (error: unknown) =>
        error instanceof ContractError &&
        error.status === 404 &&
        error.code === 'not_found',
    );
  });
}

test('route compiler rejects duplicate and ambiguous templates', () => {
  const profile = GET_ROUTES.find(
    ({ key }) => key === 'GET /api/v4/users/{handle}',
  );
  assert.ok(profile);
  assert.throws(
    () => compileGetRouter([profile, profile]),
    /duplicate leaf/u,
  );

  const first = structuredClone(profile) as unknown as {
    key: string;
    operation: {
      gatewayPath: string;
      parameters: { path: Array<{ name: string }> };
    };
  };
  first.key = 'GET /api/v4/conflict/{handle}';
  first.operation.gatewayPath = '/solved/v4/conflict/{handle}';
  const second = structuredClone(first);
  second.key = 'GET /api/v4/conflict/{key}';
  second.operation.gatewayPath = '/solved/v4/conflict/{key}';
  const secondParameter = second.operation.parameters.path[0];
  assert.ok(secondParameter);
  secondParameter.name = 'key';
  assert.throws(
    () =>
      compileGetRouter([
        first as unknown as V4GetRoute,
        second as unknown as V4GetRoute,
      ]),
    /ambiguous parameter sibling/u,
  );
});
