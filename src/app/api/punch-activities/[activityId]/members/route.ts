import { NextResponse } from "next/server";
import { addPunchMember } from "@/services/punch.service";
import { authorizeAttendance, punchErrorResponse, readJson } from "../../shared";

type Params = { params: Promise<{ activityId: string }> };

/** POST /api/punch-activities/[activityId]/members — Body: { userId, joinedOn: "YYYY-MM-DD" } */
export async function POST(request: Request, { params }: Params) {
  const { response } = await authorizeAttendance("write");
  if (response) return response;

  const body = await readJson<{ userId?: string; joinedOn?: string }>(request);
  if (!body?.userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const { activityId } = await params;
  try {
    const member = await addPunchMember(activityId, {
      userId: body.userId,
      joinedOn: body.joinedOn ?? "",
    });
    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    return punchErrorResponse(error);
  }
}
