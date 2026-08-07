import { test, expect } from "@playwright/test";
function israelToday() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function shiftDate(date: string, days: number) {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

test("דוח ריק מתחיל באפס ומאפשר מעבר ללוח שנה", async ({ page }) => {
  await page.goto("/app/report?month=2026-07");
  const overview = page.getByRole("heading", { name: "מאזן נוכחי" }).locator("xpath=ancestor::section");
  await expect(overview.getByText("שעות בפועל", { exact: true })).toBeVisible();
  await expect(overview.getByText("00:00", { exact: true }).first()).toBeVisible();

  await page.getByRole("link", { name: "לוח שנה" }).click();
  await expect(page).toHaveURL(/view=calendar/);
  await expect(page.getByRole("link", { name: "רשימה" })).toBeVisible();
  const fitsViewport = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fitsViewport).toBe(true);
});

test("חצי החודשים שומרים על משמעות כיוונית בממשק RTL", async ({ page }) => {
  await page.goto("/app/report?month=2026-08");
  const previous = page.getByRole("link", { name: "החודש הקודם" });
  const next = page.getByRole("link", { name: "החודש הבא" });
  const [previousBox, nextBox] = await Promise.all([previous.boundingBox(), next.boundingBox()]);
  expect(previousBox).not.toBeNull();
  expect(nextBox).not.toBeNull();
  expect(previousBox!.x).toBeGreaterThan(nextBox!.x);

  await next.click();
  await expect(page).toHaveURL(/month=2026-09/);
  await page.goto("/app/report?month=2026-08");
  await page.getByRole("link", { name: "החודש הקודם" }).click();
  await expect(page).toHaveURL(/month=2026-07/);
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
  await expect(modal.getByText("ניתן לדווח עד סוף היום הנוכחי; ימים עתידיים חסומים")).toBeVisible();
  await expect(modal.getByLabel("כניסה")).toHaveAttribute("max", /T23:59$/);
  await expect(modal.getByLabel("סיבת השינוי")).toHaveCount(0);
  await expect(page.locator("dialog")).toHaveCount(1);
  await modal.getByRole("button", { name: "שמירה" }).click();
  await expect(page.getByRole("status").filter({ hasText: "הדיווח נשמר לצורך ההדגמה" })).toBeVisible();
  await expect(page.locator("dialog")).toHaveCount(0);
});

test("אפשר להזין שעות מאוחרות מהשעה הנוכחית בתוך אותו היום", async ({ page }) => {
  const today = israelToday();
  await page.goto(`/app/report?month=${today.slice(0, 7)}&view=list`);
  await page.getByRole("button", { name: `הוספת דיווח ${today}` }).click();
  const modal = page.locator("dialog[open]");
  await modal.getByLabel("כניסה").fill(`${today}T22:00`);
  await modal.getByLabel("יציאה").fill(`${today}T23:00`);
  await modal.getByRole("button", { name: "שמירה" }).click();
  await expect(page.getByRole("status").filter({ hasText: "הדיווח נשמר לצורך ההדגמה" })).toBeVisible();
});
test("טבלת הפירוט מציגה את שבע העמודות המבוקשות ושומרת על יישור", async ({ page }) => {
  await page.goto("/app/report?month=2026-07&view=list");
  const dailyTable = page.getByRole("table", { name: "פירוט יומי" });
  await expect(dailyTable).toBeVisible();
  expect(await dailyTable.locator('[role="columnheader"]').allTextContents()).toEqual([
    "תאריך",
    "שעת התחלה",
    "שעת סיום",
    "שעות בפועל",
    "הערות",
    "סטטוס",
    "עריכה",
  ]);
  const row = dailyTable.locator("[data-date]:visible").first();
  await expect(row.getByRole("cell")).toHaveCount(7);
  const container = row.locator('[data-cell="worked"]');
  const value = container.locator(":scope > span.metric-value");
  await expect(value).toBeVisible();
  const centers = await Promise.all([container.boundingBox(), value.boundingBox()]);
  expect(centers[0]).not.toBeNull();
  expect(centers[1]).not.toBeNull();
  const cellCenter = centers[0]!.x + centers[0]!.width / 2;
  const valueCenter = centers[1]!.x + centers[1]!.width / 2;
  expect(Math.abs(cellCenter - valueCenter)).toBeLessThanOrEqual(1);
  await expect(value).toHaveCSS("direction", "ltr");
  await expect(container).toContainText("תקן 08:30" );
  await expect(container).toContainText("הפרש −08:30" );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test("ימים שלא סומנו כימי עבודה מוצגים ללא תקן, הפרש או חוסר", async ({ page }) => {
  await page.goto("/app/report?month=2026-07&view=list");
  for (const date of ["2026-07-03", "2026-07-04"]) {
    const row = page.locator(`[data-date="${date}"]:visible`);
    await expect(row.locator('[data-cell="worked"] > span.metric-value')).toHaveText("00:00");
    await expect(row.locator('[data-cell="worked"]')).not.toContainText("תקן");
    await expect(row.locator('[data-cell="status"]')).toContainText("—");
    await expect(row.locator('[data-cell="status"]')).not.toContainText("חסר דיווח");
  }

  const missingReport = page.locator('[data-date="2026-07-02"]:visible').getByText("חסר דיווח", { exact: true });
  await expect(missingReport).toHaveCSS("background-color", "rgb(255, 250, 250)");
});
test("לא ניתן להוסיף דיווח ליום עתידי", async ({ page }) => {
  const tomorrow = shiftDate(israelToday(), 1);
  await page.goto(`/app/report?month=${tomorrow.slice(0, 7)}&view=list`);
  await expect(page.getByRole("button", { name: `הוספת דיווח ${tomorrow}` })).toHaveCount(0);
});
test("שכר משוער מוצג בבית ולא בדוח", async ({ page }) => {
  await page.goto("/app");
  const compensationCard = page.getByRole("heading", { name: "שכר משוער החודש" }).locator("..");
  await expect(compensationCard.getByText(/₪/)).toBeVisible();
  await expect(compensationCard.getByText(/לפני ניכויים ותוספות/)).toBeVisible();

  await page.goto("/app/report?month=2026-07");
  await expect(page.getByText("שכר משוער החודש", { exact: true })).toHaveCount(0);
});


test("היום הנוכחי אינו מסומן כחסר דיווח", async ({ page }) => {
  const today = israelToday();
  await page.goto(`/app/report?month=${today.slice(0, 7)}&view=list`);
  const day = page.locator(`[data-report-date="${today}"]:visible`);
  await expect(day).toBeVisible();
  await expect(day.locator('[data-cell="status"]')).not.toContainText("חסר דיווח");
});

test("מלוח השנה אפשר להגיע ישירות לעריכת היום", async ({ page }) => {
  await page.goto("/app/report?month=2026-07&view=calendar");
  await page.getByRole("link", { name: "פתיחת יום לעריכה 2026-07-20" }).click();
  await expect(page).toHaveURL(/view=list&editDate=2026-07-20$/);
  await expect(page.locator('[data-report-date="2026-07-20"]:visible')).toBeFocused();
});

test("הדוח מציג תמיד מצב נוכחי ללא בחירת טווח", async ({ page }) => {
  await page.goto("/app/report?month=2026-07&mode=full");
  await expect(page.getByRole("heading", { name: "מאזן נוכחי" })).toBeVisible();
  await expect(page.getByText("תקן מצטבר", { exact: true })).toBeVisible();
  await expect(page.getByText("תקן חודשי מלא", { exact: true })).toBeVisible();
  await expect(page.getByText("ימי עבודה שנותרו", { exact: true })).toBeVisible();
  await expect(page.getByText("עד היום", { exact: true })).toHaveCount(0);
  await expect(page.getByText("חודש מלא", { exact: true })).toHaveCount(0);
  const reportLinks = await page.locator('a[href^="?"]').evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  expect(reportLinks.every((href) => !href.includes("mode="))).toBe(true);
  await expect(page.getByText("איך חושב התקן?", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "דורש תשומת לב" })).toHaveCount(0);
});

test("בחירת שבוע מסננת את הפירוט היומי", async ({ page }) => {
  await page.goto("/app/report?month=2026-07");
  await page.getByRole("link").filter({ hasText: "שבוע 1" }).first().click();
  await expect(page).toHaveURL(/week=2026-06-28/);
  await expect(page.getByText("הפירוט מסונן: שבוע 1", { exact: true })).toBeVisible();
  await expect(page.locator("[data-date]:visible")).toHaveCount(4);
});

test("ההתראות מוצגות בבית ומובילות לדוח המסונן", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "דורש תשומת לב" })).toBeVisible();
  await page.getByRole("link").filter({ hasText: "ימים ללא דיווח" }).first().click();
  await expect(page).toHaveURL(/status=missingReport/);
  await expect(page.getByText(/הפירוט מסונן: חסר דיווח/)).toBeVisible();
});

test("יום ללא שעת התחלה או סיום מציג אפס שעות בפועל", async ({ page }) => {
  await page.goto("/app/report?month=2026-07&view=list");
  const day = page.locator('[data-date="2026-07-01"]:visible');
  await expect(day.locator('[data-cell="start"]')).toContainText("—");
  await expect(day.locator('[data-cell="end"]')).toContainText("—");
  await expect(day.locator('[data-cell="worked"]').getByText("00:00", { exact: true })).toBeVisible();
});
test("יום עתידי מציג אפס שעות ללא זמני דיווח", async ({ page }) => {
  const tomorrow = shiftDate(israelToday(), 1);
  await page.goto(`/app/report?month=${tomorrow.slice(0, 7)}&view=list`);
  const future = page.locator(`[data-date="${tomorrow}"]:visible`);
  await expect(future.getByText("עתידי", { exact: true })).toBeVisible();
  await expect(future.locator('[data-cell="start"]')).toContainText("—");
  await expect(future.locator('[data-cell="end"]')).toContainText("—");
  await expect(future.locator('[data-cell="worked"] > span.metric-value')).toHaveText("00:00");
});
test("המאזן והניתוחים מופיעים לפני הפירוט היומי והדוח לא מרנדר עשרות טפסים", async ({ page }) => {
  await page.goto("/app/report?month=2026-07");
  const positions = await Promise.all([
    page.getByRole("heading", { name: "פירוט יומי" }).boundingBox(),
    page.getByRole("heading", { name: "מאזן נוכחי" }).boundingBox(),
  ]);
  expect(positions[0]).not.toBeNull();
  expect(positions[1]).not.toBeNull();
  expect(positions[1]!.y).toBeLessThan(positions[0]!.y);
  await expect(page.locator("dialog")).toHaveCount(0);
  expect(await page.locator("form").count()).toBeLessThan(5);
});