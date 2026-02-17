import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing
vi.mock("@/lib/prisma", () => ({
  prisma: {
    rolePermission: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { hasPermission, invalidatePermissionCache } from "@/lib/authorization";

const mockedPrisma = vi.mocked(prisma, true);

describe("Authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidatePermissionCache();
  });

  describe("hasPermission", () => {
    it("ADMIN always has full access without DB query", async () => {
      const result = await hasPermission("ADMIN", "events", "write");
      expect(result).toBe(true);
      expect(mockedPrisma.rolePermission.findMany).not.toHaveBeenCalled();
    });

    it("returns true when role has permission in DB", async () => {
      mockedPrisma.rolePermission.findMany.mockResolvedValue([
        { id: "1", role: "MEMBER" as any, module: "events", action: "read", allowed: true },
      ] as any);

      const result = await hasPermission("MEMBER", "events", "read");
      expect(result).toBe(true);
    });

    it("returns false when role has permission denied in DB", async () => {
      mockedPrisma.rolePermission.findMany.mockResolvedValue([
        { id: "1", role: "MEMBER" as any, module: "events", action: "write", allowed: false },
      ] as any);

      const result = await hasPermission("MEMBER", "events", "write");
      expect(result).toBe(false);
    });

    it("returns false when no permission row exists", async () => {
      mockedPrisma.rolePermission.findMany.mockResolvedValue([]);

      const result = await hasPermission("MEMBER", "users", "write");
      expect(result).toBe(false);
    });

    it("caches permissions and does not re-query within TTL", async () => {
      mockedPrisma.rolePermission.findMany.mockResolvedValue([
        { id: "1", role: "STAFF_ADMIN" as any, module: "events", action: "read", allowed: true },
      ] as any);

      await hasPermission("STAFF_ADMIN", "events", "read");
      await hasPermission("STAFF_ADMIN", "events", "read");

      expect(mockedPrisma.rolePermission.findMany).toHaveBeenCalledTimes(1);
    });

    it("invalidatePermissionCache forces re-query", async () => {
      mockedPrisma.rolePermission.findMany.mockResolvedValue([
        { id: "1", role: "PASTOR" as any, module: "events", action: "read", allowed: true },
      ] as any);

      await hasPermission("PASTOR", "events", "read");
      invalidatePermissionCache();
      await hasPermission("PASTOR", "events", "read");

      expect(mockedPrisma.rolePermission.findMany).toHaveBeenCalledTimes(2);
    });

    it("returns false for unknown role", async () => {
      mockedPrisma.rolePermission.findMany.mockResolvedValue([]);

      const result = await hasPermission("UNKNOWN_ROLE", "events", "read");
      expect(result).toBe(false);
    });
  });
});
