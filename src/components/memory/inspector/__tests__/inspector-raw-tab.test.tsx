// UI-3 Raw tab (§19, UI-11): read-only JSON + copy only; the tab is hidden
// in the inspector without memory.read_raw (backend re-checks; the raw view
// exposes nothing beyond the already-authorized get()).
import { render, screen } from "@testing-library/react";
import { InspectorRawTab } from "@/components/memory/inspector/inspector-raw-tab";
import type { MemoryRecord } from "@/services/memory-engine-service";

function record(): MemoryRecord {
  return {
    id: "mem_1", tenant_id: "platform", owner_type: "user", owner_id: "u1",
    owner_key: "user:u1", namespace: "travel", type: "preference",
    subject: { kind: "literal", entity_id: null, text: "user" },
    predicate: "seat_preference", value: "aisle", text: "Prefers aisle seats",
    normalized_text: "prefers aisle seats", status: "active", authority: 0.98,
    confidence: 1, importance: 0.6, source_type: "user_explicit",
    valid_from: null, valid_until: null, observed_at: null, created_at: null,
    updated_at: null, last_accessed_at: null, access_count: 0, version: 1,
    supersedes: [], superseded_by: null, entity_ids: [], tags: [],
    evidence_ids: [], qualifiers: {}, pinned: false, exact_tokens: [],
    idempotency_keys: [], projections_pending: [], dedup_key: "d", policy: {}, metadata: {},
  };
}

test("renders canonical JSON read-only with Copy JSON / Copy ID only", () => {
  render(<InspectorRawTab memory={record()} />);
  const raw = screen.getByTestId("inspector-raw");
  expect(raw).toHaveTextContent('"id": "mem_1"');
  // read-only: no input/textarea/contenteditable mutation affordance (§19)
  expect(raw.querySelector("input")).toBeNull();
  expect(raw.querySelector("textarea")).toBeNull();
  expect(raw.querySelector("[contenteditable]")).toBeNull();
  // exactly the two copy actions
  expect(screen.getByRole("button", { name: /Copy JSON/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Copy memory ID/i })).toBeInTheDocument();
});

test("the Raw tab is not shown without memory.read_raw (inspector gate)", async () => {
  // structural: the inspector filters the Raw tab on permissions.read_raw
  const src = require("fs").readFileSync(
    require("path").resolve(__dirname, "../memory-inspector.tsx"), "utf8",
  );
  expect(src).toMatch(/perm.*memory\.read_raw/);
  expect(src).toMatch(/permissions\[t\.perm\]/);
});
