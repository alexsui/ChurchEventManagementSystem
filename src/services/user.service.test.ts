import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import {
  getUsers,
  getUserById,
  updateUserRole,
  toggleUserActive,
} from "./user.service";

describe("user.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUsers", () => {
    it("should return all users without filters", async () => {
      const users = [
        { id: "u1", name: "Alice", role: "MEMBER" },
        { id: "u2", name: "Bob", role: "ADMIN" },
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);

      const result = await getUsers();

      expect(result).toEqual(users);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} })
      );
    });

    it("should filter by role", async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await getUsers({ role: "ADMIN" });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: "ADMIN" },
        })
      );
    });

    it("should filter by isActive", async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await getUsers({ isActive: true });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        })
      );
    });

    it("should search by name or email", async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await getUsers({ search: "alice" });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { name: { contains: "alice", mode: "insensitive" } },
              { email: { contains: "alice", mode: "insensitive" } },
            ],
          },
        })
      );
    });
  });

  describe("getUserById", () => {
    it("should return user with registrations", async () => {
      const user = {
        id: "u1",
        name: "Alice",
        registrations: [{ id: "reg-1", event: { title: "Test" } }],
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await getUserById("u1");

      expect(result).toEqual(user);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "u1" },
          select: expect.objectContaining({
            registrations: expect.any(Object),
          }),
        })
      );
    });

    it("should return null for non-existent user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await getUserById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("updateUserRole", () => {
    it("should update role only", async () => {
      const updated = { id: "u1", role: "STAFF_ADMIN" };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await updateUserRole("u1", "STAFF_ADMIN");

      expect(result).toEqual(updated);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "u1" },
          data: { role: "STAFF_ADMIN" },
        })
      );
    });

    it("should update role with expiry", async () => {
      const expires = new Date("2026-12-31");
      const updated = { id: "u1", role: "TEAM_LEADER", permissionExpiresAt: expires };
      mockPrisma.user.update.mockResolvedValue(updated);

      await updateUserRole("u1", "TEAM_LEADER", expires);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { role: "TEAM_LEADER", permissionExpiresAt: expires },
        })
      );
    });
  });

  describe("toggleUserActive", () => {
    it("should toggle active to inactive", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isActive: true });
      const updated = { id: "u1", isActive: false };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await toggleUserActive("u1");

      expect(result).toEqual(updated);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "u1" },
          data: { isActive: false },
        })
      );
    });

    it("should toggle inactive to active", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isActive: false });
      const updated = { id: "u1", isActive: true };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await toggleUserActive("u1");

      expect(result).toEqual(updated);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isActive: true },
        })
      );
    });

    it("should return null for non-existent user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await toggleUserActive("non-existent");

      expect(result).toBeNull();
    });
  });
});
