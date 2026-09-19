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

import { useCallback, useEffect, useState } from 'react';
import { DARK_THEME, parseMatchReport, withoutScorecardFallback } from '@wealthai/astral';
import { AstralBlock, Narration } from '@wealthai/astral-dom';

import { capabilities } from '../lib/capabilities';
import { PANEL_WIDTH } from '../lib/config';
import { type CaptureSource, type ConfirmedProfile, type ParsedProfile } from '../lib/confirmed';
import type { MatchEvent } from '../lib/messages';
import { parseProfileText } from '../lib/parse-profile';
import { TRUNCATED_NOTE, readTurn, type TurnOutcome } from '../lib/transport';
import { needsDelete, retentionNotice, type DeleteOutcome } from '../lib/retention-view';
import {
  authState,
  deleteReading,
  sendCode,
  signOut,
  startMatch,
  verifyCode,
  type MatchRun,
} from './bridge';
import { Heading, ReviewScreen, ghostButton, primaryButton } from './review';

const theme = DARK_THEME;

type Screen =
  | { name: 'loading' }
  | { name: 'signed-out'; notice?: string }
  | { name: 'choose' }
  | { name: 'paste' }
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
    setDeletion({ kind: 'pending' });
    setScreen({ name: 'running', text: '' });
    setRun(startMatch(profile, `Match — ${profile.name}`, onEvent));
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
    // PH-39 never answers the save offer, so `saved` is false by
    // construction here. It is a parameter rather than a constant because
    // PH-40 adds the save, and a reading the user KEPT must not be deleted.
    if (!needsDelete(chatId, false)) {
      then();
      return;
    }
    setDeletion({ kind: 'deleting' });
    const outcome = await deleteReading(chatId as string);
    if (outcome.deleted) {
      setDeletion({ kind: 'deleted' });
      run?.close();
      setRun(null);
      then();
      return;
    }
    // Stay where they are: a failed delete they cannot see is the silent
    // version of the sentence this whole path exists to make true.
    setDeletion({ kind: 'failed', reason: outcome.reason });
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
  notice,
}: {
  onManual: () => void;
  onPaste: () => void;
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
      {capabilities.manualEntry ? (
        <button type="button" style={primaryButton} data-testid="manual" onClick={onManual}>
          Type their details
        </button>
      ) : null}
      {capabilities.paste ? (
        <button type="button" style={ghostButton} data-testid="paste" onClick={onPaste}>
          Paste their biodata
        </button>
      ) : null}
      {/* The camera and the selection read are ABSENT, not disabled: a
          capability marked false removes its control (doctrine 8). Nothing
          here promises them. */}
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
}: {
  outcome: TurnOutcome;
  onAnswer: (text: string) => void;
  onAgain?: () => void;
  onRetry?: () => void;
  deletion?: DeleteOutcome;
  onDeleteNow?: () => void;
  /** the turn is still arriving — see `Running` */
  streaming?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px' }}>
      {outcome.kind === 'scorecard' ? (
        <>
          <AstralBlock type="match_report" value={reportValue(outcome.text, outcome)} />
          <Reading0Narration text={outcome.text} drewBlock />
          {outcome.truncated ? <CutOff onRetry={onRetry} /> : null}
          {streaming ? null : (
            <Retention outcome={deletion ?? { kind: 'pending' }} onDeleteNow={onDeleteNow} />
          )}
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
