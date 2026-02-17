import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  event: {
    findUnique: vi.fn(),
  },
  budgetItem: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import {
  getBudgetItemsByEvent,
  createBudgetItem,
  updateBudgetItem,
  deleteBudgetItem,
  getBudgetSummary,
  BudgetServiceError,
} from "./budget.service";

function makeBudgetItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "bi-1",
    eventId: "event-1",
    category: "MEAL",
    customCategory: null,
    estimated: 5000,
    actual: 4500,
    note: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("budget.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getBudgetItemsByEvent", () => {
    it("should return all budget items for an event ordered by createdAt", async () => {
      const items = [makeBudgetItem(), makeBudgetItem({ id: "bi-2", category: "SNACK" })];
      mockPrisma.budgetItem.findMany.mockResolvedValue(items);

      const result = await getBudgetItemsByEvent("event-1");

      expect(result).toEqual(items);
      expect(mockPrisma.budgetItem.findMany).toHaveBeenCalledWith({
        where: { eventId: "event-1" },
        orderBy: { createdAt: "asc" },
      });
    });
  });

  describe("createBudgetItem", () => {
    it("should create a budget item for a valid event", async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: "event-1" });
      const created = makeBudgetItem();
      mockPrisma.budgetItem.create.mockResolvedValue(created);

      const result = await createBudgetItem("event-1", {
        category: "MEAL",
        estimated: 5000,
        actual: 4500,
      });

      expect(result).toEqual(created);
      expect(mockPrisma.budgetItem.create).toHaveBeenCalledWith({
        data: {
          eventId: "event-1",
          category: "MEAL",
          customCategory: undefined,
          estimated: 5000,
          actual: 4500,
          note: undefined,
        },
      });
    });

    it("should throw EVENT_NOT_FOUND when event does not exist", async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);

      await expect(
        createBudgetItem("event-1", { category: "MEAL", estimated: 5000 })
      ).rejects.toThrow(BudgetServiceError);
      await expect(
        createBudgetItem("event-1", { category: "MEAL", estimated: 5000 })
      ).rejects.toMatchObject({ code: "EVENT_NOT_FOUND" });
    });

    it("should pass customCategory when category is OTHER", async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: "event-1" });
      const created = makeBudgetItem({ category: "OTHER", customCategory: "印刷費" });
      mockPrisma.budgetItem.create.mockResolvedValue(created);

      await createBudgetItem("event-1", {
        category: "OTHER",
        customCategory: "印刷費",
        estimated: 2000,
      });

      expect(mockPrisma.budgetItem.create).toHaveBeenCalledWith({
        data: {
          eventId: "event-1",
          category: "OTHER",
          customCategory: "印刷費",
          estimated: 2000,
          actual: undefined,
          note: undefined,
        },
      });
    });
  });

  describe("updateBudgetItem", () => {
    it("should update a budget item", async () => {
      mockPrisma.budgetItem.findUnique.mockResolvedValue(makeBudgetItem());
      const updated = makeBudgetItem({ actual: 5500 });
      mockPrisma.budgetItem.update.mockResolvedValue(updated);

      const result = await updateBudgetItem("bi-1", { actual: 5500 });

      expect(result).toEqual(updated);
      expect(mockPrisma.budgetItem.update).toHaveBeenCalledWith({
        where: { id: "bi-1" },
        data: { actual: 5500 },
      });
    });

    it("should throw BUDGET_ITEM_NOT_FOUND when item does not exist", async () => {
      mockPrisma.budgetItem.findUnique.mockResolvedValue(null);

      await expect(updateBudgetItem("bi-1", { actual: 5500 })).rejects.toThrow(
        BudgetServiceError
      );
      await expect(
        updateBudgetItem("bi-1", { actual: 5500 })
      ).rejects.toMatchObject({ code: "BUDGET_ITEM_NOT_FOUND" });
    });
  });

  describe("deleteBudgetItem", () => {
    it("should delete an existing budget item", async () => {
      mockPrisma.budgetItem.findUnique.mockResolvedValue(makeBudgetItem());
      mockPrisma.budgetItem.delete.mockResolvedValue(makeBudgetItem());

      const result = await deleteBudgetItem("bi-1");

      expect(result).toEqual(makeBudgetItem());
      expect(mockPrisma.budgetItem.delete).toHaveBeenCalledWith({
        where: { id: "bi-1" },
      });
    });

    it("should throw BUDGET_ITEM_NOT_FOUND when item does not exist", async () => {
      mockPrisma.budgetItem.findUnique.mockResolvedValue(null);

      await expect(deleteBudgetItem("bi-1")).rejects.toThrow(BudgetServiceError);
      await expect(deleteBudgetItem("bi-1")).rejects.toMatchObject({
        code: "BUDGET_ITEM_NOT_FOUND",
      });
    });
  });

  describe("getBudgetSummary", () => {
    it("should return totals and execution rate", async () => {
      mockPrisma.budgetItem.aggregate.mockResolvedValue({
        _sum: { estimated: 10000, actual: 7500 },
      });

      const result = await getBudgetSummary("event-1");

      expect(result).toEqual({
        totalEstimated: 10000,
        totalActual: 7500,
        difference: 2500,
        executionRate: 0.75,
      });
    });

    it("should return zeros when no budget items exist", async () => {
      mockPrisma.budgetItem.aggregate.mockResolvedValue({
        _sum: { estimated: null, actual: null },
      });

      const result = await getBudgetSummary("event-1");

      expect(result).toEqual({
        totalEstimated: 0,
        totalActual: 0,
        difference: 0,
        executionRate: 0,
      });
    });
  });
});
