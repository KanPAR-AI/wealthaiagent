/**
 * docs/73 B4 — hiding the scorecard's PROSE FALLBACK, and never anything else.
 *
 * Both `.sse` files next door were captured from the running engine on
 * 2026-09-19 with PH-38 live: a complete `/36` reading and a reduced
 * `15 of 15 firm points, 21 pending` one. The deterministic section they both
 * carry is `graph.py` ~:13203-13232 — a heading, an optional italic note, a
 * `**Moon signs:**` line and the koota table — and it exists for clients that
 * cannot draw the `match_report` block (docs/49 ASTRAL-90). A client that DID
 * draw it is showing the same eight rows twice.
 *
 * The property that matters more than the removal: **everything else is
 * byte-for-byte what the engine sent.** A function that trims a reading is
 * one bad regex away from deleting a paragraph of somebody's reading, so the
 * fail-open cases below outnumber the removal ones.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { withoutScorecardFallback } from '../scorecard-fallback';

const FIXTURES = join(__dirname, 'fixtures');

function assistantText(file: string): string {
  return readFileSync(join(FIXTURES, file), 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => {
      try {
        return JSON.parse(line.slice(6));
      } catch {
        return null;
      }
    })
    .filter((e) => e && e.type === 'message_delta')
    .map((e) => e.delta as string)
    .join('');
}

const COMPLETE = assistantText('synastry-complete-36.sse');
const REDUCED = assistantText('synastry-reduced-15-21.sse');

describe('the fixtures are the shapes this is about', () => {
  it('the complete reading carries the /36 heading and the table', () => {
    expect(COMPLETE).toMatch(/^### Kundli Milan — 26 \/ 36 \(very good\)$/m);
    expect(COMPLETE).toContain('| Koota | Score | What it reads |');
    expect(COMPLETE).toContain('**Moon signs:**');
  });

  it('the reduced reading carries the firm/pending heading and its note', () => {
    expect(REDUCED).toMatch(/^### Kundli Milan — 15 of 15 firm points, 21 pending$/m);
    expect(REDUCED).toMatch(/^\*A birth time is missing, so the four nakshatra-based/m);
    expect(REDUCED).toContain('| Tara | pending |');
  });

  it('there is no Hindi variant of this section to handle', () => {
    // Checked in `graph.py`: both branches build the SAME English heading —
    // `### Kundli Milan …` — and there is no Devanagari alternative for it,
    // unlike the ask copy, which has one per string. Recorded rather than
    // assumed, because "handle the Hindi variant" was on the instruction.
    expect(COMPLETE).not.toMatch(/###\s+[ऀ-ॿ]/);
    expect(REDUCED).not.toMatch(/###\s+[ऀ-ॿ]/);
  });
});

describe('a client that DREW the block hides the fallback', () => {
  it.each([
    ['the complete reading', COMPLETE],
    ['the reduced reading', REDUCED],
  ])('%s loses the heading, the moon line and the table', (_label, text) => {
    const out = withoutScorecardFallback(text, true);
    expect(out).not.toContain('### Kundli Milan');
    expect(out).not.toContain('**Moon signs:**');
    expect(out).not.toContain('| Koota | Score | What it reads |');
    expect(out).not.toContain('|---|---|---|');
  });

  it('the reduced reading loses its italic note too — it is part of the section', () => {
    expect(withoutScorecardFallback(REDUCED, true)).not.toContain(
      'A birth time is missing, so the four nakshatra-based',
    );
  });

  it.each([
    ['the complete reading', COMPLETE],
    ['the reduced reading', REDUCED],
  ])('%s keeps every other line byte for byte', (_label, text) => {
    const out = withoutScorecardFallback(text, true);
    const removed = text.split('\n').filter((line) => !out.split('\n').includes(line));
    // everything removed belongs to the section, and nothing else does
    for (const line of removed) {
      const belongs =
        line.trim() === '' ||
        /^#{2,4}\s+Kundli Milan/.test(line) ||
        /^\*\*Moon signs:\*\*/.test(line) ||
        /^\s*\|/.test(line) ||
        /^\*A birth time is missing/.test(line);
      expect({ line, belongs }).toEqual({ line, belongs: true });
    }
  });

  it('keeps every sentence AROUND the section, verbatim', () => {
    const out = withoutScorecardFallback(COMPLETE, true);
    // before it
    expect(out).toContain("Those are **Pune**'s birth details");
    expect(out).toContain('Casting both Kundlis and matching the 36 gunas');
    // the block itself — the panel parses it
    expect(out).toContain('```match_report');
    // and after it
    expect(out).toContain('```input_request');
  });

  it('stops at the table — the engine\'s own lines after it survive', () => {
    // The reduced reading ends with two `> ⏳ …` notes that are NOT part of
    // the fallback section. They are the clearest evidence that the cut has
    // a bottom edge.
    const out = withoutScorecardFallback(REDUCED, true);
    expect(out).toContain('Nadi dosha (health and progeny) cannot be checked');
    expect(out).toContain('Mangal (Kuja) dosha needs Mars');
    expect(out).toContain('```input_request');
  });

  it('rewrites no number anywhere', () => {
    const out = withoutScorecardFallback(COMPLETE, true);
    for (const n of ['26', '36', '8/8', '7/7']) {
      if (COMPLETE.includes(n) && !isOnlyInSection(COMPLETE, n)) expect(out).toContain(n);
    }
  });
});

function isOnlyInSection(text: string, needle: string): boolean {
  const start = text.indexOf('### Kundli Milan');
  const end = text.indexOf('\n\n', text.lastIndexOf('|'));
  const section = text.slice(start, end);
  return text.split(needle).length - 1 === section.split(needle).length - 1;
}

describe('it FAILS OPEN — a shape it does not recognise is left alone', () => {
  it('does nothing at all when the client did not draw the block', () => {
    expect(withoutScorecardFallback(COMPLETE, false)).toBe(COMPLETE);
    expect(withoutScorecardFallback(REDUCED, false)).toBe(REDUCED);
  });

  it('leaves a MENTION of Kundli Milan mid-paragraph alone', () => {
    const text =
      'I ran the Kundli Milan for you and the result was kind.\n\nThe Moon agrees.';
    expect(withoutScorecardFallback(text, true)).toBe(text);
  });

  it('leaves a heading with no table after it alone', () => {
    const text = '### Kundli Milan — 26 / 36 (very good)\n\nNo table today.\n';
    expect(withoutScorecardFallback(text, true)).toBe(text);
  });

  it('leaves a heading followed by an unexpected paragraph alone', () => {
    const text = [
      '### Kundli Milan — 26 / 36 (very good)',
      '',
      'Something the engine never put here.',
      '',
      '| Koota | Score |',
      '|---|---|',
    ].join('\n');
    expect(withoutScorecardFallback(text, true)).toBe(text);
  });

  it('leaves a MODEL-written table later in the narration alone', () => {
    const out = withoutScorecardFallback(
      [
        'Before.',
        '',
        '### Kundli Milan — 26 / 36 (very good)',
        '',
        '**Moon signs:** person 1: Aries; person 2: Gemini',
        '',
        '| Koota | Score | What it reads |',
        '|---|---|---|',
        '| Varna | 1/1 | ego balance |',
        '',
        'And here is a table I wrote myself:',
        '',
        '| Month | Outlook |',
        '|---|---|',
        '| March | kind |',
      ].join('\n'),
      true,
    );
    expect(out).not.toContain('### Kundli Milan');
    expect(out).not.toContain('| Varna |');
    expect(out).toContain('And here is a table I wrote myself:');
    expect(out).toContain('| Month | Outlook |');
    expect(out).toContain('| March | kind |');
  });

  it('is identity on text with no section at all', () => {
    for (const text of ['', 'One sentence.', '| a | b |\n|---|---|\n']) {
      expect(withoutScorecardFallback(text, true)).toBe(text);
    }
  });

  it('joins the paragraphs either side with exactly one blank line', () => {
    const out = withoutScorecardFallback(
      [
        'Before.',
        '',
        '### Kundli Milan — 26 / 36 (very good)',
        '',
        '**Moon signs:** person 1: Aries; person 2: Gemini',
        '',
        '| Koota | Score |',
        '|---|---|',
        '| Varna | 1/1 |',
        '',
        'After.',
      ].join('\n'),
      true,
    );
    expect(out).toBe('Before.\n\nAfter.');
  });
});
