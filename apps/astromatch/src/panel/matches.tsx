/**
 * The shortlist, the compare view and the per-match conversation
 * (docs/73 ASTRAL-339/340/341).
 *
 * React only. Every decision on these screens is made in
 * `lib/shortlist-view.ts`, `lib/compare-view.ts` and `lib/match-chat.ts`,
 * which are pure and tested in the root jest project; this file draws what
 * they return and words nothing itself.
 *
 * What is deliberately NOT here: a sort, a rank, an ordinal, a winner, a
 * total across columns, a percentage, and any cache of a match or a person.
 * The panel is a VIEW of the People store (ASTRAL-37) — when this screen is
 * open, what it shows is what the engine sent to this request.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ASK_ABOUT_MATCH_LABEL,
  DARK_THEME,
  parseMatchReport,
  withoutScorecardFallback,
} from '@wealthai/astral';
import { AstralBlock, Narration } from '@wealthai/astral-dom';

import { PANEL_WIDTH } from '../lib/config';
import {
  MAX_COMPARE,
  ORDER_NOTE,
  TIME_DEPENDENT_NOTE,
  compareRows,
  mixedTimeKnowledge,
  readColumn,
  togglePick,
  type CompareColumn,
  type ComparePick,
} from '../lib/compare-view';
import {
  basisNow,
  chatBasis,
  latchRescored,
  matchChatHandoff,
  noteAboveScorecard,
  type MatchChatBasis,
  type MatchChatHandoff,
} from '../lib/match-chat';
import {
  SHORTLIST_SCALE_NOTE,
  readShortlist,
  type ShortlistGroup,
  type ShortlistOutcome,
  type ShortlistRow,
} from '../lib/shortlist-view';
import { readTurn, type TurnOutcome } from '../lib/transport';
import { askAboutMatch, listMatches, matchDetail, starPerson } from './bridge';
import { Heading, ghostButton, primaryButton } from './review';

const theme = DARK_THEME;

// ── the shortlist (ASTRAL-339) ─────────────────────────────────────────────

export function Shortlist({
  onCompare,
  onAsk,
  onBack,
  onSignedOut,
}: {
  onCompare: (picks: ComparePick[]) => void;
  onAsk: (handoff: MatchChatHandoff, name: string, basis: MatchChatBasis, fresh: boolean) => void;
  onBack: () => void;
  onSignedOut: (note: string) => void;
}) {
  const [outcome, setOutcome] = useState<ShortlistOutcome | null>(null);
  const [picks, setPicks] = useState<ComparePick[]>([]);
  const [pickNote, setPickNote] = useState('');
  /** which rows this session has starred, so the star is not a lie while the
   *  PATCH is in flight. The truth is the engine's on the next read. */
  const [stars, setStars] = useState<Record<string, boolean>>({});
  const [problem, setProblem] = useState('');

  const load = useCallback(async () => {
    const reply = await listMatches();
    const read = readShortlist(reply.status, reply.body);
    if (read.kind === 'signed-out') {
      onSignedOut(read.note);
      return;
    }
    setOutcome(read);
  }, [onSignedOut]);

  useEffect(() => {
    void load().catch((e: unknown) =>
      setOutcome({ kind: 'failed', note: e instanceof Error ? e.message : String(e) }),
    );
  }, [load]);

  const star = async (row: ShortlistRow, next: boolean) => {
    if (!row.personId) return;
    setStars((s) => ({ ...s, [row.pairKey]: next }));
    setProblem('');
    try {
      const reply = await starPerson(row.personId, next);
      if (reply.status >= 400) throw new Error(`The server answered ${reply.status}.`);
    } catch (e) {
      // The star goes back where it was and SAYS so. A star that silently
      // stays on is the panel claiming a write the engine refused.
      setStars((s) => ({ ...s, [row.pairKey]: !next }));
      setProblem(
        `I couldn't change that in your matches. ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  const pick = (group: ShortlistGroup, row: ShortlistRow) => {
    const next = togglePick(picks, {
      pairKey: row.pairKey,
      name: row.name,
      // the ENGINE's own label for this group, carried with the pick so the
      // compare column can say which scale it is on without this client
      // deciding what the scale means
      scale: group.label,
    });
    setPicks(next.picked);
    setPickNote(next.note);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px' }}>
      <Heading>Your matches</Heading>
      {outcome === null ? <p style={proseStyle}>Reading your matches…</p> : null}
      {outcome?.kind === 'empty' ? (
        <p style={proseStyle} data-testid="shortlist-empty">
          {outcome.note}
        </p>
      ) : null}
      {outcome?.kind === 'failed' ? (
        <p style={{ ...proseStyle, color: theme.warn }} data-testid="shortlist-failed">
          {outcome.note}
        </p>
      ) : null}
      {problem ? (
        <p style={{ ...proseStyle, color: theme.warn }} data-testid="shortlist-problem">
          {problem}
        </p>
      ) : null}

      {outcome?.kind === 'groups' ? (
        <p style={proseStyle} data-testid="shortlist-scale-note">
          {SHORTLIST_SCALE_NOTE}
        </p>
      ) : null}
      {outcome?.kind === 'groups' ? (
        <div data-testid="shortlist" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* THE GROUPS, IN THE ORDER THE ENGINE SENT THEM, never merged and
              never ordered against each other: a `/36` and a firm-only `/15`
              are not on one scale (F39, F151). */}
          {outcome.groups.map((group) => (
            <section key={group.key} data-testid={`group-${group.key}`}>
              <div data-testid={`group-label-${group.key}`} style={groupLabel}>
                {group.label}
              </div>
              {group.rule ? (
                <div data-testid={`group-rule-${group.key}`} style={groupRule}>
                  {group.rule}
                </div>
              ) : null}
              {group.note ? <div style={groupRule}>{group.note}</div> : null}
              {group.rows.length === 0 ? (
                <div style={{ ...groupRule, color: theme.textPending }}>Nobody in this group.</div>
              ) : null}
              {group.rows.map((row) => (
                <Row
                  key={row.pairKey}
                  row={row}
                  starred={stars[row.pairKey] ?? row.favourite}
                  picked={picks.some((p) => p.pairKey === row.pairKey)}
                  onStar={(next) => void star(row, next)}
                  onPick={() => pick(group, row)}
                  onAsk={() =>
                    onAsk(
                      matchChatHandoff({
                        pairKey: row.pairKey,
                        personId: row.personId,
                        name: row.name,
                      }),
                      row.name,
                      // WHAT THIS SCREEN KNOWS about the row the user tapped
                      // — the engine's own `freshness`, whether it has a
                      // score and whether it is a refusal. The chat may not
                      // promise the stored scorecard on anything else
                      // (FLAG-1).
                      chatBasis({
                        freshness: row.freshnessState,
                        scored: row.scored,
                        refused: Boolean(row.refusal),
                      }),
                      row.freshnessState === 'fresh',
                    )
                  }
                />
              ))}
            </section>
          ))}
        </div>
      ) : null}

      {pickNote ? (
        <p style={{ ...proseStyle, color: theme.warn }} data-testid="pick-note">
          {pickNote}
        </p>
      ) : null}
      {picks.length > 1 ? (
        <button
          type="button"
          style={primaryButton}
          data-testid="compare-open"
          onClick={() => onCompare(picks)}
        >
          {`Compare these ${picks.length}`}
        </button>
      ) : null}
      {picks.length === 1 ? (
        <p style={proseStyle} data-testid="pick-one">
          Pick one more to compare them side by side (up to {MAX_COMPARE}).
        </p>
      ) : null}
      <button type="button" style={ghostButton} onClick={onBack}>
        Back
      </button>
    </div>
  );
}

function Row({
  row,
  starred,
  picked,
  onStar,
  onPick,
  onAsk,
}: {
  row: ShortlistRow;
  starred: boolean;
  picked: boolean;
  onStar: (next: boolean) => void;
  onPick: () => void;
  onAsk: () => void;
}) {
  return (
    <div
      data-testid={`row-${row.pairKey}`}
      style={{
        border: `1px solid ${theme.border}`,
        borderRadius: '12px',
        padding: '12px',
        marginTop: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: theme.text }}>{row.name}</span>
        <button
          type="button"
          data-testid={`star-${row.pairKey}`}
          aria-pressed={starred}
          onClick={() => onStar(!starred)}
          style={{ ...ghostButton, padding: '2px 10px', fontSize: '12px' }}
        >
          {starred ? '★ Favourite' : '☆ Favourite'}
        </button>
      </div>

      {/* THE SCORE, as the engine sent it. A firm-only row carries its own
          scale sentence; no row is ever shown out of 36 unless it was
          scored out of 36. */}
      {row.score ? (
        <span data-testid={`score-${row.pairKey}`} style={{ fontSize: '13px', color: theme.text }}>
          {row.score.scale ? `${row.score.text} · ${row.score.scale}` : row.score.text}
        </span>
      ) : null}
      {row.score?.pending.map((reason) => (
        <span key={reason} style={{ fontSize: '12px', color: theme.textPending }}>
          {reason}
        </span>
      ))}
      {row.verdict ? (
        <span data-testid={`verdict-${row.pairKey}`} style={{ fontSize: '12px', color: theme.textMuted }}>
          {row.verdict}
        </span>
      ) : null}
      {row.refusal ? (
        <span data-testid={`refusal-${row.pairKey}`} style={{ fontSize: '12px', color: theme.warn }}>
          {row.refusal.ask ? `${row.refusal.reason} ${row.refusal.ask}` : row.refusal.reason}
        </span>
      ) : null}
      {row.freshness ? (
        <span data-testid={`freshness-${row.pairKey}`} style={{ fontSize: '12px', color: theme.textPending }}>
          {row.freshness}
        </span>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', marginTop: '4px' }}>
        <button
          type="button"
          data-testid={`pick-${row.pairKey}`}
          aria-pressed={picked}
          onClick={onPick}
          style={{ ...ghostButton, padding: '4px 10px', fontSize: '12px' }}
        >
          {picked ? 'Picked to compare' : 'Compare'}
        </button>
        <button
          type="button"
          data-testid={`ask-${row.pairKey}`}
          onClick={onAsk}
          style={{ ...ghostButton, padding: '4px 10px', fontSize: '12px' }}
        >
          {ASK_ABOUT_MATCH_LABEL}
        </button>
      </div>
    </div>
  );
}

// ── compare (ASTRAL-340) ───────────────────────────────────────────────────

export function Compare({
  picks,
  onBack,
  onSignedOut,
}: {
  picks: ComparePick[];
  onBack: () => void;
  onSignedOut: (note: string) => void;
}) {
  const [columns, setColumns] = useState<CompareColumn[] | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    void (async () => {
      const built: CompareColumn[] = [];
      const failures: string[] = [];
      // IN THE ORDER THE USER PICKED THEM — a sequential read, not a race
      // whose completion order would decide the columns.
      for (const pick of picks) {
        const reply = await matchDetail(pick.pairKey);
        const read = readColumn(reply.status, reply.body, pick);
        if (read.kind === 'column') built.push(read.column);
        else if (read.kind === 'signed-out') {
          if (live) onSignedOut(read.note);
          return;
        } else failures.push(read.note);
      }
      if (!live) return;
      setColumns(built);
      setProblems(failures);
    })();
    return () => {
      live = false;
    };
  }, [picks, onSignedOut]);

  const rows = columns ? compareRows(columns) : [];
  const mixed = mixedTimeKnowledge(rows);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
      <Heading>Side by side</Heading>
      {/* THE SENTENCE THAT IS THE ROW (ASTRAL-340): no rank, no winner, and
          the reason why, above the numbers rather than under them. */}
      <p style={proseStyle} data-testid="compare-order-note">
        {ORDER_NOTE}
      </p>
      {mixed ? (
        <p style={{ ...proseStyle, color: theme.warn }} data-testid="compare-time-note">
          {TIME_DEPENDENT_NOTE}
        </p>
      ) : null}
      {problems.map((note) => (
        <p key={note} style={{ ...proseStyle, color: theme.warn }} data-testid="compare-problem">
          {note}
        </p>
      ))}
      {columns === null ? <p style={proseStyle}>Reading them…</p> : null}

      {columns ? (
        <div data-testid="compare" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {columns.map((column) => (
            <div
              key={column.pairKey}
              data-testid={`column-${column.pairKey}`}
              style={{
                border: `1px solid ${theme.border}`,
                borderRadius: '12px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: 600, color: theme.text }}>
                {column.name}
              </span>
              <span data-testid={`scale-${column.pairKey}`} style={{ fontSize: '12px', color: theme.textMuted }}>
                {column.scale}
              </span>
              {column.total ? (
                <span data-testid={`total-${column.pairKey}`} style={{ fontSize: '13px', color: theme.text }}>
                  {column.total}
                </span>
              ) : null}
              {column.firm ? (
                <span data-testid={`firm-${column.pairKey}`} style={{ fontSize: '13px', color: theme.text }}>
                  {`${column.firm.text} firm points · ${column.firm.pending} more need a birth time`}
                </span>
              ) : null}
              {column.verdict ? (
                <span style={{ fontSize: '12px', color: theme.textMuted }}>{column.verdict}</span>
              ) : null}
              {column.refusal ? (
                <span data-testid={`refusal-${column.pairKey}`} style={{ fontSize: '12px', color: theme.warn }}>
                  {column.refusal.ask
                    ? `${column.refusal.reason} ${column.refusal.ask}`
                    : column.refusal.reason}
                </span>
              ) : null}
              {column.freshness ? (
                <span style={{ fontSize: '12px', color: theme.textPending }}>{column.freshness}</span>
              ) : null}
            </div>
          ))}

          {/* THE TABLE. One row per koota, in the engine's own order, with
              every time-dependent row marked and a pending cell drawn as
              pending — never as a zero. */}
          {rows.map((row) => (
            <div
              key={row.name}
              data-testid={`compare-row-${row.name}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                borderTop: `1px solid ${theme.border}`,
                paddingTop: '8px',
              }}
            >
              <span style={{ fontSize: '13px', color: theme.text }}>
                {row.timeDependent ? `${row.name} ⏱` : row.name}
              </span>
              <span style={{ fontSize: '11px', color: theme.textMuted }}>{row.meaning}</span>
              {row.timeDependent ? (
                <span
                  data-testid={`time-dependent-${row.name}`}
                  style={{ fontSize: '11px', color: theme.textPending }}
                >
                  needs an exact birth time
                </span>
              ) : null}
              <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '10px' }}>
                {row.cells.map((cell, at) => (
                  <span
                    key={columns[at].pairKey}
                    data-testid={`cell-${columns[at].pairKey}-${row.name}`}
                    style={{ fontSize: '12px', color: cell.text ? theme.text : theme.textPending }}
                  >
                    {`${columns[at].name}: ${
                      cell.absent ? 'not scored' : cell.pending ? 'pending' : (cell.text ?? 'pending')
                    }`}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <button type="button" style={ghostButton} data-testid="compare-back" onClick={onBack}>
        Back to your matches
      </button>
    </div>
  );
}

// ── one chat per saved match (ASTRAL-341) ──────────────────────────────────

export function MatchChat({
  handoff,
  name,
  basis,
  wasFresh,
  onBack,
  onSignedOut,
}: {
  handoff: MatchChatHandoff;
  name: string;
  /** what this screen may PROMISE, decided from the row the user tapped */
  basis: MatchChatBasis;
  /** was that row FRESH? — the other half of the recompute test */
  wasFresh: boolean;
  onBack: () => void;
  onSignedOut: (note: string) => void;
}) {
  const [text, setText] = useState('');
  /** the finished turn, kept whole — a scorecard is DRAWN, not printed */
  const [outcome, setOutcome] = useState<TurnOutcome | null>(null);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(true);
  const [question, setQuestion] = useState('');
  const [run, setRun] = useState<ReturnType<typeof askAboutMatch> | null>(null);
  /**
   * Has THIS CHAT ever scored the match again? (FLAG-1 residual.)
   *
   * A fact about the conversation, not about the turn on screen — the Ask
   * button clears the stream, and deriving the withdrawal from the stream
   * alone put the promise back over a chat that had just recomputed.
   */
  const [seenRescore, setSeenRescore] = useState(false);

  useEffect(() => {
    const started = askAboutMatch(handoff, (event) => {
      if (event.type === 'delta') {
        setText(event.text);
        return;
      }
      if (event.type === 'failed') {
        setBusy(false);
        setProblem(event.error);
        return;
      }
      setBusy(false);
      if (event.outcome.kind === 'signed-out') {
        onSignedOut(event.outcome.reason);
        return;
      }
      setOutcome(event.outcome);
    });
    setRun(started);
    return () => started.close();
    // The handoff is the identity of this screen: a different match is a
    // different mount, which is what keeps one chat to one match.
  }, [handoff, onSignedOut]);

  /**
   * THE TURN, READ THROUGH THE ONE READER — finished or still arriving.
   *
   * Painting `text` raw put the platform's routing banner — "[Using
   * astrology_ai agent]" — on screen for the whole of a slow turn, and it
   * printed the engine's DETERMINISTIC PROSE FALLBACK (the `### Kundli Milan`
   * heading and the eight-row koota table, ASTRAL-90) as a markdown table
   * clipped by a 380 px panel. Both were found by looking at the walk's own
   * screenshot.
   *
   * So the same rules the reading screen follows apply here: `readTurn`
   * decides what a turn is, a scorecard is DRAWN with the shared component —
   * the one implementation, at this panel's width — and the fallback rows are
   * hidden underneath it by the shared pure function, which fails open.
   */
  const shown: TurnOutcome | null = outcome ?? (text ? readTurn(text) : null);
  const drewBlock = shown?.kind === 'scorecard';
  const prose = shown ? withoutScorecardFallback(readable(shown), drewBlock) : '';
  /**
   * DID THE TURN SCORE IT AGAIN? (FLAG-1)
   *
   * Read from the stream itself — the engine's own progress line has exactly
   * one emitter, `node_synastry`'s first yield — or from a scorecard arriving
   * on a row the rehydration would have refused. When it did, the promise
   * above is withdrawn and the drawn scorecard carries a line saying these
   * numbers can differ from the list's. The progress line itself is never
   * hidden: it is the true sentence about what just happened.
   */
  const rescored = latchRescored(seenRescore, {
    text,
    drewScorecard: drewBlock,
    rowWasFresh: wasFresh,
  });
  const header = basisNow(basis, rescored);
  const note = noteAboveScorecard(header, { rescored, drewScorecard: drewBlock });

  // Latch it: the evidence is in this turn, the FACT is about this chat.
  useEffect(() => {
    if (rescored && !seenRescore) setSeenRescore(true);
  }, [rescored, seenRescore]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
      <Heading>{`About your match with ${name}`}</Heading>
      <p
        style={rescored ? { ...proseStyle, color: theme.warn } : proseStyle}
        data-testid="match-chat-basis"
      >
        {header}
      </p>
      {busy && !shown ? <p style={proseStyle}>Reading what's on file…</p> : null}
      {shown ? (
        <div data-testid="match-chat-answer">
          {/* The SAME scorecard the app and the reading screen draw, from the
              SAME stored artifact — one implementation (ASTRAL-18), never a
              second, different scorecard (ASTRAL-341's negative space). */}
          {note ? (
            <p
              data-testid="match-chat-rescored"
              style={{ ...proseStyle, color: theme.warn, marginBottom: '6px' }}
            >
              {note}
            </p>
          ) : null}
          {shown.kind === 'scorecard' ? (
            <AstralBlock
              type="match_report"
              value={parseMatchReport(shown.report) ?? shown.report}
            />
          ) : null}
          {prose ? (
            <Narration
              text={prose}
              color={theme.textMuted}
              strongColor={theme.text}
              lineColor={theme.border}
              width={PANEL_WIDTH}
              testID="match-chat-narration"
            />
          ) : null}
        </div>
      ) : null}
      {problem ? (
        <p style={{ ...proseStyle, color: theme.warn }} data-testid="match-chat-problem">
          {problem}
        </p>
      ) : null}

      <input
        type="text"
        value={question}
        placeholder="Ask about this match"
        data-testid="match-chat-ask"
        onChange={(e) => setQuestion(e.target.value)}
        style={{
          border: `1px solid ${theme.border}`,
          background: theme.surfaceAlt,
          color: theme.text,
          borderRadius: '10px',
          padding: '11px 12px',
          fontSize: '14px',
        }}
      />
      <button
        type="button"
        style={{ ...primaryButton, opacity: question.trim() && run ? 1 : 0.5 }}
        disabled={!question.trim() || !run}
        data-testid="match-chat-send"
        onClick={() => {
          setOutcome(null);
          setText('');
          setProblem('');
          setBusy(true);
          run?.answer(question.trim());
          setQuestion('');
        }}
      >
        Ask
      </button>
      <button type="button" style={ghostButton} data-testid="match-chat-back" onClick={onBack}>
        Back to your matches
      </button>
    </div>
  );
}

/** The readable half of a turn, whatever kind it was. */
function readable(outcome: TurnOutcome): string {
  if (outcome.kind === 'scorecard' || outcome.kind === 'text' || outcome.kind === 'ask') {
    return outcome.text;
  }
  return outcome.reason;
}

const proseStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '13px',
  color: theme.textMuted,
  lineHeight: 1.5,
};

const groupLabel: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: theme.ceremonial,
};

const groupRule: React.CSSProperties = {
  fontSize: '12px',
  color: theme.textMuted,
  lineHeight: 1.4,
  marginTop: '2px',
};
