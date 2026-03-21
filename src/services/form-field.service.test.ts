import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    eventFormField: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    eventFormResponse: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import {
  getFormFieldsByEvent,
  upsertFormFields,
  getFormResponsesByRegistration,
} from "./form-field.service";

const mockPrisma = prisma as unknown as {
  eventFormField: {
    findMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  eventFormResponse: {
    findMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getFormFieldsByEvent", () => {
  it("returns fields ordered by sortOrder", async () => {
    const fields = [
      { id: "f1", type: "TEXT", label: "Q1", sortOrder: 0 },
      { id: "f2", type: "YES_NO", label: "Q2", sortOrder: 1 },
    ];
    mockPrisma.eventFormField.findMany.mockResolvedValue(fields);

    const result = await getFormFieldsByEvent("event1");

    expect(result).toEqual(fields);
    expect(mockPrisma.eventFormField.findMany).toHaveBeenCalledWith({
      where: { eventId: "event1" },
      orderBy: { sortOrder: "asc" },
    });
  });

  it("returns empty array when no fields exist", async () => {
    mockPrisma.eventFormField.findMany.mockResolvedValue([]);

    const result = await getFormFieldsByEvent("event1");

    expect(result).toEqual([]);
  });
});

describe("upsertFormFields", () => {
  it("creates new fields when none exist", async () => {
    const fields = [
      { type: "TEXT" as const, label: "Name", options: [], required: true, sortOrder: 0 },
    ];

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        eventFormField: {
          findMany: vi.fn().mockResolvedValue([]),
          deleteMany: vi.fn(),
          create: vi.fn().mockResolvedValue({ id: "new1", ...fields[0], eventId: "e1" }),
        },
      };
      return fn(tx);
    });

    const result = await upsertFormFields("e1", fields);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ label: "Name" });
  });

  it("updates existing fields and deletes removed ones", async () => {
    const existingFields = [{ id: "f1" }, { id: "f2" }];

    const inputFields = [
      {
        id: "f1",
        type: "TEXT" as const,
        label: "Updated",
        options: [],
        required: false,
        sortOrder: 0,
      },
    ];

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        eventFormField: {
          findMany: vi.fn().mockResolvedValue(existingFields),
          deleteMany: vi.fn(),
          update: vi.fn().mockResolvedValue({ id: "f1", label: "Updated" }),
        },
      };
      return fn(tx);
    });

    const result = await upsertFormFields("e1", inputFields);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ label: "Updated" });
  });
});

describe("getFormResponsesByRegistration", () => {
  it("returns responses with field metadata", async () => {
    const responses = [
      {
        id: "r1",
        registrationId: "reg1",
        fieldId: "f1",
        value: "test",
        field: { id: "f1", type: "TEXT", label: "Q1", options: [], required: true, sortOrder: 0 },
      },
    ];
    mockPrisma.eventFormResponse.findMany.mockResolvedValue(responses);

    const result = await getFormResponsesByRegistration("reg1");

    expect(result).toEqual(responses);
    expect(mockPrisma.eventFormResponse.findMany).toHaveBeenCalledWith({
      where: { registrationId: "reg1" },
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
  });
});
