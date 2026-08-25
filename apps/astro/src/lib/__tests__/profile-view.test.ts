/**
 * docs/49 ASTRAL-136/137/138 — the Profile screen's rules, tested where they
 * live: in the pure view model, not in a screenshot.
 *
 * Relative imports on purpose (see `settings-rows.test.ts`): the root jest
 * project maps `@/*` to the WEB app's `src`.
 *
 * The fixtures are shaped like `services/people/chart.py`'s actual output —
 * in particular a time-less chart has NO `lagna` key rather than a null one,
 * because `_hide()` removes what the register names. A fixture that nulled
 * them instead would let a `—` in the lagna row pass this file.
 */

import type { ChartSummary, EditImpact, PersonView } from '../people-shapes';
import {
  PLACE_EDIT_BLOCKED,
  chartIsReadable,
  chartLines,
  chartState,
  editDisclosure,
  factRows,
  frameLine,
  provenancePhrase,
  registerTitle,
  shouldRecordOffer,
  timeAskState,
  undeterminedNotes,
} from '../profile-view';

const TIMED_CHART: ChartSummary = {
  status: 'fresh',
  computed_at: '2026-08-24T10:12:00+00:00',
  time_known: true,
  zodiac_mode: 'sidereal',
  ayanamsa: 'lahiri',
  house_system: 'whole sign',
  moon_rashi: 'Vrishabha',
  sun_rashi: 'Mesha',
  nakshatra: 'Rohini',
  nakshatra_pada: 2,
  lagna: 'Kanya',
  lagna_degree: 12.4,
  houses: 12,
  mahadasha: { planet: 'Chandra', start_date: '2020-01-01', end_date: '2030-01-01' },
  antardasha: { planet: 'Mangala', start_date: '2026-01-01', end_date: '2027-01-01' },
  undetermined: [],
};

/** What `chart.py` returns when the birth time is not known: the four
 *  register entries, and the fields they name simply GONE. */
const TIMELESS_CHART: ChartSummary = {
  status: 'fresh',
  computed_at: '2026-08-24T10:12:00+00:00',
  time_known: false,
  zodiac_mode: 'sidereal',
  ayanamsa: 'lahiri',
  house_system: 'whole sign',
  moon_rashi: 'Vrishabha',
  sun_rashi: 'Mesha',
  nakshatra: 'Rohini',
  undetermined: [
    { field: 'lagna', reason: 'the Lagna moves a full rashi roughly every two hours', alternatives: [], unlocked_by: 'time_of_birth' },
    { field: 'houses', reason: 'the bhavas are counted from the Lagna', alternatives: [], unlocked_by: 'time_of_birth' },
    { field: 'nakshatra_pada', reason: 'a pada is a quarter of a nakshatra', alternatives: [], unlocked_by: 'time_of_birth' },
    { field: 'dasha', reason: 'the Vimshottari sequence is read from the Moon', alternatives: [], unlocked_by: 'time_of_birth' },
  ],
};

function person(over: Partial<PersonView> = {}): PersonView {
  return {
    id: 'self',
    relation: 'self',
    display_name: 'Ravi',
    source_label: 'chat',
    favourite: false,
    tob_known: true,
    birth_facts: {
      date_of_birth: { value: '1989-12-10', provenance: 'stated_by_user', recorded_at: '2026-08-24T09:00:00+00:00' },
      time_of_birth: { value: '14:35', provenance: 'stated_by_user', recorded_at: '2026-08-24T09:00:00+00:00' },
      place_of_birth: { value: 'Chennai', provenance: 'seeded_from_memory', recorded_at: '2026-08-20T09:00:00+00:00' },
    },
    created_at: '2026-08-20T09:00:00+00:00',
    updated_at: '2026-08-24T09:00:00+00:00',
    chart: TIMED_CHART,
    ...over,
  };
}

describe('ASTRAL-35 — provenance is said, and "you told us" is never the default', () => {
  it('says where each fact came from, with the date', () => {
    const rows = factRows(person());
    expect(rows.map((r) => `${r.label}: ${r.value} (${r.provenance})`)).toEqual([
      'Date of birth: 10 Dec 1989 (from your chat, 24 Aug 2026)',
      'Time of birth: 14:35 (from your chat, 24 Aug 2026)',
      'Place of birth: Chennai (from your saved profile, 20 Aug 2026)',
    ]);
  });

  it('distinguishes every value in the closed vocabulary', () => {
    const phrases = ['stated_by_user', 'seeded_from_memory', 'geocoded', 'parsed_from_page', 'parsed_from_biodata', 'unattributed_legacy']
      .map((p) => provenancePhrase({ value: 'x', provenance: p, recorded_at: '' }));
    expect(new Set(phrases).size).toBe(phrases.length);
  });

  it('an unknown provenance never reads as something the user said', () => {
    const unknown = provenancePhrase({ value: 'x', provenance: 'imported_from_somewhere', recorded_at: '' });
    expect(unknown).toBe(provenancePhrase({ value: 'x', provenance: 'unattributed_legacy', recorded_at: '' }));
    expect(unknown).not.toContain('your chat');
  });

  it('omits a fact the store does not hold rather than showing a blank row', () => {
    const p = person();
    delete p.birth_facts.time_of_birth;
    expect(factRows(p).map((r) => r.key)).toEqual(['date_of_birth', 'place_of_birth']);
  });
});

describe('§0d F45 — the birth place has no edit control, and says why', () => {
  it('offers the correction flow for the date and the time only', () => {
    const rows = factRows(person());
    expect(rows.filter((r) => r.editable).map((r) => r.key)).toEqual([
      'date_of_birth',
      'time_of_birth',
    ]);
    expect(rows.find((r) => r.key === 'place_of_birth')?.notEditableBecause).toBe(PLACE_EDIT_BLOCKED);
  });
});

describe('ASTRAL-137 — a chart with no birth time', () => {
  it('shows no lagna row, no pada and no dasha — because none arrived', () => {
    const keys = chartLines(TIMELESS_CHART).map((l) => l.key);
    expect(keys).toEqual(['moon_rashi', 'sun_rashi', 'nakshatra']);
    expect(keys).not.toContain('lagna');
    expect(keys).not.toContain('dasha');
    // …and no placeholder anywhere: ASTRAL-137's "no `—` in the lagna row".
    expect(chartLines(TIMELESS_CHART).map((l) => l.value).join(' ')).not.toContain('—');
    expect(chartLines(TIMELESS_CHART).find((l) => l.key === 'nakshatra')?.value).toBe('Rohini');
  });

  it('still shows the rashi and nakshatra work — honest AND useful', () => {
    expect(chartLines(TIMELESS_CHART)).not.toHaveLength(0);
  });

  it('renders the register\'s own reason for every hidden field', () => {
    const notes = undeterminedNotes(TIMELESS_CHART);
    expect(notes.map((n) => n.title)).toEqual([
      'Lagna', 'The twelve bhavas', 'Nakshatra pada', 'Dasha periods',
    ]);
    expect(notes[0].reason).toBe(TIMELESS_CHART.undetermined![0].reason);
  });

  it('the hidden set FOLLOWS the register — mutate it and the screen changes', () => {
    // The row's own obligation: the screen may not keep its own list of
    // field names. Here the register loses `dasha` and the chart regains the
    // period line, with no change to this module.
    const narrowed: ChartSummary = {
      ...TIMELESS_CHART,
      mahadasha: { planet: 'Chandra' },
      undetermined: TIMELESS_CHART.undetermined!.filter((u) => u.field !== 'dasha'),
    };
    expect(chartLines(narrowed).map((l) => l.key)).toContain('dasha');
    expect(undeterminedNotes(narrowed).map((n) => n.field)).not.toContain('dasha');
  });

  it('a register class this build has never heard of is still rendered', () => {
    expect(registerTitle('d9_divisional')).toBe('D9 Divisional');
    const notes = undeterminedNotes({
      ...TIMELESS_CHART,
      undetermined: [{ field: 'd9_divisional', reason: 'because', alternatives: ['a', 'b'], unlocked_by: 'time_of_birth' }],
    });
    expect(notes).toHaveLength(1);
    expect(notes[0].alternatives).toEqual(['a', 'b']);
  });

  it('offers the birth-time ask once, and states the fact for ever after', () => {
    expect(timeAskState({ tob_known: false }, false)).toBe('offer');
    expect(timeAskState({ tob_known: false }, true)).toBe('state_only');
    expect(timeAskState({ tob_known: true }, false)).toBe('none');
  });

  it('spends the ask on SHOWING it, not on tapping it', () => {
    // The row's words: "the ask renders once and not on re-open". Recording
    // it at tap time would leave it rendering on every open, which is the
    // second ask the row forbids.
    expect(shouldRecordOffer('offer')).toBe(true);
    expect(shouldRecordOffer('state_only')).toBe(false);
    expect(shouldRecordOffer('none')).toBe(false);
  });
});

describe('ASTRAL-136 / ASTRAL-118 — the frame is named, and an unstamped chart is not drawn', () => {
  it('names zodiac mode, ayanamsa and house system', () => {
    expect(frameLine(TIMED_CHART)).toBe('Sidereal · Lahiri · Whole Sign');
  });

  it('NAMES the house system the artifact stores as a code', () => {
    // Measured on the simulator: a stored chart carries `house_system: "W"`
    // and `ayanamsa: "LAHIRI"`. "Sidereal · LAHIRI · W" names the frame to
    // nobody, which is ASTRAL-118 unmet by a rendering detail.
    expect(frameLine({ ...TIMED_CHART, ayanamsa: 'LAHIRI', house_system: 'W' }))
      .toBe('Sidereal · Lahiri · Whole Sign');
  });

  it('prints a frame value it does not recognise AS IT IS', () => {
    // An unknown frame stated opaquely is honest; a guessed one is the
    // failure ASTRAL-118 exists to prevent.
    expect(frameLine({ ...TIMED_CHART, house_system: 'Z' })).toBe('Sidereal · Lahiri · Z');
  });

  it('says nothing rather than half a frame', () => {
    expect(frameLine({ ...TIMED_CHART, ayanamsa: undefined })).toBeNull();
  });

  it('an unstamped chart renders the honest error state, not values', () => {
    const state = chartState({
      status: 'unstamped',
      computed_at: '2026-08-01T00:00:00+00:00',
      missing_stamp: ['ayanamsa'],
      reason: 'this chart does not record the frame it was cast in, so its values cannot be shown',
    });
    expect(state.kind).toBe('unreadable');
    expect(chartIsReadable(state)).toBe(false);
    expect(state.sentence).toContain('frame it was cast in');
  });

  it('a status this build does not know is refused, not drawn', () => {
    const state = chartState({ status: 'quantum', computed_at: null });
    expect(chartIsReadable(state)).toBe(false);
    expect(state.sentence).toContain('quantum');
  });
});

describe('AMB-31(a) — a stale chart is shown stale, with the date, and never recomputed', () => {
  it('states the date it was cast and that opening the screen recomputes nothing', () => {
    const state = chartState({ ...TIMED_CHART, status: 'stale' });
    expect(state.kind).toBe('aged');
    expect(chartIsReadable(state)).toBe(true);
    expect(state.sentence).toContain('24 Aug 2026');
    expect(state.sentence).toContain('does not recompute');
  });

  it('distinguishes a user correction from any other change', () => {
    expect(chartState({ ...TIMED_CHART, status: 'corrected_stale' }).sentence).toContain('you corrected');
  });

  it('an unprovable chart says it cannot be checked, rather than claiming fresh', () => {
    const state = chartState({ ...TIMED_CHART, status: 'unprovable' });
    expect(state.sentence).toContain('cannot be checked');
    expect(state.kind).not.toBe('fresh');
  });

  it('no chart at all is a state with a sentence, not an empty card', () => {
    const state = chartState({ status: 'absent', reason: 'no chart has been computed for this person yet' });
    expect(state.kind).toBe('absent');
    expect(state.sentence).toBeTruthy();
  });

  it('a chart with no recorded date says so instead of inventing one', () => {
    expect(chartState({ ...TIMED_CHART, computed_at: null }).sentence).toContain('did not record');
  });
});

describe('ASTRAL-19 — the screen derives nothing', () => {
  it('prints the degree the artifact carries, unrounded', () => {
    expect(chartLines(TIMED_CHART).find((l) => l.key === 'lagna')?.value).toBe('Kanya 12.4°');
  });

  it('prints the periods the artifact carries, without recomputing either', () => {
    expect(chartLines(TIMED_CHART).find((l) => l.key === 'dasha')?.value).toBe('Chandra — Mangala');
    expect(chartLines({ ...TIMED_CHART, antardasha: undefined }).find((l) => l.key === 'dasha')?.value)
      .toBe('Chandra');
  });
});

describe('ASTRAL-138 — the cascade is disclosed from the edges, not from a sentence', () => {
  const impact = (over: Partial<EditImpact>): EditImpact => ({
    field: 'time_of_birth',
    label: 'birth time',
    recomputes_coordinates: false,
    affected: [],
    derived_keys: [],
    ...over,
  });

  it('names the chart and the count of matches', () => {
    expect(editDisclosure(impact({
      affected: [
        { kind: 'chart', person_id: 'self' },
        { kind: 'match', pair_key: 'a__b' },
        { kind: 'match', pair_key: 'a__c' },
        { kind: 'match', pair_key: 'a__d' },
      ],
    }))).toBe('Changing your birth time recomputes your chart and 3 saved matches.');
  });

  it('CHANGES when a dependent artifact is added — the row\'s unit obligation', () => {
    const before = editDisclosure(impact({ affected: [{ kind: 'chart' }] }));
    const after = editDisclosure(impact({ affected: [{ kind: 'chart' }, { kind: 'match', pair_key: 'a__b' }] }));
    expect(after).not.toBe(before);
    expect(after).toContain('1 saved match');
  });

  it('names an affected kind this build has never heard of rather than dropping it', () => {
    expect(editDisclosure(impact({ affected: [{ kind: 'palm_reading' }] }))).toContain('palm_reading');
  });

  it('says plainly when nothing is affected', () => {
    expect(editDisclosure(impact({}))).toContain('recomputes nothing');
  });

  it('names the coordinate recompute a place edit would cause', () => {
    expect(editDisclosure(impact({ label: 'birth place', recomputes_coordinates: true })))
      .toContain('coordinates');
  });

  // The correction TURN's assertions live in `edit-fact.test.ts` now: the
  // sentence stopped being composed from this label when the edit became
  // in-place (docs/49 ASTRAL-138), and the property it was pinning — intent,
  // never a value — is pinned there over the declared constants, together
  // with the engine-side match this file could never see.
});
