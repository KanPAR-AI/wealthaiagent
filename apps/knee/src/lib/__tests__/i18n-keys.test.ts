/**
 * Every string the 2026-09-27 asks added must exist in BOTH languages.
 *
 * `t()` returns the KEY when a row is missing, so a Hindi user of a
 * half-translated surface reads "session.keepGoing" on a button. That is the
 * only failure this file is for, and it is the cheapest one to pin: the keys
 * are named here because a pure module (completion-view, session-view,
 * rating-view) chooses them and nothing else would catch the gap.
 */
import { t } from '../i18n';
import { exitHeadlineKey, exitQuietKey, exitPromptKind } from '../completion-view';
import { recipeNote } from '../session-view';
import { RATING_CHOICES, ratingLabelKey } from '../rating-view';

const KEYS = [
  // slice 1 — the "finish it" card
  exitHeadlineKey(7), exitHeadlineKey(0),
  'session.keepGoingBody', 'session.keepGoing',
  'session.saveExit', 'session.discard',
  // B2: the quiet label for BOTH cards — the 1–2 exercise reminder offers no
  // save, so "Discard" would name a choice it is not making.
  exitQuietKey(exitPromptKind(5, 15, false)),
  exitQuietKey(exitPromptKind(1, 15, false)),
  // slice 2 — the shorter-recipe note
  recipeNote('short')!, recipeNote('gentle')!, recipeNote('custom')!,
  // slice 3 — the improvement question
  'rating.q', 'rating.later', 'rating.thanks',
  ...RATING_CHOICES.map(ratingLabelKey),
];

describe('the new copy exists in EN and हिन्दी', () => {
  it.each(KEYS)('%s', (key) => {
    for (const lang of ['en', 'hi'] as const) {
      const out = t(key, lang);
      expect(out).not.toBe(key);       // a missing row returns the key itself
      expect(out.trim().length).toBeGreaterThan(0);
    }
  });

  it('the Hindi copy is actually Hindi, not the English row repeated', () => {
    for (const key of KEYS) {
      expect(t(key, 'hi')).not.toBe(t(key, 'en'));
      expect(t(key, 'hi')).toMatch(/[ऀ-ॿ]/);
    }
  });

  it('the exit headline keeps its placeholders in both languages', () => {
    // The screen fills {done}/{total}/{mins}; a translation that dropped one
    // would render "You’ve done of —".
    for (const lang of ['en', 'hi'] as const) {
      const s = t('session.keepGoingQ', lang);
      expect(s).toContain('{done}');
      expect(s).toContain('{total}');
      expect(s).toContain('{mins}');
    }
    for (const lang of ['en', 'hi'] as const) {
      const s = t('session.partialQ', lang);
      expect(s).toContain('{done}');
      expect(s).toContain('{total}');
    }
  });
});
