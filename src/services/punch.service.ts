import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { taipeiToday } from "@/lib/taipei-date";

/**
 * 打卡 (punch) activities: members self check-in once per day over a date range.
 * A "rehearsal" is any date on which at least one member punched; there are no
 * pre-scheduled sessions. All dates are Asia/Taipei calendar dates ("YYYY-MM-DD"),
 * stored in Postgres `date` columns (read by Prisma as UTC-midnight Date objects).
 */

export class PunchServiceError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "PunchServiceError";
  }
}

// ==================== Date helpers ====================

export { taipeiToday };

/** Parse "YYYY-MM-DD" into a UTC-midnight Date. Throws INVALID_DATE. */
export function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new PunchServiceError(`Invalid date: ${value}`, "INVALID_DATE");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (isNaN(date.getTime()) || formatDateOnly(date) !== value) {
    throw new PunchServiceError(`Invalid date: ${value}`, "INVALID_DATE");
  }
  return date;
}

/** Format a date-column value as "YYYY-MM-DD". */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** A member is active on a date when joinedOn <= date <= leftOn (leftOn empty = still a member). */
function isActiveOn(date: string, joinedOn: string, leftOn: string | null): boolean {
  return joinedOn <= date && (leftOn === null || date <= leftOn);
}

// ==================== Statistics ====================

export interface PunchMemberInput {
  joinedOn: string;
  leftOn: string | null;
  punchedDates: string[];
}

export interface PunchMemberStats {
  attendedDates: string[];
  attended: number;
  eligible: number;
  /** attended / eligible, or null when there were no rehearsals in the member's window */
  rate: number | null;
}

/**
 * Attendance rate = rehearsals the member punched ÷ rehearsals held while they were
 * on the roster (joinedOn..leftOn inclusive). `dates` are all rehearsal dates.
 */
export function computePunchStats(dates: string[], member: PunchMemberInput): PunchMemberStats {
  const eligibleDates = dates.filter((date) => isActiveOn(date, member.joinedOn, member.leftOn));
  const punched = new Set(member.punchedDates);
  const attendedDates = eligibleDates.filter((date) => punched.has(date));
  return {
    attendedDates,
    attended: attendedDates.length,
    eligible: eligibleDates.length,
    rate: eligibleDates.length === 0 ? null : attendedDates.length / eligibleDates.length,
  };
}

// ==================== Activities ====================

export interface PunchActivityInput {
  title: string;
  startDate: string;
  endDate: string;
}

function validateActivityInput(input: PunchActivityInput) {
  const title = input.title?.trim();
  if (!title) {
    throw new PunchServiceError("Title is required", "INVALID_INPUT");
  }
  const startDate = parseDateOnly(input.startDate);
  const endDate = parseDateOnly(input.endDate);
  if (startDate > endDate) {
    throw new PunchServiceError("End date must not be before start date", "INVALID_INPUT");
  }
  return { title, startDate, endDate };
}

function serializeActivity(activity: {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
}) {
  return {
    id: activity.id,
    title: activity.title,
    startDate: formatDateOnly(activity.startDate),
    endDate: formatDateOnly(activity.endDate),
  };
}

async function requireActivity(activityId: string) {
  const activity = await prisma.punchActivity.findUnique({ where: { id: activityId } });
  if (!activity) {
    throw new PunchServiceError("Punch activity not found", "NOT_FOUND");
  }
  return activity;
}

export async function listPunchActivities() {
  const activities = await prisma.punchActivity.findMany({
    orderBy: { startDate: "desc" },
    include: { _count: { select: { members: true } } },
  });
  return activities.map((a) => ({
    ...serializeActivity(a),
    memberCount: a._count.members,
  }));
}

export async function createPunchActivity(input: PunchActivityInput) {
  const data = validateActivityInput(input);
  const activity = await prisma.punchActivity.create({ data });
  return serializeActivity(activity);
}

export async function updatePunchActivity(activityId: string, input: PunchActivityInput) {
  const data = validateActivityInput(input);
  await requireActivity(activityId);
  const activity = await prisma.punchActivity.update({ where: { id: activityId }, data });
  return serializeActivity(activity);
}

export async function deletePunchActivity(activityId: string) {
  await requireActivity(activityId);
  await prisma.punchActivity.delete({ where: { id: activityId } });
}

/** Activity title for link previews, or null when the activity does not exist. */
export async function getPunchActivityTitle(activityId: string) {
  const activity = await prisma.punchActivity.findUnique({
    where: { id: activityId },
    select: { title: true },
  });
  return activity?.title ?? null;
}

/**
 * Activity with rehearsal dates (and how many punched each date) and per-member stats.
 */
export async function getPunchActivityDetail(activityId: string) {
  const activity = await prisma.punchActivity.findUnique({
    where: { id: activityId },
    include: {
      members: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { name: true, phone: true } },
          records: {
            orderBy: { date: "desc" },
            select: {
              id: true,
              date: true,
              punchedAt: true,
              punchedBy: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!activity) {
    throw new PunchServiceError("Punch activity not found", "NOT_FOUND");
  }

  const countByDate = new Map<string, number>();
  for (const member of activity.members) {
    for (const record of member.records) {
      const date = formatDateOnly(record.date);
      countByDate.set(date, (countByDate.get(date) ?? 0) + 1);
    }
  }
  const dates = [...countByDate.keys()].sort();

  const members = activity.members.map((member) => {
    const joinedOn = formatDateOnly(member.joinedOn);
    const leftOn = member.leftOn ? formatDateOnly(member.leftOn) : null;
    return {
      memberId: member.id,
      userId: member.userId,
      name: member.user.name,
      phone: member.user.phone,
      joinedOn,
      leftOn,
      ...computePunchStats(dates, {
        joinedOn,
        leftOn,
        punchedDates: member.records.map((r) => formatDateOnly(r.date)),
      }),
      // punchedBy is the admin who made up the punch; null = self check-in
      records: member.records.map((r) => ({
        id: r.id,
        date: formatDateOnly(r.date),
        punchedAt: r.punchedAt,
        punchedBy: r.punchedBy ? { name: r.punchedBy.name } : null,
      })),
    };
  });

  return {
    ...serializeActivity(activity),
    dates: dates.map((date) => ({ date, count: countByDate.get(date)! })),
    members,
  };
}

// ==================== Roster ====================

export async function addPunchMember(
  activityId: string,
  input: { userId: string; joinedOn: string }
) {
  const joinedOn = parseDateOnly(input.joinedOn);
  await requireActivity(activityId);

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) {
    throw new PunchServiceError("User not found", "USER_NOT_FOUND");
  }

  try {
    return await prisma.punchMember.create({
      data: { activityId, userId: input.userId, joinedOn },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new PunchServiceError("User is already a member", "ALREADY_MEMBER");
    }
    throw error;
  }
}

async function requireMember(activityId: string, memberId: string) {
  const member = await prisma.punchMember.findFirst({ where: { id: memberId, activityId } });
  if (!member) {
    throw new PunchServiceError("Member not found", "MEMBER_NOT_FOUND");
  }
  return member;
}

export async function updatePunchMember(
  activityId: string,
  memberId: string,
  input: { joinedOn: string; leftOn: string | null }
) {
  await requireMember(activityId, memberId);
  const joinedOn = parseDateOnly(input.joinedOn);
  const leftOn = input.leftOn ? parseDateOnly(input.leftOn) : null;
  if (leftOn && leftOn < joinedOn) {
    throw new PunchServiceError("Leave date must not be before join date", "INVALID_INPUT");
  }
  return prisma.punchMember.update({ where: { id: memberId }, data: { joinedOn, leftOn } });
}

/** Remove a roster entry and all of that member's punch records. */
export async function removePunchMember(activityId: string, memberId: string) {
  await requireMember(activityId, memberId);
  await prisma.punchMember.delete({ where: { id: memberId } });
}

/** Delete every punch on a date, e.g. when someone scanned on a non-rehearsal day. */
export async function deletePunchDate(activityId: string, date: string) {
  const day = parseDateOnly(date);
  await requireActivity(activityId);
  const result = await prisma.punchRecord.deleteMany({
    where: { date: day, member: { activityId } },
  });
  return { count: result.count };
}

// ==================== Admin make-up punches (補打卡) ====================

/**
 * Admin punches a member in for a date within the activity period, up to today.
 * A date nobody else punched becomes a new rehearsal date.
 */
export async function makeUpPunch(
  activityId: string,
  memberId: string,
  date: string,
  punchedById: string,
  now = new Date()
) {
  const activity = await requireActivity(activityId);
  const member = await requireMember(activityId, memberId);
  const day = parseDateOnly(date);

  if (date < formatDateOnly(activity.startDate) || date > formatDateOnly(activity.endDate)) {
    throw new PunchServiceError("Date is outside the activity period", "OUT_OF_RANGE");
  }
  if (date > taipeiToday(now)) {
    throw new PunchServiceError("Cannot punch for a future date", "FUTURE_DATE");
  }
  const leftOn = member.leftOn ? formatDateOnly(member.leftOn) : null;
  if (!isActiveOn(date, formatDateOnly(member.joinedOn), leftOn)) {
    throw new PunchServiceError("Member is not on the roster on this date", "NOT_ON_ROSTER");
  }

  try {
    return await prisma.punchRecord.create({ data: { memberId, date: day, punchedById } });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new PunchServiceError("Already punched on this date", "ALREADY_PUNCHED");
    }
    throw error;
  }
}

/** Delete one punch record of a member (self or made up). */
export async function deletePunchRecord(activityId: string, memberId: string, recordId: string) {
  await requireMember(activityId, memberId);
  const result = await prisma.punchRecord.deleteMany({ where: { id: recordId, memberId } });
  if (result.count === 0) {
    throw new PunchServiceError("Punch record not found", "RECORD_NOT_FOUND");
  }
}

// ==================== Member self check-in ====================

export type TodayStatus = "NOT_LOGGED_IN" | "OUT_OF_RANGE" | "NOT_MEMBER" | "READY" | "PUNCHED";

async function resolveToday(activityId: string, userId: string, now: Date) {
  const activity = await requireActivity(activityId);
  const today = taipeiToday(now);
  const inRange =
    formatDateOnly(activity.startDate) <= today && today <= formatDateOnly(activity.endDate);

  if (!inRange) return { activity, today, status: "OUT_OF_RANGE" as const, member: null };

  const member = await prisma.punchMember.findUnique({
    where: { activityId_userId: { activityId, userId } },
  });
  const active =
    member &&
    isActiveOn(
      today,
      formatDateOnly(member.joinedOn),
      member.leftOn ? formatDateOnly(member.leftOn) : null
    );

  if (!member || !active) return { activity, today, status: "NOT_MEMBER" as const, member: null };
  return { activity, today, status: "READY" as const, member };
}

/** What the member-facing punch page should show for this user today. */
export async function getTodayStatus(
  activityId: string,
  userId: string | undefined,
  now = new Date()
) {
  if (!userId) {
    const activity = await requireActivity(activityId);
    return {
      activity: serializeActivity(activity),
      today: taipeiToday(now),
      status: "NOT_LOGGED_IN" as TodayStatus,
      punchedAt: null,
    };
  }

  const { activity, today, status, member } = await resolveToday(activityId, userId, now);
  let finalStatus: TodayStatus = status;
  let punchedAt: Date | null = null;

  if (member) {
    const record = await prisma.punchRecord.findUnique({
      where: { memberId_date: { memberId: member.id, date: parseDateOnly(today) } },
    });
    if (record) {
      finalStatus = "PUNCHED";
      punchedAt = record.punchedAt;
    }
  }

  return { activity: serializeActivity(activity), today, status: finalStatus, punchedAt };
}

/** Record today's punch for the user. */
export async function punchToday(activityId: string, userId: string, now = new Date()) {
  const { today, status, member } = await resolveToday(activityId, userId, now);

  if (status === "OUT_OF_RANGE") {
    throw new PunchServiceError("Today is outside the activity period", "OUT_OF_RANGE");
  }
  if (!member) {
    throw new PunchServiceError("User is not on the roster", "NOT_MEMBER");
  }

  try {
    return await prisma.punchRecord.create({
      data: { memberId: member.id, date: parseDateOnly(today) },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new PunchServiceError("Already punched today", "ALREADY_PUNCHED");
    }
    throw error;
  }
}
