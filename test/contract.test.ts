import assert from 'node:assert/strict';
import test from 'node:test';

import { ContractError, resolveProxyRequest } from '../src/contract.js';
import { ROUTES } from '../src/routes.js';

const gatewayUrl = (requestTarget: string): URL =>
  new URL(requestTarget, 'http://gateway.invalid');

test('the public surface is limited to 15 v3 and 9 v4 routes', () => {
  assert.equal(Object.keys(ROUTES).length, 24);
});

const mappings = [
  ['/solved/user/show?handle=tourist', 'user/show?handle=tourist'],
  [
    '/solved/user/organizations?handle=tourist',
    'user/organizations?handle=tourist',
  ],
  [
    '/solved/user/available_badges?handle=tourist',
    'user/available_badges?handle=tourist',
  ],
  [
    '/solved/user/grass?handle=tourist',
    'user/grass?handle=tourist&topic=default',
  ],
  ['/solved/user/top_100?handle=tourist', 'user/top_100?handle=tourist'],
  [
    '/solved/user/problem_stats?handle=tourist',
    'user/problem_stats?handle=tourist',
  ],
  [
    '/solved/user/tag_ratings?handle=tourist',
    'user/tag_ratings?handle=tourist',
  ],
  [
    '/solved/background/show?backgroundId=balloon',
    'background/show?backgroundId=balloon',
  ],
  ['/solved/badge/show?badgeId=bronze', 'badge/show?badgeId=bronze'],
  ['/solved/search/suggestion?query=rsa', 'search/suggestion?query=rsa'],
  [
    '/solved/search/problem?query=rsa',
    'search/problem?query=rsa&page=1&sort=solved&direction=descending',
  ],
  ['/solved/search/user?query=rsa', 'search/user?query=rsa&page=1'],
  ['/solved/search/tag?query=rsa', 'search/tag?query=rsa&page=1'],
  ['/solved/arena/contests', 'arena/contests'],
  ['/solved/site/stats', 'site/stats'],
] as const;

for (const [requestTarget, upstreamTarget] of mappings) {
  test(`maps ${requestTarget}`, () => {
    const { upstreamUrl, apiVersion } = resolveProxyRequest(
      gatewayUrl(requestTarget),
    );
    assert.equal(apiVersion, 'v3');
    assert.equal(upstreamUrl.href, `https://solved.ac/api/v3/${upstreamTarget}`);
  });
}

const v4Mappings = [
  ['/solved/v4/users/tourist', 'users/tourist'],
  [
    '/solved/v4/users/tourist/activity/days?from=2026-01-01&to=2026-11-17',
    'users/tourist/activity/days?from=2026-01-01&to=2026-11-17',
  ],
  [
    '/solved/v4/users/tourist/reputation?range=1y',
    'users/tourist/reputation?range=1y',
  ],
  [
    '/solved/v4/users/tourist/contributions?page=2&limit=20&sort=helpful&only=vouched&commented=true',
    'users/tourist/contributions?page=2&limit=20&sort=helpful&only=vouched&commented=true',
  ],
  [
    '/solved/v4/problems?q=%23dp&page=2&sort=solved&direction=desc&seed=stable',
    'problems?page=2&q=%23dp&sort=solved&direction=desc&seed=stable',
  ],
  [
    '/solved/v4/rankings/users/search?q=tourist&sort=rating',
    'rankings/users/search?q=tourist&sort=rating',
  ],
  ['/solved/v4/tags', 'tags'],
  ['/solved/v4/tags/dynamic_programming', 'tags/dynamic_programming'],
  [
    '/solved/v4/achievements/items/background/anniversary_1st?lang=ko',
    'achievements/items/background/anniversary_1st?lang=ko',
  ],
] as const;

for (const [requestTarget, upstreamTarget] of v4Mappings) {
  test(`maps v4 route ${requestTarget}`, () => {
    const { upstreamUrl, apiVersion } = resolveProxyRequest(
      gatewayUrl(requestTarget),
    );
    assert.equal(apiVersion, 'v4');
    assert.equal(upstreamUrl.href, `https://solved.ac/api/v4/${upstreamTarget}`);
  });
}

test('canonicalizes and encodes v4 path parameters exactly once', () => {
  const { upstreamUrl } = resolveProxyRequest(
    gatewayUrl('/solved/v4/users/%ED%95%9C%EA%B8%80'),
  );
  assert.equal(
    upstreamUrl.href,
    'https://solved.ac/api/v4/users/%ED%95%9C%EA%B8%80',
  );
  assert.doesNotMatch(upstreamUrl.href, /%25ED/u);
});

test('preserves supported search options', () => {
  const { upstreamUrl } = resolveProxyRequest(
    gatewayUrl(
      '/solved/search/problem?query=graph&page=2&sort=average_try&direction=asc&seed=stable',
    ),
  );
  assert.equal(
    upstreamUrl.href,
    'https://solved.ac/api/v3/search/problem?query=graph&page=2&sort=average_try&direction=asc&seed=stable',
  );
});

test('encodes solved.ac search syntax and Unicode exactly once', () => {
  const { upstreamUrl } = resolveProxyRequest(
    gatewayUrl('/solved/search/problem?query=%23dp+%40tourist+%ED%95%9C%EA%B8%80'),
  );
  assert.equal(upstreamUrl.searchParams.get('query'), '#dp @tourist 한글');
  assert.match(upstreamUrl.href, /query=%23dp\+%40tourist\+%ED%95%9C%EA%B8%80/u);
  assert.doesNotMatch(upstreamUrl.href, /%2523/u);
});

test('distinguishes a present empty search query from a missing query', () => {
  const { upstreamUrl } = resolveProxyRequest(
    gatewayUrl('/solved/search/problem?query='),
  );
  assert.equal(upstreamUrl.searchParams.get('query'), '');
  assert.throws(
    () => resolveProxyRequest(gatewayUrl('/solved/search/problem')),
    (error: unknown) =>
      error instanceof ContractError &&
      error.status === 400 &&
      error.code === 'invalid_query',
  );
});

const invalidRequests = [
  '/solved/user/show',
  '/solved/user/show?handle=',
  '/solved/user/show?handle=a&handle=b',
  '/solved/user/show?handle=a&token=secret',
  '/solved/user/show?handle=line%0Abreak',
  `/solved/user/show?handle=${'a'.repeat(257)}`,
  '/solved/search/user?query=a&page=0',
  '/solved/search/user?query=a&page=10001',
  '/solved/search/user?query=a&page=1.5',
  '/solved/search/problem?query=a&sort=unknown',
  '/solved/search/problem?query=a&direction=sideways',
  '/solved/v4/users/tourist/activity/days',
  '/solved/v4/users/tourist/activity/days?from=2026-01-01&to=invalid',
  '/solved/v4/users/tourist/reputation?range=forever',
  '/solved/v4/users/tourist/contributions?limit=21',
  '/solved/v4/problems?page=0',
  '/solved/v4/problems?direction=descending',
  '/solved/v4/rankings/users/search',
  '/solved/v4/rankings/users/search?q=a&page=1',
] as const;

for (const requestTarget of invalidRequests) {
  test(`rejects invalid query contract: ${requestTarget.slice(0, 80)}`, () => {
    assert.throws(
      () => resolveProxyRequest(gatewayUrl(requestTarget)),
      (error: unknown) =>
        error instanceof ContractError &&
        error.status === 400 &&
        error.code === 'invalid_query',
    );
  });
}

test('rejects paths outside the allowlist', () => {
  assert.throws(
    () => resolveProxyRequest(gatewayUrl('/solved/problem/show?problemId=1000')),
    (error: unknown) =>
      error instanceof ContractError &&
      error.status === 404 &&
      error.code === 'not_found',
  );
  assert.throws(
    () =>
      resolveProxyRequest(
        gatewayUrl('/solved/v4/achievements/items/title/unknown'),
      ),
    (error: unknown) =>
      error instanceof ContractError &&
      error.status === 404 &&
      error.code === 'not_found',
  );
  assert.throws(
    () => resolveProxyRequest(gatewayUrl('/solved/v4/users/%2Fetc')),
    (error: unknown) =>
      error instanceof ContractError &&
      error.status === 404 &&
      error.code === 'not_found',
  );
});

test('preserves the upstream problem-search limit response contract', () => {
  const query = 'q'.repeat(101);
  const { upstreamUrl } = resolveProxyRequest(
    gatewayUrl(`/solved/v4/problems?q=${query}`),
  );

  assert.equal(upstreamUrl.searchParams.get('q'), query);
});

for (const encodedSegment of ['%252Fetc', '%252e%252e', '%255cetc', '%25']) {
  test(`rejects double-encoded path data: ${encodedSegment}`, () => {
    assert.throws(
      () =>
        resolveProxyRequest(
          gatewayUrl(`/solved/v4/users/${encodedSegment}`),
        ),
      (error: unknown) =>
        error instanceof ContractError &&
        error.status === 404 &&
        error.code === 'not_found',
    );
  });
}
