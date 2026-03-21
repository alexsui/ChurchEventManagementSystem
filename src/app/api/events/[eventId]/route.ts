import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import {
  getEventById,
  updateEvent,
  updateEventStatus,
  deleteEvent,
} from "@/services/event.service";
import { EventStatus } from "@/generated/prisma/client";
import { updateEventSchema } from "@/lib/validations";

type RouteParams = { params: Promise<{ eventId: string }> };

/**
 * GET /api/events/:eventId
 * Get a single event with sessions (public, no auth required).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const event = await getEventById(eventId);

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error("GET /api/events/[eventId] error:", error);
    return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 });
  }
}

/**
 * PUT /api/events/:eventId
 * Update event details (requires auth + events:write permission).
 */
export async function PUT(request: Request, { params }: RouteParams) {
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

    const { eventId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = updateEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const existingEvent = await getEventById(eventId);
    if (!existingEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const { minAssignmentRate, ...rest } = parsed.data;
    const updateData = {
      ...rest,
      minAssignmentRate: minAssignmentRate != null ? minAssignmentRate / 100 : undefined,
    };

    const event = await updateEvent(eventId, updateData);
    return NextResponse.json(event);
  } catch (error) {
    console.error("PUT /api/events/[eventId] error:", error);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}

/**
 * PATCH /api/events/:eventId
 * Update event status (requires auth + events:write permission).
 * Body: { status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "PLANNING" }
 */
export async function PATCH(request: Request, { params }: RouteParams) {
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

    const { eventId } = await params;
    const body = await request.json();

    if (!body.status || !Object.values(EventStatus).includes(body.status as EventStatus)) {
      return NextResponse.json({ error: "A valid status is required" }, { status: 400 });
    }

    const existingEvent = await getEventById(eventId);
    if (!existingEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const event = await updateEventStatus(eventId, body.status as EventStatus);
    return NextResponse.json(event);
  } catch (error) {
    console.error("PATCH /api/events/[eventId] error:", error);
    return NextResponse.json({ error: "Failed to update event status" }, { status: 500 });
  }
}

/**
 * DELETE /api/events/:eventId
 * Delete an event (requires auth + events:write permission).
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
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

    const { eventId } = await params;

    const existingEvent = await getEventById(eventId);
    if (!existingEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await deleteEvent(eventId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/events/[eventId] error:", error);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
