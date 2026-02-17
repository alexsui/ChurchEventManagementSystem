# 教會活動管理系統 — 高階設計文件 (HLD)

Church Event Management System — High-Level Design

| 項目   | 內容               |
| :----- | :----------------- |
| 版本號 | v1.0               |
| 日期   | 2026-02-17         |
| 狀態   | 已核准             |
| 依據   | PRD v1.0           |

---

## 1. 技術選型總覽

| 層級       | 技術                          | 說明                                             |
| :--------- | :---------------------------- | :----------------------------------------------- |
| 前端       | Next.js (App Router) + React  | SSR/SSG + 客戶端互動                             |
| UI 元件    | shadcn/ui + Tailwind CSS      | 可客製元件庫                                     |
| 後端 API   | Next.js API Routes            | 同一專案內的 serverless API                      |
| ORM        | Prisma                        | 型別安全、自動 migration                         |
| 資料庫     | Supabase PostgreSQL           | 短期用 Supabase，未來可換任何 PostgreSQL          |
| 檔案儲存   | Supabase Storage              | 作業上傳，透過 presigned URL 直傳                |
| 認證       | NextAuth.js (Auth.js v5)      | LINE Login + 帳密（所有人皆可選擇）+ Prisma Adapter |
| QR Code    | `qrcode` npm 套件             | server-side 產生活動報名連結 QR + 每堂場地報到 QR |
| 部署       | Vercel                        | 一鍵部署 Next.js                                 |
| 語言       | TypeScript                    | 全專案統一                                       |
| UI 語系    | 繁體中文                      | 不做多語系                                       |

---

## 2. 系統架構圖

```
┌─────────────────────────────────────────────────┐
│                    Vercel                        │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │            Next.js App Router                │ │
│  │                                              │ │
│  │  ┌──────────────┐    ┌───────────────────┐  │ │
│  │  │   Pages      │    │   API Routes      │  │ │
│  │  │  (React +    │    │  /api/events      │  │ │
│  │  │   shadcn/ui) │───▶│  /api/registrations│  │ │
│  │  │              │    │  /api/attendance   │  │ │
│  │  │              │    │  /api/assignments  │  │ │
│  │  │              │    │  /api/users      │  │ │
│  │  │              │    │  /api/teams        │  │ │
│  │  │              │    │  /api/budget       │  │ │
│  │  │              │    │  /api/reports      │  │ │
│  │  │              │    │  /api/upload       │  │ │
│  │  └──────────────┘    └────────┬──────────┘  │ │
│  │                               │              │ │
│  │                    ┌──────────▼──────────┐   │ │
│  │                    │   Service Layer     │   │ │
│  │                    │  (業務邏輯)          │   │ │
│  │                    └──────────┬──────────┘   │ │
│  │                               │              │ │
│  │  ┌─────────────┐  ┌──────────▼──────────┐   │ │
│  │  │ NextAuth.js │  │   Prisma ORM        │   │ │
│  │  │ (認證)       │  │  (資料存取)          │   │ │
│  │  └──────┬──────┘  └──────────┬──────────┘   │ │
│  └─────────┼────────────────────┼──────────────┘ │
└────────────┼────────────────────┼────────────────┘
             │                    │
             ▼                    ▼
┌─────────────────────────────────────────────────┐
│               Supabase                           │
│                                                  │
│  ┌──────────────────┐  ┌─────────────────────┐  │
│  │   PostgreSQL     │  │   Storage           │  │
│  │  (所有資料表)     │  │  (作業檔案上傳)     │  │
│  └──────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**資料流說明：**

- 瀏覽器 → Next.js Pages（畫面）→ API Routes（薄層，只做 request/response 處理）→ Service Layer（業務邏輯）→ Prisma（DB 存取）
- 檔案上傳：瀏覽器 → API Route 取得 presigned URL → 瀏覽器直傳 Supabase Storage（不經過 server，繞過 4.5MB 限制）
- 認證：NextAuth.js 透過 Prisma Adapter 把 session/user 存在同一個 PostgreSQL

---

## 3. 專案目錄結構

```
church-event-management/
├── prisma/
│   ├── schema.prisma          # 資料庫 schema 定義
│   └── migrations/            # DB migration 檔案
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (public)/          # 登入前可存取的頁面（部分操作仍需登入）
│   │   │   ├── events/[eventId]/     # 活動詳情頁（公開可見，報名需登入）
│   │   │   ├── check-in/[sessionId]/  # QR Code 報到頁面（需登入，未登入會導向登入頁）
│   │   │   └── login/                # 登入頁（LINE Login + 帳密）
│   │   ├── (admin)/           # 需要登入的管理頁面
│   │   │   ├── events/        # 活動管理
│   │   │   ├── registrations/ # 報名管理
│   │   │   ├── attendance/    # 出席管理
│   │   │   ├── assignments/   # 作業管理
│   │   │   ├── users/         # 會員資料
│   │   │   ├── teams/         # 工作人員與分組
│   │   │   ├── budget/        # 預算與總務
│   │   │   └── reports/       # 統計與報表
│   │   ├── api/               # API Routes
│   │   │   ├── auth/          # NextAuth.js endpoints
│   │   │   ├── events/
│   │   │   ├── registrations/
│   │   │   ├── attendance/
│   │   │   ├── assignments/
│   │   │   ├── members/
│   │   │   ├── teams/
│   │   │   ├── budget/
│   │   │   ├── reports/
│   │   │   └── upload/
│   │   └── layout.tsx         # Root layout
│   ├── components/            # 共用 UI 元件 (shadcn/ui)
│   │   ├── ui/                # shadcn/ui 基礎元件
│   │   └── shared/            # 專案共用元件（DataTable、QRCode 等）
│   ├── services/              # 業務邏輯層（可搬走）
│   │   ├── event.service.ts
│   │   ├── registration.service.ts
│   │   ├── attendance.service.ts
│   │   ├── assignment.service.ts
│   │   ├── user.service.ts
│   │   ├── team.service.ts
│   │   ├── budget.service.ts
│   │   └── report.service.ts
│   ├── repositories/          # 資料存取層（Prisma 查詢封裝）
│   ├── lib/                   # 工具函式
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── auth.ts            # NextAuth 設定
│   │   ├── storage.ts         # 檔案儲存 adapter（可切換 Supabase/S3）
│   │   └── qrcode.ts          # QR Code 產生工具
│   └── types/                 # TypeScript 型別定義
├── public/                    # 靜態資源
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── .env.local                 # 環境變數（不進 git）
```

**關鍵設計決定：**

- `(public)` vs `(admin)` route group — `(public)` 放登入前可存取的頁面（活動詳情、登入頁、報到頁入口），部分操作會在頁面內導向登入；`(admin)` 用 middleware 統一攔截，未登入直接擋回
- `services/` 獨立於 `app/` — 業務邏輯不綁 Next.js，未來拆成獨立 API server 時整個資料夾搬走即可
- `lib/storage.ts` 抽象層 — 統一的檔案上傳介面，底層切換 Supabase Storage 或 S3 只改這個檔案

---

## 4. 認證與權限設計

### 4.1 認證流程

```
所有使用者登入（二擇一）：

  方式 A — LINE Login：
  瀏覽器 → /login 頁面 → 點「用 LINE 登入」→ LINE OAuth → JWT Session → 存 cookie

  方式 B — 帳號密碼：
  瀏覽器 → /login 頁面 → 輸入帳密 → 驗證 → JWT Session → 存 cookie

新人首次使用：
  瀏覽器 → /login 頁面 → LINE Login 或 註冊帳密 → 自動建立 User（預設 role: member）
```

- NextAuth.js 同時啟用 **Credentials Provider** 和 **LINE Login Provider**，所有使用者皆可自由選擇
- 登入方式與角色無關，角色由統籌者在後台指派
- LINE Login 首次登入時自動建立 User，免填註冊表單，降低門檻
- 所有報名操作都需要登入後才能進行

### 4.2 權限模型（RBAC）

每個使用者有一個角色，角色對應可存取的模組：

**模組說明：**

| 模組 | 說明 |
| :--- | :--- |
| events | 活動管理 — 建立／編輯／刪除活動、設定活動狀態、管理系列活動的每一堂 |
| registrations | 報名管理 — 查看／管理報名名單、報名狀態（已報名／取消／候補）、名額控管 |
| attendance | 出席管理 — 點名／報到紀錄、遲到標記、每堂出席追蹤 |
| assignments | 作業管理 — 每堂課的作業指派、繳交狀態追蹤、完成比例統計 |
| users | 會員資料 — 使用者個人資料、屬性標籤、參加歷史、牧養備註 |
| teams | 工作人員與分組 — 服事組別管理（影音／敬拜／破冰等）、任務指派、SOP 文件 |
| budget | 預算與總務 — 活動預算編列（餐飲／場佈／設備等）、實際支出、預算對比 |
| reports | 統計與報表 — 報名／出席統計儀表板、人數趨勢、會員參與度分析 |

**各角色權限矩陣：**

| 角色     | events | registrations | attendance | assignments | users  | teams    | budget | reports |
| :------- | :----- | :------------ | :--------- | :---------- | :----- | :------- | :----- | :------ |
| 統籌者     | 全部   | 全部          | 全部       | 全部        | 全部   | 全部     | 全部   | 全部    |
| 行政同工   | 讀寫   | 讀寫          | 讀寫       | 讀          | 讀     | 讀       | —      | 讀      |
| 總務同工   | 讀     | 讀（人數）    | —          | —           | —      | —        | 讀寫   | 讀      |
| 財務同工   | 讀     | 讀（人數）    | —          | —           | —      | —        | 讀寫   | 讀      |
| 傳道人     | 讀     | 讀            | 讀         | 讀          | 讀     | 讀       | —      | 讀      |
| 多媒體同工 | 讀     | —             | —          | —           | —      | 所屬組別 | —      | —       |
| 組長       | 讀     | 讀            | 讀         | 讀          | —      | 所屬組別 | —      | —       |
| 一般會員   | 讀（已報名） | 自己的  | 自己的     | 自己的      | 自己的 | —        | —      | —       |

### 4.3 組長特殊處理

- 組長只能存取**所屬組別**的資料（影音組長只看影音組）
- 權限由統籌者控管，支援**時間限定**：設定開始／結束日期，過期自動失效
- 實作方式：user 表上加 `role`、`team_id`、`permission_expires_at` 欄位

### 4.4 統籌者擔憂處理（PRD Q4）

- 所有管理端操作都需要登入 session，即使拿到 URL 也進不去
- 組長帳號設有效期限，活動結束後自動失效
- 統籌者可隨時在後台停用任何帳號

---

## 5. 資料庫核心 Entity 關聯

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    User      │     │    Event     │     │   Session    │
│ (所有使用者)  │     │   (活動)     │     │  (系列活動   │
│              │     │              │────▶│   的每一堂)  │
│ role         │     │ type:單場/系列│     │              │
│ team_id      │     │ status       │     │ session_date │
│ expires      │     │ reg_mode:    │     │ session_no   │
│ name         │     │  單場/整期    │     └──────┬───────┘
│ phone        │     └──────┬───────┘            │
│ age, gender  │            │                    │
│ area         │     ┌──────▼───────┐    ┌───────▼───────┐
│ referrer     │     │ Registration │    │  Attendance   │
│ source       │     │   (報名)     │    │   (出席)      │
│ tags[]       │     │              │    │               │
│ line_id      │     │ user_id      │    │ user_id       │
│ provider     │     │ event_id     │    │ session_id    │
└────┬─────────┘     │ status       │    │ is_late       │
     │               └──────────────┘    │ late_minutes  │
     │                                   └───────────────┘
     │
     │               ┌───────────────┐
     │               │  Assignment   │
     │               │   (作業)      │
     │               │               │
     │               │ session_id    │
     │               │ title         │
     │               └───────┬───────┘
     │                       │
     │               ┌───────▼───────┐
     │               │  Submission   │
     │               │  (作業繳交)    │
     │               │               │
     │               │ user_id       │
     │               │ file_url      │
     │               │ status        │
     │               └───────────────┘
     │
     │           ┌──────────────┐    ┌───────────────┐
     │           │    Team      │    │    Budget     │
     ├──────────▶│   (組別)     │    │   (預算)      │
     │           │              │    │               │
     │           │ name         │    │ event_id      │
     │           │ sop_files[]  │    │ category      │
     │           └──────┬───────┘    │ estimated     │
     │                  │            │ actual        │
     │           ┌──────▼───────┐    └───────────────┘
     │           │  TeamTask    │
     │           │  (組別任務)   │
     │           │              │
     │           │ assignee_id  │
     │           │ status       │
     │           └──────────────┘
```

### 核心 Entity 說明

| Entity       | 對應 PRD  | 關鍵設計                                                   |
| :----------- | :-------- | :--------------------------------------------------------- |
| **User**     | 4.1 + 6.6 | **統一的使用者表**（原 User + Member 合併）。`role` 區分管理者與一般會員；`provider` 記錄登入方式（credentials / line）；含個人資料、tags、LINE ID |
| Event        | 6.1       | `type` 區分單場/系列；系列活動下掛多個 Session             |
| Session      | 6.1       | 單場活動自動建一個 Session；系列活動建多個                  |
| Registration | 6.2       | 關聯 User + Event，`status` 追蹤報名/取消/候補             |
| Attendance   | 6.3       | 關聯 User + Session，含遲到標記與分鐘數                    |
| Assignment   | 6.4       | 掛在 Session 下，每堂課可指派作業                          |
| Submission   | 6.4       | 關聯 User + Assignment，`file_url` 指向 Storage            |
| Team         | 6.5       | 組別 + SOP 文件                                            |
| TeamTask     | 6.5       | 指派給 User（管理者角色），追蹤進度                        |
| Budget       | 6.7       | 每個 Event 可有多筆預算項目                                |

### 結業條件計算（PRD 6.3）

- 出席率 = 該 User 在該 Event 下所有 Session 的 Attendance 出席數 / Session 總數
- 作業完成率 = 該 User 的 Submission 數 / Assignment 總數
- 兩者門檻值存在 Event 上（`min_attendance_rate`、`min_assignment_rate`）

---

## 6. 關鍵流程設計

### 6.1 報名流程（需登入）

```
會員手機                        系統                          Supabase
  │                              │                              │
  │  掃描 QR Code / 點連結        │                              │
  │─────────────────────────────▶│                              │
  │  GET /events/[eventId]        │                              │
  │                              │                              │
  │◀──── 活動詳情頁面 ───────────│                              │
  │      (顯示「報名」按鈕)       │                              │
  │                              │                              │
  │  [未登入] 點擊報名            │                              │
  │─────────────────────────────▶│                              │
  │◀──── 導向 /login 頁面 ───────│                              │
  │                              │                              │
  │  LINE Login / 帳密登入        │                              │
  │─────────────────────────────▶│  NextAuth.js 驗證             │
  │                              │  (新用戶自動建立 User)        │
  │                              │─────────────────────────────▶│
  │◀──── 登入成功，導回活動頁 ───│                              │
  │                              │                              │
  │  [已登入] 點擊報名            │                              │
  │  POST /api/registrations     │                              │
  │─────────────────────────────▶│  建立 Registration 紀錄       │
  │                              │─────────────────────────────▶│
  │                              │                              │
  │◀──── 報名成功頁面 ───────────│                              │
  │      (顯示報名確認資訊)       │                              │
```

- 活動頁面本身公開可見（SEO + 分享），但報名動作需登入
- LINE Login 首次登入自動建立 User（role: member），免額外註冊步驟
- 報到方式為掃描場地 QR Code（見 Section 6.2），非個人 QR Code

### 6.2 QR Code 報到流程（場地 QR Code 模式）

**事前準備：** 管理者從後台進入活動 → 選擇某一堂 Session → 產生該堂的場地 QR Code → 列印或投影在入口

```
會員手機                         系統                          Supabase
  │                              │                              │
  │  掃描入口的場地 QR Code       │                              │
  │  (QR 內容 = check-in URL     │                              │
  │   含 sessionId)              │                              │
  │─────────────────────────────▶│                              │
  │  GET /check-in/[sessionId]   │                              │
  │                              │                              │
  │  [未登入] ──▶ 導向登入頁 ──▶ 登入後導回                      │
  │                              │                              │
  │  [已登入] 系統自動辨識身份    │                              │
  │  顯示「確認報到」按鈕         │                              │
  │                              │                              │
  │  點擊確認報到                 │                              │
  │  POST /api/attendance        │                              │
  │  { sessionId }  ← userId     │                              │
  │    從 session 取得            │                              │
  │─────────────────────────────▶│  建立 Attendance 紀錄         │
  │                              │─────────────────────────────▶│
  │                              │                              │
  │◀──── 報到成功頁面 ───────────│                              │
  │      (顯示姓名 + 報到時間)    │                              │
```

- 每堂 Session 有一組場地 QR Code，所有會員掃同一個
- 會員身份從登入 session 自動取得，不需額外輸入
- 管理者端另有**手動點名介面**：顯示該 Session 的報名名單，逐一勾選（作為備用）
- 兩種報到方式寫入同一個 Attendance 表

### 6.3 作業上傳流程

```
會員/管理者                      系統                       Supabase Storage
  │                              │                              │
  │  POST /api/upload            │                              │
  │  { assignmentId, fileName }  │                              │
  │─────────────────────────────▶│                              │
  │                              │  產生 presigned upload URL    │
  │                              │─────────────────────────────▶│
  │◀──── 回傳 presigned URL ─────│                              │
  │                              │                              │
  │  PUT 檔案直傳 Storage ────────────────────────────────────▶│
  │                              │                              │
  │  POST /api/assignments/submit│                              │
  │  { assignmentId, fileUrl }   │                              │
  │─────────────────────────────▶│  建立 Submission 紀錄        │
  │                              │─────────────────────────────▶│
```

- 檔案不經過 Vercel server（繞過 4.5MB 限制）
- `storage.ts` adapter 統一介面，換 S3 只改這個檔案

---

## 7. 部署與環境策略

### 7.1 環境分層

| 環境 | Branch | 部署位置                 | Supabase 專案   |
| :--- | :----- | :----------------------- | :-------------- |
| Dev  | `dev`  | Vercel Preview（自動）   | Supabase dev    |
| Prod | `main` | Vercel Production（自動）| Supabase prod   |

### 7.2 Git 開發流程

```
feature/xxx ──▶ dev ──▶ main
   開發功能        測試驗證     正式上線
```

- 平時開發在 feature branch，PR merge 到 `dev`
- `dev` 測試沒問題後，再 PR merge 到 `main` 上線
- Vercel 自動偵測 branch 部署

### 7.3 環境變數

```
DATABASE_URL=             # Supabase PostgreSQL 連線字串
DIRECT_URL=               # Prisma migration 用的直連 URL
NEXTAUTH_SECRET=          # NextAuth JWT 簽章密鑰
NEXTAUTH_URL=             # 網站 URL
SUPABASE_URL=             # Supabase 專案 URL
SUPABASE_SERVICE_KEY=     # Storage presigned URL 用（server-side only）
```

Vercel 後台可分別設定 Production 和 Preview 的環境變數，自動連到對應的 Supabase。

### 7.4 未來搬家路徑

| 現在                 | 未來（任一選項）                              | 改動範圍           |
| :------------------- | :-------------------------------------------- | :----------------- |
| Vercel               | 繼續用 / AWS / 任何 Node.js 平台              | 部署設定           |
| Supabase PostgreSQL  | AWS RDS / Neon / Railway / 自架 PostgreSQL     | 改 DATABASE_URL    |
| Supabase Storage     | AWS S3 / 任何 S3 相容儲存                     | 改 storage.ts      |

---

## 8. Phase 1 MVP 範圍與邊界

### 8.1 Phase 1 包含

| 模組       | 功能                                                                       | 對應 Entity             |
| :--------- | :------------------------------------------------------------------------- | :---------------------- |
| 活動管理   | 建立／編輯／刪除活動、支援單場＋系列活動、活動狀態管理                     | Event, Session          |
| 會員與認證 | LINE Login + 帳密登入、首次登入自動建立 User、RBAC 角色權限               | User                    |
| 報名管理   | 登入後報名、QR Code 分享、報名狀態追蹤、名額管理＋候補                     | Registration            |
| 出席管理   | 手動點名 + QR Code 報到、遲到標記、每堂出席紀錄                            | Attendance              |

### 8.2 Phase 1 不包含

| 延後項目                                         | 原因                                 |
| :----------------------------------------------- | :----------------------------------- |
| 作業管理 (Assignment, Submission)                | 需先有穩定的活動＋出席基礎           |
| 會員資料庫進階功能（標籤、自動分組、兒童營欄位） | Phase 1 的 User 只存基本欄位         |
| 工作人員分組與任務追蹤 (Team, TeamTask)          | 可先繼續用 LINE 群組協調             |
| 預算與總務 (Budget)                              | 可先繼續用 Excel                     |
| 統計報表 (Reports)                               | 需累積足夠資料才有意義               |
| 結業條件判定                                     | 依賴作業管理，延到 Phase 2           |

### 8.3 Phase 1 完成定義

- 一般會員可以透過 LINE Login 註冊/登入
- 行政同工可以在系統中建立活動（含系列活動）
- 會員登入後可以報名活動（掃 QR Code 或點連結進入活動頁）
- 活動當天可以用手動點名或 QR Code 掃描報到
- 傳道人可以登入查看報名名單與出席紀錄
- 統籌者可以管理帳號與權限
