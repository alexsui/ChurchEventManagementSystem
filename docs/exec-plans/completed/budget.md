# Budget Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a budget management module where each event has multiple budget line items with estimated vs. actual amounts.

**Architecture:** New `BudgetItem` Prisma model linked to Event. Service layer (`budget.service.ts`) handles CRUD + summary. API routes gate on `budget:read`/`budget:write` permissions. Single admin page at `/admin/budget` with event selector, items table, and summary.

**Tech Stack:** Prisma, Next.js API Routes, React + shadcn/ui, Vitest for service tests.

---

### Task 1: Add BudgetItem to Prisma schema

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add BudgetItem model to schema**

Add this model after the `AssignmentCompletion` model (before the closing of the file):

```prisma
model BudgetItem {
  id             String   @id @default(cuid())
  eventId        String
  category       String   // MEAL, SNACK, VENUE, MATERIAL, EQUIPMENT, OTHER
  customCategory String?
  estimated      Float
  actual         Float    @default(0)
  note           String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  event Event @relation(fields: [eventId], references: [id], onDelete: Cascade)
}
```

Add a `budgetItems` relation to the existing `Event` model (after `registrations Registration[]`):

```prisma
budgetItems   BudgetItem[]
```

**Step 2: Generate Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client"

**Step 3: Create migration**

Run: `npx prisma migrate dev --name add-budget-item`
Expected: Migration created and applied successfully.

**Step 4: Verify existing tests still pass**

Run: `npx vitest run`
Expected: All 77 tests pass.

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add BudgetItem model to Prisma schema"
```

---

### Task 2: Budget service layer with tests

**Files:**

- Create: `src/services/budget.service.ts`
- Create: `src/services/budget.service.test.ts`

**Step 1: Write the test file**

Create `src/services/budget.service.test.ts`:

```typescript
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("budget.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getBudgetItemsByEvent ───────────────────────────────────────

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

  // ─── createBudgetItem ───────────────────────────────────────────

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

  // ─── updateBudgetItem ───────────────────────────────────────────

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

      await expect(updateBudgetItem("bi-1", { actual: 5500 })).rejects.toThrow(BudgetServiceError);
      await expect(updateBudgetItem("bi-1", { actual: 5500 })).rejects.toMatchObject({
        code: "BUDGET_ITEM_NOT_FOUND",
      });
    });
  });

  // ─── deleteBudgetItem ───────────────────────────────────────────

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

  // ─── getBudgetSummary ───────────────────────────────────────────

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
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/budget.service.test.ts`
Expected: FAIL — module `./budget.service` not found.

**Step 3: Write the service implementation**

Create `src/services/budget.service.ts`:

```typescript
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

/**
 * Get all budget items for an event, ordered by createdAt.
 */
export async function getBudgetItemsByEvent(eventId: string) {
  return prisma.budgetItem.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Create a new budget item for an event.
 * Validates the event exists.
 */
export async function createBudgetItem(eventId: string, data: CreateBudgetItemInput) {
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

/**
 * Update an existing budget item.
 * Validates the item exists.
 */
export async function updateBudgetItem(id: string, data: UpdateBudgetItemInput) {
  const item = await prisma.budgetItem.findUnique({ where: { id } });
  if (!item) {
    throw new BudgetServiceError("Budget item not found", "BUDGET_ITEM_NOT_FOUND");
  }

  return prisma.budgetItem.update({
    where: { id },
    data,
  });
}

/**
 * Delete a budget item.
 * Validates the item exists.
 */
export async function deleteBudgetItem(id: string) {
  const item = await prisma.budgetItem.findUnique({ where: { id } });
  if (!item) {
    throw new BudgetServiceError("Budget item not found", "BUDGET_ITEM_NOT_FOUND");
  }

  return prisma.budgetItem.delete({ where: { id } });
}

/**
 * Get budget summary for an event.
 * Returns totalEstimated, totalActual, difference, executionRate.
 */
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
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/budget.service.test.ts`
Expected: All 9 tests pass.

**Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (77 existing + 9 new = 86).

**Step 6: Commit**

```bash
git add src/services/budget.service.ts src/services/budget.service.test.ts
git commit -m "feat: add budget service layer with tests"
```

---

### Task 3: Budget API routes

**Files:**

- Create: `src/app/api/budget/route.ts`
- Create: `src/app/api/budget/[id]/route.ts`

**Step 1: Create GET + POST route**

Create `src/app/api/budget/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { assertActive } from "@/lib/authorization";
import {
  getBudgetItemsByEvent,
  createBudgetItem,
  getBudgetSummary,
  BudgetServiceError,
} from "@/services/budget.service";

const VALID_CATEGORIES = ["MEAL", "SNACK", "VENUE", "MATERIAL", "EQUIPMENT", "OTHER"];

/**
 * GET /api/budget?eventId=xxx
 * List budget items + summary for an event.
 * Requires budget:read permission.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasPermission(session.user.role, "budget", "read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const eventId = request.nextUrl.searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  try {
    const [items, summary] = await Promise.all([
      getBudgetItemsByEvent(eventId),
      getBudgetSummary(eventId),
    ]);
    return NextResponse.json({ items, summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/budget
 * Create a new budget item.
 * Requires budget:write permission.
 * Body: { eventId, category, customCategory?, estimated, actual?, note? }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeCheck = assertActive(session.user);
  if (activeCheck) return activeCheck;

  if (!(await hasPermission(session.user.role, "budget", "write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { eventId, category, customCategory, estimated, actual, note } = body as {
    eventId?: string;
    category?: string;
    customCategory?: string;
    estimated?: number;
    actual?: number;
    note?: string;
  };

  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }
  if (!category || !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }
  if (estimated == null || typeof estimated !== "number") {
    return NextResponse.json(
      { error: "estimated is required and must be a number" },
      { status: 400 }
    );
  }

  try {
    const item = await createBudgetItem(eventId, {
      category,
      customCategory: category === "OTHER" ? customCategory : undefined,
      estimated,
      actual: typeof actual === "number" ? actual : undefined,
      note: typeof note === "string" ? note : undefined,
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof BudgetServiceError) {
      const statusMap: Record<string, number> = {
        EVENT_NOT_FOUND: 404,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] || 400 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: Create PATCH + DELETE route**

Create `src/app/api/budget/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import { updateBudgetItem, deleteBudgetItem, BudgetServiceError } from "@/services/budget.service";

const VALID_CATEGORIES = ["MEAL", "SNACK", "VENUE", "MATERIAL", "EQUIPMENT", "OTHER"];

/**
 * PATCH /api/budget/:id
 * Update a budget item.
 * Requires budget:write permission.
 * Body: { category?, customCategory?, estimated?, actual?, note? }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeCheck = assertActive(session.user);
  if (activeCheck) return activeCheck;

  if (!(await hasPermission(session.user.role, "budget", "write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Build update data with only allowed fields
  const data: Record<string, unknown> = {};
  if (body.category != null) {
    if (!VALID_CATEGORIES.includes(body.category as string)) {
      return NextResponse.json(
        { error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }
    data.category = body.category;
    data.customCategory =
      body.category === "OTHER" ? ((body.customCategory as string) ?? null) : null;
  }
  if (body.estimated != null) data.estimated = body.estimated;
  if (body.actual != null) data.actual = body.actual;
  if (body.note !== undefined) data.note = body.note;

  try {
    const item = await updateBudgetItem(id, data);
    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof BudgetServiceError) {
      const statusMap: Record<string, number> = {
        BUDGET_ITEM_NOT_FOUND: 404,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] || 400 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/budget/:id
 * Delete a budget item.
 * Requires budget:write permission.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeCheck = assertActive(session.user);
  if (activeCheck) return activeCheck;

  if (!(await hasPermission(session.user.role, "budget", "write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await deleteBudgetItem(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof BudgetServiceError) {
      const statusMap: Record<string, number> = {
        BUDGET_ITEM_NOT_FOUND: 404,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] || 400 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/app/api/budget/
git commit -m "feat: add budget API routes (GET/POST/PATCH/DELETE)"
```

**Note:** `assertActive` is imported from `@/lib/authorization`. If it does not exist in the worktree (it was added in a prior session on main), check `src/lib/authorization.ts` — if missing, add it:

```typescript
export function assertActive(user: { isActive?: boolean }): Response | null {
  if (user.isActive === false) {
    return Response.json({ error: "Account is inactive" }, { status: 403 });
  }
  return null;
}
```

---

### Task 4: Admin budget page

**Files:**

- Create: `src/app/admin/budget/page.tsx`

**Step 1: Create the budget admin page**

Create `src/app/admin/budget/page.tsx`. This is a single-page admin view with:

- Event selector dropdown
- Budget items table with columns: 類別, 備註, 預估金額, 實際金額, 操作
- Summary row showing totals + execution rate
- Add/Edit dialogs for budget items
- Delete with confirmation

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAdminPermissions } from "@/contexts/admin-permissions";

// -- Constants ---------------------------------------------------------------

const CATEGORIES = [
  { value: "MEAL", label: "午晚餐" },
  { value: "SNACK", label: "茶點" },
  { value: "VENUE", label: "場佈" },
  { value: "MATERIAL", label: "材料" },
  { value: "EQUIPMENT", label: "設備" },
  { value: "OTHER", label: "其他" },
] as const;

const categoryLabel = (cat: string, custom?: string | null) => {
  if (cat === "OTHER" && custom) return custom;
  return CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
};

// -- Types -------------------------------------------------------------------

interface EventItem {
  id: string;
  title: string;
  status: string;
}

interface BudgetItem {
  id: string;
  eventId: string;
  category: string;
  customCategory: string | null;
  estimated: number;
  actual: number;
  note: string | null;
}

interface BudgetSummary {
  totalEstimated: number;
  totalActual: number;
  difference: number;
  executionRate: number;
}

interface FormData {
  category: string;
  customCategory: string;
  estimated: string;
  actual: string;
  note: string;
}

const emptyForm: FormData = {
  category: "MEAL",
  customCategory: "",
  estimated: "",
  actual: "",
  note: "",
};

// -- Page Component ----------------------------------------------------------

export default function BudgetPage() {
  const { canRead, canWrite } = useAdminPermissions("budget");

  // State
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteItem, setDeleteItem] = useState<BudgetItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch events on mount
  useEffect(() => {
    fetch("/api/events")
      .then((res) => res.json())
      .then((data) => {
        const eventList = Array.isArray(data) ? data : (data.events ?? []);
        setEvents(eventList);
      })
      .catch(() => toast.error("無法載入活動列表"));
  }, []);

  // Fetch budget data when event changes
  const fetchBudget = useCallback(async (eventId: string) => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/budget?eventId=${eventId}`);
      if (!res.ok) throw new Error("Failed to load budget");
      const data = await res.json();
      setItems(data.items);
      setSummary(data.summary);
    } catch {
      toast.error("無法載入預算資料");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchBudget(selectedEventId);
    } else {
      setItems([]);
      setSummary(null);
    }
  }, [selectedEventId, fetchBudget]);

  // Add item
  function handleAdd() {
    setEditingItem(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  // Edit item
  function handleEdit(item: BudgetItem) {
    setEditingItem(item);
    setForm({
      category: item.category,
      customCategory: item.customCategory ?? "",
      estimated: String(item.estimated),
      actual: String(item.actual),
      note: item.note ?? "",
    });
    setDialogOpen(true);
  }

  // Save (create or update)
  async function handleSave() {
    const estimated = parseFloat(form.estimated);
    const actual = parseFloat(form.actual) || 0;

    if (!form.category) {
      toast.error("請選擇類別");
      return;
    }
    if (isNaN(estimated)) {
      toast.error("請輸入有效的預估金額");
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        // Update
        const res = await fetch(`/api/budget/${editingItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: form.category,
            customCategory: form.category === "OTHER" ? form.customCategory : undefined,
            estimated,
            actual,
            note: form.note || null,
          }),
        });
        if (!res.ok) throw new Error("更新失敗");
        toast.success("預算項目已更新");
      } else {
        // Create
        const res = await fetch("/api/budget", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: selectedEventId,
            category: form.category,
            customCategory: form.category === "OTHER" ? form.customCategory : undefined,
            estimated,
            actual,
            note: form.note || null,
          }),
        });
        if (!res.ok) throw new Error("新增失敗");
        toast.success("預算項目已新增");
      }
      setDialogOpen(false);
      fetchBudget(selectedEventId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setSaving(false);
    }
  }

  // Delete
  async function handleDelete() {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/budget/${deleteItem.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("刪除失敗");
      toast.success("預算項目已刪除");
      setDeleteItem(null);
      fetchBudget(selectedEventId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "刪除失敗");
    } finally {
      setDeleting(false);
    }
  }

  // Format currency
  const fmt = (n: number) =>
    new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: "TWD",
      maximumFractionDigits: 0,
    }).format(n);

  if (!canRead) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-muted-foreground">無權限存取此頁面</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">預算管理</h1>
        <p className="text-sm text-muted-foreground">管理各活動的預算編列與實際支出</p>
      </div>

      {/* Event Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-5" />
            選擇活動
          </CardTitle>
          <CardDescription>選擇一個活動以檢視或編輯其預算</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="選擇活動..." />
            </SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Budget Table */}
      {selectedEventId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>預算項目</CardTitle>
              <CardDescription>預估金額與實際支出對比</CardDescription>
            </div>
            {canWrite && (
              <Button size="sm" onClick={handleAdd}>
                <Plus className="size-4 mr-1" />
                新增項目
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-center py-8">載入中...</p>
            ) : items.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                尚無預算項目，請點擊「新增項目」開始編列預算
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>類別</TableHead>
                      <TableHead>備註</TableHead>
                      <TableHead className="text-right">預估金額</TableHead>
                      <TableHead className="text-right">實際金額</TableHead>
                      {canWrite && <TableHead className="text-right">操作</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {categoryLabel(item.category, item.customCategory)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{item.note || "—"}</TableCell>
                        <TableCell className="text-right">{fmt(item.estimated)}</TableCell>
                        <TableCell className="text-right">{fmt(item.actual)}</TableCell>
                        {canWrite && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteItem(item)}
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                  {summary && (
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={2} className="font-semibold">
                          合計
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {fmt(summary.totalEstimated)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {fmt(summary.totalActual)}
                        </TableCell>
                        {canWrite && <TableCell />}
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={2} className="text-muted-foreground">
                          差額 / 執行率
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {fmt(summary.difference)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {(summary.executionRate * 100).toFixed(1)}%
                        </TableCell>
                        {canWrite && <TableCell />}
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "編輯預算項目" : "新增預算項目"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "修改預算項目的資訊" : "為此活動新增一筆預算項目"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>類別</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.category === "OTHER" && (
              <div className="space-y-2">
                <Label>自訂類別名稱</Label>
                <Input
                  value={form.customCategory}
                  onChange={(e) => setForm((f) => ({ ...f, customCategory: e.target.value }))}
                  placeholder="輸入自訂類別..."
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>預估金額 (TWD)</Label>
                <Input
                  type="number"
                  value={form.estimated}
                  onChange={(e) => setForm((f) => ({ ...f, estimated: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>實際金額 (TWD)</Label>
                <Input
                  type="number"
                  value={form.actual}
                  onChange={(e) => setForm((f) => ({ ...f, actual: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>備註</Label>
              <Input
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="選填..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除「
              {deleteItem && categoryLabel(deleteItem.category, deleteItem.customCategory)}」
              這筆預算項目嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? "刪除中..." : "確認刪除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors. If Dialog/AlertDialog components are missing, install them:

```bash
npx shadcn@latest add dialog alert-dialog label
```

**Step 3: Commit**

```bash
git add src/app/admin/budget/
git commit -m "feat: add budget admin page with CRUD and summary"
```

---

### Task 5: Add budget to admin navigation

**Files:**

- Modify: `src/app/admin/layout.tsx`

**Step 1: Add Wallet import and budget nav item**

In `src/app/admin/layout.tsx`:

1. Add `Wallet` to the lucide-react imports (line 8-16 area).

2. Add the budget nav item to the `navItems` array, after assignments and before users:

```typescript
{ href: "/admin/budget", label: "預算管理", icon: Wallet, module: "budget" },
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/admin/layout.tsx
git commit -m "feat: add budget to admin navigation sidebar"
```

---

### Task 6: Verify everything works

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (86 total).

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Final commit if any fixes were needed**

If any fixes were applied, commit them.

---

## Verification Checklist

1. `npx vitest run` — all tests pass
2. `npx tsc --noEmit` — no type errors
3. Budget items CRUD works through API
4. Admin page shows event selector, budget table, summary
5. Permission gates work (budget:read for viewing, budget:write for editing)
6. Budget nav item appears for permitted roles only
