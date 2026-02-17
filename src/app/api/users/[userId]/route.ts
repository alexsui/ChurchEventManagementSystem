import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import {
  getUserById,
  updateUserRole,
  toggleUserActive,
} from "@/services/user.service";
import { Role } from "@/generated/prisma/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await hasPermission(session.user.role, "users", "read"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId } = await params;
    const user = await getUserById(userId);

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const inactiveResponse = assertActive(session.user);
    if (inactiveResponse) return inactiveResponse;

    if (!(await hasPermission(session.user.role, "users", "write"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId } = await params;
    const body = await request.json();

    // Toggle active status
    if (body.action === "toggleActive") {
      const user = await toggleUserActive(userId);

      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(user);
    }

    // Update role
    if (body.role) {
      const validRoles = Object.values(Role);
      if (!validRoles.includes(body.role)) {
        return NextResponse.json(
          { error: "Invalid role" },
          { status: 400 }
        );
      }

      const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;

      const user = await updateUserRole(
        userId,
        body.role as Role,
        expiresAt
      );

      return NextResponse.json(user);
    }

    return NextResponse.json(
      { error: "Missing required parameter (role or action)" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}
