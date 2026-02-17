import { prisma } from "@/lib/prisma";
import { invalidatePermissionCache } from "@/lib/authorization";

type PermissionMatrix = Record<
  string,
  Record<string, { read: boolean; write: boolean }>
>;

/**
 * Get all non-ADMIN role permissions, grouped by role > module > action.
 */
export async function getAllRolePermissions(): Promise<PermissionMatrix> {
  const rows = await prisma.rolePermission.findMany({
    where: { role: { not: "ADMIN" } },
    orderBy: [{ role: "asc" }, { module: "asc" }],
  });

  const result: PermissionMatrix = {};

  for (const row of rows) {
    const role = row.role as string;
    if (!result[role]) result[role] = {};
    if (!result[role][row.module]) {
      result[role][row.module] = { read: false, write: false };
    }
    if (row.action === "read") result[role][row.module].read = row.allowed;
    if (row.action === "write") result[role][row.module].write = row.allowed;
  }

  return result;
}

/**
 * Bulk update role permissions from a full matrix.
 * Upserts all entries in a transaction, then invalidates cache.
 */
export async function bulkUpdateRolePermissions(
  matrix: PermissionMatrix
): Promise<void> {
  const operations = [];

  for (const [role, modules] of Object.entries(matrix)) {
    for (const [module, actions] of Object.entries(modules)) {
      for (const [action, allowed] of Object.entries(actions)) {
        operations.push(
          prisma.rolePermission.upsert({
            where: {
              role_module_action: {
                role: role as any,
                module,
                action,
              },
            },
            update: { allowed },
            create: {
              role: role as any,
              module,
              action,
              allowed,
            },
          })
        );
      }
    }
  }

  await prisma.$transaction(operations);
  invalidatePermissionCache();
}
