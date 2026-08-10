import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MemoryCard } from "@/components/memory/memory-card";
import type { MemoryBrowserRow } from "@/hooks/memory/use-memory-browser";
import type { MemoryRecord } from "@/services/memory-engine-service";

function record(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: "mem_1",
    tenant_id: "platform",
    owner_type: "user",
    owner_id: "u1",
    namespace: "travel",
    type: "preference",
    subject: { kind: "literal", entity_id: null, text: "user" },
    predicate: "seatPreference",
    value: "aisle",
    text: "Prefers an aisle seat",
    normalized_text: "prefers an aisle seat",
    status: "active",
    authority: 0.9,
    confidence: 0.95,
    importance: 0.5,
    source_type: "user_explicit",
    valid_from: "2026-01-01T00:00:00Z",
    valid_until: null,
    observed_at: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    last_accessed_at: "2026-08-05T00:00:00Z",
    access_count: 3,
    version: 1,
    supersedes: [],
    superseded_by: null,
    entity_ids: [],
    tags: [],
    evidence_ids: [],
    qualifiers: { trip: "deployment" },
    pinned: false,
    exact_tokens: [],
    idempotency_keys: [],
    projections_pending: [],
    dedup_key: "travel:seatPreference",
    policy: {},
    metadata: {},
    ...overrides,
  };
}

function row(overrides: Partial<MemoryBrowserRow> = {}): MemoryBrowserRow {
  return {
    memory: record(),
    score: 0.87,
    retrievalReason: "matched via semantic",
    channels: ["semantic"],
    pinned: false,
    ...overrides,
  };
}

function renderCard(r: MemoryBrowserRow) {
  return render(
    <MemoryRouter>
      <ul>
        <MemoryCard row={r} />
      </ul>
    </MemoryRouter>,
  );
}

describe("MemoryCard (§8, MUI-0011)", () => {
  test("renders label, value, status, source, confidence, type, namespace, validity, usage, qualifiers", () => {
    renderCard(row());

    expect(screen.getByText("Prefers an aisle seat")).toBeInTheDocument();
    expect(screen.getByText("aisle")).toBeInTheDocument();
    expect(screen.getByTestId("status-badge")).toHaveAttribute("data-status", "active");
    expect(screen.getByTestId("source-badge")).toHaveAttribute("data-source", "user_explicit");
    expect(screen.getByTestId("confidence-indicator")).toHaveAttribute("data-bucket", "high");
    expect(screen.getByText("Preference")).toBeInTheDocument();
    expect(screen.getByText("travel")).toBeInTheDocument();
    expect(screen.getByTestId("validity-range")).toBeInTheDocument();
    expect(screen.getByTestId("usage-count")).toHaveTextContent("3 accesses");
    expect(screen.getByTestId("qualifiers")).toHaveTextContent("trip: deployment");
  });

  test("renders a match reason from channels/retrieval_reason (relevance mode)", () => {
    renderCard(row({ channels: ["exact"], retrievalReason: "exact token match" }));
    expect(screen.getByTestId("match-reason")).toHaveTextContent("Exact value");
  });

  test("omits the match reason entirely in browse/unranked mode (never fabricates one)", () => {
    renderCard(row({ score: null, retrievalReason: null, channels: [] }));
    expect(screen.queryByTestId("match-reason")).not.toBeInTheDocument();
  });

  test("shows a Pinned indicator when the row is pinned", () => {
    renderCard(row({ pinned: true }));
    expect(screen.getByLabelText("Pinned")).toBeInTheDocument();
  });

  test("[Inspect ->] deep-links to /memory/memories/:id", () => {
    renderCard(row({ memory: record({ id: "mem_deep_link" }) }));
    expect(screen.getByRole("link", { name: /inspect/i })).toHaveAttribute(
      "href", "/memory/memories/mem_deep_link",
    );
  });

  test("status is never color-only — icon + text always present regardless of status", () => {
    renderCard(row({ memory: record({ status: "disputed" }) }));
    const badge = screen.getByTestId("status-badge");
    expect(badge).toHaveTextContent("Disputed");
    expect(badge.querySelector("svg")).toBeInTheDocument();
  });
});
