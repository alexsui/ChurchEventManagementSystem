import { test, expect } from "@playwright/test";

test.describe("Auth flows", () => {
  test("register new account → success message", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("tab", { name: "註冊" }).click();
    await page.locator("#reg-name").fill("測試使用者");
    await page.locator("#reg-email").fill("e2e-test@example.com");
    await page.locator("#reg-phone").fill("0911222333");
    await page.locator("#reg-password").fill("test12345678");
    await page.locator("#reg-confirm").fill("test12345678");
    await page.getByRole("button", { name: "註冊" }).click();
    await expect(page.getByText("註冊成功")).toBeVisible();
  });

  test("login with existing credentials → events page", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@church.org");
    await page.getByLabel("密碼").fill("password123");
    await page.getByRole("button", { name: "登入", exact: true }).click();
    await page.waitForURL("/events");
    await expect(page.getByRole("heading", { name: "所有活動" })).toBeVisible();
  });

  test("login with wrong password → error message", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@church.org");
    await page.getByLabel("密碼").fill("wrongpassword");
    await page.getByRole("button", { name: "登入", exact: true }).click();
    await expect(page.getByText("Email 或密碼錯誤")).toBeVisible();
  });

  test("logout → redirected to login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@church.org");
    await page.getByLabel("密碼").fill("password123");
    await page.getByRole("button", { name: "登入", exact: true }).click();
    await page.waitForURL("/events");
    // Navigate to admin area where logout button is in the header
    await page.goto("/admin/events");
    await expect(page.getByRole("heading", { name: "活動管理" })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /登出/ }).click();
    await page.waitForURL(/\/login/);
  });
});
