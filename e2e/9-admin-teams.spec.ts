import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/admin.json" });

test.describe("Admin team template management", () => {
  test.describe.configure({ mode: "serial" });

  test("navigate to teams → page loads with existing templates", async ({ page }) => {
    await page.goto("/admin/teams");
    await expect(page.getByRole("heading", { name: "組別範本管理" })).toBeVisible();
    // Seed data has "敬拜組" and "影音組"
    await expect(page.getByRole("cell", { name: "敬拜組" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("cell", { name: "影音組" })).toBeVisible();
  });

  test("create new template → row appears", async ({ page }) => {
    await page.goto("/admin/teams");
    await expect(page.getByRole("cell", { name: "敬拜組" })).toBeVisible({ timeout: 5000 });

    await page.getByPlaceholder("新增組別名稱...").fill("測試組");
    await page.getByRole("button", { name: "新增" }).first().click();

    await expect(page.getByText(/已新增「測試組」/)).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByRole("cell", { name: "測試組" })).toBeVisible();
  });

  test("expand template → add default task", async ({ page }) => {
    await page.goto("/admin/teams");
    await expect(page.getByText("測試組")).toBeVisible({ timeout: 5000 });

    // Click row to expand
    await page.getByRole("row").filter({ hasText: "測試組" }).click();

    // Verify sections appear
    await expect(page.getByText("預設成員").nth(1)).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("預設任務").nth(1)).toBeVisible();

    // Add a default task
    await page.getByPlaceholder("新增預設任務...").fill("測試任務");
    await page.getByPlaceholder("新增預設任務...").press("Enter");

    await expect(page.getByText("已新增預設任務")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("測試任務")).toBeVisible();
  });

  test("add default member via search", async ({ page }) => {
    await page.goto("/admin/teams");
    await expect(page.getByText("測試組")).toBeVisible({ timeout: 5000 });

    // Expand row
    await page.getByRole("row").filter({ hasText: "測試組" }).click();
    await expect(page.getByText("預設成員").nth(1)).toBeVisible({
      timeout: 5000,
    });

    // Click "新增" button in member section (second "新增" button on page)
    await page.getByRole("button", { name: "新增" }).nth(1).click();

    // Dialog opens - search for user
    await expect(page.getByRole("heading", { name: "新增預設成員" })).toBeVisible();
    await page.getByPlaceholder("搜尋姓名或電話...").fill("林小明");

    // Wait for search results and click
    await expect(page.getByText("林小明").last()).toBeVisible({
      timeout: 5000,
    });
    await page.locator("button").filter({ hasText: "林小明" }).click();

    // Verify member appears
    await expect(page.getByText("已新增預設成員")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("林小明")).toBeVisible();
  });

  test("remove task and member", async ({ page }) => {
    await page.goto("/admin/teams");
    await expect(page.getByText("測試組")).toBeVisible({ timeout: 5000 });

    // Expand row
    await page.getByRole("row").filter({ hasText: "測試組" }).click();
    await expect(page.getByText("測試任務")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("林小明")).toBeVisible();

    // Remove the task (click X button next to task)
    const taskItem = page.locator("div").filter({ hasText: /^測試任務$/ });
    await taskItem.getByRole("button").click();
    await expect(page.getByText("已移除預設任務")).toBeVisible({
      timeout: 5000,
    });

    // Remove the member (click X button next to member)
    const memberItem = page.locator("div").filter({ hasText: /^林小明/ });
    await memberItem.getByRole("button").click();
    await expect(page.getByText("已移除預設成員")).toBeVisible({
      timeout: 5000,
    });
  });

  test("edit template name", async ({ page }) => {
    await page.goto("/admin/teams");
    await expect(page.getByText("測試組")).toBeVisible({ timeout: 5000 });

    // Click pencil icon to open edit dialog
    const row = page.getByRole("row").filter({ hasText: "測試組" });
    await row.getByRole("button").first().click();

    // Edit dialog opens
    await expect(page.getByRole("heading", { name: "編輯組別名稱" })).toBeVisible();

    // Clear and type new name
    const input = page.getByRole("dialog").getByRole("textbox");
    await input.clear();
    await input.fill("測試組已更名");
    await page.getByRole("dialog").getByRole("button", { name: "儲存" }).click();

    await expect(page.getByText("已更新")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("測試組已更名")).toBeVisible();
  });

  test("delete template → verify removed", async ({ page }) => {
    await page.goto("/admin/teams");
    await expect(page.getByText("測試組已更名")).toBeVisible({ timeout: 5000 });

    // Click trash icon to open delete dialog
    const row = page.getByRole("row").filter({ hasText: "測試組已更名" });
    await row.getByRole("button").nth(1).click();

    // Confirm deletion in dialog
    await expect(page.getByRole("heading", { name: "確認刪除" })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "確認刪除" }).click();

    await expect(page.getByText("已刪除")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("測試組已更名")).not.toBeVisible({
      timeout: 5000,
    });
  });
});
