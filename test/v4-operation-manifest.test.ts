import assert from 'node:assert/strict';
import test from 'node:test';

import {
  V4_OPERATION_MANIFEST,
  V4_OPERATION_SNAPSHOT_SHA256,
} from '../src/generated/v4-operations.js';
import type {
  V4ResponseContract,
  V4RuntimePolicy,
} from '../src/domain/v4-operation-contract.js';

const generatedRuntimePolicy = {
  enabled: true,
  policy: 'generated',
} satisfies V4RuntimePolicy;
void generatedRuntimePolicy;

const supplementedRuntimePolicy = {
  enabled: true,
  policy: 'supplemented',
  supplement: 'oauth-token',
  requiredSecurity: {
    appAuthentication: 'server-owned-x-client-headers',
    browserCors: 'exact-origin',
    callerAuthorization: 'reject',
    forwardEtag: false,
    responseCache: 'no-store',
    responsePragma: 'no-cache',
    upstreamAttempts: 1,
  },
} satisfies V4RuntimePolicy;
void supplementedRuntimePolicy;

const invalidRuntimePolicy: V4RuntimePolicy = {
  enabled: true,
  policy: 'generated',
  // @ts-expect-error Enabled generated operations cannot name a supplement.
  supplement: 'oauth-token',
};
void invalidRuntimePolicy;

// @ts-expect-error Supplemented operations require their exact security policy.
const missingSupplementSecurity: V4RuntimePolicy = {
  enabled: true,
  policy: 'supplemented',
  supplement: 'oauth-token',
};
void missingSupplementSecurity;

// @ts-expect-error Generated operations cannot carry supplement security.
const generatedWithSecurity: V4RuntimePolicy = {
  enabled: true,
  policy: 'generated',
  requiredSecurity: supplementedRuntimePolicy.requiredSecurity,
};
void generatedWithSecurity;

test('generated operation manifest covers the complete stable catalog', () => {
  const entries = Object.entries(V4_OPERATION_MANIFEST);
  const keys = entries.map(([key]) => key);

  assert.equal(entries.length, 83);
  assert.deepEqual(keys, [...keys].sort());
  assert.equal(
    V4_OPERATION_SNAPSHOT_SHA256,
    '98177dc4232bcd2f59a284235126b22a4881e9772d3501dd8539cc665b6bbdc1',
  );
  assert.equal(
    entries.filter(
      ([, operation]) =>
        operation.method === 'GET' &&
        (operation.access.class === 'open' ||
          operation.access.class === 'public'),
    ).length,
    53,
  );
  const bearerPolicyCounts = { none: 0, optional: 0, required: 0 };
  const getBearerPolicyCounts = { none: 0, optional: 0, required: 0 };
  for (const [, operation] of entries) {
    const expectedBearer =
      operation.access.class === 'user'
        ? 'required'
        : operation.access.class === 'public' &&
            'scope' in operation.access
          ? 'optional'
          : 'none';
    assert.equal(operation.access.bearer, expectedBearer);
    bearerPolicyCounts[operation.access.bearer] += 1;
    if (operation.method === 'GET') {
      getBearerPolicyCounts[operation.access.bearer] += 1;
    }
  }
  assert.deepEqual(bearerPolicyCounts, {
    none: 51,
    optional: 4,
    required: 28,
  });
  assert.deepEqual(getBearerPolicyCounts, {
    none: 49,
    optional: 4,
    required: 18,
  });
  const optionalBearerKeys = [
    'GET /api/v4/problems/{problemId}',
    'GET /api/v4/users/{handle}/bookmarks',
    'GET /api/v4/users/{handle}/bookmarks/{slug}',
    'GET /api/v4/users/{handle}/contributions',
  ] as const;
  assert.deepEqual(
    entries
      .filter(([, operation]) => operation.access.bearer === 'optional')
      .map(([key]) => key),
    optionalBearerKeys,
  );
  for (const key of optionalBearerKeys) {
    const responses: Readonly<Record<string, V4ResponseContract>> =
      V4_OPERATION_MANIFEST[key].responses;
    assert.equal(responses['401'], undefined);
    assert.equal(responses['403'], undefined);
  }
  assert.equal(
    entries.reduce(
      (count, [, operation]) => count + operation.parameters.path.length,
      0,
    ),
    52,
  );
  assert.equal(
    entries.reduce(
      (count, [, operation]) => count + operation.parameters.query.length,
      0,
    ),
    92,
  );

  for (const [key, operation] of entries) {
    assert.equal(key, `${operation.method} ${operation.upstreamPath}`);
    assert.equal(
      operation.gatewayPath,
      operation.upstreamPath.replace('/api/v4/', '/solved/v4/'),
    );
    assert.match(operation.upstreamPath, /^\/api\/v4\//u);
    assert.match(operation.gatewayPath, /^\/solved\/v4\//u);
    assert.doesNotMatch(operation.upstreamPath, /^[a-z]+:\/\//u);
  }
});

test('reviewed gateway policies stay explicit in generated data', () => {
  const entries = Object.values(V4_OPERATION_MANIFEST);
  const declaredBodies = entries.filter(
    (operation) => operation.requestBody?.source === 'openapi',
  );

  assert.equal(declaredBodies.length, 7);
  for (const operation of declaredBodies) {
    assert.equal(operation.requestBody?.source, 'openapi');
    assert.equal(operation.requestBody?.declaredRequired, false);
    assert.equal(operation.requestBody?.effectiveRequired, true);
    assert.equal(operation.requestBody?.mediaType, 'application/json');
    assert.equal(operation.requestBody?.schema.kind, 'object');
    if (operation.requestBody?.schema.kind === 'object') {
      assert.equal(
        operation.requestBody.schema.unknownProperties,
        'reject',
      );
    }
  }

  const affiliation = V4_OPERATION_MANIFEST[
    'GET /api/v4/rankings/affiliations/{affiliationId}'
  ];
  assert.deepEqual(affiliation.parameters.path, [
    {
      gatewayOverride: 'required-non-null-path',
      name: 'affiliationId',
      required: true,
      schema: { kind: 'integer', nullable: false },
      sourceRequired: false,
    },
  ]);

  for (const key of [
    'POST /api/v4/oauth/revoke',
    'POST /api/v4/oauth/token',
  ] as const) {
    const operation = V4_OPERATION_MANIFEST[key];
    assert.equal(operation.requestBody?.source, 'gateway-supplement');
    assert.equal(operation.requestBody?.effectiveRequired, true);
    assert.equal(
      operation.requestBody?.canonicalMediaType,
      'application/x-www-form-urlencoded',
    );
    assert.equal(operation.runtime.enabled, true);
    assert.equal(operation.runtime.policy, 'supplemented');
    assert.equal(operation.runtime.supplement, operation.requestBody?.supplement);
    assert.deepEqual(operation.runtime.requiredSecurity, {
      appAuthentication: 'server-owned-x-client-headers',
      browserCors: 'exact-origin',
      callerAuthorization: 'reject',
      forwardEtag: false,
      responseCache: 'no-store',
      responsePragma: 'no-cache',
      upstreamAttempts: 1,
    });
  }
  assert.equal(
    entries.filter((operation) => !operation.runtime.enabled).length,
    0,
  );
  assert.equal(
    entries.filter((operation) => operation.runtime.policy === 'generated')
      .length,
    81,
  );
  assert.equal(
    entries.filter((operation) => operation.runtime.policy === 'supplemented')
      .length,
    2,
  );
  assert.equal(
    entries.filter(
      (operation) =>
        operation.method !== 'GET' &&
        operation.runtime.enabled &&
        operation.requestBody === null,
    ).length,
    3,
  );
});

test('global rate-limit and user access responses merge without duplicates', () => {
  const sourceCounts = {
    openapi: 0,
    'gateway-global': 0,
    'access-global': 0,
  };
  let rateLimitedOperations = 0;
  let userOperations = 0;
  for (const operation of Object.values(V4_OPERATION_MANIFEST)) {
    assert.deepEqual(operation.responses['429'], {
      mediaTypes: ['application/json'],
      requiredHeaders: ['retry-after'],
      source: 'gateway-global',
    });
    rateLimitedOperations += 1;
    assert.equal(
      Object.keys(operation.responses).length,
      new Set(Object.keys(operation.responses)).size,
    );
    for (const response of Object.values(operation.responses)) {
      sourceCounts[response.source] += 1;
    }

    if (operation.access.class === 'user') {
      userOperations += 1;
      const responses: Readonly<Record<string, V4ResponseContract>> =
        operation.responses;
      for (const status of ['401', '403'] as const) {
        const response = responses[status];
        assert.notEqual(response, undefined);
        assert.deepEqual(response?.mediaTypes, ['application/json']);
        assert.ok(
          response?.source === 'openapi' ||
            response?.source === 'access-global',
        );
      }
    }
  }
  assert.deepEqual(sourceCounts, {
    openapi: 165,
    'gateway-global': 83,
    'access-global': 29,
  });
  assert.equal(rateLimitedOperations, 83);
  assert.equal(userOperations, 28);
});
