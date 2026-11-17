const MAX_BEARER_TOKEN_BYTES = 4_089;
const BEARER_TOKEN = /^[A-Za-z0-9\-._~+/]+=*$/u;
declare const bearerAuthorizationBrand: unique symbol;

export type BearerAuthorization = Readonly<{
  token: string;
  [bearerAuthorizationBrand]: true;
}>;

export function createBearerAuthorization(
  token: string,
): BearerAuthorization | undefined {
  if (
    Buffer.byteLength(token, 'utf8') > MAX_BEARER_TOKEN_BYTES ||
    !BEARER_TOKEN.test(token)
  ) {
    return undefined;
  }
  return Object.freeze({ token }) as BearerAuthorization;
}

export function bearerAuthorizationHeader(
  authorization: BearerAuthorization,
): string {
  return `Bearer ${authorization.token}`;
}
