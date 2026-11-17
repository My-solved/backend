import type {
  PathParams,
  Query,
  RequestBody,
  ResponseBody,
  ResponseStatus,
  V4Operation,
  V4OperationKey,
} from '../src/generated/v4-wire-types.js';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;

type Expect<Value extends true> = Value;

type _OperationKeyIncludesHealth = Expect<
  Equal<Extract<V4OperationKey, 'GET /api/v4/health'>, 'GET /api/v4/health'>
>;

type _OperationLookup = Expect<
  Equal<
    ResponseStatus<'POST /api/v4/oauth/token'>,
    keyof V4Operation<'POST /api/v4/oauth/token'>['responses']
  >
>;

type _ProfilePath = Expect<
  Equal<PathParams<'GET /api/v4/users/{handle}'>, { handle: string }>
>;

type _AffiliationPathPreservesNullableSource = Expect<
  Equal<
    PathParams<'GET /api/v4/rankings/affiliations/{affiliationId}'>,
    { affiliationId: number | null }
  >
>;

type _NoPathParameters = Expect<
  Equal<PathParams<'GET /api/v4/tags'>, never>
>;

type _ProblemQuery = Expect<
  Equal<
    Query<'GET /api/v4/problems'>,
    {
      direction?: 'asc' | 'desc';
      page?: number;
      q?: string;
      seed?: string;
      sort?: 'id' | 'level' | 'solved' | 'average_try' | 'random';
    }
  >
>;

type _NoQueryParameters = Expect<Equal<Query<'GET /api/v4/health'>, never>>;

type _CreateBookmarkBody = Expect<
  Equal<
    RequestBody<'POST /api/v4/account/bookmarks'>,
    {
      color?:
        | 'red'
        | 'violet'
        | 'blue'
        | 'teal'
        | 'lime'
        | 'yellow'
        | 'orange'
        | null;
      description?: string;
      name: string;
      slug: string;
      visibility?: 'private' | 'unlisted' | 'public';
    }
  >
>;

type _TokenBodyGapStaysVisible = Expect<
  Equal<RequestBody<'POST /api/v4/oauth/token'>, never>
>;

type _RevokeBodyGapStaysVisible = Expect<
  Equal<RequestBody<'POST /api/v4/oauth/revoke'>, never>
>;

type _HealthResponseStatuses = Expect<
  Equal<ResponseStatus<'GET /api/v4/health'>, 200>
>;

type _HealthResponseBody = Expect<
  Equal<
    ResponseBody<'GET /api/v4/health', 200>,
    {
      status: 'ok' | 'degraded' | 'down';
      timestamp: string;
    }
  >
>;

type _BodylessResponse = Expect<
  Equal<ResponseBody<'DELETE /api/v4/account/bookmarks/{slug}', 204>, never>
>;

// @ts-expect-error Unknown method-and-path keys must not compile.
type _UnknownOperation = V4Operation<'GET /api/v4/unknown'>;

// @ts-expect-error Status 418 is not declared for the health operation.
type _UnknownResponseStatus = ResponseBody<'GET /api/v4/health', 418>;
