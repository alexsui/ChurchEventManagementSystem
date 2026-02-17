import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { createEvent, getEvents } from "@/services/event.service";
import type { EventStatus, EventType } from "@/generated/prisma/client";

/**
 * GET /api/events
 * List events (public, no auth required).
 * Optional query params: status, type
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as EventStatus | null;
    const type = searchParams.get("type") as EventType | null;

    const filters: { status?: EventStatus; type?: EventType } = {};
    if (status) filters.status = status;
    if (type) filters.type = type;

    const events = await getEvents(filters);
    return NextResponse.json(events);
  } catch (error) {
    console.error("GET /api/events error:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events
 * Create a new event (requires auth + events:write permission).
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await hasPermission(session.user.role, "events", "write"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    if (!body.title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const eventData = {
      ...body,
      minAssignmentRate:
        body.minAssignmentRate != null
          ? body.minAssignmentRate / 100
          : undefined,
    };

    const event = await createEvent(eventData);
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("POST /api/events error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
