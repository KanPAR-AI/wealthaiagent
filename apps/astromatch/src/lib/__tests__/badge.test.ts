/**
 * docs/73 ASTRAL-322 — the badge says "I could help here" and never
 * "I have looked".
 *
 * The row's own verification: "the badge function's only argument is a URL
 * string and the module imports nothing that could read a DOM."
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { BADGE_IDLE_TITLE, BADGE_READY_TITLE, badgeFor } from '../badge';

describe('what the badge can be asked', () => {
  it.each([
    'https://example.com/profile/12345',
    'http://localhost:5173/',
    'https://example.co.in/search?q=a%20name',
    'file:///Users/someone/a-biodata.html',
  ])('offers to help on %s', (url) => {
    expect(badgeFor(url)).toEqual({ enabled: true, title: BADGE_READY_TITLE });
  });

  it.each([
    'chrome://extensions',
    'chrome-extension://abcdef/panel.html',
    'about:blank',
    'devtools://devtools/bundled/inspector.html',
    'data:text/html,hello',
    '',
    null,
    undefined,
    'not a url at all',
  ])('stays out of the way on %p', (url) => {
    expect(badgeFor(url as string)).toEqual({ enabled: false, title: BADGE_IDLE_TITLE });
  });

  it('never claims to have read anything', () => {
    for (const title of [BADGE_READY_TITLE, BADGE_IDLE_TITLE]) {
      expect(title).not.toMatch(/read this page|found|detected|profile detected|I see/i);
    }
  });
});

describe('the module', () => {
  const src = readFileSync(join(__dirname, '..', 'badge.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('imports nothing at all', () => {
    expect(src).not.toMatch(/^import /m);
  });

  it('cannot read a page, a tab or a network', () => {
    expect(src).not.toMatch(/\bchrome\./);
    expect(src).not.toMatch(/\bdocument\b/);
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/executeScript|captureVisibleTab/);
  });

  it('names no site — there is no host list to go stale (X-3)', () => {
    for (const site of ['shaadi', 'jeevansathi', 'matrimony', 'bharat', 'jodi']) {
      expect(src.toLowerCase()).not.toContain(site);
    }
  });
});
