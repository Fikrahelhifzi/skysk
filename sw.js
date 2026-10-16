/*
 * Service worker: game bisa dibuka & dimainkan tanpa internet setelah kunjungan pertama.
 * Berkas game diambil dari jaringan dulu (supaya versi baru langsung terpakai),
 * lalu dari cache bila offline. Naikkan VERSION untuk membuang cache lama.
 */
const VERSION = "skystriker-v1.0.0";
const SHELL = [
  "./", "./index.html", "./styles.css", "./manifest.webmanifest",
  "./js/main.js", "./js/logic.js", "./js/params.js", "./js/rng.js", "./js/render.js", "./js/ui.js",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match("./index.html"))),
  );
});
