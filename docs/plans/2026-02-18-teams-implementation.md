# Teams & Task Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement per-event staff grouping (組別) with member management, simple task tracking, SOP link storage, and global team name templates.

**Architecture:** Repurpose existing `Team` model as a global name template. Add `EventTeam`, `EventTeamMember`, and `EventTeamTask` models for per-event team instances. Remove `User.teamId` FK. Service layer in `team.service.ts`, API routes nested under `/api/teams` (templates) and `/api/events/[eventId]/teams` (event-scoped). Admin UI: template management page + event detail teams tab.

**Tech Stack:** Next.js App Router, Prisma ORM, TypeScript, shadcn/ui, Tailwind CSS, Vitest for unit tests.

---

## Task 1: Schema Migration — Remove User.teamId, Add EventTeam Models

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Update the Prisma schema**

In `prisma/schema.prisma`, make these changes:

1. **Remove from `User` model** (lines 100, 108):
   - Remove `teamId String?`
   - Remove `team Team? @relation(fields: [teamId], references: [id])`
   - Add `eventTeamMembers EventTeamMember[]`
   - Add `assignedTasks EventTeamTask[]`

2. **Update `Team` model** (lines 115-122):
   Replace `users User[]` with `eventTeams EventTeam[]`

3. **Add to `Event` model** (after line 139):
   Add `eventTeams EventTeam[]`

4. **Add new models** (after the `Team` model):

```prisma
model EventTeam {
  id         String   @id @default(cuid())
  eventId    String
  teamId     String?
  customName String?
  sopLinks   String[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  event   Event  @relation(fields: [eventId], references: [id], onDelete: Cascade)
  team    Team?  @relation(fields: [teamId], references: [id])
  members EventTeamMember[]
  tasks   EventTeamTask[]

  @@unique([eventId, teamId])
}

model EventTeamMember {
  id          String   @id @default(cuid())
  eventTeamId String
  userId      String
  role        String?
  createdAt   DateTime @default(now())

  eventTeam EventTeam @relation(fields: [eventTeamId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([eventTeamId, userId])
}

model EventTeamTask {
  id          String   @id @default(cuid())
  eventTeamId String
  title       String
  assigneeId  String?
  status      String   @default("PENDING")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  eventTeam EventTeam @relation(fields: [eventTeamId], references: [id], onDelete: Cascade)
  assignee  User?     @relation(fields: [assigneeId], references: [id])
}
```

**Step 2: Run the migration**

```bash
npx prisma migrate dev --name add-event-teams
```

Expected: Migration created and applied. Prisma client regenerated.

**Step 3: Fix references to User.teamId in existing code**

Update `src/services/user.service.ts`:
- In `getUsers()`: remove `teamId: true` from select, remove `team: { select: ... }`
- In `getUserById()`: remove `teamId: true` from select, remove `team: { select: ... }`
- In `updateUserRole()`: remove `teamId` parameter and logic, remove `team` from select

Update `src/app/api/users/[userId]/route.ts`:
- Remove `teamId` from the PATCH handler body parsing (line 92)

Update `src/app/admin/users/page.tsx`:
- Remove any UI references to `user.team` or `user.teamId` (team dropdown in edit dialog, team column in table)

**Step 4: Run existing tests to verify no regressions**

```bash
npx vitest run
```

Expected: All existing tests pass.

**Step 5: Commit**

```bash
git add prisma/ src/services/user.service.ts src/app/api/users/ src/app/admin/users/
git commit -m "feat: add EventTeam schema, remove User.teamId"
```

---

## Task 2: Team Template Service — CRUD

**Files:**
- Create: `src/services/team.service.ts`
- Create: `src/services/team.service.test.ts`

**Step 1: Write the failing tests**

Create `src/services/team.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  team: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  eventTeam: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  eventTeamMember: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  eventTeamTask: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import {
  getTeamTemplates,
  createTeamTemplate,
  updateTeamTemplate,
  deleteTeamTemplate,
  TeamServiceError,
} from "./team.service";

describe("team.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTeamTemplates", () => {
    it("should return all team templates ordered by name", async () => {
      const templates = [
        { id: "t1", name: "影音組", createdAt: new Date(), updatedAt: new Date() },
        { id: "t2", name: "敬拜組", createdAt: new Date(), updatedAt: new Date() },
      ];
      mockPrisma.team.findMany.mockResolvedValue(templates);

      const result = await getTeamTemplates();

      expect(result).toEqual(templates);
      expect(mockPrisma.team.findMany).toHaveBeenCalledWith({
        orderBy: { name: "asc" },
      });
    });
  });

  describe("createTeamTemplate", () => {
    it("should create a team template", async () => {
      const created = { id: "t1", name: "影音組", createdAt: new Date(), updatedAt: new Date() };
      mockPrisma.team.create.mockResolvedValue(created);

      const result = await createTeamTemplate("影音組");

      expect(result).toEqual(created);
      expect(mockPrisma.team.create).toHaveBeenCalledWith({
        data: { name: "影音組" },
      });
    });
  });

  describe("updateTeamTemplate", () => {
    it("should update a team template name", async () => {
      const updated = { id: "t1", name: "新影音組", createdAt: new Date(), updatedAt: new Date() };
      mockPrisma.team.findUnique.mockResolvedValue({ id: "t1" });
      mockPrisma.team.update.mockResolvedValue(updated);

      const result = await updateTeamTemplate("t1", "新影音組");

      expect(result).toEqual(updated);
    });

    it("should throw when template not found", async () => {
      mockPrisma.team.findUnique.mockResolvedValue(null);

      await expect(updateTeamTemplate("t1", "新名")).rejects.toThrow(TeamServiceError);
      await expect(updateTeamTemplate("t1", "新名")).rejects.toMatchObject({
        code: "TEMPLATE_NOT_FOUND",
      });
    });
  });

  describe("deleteTeamTemplate", () => {
    it("should delete a team template", async () => {
      mockPrisma.team.findUnique.mockResolvedValue({ id: "t1" });
      mockPrisma.team.delete.mockResolvedValue({ id: "t1" });

      await deleteTeamTemplate("t1");

      expect(mockPrisma.team.delete).toHaveBeenCalledWith({ where: { id: "t1" } });
    });

    it("should throw when template not found", async () => {
      mockPrisma.team.findUnique.mockResolvedValue(null);

      await expect(deleteTeamTemplate("t1")).rejects.toThrow(TeamServiceError);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/services/team.service.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement the service**

Create `src/services/team.service.ts`:

```typescript
import { prisma } from "@/lib/prisma";

export class TeamServiceError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "TeamServiceError";
  }
}

// ==================== Team Templates ====================

export async function getTeamTemplates() {
  return prisma.team.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createTeamTemplate(name: string) {
  return prisma.team.create({
    data: { name },
  });
}

export async function updateTeamTemplate(id: string, name: string) {
  const existing = await prisma.team.findUnique({ where: { id } });
  if (!existing) {
    throw new TeamServiceError("Team template not found", "TEMPLATE_NOT_FOUND");
  }

  return prisma.team.update({
    where: { id },
    data: { name },
  });
}

export async function deleteTeamTemplate(id: string) {
  const existing = await prisma.team.findUnique({ where: { id } });
  if (!existing) {
    throw new TeamServiceError("Team template not found", "TEMPLATE_NOT_FOUND");
  }

  return prisma.team.delete({ where: { id } });
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/services/team.service.test.ts
```

Expected: All 5 tests pass.

**Step 5: Commit**

```bash
git add src/services/team.service.ts src/services/team.service.test.ts
git commit -m "feat: add team template CRUD service with tests"
```

---

## Task 3: Event Team Service — CRUD, Members, Tasks

**Files:**
- Modify: `src/services/team.service.ts`
- Modify: `src/services/team.service.test.ts`

**Step 1: Add failing tests for event team operations**

Append to `src/services/team.service.test.ts`:

```typescript
import {
  // ... existing imports plus:
  getEventTeams,
  createEventTeam,
  updateEventTeam,
  deleteEventTeam,
  addEventTeamMember,
  removeEventTeamMember,
  createEventTeamTask,
  updateEventTeamTask,
  deleteEventTeamTask,
} from "./team.service";

// Add these describe blocks after the existing ones:

describe("getEventTeams", () => {
  it("should return event teams with members and tasks", async () => {
    const teams = [
      {
        id: "et1",
        eventId: "e1",
        teamId: "t1",
        customName: null,
        sopLinks: [],
        team: { id: "t1", name: "影音組" },
        members: [],
        tasks: [],
      },
    ];
    mockPrisma.eventTeam.findMany.mockResolvedValue(teams);

    const result = await getEventTeams("e1");

    expect(result).toEqual(teams);
    expect(mockPrisma.eventTeam.findMany).toHaveBeenCalledWith({
      where: { eventId: "e1" },
      include: {
        team: true,
        members: {
          include: { user: { select: { id: true, name: true, phone: true, image: true } } },
          orderBy: { createdAt: "asc" },
        },
        tasks: {
          include: { assignee: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  });
});

describe("createEventTeam", () => {
  it("should create an event team from template", async () => {
    const created = { id: "et1", eventId: "e1", teamId: "t1", customName: null };
    mockPrisma.eventTeam.create.mockResolvedValue(created);

    const result = await createEventTeam("e1", { teamId: "t1" });

    expect(result).toEqual(created);
  });

  it("should create an event team with custom name", async () => {
    const created = { id: "et2", eventId: "e1", teamId: null, customName: "特別組" };
    mockPrisma.eventTeam.create.mockResolvedValue(created);

    const result = await createEventTeam("e1", { customName: "特別組" });

    expect(result).toEqual(created);
  });

  it("should throw when neither teamId nor customName provided", async () => {
    await expect(createEventTeam("e1", {})).rejects.toThrow(TeamServiceError);
    await expect(createEventTeam("e1", {})).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });
});

describe("deleteEventTeam", () => {
  it("should delete an event team", async () => {
    mockPrisma.eventTeam.findUnique.mockResolvedValue({ id: "et1" });
    mockPrisma.eventTeam.delete.mockResolvedValue({ id: "et1" });

    await deleteEventTeam("et1");

    expect(mockPrisma.eventTeam.delete).toHaveBeenCalledWith({ where: { id: "et1" } });
  });

  it("should throw when event team not found", async () => {
    mockPrisma.eventTeam.findUnique.mockResolvedValue(null);

    await expect(deleteEventTeam("not-found")).rejects.toThrow(TeamServiceError);
  });
});

describe("addEventTeamMember", () => {
  it("should add a member to an event team", async () => {
    const member = { id: "m1", eventTeamId: "et1", userId: "u1", role: "組員" };
    mockPrisma.eventTeamMember.create.mockResolvedValue(member);

    const result = await addEventTeamMember("et1", "u1", "組員");

    expect(result).toEqual(member);
  });
});

describe("removeEventTeamMember", () => {
  it("should remove a member from an event team", async () => {
    mockPrisma.eventTeamMember.deleteMany.mockResolvedValue({ count: 1 });

    await removeEventTeamMember("et1", "u1");

    expect(mockPrisma.eventTeamMember.deleteMany).toHaveBeenCalledWith({
      where: { eventTeamId: "et1", userId: "u1" },
    });
  });
});

describe("createEventTeamTask", () => {
  it("should create a task for an event team", async () => {
    const task = { id: "task1", eventTeamId: "et1", title: "準備投影機", assigneeId: null, status: "PENDING" };
    mockPrisma.eventTeamTask.create.mockResolvedValue(task);

    const result = await createEventTeamTask("et1", "準備投影機");

    expect(result).toEqual(task);
  });

  it("should create a task with assignee", async () => {
    const task = { id: "task1", eventTeamId: "et1", title: "準備投影機", assigneeId: "u1", status: "PENDING" };
    mockPrisma.eventTeamTask.create.mockResolvedValue(task);

    const result = await createEventTeamTask("et1", "準備投影機", "u1");

    expect(result).toEqual(task);
  });
});

describe("updateEventTeamTask", () => {
  it("should update task status", async () => {
    const updated = { id: "task1", status: "COMPLETED" };
    mockPrisma.eventTeamTask.findUnique.mockResolvedValue({ id: "task1" });
    mockPrisma.eventTeamTask.update.mockResolvedValue(updated);

    const result = await updateEventTeamTask("task1", { status: "COMPLETED" });

    expect(result).toEqual(updated);
  });

  it("should throw when task not found", async () => {
    mockPrisma.eventTeamTask.findUnique.mockResolvedValue(null);

    await expect(updateEventTeamTask("t1", { status: "COMPLETED" })).rejects.toThrow(TeamServiceError);
  });
});

describe("deleteEventTeamTask", () => {
  it("should delete a task", async () => {
    mockPrisma.eventTeamTask.findUnique.mockResolvedValue({ id: "task1" });
    mockPrisma.eventTeamTask.delete.mockResolvedValue({ id: "task1" });

    await deleteEventTeamTask("task1");

    expect(mockPrisma.eventTeamTask.delete).toHaveBeenCalledWith({ where: { id: "task1" } });
  });
});
```

**Step 2: Run test to verify failures**

```bash
npx vitest run src/services/team.service.test.ts
```

Expected: FAIL — new functions not exported yet.

**Step 3: Implement event team functions**

Append to `src/services/team.service.ts`:

```typescript
// ==================== Event Teams ====================

export async function getEventTeams(eventId: string) {
  return prisma.eventTeam.findMany({
    where: { eventId },
    include: {
      team: true,
      members: {
        include: { user: { select: { id: true, name: true, phone: true, image: true } } },
        orderBy: { createdAt: "asc" },
      },
      tasks: {
        include: { assignee: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createEventTeam(
  eventId: string,
  input: { teamId?: string; customName?: string }
) {
  if (!input.teamId && !input.customName) {
    throw new TeamServiceError(
      "Either teamId or customName is required",
      "INVALID_INPUT"
    );
  }

  return prisma.eventTeam.create({
    data: {
      eventId,
      teamId: input.teamId ?? null,
      customName: input.customName ?? null,
    },
  });
}

export async function updateEventTeam(
  id: string,
  data: { sopLinks?: string[]; customName?: string }
) {
  const existing = await prisma.eventTeam.findUnique({ where: { id } });
  if (!existing) {
    throw new TeamServiceError("Event team not found", "EVENT_TEAM_NOT_FOUND");
  }

  return prisma.eventTeam.update({
    where: { id },
    data,
  });
}

export async function deleteEventTeam(id: string) {
  const existing = await prisma.eventTeam.findUnique({ where: { id } });
  if (!existing) {
    throw new TeamServiceError("Event team not found", "EVENT_TEAM_NOT_FOUND");
  }

  return prisma.eventTeam.delete({ where: { id } });
}

// ==================== Event Team Members ====================

export async function addEventTeamMember(
  eventTeamId: string,
  userId: string,
  role?: string
) {
  return prisma.eventTeamMember.create({
    data: { eventTeamId, userId, role: role ?? null },
  });
}

export async function removeEventTeamMember(
  eventTeamId: string,
  userId: string
) {
  return prisma.eventTeamMember.deleteMany({
    where: { eventTeamId, userId },
  });
}

// ==================== Event Team Tasks ====================

export async function createEventTeamTask(
  eventTeamId: string,
  title: string,
  assigneeId?: string
) {
  return prisma.eventTeamTask.create({
    data: {
      eventTeamId,
      title,
      assigneeId: assigneeId ?? null,
    },
  });
}

export async function updateEventTeamTask(
  id: string,
  data: { title?: string; assigneeId?: string | null; status?: string }
) {
  const existing = await prisma.eventTeamTask.findUnique({ where: { id } });
  if (!existing) {
    throw new TeamServiceError("Task not found", "TASK_NOT_FOUND");
  }

  return prisma.eventTeamTask.update({
    where: { id },
    data,
  });
}

export async function deleteEventTeamTask(id: string) {
  const existing = await prisma.eventTeamTask.findUnique({ where: { id } });
  if (!existing) {
    throw new TeamServiceError("Task not found", "TASK_NOT_FOUND");
  }

  return prisma.eventTeamTask.delete({ where: { id } });
}
```

**Step 4: Run tests**

```bash
npx vitest run src/services/team.service.test.ts
```

Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/services/team.service.ts src/services/team.service.test.ts
git commit -m "feat: add event team, member, and task service functions with tests"
```

---

## Task 4: API Routes — Team Templates

**Files:**
- Create: `src/app/api/teams/route.ts`
- Create: `src/app/api/teams/[teamId]/route.ts`

**Step 1: Create template list + create route**

Create `src/app/api/teams/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import { getTeamTemplates, createTeamTemplate } from "@/services/team.service";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await hasPermission(session.user.role, "teams", "read"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const templates = await getTeamTemplates();
    return NextResponse.json(templates);
  } catch (error) {
    console.error("GET /api/teams error:", error);
    return NextResponse.json({ error: "Failed to fetch team templates" }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();
    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const template = await createTeamTemplate(body.name.trim());
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("POST /api/teams error:", error);
    const message = error instanceof Error ? error.message : "Failed to create team template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 2: Create template update + delete route**

Create `src/app/api/teams/[teamId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import {
  updateTeamTemplate,
  deleteTeamTemplate,
  TeamServiceError,
} from "@/services/team.service";

type RouteParams = { params: Promise<{ teamId: string }> };

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

    const { teamId } = await params;
    const body = await request.json();

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const template = await updateTeamTemplate(teamId, body.name.trim());
    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof TeamServiceError && error.code === "TEMPLATE_NOT_FOUND") {
      return NextResponse.json({ error: "Team template not found" }, { status: 404 });
    }
    console.error("PATCH /api/teams/[teamId] error:", error);
    return NextResponse.json({ error: "Failed to update team template" }, { status: 500 });
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

    const { teamId } = await params;
    await deleteTeamTemplate(teamId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TeamServiceError && error.code === "TEMPLATE_NOT_FOUND") {
      return NextResponse.json({ error: "Team template not found" }, { status: 404 });
    }
    console.error("DELETE /api/teams/[teamId] error:", error);
    return NextResponse.json({ error: "Failed to delete team template" }, { status: 500 });
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/teams/
git commit -m "feat: add team template API routes (GET/POST/PATCH/DELETE)"
```

---

## Task 5: API Routes — Event Teams, Members, Tasks

**Files:**
- Create: `src/app/api/events/[eventId]/teams/route.ts`
- Create: `src/app/api/events/[eventId]/teams/[eventTeamId]/route.ts`
- Create: `src/app/api/events/[eventId]/teams/[eventTeamId]/members/route.ts`
- Create: `src/app/api/events/[eventId]/teams/[eventTeamId]/members/[userId]/route.ts`
- Create: `src/app/api/events/[eventId]/teams/[eventTeamId]/tasks/route.ts`
- Create: `src/app/api/events/[eventId]/teams/[eventTeamId]/tasks/[taskId]/route.ts`

**Step 1: Event teams list + create**

Create `src/app/api/events/[eventId]/teams/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import { getEventTeams, createEventTeam, TeamServiceError } from "@/services/team.service";

type RouteParams = { params: Promise<{ eventId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await hasPermission(session.user.role, "teams", "read"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { eventId } = await params;
    const teams = await getEventTeams(eventId);
    return NextResponse.json(teams);
  } catch (error) {
    console.error("GET /api/events/[eventId]/teams error:", error);
    return NextResponse.json({ error: "Failed to fetch event teams" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
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

    const { eventId } = await params;
    const body = await request.json();

    const team = await createEventTeam(eventId, {
      teamId: body.teamId,
      customName: body.customName,
    });
    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    if (error instanceof TeamServiceError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/events/[eventId]/teams error:", error);
    return NextResponse.json({ error: "Failed to create event team" }, { status: 500 });
  }
}
```

**Step 2: Event team update + delete**

Create `src/app/api/events/[eventId]/teams/[eventTeamId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import { updateEventTeam, deleteEventTeam, TeamServiceError } from "@/services/team.service";

type RouteParams = { params: Promise<{ eventId: string; eventTeamId: string }> };

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

    const { eventTeamId } = await params;
    const body = await request.json();

    const team = await updateEventTeam(eventTeamId, {
      sopLinks: body.sopLinks,
      customName: body.customName,
    });
    return NextResponse.json(team);
  } catch (error) {
    if (error instanceof TeamServiceError && error.code === "EVENT_TEAM_NOT_FOUND") {
      return NextResponse.json({ error: "Event team not found" }, { status: 404 });
    }
    console.error("PATCH event team error:", error);
    return NextResponse.json({ error: "Failed to update event team" }, { status: 500 });
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

    const { eventTeamId } = await params;
    await deleteEventTeam(eventTeamId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TeamServiceError && error.code === "EVENT_TEAM_NOT_FOUND") {
      return NextResponse.json({ error: "Event team not found" }, { status: 404 });
    }
    console.error("DELETE event team error:", error);
    return NextResponse.json({ error: "Failed to delete event team" }, { status: 500 });
  }
}
```

**Step 3: Members routes**

Create `src/app/api/events/[eventId]/teams/[eventTeamId]/members/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import { addEventTeamMember } from "@/services/team.service";

type RouteParams = { params: Promise<{ eventId: string; eventTeamId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
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

    const { eventTeamId } = await params;
    const body = await request.json();

    if (!body.userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const member = await addEventTeamMember(eventTeamId, body.userId, body.role);
    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error("POST member error:", error);
    const message = error instanceof Error ? error.message : "Failed to add member";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

Create `src/app/api/events/[eventId]/teams/[eventTeamId]/members/[userId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import { removeEventTeamMember } from "@/services/team.service";

type RouteParams = {
  params: Promise<{ eventId: string; eventTeamId: string; userId: string }>;
};

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

    const { eventTeamId, userId } = await params;
    await removeEventTeamMember(eventTeamId, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE member error:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
```

**Step 4: Task routes**

Create `src/app/api/events/[eventId]/teams/[eventTeamId]/tasks/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import { createEventTeamTask } from "@/services/team.service";

type RouteParams = { params: Promise<{ eventId: string; eventTeamId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
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

    const { eventTeamId } = await params;
    const body = await request.json();

    if (!body.title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const task = await createEventTeamTask(eventTeamId, body.title, body.assigneeId);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("POST task error:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
```

Create `src/app/api/events/[eventId]/teams/[eventTeamId]/tasks/[taskId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import { updateEventTeamTask, deleteEventTeamTask, TeamServiceError } from "@/services/team.service";

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
```

**Step 5: Commit**

```bash
git add src/app/api/events/[eventId]/teams/
git commit -m "feat: add event team, member, and task API routes"
```

---

## Task 6: Admin UI — Team Templates Page

**Files:**
- Create: `src/app/admin/teams/page.tsx`
- Modify: `src/app/admin/layout.tsx` (add nav item)

**Step 1: Add teams nav item to layout**

In `src/app/admin/layout.tsx`, add to the `navItems` array (after the users entry, line 43):

```typescript
import { UsersRound } from "lucide-react"; // add to imports
```

Add after the users nav item:

```typescript
{ href: "/admin/teams", label: "組別管理", icon: UsersRound, module: "teams" },
```

**Step 2: Create team templates management page**

Create `src/app/admin/teams/page.tsx` — a simple CRUD page for managing global team name templates:

- Table listing all templates (name, created date)
- Add new template (input + button)
- Edit name (inline or dialog)
- Delete template (with confirmation)
- Follow the pattern from `/admin/users/page.tsx` for layout and style

Use `useAdminPermissions("teams")` to check `canWrite` for showing edit/delete controls.

**Step 3: Verify the page renders**

```bash
npm run build
```

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/app/admin/teams/ src/app/admin/layout.tsx
git commit -m "feat: add team templates admin page with CRUD"
```

---

## Task 7: Admin UI — Event Teams Tab in Event Detail Page

**Files:**
- Modify: `src/app/admin/events/[eventId]/page.tsx`

**Step 1: Add a "工作小組" Card section**

After the Sessions card in the event detail page, add a new Card for event teams management. This section should:

1. **List event teams** — fetch from `GET /api/events/[eventId]/teams`
2. **Add team button** — dropdown to pick from templates or enter custom name
3. **Each team card** shows:
   - Team name (from template or custom)
   - Members list with add/remove (user search via `GET /api/users?search=...`)
   - SOP links list with add/remove (URL input)
   - Task list with create/edit status/delete

Use `useAdminPermissions("teams")` for permission-gated actions.

Follow the card-based pattern already established in the page.

**Step 2: Verify**

```bash
npm run build
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/app/admin/events/[eventId]/page.tsx
git commit -m "feat: add event teams management tab in event detail page"
```

---

## Task 8: Run All Tests and Final Verification

**Step 1: Run all unit tests**

```bash
npx vitest run
```

Expected: All tests pass.

**Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

**Step 3: Final commit (if any remaining changes)**

```bash
git status
# commit any remaining files
```
