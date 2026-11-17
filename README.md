# solved-proxy

`solved-proxy` is a small, stateless gateway between My.solved and the solved.ac
API. It keeps the legacy `/solved/*` v3 compatibility surface during migration
and exposes an explicit `/solved/v4/*` allowlist for the official v4 API.

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
ignored. `/healthz` is the health endpoint;
`/api` is retained only as a temporary direct-container compatibility response.
It does not replace CodePoker's external `/api` monitor unless explicitly
routed to this container.

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
stub `fetch`, so the test suite does not need network access or a listening port.

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

## Migrate from CodePoker

Keep the existing CodePoker deployment unchanged while introducing this service:

1. Start `solved-proxy` on a temporary host or loopback port.
2. Mount the solved.ac app credentials and check `/healthz`, a representative
   v3 request, and `/solved/v4/users/<handle>`.
3. Change only the reverse-proxy rule for `/solved/` to this container.
4. Add a distinct external health route or monitor a representative gateway
   request; the legacy `/api` check still measures CodePoker when only
   `/solved/` is switched.
5. Observe error rate, latency, `429` responses, and container restarts.
6. Roll back by restoring the single `/solved/` reverse-proxy rule if needed.
7. Remove the old CodePoker solved module only after the observation period.

The v3 URLs remain available during the client rollout. New application builds
use `/solved/v4/*`; CodePoker's `/api`, SSU, poker, user, and database features
remain on the legacy backend during the migration.

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

Point the gateway monitor at `/solved-healthz`. Keep the existing `/api`
monitor for the legacy CodePoker service until that service is retired.
Apply request-rate and connection limits at the public reverse proxy as well;
the application cap protects upstream work but is not a replacement for edge
abuse controls.

## Deployment policy

CI builds and tests the service and its image. It deliberately does not publish
or deploy from pull requests. Add image publication and production deployment as
separate protected workflows after the destination registry, host, and approval
policy are decided.
