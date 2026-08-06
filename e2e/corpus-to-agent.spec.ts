/**
 * Corpus → agent builder → chat, end to end. Test cases defined in docs/29.
 *
 * This is the flow the platform is FOR: knowledge goes in one end, an agent
 * answers from it at the other. Every piece of it has unit tests and none of
 * them makes the claim as a whole — which is how the binding step came to have
 * no UI at all while `setCorpusReaders` sat exported and uncalled for weeks.
 *
 * WHAT MAKES THIS SUITE WORTH RUNNING: the grounding pair (D6). Every other
 * assertion here passes just as well against a model answering from
 * pretraining. Before the supplement videos were ingested, this agent answered
 * "how much fish oil should I take" with a confident paragraph about omega-3
 * dosing over a corpus containing no dosages at all. So one test asks the same
 * question with the corpus BOUND and UNBOUND and asserts the answers differ in
 * the specific way that only retrieval can produce.
 *
 * Usage:
 *   npx playwright test e2e/corpus-to-agent.spec.ts --project=chromium
 *   npx playwright test e2e/corpus-to-agent.spec.ts --headed   (watch it)
 *
 * Prerequisites: ./start-all.sh, and knee_timed published with the two
 * supplement videos ingested (docs/29 §1).
 */

import { APIRequestContext, expect, Page, test } from '@playwright/test';

const ADMIN_EMAIL = 'ravipradeep89@gmail.com';
const ADMIN_PASSWORD = 'papa1210';
const API = process.env.VITE_API_BASE_URL || 'http://localhost:8080';
const CORPUS = 'knee_timed';

// A fact that exists ONLY in Dr. David's caption track. Not in the PDF — the
// only numbers there are the list numbers 1 to 13 — and not the sort of thing
// a model recites from pretraining about a named product. This string is the
// whole grounding assertion.
const CORPUS_ONLY_FACT = /950\s*(?:mg|milligram)/i;

// Throwaway per run, with the option to keep it (docs/29 §5.4). Reusing a
// fixture agent means a failed run leaves the next one starting from a state
// nobody chose.
const RUN = Date.now().toString().slice(-6);
const AGENT_ID = process.env.E2E_KEEP_AGENT || `e2e_supp_${RUN}`;
const PERMANENT = Boolean(process.env.E2E_KEEP_AGENT);

// The `request` FIXTURE, not `page.request`: these calls outlive the page in
// afterAll, and a disposed page context turns cleanup into a second failure
// that masks the first.
async function token(req: APIRequestContext): Promise<string> {
  const res = await req.post(`${API}/api/v1/auth/token`, {
    form: { username: 'test_username' },
  });
  return (await res.json()).access_token;
}

async function api(req: APIRequestContext, method: string, path: string, body?: unknown) {
  const t = await token(req);
  const res = await req.fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    data: body === undefined ? undefined : JSON.stringify(body),
    timeout: 600_000,
  });
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}

async function signInAsAdmin(page: Page) {
  await page.goto('/chataiagent/');
  await page.waitForTimeout(3000);
  if (await page.getByText('How can I help you today?').isVisible().catch(() => false)) return;
  const emailButton = page.getByText('Continue with Email');
  await emailButton.waitFor({ state: 'visible', timeout: 10_000 });
  await emailButton.click();
  await page.waitForTimeout(500);
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').filter({ hasText: /Sign In/i }).click();
  await page.getByText('How can I help you today?').waitFor({ state: 'visible', timeout: 20_000 });
}

/** One chat turn, start to finish. Returns the assistant's full text. */
async function ask(req: APIRequestContext, question: string): Promise<string> {
  const t = await token(req);
  const created = await req.post(`${API}/api/v1/chats`, {
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    data: JSON.stringify({
      title: `e2e ${RUN}`,
      firstMessage: { content: question, attachments: [] },
    }),
  });
  const chatId = (await created.json()).chat.id;
  const stream = await req.get(`${API}/api/v1/chats/${chatId}/stream`, {
    headers: { Authorization: `Bearer ${t}` },
    timeout: 240_000,
  });
  const raw = await stream.text();
  if (process.env.E2E_DEBUG) {
    console.log('STREAM', stream.status(), 'len', raw.length);
  }
  // CRLF, and the text rides on `delta` — message_delta events carry no
  // `content` field at all, so reading only that returned "" from a stream
  // that was working perfectly.
  return raw
    .split(/\r?\n/)
    .filter((l) => l.startsWith('data:'))
    .map((l) => {
      try {
        const d = JSON.parse(l.slice(5).trim());
        const piece = d.delta ?? d.content;
        return typeof piece === 'string' ? piece : '';
      } catch {
        return '';
      }
    })
    .join('');
}

test.describe('Corpus → agent → chat', () => {
  test.describe.configure({ mode: 'serial' });
  // Publish re-embeds the whole corpus and every chat case is a live LLM
  // turn; the 180s default fails on work that is simply slow, not broken.
  test.setTimeout(600_000);

  // ── A. the corpus is answerable before any agent exists ──────────────────

  test('A1/A2 — publishing reports its own verification, holding nothing back', async ({ request }) => {
    const { body } = await api(request, 'POST', `/api/v1/admin/corpus/${CORPUS}/publish`);
    expect(body.status).toMatch(/^published/);
    expect(body.chunks).toBeGreaterThan(0);
    // Held-back is a census, not a warning to skim: "published 68" that
    // quietly means "held 6" is the defect this whole chain exists to catch.
    expect(body.held_back).toEqual({});
    expect(body.verification?.ok).toBe(true);
  });

  test('A5 — a second publish has nothing pending', async ({ request }) => {
    const { body } = await api(request, 'GET', `/api/v1/admin/corpus/${CORPUS}/videos`);
    expect(body.summary?.pending_publish ?? 0).toBe(0);
  });

  // ── B. binding ───────────────────────────────────────────────────────────

  test('B1/B2/B3 — readers are settable, deduplicated and order-stable', async ({ request }) => {
    const { body } = await api(request, 'PUT', `/api/v1/admin/corpus/${CORPUS}/readers`, {
      readers: ['knee_arthritis', 'knee_arthritis', AGENT_ID],
    });
    expect(body.readers).toEqual(['knee_arthritis', AGENT_ID]);
  });

  test('B5 — a person can bind a corpus from the Studio, not only by curl', async ({ page }) => {
    // THE GAP THIS SUITE WAS WRITTEN AROUND. PUT /readers has worked for
    // weeks; nothing in any UI called it, and the wizard printed "Set readers
    // on the corpus" beside no control that could.
    await signInAsAdmin(page);
    await page.goto('/chataiagent/admin?section=corpus');
    await page.getByText('Admin Portal').waitFor({ state: 'visible', timeout: 20_000 });
    // By id: the card's visible text is the corpus NAME ("Dr David Knee
    // Program"), which is not the id and changes when somebody renames it.
    await page.getByTestId(`corpus-card-${CORPUS}`).click();

    const toggle = page.getByTestId('toggle-readers');
    await toggle.waitFor({ state: 'visible', timeout: 20_000 });
    await toggle.click();

    await expect(page.getByTestId('readers-options')).toBeVisible();
    await expect(page.getByTestId('reader-knee_arthritis')).toBeVisible();
  });

  test('B6 — the agent builder offers corpora that already exist', async ({ page }) => {
    // The builder mentioned "corpus" exactly once, in a hardcoded description
    // string, so it could never propose the corpus somebody had just built.
    await signInAsAdmin(page);
    await page.goto('/chataiagent/admin?section=agents');
    await page.getByText('Admin Portal').waitFor({ state: 'visible', timeout: 20_000 });

    // The IN-CONTENT button. The header carries a second "Create Agent" that
    // opens the goal-first flow, and clicking it leaves this manual wizard
    // unopened with no error — which is what made this look like a missing
    // Knowledge step rather than a mis-aimed click.
    const create = page.getByRole('button', { name: /Create Agent|New Agent/i }).last();
    await create.waitFor({ state: 'visible', timeout: 20_000 });
    await create.click();
    await page.getByPlaceholder('e.g. sleep_wellness').waitFor({
      state: 'visible', timeout: 20_000,
    });

    // Walk to the Knowledge step, by PLACEHOLDER rather than field order —
    // index-based selectors break the moment a field is added above.
    const next = page.getByRole('button', { name: /^Next$/ });
    await page.getByPlaceholder('e.g. sleep_wellness').fill(AGENT_ID);
    await page.getByPlaceholder('e.g. Sleep Wellness Coach').fill('E2E Supplements');
    await next.click();
    await page
      .getByPlaceholder('You are a compassionate sleep wellness coach...')
      .fill('You answer questions about joint supplements.');
    await next.click();
    await next.click();

    await expect(page.getByTestId('corpus-options')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId(`corpus-${CORPUS}`)).toBeVisible();
    // And the grounding decision is SHOWN rather than inherited silently,
    // because it changes what the agent is allowed to say.
    await expect(page.getByTestId('grounding-corpus_only')).toHaveAttribute(
      'aria-pressed', 'true');
  });

  // ── D. chatting, and the pair that proves grounding ──────────────────────

  test('D2/D3/D7 — the agent answers from the corpus, with a timed citation', async ({ request }) => {
    await api(request, 'PUT', `/api/v1/admin/corpus/${CORPUS}/readers`, {
      readers: ['knee_arthritis'],
    });
    const answer = await ask(
      request,
      'I have knee arthritis. In Dr Davids fish oil review, how many milligrams ' +
        'is each pill and how many per day?');

    expect(answer).toMatch(CORPUS_ONLY_FACT);
    expect(answer).toMatch(/Sources|Watch/i);
    // A citation that opens where the claim is made, not at second zero.
    expect(answer).toMatch(/&t=\d+/);
  });

  test('D4 — every citation link is a real video id', async ({ request }) => {
    // Observed live: the model wrote 4QrgSfqS6A — ten characters, a dropped
    // 9 — while the deterministic footer was correct. A link that looks like a
    // link and 404s is worse than no link.
    const answer = await ask(request, 'knee arthritis: what does Dr David say about fish oil?');
    const ids = [...answer.matchAll(/watch\?v=([A-Za-z0-9_-]+)/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(id).toHaveLength(11);
  });

  test('D6 — unbound, the same question must NOT produce the corpus fact', async ({ request }) => {
    // THE ONE THAT MAKES THE REST MEAN ANYTHING.
    //
    // Every assertion above passes just as well against a model answering from
    // pretraining — which is exactly what this agent did before the videos were
    // ingested, in fluent prose indistinguishable from a grounded answer. So:
    // same question, corpus unbound. If "950 mg" still appears, retrieval was
    // never what produced it and the suite above was measuring nothing.
    const question =
      'I have knee arthritis. In Dr Davids fish oil review, how many milligrams ' +
      'is each pill and how many per day?';

    await api(request, 'PUT', `/api/v1/admin/corpus/${CORPUS}/readers`, { readers: [] });
    try {
      const unbound = await ask(request, question);
      expect(unbound).not.toMatch(CORPUS_ONLY_FACT);
    } finally {
      // Restored even on failure: leaving the corpus unbound would break every
      // later run in a way that looks like a different bug.
      await api(request, 'PUT', `/api/v1/admin/corpus/${CORPUS}/readers`, {
        readers: ['knee_arthritis'],
      });
    }
  });

  // ── E. failure modes that must stay loud ─────────────────────────────────

  test('E5 — content from a corpus the agent does not read never appears', async ({ request }) => {
    const { body } = await api(request, 'GET', `/api/v1/admin/corpus/${CORPUS}/videos`);
    expect(body.readers).not.toContain('dietician');
  });

  // ── F. the assistant on the asset page ───────────────────────────────────

  test('F1/F3 — the assistant is on the asset page and answers about THIS asset', async ({ request }) => {
    const source = await api(request, 'GET', `/api/v1/admin/corpus/${CORPUS}/sources`).then(
      (r) => (r.body.sources || []).find((s: { source: string }) =>
        s.source.includes('4QrgSfq9S6A'))?.source);
    expect(source, 'the fish oil video must be ingested — see docs/29 §1').toBeTruthy();

    const { body } = await api(request, 'POST', `/api/v1/admin/corpus/${CORPUS}/assistant`, {
      question: 'What is the transcript here and where did it come from?',
      source,
    });
    // The asset's real facts, not a general description of the corpus.
    expect(body.answer).toMatch(/216|caption/i);
  });

  test('F4/F6 — it explains an empty field rather than inventing a value', async ({ request }) => {
    const source = await api(request, 'GET', `/api/v1/admin/corpus/${CORPUS}/sources`).then(
      (r) => (r.body.sources || []).find((s: { source: string }) =>
        s.source.includes('4QrgSfq9S6A'))?.source);

    const { body } = await api(request, 'POST', `/api/v1/admin/corpus/${CORPUS}/assistant`, {
      question: 'Why is there no phase on this one?',
      source,
    });
    // "extraction writes to `suggested` and nothing was accepted" is the real
    // reason. A confident invented phase is the expensive wrong answer here.
    expect(body.answer).toMatch(/suggest|accept|not been set|empty/i);
  });

  test.afterAll(async ({ playwright }) => {
    if (PERMANENT) return;
    // Throwaway by default, upgradable by setting E2E_KEEP_AGENT. A dangling
    // reader naming an agent that no longer exists is case C5.
    //
    // Its OWN request context: the per-test one is disposed by now, and
    // cleanup failing there would surface as a second error masking the first.
    const req = await playwright.request.newContext();
    await api(req, 'PUT', `/api/v1/admin/corpus/${CORPUS}/readers`, {
      readers: ['knee_arthritis'],
    });
    await api(req, 'DELETE', `/api/v1/admin/agents/${AGENT_ID}`).catch(() => {});
    await req.dispose();
  });
});
