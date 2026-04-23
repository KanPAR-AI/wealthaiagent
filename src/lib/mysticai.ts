/**
 * MysticAI domain detection + configuration.
 *
 * When the app is accessed from astro.yourfinadvisor.com (or localhost with
 * ?mystic=1 for testing), it switches to MysticAI mode:
 *   - Forces astrology_ai agent on new chats
 *   - Applies dark mystic theme overrides
 *   - Shows MysticAI branding instead of YourFinAdvisor
 */

const MYSTIC_HOSTS = ['astro.yourfinadvisor.com', 'mysticai.in', 'www.mysticai.in'];

export const isMysticAI =
  MYSTIC_HOSTS.includes(window.location.hostname) ||
  new URLSearchParams(window.location.search).has('mystic');

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

/** Apply MysticAI dark cosmic theme */
export function applyMysticTheme() {
  if (!isMysticAI) return;
  const root = document.documentElement;
  root.classList.add('dark', 'mystic');

  // Force dark mode
  localStorage.setItem('vite-ui-theme', 'dark');

  // Set CSS variables
  for (const [key, value] of Object.entries(MYSTIC_THEME)) {
    root.style.setProperty(key, value);
  }

  // Override body/app background to deep indigo
  document.body.style.background = '#0a0612';
  document.body.style.color = '#f0e7ff';

  // Inject Cinzel font if not loaded
  if (!document.querySelector('link[href*="Cinzel"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&display=swap';
    document.head.appendChild(link);
  }
}
