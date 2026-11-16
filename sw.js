const CACHE = "keyspeaker-web-v6";
const FILES = ["./", "index.html", "styles.css?v=5", "splash-data.js?v=5", "app.js?v=5", "manifest.webmanifest", "assets/icon.svg"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then(r => { const c = r.clone(); caches.open(CACHE).then(ch => ch.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request).then(c => c || caches.match("index.html"))));
});
