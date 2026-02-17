import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import { getTeamTemplates, createTeamTemplate } from "@/services/team.service";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await hasPermission(session.user.role, "teams", "read"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const templates = await getTeamTemplates();
    return NextResponse.json(templates);
  } catch (error) {
    console.error("GET /api/teams error:", error);
    return NextResponse.json({ error: "Failed to fetch team templates" }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();
    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const template = await createTeamTemplate(body.name.trim());
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("POST /api/teams error:", error);
    const message = error instanceof Error ? error.message : "Failed to create team template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
