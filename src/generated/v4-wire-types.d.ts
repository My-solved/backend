/**
 * This file is generated from openapi/solved-v4.openapi.json.
 * Do not edit it directly; run npm run openapi:types:update.
 */
import type { paths } from './solved-v4.openapi.js';

/** Official wire operations keyed by a stable HTTP method and path pair. */
export interface V4WireOperations {
    "DELETE /api/v4/account/bookmark-favorites/{handle}/{slug}": NonNullable<paths["/api/v4/account/bookmark-favorites/{handle}/{slug}"]["delete"]>;
    "DELETE /api/v4/account/bookmarks/{slug}": NonNullable<paths["/api/v4/account/bookmarks/{slug}"]["delete"]>;
    "GET /api/v4/account/backgrounds": NonNullable<paths["/api/v4/account/backgrounds"]["get"]>;
    "GET /api/v4/account/bans": NonNullable<paths["/api/v4/account/bans"]["get"]>;
    "GET /api/v4/account/bookmark-favorites": NonNullable<paths["/api/v4/account/bookmark-favorites"]["get"]>;
    "GET /api/v4/account/bookmarks": NonNullable<paths["/api/v4/account/bookmarks"]["get"]>;
    "GET /api/v4/account/collection": NonNullable<paths["/api/v4/account/collection"]["get"]>;
    "GET /api/v4/account/consents": NonNullable<paths["/api/v4/account/consents"]["get"]>;
    "GET /api/v4/account/items": NonNullable<paths["/api/v4/account/items"]["get"]>;
    "GET /api/v4/account/profile": NonNullable<paths["/api/v4/account/profile"]["get"]>;
    "GET /api/v4/account/settings": NonNullable<paths["/api/v4/account/settings"]["get"]>;
    "GET /api/v4/account/standing": NonNullable<paths["/api/v4/account/standing"]["get"]>;
    "GET /api/v4/account/wallet": NonNullable<paths["/api/v4/account/wallet"]["get"]>;
    "GET /api/v4/account/wallet/history": NonNullable<paths["/api/v4/account/wallet/history"]["get"]>;
    "GET /api/v4/achievements": NonNullable<paths["/api/v4/achievements"]["get"]>;
    "GET /api/v4/achievements/for-problem/{problemId}": NonNullable<paths["/api/v4/achievements/for-problem/{problemId}"]["get"]>;
    "GET /api/v4/achievements/items/{kind}/{key}": NonNullable<paths["/api/v4/achievements/items/{kind}/{key}"]["get"]>;
    "GET /api/v4/achievements/items/{kind}/{key}/holders": NonNullable<paths["/api/v4/achievements/items/{kind}/{key}/holders"]["get"]>;
    "GET /api/v4/affiliations/{id}": NonNullable<paths["/api/v4/affiliations/{id}"]["get"]>;
    "GET /api/v4/bookmarks": NonNullable<paths["/api/v4/bookmarks"]["get"]>;
    "GET /api/v4/health": NonNullable<paths["/api/v4/health"]["get"]>;
    "GET /api/v4/help/{slug}": NonNullable<paths["/api/v4/help/{slug}"]["get"]>;
    "GET /api/v4/me": NonNullable<paths["/api/v4/me"]["get"]>;
    "GET /api/v4/me/emoticons": NonNullable<paths["/api/v4/me/emoticons"]["get"]>;
    "GET /api/v4/me/tag-progress": NonNullable<paths["/api/v4/me/tag-progress"]["get"]>;
    "GET /api/v4/policies/{slug}": NonNullable<paths["/api/v4/policies/{slug}"]["get"]>;
    "GET /api/v4/policies/{slug}/{ref}": NonNullable<paths["/api/v4/policies/{slug}/{ref}"]["get"]>;
    "GET /api/v4/posts/help": NonNullable<paths["/api/v4/posts/help"]["get"]>;
    "GET /api/v4/posts/help/page": NonNullable<paths["/api/v4/posts/help/page"]["get"]>;
    "GET /api/v4/posts/notice": NonNullable<paths["/api/v4/posts/notice"]["get"]>;
    "GET /api/v4/posts/notice/{slug}": NonNullable<paths["/api/v4/posts/notice/{slug}"]["get"]>;
    "GET /api/v4/problems": NonNullable<paths["/api/v4/problems"]["get"]>;
    "GET /api/v4/problems/{problemId}": NonNullable<paths["/api/v4/problems/{problemId}"]["get"]>;
    "GET /api/v4/problems/{problemId}/reports": NonNullable<paths["/api/v4/problems/{problemId}/reports"]["get"]>;
    "GET /api/v4/problems/{problemId}/votes": NonNullable<paths["/api/v4/problems/{problemId}/votes"]["get"]>;
    "GET /api/v4/problems/{problemId}/votes/me": NonNullable<paths["/api/v4/problems/{problemId}/votes/me"]["get"]>;
    "GET /api/v4/problems/{problemId}/votes/summary": NonNullable<paths["/api/v4/problems/{problemId}/votes/summary"]["get"]>;
    "GET /api/v4/rankings/affiliation-board": NonNullable<paths["/api/v4/rankings/affiliation-board"]["get"]>;
    "GET /api/v4/rankings/affiliations": NonNullable<paths["/api/v4/rankings/affiliations"]["get"]>;
    "GET /api/v4/rankings/affiliations/{affiliationId}": NonNullable<paths["/api/v4/rankings/affiliations/{affiliationId}"]["get"]>;
    "GET /api/v4/rankings/regions": NonNullable<paths["/api/v4/rankings/regions"]["get"]>;
    "GET /api/v4/rankings/regions/{countryCode}": NonNullable<paths["/api/v4/rankings/regions/{countryCode}"]["get"]>;
    "GET /api/v4/rankings/reverse-rivals": NonNullable<paths["/api/v4/rankings/reverse-rivals"]["get"]>;
    "GET /api/v4/rankings/rivals": NonNullable<paths["/api/v4/rankings/rivals"]["get"]>;
    "GET /api/v4/rankings/tags": NonNullable<paths["/api/v4/rankings/tags"]["get"]>;
    "GET /api/v4/rankings/tags/{key}": NonNullable<paths["/api/v4/rankings/tags/{key}"]["get"]>;
    "GET /api/v4/rankings/users": NonNullable<paths["/api/v4/rankings/users"]["get"]>;
    "GET /api/v4/rankings/users/search": NonNullable<paths["/api/v4/rankings/users/search"]["get"]>;
    "GET /api/v4/search/analyze": NonNullable<paths["/api/v4/search/analyze"]["get"]>;
    "GET /api/v4/search/random-problem": NonNullable<paths["/api/v4/search/random-problem"]["get"]>;
    "GET /api/v4/search/suggest": NonNullable<paths["/api/v4/search/suggest"]["get"]>;
    "GET /api/v4/site/stats": NonNullable<paths["/api/v4/site/stats"]["get"]>;
    "GET /api/v4/sources": NonNullable<paths["/api/v4/sources"]["get"]>;
    "GET /api/v4/sources/contests/{id}": NonNullable<paths["/api/v4/sources/contests/{id}"]["get"]>;
    "GET /api/v4/sources/groups/{id}": NonNullable<paths["/api/v4/sources/groups/{id}"]["get"]>;
    "GET /api/v4/sources/oj/{ojId}/contests/{nativeId}": NonNullable<paths["/api/v4/sources/oj/{ojId}/contests/{nativeId}"]["get"]>;
    "GET /api/v4/sources/oj/{ojId}/groups/{nativeId}": NonNullable<paths["/api/v4/sources/oj/{ojId}/groups/{nativeId}"]["get"]>;
    "GET /api/v4/tags": NonNullable<paths["/api/v4/tags"]["get"]>;
    "GET /api/v4/tags/{key}": NonNullable<paths["/api/v4/tags/{key}"]["get"]>;
    "GET /api/v4/users/{handle}": NonNullable<paths["/api/v4/users/{handle}"]["get"]>;
    "GET /api/v4/users/{handle}/achievements": NonNullable<paths["/api/v4/users/{handle}/achievements"]["get"]>;
    "GET /api/v4/users/{handle}/achievements/summary": NonNullable<paths["/api/v4/users/{handle}/achievements/summary"]["get"]>;
    "GET /api/v4/users/{handle}/activity/days": NonNullable<paths["/api/v4/users/{handle}/activity/days"]["get"]>;
    "GET /api/v4/users/{handle}/activity/feed": NonNullable<paths["/api/v4/users/{handle}/activity/feed"]["get"]>;
    "GET /api/v4/users/{handle}/badge-stand": NonNullable<paths["/api/v4/users/{handle}/badge-stand"]["get"]>;
    "GET /api/v4/users/{handle}/bookmarks": NonNullable<paths["/api/v4/users/{handle}/bookmarks"]["get"]>;
    "GET /api/v4/users/{handle}/bookmarks/{slug}": NonNullable<paths["/api/v4/users/{handle}/bookmarks/{slug}"]["get"]>;
    "GET /api/v4/users/{handle}/collection": NonNullable<paths["/api/v4/users/{handle}/collection"]["get"]>;
    "GET /api/v4/users/{handle}/contributions": NonNullable<paths["/api/v4/users/{handle}/contributions"]["get"]>;
    "GET /api/v4/users/{handle}/rating/history": NonNullable<paths["/api/v4/users/{handle}/rating/history"]["get"]>;
    "GET /api/v4/users/{handle}/reputation": NonNullable<paths["/api/v4/users/{handle}/reputation"]["get"]>;
    "GET /api/v4/users/{handle}/reputation/log": NonNullable<paths["/api/v4/users/{handle}/reputation/log"]["get"]>;
    "GET /api/v4/users/{handle}/tags/{key}/histogram": NonNullable<paths["/api/v4/users/{handle}/tags/{key}/histogram"]["get"]>;
    "PATCH /api/v4/account/bookmarks/{slug}": NonNullable<paths["/api/v4/account/bookmarks/{slug}"]["patch"]>;
    "PATCH /api/v4/account/bookmarks/{slug}/problems/{problemId}": NonNullable<paths["/api/v4/account/bookmarks/{slug}/problems/{problemId}"]["patch"]>;
    "PATCH /api/v4/account/settings": NonNullable<paths["/api/v4/account/settings"]["patch"]>;
    "POST /api/v4/account/bookmark-favorites/{handle}/{slug}": NonNullable<paths["/api/v4/account/bookmark-favorites/{handle}/{slug}"]["post"]>;
    "POST /api/v4/account/bookmarks": NonNullable<paths["/api/v4/account/bookmarks"]["post"]>;
    "POST /api/v4/account/bookmarks/order": NonNullable<paths["/api/v4/account/bookmarks/order"]["post"]>;
    "POST /api/v4/account/bookmarks/{slug}/problems": NonNullable<paths["/api/v4/account/bookmarks/{slug}/problems"]["post"]>;
    "POST /api/v4/account/bookmarks/{slug}/problems/remove": NonNullable<paths["/api/v4/account/bookmarks/{slug}/problems/remove"]["post"]>;
    "POST /api/v4/oauth/revoke": NonNullable<paths["/api/v4/oauth/revoke"]["post"]>;
    "POST /api/v4/oauth/token": NonNullable<paths["/api/v4/oauth/token"]["post"]>;
}

export type V4OperationKey = keyof V4WireOperations;

export type V4Operation<K extends V4OperationKey> = V4WireOperations[K];

type ValueAt<T, Key extends PropertyKey> = T extends unknown
    ? Key extends keyof T
        ? NonNullable<T[Key]>
        : never
    : never;

type OperationParameters<K extends V4OperationKey> = ValueAt<
    V4Operation<K>,
    'parameters'
>;

type OperationResponses<K extends V4OperationKey> = ValueAt<
    V4Operation<K>,
    'responses'
>;

type MediaBody<T> = T extends { content: infer Content }
    ? Content[keyof Content]
    : never;

export type PathParams<K extends V4OperationKey> = ValueAt<
    OperationParameters<K>,
    'path'
>;

export type Query<K extends V4OperationKey> = ValueAt<
    OperationParameters<K>,
    'query'
>;

/**
 * The declared request payload shape. This does not imply that a body is
 * optional or required; runtime policy is owned by the operation manifest.
 */
export type RequestBody<K extends V4OperationKey> = MediaBody<
    ValueAt<V4Operation<K>, 'requestBody'>
>;

export type ResponseStatus<K extends V4OperationKey> = keyof OperationResponses<K>;

export type ResponseBody<
    K extends V4OperationKey,
    Status extends ResponseStatus<K>,
> = MediaBody<ValueAt<OperationResponses<K>, Status>>;
