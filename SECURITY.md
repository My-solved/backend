# Security policy

## Reporting a vulnerability

After this project is published, report vulnerabilities through a private GitHub
security advisory for the repository. Do not include credentials or exploit data
in a public issue.

## Security boundaries

This gateway accepts only its documented `GET` routes and query keys. It
does not accept an upstream URL or forward caller credentials. The v4 client ID
and secret are read from the files named by `SOLVED_CLIENT_ID_FILE` and
`SOLVED_CLIENT_SECRET_FILE`, then injected only into allowlisted v4 upstream
requests. They must be mounted at runtime and must never be copied into the
image, committed, sent by a client, or placed in a build argument.

The solved.ac API response is treated as untrusted input and is limited by a
request deadline and maximum response size. Redirects are rejected. Only a
small response-header allowlist is returned; cookies, locations, and internal
headers are dropped.

Each deployment consumes one operator-owned solved.ac app quota and is not a
communal anonymous relay. The default Compose configuration publishes the
container port only on loopback. Operators who expose it publicly must enforce
caller, request-rate, and connection policy at the edge; permissive CORS does
not provide access control.
