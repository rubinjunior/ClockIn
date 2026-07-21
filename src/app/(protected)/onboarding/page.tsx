import { Logo } from "@/components/shared/logo";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { requireUser } from "@/lib/supabase/session";
export default async function OnboardingPage() { const user = await requireUser(); return <div className="mx-auto max-w-xl"><header className="mb-6 flex items-center justify-between"><Logo/><span className="muted text-sm">אפשר להמשיך מאוחר יותר</span></header><section className="glass rounded-[28px] p-5 sm:p-8"><h1 className="sr-only">היכרות קצרה</h1><OnboardingWizard initialUsername={user.user_metadata.username ?? ""}/></section></div>; }
