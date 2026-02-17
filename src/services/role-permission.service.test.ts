import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rolePermission: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/authorization", () => ({
  invalidatePermissionCache: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { invalidatePermissionCache } from "@/lib/authorization";
import {
  getAllRolePermissions,
  bulkUpdateRolePermissions,
} from "@/services/role-permission.service";

const mockedPrisma = vi.mocked(prisma, true);

describe("RolePermission Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAllRolePermissions", () => {
    it("returns permissions grouped by role, module, action", async () => {
      mockedPrisma.rolePermission.findMany.mockResolvedValue([
        { id: "1", role: "MEMBER" as any, module: "events", action: "read", allowed: true },
        { id: "2", role: "MEMBER" as any, module: "events", action: "write", allowed: false },
      ] as any);

      const result = await getAllRolePermissions();

      expect(result).toEqual({
        MEMBER: {
          events: { read: true, write: false },
        },
      });
    });
  });

  describe("bulkUpdateRolePermissions", () => {
    it("upserts permissions and invalidates cache", async () => {
      mockedPrisma.$transaction.mockResolvedValue(undefined as any);

      await bulkUpdateRolePermissions({
        MEMBER: {
          events: { read: true, write: false },
        },
      });

      expect(mockedPrisma.$transaction).toHaveBeenCalledOnce();
      expect(invalidatePermissionCache).toHaveBeenCalledOnce();
    });
  });
});
