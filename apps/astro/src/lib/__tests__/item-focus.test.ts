import { focusStart, focusStep, hasAdvice, focusApplies, FOCUS_MIN_ITEMS } from '../daily-view';
import type { FacetItem } from '../people-shapes';

const item = (id: string, meaning?: string | null): FacetItem => ({
  id, kind: 'transit', title: id, detail: '', domains: [], basis: '', meaning,
});

describe('the focused card (docs/69 polish)', () => {
  it('opens on the first item the engine gave an advice line to', () => {
    expect(focusStart([item('a'), item('b', '  '), item('c', 'say the warm thing')])).toBe(2);
  });
  it('opens on the first item when none has advice', () => {
    expect(focusStart([item('a'), item('b', null)])).toBe(0);
  });
  it('blank advice is no advice', () => {
    expect(hasAdvice(item('a', '   '))).toBe(false);
    expect(hasAdvice(item('a', 'hold the big purchase'))).toBe(true);
  });
  it('short lenses stay a list', () => {
    const many = Array.from({ length: FOCUS_MIN_ITEMS }, (_, i) => item(String(i)));
    expect(focusApplies(many)).toBe(true);
    expect(focusApplies(many.slice(1))).toBe(false);
  });
  it('steps wrap both ways', () => {
    expect(focusStep(0, -1, 12)).toBe(11);
    expect(focusStep(11, 1, 12)).toBe(0);
    expect(focusStep(3, 1, 12)).toBe(4);
    expect(focusStep(0, 1, 0)).toBe(0);
  });
});
