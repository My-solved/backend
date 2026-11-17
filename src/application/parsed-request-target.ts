export interface ParsedRequestTarget {
  readonly url: URL;
  readonly pathname: string;
  readonly decodedPathSegments: readonly string[];
}
