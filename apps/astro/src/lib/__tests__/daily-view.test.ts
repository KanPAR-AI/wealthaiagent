/**
 * docs/49 ASTRAL-125/126 — Home and Daily Guidance render ONE artifact.
 *
 * The fixtures are REAL: `fixtures/daily*.json` were captured from
 * `services/people/artifacts.py:self_daily` running over a chart
 * `compute_natal_chart` actually cast. A hand-written fixture proves the
 * client parses what somebody imagined the server sends; these prove it
 * parses what it does send — including the field names, which is where the
 * last three shape bugs in this workspace lived.
 */

import fs from 'fs';
import path from 'path';

import {
  absences,
  absentView,
  cardDate,
  dashaLines,
  basisAddsAnything,
  greeting,
  greetingName,
  isReady,
  itemRange,
  panchangLine,
  ruleLines,
  tabById,
  tabs,
  transitLines,
  withheld,
} from '../daily-view';
import type { DailyReady, DailyResponse } from '../people-shapes';

/**
 * A module's CODE, with comments removed.
 *
 * The source greps below are about what the file DOES, and a comment that
 * names the thing being forbidden ("there is no recompute endpoint", "a
 * `new Date()` here would…") is the file explaining itself, not doing it.
 * Grepping raw source made those two sentences unwritable, which is a test
 * shaping prose rather than behaviour. Stripping comments first also makes
 * the grep stricter in the direction that matters: a real call cannot hide
 * inside a comment either.
 */
const codeOf = (file: string) =>
  fs
    .readFileSync(path.join(__dirname, '..', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const load = (name: string) =>
  JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures', `${name}.json`), 'utf8'),
  ) as DailyResponse;

const READY = load('daily') as DailyReady;
const TIMELESS = load('daily_timeless') as DailyReady;

describe('the greeting (ASTRAL-125, AMB-21)', () => {
  it('names the person from the People store’s self', () => {
    expect(READY.person.display_name).toBe('Ravi');
    expect(greeting(READY.person.display_name)).toBe('Hi, Ravi');
  });

  it('falls back to the signed-in account’s name, and never to an email', () => {
    // MEASURED on-sim: a `self` established through the chat bridge has an
    // EMPTY display_name — nothing populates it, because the birth-details
    // arc asks for a date, a time and a place and never for a name. The
    // fallback is a rendering decision; nothing writes the account name
    // into the store.
    expect(greetingName('Ravi', 'Someone Else')).toBe('Ravi');
    expect(greetingName('', 'Ravi P')).toBe('Ravi P');
    expect(greetingName(null, 'ravi@example.com')).toBeNull();
    expect(greetingName('', '')).toBeNull();
    expect(greeting(greetingName('', 'Ravi P'))).toBe('Hi, Ravi P');
    expect(greeting(greetingName('', null))).toBe('Hi there');
  });

  it('greets an unnamed person rather than leaving a dangling comma', () => {
    expect(greeting('')).toBe('Hi there');
    expect(greeting(null)).toBe('Hi there');
    expect(greeting(undefined)).toBe('Hi there');
  });
});

describe('the card’s OWN date (ASTRAL-125 / ASTRAL-112)', () => {
  it('is read off the artifact, formatted', () => {
    expect(READY.card.date).toBe('2026-08-24');
    expect(cardDate(READY.card)).toBe('24 Aug 2026');
  });

  it('the response’s date and the artifact’s are the same value', () => {
    // A screen must never show a date the card is not about. The server
    // reads its `date` off the artifact; this asserts they cannot diverge
    // even if a screen picked the wrong one.
    expect(READY.date).toBe(READY.card.date);
  });

  it('nothing in this module reads a clock', () => {
    // The failure this forbids: composing "today" on the client, which is
    // ASTRAL-112/125's negative space. A `new Date()` here would make the
    // screen right on the tester's phone and wrong across a date line.
    const src = codeOf('daily-view.ts');
    expect(src).not.toMatch(/new Date\(/);
    expect(src).not.toMatch(/Date\.now\(/);
  });
});

describe('the card’s lines', () => {
  it('MD and AD are both rendered (F33)', () => {
    const lines = dashaLines(READY.card);
    expect(lines.map((l) => l.label)).toEqual(['Mahadasha', 'Antardasha']);
    expect(lines[0].value).toContain(READY.card.dasha!.mahadasha!.planet!);
    expect(lines[1].value).toContain(READY.card.dasha!.antardasha!.planet!);
    // …and both carry their dates, because a period without them is not a
    // period.
    expect(lines[0].value).toMatch(/→/);
    expect(lines[1].value).toMatch(/→/);
  });

  it('a mahadasha alone is not a daily card — the AD is on this fixture', () => {
    // The row's own reason, pinned: a mahadasha lasts up to twenty years.
    // If the engine ever stopped carrying the AD, this fails here rather
    // than being noticed as "the card feels static" months later.
    expect(READY.card.dasha?.antardasha?.planet).toBeTruthy();
  });

  it('every transit line comes from the card, with the house it is in', () => {
    const lines = transitLines(READY.card);
    const planets = READY.card.transit!.planets!;
    expect(lines).toHaveLength(Object.keys(planets).length);
    for (const line of lines) {
      const p = planets[line.label];
      expect(p).toBeDefined();
      expect(line.value).toContain(p.sign!);
      if (p.house_from_lagna) expect(line.value).toContain(`house ${p.house_from_lagna}`);
    }
  });

  it('the slow movers lead', () => {
    const labels = transitLines(READY.card).map((l) => l.label);
    expect(labels.slice(0, 2)).toEqual(['Saturn', 'Jupiter']);
  });

  it('a rule is quoted in the engine’s own words, never paraphrased', () => {
    const rules = READY.card.transit!.rules!;
    const active = Object.entries(rules).filter(
      ([, b]) => (b as Record<string, unknown>).active || (b as Record<string, unknown>).favourable,
    );
    const lines = ruleLines(READY.card);
    for (const [name, block] of active) {
      const line = lines.find((l) => l.id === `rule-${name}`);
      if (!line) continue;      // a rule with no description renders nothing
      expect(line.value).toBe((block as { description: string }).description);
    }
  });
});

describe('the panchang names its place (ASTRAL-126 / F31)', () => {
  it('renders the tithi WITH the city it is for', () => {
    const line = panchangLine(READY.card)!;
    expect(line.place).toBe('Jamshedpur, India');
    expect(line.value).toContain(READY.card.panchang!.tithi!);
    expect(line.value).toContain(READY.card.panchang!.vara!);
  });

  it('an anonymous panchang is not rendered at all', () => {
    // A tithi with no city is a tithi for somewhere the reader has to guess,
    // and Mumbai is the guess this defect used to make. Rather than print
    // one without its place, the layer is dropped and its absence is
    // already stated by the engine.
    const anonymous = {
      ...READY.card,
      panchang: { ...READY.card.panchang, panchang_place: { name: null } },
    };
    expect(panchangLine(anonymous)).toBeNull();
  });

  it('no card without coordinates ever shows a default city', () => {
    const noPanchang = { ...READY.card, panchang: undefined };
    expect(panchangLine(noPanchang)).toBeNull();
  });
});

describe('the time-less card says what it cannot say (AMB-13(c) / ASTRAL-80)', () => {
  it('the dasha layer is a NAMED absence, not an empty block', () => {
    expect(TIMELESS.card.layers).not.toContain('dasha');
    expect(dashaLines(TIMELESS.card)).toEqual([]);
    const named = absences(TIMELESS.card).find((a) => a.layer === 'dasha')!;
    expect(named.reason).toMatch(/birth time/);
    expect(named.unlocked_by).toBe('time_of_birth');
  });

  it('every absence carries a reason — *not computed* is never a blank', () => {
    for (const entry of absences(TIMELESS.card)) {
      expect(entry.reason.length).toBeGreaterThan(10);
    }
  });

  it('a withheld value carries its alternatives and what would settle it', () => {
    const items = withheld(TIMELESS.card);
    // This chart's Moon is determinate, so the register may be empty — what
    // is asserted is the SHAPE when it is not, not that this fixture has one.
    for (const item of items) {
      expect(item.reason).toBeTruthy();
      expect(item.unlockedBy).toBeTruthy();
    }
  });
});

describe('screen 8’s tabs are a filter over ONE artifact (ASTRAL-126)', () => {
  it('all four arrive in the response the screen already holds', () => {
    expect(tabs(READY).map((t) => t.id)).toEqual(['guidance', 'love', 'career', 'self']);
    expect(tabs(READY).map((t) => t.label)).toEqual(['Guidance', 'Love', 'Career', 'Self']);
  });

  it('switching a tab needs no fetch — this module has none', () => {
    const src = codeOf('daily-view.ts');
    expect(src).not.toMatch(/fetch\(/);
    expect(src).not.toMatch(/from '\.\/people'/);
  });

  it('every filtered tab is a subset of Guidance', () => {
    const all = new Set(tabById(READY, 'guidance')!.items.map((i) => i.id));
    for (const id of ['love', 'career', 'self']) {
      for (const item of tabById(READY, id)!.items) {
        expect(all.has(item.id)).toBe(true);
      }
    }
  });

  it('an empty tab says why, and names its own areas', () => {
    const empty = tabs(READY).find((t) => t.items.length === 0);
    // The captured day fills all four; the contract is asserted on the
    // shape rather than on the weather.
    for (const tab of tabs(READY)) {
      if (tab.items.length === 0) {
        expect(tab.empty_reason).toBeTruthy();
      } else {
        expect(tab.empty_reason).toBeNull();
      }
    }
    if (empty) expect(empty.empty_reason).toContain('not a gap in the reading');
  });

  it('a dasha item\'s dates arrive as FIELDS and are formatted here', () => {
    // Measured on-sim: a server-joined "2016-05-25 → 2033-05-25" printed
    // raw ISO on screen. The engine sends the dates; the client formats
    // them the way it formats every other date.
    const item = tabById(READY, 'guidance')!.items.find(
      (i) => i.id === 'dasha:mahadasha',
    )!;
    expect(item.start_date).toBeTruthy();
    expect(item.detail).not.toMatch(/→/);
    expect(itemRange(item)).toMatch(/^\d+ \w+ \d{4} → \d+ \w+ \d{4}$/);
  });

  it('an item no domain claims shows no basis line', () => {
    // The engine's basis names why an item is on the LENS being read. An
    // item outside every adjudicated domain has no such reason, and an
    // empty basis is rendered as nothing rather than as a sentence.
    expect(basisAddsAnything({ detail: 'house 3 from your Lagna', basis: '' }))
      .toBe(false);
    expect(basisAddsAnything({ detail: '', basis: 'read for marriage' }))
      .toBe(true);
  });

  it('a transit item’s basis names the domains, not the house again', () => {
    const love = tabById(READY, 'love')!;
    for (const item of love.items) {
      if (item.kind !== 'transit_position') continue;
      expect(item.basis).toContain('marriage');
      expect(item.basis).not.toContain('house');
    }
  });

  it('every item on a FILTERED lens says why it is there', () => {
    // AMENDED with the basis contract: `basis` names why an item is on the
    // lens being read, in the adjudicator's domain words. On Guidance — the
    // whole day — an item may have no domain and therefore no such reason,
    // and an empty basis is the honest answer rather than a filler
    // sentence. On a filtered lens there is always a reason, and this
    // asserts it.
    for (const tab of tabs(READY).slice(1)) {
      for (const item of tab.items) {
        expect(item.basis).toBeTruthy();
        expect(item.kind).toBeTruthy();
      }
    }
    for (const item of tabById(READY, 'guidance')!.items) {
      expect(item.kind).toBeTruthy();
    }
  });
});

describe('the honest states (ASTRAL-125, AMB-31(a))', () => {
  const state = (s: string, extra: Record<string, unknown> = {}) =>
    ({ state: s, reason: 'because', ...extra }) as Exclude<DailyResponse, DailyReady>;

  it('each one asks for a different thing', () => {
    const titles = ['not_established', 'chart_absent', 'chart_stale', 'refused'].map(
      (s) => absentView(state(s)).title,
    );
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('a stale chart states WHEN it was cast', () => {
    const view = absentView(
      state('chart_stale', { chart: { status: 'stale', computed_at: '2026-03-03T10:00:00Z' } }),
    );
    expect(view.body).toContain('3 Mar 2026');
    expect(view.action).toBe('Recast my chart');
  });

  it('a stale chart with no recorded date still says something true', () => {
    const view = absentView(state('chart_stale', { chart: { status: 'stale' } }));
    expect(view.body).toContain('changed after this chart was cast');
    expect(view.body).not.toContain('null');
    expect(view.body).not.toContain('undefined');
  });

  it('the recast control is a chat TURN, never an endpoint (F24/INV-1)', () => {
    // There is no recompute endpoint and there must not be one on a read
    // API: the chart is recast by the turn that needs it, through
    // `reconcile`. A button here that called something would be writing
    // around the only fact-writer.
    expect(absentView(state('chart_stale')).turn).toMatch(/recast/i);
    const src = codeOf('daily-view.ts');
    expect(src).not.toMatch(/recompute|POST|PATCH/);
  });

  it('a refusal offers no control, because there is nothing honest to offer', () => {
    const view = absentView(state('refused'));
    expect(view.action).toBeNull();
    expect(view.turn).toBeNull();
    expect(view.body).toContain('Nothing is wrong with your details');
  });

  it('§11.2 — nothing this module writes is shaped as a warning', () => {
    const src = codeOf('daily-view.ts');
    for (const word of ['danger', 'beware', 'warning', 'curse', 'doom', 'misfortune', 'unlucky']) {
      expect(src.toLowerCase()).not.toContain(word);
    }
  });
});

describe('isReady is the compiler’s guard, not a convention', () => {
  it('separates a card from an absence', () => {
    expect(isReady(READY)).toBe(true);
    expect(isReady({ state: 'chart_stale', reason: 'x' } as DailyResponse)).toBe(false);
    expect(isReady(null)).toBe(false);
  });
});
