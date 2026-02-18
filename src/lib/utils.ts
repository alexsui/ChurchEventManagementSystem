import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Determine whether a session is in the past.
 * - If endTime exists: past when now >= sessionDate + endTime
 * - If no endTime: past when now >= sessionDate + 1 day
 */
export function isSessionPast(session: {
  sessionDate: string | Date;
  endTime?: string | null;
}): boolean {
  const now = new Date();
  const sessionDate = new Date(session.sessionDate);
  sessionDate.setHours(0, 0, 0, 0);

  if (session.endTime) {
    const [hours, minutes] = session.endTime.split(":").map(Number);
    const cutoff = new Date(sessionDate);
    cutoff.setHours(hours, minutes, 0, 0);
    return now >= cutoff;
  }

  const dayAfter = new Date(sessionDate);
  dayAfter.setDate(dayAfter.getDate() + 1);
  return now >= dayAfter;
}
