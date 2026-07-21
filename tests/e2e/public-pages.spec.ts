import { test, expect } from "@playwright/test";
test("מסך הכניסה בעברית ובכיוון RTL",async({page})=>{await page.goto("/login");await expect(page.locator("html")).toHaveAttribute("dir","rtl");await expect(page.getByRole("heading",{name:"טוב לראות אותך"})).toBeVisible();await expect(page.getByRole("button",{name:"כניסה לחשבון"})).toBeVisible();});
test("המניפסט תקין",async({request})=>{const response=await request.get("/manifest.webmanifest");expect(response.ok()).toBeTruthy();expect((await response.json()).dir).toBe("rtl");});
test("דף לא מקוון נגיש",async({page})=>{await page.goto("/offline");await expect(page.getByRole("heading",{name:"אין חיבור לאינטרנט"})).toBeVisible();});
