export type QueryValidator = (value: string) => boolean;

export interface QueryParameterSpec {
  readonly name: string;
  readonly required?: boolean;
  readonly defaultValue?: string;
  readonly validate?: QueryValidator;
}

export interface RouteSpec {
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

const positivePage: QueryValidator = (value) =>
  /^[1-9]\d*$/u.test(value) && Number(value) <= 10_000;

const handle = Object.freeze({
  name: 'handle',
  required: true,
  validate: nonEmpty(256),
});

const searchQuery = Object.freeze({
  name: 'query',
  required: true,
  // The current client intentionally loads the initial search screen with ?query=.
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

const defineRoute = (
  upstreamPath: string,
  query: readonly QueryParameterSpec[] = [],
): RouteSpec => Object.freeze({ upstreamPath, query: Object.freeze([...query]) });

export const ROUTES = Object.freeze({
  '/solved/user/show': defineRoute('user/show', [handle]),
  '/solved/user/organizations': defineRoute('user/organizations', [handle]),
  '/solved/user/available_badges': defineRoute('user/available_badges', [handle]),
  '/solved/user/grass': defineRoute('user/grass', [
    handle,
    Object.freeze({
      name: 'topic',
      defaultValue: 'default',
      validate: nonEmpty(128),
    }),
  ]),
  '/solved/user/top_100': defineRoute('user/top_100', [handle]),
  '/solved/user/problem_stats': defineRoute('user/problem_stats', [handle]),
  '/solved/user/tag_ratings': defineRoute('user/tag_ratings', [handle]),
  '/solved/background/show': defineRoute('background/show', [
    identifier('backgroundId'),
  ]),
  '/solved/badge/show': defineRoute('badge/show', [identifier('badgeId')]),
  '/solved/search/suggestion': defineRoute('search/suggestion', [searchQuery]),
  '/solved/search/problem': defineRoute('search/problem', [
    searchQuery,
    page,
    Object.freeze({
      name: 'sort',
      defaultValue: 'solved',
      validate: oneOf(['id', 'level', 'title', 'solved', 'average_try', 'random']),
    }),
    Object.freeze({
      name: 'direction',
      defaultValue: 'descending',
      validate: oneOf(['asc', 'desc', 'ascending', 'descending']),
    }),
    optionalShortValue('seed'),
  ]),
  '/solved/search/user': defineRoute('search/user', [searchQuery, page]),
  '/solved/search/tag': defineRoute('search/tag', [searchQuery, page]),
  '/solved/arena/contests': defineRoute('arena/contests'),
  '/solved/site/stats': defineRoute('site/stats'),
} satisfies Readonly<Record<string, RouteSpec>>);

export type GatewayRoute = keyof typeof ROUTES;

export function findRoute(pathname: string): RouteSpec | undefined {
  return (ROUTES as Readonly<Record<string, RouteSpec>>)[pathname];
}
