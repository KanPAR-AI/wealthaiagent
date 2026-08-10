import { render, screen } from "@testing-library/react";
import { SourceBadge } from "@/components/memory/source-badge";
import type { SourceType } from "@/services/memory-engine-service";

const CASES: { source: SourceType; label: string }[] = [
  { source: "user_explicit", label: "Explicit" },
  { source: "user_observed", label: "Observed" },
  { source: "tool_verified", label: "Verified" },
  { source: "document_verified", label: "Verified" },
  { source: "agent_inference", label: "Inferred" },
  { source: "episode_consolidation", label: "Consolidated" },
  { source: "system", label: "System" },
];

describe("SourceBadge", () => {
  test.each(CASES)("renders the $label text AND an icon for source=$source", ({ source, label }) => {
    const { container } = render(<SourceBadge source={source} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  test("Explicit visually outranks Inferred — different, non-muted styling", () => {
    const explicit = render(<SourceBadge source="user_explicit" />);
    const explicitEl = explicit.getByTestId("source-badge");
    const explicitClass = explicitEl.className;
    explicit.unmount();

    const inferred = render(<SourceBadge source="agent_inference" />);
    const inferredEl = inferred.getByTestId("source-badge");
    const inferredClass = inferredEl.className;
    inferred.unmount();

    expect(explicitClass).not.toBe(inferredClass);
    // Explicit is the solid/filled treatment (primary fill); Inferred is
    // the muted/dashed outline treatment — assert the concrete markers so
    // this fails loudly if the visual hierarchy is ever flattened.
    expect(explicitClass).toContain("bg-primary");
    expect(inferredClass).toContain("border-dashed");
  });
});
