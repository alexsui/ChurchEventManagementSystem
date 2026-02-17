import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import {
  getAssignmentsBySession,
  createAssignment,
  AssignmentServiceError,
} from "@/services/assignment.service";

/**
 * GET /api/assignments?eventSessionId=xxx
 * List assignments for a session.
 * Requires assignments:read permission.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasPermission(session.user.role, "assignments", "read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const eventSessionId = request.nextUrl.searchParams.get("eventSessionId");
  if (!eventSessionId) {
    return NextResponse.json(
      { error: "eventSessionId is required" },
      { status: 400 }
    );
  }

  const assignments = await getAssignmentsBySession(eventSessionId);
  return NextResponse.json(assignments);
}

/**
 * POST /api/assignments
 * Create a new assignment.
 * Requires assignments:write permission.
 * Body: { eventSessionId: string, title: string }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasPermission(session.user.role, "assignments", "write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { eventSessionId?: string; title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { eventSessionId, title } = body;

  if (!eventSessionId) {
    return NextResponse.json(
      { error: "eventSessionId is required" },
      { status: 400 }
    );
  }

  if (!title) {
    return NextResponse.json(
      { error: "title is required" },
      { status: 400 }
    );
  }

  try {
    const assignment = await createAssignment(eventSessionId, title.trim());
    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    if (error instanceof AssignmentServiceError) {
      const statusMap: Record<string, number> = {
        SESSION_NOT_FOUND: 404,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] || 400 }
      );
    }
    throw error;
  }
}
