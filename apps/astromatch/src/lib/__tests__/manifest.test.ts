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

import { readFileSync as readSource } from 'fs';

import { BADGE_READY_TITLE } from '../badge';
import { capabilities } from '../capabilities';
import {
  BACKEND_HOST_PERMISSION,
  CONNECT_HOSTS,
  CAPTURE_COMMAND,
  SELECTION_COMMAND,
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
    // `activeTab` now carries BOTH page gestures — the capture and the
    // selection injection — and either one alone keeps it earned.
    activeTab: 'snapshot',
    scripting: 'readSelection',
    // PH-40: the menu item's job is "Read this page into AstroMatch" — it is
    // one of the two gestures that grant `activeTab` for a CAPTURE (F159),
    // measured. PH-39 mapped it to `readSelection` because the selection read
    // was the only thing that could have used it then.
    contextMenus: 'snapshot',
    sidePanel: 'signIn',
    storage: 'signIn',
  };

  it('maps every declared permission to a capability', () => {
    expect([...MANIFEST_PERMISSIONS].sort()).toEqual([...Object.keys(USED_BY)].sort());
  });

  it('the list is EMPTY, because every permission now has a capability behind it', () => {
    // PH-41 took the last name off it (`scripting`). Stated as its own case
    // so the emptiness is a claim somebody made, not an absence nobody
    // noticed — the two-directional assertions below still bind.
    expect([...SHIPS_WITH_PH40]).toEqual([]);
    for (const permission of MANIFEST_PERMISSIONS) {
      expect(capabilities[USED_BY[permission]]).toBe(true);
    }
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
    // F301: the camera did NOT widen this. `blob:` is deliberately absent —
    // the crop preview is a <canvas> (not governed by CSP) and the crop that
    // is sent is `canvas.toDataURL`, so `data:` covers the whole path.
    expect(CSP).not.toContain('blob:');
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

  it('declares the capture shortcut ONLY because sw.ts answers it (F159)', () => {
    // docs/73 B5 + ASTRAL-330. `commands.capture` shipped in PH-39's first
    // cut with no `onCommand` listener: Chrome lists it under
    // chrome://extensions/shortcuts, a user presses it, and nothing happens.
    // PH-39 removed it; PH-40 brings it back IN THE SAME COMMIT as the
    // handler. So the pin is not "a commands block exists" — it is "a
    // commands block exists and something listens", which is the property
    // that was actually broken.
    expect(production.commands).toEqual({
      capture: {
        suggested_key: { default: 'Alt+Shift+M' },
        description: 'Capture this page into AstroMatch',
      },
      // PH-41's second gesture, and it ships under the same condition: the
      // `onCommand` branch that honours it is in the same commit.
      selection: {
        suggested_key: { default: 'Alt+Shift+S' },
        description: 'Read my selection into AstroMatch',
      },
    });
    expect(CAPTURE_COMMAND).toBe('capture');
    expect(SELECTION_COMMAND).toBe('selection');

    const sw = readSource(join(__dirname, '..', '..', 'sw.ts'), 'utf8');
    expect(sw).toMatch(/chrome\.commands\.onCommand\.addListener/);
    expect(sw).toMatch(/chrome\.contextMenus\.onClicked\.addListener/);
    for (const name of Object.keys(production.commands)) {
      // every declared command is named in the code that handles commands
      expect(sw).toContain(name);
    }
  });

  it('declares no command the worker does not handle', () => {
    // The other direction: a shortcut added "for later" would have no branch
    // in `onCommand` and would be the same dead affordance again. Asserted
    // per command rather than as one boolean, so a second one cannot ride in
    // on the first one's branch.
    const sw = readSource(join(__dirname, '..', '..', 'sw.ts'), 'utf8');
    const code = sw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const onCommand = code.slice(code.indexOf('chrome.commands.onCommand.addListener'));
    const body = onCommand.slice(0, onCommand.indexOf('\n});'));
    expect(body).toContain('CAPTURE_COMMAND');
    expect(body).toContain('SELECTION_COMMAND');
    expect(Object.keys(production.commands)).toEqual([CAPTURE_COMMAND, SELECTION_COMMAND]);
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
