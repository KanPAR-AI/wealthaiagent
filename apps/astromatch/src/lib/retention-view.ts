/**
 * What is kept, what is deleted, and what the panel is allowed to say about
 * it (docs/73 B1).
 *
 * ── the sentence this file exists to replace ──────────────────────────────
 *
 * PH-39 shipped "the birth values you gave sit in this chat for 24 hours".
 * That is FALSE, and the review that found it was right to call it a safety
 * issue rather than a wording one. 24 hours is the Redis slot TTL
 * (`core/config.REDIS_SLOT_TTL = 86400`). The chat MESSAGE — the human echo
 * plus the ```input_response``` fence, carrying a third party's date, time
 * and place of birth — is a Firestore document under `chats/{id}/messages`
 * with no TTL at all. It sits there until somebody deletes it.
 *
 * ── the decision, and what it rests on ────────────────────────────────────
 *
 * For an UNSAVED instant reading the panel deletes the chat it created when
 * the user leaves it — or closes the panel, or opens AstroMatch again after
 * closing the browser (`sw.ts`'s sweep).
 *
 * What that delete removes is DECLARED below as `ENGINE_DELETE_REMOVES` and
 * pinned on the engine side by `chatservice/tests/test_chat_delete_contract.py`.
 * It is a constant here rather than a cross-repo file read: `wealthaiagent`
 * is its own git repository, so a test that read `../../chatservice/...`
 * would find nothing in CI and pass forever while proving nothing (the
 * previous version of that test did exactly this, and a mutation proved it —
 * F199).
 *
 * ── what the sentences may therefore claim ───────────────────────────────
 *
 * The CHAT, and nothing beyond it. The delete removes the conversation, its
 * messages and the chat's slot events, and best-effort purges the Redis
 * envelope whose TTL is 24 hours. It says nothing about anything else that
 * may have read the turn on its way past, because this client cannot know
 * and must not imply. "The birth details you typed are gone from your
 * account" was exactly that over-claim and is gone with it.
 *
 */

/**
 * What `DELETE /chats/{id}` removes, declared.
 *
 * Kept in sync by `chatservice/tests/test_chat_delete_contract.py` — the
 * engine-side test that pins the four behaviours. If that contract ever
 * changes, the sentences below are what has to change with it.
 */
export const ENGINE_DELETE_REMOVES = {
  /** every document under `chats/{id}/messages` — the human echo AND the
   *  `input_response` fence, which is where the birth values are */
  messages: true,
  /** `chats/{id}/slot_events`, the durable slot-event log */
  slotEvents: true,
  /** the chat document itself */
  chatDocument: true,
  /** `slots:{id}:*`, `overlay:{id}:*`, `slots:rehydrated:{id}:*`,
   *  `chat_agent:{id}` — BEST EFFORT, inside a try whose failure is logged
   *  and swallowed, with the TTL as the backstop */
  redisSlots: 'best-effort',
  /** `REDIS_SLOT_TTL` — the longest a working copy can outlive the delete */
  redisTtlHours: 24,
  /** Deliberately NOT claimed: anything outside the chat. This client cannot
   *  see it and must not imply it. */
  anythingElse: false,
} as const;

export type DeleteOutcome =
  /** the user is still reading it; nothing has been attempted */
  | { kind: 'pending' }
  | { kind: 'deleting' }
  | { kind: 'deleted' }
  | { kind: 'failed'; reason: string };

export interface RetentionNotice {
  headline: string;
  detail: string;
  /** offer a retry — only where retrying is the honest next step */
  retry: boolean;
  /** the tone the panel draws it in */
  tone: 'neutral' | 'warn';
}

export const SAVED_NOTHING_HEADLINE = 'This reading was not saved to your matches.';

export function retentionNotice(outcome: DeleteOutcome): RetentionNotice {
  if (outcome.kind === 'pending') {
    return {
      headline: SAVED_NOTHING_HEADLINE,
      detail:
        'No person was created and nothing was added to your people. When you leave or close ' +
        'this panel I will delete the conversation. If the browser is closed first, it is ' +
        'deleted the next time you open AstroMatch.',
      retry: false,
      tone: 'neutral',
    };
  }
  if (outcome.kind === 'deleting') {
    return {
      headline: 'Deleting this reading…',
      detail: 'Removing the conversation from your chat history.',
      retry: false,
      tone: 'neutral',
    };
  }
  if (outcome.kind === 'deleted') {
    return {
      headline: 'This reading and the details you entered were deleted.',
      detail:
        'The conversation and its messages are gone from your chat history. A temporary ' +
        'working copy in the session store clears within 24 hours.',
      retry: false,
      tone: 'neutral',
    };
  }
  return {
    headline: 'I could not delete this reading.',
    detail:
      `${outcome.reason} It is still in your chat history, and the birth details you entered ` +
      'are in it. Try again, or delete the chat in the app.',
    retry: true,
    tone: 'warn',
  };
}

/**
 * Was this chat left behind?
 *
 * Used by the panel to decide whether "leaving" needs a delete at all — a
 * reading the user SAVED is theirs to keep, and a run that never got a chat
 * id has nothing to delete.
 */
export function needsDelete(chatId: string | null, saved: boolean): boolean {
  return Boolean(chatId) && !saved;
}
