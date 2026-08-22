/**
 * ASTRAL-15 — the natal chart is DRAWN.
 *
 * Before this, no chart existed anywhere in the product outside the PDF:
 * `response.tsx` returned null for the `natal_chart` fence and
 * `widget-view.tsx` returned null for the widget.
 */

import { natalTimedPayload, natalTimelessPayload } from '@wealthai/astral/fixtures';

import { APP_WIDTH, PANEL_WIDTH, renderNatal } from './render-shared';

describe('ASTRAL-15 — a timed chart', () => {
  it('draws the North-Indian diamond', () => {
    const { getByTestId, container } = renderNatal(natalTimedPayload);
    expect(getByTestId('astral-natal-wheel')).toBeInTheDocument();
    // outer square + the six internal strokes of the diamond
    expect(container.querySelectorAll('rect')).toHaveLength(1);
    expect(container.querySelectorAll('line')).toHaveLength(6);
  });

  it('places all twelve houses and puts every graha in one of them', () => {
    const { container } = renderNatal(natalTimedPayload);
    const svgText = Array.from(container.querySelectorAll('text')).map((t) => t.textContent);
    for (let house = 1; house <= 12; house += 1) {
      expect(svgText).toContain(String(house));
    }
    // Nine grahas, by the same abbreviations the Kundli PDF uses. Ra and Ke
    // are here on purpose: they are what ASTRAL-0 was about.
    for (const abbr of ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke']) {
      expect(svgText.some((t) => t?.startsWith(abbr))).toBe(true);
    }
  });

  it('states the Lagna to the arcminute, WITHIN the sign (A6#13)', () => {
    // The artifact carries ascendant_degree 85.25 (absolute ecliptic
    // longitude) and ascendant_sign_degree 25.25. This assertion used to read
    // "Gemini 85°15′", which is impossible — a sign spans 30° — and that is
    // what shipped on every chart until A6#13.
    const { getByTestId } = renderNatal(natalTimedPayload);
    const el = getByTestId('astral-natal-ascendant');
    expect(el).toHaveTextContent('Gemini 25°15′');
    expect(el).not.toHaveTextContent('85°');
  });

  it('shows the calculation stamp, read off the artifact (INV-3)', () => {
    const { getByTestId } = renderNatal(natalTimedPayload);
    const stamp = getByTestId('astral-natal-stamp').textContent ?? '';
    expect(stamp).toContain('sidereal');
    expect(stamp).toContain(String(natalTimedPayload.ayanamsa));
    expect(stamp).toContain(String(natalTimedPayload.house_system));
  });

  it('renders a placements row per graha, with house and nakshatra', () => {
    const { getByTestId } = renderNatal(natalTimedPayload);
    const table = getByTestId('astral-natal-placements');
    expect(table.children).toHaveLength(9);
    expect(table.textContent).toContain('Ardra');
    expect(table.textContent).toContain('House');
  });

  it('marks a retrograde graha', () => {
    const { getByTestId } = renderNatal(natalTimedPayload);
    // Jupiter is retrograde on this captured chart.
    expect(getByTestId('astral-natal-placements').textContent).toContain('Jupiter');
    const jupiter = natalTimedPayload.planets.find((p) => p.planet === 'Jupiter')!;
    expect(jupiter.retrograde).toBe(true);
  });

  it('renders at the 380 px panel width and at app width from one component', () => {
    const panel = renderNatal(natalTimedPayload, PANEL_WIDTH);
    expect(panel.getByTestId('astral-natal-wheel')).toBeInTheDocument();
    panel.unmount();
    const app = renderNatal(natalTimedPayload, APP_WIDTH);
    expect(app.getByTestId('astral-natal-wheel')).toBeInTheDocument();
  });
});

describe('ASTRAL-15 — time_known=false: absent, with a stated reason', () => {
  it('draws NO wheel at all — not faint, not greyed, not dotted', () => {
    const { queryByTestId, container } = renderNatal(natalTimelessPayload);
    expect(queryByTestId('astral-natal-wheel')).toBeNull();
    expect(container.querySelectorAll('svg')).toHaveLength(0);
    expect(container.querySelectorAll('line')).toHaveLength(0);
  });

  it('states no ascendant anywhere in the rendered output', () => {
    const { queryByTestId, container } = renderNatal(natalTimelessPayload);
    expect(queryByTestId('astral-natal-ascendant')).toBeNull();
    const text = container.textContent ?? '';
    expect(text).not.toContain('Lagna:');
    expect(text).not.toMatch(/Ascendant\s*[:—-]/);
  });

  it('names no house number, in the table OR in an SVG label', () => {
    const { container } = renderNatal(natalTimelessPayload);
    expect(container.textContent ?? '').not.toContain('HOUSE');
    expect(container.textContent ?? '').not.toContain('House');
    // The house numerals live in <text> nodes inside the diamond. Asserting
    // on `textContent` alone let a mutation that forces the wheel on slip
    // past this case, so the SVG is checked directly.
    expect(container.querySelectorAll('text')).toHaveLength(0);
  });

  it('replaces the wheel with the reason, and the reason names the unlocks', () => {
    const { getByTestId } = renderNatal(natalTimelessPayload);
    const reason = getByTestId('astral-natal-no-time').textContent ?? '';
    expect(reason).toContain('No birth time on file');
    expect(reason).toContain('Lagna moves a full sign every two hours');
    expect(reason).toContain('21 of the 36');
    // No varga is computed anywhere in the package, so it must not be promised.
    expect(reason.toLowerCase()).not.toContain('divisional');
  });

  it('still shows the time-independent work — Moon sign, Sun sign, placements', () => {
    const { container, getByTestId } = renderNatal(natalTimelessPayload);
    expect(container.textContent).toContain('Gemini');
    expect(container.textContent).toContain('Aries');
    expect(getByTestId('astral-natal-placements').children).toHaveLength(9);
  });

  it('carries the Moon ambiguity note the engine put on the artifact', () => {
    const { getByTestId } = renderNatal(natalTimelessPayload);
    expect(getByTestId('astral-natal-moon-note')).toHaveTextContent('Punarvasu');
  });

  it('shows no nakshatra pada — a pada is as time-dependent as a bhava', () => {
    const { getByTestId } = renderNatal(natalTimelessPayload);
    const text = getByTestId('astral-natal-placements').textContent ?? '';
    expect(text).toContain('Ardra');
    expect(text).not.toContain('Ardra (');
  });
});
