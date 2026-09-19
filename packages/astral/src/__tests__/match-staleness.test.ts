/**
 * docs/73 PH-41 FLAG-2 — one sentence about a stale MATCH, and it blames
 * nobody.
 *
 * The match payload carries `fresh | stale | unprovable` and NO causes. The
 * stamp behind that word covers the inputs hash, the function version and the
 * calculation settings (`services/derived_state.py`), so a version bump makes
 * every stored match stale with nobody's details touched — the state of a
 * real account today, gun milan being at v4. ASTRAL-238 exists because this
 * exact blame was once said falsely on the chart surfaces; these cases keep
 * it off the match surfaces.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

import {
  UNATTRIBUTED_MATCH_CLAUSE,
  UNATTRIBUTED_RECORD_CLAUSE,
  matchStaleSentence,
} from '../match-staleness';

const WORKSPACE = join(__dirname, '..', '..', '..', '..');
const AT = '2026-08-24T17:44:41.474626+00:00';

describe('the sentence', () => {
  it('says WHEN it was scored and that it may be out of date', () => {
    const sentence = matchStaleSentence({ freshness: 'stale', computedAt: AT, scored: true })!;
    expect(sentence).toContain('24 Aug 2026');
    expect(sentence).toContain(UNATTRIBUTED_MATCH_CLAUSE);
    expect(sentence).toContain('may be out of date');
  });

  it('names no cause — not the user, not the settings, not the engine', () => {
    const sentence = matchStaleSentence({ freshness: 'stale', computedAt: AT, scored: true })!;
    for (const blame of [
      'birth detail',
      'birth fact',
      'you changed',
      'your details',
      'settings changed',
      'improved the engine',
    ]) {
      expect(sentence.toLowerCase()).not.toContain(blame);
    }
  });

  it('speaks of a RECORD, not of numbers, when there are none', () => {
    const sentence = matchStaleSentence({ freshness: 'stale', computedAt: AT, scored: false })!;
    expect(sentence).toContain(UNATTRIBUTED_RECORD_CLAUSE);
    expect(sentence).not.toContain('numbers');
  });

  it('drops the date clause rather than printing an empty one', () => {
    const sentence = matchStaleSentence({ freshness: 'stale', computedAt: null, scored: true })!;
    expect(sentence).not.toContain(' on ,');
    expect(sentence).not.toContain('undefined');
    expect(sentence).toContain('may be out of date');
  });

  it('treats `unprovable` as its own fact, never as an observed change', () => {
    const scored = matchStaleSentence({ freshness: 'unprovable', computedAt: AT, scored: true })!;
    expect(scored).toContain('before we recorded');
    expect(scored).not.toContain(UNATTRIBUTED_MATCH_CLAUSE);
    const unscored = matchStaleSentence({ freshness: 'unprovable', computedAt: AT, scored: false })!;
    expect(unscored).toContain('before we kept a note');
  });

  it('says nothing when the record is fresh, or when the word is unknown', () => {
    expect(matchStaleSentence({ freshness: 'fresh', computedAt: AT, scored: true })).toBeNull();
    expect(matchStaleSentence({ freshness: null, computedAt: AT, scored: true })).toBeNull();
    expect(matchStaleSentence({ freshness: 'something_new', computedAt: AT, scored: true })).toBeNull();
  });
});

describe('ONE owner — nothing outside this module words it', () => {
  const SKIP = new Set(['node_modules', 'dist', 'build', 'coverage', 'ios', 'android', '.expo']);

  function walk(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return out;
    }
    for (const entry of entries) {
      if (SKIP.has(entry)) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.tsx?$/.test(entry)) out.push(full);
    }
    return out;
  }

  const rel = (f: string) => relative(WORKSPACE, f).split(sep).join('/');
  const isTest = (f: string) => /__tests__|\.test\.tsx?$/.test(f);
  const codeOf = (f: string) =>
    readFileSync(f, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  const ROOTS = ['packages', 'apps', 'src']
    .map((r) => join(WORKSPACE, r))
    .filter((r) => {
      try {
        return statSync(r).isDirectory();
      } catch {
        return false;
      }
    });
  const FILES = ROOTS.flatMap((r) => walk(r)).filter((f) => !isTest(f));

  it('found the workspace', () => {
    expect(FILES.length).toBeGreaterThan(100);
    expect(FILES.map(rel)).toContain('packages/astral/src/match-staleness.ts');
  });

  /**
   * MATCH surfaces only, and the scope is the point.
   *
   * `apps/astro/src/lib/profile-view.ts` carries the same blame about a
   * CHART ("Cast …, before a birth detail changed"). That is a different
   * artifact on a different surface: chart payloads carry `stale.causes` and
   * `apps/astro/src/lib/staleness.ts` is their owner, so whether that
   * sentence is earned is a question for ASTRAL-238's chart half. It is
   * deliberately NOT touched here — it is another agent's uncommitted file —
   * and it is reported rather than silently included in this grep.
   */
  const MATCH_SURFACE = /MatchRow|MatchDetail|MatchReportPayload|MatchRowWire|MatchDetailWire/;
  const matchFiles = FILES.filter((f) => MATCH_SURFACE.test(codeOf(f)));

  it('found the match surfaces', () => {
    const named = matchFiles.map(rel);
    expect(named).toContain('apps/astro/src/lib/matches-view.ts');
    expect(named).toContain('apps/astro/src/lib/match-detail-view.ts');
    expect(named).toContain('apps/astromatch/src/lib/shortlist-view.ts');
    expect(named).toContain('apps/astromatch/src/lib/compare-view.ts');
  });

  it('no MATCH surface blames a birth detail for a stale record any more', () => {
    // The three sentences this replaced, by their distinguishing words.
    const offenders = matchFiles
      .filter((f) => {
        const code = codeOf(f);
        return (
          /before a birth detail changed/.test(code) ||
          /A birth detail has changed since this was scored/.test(code) ||
          /A birth fact on one side has changed since this was scored/.test(code)
        );
      })
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('every match surface takes its sentence from THIS module', () => {
    // The other direction: a surface that stopped saying the false thing by
    // writing a fourth true thing of its own would pass the grep above.
    for (const owner of [
      'apps/astro/src/lib/matches-view.ts',
      'apps/astro/src/lib/match-detail-view.ts',
      'apps/astromatch/src/lib/shortlist-view.ts',
      'apps/astromatch/src/lib/compare-view.ts',
    ]) {
      expect(codeOf(join(WORKSPACE, owner))).toContain('matchStaleSentence');
    }
  });

  it('the grep would actually catch one', () => {
    const sample = "return 'A birth detail has changed since this was scored.';";
    expect(sample).toMatch(/A birth detail has changed since this was scored/);
  });
});
