import { prisma } from "@/lib/prisma";

export class BudgetServiceError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "BudgetServiceError";
  }
}

interface CreateBudgetItemInput {
  category: string;
  customCategory?: string;
  estimated: number;
  actual?: number;
  note?: string;
}

interface UpdateBudgetItemInput {
  category?: string;
  customCategory?: string;
  estimated?: number;
  actual?: number;
  note?: string;
}

export async function getBudgetItemsByEvent(eventId: string) {
  return prisma.budgetItem.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createBudgetItem(
  eventId: string,
  data: CreateBudgetItemInput
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new BudgetServiceError("Event not found", "EVENT_NOT_FOUND");
  }

  return prisma.budgetItem.create({
    data: {
      eventId,
      category: data.category,
      customCategory: data.customCategory,
      estimated: data.estimated,
      actual: data.actual,
      note: data.note,
    },
  });
}

export async function updateBudgetItem(
  id: string,
  data: UpdateBudgetItemInput
) {
  const item = await prisma.budgetItem.findUnique({ where: { id } });
  if (!item) {
    throw new BudgetServiceError(
      "Budget item not found",
      "BUDGET_ITEM_NOT_FOUND"
    );
  }

  return prisma.budgetItem.update({
    where: { id },
    data,
  });
}

export async function deleteBudgetItem(id: string) {
  const item = await prisma.budgetItem.findUnique({ where: { id } });
  if (!item) {
    throw new BudgetServiceError(
      "Budget item not found",
      "BUDGET_ITEM_NOT_FOUND"
    );
  }

  return prisma.budgetItem.delete({ where: { id } });
}

export async function getBudgetSummary(eventId: string) {
  const result = await prisma.budgetItem.aggregate({
    where: { eventId },
    _sum: { estimated: true, actual: true },
  });

  const totalEstimated = result._sum.estimated ?? 0;
  const totalActual = result._sum.actual ?? 0;

  return {
    totalEstimated,
    totalActual,
    difference: totalEstimated - totalActual,
    executionRate: totalEstimated > 0 ? totalActual / totalEstimated : 0,
  };
}
