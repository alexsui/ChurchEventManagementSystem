import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RegistrationStatus,
  EventStatus,
} from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Mock Prisma client — use vi.hoisted so the mock object is available when
// vi.mock (which is hoisted to the top of the file) executes.
// ---------------------------------------------------------------------------

const mockPrisma = vi.hoisted(() => ({
  event: {
    findUnique: vi.fn(),
  },
  registration: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// Import after mocking so the module picks up the mock
import {
  registerForEvent,
  cancelRegistration,
  getRegistrationsByEvent,
  getRegistrationsByUser,
  getRegistrationCount,
} from "./registration.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1",
    title: "Sunday Service",
    status: EventStatus.OPEN,
    maxParticipants: null,
    ...overrides,
  };
}

function makeRegistration(overrides: Record<string, unknown> = {}) {
  return {
    id: "reg-1",
    userId: "user-1",
    eventId: "event-1",
    status: RegistrationStatus.REGISTERED,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("registration.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── registerForEvent ──────────────────────────────────────────────

  describe("registerForEvent", () => {
    it("should register a user for an open event", async () => {
      const event = makeEvent();
      const created = makeRegistration();

      mockPrisma.event.findUnique.mockResolvedValue(event);
      mockPrisma.registration.findUnique.mockResolvedValue(null);
      mockPrisma.registration.create.mockResolvedValue(created);

      const result = await registerForEvent("user-1", "event-1");

      expect(result).toEqual(created);
      expect(mockPrisma.registration.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          eventId: "event-1",
          status: RegistrationStatus.REGISTERED,
        },
      });
    });

    it("should throw when event is not OPEN", async () => {
      const event = makeEvent({ status: EventStatus.PLANNING });
      mockPrisma.event.findUnique.mockResolvedValue(event);

      await expect(registerForEvent("user-1", "event-1")).rejects.toThrow(
        "Event is not open for registration"
      );
    });

    it("should throw when event is not found", async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);

      await expect(registerForEvent("user-1", "event-1")).rejects.toThrow(
        "Event not found"
      );
    });

    it("should throw when user is already registered", async () => {
      const event = makeEvent();
      const existing = makeRegistration();

      mockPrisma.event.findUnique.mockResolvedValue(event);
      mockPrisma.registration.findUnique.mockResolvedValue(existing);

      await expect(registerForEvent("user-1", "event-1")).rejects.toThrow(
        "User is already registered for this event"
      );
    });

    it("should throw when user is already waitlisted", async () => {
      const event = makeEvent();
      const existing = makeRegistration({
        status: RegistrationStatus.WAITLISTED,
      });

      mockPrisma.event.findUnique.mockResolvedValue(event);
      mockPrisma.registration.findUnique.mockResolvedValue(existing);

      await expect(registerForEvent("user-1", "event-1")).rejects.toThrow(
        "User is already registered for this event"
      );
    });

    it("should waitlist when maxParticipants is reached", async () => {
      const event = makeEvent({ maxParticipants: 2 });
      const waitlisted = makeRegistration({
        status: RegistrationStatus.WAITLISTED,
      });

      mockPrisma.event.findUnique.mockResolvedValue(event);
      mockPrisma.registration.findUnique.mockResolvedValue(null);
      // Already 2 registered = full
      mockPrisma.registration.count.mockResolvedValue(2);
      mockPrisma.registration.create.mockResolvedValue(waitlisted);

      const result = await registerForEvent("user-1", "event-1");

      expect(result).toEqual(waitlisted);
      expect(mockPrisma.registration.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          eventId: "event-1",
          status: RegistrationStatus.WAITLISTED,
        },
      });
    });

    it("should register when maxParticipants is not yet reached", async () => {
      const event = makeEvent({ maxParticipants: 5 });
      const created = makeRegistration();

      mockPrisma.event.findUnique.mockResolvedValue(event);
      mockPrisma.registration.findUnique.mockResolvedValue(null);
      mockPrisma.registration.count.mockResolvedValue(3);
      mockPrisma.registration.create.mockResolvedValue(created);

      const result = await registerForEvent("user-1", "event-1");

      expect(result).toEqual(created);
      expect(mockPrisma.registration.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          eventId: "event-1",
          status: RegistrationStatus.REGISTERED,
        },
      });
    });

    it("should re-register a previously cancelled registration", async () => {
      const event = makeEvent();
      const cancelled = makeRegistration({
        status: RegistrationStatus.CANCELLED,
      });
      const updated = makeRegistration({
        status: RegistrationStatus.REGISTERED,
      });

      mockPrisma.event.findUnique.mockResolvedValue(event);
      mockPrisma.registration.findUnique.mockResolvedValue(cancelled);
      mockPrisma.registration.update.mockResolvedValue(updated);

      const result = await registerForEvent("user-1", "event-1");

      expect(result).toEqual(updated);
      expect(mockPrisma.registration.update).toHaveBeenCalledWith({
        where: { id: cancelled.id },
        data: { status: RegistrationStatus.REGISTERED },
      });
    });
  });

  // ─── cancelRegistration ────────────────────────────────────────────

  describe("cancelRegistration", () => {
    it("should cancel a registration", async () => {
      const reg = makeRegistration();
      const cancelled = makeRegistration({
        status: RegistrationStatus.CANCELLED,
      });

      mockPrisma.registration.findUnique.mockResolvedValue(reg);
      mockPrisma.registration.update.mockResolvedValue(cancelled);
      // No waitlisted users
      mockPrisma.registration.findFirst.mockResolvedValue(null);

      const result = await cancelRegistration("user-1", "event-1");

      expect(result).toEqual(cancelled);
      expect(mockPrisma.registration.update).toHaveBeenCalledWith({
        where: { id: reg.id },
        data: { status: RegistrationStatus.CANCELLED },
      });
    });

    it("should throw when registration is not found", async () => {
      mockPrisma.registration.findUnique.mockResolvedValue(null);

      await expect(cancelRegistration("user-1", "event-1")).rejects.toThrow(
        "Registration not found"
      );
    });

    it("should throw when registration is already cancelled", async () => {
      const cancelled = makeRegistration({
        status: RegistrationStatus.CANCELLED,
      });
      mockPrisma.registration.findUnique.mockResolvedValue(cancelled);

      await expect(cancelRegistration("user-1", "event-1")).rejects.toThrow(
        "Registration is already cancelled"
      );
    });

    it("should promote the first waitlisted user when a registered user cancels", async () => {
      const reg = makeRegistration();
      const cancelledReg = makeRegistration({
        status: RegistrationStatus.CANCELLED,
      });
      const waitlistedReg = makeRegistration({
        id: "reg-waitlisted",
        userId: "user-2",
        status: RegistrationStatus.WAITLISTED,
        createdAt: new Date("2026-01-02"),
      });
      const promotedReg = makeRegistration({
        id: "reg-waitlisted",
        userId: "user-2",
        status: RegistrationStatus.REGISTERED,
      });

      mockPrisma.registration.findUnique.mockResolvedValue(reg);
      // First call: cancel the registration; second call: promote waitlisted
      mockPrisma.registration.update
        .mockResolvedValueOnce(cancelledReg)
        .mockResolvedValueOnce(promotedReg);
      mockPrisma.registration.findFirst.mockResolvedValue(waitlistedReg);

      await cancelRegistration("user-1", "event-1");

      // Verify the waitlisted user was promoted
      expect(mockPrisma.registration.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.registration.update).toHaveBeenNthCalledWith(2, {
        where: { id: "reg-waitlisted" },
        data: { status: RegistrationStatus.REGISTERED },
      });
    });

    it("should NOT promote waitlisted user when a waitlisted registration is cancelled", async () => {
      const waitlistedReg = makeRegistration({
        status: RegistrationStatus.WAITLISTED,
      });
      const cancelledReg = makeRegistration({
        status: RegistrationStatus.CANCELLED,
      });

      mockPrisma.registration.findUnique.mockResolvedValue(waitlistedReg);
      mockPrisma.registration.update.mockResolvedValue(cancelledReg);

      await cancelRegistration("user-1", "event-1");

      // Should only cancel, not look for waitlisted users to promote
      expect(mockPrisma.registration.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.registration.findFirst).not.toHaveBeenCalled();
    });
  });

  // ─── getRegistrationsByEvent ───────────────────────────────────────

  describe("getRegistrationsByEvent", () => {
    it("should return registrations with user info", async () => {
      const regs = [makeRegistration()];
      mockPrisma.registration.findMany.mockResolvedValue(regs);

      const result = await getRegistrationsByEvent("event-1");

      expect(result).toEqual(regs);
      expect(mockPrisma.registration.findMany).toHaveBeenCalledWith({
        where: { eventId: "event-1" },
        include: { user: true },
        orderBy: { createdAt: "asc" },
      });
    });
  });

  // ─── getRegistrationsByUser ────────────────────────────────────────

  describe("getRegistrationsByUser", () => {
    it("should return registrations with event info", async () => {
      const regs = [makeRegistration()];
      mockPrisma.registration.findMany.mockResolvedValue(regs);

      const result = await getRegistrationsByUser("user-1");

      expect(result).toEqual(regs);
      expect(mockPrisma.registration.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        include: { event: true },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  // ─── getRegistrationCount ─────────────────────────────────────────

  describe("getRegistrationCount", () => {
    it("should return counts grouped by status", async () => {
      mockPrisma.registration.count
        .mockResolvedValueOnce(10) // registered
        .mockResolvedValueOnce(3) // waitlisted
        .mockResolvedValueOnce(2); // cancelled

      const result = await getRegistrationCount("event-1");

      expect(result).toEqual({
        registered: 10,
        waitlisted: 3,
        cancelled: 2,
      });
    });
  });
});
