import { describe, expect, it } from "vitest";
import { canViewDebug } from "@/lib/auth/roles";

describe("debug role access", () => {
  it("allows only the admin role", () => {
    expect(canViewDebug("admin")).toBe(true);
    expect(canViewDebug("user")).toBe(false);
    expect(canViewDebug(undefined)).toBe(false);
    expect(canViewDebug("ADMIN")).toBe(false);
  });
});