import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import { getAttendanceSummaryByEvent } from "@/services/attendance.service";

type RouteParams = { params: Promise<{ eventId: string }> };

/**
 * GET /api/events/:eventId/attendance-summary
 * Returns all attendance records across all sessions (requires attendance:read).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const inactiveResponse = assertActive(session.user);
    if (inactiveResponse) return inactiveResponse;

    if (!(await hasPermission(session.user.role, "attendance", "read"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { eventId } = await params;
    const summary = await getAttendanceSummaryByEvent(eventId);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("GET /api/events/[eventId]/attendance-summary error:", error);
    return NextResponse.json({ error: "Failed to fetch attendance summary" }, { status: 500 });
  }
}
