import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

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
    // Look up the event session with its parent event
    const eventSession = await prisma.eventSession.findUnique({
      where: { id: sessionId },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            description: true,
            location: true,
            type: true,
            status: true,
          },
        },
      },
    });

    if (!eventSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Check if the user is authenticated and has an existing attendance record
    const session = await auth();
    let attendance = null;

    if (session?.user) {
      const existing = await prisma.attendance.findUnique({
        where: {
          userId_eventSessionId: {
            userId: session.user.id,
            eventSessionId: sessionId,
          },
        },
        select: {
          id: true,
          checkedInAt: true,
        },
      });

      if (existing) {
        attendance = {
          id: existing.id,
          checkInTime: existing.checkedInAt,
        };
      }
    }

    return NextResponse.json({
      session: {
        id: eventSession.id,
        sessionNo: eventSession.sessionNo,
        sessionDate: eventSession.sessionDate,
        startTime: eventSession.startTime,
        endTime: eventSession.endTime,
        topic: eventSession.topic,
      },
      event: {
        id: eventSession.event.id,
        title: eventSession.event.title,
        location: eventSession.event.location,
      },
      attendance,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
