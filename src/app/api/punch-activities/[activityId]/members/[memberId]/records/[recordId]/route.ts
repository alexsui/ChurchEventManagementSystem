import { NextResponse } from "next/server";
import { deletePunchRecord } from "@/services/punch.service";
import { authorizeAttendance, punchErrorResponse } from "../../../../../shared";

type Params = { params: Promise<{ activityId: string; memberId: string; recordId: string }> };

/** DELETE /api/punch-activities/[activityId]/members/[memberId]/records/[recordId] */
export async function DELETE(_request: Request, { params }: Params) {
  const { response } = await authorizeAttendance("write");
  if (response) return response;

  const { activityId, memberId, recordId } = await params;
  try {
    await deletePunchRecord(activityId, memberId, recordId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return punchErrorResponse(error);
  }
}
