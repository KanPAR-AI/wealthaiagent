// Which conversation a handed-off turn lands in (owner ruling 2026-09-11:
// "when ask about my match always start a new chat").
//
// PURE: no React, no expo — the root jest project runs it; the chat screen
// applies what this returns and decides nothing.
//
// A handoff arrives as route params: `pending` (the turn to send), an
// optional `chatId` (join THAT conversation — screen 2's flow, a Profile
// edit), an optional `fresh: '1'` (ALWAYS a new conversation, even when the
// mounted chat tab already holds one — the match surfaces), and an optional
// `handoffKey` (identity, so a SECOND ask about a different match sends
// rather than being swallowed by a once-ever flag — the previous
// `sentHandoff` ref meant exactly one handoff per app launch, measured as
// the second "Ask AI" doing nothing).
//
// The match surfaces used to pass `lastChatId()` on purpose, with a comment
// explaining that a fresh chat would just re-ask for birth details — true
// until chatservice `dea07ce`, whose stored-match rehydration is what makes
// this ruling servable: a fresh chat now answers from the stored scorecard.

export interface HandoffParams {
  pending?: string;
  chatId?: string;
  fresh?: string;
  handoffKey?: string;
}

export type HandoffAction =
  | { kind: 'none' }
  /** The named chat is still being adopted — try again when it is. */
  | { kind: 'wait' }
  /** Leave the current conversation first; the effect re-runs at null. */
  | { kind: 'reset' }
  /** Send the turn, and remember this handoff's key. */
  | { kind: 'send'; key: string };

export function handoffKeyOf(params: HandoffParams): string | null {
  const pending = params.pending?.trim();
  if (!pending) return null;
  // The key falls back to the turn's own text: two taps of the SAME
  // suggestion stay one send (the old once-ever behaviour, per text),
  // while a different ask is a different key and goes through.
  return params.handoffKey?.trim() || pending;
}

export function handoffAction(
  params: HandoffParams,
  currentChatId: string | null,
  lastKey: string | null,
): HandoffAction {
  const pending = params.pending?.trim();
  if (!pending) return { kind: 'none' };
  const key = handoffKeyOf(params) as string;
  if (lastKey === key) return { kind: 'none' };
  const incoming = params.chatId?.trim();
  if (incoming) {
    // Join the named conversation (screen 2, Profile edits) — but only
    // once it has actually been adopted, or the turn opens a second chat.
    return currentChatId === incoming ? { kind: 'send', key }
                                      : { kind: 'wait' };
  }
  if (params.fresh === '1' && currentChatId !== null) {
    return { kind: 'reset' };
  }
  return { kind: 'send', key };
}


/** Bug bcadc9f2 (owner 2026-09-18: "start a new chat also so context is not
 *  contaminated for the new person"): the engine's `reading_handoff` block —
 *  the sentence to re-send in a FRESH chat, and who it is for. Pure. */
export interface ReadingHandoff {
  turn: string;
  who: string;
  /** docs/67 H-2: the fresh chat is SEALED from the profile (nothing
   *  seeded, nothing written) — a stranger's reading, by construction. */
  standalone: boolean;
}

export function parseReadingHandoff(value: unknown): ReadingHandoff | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.type !== undefined && v.type !== 'reading_handoff') return null;
  const turn = typeof v.turn === 'string' ? v.turn.trim() : '';
  if (!turn) return null;
  const who = typeof v.who === 'string' && v.who.trim() ? v.who.trim() : 'them';
  return { turn, who, standalone: v.standalone === true };
}
