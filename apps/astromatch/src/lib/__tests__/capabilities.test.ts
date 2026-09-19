/**
 * `apps/astro`'s law, inherited: a capability marked absent REMOVES its
 * control, and every `false` carries its reason (doctrine 8).
 *
 * The test that makes the rule real is the second one: a `false` with no
 * reason written next to it fails the build. A capability map that lies is
 * worse than a missing screen.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { capabilities } from '../capabilities';

const SRC = readFileSync(join(__dirname, '..', 'capabilities.ts'), 'utf8');

describe('what this build says it can do', () => {
  it('is honest about PH-41: the selection read, the shortlist, compare and the per-match chat join them', () => {
    expect(capabilities).toEqual({
      signIn: true,
      manualEntry: true,
      paste: true,
      snapshot: true,
      readSelection: true,
      shortlist: true,
      compare: true,
      saveMatch: true,
      matchChat: true,
    });
  });

  it('every TRUE carries the row it was built for, so the map cannot drift into a wish list', () => {
    // The companion to "every false carries a reason". With PH-41 there is
    // no `false` left, so that assertion is vacuous for the first time —
    // said out loud rather than left to look like coverage. What still binds
    // is that each capability names the ASTRAL row that built it, which is
    // what a reviewer checks the map against.
    expect(Object.values(capabilities).filter((v) => v === false)).toEqual([]);
    for (const name of Object.keys(capabilities)) {
      const at = SRC.search(new RegExp(`\\n\\s*${name}:\\s*boolean;`));
      expect(at).toBeGreaterThan(-1);
      const comment = SRC.slice(0, at);
      const reason = comment.slice(comment.lastIndexOf('/**'));
      expect(reason).toMatch(/ASTRAL-\d+|PH-\d+/);
    }
  });

  it('every false carries a reason in the source', () => {
    for (const [name, value] of Object.entries(capabilities)) {
      if (value) continue;
      // the doc comment immediately above the field in the interface
      const declaration = new RegExp(`\\*/\\s*\\n\\s*${name}:\\s*boolean;`);
      expect(SRC).toMatch(declaration);
      const comment = SRC.slice(0, SRC.search(new RegExp(`\\n\\s*${name}:\\s*boolean;`)));
      const lastBlock = comment.lastIndexOf('/**');
      const reason = comment.slice(lastBlock);
      expect(reason.length).toBeGreaterThan(80);
      expect(reason).toMatch(/FALSE:/);
    }
  });

  it('never says "coming soon" in CODE — an absent capability removes its control', () => {
    // Comments stripped first: the header legitimately quotes the banned
    // phrase while stating the rule, and a grep that tripped on its own
    // documentation would teach people to delete the documentation. The
    // same phrase is forbidden in the panel's user-facing copy by
    // `panel-render.test.tsx`, which is where copy actually lives.
    const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/coming soon|next update will|stay tuned/i);
  });
});
