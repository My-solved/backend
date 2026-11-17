import assert from 'node:assert/strict';
import test from 'node:test';

import { ContractError, resolveProxyRequest } from '../src/contract.js';
import { ROUTES } from '../src/routes.js';

const gatewayUrl = (requestTarget: string): URL =>
  new URL(requestTarget, 'http://gateway.invalid');

test('the public surface is limited to the 15 compatibility routes', () => {
  assert.equal(Object.keys(ROUTES).length, 15);
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
    const { upstreamUrl } = resolveProxyRequest(gatewayUrl(requestTarget));
    assert.equal(upstreamUrl.href, `https://solved.ac/api/v3/${upstreamTarget}`);
  });
}

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
});
