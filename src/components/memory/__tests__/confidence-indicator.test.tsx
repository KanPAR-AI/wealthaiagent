import { render, screen } from "@testing-library/react";
import { bucketConfidence, ConfidenceIndicator } from "@/components/memory/confidence-indicator";

describe("bucketConfidence", () => {
  test.each([
    [0.95, "high"],
    [0.9, "high"],
    [0.89, "medium"],
    [0.7, "medium"],
    [0.69, "low"],
    [0, "low"],
  ] as const)("confidence=%f -> %s", (value, bucket) => {
    expect(bucketConfidence(value)).toBe(bucket);
  });
});

describe("ConfidenceIndicator", () => {
  test("renders the bucket label, not the raw number, by default", () => {
    render(<ConfidenceIndicator confidence={0.42} />);
    expect(screen.getByText(/Low confidence/)).toBeInTheDocument();
    expect(screen.queryByText(/0\.42/)).not.toBeInTheDocument();
  });

  test("dev mode additionally shows the raw number", () => {
    render(<ConfidenceIndicator confidence={0.913} devMode />);
    expect(screen.getByText(/High confidence \(0\.91\)/)).toBeInTheDocument();
  });

  test("sets data-bucket for each threshold", () => {
    const { rerender, getByTestId } = render(<ConfidenceIndicator confidence={0.95} />);
    expect(getByTestId("confidence-indicator")).toHaveAttribute("data-bucket", "high");
    rerender(<ConfidenceIndicator confidence={0.8} />);
    expect(getByTestId("confidence-indicator")).toHaveAttribute("data-bucket", "medium");
    rerender(<ConfidenceIndicator confidence={0.1} />);
    expect(getByTestId("confidence-indicator")).toHaveAttribute("data-bucket", "low");
  });
});
