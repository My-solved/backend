import { createServer, type Server } from 'node:http';
import { pathToFileURL } from 'node:url';

import {
  createExpectationRejectionHandler,
  createRequestHandler,
  DEFAULT_MAX_CONCURRENT_REQUESTS,
} from './adapters/http/gateway-handler.js';
import {
  loadProtectedCorsOrigins,
  loadServerRuntimeConfig,
  loadSolvedClientCredentials,
} from './infrastructure/runtime-config.js';
import {
  DEFAULT_MAX_RESPONSE_BYTES,
  DEFAULT_UPSTREAM_TIMEOUT_MS,
} from './adapters/solved/solved-client.js';

const DEFAULT_PORT = 3_000;
const DEFAULT_HOST = '0.0.0.0';
const SHUTDOWN_GRACE_MS = 10_000;

export function startServer(): Server {
  const {
    host,
    port,
    timeoutMs,
    maxResponseBytes,
    maxConcurrentRequests,
  } = loadServerRuntimeConfig(process.env, {
    host: DEFAULT_HOST,
    port: DEFAULT_PORT,
    timeoutMs: DEFAULT_UPSTREAM_TIMEOUT_MS,
    maxResponseBytes: DEFAULT_MAX_RESPONSE_BYTES,
    maxConcurrentRequests: DEFAULT_MAX_CONCURRENT_REQUESTS,
  });
  const credentials = loadSolvedClientCredentials();
  const protectedCorsOrigins = loadProtectedCorsOrigins();
  const handlerOptions = {
    timeoutMs,
    maxResponseBytes,
    maxConcurrentRequests,
    credentials,
    protectedCorsOrigins,
  };
  const server = createServer();
  server.on('request', createRequestHandler(handlerOptions));
  const rejectExpectation = createExpectationRejectionHandler(handlerOptions);
  server.on('checkContinue', rejectExpectation);
  server.on('checkExpectation', rejectExpectation);

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
