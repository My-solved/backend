import { createServer, type Server } from 'node:http';
import { pathToFileURL } from 'node:url';

import {
  createRequestHandler,
  DEFAULT_MAX_CONCURRENT_REQUESTS,
} from './adapters/http/gateway-handler.js';
import {
  loadProtectedCorsOrigins,
  loadSolvedClientCredentials,
} from './infrastructure/runtime-config.js';
import {
  DEFAULT_MAX_RESPONSE_BYTES,
  DEFAULT_UPSTREAM_TIMEOUT_MS,
} from './adapters/solved/solved-client.js';

const DEFAULT_PORT = 3_000;
const DEFAULT_HOST = '0.0.0.0';
const SHUTDOWN_GRACE_MS = 10_000;

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || !/^[1-9]\d*$/u.test(value)) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

export function startServer(): Server {
  const port = readPositiveInteger(process.env.PORT, DEFAULT_PORT);
  const host = process.env.HOST?.trim() || DEFAULT_HOST;
  const timeoutMs = readPositiveInteger(
    process.env.REQUEST_TIMEOUT_MS,
    DEFAULT_UPSTREAM_TIMEOUT_MS,
  );
  const maxResponseBytes = readPositiveInteger(
    process.env.MAX_RESPONSE_BYTES,
    DEFAULT_MAX_RESPONSE_BYTES,
  );
  const maxConcurrentRequests = readPositiveInteger(
    process.env.MAX_CONCURRENT_REQUESTS,
    DEFAULT_MAX_CONCURRENT_REQUESTS,
  );
  const credentials = loadSolvedClientCredentials();
  const protectedCorsOrigins = loadProtectedCorsOrigins();
  const server = createServer(
    createRequestHandler({
      timeoutMs,
      maxResponseBytes,
      maxConcurrentRequests,
      credentials,
      protectedCorsOrigins,
    }),
  );

  server.requestTimeout = timeoutMs + 5_000;
  server.headersTimeout = Math.min(server.requestTimeout, 15_000);
  server.keepAliveTimeout = 5_000;

  const shutdown = (): void => {
    const forceCloseTimer = setTimeout(() => {
      server.closeAllConnections();
    }, SHUTDOWN_GRACE_MS);
    forceCloseTimer.unref();

    server.close((error) => {
      clearTimeout(forceCloseTimer);
      if (error !== undefined) {
        process.exitCode = 1;
      }
    });
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  server.listen(port, host, () => {
    process.stdout.write(`solved-proxy listening on ${host}:${port}\n`);
  });
  return server;
}

const entrypoint = process.argv[1];
if (
  entrypoint !== undefined &&
  import.meta.url === pathToFileURL(entrypoint).href
) {
  startServer();
}
