import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotForm } from "@/components/auth/forgot-form";
export default function ForgotPage() { return <AuthShell title="איפוס סיסמה" description="נשלח אליך קישור מאובטח לבחירת סיסמה חדשה"><ForgotForm/><Link className="mt-5 block text-center text-sm font-bold text-[var(--primary)]" href="/login">חזרה לכניסה</Link></AuthShell>; }
