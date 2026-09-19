/**
 * Outcome (a) — "Add to my matches", proved live on the FREE path.
 *
 * It is the same client code the camera path uses: the same `save_match_offer`
 * ask, the same `buildInputResponseMessage` carrier, the same
 * `_persist_saved_match` on the engine, the same "not swept on close" rule.
 * The only thing it does not exercise is `capture_source: "snapshot"` on the
 * wire — it sends `"manual"`, because that is what actually happened — and
 * that field is pinned by `outcomes.test.tsx`.
 *
 * It exists as a SEPARATE script because the capture legs of `walk.mjs` each
 * spend one of the account's ten daily captures, and the save path should be
 * re-provable without spending one.
 *
 *   cd wealthaiagent/apps/astromatch && npm run build:dev && node e2e/save-walk.mjs
 *
 * It creates a real person and a real chat on whatever account the local
 * container is configured as, and deletes both at the end.
 */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { chromium } from 'playwright-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, '..', 'dist');
const SHOTS = join(HERE, '..', 'e2e-artifacts');
const API = 'http://localhost:8080/api/v1';
const HEADERS = { Authorization: 'Bearer dev_token', 'Content-Type': 'application/json' };

/** SYNTHETIC. Written for this walk; not a real person. */
const NAME = 'Save Walk Person';

const api = async (path, init = {}) => {
  const res = await fetch(`${API}${path}`, { ...init, headers: HEADERS });
  return { status: res.status, body: await res.json().catch(() => null) };
};
const list = (r) => (Array.isArray(r.body) ? r.body : (r.body?.chats ?? r.body?.people ?? []));

let failures = 0;
const check = (ok, what) => {
  console.log(`  ${ok ? '✓' : '✗'} ${what}`);
  if (!ok) failures += 1;
};
const step = (n, what) => console.log(`\n[${n}] ${what}`);

const context = await chromium.launchPersistentContext('', {
  headless: !process.env.HEADED,
  channel: 'chromium',
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});

const errors = [];
// The WORKER's warnings, surfaced. Everything interesting on the save path
// happens there and its console is invisible otherwise — which is how F306
// (a dynamic import that never resolved) stayed hidden for a whole phase.
const watchWorker = (w) =>
  w.on('console', (m) => {
    if (m.type() === 'warning' || m.type() === 'error') console.log('  [worker]', m.text());
  });
for (const w of context.serviceWorkers()) watchWorker(w);
context.on('serviceworker', watchWorker);
context.on('page', (p) => {
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  p.on('pageerror', (e) => errors.push(String(e)));
});

let person = null;
let chatId = null;

try {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15_000 });
  const id = new URL(worker.url()).host;

  step(0, 'a reading, from typed details');
  const panel = await context.newPage();
  await panel.setViewportSize({ width: 380, height: 900 });
  await panel.goto(`chrome-extension://${id}/panel.html`);
  await panel.evaluate(async () => {
    await chrome.storage.session.set({
      'astromatch.session': {
        idToken: 'dev_token',
        refreshToken: 'dev_refresh',
        expiresAt: Date.now() + 3600_000,
        identifier: 'walk@local.test',
      },
    });
  });
  await panel.reload();
  await panel.waitForSelector('[data-testid="manual"]', { timeout: 15_000 });
  await panel.click('[data-testid="manual"]');
  await panel.fill('[data-testid="field-name"]', NAME);
  await panel.fill('[data-testid="field-dob"]', '1992-03-04');
  await panel.fill('[data-testid="field-tob"]', '10:30');
  await panel.fill('[data-testid="field-pob"]', 'Pune, India');
  await panel.waitForSelector('[data-testid="place-resolved"]', { timeout: 30_000 });
  await panel.click('[data-testid="confirm"]');
  await panel.waitForSelector('[data-testid="two-outcomes"]', { timeout: 240_000 });
  check(true, 'the scorecard arrived and both outcomes are offered');

  const peopleBefore = list(await api('/people')).length;

  step(1, 'ASTRAL-334 — Add to my matches');
  await panel.click('[data-testid="save-match"]');
  await panel.waitForSelector('[data-testid="saved"]', { timeout: 240_000 });
  const saved = await panel.textContent('[data-testid="saved"]');
  check(/Added to your matches/.test(saved ?? ''), 'the panel says it was added');
  check(/People/.test(saved ?? ''), 'and says where to find them in the app');
  check(
    (await panel.locator('[data-testid="retention"]').count()) === 0,
    'the "this will be deleted" card is GONE — a kept reading is not promised away',
  );
  await panel.screenshot({ path: join(SHOTS, '18-saved.png'), fullPage: true });
  console.log(`  📸 ${join(SHOTS, '18-saved.png')}`);

  step(2, 'the person and the match are in the store');
  const people = list(await api('/people'));
  person = people.find((p) => p.display_name === NAME);
  check(Boolean(person), `the person exists in GET /people (${people.length} total, was ${peopleBefore})`);
  const matches = await api('/people/matches');
  check(
    JSON.stringify(matches.body).includes(NAME),
    'and the match is in GET /people/matches',
  );

  step(3, 'a SAVED reading is not swept when the panel closes');
  const chats = list(await api('/chats'));
  chatId = chats.find((c) => String(c.title ?? '').includes(NAME))?.id ?? null;
  check(Boolean(chatId), `the reading's chat exists (${chatId})`);
  await panel.close();
  await new Promise((r) => setTimeout(r, 8000));
  const still = list(await api('/chats')).some((c) => c.id === chatId);
  check(still, 'the chat is still there — the user chose to keep this reading');

  check(errors.length === 0, `no console error anywhere (${errors.slice(0, 2).join(' | ')})`);
} catch (error) {
  failures += 1;
  console.error('\nSAVE WALK FAILED:', error);
} finally {
  step(9, 'clean up — this walk created real data');
  if (person) {
    const gone = await api(`/people/${person.id}`, { method: 'DELETE' });
    console.log(`  deleted person ${person.id} → ${gone.status}`);
  }
  for (const c of list(await api('/chats')).filter((c) => String(c.title ?? '').includes(NAME))) {
    const gone = await api(`/chats/${c.id}`, { method: 'DELETE' });
    console.log(`  deleted chat ${c.id} → ${gone.status}`);
  }
  await context.close();
}

console.log(`\n${failures === 0 ? 'SAVE WALK PASSED' : `SAVE WALK FAILED — ${failures} check(s)`}`);
process.exit(failures === 0 ? 0 : 1);
