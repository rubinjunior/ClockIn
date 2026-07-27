import { describe, expect, it } from "vitest";
import { categoryNameKey, findCategoryByName } from "@/lib/categories/name";

describe("category names", () => {
  it("matches an archived category regardless of whitespace and case", () => {
    const archived = { id: "archived", name: "עבודה מהבית", is_active: false };
    expect(findCategoryByName([archived], "  עבודה מהבית  ")).toBe(archived);
    expect(findCategoryByName([{ ...archived, name: "HOME" }], "home")?.id).toBe("archived");
  });

  it("normalizes compatibility characters consistently", () => {
    expect(categoryNameKey("  ＨＯＭＥ  ")).toBe(categoryNameKey("home"));
  });
});
