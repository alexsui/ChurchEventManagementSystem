import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { getUsers } from "@/services/user.service";
import { Role } from "@/generated/prisma/client";

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await hasPermission(session.user.role, "users", "read"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role") as Role | null;
    const isActiveParam = searchParams.get("isActive");
    const search = searchParams.get("search");

    const filters: {
      role?: Role;
      isActive?: boolean;
      search?: string;
    } = {};

    if (role) {
      filters.role = role;
    }

    if (isActiveParam !== null) {
      filters.isActive = isActiveParam === "true";
    }

    if (search) {
      filters.search = search;
    }

    const users = await getUsers(Object.keys(filters).length > 0 ? filters : undefined);

    // Strip password hash, expose only a boolean flag
    const sanitized = users.map(({ password, ...rest }) => ({
      ...rest,
      hasPassword: !!password,
    }));

    return NextResponse.json(sanitized);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
