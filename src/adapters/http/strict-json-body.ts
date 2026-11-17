import type { JsonValue } from '../../domain/request-json-schema.js';
import {
  createValidatedJsonRequestBody,
  type ValidatedJsonRequestBody,
} from '../../domain/validated-json-request-body.js';
import type { V4RequestSchema } from '../../domain/v4-operation-contract.js';

export const MAX_JSON_NESTING_DEPTH = 64;

class InvalidJson extends Error {}

class JsonScanner {
  private index = 0;

  constructor(private readonly source: string) {}

  scan(): void {
    this.skipWhitespace();
    this.scanValue(0);
    this.skipWhitespace();
    if (this.index !== this.source.length) {
      throw new InvalidJson();
    }
  }

  private skipWhitespace(): void {
    while (this.index < this.source.length) {
      const code = this.source.charCodeAt(this.index);
      if (code !== 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
        return;
      }
      this.index += 1;
    }
  }

  private scanValue(depth: number): void {
    const current = this.source[this.index];
    if (current === '{') {
      this.scanObject(depth + 1);
    } else if (current === '[') {
      this.scanArray(depth + 1);
    } else if (current === '"') {
      this.scanString();
    } else if (current === 't') {
      this.scanLiteral('true');
    } else if (current === 'f') {
      this.scanLiteral('false');
    } else if (current === 'n') {
      this.scanLiteral('null');
    } else {
      this.scanNumber();
    }
  }

  private enterContainer(depth: number): void {
    if (depth > MAX_JSON_NESTING_DEPTH) {
      throw new InvalidJson();
    }
  }

  private scanObject(depth: number): void {
    this.enterContainer(depth);
    this.index += 1;
    this.skipWhitespace();
    if (this.source[this.index] === '}') {
      this.index += 1;
      return;
    }

    const keys = new Set<string>();
    for (;;) {
      if (this.source[this.index] !== '"') {
        throw new InvalidJson();
      }
      const key = this.scanString();
      if (keys.has(key)) {
        throw new InvalidJson();
      }
      keys.add(key);
      this.skipWhitespace();
      if (this.source[this.index] !== ':') {
        throw new InvalidJson();
      }
      this.index += 1;
      this.skipWhitespace();
      this.scanValue(depth);
      this.skipWhitespace();
      const separator = this.source[this.index];
      if (separator === '}') {
        this.index += 1;
        return;
      }
      if (separator !== ',') {
        throw new InvalidJson();
      }
      this.index += 1;
      this.skipWhitespace();
    }
  }

  private scanArray(depth: number): void {
    this.enterContainer(depth);
    this.index += 1;
    this.skipWhitespace();
    if (this.source[this.index] === ']') {
      this.index += 1;
      return;
    }

    for (;;) {
      this.scanValue(depth);
      this.skipWhitespace();
      const separator = this.source[this.index];
      if (separator === ']') {
        this.index += 1;
        return;
      }
      if (separator !== ',') {
        throw new InvalidJson();
      }
      this.index += 1;
      this.skipWhitespace();
    }
  }

  private scanString(): string {
    const start = this.index;
    this.index += 1;
    for (;;) {
      if (this.index >= this.source.length) {
        throw new InvalidJson();
      }
      const code = this.source.charCodeAt(this.index);
      if (code === 0x22) {
        this.index += 1;
        const decoded: unknown = JSON.parse(
          this.source.slice(start, this.index),
        );
        if (typeof decoded !== 'string') {
          throw new InvalidJson();
        }
        return decoded;
      }
      if (code < 0x20) {
        throw new InvalidJson();
      }
      if (code !== 0x5c) {
        this.index += 1;
        continue;
      }

      this.index += 1;
      const escaped = this.source[this.index];
      if (
        escaped === '"' ||
        escaped === '\\' ||
        escaped === '/' ||
        escaped === 'b' ||
        escaped === 'f' ||
        escaped === 'n' ||
        escaped === 'r' ||
        escaped === 't'
      ) {
        this.index += 1;
        continue;
      }
      if (escaped !== 'u') {
        throw new InvalidJson();
      }
      for (let offset = 1; offset <= 4; offset += 1) {
        const digit = this.source[this.index + offset];
        if (digit === undefined || !/^[0-9a-fA-F]$/u.test(digit)) {
          throw new InvalidJson();
        }
      }
      this.index += 5;
    }
  }

  private scanLiteral(literal: 'true' | 'false' | 'null'): void {
    if (this.source.slice(this.index, this.index + literal.length) !== literal) {
      throw new InvalidJson();
    }
    this.index += literal.length;
  }

  private scanNumber(): void {
    if (this.source[this.index] === '-') {
      this.index += 1;
    }
    const first = this.source[this.index];
    if (first === '0') {
      this.index += 1;
      if (/^[0-9]$/u.test(this.source[this.index] ?? '')) {
        throw new InvalidJson();
      }
    } else if (first !== undefined && /^[1-9]$/u.test(first)) {
      do {
        this.index += 1;
      } while (/^[0-9]$/u.test(this.source[this.index] ?? ''));
    } else {
      throw new InvalidJson();
    }

    if (this.source[this.index] === '.') {
      this.index += 1;
      if (!/^[0-9]$/u.test(this.source[this.index] ?? '')) {
        throw new InvalidJson();
      }
      do {
        this.index += 1;
      } while (/^[0-9]$/u.test(this.source[this.index] ?? ''));
    }
    if (this.source[this.index] === 'e' || this.source[this.index] === 'E') {
      this.index += 1;
      if (this.source[this.index] === '+' || this.source[this.index] === '-') {
        this.index += 1;
      }
      if (!/^[0-9]$/u.test(this.source[this.index] ?? '')) {
        throw new InvalidJson();
      }
      do {
        this.index += 1;
      } while (/^[0-9]$/u.test(this.source[this.index] ?? ''));
    }
  }
}

function startsWithUtf8Bom(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  );
}

export function parseAndValidateJsonBody(
  bytes: Uint8Array,
  schema: V4RequestSchema,
): ValidatedJsonRequestBody | undefined {
  if (bytes.byteLength === 0 || startsWithUtf8Bom(bytes)) {
    return undefined;
  }

  try {
    const text = new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    if (text.charCodeAt(0) === 0xfeff) {
      return undefined;
    }
    new JsonScanner(text).scan();
    const value = JSON.parse(text) as JsonValue;
    return createValidatedJsonRequestBody(value, schema);
  } catch {
    return undefined;
  }
}
