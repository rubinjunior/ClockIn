import { AuthShell } from "@/components/auth/auth-shell";
import { ResetForm } from "@/components/auth/reset-form";
export default function ResetPasswordPage() { return <AuthShell title="בחירת סיסמה חדשה" description="הקישור שקיבלת יאפשר לעדכן את הסיסמה"><ResetForm/></AuthShell>; }