import { prisma } from "@/lib/prisma";
import type { FormFieldType } from "@/generated/prisma/client";

export interface FormFieldInput {
  id?: string;
  type: FormFieldType;
  label: string;
  options?: string[];
  required?: boolean;
  sortOrder: number;
}

/**
 * Get all form fields for an event, ordered by sortOrder ascending.
 */
export async function getFormFieldsByEvent(eventId: string) {
  return prisma.eventFormField.findMany({
    where: { eventId },
    orderBy: { sortOrder: "asc" },
  });
}

/**
 * Sync form fields for an event.
 *
 * Accepts the complete desired list of fields. Uses a transaction to:
 * 1. Delete fields that are no longer in the list (cascade deletes their responses)
 * 2. Upsert each field (create if no id, update if id exists)
 *
 * Returns the final list of fields.
 */
export async function upsertFormFields(eventId: string, fields: FormFieldInput[]) {
  return prisma.$transaction(async (tx) => {
    // Get existing field IDs
    const existing = await tx.eventFormField.findMany({
      where: { eventId },
      select: { id: true },
    });

    const incomingIds = new Set(fields.filter((f) => f.id).map((f) => f.id!));
    const toDelete = existing.filter((e) => !incomingIds.has(e.id)).map((e) => e.id);

    // Delete removed fields (cascade deletes responses)
    if (toDelete.length > 0) {
      await tx.eventFormField.deleteMany({
        where: { id: { in: toDelete } },
      });
    }

    // Upsert each field
    const results = [];
    for (const field of fields) {
      if (field.id) {
        const updated = await tx.eventFormField.update({
          where: { id: field.id },
          data: {
            type: field.type,
            label: field.label,
            options: field.options ?? [],
            required: field.required ?? false,
            sortOrder: field.sortOrder,
          },
        });
        results.push(updated);
      } else {
        const created = await tx.eventFormField.create({
          data: {
            eventId,
            type: field.type,
            label: field.label,
            options: field.options ?? [],
            required: field.required ?? false,
            sortOrder: field.sortOrder,
          },
        });
        results.push(created);
      }
    }

    return results;
  });
}

/**
 * Get form responses for a registration, including field metadata.
 */
export async function getFormResponsesByRegistration(registrationId: string) {
  return prisma.eventFormResponse.findMany({
    where: { registrationId },
    include: {
      field: {
        select: {
          id: true,
          type: true,
          label: true,
          options: true,
          required: true,
          sortOrder: true,
        },
      },
    },
    orderBy: { field: { sortOrder: "asc" } },
  });
}
