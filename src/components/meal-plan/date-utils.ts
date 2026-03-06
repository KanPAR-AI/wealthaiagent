/**
 * Date utilities for 7-day meal plan calendar display.
 *
 * The backend always generates days Sun–Sat. We derive actual calendar
 * dates from the plan's `created_at` timestamp.
 */

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export interface DayTabInfo {
  index: number;
  dayAbbr: string;
  dateNum: number;
  monthAbbr: string;
  isToday: boolean;
  fullDate: Date;
}

/**
 * Compute the 7 calendar dates (Sun–Sat) for the plan's week.
 * Finds the Sunday of the week containing `createdAt` and maps forward.
 */
export function getPlanDayDates(createdAt: string): Date[] {
  const created = new Date(createdAt);
  const dayOfWeek = created.getDay(); // 0 = Sunday

  const sunday = new Date(created);
  sunday.setDate(created.getDate() - dayOfWeek);
  sunday.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });
}

/**
 * Find which plan day index (0–6) is today. Returns null if today
 * falls outside the plan's week (stale plan).
 */
export function getTodayIndex(planDates: Date[]): number | null {
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDate = now.getDate();

  for (let i = 0; i < planDates.length; i++) {
    const d = planDates[i];
    if (
      d.getFullYear() === todayYear &&
      d.getMonth() === todayMonth &&
      d.getDate() === todayDate
    ) {
      return i;
    }
  }
  return null;
}

/**
 * Build display info for all 7 day tabs.
 */
export function buildDayTabInfos(createdAt: string): DayTabInfo[] {
  const dates = getPlanDayDates(createdAt);
  const todayIdx = getTodayIndex(dates);

  return dates.map((d, i) => ({
    index: i,
    dayAbbr: DAY_ABBR[d.getDay()],
    dateNum: d.getDate(),
    monthAbbr: MONTH_ABBR[d.getMonth()],
    isToday: i === todayIdx,
    fullDate: d,
  }));
}

/**
 * Format the week range label, e.g. "Mar 2 – 8" or "Feb 27 – Mar 5".
 */
export function formatWeekRange(createdAt: string): string {
  const dates = getPlanDayDates(createdAt);
  const first = dates[0];
  const last = dates[6];

  const firstMonth = MONTH_ABBR[first.getMonth()];
  const lastMonth = MONTH_ABBR[last.getMonth()];

  if (firstMonth === lastMonth) {
    return `${firstMonth} ${first.getDate()} – ${last.getDate()}`;
  }
  return `${firstMonth} ${first.getDate()} – ${lastMonth} ${last.getDate()}`;
}
