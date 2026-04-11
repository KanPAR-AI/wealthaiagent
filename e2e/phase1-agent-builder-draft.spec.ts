/**
 * Phase 1A — Goal-First Agent Draft E2E Test
 *
 * Verifies the new POST /admin/agent-builder/draft endpoint:
 *   1. Accepts a one-sentence goal and returns a complete draft
 *   2. Draft contains all required top-level fields
 *   3. example_queries is a non-empty list (for eval set seeding)
 *   4. The drafted config is well-formed enough to feed straight into
 *      POST /admin/agents (no manual fixups required)
 *
 * This is a backend API test using Playwright's request context.
 * No browser, no UI, no sign-in (relies on SKIP_AUTH=true backend).
 *
 * NOTE: This test makes a real Claude Opus 4.6 call. Expect ~30-60s
 * per draft generation. Skipped by default in CI; run locally.
 *
 * Prerequisites:
 *   - Backend running on :8080 with SKIP_AUTH=true
 *   - ANTHROPIC_API_KEY configured in chatservice/.env
 *
 * Run:
 *   npx playwright test e2e/phase1-agent-builder-draft.spec.ts --reporter=list
 */

import { test, expect, request as pwRequest } from '@playwright/test';

const BACKEND = 'http://localhost:8080';

// The goal we'll feed Opus. Keep it realistic but generic enough that
// any reasonable draft passes the shape assertions below.
const TEST_GOAL =
  'Help users understand and improve their sleep quality using CBT-I techniques, sleep hygiene coaching, and habit tracking.';

test.describe('Phase 1A — /agent-builder/draft', () => {
  test.describe.configure({ mode: 'serial' });

  let req: Awaited<ReturnType<typeof pwRequest.newContext>>;
  let draftResponse: any = null;

  test.beforeAll(async () => {
    req = await pwRequest.newContext({
      baseURL: BACKEND,
      extraHTTPHeaders: { 'Content-Type': 'application/json' },
    });
  });

  test.afterAll(async () => {
    await req.dispose();
  });

  // ═══════════════════════════════════════════════════════════════════
  // 1. Draft endpoint returns 200 with a valid structured response.
  //    Gracefully skips the rest of the suite if ANTHROPIC_API_KEY is
  //    not configured on the backend — Opus is a hard dependency.
  // ═══════════════════════════════════════════════════════════════════
  test('POST /admin/agent-builder/draft produces a complete draft', async () => {
    const res = await req.post('/api/v1/admin/agent-builder/draft', {
      data: { goal: TEST_GOAL },
      timeout: 180_000, // Opus can take up to 2 min
    });

    // Detect missing Anthropic API key — the endpoint returns 500 with
    // a specific error message. Skip the suite rather than failing.
    if (res.status() !== 200) {
      const body = await res.text();
      if (body.toLowerCase().includes('anthropic')) {
        test.skip(
          true,
          'ANTHROPIC_API_KEY not configured on backend — skipping Phase 1A live test'
        );
      }
    }

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('drafted');
    expect(body.draft).toBeDefined();
    draftResponse = body.draft;
  });

  // ═══════════════════════════════════════════════════════════════════
  // 2. Draft has all required top-level fields
  // ═══════════════════════════════════════════════════════════════════
  test('Draft contains all required top-level fields', async () => {
    test.skip(!draftResponse, 'No draft — upstream LLM unavailable');
    expect(draftResponse).toBeTruthy();
    const required = [
      'agent_id',
      'name',
      'description',
      'routing',
      'prompts',
      'memory_config',
      'ontology',
      'example_queries',
    ];
    for (const field of required) {
      expect(draftResponse).toHaveProperty(field);
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // 3. agent_id matches the required pattern
  // ═══════════════════════════════════════════════════════════════════
  test('Draft agent_id is lowercase_underscored and valid', async () => {
    test.skip(!draftResponse, 'No draft — upstream LLM unavailable');
    expect(draftResponse.agent_id).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  // ═══════════════════════════════════════════════════════════════════
  // 4. routing has keywords, context markers, and router description
  // ═══════════════════════════════════════════════════════════════════
  test('Draft routing block is well-formed', async () => {
    test.skip(!draftResponse, 'No draft — upstream LLM unavailable');
    const routing = draftResponse.routing;
    expect(Array.isArray(routing.strong_indicators)).toBe(true);
    expect(routing.strong_indicators.length).toBeGreaterThanOrEqual(5);
    expect(Array.isArray(routing.context_markers)).toBe(true);
    expect(routing.context_markers.length).toBeGreaterThan(0);
    expect(typeof routing.router_description).toBe('string');
    expect(routing.router_description.length).toBeGreaterThan(10);
  });

  // ═══════════════════════════════════════════════════════════════════
  // 5. prompts block has system_prompt of reasonable length
  // ═══════════════════════════════════════════════════════════════════
  test('Draft system_prompt is substantive', async () => {
    test.skip(!draftResponse, 'No draft — upstream LLM unavailable');
    const systemPrompt = draftResponse.prompts.system_prompt;
    expect(typeof systemPrompt).toBe('string');
    // Should be at least 200 chars (our meta-prompt asks for 200-500 words)
    expect(systemPrompt.length).toBeGreaterThan(500);
    expect(draftResponse.prompts).toHaveProperty('user_instruction');
    expect(draftResponse.prompts).toHaveProperty('disclaimer');
  });

  // ═══════════════════════════════════════════════════════════════════
  // 6. memory_config has categories and decay rates
  // ═══════════════════════════════════════════════════════════════════
  test('Draft memory_config has domain categories', async () => {
    test.skip(!draftResponse, 'No draft — upstream LLM unavailable');
    const mc = draftResponse.memory_config;
    expect(Array.isArray(mc.categories)).toBe(true);
    expect(mc.categories.length).toBeGreaterThanOrEqual(3);
    expect(typeof mc.decay_rates).toBe('object');
    expect(typeof mc.extraction_prompt).toBe('string');
    // Categories should be UPPERCASE_UNDERSCORE
    for (const cat of mc.categories) {
      expect(cat).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // 7. ontology has at least a few entities
  // ═══════════════════════════════════════════════════════════════════
  test('Draft ontology has at least 5 entities', async () => {
    test.skip(!draftResponse, 'No draft — upstream LLM unavailable');
    const ontology = draftResponse.ontology;
    expect(typeof ontology).toBe('object');
    const entries = Object.entries(ontology);
    expect(entries.length).toBeGreaterThanOrEqual(5);
    // Spot-check shape of the first entity
    const [canonical, entity]: [string, any] = entries[0];
    expect(canonical).toMatch(/^[a-z][a-z0-9_]*$/);
    expect(entity).toHaveProperty('display_name');
    expect(entity).toHaveProperty('category');
    expect(Array.isArray(entity.aliases)).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════════
  // 8. example_queries seeds the initial eval set (must be non-empty)
  // ═══════════════════════════════════════════════════════════════════
  test('Draft example_queries seeds initial eval set', async () => {
    test.skip(!draftResponse, 'No draft — upstream LLM unavailable');
    const queries = draftResponse.example_queries;
    expect(Array.isArray(queries)).toBe(true);
    // We ask Opus for exactly 10; accept anything >= 3 for resilience
    expect(queries.length).toBeGreaterThanOrEqual(3);
    for (const q of queries) {
      expect(typeof q).toBe('string');
      expect(q.length).toBeGreaterThan(5);
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // 9. Draft feeds cleanly into POST /admin/agents (round-trip test)
  // ═══════════════════════════════════════════════════════════════════
  test('Draft can be POSTed to /admin/agents without manual fixup', async () => {
    test.skip(!draftResponse, 'No draft — upstream LLM unavailable');
    // Give it a unique agent_id so we don't collide with prior runs
    const uniqueId = `e2e_draft_${Date.now().toString(36)}`;
    const createRes = await req.post('/api/v1/admin/agents', {
      data: {
        agent_id: uniqueId,
        name: draftResponse.name,
        description: draftResponse.description,
        prompts: draftResponse.prompts,
        routing: draftResponse.routing,
        memory_config: draftResponse.memory_config,
        ontology: draftResponse.ontology,
      },
    });

    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created.agent_id).toBe(uniqueId);
    expect(created.org_id).toBe('platform');

    // Cleanup — archive the created agent
    await req.put(`/api/v1/admin/agents/${uniqueId}/status`, {
      data: { status: 'archived' },
    });
  });
});
