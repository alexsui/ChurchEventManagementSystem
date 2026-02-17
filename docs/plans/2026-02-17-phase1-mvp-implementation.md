# Phase 1 MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the church event management MVP — event CRUD, user auth (LINE Login + credentials), registration, and attendance tracking.

**Architecture:** Next.js full-stack monolith with App Router. API Routes → Service Layer → Prisma ORM → Supabase PostgreSQL. NextAuth.js for auth with LINE Login + Credentials providers. shadcn/ui for UI components.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Prisma, NextAuth.js (Auth.js v5), shadcn/ui, Tailwind CSS, Supabase PostgreSQL, `qrcode` npm package.

**Reference docs:**
- HLD: `docs/plans/2026-02-17-hld-design.md`
- PRD: `docs/plans/PRD.md`

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `.env.local`, `.env.example`, `.gitignore`

**Step 1: Initialize Next.js project**

```bash
npx create-next-app@latest church-event-management --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

Since we're already in the repo root, we'll init inside a temp dir and move files, OR use `--no-git` and init in place. Adjust as needed.

**Step 2: Install core dependencies**

```bash
npm install prisma @prisma/client next-auth@beta @auth/prisma-adapter
npm install qrcode
npm install -D @types/qrcode
```

**Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init
```

Select: New York style, Zinc color, CSS variables = yes.

Then add initial components:

```bash
npx shadcn@latest add button input label card table dialog form select badge toast dropdown-menu tabs separator
```

**Step 4: Create .env.example**

```env
# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# NextAuth
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# Supabase Storage
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# LINE Login
LINE_CHANNEL_ID=your-line-channel-id
LINE_CHANNEL_SECRET=your-line-channel-secret
```

**Step 5: Update .gitignore**

Ensure `.env.local` is in `.gitignore` (create-next-app should handle this, verify).

**Step 6: Verify dev server runs**

```bash
npm run dev
```

Visit `http://localhost:3000` — should see the Next.js default page.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with Tailwind, shadcn/ui, and core dependencies"
```

---

## Task 2: Prisma Schema & Database Setup

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`

**Step 1: Initialize Prisma**

```bash
npx prisma init
```

**Step 2: Write the Phase 1 schema**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum Role {
  ADMIN       // 統籌者
  STAFF_ADMIN // 行政同工
  STAFF_GENERAL // 總務同工
  STAFF_FINANCE // 財務同工
  PASTOR      // 傳道人
  STAFF_MEDIA // 多媒體同工
  TEAM_LEADER // 組長
  MEMBER      // 一般會員
}

enum EventType {
  SINGLE // 單場活動
  SERIES // 系列活動
}

enum EventStatus {
  PLANNING    // 企劃中
  OPEN        // 報名中
  IN_PROGRESS // 進行中
  COMPLETED   // 已結束
}

enum RegistrationMode {
  PER_SESSION // 單場報名
  FULL_SERIES // 整期報名
}

enum RegistrationStatus {
  REGISTERED // 已報名
  CANCELLED  // 已取消
  WAITLISTED // 候補中
}

// NextAuth.js required tables
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// Application tables
model User {
  id                   String    @id @default(cuid())
  name                 String?
  email                String?   @unique
  emailVerified        DateTime?
  image                String?
  phone                String?   @unique
  password             String?   // hashed, for credentials provider
  role                 Role      @default(MEMBER)
  teamId               String?
  permissionExpiresAt  DateTime?
  isActive             Boolean   @default(true)
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  // NextAuth relations
  accounts      Account[]
  sessions      Session[]

  // App relations
  team          Team?          @relation(fields: [teamId], references: [id])
  registrations Registration[]
  attendances   Attendance[]
}

model Team {
  id        String   @id @default(cuid())
  name      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users User[]
}

model Event {
  id               String             @id @default(cuid())
  title            String
  description      String?            @db.Text
  location         String?
  type             EventType          @default(SINGLE)
  status           EventStatus        @default(PLANNING)
  registrationMode RegistrationMode   @default(FULL_SERIES)
  maxParticipants  Int?
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt

  eventSessions  EventSession[]
  registrations  Registration[]
}

model EventSession {
  id          String   @id @default(cuid())
  eventId     String
  sessionNo   Int
  sessionDate DateTime
  startTime   String?  // e.g. "09:00"
  endTime     String?  // e.g. "12:00"
  topic       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  event       Event        @relation(fields: [eventId], references: [id], onDelete: Cascade)
  attendances Attendance[]

  @@unique([eventId, sessionNo])
}

model Registration {
  id        String             @id @default(cuid())
  userId    String
  eventId   String
  status    RegistrationStatus @default(REGISTERED)
  createdAt DateTime           @default(now())
  updatedAt DateTime           @updatedAt

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  event Event @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@unique([userId, eventId])
}

model Attendance {
  id             String   @id @default(cuid())
  userId         String
  eventSessionId String
  isLate         Boolean  @default(false)
  lateMinutes    Int?
  checkedInAt    DateTime @default(now())
  createdAt      DateTime @default(now())

  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  eventSession EventSession @relation(fields: [eventSessionId], references: [id], onDelete: Cascade)

  @@unique([userId, eventSessionId])
}
```

Note: NextAuth's `Session` model (auth sessions) is different from `EventSession` (活動的每一堂). Renamed to `EventSession` to avoid conflict.

**Step 3: Create Prisma client singleton**

```typescript
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Step 4: Set up DATABASE_URL in .env.local**

Point to your Supabase dev project's PostgreSQL connection string.

**Step 5: Run initial migration**

```bash
npx prisma migrate dev --name init
```

**Step 6: Verify with Prisma Studio**

```bash
npx prisma studio
```

Should open browser showing all tables.

**Step 7: Commit**

```bash
git add prisma/ src/lib/prisma.ts
git commit -m "feat: add Prisma schema with User, Event, EventSession, Registration, Attendance"
```

---

## Task 3: NextAuth.js Setup (Credentials + LINE Login)

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/app/(public)/login/page.tsx`
- Create: `src/middleware.ts`

**Step 1: Configure NextAuth**

```typescript
// src/lib/auth.ts
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import LINE from "next-auth/providers/line";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    LINE({
      clientId: process.env.LINE_CHANNEL_ID!,
      clientSecret: process.env.LINE_CHANNEL_SECRET!,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.password) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.isActive = dbUser.isActive;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as string;
        session.user.isActive = token.isActive as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
```

**Step 2: Install bcryptjs**

```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```

**Step 3: Create API route handler**

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

**Step 4: Extend NextAuth types**

```typescript
// src/types/next-auth.d.ts
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      isActive: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    isActive?: boolean;
  }
}
```

**Step 5: Create middleware for admin route protection**

```typescript
// src/middleware.ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Admin routes require authentication
  if (pathname.startsWith("/admin")) {
    if (!req.auth) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*"],
};
```

**Step 6: Create login page**

```tsx
// src/app/(public)/login/page.tsx
// Build a login page with:
// - "用 LINE 登入" button (calls signIn("line"))
// - Email + password form (calls signIn("credentials"))
// - Registration form for new credentials users
// Use shadcn/ui Card, Input, Button, Tabs components
// Tabs: "LINE 登入" | "帳號密碼"
```

Full implementation in Task execution — the page needs signIn from next-auth/react, shadcn/ui form components, and a registration API endpoint.

**Step 7: Create registration API for credentials users**

```typescript
// src/app/api/auth/register/route.ts
// POST: accept { name, email, password, phone }
// Hash password with bcryptjs
// Create User with role: MEMBER
// Return success or error
```

**Step 8: Verify login flow works**

- Visit `/login` → see login form
- Register a new user → redirected to home
- Log out → log back in with credentials
- (LINE Login can be tested after configuring LINE Developer Console)

**Step 9: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth/ src/app/\\(public\\)/login/ src/middleware.ts src/types/
git commit -m "feat: add NextAuth.js with LINE Login + Credentials providers"
```

---

## Task 4: RBAC Authorization Helpers

**Files:**
- Create: `src/lib/authorization.ts`
- Create: `src/lib/authorization.test.ts`

**Step 1: Write failing tests for permission checks**

```typescript
// src/lib/authorization.test.ts
import { describe, it, expect } from "vitest";
import { hasPermission, PERMISSIONS } from "@/lib/authorization";

describe("hasPermission", () => {
  it("ADMIN has full access to all modules", () => {
    expect(hasPermission("ADMIN", "events", "write")).toBe(true);
    expect(hasPermission("ADMIN", "users", "write")).toBe(true);
    expect(hasPermission("ADMIN", "budget", "write")).toBe(true);
  });

  it("STAFF_ADMIN can read/write events, registrations, attendance", () => {
    expect(hasPermission("STAFF_ADMIN", "events", "write")).toBe(true);
    expect(hasPermission("STAFF_ADMIN", "registrations", "write")).toBe(true);
    expect(hasPermission("STAFF_ADMIN", "attendance", "write")).toBe(true);
    expect(hasPermission("STAFF_ADMIN", "budget", "read")).toBe(false);
  });

  it("MEMBER can only read own data", () => {
    expect(hasPermission("MEMBER", "events", "read")).toBe(true);
    expect(hasPermission("MEMBER", "events", "write")).toBe(false);
    expect(hasPermission("MEMBER", "budget", "read")).toBe(false);
  });

  it("PASTOR has read access to most modules except budget", () => {
    expect(hasPermission("PASTOR", "events", "read")).toBe(true);
    expect(hasPermission("PASTOR", "users", "read")).toBe(true);
    expect(hasPermission("PASTOR", "budget", "read")).toBe(false);
  });
});
```

**Step 2: Install vitest**

```bash
npm install -D vitest @vitejs/plugin-react
```

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest"
  }
}
```

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**Step 3: Run test — verify it fails**

```bash
npm test -- --run src/lib/authorization.test.ts
```

Expected: FAIL — module not found.

**Step 4: Implement authorization**

```typescript
// src/lib/authorization.ts
type Module = "events" | "registrations" | "attendance" | "assignments" | "users" | "teams" | "budget" | "reports";
type Action = "read" | "write";

const ROLE_PERMISSIONS: Record<string, Partial<Record<Module, Action[]>>> = {
  ADMIN: {
    events: ["read", "write"],
    registrations: ["read", "write"],
    attendance: ["read", "write"],
    assignments: ["read", "write"],
    users: ["read", "write"],
    teams: ["read", "write"],
    budget: ["read", "write"],
    reports: ["read", "write"],
  },
  STAFF_ADMIN: {
    events: ["read", "write"],
    registrations: ["read", "write"],
    attendance: ["read", "write"],
    assignments: ["read"],
    users: ["read"],
    teams: ["read"],
    reports: ["read"],
  },
  STAFF_GENERAL: {
    events: ["read"],
    registrations: ["read"],
    budget: ["read", "write"],
    reports: ["read"],
  },
  STAFF_FINANCE: {
    events: ["read"],
    registrations: ["read"],
    budget: ["read", "write"],
    reports: ["read"],
  },
  PASTOR: {
    events: ["read"],
    registrations: ["read"],
    attendance: ["read"],
    assignments: ["read"],
    users: ["read"],
    teams: ["read"],
    reports: ["read"],
  },
  STAFF_MEDIA: {
    events: ["read"],
    teams: ["read"],
  },
  TEAM_LEADER: {
    events: ["read"],
    registrations: ["read"],
    attendance: ["read"],
    assignments: ["read"],
    teams: ["read"],
  },
  MEMBER: {
    events: ["read"],
    registrations: ["read"],
    attendance: ["read"],
    assignments: ["read"],
    users: ["read"],
  },
};

export function hasPermission(role: string, module: Module, action: Action): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  const moduleActions = permissions[module];
  if (!moduleActions) return false;
  return moduleActions.includes(action);
}

export { ROLE_PERMISSIONS };
export type { Module, Action };
```

**Step 5: Run test — verify it passes**

```bash
npm test -- --run src/lib/authorization.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/lib/authorization.ts src/lib/authorization.test.ts vitest.config.ts
git commit -m "feat: add RBAC permission helpers with tests"
```

---

## Task 5: Event Management — Service & API

**Files:**
- Create: `src/services/event.service.ts`
- Create: `src/app/api/events/route.ts`
- Create: `src/app/api/events/[eventId]/route.ts`

**Step 1: Implement event service**

```typescript
// src/services/event.service.ts
// Functions:
// - createEvent(data) → creates Event + auto-creates EventSession(s)
//   - SINGLE type: creates 1 EventSession
//   - SERIES type: creates N EventSessions from provided sessions array
// - getEvents(filters?) → list events with session count and registration count
// - getEventById(id) → event with sessions and registration count
// - updateEvent(id, data) → update event details
// - deleteEvent(id) → cascade delete event + sessions
// - updateEventStatus(id, status) → update status only
```

**Step 2: Implement API routes**

```typescript
// src/app/api/events/route.ts
// GET: list events (public, no auth required for reading)
// POST: create event (requires auth + events:write permission)

// src/app/api/events/[eventId]/route.ts
// GET: get single event with sessions
// PUT: update event (requires events:write)
// DELETE: delete event (requires events:write)
```

Each route handler should:
1. Check auth via `auth()`
2. Check permission via `hasPermission()`
3. Call service function
4. Return JSON response

**Step 3: Verify with curl or Prisma Studio**

- Create an event via POST
- List events via GET
- Verify EventSessions were auto-created

**Step 4: Commit**

```bash
git add src/services/event.service.ts src/app/api/events/
git commit -m "feat: add event management service and API routes"
```

---

## Task 6: Event Management — Admin UI

**Files:**
- Create: `src/app/(admin)/layout.tsx` — admin layout with sidebar navigation
- Create: `src/app/(admin)/events/page.tsx` — events list page
- Create: `src/app/(admin)/events/new/page.tsx` — create event form
- Create: `src/app/(admin)/events/[eventId]/page.tsx` — event detail + edit
- Create: `src/components/shared/event-form.tsx`

**Step 1: Create admin layout with sidebar**

Sidebar links (Phase 1 only):
- 活動管理 (`/admin/events`)
- 報名管理 (`/admin/registrations`)
- 出席管理 (`/admin/attendance`)
- 使用者管理 (`/admin/users`) — only visible to ADMIN role

Header: show current user name + role + logout button.

**Step 2: Create events list page**

- DataTable showing all events
- Columns: 活動名稱, 類型 (單場/系列), 狀態, 報名人數, 建立日期
- "新增活動" button
- Click row → navigate to detail page

**Step 3: Create event form (shared between new & edit)**

Fields:
- 活動名稱 (required)
- 活動說明 (textarea)
- 地點
- 類型: 單場活動 / 系列活動 (radio)
- 報名模式: 單場報名 / 整期報名 (only if series)
- 人數上限 (optional number)
- If 系列活動: dynamic form to add sessions (日期, 時間, 主題)

**Step 4: Create event detail page**

- Show event info
- Show sessions list (for series events)
- Edit button → opens form in edit mode
- Status change buttons (企劃中 → 報名中 → 進行中 → 已結束)
- QR Code display for event registration link
- Per-session QR Code for check-in (generates QR with `/check-in/[sessionId]` URL)

**Step 5: Verify full CRUD flow**

- Create a single event → verify it appears in list
- Create a series event with 5 sessions → verify sessions are created
- Edit event details → verify changes saved
- Change event status → verify status updates

**Step 6: Commit**

```bash
git add src/app/\\(admin\\)/ src/components/
git commit -m "feat: add event management admin UI with CRUD"
```

---

## Task 7: Registration Management — Service & API

**Files:**
- Create: `src/services/registration.service.ts`
- Create: `src/app/api/registrations/route.ts`
- Create: `src/app/api/registrations/[registrationId]/route.ts`

**Step 1: Implement registration service**

```typescript
// src/services/registration.service.ts
// Functions:
// - registerForEvent(userId, eventId) → create Registration
//   - Check event status is OPEN
//   - Check not already registered
//   - Check maxParticipants; if full, set status to WAITLISTED
// - cancelRegistration(userId, eventId) → set status CANCELLED
//   - If waitlisted users exist, promote first one to REGISTERED
// - getRegistrationsByEvent(eventId) → list with user info
// - getRegistrationsByUser(userId) → list with event info
// - getRegistrationCount(eventId) → { registered, waitlisted, cancelled }
```

**Step 2: Implement API routes**

```typescript
// src/app/api/registrations/route.ts
// GET: list registrations (admin: by event; member: own only)
// POST: register current user for an event (requires auth)

// src/app/api/registrations/[registrationId]/route.ts
// DELETE: cancel registration
```

**Step 3: Commit**

```bash
git add src/services/registration.service.ts src/app/api/registrations/
git commit -m "feat: add registration service with waitlist support"
```

---

## Task 8: Public Event Page & Registration Flow

**Files:**
- Create: `src/app/(public)/events/[eventId]/page.tsx`
- Create: `src/lib/qrcode.ts`

**Step 1: Create QR Code utility**

```typescript
// src/lib/qrcode.ts
import QRCode from "qrcode";

export async function generateQRCodeDataURL(url: string): Promise<string> {
  return QRCode.toDataURL(url, { width: 300, margin: 2 });
}
```

**Step 2: Create public event detail page**

- Display event info (title, description, location, dates)
- Show sessions list for series events
- "報名" button
  - If logged in → POST to `/api/registrations` → show success
  - If not logged in → redirect to `/login?callbackUrl=/events/[eventId]`
- Show registration count / spots remaining

**Step 3: Add QR Code generation to admin event detail**

- Generate QR Code for URL: `{NEXTAUTH_URL}/events/[eventId]`
- Display QR image + "複製連結" button
- For each session: generate check-in QR Code for `{NEXTAUTH_URL}/check-in/[sessionId]`

**Step 4: Verify full registration flow**

- Open event page as anonymous → click 報名 → redirected to login → login → redirected back → click 報名 → success
- Open event page as logged-in user → click 報名 → success
- Fill up event to max → next registration should be waitlisted

**Step 5: Commit**

```bash
git add src/app/\\(public\\)/events/ src/lib/qrcode.ts
git commit -m "feat: add public event page with registration flow and QR code"
```

---

## Task 9: Registration Management — Admin UI

**Files:**
- Create: `src/app/(admin)/registrations/page.tsx`

**Step 1: Create registrations admin page**

- Event selector dropdown at top
- DataTable showing registrations for selected event
- Columns: 姓名, 電話, 狀態 (badge: 已報名/候補/已取消), 報名時間
- Filter by status
- Export to CSV button (optional, nice-to-have)

**Step 2: Verify admin can view registrations**

- Create event → register a few users → view in admin → verify list is correct

**Step 3: Commit**

```bash
git add src/app/\\(admin\\)/registrations/
git commit -m "feat: add registration management admin page"
```

---

## Task 10: Attendance Management — Service & API

**Files:**
- Create: `src/services/attendance.service.ts`
- Create: `src/app/api/attendance/route.ts`

**Step 1: Implement attendance service**

```typescript
// src/services/attendance.service.ts
// Functions:
// - checkIn(userId, eventSessionId) → create Attendance record
//   - Verify user has Registration for the parent Event
//   - Prevent duplicate check-in
// - markLate(attendanceId, lateMinutes) → update isLate + lateMinutes
// - getAttendanceBySession(eventSessionId) → list with user info
// - getAttendanceByUser(userId, eventId) → list across all sessions
// - bulkCheckIn(eventSessionId, userIds[]) → batch manual check-in
```

**Step 2: Implement API route**

```typescript
// src/app/api/attendance/route.ts
// GET: list attendance by session (admin) or own (member)
// POST: check in (from venue QR scan or manual)
// PATCH: mark late
```

**Step 3: Commit**

```bash
git add src/services/attendance.service.ts src/app/api/attendance/
git commit -m "feat: add attendance service and API with check-in support"
```

---

## Task 11: Venue QR Code Check-in Page

**Files:**
- Create: `src/app/(public)/check-in/[sessionId]/page.tsx`

**Step 1: Create check-in page**

Flow:
1. User scans venue QR code → arrives at `/check-in/[sessionId]`
2. If not logged in → redirect to `/login?callbackUrl=/check-in/[sessionId]`
3. If logged in → show event name, session info, user's name
4. "確認報到" button → POST `/api/attendance` → show success with check-in time
5. If already checked in → show "您已報到" message

**Step 2: Verify check-in flow**

- Generate session QR in admin → scan (open URL) → login if needed → check in → success
- Try checking in again → shows already checked in

**Step 3: Commit**

```bash
git add src/app/\\(public\\)/check-in/
git commit -m "feat: add venue QR code check-in page"
```

---

## Task 12: Attendance Management — Admin UI

**Files:**
- Create: `src/app/(admin)/attendance/page.tsx`

**Step 1: Create attendance admin page**

- Event selector → Session selector (dropdown chain)
- Two tabs: "QR Code 報到" | "手動點名"
- QR Code tab: show the session's venue QR Code (large, printable)
- Manual tab: DataTable of registered users with checkbox for each
  - Columns: 姓名, 報到狀態 (已報到/未報到), 報到時間, 遲到
  - Checkbox to mark present → calls bulkCheckIn
  - "標記遲到" dropdown (20/30/40/60 minutes)
- Summary bar: 已報到 X / 已報名 Y 人

**Step 2: Verify manual check-in**

- Open attendance page → select event + session → check some users → verify Attendance records created

**Step 3: Commit**

```bash
git add src/app/\\(admin\\)/attendance/
git commit -m "feat: add attendance admin page with manual check-in and QR display"
```

---

## Task 13: User Management — Admin UI

**Files:**
- Create: `src/app/(admin)/users/page.tsx`
- Create: `src/app/api/users/route.ts`
- Create: `src/app/api/users/[userId]/route.ts`
- Create: `src/services/user.service.ts`

**Step 1: Implement user service**

```typescript
// src/services/user.service.ts
// Functions:
// - getUsers(filters?) → list all users
// - getUserById(id) → user detail with registration history
// - updateUserRole(id, role, teamId?, expiresAt?) → update role + optional team + expiry
// - toggleUserActive(id) → toggle isActive
```

**Step 2: Implement API routes**

```typescript
// src/app/api/users/route.ts
// GET: list users (requires ADMIN role)

// src/app/api/users/[userId]/route.ts
// GET: user detail
// PATCH: update role / toggle active (requires ADMIN role)
```

**Step 3: Create users admin page (ADMIN only)**

- DataTable: 姓名, Email, 電話, 角色 (badge), 狀態 (啟用/停用), 登入方式
- Click row → edit dialog:
  - Role dropdown
  - Team assignment (for TEAM_LEADER / STAFF_MEDIA)
  - Permission expiry date picker
  - Toggle active/inactive

**Step 4: Verify role management**

- As ADMIN → open users page → change a user's role to STAFF_ADMIN → verify that user now sees admin features

**Step 5: Commit**

```bash
git add src/app/\\(admin\\)/users/ src/app/api/users/ src/services/user.service.ts
git commit -m "feat: add user management with role assignment"
```

---

## Task 14: Seed Data & Final Integration

**Files:**
- Create: `prisma/seed.ts`

**Step 1: Create seed script**

```typescript
// prisma/seed.ts
// Create:
// - 1 ADMIN user (統籌者) with credentials
// - 1 STAFF_ADMIN user (行政同工)
// - 1 PASTOR user (傳道人)
// - 5 MEMBER users
// - 2 sample events (1 single, 1 series with 4 sessions)
// - Some registrations and attendance records
```

Add to `package.json`:

```json
{
  "prisma": {
    "seed": "npx tsx prisma/seed.ts"
  }
}
```

```bash
npm install -D tsx
npx prisma db seed
```

**Step 2: End-to-end walkthrough**

Verify all Phase 1 completion criteria:
- [ ] 一般會員可以透過帳密註冊/登入 (LINE Login after LINE console setup)
- [ ] 行政同工可以建立活動（含系列活動）
- [ ] 會員可以報名活動（從活動頁或掃 QR Code）
- [ ] 活動當天可以用手動點名或場地 QR Code 報到
- [ ] 傳道人可以登入查看報名名單與出席紀錄
- [ ] 統籌者可以管理帳號與角色權限

**Step 3: Commit**

```bash
git add prisma/seed.ts package.json
git commit -m "feat: add seed data and complete Phase 1 MVP integration"
```

---

## Summary

| Task | Description | Dependencies |
|------|-------------|--------------|
| 1 | Project scaffolding | None |
| 2 | Prisma schema & DB setup | Task 1 |
| 3 | NextAuth.js setup | Task 2 |
| 4 | RBAC authorization helpers | Task 1 |
| 5 | Event service & API | Tasks 2, 4 |
| 6 | Event admin UI | Tasks 3, 5 |
| 7 | Registration service & API | Tasks 2, 4 |
| 8 | Public event page & registration flow | Tasks 3, 7 |
| 9 | Registration admin UI | Tasks 6, 7 |
| 10 | Attendance service & API | Tasks 2, 7 |
| 11 | Venue QR Code check-in page | Tasks 3, 8, 10 |
| 12 | Attendance admin UI | Tasks 6, 10 |
| 13 | User management admin UI | Tasks 3, 4 |
| 14 | Seed data & integration test | All above |
