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
  /**
   * WHICH fact the correction was for — `date_of_birth` / `time_of_birth` /
   * `place_of_birth`, or null when this outcome did not come from a
   * field-scoped edit (the add-a-member flow reports through here too).
   *
   * It travels because the birth-details lock needs it (F345): the engine's
   * receipt states the new value, so while the details are hidden Profile
   * draws a client-owned sentence keyed by the FIELD instead. This is that
   * key, taken from the route param `editRoute` set — never parsed out of
   * the engine's sentence, which would be reading a value in order to hide
   * one.
   *
   * Still not a value: this is a field NAME, and a birth fact does not
   * travel through this store any more than it did before.
   */
  field: string | null;
  report: (outcome: string, failed?: boolean, field?: string | null) => void;
  clear: () => void;
}

export const useEditOutcome = create<EditOutcomeState>((set) => ({
  outcome: '',
  failed: false,
  field: null,
  report: (outcome: string, failed = false, field: string | null = null) =>
    set({ outcome, failed, field }),
  clear: () => set({ outcome: '', failed: false, field: null }),
}));
