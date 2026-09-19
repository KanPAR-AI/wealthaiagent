/**
 * Review & confirm — the trust boundary, drawn (docs/73 ASTRAL-327).
 *
 * ── why this is not "a second input widget" ───────────────────────────────
 *
 * ASTRAL-321's negative space forbids a second input widget in the workspace,
 * and this is not one. `InputRequestView` renders an ASK THE ENGINE MADE:
 * the engine names the fields, the client answers on the one carrier, and
 * this panel renders exactly that when the engine asks (see `app.tsx`). What
 * this screen renders is a different object with no engine ask behind it —
 * a machine's READING of somebody's page, with a state and a basis per field
 * and nothing confirmed. The shared widget has no three-state concept and
 * should not grow one: the states exist because a parse can be wrong, and an
 * engine ask cannot be.
 *
 * What it does NOT do is draw its own controls. The date and time rows are
 * `domPrimitives`' `DateWheel` and `TimeWheel` — the same native pickers the
 * shared widget uses, through the same adapter — so `03/04/1989` and the
 * am/pm loss cannot come back in through this door.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { DARK_THEME } from '@wealthai/astral';
import { domPrimitives } from '@wealthai/astral-dom';

import {
  PERSON_FIELD_KEYS,
  confirmProfile,
  type Candidate,
  type CaptureSource,
  type ConfirmedProfile,
  type FieldAct,
  type FieldDecision,
  type ParsedProfile,
  type PersonFieldKey,
} from '../lib/confirmed';
import {
  basisToShow,
  confidenceBand,
  confidenceLabel,
  confirmGate,
  fieldChoices,
  readResolveResponse,
  needsAttention,
  provenanceLine,
  rowsFor,
  shouldResolvePlace,
  sourceNote,
  stateSentence,
  valueInWords,
  type PlaceResolution,
} from '../lib/review-view';
import { resolvePlace, suggestPlaces } from './bridge';

const theme = DARK_THEME;

const LABELS: Record<PersonFieldKey, string> = {
  name: 'Their name',
  dob: 'Date of birth',
  tob: 'Time of birth',
  pob: 'Place of birth',
};

const STATE_INK: Record<string, string> = {
  stated: theme.text,
  inferred: theme.warn,
  missing: theme.textPending,
};

/**
 * The ink a row's state sentence is drawn in (ASTRAL-333).
 *
 * `needsAttention` — not the state alone. A `stated` field the machine is
 * only half sure of gets the SAME treatment as an inference, because the two
 * carry the same risk and a settled-looking row is how a wrong date gets
 * confirmed with one tap.
 */
function stateInk(candidate: { state: string; confidence: number }): string {
  return needsAttention(candidate as never) ? theme.warn : STATE_INK[candidate.state];
}

export function ReviewScreen({
  parsed,
  source,
  onConfirmed,
  onBack,
}: {
  parsed: ParsedProfile;
  source: CaptureSource;
  onConfirmed: (profile: ConfirmedProfile) => void;
  onBack: () => void;
}) {
  const [decisions, setDecisions] = useState<Partial<Record<PersonFieldKey, FieldDecision>>>({});
  const [place, setPlace] = useState<PlaceResolution>({ kind: 'idle' });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [refusals, setRefusals] = useState<string[]>([]);
  const resolveSeq = useRef(0);

  const rows = useMemo(() => rowsFor(parsed.fields, decisions), [parsed, decisions]);
  const gate = confirmGate(rows, place);
  const placeRow = rows.find((r) => r.key === 'pob');
  const placeValue = placeRow?.value ?? '';
  const placeAct = placeRow?.act ?? null;

  const set = (key: PersonFieldKey, decision: FieldDecision) =>
    setDecisions((old) => ({ ...old, [key]: decision }));

  // The place is looked up by the ENGINE, and the answer is shown back before
  // anything is sent. Debounced only so a keystroke is not a request; the
  // authority is never the client.
  useEffect(() => {
    const text = placeValue.trim();
    if (!shouldResolvePlace(placeAct, text)) {
      // Nothing is sent until the user has acted on this field — see
      // `shouldResolvePlace`. A parse does not leave the browser.
      setPlace({ kind: 'idle' });
      setSuggestions([]);
      return;
    }
    const seq = ++resolveSeq.current;
    setPlace({ kind: 'resolving' });
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const [resolved, suggested] = await Promise.all([
            resolvePlace(text),
            suggestPlaces(text).catch(() => ({ status: 0, body: null })),
          ]);
          if (seq !== resolveSeq.current) return;
          setPlace(readResolveResponse(resolved.status, resolved.body));
          const places = (suggested.body as { places?: Array<{ name: string; country?: string }> } | null)
            ?.places;
          setSuggestions(
            (places ?? []).slice(0, 4).map((p) => (p.country ? `${p.name}, ${p.country}` : p.name)),
          );
        } catch (error) {
          if (seq !== resolveSeq.current) return;
          // Unreachable is its own state, with a retry — never a spinner that
          // waits for something that already failed.
          setPlace({
            kind: 'unreachable',
            message: error instanceof Error ? error.message : 'The place lookup did not answer.',
          });
        }
      })();
    }, 350);
    return () => clearTimeout(timer);
  }, [placeValue, placeAct]);

  const confirm = () => {
    // Follow-up 2: what travels is the place the ENGINE resolved and the user
    // SAW — "Pune, Maharashtra, India" — not the string they typed. The
    // resolved name is what the confirmation screen showed them, and sending
    // the raw text would make the chart's place a different string from the
    // one they approved. `confirmGate` has already refused to open unless
    // `place.kind === 'resolved'`, and any edit to the field resets the
    // resolution to `resolving`, which closes the gate again.
    const resolved =
      place.kind === 'resolved' && decisions.pob
        ? { ...decisions, pob: { ...decisions.pob, value: place.label } }
        : decisions;
    const outcome = confirmProfile(source, resolved);
    if (!outcome.ok) {
      setRefusals(outcome.refusals.map((r) => `${LABELS[r.field]} ${r.reason}`));
      return;
    }
    setRefusals([]);
    onConfirmed(outcome.profile);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px' }}>
      <Heading>Check these before I cast anything</Heading>
      <p style={{ margin: 0, fontSize: '13px', color: theme.textMuted, lineHeight: 1.45 }}>
        Nothing here has been sent yet. What you confirm is what reaches the reading — and
        nothing else does.
      </p>

      {PERSON_FIELD_KEYS.map((key) => {
        const row = rows.find((r) => r.key === key)!;
        const choices = row.act === null ? fieldChoices(key, row.candidate) : [];
        const words = valueInWords(key, row.value);
        const basis = basisToShow(row.candidate, row.act);
        return (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              htmlFor={`field-${key}`}
              style={{ fontSize: '12px', color: theme.textMuted, letterSpacing: '0.04em' }}
            >
              {LABELS[key].toUpperCase()}
            </label>

            <FieldControl
              fieldKey={key}
              value={row.value}
              describedBy={describedBy(key, row, source)}
              onChange={(value) => set(key, { act: 'typed', value })}
            />

            {/* The value in WORDS, beside the control (B3). `<input
                type="date">` renders in the browser's locale and cannot be
                asked not to; this is the only reading that means the same
                thing to every user, and it is derived from the ISO on every
                change. */}
            {words ? (
              <span
                id={`field-${key}-words`}
                data-testid={`field-${key}-words`}
                style={{ fontSize: '13px', color: theme.text }}
              >
                {words}
              </span>
            ) : null}

            {choices.length ? (
              <div
                role="group"
                aria-label={`Which reading of ${LABELS[key].toLowerCase()}?`}
                style={{ display: 'flex', flexDirection: 'row', gap: '8px', flexWrap: 'wrap' }}
              >
                {choices.map((choice) => (
                  <Chip
                    key={choice.value}
                    selected={row.value === choice.value}
                    testID={`field-${key}-choice-${choice.value}`}
                    onClick={() => set(key, { act: 'typed', value: choice.value })}
                  >
                    {choice.label}
                  </Chip>
                ))}
              </div>
            ) : null}

            {row.act === 'typed' ? null : (
              // The three-state sentence describes the MACHINE's reading. Once
              // the user has typed the value it is theirs, and leaving "not
              // there — please add it" under something they just typed reads
              // as the panel not having noticed.
              //
              // On an IMAGE path the state, the confidence and the source are
              // ONE sentence (the COPY ruling) — three stacked lines for one
              // fact, the first of them false, is what this replaces.
              <ProvenanceOrState fieldKey={key} source={source} candidate={row.candidate} />
            )}
            {row.act === null && !provenanceLine(source, row.candidate) ? (
              <ConfidenceWord fieldKey={key} candidate={row.candidate} />
            ) : null}
            {basis ? (
              <span
                id={`field-${key}-basis`}
                data-testid={`field-${key}-basis`}
                style={{ fontSize: '12px', color: theme.warn, lineHeight: 1.4 }}
              >
                {basis}
              </span>
            ) : null}

            {/* Where this value came from (B2, ASTRAL-333). A page about a
                family makes "which line was this?" the question, and it
                should have an answer that is not a re-read of the page. A
                VISION candidate has no line — §4 carries none — so the
                snapshot is named instead of a quotation being invented. */}
            {!provenanceLine(source, row.candidate) && sourceNote(source, row.candidate) ? (
              <span
                id={`field-${key}-source`}
                data-testid={`field-${key}-source`}
                style={{ fontSize: '11px', color: theme.textPending, lineHeight: 1.4 }}
              >
                {sourceNote(source, row.candidate)}
              </span>
            ) : null}

            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', marginTop: '2px' }}>
              {row.candidate.value && !choices.length ? (
                <Chip
                  selected={row.act === 'accepted'}
                  testID={`field-${key}-accept`}
                  onClick={() => set(key, { act: 'accepted', value: row.value })}
                >
                  That's right
                </Chip>
              ) : null}
              {key === 'tob' ? (
                <Chip
                  selected={row.act === 'declined'}
                  testID={`field-${key}-decline`}
                  onClick={() => set(key, { act: 'declined' })}
                >
                  Not known
                </Chip>
              ) : null}
              {row.act === 'typed' ? (
                <span style={{ fontSize: '12px', color: theme.accent, alignSelf: 'center' }}>
                  you typed this
                </span>
              ) : null}
            </div>

            {key === 'pob' ? (
              <PlaceState place={place} suggestions={suggestions} onPick={(text) => set('pob', { act: 'typed', value: text })} />
            ) : null}
          </div>
        );
      })}

      {refusals.length ? (
        <ul style={{ margin: 0, paddingLeft: '18px', color: theme.warn, fontSize: '13px' }}>
          {refusals.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}

      {!gate.ready ? (
        <span
          id="confirm-reason"
          data-testid="confirm-reason"
          style={{ fontSize: '13px', color: theme.textMuted, lineHeight: 1.45 }}
        >
          {gate.reason}
        </span>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
        <button type="button" onClick={onBack} style={ghostButton}>
          Back
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={!gate.ready}
          data-testid="confirm"
          // A disabled button with the reason only in the paragraph beside it
          // is a dead control to anybody not reading the paragraph.
          aria-describedby={gate.ready ? undefined : 'confirm-reason'}
          style={{ ...primaryButton, opacity: gate.ready ? 1 : 0.5 }}
        >
          Confirm and read the match
        </button>
      </div>
    </div>
  );
}

/**
 * Where this value came from, in ONE sentence (the COPY ruling).
 *
 * On the image paths it replaces the state line, the confidence badge and
 * the source note — and it is still the thing that reveals the number on a
 * tap, because ASTRAL-333 asks for the number to be available and not to be
 * the headline. On the text paths it renders the state sentence it always
 * did, and the confidence and source keep their own lines.
 */
function ProvenanceOrState({
  fieldKey,
  source,
  candidate,
}: {
  fieldKey: PersonFieldKey;
  source: CaptureSource;
  candidate: Candidate;
}) {
  const [shown, setShown] = useState(false);
  const provenance = provenanceLine(source, candidate);
  if (!provenance) {
    return (
      <span
        id={`field-${fieldKey}-state`}
        data-testid={`field-${fieldKey}-state`}
        style={{ fontSize: '12px', color: stateInk(candidate) }}
      >
        {stateSentence(candidate, source)}
      </span>
    );
  }
  const ink =
    provenance.tone === 'warn'
      ? theme.warn
      : provenance.tone === 'pending'
        ? theme.textPending
        : theme.textMuted;
  if (provenance.confidence === null) {
    return (
      <span
        id={`field-${fieldKey}-state`}
        data-testid={`field-${fieldKey}-state`}
        style={{ fontSize: '12px', color: ink }}
      >
        {provenance.text}
      </span>
    );
  }
  return (
    <button
      type="button"
      id={`field-${fieldKey}-state`}
      data-testid={`field-${fieldKey}-state`}
      onClick={() => setShown((v) => !v)}
      aria-label={`${provenance.text}. Tap to see the number.`}
      style={{
        alignSelf: 'flex-start',
        border: 'none',
        background: 'transparent',
        padding: 0,
        textAlign: 'left',
        fontSize: '12px',
        lineHeight: 1.4,
        cursor: 'pointer',
        color: ink,
      }}
    >
      {shown ? `${provenance.text} (${provenance.confidence})` : provenance.text}
    </button>
  );
}

/**
 * The machine's confidence, in WORDS (ASTRAL-333, INV-5).
 *
 * A band is the headline; the number is one tap away for whoever wants it.
 * The reason the number is not the headline is not squeamishness about
 * numbers — it is that "0.52" reads as a measurement of whether the date is
 * RIGHT, and it is a measurement of how sure a model is that it read the
 * pixels correctly. Those are different claims and only one of them is the
 * user's question.
 */
function ConfidenceWord({
  fieldKey,
  candidate,
}: {
  fieldKey: PersonFieldKey;
  candidate: { state: string; confidence: number };
}) {
  const [shown, setShown] = useState(false);
  const label = confidenceLabel(candidate as never);
  if (!label) return null;
  const band = confidenceBand(candidate.confidence);
  return (
    <button
      type="button"
      data-testid={`field-${fieldKey}-confidence`}
      onClick={() => setShown((v) => !v)}
      aria-label={`${label}. Tap to see the number.`}
      style={{
        alignSelf: 'flex-start',
        border: 'none',
        background: 'transparent',
        padding: 0,
        fontSize: '11px',
        letterSpacing: '0.04em',
        cursor: 'pointer',
        color: band === 'low' ? theme.warn : theme.textPending,
      }}
    >
      {shown ? `${label} (${candidate.confidence})` : label}
    </button>
  );
}

/**
 * Which sentences describe this control, for a screen reader (follow-up 5).
 *
 * The state sentence, the basis and the words-date are the three things a
 * sighted user reads under the row; `aria-describedby` is how the same three
 * reach somebody who is not reading them.
 */
function describedBy(
  key: PersonFieldKey,
  row: { act: FieldAct | null; candidate: Candidate },
  source: CaptureSource,
): string {
  const ids: string[] = [];
  if (key === 'dob') ids.push(`field-${key}-words`);
  // The STATE line — which on an image path is the whole provenance
  // sentence, including the confidence and where it was read.
  if (row.act !== 'typed') ids.push(`field-${key}-state`);
  // A1: on the TEXT paths the confidence and the source are their own
  // elements, and a screen-reader user was getting neither — so the
  // attention treatment for a low-confidence `stated` field reached a
  // sighted user only. Both are named here; `aria-describedby` ignores an id
  // that is not on the page, so a row without them costs nothing.
  if (row.act === null && !provenanceLine(source, row.candidate)) {
    ids.push(`field-${key}-confidence`);
  }
  if (!provenanceLine(source, row.candidate)) ids.push(`field-${key}-source`);
  ids.push(`field-${key}-basis`);
  return ids.join(' ');
}

function FieldControl({
  fieldKey,
  value,
  describedBy: describedByIds,
  onChange,
}: {
  fieldKey: PersonFieldKey;
  value: string;
  describedBy?: string;
  onChange: (value: string) => void;
}) {
  const { DateWheel, TimeWheel, TextInput } = domPrimitives;
  // The primitive contract has no `id`/`aria-describedby` — and it must not
  // grow them for one host (ASTRAL-18: a primitive is the INTERSECTION of
  // what both platforms mean the same way, and React Native has neither). So
  // the association is made on a wrapper this host owns, which is where
  // host-specific accessibility belongs.
  const wrap = (child: React.ReactNode) => (
    <div id={`field-${fieldKey}-wrap`} aria-describedby={describedByIds || undefined}>
      {child}
    </div>
  );
  if (fieldKey === 'dob') {
    return wrap(
      <DateWheel
        value={value || null}
        onChange={onChange}
        minYear={1900}
        maxYear={new Date().getFullYear()}
        accessibilityLabel="Date of birth"
        testID="field-dob"
      />,
    );
  }
  if (fieldKey === 'tob') {
    return wrap(
      <TimeWheel
        value={value || null}
        onChange={onChange}
        accessibilityLabel="Time of birth"
        testID="field-tob"
      />,
    );
  }
  return wrap(
    <TextInput
      value={value}
      onChangeText={onChange}
      autoCapitalize="words"
      autoCorrect={false}
      accessibilityLabel={LABELS[fieldKey]}
      testID={`field-${fieldKey}`}
      style={{
        fontSize: 15,
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surfaceAlt,
        color: theme.text,
      }}
    />,
  );
}

function PlaceState({
  place,
  suggestions,
  onPick,
}: {
  place: PlaceResolution;
  suggestions: string[];
  onPick: (text: string) => void;
}) {
  if (place.kind === 'idle') return null;
  if (place.kind === 'resolving') {
    return <Note ink={theme.textMuted}>Looking that place up…</Note>;
  }
  if (place.kind === 'resolved') {
    return (
      <Note ink={theme.textMuted} testID="place-resolved">
        {`I'll cast on ${place.label} — ${place.timezone}.`}
      </Note>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <Note ink={theme.warn} testID="place-problem">
        {place.message}
      </Note>
      {suggestions.length ? (
        <div style={{ display: 'flex', flexDirection: 'row', gap: '6px', flexWrap: 'wrap' }}>
          {suggestions.map((s) => (
            <Chip key={s} selected={false} onClick={() => onPick(s)}>
              {s}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Note({ children, ink, testID }: { children: string; ink: string; testID?: string }) {
  return (
    <span data-testid={testID} style={{ fontSize: '12px', color: ink, lineHeight: 1.45 }}>
      {children}
    </span>
  );
}

function Chip({
  children,
  selected,
  onClick,
  testID,
}: {
  children: string;
  selected: boolean;
  onClick: () => void;
  testID?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      data-testid={testID}
      style={{
        border: `1px solid ${selected ? theme.accent : theme.border}`,
        background: selected ? theme.accent : 'transparent',
        color: selected ? theme.surface : theme.text,
        borderRadius: '999px',
        padding: '6px 12px',
        fontSize: '12px',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

export function Heading({ children }: { children: string }) {
  return (
    <h1 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: theme.text, lineHeight: 1.3 }}>
      {children}
    </h1>
  );
}

export const primaryButton: React.CSSProperties = {
  flex: 1,
  border: 'none',
  background: theme.accent,
  color: theme.surface,
  borderRadius: '12px',
  padding: '12px 14px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
};

export const ghostButton: React.CSSProperties = {
  border: `1px solid ${theme.border}`,
  background: 'transparent',
  color: theme.textMuted,
  borderRadius: '12px',
  padding: '12px 14px',
  fontSize: '14px',
  cursor: 'pointer',
};
