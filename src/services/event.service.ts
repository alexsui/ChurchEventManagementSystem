import { prisma } from "@/lib/prisma";
import { EventType, EventStatus, EventCategory } from "@/generated/prisma/client";

// ==================== Types ====================

export interface CreateSessionInput {
  sessionNo: number;
  sessionDate: string | Date;
  startTime?: string;
  endTime?: string;
  topic?: string;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  location?: string;
  category?: EventCategory;
  type?: EventType;
  status?: EventStatus;
  maxParticipants?: number;
  minAssignmentRate?: number;
  /** Required for SINGLE type: single session data */
  session?: CreateSessionInput;
  /** Required for SERIES type: array of session data */
  sessions?: CreateSessionInput[];
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  location?: string;
  category?: EventCategory | null;
  type?: EventType;
  maxParticipants?: number | null;
  minAssignmentRate?: number | null;
  session?: CreateSessionInput;
  sessions?: CreateSessionInput[];
}

export interface EventFilters {
  status?: EventStatus;
  type?: EventType;
  skip?: number;
  take?: number;
}

// ==================== Helper Functions ====================

export function computeEffectiveStatus(
  storedStatus: EventStatus,
  sessions: { sessionDate: Date; endTime?: string | null }[]
): EventStatus {
  if (storedStatus === EventStatus.PLANNING || storedStatus === EventStatus.COMPLETED) {
    return storedStatus;
  }
  if (sessions.length === 0) return storedStatus;

  const now = new Date();
  const firstDate = new Date(sessions[0].sessionDate);
  const lastSession = sessions[sessions.length - 1];
  const lastDate = new Date(lastSession.sessionDate);

  // If the last session has an endTime, use it for the cutoff.
  // Otherwise, fall back to the day after the last session date.
  let completedCutoff: Date;
  if (lastSession.endTime) {
    const [hours, minutes] = lastSession.endTime.split(":").map(Number);
    completedCutoff = new Date(lastDate);
    completedCutoff.setHours(hours, minutes, 0, 0);
  } else {
    completedCutoff = new Date(lastDate);
    completedCutoff.setDate(completedCutoff.getDate() + 1);
  }

  if (now >= completedCutoff) return EventStatus.COMPLETED;
  if (now >= firstDate) return EventStatus.IN_PROGRESS;
  return storedStatus;
}

// ==================== Service Functions ====================

/**
 * Create a new event with auto-created EventSession(s).
 * - SINGLE type: creates 1 EventSession from `session` field
 * - SERIES type: creates N EventSessions from `sessions` array
 */
export async function createEvent(data: CreateEventInput) {
  const eventType = data.type ?? EventType.SINGLE;

  let sessionsToCreate: CreateSessionInput[];

  if (eventType === EventType.SERIES) {
    if (!data.sessions || data.sessions.length === 0) {
      throw new Error("SERIES events require at least one session in the sessions array");
    }
    sessionsToCreate = data.sessions;
  } else {
    // SINGLE type
    if (!data.session) {
      throw new Error("SINGLE events require a session object");
    }
    sessionsToCreate = [data.session];
  }

  const event = await prisma.event.create({
    data: {
      title: data.title,
      description: data.description,
      location: data.location,
      category: data.category,
      type: eventType,
      status: data.status ?? EventStatus.PLANNING,
      maxParticipants: data.maxParticipants,
      minAssignmentRate: data.minAssignmentRate,
      eventSessions: {
        create: sessionsToCreate.map((s) => ({
          sessionNo: s.sessionNo,
          sessionDate: new Date(s.sessionDate),
          startTime: s.startTime,
          endTime: s.endTime,
          topic: s.topic,
        })),
      },
    },
    include: {
      eventSessions: true,
    },
  });

  return event;
}

/**
 * List events with optional filters, including session count and registration count.
 */
export async function getEvents(filters?: EventFilters) {
  const where: Record<string, unknown> = {};
  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.type) {
    where.type = filters.type;
  }

  const [rawEvents, total] = await Promise.all([
    prisma.event.findMany({
      where,
      include: {
        eventSessions: {
          orderBy: { sessionNo: "asc" },
        },
        _count: {
          select: {
            eventSessions: true,
            registrations: {
              where: { status: { not: "CANCELLED" } },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: filters?.skip,
      take: filters?.take,
    }),
    prisma.event.count({ where }),
  ]);

  const events = rawEvents.map((event) => ({
    ...event,
    status: computeEffectiveStatus(event.status, event.eventSessions),
  }));

  return { events, total };
}

/**
 * Get a single event by ID with sessions and registration count.
 */
export async function getEventById(id: string) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      eventSessions: {
        orderBy: { sessionNo: "asc" },
      },
      _count: {
        select: {
          registrations: {
            where: { status: { not: "CANCELLED" } },
          },
        },
      },
    },
  });

  if (!event) return null;

  return {
    ...event,
    status: computeEffectiveStatus(event.status, event.eventSessions),
  };
}

/**
 * Update event details. If session/sessions data is provided,
 * upserts sessions by eventId+sessionNo and removes any excess sessions.
 */
export async function updateEvent(id: string, data: UpdateEventInput) {
  const sessionsInput = data.sessions ?? (data.session ? [data.session] : undefined);

  if (!sessionsInput) {
    // No session changes — simple update
    const event = await prisma.event.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        location: data.location,
        category: data.category,
        type: data.type,
        maxParticipants: data.maxParticipants,
        minAssignmentRate: data.minAssignmentRate,
      },
      include: {
        eventSessions: true,
      },
    });
    return event;
  }

  // Use transaction to update event + upsert sessions atomically
  const event = await prisma.$transaction(async (tx) => {
    const updated = await tx.event.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        location: data.location,
        category: data.category,
        type: data.type,
        maxParticipants: data.maxParticipants,
        minAssignmentRate: data.minAssignmentRate,
      },
    });

    // Upsert each session by unique (eventId, sessionNo)
    for (const s of sessionsInput) {
      await tx.eventSession.upsert({
        where: {
          eventId_sessionNo: { eventId: id, sessionNo: s.sessionNo },
        },
        update: {
          sessionDate: new Date(s.sessionDate),
          startTime: s.startTime,
          endTime: s.endTime,
          topic: s.topic,
        },
        create: {
          eventId: id,
          sessionNo: s.sessionNo,
          sessionDate: new Date(s.sessionDate),
          startTime: s.startTime,
          endTime: s.endTime,
          topic: s.topic,
        },
      });
    }

    // Remove sessions beyond the new count
    const maxSessionNo = Math.max(...sessionsInput.map((s) => s.sessionNo));
    await tx.eventSession.deleteMany({
      where: {
        eventId: id,
        sessionNo: { gt: maxSessionNo },
      },
    });

    // Return the updated event with sessions
    return tx.event.findUniqueOrThrow({
      where: { id: updated.id },
      include: { eventSessions: true },
    });
  });

  return event;
}

/**
 * Delete an event (cascading to sessions via Prisma relation onDelete: Cascade).
 */
export async function deleteEvent(id: string) {
  await prisma.event.delete({
    where: { id },
  });
}

/**
 * Update only the event status.
 */
export async function updateEventStatus(id: string, status: EventStatus) {
  const event = await prisma.event.update({
    where: { id },
    data: { status },
  });

  return event;
}
