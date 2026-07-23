import { test, expect } from "@playwright/test";
test("מסך הכניסה בעברית ובכיוון RTL",async({page})=>{await page.goto("/login");await expect(page.locator("html")).toHaveAttribute("dir","rtl");await expect(page.getByRole("heading",{name:"טוב לראות אותך"})).toBeVisible();await expect(page.getByRole("button",{name:"כניסה לחשבון"})).toBeVisible();});
test("המניפסט תקין",async({request})=>{const response=await request.get("/manifest.webmanifest");expect(response.ok()).toBeTruthy();expect((await response.json()).dir).toBe("rtl");});
test("דף לא מקוון נגיש",async({page})=>{await page.goto("/offline");await expect(page.getByRole("heading",{name:"אין חיבור לאינטרנט"})).toBeVisible();});
test("Service Worker לא שומר דפים מאומתים", async ({ request }) => {
  const response = await request.get("/sw.js");
  expect(response.ok()).toBeTruthy();
  const source = await response.text();
  expect(source).toContain("clockin-static-v4");
  expect(source).toContain('event.request.mode === "navigate"');
  expect(source).toContain('/brand/clockin-mark.png');
  expect(source).not.toContain("cache.put(event.request");
});

test("נכסים ציבוריים נשמרים ב-Cache ועמודים פרטיים לא", async ({ request }) => {
  const logo = await request.get("/brand/clockin-mark.png");
  expect(logo.headers()["cache-control"]).toContain("max-age=86400");
  expect(logo.headers()["cache-control"]).toContain("stale-while-revalidate");

  const app = await request.get("/app");
  expect(app.headers()["cache-control"] ?? "").not.toContain("public");
});
test("ההגדרה הראשונית לא מדלגת מהיעדרויות אל הדאשבורד", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "המשך" }).click();
  await expect(page.getByText("מתי עובדים?", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "המשך" }).click();
  await expect(page.getByText("איך להציג שכר?", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "המשך" }).click();
  await expect(page.getByText("כמעט סיימנו", { exact: true })).toBeVisible();
  await page.waitForTimeout(900);
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByText("כמעט סיימנו", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "המשך" }).click();
  await expect(page.getByText("הכול מוכן לבדיקה", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "סיום והתחלה" })).toBeDisabled();
  await page.waitForTimeout(800);
  await expect(page.getByRole("button", { name: "סיום והתחלה" })).toBeEnabled();
});
