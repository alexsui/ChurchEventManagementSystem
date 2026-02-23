# Team Template Defaults Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add default members and default tasks to team templates, with auto-copy to event teams on creation.

**Architecture:** Two new Prisma models (TeamDefaultMember, TeamDefaultTask), new service functions, new API routes, and enhanced admin UI.

**Tech Stack:** Prisma, Next.js App Router, React, shadcn/ui, Vitest

---

### Task 1: Prisma schema + migration

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260218100000_add_team_defaults/migration.sql`

Add TeamDefaultMember and TeamDefaultTask models. Add relations to Team and User.

Schema additions:

```prisma
model TeamDefaultMember {
  id        String   @id @default(cuid())
  teamId    String
  userId    String
  role      String?
  createdAt DateTime @default(now())

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([teamId, userId])
}

model TeamDefaultTask {
  id        String   @id @default(cuid())
  teamId    String
  title     String
  createdAt DateTime @default(now())

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
}
```

Add to Team model:

```prisma
defaultMembers TeamDefaultMember[]
defaultTasks   TeamDefaultTask[]
```

Add to User model:

```prisma
teamDefaultMemberships TeamDefaultMember[]
```

Generate migration SQL using `npx prisma migrate diff`. Apply and verify with `npx prisma generate`.

Run `npx vitest run` to verify existing tests still pass.

Commit: `feat: add TeamDefaultMember and TeamDefaultTask models`

---

### Task 2: Service layer

**Files:**

- Modify: `src/services/team.service.ts`
- Modify: `src/services/team.service.test.ts`

**New functions:**

```typescript
// Get template with defaults
export async function getTeamTemplateWithDefaults(teamId: string) {
  const template = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      defaultMembers: {
        include: { user: { select: { id: true, name: true, phone: true } } },
        orderBy: { createdAt: "asc" },
      },
      defaultTasks: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!template) {
    throw new TeamServiceError("Team template not found", "TEMPLATE_NOT_FOUND");
  }
  return template;
}

// Default members CRUD
export async function addDefaultMember(teamId: string, userId: string, role?: string) {
  // Verify template exists
  const template = await prisma.team.findUnique({ where: { id: teamId } });
  if (!template) throw new TeamServiceError("Team template not found", "TEMPLATE_NOT_FOUND");

  return prisma.teamDefaultMember.create({
    data: { teamId, userId, role: role ?? null },
  });
}

export async function removeDefaultMember(teamId: string, userId: string) {
  const existing = await prisma.teamDefaultMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  if (!existing) throw new TeamServiceError("Default member not found", "DEFAULT_MEMBER_NOT_FOUND");
  return prisma.teamDefaultMember.delete({ where: { id: existing.id } });
}

// Default tasks CRUD
export async function addDefaultTask(teamId: string, title: string) {
  const template = await prisma.team.findUnique({ where: { id: teamId } });
  if (!template) throw new TeamServiceError("Team template not found", "TEMPLATE_NOT_FOUND");
  return prisma.teamDefaultTask.create({ data: { teamId, title } });
}

export async function removeDefaultTask(taskId: string) {
  const existing = await prisma.teamDefaultTask.findUnique({ where: { id: taskId } });
  if (!existing) throw new TeamServiceError("Default task not found", "DEFAULT_TASK_NOT_FOUND");
  return prisma.teamDefaultTask.delete({ where: { id: taskId } });
}
```

**Modified functions:**

`getTeamTemplates()` — add `_count` for defaultMembers and defaultTasks:

```typescript
return prisma.team.findMany({
  orderBy: { name: "asc" },
  include: {
    _count: { select: { defaultMembers: true, defaultTasks: true } },
  },
});
```

`createEventTeam()` — after creating EventTeam, copy defaults in a transaction:

```typescript
export async function createEventTeam(
  eventId: string,
  input: { teamId?: string; customName?: string }
) {
  // ... existing validation ...

  return prisma.$transaction(async (tx) => {
    const eventTeam = await tx.eventTeam.create({
      data: { eventId, teamId: input.teamId ?? null, customName: input.customName ?? null },
    });

    // Copy defaults if creating from template
    if (input.teamId) {
      const [defaultMembers, defaultTasks] = await Promise.all([
        tx.teamDefaultMember.findMany({ where: { teamId: input.teamId } }),
        tx.teamDefaultTask.findMany({ where: { teamId: input.teamId } }),
      ]);

      if (defaultMembers.length > 0) {
        await tx.eventTeamMember.createMany({
          data: defaultMembers.map((m) => ({
            eventTeamId: eventTeam.id,
            userId: m.userId,
            role: m.role,
          })),
        });
      }

      if (defaultTasks.length > 0) {
        await tx.eventTeamTask.createMany({
          data: defaultTasks.map((t) => ({
            eventTeamId: eventTeam.id,
            title: t.title,
          })),
        });
      }
    }

    return eventTeam;
  });
}
```

**Tests:** Add tests for all new functions + test that createEventTeam copies defaults.

Run `npx vitest run` — all tests pass.

Commit: `feat: add default members/tasks service functions and auto-copy on event team creation`

---

### Task 3: API routes for default members and tasks

**Files:**

- Modify: `src/app/api/teams/route.ts` — GET includes \_count
- Modify: `src/app/api/teams/[teamId]/route.ts` — add GET handler
- Create: `src/app/api/teams/[teamId]/default-members/route.ts` — POST
- Create: `src/app/api/teams/[teamId]/default-members/[userId]/route.ts` — DELETE
- Create: `src/app/api/teams/[teamId]/default-tasks/route.ts` — POST
- Create: `src/app/api/teams/[teamId]/default-tasks/[taskId]/route.ts` — DELETE

All routes follow the existing pattern:

- Auth check → assertActive → hasPermission("teams", "read"/"write")
- GET = read permission, POST/DELETE = write permission
- TeamServiceError handling with status map

**GET /api/teams** (modified): Return templates with `_count.defaultMembers` and `_count.defaultTasks`.

**GET /api/teams/[teamId]** (new): Return template with full defaultMembers (including user info) and defaultTasks. Uses `getTeamTemplateWithDefaults()`.

**POST /api/teams/[teamId]/default-members**: Body `{ userId: string, role?: string }`. Calls `addDefaultMember()`.

**DELETE /api/teams/[teamId]/default-members/[userId]**: Calls `removeDefaultMember()`.

**POST /api/teams/[teamId]/default-tasks**: Body `{ title: string }`. Calls `addDefaultTask()`.

**DELETE /api/teams/[teamId]/default-tasks/[taskId]**: Calls `removeDefaultTask()`.

Run `npx tsc --noEmit` — no errors.

Commit: `feat: add API routes for team template default members and tasks`

---

### Task 4: Enhanced admin teams page

**Files:**

- Modify: `src/app/admin/teams/page.tsx`

Transform the flat table into an expandable detail view:

- Table columns: Name, Default Members count, Default Tasks count, Created Date, Actions
- Click a template row → expand inline to show:
  - **Default Members** section: list with name + role badge + remove button, plus "add member" button that opens a user search dialog (reuse the same pattern as event-teams-section.tsx)
  - **Default Tasks** section: list with title + remove button, plus inline input to add new task
- Keep existing name edit and delete functionality

The expanded view fetches full template data via `GET /api/teams/[teamId]`.

User search for adding members uses the existing `GET /api/users?search=` endpoint.

Run `npx tsc --noEmit` — no errors.

Commit: `feat: enhance teams admin page with default members and tasks management`

---

### Task 5: Verification

- Run `npx tsc --noEmit` — 0 errors
- Run `npx vitest run` — all tests pass
- Verify createEventTeam copies defaults by checking service test
