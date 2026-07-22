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