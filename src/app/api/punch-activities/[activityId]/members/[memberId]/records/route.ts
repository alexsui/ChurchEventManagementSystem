import { NextResponse } from "next/server";
import { makeUpPunch } from "@/services/punch.service";
import { authorizeAttendance, punchErrorResponse, readJson } from "../../../../shared";

type Params = { params: Promise<{ activityId: string; memberId: string }> };

/**
 * POST /api/punch-activities/[activityId]/members/[memberId]/records
 * Admin make-up punch (補打卡). Body: { date: "YYYY-MM-DD" }
 */
export async function POST(request: Request, { params }: Params) {
  const { session, response } = await authorizeAttendance("write");
  if (response) return response;

  const body = await readJson<{ date?: string }>(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const { activityId, memberId } = await params;
  try {
    const record = await makeUpPunch(activityId, memberId, body.date ?? "", session.user.id);
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    return punchErrorResponse(error);
  }
}
