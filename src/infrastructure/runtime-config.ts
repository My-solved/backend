import { readFileSync, statSync } from 'node:fs';

import type { SolvedClientCredentials } from '../domain/solved-client-credentials.js';

const MAX_CREDENTIAL_BYTES = 4_096;
const MAX_CORS_ORIGINS_BYTES = 8_192;
const MAX_CORS_ORIGINS = 32;
const MAX_LISTEN_HOST_BYTES = 253;
const MAX_PORT = 65_535;
const MAX_REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 5 * 1_024 * 1_024;
const MAX_CONCURRENT_REQUESTS = 8;

type RuntimeIntegerVariable =
  | 'PORT'
  | 'REQUEST_TIMEOUT_MS'
  | 'MAX_RESPONSE_BYTES'
  | 'MAX_CONCURRENT_REQUESTS';

export interface ServerRuntimeDefaults {
  readonly host: string;
  readonly port: number;
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
  readonly maxConcurrentRequests: number;
}

export type ServerRuntimeConfig = ServerRuntimeDefaults;

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

function readBoundedPositiveInteger(
  variableName: RuntimeIntegerVariable,
  environment: NodeJS.ProcessEnv,
  fallback: number,
  maximum: number,
): number {
  if (
    !Number.isSafeInteger(fallback) ||
    fallback < 1 ||
    fallback > maximum
  ) {
    throw new TypeError(`Invalid default for ${variableName}`);
  }

  const raw = environment[variableName];
  if (raw === undefined) return fallback;
  if (!/^[1-9]\d*$/u.test(raw)) {
    throw new ConfigurationError(`${variableName} contains an invalid value`);
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    throw new ConfigurationError(`${variableName} contains an invalid value`);
  }
  return parsed;
}

function readListenHost(
  environment: NodeJS.ProcessEnv,
  fallback: string,
): string {
  if (
    fallback.length === 0 ||
    fallback.trim() !== fallback ||
    Buffer.byteLength(fallback, 'utf8') > MAX_LISTEN_HOST_BYTES ||
    /[\u0000-\u001f\u007f]/u.test(fallback)
  ) {
    throw new TypeError('Invalid default for HOST');
  }

  const host = environment.HOST;
  if (host === undefined) return fallback;
  if (
    host.length === 0 ||
    host.trim() !== host ||
    Buffer.byteLength(host, 'utf8') > MAX_LISTEN_HOST_BYTES ||
    /[\u0000-\u001f\u007f]/u.test(host)
  ) {
    throw new ConfigurationError('HOST contains an invalid value');
  }
  return host;
}

export function loadServerRuntimeConfig(
  environment: NodeJS.ProcessEnv,
  defaults: ServerRuntimeDefaults,
): ServerRuntimeConfig {
  return Object.freeze({
    host: readListenHost(environment, defaults.host),
    port: readBoundedPositiveInteger(
      'PORT',
      environment,
      defaults.port,
      MAX_PORT,
    ),
    timeoutMs: readBoundedPositiveInteger(
      'REQUEST_TIMEOUT_MS',
      environment,
      defaults.timeoutMs,
      MAX_REQUEST_TIMEOUT_MS,
    ),
    maxResponseBytes: readBoundedPositiveInteger(
      'MAX_RESPONSE_BYTES',
      environment,
      defaults.maxResponseBytes,
      MAX_RESPONSE_BYTES,
    ),
    maxConcurrentRequests: readBoundedPositiveInteger(
      'MAX_CONCURRENT_REQUESTS',
      environment,
      defaults.maxConcurrentRequests,
      MAX_CONCURRENT_REQUESTS,
    ),
  });
}

export function loadProtectedCorsOrigins(
  environment: NodeJS.ProcessEnv = process.env,
): readonly string[] {
  const raw = environment.SOLVED_PROTECTED_CORS_ORIGINS;
  if (raw === undefined || raw.length === 0) {
    return Object.freeze([]);
  }
  if (Buffer.byteLength(raw, 'utf8') > MAX_CORS_ORIGINS_BYTES) {
    throw new ConfigurationError(
      'SOLVED_PROTECTED_CORS_ORIGINS contains an invalid value',
    );
  }

  const candidates = raw.split(',').map((candidate) => candidate.trim());
  if (
    candidates.length > MAX_CORS_ORIGINS ||
    candidates.some((candidate) => candidate.length === 0)
  ) {
    throw new ConfigurationError(
      'SOLVED_PROTECTED_CORS_ORIGINS contains an invalid value',
    );
  }

  const origins: string[] = [];
  for (const candidate of candidates) {
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      throw new ConfigurationError(
        'SOLVED_PROTECTED_CORS_ORIGINS contains an invalid value',
      );
    }
    if (
      (url.protocol !== 'https:' && url.protocol !== 'http:') ||
      url.origin === 'null' ||
      url.username.length !== 0 ||
      url.password.length !== 0 ||
      url.pathname !== '/' ||
      url.search.length !== 0 ||
      url.hash.length !== 0 ||
      candidate !== url.origin ||
      origins.includes(url.origin)
    ) {
      throw new ConfigurationError(
        'SOLVED_PROTECTED_CORS_ORIGINS contains an invalid value',
      );
    }
    origins.push(url.origin);
  }
  return Object.freeze(origins);
}

function readCredential(
  variableName: 'SOLVED_CLIENT_ID_FILE' | 'SOLVED_CLIENT_SECRET_FILE',
  environment: NodeJS.ProcessEnv,
): string {
  const filePath = environment[variableName]?.trim();
  if (filePath === undefined || filePath.length === 0) {
    throw new ConfigurationError(`${variableName} is required`);
  }

  let size: number;
  let isFile: boolean;
  try {
    const status = statSync(filePath);
    size = status.size;
    isFile = status.isFile();
  } catch {
    throw new ConfigurationError(`${variableName} could not be read`);
  }
  if (!isFile || size > MAX_CREDENTIAL_BYTES + 2) {
    throw new ConfigurationError(`${variableName} contains an invalid value`);
  }

  let value: string;
  try {
    value = readFileSync(filePath, 'utf8').replace(/\r?\n$/u, '');
  } catch {
    throw new ConfigurationError(`${variableName} could not be read`);
  }

  if (
    value.length === 0 ||
    value.trim() !== value ||
    Buffer.byteLength(value, 'utf8') > MAX_CREDENTIAL_BYTES ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new ConfigurationError(`${variableName} contains an invalid value`);
  }
  return value;
}

export function loadSolvedClientCredentials(
  environment: NodeJS.ProcessEnv = process.env,
): SolvedClientCredentials {
  return Object.freeze({
    clientId: readCredential('SOLVED_CLIENT_ID_FILE', environment),
    clientSecret: readCredential('SOLVED_CLIENT_SECRET_FILE', environment),
  });
}
