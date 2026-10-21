/* Y khoa KB: chế độ ngoại tuyến. publish.py tự đổi VERSION mỗi lần phát hành. */
const VERSION = "3a67c380";
const CORE = "ykkb-core-" + VERSION;
const SHELL = ["./", "index.html", "lock.js", "app.js", "khung.js", "styles.css", "manifest.webmanifest", "ecg/index.html", "cxr/index.html", "cxr/normal-pa.webp", "cxr/effusion.webp", "cxr/pneu.webp", "cxr/atel.webp", "cxr/edema.webp", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "icons/mark-192.png"];

const DATA = [];   // chỉ bản thường; publish.py --encrypt đặt thành [] (nội dung nằm trong content.enc do lock.js tự lưu)

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CORE);
    await Promise.all(SHELL.concat(DATA).map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CORE && k !== "ykkb-data") await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // content.enc do lock.js tự lưu và kiểm tra bản mới (Cache "ykkb-data"), service worker không chen vào
  if (url.pathname.endsWith("/content.enc")) return;
  // dữ liệu bản thường: ưu tiên bản mới từ mạng, mất mạng thì dùng bản đã lưu
  if (/\/(notes-data\.js|khung-data\.js)$/.test(url.pathname)) {
    e.respondWith((async () => {
      const c = await caches.open(CORE);
      try { const r = await fetch(req, { cache: "no-cache" }); if (r.ok) c.put(req, r.clone()); return r; }
      catch { const hit = await c.match(req, { ignoreSearch: true }); return hit || Response.error(); }
    })());
    return;
  }
  // phần còn lại: lưu sẵn, có thì dùng ngay, đồng thời làm mới nền
  e.respondWith((async () => {
    const c = await caches.open(CORE);
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || Response.error();
  })());
});
