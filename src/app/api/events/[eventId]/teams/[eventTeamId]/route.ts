import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import { updateEventTeam, deleteEventTeam, TeamServiceError } from "@/services/team.service";

type RouteParams = { params: Promise<{ eventId: string; eventTeamId: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
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

    const team = await updateEventTeam(eventTeamId, eventId, {
      sopLinks: body.sopLinks,
      customName: body.customName,
    });
    return NextResponse.json(team);
  } catch (error) {
    if (error instanceof TeamServiceError && error.code === "EVENT_TEAM_NOT_FOUND") {
      return NextResponse.json({ error: "Event team not found" }, { status: 404 });
    }
    console.error("PATCH event team error:", error);
    return NextResponse.json({ error: "Failed to update event team" }, { status: 500 });
  }
}

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

    const { eventId, eventTeamId } = await params;
    await deleteEventTeam(eventTeamId, eventId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TeamServiceError && error.code === "EVENT_TEAM_NOT_FOUND") {
      return NextResponse.json({ error: "Event team not found" }, { status: 404 });
    }
    console.error("DELETE event team error:", error);
    return NextResponse.json({ error: "Failed to delete event team" }, { status: 500 });
  }
}
