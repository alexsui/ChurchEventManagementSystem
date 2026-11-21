import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import { PunchServiceError } from "@/services/punch.service";

const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  MEMBER_NOT_FOUND: 404,
  USER_NOT_FOUND: 404,
  NOT_MEMBER: 403,
  OUT_OF_RANGE: 403,
  ALREADY_MEMBER: 409,
  ALREADY_PUNCHED: 409,
  INVALID_INPUT: 400,
  INVALID_DATE: 400,
};

/** Map service errors to JSON responses; rethrow anything unexpected. */
export function punchErrorResponse(error: unknown) {
  if (error instanceof PunchServiceError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: STATUS_BY_CODE[error.code] ?? 400 }
    );
  }
  console.error("Punch API error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/**
 * Admin-side guard: logged in + attendance permission (+ active account for writes).
 * Returns either the session or a response to return immediately.
 */
export async function authorizeAttendance(
  action: "read" | "write"
): Promise<{ session: Session; response?: never } | { session?: never; response: Response }> {
  const session = await auth();
  if (!session?.user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (action === "write") {
    const inactive = assertActive(session.user);
    if (inactive) return { response: inactive };
  }
  if (!(await hasPermission(session.user.role, "attendance", action))) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
