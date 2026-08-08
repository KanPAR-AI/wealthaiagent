/**
 * ENGINE-PARITY vectors: every case here mirrors
 * chatservice/tests/test_loops_scheduler.py::TestCron. If one side changes,
 * the other must change in the same commit — the cron preview promising fire
 * times the scheduler won't honor is exactly the class of lie docs/37 §5.3
 * forbids.
 */
import { Cron, cronError, describeCron } from "../cron";

const utc = (y: number, mo: number, d: number, h: number, mi: number) =>
  new Date(Date.UTC(y, mo - 1, d, h, mi));

describe("Cron (engine parity)", () => {
  test("every five minutes", () => {
    const c = new Cron("*/5 * * * *");
    expect(c.matches(utc(2026, 8, 8, 10, 5))).toBe(true);
    expect(c.matches(utc(2026, 8, 8, 10, 7))).toBe(false);
  });

  test("daily at 21", () => {
    const c = new Cron("0 21 * * *");
    expect(c.matches(utc(2026, 8, 8, 21, 0))).toBe(true);
    expect(c.matches(utc(2026, 8, 8, 21, 1))).toBe(false);
    expect(c.matches(utc(2026, 8, 8, 9, 0))).toBe(false);
  });

  test("weekly monday and sunday aliases", () => {
    expect(new Cron("0 9 * * 1").matches(utc(2026, 8, 10, 9, 0))).toBe(true); // Monday
    const sun = utc(2026, 8, 9, 9, 0);
    expect(new Cron("0 9 * * 0").matches(sun)).toBe(true);
    expect(new Cron("0 9 * * 7").matches(sun)).toBe(true);
  });

  test("ranges and lists", () => {
    const c = new Cron("0 9-11 * * 1-5");
    expect(c.matches(utc(2026, 8, 10, 10, 0))).toBe(true); // Mon
    expect(c.matches(utc(2026, 8, 9, 10, 0))).toBe(false); // Sun
    const c2 = new Cron("0,30 12 * * *");
    expect(c2.matches(utc(2026, 8, 8, 12, 30))).toBe(true);
    expect(c2.matches(utc(2026, 8, 8, 12, 15))).toBe(false);
  });

  test("dom/dow OR rule", () => {
    const c = new Cron("0 0 13 * 5"); // 13th OR Friday
    expect(c.matches(utc(2026, 8, 13, 0, 0))).toBe(true); // 13th (Thu)
    expect(c.matches(utc(2026, 8, 14, 0, 0))).toBe(true); // a Friday
    expect(c.matches(utc(2026, 8, 15, 0, 0))).toBe(false);
  });

  test("invalid expressions raise", () => {
    for (const bad of ["* * * *", "61 * * * *", "* 25 * * *", "*/0 * * * *", "a * * * *"]) {
      expect(cronError(bad)).not.toBeNull();
    }
    expect(cronError("0 21 * * *")).toBeNull();
  });

  test("nextFires", () => {
    const now = utc(2026, 8, 8, 21, 30);
    const fires = new Cron("0 21 * * *").nextFires(now, 3);
    expect(fires.map((d) => d.toISOString())).toEqual([
      utc(2026, 8, 9, 21, 0).toISOString(),
      utc(2026, 8, 10, 21, 0).toISOString(),
      utc(2026, 8, 11, 21, 0).toISOString(),
    ]);
    // strictly after `from`: a slot due exactly now is not "next".
    expect(new Cron("30 21 * * *").nextFires(now, 1)[0].toISOString())
      .toBe(utc(2026, 8, 9, 21, 30).toISOString());
  });
});

describe("describeCron", () => {
  test.each([
    ["0 21 * * *", "Daily at 21:00 UTC"],
    ["30 9 * * 1-5", "Weekdays at 09:30 UTC"],
    ["*/30 * * * *", "Every 30 minutes"],
    ["0 * * * *", "Hourly"],
    ["0 9 * * 1", "Mondays at 09:00 UTC"],
    ["* * * * *", "Every minute"],
  ])("%s → %s", (expr, label) => {
    expect(describeCron(expr)).toBe(label);
  });
});
