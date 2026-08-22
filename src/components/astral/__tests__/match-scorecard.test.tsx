/**
 * ASTRAL-16 + ASTRAL-18 — the shared match scorecard.
 *
 * The whole point of this file is the negative space. §5b-2's "87% Strong
 * Match" is banned twice over by the source doc, and the engine is built so it
 * cannot be produced; the only way it gets on screen is a client inventing it.
 * These tests are the tripwire.
 */

import { matchTimedPayload, matchTimelessPayload } from '@wealthai/astral/fixtures';
import { TIME_DEPENDENT_KOOTAS } from '@wealthai/astral';

import { APP_WIDTH, PANEL_WIDTH, renderMatch } from './render-shared';

describe('ASTRAL-16 — a complete match', () => {
  it('shows the real score out of 36 and the engine band', () => {
    const { getByTestId } = renderMatch(matchTimedPayload);
    expect(getByTestId('astral-match-score')).toHaveTextContent('21.5 / 36');
    expect(getByTestId('astral-match-band')).toHaveTextContent('Acceptable');
  });

  it('takes the band from the payload rather than recomputing one', () => {
    const { getByTestId } = renderMatch({ ...matchTimedPayload, verdict: 'excellent' });
    // 21.5/36 is "acceptable" by the engine's own rule; if the client were
    // banding, this would come back "Acceptable".
    expect(getByTestId('astral-match-band')).toHaveTextContent('Excellent');
  });

  it('fills the ring by guna out of 36 — a picture, with no number of its own', () => {
    const { container } = renderMatch(matchTimedPayload);
    const dashed = Array.from(container.querySelectorAll('circle')).find((c) =>
      c.getAttribute('stroke-dasharray'),
    );
    expect(dashed).toBeTruthy();
    const [filled, circumference] = dashed!
      .getAttribute('stroke-dasharray')!
      .split(' ')
      .map(Number);
    expect(circumference).toBeCloseTo(2 * Math.PI * 42, 5);
    expect(filled).toBeCloseTo(circumference * (21.5 / 36), 5);
    // and that ratio appears nowhere as text
    expect(container.textContent).not.toContain('59.7');
    expect(container.textContent).not.toContain('0.597');
  });

  it('renders each koota as a real fraction', () => {
    const { getByTestId } = renderMatch(matchTimedPayload);
    const text = getByTestId('astral-match-kootas').textContent ?? '';
    expect(text).toContain('Yoni');
    expect(text).toContain('2 / 4');
    expect(text).toContain('Nadi');
    expect(text).toContain('8 / 8');
    expect(text).toContain('Bhakoot');
    expect(text).toContain('0 / 7');
  });

  it('drives the four dimension rows from the kootas, per docs/48 §6', () => {
    const { getByTestId } = renderMatch(matchTimedPayload);
    const text = getByTestId('astral-match-dimensions').textContent ?? '';
    expect(text).toContain('Chemistry');
    expect(text).toContain('Yoni 2 / 4');
    expect(text).toContain('Vashya 1 / 2');
    expect(text).toContain('Communication');
    expect(text).toContain('Graha Maitri 4 / 5');
    expect(text).toContain('Emotional');
    expect(text).toContain('Gana 5 / 6');
    expect(text).toContain('Long-term');
    expect(text).toContain('Bhakoot 0 / 7');
    expect(text).toContain('Nadi 8 / 8');
  });

  it('never SUMS a two-koota dimension into a score of its own', () => {
    const { getByTestId } = renderMatch(matchTimedPayload);
    const text = getByTestId('astral-match-dimensions').textContent ?? '';
    // Chemistry would be 3/6 if summed, Long-term 8/15.
    expect(text).not.toContain('3 / 6');
    expect(text).not.toContain('8 / 15');
  });

  it('shows the dosha flags the engine raised', () => {
    const { getByTestId } = renderMatch(matchTimedPayload);
    expect(getByTestId('astral-match-doshas')).toHaveTextContent('Bhakoot dosha');
  });
});

describe('ASTRAL-16 — a time-less match (ASTRAL-12 at the edge)', () => {
  it('prints NO /36 total anywhere', () => {
    const { container, queryByTestId } = renderMatch(matchTimelessPayload);
    expect(queryByTestId('astral-match-score')).toBeNull();
    expect(container.textContent).not.toContain('/ 36');
    expect(container.textContent).not.toContain('/36');
  });

  it('states the firm/pending split instead', () => {
    const { getByTestId } = renderMatch(matchTimelessPayload);
    expect(getByTestId('astral-match-split')).toHaveTextContent(
      '5 of 15 firm points · 21 pending',
    );
  });

  it('marks exactly the four nakshatra kootas as needing a birth time', () => {
    const { container } = renderMatch(matchTimelessPayload);
    const marked = Array.from(
      container.querySelectorAll('[data-testid^="astral-koota-pending-"]'),
    ).map((el) => el.getAttribute('data-testid')!.replace('astral-koota-pending-', ''));
    expect(marked.sort()).toEqual(
      [...TIME_DEPENDENT_KOOTAS].map((k) => k.toLowerCase()).sort(),
    );
    expect(marked).toHaveLength(4);
  });

  it('does not render a pending koota as a zero', () => {
    const { getByTestId } = renderMatch(matchTimelessPayload);
    const yoni = getByTestId('astral-koota-yoni').textContent ?? '';
    expect(yoni).toContain('needs a birth time');
    expect(yoni).not.toContain('0 / 4');
  });

  it('still shows the four kootas that WERE scored', () => {
    const { getByTestId } = renderMatch(matchTimelessPayload);
    const text = getByTestId('astral-match-kootas').textContent ?? '';
    expect(text).toContain('0 / 1'); // Varna
    expect(text).toContain('1 / 2'); // Vashya
    expect(text).toContain('4 / 5'); // Graha Maitri
    expect(text).toContain('0 / 7'); // Bhakoot
  });

  it('carries the engine reasons for what could not be checked', () => {
    const { container } = renderMatch(matchTimelessPayload);
    expect(container.textContent).toContain('Nadi dosha');
    expect(container.textContent).toContain('Mangal (Kuja) dosha needs');
  });

  it('shows the band the engine chose — "incomplete", not a flattering one', () => {
    const { getByTestId } = renderMatch(matchTimelessPayload);
    expect(getByTestId('astral-match-band')).toHaveTextContent('Incomplete');
  });

  it('leaves the ring empty rather than full when nothing totals', () => {
    const { container } = renderMatch(matchTimelessPayload);
    const dashed = Array.from(container.querySelectorAll('circle')).find((c) =>
      c.getAttribute('stroke-dasharray'),
    )!;
    const [filled, circumference] = dashed
      .getAttribute('stroke-dasharray')!
      .split(' ')
      .map(Number);
    // 5 firm of 15 — a third of the way round, not the whole ring.
    expect(filled).toBeCloseTo(circumference * (5 / 15), 5);
  });
});

describe('ASTRAL-18 — one component, two widths', () => {
  it.each([
    ['380 px extension panel', PANEL_WIDTH],
    ['app width', APP_WIDTH],
  ])('renders the same numbers at %s', (_label, width) => {
    const { getByTestId } = renderMatch(matchTimedPayload, width);
    expect(getByTestId('astral-match-score')).toHaveTextContent('21.5 / 36');
    expect(getByTestId('astral-match-band')).toHaveTextContent('Acceptable');
    expect(getByTestId('astral-match-kootas').textContent).toContain('8 / 8');
  });

  it('produces identical text content at both widths — only layout differs', () => {
    const panel = renderMatch(matchTimedPayload, PANEL_WIDTH);
    const panelText = panel.container.textContent;
    panel.unmount();
    const app = renderMatch(matchTimedPayload, APP_WIDTH);
    expect(app.container.textContent).toBe(panelText);
  });
});
