const CACHE = "keyspeaker-web-v7";
const FILES = ["./", "index.html", "styles.css?v=6", "splash-data.js?v=6", "app.js?v=6", "manifest.webmanifest", "assets/icon.svg"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then(r => { if (r.ok && r.status === 200) { const c = r.clone(); caches.open(CACHE).then(ch => ch.put(e.request, c)).catch(() => {}); } return r; })
    .catch(() => caches.match(e.request).then(c => c || caches.match("index.html"))));
});
