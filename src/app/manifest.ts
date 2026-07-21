import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "ClockIn – מעקב שעות", short_name: "ClockIn", description: "מעקב שעות אישי, פשוט ומדויק", start_url: "/app", scope: "/", display: "standalone", background_color: "#f7f7f4", theme_color: "#3D348B", lang: "he", dir: "rtl", icons: [{ src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }] };
}
