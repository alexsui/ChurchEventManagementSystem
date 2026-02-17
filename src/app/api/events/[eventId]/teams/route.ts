import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import { getEventTeams, createEventTeam, TeamServiceError } from "@/services/team.service";

type RouteParams = { params: Promise<{ eventId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await hasPermission(session.user.role, "teams", "read"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { eventId } = await params;
    const teams = await getEventTeams(eventId);
    return NextResponse.json(teams);
  } catch (error) {
    console.error("GET /api/events/[eventId]/teams error:", error);
    return NextResponse.json({ error: "Failed to fetch event teams" }, { status: 500 });
  }
}

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

    const { eventId } = await params;
    const body = await request.json();

    const team = await createEventTeam(eventId, {
      teamId: body.teamId,
      customName: body.customName,
    });
    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    if (error instanceof TeamServiceError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/events/[eventId]/teams error:", error);
    return NextResponse.json({ error: "Failed to create event team" }, { status: 500 });
  }
}
