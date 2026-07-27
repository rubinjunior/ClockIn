export function completedWorkedMinutes(
  value: number | string | null | undefined,
  firstClockIn: string | null | undefined,
  lastClockOut: string | null | undefined,
) {
  if (!firstClockIn || !lastClockOut) return 0;

  const start = new Date(firstClockIn).getTime();
  const end = new Date(lastClockOut).getTime();
  const minutes = Number(value);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 0;
}
