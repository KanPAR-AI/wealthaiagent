/**
 * The F159 spike — `activeTab` and a button inside the side panel.
 *
 * docs/73 F159 says, in as many words, that the answer may not be asserted
 * from documentation: `chrome.tabs.captureVisibleTab` needs `activeTab` or a
 * host permission for the captured tab, `activeTab` is granted by a gesture
 * ON THE EXTENSION, and whether the grant from the action click that opened
 * the panel still covers a capture from a BUTTON INSIDE the panel minutes
 * later is the open question.
 *
 * WHAT THIS SCRIPT CAN AND CANNOT ANSWER, said before the output so nobody
 * reads more into the numbers than they carry:
 *
 *   CAN   — whether a capture from the panel document succeeds with NO
 *           extension gesture at all (the pessimistic branch), and the exact
 *           sentence Chrome refuses it with.
 *   CAN   — whether a host-permission match is enough on its own (it is the
 *           other way the dev build could capture, and it must not be
 *           mistaken for an `activeTab` grant).
 *   CAN   — whether the `commands` shortcut and the `contextMenus` item are
 *           registered at all, which is what makes them offerable.
 *   CANNOT— click Chrome's own toolbar action, press a BROWSER-level keyboard
 *           command, or open a native context menu. Playwright drives the
 *           renderer; all three are browser-process gestures. So the exact
 *           F159 question — "does the grant from the action click reach a
 *           button in the panel" — is answered by a HUMAN run, and this
 *           script prints the one line that run has to report.
 *
 * Which is why the build does not depend on the answer: the panel's camera
 * button ASKS the worker to capture, and the worker either captures or says
 * it cannot, and the panel renders the instruction naming the two gestures
 * that grant `activeTab` unambiguously. A button that cannot capture becomes
 * words, never a no-op (ASTRAL-330).
 *
 *   cd wealthaiagent/apps/astromatch && npm run build:dev && node e2e/spike-f159.mjs
 */

import { createServer } from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { chromium } from 'playwright-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, '..', 'dist');

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Synthetic biodata</title></head>
<body style="font-family:sans-serif;padding:40px">
<h1>Synthetic Profile — not a real person</h1>
<table><tr><td>Name</td><td>Asha Verma</td></tr>
<tr><td>Date of Birth</td><td>14 May 1994</td></tr>
<tr><td>Place of Birth</td><td>Pune</td></tr></table>
</body></html>`;

const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(PAGE);
});
await new Promise((r) => server.listen(8099, r));

const context = await chromium.launchPersistentContext('', {
  headless: !process.env.HEADED,
  channel: 'chromium',
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});

const say = (k, v) => console.log(`  ${k.padEnd(46)} ${v}`);

try {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15_000 });
  const id = new URL(worker.url()).host;
  console.log(`\nF159 SPIKE — extension ${id}`);
  console.log(`Chromium: ${context.browser()?.version() ?? 'persistent context (see below)'}`);

  // ── what Chrome registered ───────────────────────────────────────────────
  const commands = await worker.evaluate(async () => {
    try {
      return (await chrome.commands.getAll()).map((c) => `${c.name}=${c.shortcut || '(unbound)'}`);
    } catch (e) {
      return [`ERROR ${String(e)}`];
    }
  });
  say('chrome.commands.getAll()', JSON.stringify(commands));

  const menus = await worker.evaluate(
    () =>
      new Promise((resolve) => {
        // There is no getAll for contextMenus; creating a duplicate id is the
        // observable test — it fails with "Cannot create item with duplicate id".
        chrome.contextMenus.create({ id: 'astromatch.capture', title: 'probe' }, () => {
          resolve(chrome.runtime.lastError ? chrome.runtime.lastError.message : 'created (so it did NOT exist)');
        });
      }),
  );
  say('contextMenus duplicate-id probe', JSON.stringify(menus));

  // ── the capture, from the panel document, with NO extension gesture ──────
  const ordinary = await context.newPage();
  await ordinary.goto('https://example.com/', { waitUntil: 'domcontentloaded' });
  await ordinary.bringToFront();

  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${id}/panel.html`);
  // The panel is a TAB here, not Chrome's side panel — Playwright cannot open
  // the real one. For this measurement that is the same thing: it is an
  // extension document with no gesture behind it.
  await ordinary.bringToFront();

  const noGesture = await panel.evaluate(
    () =>
      new Promise((resolve) => {
        chrome.tabs.captureVisibleTab({ format: 'png' }, (data) => {
          resolve(
            chrome.runtime.lastError
              ? `REFUSED: ${chrome.runtime.lastError.message}`
              : `CAPTURED ${String(data).length} chars`,
          );
        });
      }),
  );
  say('panel → captureVisibleTab, no gesture, https page', JSON.stringify(noGesture));

  const fromWorker = await worker.evaluate(
    () =>
      new Promise((resolve) => {
        chrome.tabs.captureVisibleTab({ format: 'png' }, (data) => {
          resolve(
            chrome.runtime.lastError
              ? `REFUSED: ${chrome.runtime.lastError.message}`
              : `CAPTURED ${String(data).length} chars`,
          );
        });
      }),
  );
  say('worker → captureVisibleTab, no gesture, https page', JSON.stringify(fromWorker));

  // ── a host-permission match (the DEV build names localhost) ──────────────
  const local = await context.newPage();
  await local.goto('http://localhost:8099/', { waitUntil: 'domcontentloaded' });
  await local.bringToFront();
  const hostPerm = await worker.evaluate(
    () =>
      new Promise((resolve) => {
        chrome.tabs.captureVisibleTab({ format: 'png' }, (data) => {
          resolve(
            chrome.runtime.lastError
              ? `REFUSED: ${chrome.runtime.lastError.message}`
              : `CAPTURED ${String(data).length} chars`,
          );
        });
      }),
  );
  say('worker → captureVisibleTab, localhost:8099 page', JSON.stringify(hostPerm));

  const declaredHosts = await worker.evaluate(() => chrome.runtime.getManifest().host_permissions);
  say('manifest host_permissions (dev build)', JSON.stringify(declaredHosts));

  console.log(
    '\nRead this as: a host-permission CAPTURE is not an activeTab grant. The\n' +
      'grant question (action click → a button in the panel) needs a human at a\n' +
      'real Chrome; the build does not wait on it.\n',
  );
} finally {
  await context.close();
  server.close();
}
