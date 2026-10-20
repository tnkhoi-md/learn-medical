// Nạp nội dung: bản đăng (content.enc, mã hóa bằng mật khẩu) hoặc bản phát triển (notes-data.js dạng thường).
(() => {
const $ = id => document.getElementById(id);
const load = src => new Promise((ok, err) => { const s = document.createElement("script"); s.src = src; s.async = false; s.onload = ok; s.onerror = () => err(new Error(src)); document.body.appendChild(s); });
const ENC = "content.enc", DATA_CACHE = "ykkb-data";   // bản đã tải lưu trong Cache API: lần sau mở ngay, không đợi mạng
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

// Tự khóa lại: mật khẩu được nhớ trên thiết bị, nhưng sẽ hỏi lại khi đã quá một khoảng thời gian kể từ lần cuối dùng trang.
// "Lần cuối dùng" = lần gần nhất trang còn hiện trên màn hình (cập nhật mỗi 30 giây khi đang xem và khi ẩn/ đóng tab).
const TO_OPTS = [[5, "5 phút"], [30, "30 phút"], [60, "1 giờ"], [480, "8 giờ"], [1440, "1 ngày"], [10080, "7 ngày"], [43200, "30 ngày"], [0, "Không bao giờ"]];
const TO_DEFAULT = 1440;
const timeoutMin = () => { const n = parseInt(store.get("ykkb_to"), 10); return TO_OPTS.some(o => o[0] === n) ? n : TO_DEFAULT; };
const lastSeen = () => parseInt(store.get("ykkb_last"), 10) || 0;
const expired = () => { const m = timeoutMin(), t = lastSeen(); return m > 0 && t > 0 && Date.now() - t > m * 60000; };
const touch = () => store.set("ykkb_last", String(Date.now()));
window.YKKB_LOCK = { options: TO_OPTS, get: timeoutMin, set: m => store.set("ykkb_to", String(m)), enc: false };
function fillTimeout(sel) { sel.innerHTML = TO_OPTS.map(([m, t]) => `<option value="${m}">${t}</option>`).join(""); sel.value = String(timeoutMin()); }
function watch() {
  touch();
  setInterval(() => { if (document.visibilityState === "visible") touch(); }, 30000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") touch();
    else if (expired()) { store.del("ykkb_pw"); location.reload(); }   // để tab quá hạn rồi quay lại: yêu cầu mật khẩu
  });
  addEventListener("pagehide", touch);
}

async function gunzip(u8) {
  if (typeof DecompressionStream === "undefined") throw new Error("gzip");
  return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
}

async function decrypt(buf, pw) {
  const u = new Uint8Array(buf), magic = new TextDecoder().decode(u.slice(0, 5));
  if (magic !== "YKKB1" && magic !== "YKKB2") throw new Error("format");
  const salt = u.slice(5, 21), iv = u.slice(21, 33), ct = u.slice(33);
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 600000, hash: "SHA-256" }, km, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  let plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct));
  if (magic === "YKKB2") plain = await gunzip(plain);
  return JSON.parse(new TextDecoder().decode(plain));
}

async function start(data) {
  if (data) { window.BUILD = data.BUILD; window.MODULES = data.MODULES; window.MODULES_EN = data.MODULES_EN; window.MODSPEC = data.MODSPEC; window.NOTES = data.NOTES; window.KHUNG = data.KHUNG; window.YKKB_LOCK.enc = true; }
  await Promise.all([load("khung.js"), load("app.js")]);
  const lock = $("lock"); if (lock) lock.hidden = true;
  if (data) watch();
}

// Hộp khóa có hai dạng: hỏi mật khẩu (form=true) hoặc chỉ hiện tiến độ/ thông báo (form=false)
function view(form, text) {
  $("lock").hidden = false;
  const meta = document.querySelector("#lock .meta"); if (meta) meta.hidden = !form;
  for (const e of [$("lock-pw"), $("lock-go"), $("lock-rem").parentElement, $("lock-to").parentElement]) e.hidden = !form;
  $("lock-msg").textContent = text || "";
}

function ask(buf, why) {
  view(true, why);
  const pw = $("lock-pw"), msg = $("lock-msg"), btn = $("lock-go"), rem = $("lock-rem"), to = $("lock-to");
  fillTimeout(to);
  btn.textContent = "Mở"; btn.disabled = false;
  const go = async () => {
    msg.textContent = ""; btn.disabled = true; btn.textContent = "Đang mở…";
    try {
      const data = await decrypt(buf, pw.value);
      if (rem.checked) store.set("ykkb_pw", pw.value); else store.del("ykkb_pw");
      window.YKKB_LOCK.set(to.value);
      await start(data); afterOpen();
    } catch (e) {
      msg.textContent = e.message === "format" ? "Tệp dữ liệu không đúng định dạng." : e.message === "gzip" ? "Trình duyệt quá cũ để giải nén nội dung. Hãy cập nhật trình duyệt." : (crypto.subtle ? "Mật khẩu chưa đúng." : "Trình duyệt cần kết nối https để giải mã.");
      btn.disabled = false; btn.textContent = "Mở";
    }
  };
  btn.onclick = go; pw.onkeydown = e => { if (e.key === "Enter") go(); };
  pw.focus();
}

let afterOpen = () => {};
const mb = n => (n / 1048576).toFixed(1);
// Tải content.enc kèm tiến độ; trả về null nếu không có file (bản phát triển), ném lỗi nếu mất mạng giữa chừng
async function download() {
  const r = await fetch(ENC, { cache: "no-cache" });
  if (!r.ok) return null;
  const total = +r.headers.get("content-length") || 0;
  if (!r.body || !r.body.getReader) return r.arrayBuffer();
  const rd = r.body.getReader(), parts = []; let got = 0;
  for (;;) {
    const { done, value } = await rd.read();
    if (done) break;
    parts.push(value); got += value.length;
    view(false, total ? `Đang tải nội dung… ${mb(got)} / ${mb(total)} MB` : `Đang tải nội dung… ${mb(got)} MB`);
  }
  const out = new Uint8Array(got); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out.buffer;
}

async function fetchEnc() {
  for (;;) {
    view(false, "Đang tải nội dung…");
    try { return await download(); }
    catch {
      await new Promise(ok => {
        view(false, "Mạng yếu hoặc mất kết nối nên chưa tải xong nội dung (chỉ cần tải một lần, các lần sau mở ngay).");
        const b = $("lock-go"); b.hidden = false; b.disabled = false; b.textContent = "Thử lại";
        b.onclick = () => { b.hidden = true; ok(); };
      });
    }
  }
}

// Sau khi đã mở xong: kiểm tra nền xem có bản nội dung mới không (không chặn việc đọc)
async function refresh(cache, old) {
  try {
    const r = await fetch(ENC, { cache: "no-cache" });
    if (r.status === 404) { await cache.delete(ENC); return; }   // đã đăng lại bản thường: bỏ bản lưu cũ
    if (!r.ok) return;
    const nb = await r.arrayBuffer(), a = new Uint8Array(nb, 0, 33), b = new Uint8Array(old, 0, 33);
    if (a.every((v, i) => v === b[i])) return;
    await cache.put(ENC, new Response(nb));
    const t = document.createElement("div");
    t.setAttribute("style", "position:fixed;left:12px;right:12px;bottom:76px;z-index:99;background:#0f766e;color:#fff;padding:10px 14px;border-radius:10px;font-size:14px;display:flex;gap:12px;align-items:center;justify-content:space-between;box-shadow:0 4px 16px rgba(0,0,0,.25)");
    t.innerHTML = "<span>Đã có nội dung mới.</span><button style=\"background:#fff;color:#0f766e;border:0;border-radius:8px;padding:6px 12px;font-weight:600\">Tải lại</button>";
    t.querySelector("button").onclick = () => location.reload();
    document.body.appendChild(t);
  } catch {}
}

(async () => {
  if ("serviceWorker" in navigator && (/^https:/.test(location.protocol) || location.search.includes("sw=1"))) navigator.serviceWorker.register("sw.js").catch(() => {});
  let cache = null, buf = null, cached = false;
  try { cache = await caches.open(DATA_CACHE); const hit = await cache.match(ENC); if (hit) { buf = await hit.arrayBuffer(); cached = true; } } catch {}
  if (!buf && location.protocol !== "file:") {
    buf = await fetchEnc();
    if (buf && cache) cache.put(ENC, new Response(buf.slice(0))).catch(() => {});
  }
  if (!buf) {
    // bản phát triển: dữ liệu thường
    try { await Promise.all([load("notes-data.js"), load("data/khung-data.js")]); await start(null); }
    catch { view(false, "Không tải được nội dung. Kiểm tra kết nối mạng, hoặc mở lại khi có mạng một lần để lưu dùng ngoại tuyến."); }
    return;
  }
  if (cached && cache) afterOpen = () => refresh(cache, buf);
  const saved = store.get("ykkb_pw");
  if (saved && expired()) { store.del("ykkb_pw"); ask(buf, "Đã quá thời gian ghi nhớ, nhập lại mật khẩu."); return; }
  if (saved) {
    view(false, "Đang mở…");
    try { await start(await decrypt(buf, saved)); afterOpen(); return; }
    catch (e) { if (e.message !== "gzip") store.del("ykkb_pw"); }
  }
  ask(buf);
})();
})();
