import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { removeCompletion } from "@/services/assignment.service";

/**
 * DELETE /api/assignments/:id/completions/:userId
 * Remove a completion record for a specific assignment and user.
 * Requires assignments:write permission.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasPermission(session.user.role, "assignments", "write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, userId } = await params;

  await removeCompletion(id, userId);
  return NextResponse.json({ success: true });
}
