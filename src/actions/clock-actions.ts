"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { cookies } from "next/headers";

export type ClockResult = { ok: boolean; message: string; entry?: Record<string, unknown> };

export async function startClock(): Promise<ClockResult> {
  if (isDemoMode()) {
    const clockIn = new Date().toISOString();
    (await cookies()).set("clockin_demo_active", clockIn, { httpOnly: true, sameSite: "lax", path: "/" });
    revalidatePath("/app");
    return { ok: true, message: "השעון התחיל במצב הדגמה", entry: { clock_in: clockIn } };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_clock");
  if (error) return { ok: false, message: error.code === "23505" ? "השעון כבר פעיל" : "לא ניתן להתחיל את השעון" };
  revalidatePath("/app");
  return { ok: true, message: "השעון התחיל", entry: data as Record<string, unknown> };
}

export async function stopClock(): Promise<ClockResult> {
  if (isDemoMode()) {
    (await cookies()).delete("clockin_demo_active");
    revalidatePath("/app");
    return { ok: true, message: "יום העבודה הסתיים במצב הדגמה" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("stop_clock");
  if (error) return { ok: false, message: "לא נמצא שעון פעיל לסיום" };
  revalidatePath("/app");
  revalidatePath("/app/entries");
  return { ok: true, message: "יום העבודה הסתיים", entry: data as Record<string, unknown> };
}
