/**
 * The PH-39 walk, in a real Chromium with the built extension loaded.
 *
 * Run it by hand, not in CI: it needs a local `chatservice` on :8080 and it
 * creates a real chat on whatever account that container is configured as.
 * It deletes the chat it created, and it asserts — rather than assumes —
 * that no PERSON was created, which is F149's whole point.
 *
 *   cd wealthaiagent/apps/astromatch
 *   npm run build:dev
 *   node e2e/walk.mjs            # add HEADED=1 to watch it
 *
 * The SESSION IS SEEDED rather than signed in. The OTP round trip is covered
 * by `auth.test.ts` against a stubbed backend; doing it live here would mint
 * a Firebase credential on a real account for a throwaway walk, and the local
 * backend ignores the token anyway (SKIP_AUTH). Said out loud because "the
 * walk signed in" would otherwise be read as a claim about the live path.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { chromium } from 'playwright-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const DIST = join(APP, 'dist');
const SHOTS = join(APP, 'e2e-artifacts');
const API = 'http://localhost:8080/api/v1';
const TOKEN = 'dev_token';

mkdirSync(SHOTS, { recursive: true });

const shot = async (page, name) => {
  const path = join(SHOTS, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log(`  📸 ${path}`);
};

const step = (n, what) => console.log(`\n[${n}] ${what}`);

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const context = await chromium.launchPersistentContext('', {
  headless: !process.env.HEADED,
  channel: 'chromium',
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});

/**
 * Every console error, from every page in this browser.
 *
 * A Content-Security-Policy violation is reported HERE and nowhere else — the
 * page still renders, minus whatever was blocked, so a CSP that is one
 * directive short looks like a styling bug or silently drops a request. The
 * walk fails on any of them (docs/73 B4).
 */
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

try {
  step(0, 'the extension loads and Chrome gives it an id');
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15_000 });
  const extensionId = new URL(worker.url()).host;
  console.log(`  extension id: ${extensionId}`);
  check(Boolean(extensionId), 'the service worker started');

  step(1, 'a page loads with the extension installed and NOTHING is clicked');
  // Page-level here; the CONTEXT-level measurement (which is the one that can
  // see a service-worker fetch) runs at the very END — turning context request
  // observation on breaks the SSE stream this walk depends on, measured twice
  // on 2026-09-19, so it cannot be on while a reading is in flight.
  const bystander = await context.newPage();
  const pageRequests = [];
  bystander.on('request', (r) => pageRequests.push(r.url()));
  await bystander.goto('https://example.com/', { waitUntil: 'domcontentloaded' });
  await bystander.waitForTimeout(1500);
  check(
    pageRequests.filter((u) => u.includes('localhost:8080') || u.includes('chatbackend')).length === 0,
    'the page itself made no request to our backend',
  );
  await shot(bystander, '01-bystander-page');

  step(2, 'the panel opens directly by its own URL');
  const panel = await context.newPage();
  await panel.setViewportSize({ width: 380, height: 900 });
  const panelErrors = [];
  panel.on('console', (m) => m.type() === 'error' && panelErrors.push(m.text()));
  panel.on('pageerror', (e) => panelErrors.push(String(e)));
  await panel.goto(`chrome-extension://${extensionId}/panel.html`);
  await panel.waitForTimeout(500);

  step(3, 'seed the session (see the header) and reload');
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
  await panel.waitForSelector('[data-testid="manual"]', { timeout: 10_000 });
  await shot(panel, '02-choose');
  check(true, 'the panel shows the two ways in');
  const controls = await panel.evaluate(() =>
    [...document.querySelectorAll('button')].map((b) => b.textContent?.trim()),
  );
  check(
    !controls.some((c) => /paste|type/i.test(c ?? '') === false && /camera|snapshot|selection/i.test(c ?? '')),
    'no camera or selection control is rendered (capabilities false = absent)',
  );

  step(4, 'manual entry of a synthetic person');
  await panel.click('[data-testid="manual"]');
  await panel.waitForSelector('[data-testid="field-name"]');
  await panel.fill('[data-testid="field-name"]', 'Test Person');
  await panel.fill('[data-testid="field-dob"]', '1992-03-14');
  await panel.fill('[data-testid="field-tob"]', '10:30');
  await panel.fill('[data-testid="field-pob"]', 'Pune, India');
  await panel.waitForSelector('[data-testid="place-resolved"]', { timeout: 20_000 });
  const resolved = await panel.textContent('[data-testid="place-resolved"]');
  console.log(`  resolved: ${resolved}`);
  check(/Asia\/Kolkata/.test(resolved ?? ''), 'the place resolved on the ENGINE, clock shown back');
  await shot(panel, '03-review');

  const confirmDisabled = await panel.isDisabled('[data-testid="confirm"]');
  check(confirmDisabled === false, 'confirm opened once every field was acted on');

  step(5, 'confirm → the §3a sequence runs in the service worker');
  await panel.click('[data-testid="confirm"]');
  await panel.waitForTimeout(1000);
  await shot(panel, '04-running');
  // Wait for the READING, not for a phrase: the retention card is drawn on
  // every finished reading, and the narration's wording is the engine's to
  // change. (It changed: B4 now hides the deterministic `### Kundli Milan …`
  // fallback, so a wait on "of 36" hung for three minutes on a turn that had
  // already succeeded.)
  await panel.waitForSelector('[data-testid="retention"]', { timeout: 180_000 });
  // The retention card lands when the TURN is over (it is held back while the
  // stream is still arriving), so the narration below it is complete by now.
  await panel.waitForTimeout(1500);
  await shot(panel, '05-scorecard');

  const body = (await panel.textContent('body')) ?? '';
  check(/36/.test(body), 'the scorecard rendered the engine\'s numbers');
  check(!body.includes('%'), 'no percentage anywhere in the panel');
  check(/not saved/i.test(body), 'the panel states that nothing was saved');
  check(
    !/save to my matches/i.test(body),
    'the save offer is NOT rendered as an answerable control (capability false)',
  );

  step(6, 'F149 — nothing durable was written');
  const people = await api('/people');
  const names = (people.body?.people ?? []).map((p) => p.display_name);
  console.log(`  people on the account: ${JSON.stringify(names)}`);
  check(!names.includes('Test Person'), 'NO person was created by an unanswered save offer');
  const matches = await api('/people/matches');
  const groups = matches.body?.groups ?? matches.body ?? {};
  check(
    !JSON.stringify(groups).includes('Test Person'),
    'no match was stored either',
  );

  step(7, 'the paste path: a synthetic biodata, reviewed in three states');
  const panel2 = await context.newPage();
  await panel2.setViewportSize({ width: 380, height: 900 });
  await panel2.goto(`chrome-extension://${extensionId}/panel.html`);
  await panel2.waitForSelector('[data-testid="paste"]');
  await panel2.click('[data-testid="paste"]');
  await panel2.fill(
    '[data-testid="paste-box"]',
    // SYNTHETIC. Written for this walk; not copied from any live profile.
    ['Name: Meera Iyer', 'Date of Birth: 03/04/1989', 'Time of Birth: Not known', 'Location: Pune'].join(
      '\n',
    ),
  );
  await panel2.click('[data-testid="read-paste"]');
  await panel2.waitForSelector('[data-testid="field-name"]');
  await panel2.waitForTimeout(1200);
  await shot(panel2, '06-paste-review');
  const review = (await panel2.textContent('body')) ?? '';
  check(/read from what you gave me/.test(review), 'a STATED field says so');
  check(/I worked this one out/.test(review), 'an INFERRED field says so, with its basis');
  check(/not there — please add it/.test(review), 'a MISSING field says so');
  check(
    /could be 3 April 1989 .*or 4 March 1989|4 March 1989/.test(review),
    'the ambiguous date names BOTH readings instead of picking one quietly',
  );
  check(
    /where they live/.test(review),
    'a "Location" row is inferred, with the reason it may not be a birth place',
  );
  check(
    (await panel2.locator('[data-testid="place-resolved"]').count()) === 0,
    'the parsed place was NOT sent to the resolver before the user acted on it',
  );
  check(await panel2.isDisabled('[data-testid="confirm"]'), 'confirm is blocked until it is reviewed');

  step(8, 'B3 — the ambiguous date is a QUESTION, not a default');
  const panel3 = await context.newPage();
  await panel3.setViewportSize({ width: 380, height: 900 });
  await panel3.goto(`chrome-extension://${extensionId}/panel.html`);
  await panel3.waitForSelector('[data-testid="paste"]');
  await panel3.click('[data-testid="paste"]');
  await panel3.fill(
    '[data-testid="paste-box"]',
    // SYNTHETIC, and deliberately ambiguous: 03/04/1989 is two real dates.
    ['Name: Anaya Rao', 'Date of Birth: 03/04/1989', 'Place of Birth: Nagpur'].join('\n'),
  );
  await panel3.click('[data-testid="read-paste"]');
  await panel3.waitForSelector('[data-testid="field-dob-choice-1989-04-03"]');
  await shot(panel3, '07-ambiguous-date');
  check(
    (await panel3.inputValue('[data-testid="field-dob"]')) === '',
    'neither reading is pre-filled into the date control',
  );
  check(
    (await panel3.textContent('[data-testid="field-dob-choice-1989-04-03"]')) === '3 April 1989' &&
      (await panel3.textContent('[data-testid="field-dob-choice-1989-03-04"]')) === '4 March 1989',
    'both readings are offered as chips, in words',
  );
  await panel3.click('[data-testid="field-dob-choice-1989-03-04"]');
  check(
    (await panel3.textContent('[data-testid="field-dob-words"]')) === '4 March 1989',
    'the choice is stated back in words, whatever the browser locale renders',
  );

  step(9, 'B2 — a page about a FAMILY does not become one person');
  const panel4 = await context.newPage();
  await panel4.setViewportSize({ width: 380, height: 900 });
  await panel4.goto(`chrome-extension://${extensionId}/panel.html`);
  await panel4.waitForSelector('[data-testid="paste"]');
  await panel4.click('[data-testid="paste"]');
  await panel4.fill(
    '[data-testid="paste-box"]',
    // SYNTHETIC: the candidate, then her brother. Four first-row-wins scans
    // would return her name with his birth details.
    [
      'Name: Meera Iyer',
      'Height: 5\'4"',
      'Brother',
      'Name: Rohan Iyer',
      'Date of Birth: 02/01/1990',
      'Place of Birth: Chennai',
    ].join('\n'),
  );
  await panel4.click('[data-testid="read-paste"]');
  await panel4.waitForSelector('[data-testid="field-name"]');
  await shot(panel4, '08-two-people');
  check(
    (await panel4.inputValue('[data-testid="field-dob"]')) === '',
    "the brother's date of birth was NOT taken",
  );
  check(
    /more than one person/.test((await panel4.textContent('[data-testid="field-name-basis"]')) ?? ''),
    'the name it did read says the text describes more than one person',
  );
  check(
    /read from: Name: Meera Iyer/.test(
      (await panel4.textContent('[data-testid="field-name-source"]')) ?? '',
    ),
    'every value shows the line it came from',
  );

  step(10, 'B1 — leaving an unsaved reading DELETES the chat it created');
  const chatsBefore = await api('/chats');
  const mineBefore = (chatsBefore.body?.chats ?? chatsBefore.body ?? []).filter((c) =>
    String(c.title ?? '').includes('Test Person'),
  );
  check(mineBefore.length >= 1, `the reading's chat exists before the delete (${mineBefore.length})`);
  await panel.click('[data-testid="delete-now"]');
  await panel.waitForSelector('[data-testid="choose-notice"]', { timeout: 20_000 });
  const notice = await panel.textContent('[data-testid="choose-notice"]');
  check(
    notice === 'This reading and the details you entered were deleted.',
    `the panel states the deletion — "${notice}"`,
  );
  await shot(panel, '09-deleted');
  const chatsAfter = await api('/chats');
  const mineAfter = (chatsAfter.body?.chats ?? chatsAfter.body ?? []).filter((c) =>
    String(c.title ?? '').includes('Test Person'),
  );
  // One FEWER than before, rather than zero: a walk that crashed earlier can
  // leave one behind, and asserting zero would blame this run for that.
  check(
    mineAfter.length === mineBefore.length - 1,
    `the chat this reading created is GONE (${mineBefore.length} → ${mineAfter.length})`,
  );
  const peopleAfter = await api('/people');
  check(
    !(peopleAfter.body?.people ?? []).some((p) => p.display_name === 'Test Person'),
    'and still nobody was created',
  );

  step(11, 'clean up anything this walk left behind');
  const chats = await api('/chats');
  const mine = (chats.body?.chats ?? chats.body ?? []).filter((c) =>
    String(c.title ?? '').includes('Test Person'),
  );
  for (const chat of mine) {
    const gone = await api(`/chats/${chat.id}`, { method: 'DELETE' });
    console.log(`  deleted leftover chat ${chat.id} → ${gone.status}`);
  }
  check(true, `cleaned up ${mine.length} leftover chat(s) from earlier runs`);

  check(panelErrors.length === 0, `the panel logged no errors (${panelErrors.join(' | ')})`);

  step(12, 'B1 — CLOSING the panel without pressing anything deletes the chat');
  const panel5 = await context.newPage();
  await panel5.setViewportSize({ width: 380, height: 900 });
  await panel5.goto(`chrome-extension://${extensionId}/panel.html`);
  await panel5.waitForSelector('[data-testid="manual"]');
  await panel5.click('[data-testid="manual"]');
  await panel5.fill('[data-testid="field-name"]', 'Test Person');
  await panel5.fill('[data-testid="field-dob"]', '1992-03-14');
  await panel5.fill('[data-testid="field-tob"]', '10:30');
  await panel5.fill('[data-testid="field-pob"]', 'Pune, India');
  await panel5.waitForSelector('[data-testid="place-resolved"]', { timeout: 20_000 });
  await panel5.click('[data-testid="confirm"]');
  // wait until the chat exists, then CLOSE THE PANEL — no button pressed
  let createdId = null;
  for (let i = 0; i < 60 && !createdId; i += 1) {
    const list = await api('/chats');
    const hit = (list.body?.chats ?? list.body ?? []).find((c) =>
      String(c.title ?? '').includes('Test Person'),
    );
    createdId = hit?.id ?? null;
    if (!createdId) await panel5.waitForTimeout(1000);
  }
  check(Boolean(createdId), `the reading created a chat (${createdId})`);
  await shot(panel5, '10-before-close');
  await panel5.close();
  // the worker issues the delete on the port's disconnect
  let goneAfterClose = false;
  for (let i = 0; i < 30 && !goneAfterClose; i += 1) {
    await new Promise((r) => setTimeout(r, 1000));
    const list = await api('/chats');
    goneAfterClose = !(list.body?.chats ?? list.body ?? []).some((c) => c.id === createdId);
  }
  check(goneAfterClose, 'closing the panel deleted the chat, with nothing pressed');
  const peopleAfterClose = await api('/people');
  check(
    !(peopleAfterClose.body?.people ?? []).some((p) => p.display_name === 'Test Person'),
    'and still nobody was created',
  );

  step(13, 'ASTRAL-322 — with the panel closed, a page load makes the extension do NOTHING');
  // Context-level, so a service-worker fetch WOULD be seen. Last, for the
  // reason in step 1.
  const watched = [];
  const record = (r) => watched.push(r.url());
  context.on('request', record);
  const second = await context.newPage();
  await second.goto('https://example.org/', { waitUntil: 'domcontentloaded' });
  await second.waitForTimeout(3000);
  context.off('request', record);
  const leaked = watched.filter((u) => u.includes('localhost:8080') || u.includes('chatbackend'));
  check(
    leaked.length === 0,
    `no backend request from anywhere in the browser — ${watched.length} request(s) seen, ${leaked.length} to our backend`,
  );

  step(14, 'B4 — the new CSP blocked nothing the panel needs');
  check(
    consoleErrors.length === 0,
    'no console error anywhere in the browser, CSP violations included' +
      (consoleErrors.length ? ` — ${consoleErrors.slice(0, 3).join(' | ')}` : ''),
  );
} catch (error) {
  failures += 1;
  console.error('\nWALK FAILED:', error);
  for (const page of context.pages()) {
    await page.screenshot({ path: join(SHOTS, 'zz-failure.png') }).catch(() => {});
  }
} finally {
  writeFileSync(join(SHOTS, 'walk-exit.txt'), String(failures));
  await context.close();
}

console.log(`\n${failures === 0 ? 'WALK PASSED' : `WALK FAILED — ${failures} check(s)`}`);
process.exit(failures === 0 ? 0 : 1);
