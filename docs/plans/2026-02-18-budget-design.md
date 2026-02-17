# 預算與總務 (Budget Management) Design

| 項目   | 內容                     |
| :----- | :----------------------- |
| 版本號 | v1.0                     |
| 日期   | 2026-02-18               |
| 狀態   | 已核准                   |
| 依據   | PRD v1.0 Section 6.7     |

---

## 1. Overview

Add a Budget Management module to the church event management system. Each event can have multiple budget line items tracking estimated vs. actual spending across predefined categories. The module provides a simple flat structure — no approval workflows or audit trails.

**PRD Requirements Covered:**
- 活動預算編列（午晚餐／茶點／場佈／材料／設備等）
- 實際支出紀錄
- 預算 vs. 實際對比報表

---

## 2. Data Model

### BudgetItem

```prisma
model BudgetItem {
  id             String   @id @default(cuid())
  eventId        String
  category       String   // "MEAL" | "SNACK" | "VENUE" | "MATERIAL" | "EQUIPMENT" | "OTHER"
  customCategory String?  // Only used when category = "OTHER"
  estimated      Float    // Estimated amount (TWD)
  actual         Float    @default(0) // Actual amount (TWD)
  note           String?  // Optional note
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  event          Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
}
```

**Predefined Categories:**

| Value     | Label |
| :-------- | :---- |
| MEAL      | 午晚餐 |
| SNACK     | 茶點   |
| VENUE     | 場佈   |
| MATERIAL  | 材料   |
| EQUIPMENT | 設備   |
| OTHER     | 其他   |

When `category = "OTHER"`, `customCategory` stores the user-typed name.

**Relationship:** `Event 1:N BudgetItem` with cascade delete (deleting an event removes its budget items).

---

## 3. Service Layer

**File:** `src/services/budget.service.ts`

**Error Class:** `BudgetServiceError` with codes:
- `EVENT_NOT_FOUND`
- `BUDGET_ITEM_NOT_FOUND`

**Functions:**

| Function | Description |
| :------- | :---------- |
| `getBudgetItemsByEvent(eventId)` | List all budget items for an event, ordered by createdAt |
| `createBudgetItem(eventId, data)` | Create a new budget item. Validates event exists. |
| `updateBudgetItem(id, data)` | Update estimated/actual/note/category. Validates item exists. |
| `deleteBudgetItem(id)` | Delete a budget item. Validates item exists. |
| `getBudgetSummary(eventId)` | Returns `{ totalEstimated, totalActual, difference, executionRate }` |

---

## 4. API Routes

| Method | Path | Permission | Description |
| :----- | :--- | :--------- | :---------- |
| GET    | `/api/budget?eventId=xxx` | budget:read | List items + summary for an event |
| POST   | `/api/budget` | budget:write | Create a budget item |
| PATCH  | `/api/budget/[id]` | budget:write | Update a budget item |
| DELETE | `/api/budget/[id]` | budget:write | Delete a budget item |

**Response Patterns:**
- GET returns `{ items: BudgetItem[], summary: { totalEstimated, totalActual, difference, executionRate } }`
- POST returns the created item with status 201
- PATCH returns the updated item
- DELETE returns `{ success: true }`
- Errors follow existing pattern: `{ error: message, code: errorCode }` with appropriate HTTP status

---

## 5. Admin Page

**Route:** `/admin/budget`

**Layout:**
1. **Event selector** — dropdown to pick which event's budget to view/edit
2. **Budget table** — columns: 類別, 備註, 預估金額, 實際金額, 操作 (edit/delete)
3. **Summary row** — 預估總計, 實際總計, 差額, 執行率 (%)
4. **Add item button** — dialog to add a new budget item (category + estimated + actual + note)
5. **Edit** — dialog to edit an existing item

**Permission Gates:**
- `canRead` → can view the page and budget data
- `canWrite` → can see add/edit/delete buttons

**UI Components:** Card, Select, Table, Button, Dialog, Input (consistent with existing admin pages).

---

## 6. Permissions

The "budget" module is already reserved in `src/lib/authorization.ts`.

**Default role access per PRD:**

| Role | Access |
| :--- | :----- |
| ADMIN (統籌者) | Full access (automatic) |
| STAFF_GENERAL (總務同工) | Read + Write |
| STAFF_FINANCE (財務同工) | Read + Write |
| Others | No access (configurable by admin) |

**Integration points:**
- Add "budget" to `MODULES` array in roles permission page (`src/app/admin/users/roles/page.tsx`)
- Add nav item to admin layout (`src/app/admin/layout.tsx`)
- Seed default permissions for STAFF_GENERAL and STAFF_FINANCE

---

## 7. Navigation

Add to admin layout `navItems` array:

```typescript
{ href: "/admin/budget", label: "預算管理", icon: Wallet, module: "budget" }
```

Icon: `Wallet` from lucide-react. Position: after "作業管理", before "使用者管理".
