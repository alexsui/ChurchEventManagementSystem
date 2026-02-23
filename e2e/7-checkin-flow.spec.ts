import { test, expect } from "@playwright/test";

test.describe("QR check-in flow", () => {
  test.describe.configure({ mode: "serial" });

  let sessionId: string;

  test.beforeAll(async ({ request }) => {
    const eventsRes = await request.get("/api/events");
    const events = await eventsRes.json();
    const seriesEvent = events.find((e: { title: string }) => e.title === "2026 春季幸福小組");
    const detailRes = await request.get(`/api/events/${seriesEvent.id}`);
    const detail = await detailRes.json();
    // Use session 3 (no attendance records in seed data)
    sessionId = detail.eventSessions[2].id;
  });

  test("navigate not logged in → login prompt", async ({ page }) => {
    await page.goto(`/check-in/${sessionId}`);
    await expect(page.getByText("2026 春季幸福小組")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("請先登入以完成報到")).toBeVisible();
    await expect(page.getByRole("link", { name: "前往登入" })).toBeVisible();
  });

  test("navigate logged in as registered member → check in button visible", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("ming@example.com");
    await page.getByLabel("密碼").fill("password123");
    await page.getByRole("button", { name: "登入", exact: true }).click();
    await page.waitForURL("/events");
    await page.goto(`/check-in/${sessionId}`);
    await expect(page.getByText("2026 春季幸福小組")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "確認報到" })).toBeVisible();
  });

  test("click 確認報到 → success state with time", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("ming@example.com");
    await page.getByLabel("密碼").fill("password123");
    await page.getByRole("button", { name: "登入", exact: true }).click();
    await page.waitForURL("/events");
    await page.goto(`/check-in/${sessionId}`);
    await expect(page.getByRole("button", { name: "確認報到" })).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "確認報到" }).click();
    await expect(page.getByRole("heading", { name: /報到成功/ })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/報到時間/)).toBeVisible();
  });

  test("visit again → 您已報到 (already checked in)", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("ming@example.com");
    await page.getByLabel("密碼").fill("password123");
    await page.getByRole("button", { name: "登入", exact: true }).click();
    await page.waitForURL("/events");
    await page.goto(`/check-in/${sessionId}`);
    await expect(page.getByText("您已報到")).toBeVisible({ timeout: 10000 });
  });
});
