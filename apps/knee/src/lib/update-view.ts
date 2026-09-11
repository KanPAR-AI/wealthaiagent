// The update prompt's decisions, pure (house rule 2). Owner ask 2026-09-11:
// "if there is an ota upgrade and app is opened display a pop up so user can
// upgrade" — replacing the silent immediate reload, which could yank the app
// out from under a user mid-workout. The screen renders what this returns and
// decides nothing.

export interface UpdatePromptState {
  /** an update is fetched and ready — the popup is showing */
  ready: boolean;
  /** the user tapped "Later" for this update id — don't re-nag THIS session */
  deferredId: string | null;
}

export const initialState: UpdatePromptState = { ready: false, deferredId: null };

/** A fetched update arrived. Shows the popup — unless the user already
 *  deferred this exact update in this session (re-checks fire on every
 *  foreground; a popup that reappears seconds after "Later" is a nag). A
 *  DIFFERENT update id prompts again: newer code supersedes the deferral. */
export function onFetched(s: UpdatePromptState, updateId: string | null): UpdatePromptState {
  if (updateId !== null && s.deferredId === updateId) return s;
  return { ready: true, deferredId: s.deferredId };
}

/** "Later": hide, remember the id, apply on next cold start (expo-updates'
 *  default behaviour for an already-fetched update). */
export function onDeferred(s: UpdatePromptState, updateId: string | null): UpdatePromptState {
  return { ready: false, deferredId: updateId };
}

/** "Update now" hides the popup; the caller reloads. */
export function onAccepted(_s: UpdatePromptState): UpdatePromptState {
  return { ready: false, deferredId: null };
}
