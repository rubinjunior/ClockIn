"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { registerAction } from "@/actions/auth-actions";
import { he } from "@/lib/i18n/he";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, {});
  const [username, setUsername] = useState("");
  const usernameValid = username.trim().length >= 3 && username.trim().length <= 30;
  return <form action={action} className="grid gap-5">
    <div className="field"><label htmlFor="username">{he.auth.username} <span aria-hidden>*</span></label><input className="input" id="username" name="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={30} aria-describedby="username-help" required/><p id="username-help" className="muted text-xs">3–30 תווים; אפשר להשתמש בעברית, באנגלית, במספרים, בקו מפריד ובקו תחתון{username && <span className={usernameValid ? " text-[var(--success)]" : " text-[var(--error)]"}> · {usernameValid ? "נראה מצוין" : "נדרשים לפחות 3 תווים"}</span>}</p></div>
    <div className="field"><label htmlFor="email">{he.auth.email} <span aria-hidden>*</span></label><input className="input" id="email" name="email" type="email" inputMode="email" autoComplete="email" dir="ltr" required/></div>
    <div className="field"><label htmlFor="password">{he.auth.password} <span aria-hidden>*</span></label><input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} aria-describedby="password-help" required/><p id="password-help" className="muted text-xs">לפחות 8 תווים</p></div>
    {state.error && <p role="alert" className="rounded-xl bg-[var(--error-soft)] p-3 text-sm text-[var(--error)]">{state.error}</p>}
    <button className="button-primary w-full" disabled={pending || !usernameValid}>{pending ? "יוצר את החשבון..." : he.auth.register}</button>
    <p className="text-center text-sm">{he.auth.haveAccount} <Link className="font-bold text-[var(--primary)]" href="/login">{he.auth.login}</Link></p>
  </form>;
}
