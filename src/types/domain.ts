export type EntrySource = "clock" | "manual" | "import";
export type LeaveType = "vacation" | "sick" | "custom";
export type ExceptionType = "holiday" | "shortened" | "day_off" | "special_workday";
export type AppRole = "user" | "admin";

export type CompensationMode = "hidden" | "hourly" | "global";

export interface TimeEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
  source: EntrySource;
  note?: string | null;
  edited?: boolean;
  categoryId?: string | null;
}

export interface WorkCategory {
  id: string;
  name: string;
  isActive: boolean;
}

export interface DailyCalculationInput {
  date: string;
  expectedMinutes: number;
  workedMinutes: number;
  creditedAbsenceMinutes: number;
  manualAdjustmentMinutes: number;
  future?: boolean;
}

export interface DailyBalance extends DailyCalculationInput {
  finalBalanceMinutes: number;
  missingMinutes: number;
  overtimeMinutes: number;
}

export interface ScheduleDay {
  weekday: number;
  isWorkday: boolean;
  expectedStart: string | null;
  expectedEnd: string | null;
  targetMinutes: number;
}
