import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing the service
vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
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
        registrationMode: "FULL_SERIES",
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
        registrationMode: "FULL_SERIES",
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
      ).rejects.toThrow(
        "SERIES events require at least one session in the sessions array"
      );
    });

    it("throws error when SERIES event has undefined sessions", async () => {
      await expect(
        createEvent({
          title: "Bad Series",
          type: "SERIES",
        })
      ).rejects.toThrow(
        "SERIES events require at least one session in the sessions array"
      );
    });

    it("defaults to SINGLE type, PLANNING status, and FULL_SERIES registration mode", async () => {
      const mockEvent = {
        id: "evt-3",
        title: "Default Event",
        description: undefined,
        location: undefined,
        type: "SINGLE",
        status: "PLANNING",
        registrationMode: "FULL_SERIES",
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
            registrationMode: "FULL_SERIES",
          }),
        })
      );
    });
  });

  // ==================== getEvents ====================

  describe("getEvents", () => {
    it("returns all events with session and registration counts", async () => {
      const mockEvents = [
        {
          id: "evt-1",
          title: "Event 1",
          description: null,
          location: null,
          type: "SINGLE",
          status: "OPEN",
          registrationMode: "FULL_SERIES",
          maxParticipants: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { eventSessions: 1, registrations: 5 },
        },
        {
          id: "evt-2",
          title: "Event 2",
          description: null,
          location: null,
          type: "SERIES",
          status: "PLANNING",
          registrationMode: "PER_SESSION",
          maxParticipants: 20,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { eventSessions: 4, registrations: 10 },
        },
      ];

      mockedPrisma.event.findMany.mockResolvedValue(mockEvents as never);

      const result = await getEvents();

      expect(result).toEqual(mockEvents);
      expect(mockedPrisma.event.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          _count: {
            select: {
              eventSessions: true,
              registrations: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    });

    it("applies status filter", async () => {
      mockedPrisma.event.findMany.mockResolvedValue([] as never);

      await getEvents({ status: "OPEN" });

      expect(mockedPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "OPEN" },
        })
      );
    });

    it("applies type filter", async () => {
      mockedPrisma.event.findMany.mockResolvedValue([] as never);

      await getEvents({ type: "SERIES" });

      expect(mockedPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: "SERIES" },
        })
      );
    });

    it("applies both status and type filters", async () => {
      mockedPrisma.event.findMany.mockResolvedValue([] as never);

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
      const mockEvent = {
        id: "evt-1",
        title: "Sunday Service",
        description: "Weekly",
        location: "Hall",
        type: "SINGLE",
        status: "OPEN",
        registrationMode: "FULL_SERIES",
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
            select: { registrations: true },
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
        registrationMode: "FULL_SERIES",
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
          registrationMode: undefined,
          maxParticipants: 50,
        },
        include: { eventSessions: true },
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
        registrationMode: "FULL_SERIES",
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
        registrationMode: "FULL_SERIES",
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
});
