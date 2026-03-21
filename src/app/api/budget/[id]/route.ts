import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import { updateBudgetItem, deleteBudgetItem, BudgetServiceError } from "@/services/budget.service";
import { validBudgetCategories } from "@/lib/constants";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/budget/:id
 * Update a budget item (requires auth + budget:write).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const inactiveResponsePatch = assertActive(session.user);
    if (inactiveResponsePatch) return inactiveResponsePatch;

    if (!(await hasPermission(session.user.role, "budget", "write"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { category, customCategory, estimated, actual, note } = body;

    // Validate category if provided
    if (category !== undefined && !validBudgetCategories.includes(category)) {
      return NextResponse.json(
        {
          error: `category must be one of: ${validBudgetCategories.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate estimated if provided
    if (estimated !== undefined && typeof estimated !== "number") {
      return NextResponse.json({ error: "estimated must be a number" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (category !== undefined) updateData.category = category;
    if (customCategory !== undefined) updateData.customCategory = customCategory;
    if (estimated !== undefined) updateData.estimated = estimated;
    if (actual !== undefined) updateData.actual = actual;
    if (note !== undefined) updateData.note = note;

    const item = await updateBudgetItem(id, updateData);
    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof BudgetServiceError) {
      const statusMap: Record<string, number> = {
        BUDGET_ITEM_NOT_FOUND: 404,
      };
      const status = statusMap[error.code] ?? 500;
      return NextResponse.json({ error: error.message }, { status });
    }

    console.error("PATCH /api/budget/[id] error:", error);
    return NextResponse.json({ error: "Failed to update budget item" }, { status: 500 });
  }
}

/**
 * DELETE /api/budget/:id
 * Delete a budget item (requires auth + budget:write).
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const inactiveResponseDelete = assertActive(session.user);
    if (inactiveResponseDelete) return inactiveResponseDelete;

    if (!(await hasPermission(session.user.role, "budget", "write"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    await deleteBudgetItem(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof BudgetServiceError) {
      const statusMap: Record<string, number> = {
        BUDGET_ITEM_NOT_FOUND: 404,
      };
      const status = statusMap[error.code] ?? 500;
      return NextResponse.json({ error: error.message }, { status });
    }

    console.error("DELETE /api/budget/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete budget item" }, { status: 500 });
  }
}
