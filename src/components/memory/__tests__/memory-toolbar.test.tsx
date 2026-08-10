import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useSearchParams } from "react-router-dom";
import { MemoryToolbar } from "@/components/memory/memory-toolbar";

function LocationProbe() {
  const [params] = useSearchParams();
  return <div data-testid="location-probe">{params.toString()}</div>;
}

function renderToolbar(count: number, initialPath = "/memories") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/memories"
          element={
            <>
              <MemoryToolbar resultCount={count} />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("MemoryToolbar (§8-11 — result count + Sort)", () => {
  test("shows the result count from props, never fabricated", () => {
    renderToolbar(7);
    expect(screen.getByTestId("memory-result-count")).toHaveTextContent("7 memories");
  });

  test("singular phrasing for exactly one result", () => {
    renderToolbar(1);
    expect(screen.getByTestId("memory-result-count")).toHaveTextContent("1 memory");
  });

  test("defaults to 'Best match' (relevance) sort", () => {
    renderToolbar(3);
    expect(screen.getByRole("button", { name: /sort/i })).toHaveTextContent("Best match");
  });

  test("selecting 'Browse (unranked)' writes sort=browse to the URL (changes the request, not a client sort)", async () => {
    renderToolbar(3);
    await userEvent.click(screen.getByRole("button", { name: /sort/i }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Browse (unranked)" }));
    expect(screen.getByTestId("location-probe")).toHaveTextContent("sort=browse");
  });

  test("selecting 'Best match' again clears the sort param (default, never written explicitly)", async () => {
    renderToolbar(3, "/memories?sort=browse");
    await userEvent.click(screen.getByRole("button", { name: /sort/i }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Best match" }));
    expect(screen.getByTestId("location-probe")).not.toHaveTextContent("sort=");
  });
});
