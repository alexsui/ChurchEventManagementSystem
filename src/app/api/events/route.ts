import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import { createEvent, getEvents, type CreateEventInput } from "@/services/event.service";
import { EventStatus } from "@/generated/prisma/client";
import type { EventType } from "@/generated/prisma/client";

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
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
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

    const inactiveResponse = assertActive(session.user);
    if (inactiveResponse) return inactiveResponse;

    if (!(await hasPermission(session.user.role, "events", "write"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const eventData = {
      title: body.title as string,
      description: body.description as string | undefined,
      location: body.location as string | undefined,
      category: body.category as CreateEventInput["category"],
      type: body.type as CreateEventInput["type"],
      maxParticipants: body.maxParticipants as number | undefined,
      minAssignmentRate:
        body.minAssignmentRate != null ? (body.minAssignmentRate as number) / 100 : undefined,
      session: body.session as CreateEventInput["session"],
      sessions: body.sessions as CreateEventInput["sessions"],
    };

    const event = await createEvent(eventData);
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("POST /api/events error:", error);
    const message = error instanceof Error ? error.message : "Failed to create event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
