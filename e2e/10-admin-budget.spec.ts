import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/admin.json" });

test.describe("Admin budget management", () => {
  test.describe.configure({ mode: "serial" });

  test("navigate to budget → verify title", async ({ page }) => {
    await page.goto("/admin/budget");
    await expect(page.getByRole("heading", { name: "預算管理" })).toBeVisible({ timeout: 10000 });
  });

  test("select event → empty state shows", async ({ page }) => {
    await page.goto("/admin/budget");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /幸福小組/ }).click();

    // Verify empty state
    await expect(page.getByText("尚無預算項目")).toBeVisible({ timeout: 5000 });
  });

  test("add first budget item → row appears", async ({ page }) => {
    await page.goto("/admin/budget");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /幸福小組/ }).click();
    await expect(page.getByText("尚無預算項目")).toBeVisible({ timeout: 5000 });

    // Click "新增項目" or empty state button
    await page.getByRole("button", { name: /新增/ }).first().click();

    // Fill dialog form
    await expect(page.getByRole("heading", { name: "新增預算項目" })).toBeVisible();
    await page.getByLabel("類別").click();
    await page.getByRole("option", { name: "午晚餐" }).click();
    await page.getByLabel("預估金額").fill("5000");
    await page.getByLabel("實際金額").fill("0");

    // Submit
    await page.getByRole("dialog").getByRole("button", { name: "新增" }).click();

    // Verify toast and row
    await expect(page.getByText("預算項目已新增")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("午晚餐")).toBeVisible();
  });

  test("add second budget item → summary footer shows totals", async ({ page }) => {
    await page.goto("/admin/budget");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /幸福小組/ }).click();
    await expect(page.getByText("午晚餐")).toBeVisible({ timeout: 5000 });

    // Click "新增項目"
    await page.getByRole("button", { name: /新增項目/ }).click();

    // Fill dialog
    await expect(page.getByRole("heading", { name: "新增預算項目" })).toBeVisible();
    await page.getByLabel("類別").click();
    await page.getByRole("option", { name: "場佈" }).click();
    await page.getByLabel("預估金額").fill("2000");

    // Submit
    await page.getByRole("dialog").getByRole("button", { name: "新增" }).click();

    // Verify toast and second row
    await expect(page.getByText("預算項目已新增")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("場佈")).toBeVisible();

    // Verify summary footer shows totals
    await expect(page.getByText("預估總計 / 實際總計")).toBeVisible();
    await expect(page.getByText(/7,000/).first()).toBeVisible();
  });

  test("edit first item actual amount → verify updated", async ({ page }) => {
    await page.goto("/admin/budget");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /幸福小組/ }).click();
    await expect(page.getByText("午晚餐")).toBeVisible({ timeout: 5000 });

    // Click pencil icon on first item (午晚餐 row)
    const mealRow = page.getByRole("row").filter({ hasText: "午晚餐" });
    await mealRow.getByRole("button").first().click();

    // Edit dialog opens
    await expect(page.getByRole("heading", { name: "編輯預算項目" })).toBeVisible();

    // Change actual amount to 4500
    await page.getByLabel("實際金額").clear();
    await page.getByLabel("實際金額").fill("4500");
    await page.getByRole("button", { name: "儲存變更" }).click();

    // Verify toast
    await expect(page.getByText("預算項目已更新")).toBeVisible({
      timeout: 5000,
    });

    // Verify execution rate in footer
    await expect(page.getByText("差額 / 執行率")).toBeVisible();
    await expect(page.getByText(/64\.3%/)).toBeVisible();
  });

  test("delete second item → verify removed", async ({ page }) => {
    await page.goto("/admin/budget");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /幸福小組/ }).click();
    await expect(page.getByText("場佈")).toBeVisible({ timeout: 5000 });

    // Click trash icon on second item (場佈 row)
    const venueRow = page.getByRole("row").filter({ hasText: "場佈" });
    await venueRow.getByRole("button").nth(1).click();

    // Confirm deletion
    await expect(page.getByRole("heading", { name: "確認刪除" })).toBeVisible();
    await page.getByRole("button", { name: "確認刪除" }).click();

    // Verify toast and row removed
    await expect(page.getByText("預算項目已刪除")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("場佈")).not.toBeVisible({ timeout: 5000 });

    // Clean up: delete the remaining meal item too
    const mealRow = page.getByRole("row").filter({ hasText: "午晚餐" });
    await mealRow.getByRole("button").nth(1).click();
    await expect(page.getByRole("heading", { name: "確認刪除" })).toBeVisible();
    await page.getByRole("button", { name: "確認刪除" }).click();
    await expect(page.getByText("預算項目已刪除")).toBeVisible({
      timeout: 5000,
    });
  });
});
