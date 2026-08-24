// The Profile screen's view model (docs/49 ASTRAL-136/137/138).
//
// PURE: no React, no react-native, no expo — so the root jest project can run
// it, which is where every rule below is actually enforced. The screen renders
// what these functions return and decides nothing.
//
// ── the one rule that shapes the whole file ────────────────────────────────
//
// RENDER WHAT ARRIVES. `services/people/chart.py` REMOVES the fields the
// chart's `undetermined` register hides — it does not null them — so a
// time-less chart simply has no `lagna` key. That is what makes ASTRAL-137's
// "no `—` in the lagna row, no greyed-out lagna" a property of the data
// rather than a rule a screen has to keep remembering. Nothing here holds a
// list of fields to hide, and nothing here decides that a birth time is
// required.
//
// ── and the one that shapes the chart card ─────────────────────────────────
//
// Nothing is DERIVED here (ASTRAL-19). No degree is rounded, no rashi is
// worked out from a longitude, no dasha is recomputed from a date. The
// artifact was stamped when it was cast and these functions format it.

import { formatIsoDate, splitIsoInstant, titleCase } from '@wealthai/astral';

import type { ChartSummary, EditImpact, Fact, PersonView, Undetermined } from './people-shapes';

// ── birth facts, with where each one came from ─────────────────────────────

/** The three the store calls editable birth facts (`service.py:_FIELD_LABELS`),
 *  in the order a person says them. `birth_time_confidence` is deliberately
 *  not here: it is a qualifier on the time, not a fact a user states. */
export const FACT_ORDER = ['date_of_birth', 'time_of_birth', 'place_of_birth'] as const;
export type FactKey = (typeof FACT_ORDER)[number];

const FACT_LABELS: Record<FactKey, string> = {
  date_of_birth: 'Date of birth',
  time_of_birth: 'Time of birth',
  place_of_birth: 'Place of birth',
};

/**
 * ASTRAL-35's closed vocabulary, said gently.
 *
 * "She told me" and "the page said" must not look alike, and a value seeded
 * from a saved profile must never read as one the user just stated. The
 * sentences are short because this is a caption under a fact, not a
 * disclosure — the loud one is the edit disclosure below.
 *
 * An unknown provenance falls to the unattributed sentence rather than to
 * "you told us": "I do not know where this came from" and "the user said it"
 * are different statements and only one of them is safe to show.
 */
const PROVENANCE_PHRASE: Record<string, string> = {
  stated_by_user: 'from your chat',
  seeded_from_memory: 'from your saved profile',
  geocoded: 'worked out from your birth place',
  parsed_from_page: 'read from a profile page',
  parsed_from_biodata: 'read from a biodata you shared',
  unattributed_legacy: 'recorded before we kept track of where facts came from',
};

export function provenancePhrase(fact: Fact): string {
  const phrase = PROVENANCE_PHRASE[String(fact.provenance)] ?? PROVENANCE_PHRASE.unattributed_legacy;
  const when = splitIsoInstant(fact.recorded_at);
  return when ? `${phrase}, ${when.date}` : phrase;
}

/** A birth fact as it reads. Date-shaped values are formatted the way every
 *  other date in this product is; everything else is shown verbatim, because
 *  a place the user typed is theirs to recognise. */
export function factText(key: string, fact: Fact): string {
  const raw = fact.value;
  if (typeof raw !== 'string') return String(raw ?? '');
  if (key === 'date_of_birth') return formatIsoDate(raw) ?? raw;
  return raw;
}

export interface FactRow {
  key: string;
  label: string;
  value: string;
  provenance: string;
  /** whether tapping the row may open the correction flow (see below) */
  editable: boolean;
  /** why not, when it is not — stated, never a dead greyed control */
  notEditableBecause?: string;
}

/**
 * §0d F45 — the contested-place ask NEVER FIRES in production.
 *
 * `_google_lookup` takes `results[0]` and discards the rest without a log
 * line, so a corrected city can land on the wrong coordinates with no ask
 * shown. ASTRAL-138 says its place-edit clause "does not open until F45 is
 * closed", and F45 is open (it is filed as needing a row, unfixed). A
 * settings screen is the worst place in the product for a silent
 * wrong-coordinate answer — every date in every reading moves with the
 * timezone — so the place row carries no edit control and SAYS why rather
 * than offering one that quietly guesses.
 */
export const PLACE_EDIT_BLOCKED =
  'Correcting a birth place needs the "which of these places do you mean?" ' +
  'step, which is not working yet. Ask in chat and I will confirm the place ' +
  'with you before anything is recomputed.';

export function factRows(person: PersonView): FactRow[] {
  const rows: FactRow[] = [];
  for (const key of FACT_ORDER) {
    const fact = person.birth_facts?.[key];
    if (!fact) continue;
    rows.push({
      key,
      label: FACT_LABELS[key],
      value: factText(key, fact),
      provenance: provenancePhrase(fact),
      editable: key !== 'place_of_birth',
      notEditableBecause: key === 'place_of_birth' ? PLACE_EDIT_BLOCKED : undefined,
    });
  }
  return rows;
}

// ── the birth time that is not known ───────────────────────────────────────

/**
 * ASTRAL-137. Three states, and "vanish" is not one of them:
 *
 *   `offer`      — say the time is not known and offer the upgrade path
 *   `state_only` — say it, having already offered once
 *   `none`       — the time is known
 *
 * The ask is offered EXACTLY ONCE (the row's negative space: "no second
 * ask"), but the STATEMENT stays: a screen that stops saying the birth time
 * is unknown is a screen whose missing lagna has no explanation on it.
 */
export type TimeAskState = 'offer' | 'state_only' | 'none';

export function timeAskState(person: { tob_known: boolean }, alreadyOffered: boolean): TimeAskState {
  if (person.tob_known) return 'none';
  return alreadyOffered ? 'state_only' : 'offer';
}

/**
 * The ask is spent when it is SHOWN, not when it is tapped.
 *
 * ASTRAL-137's obligation is "the ask renders once and not on re-open" — a
 * button that waits to be pressed before it counts is a button that renders
 * on every open, which is the second ask the row forbids. What survives the
 * first showing is the STATEMENT, which is not an ask: it is the explanation
 * for the rows that are absent, and the chat can still take a birth time at
 * any time.
 */
export function shouldRecordOffer(state: TimeAskState): boolean {
  return state === 'offer';
}

export const TIME_UNKNOWN_STATEMENT =
  'Your birth time is not known, so this chart is what can be read without it.';

/** ASTRAL-11's upgrade path, in the words the engine uses for the same ask. */
export const TIME_UNKNOWN_OFFER = 'Add your birth time';

// ── the chart card ─────────────────────────────────────────────────────────

export interface ChartLine {
  key: string;
  label: string;
  value: string;
}

const LINE_LABELS: [key: keyof ChartSummary, label: string][] = [
  ['lagna', 'Lagna'],
  ['moon_rashi', 'Moon rashi'],
  ['sun_rashi', 'Sun rashi'],
  ['nakshatra', 'Nakshatra'],
];

/**
 * The chart summary's lines, in reading order, ABSENT ONES SIMPLY ABSENT.
 *
 * The register decided what is here; this function does not consult it and
 * must not — two places deciding what a time-less chart shows is two places
 * to drift, and the server's is the one that owns the rule.
 */
export function chartLines(chart: ChartSummary | undefined): ChartLine[] {
  if (!chart) return [];
  const lines: ChartLine[] = [];
  for (const [key, label] of LINE_LABELS) {
    const value = chart[key];
    if (typeof value !== 'string' || !value.trim()) continue;
    // The pada belongs to the nakshatra it is a quarter of, so it rides that
    // line when it survived and is silently absent when it did not.
    const pada = key === 'nakshatra' && typeof chart.nakshatra_pada === 'number'
      ? ` · pada ${chart.nakshatra_pada}`
      : '';
    lines.push({ key: String(key), label, value: `${value}${pada}` });
  }
  const lagnaLine = lines.find((l) => l.key === 'lagna');
  if (lagnaLine && typeof chart.lagna_degree === 'number') {
    // Degrees as the artifact carries them — no rounding, ASTRAL-19.
    lagnaLine.value = `${chart.lagna} ${chart.lagna_degree}°`;
  }
  const md = chart.mahadasha?.planet;
  if (md) {
    const ad = chart.antardasha?.planet;
    lines.push({
      key: 'dasha',
      label: 'Current period',
      value: ad ? `${md} — ${ad}` : String(md),
    });
  }
  return lines;
}

/**
 * ASTRAL-118 / ASTRAL-5: the frame is NAMED on screen.
 *
 * A sidereal value and a tropical one are the same sentence three signs
 * apart, so a chart that cannot say which frame it was cast in is not
 * rendered as a chart at all (that is the `unstamped` state below). When it
 * can, it says so here.
 */
/**
 * The house-system CODES the artifact actually carries.
 *
 * MEASURED, simulator, 2026-08-24: `house_system` on a stored chart is `"W"`
 * — the Swiss Ephemeris single-letter code, not a name. ASTRAL-118 requires
 * the frame to be NAMED on screen, and "W" names nothing to the person
 * reading it.
 *
 * This map is a LABEL for a code, not a derivation: it changes no value and
 * decides nothing about the chart. A code this map does not know is printed
 * AS IT IS rather than guessed at — an unknown frame stated opaquely is
 * honest; an invented one is the failure ASTRAL-118 exists to prevent. The
 * right long-term home for this is the artifact itself, which is a finding
 * for the engine rather than something a screen should be doing.
 */
const HOUSE_SYSTEM_NAMES: Record<string, string> = {
  W: 'Whole Sign',
  P: 'Placidus',
  K: 'Koch',
  E: 'Equal',
  O: 'Porphyry',
  R: 'Regiomontanus',
  C: 'Campanus',
};

/** `LAHIRI` → `Lahiri`. Shouted stamp values are a storage convention, not a
 *  thing to shout at a reader; two-letter tokens are left alone because they
 *  are far more likely to be initialisms than words. */
function readable(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  const named = HOUSE_SYSTEM_NAMES[raw];
  if (named) return named;
  if (raw.length > 2 && raw === raw.toUpperCase()) return titleCase(raw.toLowerCase());
  return titleCase(raw);
}

export function frameLine(chart: ChartSummary | undefined): string | null {
  if (!chart) return null;
  const parts = [chart.zodiac_mode, chart.ayanamsa, chart.house_system]
    .map((p) => readable(p))
    .filter((p): p is string => !!p);
  return parts.length === 3 ? parts.join(' · ') : null;
}

export interface ChartState {
  /** what the screen draws: the chart lines, or an honest state instead */
  kind: 'fresh' | 'aged' | 'unreadable' | 'absent';
  /** the engine's own status string, carried through for tests and traces */
  status: string;
  /** one sentence, always present */
  sentence: string;
  /** the date it was cast, when there is one — a stale chart is shown WITH it */
  computedAt: string | null;
}

const CAST_UNKNOWN = 'at a date this chart did not record';

function castOn(chart: ChartSummary): { text: string; iso: string | null } {
  const when = splitIsoInstant(chart.computed_at);
  return when ? { text: `on ${when.date}`, iso: chart.computed_at ?? null }
              : { text: CAST_UNKNOWN, iso: null };
}

/**
 * What the card says about itself.
 *
 * AMB-31, interim (a): a stale chart is SHOWN, stale, with the date it was
 * cast — never silently recomputed, and never hidden. There is no recompute
 * control here because there is no recompute endpoint: an affordance that
 * cannot do anything is the dead control ASTRAL-102 forbids. The nightly
 * wave of AMB-31(c) is what will clear it.
 */
export function chartState(chart: ChartSummary | undefined): ChartState {
  if (!chart || chart.status === 'absent') {
    return {
      kind: 'absent',
      status: chart?.status ?? 'absent',
      sentence: chart?.reason ?? 'No chart has been cast for you yet.',
      computedAt: null,
    };
  }
  const cast = castOn(chart);
  switch (chart.status) {
    case 'fresh':
      return { kind: 'fresh', status: chart.status, sentence: `Cast ${cast.text}.`, computedAt: cast.iso };
    case 'stale':
      return {
        kind: 'aged',
        status: chart.status,
        sentence:
          `Cast ${cast.text}, before a birth detail changed. It is shown as it ` +
          'was cast — opening this screen does not recompute it.',
        computedAt: cast.iso,
      };
    case 'corrected_stale':
      return {
        kind: 'aged',
        status: chart.status,
        sentence:
          `Cast ${cast.text}, before you corrected a birth detail. It is shown ` +
          'as it was cast — opening this screen does not recompute it.',
        computedAt: cast.iso,
      };
    case 'unprovable':
      return {
        kind: 'aged',
        status: chart.status,
        sentence:
          `Cast ${cast.text}, without a record of which details it was cast ` +
          'from — so it cannot be checked against the details above.',
        computedAt: cast.iso,
      };
    case 'unstamped':
      // ASTRAL-6/118's honest chart-error state. The values are NOT drawn:
      // under a sidereal product a tropical value is a whole reading wrong.
      return {
        kind: 'unreadable',
        status: chart.status,
        sentence: chart.reason
          ?? 'This chart does not record the frame it was cast in, so its values cannot be shown.',
        computedAt: cast.iso,
      };
    default:
      return {
        kind: 'unreadable',
        status: String(chart.status),
        sentence: `This chart is in a state this app does not know how to read (${chart.status}).`,
        computedAt: cast.iso,
      };
  }
}

/** Whether the chart's own values may be drawn at all. */
export function chartIsReadable(state: ChartState): boolean {
  return state.kind === 'fresh' || state.kind === 'aged';
}

// ── the undetermined register, rendered as the designed honest states ──────

export interface UndeterminedNote {
  field: string;
  title: string;
  reason: string;
  /** "it is one of these two" — shown, because narrowing is information */
  alternatives: string[];
}

/**
 * A title for a register entry.
 *
 * The known keys get the words the rest of the product uses; an UNKNOWN key
 * is humanised rather than dropped — the register is allowed to grow a class
 * this build has never heard of (a divisional chart, say), and a screen that
 * silently skipped it would hide exactly the thing the register exists to
 * disclose.
 */
const REGISTER_TITLES: Record<string, string> = {
  lagna: 'Lagna',
  houses: 'The twelve bhavas',
  nakshatra_pada: 'Nakshatra pada',
  dasha: 'Dasha periods',
  moon_rashi: 'Moon rashi',
  moon_nakshatra: 'Moon nakshatra',
};

export function registerTitle(field: string): string {
  const known = REGISTER_TITLES[field];
  if (known) return known;
  return titleCase(String(field).replace(/_/g, ' ')) ?? field;
}

export function undeterminedNotes(chart: ChartSummary | undefined): UndeterminedNote[] {
  const register: Undetermined[] = chart?.undetermined ?? [];
  return register.map((entry) => ({
    field: String(entry.field),
    title: registerTitle(String(entry.field)),
    // VERBATIM. The engine wrote the reason and it is the one that is true.
    reason: String(entry.reason ?? ''),
    alternatives: Array.isArray(entry.alternatives) ? entry.alternatives.map(String) : [],
  }));
}

// ── ASTRAL-138: what an edit would invalidate, said before it happens ──────

/**
 * The disclosure sentence, COMPUTED from the affected set the server derived
 * from the derived-data contract's own edges — never a hard-coded sentence.
 * Add a dependent artifact to the fixture and this sentence changes, which is
 * the row's unit obligation stated as a property of this function.
 */
export function editDisclosure(impact: EditImpact): string {
  const charts = impact.affected.filter((a) => a.kind === 'chart').length;
  const matches = impact.affected.filter((a) => a.kind === 'match').length;
  const others = impact.affected.filter((a) => a.kind !== 'chart' && a.kind !== 'match');
  const parts: string[] = [];
  if (charts) parts.push(charts === 1 ? 'your chart' : `${charts} charts`);
  if (matches) parts.push(matches === 1 ? '1 saved match' : `${matches} saved matches`);
  for (const other of others) parts.push(String(other.kind));
  if (impact.recomputes_coordinates) parts.push('the coordinates it was cast from');
  if (!parts.length) {
    return `Changing your ${impact.label} recomputes nothing — there is nothing derived from it yet.`;
  }
  return `Changing your ${impact.label} recomputes ${joinParts(parts)}.`;
}

function joinParts(parts: string[]): string {
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * The turn that opens the correction.
 *
 * A SENTENCE OF INTENT and nothing else — no value, no slot key, no field
 * name in the engine's vocabulary. The engine decides what it needs and asks
 * for it with an `input_request`; the answer returns on the `input_response`
 * carrier into `reconcile`, which is the only fact-writer (INV-1). There is
 * no profile-write endpoint and this app has no way to reach one.
 */
export function correctionTurn(label: string): string {
  return `I need to correct my ${label}.`;
}
