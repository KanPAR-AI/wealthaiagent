// The one sentence an in-place edit leaves behind for the screen it came
// from (docs/49 ASTRAL-138).
//
// A store rather than a route param, for one reason: the edit screen was
// PUSHED on top of Profile, so it returns with `router.back()` and the
// Profile underneath it is the same instance. Replacing that instance to
// carry a param would leave two Profiles in the stack and make the back
// gesture visit the pre-edit one — the stale screen the whole feature exists
// to stop showing.
//
// Deliberately holds a SENTENCE and nothing else. It is not a cache of the
// person, not a copy of a birth fact, and nothing reads a value out of it:
// Profile re-fetches `self` from the server on focus, because the store is
// the truth and this is only the receipt.

import { create } from 'zustand';

interface EditOutcomeState {
  /** the engine's own outcome sentence, or '' when there is nothing to say */
  outcome: string;
  /** true when the edit did not complete — the banner says so differently */
  failed: boolean;
  report: (outcome: string, failed?: boolean) => void;
  clear: () => void;
}

export const useEditOutcome = create<EditOutcomeState>((set) => ({
  outcome: '',
  failed: false,
  report: (outcome: string, failed = false) => set({ outcome, failed }),
  clear: () => set({ outcome: '', failed: false }),
}));
