import { prisma } from "@/lib/prisma";

export class AssignmentServiceError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "AssignmentServiceError";
  }
}

/**
 * Create a new assignment for a given event session.
 * Verifies the session exists before creating.
 */
export async function createAssignment(
  eventSessionId: string,
  title: string
) {
  const session = await prisma.eventSession.findUnique({
    where: { id: eventSessionId },
  });

  if (!session) {
    throw new AssignmentServiceError(
      "Event session not found",
      "SESSION_NOT_FOUND"
    );
  }

  return prisma.assignment.create({
    data: { eventSessionId, title },
  });
}

/**
 * Delete an assignment by ID.
 * Verifies the assignment exists before deleting.
 */
export async function deleteAssignment(id: string) {
  const assignment = await prisma.assignment.findUnique({
    where: { id },
  });

  if (!assignment) {
    throw new AssignmentServiceError(
      "Assignment not found",
      "ASSIGNMENT_NOT_FOUND"
    );
  }

  return prisma.assignment.delete({
    where: { id },
  });
}

/**
 * Get all assignments for a given event session, with completion counts.
 */
export async function getAssignmentsBySession(eventSessionId: string) {
  return prisma.assignment.findMany({
    where: { eventSessionId },
    include: { _count: { select: { completions: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Get all assignments across all sessions of a given event,
 * with completion counts and session info.
 */
export async function getAssignmentsByEvent(eventId: string) {
  const sessions = await prisma.eventSession.findMany({
    where: { eventId },
    select: { id: true },
  });

  const sessionIds = sessions.map((s) => s.id);

  return prisma.assignment.findMany({
    where: { eventSessionId: { in: sessionIds } },
    include: {
      _count: { select: { completions: true } },
      eventSession: { select: { sessionNo: true, topic: true } },
    },
    orderBy: { eventSession: { sessionNo: "asc" } },
  });
}

/**
 * Get all completions for an assignment, with user info.
 */
export async function getCompletionsByAssignment(assignmentId: string) {
  return prisma.assignmentCompletion.findMany({
    where: { assignmentId },
    include: {
      user: {
        select: { id: true, name: true, phone: true },
      },
    },
    orderBy: { completedAt: "asc" },
  });
}

/**
 * Mark an assignment as complete for one or more users.
 * Skips users who have already completed the assignment.
 * Returns { created, skipped } counts.
 */
export async function markComplete(
  assignmentId: string,
  userIds: string[],
  completedById: string
) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
  });

  if (!assignment) {
    throw new AssignmentServiceError(
      "Assignment not found",
      "ASSIGNMENT_NOT_FOUND"
    );
  }

  // Find existing completions to skip duplicates
  const existing = await prisma.assignmentCompletion.findMany({
    where: {
      assignmentId,
      userId: { in: userIds },
    },
    select: { userId: true },
  });

  const existingUserIds = new Set(existing.map((c) => c.userId));
  const newUserIds = userIds.filter((id) => !existingUserIds.has(id));
  const skipped = userIds.length - newUserIds.length;

  if (newUserIds.length === 0) {
    return { created: 0, skipped };
  }

  const result = await prisma.assignmentCompletion.createMany({
    data: newUserIds.map((userId) => ({
      assignmentId,
      userId,
      completedById,
    })),
    skipDuplicates: true,
  });

  return { created: result.count, skipped };
}

/**
 * Remove a completion record for a specific assignment and user.
 */
export async function removeCompletion(assignmentId: string, userId: string) {
  return prisma.assignmentCompletion.deleteMany({
    where: { assignmentId, userId },
  });
}

/**
 * Get the completion rate for a user across all assignments of an event.
 * Returns { completed, total, rate }.
 * If total=0 (no assignments), rate=1 (doesn't block certificates).
 */
export async function getCompletionRate(userId: string, eventId: string) {
  // Find all sessions for the event
  const sessions = await prisma.eventSession.findMany({
    where: { eventId },
    select: { id: true },
  });

  const sessionIds = sessions.map((s) => s.id);

  // Find all assignments across those sessions
  const assignments = await prisma.assignment.findMany({
    where: { eventSessionId: { in: sessionIds } },
    select: { id: true },
  });

  const total = assignments.length;

  if (total === 0) {
    return { completed: 0, total: 0, rate: 1 };
  }

  const assignmentIds = assignments.map((a) => a.id);

  // Find completions for this user
  const completions = await prisma.assignmentCompletion.findMany({
    where: {
      assignmentId: { in: assignmentIds },
      userId,
    },
    select: { assignmentId: true },
  });

  const completed = completions.length;

  return { completed, total, rate: completed / total };
}
