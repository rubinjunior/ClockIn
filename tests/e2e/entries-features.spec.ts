import { expect, test } from "@playwright/test";

test("דיווח חדש נפתח בלי לבקש סיבת שינוי", async ({ page }) => {
  await page.goto("/app/entries");
  await page.getByRole("button", { name: "הוספת דיווח" }).click();
  const dialog = page.locator("dialog[open]");
  await expect(dialog.getByRole("heading", { name: "הוספת דיווח" })).toBeVisible();
  await expect(dialog.getByLabel("סיבת השינוי")).toHaveCount(0);
  await expect(dialog.getByLabel("כניסה")).toHaveAttribute("max", /T/);
});
