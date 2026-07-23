import { expect, test } from "@playwright/test";

const routes = ["/app", "/app/entries", "/app/report", "/app/settings"] as const;

test("ניווט בין מסכי הליבה נותן משוב מהיר", async ({ page }) => {
  await page.goto(routes[0]);
  const results: Record<string, number> = {};

  for (const route of routes.slice(1)) {
    const startedAt = performance.now();
    await page.getByRole("link", { name: route === "/app/entries" ? "שעות" : route === "/app/report" ? "דוח" : "הגדרות" }).first().click();
    await page.waitForURL((url) => url.pathname === route);
    results[route] = Math.round(performance.now() - startedAt);
  }

  console.info("[navigation-timings]", results);
  for (const duration of Object.values(results)) expect(duration).toBeLessThan(1_500);
});
