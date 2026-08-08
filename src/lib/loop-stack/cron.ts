/**
 * 5-field cron for the Loop Stack UI — a PORT of the engine's matcher
 * (chatservice/services/loops/scheduler.py::Cron) with the same semantics and
 * the same test vectors (docs/37 §5.3), so the "next runs" preview can never
 * disagree with what the scheduler actually fires:
 *  - fields: minute hour day-of-month month day-of-week
 *  - `*`, lists, ranges, steps; day-of-week 0-7 with both 0 and 7 = Sunday
 *  - the standard quirk: when BOTH day-of-month and day-of-week are
 *    restricted, a time matches if EITHER does.
 */

const LIMITS: Array<[number, number]> = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day of month
  [1, 12], // month
  [0, 7], // day of week
];

// Forward scan bound: 62 days of minutes covers monthly schedules with slack.
const SCAN_LIMIT_MINUTES = 62 * 24 * 60;

function parseField(field: string, lo: number, hi: number): Set<number> {
  const out = new Set<number>();
  for (const rawPart of field.split(",")) {
    let part = rawPart.trim();
    let step = 1;
    if (part.includes("/")) {
      const [range, stepS] = part.split("/", 2);
      part = range;
      step = Number(stepS);
      if (!Number.isInteger(step) || step < 1) {
        throw new Error(`step must be >=1 in '${field}'`);
      }
    }
    let loV: number;
    let hiV: number;
    if (part === "*" || part === "") {
      loV = lo;
      hiV = hi;
    } else if (part.includes("-")) {
      const [a, b] = part.split("-", 2);
      loV = Number(a);
      hiV = Number(b);
    } else {
      loV = hiV = Number(part);
    }
    if (
      !Number.isInteger(loV) || !Number.isInteger(hiV) ||
      loV < lo || hiV > hi || loV > hiV
    ) {
      throw new Error(`value out of range in '${field}'`);
    }
    for (let v = loV; v <= hiV; v += step) out.add(v);
  }
  return out;
}

export class Cron {
  readonly minute: Set<number>;
  readonly hour: Set<number>;
  readonly dom: Set<number>;
  readonly month: Set<number>;
  readonly dow: Set<number>;
  readonly domStar: boolean;
  readonly dowStar: boolean;

  constructor(expr: string) {
    const fields = expr.trim().split(/\s+/);
    if (fields.length !== 5) {
      throw new Error(`cron needs 5 fields, got ${fields.length}: '${expr}'`);
    }
    this.minute = parseField(fields[0], ...LIMITS[0]);
    this.hour = parseField(fields[1], ...LIMITS[1]);
    this.dom = parseField(fields[2], ...LIMITS[2]);
    this.month = parseField(fields[3], ...LIMITS[3]);
    const dow = parseField(fields[4], ...LIMITS[4]);
    this.dow = new Set([...dow].map((v) => (v === 7 ? 0 : v)));
    this.domStar = fields[2] === "*";
    this.dowStar = fields[4] === "*";
  }

  /** All date parts are read in UTC — the engine matches in UTC. */
  matches(dt: Date): boolean {
    if (
      !this.minute.has(dt.getUTCMinutes()) ||
      !this.hour.has(dt.getUTCHours()) ||
      !this.month.has(dt.getUTCMonth() + 1)
    ) {
      return false;
    }
    const domOk = this.dom.has(dt.getUTCDate());
    const dowOk = this.dow.has(dt.getUTCDay()); // JS Sunday=0 == cron Sunday=0
    if (!this.domStar && !this.dowStar) return domOk || dowOk;
    return domOk && dowOk;
  }

  /** Next n matching minutes strictly AFTER `from`. */
  nextFires(from: Date, n = 3): Date[] {
    const out: Date[] = [];
    const cursor = new Date(from.getTime());
    cursor.setUTCSeconds(0, 0);
    for (let i = 0; i < SCAN_LIMIT_MINUTES && out.length < n; i++) {
      cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
      if (this.matches(cursor)) out.push(new Date(cursor.getTime()));
    }
    return out;
  }
}

/** Validate an expression; returns an error message or null. */
export function cronError(expr: string): string | null {
  try {
    new Cron(expr);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday",
  "Friday", "Saturday"];

/** Plain-language description for common shapes; falls back to the raw expr. */
export function describeCron(expr: string): string {
  let c: Cron;
  try {
    c = new Cron(expr);
  } catch {
    return expr;
  }
  const [minF, hourF, domF, , dowF] = expr.trim().split(/\s+/);
  const one = (s: Set<number>) => (s.size === 1 ? [...s][0] : null);
  const hh = one(c.hour);
  const mm = one(c.minute);
  const time = hh !== null && mm !== null
    ? `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
    : null;

  if (minF.startsWith("*/") && hourF === "*" && domF === "*" && dowF === "*") {
    return `Every ${minF.slice(2)} minutes`;
  }
  if (minF === "*" && hourF === "*" && domF === "*" && dowF === "*") {
    return "Every minute";
  }
  if (time && domF === "*" && dowF === "*") return `Daily at ${time} UTC`;
  if (time && domF === "*" && dowF === "1-5") return `Weekdays at ${time} UTC`;
  if (time && domF === "*" && c.dow.size === 1) {
    return `${DAY_NAMES[[...c.dow][0]]}s at ${time} UTC`;
  }
  if (mm !== null && hourF === "*" && domF === "*" && dowF === "*") {
    return mm === 0 ? "Hourly" : `Hourly at :${String(mm).padStart(2, "0")}`;
  }
  return expr;
}

export interface CronPreset {
  id: "hourly" | "daily" | "weekdays" | "interval" | "custom";
  label: string;
  /** Build an expression from {hour, minute, everyN}; custom returns null. */
  build: (opts: { hour: number; minute: number; everyN: number }) => string | null;
}

export const CRON_PRESETS: CronPreset[] = [
  { id: "hourly", label: "Hourly", build: ({ minute }) => `${minute} * * * *` },
  { id: "daily", label: "Daily at…", build: ({ hour, minute }) => `${minute} ${hour} * * *` },
  { id: "weekdays", label: "Weekdays at…", build: ({ hour, minute }) => `${minute} ${hour} * * 1-5` },
  { id: "interval", label: "Every N minutes", build: ({ everyN }) => `*/${everyN} * * * *` },
  { id: "custom", label: "Custom cron", build: () => null },
];
