import { NextResponse } from "next/server";
import { deletePunchDate } from "@/services/punch.service";
import { authorizeAttendance, punchErrorResponse } from "../../../shared";

type Params = { params: Promise<{ activityId: string; date: string }> };

/** DELETE /api/punch-activities/[activityId]/dates/[YYYY-MM-DD] — delete all punches that day. */
export async function DELETE(_request: Request, { params }: Params) {
  const { response } = await authorizeAttendance("write");
  if (response) return response;

  const { activityId, date } = await params;
  try {
    return NextResponse.json(await deletePunchDate(activityId, date));
  } catch (error) {
    return punchErrorResponse(error);
  }
}
