import { test, expect } from "@playwright/test";

test("אפשר ליצור שגרת עבודה חדשה ולקבל אישור", async ({ page }) => {
  await page.goto("/app/settings");
  await expect(page.getByRole("combobox", { name: "אזור זמן" })).toHaveCount(0);
  await page.getByText("יצירת שגרה חדשה", { exact: true }).click();
  await page.getByRole("button", { name: "שמירת שגרה חדשה" }).click();
  await expect(page).toHaveURL(/result=schedule_saved/);
  await expect(page.getByText("שגרת העבודה נשמרה")).toBeVisible();
});

test("העדפות הנגישות פועלות ושומרות מצב", async ({ page }) => {
  await page.goto("/app/settings");
  await page.getByRole("button", { name: /נגישות/ }).click();
  const readability = page.getByRole("checkbox", { name: /קריאות גבוהה/ });
  await readability.check();
  await expect(page.locator("html")).toHaveClass(/high-readability/);
  await page.reload();
  await page.getByRole("button", { name: /נגישות/ }).click();
  await expect(page.getByRole("checkbox", { name: /קריאות גבוהה/ })).toBeChecked();
  await expect(page.locator("html")).toHaveClass(/high-readability/);
});
test("טפסי ההגדרות שומרים ומציגים משוב", async ({ page }) => {
  await page.goto("/app/settings");
  await page.getByRole("button", { name: /פרופיל/ }).click();
  await page.getByLabel("שם משתמש").fill("noa-demo");
  await page.getByRole("button", { name: "שמירת שינויים" }).click();
  await expect(page.getByText("הפרופיל נשמר")).toBeVisible();

  await page.getByRole("button", { name: /^שכר/ }).click();
  await page.getByText("עדכון תנאי שכר מתאריך", { exact: true }).click();
  await page.getByLabel("אופן הצגה").selectOption("hidden");
  await page.getByRole("button", { name: "שמירת תנאי שכר" }).click();
  await expect(page.getByText("הגדרת השכר נשמרה")).toBeVisible();

  await page.getByRole("button", { name: /חופשה ומחלה/ }).click();
  await page.getByLabel("מתאריך", { exact: true }).fill("2026-07-01");
  await page.getByLabel("עד תאריך").fill("2026-07-02");
  await page.getByRole("button", { name: "הוספת היעדרות" }).click();
  await expect(page.getByText("ההיעדרות נשמרה")).toBeVisible();

  await page.getByRole("button", { name: /חגים וימים מיוחדים/ }).click();
  await page.getByText("הוספת יום מיוחד", { exact: true }).click();
  await page.getByLabel("תאריך", { exact: true }).fill("2026-07-03");
  await page.getByLabel("שם היום").fill("יום בחירה");
  await page.getByRole("button", { name: "שמירת יום מיוחד" }).click();
  await expect(page.getByText("היום המיוחד נשמר")).toBeVisible();

  await page.getByRole("button", { name: /תזכורות/ }).click();
  await page.getByRole("button", { name: "שמירת תזכורות" }).click();
  await expect(page.getByText("התזכורות נשמרו")).toBeVisible();
});

test("מרכז ההגדרות מציג תחום אחד בכל פעם ללא גלילה אופקית", async ({ page }) => {
  await page.goto("/app/settings");
  await expect(page.getByRole("heading", { name: "שעות עבודה", level: 2 })).toBeVisible();
  await expect(page.getByLabel("שם משתמש")).toHaveCount(0);
  expect(await page.locator("form").count()).toBeLessThan(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("button", { name: /פרופיל/ }).click();
  await expect(page.getByRole("heading", { name: "פרופיל", level: 2 })).toBeVisible();
  await expect(page.getByLabel("שם משתמש")).toBeVisible();
  await expect(page.getByLabel("שם השגרה")).toHaveCount(0);
});

test("קישור קטגוריה פותח את שעות העבודה ואת שדה הקטגוריה", async ({ page }) => {
  await page.goto("/app/settings?newCategory=1#work-categories");
  await expect(page.getByRole("heading", { name: "שעות עבודה", level: 2 })).toBeVisible();
  await expect(page.getByLabel("שם הקטגוריה")).toBeFocused();
});