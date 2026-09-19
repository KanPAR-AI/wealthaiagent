/**
 * The camera's decisions, and where the capture may be called from
 * (docs/73 ASTRAL-330, F159).
 *
 * The row's verification is a GREP: "the capture call is reachable only from
 * a gesture handler (a grep over the module for the call site, asserted to be
 * inside the three handlers)". That is the second half of this file, and it
 * is written so that a capture on panel mount, on a tab change or on a timer
 * makes it red rather than making it think.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  CONTEXT_MENU_ID,
  CONTEXT_MENU_TITLE,
  CURRENT_WINDOW,
  PENDING_CAPTURE_TTL_MS,
  classifyCaptureError,
  instructionFor,
  isPermissionRefusal,
  pendingIsFresh,
  takePending,
} from '../capture';
import {
  CONSENT_LOG_MAX,
  appendConsentLog,
  consentFor,
  consentedTo,
  extractRequestBody,
} from '../consent';

/** Measured in Chromium 145.0.7632.6 by `e2e/spike-f159.mjs`, 2026-09-19. */
const MEASURED_REFUSAL = "Either the '<all_urls>' or 'activeTab' permission is required.";

/** The older wording, from the Chrome versions that said it differently. */
const OLDER_REFUSAL = "The '<all_urls>' permission is required.";

describe('a refusal is recognised, not pinned to one sentence', () => {
  it('recognises the sentence Chromium 145 actually returns', () => {
    expect(isPermissionRefusal(MEASURED_REFUSAL)).toBe(true);
    expect(classifyCaptureError(MEASURED_REFUSAL)).toEqual({ kind: 'needs-gesture' });
  });

  it('does not treat every failure as a permission problem', () => {
    // A tab that cannot be captured at all is a different outcome with a
    // different next step, and offering the shortcut for it would send the
    // user round a loop that cannot end.
    const other = classifyCaptureError('Failed to capture tab: chrome://extensions/');
    expect(other.kind).toBe('failed');
    expect(isPermissionRefusal(other.kind === 'failed' ? other.reason : '')).toBe(false);
  });

  it('never produces an empty sentence', () => {
    const out = classifyCaptureError('');
    expect(out.kind).toBe('failed');
    expect(out.kind === 'failed' && out.reason.length).toBeGreaterThan(10);
  });

  it('does not match a sentence that merely mentions permissions', () => {
    expect(isPermissionRefusal(OLDER_REFUSAL)).toBe(false);
    expect(isPermissionRefusal('The user denied the microphone permission')).toBe(false);
  });
});

describe('the instruction names gestures that exist', () => {
  it('names the shortcut CHROME BOUND, and the menu item', () => {
    const instruction = instructionFor('Alt+Shift+M');
    expect(instruction.steps[0]).toContain('Alt+Shift+M');
    expect(instruction.steps.join(' ')).toContain(CONTEXT_MENU_TITLE);
    expect(instruction.headline).not.toMatch(/error|failed|sorry/i);
  });

  it('does NOT name a shortcut Chrome left unbound', () => {
    // `suggested_key` is a suggestion: another extension may hold
    // Alt+Shift+M. An instruction naming a key that does nothing is the same
    // dead affordance as a button that does nothing, one step further away.
    const instruction = instructionFor(null);
    expect(instruction.steps.join(' ')).not.toContain('Alt+Shift+M');
    expect(instruction.steps.join(' ')).toContain('chrome://extensions/shortcuts');
    expect(instruction.steps.join(' ')).toContain(CONTEXT_MENU_TITLE);
  });

  it('always leaves at least one door that works', () => {
    for (const shortcut of ['Alt+Shift+M', null]) {
      expect(instructionFor(shortcut).steps.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('the hand-off slot holds one capture and lets go of it', () => {
  const capture = { image: 'data:image/png;base64,AAAA', gesture: 'command' as const, at: 1_000 };

  it('hands a fresh capture over exactly once', () => {
    const first = takePending(capture, 1_500);
    expect(first.taken).toBe(capture);
    expect(first.slot).toBeNull();
    // the slot the caller now holds is empty, so a second ask gets nothing
    expect(takePending(first.slot, 1_600).taken).toBeNull();
  });

  it('drops a capture nobody collected, rather than keeping it', () => {
    expect(pendingIsFresh(capture, 1_000 + PENDING_CAPTURE_TTL_MS + 1)).toBe(false);
    const stale = takePending(capture, 1_000 + PENDING_CAPTURE_TTL_MS + 1);
    expect(stale.taken).toBeNull();
    expect(stale.slot).toBeNull();
  });

  it('empties the slot on BOTH branches', () => {
    expect(takePending(capture, 1_500).slot).toBeNull();
    expect(takePending(null, 1_500).slot).toBeNull();
  });
});

// ── the structural half: where the capture may be called from ──────────────

const SW = readFileSync(join(__dirname, '..', '..', 'sw.ts'), 'utf8');

/** comments stripped — this module documents the API by name while
 *  forbidding stray calls to it, and a grep that tripped on its own
 *  documentation would teach people to delete the documentation. */
const SW_CODE = SW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the capture is reachable ONLY from a gesture handler (ASTRAL-330)', () => {
  it('calls chrome.tabs.captureVisibleTab in exactly one place', () => {
    expect((SW_CODE.match(/captureVisibleTab/g) ?? []).length).toBe(1);
  });

  it('calls that one place exactly three times, once per gesture', () => {
    // THREE call sites and ONE definition. They are counted separately
    // because the definition's signature now spans two lines (R4 added the
    // window id), and a pattern that tried to cover both would have to be
    // loose enough to miss a fourth caller.
    const calls = SW_CODE.match(/captureTab\('/g) ?? [];
    expect(calls.length).toBe(3);
    expect((SW_CODE.match(/function captureTab\(/g) ?? []).length).toBe(1);
    // The gesture is the FIRST argument and it is always a literal; a
    // second argument (the window the gesture fired in, R4) may follow.
    expect(SW_CODE).toContain("captureTab('command'");
    expect(SW_CODE).toContain("captureTab('context-menu'");
    expect(SW_CODE).toContain("captureTab('panel-button'");
  });

  it('every call site names its gesture as a LITERAL — none takes a variable', () => {
    // A call whose argument is a variable would let a fourth caller in
    // through an indirection, and this grep would have to reason about it.
    const sites = (SW_CODE.match(/captureTab\('[a-z-]+'[,)]/g) ?? []).length;
    const definitions = (SW_CODE.match(/function captureTab\(/g) ?? []).length;
    expect(sites + definitions).toBe(4);
  });

  it('puts each call inside the handler it belongs to', () => {
    const commandAt = SW_CODE.indexOf('chrome.commands.onCommand.addListener');
    const menuAt = SW_CODE.indexOf('chrome.contextMenus.onClicked.addListener');
    const panelAt = SW_CODE.indexOf("case 'capture/request'");
    expect(commandAt).toBeGreaterThan(-1);
    expect(menuAt).toBeGreaterThan(-1);
    expect(panelAt).toBeGreaterThan(-1);

    const after = (from: number) => SW_CODE.slice(from, from + 600);
    expect(after(commandAt)).toContain("captureTab('command'");
    expect(after(menuAt)).toContain("captureTab('context-menu'");
    expect(after(panelAt)).toContain("captureTab('panel-button'");
  });

  it('captures on no timer, no tab change and no panel open', () => {
    expect(SW_CODE).not.toMatch(/setInterval|setTimeout[\s\S]{0,120}captureTab/);
    expect(SW_CODE).not.toMatch(/onUpdated[\s\S]{0,200}captureTab/);
    expect(SW_CODE).not.toMatch(/onActivated[\s\S]{0,200}captureTab/);
    // the module-evaluation sweep is the only top-level `void` call
    const topLevel = SW_CODE.match(/^void [a-zA-Z]+\(/gm) ?? [];
    expect(topLevel).toEqual(['void sweep(']);
  });

  it('would catch a capture added on panel mount', () => {
    // anti-vacuity: the sample the grep above is supposed to fail on
    const sample = "chrome.runtime.onConnect.addListener(() => { void captureTab('panel-button'); });";
    expect((sample.match(/captureTab\('panel-button'[,)]/g) ?? []).length).toBe(1);
    // adding it to the module would make the count 4, which the second case
    // asserts is 3
    expect((`${SW_CODE}\n${sample}`.match(/captureTab\('/g) ?? []).length).toBe(4);
  });
});

describe('the context menu is created by the phase that can honour it', () => {
  it('creates the item, with the title the instruction names', () => {
    expect(SW_CODE).toContain('chrome.contextMenus.create');
    // The id and the title come from THIS module, not from a literal the
    // click handler could drift from — the create and the onClicked test
    // have to agree or the item is unclickable.
    expect(SW_CODE).toContain('id: CONTEXT_MENU_ID, title: CONTEXT_MENU_TITLE');
    expect(SW_CODE).toContain('info.menuItemId !== CONTEXT_MENU_ID');
    expect(CONTEXT_MENU_ID).toBe('astromatch.capture');
    expect(CONTEXT_MENU_TITLE).toBe('Read this page into AstroMatch');
  });

  it('reads lastError rather than leaving it unhandled', () => {
    const at = SW_CODE.indexOf('chrome.contextMenus.create');
    expect(SW_CODE.slice(at, at + 400)).toContain('chrome.runtime.lastError');
  });
});

// ── ASTRAL-337 · the image never persists, structurally ────────────────────

describe('the capture modules cannot store anything (ASTRAL-337)', () => {
  /**
   * The four files the image passes through. A `chrome.storage` call in any
   * of them is how "the crop lives in memory only" stops being true — and it
   * would stop being true silently, because the panel would look identical.
   *
   * The worker is NOT on this list and must not be: it writes the pending
   * DELETE ids and the consent record, both of which are ids and words. What
   * it may not write is bytes, and `outcomes.test.tsx` scans the whole store
   * for them rather than trusting a list of keys.
   */
  const CAPTURE_MODULES = [
    ['src/lib/capture.ts', '../capture.ts'],
    ['src/lib/crop.ts', '../crop.ts'],
    ['src/lib/consent.ts', '../consent.ts'],
    ['src/panel/crop.tsx', '../../panel/crop.tsx'],
  ] as const;

  it.each(CAPTURE_MODULES)('%s never touches chrome.storage', (_name, rel) => {
    const code = readFileSync(join(__dirname, rel), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/chrome\.storage/);
    expect(code).not.toMatch(/localStorage|sessionStorage|indexedDB/);
  });

  it.each(CAPTURE_MODULES)('%s keeps no module-level cache of an image', (_name, rel) => {
    const code = readFileSync(join(__dirname, rel), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    // a top-level `let`/`var` is where a "last capture, for convenience"
    // would live. `const` declarations are pure values and functions.
    const topLevelMutable = code.match(/^(let|var)\s+\w+/gm) ?? [];
    expect(topLevelMutable).toEqual([]);
  });

  it('would catch a cache added to one of them', () => {
    // anti-vacuity
    const sample = "let lastCapture: string | null = null;";
    expect((sample.match(/^(let|var)\s+\w+/gm) ?? []).length).toBe(1);
  });
});

describe('the consent record is words and times, never a capture', () => {
  it('appends, and never grows without bound', () => {
    let log: unknown = undefined;
    for (let i = 0; i < CONSENT_LOG_MAX + 10; i += 1) {
      log = appendConsentLog(log, { version: 1, text: 'x', at: `2026-09-19T00:00:0${i % 10}Z` });
    }
    expect((log as unknown[]).length).toBe(CONSENT_LOG_MAX);
  });

  it('drops an entry that is not one, rather than carrying it', () => {
    const log = appendConsentLog([{ nonsense: true }, null, 'x'], {
      version: 1,
      text: 'y',
      at: '2026-09-19T00:00:00Z',
    });
    expect(log).toEqual([{ version: 1, text: 'y', at: '2026-09-19T00:00:00Z' }]);
  });

  it('the request body it guards is ONE key', () => {
    expect(extractRequestBody('data:image/png;base64,AAAA')).toEqual({
      image: 'data:image/png;base64,AAAA',
    });
    expect(Object.keys(extractRequestBody('x'))).toEqual(['image']);
  });

  it('a consent for one capture does not carry to the next', () => {
    const given = consentFor('capture-1', 1000);
    expect(consentedTo(given, 'capture-1')).toBe(true);
    expect(consentedTo(given, 'capture-2')).toBe(false);
    expect(consentedTo(null, 'capture-1')).toBe(false);
  });

  it('a consent given to DIFFERENT words does not count', () => {
    // If the sentence changes, the agreement to the old one is not an
    // agreement to the new one.
    const stale = { ...consentFor('capture-1', 1000), text: 'something else' };
    expect(consentedTo(stale, 'capture-1')).toBe(false);
  });
});

// ── F306 · no dynamic import in an MV3 service worker ─────────────────────

describe('R4 — the capture names the window the gesture fired in', () => {
  it('passes a window id, with the current window as the fallback', () => {
    expect(SW_CODE).toContain('captureVisibleTab(windowId ?? CURRENT_WINDOW');
    expect(CURRENT_WINDOW).toBe(-2);
  });

  it('gives both gesture handlers the tab\'s OWN window', () => {
    expect(SW_CODE).toContain("captureTab('command', tab?.windowId)");
    expect(SW_CODE).toContain("captureTab('context-menu', tab?.windowId)");
  });
});

describe('R3 — a stale hand-off is dropped, not merely filtered', () => {
  it('drops it on every worker door, and on suspend', () => {
    expect((SW_CODE.match(/dropStalePending\(\);/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(SW_CODE).toMatch(/onSuspend\.addListener\([\s\S]{0,120}pendingCapture = null/);
  });

  it('and the drop actually LETS GO — the body, pinned', () => {
    // There is no way to observe this from outside the worker: `takePending`
    // filters at read time too, so the panel gets `null` whether the bytes
    // were released or merely hidden. "Would not be handed over" and "is
    // gone" are different promises and only the second one is the claim, so
    // the body is what the test binds to.
    const body = SW_CODE.slice(
      SW_CODE.indexOf('function dropStalePending'),
      SW_CODE.indexOf('function dropStalePending') + 240,
    );
    expect(body).toContain('pendingIsFresh(pendingCapture, Date.now())');
    expect(body).toContain('pendingCapture = null');
  });

  it('uses no timer to do it — the grep above bans one near the capture', () => {
    expect(SW_CODE).not.toMatch(/setTimeout|setInterval/);
  });
});

describe('the worker loads everything statically (F306)', () => {
  /**
   * MEASURED, not read in a doc. `sayAndRun` used to do
   * `const { sendChatMessage } = await import('@wealthai/core')`. In an MV3
   * service worker, a dynamic import after the worker has been evaluated
   * DOES NOT RESOLVE: the promise never settles, nothing throws, and the
   * caller waits forever.
   *
   * What that looked like: "Add to my matches" posted the carrier, the
   * worker received it on the port (proved with a log), and then nothing
   * happened — no message on the chat, no error, no state change, a card
   * still offering to save. Four minutes of waiting, twice.
   *
   * PH-39 never met it because `sayAndRun` is only reached when the USER
   * answers a widget, and its walk had the worker auto-answer through
   * `answerAsk`, which uses the static import in `transport.ts`.
   */
  it('has no dynamic import() anywhere', () => {
    expect(SW_CODE).not.toMatch(/\bawait\s+import\s*\(/);
    expect(SW_CODE).not.toMatch(/\bimport\s*\(\s*['"`]/);
  });

  it('imports what it sends messages with, at the top', () => {
    expect(SW_CODE).toMatch(/^import\s*\{[^}]*sendChatMessage[^}]*\}\s*from '@wealthai\/core';/m);
  });

  it('would catch the pattern coming back', () => {
    const sample = "const { sendChatMessage } = await import('@wealthai/core');";
    expect(sample).toMatch(/\bawait\s+import\s*\(/);
  });
});
