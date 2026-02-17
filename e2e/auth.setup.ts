import { test as setup, expect } from "@playwright/test";

const ADMIN_FILE = "e2e/.auth/admin.json";

setup("authenticate as admin", async ({ page }) => {
  await page.goto("/login");

  // Fill login form
  await page.getByLabel("Email").fill("admin@church.org");
  await page.getByLabel("密碼").fill("password123");
  await page.getByRole("button", { name: "登入", exact: true }).click();

  // Wait for redirect to admin dashboard
  await page.waitForURL("/admin/events");
  await expect(page.getByRole("heading", { name: "活動管理" })).toBeVisible();

  // Save signed-in state
  await page.context().storageState({ path: ADMIN_FILE });
});
