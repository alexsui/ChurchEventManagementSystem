import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/admin.json" });

test.describe("Admin assignment management", () => {
  test.describe.configure({ mode: "serial" });

  test("navigate to assignments page → verify title", async ({ page }) => {
    await page.goto("/admin/assignments");
    await expect(page.getByRole("heading", { name: "作業管理" })).toBeVisible({ timeout: 10000 });
  });

  test("select event → panel loads with tabs", async ({ page }) => {
    await page.goto("/admin/assignments");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /幸福小組/ }).click();
    await expect(page.getByRole("tab", { name: "總覽" })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByRole("tab", { name: "場次管理" })).toBeVisible();
  });

  test("switch to session tab → select session → create assignment", async ({ page }) => {
    await page.goto("/admin/assignments");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /幸福小組/ }).click();
    await expect(page.getByRole("tab", { name: "場次管理" })).toBeVisible({
      timeout: 5000,
    });
    await page.getByRole("tab", { name: "場次管理" }).click();

    // Select session 1
    await expect(page.getByText("選擇場次", { exact: true })).toBeVisible({ timeout: 5000 });
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: /第 1 堂/ }).click();

    // Wait for assignment list to load
    await expect(page.getByText("作業列表", { exact: true })).toBeVisible({ timeout: 5000 });

    // Create new assignment
    await page.getByRole("button", { name: "新增作業" }).click();
    await page.getByPlaceholder("作業名稱").fill("E2E 測試作業");
    await page.getByRole("button", { name: "確認" }).click();

    // Verify toast and row appears
    await expect(page.getByText("已成功新增作業")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("E2E 測試作業")).toBeVisible();
  });

  test("click assignment → view completion detail → bulk mark complete", async ({ page }) => {
    await page.goto("/admin/assignments");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /幸福小組/ }).click();
    await expect(page.getByRole("tab", { name: "場次管理" })).toBeVisible({
      timeout: 5000,
    });
    await page.getByRole("tab", { name: "場次管理" }).click();

    // Select session 1
    await expect(page.getByText("選擇場次", { exact: true })).toBeVisible({ timeout: 5000 });
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: /第 1 堂/ }).click();
    await expect(page.getByText("作業列表", { exact: true })).toBeVisible({ timeout: 5000 });

    // Click on the assignment row
    await page.getByRole("row").filter({ hasText: "E2E 測試作業" }).click();

    // Verify completion detail loads with registered members
    await expect(page.getByText(/已完成 0 \/ 已報名 \d+ 人/)).toBeVisible({
      timeout: 5000,
    });

    // Check a member checkbox (skip header "select all" checkbox)
    const memberCheckboxes = page.locator("tbody").getByRole("checkbox");
    await memberCheckboxes.first().check();

    // Click bulk complete
    await page.getByRole("button", { name: /批次標記完成/ }).click();

    // Verify toast and badge
    await expect(page.getByText(/已成功為 \d+ 人標記完成/)).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("已完成").first()).toBeVisible();
  });

  test("remove completion → reverts to 未完成", async ({ page }) => {
    await page.goto("/admin/assignments");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /幸福小組/ }).click();
    await expect(page.getByRole("tab", { name: "場次管理" })).toBeVisible({
      timeout: 5000,
    });
    await page.getByRole("tab", { name: "場次管理" }).click();

    await expect(page.getByText("選擇場次", { exact: true })).toBeVisible({ timeout: 5000 });
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: /第 1 堂/ }).click();
    await expect(page.getByText("作業列表", { exact: true })).toBeVisible({ timeout: 5000 });

    // Click on the assignment
    await page.getByRole("row").filter({ hasText: "E2E 測試作業" }).click();
    await expect(page.getByText(/已完成 1 \/ 已報名 \d+ 人/)).toBeVisible({
      timeout: 5000,
    });

    // Click "取消完成" on the completed member
    await page.getByRole("button", { name: /取消完成/ }).click();
    await expect(page.getByText("已取消完成標記")).toBeVisible({
      timeout: 5000,
    });

    // Verify all members show "未完成" (no "已完成" badge in table body)
    await expect(page.getByText(/已完成 0 \/ 已報名 \d+ 人/)).toBeVisible({
      timeout: 5000,
    });
  });

  test("go back → delete assignment → verify removed", async ({ page }) => {
    await page.goto("/admin/assignments");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /幸福小組/ }).click();
    await expect(page.getByRole("tab", { name: "場次管理" })).toBeVisible({
      timeout: 5000,
    });
    await page.getByRole("tab", { name: "場次管理" }).click();

    await expect(page.getByText("選擇場次", { exact: true })).toBeVisible({ timeout: 5000 });
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: /第 1 堂/ }).click();
    await expect(page.getByText("作業列表", { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("E2E 測試作業")).toBeVisible({ timeout: 5000 });

    // Delete assignment via trash icon (accept confirm dialog)
    page.on("dialog", (dialog) => dialog.accept());
    const row = page.getByRole("row").filter({ hasText: "E2E 測試作業" });
    await row.getByRole("button").click();

    // Verify toast and row removed
    await expect(page.getByText("已成功刪除作業")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("E2E 測試作業")).not.toBeVisible({
      timeout: 5000,
    });
  });
});
