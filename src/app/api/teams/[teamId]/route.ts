import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import {
  getTeamTemplateWithDefaults,
  updateTeamTemplate,
  deleteTeamTemplate,
  TeamServiceError,
} from "@/services/team.service";

type RouteParams = { params: Promise<{ teamId: string }> };

const statusMap: Record<string, number> = {
  TEMPLATE_NOT_FOUND: 404,
};

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await hasPermission(session.user.role, "teams", "read"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { teamId } = await params;
    const template = await getTeamTemplateWithDefaults(teamId);
    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof TeamServiceError) {
      const status = statusMap[error.code] ?? 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("GET /api/teams/[teamId] error:", error);
    return NextResponse.json({ error: "Failed to fetch team template" }, { status: 500 });
  }
}

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

    const { teamId } = await params;
    const body = await request.json();

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const template = await updateTeamTemplate(teamId, body.name.trim());
    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof TeamServiceError && error.code === "TEMPLATE_NOT_FOUND") {
      return NextResponse.json({ error: "Team template not found" }, { status: 404 });
    }
    console.error("PATCH /api/teams/[teamId] error:", error);
    return NextResponse.json({ error: "Failed to update team template" }, { status: 500 });
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

    const { teamId } = await params;
    await deleteTeamTemplate(teamId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TeamServiceError && error.code === "TEMPLATE_NOT_FOUND") {
      return NextResponse.json({ error: "Team template not found" }, { status: 404 });
    }
    console.error("DELETE /api/teams/[teamId] error:", error);
    return NextResponse.json({ error: "Failed to delete team template" }, { status: 500 });
  }
}
