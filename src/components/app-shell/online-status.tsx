"use client";
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
export function OnlineStatus() { const [online, setOnline] = useState(true); useEffect(() => { const update = () => setOnline(navigator.onLine); update(); addEventListener("online", update); addEventListener("offline", update); return () => { removeEventListener("online", update); removeEventListener("offline", update); }; }, []); if (online) return null; return <div role="status" aria-live="polite" className="fixed inset-x-4 top-3 z-50 mx-auto flex max-w-sm items-center justify-center gap-2 rounded-full bg-[var(--warning)] px-4 py-2 text-sm font-bold text-white shadow-lg"><WifiOff aria-hidden size={17}/>אין חיבור לאינטרנט</div>; }
