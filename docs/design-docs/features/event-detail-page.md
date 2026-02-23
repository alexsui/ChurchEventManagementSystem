# Event Detail Page (Unified Event Workspace) Design

## Goal

Provide a single page (`/admin/events/[eventId]`) where admins can view and manage all aspects of an event — registrations, attendance, assignments, and budget — without navigating between separate module pages.

## Problem

Currently, to manage a single event, admins must navigate to 5 different sidebar pages (events, registrations, attendance, assignments, budget) and select the same event from a dropdown each time. This is repetitive and inefficient.

## Approach: Extract & Reuse

Refactor each module page into two pieces:

1. **Shared panel component** — takes `eventId` as prop, contains all CRUD UI
2. **Standalone page** — thin wrapper that adds an event selector dropdown

The event detail page imports all 4 panel components and renders them as sub-tabs.

## Component Architecture

### New shared components

| File                                           | Extracted from                         | Description                           |
| ---------------------------------------------- | -------------------------------------- | ------------------------------------- |
| `src/components/admin/event-selector.tsx`      | All 4 module pages                     | Shared event dropdown selector        |
| `src/components/admin/registrations-panel.tsx` | `src/app/admin/registrations/page.tsx` | Full registrations CRUD for one event |
| `src/components/admin/attendance-panel.tsx`    | `src/app/admin/attendance/page.tsx`    | Full attendance CRUD for one event    |
| `src/components/admin/assignments-panel.tsx`   | `src/app/admin/assignments/page.tsx`   | Full assignments CRUD for one event   |
| `src/components/admin/budget-panel.tsx`        | `src/app/admin/budget/page.tsx`        | Full budget CRUD for one event        |

Each panel accepts `eventId: string` as its only required prop. All event selection logic is removed from the panel — it works with the given event directly.

### Panel extraction strategy

**Moves to panel:** All state, fetch/CRUD functions, UI rendering (tables, dialogs, forms, filters).

**Stays in standalone page:** Event selector dropdown + state, page title, conditional render of the panel.

**Cascading selectors:** Attendance (event → session) and assignments (event → session → assignment) keep their session/assignment selectors inside the panel. Only the top-level event selector is removed.

### Standalone page pattern (after refactor)

```tsx
function RegistrationsPage() {
  const [eventId, setEventId] = useState("");
  return (
    <>
      <EventSelector value={eventId} onChange={setEventId} />
      {eventId && <RegistrationsPanel eventId={eventId} />}
    </>
  );
}
```

## Event Detail Page Layout

### Header (unchanged)

Back button, event title, status/category badges, edit button.

### Tabs (new)

```
┌──────────────────────────────────────────────────┐
│ ← Event Title          [Status Badge] [Edit]     │
├──────────────────────────────────────────────────┤
│ [活動資訊] [報名] [出席] [作業] [預算]              │
├──────────────────────────────────────────────────┤
│  (tab content)                                   │
└──────────────────────────────────────────────────┘
```

- **活動資訊** (default tab): Event info card, status management, sessions table, event teams section
- **報名**: `<RegistrationsPanel eventId={eventId} />`
- **出席**: `<AttendancePanel eventId={eventId} />`
- **作業**: `<AssignmentsPanel eventId={eventId} />`
- **預算**: `<BudgetPanel eventId={eventId} />`

## Permissions & Tab Visibility

Tabs are conditionally rendered based on module permissions:

- 活動資訊 — always visible (user has events:read to reach this page)
- 報名 — visible if `registrations:read`
- 出席 — visible if `attendance:read`
- 作業 — visible if `assignments:read`
- 預算 — visible if `budget:read`

Write permission gates (add/edit/delete buttons) are handled inside each panel via `useAdminPermissions`.

## No API Changes

Each panel fetches from existing API endpoints (`/api/registrations?eventId=`, `/api/attendance?eventId=`, etc.). No new endpoints required.

## Files Changed

**New files (5):**

- `src/components/admin/event-selector.tsx`
- `src/components/admin/registrations-panel.tsx`
- `src/components/admin/attendance-panel.tsx`
- `src/components/admin/assignments-panel.tsx`
- `src/components/admin/budget-panel.tsx`

**Modified files (5):**

- `src/app/admin/events/[eventId]/page.tsx` — add Tabs, move existing content into 活動資訊 tab
- `src/app/admin/registrations/page.tsx` — thin wrapper
- `src/app/admin/attendance/page.tsx` — thin wrapper
- `src/app/admin/assignments/page.tsx` — thin wrapper
- `src/app/admin/budget/page.tsx` — thin wrapper

**Unchanged:**

- API routes, services, Prisma schema, sidebar navigation
