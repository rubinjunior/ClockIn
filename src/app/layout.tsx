import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/shared/service-worker-registration";

export const metadata: Metadata = {
  title: { default: "ClockIn – מעקב שעות", template: "%s | ClockIn" },
  description: "מעקב שעות אישי, פשוט ומדויק",
  applicationName: "ClockIn",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "ClockIn" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon.svg" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#3D348B" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="he" dir="rtl"><body><a className="skip-link" href="#main-content">דילוג לתוכן הראשי</a>{children}<ServiceWorkerRegistration /></body></html>;
}
