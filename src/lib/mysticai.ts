/**
 * MysticAI domain detection + configuration.
 *
 * When the app is accessed from astro.yourfinadvisor.com (or localhost with
 * ?mystic=1 for testing), it switches to MysticAI mode:
 *   - Forces astrology_ai agent on new chats
 *   - Applies dark mystic theme overrides
 *   - Shows MysticAI branding instead of YourFinAdvisor
 *
 * MysticAI mode is **reactive** — components must use ``useIsMysticAI()``
 * instead of the ``isMysticAI`` const so they re-render when the user
 * selects MysticAI from the agent dropdown mid-session. The const remains
 * exported for non-React modules and for the initial render on hostname /
 * query-param mount.
 */

import { useEffect, useState } from 'react';

const MYSTIC_HOSTS = ['astro.yourfinadvisor.com', 'mysticai.in', 'www.mysticai.in'];

function _initialMysticState(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    MYSTIC_HOSTS.includes(window.location.hostname) ||
    new URLSearchParams(window.location.search).has('mystic')
  );
}

// Module-level mutable state + tiny pub/sub so components can subscribe.
let _mysticActive = _initialMysticState();
const _listeners = new Set<() => void>();

function _setMystic(active: boolean) {
  if (_mysticActive === active) return;
  _mysticActive = active;
  for (const fn of _listeners) {
    try { fn(); } catch { /* noop */ }
  }
}

/**
 * Reactive mystic-mode flag. Use this in any React component that needs to
 * conditionally render based on whether MysticAI is active. Re-renders the
 * component when the user toggles MysticAI via the agent selector.
 */
export function useIsMysticAI(): boolean {
  const [state, setState] = useState(_mysticActive);
  useEffect(() => {
    const fn = () => setState(_mysticActive);
    _listeners.add(fn);
    // Also re-sync on mount in case state changed before subscribe.
    setState(_mysticActive);
    return () => { _listeners.delete(fn); };
  }, []);
  return state;
}

/**
 * Backwards-compat: snapshot of mystic state at module-load. Prefer
 * ``useIsMysticAI()`` in React. Remaining callsites that import this
 * directly will be wrong if the user toggles MysticAI mid-session.
 */
export const isMysticAI = _mysticActive;

export const MYSTIC_AGENT = 'astrology_ai';

export const MYSTIC_THEME = {
  '--mystic-bg': '#0a0612',
  '--mystic-card': '#130d1f',
  '--mystic-elevated': '#1a1229',
  '--mystic-border': '#2a1f3d',
  '--mystic-primary': '#8040ff',
  '--mystic-primary-light': '#b794ff',
  '--mystic-accent': '#ffca28',
  '--mystic-text': '#f0e7ff',
  '--mystic-text-secondary': '#a78bcc',
  '--mystic-text-muted': '#6b5a80',
} as const;

/** Apply MysticAI dark cosmic theme.
 *
 * Idempotent. Fires the reactive ``useIsMysticAI`` hook so components like
 * ``CosmicBackground`` mount when the user toggles MysticAI from the agent
 * selector mid-session.
 *
 * The ``forceActivate`` flag overrides the URL/host check so the user can
 * opt-in to MysticAI by selecting the agent from the dropdown anywhere.
 */
export function applyMysticTheme(forceActivate: boolean = true) {
  // Allow explicit activation regardless of hostname (so the dropdown works
  // on the main yourfinadvisor.com domain too). The const ``isMysticAI`` is
  // already true when on the astro subdomain.
  if (!forceActivate && !isMysticAI) return;

  const root = document.documentElement;
  root.classList.add('dark', 'mystic');

  // Force dark mode
  try { localStorage.setItem('vite-ui-theme', 'dark'); } catch { /* noop */ }

  // Set CSS variables
  for (const [key, value] of Object.entries(MYSTIC_THEME)) {
    root.style.setProperty(key, value);
  }

  // Body background stays transparent — the <CosmicBackground /> component
  // renders a fixed, full-viewport starfield + nebula behind the app.
  // We only set a solid fallback in case the canvas fails to mount.
  document.body.style.background = '#060210';
  document.body.style.color = '#f0e7ff';

  // Inject Cinzel font if not loaded
  if (!document.querySelector('link[href*="Cinzel"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&display=swap';
    document.head.appendChild(link);
  }

  // Notify React subscribers so <CosmicBackground />, <ChatEmptyState />,
  // <Logo />, etc. re-render with the cosmic UI.
  _setMystic(true);
}

/** Tear down MysticAI cosmic theme — used when switching to a different
 * agent from the dropdown. Fires the reactive hook so the cosmic UI unmounts.
 */
export function revertMysticTheme() {
  const root = document.documentElement;
  root.classList.remove('mystic');
  // Don't drop 'dark' — the user may have intentionally chosen dark mode.
  for (const key of Object.keys(MYSTIC_THEME)) {
    root.style.removeProperty(key);
  }
  document.body.style.background = '';
  document.body.style.color = '';
  _setMystic(false);
}
