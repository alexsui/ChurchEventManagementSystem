import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import { addEventTeamMember } from "@/services/team.service";

type RouteParams = { params: Promise<{ eventId: string; eventTeamId: string }> };

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

    const { eventId, eventTeamId } = await params;
    const body = await request.json();

    if (!body.userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const member = await addEventTeamMember(eventTeamId, eventId, body.userId, body.role);
    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error("POST member error:", error);
    const message = error instanceof Error ? error.message : "Failed to add member";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
