import { prisma } from "@/lib/prisma";
import { RegistrationStatus, EventStatus, FormFieldType } from "@/generated/prisma/client";

export class RegistrationServiceError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "RegistrationServiceError";
  }
}

/**
 * Register a user for an event, optionally with form responses.
 *
 * - Event must be OPEN.
 * - User must not already have an active (REGISTERED / WAITLISTED) registration.
 * - If maxParticipants is set and the event is full, the registration is WAITLISTED.
 * - If formResponses are provided, validates them against the event's form fields.
 * - Re-registration after cancellation deletes old responses and creates fresh ones.
 */
export async function registerForEvent(
  userId: string,
  eventId: string,
  formResponses?: { fieldId: string; value: string }[]
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });

  if (!event) {
    throw new RegistrationServiceError("Event not found", "EVENT_NOT_FOUND");
  }

  if (event.status !== EventStatus.OPEN) {
    throw new RegistrationServiceError("Event is not open for registration", "EVENT_NOT_OPEN");
  }

  // Check for an existing active registration (REGISTERED or WAITLISTED)
  const existing = await prisma.registration.findUnique({
    where: { userId_eventId: { userId, eventId } },
  });

  if (existing && existing.status !== RegistrationStatus.CANCELLED) {
    throw new RegistrationServiceError(
      "User is already registered for this event",
      "ALREADY_REGISTERED"
    );
  }

  // Validate form responses if provided
  if (formResponses && formResponses.length > 0) {
    await validateFormResponses(eventId, formResponses);
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

  // Use transaction for atomicity of registration + responses
  return prisma.$transaction(async (tx) => {
    let registration;

    if (existing && existing.status === RegistrationStatus.CANCELLED) {
      // Re-registration: delete old responses, update status
      await tx.eventFormResponse.deleteMany({
        where: { registrationId: existing.id },
      });
      registration = await tx.registration.update({
        where: { id: existing.id },
        data: { status },
      });
    } else {
      registration = await tx.registration.create({
        data: { userId, eventId, status },
      });
    }

    // Create form responses if provided
    if (formResponses && formResponses.length > 0) {
      await tx.eventFormResponse.createMany({
        data: formResponses.map((r) => ({
          registrationId: registration.id,
          fieldId: r.fieldId,
          value: r.value,
        })),
      });
    }

    return registration;
  });
}

/**
 * Validate form responses against the event's form fields.
 */
async function validateFormResponses(
  eventId: string,
  responses: { fieldId: string; value: string }[]
) {
  const fields = await prisma.eventFormField.findMany({
    where: { eventId },
  });

  const fieldMap = new Map(fields.map((f) => [f.id, f]));
  const responseMap = new Map(responses.map((r) => [r.fieldId, r.value]));

  // Check all fieldIds belong to this event
  for (const response of responses) {
    if (!fieldMap.has(response.fieldId)) {
      throw new RegistrationServiceError("表單欄位不屬於此活動", "INVALID_FORM_RESPONSES");
    }
  }

  // Check required fields have non-empty values
  for (const field of fields) {
    if (field.required) {
      const value = responseMap.get(field.id);
      if (!value || value.trim() === "") {
        throw new RegistrationServiceError(
          `「${field.label}」為必填欄位`,
          "INVALID_FORM_RESPONSES"
        );
      }
    }
  }

  // Check value constraints per type
  for (const response of responses) {
    const field = fieldMap.get(response.fieldId)!;
    if (response.value === "") continue; // empty optional fields are fine

    if (field.type === FormFieldType.YES_NO) {
      if (response.value !== "是" && response.value !== "否") {
        throw new RegistrationServiceError(
          `「${field.label}」的值必須為「是」或「否」`,
          "INVALID_FORM_RESPONSES"
        );
      }
    }

    if (field.type === FormFieldType.SINGLE_CHOICE) {
      if (!field.options.includes(response.value)) {
        throw new RegistrationServiceError(
          `「${field.label}」的值不在可選範圍內`,
          "INVALID_FORM_RESPONSES"
        );
      }
    }
  }
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
    throw new RegistrationServiceError("Registration not found", "REGISTRATION_NOT_FOUND");
  }

  if (registration.status === RegistrationStatus.CANCELLED) {
    throw new RegistrationServiceError("Registration is already cancelled", "ALREADY_CANCELLED");
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
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true, role: true },
      },
      formResponses: {
        include: {
          field: {
            select: { id: true, type: true, label: true, sortOrder: true },
          },
        },
        orderBy: { field: { sortOrder: "asc" } },
      },
    },
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
 * Get a user's active registration for an event, if any.
 * Returns the registration if REGISTERED or WAITLISTED, or null.
 */
export async function getUserRegistrationForEvent(userId: string, eventId: string) {
  const registration = await prisma.registration.findUnique({
    where: { userId_eventId: { userId, eventId } },
  });

  if (!registration || registration.status === RegistrationStatus.CANCELLED) {
    return null;
  }

  return registration;
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
