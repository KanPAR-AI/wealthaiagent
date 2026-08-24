/** F26 — the display serif is a bundled asset, never a silent substitution.
 *
 *  The board's wordmark is a high-contrast serif. React Native does not do
 *  fallback stacks: an unknown fontFamily silently becomes the platform
 *  default, which is exactly how a brand face disappears without anyone
 *  noticing. So the suite, not the OS, is what fails when the asset is
 *  missing or the wiring drifts.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../../..');

// The web app's Docker image bakes `npm run test:ci` with a context that
// EXCLUDES apps/ (.dockerignore) — there is nothing for a workspace scan to
// guard there, and ENOENT failed four deploys in a row (2026-08-24). The
// suite binds wherever the workspace is real: local, CI checkout, and the
// cloudbuild test step all have apps/, and the anti-vacuity assertions
// (the walk must FIND the astro files) still hold there. Skip — with the
// reason on the record — only when the directory itself is absent.

const astro = (...p: string[]) => path.join(ROOT, 'apps/astro', ...p);

const APPS_PRESENT = fs.existsSync(path.join(ROOT, 'apps'));
(APPS_PRESENT ? describe : describe.skip)('the astro display serif (F26)', () => {
  it('ships the font file, with its licence beside it', () => {
    const font = astro('assets/fonts/PlayfairDisplay.ttf');
    expect(fs.existsSync(font)).toBe(true);
    // A real TrueType file, not an LFS pointer or an HTML error page.
    const head = fs.readFileSync(font).subarray(0, 4);
    const tags = [head.toString('latin1'), head.readUInt32BE(0)];
    expect(
      tags[0] === 'true' || tags[0] === 'OTTO' || tags[1] === 0x00010000,
    ).toBe(true);
    expect(fs.statSync(font).size).toBeGreaterThan(100_000);
    expect(fs.existsSync(astro('assets/fonts/OFL-PlayfairDisplay.txt'))).toBe(true);
  });

  it('is the family the token module names, loaded under that exact key', () => {
    const brands = fs.readFileSync(astro('src/theme/brands.ts'), 'utf8');
    const layout = fs.readFileSync(astro('src/app/_layout.tsx'), 'utf8');
    const m = brands.match(/fontFamily:\s*'([^']+)'/);
    expect(m).not.toBeNull();
    const family = m![1];
    expect(family).toBe('PlayfairDisplay');
    // useFonts({ <family>: require(...PlayfairDisplay.ttf) }) — the key IS
    // the family name; a drift here is the silent-substitution failure.
    expect(layout).toContain(`${family}: require(`);
    expect(layout).toContain("assets/fonts/PlayfairDisplay.ttf");
  });
});
