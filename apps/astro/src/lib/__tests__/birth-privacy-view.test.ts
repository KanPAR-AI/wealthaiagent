/**
 * The birth-details privacy lock (owner, 2026-09-19: "on the app hide my
 * birth details — only visible with a screen lock or face lock; exact date
 * and time of birth should not be visible").
 *
 * Tested where the rules live: the pure view model, not a screenshot.
 * Relative imports on purpose — the root jest project maps `@/*` to the WEB
 * app's `src`.
 *
 * ── the one assertion style that matters here ─────────────────────────────
 *
 * Most cases below do not check that a mask is present. They check that the
 * REAL VALUE IS ABSENT from the whole rendered structure — every digit of
 * the year, the month name, the clock time, the city. A test that only
 * asserted `••••••` appears would pass on a row that printed the mask AND
 * the date, which is exactly the bug this feature exists to prevent.
 */

import {
  buildInputResponseMessage,
  parseInputRequest,
  stripInputResponse,
  type InputRequestPayload,
} from '@wealthai/astral';
import {
  correctionAskPayload,
  correctionPlaceAskPayload,
} from '@wealthai/astral/fixtures';

import {
  CORRECTING_WHILE_HIDDEN,
  HIDDEN_ANSWER,
  LOCKED,
  LOCKED_CARRIER_KEYS,
  LOCKED_FACT_KEYS,
  MASKED_VALUE,
  NEEDS_NEW_BUILD,
  NO_SCREEN_LOCK,
  REVEAL_WINDOW_MS,
  carrier,
  carriesLockedBirthFacts,
  isLockedCarrierKey,
  isRevealed,
  maskedAntardashaBands,
  maskedAssistantText,
  maskedChartBirthLines,
  maskedDashaAxis,
  maskedDashaLines,
  maskedDashaRows,
  maskedPlaceName,
  maskedTimelineRows,
  maskedFactRows,
  maskedInputRequest,
  maskedUserBubbleText,
  msUntilRelock,
  outcomeBanner,
  reduce,
  revealFailure,
  revealGate,
} from '../birth-privacy-view';
// The UNMASKED builders, imported so the "unlocked is untouched" cases can
// be stated as an equality instead of as three literal birth values.
import { factRows, } from '../profile-view';
import { birthLines, dashaRows } from '../chart-view';
import { dashaAxis, rows as timelineRows } from '../timeline-view';
import { dashaLines } from '../daily-view';
import type { TimelineResponse } from '../people-shapes';
import type { PersonView } from '../people-shapes';
import type { ChartResponse } from '../people-shapes';

// Captured, never hand-written: `GET /api/v1/people/self` and
// `GET /api/v1/people/{id}/chart` off the running engine.
import self_person from './fixtures/self_person.json';
import chartFixture from './fixtures/chart.json';
import timelineFixture from './fixtures/timeline.json';
import dailyFixture from './fixtures/daily.json';
// …and the PERSISTED user bubble, lifted out of a real transcript
// (`GET /chats/{id}`) rather than rebuilt: what the app renders is whatever
// the server stored months ago, so the bytes under test are those bytes.
import transcriptAnswer from './fixtures/transcript_birth_answer.json';

const PERSON = (self_person as { person: PersonView }).person;
const CHART = (chartFixture as unknown as ChartResponse).chart;
const CARD = (dailyFixture as { card: Parameters<typeof dashaLines>[0] }).card;
const TIMELINE = (timelineFixture as unknown as TimelineResponse & {
  timeline: NonNullable<unknown>;
}).timeline as Parameters<typeof timelineRows>[0];

/**
 * The values to hunt for — DERIVED from the fixtures, never typed here.
 *
 * Two reasons, and the second is the one that matters. (i) A literal would
 * go stale the moment a fixture is re-captured, and a stale hunt passes on a
 * leak. (ii) This is the test file for the feature whose entire point is
 * that a birth date, time and place are not left lying about; writing three
 * of them into source would be a small joke at the reader's expense.
 *
 * Both notations are collected: the RAW value the store holds (`1991-03-07`)
 * and the FORMATTED one a screen prints (`7 Mar 1991`), because a mask that
 * caught one and not the other would still be a leak.
 */
const REVEALED_ROWS = maskedFactRows(PERSON, true);
const REVEALED_CHART = maskedChartBirthLines(CHART, true);

/** the row values a locked Profile must not contain */
const PERSON_VALUES = [
  ...REVEALED_ROWS.map((r) => r.value),
  ...LOCKED_FACT_KEYS.map((k) => String(PERSON.birth_facts?.[k]?.value ?? '')),
];
/** …and the chart block's, MINUS the zone, which survives the mask by design */
const CHART_VALUES = [
  ...REVEALED_CHART.filter((l) => l.key !== 'zone').map((l) => l.value),
  String(CHART?.birth_data?.date_of_birth ?? ''),
  String(CHART?.birth_data?.time_of_birth ?? ''),
  String(CHART?.birth_data?.place_of_birth ?? ''),
];

const SECRETS = Array.from(new Set([...PERSON_VALUES, ...CHART_VALUES]))
  .filter((v) => v.length > 2);

function assertNothingLeaks(rendered: unknown): void {
  expect(SECRETS.length).toBeGreaterThan(4);   // the hunt is not empty
  const text = JSON.stringify(rendered);
  for (const secret of SECRETS) {
    expect(text).not.toContain(secret);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 1 — DEFAULT = HIDDEN, on every surface
// ══════════════════════════════════════════════════════════════════════════

describe('the Profile card', () => {
  it('hides the date, the time AND the place by default', () => {
    const rows = maskedFactRows(PERSON, false);
    expect(rows.map((r) => r.key)).toEqual([
      'date_of_birth', 'time_of_birth', 'place_of_birth',
    ]);
    for (const row of rows) expect(row.value).toBe(MASKED_VALUE);
    assertNothingLeaks(rows.map((r) => r.value));
  });

  it('never shows a partial date — no year, no month, no weekday', () => {
    for (const row of maskedFactRows(PERSON, false)) {
      expect(row.value).not.toMatch(/\d/);
      expect(row.value).not.toMatch(
        /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|mon|tue|wed|thu|fri|sat|sun/i,
      );
    }
  });

  it('keeps the provenance line, which is about the RECORD and not the value', () => {
    const rows = maskedFactRows(PERSON, false);
    for (const row of rows) {
      expect(row.provenance).toContain('from your chat');
      // …and the provenance DATE is the day it was recorded, not a birth fact.
      expect(row.provenance).toMatch(/2026/);
    }
  });

  it('keeps the label and the correction affordance', () => {
    const rows = maskedFactRows(PERSON, false);
    expect(rows.map((r) => r.label)).toEqual([
      'Date of birth', 'Time of birth', 'Place of birth',
    ]);
    // the date and the time stay correctable while hidden; the place row's
    // own block (F45) is unchanged by this feature
    expect(rows.find((r) => r.key === 'date_of_birth')!.editable).toBe(true);
    expect(rows.find((r) => r.key === 'time_of_birth')!.editable).toBe(true);
  });

  it('shows the real values only when unlocked', () => {
    // Asserted against the UNMASKED builder rather than against three
    // literals: "unlocked is untouched" is the property, and stating it this
    // way keeps a birth value out of this file (see SECRETS above).
    expect(maskedFactRows(PERSON, true)).toEqual(factRows(PERSON));
    for (const row of maskedFactRows(PERSON, true)) {
      expect(row.value).not.toBe(MASKED_VALUE);
    }
    expect(maskedFactRows(PERSON, true).map((r) => r.value))
      .toEqual(expect.arrayContaining([expect.stringMatching(/\d/)]));
  });
});

describe('the chart screen’s birth block', () => {
  it('hides the born date, the time and the place', () => {
    const lines = maskedChartBirthLines(CHART, false);
    const byKey = Object.fromEntries(lines.map((l) => [l.key, l.value]));
    expect(byKey.date).toBe(MASKED_VALUE);
    expect(byKey.time).toBe(MASKED_VALUE);
    expect(byKey.place).toBe(MASKED_VALUE);
    assertNothingLeaks(lines);
  });

  it('keeps the ZONE row — the frame the instant was pinned to, not the instant', () => {
    const lines = maskedChartBirthLines(CHART, false);
    const zone = lines.find((l) => l.key === 'zone');
    expect(zone).toBeDefined();
    expect(zone!.value).toContain('Asia/Kolkata');
  });

  it('shows everything when unlocked', () => {
    expect(maskedChartBirthLines(CHART, true)).toEqual(birthLines(CHART));
    for (const line of maskedChartBirthLines(CHART, true)) {
      expect(line.value).not.toBe(MASKED_VALUE);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 2 — the transcript: the user's own widget-answer echo
// ══════════════════════════════════════════════════════════════════════════

describe('a self birth-details answer in the transcript', () => {
  // Built by the REAL carrier builder, so the bytes under test are the bytes
  // that travel (`packages/astral/src/input-request.ts`).
  const ask = parseInputRequest({
    type: 'input_request',
    ask: 'required_slots_missing',
    reason: '',
    fields: [
      { key: 'dob', kind: 'date', label: 'Date of birth', required: true, allow_unknown: false },
      { key: 'tob', kind: 'time', label: 'Birth time', required: false, allow_unknown: true },
      { key: 'pob', kind: 'place', label: 'Birth place', required: true, allow_unknown: false },
      {
        key: 'birth_time_confidence', kind: 'choice', label: 'How exact is that time?',
        required: false, allow_unknown: false,
        options: [{ value: 'exact', label: 'Exact — off a record or a clock' }],
      },
    ],
  })!;
  // The three values come from the FIXTURE, not from this file: see SECRETS.
  const ANSWER = {
    dob: String(PERSON.birth_facts?.date_of_birth?.value ?? ''),
    tob: String(PERSON.birth_facts?.time_of_birth?.value ?? ''),
    pob: String(PERSON.birth_facts?.place_of_birth?.value ?? ''),
  };
  const SENT = buildInputResponseMessage(ask, {
    ...ANSWER,
    birth_time_confidence: 'exact',
  });

  it('the bubble as it ships today contains the exact date, time and place', () => {
    // The thing being fixed, pinned — so this test fails if the echo ever
    // stops being the leak, and somebody has to look at why. The date and
    // the place are matched as the SCREEN writes them; the time is matched
    // as a clock rather than as a literal, because the echo re-notates it.
    const today = stripInputResponse(SENT);
    const shownDate = REVEALED_ROWS.find((r) => r.key === 'date_of_birth')!.value;
    expect(today).toContain(shownDate);
    expect(today).toContain(ANSWER.pob);
    expect(today).toMatch(/\d{1,2}:\d{2}/);
  });

  it('renders masked while locked, with nothing exact left in it', () => {
    const shown = maskedUserBubbleText(SENT, false, stripInputResponse);
    assertNothingLeaks(shown);
    // …and the strongest form of it: no digit survives at all, so no
    // re-notation of the date or the clock can slip through the hunt above.
    expect(shown).not.toMatch(/\d/);
    expect(shown).toContain(`Date of birth: ${MASKED_VALUE}`);
    expect(shown).toContain(`Birth time: ${MASKED_VALUE}`);
    expect(shown).toContain(`Birth place: ${MASKED_VALUE}`);
    // the qualifier rides along: it is a statement ABOUT the time, not one
    expect(shown).toContain('How exact is that time?: Exact');
    // and the raw fence is still suppressed, exactly as before
    expect(shown).not.toContain('```');
    expect(shown).not.toContain('{');
  });

  it('renders verbatim when unlocked', () => {
    expect(maskedUserBubbleText(SENT, true, stripInputResponse))
      .toBe(stripInputResponse(SENT));
  });

  it('is identified by the carrier keys, not by the words beside them', () => {
    // Same sentence, no fence: an ordinary typed message is NOT rewritten.
    const typed = `Date of birth: ${ANSWER.dob} · Birth time: ${ANSWER.tob}`;
    expect(carrier(typed).kind).toBe('none');
    expect(maskedUserBubbleText(typed, false, stripInputResponse)).toBe(typed);
  });

  it('leaves another person’s answer alone (out of scope, by key)', () => {
    const partnerAsk = parseInputRequest({
      type: 'input_request', ask: 'required_slots_missing', reason: '',
      fields: [
        { key: 'person2_dob', kind: 'date', label: "Your partner's date of birth", required: true, allow_unknown: false },
      ],
    })!;
    const msg = buildInputResponseMessage(partnerAsk, { person2_dob: '1991-04-02' });
    expect(carriesLockedBirthFacts(msg)).toBe(false);
    expect(maskedUserBubbleText(msg, false, stripInputResponse))
      .toBe(stripInputResponse(msg));
  });

  it('leaves a non-birth widget answer alone', () => {
    const saveAsk = parseInputRequest({
      type: 'input_request', ask: 'save_match_offer', reason: '',
      fields: [{
        key: 'save_match', kind: 'choice', label: 'Save this match?',
        required: false, allow_unknown: false,
        options: [{ value: 'save', label: 'Save to my matches' }],
      }],
    })!;
    const msg = buildInputResponseMessage(saveAsk, { save_match: 'save' });
    expect(maskedUserBubbleText(msg, false, stripInputResponse))
      .toBe(stripInputResponse(msg));
  });

  it('FAILS CLOSED on an answer fence it cannot read', () => {
    // A widget answer whose keys are unknown might be the birth details, so
    // it is hidden rather than shown. "Could not read it" and "there is no
    // fence" are different facts and only one of them is safe to render.
    const broken = `Date of birth: ${ANSWER.dob}\n\n\`\`\`input_response\n{not json\n\`\`\``;
    expect(carrier(broken).kind).toBe('unreadable');
    expect(carriesLockedBirthFacts(broken)).toBe(true);
    const shown = maskedUserBubbleText(broken, false, stripInputResponse);
    expect(shown).toBe(HIDDEN_ANSWER);
    assertNothingLeaks(shown);
  });

  it('masks a REAL persisted bubble, in the envelope the server stores', () => {
    // Captured 2026-09-19 from a live transcript on this deployment: the
    // envelope, the fence language, the key set and the echo grammar are the
    // engine's. The three VALUES were substituted — the captured turn was a
    // third party's and their birth details do not belong in a repository
    // (the fixture's `_capture` block says so). What is asserted below is a
    // property of the shape, which is the part that was captured.
    const stored = String((transcriptAnswer as { content: string }).content);
    expect(stripInputResponse(stored)).toContain('2 Feb 1970');

    const shown = maskedUserBubbleText(stored, false, stripInputResponse);
    expect(shown).toBe(
      `Date of birth: ${MASKED_VALUE} · Birth time: ${MASKED_VALUE} · Birth place: ${MASKED_VALUE}`,
    );
    for (const secret of ['1970', '2 Feb', '7:45', '07:45', 'Springfield']) {
      expect(shown).not.toContain(secret);
    }
    // …and it is NOT empty, which would delete the turn from the transcript
    // rather than mask it (the bubble renders nothing for an empty string).
    expect(shown.length).toBeGreaterThan(0);
  });

  it('every locked carrier key is one the engine actually declares', () => {
    // graph.py:116 `INPUT_FIELDS` — dob/tob/pob are the self facts, and
    // person1_* are the synastry flow's name for the same three.
    expect([...LOCKED_CARRIER_KEYS]).toEqual([
      'dob', 'tob', 'pob', 'person1_dob', 'person1_tob', 'person1_pob',
    ]);
    expect(isLockedCarrierKey('person2_dob')).toBe(false);
    expect(isLockedCarrierKey('save_match')).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 3 — correcting a fact without revealing the old one
// ══════════════════════════════════════════════════════════════════════════

describe('the correction form', () => {
  const timeAsk = parseInputRequest(correctionAskPayload)!;
  const placeAsk = parseInputRequest(correctionPlaceAskPayload)!;

  it('the engine’s ask carries the stored value (the thing being hidden)', () => {
    expect(timeAsk.fields[0].value).toBe('00:20');
    expect(placeAsk.fields[0].value).toBe('Padrauna');
  });

  it('opens blank while locked — the picker starts at its own default', () => {
    const masked = maskedInputRequest(timeAsk, false);
    expect(masked.fields[0].value).toBeUndefined();
    expect('value' in masked.fields[0]).toBe(false);
    expect(JSON.stringify(masked)).not.toContain('00:20');
  });

  it('changes nothing else about the ask', () => {
    const masked = maskedInputRequest(timeAsk, false);
    expect(masked.ask).toBe(timeAsk.ask);
    expect(masked.reason).toBe(timeAsk.reason);
    expect(masked.fields).toHaveLength(1);
    expect(masked.fields[0].key).toBe('tob');
    expect(masked.fields[0].kind).toBe('time');
    expect(masked.fields[0].label).toBe(timeAsk.fields[0].label);
    expect(masked.fields[0].required).toBe(timeAsk.fields[0].required);
    expect(masked.fields[0].allowUnknown).toBe(timeAsk.fields[0].allowUnknown);
  });

  it('opens AT the stored value when unlocked (ASTRAL-138 unchanged)', () => {
    expect(maskedInputRequest(timeAsk, true).fields[0].value).toBe('00:20');
  });

  it('hides the birth PLACE pre-fill too', () => {
    expect(maskedInputRequest(placeAsk, false).fields[0].value).toBeUndefined();
  });

  it('does not touch a partner field’s pre-fill', () => {
    const req = {
      type: 'input_request', ask: 'field_correction', reason: '',
      fields: [{ key: 'person2_tob', kind: 'time', label: "Their birth time", value: '07:15' }],
    };
    expect(maskedInputRequest(req, false).fields[0].value).toBe('07:15');
  });

  it('is a no-op on an ask with no pre-filled locked field', () => {
    const req = parseInputRequest({
      type: 'input_request', ask: 'required_slots_missing', reason: '',
      fields: [{ key: 'dob', kind: 'date', label: 'Date of birth', required: true, allow_unknown: false }],
    })! as InputRequestPayload;
    expect(maskedInputRequest(req, false)).toBe(req);
  });

  it('says so, rather than letting a blank picker look broken', () => {
    expect(CORRECTING_WHILE_HIDDEN).toContain('hidden');
    expect(CORRECTING_WHILE_HIDDEN).toContain('replaces it');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 4 — the gate: device authentication only, and no fallback
// ══════════════════════════════════════════════════════════════════════════

describe('the reveal gate', () => {
  it('is available with a passcode enrolled (SECRET) and with biometrics', () => {
    expect(revealGate({ capability: true, moduleAvailable: true, enrolledLevel: 1 }))
      .toEqual({ kind: 'available' });
    expect(revealGate({ capability: true, moduleAvailable: true, enrolledLevel: 3 }))
      .toEqual({ kind: 'available' });
  });

  it('NEVER falls back to showing when no screen lock is enrolled', () => {
    const gate = revealGate({ capability: true, moduleAvailable: true, enrolledLevel: 0 });
    expect(gate.kind).toBe('absent');
    expect(gate).toMatchObject({ reason: 'no_screen_lock', sentence: NO_SCREEN_LOCK });
    expect(NO_SCREEN_LOCK).toContain('Set a screen lock');
  });

  it('removes the control on a binary without the native module, and says why', () => {
    const gate = revealGate({ capability: true, moduleAvailable: false, enrolledLevel: 3 });
    expect(gate).toEqual({
      kind: 'absent', reason: 'no_native_module', sentence: NEEDS_NEW_BUILD,
    });
    expect(NEEDS_NEW_BUILD).toContain('next version');
  });

  it('removes the control with no sentence when the capability is off', () => {
    expect(revealGate({ capability: false, moduleAvailable: true, enrolledLevel: 3 }))
      .toEqual({ kind: 'absent', reason: 'capability_off', sentence: '' });
  });

  it('shows nothing at all while the probe is still out', () => {
    expect(revealGate({ capability: true, moduleAvailable: true, enrolledLevel: null }))
      .toEqual({ kind: 'probing' });
  });

  it('is available for no other combination — property over the whole space', () => {
    for (const capability of [true, false]) {
      for (const moduleAvailable of [true, false]) {
        for (const enrolledLevel of [null, 0, 1, 2, 3]) {
          const gate = revealGate({ capability, moduleAvailable, enrolledLevel });
          const shouldBeAvailable =
            capability && moduleAvailable && enrolledLevel !== null && enrolledLevel > 0;
          expect(gate.kind === 'available').toBe(shouldBeAvailable);
        }
      }
    }
  });

  it('names a refusal rather than collapsing them all into "try again"', () => {
    expect(revealFailure('user_cancel')).toBe('Left hidden.');
    expect(revealFailure('lockout')).toContain('passcode');
    expect(revealFailure('not_enrolled')).toBe(NO_SCREEN_LOCK);
    expect(revealFailure('authentication_failed')).toContain('authentication_failed');
    expect(revealFailure(null)).toContain('stayed hidden');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 5 — the unlock: in memory, and it expires
// ══════════════════════════════════════════════════════════════════════════

describe('the unlock state machine', () => {
  const T0 = 1_758_000_000_000;

  it('starts locked', () => {
    expect(LOCKED.unlockedAt).toBeNull();
    expect(isRevealed(LOCKED, T0)).toBe(false);
  });

  it('a successful device authentication reveals', () => {
    const s = reduce(LOCKED, { type: 'unlocked', at: T0 });
    expect(isRevealed(s, T0)).toBe(true);
  });

  it('re-locks after 60 seconds, to the millisecond', () => {
    const s = reduce(LOCKED, { type: 'unlocked', at: T0 });
    expect(REVEAL_WINDOW_MS).toBe(60_000);
    expect(isRevealed(s, T0 + REVEAL_WINDOW_MS - 1)).toBe(true);
    expect(isRevealed(s, T0 + REVEAL_WINDOW_MS)).toBe(false);
    expect(msUntilRelock(s, T0 + 20_000)).toBe(40_000);
    expect(msUntilRelock(s, T0 + REVEAL_WINDOW_MS + 5)).toBe(0);
  });

  it('re-locks when the app goes to the background (so the switcher snapshot is masked)', () => {
    const s = reduce(LOCKED, { type: 'unlocked', at: T0 });
    const after = reduce(s, { type: 'app_backgrounded' });
    expect(after).toEqual(LOCKED);
    expect(isRevealed(after, T0 + 1)).toBe(false);
  });

  it('re-locks on leaving the screen, and on Hide', () => {
    const s = reduce(LOCKED, { type: 'unlocked', at: T0 });
    expect(reduce(s, { type: 'left_screen' })).toEqual(LOCKED);
    expect(reduce(s, { type: 'hide' })).toEqual(LOCKED);
  });

  it('a tick past the window clears the timestamp; one inside it does not', () => {
    const s = reduce(LOCKED, { type: 'unlocked', at: T0 });
    expect(reduce(s, { type: 'tick', now: T0 + 30_000 })).toBe(s);
    expect(reduce(s, { type: 'tick', now: T0 + 60_001 })).toEqual(LOCKED);
  });

  it('a clock that moved backwards reads as LOCKED, not as revealed forever', () => {
    const s = reduce(LOCKED, { type: 'unlocked', at: T0 });
    expect(isRevealed(s, T0 - 1)).toBe(false);
  });

  it('a second unlock restarts the window rather than extending the first', () => {
    const first = reduce(LOCKED, { type: 'unlocked', at: T0 });
    const second = reduce(first, { type: 'unlocked', at: T0 + 50_000 });
    expect(isRevealed(second, T0 + 100_000)).toBe(true);
    expect(isRevealed(second, T0 + 110_001)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 6 — the outcome banner: the engine's receipt names the new value (F345)
// ══════════════════════════════════════════════════════════════════════════

describe('the correction receipt on Profile', () => {
  // VERBATIM from `graph.py::_correction_outcome_line` — a deterministic
  // sentence, no model, and it states the value the mask exists to hide.
  const ENGINE_TIME =
    'Your birth time is now **15:20**. That leaves your chart and 1 saved '
    + 'match to be recomputed — which happens the next time you ask for a '
    + 'reading, not quietly behind your back.';
  const ENGINE_PLACE =
    'Your birth place is now **Nagpur, India**. That leaves your chart and '
    + 'the coordinates it was cast from to be recomputed.';

  it('does NOT draw the engine’s value while locked', () => {
    const shown = outcomeBanner({
      engineSentence: ENGINE_TIME, failed: false,
      field: 'time_of_birth', revealed: false,
    });
    expect(shown).toBe('Your birth time was updated.');
    expect(shown).not.toContain('15:20');
    expect(shown).not.toMatch(/\d/);
  });

  it('is keyed by the FIELD, not by the engine’s words', () => {
    // Same sentence, a different field: the banner follows the field the
    // user was sent to correct. Nothing here reads the prose.
    expect(outcomeBanner({
      engineSentence: ENGINE_TIME, failed: false,
      field: 'date_of_birth', revealed: false,
    })).toBe('Your date of birth was updated.');
    expect(outcomeBanner({
      engineSentence: ENGINE_PLACE, failed: false,
      field: 'place_of_birth', revealed: false,
    })).toBe('Your birth place was updated.');
  });

  it('draws the engine’s sentence verbatim when unlocked', () => {
    expect(outcomeBanner({
      engineSentence: ENGINE_TIME, failed: false,
      field: 'time_of_birth', revealed: true,
    })).toBe(ENGINE_TIME);
  });

  it('a FAILED edit never reads as a success just because it is hidden', () => {
    const shown = outcomeBanner({
      engineSentence: 'That value was not accepted: 25:71 is not a time.',
      failed: true, field: 'time_of_birth', revealed: false,
    });
    expect(shown).toBe('Your birth time was not updated — nothing changed.');
    expect(shown).not.toContain('25:71');
  });

  it('falls back to "birth details" when the field did not travel', () => {
    expect(outcomeBanner({
      engineSentence: ENGINE_TIME, failed: false, field: null, revealed: false,
    })).toBe('Your birth details were updated.');
    expect(outcomeBanner({
      engineSentence: ENGINE_TIME, failed: true, field: undefined, revealed: false,
    })).toBe('Your birth details were not updated — nothing changed.');
  });

  it('says nothing when the engine said nothing', () => {
    expect(outcomeBanner({
      engineSentence: '', failed: false, field: 'time_of_birth', revealed: false,
    })).toBe('');
    expect(outcomeBanner({
      engineSentence: '   ', failed: true, field: null, revealed: false,
    })).toBe('');
  });

  it('leaves a non-birth outcome alone', () => {
    // The store is generic — the add-a-member flow reports through it too —
    // and masking a sentence about something else would hide information
    // for no reason.
    const kept = 'Aarav is on your list.';
    expect(outcomeBanner({
      engineSentence: kept, failed: false, field: 'person_name', revealed: false,
    })).toBe(kept);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 7 — the DASHA TABLES, which start on the birth date (Role-3, L1/L2/L6)
// ══════════════════════════════════════════════════════════════════════════

describe('a Vimshottari table is anchored at birth', () => {
  it('the premise, asserted against the engine’s own artifacts', () => {
    // Everything below only matters because this is true. If a future
    // engine stops anchoring the table at birth, this goes red first and
    // the masks below become unnecessary rather than silently wrong.
    expect(CHART!.dasha_periods?.[0]?.start_date).toBe(CHART!.birth_data!.date_of_birth);
    expect(TIMELINE.span!.start).toBe(CHART!.birth_data!.date_of_birth);
    expect(TIMELINE.dasha?.periods?.[0]?.start_date).toBe(TIMELINE.span!.start);
    expect(TIMELINE.dasha?.sub_periods?.[0]?.start_date).toBe(TIMELINE.span!.start);
  });
});

describe('the chart screen’s Dasha tab', () => {
  it('hides the first period’s START and nothing else', () => {
    const masked = maskedDashaRows(CHART, false);
    const plain = dashaRows(CHART);
    expect(masked[0].start).toBe(MASKED_VALUE);
    // the END of that period is not a birth fact and stays
    expect(masked[0].end).toBe(plain[0].end);
    expect(masked[0].planet).toBe(plain[0].planet);
    expect(masked[0].current).toBe(plain[0].current);
    // …and every later row is untouched
    expect(masked.slice(1)).toEqual(plain.slice(1));
    expect(masked).toHaveLength(plain.length);
  });

  it('leaves the birth date nowhere in the table', () => {
    assertNothingLeaks(maskedDashaRows(CHART, false).map((r) => r.start));
  });

  it('is verbatim when unlocked', () => {
    expect(maskedDashaRows(CHART, true)).toEqual(dashaRows(CHART));
  });

  it('keeps the React key — a key is not rendered and not spoken', () => {
    // Changing it would remount every row on unlock for no gain.
    expect(maskedDashaRows(CHART, false)[0].id).toBe(dashaRows(CHART)[0].id);
  });
});

describe('the Timeline, whose default year is "All"', () => {
  const firstRow = (revealed: boolean) =>
    maskedTimelineRows(TIMELINE, null, revealed)
      .find((r) => r.kind === 'dasha' && r.startYear === 1989)!;

  it('hides the birth-anchored start in the row a reader SEES', () => {
    const row = firstRow(false);
    expect(row.range.startsWith(MASKED_VALUE)).toBe(true);
    expect(row.range).toContain('→');
    assertNothingLeaks(row.range);
  });

  it('hides it in the band’s range — which is also its SPOKEN label', () => {
    // `timeline.tsx` builds `accessibilityLabel={`${band.planet} mahadasha,
    // ${band.range}`}`, so an unmasked range is read aloud by VoiceOver —
    // the one leak a screenshot cannot catch.
    const axis = maskedDashaAxis(TIMELINE, false)!;
    expect(axis.bands[0].range.startsWith(MASKED_VALUE)).toBe(true);
    assertNothingLeaks(axis.bands.map((b) => b.range));
    expect(`${axis.bands[0].planet} mahadasha, ${axis.bands[0].range}`)
      .not.toMatch(/1989/);
  });

  it('hides it in the nested antardashas of the first mahadasha', () => {
    const nested = maskedAntardashaBands(TIMELINE, 0, false);
    expect(nested.length).toBeGreaterThan(0);
    expect(nested[0].range.startsWith(MASKED_VALUE)).toBe(true);
    assertNothingLeaks(nested.map((b) => b.range));
  });

  it('touches no transit window and no later period', () => {
    const masked = maskedTimelineRows(TIMELINE, null, false);
    const plain = timelineRows(TIMELINE, null);
    expect(masked).toHaveLength(plain.length);
    const changed = masked.filter((r, i) => r.range !== plain[i].range);
    // exactly the rows that START at the anchor, and no others
    for (const row of changed) expect(row.startYear).toBe(1989);
    expect(changed.length).toBeGreaterThan(0);
    for (const row of masked.filter((r) => r.kind === 'transit')) {
      expect(row.range).not.toContain(MASKED_VALUE);
    }
  });

  it('is verbatim when unlocked', () => {
    expect(maskedTimelineRows(TIMELINE, null, true)).toEqual(timelineRows(TIMELINE, null));
    expect(maskedDashaAxis(TIMELINE, true)).toEqual(dashaAxis(TIMELINE));
  });

  it('the YEAR pills are left alone — a year is not an exact date', () => {
    // The first pill IS the birth year, and the owner's rule is "exact date
    // and time". A list of years starting at the birth year reveals the
    // year and nothing finer, so it stays; hiding it would remove the
    // filter's first decade for no gain in secrecy.
    expect(TIMELINE.years![0]).toBe(1989);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 8 — the birth PLACE, named on Home and on a day (Role-3, L5)
// ══════════════════════════════════════════════════════════════════════════

describe('the place a day was scored for', () => {
  // Two synthetic places: the point is the BASIS, not the name.
  const birth = { name: 'Nagpur, India', basis: 'birth_place' };
  const current = { name: 'Pune, India', basis: 'current_place' };

  it('names no city when the engine says it is the birth place', () => {
    expect(maskedPlaceName(birth, false)).toBe('your birth place');
  });

  it('leaves the city the USER set — it is not a birth fact', () => {
    expect(maskedPlaceName(current, false)).toBe(current.name);
  });

  it('decides from the payload’s own flag, never from the name', () => {
    // Same city, two bases: only the one the engine calls the birth place
    // is hidden. A string comparison would have hidden both, or neither.
    expect(maskedPlaceName({ name: 'X', basis: 'birth_place' }, false)).toBe('your birth place');
    expect(maskedPlaceName({ name: 'X', basis: 'device' }, false)).toBe('X');
  });

  it('is verbatim when unlocked, and null when there is no place', () => {
    expect(maskedPlaceName(birth, true)).toBe(birth.name);
    expect(maskedPlaceName(null, false)).toBeNull();
    expect(maskedPlaceName({ name: '  ', basis: 'birth_place' }, true)).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 9 — the ASSISTANT's correction receipt in the transcript (Role-3, L4)
// ══════════════════════════════════════════════════════════════════════════

describe('the engine’s receipt, which is a permanent bot bubble', () => {
  const RECEIPT =
    'Your birth time is now **15:20**. That leaves your chart and 1 saved '
    + 'match to be recomputed.';
  const correctionAnswer = (key: string, value: string) =>
    `Birth time: x\n\n\`\`\`input_response\n${JSON.stringify({
      type: 'input_response', ask: 'field_correction', echo: 'x',
      values: { [key]: value },
    })}\n\`\`\``;

  it('is replaced while locked, and names the FIELD from the carrier', () => {
    const shown = maskedAssistantText({
      message: RECEIPT, previous: correctionAnswer('tob', '15:20'), revealed: false,
    });
    expect(shown).toBe(
      'Your birth time was changed or left as it was — unlock to read the details.',
    );
    expect(shown).not.toContain('15:20');
  });

  it('does not CLAIM a success it cannot see', () => {
    // A refusal (INV-4) arrives as words in the same reply and in the same
    // shape, so nothing structural separates them. Saying less is the only
    // honest option here; the Profile banner can say "was updated" because
    // the edit screen told it whether the turn failed.
    const shown = maskedAssistantText({
      message: 'That value was not accepted: 25:71 is not a time.',
      previous: correctionAnswer('tob', '25:71'), revealed: false,
    })!;
    expect(shown).toContain('or left as it was');
    expect(shown).not.toContain('25:71');
  });

  it('keys off the carrier’s field: date, time and place read differently', () => {
    expect(maskedAssistantText({
      message: RECEIPT, previous: correctionAnswer('dob', '1991-03-07'), revealed: false,
    })).toContain('date of birth');
    expect(maskedAssistantText({
      message: RECEIPT, previous: correctionAnswer('pob', 'Nagpur'), revealed: false,
    })).toContain('birth place');
    expect(maskedAssistantText({
      message: RECEIPT, previous: correctionAnswer('person1_tob', '15:20'), revealed: false,
    })).toContain('birth time');
  });

  it('leaves every other bubble ALONE — undefined means "draw it as before"', () => {
    // no previous turn at all
    expect(maskedAssistantText({ message: RECEIPT, previous: undefined, revealed: false }))
      .toBeUndefined();
    // a previous turn that is ordinary prose, even prose about a birth time
    expect(maskedAssistantText({
      message: RECEIPT, previous: 'please correct my birth time', revealed: false,
    })).toBeUndefined();
    // a correction answer for SOMEONE ELSE
    expect(maskedAssistantText({
      message: RECEIPT, previous: correctionAnswer('person2_tob', '07:15'), revealed: false,
    })).toBeUndefined();
    // a birth-details answer that is NOT a correction (the establish flow)
    const establish = `x\n\n\`\`\`input_response\n${JSON.stringify({
      type: 'input_response', ask: 'required_slots_missing', echo: 'x',
      values: { tob: '15:20' },
    })}\n\`\`\``;
    expect(maskedAssistantText({ message: RECEIPT, previous: establish, revealed: false }))
      .toBeUndefined();
    // an empty assistant bubble
    expect(maskedAssistantText({
      message: '  ', previous: correctionAnswer('tob', '15:20'), revealed: false,
    })).toBeUndefined();
  });

  it('is verbatim when unlocked', () => {
    expect(maskedAssistantText({
      message: RECEIPT, previous: correctionAnswer('tob', '15:20'), revealed: true,
    })).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 10 — Home's "Your periods now" (Role-3's residual, ruled UNCONDITIONAL)
// ══════════════════════════════════════════════════════════════════════════

describe('the running periods on Home', () => {
  it('drops BOTH starts while locked and reads "until <end>"', () => {
    const masked = maskedDashaLines(CARD, false);
    const plain = dashaLines(CARD);
    expect(masked).toHaveLength(plain.length);
    expect(masked.length).toBeGreaterThan(1);
    for (const line of masked) {
      expect(line.value).toContain('· until ');
      expect(line.value.split('until ')).toHaveLength(2);
    }
    expect(masked[0].value).toBe('Rahu · until 29 Jan 2041');
    expect(masked[1].value).toBe('Jupiter · until 6 Mar 2028');
  });

  it('is UNCONDITIONAL — no clause asks which period this is', () => {
    // The card carries no index and no birth date, so any condition would
    // be the client guessing (doctrine 9). The start goes for everyone.
    const starts = dashaLines(CARD).map((l) => l.value.split(' · ')[1].split(' →')[0]);
    for (const start of starts) {
      expect(JSON.stringify(maskedDashaLines(CARD, false))).not.toContain(start);
    }
  });

  it('keeps the planet and the label — the card still says something', () => {
    const masked = maskedDashaLines(CARD, false);
    expect(masked.map((l) => l.label)).toEqual(['Mahadasha', 'Antardasha']);
    expect(masked[0].value.startsWith('Rahu')).toBe(true);
  });

  it('is verbatim when unlocked', () => {
    expect(maskedDashaLines(CARD, true)).toEqual(dashaLines(CARD));
  });

  it('leaves a line alone when the card cannot supply an end date', () => {
    // Never a sentence built from a missing value: no end, no rewrite.
    const noEnd = { ...CARD, dasha: { mahadasha: { planet: 'Rahu', start_date: '2023-01-29' } } };
    expect(maskedDashaLines(noEnd as typeof CARD, false))
      .toEqual(dashaLines(noEnd as typeof CARD));
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 11 — the three small ones (Role-3 NEW-3 / NEW-5)
// ══════════════════════════════════════════════════════════════════════════

describe('a place whose basis the card does not state', () => {
  it('FAILS CLOSED — "we could not tell" is not a reason to print a city', () => {
    expect(maskedPlaceName({ name: 'Nagpur, India' }, false)).toBe('your birth place');
    expect(maskedPlaceName({ name: 'Nagpur, India', basis: null }, false)).toBe('your birth place');
    expect(maskedPlaceName({ name: 'Nagpur, India', basis: '  ' }, false)).toBe('your birth place');
  });

  it('…and still says nothing at all when there is no place', () => {
    expect(maskedPlaceName({ name: '' }, false)).toBeNull();
    expect(maskedPlaceName(undefined, false)).toBeNull();
  });

  it('is verbatim when unlocked, basis or no basis', () => {
    expect(maskedPlaceName({ name: 'Nagpur, India' }, true)).toBe('Nagpur, India');
  });
});

describe('an outcome that is not about the owner’s record', () => {
  it('keeps the ENGINE’s words for the add-a-member flow', () => {
    // `member_add` is not a locked fact, so the banner does not rewrite it —
    // otherwise saving somebody else read as "Your birth details were
    // updated." about the owner (Role-3 NEW-5).
    const engine = 'Aarav is on your list, with their chart cast.';
    expect(outcomeBanner({
      engineSentence: engine, failed: false, field: 'member_add', revealed: false,
    })).toBe(engine);
  });

  it('…and a NULL field still falls to the owner’s generic sentence', () => {
    // The fallback is unchanged; what changed is that the member flow no
    // longer reaches it.
    expect(outcomeBanner({
      engineSentence: 'x', failed: false, field: null, revealed: false,
    })).toBe('Your birth details were updated.');
  });
});
