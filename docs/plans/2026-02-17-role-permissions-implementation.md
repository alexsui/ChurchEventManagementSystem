# Role Permissions System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hardcoded role permissions with a DB-backed, UI-configurable permission system, add a public navbar, and add a member registration history page.

**Architecture:** New `RolePermission` Prisma model stores per-role module/action permissions. `hasPermission()` becomes async, reads from DB with 60s in-memory cache. ADMIN always has full access (hardcoded). Admin UI at `/admin/users/roles` provides a matrix editor. Public pages get a shared navbar. `/my/registrations` shows member's registration history.

**Tech Stack:** Next.js 15 (App Router), Prisma 7, TypeScript, shadcn/ui, NextAuth

---

### Task 1: Add RolePermission model to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add the RolePermission model**

Add after the existing models in `prisma/schema.prisma`:

```prisma
model RolePermission {
  id      String  @id @default(cuid())
  role    Role
  module  String
  action  String
  allowed Boolean @default(false)

  @@unique([role, module, action])
}
```

**Step 2: Generate migration**

Run: `npx prisma migrate dev --name add_role_permission`
Expected: Migration created and applied successfully

**Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add RolePermission model to schema"
```

---

### Task 2: Seed RolePermission table with current defaults

**Files:**
- Modify: `prisma/seed.ts`
- Modify: `package.json` (add prisma.seed config if missing)

**Step 1: Add prisma.seed to package.json**

Add to `package.json` top-level:

```json
"prisma": {
  "seed": "npx tsx prisma/seed.ts"
}
```

**Step 2: Add RolePermission seed data to prisma/seed.ts**

Add at the end of the `main()` function, before the closing brace. This mirrors the current `ROLE_PERMISSIONS` from `authorization.ts`:

```typescript
// Seed RolePermission table
const modules = [
  "events", "registrations", "attendance", "assignments",
  "users", "teams", "budget", "reports",
] as const;
const actions = ["read", "write"] as const;

// Current default permissions (excluding ADMIN who always has full access)
const defaultPermissions: Record<string, Record<string, string[]>> = {
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

for (const [role, modulePerms] of Object.entries(defaultPermissions)) {
  for (const mod of modules) {
    for (const action of actions) {
      const allowed = modulePerms[mod]?.includes(action) ?? false;
      await prisma.rolePermission.upsert({
        where: {
          role_module_action: {
            role: role as any,
            module: mod,
            action,
          },
        },
        update: { allowed },
        create: {
          role: role as any,
          module: mod,
          action,
          allowed,
        },
      });
    }
  }
}

console.log("RolePermission seed complete");
```

**Step 3: Run seed**

Run: `npx prisma db seed`
Expected: Seed completes successfully, 112 rows in RolePermission table

**Step 4: Commit**

```bash
git add prisma/seed.ts package.json
git commit -m "feat: seed RolePermission table with default permissions"
```

---

### Task 3: Update authorization.ts — async hasPermission with DB + cache

**Files:**
- Modify: `src/lib/authorization.ts`

**Step 1: Write the failing test first (see Task 4)**

See Task 4 — write authorization tests before modifying the implementation.

**Step 2: Rewrite authorization.ts**

Replace `src/lib/authorization.ts` entirely:

```typescript
import { prisma } from "@/lib/prisma";

type Module =
  | "events"
  | "registrations"
  | "attendance"
  | "assignments"
  | "users"
  | "teams"
  | "budget"
  | "reports";

type Action = "read" | "write";

// In-memory cache: role -> { permissions map, expiry timestamp }
const cache = new Map<
  string,
  { permissions: Map<string, boolean>; expiresAt: number }
>();

const CACHE_TTL_MS = 60_000; // 60 seconds

function cacheKey(module: string, action: string): string {
  return `${module}:${action}`;
}

/**
 * Load permissions for a role from DB, with in-memory caching.
 */
async function getPermissionsForRole(
  role: string
): Promise<Map<string, boolean>> {
  const now = Date.now();
  const cached = cache.get(role);
  if (cached && cached.expiresAt > now) {
    return cached.permissions;
  }

  const rows = await prisma.rolePermission.findMany({
    where: { role: role as any },
  });

  const permissions = new Map<string, boolean>();
  for (const row of rows) {
    permissions.set(cacheKey(row.module, row.action), row.allowed);
  }

  cache.set(role, { permissions, expiresAt: now + CACHE_TTL_MS });
  return permissions;
}

/**
 * Check if a role has permission for a module/action.
 * ADMIN always has full access (not stored in DB).
 */
export async function hasPermission(
  role: string,
  module: Module,
  action: Action
): Promise<boolean> {
  if (role === "ADMIN") return true;

  const permissions = await getPermissionsForRole(role);
  return permissions.get(cacheKey(module, action)) ?? false;
}

/**
 * Invalidate the in-memory permission cache.
 * Call after updating permissions via API.
 */
export function invalidatePermissionCache(): void {
  cache.clear();
}

export type { Module, Action };
```

**Key changes:**
- `hasPermission` is now `async` returning `Promise<boolean>`
- ADMIN short-circuits to `true`
- Other roles read from DB with 60s cache
- `invalidatePermissionCache()` exported for use by the PUT API
- Removed `ROLE_PERMISSIONS` constant and its export

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: Type errors in all API routes that call `hasPermission` without `await` (this is expected — fixed in Task 5)

---

### Task 4: Update authorization tests

**Files:**
- Modify: `src/lib/authorization.test.ts`

**Step 1: Read the current test file to understand existing tests**

The current tests test the hardcoded `ROLE_PERMISSIONS` map. They need to be rewritten to test the async DB-backed version.

**Step 2: Rewrite the test file**

Replace `src/lib/authorization.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing
vi.mock("@/lib/prisma", () => ({
  prisma: {
    rolePermission: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { hasPermission, invalidatePermissionCache } from "@/lib/authorization";

const mockedPrisma = vi.mocked(prisma, true);

describe("Authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidatePermissionCache();
  });

  describe("hasPermission", () => {
    it("ADMIN always has full access without DB query", async () => {
      const result = await hasPermission("ADMIN", "events", "write");
      expect(result).toBe(true);
      expect(mockedPrisma.rolePermission.findMany).not.toHaveBeenCalled();
    });

    it("returns true when role has permission in DB", async () => {
      mockedPrisma.rolePermission.findMany.mockResolvedValue([
        { id: "1", role: "MEMBER" as any, module: "events", action: "read", allowed: true },
      ] as any);

      const result = await hasPermission("MEMBER", "events", "read");
      expect(result).toBe(true);
    });

    it("returns false when role has permission denied in DB", async () => {
      mockedPrisma.rolePermission.findMany.mockResolvedValue([
        { id: "1", role: "MEMBER" as any, module: "events", action: "write", allowed: false },
      ] as any);

      const result = await hasPermission("MEMBER", "events", "write");
      expect(result).toBe(false);
    });

    it("returns false when no permission row exists", async () => {
      mockedPrisma.rolePermission.findMany.mockResolvedValue([]);

      const result = await hasPermission("MEMBER", "users", "write");
      expect(result).toBe(false);
    });

    it("caches permissions and does not re-query within TTL", async () => {
      mockedPrisma.rolePermission.findMany.mockResolvedValue([
        { id: "1", role: "STAFF_ADMIN" as any, module: "events", action: "read", allowed: true },
      ] as any);

      await hasPermission("STAFF_ADMIN", "events", "read");
      await hasPermission("STAFF_ADMIN", "events", "read");

      expect(mockedPrisma.rolePermission.findMany).toHaveBeenCalledTimes(1);
    });

    it("invalidatePermissionCache forces re-query", async () => {
      mockedPrisma.rolePermission.findMany.mockResolvedValue([
        { id: "1", role: "PASTOR" as any, module: "events", action: "read", allowed: true },
      ] as any);

      await hasPermission("PASTOR", "events", "read");
      invalidatePermissionCache();
      await hasPermission("PASTOR", "events", "read");

      expect(mockedPrisma.rolePermission.findMany).toHaveBeenCalledTimes(2);
    });

    it("returns false for unknown role", async () => {
      mockedPrisma.rolePermission.findMany.mockResolvedValue([]);

      const result = await hasPermission("UNKNOWN_ROLE", "events", "read");
      expect(result).toBe(false);
    });
  });
});
```

**Step 3: Run tests**

Run: `npx vitest run src/lib/authorization.test.ts`
Expected: All 7 tests pass

**Step 4: Commit**

```bash
git add src/lib/authorization.ts src/lib/authorization.test.ts
git commit -m "feat: make hasPermission async with DB-backed permissions + cache"
```

---

### Task 5: Update all API routes to await hasPermission

**Files:**
- Modify: `src/app/api/events/route.ts` (1 call)
- Modify: `src/app/api/events/[eventId]/route.ts` (3 calls)
- Modify: `src/app/api/registrations/route.ts` (2 calls)
- Modify: `src/app/api/registrations/[registrationId]/route.ts` (1 call)
- Modify: `src/app/api/users/route.ts` (1 call)
- Modify: `src/app/api/users/[userId]/route.ts` (2 calls)
- Modify: `src/app/api/attendance/route.ts` (4 calls)
- Modify: `src/app/api/attendance/bulk/route.ts` (1 call)

**Step 1: Add `await` to every `hasPermission` call**

In every file above, change:
```typescript
if (!hasPermission(session.user.role, "module", "action"))
```
to:
```typescript
if (!(await hasPermission(session.user.role, "module", "action")))
```

And for assignment patterns:
```typescript
const isAdmin = hasPermission(session.user.role, "registrations", "write");
```
to:
```typescript
const isAdmin = await hasPermission(session.user.role, "registrations", "write");
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/app/api/
git commit -m "refactor: await async hasPermission in all API routes"
```

---

### Task 6: Create rolePermission service

**Files:**
- Create: `src/services/role-permission.service.ts`
- Create: `src/services/role-permission.service.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rolePermission: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/authorization", () => ({
  invalidatePermissionCache: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { invalidatePermissionCache } from "@/lib/authorization";
import {
  getAllRolePermissions,
  bulkUpdateRolePermissions,
} from "@/services/role-permission.service";

const mockedPrisma = vi.mocked(prisma, true);

describe("RolePermission Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAllRolePermissions", () => {
    it("returns permissions grouped by role, module, action", async () => {
      mockedPrisma.rolePermission.findMany.mockResolvedValue([
        { id: "1", role: "MEMBER" as any, module: "events", action: "read", allowed: true },
        { id: "2", role: "MEMBER" as any, module: "events", action: "write", allowed: false },
      ] as any);

      const result = await getAllRolePermissions();

      expect(result).toEqual({
        MEMBER: {
          events: { read: true, write: false },
        },
      });
    });
  });

  describe("bulkUpdateRolePermissions", () => {
    it("upserts permissions and invalidates cache", async () => {
      mockedPrisma.$transaction.mockResolvedValue(undefined as any);

      await bulkUpdateRolePermissions({
        MEMBER: {
          events: { read: true, write: false },
        },
      });

      expect(mockedPrisma.$transaction).toHaveBeenCalledOnce();
      expect(invalidatePermissionCache).toHaveBeenCalledOnce();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/role-permission.service.test.ts`
Expected: FAIL — module not found

**Step 3: Write the service**

Create `src/services/role-permission.service.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { invalidatePermissionCache } from "@/lib/authorization";

type PermissionMatrix = Record<
  string,
  Record<string, { read: boolean; write: boolean }>
>;

/**
 * Get all non-ADMIN role permissions, grouped by role > module > action.
 */
export async function getAllRolePermissions(): Promise<PermissionMatrix> {
  const rows = await prisma.rolePermission.findMany({
    where: { role: { not: "ADMIN" } },
    orderBy: [{ role: "asc" }, { module: "asc" }],
  });

  const result: PermissionMatrix = {};

  for (const row of rows) {
    const role = row.role as string;
    if (!result[role]) result[role] = {};
    if (!result[role][row.module]) {
      result[role][row.module] = { read: false, write: false };
    }
    if (row.action === "read") result[role][row.module].read = row.allowed;
    if (row.action === "write") result[role][row.module].write = row.allowed;
  }

  return result;
}

/**
 * Bulk update role permissions from a full matrix.
 * Upserts all entries in a transaction, then invalidates cache.
 */
export async function bulkUpdateRolePermissions(
  matrix: PermissionMatrix
): Promise<void> {
  const operations = [];

  for (const [role, modules] of Object.entries(matrix)) {
    for (const [module, actions] of Object.entries(modules)) {
      for (const [action, allowed] of Object.entries(actions)) {
        operations.push(
          prisma.rolePermission.upsert({
            where: {
              role_module_action: {
                role: role as any,
                module,
                action,
              },
            },
            update: { allowed },
            create: {
              role: role as any,
              module,
              action,
              allowed,
            },
          })
        );
      }
    }
  }

  await prisma.$transaction(operations);
  invalidatePermissionCache();
}
```

**Step 4: Run tests**

Run: `npx vitest run src/services/role-permission.service.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/services/role-permission.service.ts src/services/role-permission.service.test.ts
git commit -m "feat: add rolePermission service with getAllRolePermissions and bulkUpdate"
```

---

### Task 7: Create API routes for role permissions

**Files:**
- Create: `src/app/api/role-permissions/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import {
  getAllRolePermissions,
  bulkUpdateRolePermissions,
} from "@/services/role-permission.service";

/**
 * GET /api/role-permissions
 * Returns the full permission matrix for all non-ADMIN roles.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasPermission(session.user.role, "users", "read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const matrix = await getAllRolePermissions();
  return NextResponse.json(matrix);
}

/**
 * PUT /api/role-permissions
 * Bulk update all role permissions.
 */
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasPermission(session.user.role, "users", "write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const matrix = await request.json();
    await bulkUpdateRolePermissions(matrix);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/role-permissions/route.ts
git commit -m "feat: add GET/PUT /api/role-permissions endpoints"
```

---

### Task 8: Create role permissions admin UI

**Files:**
- Create: `src/app/admin/users/roles/page.tsx`

**Step 1: Create the roles management page**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ROLES = [
  { value: "STAFF_ADMIN", label: "行政同工" },
  { value: "STAFF_GENERAL", label: "總務同工" },
  { value: "STAFF_FINANCE", label: "財務同工" },
  { value: "PASTOR", label: "傳道人" },
  { value: "STAFF_MEDIA", label: "多媒體同工" },
  { value: "TEAM_LEADER", label: "組長" },
  { value: "MEMBER", label: "一般會員" },
] as const;

const MODULES = [
  { value: "events", label: "活動管理" },
  { value: "registrations", label: "報名管理" },
  { value: "attendance", label: "出席管理" },
  { value: "assignments", label: "任務分配" },
  { value: "users", label: "使用者管理" },
  { value: "teams", label: "小組管理" },
  { value: "budget", label: "預算管理" },
  { value: "reports", label: "報表" },
] as const;

type PermissionMatrix = Record<
  string,
  Record<string, { read: boolean; write: boolean }>
>;

export default function RolesPermissionPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [matrix, setMatrix] = useState<PermissionMatrix>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/role-permissions")
      .then((res) => {
        if (!res.ok) throw new Error("無法載入權限設定");
        return res.json();
      })
      .then(setMatrix)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (session?.user?.role !== "ADMIN") {
    return (
      <div className="flex justify-center py-12">
        <p className="text-muted-foreground">無權限存取此頁面</p>
      </div>
    );
  }

  function toggle(role: string, module: string, action: "read" | "write") {
    setMatrix((prev) => {
      const next = structuredClone(prev);
      if (!next[role]) next[role] = {};
      if (!next[role][module]) next[role][module] = { read: false, write: false };

      if (action === "write") {
        const newVal = !next[role][module].write;
        next[role][module].write = newVal;
        // write implies read
        if (newVal) next[role][module].read = true;
      } else {
        const newVal = !next[role][module].read;
        next[role][module].read = newVal;
        // unchecking read also unchecks write
        if (!newVal) next[role][module].write = false;
      }

      return next;
    });
  }

  function getPermission(
    role: string,
    module: string,
    action: "read" | "write"
  ): boolean {
    return matrix[role]?.[module]?.[action] ?? false;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/role-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(matrix),
      });
      if (!res.ok) throw new Error("儲存失敗");
      toast.success("權限設定已儲存");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-muted-foreground">載入中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/admin/users")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">角色權限設定</h1>
          <p className="text-sm text-muted-foreground">
            設定各角色對系統模組的存取權限（統籌者永遠擁有所有權限）
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>權限矩陣</CardTitle>
          <CardDescription>
            R = 讀取，W = 寫入。勾選寫入會自動勾選讀取。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background min-w-[120px]">
                    角色
                  </TableHead>
                  {MODULES.map((m) => (
                    <TableHead key={m.value} className="text-center min-w-[100px]">
                      {m.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ROLES.map((role) => (
                  <TableRow key={role.value}>
                    <TableCell className="sticky left-0 bg-background font-medium">
                      {role.label}
                    </TableCell>
                    {MODULES.map((mod) => (
                      <TableCell key={mod.value} className="text-center">
                        <div className="flex items-center justify-center gap-3">
                          <label className="flex items-center gap-1 text-xs">
                            <Checkbox
                              checked={getPermission(role.value, mod.value, "read")}
                              onCheckedChange={() =>
                                toggle(role.value, mod.value, "read")
                              }
                            />
                            R
                          </label>
                          <label className="flex items-center gap-1 text-xs">
                            <Checkbox
                              checked={getPermission(role.value, mod.value, "write")}
                              onCheckedChange={() =>
                                toggle(role.value, mod.value, "write")
                              }
                            />
                            W
                          </label>
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end mt-6">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "儲存中..." : "儲存設定"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Add a link from users page to roles page**

In `src/app/admin/users/page.tsx`, add a button/link at the top that navigates to `/admin/users/roles`. Only visible when the user is ADMIN. The exact modification depends on the current page structure — add a button next to the page title:

```tsx
<Button variant="outline" onClick={() => router.push("/admin/users/roles")}>
  角色權限設定
</Button>
```

**Step 3: Verify the Checkbox component exists**

Run: `ls src/components/ui/checkbox.tsx`
If missing, run: `npx shadcn@latest add checkbox`

**Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/app/admin/users/roles/page.tsx src/app/admin/users/page.tsx
git commit -m "feat: add role permissions matrix UI at /admin/users/roles"
```

---

### Task 9: Update admin layout — permission-driven navigation

**Files:**
- Modify: `src/app/admin/layout.tsx`

**Step 1: Update navItems to include module mapping**

Change the `NavItem` interface and `navItems` array:

```typescript
interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  module: string; // replaces adminOnly
}

const navItems: NavItem[] = [
  { href: "/admin/events", label: "活動管理", icon: CalendarDays, module: "events" },
  { href: "/admin/registrations", label: "報名管理", icon: ClipboardList, module: "registrations" },
  { href: "/admin/attendance", label: "出席管理", icon: UserCheck, module: "attendance" },
  { href: "/admin/users", label: "使用者管理", icon: Users, module: "users" },
];
```

**Step 2: Fetch permissions and filter nav**

In the `SidebarNav` component, fetch the user's permissions and filter:

```typescript
function SidebarNav({
  role,
  onNavigate,
}: {
  role?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [permissions, setPermissions] = useState<Record<string, { read: boolean; write: boolean }> | null>(null);

  useEffect(() => {
    if (role === "ADMIN") return; // ADMIN sees everything
    fetch("/api/role-permissions")
      .then((res) => res.json())
      .then((matrix) => {
        if (role && matrix[role]) {
          setPermissions(matrix[role]);
        }
      })
      .catch(() => {}); // silently fail, show nothing
  }, [role]);

  const visibleItems = navItems.filter((item) => {
    if (role === "ADMIN") return true;
    if (!permissions) return false;
    return permissions[item.module]?.read ?? false;
  });

  // ... rest of the render stays the same
}
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/admin/layout.tsx
git commit -m "feat: permission-driven admin navigation"
```

---

### Task 10: Create public navbar and layout

**Files:**
- Create: `src/components/shared/public-navbar.tsx`
- Create: `src/app/(public)/layout.tsx`

**Step 1: Create the PublicNavbar component**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PublicNavbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;

  return (
    <header className="border-b bg-white">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <nav className="flex items-center gap-4">
          <Link
            href="/events"
            className={cn(
              "text-sm font-medium transition-colors hover:text-foreground",
              pathname === "/events"
                ? "text-foreground"
                : "text-muted-foreground"
            )}
          >
            活動列表
          </Link>
          {isLoggedIn && (
            <Link
              href="/my/registrations"
              className={cn(
                "text-sm font-medium transition-colors hover:text-foreground",
                pathname === "/my/registrations"
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              我的報名紀錄
            </Link>
          )}
        </nav>

        <div>
          {isLoggedIn ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/events" })}
            >
              登出
            </Button>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">登入</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
```

**Step 2: Create the public layout**

Create `src/app/(public)/layout.tsx`:

```tsx
import { PublicNavbar } from "@/components/shared/public-navbar";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicNavbar />
      {children}
    </>
  );
}
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/shared/public-navbar.tsx src/app/\(public\)/layout.tsx
git commit -m "feat: add public navbar with login/logout and member nav"
```

---

### Task 11: Create member registration history page

**Files:**
- Create: `src/app/(public)/my/registrations/page.tsx`

**Step 1: Create the page**

Note: `getRegistrationsByUser(userId)` already exists in `src/services/registration.service.ts` (line 126-132). It returns registrations with `include: { event: true }`.

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getRegistrationsByUser } from "@/services/registration.service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    REGISTERED: "已報名",
    WAITLISTED: "候補中",
    CANCELLED: "已取消",
  };
  return map[status] ?? status;
}

function getStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    REGISTERED: "default",
    WAITLISTED: "secondary",
    CANCELLED: "destructive",
  };
  return map[status] ?? "outline";
}

export default async function MyRegistrationsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/my/registrations");
  }

  const registrations = await getRegistrationsByUser(session.user.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">我的報名紀錄</h1>
          <p className="text-muted-foreground mt-1">查看您報名過的活動</p>
        </div>

        {registrations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">尚無報名紀錄</p>
            </CardContent>
          </Card>
        ) : (
          registrations.map((reg) => (
            <Link
              key={reg.id}
              href={`/events/${reg.eventId}`}
              className="block"
            >
              <Card className="transition-colors hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <CardTitle className="text-lg">
                      {reg.event.title}
                    </CardTitle>
                    <Badge variant={getStatusVariant(reg.status)}>
                      {getStatusLabel(reg.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    報名日期：{formatDate(reg.createdAt)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors (may need to check the exact return type of `getRegistrationsByUser` to confirm `reg.event.title` is available)

**Step 3: Commit**

```bash
git add src/app/\(public\)/my/registrations/page.tsx
git commit -m "feat: add member registration history page at /my/registrations"
```

---

### Task 12: Final verification

**Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 2: All tests**

Run: `npx vitest run`
Expected: All tests pass (original 75 minus rewritten auth tests + new service tests)

**Step 3: Manual smoke test**

1. Visit `/` → redirects to `/events` → public navbar visible
2. Click "登入" → login → navbar shows "我的報名紀錄" and "登出"
3. Visit `/my/registrations` → shows registration history
4. Visit `/admin/users` → click "角色權限設定" → matrix loads
5. Toggle a permission → save → toast success
6. Check that admin nav respects permissions for non-ADMIN roles

**Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address issues found during smoke testing"
```
