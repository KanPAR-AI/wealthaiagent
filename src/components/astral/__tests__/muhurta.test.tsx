/**
 * ASTRAL-17 — the third discarded block.
 */

import { muhurtaPayload } from '@wealthai/astral/fixtures';

import { APP_WIDTH, PANEL_WIDTH, renderMuhurta } from './render-shared';

describe('ASTRAL-17 — muhurta windows render', () => {
  it('renders one card per window the engine returned, in the engine order', () => {
    const { getAllByTestId } = renderMuhurta(muhurtaPayload);
    expect(getAllByTestId('astral-muhurta-window')).toHaveLength(
      muhurtaPayload.windows.length,
    );
  });

  it('shows start and end in the payload local time, not the viewer timezone', () => {
    const { getAllByTestId } = renderMuhurta(muhurtaPayload);
    const first = getAllByTestId('astral-muhurta-window')[0].textContent ?? '';
    expect(first).toContain('1 Sep 2026');
    expect(first).toContain('14:15 – 14:30');
  });

  it('shows lagna, its lord, and the panchang', () => {
    const { getAllByTestId } = renderMuhurta(muhurtaPayload);
    const first = getAllByTestId('astral-muhurta-window')[0].textContent ?? '';
    expect(first).toContain('Sagittarius (Jupiter)');
    expect(first).toContain('Panchami');
    expect(first).toContain('Ashwini (pada 2)');
    expect(first).toContain('Vriddhi');
    expect(first).toContain('Vanija');
    expect(first).toContain('Mangalvar');
  });

  it('shows the rahu-kaal overlap flag rather than hiding the window', () => {
    const { getAllByTestId } = renderMuhurta(muhurtaPayload);
    expect(getAllByTestId('astral-muhurta-rahu-kaal').length).toBeGreaterThan(0);
    // hiding would be a client-side filtering decision; the row forbids
    // client-side scoring and this is the same family of decision.
    expect(getAllByTestId('astral-muhurta-window')).toHaveLength(10);
  });

  it('renders the score as the payload float, never a percentage', () => {
    const { getAllByTestId, container } = renderMuhurta(muhurtaPayload);
    expect(getAllByTestId('astral-muhurta-score')[0]).toHaveTextContent('0.88');
    expect(container.textContent).not.toContain('%');
    expect(container.textContent).not.toContain('88%');
  });

  it('does not re-rank or re-score: window order matches the payload', () => {
    const { getAllByTestId } = renderMuhurta(muhurtaPayload);
    const rendered = getAllByTestId('astral-muhurta-window').map(
      (el) => el.querySelector('[data-testid="astral-muhurta-score"]')?.textContent,
    );
    expect(rendered).toEqual(muhurtaPayload.windows.map((w) => String(w.score)));
  });

  it('renders at 380 px and at app width from one component', () => {
    const panel = renderMuhurta(muhurtaPayload, PANEL_WIDTH);
    const panelText = panel.container.textContent;
    panel.unmount();
    const app = renderMuhurta(muhurtaPayload, APP_WIDTH);
    expect(app.container.textContent).toBe(panelText);
  });
});
