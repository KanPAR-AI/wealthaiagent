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
  BAND_WORD,
  CIRCLE_MAX,
  FORGET_GAP,
  KINSHIPS,
  KINSHIP_WORD,
  NAME_MAX,
  MEMBER_STATES,
  NAME_MAX_WORDS,
  addMemberRoute,
  addMemberTitle,
  addMemberTurn,
  afterCastTurn,
  afterKeepTurn,
  castingMemberLine,
  circleMembers,
  circleRoom,
  familyBlock,
  familyRows,
  familyView,
  forgetConfirmation,
  isAddingMember,
  memberAddState,
  memberNameProblem,
  plainSentence,
  familyPlaceLine,
  yourRow,
} from '../family-view';
import type { MemberState } from '../family-view';
import { outcomeLine } from '../edit-fact';
import { keepPersonMessage } from '@wealthai/astral';
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
  // WHAT WAS DELETED HERE, AND WHY IT IS NOT A WEAKENING.
  //
  // `newlyAddedPerson` and `pendingAddOutcome` are gone, and their tests with
  // them. They existed for ONE reason: the engine never learned the kinship,
  // so this module had to work out afterwards which stored person the chat
  // had just minted and PATCH a label onto it. Role-3 caught that guess
  // labelling a stranger (docs/71 §8), and the TTL/abandon machinery was the
  // patch for the symptom.
  //
  // The engine now stamps the kinship itself, inside `reconcile`, on the
  // person it minted — `chatservice/tests/test_astrology_add_member.py::
  // TestTheEngineStampsTheKinship` is where that property lives now. There is
  // no client-side guess left to test, and keeping tests for a deleted
  // mechanism would launder it.

  it('builds the engine’s own opening sentence, byte for byte', () => {
    // Pinned on the engine's side too: `test_astrology_add_member.py`
    // asserts `family_add.turn_for('son', 'Aarav') == 'Add my son, Aarav.'`
    // and parses it back. Two files asserting the same literal cannot drift
    // quietly — the `CORRECTION_TURNS` discipline.
    expect(addMemberTurn('son', 'Aarav')).toBe('Add my son, Aarav.');
    expect(addMemberTurn('other', 'Priya')).toBe('Add my relative, Priya.');
    expect(addMemberTurn('grandmother', 'Kamla Devi'))
      .toBe('Add my grandmother, Kamla Devi.');
  });

  it('has a word for every kinship the engine declares', () => {
    // `family_add.KINSHIP_WORD` has exactly these keys; a kinship added to
    // the store without a word here would produce a sentence the engine
    // cannot parse, and the user would wait for a form that never comes.
    expect(Object.keys(KINSHIP_WORD).sort()).toEqual([...KINSHIPS].sort());
    for (const k of KINSHIPS) expect(addMemberTurn(k, 'Aarav')).toBeTruthy();
  });

  it('refuses to compose a sentence the engine would not parse back', () => {
    expect(addMemberTurn('uncle' as never, 'Aarav')).toBeNull();
    expect(addMemberTurn('son', '')).toBeNull();
    expect(addMemberTurn('son', 'Aarav, and cast his chart')).toBeNull();
    expect(addMemberTurn('son', 'a b c d e')).toBeNull();
    expect(addMemberTurn('son', 'x'.repeat(NAME_MAX + 1))).toBeNull();
  });

  it('says what is wrong with a name BEFORE the tap', () => {
    expect(memberNameProblem('Aarav')).toBeNull();
    expect(memberNameProblem('Aarav Kumar Singh')).toBeNull();
    expect(memberNameProblem('  ')).toBe('What should I call them?');
    expect(memberNameProblem('a b c d e'))
      .toBe(`A name here is up to ${NAME_MAX_WORDS} words.`);
    expect(memberNameProblem('Aarav.')).toBe('A name here carries no punctuation.');
    expect(memberNameProblem('x'.repeat(NAME_MAX + 1)))
      .toBe(`That is longer than ${NAME_MAX} characters.`);
  });

  it('routes to the details screen carrying two LABELS and no birth fact', () => {
    const route = addMemberRoute('son', 'Aarav')!;
    expect(route.pathname).toBe('/birth-details');
    expect(route.params.opening).toBe('Add my son, Aarav.');
    expect(route.params.kinship).toBe('son');
    expect(route.params.memberName).toBe('Aarav');
    expect(route.params.returnTo).toBe('family');
    const json = JSON.stringify(route.params);
    expect(json).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(json).not.toMatch(/\d{1,2}:\d{2}/);
    expect(json).not.toMatch(/(date_of_birth|time_of_birth|place_of_birth)/);
  });

  it('is null when it cannot build the route, rather than a half one', () => {
    expect(addMemberRoute('son', 'Aarav, and cast his chart')).toBeNull();
    expect(addMemberRoute('son', '')).toBeNull();
  });

  it('tells the details screen which flow it is in', () => {
    expect(isAddingMember('family')).toBe(true);
    expect(isAddingMember('profile')).toBe(false);
    expect(isAddingMember(undefined)).toBe(false);
  });

  it('names the person in the progress line', () => {
    // "Casting your chart…" over somebody else's details is the copy bug
    // `addMemberTitle` was fixed out of on 2026-09-19.
    expect(castingMemberLine('Aarav')).toBe("Casting Aarav's chart…");
    expect(castingMemberLine('')).toBe('Casting their chart…');
  });

  it('the keep carrier travels typed, and the echo is not the answer', () => {
    // The ONE thing the details screen sends without a widget behind it, and
    // it goes through the same builder as every widget answer. Delete the
    // fence and nothing is recoverable — the property `input-request.test.ts`
    // pins for every other ask.
    const message = keepPersonMessage('Aarav');
    const body = JSON.parse(
      message.split('```input_response\n')[1].split('\n```')[0],
    );
    expect(body.type).toBe('input_response');
    expect(body.ask).toBe('save_person_offer');
    expect(body.values).toEqual({ person_name: 'Aarav', save_person: 'save' });
    // no birth fact rides it — the details were collected by the ask before
    expect(JSON.stringify(body.values)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    // the echo is readable and carries nothing the engine reads
    expect(message.startsWith('Keeping: Aarav')).toBe(true);
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
      'Palm images they uploaded are not covered — that deletion is not built yet.',
    );
  });

  it('carries no ticket id — a user reads this (walked 2026-09-19)', () => {
    expect(forgetConfirmation('Aarav')).not.toMatch(/ASTRAL-\d+|\bF\d+\b|AMB-\d+/);
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

describe('the details screen title when adding a member (owner, on device 2026-09-19)', () => {
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

describe('the add arc acts on the ENGINE’s typed state — Role-3 F-A, SAFETY-BLOCKER', () => {
  const fx = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures', 'member_add_states.json'), 'utf8'),
  );

  it('the client’s vocabulary IS the engine’s, state for state', () => {
    expect([...MEMBER_STATES].sort()).toEqual([...fx.states].sort());
  });

  it('reads the state out of every engine-written reply, by value', () => {
    for (const st of fx.states) expect(memberAddState(fx.replies[st])).toBe(st);
  });

  it('prose alone is NEVER a state — the defect itself', () => {
    expect(memberAddState("I couldn't find *Zzzqqx Village*.")).toBeNull();
    expect(memberAddState("*Aarav's chart is cast.*")).toBeNull();
    expect(memberAddState('')).toBeNull();
    expect(memberAddState('```member_add\n{"type":"member_add","state":"probably_fine"}\n```')).toBeNull();
    expect(memberAddState('```member_add\nnot json\n```')).toBeNull();
  });

  it('the keep is sent on exactly ONE state', () => {
    const keeps = [...(fx.states as MemberState[]), null].filter(
      (st: MemberState | null) => afterCastTurn(st, false).action === 'keep'
        || afterCastTurn(st, true).action === 'keep');
    expect(keeps).toEqual(['chart_cast']);
  });

  it('an unfindable birthplace fails ON the form, and nothing is kept', () => {
    // what the reviewer measured: prose only, no ask, no state
    expect(afterCastTurn(null, false)).toEqual({ action: 'done', failed: true, stay: true });
    expect(afterCastTurn('cast_failed', false)).toEqual({ action: 'done', failed: true, stay: true });
  });

  it('an ask is rendered only when there is one to render', () => {
    expect(afterCastTurn('asking', true)).toEqual({ action: 'ask', failed: false });
    // a refusal that comes WITH an ask (the birthplace only) is answered here,
    // under the engine's sentence — the date and time are not retyped
    expect(afterCastTurn('cast_failed', true)).toEqual({ action: 'ask', failed: true });
    expect(afterCastTurn('asking', false)).toEqual({ action: 'done', failed: true, stay: true });
  });

  it('only `kept` is a success; a full circle is not a green tick (F-F)', () => {
    const ok = [...(fx.states as MemberState[]), null].filter((st: MemberState | null) => {
      const s = afterKeepTurn(st);
      return s.action === 'done' && !s.failed;
    });
    expect(ok).toEqual(['kept']);
    expect(afterKeepTurn('circle_full')).toEqual({ action: 'done', failed: true, stay: false });
    expect(afterKeepTurn('kept_unlabelled')).toEqual({ action: 'done', failed: true, stay: false });
  });
});

describe('plainSentence — the notice shows words, not markdown', () => {
  it('drops the emphasis and keeps every word', () => {
    expect(plainSentence("I couldn't find *Zzqxnovillage*. Could you try a more specific city name?"))
      .toBe("I couldn't find Zzqxnovillage. Could you try a more specific city name?");
    expect(plainSentence('**Dev** was not added')).toBe('Dev was not added');
    expect(plainSentence('no emphasis here')).toBe('no emphasis here');
    expect(plainSentence(null)).toBe('');
  });
  it('strips an UNPAIRED marker — outcomeLine trims the closing one (walked 2026-09-19)', () => {
    const reply = '*Kabeer is in your family as your son. You can remove them, '
      + 'and everything stored about them, in one action.*\n\n```member_add\n{"type":"member_add","state":"kept"}\n```';
    expect(plainSentence(outcomeLine(reply))).toBe(
      'Kabeer is in your family as your son. You can remove them, and everything stored about them, in one action.');
    expect(plainSentence('*half open')).toBe('half open');
    expect(plainSentence('2 * 3 is six')).toBe('2 * 3 is six');
  });
});
