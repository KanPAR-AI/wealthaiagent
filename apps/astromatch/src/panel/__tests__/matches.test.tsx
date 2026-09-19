/**
 * The shortlist, compare and the per-match chat, at the panel
 * (docs/73 ASTRAL-339/340/341).
 *
 * Every answer the fake worker gives is a payload CAPTURED FROM THE RUNNING
 * ENGINE (`e2e/capture-matches.mjs`, 2026-09-19) — the three labelled groups
 * with their own sort rules, and the five one-match reads behind them,
 * including a firm-only `/15` and a refusal.
 *
 * The browser walk proves the same three screens against the real backend.
 * What lives here is what is hard to arrange there: a PATCH that fails, a
 * match that has been deleted between the list and the read, and the exact
 * payload the per-match chat hands over.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { App } from '../app';

const FIXTURES = join(__dirname, '..', '..', 'lib', '__tests__', 'fixtures');
const GROUPS = JSON.parse(readFileSync(join(FIXTURES, 'matches-groups.json'), 'utf8'));
const DETAILS = JSON.parse(readFileSync(join(FIXTURES, 'match-details.json'), 'utf8'));

const ROWS: Array<{ pair_key: string; display_name: string; person_id: string }> =
  GROUPS.groups.flatMap((g: { rows: unknown[] }) => g.rows);
/** A row the ENGINE marked with this freshness — both branches exist in the
 *  captured fixture (one fresh, two stale), which is what makes FLAG-1's
 *  cases real rather than theory. */
const rowWith = (freshness: string) =>
  ROWS.find((r) => (r as unknown as { freshness: string }).freshness === freshness) as {
    pair_key: string;
    display_name: string;
    person_id: string;
  };

const rowIn = (key: string) =>
  ROWS.find((r) => GROUPS.groups.find((g: { key: string; rows: Array<{ pair_key: string }> }) =>
    g.key === key && g.rows.some((row) => row.pair_key === r.pair_key),
  )) as { pair_key: string; display_name: string; person_id: string };

let sent: Array<{ type: string; [k: string]: unknown }> = [];
let posted: Array<Record<string, unknown>> = [];
let starStatus = 200;
let listStatus = 200;
let detailStatus: Record<string, number> = {};
let port: { emit: (event: unknown) => void } | null = null;

beforeAll(() => {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      id: 'astromatch-test',
      onMessage: { addListener: () => {}, removeListener: () => {} },
      sendMessage: async (request: { type: string; [k: string]: unknown }) => {
        sent.push(request);
        switch (request.type) {
          case 'auth/state':
            return { ok: true, value: { signedIn: true, identifier: 'walk@local.test' } };
          case 'matches/list':
            return {
              ok: true,
              value: { status: listStatus, body: listStatus === 200 ? GROUPS : null, resetsOn: null },
            };
          case 'matches/detail': {
            const key = String(request.pairKey);
            const status = detailStatus[key] ?? 200;
            return {
              ok: true,
              value: { status, body: status === 200 ? DETAILS[key] : null, resetsOn: null },
            };
          }
          case 'person/star':
            return { ok: true, value: { status: starStatus, body: {}, resetsOn: null } };
          default:
            return { ok: true, value: null };
        }
      },
      connect: () => {
        const listeners: Array<(e: unknown) => void> = [];
        port = { emit: (event: unknown) => listeners.forEach((fn) => fn(event)) };
        return {
          onMessage: { addListener: (fn: (e: unknown) => void) => listeners.push(fn) },
          postMessage: (m: Record<string, unknown>) => posted.push(m),
          disconnect: () => {},
        };
      },
    },
  };
});

beforeEach(() => {
  sent = [];
  posted = [];
  starStatus = 200;
  listStatus = 200;
  detailStatus = {};
  port = null;
});

async function openShortlist() {
  render(<App />);
  fireEvent.click(await screen.findByTestId('shortlist-open'));
  await screen.findByTestId('shortlist');
}

// ── ASTRAL-339 ─────────────────────────────────────────────────────────────

describe('the shortlist is the engine\'s three groups, as sent', () => {
  it('draws every group with the engine\'s own label and sort rule', async () => {
    await openShortlist();
    for (const group of GROUPS.groups) {
      expect(screen.getByTestId(`group-label-${group.key}`).textContent).toBe(group.label);
      expect(screen.getByTestId(`group-rule-${group.key}`).textContent).toBe(group.sort_rule);
    }
  });

  it('keeps the rows in the engine\'s order, inside their own group', async () => {
    await openShortlist();
    for (const group of GROUPS.groups) {
      const section = screen.getByTestId(`group-${group.key}`);
      const drawn = [...section.querySelectorAll('[data-testid^="row-"]')].map((el) =>
        el.getAttribute('data-testid'),
      );
      expect(drawn).toEqual(group.rows.map((r: { pair_key: string }) => `row-${r.pair_key}`));
    }
  });

  /**
   * FLAG-4 — the case above was VACUOUS on this fixture.
   *
   * The engine sends the complete group ordered by score DESCENDING, so a
   * client-side "sort by score, descending" reproduced the fixture's own
   * order and 1131 tests stayed green. This case sends the SAME rows in an
   * order that is not descending — built by PERMUTING the captured payload
   * inside the test, never by hand-editing the file — so a ranking sort is
   * behaviourally visible.
   */
  it('renders an engine order that is NOT descending by score, unchanged', async () => {
    const complete = GROUPS.groups.find((g: { key: string }) => g.key === 'complete');
    const ascending = [...complete.rows].sort(
      (a: { score: { points: number } }, b: { score: { points: number } }) =>
        a.score.points - b.score.points,
    );
    expect(ascending.map((r: { score: { points: number } }) => r.score.points)).not.toEqual(
      complete.rows.map((r: { score: { points: number } }) => r.score.points),
    );
    const original = complete.rows;
    complete.rows = ascending;
    try {
      await openShortlist();
      const section = screen.getByTestId('group-complete');
      const drawn = [...section.querySelectorAll('[data-testid^="row-"]')].map((el) =>
        el.getAttribute('data-testid'),
      );
      expect(drawn).toEqual(ascending.map((r: { pair_key: string }) => `row-${r.pair_key}`));
      // …and the lowest score really is drawn first, which is the property a
      // ranking sort would destroy
      const first = screen.getByTestId(`score-${ascending[0].pair_key}`).textContent ?? '';
      expect(first).toContain(String(ascending[0].score.points));
    } finally {
      complete.rows = original;
    }
  });

  it('no panel file sorts, reverses or ranks anything it renders', () => {
    // The grep half of FLAG-4: a sort that happens to agree with the fixture
    // is invisible behaviourally, so the code says it too.
    const dir = join(__dirname, '..');
    const files = readdirSync(dir)
      .filter((f) => /\.tsx?$/.test(f))
      .filter((f) => statSync(join(dir, f)).isFile());
    expect(files).toContain('matches.tsx');
    for (const file of files) {
      const code = readFileSync(join(dir, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      for (const banned of ['.sort(', '.reverse(', 'toSorted', 'toReversed', 'localeCompare']) {
        expect({ file, banned, found: code.includes(banned) }).toEqual({
          file,
          banned,
          found: false,
        });
      }
    }
  });

  it('never interleaves the two scales, and never ranks across the groups', async () => {
    await openShortlist();
    const body = document.body.textContent ?? '';
    expect(body).not.toContain('%');
    expect(body).not.toMatch(/#\d+ of \d+/);
    expect(body).not.toMatch(/\bbest match\b|\btop match\b|\bwinner\b|\branked\s+\d/i);
    // the firm-only row is not shown out of 36
    const firm = rowIn('firm_only');
    expect(screen.getByTestId(`score-${firm.pair_key}`).textContent).not.toContain('36');
    expect(screen.getByTestId(`score-${firm.pair_key}`).textContent).toContain('need a birth time');
  });

  it('says the groups are on different scales and are NOT ranked against each other', async () => {
    await openShortlist();
    const note = screen.getByTestId('shortlist-scale-note').textContent ?? '';
    expect(note).toContain('different scales');
    expect(note).toContain('not ranked against each other');
  });

  it('blames nobody for a stale row, and gives the date instead (FLAG-2)', async () => {
    await openShortlist();
    const stale = ROWS.find(
      (r) => (r as unknown as { freshness: string }).freshness === 'stale',
    ) as { pair_key: string };
    const said = screen.getByTestId(`freshness-${stale.pair_key}`).textContent ?? '';
    expect(said).toContain('may be out of date');
    expect(said.toLowerCase()).not.toContain('birth detail');
    expect(said.toLowerCase()).not.toContain('birth fact');
    expect(said).toMatch(/\d{1,2} [A-Z][a-z]{2} \d{4}/);
  });

  it('gives a refused match its own row, with the reason and no score', async () => {
    await openShortlist();
    const refused = rowIn('refused');
    expect(screen.getByTestId(`refusal-${refused.pair_key}`).textContent).toContain('score');
    expect(screen.queryByTestId(`score-${refused.pair_key}`)).toBeNull();
  });

  it('reads the list fresh each time, and caches nothing', async () => {
    await openShortlist();
    fireEvent.click(screen.getByText('Back'));
    fireEvent.click(await screen.findByTestId('shortlist-open'));
    await screen.findByTestId('shortlist');
    expect(sent.filter((m) => m.type === 'matches/list')).toHaveLength(2);
  });

  it('says so when the account has no matches yet', async () => {
    const empty = { groups: [], total: 0 };
    const original = GROUPS.groups;
    (GROUPS as { groups: unknown }).groups = empty.groups;
    try {
      await openShortlist().catch(() => undefined);
      expect((await screen.findByTestId('shortlist-empty')).textContent).toContain(
        'No saved matches yet',
      );
    } finally {
      (GROUPS as { groups: unknown }).groups = original;
    }
  });

  it('says so when the read fails, rather than showing an empty list', async () => {
    listStatus = 500;
    render(<App />);
    fireEvent.click(await screen.findByTestId('shortlist-open'));
    expect((await screen.findByTestId('shortlist-failed')).textContent).toBeTruthy();
    expect(screen.queryByTestId('shortlist')).toBeNull();
  });
});

describe('favourite rides the shipped label patch', () => {
  it('sends the person id and the label, and nothing else', async () => {
    await openShortlist();
    const row = ROWS[0];
    fireEvent.click(screen.getByTestId(`star-${row.pair_key}`));
    await waitFor(() => expect(sent.some((m) => m.type === 'person/star')).toBe(true));
    const patch = sent.find((m) => m.type === 'person/star') as unknown as {
      personId: string;
      favourite: boolean;
    };
    expect(patch.personId).toBe(row.person_id);
    expect(patch.favourite).toBe(true);
    expect(Object.keys(patch).sort()).toEqual(['favourite', 'personId', 'type']);
  });

  it('shows the new state at once, and PUTS IT BACK when the engine refuses', async () => {
    starStatus = 500;
    await openShortlist();
    const row = ROWS[0];
    const star = screen.getByTestId(`star-${row.pair_key}`);
    fireEvent.click(star);
    await waitFor(() => expect(screen.getByTestId('shortlist-problem')).toBeTruthy());
    expect(screen.getByTestId('shortlist-problem').textContent).toContain("couldn't change");
    expect(star.getAttribute('aria-pressed')).toBe('false');
  });

  it('stores nothing about the match in the extension', async () => {
    await openShortlist();
    fireEvent.click(screen.getByTestId(`star-${ROWS[0].pair_key}`));
    await waitFor(() => expect(sent.some((m) => m.type === 'person/star')).toBe(true));
    // the panel has no storage door at all — the only messages it sends are
    // the reads and the patch
    expect([...new Set(sent.map((m) => m.type))].sort()).toEqual([
      'auth/state',
      'capture/pending',
      'matches/list',
      'person/star',
      'selection/pending',
    ]);
  });
});

// ── ASTRAL-340 ─────────────────────────────────────────────────────────────

/** Pick every row the fixture has — five, including firm-only and refused. */
async function openCompare() {
  await openShortlist();
  for (const row of ROWS) fireEvent.click(screen.getByTestId(`pick-${row.pair_key}`));
  fireEvent.click(screen.getByTestId('compare-open'));
  await screen.findByTestId('compare');
}

describe('compare is five stored reads side by side, and no verdict about them', () => {
  it('reads each column ONCE and computes nothing', async () => {
    await openCompare();
    const reads = sent.filter((m) => m.type === 'matches/detail');
    expect(reads).toHaveLength(ROWS.length);
    expect(reads.map((m) => m.pairKey)).toEqual(ROWS.map((r) => r.pair_key));
    // no chat, no turn, no model call is made to draw a comparison
    expect(sent.some((m) => m.type === 'match/start')).toBe(false);
    expect(posted).toEqual([]);
  });

  it('shows the columns in the order they were picked, and says so', async () => {
    await openCompare();
    const drawn = [...screen.getByTestId('compare').querySelectorAll('[data-testid^="column-"]')].map(
      (el) => el.getAttribute('data-testid'),
    );
    expect(drawn).toEqual(ROWS.map((r) => `column-${r.pair_key}`));
    expect(screen.getByTestId('compare-order-note').textContent).toContain(
      'in the order you picked them',
    );
  });

  /**
   * FLAG-4, compare half: the case above picks the columns in an order that
   * is ALREADY descending by score, so a ranking sort reproduced it and only
   * the grep could see the mutation. This one picks them the other way
   * round — the refusal first, the biggest score last — so a sort is
   * behaviourally visible.
   */
  it('renders a NON-descending pick order exactly as it was picked', async () => {
    await openShortlist();
    const reversed = [...ROWS].reverse();
    for (const row of reversed) fireEvent.click(screen.getByTestId(`pick-${row.pair_key}`));
    fireEvent.click(screen.getByTestId('compare-open'));
    await screen.findByTestId('compare');
    const drawn = [...screen.getByTestId('compare').querySelectorAll('[data-testid^="column-"]')].map(
      (el) => el.getAttribute('data-testid'),
    );
    expect(drawn).toEqual(reversed.map((r) => `column-${r.pair_key}`));
    // …and the order really is not the descending one, or this proves nothing
    const scored = reversed
      .map((r) => (r as unknown as { score?: { points?: number } }).score?.points)
      .filter((p): p is number => typeof p === 'number');
    expect(scored).not.toEqual([...scored].sort((a, b) => b - a));
    // the first column drawn is the one picked first, whatever its score
    const first = screen.getByTestId(`column-${reversed[0].pair_key}`);
    expect(first).toBeTruthy();
  });

  it('names no winner, no rank and no percentage', async () => {
    await openCompare();
    const body = document.body.textContent ?? '';
    expect(body).not.toContain('%');
    expect(body).toContain('no overall winner');
    expect(body).not.toMatch(/\bbest\b|\bwins\b|\bhighest\b|#1/i);
  });

  it('marks every time-dependent row, and says why it matters here', async () => {
    await openCompare();
    expect(screen.getByTestId('compare-time-note').textContent).toContain('not comparable');
    // the engine's own four time-dependent kootas, from the captured report
    const report = DETAILS[rowIn('complete').pair_key].report;
    const marked = report.kootas.filter((k: { time_dependent: boolean }) => k.time_dependent);
    expect(marked.length).toBeGreaterThan(0);
    for (const koota of marked) {
      expect(screen.getByTestId(`time-dependent-${koota.name}`).textContent).toContain(
        'needs an exact birth time',
      );
    }
  });

  it('draws a pending koota as pending and never as a zero', async () => {
    await openCompare();
    const firm = rowIn('firm_only');
    const report = DETAILS[firm.pair_key].report;
    const pending = report.kootas.filter((k: { pending: boolean }) => k.pending);
    expect(pending.length).toBeGreaterThan(0);
    for (const koota of pending) {
      const cell = screen.getByTestId(`cell-${firm.pair_key}-${koota.name}`);
      expect(cell.textContent).toContain('pending');
      expect(cell.textContent).not.toMatch(/\b0 \//);
    }
  });

  it('keeps the refused match as a COLUMN, with its reason and no numbers', async () => {
    await openCompare();
    const refused = rowIn('refused');
    expect(screen.getByTestId(`column-${refused.pair_key}`)).toBeTruthy();
    expect(screen.getByTestId(`refusal-${refused.pair_key}`).textContent).toContain('score');
    expect(screen.queryByTestId(`total-${refused.pair_key}`)).toBeNull();
    expect(screen.queryByTestId(`firm-${refused.pair_key}`)).toBeNull();
    const report = DETAILS[rowIn('complete').pair_key].report;
    for (const koota of report.kootas) {
      expect(screen.getByTestId(`cell-${refused.pair_key}-${koota.name}`).textContent).toContain(
        'not scored',
      );
    }
  });

  it('carries each column\'s own scale, in the engine\'s words', async () => {
    await openCompare();
    expect(screen.getByTestId(`scale-${rowIn('complete').pair_key}`).textContent).toBe(
      GROUPS.groups.find((g: { key: string }) => g.key === 'complete').label,
    );
    expect(screen.getByTestId(`scale-${rowIn('firm_only').pair_key}`).textContent).toBe(
      GROUPS.groups.find((g: { key: string }) => g.key === 'firm_only').label,
    );
  });

  it('says which match it could not read, rather than silently showing fewer', async () => {
    detailStatus = { [ROWS[1].pair_key]: 404 };
    await openCompare();
    expect(screen.getByTestId('compare-problem').textContent).toContain('no longer');
    expect(screen.queryByTestId(`column-${ROWS[1].pair_key}`)).toBeNull();
  });
});

// ── ASTRAL-341 ─────────────────────────────────────────────────────────────

describe('one chat per saved match, carrying ids', () => {
  it('hands over ids and an opener, with no birth value of any kind', async () => {
    await openShortlist();
    const row = ROWS[0];
    fireEvent.click(screen.getByTestId(`ask-${row.pair_key}`));
    await screen.findByTestId('match-chat-basis');
    expect(posted).toHaveLength(1);
    const handoff = posted[0].handoff as Record<string, unknown>;
    expect(posted[0].type).toBe('match/ask');
    expect(Object.keys(handoff).sort()).toEqual(['opener', 'pairKey', 'personId', 'title']);
    expect(handoff.pairKey).toBe(row.pair_key);
    expect(handoff.personId).toBe(row.person_id);
    const payload = JSON.stringify(posted[0]);
    expect(payload).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(payload).not.toMatch(/\d{1,2}:\d{2}/);
    expect(payload.toLowerCase()).not.toContain('birth');
  });

  it('promises the stored scorecard ONLY on a fresh row', async () => {
    await openShortlist();
    fireEvent.click(screen.getByTestId(`ask-${rowWith('fresh').pair_key}`));
    const basis = await screen.findByTestId('match-chat-basis');
    expect(basis.textContent).toContain('nothing is scored again');
    expect(basis.textContent).toContain('not asked for or sent again');
    // no review screen, no birth-detail form on entry
    expect(screen.queryByTestId('field-dob')).toBeNull();
  });

  it('makes NO such promise on a stale row — the engine would score it again (FLAG-1)', async () => {
    // The false sentence this replaces was printed unconditionally, before
    // any turn returned. `_rehydrate_stored_match` declines on anything not
    // FRESH, so a stale row falls through to `node_synastry`, which casts
    // both charts again and may produce different numbers.
    await openShortlist();
    fireEvent.click(screen.getByTestId(`ask-${rowWith('stale').pair_key}`));
    const basis = await screen.findByTestId('match-chat-basis');
    expect(basis.textContent).not.toContain('nothing is scored again');
    expect(basis.textContent).not.toContain('not asked for or sent again');
    expect(basis.textContent).toContain('may be');
    expect(basis.textContent).toContain('scored again here');
  });

  it('withdraws the promise the moment the turn disproves it', async () => {
    // A FRESH row whose name cue failed: the engine recomputes anyway, and
    // its own progress line says so. The panel must not keep a sentence on
    // screen that the turn just disproved.
    await openShortlist();
    fireEvent.click(screen.getByTestId(`ask-${rowWith('fresh').pair_key}`));
    await screen.findByTestId('match-chat-basis');
    port!.emit({ type: 'delta', text: 'Casting both Kundlis and matching the 36 gunas... 💞\n\n' });
    await waitFor(() =>
      expect(screen.getByTestId('match-chat-basis').textContent).toContain('scored this match again'),
    );
    expect(screen.getByTestId('match-chat-basis').textContent).not.toContain(
      'nothing is scored again',
    );
    // …and the engine's own progress line is NOT hidden: it is the true
    // sentence about what happened.
    expect(screen.getByTestId('match-chat-answer').textContent).toContain('Casting both Kundlis');
  });

  it('says it ONCE at the top over a redrawn scorecard — never the same thing twice', async () => {
    // The reviewer's second point: the replaced header and the short note
    // said the same thing a line apart, because the scorecard sits directly
    // under the header. The header is the one statement; the note is shown
    // only where the header is not the rescored sentence, which under the
    // latch is nowhere in this panel.
    const report = DETAILS[rowIn('complete').pair_key].report;
    await openShortlist();
    fireEvent.click(screen.getByTestId(`ask-${rowWith('stale').pair_key}`));
    await screen.findByTestId('match-chat-basis');
    port!.emit({
      type: 'outcome',
      outcome: {
        kind: 'scorecard',
        report,
        saveOffer: null,
        truncated: false,
        text: 'Casting both Kundlis and matching the 36 gunas... 💞\n\nHere it is.',
      },
    });
    await screen.findByTestId('match-chat-answer');
    const basis = screen.getByTestId('match-chat-basis').textContent ?? '';
    expect(basis).toContain('scored this match again');
    expect(screen.queryByTestId('match-chat-rescored')).toBeNull();
    const body = document.body.textContent ?? '';
    expect((body.match(/can differ from the/g) ?? []).length).toBe(1);
    // …and the engine's own progress line is still there, below
    expect(screen.getByTestId('match-chat-answer').textContent).toContain('Casting both Kundlis');
  });

  it('KEEPS the withdrawal when a second question is asked in the same chat', async () => {
    // The reviewer's probe: `Ask` clears the stream, and `rescored` was
    // derived from the stream alone — so the promise came back over a chat
    // whose scorecard had been computed in it.
    await openShortlist();
    fireEvent.click(screen.getByTestId(`ask-${rowWith('fresh').pair_key}`));
    await screen.findByTestId('match-chat-basis');
    port!.emit({ type: 'chat', chatId: 'chat-9' });
    port!.emit({ type: 'delta', text: 'Casting both Kundlis and matching the 36 gunas... 💞\n\n' });
    await waitFor(() =>
      expect(screen.getByTestId('match-chat-basis').textContent).toContain('scored this match again'),
    );
    port!.emit({ type: 'outcome', outcome: { kind: 'text', text: 'Here it is.', truncated: false } });

    fireEvent.change(await screen.findByTestId('match-chat-ask'), {
      target: { value: 'why is Nadi zero' },
    });
    fireEvent.click(screen.getByTestId('match-chat-send'));
    await waitFor(() => expect(posted).toHaveLength(2));
    const basis = screen.getByTestId('match-chat-basis').textContent ?? '';
    expect(basis).toContain('scored this match again');
    expect(basis).not.toContain('nothing is scored again');
    // …and it is still withdrawn when the second turn answers
    port!.emit({ type: 'outcome', outcome: { kind: 'text', text: 'Because…', truncated: false } });
    await waitFor(() =>
      expect(screen.getByTestId('match-chat-answer').textContent).toContain('Because'),
    );
    expect(screen.getByTestId('match-chat-basis').textContent).toContain('scored this match again');
  });

  it('a NARRATED stored match on a fresh row carries no such note', async () => {
    const report = DETAILS[rowIn('complete').pair_key].report;
    await openShortlist();
    fireEvent.click(screen.getByTestId(`ask-${rowWith('fresh').pair_key}`));
    await screen.findByTestId('match-chat-basis');
    port!.emit({
      type: 'outcome',
      outcome: {
        kind: 'scorecard',
        report,
        saveOffer: null,
        truncated: false,
        text: 'Here is what is on file.',
      },
    });
    await screen.findByTestId('match-chat-answer');
    expect(screen.queryByTestId('match-chat-rescored')).toBeNull();
    expect(screen.getByTestId('match-chat-basis').textContent).toContain('nothing is scored again');
  });

  it('never shows the platform\'s routing banner, streaming or finished', async () => {
    // Found by looking at the walk's screenshot: the streamed text was
    // painted raw, so "[Using astrology_ai agent]" was the whole of what a
    // user saw for the length of a slow turn.
    await openShortlist();
    fireEvent.click(screen.getByTestId(`ask-${ROWS[0].pair_key}`));
    await screen.findByTestId('match-chat-basis');
    port!.emit({ type: 'delta', text: '[Using astrology_ai agent]\n\n' });
    await waitFor(() => expect(document.body.textContent).not.toContain('[Using'));
    port!.emit({ type: 'delta', text: '[Using astrology_ai agent]\n\nNadi scores 0.' });
    await waitFor(() =>
      expect(screen.getByTestId('match-chat-answer').textContent).toContain('Nadi scores 0'),
    );
    expect(document.body.textContent).not.toContain('[Using');
  });

  it('renders the engine\'s own answer, and no scorecard of its own', async () => {
    await openShortlist();
    fireEvent.click(screen.getByTestId(`ask-${ROWS[0].pair_key}`));
    await screen.findByTestId('match-chat-basis');
    port!.emit({ type: 'chat', chatId: 'chat-9' });
    port!.emit({
      type: 'outcome',
      outcome: {
        kind: 'text',
        text: 'Nadi scores 0 because you share a Nadi.',
        truncated: false,
      },
    });
    const answer = await screen.findByTestId('match-chat-answer');
    expect(answer.textContent).toContain('Nadi scores 0');
    expect(document.body.textContent).not.toContain('%');
  });

  it('DRAWS the stored scorecard with the shared component, and hides the engine\'s fallback', async () => {
    // Found by looking at the walk's screenshot: the engine's deterministic
    // prose fallback (ASTRAL-90's `### Kundli Milan` heading and eight-row
    // koota table) was printed as markdown and clipped by a 380 px panel.
    // The scorecard is drawn by the ONE implementation instead, and the
    // fallback rows are hidden under it by the shared pure function.
    const report = DETAILS[rowIn('complete').pair_key].report;
    await openShortlist();
    fireEvent.click(screen.getByTestId(`ask-${ROWS[0].pair_key}`));
    await screen.findByTestId('match-chat-basis');
    port!.emit({
      type: 'outcome',
      outcome: {
        kind: 'scorecard',
        report,
        saveOffer: null,
        truncated: false,
        text:
          `### Kundli Milan — ${report.total} / 36 (below the traditional threshold)\n\n` +
          '| Koota | Score | What it reads |\n| --- | --- | --- |\n' +
          '| Varna | 0/1 | spiritual compatibility |\n\nAnd a sentence of narration.',
      },
    });
    const answer = await screen.findByTestId('match-chat-answer');
    // the component's own numbers are on screen…
    expect(answer.textContent).toContain(String(report.total));
    expect(answer.textContent).toContain('Nadi');
    // …the narration survives…
    expect(answer.textContent).toContain('And a sentence of narration.');
    // …and the fallback table does not appear twice
    expect((answer.textContent?.match(/Kundli Milan/g) ?? []).length).toBeLessThanOrEqual(1);
    expect(answer.textContent).not.toContain('| Koota |');
    expect(document.body.textContent).not.toContain('%');
  });

  it('a follow-up goes into the SAME chat', async () => {
    await openShortlist();
    fireEvent.click(screen.getByTestId(`ask-${ROWS[0].pair_key}`));
    await screen.findByTestId('match-chat-basis');
    port!.emit({ type: 'chat', chatId: 'chat-9' });
    port!.emit({ type: 'outcome', outcome: { kind: 'text', text: 'Here you go.', truncated: false } });
    fireEvent.change(await screen.findByTestId('match-chat-ask'), {
      target: { value: 'why is Nadi zero' },
    });
    fireEvent.click(screen.getByTestId('match-chat-send'));
    await waitFor(() => expect(posted).toHaveLength(2));
    expect(posted[1]).toEqual({ type: 'match/say', chatId: 'chat-9', text: 'why is Nadi zero' });
  });

  it('shows what went wrong rather than spinning', async () => {
    await openShortlist();
    fireEvent.click(screen.getByTestId(`ask-${ROWS[0].pair_key}`));
    await screen.findByTestId('match-chat-basis');
    port!.emit({ type: 'failed', error: 'The reading came back empty.' });
    expect((await screen.findByTestId('match-chat-problem')).textContent).toContain(
      'came back empty',
    );
  });
});
