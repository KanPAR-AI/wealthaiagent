/**
 * Capture the PH-41 fixtures FROM THE RUNNING ENGINE (docs/73 ASTRAL-339/340).
 *
 * A hand-written fixture proves the client parses what somebody imagined. So
 * the shortlist and the compare columns are tested against what
 * `GET /people/matches` and `GET /people/matches/{pair_key}` actually serve,
 * captured here.
 *
 *   cd wealthaiagent/apps/astromatch
 *   npm run build:dev && node e2e/capture-matches.mjs
 *
 * ⚠ IT CREATES REAL DATA on whatever account the local container is
 * configured as, and deletes what it created at the end (docs/51 §3 — check
 * `SKIP_AUTH_USER_ID` first). What it does NOT delete is anything it found
 * already there.
 *
 * Three groups are wanted and the engine can only mint two of them through
 * the product:
 *
 *   complete   — already on the account, or minted by a timed reading;
 *   firm_only  — minted here, by a reading with NO birth time;
 *   refused    — CANNOT be minted from a chat at all. `graph.py`'s
 *                `_persist_saved_match` returns early when the chat holds no
 *                scorecard and says so in its own comment: "the engine does
 *                not yet persist a refusal into the envelope for this path to
 *                read, so promoting one here would mean inventing it". The
 *                READ side has the shape (`matches.undetermined_refusal`,
 *                `_row`'s refusal branch) and serves it for records stored
 *                before ASTRAL-314's gate existed.
 *
 * So the refused row is seeded through the STORE'S OWN WRITER —
 * `services.people.service.save_match(refusal=…)`, the same function the
 * engine would call if it had the refusal on the envelope — by
 * `e2e/seed-refused-match.py`, run inside the container. Nothing about the
 * SERVING path is faked: the fixture is what the route returned.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { chromium } from 'playwright-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const DIST = join(APP, 'dist');
const FIXTURES = join(APP, 'src', 'lib', '__tests__', 'fixtures');
const API = 'http://localhost:8080/api/v1';
const HEADERS = { Authorization: 'Bearer dev_token', 'Content-Type': 'application/json' };

/** SYNTHETIC, written for this capture. Not real people. */
const TIMELESS = 'Compare Walk Timeless';
const TIMED = 'Compare Walk Timed';

/**
 * FIVE COLUMNS is what ASTRAL-340 bounds compare at, so five rows is what the
 * fixtures need: the account's own two, a firm-only, a refused, and one more
 * complete minted here.
 */

const api = async (path, init = {}) => {
  const res = await fetch(`${API}${path}`, { ...init, headers: HEADERS });
  return { status: res.status, body: await res.json().catch(() => null) };
};
const list = (r) => (Array.isArray(r.body) ? r.body : (r.body?.chats ?? r.body?.people ?? []));
const step = (n, what) => console.log(`\n[${n}] ${what}`);

mkdirSync(FIXTURES, { recursive: true });

const context = await chromium.launchPersistentContext('', {
  headless: !process.env.HEADED,
  channel: 'chromium',
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});

const created = [];

try {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15_000 });
  const id = new URL(worker.url()).host;

  /** One reading, saved. `tob` null means the engine scores 15 of 36. */
  const save = async (name, dob, tob) => {
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
    await panel.fill('[data-testid="field-name"]', name);
    await panel.fill('[data-testid="field-dob"]', dob);
    if (tob) await panel.fill('[data-testid="field-tob"]', tob);
    else await panel.click('[data-testid="field-tob-decline"]');
    await panel.fill('[data-testid="field-pob"]', 'Pune, India');
    await panel.waitForSelector('[data-testid="place-resolved"]', { timeout: 30_000 });
    await panel.click('[data-testid="confirm"]');
    await panel.waitForSelector('[data-testid="two-outcomes"], [data-testid="retention"]', {
      timeout: 240_000,
    });
    const offered = await panel.locator('[data-testid="save-match"]').count();
    console.log(`  ${name}: the engine offered a save — ${offered ? 'yes' : 'NO, it refused'}`);
    if (offered) {
      await panel.click('[data-testid="save-match"]');
      await panel.waitForSelector('[data-testid="saved"]', { timeout: 240_000 });
      const person = list(await api('/people')).find((p) => p.display_name === name) ?? null;
      if (person) created.push(person);
      console.log(`  created person ${person?.id}`);
    }
    await panel.close();
  };

  step(0, 'two readings, saved — a TIME-LESS one (a firm-only row) and a timed one');
  await save(TIMELESS, '1992-03-04', null);
  await save(TIMED, '1988-11-21', '06:15');

  step(1, 'GET /people/matches — the three groups, as the engine sends them');
  const matches = await api('/people/matches');
  const groups = (matches.body?.groups ?? []).map((g) => `${g.key}:${g.rows.length}`);
  console.log(`  ${groups.join(' · ')}`);
  writeFileSync(join(FIXTURES, 'matches-groups.json'), `${JSON.stringify(matches.body, null, 2)}\n`);
  console.log(`  wrote ${join(FIXTURES, 'matches-groups.json')}`);

  step(2, 'GET /people/matches/{pair_key} — one stored scorecard per row');
  const details = {};
  for (const group of matches.body?.groups ?? []) {
    for (const row of group.rows) {
      const detail = await api(`/people/matches/${encodeURIComponent(row.pair_key)}`);
      details[row.pair_key] = detail.body;
      console.log(
        `  ${group.key} · ${row.display_name} → ${detail.status} ` +
          `${detail.body?.report ? 'report' : 'refusal'}`,
      );
    }
  }
  writeFileSync(join(FIXTURES, 'match-details.json'), `${JSON.stringify(details, null, 2)}\n`);
  console.log(`  wrote ${join(FIXTURES, 'match-details.json')}`);
} catch (error) {
  console.error('\nCAPTURE FAILED:', error);
} finally {
  step(9, 'clean up — this script created real data');
  for (const person of created) {
    const gone = await api(`/people/${person.id}`, { method: 'DELETE' });
    console.log(`  deleted person ${person.id} → ${gone.status}`);
  }
  for (const c of list(await api('/chats')).filter(
    (c) => String(c.title ?? '').includes(TIMELESS) || String(c.title ?? '').includes(TIMED),
  )) {
    const gone = await api(`/chats/${c.id}`, { method: 'DELETE' });
    console.log(`  deleted chat ${c.id} → ${gone.status}`);
  }
  await context.close();
}
