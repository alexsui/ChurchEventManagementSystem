# Architecture

Church Event Management System — a web application for managing church events,
registrations, attendance, assignments, teams, and budgets.

Built for a single church with multiple staff roles. The primary user interface
is in Traditional Chinese (繁體中文).

## Tech Stack

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Framework  | Next.js 16 (App Router, React 19)   |
| Language   | TypeScript 5                        |
| Database   | PostgreSQL (Neon)                   |
| ORM        | Prisma 7                            |
| Auth       | NextAuth v5 (JWT sessions)          |
| UI         | Tailwind CSS 4, Radix UI, shadcn/ui |
| Forms      | React Hook Form + Zod 4             |
| Testing    | Vitest 4 (unit), Playwright (E2E)   |
| Deployment | Vercel                              |

React Compiler is enabled (`next.config.ts → reactCompiler: true`).

## Architecture Layers

```
┌─────────────────────────────────────────────────┐
│  Pages / UI Components                          │
│  src/app/  ·  src/components/                   │
├─────────────────────────────────────────────────┤
│  Middleware          (auth gates, profile check) │
│  src/middleware.ts                               │
├─────────────────────────────────────────────────┤
│  API Routes          (REST, per-resource)        │
│  src/app/api/                                    │
├─────────────────────────────────────────────────┤
│  Service Layer       (business logic)            │
│  src/services/                                   │
├─────────────────────────────────────────────────┤
│  Prisma ORM          (schema + generated client) │
│  prisma/schema.prisma → src/generated/prisma/    │
├─────────────────────────────────────────────────┤
│  PostgreSQL           (Neon, pooled + direct)    │
└─────────────────────────────────────────────────┘
```

API routes are thin — they authenticate, authorize, call a service function,
and return JSON. Business logic lives in services, never in route handlers.

## Directory Map

```
src/
├── app/
│   ├── (public)/              # Public routes (events, login, check-in, profile)
│   ├── admin/                 # Protected admin pages (events, users, teams, etc.)
│   ├── api/                   # REST API endpoints
│   ├── layout.tsx             # Root layout (fonts, providers, toaster)
│   ├── page.tsx               # Root redirect → /events
│   └── providers.tsx          # NextAuth SessionProvider
│
├── components/
│   ├── admin/                 # Admin-specific panels (attendance, assignments, budget)
│   ├── shared/                # Reusable components (event-form, navbar, QR display)
│   └── ui/                    # shadcn/ui primitives (button, dialog, table, etc.)
│
├── contexts/
│   └── admin-permissions.tsx  # AdminPermissionsProvider + useAdminPermissions hook
│
├── generated/prisma/          # Prisma-generated client (do not edit)
│
├── lib/
│   ├── auth.ts                # NextAuth config (providers, callbacks)
│   ├── auth.config.ts         # Auth config for Edge middleware
│   ├── authorization.ts       # hasPermission(), assertActive(), permission cache
│   ├── constants.ts           # Role labels, status labels, categories (Chinese)
│   ├── formatters.ts          # Date/currency formatting utilities
│   ├── prisma.ts              # Singleton Prisma client
│   ├── qrcode.ts              # QR code generation
│   ├── taipei-date.ts         # "YYYY-MM-DD" helpers in Asia/Taipei (client + server)
│   └── utils.ts               # General utilities (cn, etc.)
│
├── middleware.ts              # Profile completion redirect, admin auth gate
│
├── services/                  # Business logic (one file per domain)
│   ├── event.service.ts
│   ├── registration.service.ts
│   ├── attendance.service.ts
│   ├── assignment.service.ts
│   ├── team.service.ts
│   ├── user.service.ts
│   ├── budget.service.ts
│   ├── role-permission.service.ts
│   ├── punch.service.ts
│   └── *.service.test.ts      # Co-located unit tests
│
└── types/
    └── next-auth.d.ts         # NextAuth type augmentation (role, isActive, etc.)

e2e/                           # Playwright E2E tests (numbered for execution order)
prisma/
├── schema.prisma              # Data model
├── migrations/                # Migration history
├── seed.ts                    # Development seed data
└── init-production.ts         # Production initialization (guarded)
```

## Key Modules

### Events

Single or series events with sessions, categories (COURSE / LECTURE / CAMP),
and status lifecycle: PLANNING → OPEN → IN_PROGRESS → COMPLETED. Status is
computed from session dates via `computeEffectiveStatus()` in the event service.

### Registration

Users register for events. Auto-waitlist when `maxParticipants` is reached.
Auto-promote first waitlisted user when a registration is cancelled.

### Attendance

Per-session check-in with late tracking. Supports bulk check-in and QR code
check-in (public `/check-in/[sessionId]` route). Attendance summary provides a
user × session matrix view.

### Punch (打卡)

Standalone self check-in module, separate from events, for recurring groups
whose meeting dates are irregular (e.g. worship team rehearsals). An activity
has a title and a date range, plus a roster with join/leave dates. Members scan
one fixed QR code (public `/punch/[activityId]` route) and punch once per day,
in Asia/Taipei time. There are no sessions: any date with at least one punch
counts as one rehearsal. Each member's attendance rate only counts rehearsals
inside their roster window. Admin pages live at `/admin/punch` and reuse the
`attendance` permission module. Members can punch based on roster membership
alone, with no role permission needed. Stats export to Excel.

### Assignments

Per-session homework/tasks. Tracks completion per user with `completedBy`
attribution. Assignment summary provides a completion rate matrix.

### Teams

Two-level model: **Team templates** (reusable across events) and **Event teams**
(instantiated per event). Templates carry default members and default tasks.
When attached to an event, defaults are cloned. Event teams support SOP links,
custom names, task assignment with deadlines.

### Budget

Per-event budget items with categories (MEAL, SNACK, VENUE, MATERIAL, EQUIPMENT,
OTHER). Tracks estimated vs actual amounts. Summary provides totals and execution
rate.

### Users & Roles

Eight roles: ADMIN, STAFF_ADMIN, STAFF_GENERAL, STAFF_FINANCE, PASTOR,
STAFF_MEDIA, TEAM_LEADER, MEMBER. Roles have optional expiration dates.
Users can be deactivated (blocked from admin access).

## Data Model

Core entities and their relationships:

```
User ──┬── Registration ── Event
       ├── Attendance ── EventSession ── Event
       ├── AssignmentCompletion ── Assignment ── EventSession
       ├── EventTeamMember ── EventTeam ──┬── Event
       │                                  └── Team (template, optional)
       └── TeamDefaultMember ── Team

Team ──┬── TeamDefaultMember
       ├── TeamDefaultTask
       └── EventTeam ──┬── EventTeamMember
                       └── EventTeamTask

Event ──┬── EventSession ──┬── Attendance
        │                  ├── Assignment ── AssignmentCompletion
        │                  └── (linked via EventTeam tasks)
        ├── Registration
        ├── EventTeam
        └── BudgetItem

RolePermission (role × module × action → allowed)
```

Key constraints: most junction tables have composite unique indexes
(e.g., `[userId, eventId]` on Registration, `[eventTeamId, userId]` on
EventTeamMember).

## Auth & Permissions

### Authentication

- **Providers**: LINE OAuth (primary) + email/password credentials
- **Strategy**: JWT with 12-hour max session age
- **Adapter**: Prisma (stores Account, Session, VerificationToken)
- JWT callback refreshes role and isActive from DB on every request

### Authorization

- **Model**: Role-based access control (RBAC) stored in `RolePermission` table
- **Modules**: events, registrations, attendance, assignments, users, teams, budget, reports
- **Actions**: read, write
- **ADMIN bypass**: ADMIN role always has full access (not stored in DB)
- **Caching**: In-memory cache with 60-second TTL, invalidated on permission updates
- **Frontend**: `AdminPermissionsProvider` context fetches `/api/me/permissions`
  and exposes `useAdminPermissions(module)` → `{canRead, canWrite}`

### Middleware

- Redirects incomplete profiles to `/complete-profile`
- Blocks inactive users from `/admin/*`
- Protected routes: `/admin/:path*`, `/events/:path*`, `/my/:path*`, `/complete-profile`

## Testing Strategy

| Type        | Tool       | Config                         | Command                    |
| ----------- | ---------- | ------------------------------ | -------------------------- |
| Unit        | Vitest     | `vitest.config.ts`             | `npm test`                 |
| Integration | Vitest     | `vitest.integration.config.ts` | `npm run test:integration` |
| E2E         | Playwright | `e2e/playwright.config.ts`     | `npm run test:e2e`         |

- **Unit tests** run in Node environment (service/lib tests) or jsdom (React component tests)
- **Integration tests** match `*.integration.test.ts`, run against a real database
- **E2E tests** are numbered for execution order (1-auth → 7-checkin-flow),
  run Chromium with a dev server, sequential (1 worker)

## Deployment

- **Platform**: Vercel (standard Next.js deployment)
- **Database**: Neon PostgreSQL with two connection strings:
  - `DATABASE_URL` — pooled connection (for the application)
  - `DIRECT_URL` — direct connection (for Prisma migrations)
- **Auth**: LINE OAuth credentials + `NEXTAUTH_SECRET` configured via Vercel env vars
- **Safety guards**: `ALLOW_NON_LOCAL_SEED`, `ALLOW_PROD_INIT` flags prevent
  accidental production data operations
