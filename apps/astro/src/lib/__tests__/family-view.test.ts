/**
 * docs/71 PH-33 — the Circle on the client (ASTRAL-288, ASTRAL-289).
 *
 * Every fixture here was CAPTURED FROM THE RUNNING ENGINE
 * (`fixtures/daily_family.json`, four real responses assembled by
 * `services/people/artifacts.self_daily` over a real `compute_natal_chart`).
 * A hand-written fixture would only prove this module parses what somebody
 * imagined.
 *
 * The three states are the ENGINE's choice, not this module's (F114), and
 * the fixture proves the choice was made server-side: `no_circle` and
 * `partner_only` carry no `family` key at all.
 */

import fs from 'fs';
import path from 'path';

import { CAPABILITIES, type Capabilities } from '../capabilities';
import {
  ADD_MEMBER_TURN,
  BAND_WORD,
  CIRCLE_MAX,
  FORGET_GAP,
  KINSHIPS,
  addMemberRoute,
  circleMembers,
  circleRoom,
  familyBlock,
  familyRows,
  familyView,
  forgetConfirmation,
  newlyAddedPerson,
  familyPlaceLine,
  yourRow,
  pendingAddOutcome,
  PENDING_ADD_TTL_MS,
} from '../family-view';
import type { DailyReady, PersonView } from '../people-shapes';
import { DECLARED_PUSHED_ROUTES, routeIsLive, visiblePushedRoutes } from '../tabs';

const FIX = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'daily_family.json'), 'utf8'),
) as {
  no_circle: DailyReady;
  partner_only: DailyReady;
  family: DailyReady;
  people: { people: PersonView[] };
};

const off = (key: keyof Capabilities): Capabilities => ({ ...CAPABILITIES, [key]: false });

// ══════════════════════════════════════════════════════════════════════════
// ASTRAL-288 — the client renders the block it was sent
// ══════════════════════════════════════════════════════════════════════════

describe('the three states are the engine’s choice', () => {
  it('the engine sent no family block for an empty circle', () => {
    expect((FIX.no_circle as { family?: unknown }).family).toBeUndefined();
    expect(familyBlock(FIX.no_circle)).toBeNull();
  });

  it('…and none for the partner alone — the couple card is untouched', () => {
    expect((FIX.partner_only as { family?: unknown }).family).toBeUndefined();
    const slot = familyView(FIX.partner_only);
    expect(slot?.mode).toBe('couple');
  });

  it('…and one for a circle with somebody besides the partner', () => {
    const slot = familyView(FIX.family);
    expect(slot?.mode).toBe('family');
  });

  it('an empty circle falls through to the couple door, not to nothing', () => {
    const slot = familyView(FIX.no_circle);
    expect(slot?.mode).toBe('couple');
    expect(slot && slot.mode === 'couple' && slot.couple.mode).toBe('door');
  });

  it('a response with no couple tab and no family block renders NOTHING', () => {
    const bare = { ...FIX.family, family: undefined,
                   facets: { ...FIX.family.facets, tabs: [] } } as unknown as DailyReady;
    expect(familyView(bare)).toBeNull();
  });

  it('a malformed family block is not rendered as one', () => {
    const broken = { ...FIX.family, family: { kind: 'family_day' } } as unknown as DailyReady;
    expect(familyBlock(broken)).toBeNull();
  });
});

describe('the rows are the engine’s, verbatim and in order', () => {
  const block = familyBlock(FIX.family)!;

  it('the names and their order are not re-sorted', () => {
    expect(familyRows(block).map((r) => r.name)).toEqual(
      block.rows.map((r) => r.name),
    );
    // the engine put the partner first (ASTRAL-283's ordering)
    expect(block.rows[0].kinship).toBe('partner');
  });

  it('every scored row carries the engine’s band and its WORD', () => {
    for (const row of familyRows(block).filter((r) => !r.isAbsent)) {
      expect(row.band).toBeTruthy();
      expect(row.bandWord).toBe(BAND_WORD[row.band!]);
      expect(row.bandWord).toBeTruthy();
    }
  });

  // Role-3, 2026-09-19: the assertion above is a TAUTOLOGY over the derived
  // row — it compares the row to itself. Measured by the reviewer: returning
  // 'green' for every member kept all 520 tests green, so a client that
  // painted the whole family green would have shipped. Doctrine 9 (the client
  // derives NOTHING) needs the row compared to THE WIRE, position by position.
  it('each row’s band is the WIRE’s band, member by member — never re-derived', () => {
    const rows = familyRows(block);
    expect(rows).toHaveLength(block.rows.length);
    for (const [i, row] of rows.entries()) {
      expect(row.band).toBe(block.rows[i].band ?? null);
      expect(row.bandWord).toBe(
        block.rows[i].band ? BAND_WORD[block.rows[i].band!] : null,
      );
      expect(row.personId).toBe(block.rows[i].person_id);
    }
    // the fixture must actually DISAGREE across members, or the check above
    // passes on a constant. This is the guard on the guard.
    expect(new Set(rows.map((r) => r.band)).size).toBeGreaterThan(1);
  });

  it('your own row is the engine’s own day, not a recomputation', () => {
    const mine = yourRow(block);
    expect(mine.band).toBe(block.you.band ?? null);
    expect(mine.bandWord).toBe(
      block.you.band ? BAND_WORD[block.you.band] : null,
    );
    expect(mine.detail).toBe(block.you.line ?? '');
  });

  it('the detail line is the engine’s sentence, copied not composed', () => {
    for (const [i, row] of familyRows(block).entries()) {
      const wire = block.rows[i];
      expect(row.detail).toBe(wire.absent ?? wire.line ?? '');
      expect(row.detail.length).toBeGreaterThan(0);
    }
  });

  it('an absent row is its own sentence and says what unlocks it', () => {
    const absent = familyRows(block).filter((r) => r.isAbsent);
    expect(absent.length).toBeGreaterThan(0);
    for (const row of absent) {
      expect(row.bandWord).toBeNull();
      expect(row.detail.trim().length).toBeGreaterThan(20);
      expect(row.detail).not.toBe('—');
      expect(row.unlockedBy).toBeTruthy();
    }
  });

  it('your own row is the CARD’s band, copied by the engine', () => {
    const you = yourRow(block);
    expect(you.band).toBe((FIX.family.card as { day: { band: string } }).day.band);
    expect(you.name).toBe('You');
    // …and it is not a member row.
    expect(block.rows.map((r) => r.person_id)).not.toContain('self');
  });

  it('the place is named (F113: one sky, and it says which)', () => {
    expect(familyPlaceLine(block)).toContain(block.place!.name!);
  });

  it('the carries-the-day sentence is the engine’s, naming a real row', () => {
    expect(block.carries).toBeTruthy();
    expect(block.rows.some((r) => block.carries!.includes(r.name))).toBe(true);
  });
});

describe('the module derives nothing', () => {
  const SRC = fs
    .readFileSync(path.join(__dirname, '..', 'family-view.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('is React-free, so the root jest project can load it', () => {
    expect(SRC).not.toMatch(/from\s+'react'/);
    expect(SRC).not.toMatch(/from\s+'react-native'/);
    expect(SRC).not.toMatch(/from\s+'expo/);
  });

  it('contains no threshold and computes no band', () => {
    // The one place a number becomes a colour is `day_score.band_of`, on
    // the server. A threshold here would be a second one.
    expect(SRC).not.toMatch(/score\s*[<>]=?/);
    expect(SRC).not.toMatch(/0\.\d+/);
    expect(SRC).not.toMatch(/band_of/);
  });

  it('reads no clock', () => {
    expect(SRC).not.toContain('new Date(');
    expect(SRC).not.toContain('Date.now(');
    expect(SRC).not.toContain('toISOString');
  });

  it('carries no colour value — only the band’s own word', () => {
    expect(SRC).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(SRC).not.toMatch(/rgba?\(/);
  });

  it('never infers a kinship', () => {
    expect(SRC).not.toMatch(/relation\s*===\s*'(family|partner)'/);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ASTRAL-282 — the Family screen reads ONE endpoint
// ══════════════════════════════════════════════════════════════════════════

describe('the circle, from the one people read', () => {
  const people = FIX.people.people;

  it('the members are exactly the rows the engine marked in_circle', () => {
    const members = circleMembers(people);
    expect(members.map((m) => m.name)).toEqual(
      people.filter((p) => p.in_circle).map((p) => (p.display_name || '').trim()),
    );
    expect(members.length).toBeGreaterThan(1);
  });

  it('`self` is never in the circle and is never called family', () => {
    const me = people.find((p) => p.id === 'self')!;
    expect(me.in_circle).toBe(false);
    expect(me.kinship).toBeNull();
    expect(circleMembers(people).map((m) => m.personId)).not.toContain('self');
  });

  it('every row says its chart state in words — never a blank', () => {
    for (const m of circleMembers(people)) {
      expect(m.chartLine.trim().length).toBeGreaterThan(0);
      expect(m.chartLine).not.toBe('—');
    }
  });

  it('a member with no chart says so and is not left spinning', () => {
    const absent = circleMembers(people).filter((m) => m.chartStatus === 'absent');
    expect(absent.length).toBeGreaterThan(0);
    for (const m of absent) {
      expect(m.needsChart).toBe(true);
      expect(m.chartLine).toMatch(/cast/i);
    }
  });

  it('the derived partner is shown with its source, not hidden', () => {
    const partner = circleMembers(people).find((m) => m.kinship === 'partner');
    expect(partner).toBeTruthy();
    expect(['stored', 'link']).toContain(partner!.kinshipSource);
  });

  it('the cap is said before the tap, and it is four', () => {
    expect(CIRCLE_MAX).toBe(4);
    expect(circleRoom(circleMembers(people))).toBe(4 - circleMembers(people).length);
    expect(circleRoom(new Array(9).fill(0))).toBe(0);
  });

  it('the kinship vocabulary matches the engine’s, term for term', () => {
    expect([...KINSHIPS]).toEqual([
      'partner', 'mother', 'father', 'son', 'daughter', 'brother', 'sister',
      'grandmother', 'grandfather', 'other',
    ]);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ASTRAL-286 — adding a member is the shipped flow plus one label
// ══════════════════════════════════════════════════════════════════════════

describe('adding a member', () => {
  it('opens the details flow with the engine’s own adhoc cue, verbatim', () => {
    // Pinned on the engine's side too: `test_people_circle.py` asserts
    // `subject.subject_cue(ADD_MEMBER_TURN) == ("adhoc", "")`.
    expect(ADD_MEMBER_TURN).toBe('Reading for someone new.');
    const route = addMemberRoute('son');
    expect(route.pathname).toBe('/birth-details');
    expect(route.params.opening).toBe(ADD_MEMBER_TURN);
    expect(route.params.kinship).toBe('son');
  });

  it('carries NO birth fact in the route params', () => {
    const json = JSON.stringify(addMemberRoute('daughter').params);
    expect(json).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(json).not.toMatch(/\d{1,2}:\d{2}/);
    expect(json).not.toMatch(/(date_of_birth|time_of_birth|place_of_birth)/);
  });

  it('finds the person the engine just minted, and only when it is certain', () => {
    const people = FIX.people.people;
    const known = people.map((p) => p.id);
    // Nothing new → nothing labelled. The honest answer when the user
    // abandoned the flow.
    expect(newlyAddedPerson(people, known)).toBeNull();
    const minted = {
      id: 'p_new', relation: 'friend', display_name: 'Aarav',
      source_label: 'chat', favourite: false, tob_known: false,
      birth_facts: {}, created_at: '', updated_at: '', in_circle: false,
    } as unknown as PersonView;
    expect(newlyAddedPerson([...people, minted], known)?.id).toBe('p_new');
    // Two candidates → none: labelling somebody at random is worse than
    // asking again.
    const second = { ...minted, id: 'p_new2' } as PersonView;
    expect(newlyAddedPerson([...people, minted, second], known)).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ASTRAL-287 — Forget says what it does not cover
// ══════════════════════════════════════════════════════════════════════════

describe('the Forget confirmation', () => {
  it('states the one gap verbatim, in the engine’s words', () => {
    // Pinned byte-for-byte against `services/people/forget_copy.FORGET_GAP`
    // (that module's own test asserts it against the cascade's source, so
    // this string goes stale loudly the day ASTRAL-43 ships).
    expect(FORGET_GAP).toBe(
      'Palm images they uploaded are not covered — that deletion is not built yet (ASTRAL-43).',
    );
  });

  it('names the person and what IS removed', () => {
    const body = forgetConfirmation('Aarav');
    expect(body).toContain('Aarav');
    expect(body).toContain('every match that named them');
    expect(body).toContain(FORGET_GAP);
  });

  it('never claims palm images were removed', () => {
    expect(forgetConfirmation('Aarav')).not.toMatch(/everything about them/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ASTRAL-289 — the capability tells the truth, and false REMOVES
// ══════════════════════════════════════════════════════════════════════════

describe('the family capability', () => {
  it('is declared with a reason naming the reads it IS', () => {
    const caps = fs.readFileSync(
      path.join(__dirname, '..', 'capabilities.ts'), 'utf8');
    const at = caps.indexOf('family: boolean;');
    expect(at).toBeGreaterThan(0);
    const preamble = caps.slice(Math.max(0, at - 1600), at);
    expect(preamble).toContain('ASTRAL-280');
    expect(preamble).toContain('kinship');
    expect(preamble).toContain('GET /people');
  });

  it('flipping it to false REMOVES the route', () => {
    const caps = off('family');
    expect(visiblePushedRoutes(caps).map((r) => r.path)).not.toContain('/family');
    expect(routeIsLive('/family', caps)).toBe(false);
    expect(visiblePushedRoutes(caps)).toHaveLength(
      visiblePushedRoutes(CAPABILITIES).length - 1,
    );
  });

  it('…and the route is declared, so a deep link cannot outlive it', () => {
    expect(DECLARED_PUSHED_ROUTES.find((r) => r.path === '/family')?.needs)
      .toBe('family');
    expect(routeIsLive('/family')).toBe(true);
  });

  it('removing it leaves the couple card alone', () => {
    // ASTRAL-289: `family: false` removes the family STATE of Home's slot.
    // The couple card is a different capability's surface and must not
    // move — the fixture's partner-only response is unaffected by any
    // capability, because the ENGINE chose it.
    expect(familyView(FIX.partner_only)?.mode).toBe('couple');
  });
});

describe('the pending "add a member" intent — Role-3 blocking defect, 2026-09-19', () => {
  const NOW = 1_800_000_000_000;
  const known = ['p-old'];
  const pending = { kinship: 'son' as const, known, at: NOW };
  const person = (id: string, extra: any = {}) => ({
    id, display_name: id, relation: 'friend', in_circle: false,
    kinship: null, chart_status: 'fresh', ...extra,
  }) as any;

  it('labels the one person the flow just minted', () => {
    const out = pendingAddOutcome(pending, [person('p-old'), person('p-new')], true, NOW + 1000);
    expect(out).toEqual({ action: 'label', personId: 'p-new', kinship: 'son' });
  });

  it('DISCARDS the intent when the flow was abandoned — nobody gets labelled', () => {
    const out = pendingAddOutcome(pending, [person('p-old')], true, NOW + 1000);
    expect(out).toEqual({ action: 'discard', reason: 'abandoned' });
  });

  // The defect itself: abandon, then save an unrelated person from a chat,
  // then open Family. Before the fix that stranger was silently PATCHed with
  // the kinship chosen for somebody else (docs/67's bug class).
  it('a stranger saved from chat AFTER an abandon is never labelled', () => {
    const abandoned = pendingAddOutcome(pending, [person('p-old')], true, NOW + 1000);
    expect(abandoned.action).toBe('discard');
    // the screen clears on discard, so the next read sees no intent at all
    const later = pendingAddOutcome(null, [person('p-old'), person('p-stranger')], true, NOW + 2000);
    expect(later).toEqual({ action: 'wait' });
  });

  it('an intent older than the TTL expires even if a candidate exists', () => {
    const out = pendingAddOutcome(
      pending, [person('p-old'), person('p-new')], true, NOW + PENDING_ADD_TTL_MS + 1,
    );
    expect(out).toEqual({ action: 'discard', reason: 'expired' });
  });

  it('waits while the read is still in flight — a half-loaded list is not an abandon', () => {
    expect(pendingAddOutcome(pending, null, false, NOW + 1).action).toBe('wait');
    expect(pendingAddOutcome(pending, [person('p-old')], false, NOW + 1).action).toBe('wait');
  });

  it('two new people is not a candidate — it refuses rather than guessing', () => {
    const out = pendingAddOutcome(
      pending, [person('p-old'), person('p-a'), person('p-b')], true, NOW + 1000,
    );
    expect(out).toEqual({ action: 'discard', reason: 'abandoned' });
  });

  it('does nothing at all when no intent is pending', () => {
    expect(pendingAddOutcome(null, [person('p-old')], true, NOW)).toEqual({ action: 'wait' });
  });
});

describe('the details screen title when adding a member (owner, on device 2026-09-19)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { addMemberTitle } = require('../family-view');
  it('names the relation instead of saying "Your Chart"', () => {
    expect(addMemberTitle('son')).toBe('Add Your\nSon');
    expect(addMemberTitle('mother')).toBe('Add Your\nMother');
    expect(addMemberTitle('other')).toBe('Add a Family\nMember');
  });
  it('is null for anything that is not a known kinship, so the screen keeps its own title', () => {
    expect(addMemberTitle(undefined)).toBeNull();
    expect(addMemberTitle('')).toBeNull();
    expect(addMemberTitle('uncle')).toBeNull();
  });
});
