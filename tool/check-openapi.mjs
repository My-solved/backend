import { checkSnapshot } from './openapi-contract.mjs';

try {
  const { manifest, metrics } = await checkSnapshot();
  process.stdout.write(
    `Official solved.ac v4 OpenAPI snapshot verified: ${metrics.pathCount} paths, ${metrics.operationCount} operations.\nSource SHA-256: ${manifest.sourceSha256}\nSnapshot SHA-256: ${manifest.snapshotSha256}\n`,
  );
} catch {
  process.stderr.write('Official OpenAPI snapshot verification failed.\n');
  process.exitCode = 1;
}
