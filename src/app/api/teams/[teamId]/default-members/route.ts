import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import { addDefaultMember, TeamServiceError } from "@/services/team.service";

type RouteParams = { params: Promise<{ teamId: string }> };

const statusMap: Record<string, number> = {
  TEMPLATE_NOT_FOUND: 404,
};

export async function POST(request: Request, { params }: RouteParams) {
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

    const { teamId } = await params;
    const body = await request.json();

    if (!body.userId || typeof body.userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const member = await addDefaultMember(teamId, body.userId, body.role);
    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    if (error instanceof TeamServiceError) {
      const status = statusMap[error.code] ?? 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("POST /api/teams/[teamId]/default-members error:", error);
    return NextResponse.json({ error: "Failed to add default member" }, { status: 500 });
  }
}
