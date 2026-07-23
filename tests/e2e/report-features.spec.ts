import { test, expect } from "@playwright/test";
function israelToday() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

test("דוח ריק מתחיל באפס ומאפשר מעבר ללוח שנה", async ({ page }) => {
  await page.goto("/app/report?month=2026-07");
  const workedCard = page.getByText("שעות בפועל", { exact: true }).first().locator("..");
  await expect(workedCard.getByText("00:00", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "לוח שנה" }).click();
  await expect(page).toHaveURL(/view=calendar/);
  await expect(page.getByRole("link", { name: "רשימה" })).toBeVisible();
  const fitsViewport = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fitsViewport).toBe(true);
});

test("כרטיס הפלוס פותח את שדה הקטגוריה בהגדרות", async ({ page }) => {
  await page.goto("/app/report?month=2026-07");
  await page.getByRole("link", { name: "הוספת קטגוריית שעות" }).click();
  await expect(page).toHaveURL(/\/app\/settings\?newCategory=1#work-categories$/);
  const input = page.getByRole("textbox", { name: "שם הקטגוריה" });
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();
});

test("אפשר להוסיף דיווח ליום ישירות מתוך הדוח", async ({ page }) => {
  await page.goto("/app/report?month=2026-07");
  const addButton = page.getByRole("button", { name: /הוספת דיווח 2026-07/ }).first();
  await addButton.click();
  const modal = page.locator("dialog[open]");
  await expect(modal.getByRole("heading", { name: "הוספת דיווח" })).toBeVisible();
  await expect(modal.getByRole("combobox", { name: "קטגוריה" })).toBeVisible();
  await expect(modal.getByText("ניתן לדווח רק עד השעה הנוכחית")).toBeVisible();
  await expect(modal.getByLabel("כניסה")).toHaveAttribute("max", /T/);
});
test("ערך עם סימן ממורכז בתוך עמודת המאזן", async ({ page }) => {
  await page.goto("/app/report?view=list");
  const desktop = (page.viewportSize()?.width ?? 0) >= 768;
  const container = desktop
    ? page.locator("tr[data-date]").first().locator("td").nth(5)
    : page.locator('article[data-report-date]:visible').first().locator("dd").nth(2);
  const value = container.locator("span.metric-value");
  await expect(value).toBeVisible();
  const centers = await Promise.all([container.boundingBox(), value.boundingBox()]);
  expect(centers[0]).not.toBeNull();
  expect(centers[1]).not.toBeNull();
  const cellCenter = centers[0]!.x + centers[0]!.width / 2;
  const valueCenter = centers[1]!.x + centers[1]!.width / 2;
  expect(Math.abs(cellCenter - valueCenter)).toBeLessThanOrEqual(1);
  await expect(value).toHaveCSS("direction", "ltr");
});
test("לא ניתן להוסיף דיווח ליום עתידי", async ({ page }) => {
  await page.goto("/app/report?month=2026-07&view=list");
  await expect(page.getByRole("button", { name: "הוספת דיווח 2026-07-31" })).toHaveCount(0);
});
test("שכר משוער מחובר להגדרת השכר", async ({ page }) => {
  await page.goto("/app/report?month=2026-07");
  const compensationCard = page.getByText("שכר משוער", { exact: true }).locator("..");
  await expect(compensationCard.getByText(/₪/)).toBeVisible();
  await expect(compensationCard.getByText(/לפני ניכויים ותוספות/)).toBeVisible();
});

test("היום הנוכחי מסומן בתהליך ולא כחוסר", async ({ page }) => {
  const today = israelToday();
  await page.goto(`/app/report?month=${today.slice(0, 7)}&view=list`);
  const desktop = (page.viewportSize()?.width ?? 0) >= 768;
  const day = desktop ? page.locator(`tr[data-date="${today}"]`) : page.locator(`[data-report-date="${today}"]:visible`);
  await expect(day.getByText("בתהליך", { exact: true })).toBeVisible();
});

test("מלוח השנה אפשר להגיע ישירות לעריכת היום", async ({ page }) => {
  await page.goto("/app/report?month=2026-07&view=calendar");
  await page.getByRole("link", { name: "פתיחת יום לעריכה 2026-07-20" }).click();
  await expect(page).toHaveURL(/view=list&editDate=2026-07-20$/);
  await expect(page.locator('[data-report-date="2026-07-20"]:visible')).toBeFocused();
});
