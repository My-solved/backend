#!/usr/bin/env node

import { performance } from 'node:perf_hooks';

const CONFIRMATION = '--confirm-live-smoke';

function usage() {
  process.stdout.write(`Usage:\n\
  node tool/live-smoke.mjs --base-url https://gateway.example/ ${CONFIRMATION}\n\n\
The command sends at most two GET requests: /healthz, then /solved/v4/tags\n\
only after the health request succeeds.\n\
It never accepts or sends solved.ac client credentials.\n`);
}

function normalizeBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('--base-url must be an absolute URL');
  }
  if (
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error('--base-url cannot contain credentials, query, or fragment');
  }
  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && localHosts.has(url.hostname))
  ) {
    throw new Error('--base-url must use HTTPS (HTTP is allowed only on loopback)');
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}

function parseOptions(arguments_) {
  if (arguments_.includes('--help')) {
    usage();
    return undefined;
  }
  const confirmationCount = arguments_.filter(
    (value) => value === CONFIRMATION,
  ).length;
  if (confirmationCount !== 1) {
    throw new Error(`${CONFIRMATION} is required exactly once`);
  }
  const filtered = arguments_.filter((value) => value !== CONFIRMATION);
  if (filtered.length !== 2 || filtered[0] !== '--base-url') {
    throw new Error('only --base-url and the confirmation flag are supported');
  }
  return normalizeBaseUrl(filtered[1]);
}

async function probe(baseUrl, path) {
  const target = new URL(path, baseUrl);
  const startedAt = performance.now();
  const response = await fetch(target, {
    method: 'GET',
    headers: { accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(8_000),
  });
  const metrics = {
    path,
    status: response.status,
    durationMs: Number((performance.now() - startedAt).toFixed(2)),
    rateLimit: response.headers.get('x-ratelimit-limit'),
    rateLimitRemaining: response.headers.get('x-ratelimit-remaining'),
    retryAfter: response.headers.get('retry-after'),
  };
  await response.body?.cancel();
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`);
  }
  return metrics;
}

try {
  const baseUrl = parseOptions(process.argv.slice(2));
  if (baseUrl !== undefined) {
    const results = [];
    results.push(await probe(baseUrl, 'healthz'));
    results.push(await probe(baseUrl, 'solved/v4/tags'));
    process.stdout.write(
      `${JSON.stringify({ mode: 'live-smoke', requests: 2, results })}\n`,
    );
  }
} catch (error) {
  process.stderr.write(
    `live smoke refused: ${error instanceof Error ? error.message : 'unknown error'}\n`,
  );
  process.exitCode = 64;
}
