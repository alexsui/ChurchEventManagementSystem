import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import {
  getCompletionsByAssignment,
  markComplete,
  AssignmentServiceError,
} from "@/services/assignment.service";

/**
 * GET /api/assignments/:id/completions
 * List completions for an assignment.
 * Requires assignments:read permission.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasPermission(session.user.role, "assignments", "read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const completions = await getCompletionsByAssignment(id);
    return NextResponse.json(completions);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/assignments/:id/completions
 * Bulk mark assignment as complete for multiple users.
 * Requires assignments:write permission.
 * Body: { userIds: string[] }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasPermission(session.user.role, "assignments", "write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: { userIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userIds } = body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json(
      { error: "userIds must be a non-empty array" },
      { status: 400 }
    );
  }

  try {
    const result = await markComplete(id, userIds, session.user.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AssignmentServiceError) {
      const statusMap: Record<string, number> = {
        ASSIGNMENT_NOT_FOUND: 404,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] || 400 }
      );
    }
    throw error;
  }
}
