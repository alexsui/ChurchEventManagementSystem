import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPermissionsForRole } from "@/services/role-permission.service";

/**
 * GET /api/me/permissions
 *
 * Returns the current user's module permissions.
 * Only requires authentication — any logged-in user can check their own permissions.
 *
 * Response:
 *   { isAdmin: true } for ADMIN role
 *   { isAdmin: false, permissions: { events: { read: true, write: false }, ... } }
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;

  if (role === "ADMIN") {
    return NextResponse.json({ isAdmin: true });
  }

  const permissions = await getPermissionsForRole(role);
  return NextResponse.json({ isAdmin: false, permissions: permissions ?? {} });
}
