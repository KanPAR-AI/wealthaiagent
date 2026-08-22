/**
 * The DECLARED layout geometry (docs/49 ASTRAL-19).
 *
 * The second — and last — module allowed to do arithmetic. Everything here
 * produces COORDINATES AND LENGTHS, never a number that reaches the screen as
 * text. That distinction is the whole rule: filling a ring 21.5/36 of the way
 * round is a picture of a payload fact; printing "60%" beside it is a new
 * claim. ASTRAL-16 mandates the first ("the ring filled by guna out of 36")
 * and INV-5 bans the second.
 *
 * Anything a user could read off as a number lives in `format.ts`.
 */

/** Anchor point for one house's label + planet stack, in unit-square coords. */
export interface HouseAnchor {
  house: number;
  x: number;
  y: number;
}

export interface DiamondLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * The North-Indian diamond, in a 0..1 unit square.
 *
 * A direct port of `export_pdf.py:_house_anchors` (~:61) and the shape drawn
 * at `export_pdf.py:241-249`, which docs/49 ASTRAL-15 names as "the working
 * reference implementation". Same layout, same house walk: house 1 is the
 * top-centre diamond and the numbering runs counter-clockwise through the four
 * outer triangles and the four corner squares. Keeping the two identical means
 * the chart in the app and the chart in the Kundli PDF are the same chart.
 *
 * The fractions are the PDF's, evaluated at x0=0, y0=0, size=1 (its `q` is
 * size/4 = 0.25).
 */
export const NORTH_INDIAN_HOUSE_ANCHORS: readonly HouseAnchor[] = [
  { house: 1, x: 0.5, y: 0.225 },
  { house: 2, x: 0.1875, y: 0.0875 },
  { house: 3, x: 0.0875, y: 0.1875 },
  { house: 4, x: 0.225, y: 0.5 },
  { house: 5, x: 0.0875, y: 0.8125 },
  { house: 6, x: 0.1875, y: 0.9125 },
  { house: 7, x: 0.5, y: 0.775 },
  { house: 8, x: 0.8125, y: 0.9125 },
  { house: 9, x: 0.9125, y: 0.8125 },
  { house: 10, x: 0.775, y: 0.5 },
  { house: 11, x: 0.9125, y: 0.1875 },
  { house: 12, x: 0.8125, y: 0.0875 },
];

/**
 * The six strokes inside the outer square: the two diagonals and the inner
 * diamond joining the four edge midpoints. Unit-square coords; the outer
 * square itself is drawn by the component as a rect.
 */
export const NORTH_INDIAN_LINES: readonly DiamondLine[] = [
  { x1: 0, y1: 0, x2: 1, y2: 1 },
  { x1: 1, y1: 0, x2: 0, y2: 1 },
  { x1: 0.5, y1: 0, x2: 1, y2: 0.5 },
  { x1: 1, y1: 0.5, x2: 0.5, y2: 1 },
  { x1: 0.5, y1: 1, x2: 0, y2: 0.5 },
  { x1: 0, y1: 0.5, x2: 0.5, y2: 0 },
];

/**
 * The SVG coordinate space the wheel is drawn in. The component sets
 * `viewBox="0 0 100 100"` and lets the browser/native SVG scale to the
 * rendered size, so no pixel arithmetic happens in the renderer at all.
 */
export const WHEEL_VIEWBOX = 100;

const toViewBox = (v: number) => v * WHEEL_VIEWBOX;

/** The anchors, pre-scaled into the wheel's viewBox. */
export const WHEEL_HOUSE_ANCHORS: readonly HouseAnchor[] =
  NORTH_INDIAN_HOUSE_ANCHORS.map((a) => ({
    house: a.house,
    x: toViewBox(a.x),
    y: toViewBox(a.y),
  }));

/** The strokes, pre-scaled into the wheel's viewBox. */
export const WHEEL_LINES: readonly DiamondLine[] = NORTH_INDIAN_LINES.map((l) => ({
  x1: toViewBox(l.x1),
  y1: toViewBox(l.y1),
  x2: toViewBox(l.x2),
  y2: toViewBox(l.y2),
}));

export interface RingDash {
  /** total stroke length once round the circle */
  circumference: number;
  /** how much of it is drawn */
  filled: number;
}

/**
 * How far round the guna ring the stroke goes.
 *
 * This IS a division on payload numbers, and it is allowed for exactly one
 * reason: the result is an SVG stroke length, never text. §5b-2's instruction
 * is "keep the ring, drop the invented number — fill it by guna out of 36 and
 * label it with the band the engine already computes".
 *
 * Guards, because a broken ring must not become a broken claim: a non-finite
 * or non-positive `max`, or a null `points`, yields an EMPTY ring (filled 0)
 * rather than a full one. An unscored match must never look like a perfect
 * one. `points` above `max` is clamped for the same reason.
 */
export function ringDash(
  points: number | null | undefined,
  max: number | null | undefined,
  radius: number,
): RingDash {
  const circumference = 2 * Math.PI * radius;
  if (
    typeof points !== 'number' || !Number.isFinite(points) || points <= 0 ||
    typeof max !== 'number' || !Number.isFinite(max) || max <= 0
  ) {
    return { circumference, filled: 0 };
  }
  const fraction = points > max ? 1 : points / max;
  return { circumference, filled: circumference * fraction };
}
