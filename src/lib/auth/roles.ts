export type AppRole = "user" | "admin";

export function canViewDebug(role: unknown): role is "admin" {
  return role === "admin";
}