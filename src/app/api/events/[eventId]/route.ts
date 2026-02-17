import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import {
  getEventById,
  updateEvent,
  updateEventStatus,
  deleteEvent,
} from "@/services/event.service";
import type { EventStatus } from "@/generated/prisma/client";

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
    return NextResponse.json(
      { error: "Failed to fetch event" },
      { status: 500 }
    );
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

    if (!(await hasPermission(session.user.role, "events", "write"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { eventId } = await params;
    const body = await request.json();

    const existingEvent = await getEventById(eventId);
    if (!existingEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const event = await updateEvent(eventId, body);
    return NextResponse.json(event);
  } catch (error) {
    console.error("PUT /api/events/[eventId] error:", error);
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
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

    if (!(await hasPermission(session.user.role, "events", "write"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { eventId } = await params;
    const body = await request.json();

    if (!body.status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    const existingEvent = await getEventById(eventId);
    if (!existingEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const event = await updateEventStatus(eventId, body.status as EventStatus);
    return NextResponse.json(event);
  } catch (error) {
    console.error("PATCH /api/events/[eventId] error:", error);
    return NextResponse.json(
      { error: "Failed to update event status" },
      { status: 500 }
    );
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

    if (!(await hasPermission(session.user.role, "events", "write"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { eventId } = await params;

    const existingEvent = await getEventById(eventId);
    if (!existingEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await deleteEvent(eventId);
    return NextResponse.json({ message: "Event deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/events/[eventId] error:", error);
    return NextResponse.json(
      { error: "Failed to delete event" },
      { status: 500 }
    );
  }
}
