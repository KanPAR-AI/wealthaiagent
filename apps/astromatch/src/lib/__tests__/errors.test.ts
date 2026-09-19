/**
 * The error envelope this backend actually sends.
 *
 * `errors-404.json` was captured from the running container on 2026-09-19 —
 * `POST /api/v1/astrology/resolve-location` with an unresolvable place — and
 * it is the reason this module exists: the app's global handler reshapes
 * every `HTTPException` into `{"error": {...}}`, so a client reading `detail`
 * reads `undefined` and shows a generic sentence instead of the backend's.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  RESETS_ON_HEADER,
  failureSentence,
  readApiFailure,
  type HeaderLike,
} from '../errors';

const CAPTURED = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'resolve-nowhere-404.json'), 'utf8'),
);

const headers = (bag: Record<string, string>): HeaderLike => ({
  get: (name) => bag[name] ?? bag[name.toLowerCase()] ?? null,
});

describe('the envelope, as captured', () => {
  it('is `error.message`, not `detail`', () => {
    expect(CAPTURED.detail).toBeUndefined();
    expect(typeof CAPTURED.error.message).toBe('string');
    const failure = readApiFailure(404, CAPTURED);
    expect(failure.message).toContain('Path not found');
    expect(failure.code).toBe('NOT_FOUND');
  });

  it('still reads a plain `detail` when a route was not reshaped', () => {
    // Firebase's own endpoints answer `{"error": {"message": "…"}}` and an
    // unreshaped FastAPI route answers `{"detail": "…"}`. Both are read; the
    // envelope wins when both are present.
    expect(readApiFailure(400, { detail: 'Incorrect code.' }).message).toBe('Incorrect code.');
    expect(
      readApiFailure(400, { detail: 'ignored', error: { message: 'the real one' } }).message,
    ).toBe('the real one');
  });

  it('never invents a message out of a body it cannot read', () => {
    for (const body of [null, undefined, 'a string', 42, {}, { error: 'not an object' }]) {
      expect(readApiFailure(500, body).message).toBe('');
    }
  });
});

describe('the capture cap (429) carries its reset on a HEADER', () => {
  it('reads X-Resets-On', () => {
    const failure = readApiFailure(
      429,
      { error: { code: 'RATE_LIMITED', message: "That's ten captures today." } },
      headers({ [RESETS_ON_HEADER]: '2026-09-20' }),
    );
    expect(failure.resetsOn).toBe('2026-09-20');
    expect(failureSentence(failure, 'x')).toBe(
      "That's ten captures today. (it comes back on 2026-09-20)",
    );
  });

  it('reads it case-insensitively, the way a Headers object answers', () => {
    const failure = readApiFailure(429, {}, headers({ 'x-resets-on': '2026-09-20' }));
    expect(failure.resetsOn).toBe('2026-09-20');
  });

  it('does not claim a reset on any other status', () => {
    expect(readApiFailure(500, {}, headers({ [RESETS_ON_HEADER]: '2026-09-20' })).resetsOn).toBeNull();
  });
});

describe('the sentence shown to a user', () => {
  it('prefers the backend\'s own words', () => {
    const failure = readApiFailure(429, { error: { message: 'Please wait before requesting another code.' } });
    expect(failureSentence(failure, 'Could not send the code')).toBe(
      'Please wait before requesting another code.',
    );
  });

  it('is never blank — a blank error is a button that did nothing', () => {
    const sentence = failureSentence(readApiFailure(503, null), 'Could not reach the reading');
    expect(sentence).toBe('Could not reach the reading (503)');
    expect(sentence.length).toBeGreaterThan(10);
  });
});
