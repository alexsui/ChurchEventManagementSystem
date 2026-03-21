import { test, expect } from "@playwright/test";

test.describe("Public event page", () => {
  test("view public event detail → title, location, registration info", async ({ page }) => {
    const eventsRes = await page.request.get("/api/events?all=true");
    const events = await eventsRes.json();
    const singleEvent = events.find((e: { title: string }) => e.title === "復活節特別聚會");

    await page.goto(`/events/${singleEvent.id}`);
    await expect(page.getByText("復活節特別聚會")).toBeVisible();
    await expect(page.getByText("主堂")).toBeVisible();
    await expect(page.getByText("報名資訊")).toBeVisible();
  });

  test("click 立即報名 when logged in → registration succeeds", async ({ page }) => {
    // Login as zhiwei (not registered for series event)
    await page.goto("/login");
    await page.getByLabel("Email").fill("zhiwei@example.com");
    await page.getByLabel("密碼").fill("password123");
    await page.getByRole("button", { name: "登入", exact: true }).click();
    await page.waitForURL("/events");

    // Get the series event ID
    const eventsRes = await page.request.get("/api/events?all=true");
    const events = await eventsRes.json();
    const seriesEvent = events.find((e: { title: string }) => e.title === "2026 春季幸福小組");

    await page.goto(`/events/${seriesEvent.id}`);
    await page.getByRole("button", { name: /立即報名|候補報名/ }).click();
    await expect(page.getByText("已報名").or(page.getByText("報名成功"))).toBeVisible({
      timeout: 5000,
    });
  });

  test("view event when not logged in → login button visible", async ({ page }) => {
    const eventsRes = await page.request.get("/api/events?all=true");
    const events = await eventsRes.json();
    const singleEvent = events.find((e: { title: string }) => e.title === "復活節特別聚會");

    await page.goto(`/events/${singleEvent.id}`);
    await expect(page.getByRole("button", { name: "登入後報名" })).toBeVisible();
  });
});
