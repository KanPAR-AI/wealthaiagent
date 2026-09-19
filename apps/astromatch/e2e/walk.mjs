/**
 * The PH-39 + PH-40 walk, in a real Chromium with the built extension loaded.
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

import { createServer } from 'http';
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

/**
 * HOW MANY LIVE CAPTURES THIS RUN MAY SPEND.
 *
 * Each capture leg is a paid Flash call and one of the account's TEN daily
 * captures (ASTRAL-318). Discovering the allowance by hitting the 429 spends
 * it; declaring it does not. Legs beyond the budget SKIP and say why, which
 * is the same shape as the cap being hit and is deterministic.
 *
 *   CAPTURE_BUDGET=4   the whole vision walk: read, save, unreadable, two-person
 *   CAPTURE_BUDGET=1   leg 17 only — the default crop read end to end
 *   CAPTURE_BUDGET=0   (the default) capture-free: every leg that does not
 *                      spend one, including the crop, the consent and the
 *                      clipping guard
 *
 * The SAVE path is provable without spending any: `e2e/save-walk.mjs`.
 */
const CAPTURE_BUDGET = Number(process.env.CAPTURE_BUDGET ?? 0);
let capturesSpent = 0;
const mayCapture = () => capturesSpent < CAPTURE_BUDGET;
const spendCapture = () => {
  capturesSpent += 1;
};

mkdirSync(SHOTS, { recursive: true });

/**
 * THE PAGES THIS WALK CAPTURES ARE SYNTHETIC, AND ARE SERVED FROM HERE.
 *
 * No matrimonial site is visited, screenshotted or committed — X-3, every
 * site's terms, and the privacy reason that stands whether or not the terms
 * would. Every name, date and place below is fabricated.
 */
const PAGES = {
  '/biodata': `<!doctype html><html><head><meta charset="utf-8"><title>Profile</title></head>
<body style="font-family:Georgia,serif;margin:0;background:#fff;color:#111">
  <div style="padding:28px 40px;background:#7a1f3d;color:#fff">
    <h1 style="margin:0;font-size:26px">Asha Verma</h1>
    <p style="margin:6px 0 0;opacity:.85">Profile ID SY-40021 · Synthetic sample, not a real person</p>
  </div>
  <div style="display:flex;gap:32px;padding:32px 40px">
    <!-- A PHOTOGRAPH-LIKE TEXTURE, painted procedurally (value noise + soft
         blobs + a gradient). NOT a face, NOT a downloaded image, NOT a real
         person — and dense in edges, which is the property that makes it a
         photograph to the segmentation (F310). The flat grey placeholder it
         replaces is why the photo case went unexercised for a whole phase. -->
    <canvas id="portrait" width="200" height="240" style="border:1px solid #333"></canvas>
    <table style="border-collapse:collapse;font-size:17px">
      <tr><td style="padding:7px 26px 7px 0;color:#666">Date of Birth</td><td><b>14 May 1994</b></td></tr>
      <tr><td style="padding:7px 26px 7px 0;color:#666">Time of Birth</td><td><b>07:45 AM</b></td></tr>
      <tr><td style="padding:7px 26px 7px 0;color:#666">Place of Birth</td><td><b>Nagpur, Maharashtra</b></td></tr>
      <tr><td style="padding:7px 26px 7px 0;color:#666">Height</td><td>5' 4"</td></tr>
      <tr><td style="padding:7px 26px 7px 0;color:#666">Education</td><td>M.Sc. Botany</td></tr>
      <tr><td style="padding:7px 26px 7px 0;color:#666">Lives in</td><td>Bengaluru</td></tr>
      <tr><td style="padding:7px 26px 7px 0;color:#666">Contact</td><td>+91 90000 00000</td></tr>
    </table>
  </div>
  <script>
    (function () {
      var c = document.getElementById('portrait');
      var x = c.getContext('2d');
      var g = x.createLinearGradient(0, 0, c.width, c.height);
      g.addColorStop(0, '#6a7f9c'); g.addColorStop(1, '#c9b79a');
      x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
      var seed = 1337;
      function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
      for (var i = 0; i < 9; i++) {
        var bx = rnd() * c.width, by = rnd() * c.height, br = 12 + rnd() * 70;
        var b = x.createRadialGradient(bx, by, 0, bx, by, br);
        b.addColorStop(0, 'rgba(' + (40 + rnd() * 180 | 0) + ',' + (40 + rnd() * 180 | 0) + ',' + (40 + rnd() * 180 | 0) + ',0.8)');
        b.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = b; x.fillRect(0, 0, c.width, c.height);
      }
      var img = x.getImageData(0, 0, c.width, c.height);
      for (var j = 0; j < img.data.length; j += 4) {
        var n = (rnd() - 0.5) * 150;
        img.data[j] = Math.max(0, Math.min(255, img.data[j] + n));
        img.data[j + 1] = Math.max(0, Math.min(255, img.data[j + 1] + n));
        img.data[j + 2] = Math.max(0, Math.min(255, img.data[j + 2] + n));
      }
      x.putImageData(img, 0, 0);
    })();
  </script>
</body></html>`,
  '/plain': `<!doctype html><html><head><meta charset="utf-8"><title>No details</title></head>
<body style="font-family:system-ui;padding:60px;font-size:18px;line-height:1.7">
  <h1>Terms of Service</h1>
  <p>This page carries no name, no date, no time and no place of birth. It is
  here so the walk can see what the extractor does with a crop that has
  nothing on it to read.</p>
  <p>Nothing on this page is a birth detail. Nothing on this page is a person.</p>
</body></html>`,
  '/two': `<!doctype html><html><head><meta charset="utf-8"><title>Family</title></head>
<body style="font-family:system-ui;padding:36px;font-size:17px">
  <h1 style="margin:0 0 6px">Meera Iyer</h1>
  <p style="margin:0 0 18px;color:#666">Synthetic sample · not a real person</p>
  <table style="border-collapse:collapse"><tr><td style="padding:6px 22px 6px 0;color:#666">Height</td><td>5' 3"</td></tr>
  <tr><td style="padding:6px 22px 6px 0;color:#666">Profession</td><td>Architect</td></tr></table>
  <h2 style="margin-top:30px">Brother</h2>
  <h3 style="margin:0 0 6px">Rohan Iyer</h3>
  <table style="border-collapse:collapse">
   <tr><td style="padding:6px 22px 6px 0;color:#666">Date of Birth</td><td><b>02 January 1990</b></td></tr>
   <tr><td style="padding:6px 22px 6px 0;color:#666">Place of Birth</td><td><b>Chennai</b></td></tr>
  </table>
</body></html>`,
};

const pageServer = createServer((req, res) => {
  const path = (req.url ?? '').split('?')[0];
  const body = PAGES[path];
  if (body) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(body);
    return;
  }
  // 204, not 404. Chrome asks every page for /favicon.ico, and a 404 is a
  // console ERROR — which the walk fails on, by design, because that is how
  // a CSP violation shows up. A fixture server that manufactures one turns
  // the whole check into noise.
  res.writeHead(204);
  res.end();
});
await new Promise((r) => pageServer.listen(8099, r));

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
  // PH-40 flipped `snapshot` and `saveMatch`, so the assertion flips with it:
  // the camera is PRESENT, and the two capabilities that are still false —
  // the selection read and the shortlist — are ABSENT rather than greyed.
  // (The PH-39 version of this check was written as a double negative and
  // would have passed either way; it is replaced, not relaxed.)
  check(
    (await panel.locator('[data-testid="snapshot"]').count()) === 1,
    'the camera IS rendered — `capabilities.snapshot` is true in this build',
  );
  check(
    !controls.some((c) => /selection|shortlist|compare|coming soon/i.test(c ?? '')),
    'and the capabilities still false have no control at all',
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

  // ══════════════════════════════════════════════════════════════════════
  // PH-40 — the snapshot (docs/73 ASTRAL-330…337)
  //
  // WHAT IS REAL HERE AND WHAT IS NOT, said before the checks.
  //
  // Everything below runs against the real extension, the real backend and
  // the real Flash extractor — the crop, the consent, `POST
  // /astrology/extract-profile`, the review, the scorecard, the chips, the
  // save, the delete. ONE step is substituted: the `chrome.tabs
  // .captureVisibleTab` call itself.
  //
  // It has to be. The F159 spike measured it in this same Chromium
  // (`e2e/spike-f159.mjs`): the call is refused — "Either the '<all_urls>'
  // or 'activeTab' permission is required." — from the panel, from the
  // worker, on an https page, on a localhost page, and even on the
  // extension's OWN page. `activeTab` is granted only by a BROWSER-PROCESS
  // gesture (the toolbar action, a keyboard command, a context-menu item)
  // and Playwright drives the renderer, so no automation can produce one.
  //
  // So the walk proves the refusal is handled honestly (leg 15), and then
  // injects a real screenshot of a synthetic page through the SAME door a
  // gesture capture uses — the worker's `capture/delivered` broadcast — and
  // walks everything downstream of it for real.
  //
  // Each `extract` below is a paid Flash call and one of the account's ten
  // daily captures. There are four.
  // ══════════════════════════════════════════════════════════════════════

  step(14, 'PH-40 — a SYNTHETIC biodata page, served locally');
  for (const page of [panel2, panel3, panel4]) await page.close().catch(() => {});
  const biodata = await context.newPage();
  await biodata.setViewportSize({ width: 1100, height: 800 });
  await biodata.goto('http://localhost:8099/biodata', { waitUntil: 'domcontentloaded' });
  await shot(biodata, '11-biodata-page');
  check(true, 'the synthetic page is on screen (no real profile is ever used)');

  step(15, 'F159 — the camera button on a tab Chrome has not granted');
  const cam = await context.newPage();
  await cam.setViewportSize({ width: 380, height: 900 });
  await cam.goto(`chrome-extension://${extensionId}/panel.html`);
  await cam.waitForSelector('[data-testid="snapshot"]', { timeout: 10_000 });
  await cam.click('[data-testid="snapshot"]');
  const blocked = await cam
    .waitForSelector('[data-testid="capture-instruction"]', { timeout: 10_000 })
    .then((el) => el.textContent())
    .catch(() => null);
  const droppedIntoCrop = (await cam.locator('[data-testid="crop-canvas"]').count()) > 0;
  check(
    Boolean(blocked) || droppedIntoCrop,
    `the camera button did something honest — ${
      droppedIntoCrop ? 'it CAPTURED (the grant was present)' : 'it printed the instruction'
    }`,
  );
  if (blocked) {
    console.log(`  instruction: ${JSON.stringify(blocked)}`);
    // Chrome returns the bound shortcut in the PLATFORM's own notation —
    // "⌥⇧M" on macOS, "Alt+Shift+M" on Windows and Linux — which is the
    // point of reading `chrome.commands.getAll()` instead of printing the
    // manifest's suggestion. So the check is "it names a key the user will
    // recognise", not one literal.
    check(
      /press \S+/.test(blocked) || /chrome:\/\/extensions\/shortcuts/.test(blocked),
      'the instruction names the keyboard gesture Chrome actually bound',
    );
    check(
      /Read this page into AstroMatch/.test(blocked),
      'and the context-menu item, which always exists',
    );
    await shot(cam, '12-instruction');
  }

  step(16, 'the capture arrives through the gesture door, and the crop opens');
  // A REAL screenshot of the synthetic page, handed to the panel through the
  // same broadcast `chrome.commands.onCommand` uses.
  const captured = `data:image/png;base64,${(await biodata.screenshot()).toString('base64')}`;
  await cam.bringToFront();
  await worker.evaluate(
    async (image) => chrome.runtime.sendMessage({ type: 'capture/delivered', image, gesture: 'command' }),
    captured,
  );
  await cam.waitForSelector('[data-testid="crop-canvas"]', { timeout: 10_000 });
  const cropSize = await cam.textContent('[data-testid="crop-size"]');
  console.log(`  ${cropSize}`);
  check(/a part of the page/.test(cropSize ?? ''), 'the DEFAULT crop is smaller than the page');
  check(/Sending \d+ × \d+ pixels/.test(cropSize ?? ''), 'and it says exactly what will be sent');
  const consentCopy = await cam.textContent('[data-testid="consent-text"]');
  check(
    consentCopy ===
      'This crop is sent to Astral to read the birth details. It is not stored, not added to ' +
        'your files, and not kept in our logs. Only the details you confirm on the next screen ' +
        'are saved.',
    'the consent line is the row\'s words, verbatim',
  );
  check(await cam.isDisabled('[data-testid="crop-send"]'), 'nothing can be sent before consenting');
  // F308's live guard: the DEFAULT box does not cut through text, so the
  // warning is silent — and it appears the moment the box is dragged across
  // the details.
  check(
    ((await cam.textContent('[data-testid="crop-clipping"]')) ?? '').trim() === '',
    'the default box does not cut through text, and the guard is silent',
  );
  // F310 — the page now carries a PROCEDURAL photograph, and the default box
  // must be clear of it. The panel's own warning is the check: it fires for
  // any dense block inside the box, wherever the box is.
  const photoWarning = ((await cam.textContent('[data-testid="crop-photo-warning"]')) ?? '').trim();
  check(photoWarning === '', `the default box holds no photograph — "${photoWarning}"`);
  // and the copy may not promise what it cannot keep
  const cropCopy = (await cam.textContent('body')) ?? '';
  check(
    /Only what is inside the box leaves your browser/.test(cropCopy),
    'the copy says what is true of every box position',
  );
  check(
    !/The rest of this page — the photo/.test(cropCopy),
    'and no longer promises that the photo stays behind',
  );
  // THE PAYLOAD DIMENSIONS, without spending a capture: what the panel says
  // it will send has to be the box the user is looking at.
  const boxW = Number(await cam.inputValue('[data-testid="crop-width"]'));
  const boxH = Number(await cam.inputValue('[data-testid="crop-height"]'));
  const stated = /Sending (\d+) × (\d+) pixels/.exec(cropSize ?? '');
  check(
    Boolean(stated) && Number(stated[1]) === boxW && Number(stated[2]) === boxH,
    `the stated payload is the box itself — ${boxW}×${boxH} vs "${stated?.[0]}"`,
  );
  await shot(cam, '13-crop');

  step(17, 'consent → the LIVE extractor → three states over vision candidates');
  let visionRead = false;
  let capped = false;
  if (!mayCapture()) {
    check(
      true,
      `SKIPPED — CAPTURE_BUDGET=${CAPTURE_BUDGET}, ${capturesSpent} spent. Each of these ` +
        "legs costs one of the account's ten daily captures; run with " +
        'CAPTURE_BUDGET=4 on a fresh day for the whole vision walk.',
    );
    await cam.close();
  } else {
  spendCapture();
  await cam.click('[data-testid="consent"]');
  const extractCalls = [];
  const watchExtract = (r) => {
    if (r.url().includes('extract-profile')) extractCalls.push(r.url());
  };
  context.on('request', watchExtract);
  await cam.click('[data-testid="crop-send"]');
  await cam.waitForSelector('[data-testid="field-name"], [data-testid="capture-problem"]', {
    timeout: 90_000,
  });
  context.off('request', watchExtract);
  check(extractCalls.length === 1, `exactly ONE image left the browser (${extractCalls.length})`);
  const failed = await cam.locator('[data-testid="capture-problem"]').count();
  if (failed) {
    const why = (await cam.textContent('[data-testid="capture-problem"]')) ?? '';
    // The daily cap is a DESIGNED state and a real observation of
    // ASTRAL-318, not a defect in this client. Ten captures a day is the
    // free allowance and a walk that has already spent them reports the
    // sentence rather than failing on it.
    capped = /captur|allowance|today/i.test(why) && (await cam.locator('[data-testid="door-paste"]').count()) > 0
      && (await cam.locator('[data-testid="door-recrop"]').count()) === 0;
    if (capped) {
      check(true, `the daily capture cap was reached, and it says so: "${why.slice(0, 120)}"`);
      check(
        (await cam.locator('[data-testid="door-manual"]').count()) > 0,
        'and it names the always-free doors, which are never capped',
      );
    } else {
      check(false, `the extractor did not return candidates: ${why}`);
    }
    await shot(cam, '14-vision-review');
  } else {
    visionRead = true;
    const review = (await cam.textContent('body')) ?? '';
    console.log(
      `  read: name=${await cam.inputValue('[data-testid="field-name"]')} ` +
        `dob=${await cam.inputValue('[data-testid="field-dob"]')} ` +
        `tob="${await cam.inputValue('[data-testid="field-tob"]')}" ` +
        `pob=${await cam.inputValue('[data-testid="field-pob"]')}`,
    );
    // F308's whole point, asserted on the live read: the DEFAULT box must
    // take in the WHOLE name and the WHOLE place. Before the gutter walk
    // this page read "Verma" and "Nagpur, Mahar-" — clipped, and reported as
    // `stated` at high confidence, which is a wrong value wearing a right
    // one.
    const readName = await cam.inputValue('[data-testid="field-name"]');
    const readPlace = await cam.inputValue('[data-testid="field-pob"]');
    check(readName === 'Asha Verma', `the FULL name was read — "${readName}"`);
    check(
      readPlace === 'Nagpur, Maharashtra',
      `the FULL place was read — "${readPlace}"`,
    );
    check(
      (await cam.inputValue('[data-testid="field-dob"]')) === '1994-05-14',
      'and the date, as an ISO date',
    );
    check(/your snapshot/.test(review), 'every read value says it came from the snapshot');
    check(
      /(high|moderate) confidence|not sure I read it right/.test(review),
      'confidence is shown in WORDS, not as a percentage',
    );
    check(
      !/read from what you gave me/.test(review),
      'and it never claims the user GAVE a value they did not give',
    );
    check(!review.includes('%'), 'no percentage anywhere');
    check(await cam.isDisabled('[data-testid="confirm"]'), 'NOTHING arrives confirmed');
    await shot(cam, '14-vision-review');
  }

  } // end of the budgeted leg 17

  step(18, 'confirm → the scorecard, then outcome (b): instant, unsaved');
  // Guarded: a failed extraction is a REPORTED outcome, not a crash that
  // hides every leg after it.
  if (!visionRead) {
    check(
      true,
      `skipped legs 18-22 — ${
        capped
          ? 'the daily capture cap is spent'
          : !mayCapture()
            ? `no capture budget (CAPTURE_BUDGET=${CAPTURE_BUDGET})`
            : 'the vision read produced no candidates'
      }`,
    );
    await cam.close();
  }
  if (visionRead) {
  const acceptAll = async (page) => {
    for (const key of ['name', 'dob', 'pob']) {
      const accept = page.locator(`[data-testid="field-${key}-accept"]`);
      if (await accept.count()) await accept.click();
      else await page.fill(`[data-testid="field-${key}"]`, key === 'dob' ? '1994-05-14' : 'Asha Verma');
    }
    const decline = page.locator('[data-testid="field-tob-decline"]');
    if (await decline.count()) await decline.click();
    await page.waitForSelector('[data-testid="place-resolved"]', { timeout: 30_000 });
    await page.click('[data-testid="confirm"]');
  };
  await acceptAll(cam);
  await cam.waitForSelector('[data-testid="two-outcomes"]', { timeout: 180_000 });
  await cam.waitForTimeout(1500);
  const reading = (await cam.textContent('body')) ?? '';
  check(!reading.includes('%'), 'the scorecard carries no percentage');
  check(
    /Add to my matches/.test(reading) && /Instant reading/.test(reading),
    'both outcomes are offered, neither is taken by default',
  );
  await shot(cam, '15-scorecard');

  await cam.click('[data-testid="instant-reading"]');
  await cam.waitForSelector('[data-testid="chips"]', { timeout: 10_000 });

  step(19, 'the chips — four instant, counted against the network');
  const chipRequests = [];
  const watchChips = (r) => {
    if (r.url().includes('localhost:8080') || r.url().includes('chatbackend')) {
      chipRequests.push(r.url());
    }
  };
  context.on('request', watchChips);
  const instantChips = await cam.$$eval('[data-cost="instant"]', (els) =>
    els.map((e) => e.getAttribute('data-testid')),
  );
  console.log(`  instant chips: ${JSON.stringify(instantChips)}`);
  for (const id of instantChips) {
    await cam.click(`[data-testid="${id}"]`);
    await cam.waitForSelector('[data-testid="chip-answer"]', { timeout: 5_000 });
  }
  await cam.waitForTimeout(1500);
  context.off('request', watchChips);
  check(
    chipRequests.length === 0,
    `the instant chips made ZERO backend requests (${chipRequests.length})`,
  );
  check(instantChips.length >= 1, `${instantChips.length} chip(s) answered with no model call`);
  await shot(cam, '16-chip-instant');

  const askChips = await cam.$$eval('[data-cost="asks"]', (els) =>
    els.map((e) => e.getAttribute('data-testid')),
  );
  check(askChips.length >= 1, `${askChips.length} chip(s) are honestly labelled as asking`);
  await cam.click(`[data-testid="${askChips[0]}"]`);
  const chipAnswered = await cam
    .waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="chip-answer"]');
        return el && el.textContent && el.textContent.length > 80;
      },
      { timeout: 180_000 },
    )
    .then(() => true)
    .catch(() => false);
  // Either it answered, or it SAID why it could not. What is forbidden is a
  // chip that spins: the local backend reloads on every file change (the
  // reviewers' mutation runs touch `graph.py`), which kills an in-flight
  // turn, and the honest client behaviour is a stated error.
  const chipText = (await cam.textContent('[data-testid="chip-answer"]')) ?? '';
  check(
    chipAnswered || chipText.trim().length > 0,
    chipAnswered
      ? 'a model chip answered in the same chat, beside the scorecard'
      : `the model chip STATED what went wrong rather than spinning: "${chipText.slice(0, 90)}"`,
  );
  const afterChip = (await cam.textContent('body')) ?? '';
  check(/Kundli Milan|of 15|of 36/.test(afterChip), 'and the scorecard is still on screen');
  check(
    !/happy married life|guaranteed|you will marry/i.test(afterChip),
    'nothing guarantees a marriage outcome',
  );
  await shot(cam, '17-chip-model');

  step(20, 'F149 — closing the panel leaves no person, no match, and no chat');
  const chatsBeforeClose = await api('/chats');
  const snapChat = (chatsBeforeClose.body?.chats ?? []).find((c) =>
    String(c.title ?? '').includes('—'),
  );
  const snapPeopleBefore = await api('/people');
  const snapMatchesBefore = await api('/people/matches');
  await cam.close();
  let snapGone = false;
  for (let i = 0; i < 30 && !snapGone; i += 1) {
    await new Promise((r) => setTimeout(r, 1000));
    const list = await api('/chats');
    snapGone = !(list.body?.chats ?? []).some((c) => c.id === snapChat?.id);
  }
  check(snapGone, 'the unsaved reading\'s chat was deleted when the panel closed');
  const snapPeopleAfter = await api('/people');
  check(
    (snapPeopleAfter.body?.people ?? []).length === (snapPeopleBefore.body?.people ?? []).length,
    'no person was created by an instant reading',
  );
  const snapMatchesAfter = await api('/people/matches');
  check(
    JSON.stringify(snapMatchesAfter.body) === JSON.stringify(snapMatchesBefore.body),
    'and GET /people/matches is byte-identical before and after',
  );

  step(21, 'outcome (a) — Add to my matches lands the person in the store');
  // Cap-aware like 23 and 24: this leg spends a capture of its own, and the
  // allowance is ten a day. `e2e/save-walk.mjs` proves the same save path on
  // the FREE (typed) route and is the one to run when the cap is spent.
  if (capped || !mayCapture()) {
    check(true, "SKIPPED — no capture budget left for this leg (ASTRAL-318's daily "
      + 'allowance); the save path is proved by e2e/save-walk.mjs, which spends none');
  } else {
  spendCapture();
  const save = await context.newPage();
  await save.setViewportSize({ width: 380, height: 900 });
  await save.goto(`chrome-extension://${extensionId}/panel.html`);
  await save.waitForSelector('[data-testid="snapshot"]', { timeout: 10_000 });
  await save.bringToFront();
  await worker.evaluate(
    async (image) => chrome.runtime.sendMessage({ type: 'capture/delivered', image, gesture: 'context-menu' }),
    captured,
  );
  await save.waitForSelector('[data-testid="crop-canvas"]', { timeout: 10_000 });
  await save.click('[data-testid="consent"]');
  await save.click('[data-testid="crop-send"]');
  await save.waitForSelector('[data-testid="field-name"], [data-testid="capture-problem"]', {
    timeout: 90_000,
  });
  let savedName = null;
  if ((await save.locator('[data-testid="capture-problem"]').count()) === 0) {
    savedName = await save.inputValue('[data-testid="field-name"]');
    await acceptAll(save);
    await save.waitForSelector('[data-testid="two-outcomes"]', { timeout: 180_000 });
    await save.click('[data-testid="save-match"]');
    await save.waitForSelector('[data-testid="saved"]', { timeout: 180_000 });
    await shot(save, '18-saved');
    const stored = await api('/people/matches');
    check(
      JSON.stringify(stored.body).includes(savedName),
      `the match is in GET /people/matches under "${savedName}"`,
    );
    const people = await api('/people');
    const person = (people.body?.people ?? []).find((p) => p.display_name === savedName);
    check(Boolean(person), 'and the person is in GET /people');

    const savedChat = (await api('/chats')).body?.chats?.find((c) =>
      String(c.title ?? '').includes(savedName),
    );
    await save.close();
    await new Promise((r) => setTimeout(r, 6000));
    const stillThere = (await api('/chats')).body?.chats?.some((c) => c.id === savedChat?.id);
    check(Boolean(stillThere), 'a SAVED reading\'s chat is NOT swept when the panel closes');

    step(22, 'clean up everything leg 21 created');
    if (person) {
      const gone = await api(`/people/${person.id}`, { method: 'DELETE' });
      console.log(`  deleted person ${person.id} → ${gone.status}`);
      check(gone.status === 204 || gone.status === 200, 'the person and their match are deleted');
    }
    if (savedChat) {
      const gone = await api(`/chats/${savedChat.id}`, { method: 'DELETE' });
      console.log(`  deleted chat ${savedChat.id} → ${gone.status}`);
    }
  } else {
    check(false, 'the save leg could not read the page');
    await save.close();
  }
  } // end of the cap-aware leg 21

  } // end of the guarded legs 18-22

  step(23, 'a crop with NO birth details on it — the designed state');
  if (capped || !mayCapture()) {
    check(true, 'SKIPPED — no capture budget left for this leg (ASTRAL-318)');
  } else {
  spendCapture();
  const plain = await context.newPage();
  await plain.setViewportSize({ width: 900, height: 500 });
  await plain.goto('http://localhost:8099/plain', { waitUntil: 'domcontentloaded' });
  const plainShot = `data:image/png;base64,${(await plain.screenshot()).toString('base64')}`;
  const nothing = await context.newPage();
  await nothing.setViewportSize({ width: 380, height: 900 });
  await nothing.goto(`chrome-extension://${extensionId}/panel.html`);
  await nothing.waitForSelector('[data-testid="snapshot"]', { timeout: 10_000 });
  await nothing.bringToFront();
  await worker.evaluate(
    async (image) => chrome.runtime.sendMessage({ type: 'capture/delivered', image, gesture: 'command' }),
    plainShot,
  );
  await nothing.waitForSelector('[data-testid="crop-canvas"]', { timeout: 10_000 });
  await nothing.click('[data-testid="consent"]');
  await nothing.click('[data-testid="crop-send"]');
  await nothing.waitForSelector('[data-testid="capture-problem"], [data-testid="field-name"]', {
    timeout: 90_000,
  });
  const refused = await nothing.locator('[data-testid="capture-problem"]').count();
  if (refused) {
    const sentence = await nothing.textContent('[data-testid="capture-problem"]');
    console.log(`  → ${sentence}`);
    check(true, 'a page with no birth details is a stated state, not an empty form');
    check(
      (await nothing.locator('[data-testid="door-paste"]').count()) > 0,
      'and it offers the always-free doors',
    );
  } else {
    const values = await Promise.all(
      ['name', 'dob', 'tob', 'pob'].map((k) => nothing.inputValue(`[data-testid="field-${k}"]`)),
    );
    check(
      values.every((v) => !v),
      `the extractor invented nothing from a page with no details (${JSON.stringify(values)})`,
    );
  }
  await shot(nothing, '19-unreadable');
  await nothing.close();
  await plain.close();
  } // end of the cap-aware leg 23

  step(24, 'a TWO-PERSON page — what does the extractor do, and does review doubt it?');
  if (capped || !mayCapture()) {
    check(true, 'SKIPPED — no capture budget left for this leg (ASTRAL-318)');
  } else {
  spendCapture();
  const two = await context.newPage();
  await two.setViewportSize({ width: 1000, height: 700 });
  await two.goto('http://localhost:8099/two', { waitUntil: 'domcontentloaded' });
  const twoShot = `data:image/png;base64,${(await two.screenshot()).toString('base64')}`;
  const twoPanel = await context.newPage();
  await twoPanel.setViewportSize({ width: 380, height: 900 });
  await twoPanel.goto(`chrome-extension://${extensionId}/panel.html`);
  await twoPanel.waitForSelector('[data-testid="snapshot"]', { timeout: 10_000 });
  await twoPanel.bringToFront();
  await worker.evaluate(
    async (image) => chrome.runtime.sendMessage({ type: 'capture/delivered', image, gesture: 'command' }),
    twoShot,
  );
  await twoPanel.waitForSelector('[data-testid="crop-canvas"]', { timeout: 10_000 });
  // Deliberately widen the crop to the WHOLE page so both people are in it —
  // the hard case, not the easy one.
  await twoPanel.fill('[data-testid="crop-x"]', '0');
  await twoPanel.fill('[data-testid="crop-y"]', '0');
  await twoPanel.fill('[data-testid="crop-width"]', '9999');
  await twoPanel.fill('[data-testid="crop-height"]', '9999');
  await twoPanel.click('[data-testid="consent"]');
  await twoPanel.click('[data-testid="crop-send"]');
  await twoPanel.waitForSelector('[data-testid="capture-problem"], [data-testid="field-name"]', {
    timeout: 90_000,
  });
  if ((await twoPanel.locator('[data-testid="capture-problem"]').count()) === 0) {
    const read = {
      name: await twoPanel.inputValue('[data-testid="field-name"]'),
      dob: await twoPanel.inputValue('[data-testid="field-dob"]'),
      pob: await twoPanel.inputValue('[data-testid="field-pob"]'),
    };
    const body = (await twoPanel.textContent('body')) ?? '';
    console.log(`  read from a page describing TWO people: ${JSON.stringify(read)}`);
    const doubted = /I worked this one out|check it|more than one/.test(body);
    console.log(`  does the review show doubt? ${doubted ? 'YES' : 'NO'}`);
    // An OBSERVATION, reported either way: the engine's extractor has no
    // multi-person signal in its §4 contract, so this records what it did.
    check(true, `two-person page → ${JSON.stringify(read)}, doubt shown: ${doubted}`);
  } else {
    console.log(`  → ${await twoPanel.textContent('[data-testid="capture-problem"]')}`);
    check(true, 'the two-person page was refused rather than collapsed into one person');
  }
  await shot(twoPanel, '20-two-people');
  await twoPanel.close();
  await two.close();
  } // end of the cap-aware leg 24
  await biodata.close();

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
  pageServer.close();
}

console.log(
  `\ncaptures spent: ${capturesSpent} of a CAPTURE_BUDGET of ${CAPTURE_BUDGET}`,
);
console.log(`\n${failures === 0 ? 'WALK PASSED' : `WALK FAILED — ${failures} check(s)`}`);
process.exit(failures === 0 ? 0 : 1);
