import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import {
  getBudgetItemsByEvent,
  createBudgetItem,
  getBudgetSummary,
  BudgetServiceError,
} from "@/services/budget.service";

const VALID_CATEGORIES = [
  "MEAL",
  "SNACK",
  "VENUE",
  "MATERIAL",
  "EQUIPMENT",
  "OTHER",
] as const;

/**
 * GET /api/budget?eventId=xxx
 * List budget items and summary for an event (requires auth + budget:read).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await hasPermission(session.user.role, "budget", "read"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json(
        { error: "eventId is required" },
        { status: 400 }
      );
    }

    const [items, summary] = await Promise.all([
      getBudgetItemsByEvent(eventId),
      getBudgetSummary(eventId),
    ]);

    return NextResponse.json({ items, summary });
  } catch (error) {
    console.error("GET /api/budget error:", error);
    return NextResponse.json(
      { error: "Failed to fetch budget" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/budget
 * Create a new budget item (requires auth + budget:write).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await hasPermission(session.user.role, "budget", "write"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { eventId, category, customCategory, estimated, actual, note } = body;

    // Validate required fields
    if (!eventId) {
      return NextResponse.json(
        { error: "eventId is required" },
        { status: 400 }
      );
    }

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        {
          error: `category must be one of: ${VALID_CATEGORIES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (estimated === undefined || estimated === null || typeof estimated !== "number") {
      return NextResponse.json(
        { error: "estimated is required and must be a number" },
        { status: 400 }
      );
    }

    const item = await createBudgetItem(eventId, {
      category,
      customCategory,
      estimated,
      actual,
      note,
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof BudgetServiceError) {
      const statusMap: Record<string, number> = {
        EVENT_NOT_FOUND: 404,
      };
      const status = statusMap[error.code] ?? 500;
      return NextResponse.json({ error: error.message }, { status });
    }

    console.error("POST /api/budget error:", error);
    return NextResponse.json(
      { error: "Failed to create budget item" },
      { status: 500 }
    );
  }
}
