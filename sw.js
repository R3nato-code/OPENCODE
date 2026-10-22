const VERSION = "vila-esfirra-v1";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icons/favicon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await Promise.allSettled(CORE_ASSETS.map((url) => cache.add(url)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

const CACHEABLE_ORIGINS = [self.location.origin, "https://fonts.googleapis.com", "https://fonts.gstatic.com"];

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(VERSION);
          cache.put("./", fresh.clone());
          return fresh;
        } catch {
          return (await caches.match(request)) || (await caches.match("./index.html"));
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const fresh = await fetch(request);
        const url = new URL(request.url);
        if (fresh.ok && CACHEABLE_ORIGINS.includes(url.origin)) {
          const cache = await caches.open(VERSION);
          cache.put(request, fresh.clone());
        }
        return fresh;
      } catch {
        return new Response("", { status: 504, statusText: "Offline" });
      }
    })()
  );
});
