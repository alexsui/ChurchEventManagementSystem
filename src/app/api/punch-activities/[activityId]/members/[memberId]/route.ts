import { NextResponse } from "next/server";
import { updatePunchMember, removePunchMember } from "@/services/punch.service";
import { authorizeAttendance, punchErrorResponse, readJson } from "../../../shared";

type Params = { params: Promise<{ activityId: string; memberId: string }> };

/**
 * PATCH /api/punch-activities/[activityId]/members/[memberId]
 * Body: { joinedOn: "YYYY-MM-DD", leftOn: "YYYY-MM-DD" | null }
 */
export async function PATCH(request: Request, { params }: Params) {
  const { response } = await authorizeAttendance("write");
  if (response) return response;

  const body = await readJson<{ joinedOn?: string; leftOn?: string | null }>(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const { activityId, memberId } = await params;
  try {
    const member = await updatePunchMember(activityId, memberId, {
      joinedOn: body.joinedOn ?? "",
      leftOn: body.leftOn || null,
    });
    return NextResponse.json(member);
  } catch (error) {
    return punchErrorResponse(error);
  }
}

/** DELETE — removes the roster entry and that member's records. */
export async function DELETE(_request: Request, { params }: Params) {
  const { response } = await authorizeAttendance("write");
  if (response) return response;

  const { activityId, memberId } = await params;
  try {
    await removePunchMember(activityId, memberId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return punchErrorResponse(error);
  }
}
