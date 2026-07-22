import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const subscriptionSchema = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(10), auth: z.string().min(5) }),
});
const deleteSchema = z.object({ endpoint: z.url() });

async function readJson(request: NextRequest) {
  try { return await request.json() as unknown; } catch { return null; }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "נדרשת כניסה" }, { status: 401 });

  const parsed = subscriptionSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ message: "פרטי ההתראה אינם תקינים" }, { status: 400 });

  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    user_agent: request.headers.get("user-agent"),
    disabled_at: null,
  }, { onConflict: "user_id,endpoint" });

  return error
    ? NextResponse.json({ message: "לא ניתן לשמור את ההתראה" }, { status: 500 })
    : NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "נדרשת כניסה" }, { status: 401 });

  const parsed = deleteSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ message: "פרטי ההתראה אינם תקינים" }, { status: 400 });

  const { error } = await supabase.from("push_subscriptions")
    .update({ disabled_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("endpoint", parsed.data.endpoint);

  return error
    ? NextResponse.json({ message: "לא ניתן לכבות את ההתראה" }, { status: 500 })
    : NextResponse.json({ ok: true });
}