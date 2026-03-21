import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing the service
vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    eventSession: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  updateEventStatus,
  computeEffectiveStatus,
} from "@/services/event.service";

const mockedPrisma = vi.mocked(prisma, true);

describe("Event Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== createEvent ====================

  describe("createEvent", () => {
    it("creates a SINGLE event with one session", async () => {
      const mockEvent = {
        id: "evt-1",
        title: "Sunday Service",
        description: "Weekly service",
        location: "Main Hall",
        type: "SINGLE",
        status: "PLANNING",

        maxParticipants: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        eventSessions: [
          {
            id: "ses-1",
            eventId: "evt-1",
            sessionNo: 1,
            sessionDate: new Date("2026-03-01"),
            startTime: "10:00",
            endTime: "12:00",
            topic: "Worship",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockedPrisma.event.create.mockResolvedValue(mockEvent as never);

      const result = await createEvent({
        title: "Sunday Service",
        description: "Weekly service",
        location: "Main Hall",
        session: {
          sessionNo: 1,
          sessionDate: "2026-03-01",
          startTime: "10:00",
          endTime: "12:00",
          topic: "Worship",
        },
      });

      expect(result).toEqual(mockEvent);
      expect(mockedPrisma.event.create).toHaveBeenCalledOnce();
      expect(mockedPrisma.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Sunday Service",
            type: "SINGLE",
            eventSessions: {
              create: [
                expect.objectContaining({
                  sessionNo: 1,
                  startTime: "10:00",
                  endTime: "12:00",
                  topic: "Worship",
                }),
              ],
            },
          }),
          include: { eventSessions: true },
        })
      );
    });

    it("creates a SERIES event with multiple sessions", async () => {
      const mockEvent = {
        id: "evt-2",
        title: "Bible Study Series",
        description: "8-week study",
        location: "Room A",
        type: "SERIES",
        status: "PLANNING",

        maxParticipants: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
        eventSessions: [
          {
            id: "ses-2a",
            eventId: "evt-2",
            sessionNo: 1,
            sessionDate: new Date("2026-03-01"),
            startTime: "19:00",
            endTime: "21:00",
            topic: "Genesis",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "ses-2b",
            eventId: "evt-2",
            sessionNo: 2,
            sessionDate: new Date("2026-03-08"),
            startTime: "19:00",
            endTime: "21:00",
            topic: "Exodus",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockedPrisma.event.create.mockResolvedValue(mockEvent as never);

      const result = await createEvent({
        title: "Bible Study Series",
        description: "8-week study",
        location: "Room A",
        type: "SERIES",
        maxParticipants: 30,
        sessions: [
          {
            sessionNo: 1,
            sessionDate: "2026-03-01",
            startTime: "19:00",
            endTime: "21:00",
            topic: "Genesis",
          },
          {
            sessionNo: 2,
            sessionDate: "2026-03-08",
            startTime: "19:00",
            endTime: "21:00",
            topic: "Exodus",
          },
        ],
      });

      expect(result).toEqual(mockEvent);
      expect(mockedPrisma.event.create).toHaveBeenCalledOnce();
      expect(mockedPrisma.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Bible Study Series",
            type: "SERIES",
            maxParticipants: 30,
            eventSessions: {
              create: expect.arrayContaining([
                expect.objectContaining({ sessionNo: 1, topic: "Genesis" }),
                expect.objectContaining({ sessionNo: 2, topic: "Exodus" }),
              ]),
            },
          }),
        })
      );
    });

    it("throws error when SINGLE event has no session", async () => {
      await expect(
        createEvent({
          title: "Bad Event",
          type: "SINGLE",
        })
      ).rejects.toThrow("SINGLE events require a session object");
    });

    it("throws error when SERIES event has no sessions", async () => {
      await expect(
        createEvent({
          title: "Bad Series",
          type: "SERIES",
          sessions: [],
        })
      ).rejects.toThrow("SERIES events require at least one session in the sessions array");
    });

    it("throws error when SERIES event has undefined sessions", async () => {
      await expect(
        createEvent({
          title: "Bad Series",
          type: "SERIES",
        })
      ).rejects.toThrow("SERIES events require at least one session in the sessions array");
    });

    it("defaults to SINGLE type and PLANNING status", async () => {
      const mockEvent = {
        id: "evt-3",
        title: "Default Event",
        description: undefined,
        location: undefined,
        type: "SINGLE",
        status: "PLANNING",

        maxParticipants: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        eventSessions: [],
      };

      mockedPrisma.event.create.mockResolvedValue(mockEvent as never);

      await createEvent({
        title: "Default Event",
        session: {
          sessionNo: 1,
          sessionDate: "2026-04-01",
        },
      });

      expect(mockedPrisma.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "SINGLE",
            status: "PLANNING",
          }),
        })
      );
    });
  });

  // ==================== getEvents ====================

  describe("getEvents", () => {
    it("returns all events with session and registration counts", async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const mockEvents = [
        {
          id: "evt-1",
          title: "Event 1",
          description: null,
          location: null,
          type: "SINGLE",
          status: "OPEN",

          maxParticipants: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          eventSessions: [{ sessionDate: futureDate }],
          _count: { eventSessions: 1, registrations: 5 },
        },
        {
          id: "evt-2",
          title: "Event 2",
          description: null,
          location: null,
          type: "SERIES",
          status: "PLANNING",

          maxParticipants: 20,
          createdAt: new Date(),
          updatedAt: new Date(),
          eventSessions: [],
          _count: { eventSessions: 4, registrations: 10 },
        },
      ];

      mockedPrisma.event.findMany.mockResolvedValue(mockEvents as never);
      mockedPrisma.event.count.mockResolvedValue(2 as never);

      const result = await getEvents();

      expect(result.events).toEqual(mockEvents);
      expect(result.total).toBe(2);
      expect(mockedPrisma.event.findMany).toHaveBeenCalledWith({
        where: {},
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
        orderBy: { createdAt: "desc" },
        skip: undefined,
        take: undefined,
      });
    });

    it("applies status filter", async () => {
      mockedPrisma.event.findMany.mockResolvedValue([] as never);
      mockedPrisma.event.count.mockResolvedValue(0 as never);

      await getEvents({ status: "OPEN" });

      expect(mockedPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "OPEN" },
        })
      );
    });

    it("applies type filter", async () => {
      mockedPrisma.event.findMany.mockResolvedValue([] as never);
      mockedPrisma.event.count.mockResolvedValue(0 as never);

      await getEvents({ type: "SERIES" });

      expect(mockedPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: "SERIES" },
        })
      );
    });

    it("applies both status and type filters", async () => {
      mockedPrisma.event.findMany.mockResolvedValue([] as never);
      mockedPrisma.event.count.mockResolvedValue(0 as never);

      await getEvents({ status: "OPEN", type: "SINGLE" });

      expect(mockedPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "OPEN", type: "SINGLE" },
        })
      );
    });
  });

  // ==================== getEventById ====================

  describe("getEventById", () => {
    it("returns event with sessions and registration count", async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const mockEvent = {
        id: "evt-1",
        title: "Sunday Service",
        description: "Weekly",
        location: "Hall",
        type: "SINGLE",
        status: "OPEN",

        maxParticipants: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        eventSessions: [
          {
            id: "ses-1",
            eventId: "evt-1",
            sessionNo: 1,
            sessionDate: futureDate,
            startTime: "10:00",
            endTime: "12:00",
            topic: "Worship",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        _count: { registrations: 15 },
      };

      mockedPrisma.event.findUnique.mockResolvedValue(mockEvent as never);

      const result = await getEventById("evt-1");

      expect(result).toEqual(mockEvent);
      expect(mockedPrisma.event.findUnique).toHaveBeenCalledWith({
        where: { id: "evt-1" },
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
    });

    it("returns null for non-existent event", async () => {
      mockedPrisma.event.findUnique.mockResolvedValue(null as never);

      const result = await getEventById("non-existent");
      expect(result).toBeNull();
    });
  });

  // ==================== updateEvent ====================

  describe("updateEvent", () => {
    it("updates event details", async () => {
      const mockUpdated = {
        id: "evt-1",
        title: "Updated Title",
        description: "Updated description",
        location: "New Hall",
        type: "SINGLE",
        status: "OPEN",

        maxParticipants: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
        eventSessions: [],
      };

      mockedPrisma.event.update.mockResolvedValue(mockUpdated as never);

      const result = await updateEvent("evt-1", {
        title: "Updated Title",
        description: "Updated description",
        location: "New Hall",
        maxParticipants: 50,
      });

      expect(result).toEqual(mockUpdated);
      expect(mockedPrisma.event.update).toHaveBeenCalledWith({
        where: { id: "evt-1" },
        data: {
          title: "Updated Title",
          description: "Updated description",
          location: "New Hall",
          type: undefined,
          maxParticipants: 50,
        },
        include: { eventSessions: true },
      });
    });

    it("upserts sessions and deletes excess in a transaction when session data provided", async () => {
      const mockUpdatedEvent = {
        id: "evt-1",
        title: "Event",
        eventSessions: [
          {
            id: "ses-1",
            eventId: "evt-1",
            sessionNo: 1,
            sessionDate: new Date("2026-03-01"),
            startTime: "09:00",
            endTime: "11:00",
            topic: "Updated Topic",
          },
        ],
      };

      // $transaction receives a callback; we execute it with a fake tx
      const fakeTx = {
        event: {
          update: vi.fn().mockResolvedValue({ id: "evt-1" }),
          findUniqueOrThrow: vi.fn().mockResolvedValue(mockUpdatedEvent),
        },
        eventSession: {
          upsert: vi.fn().mockResolvedValue({}),
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockedPrisma.$transaction.mockImplementation(async (cb: any) => cb(fakeTx));

      const result = await updateEvent("evt-1", {
        title: "Event",
        session: {
          sessionNo: 1,
          sessionDate: "2026-03-01",
          startTime: "09:00",
          endTime: "11:00",
          topic: "Updated Topic",
        },
      });

      expect(result).toEqual(mockUpdatedEvent);
      expect(mockedPrisma.$transaction).toHaveBeenCalledOnce();

      // Verify upsert was called with correct args
      expect(fakeTx.eventSession.upsert).toHaveBeenCalledWith({
        where: {
          eventId_sessionNo: { eventId: "evt-1", sessionNo: 1 },
        },
        update: {
          sessionDate: new Date("2026-03-01"),
          startTime: "09:00",
          endTime: "11:00",
          topic: "Updated Topic",
        },
        create: {
          eventId: "evt-1",
          sessionNo: 1,
          sessionDate: new Date("2026-03-01"),
          startTime: "09:00",
          endTime: "11:00",
          topic: "Updated Topic",
        },
      });

      // Verify excess sessions are deleted
      expect(fakeTx.eventSession.deleteMany).toHaveBeenCalledWith({
        where: {
          eventId: "evt-1",
          sessionNo: { gt: 1 },
        },
      });
    });
  });

  // ==================== deleteEvent ====================

  describe("deleteEvent", () => {
    it("deletes an event by id", async () => {
      mockedPrisma.event.delete.mockResolvedValue(undefined as never);

      await deleteEvent("evt-1");

      expect(mockedPrisma.event.delete).toHaveBeenCalledWith({
        where: { id: "evt-1" },
      });
    });
  });

  // ==================== updateEventStatus ====================

  describe("updateEventStatus", () => {
    it("updates only the event status", async () => {
      const mockUpdated = {
        id: "evt-1",
        title: "Event",
        description: null,
        location: null,
        type: "SINGLE",
        status: "OPEN",

        maxParticipants: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedPrisma.event.update.mockResolvedValue(mockUpdated as never);

      const result = await updateEventStatus("evt-1", "OPEN");

      expect(result).toEqual(mockUpdated);
      expect(mockedPrisma.event.update).toHaveBeenCalledWith({
        where: { id: "evt-1" },
        data: { status: "OPEN" },
      });
    });

    it("can transition status to COMPLETED", async () => {
      const mockUpdated = {
        id: "evt-1",
        title: "Event",
        description: null,
        location: null,
        type: "SINGLE",
        status: "COMPLETED",

        maxParticipants: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedPrisma.event.update.mockResolvedValue(mockUpdated as never);

      const result = await updateEventStatus("evt-1", "COMPLETED");

      expect(result.status).toBe("COMPLETED");
      expect(mockedPrisma.event.update).toHaveBeenCalledWith({
        where: { id: "evt-1" },
        data: { status: "COMPLETED" },
      });
    });
  });

  // ==================== computeEffectiveStatus ====================

  describe("computeEffectiveStatus", () => {
    const pastDate = new Date("2020-01-01");
    const farPastDate = new Date("2019-01-01");
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    it("OPEN + first session in the past → IN_PROGRESS", () => {
      const sessions = [{ sessionDate: pastDate }, { sessionDate: futureDate }];
      expect(computeEffectiveStatus("OPEN", sessions)).toBe("IN_PROGRESS");
    });

    it("OPEN + last session in the past → COMPLETED", () => {
      const sessions = [{ sessionDate: farPastDate }, { sessionDate: pastDate }];
      expect(computeEffectiveStatus("OPEN", sessions)).toBe("COMPLETED");
    });

    it("PLANNING + sessions in the past → stays PLANNING", () => {
      const sessions = [{ sessionDate: farPastDate }, { sessionDate: pastDate }];
      expect(computeEffectiveStatus("PLANNING", sessions)).toBe("PLANNING");
    });

    it("OPEN + all sessions in the future → stays OPEN", () => {
      const sessions = [{ sessionDate: futureDate }];
      expect(computeEffectiveStatus("OPEN", sessions)).toBe("OPEN");
    });

    it("IN_PROGRESS + last session in the past → COMPLETED", () => {
      const sessions = [{ sessionDate: farPastDate }, { sessionDate: pastDate }];
      expect(computeEffectiveStatus("IN_PROGRESS", sessions)).toBe("COMPLETED");
    });

    it("COMPLETED + future sessions → stays COMPLETED", () => {
      const sessions = [{ sessionDate: futureDate }];
      expect(computeEffectiveStatus("COMPLETED", sessions)).toBe("COMPLETED");
    });

    it("OPEN + no sessions → stays OPEN", () => {
      expect(computeEffectiveStatus("OPEN", [])).toBe("OPEN");
    });

    it("OPEN + today's session with past endTime → COMPLETED", () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const pastEndTime = `${String(new Date().getHours() - 1).padStart(2, "0")}:00`;
      const sessions = [{ sessionDate: today, endTime: pastEndTime }];
      expect(computeEffectiveStatus("OPEN", sessions)).toBe("COMPLETED");
    });

    it("OPEN + today's session with future endTime → IN_PROGRESS", () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const futureEndTime = `${String(new Date().getHours() + 2).padStart(2, "0")}:00`;
      const sessions = [{ sessionDate: today, endTime: futureEndTime }];
      expect(computeEffectiveStatus("OPEN", sessions)).toBe("IN_PROGRESS");
    });

    it("OPEN + today's session without endTime → IN_PROGRESS (fallback to next day)", () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sessions = [{ sessionDate: today }];
      expect(computeEffectiveStatus("OPEN", sessions)).toBe("IN_PROGRESS");
    });
  });

  // ==================== getEvents computed status ====================

  describe("getEvents computed status", () => {
    it("overrides OPEN status to IN_PROGRESS when first session is past", async () => {
      const pastDate = new Date("2020-06-01");
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const mockEvents = [
        {
          id: "evt-1",
          title: "Event 1",
          description: null,
          location: null,
          type: "SINGLE",
          status: "OPEN",
          maxParticipants: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          eventSessions: [{ sessionDate: pastDate }, { sessionDate: futureDate }],
          _count: { eventSessions: 2, registrations: 0 },
        },
      ];

      mockedPrisma.event.findMany.mockResolvedValue(mockEvents as never);
      mockedPrisma.event.count.mockResolvedValue(1 as never);

      const result = await getEvents();
      expect(result.events[0].status).toBe("IN_PROGRESS");
    });
  });

  // ==================== getEventById computed status ====================

  describe("getEventById computed status", () => {
    it("overrides OPEN status to COMPLETED when last session is past", async () => {
      const mockEvent = {
        id: "evt-1",
        title: "Event",
        description: null,
        location: null,
        type: "SINGLE",
        status: "OPEN",
        maxParticipants: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        eventSessions: [
          { sessionDate: new Date("2019-01-01") },
          { sessionDate: new Date("2020-01-01") },
        ],
        _count: { registrations: 0 },
      };

      mockedPrisma.event.findUnique.mockResolvedValue(mockEvent as never);

      const result = await getEventById("evt-1");
      expect(result!.status).toBe("COMPLETED");
    });
  });
});
