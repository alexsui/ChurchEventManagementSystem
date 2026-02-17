# 作業管理 (Assignment Management) — 設計文件

| 項目   | 內容                        |
| :----- | :-------------------------- |
| 版本號 | v1.0                        |
| 日期   | 2026-02-17                  |
| 狀態   | 已核准                      |
| 依據   | HLD v1.0 Phase 2            |

---

## 1. 功能範圍

Phase 2 簡化版作業管理：追蹤會員是否完成作業（勾選），不支援檔案上傳。

### 包含

- 管理者為每堂 (EventSession) 建立作業（可多筆，也可不建）
- 管理者批次勾選會員完成狀態
- 作業完成率計入結業條件

### 不包含

- 會員自行回報完成
- 檔案上傳 / 繳交
- 會員端作業列表頁面

---

## 2. 設計決策

| 決策                     | 選項                               | 結論               | 理由                                               |
| :----------------------- | :--------------------------------- | :----------------- | :------------------------------------------------- |
| 作業歸屬                 | Per Event / Per EventSession       | Per EventSession   | 符合 HLD 設計，支援逐堂追蹤                        |
| 每堂作業數量             | 單一 / 多筆                        | 多筆               | 彈性較大（如「讀經篇章」+「寫心得」）              |
| 是否每堂都必須有作業     | 強制 / 選擇性                      | 選擇性             | 有些堂次不需要作業                                 |
| 完成標記者               | 管理者 / 會員 / 兩者               | 僅管理者           | 簡化版，避免會員自行灌水                           |
| 結業條件                 | 包含 / 延後                        | 包含               | 一併實作，完成率 = 已完成數 / 作業總數             |
| 資料模型                 | 兩表 / JSON / 複用 Attendance      | 兩表               | 維持關聯完整性，符合現有 codebase pattern           |

---

## 3. 資料模型

### 3.1 新增 Model

```prisma
model Assignment {
  id             String   @id @default(cuid())
  eventSessionId String
  title          String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  eventSession EventSession          @relation(fields: [eventSessionId], references: [id], onDelete: Cascade)
  completions  AssignmentCompletion[]
}

model AssignmentCompletion {
  id            String   @id @default(cuid())
  assignmentId  String
  userId        String
  completedAt   DateTime @default(now())
  completedById String

  assignment  Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  user        User       @relation("assignmentCompletions", fields: [userId], references: [id], onDelete: Cascade)
  completedBy User       @relation("assignmentCompletedBy", fields: [completedById], references: [id], onDelete: Cascade)

  @@unique([assignmentId, userId])
}
```

### 3.2 修改 Event Model

新增欄位：

```prisma
model Event {
  // ... 現有欄位
  minAssignmentRate Float?  // 結業門檻，如 0.8 = 需完成 80% 作業
}
```

### 3.3 修改 User Model

新增 relation：

```prisma
model User {
  // ... 現有 relations
  assignmentCompletions  AssignmentCompletion[] @relation("assignmentCompletions")
  assignmentCompletedBy  AssignmentCompletion[] @relation("assignmentCompletedBy")
}
```

### 3.4 修改 EventSession Model

新增 relation：

```prisma
model EventSession {
  // ... 現有 relations
  assignments Assignment[]
}
```

### 3.5 完成率計算

```
完成率 = 該 User 在該 Event 下所有 AssignmentCompletion 數 / 該 Event 下所有 Assignment 總數
```

- 分母 = 所有 session 的 Assignment 加總（不含無作業的 session）
- 分子 = 該 user 有對應 AssignmentCompletion 的數量
- 若 Event 無任何 Assignment，完成率視為 100%（不阻擋結業）

---

## 4. Service Layer

**檔案**：`src/services/assignment.service.ts`

| 方法                                              | 說明                                     |
| :------------------------------------------------ | :--------------------------------------- |
| `createAssignment(eventSessionId, title)`          | 建立作業                                 |
| `deleteAssignment(id)`                             | 刪除作業（cascade 刪除所有完成紀錄）     |
| `getAssignmentsBySession(eventSessionId)`          | 取得該堂所有作業（含完成人數統計）       |
| `getAssignmentsByEvent(eventId)`                   | 取得該活動所有作業（跨 session）         |
| `markComplete(assignmentId, userIds[], adminId)`   | 批次標記完成                             |
| `removeCompletion(assignmentId, userId)`           | 取消完成標記                             |
| `getCompletionRate(userId, eventId)`               | 計算會員在該活動的作業完成率             |

---

## 5. API Routes

| Method | Route                                        | 權限            | 說明                       |
| :----- | :------------------------------------------- | :-------------- | :------------------------- |
| GET    | `/api/assignments?eventSessionId=`           | assignments:read  | 列出某堂的作業             |
| POST   | `/api/assignments`                           | assignments:write | 建立作業                   |
| DELETE | `/api/assignments/[id]`                      | assignments:write | 刪除作業                   |
| GET    | `/api/assignments/[id]/completions`          | assignments:read  | 列出完成名單               |
| POST   | `/api/assignments/[id]/completions`          | assignments:write | 批次標記完成 `{ userIds }` |
| DELETE | `/api/assignments/[id]/completions/[userId]` | assignments:write | 取消完成標記               |

所有 route 遵循現有 pattern：auth check → permission check → service call → response。

---

## 6. Admin UI

### 6.1 頁面

**路徑**：`/admin/assignments/page.tsx`

**流程**（與出席管理頁面一致）：

1. 選擇活動 → 選擇場次
2. 顯示該場次的作業列表（可新增/刪除作業）
3. 點選作業 → 顯示已報名會員的勾選清單
4. 批次勾選完成（如同出席管理的批次報到）

### 6.2 Navigation

在 admin layout 的 `navItems` 新增：

```ts
{ href: "/admin/assignments", label: "作業管理", icon: BookCheck, module: "assignments" }
```

### 6.3 Event 表單修改

在活動建立/編輯表單新增 `minAssignmentRate` 欄位（選填，百分比輸入）。

---

## 7. 權限

使用現有 RBAC 系統，module 名稱 `assignments` 已存在於 `authorization.ts` 的 Module type 中。

依 HLD 權限矩陣：

| 角色         | assignments |
| :----------- | :---------- |
| 統籌者       | 讀寫        |
| 行政同工     | 讀          |
| 其他角色     | 依設定      |
