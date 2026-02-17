import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import {
  registerForEvent,
  getRegistrationsByEvent,
  getRegistrationsByUser,
  RegistrationServiceError,
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
      if (!(await hasPermission(session.user.role, "registrations", "read"))) {
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
 * Any logged-in user can register themselves — no admin permission needed.
 */
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const inactiveResponse = assertActive(session.user);
  if (inactiveResponse) return inactiveResponse;

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
    if (error instanceof RegistrationServiceError) {
      const statusMap: Record<string, number> = {
        EVENT_NOT_FOUND: 404,
        EVENT_NOT_OPEN: 400,
        ALREADY_REGISTERED: 409,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] || 400 }
      );
    }
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
