/**
 * The panel's only door to Chrome, and therefore to the network
 * (docs/73 F154).
 *
 * Every other file under `src/panel` is React and decisions. This one talks
 * to the service worker — `chrome.runtime.sendMessage` for a value, a PORT
 * for a match, because a match is a stream of states rather than one answer.
 *
 * There is no `fetch` in this directory. `panel-render.test.tsx` greps for
 * one, and the reason it can is that every request lives on the other side of
 * this file.
 */

import type { ConfirmedProfile } from '../lib/confirmed';
import { MATCH_PORT, requestMatch, type MatchEvent, type PanelRequest } from '../lib/messages';

async function ask<T>(request: PanelRequest): Promise<T> {
  const reply = (await chrome.runtime.sendMessage(request)) as
    | { ok: true; value: T }
    | { ok: false; error: string }
    | undefined;
  if (!reply) throw new Error('The extension\'s background worker did not answer.');
  if (!reply.ok) throw new Error(reply.error);
  return reply.value;
}

export interface AuthState {
  signedIn: boolean;
  identifier?: string;
  /** docs/73 B1: a reading the browser interrupted was deleted just now */
  notice?: string;
}

export const authState = () => ask<AuthState>({ type: 'auth/state' });
export const sendCode = (identifier: string) => ask<{ sent: true }>({ type: 'auth/send-otp', identifier });
export const verifyCode = (identifier: string, code: string) =>
  ask<AuthState>({ type: 'auth/verify-otp', identifier, code });
export const signOut = () => ask<AuthState>({ type: 'auth/sign-out' });

/** What the worker hands back for a one-shot call. `resetsOn` is the daily
 *  cap's `X-Resets-On`, carried across because the panel sees no headers. */
export interface Reply {
  status: number;
  body: unknown;
  resetsOn: string | null;
}

/**
 * Delete the chat this reading created (docs/73 B1).
 *
 * Returns the outcome rather than throwing: "I could not delete it" is a
 * sentence the user needs, not an exception the panel swallows.
 */
export async function deleteReading(chatId: string): Promise<{ deleted: boolean; reason: string }> {
  try {
    const reply = await ask<Reply>({ type: 'reading/delete', chatId });
    // 404 means it is already gone, which is the outcome the user wanted.
    const deleted = reply.status === 204 || reply.status === 200 || reply.status === 404;
    return {
      deleted,
      reason: deleted ? '' : `The server answered ${reply.status}.`,
    };
  } catch (error) {
    return { deleted: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

export const suggestPlaces = (query: string) => ask<Reply>({ type: 'place/suggest', query });
export const resolvePlace = (place: string) => ask<Reply>({ type: 'place/resolve', place });

export interface MatchRun {
  /** the chat this run is happening in, once the worker has created it */
  chatId: () => string | null;
  /** answer an engine ask the user filled in themselves */
  answer: (text: string) => void;
  close: () => void;
}

/**
 * Start the §3a sequence in the worker and stream its states back.
 *
 * The parameter is `ConfirmedProfile`. A `ParsedProfile` does not compile
 * here — `type-fixtures/sends-parsed.ts` proves it — and the worker re-checks
 * the object anyway, because the structured clone drops the brand.
 */
export function startMatch(
  profile: ConfirmedProfile,
  title: string,
  onEvent: (event: MatchEvent) => void,
): MatchRun {
  const port = chrome.runtime.connect({ name: MATCH_PORT });
  let chatId: string | null = null;
  port.onMessage.addListener((event: MatchEvent | { type: 'chat'; chatId: string }) => {
    if (event.type === 'chat') {
      chatId = event.chatId;
      return;
    }
    onEvent(event);
  });
  port.postMessage(requestMatch(profile, title));
  return {
    chatId: () => chatId,
    answer: (text: string) => port.postMessage({ type: 'widget/answer', chatId, text }),
    close: () => port.disconnect(),
  };
}
