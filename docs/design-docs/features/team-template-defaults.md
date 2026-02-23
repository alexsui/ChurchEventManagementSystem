# Team Template Defaults (Members & Tasks) Design

## Goal

Enhance team templates with default members and default tasks. When a template is used to create an event team, these defaults are copied over as pre-populated data. Event teams remain fully editable after creation.

## Current State

- `Team` model: just `id`, `name`, `createdAt`, `updatedAt`
- `EventTeam` has members (`EventTeamMember`) and tasks (`EventTeamTask`)
- When creating an event team from template, only the team reference is linked — no members or tasks are pre-filled

## Data Model

Two new Prisma models:

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

Relations added to `Team`:

```prisma
model Team {
  ...
  defaultMembers TeamDefaultMember[]
  defaultTasks   TeamDefaultTask[]
}
```

Relation added to `User`:

```prisma
model User {
  ...
  teamDefaultMemberships TeamDefaultMember[]
}
```

## Service Layer Changes

### team.service.ts

New functions:

- `getTeamTemplateWithDefaults(id)` — returns template with defaultMembers (including user info) and defaultTasks
- `addDefaultMember(teamId, userId, role?)` — add a default member
- `removeDefaultMember(teamId, userId)` — remove a default member
- `addDefaultTask(teamId, title)` — add a default task
- `removeDefaultTask(id)` — remove a default task

Modified functions:

- `getTeamTemplates()` — include `_count` for defaultMembers and defaultTasks
- `createEventTeam()` — when `teamId` is provided, copy default members → `EventTeamMember` rows and default tasks → `EventTeamTask` rows (PENDING status, no assignee)

## API Routes

### Existing routes (modified)

- `GET /api/teams` — include `_count.defaultMembers` and `_count.defaultTasks`

### New routes

- `GET /api/teams/[id]` — returns template with full default members and tasks
- `POST /api/teams/[id]/default-members` — add default member `{ userId, role? }`
- `DELETE /api/teams/[id]/default-members/[userId]` — remove default member
- `POST /api/teams/[id]/default-tasks` — add default task `{ title }`
- `DELETE /api/teams/[id]/default-tasks/[taskId]` — remove default task

## UI Changes

### 組別範本管理 page (`/admin/teams`)

Transform from a flat name list into an expandable detail view:

- Each template row becomes clickable/expandable
- Expanded view shows:
  - Default members list with role badges + add/remove
  - Default tasks list + add/remove
  - Member search dialog (reuse pattern from event-teams-section)
- Template table shows member count and task count columns

### Event Teams Section (no changes needed)

The `createEventTeam` service function handles copying defaults automatically. The event-teams-section UI already supports editing members and tasks after creation.

## Copy Behavior

When `createEventTeam(eventId, { teamId })` is called:

1. Create the `EventTeam` record (existing behavior)
2. Fetch `TeamDefaultMember` records for the template
3. Bulk create `EventTeamMember` rows (same userId, role)
4. Fetch `TeamDefaultTask` records for the template
5. Bulk create `EventTeamTask` rows (same title, status=PENDING, no assignee)

All within a single Prisma transaction.

## Files Changed

**New files:**

- `prisma/migrations/YYYYMMDD_add_team_defaults/migration.sql`

**Modified files:**

- `prisma/schema.prisma` — add TeamDefaultMember, TeamDefaultTask models
- `src/services/team.service.ts` — add default member/task functions, modify createEventTeam
- `src/services/team.service.test.ts` — add tests for new functions
- `src/app/api/teams/route.ts` — include \_count in GET
- `src/app/api/teams/[id]/route.ts` — add GET for template detail
- `src/app/api/teams/[id]/default-members/route.ts` — new POST
- `src/app/api/teams/[id]/default-members/[userId]/route.ts` — new DELETE
- `src/app/api/teams/[id]/default-tasks/route.ts` — new POST
- `src/app/api/teams/[id]/default-tasks/[taskId]/route.ts` — new DELETE
- `src/app/admin/teams/page.tsx` — enhanced UI with expandable details
