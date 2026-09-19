/**
 * The common questions, as chips (docs/73 ASTRAL-336) — pure.
 *
 * ── the rule that makes four of them free ─────────────────────────────────
 *
 * The deterministic scorecard is ALREADY ON SCREEN. Four of the six chips are
 * questions the engine has already answered inside that payload, so answering
 * them costs nothing: no message, no stream, no model call, no cent. The
 * other two are real questions and take an ordinary turn on the same chat,
 * through compose → ground, bound by ASTRAL-320's refusal table like every
 * other synastry sentence.
 *
 * `chips.test.tsx` counts the requests rather than trusting this paragraph.
 *
 * ── and the rule that keeps them honest ───────────────────────────────────
 *
 * EVERY WORD OF AN INSTANT ANSWER IS THE ENGINE'S. `detail`, `meaning`,
 * `note`, `pending_reasons` and the engine's own `verdict` travel verbatim;
 * the only numbers rendered are `formatFraction(points, max)`, which is the
 * package's concatenation of two payload values and never a quotient. This
 * client computes no score, no band, no percentage and no total — INV-9, and
 * the no-derivation grep is what holds it.
 *
 * ── "highest- and lowest-scoring", read carefully ─────────────────────────
 *
 * The row's words are "the highest- and lowest-scoring kootas". Taken
 * literally — most points — the answer is always Nadi (max 8) and never
 * Varna (max 1), which is a scale confusion rather than a reading: the
 * kootas are worth different maxima, so "scored well" means "lost little",
 * not "scored a big number". So the ordering key is POINTS DROPPED, a
 * subtraction of two numbers on one koota's own scale. It is never rendered
 * and never leaves this module — it orders rows the engine wrote. Filed as
 * F300.
 */

import { formatFraction } from '@wealthai/astral';
import type { MatchKoota, MatchReportPayload } from '@wealthai/astral';

export type ChipId =
  | 'dosha'
  | 'strongest'
  | 'friction'
  | 'ask-before'
  | 'birth-time'
  | 'outlook';

export interface Chip {
  id: ChipId;
  label: string;
}

/** The six, in the row's order. */
export const CHIPS: readonly Chip[] = [
  { id: 'dosha', label: 'Dosha check' },
  { id: 'strongest', label: "Where you're strongest" },
  { id: 'friction', label: 'Where the friction is' },
  { id: 'ask-before', label: 'What to ask before you decide' },
  { id: 'birth-time', label: 'What a birth time would unlock' },
  { id: 'outlook', label: 'Long-term outlook' },
];

/**
 * What tapping a chip does.
 *
 * `absent` is a real answer and it REMOVES the chip (doctrine 8): "what would
 * a birth time unlock" has no subject when nothing is pending, and a chip
 * that answers "nothing, actually" is a control that should not have been
 * there. It is never rendered greyed.
 */
export type ChipPlan =
  /** answered from the payload on screen — zero requests */
  | { kind: 'instant'; markdown: string }
  /** one ordinary turn on the same chat */
  | { kind: 'ask'; question: string }
  | { kind: 'absent'; reason: string };

/** The label the panel puts on the chip itself, so "instant" is never a lie. */
export function chipCost(plan: ChipPlan): 'instant' | 'asks' | 'absent' {
  return plan.kind === 'instant' ? 'instant' : plan.kind === 'ask' ? 'asks' : 'absent';
}

/** Points dropped. Ordering only — never rendered. See the header. */
function dropped(k: MatchKoota): number {
  return k.max - (k.points ?? 0);
}

function scored(report: MatchReportPayload): MatchKoota[] {
  return report.kootas.filter((k) => !k.pending && k.points !== null);
}

/** One koota, as the engine wrote it. */
function kootaLine(k: MatchKoota): string {
  const fraction = formatFraction(k.points, k.max);
  const head = fraction ? `**${k.name}** ${fraction}` : `**${k.name}**`;
  const tail = [k.meaning, k.note].filter((s) => s && s.trim()).join(' — ');
  return tail ? `- ${head} — ${tail}` : `- ${head}`;
}

/**
 * The ordering, SAID (F300).
 *
 * The two ordering chips put the engine's rows in an order this client
 * chose, and an order is a claim. Printing the rule turns "here are your
 * strongest kootas" — which reads as a conclusion — into "here are the ones
 * that lost the fewest of their own points", which is a statement about the
 * numbers on screen and checkable against them.
 *
 * "OF THEIR OWN POINTS" is the load-bearing phrase: the kootas are worth
 * different maxima, so "the highest score" would be Nadi every time it
 * scored at all, and "the lowest" would be Varna. The order is by points
 * dropped on each koota's own scale.
 */
export const STRONGEST_RULE =
  '_Ordered by the kootas that lost the fewest of their own points._';

export const FRICTION_RULE =
  '_Ordered by the kootas that lost the most of their own points._';

const PROVISIONAL_NOTE =
  '_Marked provisional by the engine: without a birth time the Moon may sit ' +
  'in the neighbouring rashi._';

function doshaPlan(report: MatchReportPayload): ChipPlan {
  const lines: string[] = [];
  for (const d of report.doshas) {
    lines.push(`- **${d.name}** — ${d.detail}`);
    if (d.provisional) lines.push(`  ${PROVISIONAL_NOTE}`);
  }
  const pending = report.pending_reasons.filter((r) => r.trim());
  if (!lines.length && !pending.length) {
    // The engine flagged no dosha AND named nothing it could not check. That
    // is an ABSENCE, and this client will not turn an absence into "no dosha
    // was found" — the kinds of absence are not interchangeable (doctrine 6).
    // So it becomes a question the engine answers in its own words.
    return {
      kind: 'ask',
      // The question NAMES NO KOOTA. ASTRAL-18's structural test caught the
      // first draft, which listed three dosha names: a client that
      // enumerates them is a second, silent copy of the engine's table, and
      // it goes stale the day the engine's changes. The engine knows which
      // ones it checks.
      question:
        'Were any doshas found in this match, and what did the kootas show ' +
        'about each of them?',
    };
  }
  const out: string[] = [];
  if (lines.length) out.push(...lines);
  if (pending.length) {
    out.push('', '**Not everything could be checked:**');
    out.push(...pending.map((r) => `- ${r}`));
  }
  return { kind: 'instant', markdown: out.join('\n') };
}

function strongestPlan(report: MatchReportPayload): ChipPlan {
  const list = scored(report);
  if (!list.length) {
    return {
      kind: 'absent',
      reason: 'No koota was scored on this reading, so there is nothing to read back.',
    };
  }
  const ordered = [...list].sort((a, b) => dropped(a) - dropped(b));
  const best = dropped(ordered[0]);
  const top = ordered.filter((k) => dropped(k) === best).slice(0, 3);
  return {
    kind: 'instant',
    markdown: [STRONGEST_RULE, '', ...top.map(kootaLine)].join('\n'),
  };
}

function frictionPlan(report: MatchReportPayload): ChipPlan {
  const list = scored(report).filter((k) => dropped(k) > 0);
  if (!list.length) {
    // Every scored koota took full marks. There is no friction row to read
    // back, and inventing one is exactly what this module must not do — so
    // the engine is asked instead of the client answering for it.
    return {
      kind: 'ask',
      question:
        'Every koota that could be scored scored full marks — so where should ' +
        'we still be careful in this match, and why?',
    };
  }
  const ordered = [...list].sort((a, b) => dropped(b) - dropped(a));
  const worst = dropped(ordered[0]);
  const bottom = ordered.filter((k) => dropped(k) === worst).slice(0, 3);
  return { kind: 'instant', markdown: [FRICTION_RULE, '', ...bottom.map(kootaLine)].join('\n') };
}

function birthTimePlan(report: MatchReportPayload): ChipPlan {
  const pending = report.kootas.filter((k) => k.pending);
  const reasons = report.pending_reasons.filter((r) => r.trim());
  if (!pending.length && !reasons.length) {
    return {
      kind: 'absent',
      reason: 'Both birth times are on file, so nothing here is waiting on one.',
    };
  }
  const out: string[] = [];
  if (pending.length) {
    out.push(
      `**${pending.length} koota${pending.length === 1 ? '' : 's'}, worth ` +
        `${report.pending_max} point${report.pending_max === 1 ? '' : 's'}, ` +
        'are waiting on a birth time:**',
    );
    out.push(
      ...pending.map((k) => {
        const tail = [k.meaning, k.note].filter((s) => s && s.trim()).join(' — ');
        return tail ? `- **${k.name}** — ${tail}` : `- **${k.name}**`;
      }),
    );
  }
  if (reasons.length) {
    if (out.length) out.push('');
    out.push(...reasons.map((r) => `- ${r}`));
  }
  return { kind: 'instant', markdown: out.join('\n') };
}

const ASK_BEFORE_QUESTION =
  'What should we ask them, or find out, before deciding anything about this ' +
  'match — based on what the kootas actually showed?';

const OUTLOOK_QUESTION =
  'Looking at the kootas in this match, what supports it over the long term ' +
  'and what would need work?';

/**
 * The plan for one chip. Pure, total, and the only place a chip's behaviour
 * is decided.
 */
export function planFor(id: ChipId, report: MatchReportPayload): ChipPlan {
  switch (id) {
    case 'dosha':
      return doshaPlan(report);
    case 'strongest':
      return strongestPlan(report);
    case 'friction':
      return frictionPlan(report);
    case 'birth-time':
      return birthTimePlan(report);
    case 'ask-before':
      return { kind: 'ask', question: ASK_BEFORE_QUESTION };
    case 'outlook':
      return { kind: 'ask', question: OUTLOOK_QUESTION };
  }
}

export interface PlannedChip extends Chip {
  plan: ChipPlan;
}

/** The chips this reading actually offers, with their cost already decided. */
export function chipsFor(report: MatchReportPayload): PlannedChip[] {
  return CHIPS.map((chip) => ({ ...chip, plan: planFor(chip.id, report) })).filter(
    (chip) => chip.plan.kind !== 'absent',
  );
}
