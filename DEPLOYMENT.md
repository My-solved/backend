# Production deployment

This runbook deploys one `solved-proxy` instance for one registered solved.ac
app. The service is stateless, but the deployed app credentials and shared
solved.ac quota make the edge a security and availability boundary.

The published image currently targets Linux AMD64. The host needs Docker Engine
with Docker Compose v2 support for `up --wait --wait-timeout` and
`run --pull never`, a TLS reverse proxy, and a protected location for the two
solved.ac credential files.

Use a dedicated deployment shell. The command blocks enable `set -eu`; stop at
the first failure instead of continuing with a partially validated rollout.

## 1. Select an immutable image

Use the exact image reference from the successful `Publish container` workflow
summary for the protected `main` commit being deployed:

```sh
set -eu
export TARGET_SOLVED_PROXY_IMAGE=ghcr.io/my-solved/solved-proxy@sha256:DIGEST
printf '%s\n' "$TARGET_SOLVED_PROXY_IMAGE" | \
  grep -Eq '^ghcr\.io/my-solved/solved-proxy@sha256:[0-9a-f]{64}$' || {
    echo 'exact GHCR digest required' >&2
    exit 64
  }
```

Do not deploy `latest`, `main`, or a `sha-*` tag. Tags can move; the manifest
digest cannot. Record the previous production digest before changing it. If the
GHCR package is private, authenticate the deployment host with a dedicated
read-only package credential before pulling. A registry credential is not a
solved.ac client secret and the two must not be reused.

## 2. Prepare runtime configuration

Store the solved.ac client ID and client secret in separate host files outside
the repository and Compose directory. Never put their values in Git, a `.env`
file, the Compose environment, a Dockerfile, an image, or a build argument.

Export only the absolute host paths:

```sh
set -eu
export SOLVED_CLIENT_ID_FILE=/protected/solved-proxy/client-id
export SOLVED_CLIENT_SECRET_FILE=/protected/solved-proxy/client-secret
export SOLVED_PROXY_PORT=3000
export COMPOSE_PROJECT_NAME=solved-proxy-appname
```

Restrict the files to deployment administrators and the minimum host/runtime
identity needed to mount them. The image runs as the non-root `node` user, and
bind-mount permission behavior differs across Linux and Docker Desktop. Do not
assume that a host-only `0600` file is readable in the container; use the exact
preflight below without printing either value.

Choose one stable, unique Compose project name per registered solved.ac app and
keep it unchanged across updates and rollbacks. Otherwise running from a
different checkout directory can create a second deployment instead of
replacing the existing one.

For browser callers, configure only canonical, exact origins. Native callers
send no `Origin` and do not need an entry:

```sh
export SOLVED_PROTECTED_CORS_ORIGINS=https://app.example
```

Separate multiple origins with commas and do not add a trailing slash. Leave
the value empty for a native-only deployment. CORS is not caller authentication
and does not protect the app quota.

For a first deployment, select the target directly:

```sh
set -eu
export SOLVED_PROXY_IMAGE="$TARGET_SOLVED_PROXY_IMAGE"
```

For an update, load the complete current configuration first, including its
recorded exact digest and existing credential paths. Then verify and print the
image actually used by the running container before selecting the target:

```sh
set -eu
export SOLVED_PROXY_IMAGE=ghcr.io/my-solved/solved-proxy@sha256:CURRENT_DIGEST
printf '%s\n' "$SOLVED_PROXY_IMAGE" | \
  grep -Eq '^ghcr\.io/my-solved/solved-proxy@sha256:[0-9a-f]{64}$' || {
    echo 'exact current GHCR digest required' >&2
    exit 64
  }
current_container_id="$(docker compose ps --quiet solved-proxy)"
test -n "$current_container_id"
previous_image="$(docker inspect --format '{{.Config.Image}}' \
  "$current_container_id")"
test "$previous_image" = "$SOLVED_PROXY_IMAGE"
printf 'previous image: %s\n' "$previous_image"
export SOLVED_PROXY_IMAGE="$TARGET_SOLVED_PROXY_IMAGE"
```

If any runtime path, CORS origin, or host port also changes, export its desired
value after recording the current image and before validation.

## 3. Validate and start

Run these commands from a reviewed checkout of the same repository revision as
the selected image:

```sh
set -eu
docker compose config --quiet
docker compose pull solved-proxy

docker compose run --rm --no-deps --pull never \
  --entrypoint node solved-proxy \
  --input-type=module --eval '
    import { accessSync, constants, statSync } from "node:fs";
    if (process.getuid() === 0) throw new Error("runtime user must be non-root");
    for (const path of [
      "/run/secrets/solved_client_id",
      "/run/secrets/solved_client_secret",
    ]) {
      accessSync(path, constants.R_OK);
      const status = statSync(path);
      if (!status.isFile() || status.size === 0) {
        throw new Error(path + " must be a non-empty regular file");
      }
    }
    process.stdout.write("credential mounts are readable by the runtime user\n");
  '

docker compose up --no-build --detach --wait --wait-timeout 120 solved-proxy
container_id="$(docker compose ps --quiet solved-proxy)"
test -n "$container_id"
test "$(docker inspect --format '{{.Config.Image}}' "$container_id")" = \
  "$SOLVED_PROXY_IMAGE"
test "$(docker inspect --format '{{.State.Health.Status}}' "$container_id")" = \
  healthy
test "$(curl --silent --show-error --max-time 5 --output /dev/null \
  --write-out '%{http_code}' \
  "http://127.0.0.1:${SOLVED_PROXY_PORT}/healthz")" = 200
```

`config --quiet` validates interpolation before any container changes. The
one-shot command checks the real secret mounts as the image's non-root user,
requires non-empty regular files, and does not read their contents into output.
`up --wait` then proves that the application can parse both files and reach its
quota-free local health route.

The inspect checks prevent an accidental local build or stale tag from passing
as the selected digest. Startup fails if the container exits or does not become
healthy within 120 seconds. The timeout covers the current 30-second health
cadence and retry window without waiting indefinitely.

The Compose service binds only to `127.0.0.1`. Do not change it to a public bind;
publish through a TLS edge instead.

## 4. Configure the edge

Expose only `/solved/v4/*` and the quota-free `/healthz` process check. Keep the
container loopback-only, terminate TLS at the edge, and reject or route all
other paths independently. The public health path is deliberately `/healthz`
so the bundled live-smoke tool and the reverse proxy agree.

Every public deployment needs an explicit caller policy. Use a network allowlist
for private services, or a WAF/API gateway with per-source-address rate and
connection limits for public clients. Do not embed a shared gateway password in
a downloadable app. If a CDN or another proxy is in front, establish trusted
client-IP handling before applying source-address limits. Never log
`Authorization` request headers.

This Nginx example shows protective starting values, not solved.ac unit-quota
accounting. Official operations have different costs and upstream `429` plus
`Retry-After` remains authoritative. Tune the edge for the deployment's actual
audience and abuse model.

```nginx
# http context
limit_req_zone $binary_remote_addr zone=solved_per_address:10m rate=1r/s;
limit_conn_zone $binary_remote_addr zone=solved_connections:10m;

# server context
location ^~ /solved/v4/ {
    limit_req zone=solved_per_address burst=8 nodelay;
    limit_req_status 429;
    limit_conn solved_connections 4;
    limit_conn_status 429;

    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

location = /healthz {
    access_log off;
    limit_req zone=solved_per_address burst=4 nodelay;
    limit_req_status 429;
    limit_conn solved_connections 2;
    limit_conn_status 429;
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
}
```

The application concurrency cap protects bounded upstream work; it is not an
edge abuse limit. CORS controls browser response access; it is not a caller
policy.

## 5. Verify the deployment

Check the external TLS route without spending solved.ac quota:

```sh
set -eu
health_status="$(curl --silent --show-error --max-time 5 \
  --output /dev/null --write-out '%{http_code}' \
  https://gateway.example/healthz)"
test "$health_status" = 200
```

Use `/healthz`, not `/solved/v4/health` or another official operation, for
recurring monitoring. The official v4 health operation is forwarded upstream
and consumes the deployment's real app quota.

When protected browser CORS is configured, this preflight also stays local and
quota-free. It must return `204` and the exact configured
`Access-Control-Allow-Origin` value:

```sh
set -eu
cors_response="$(curl --silent --show-error --max-time 5 --include \
  --request OPTIONS \
  --header 'Origin: https://app.example' \
  --header 'Access-Control-Request-Method: GET' \
  --header 'Access-Control-Request-Headers: authorization' \
  https://gateway.example/solved/v4/account/settings)"
normalized_cors_response="$(printf '%s\n' "$cors_response" | \
  tr -d '\r' | tr '[:upper:]' '[:lower:]')"
printf '%s\n' "$normalized_cors_response" | \
  grep -Eq '^http/[0-9.]+ 204([[:space:]].*)?$'
test "$(printf '%s\n' "$normalized_cors_response" | \
  grep -Ec '^access-control-allow-origin:')" = 1
printf '%s\n' "$normalized_cors_response" | \
  grep -Eq '^access-control-allow-origin:[[:space:]]*https://app\.example[[:space:]]*$'
```

After a new deployment or credential rotation, an operator may run one explicit
end-to-end smoke from a trusted machine with Node 24 and a matching repository
checkout. The runtime image intentionally does not contain this tool:

```sh
npm run smoke:live -- \
  --base-url https://gateway.example/ \
  --confirm-live-smoke
```

It checks `/healthz` and then makes one anonymous `/solved/v4/tags` request. The
second request validates the server-side app credential and spends real quota.
Run it against the public URL from an edge-allowlisted source, or against the
loopback URL when the edge requires authentication that the tool deliberately
cannot accept (`http://127.0.0.1:${SOLVED_PROXY_PORT}/`). Use one route, not
both. Do not schedule it as a monitor or use it for load testing. Load tests
remain limited to `npm run load:mock` unless solved.ac explicitly approves a
live test.

Record the deployed commit, image digest, public hostname, CORS origins, edge
policy revision, and credential-file revision or rotation date. Never record
the credential contents.

## Credential rotation

The process reads both credential files once at startup. Replacing a host file
does not hot-reload a running container.

Treat every change as a fresh shell. Re-export the complete configuration,
including the currently deployed exact digest, so Compose can never select its
`solved-proxy:local` development default:

```sh
set -eu
export SOLVED_PROXY_IMAGE=ghcr.io/my-solved/solved-proxy@sha256:CURRENT_DIGEST
export SOLVED_CLIENT_ID_FILE=/protected/solved-proxy/new-client-id
export SOLVED_CLIENT_SECRET_FILE=/protected/solved-proxy/new-client-secret
export SOLVED_PROTECTED_CORS_ORIGINS=https://app.example
export SOLVED_PROXY_PORT=3000
export COMPOSE_PROJECT_NAME=solved-proxy-appname
printf '%s\n' "$SOLVED_PROXY_IMAGE" | \
  grep -Eq '^ghcr\.io/my-solved/solved-proxy@sha256:[0-9a-f]{64}$' || {
    echo 'exact GHCR digest required' >&2
    exit 64
  }
```

1. Put the new values in new protected files according to the solved.ac console
   rotation procedure.
2. Point `SOLVED_CLIENT_ID_FILE` and `SOLVED_CLIENT_SECRET_FILE` at the new
   files, run `docker compose config --quiet`, pull the selected digest, and
   repeat the non-root mount preflight from
   [Validate and start](#3-validate-and-start).
3. Recreate the service and wait for health:

   ```sh
   set -eu
   docker compose up --no-build --detach --wait --wait-timeout 120 \
     --force-recreate solved-proxy
   container_id="$(docker compose ps --quiet solved-proxy)"
   test -n "$container_id"
   test "$(docker inspect --format '{{.Config.Image}}' "$container_id")" = \
     "$SOLVED_PROXY_IMAGE"
   test "$(docker inspect --format '{{.State.Health.Status}}' "$container_id")" = \
     healthy
   test "$(curl --silent --show-error --max-time 5 --output /dev/null \
     --write-out '%{http_code}' \
     "http://127.0.0.1:${SOLVED_PROXY_PORT}/healthz")" = 200
   ```

4. Check external `/healthz`, then run at most one confirmed live smoke to prove
   the upstream credential.
5. Retire the old credential/file only after the new one is proven, when the
   provider's rotation behavior permits overlap.

If the provider invalidates the old secret immediately, plan the recreation as
a short maintenance event. Do not print a secret while diagnosing a failed
rotation. Do not substitute `docker compose restart`: it does not reliably
apply a changed path or remount a replaced file.

## Image rollback

Rollback changes the image reference, not the credential policy:

```sh
set -eu
export SOLVED_PROXY_IMAGE=ghcr.io/my-solved/solved-proxy@sha256:PREVIOUS_DIGEST
export SOLVED_CLIENT_ID_FILE=/protected/solved-proxy/valid-client-id
export SOLVED_CLIENT_SECRET_FILE=/protected/solved-proxy/valid-client-secret
export SOLVED_PROTECTED_CORS_ORIGINS=https://app.example
export SOLVED_PROXY_PORT=3000
export COMPOSE_PROJECT_NAME=solved-proxy-appname
printf '%s\n' "$SOLVED_PROXY_IMAGE" | \
  grep -Eq '^ghcr\.io/my-solved/solved-proxy@sha256:[0-9a-f]{64}$' || {
    echo 'exact GHCR digest required' >&2
    exit 64
  }
docker compose config --quiet
docker compose pull solved-proxy
```

Use the repository checkout matching the previous image, or a current Compose
file whose backward compatibility with it has been reviewed. Repeat the
non-root mount preflight from [Validate and start](#3-validate-and-start), then
replace the service and verify both the exact image and health:

```sh
set -eu
docker compose up --no-build --detach --wait --wait-timeout 120 \
  --force-recreate solved-proxy
container_id="$(docker compose ps --quiet solved-proxy)"
test -n "$container_id"
test "$(docker inspect --format '{{.Config.Image}}' "$container_id")" = \
  "$SOLVED_PROXY_IMAGE"
test "$(docker inspect --format '{{.State.Health.Status}}' "$container_id")" = \
  healthy
test "$(curl --silent --show-error --max-time 5 --output /dev/null \
  --write-out '%{http_code}' \
  "http://127.0.0.1:${SOLVED_PROXY_PORT}/healthz")" = 200
```

Then check the external health route. Run the confirmed live smoke only if an
upstream credential or routing regression still needs to be distinguished. If
the incident was caused by a revoked or malformed credential, an image rollback
cannot restore it; mount a valid credential and recreate the service. If a
credential-path change was part of the failed rollout and the previous
credential is still valid, restore its recorded paths as part of the rollback.

For bounded diagnostics, re-export the same stable project name, exact digest,
credential paths, CORS, and port configuration first; even read-oriented
Compose commands evaluate the development image fallback and required secret
interpolation. Then start with:

```sh
set -eu
docker compose ps
docker compose logs --tail 100 solved-proxy
```

The application avoids logging credential values and response bodies. Keep the
same restriction in the reverse proxy, container runtime, and log collector.
