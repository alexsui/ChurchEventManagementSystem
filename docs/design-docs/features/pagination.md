# API Pagination — Design Document

| Item    | Details                                                |
| :------ | :----------------------------------------------------- |
| Version | v1.0                                                   |
| Date    | 2026-03-21                                             |
| Status  | Approved                                               |
| Scope   | Offset-based pagination for users and events list APIs |

---

## 1. Problem

All list endpoints return every row in a single JSON array. As the church grows and
events accumulate, these unbounded responses will degrade performance and create
potential DoS vectors. Client-side filtering also breaks at scale because it only
operates on the data that was fetched.

## 2. Solution

Add offset-based pagination to `GET /api/users` and `GET /api/events`. Establish
a reusable pattern that can be applied to other endpoints later.

## 3. API Response Contract

All paginated endpoints return:

```json
{
  "data": [...],
  "total": 150,
  "page": 1,
  "limit": 40,
  "totalPages": 4
}
```

Query parameters:

| Param   | Default | Max | Description         |
| :------ | :------ | :-- | :------------------ |
| `page`  | 1       | —   | 1-based page number |
| `limit` | 40      | 100 | Items per page      |

Plus existing filter params:

- Users: `?search=`, `?role=`, `?isActive=`
- Events: `?status=`, `?type=`

When filters change, the client resets to page 1.

### Unpaginated mode

For components that need all records (e.g., event selector dropdowns):

```
GET /api/events?all=true
```

Returns a plain array (not the paginated wrapper), capped at 500 as a safety valve.
This avoids dropdown UIs silently truncating results.

## 4. Backend Changes

### Shared utility: `src/lib/pagination.ts`

Two functions:

- `parsePaginationParams(searchParams)` — extracts `page` and `limit` from URL
  search params, applies defaults (page=1, limit=40) and cap (limit max 100).
  Returns `{ page, limit, skip }` where `skip = (page - 1) * limit`.

- `paginatedResponse(data, total, page, limit)` — builds the standard response
  object with `data`, `total`, `page`, `limit`, `totalPages`.

### `GET /api/users`

- Service `getUsers(filters)` adds `skip` and `take` to the Prisma query.
- Service returns `{ users, total }` via `Promise.all([findMany, count])` with
  the same `where` clause.
- Route handler uses `parsePaginationParams` and `paginatedResponse`.
- Password sanitization stays in the route handler.

### `GET /api/events`

- Service `getEvents(filters)` adds `skip` and `take` to the Prisma query.
- Service returns `{ events, total }`.
- Route handler checks for `?all=true`: if set, returns plain array (capped at 500);
  otherwise returns paginated response.

## 5. Frontend Changes

### Shared pagination component: `src/components/ui/pagination.tsx`

A reusable component that renders page navigation:

```
< Previous  1  2  [3]  4  ...  8  Next >
```

Props: `page`, `totalPages`, `onPageChange`.

Shows ellipsis when there are many pages. Disables Previous on page 1, Next on
last page.

### Users page (`src/app/admin/users/page.tsx`)

- Remove `useMemo` client-side filtering by role and search.
- Add `page` state (default 1).
- Debounce search input (300ms).
- Fetch: `GET /api/users?page=${page}&limit=40&search=${search}&role=${role}`.
- Read response as `{ data, total, page, limit, totalPages }`.
- Render pagination component below the table.
- When search or role filter changes, reset page to 1.

### Events page

- Same pattern as users — server-side filters + pagination controls.
- Status and type filters sent as query params, reset page on change.

### Event selector (`src/components/admin/event-selector.tsx`)

- Fetch with `?all=true` to get all events as a plain array.
- No pagination UI needed — it's a dropdown.

## 6. Non-Goals

- Cursor-based pagination — not needed at this scale.
- Infinite scroll — admin tables use page navigation.
- Paginating other endpoints (registrations, attendance, budget, assignments,
  teams) — will use the same pattern later when needed.
