/**
 * NOT part of the build — this file exists to FAIL type-checking
 * (docs/73 ASTRAL-327: "the two-state collapse is NOT representable in the
 * type").
 *
 * A field that knows only "we have it" and "we don't" loses the distinction
 * the whole review screen is for: "not found" and "found but guessed" are
 * different risks. `review.test.ts` compiles this and asserts the error is
 * real and is about the state.
 */
import type { Candidate } from '../src/lib/confirmed';

// `present` is the two-state world's word for it. This must not compile.
export const collapsed: Candidate = {
  state: 'present',
  value: 'Pune',
  confidence: 0.9,
};
