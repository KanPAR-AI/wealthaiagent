/**
 * X-2 / X-3 / ASTRAL-338's negative space — there is no site adapter, and the
 * BUILT BUNDLE is where that has to be true.
 *
 * `panel-render.test.tsx` already greps the source for four site names. This
 * file is the stronger version the selection row asks for, and it exists
 * because the source is not what Chrome runs:
 *
 *   · the SOURCE is grepped for hostnames, for the shapes a site adapter
 *     takes (a hostname switch, a per-site selector map) and for DOM reads
 *     outside the one injected function;
 *   · the BUILT `dist/` is grepped for the same hostnames, because a site
 *     map could arrive through a dependency, a generated file or a build
 *     step, none of which the source grep can see.
 *
 * The dist half SKIPS with a printed reason when there is no build (CI runs
 * the tests without one). It is never a silent pass: the warning names the
 * command, and the source half still binds.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const APP = join(__dirname, '..', '..', '..');
const SRC = join(APP, 'src');
const DIST = join(APP, 'dist');

/**
 * The names. Lower-cased on both sides, so `Shaadi` and `SHAADI` are the
 * same finding — and `jodi` is in the list on purpose even though it is a
 * common word: a false positive here costs one conversation and a missed one
 * costs the single-purpose declaration.
 */
const SITE_NAMES = [
  'shaadi',
  'jeevansathi',
  'jeevansaathi',
  'bharatmatrimony',
  'matrimony',
  'matrimonial',
  'jodi',
  'simplymarry',
];

/**
 * Words that are NOT on the list, and why the list stops where it does.
 *
 * `hinge`, `bumble` and `tinder` were tried and removed: `hinge` matches
 * "the sentence hinges on", which is a grep firing on English rather than on
 * a site adapter. The product is Kundli Milan on a matrimonial page, so the
 * list is the matrimonial names — the ones whose presence would actually
 * change what this extension is.
 */

function walk(dir: string, match: RegExp, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, match, out);
    else if (match.test(entry)) out.push(full);
  }
  return out;
}

/** comments stripped: this app documents what it refuses to do, by name. */
function codeOf(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/**
 * TESTS ARE EXCLUDED, and that is not a hole.
 *
 * This file, `panel-render.test.tsx` and the walk all NAME the sites they
 * forbid — that is what a negative assertion looks like — and a grep that
 * fired on its own test corpus would be deleted within a week. What ships is
 * the non-test source and the bundle below, and both are grepped whole.
 */
const isTest = (f: string) => /__tests__|\.test\.tsx?$/.test(f);
const SOURCES = walk(SRC, /\.tsx?$/).filter((f) => !isTest(f));

/**
 * The one file that may touch a document by id, named with its reason.
 *
 * `main.tsx` mounts the panel into `panel.html`'s own `#root`. It is this
 * extension's document, it never runs in anybody's page, and there is no
 * path by which it could: the injected function is the only thing that ever
 * executes in a page, and it is three lines long (`selection.test.ts`).
 */
const MOUNTS_OUR_OWN_DOCUMENT = 'src/panel/main.tsx';

describe('the source names no site and adapts to none', () => {
  it('found the source tree', () => {
    // anti-vacuity: a walk that found nothing would make every grep below
    // pass while proving nothing.
    expect(SOURCES.length).toBeGreaterThan(15);
    expect(SOURCES.map((f) => f.replace(`${APP}/`, ''))).toContain('src/lib/selection.ts');
  });

  it.each(SOURCES.map((f) => f.replace(`${APP}/`, '')))('%s names no site', (rel) => {
    const code = codeOf(join(APP, rel)).toLowerCase();
    for (const site of SITE_NAMES) {
      expect(code).not.toContain(site);
    }
  });

  it.each(SOURCES.map((f) => f.replace(`${APP}/`, '')))('%s branches on no hostname', (rel) => {
    const code = codeOf(join(APP, rel));
    // The shape of an adapter: reading where the user is, and deciding.
    expect(code).not.toMatch(/location\.(hostname|host)\b/);
    expect(code).not.toMatch(/\.hostname\b/);
    expect(code).not.toMatch(/new URL\([^)]*\)\.host/);
    expect(code).not.toMatch(/tab\??\.url/);
  });

  it.each(SOURCES.map((f) => f.replace(`${APP}/`, '')))('%s keeps no selector map', (rel) => {
    const code = codeOf(join(APP, rel));
    expect(code).not.toContain('querySelector');
    expect(code).not.toContain('getElementsByClassName');
    if (rel !== MOUNTS_OUR_OWN_DOCUMENT) {
      expect(code).not.toMatch(/document\.getElementById\(/);
    } else {
      // …and the exemption is exactly one id, in our own document.
      expect(code).toContain("document.getElementById('root')");
      expect((code.match(/getElementById/g) ?? []).length).toBe(1);
    }
    // `[itemprop=…]`, `.profile-details`, `#birth-date` — a selector is a
    // string that only makes sense against one site's markup.
    expect(code).not.toMatch(/'\[[a-z-]+[=~^$*]/i);
  });

  it('the greps would actually catch an adapter', () => {
    // The row's own anti-vacuity sample, verbatim shapes.
    const sample = "if (location.hostname.includes('shaadi')) return document.querySelector('.dob');";
    expect(sample).toMatch(/location\.(hostname|host)\b/);
    expect(sample).toContain('querySelector');
    expect(sample.toLowerCase()).toContain('shaadi');
  });
});

describe('the BUILT bundle names no site either', () => {
  const built = existsSync(DIST) ? walk(DIST, /\.(js|json|html|css)$/) : [];

  it('was built, or says why it was not', () => {
    if (!built.length) {
      // Stated, never silent: a green run here must not be read as "the
      // shipped bundle was checked".
      console.warn(
        '[no-site-adapters.test] no dist/ — run `npm run build` in apps/astromatch ' +
          'to grep the bundle Chrome actually loads',
      );
      return;
    }
    // The bundle is real: the worker, the panel and the manifest at least.
    expect(built.length).toBeGreaterThan(2);
    expect(built.some((f) => f.endsWith('manifest.json'))).toBe(true);
    expect(built.some((f) => f.endsWith('sw.js'))).toBe(true);
  });

  it('carries no site name anywhere in it', () => {
    if (!built.length) return; // reported above
    for (const file of built) {
      const text = readFileSync(file, 'utf8').toLowerCase();
      for (const site of SITE_NAMES) {
        expect({ file: file.replace(`${APP}/`, ''), site, hit: text.includes(site) }).toEqual({
          file: file.replace(`${APP}/`, ''),
          site,
          hit: false,
        });
      }
    }
  });

  it('asks for no host but our own backend', () => {
    if (!built.length) return; // reported above
    const manifest = built.find((f) => f.endsWith('manifest.json'));
    expect(manifest).toBeDefined();
    const hosts: string[] = JSON.parse(readFileSync(manifest as string, 'utf8')).host_permissions;
    for (const host of hosts) {
      expect(host).toMatch(/chatbackend\.yourfinadvisor\.com|localhost:8080/);
    }
  });
});
