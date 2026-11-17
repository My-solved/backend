export type QueryValidator = (value: string) => boolean;

export type SolvedApiVersion = 'v3' | 'v4';

export interface QueryParameterSpec {
  readonly name: string;
  readonly required?: boolean;
  readonly defaultValue?: string;
  readonly validate?: QueryValidator;
}

export interface RouteSpec {
  readonly apiVersion: SolvedApiVersion;
  readonly upstreamPath: string;
  readonly pathParameters: Readonly<Record<string, QueryValidator>>;
  readonly query: readonly QueryParameterSpec[];
}

export interface ResolvedRouteSpec {
  readonly apiVersion: SolvedApiVersion;
  readonly upstreamPath: string;
  readonly query: readonly QueryParameterSpec[];
}

const nonEmpty = (maximumLength: number): QueryValidator =>
  (value) =>
    value.length > 0 &&
    value.length <= maximumLength &&
    !/[\u0000-\u001f\u007f]/u.test(value);

const boundedText = (maximumLength: number): QueryValidator =>
  (value) =>
    value.length <= maximumLength && !/[\u0000-\u001f\u007f]/u.test(value);

const oneOf = (values: readonly string[]): QueryValidator => {
  const allowed = new Set(values);
  return (value) => allowed.has(value);
};

const positiveInteger = (maximum?: number): QueryValidator =>
  (value) => {
    if (!/^[1-9]\d*$/u.test(value)) {
      return false;
    }
    const parsed = Number(value);
    return (
      Number.isSafeInteger(parsed) &&
      (maximum === undefined || parsed <= maximum)
    );
  };

const positivePage = positiveInteger(10_000);
const activityDay: QueryValidator = (value) => /^\d{4}-\d{2}-\d{2}$/u.test(value);

const handle = Object.freeze({
  name: 'handle',
  required: true,
  validate: nonEmpty(256),
});

const searchQuery = Object.freeze({
  name: 'query',
  required: true,
  // The current v3 client intentionally loads the initial search screen with ?query=.
  validate: boundedText(2_048),
});

const page = Object.freeze({
  name: 'page',
  defaultValue: '1',
  validate: positivePage,
});

const identifier = (name: string): QueryParameterSpec =>
  Object.freeze({
    name,
    required: true,
    validate: nonEmpty(256),
  });

const optionalShortValue = (name: string): QueryParameterSpec =>
  Object.freeze({ name, validate: nonEmpty(128) });

const required = (
  name: string,
  validate: QueryValidator,
): QueryParameterSpec => Object.freeze({ name, required: true, validate });

const optional = (
  name: string,
  validate: QueryValidator,
): QueryParameterSpec => Object.freeze({ name, validate });

const defineRoute = (
  apiVersion: SolvedApiVersion,
  upstreamPath: string,
  query: readonly QueryParameterSpec[] = [],
  pathParameters: Readonly<Record<string, QueryValidator>> = {},
): RouteSpec =>
  Object.freeze({
    apiVersion,
    upstreamPath,
    pathParameters: Object.freeze({ ...pathParameters }),
    query: Object.freeze([...query]),
  });

const v4Handle = nonEmpty(64);
const v4Key = nonEmpty(64);
const schemaUnboundedText = boundedText(8_192);
const shortLanguage = boundedText(16);

export const ROUTES = Object.freeze({
  '/solved/user/show': defineRoute('v3', 'user/show', [handle]),
  '/solved/user/grass': defineRoute('v3', 'user/grass', [
    handle,
    Object.freeze({
      name: 'topic',
      defaultValue: 'default',
      validate: nonEmpty(128),
    }),
  ]),
  '/solved/user/problem_stats': defineRoute('v3', 'user/problem_stats', [
    handle,
  ]),
  '/solved/user/tag_ratings': defineRoute('v3', 'user/tag_ratings', [handle]),
  '/solved/background/show': defineRoute('v3', 'background/show', [
    identifier('backgroundId'),
  ]),
  '/solved/badge/show': defineRoute('v3', 'badge/show', [
    identifier('badgeId'),
  ]),
  '/solved/search/problem': defineRoute('v3', 'search/problem', [
    searchQuery,
    page,
    Object.freeze({
      name: 'sort',
      defaultValue: 'solved',
      validate: oneOf([
        'id',
        'level',
        'title',
        'solved',
        'average_try',
        'random',
      ]),
    }),
    Object.freeze({
      name: 'direction',
      defaultValue: 'descending',
      validate: oneOf(['asc', 'desc', 'ascending', 'descending']),
    }),
    optionalShortValue('seed'),
  ]),
  '/solved/search/user': defineRoute('v3', 'search/user', [searchQuery, page]),
  '/solved/search/tag': defineRoute('v3', 'search/tag', [searchQuery, page]),

  '/solved/v4/users/{handle}': defineRoute(
    'v4',
    'users/{handle}',
    [optional('lang', schemaUnboundedText)],
    { handle: v4Handle },
  ),
  '/solved/v4/users/{handle}/activity/days': defineRoute(
    'v4',
    'users/{handle}/activity/days',
    [required('from', activityDay), required('to', activityDay)],
    { handle: v4Handle },
  ),
  '/solved/v4/users/{handle}/reputation': defineRoute(
    'v4',
    'users/{handle}/reputation',
    [optional('range', oneOf(['90d', '1y', 'all']))],
    { handle: v4Handle },
  ),
  '/solved/v4/users/{handle}/contributions': defineRoute(
    'v4',
    'users/{handle}/contributions',
    [
      optional('page', positivePage),
      optional('limit', positiveInteger(20)),
      optional('sort', oneOf(['recent', 'helpful'])),
      optional('only', oneOf(['scoring', 'helpful', 'vouched'])),
      optional('commented', oneOf(['true', 'false'])),
    ],
    { handle: v4Handle },
  ),
  '/solved/v4/problems': defineRoute('v4', 'problems', [
    optional('page', positiveInteger()),
    // OpenAPI leaves q unbounded. The documented anonymous 100-character and
    // eight-term policy returns a structured upstream 401, which the gateway
    // must preserve instead of replacing with a local 400.
    optional('q', schemaUnboundedText),
    optional('sort', oneOf(['id', 'level', 'solved', 'average_try', 'random'])),
    optional('direction', oneOf(['asc', 'desc'])),
    optional('seed', nonEmpty(64)),
  ]),
  '/solved/v4/rankings/users/search': defineRoute(
    'v4',
    'rankings/users/search',
    [
      required('q', boundedText(64)),
      optional('sort', oneOf(['rating', 'solved', 'contribution'])),
    ],
  ),
  '/solved/v4/tags': defineRoute('v4', 'tags'),
  '/solved/v4/tags/{key}': defineRoute('v4', 'tags/{key}', [], {
    key: v4Key,
  }),
  '/solved/v4/achievements/items/{kind}/{key}': defineRoute(
    'v4',
    'achievements/items/{kind}/{key}',
    [optional('lang', shortLanguage)],
    { kind: oneOf(['badge', 'background']), key: v4Key },
  ),
} satisfies Readonly<Record<string, RouteSpec>>);

export type GatewayRoute = keyof typeof ROUTES;

function decodePathSegment(value: string): string | undefined {
  try {
    const decoded = decodeURIComponent(value);
    if (
      decoded === '.' ||
      decoded === '..' ||
      decoded.includes('/') ||
      decoded.includes('\\') ||
      decoded.includes('%') ||
      /[\u0000-\u001f\u007f]/u.test(decoded)
    ) {
      return undefined;
    }
    return decoded;
  } catch {
    return undefined;
  }
}

function matchRoute(
  gatewayPath: string,
  route: RouteSpec,
  pathname: string,
): ResolvedRouteSpec | undefined {
  const templateSegments = gatewayPath.split('/');
  const pathSegments = pathname.split('/');
  if (templateSegments.length !== pathSegments.length) {
    return undefined;
  }

  const values: Record<string, string> = {};
  for (let index = 0; index < templateSegments.length; index += 1) {
    const templateSegment = templateSegments[index];
    const rawSegment = pathSegments[index];
    if (templateSegment === undefined || rawSegment === undefined) {
      return undefined;
    }
    const decoded = decodePathSegment(rawSegment);
    if (decoded === undefined) {
      return undefined;
    }
    const match = /^\{([A-Za-z][A-Za-z0-9]*)\}$/u.exec(templateSegment);
    if (match === null) {
      if (decoded !== templateSegment) {
        return undefined;
      }
      continue;
    }
    const name = match[1];
    const validator = name === undefined ? undefined : route.pathParameters[name];
    if (name === undefined || validator === undefined || !validator(decoded)) {
      return undefined;
    }
    values[name] = decoded;
  }

  let upstreamPath = route.upstreamPath;
  for (const [name, value] of Object.entries(values)) {
    upstreamPath = upstreamPath.replace(`{${name}}`, encodeURIComponent(value));
  }
  if (upstreamPath.includes('{') || upstreamPath.includes('}')) {
    return undefined;
  }
  return Object.freeze({
    apiVersion: route.apiVersion,
    upstreamPath,
    query: route.query,
  });
}

export function findRoute(pathname: string): ResolvedRouteSpec | undefined {
  for (const [gatewayPath, route] of Object.entries(ROUTES)) {
    const resolved = matchRoute(gatewayPath, route, pathname);
    if (resolved !== undefined) {
      return resolved;
    }
  }
  return undefined;
}
