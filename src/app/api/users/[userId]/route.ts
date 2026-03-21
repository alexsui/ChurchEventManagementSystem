import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import { getUserById, updateUserRole, toggleUserActive } from "@/services/user.service";
import { Role } from "@/generated/prisma/client";
import { updateUserSchema } from "@/lib/validations";

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
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
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { password, ...sanitized } = user;
    return NextResponse.json({ ...sanitized, hasPassword: !!password });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    if ("action" in parsed.data) {
      const user = await toggleUserActive(userId);

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const { password: _pw1, ...sanitizedToggle } = user;
      return NextResponse.json({ ...sanitizedToggle, hasPassword: !!_pw1 });
    }

    const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined;
    const user = await updateUserRole(userId, parsed.data.role as Role, expiresAt);

    const { password: _pw2, ...sanitizedRole } = user;
    return NextResponse.json({ ...sanitizedRole, hasPassword: !!_pw2 });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
