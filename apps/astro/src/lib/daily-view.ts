// Home and Daily Guidance's view model (docs/49 ASTRAL-125/126).
//
// PURE: no React, no react-native, no expo — so the root jest project runs
// it, which is where the rules below are actually enforced. The two screens
// render what these functions return and decide nothing.
//
// ── the rules this file exists to hold ────────────────────────────────────
//
//  1. RENDER THE ARTIFACT, DERIVE NOTHING (ASTRAL-19/125). No sign is worked
//     out from a longitude, no dasha from a date, and — the one this screen
//     could most easily get wrong — no "today" is composed on the client.
//     `cardDate` formats the date the ARTIFACT carries. No device clock
//     is read anywhere in this file, and a test greps for one.
//
//  2. AN ABSENCE IS A SENTENCE (ASTRAL-125/126). Every non-ready state has
//     its own title, body and next step, because "you have not told us your
//     birth details" and "your chart needs recasting since you corrected it"
//     ask for different things. One apology for all of them is the shape
//     this whole read contract exists to avoid.
//
//  3. NO FEAR FRAMING (§11.2). Every sentence written HERE is ours and is
//     checked by a test. The engine's own rule descriptions are quoted
//     verbatim and are the engine's to fix.
//
//  4. THE TABS ARE A FILTER, NOT A FETCH (ASTRAL-126). `tabs()` reads the
//     facets already in the response. There is no fetch in this file and no
//     screen may add one on a tab press.

import { formatIsoDate } from '@wealthai/astral';

import type {
  AbsentLayer,
  DailyCard,
  DailyReady,
  DailyResponse,
  FacetItem,
  FacetTab,
} from './people-shapes';

export function isReady(res: DailyResponse | null): res is DailyReady {
  return !!res && res.state === 'ready';
}

/** "Hi, Ravi" — the People store's own `self` name (ASTRAL-125, AMB-21).
 *  A person with no name set is greeted, not left unaddressed: the board's
 *  line is a greeting, and "Hi there" is a greeting where "Hi, " is a bug. */
export function greeting(name?: string | null): string {
  const trimmed = (name ?? '').trim();
  return trimmed ? `Hi, ${trimmed}` : 'Hi there';
}

/**
 * Which name the greeting uses, and in which order.
 *
 * MEASURED, on-simulator against the local backend (2026-08-25): a `self`
 * established through the chat bridge has `display_name: ""`. Nothing
 * populates it — `record_facts` takes a `display_name` and the astrology
 * bridge never passes one for `self`, because the birth-details arc asks for
 * a date, a time and a place and never for a name. So ASTRAL-125's "Hi,
 * {name}" would read "Hi there" for every real user, which is not what the
 * row asks for and not what the board draws.
 *
 * The order below is by AUTHORITY, not by convenience:
 *   1. the People store's `self` — the row's own source, when it has one;
 *   2. the signed-in account's display name — the name the user gave this
 *      product, from Firebase Auth, and the only other name we hold;
 *   3. nothing, and the greeting says "Hi there" rather than "Hi, ".
 *
 * What this deliberately does NOT do is WRITE the account name into the
 * People store. That would be a second writer inventing a fact nobody
 * stated, and `display_name` is owner-authored (`PATCH /people/{id}`), not
 * derived. The fallback is a rendering decision and stays one; the fix
 * belongs upstream, where the arc could simply ask.
 */
export function greetingName(
  storeName?: string | null,
  accountName?: string | null,
): string | null {
  const fromStore = (storeName ?? '').trim();
  if (fromStore) return fromStore;
  const fromAccount = (accountName ?? '').trim();
  // A display name that is an email address is not a name — greeting
  // somebody as "Hi, ravi@example.com" is worse than not naming them.
  if (fromAccount && !fromAccount.includes('@')) return fromAccount;
  return null;
}

/** The ARTIFACT's own date, spelled out. Never the device's clock. */
export function cardDate(card: Pick<DailyCard, 'date'>): string {
  return formatIsoDate(card.date) ?? card.date;
}

// ── the card's deterministic lines ────────────────────────────────────────

export interface Line {
  id: string;
  label: string;
  value: string;
}

/**
 * "Today's Transit" — the board's headline block, from the card.
 *
 * The slow movers first and then whatever else the card pinned to a house:
 * Saturn and Jupiter are what a Vedic reader looks for, and a list that
 * opened with Mercury would bury them. Ordering only — nothing is dropped,
 * and nothing is scored.
 */
const SLOW_FIRST = ['Saturn', 'Jupiter', 'Rahu', 'Ketu', 'Sun', 'Moon',
  'Mars', 'Mercury', 'Venus'];

export function transitLines(card: DailyCard): Line[] {
  const planets = card.transit?.planets ?? {};
  const names = Object.keys(planets).sort(
    (a, b) => (SLOW_FIRST.indexOf(a) + 1 || 99) - (SLOW_FIRST.indexOf(b) + 1 || 99),
  );
  return names.map((name) => {
    const p = planets[name] ?? {};
    const house = p.house_from_lagna;
    return {
      id: `transit-${name}`,
      label: name,
      value:
        `${p.sign ?? ''}${p.retrograde ? ' (retrograde)' : ''}` +
        (house ? ` · house ${house}` : ''),
    };
  });
}

/** The active classical rules, in the ENGINE's own words. Quoted, never
 *  paraphrased: a screen that reworded a rule would be writing astrology. */
export function ruleLines(card: DailyCard): Line[] {
  const rules = card.transit?.rules ?? {};
  return Object.entries(rules)
    .filter(([, block]) => block && (block.active || block.favourable))
    .map(([name, block]) => ({
      id: `rule-${name}`,
      label: titleFromKey(name),
      value: String((block as { description?: string }).description ?? ''),
    }))
    .filter((line) => !!line.value);
}

/**
 * The mahadasha AND the antardasha (ASTRAL-125 / F33).
 *
 * Both, always, when both are on the card: a mahadasha alone lasts up to
 * twenty years and is not news — the antardasha is what makes a daily card
 * daily. A card carrying only the MD renders only the MD, and the reason
 * the AD is missing is already in `absences()`.
 */
export function dashaLines(card: DailyCard): Line[] {
  const out: Line[] = [];
  const md = card.dasha?.mahadasha;
  const ad = card.dasha?.antardasha;
  if (md?.planet) {
    out.push({
      id: 'mahadasha',
      label: 'Mahadasha',
      value: `${md.planet} · ${span(md.start_date, md.end_date)}`,
    });
  }
  if (ad?.planet) {
    out.push({
      id: 'antardasha',
      label: 'Antardasha',
      value: `${ad.planet} · ${span(ad.start_date, ad.end_date)}`,
    });
  }
  return out;
}

/**
 * The panchang, WITH the place it is for (ASTRAL-126 / F31).
 *
 * The place is not decoration and is not optional: a tithi is a fact about a
 * place, and one presented without its city is one the reader has to guess
 * at. A panchang whose place the response does not name is not rendered at
 * all — its absence is already stated in `absences()`.
 */
export function panchangLine(card: DailyCard): { value: string; place: string } | null {
  const p = card.panchang;
  if (!p) return null;
  const place = p.panchang_place?.name?.trim();
  if (!place) return null;
  const parts = [p.tithi, p.vara, p.nakshatra].filter(Boolean);
  if (!parts.length) return null;
  return { value: parts.join(' · '), place };
}

/** What the card could NOT compute, and why — every entry, in the engine's
 *  words. *Nothing was computed* must not read as *nothing happened*. */
export function absences(card: DailyCard): AbsentLayer[] {
  return card.absent_layers ?? [];
}

/** What is WITHHELD because it has more than one possible reading, with the
 *  alternatives and the fact that would settle it (ASTRAL-71/80). */
export function withheld(card: DailyCard) {
  return (card.undetermined ?? []).map((u) => ({
    id: `withheld-${u.field}`,
    field: titleFromKey(u.field),
    reason: u.reason,
    alternatives: u.alternatives ?? [],
    unlockedBy: u.unlocked_by,
  }));
}

// ── screen 8's tabs ───────────────────────────────────────────────────────

/** The four tabs, as the response computed them. A filter over ONE artifact
 *  — this function fetches nothing and computes no membership. */
export function tabs(res: DailyReady): FacetTab[] {
  return res.facets?.tabs ?? [];
}

export function tabById(res: DailyReady, id: string): FacetTab | null {
  return tabs(res).find((t) => t.id === id) ?? null;
}

/** A faceted item's date range, formatted — or null when it has none. The
 *  engine sends the dates as fields precisely so this happens here. */
export function itemRange(item: Pick<FacetItem, 'start_date' | 'end_date'>): string | null {
  if (!item.start_date && !item.end_date) return null;
  return span(item.start_date, item.end_date) || null;
}

/** Whether an item has a filing basis to show at all.
 *
 *  The engine's basis names WHY an item is on the lens being read — the
 *  adjudicator's domains — and is EMPTY for an item no domain claims. That
 *  emptiness is a real answer (the item is on Guidance because Guidance is
 *  the whole day) and is rendered as nothing rather than as a sentence. */
export function basisAddsAnything(item: Pick<FacetItem, 'basis' | 'detail'>): boolean {
  return !!(item.basis ?? '').trim();
}

// ── the honest states ─────────────────────────────────────────────────────

export interface AbsentView {
  title: string;
  body: string;
  /** the label of the one control offered, or null when there is nothing
   *  honest to offer */
  action: string | null;
  /** the SENTENCE the action sends into chat. Never a value — no route
   *  param of this app carries anything a fact could be rebuilt from (F24) */
  turn: string | null;
  /**
   * Where the action goes, and it is decided by WHAT IS MISSING.
   *
   * `details` — the birth-details arc, because the facts genuinely are not
   * on file and something has to ask for them.
   *
   * `reading` — straight to chat. The facts ARE on file and only the chart
   * is old, so asking for them again is asking a user to retype what they
   * just told us. That was the whole of "it keeps asking me to regenerate
   * the chart": the control opened a correction arc, the engine asked for
   * the date, the time and the place, and the state it was supposed to end
   * came straight back.
   */
  destination: 'details' | 'reading';
}

const ESTABLISH_TURN = "I'd like my birth chart.";
// Deliberately NOT "with my corrected details": that sentence reads as an
// offer to supply new ones, and the engine answered it by asking for the
// date, the time and the place — which the store already holds. This one
// says the opposite, and it is the difference between one tap and a form.
const RECAST_TURN =
  'Please update my chart using the birth details you already have on file.';

/**
 * What a screen shows when there is no card, per state.
 *
 * The recast action is a CHAT turn and not a button that calls an endpoint,
 * because no such endpoint exists and there must not be one on a read
 * API (F24/INV-1): the chart is recast by the turn that needs it, through
 * `reconcile`. A "Refresh" button here would either write around the only
 * fact-writer or do nothing at all, and both are worse than a sentence.
 */
export function absentView(res: Exclude<DailyResponse, DailyReady>): AbsentView {
  switch (res.state) {
    case 'not_established':
      return {
        title: 'Your details first',
        body: 'Tell us your birth date, time and place and today’s reading follows from your own chart.',
        action: 'Add my birth details',
        turn: ESTABLISH_TURN,
        destination: 'details',
      };
    case 'chart_absent':
      return {
        title: 'Your chart is not cast yet',
        body: 'We have your details but no chart to read today against. It takes one message.',
        action: 'Cast my chart',
        turn: ESTABLISH_TURN,
        // `chart_absent` means the PERSON exists and only the chart does
        // not — the store cannot hold a person without birth facts. So the
        // details are on file and the form has nothing to ask for; asking
        // for a reading casts the chart (and re-derives coordinates) on its
        // own. Only `not_established` — no person at all — needs the form.
        destination: 'reading',
      };
    case 'chart_stale':
      return {
        title: 'Your chart needs recasting',
        body: recastBody(res.chart?.computed_at),
        action: 'Update my chart',
        turn: RECAST_TURN,
        // The facts are on file. Nothing needs to be asked for.
        destination: 'reading',
      };
    case 'chart_unstamped':
    case 'chart_unprovable':
      return {
        title: 'This chart cannot be used',
        body: res.reason || 'We cannot show values from a chart we cannot verify.',
        action: 'Update my chart',
        turn: RECAST_TURN,
        destination: 'reading',
      };
    case 'refused':
    default:
      return {
        title: 'Today’s reading is not ready',
        body: 'Today’s card did not agree with your chart, so we are not showing it. Nothing is wrong with your details.',
        action: null,
        turn: null,
        destination: 'reading',
      };
  }
}

/** AMB-31 interim (a): the staleness is stated WITH the date the chart was
 *  cast. "Stale" alone is not actionable; "cast on 3 March, before you
 *  corrected your birth time" is. */
function recastBody(computedAt?: string | null): string {
  const when = formatIsoDate((computedAt ?? '').slice(0, 10));
  // One tap, and it says so. The old sentence explained the problem and left
  // the reader to guess whether they were about to be asked for their
  // details all over again — which, before this, they were.
  const tail =
    ' Your details are already on file — one tap updates the chart, and Home, Insights and Timeline all follow.';
  return (when
    ? `Your birth details changed after this chart was cast on ${when}, so every reading here would still be built on the old one.`
    : 'Your birth details changed after this chart was cast, so every reading here would still be built on the old one.') + tail;
}

// ── small helpers ─────────────────────────────────────────────────────────

function span(start?: string, end?: string): string {
  const a = formatIsoDate(start) ?? start ?? '';
  const b = formatIsoDate(end) ?? end ?? '';
  return a && b ? `${a} → ${b}` : a || b;
}

export function titleFromKey(key: string): string {
  return key
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}
