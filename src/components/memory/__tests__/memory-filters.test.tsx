import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useSearchParams } from "react-router-dom";
import { MemoryFilters } from "@/components/memory/memory-filters";

// A tiny probe that surfaces the CURRENT URL search string so tests can
// assert "filters -> URL" without reaching into router internals.
function LocationProbe() {
  const [params] = useSearchParams();
  return <div data-testid="location-probe">{params.toString()}</div>;
}

function renderFilters(initialPath = "/memories") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/memories"
          element={
            <>
              <MemoryFilters />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function probe() {
  return screen.getByTestId("location-probe").textContent ?? "";
}

describe("MemoryFilters (§5, MUI-0007 — every control writes the URL)", () => {
  test("checking a Memory type checkbox writes `type` to the URL", async () => {
    renderFilters();
    await userEvent.click(screen.getByRole("checkbox", { name: "Preference" }));
    expect(probe()).toContain("type=preference");
  });

  test("checking two Source checkboxes writes a comma-joined `source` param", async () => {
    renderFilters();
    await userEvent.click(screen.getByRole("checkbox", { name: "Explicit user" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Tool verified" }));
    expect(probe()).toContain("source=user_explicit%2Ctool_verified");
  });

  test("unchecking a Status checkbox removes it from the URL, never leaves an empty param", async () => {
    renderFilters("/memories?status=active%2Cdisputed");
    const active = screen.getByRole("checkbox", { name: "Active" });
    expect(active).toBeChecked();
    await userEvent.click(active);
    expect(probe()).toContain("status=disputed");
    expect(probe()).not.toContain("status=active");
  });

  test("Confidence select writes the min-confidence threshold, not a fabricated bucket label", async () => {
    renderFilters();
    await userEvent.selectOptions(
      screen.getByLabelText("Confidence"),
      "High only (≥ 0.90)",
    );
    expect(probe()).toContain("confidence=0.9");
  });

  test("Domain field commits on blur, syncing the SAME `namespace` param the header's DomainSelector uses", async () => {
    renderFilters();
    const domain = screen.getByLabelText("Domain");
    await userEvent.type(domain, "travel");
    await userEvent.tab(); // blur
    expect(probe()).toContain("namespace=travel");
  });

  test("Entity field writes `entity`", async () => {
    renderFilters();
    await userEvent.type(screen.getByLabelText("Entity"), "ent_42");
    await userEvent.tab();
    expect(probe()).toContain("entity=ent_42");
  });

  test("existing unrelated params (q, scope) survive a filter change untouched", async () => {
    renderFilters("/memories?q=aisle&scope=user:ravi");
    await userEvent.click(screen.getByRole("checkbox", { name: "Active" }));
    expect(probe()).toContain("q=aisle");
    expect(probe()).toContain("scope=user%3Aravi");
    expect(probe()).toContain("status=active");
  });

  test("reload with pre-set filters in the URL restores every control's checked/selected state (UI-25)", () => {
    renderFilters(
      "/memories?type=preference%2Cprofile&status=disputed&confidence=0.7&namespace=travel",
    );
    expect(screen.getByRole("checkbox", { name: "Preference" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Profile" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Semantic" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Disputed" })).toBeChecked();
    expect(screen.getByLabelText("Confidence")).toHaveValue("0.7");
    expect(screen.getByLabelText("Domain")).toHaveValue("travel");
  });

  test("'Clear all' resets every filter and disappears once filters are already default", async () => {
    renderFilters("/memories?type=preference&status=active");
    const clear = screen.getByRole("button", { name: /clear all/i });
    await userEvent.click(clear);
    expect(probe()).toBe("");
    expect(screen.queryByRole("button", { name: /clear all/i })).not.toBeInTheDocument();
  });

  test("browse (unranked) mode surfaces an honest note about which filters it ignores", () => {
    renderFilters("/memories?sort=browse&q=aisle&confidence=0.9");
    expect(screen.getByText(/browse.*mode doesn.t apply/i)).toBeInTheDocument();
    expect(screen.getByText(/search text/)).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === "P" && /confidence/i.test(el.textContent ?? ""))).toBeInTheDocument();
  });
});
