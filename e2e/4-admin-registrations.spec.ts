import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/admin.json" });

test.describe("Admin registration management", () => {
  test.describe.configure({ mode: "serial" });

  test("select event → registrations table loads", async ({ page }) => {
    await page.goto("/admin/registrations");
    await expect(page.getByText("選擇活動")).toBeVisible();
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /復活節特別聚會/ }).click();
    await expect(page.getByText("報名列表")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("林小明")).toBeVisible();
    await expect(page.getByText("陳傳道")).toBeVisible();
  });

  test("filter by status → table filters correctly", async ({ page }) => {
    await page.goto("/admin/registrations");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /幸福小組/ }).click();
    await expect(page.getByText("報名列表")).toBeVisible({ timeout: 5000 });
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: "候補" }).click();
    await expect(page.getByText("趙雅婷")).toBeVisible();
    await expect(page.getByText("林小明")).not.toBeVisible();
  });

  test("cancel a registration → row updates to 已取消", async ({ page }) => {
    await page.goto("/admin/registrations");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /復活節特別聚會/ }).click();
    await expect(page.getByText("報名列表")).toBeVisible({ timeout: 5000 });
    const row = page.getByRole("row").filter({ hasText: "張組長" });
    await expect(row).toBeVisible();
    page.on("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "取消報名" }).click();
    await expect(row.getByText("已取消")).toBeVisible({ timeout: 5000 });
  });
});
