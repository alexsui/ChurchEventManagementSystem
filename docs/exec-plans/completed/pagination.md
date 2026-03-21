# Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add offset-based pagination to GET /api/users and GET /api/events, with server-side filtering and a reusable pagination UI component.

**Architecture:** A shared pagination utility handles param parsing and response building. Service functions accept skip/take and return {data, total}. Route handlers wire params to services and build paginated responses. Frontend components replace client-side filtering with server-side query params and render a shared pagination control.

**Tech Stack:** Next.js API routes, Prisma (skip/take/count), React, Tailwind CSS

**Spec:** `docs/design-docs/features/pagination.md`

---

## File Structure

| File                                        | Responsibility                                               |
| ------------------------------------------- | ------------------------------------------------------------ |
| `src/lib/pagination.ts`                     | Shared utility: parsePaginationParams, paginatedResponse     |
| `src/lib/pagination.test.ts`                | Unit tests for pagination utility                            |
| `src/components/ui/pagination-controls.tsx` | Reusable pagination UI (Previous / page numbers / Next)      |
| `src/services/user.service.ts`              | Modify getUsers to accept skip/take, return {users, total}   |
| `src/services/event.service.ts`             | Modify getEvents to accept skip/take, return {events, total} |
| `src/app/api/users/route.ts`                | Use parsePaginationParams, return paginatedResponse          |
| `src/app/api/events/route.ts`               | Support ?all=true (plain array) and paginated mode           |
| `src/app/admin/users/page.tsx`              | Server-side filters + pagination controls                    |
| `src/app/admin/events/page.tsx`             | Server-side filters + pagination controls                    |
| `src/components/admin/event-selector.tsx`   | Use ?all=true, read from response array                      |

---

### Task 1: Pagination Utility (`src/lib/pagination.ts`)

**Files:**

- Create: `src/lib/pagination.ts`
- Create: `src/lib/pagination.test.ts`

- [ ] **Step 1: Write failing tests for `parsePaginationParams`**

```typescript
import { describe, it, expect } from "vitest";
import { parsePaginationParams, paginatedResponse } from "./pagination";

describe("parsePaginationParams", () => {
  it("returns defaults when no params provided", () => {
    const params = new URLSearchParams();
    expect(parsePaginationParams(params)).toEqual({ page: 1, limit: 40, skip: 0 });
  });

  it("parses page and limit", () => {
    const params = new URLSearchParams({ page: "3", limit: "20" });
    expect(parsePaginationParams(params)).toEqual({ page: 3, limit: 20, skip: 40 });
  });

  it("caps limit at 100", () => {
    const params = new URLSearchParams({ limit: "999" });
    expect(parsePaginationParams(params)).toEqual({ page: 1, limit: 100, skip: 0 });
  });

  it("floors page at 1", () => {
    const params = new URLSearchParams({ page: "0" });
    expect(parsePaginationParams(params)).toEqual({ page: 1, limit: 40, skip: 0 });
  });

  it("handles non-numeric values as defaults", () => {
    const params = new URLSearchParams({ page: "abc", limit: "xyz" });
    expect(parsePaginationParams(params)).toEqual({ page: 1, limit: 40, skip: 0 });
  });
});

describe("paginatedResponse", () => {
  it("builds response with correct totalPages", () => {
    const result = paginatedResponse(["a", "b"], 50, 1, 40);
    expect(result).toEqual({ data: ["a", "b"], total: 50, page: 1, limit: 40, totalPages: 2 });
  });

  it("calculates totalPages correctly for exact division", () => {
    const result = paginatedResponse([], 80, 1, 40);
    expect(result.totalPages).toBe(2);
  });

  it("handles zero total", () => {
    const result = paginatedResponse([], 0, 1, 40);
    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 40, totalPages: 0 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/pagination.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement pagination utility**

```typescript
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

export function parsePaginationParams(searchParams: URLSearchParams) {
  let page = parseInt(searchParams.get("page") ?? "1", 10);
  let limit = parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  return { page, limit, skip: (page - 1) * limit };
}

export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  return {
    data,
    total,
    page,
    limit,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/pagination.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pagination.ts src/lib/pagination.test.ts
git commit -m "feat: add shared pagination utility"
```

---

### Task 2: Users Service + Route Pagination

**Files:**

- Modify: `src/services/user.service.ts` — getUsers function
- Modify: `src/app/api/users/route.ts` — GET handler

- [ ] **Step 1: Update getUsers to accept pagination and return {users, total}**

Modify `getUsers` in `src/services/user.service.ts` to:

- Add optional `skip` and `take` parameters to `GetUsersFilters`
- Run `prisma.user.findMany` with `skip` and `take`
- Run `prisma.user.count` with the same `where` clause
- Return `{ users, total }` instead of just `users[]`

```typescript
export interface GetUsersFilters {
  role?: Role;
  isActive?: boolean;
  search?: string;
  skip?: number;
  take?: number;
}

export async function getUsers(filters?: GetUsersFilters) {
  const where: Record<string, unknown> = {};
  // ... existing filter logic unchanged ...

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        /* existing select unchanged */
      },
      orderBy: { createdAt: "desc" },
      skip: filters?.skip,
      take: filters?.take,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total };
}
```

- [ ] **Step 2: Update the users route handler**

Modify `src/app/api/users/route.ts` GET handler to:

- Import `parsePaginationParams` and `paginatedResponse` from `@/lib/pagination`
- Extract page/limit from searchParams
- Pass skip/take to getUsers
- Return paginatedResponse instead of plain array

```typescript
import { parsePaginationParams, paginatedResponse } from "@/lib/pagination";

// In GET handler:
const { page, limit, skip } = parsePaginationParams(searchParams);
const { users, total } = await getUsers({ ...filters, skip, take: limit });

const sanitized = users.map(({ password, ...rest }) => ({
  ...rest,
  hasPassword: !!password,
}));

return NextResponse.json(paginatedResponse(sanitized, total, page, limit));
```

- [ ] **Step 3: Update existing user service tests**

The existing test for `getUsers` in `src/services/user.service.test.ts` (if any) needs to handle the new `{ users, total }` return shape. Update mocks to also mock `prisma.user.count`.

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/user.service.ts src/app/api/users/route.ts
git commit -m "feat: add pagination to GET /api/users"
```

---

### Task 3: Events Service + Route Pagination

**Files:**

- Modify: `src/services/event.service.ts` — getEvents function
- Modify: `src/app/api/events/route.ts` — GET handler
- Modify: `src/components/admin/event-selector.tsx` — use ?all=true

- [ ] **Step 1: Update getEvents to accept pagination and return {events, total}**

Modify `getEvents` in `src/services/event.service.ts`:

- Add optional `skip` and `take` to `EventFilters`
- Run findMany with skip/take and count with same where
- Return `{ events, total }` (events still gets the computeEffectiveStatus mapping)

- [ ] **Step 2: Update events route handler with ?all=true support**

```typescript
import { parsePaginationParams, paginatedResponse } from "@/lib/pagination";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all") === "true";

  // ... existing filter extraction ...

  if (all) {
    const { events } = await getEvents({ ...filters, take: 500 });
    return NextResponse.json(events);
  }

  const { page, limit, skip } = parsePaginationParams(searchParams);
  const { events, total } = await getEvents({ ...filters, skip, take: limit });
  return NextResponse.json(paginatedResponse(events, total, page, limit));
}
```

- [ ] **Step 3: Update EventSelector to use ?all=true**

In `src/components/admin/event-selector.tsx`, change:

```typescript
const res = await fetch("/api/events?all=true");
```

Response is still a plain array, no other changes needed.

- [ ] **Step 4: Run all tests and type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/services/event.service.ts src/app/api/events/route.ts src/components/admin/event-selector.tsx
git commit -m "feat: add pagination to GET /api/events with ?all=true bypass"
```

---

### Task 4: Pagination Controls Component

**Files:**

- Create: `src/components/ui/pagination-controls.tsx`

- [ ] **Step 1: Create the pagination component**

A client component that renders page navigation. Props:

```typescript
interface PaginationControlsProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}
```

Renders: `< 上一頁  1  2  [3]  4  ...  8  下一頁 >`

Logic:

- Show at most 5 page numbers around the current page
- Show first and last page always
- Use ellipsis (`...`) for gaps
- Disable "上一頁" on page 1, "下一頁" on last page
- Don't render anything if totalPages <= 1

Use existing Button component from `src/components/ui/button.tsx`.

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/pagination-controls.tsx
git commit -m "feat: add reusable pagination controls component"
```

---

### Task 5: Users Page — Server-Side Filters + Pagination UI

**Files:**

- Modify: `src/app/admin/users/page.tsx`

- [ ] **Step 1: Replace client-side filtering with server-side**

Key changes:

- Remove `useMemo` `filteredUsers` — no more client-side filtering
- Add `page` state (default 1), `total` state, `totalPages` state
- Update `fetchUsers` to build query params: `?page=${page}&limit=40&search=${search}&role=${role}`
- Read response as `{ data, total, page, limit, totalPages }` instead of plain array
- Set `users` from `response.data`
- Debounce search input with 300ms delay (useEffect + setTimeout)
- When `searchQuery` or `roleFilter` changes, reset `page` to 1
- Add `useEffect` that calls fetchUsers whenever `page`, `searchQuery`, or `roleFilter` changes

- [ ] **Step 2: Add pagination controls below the table**

Import `PaginationControls` and render below the table:

```tsx
<PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
```

Also show total count: `共 {total} 筆`

- [ ] **Step 3: Run all tests and type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/users/page.tsx
git commit -m "feat: add server-side pagination to users admin page"
```

---

### Task 6: Events Page — Server-Side Filters + Pagination UI

**Files:**

- Modify: `src/app/admin/events/page.tsx`

- [ ] **Step 1: Add filter controls and pagination state**

The events page currently has no filter UI — it fetches all events and renders them.

Add:

- `page` state (default 1), `total`, `totalPages`
- Optional: status filter dropdown (reuse eventStatusLabels from constants)
- Update `fetchEvents` to build: `?page=${page}&limit=40&status=${status}`
- Read response as `{ data, total, page, limit, totalPages }`
- Set `events` from `response.data`
- Reset page to 1 when filter changes

- [ ] **Step 2: Add pagination controls below the table**

Same pattern as users page — import and render PaginationControls.

- [ ] **Step 3: Run all tests and type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/events/page.tsx
git commit -m "feat: add server-side pagination to events admin page"
```

---

### Task 7: Verify and Clean Up

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: all tests PASS

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Update design doc status**

Change status from "Draft" to "Approved" in `docs/design-docs/features/pagination.md`.

- [ ] **Step 4: Final commit**

```bash
git add docs/design-docs/features/pagination.md
git commit -m "docs: mark pagination design as approved"
```

---

## Progress

- [x] Task 1: Pagination Utility
- [x] Task 2: Users Service + Route Pagination
- [x] Task 3: Events Service + Route Pagination
- [x] Task 4: Pagination Controls Component
- [x] Task 5: Users Page — Server-Side Filters + Pagination UI
- [x] Task 6: Events Page — Server-Side Filters + Pagination UI
- [x] Task 7: Verify and Clean Up

## Decision Log

| Date       | Decision                                  | Rationale                                                     |
| ---------- | ----------------------------------------- | ------------------------------------------------------------- |
| 2026-03-21 | Offset-based pagination over cursor-based | Admin tables need page number navigation, not infinite scroll |
| 2026-03-21 | Default 40, max 100                       | User preference; cap prevents abuse                           |
| 2026-03-21 | ?all=true bypass for dropdowns            | Avoids silently truncating event selector dropdown            |
| 2026-03-21 | Server-side filtering                     | Client-side filtering is incompatible with pagination         |
| 2026-03-21 | Start with users + events only            | Establish pattern first, apply to other endpoints later       |
