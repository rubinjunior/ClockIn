import { test, expect } from "@playwright/test";

test("שעון הדאשבורד נטען ללא שגיאת hydration", async ({ page }) => {
  const hydrationErrors: string[] = [];
  page.on("pageerror", (error) => {
    if (error.message.includes("Hydration failed")) hydrationErrors.push(error.message);
  });

  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "היום שלך" })).toBeVisible();
  await page.waitForTimeout(1200);
  expect(hydrationErrors).toEqual([]);
});
test("הפעלת השעון מציגה משוב חזותי ברור", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: "התחלת עבודה" }).click();
  await expect(page.getByText("השעון התחיל במצב הדגמה", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "סיום עבודה" })).toBeVisible();
});
test("הדאשבורד מציג פעולה יומית לפני מידע משני", async ({ page }) => {
  await page.goto("/app");
  const clock = page.getByRole("heading", { name: "היום שלך" });
  const week = page.getByRole("heading", { name: "התקדמות השבוע" });
  await expect(clock).toBeVisible();
  await expect(week).toBeVisible();
  expect((await clock.boundingBox())?.y ?? 0).toBeLessThan((await page.getByRole("heading", { name: "דיווחים אחרונים" }).boundingBox())?.y ?? 0);
  await expect(page.getByRole("progressbar", { name: "התקדמות השבוע" })).toHaveAttribute("aria-valuenow", /\d+/);
  await expect(page.locator("dialog")).toHaveCount(0);
});

test("אפשר להוסיף דיווח ידני מהדאשבורד בעורך יחיד", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: "הוספת דיווח" }).click();
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toHaveCount(1);
  await expect(dialog.getByLabel("סיבת השינוי")).toHaveCount(0);
  await page.getByRole("button", { name: "סגירת החלון" }).click();
  await expect(page.locator("dialog")).toHaveCount(0);
});

test("הדאשבורד נשאר ללא גלילה אופקית במובייל ובתצוגה רחבה", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/app");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator("html").evaluate((element) => element.classList.add("high-readability"));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});