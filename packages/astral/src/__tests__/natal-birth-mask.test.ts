/**
 * `birthLines(chart, { mask })` — the render option a HOST asks for (owner
 * ruling, 2026-09-19: the Astral AI app hides the user's own exact birth
 * date, time and place until the phone's owner authenticates).
 *
 * Two properties, and the second is as load-bearing as the first:
 *   1. masked, nothing exact survives — and the ROWS DO, so a hidden time
 *      and an unknown time do not render alike;
 *   2. UNASKED, nothing changes. The web app and the AstroMatch panel pass
 *      no option, and this file is what says their card is untouched.
 */

import { natalTimedPayload, natalTimelessPayload } from '../fixtures/payloads';
import { MASKED_VALUE } from '../format';
import { parseNatalChart } from '../payloads';
import { birthLines } from '../view/natal';

const TIMED = parseNatalChart(natalTimedPayload)!;
const TIMELESS = parseNatalChart(natalTimelessPayload)!;

describe('the default — today’s behaviour, for the hosts that do not ask', () => {
  it('draws the birth block verbatim with no option at all', () => {
    const lines = birthLines(TIMED);
    expect(lines.map((l) => l.label)).toEqual(['Born', 'Time', 'Place']);
    for (const line of lines) expect(line.value).not.toBe(MASKED_VALUE);
    expect(lines.find((l) => l.label === 'Born')!.value)
      .toBe(birthLines(TIMED, {}).find((l) => l.label === 'Born')!.value);
  });

  it('is unchanged by `mask: false`', () => {
    expect(birthLines(TIMED, { mask: false })).toEqual(birthLines(TIMED));
  });
});

describe('masked, for the host that asks', () => {
  const masked = birthLines(TIMED, { mask: true });
  const plain = birthLines(TIMED);

  it('leaves nothing exact behind', () => {
    const rendered = JSON.stringify(masked);
    for (const line of plain) {
      expect(rendered).not.toContain(line.value);
    }
    expect(rendered).not.toMatch(/\d/);
  });

  it('keeps the same ROWS — a hidden time is not an unknown time', () => {
    // If the Time row vanished when masked, a chart with a hidden birth time
    // and a chart cast without one would draw identically, and the second
    // has a reason on it that the first must not borrow.
    expect(masked.map((l) => l.label)).toEqual(plain.map((l) => l.label));
    for (const line of masked) expect(line.value).toBe(MASKED_VALUE);
  });

  it('adds no row to a time-less chart — there is still no time to hide', () => {
    const maskedTimeless = birthLines(TIMELESS, { mask: true });
    expect(maskedTimeless.map((l) => l.label))
      .toEqual(birthLines(TIMELESS).map((l) => l.label));
    expect(maskedTimeless.map((l) => l.label)).not.toContain('Time');
  });

  it('never surfaces coordinates, masked or not (ASTRAL-63)', () => {
    for (const lines of [plain, masked]) {
      expect(JSON.stringify(lines)).not.toMatch(/latitude|longitude/i);
    }
  });
});
