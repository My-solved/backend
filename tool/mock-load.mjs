#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { performance } from 'node:perf_hooks';

import { createRequestHandler } from '../dist/src/app.js';

const LIMITS = Object.freeze({
  requests: Object.freeze({ default: 256, minimum: 16, maximum: 5_000 }),
  clientConcurrency: Object.freeze({ default: 32, minimum: 2, maximum: 128 }),
  gatewayConcurrency: Object.freeze({ default: 8, minimum: 1, maximum: 64 }),
  upstreamDelayMs: Object.freeze({ default: 40, minimum: 1, maximum: 1_000 }),
  healthProbes: Object.freeze({ default: 12, minimum: 1, maximum: 100 }),
});

const OPTION_NAMES = Object.freeze({
  '--requests': 'requests',
  '--client-concurrency': 'clientConcurrency',
  '--gateway-concurrency': 'gatewayConcurrency',
  '--upstream-delay-ms': 'upstreamDelayMs',
  '--health-probes': 'healthProbes',
});

const SATURATION_TIMEOUT_MS = 5_000;

function usage() {
  process.stdout.write(`Usage: node tool/mock-load.mjs [options]\n\n\
This command only calls a loopback gateway with an injected in-memory upstream.\n\
It has no option for a solved.ac or remote URL.\n\n\
Options:\n\
  --requests N             ${LIMITS.requests.minimum}..${LIMITS.requests.maximum} (default ${LIMITS.requests.default})\n\
  --client-concurrency N   ${LIMITS.clientConcurrency.minimum}..${LIMITS.clientConcurrency.maximum} (default ${LIMITS.clientConcurrency.default})\n\
  --gateway-concurrency N  ${LIMITS.gatewayConcurrency.minimum}..${LIMITS.gatewayConcurrency.maximum} (default ${LIMITS.gatewayConcurrency.default})\n\
  --upstream-delay-ms N    ${LIMITS.upstreamDelayMs.minimum}..${LIMITS.upstreamDelayMs.maximum} (default ${LIMITS.upstreamDelayMs.default})\n\
  --health-probes N        ${LIMITS.healthProbes.minimum}..${LIMITS.healthProbes.maximum} (default ${LIMITS.healthProbes.default})\n\
  --help\n`);
}

function parseInteger(name, rawValue, limit) {
  if (!/^[1-9]\d*$/u.test(rawValue)) {
    throw new Error(`${name} must be a positive integer`);
  }
  const value = Number(rawValue);
  if (
    !Number.isSafeInteger(value) ||
    value < limit.minimum ||
    value > limit.maximum
  ) {
    throw new Error(
      `${name} must be between ${limit.minimum} and ${limit.maximum}`,
    );
  }
  return value;
}

function parseOptions(arguments_) {
  if (arguments_.includes('--help')) {
    usage();
    return undefined;
  }
  if (arguments_.length % 2 !== 0) {
    throw new Error('every option needs one value');
  }

  const values = {
    requests: LIMITS.requests.default,
    clientConcurrency: LIMITS.clientConcurrency.default,
    gatewayConcurrency: LIMITS.gatewayConcurrency.default,
    upstreamDelayMs: LIMITS.upstreamDelayMs.default,
    healthProbes: LIMITS.healthProbes.default,
  };
  const seen = new Set();
  for (let index = 0; index < arguments_.length; index += 2) {
    const option = arguments_[index];
    const rawValue = arguments_[index + 1];
    const property = OPTION_NAMES[option];
    if (property === undefined) {
      throw new Error(`unsupported option: ${option}`);
    }
    if (seen.has(option)) {
      throw new Error(`duplicate option: ${option}`);
    }
    seen.add(option);
    values[property] = parseInteger(option, rawValue, LIMITS[property]);
  }
  if (values.clientConcurrency <= values.gatewayConcurrency) {
    throw new Error(
      '--client-concurrency must exceed --gateway-concurrency to exercise overload handling',
    );
  }
  if (values.requests <= values.gatewayConcurrency) {
    throw new Error(
      '--requests must exceed --gateway-concurrency to exercise overload handling',
    );
  }
  return Object.freeze(values);
}

function abortableDelay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      callback();
    };
    const timer = setTimeout(() => finish(resolve), milliseconds);
    const abort = () => {
      clearTimeout(timer);
      finish(() => reject(new Error('mock upstream request aborted')));
    };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted === true) abort();
  });
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
}

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index] ?? 0;
}

async function waitForSaturation(saturation) {
  let timer;
  try {
    await Promise.race([
      saturation,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('gateway did not reach its concurrency cap')),
          SATURATION_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function run(options) {
  let markSaturated = () => {};
  const saturation = new Promise((resolve) => {
    markSaturated = resolve;
  });
  let releaseUpstream = () => {};
  const upstreamRelease = new Promise((resolve) => {
    releaseUpstream = resolve;
  });
  const counters = {
    fetchCalls: 0,
    activeUpstream: 0,
    maximumActiveUpstream: 0,
  };
  const mockFetch = async (input, init) => {
    const upstreamUrl = new URL(input.toString());
    assert.equal(upstreamUrl.origin, 'https://mock-v4.invalid');
    assert.match(upstreamUrl.pathname, /^\/api\/v4\/users\/load-\d+$/u);
    assert.equal(init?.method, 'GET');
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('x-client-id'), 'mock-client-id');
    assert.equal(headers.get('x-client-secret'), 'mock-client-secret');

    counters.fetchCalls += 1;
    counters.activeUpstream += 1;
    counters.maximumActiveUpstream = Math.max(
      counters.maximumActiveUpstream,
      counters.activeUpstream,
    );
    if (counters.activeUpstream === options.gatewayConcurrency) {
      markSaturated();
    }
    try {
      await upstreamRelease;
      await abortableDelay(options.upstreamDelayMs, init?.signal);
      return new Response('{"mock":true}', {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-ratelimit-limit': '300',
          'x-ratelimit-remaining': '299',
        },
      });
    } finally {
      counters.activeUpstream -= 1;
    }
  };

  const server = createServer(
    createRequestHandler({
      credentials: {
        clientId: 'mock-client-id',
        clientSecret: 'mock-client-secret',
      },
      fetch: mockFetch,
      maxConcurrentRequests: options.gatewayConcurrency,
      timeoutMs: options.upstreamDelayMs + 2_000,
      upstreamBaseUrl: 'https://mock-v4.invalid/api/v4/',
    }),
  );
  await listen(server);

  try {
    const address = server.address();
    assert.ok(address !== null && typeof address !== 'string');
    const gatewayBaseUrl = `http://127.0.0.1:${address.port}`;
    let nextRequest = 0;
    const responseCounts = new Map();
    const errorCounts = new Map();
    const start = performance.now();

    const loadWorker = async () => {
      for (;;) {
        const requestNumber = nextRequest;
        nextRequest += 1;
        if (requestNumber >= options.requests) return;
        const response = await fetch(
          `${gatewayBaseUrl}/solved/v4/users/load-${requestNumber}`,
        );
        responseCounts.set(
          response.status,
          (responseCounts.get(response.status) ?? 0) + 1,
        );
        const body = await response.json();
        if (response.status === 200) {
          assert.deepEqual(body, { mock: true });
          assert.equal(response.headers.get('x-ratelimit-limit'), '300');
        } else {
          const code = body.error;
          errorCounts.set(code, (errorCounts.get(code) ?? 0) + 1);
          assert.equal(response.status, 503);
          assert.equal(code, 'overloaded');
          assert.equal(response.headers.get('retry-after'), '1');
        }
      }
    };

    const loadPromise = Promise.all(
      Array.from({ length: options.clientConcurrency }, loadWorker),
    );
    let healthLatencies = [];
    let probeError;
    try {
      await waitForSaturation(saturation);
      healthLatencies = await Promise.all(
        Array.from({ length: options.healthProbes }, async () => {
          const probeStart = performance.now();
          const response = await fetch(`${gatewayBaseUrl}/healthz`);
          assert.equal(response.status, 200);
          assert.deepEqual(await response.json(), { status: 'ok' });
          return performance.now() - probeStart;
        }),
      );
    } catch (error) {
      probeError = error;
    } finally {
      releaseUpstream();
    }
    await loadPromise;
    if (probeError !== undefined) throw probeError;
    const durationMs = performance.now() - start;
    const successful = responseCounts.get(200) ?? 0;
    const overloaded = responseCounts.get(503) ?? 0;

    assert.equal(successful + overloaded, options.requests);
    assert.ok(successful > 0, 'at least one request must reach the mock upstream');
    assert.ok(overloaded > 0, 'load must exercise the overload response');
    assert.equal(counters.fetchCalls, successful);
    assert.equal(
      counters.maximumActiveUpstream,
      options.gatewayConcurrency,
      'load did not exercise the exact gateway concurrency cap',
    );
    assert.equal(errorCounts.get('overloaded'), overloaded);
    assert.ok(
      Math.max(...healthLatencies) < 1_000,
      'health endpoint stopped responding promptly under load',
    );

    return Object.freeze({
      mode: 'mock-only',
      config: options,
      durationMs: Number(durationMs.toFixed(2)),
      throughput: {
        aggregateResponsesPerSecond: Number(
          ((options.requests * 1_000) / durationMs).toFixed(2),
        ),
        successfulResponsesPerSecond: Number(
          ((successful * 1_000) / durationMs).toFixed(2),
        ),
      },
      responses: Object.fromEntries(
        [...responseCounts].sort(([left], [right]) => left - right),
      ),
      errors: Object.fromEntries([...errorCounts].sort()),
      upstream: {
        calls: counters.fetchCalls,
        maximumConcurrency: counters.maximumActiveUpstream,
      },
      health: {
        probes: healthLatencies.length,
        maximumLatencyMs: Number(Math.max(...healthLatencies).toFixed(2)),
        p95LatencyMs: Number(percentile(healthLatencies, 0.95).toFixed(2)),
      },
    });
  } finally {
    await close(server);
  }
}

try {
  const options = parseOptions(process.argv.slice(2));
  if (options !== undefined) {
    const report = await run(options);
    process.stdout.write(`${JSON.stringify(report)}\n`);
  }
} catch (error) {
  process.stderr.write(
    `mock load failed: ${error instanceof Error ? error.message : 'unknown error'}\n`,
  );
  process.exitCode = 64;
}
