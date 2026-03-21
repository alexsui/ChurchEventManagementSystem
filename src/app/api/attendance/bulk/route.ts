import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import { bulkCheckIn, AttendanceServiceError } from "@/services/attendance.service";

/**
 * POST /api/attendance/bulk
 * Bulk check-in multiple users to an event session.
 * Requires attendance:write permission.
 * Body: { eventSessionId: string, userIds: string[] }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const inactiveResponse = assertActive(session.user);
  if (inactiveResponse) return inactiveResponse;

  if (!(await hasPermission(session.user.role, "attendance", "write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { eventSessionId?: string; userIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { eventSessionId, userIds } = body;

  if (!eventSessionId) {
    return NextResponse.json({ error: "eventSessionId is required" }, { status: 400 });
  }

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: "userIds must be a non-empty array" }, { status: 400 });
  }

  try {
    const result = await bulkCheckIn(eventSessionId, userIds);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AttendanceServiceError) {
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
