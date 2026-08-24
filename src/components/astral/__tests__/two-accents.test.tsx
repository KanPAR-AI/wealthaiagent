/**
 * docs/49 ASTRAL-98 / F25 — the theme has TWO accents, with different jobs.
 *
 * The board strokes the compatibility ring in gold and every button in violet.
 * One token cannot be both, and the failure mode is specific: supplying a gold
 * `accent` to get the ring right turns every affordance gold.
 *
 * So the two are asserted SEPARATELY and against different components, which
 * is what makes a single find-and-replace unable to satisfy them both — the
 * obligation the row names.
 */

import { inputRequestPayload, matchTimedPayload } from '@wealthai/astral/fixtures';
import { DARK_THEME, LIGHT_THEME } from '@wealthai/astral';

import { renderInputRequest, renderMatch } from './render-shared';

describe('the two accents are two values', () => {
  it('every constructed theme supplies both, and they are different colours', () => {
    for (const theme of [LIGHT_THEME, DARK_THEME]) {
      expect(theme.ceremonial).toMatch(/^#[0-9a-f]{6}$/);
      expect(theme.accent).toMatch(/^#[0-9a-f]{6}$/);
      expect(theme.ceremonial).not.toBe(theme.accent);
    }
  });

  it('the ceremonial token is gold and the interactive one is violet', () => {
    // Not decoration: a swap would pass every "they differ" check while
    // putting a violet ring on screen 6 and a gold button on every other.
    const channels = (hex: string) =>
      [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    for (const theme of [LIGHT_THEME, DARK_THEME]) {
      const [gr, gg, gb] = channels(theme.ceremonial);
      expect(gr).toBeGreaterThan(gb); // warm
      expect(gg).toBeGreaterThan(gb);
      const [vr, , vb] = channels(theme.accent);
      expect(vb).toBeGreaterThan(vr); // cool
    }
  });
});

describe('the ring is ceremonial', () => {
  it('strokes the filled arc with the ceremonial token', () => {
    const { container } = renderMatch(matchTimedPayload);
    const dashed = Array.from(container.querySelectorAll('circle')).find((c) =>
      c.getAttribute('stroke-dasharray'),
    );
    expect(dashed).toBeTruthy();
    expect(dashed!.getAttribute('stroke')).toBe(LIGHT_THEME.ceremonial);
  });

  it('does not paint the scorecard interactive-violet anywhere', () => {
    // The ring was the ONLY `theme.accent` on this card; if a later change
    // reaches for the interactive token here, the two jobs have blurred.
    const { container } = renderMatch(matchTimedPayload);
    expect(container.innerHTML).not.toContain(LIGHT_THEME.accent);
  });
});

describe('affordances are interactive', () => {
  it('fills the primary button with the interactive token, not the ceremonial one', () => {
    const { getByTestId } = renderInputRequest(inputRequestPayload);
    const next = getByTestId('input-request-next');
    const background = next.style.backgroundColor;
    expect(background).toBeTruthy();
    expect(rgbToHex(background)).toBe(LIGHT_THEME.accent);
    expect(rgbToHex(background)).not.toBe(LIGHT_THEME.ceremonial);
  });

  it('puts no gold on the widget at all', () => {
    const { container } = renderInputRequest(inputRequestPayload);
    expect(container.innerHTML).not.toContain(LIGHT_THEME.ceremonial);
  });
});

/** jsdom normalises inline colours to `rgb(r, g, b)`. */
function rgbToHex(value: string): string {
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(value);
  if (!m) return value;
  return `#${m.slice(1).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
}
