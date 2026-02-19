export type FormatableSession = {
  sessionNo: number;
  sessionDate: string | Date;
  topic?: string | null;
};

// Admin compact date: 2024/01/15
export function formatAdminDate(value: string | Date): string {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

// Public long date with weekday: 2024年1月15日 (週一)
export function formatLongDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

// Public long date without weekday: 2024年1月15日
export function formatLongDateNoWeekday(value: string | Date): string {
  return new Date(value).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Compact date without year: 1月15日
export function formatShortDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("zh-TW", {
    month: "short",
    day: "numeric",
  });
}

// Admin date+time: 2024/01/15 14:30
export function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

// Time range: "14:00 - 16:00" or fallback
export function formatTime(
  start?: string | null,
  end?: string | null,
  fallback = "-"
): string {
  if (!start && !end) return fallback;
  if (start && end) return `${start} - ${end}`;
  return start || end || fallback;
}

// Session label: "第 1 堂 (01/15) - 主題"
export function formatSessionLabel(session: FormatableSession): string {
  const date = new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(session.sessionDate));
  const topic = session.topic ? ` - ${session.topic}` : "";
  return `第 ${session.sessionNo} 堂 (${date})${topic}`;
}

// Column header: "第1堂 (01/15)"
export function formatSessionColumnHeader(session: FormatableSession): string {
  const date = new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(session.sessionDate));
  return `第${session.sessionNo}堂 (${date})`;
}
