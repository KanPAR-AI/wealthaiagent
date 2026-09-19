/**
 * docs/73 ASTRAL-322 — the manifest is §2, and every permission has a reason.
 *
 * The permission set is asserted IN BOTH DIRECTIONS against the reason map:
 * a permission cannot be added without writing down why, and a reason cannot
 * outlive the permission it explains. That is the whole mechanism by which
 * "minimal permissions" stays true after the fourth change rather than only
 * on the day of the store submission.
 *
 * It reads the built `dist/manifest.json` when there is one, so the test
 * covers what Chrome would actually load and not only the source value.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { BADGE_READY_TITLE } from '../badge';
import { capabilities } from '../capabilities';
import {
  BACKEND_HOST_PERMISSION,
  CONNECT_HOSTS,
  CSP,
  cspFor,
  DEV_HOST_PERMISSION,
  MANIFEST_PERMISSIONS,
  PERMISSION_REASONS,
  SHIPS_WITH_PH40,
  buildManifest,
} from '../manifest';

const APP = join(__dirname, '..', '..', '..');
const production = buildManifest('production');

describe('the permission set and the reasons are the same set', () => {
  it('every permission has a reason', () => {
    expect([...production.permissions].sort()).toEqual([...Object.keys(PERMISSION_REASONS)].sort());
  });

  it('every reason is a sentence, not a placeholder', () => {
    for (const [permission, reason] of Object.entries(PERMISSION_REASONS)) {
      expect(reason.length).toBeGreaterThan(40);
      expect(reason).not.toMatch(/TODO|TBD|later/i);
      expect(permission).not.toBe('');
    }
  });

  it('is exactly the five §2 names', () => {
    expect([...MANIFEST_PERMISSIONS].sort()).toEqual([
      'activeTab',
      'contextMenus',
      'scripting',
      'sidePanel',
      'storage',
    ]);
  });
});

describe('B5 — a permission declared ahead of its capability is on a list, and the list is asserted', () => {
  /**
   * The map from a permission to the capability that will USE it. A
   * permission with no capability behind it is exactly what a store review
   * reads first, so "we will need it later" has to be written down and
   * checked from both directions rather than left in a comment.
   */
  const USED_BY: Record<string, keyof typeof capabilities> = {
    activeTab: 'snapshot',
    scripting: 'readSelection',
    contextMenus: 'readSelection',
    sidePanel: 'signIn',
    storage: 'signIn',
  };

  it('maps every declared permission to a capability', () => {
    expect([...MANIFEST_PERMISSIONS].sort()).toEqual([...Object.keys(USED_BY)].sort());
  });

  it('every permission whose capability is FALSE is on the PH-40 list', () => {
    const unused = MANIFEST_PERMISSIONS.filter((p) => capabilities[USED_BY[p]] === false).sort();
    expect(unused).toEqual([...SHIPS_WITH_PH40].sort());
  });

  it('every name on the PH-40 list is really in the manifest, and really unused', () => {
    for (const permission of SHIPS_WITH_PH40) {
      expect(production.permissions).toContain(permission);
      expect(capabilities[USED_BY[permission]]).toBe(false);
    }
  });

  it('a permission whose capability turns TRUE must come off the list', () => {
    // The anti-vacuity half: if PH-40 flips `snapshot` and nobody edits
    // SHIPS_WITH_PH40, the assertion above goes red rather than quietly
    // keeping a stale list.
    const stale = SHIPS_WITH_PH40.filter((p) => capabilities[USED_BY[p]] === true);
    expect(stale).toEqual([]);
  });
});

describe('the absences, each of which is load-bearing', () => {
  it('declares no `content_scripts` — nothing is injected at document load', () => {
    expect('content_scripts' in production).toBe(false);
  });

  it('asks for no `tabs`, no `identity`, no `cookies`, no request interception', () => {
    for (const banned of [
      'tabs',
      'identity',
      'cookies',
      'webRequest',
      'declarativeNetRequest',
      '<all_urls>',
      'history',
      'bookmarks',
    ]) {
      expect(production.permissions).not.toContain(banned);
    }
  });

  it('names ONE host, and it is our own backend', () => {
    expect(production.host_permissions).toEqual([BACKEND_HOST_PERMISSION]);
    expect(BACKEND_HOST_PERMISSION).toBe('https://chatbackend.yourfinadvisor.com/*');
  });

  it('names no matrimonial site anywhere in the manifest', () => {
    // X-2/X-3: the product works with ZERO site adapters, because none
    // exist. A host here would be the first one.
    const text = JSON.stringify(production).toLowerCase();
    for (const site of ['shaadi', 'jeevansathi', 'bharatmatrimony', 'matrimony', 'jodi']) {
      expect(text).not.toContain(site);
    }
  });

  it('allows no remote code, and states the whole policy as a literal', () => {
    expect(production.content_security_policy.extension_pages).toBe(CSP);
    expect(CSP).toBe(
      "default-src 'self'; " +
        "script-src 'self'; " +
        "object-src 'self'; " +
        "img-src 'self' data:; " +
        "style-src 'self' 'unsafe-inline'; " +
        'connect-src https://chatbackend.yourfinadvisor.com ' +
        'https://identitytoolkit.googleapis.com https://securetoken.googleapis.com',
    );
  });

  it('names every host the WORKER talks to, and no other', () => {
    // A host permission does not bypass the extension CSP, so a missing
    // `connect-src` host is a sign-in that fails with a console error and no
    // sentence. These three are `config.apiUrl`'s host and `auth.ts`'s two.
    const connect = /connect-src ([^;]+)/.exec(CSP)![1].trim().split(/\s+/);
    expect(connect).toEqual([...CONNECT_HOSTS]);
    expect(connect).toContain(BACKEND_HOST_PERMISSION.replace('/*', ''));
  });

  it('loads no remote image, font, frame or stylesheet', () => {
    expect(CSP).toContain("default-src 'self'");
    expect(CSP).toContain("img-src 'self' data:");
    // the one thing the panel genuinely needs, and it is scoped
    expect(CSP).toContain("style-src 'self' 'unsafe-inline'");
    expect(CSP).not.toContain('https://*');
    expect(CSP).not.toContain("'unsafe-eval'");
    expect(CSP).not.toMatch(/script-src[^;]*unsafe/);
  });

  it('the DEV policy adds localhost to connect-src and nothing else', () => {
    const dev = cspFor('development');
    expect(dev).toBe(CSP.replace(
      'connect-src https://chatbackend.yourfinadvisor.com',
      'connect-src https://chatbackend.yourfinadvisor.com',
    ) + ' http://localhost:8080');
    expect(dev.replace(' http://localhost:8080', '')).toBe(CSP);
  });
});

describe('the dev build differs by exactly one host, and says so in its name', () => {
  const dev = buildManifest('development');

  it('adds localhost and nothing else', () => {
    expect(dev.host_permissions).toEqual([BACKEND_HOST_PERMISSION, DEV_HOST_PERMISSION]);
    expect(dev.permissions).toEqual(production.permissions);
  });

  it('is visibly a dev build in the browser\'s own extension list', () => {
    expect(dev.name).toContain('dev');
    expect(production.name).not.toContain('dev');
  });
});

describe('the toolbar says one thing, from one place', () => {
  it('takes its title from `badge.ts`, which is where that decision lives', () => {
    expect(production.action.default_title).toBe(BADGE_READY_TITLE);
  });

  it('never claims to have looked at the page', () => {
    expect(production.action.default_title).not.toMatch(/read|found|detected|profile/i);
  });
});

describe('the shell Chrome will actually load', () => {
  it('opens as a side panel, never as an injected overlay', () => {
    expect(production.side_panel.default_path).toBe('panel.html');
    expect(production.background).toEqual({ service_worker: 'sw.js', type: 'module' });
    expect(Number(production.minimum_chrome_version)).toBeGreaterThanOrEqual(116);
  });

  it('declares NO keyboard command — a shortcut with nothing behind it is a dead affordance', () => {
    // docs/73 B5. `commands.capture` (Alt+Shift+M) shipped in PH-39's first
    // cut with no `onCommand` listener: Chrome lists it under
    // chrome://extensions/shortcuts, a user presses it, and nothing happens.
    // F159's fallback returns in PH-40, in the same commit as the capture it
    // triggers.
    expect('commands' in production).toBe(false);
  });
});

describe('the BUILT manifest is the one asserted above', () => {
  const built = join(APP, 'dist', 'manifest.json');

  it('matches the source value when a build exists', () => {
    if (!existsSync(built)) {
      // Not a silent pass: the assertions above still bind on the value the
      // build writes, and `npm run build` regenerates this file from the
      // same module. Stated so a green run here is never read as "the built
      // extension was checked".
      console.warn('[manifest.test] no dist/manifest.json — run `npm run build` in apps/astromatch');
      return;
    }
    const onDisk = JSON.parse(readFileSync(built, 'utf8'));
    const mode = String(onDisk.name).includes('dev') ? 'development' : 'production';
    expect(onDisk).toEqual(buildManifest(mode as 'development' | 'production'));
  });
});
