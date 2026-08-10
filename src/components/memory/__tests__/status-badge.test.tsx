import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/memory/status-badge";
import type { MemoryStatus } from "@/services/memory-engine-service";

const CASES: { status: MemoryStatus; label: string }[] = [
  { status: "active", label: "Active" },
  { status: "superseded", label: "Superseded" },
  { status: "disputed", label: "Disputed" },
  { status: "expired", label: "Expired" },
  { status: "deleted", label: "Deleted" },
];

describe("StatusBadge", () => {
  test.each(CASES)("renders the $label text AND an icon for status=$status (never color-only)", ({ status, label }) => {
    const { container } = render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    // Icon present regardless of color — a screen reader / colorblind user
    // still gets the same information as the text.
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByTestId("status-badge")).toHaveAttribute("data-status", status);
  });

  test("every status renders a distinct icon, even statuses that intentionally share a neutral color (§52-54)", () => {
    // Superseded/Expired are both "neutral" by spec — same color treatment
    // is correct, not a bug. Color is never the ONLY signal: the icon (and
    // the label text, asserted above) still differs for every status.
    const icons = CASES.map(({ status }) => {
      const { container, unmount } = render(<StatusBadge status={status} />);
      const svg = container.querySelector("svg");
      const html = svg?.outerHTML ?? "";
      unmount();
      return html;
    });
    expect(new Set(icons).size).toBe(CASES.length);
  });

  test("active/disputed/deleted (semantically distinct) also get visually distinct color treatments", () => {
    const distinctGroup: MemoryStatus[] = ["active", "disputed", "deleted"];
    const classNames = distinctGroup.map((status) => {
      const { container, unmount } = render(<StatusBadge status={status} />);
      const cls = container.querySelector('[data-testid="status-badge"]')?.className ?? "";
      unmount();
      return cls;
    });
    expect(new Set(classNames).size).toBe(distinctGroup.length);
  });
});
