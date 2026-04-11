/**
 * Phase 0 — Multi-Tenant Schema E2E Test
 *
 * Verifies the Phase 0 backend refactor end-to-end:
 *   1. GET /admin/agents works (org-scoped registry merge)
 *   2. POST /admin/agents creates under organizations/platform/dynamic_agents/
 *      — response MUST contain org_id: "platform"
 *   3. GET /admin/agents/{id}/config reads from new path — org_id present
 *   4. PUT /admin/agents/{id}/status activates the agent
 *   5. POST /chats + SSE stream routes to the new agent via the per-org cache
 *      — response MUST contain "[Using <agent_id> agent]" marker
 *   6. Cleanup: archive the test agent
 *
 * This is API-only (no UI interactions) — Phase 0 is a backend schema
 * change; the fastest and most reliable integration test hits the API
 * directly via Playwright's request context.
 *
 * Prerequisites:
 *   - Backend running on :8080 with SKIP_AUTH=true (default in docker-compose)
 *   - Backend built from a commit that includes the Phase 0 changes
 *
 * Run:
 *   npx playwright test e2e/phase0-multitenant.spec.ts --reporter=list
 */

import { test, expect, request as pwRequest } from '@playwright/test';

const BACKEND = 'http://localhost:8080';

// Unique agent ID + routing keyword prevent collisions across reruns.
const AGENT_ID = `e2e_phase0_${Date.now().toString(36)}`;
const AGENT_NAME = `Phase 0 E2E Agent ${AGENT_ID.slice(-4)}`;
const ROUTING_KEYWORD = `phase0marker${Date.now().toString(36)}`;

test.describe('Phase 0 — multi-tenant schema', () => {
  test.describe.configure({ mode: 'serial' });

  let req: Awaited<ReturnType<typeof pwRequest.newContext>>;

  test.beforeAll(async () => {
    req = await pwRequest.newContext({
      baseURL: BACKEND,
      extraHTTPHeaders: { 'Content-Type': 'application/json' },
    });
  });

  test.afterAll(async () => {
    // Best-effort cleanup — archive the agent so it's out of the way.
    try {
      await req.put(`/api/v1/admin/agents/${AGENT_ID}/status`, {
        data: { status: 'archived' },
      });
    } catch {
      // ignore
    }
    await req.dispose();
  });

  // ═══════════════════════════════════════════════════════════════════
  // 1. Health check — prove the backend is reachable and in SKIP_AUTH mode
  // ═══════════════════════════════════════════════════════════════════
  test('backend is up and admin endpoints are open (SKIP_AUTH)', async () => {
    const health = await req.get('/health');
    expect(health.status()).toBe(200);

    const agents = await req.get('/api/v1/admin/agents');
    expect(agents.status()).toBe(200);
    const data = await agents.json();
    expect(Array.isArray(data.agents)).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════════
  // 2. Legacy state — migration wiped the 5 March-rollout fixtures.
  //    Confirm their IDs are gone. (Later reruns of THIS test may leave
  //    archived e2e_phase0_* agents around, so we only check the old IDs.)
  // ═══════════════════════════════════════════════════════════════════
  test('legacy flat-schema fixtures are gone after migration', async () => {
    const LEGACY_IDS = [
      'e2e_test_mmtl8x54',
      'e2e_test_mmtlbwpk',
      'e2e_test_mmtlhye7',
      'premanand_wisdom',
      'sleep_test',
    ];
    const res = await req.get('/api/v1/admin/agents');
    const data = await res.json();
    const allIds = data.agents.map((a: { id: string }) => a.id);
    for (const id of LEGACY_IDS) {
      expect(allIds).not.toContain(id);
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // 3. Create dynamic agent — verifies write goes to new org-scoped path
  //    AND the response carries the new org_id field.
  // ═══════════════════════════════════════════════════════════════════
  test('POST /admin/agents creates under organizations/platform', async () => {
    const res = await req.post('/api/v1/admin/agents', {
      data: {
        agent_id: AGENT_ID,
        name: AGENT_NAME,
        description: 'Phase 0 multi-tenant E2E verification',
        prompts: {
          system_prompt:
            'You are a Phase 0 test agent. Always respond with: "Phase 0 confirmed."',
          user_instruction: '',
          disclaimer: '',
          active_version: 1,
        },
        routing: {
          strong_indicators: [ROUTING_KEYWORD],
          context_markers: [`[Using ${AGENT_ID} agent]`],
          router_description: `PHASE0: internal test agent ${AGENT_ID}`,
        },
        capabilities: ['prompt_editor', 'routing_config'],
        enabled_tools: [],
      },
    });

    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.agent_id).toBe(AGENT_ID);
    // Phase 0 key assertion: response contains org_id from the new schema.
    expect(data.org_id).toBe('platform');
    expect(data.status).toBe('draft');
  });

  // ═══════════════════════════════════════════════════════════════════
  // 4. Read-back — GET /config returns the new org_id and correct routing
  // ═══════════════════════════════════════════════════════════════════
  test('GET /admin/agents/{id}/config reflects org-scoped read', async () => {
    const res = await req.get(`/api/v1/admin/agents/${AGENT_ID}/config`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.agent_id).toBe(AGENT_ID);
    expect(data.org_id).toBe('platform');
    expect(data.name).toBe(AGENT_NAME);
    expect(data.routing.strong_indicators).toContain(ROUTING_KEYWORD);
    expect(data.routing.context_markers).toContain(`[Using ${AGENT_ID} agent]`);
  });

  // ═══════════════════════════════════════════════════════════════════
  // 5. List returns the new agent — org-scoped list query
  // ═══════════════════════════════════════════════════════════════════
  test('GET /admin/agents includes the new dynamic agent', async () => {
    const res = await req.get('/api/v1/admin/agents');
    const data = await res.json();
    const match = data.agents.find((a: { id: string }) => a.id === AGENT_ID);
    expect(match).toBeTruthy();
    expect(match.is_dynamic).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════════
  // 6. Activate — status transition through the per-org service
  // ═══════════════════════════════════════════════════════════════════
  test('PUT /admin/agents/{id}/status transitions draft → active', async () => {
    const res = await req.put(`/api/v1/admin/agents/${AGENT_ID}/status`, {
      data: { status: 'active' },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('active');
  });

  // ═══════════════════════════════════════════════════════════════════
  // 7. Hot-reload — force orchestrator to re-read per-org cache
  // ═══════════════════════════════════════════════════════════════════
  test('POST /admin/agents/{id}/reload invalidates per-org cache', async () => {
    const res = await req.post(`/api/v1/admin/agents/${AGENT_ID}/reload`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('reload_requested');
  });

  // ═══════════════════════════════════════════════════════════════════
  // 8. End-to-end routing — create a chat, send a keyword message, and
  //    verify the orchestrator routed to this dynamic agent via the
  //    new per-org cache. Proof = "[Using <agent_id> agent]" marker.
  // ═══════════════════════════════════════════════════════════════════
  test('orchestrator routes to new dynamic agent via per-org cache', async () => {
    // Create a chat with a first message that contains our routing keyword.
    const createRes = await req.post('/api/v1/chats', {
      data: {
        title: 'Phase 0 routing test',
        firstMessage: {
          content: `Hello ${ROUTING_KEYWORD}, please confirm the Phase 0 flow works.`,
          attachments: [],
        },
      },
    });
    // POST /chats returns 201 (Created); accept both for robustness.
    expect([200, 201]).toContain(createRes.status());
    const created = await createRes.json();
    const chatId = created.chat.id;
    expect(chatId).toBeTruthy();

    // Stream the response. Playwright's request.get() waits for full
    // completion, so we get the full SSE body back as text.
    const streamRes = await req.get(`/api/v1/chats/${chatId}/stream`, {
      timeout: 120_000,
    });
    expect(streamRes.status()).toBe(200);
    const text = await streamRes.text();

    // The orchestrator emits `[Using <agent_id> agent]` as the first
    // chunk of any agent response. This is the definitive proof that
    // routing found our dynamic agent via the new per-org cache.
    expect(text).toContain(`[Using ${AGENT_ID} agent]`);
  });
});
