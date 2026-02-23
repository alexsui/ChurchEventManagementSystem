import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { deleteAssignment, AssignmentServiceError } from "@/services/assignment.service";

/**
 * DELETE /api/assignments/:id
 * Delete an assignment.
 * Requires assignments:write permission.
 */
export async function DELETE(
  _request: NextRequest,
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

  try {
    await deleteAssignment(id);
    return NextResponse.json({ success: true });
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
