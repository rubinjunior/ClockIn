import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "ClockIn – מעקב שעות", short_name: "ClockIn", description: "מעקב שעות אישי, פשוט ומדויק", start_url: "/app", scope: "/", display: "standalone", background_color: "#f7f7f4", theme_color: "#3D348B", lang: "he", dir: "rtl", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" }, { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }] };
}
