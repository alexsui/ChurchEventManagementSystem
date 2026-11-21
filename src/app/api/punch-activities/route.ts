import { NextResponse } from "next/server";
import { listPunchActivities, createPunchActivity } from "@/services/punch.service";
import { authorizeAttendance, punchErrorResponse, readJson } from "./shared";

/** GET /api/punch-activities — list punch activities (attendance:read). */
export async function GET() {
  const { response } = await authorizeAttendance("read");
  if (response) return response;

  try {
    return NextResponse.json(await listPunchActivities());
  } catch (error) {
    return punchErrorResponse(error);
  }
}

/**
 * POST /api/punch-activities — create (attendance:write).
 * Body: { title, startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD" }
 */
export async function POST(request: Request) {
  const { response } = await authorizeAttendance("write");
  if (response) return response;

  const body = await readJson<{ title?: string; startDate?: string; endDate?: string }>(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  try {
    const activity = await createPunchActivity({
      title: body.title ?? "",
      startDate: body.startDate ?? "",
      endDate: body.endDate ?? "",
    });
    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    return punchErrorResponse(error);
  }
}
