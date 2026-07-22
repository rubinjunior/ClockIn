import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import webpush from "web-push";
import { isReminderDue } from "@/lib/time/calculations";

type PushFailure = { statusCode?: number; code?: string };

function localDate(now: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export async function POST(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: "אין הרשאה" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!url || !key || !publicKey || !privateKey || !subject) {
    return NextResponse.json({ message: "חסרה תצורת שרת" }, { status: 503 });
  }

  const db = createAdmin(url, key, { auth: { persistSession: false } });
  webpush.setVapidDetails(subject, publicKey, privateKey);
  const now = new Date();
  const settingsResult = await db.from("reminder_settings")
    .select("user_id,reminder_type,local_time,timezone,weekdays")
    .eq("enabled", true);
  if (settingsResult.error) return NextResponse.json({ message: "לא ניתן לטעון תזכורות" }, { status: 500 });

  let sent = 0;
  for (const setting of settingsResult.data ?? []) {
    if (!isReminderDue(setting.local_time, now, setting.timezone, setting.weekdays)) continue;
    const date = localDate(now, setting.timezone);
    const deliveryResult = await db.from("notification_deliveries").insert({
      user_id: setting.user_id,
      reminder_type: setting.reminder_type,
      scheduled_for: now.toISOString(),
      scheduled_local_date: date,
      scheduled_local_time: setting.local_time,
      status: "pending",
    });
    if (deliveryResult.error?.code === "23505") continue;
    if (deliveryResult.error) return NextResponse.json({ message: "לא ניתן לתעד תזכורת" }, { status: 500 });

    const subscriptionsResult = await db.from("push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("user_id", setting.user_id)
      .is("disabled_at", null);
    let settingSent = 0;
    let lastError: string | null = subscriptionsResult.error?.code ?? null;

    for (const subscription of subscriptionsResult.data ?? []) {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, JSON.stringify({
          title: "ClockIn",
          body: setting.reminder_type === "clock_in"
            ? "בוקר טוב, הגיע הזמן להתחיל את יום העבודה"
            : "לפני שמסיימים, לא לשכוח לעצור את השעון",
          url: "/app",
        }));
        settingSent += 1;
        sent += 1;
        await db.from("push_subscriptions").update({ last_success_at: now.toISOString() }).eq("id", subscription.id);
      } catch (error) {
        const failure = error as PushFailure;
        lastError = failure.code ?? (failure.statusCode ? String(failure.statusCode) : "push_failed");
        if (failure.statusCode === 404 || failure.statusCode === 410) {
          await db.from("push_subscriptions").update({ disabled_at: now.toISOString() }).eq("id", subscription.id);
        }
      }
    }

    await db.from("notification_deliveries").update({
      status: settingSent > 0 ? "sent" : "failed",
      error_code: settingSent > 0 ? null : (lastError ?? "no_active_subscription"),
    })
      .eq("user_id", setting.user_id)
      .eq("reminder_type", setting.reminder_type)
      .eq("scheduled_local_date", date)
      .eq("scheduled_local_time", setting.local_time);
  }

  return NextResponse.json({ ok: true, sent });
}