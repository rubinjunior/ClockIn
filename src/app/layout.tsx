import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/shared/service-worker-registration";

export const metadata: Metadata = {
  title: { default: "ClockIn – מעקב שעות", template: "%s | ClockIn" },
  description: "מעקב שעות אישי, פשוט ומדויק",
  applicationName: "ClockIn",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "ClockIn" },
  icons: {
    icon: [{ url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#3D348B" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="he" dir="rtl"><body><a className="skip-link" href="#main-content">דילוג לתוכן הראשי</a>{children}<ServiceWorkerRegistration /></body></html>;
}