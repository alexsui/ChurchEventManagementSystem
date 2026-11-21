// Date-only helpers for "YYYY-MM-DD" strings in Taiwan time. Safe for client and server.

const taipeiDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** Today's calendar date in Taiwan, as "YYYY-MM-DD". */
export function taipeiToday(now: Date = new Date()): string {
  return taipeiDateFormatter.format(now);
}

/** "2027-01-05" → "2027/01/05" */
export function formatDateOnlyDisplay(value: string): string {
  return value.replace(/-/g, "/");
}

/** "2027-01-05" → "2027/01/05 (二)" — weekday computed without time-zone shifts. */
export function formatDateOnlyWithWeekday(value: string): string {
  const weekday = WEEKDAYS[new Date(`${value}T00:00:00.000Z`).getUTCDay()];
  return `${formatDateOnlyDisplay(value)} (${weekday})`;
}

/** Clock time in Taiwan, e.g. "19:32". */
export function formatTaipeiClock(value: string | Date): string {
  return new Date(value).toLocaleTimeString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
  });
}
