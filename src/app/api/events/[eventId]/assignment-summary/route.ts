import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import { getAssignmentSummaryByEvent } from "@/services/assignment.service";

type RouteParams = { params: Promise<{ eventId: string }> };

/**
 * GET /api/events/:eventId/assignment-summary
 * Returns all assignments with completions across all sessions (requires assignments:read).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const inactiveResponse = assertActive(session.user);
    if (inactiveResponse) return inactiveResponse;

    if (!(await hasPermission(session.user.role, "assignments", "read"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { eventId } = await params;
    const summary = await getAssignmentSummaryByEvent(eventId);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("GET /api/events/[eventId]/assignment-summary error:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignment summary" },
      { status: 500 }
    );
  }
}
