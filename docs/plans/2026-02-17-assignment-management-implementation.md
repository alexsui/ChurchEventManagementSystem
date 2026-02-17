# Assignment Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add assignment management (作業管理) — admin creates assignments per session, marks member completion via checkbox, completion rate counts toward certificates.

**Architecture:** Two new Prisma models (`Assignment`, `AssignmentCompletion`) following existing patterns. Service layer (`assignment.service.ts`) with mocked-prisma unit tests. API routes with auth+permission guards. Admin UI page mirroring the attendance page pattern (event→session selector, member checklist).

**Tech Stack:** Prisma, Next.js API Routes, React (shadcn/ui), vitest with mocked Prisma

---

### Task 1: Prisma Schema — Add Assignment and AssignmentCompletion models

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add models and relations to schema**

Add to the end of `prisma/schema.prisma`, before the closing (after `RolePermission`):

```prisma
model Assignment {
  id             String   @id @default(cuid())
  eventSessionId String
  title          String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  eventSession EventSession          @relation(fields: [eventSessionId], references: [id], onDelete: Cascade)
  completions  AssignmentCompletion[]
}

model AssignmentCompletion {
  id            String   @id @default(cuid())
  assignmentId  String
  userId        String
  completedAt   DateTime @default(now())
  completedById String

  assignment  Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  user        User       @relation("assignmentCompletions", fields: [userId], references: [id], onDelete: Cascade)
  completedBy User       @relation("assignmentCompletedBy", fields: [completedById], references: [id], onDelete: Cascade)

  @@unique([assignmentId, userId])
}
```

Add relation fields to existing models:

In `User` model, add after `attendances Attendance[]`:
```prisma
  assignmentCompletions AssignmentCompletion[] @relation("assignmentCompletions")
  assignmentCompletedBy AssignmentCompletion[] @relation("assignmentCompletedBy")
```

In `EventSession` model, add after `attendances Attendance[]`:
```prisma
  assignments Assignment[]
```

In `Event` model, add after `updatedAt`:
```prisma
  minAssignmentRate Float?
```

**Step 2: Generate migration and Prisma client**

Run: `npx prisma migrate dev --name add-assignment-models`
Expected: Migration created successfully, client generated

**Step 3: Commit**

```bash
git add prisma/
git commit -m "feat: add Assignment and AssignmentCompletion models to schema"
```

---

### Task 2: Assignment Service — Tests

**Files:**
- Create: `src/services/assignment.service.test.ts`

**Step 1: Write the test file**

Follow the same mock pattern as `src/services/attendance.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  assignment: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  assignmentCompletion: {
    createMany: vi.fn(),
    findMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  eventSession: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import {
  createAssignment,
  deleteAssignment,
  getAssignmentsBySession,
  getAssignmentsByEvent,
  markComplete,
  removeCompletion,
  getCompletionRate,
  AssignmentServiceError,
} from "./assignment.service";

describe("assignment.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createAssignment", () => {
    it("should create an assignment for a valid session", async () => {
      mockPrisma.eventSession.findUnique.mockResolvedValue({ id: "session-1", eventId: "event-1" });
      const assignment = { id: "a-1", eventSessionId: "session-1", title: "讀經篇章" };
      mockPrisma.assignment.create.mockResolvedValue(assignment);

      const result = await createAssignment("session-1", "讀經篇章");

      expect(result).toEqual(assignment);
      expect(mockPrisma.assignment.create).toHaveBeenCalledWith({
        data: { eventSessionId: "session-1", title: "讀經篇章" },
      });
    });

    it("should throw when session not found", async () => {
      mockPrisma.eventSession.findUnique.mockResolvedValue(null);

      await expect(createAssignment("bad-id", "test")).rejects.toThrow("Event session not found");
    });
  });

  describe("deleteAssignment", () => {
    it("should delete an existing assignment", async () => {
      mockPrisma.assignment.findUnique.mockResolvedValue({ id: "a-1" });
      mockPrisma.assignment.delete.mockResolvedValue({ id: "a-1" });

      await deleteAssignment("a-1");

      expect(mockPrisma.assignment.delete).toHaveBeenCalledWith({
        where: { id: "a-1" },
      });
    });

    it("should throw when assignment not found", async () => {
      mockPrisma.assignment.findUnique.mockResolvedValue(null);

      await expect(deleteAssignment("bad-id")).rejects.toThrow("Assignment not found");
    });
  });

  describe("getAssignmentsBySession", () => {
    it("should return assignments with completion counts", async () => {
      const assignments = [
        { id: "a-1", title: "讀經", _count: { completions: 3 } },
        { id: "a-2", title: "心得", _count: { completions: 1 } },
      ];
      mockPrisma.assignment.findMany.mockResolvedValue(assignments);

      const result = await getAssignmentsBySession("session-1");

      expect(result).toEqual(assignments);
      expect(mockPrisma.assignment.findMany).toHaveBeenCalledWith({
        where: { eventSessionId: "session-1" },
        include: { _count: { select: { completions: true } } },
        orderBy: { createdAt: "asc" },
      });
    });
  });

  describe("getAssignmentsByEvent", () => {
    it("should return all assignments across sessions for an event", async () => {
      const sessions = [{ id: "s-1" }, { id: "s-2" }];
      mockPrisma.eventSession.findMany.mockResolvedValue(sessions);
      const assignments = [
        { id: "a-1", eventSessionId: "s-1", title: "讀經" },
      ];
      mockPrisma.assignment.findMany.mockResolvedValue(assignments);

      const result = await getAssignmentsByEvent("event-1");

      expect(result).toEqual(assignments);
      expect(mockPrisma.eventSession.findMany).toHaveBeenCalledWith({
        where: { eventId: "event-1" },
        select: { id: true },
      });
      expect(mockPrisma.assignment.findMany).toHaveBeenCalledWith({
        where: { eventSessionId: { in: ["s-1", "s-2"] } },
        include: {
          _count: { select: { completions: true } },
          eventSession: { select: { sessionNo: true, topic: true } },
        },
        orderBy: { eventSession: { sessionNo: "asc" } },
      });
    });
  });

  describe("markComplete", () => {
    it("should create completion records for given user IDs", async () => {
      mockPrisma.assignment.findUnique.mockResolvedValue({ id: "a-1" });
      mockPrisma.assignmentCompletion.findMany.mockResolvedValue([]);
      mockPrisma.assignmentCompletion.createMany.mockResolvedValue({ count: 2 });

      const result = await markComplete("a-1", ["user-1", "user-2"], "admin-1");

      expect(result).toEqual({ created: 2, skipped: 0 });
      expect(mockPrisma.assignmentCompletion.createMany).toHaveBeenCalledWith({
        data: [
          { assignmentId: "a-1", userId: "user-1", completedById: "admin-1" },
          { assignmentId: "a-1", userId: "user-2", completedById: "admin-1" },
        ],
        skipDuplicates: true,
      });
    });

    it("should skip already-completed users", async () => {
      mockPrisma.assignment.findUnique.mockResolvedValue({ id: "a-1" });
      mockPrisma.assignmentCompletion.findMany.mockResolvedValue([{ userId: "user-1" }]);
      mockPrisma.assignmentCompletion.createMany.mockResolvedValue({ count: 1 });

      const result = await markComplete("a-1", ["user-1", "user-2"], "admin-1");

      expect(result).toEqual({ created: 1, skipped: 1 });
    });

    it("should throw when assignment not found", async () => {
      mockPrisma.assignment.findUnique.mockResolvedValue(null);

      await expect(markComplete("bad-id", ["user-1"], "admin-1")).rejects.toThrow(
        "Assignment not found"
      );
    });
  });

  describe("removeCompletion", () => {
    it("should delete a completion record", async () => {
      mockPrisma.assignmentCompletion.deleteMany.mockResolvedValue({ count: 1 });

      await removeCompletion("a-1", "user-1");

      expect(mockPrisma.assignmentCompletion.deleteMany).toHaveBeenCalledWith({
        where: { assignmentId: "a-1", userId: "user-1" },
      });
    });
  });

  describe("getCompletionRate", () => {
    it("should return correct completion rate", async () => {
      mockPrisma.eventSession.findMany.mockResolvedValue([{ id: "s-1" }, { id: "s-2" }]);
      // 3 total assignments across all sessions
      mockPrisma.assignment.findMany.mockResolvedValue([
        { id: "a-1" },
        { id: "a-2" },
        { id: "a-3" },
      ]);
      // user completed 2 of 3
      mockPrisma.assignmentCompletion.findMany.mockResolvedValue([
        { assignmentId: "a-1" },
        { assignmentId: "a-3" },
      ]);

      const result = await getCompletionRate("user-1", "event-1");

      expect(result).toEqual({ completed: 2, total: 3, rate: 2 / 3 });
    });

    it("should return rate 1 when no assignments exist", async () => {
      mockPrisma.eventSession.findMany.mockResolvedValue([{ id: "s-1" }]);
      mockPrisma.assignment.findMany.mockResolvedValue([]);
      mockPrisma.assignmentCompletion.findMany.mockResolvedValue([]);

      const result = await getCompletionRate("user-1", "event-1");

      expect(result).toEqual({ completed: 0, total: 0, rate: 1 });
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/assignment.service.test.ts`
Expected: FAIL — module `./assignment.service` not found

**Step 3: Commit**

```bash
git add src/services/assignment.service.test.ts
git commit -m "test: add assignment service tests (red phase)"
```

---

### Task 3: Assignment Service — Implementation

**Files:**
- Create: `src/services/assignment.service.ts`

**Step 1: Write the service implementation**

```typescript
import { prisma } from "@/lib/prisma";

export class AssignmentServiceError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "AssignmentServiceError";
  }
}

/**
 * Create an assignment for an event session.
 */
export async function createAssignment(eventSessionId: string, title: string) {
  const session = await prisma.eventSession.findUnique({
    where: { id: eventSessionId },
  });

  if (!session) {
    throw new AssignmentServiceError(
      "Event session not found",
      "SESSION_NOT_FOUND"
    );
  }

  return prisma.assignment.create({
    data: { eventSessionId, title },
  });
}

/**
 * Delete an assignment. Completions cascade-delete via schema.
 */
export async function deleteAssignment(id: string) {
  const assignment = await prisma.assignment.findUnique({
    where: { id },
  });

  if (!assignment) {
    throw new AssignmentServiceError(
      "Assignment not found",
      "ASSIGNMENT_NOT_FOUND"
    );
  }

  return prisma.assignment.delete({ where: { id } });
}

/**
 * Get all assignments for a session with completion counts.
 */
export async function getAssignmentsBySession(eventSessionId: string) {
  return prisma.assignment.findMany({
    where: { eventSessionId },
    include: { _count: { select: { completions: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Get all assignments across all sessions of an event.
 */
export async function getAssignmentsByEvent(eventId: string) {
  const sessions = await prisma.eventSession.findMany({
    where: { eventId },
    select: { id: true },
  });

  const sessionIds = sessions.map((s) => s.id);

  return prisma.assignment.findMany({
    where: { eventSessionId: { in: sessionIds } },
    include: {
      _count: { select: { completions: true } },
      eventSession: { select: { sessionNo: true, topic: true } },
    },
    orderBy: { eventSession: { sessionNo: "asc" } },
  });
}

/**
 * Bulk mark assignments as complete for given users.
 * Skips users who already have a completion record.
 */
export async function markComplete(
  assignmentId: string,
  userIds: string[],
  completedById: string
) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
  });

  if (!assignment) {
    throw new AssignmentServiceError(
      "Assignment not found",
      "ASSIGNMENT_NOT_FOUND"
    );
  }

  // Find existing completions to skip
  const existing = await prisma.assignmentCompletion.findMany({
    where: { assignmentId, userId: { in: userIds } },
    select: { userId: true },
  });

  const existingUserIds = new Set(existing.map((c) => c.userId));
  const newUserIds = userIds.filter((id) => !existingUserIds.has(id));

  if (newUserIds.length === 0) {
    return { created: 0, skipped: userIds.length };
  }

  const result = await prisma.assignmentCompletion.createMany({
    data: newUserIds.map((userId) => ({
      assignmentId,
      userId,
      completedById,
    })),
    skipDuplicates: true,
  });

  return { created: result.count, skipped: userIds.length - newUserIds.length };
}

/**
 * Remove a completion record for a user on an assignment.
 */
export async function removeCompletion(assignmentId: string, userId: string) {
  return prisma.assignmentCompletion.deleteMany({
    where: { assignmentId, userId },
  });
}

/**
 * Calculate assignment completion rate for a user in an event.
 * Returns rate = 1 if the event has no assignments (does not block certificates).
 */
export async function getCompletionRate(userId: string, eventId: string) {
  const sessions = await prisma.eventSession.findMany({
    where: { eventId },
    select: { id: true },
  });

  const sessionIds = sessions.map((s) => s.id);

  const assignments = await prisma.assignment.findMany({
    where: { eventSessionId: { in: sessionIds } },
    select: { id: true },
  });

  const total = assignments.length;

  if (total === 0) {
    return { completed: 0, total: 0, rate: 1 };
  }

  const assignmentIds = assignments.map((a) => a.id);

  const completions = await prisma.assignmentCompletion.findMany({
    where: { assignmentId: { in: assignmentIds }, userId },
    select: { assignmentId: true },
  });

  const completed = completions.length;

  return { completed, total, rate: completed / total };
}
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run src/services/assignment.service.test.ts`
Expected: All 9 tests PASS

**Step 3: Commit**

```bash
git add src/services/assignment.service.ts
git commit -m "feat: add assignment service with CRUD and completion tracking"
```

---

### Task 4: API Routes — Assignments CRUD

**Files:**
- Create: `src/app/api/assignments/route.ts`
- Create: `src/app/api/assignments/[id]/route.ts`
- Create: `src/app/api/assignments/[id]/completions/route.ts`
- Create: `src/app/api/assignments/[id]/completions/[userId]/route.ts`

**Step 1: Create `src/app/api/assignments/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import {
  createAssignment,
  getAssignmentsBySession,
  AssignmentServiceError,
} from "@/services/assignment.service";

/**
 * GET /api/assignments?eventSessionId=xxx
 * List assignments for a session.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasPermission(session.user.role, "assignments", "read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const eventSessionId = request.nextUrl.searchParams.get("eventSessionId");
  if (!eventSessionId) {
    return NextResponse.json(
      { error: "eventSessionId is required" },
      { status: 400 }
    );
  }

  const assignments = await getAssignmentsBySession(eventSessionId);
  return NextResponse.json(assignments);
}

/**
 * POST /api/assignments
 * Create an assignment. Body: { eventSessionId, title }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasPermission(session.user.role, "assignments", "write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { eventSessionId?: string; title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { eventSessionId, title } = body;

  if (!eventSessionId || !title?.trim()) {
    return NextResponse.json(
      { error: "eventSessionId and title are required" },
      { status: 400 }
    );
  }

  try {
    const assignment = await createAssignment(eventSessionId, title.trim());
    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    if (error instanceof AssignmentServiceError) {
      const statusMap: Record<string, number> = {
        SESSION_NOT_FOUND: 404,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] || 400 }
      );
    }
    throw error;
  }
}
```

**Step 2: Create `src/app/api/assignments/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import {
  deleteAssignment,
  AssignmentServiceError,
} from "@/services/assignment.service";

/**
 * DELETE /api/assignments/[id]
 * Delete an assignment.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasPermission(session.user.role, "assignments", "write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await deleteAssignment(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AssignmentServiceError) {
      const statusMap: Record<string, number> = {
        ASSIGNMENT_NOT_FOUND: 404,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] || 400 }
      );
    }
    throw error;
  }
}
```

**Step 3: Create `src/app/api/assignments/[id]/completions/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import {
  markComplete,
  AssignmentServiceError,
} from "@/services/assignment.service";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/assignments/[id]/completions
 * List all completions for an assignment (who completed it).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasPermission(session.user.role, "assignments", "read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const completions = await prisma.assignmentCompletion.findMany({
    where: { assignmentId: id },
    include: {
      user: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { completedAt: "asc" },
  });

  return NextResponse.json(completions);
}

/**
 * POST /api/assignments/[id]/completions
 * Bulk mark users as complete. Body: { userIds: string[] }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasPermission(session.user.role, "assignments", "write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: { userIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userIds } = body;
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json(
      { error: "userIds must be a non-empty array" },
      { status: 400 }
    );
  }

  try {
    const result = await markComplete(id, userIds, session.user.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AssignmentServiceError) {
      const statusMap: Record<string, number> = {
        ASSIGNMENT_NOT_FOUND: 404,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] || 400 }
      );
    }
    throw error;
  }
}
```

**Step 4: Create `src/app/api/assignments/[id]/completions/[userId]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { removeCompletion } from "@/services/assignment.service";

/**
 * DELETE /api/assignments/[id]/completions/[userId]
 * Remove completion for a specific user.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasPermission(session.user.role, "assignments", "write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, userId } = await params;

  await removeCompletion(id, userId);
  return NextResponse.json({ success: true });
}
```

**Step 5: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/app/api/assignments/
git commit -m "feat: add assignment API routes with auth and permission guards"
```

---

### Task 5: Admin Layout — Add assignments nav item

**Files:**
- Modify: `src/app/admin/layout.tsx`

**Step 1: Add BookCheck import and nav item**

In `src/app/admin/layout.tsx`, add `BookCheck` to the lucide-react import:

```typescript
import {
  CalendarDays,
  ClipboardList,
  UserCheck,
  Users,
  Menu,
  LogOut,
  BookCheck,
} from "lucide-react";
```

Add to `navItems` array, after attendance and before users:

```typescript
{ href: "/admin/assignments", label: "作業管理", icon: BookCheck, module: "assignments" },
```

**Step 2: Commit**

```bash
git add src/app/admin/layout.tsx
git commit -m "feat: add assignments nav item to admin layout"
```

---

### Task 6: Admin Assignments Page

**Files:**
- Create: `src/app/admin/assignments/page.tsx`

**Step 1: Create the page**

Build the page following the attendance page pattern (`src/app/admin/attendance/page.tsx`):

1. **Event selector** → **Session selector** (reuse same pattern)
2. **Assignment list** for selected session — shows title + completion count; "新增作業" button (if canWrite)
3. **Add assignment** — dialog/inline input with title field
4. **Delete assignment** — trash icon per assignment (if canWrite)
5. **Click an assignment** → shows **member checklist** (registered members with checkboxes)
6. **Bulk mark complete** button (like bulk check-in)
7. **Unmark completion** — clicking a checked member's checkbox removes their completion

Key UI elements to use (all from shadcn/ui, already in the project):
- `Select` for event/session pickers
- `Card` for layout sections
- `Table` with `Checkbox` for member checklist
- `Badge` for completion status
- `Button` for actions
- `Input` for assignment title
- `Dialog` for add assignment form
- `useAdminPermissions("assignments")` for read/write checks
- `toast` from sonner for feedback

The page should have two views:
- **Assignment list view**: shows after selecting event + session. Lists assignments with completion stats.
- **Completion detail view**: shows after clicking an assignment. Shows member checklist with checkboxes.

Use a `selectedAssignmentId` state to toggle between views. A "← 返回" button goes back to list view.

**Step 2: Verify the page renders**

Run: `npx next build` (or `npm run dev` and navigate to `/admin/assignments`)
Expected: Page renders without errors

**Step 3: Commit**

```bash
git add src/app/admin/assignments/
git commit -m "feat: add admin assignments page with CRUD and completion tracking"
```

---

### Task 7: Event Form — Add minAssignmentRate field

**Files:**
- Modify: `src/components/shared/event-form.tsx`
- Modify: `src/app/api/events/route.ts` (POST handler)
- Modify: `src/app/api/events/[eventId]/route.ts` (PUT handler)
- Modify: `src/services/event.service.ts` (createEvent, updateEvent)

**Step 1: Add minAssignmentRate to the event form schema**

In `src/components/shared/event-form.tsx`, add to `eventFormSchema`:

```typescript
minAssignmentRate: z.number().min(0).max(100).optional(),
```

Add a form field after `maxParticipants`:

```tsx
<FormField
  control={form.control}
  name="minAssignmentRate"
  render={({ field }) => (
    <FormItem>
      <FormLabel>作業完成率門檻 (%)</FormLabel>
      <FormControl>
        <Input
          type="number"
          min={0}
          max={100}
          placeholder="例：80（表示需完成 80% 作業）"
          value={field.value ?? ""}
          onChange={(e) =>
            field.onChange(
              e.target.value === "" ? undefined : Number(e.target.value)
            )
          }
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Step 2: Update event service to handle minAssignmentRate**

In `src/services/event.service.ts`, add `minAssignmentRate` to the create and update data types. The field is stored as 0-1 float in DB but displayed as 0-100 percentage in UI. Convert in the API route: `minAssignmentRate: body.minAssignmentRate ? body.minAssignmentRate / 100 : undefined`.

**Step 3: Update API routes to pass the field through**

Add `minAssignmentRate` to the POST and PUT handlers in the events API routes, converting from percentage (0-100) to decimal (0-1) before saving.

**Step 4: Run tests and type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: All tests pass, no type errors

**Step 5: Commit**

```bash
git add src/components/shared/event-form.tsx src/services/event.service.ts src/app/api/events/
git commit -m "feat: add minAssignmentRate field to event form and API"
```

---

### Task 8: Run All Tests and Final Verification

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (existing 71 + new assignment service tests)

**Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Build check**

Run: `npx next build`
Expected: Build succeeds

**Step 4: Manual smoke test**

Run: `npm run dev`

Verify:
1. Navigate to `/admin/assignments` — page loads with event/session selectors
2. Select an event and session — empty assignment list shows
3. Create an assignment — appears in the list
4. Click assignment — shows member checklist
5. Check members and bulk mark complete — success toast
6. Navigation sidebar shows "作業管理" for users with assignments:read permission

---

## Summary

| Task | Description | Files | Tests |
| :--- | :---------- | :---- | :---- |
| 1 | Prisma schema + migration | `prisma/schema.prisma` | — |
| 2 | Assignment service tests (red) | `src/services/assignment.service.test.ts` | 9 tests |
| 3 | Assignment service implementation (green) | `src/services/assignment.service.ts` | 9 tests pass |
| 4 | API routes | `src/app/api/assignments/**` (4 files) | — |
| 5 | Admin nav item | `src/app/admin/layout.tsx` | — |
| 6 | Admin assignments page | `src/app/admin/assignments/page.tsx` | — |
| 7 | Event form + minAssignmentRate | `event-form.tsx`, `event.service.ts`, API routes | — |
| 8 | Final verification | — | All pass |
