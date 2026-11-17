export type V4HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type V4AccessClass = 'open' | 'app' | 'public' | 'user';

export type V4BearerPolicy = 'none' | 'optional' | 'required';

export type V4JsonScalar = string | number | boolean | null;

interface V4SchemaBase {
  readonly nullable: boolean;
  readonly annotationDefault?: V4JsonScalar;
}

export interface V4StringSchema extends V4SchemaBase {
  readonly kind: 'string';
  readonly enum?: readonly (string | null)[];
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
}

export interface V4IntegerSchema extends V4SchemaBase {
  readonly kind: 'integer';
  readonly enum?: readonly (number | null)[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly exclusiveMinimum?: number;
}

export interface V4BooleanSchema extends V4SchemaBase {
  readonly kind: 'boolean';
  readonly enum?: readonly (boolean | null)[];
}

export interface V4ArraySchema extends V4SchemaBase {
  readonly kind: 'array';
  readonly items: V4RequestSchema;
  readonly minItems?: number;
  readonly maxItems?: number;
}

export interface V4ObjectSchema extends V4SchemaBase {
  readonly kind: 'object';
  readonly properties: Readonly<Record<string, V4RequestSchema>>;
  readonly required: readonly string[];
  readonly unknownProperties: 'reject';
}

export interface V4AnyOfSchema extends V4SchemaBase {
  readonly kind: 'anyOf';
  readonly options: readonly V4RequestSchema[];
}

export type V4RequestSchema =
  | V4StringSchema
  | V4IntegerSchema
  | V4BooleanSchema
  | V4ArraySchema
  | V4ObjectSchema
  | V4AnyOfSchema;

export interface V4OperationParameter {
  readonly name: string;
  readonly sourceRequired: boolean;
  readonly required: boolean;
  readonly schema: V4RequestSchema;
  readonly gatewayOverride?: 'required-non-null-path';
}

export interface V4RequestBodyContract {
  readonly declaredRequired: boolean;
  readonly effectiveRequired: true;
  readonly mediaType: 'application/json';
  readonly schema: V4RequestSchema;
}

export interface V4ResponseContract {
  readonly mediaTypes: readonly ('application/json')[];
  readonly requiredHeaders: readonly string[];
  readonly source: 'openapi' | 'gateway-global' | 'access-global';
}

export type V4RuntimePolicy =
  | {
      readonly enabled: true;
      readonly policy: 'generated';
      readonly supplement?: never;
    }
  | {
      readonly enabled: false;
      readonly policy: 'supplement-required';
      readonly supplement: 'oauth-token' | 'oauth-revoke';
    };

export interface V4OperationContract {
  readonly method: V4HttpMethod;
  readonly upstreamPath: `/api/v4/${string}`;
  readonly gatewayPath: `/solved/v4/${string}`;
  readonly access: {
    readonly bearer: V4BearerPolicy;
    readonly class: V4AccessClass;
    readonly scope?: string;
  };
  readonly runtime: V4RuntimePolicy;
  readonly parameters: {
    readonly path: readonly V4OperationParameter[];
    readonly query: readonly V4OperationParameter[];
  };
  readonly requestBody: V4RequestBodyContract | null;
  readonly responses: Readonly<Record<string, V4ResponseContract>>;
}

export type V4OperationManifest = Readonly<
  Record<string, V4OperationContract>
>;
