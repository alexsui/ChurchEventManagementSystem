# Event Detail Page (Unified Event Workspace) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor 4 admin module pages into shared panel components, then integrate them as sub-tabs in the event detail page so admins can manage all aspects of a single event from one place.

**Architecture:** Extract the core UI+logic from each module page (registrations, attendance, assignments, budget) into standalone panel components that accept `eventId` as a prop. The existing standalone pages become thin wrappers with an event selector. The event detail page gains a tabbed interface rendering all 4 panels.

**Tech Stack:** Next.js App Router, React, shadcn/ui (Tabs, Select, Table, Dialog, etc.), TypeScript

---

### Task 1: Create shared EventSelector component

**Files:**
- Create: `src/components/admin/event-selector.tsx`

All 4 standalone module pages share the same pattern: fetch events from `/api/events`, display a Select dropdown. Extract this into a reusable component.

**Step 1: Create the EventSelector component**

```tsx
// src/components/admin/event-selector.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EventOption {
  id: string;
  title: string;
  _count?: {
    registrations?: number;
  };
}

interface EventSelectorProps {
  value: string;
  onChange: (eventId: string) => void;
  label?: string;
  showRegistrationCount?: boolean;
}

export function EventSelector({
  value,
  onChange,
  label = "選擇活動",
  showRegistrationCount = false,
}: EventSelectorProps) {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error("無法取得活動列表");
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生未知錯誤");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-sm space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={loading}>
        <SelectTrigger>
          <SelectValue placeholder={loading ? "載入中..." : "請選擇活動"} />
        </SelectTrigger>
        <SelectContent>
          {events.map((event) => (
            <SelectItem key={event.id} value={event.id}>
              {event.title}
              {showRegistrationCount && event._count?.registrations != null
                ? ` (${event._count.registrations} 人報名)`
                : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to event-selector.tsx

**Step 3: Commit**

```bash
git add src/components/admin/event-selector.tsx
git commit -m "feat: add shared EventSelector component"
```

---

### Task 2: Extract RegistrationsPanel and update standalone page

**Files:**
- Create: `src/components/admin/registrations-panel.tsx`
- Modify: `src/app/admin/registrations/page.tsx`

Extract all registration CRUD logic and UI into a panel component that accepts `eventId` as prop.

**Step 1: Create RegistrationsPanel**

The panel contains:
- All types: `Registration` interface
- All constants: `statusConfig`, `statusFilterOptions`, `formatDateTime`
- All state except event selection: `registrations`, `registrationsLoading`, `registrationsError`, `statusFilter`, `cancellingId`
- All logic: `fetchRegistrations`, `handleCancel`, `filteredRegistrations`
- All UI: status filter, registrations table, empty states

Key changes from original:
- Accept `eventId: string` prop instead of managing `selectedEventId` state
- Remove `EventItem` interface and event-fetching code
- `fetchRegistrations` uses the `eventId` prop directly
- `handleCancel` no longer calls `fetchEvents()` — it just re-fetches registrations

```tsx
// src/components/admin/registrations-panel.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAdminPermissions } from "@/contexts/admin-permissions";

interface Registration {
  id: string;
  status: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    phone: string;
  };
  eventSession: {
    sessionNo: number;
    sessionDate: string;
  };
}

const statusConfig: Record<string, { label: string; className: string }> = {
  REGISTERED: { label: "已報名", className: "bg-green-100 text-green-700" },
  WAITLISTED: { label: "候補", className: "bg-yellow-100 text-yellow-700" },
  CANCELLED: { label: "已取消", className: "bg-red-100 text-red-700" },
};

const statusFilterOptions = [
  { value: "ALL", label: "全部" },
  { value: "REGISTERED", label: "已報名" },
  { value: "WAITLISTED", label: "候補" },
  { value: "CANCELLED", label: "已取消" },
];

function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

interface RegistrationsPanelProps {
  eventId: string;
}

export function RegistrationsPanel({ eventId }: RegistrationsPanelProps) {
  const { canWrite } = useAdminPermissions("registrations");

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchRegistrations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/registrations?eventId=${eventId}`);
      if (!res.ok) throw new Error("無法取得報名資料");
      const data = await res.json();
      setRegistrations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生未知錯誤");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchRegistrations();
    setStatusFilter("ALL");
  }, [fetchRegistrations]);

  async function handleCancel(registrationId: string, userName: string) {
    const confirmed = window.confirm(`確定要取消 ${userName} 的報名嗎？`);
    if (!confirmed) return;

    try {
      setCancellingId(registrationId);
      const res = await fetch(`/api/registrations/${registrationId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("取消報名失敗");
      toast.success(`已取消 ${userName} 的報名`);
      fetchRegistrations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setCancellingId(null);
    }
  }

  const filteredRegistrations =
    statusFilter === "ALL"
      ? registrations
      : registrations.filter((r) => r.status === statusFilter);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-muted-foreground">載入中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (registrations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">此活動尚無報名資料</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>報名列表 ({filteredRegistrations.length} 筆)</CardTitle>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusFilterOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {filteredRegistrations.length === 0 ? (
          <div className="flex justify-center py-8">
            <p className="text-muted-foreground">無符合篩選條件的報名資料</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>電話</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>報名時間</TableHead>
                  {canWrite && (
                    <TableHead className="text-right">操作</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.map((reg) => {
                  const statusInfo = statusConfig[reg.status] ?? {
                    label: reg.status,
                    className: "",
                  };
                  return (
                    <TableRow key={reg.id}>
                      <TableCell className="font-medium">
                        {reg.user.name}
                      </TableCell>
                      <TableCell>{reg.user.phone}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn(statusInfo.className)}
                        >
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(reg.createdAt)}</TableCell>
                      {canWrite && (
                        <TableCell className="text-right">
                          {reg.status !== "CANCELLED" && (
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={cancellingId === reg.id}
                              onClick={() =>
                                handleCancel(reg.id, reg.user.name)
                              }
                            >
                              {cancellingId === reg.id
                                ? "取消中..."
                                : "取消報名"}
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Update the standalone registrations page to use the panel**

```tsx
// src/app/admin/registrations/page.tsx
"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EventSelector } from "@/components/admin/event-selector";
import { RegistrationsPanel } from "@/components/admin/registrations-panel";

export default function RegistrationsPage() {
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">報名管理</h1>
        <p className="text-muted-foreground text-sm">管理活動報名資料</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>選擇活動</CardTitle>
          <CardDescription>請選擇要查看報名資料的活動</CardDescription>
        </CardHeader>
        <CardContent>
          <EventSelector
            value={selectedEventId}
            onChange={setSelectedEventId}
            showRegistrationCount
          />
        </CardContent>
      </Card>

      {!selectedEventId ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">請選擇活動以查看報名資料</p>
        </div>
      ) : (
        <RegistrationsPanel eventId={selectedEventId} />
      )}
    </div>
  );
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/admin/registrations-panel.tsx src/app/admin/registrations/page.tsx
git commit -m "refactor: extract RegistrationsPanel from registrations page"
```

---

### Task 3: Extract AttendancePanel and update standalone page

**Files:**
- Create: `src/components/admin/attendance-panel.tsx`
- Modify: `src/app/admin/attendance/page.tsx`

The attendance page has event → session cascading selectors. The panel keeps the session selector (it's event-specific) but removes the event selector.

**Step 1: Create AttendancePanel**

Key changes from original:
- Accept `eventId: string` prop
- Remove `events`, `eventsLoading`, `eventsError`, `selectedEventId` state
- Remove `fetchEvents`
- `fetchSessions` now uses `eventId` prop
- Session selector stays inside the panel
- All QR code, attendance, and bulk check-in logic stays as-is

The component is the full contents of the original `AttendancePage` from line 118 to line 638, with event selection removed and `selectedEventId` replaced by the `eventId` prop. The page header and event selector card are removed. Everything from the session selector onwards stays.

**Step 2: Update the standalone attendance page**

Same thin-wrapper pattern as registrations:

```tsx
// src/app/admin/attendance/page.tsx
"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EventSelector } from "@/components/admin/event-selector";
import { AttendancePanel } from "@/components/admin/attendance-panel";

export default function AttendancePage() {
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">出席管理</h1>
        <p className="text-muted-foreground text-sm">管理活動出席報到紀錄</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>選擇活動</CardTitle>
          <CardDescription>請選擇要管理出席的活動</CardDescription>
        </CardHeader>
        <CardContent>
          <EventSelector value={selectedEventId} onChange={setSelectedEventId} />
        </CardContent>
      </Card>

      {!selectedEventId ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">請選擇活動以開始管理出席</p>
        </div>
      ) : (
        <AttendancePanel eventId={selectedEventId} />
      )}
    </div>
  );
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/components/admin/attendance-panel.tsx src/app/admin/attendance/page.tsx
git commit -m "refactor: extract AttendancePanel from attendance page"
```

---

### Task 4: Extract AssignmentsPanel and update standalone page

**Files:**
- Create: `src/components/admin/assignments-panel.tsx`
- Modify: `src/app/admin/assignments/page.tsx`

The assignments page has event → session → assignment cascading selectors plus a two-view system (list vs. completion detail). The panel keeps session + assignment selectors but removes the event selector.

**Step 1: Create AssignmentsPanel**

Key changes from original:
- Accept `eventId: string` prop
- Remove `events`, `eventsLoading`, `eventsError`, `selectedEventId` state
- Remove `fetchEvents`
- `fetchSessions` uses `eventId` prop
- The event-change handler in the session selector is removed (no more `setSelectedEventId`)
- All session selection, assignment CRUD, completion tracking stays as-is

**Step 2: Update the standalone assignments page**

Same thin-wrapper pattern.

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/components/admin/assignments-panel.tsx src/app/admin/assignments/page.tsx
git commit -m "refactor: extract AssignmentsPanel from assignments page"
```

---

### Task 5: Extract BudgetPanel and update standalone page

**Files:**
- Create: `src/components/admin/budget-panel.tsx`
- Modify: `src/app/admin/budget/page.tsx`

**Step 1: Create BudgetPanel**

Key changes from original:
- Accept `eventId: string` prop
- Remove event selection state and `fetchEvents`
- Remove the event selector Card
- `fetchBudget` uses `eventId` prop directly
- The "新增項目" button moves to the panel (it was in the event selector Card header)
- All dialog, delete, and table logic stays as-is
- Remove the `canRead` permission gate (the parent handles visibility)

**Step 2: Update the standalone budget page**

Same thin-wrapper pattern, but the standalone page keeps the `canRead` gate.

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/components/admin/budget-panel.tsx src/app/admin/budget/page.tsx
git commit -m "refactor: extract BudgetPanel from budget page"
```

---

### Task 6: Update event detail page with tabs

**Files:**
- Modify: `src/app/admin/events/[eventId]/page.tsx`

Add a tabbed interface to the existing event detail page. The existing content (event info, status management, sessions, teams) goes into the default "活動資訊" tab. The 4 panel components are imported and rendered in their respective tabs.

**Step 1: Update the event detail page**

Key changes:
- Import `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from shadcn
- Import all 4 panel components
- Import `useAdminPermissions` for each module's read permission
- Wrap the existing cards (event info, status management, sessions, teams) into a `TabsContent value="info"` block
- Add conditional tabs for each module based on permissions
- Keep the header (back button, title, badges, edit button) above the tabs

```tsx
// Added imports
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RegistrationsPanel } from "@/components/admin/registrations-panel";
import { AttendancePanel } from "@/components/admin/attendance-panel";
import { AssignmentsPanel } from "@/components/admin/assignments-panel";
import { BudgetPanel } from "@/components/admin/budget-panel";

// Inside the component, add permission checks:
const { canRead: canReadRegistrations } = useAdminPermissions("registrations");
const { canRead: canReadAttendance } = useAdminPermissions("attendance");
const { canRead: canReadAssignments } = useAdminPermissions("assignments");
const { canRead: canReadBudget } = useAdminPermissions("budget");

// Replace the existing stacked cards with:
<Tabs defaultValue="info">
  <TabsList>
    <TabsTrigger value="info">活動資訊</TabsTrigger>
    {canReadRegistrations && <TabsTrigger value="registrations">報名</TabsTrigger>}
    {canReadAttendance && <TabsTrigger value="attendance">出席</TabsTrigger>}
    {canReadAssignments && <TabsTrigger value="assignments">作業</TabsTrigger>}
    {canReadBudget && <TabsTrigger value="budget">預算</TabsTrigger>}
  </TabsList>
  <TabsContent value="info">
    {/* Existing event info, status, sessions, teams cards */}
  </TabsContent>
  {canReadRegistrations && (
    <TabsContent value="registrations">
      <RegistrationsPanel eventId={eventId} />
    </TabsContent>
  )}
  {canReadAttendance && (
    <TabsContent value="attendance">
      <AttendancePanel eventId={eventId} />
    </TabsContent>
  )}
  {canReadAssignments && (
    <TabsContent value="assignments">
      <AssignmentsPanel eventId={eventId} />
    </TabsContent>
  )}
  {canReadBudget && (
    <TabsContent value="budget">
      <BudgetPanel eventId={eventId} />
    </TabsContent>
  )}
</Tabs>
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/app/admin/events/[eventId]/page.tsx
git commit -m "feat: add module tabs to event detail page"
```

---

### Task 7: Final verification

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 2: Run tests**

Run: `npx vitest run`
Expected: All existing tests pass (no service/API changes were made)

**Step 3: Verify no regressions**

Check that:
- Standalone pages still render correctly with event selectors
- Event detail page shows tabs with correct permissions
- Each tab loads its data correctly
- No duplicate event selector in the tabbed view
