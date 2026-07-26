import { expect, test } from "@playwright/test";

test("דיווח חדש נפתח בלי לבקש סיבת שינוי", async ({ page }) => {
  await page.goto("/app/entries");
  await page.getByRole("button", { name: "הוספת דיווח" }).click();
  const dialog = page.locator("dialog[open]");
  await expect(dialog.getByRole("heading", { name: "הוספת דיווח" })).toBeVisible();
  await expect(dialog.getByLabel("סיבת השינוי")).toHaveCount(0);
  await expect(dialog.getByLabel("כניסה")).toHaveAttribute("max", /T/);
  await dialog.getByLabel("כניסה").fill("2020-01-02T09:00");
  await dialog.getByLabel("יציאה").fill("2020-01-02T17:30");
  await expect(dialog.getByLabel("יציאה")).toHaveAttribute("min", "2020-01-02T09:00");
  await expect(dialog.getByText("08:30", { exact: true })).toBeVisible();
});

test("מסך השעות מציג סיכום חודשי קל ועורך יחיד", async ({ page }) => {
  await page.goto("/app/entries");
  await expect(page.getByText("סה״כ שעות")).toBeVisible();
  await expect(page.getByText("ימים עם דיווח")).toBeVisible();
  await expect(page.locator("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "הוספת דיווח" })).toHaveCount(1);
  expect(await page.locator("form").count()).toBeLessThan(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("button", { name: "הוספת דיווח" }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await page.getByRole("button", { name: "סגירת החלון" }).click();
  await expect(page.locator("dialog")).toHaveCount(0);
});

test("מסך השעות לא מציג חודשים עתידיים", async ({ page }) => {
  await page.goto("/app/entries?month=2099-12");
  await expect(page.getByLabel("בחירת חודש")).not.toHaveValue("2099-12");
  await expect(page.getByRole("button", { name: "לא ניתן להציג חודש עתידי" })).toBeDisabled();
});
test("מסך השעות נשאר יציב לרוחב ובקריאות גבוהה", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/app/entries");
  await page.locator("html").evaluate((element) => element.classList.add("high-readability"));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "הוספת דיווח" })).toBeVisible();
});