import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/shared/service-worker-registration";

const rubik = Rubik({ subsets: ["hebrew", "latin"], variable: "--font-rubik", display: "swap" });

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

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#6840D0" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="he" dir="rtl" className={rubik.variable}><body><a className="skip-link" href="#main-content">דילוג לתוכן הראשי</a>{children}<ServiceWorkerRegistration /></body></html>;
}
