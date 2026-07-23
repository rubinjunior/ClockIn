"use client";

import { useFormStatus } from "react-dom";

export function SettingsSubmitButton({ children, className = "button-primary" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending}>{pending ? <><span>שומר</span><span className="loading-dots loading-dots-inline" aria-hidden><i/><i/><i/></span></> : children}</button>;
}
