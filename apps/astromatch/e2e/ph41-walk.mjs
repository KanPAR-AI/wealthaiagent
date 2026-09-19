/**
 * PH-41 alone, in a real Chromium with the built extension loaded
 * (docs/73 ASTRAL-338…341).
 *
 * The same legs `walk.mjs` runs — imported, not copied — with nothing before
 * them. It exists because the local backend reloads on every file change
 * another agent makes (F307) and a reload kills the SSE turn in flight: the
 * full walk spends two streamed readings before PH-41 is reached, and on a
 * busy afternoon it never gets there. This reaches the PH-41 legs in seconds
 * and the only streamed turn in them is the per-match chat.
 *
 *   cd wealthaiagent/apps/astromatch
 *   npm run build:dev && node e2e/ph41-walk.mjs     # HEADED=1 to watch it
 *
 * ⚠ IT CREATES REAL DATA on whatever account the local container is
 * configured as — one time-less saved match, so the firm-only group has a row
 * — and deletes it at the end. Check `SKIP_AUTH_USER_ID` first (docs/51 §3).
 *
 * A REFUSED row cannot be minted from the product at all; seed one with
 * `e2e/seed-refused-match.py` or the refused checks SKIP and say so.
 */

import { createServer } from 'http';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { chromium } from 'playwright-core';

import { SYNTHETIC_PAGES } from './pages.mjs';
import { ph41Legs } from './legs-ph41.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const DIST = join(APP, 'dist');
const SHOTS = join(APP, 'e2e-artifacts');
const API = 'http://localhost:8080/api/v1';
const TOKEN = 'dev_token';

mkdirSync(SHOTS, { recursive: true });

// The SYNTHETIC page the selection is read from. No matrimonial site is ever
// visited, screenshotted or committed.
const pageServer = createServer((req, res) => {
  const path = (req.url ?? '').split('?')[0];
  const body = SYNTHETIC_PAGES[path];
  if (body) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(body);
    return;
  }
  res.writeHead(204);
  res.end();
});
await new Promise((r) => pageServer.listen(8099, r));

const context = await chromium.launchPersistentContext('', {
  headless: !process.env.HEADED,
  channel: 'chromium',
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});

const consoleErrors = [];
context.on('page', (p) => {
  p.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`${p.url().slice(0, 60)}: ${m.text()}`);
  });
  p.on('pageerror', (e) => consoleErrors.push(`${p.url().slice(0, 60)}: ${String(e)}`));
});

let failures = 0;
const check = (ok, what) => {
  console.log(`  ${ok ? '✓' : '✗'} ${what}`);
  if (!ok) failures += 1;
};
const step = (n, what) => console.log(`\n[${n}] ${what}`);
const shot = async (page, name) => {
  const path = join(SHOTS, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log(`  📸 ${path}`);
};

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

try {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15_000 });
  const extensionId = new URL(worker.url()).host;
  console.log(`  extension id: ${extensionId}`);

  // The SESSION IS SEEDED rather than signed in — the same substitution
  // `walk.mjs` makes and for the same reason (its header says why).
  const seed = await context.newPage();
  await seed.goto(`chrome-extension://${extensionId}/panel.html`);
  await seed.evaluate(async () => {
    await chrome.storage.session.set({
      'astromatch.session': {
        idToken: 'dev_token',
        refreshToken: 'dev_refresh',
        expiresAt: Date.now() + 3600_000,
        identifier: 'walk@local.test',
      },
    });
  });
  await seed.close();

  await ph41Legs({ context, worker, extensionId, api, check, step, shot });

  step(32, 'B4 — nothing these screens do violates the CSP');
  check(
    consoleErrors.length === 0,
    'no console error anywhere in the browser, CSP violations included' +
      (consoleErrors.length ? ` — ${consoleErrors.slice(0, 3).join(' | ')}` : ''),
  );
} catch (error) {
  failures += 1;
  console.error('\nPH-41 WALK FAILED:', error);
  for (const page of context.pages()) {
    await page.screenshot({ path: join(SHOTS, 'zz-ph41-failure.png') }).catch(() => {});
  }
} finally {
  await context.close();
  pageServer.close();
}

console.log(`\n${failures === 0 ? 'PH-41 WALK PASSED' : `PH-41 WALK FAILED — ${failures} check(s)`}`);
process.exit(failures === 0 ? 0 : 1);
