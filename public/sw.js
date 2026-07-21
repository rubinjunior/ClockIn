const CACHE = "clockin-shell-v1";
const SHELL = ["/offline", "/icons/icon.svg", "/manifest.webmanifest"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then((cached) => cached || (event.request.mode === "navigate" ? caches.match("/offline") : undefined))));
});
self.addEventListener("push", (event) => { const data = event.data?.json() ?? { title: "ClockIn", body: "הגיע הזמן לעדכן את דיווח השעות" }; event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/icons/icon.svg", badge: "/icons/icon.svg", dir: "rtl", lang: "he", data: { url: data.url || "/app" } })); });
self.addEventListener("notificationclick", (event) => { event.notification.close(); event.waitUntil(self.clients.openWindow(event.notification.data.url)); });
