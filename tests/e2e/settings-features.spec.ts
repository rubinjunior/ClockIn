import { test, expect } from "@playwright/test";

test("אפשר ליצור שגרת עבודה חדשה ולקבל אישור", async ({ page }) => {
  await page.goto("/app/settings");
  await expect(page.getByText("ישראל · Asia/Jerusalem").first()).toBeVisible();
  await expect(page.getByRole("combobox", { name: "אזור זמן" })).toHaveCount(0);
  await page.getByText("יצירת שגרה חדשה", { exact: true }).click();
  await page.getByRole("button", { name: "שמירת שגרה חדשה" }).click();
  await expect(page).toHaveURL(/result=schedule_saved/);
  await expect(page.getByText("שגרת העבודה נשמרה")).toBeVisible();
});

test("העדפות הנגישות פועלות ושומרות מצב", async ({ page }) => {
  await page.goto("/app/settings");
  const readability = page.getByRole("checkbox", { name: /קריאות גבוהה/ });
  await readability.check();
  await expect(page.locator("html")).toHaveClass(/high-readability/);
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /קריאות גבוהה/ })).toBeChecked();
  await expect(page.locator("html")).toHaveClass(/high-readability/);
});
test("טפסי ההגדרות שומרים ומציגים משוב", async ({ page }) => {
  await page.goto("/app/settings");
  await page.getByLabel("שם משתמש").fill("noa-demo");
  await page.getByRole("button", { name: "שמירת שינויים" }).click();
  await expect(page.getByText("הפרופיל נשמר")).toBeVisible();

  await page.getByText("הוספת תנאי שכר מתאריך", { exact: true }).click();
  await page.getByLabel("אופן הצגה").selectOption("hidden");
  await page.getByRole("button", { name: "שמירת תנאי שכר" }).click();
  await expect(page.getByText("הגדרת השכר נשמרה")).toBeVisible();

  await page.getByLabel("מתאריך", { exact: true }).fill("2026-07-01");
  await page.getByLabel("עד תאריך").fill("2026-07-02");
  await page.getByRole("button", { name: "הוספת היעדרות" }).click();
  await expect(page.getByText("ההיעדרות נשמרה")).toBeVisible();

  await page.getByLabel("תאריך", { exact: true }).fill("2026-07-03");
  await page.getByLabel("שם היום").fill("יום בחירה");
  await page.getByRole("button", { name: "שמירת יום מיוחד" }).click();
  await expect(page.getByText("היום המיוחד נשמר")).toBeVisible();

  await page.getByRole("button", { name: "שמירת תזכורות" }).click();
  await expect(page.getByText("התזכורות נשמרו")).toBeVisible();
});
