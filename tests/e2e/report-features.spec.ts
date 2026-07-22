import { test, expect } from "@playwright/test";

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
  await expect(page.getByRole("heading", { name: "הוספת דיווח" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "קטגוריה" })).toBeVisible();
});
test("ערך עם סימן ממורכז בתוך עמודת המאזן", async ({ page }) => {
  await page.goto("/app/report?view=list");
  const desktop = (page.viewportSize()?.width ?? 0) >= 768;
  const container = desktop
    ? page.locator("tr[data-date]").first().locator("td").nth(5)
    : page.locator('article[id^="day-"]').first().locator("dd").nth(2);
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