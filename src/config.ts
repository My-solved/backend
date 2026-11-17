import { readFileSync, statSync } from 'node:fs';

const MAX_CREDENTIAL_BYTES = 4_096;

export interface SolvedClientCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
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
