import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { getEventById } from "@/services/event.service";
import { getFormFieldsByEvent } from "@/services/form-field.service";
import { EventStatus } from "@/generated/prisma/client";

type RouteParams = { params: Promise<{ eventId: string }> };

/**
 * GET /api/events/:eventId/form-fields
 *
 * Public mode (default): returns form fields only when event status is OPEN.
 * Admin mode (?admin=true): requires auth + events:read, returns fields regardless of status.
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const { searchParams } = new URL(request.url);
    const adminMode = searchParams.get("admin") === "true";

    if (adminMode) {
      const session = await auth();
      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (!(await hasPermission(session.user.role, "events", "read"))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const fields = await getFormFieldsByEvent(eventId);
      return NextResponse.json(fields);
    }

    // Public mode: only return fields for OPEN events
    const event = await getEventById(eventId);
    if (!event || event.status !== EventStatus.OPEN) {
      return NextResponse.json([]);
    }

    const fields = await getFormFieldsByEvent(eventId);
    return NextResponse.json(fields);
  } catch (error) {
    console.error("GET /api/events/[eventId]/form-fields error:", error);
    return NextResponse.json({ error: "Failed to fetch form fields" }, { status: 500 });
  }
}
