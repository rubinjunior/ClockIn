import { describe, expect, it } from "vitest";
import { sanitizeDebugText } from "@/lib/debug/sanitize";

describe("סינון דיבאג", () => {
  it("מסתיר כתובות מייל ומפתחות Supabase", () => {
    const value = sanitizeDebugText("user@example.com sb_secret_abcdef sb_publishable_12345");
    expect(value).not.toContain("user@example.com");
    expect(value).not.toContain("sb_secret_");
    expect(value).not.toContain("sb_publishable_");
  });

  it("מסתיר Authorization, JWT ומזהים", () => {
    const value = sanitizeDebugText("Bearer abc.def.ghi eyJabc.def.ghi 123e4567-e89b-42d3-a456-426614174000");
    expect(value).not.toContain("abc.def.ghi");
    expect(value).not.toContain("123e4567");
  });

  it("מסיר query ו-fragment מכתובות", () => {
    expect(sanitizeDebugText("GET https://clockin.test/api/items?token=secret#private")).toBe("GET https://clockin.test/api/items");
    expect(sanitizeDebugText("POST /api/items?token=secret")).toBe("POST /api/items");
  });

  it("מגביל אורך הודעות", () => {
    const value = sanitizeDebugText("a".repeat(500), 40);
    expect(value).toHaveLength(40);
    expect(value.endsWith("…")).toBe(true);
  });
});