"use client";
import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/actions/auth-actions";
import { he } from "@/lib/i18n/he";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});
  return <form action={action} className="grid gap-5">
    <div className="field"><label htmlFor="email">{he.auth.email}</label><input className="input" id="email" name="email" type="email" inputMode="email" autoComplete="email" dir="ltr" required /></div>
    <div className="field"><div className="flex items-center justify-between"><label htmlFor="password">{he.auth.password}</label><Link href="/forgot-password" className="text-sm font-semibold text-[var(--primary)]">{he.auth.forgot}</Link></div><input className="input" id="password" name="password" type="password" autoComplete="current-password" minLength={8} required /></div>
    {state.error && <p role="alert" className="rounded-xl bg-[var(--error-soft)] p-3 text-sm text-[var(--error)]">{state.error}</p>}
    <button className="button-primary w-full" disabled={pending}>{pending ? "מתבצעת כניסה..." : he.auth.login}</button>
    <p className="text-center text-sm">{he.auth.noAccount} <Link className="font-bold text-[var(--primary)]" href="/register">{he.auth.register}</Link></p>
  </form>;
}
