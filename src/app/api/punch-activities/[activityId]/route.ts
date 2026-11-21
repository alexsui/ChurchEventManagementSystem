import { NextResponse } from "next/server";
import {
  getPunchActivityDetail,
  updatePunchActivity,
  deletePunchActivity,
} from "@/services/punch.service";
import { authorizeAttendance, punchErrorResponse, readJson } from "../shared";

type Params = { params: Promise<{ activityId: string }> };

/** GET /api/punch-activities/[activityId] — activity, rehearsal dates, member stats. */
export async function GET(_request: Request, { params }: Params) {
  const { response } = await authorizeAttendance("read");
  if (response) return response;

  const { activityId } = await params;
  try {
    return NextResponse.json(await getPunchActivityDetail(activityId));
  } catch (error) {
    return punchErrorResponse(error);
  }
}

/** PATCH /api/punch-activities/[activityId] — Body: { title, startDate, endDate } */
export async function PATCH(request: Request, { params }: Params) {
  const { response } = await authorizeAttendance("write");
  if (response) return response;

  const body = await readJson<{ title?: string; startDate?: string; endDate?: string }>(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const { activityId } = await params;
  try {
    const activity = await updatePunchActivity(activityId, {
      title: body.title ?? "",
      startDate: body.startDate ?? "",
      endDate: body.endDate ?? "",
    });
    return NextResponse.json(activity);
  } catch (error) {
    return punchErrorResponse(error);
  }
}

/** DELETE /api/punch-activities/[activityId] — removes roster and all records. */
export async function DELETE(_request: Request, { params }: Params) {
  const { response } = await authorizeAttendance("write");
  if (response) return response;

  const { activityId } = await params;
  try {
    await deletePunchActivity(activityId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return punchErrorResponse(error);
  }
}
