import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import {
  getAllRolePermissions,
  bulkUpdateRolePermissions,
} from "@/services/role-permission.service";

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

  const matrix = await getAllRolePermissions();
  return NextResponse.json(matrix);
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

  if (!(await hasPermission(session.user.role, "users", "write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const matrix = await request.json();
    await bulkUpdateRolePermissions(matrix);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
