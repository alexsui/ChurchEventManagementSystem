# Role Permissions System Design

## Context

The current authorization system hardcodes a `ROLE_PERMISSIONS` map in `src/lib/authorization.ts`. The 統籌者 (ADMIN) cannot modify what each role can access without code changes. We need a dynamic, DB-backed permission system that ADMIN can configure through a UI.

Additionally, general members (MEMBER) have no way to view their own registration history, and the public-facing pages lack a navigation bar.

## Approach

**Approach A: DB-stored permissions with seed defaults** (selected)

- New `RolePermission` table stores per-role module/action permissions
- ADMIN role is excluded from the table — hardcoded to always have full access
- Seeded with current hardcoded defaults
- `hasPermission()` reads from DB with in-memory cache

## Design

### 1. Database Schema

New `RolePermission` model:

```prisma
model RolePermission {
  id      String  @id @default(cuid())
  role    Role
  module  String  // "events", "registrations", "attendance", "assignments", "users", "teams", "budget", "reports"
  action  String  // "read" or "write"
  allowed Boolean @default(false)

  @@unique([role, module, action])
}
```

- One row per (role, module, action) combination
- 7 non-ADMIN roles x 8 modules x 2 actions = 112 rows
- ADMIN is excluded — always full access
- Seeded via `prisma db seed` with current hardcoded defaults

### 2. Authorization Logic

Update `src/lib/authorization.ts`:

- `hasPermission(role, module, action)` becomes **async**
- ADMIN role: short-circuit return `true`
- Other roles: query `RolePermission` table
- **Caching**: module-level `Map<Role, { permissions, expiresAt }>` with 60s TTL
- Cache invalidated when permissions are updated via API
- All existing API routes (~6 files) updated to `await hasPermission()`

### 3. API Endpoints

**`GET /api/role-permissions`**
- Returns full permission matrix for all non-ADMIN roles
- Requires `users:read` permission
- Response: `{ [role]: { [module]: { read: boolean, write: boolean } } }`

**`PUT /api/role-permissions`**
- Bulk upsert of the full matrix in a transaction
- Requires `users:write` permission
- Invalidates permission cache after write
- Request body: same shape as GET response

### 4. Admin UI — `/admin/users/roles`

Sub-page under existing users management:

- Matrix table: rows = 7 non-ADMIN roles, columns = 8 modules
- Each cell has two checkboxes: read / write
- Write checked → read auto-checked (write implies read)
- "儲存" button for bulk save via `PUT /api/role-permissions`
- Toast on success/failure

**Role display names:**

| Role | Label |
|------|-------|
| STAFF_ADMIN | 行政同工 |
| STAFF_GENERAL | 總務同工 |
| STAFF_FINANCE | 財務同工 |
| PASTOR | 傳道人 |
| STAFF_MEDIA | 多媒體同工 |
| TEAM_LEADER | 組長 |
| MEMBER | 一般會員 |

**Module display names:**

| Module | Label |
|--------|-------|
| events | 活動管理 |
| registrations | 報名管理 |
| attendance | 出席管理 |
| assignments | 任務分配 |
| users | 使用者管理 |
| teams | 小組管理 |
| budget | 預算管理 |
| reports | 報表 |

### 5. Admin Navigation Enforcement

Update admin layout (`src/app/admin/layout.tsx`):

- On mount, fetch permissions for current user's role
- Filter nav items by whether role has `read` permission for the associated module
- ADMIN always sees all tabs

| Nav Tab | Required Module |
|---------|----------------|
| 活動管理 | `events:read` |
| 報名管理 | `registrations:read` |
| 出席管理 | `attendance:read` |
| 使用者管理 | `users:read` |

Real enforcement remains at API level (403 on unauthorized API calls).

### 6. Public Navigation Bar

New `PublicNavbar` component in `(public)/layout.tsx`:

| Item | Route | Visibility |
|------|-------|-----------|
| 活動列表 | `/events` | Always |
| 我的報名紀錄 | `/my/registrations` | Logged in only |
| 登入 | `/login` | Not logged in |
| 登出 | (sign out action) | Logged in only |

Minimal horizontal bar, consistent with existing `bg-gray-50` theme.

### 7. Member Registration History — `/my/registrations`

- Server component under `(public)` route group (shares public nav)
- Requires authentication (redirect to `/login` if not logged in)
- Fetches current user's registrations via `registration.service.ts` (direct DB call)
- Card list showing: event title (link), status badge (已報名/候補中/已取消), registration date
- Empty state: "尚無報名紀錄"

## Non-Goals

- No role hierarchy / inheritance
- No temporal permission handling (`permissionExpiresAt` not used yet)
- No server-side page-level blocking in middleware (stays at API level)
- No per-user permission overrides (permissions are per-role only)
