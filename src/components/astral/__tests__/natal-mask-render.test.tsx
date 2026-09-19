/**
 * The JOIN: `maskBirth` -> `birthLines` / `dashaRows` -> the card on screen.
 *
 * Role-3 measured why this file exists: dropping the option at
 * `natal-chart.tsx` (`birthLines(chart)` instead of `birthLines(chart, {
 * mask })`) left 2224 tests green, because the view models were tested and
 * the component was not. These cases render the REAL component through the
 * REAL DOM adapter and read the text a person would see.
 *
 * It also pins the default: the web app and the AstroMatch panel pass no
 * option, and their card must be what shipped.
 */

import { render } from '@testing-library/react';
import { LIGHT_THEME, NatalChartView, parseNatalChart } from '@wealthai/astral';
import { natalTimedPayload } from '@wealthai/astral/fixtures';

import { domPrimitives } from '@/components/astral/dom-primitives';

const CHART = parseNatalChart(natalTimedPayload)!;

function draw(maskBirth?: boolean) {
  return render(
    <NatalChartView
      ui={domPrimitives}
      theme={LIGHT_THEME}
      width={900}
      chart={CHART}
      maskBirth={maskBirth}
    />,
  );
}

/** what a reader would see, as one string */
const textOf = (c: HTMLElement) => c.textContent ?? '';

/** the exact strings this chart carries — taken from the FIXTURE, never
 *  typed here (a literal would go stale on a re-capture and pass on a leak) */
const BIRTH = CHART.birth_data!;
const FIRST_PERIOD_START = CHART.dasha_periods[0].start_date;
const MASK = '••••••';

describe('unasked — the web app and the extension are untouched', () => {
  it('draws the birth block and the dasha table in clear', () => {
    const text = textOf(draw().container);
    expect(text).toContain('Born');
    expect(text).toContain(BIRTH.place_of_birth!);
    expect(text).toContain('Vimshottari');
    expect(text).not.toContain(MASK);
    // the same card with the option explicitly off reads identically
    expect(textOf(draw(false).container)).toBe(text);
  });
});

describe('masked — the host asked, so the card hides the birth facts', () => {
  it('leaves no birth date, time or place anywhere in the card', () => {
    const text = textOf(draw(true).container);
    expect(text).not.toContain(BIRTH.place_of_birth!);
    expect(text).not.toContain(BIRTH.date_of_birth!);
    if (BIRTH.time_of_birth) expect(text).not.toContain(BIRTH.time_of_birth);
    // …and the YEAR, in the notation the card prints dates in
    expect(text).not.toContain(String(BIRTH.date_of_birth).slice(0, 4));
  });

  it('hides the DASHA row that starts on the birth date — the second leak', () => {
    // A Vimshottari table is anchored at birth, so period 0's start IS the
    // birth date. The card showed a masked "Born" two rows above it.
    expect(FIRST_PERIOD_START).toBe(BIRTH.date_of_birth);

    // THE CASE THAT PUTS ROW 0 ON SCREEN. The table is normally sliced from
    // the CURRENT period, and this captured chart has one — so row 0 is not
    // drawn and the leak is invisible on it. `currentIndex === -1 ? 0` puts
    // row 0 first whenever no period is current: a chart cast before
    // `is_current` existed, one cast for a future date, or a native still
    // inside their first mahadasha. That is the artifact below — the SAME
    // captured payload with that one boolean cleared, which is a state the
    // engine really produces rather than a shape somebody imagined.
    const noCurrent = parseNatalChart({
      ...natalTimedPayload,
      dasha_periods: natalTimedPayload.dasha_periods.map((d) => ({ ...d, is_current: false })),
    })!;
    const drawnMasked = render(
      <NatalChartView ui={domPrimitives} theme={LIGHT_THEME} width={900}
        chart={noCurrent} maskBirth />,
    );
    const masked = textOf(drawnMasked.container);
    expect(masked).not.toContain(String(FIRST_PERIOD_START).slice(0, 4));
    expect(masked).toContain(MASK);
    expect(masked).toContain(noCurrent.dasha_periods[0].planet);

    // …and unmasked it is the leak, which is what makes the case above real
    const drawnPlain = render(
      <NatalChartView ui={domPrimitives} theme={LIGHT_THEME} width={900}
        chart={noCurrent} />,
    );
    expect(textOf(drawnPlain.container)).toContain(String(FIRST_PERIOD_START).slice(0, 4));

    // the ordinary (current-period) slice is still a table
    const text = textOf(draw(true).container);
    expect(text).toContain('Vimshottari');
    expect(text).toContain(MASK);
  });

  it('keeps everything that is not a birth fact', () => {
    const text = textOf(draw(true).container);
    expect(text).toContain('Born');       // the row LABEL survives
    expect(text).toContain('Time');
    expect(text).toContain('Place');
    expect(text).toContain(CHART.ascendant!);
  });
});
