import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import {
  registerForEvent,
  getRegistrationsByEvent,
  getRegistrationsByUser,
} from "@/services/registration.service";

/**
 * GET /api/registrations
 *
 * - Admin / users with registrations:read+write: can query by ?eventId=...
 * - Regular members: get their own registrations only
 */
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const eventId = searchParams.get("eventId");

  try {
    // If eventId is provided, check for admin-level permission
    if (eventId) {
      if (!(await hasPermission(session.user.role, "registrations", "write"))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const registrations = await getRegistrationsByEvent(eventId);
      return NextResponse.json(registrations);
    }

    // Otherwise return the current user's own registrations
    const registrations = await getRegistrationsByUser(session.user.id);
    return NextResponse.json(registrations);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/registrations
 *
 * Body: { eventId: string }
 * Registers the current authenticated user for the given event.
 */
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasPermission(session.user.role, "registrations", "read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { eventId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.eventId) {
    return NextResponse.json(
      { error: "eventId is required" },
      { status: 400 }
    );
  }

  try {
    const registration = await registerForEvent(session.user.id, body.eventId);
    return NextResponse.json(registration, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";

    if (
      message === "Event not found" ||
      message === "Event is not open for registration" ||
      message === "User is already registered for this event"
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
