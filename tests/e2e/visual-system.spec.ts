import { expect, test } from "@playwright/test";

test("מערכת העיצוב נשארת תקינה ברוחב 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/app");
  const visualState = await page.evaluate(() => ({
    fits: document.documentElement.scrollWidth <= window.innerWidth,
    primary: getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
    font: getComputedStyle(document.body).fontFamily,
  }));
  expect(visualState.fits).toBe(true);
  expect(visualState.primary).toBe("#6840d0");
  expect(visualState.font).toContain("Rubik");
  const clockAction = page.locator("section").filter({ has: page.getByRole("heading", { name: "היום שלך" }) }).getByRole("button");
  const box = await clockAction.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
});

test("מצב הפחתת תנועה מכבה אנימציות ממושכות", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/app");
  const duration = await page.locator(".app-main > *").first().evaluate((element) => Number.parseFloat(getComputedStyle(element).animationDuration));
  expect(duration).toBeLessThan(0.01);
});

test("הדוח נשאר ללא גלילה אופקית בטאבלט", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/app/report");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
