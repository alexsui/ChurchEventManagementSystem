# Overview Sub-tabs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a 總覽 (Overview) sub-tab as the default view in both the 出席 and 作業 tabs, showing per-user cross-session attendance rates and assignment completion rates.

**Architecture:** Two new service functions return cross-session aggregate data. Two new API routes expose them. Two new React overview components consume the APIs and render summary tables. The existing panel components gain outer sub-tabs (總覽 / 場次管理) wrapping the new overviews and existing per-session views. A shared `isSessionPast` helper determines N/A vs real data.

**Tech Stack:** Next.js App Router, Prisma, React (client components), shadcn/ui (Table, Tabs, Badge, Card)

---

### Task 1: Add `getAttendanceSummaryByEvent` service function

**Files:**

- Modify: `src/services/attendance.service.ts` (append new function)
- Modify: `src/services/attendance.service.test.ts` (add test + mock)

**Step 1: Add mock for the new query pattern**

In `src/services/attendance.service.test.ts`, the `mockPrisma` already has `attendance.findMany`. No mock changes needed.

**Step 2: Write the failing test**

Append to `src/services/attendance.service.test.ts`, inside the main `describe` block:

```typescript
describe("getAttendanceSummaryByEvent", () => {
  it("returns all attendance records across all sessions for an event", async () => {
    const mockRecords = [
      { userId: "user-1", eventSessionId: "ses-1" },
      { userId: "user-2", eventSessionId: "ses-1" },
      { userId: "user-1", eventSessionId: "ses-2" },
    ];

    mockPrisma.attendance.findMany.mockResolvedValue(mockRecords);

    const result = await getAttendanceSummaryByEvent("evt-1");

    expect(result).toEqual(mockRecords);
    expect(mockPrisma.attendance.findMany).toHaveBeenCalledWith({
      where: { eventSession: { eventId: "evt-1" } },
      select: { userId: true, eventSessionId: true },
    });
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npx vitest run src/services/attendance.service.test.ts`
Expected: FAIL — `getAttendanceSummaryByEvent` is not exported

**Step 4: Write minimal implementation**

Append to `src/services/attendance.service.ts`:

```typescript
/**
 * Get all attendance records (userId + eventSessionId) across all sessions for an event.
 * Used by the attendance overview to build a user × session matrix.
 */
export async function getAttendanceSummaryByEvent(eventId: string) {
  return prisma.attendance.findMany({
    where: { eventSession: { eventId } },
    select: { userId: true, eventSessionId: true },
  });
}
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run src/services/attendance.service.test.ts`
Expected: PASS — all tests pass

**Step 6: Commit**

```bash
git add src/services/attendance.service.ts src/services/attendance.service.test.ts
git commit -m "feat: add getAttendanceSummaryByEvent service function"
```

---

### Task 2: Add `GET /api/events/{eventId}/attendance-summary` API route

**Files:**

- Create: `src/app/api/events/[eventId]/attendance-summary/route.ts`

**Step 1: Create the API route**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import { getAttendanceSummaryByEvent } from "@/services/attendance.service";

type RouteParams = { params: Promise<{ eventId: string }> };

/**
 * GET /api/events/:eventId/attendance-summary
 * Returns all attendance records across all sessions (requires attendance:read).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const inactiveResponse = assertActive(session.user);
    if (inactiveResponse) return inactiveResponse;

    if (!(await hasPermission(session.user.role, "attendance", "read"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { eventId } = await params;
    const summary = await getAttendanceSummaryByEvent(eventId);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("GET /api/events/[eventId]/attendance-summary error:", error);
    return NextResponse.json({ error: "Failed to fetch attendance summary" }, { status: 500 });
  }
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/app/api/events/\[eventId\]/attendance-summary/route.ts
git commit -m "feat: add attendance summary API route"
```

---

### Task 3: Add `getAssignmentSummaryByEvent` service function

**Files:**

- Modify: `src/services/assignment.service.ts` (append new function)
- Modify: `src/services/assignment.service.test.ts` (add test + mock)

**Step 1: Update mock to include `assignmentCompletion` select query**

The `mockPrisma` in `assignment.service.test.ts` already has `assignmentCompletion.findMany`. No mock changes needed. However, `assignment.findMany` needs to support the new query with `include: { completions }`. Since it's the same `findMany` mock, just set the return value.

**Step 2: Write the failing test**

Append to `src/services/assignment.service.test.ts`, inside the main `describe` block:

```typescript
describe("getAssignmentSummaryByEvent", () => {
  it("returns all assignments with completion userIds grouped by session", async () => {
    const mockSessions = [{ id: "ses-1" }, { id: "ses-2" }];
    const mockAssignments = [
      {
        id: "asgn-1",
        eventSessionId: "ses-1",
        title: "HW 1",
        completions: [{ userId: "user-1" }, { userId: "user-2" }],
      },
      {
        id: "asgn-2",
        eventSessionId: "ses-2",
        title: "HW 2",
        completions: [{ userId: "user-1" }],
      },
    ];

    mockPrisma.eventSession.findMany.mockResolvedValue(mockSessions);
    mockPrisma.assignment.findMany.mockResolvedValue(mockAssignments);

    const result = await getAssignmentSummaryByEvent("evt-1");

    expect(result).toEqual(mockAssignments);
    expect(mockPrisma.eventSession.findMany).toHaveBeenCalledWith({
      where: { eventId: "evt-1" },
      select: { id: true },
    });
    expect(mockPrisma.assignment.findMany).toHaveBeenCalledWith({
      where: { eventSessionId: { in: ["ses-1", "ses-2"] } },
      include: {
        completions: { select: { userId: true } },
      },
      orderBy: { eventSession: { sessionNo: "asc" } },
    });
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npx vitest run src/services/assignment.service.test.ts`
Expected: FAIL — `getAssignmentSummaryByEvent` is not exported

**Step 4: Write minimal implementation**

Append to `src/services/assignment.service.ts`:

```typescript
/**
 * Get all assignments for an event with their completion userIds.
 * Used by the assignment overview to build a user × session matrix.
 */
export async function getAssignmentSummaryByEvent(eventId: string) {
  const sessions = await prisma.eventSession.findMany({
    where: { eventId },
    select: { id: true },
  });

  const sessionIds = sessions.map((s) => s.id);

  return prisma.assignment.findMany({
    where: { eventSessionId: { in: sessionIds } },
    include: {
      completions: { select: { userId: true } },
    },
    orderBy: { eventSession: { sessionNo: "asc" } },
  });
}
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run src/services/assignment.service.test.ts`
Expected: PASS — all tests pass

**Step 6: Commit**

```bash
git add src/services/assignment.service.ts src/services/assignment.service.test.ts
git commit -m "feat: add getAssignmentSummaryByEvent service function"
```

---

### Task 4: Add `GET /api/events/{eventId}/assignment-summary` API route

**Files:**

- Create: `src/app/api/events/[eventId]/assignment-summary/route.ts`

**Step 1: Create the API route**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, assertActive } from "@/lib/authorization";
import { getAssignmentSummaryByEvent } from "@/services/assignment.service";

type RouteParams = { params: Promise<{ eventId: string }> };

/**
 * GET /api/events/:eventId/assignment-summary
 * Returns all assignments with completions across all sessions (requires assignments:read).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const inactiveResponse = assertActive(session.user);
    if (inactiveResponse) return inactiveResponse;

    if (!(await hasPermission(session.user.role, "assignments", "read"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { eventId } = await params;
    const summary = await getAssignmentSummaryByEvent(eventId);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("GET /api/events/[eventId]/assignment-summary error:", error);
    return NextResponse.json({ error: "Failed to fetch assignment summary" }, { status: 500 });
  }
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/app/api/events/\[eventId\]/assignment-summary/route.ts
git commit -m "feat: add assignment summary API route"
```

---

### Task 5: Add shared `isSessionPast` helper

**Files:**

- Modify: `src/lib/utils.ts` (append helper)

**Step 1: Add the helper**

Append to `src/lib/utils.ts`:

```typescript
/**
 * Determine whether a session is in the past.
 * - If endTime exists: past when now >= sessionDate + endTime
 * - If no endTime: past when now >= sessionDate + 1 day
 */
export function isSessionPast(session: {
  sessionDate: string | Date;
  endTime?: string | null;
}): boolean {
  const now = new Date();
  const sessionDate = new Date(session.sessionDate);
  sessionDate.setHours(0, 0, 0, 0);

  if (session.endTime) {
    const [hours, minutes] = session.endTime.split(":").map(Number);
    const cutoff = new Date(sessionDate);
    cutoff.setHours(hours, minutes, 0, 0);
    return now >= cutoff;
  }

  const dayAfter = new Date(sessionDate);
  dayAfter.setDate(dayAfter.getDate() + 1);
  return now >= dayAfter;
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/lib/utils.ts
git commit -m "feat: add isSessionPast helper"
```

---

### Task 6: Create `AttendanceOverview` component and integrate into `AttendancePanel`

**Files:**

- Create: `src/components/admin/attendance-overview.tsx`
- Modify: `src/components/admin/attendance-panel.tsx`

**Step 1: Create `AttendanceOverview` component**

Create `src/components/admin/attendance-overview.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { isSessionPast } from "@/lib/utils";

interface EventSession {
  id: string;
  sessionNo: number;
  sessionDate: string;
  startTime: string;
  endTime: string;
  topic: string;
}

interface Registration {
  id: string;
  status: string;
  user: { id: string; name: string; phone: string };
}

interface AttendanceSummaryRecord {
  userId: string;
  eventSessionId: string;
}

interface AttendanceOverviewProps {
  eventId: string;
}

function formatSessionColumnHeader(session: EventSession): string {
  const date = new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(session.sessionDate));
  return `第${session.sessionNo}堂 (${date})`;
}

export function AttendanceOverview({ eventId }: AttendanceOverviewProps) {
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceSummaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [eventRes, regRes, attRes] = await Promise.all([
        fetch(`/api/events/${eventId}`),
        fetch(`/api/registrations?eventId=${eventId}`),
        fetch(`/api/events/${eventId}/attendance-summary`),
      ]);

      if (!eventRes.ok) throw new Error("無法取得活動資料");
      if (!regRes.ok) throw new Error("無法取得報名資料");
      if (!attRes.ok) throw new Error("無法取得出席摘要");

      const eventData = await eventRes.json();
      const regData: Registration[] = await regRes.json();
      const attData: AttendanceSummaryRecord[] = await attRes.json();

      setSessions(eventData.eventSessions ?? []);
      setRegistrations(regData.filter((r) => r.status === "REGISTERED"));
      setAttendanceRecords(attData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生未知錯誤");
      toast.error(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        <p className="text-muted-foreground">尚無報名資料</p>
      </div>
    );
  }

  // Build a Set for fast lookup: "userId:sessionId"
  const attendanceSet = new Set(attendanceRecords.map((r) => `${r.userId}:${r.eventSessionId}`));

  const allSessionsPast = sessions.every((s) => isSessionPast(s));

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-10">姓名</TableHead>
                {sessions.map((s) => (
                  <TableHead key={s.id} className="text-center whitespace-nowrap">
                    {formatSessionColumnHeader(s)}
                  </TableHead>
                ))}
                <TableHead className="text-right whitespace-nowrap">出席率</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.map((reg) => {
                let attendedCount = 0;
                let pastSessionCount = 0;

                const cells = sessions.map((s) => {
                  const past = isSessionPast(s);
                  if (!past) {
                    return { sessionId: s.id, display: "N/A", style: "text-muted-foreground" };
                  }
                  pastSessionCount++;
                  const attended = attendanceSet.has(`${reg.user.id}:${s.id}`);
                  if (attended) attendedCount++;
                  return {
                    sessionId: s.id,
                    display: attended ? "✓" : "✗",
                    style: attended
                      ? "text-green-600 dark:text-green-400 font-medium"
                      : "text-red-500 dark:text-red-400",
                  };
                });

                const rate =
                  allSessionsPast && pastSessionCount > 0
                    ? `${Math.round((attendedCount / pastSessionCount) * 100)}%`
                    : "N/A";

                return (
                  <TableRow key={reg.user.id}>
                    <TableCell className="sticky left-0 bg-background z-10 font-medium">
                      {reg.user.name}
                    </TableCell>
                    {cells.map((cell) => (
                      <TableCell key={cell.sessionId} className={`text-center ${cell.style}`}>
                        {cell.display}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-medium">
                      {rate === "N/A" ? (
                        <span className="text-muted-foreground">{rate}</span>
                      ) : (
                        rate
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Modify `AttendancePanel` to wrap with outer sub-tabs**

In `src/components/admin/attendance-panel.tsx`:

1. Add import at top:

```typescript
import { BarChart3 } from "lucide-react";
import { AttendanceOverview } from "@/components/admin/attendance-overview";
```

2. Wrap the entire return content in outer tabs. Replace the `return (...)` with:

```tsx
return (
  <Tabs defaultValue="overview">
    <TabsList>
      <TabsTrigger value="overview" className="gap-1.5">
        <BarChart3 className="size-4" />
        總覽
      </TabsTrigger>
      <TabsTrigger value="session-management" className="gap-1.5">
        <Users className="size-4" />
        場次管理
      </TabsTrigger>
    </TabsList>

    <TabsContent value="overview">
      <AttendanceOverview eventId={eventId} />
    </TabsContent>

    <TabsContent value="session-management">
      {/* Existing content goes here (the <div className="space-y-6"> block) */}
    </TabsContent>
  </Tabs>
);
```

Note: The existing content uses inner `<Tabs>` for QR/Manual. Since shadcn/ui Tabs are uncontrolled by default with `defaultValue`, nesting is fine as long as the `value` strings don't collide (they don't: outer uses "overview"/"session-management", inner uses "qrcode"/"manual").

**Step 3: Run type check and dev server**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 4: Commit**

```bash
git add src/components/admin/attendance-overview.tsx src/components/admin/attendance-panel.tsx
git commit -m "feat: add attendance overview sub-tab with cross-session summary table"
```

---

### Task 7: Create `AssignmentOverview` component and integrate into `AssignmentsPanel`

**Files:**

- Create: `src/components/admin/assignment-overview.tsx`
- Modify: `src/components/admin/assignments-panel.tsx`

**Step 1: Create `AssignmentOverview` component**

Create `src/components/admin/assignment-overview.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { isSessionPast } from "@/lib/utils";

interface EventSession {
  id: string;
  sessionNo: number;
  sessionDate: string;
  startTime: string;
  endTime: string;
  topic: string;
}

interface Registration {
  id: string;
  status: string;
  user: { id: string; name: string; phone: string };
}

interface AssignmentSummaryRecord {
  id: string;
  eventSessionId: string;
  title: string;
  completions: { userId: string }[];
}

interface AssignmentOverviewProps {
  eventId: string;
}

function formatSessionColumnHeader(session: EventSession): string {
  const date = new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(session.sessionDate));
  return `第${session.sessionNo}堂 (${date})`;
}

export function AssignmentOverview({ eventId }: AssignmentOverviewProps) {
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [assignments, setAssignments] = useState<AssignmentSummaryRecord[]>([]);
  const [minAssignmentRate, setMinAssignmentRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [eventRes, regRes, asgRes] = await Promise.all([
        fetch(`/api/events/${eventId}`),
        fetch(`/api/registrations?eventId=${eventId}`),
        fetch(`/api/events/${eventId}/assignment-summary`),
      ]);

      if (!eventRes.ok) throw new Error("無法取得活動資料");
      if (!regRes.ok) throw new Error("無法取得報名資料");
      if (!asgRes.ok) throw new Error("無法取得作業摘要");

      const eventData = await eventRes.json();
      const regData: Registration[] = await regRes.json();
      const asgData: AssignmentSummaryRecord[] = await asgRes.json();

      setSessions(eventData.eventSessions ?? []);
      setRegistrations(regData.filter((r) => r.status === "REGISTERED"));
      setAssignments(asgData);
      setMinAssignmentRate(
        eventData.minAssignmentRate != null ? eventData.minAssignmentRate : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生未知錯誤");
      toast.error(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        <p className="text-muted-foreground">尚無報名資料</p>
      </div>
    );
  }

  // Group assignments by sessionId
  const assignmentsBySession = new Map<string, AssignmentSummaryRecord[]>();
  for (const a of assignments) {
    const list = assignmentsBySession.get(a.eventSessionId) ?? [];
    list.push(a);
    assignmentsBySession.set(a.eventSessionId, list);
  }

  // Build completion lookup: Set of "userId:assignmentId"
  const completionSet = new Set<string>();
  for (const a of assignments) {
    for (const c of a.completions) {
      completionSet.add(`${c.userId}:${a.id}`);
    }
  }

  const allSessionsPast = sessions.every((s) => isSessionPast(s));

  // Check if any session that is past has N/A (future sessions) — actually we need
  // to check that ALL sessions are past (no N/A columns) for the final rate.
  // A past session with no assignments shows "—" and is skipped (not N/A).

  const showResult = minAssignmentRate != null;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-10">姓名</TableHead>
                {sessions.map((s) => (
                  <TableHead key={s.id} className="text-center whitespace-nowrap">
                    {formatSessionColumnHeader(s)}
                  </TableHead>
                ))}
                <TableHead className="text-right whitespace-nowrap">繳交率</TableHead>
                {showResult && (
                  <TableHead className="text-center whitespace-nowrap">結果</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.map((reg) => {
                let totalAssignments = 0;
                let totalCompleted = 0;
                let hasNonPastSession = false;

                const cells = sessions.map((s) => {
                  const past = isSessionPast(s);
                  if (!past) {
                    hasNonPastSession = true;
                    return { sessionId: s.id, display: "N/A", style: "text-muted-foreground" };
                  }

                  const sessionAssignments = assignmentsBySession.get(s.id);
                  if (!sessionAssignments || sessionAssignments.length === 0) {
                    // Past session, no assignments — dash, skipped
                    return { sessionId: s.id, display: "—", style: "text-muted-foreground" };
                  }

                  const total = sessionAssignments.length;
                  const completed = sessionAssignments.filter((a) =>
                    completionSet.has(`${reg.user.id}:${a.id}`)
                  ).length;

                  totalAssignments += total;
                  totalCompleted += completed;

                  const allDone = completed === total;
                  return {
                    sessionId: s.id,
                    display: `${completed}/${total}`,
                    style: allDone
                      ? "text-green-600 dark:text-green-400 font-medium"
                      : "text-amber-600 dark:text-amber-400",
                  };
                });

                const canShowRate = allSessionsPast && !hasNonPastSession;
                const rate =
                  canShowRate && totalAssignments > 0 ? totalCompleted / totalAssignments : null;
                const rateDisplay = rate != null ? `${Math.round(rate * 100)}%` : "N/A";

                const passed =
                  rate != null && minAssignmentRate != null ? rate >= minAssignmentRate : null;

                return (
                  <TableRow key={reg.user.id}>
                    <TableCell className="sticky left-0 bg-background z-10 font-medium">
                      {reg.user.name}
                    </TableCell>
                    {cells.map((cell) => (
                      <TableCell key={cell.sessionId} className={`text-center ${cell.style}`}>
                        {cell.display}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-medium">
                      {rate != null ? (
                        rateDisplay
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    {showResult && (
                      <TableCell className="text-center">
                        {passed == null ? (
                          <span className="text-muted-foreground">N/A</span>
                        ) : passed ? (
                          <Badge
                            variant="secondary"
                            className={cn(
                              "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            )}
                          >
                            通過
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className={cn(
                              "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                            )}
                          >
                            未通過
                          </Badge>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Modify `AssignmentsPanel` to wrap with outer sub-tabs**

In `src/components/admin/assignments-panel.tsx`:

1. Add imports at top:

```typescript
import { BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssignmentOverview } from "@/components/admin/assignment-overview";
```

2. Wrap the entire return content in outer tabs. Replace the `return (...)` with:

```tsx
return (
  <Tabs defaultValue="overview">
    <TabsList>
      <TabsTrigger value="overview" className="gap-1.5">
        <BarChart3 className="size-4" />
        總覽
      </TabsTrigger>
      <TabsTrigger value="session-management" className="gap-1.5">
        <BookCheck className="size-4" />
        場次管理
      </TabsTrigger>
    </TabsList>

    <TabsContent value="overview">
      <AssignmentOverview eventId={eventId} />
    </TabsContent>

    <TabsContent value="session-management">
      {/* Existing content goes here (the <div className="space-y-6"> block) */}
    </TabsContent>
  </Tabs>
);
```

**Step 3: Run type check and dev server**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 4: Commit**

```bash
git add src/components/admin/assignment-overview.tsx src/components/admin/assignments-panel.tsx
git commit -m "feat: add assignment overview sub-tab with cross-session completion table"
```

---

### Task 8: Final verification

**Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: all tests pass

**Step 3: Manual verification in browser**

1. Navigate to an event detail page → 出席 tab
   - Default view should be 總覽 showing user × session attendance matrix
   - Click 場次管理 to see existing QR code + manual check-in
2. Navigate to 作業 tab
   - Default view should be 總覽 showing user × session assignment completion matrix
   - Click 場次管理 to see existing per-session assignment management
3. Verify N/A shows for future sessions
4. Verify "—" shows for past sessions with no assignments
5. Verify 繳交率 and 結果 show N/A when any session is still in the future
