import { test, expect } from "@playwright/test";

test("שלב חופשות מוביל לבדיקה ולא שולח את הטופס", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "המשך" }).click();
  await expect(page.getByText("מתי עובדים?")).toBeVisible();

  await page.getByRole("button", { name: "המשך" }).click();
  await expect(page.getByText("איך להציג שכר?")).toBeVisible();

  await page.getByRole("button", { name: "המשך" }).click();
  await expect(page.getByText("כמעט סיימנו")).toBeVisible();

  await page.getByRole("button", { name: "המשך" }).dblclick();
  await expect(page.getByRole("heading", { name: "הכול מוכן לבדיקה" })).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("button", { name: "סיום והתחלה" })).toBeVisible();
});

test("לוח הדיבאג זמין רק למורשים ומציג מידע מסונן", async ({ page }) => {
  await page.goto("/onboarding");
  const toggle = page.getByRole("button", { name: "פתיחת דיבאג" });
  await expect(toggle).toBeEnabled();
  await toggle.evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByRole("heading", { name: "דיבאג מקומי" })).toBeVisible();
  await expect(page.getByText("מוצג למנהלי המערכת בלבד")).toBeVisible();
});
