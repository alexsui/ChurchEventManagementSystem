import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
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
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    if (!(await hasPermission(session.user.role, "users", "read"))) {
      return NextResponse.json({ error: "權限不足" }, { status: 403 });
    }

    const { userId } = await params;
    const user = await getUserById(userId);

    if (!user) {
      return NextResponse.json(
        { error: "找不到該使用者" },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "取得使用者資料失敗" },
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
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    if (!(await hasPermission(session.user.role, "users", "write"))) {
      return NextResponse.json({ error: "權限不足" }, { status: 403 });
    }

    const { userId } = await params;
    const body = await request.json();

    // Toggle active status
    if (body.action === "toggleActive") {
      const user = await toggleUserActive(userId);

      if (!user) {
        return NextResponse.json(
          { error: "找不到該使用者" },
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
          { error: "無效的角色" },
          { status: 400 }
        );
      }

      const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;
      const teamId = body.teamId !== undefined ? body.teamId : undefined;

      const user = await updateUserRole(
        userId,
        body.role as Role,
        teamId,
        expiresAt
      );

      return NextResponse.json(user);
    }

    return NextResponse.json(
      { error: "缺少必要參數 (role 或 action)" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "更新使用者資料失敗" },
      { status: 500 }
    );
  }
}
