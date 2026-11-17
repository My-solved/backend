# Security policy

## Reporting a vulnerability

After this project is published, report vulnerabilities through a private GitHub
security advisory for the repository. Do not include credentials or exploit data
in a public issue.

## Security boundaries

This gateway accepts only the 81 runtime-enabled operations generated from the
reviewed v4 contract: 71 reads and the exact ten documented user mutations.
Each operation keeps its fixed method, path/query schema, request-body policy,
and response contract. The 28 user operations require one bounded RFC 6750
Bearer value; four scoped-public reads accept one optionally. Authorization is
parsed from raw headers only after route and query resolution, duplicates and
malformed schemes fail closed, and token scopes are never parsed locally.
Bearer values are never stored or logged. Cookies and caller app credentials
are never forwarded.

The seven JSON mutations require a nonempty body and accept only
`application/json` with at most a reviewed UTF-8 charset. Input is streamed
inside the configured concurrency budget (eight by default), capped at exactly
65,536 bytes, and decoded with fatal UTF-8. BOMs, excessive nesting, trailing or
malformed JSON, and decoded duplicate keys are rejected before the value is
validated against the generated request schema. The other three mutations
reject a body or media type. Caller Content-Length and Content-Encoding are
never forwarded. Framed requests rejected before consumption receive
`Connection: close`; unsupported `Expect` handshakes receive `417` without an
interim `100 Continue`. Mutations
are sent once with redirects disabled and are never retried.

The gateway does not accept an upstream URL, app-access operations, or OAuth.
Raw request targets and decoded URI components are bounded and validated before
routing; upstream paths are built only from fixed `/api/v4` templates. The v4
client ID and secret are read from the files named by `SOLVED_CLIENT_ID_FILE` and
`SOLVED_CLIENT_SECRET_FILE`, then injected only into allowlisted v4 upstream
requests. The client ID is a public app identifier that a future downloadable
OAuth client may send to the authorization endpoint; the proxy still ignores
caller-supplied `x-client-id` and `x-client-secret` and uses its configured
values upstream. The client secret is server-only and must never be copied into
the image, committed, sent by a client, or placed in a build argument.

The OAuth token and revoke routes remain disabled, but their reviewed request
supplements are already fail-closed around the future activation boundary. The
generated contract requires exact-origin browser CORS, `Cache-Control:
no-store`, `Pragma: no-cache`, no ETag, one upstream attempt, server-owned app
authentication, and rejection of caller Authorization. A future runtime cannot
reclassify these app-class routes as wildcard-public merely because they carry
no user Bearer header.

The solved.ac API response is treated as untrusted input and is limited by a
request deadline and maximum response size. Redirects, undeclared statuses,
missing or wrong media types, and missing required response headers are
rejected before the body is read. The global `429` contract requires JSON and a
nonempty `Retry-After` header. Only a small response-header allowlist is
returned; cookies, locations, and internal headers are dropped.

Every response from a user or scoped-public operation is forced to
`Cache-Control: no-store` and has its `ETag` removed, even when a scoped-public
request is anonymous. Their browser CORS policy defaults closed and allows only
exact origins from `SOLVED_PROTECTED_CORS_ORIGINS`, with no credentialed or
wildcard mode; native requests without Origin remain supported. Protected
preflight is resolved against the exact method at the matched literal path:
Authorization is allowed for protected operations and Content-Type only for a
JSON-body method. Anonymous unscoped public GETs keep wildcard CORS but never
approve an Authorization preflight. CORS is only a browser boundary and does
not replace caller policy.

Each deployment consumes one operator-owned solved.ac app quota and is not a
communal anonymous relay. The default Compose configuration publishes the
container port only on loopback. Operators who expose it publicly must enforce
caller, request-rate, and connection policy at the edge; permissive CORS does
not provide access control.
