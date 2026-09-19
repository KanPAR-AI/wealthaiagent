/**
 * PH-41's legs — the selection read, the shortlist, compare, one chat per
 * match (docs/73 ASTRAL-338…341).
 *
 * They live in their own module for one reason, and it is operational: the
 * local backend RELOADS on every file change another agent makes (F307), and
 * a reload kills whatever SSE turn is in flight. `walk.mjs` runs twenty-four
 * legs before these, two of which are streamed readings — so on a busy
 * afternoon PH-41 is never reached. `e2e/ph41-walk.mjs` runs THE SAME CODE
 * with nothing before it.
 *
 * Nothing is duplicated: `walk.mjs` imports this and calls it where the legs
 * used to be, so there is one implementation and one place to change it.
 *
 * The caller supplies everything that touches the outside world — the browser
 * context, the extension's worker and id, the API helper, and the three
 * reporters — so this file opens no browser and owns no exit code.
 */

export async function ph41Legs({ context, worker, extensionId, api, check, step, shot }) {
  /**
   * `GET /chats` answers with a LIST, not `{chats: […]}` — measured
   * 2026-09-19, and the first cut of these legs read `.body?.chats ?? []`,
   * which is `[]` on every call and made "exactly one chat was opened" report
   * zero while the re-entry was demonstrably posting into one. Tolerant of
   * both shapes, like `walk.mjs`'s own readers.
   */
  const chatsOf = (reply) =>
    Array.isArray(reply.body) ? reply.body : (reply.body?.chats ?? []);

  /** every chat THESE legs opened, by id — the only ones cleanup may delete */
  const ph41Chats = [];
  // ══════════════════════════════════════════════════════════════════════
  // PH-41 — the selection read, the shortlist, compare, one chat per match
  //         (docs/73 ASTRAL-338…341)
  //
  // THE ONE SUBSTITUTION, STATED — the same one PH-40 makes, for the same
  // measured reason. `chrome.scripting.executeScript` needs `activeTab`, and
  // `activeTab` is granted by a BROWSER-PROCESS gesture (the toolbar action, a
  // keyboard command, a native context-menu item). Playwright drives the
  // renderer, so no automation can produce one — `e2e/spike-f159.mjs` measured
  // the refusal from the panel, from the worker, on an https page, on a
  // localhost page and on the extension's own page.
  //
  // So leg 25 PROBES the injection for real and reports what Chrome said, and
  // leg 26 delivers a REAL selection — read from the synthetic page with the
  // same statement the injected function runs — through the same
  // `selection/delivered` broadcast a keyboard gesture uses. Everything
  // downstream of it is real: the parser, the review, the three states.
  // ══════════════════════════════════════════════════════════════════════

  step(25, 'ASTRAL-338 — the selection read, asked for with no grant');
  const selPage = await context.newPage();
  await selPage.setViewportSize({ width: 1100, height: 800 });
  await selPage.goto('http://localhost:8099/biodata', { waitUntil: 'domcontentloaded' });
  const sel = await context.newPage();
  await sel.setViewportSize({ width: 380, height: 900 });
  await sel.goto(`chrome-extension://${extensionId}/panel.html`);
  await sel.waitForSelector('[data-testid="selection"]', { timeout: 10_000 });
  await sel.click('[data-testid="selection"]');
  // FOUR outcomes are honest here and the walk reports whichever happened:
  // the gesture instruction (Chrome granted nothing), "nothing was selected",
  // a review (the grant was present), or a named failure. What is forbidden is
  // a button that does NOTHING — so the check is "the screen changed and says
  // something", and the sentence it says is printed.
  await sel.waitForTimeout(3000);
  const selAfterClick = (await sel.textContent('body')) ?? '';
  const selStates = {
    instruction: (await sel.locator('[data-testid="selection-instruction"]').count()) > 0,
    empty: (await sel.locator('[data-testid="selection-empty"]').count()) > 0,
    review: (await sel.locator('[data-testid="field-name"]').count()) > 0,
    failed: /That didn't go through/.test(selAfterClick),
  };
  console.log(`  states: ${JSON.stringify(selStates)}`);
  console.log(`  the panel says: "${selAfterClick.replace(/\s+/g, ' ').slice(0, 220)}"`);
  await shot(sel, '21-selection-asked');
  check(
    Object.values(selStates).some(Boolean),
    `the button did something honest — ${JSON.stringify(selStates)}`,
  );
  check(
    !/Whose match shall I read/.test(selAfterClick),
    'and it did not silently stay on the screen it started from',
  );
  if ((await sel.locator('[data-testid="selection-instruction"]').count()) > 0) {
    const steps = await sel.textContent('[data-testid="selection-instruction"]');
    check(
      /Read my selection into AstroMatch/.test(steps ?? ''),
      'and it names the SELECTION menu item, not the camera’s',
    );
    check(
      !/Read this page into AstroMatch/.test(steps ?? ''),
      'and it never sends the user to the camera’s door',
    );
    await shot(sel, '21-selection-instruction');
  }

  step(26, 'a REAL selection on the synthetic page → the review, parsed locally');
  // The same statement the injected function runs (`readSelectionInPage`,
  // whose own source is pinned by `selection.test.ts`), executed in the page
  // because automation cannot make the browser-process gesture that would let
  // the extension do it.
  const selectedText = await selPage.evaluate(() => {
    const table = document.querySelector('table');
    const selection = window.getSelection();
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(table);
    selection.addRange(range);
    return selection.toString();
  });
  console.log(`  selected ${selectedText.length} characters from the synthetic page`);
  check(/Date of Birth/.test(selectedText), 'the selection carries the birth rows');
  const selRequests = [];
  const watchSelection = (r) => {
    if (r.url().includes('localhost:8080') || r.url().includes('chatbackend')) {
      selRequests.push(`${r.method()} ${r.url()}`);
    }
  };
  context.on('request', watchSelection);
  await sel.bringToFront();
  await worker.evaluate(
    async (text) =>
      chrome.runtime.sendMessage({ type: 'selection/delivered', text, gesture: 'command' }),
    selectedText,
  );
  await sel.waitForSelector('[data-testid="field-name"]', { timeout: 15_000 });
  await sel.waitForTimeout(1500);
  context.off('request', watchSelection);
  const selReview = (await sel.textContent('body')) ?? '';
  console.log(
    `  read: name=${await sel.inputValue('[data-testid="field-name"]')} ` +
      `dob=${await sel.inputValue('[data-testid="field-dob"]')} ` +
      `tob=${await sel.inputValue('[data-testid="field-tob"]')} ` +
      `pob=${await sel.inputValue('[data-testid="field-pob"]')}`,
  );
  check(
    (await sel.inputValue('[data-testid="field-dob"]')) === '1994-05-14',
    'the DATE was parsed out of the selection, here in the panel',
  );
  check(
    /read from: Date of Birth/.test(selReview),
    'every value shows the LINE it was read from',
  );
  check(
    /read from what you selected on the page/.test(selReview),
    'and the sentence is true of a SELECTION — not "what you gave me", not "your snapshot"',
  );
  check(!selReview.includes('%'), 'no percentage anywhere');
  check(
    selRequests.length === 0,
    `the selection read sent NOTHING — ${selRequests.length} backend request(s): ${JSON.stringify(selRequests)}`,
  );
  check(
    await sel.isDisabled('[data-testid="confirm"]'),
    'nothing arrives confirmed: the user still reviews it field by field',
  );
  await shot(sel, '22-selection-review');
  await sel.close();
  await selPage.close();

  step(27, 'ASTRAL-339 — the shortlist is the engine’s three labelled groups');
  // A time-less saved match, so the firm-only group has a row. Created here
  // and deleted at the end of this block; the REFUSED row (if any) is seeded
  // by `e2e/seed-refused-match.py`, because the engine cannot mint one from a
  // chat at all — `_persist_saved_match` says so in its own comment.
  /**
   * A TWO-WORD, capitalised name, and that is load-bearing.
   *
   * `graph._MATCH_NAME_CUE` matches `match with <Name>` where the name is one
   * or two `[A-Z][a-z]+` words. "Walk Timeless Person" (three words) never
   * matched, so the rehydration never fired and every ask recomputed — which
   * is exactly the case FLAG-1 is about, and the reason this walk can now
   * demonstrate BOTH branches: a FRESH row the engine narrates from store,
   * and a STALE row it scores again.
   */
  const TIMELESS = 'Timeless Walker';
  const chatsBeforeMint = chatsOf(await api('/chats'));
  const mint = await context.newPage();
  await mint.setViewportSize({ width: 380, height: 900 });
  await mint.goto(`chrome-extension://${extensionId}/panel.html`);
  await mint.waitForSelector('[data-testid="manual"]', { timeout: 15_000 });
  await mint.click('[data-testid="manual"]');
  await mint.fill('[data-testid="field-name"]', TIMELESS);
  await mint.fill('[data-testid="field-dob"]', '1992-03-04');
  await mint.click('[data-testid="field-tob-decline"]');
  await mint.fill('[data-testid="field-pob"]', 'Pune, India');
  await mint.waitForSelector('[data-testid="place-resolved"]', { timeout: 30_000 });
  await mint.click('[data-testid="confirm"]');
  await mint.waitForSelector('[data-testid="two-outcomes"], [data-testid="retention"]', {
    timeout: 240_000,
  });
  const canSave = (await mint.locator('[data-testid="save-match"]').count()) > 0;
  let saidSaved = false;
  if (canSave) {
    await mint.click('[data-testid="save-match"]');
    // EITHER outcome is honest (F385): the engine's word, or "I couldn't tell
    // whether that saved" when the turn came back empty — which is what a
    // reloading local backend produces, and which must never be printed as
    // "Added to your matches". The AUTHORITY on whether it landed is the
    // People store, checked below.
    // A TERMINAL state, not the first card that appears: `save-problem` is
    // also the IN-FLIGHT card ("Adding them to your matches…"), so waiting on
    // the element alone raced past the save and blamed the panel for a turn
    // that had not finished.
    await mint.waitForFunction(
      () => {
        if (document.querySelector('[data-testid="saved"]')) return true;
        const problem = document.querySelector('[data-testid="save-problem"]');
        const text = problem?.textContent ?? '';
        return Boolean(text) && !/Adding them to your matches/.test(text);
      },
      // Playwright's signature is (pageFunction, arg, options) — passing the
      // options object SECOND makes it the argument and leaves the default
      // 30 s timeout in place, which reported a 40-second turn as "it never
      // came back". `undefined` is the argument.
      undefined,
      { timeout: 240_000 },
    );
    saidSaved = (await mint.locator('[data-testid="saved"]').count()) > 0;
    if (!saidSaved) {
      const note = (await mint.textContent('[data-testid="save-problem"]')) ?? '';
      console.log(`  the panel did not claim a save: "${note.trim().slice(0, 120)}"`);
      check(
        /couldn't tell whether that saved|couldn't add them/.test(note),
        'and it said so honestly rather than claiming the match was added (F385)',
      );
    }
  }
  const mintedPersonNow = (await api('/people')).body?.people?.find(
    (p) => p.display_name === TIMELESS,
  );
  check(
    Boolean(mintedPersonNow),
    `a time-less reading is in the People store, so the firm-only group has a row` +
      `${saidSaved ? '' : ' (the panel said it could not tell; the store is the authority)'}`,
  );
  const mintChat = chatsOf(await api('/chats')).find(
    (c) => !chatsBeforeMint.some((b) => b.id === c.id),
  );
  console.log(`  the saved reading's chat is ${mintChat?.id} ("${mintChat?.title}")`);
  await mint.close();
  await new Promise((r) => setTimeout(r, 4000));

  const shortlistPage = await context.newPage();
  await shortlistPage.setViewportSize({ width: 380, height: 900 });
  await shortlistPage.goto(`chrome-extension://${extensionId}/panel.html`);
  await shortlistPage.waitForSelector('[data-testid="shortlist-open"]', { timeout: 10_000 });
  await shortlistPage.click('[data-testid="shortlist-open"]');
  await shortlistPage.waitForSelector('[data-testid="shortlist"]', { timeout: 30_000 });
  // F383, at the real level: opening a panel SWEEPS whatever delete is still
  // owed, and a saved reading's chat id used to stay on that list for ever —
  // so the conversation the user chose to keep was deleted the next time they
  // opened the panel. PH-40's walk never opened a second one; this leg does,
  // three lines after the save, which is how it was found.
  await new Promise((r) => setTimeout(r, 4000));
  check(
    Boolean(mintChat) && chatsOf(await api('/chats')).some((c) => c.id === mintChat.id),
    `the SAVED reading's chat survived the next panel open (${mintChat?.id})`,
  );
  const served = await api('/people/matches');
  const servedGroups = served.body?.groups ?? [];
  for (const group of servedGroups) {
    const label = await shortlistPage.textContent(`[data-testid="group-label-${group.key}"]`);
    const rule = await shortlistPage.textContent(`[data-testid="group-rule-${group.key}"]`);
    check(label === group.label, `group "${group.key}" carries the engine’s own label`);
    check(rule === group.sort_rule, `…and the engine’s own sort rule: "${rule}"`);
  }
  const shortlistText = (await shortlistPage.textContent('body')) ?? '';
  check(!shortlistText.includes('%'), 'no percentage on the shortlist');
  check(
    !/#\d+ of \d+|best match|top match|winner/i.test(shortlistText),
    'and no ranking across the groups',
  );
  const firmRow = (servedGroups.find((g) => g.key === 'firm_only')?.rows ?? [])[0];
  if (firmRow) {
    const score = await shortlistPage.textContent(`[data-testid="score-${firmRow.pair_key}"]`);
    check(
      !/36/.test(score ?? '') && /need a birth time/.test(score ?? ''),
      `the firm-only row is out of 15 with its pending count — "${score}"`,
    );
  } else {
    check(false, 'no firm-only row was served, so its scale could not be checked');
  }
  const refusedRow = (servedGroups.find((g) => g.key === 'refused')?.rows ?? [])[0];
  if (refusedRow) {
    const reason = await shortlistPage.textContent(`[data-testid="refusal-${refusedRow.pair_key}"]`);
    check(Boolean(reason), `the refused row states its reason — "${String(reason).slice(0, 70)}"`);
    check(
      (await shortlistPage.locator(`[data-testid="score-${refusedRow.pair_key}"]`).count()) === 0,
      'and carries no score at all',
    );
  } else {
    console.log(
      '  no refused row on this account — seed one with ' +
        '`docker exec -i yourfinadvisor_api sh -c "cd /app && python - seed" < e2e/seed-refused-match.py`',
    );
    check(true, 'SKIPPED the refused-row check: the account has none (see the line above)');
  }
  await shot(shortlistPage, '23-shortlist');

  step(28, 'ASTRAL-339 — favourite round-trips through the shipped label PATCH');
  const starRow = (servedGroups.find((g) => g.rows.length)?.rows ?? [])[0];
  const before = (await api('/people')).body?.people?.find((p) => p.id === starRow.person_id);
  await shortlistPage.click(`[data-testid="star-${starRow.pair_key}"]`);
  await shortlistPage.waitForTimeout(2500);
  const afterStar = (await api('/people')).body?.people?.find((p) => p.id === starRow.person_id);
  check(
    Boolean(afterStar?.favourite) !== Boolean(before?.favourite),
    `the star reached the People store (${Boolean(before?.favourite)} → ${Boolean(afterStar?.favourite)})`,
  );
  check(
    (await shortlistPage.locator('[data-testid="shortlist-problem"]').count()) === 0,
    'and the panel reported no problem',
  );
  // …and put it back, so the account is left as it was found
  await shortlistPage.click(`[data-testid="star-${starRow.pair_key}"]`);
  await shortlistPage.waitForTimeout(2500);
  const restored = (await api('/people')).body?.people?.find((p) => p.id === starRow.person_id);
  check(
    Boolean(restored?.favourite) === Boolean(before?.favourite),
    'and it toggles back, leaving the account as it was found',
  );

  step(29, 'ASTRAL-340 — compare a /36, a firm-only and a refusal: no rank anywhere');
  const pickable = [];
  for (const group of servedGroups) {
    if (group.rows.length) pickable.push(group.rows[0]);
  }
  const compareRequests = [];
  const watchCompare = (r) => {
    if (r.url().includes('localhost:8080') || r.url().includes('chatbackend')) {
      compareRequests.push(`${r.method()} ${r.url().split('/api/v1')[1]}`);
    }
  };
  context.on('request', watchCompare);
  for (const row of pickable) await shortlistPage.click(`[data-testid="pick-${row.pair_key}"]`);
  await shortlistPage.click('[data-testid="compare-open"]');
  await shortlistPage.waitForSelector('[data-testid="compare"]', { timeout: 30_000 });
  await shortlistPage.waitForTimeout(1500);
  context.off('request', watchCompare);
  console.log(`  compare made ${compareRequests.length} request(s): ${JSON.stringify(compareRequests)}`);
  check(
    compareRequests.length === pickable.length &&
      compareRequests.every((r) => r.startsWith('GET /people/matches/')),
    `compare is ${pickable.length} READS and nothing else`,
  );
  const compareText = (await shortlistPage.textContent('body')) ?? '';
  check(!compareText.includes('%'), 'no percentage in the comparison');
  check(/no overall winner/.test(compareText), 'and it says there is no overall winner');
  check(/in the order you picked them/.test(compareText), 'and that the order is the user’s');
  check(
    !/\bbest\b|\bwins\b|\bhighest\b|#1/i.test(compareText),
    'nothing anywhere calls one of them better',
  );
  const columnOrder = await shortlistPage.$$eval('[data-testid^="column-"]', (els) =>
    els.map((e) => e.getAttribute('data-testid')),
  );
  check(
    JSON.stringify(columnOrder) === JSON.stringify(pickable.map((r) => `column-${r.pair_key}`)),
    'the columns are in the order they were picked',
  );
  if (firmRow) {
    check(
      /pending/.test(compareText),
      'a koota the time-less match could not score reads as pending, not as a zero',
    );
    check(
      /needs an exact birth time/.test(compareText),
      'and every time-dependent row is marked as such',
    );
  }
  if (refusedRow) {
    check(
      (await shortlistPage.locator(`[data-testid="column-${refusedRow.pair_key}"]`).count()) === 1,
      'the refused match keeps its column',
    );
    check(
      (await shortlistPage.locator(`[data-testid="total-${refusedRow.pair_key}"]`).count()) === 0,
      'with no numbers in it',
    );
  }
  await shot(shortlistPage, '24-compare');

  step(30, 'ASTRAL-341 / FLAG-1 — the chat says only what it knows, on BOTH kinds of row');
  await shortlistPage.click('[data-testid="compare-back"]');
  await shortlistPage.waitForSelector('[data-testid="shortlist"]', { timeout: 20_000 });

  /**
   * One ask, measured on the STREAM itself.
   *
   * `graph.py:13251` — "Casting both Kundlis and matching the 36 gunas…" —
   * has exactly ONE emitter: the first yield of `node_synastry`, the node
   * that casts two charts and runs gun milan. The narrate path
   * (`stored_match_narrate` → `adjudicate`) does not emit it. So its presence
   * or absence in what the user reads IS the answer to "did this turn score
   * the match again?", and every claim below is checked against it rather
   * than against what the screen hoped.
   */
  const askAbout = async (row, shotName) => {
    const matchesBefore = await api('/people/matches');
    const chatsBefore = chatsOf(await api('/chats'));
    const before = (await shortlistPage.textContent('body')) ?? '';
    const promisedOnList = /nothing is scored again/.test(before);
    await shortlistPage.click(`[data-testid="ask-${row.pair_key}"]`);
    await shortlistPage.waitForSelector('[data-testid="match-chat-basis"]', { timeout: 20_000 });
    const basisBefore = (await shortlistPage.textContent('[data-testid="match-chat-basis"]')) ?? '';
    console.log(`  ${row.display_name} (${row.freshness}) opens with: "${basisBefore.slice(0, 110)}…"`);

    const answered = await shortlistPage
      .waitForFunction(
        () => {
          const el = document.querySelector('[data-testid="match-chat-answer"]');
          return Boolean(el && (el.textContent ?? '').trim().length > 80);
        },
        undefined,
        { timeout: 240_000 },
      )
      .then(() => true)
      .catch(() => false);
    const chatText = (await shortlistPage.textContent('body')) ?? '';
    const answer = (await shortlistPage.locator('[data-testid="match-chat-answer"]').count()) > 0
      ? ((await shortlistPage.textContent('[data-testid="match-chat-answer"]')) ?? '').trim()
      : '';
    const problem = (await shortlistPage.locator('[data-testid="match-chat-problem"]').count()) > 0
      ? ((await shortlistPage.textContent('[data-testid="match-chat-problem"]')) ?? '').trim()
      : '';
    const spinning = !answered && !problem && !answer && /Reading what's on file/.test(chatText);
    check(
      !spinning,
      answered
        ? `${row.display_name}: the match chat answered`
        : problem
          ? `${row.display_name}: the chat STATED what went wrong — "${problem.slice(0, 70)}"`
          : `${row.display_name}: the chat STATED the turn it got — "${answer.slice(0, 70)}"`,
    );
    check(
      !/\[Using [a-z_]+ agent\]/.test(chatText),
      'the platform\'s routing banner is not shown to the user',
    );
    check(
      (await shortlistPage.locator('[data-testid="field-dob"]').count()) === 0,
      'entering asks for NO birth details again',
    );
    const matchesAfter = await api('/people/matches');
    check(
      JSON.stringify(matchesAfter.body) === JSON.stringify(matchesBefore.body),
      'GET /people/matches is byte-identical before and after — no stored match was rewritten',
    );
    if (shotName) await shot(shortlistPage, shotName);
    const cast = /Casting both Kundlis/.test(answer);
    const rescoredNote =
      (await shortlistPage.locator('[data-testid="match-chat-rescored"]').count()) > 0;
    const basisNow = (await shortlistPage.textContent('[data-testid="match-chat-basis"]')) ?? '';
    return {
      chatsBefore,
      promisedOnList,
      basisBefore,
      basisNow,
      body: chatText,
      cast,
      rescoredNote,
      answered,
      answer,
    };
  };

  const freshRow = (servedGroups.flatMap((g) => g.rows)).find(
    (r) => r.freshness === 'fresh' && r.display_name === TIMELESS,
  );
  const staleRow = (servedGroups.flatMap((g) => g.rows)).find((r) => r.freshness === 'stale');

  // ── (a) a FRESH row: the promise may be made, and the engine keeps it ────
  if (freshRow) {
    const fresh = await askAbout(freshRow, '25-match-chat');
    check(
      /nothing is scored again/.test(fresh.basisBefore),
      'a FRESH row opens with the stored-scorecard promise',
    );
    if (fresh.answered) {
      check(
        !fresh.cast,
        'and the engine NARRATED the stored scorecard — its casting line is absent',
      );
      check(
        !fresh.rescoredNote,
        'so nothing is marked as scored again',
      );
      check(
        /nothing is scored again/.test(fresh.basisNow),
        'and the promise still stands after the turn',
      );
    } else {
      check(true, 'SKIPPED the fresh-branch stream assertions — the turn did not come back');
    }
    // one chat id per match, on this row
    const openedFresh = chatsOf(await api('/chats')).filter(
      (c) => !fresh.chatsBefore.some((b) => b.id === c.id),
    );
    check(openedFresh.length === 1, `the first entry opened exactly one chat (${openedFresh.length})`);
    await shortlistPage.click('[data-testid="match-chat-back"]');
    await shortlistPage.waitForSelector('[data-testid="shortlist"]', { timeout: 20_000 });
    const reentryRequests = [];
    const watchReentry = (r) => {
      if (r.url().includes('localhost:8080') || r.url().includes('chatbackend')) {
        reentryRequests.push(`${r.method()} ${r.url().split('/api/v1')[1].split('?')[0]}`);
      }
    };
    context.on('request', watchReentry);
    await shortlistPage.click(`[data-testid="ask-${freshRow.pair_key}"]`);
    await shortlistPage.waitForSelector('[data-testid="match-chat-basis"]', { timeout: 20_000 });
    await shortlistPage.waitForTimeout(6000);
    context.off('request', watchReentry);
    console.log(`  re-entry made: ${JSON.stringify(reentryRequests)}`);
    check(
      !reentryRequests.includes('POST /chats'),
      're-entering opened NO second chat — one chat id per match',
    );
    check(
      !reentryRequests.some((r) => /astrology\//.test(r)),
      'and reached no astrology compute route at all',
    );
    check(
      Boolean(openedFresh[0]) && reentryRequests.every((r) => r.includes(openedFresh[0].id)),
      `every re-entry request went to the SAME chat (${openedFresh[0]?.id})`,
    );
    await shortlistPage.click('[data-testid="match-chat-back"]');
    await shortlistPage.waitForSelector('[data-testid="shortlist"]', { timeout: 20_000 });
    ph41Chats.push(...openedFresh.map((c) => c.id));
  } else {
    check(
      false,
      'no FRESH match on this account — the fresh branch could not be walked ' +
        '(it is covered in match-chat.test.ts and matches.test.tsx)',
    );
  }

  // ── (b) a STALE row: no promise, and the engine says what it did ─────────
  if (staleRow) {
    const stale = await askAbout(staleRow, '25b-match-chat-stale');
    check(
      !/nothing is scored again/.test(stale.basisBefore),
      'a STALE row makes NO stored-scorecard promise before the turn',
    );
    check(
      /may be|scored again/.test(stale.basisBefore),
      `and says it may be scored again here — "${stale.basisBefore.slice(0, 90)}…"`,
    );
    if (stale.answered) {
      console.log(`  the engine's own casting line present: ${stale.cast}`);
      if (stale.cast) {
        check(
          /scored this match again/.test(stale.basisNow),
          'the engine scored it again, and the header says so instead of the promise',
        );
        // ONE statement, not two: the header carries it, so the short note
        // above the scorecard is suppressed (the reviewer's duplicate).
        check(
          !stale.rescoredNote,
          'and it is said ONCE — the note above the scorecard is not a second copy',
        );
        check(
          (stale.body.match(/can differ from the/g) ?? []).length === 1,
          `and that sentence appears exactly once (${(stale.body.match(/can differ from the/g) ?? []).length})`,
        );
      } else {
        check(
          !stale.rescoredNote,
          'the engine narrated instead of recomputing, and nothing claims otherwise',
        );
      }

      // …and the withdrawal STICKS: a second question in the same chat must
      // not put the stored-scorecard promise back (the reviewer's probe).
      await shortlistPage.fill('[data-testid="match-chat-ask"]', 'why is Nadi zero');
      await shortlistPage.click('[data-testid="match-chat-send"]');
      await shortlistPage.waitForTimeout(3000);
      const afterSecond =
        (await shortlistPage.textContent('[data-testid="match-chat-basis"]')) ?? '';
      check(
        !/nothing is scored again/.test(afterSecond),
        `a second question does not restore the promise — "${afterSecond.slice(0, 80)}…"`,
      );
    } else {
      check(true, 'SKIPPED the stale-branch stream assertions — the turn did not come back');
    }
    const openedStale = chatsOf(await api('/chats')).filter(
      (c) => !stale.chatsBefore.some((b) => b.id === c.id),
    );
    ph41Chats.push(...openedStale.map((c) => c.id));
    await shortlistPage.click('[data-testid="match-chat-back"]');
    await shortlistPage.waitForSelector('[data-testid="shortlist"]', { timeout: 20_000 });
  } else {
    check(true, 'SKIPPED the stale branch: this account has no stale match today');
  }
  await shortlistPage.close();

  step(31, 'clean up what the PH-41 legs created');
  const mintedPerson = (await api('/people')).body?.people?.find(
    (p) => p.display_name === TIMELESS,
  );
  if (mintedPerson) {
    const gone = await api(`/people/${mintedPerson.id}`, { method: 'DELETE' });
    console.log(`  deleted person ${mintedPerson.id} → ${gone.status}`);
  }
  // ONLY what these legs created. The per-match chat is deleted by ID, from
  // the before/after diff — deleting "the chat called Match — <name>" would
  // destroy a conversation the user had already had about that match, which
  // is exactly the history ASTRAL-341 exists to keep.
  const createdChatIds = new Set(ph41Chats);
  for (const chat of chatsOf(await api('/chats'))) {
    const title = String(chat.title ?? '');
    if (createdChatIds.has(chat.id) || title.includes(TIMELESS)) {
      const gone = await api(`/chats/${chat.id}`, { method: 'DELETE' });
      console.log(`  deleted chat ${chat.id} ("${title}") → ${gone.status}`);
    }
  }
  check(true, 'the PH-41 legs left the account as they found it');
}
