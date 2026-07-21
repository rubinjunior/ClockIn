import { z } from "zod";

export const usernameSchema = z.string().trim().transform((value) => value.replace(/\s+/g, " ")).pipe(z.string().min(3, "שם המשתמש חייב לכלול 3 עד 30 תווים").max(30, "שם המשתמש חייב לכלול 3 עד 30 תווים").regex(/^[\p{L}\p{N}_\- ]+$/u, "שם המשתמש כולל תווים שאינם נתמכים"));
export const authSchema = z.object({ email: z.email("יש להזין כתובת דואר תקינה"), password: z.string().min(8, "הסיסמה חייבת לכלול לפחות 8 תווים") });
export const registrationSchema = authSchema.extend({ username: usernameSchema });
export const timeEntrySchema = z.object({
  id: z.uuid().optional(),
  clockIn: z.iso.datetime(),
  clockOut: z.iso.datetime(),
  note: z.string().trim().max(500).optional(),
  reason: z.string().trim().min(3, "יש לציין סיבה").max(250),
}).refine((value) => new Date(value.clockOut) > new Date(value.clockIn), { path: ["clockOut"], message: "שעת הסיום חייבת להיות אחרי שעת ההתחלה" });

export function normalizeUsername(value: string) {
  return value.trim().replace(/\s+/g, " ").normalize("NFKC").toLocaleLowerCase("he-IL");
}
