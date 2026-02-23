import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/admin.json" });

test.describe("Admin role permissions management", () => {
  test.describe.configure({ mode: "serial" });

  test("navigate to role permissions → verify heading and matrix", async ({ page }) => {
    await page.goto("/admin/users/roles");
    await expect(page.getByRole("heading", { name: "角色權限設定" })).toBeVisible({
      timeout: 10000,
    });

    // Verify role rows are visible
    await expect(page.getByText("行政同工")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("總務同工")).toBeVisible();
    await expect(page.getByText("財務同工")).toBeVisible();
    await expect(page.getByText("傳道人")).toBeVisible();

    // Verify module columns are visible
    await expect(page.getByRole("columnheader", { name: "活動管理" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "報名管理" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "預算管理" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "小組管理" })).toBeVisible();
  });

  test("toggle write permission → read auto-checks", async ({ page }) => {
    await page.goto("/admin/users/roles");
    await expect(page.getByText("總務同工")).toBeVisible({ timeout: 5000 });

    // Find the 總務同工 row and locate the 小組管理 column
    // Columns: 角色(0), 活動管理(1), 報名管理(2), 出席管理(3), 任務分配(4), 小組管理(5), 預算管理(6), 報表(7)
    const row = page.getByRole("row").filter({ hasText: "總務同工" });
    const teamsCell = row.getByRole("cell").nth(5); // 小組管理

    // Get the R and W checkboxes in the teams cell
    const readCheckbox = teamsCell.getByRole("checkbox").first();
    const writeCheckbox = teamsCell.getByRole("checkbox").nth(1);

    // Verify initially unchecked (teams should not have permissions by default for 總務同工)
    await expect(readCheckbox).not.toBeChecked();
    await expect(writeCheckbox).not.toBeChecked();

    // Check write → should auto-check read
    await writeCheckbox.check();
    await expect(readCheckbox).toBeChecked();
    await expect(writeCheckbox).toBeChecked();
  });

  test("uncheck read → write also unchecks (cascade)", async ({ page }) => {
    await page.goto("/admin/users/roles");
    await expect(page.getByText("總務同工")).toBeVisible({ timeout: 5000 });

    const row = page.getByRole("row").filter({ hasText: "總務同工" });
    const teamsCell = row.getByRole("cell").nth(5);
    const readCheckbox = teamsCell.getByRole("checkbox").first();
    const writeCheckbox = teamsCell.getByRole("checkbox").nth(1);

    // First check write (which also checks read)
    await writeCheckbox.check();
    await expect(readCheckbox).toBeChecked();
    await expect(writeCheckbox).toBeChecked();

    // Now uncheck read → write should also uncheck
    await readCheckbox.uncheck();
    await expect(readCheckbox).not.toBeChecked();
    await expect(writeCheckbox).not.toBeChecked();
  });

  test("save permissions → verify toast + reload persists", async ({ page }) => {
    await page.goto("/admin/users/roles");
    await expect(page.getByText("總務同工")).toBeVisible({ timeout: 5000 });

    // Make a change: check read on 小組管理 for 總務同工
    const row = page.getByRole("row").filter({ hasText: "總務同工" });
    const teamsCell = row.getByRole("cell").nth(5);
    const readCheckbox = teamsCell.getByRole("checkbox").first();
    await readCheckbox.check();
    await expect(readCheckbox).toBeChecked();

    // Save
    await page.getByRole("button", { name: /儲存設定/ }).click();
    await expect(page.getByText("權限設定已儲存")).toBeVisible({
      timeout: 5000,
    });

    // Reload page and verify the change persisted
    await page.reload();
    await expect(page.getByText("總務同工")).toBeVisible({ timeout: 5000 });

    const rowAfterReload = page.getByRole("row").filter({ hasText: "總務同工" });
    const teamsCellAfterReload = rowAfterReload.getByRole("cell").nth(5);
    const readCheckboxAfterReload = teamsCellAfterReload.getByRole("checkbox").first();
    await expect(readCheckboxAfterReload).toBeChecked();

    // Clean up: uncheck it and save again to restore original state
    await readCheckboxAfterReload.uncheck();
    await page.getByRole("button", { name: /儲存設定/ }).click();
    await expect(page.getByText("權限設定已儲存")).toBeVisible({
      timeout: 5000,
    });
  });
});
