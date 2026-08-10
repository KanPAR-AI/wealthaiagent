import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { MemoryList } from "@/components/memory/memory-list";
import type { MemoryBrowserRow } from "@/hooks/memory/use-memory-browser";
import type { MemoryRecord } from "@/services/memory-engine-service";

function record(id: string): MemoryRecord {
  return {
    id,
    tenant_id: "platform",
    owner_type: "user",
    owner_id: "u1",
    namespace: "travel",
    type: "preference",
    subject: { kind: "literal", entity_id: null, text: "user" },
    predicate: "seatPreference",
    value: `value for ${id}`,
    text: `Memory ${id}`,
    normalized_text: `memory ${id}`,
    status: "active",
    authority: 0.9,
    confidence: 0.95,
    importance: 0.5,
    source_type: "user_explicit",
    valid_from: null,
    valid_until: null,
    observed_at: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    last_accessed_at: null,
    access_count: 0,
    version: 1,
    supersedes: [],
    superseded_by: null,
    entity_ids: [],
    tags: [],
    evidence_ids: [],
    qualifiers: {},
    pinned: false,
    exact_tokens: [],
    idempotency_keys: [],
    projections_pending: [],
    dedup_key: `travel:${id}`,
    policy: {},
    metadata: {},
  };
}

function rows(n: number): MemoryBrowserRow[] {
  return Array.from({ length: n }, (_, i) => ({
    memory: record(`mem_${i}`),
    score: 1 - i / n,
    retrievalReason: "matched via semantic",
    channels: ["semantic"],
    pinned: false,
  }));
}

function renderList(list: MemoryBrowserRow[]) {
  return render(
    <MemoryRouter>
      <MemoryList rows={list} />
    </MemoryRouter>,
  );
}

describe("MemoryList (UI-33 — thousands of memories, virtualized/paginated)", () => {
  test("a small result set renders every card, no 'Show more' control", () => {
    renderList(rows(5));
    expect(screen.getAllByTestId("memory-card")).toHaveLength(5);
    expect(screen.queryByRole("button", { name: /show.*more/i })).not.toBeInTheDocument();
  });

  test("1500 memories: only a bounded window is mounted, never all 1500 at once", () => {
    renderList(rows(1500));
    const mounted = screen.getAllByTestId("memory-card").length;
    expect(mounted).toBeLessThan(100); // well below 1500 — proves windowing
    expect(mounted).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /show.*more/i })).toBeInTheDocument();
  });

  test("'Show more' reveals additional rows in the SAME server order — never re-sorted", async () => {
    renderList(rows(120));
    const before = screen.getAllByTestId("memory-card").map((el) => el.getAttribute("data-memory-id"));
    await userEvent.click(screen.getByRole("button", { name: /show.*more/i }));
    const after = screen.getAllByTestId("memory-card").map((el) => el.getAttribute("data-memory-id"));

    expect(after.length).toBeGreaterThan(before.length);
    // Every previously-visible id is still there, in the same relative order.
    expect(after.slice(0, before.length)).toEqual(before);
  });

  test("clicking 'Show more' until exhausted removes the control", async () => {
    renderList(rows(45));
    let button = screen.queryByRole("button", { name: /show.*more/i });
    while (button) {
       
      await userEvent.click(button);
      button = screen.queryByRole("button", { name: /show.*more/i });
    }
    expect(screen.getAllByTestId("memory-card")).toHaveLength(45);
  });

  test("a new result set (query changed) resets the visible window back to the first page", () => {
    const { rerender } = renderList(rows(200));
    expect(screen.getAllByTestId("memory-card").length).toBeLessThan(200);

    rerender(
      <MemoryRouter>
        <MemoryList rows={rows(3)} />
      </MemoryRouter>,
    );
    expect(screen.getAllByTestId("memory-card")).toHaveLength(3);
  });
});
