# 工作人員分組與任務追蹤 — 設計文件

Staff Grouping & Task Tracking — Design Document

| 項目   | 內容                           |
| :----- | :----------------------------- |
| 版本號 | v1.0                           |
| 日期   | 2026-02-18                     |
| 狀態   | 已核准                         |
| 依據   | PRD v1.0 Section 6.5, HLD v1.0 |

---

## 1. 需求摘要

根據 PRD 6.5，系統需支援：

- 服事組別管理（行政組／總務組／影音組／信息組／敬拜組／破冰組／牧養組）
- 任務指派與進度追蹤
- 各組 SOP 文件儲存與共享

### 已確認的設計決策

| 決策項目 | 結論                                        |
| :------- | :------------------------------------------ |
| 組別範圍 | **每活動獨立組隊**，非全域常設              |
| 組別名稱 | **全域範本 + 可自定**，系統有預設範本可復用 |
| SOP 文件 | **連結引用**（貼外部 URL，不上傳檔案）      |
| 任務粒度 | **簡單任務清單**（標題 + 負責人 + 狀態）    |
| 多組成員 | **可以**，同一活動中一人可屬於多個組別      |

---

## 2. 資料模型

### 2.1 模型變更概覽

| 模型              | 操作 | 說明                                   |
| :---------------- | :--- | :------------------------------------- |
| `Team`            | 修改 | 轉為全域組別範本，移除 `users` 關聯    |
| `User`            | 修改 | 移除 `teamId` FK（不再有全域組別歸屬） |
| `EventTeam`       | 新增 | 活動級組別實例                         |
| `EventTeamMember` | 新增 | 組員多對多關聯表                       |
| `EventTeamTask`   | 新增 | 簡易任務清單                           |
| `Event`           | 修改 | 新增 `eventTeams` 關聯                 |

### 2.2 Schema 定義

```prisma
// 全域組別範本（影音組、敬拜組、破冰組等）
model Team {
  id        String   @id @default(cuid())
  name      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  eventTeams EventTeam[]
}

// 活動級組別實例
model EventTeam {
  id         String   @id @default(cuid())
  eventId    String
  teamId     String?          // FK to Team template（null = 自定名稱）
  customName String?          // teamId 為 null 時使用
  sopLinks   String[]         // SOP 外部連結 URL 陣列
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  event   Event  @relation(fields: [eventId], references: [id], onDelete: Cascade)
  team    Team?  @relation(fields: [teamId], references: [id])
  members EventTeamMember[]
  tasks   EventTeamTask[]

  @@unique([eventId, teamId])
}

// 組員多對多關聯（支援一人多組）
model EventTeamMember {
  id          String   @id @default(cuid())
  eventTeamId String
  userId      String
  role        String?          // 組內角色（如「組長」「組員」）
  createdAt   DateTime @default(now())

  eventTeam EventTeam @relation(fields: [eventTeamId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([eventTeamId, userId])
}

// 簡易任務
model EventTeamTask {
  id          String   @id @default(cuid())
  eventTeamId String
  title       String
  assigneeId  String?
  status      String   @default("PENDING")  // PENDING | IN_PROGRESS | COMPLETED
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  eventTeam EventTeam @relation(fields: [eventTeamId], references: [id], onDelete: Cascade)
  assignee  User?     @relation(fields: [assigneeId], references: [id])
}
```

### 2.3 User 模型變更

移除欄位：

- `teamId` — 不再需要全域組別歸屬
- `team` 關聯

新增關聯：

- `eventTeamMembers EventTeamMember[]`
- `eventTeamTasks EventTeamTask[]`

---

## 3. API 路由

### 3.1 組別範本（全域）

| Method | Route                 | 說明         | 權限        |
| :----- | :-------------------- | :----------- | :---------- |
| GET    | `/api/teams`          | 列出所有範本 | teams:read  |
| POST   | `/api/teams`          | 新增範本     | teams:write |
| PATCH  | `/api/teams/[teamId]` | 更新範本名稱 | teams:write |
| DELETE | `/api/teams/[teamId]` | 刪除範本     | teams:write |

### 3.2 活動組別

| Method | Route                                       | 說明                             | 權限        |
| :----- | :------------------------------------------ | :------------------------------- | :---------- |
| GET    | `/api/events/[eventId]/teams`               | 列出活動所有組別（含成員、任務） | teams:read  |
| POST   | `/api/events/[eventId]/teams`               | 新增組別到活動                   | teams:write |
| PATCH  | `/api/events/[eventId]/teams/[eventTeamId]` | 更新組別（SOP 連結等）           | teams:write |
| DELETE | `/api/events/[eventId]/teams/[eventTeamId]` | 移除活動組別                     | teams:write |

### 3.3 組員管理

| Method | Route                                                          | 說明     | 權限        |
| :----- | :------------------------------------------------------------- | :------- | :---------- |
| POST   | `/api/events/[eventId]/teams/[eventTeamId]/members`            | 新增組員 | teams:write |
| DELETE | `/api/events/[eventId]/teams/[eventTeamId]/members/[memberId]` | 移除組員 | teams:write |

### 3.4 任務管理

| Method | Route                                                      | 說明     | 權限        |
| :----- | :--------------------------------------------------------- | :------- | :---------- |
| GET    | `/api/events/[eventId]/teams/[eventTeamId]/tasks`          | 列出任務 | teams:read  |
| POST   | `/api/events/[eventId]/teams/[eventTeamId]/tasks`          | 新增任務 | teams:write |
| PATCH  | `/api/events/[eventId]/teams/[eventTeamId]/tasks/[taskId]` | 更新任務 | teams:write |
| DELETE | `/api/events/[eventId]/teams/[eventTeamId]/tasks/[taskId]` | 刪除任務 | teams:write |

### 3.5 權限控制

- ADMIN：全部存取
- 其他角色：依 `RolePermission` 表查詢 `teams` 模組權限
- TEAM_LEADER / STAFF_MEDIA：API 回應過濾為自己所屬組別（透過 `EventTeamMember` 查詢）

---

## 4. Service Layer

單一服務檔案 `team.service.ts`：

| 方法                                             | 說明                                       |
| :----------------------------------------------- | :----------------------------------------- |
| `getTeamTemplates()`                             | 取得所有全域範本                           |
| `createTeamTemplate(name)`                       | 新增範本                                   |
| `updateTeamTemplate(id, name)`                   | 更新範本名稱                               |
| `deleteTeamTemplate(id)`                         | 刪除範本                                   |
| `getEventTeams(eventId, userId?, role?)`         | 取得活動組別（含成員和任務），支援組長過濾 |
| `createEventTeam(eventId, teamId?, customName?)` | 新增活動組別                               |
| `updateEventTeam(eventTeamId, data)`             | 更新組別（SOP 連結等）                     |
| `deleteEventTeam(eventTeamId)`                   | 刪除活動組別                               |
| `addMember(eventTeamId, userId, role?)`          | 新增組員                                   |
| `removeMember(eventTeamId, userId)`              | 移除組員                                   |
| `getEventTeamTasks(eventTeamId)`                 | 取得任務列表                               |
| `createTask(eventTeamId, title, assigneeId?)`    | 新增任務                                   |
| `updateTask(taskId, data)`                       | 更新任務（狀態/指派）                      |
| `deleteTask(taskId)`                             | 刪除任務                                   |

---

## 5. Admin UI

### 5.1 頁面結構

#### `/admin/teams` — 組別範本管理

- 全域範本 CRUD 列表（類似 users 頁面）
- 新增、編輯名稱、刪除
- 導航列新增「組別管理」項目

#### `/admin/events/[eventId]` — 活動詳情頁新增「工作小組」tab

- 顯示該活動已分配的組別
- 「新增小組」：從範本選擇或自訂名稱
- 每個組別 card 包含：
  - 成員列表 + 新增/移除成員（user search picker）
  - SOP 連結列表 + 新增/移除
  - 任務清單 + 新增/編輯/刪除/狀態切換

### 5.2 UI 模式

| 元件     | 參考                 | 說明                       |
| :------- | :------------------- | :------------------------- |
| 範本列表 | `/admin/users`       | 表格 + 行內編輯            |
| 活動組別 | `/admin/assignments` | Card-based layout          |
| 成員選擇 | 新元件               | 搜尋 + 選擇使用者          |
| 任務清單 | `/admin/assignments` | Inline to-do + 狀態 toggle |
| SOP 連結 | 新元件               | URL input list             |

### 5.3 權限控制

- 根據 `useAdminPermissions` context 決定顯示/隱藏操作按鈕
- TEAM_LEADER/STAFF_MEDIA 只看到自己所屬的組別
- 無 teams:write 權限時隱藏所有編輯操作

---

## 6. Migration 注意事項

- 移除 `User.teamId` FK 和 `User.team` 關聯
- 現有 `Team` 資料保留，作為範本使用
- 需清除 User 上已有的 teamId 資料（如果有的話）
- 新增 `EventTeam`、`EventTeamMember`、`EventTeamTask` 三個表
