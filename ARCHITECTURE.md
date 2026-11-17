# Architecture

`solved-proxy` keeps the runtime small, but its source tree has explicit
boundaries so new v4 capabilities do not accumulate in a flat directory.

```text
src/
├── domain/          Pure gateway values and official v4 contract types
├── generated/       Deterministic artifacts derived from the pinned OpenAPI
├── application/     Route compilation and reviewed request-contract logic
├── adapters/
│   ├── http/        Inbound Node HTTP parsing, CORS, auth, and request handling
│   └── solved/      Outbound solved.ac HTTP client
├── infrastructure/ Runtime configuration and secret-file loading
└── server.ts        Composition root and process lifecycle
```

## Dependency direction

- `domain` depends only on itself and platform primitives.
- `generated` may depend on `domain` types, never on runtime adapters.
- `application` may depend on `domain`, `generated`, and other application
  modules.
- `infrastructure` constructs domain values but does not import application or
  adapters.
- `adapters` may depend on application and domain contracts. The outbound
  solved.ac adapter must not depend on the inbound HTTP adapter.
- `server.ts` is the composition root and may wire adapters and infrastructure.

`adapters/http/gateway-handler.ts` is intentionally a composition-aware inbound
adapter for this small service: it resolves the application contract and calls
the reviewed solved.ac adapter. This is the single documented adapter-to-adapter
orchestration point. It can be split into a separate use-case layer if runtime
flows become substantially more complex.

The source-layout test enforces the root shape and the lower-layer dependency
direction. Keep tests flat under `test/` so Node's test command remains simple;
their filenames mirror the production module roles.

## Generated boundaries

Files under `src/generated/` are never edited directly. The OpenAPI snapshot,
wire declarations, and operation manifest remain deterministic inputs to the
application router and pure domain request-schema validator. Cataloging a
method is distinct from exposing it through the inbound HTTP adapter. See the
update and verification commands in
[`README.md`](README.md).
