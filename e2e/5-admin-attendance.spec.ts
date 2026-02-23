import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/admin.json" });

test.describe("Admin attendance management", () => {
  test.describe.configure({ mode: "serial" });

  test("select event + session → QR code tab shows QR image and URL", async ({ page }) => {
    await page.goto("/admin/attendance");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /幸福小組/ }).click();
    await page.getByRole("tab", { name: "場次管理" }).click();
    await expect(page.getByRole("combobox").nth(1)).toBeVisible({ timeout: 5000 });
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: /第 1 堂/ }).click();
    await expect(page.getByAltText("報到 QR Code")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/\/check-in\//)).toBeVisible();
  });

  test("switch to manual tab → shows attendance summary", async ({ page }) => {
    await page.goto("/admin/attendance");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /幸福小組/ }).click();
    await page.getByRole("tab", { name: "場次管理" }).click();
    await expect(page.getByRole("combobox").nth(1)).toBeVisible({ timeout: 5000 });
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: /第 1 堂/ }).click();
    await page.getByRole("tab", { name: /手動點名/ }).click();
    await expect(page.getByText(/已報到 3 \/ 已報名 3 人/)).toBeVisible({ timeout: 5000 });
  });

  test("check a user checkbox → bulk check-in → count updates", async ({ page }) => {
    await page.goto("/admin/attendance");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /幸福小組/ }).click();
    await page.getByRole("tab", { name: "場次管理" }).click();
    await expect(page.getByRole("combobox").nth(1)).toBeVisible({ timeout: 5000 });
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: /第 2 堂/ }).click();
    await page.getByRole("tab", { name: /手動點名/ }).click();
    await expect(page.getByText(/已報到 2 \/ 已報名 3 人/)).toBeVisible({ timeout: 5000 });
    const row = page.getByRole("row").filter({ hasText: "黃美玲" });
    await row.getByRole("checkbox").check();
    await page.getByRole("button", { name: /批次報到/ }).click();
    await expect(page.getByText(/已報到 3 \/ 已報名 3 人/)).toBeVisible({ timeout: 5000 });
  });
});
