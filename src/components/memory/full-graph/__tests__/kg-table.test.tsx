import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KgTable } from "@/components/memory/full-graph/kg-table";
import { buildProblemSets } from "@/lib/knowledge-graph-assembly";
import type { MemoryRecord } from "@/services/memory-engine-service";

function record(overrides: Partial<MemoryRecord> & { id: string }): MemoryRecord {
  return {
    tenant_id: "platform", owner_type: "user", owner_id: "u1", owner_key: "user:u1",
    namespace: "travel", type: "preference",
    subject: { kind: "literal", entity_id: null, text: "user" },
    predicate: "seat_preference", value: "aisle", text: "Prefers aisle seats",
    normalized_text: "prefers aisle seats", status: "active", authority: 0.9, confidence: 0.95,
    importance: 0.5, source_type: "user_explicit", valid_from: null, valid_until: null,
    observed_at: null, created_at: "2026-01-01T00:00:00Z", updated_at: null, last_accessed_at: null,
    access_count: 0, version: 1, supersedes: [], superseded_by: null, entity_ids: [], tags: [],
    evidence_ids: [], qualifiers: {}, pinned: false, exact_tokens: [], idempotency_keys: [],
    projections_pending: [], dedup_key: `dk-${overrides.id}`, policy: {}, metadata: {},
    ...overrides,
  };
}

const NO_PROBLEMS = buildProblemSets([], [], []);

describe("KgTable", () => {
  it("shows the honest empty state when no records match", () => {
    render(<KgTable records={[]} problems={NO_PROBLEMS} onSelectRecord={jest.fn()} />);
    expect(screen.getByTestId("kg-table-empty")).toHaveTextContent("No records match the current filters.");
  });

  it("renders one row per record with namespace/predicate/status/value verbatim", () => {
    const rows = [
      record({ id: "mem_1", namespace: "travel", predicate: "seat_preference", value: "aisle" }),
      record({ id: "mem_2", namespace: "diet", predicate: "allergy", status: "disputed", value: "peanuts" }),
    ];
    render(<KgTable records={rows} problems={NO_PROBLEMS} onSelectRecord={jest.fn()} />);
    const trs = screen.getAllByTestId("kg-table-row");
    expect(trs).toHaveLength(2);
    expect(within(trs[0]).getByText("travel")).toBeInTheDocument();
    expect(within(trs[0]).getByText("aisle")).toBeInTheDocument();
    expect(within(trs[1]).getByText("diet")).toBeInTheDocument();
    expect(within(trs[1]).getByText("Disputed")).toBeInTheDocument();
  });

  it("clicking a predicate cell calls onSelectRecord with that exact record", async () => {
    const onSelect = jest.fn();
    const target = record({ id: "mem_2", predicate: "allergy" });
    render(<KgTable records={[record({ id: "mem_1" }), target]} problems={NO_PROBLEMS} onSelectRecord={onSelect} />);
    await userEvent.click(screen.getByText("allergy"));
    expect(onSelect).toHaveBeenCalledWith(target);
  });

  it("sorting by namespace toggles ascending/descending on repeated clicks", async () => {
    const rows = [
      record({ id: "mem_1", namespace: "zzz_last" }),
      record({ id: "mem_2", namespace: "aaa_first" }),
    ];
    render(<KgTable records={rows} problems={NO_PROBLEMS} onSelectRecord={jest.fn()} />);
    const header = screen.getByRole("button", { name: /namespace/i });

    await userEvent.click(header); // ascending
    let cells = screen.getAllByTestId("kg-table-row").map((tr) => tr.querySelector("td")!.textContent);
    expect(cells).toEqual(["aaa_first", "zzz_last"]);

    await userEvent.click(header); // descending
    cells = screen.getAllByTestId("kg-table-row").map((tr) => tr.querySelector("td")!.textContent);
    expect(cells).toEqual(["zzz_last", "aaa_first"]);
  });

  it("flags a duplicate/orphan/suspicious record in its Flags column", () => {
    const problems = buildProblemSets(
      [{ namespace: "diet", predicate: "allergy", subjectKey: "literal:user", recordIds: ["mem_1"] }],
      [],
      [],
    );
    render(<KgTable records={[record({ id: "mem_1" })]} problems={problems} onSelectRecord={jest.fn()} />);
    expect(screen.getByText("duplicate")).toBeInTheDocument();
  });

  it("copy JSON writes the exact record to the clipboard", async () => {
    const writeText = jest.fn();
    Object.assign(navigator, { clipboard: { writeText } });
    const target = record({ id: "mem_1", predicate: "seat_preference" });
    render(<KgTable records={[target]} problems={NO_PROBLEMS} onSelectRecord={jest.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /copy seat_preference as json/i }));
    expect(writeText).toHaveBeenCalledWith(JSON.stringify(target, null, 2));
  });
});
