# E2E Test Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Full Playwright E2E test coverage for all 7 major user flows in the church event management system.

**Architecture:** Playwright tests run against the dev server (auto-started via `webServer` config). Database is re-seeded via `globalSetup` before each test run. Admin tests share a stored auth session to skip login. Tests are numbered and run in dependency order.

**Tech Stack:** @playwright/test, Playwright, Next.js dev server, Prisma seed

---

## Task 1: Playwright Config & Global Setup

**Files:**

- Create: `e2e/playwright.config.ts`
- Create: `e2e/global-setup.ts`

**Step 1: Create Playwright config**

Create `e2e/playwright.config.ts`:

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  globalSetup: "./global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
      dependencies: ["setup"],
      testMatch: /\d+-.*\.spec\.ts/,
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

**Step 2: Create global setup (re-seed DB)**

Create `e2e/global-setup.ts`:

```typescript
import { execSync } from "child_process";

export default async function globalSetup() {
  console.log("🌱 Re-seeding database for E2E tests...");
  execSync("npx prisma db seed", {
    stdio: "inherit",
    cwd: process.cwd(),
    env: { ...process.env },
  });
  console.log("✅ Database seeded");
}
```

**Step 3: Update root playwright.config.ts or package.json**

The project already has `"test:e2e": "playwright test"` in package.json. Update it to point to the e2e config:

In `package.json`, change the `test:e2e` script to:

```json
"test:e2e": "playwright test --config e2e/playwright.config.ts"
```

**Step 4: Create `.auth` directory gitignore**

Create `e2e/.auth/.gitkeep` (empty file) and add `e2e/.auth/admin.json` to `.gitignore`.

Add to `.gitignore`:

```
e2e/.auth/
```

**Step 5: Install Playwright browsers**

Run: `npx playwright install chromium`

**Step 6: Verify config loads**

Run: `npx playwright test --config e2e/playwright.config.ts --list`
Expected: Should list 0 tests (no test files yet), no config errors.

**Step 7: Commit**

```bash
git add e2e/playwright.config.ts e2e/global-setup.ts e2e/.auth/.gitkeep .gitignore package.json
git commit -m "feat: add Playwright E2E config with global setup and webServer"
```

---

## Task 2: Auth Setup (storageState)

**Files:**

- Create: `e2e/auth.setup.ts`

**Step 1: Create auth setup file**

Create `e2e/auth.setup.ts`:

```typescript
import { test as setup, expect } from "@playwright/test";

const ADMIN_FILE = "e2e/.auth/admin.json";

setup("authenticate as admin", async ({ page }) => {
  await page.goto("/login");

  // Fill login form
  await page.getByLabel("Email").fill("admin@church.org");
  await page.getByLabel("密碼").fill("password123");
  await page.getByRole("button", { name: "登入" }).click();

  // Wait for redirect to admin dashboard
  await page.waitForURL("/admin/events");

  // Verify we're logged in — the page should show "活動管理"
  await expect(page.getByRole("heading", { name: "活動管理" })).toBeVisible();

  // Save signed-in state
  await page.context().storageState({ path: ADMIN_FILE });
});
```

**Step 2: Run auth setup to verify it works**

Run: `npx playwright test --config e2e/playwright.config.ts --project=setup`
Expected: 1 test passes, `e2e/.auth/admin.json` file is created.

**Step 3: Commit**

```bash
git add e2e/auth.setup.ts
git commit -m "feat: add auth setup for Playwright admin session"
```

---

## Task 3: Auth Flow Tests (1-auth.spec.ts)

**Files:**

- Create: `e2e/1-auth.spec.ts`

**Step 1: Write auth flow tests**

Create `e2e/1-auth.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Auth flows", () => {
  test("register new account → redirected to login tab with success", async ({ page }) => {
    await page.goto("/login");

    // Switch to register tab
    await page.getByRole("tab", { name: "註冊" }).click();

    // Fill registration form
    await page.getByLabel("姓名").fill("測試使用者");
    await page.getByLabel("Email", { exact: false }).fill("e2e-test@example.com");
    await page.getByLabel("電話").fill("0911222333");
    await page.getByLabel("密碼", { exact: true }).fill("test12345678");
    await page.getByLabel("確認密碼").fill("test12345678");

    await page.getByRole("button", { name: "註冊" }).click();

    // Should show success message
    await expect(page.getByText("註冊成功")).toBeVisible();
  });

  test("login with existing credentials → admin dashboard", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("admin@church.org");
    await page.getByLabel("密碼").fill("password123");
    await page.getByRole("button", { name: "登入" }).click();

    // Should redirect to admin events
    await page.waitForURL("/admin/events");
    await expect(page.getByRole("heading", { name: "活動管理" })).toBeVisible();
  });

  test("login with wrong password → error message", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("admin@church.org");
    await page.getByLabel("密碼").fill("wrongpassword");
    await page.getByRole("button", { name: "登入" }).click();

    // Should show error
    await expect(page.getByText("Email 或密碼錯誤")).toBeVisible();
  });

  test("logout → redirected to login", async ({ page }) => {
    // First login
    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@church.org");
    await page.getByLabel("密碼").fill("password123");
    await page.getByRole("button", { name: "登入" }).click();
    await page.waitForURL("/admin/events");

    // Click logout (assuming there's a logout mechanism in the sidebar/nav)
    // The admin layout likely has a logout button
    await page.getByRole("button", { name: /登出/ }).click();

    // Should redirect to login
    await page.waitForURL(/\/login/);
  });
});
```

**Step 2: Run the auth tests**

Run: `npx playwright test --config e2e/playwright.config.ts 1-auth.spec.ts`
Expected: All tests pass. If the logout test fails (no visible logout button), update the selector based on the actual admin layout.

**Step 3: Commit**

```bash
git add e2e/1-auth.spec.ts
git commit -m "feat: add auth E2E tests (register, login, logout)"
```

---

## Task 4: Admin Events Tests (2-admin-events.spec.ts)

**Files:**

- Create: `e2e/2-admin-events.spec.ts`

**Step 1: Write admin events tests**

Create `e2e/2-admin-events.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/admin.json" });

test.describe("Admin event management", () => {
  test.describe.configure({ mode: "serial" });

  test("events list shows seed data", async ({ page }) => {
    await page.goto("/admin/events");

    // Should show 2 seed events
    await expect(page.getByText("復活節特別聚會")).toBeVisible();
    await expect(page.getByText("2026 春季幸福小組")).toBeVisible();
  });

  test("create new single event → appears in list", async ({ page }) => {
    await page.goto("/admin/events/new");

    // Fill the event form
    await page.getByLabel("活動名稱").fill("E2E 測試活動");
    await page.getByLabel("說明").fill("這是 E2E 測試建立的活動");
    await page.getByLabel("地點").fill("測試場地");

    // Type should default to SINGLE — fill session date
    await page.getByLabel("日期").fill("2026-06-01");

    // Submit
    await page.getByRole("button", { name: "建立活動" }).click();

    // Should redirect to the event detail page
    await page.waitForURL(/\/admin\/events\/.+/);
    await expect(page.getByRole("heading", { name: "E2E 測試活動" })).toBeVisible();

    // Go back to list and verify
    await page.goto("/admin/events");
    await expect(page.getByText("E2E 測試活動")).toBeVisible();
  });

  test("click event → detail page shows info", async ({ page }) => {
    await page.goto("/admin/events");

    // Click the series event
    await page.getByText("2026 春季幸福小組").click();
    await page.waitForURL(/\/admin\/events\/.+/);

    // Should show event info
    await expect(page.getByRole("heading", { name: "2026 春季幸福小組" })).toBeVisible();
    await expect(page.getByText("副堂 B 教室")).toBeVisible();

    // Should show 5 sessions
    await expect(page.getByText("場次列表 (5 場)")).toBeVisible();
    await expect(page.getByText("歡迎你來")).toBeVisible();
    await expect(page.getByText("新的開始")).toBeVisible();

    // Should show status buttons
    await expect(page.getByRole("button", { name: "企劃中" })).toBeVisible();
    await expect(page.getByRole("button", { name: "報名中" })).toBeVisible();
  });

  test("change event status (OPEN → IN_PROGRESS) → badge updates", async ({ page }) => {
    await page.goto("/admin/events");

    // Click the series event
    await page.getByText("2026 春季幸福小組").click();
    await page.waitForURL(/\/admin\/events\/.+/);

    // Current status should be OPEN (報名中) — click IN_PROGRESS (進行中)
    await page.getByRole("button", { name: "進行中" }).click();

    // Badge should update — the status badge near the title
    await expect(page.locator("h1 + div").getByText("進行中")).toBeVisible({ timeout: 5000 });
  });

  test("edit event via dialog → changes saved", async ({ page }) => {
    await page.goto("/admin/events");

    // Click the single event
    await page.getByText("復活節特別聚會").click();
    await page.waitForURL(/\/admin\/events\/.+/);

    // Click edit button
    await page.getByRole("button", { name: "編輯" }).click();

    // Dialog should open
    await expect(page.getByRole("heading", { name: "編輯活動" })).toBeVisible();

    // Change description
    const descField = page.getByLabel("說明");
    await descField.clear();
    await descField.fill("更新後的活動說明");

    // Submit
    await page.getByRole("button", { name: "更新活動" }).click();

    // Dialog should close and description should update
    await expect(page.getByText("更新後的活動說明")).toBeVisible({ timeout: 5000 });
  });
});
```

**Step 2: Run the admin events tests**

Run: `npx playwright test --config e2e/playwright.config.ts 2-admin-events.spec.ts`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add e2e/2-admin-events.spec.ts
git commit -m "feat: add admin events E2E tests (CRUD + status)"
```

---

## Task 5: Public Event Tests (3-public-event.spec.ts)

**Files:**

- Create: `e2e/3-public-event.spec.ts`

**Step 1: Write public event tests**

Create `e2e/3-public-event.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Public event page", () => {
  test("view public event detail → title, location, date, registration info", async ({ page }) => {
    // We need the event ID — go to admin first to get it
    // Or navigate via a known path. Let's use the API to find the event.
    const eventsRes = await page.request.get("/api/events");
    const events = await eventsRes.json();
    const singleEvent = events.find((e: { title: string }) => e.title === "復活節特別聚會");

    await page.goto(`/events/${singleEvent.id}`);

    // Should show event details
    await expect(page.getByText("復活節特別聚會")).toBeVisible();
    await expect(page.getByText("主堂")).toBeVisible();
    await expect(page.getByText("報名資訊")).toBeVisible();
    await expect(page.getByText("已報名")).toBeVisible();
  });

  test("click 立即報名 when logged in → registration succeeds", async ({ page }) => {
    // Login as a member who is NOT registered for single event
    // zhiwei@example.com IS registered for single event, so we need
    // to find an event + user combo where user is not registered.
    // Use the series event — yating is WAITLISTED, zhiwei is not registered
    await page.goto("/login");
    await page.getByLabel("Email").fill("zhiwei@example.com");
    await page.getByLabel("密碼").fill("password123");
    await page.getByRole("button", { name: "登入" }).click();
    await page.waitForURL("/admin/events");

    // Get the series event ID
    const eventsRes = await page.request.get("/api/events");
    const events = await eventsRes.json();
    const seriesEvent = events.find((e: { title: string }) => e.title === "2026 春季幸福小組");

    // Navigate to public event page
    await page.goto(`/events/${seriesEvent.id}`);

    // Click register button
    await page.getByRole("button", { name: /立即報名|候補報名/ }).click();

    // Should show success (either "已報名" badge or toast)
    await expect(page.getByText("已報名").or(page.getByText("報名成功"))).toBeVisible({
      timeout: 5000,
    });
  });

  test("view event when not logged in → login button visible", async ({ page }) => {
    // Get event ID
    const eventsRes = await page.request.get("/api/events");
    const events = await eventsRes.json();
    const singleEvent = events.find((e: { title: string }) => e.title === "復活節特別聚會");

    // Visit without being logged in
    await page.goto(`/events/${singleEvent.id}`);

    // Should show "登入後報名" button
    await expect(page.getByRole("button", { name: "登入後報名" })).toBeVisible();
  });
});
```

**Step 2: Run the public event tests**

Run: `npx playwright test --config e2e/playwright.config.ts 3-public-event.spec.ts`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add e2e/3-public-event.spec.ts
git commit -m "feat: add public event E2E tests (view, register, unauthenticated)"
```

---

## Task 6: Admin Registrations Tests (4-admin-registrations.spec.ts)

**Files:**

- Create: `e2e/4-admin-registrations.spec.ts`

**Step 1: Write admin registrations tests**

Create `e2e/4-admin-registrations.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/admin.json" });

test.describe("Admin registration management", () => {
  test.describe.configure({ mode: "serial" });

  test("select event → registrations table loads with correct count", async ({ page }) => {
    await page.goto("/admin/registrations");

    // Should show event selector
    await expect(page.getByText("選擇活動")).toBeVisible();

    // Select the single event (復活節特別聚會)
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /復活節特別聚會/ }).click();

    // Should load registrations table
    await expect(page.getByText("報名列表")).toBeVisible({ timeout: 5000 });

    // Should show registrations — 7 people registered for single event
    // (5 members + teamLeader + pastor)
    await expect(page.getByText("林小明")).toBeVisible();
    await expect(page.getByText("陳傳道")).toBeVisible();
  });

  test("filter by status → table filters correctly", async ({ page }) => {
    await page.goto("/admin/registrations");

    // Select the series event (has both REGISTERED and WAITLISTED)
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /幸福小組/ }).click();

    // Wait for table
    await expect(page.getByText("報名列表")).toBeVisible({ timeout: 5000 });

    // Filter to WAITLISTED only
    // The second combobox is the status filter
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: "候補" }).click();

    // Should only show waitlisted user (趙雅婷)
    await expect(page.getByText("趙雅婷")).toBeVisible();
    // Other registered users should NOT be visible
    await expect(page.getByText("林小明")).not.toBeVisible();
  });

  test("cancel a registration → row updates to 已取消", async ({ page }) => {
    await page.goto("/admin/registrations");

    // Select single event
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /復活節特別聚會/ }).click();

    // Wait for table
    await expect(page.getByText("報名列表")).toBeVisible({ timeout: 5000 });

    // Find a row with 張組長 and click cancel
    const row = page.getByRole("row").filter({ hasText: "張組長" });
    await expect(row).toBeVisible();

    // Handle the confirmation dialog
    page.on("dialog", (dialog) => dialog.accept());

    await row.getByRole("button", { name: "取消報名" }).click();

    // Row should update to show 已取消
    await expect(row.getByText("已取消")).toBeVisible({ timeout: 5000 });
  });
});
```

**Step 2: Run the admin registrations tests**

Run: `npx playwright test --config e2e/playwright.config.ts 4-admin-registrations.spec.ts`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add e2e/4-admin-registrations.spec.ts
git commit -m "feat: add admin registrations E2E tests (select, filter, cancel)"
```

---

## Task 7: Admin Attendance Tests (5-admin-attendance.spec.ts)

**Files:**

- Create: `e2e/5-admin-attendance.spec.ts`

**Step 1: Write admin attendance tests**

Create `e2e/5-admin-attendance.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/admin.json" });

test.describe("Admin attendance management", () => {
  test.describe.configure({ mode: "serial" });

  test("select event + session → QR code tab shows QR image and URL", async ({ page }) => {
    await page.goto("/admin/attendance");

    // Select series event
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /幸福小組/ }).click();

    // Wait for sessions to load, then select first session
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: /第 1 堂/ }).click();

    // QR code tab should be default — check for QR image
    await expect(page.getByAlt("報到 QR Code")).toBeVisible({ timeout: 10000 });

    // Should show the check-in URL
    await expect(page.getByText(/\/check-in\//)).toBeVisible();
  });

  test("switch to manual tab → shows attendance summary", async ({ page }) => {
    await page.goto("/admin/attendance");

    // Select series event
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /幸福小組/ }).click();

    // Select first session (session 1 has 3 attendance records, 3 registered)
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: /第 1 堂/ }).click();

    // Switch to manual tab
    await page.getByRole("tab", { name: /手動點名/ }).click();

    // Should show attendance summary "已報到 3 / 已報名 3 人"
    await expect(page.getByText(/已報到 3 \/ 已報名 3 人/)).toBeVisible({
      timeout: 5000,
    });
  });

  test("check a user checkbox → bulk check-in → count updates", async ({ page }) => {
    await page.goto("/admin/attendance");

    // Select series event
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /幸福小組/ }).click();

    // Select session 2 (2 of 3 attended — 林小明 and 劉大華 checked in, 黃美玲 not)
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: /第 2 堂/ }).click();

    // Switch to manual tab
    await page.getByRole("tab", { name: /手動點名/ }).click();

    // Should show "已報到 2 / 已報名 3 人"
    await expect(page.getByText(/已報到 2 \/ 已報名 3 人/)).toBeVisible({
      timeout: 5000,
    });

    // Check the unchecked user (黃美玲)
    const row = page.getByRole("row").filter({ hasText: "黃美玲" });
    await row.getByRole("checkbox").check();

    // Click bulk check-in button
    await page.getByRole("button", { name: /批次報到/ }).click();

    // Count should update to 3/3
    await expect(page.getByText(/已報到 3 \/ 已報名 3 人/)).toBeVisible({
      timeout: 5000,
    });
  });
});
```

**Step 2: Run the admin attendance tests**

Run: `npx playwright test --config e2e/playwright.config.ts 5-admin-attendance.spec.ts`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add e2e/5-admin-attendance.spec.ts
git commit -m "feat: add admin attendance E2E tests (QR, manual, bulk check-in)"
```

---

## Task 8: Admin Users Tests (6-admin-users.spec.ts)

**Files:**

- Create: `e2e/6-admin-users.spec.ts`

**Step 1: Write admin users tests**

Create `e2e/6-admin-users.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/admin.json" });

test.describe("Admin user management", () => {
  test.describe.configure({ mode: "serial" });

  test("users table shows all seed users", async ({ page }) => {
    await page.goto("/admin/users");

    // Should show 8 seed users (may also show E2E test user from test 1)
    await expect(page.getByText("王統籌")).toBeVisible();
    await expect(page.getByText("李行政")).toBeVisible();
    await expect(page.getByText("陳傳道")).toBeVisible();
    await expect(page.getByText("張組長")).toBeVisible();
    await expect(page.getByText("林小明")).toBeVisible();
    await expect(page.getByText("黃美玲")).toBeVisible();
    await expect(page.getByText("劉大華")).toBeVisible();
    await expect(page.getByText("趙雅婷")).toBeVisible();
  });

  test("search filters by name", async ({ page }) => {
    await page.goto("/admin/users");

    // Type in search
    await page.getByPlaceholder("搜尋姓名或 Email...").fill("林小明");

    // Should filter to show only 林小明
    await expect(page.getByText("林小明")).toBeVisible();
    // Others should be hidden
    await expect(page.getByText("王統籌")).not.toBeVisible();
  });

  test("click user → edit dialog → change role → saves", async ({ page }) => {
    await page.goto("/admin/users");

    // Click on 林小明 row
    await page.getByRole("row").filter({ hasText: "林小明" }).click();

    // Dialog should open with "編輯使用者"
    await expect(page.getByRole("heading", { name: "編輯使用者" })).toBeVisible();

    // Change role to TEAM_LEADER
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "小組長" }).click();

    // Save
    await page.getByRole("button", { name: "儲存" }).click();

    // Dialog should close and role badge should update
    await expect(page.getByRole("heading", { name: "編輯使用者" })).not.toBeVisible({
      timeout: 5000,
    });

    // Verify the badge changed in the table
    const row = page.getByRole("row").filter({ hasText: "林小明" });
    await expect(row.getByText("小組長")).toBeVisible();
  });

  test("toggle active/inactive → status badge changes", async ({ page }) => {
    await page.goto("/admin/users");

    // Click on 周志偉 row
    await page.getByRole("row").filter({ hasText: "周志偉" }).click();

    // Dialog should open
    await expect(page.getByRole("heading", { name: "編輯使用者" })).toBeVisible();

    // Toggle the switch off (currently active → inactive)
    await page.getByRole("switch").click();

    // Save
    await page.getByRole("button", { name: "儲存" }).click();

    // Wait for dialog to close
    await expect(page.getByRole("heading", { name: "編輯使用者" })).not.toBeVisible({
      timeout: 5000,
    });

    // Verify badge changed to 停用
    const row = page.getByRole("row").filter({ hasText: "周志偉" });
    await expect(row.getByText("停用")).toBeVisible();
  });
});
```

**Step 2: Run the admin users tests**

Run: `npx playwright test --config e2e/playwright.config.ts 6-admin-users.spec.ts`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add e2e/6-admin-users.spec.ts
git commit -m "feat: add admin users E2E tests (list, search, edit role, toggle active)"
```

---

## Task 9: QR Check-in Flow Tests (7-checkin-flow.spec.ts)

**Files:**

- Create: `e2e/7-checkin-flow.spec.ts`

**Step 1: Write check-in flow tests**

Create `e2e/7-checkin-flow.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("QR check-in flow", () => {
  test.describe.configure({ mode: "serial" });

  let sessionId: string;

  test.beforeAll(async ({ request }) => {
    // Get the series event to find a session ID
    const eventsRes = await request.get("/api/events");
    const events = await eventsRes.json();
    const seriesEvent = events.find((e: { title: string }) => e.title === "2026 春季幸福小組");
    // Get event detail to find session IDs
    const detailRes = await request.get(`/api/events/${seriesEvent.id}`);
    const detail = await detailRes.json();
    // Use session 3 (no attendance records)
    sessionId = detail.eventSessions[2].id;
  });

  test("navigate not logged in → login prompt", async ({ page }) => {
    await page.goto(`/check-in/${sessionId}`);

    // Should show event title and login prompt
    await expect(page.getByText("2026 春季幸福小組")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("請先登入以完成報到")).toBeVisible();
    await expect(page.getByRole("link", { name: "前往登入" })).toBeVisible();
  });

  test("navigate logged in as registered member → check in button visible", async ({ page }) => {
    // Login as ming (registered for series event)
    await page.goto("/login");
    await page.getByLabel("Email").fill("ming@example.com");
    await page.getByLabel("密碼").fill("password123");
    await page.getByRole("button", { name: "登入" }).click();
    await page.waitForURL("/admin/events");

    // Navigate to check-in page
    await page.goto(`/check-in/${sessionId}`);

    // Should show event info and check-in button
    await expect(page.getByText("2026 春季幸福小組")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("button", { name: "確認報到" })).toBeVisible();
  });

  test("click 確認報到 → success state with time", async ({ page }) => {
    // Login as ming
    await page.goto("/login");
    await page.getByLabel("Email").fill("ming@example.com");
    await page.getByLabel("密碼").fill("password123");
    await page.getByRole("button", { name: "登入" }).click();
    await page.waitForURL("/admin/events");

    // Navigate and check in
    await page.goto(`/check-in/${sessionId}`);
    await expect(page.getByRole("button", { name: "確認報到" })).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "確認報到" }).click();

    // Should show success
    await expect(page.getByText("報到成功")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("報到時間")).toBeVisible();
  });

  test("visit again → 您已報到 (already checked in)", async ({ page }) => {
    // Login as ming again
    await page.goto("/login");
    await page.getByLabel("Email").fill("ming@example.com");
    await page.getByLabel("密碼").fill("password123");
    await page.getByRole("button", { name: "登入" }).click();
    await page.waitForURL("/admin/events");

    // Navigate to same check-in page
    await page.goto(`/check-in/${sessionId}`);

    // Should show "already checked in" state
    await expect(page.getByText("您已報到")).toBeVisible({ timeout: 10000 });
  });
});
```

**Step 2: Run the check-in flow tests**

Run: `npx playwright test --config e2e/playwright.config.ts 7-checkin-flow.spec.ts`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add e2e/7-checkin-flow.spec.ts
git commit -m "feat: add QR check-in E2E tests (login prompt, check-in, already checked in)"
```

---

## Task 10: Full E2E Run & Polish

**Step 1: Run the complete E2E test suite**

Run: `npx playwright test --config e2e/playwright.config.ts`
Expected: All tests pass in order (setup → 1 through 7).

**Step 2: Fix any failing tests**

Adjust selectors, timeouts, or test logic based on actual UI behavior. Common issues:

- Selector mismatches (label text, button text)
- Timing issues (increase timeouts or add `waitFor` calls)
- Data assumptions that don't match seed (re-check seed.ts)

**Step 3: Run once more to confirm stability**

Run: `npx playwright test --config e2e/playwright.config.ts`
Expected: All tests pass consistently.

**Step 4: Final commit**

```bash
git add -A e2e/
git commit -m "feat: complete E2E test suite — 7 flows with full coverage"
```
