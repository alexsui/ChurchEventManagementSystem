import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import type { Module } from "@/lib/authorization";
import { Role } from "@/generated/prisma/client";
import {
  getAllRolePermissions,
  bulkUpdateRolePermissions,
} from "@/services/role-permission.service";

const VALID_ROLES = Object.values(Role).filter((r) => r !== Role.ADMIN);
const VALID_MODULES: Module[] = [
  "events",
  "registrations",
  "attendance",
  "assignments",
  "users",
  "teams",
  "budget",
  "reports",
];

function isValidPermissionMatrix(
  matrix: unknown
): matrix is Record<string, Record<string, { read: boolean; write: boolean }>> {
  if (typeof matrix !== "object" || matrix === null || Array.isArray(matrix)) {
    return false;
  }
  for (const [role, modules] of Object.entries(matrix)) {
    if (!(VALID_ROLES as string[]).includes(role)) return false;
    if (typeof modules !== "object" || modules === null) return false;
    for (const [mod, perms] of Object.entries(modules as Record<string, unknown>)) {
      if (!VALID_MODULES.includes(mod as Module)) return false;
      if (
        typeof perms !== "object" ||
        perms === null ||
        typeof (perms as Record<string, unknown>).read !== "boolean" ||
        typeof (perms as Record<string, unknown>).write !== "boolean"
      ) {
        return false;
      }
    }
  }
  return true;
}

/**
 * GET /api/role-permissions
 * Returns the full permission matrix for all non-ADMIN roles.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasPermission(session.user.role, "users", "read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const matrix = await getAllRolePermissions();
    return NextResponse.json(matrix);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/role-permissions
 * Bulk update all role permissions.
 */
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const inactiveResponse = assertActive(session.user);
  if (inactiveResponse) return inactiveResponse;

  if (!(await hasPermission(session.user.role, "users", "write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let matrix: unknown;
  try {
    matrix = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidPermissionMatrix(matrix)) {
    return NextResponse.json(
      {
        error:
          "Invalid permission matrix: keys must be non-ADMIN roles, values must be modules with { read: boolean, write: boolean }",
      },
      { status: 400 }
    );
  }

  try {
    await bulkUpdateRolePermissions(matrix);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
