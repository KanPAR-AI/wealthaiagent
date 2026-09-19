/**
 * The panel (docs/73 PH-39).
 *
 * Five states and no sixth: signed out · choose a way in · review · running ·
 * the reading. Every one of them is something the user can read; there is no
 * state whose whole content is a spinner.
 *
 * What this file does NOT contain, on purpose: a scorecard, a wheel, an input
 * widget, an `input_response` builder, a percentage, a band, a ranking or any
 * arithmetic on an engine number. The scorecard is `@wealthai/astral`'s, drawn
 * through `@wealthai/astral-dom` at 380 px — the width ASTRAL-18 names.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DARK_THEME,
  buildInputResponseMessage,
  parseMatchReport,
  withoutScorecardFallback,
  type InputRequestPayload,
  type InputValue,
} from '@wealthai/astral';
import { AstralBlock, Narration } from '@wealthai/astral-dom';

import { capabilities } from '../lib/capabilities';
import { instructionFor, type Instruction } from '../lib/capture';
import type { ChipId, ChipPlan } from '../lib/chips';
import { ENGINE_HAS_CAPTURE_FIELDS, PANEL_WIDTH } from '../lib/config';
import {
  editedKeys,
  type CaptureSource,
  type ConfirmedProfile,
  type ParsedProfile,
} from '../lib/confirmed';
import { RESETS_ON_HEADER } from '../lib/errors';
import { DOOR_LABELS, readExtractResponse, type ExtractFailure } from '../lib/extract';
import type { MatchEvent } from '../lib/messages';
import { parseProfileText } from '../lib/parse-profile';
import { TRUNCATED_NOTE, readTurn, type TurnOutcome } from '../lib/transport';
import { needsDelete, retentionNotice, type DeleteOutcome } from '../lib/retention-view';
import {
  authState,
  deleteReading,
  extractProfile,
  onCaptureDelivered,
  requestCapture,
  sendCode,
  signOut,
  startMatch,
  takePendingCapture,
  verifyCode,
  type MatchRun,
} from './bridge';
import { ChipRow, type ChipAnswerState } from './chips';
import { CropScreen } from './crop';
import { Heading, ReviewScreen, ghostButton, primaryButton } from './review';

const theme = DARK_THEME;

type Screen =
  | { name: 'loading' }
  | { name: 'signed-out'; notice?: string }
  | { name: 'choose' }
  | { name: 'paste' }
  /**
   * A capture is on screen and the user is drawing the crop (ASTRAL-331).
   *
   * The BYTES are not here: they live in the panel's `capture` state for the
   * lifetime of one review, so the recovery door can reopen on the ORIGINAL
   * rather than on the crop that just failed (F309).
   */
  | { name: 'crop'; problem: string | null }
  /**
   * Chrome would not give us the tab (F159's pessimistic branch).
   *
   * A STATE with words in it, naming the two gestures that do grant
   * `activeTab` — never a button that silently did nothing.
   */
  | { name: 'capture-blocked'; instruction: Instruction }
  /** the extractor refused, capped, or could not be reached (ASTRAL-333) */
  | { name: 'capture-failed'; outcome: ExtractFailure }
  | { name: 'review'; parsed: ParsedProfile; source: CaptureSource }
  | { name: 'running'; text: string }
  | { name: 'reading'; outcome: TurnOutcome }
  | { name: 'failed'; error: string };

const EMPTY_PARSE: ParsedProfile = parseProfileText('', 'manual');

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'loading' });
  const [account, setAccount] = useState<string | null>(null);
  const [run, setRun] = useState<MatchRun | null>(null);
  /** the profile this run is for — kept so a cut-off reading can be asked
   *  for again without making the user re-enter anything (B6). */
  const [subject, setSubject] = useState<ConfirmedProfile | null>(null);
  /** docs/73 B1 — an unsaved reading's chat is DELETED when the user leaves
   *  it, and what happened is stated. `pending` means they are still in it. */
  const [deletion, setDeletion] = useState<DeleteOutcome>({ kind: 'pending' });
  /** what the worker's sweep removed on the way in, if anything */
  const [sweptNotice, setSweepNotice] = useState('');
  /** docs/73 ASTRAL-334: the user answered the save offer, so this reading is
   *  THEIRS TO KEEP and the leave-sweep must never touch it. */
  const [saved, setSaved] = useState(false);
  /** the user chose outcome (b) — an instant reading, unsaved. The chips
   *  belong to that choice (ASTRAL-336). */
  const [instant, setInstant] = useState(false);
  const [busy, setBusy] = useState(false);
  /** a chip's answer, or the engine's word about the save — both of which
   *  arrive on a turn that must NOT replace the scorecard on screen. */
  const [side, setSide] = useState<ChipAnswerState | null>(null);
  /**
   * THE UNCROPPED CAPTURE, for the lifetime of this capture's review (F309).
   *
   * It used to live only in the crop SCREEN's own state, so the moment the
   * panel moved on the original was gone — and "Choose a smaller region",
   * the one recovery door after "I couldn't read that crop", reopened the
   * tool on the CROPPED bytes. The only way out of a read that failed
   * because the box was too tight was to make it tighter still.
   *
   * It is memory and nothing else: never `chrome.storage`, never IndexedDB,
   * dropped on confirm, on cancel, on leaving the reading and on panel close
   * (ASTRAL-337, whose storage scan covers it).
   */
  const [capture, setCapture] = useState<string | null>(null);
  /** what happened to the reading a new capture interrupted (F311) */
  const [interrupted, setInterrupted] = useState('');
  const sideRef = useRef<{ id: ChipId | 'save'; label: string } | null>(null);
  /** mirrors of `run` and `saved` for the callbacks that must not be
   *  re-created on every state change (the capture listener is one). */
  const runRef = useRef<MatchRun | null>(null);
  const savedRef = useRef(false);

  useEffect(() => {
    void authState()
      .then((state) => {
        setAccount(state.identifier ?? null);
        // The worker sweeps whatever a closed browser left owed, and says so
        // only when it actually removed something (B1).
        if (state.notice) setSweepNotice(state.notice);
        setScreen(state.signedIn ? { name: 'choose' } : { name: 'signed-out' });
      })
      .catch((error: unknown) =>
        setScreen({ name: 'failed', error: error instanceof Error ? error.message : String(error) }),
      );
  }, []);

  const onEvent = useCallback((event: MatchEvent) => {
    // A SIDE RUN — a chip's question, or the save answer — is a turn whose
    // result belongs BESIDE the reading, not instead of it. Routing it
    // through the screen was the first version and it replaced the scorecard
    // the chip was asking about, which is the one thing the user was looking
    // at.
    const sideRun = sideRef.current;
    if (sideRun) {
      if (event.type === 'delta') {
        setSide({ ...sideRun, text: event.text, streaming: true, truncated: false });
        return;
      }
      sideRef.current = null;
      if (event.type === 'failed') {
        setSide({ ...sideRun, text: '', streaming: false, truncated: false, error: event.error });
        return;
      }
      if (event.outcome.kind === 'signed-out') {
        setAccount(null);
        setScreen({ name: 'signed-out', notice: event.outcome.reason });
        return;
      }
      if (sideRun.id === 'save') {
        setSaved(true);
        savedRef.current = true;
      }
      setSide({
        ...sideRun,
        text: outcomeText(event.outcome),
        streaming: false,
        truncated: 'truncated' in event.outcome ? Boolean(event.outcome.truncated) : false,
      });
      return;
    }
    if (event.type === 'delta') {
      setScreen({ name: 'running', text: event.text });
      return;
    }
    if (event.type === 'outcome') {
      // A session that expired is not a failed reading: the honest response
      // is the sign-in screen with one sentence, not a Retry that will fail
      // the same way (B6).
      if (event.outcome.kind === 'signed-out') {
        setAccount(null);
        setScreen({ name: 'signed-out', notice: event.outcome.reason });
        return;
      }
      setScreen({ name: 'reading', outcome: event.outcome });
      return;
    }
    setScreen({ name: 'failed', error: event.error });
  }, []);

  const begin = (profile: ConfirmedProfile) => {
    setSubject(profile);
    // The review is over: the bytes have done their whole job.
    setCapture(null);
    setDeletion({ kind: 'pending' });
    setSaved(false);
    savedRef.current = false;
    setInstant(false);
    setSide(null);
    sideRef.current = null;
    setScreen({ name: 'running', text: '' });
    const started = startMatch(profile, `Match — ${profile.name}`, onEvent);
    runRef.current = started;
    setRun(started);
  };

  /**
   * Leaving an unsaved reading deletes the chat it created (B1).
   *
   * `then` is where the user goes next; the outcome is shown either way,
   * because "I could not delete it" is a thing they need to know and act on
   * rather than a failure to swallow.
   */
  const leaveReading = async (then: () => void) => {
    const chatId = run?.chatId() ?? null;
    // ASTRAL-334/335, both halves: a reading the user SAVED is theirs to keep
    // and is never swept; an unsaved one is deleted when they leave it. The
    // worker holds the same fact independently (`savedRuns`), because the
    // panel closing is a path this function never runs on.
    if (!needsDelete(chatId, saved)) {
      then();
      return;
    }
    setDeletion({ kind: 'deleting' });
    const outcome = await deleteReading(chatId as string);
    if (outcome.deleted) {
      setDeletion({ kind: 'deleted' });
      run?.close();
      setRun(null);
      runRef.current = null;
      // R6 — every panel-local copy of the other person's values goes with
      // the reading: the confirmed profile, the capture, the side answer.
      // The DOM changing is not the same fact as the values being gone.
      setSubject(null);
      setCapture(null);
      setSide(null);
      setInterrupted('');
      then();
      return;
    }
    // Stay where they are: a failed delete they cannot see is the silent
    // version of the sentence this whole path exists to make true.
    setDeletion({ kind: 'failed', reason: outcome.reason });
  };

  // ── the camera (docs/73 ASTRAL-330/331/332/333) ─────────────────────────

  /**
   * The camera button asks the WORKER, and renders whatever comes back.
   *
   * F159, answered per click instead of assumed once: a worker holding an
   * `activeTab` grant returns an image; one that does not returns
   * `needs-gesture`, and the panel prints the shortcut Chrome actually bound
   * and the context-menu item. There is no branch in which this button does
   * nothing.
   */
  /**
   * A capture arrives — from the button, a shortcut or the menu.
   *
   * It REPLACES whatever was on screen, including a reading in progress. The
   * worker deletes that reading's chat on its own (it is unsaved and the port
   * is still ours), but the user watched their screen change under them, so
   * this says what happened in one sentence rather than leaving them to
   * wonder (F311). A SAVED reading is theirs and is never described as
   * closed.
   */
  const takeCapture = useCallback(
    (image: string) => {
      setInterrupted(
        runRef.current && !savedRef.current
          ? 'The reading you had open was not saved, so it has been closed and deleted.'
          : '',
      );
      setCapture(image);
      setScreen({ name: 'crop', problem: null });
    },
    [],
  );

  const askForCapture = useCallback(async () => {
    setSweepNotice('');
    try {
      const reply = await requestCapture();
      if (reply.outcome.kind === 'captured') {
        takeCapture(reply.outcome.image);
        return;
      }
      if (reply.outcome.kind === 'needs-gesture') {
        setScreen({ name: 'capture-blocked', instruction: instructionFor(reply.shortcut) });
        return;
      }
      setScreen({ name: 'failed', error: reply.outcome.reason });
    } catch (error) {
      setScreen({
        name: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  /**
   * A capture a GESTURE produced, arriving from the worker.
   *
   * Two doors, because a gesture can fire either way round: one for a panel
   * that was already open (the worker pushes), one for a panel that has just
   * started (it collects what was held). Both land on the same screen.
   */
  useEffect(() => onCaptureDelivered((event) => takeCapture(event.image)), [takeCapture]);

  useEffect(() => {
    void takePendingCapture()
      .then((pending) => {
        if (pending?.image) takeCapture(pending.image);
      })
      .catch((e: unknown) => {
        // Named. A capture the user made with a shortcut, lost silently, is
        // a keypress that did nothing.
        console.warn('[astromatch] could not collect a pending capture', e);
      });
  }, []);

  /**
   * Send the crop and read the answer (ASTRAL-332, §4).
   *
   * Every failure is a designed state with a door out — and two of those
   * doors, paste and manual entry, are never capped and never leave the
   * browser at all.
   */
  const sendCrop = async (image: string) => {
    setInterrupted('');
    setBusy(true);
    try {
      const reply = await extractProfile(image);
      const outcome = readExtractResponse(reply.status, reply.body, {
        get: (name: string) => (name === RESETS_ON_HEADER ? reply.resetsOn : null),
      });
      if (outcome.kind === 'candidates') {
        setScreen({ name: 'review', parsed: outcome.parsed, source: 'snapshot' });
        return;
      }
      setScreen({ name: 'capture-failed', outcome });
    } catch (error) {
      const unreachable = readExtractResponse(0, null, null);
      if (unreachable.kind !== 'candidates') {
        setScreen({ name: 'capture-failed', outcome: unreachable });
      }
      console.warn('[astromatch] the extract call failed', error);
    } finally {
      setBusy(false);
    }
  };

  /** A door out of a failed capture. Each one is somewhere real. */
  const takeDoor = (door: string) => {
    // F309: back to the ORIGINAL capture, not to the crop that just failed.
    // Reopening on the cropped bytes meant the only recovery from "I
    // couldn't read that crop" was to crop it smaller.
    if (door === 'recrop' && capture) {
      setScreen({ name: 'crop', problem: null });
      return;
    }
    if (door === 'paste') {
      setCapture(null);
      setScreen({ name: 'paste' });
      return;
    }
    if (door === 'manual') {
      setCapture(null);
      setScreen({ name: 'review', parsed: EMPTY_PARSE, source: 'manual' });
      return;
    }
    if (door === 'sign-in') {
      setCapture(null);
      setAccount(null);
      setScreen({ name: 'signed-out' });
      return;
    }
    void askForCapture();
  };

  // ── the two outcomes (docs/73 ASTRAL-334/335) ───────────────────────────

  /**
   * (a) "Add to my matches" — the SHIPPED save path and nothing new.
   *
   * The engine's own `save_match_offer` ask is answered on the one carrier
   * (`buildInputResponseMessage`), with `capture_source` and `capture_edited`
   * riding along so a fact the user accepted unchanged lands
   * `parsed_from_page` rather than `stated_by_user` (ASTRAL-313, AMB-68(a)).
   * There is no `POST /people` here and there is no auto-save: nothing is
   * written until this button is pressed.
   */
  const addToMatches = (offer: InputRequestPayload) => {
    if (!subject || !run) {
      // LOUD. A silent return here is a button that does nothing, which is
      // the exact failure the capability rule exists to remove — and it is
      // how this path first went wrong: the click landed, nothing was sent,
      // and the card sat there offering to save again (F305).
      setScreen({
        name: 'failed',
        error:
          'I lost track of this reading before it could be saved. Run it again ' +
          'and the save will work from the top.',
      });
      console.warn('[astromatch] save pressed with no run', {
        hasSubject: Boolean(subject),
        hasRun: Boolean(run),
      });
      return;
    }
    const values: Record<string, InputValue> = {
      save_match: 'save',
      person2_name: subject.name,
    };
    if (ENGINE_HAS_CAPTURE_FIELDS) {
      values.capture_source = subject.source;
      values.capture_edited = editedKeys(subject);
    }
    sideRef.current = { id: 'save', label: 'Added to your matches' };
    setSide({ id: 'save', label: 'Added to your matches', text: '', streaming: true, truncated: false });
    run.answer(buildInputResponseMessage(offer, values));
  };

  /**
   * (b) "Instant reading — don't save".
   *
   * It sends NOTHING. F149: `_persist_saved_match` returns None unless the
   * offer is answered, so the default is already "nothing durable", and this
   * button is the user saying so rather than a message that asks for it. What
   * DOES persist is the chat, which the retention card names in the product's
   * own words, and which is deleted when they leave.
   */
  const keepItInstant = () => {
    setInstant(true);
    setSide(null);
  };

  /** A chip: either the payload answers it, or the engine does. */
  const pickChip = (id: ChipId, label: string, plan: ChipPlan) => {
    if (plan.kind === 'instant') {
      // ZERO requests. The answer is already on screen in the payload the
      // scorecard was drawn from; `chips.test.tsx` counts the fetches.
      sideRef.current = null;
      setSide({ id, label, text: plan.markdown, streaming: false, truncated: false });
      return;
    }
    if (plan.kind === 'absent') return; // the chip is not rendered at all
    if (!run) {
      setSide({ id, label, text: '', streaming: false, truncated: false,
        error: 'I lost track of this reading — ask it again from a fresh one.' });
      return;
    }
    sideRef.current = { id, label };
    setSide({ id, label, text: '', streaming: true, truncated: false });
    run.answer(plan.question);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopBar
        account={account}
        onSignOut={
          account
            ? () => {
                void leaveReading(() => {
                  void signOut().then(() => {
                    setAccount(null);
                    setScreen({ name: 'signed-out' });
                  });
                });
              }
            : undefined
        }
      />
      {screen.name === 'loading' ? <Padded>One moment…</Padded> : null}
      {screen.name === 'signed-out' ? (
        <SignIn
          notice={screen.notice}
          onSignedIn={(identifier) => {
            setAccount(identifier);
            setScreen({ name: 'choose' });
          }}
        />
      ) : null}
      {screen.name === 'choose' ? (
        <Choose
          // What happened to the reading they just left — shown HERE because
          // this is where they land, and a deletion nobody sees is a promise
          // nobody can check (B1).
          notice={
            deletion.kind === 'deleted'
              ? retentionNotice(deletion).headline
              : sweptNotice || undefined
          }
          onSnapshot={() => void askForCapture()}
          onManual={() => {
            setSweepNotice('');
            setDeletion({ kind: 'pending' });
            setScreen({ name: 'review', parsed: EMPTY_PARSE, source: 'manual' });
          }}
          onPaste={() => {
            setSweepNotice('');
            setDeletion({ kind: 'pending' });
            setScreen({ name: 'paste' });
          }}
        />
      ) : null}
      {screen.name === 'paste' ? (
        <Paste
          onParsed={(parsed) => setScreen({ name: 'review', parsed, source: 'paste' })}
          onBack={() => setScreen({ name: 'choose' })}
        />
      ) : null}
      {screen.name === 'crop' && capture ? (
        <CropScreen
          image={capture}
          busy={busy}
          problem={screen.problem}
          interrupted={interrupted}
          onSend={(cropped) => void sendCrop(cropped)}
          onCancel={() => {
            setCapture(null);
            setInterrupted('');
            setScreen({ name: 'choose' });
          }}
        />
      ) : null}
      {screen.name === 'capture-blocked' ? (
        <Padded>
          <Heading>{screen.instruction.headline}</Heading>
          <p style={prose}>
            Chrome only lets an extension see a page when you point at it — so the
            camera in here cannot take the picture on its own.
          </p>
          <ul data-testid="capture-instruction" style={{ ...prose, paddingLeft: '18px' }}>
            {screen.instruction.steps.map((step) => (
              <li key={step} style={{ marginBottom: '6px' }}>
                {step}
              </li>
            ))}
          </ul>
          <button type="button" style={ghostButton} onClick={() => setScreen({ name: 'choose' })}>
            Back
          </button>
        </Padded>
      ) : null}
      {screen.name === 'capture-failed' ? (
        <Padded>
          <Heading>{CAPTURE_FAILURE_HEADINGS[screen.outcome.kind]}</Heading>
          <p style={{ ...prose, color: theme.warn }} data-testid="capture-problem">
            {screen.outcome.message}
          </p>
          {screen.outcome.kind === 'capped' && screen.outcome.resetsOn ? (
            <p style={prose} data-testid="capture-resets">
              {`Captures come back on ${screen.outcome.resetsOn}.`}
            </p>
          ) : null}
          {screen.outcome.kind === 'capped' ? (
            <p style={prose}>
              Pasting their biodata and typing their details are never capped, and
              neither one sends a picture anywhere.
            </p>
          ) : null}
          {screen.outcome.doors
            .filter((door) => door !== 'recrop' || Boolean(capture))
            .map((door) => (
            <button
              key={door}
              type="button"
              data-testid={`door-${door}`}
              style={ghostButton}
              onClick={() => takeDoor(door)}
            >
              {DOOR_LABELS[door]}
            </button>
          ))}
        </Padded>
      ) : null}
      {screen.name === 'review' ? (
        <ReviewScreen
          parsed={screen.parsed}
          source={screen.source}
          onConfirmed={begin}
          onBack={() => setScreen({ name: 'choose' })}
        />
      ) : null}
      {screen.name === 'running' ? <Running text={screen.text} /> : null}
      {screen.name === 'reading' ? (
        <Reading
          outcome={screen.outcome}
          onAnswer={(text) => {
            run?.answer(text);
            setScreen({ name: 'running', text: '' });
          }}
          onAgain={() => void leaveReading(() => setScreen({ name: 'choose' }))}
          onRetry={subject ? () => begin(subject) : undefined}
          deletion={deletion}
          onDeleteNow={() => void leaveReading(() => setScreen({ name: 'choose' }))}
          saved={saved}
          instant={instant}
          onSave={addToMatches}
          onInstant={keepItInstant}
          side={side}
          onChip={pickChip}
        />
      ) : null}
      {screen.name === 'failed' ? (
        <Padded>
          <Heading>That didn't go through</Heading>
          <p style={prose}>{screen.error}</p>
          <button type="button" style={primaryButton} onClick={() => setScreen({ name: 'choose' })}>
            Try again
          </button>
        </Padded>
      ) : null}
    </div>
  );
}

function TopBar({ account, onSignOut }: { account: string | null; onSignOut?: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: `1px solid ${theme.border}`,
      }}
    >
      <span style={{ fontSize: '14px', fontWeight: 600, color: theme.ceremonial }}>AstroMatch</span>
      {account ? (
        <button
          type="button"
          onClick={onSignOut}
          style={{ ...ghostButton, padding: '4px 10px', fontSize: '11px' }}
          title={account}
        >
          {account}
        </button>
      ) : null}
    </div>
  );
}

function SignIn({
  onSignedIn,
  notice,
}: {
  onSignedIn: (identifier: string) => void;
  /** why they are looking at this screen, when it is not simply the first time */
  notice?: string;
}) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const guard = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      // Shown. A sign-in button that does nothing is the failure this whole
      // screen is judged on.
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Padded>
      <Heading>Sign in with the email you use in the app</Heading>
      {notice ? (
        <p style={{ ...prose, color: theme.warn }} data-testid="signin-notice">
          {notice}
        </p>
      ) : null}
      <p style={prose}>
        Same account, same saved matches. We send a six-digit code — there is no password here and
        no pop-up window.
      </p>
      <input
        type="email"
        value={email}
        placeholder="you@example.com"
        onChange={(e) => setEmail(e.target.value)}
        data-testid="email"
        style={input}
      />
      {sent ? (
        <input
          type="text"
          inputMode="numeric"
          value={code}
          placeholder="6-digit code"
          onChange={(e) => setCode(e.target.value)}
          data-testid="code"
          style={input}
        />
      ) : null}
      {error ? <p style={{ ...prose, color: theme.warn }}>{error}</p> : null}
      <button
        type="button"
        disabled={busy || !email}
        data-testid={sent ? 'verify' : 'send-code'}
        style={{ ...primaryButton, opacity: busy || !email ? 0.5 : 1 }}
        onClick={() =>
          void guard(async () => {
            if (!sent) {
              await sendCode(email.trim());
              setSent(true);
              return;
            }
            const state = await verifyCode(email.trim(), code.trim());
            onSignedIn(state.identifier ?? email.trim());
          })
        }
      >
        {busy ? 'Working…' : sent ? 'Sign in' : 'Send me a code'}
      </button>
      {sent ? (
        <button type="button" style={ghostButton} onClick={() => setSent(false)}>
          Use a different email
        </button>
      ) : null}
    </Padded>
  );
}

function Choose({
  onManual,
  onPaste,
  onSnapshot,
  notice,
}: {
  onManual: () => void;
  onPaste: () => void;
  onSnapshot: () => void;
  notice?: string;
}) {
  return (
    <Padded>
      <Heading>Whose match shall I read?</Heading>
      {notice ? (
        <p style={{ ...prose, color: theme.text }} data-testid="choose-notice">
          {notice}
        </p>
      ) : null}
      <p style={prose}>
        Your own chart is already on your account. Give me theirs and I'll score the Kundli Milan
        against it.
      </p>
      {capabilities.snapshot ? (
        <button type="button" style={primaryButton} data-testid="snapshot" onClick={onSnapshot}>
          📷 Read this page
        </button>
      ) : null}
      {capabilities.snapshot ? (
        <p style={{ ...prose, fontSize: '12px' }}>
          I take a picture of what is on screen, you draw a box around the birth
          details, and only that box is sent to be read. I never read the page
          itself.
        </p>
      ) : null}
      {capabilities.manualEntry ? (
        <button type="button" style={ghostButton} data-testid="manual" onClick={onManual}>
          Type their details
        </button>
      ) : null}
      {capabilities.paste ? (
        <button type="button" style={ghostButton} data-testid="paste" onClick={onPaste}>
          Paste their biodata
        </button>
      ) : null}
      {/* The SELECTION read, the shortlist and the compare view are ABSENT,
          not disabled: a capability marked false removes its control
          (doctrine 8). Nothing here promises them. */}
    </Padded>
  );
}

function Paste({
  onParsed,
  onBack,
}: {
  onParsed: (parsed: ParsedProfile) => void;
  onBack: () => void;
}) {
  const [text, setText] = useState('');
  return (
    <Padded>
      <Heading>Paste what you're reading</Heading>
      <p style={prose}>
        It is read here, in this panel, and nothing is sent anywhere. You'll see what I made of it
        before anything leaves.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        data-testid="paste-box"
        placeholder={'Name: …\nDate of Birth: …\nTime of Birth: …\nPlace of Birth: …'}
        style={{ ...input, fontFamily: 'inherit', lineHeight: 1.5 }}
      />
      <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
        <button type="button" style={ghostButton} onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          style={{ ...primaryButton, opacity: text.trim() ? 1 : 0.5 }}
          disabled={!text.trim()}
          data-testid="read-paste"
          onClick={() => onParsed(parseProfileText(text, 'paste'))}
        >
          Read it
        </button>
      </div>
    </Padded>
  );
}

function Running({ text }: { text: string }) {
  // The scorecard fence arrives BEFORE the narration (F157), so paint
  // whatever has landed rather than holding a spinner over a finished
  // computation.
  const outcome = readTurn(text);
  // F157: the scorecard's fence lands BEFORE the narration, so it is painted
  // the moment it arrives rather than held behind a spinner. `streaming`
  // keeps the retention card back until the turn is over — "this reading was
  // not saved" is a statement about a finished reading.
  if (outcome.kind === 'scorecard') {
    return <Reading outcome={outcome} onAnswer={() => {}} streaming />;
  }
  return (
    <Padded>
      <Heading>Casting both charts…</Heading>
      <p style={prose}>
        {outcome.kind === 'text' && outcome.text
          ? outcome.text
          : 'The 36 gunas are computed on the server — this takes a few seconds.'}
      </p>
    </Padded>
  );
}

/**
 * The engine's prose, rendered as the markdown it is (B4).
 *
 * `drewBlock` hides the deterministic scorecard FALLBACK — the `### Kundli
 * Milan` heading, the Moon-signs line and the koota table the engine sends
 * for clients that cannot draw the block (docs/49 ASTRAL-90). This panel drew
 * it, so those eight rows would otherwise appear twice. Nothing else is
 * removed, and if the shape is not exactly the engine's the whole text is
 * shown unchanged — `withoutScorecardFallback` fails open.
 */
function Reading0Narration({ text, drewBlock = false }: { text: string; drewBlock?: boolean }) {
  const shown = withoutScorecardFallback(text, drewBlock);
  if (!shown.trim()) return null;
  return (
    <Narration
      text={shown}
      color={theme.textMuted}
      strongColor={theme.text}
      lineColor={theme.border}
      width={PANEL_WIDTH}
      testID="narration"
    />
  );
}

/**
 * The stream died after bytes had arrived (B6).
 *
 * The scorecard above it is whole — its fence closed or it would not have
 * parsed — and the words are not. Both halves said, and a retry offered,
 * because serving a cut-off reading as the finished one is the failure this
 * state exists to remove.
 */
function CutOff({ onRetry }: { onRetry?: () => void }) {
  return (
    <div
      data-testid="truncated"
      style={{
        border: `1px solid ${theme.warn}`,
        borderRadius: '12px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <span style={{ fontSize: '13px', color: theme.warn, lineHeight: 1.45 }}>
        {TRUNCATED_NOTE} The scorecard above is complete; the words are not.
      </span>
      {onRetry ? (
        <button type="button" style={ghostButton} data-testid="retry" onClick={onRetry}>
          Ask for the reading again
        </button>
      ) : null}
    </div>
  );
}

function Reading({
  outcome,
  onAnswer,
  onAgain,
  onRetry,
  deletion,
  onDeleteNow,
  streaming = false,
  saved = false,
  instant = false,
  onSave,
  onInstant,
  side = null,
  onChip,
}: {
  outcome: TurnOutcome;
  onAnswer: (text: string) => void;
  onAgain?: () => void;
  onRetry?: () => void;
  deletion?: DeleteOutcome;
  onDeleteNow?: () => void;
  /** the turn is still arriving — see `Running` */
  streaming?: boolean;
  /** the save offer was answered with `save` (ASTRAL-334) */
  saved?: boolean;
  /** the user chose the unsaved reading (ASTRAL-335) */
  instant?: boolean;
  onSave?: (offer: InputRequestPayload) => void;
  onInstant?: () => void;
  side?: ChipAnswerState | null;
  onChip?: (id: ChipId, label: string, plan: ChipPlan) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px' }}>
      {outcome.kind === 'scorecard' ? (
        <>
          <AstralBlock type="match_report" value={reportValue(outcome.text, outcome)} />
          <Reading0Narration text={outcome.text} drewBlock />
          {outcome.truncated ? <CutOff onRetry={onRetry} /> : null}

          {/* THE TWO OUTCOMES (ASTRAL-334/335). Offered only while the choice
              is still open — once it is made, the card below says what
              happened instead of asking again. */}
          {!streaming && !saved && !instant && outcome.saveOffer && capabilities.saveMatch ? (
            <TwoOutcomes
              offer={outcome.saveOffer}
              onSave={onSave}
              onInstant={onInstant}
            />
          ) : null}

          {saved ? <Saved note={side} /> : null}

          {/* A save that FAILED has to be visible (F306). It used to have
              nowhere to render — `side` was drawn only inside `Saved` (which
              needs `saved`) and inside the chips (which need the instant
              choice) — so a failed save left the offer card sitting there as
              if the button had not been pressed. */}
          {!saved && side?.id === 'save' ? <SaveProblem note={side} /> : null}

          {/* The retention card belongs to the UNSAVED reading. A saved one
              is theirs to keep and nothing is deleted. */}
          {!streaming && !saved ? (
            <Retention outcome={deletion ?? { kind: 'pending' }} onDeleteNow={onDeleteNow} />
          ) : null}

          {/* The common questions belong to the instant reading (ASTRAL-336). */}
          {!streaming && instant && !saved && onChip ? (
            <ChipRow report={outcome.report} answer={side} onPick={onChip} />
          ) : null}
        </>
      ) : null}

      {outcome.kind === 'ask' ? (
        <>
          <Reading0Narration text={outcome.text} />
          {/* The ONE input widget, rendering whatever the engine asked. The
              panel never builds an ask of its own and never decides which
              fields to ask for (ASTRAL-328). */}
          <AstralBlock type="input_request" value={outcome.request} />
        </>
      ) : null}

      {outcome.kind === 'text' ? (
        <>
          <Heading>Here is what came back</Heading>
          {/* The engine's own sentences, rendered as MARKDOWN — including a
              refusal. Nothing here re-words them, drops one or summarises. */}
          <Reading0Narration text={outcome.text} />
          {outcome.truncated ? <CutOff onRetry={onRetry} /> : null}
        </>
      ) : null}

      {outcome.kind === 'empty' ? (
        <>
          <Heading>Nothing came back</Heading>
          <p style={prose}>{outcome.reason}</p>
        </>
      ) : null}

      {onAgain ? (
        <button type="button" style={ghostButton} onClick={onAgain}>
          Read another match
        </button>
      ) : null}
      <AnswerBridge onAnswer={onAnswer} />
    </div>
  );
}

/**
 * The widget's answer leaves through the host (`main.tsx` installs it), and
 * the host needs the current run. This component is where the two meet.
 */
function AnswerBridge({ onAnswer }: { onAnswer: (text: string) => void }) {
  useEffect(() => {
    answerSink = onAnswer;
    return () => {
      answerSink = null;
    };
  }, [onAnswer]);
  return null;
}

let answerSink: ((text: string) => void) | null = null;

/** Called by the installed astral-dom host when a widget answer is composed. */
export function deliverWidgetAnswer(text: string): void {
  if (!answerSink) {
    // Loud rather than a tap that does nothing.
    console.warn('[astromatch] a widget answer arrived with no run to send it on');
    return;
  }
  answerSink(text);
}

function reportValue(_text: string, outcome: Extract<TurnOutcome, { kind: 'scorecard' }>): unknown {
  // `AstralBlock` re-parses what it is given, which is the package's
  // "parse, don't trust" rule. Handing it the already-parsed report back
  // through the same parser keeps one code path rather than two.
  return parseMatchReport(outcome.report) ?? outcome.report;
}

/**
 * What was kept and what was deleted (B1).
 *
 * Every sentence here comes from `retention-view.ts`, which is where the
 * claim is checked against what `DELETE /chats/{id}` actually removes. The
 * panel draws it and words nothing itself.
 */
function Retention({
  outcome,
  onDeleteNow,
}: {
  outcome: DeleteOutcome;
  onDeleteNow?: () => void;
}) {
  const notice = retentionNotice(outcome);
  const ink = notice.tone === 'warn' ? theme.warn : theme.border;
  return (
    <div
      data-testid="retention"
      style={{
        border: `1px solid ${ink}`,
        borderRadius: '12px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <span
        data-testid="retention-headline"
        style={{ fontSize: '13px', fontWeight: 600, color: notice.tone === 'warn' ? theme.warn : theme.text }}
      >
        {notice.headline}
      </span>
      <span style={{ fontSize: '12px', color: theme.textMuted, lineHeight: 1.45 }}>
        {notice.detail}
      </span>
      {outcome.kind === 'pending' && onDeleteNow ? (
        <button type="button" style={ghostButton} data-testid="delete-now" onClick={onDeleteNow}>
          Delete this reading now
        </button>
      ) : null}
      {notice.retry && onDeleteNow ? (
        <button type="button" style={ghostButton} data-testid="delete-retry" onClick={onDeleteNow}>
          Try deleting it again
        </button>
      ) : null}
    </div>
  );
}

/**
 * The choice, stated as two acts rather than as a default plus an escape
 * (docs/73 ASTRAL-334/335).
 *
 * Neither is pre-selected and neither happens on its own: the engine writes
 * nothing durable unless the offer is ANSWERED (F149), so "don't save" is
 * literally the absence of a message and "add to my matches" is one carrier
 * on the shipped ask. The sentence under each is what the user is choosing,
 * including the residue they would otherwise not know about.
 */
function TwoOutcomes({
  offer,
  onSave,
  onInstant,
}: {
  offer: InputRequestPayload;
  onSave?: (offer: InputRequestPayload) => void;
  onInstant?: () => void;
}) {
  return (
    <div
      data-testid="two-outcomes"
      style={{
        border: `1px solid ${theme.border}`,
        borderRadius: '12px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <span style={{ fontSize: '13px', fontWeight: 600, color: theme.text }}>
        Keep this match, or just read it?
      </span>
      <button
        type="button"
        data-testid="save-match"
        style={primaryButton}
        onClick={() => onSave?.(offer)}
      >
        Add to my matches
      </button>
      <span style={{ fontSize: '12px', color: theme.textMuted, lineHeight: 1.45 }}>
        They become a person on your account, with this scorecard, and you will
        find them in the Astral app under People and Matches. Every detail keeps
        a note of where it came from.
      </span>
      <button
        type="button"
        data-testid="instant-reading"
        style={ghostButton}
        onClick={() => onInstant?.()}
      >
        Instant reading — don't save
      </button>
      <span style={{ fontSize: '12px', color: theme.textMuted, lineHeight: 1.45 }}>
        Nothing is added to your matches. The conversation itself is saved in your
        history for a day and you can delete it.
      </span>
    </div>
  );
}

/** The save is still running, or it failed. Either way it is on screen. */
function SaveProblem({ note }: { note: ChipAnswerState }) {
  return (
    <div
      data-testid="save-problem"
      style={{
        border: `1px solid ${note.error ? theme.warn : theme.border}`,
        borderRadius: '12px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <span style={{ fontSize: '13px', fontWeight: 600, color: note.error ? theme.warn : theme.text }}>
        {note.error ? "I couldn't add them to your matches." : 'Adding them to your matches…'}
      </span>
      {note.error ? (
        <span style={{ fontSize: '12px', color: theme.textMuted, lineHeight: 1.45 }}>
          {`${note.error} Nothing was saved. Try again, or read the match afresh.`}
        </span>
      ) : null}
    </div>
  );
}

/** What happened after "Add to my matches", in the engine's own words. */
function Saved({ note }: { note: ChipAnswerState | null }) {
  return (
    <div
      data-testid="saved"
      style={{
        border: `1px solid ${theme.accent}`,
        borderRadius: '12px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <span style={{ fontSize: '13px', fontWeight: 600, color: theme.text }}>
        Added to your matches.
      </span>
      <span style={{ fontSize: '12px', color: theme.textMuted, lineHeight: 1.45 }}>
        Open the Astral app and you will find them under People, and this
        scorecard under Matches. This conversation stays in your history.
      </span>
      {note?.text ? <Reading0Narration text={note.text} /> : null}
      {note?.error ? (
        <span style={{ fontSize: '12px', color: theme.warn }}>{note.error}</span>
      ) : null}
    </div>
  );
}

/** The heading over each designed capture failure (ASTRAL-333, §4). */
const CAPTURE_FAILURE_HEADINGS: Record<string, string> = {
  unreadable: "I couldn't read that crop",
  capped: "That's today's captures",
  'too-large': 'That crop is too big',
  'signed-out': 'Your sign-in expired',
  unreachable: "I couldn't reach Astral",
};

/** The readable half of a turn, whatever kind it was. */
function outcomeText(outcome: TurnOutcome): string {
  if (outcome.kind === 'scorecard' || outcome.kind === 'text') return outcome.text;
  if (outcome.kind === 'ask') return outcome.text;
  if (outcome.kind === 'empty') return outcome.reason;
  return outcome.reason;
}

function Padded({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
      {children}
    </div>
  );
}

const prose: React.CSSProperties = {
  margin: 0,
  fontSize: '13px',
  color: theme.textMuted,
  lineHeight: 1.5,
};

const input: React.CSSProperties = {
  border: `1px solid ${theme.border}`,
  background: theme.surfaceAlt,
  color: theme.text,
  borderRadius: '10px',
  padding: '11px 12px',
  fontSize: '14px',
};

export { PANEL_WIDTH };
