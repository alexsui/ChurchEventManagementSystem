import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCheckInSession, AttendanceServiceError } from "@/services/attendance.service";

/**
 * GET /api/check-in/[sessionId]
 * Looks up an EventSession by ID (with parent Event).
 * If the user is authenticated, also checks for an existing Attendance record.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  try {
    const session = await auth();
    const result = await getCheckInSession(sessionId, session?.user?.id);
    return NextResponse.json(result);
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
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
