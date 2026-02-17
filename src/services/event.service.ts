import { prisma } from "@/lib/prisma";
import {
  EventType,
  EventStatus,
  EventCategory,
  RegistrationMode,
} from "@/generated/prisma/client";

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
  registrationMode?: RegistrationMode;
  maxParticipants?: number;
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
  registrationMode?: RegistrationMode;
  maxParticipants?: number | null;
}

export interface EventFilters {
  status?: EventStatus;
  type?: EventType;
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
      throw new Error(
        "SERIES events require at least one session in the sessions array"
      );
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
      registrationMode: data.registrationMode ?? RegistrationMode.FULL_SERIES,
      maxParticipants: data.maxParticipants,
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

  const events = await prisma.event.findMany({
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
  });

  return events;
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

  return event;
}

/**
 * Update event details.
 */
export async function updateEvent(id: string, data: UpdateEventInput) {
  const event = await prisma.event.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      location: data.location,
      category: data.category,
      type: data.type,
      registrationMode: data.registrationMode,
      maxParticipants: data.maxParticipants,
    },
    include: {
      eventSessions: true,
    },
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
