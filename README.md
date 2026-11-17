# solved-proxy

`solved-proxy` is a small, stateless compatibility gateway between My.solved and
the public solved.ac API. It extracts only the `/solved/*` routes that My.solved
uses from the legacy CodePoker backend.

The service has no database, cache, login flow, solved.ac token, BOJ credential,
or runtime package dependency. It only accepts an explicit allowlist of public
`GET` requests and forwards them to `https://solved.ac/api/v3/`.

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

Arbitrary upstream paths and query parameters are rejected. Request credentials
and cookies are never forwarded upstream. `/healthz` is the health endpoint;
`/api` is retained only as a temporary direct-container compatibility response.
It does not replace CodePoker's external `/api` monitor unless explicitly
routed to this container.

## Develop

Node.js 24 LTS is required.

```sh
npm ci
npm test
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

The upstream origin is fixed in code to prevent this service from becoming an
open proxy.

The current mappings target solved.ac v3. A future v4 rollout should update the
mapping for each allowlisted route while keeping the public `/solved/*` contract
stable; it must not introduce a wildcard upstream path.

## Run with Docker

```sh
docker compose up --build -d
curl --fail http://127.0.0.1:3000/healthz
```

The runtime image contains only compiled application code and Node.js. It runs
as the unprivileged `node` user. Compose additionally enables a read-only root
filesystem, drops Linux capabilities, and publishes the port only on loopback.
No secret or `.env` file is copied into the image.

## Migrate from CodePoker

Keep the existing CodePoker deployment unchanged while introducing this service:

1. Start `solved-proxy` on a temporary host or loopback port.
2. Check `/healthz` and a representative public request such as
   `/solved/user/show?handle=<handle>`.
3. Change only the reverse-proxy rule for `/solved/` to this container.
4. Add a distinct external health route or monitor a representative gateway
   request; the legacy `/api` check still measures CodePoker when only
   `/solved/` is switched.
5. Observe error rate, latency, `429` responses, and container restarts.
6. Roll back by restoring the single `/solved/` reverse-proxy rule if needed.
7. Remove the old CodePoker solved module only after the observation period.

This preserves the URLs consumed by My.solved, so the client does not need a
coordinated release. CodePoker's `/api`, SSU, poker, user, and database features
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
