import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/admin.json" });

test.describe("Admin event management", () => {
  test.describe.configure({ mode: "serial" });

  test("events list shows seed data", async ({ page }) => {
    await page.goto("/admin/events");
    await expect(page.getByText("復活節特別聚會")).toBeVisible();
    await expect(page.getByText("2026 春季幸福小組")).toBeVisible();
  });

  test("create new single event → appears in list", async ({ page }) => {
    await page.goto("/admin/events/new");
    await page.getByLabel("活動名稱").fill("E2E 測試活動");
    await page.getByLabel("活動說明").fill("這是 E2E 測試建立的活動");
    await page.getByLabel("地點").fill("測試場地");
    await page.getByLabel("日期").fill("2026-06-01");
    await page.getByRole("button", { name: "建立活動" }).click();
    await page.waitForURL(/\/admin\/events\/.+/);
    await expect(page.getByRole("heading", { name: "E2E 測試活動" })).toBeVisible();
    await page.goto("/admin/events");
    await expect(page.getByText("E2E 測試活動")).toBeVisible();
  });

  test("click event → detail page shows info", async ({ page }) => {
    await page.goto("/admin/events");
    await page.getByText("2026 春季幸福小組").click();
    await page.waitForURL(/\/admin\/events\/.+/);
    await expect(page.getByRole("heading", { name: "2026 春季幸福小組" })).toBeVisible();
    await expect(page.getByText("副堂 B 教室")).toBeVisible();
    await expect(page.getByText("場次列表 (5 場)")).toBeVisible();
    await expect(page.getByText("歡迎你來")).toBeVisible();
    await expect(page.getByText("新的開始")).toBeVisible();
    await expect(page.getByRole("button", { name: "企劃中" })).toBeVisible();
    await expect(page.getByRole("button", { name: "報名中" })).toBeVisible();
  });

  test("change event status (OPEN → IN_PROGRESS) → badge updates", async ({ page }) => {
    await page.goto("/admin/events");
    await page.getByText("2026 春季幸福小組").click();
    await page.waitForURL(/\/admin\/events\/.+/);
    await page.getByRole("button", { name: "進行中" }).click();
    // Wait for toast confirmation that status changed
    await expect(page.getByText("狀態已更新")).toBeVisible({ timeout: 5000 });
  });

  test("edit event via dialog → changes saved", async ({ page }) => {
    await page.goto("/admin/events");
    await page.getByText("復活節特別聚會").click();
    await page.waitForURL(/\/admin\/events\/.+/);
    await page.getByRole("button", { name: "編輯" }).click();
    await expect(page.getByRole("heading", { name: "編輯活動" })).toBeVisible();
    const descField = page.getByLabel("活動說明");
    await descField.clear();
    await descField.fill("更新後的活動說明");
    await page.getByRole("button", { name: "儲存變更" }).click();
    await expect(page.getByText("更新後的活動說明")).toBeVisible({ timeout: 5000 });
  });
});
