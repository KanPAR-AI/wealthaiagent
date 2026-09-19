import { render, screen } from "@testing-library/react";
import { KgHealthStrip } from "@/components/memory/full-graph/kg-health-strip";
import type { KgHealth } from "@/lib/knowledge-graph-assembly";

const HEALTH: KgHealth = {
  recordCount: 67,
  byStatus: { active: 34, superseded: 33 },
  entityCount: 0,
  relationCount: 0,
  recordsWithEntityLinks: 0,
  recordsWithValidUntil: 5,
  activeDuplicateGroupCount: 2,
  activeDuplicateRecordCount: 4,
  orphanCount: 1,
  suspiciousCount: 3,
};

describe("KgHealthStrip", () => {
  it("renders every count verbatim from the health object, including zero-entity/zero-relation", () => {
    render(<KgHealthStrip health={HEALTH} />);
    expect(screen.getByTestId("kg-stat-records")).toHaveTextContent("67");
    expect(screen.getByTestId("kg-stat-active")).toHaveTextContent("34");
    expect(screen.getByTestId("kg-stat-superseded")).toHaveTextContent("33");
    expect(screen.getByTestId("kg-stat-expired")).toHaveTextContent("0");
    expect(screen.getByTestId("kg-stat-disputed")).toHaveTextContent("0");
    expect(screen.getByTestId("kg-stat-entities")).toHaveTextContent("0");
    expect(screen.getByTestId("kg-stat-relations")).toHaveTextContent("0");
    expect(screen.getByTestId("kg-stat-duplicates")).toHaveTextContent("4");
    expect(screen.getByTestId("kg-stat-orphans")).toHaveTextContent("1");
    expect(screen.getByTestId("kg-stat-suspicious")).toHaveTextContent("3");
  });

  it("does not render a warning icon for a zero-value problem stat", () => {
    render(<KgHealthStrip health={{ ...HEALTH, orphanCount: 0 }} />);
    const orphanStat = screen.getByTestId("kg-stat-orphans");
    expect(orphanStat.querySelector("svg")).toBeNull();
  });
});
