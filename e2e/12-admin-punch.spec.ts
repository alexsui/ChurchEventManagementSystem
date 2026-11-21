import { test, expect, type Browser, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { taipeiToday, formatDateOnlyWithWeekday } from "../src/lib/taipei-date";

test.use({ storageState: "e2e/.auth/admin.json" });

const TITLE = "E2E 敬拜團團練";
const DAY_MS = 24 * 60 * 60 * 1000;
const today = taipeiToday();
const shift = (days: number) =>
  new Date(new Date(`${today}T00:00:00.000Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);

/** A fresh, logged-out browser page (not using the admin storage state). */
async function anonymousPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  return context.newPage();
}

async function fillLogin(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("密碼").fill("password123");
  await page.getByRole("button", { name: "登入", exact: true }).click();
}

test.describe("打卡 (punch) activity", () => {
  test.describe.configure({ mode: "serial" });

  let activityId: string;

  test("admin creates an activity → detail page shows QR code", async ({ page }) => {
    await page.goto("/admin/punch");
    await expect(page.getByRole("heading", { name: "打卡管理" })).toBeVisible();

    await page.getByRole("button", { name: "新增打卡活動" }).click();
    await page.getByLabel("名稱").fill(TITLE);
    await page.getByLabel("開始日期").fill(shift(-30));
    await page.getByLabel("結束日期").fill(shift(30));
    await page.getByRole("button", { name: "建立", exact: true }).click();

    await page.waitForURL(/\/admin\/punch\/[^/]+$/);
    activityId = page.url().split("/").pop()!;
    await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
    await expect(page.getByAltText("QR Code")).toBeVisible({ timeout: 10000 });
  });

  test("list page shows the new activity", async ({ page }) => {
    await page.goto("/admin/punch");
    await expect(page.getByRole("row").filter({ hasText: TITLE })).toBeVisible();
  });

  test("admin adds 劉大華 to the roster", async ({ page }) => {
    await page.goto(`/admin/punch/${activityId}`);
    await page.getByRole("button", { name: "新增成員" }).click();
    await page.getByLabel("搜尋使用者").fill("劉大華");
    await page.getByRole("button", { name: "加入 劉大華" }).click();
    await expect(page.getByText("已加入名單")).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "完成" }).click();

    const row = page.getByRole("row").filter({ hasText: "劉大華" });
    await expect(row).toContainText("0 / 0");
    await expect(row).toContainText("—");
  });

  test("logged out → login prompt; login returns to the punch page; punch succeeds", async ({
    browser,
  }) => {
    const page = await anonymousPage(browser);
    await page.goto(`/punch/${activityId}`);
    await expect(page.getByText(TITLE)).toBeVisible({ timeout: 10000 });

    await page.getByRole("link", { name: "登入後打卡" }).click();
    await page.waitForURL(/\/login/);
    await fillLogin(page, "dahua@example.com");
    await page.waitForURL(`/punch/${activityId}`);

    await page.getByRole("button", { name: "打卡", exact: true }).click();
    await expect(page.getByRole("heading", { name: "打卡成功！" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/\d{1,2}:\d{2}/)).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "今天已打卡" })).toBeVisible({
      timeout: 10000,
    });
    await page.context().close();
  });

  test("user not on the roster sees the not-member message", async ({ browser }) => {
    const page = await anonymousPage(browser);
    await page.goto(`/login?callbackUrl=${encodeURIComponent(`/punch/${activityId}`)}`);
    await fillLogin(page, "yating@example.com");
    await page.waitForURL(`/punch/${activityId}`);
    await expect(page.getByText("你不在這個打卡名單中")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "打卡", exact: true })).toHaveCount(0);
    await page.context().close();
  });

  test("admin sees 1 / 1 and 100%, today's rehearsal, and can export Excel", async ({ page }) => {
    await page.goto(`/admin/punch/${activityId}`);
    const row = page.getByRole("row").filter({ hasText: "劉大華" });
    await expect(row).toContainText("1 / 1");
    await expect(row).toContainText("100%");
    await expect(page.getByRole("heading", { name: "團練日期 1" })).toBeVisible();
    await expect(
      page.getByRole("row").filter({ hasText: formatDateOnlyWithWeekday(today) })
    ).toContainText("1");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "匯出 Excel" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${TITLE}_出席率.xlsx`);

    const workbook = XLSX.readFile(await download.path());
    const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets["出席率"], { header: 1 });
    expect(rows[0]).toEqual([
      "姓名",
      "電話",
      "加入日期",
      "退出日期",
      "出席次數",
      "應出席次數",
      "出席率",
      today,
    ]);
    expect(rows[1]).toEqual(["劉大華", "0972345678", today, "", 1, 1, "100%", "✓"]);
  });

  test("admin deletes today's records → no longer counts as a rehearsal", async ({ page }) => {
    await page.goto(`/admin/punch/${activityId}`);
    await page.getByRole("button", { name: `刪除 ${today}` }).click();
    await page.getByRole("button", { name: "確定刪除" }).click();
    await expect(page.getByText("已刪除這天的紀錄")).toBeVisible({ timeout: 5000 });

    const row = page.getByRole("row").filter({ hasText: "劉大華" });
    await expect(row).toContainText("0 / 0");
    await expect(page.getByRole("heading", { name: "團練日期 0" })).toBeVisible();
  });
});
