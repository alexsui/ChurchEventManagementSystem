import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import {
  checkIn,
  getAttendanceBySession,
  getAttendanceByUser,
  markLate,
  AttendanceServiceError,
} from "@/services/attendance.service";

/**
 * GET /api/attendance
 * - ?eventSessionId= : list attendance by session (requires attendance:read with write, or admin)
 * - ?userId=&eventId= : list own attendance for an event (member can view own)
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const eventSessionId = searchParams.get("eventSessionId");
  const userId = searchParams.get("userId");
  const eventId = searchParams.get("eventId");

  try {
    // List attendance by session (admin/staff use case)
    if (eventSessionId) {
      if (!(await hasPermission(session.user.role, "attendance", "read"))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const attendance = await getAttendanceBySession(eventSessionId);
      return NextResponse.json(attendance);
    }

    // List own attendance by user and event
    if (userId && eventId) {
      // Members can only view their own attendance
      if (
        userId !== session.user.id &&
        !(await hasPermission(session.user.role, "attendance", "write"))
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const attendance = await getAttendanceByUser(userId, eventId);
      return NextResponse.json(attendance);
    }

    return NextResponse.json(
      { error: "Missing required query parameters: eventSessionId, or userId and eventId" },
      { status: 400 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/attendance
 * Check in the current user to an event session.
 * Body: { eventSessionId: string }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Intentionally checks "read" not "write": this endpoint is for member self-check-in
  // via QR code. All authenticated members with attendance:read can check themselves in.
  // Admin bulk-check-in operations use separate endpoints requiring attendance:write.
  if (!(await hasPermission(session.user.role, "attendance", "read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { eventSessionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { eventSessionId } = body;
  if (!eventSessionId) {
    return NextResponse.json(
      { error: "eventSessionId is required" },
      { status: 400 }
    );
  }

  try {
    const attendance = await checkIn(session.user.id, eventSessionId);
    return NextResponse.json(attendance, { status: 201 });
  } catch (error) {
    if (error instanceof AttendanceServiceError) {
      const statusMap: Record<string, number> = {
        SESSION_NOT_FOUND: 404,
        NOT_REGISTERED: 403,
        ALREADY_CHECKED_IN: 409,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] || 400 }
      );
    }
    throw error;
  }
}

/**
 * PATCH /api/attendance
 * Mark an attendance record as late.
 * Body: { attendanceId: string, lateMinutes: number }
 */
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasPermission(session.user.role, "attendance", "write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { attendanceId?: string; lateMinutes?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { attendanceId, lateMinutes } = body;
  if (!attendanceId || lateMinutes === undefined || lateMinutes === null) {
    return NextResponse.json(
      { error: "attendanceId and lateMinutes are required" },
      { status: 400 }
    );
  }

  if (typeof lateMinutes !== "number" || lateMinutes < 0) {
    return NextResponse.json(
      { error: "lateMinutes must be a non-negative number" },
      { status: 400 }
    );
  }

  try {
    const attendance = await markLate(attendanceId, lateMinutes);
    return NextResponse.json(attendance);
  } catch (error) {
    if (error instanceof AttendanceServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 404 }
      );
    }
    throw error;
  }
}
