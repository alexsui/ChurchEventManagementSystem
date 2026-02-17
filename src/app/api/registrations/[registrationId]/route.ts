import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import {
  cancelRegistration,
  RegistrationServiceError,
} from "@/services/registration.service";

/**
 * DELETE /api/registrations/[registrationId]
 *
 * - A user can cancel their own registration.
 * - An admin (registrations:write) can cancel any registration.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ registrationId: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { registrationId } = await params;

  try {
    // Fetch the registration to determine ownership
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
    });

    if (!registration) {
      return NextResponse.json(
        { error: "Registration not found" },
        { status: 404 }
      );
    }

    const isOwner = registration.userId === session.user.id;
    const isAdmin = await hasPermission(
      session.user.role,
      "registrations",
      "write"
    );

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await cancelRegistration(registration.userId, registration.eventId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RegistrationServiceError) {
      const statusMap: Record<string, number> = {
        REGISTRATION_NOT_FOUND: 404,
        ALREADY_CANCELLED: 400,
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
