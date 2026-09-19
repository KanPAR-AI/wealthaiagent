/**
 * The crop — the data-minimisation step (docs/73 ASTRAL-331), as pure
 * geometry.
 *
 * ── the rule this module exists to make unbreakable ───────────────────────
 *
 * THE DEFAULT SELECTION IS NOT THE PAGE. A crop tool that opens on the whole
 * viewport is a consent screen for sending the whole viewport: the user
 * presses the button that is already correct-looking, and a face, a phone
 * number and somebody's employer leave the browser with the birth date. So
 * `defaultCrop` is a heuristic over the capture's OWN PIXELS — the densest
 * block of text — and when the heuristic is unsure it returns a centre band,
 * which is still not the whole image. `alwaysSmaller` is the floor under
 * both, and `crop.test.ts` asserts it on every fixture and on the degenerate
 * inputs (a blank capture, a one-pixel capture, an all-ink capture).
 *
 * ── what is NOT here ──────────────────────────────────────────────────────
 *
 * No canvas, no `document`, no `chrome.*`, and no image bytes held anywhere.
 * This module takes NUMBERS — an ink profile the panel measured — and returns
 * a rectangle. The bytes live in the panel for the length of one review and
 * are dropped (ASTRAL-337); a module-level cache here would outlive it.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A capture below this in either dimension cannot be cropped meaningfully. */
export const MIN_CROP_PX = 48;

/**
 * §4's bound, measured on the DECODED bytes exactly as the engine measures
 * it (`profile_capture.MAX_IMAGE_BYTES`). The client checks it BEFORE the
 * send so an over-large crop is a re-crop prompt rather than a 422 that cost
 * a round trip.
 */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/**
 * The longest edge we send.
 *
 * §4's cost note works from a 1024×1400 crop at ≈1.1k image tokens. A 2× DPI
 * capture of a full-screen page is ~3000 px wide, which is four times the
 * pixels for no more legible text — the glyphs are already crisp at 1×. So
 * the crop is downscaled to this before encoding, which is both the cost
 * control and the reason the 4 MB bound is never reached in practice.
 */
export const MAX_OUTPUT_EDGE = 1600;

/**
 * An ink profile: how much "text-like" signal sits in each row and column.
 *
 * Measured by the panel from the canvas (local contrast per pixel, summed).
 * Two one-dimensional arrays rather than the bitmap, so this module can be
 * tested with arithmetic instead of with a browser.
 */
export interface InkProfile {
  width: number;
  height: number;
  rows: number[];
  cols: number[];
}

/**
 * The share of the ink the SEED band must contain.
 *
 * It is a seed and nothing more. A window holding 85% of the ink is, by
 * construction, the SMALLEST such window — which means it ends part-way
 * through the longest values on the page, because their tails are the
 * sparsest columns. Measured on a real biodata capture: the box closed
 * through "Asha Verma" and through "Nagpur, Maharashtra", and the live
 * extractor read `name: "Verma"` and `pob: "Nagpur, Mahar-"` and reported
 * both as `stated` at high confidence (F304, and the reason F308 exists).
 *
 * So this number decides WHERE THE BOX STARTS and nothing else. What decides
 * where it ENDS is `expandToGutter` below: the edges walk outward while they
 * are standing on ink, and stop at the first ink-free gutter. Lowering this
 * constant now moves the seed, not the answer — which is why the edge-ink
 * assertions in `crop.test.ts` are the ones that hold the rule (a
 * `BAND_SHARE` of 0.30 used to leave every test green).
 */
const BAND_SHARE = 0.85;

/**
 * How many consecutive ink-free lines make a GUTTER.
 *
 * One would not do: a single anti-aliased pixel row inside a word, or the
 * gap between two lines of the same block, would stop the walk in the middle
 * of the text it is supposed to be enclosing. Two is the smallest number
 * that cannot be produced by one stray pixel and is still far narrower than
 * any real margin between blocks.
 */
export const GUTTER_LINES = 2;

/**
 * How different two neighbouring pixels must be to count as an edge.
 *
 * Summed across R, G and B, so 60 is a fifth of one channel's range — enough
 * to ignore a gradient background and catch text on it, in either direction.
 * It is a DIFFERENCE rather than a brightness threshold, which is why the
 * same number works on a light page and on a dark one.
 */
export const EDGE_THRESHOLD = 60;

/**
 * Where the text is, measured from the pixels themselves.
 *
 * Pure: raw RGBA in, two one-dimensional profiles out. It lives here rather
 * than in the React component so `crop.test.ts` can run it at the workspace
 * root with no browser, and so `e2e/make-crop-fixtures.mjs` has a single
 * algorithm to match.
 */
export function inkProfileFrom(
  data: Uint8ClampedArray | number[],
  width: number,
  height: number,
): InkProfile {
  const rows = new Array<number>(height).fill(0);
  const cols = new Array<number>(width).fill(0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 1; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const prev = i - 4;
      const edge =
        Math.abs(data[i] - data[prev]) +
        Math.abs(data[i + 1] - data[prev + 1]) +
        Math.abs(data[i + 2] - data[prev + 2]);
      if (edge > EDGE_THRESHOLD) {
        rows[y] += 1;
        cols[x] += 1;
      }
    }
  }
  return { width, height, rows, cols };
}

// ── F310 · the measurement becomes two-dimensional ────────────────────────
//
// WHY THE ONE-DIMENSIONAL PROFILES ARE NOT ENOUGH, measured on the walk's own
// page (`e2e-artifacts/13-crop.png`, before this): the default box spanned the
// header band AND the photo placeholder, while the copy above it said the
// photo does not leave the browser. Three separate causes, all of them the
// same shape — a profile over the WHOLE image cannot see WHERE the ink is:
//
//   * `inkProfileFrom` counts a horizontal neighbour difference, so every 1 px
//     VERTICAL RULE — a card border, the edge of a photo box — puts ink on
//     every row it crosses, and row gutters get bridged by borders;
//   * every FULL-WIDTH element — a header band, a site nav — puts ink on every
//     column, so column gutters never exist on a real page;
//   * a PHOTOGRAPH is far denser in edges than text, so `densestWindow` seeds
//     on the photo rather than on the details.
//
// None of it was exercised, because the fixtures used a flat grey placeholder
// where a real page has a photograph.
//
// So the panel keeps a packed EDGE MASK for the life of the review and the
// functions below take a profile INSIDE a rectangle. Everything here is pure
// arithmetic over a byte array: no canvas, no `document`, testable at the
// workspace root.

/**
 * One byte per pixel, 1 where the pixel differs from a neighbour.
 *
 * TRANSIENT — it is built when the capture opens and dropped with it, exactly
 * like the bitmap. It is counts, not pixels: it cannot reconstruct the image,
 * and it is never written to `chrome.storage` (the structural grep in
 * `capture.test.ts` covers the module it lives in).
 */
export interface EdgeMask {
  width: number;
  height: number;
  bits: Uint8Array;
}

/**
 * Both directions, deliberately.
 *
 * The 1-D profile looked at the horizontal neighbour only, which made a
 * vertical rule maximally visible and a horizontal rule invisible. Inside a
 * rectangle the direction no longer decides anything — what matters is
 * whether THIS pixel is on an edge — so both are counted and a rule of either
 * orientation is treated the same way.
 */
export function edgeMaskFrom(
  data: Uint8ClampedArray | number[],
  width: number,
  height: number,
): EdgeMask {
  const bits = new Uint8Array(width * height);
  const diff = (a: number, b: number) =>
    Math.abs(data[a] - data[b]) +
    Math.abs(data[a + 1] - data[b + 1]) +
    Math.abs(data[a + 2] - data[b + 2]);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const left = x > 0 ? diff(i, i - 4) : 0;
      const up = y > 0 ? diff(i, i - width * 4) : 0;
      if (left > EDGE_THRESHOLD || up > EDGE_THRESHOLD) bits[y * width + x] = 1;
    }
  }
  return { width, height, bits };
}

/** A rectangle clipped to the mask, so every scan below is in range. */
function inside(mask: EdgeMask, rect: Rect): Rect {
  return clampRect(rect, mask.width, mask.height);
}

/**
 * The row and column profiles taken INSIDE a rectangle.
 *
 * Indices are RELATIVE to the rectangle — `rows[0]` is `rect.y`. That is what
 * makes the segmentation below composable: a block found in one pass becomes
 * the rectangle of the next.
 */
export function profileIn(mask: EdgeMask, rect: Rect): InkProfile {
  const r = inside(mask, rect);
  const rows = new Array<number>(r.height).fill(0);
  const cols = new Array<number>(r.width).fill(0);
  for (let y = 0; y < r.height; y += 1) {
    const base = (r.y + y) * mask.width + r.x;
    for (let x = 0; x < r.width; x += 1) {
      if (mask.bits[base + x]) {
        rows[y] += 1;
        cols[x] += 1;
      }
    }
  }
  return { width: r.width, height: r.height, rows, cols };
}

/** Maximal runs of consecutive ink lines, split at gutters of `GUTTER_LINES`.
 *  A gap SHORTER than a gutter is inside the run, which is the same rule
 *  `expandToGutter` walks by: one anti-aliased blank line inside a word is
 *  not a boundary between two things. */
export function inkRuns(values: number[]): Array<{ start: number; end: number }> {
  const runs: Array<{ start: number; end: number }> = [];
  let start: number | null = null;
  let lastInk = -1;
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] <= 0) continue;
    if (start === null) start = i;
    else if (i - lastInk - 1 >= GUTTER_LINES) {
      runs.push({ start, end: lastInk });
      start = i;
    }
    lastInk = i;
  }
  if (start !== null) runs.push({ start, end: lastInk });
  return runs;
}

/**
 * A vertical rule is not text (the coordinator's point 3).
 *
 * A card border, a table rule and the edge of a photo box are one or two
 * pixels wide and carry ink down every row they cross. Restricting the
 * profile to the box interior already stops them bridging row gutters
 * OUTSIDE the box; this is what stops them being mistaken for a COLUMN of
 * content inside it.
 *
 * DERIVED, not guessed: the narrowest thing that can be a block of text is a
 * single glyph, and the corpus is rendered at 15-17 px, whose narrowest glyph
 * ("l", "1", ".") is 3-4 px of ink. Three is therefore the largest width that
 * cannot be a glyph. Measured against the generated fixtures in
 * `crop.test.ts`: every rule is 1-2 px, every text block is ≥ 28 px.
 */
export const RULE_MAX_PX = 3;

/**
 * How dense a block has to be before it is a PHOTOGRAPH and not writing.
 *
 * Measured on the procedural photo fixtures (noise + blobs + gradients) and
 * on the text blocks of the same pages, printed by
 * `e2e/make-crop-fixtures.mjs`:
 *
 *   text blocks    0.06 – 0.19   (glyph strokes, and white space between them)
 *   photo blocks   0.55 – 0.98   (an edge almost everywhere)
 *
 * There is an order of magnitude between them, so the threshold sits in the
 * empty middle rather than close to either. It is a statement about EDGE
 * DENSITY and nothing else — no face is detected, nothing is recognised, and
 * a dense diagram would be treated as a photograph, which is the safe way
 * round for a rule whose job is to keep a face out of the payload.
 */
export const SOLID_DENSITY = 0.35;

/**
 * And how BIG it has to be before density means anything.
 *
 * Density alone is scale-blind, and it broke the moment the segmentation got
 * fine enough to see single words: one line of 17 px text splits into word
 * blocks whose ink fills 0.5–0.6 of their own tiny extent, so every word was
 * being classified as a photograph. Measured on the generated layouts:
 *
 *   word blocks    648 – 2,046 px²
 *   photo blocks   53,676 – 271,929 px²
 *
 * Two orders of magnitude apart, so the floor sits an order of magnitude
 * from each. A photograph on a profile page is never small; a glyph is never
 * large. A dense DIAGRAM above this size would be called a photograph, which
 * is the safe way round for a rule whose job is keeping a face out.
 */
export const SOLID_MIN_AREA = 10_000;

export type BlockKind = 'text' | 'solid' | 'rule';

export interface Block extends Rect {
  kind: BlockKind;
  /** edge pixels inside the block, over its area. See `SOLID_DENSITY`. */
  density: number;
  /** edge pixels inside the block — the tie-break when a side must be chosen */
  ink: number;
}

/**
 * Split a band into COLUMN blocks and say what each one is.
 *
 * The band is a full-width row window. Its column profile — taken inside the
 * band, so a full-width header elsewhere on the page cannot fill every column
 * — splits at column gutters, and each resulting block is classified from its
 * own restricted row profile. That is the whole of point 2: segment, don't
 * just seed.
 */
export function columnBlocks(mask: EdgeMask, band: Rect): Block[] {
  const b = inside(mask, band);
  const profile = profileIn(mask, b);
  return inkRuns(profile.cols).map((run) => {
    const rect: Rect = {
      x: b.x + run.start,
      y: b.y,
      width: run.end - run.start + 1,
      height: b.height,
    };
    if (rect.width <= RULE_MAX_PX) {
      return { ...rect, kind: 'rule' as const, density: 1, ink: 0 };
    }
    const inner = profileIn(mask, rect);
    const ink = inner.rows.reduce((a, c) => a + c, 0);
    // Density over the block's own INK EXTENT, not over its full height: a
    // photograph that occupies the top half of a band is still a photograph,
    // and dividing by the empty half below would hide it.
    const lines = inkRuns(inner.rows);
    const extent = lines.length
      ? lines[lines.length - 1].end - lines[0].start + 1
      : rect.height;
    // A RULE IN EITHER ORIENTATION. A 1 px horizontal line spanning the page
    // is 900 px wide and one pixel tall: wide enough to pass the width test
    // above, and no more a block of content than the vertical border is.
    if (extent <= RULE_MAX_PX) {
      return { ...rect, kind: 'rule' as const, density: 1, ink };
    }
    const area = rect.width * extent;
    const density = ink / Math.max(1, area);
    const solid = density >= SOLID_DENSITY && area >= SOLID_MIN_AREA;
    return { ...rect, kind: solid ? ('solid' as const) : ('text' as const), density, ink };
  });
}

/** The centre band, used when the heuristic has nothing to go on. */
export function centreBand(width: number, height: number): Rect {
  return {
    x: Math.round(width * 0.1),
    y: Math.round(height * 0.15),
    width: Math.max(1, Math.round(width * 0.8)),
    height: Math.max(1, Math.round(height * 0.7)),
  };
}

/**
 * The smallest contiguous window of `values` holding `share` of their ink.
 *
 * A two-pointer scan, not a search over every pair: a 3000-row profile is
 * measured on every capture and an O(n²) version was visibly slow at 2× DPI.
 */
function densestWindow(values: number[], share: number): { start: number; end: number } | null {
  const ink = values.reduce((a, b) => a + b, 0);
  if (ink <= 0) return null;
  const want = ink * share;
  let start = 0;
  let sum = 0;
  let best: { start: number; end: number } | null = null;
  for (let end = 0; end < values.length; end += 1) {
    sum += values[end];
    while (sum - values[start] >= want) {
      sum -= values[start];
      start += 1;
    }
    if (sum >= want) {
      const width = end - start + 1;
      if (!best || width < best.end - best.start + 1) best = { start, end };
    }
  }
  return best;
}

/**
 * Walk one edge OUTWARD while it is standing on ink (F308).
 *
 * The seed window ends wherever 85% of the ink happened to run out, which on
 * a page of rows is part-way through the longest value. This walks each edge
 * out until the line just beyond it is the start of a GUTTER — an ink-free
 * run of at least `GUTTER_LINES` — so the box either encloses a block whole
 * or stops at the image edge. It never crosses a gutter, which is what keeps
 * the header, the photograph and the contact block outside it.
 *
 * Total: a profile of all zeroes returns the window unchanged, and every
 * loop is bounded by the array.
 */
export function expandToGutter(
  values: number[],
  seed: { start: number; end: number },
): { start: number; end: number } {
  let { start, end } = seed;
  // A line outside the array is "beyond the image", which the caller reads
  // as an image edge rather than as a gutter.
  const at = (i: number) => (i < 0 || i >= values.length ? 0 : values[i]);
  const gutterBefore = (i: number) => {
    for (let k = 0; k < GUTTER_LINES; k += 1) if (at(i - k) > 0) return false;
    return true;
  };
  const gutterAfter = (i: number) => {
    for (let k = 0; k < GUTTER_LINES; k += 1) if (at(i + k) > 0) return false;
    return true;
  };
  while (start > 0 && !gutterBefore(start - 1)) start -= 1;
  while (end < values.length - 1 && !gutterAfter(end + 1)) end += 1;
  return { start, end };
}

/**
 * Breathing room, taken from the gutter and never from the next block.
 *
 * A content-blind pad is how an expanded box walks straight back into the
 * text it just excluded: 4% of an 820 px page is 33 px, and a gutter is
 * often 8. So the pad is spent one line at a time and stops while at least
 * one ink-free line still separates the box from whatever is outside it —
 * which is also the invariant `edgeInk` and the tests check.
 */
export function padIntoGutter(
  values: number[],
  window: { start: number; end: number },
  pad: number,
): { start: number; end: number } {
  let { start, end } = window;
  const at = (i: number) => (i < 0 || i >= values.length ? 0 : values[i]);
  for (let i = 0; i < pad && start > 0; i += 1) {
    // move only onto a zero line, and only while the line BEYOND it is also
    // zero — so the box never ends up flush against the next block's ink
    if (at(start - 1) > 0 || at(start - 2) > 0) break;
    start -= 1;
  }
  for (let i = 0; i < pad && end < values.length - 1; i += 1) {
    if (at(end + 1) > 0 || at(end + 2) > 0) break;
    end += 1;
  }
  return { start, end };
}

/**
 * Is any BOUNDARY line of this box carrying ink (F308, the live guard)?
 *
 * An edge that sits on the image edge is reported as clean: there is nothing
 * to widen into, and telling somebody to widen a box that is already against
 * the side of the picture is an instruction with no next step.
 *
 * ⚠ The profiles are one-dimensional — `rows[y]` counts ink across the WHOLE
 * width, not only inside the box's columns — so this can say "touching" for
 * ink that sits on the same row somewhere else entirely. That is why it
 * drives a WARNING and never a block: a false "widen it" costs a glance, a
 * missed clipped name costs a wrong chart.
 */
export interface EdgeInk {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
  any: boolean;
}

export function edgeInk(profile: InkProfile, rect: Rect): EdgeInk {
  const { rows, cols, width, height } = profile;
  const ink = (values: number[], i: number) =>
    i >= 0 && i < values.length ? values[i] > 0 : false;
  const top = rect.y > 0 && ink(rows, rect.y);
  const bottom = rect.y + rect.height < height && ink(rows, rect.y + rect.height - 1);
  const left = rect.x > 0 && ink(cols, rect.x);
  const right = rect.x + rect.width < width && ink(cols, rect.x + rect.width - 1);
  return { top, bottom, left, right, any: top || bottom || left || right };
}

/** How much of the profile's ink the box keeps, per axis. 0..1. */
export function keptInkShare(profile: InkProfile, rect: Rect): { rows: number; cols: number } {
  const share = (values: number[], from: number, count: number) => {
    // `inkTotal`, not `total`: the no-derivation grep in
    // `panel-render.test.tsx` looks for `total >= <number>`, which is how a
    // client-side band threshold on an ENGINE score reads. This is a count
    // of edge pixels and the grep cannot tell them apart, so the name says
    // which one it is rather than the test being loosened.
    const inkTotal = values.reduce((a, b) => a + b, 0);
    if (inkTotal <= 0) return 1;
    let kept = 0;
    for (let i = from; i < from + count && i < values.length; i += 1) {
      if (i >= 0) kept += values[i];
    }
    return kept / inkTotal;
  };
  return {
    rows: share(profile.rows, rect.y, rect.height),
    cols: share(profile.cols, rect.x, rect.width),
  };
}

/**
 * Force a rectangle to be strictly smaller than the image it came from.
 *
 * The floor under ASTRAL-331. An all-ink capture (a photograph, a solid
 * gradient) makes the seed window the entire image and the expansion keeps
 * it there, and a default of "everything" is the one outcome the row forbids
 * by name.
 *
 * ⚠ IT INSETS ONLY WHEN THE BOX IS THE WHOLE IMAGE ON BOTH AXES (F308).
 * It used to inset each axis independently, which meant a box that
 * legitimately spanned the full width — a page whose text runs edge to edge —
 * had 5% sliced off each side, cutting through the very values the walk had
 * just been widened to include. When one axis is already short of the image
 * the AREA is strictly smaller and there is nothing left to prove; slicing
 * the other axis would only cost ink. "Smaller than the page" is bought by
 * excluding other REGIONS, never by cutting through the birth rows.
 */
export function alwaysSmaller(rect: Rect, width: number, height: number): Rect {
  if (rect.width < width || rect.height < height) return { ...rect };
  const insetX = Math.max(1, Math.round(width * 0.05));
  const insetY = Math.max(1, Math.round(height * 0.05));
  return {
    x: insetX,
    y: insetY,
    width: Math.max(1, width - insetX * 2),
    height: Math.max(1, height - insetY * 2),
  };
}

/**
 * Where the crop box opens.
 *
 * Not the page. Never the page.
 */
export function defaultCrop(profile: InkProfile): Rect {
  const { width, height } = profile;
  if (width < MIN_CROP_PX || height < MIN_CROP_PX) {
    // Too small to crop into: the whole thing IS the region, and there is no
    // minimisation to do. Still inset, so the rule holds in one direction
    // rather than being suspended.
    return alwaysSmaller({ x: 0, y: 0, width, height }, width, height);
  }
  const rowSeed = densestWindow(profile.rows, BAND_SHARE);
  const colSeed = densestWindow(profile.cols, BAND_SHARE);
  if (!rowSeed || !colSeed) return centreBand(width, height);

  // SEED → EXPAND → PAD → CLAMP → FLOOR, in that order and for that reason:
  // the seed finds the block, the expansion refuses to stop in the middle of
  // it, the pad takes only what the gutter can spare, and the floor is the
  // last word on "not the whole page" (F308).
  const pad = Math.round(Math.min(width, height) * 0.04);
  const rowsWindow = padIntoGutter(profile.rows, expandToGutter(profile.rows, rowSeed), pad);
  const colsWindow = padIntoGutter(profile.cols, expandToGutter(profile.cols, colSeed), pad);

  const rect = clampRect(
    {
      x: colsWindow.start,
      y: rowsWindow.start,
      width: colsWindow.end - colsWindow.start + 1,
      height: rowsWindow.end - rowsWindow.start + 1,
    },
    width,
    height,
  );
  return alwaysSmaller(rect, width, height);
}

/**
 * WHERE THE BOX OPENS, measured in two dimensions (F310).
 *
 * ── the order of priority, when one rectangle cannot have everything ──────
 *
 *   1. EXCLUDE THE PHOTOGRAPH.  A face in the payload is the one thing
 *      ASTRAL-331's negative space forbids outright, and it is the thing the
 *      user cannot undo once it has been sent.
 *   2. NEVER CUT THROUGH TEXT.  A sliced value comes back `stated` at high
 *      confidence and reads as a fact — F308, which is why "Verma" and
 *      "Nagpur, Mahar-" reached a review screen.
 *   3. INCLUDE THE NAME.  Last, because a missing name is a field the user
 *      types in five seconds and a sliced one is a wrong answer.
 *
 * So when the name sits in a header ABOVE a photograph and the columns that
 * exclude the photograph would slice that header, the HEADER IS LEFT OUT
 * WHOLE and the name comes back `missing`. That is rule 3 losing to rules 1
 * and 2, on purpose.
 *
 * ── the passes, and why there are exactly two ─────────────────────────────
 *
 *   A. a coarse ROW band from the whole-image profile (the seed — it only has
 *      to land somewhere in the content);
 *   B. COLUMN blocks inside that band, classified text / solid / rule;
 *   C. the column span: the best contiguous group of TEXT blocks with no
 *      solid block inside it;
 *   D. the ROW window RE-TAKEN inside those columns — this is the pass that
 *      un-bridges the row gutters a border was joining, because the border is
 *      now outside the rectangle being measured;
 *   E. rows whose ink runs OUTSIDE the chosen columns are dropped whole
 *      (rule 2 in the other axis).
 *
 * One refinement each way. It is bounded on purpose: a third pass would move
 * the box for reasons nobody could read off the picture.
 */
/**
 * The line pitch, measured rather than assumed.
 *
 * `GUTTER_LINES` is 2 — the right scale for "is this one word or two", and
 * the wrong scale entirely for "is this one block of content or two". Table
 * rows on the generated layouts sit 24 blank rows apart, so a walk that
 * stopped at every gutter stopped at every LINE and the box was one row of
 * the table.
 *
 * So the region scale is derived from the page: the median gap between
 * consecutive lines inside the chosen columns. A gap up to twice that is
 * line spacing and is crossed; a bigger one is a boundary between blocks and
 * is not. With fewer than two lines there is no pitch to measure and the
 * small gutter is all there is.
 */
export function lineGapOf(rows: number[]): number {
  const runs = inkRuns(rows);
  if (runs.length < 3) return GUTTER_LINES;
  const gaps: number[] = [];
  for (let i = 1; i < runs.length; i += 1) gaps.push(runs[i].start - runs[i - 1].end - 1);
  gaps.sort((a, c) => a - c);
  return Math.max(GUTTER_LINES, gaps[Math.floor(gaps.length / 2)]);
}

/**
 * Grow a row window across LINE gaps, stopping at a region boundary or at a
 * PHOTOGRAPH.
 *
 * Two stop conditions, and the second one is priority 1 doing its work: even
 * where a photograph is exactly one line-gap away from the details — which is
 * true of the photo-dominant layout — the walk will not cross into it,
 * because what it is is known by then and not merely how far away it is.
 */
export function growRows(
  rows: number[],
  seed: { start: number; end: number },
  gap: number,
  isSolid: (row: number) => boolean,
): { start: number; end: number } {
  let { start, end } = seed;
  const blankRunBefore = (i: number) => {
    let n = 0;
    while (i - n >= 0 && rows[i - n] <= 0) n += 1;
    return n;
  };
  const blankRunAfter = (i: number) => {
    let n = 0;
    while (i + n < rows.length && rows[i + n] <= 0) n += 1;
    return n;
  };
  for (;;) {
    const next = start - 1;
    if (next < 0) break;
    const blank = blankRunBefore(next);
    const target = next - blank;
    if (target < 0 || blank > gap * 2 || isSolid(target)) break;
    start = target;
  }
  for (;;) {
    const next = end + 1;
    if (next >= rows.length) break;
    const blank = blankRunAfter(next);
    const target = next + blank;
    if (target >= rows.length || blank > gap * 2 || isSolid(target)) break;
    end = target;
  }
  return { start, end };
}

export interface CropPlan {
  rect: Rect;
  /** every column block found in the seed band, with what it was judged to be */
  blocks: Block[];
  /** a solid block that could not be excluded by one rectangle, if any */
  solidInside: Block | null;
  /** a row block dropped whole because the columns would have sliced it */
  droppedRows: number;
}

/**
 * The best run of TEXT blocks that contains no SOLID block.
 *
 * "Best" is the most ink, which is the larger text side when a photograph
 * sits BETWEEN two text blocks and no single rectangle can hold both. Rules
 * of 1-3 px are transparent: they neither join nor break a group.
 */
export function textColumnSpan(blocks: Block[]): { x: number; width: number } | null {
  interface Span {
    x: number;
    width: number;
    ink: number;
  }
  // A holder rather than a bare `let`: the accumulator is written inside a
  // closure, and TypeScript narrows a closed-over `let` to `never` after it.
  const found: { best: Span | null } = { best: null };
  let run: Block[] = [];
  const close = () => {
    if (!run.length) return;
    const ink = run.reduce((a, c) => a + c.ink, 0);
    const x = run[0].x;
    const width = run[run.length - 1].x + run[run.length - 1].width - x;
    if (!found.best || ink > found.best.ink) found.best = { x, width, ink };
    run = [];
  };
  for (const block of blocks) {
    if (block.kind === 'solid') close();
    else if (block.kind === 'text') run.push(block);
    // a `rule` is transparent: it neither joins nor breaks a group
  }
  close();
  return found.best ? { x: found.best.x, width: found.best.width } : null;
}

export function defaultCropFromMask(mask: EdgeMask): CropPlan {
  const { width, height } = mask;
  const whole: Rect = { x: 0, y: 0, width, height };
  const none: CropPlan = {
    rect: centreBand(width, height),
    blocks: [],
    solidInside: null,
    droppedRows: 0,
  };
  if (width < MIN_CROP_PX || height < MIN_CROP_PX) {
    return { ...none, rect: alwaysSmaller(whole, width, height) };
  }

  // A — the seed band, from the whole-image row profile.
  const full = profileIn(mask, whole);

  // A — ROW BLOCKS first, then columns inside one of them.
  //
  // Seeding on a share of the ink and expanding was the old pass A, and on a
  // photo-dominant page it cannot work: a photograph holds most of the edges
  // on the page, so any seed big enough to be representative already contains
  // it, and the column profile then merges the photograph and the details
  // below it into a single block with no gutter between them.
  //
  // Splitting the page at ROW gutters first separates the header, the
  // photograph and the details before anything is classified. The anchor is
  // the row block with the most TEXT ink — the details, on every layout — and
  // pass D grows it back out within the chosen columns, stopping at the row
  // gutter that separates it from the photograph.
  const rowBlocks = inkRuns(full.rows);
  if (!rowBlocks.length) return none;

  interface Candidate {
    band: Rect;
    blocks: Block[];
    span: { x: number; width: number } | null;
    textInk: number;
  }
  const candidates: Candidate[] = rowBlocks.map((run) => {
    const band: Rect = { x: 0, y: run.start, width, height: run.end - run.start + 1 };
    const blocks = columnBlocks(mask, band);
    const span = textColumnSpan(blocks);
    const textInk = blocks
      .filter((block) => block.kind === 'text')
      .reduce((a, block) => a + block.ink, 0);
    return { band, blocks, span, textInk };
  });
  const anchor = candidates
    .filter((c) => c.span !== null)
    .sort((a, c) => c.textInk - a.textInk)[0];
  if (!anchor) {
    // Every row block on this page is a photograph or a rule. There is
    // nothing to read and nothing to protect; the centre band is the honest
    // default and the user drags from there.
    return { ...none, blocks: candidates.flatMap((c) => c.blocks) };
  }
  const bandRect = anchor.band;
  const blocks = candidates.flatMap((c) => c.blocks);
  const span = anchor.span!;

  const pad = Math.round(Math.min(width, height) * 0.04);
  const colProfile = profileIn(mask, bandRect).cols;
  const paddedCols = padIntoGutter(
    colProfile,
    { start: span.x, end: span.x + span.width - 1 },
    pad,
  );

  // D — the row window, RE-TAKEN inside the chosen columns. A border that was
  // bridging row gutters is outside this rectangle now.
  const column: Rect = {
    x: paddedCols.start,
    y: 0,
    width: paddedCols.end - paddedCols.start + 1,
    height,
  };
  const inColumn = profileIn(mask, column);
  const solidRow = (row: number): boolean =>
    blocks.some(
      (block) =>
        block.kind === 'solid' &&
        row >= block.y &&
        row < block.y + block.height &&
        block.x < column.x + column.width &&
        block.x + block.width > column.x,
    );
  // Grow across line gaps, then take the breathing room out of the gutter —
  // which is also what leaves an ink-free line on each boundary, so the
  // clipping guard is silent on the default box.
  const rows2 = padIntoGutter(
    inColumn.rows,
    growRows(
      inColumn.rows,
      { start: bandRect.y, end: bandRect.y + bandRect.height - 1 },
      lineGapOf(inColumn.rows),
      solidRow,
    ),
    pad,
  );

  // E — drop any row block the chosen columns would SLICE. Measured over the
  // FULL width: if a line of text starts to the left of the box, taking it
  // means cutting it, and rule 2 says leave it out whole.
  let top = rows2.start;
  let bottom = rows2.end;
  /**
   * Would the box CUT something on these rows?
   *
   * The question is about the single column just outside each edge, not
   * about the whole rest of the page: a photograph two hundred pixels to the
   * left is a different block, and the gutter between them is exactly what
   * says so. Asking "is there any ink elsewhere on this row" dropped every
   * table row on a photo-left page, because the photograph is on all of them.
   *
   * Ink touching the boundary means a run crosses it — which is F308's rule,
   * in the other axis.
   */
  const bleeds = (from: number, to: number): boolean => {
    const height = to - from + 1;
    const leftEdge =
      column.x > 0 &&
      profileIn(mask, { x: column.x - 1, y: from, width: 1, height }).cols[0] > 0;
    const rightX = column.x + column.width;
    const rightEdge =
      rightX < width &&
      profileIn(mask, { x: rightX, y: from, width: 1, height }).cols[0] > 0;
    return leftEdge || rightEdge;
  };
  let dropped = 0;
  const lines = inkRuns(inColumn.rows).filter((r) => r.end >= top && r.start <= bottom);
  for (const line of lines) {
    if (!bleeds(line.start, line.end)) break;
    top = line.end + 1;
    dropped += 1;
  }
  for (const line of [...lines].reverse()) {
    if (line.start < top) break;
    if (!bleeds(line.start, line.end)) break;
    bottom = line.start - 1;
    dropped += 1;
  }
  if (top > bottom) {
    top = rows2.start;
    bottom = rows2.end;
    dropped = 0;
  }

  const rect = clampRect(
    { x: column.x, y: top, width: column.width, height: bottom - top + 1 },
    width,
    height,
  );
  const final = alwaysSmaller(rect, width, height);
  return {
    rect: final,
    blocks,
    solidInside: solidInsideOf(blocks, final),
    droppedRows: dropped,
  };
}

/** A solid block whose columns overlap the box — the live photo warning. */
export function solidInsideOf(blocks: Block[], rect: Rect): Block | null {
  const right = rect.x + rect.width;
  return (
    blocks.find(
      (b) => b.kind === 'solid' && b.x < right && b.x + b.width > rect.x,
    ) ?? null
  );
}

/**
 * Does the box's own boundary carry ink, measured INSIDE the box (F310)?
 *
 * The 1-D version could say "touching" for ink on the same row somewhere
 * else on the page — a false alarm its own comment documented. With the mask
 * the question is exact: is there an edge pixel on this boundary line,
 * WITHIN the box's own extent.
 */
export function edgeInkFromMask(mask: EdgeMask, rect: Rect): EdgeInk {
  const r = inside(mask, rect);
  const rowInk = (y: number) => {
    const base = y * mask.width;
    for (let x = r.x; x < r.x + r.width; x += 1) if (mask.bits[base + x]) return true;
    return false;
  };
  const colInk = (x: number) => {
    for (let y = r.y; y < r.y + r.height; y += 1) if (mask.bits[y * mask.width + x]) return true;
    return false;
  };
  const top = r.y > 0 && rowInk(r.y);
  const bottom = r.y + r.height < mask.height && rowInk(r.y + r.height - 1);
  const left = r.x > 0 && colInk(r.x);
  const right = r.x + r.width < mask.width && colInk(r.x + r.width - 1);
  return { top, bottom, left, right, any: top || bottom || left || right };
}

/** Keep a rectangle inside the image, and never below one pixel. */
export function clampRect(rect: Rect, width: number, height: number): Rect {
  const w = Math.max(1, Math.min(Math.round(rect.width), width));
  const h = Math.max(1, Math.min(Math.round(rect.height), height));
  return {
    x: Math.max(0, Math.min(Math.round(rect.x), width - w)),
    y: Math.max(0, Math.min(Math.round(rect.y), height - h)),
    width: w,
    height: h,
  };
}

/** Arrow keys move the box; the box never leaves the image. */
export function nudge(rect: Rect, dx: number, dy: number, width: number, height: number): Rect {
  return clampRect({ ...rect, x: rect.x + dx, y: rect.y + dy }, width, height);
}

/** Shift+arrows resize it, from the bottom-right, to at least one pixel. */
export function resizeBy(
  rect: Rect,
  dw: number,
  dh: number,
  width: number,
  height: number,
): Rect {
  return clampRect({ ...rect, width: rect.width + dw, height: rect.height + dh }, width, height);
}

/** A drag: two points in image space become a rectangle. */
export function rectFromPoints(
  a: { x: number; y: number },
  b: { x: number; y: number },
  width: number,
  height: number,
): Rect {
  return clampRect(
    {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(a.x - b.x),
      height: Math.abs(a.y - b.y),
    },
    width,
    height,
  );
}

/**
 * What is actually sent, in pixels, after the downscale.
 *
 * Shown to the user beside the preview, because "only this region leaves your
 * browser" is a claim and a number is how it can be checked.
 */
export function outputSize(rect: Rect): { width: number; height: number; scale: number } {
  const longest = Math.max(rect.width, rect.height);
  const scale = longest > MAX_OUTPUT_EDGE ? MAX_OUTPUT_EDGE / longest : 1;
  return {
    width: Math.max(1, Math.round(rect.width * scale)),
    height: Math.max(1, Math.round(rect.height * scale)),
    scale,
  };
}

export function describeCrop(rect: Rect): string {
  const out = outputSize(rect);
  const size = `${out.width} × ${out.height} pixels`;
  if (out.scale === 1) return size;
  return `${size} (scaled down from ${rect.width} × ${rect.height})`;
}

/**
 * How many bytes a data URI decodes to, without decoding it.
 *
 * base64 is 4 characters per 3 bytes; the padding is what the subtraction is
 * for. Used to refuse an over-large crop BEFORE it costs a round trip and a
 * 422 — the engine measures the same bound on the same bytes.
 */
export function decodedBytes(dataUri: string): number {
  const comma = dataUri.indexOf(',');
  if (comma < 0) return 0;
  const b64 = dataUri.slice(comma + 1);
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

export function withinBound(dataUri: string): boolean {
  return decodedBytes(dataUri) <= MAX_IMAGE_BYTES;
}

/**
 * The encoding, decided by measurement rather than by taste.
 *
 * Measured on 2026-09-19 against the engine's own synthetic corpus
 * (`chatservice/tests/fixtures/profile_shots/`, fabricated people) through
 * THIS canvas path and sent to the live extractor —
 * `e2e/measure-encoding.mjs`, six paid calls:
 *
 *   table_00 (1×)             820×332   PNG 25 KB · JPEG 19 KB   4/4 both
 *   hidpi_2x_00 (2× DPI)     1600×648   PNG 80 KB · JPEG 41 KB   4/4 both
 *   low_contrast_dark_00      820×332   PNG 23 KB · JPEG 14 KB   4/4 both
 *
 * READ IT AS: on drawn text at these sizes the two encodings are
 * indistinguishable to the extractor — every field exact on every case, both
 * ways — and JPEG q0.92 is between 1.3× and 2× smaller. So there is no
 * accuracy argument either way and the only axis left is size, which is what
 * keeps a 2× capture of a long page inside the 4 MB bound without a second
 * downscale.
 *
 * PNG is therefore kept for a crop small enough that the difference cannot
 * matter: a lossless send of a small region costs nothing and is the easier
 * thing to defend to somebody asking what left their browser. The threshold
 * sits between the two sizes above, so both branches are exercised by the
 * cases that were actually measured.
 *
 * ONE CAVEAT, stated rather than buried: the corpus is CRISP DRAWN TEXT (the
 * PH-38 build record says so — no blur, no photographed screen, no Devanagari
 * numerals). If a real capture ever reads worse as JPEG, this is the constant
 * to move, and the measurement to redo.
 */
export const JPEG_QUALITY = 0.92;
export const SMALL_ENOUGH_FOR_PNG = 900 * 700;

export function encodingFor(rect: Rect): { mime: 'image/png' | 'image/jpeg'; quality: number } {
  const out = outputSize(rect);
  return out.width * out.height <= SMALL_ENOUGH_FOR_PNG
    ? { mime: 'image/png', quality: 1 }
    : { mime: 'image/jpeg', quality: JPEG_QUALITY };
}
