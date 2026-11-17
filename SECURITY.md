# Security policy

## Reporting a vulnerability

After this project is published, report vulnerabilities through a private GitHub
security advisory for the repository. Do not include credentials or exploit data
in a public issue.

## Security boundaries

This gateway accepts only its documented public `GET` routes and query keys. It
does not accept an upstream URL, forward caller credentials, or require a secret.
The solved.ac API response is treated as untrusted input and is limited by a
request deadline and maximum response size.

The legacy CodePoker image and its credentials are outside this repository. If a
legacy image was ever built after copying a generated `.env` into its build
context, rotate those credentials after deploying a clean replacement; deleting
the file from a later layer is not sufficient.
