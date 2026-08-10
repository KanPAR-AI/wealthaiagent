import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExpandableValue } from "@/components/memory/expandable-value";

describe("ExpandableValue (UI-32)", () => {
  test("a short value renders in full with no toggle", () => {
    render(<ExpandableValue value="aisle" />);
    expect(screen.getByText("aisle")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  test("a long value is collapsed by default with a keyboard-operable 'Show more' toggle", async () => {
    const long = "x".repeat(400);
    render(<ExpandableValue value={long} />);
    expect(screen.getByRole("button", { name: /show more/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /show more/i }));
    expect(screen.getByRole("button", { name: /show less/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show less/i })).toHaveAttribute(
      "aria-expanded", "true",
    );
  });

  test("the value itself is never truncated/mutated — full text is always in the DOM once expanded", async () => {
    const long = "word ".repeat(80).trim();
    render(<ExpandableValue value={long} />);
    await userEvent.click(screen.getByRole("button", { name: /show more/i }));
    expect(screen.getByText(long)).toBeInTheDocument();
  });

  test("a structured (non-string) value is rendered, not silently dropped", () => {
    render(<ExpandableValue value={{ from: "SFO", to: "JFK" }} />);
    expect(screen.getByTestId("expandable-value").textContent).toContain("SFO");
  });
});
