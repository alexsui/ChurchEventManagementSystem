import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export class AttendanceServiceError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "AttendanceServiceError";
  }
}

/**
 * Check in a user to an event session.
 * Verifies the user has a registration for the parent event.
 * Prevents duplicate check-ins via unique constraint.
 */
export async function checkIn(userId: string, eventSessionId: string) {
  // Look up the event session to find the parent event
  const eventSession = await prisma.eventSession.findUnique({
    where: { id: eventSessionId },
    select: { eventId: true },
  });

  if (!eventSession) {
    throw new AttendanceServiceError("Event session not found", "SESSION_NOT_FOUND");
  }

  // Verify user has a registration for the parent event
  const registration = await prisma.registration.findUnique({
    where: {
      userId_eventId: {
        userId,
        eventId: eventSession.eventId,
      },
    },
  });

  if (!registration || registration.status !== "REGISTERED") {
    throw new AttendanceServiceError("User is not registered for this event", "NOT_REGISTERED");
  }

  // Create attendance record; unique constraint prevents duplicates
  try {
    const attendance = await prisma.attendance.create({
      data: {
        userId,
        eventSessionId,
      },
    });
    return attendance;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AttendanceServiceError(
        "User has already checked in to this session",
        "ALREADY_CHECKED_IN"
      );
    }
    throw error;
  }
}

/**
 * Mark an attendance record as late with the number of late minutes.
 */
export async function markLate(attendanceId: string, lateMinutes: number) {
  const attendance = await prisma.attendance.findUnique({
    where: { id: attendanceId },
  });

  if (!attendance) {
    throw new AttendanceServiceError("Attendance record not found", "ATTENDANCE_NOT_FOUND");
  }

  return prisma.attendance.update({
    where: { id: attendanceId },
    data: {
      isLate: true,
      lateMinutes,
    },
  });
}

/**
 * Get all attendance records for a given event session, including user info.
 */
export async function getAttendanceBySession(eventSessionId: string) {
  return prisma.attendance.findMany({
    where: { eventSessionId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
    orderBy: { checkedInAt: "asc" },
  });
}

/**
 * Get all attendance records for a user across all sessions of a given event.
 */
export async function getAttendanceByUser(userId: string, eventId: string) {
  return prisma.attendance.findMany({
    where: {
      userId,
      eventSession: {
        eventId,
      },
    },
    include: {
      eventSession: {
        select: {
          id: true,
          sessionNo: true,
          sessionDate: true,
          startTime: true,
          endTime: true,
          topic: true,
        },
      },
    },
    orderBy: {
      eventSession: {
        sessionNo: "asc",
      },
    },
  });
}

/**
 * Bulk check-in multiple users to an event session.
 * Skips users who are already checked in.
 * Returns the newly created attendance records.
 */
export async function bulkCheckIn(eventSessionId: string, userIds: string[]) {
  // Verify the event session exists
  const eventSession = await prisma.eventSession.findUnique({
    where: { id: eventSessionId },
    select: { eventId: true },
  });

  if (!eventSession) {
    throw new AttendanceServiceError("Event session not found", "SESSION_NOT_FOUND");
  }

  // Find users who are already checked in for this session
  const existing = await prisma.attendance.findMany({
    where: {
      eventSessionId,
      userId: { in: userIds },
    },
    select: { userId: true },
  });

  const existingUserIds = new Set(existing.map((a) => a.userId));
  const newUserIds = userIds.filter((id) => !existingUserIds.has(id));

  if (newUserIds.length === 0) {
    return { created: [], skipped: userIds.length };
  }

  // Verify all new users have registrations for the parent event
  const registrations = await prisma.registration.findMany({
    where: {
      eventId: eventSession.eventId,
      userId: { in: newUserIds },
      status: "REGISTERED",
    },
    select: { userId: true },
  });

  const registeredUserIds = new Set(registrations.map((r) => r.userId));
  const eligibleUserIds = newUserIds.filter((id) => registeredUserIds.has(id));

  // Bulk create attendance records
  const created = await prisma.$transaction(
    eligibleUserIds.map((userId) =>
      prisma.attendance.create({
        data: {
          userId,
          eventSessionId,
        },
      })
    )
  );

  return {
    created,
    skipped: userIds.length - eligibleUserIds.length,
  };
}

/**
 * Get session info for the public check-in page.
 * Returns session + event details, plus the user's attendance record if authenticated.
 */
export async function getCheckInSession(sessionId: string, userId?: string) {
  const eventSession = await prisma.eventSession.findUnique({
    where: { id: sessionId },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          type: true,
          status: true,
        },
      },
    },
  });

  if (!eventSession) {
    throw new AttendanceServiceError("Session not found", "SESSION_NOT_FOUND");
  }

  let attendance = null;
  if (userId) {
    const existing = await prisma.attendance.findUnique({
      where: {
        userId_eventSessionId: { userId, eventSessionId: sessionId },
      },
      select: { id: true, checkedInAt: true },
    });
    if (existing) {
      attendance = { id: existing.id, checkInTime: existing.checkedInAt };
    }
  }

  return {
    session: {
      id: eventSession.id,
      sessionNo: eventSession.sessionNo,
      sessionDate: eventSession.sessionDate,
      startTime: eventSession.startTime,
      endTime: eventSession.endTime,
      topic: eventSession.topic,
    },
    event: {
      id: eventSession.event.id,
      title: eventSession.event.title,
      location: eventSession.event.location,
    },
    attendance,
  };
}

/**
 * Get all attendance records (userId + eventSessionId) across all sessions for an event.
 * Used by the attendance overview to build a user × session matrix.
 */
export async function getAttendanceSummaryByEvent(eventId: string) {
  return prisma.attendance.findMany({
    where: { eventSession: { eventId } },
    select: { userId: true, eventSessionId: true },
  });
}
