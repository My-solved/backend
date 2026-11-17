# solved-proxy

`solved-proxy` is a small, stateless, credential-safe gateway for the official
solved.ac v4 API. Each deployment belongs to one registered solved.ac app and
injects that app's credentials only for reviewed `/solved/v4/*` operations.

The service has no database, cache, login flow, token persistence, BOJ
credential, or runtime package dependency. Its current runtime surface is
generated from the reviewed operation manifest and contains all 83 v4
operations: 71 `GET` operations, ten documented user mutations, and two
app-authenticated OAuth operations (`POST` 7, `PATCH` 3, `DELETE` 2). Fixed
`/solved/v4/*` templates map only to
their corresponding `https://solved.ac/api/v4/*` templates, with app
identifier and secret read from mounted configuration files.

All 28 user operations require exactly one RFC 6750 Bearer value. The four
public operations that carry a scope (`solves`, `bookmarks`, or `votes`) accept
one optionally and otherwise keep their anonymous semantics. The gateway does
not inspect or infer token scopes; solved.ac remains authoritative for user and
scope behavior. Malformed or duplicate Authorization is rejected instead of
downgrading to anonymous. Authorization on any other public operation is
ignored, and caller `Cookie`, `x-client-id`, and `x-client-secret` values are
never forwarded. The seven documented JSON mutations require a non-empty body,
while the other three user mutations reject one. OAuth rejects every caller
Authorization header and authenticates only with the deployment's app
credentials. Arbitrary upstream paths, unknown query parameters, and duplicate
query parameters remain unreachable.

Mutation bodies are capped at 64 KiB, decoded as fatal UTF-8, parsed with a
depth limit and duplicate-key rejection, and validated against the normalized
official request schema before canonical JSON bytes are sent upstream. The
gateway rejects undeclared media types, content encodings, ambiguous framing,
and `Expect` handshakes; it never forwards caller framing headers or retries a
mutation.

`POST /solved/v4/oauth/token` accepts the reviewed authorization-code or
refresh-token body as strict JSON or form data. `POST /solved/v4/oauth/revoke`
accepts only strict form data containing `token`. Both share the 64 KiB cap,
fatal UTF-8 and duplicate decoded-key checks, reject unknown or cross-variant
fields, and become deterministic form bytes behind an opaque validated type
before the single upstream POST.

All 32 token-aware operation responses are forced to `Cache-Control: no-store`
and have `ETag` removed, including anonymous calls to the four scoped-public
operations. The two OAuth routes additionally force `Pragma: no-cache` on
success and failure. Browser access to all 34 protected routes uses an exact
configured origin allowlist; OAuth preflight permits `Content-Type` but never
Authorization. Native/no-Origin requests remain available. Unscoped anonymous
public GETs retain wildcard CORS but never grant an Authorization preflight.

URI values are decoded once, checked against the generated path/query schemas,
and encoded once into the fixed upstream template. The gateway does not inject
OpenAPI defaults. Upstream statuses, JSON media types, and required headers are
checked against the operation response policy before a body is read; undeclared
responses fail as a generic `502 upstream_contract` instead of being passed
through.

`/healthz` is the local, quota-free process health endpoint.
`/solved/v4/health` is a distinct official v4 operation and is forwarded
upstream like the other manifest routes.

This repository is reusable, but a deployed instance is not a communal public
relay. Every forwarded request spends the operator's shared solved.ac app quota.
The default Compose configuration publishes the container port only on
loopback; any public reverse proxy must apply its own caller policy, request-rate
limits, and connection limits. CORS is not an access-control mechanism.

## Develop

Node.js 24 LTS is required.

```sh
npm ci
npm test
SOLVED_CLIENT_ID_FILE=/absolute/path/to/client-id \
SOLVED_CLIENT_SECRET_FILE=/absolute/path/to/client-secret \
  npm start
```

The build emits JavaScript to `dist/`. Tests use Node's built-in test runner and
stub upstream `fetch`; they need no external network access. The load-tool test
binds only an ephemeral loopback port.

## Source architecture

Runtime code is grouped into `domain`, `application`, inbound/outbound
`adapters`, and `infrastructure` layers; `src/server.ts` is the only root
TypeScript file and acts as the composition root. Generated OpenAPI artifacts
remain isolated under `src/generated`. The dependency direction and the one
documented gateway orchestration boundary are described in
[`ARCHITECTURE.md`](ARCHITECTURE.md) and enforced by an offline source-layout
test.

## Official OpenAPI contract

The complete machine-readable solved.ac v4 contract is pinned at
[`openapi/solved-v4.openapi.json`](openapi/solved-v4.openapi.json). It is a
canonical JSON snapshot of all 79 paths and 83 operations from
`https://backstage.solved.ac/api/v4/openapi`, not a product-specific selection.
[`openapi/solved-v4.openapi.manifest.json`](openapi/solved-v4.openapi.manifest.json)
records the fixed source URL plus byte counts and distinct SHA-256 values for
the fetched source bytes and the canonical committed snapshot. The source hash
records the fingerprint of the exact upstream response that produced the
snapshot; the snapshot hash is what offline verification recomputes. The
manifest deliberately has no fetched timestamp or other volatile field.

Check the committed files entirely offline:

```sh
npm run openapi:check
```

Updating is a deliberate, networked maintenance operation:

```sh
npm run openapi:update
npm run openapi:check
git diff -- openapi/
npm run openapi:types:update
npm run openapi:operations:update
npm test
```

The update command requires Node.js 24, sends no credentials, refuses
redirects, times out after 30 seconds, limits the response to 5 MiB, validates
the JSON content type and OpenAPI 3.1 production server, and replaces each
output file atomically. It fails closed when the reviewed path, operation,
method, `x-access.class`, parameter, request-body, response, operation-ID, or
component-schema counts change. Review and update those invariants in
`tool/openapi-contract.mjs` only after inspecting the upstream diff. The
committed snapshot preserves the source schemas and arrays as-is;
canonicalization only orders JSON object keys and formatting.

The application catalog compiles all 83 runtime-enabled operations into a
method-aware trie so same-path methods remain distinct and auditable. The HTTP
gateway resolves 71 reads, ten generated user mutations, and two supplemented
app/OAuth operations. The supplemented routes are enabled only while their
reviewed sensitive transport policy remains exact.

The current upstream document also has known gaps that must remain explicit in
follow-up generation rather than being silently guessed: it declares no
operation IDs or OpenAPI security schemes; access is described by `x-access`;
the OAuth token operation describes a form-or-JSON body only in prose; and the
revocation operation names its `token` parameter only in prose without stating
a media type. Neither OAuth operation has a `requestBody` schema. All seven
declared JSON request bodies omit `requestBody.required`, and the
affiliation-ranking path parameter is marked optional and nullable by the
source. The raw snapshot is authoritative and intentionally does not patch
those omissions.

### Generated wire types

The pinned snapshot generates two compile-time-only artifacts:

- `src/generated/solved-v4.openapi.d.ts` contains the complete OpenAPI 3.1 wire
  types produced by the exact dev dependency `openapi-typescript@7.13.0`.
- `src/generated/v4-wire-types.d.ts` maps all 83 operations by stable
  `METHOD /api/v4/path` keys and exports `V4Operation`, `PathParams`, `Query`,
  `RequestBody`, `ResponseStatus`, and `ResponseBody` helpers.

Regenerate and review them after deliberately updating the snapshot:

```sh
npm run openapi:types:update
git diff -- src/generated/
npm test
```

Normal tests run `npm run openapi:types:check`, which regenerates from local
files only and fails when either committed artifact is stale. Generated output
has no timestamp and object/member ordering is deterministic.

These are transport DTOs, not domain models. The gateway does not deserialize
or runtime-validate upstream responses against them. `RequestBody` describes a
declared payload shape but does not decide whether a body is required; that is
reserved for the reviewed runtime operation manifest. The OAuth token and
revocation bodies intentionally remain `never` because the official document
has no schemas for them. Gateway-only request contracts are generated from a
separate reviewed supplement so this official type surface is not edited or
disguised.

### Generated operation manifest

`src/generated/v4-operations.ts` is the pure-data runtime intake contract for
all 83 official operations. It is keyed by `METHOD /api/v4/path` and records
only fixed upstream/gateway templates, access class and scope, an explicit
`none`/`optional`/`required` Bearer policy, reviewed request schemas,
request-body policy, and allowed response status/media metadata. It does not
contain response DTOs and does not make any route reachable by itself.

The generated file combines the immutable official snapshot with the narrowly
reviewed policies in `openapi/solved-v4.gateway-overrides.json`. The overlay is
bound to the exact snapshot SHA-256 and currently makes four source gaps
explicit:

- every declared JSON body is required by the gateway even though all seven
  source `requestBody` objects omit `required`; an absent body is not `{}`;
- JSON request objects reject unknown properties, including the six source
  schemas that otherwise leave them open;
- the malformed nullable/optional `affiliationId` path parameter is required
  and non-null for gateway serialization;
- global `429`/`Retry-After` and user-operation `401`/`403` responses described
  by the top-level official contract are merged into operation response policy.

The separate `openapi/solved-v4.request-supplements.json` is bound to the same
snapshot plus the SHA-256 of each source description. It models the two OAuth
bodies without changing the raw OpenAPI: token has strict, exclusive
authorization-code and refresh-token variants over the documented JSON or
form media types; revoke has the documented `token` over the form media type
required by its normative RFC 7009 reference. Opaque values have no invented
field maximum; the runtime-wide body cap remains authoritative. Both operations
use the enabled `supplemented` policy with a dedicated strict parser, opaque
canonical form type, and app-only outbound transport.

The supplement also makes the activation boundary explicit: exact-origin
browser CORS, `no-store` plus `Pragma: no-cache`, no ETag, one upstream attempt,
server-owned app headers, and rejected caller Authorization. Defaults from
OpenAPI are retained as `annotationDefault` metadata and are never injected
into a request. Token exchange and revocation are never retried after a `429`,
contract failure, network failure, or timeout. A refresh token is rotated and
single-use: after a timeout the upstream processing state is ambiguous, so
callers must reconcile their sign-in state or reauthenticate according to
application policy instead of automatically resubmitting it.

`src/domain/request-json-schema.ts` validates parsed JSON values against this
normalized request grammar, including strict object keys and every array,
scalar, nullability, enum, pattern, and bound constraint. It has no HTTP body
parser or routing side effect. The inbound adapter combines it with strict
JSON/form parsers for the two supplemented OAuth routes and passes only opaque
validated JSON or canonical form bodies to the outbound adapter.

Regenerate or verify the manifest entirely from committed local files:

```sh
npm run openapi:operations:update
npm run openapi:operations:check
git diff -- openapi/solved-v4.gateway-overrides.json \
  openapi/solved-v4.request-supplements.json \
  src/generated/v4-operations.ts
```

Generation fails closed on new schema keywords, regexes, media types,
references, parameter serialization forms, access scopes, callbacks, webhooks,
or unused/stale override and supplement targets. The official normalized
grammar covers 151 request-schema roots and 199 recursive schema nodes; the
separately counted OAuth supplement covers 2 roots and 12 nodes. Runtime request
validators must count string length by Unicode code point, accept only canonical
safe integers, enforce exclusive unions, never coerce the string `null`, and
never apply annotation defaults.

## Load and smoke verification

Run the bounded mock load harness without solved.ac credentials or network
traffic:

```sh
npm run load:mock
npm run load:mock -- \
  --requests 512 \
  --client-concurrency 48 \
  --gateway-concurrency 8 \
  --upstream-delay-ms 40 \
  --health-probes 20
```

The harness starts the real gateway handler on an ephemeral loopback port and
injects an in-memory upstream at reserved `.invalid` origins. There is no remote
URL option. A release barrier holds the mock upstream at the configured cap
while health probes run, making the concurrency and responsiveness checks
deterministic. It also verifies overload accounting, credential injection into
the mock only, and rate-limit header forwarding. The JSON report separates
aggregate load-response throughput, including overload `503` responses, from
successful `200` response throughput. Hard limits cap a run at 5,000 requests,
128 client workers, 64 upstream slots, and 1 second of mock latency.

After a deployment has real server-side credentials, an explicit low-volume
smoke command can check the deployed gateway:

```sh
npm run smoke:live -- \
  --base-url https://gateway.example/ \
  --confirm-live-smoke
```

This command sends at most two `GET` requests. It checks `/healthz` first and
requests `/solved/v4/tags` only when health succeeds. It accepts no secret or
authorization option, prints no response body, rejects redirects, and reports
only status, latency, and safe rate-limit headers. The tag request consumes the
deployed app's real solved.ac quota, so do not use this command as a load
generator. Exhaustion and `429` behavior belong in the mock harness; production
load testing requires separate solved.ac approval.

Configuration is intentionally small:

| Variable | Default | Allowed values | Purpose |
| --- | ---: | --- | --- |
| `HOST` | `0.0.0.0` | non-empty, trimmed listen address (at most 253 bytes) | Listen address |
| `PORT` | `3000` | `1`–`65535` | Listen port |
| `REQUEST_TIMEOUT_MS` | `8000` | `1`–`10000` | solved.ac request deadline |
| `MAX_RESPONSE_BYTES` | `5242880` | `1`–`5242880` | Maximum upstream response size |
| `MAX_CONCURRENT_REQUESTS` | `8` | `1`–`8` | Concurrent non-health request cap |
| `SOLVED_PROTECTED_CORS_ORIGINS` | empty | canonical origin list | Comma-separated exact browser origins allowed to call token-aware and OAuth operations |
| `SOLVED_CLIENT_ID_FILE` | required | readable file path | File containing the solved.ac app client ID |
| `SOLVED_CLIENT_SECRET_FILE` | required | readable file path | File containing the solved.ac app client secret |

Omitting a listen or numeric variable selects its reviewed default. Defining
`HOST` with an empty, surrounding-whitespace, control-character, or oversized
value stops startup. Defining a numeric variable with an empty, non-canonical,
non-integer, zero, negative, unsafe, or out-of-range value also stops startup;
configuration errors never silently fall back. The
production response, concurrency, and timeout defaults are also their reviewed
upper bounds for the Compose resource profile. Lower them when a deployment
needs a stricter limit. Raising capacity requires reviewing the container memory
limit, shutdown grace, and bounded load evidence together in a code change.

The upstream origin is fixed in code to prevent this service from becoming an
open proxy. The configuration files are read once during startup; the process
refuses to listen if either path is missing, unreadable, empty, or not safe to
place in an HTTP header. The client ID is a public app identifier and may appear
in a downloadable OAuth client's authorization request, but this gateway still
loads its configured value and never trusts caller-supplied `x-client-id`. The
client secret is server-only: never place it in downloadable client code, a
Docker image, build argument, Compose environment value, or repository file.

`SOLVED_PROTECTED_CORS_ORIGINS` accepts at most 32 canonical `http://` or
`https://` origins with no path, query, fragment, wildcard, credentials, or
`null` origin. An empty value closes protected browser CORS while native clients
that send no Origin continue to work. Use HTTPS origins outside local
development. This setting controls browser response access only; it is not
authentication, authorization, or a substitute for edge rate limits.

## Run with Docker

```sh
SOLVED_CLIENT_ID_FILE=/absolute/host/path/client-id \
SOLVED_CLIENT_SECRET_FILE=/absolute/host/path/client-secret \
  docker compose up --build -d
curl --fail http://127.0.0.1:3000/healthz
```

The client-secret host file must be readable only by the deployment account;
using the same permissions for the client-ID file keeps deployment handling
uniform. Compose mounts them at `/run/secrets/solved_client_id` and
`/run/secrets/solved_client_secret`; only those in-container paths are exposed
through the process environment.

The runtime image contains only compiled application code and Node.js. It runs
as the unprivileged `node` user. Compose additionally enables a read-only root
filesystem, drops Linux capabilities, and publishes the port only on loopback.
No secret or `.env` file is copied into the image.

### Pull a published image

Successful pushes to `main` publish the Linux AMD64 image
`ghcr.io/OWNER/solved-proxy` to GitHub Container Registry. The workflow
creates these tags:

- `latest` and `main` for the latest successful `main` build
- `sha-<short-commit>` for a commit-traceable build

Container tags are mutable. For production, use the exact
`ghcr.io/OWNER/solved-proxy@sha256:DIGEST` value recorded in the successful
workflow summary. This keeps a redeploy on the same published image even if a
tag moves later. Pull and run it with the existing hardened Compose
configuration:

```sh
SOLVED_PROXY_IMAGE=ghcr.io/OWNER/solved-proxy@sha256:DIGEST \
SOLVED_CLIENT_ID_FILE=/absolute/host/path/client-id \
SOLVED_CLIENT_SECRET_FILE=/absolute/host/path/client-secret \
  docker compose pull solved-proxy

SOLVED_PROXY_IMAGE=ghcr.io/OWNER/solved-proxy@sha256:DIGEST \
SOLVED_CLIENT_ID_FILE=/absolute/host/path/client-id \
SOLVED_CLIENT_SECRET_FILE=/absolute/host/path/client-secret \
  docker compose up --no-build --detach solved-proxy
```

New GHCR packages are private by default. Before pulling, either make the
package public or log in to `ghcr.io` with an account and token that have read
access. This gateway's solved.ac client configuration remains in runtime host
files. In particular, the client secret is not a GitHub Actions secret and is
never included in the published image.

## Deploy behind a reverse proxy

The service has no dependency on an application backend. Keep it on a private
network or loopback interface and expose only the reviewed gateway paths through
an edge that enforces the deployment's caller and abuse policy.

Example Nginx location when the container is published on loopback port 3000:

```nginx
location /solved/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
}

location = /solved-healthz {
    proxy_pass http://127.0.0.1:3000/healthz;
}
```

Point the gateway monitor at `/solved-healthz`. Apply request-rate and
connection limits at the public reverse proxy as well; the application cap
protects upstream work but is not a replacement for edge abuse controls.

## Deployment policy

CI builds and tests the service and its image. The publication workflow runs
only for pushes to protected `main`, authenticates to GHCR with the
repository-scoped `GITHUB_TOKEN`, and has only `contents: read` and
`packages: write` permissions. Pull requests and unprotected tags never publish
images.

Image publication does not deploy to a host. Keep production deployment and
its runtime credential files behind a separate protected approval process.
