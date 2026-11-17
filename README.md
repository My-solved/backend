# solved-proxy

`solved-proxy` is a small, stateless gateway between My.solved and the solved.ac
API. It supports the current `/solved/*` v3 client surface and exposes an
explicit `/solved/v4/*` allowlist for the official v4 API.

The service has no database, cache, login flow, user access token, BOJ
credential, or runtime package dependency. It accepts only allowlisted public
`GET` requests. v3 requests go to `https://solved.ac/api/v3/`; v4 requests go to
`https://solved.ac/api/v4/` with the app's client credentials injected from
mounted secret files.

## Supported routes

- `/solved/user/show`
- `/solved/user/organizations`
- `/solved/user/available_badges`
- `/solved/user/grass`
- `/solved/user/top_100`
- `/solved/user/problem_stats`
- `/solved/user/tag_ratings`
- `/solved/background/show`
- `/solved/badge/show`
- `/solved/search/suggestion`
- `/solved/search/problem`
- `/solved/search/user`
- `/solved/search/tag`
- `/solved/arena/contests`
- `/solved/site/stats`

Official v4 routes:

- `/solved/v4/users/{handle}`
- `/solved/v4/users/{handle}/activity/days`
- `/solved/v4/users/{handle}/reputation`
- `/solved/v4/users/{handle}/contributions`
- `/solved/v4/problems`
- `/solved/v4/rankings/users/search`
- `/solved/v4/tags`
- `/solved/v4/tags/{key}`
- `/solved/v4/achievements/items/{kind}/{key}`

Arbitrary upstream paths and query parameters are rejected. Request credentials
and cookies are never forwarded upstream. In particular, caller
`Authorization`, `Cookie`, `x-client-id`, and `x-client-secret` values are
ignored. `/healthz` is the only health endpoint.

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

| Variable | Default | Purpose |
| --- | ---: | --- |
| `HOST` | `0.0.0.0` | Listen address |
| `PORT` | `3000` | Listen port |
| `REQUEST_TIMEOUT_MS` | `8000` | solved.ac request deadline |
| `MAX_RESPONSE_BYTES` | `5242880` | Maximum upstream response size |
| `MAX_CONCURRENT_REQUESTS` | `8` | Concurrent non-health request cap |
| `SOLVED_CLIENT_ID_FILE` | required | File containing the solved.ac app client ID |
| `SOLVED_CLIENT_SECRET_FILE` | required | File containing the solved.ac app client secret |

The upstream origins are fixed in code to prevent this service from becoming
an open proxy. The secret file contents are read once during startup; the
process refuses to listen if either path is missing, unreadable, empty, or not
safe to place in an HTTP header. Do not place either credential in a Flutter
build, Docker image, build argument, Compose environment value, or repository
file.

## Run with Docker

```sh
SOLVED_CLIENT_ID_FILE=/absolute/host/path/client-id \
SOLVED_CLIENT_SECRET_FILE=/absolute/host/path/client-secret \
  docker compose up --build -d
curl --fail http://127.0.0.1:3000/healthz
```

Those host files should be readable only by the deployment account. Compose
mounts them at `/run/secrets/solved_client_id` and
`/run/secrets/solved_client_secret`; only those in-container paths are exposed
through the process environment.

The runtime image contains only compiled application code and Node.js. It runs
as the unprivileged `node` user. Compose additionally enables a read-only root
filesystem, drops Linux capabilities, and publishes the port only on loopback.
No secret or `.env` file is copied into the image.

### Pull a published image

Successful pushes to `main` publish the Linux AMD64 image
`ghcr.io/my-solved/solved-proxy` to GitHub Container Registry. The workflow
creates these tags:

- `latest` and `main` for the latest successful `main` build
- `sha-<short-commit>` for a commit-traceable build

Container tags are mutable. For production, use the exact
`ghcr.io/my-solved/solved-proxy@sha256:<digest>` value recorded in the successful
workflow summary. This keeps a redeploy on the same published image even if a
tag moves later. Pull and run it with the existing hardened Compose
configuration:

```sh
SOLVED_PROXY_IMAGE=ghcr.io/my-solved/solved-proxy@sha256:<digest> \
SOLVED_CLIENT_ID_FILE=/absolute/host/path/client-id \
SOLVED_CLIENT_SECRET_FILE=/absolute/host/path/client-secret \
  docker compose pull solved-proxy

SOLVED_PROXY_IMAGE=ghcr.io/my-solved/solved-proxy@sha256:<digest> \
SOLVED_CLIENT_ID_FILE=/absolute/host/path/client-id \
SOLVED_CLIENT_SECRET_FILE=/absolute/host/path/client-secret \
  docker compose up --no-build --detach solved-proxy
```

New GHCR packages are private by default. Before pulling, either make the
package public or log in to `ghcr.io` with an account and token that have read
access. The solved.ac client credentials remain runtime-only host files; they
are not GitHub Actions secrets and are never included in the published image.

## Deploy behind a reverse proxy

The v3 URLs remain available while My.solved moves its production runtime to
the official v4 contract. The service itself has no dependency on another
application backend.

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
