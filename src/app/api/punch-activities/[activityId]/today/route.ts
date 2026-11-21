import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertActive } from "@/lib/authorization";
import { getTodayStatus, punchToday } from "@/services/punch.service";
import { punchErrorResponse } from "../../shared";

type Params = { params: Promise<{ activityId: string }> };

/**
 * GET /api/punch-activities/[activityId]/today
 * Member-facing status for today. Works without login (status NOT_LOGGED_IN).
 */
export async function GET(_request: Request, { params }: Params) {
  const { activityId } = await params;
  try {
    const session = await auth();
    return NextResponse.json(await getTodayStatus(activityId, session?.user?.id));
  } catch (error) {
    return punchErrorResponse(error);
  }
}

/**
 * POST /api/punch-activities/[activityId]/today — punch for today.
 * Authorized by roster membership, not by role permissions: plain members
 * have no module permissions.
 */
export async function POST(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const inactive = assertActive(session.user);
  if (inactive) return inactive;

  const { activityId } = await params;
  try {
    const record = await punchToday(activityId, session.user.id);
    return NextResponse.json({ punchedAt: record.punchedAt }, { status: 201 });
  } catch (error) {
    return punchErrorResponse(error);
  }
}
