import type { IncomingMessage } from 'node:http';

import { readUniqueRawHeader } from './request-headers.js';

export const MAX_REQUEST_BODY_BYTES = 65_536;

export interface RequestBodyHeaders {
  readonly contentLength: number | undefined;
  readonly chunked: boolean;
  readonly contentType: string | undefined;
  readonly contentEncoding: string | undefined;
  readonly hasFraming: boolean;
  readonly hasUnreadBody: boolean;
}

export type RequestBodyHeaderResult =
  | { readonly kind: 'valid'; readonly value: RequestBodyHeaders }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'invalid-media'; readonly value: RequestBodyHeaders }
  | { readonly kind: 'too-large' };

function headerValue(
  rawHeaders: readonly string[] | undefined,
  name: string,
): string | undefined | null {
  const header = readUniqueRawHeader(rawHeaders, name);
  if (header.kind === 'invalid') {
    return null;
  }
  return header.kind === 'value' ? header.value : undefined;
}

function trimOws(value: string): string {
  return value.replace(/^[\t ]+|[\t ]+$/gu, '');
}

export function inspectRequestBodyHeaders(
  rawHeaders: readonly string[] | undefined,
  knownBodyBytes = 0,
): RequestBodyHeaderResult {
  if (!Number.isSafeInteger(knownBodyBytes) || knownBodyBytes < 0) {
    return { kind: 'invalid' };
  }
  const rawContentLength = headerValue(rawHeaders, 'content-length');
  const rawTransferEncoding = headerValue(rawHeaders, 'transfer-encoding');
  const rawContentType = headerValue(rawHeaders, 'content-type');
  const rawContentEncoding = headerValue(rawHeaders, 'content-encoding');
  if (rawContentLength === null || rawTransferEncoding === null) {
    return { kind: 'invalid' };
  }
  const invalidMedia = rawContentType === null || rawContentEncoding === null;

  let contentLength: number | undefined;
  if (rawContentLength !== undefined) {
    const normalized = trimOws(rawContentLength);
    if (!/^\d+$/u.test(normalized)) {
      return { kind: 'invalid' };
    }
    const significant = normalized.replace(/^0+(?=\d)/u, '');
    if (
      significant.length > String(MAX_REQUEST_BODY_BYTES).length ||
      (significant.length === String(MAX_REQUEST_BODY_BYTES).length &&
        significant > String(MAX_REQUEST_BODY_BYTES))
    ) {
      return { kind: 'too-large' };
    }
    contentLength = Number(normalized);
    if (contentLength > MAX_REQUEST_BODY_BYTES) {
      return { kind: 'too-large' };
    }
  }

  const chunked = rawTransferEncoding !== undefined;
  if (
    (chunked && trimOws(rawTransferEncoding).toLowerCase() !== 'chunked') ||
    (chunked && contentLength !== undefined)
  ) {
    return { kind: 'invalid' };
  }
  if (knownBodyBytes > MAX_REQUEST_BODY_BYTES) {
    return { kind: 'too-large' };
  }

  const value = Object.freeze({
    contentLength,
    chunked,
    contentType: invalidMedia ? undefined : rawContentType,
    contentEncoding: invalidMedia ? undefined : rawContentEncoding,
    hasFraming: contentLength !== undefined || chunked || knownBodyBytes > 0,
    hasUnreadBody:
      chunked ||
      (contentLength !== undefined && contentLength > 0) ||
      knownBodyBytes > 0,
  });
  return {
    kind: invalidMedia ? 'invalid-media' : 'valid',
    value,
  };
}

export function isStrictJsonContentType(value: string): boolean {
  return /^application\/json(?:[\t ]*;[\t ]*charset[\t ]*=[\t ]*utf-8)?$/i.test(
    trimOws(value),
  );
}

export type IncomingBodyResult =
  | { readonly kind: 'ok'; readonly body: Uint8Array }
  | { readonly kind: 'too-large' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'aborted' };

export function readIncomingBody(
  request: IncomingMessage,
  expectedLength: number | undefined,
  signal: AbortSignal,
): Promise<IncomingBodyResult> {
  return new Promise((resolve) => {
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    let settled = false;

    const cleanup = (): void => {
      request.removeListener('data', onData);
      request.removeListener('end', onEnd);
      request.removeListener('aborted', onAborted);
      request.removeListener('error', onError);
      signal.removeEventListener('abort', onSignalAbort);
    };
    const settle = (result: IncomingBodyResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(result);
    };
    const onData = (chunk: unknown): void => {
      if (!(chunk instanceof Uint8Array)) {
        request.pause();
        settle({ kind: 'invalid' });
        return;
      }
      totalBytes += chunk.byteLength;
      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        request.pause();
        settle({ kind: 'too-large' });
        return;
      }
      chunks.push(Uint8Array.from(chunk));
    };
    const onEnd = (): void => {
      if (request.complete === false) {
        settle({ kind: 'invalid' });
        return;
      }
      if (expectedLength !== undefined && totalBytes !== expectedLength) {
        settle({ kind: 'invalid' });
        return;
      }
      const body = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
      }
      settle({ kind: 'ok', body });
    };
    const onAborted = (): void => settle({ kind: 'aborted' });
    const onError = (): void => settle({ kind: 'aborted' });
    const onSignalAbort = (): void => {
      request.pause();
      settle({ kind: 'aborted' });
    };

    request.on('data', onData);
    request.once('end', onEnd);
    request.once('aborted', onAborted);
    request.once('error', onError);
    signal.addEventListener('abort', onSignalAbort, { once: true });
    if (signal.aborted) {
      onSignalAbort();
      return;
    }
    if (request.aborted || request.destroyed) {
      onAborted();
      return;
    }
    request.resume();
  });
}
