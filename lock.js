// Nạp nội dung: bản đăng (content.enc, mã hóa bằng mật khẩu) hoặc bản phát triển (notes-data.js dạng thường).
(() => {
const $ = id => document.getElementById(id);
const load = src => new Promise((ok, err) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => err(new Error(src)); document.body.appendChild(s); });
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

async function decrypt(buf, pw) {
  const u = new Uint8Array(buf);
  if (new TextDecoder().decode(u.slice(0, 5)) !== "YKKB1") throw new Error("format");
  const salt = u.slice(5, 21), iv = u.slice(21, 33), ct = u.slice(33);
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 600000, hash: "SHA-256" }, km, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(plain));
}

async function start(data) {
  if (data) { window.BUILD = data.BUILD; window.MODULES = data.MODULES; window.MODSPEC = data.MODSPEC; window.NOTES = data.NOTES; window.KHUNG = data.KHUNG; }
  await load("khung.js");
  await load("app.js");
  const lock = $("lock"); if (lock) lock.hidden = true;
}

function ask(buf) {
  const lock = $("lock"); lock.hidden = false;
  const pw = $("lock-pw"), msg = $("lock-msg"), btn = $("lock-go"), rem = $("lock-rem");
  const go = async () => {
    msg.textContent = ""; btn.disabled = true; btn.textContent = "Đang mở…";
    try {
      const data = await decrypt(buf, pw.value);
      if (rem.checked) store.set("ykkb_pw", pw.value); else store.del("ykkb_pw");
      await start(data);
    } catch (e) {
      msg.textContent = e.message === "format" ? "Tệp dữ liệu không đúng định dạng." : (crypto.subtle ? "Mật khẩu chưa đúng." : "Trình duyệt cần kết nối https để giải mã.");
      btn.disabled = false; btn.textContent = "Mở";
    }
  };
  btn.onclick = go; pw.onkeydown = e => { if (e.key === "Enter") go(); };
  pw.focus();
}

(async () => {
  if ("serviceWorker" in navigator && (/^https:/.test(location.protocol) || location.search.includes("sw=1"))) navigator.serviceWorker.register("sw.js").catch(() => {});
  let buf = null;
  try { const r = await fetch("content.enc", { cache: "no-cache" }); if (r.ok) buf = await r.arrayBuffer(); } catch {}
  if (!buf) {
    // bản phát triển: dữ liệu thường
    try { await load("notes-data.js"); await load("data/khung-data.js"); await start(null); }
    catch { const m = $("lock-msg"); $("lock").hidden = false; $("lock-pw").hidden = true; $("lock-go").hidden = true; $("lock-rem").parentElement.hidden = true; m.textContent = "Không tải được nội dung. Kiểm tra kết nối mạng, hoặc mở lại khi có mạng một lần để lưu dùng ngoại tuyến."; }
    return;
  }
  const saved = store.get("ykkb_pw");
  if (saved) { try { await start(await decrypt(buf, saved)); return; } catch { store.del("ykkb_pw"); } }
  ask(buf);
})();
})();
