/**
 * The scorecard's PROSE FALLBACK, and how a client that drew the block hides
 * it (docs/73 B4).
 *
 * ── what this text is, and why it is not the model's ──────────────────────
 *
 * Right after the ```` ```match_report ```` fence, `node_synastry` emits a
 * deterministic block of markdown (`graph.py` ~:13203-13232): a `### Kundli
 * Milan …` heading, an optional italic note when the reading is reduced, a
 * `**Moon signs:** …` line, and a pipe table of the eight kootas. None of it
 * is written by a model — it is `result` formatted with `:g` — and it exists
 * because docs/49 ASTRAL-90 requires a prose fallback for a client that
 * cannot draw the block. Installed app builds that discarded `match_report`
 * had that table as their ONLY scorecard, so the engine keeps sending it.
 *
 * A client that DID draw the block is therefore showing the same eight rows
 * twice: once as a ring and a grid, once as a markdown table under it. This
 * function removes the second one, and only for such a client.
 *
 * ── the rules, and the one that matters most ──────────────────────────────
 *
 *   - only when `drewBlock` is true;
 *   - it removes exactly the contiguous fallback section — the heading, the
 *     lines the engine puts between it and the table, and the FIRST
 *     contiguous pipe table after it — and nothing else;
 *   - **if that exact shape is not found, it returns the text UNCHANGED.**
 *     Fail open, to showing everything. A reading with one paragraph missing
 *     is worse than a reading with one table repeated, and this function
 *     cannot tell the difference between "the shape moved" and "this is a
 *     different sentence";
 *   - it never touches the narration after it, and never rewrites a number.
 *
 * It is here, in the shared package, rather than in the extension: the web
 * app and the astro app draw the same block and carry the same duplicate, and
 * a second copy of this is a second set of its edge cases. (They are NOT
 * changed by this commit; the function is simply where they can reach it.)
 *
 * It renders nothing. It is a string→string function, so it is not a second
 * scorecard.
 */

/** The heading the deterministic section always opens with. */
const HEADING = /^#{2,4}\s+Kundli Milan\b/;

/** The lines the engine may put between that heading and the table. */
const BETWEEN = [
  /^\*\*Moon signs:\*\*/,
  // the reduced reading's italic note ("A birth time is missing, so …")
  /^\*[^*].*\*$/,
];

const TABLE_ROW = /^\s*\|/;

export function withoutScorecardFallback(text: string, drewBlock: boolean): string {
  if (!drewBlock || !text) return text;

  const lines = text.split('\n');
  const start = lines.findIndex((line) => HEADING.test(line.trim()));
  if (start === -1) return text;

  // Walk to the table, allowing only the lines the engine is known to put
  // there. Anything else means this is not the shape we recognise, and the
  // honest answer is to leave the whole thing alone.
  let i = start + 1;
  while (i < lines.length && !TABLE_ROW.test(lines[i])) {
    const line = lines[i].trim();
    const allowed = line === '' || BETWEEN.some((p) => p.test(line));
    if (!allowed) return text;
    i += 1;
  }
  if (i >= lines.length) return text; // a heading with no table after it

  // The first contiguous run of table rows. A model-written table later in
  // the narration is untouched, because this run stops at the first line
  // that is not a row.
  let end = i;
  while (end < lines.length && TABLE_ROW.test(lines[end])) end += 1;
  // Two rows is the minimum a markdown table can be (header + delimiter).
  if (end - i < 2) return text;

  const before = lines.slice(0, start);
  const after = lines.slice(end);
  // Collapse the blank lines the cut leaves behind, so the paragraphs on
  // either side do not end up welded together or separated by a hole.
  while (before.length && before[before.length - 1].trim() === '') before.pop();
  while (after.length && after[0].trim() === '') after.shift();
  if (!before.length) return after.join('\n');
  if (!after.length) return before.join('\n');
  return `${before.join('\n')}\n\n${after.join('\n')}`;
}
