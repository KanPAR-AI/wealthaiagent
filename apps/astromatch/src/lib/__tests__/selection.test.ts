/**
 * docs/73 ASTRAL-338 — "read my selection" injects once, on the click, and
 * returns a string.
 *
 * The row's verification, run rather than reviewed: the injected function's
 * own source is asserted to contain no `fetch`, no `chrome.` and no
 * `localStorage`; the injection call sites are inside gesture handlers; and a
 * page with nothing selected renders a sentence rather than an empty review.
 *
 * The site-adapter half of the row lives in `no-site-adapters.test.ts`, which
 * greps the BUILT BUNDLE as well as the source.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { PENDING_CAPTURE_TTL_MS, isPermissionRefusal } from '../capture';
import {
  SELECTION_EMPTY_NOTE,
  SELECTION_MAX_CHARS,
  SELECTION_MENU_ID,
  SELECTION_MENU_TITLE,
  classifySelection,
  classifySelectionError,
  isInjectionRefusal,
  readSelectionInPage,
  selectionInstructionFor,
  selectionIsFresh,
  takePendingSelection,
} from '../selection';

const SRC = join(__dirname, '..', '..');
const raw = (file: string) => readFileSync(join(SRC, file), 'utf8');
/** comments stripped — this app's comments name the banned things while
 *  forbidding them, and a grep that fired on its own documentation would
 *  teach people to delete the documentation. */
const codeOf = (file: string) =>
  raw(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const SW = codeOf('sw.ts');
const INJECTED = readSelectionInPage.toString();

describe('the injected function is the whole of what runs in the page', () => {
  it('reads the selection and returns it', () => {
    expect(INJECTED).toContain('window.getSelection()');
    expect(INJECTED).toContain('return');
    // …and the compiled function really does return a string. Run against
    // the DOM's own `getSelection`, stubbed at the seam Chrome would call.
    const spy = jest.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => '  Date of Birth: 14 May 1994  ',
    } as unknown as Selection);
    expect(typeof readSelectionInPage()).toBe('string');
    expect(readSelectionInPage()).toContain('14 May 1994');
    spy.mockRestore();
  });

  it('answers with an empty string when the page has no selection', () => {
    const spy = jest.spyOn(window, 'getSelection').mockReturnValue(null);
    expect(readSelectionInPage()).toBe('');
    spy.mockRestore();
  });

  it('cannot reach the network, Chrome, or any storage', () => {
    for (const banned of [
      'fetch',
      'chrome.',
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'XMLHttpRequest',
      'postMessage',
      'sendMessage',
      'addEventListener',
      'setInterval',
      'setTimeout',
    ]) {
      expect(INJECTED).not.toContain(banned);
    }
  });

  it('knows nothing about any site: no selector, no hostname, no map', () => {
    for (const banned of [
      'querySelector',
      'getElementById',
      'getElementsByClassName',
      'hostname',
      'location',
      'className',
      'innerText',
      'innerHTML',
    ]) {
      expect(INJECTED).not.toContain(banned);
    }
  });

  it('is small enough that the assertions above cover all of it', () => {
    // A guard against the function growing a body the greps above do not
    // describe: three statements is what the row allows.
    expect(INJECTED.length).toBeLessThan(220);
  });

  it('the greps would actually catch a leak', () => {
    // anti-vacuity: a function that posted the selection somewhere.
    const leaky = String(function leak() {
      return fetch('https://example.com', { method: 'POST' });
    });
    expect(leaky).toContain('fetch');
  });
});

describe('the injection happens once, from a gesture, and nowhere else', () => {
  it('calls chrome.scripting.executeScript in exactly one place', () => {
    expect((SW.match(/executeScript/g) ?? []).length).toBe(1);
  });

  it('injects the MODULE-LEVEL function, not an inline closure', () => {
    // An inline function would be invisible to the assertions above: Chrome
    // serialises whatever it is given, and only a named function can be read
    // whole by a reviewer and by this test.
    expect(SW).toContain('func: readSelectionInPage');
  });

  it('has exactly three call sites, one per gesture, each a literal', () => {
    const calls = SW.match(/readSelection\('([a-z-]+)'/g) ?? [];
    expect(calls).toHaveLength(3);
    expect(calls.sort()).toEqual([
      "readSelection('command'",
      "readSelection('context-menu'",
      "readSelection('panel-button'",
    ]);
  });

  it('never injects on panel open, on a tab change, or on a timer', () => {
    expect(SW).not.toMatch(/onUpdated[\s\S]{0,200}executeScript/);
    expect(SW).not.toMatch(/onActivated[\s\S]{0,200}executeScript/);
    expect(SW).not.toMatch(/set(Timeout|Interval)[\s\S]{0,200}executeScript/);
    expect(SW).not.toMatch(/executeScript[\s\S]{0,200}set(Timeout|Interval)/);
  });

  it('declares no content script anywhere in the source', () => {
    // The KEY, not the word: `manifest.ts` names `content_scripts` in the
    // reason it gives for `scripting` — which is the sentence a store
    // reviewer reads — and that is the opposite of declaring one.
    expect(codeOf('lib/manifest.ts')).not.toMatch(/content_scripts\s*:/);
    expect(SW).not.toContain('content_scripts');
  });

  it('asks for the tab id only — never the URL or the title of a tab', () => {
    expect(SW).toContain('chrome.tabs.query({ active: true, currentWindow: true })');
    expect(SW).not.toMatch(/tab\??\.url/);
    expect(SW).not.toMatch(/tab\??\.title/);
  });

  it('routes the selection MENU item to the selection read, not the camera', () => {
    expect(SW).toMatch(/SELECTION_MENU_ID[\s\S]{0,200}readSelection\('context-menu'/);
    expect(SELECTION_MENU_ID).toBe('astromatch.selection');
  });
});

describe('what a read produced, said as a state', () => {
  it('carries the text and the gesture on a real selection', () => {
    expect(classifySelection('  Name: Asha  ', 'command')).toEqual({
      kind: 'selected',
      text: 'Name: Asha',
      gesture: 'command',
    });
  });

  it('an empty or whitespace selection is `empty`, never an empty review', () => {
    expect(classifySelection('', 'panel-button').kind).toBe('empty');
    expect(classifySelection('   \n  ', 'panel-button').kind).toBe('empty');
    // the frame answered with nothing at all
    expect(classifySelection(undefined, 'panel-button').kind).toBe('empty');
    expect(classifySelection(null, 'panel-button').kind).toBe('empty');
    expect(classifySelection(42, 'panel-button').kind).toBe('empty');
  });

  it('bounds a whole-page selection at the stated length', () => {
    const outcome = classifySelection('x'.repeat(SELECTION_MAX_CHARS + 500), 'command');
    if (outcome.kind !== 'selected') throw new Error('expected a selection');
    expect(outcome.text).toHaveLength(SELECTION_MAX_CHARS);
  });

  it('says what the missing step is, in the user\'s own terms', () => {
    expect(SELECTION_EMPTY_NOTE).toBe(
      'Select the birth details on the page first, then try again.',
    );
    // …and the panel renders that exact sentence rather than writing its own
    expect(codeOf('panel/app.tsx')).toContain('SELECTION_EMPTY_NOTE');
  });
});

describe('Chrome refusing, classified rather than shown raw', () => {
  const MEASURED = "Either the '<all_urls>' or 'activeTab' permission is required.";
  /**
   * F382, measured in Chromium 145 on 2026-09-19 (`e2e/ph41-walk.mjs`): the
   * INJECTION is refused with a different sentence from the camera's, naming
   * neither `activeTab` nor a host pattern. Before this case the panel showed
   * that sentence to the user instead of the two gestures that grant the
   * access — the exact failure ASTRAL-338's instruction state exists to
   * remove, and the walk's own screenshot is what caught it.
   */
  const MEASURED_INJECTION =
    'Cannot access contents of the page. Extension manifest must request ' +
    'permission to access the respective host.';

  it('a permission refusal becomes the gesture instruction', () => {
    expect(classifySelectionError(MEASURED)).toEqual({ kind: 'needs-gesture' });
  });

  it('the INJECTION\'s own refusal sentence becomes it too (F382)', () => {
    expect(classifySelectionError(MEASURED_INJECTION)).toEqual({ kind: 'needs-gesture' });
    // …and the camera's predicate would NOT have caught it, which is the
    // finding rather than an incidental detail
    expect(isPermissionRefusal(MEASURED_INJECTION)).toBe(false);
    expect(isInjectionRefusal(MEASURED_INJECTION)).toBe(true);
    expect(isInjectionRefusal(MEASURED)).toBe(true);
  });

  it('anything else is named with its own sentence, never swallowed', () => {
    const outcome = classifySelectionError('Cannot access a chrome:// URL');
    expect(outcome).toEqual({ kind: 'failed', reason: 'Cannot access a chrome:// URL' });
  });

  it('an empty message still yields a sentence', () => {
    const outcome = classifySelectionError('');
    if (outcome.kind !== 'failed') throw new Error('expected a failure');
    expect(outcome.reason.length).toBeGreaterThan(20);
  });
});

describe('the instruction names the SELECTION gestures', () => {
  it('names the shortcut Chrome actually bound', () => {
    const instruction = selectionInstructionFor('⌥⇧S');
    expect(instruction.steps[0]).toContain('⌥⇧S');
    expect(instruction.steps.join(' ')).toContain(SELECTION_MENU_TITLE);
  });

  it('says so when Chrome bound nothing, instead of naming a dead key', () => {
    const instruction = selectionInstructionFor(null);
    expect(instruction.steps[0]).toContain('chrome://extensions/shortcuts');
    expect(instruction.steps.join(' ')).toContain(SELECTION_MENU_TITLE);
  });

  it('never sends the user to the camera\'s door', () => {
    for (const shortcut of ['⌥⇧S', null]) {
      const steps = selectionInstructionFor(shortcut).steps.join(' ');
      expect(steps).not.toContain('Read this page into AstroMatch');
    }
  });
});

describe('the hand-off slot holds one selection, and lets go of it', () => {
  const pending = { text: 'Name: Asha', gesture: 'command' as const, at: 1_000 };

  it('is fresh inside the shared TTL and stale outside it', () => {
    expect(selectionIsFresh(pending, 1_000 + PENDING_CAPTURE_TTL_MS - 1)).toBe(true);
    expect(selectionIsFresh(pending, 1_000 + PENDING_CAPTURE_TTL_MS)).toBe(false);
    expect(selectionIsFresh(null, 1_000)).toBe(false);
  });

  it('empties the slot whichever branch ran', () => {
    expect(takePendingSelection(pending, 1_500)).toEqual({ taken: pending, slot: null });
    expect(takePendingSelection(pending, 1_000 + PENDING_CAPTURE_TTL_MS + 1)).toEqual({
      taken: null,
      slot: null,
    });
  });

  it('is never written to storage — the worker drops it on suspend', () => {
    expect(codeOf('sw.ts')).toMatch(/onSuspend[\s\S]{0,200}pendingSelection = null/);
    expect(codeOf('lib/selection.ts')).not.toContain('chrome.storage');
    expect(codeOf('sw.ts')).not.toMatch(/storage[\s\S]{0,80}pendingSelection/);
  });
});

describe('the text never leaves the browser (ASTRAL-338)', () => {
  it('the selection path parses locally and sends nothing', () => {
    const app = codeOf('panel/app.tsx');
    // The handler's OWN body, sliced out rather than a window of characters:
    // a fixed window says more about the file's layout than about the code.
    const start = app.indexOf('const takeSelection');
    const end = app.indexOf('const askForSelection');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = app.slice(start, end);
    // the one thing a selection becomes is a local parse on the review screen
    expect(body).toContain("parseProfileText(text, 'selection')");
    // …and never the extractor, which is the paid, capped, image path
    for (const banned of ['extractProfile', 'fetch(', 'startMatch', 'sendCrop']) {
      expect(body).not.toContain(banned);
    }
  });

  it('the worker has no selection endpoint to send it to', () => {
    expect(SW).not.toContain('selection/extract');
    expect(SW).not.toMatch(/post\([^)]*selection/);
  });
});
