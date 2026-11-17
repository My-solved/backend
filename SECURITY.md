# Security policy

## Reporting a vulnerability

After this project is published, report vulnerabilities through a private GitHub
security advisory for the repository. Do not include credentials or exploit data
in a public issue.

## Security boundaries

This gateway accepts only the generated 71-operation v4 `GET` surface and each
operation's declared path and query values. The 18 user operations require one
bounded RFC 6750 Bearer value; four scoped-public operations accept one
optionally. Authorization is parsed from raw headers only after route and query
resolution, duplicates and malformed schemes fail closed, and token scopes are
never parsed locally. Bearer values are forwarded only to those 22 reviewed
operations and are never stored or logged by the service. Cookies and caller
app credentials are never forwarded.

The gateway does not accept an upstream URL, app-access operations, mutation
methods, request bodies, or OAuth. Raw request targets and decoded URI
components are bounded and validated before routing; upstream paths are built
only from fixed `/api/v4` templates. The v4 client ID and secret are read from
the files named by `SOLVED_CLIENT_ID_FILE` and
`SOLVED_CLIENT_SECRET_FILE`, then injected only into allowlisted v4 upstream
requests. They must be mounted at runtime and must never be copied into the
image, committed, sent by a client, or placed in a build argument.

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
wildcard mode; native requests without Origin remain supported. Anonymous
unscoped public GETs keep wildcard CORS but never approve an Authorization
preflight. CORS is only a browser boundary and does not replace caller policy.

Each deployment consumes one operator-owned solved.ac app quota and is not a
communal anonymous relay. The default Compose configuration publishes the
container port only on loopback. Operators who expose it publicly must enforce
caller, request-rate, and connection policy at the edge; permissive CORS does
not provide access control.
