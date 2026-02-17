import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import { removeDefaultMember, TeamServiceError } from "@/services/team.service";

type RouteParams = { params: Promise<{ teamId: string; userId: string }> };

const statusMap: Record<string, number> = {
  DEFAULT_MEMBER_NOT_FOUND: 404,
};

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const inactiveResponse = assertActive(session.user);
    if (inactiveResponse) return inactiveResponse;

    if (!(await hasPermission(session.user.role, "teams", "write"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { teamId, userId } = await params;
    await removeDefaultMember(teamId, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TeamServiceError) {
      const status = statusMap[error.code] ?? 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("DELETE /api/teams/[teamId]/default-members/[userId] error:", error);
    return NextResponse.json({ error: "Failed to remove default member" }, { status: 500 });
  }
}
