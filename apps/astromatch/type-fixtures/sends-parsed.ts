/**
 * NOT part of the app's build and not a jest test — this file exists to FAIL
 * type-checking (docs/73 ASTRAL-326).
 *
 * `trust-boundary.test.ts` compiles it with the app's own options and asserts
 * the error is real and is about the argument. If `ParsedProfile` ever
 * becomes assignable to `ConfirmedProfile` — a widened signature, a dropped
 * brand, an `any` at the door — this file starts compiling and that test
 * fails, which is the whole point of having it.
 */
import { parseProfileText } from '../src/lib/parse-profile';
import { requestMatch } from '../src/lib/messages';

const parsed = parseProfileText('Name: Someone\nDOB: 1994-05-14');

// A machine's reading, handed straight to the door. This must not compile.
export const leak = requestMatch(parsed, 'Match — Someone');
