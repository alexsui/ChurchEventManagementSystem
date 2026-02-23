import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import {
  updateEventTeamTask,
  deleteEventTeamTask,
  TeamServiceError,
} from "@/services/team.service";

type RouteParams = {
  params: Promise<{ eventId: string; eventTeamId: string; taskId: string }>;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const inactiveResponse = assertActive(session.user);
    if (inactiveResponse) return inactiveResponse;

    if (!(await hasPermission(session.user.role, "teams", "write"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { taskId } = await params;
    const body = await request.json();

    const task = await updateEventTeamTask(taskId, {
      title: body.title,
      assigneeId: body.assigneeId,
      status: body.status,
    });
    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof TeamServiceError && error.code === "TASK_NOT_FOUND") {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    console.error("PATCH task error:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const inactiveResponse = assertActive(session.user);
    if (inactiveResponse) return inactiveResponse;

    if (!(await hasPermission(session.user.role, "teams", "write"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { taskId } = await params;
    await deleteEventTeamTask(taskId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TeamServiceError && error.code === "TASK_NOT_FOUND") {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    console.error("DELETE task error:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
