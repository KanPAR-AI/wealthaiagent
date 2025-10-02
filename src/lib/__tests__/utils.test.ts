import { cn } from '../utils';

describe('utils', () => {
  describe('cn', () => {
    it('merges class names correctly', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
    });

    it('handles conditional classes', () => {
      const condition1 = true;
      const condition2 = false;
      expect(cn('class1', condition1 && 'class2', condition2 && 'class3')).toBe('class1 class2');
    });

    it('handles undefined and null values', () => {
      expect(cn('class1', undefined, null, 'class2')).toBe('class1 class2');
    });

    it('handles empty strings', () => {
      expect(cn('class1', '', 'class2')).toBe('class1 class2');
    });
  });
});
