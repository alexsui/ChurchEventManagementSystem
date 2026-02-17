import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Prisma client — use vi.hoisted so the mock object is available when
// vi.mock (which is hoisted to the top of the file) executes.
// ---------------------------------------------------------------------------

const mockPrisma = vi.hoisted(() => ({
  team: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  eventTeam: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  eventTeamMember: {
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  eventTeamTask: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// Import after mocking so the module picks up the mock
import {
  getTeamTemplates,
  createTeamTemplate,
  updateTeamTemplate,
  deleteTeamTemplate,
  getEventTeams,
  createEventTeam,
  updateEventTeam,
  deleteEventTeam,
  addEventTeamMember,
  removeEventTeamMember,
  createEventTeamTask,
  updateEventTeamTask,
  deleteEventTeamTask,
  TeamServiceError,
} from "./team.service";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("team.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- getTeamTemplates ---------------------------------------------------

  describe("getTeamTemplates", () => {
    it("should return all team templates ordered by name", async () => {
      const templates = [
        { id: "t1", name: "影音組", createdAt: new Date(), updatedAt: new Date() },
        { id: "t2", name: "敬拜組", createdAt: new Date(), updatedAt: new Date() },
      ];
      mockPrisma.team.findMany.mockResolvedValue(templates);

      const result = await getTeamTemplates();

      expect(result).toEqual(templates);
      expect(mockPrisma.team.findMany).toHaveBeenCalledWith({
        orderBy: { name: "asc" },
      });
    });
  });

  // --- createTeamTemplate -------------------------------------------------

  describe("createTeamTemplate", () => {
    it("should create a team template", async () => {
      const created = { id: "t1", name: "影音組", createdAt: new Date(), updatedAt: new Date() };
      mockPrisma.team.create.mockResolvedValue(created);

      const result = await createTeamTemplate("影音組");

      expect(result).toEqual(created);
      expect(mockPrisma.team.create).toHaveBeenCalledWith({
        data: { name: "影音組" },
      });
    });
  });

  // --- updateTeamTemplate -------------------------------------------------

  describe("updateTeamTemplate", () => {
    it("should update a team template name", async () => {
      const updated = { id: "t1", name: "新影音組", createdAt: new Date(), updatedAt: new Date() };
      mockPrisma.team.findUnique.mockResolvedValue({ id: "t1" });
      mockPrisma.team.update.mockResolvedValue(updated);

      const result = await updateTeamTemplate("t1", "新影音組");

      expect(result).toEqual(updated);
      expect(mockPrisma.team.findUnique).toHaveBeenCalledWith({ where: { id: "t1" } });
      expect(mockPrisma.team.update).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: { name: "新影音組" },
      });
    });

    it("should throw when template not found", async () => {
      mockPrisma.team.findUnique.mockResolvedValue(null);

      await expect(updateTeamTemplate("t1", "新名")).rejects.toThrow(TeamServiceError);
      await expect(updateTeamTemplate("t1", "新名")).rejects.toMatchObject({
        code: "TEMPLATE_NOT_FOUND",
      });
    });
  });

  // --- deleteTeamTemplate -------------------------------------------------

  describe("deleteTeamTemplate", () => {
    it("should delete a team template", async () => {
      mockPrisma.team.findUnique.mockResolvedValue({ id: "t1" });
      mockPrisma.team.delete.mockResolvedValue({ id: "t1" });

      await deleteTeamTemplate("t1");

      expect(mockPrisma.team.findUnique).toHaveBeenCalledWith({ where: { id: "t1" } });
      expect(mockPrisma.team.delete).toHaveBeenCalledWith({ where: { id: "t1" } });
    });

    it("should throw when template not found", async () => {
      mockPrisma.team.findUnique.mockResolvedValue(null);

      await expect(deleteTeamTemplate("t1")).rejects.toThrow(TeamServiceError);
      await expect(deleteTeamTemplate("t1")).rejects.toMatchObject({
        code: "TEMPLATE_NOT_FOUND",
      });
    });
  });

  // ==================== Event Teams ==========================================

  describe("getEventTeams", () => {
    it("should return event teams with members and tasks", async () => {
      const eventTeams = [
        {
          id: "et1",
          eventId: "e1",
          teamId: "t1",
          customName: null,
          team: { id: "t1", name: "影音組" },
          members: [
            { id: "m1", userId: "u1", user: { id: "u1", name: "Alice", phone: "123", image: null } },
          ],
          tasks: [
            { id: "tk1", title: "Setup", assignee: { id: "u1", name: "Alice" } },
          ],
        },
      ];
      mockPrisma.eventTeam.findMany.mockResolvedValue(eventTeams);

      const result = await getEventTeams("e1");

      expect(result).toEqual(eventTeams);
      expect(mockPrisma.eventTeam.findMany).toHaveBeenCalledWith({
        where: { eventId: "e1" },
        include: {
          team: true,
          members: {
            include: { user: { select: { id: true, name: true, phone: true, image: true } } },
            orderBy: { createdAt: "asc" },
          },
          tasks: {
            include: { assignee: { select: { id: true, name: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      });
    });
  });

  // --- createEventTeam -----------------------------------------------------

  describe("createEventTeam", () => {
    it("should create an event team from a template", async () => {
      const created = { id: "et1", eventId: "e1", teamId: "t1", customName: null };
      mockPrisma.eventTeam.create.mockResolvedValue(created);

      const result = await createEventTeam("e1", { teamId: "t1" });

      expect(result).toEqual(created);
      expect(mockPrisma.eventTeam.create).toHaveBeenCalledWith({
        data: { eventId: "e1", teamId: "t1", customName: null },
      });
    });

    it("should create an event team with a custom name", async () => {
      const created = { id: "et2", eventId: "e1", teamId: null, customName: "特別組" };
      mockPrisma.eventTeam.create.mockResolvedValue(created);

      const result = await createEventTeam("e1", { customName: "特別組" });

      expect(result).toEqual(created);
      expect(mockPrisma.eventTeam.create).toHaveBeenCalledWith({
        data: { eventId: "e1", teamId: null, customName: "特別組" },
      });
    });

    it("should throw when neither teamId nor customName is provided", async () => {
      await expect(createEventTeam("e1", {})).rejects.toThrow(TeamServiceError);
      await expect(createEventTeam("e1", {})).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
    });
  });

  // --- updateEventTeam -----------------------------------------------------

  describe("updateEventTeam", () => {
    it("should update sopLinks", async () => {
      const updated = { id: "et1", sopLinks: ["https://example.com/sop"] };
      mockPrisma.eventTeam.findUnique.mockResolvedValue({ id: "et1" });
      mockPrisma.eventTeam.update.mockResolvedValue(updated);

      const result = await updateEventTeam("et1", { sopLinks: ["https://example.com/sop"] });

      expect(result).toEqual(updated);
      expect(mockPrisma.eventTeam.findUnique).toHaveBeenCalledWith({ where: { id: "et1" } });
      expect(mockPrisma.eventTeam.update).toHaveBeenCalledWith({
        where: { id: "et1" },
        data: { sopLinks: ["https://example.com/sop"] },
      });
    });

    it("should throw when event team not found", async () => {
      mockPrisma.eventTeam.findUnique.mockResolvedValue(null);

      await expect(updateEventTeam("et1", { customName: "X" })).rejects.toThrow(TeamServiceError);
      await expect(updateEventTeam("et1", { customName: "X" })).rejects.toMatchObject({
        code: "EVENT_TEAM_NOT_FOUND",
      });
    });
  });

  // --- deleteEventTeam -----------------------------------------------------

  describe("deleteEventTeam", () => {
    it("should delete an event team", async () => {
      mockPrisma.eventTeam.findUnique.mockResolvedValue({ id: "et1" });
      mockPrisma.eventTeam.delete.mockResolvedValue({ id: "et1" });

      await deleteEventTeam("et1");

      expect(mockPrisma.eventTeam.findUnique).toHaveBeenCalledWith({ where: { id: "et1" } });
      expect(mockPrisma.eventTeam.delete).toHaveBeenCalledWith({ where: { id: "et1" } });
    });

    it("should throw when event team not found", async () => {
      mockPrisma.eventTeam.findUnique.mockResolvedValue(null);

      await expect(deleteEventTeam("et1")).rejects.toThrow(TeamServiceError);
      await expect(deleteEventTeam("et1")).rejects.toMatchObject({
        code: "EVENT_TEAM_NOT_FOUND",
      });
    });
  });

  // ==================== Event Team Members ===================================

  describe("addEventTeamMember", () => {
    it("should add a member to an event team", async () => {
      const created = { id: "m1", eventTeamId: "et1", userId: "u1", role: null };
      mockPrisma.eventTeamMember.create.mockResolvedValue(created);

      const result = await addEventTeamMember("et1", "u1");

      expect(result).toEqual(created);
      expect(mockPrisma.eventTeamMember.create).toHaveBeenCalledWith({
        data: { eventTeamId: "et1", userId: "u1", role: null },
      });
    });

    it("should add a member with a role", async () => {
      const created = { id: "m2", eventTeamId: "et1", userId: "u2", role: "leader" };
      mockPrisma.eventTeamMember.create.mockResolvedValue(created);

      const result = await addEventTeamMember("et1", "u2", "leader");

      expect(result).toEqual(created);
      expect(mockPrisma.eventTeamMember.create).toHaveBeenCalledWith({
        data: { eventTeamId: "et1", userId: "u2", role: "leader" },
      });
    });
  });

  describe("removeEventTeamMember", () => {
    it("should remove a member from an event team", async () => {
      mockPrisma.eventTeamMember.deleteMany.mockResolvedValue({ count: 1 });

      const result = await removeEventTeamMember("et1", "u1");

      expect(result).toEqual({ count: 1 });
      expect(mockPrisma.eventTeamMember.deleteMany).toHaveBeenCalledWith({
        where: { eventTeamId: "et1", userId: "u1" },
      });
    });
  });

  // ==================== Event Team Tasks =====================================

  describe("createEventTeamTask", () => {
    it("should create a task without assignee", async () => {
      const created = { id: "tk1", eventTeamId: "et1", title: "Setup mic", assigneeId: null };
      mockPrisma.eventTeamTask.create.mockResolvedValue(created);

      const result = await createEventTeamTask("et1", "Setup mic");

      expect(result).toEqual(created);
      expect(mockPrisma.eventTeamTask.create).toHaveBeenCalledWith({
        data: { eventTeamId: "et1", title: "Setup mic", assigneeId: null },
      });
    });

    it("should create a task with an assignee", async () => {
      const created = { id: "tk2", eventTeamId: "et1", title: "Test sound", assigneeId: "u1" };
      mockPrisma.eventTeamTask.create.mockResolvedValue(created);

      const result = await createEventTeamTask("et1", "Test sound", "u1");

      expect(result).toEqual(created);
      expect(mockPrisma.eventTeamTask.create).toHaveBeenCalledWith({
        data: { eventTeamId: "et1", title: "Test sound", assigneeId: "u1" },
      });
    });
  });

  describe("updateEventTeamTask", () => {
    it("should update task status", async () => {
      const updated = { id: "tk1", title: "Setup mic", status: "done" };
      mockPrisma.eventTeamTask.findUnique.mockResolvedValue({ id: "tk1" });
      mockPrisma.eventTeamTask.update.mockResolvedValue(updated);

      const result = await updateEventTeamTask("tk1", { status: "done" });

      expect(result).toEqual(updated);
      expect(mockPrisma.eventTeamTask.findUnique).toHaveBeenCalledWith({ where: { id: "tk1" } });
      expect(mockPrisma.eventTeamTask.update).toHaveBeenCalledWith({
        where: { id: "tk1" },
        data: { status: "done" },
      });
    });

    it("should throw when task not found", async () => {
      mockPrisma.eventTeamTask.findUnique.mockResolvedValue(null);

      await expect(updateEventTeamTask("tk1", { status: "done" })).rejects.toThrow(TeamServiceError);
      await expect(updateEventTeamTask("tk1", { status: "done" })).rejects.toMatchObject({
        code: "TASK_NOT_FOUND",
      });
    });
  });

  describe("deleteEventTeamTask", () => {
    it("should delete a task", async () => {
      mockPrisma.eventTeamTask.findUnique.mockResolvedValue({ id: "tk1" });
      mockPrisma.eventTeamTask.delete.mockResolvedValue({ id: "tk1" });

      await deleteEventTeamTask("tk1");

      expect(mockPrisma.eventTeamTask.findUnique).toHaveBeenCalledWith({ where: { id: "tk1" } });
      expect(mockPrisma.eventTeamTask.delete).toHaveBeenCalledWith({ where: { id: "tk1" } });
    });

    it("should throw when task not found", async () => {
      mockPrisma.eventTeamTask.findUnique.mockResolvedValue(null);

      await expect(deleteEventTeamTask("tk1")).rejects.toThrow(TeamServiceError);
      await expect(deleteEventTeamTask("tk1")).rejects.toMatchObject({
        code: "TASK_NOT_FOUND",
      });
    });
  });
});
