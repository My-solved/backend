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

The non-GET boundary is split by responsibility:

- `application/v4-router.ts` performs literal-first, method-aware dispatch and
  reports the exact methods at a path.
- `application/v4-request-contract.ts` resolves query/path values from that
  already-matched route; it never rematches a mutation through the GET router.
- `adapters/http/request-body.ts` validates framing/media metadata and streams
  at most 65,536 bytes while a concurrency slot is held.
- `adapters/http/strict-json-body.ts` applies fatal UTF-8, JSON grammar,
  nesting, and decoded duplicate-key checks.
- `adapters/http/strict-form-body.ts` applies fatal UTF-8 and percent decoding,
  plus-space semantics, mandatory `=`, and decoded duplicate-key rejection.
- `adapters/http/oauth-request-body.ts` selects only supplement-declared media,
  validates the exclusive OAuth variant, and converts either input format to
  the opaque canonical form boundary.
- `domain/request-json-schema.ts` validates the parsed value, after which
  `domain/validated-json-request-body.ts` or
  `domain/validated-form-request-body.ts` creates an opaque canonical payload.
- `adapters/http/v4-route-policy.ts` separates exact-origin sensitivity from
  the per-method Authorization and Content-Type preflight permissions.
- `adapters/solved/solved-client.ts` accepts a discriminated GET, user mutation,
  or app-OAuth policy. Its types and runtime checks prevent cacheable
  authorization, GET bodies, unauthenticated user mutations, caller Bearer on
  OAuth, and the wrong body mode.

## Request lifecycle

For a non-GET request, the gateway resolves the fixed target, literal path,
exact method, CORS policy, query contract, route-specific authorization rule,
and server credentials before reading a body. User mutations require one
Bearer value; supplemented OAuth routes reject every caller Authorization
header. The gateway then acquires one of the bounded request slots, streams and
validates the payload, and performs exactly one redirect-disabled upstream
fetch. Early rejection of a framed unread body closes the connection. Node
`Expect` events are rejected with `417` at the composition boundary so Node
cannot automatically send `100 Continue` before these checks.

Bodyless, JSON, and supplemented OAuth operations remain distinct through the
entire flow. The seven reviewed JSON mutations send canonical JSON; OAuth JSON
or form input always sends deterministic form data. Caller framing, cookies,
and app credentials never cross the adapter boundary. User mutation responses
strip ETag and force `no-store`; OAuth does the same and also forces `Pragma:
no-cache` on every success and failure path.

The source-layout test enforces the root shape and the lower-layer dependency
direction. Keep tests flat under `test/` so Node's test command remains simple;
their filenames mirror the production module roles.

## Generated boundaries

Files under `src/generated/` are never edited directly. The OpenAPI snapshot,
wire declarations, snapshot-bound gateway request supplement, and operation
manifest remain deterministic inputs to the application router and pure domain
request-schema validator. The OAuth supplement is provenance-separated from
the official wire declarations, which continue to expose `RequestBody = never`
for these prose-only inputs. Its two operations use the enabled `supplemented`
runtime policy, and generation fails closed unless the exact sensitive security
requirements remain attached. The method-aware runtime catalog exposes all 83
reviewed operations while still refusing arbitrary upstream targets. See the
update and verification commands in
[`README.md`](README.md).
