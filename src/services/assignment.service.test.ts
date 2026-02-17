import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  assignment: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  assignmentCompletion: {
    createMany: vi.fn(),
    findMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  eventSession: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import {
  createAssignment,
  deleteAssignment,
  getAssignmentsBySession,
  getAssignmentsByEvent,
  markComplete,
  removeCompletion,
  getCompletionRate,
} from "./assignment.service";

describe("assignment.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createAssignment", () => {
    it("should create assignment for a valid session", async () => {
      mockPrisma.eventSession.findUnique.mockResolvedValue({
        id: "session-1",
        eventId: "event-1",
      });
      const assignment = {
        id: "assign-1",
        eventSessionId: "session-1",
        title: "Read Chapter 1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.assignment.create.mockResolvedValue(assignment);

      const result = await createAssignment("session-1", "Read Chapter 1");

      expect(result).toEqual(assignment);
      expect(mockPrisma.assignment.create).toHaveBeenCalledWith({
        data: { eventSessionId: "session-1", title: "Read Chapter 1" },
      });
    });

    it("should throw when session not found", async () => {
      mockPrisma.eventSession.findUnique.mockResolvedValue(null);

      await expect(
        createAssignment("session-1", "Read Chapter 1")
      ).rejects.toThrow("Event session not found");
    });
  });

  describe("deleteAssignment", () => {
    it("should delete an existing assignment", async () => {
      mockPrisma.assignment.findUnique.mockResolvedValue({
        id: "assign-1",
        title: "Read Chapter 1",
      });
      mockPrisma.assignment.delete.mockResolvedValue({ id: "assign-1" });

      const result = await deleteAssignment("assign-1");

      expect(result).toEqual({ id: "assign-1" });
      expect(mockPrisma.assignment.delete).toHaveBeenCalledWith({
        where: { id: "assign-1" },
      });
    });

    it("should throw when assignment not found", async () => {
      mockPrisma.assignment.findUnique.mockResolvedValue(null);

      await expect(deleteAssignment("assign-1")).rejects.toThrow(
        "Assignment not found"
      );
    });
  });

  describe("getAssignmentsBySession", () => {
    it("should return assignments with completion counts", async () => {
      const assignments = [
        {
          id: "assign-1",
          title: "Read Chapter 1",
          _count: { completions: 3 },
        },
        {
          id: "assign-2",
          title: "Read Chapter 2",
          _count: { completions: 1 },
        },
      ];
      mockPrisma.assignment.findMany.mockResolvedValue(assignments);

      const result = await getAssignmentsBySession("session-1");

      expect(result).toEqual(assignments);
      expect(mockPrisma.assignment.findMany).toHaveBeenCalledWith({
        where: { eventSessionId: "session-1" },
        include: { _count: { select: { completions: true } } },
        orderBy: { createdAt: "asc" },
      });
    });
  });

  describe("getAssignmentsByEvent", () => {
    it("should return all assignments across sessions", async () => {
      mockPrisma.eventSession.findMany.mockResolvedValue([
        { id: "session-1" },
        { id: "session-2" },
      ]);
      const assignments = [
        {
          id: "assign-1",
          title: "Read Chapter 1",
          eventSession: { sessionNo: 1, topic: "Intro" },
          _count: { completions: 2 },
        },
        {
          id: "assign-2",
          title: "Read Chapter 2",
          eventSession: { sessionNo: 2, topic: "Advanced" },
          _count: { completions: 0 },
        },
      ];
      mockPrisma.assignment.findMany.mockResolvedValue(assignments);

      const result = await getAssignmentsByEvent("event-1");

      expect(result).toEqual(assignments);
      expect(mockPrisma.eventSession.findMany).toHaveBeenCalledWith({
        where: { eventId: "event-1" },
        select: { id: true },
      });
      expect(mockPrisma.assignment.findMany).toHaveBeenCalledWith({
        where: { eventSessionId: { in: ["session-1", "session-2"] } },
        include: {
          _count: { select: { completions: true } },
          eventSession: { select: { sessionNo: true, topic: true } },
        },
        orderBy: { eventSession: { sessionNo: "asc" } },
      });
    });
  });

  describe("markComplete", () => {
    it("should create completion records and return created/skipped counts", async () => {
      mockPrisma.assignment.findUnique.mockResolvedValue({
        id: "assign-1",
        title: "Read Chapter 1",
      });
      mockPrisma.assignmentCompletion.findMany.mockResolvedValue([]);
      mockPrisma.assignmentCompletion.createMany.mockResolvedValue({
        count: 2,
      });

      const result = await markComplete("assign-1", ["u1", "u2"], "admin-1");

      expect(result).toEqual({ created: 2, skipped: 0 });
      expect(mockPrisma.assignmentCompletion.createMany).toHaveBeenCalledWith({
        data: [
          {
            assignmentId: "assign-1",
            userId: "u1",
            completedById: "admin-1",
          },
          {
            assignmentId: "assign-1",
            userId: "u2",
            completedById: "admin-1",
          },
        ],
        skipDuplicates: true,
      });
    });

    it("should skip already-completed users", async () => {
      mockPrisma.assignment.findUnique.mockResolvedValue({
        id: "assign-1",
        title: "Read Chapter 1",
      });
      mockPrisma.assignmentCompletion.findMany.mockResolvedValue([
        { userId: "u1" },
      ]);
      mockPrisma.assignmentCompletion.createMany.mockResolvedValue({
        count: 1,
      });

      const result = await markComplete(
        "assign-1",
        ["u1", "u2"],
        "admin-1"
      );

      expect(result).toEqual({ created: 1, skipped: 1 });
      expect(mockPrisma.assignmentCompletion.createMany).toHaveBeenCalledWith({
        data: [
          {
            assignmentId: "assign-1",
            userId: "u2",
            completedById: "admin-1",
          },
        ],
        skipDuplicates: true,
      });
    });

    it("should throw when assignment not found", async () => {
      mockPrisma.assignment.findUnique.mockResolvedValue(null);

      await expect(
        markComplete("assign-1", ["u1"], "admin-1")
      ).rejects.toThrow("Assignment not found");
    });
  });

  describe("removeCompletion", () => {
    it("should delete completion record via deleteMany", async () => {
      mockPrisma.assignmentCompletion.deleteMany.mockResolvedValue({
        count: 1,
      });

      const result = await removeCompletion("assign-1", "u1");

      expect(result).toEqual({ count: 1 });
      expect(mockPrisma.assignmentCompletion.deleteMany).toHaveBeenCalledWith({
        where: { assignmentId: "assign-1", userId: "u1" },
      });
    });
  });

  describe("getCompletionRate", () => {
    it("should return correct rate (2 completed / 3 total)", async () => {
      mockPrisma.eventSession.findMany.mockResolvedValue([
        { id: "session-1" },
        { id: "session-2" },
      ]);
      mockPrisma.assignment.findMany.mockResolvedValue([
        { id: "assign-1" },
        { id: "assign-2" },
        { id: "assign-3" },
      ]);
      mockPrisma.assignmentCompletion.findMany.mockResolvedValue([
        { assignmentId: "assign-1" },
        { assignmentId: "assign-3" },
      ]);

      const result = await getCompletionRate("user-1", "event-1");

      expect(result).toEqual({ completed: 2, total: 3, rate: 2 / 3 });
    });

    it("should return rate=1 when no assignments exist (0/0)", async () => {
      mockPrisma.eventSession.findMany.mockResolvedValue([
        { id: "session-1" },
      ]);
      mockPrisma.assignment.findMany.mockResolvedValue([]);
      mockPrisma.assignmentCompletion.findMany.mockResolvedValue([]);

      const result = await getCompletionRate("user-1", "event-1");

      expect(result).toEqual({ completed: 0, total: 0, rate: 1 });
    });
  });
});
