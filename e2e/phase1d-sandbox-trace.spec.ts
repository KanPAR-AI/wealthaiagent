/**
 * Phase 1D — Sandbox Trace SSE E2E
 *
 * Verifies the backend trace multiplexing works end-to-end:
 *   1. Create a dynamic agent with a pinned routing keyword
 *   2. Activate it
 *   3. Create a chat via POST /chats with a firstMessage
 *   4. Stream /chats/{id}/stream?trace=true&force_agent={id}
 *   5. Assert the SSE response contains:
 *      - event: message_delta blocks (text)
 *      - event: trace block (the Phase 1D addition)
 *      - event: message_complete block
 *   6. Parse the trace payload and assert required fields
 *   7. Assert trace=false (default) does NOT emit a trace event
 *
 * Prerequisites:
 *   - Backend on :8080 with SKIP_AUTH=true
 *   - Backend built from a commit that includes Phase 1D changes
 */

import { test, expect, request as pwRequest } from '@playwright/test';

const BACKEND = 'http://localhost:8080';
const AGENT_ID = `e2e_trace_${Date.now().toString(36)}`;
const ROUTING_KEYWORD = `p1dtrace${Date.now().toString(36)}`;

test.describe('Phase 1D — sandbox trace SSE', () => {
  test.describe.configure({ mode: 'serial' });

  let req: Awaited<ReturnType<typeof pwRequest.newContext>>;

  test.beforeAll(async () => {
    req = await pwRequest.newContext({
      baseURL: BACKEND,
      extraHTTPHeaders: { 'Content-Type': 'application/json' },
    });
  });

  test.afterAll(async () => {
    // Best-effort cleanup
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
  // 1. Set up: create + activate a dynamic agent
  // ═══════════════════════════════════════════════════════════════════
  test('create and activate a dynamic agent for trace tests', async () => {
    const createRes = await req.post('/api/v1/admin/agents', {
      data: {
        agent_id: AGENT_ID,
        name: `Phase 1D Trace Test ${AGENT_ID.slice(-4)}`,
        description: 'Agent used to verify the sandbox trace SSE event',
        prompts: {
          system_prompt:
            'You are a Phase 1D trace test agent. When the user greets you, respond with exactly: "Hello from the trace test agent."',
          user_instruction: '',
          disclaimer: '',
          active_version: 1,
        },
        routing: {
          strong_indicators: [ROUTING_KEYWORD],
          context_markers: [`[Using ${AGENT_ID} agent]`],
          router_description: `PHASE_1D: trace verification ${AGENT_ID}`,
        },
        capabilities: ['prompt_editor', 'routing_config'],
        enabled_tools: [],
      },
    });
    expect(createRes.status()).toBe(201);

    const activateRes = await req.put(
      `/api/v1/admin/agents/${AGENT_ID}/status`,
      { data: { status: 'active' } }
    );
    expect(activateRes.status()).toBe(200);

    // Force orchestrator cache reload so the new agent is visible
    await req.post(`/api/v1/admin/agents/${AGENT_ID}/reload`);
  });

  // ═══════════════════════════════════════════════════════════════════
  // 2. trace=true emits a dedicated `trace` SSE event
  // ═══════════════════════════════════════════════════════════════════
  test('?trace=true emits a trace SSE event with required fields', async () => {
    // Create the test chat
    const createChatRes = await req.post('/api/v1/chats', {
      data: {
        title: 'Phase 1D trace test',
        firstMessage: {
          content: `Hello ${ROUTING_KEYWORD}, please greet me back.`,
          attachments: [],
        },
      },
    });
    expect([200, 201]).toContain(createChatRes.status());
    const chat = await createChatRes.json();
    const chatId = chat.chat.id;

    // Stream with trace=true
    const streamRes = await req.get(
      `/api/v1/chats/${chatId}/stream?trace=true&force_agent=${AGENT_ID}`,
      { timeout: 120_000 }
    );
    expect(streamRes.status()).toBe(200);
    const body = await streamRes.text();

    // SSE protocol events
    expect(body).toContain('event: message_delta');
    expect(body).toContain('event: trace');
    expect(body).toContain('event: message_complete');

    // Parse the trace event payload
    // Format is `event: trace\ndata: {"type": "trace", "trace": {...}}\n\n`
    const traceBlockMatch = body.match(/event: trace\r?\ndata: (.+)/);
    expect(traceBlockMatch).toBeTruthy();
    const traceEvent = JSON.parse(traceBlockMatch![1]);

    expect(traceEvent.type).toBe('trace');
    expect(traceEvent.trace).toBeDefined();
    const trace = traceEvent.trace;

    // Required top-level trace fields
    expect(trace.agent_id).toBe(AGENT_ID);
    expect(trace.agent_type).toBe('dynamic');
    expect(trace.org_id).toBe('platform');
    expect(typeof trace.mode).toBe('string');
    expect(Array.isArray(trace.retrieved_chunks)).toBe(true);
    expect(Array.isArray(trace.memory_facts)).toBe(true);
    expect(typeof trace.system_prompt).toBe('string');
    expect(trace.system_prompt).toContain('trace test agent');
    expect(trace.user_message).toContain(ROUTING_KEYWORD);
    expect(Array.isArray(trace.tool_calls)).toBe(true);
    expect(typeof trace.response_length).toBe('number');
  });

  // ═══════════════════════════════════════════════════════════════════
  // 3. trace=false (default) does NOT emit a trace event
  // ═══════════════════════════════════════════════════════════════════
  test('default stream without trace=true emits NO trace event', async () => {
    const createChatRes = await req.post('/api/v1/chats', {
      data: {
        title: 'Phase 1D no-trace test',
        firstMessage: {
          content: `Hello ${ROUTING_KEYWORD}, please respond.`,
          attachments: [],
        },
      },
    });
    expect([200, 201]).toContain(createChatRes.status());
    const chat = await createChatRes.json();
    const chatId = chat.chat.id;

    // Stream WITHOUT trace=true
    const streamRes = await req.get(
      `/api/v1/chats/${chatId}/stream?force_agent=${AGENT_ID}`,
      { timeout: 120_000 }
    );
    expect(streamRes.status()).toBe(200);
    const body = await streamRes.text();

    // Standard events still present
    expect(body).toContain('event: message_delta');
    expect(body).toContain('event: message_complete');

    // trace event must NOT be emitted
    expect(body).not.toContain('event: trace');

    // The __TRACE__ sentinel must NOT leak into message_delta text
    expect(body).not.toContain('__TRACE__');
  });

  // ═══════════════════════════════════════════════════════════════════
  // 4. Trace sentinel never leaks into the saved message content
  // ═══════════════════════════════════════════════════════════════════
  test('trace sentinel never contaminates saved assistant message', async () => {
    const createChatRes = await req.post('/api/v1/chats', {
      data: {
        title: 'Phase 1D saved-text test',
        firstMessage: {
          content: `Hello ${ROUTING_KEYWORD}, please respond.`,
          attachments: [],
        },
      },
    });
    const chat = await createChatRes.json();
    const chatId = chat.chat.id;

    // Stream with trace=true (worst case: sentinel must still be filtered)
    await req.get(
      `/api/v1/chats/${chatId}/stream?trace=true&force_agent=${AGENT_ID}`,
      { timeout: 120_000 }
    );

    // Fetch the saved messages
    const msgsRes = await req.get(`/api/v1/chats/${chatId}/messages`);
    expect(msgsRes.status()).toBe(200);
    const msgs = await msgsRes.json();
    const assistantMsgs = msgs.filter(
      (m: { sender: string }) => m.sender === 'assistant'
    );
    expect(assistantMsgs.length).toBeGreaterThan(0);
    for (const m of assistantMsgs) {
      expect(m.content).not.toContain('__TRACE__');
      expect(m.content).not.toContain('"retrieved_chunks"');
    }
  });
});
