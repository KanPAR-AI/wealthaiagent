/**
 * The toolbar badge — computed from the tab's URL and NOTHING else
 * (docs/73 ASTRAL-322).
 *
 * Two rules, and both are about honesty rather than styling:
 *
 *  1. **The URL is the only input.** This module imports nothing, touches no
 *     DOM, makes no request and is handed a string. That is what lets the
 *     row's negative space — "loads a matrimonial page without clicking: the
 *     extension did nothing" — be true by construction instead of by audit.
 *
 *  2. **It may say "I could help here"; it may never say "I have looked."**
 *     The extension has not read the page and will not until the user's own
 *     gesture. A badge that implied otherwise would be a lie told in one word.
 *
 * There is deliberately NO site list. X-3 rules site adapters out of scope, so
 * there is no host to match and no site name anywhere in this bundle. The only
 * question this can honestly answer is whether the page is one the user could
 * point us at at all.
 */

export interface BadgeState {
  /** may the user invoke a capture on this tab? */
  enabled: boolean;
  /** the tooltip, which never claims we read anything */
  title: string;
}

/** Pages Chrome refuses to let any extension read, gesture or not. */
const READABLE_SCHEMES = ['http:', 'https:', 'file:'];

export const BADGE_READY_TITLE = 'Check this match';
export const BADGE_IDLE_TITLE = 'AstroMatch — open on a web page to read one';

export function badgeFor(url: string | null | undefined): BadgeState {
  const scheme = schemeOf(url);
  if (!scheme || !READABLE_SCHEMES.includes(scheme)) {
    return { enabled: false, title: BADGE_IDLE_TITLE };
  }
  return { enabled: true, title: BADGE_READY_TITLE };
}

/**
 * The scheme, or null when the string is not a URL at all.
 *
 * `URL` is a WHATWG global, present in the service worker, in a panel
 * document and in the jest environment — it is not a DOM API and it reads
 * nothing.
 */
function schemeOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol;
  } catch {
    // A tab with no URL yet (a brand-new tab) is not an error and not a
    // page we could read. Handled, not swallowed.
    return null;
  }
}
