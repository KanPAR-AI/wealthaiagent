/**
 * The count line on a phase card (bug bf83c4d7, round 2): "4 exercises · 2
 * awaiting a segment" when the engine reports omissions, plain otherwise,
 * and unchanged for an older server that sends no `omitted_count`.
 */
import { phaseCountLine } from '../phase-view';
import { t } from '../i18n';

describe('phaseCountLine', () => {
  it('plain when nothing is omitted', () => {
    expect(phaseCountLine({ count: 14 }, 'exercises', 'awaiting a segment')).toBe('14 exercises');
    expect(phaseCountLine({ count: 14, omitted_count: 0 }, 'exercises', 'awaiting a segment'))
      .toBe('14 exercises');
  });

  it('names the omissions when the engine reports them', () => {
    expect(phaseCountLine({ count: 4, omitted_count: 2 }, 'exercises', 'awaiting a segment'))
      .toBe('4 exercises · 2 awaiting a segment');
  });

  it('renders in both languages from the i18n rows the screen passes', () => {
    for (const lang of ['en', 'hi'] as const) {
      const line = phaseCountLine({ count: 4, omitted_count: 2 },
        t('phase.exercises', lang), t('phase.awaitingSegment', lang));
      expect(line.startsWith('4 ')).toBe(true);
      expect(line).toContain(' · 2 ');
      expect(line).not.toContain('phase.awaitingSegment');
    }
  });
});
