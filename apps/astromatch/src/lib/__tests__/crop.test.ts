/**
 * The crop, against real captures (docs/73 ASTRAL-331).
 *
 * The profiles under `fixtures/ink-profiles.json` are MEASURED from the
 * engine's own synthetic screenshot corpus — seven layouts, fabricated people
 * — decoded in a real Chromium by `e2e/make-crop-fixtures.mjs`. The row's
 * assertion is "smaller than the capture on every fixture", and a fixture
 * invented at a keyboard would only prove the heuristic behaves on shapes
 * somebody imagined.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  EDGE_THRESHOLD,
  edgeInk,
  expandToGutter,
  keptInkShare,
  padIntoGutter,
  MAX_IMAGE_BYTES,
  MAX_OUTPUT_EDGE,
  alwaysSmaller,
  centreBand,
  clampRect,
  decodedBytes,
  defaultCrop,
  describeCrop,
  encodingFor,
  inkProfileFrom,
  nudge,
  outputSize,
  rectFromPoints,
  resizeBy,
  withinBound,
  type InkProfile,
  type Rect,
} from '../crop';

const FIXTURES = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'ink-profiles.json'), 'utf8'),
) as {
  edgeThreshold: number;
  profiles: Record<string, InkProfile>;
};

const CASES = Object.entries(FIXTURES.profiles);

const area = (r: Rect) => r.width * r.height;

describe('the fixtures are real measurements of the real corpus', () => {
  it('covers every layout in the corpus', () => {
    expect(CASES.length).toBe(7);
    for (const name of [
      'table_00.png',
      'two_column_00.png',
      'mixed_script_00.png',
      'photo_dominant_00.png',
      'low_contrast_dark_00.png',
      'hidpi_2x_00.png',
      'cropped_tight_00.png',
    ]) {
      expect(FIXTURES.profiles[name]).toBeDefined();
    }
  });

  it('was measured with the threshold the panel uses', () => {
    // The generator is a .mjs script and carries a COPY of the loop. The
    // threshold is the part that would realistically drift, so it is pinned
    // in both directions.
    expect(FIXTURES.edgeThreshold).toBe(EDGE_THRESHOLD);
    const generator = readFileSync(join(__dirname, '..', '..', '..', 'e2e', 'make-crop-fixtures.mjs'), 'utf8');
    expect(generator).toContain(`const EDGE_THRESHOLD = ${EDGE_THRESHOLD};`);
  });

  it('has ink in it — a profile of zeroes would make every case below vacuous', () => {
    for (const [name, profile] of CASES) {
      const total = profile.rows.reduce((a, b) => a + b, 0);
      expect({ name, hasInk: total > 0 }).toEqual({ name, hasInk: true });
      expect(profile.rows).toHaveLength(profile.height);
      expect(profile.cols).toHaveLength(profile.width);
    }
  });
});

describe('THE DEFAULT CROP IS NOT THE PAGE (ASTRAL-331)', () => {
  it.each(CASES)('%s opens on a region strictly smaller than the capture', (_name, profile) => {
    const rect = defaultCrop(profile);
    expect(area(rect)).toBeLessThan(profile.width * profile.height);
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.height).toBeGreaterThan(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(profile.width);
    expect(rect.y + rect.height).toBeLessThanOrEqual(profile.height);
  });

  it.each(CASES)('%s opens on the DENSE part, not on the middle by default', (name, profile) => {
    // Anti-vacuity for the row: "smaller than the page" would also be true of
    // a fixed centre band, which would make the heuristic pointless. On at
    // least most of the corpus the box must actually differ from the band.
    const rect = defaultCrop(profile);
    const band = centreBand(profile.width, profile.height);
    const same = rect.x === band.x && rect.y === band.y && rect.width === band.width;
    expect({ name, isTheFallback: same }).toEqual({ name, isTheFallback: false });
  });

  it('falls back to a centre band — still not the page — when there is no ink at all', () => {
    const blank: InkProfile = {
      width: 800,
      height: 600,
      rows: new Array(600).fill(0),
      cols: new Array(800).fill(0),
    };
    const rect = defaultCrop(blank);
    expect(rect).toEqual(centreBand(800, 600));
    expect(area(rect)).toBeLessThan(800 * 600);
  });

  it('refuses to open on everything even when EVERYTHING is ink', () => {
    // A photograph, a solid gradient: the densest window covering 60% of the
    // ink is the whole image. `alwaysSmaller` is the floor, and this is the
    // case that needs it.
    const all: InkProfile = {
      width: 500,
      height: 400,
      rows: new Array(400).fill(9),
      cols: new Array(500).fill(9),
    };
    const rect = defaultCrop(all);
    expect(area(rect)).toBeLessThan(500 * 400);
  });

  it('holds the floor on a capture too small to crop into', () => {
    const tiny: InkProfile = { width: 20, height: 12, rows: [], cols: [] };
    const rect = defaultCrop(tiny);
    expect(area(rect)).toBeLessThan(20 * 12);
  });

  it('alwaysSmaller leaves a rectangle that is ALREADY smaller alone', () => {
    const inner = { x: 10, y: 10, width: 100, height: 50 };
    expect(alwaysSmaller(inner, 400, 300)).toEqual(inner);
  });

  it('alwaysSmaller does NOT slice an axis that legitimately spans the page (F308)', () => {
    // It used to inset each axis independently. A page whose text runs edge
    // to edge then had 5% cut off each side — through the values the walk
    // had just been widened to include. The AREA is already strictly smaller
    // when the other axis is short, so there is nothing left to prove.
    const fullWidth = { x: 0, y: 40, width: 400, height: 100 };
    expect(alwaysSmaller(fullWidth, 400, 300)).toEqual(fullWidth);
    const fullHeight = { x: 40, y: 0, width: 100, height: 300 };
    expect(alwaysSmaller(fullHeight, 400, 300)).toEqual(fullHeight);
    // and the whole image is still cut down on both axes
    const whole = alwaysSmaller({ x: 0, y: 0, width: 400, height: 300 }, 400, 300);
    expect(whole.width * whole.height).toBeLessThan(400 * 300);
  });
});

/**
 * F308 — THE BOX MAY NOT CUT THROUGH INK.
 *
 * The bug these cases exist for, in full: the seed window is by construction
 * the SMALLEST window holding its share of the ink, so it ends part-way
 * through the longest values — and the live extractor then read a clipped
 * name and a clipped place and reported both as `stated` at high confidence.
 * A user approving a review screen has no way to know that "Verma" is half a
 * name.
 *
 * Why the old tests could not see it: they asserted "smaller than the
 * capture" and "not the centre band", and a 97×40 sliver satisfies both.
 * Lowering the seed share to 0.30 left all 728 of them green.
 *
 * The four assertions below are the rule itself:
 *   1. no ink RUN is sliced — every maximal run of consecutive ink lines is
 *      wholly inside the box or wholly outside it;
 *   2. every boundary line of the box is ink-free (or is the image edge);
 *   3. the line just OUTSIDE each edge is ink-free (or the edge is the
 *      image edge) — i.e. the box stands in a gutter, not against text;
 *   4. the box still KEEPS the block: a floor on the share of ink inside it,
 *      which is what a collapsed seed breaks even though 1-3 survive it.
 */
describe('F308 — the default crop never cuts through ink', () => {
  /** Maximal runs of consecutive ink lines. */
  const runsOf = (values: number[]): Array<[number, number]> => {
    const runs: Array<[number, number]> = [];
    let start: number | null = null;
    values.forEach((v, i) => {
      if (v > 0 && start === null) start = i;
      if (v === 0 && start !== null) {
        runs.push([start, i - 1]);
        start = null;
      }
    });
    if (start !== null) runs.push([start, values.length - 1]);
    return runs;
  };

  it.each(CASES)('%s: no ink run is sliced by the box', (_name, profile) => {
    const rect = defaultCrop(profile);
    const sliced: string[] = [];
    const check = (axis: 'rows' | 'cols', from: number, to: number) => {
      for (const [a, z] of runsOf(profile[axis])) {
        const inside = a >= from && z <= to;
        const outside = z < from || a > to;
        if (!inside && !outside) sliced.push(`${axis} ${a}..${z} vs box ${from}..${to}`);
      }
    };
    check('rows', rect.y, rect.y + rect.height - 1);
    check('cols', rect.x, rect.x + rect.width - 1);
    expect(sliced).toEqual([]);
  });

  it.each(CASES)('%s: no BOUNDARY line of the box carries ink', (_name, profile) => {
    // `edgeInk` exempts an edge that IS the image edge — there is nothing to
    // widen into there, and the warning it drives would have no next step.
    expect(edgeInk(profile, defaultCrop(profile))).toMatchObject({ any: false });
  });

  it.each(CASES)('%s: the line just OUTSIDE each edge is ink-free', (_name, profile) => {
    const rect = defaultCrop(profile);
    const ink = (values: number[], i: number) => i >= 0 && i < values.length && values[i] > 0;
    const touching: string[] = [];
    if (rect.y > 0 && ink(profile.rows, rect.y - 1)) touching.push('above');
    if (rect.y + rect.height < profile.height && ink(profile.rows, rect.y + rect.height)) {
      touching.push('below');
    }
    if (rect.x > 0 && ink(profile.cols, rect.x - 1)) touching.push('left of');
    if (rect.x + rect.width < profile.width && ink(profile.cols, rect.x + rect.width)) {
      touching.push('right of');
    }
    expect(touching).toEqual([]);
  });

  /**
   * The floor, and the deviation from the review's number, stated.
   *
   * Role-3 asked for ≥ 99% of the row ink and the column ink kept. MEASURED
   * on these seven profiles after the fix: rows 85.67%–100.00%, cols
   * 87.31%–99.94%. The missing 0–14% is not clipped text — assertion 1 above
   * proves no run is sliced — it is WHOLE OTHER BLOCKS beyond a gutter: the
   * page heading on the table layouts, the heading and photograph region on
   * `photo_dominant_00`. Reaching 99% would mean swallowing them, which is
   * the opposite of ASTRAL-331.
   *
   * So the floor is 80%: comfortably above every measurement, and far below
   * what a collapsed seed produces (0.30 gives 31%–49%, 0.60 gives 61%–86%),
   * which is the failure this assertion is here to catch.
   */
  const KEPT_FLOOR = 0.8;

  it.each(CASES)('%s: keeps the block — at least 80% of the ink, both axes', (_name, profile) => {
    const kept = keptInkShare(profile, defaultCrop(profile));
    expect(kept.rows).toBeGreaterThanOrEqual(KEPT_FLOOR);
    expect(kept.cols).toBeGreaterThanOrEqual(KEPT_FLOOR);
  });

  /**
   * The measured box, pinned exactly.
   *
   * A pin rather than a range, because the two mutations this phase must
   * survive — a collapsed seed and a removed gutter walk — both change the
   * box while leaving assertions 1-3 green (the walk keeps the edges clean
   * whatever the seed). Updating it is a deliberate act with a diff someone
   * reads.
   */
  const MEASURED: Record<string, Rect> = {
    'table_00.png': { x: 27, y: 100, width: 423, height: 172 },
    'two_column_00.png': { x: 13, y: 13, width: 612, height: 395 },
    'mixed_script_00.png': { x: 27, y: 100, width: 509, height: 172 },
    'photo_dominant_00.png': { x: 401, y: 624, width: 179, height: 218 },
    'low_contrast_dark_00.png': { x: 27, y: 100, width: 450, height: 171 },
    'hidpi_2x_00.png': { x: 82, y: 199, width: 835, height: 345 },
    'cropped_tight_00.png': { x: 30, y: 100, width: 478, height: 111 },
  };

  it.each(CASES)('%s: is the box that was measured', (name, profile) => {
    expect(defaultCrop(profile)).toEqual(MEASURED[name]);
  });

  it('the seed is a seed — the GUTTER WALK is what decides the edges', () => {
    // Anti-vacuity for the pin: prove the walk is load-bearing by showing the
    // seed-only box (what the code did before F308) is a different, smaller
    // rectangle that DOES slice ink.
    const profile = FIXTURES.profiles['table_00.png'];
    const seedRows = { start: 110, end: 136 }; // one text row of the table
    const walked = expandToGutter(profile.rows, seedRows);
    expect(walked).toEqual(seedRows); // a row sits between two gutters already
    // a seed that ends INSIDE a run is walked out to the run's own end
    const midRun = { start: 115, end: 120 };
    expect(expandToGutter(profile.rows, midRun)).toEqual({ start: 110, end: 136 });
  });

  it('the walk stops at a gutter and not at a single blank line', () => {
    //            0  1  2  3  4  5  6  7  8  9
    const v = [0, 0, 3, 0, 4, 0, 0, 5, 0, 0];
    // seeded on the middle run, it crosses the ONE blank at index 3 and
    // stops at the TWO blanks at 5-6
    expect(expandToGutter(v, { start: 4, end: 4 })).toEqual({ start: 2, end: 4 });
  });

  it('the walk runs to the image edge when the ink does', () => {
    const v = [7, 7, 7, 0, 0, 3];
    expect(expandToGutter(v, { start: 1, end: 1 })).toEqual({ start: 0, end: 2 });
  });

  it('the pad takes from the gutter and never from the next block', () => {
    const v = [9, 0, 0, 0, 0, 0, 9, 9, 9, 0, 0, 9];
    // a 20px pad cannot reach the ink at 0 or at 11: it stops while one
    // ink-free line still stands between the box and whatever is outside
    const padded = padIntoGutter(v, { start: 6, end: 8 }, 20);
    expect(padded.start).toBeGreaterThan(1);
    expect(v[padded.start - 1]).toBe(0);
    expect(v[padded.end + 1]).toBe(0);
  });
});

describe('the box the user drives', () => {
  const bounds = { width: 800, height: 600 };
  const rect: Rect = { x: 100, y: 100, width: 200, height: 150 };

  it('an arrow key moves it and nothing else', () => {
    expect(nudge(rect, 4, 0, bounds.width, bounds.height)).toEqual({ ...rect, x: 104 });
    expect(nudge(rect, 0, -4, bounds.width, bounds.height)).toEqual({ ...rect, y: 96 });
  });

  it('never leaves the image, in any direction', () => {
    expect(nudge(rect, -9999, 0, bounds.width, bounds.height).x).toBe(0);
    expect(nudge(rect, 9999, 0, bounds.width, bounds.height).x).toBe(600);
    expect(nudge(rect, 0, 9999, bounds.width, bounds.height).y).toBe(450);
  });

  it('shift+arrow resizes it, down to one pixel and up to the image', () => {
    expect(resizeBy(rect, 20, 20, bounds.width, bounds.height)).toEqual({
      ...rect,
      width: 220,
      height: 170,
    });
    expect(resizeBy(rect, -9999, -9999, bounds.width, bounds.height)).toEqual({
      ...rect,
      width: 1,
      height: 1,
    });
    expect(resizeBy(rect, 9999, 9999, bounds.width, bounds.height).width).toBe(800);
  });

  it('a drag in either direction is the same rectangle', () => {
    const a = rectFromPoints({ x: 10, y: 20 }, { x: 110, y: 90 }, 800, 600);
    const b = rectFromPoints({ x: 110, y: 90 }, { x: 10, y: 20 }, 800, 600);
    expect(a).toEqual(b);
    expect(a).toEqual({ x: 10, y: 20, width: 100, height: 70 });
  });

  it('a typed rectangle is clamped, not trusted', () => {
    expect(clampRect({ x: -50, y: -50, width: 99999, height: 99999 }, 800, 600)).toEqual({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    });
  });
});

describe('what is actually sent', () => {
  it('downscales a long edge and says it did', () => {
    const big = { x: 0, y: 0, width: 3200, height: 1600 };
    const out = outputSize(big);
    expect(Math.max(out.width, out.height)).toBe(MAX_OUTPUT_EDGE);
    expect(describeCrop(big)).toContain('scaled down from 3200 × 1600');
  });

  it('leaves a small crop at its own size', () => {
    const small = { x: 0, y: 0, width: 400, height: 300 };
    expect(outputSize(small)).toEqual({ width: 400, height: 300, scale: 1 });
    expect(describeCrop(small)).toBe('400 × 300 pixels');
  });

  it('measures the decoded bytes of a data URI without decoding it', () => {
    // "AAAA" is 4 base64 chars = 3 bytes; "AA==" is 1.
    expect(decodedBytes('data:image/png;base64,AAAA')).toBe(3);
    expect(decodedBytes('data:image/png;base64,AA==')).toBe(1);
    expect(decodedBytes('not-a-data-uri')).toBe(0);
  });

  it('refuses a crop over the engine\'s own bound BEFORE it is sent', () => {
    const chars = Math.ceil(((MAX_IMAGE_BYTES + 1024) * 4) / 3);
    const oversize = `data:image/jpeg;base64,${'A'.repeat(chars)}`;
    expect(withinBound(oversize)).toBe(false);
    expect(withinBound('data:image/png;base64,AAAA')).toBe(true);
  });

  it('picks the encoding the measurement picked, at the sizes measured', () => {
    // Both branches are the cases that were actually sent to the live
    // extractor (see the note on `encodingFor`): 820×332 read 4/4 as PNG and
    // 1600×648 read 4/4 as JPEG at half the bytes.
    expect(encodingFor({ x: 0, y: 0, width: 820, height: 332 }).mime).toBe('image/png');
    expect(encodingFor({ x: 0, y: 0, width: 1600, height: 648 }).mime).toBe('image/jpeg');
    expect(encodingFor({ x: 0, y: 0, width: 1600, height: 648 }).quality).toBeLessThan(1);
  });
});

describe('the ink measurement itself', () => {
  it('finds an edge where the pixels change and nowhere else', () => {
    // 4×2, left half black, right half white: the edge sits at x=2.
    const width = 4;
    const height = 2;
    const data: number[] = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const v = x < 2 ? 0 : 255;
        data.push(v, v, v, 255);
      }
    }
    const profile = inkProfileFrom(data, width, height);
    expect(profile.cols).toEqual([0, 0, 2, 0]);
    expect(profile.rows).toEqual([1, 1]);
  });

  it('sees nothing in a flat image', () => {
    const data = new Array(4 * 4 * 4).fill(120);
    const profile = inkProfileFrom(data, 4, 4);
    expect(profile.rows.reduce((a, b) => a + b, 0)).toBe(0);
  });
});
