import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  eventSession: {
    findUnique: vi.fn(),
  },
  registration: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  attendance: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// Mock Prisma namespace for error handling
vi.mock("@/generated/prisma/client", () => ({
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      constructor(message: string, { code }: { code: string }) {
        super(message);
        this.code = code;
      }
    },
  },
}));

import {
  checkIn,
  markLate,
  getAttendanceBySession,
  getAttendanceByUser,
  bulkCheckIn,
  getAttendanceSummaryByEvent,
} from "./attendance.service";

describe("attendance.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkIn", () => {
    it("should check in a registered user", async () => {
      mockPrisma.eventSession.findUnique.mockResolvedValue({
        eventId: "event-1",
      });
      mockPrisma.registration.findUnique.mockResolvedValue({
        userId: "user-1",
        eventId: "event-1",
        status: "REGISTERED",
      });
      const attendance = {
        id: "att-1",
        userId: "user-1",
        eventSessionId: "session-1",
        checkedInAt: new Date(),
      };
      mockPrisma.attendance.create.mockResolvedValue(attendance);

      const result = await checkIn("user-1", "session-1");

      expect(result).toEqual(attendance);
      expect(mockPrisma.attendance.create).toHaveBeenCalledWith({
        data: { userId: "user-1", eventSessionId: "session-1" },
      });
    });

    it("should throw when session not found", async () => {
      mockPrisma.eventSession.findUnique.mockResolvedValue(null);

      await expect(checkIn("user-1", "session-1")).rejects.toThrow("Event session not found");
    });

    it("should throw when user is not registered", async () => {
      mockPrisma.eventSession.findUnique.mockResolvedValue({
        eventId: "event-1",
      });
      mockPrisma.registration.findUnique.mockResolvedValue(null);

      await expect(checkIn("user-1", "session-1")).rejects.toThrow(
        "User is not registered for this event"
      );
    });

    it("should throw when user has non-REGISTERED status", async () => {
      mockPrisma.eventSession.findUnique.mockResolvedValue({
        eventId: "event-1",
      });
      mockPrisma.registration.findUnique.mockResolvedValue({
        userId: "user-1",
        eventId: "event-1",
        status: "CANCELLED",
      });

      await expect(checkIn("user-1", "session-1")).rejects.toThrow(
        "User is not registered for this event"
      );
    });
  });

  describe("markLate", () => {
    it("should mark attendance as late", async () => {
      mockPrisma.attendance.findUnique.mockResolvedValue({ id: "att-1" });
      const updated = { id: "att-1", isLate: true, lateMinutes: 20 };
      mockPrisma.attendance.update.mockResolvedValue(updated);

      const result = await markLate("att-1", 20);

      expect(result).toEqual(updated);
      expect(mockPrisma.attendance.update).toHaveBeenCalledWith({
        where: { id: "att-1" },
        data: { isLate: true, lateMinutes: 20 },
      });
    });

    it("should throw when attendance not found", async () => {
      mockPrisma.attendance.findUnique.mockResolvedValue(null);

      await expect(markLate("att-1", 20)).rejects.toThrow("Attendance record not found");
    });
  });

  describe("getAttendanceBySession", () => {
    it("should return attendance with user info", async () => {
      const records = [{ id: "att-1", user: { id: "u1", name: "Alice" } }];
      mockPrisma.attendance.findMany.mockResolvedValue(records);

      const result = await getAttendanceBySession("session-1");

      expect(result).toEqual(records);
      expect(mockPrisma.attendance.findMany).toHaveBeenCalledWith({
        where: { eventSessionId: "session-1" },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
        orderBy: { checkedInAt: "asc" },
      });
    });
  });

  describe("getAttendanceByUser", () => {
    it("should return attendance across sessions for an event", async () => {
      const records = [{ id: "att-1", eventSession: { sessionNo: 1 } }];
      mockPrisma.attendance.findMany.mockResolvedValue(records);

      const result = await getAttendanceByUser("user-1", "event-1");

      expect(result).toEqual(records);
    });
  });

  describe("bulkCheckIn", () => {
    it("should bulk check in eligible users", async () => {
      mockPrisma.eventSession.findUnique.mockResolvedValue({
        eventId: "event-1",
      });
      mockPrisma.attendance.findMany.mockResolvedValue([]);
      mockPrisma.registration.findMany.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]);
      const created = [
        { id: "att-1", userId: "u1" },
        { id: "att-2", userId: "u2" },
      ];
      mockPrisma.$transaction.mockResolvedValue(created);

      const result = await bulkCheckIn("session-1", ["u1", "u2"]);

      expect(result.created).toEqual(created);
      expect(result.skipped).toBe(0);
    });

    it("should skip already checked in users", async () => {
      mockPrisma.eventSession.findUnique.mockResolvedValue({
        eventId: "event-1",
      });
      mockPrisma.attendance.findMany.mockResolvedValue([{ userId: "u1" }]);
      mockPrisma.registration.findMany.mockResolvedValue([{ userId: "u2" }]);
      const created = [{ id: "att-2", userId: "u2" }];
      mockPrisma.$transaction.mockResolvedValue(created);

      const result = await bulkCheckIn("session-1", ["u1", "u2"]);

      expect(result.created).toEqual(created);
      expect(result.skipped).toBe(1);
    });

    it("should return empty when all already checked in", async () => {
      mockPrisma.eventSession.findUnique.mockResolvedValue({
        eventId: "event-1",
      });
      mockPrisma.attendance.findMany.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]);

      const result = await bulkCheckIn("session-1", ["u1", "u2"]);

      expect(result.created).toEqual([]);
      expect(result.skipped).toBe(2);
    });

    it("should throw when session not found", async () => {
      mockPrisma.eventSession.findUnique.mockResolvedValue(null);

      await expect(bulkCheckIn("session-1", ["u1"])).rejects.toThrow("Event session not found");
    });
  });

  describe("getAttendanceSummaryByEvent", () => {
    it("returns all attendance records across all sessions for an event", async () => {
      const mockRecords = [
        { userId: "user-1", eventSessionId: "ses-1" },
        { userId: "user-2", eventSessionId: "ses-1" },
        { userId: "user-1", eventSessionId: "ses-2" },
      ];

      mockPrisma.attendance.findMany.mockResolvedValue(mockRecords);

      const result = await getAttendanceSummaryByEvent("evt-1");

      expect(result).toEqual(mockRecords);
      expect(mockPrisma.attendance.findMany).toHaveBeenCalledWith({
        where: { eventSession: { eventId: "evt-1" } },
        select: { userId: true, eventSessionId: true },
      });
    });
  });
});
