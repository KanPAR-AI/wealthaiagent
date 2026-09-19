// The scorecard screen's view model (docs/49 ASTRAL-241, from F86).
//
// PURE — no React, no react-native — like every other `*-view.ts` here.
//
// ── what this file must NOT do, and why the row says so ───────────────────
//
// The whole scorecard has been STORED since PH-6 and only a list row was ever
// served, so the only way to ask "why is Nadi zero" was to ask a model. The
// read now serves the stored artifact as the `match_report` payload the shared
// `MatchScorecard` already renders — so this module's job is to decide the
// PAGE around that component and to touch none of its numbers:
//
//   · no percentage, ever (INV-5);
//   · no `/36` on a firm-only match — `total` is null there on purpose;
//   · no verdict recomputed, reworded or ranked (ASTRAL-143);
//   · no koota re-scored, and a `pending` koota is never a zero.
//
// The one affordance that opens a conversation is declared here, once, and
// used once (ASTRAL-241): a second "for convenience" entry point is how a
// native surface quietly becomes a chat launcher again.

import {
  ASK_ABOUT_MATCH_LABEL,
  askAboutMatchTurn,
  formatIsoDate,
  matchStaleSentence,
} from '@wealthai/astral';
import type { MatchReportPayload } from '@wealthai/astral';

import type { MatchDetail } from './people-shapes';

export type MatchDetailState = 'ready' | 'refused' | 'empty';

export interface MatchHeader {
  /** the other person's name, joined at read (ASTRAL-141) */
  name: string;
  /** the group's own meaning, in words: which scale this match is on */
  scale: string;
  /** "Computed 24 Aug 2026", or null when the record does not say */
  computed: string | null;
  /** the freshness sentence, or null when it is fresh and there is nothing
   *  to say */
  freshness: string | null;
}

const SCALES: Record<string, string> = {
  complete: 'Scored out of 36',
  firm_only: 'Partly scored — 21 of the 36 gunas need a birth time',
  refused: 'Not scored — a birth time is missing on one side',
};

export function detailState(detail: MatchDetail | null): MatchDetailState {
  if (!detail) return 'empty';
  if (detail.report) return 'ready';
  return 'refused';
}

export function header(detail: MatchDetail): MatchHeader {
  return {
    name: detail.display_name || 'This match',
    scale: SCALES[String(detail.group)] ?? '',
    computed: detail.computed_at
      ? formatIsoDate(String(detail.computed_at).slice(0, 10))
      : null,
    freshness: freshnessSentence(detail),
  };
}

/**
 * What the freshness means for THIS screen — and it NAMES NO CAUSE
 * (docs/73 PH-41 FLAG-2).
 *
 * A stale match is still REPORTED stale and served as it was computed
 * (ASTRAL-33/182): re-running gun milan on a read would make the number on
 * the screen differ from the number the user was told, with no event in
 * between.
 *
 * What changed is the BLAME. This said "a birth fact on one side has changed
 * since this was scored", and the payload cannot support it — `freshness` is
 * a stamp comparison, and the stamp covers the function version and the
 * calculation settings as well as the inputs. The sentence now lives in
 * `@wealthai/astral` and is shared with the matches list and with the
 * AstroMatch extension.
 */
export function freshnessSentence(detail: MatchDetail): string | null {
  return matchStaleSentence({
    freshness: detail.freshness,
    computedAt: detail.computed_at,
    scored: Boolean(detail.report),
  });
}

/** ASTRAL-144: a refusal is the whole answer — the reason, and the ask that
 *  would change it. Never an empty ring and never a zero. */
export function refusal(detail: MatchDetail): { reason: string; ask: string | null } | null {
  const raw = detail.refusal;
  if (!raw) return null;
  const reason = String(raw.reason ?? '');
  if (!reason) return null;
  return { reason, ask: raw.ask ? String(raw.ask) : null };
}

/**
 * THE one affordance on this screen that opens a conversation (ASTRAL-146).
 *
 * It carries a NAME and nothing else. A handoff that restates birth facts is
 * a second write path wearing a prompt's clothes, and the restated copy is
 * the one that goes stale.
 *
 * FLAG-6: the LABEL is the package's too, now that a second surface offers
 * the same act — one control, one name for it, in one place.
 */
export const ASK_AI_LABEL = ASK_ABOUT_MATCH_LABEL;

/**
 * The turn itself lives in `@wealthai/astral` as of docs/73 PH-41.
 *
 * A SECOND surface now opens the same conversation — the AstroMatch panel's
 * shortlist — and the sentence is a carrier the engine parses
 * (`graph._MATCH_NAME_CUE` → `_rehydrate_stored_match`), not copy. Two
 * wordings would be two parses to keep in step, failing silently as "the
 * engine asked for both birth dates again".
 */
export function askTurn(detail: MatchDetail): string {
  return askAboutMatchTurn(detail.display_name);
}

/**
 * The report, unchanged, for the shared renderer.
 *
 * Stated as a function so the screen has one place to get it and no
 * opportunity to build a payload of its own — the compatibility with
 * `parseMatchReport` IS the test (ASTRAL-232), and a screen that assembled
 * its own object would break it silently.
 */
export function report(detail: MatchDetail): MatchReportPayload | null {
  return detail.report ?? null;
}
