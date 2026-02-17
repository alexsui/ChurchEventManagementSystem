import { prisma } from "@/lib/prisma";
import {
  RegistrationStatus,
  EventStatus,
} from "@/generated/prisma/client";

/**
 * Register a user for an event.
 *
 * - Event must be OPEN.
 * - User must not already have an active (REGISTERED / WAITLISTED) registration.
 * - If maxParticipants is set and the event is full, the registration is WAITLISTED.
 */
export async function registerForEvent(userId: string, eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });

  if (!event) {
    throw new Error("Event not found");
  }

  if (event.status !== EventStatus.OPEN) {
    throw new Error("Event is not open for registration");
  }

  // Check for an existing active registration (REGISTERED or WAITLISTED)
  const existing = await prisma.registration.findUnique({
    where: { userId_eventId: { userId, eventId } },
  });

  if (existing && existing.status !== RegistrationStatus.CANCELLED) {
    throw new Error("User is already registered for this event");
  }

  // Determine status based on capacity
  let status: RegistrationStatus = RegistrationStatus.REGISTERED;

  if (event.maxParticipants !== null) {
    const registeredCount = await prisma.registration.count({
      where: {
        eventId,
        status: RegistrationStatus.REGISTERED,
      },
    });

    if (registeredCount >= event.maxParticipants) {
      status = RegistrationStatus.WAITLISTED;
    }
  }

  // If the user previously cancelled, update the existing row; otherwise create new
  if (existing && existing.status === RegistrationStatus.CANCELLED) {
    return prisma.registration.update({
      where: { id: existing.id },
      data: { status },
    });
  }

  return prisma.registration.create({
    data: {
      userId,
      eventId,
      status,
    },
  });
}

/**
 * Cancel a registration.
 *
 * After cancellation, if there are waitlisted users for the event,
 * promote the first one (oldest createdAt) to REGISTERED.
 */
export async function cancelRegistration(userId: string, eventId: string) {
  const registration = await prisma.registration.findUnique({
    where: { userId_eventId: { userId, eventId } },
  });

  if (!registration) {
    throw new Error("Registration not found");
  }

  if (registration.status === RegistrationStatus.CANCELLED) {
    throw new Error("Registration is already cancelled");
  }

  const cancelled = await prisma.registration.update({
    where: { id: registration.id },
    data: { status: RegistrationStatus.CANCELLED },
  });

  // Promote first waitlisted user if the cancelled registration was REGISTERED
  if (registration.status === RegistrationStatus.REGISTERED) {
    const firstWaitlisted = await prisma.registration.findFirst({
      where: {
        eventId,
        status: RegistrationStatus.WAITLISTED,
      },
      orderBy: { createdAt: "asc" },
    });

    if (firstWaitlisted) {
      await prisma.registration.update({
        where: { id: firstWaitlisted.id },
        data: { status: RegistrationStatus.REGISTERED },
      });
    }
  }

  return cancelled;
}

/**
 * Get all registrations for an event, including user information.
 */
export async function getRegistrationsByEvent(eventId: string) {
  return prisma.registration.findMany({
    where: { eventId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Get all registrations for a user, including event information.
 */
export async function getRegistrationsByUser(userId: string) {
  return prisma.registration.findMany({
    where: { userId },
    include: { event: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get registration counts for an event grouped by status.
 */
export async function getRegistrationCount(eventId: string) {
  const [registered, waitlisted, cancelled] = await Promise.all([
    prisma.registration.count({
      where: { eventId, status: RegistrationStatus.REGISTERED },
    }),
    prisma.registration.count({
      where: { eventId, status: RegistrationStatus.WAITLISTED },
    }),
    prisma.registration.count({
      where: { eventId, status: RegistrationStatus.CANCELLED },
    }),
  ]);

  return { registered, waitlisted, cancelled };
}
