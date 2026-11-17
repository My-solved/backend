import {
  MANIFEST_PATH,
  OFFICIAL_OPENAPI_URL,
  SNAPSHOT_PATH,
  canonicalJson,
  createManifest,
  createOfficialRequestInit,
  parseJsonBuffer,
  readLimitedResponseBody,
  validateJsonContentType,
  validateOpenApiDocument,
  writeFileAtomically,
} from './openapi-contract.mjs';

async function updateSnapshot() {
  const response = await fetch(
    OFFICIAL_OPENAPI_URL,
    createOfficialRequestInit(),
  );
  if (!response.ok || response.status !== 200) {
    throw new Error('the source request failed');
  }
  validateJsonContentType(response.headers.get('content-type'));

  const sourceBytes = await readLimitedResponseBody(response);
  const document = parseJsonBuffer(sourceBytes);
  validateOpenApiDocument(document);

  const snapshotBytes = Buffer.from(canonicalJson(document), 'utf8');
  const manifest = createManifest(sourceBytes, snapshotBytes);
  const manifestBytes = Buffer.from(canonicalJson(manifest), 'utf8');

  await writeFileAtomically(SNAPSHOT_PATH, snapshotBytes);
  await writeFileAtomically(MANIFEST_PATH, manifestBytes);

  process.stdout.write(
    `Updated the official solved.ac v4 OpenAPI snapshot.\nSource SHA-256: ${manifest.sourceSha256}\nSnapshot SHA-256: ${manifest.snapshotSha256}\n`,
  );
}

try {
  await updateSnapshot();
} catch {
  process.stderr.write('Failed to update the official OpenAPI snapshot.\n');
  process.exitCode = 1;
}
