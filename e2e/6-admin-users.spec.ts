import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/admin.json" });

test.describe("Admin user management", () => {
  test.describe.configure({ mode: "serial" });

  test("users table shows all seed users", async ({ page }) => {
    await page.goto("/admin/users");
    const table = page.getByRole("table");
    await expect(table.getByRole("cell", { name: "王統籌" })).toBeVisible();
    await expect(table.getByRole("cell", { name: "李行政" })).toBeVisible();
    await expect(table.getByRole("cell", { name: "陳傳道" })).toBeVisible();
    await expect(table.getByRole("cell", { name: "張組長" })).toBeVisible();
    await expect(table.getByRole("cell", { name: "林小明" })).toBeVisible();
    await expect(table.getByRole("cell", { name: "黃美玲" })).toBeVisible();
    await expect(table.getByRole("cell", { name: "劉大華" })).toBeVisible();
    await expect(table.getByRole("cell", { name: "趙雅婷" })).toBeVisible();
  });

  test("search filters by name", async ({ page }) => {
    await page.goto("/admin/users");
    // Wait for users to load first
    await expect(page.getByRole("cell", { name: "王統籌" })).toBeVisible();
    await page.getByPlaceholder("搜尋姓名或 Email...").fill("林小明");
    // Wait for filter to take effect — 王統籌 should disappear from the table
    await expect(page.getByRole("row").filter({ hasText: "王統籌" })).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("林小明")).toBeVisible();
  });

  test("click user → edit dialog → change role → saves", async ({ page }) => {
    await page.goto("/admin/users");
    await page.getByRole("row").filter({ hasText: "林小明" }).click();
    await expect(page.getByRole("heading", { name: "編輯使用者" })).toBeVisible();
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "小組長" }).click();
    await page.getByRole("button", { name: "儲存" }).click();
    await expect(page.getByRole("heading", { name: "編輯使用者" })).not.toBeVisible({
      timeout: 5000,
    });
    const row = page.getByRole("row").filter({ hasText: "林小明" });
    await expect(row.getByText("小組長")).toBeVisible();
  });

  test("toggle active/inactive → status badge changes", async ({ page }) => {
    await page.goto("/admin/users");
    await page.getByRole("row").filter({ hasText: "周志偉" }).click();
    await expect(page.getByRole("heading", { name: "編輯使用者" })).toBeVisible();
    await page.getByRole("switch").click();
    await page.getByRole("button", { name: "儲存" }).click();
    await expect(page.getByRole("heading", { name: "編輯使用者" })).not.toBeVisible({
      timeout: 5000,
    });
    const row = page.getByRole("row").filter({ hasText: "周志偉" });
    await expect(row.getByText("停用")).toBeVisible();
  });
});
