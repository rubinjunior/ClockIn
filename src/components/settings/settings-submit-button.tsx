"use client";

import { useFormStatus } from "react-dom";

export function SettingsSubmitButton({ children, className = "button-primary" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending}>{pending ? "שומר..." : children}</button>;
}