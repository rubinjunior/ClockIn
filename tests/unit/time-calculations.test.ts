import { describe, expect, it } from "vitest";
import { calculateDailyBalance, calculateMonthlyBalance, estimateHourlyCompensation, isReminderDue, minutesBetween, sessionsOverlap, splitSessionByLocalDate } from "@/lib/time/calculations";
import { formatDuration, formatMinutes } from "@/lib/formatting";

describe("חישובי זמן", () => {
  it("מחשב יעד יומי משעות התחלה וסיום", () => expect(minutesBetween("09:00", "18:00")).toBe(540));
  it("מחשב משמרת שחוצה חצות", () => expect(minutesBetween("22:00", "06:00")).toBe(480));
  it("מחשב יום רגיל חסר", () => expect(calculateDailyBalance({date:"2026-07-20",expectedMinutes:510,workedMinutes:450,creditedAbsenceMinutes:0,manualAdjustmentMinutes:0}).missingMinutes).toBe(60));
  it("מחשב שעות נוספות", () => expect(calculateDailyBalance({date:"2026-07-20",expectedMinutes:480,workedMinutes:540,creditedAbsenceMinutes:0,manualAdjustmentMinutes:0}).overtimeMinutes).toBe(60));
  it("לא מסמן יום עתידי כחסר", () => expect(calculateDailyBalance({date:"2099-01-01",expectedMinutes:510,workedMinutes:0,creditedAbsenceMinutes:0,manualAdjustmentMinutes:0,future:true}).missingMinutes).toBe(0));
  it("מזכה חופשה מלאה", () => expect(calculateDailyBalance({date:"2026-07-20",expectedMinutes:510,workedMinutes:0,creditedAbsenceMinutes:510,manualAdjustmentMinutes:0}).finalBalanceMinutes).toBe(0));
  it("מזכה מחלה חלקית לצד עבודה", () => expect(calculateDailyBalance({date:"2026-07-20",expectedMinutes:510,workedMinutes:300,creditedAbsenceMinutes:210,manualAdjustmentMinutes:0}).finalBalanceMinutes).toBe(0));
  it("מחיל התאמה חיובית", () => expect(calculateDailyBalance({date:"2026-07-20",expectedMinutes:510,workedMinutes:480,creditedAbsenceMinutes:0,manualAdjustmentMinutes:30}).finalBalanceMinutes).toBe(0));
  it("מחיל התאמה שלילית", () => expect(calculateDailyBalance({date:"2026-07-20",expectedMinutes:510,workedMinutes:510,creditedAbsenceMinutes:0,manualAdjustmentMinutes:-30}).missingMinutes).toBe(30));
  it("יום חופשי עם עבודה מייצר יתרה", () => expect(calculateDailyBalance({date:"2026-07-18",expectedMinutes:0,workedMinutes:60,creditedAbsenceMinutes:0,manualAdjustmentMinutes:0}).overtimeMinutes).toBe(60));
  it("מסכם חודש", () => expect(calculateMonthlyBalance([calculateDailyBalance({date:"a",expectedMinutes:60,workedMinutes:30,creditedAbsenceMinutes:0,manualAdjustmentMinutes:0}),calculateDailyBalance({date:"b",expectedMinutes:60,workedMinutes:90,creditedAbsenceMinutes:0,manualAdjustmentMinutes:0})]).workedMinutes).toBe(120));
  it("מחשב שכר שעתי", () => expect(estimateHourlyCompensation(90,60)).toBe(90));
  it("מפרמט דקות ומשך", () => { expect(formatMinutes(-65)).toBe("−01:05"); expect(formatDuration(3661)).toBe("01:01:01"); });
});

describe("חציות וחפיפות", () => {
  it("מפצל דיווח שחוצה חצות בירושלים", () => expect(splitSessionByLocalDate({clockIn:"2026-07-20T20:00:00Z",clockOut:"2026-07-20T23:00:00Z"},"Asia/Jerusalem")).toEqual({"2026-07-20":60,"2026-07-21":120}));
  it("מפצל מעבר חודש", () => expect(Object.keys(splitSessionByLocalDate({clockIn:"2026-07-31T20:00:00Z",clockOut:"2026-07-31T23:00:00Z"},"Asia/Jerusalem"))).toEqual(["2026-07-31","2026-08-01"]));
  it("מפצל מעבר שנה", () => expect(Object.keys(splitSessionByLocalDate({clockIn:"2026-12-31T20:00:00Z",clockOut:"2026-12-31T23:00:00Z"},"Asia/Jerusalem"))).toEqual(["2026-12-31","2027-01-01"]));
  it("שומר משך נכון במעבר שעון קיץ", () => expect(Object.values(splitSessionByLocalDate({clockIn:"2026-03-26T23:00:00Z",clockOut:"2026-03-27T03:00:00Z"},"Asia/Jerusalem")).reduce((a,b)=>a+b,0)).toBe(240));
  it("מזהה חפיפה", () => expect(sessionsOverlap({clockIn:"2026-01-01T08:00:00Z",clockOut:"2026-01-01T10:00:00Z"},{clockIn:"2026-01-01T09:00:00Z",clockOut:"2026-01-01T11:00:00Z"})).toBe(true));
  it("לא מזהה מפגש קצוות כחפיפה", () => expect(sessionsOverlap({clockIn:"2026-01-01T08:00:00Z",clockOut:"2026-01-01T10:00:00Z"},{clockIn:"2026-01-01T10:00:00Z",clockOut:"2026-01-01T11:00:00Z"})).toBe(false));
  it("דוחה טווח הפוך", () => expect(() => splitSessionByLocalDate({clockIn:"2026-01-02T00:00:00Z",clockOut:"2026-01-01T00:00:00Z"},"UTC")).toThrow());
});

describe("תזכורות", () => {
  it("מזהה תזכורת בחלון המסירה", () => expect(isReminderDue("09:00",new Date("2026-07-19T06:02:00Z"),"Asia/Jerusalem",[0])).toBe(true));
  it("לא שולח ביום לא מוגדר", () => expect(isReminderDue("09:00",new Date("2026-07-20T06:02:00Z"),"Asia/Jerusalem",[0])).toBe(false));
  it("לא שולח מחדש מחוץ לחלון", () => expect(isReminderDue("09:00",new Date("2026-07-19T06:10:00Z"),"Asia/Jerusalem",[0])).toBe(false));
});
