import { Logo } from "@/components/shared/logo";
export function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <main id="main-content" className="min-h-dvh grid place-items-center p-4 sm:p-8"><div className="w-full max-w-md"><div className="mb-7 text-center"><Logo /><h1 className="mt-7 text-3xl font-extrabold tracking-tight">{title}</h1><p className="muted mt-2">{description}</p></div><section className="glass rounded-[28px] p-5 sm:p-7">{children}</section><p className="muted mt-5 text-center text-sm">המידע שלך נשאר פרטי ונגיש רק לך</p></div></main>;
}
