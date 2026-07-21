"use client";
import Link from "next/link";
import { useActionState } from "react";
import { updatePassword } from "@/actions/password-actions";
export function ResetForm(){const[state,action,pending]=useActionState(updatePassword,{});return <form action={action} className="grid gap-5"><div className="field"><label htmlFor="password">סיסמה חדשה</label><input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required/></div>{state.error&&<p role="alert" className="rounded-xl bg-[var(--error-soft)] p-3 text-sm text-[var(--error)]">{state.error}</p>}{state.success&&<p role="status" className="rounded-xl bg-[var(--success-soft)] p-3 text-sm text-[var(--success)]">{state.success} · <Link className="font-bold" href="/login">כניסה לחשבון</Link></p>}<button className="button-primary" disabled={pending}>{pending?"שומר...":"שמירת הסיסמה"}</button></form>}
