import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { resolve } from 'node:path';
import test from 'node:test';

interface ToolResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

const repositoryRoot = resolve(import.meta.dirname, '../..');

function runTool(
  name: string,
  arguments_: readonly string[],
): Promise<ToolResult> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(
      process.execPath,
      [resolve(repositoryRoot, 'tool', name), ...arguments_],
      { cwd: repositoryRoot, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', (code) => resolveResult({ code, stdout, stderr }));
  });
}

async function listenOnLoopback(server: Server): Promise<number> {
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolveListen();
    });
  });
  const address = server.address();
  assert.ok(address !== null && typeof address !== 'string');
  return address.port;
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolveClose, reject) => {
    server.close((error) =>
      error === undefined ? resolveClose() : reject(error),
    );
  });
}

test(
  'mock load exercises bounded concurrency without a real upstream',
  { timeout: 10_000 },
  async () => {
    const result = await runTool('mock-load.mjs', [
      '--requests',
      '32',
      '--client-concurrency',
      '16',
      '--gateway-concurrency',
      '4',
      '--upstream-delay-ms',
      '20',
      '--health-probes',
      '5',
    ]);

    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stderr, '');
    const report = JSON.parse(result.stdout) as {
      mode: string;
      config: { requests: number; gatewayConcurrency: number };
      durationMs: number;
      throughput: {
        aggregateResponsesPerSecond: number;
        successfulResponsesPerSecond: number;
      };
      responses: Record<string, number>;
      errors: Record<string, number>;
      upstream: { calls: number; maximumConcurrency: number };
      health: { probes: number; maximumLatencyMs: number };
    };
    assert.equal(report.mode, 'mock-only');
    assert.equal(report.config.requests, 32);
    assert.equal(
      (report.responses['200'] ?? 0) + (report.responses['503'] ?? 0),
      32,
    );
    assert.ok((report.responses['200'] ?? 0) > 0);
    assert.ok((report.responses['503'] ?? 0) > 0);
    assert.ok(
      report.throughput.aggregateResponsesPerSecond >
        report.throughput.successfulResponsesPerSecond,
    );
    assert.ok(report.throughput.successfulResponsesPerSecond > 0);
    assert.ok(
      Math.abs(
        report.throughput.successfulResponsesPerSecond /
          report.throughput.aggregateResponsesPerSecond -
          (report.responses['200'] ?? 0) / report.config.requests,
      ) < 0.01,
    );
    assert.equal(report.errors.overloaded, report.responses['503']);
    assert.equal(report.upstream.calls, report.responses['200']);
    assert.equal(report.upstream.maximumConcurrency, 4);
    assert.equal(report.health.probes, 5);
    assert.ok(report.health.maximumLatencyMs < 1_000);
  },
);

test('mock load rejects unsafe volume and remote URL options before starting', async () => {
  const excessive = await runTool('mock-load.mjs', [
    '--requests',
    '5001',
  ]);
  assert.equal(excessive.code, 64);
  assert.match(excessive.stderr, /between 16 and 5000/u);
  assert.equal(excessive.stdout, '');

  const tooFewRequests = await runTool('mock-load.mjs', [
    '--requests',
    '16',
    '--client-concurrency',
    '17',
    '--gateway-concurrency',
    '16',
  ]);
  assert.equal(tooFewRequests.code, 64);
  assert.match(tooFewRequests.stderr, /requests must exceed/u);
  assert.equal(tooFewRequests.stdout, '');

  const remote = await runTool('mock-load.mjs', [
    '--base-url',
    'https://solved.ac/',
  ]);
  assert.equal(remote.code, 64);
  assert.match(remote.stderr, /unsupported option/u);
  assert.equal(remote.stdout, '');
});

test('live smoke refuses network access without an explicit confirmation', async () => {
  const result = await runTool('live-smoke.mjs', [
    '--base-url',
    'https://example.invalid/',
  ]);
  assert.equal(result.code, 64);
  assert.match(result.stderr, /--confirm-live-smoke is required/u);
  assert.equal(result.stdout, '');

  const credentialsInUrl = await runTool('live-smoke.mjs', [
    '--base-url',
    'https://user:must-not-be-supported@example.invalid/',
    '--confirm-live-smoke',
  ]);
  assert.equal(credentialsInUrl.code, 64);
  assert.match(credentialsInUrl.stderr, /cannot contain credentials/u);
  assert.doesNotMatch(credentialsInUrl.stderr, /must-not-be-supported/u);
  assert.equal(credentialsInUrl.stdout, '');

  const secretOption = await runTool('live-smoke.mjs', [
    '--base-url',
    'https://example.invalid/',
    '--client-secret',
    'must-not-be-supported',
    '--confirm-live-smoke',
  ]);
  assert.equal(secretOption.code, 64);
  assert.match(secretOption.stderr, /only --base-url/u);
  assert.doesNotMatch(secretOption.stderr, /must-not-be-supported/u);
});

test(
  'confirmed live smoke is ordered, credential-free, output-safe, and rejects redirects',
  { timeout: 10_000 },
  async () => {
    type FixtureMode = 'success' | 'health-failure' | 'tag-redirect';
    interface ObservedRequest {
      readonly method: string | undefined;
      readonly path: string | undefined;
      readonly forbiddenHeaders: readonly unknown[];
    }

    let mode: FixtureMode = 'success';
    const observedRequests: ObservedRequest[] = [];
    const server = createServer((request, response) => {
      observedRequests.push({
        method: request.method,
        path: request.url,
        forbiddenHeaders: [
          request.headers.authorization,
          request.headers['proxy-authorization'],
          request.headers.cookie,
          request.headers['x-client-id'],
          request.headers['x-client-secret'],
        ],
      });

      const commonHeaders = {
        'content-type': 'application/json',
        'set-cookie': 'fixture-cookie-secret=must-not-appear',
        'x-fixture-secret': 'fixture-header-secret-must-not-appear',
      };
      if (request.url === '/healthz') {
        response.writeHead(mode === 'health-failure' ? 503 : 200, commonHeaders);
        response.end('{"fixtureBodySecret":"must-not-appear"}');
        return;
      }
      if (request.url === '/solved/v4/tags') {
        if (mode === 'tag-redirect') {
          response.writeHead(302, {
            ...commonHeaders,
            location: '/redirect-target-must-not-be-requested',
          });
        } else {
          response.writeHead(200, {
            ...commonHeaders,
            'retry-after': '7',
            'x-ratelimit-limit': '300',
            'x-ratelimit-remaining': '299',
          });
        }
        response.end('{"fixtureBodySecret":"must-not-appear"}');
        return;
      }
      response.writeHead(500, commonHeaders);
      response.end('{"unexpected":true}');
    });

    const requestSnapshot = (): ObservedRequest[] =>
      observedRequests.splice(0, observedRequests.length);
    const assertSafeRequests = (requests: readonly ObservedRequest[]): void => {
      for (const request of requests) {
        assert.equal(request.method, 'GET');
        assert.deepEqual(request.forbiddenHeaders, [
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
        ]);
      }
    };

    const port = await listenOnLoopback(server);
    const confirmedArguments = [
      '--base-url',
      `http://127.0.0.1:${port}/`,
      '--confirm-live-smoke',
    ];
    try {
      const success = await runTool('live-smoke.mjs', confirmedArguments);
      assert.equal(success.code, 0, success.stderr);
      assert.equal(success.stderr, '');
      const successRequests = requestSnapshot();
      assert.deepEqual(
        successRequests.map((request) => request.path),
        ['/healthz', '/solved/v4/tags'],
      );
      assertSafeRequests(successRequests);
      assert.doesNotMatch(success.stdout, /must-not-appear/u);

      const report = JSON.parse(success.stdout) as {
        mode: string;
        requests: number;
        results: Array<Record<string, unknown>>;
      };
      assert.equal(report.mode, 'live-smoke');
      assert.equal(report.requests, 2);
      assert.equal(report.results.length, 2);
      const safeMetricKeys = [
        'durationMs',
        'path',
        'rateLimit',
        'rateLimitRemaining',
        'retryAfter',
        'status',
      ];
      for (const result of report.results) {
        assert.deepEqual(Object.keys(result).sort(), safeMetricKeys);
      }
      assert.deepEqual(report.results[1], {
        path: 'solved/v4/tags',
        status: 200,
        durationMs: report.results[1]?.durationMs,
        rateLimit: '300',
        rateLimitRemaining: '299',
        retryAfter: '7',
      });

      mode = 'health-failure';
      const unhealthy = await runTool('live-smoke.mjs', confirmedArguments);
      assert.equal(unhealthy.code, 64);
      assert.equal(unhealthy.stdout, '');
      assert.match(unhealthy.stderr, /healthz returned HTTP 503/u);
      const unhealthyRequests = requestSnapshot();
      assert.deepEqual(
        unhealthyRequests.map((request) => request.path),
        ['/healthz'],
      );
      assertSafeRequests(unhealthyRequests);

      mode = 'tag-redirect';
      const redirect = await runTool('live-smoke.mjs', confirmedArguments);
      assert.equal(redirect.code, 64);
      assert.equal(redirect.stdout, '');
      assert.match(redirect.stderr, /live smoke refused/u);
      const redirectRequests = requestSnapshot();
      assert.deepEqual(
        redirectRequests.map((request) => request.path),
        ['/healthz', '/solved/v4/tags'],
      );
      assertSafeRequests(redirectRequests);
    } finally {
      await closeServer(server);
    }
  },
);
