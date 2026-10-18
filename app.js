(() => {
const NOTES = window.NOTES || [], MODULES = window.MODULES || {}, MODULES_EN = window.MODULES_EN || {}, MODSPEC = window.MODSPEC || {};
// Module hiển thị dưới mục "Khác" thay vì danh sách Module (vẫn mở được bằng #/m/<id>/<mục>)
const KHAC_MODS = ["doc-ecg"];
const mainMods = () => Object.keys(MODULES).filter(m => !KHAC_MODS.includes(m));
// Tên module kèm tên tiếng Anh (nhỏ, sau tên Việt) khi có
const modLabel = m => esc(MODULES[m] || m) + (MODULES_EN[m] ? ` <small class="en">${esc(MODULES_EN[m])}</small>` : "");
// Khung các mục của một chuyên khoa (module)
// Các tab của trang bệnh (số nội bộ trong file: 3–9; 10 = "Theo dõi" tách từ mục 8 khi hiển thị)
// Màu của từng tab bệnh (--t1…--t7, --tsum): mỗi tab một màu riêng, không trùng nhau
const SECS = [
  [3, "Tổng quan", "t1"],
  [4, "Triệu chứng học", "t2"],
  [5, "Cận lâm sàng", "t3"],
  [6, "Chẩn đoán", "t4"],
  [7, "Điều trị", "t5"],
  [10, "Theo dõi đánh giá", "t6"],
  [8, "Tiên lượng – Dự phòng", "t7"],
];
const SECNAME = { ...Object.fromEntries(SECS.map(([n, t]) => [n, t])), 9: "Tóm tắt (Pareto)" };
const SECCOL = { ...Object.fromEntries(SECS.map(([n, , c]) => [n, c])), 9: "tsum" };
// Khung thanh công cụ của một chuyên khoa
// ---- cấu trúc mục của từng chuyên khoa: khai báo trong 4-module/<module>/_module.json ----
const specOf = mod => MODSPEC[mod] || { sections: [] };
const secsOf = mod => specOf(mod).sections;
const secOf = (mod, k) => secsOf(mod).find(s => s.n === k) || { n: k, title: "", desc: "", type: "notes" };
const secByType = (mod, type) => (secsOf(mod).find(s => s.type === type) || {}).n || 0;
const secC = (mod, k) => ((((secOf(mod, k).c || k) - 1) % 16) + 1);          // số màu (--s1…--s10) của một mục
// Chuyên khoa đang xem: theo đường dẫn, nếu không có thì chuyên khoa xem lần trước
function curMod() {
  const h = decodeURIComponent(location.hash.slice(1)), a = h.match(/^\/m\/([^/]+)\//), b = h.match(/^\/n\/([^/]+)/);
  const m = a && MODULES[a[1]] ? a[1] : (b && byId[b[1]] ? byId[b[1]].module : null);
  if (m) { try { localStorage.setItem("ykkb_mod", m); } catch {} return m; }
  let saved = null; try { saved = localStorage.getItem("ykkb_mod"); } catch {}
  return saved && MODULES[saved] ? saved : Object.keys(MODULES)[0];
}
// Số hiển thị trong trang bệnh: 5.1–5.7 (số nội bộ 3,4,5,6,7,10,8); 9 = Tóm tắt
const DISPNUM = { 3: 1, 4: 2, 5: 3, 6: 4, 7: 5, 10: 6, 8: 7 };
const dnum = (n, mod) => n === 9 ? "★" : (secByType(mod || curMod(), "diseases") || 5) + "." + DISPNUM[n];

// Mục của thanh module mà một bài thuộc về (số mục lấy từ _module.json của module đó).
function sectionOfNote(n) {
  const mod = n.module;
  if (n.kind === "overview") return 1;
  if (n.kind === "disease") return secByType(mod, "diseases") || 5;
  if (n.kind === "sources") return secByType(mod, "sources") || 9;
  if (n.section) return n.section;           // gán trong frontmatter: section: <số mục>
  return secByType(mod, "groups") || 2;      // mặc định: mục có nhóm bài (Nền tảng)
}

// "Theo dõi" tách khỏi "Tiên lượng – Dự phòng": các tiêu đề ### bắt đầu bằng "Theo dõi"
const FOLLOW_RE = /^theo dõi/i;

// Đổi số mục nội bộ sang số hiển thị: tiêu đề "### 7.1 ..." và chữ "mục 7.3" trong liên kết nội bộ.
function relabel(s) {
  return s
    .replace(/^(#{3,4}\s+)([3-9])\.(\d)(?=\s)/gm, (_, h, x, y) => `${h}${dnum(+x)}.${y}`)
    .replace(/\[([^\]]*?)mục ([3-9])(?:\.(\d))?([^\]]*)\]\(#\/n\//g, (_, pre, x, y, post) => `[${pre}${+x === 9 ? "Tóm tắt" : "mục " + dnum(+x) + (y ? "." + y : "")}${post}](#/n/`);
}

const $ = s => document.querySelector(s);
const byId = Object.fromEntries(NOTES.map(n => [n.id, n]));
const byTitle = Object.fromEntries(NOTES.map(n => [n.title.toLowerCase(), n]));
const resolve = k => { k = k.trim(); return byId[k] || byTitle[k.toLowerCase()]; };
const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const css = v => getComputedStyle(document.documentElement).getPropertyValue("--" + v).trim();
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ---- liên kết đi (dùng cho sơ đồ liên kết) ----
const out = {};
NOTES.forEach(n => {
  out[n.id] = [...new Set([...n.body.matchAll(/\[\[([^\]|]+)/g)].map(m => resolve(m[1])).filter(Boolean).map(x => x.id))]
    .filter(id => id !== n.id);
});

// ---- markdown mở rộng: hộp màu, đánh dấu, tab, thẻ gập, danh sách lồng ----
const CALL = { key: "Ý chính", warn: "Lưu ý – bẫy thi", tip: "Mẹo nhớ", ext: "Tham khảo ngoài tài liệu", doc: "Theo văn bản Bộ Y tế", note: "Ghi chú", red: "Cấp cứu – nguy hiểm" };
const inline = s => esc(s)
  .replace(/`([^`]+)`/g, "<code>$1</code>")
  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  .replace(/\*([^*\s][^*]*)\*/g, "<em>$1</em>")
  .replace(/==(.+?)==/g, "<mark>$1</mark>")
  .replace(/\{(r|g|b|o|p)\|([^}]+)\}/g, (_, c, t) => `<span class="c-${c}">${t}</span>`)
  .replace(/\{\{\+([^}]+)\}\}/g, '<span class="src ext" title="Nguồn ngoài tài liệu của bạn">$1</span>')
  .replace(/\{\{([^}]+)\}\}/g, '<span class="src">$1</span>')
  .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, k, label) => {
    const t = resolve(k.replace(/&amp;/g, "&"));
    return t ? `<a class="wl" href="#/n/${t.id}">${label || t.title}</a>` : `<a class="wl broken" title="Chưa có bài này">${label || k}</a>`;
  })
  .replace(/!\[([^\]]*)\]\((data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+\/=]+|ecg\/[\w.\-\/]+)\)/g, '<img class="ecgimg" src="$2" alt="$1" loading="lazy">')
  .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  .replace(/\[([^\]]+)\]\((#\/[^)]+)\)/g, '<a href="$2">$1</a>');

function cardsOf(n) {
  return n.body.split("\n").map(l => l.match(/^[-*]\s*(.+?)\s::\s(.+)$/)).filter(Boolean).map(m => ({ id: n.id + "|" + m[1], q: m[1], a: m[2], note: n.id }));
}

function md(src) { return blocks(src.split("\n")); }

// Công cụ tính điểm: @@calc Tên … @@item Tên mục (chọn một) / @@checks Tên nhóm (tích nhiều) / @@bands (mức kết quả) … @@end
//   tùy chọn:  "- điểm | nhãn"      mức kết quả:  "- từ..đến | diễn giải | màu (r,g,o,p,b; không bắt buộc)"
let calcN = 0, calcNoLink = false;
function calcBlock(title, lines) {
  const id = "calc" + (++calcN), parts = [], bands = [], plain = s => s.replace(/\{[rgbop]\|([^}]*)\}/g, "$1").replace(/\*\*/g, "");
  const fin = [], groups = [];
  let cur = null, mode = "opt", grp = null, m;
  for (const x of lines) {
    const s = x.trim();
    if ((m = s.match(/^@@(item|checks)\s+(.+)$/))) { cur = { kind: m[1], name: m[2], opts: [] }; parts.push(cur); mode = "opt"; continue; }
    if (/^@@bands/.test(s)) { mode = "band"; cur = null; continue; }
    if ((m = s.match(/^@@(rules|res)\b\s*(.*)$/))) { grp = { t: m[2], rules: [] }; groups.push(grp); mode = "rule"; cur = null; continue; }
    if ((m = s.match(/^@@in\s+(.+)$/))) { const a = m[1].split("|").map(z => z.trim()), r = (a[3] || "").match(/^(-?[\d.]+)\s*\.\.\s*(-?[\d.]+)$/); fin.push({ k: "in", id: a[0], name: a[1], unit: a[2] || "", lo: r ? r[1] : "", hi: r ? r[2] : "", opt: a[4] === "?" }); cur = null; mode = "opt"; continue; }
    if ((m = s.match(/^@@sel\s+(.+)$/))) { const a = m[1].split("|").map(z => z.trim()); cur = { k: "sel", id: a[0], name: a[1], opts: [] }; fin.push(cur); mode = "opt"; continue; }
    if ((m = s.match(/^@@out\s+(.+)$/))) { const a = m[1].split("|").map(z => z.trim()); fin.push({ k: "out", id: a[0], name: a[1], unit: a[2] || "", dec: +a[3] || 0, expr: a.slice(4).join("|") }); cur = null; mode = "opt"; continue; }
    if (!s.startsWith("-")) continue;
    if (mode === "rule") {
      if (!grp) { grp = { t: "", rules: [] }; groups.push(grp); }
      const a = s.replace(/^-\s*/, "").split("|").map(z => z.trim());
      if (a.length >= 2) grp.rules.push({ e: a[0], txt: plain(a[1]), c: /^[rgbop]$/.test(a[2] || "") ? a[2] : "" });
    } else if (mode === "band") {
      if ((m = s.match(/^-\s*(-?[\d.]+)\s*\.\.\s*(-?[\d.]+)\s*\|\s*(.+?)(?:\s*\|\s*([rgbop]))?\s*$/))) bands.push({ lo: +m[1], hi: +m[2], txt: plain(m[3]), c: m[4] || "" });
    } else if (cur && (m = s.match(/^-\s*(-?[\d.]+)\s*\|\s*(.+)$/))) cur.opts.push({ v: +m[1], t: m[2] });
  }
  if (fin.length) {
    const field = f => f.k === "in"
      ? `<label class="calc-in"><span>${inline(f.name)}${f.opt ? ` <em class="calc-opt">(tùy chọn)</em>` : ""}</span><input type="number" step="any" inputmode="decimal" data-var="${f.id}" data-label="${esc(f.name)}" data-lo="${f.lo}" data-hi="${f.hi}" data-opt="${f.opt ? 1 : ""}"><small>${esc(f.unit)}${f.lo ? ` (${f.lo}–${f.hi})` : ""}</small></label>`
      : `<fieldset class="calc-sel" data-label="${esc(f.name)}"><legend>${inline(f.name)}</legend>` + f.opts.map(o => `<label><input type="radio" name="${id}-${f.id}" data-var="${f.id}" value="${o.v}"><span>${inline(o.t)}</span></label>`).join("") + `</fieldset>`;
    const outs = fin.filter(f => f.k === "out").map(f => `<div class="calc-line" data-var="${f.id}" data-label="${esc(f.name)}" data-dec="${f.dec}" data-expr="${esc(f.expr)}"><span>${inline(f.name)}</span><b class="calc-val">–</b><small>${esc(f.unit)}</small></div>`).join("");
    const res = groups.map((g, k) => `<div class="calc-res" data-g="${k}">${g.t ? `<b class="calc-gt">${inline(g.t)}</b>` : ""}<span class="calc-msg">–</span></div>`).join("");
    return `<div class="calc calc-f" data-groups="${esc(JSON.stringify(groups))}"><div class="calc-head"><span>🧮 ${inline(title)}</span>${calcLink(title)}<button type="button" class="calc-reset">Đặt lại</button></div>` +
      fin.filter(f => f.k !== "out").map(field).join("") + (outs ? `<div class="calc-vals">${outs}</div>` : "") +
      `<div class="calc-outf"><div class="calc-top"></div>${res}</div></div>`;
  }
  const max = parts.reduce((a, p) => a + (p.kind === "item" ? Math.max(...p.opts.map(o => o.v)) : p.opts.reduce((b, o) => b + Math.max(o.v, 0), 0)), 0);
  const req = parts.filter(p => p.kind === "item").length;
  const body = parts.map((p, k) => `<fieldset class="calc-item${p.kind === "checks" ? " checks" : ""}"><legend>${inline(p.name)}</legend>` +
    p.opts.map(o => `<label><input type="${p.kind === "item" ? "radio" : "checkbox"}" name="${id}-${k}" value="${o.v}"><b>${p.kind === "checks" && o.v > 0 ? "+" : ""}${o.v}</b><span>${inline(o.t)}</span></label>`).join("") + `</fieldset>`).join("");
  return `<div class="calc" data-req="${req}" data-bands="${esc(JSON.stringify(bands))}"><div class="calc-head"><span>🧮 ${inline(title)}</span>${calcLink(title)}<button type="button" class="calc-reset">Đặt lại</button></div>${body}` +
    `<div class="calc-out"><div class="calc-score"><b class="calc-total">0</b><small>/ ${max} điểm</small></div><div class="calc-res" aria-live="polite">Chọn các mục để tính điểm</div></div></div>`;
}
const calcLink = title => { if (calcNoLink) return ""; const c = calcByTitle(title.replace(/\{\{[^}]*\}\}/g, "").replace(/\{[rgbop]\|([^}]*)\}/g, "$1").replace(/\*\*/g, "").trim()); return c ? `<a class="calc-open" href="#/congcu/${c.id}" title="Mở riêng trong trang Công cụ tính toán">Mở công cụ ↗</a>` : ""; };
const CALC_FN = { min: Math.min, max: Math.max, abs: Math.abs, log: Math.log, log10: Math.log10, sqrt: Math.sqrt, round: Math.round, floor: Math.floor, ceil: Math.ceil, exp: Math.exp };
function calcEval(expr, vars) {
  if (!/^[\w\s.+\-*\/%()<>=!&|,]+$/.test(expr)) return NaN;
  try { return new Function(...Object.keys(vars), ...Object.keys(CALC_FN), "return (" + expr + ")")(...Object.values(vars), ...Object.values(CALC_FN)); } catch (_) { return NaN; }
}
const calcRefs = e => e.match(/[A-Za-z_]\w*/g) || [];
function calcFormula(c) {
  const groups = JSON.parse(c.dataset.groups || "[]"), vars = {}, label = {}, expr = {}, missing = [];
  let range = "";
  c.querySelectorAll("input[type=number][data-var]").forEach(i => {
    const k = i.dataset.var, raw = i.value.trim().replace(",", "."), v = raw === "" ? NaN : parseFloat(raw);
    label[k] = i.dataset.label; vars[k] = v;
    if (isNaN(v)) { if (!i.dataset.opt) missing.push(label[k]); return; }
    if (i.dataset.lo !== "" && (v < +i.dataset.lo || v > +i.dataset.hi)) range = `${label[k]} ngoài khoảng ${i.dataset.lo}–${i.dataset.hi}`;
  });
  c.querySelectorAll("fieldset.calc-sel").forEach(f => {
    const k = f.querySelector("input").dataset.var, r = f.querySelector("input:checked");
    label[k] = f.dataset.label; vars[k] = r ? +r.value : NaN;
    if (!r) missing.push(label[k]);
  });
  c.querySelectorAll(".calc-line").forEach(l => { label[l.dataset.var] = l.dataset.label; expr[l.dataset.var] = l.dataset.expr; });
  // Các nhãn còn thiếu mà biểu thức cần (đi qua cả các mục tính trung gian)
  const need = (e, seen = new Set()) => calcRefs(e).flatMap(x => {
    if (seen.has(x) || !(x in label)) return [];
    seen.add(x);
    if (!(x in expr)) return isNaN(vars[x]) ? [label[x]] : [];
    return need(expr[x], seen);
  });
  c.querySelectorAll(".calc-line").forEach(l => {
    const k = l.dataset.var, val = l.querySelector(".calc-val"), dec = +l.dataset.dec;
    if (need(expr[k]).length) { vars[k] = NaN; val.textContent = "–"; return; }
    const v = calcEval(expr[k], vars); vars[k] = v;
    val.textContent = isFinite(v) ? (Math.round(v * 10 ** dec) / 10 ** dec).toLocaleString("vi-VN", { maximumFractionDigits: dec }) : "không tính được";
  });
  c.querySelector(".calc-top").textContent = missing.length ? `Còn ${missing.length} mục bắt buộc chưa nhập: ${missing.join(", ")}` : range;
  c.querySelectorAll(".calc-res").forEach(el => {
    const g = groups[+el.dataset.g], msg = el.querySelector(".calc-msg");
    // Quy tắc được xét theo thứ tự; gặp quy tắc còn thiếu dữ liệu trước mức khớp thì chưa kết luận được
    const pend = [];
    let hit = null;
    for (const r of g.rules) {
      const nd = need(r.e);
      if (nd.length) { pend.push(...nd); continue; }
      if (calcEval(r.e, vars)) { hit = r; break; }
    }
    el.className = "calc-res";
    if (pend.length) { msg.textContent = "Cần nhập: " + [...new Set(pend)].join(", "); return; }
    if (!hit) { msg.textContent = "Không khớp mức nào đã khai báo"; return; }
    el.className = "calc-res" + (hit.c ? " k-" + hit.c : "");
    msg.textContent = hit.txt;
  });
}
function calcUpdate(c) {
  if (c.classList.contains("calc-f")) return calcFormula(c);
  const bands = JSON.parse(c.dataset.bands || "[]"), req = +c.dataset.req;
  let total = 0, done = 0;
  c.querySelectorAll("fieldset").forEach(f => {
    if (f.classList.contains("calc-sel")) return;
    if (f.classList.contains("checks")) f.querySelectorAll("input:checked").forEach(i => { total += +i.value; });
    else { const r = f.querySelector("input:checked"); if (r) { total += +r.value; done++; } }
  });
  c.querySelector(".calc-total").textContent = String(Math.round(total * 100) / 100);
  const res = c.querySelector(".calc-res");
  if (done < req) { res.className = "calc-res"; res.textContent = `Còn ${req - done} mục chưa chọn`; return; }
  const b = bands.find(x => total >= x.lo && total <= x.hi);
  res.className = "calc-res" + (b && b.c ? " k-" + b.c : "");
  res.textContent = b ? b.txt : "Tổng điểm nằm ngoài các mức đã khai báo";
}
document.addEventListener("change", e => { const c = e.target.closest(".calc"); if (c) calcUpdate(c); });
document.addEventListener("input", e => { if (e.target.type !== "number") return; const c = e.target.closest(".calc"); if (c) calcUpdate(c); });
document.addEventListener("click", e => {
  const b = e.target.closest(".calc-reset"); if (!b) return;
  const c = b.closest(".calc"); c.querySelectorAll("input").forEach(i => { i.checked = false; if (i.type === "number") i.value = ""; }); calcUpdate(c);
});

// Sơ đồ tiếp cận trong bài: @@flow / dòng nút "id | start|dec|proc|ok|warn|red | chữ | [bài hoặc bài/mục]" / dòng cạnh "a -> b : nhãn" / @@end
function flowBlock(lines) {
  const nodes = [], edges = [];
  const KIND = { start: { k: "start" }, dec: { k: "dec" }, proc: { k: "proc" }, ok: { k: "leaf", tone: "ok" }, warn: { k: "leaf", tone: "warn" }, red: { k: "leaf", tone: "red" } };
  lines.forEach(x => {
    const t = x.trim(); let m;
    if ((m = t.match(/^(\w+)\s*->\s*(\w+)(?:\s*:\s*(.+))?$/))) edges.push(m[3] ? [m[1], m[2], m[3].trim()] : [m[1], m[2]]);
    else if ((m = t.match(/^(\w+)\s*\|\s*(start|dec|proc|ok|warn|red)\s*\|\s*(.+?)(?:\s*\|\s*(\S+))?$/))) nodes.push({ id: m[1], ...KIND[m[2]], t: m[3], href: m[4] ? "#/n/" + m[4] : "" });
  });
  return nodes.length ? luudoGraph({ start: nodes[0].id, nodes, edges }) : "";
}
// Diễn tiến bệnh theo giai đoạn: @@stages / dòng "Tên | mô tả | mốc thời gian hoặc nhãn (tùy chọn)" / @@end
function stagesBlock(lines) {
  const items = lines.map(x => x.trim()).filter(Boolean).map(x => x.split(/\s+\|\s+/));
  return `<ol class="stages">${items.map(([name, desc, tag], k) => `<li style="--k:${k / Math.max(1, items.length - 1)}"><b>${inline(name)}</b>${desc ? `<span>${inline(desc)}</span>` : ""}${tag ? `<small>${inline(tag)}</small>` : ""}</li>`).join("")}</ol>`;
}
function blocks(L) {
  const h = [];
  let i = 0;
  const stack = [];           // danh sách lồng nhau: {tag, indent}
  const closeLists = (toIndent = -1) => {
    while (stack.length && stack[stack.length - 1].indent > toIndent) { h.push(`</li></${stack.pop().tag}>`); }
  };
  const findEnd = from => {
    let d = 1;
    for (let k = from; k < L.length; k++) {
      const t = L[k].trim();
      if (/^@@(tabs|fold|calc|flow|stages)/.test(t)) d++;
      else if (t === "@@end" && --d === 0) return k;
    }
    return L.length;
  };
  while (i < L.length) {
    const l = L[i], t = l.trim();
    let m;
    if (t === "") { closeLists(); i++; continue; }
    if (/^@@tabs/.test(t)) {
      closeLists();
      const end = findEnd(i + 1), inner = L.slice(i + 1, end), tabs = [];
      let d = 0;
      for (const x of inner) {
        const tx = x.trim();
        if (d === 0 && (m = tx.match(/^@@tab\s+(.+)$/))) { tabs.push({ name: m[1], lines: [] }); continue; }
        if (/^@@(tabs|fold|calc|flow|stages)/.test(tx)) d++; else if (tx === "@@end") d--;
        if (tabs.length) tabs[tabs.length - 1].lines.push(x);
      }
      h.push(`<div class="tabs"><div class="tabbar">${tabs.map((x, k) => `<button class="tabbtn${k ? "" : " on"}" data-t="${k}">${inline(x.name)}</button>`).join("")}</div>` +
        tabs.map((x, k) => `<div class="tabpanel${k ? "" : " on"}" data-t="${k}">${blocks(x.lines)}</div>`).join("") + `</div>`);
      i = end + 1; continue;
    }
    if (/^@@flow/.test(t)) {
      closeLists();
      const end = findEnd(i + 1);
      h.push(flowBlock(L.slice(i + 1, end)));
      i = end + 1; continue;
    }
    if (/^@@stages/.test(t)) {
      closeLists();
      const end = findEnd(i + 1);
      h.push(stagesBlock(L.slice(i + 1, end)));
      i = end + 1; continue;
    }
    if ((m = t.match(/^@@calc\s+(.+)$/))) {
      closeLists();
      const end = findEnd(i + 1);
      h.push(calcBlock(m[1], L.slice(i + 1, end)));
      i = end + 1; continue;
    }
    if ((m = t.match(/^@@fold(!?)\s+(.+)$/))) {
      closeLists();
      const end = findEnd(i + 1);
      h.push(`<details class="fold"${m[1] ? " open" : ""}><summary>${inline(m[2])}</summary>${blocks(L.slice(i + 1, end))}</details>`);
      i = end + 1; continue;
    }
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) {
      closeLists();
      // "Tự kiểm tra": khối gập, mặc định đóng; số câu (dòng "- Q :: A") hiện trên tiêu đề
      if (/^tự kiểm tra$/i.test(m[2].trim())) {
        let j = i + 1;
        while (j < L.length && !/^#{1,4}\s/.test(L[j])) j++;
        const cnt = L.slice(i + 1, j).filter(x => / :: /.test(x)).length;
        h.push(`<details class="fold selfcheck"><summary>${inline(m[2])} <small>${cnt} câu</small></summary>${blocks(L.slice(i + 1, j))}</details>`);
        i = j; continue;
      }
      const lv = m[1].length === 3 ? 3 : m[1].length + 1;   // ### là h3 (như ##), các cấp khác giữ nguyên
      h.push(`<h${lv}>${inline(m[2])}</h${lv}>`); i++; continue;
    }
    if (/^---+$/.test(t)) { closeLists(); h.push("<hr>"); i++; continue; }
    if (t.startsWith("|")) {
      closeLists();
      const rows = [];
      while (i < L.length && L[i].trim().startsWith("|")) rows.push(L[i++].trim());
      // Tách ô theo "|", nhưng giữ nguyên "|" bên trong đánh dấu {x|…} và liên kết [[id|nhãn]]
      const cells = r => r.replace(/^\||\|$/g, "")
        .replace(/\{([rgbop])\|([^}]*)\}/g, (_, col, t) => "{" + col + "\u0001" + t + "}")
        .replace(/\[\[[^\]]*\]\]/g, m => m.replace(/\|/g, "\u0001"))
        .split("|").map(c => c.replace(/\u0001/g, "|").trim());
      // Gộp ô: "<<" gộp ngang với ô bên trái, "^^" gộp dọc với ô phía trên (không gộp qua dòng tiêu đề)
      const head = cells(rows[0]), body = rows.slice(2).map(cells), W = head.length;
      const grid = [head, ...body].map(r => Array.from({ length: W }, (_, x) => (r[x] !== undefined ? r[x] : "")));
      const sp = grid.map(r => r.map(() => ({ c: 1, r: 1, hide: false })));
      grid.forEach((row, y) => row.forEach((v, x) => {
        if (v === "<<") { let k = x - 1; while (k >= 0 && row[k] === "<<") k--; if (k >= 0) { sp[y][k].c++; sp[y][x].hide = true; } }
        if (v === "^^") { let k = y - 1; while (k >= 1 && grid[k][x] === "^^") k--; if (k >= 1) { sp[k][x].r++; sp[y][x].hide = true; } else grid[y][x] = ""; }
      }));
      const td = (y, x, tag) => {
        const s = sp[y][x];
        if (s.hide) return "";
        const v = grid[y][x] === "<<" ? "" : grid[y][x];
        const a = (s.c > 1 ? ` colspan="${s.c}"` : "") + (s.r > 1 ? ` rowspan="${s.r}" class="mg"` : "");
        return `<${tag}${a}>${inline(v)}</${tag}>`;
      };
      const bodyHtml = grid.slice(1).map((_, y) => "<tr>" + Array.from({ length: W }, (_, x) => td(y + 1, x, "td")).join("") + "</tr>").join("");
      // Chú thích viết tắt: dòng "Viết tắt: …" ngay sau bảng (có thể cách một dòng trắng)
      let note = "", q = i;
      while (q < L.length && L[q].trim() === "") q++;
      if (q < L.length && /^Viết tắt:/.test(L[q].trim())) { note = L[q].trim().replace(/^Viết tắt:\s*/, ""); i = q + 1; }
      h.push('<div class="tw"><table><thead><tr>' + Array.from({ length: W }, (_, x) => td(0, x, "th")).join("") + "</tr></thead><tbody>" +
        bodyHtml + "</tbody></table></div>" + (note ? `<div class="tnote"><b>Viết tắt:</b> ${inline(note)}</div>` : ""));
      continue;
    }
    if (l.startsWith(">")) {
      closeLists();
      const q = [];
      while (i < L.length && L[i].startsWith(">")) q.push(L[i++].replace(/^>\s?/, ""));
      const c = q[0].match(/^\[!(\w+)\]\s*(.*)$/);
      if (c) {
        const type = CALL[c[1]] ? c[1] : "note";
        // Tiêu đề trùng nhãn của hộp (ví dụ [!tip] Mẹo nhớ) thì bỏ, nhãn đã hiện sẵn ở trên
        const head = c[2].trim(), dupLabel = head.toLowerCase() === CALL[type].toLowerCase();
        const body = [dupLabel ? "" : head, ...q.slice(1)].filter((x, k) => k || x);
        h.push(`<div class="callout ${type}"><div class="ct">${CALL[type]}</div>${blocks(body)}</div>`);
      } else h.push(`<blockquote>${inline(q.join(" "))}</blockquote>`);
      continue;
    }
    if ((m = l.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/))) {
      const ind = m[1].length, tag = /\d/.test(m[2]) ? "ol" : "ul";
      const top = stack[stack.length - 1];
      if (top && ind > top.indent) { h.push(`<${tag}>`); stack.push({ tag, indent: ind }); }
      else {
        while (stack.length && stack[stack.length - 1].indent > ind) h.push(`</li></${stack.pop().tag}>`);
        const t2 = stack[stack.length - 1];
        if (t2 && t2.indent === ind) h.push("</li>"); else { h.push(`<${tag}>`); stack.push({ tag, indent: ind }); }
      }
      const qa = m[3].match(/^(.+?)\s::\s(.+)$/);
      h.push(qa ? `<li class="qa"><details class="card"><summary>${inline(qa[1])}</summary><div>${inline(qa[2])}</div></details>` : `<li>${inline(m[3])}`);
      i++; continue;
    }
    closeLists();
    h.push(`<p>${inline(l)}</p>`); i++;
  }
  closeLists();
  return h.join("\n");
}

document.addEventListener("click", e => {
  const b = e.target.closest('[data-act="toggleall"]'); if (!b) return;
  const ds = [...document.querySelectorAll(b.dataset.scope || "details.pareto")], open = ds.some(d => !d.open);
  ds.forEach(d => { d.open = open; });
});
// Thanh bên (Nền tảng): bấm một nhóm để mở trang mục và cuộn tới nhóm đó
let jumpTo = null;
document.addEventListener("click", e => {
  const a = e.target.closest("a[data-g]"); if (!a) return;
  e.preventDefault();
  closeSheet();
  const el = document.getElementById(a.dataset.g);
  if (location.hash === a.getAttribute("href") && el) return el.scrollIntoView({ behavior: "smooth", block: "start" });
  jumpTo = a.dataset.g; location.hash = a.getAttribute("href");
});
// bấm tab trong nội dung
document.addEventListener("click", e => {
  const b = e.target.closest(".tabbtn");
  if (!b) return;
  const box = b.closest(".tabs"), k = b.dataset.t;
  box.querySelectorAll(":scope > .tabbar > .tabbtn").forEach(x => x.classList.toggle("on", x === b));
  box.querySelectorAll(":scope > .tabpanel").forEach(x => x.classList.toggle("on", x.dataset.t === k));
});

// Mục lục bài: đánh id cho các tiêu đề ### (h3) để cuộn tới; không đổi địa chỉ trang
function withToc(html) {
  const items = [];
  const out = html.replace(/<h3>(.*?)<\/h3>/g, (_, t) => { const id = "sec-" + items.length; items.push({ id, t }); return `<h3 id="${id}">${t}</h3>`; });
  return { html: out, items };
}
// Mục lục luôn đóng khi mở bài, trên mọi trang và mọi khổ màn hình (bấm "Nội dung mục" để mở)
function tocBox(items) {
  if (items.length < 3) return "";
  return `<details class="toc"><summary>Nội dung mục</summary><ol>${items.map(x => `<li><a href="#${x.id}" data-jump="${x.id}">${x.t.replace(/<\/?a[^>]*>/g, "")}</a></li>`).join("")}</ol></details>`;
}
document.addEventListener("click", e => { if (e.target.closest(".pager .up")) window.scrollTo({ top: 0, behavior: "smooth" }); });
document.addEventListener("click", e => {
  const a = e.target.closest("a[data-jump]"); if (!a) return;
  e.preventDefault();
  document.body.classList.remove("tocpop");
  const t = document.getElementById(a.dataset.jump); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
});
$("#tocFab").onclick = () => { const t = $("#main details.toc"); if (!t) return; t.open = true; document.body.classList.toggle("tocpop"); };
document.addEventListener("click", e => { if (document.body.classList.contains("tocpop") && !e.target.closest("details.toc,#tocFab")) document.body.classList.remove("tocpop"); });

// ---- thanh bên: mục lục thu gọn theo khung 1–9 ----
const diseases = () => NOTES.filter(n => n.kind === "disease").sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
// Nhóm bài của mục kiểu "groups": thứ tự, tiêu đề trang và tên ở thanh bên khai báo trong _module.json
const groupsOf = mod => ((secsOf(mod).find(s => s.type === "groups") || {}).groups || []);
const gKey = g => typeof g === "string" ? g : g.key;
const gInfo = (mod, g) => groupsOf(mod).find(x => gKey(x) === g) || {};
const gTitle = (mod, g) => gInfo(mod, g).page || g, gSide = (mod, g) => gInfo(mod, g).side || g;
function groupList(mod, k) {
  const present = [...new Set(NOTES.filter(n => n.module === mod && n.kind === "foundation" && sectionOfNote(n) === k).map(n => n.group || "Khác"))];
  const ord = groupsOf(mod).map(gKey);
  return [...ord.filter(g => present.includes(g)), ...present.filter(g => !ord.includes(g))];
}
const gId = (mod, k, g) => "grp-" + groupList(mod, k).indexOf(g);
// ---- Thư viện học tập: tra cứu theo loại kiến thức, gom từ mọi chuyên khoa ----
// [khóa, tên, mô tả, màu (--s…), tab bệnh liên quan]: loại của một bài lấy từ `lib` của nhóm/mục trong _module.json hoặc `lib:` trong bài
const LIBS = [
  ["trieuchung", "Triệu chứng học", "Từ triệu chứng và hội chứng đến chẩn đoán: hỏi bệnh, khám, bệnh án.", "s3", [4]],
  ["hoichung", "Các hội chứng trong thực hành lâm sàng", "Nhóm dấu hiệu đi cùng nhau gợi ý một nhóm nguyên nhân: nhận diện hội chứng, biện luận và đi tới chẩn đoán phân biệt.", "s13", []],
  ["benhhoc", "Bệnh học", "Cơ chế, nguyên nhân và từng bệnh: lâm sàng, chẩn đoán, điều trị, tiên lượng.", "s5", []],
  ["cls", "Cận lâm sàng", "Chọn và đọc xét nghiệm, hình ảnh, giải phẫu bệnh, phân giai đoạn.", "s4", [5, 6]],
  ["capcuu", "Cấp cứu", "Nhận diện nhanh và xử trí ban đầu các tình huống cấp cứu.", "s6", []],
  ["dieutri", "Điều trị", "Nguyên tắc và phương pháp điều trị.", "s10", [7, 10]],
  ["phongngua", "Phòng ngừa", "Phòng ngừa, tầm soát, tiên lượng và theo dõi.", "s2", [8]],
  ["khoahoccoban", "Khoa học cơ sở", "Sinh học, hóa sinh và nền tảng cơ bản làm cơ sở cho lâm sàng.", "s1", []],
  ["duocly", "Dược lý", "Dược lý đại cương và các nhóm thuốc theo hệ: thần kinh tự chủ, tim mạch, hô hấp–tiêu hóa, thần kinh trung ương, nội tiết, kháng nhiễm, ung thư, độc chất.", "s7", []],
  ["dinhduong", "Dinh dưỡng (dự kiến)", "Nhu cầu dinh dưỡng, can thiệp và theo dõi theo đối tượng và theo bệnh. Đang xây dựng.", "s8", []],
  ["thamkham", "Thăm khám", "Cách hỏi bệnh và khám lâm sàng theo từng hệ cơ quan.", "s9", []],
  ["trogiatri", "Giá trị bình thường (dự kiến)", "Ngưỡng xét nghiệm và chỉ số huyết học, sinh hóa, huyết động, kèm nguồn trang cho từng con số. Đang xây dựng.", "s11", []],
];
// Hội chứng lâm sàng: vừa nằm trong thư viện "Các hội chứng", vừa hiện ở mục Tiếp cận bệnh nhân của từng module
const isSyn = n => n.lib === "hoichung";
function libOf(n) {
  if (n.lib) return n.lib;
  if (n.kind === "disease") return "benhhoc";
  if (n.kind !== "foundation") return "";
  const sp = secOf(n.module, sectionOfNote(n));
  const g = sp.type === "groups" ? (sp.groups || []).find(x => gKey(x) === (n.group || "Khác")) : null;
  return (g && g.lib) || sp.lib || "";
}
// Bài tự kiểm tra không hiện trong thư viện (vẫn còn trong từng module)
const isSelfTest = n => /^tự kiểm tra/i.test(n.short || "") || /^tự kiểm tra/i.test(n.title || "");
function libItems(cat) {
  const tabs = (LIBS.find(l => l[0] === cat) || [])[4] || [];
  return Object.keys(MODULES).map(mod => {
    const notes = NOTES.filter(n => n.module === mod && n.kind === "foundation" && libOf(n) === cat && !isSelfTest(n)).sort((a, b) => {
      const sa = sectionOfNote(a), sb = sectionOfNote(b);
      return sa - sb || groupList(mod, sa).indexOf(a.group || "Khác") - groupList(mod, sb).indexOf(b.group || "Khác") || (a.order ?? 99) - (b.order ?? 99);
    });
    return { mod, notes, di: diseases().filter(d => d.module === mod && !d.tong), tabs };   // bài gom vào bài tổng hợp chỉ hiện qua thẻ tổng hợp
  }).filter(x => x.notes.length || (x.di.length && (cat === "benhhoc" || x.tabs.length)));
}
const libCount = cat => cat === "trieuchung" ? sympCount() : libItems(cat).reduce((c, x) => c + x.notes.length + ((cat === "benhhoc" || x.tabs.length) ? x.di.length : 0), 0) + (cat === "benhhoc" ? NOTES.filter(n => n.kind === "tong").length : 0);
// các tab của từng bệnh thuộc một loại (ví dụ Điều trị = tab 7 của mọi bệnh)
const diseaseChips = (di, tabs, mod) => `<div class="rgrid">${di.map(d => { const { secs } = diseaseParts(d); const have = tabs.filter(t => secs[t]); return have.length ? `<div class="rcard"><b>${esc(d.short || d.title)}</b>${have.map(t => `<a class="chip wide" href="#/n/${d.id}/${t}">${dnum(t, mod)} ${esc(SECNAME[t])}</a>`).join("")}</div>` : ""; }).join("")}</div>`;
// Bài tổng hợp (kind: tong) gom các bài bệnh có `tong: <id>` của hai module: thư viện chỉ hiện một thẻ, không tách nội và ngoại
function tongCards() {
  const ts = NOTES.filter(n => n.kind === "tong");
  if (!ts.length) return "";
  return `<section><h2>Nội khoa và ngoại khoa</h2><div class="dgrid">${ts.map(t => `<article class="dcard"><a class="dtitle" href="#/n/${t.id}">${esc(t.short || t.title)}</a><div class="dchips">${tongLinks(t).map(l => `<a class="chip wide" href="${l.href}">${esc(l.label)}</a>`).join("")}</div></article>`).join("")}</div></section>`;
}
// TODO(human): các đường dẫn hiện trên thẻ tổng hợp, trỏ tới hai bài gốc. Hiện trả về rỗng nên thẻ chỉ có tên bệnh và liên kết tới bài tổng hợp.
function tongLinks(t) {
  return [];
}
// Triệu chứng học xếp theo LÝ DO ĐẾN KHÁM, không theo bệnh: mỗi vấn đề của Khung 128 (đau bụng, nôn ói, vàng da…)
// dẫn tới các bài tiếp cận và các bệnh cần nghĩ tới. Liên kết lấy từ `khung:` trong frontmatter của bài và của bệnh.
function sympRows() {
  const K = window.KHUNG; if (!K) return [];
  const gname = Object.fromEntries(((K.qd22 || {}).groups || []).map(g => [g.id, g.name]));
  const fo = NOTES.filter(n => n.kind === "foundation" && (n.khung || []).length), ds = diseases();
  return K.items.map(it => ({ no: it.no, title: it.title, group: it.group, gname: gname[it.group] || "Khác",
    notes: fo.filter(n => n.khung.includes(it.no)), di: ds.filter(d => (d.khung || []).includes(it.no)) }));
}
const sympGeneral = () => NOTES.filter(n => n.kind === "foundation" && libOf(n) === "trieuchung" && !(n.khung || []).length);
const sympCount = () => sympRows().filter(r => r.notes.length || r.di.length).length + sympGeneral().length;
function symptomPage(L) {
  const [, title, , col] = L, rows = sympRows(), gen = sympGeneral(), nEmpty = rows.filter(r => !r.notes.length && !r.di.length).length;
  const modTag = m => esc(MODULES[m] || m);
  const chipN = n => `<a class="chip wide" href="#/n/${n.id}" title="${modTag(n.module)}">${esc(n.short || n.title)}</a>`;
  const chipD = (d, multi) => `<a class="chip wide dz" href="#/n/${d.id}/4" title="${modTag(d.module)}">${esc(d.short || d.title)}${multi ? ` <small>· ${modTag(d.module)}</small>` : ""}</a>`;   // nhiều chuyên khoa trong một dòng: ghi rõ chuyên khoa
  const byG = {}; rows.forEach(r => (byG[r.group] = byG[r.group] || { name: r.gname, rows: [] }).rows.push(r));
  const list = Object.entries(byG).sort((a, b) => a[0] - b[0]).map(([, G]) => `<section class="symgrp"><h2>${esc(G.name)}</h2>${G.rows.map(r => {
    const any = r.notes.length || r.di.length;
    return `<div class="symrow${any ? "" : " empty"}" data-t="${esc(noDia(r.title))}"><div class="symhead"><span class="no">${r.no}</span><b>${esc(r.title)}</b><a class="chip wide" href="#/khung/${r.no}" title="Mở trong Đề cương ôn thi">Đề cương</a></div>${r.notes.length ? `<div class="symline"><span>Cách tiếp cận</span>${r.notes.map(chipN).join("")}</div>` : ""}${r.di.length ? `<div class="symline"><span>Bệnh cần nghĩ tới</span>${r.di.map(d => chipD(d, new Set(r.di.map(x => x.module)).size > 1)).join("")}</div>` : ""}${any ? "" : `<div class="symline meta">Chưa có bài.</div>`}</div>`;
  }).join("")}</section>`).join("");
  $("#main").style.maxWidth = "1080px";
  $("#main").innerHTML = `${crumb([{ t: "Trang chủ", href: "#/" }, { t: "Thư viện học tập", href: "#/lib" }, { t: title }])}
    ${pageHead({ c: `var(--${col})`, kicker: "Thư viện học tập", title: `${esc(title)}`, desc: `Bệnh nhân đến khám vì một lý do: đau bụng, đau đầu, nôn ói, vàng da… Chọn lý do đến khám để đọc cách tiếp cận, hỏi bệnh tiếp, rồi xem các bệnh cần nghĩ tới. Các vấn đề theo Khung 128 của kỳ thi.` })}
    <div class="symctl"><input id="symq" type="search" placeholder="Lọc theo lý do đến khám: đau bụng, ho, vàng da…" autocomplete="off"><label><input type="checkbox" id="symall"> Hiện cả vấn đề chưa có bài (${nEmpty})</label></div>
    <div class="modpage" style="--c:var(--${col})">${list}
      ${gen.length ? `<section class="symgen"><h2>Hỏi bệnh, khám và bệnh án</h2><p class="meta">Kỹ năng và khái quát dùng chung cho mọi lý do đến khám.</p><div class="rgrid">${gen.map(n => `<a class="rcard" href="#/n/${n.id}"><small>${modTag(n.module)}</small><b>${esc(n.short || n.title)}</b></a>`).join("")}</div></section>` : ""}</div>`;
  const apply = () => {
    const q = noDia($("#symq").value.trim()), all = $("#symall").checked;
    document.querySelectorAll(".symrow").forEach(r => { r.hidden = !!((q && !r.dataset.t.includes(q)) || (r.classList.contains("empty") && !all && !q)); });
    document.querySelectorAll(".symgrp").forEach(g => { g.hidden = ![...g.querySelectorAll(".symrow")].some(r => !r.hidden); });
  };
  $("#symq").oninput = apply; $("#symall").onchange = apply; apply();
  window.scrollTo(0, 0);
}
// Biểu tượng cho từng thư viện (đường nét 24×24)
const LIB_ICON = {
  trieuchung: '<path d="M3 12h4l2.5-5 4 10 2.5-5H21"/>',
  benhhoc: '<circle cx="12" cy="12" r="4.5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  cls: '<path d="M9 3h6M10 3v6l-5 9.5A2 2 0 0 0 6.8 21h10.4a2 2 0 0 0 1.8-2.5L14 9V3"/><path d="M7.5 15h9"/>',
  capcuu: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  dieutri: '<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-40 12 12)"/><path d="M9.5 9.5l5 5"/>',
  phongngua: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  khoahoccoban: '<ellipse cx="12" cy="12" rx="9" ry="4"/><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(-60 12 12)"/><circle cx="12" cy="12" r="1.6"/>',
  duocly: '<path d="M4.5 19.5l15-15a4.2 4.2 0 0 1 6 6l-15 15a4.2 4.2 0 0 1-6-6z"/><path d="M9 9l6 6"/>',
  dinhduong: '<path d="M12 7c0-2.5 1.5-4 4-4 0 2.5-1.5 4-4 4z"/><path d="M12 7C7 7 4 10 4 14.5 4 18.5 7.5 21 12 21s8-2.5 8-6.5C20 10 17 7 12 7z"/>',
  thamkham: '<path d="M6 3v6a4 4 0 0 0 8 0V3"/><path d="M10 13v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="11" r="2"/>',
  trogiatri: '<path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l4-4"/><path d="M12 6v2M5.6 9.6l1.4 1.4M18.4 9.6l-1.4 1.4"/>',
  hoichung: '<circle cx="8.5" cy="9" r="3.2"/><circle cx="15.5" cy="9" r="3.2"/><path d="M2.5 19.5c.8-2.8 3-4.2 6-4.2s5.2 1.4 6 4.2M12.5 19.5c.8-2.8 3-4.2 6-4.2s4.5 1.2 5 3.2"/>',
};
function libIndex() {
  $("#main").style.maxWidth = "1080px";
  $("#main").innerHTML = `${crumb([{ t: "Trang chủ", href: "#/" }, { t: "Thư viện học tập" }])}
    ${pageHead({ c: `var(--brand)`, title: `Thư viện học tập`, desc: `Tra cứu theo loại kiến thức, gom từ mọi chuyên khoa. Muốn học theo trình tự của một chuyên khoa thì vào mục Module.` })}
    <div class="rgrid libgrid">${LIBS.map(([k, t, d, col]) => `<a class="rcard lib lcard" style="--c:var(--${col})" href="#/lib/${k}"><span class="lico" aria-hidden="true"><svg viewBox="0 0 24 24">${LIB_ICON[k]}</svg></span><small>${libCount(k)} mục</small><b>${esc(t)}</b><span>${esc(d)}</span></a>`).join("")}</div>`;
  window.scrollTo(0, 0);
}
// Bài trong một chuyên khoa, xếp theo từng mục lớn (Đại cương, Hệ máu…), mỗi mục một tiêu đề
function secBlocks(mod, notes) {
  const bySec = {};
  notes.forEach(n => { const k = sectionOfNote(n); bySec[k] = bySec[k] || []; bySec[k].push(n); });
  return Object.keys(bySec).map(Number).sort((a, b) => a - b).map(k => `<h3>${esc(secOf(mod, k).title)}</h3><div class="rgrid">${bySec[k].map(n => `<a class="rcard" href="#/n/${n.id}">${n.group ? `<small>${esc(gSide(mod, n.group))}</small>` : ""}<b>${esc(n.short || n.title)}</b></a>`).join("")}</div>`).join("");
}
function libPage(cat) {
  const L = LIBS.find(l => l[0] === cat); if (!L) return libIndex();
  if (cat === "trieuchung") return symptomPage(L);
  const [, title, desc, col] = L, items = libItems(cat);
  const body = items.map(({ mod, notes, di, tabs }) => `<section><h2>${modLabel(mod)}</h2>
    ${secBlocks(mod, notes)}
    ${cat === "benhhoc" ? (di.length ? `<h3>Từng bệnh</h3>${diseaseGrid(di, mod)}` : "") : (tabs.length && di.length ? `<h3>Theo từng bệnh</h3>${diseaseChips(di, tabs, mod)}` : "")}
  </section>`).join("") || `<p class="meta">Chưa có bài nào thuộc loại này.</p>`;
  $("#main").style.maxWidth = "1080px";
  $("#main").innerHTML = `${crumb([{ t: "Trang chủ", href: "#/" }, { t: "Thư viện học tập", href: "#/lib" }, { t: title }])}
    ${pageHead({ c: `var(--${col})`, kicker: "Thư viện học tập", title: `${esc(title)}`, desc: `${esc(desc)}` })}
    <div class="modpage" style="--c:var(--${col})">${cat === "benhhoc" ? tongCards() : ""}${body}</div>`;
  window.scrollTo(0, 0);
}
let MOD_HTML = "";   // danh sách module (cho ngăn Module trên điện thoại)
function tree(cur, sec) {
  const curN = byId[cur], curSec = curN ? sectionOfNote(curN) : +((location.hash.match(/^#\/m\/[^/]+\/(\d+)$/) || [])[1] || 0);   // đang ở trang mục thì mở đúng mục đó
  const here = curMod(), hashM = location.hash.match(/^#\/m\/([^/]+)\/(\d+)$/) || [];
  const renderMod = mod => {
    const ns = NOTES.filter(n => n.module === mod), di = diseases().filter(n => n.module === mod);
    const isHere = mod === here;
    const link = (n, s, label, c) => `<a href="#/n/${n.id}${s ? "/" + s : ""}" class="${n.id === cur && (!s || +s === sec) ? "on" : ""}"${c ? ` style="--c:var(--${c})"` : ""}>${esc(label || n.short || n.title)}</a>`;
    const gen = k => ns.filter(n => n.kind === "foundation" && sectionOfNote(n) === k).sort((x, y) => (x.order ?? 99) - (y.order ?? 99));
    const isDis = !!(curN && curN.kind === "disease" && curN.module === mod), open = c => c ? " open" : "";
    const sub = (s, body, isOpen) => `<details${open(isOpen)} style="--c:var(--s${secC(mod, s.n)})"><summary><b>${s.n}</b> ${esc(s.title)}</summary>${body}</details>`;
    const top = (s, on) => `<a class="top ${on ? "on" : ""}" style="--c:var(--s${secC(mod, s.n)})" href="#/m/${mod}/${s.n}"><b>${s.n}</b> ${esc(s.title)}</a>`;
    const ms = h => hashM[1] === mod && hashM[2] === String(h);
    const srcN = secByType(mod, "sources");
    const rows = secsOf(mod).map(s => {
      const on = isHere && curSec === s.n;
      if (s.type === "overview") return top(s, on && !ms(srcN));
      if (s.type === "groups") return sub(s, groupList(mod, s.n).map(g => `<a href="#/m/${mod}/${s.n}" data-g="${gId(mod, s.n, g)}" class="${on && curN && (curN.group || "Khác") === g ? "on" : ""}">${esc(gSide(mod, g))}</a>`).join(""), on);
      if (s.type === "diseases") return sub(s, di.map(d => `<details${open(isDis && curN.id === d.id)}><summary>${esc(d.short || d.title)}</summary>${SECS.map(([num, name]) => link(d, num, dnum(num, mod) + " " + name, SECCOL[num])).join("")}${link(d, 9, "★ Tóm tắt", "tsum")}</details>`).join(""), isDis);
      if (s.type === "notes" && s.byDisease) return sub(s, `<a href="#/m/${mod}/${s.n}">${esc(s.overviewLabel || "Khái quát")}</a>` + gen(s.n).filter(n => !isSyn(n)).map(n => link(n)).join("") + (gen(s.n).some(isSyn) ? `<div class="lay">Các hội chứng</div>` + gen(s.n).filter(isSyn).map(n => link(n)).join("") : "") + `<div class="lay">Theo bệnh</div>` + di.map(d => link(d, s.byDisease[0], d.short || d.title)).join(""), on || (isDis && isHere && s.byDisease.includes(sec)));
      if (s.type === "notes" && s.tree === "list") {
        const kids = gen(s.n), syn = kids.filter(isSyn);
        return sub(s, `<a href="#/m/${mod}/${s.n}">${esc(s.overviewLabel || "Xem cả mục")}</a>` + kids.filter(n => !isSyn(n)).map(n => link(n)).join("") + (syn.length ? `<div class="lay">Các hội chứng</div>` + syn.map(n => link(n)).join("") : ""), on);
      }
      return top(s, on);
    });
    return `<details class="mod"${isHere ? " open" : ""}><summary>${modLabel(mod)}</summary>
      ${rows.join("\n      ")}
    </details>`;
  };
  const modsHtml = mainMods().map(renderMod).join("");
  const khacHtml = KHAC_MODS.filter(m => MODULES[m]).map(renderMod).join("");
  MOD_HTML = modsHtml;
  const libCur = (location.hash.match(/^#\/lib\/([^/]+)/) || [])[1] || "", isHome = !location.hash || location.hash === "#/" || location.hash === "#";
  $("#khacmods").innerHTML = khacHtml;
  $("#tree").innerHTML = `<a class="sbhome${isHome ? " on" : ""}" href="#/"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5"/><path d="M6 10.5V19h12v-8.5"/></svg><span>Trang chủ</span></a>
    <div class="sbh">Module</div>${modsHtml}
    <div class="sbh"><a href="#/lib">Thư viện học tập</a></div>${LIBS.map(([k, t, , col]) => `<a class="sblib${libCur === k ? " on" : ""}" style="--c:var(--${col})" href="#/lib/${k}"><span>${esc(t)}</span><small>${libCount(k)}</small></a>`).join("")}`;
}
// ---- thanh công cụ: tìm kiếm, cài đặt hiển thị, điều hướng dưới (điện thoại) ----
const noDia = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
const plain = s => s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, k, label) => label || k).replace(/\{\{\+?[^}]*\}\}/g, "").replace(/==|\*\*|\{[rgbop]\|/g, "").replace(/[{}>@#|\[\]!`]/g, " ").replace(/\s+/g, " ").trim();
NOTES.forEach(n => { n._t = noDia(n.title + " " + (n.short || "")); n._tr = (n.title + " " + (n.short || "")).toLowerCase(); n._g = noDia(n.tags.join(" ")); n._b = noDia(n.body); });
function secAt(n, pos) {
  if (n.kind !== "disease") return 0;
  let s = 0, m; const re = /^## (\d)\./gm;
  while ((m = re.exec(n.body)) && m.index <= pos) s = +m[1];
  if (s === 8) {   // nằm trong phần "Theo dõi" thì mở tab Theo dõi đánh giá
    const heads = [...n.body.slice(0, pos).matchAll(/^###\s+(.*)$/gm)];
    if (heads.length && FOLLOW_RE.test(heads[heads.length - 1][1]) && n.body.lastIndexOf("## 8.", pos) >= 0) return 10;
  }
  return s;
}
// Tìm kiếm theo ý: bỏ từ nối, mở rộng bằng từ đồng nghĩa lâm sàng, chấm điểm theo độ phủ của câu hỏi
const SEARCH_STOP = new Set(["khi", "cua", "va", "bi", "co", "la", "o", "tren", "duoi", "toi", "minh", "nen", "sao", "vi", "nao", "khong", "cho", "voi", "mot", "nhung", "cac", "nguoi", "the", "gi", "thi", "lam", "duoc", "can", "nhu"]);
const SEARCH_SYN = {   // cụm dân gian → thuật ngữ trong bài
  "kho tho": ["khó thở", "suy hô hấp", "hô hấp", "thở nhanh", "dyspnea"],
  "dau nguc": ["đau ngực", "nhồi máu", "thiếu máu cơ tim", "thuyên tắc phổi"],
  "dau bung": ["đau bụng", "bụng cấp", "viêm ruột thừa", "viêm túi mật"],
  "hon me": ["hôn mê", "tri giác", "glasgow"],
  "phu": ["phù", "suy tim", "cổ trướng"],
  "chay mau": ["chảy máu", "xuất huyết", "đông máu"],
  "sot": ["sốt", "nhiễm trùng", "viêm"],
  "ho": ["ho", "ho đờm", "viêm phế quản"],
  "dau dau": ["đau đầu", "thần kinh"],
  "tim dap": ["hồi hộp", "nhịp nhanh", "rối loạn nhịp"],
  "suy than": ["suy thận", "creatinin", "lọc cầu thận"],
};
const wordRe = t => new RegExp("(^|[^a-z0-9])" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + (t.length <= 3 ? "($|[^a-z0-9])" : ""));   // từ ngắn khớp nguyên từ; từ dài khớp theo đầu từ
function runSearch(raw) {
  const q = noDia(raw.trim());
  if (!q) return { notes: [], sections: [], tools: [] };
  const syn = Object.entries(SEARCH_SYN).filter(([k]) => wordRe(k).test(q));
  const terms = [...new Set(q.split(/\s+/).filter(t => t && !SEARCH_STOP.has(t) && t.length > 1))];
  const tRe = terms.map(wordRe);
  const rawW = raw.trim().toLowerCase().split(/\s+/);   // "đau" và "đầu" cùng không dấu: nếu người dùng gõ dấu thì phân biệt theo dấu
  const accOK = (t, tr) => { const ws = rawW.filter(w => noDia(w) === t); return !ws.length || ws.some(w => tr.includes(w)); };
  const groups = syn.map(([, arr]) => arr.map(x => ({ x: noDia(x), re: wordRe(noDia(x)) })));
  const phrase = terms.join(" ");
  const notes = NOTES.map(n => {
    if (!terms.length && !groups.length) return null;
    let got = 0, sc = 0, first = -1, strong = false; const why = [];
    terms.forEach((t, i) => {
      const re = tRe[i], it = re.test(n._t) && accOK(t, n._tr), ig = re.test(n._g), ib = n._b.search(re);
      if (it || ig || ib >= 0) got++;
      if (it) sc += 6; else if (ig) sc += 3; else if (ib >= 0) sc += 1;
      if (ib >= 0 && first < 0) first = ib;
      if (it || ig) { why.push(t); strong = true; }
    });
    let gHit = 0;
    groups.forEach(g => {
      const hitT = g.find(o => o.re.test(n._t) || o.re.test(n._g)), hitB = g.find(o => o.re.test(n._b));
      if (hitT) strong = true;
      if (hitT || hitB) { gHit++; sc += hitT ? 6 : 3; if (first < 0 && hitB) first = n._b.search(hitB.re); }
    });
    const need = terms.length <= 2 ? terms.length : Math.ceil(terms.length / 2);
    if (terms.length && got < need && gHit === 0) return null;
    if (!terms.length && gHit === 0) return null;
    if (terms.length === 1 && terms[0].length <= 5 && !strong) return null;   // từ ngắn chỉ có trong nội dung thì bỏ, tránh nhiễu
    if (phrase && n._b.includes(phrase)) sc += 5;
    if (phrase && n._t.includes(phrase)) sc += 10;
    const cov = terms.length ? got / terms.length : 1;
    return { n, sc: (sc + gHit * 2) * (0.5 + cov / 2), pos: first, why: why.slice(0, 3) };
  }).filter(Boolean).sort((a, b) => b.sc - a.sc).slice(0, 12);
  const sections = [];
  if (terms.length || groups.length) Object.keys(MODULES).forEach(m => secsOf(m).forEach(sp => {
    if (sp.type === "overview" || sp.type === "sources") return;
    const t = noDia(sp.title), tr = sp.title.toLowerCase();
    const allTerms = terms.length && terms.every((x, i) => tRe[i].test(t) && accOK(x, tr));
    if (allTerms || groups.some(g => g.some(o => o.re.test(t)))) sections.push({ m, sp });
  }));
  const tools = terms.length ? calcIndex().filter(c => terms.every(x => c._s.includes(x))).slice(0, 4) : [];
  return { notes, sections: sections.slice(0, 5), tools };
}
function renderResults() {
  const box = $("#results"), q = $("#q").value;
  if (!q.trim()) { box.hidden = true; box.innerHTML = ""; return; }
  const { notes: hits, sections, tools } = runSearch(q);
  box.hidden = false;
  const secHtml = sections.map(({ m, sp }) => `<a class="sechit" href="#/m/${m}/${sp.n}"><b>${esc(sp.title)}</b> <span class="where">${esc(MODULES[m] || m)}</span></a>`).join("");
  const toolHtml = tools.map(t => `<a class="sechit" href="#/congcu/${t.id}"><b>${esc(t.title)}</b> <span class="where">Công cụ tính toán · ${esc(calcCatName(t))}</span></a>`).join("");
  box.innerHTML = (toolHtml ? `<div class="sechdr">Công cụ</div>${toolHtml}` : "") + (secHtml ? `<div class="sechdr">Mục</div>${secHtml}` : "") + (hits.length ? (secHtml || toolHtml ? '<div class="sechdr">Bài</div>' : "") + hits.map(({ n, pos, why }) => {
    const sec = pos >= 0 ? secAt(n, pos) : 0;
    const href = `#/n/${n.id}${sec ? "/" + sec : ""}`;
    const sc = secOf(n.module, sectionOfNote(n));
    const where = n.kind === "tong" ? "Nội và ngoại khoa" : n.kind === "disease" ? (sec ?`${dnum(sec, n.module)} ${SECNAME[sec]}` : (sc.title || "Bệnh học")) : (n.kind === "overview" ? "Tổng quan" : (sc.title || "Nền tảng"));
    const snip = pos >= 0 ? esc(plain(n.body.slice(Math.max(0, pos - 40), pos + 90))) : "";
    const reason = why && why.length ? `<em class="why">khớp: ${esc(why.join(", "))}</em>` : "";
    return `<a href="${href}"><b>${esc(n.short || n.title)}</b> <span class="where">${esc(where)}</span>${reason}${snip ? `<small>…${snip}…</small>` : ""}</a>`;
  }).join("") : (secHtml || toolHtml ? "" : '<div class="none">Không có kết quả. Thử dùng từ khóa ngắn hơn, ví dụ "khó thở" hoặc "tim".</div>'));
}
const qEl = $("#q");
qEl.addEventListener("input", renderResults);
qEl.addEventListener("focus", renderResults);
qEl.addEventListener("keydown", e => {
  if (e.key === "Escape") { $("#results").hidden = true; qEl.blur(); $("#gsearch").classList.remove("open"); }
  if (e.key === "Enter") { const a = $("#results a"); if (a) { location.hash = a.getAttribute("href"); $("#results").hidden = true; qEl.blur(); $("#gsearch").classList.remove("open"); } }
});
$("#results").addEventListener("click", () => { $("#results").hidden = true; $("#gsearch").classList.remove("open"); });
document.addEventListener("keydown", e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || "")) || e.target.isContentEditable;
  if ((e.key === "/" && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) { e.preventDefault(); focusSearch(); }
});
function focusSearch() { $("#gsearch").classList.add("open"); qEl.focus(); qEl.select(); }
document.addEventListener("click", e => {
  if (!e.target.closest("#gsearch") && !e.target.closest("#bnSearch")) { $("#results").hidden = true; $("#gsearch").classList.remove("open"); }
});
// Mục lục bên trái: máy tính ẩn/hiện và nhớ lựa chọn trên thiết bị này.
// Điện thoại không dùng thanh bên: các mục Module và Khác ở thanh dưới mở một ngăn riêng (#sheet).
const narrow = () => matchMedia("(max-width:820px)").matches;
const setSideOff = off => {
  document.documentElement.classList.toggle("side-off", off);
  $("#sideEdge").setAttribute("aria-expanded", String(!off));
};
const toggleSide = () => {
  const off = !document.documentElement.classList.contains("side-off");
  setSideOff(off);
  try { off ? localStorage.setItem("ykkb_side", "off") : localStorage.removeItem("ykkb_side"); } catch {}
};
const sheet = $("#sheet");
function closeSheet() {
  sheet.hidden = true; sheet.dataset.mode = "";
  const more = $("#sbmore"); if (more.parentNode !== $("#side")) $("#side").insertBefore(more, $("#build"));   // trả mục Khác về thanh bên
  $("#bnMenu").classList.remove("open"); $("#bnMore").classList.remove("open");
  $("#bnMenu").setAttribute("aria-expanded", "false"); $("#bnMore").setAttribute("aria-expanded", "false");
}
function openSheet(mode) {
  if (!sheet.hidden && sheet.dataset.mode === mode) return closeSheet();
  closeSheet(); sheet.dataset.mode = mode;
  sheet.innerHTML = `<div class="sheethead"><span>${mode === "module" ? "Module" : "Khác"}</span><button class="sheetx" type="button" aria-label="Đóng">✕</button></div><div class="sheetbody"></div>`;
  const body = sheet.querySelector(".sheetbody");
  if (mode === "module") body.innerHTML = MOD_HTML; else { body.appendChild($("#sbmore")); }
  sheet.hidden = false; sheet.scrollTop = 0;
  const btn = $(mode === "module" ? "#bnMenu" : "#bnMore"); btn.classList.add("open"); btn.setAttribute("aria-expanded", "true");
}
sheet.addEventListener("click", e => { if (e.target.closest(".sheetx") || e.target.closest("a")) closeSheet(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !sheet.hidden) closeSheet(); });
matchMedia("(max-width:820px)").addEventListener("change", e => { if (!e.matches) closeSheet(); });
$("#sideEdge").onclick = toggleSide; $("#bnMenu").onclick = () => openSheet("module"); $("#bnMore").onclick = () => openSheet("more");
$("#bnSearch").onclick = e => { e.stopPropagation(); focusSearch(); };
// cỡ chữ và giao diện (lưu trên từng thiết bị)
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } }, lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
function applyPrefs() {
  const fs = parseFloat(lsGet("ykkb_fs")) || 1, th = lsGet("ykkb_theme") || "auto";
  setSideOff(!narrow() && lsGet("ykkb_side") === "off");
  document.documentElement.style.setProperty("--fs", fs);
  document.documentElement.dataset.gl = lsGet("ykkb_gl") || "off";
  $("#setPanel").querySelectorAll("[data-gl]").forEach(b => b.classList.toggle("on", b.dataset.gl === document.documentElement.dataset.gl));
  if (th === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = th;
  $("#setPanel").querySelectorAll("[data-fs]").forEach(b => b.classList.toggle("on", Math.abs(parseFloat(b.dataset.fs) - fs) < .01));
  $("#setPanel").querySelectorAll("[data-th]").forEach(b => b.classList.toggle("on", b.dataset.th === th));
  const L = window.YKKB_LOCK, row = $("#setToRow");   // hỏi lại mật khẩu sau bao lâu (chỉ có ý nghĩa với bản mã hóa)
  if (L && L.enc) { row.hidden = false; const sel = $("#setTo"); if (!sel.options.length) sel.innerHTML = L.options.map(([m, t]) => `<option value="${m}">${t}</option>`).join(""); sel.value = String(L.get()); }
}
$("#setTo").addEventListener("change", e => window.YKKB_LOCK && window.YKKB_LOCK.set(e.target.value));
$("#setPanel").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.fs) lsSet("ykkb_fs", b.dataset.fs);
  if (b.dataset.th) lsSet("ykkb_theme", b.dataset.th === "auto" ? null : b.dataset.th);
  if (b.dataset.gl) { lsSet("ykkb_gl", b.dataset.gl); route(); }
  applyPrefs();
});
applyPrefs();

// gần đây
const RK = "ykkb_recent";
function pushRecent(id, sec) {
  const list = (store.get(RK, []) || []).filter(r => r.id !== id);
  list.unshift({ id, sec: sec || 0, t: Date.now() });
  store.set(RK, list.slice(0, 8));
}
// Đầu trang chung cho mọi trang nội dung: nhãn mục, tên, mô tả, huy hiệu, hành động
const pageHead = ({ c, kicker = "", title, desc = "", badges = "", actions = "" }) =>
  `<header class="cover" style="--c:${c}">${kicker ? `<div class="kicker">${kicker}</div>` : ""}<h1>${title}</h1>${desc ? `<p class="lede">${desc}</p>` : ""}${badges ? `<div class="badges">${badges}</div>` : ""}${actions ? `<div class="actions">${actions}</div>` : ""}</header>`;
window.pageHead = pageHead;
let CBN = null;   // thẻ ôn nhóm theo bài
const cardsBy = id => (CBN || (CBN = allCards.reduce((m, c) => ((m[c.note] = m[c.note] || []).push(c), m), {})))[id] || [];
const crumb = parts => `<nav class="crumb">${parts.map((p, i) => p.href ? `<a href="${p.href}">${esc(p.t)}</a>` : `<span>${esc(p.t)}</span>`).join('<i>›</i>')}</nav>`;

// ---- thẻ ôn tập (Leitner đơn giản) ----
const DAYS = [0, 1, 3, 7, 21], DAY = 864e5;
const allCards = NOTES.flatMap(cardsOf);
const prog = () => store.get("ykkb_cards", {});
const dueCards = () => { const p = prog(), now = Date.now(); return allCards.filter(c => !p[c.id] || p[c.id].due <= now); };
function badge() { const el = $("#dueBadge"); if (el) el.textContent = dueCards().length || ""; }

// ---- trang ----
function hasPareto(d) { return /^## 9\.[^\n]*Tóm tắt/m.test(d.body); }
function diseaseGrid(ds, mod = curMod()) {
  return `<div class="dgrid">${ds.map(d => { const { secs } = diseaseParts(d), nc = cardsBy(d.id).length; return `<article class="dcard"><a class="dtitle" href="#/n/${d.id}/3">${esc(d.short || d.title)}</a>
      <div class="dchips">${SECS.map(([n, t, c]) => secs[n] ? `<a class="chip" style="--c:var(--${c})" href="#/n/${d.id}/${n}" title="${dnum(n, mod)} ${esc(t)}">${dnum(n, mod)}</a>` : `<span class="chip off" title="${dnum(n, mod)} ${esc(t)} (chưa có)">${dnum(n, mod)}</span>`).join("")}</div>
      <div class="dfoot">${hasPareto(d) ? `<a class="pill9" href="#/n/${d.id}/9">★ Tóm tắt</a>` : '<span class="meta">Chưa có tóm tắt</span>'}${nc ? `<a class="dcards" href="#/cards/${d.id}">${nc} thẻ</a>` : ""}</div></article>`; }).join("")}</div>
    <p class="legend2 meta">${SECS.map(([n, t, c]) => `<span><i class="dot" style="background:var(--${c})"></i>${dnum(n, mod)} ${esc(t)}</span>`).join("")}</p>`;
}

function home() {
  const ds = diseases(), mods = mainMods(), cm = curMod();   // cm: chuyên khoa xem gần nhất
  const fo = NOTES.filter(n => n.kind === "foundation").length;
  const nKhung = window.KHUNG ? window.KHUNG.items.length : 129;
  const recent = (store.get(RK, []) || []).map(r => ({ ...r, n: byId[r.id] })).filter(r => r.n).slice(0, 4);
  const due = dueCards().length;
  const oath = byId["loi-the-hippocrates"];
  const ACC = [2, 3, 4, 5, 6, 7, 8, 10];   // màu nhấn xoay vòng cho thẻ chuyên khoa
  const info = mod => { const dsm = ds.filter(n => n.module === mod), fom = NOTES.filter(n => n.module === mod && n.kind === "foundation").length; return { dsm, fom, ready: dsm.length > 0 || fom > 1 }; };
  const mcard = (mod, i) => {
    const { dsm, fom, ready } = info(mod), sN = secByType(mod, "summary");
    return `<article class="mcard${ready ? "" : " soon"}" style="--c:var(--s${ACC[i % ACC.length]})">
      <a class="mname" href="#/m/${mod}/1"><b>${esc(MODULES[mod] || mod)}</b>${MODULES_EN[mod] ? `<small>${esc(MODULES_EN[mod])}</small>` : ""}</a>
      <p class="mmeta">${ready ? `${dsm.length} bệnh · ${fom} bài chung` : "Đang xây dựng"}</p>
      <div class="msecs">${secsOf(mod).map(s => `<a href="#/m/${mod}/${s.n}" title="${esc(s.title)}"><b>${s.n}</b><span>${esc(s.title)}</span></a>`).join("")}</div>
      ${sN ? `<a class="msum" href="#/m/${mod}/${sN}">★ Tóm tắt Pareto</a>` : ""}
    </article>`;
  };
  const ready = mods.filter(m => info(m).ready), soon = mods.filter(m => !info(m).ready);
  const ico = p => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
  const tiles = [
    ["#/lib", "var(--s5)", ico('<path d="M5 5h5v14H5zM12 5h3l4 14h-3z"/>'), "Thư viện học tập", "Tra theo loại: triệu chứng, bệnh học, cận lâm sàng"],
    [`#/m/${cm}/1`, "var(--s2)", ico('<path d="M4 7l8-4 8 4-8 4zM4 12l8 4 8-4M4 17l8 4 8-4"/>'), "Module", `Tiếp tục ${esc(MODULES[cm] || cm)}`],
    ["#/khung", "var(--s3)", ico('<path d="M6 4h12v16H6zM9 9h6M9 13h6M9 17h3"/>'), "Đề cương ôn thi", `${nKhung} vấn đề khung thi CCHN`],
    ["#/cards", "var(--s10)", ico('<rect x="4" y="6" width="13" height="12" rx="2"/><path d="M8 3h11a1 1 0 0 1 1 1v11"/>'), "Ôn thẻ", due ? `${due} thẻ đến hạn hôm nay` : "Chưa có thẻ đến hạn"],
  ];
  $("#main").style.maxWidth = "1120px";
  $("#main").innerHTML = `
  <section class="hero2">
    <div class="herotxt">
      <span class="eyebrow">Ôn thi chứng chỉ hành nghề bác sĩ đa khoa</span>
      <h1>Học tập Y khoa</h1>
      <p>Từ nền tảng đến phác đồ: mỗi bệnh một trang có tab, mỗi ý gắn nguồn để kiểm tra lại.</p>
      <button class="herosearch" id="heroSearch"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg> Tìm bài, bệnh, thuốc… <kbd>/</kbd></button>
      <div class="stats"><div><b>${NOTES.length}</b><span>bài</span></div><div><b>${ds.length}</b><span>bệnh</span></div><div><b>${fo}</b><span>bài chung</span></div><div><b>${nKhung}</b><span>vấn đề khung thi</span></div></div>
    </div>
    ${oath ? `<div class="oath"><span class="oathmark" aria-hidden="true">⚕</span>
      <span class="eyebrow">Lời thề Hippocrates</span>
      <blockquote>Sức khỏe và hạnh phúc của người bệnh sẽ là mối quan tâm hàng đầu của tôi.</blockquote>
      <cite>Tuyên ngôn Geneva, Hiệp hội Y khoa Thế giới</cite>
      <div class="oathact"><a class="btn p" href="#/n/${oath.id}">Đọc lời thề</a><a class="btn" href="#/m/y-duc-ky-nang-an-toan/2">Y đức</a></div></div>` : ""}
  </section>
  <section class="quick">${tiles.map(([h, c, i, t, s]) => `<a class="qtile" style="--c:${c}" href="${h}"><span class="qico">${i}</span><span class="qtxt"><b>${t}</b><small>${s}</small></span></a>`).join("")}</section>
  ${recent.length ? `<section><h2>Tiếp tục</h2><div class="rgrid">${recent.map(r => `<a class="rcard" href="#/n/${r.id}${r.sec ? "/" + r.sec : ""}"><small>${r.sec ? dnum(r.sec, r.n.module) + " · " + SECNAME[r.sec] : esc(r.n.group || (r.n.kind === "overview" ? "Tổng quan" : "Bài"))}</small><b>${esc(r.n.short || r.n.title)}</b></a>`).join("")}</div></section>` : ""}
  <section><h2>Chuyên khoa</h2><div class="mgrid">${ready.map(mcard).join("")}</div>
    ${soon.length ? `<details class="soonbox"><summary>Đang xây dựng (${soon.length} module)</summary><div class="mgrid">${soon.map((m, i) => mcard(m, i + ready.length)).join("")}</div></details>` : ""}</section>
  <details class="guide"><summary>Giới thiệu và cách đọc một trang</summary>
    <p>Học tập Y khoa là kho kiến thức cá nhân để ôn thi chứng chỉ hành nghề bác sĩ đa khoa. Nội dung được soạn lại từ giáo trình giảng dạy và văn bản của Bộ Y tế; các nhận định chính đều gắn nguồn (tên tài liệu và số trang) để kiểm tra lại. Đây là tài liệu học tập, không thay cho hướng dẫn chuyên môn hay quyết định lâm sàng.</p>
    <div class="legend3">
      <div class="callout key"><div class="ct">Ý chính</div><p>Điều cần nhớ nhất của bài.</p></div>
      <div class="callout warn"><div class="ct">Lưu ý – bẫy thi</div><p>Chỗ dễ nhầm và nơi các nguồn khác nhau.</p></div>
      <div class="callout red"><div class="ct">Cấp cứu – nguy hiểm</div><p>Dấu hiệu cần xử trí hoặc chuyển tuyến ngay.</p></div>
    </div>
    <p>Ô nguồn như <span class="src">Y5 tr.12</span> cho biết ý lấy từ trang nào của tài liệu nào (số trang là số trang trong file PDF nguồn; nhiều trang viết <span class="src">Y5 tr.12–14, 20</span>; nhiều nguồn cách nhau dấu chấm phẩy). Ô cam <span class="src ext">+StatPearls 2024</span> là nguồn ngoài tài liệu của bạn. Ô <span class="src">Notion: tên giáo trình</span> là phần bổ sung từ ghi chú chép lại giáo trình cũ (tên giáo trình lấy từ thuộc tính trên Notion), chỉ dùng khi giáo trình mới không có; khi hai nguồn khác nhau, bài theo nguồn mới hơn và ghi rõ chỗ khác. Chữ "tài liệu không nêu" nghĩa là nguồn đã dùng không trả lời điểm đó.</p>
  </details>
`;
  $("#heroSearch").onclick = focusSearch;
}

// Bài nền tảng: khối đóng/mở xếp nối tiếp trên một trang, không tách thành trang con
// TODO(human): chọn những khối nào mở sẵn khi vào trang mục (xem openByDefault)
function openByDefault(flat, openId) {
  return new Set(openId ? [openId] : []);
}
function noteToggles(list, openSet) {
  return list.map(n => `<details class="fold note-t" id="t-${n.id}"${openSet.has(n.id) ? " open" : ""}>
      <summary>${esc(n.short || n.title)}${cardsBy(n.id).length ? ` <small class="nmeta">${cardsBy(n.id).length} thẻ</small>` : ""}</summary>
      ${md(n.body)}
    </details>`).join("");
}

// Trang giới thiệu của từng mục trên thanh công cụ (2–5); openId mở sẵn một bài khi đi từ #/n/<id>
function modSection(mod, k, openId) {
  const sp = secOf(mod, k), { title, type } = sp;
  const ns = NOTES.filter(n => n.module === mod), di = diseases().filter(n => n.module === mod);
  const gen = ns.filter(n => n.kind === "foundation" && sectionOfNote(n) === k).sort((x, y) => (x.order ?? 99) - (y.order ?? 99));
  const groups = type === "groups" ? groupList(mod, k) : [];
  const flat = type === "groups" ? groups.flatMap(g => gen.filter(n => (n.group || "Khác") === g)) : gen;
  const openSet = sp.openAll ? new Set(gen.map(n => n.id)) : openByDefault(flat, openId);
  const allBtn = gen.length ? `<p><button class="btn" data-act="toggleall" data-scope="details.note-t">Mở / đóng tất cả</button></p>` : "";
  const byDisease = (secNums) => `<div class="rgrid">${di.map(d => `<div class="rcard"><b>${esc(d.short || d.title)}</b>${secNums.map(s => `<a class="chip wide" href="#/n/${d.id}/${s}">${dnum(s, mod)} ${esc(SECNAME[s])}</a>`).join("")}</div>`).join("")}</div>`;
  let body = "";
  if (type === "groups") {
    body = allBtn + groups.map(g => `<section id="${gId(mod, k, g)}"><h2>${esc(gTitle(mod, g))}</h2>${noteToggles(flat.filter(n => (n.group || "Khác") === g), openSet)}</section>`).join("");
  } else if (type === "notes" && sp.byDisease) {
    const syn = gen.filter(isSyn), sym = gen.filter(n => !isSyn(n));
    body = `<section><h2>${esc(sp.genTitle || "Bài khái quát")}</h2>${sym.length ? allBtn + noteToggles(sym, openSet) : (gen.length ? "" : "<p class='meta'>Chưa có.</p>")}</section>
      ${syn.length ? `<section id="syn-${k}"><h2>Các hội chứng</h2>${noteToggles(syn, openSet)}</section>` : ""}
      <section><h2>${esc(sp.disTitle || "Theo từng bệnh")}</h2>${byDisease(sp.byDisease)}</section>`;
  } else if (type === "diseases") {
    body = `<section>${diseaseGrid(di, mod)}</section>`;
  } else if (type === "summary") {
    body = `<p><button class="btn" data-act="toggleall">Mở / đóng tất cả</button></p>` + di.map((d, i) => {
      const s9 = diseaseParts(d).secs[9]; if (!s9) return "";
      return `<details class="fold pareto"${i === 0 ? " open" : ""}><summary>${esc(d.short || d.title)} <a class="chip wide" href="#/n/${d.id}/9">mở trang bệnh</a></summary>${md(relabel(summaryOnly(s9.body)).replace(/^###\s+Con số và mốc phải nhớ\s*$/m, ""))}</details>`;
    }).join("");
  } else if (type === "sources") {
    const st = ns.find(n => n.kind === "sources");
    body = (st ? `<section>${md(st.body)}</section>` : "") +
      `<section><h2>Nguồn theo từng bệnh</h2>` + di.map(d => {
        const s9 = diseaseParts(d).secs[9], b = s9 ? s9.body : "";
        const doc = foldBody(b, "Nguồn tài liệu"), ext = foldBody(b, "Nguồn ngoài");
        return `<details class="fold"><summary>${esc(d.short || d.title)}</summary>${d.source ? `<p class="meta">Nguồn chính: ${esc(d.source)}</p>` : ""}${doc ? `<h3>Nguồn tài liệu</h3>${md(doc)}` : ""}${ext ? `<h3>Nguồn ngoài tài liệu</h3>${md(ext)}` : ""}</details>`;
      }).join("") + `</section>` +
      `<section><h2>Nguồn theo từng bài chung</h2><div class="tw"><table><thead><tr><th>Bài</th><th>Nguồn</th></tr></thead><tbody>${ns.filter(n => n.kind === "foundation").map(n => `<tr><td><a href="#/n/${n.id}">${esc(n.short || n.title)}</a></td><td>${esc(n.source || "")}</td></tr>`).join("")}</tbody></table></div></section>`;
  } else if (type === "notes") {   // mục gồm các bài; "openAll": true trong _module.json thì mở sẵn để đọc liền
    // mục chỉ có một bài: hiện nội dung luôn, không cần thanh mở/đóng
    const syn = gen.filter(isSyn), sym = gen.filter(n => !isSyn(n));
    body = gen.length === 1 ? `<section id="t-${gen[0].id}"><h2>${esc(gen[0].short || gen[0].title)}</h2>${md(gen[0].body)}</section>`
      : sp.pages && gen.length ? `<div class="rgrid">${gen.map(n => `<div class="rcard"><b>${esc(n.short || n.title)}</b><p class="meta">${esc(n.tags.slice(0, 4).join(", "))}</p><a class="chip wide" href="#/n/${n.id}">Mở trang →</a></div>`).join("")}</div>`
      : gen.length ? allBtn + (sym.length ? noteToggles(sym, openSet) : "") + (syn.length ? `<section id="syn-${k}"><h2>Các hội chứng</h2>${noteToggles(syn, openSet)}</section>` : "")
      : "<p class='meta'>Chưa có.</p>";
  } else if (type === "sim") {   // công cụ tương tác đứng riêng (trang HTML trong 5-khac/, nhúng bằng iframe)
    body = `<section><p class="meta">${esc(sp.desc || "")}</p>` +
      `<iframe class="simframe" src="${esc(sp.src)}" title="${esc(title)}" loading="lazy"></iframe>` +
      `<p class="meta">Không hiện được? <a href="${esc(sp.src)}" target="_blank" rel="noopener">Mở trong tab mới ↗</a></p></section>`;
  } else if (type === "cards") {
    const withCards = ns.map(n => ({ n, c: cardsOf(n) })).filter(x => x.c.length);
    const total = withCards.reduce((s, x) => s + x.c.length, 0);
    body = `<div class="callout note"><div class="ct">Ghi chú</div><p>Các thẻ tự kiểm tra đã tạo được <b>lưu lại</b>. Hiện <b>tạm thời chưa xây dựng thêm</b>.</p></div>
      <p><b>${total}</b> thẻ trong <b>${withCards.length}</b> bài · <a class="btn p" href="#/cards">Bắt đầu ôn thẻ (lặp lại ngắn quãng)</a></p>` +
      withCards.map(({ n, c }) => `<details class="fold"><summary>${esc(n.short || n.title)} <small>${c.length} thẻ</small></summary>${c.map(x => `<details class="card"><summary>${inline(x.q)}</summary><div>${inline(x.a)}</div></details>`).join("")}</details>`).join("");
  }
  $("#main").innerHTML = `${crumb([{ t: "Trang chủ", href: "#/" }, { t: MODULES[mod] || mod, href: `#/m/${mod}/1` }, { t: `${k} ${title}` }])}
    ${pageHead({ c: `var(--s${secC(mod, k)})`, kicker: `${esc(MODULES[mod] || mod)} · ${k} ${esc(title)}`, title: `${k}. ${esc(title)}` })}
    <div class="modpage" style="--c:var(--s${secC(mod, k)})">${body}</div>`;
  const target = openId && document.getElementById("t-" + openId), grp = jumpTo && document.getElementById(jumpTo);
  jumpTo = null;
  if (target) target.scrollIntoView(); else if (grp) grp.scrollIntoView(); else window.scrollTo(0, 0);
}

function splitSections(body) {
  const parts = body.split(/^## (\d)\.\s*(.*)$/m);      // [pre, num, title, body, num, title, body...]
  const secs = {};
  for (let k = 1; k < parts.length; k += 3) secs[+parts[k]] = { title: parts[k + 1].trim(), body: parts[k + 2] };
  return { pre: parts[0], secs };
}
// Các mục hiển thị của một bệnh: tách "Theo dõi" khỏi mục 8
function diseaseParts(n) {
  const { pre, secs } = splitSections(n.body), out = { ...secs };
  if (secs[8]) {
    const parts = secs[8].body.split(/^(?=###\s)/m);
    const follow = parts.filter(p => FOLLOW_RE.test(p.replace(/^###\s+/, "")));
    out[8] = { title: "Tiên lượng – Dự phòng", body: parts.filter(p => !follow.includes(p)).join("") };
    if (follow.length) out[10] = { title: "Theo dõi đánh giá", body: follow.join("") };
  }
  return { pre, secs: out };
}
// Phần Tóm tắt (trước các thẻ gập nguồn / tự kiểm tra) và nội dung một thẻ gập theo tên
function summaryOnly(body) { const cut = body.search(/^@@fold!?\s+(Nguồn|Tự kiểm tra)/m); return cut >= 0 ? body.slice(0, cut) : body; }
function foldBody(body, prefix) {
  const L = body.split("\n"), re = new RegExp("^@@fold!?\\s+" + prefix, "i"), i = L.findIndex(l => re.test(l.trim()));
  if (i < 0) return "";
  let d = 1, j = i + 1;
  for (; j < L.length; j++) { const t = L[j].trim(); if (/^@@(tabs|fold|calc|flow|stages)/.test(t)) d++; else if (t === "@@end" && --d === 0) break; }
  return L.slice(i + 1, j).join("\n");
}

// nút "Trước / Tiếp" giữa các tab của một bệnh (đọc liền bằng một ngón tay)
function pagerOf(n, have, secs, sec) {
  const order = [...have, ...(secs[9] ? [9] : [])], i = order.indexOf(sec);
  if (order.length < 2 || i < 0) return "";
  const nm = num => num === 9 ? "★ Tóm tắt" : `${dnum(num)} ${SECS.find(x => x[0] === num)[1]}`;
  const link = (k, cls, lab) => k >= 0 && k < order.length ? `<a class="pg ${cls}" href="#/n/${n.id}/${order[k]}"><small>${lab}</small><b>${nm(order[k])}</b></a>` : "<span></span>";
  return `<nav class="pager" aria-label="Chuyển tab">${link(i - 1, "prev", "← Trước")}<button type="button" class="pg up" aria-label="Lên đầu trang"><span aria-hidden="true">↑</span><b>Lên đầu trang</b></button>${link(i + 1, "next", "Tiếp →")}</nav>`;
}
function diseasePage(n, sec) {
  const { pre, secs } = diseaseParts(n);
  const have = SECS.filter(([num]) => secs[num]).map(([num]) => num);
  if (!have.length && !secs[9]) return tongPage(n);   // bài khai báo kind: disease nhưng chưa có mục "## N.": đọc liền một trang, không báo lỗi
  const isSummary = +sec === 9 && secs[9];
  sec = isSummary ? 9 : (secs[sec] ? sec : have[0]);
  const khung = (n.khung || []).length ? `<span class="stt"><small>Khung STT</small>${n.khung.map(k => `<a class="chip wide" href="#/khung/${k}">${k}</a>`).join("")}</span>` : "";
  pushRecent(n.id, sec);
  const mod = n.module, dk = secByType(mod, "diseases") || 5, body = isSummary ? summaryOnly(secs[9].body) : secs[sec].body;
  const col = `var(--${SECCOL[sec]})`, cont = withToc(md(relabel(body)));
  $("#main").innerHTML = `${crumb([{ t: "Trang chủ", href: "#/" }, { t: MODULES[mod] || mod, href: `#/m/${mod}/1` }, { t: `${dk} ${secOf(mod, dk).title}`, href: `#/m/${mod}/${dk}` }, { t: n.title }])}
    ${pageHead({ c: `var(--s${secC(mod, dk)})`, kicker: `${esc(MODULES[mod] || mod)} · ${dk} ${esc(secOf(mod, dk).title)}`, title: `${esc(n.title)}${n.en ? ` <small class="en">${esc(n.en)}</small>` : ""}`, badges: khung })}
    <div class="dtabs">${SECS.filter(([num]) => secs[num]).map(([num, t, c]) => `<a class="dt${num === sec ? " on" : ""}" style="--c:var(--${c})" href="#/n/${n.id}/${num}"><b>${dnum(num)}</b> ${t}</a>`).join("")}${secs[9] ? `<a class="dt sum${isSummary ? " on" : ""}" href="#/n/${n.id}/9">★ Tóm tắt</a>` : ""}</div>
    ${!isSummary && sec === have[0] && pre.trim() ? `<div class="pre">${md(relabel(pre))}</div>` : ""}
    <div class="notepage" style="--c:${col}">${tocBox(cont.items)}${cont.html}</div>
    ${pagerOf(n, have, secs, +sec)}
    ${n.source ? `<p class="meta srcline">Nguồn: ${esc(n.source)}</p>` : ""}`;
  window.scrollTo(0, 0);
  return sec;
}

// Bài tổng hợp: đọc liền một trang, không có tab bệnh; các bài gốc nằm ở hai module
function tongPage(n) {
  pushRecent(n.id, 0);
  const cont = withToc(md(relabel(n.body)));
  $("#main").innerHTML = `${crumb([{ t: "Trang chủ", href: "#/" }, { t: "Thư viện học tập", href: "#/lib" }, { t: "Bệnh học", href: "#/lib/benhhoc" }, { t: n.short || n.title }])}
    ${pageHead({ c: "var(--benh)", kicker: "Thư viện học tập · Bệnh học", title: esc(n.title) })}
    <div class="notepage" style="--c:var(--benh)">${tocBox(cont.items)}${cont.html}</div>
    ${n.source ? `<p class="meta srcline">Nguồn: ${esc(n.source)}</p>` : ""}`;
  window.scrollTo(0, 0);
}

function note(id, sec) {
  const n = byId[id];
  if (!n) { $("#main").innerHTML = "<h1>Không tìm thấy bài</h1>"; return; }
  if (n.kind === "disease") return diseasePage(n, +sec || 0);
  if (n.kind === "tong") return tongPage(n);
  const k = sectionOfNote(n), mod = n.module, sp = secOf(mod, k);
  pushRecent(id, 0);
  if (n.kind === "foundation" && ["groups", "notes"].includes(sp.type) && !sp.pages) return modSection(mod, k, id);   // mục "pages": mỗi bài là một trang riêng
  const cont = withToc(md(n.body));
  $("#main").innerHTML = `${crumb([{ t: "Trang chủ", href: "#/" }, { t: MODULES[mod] || mod, href: `#/m/${mod}/1` }, { t: `${k} ${sp.title}`, href: `#/m/${mod}/${k}` }])}
    ${pageHead({ c: `var(--s${secC(mod, k)})`, kicker: `${esc(MODULES[mod] || mod)} · ${k} ${esc(sp.title)}`, title: esc(n.title) })}
    <div class="notepage" style="--c:var(--s${secC(mod, k)})">${tocBox(cont.items)}${cont.html}</div>
    ${n.source ? `<p class="meta srcline">Nguồn: ${esc(n.source)}</p>` : ""}`;
  window.scrollTo(0, 0);
}

// ---- ôn thẻ theo bệnh học: mỗi bệnh (hoặc bài chung) là một bộ thẻ; thẻ nhắc lại theo hộp Leitner ----
const needReview = (c, p = prog(), now = Date.now()) => !p[c.id] || p[c.id].due <= now;
const cardStat = list => { const p = prog(), now = Date.now(); let due = 0, nw = 0, mastered = 0; list.forEach(c => { const x = p[c.id]; if (!x) { nw++; due++; } else { if (x.due <= now) due++; if (x.box >= 3) mastered++; } }); return { total: list.length, due, nw, mastered }; };
const cardPool = key => key === "_due" ? allCards : key.startsWith("mod:") ? allCards.filter(c => byId[c.note].module === key.slice(4)) : allCards.filter(c => c.note === key);
let cardsMod = "", CS = null;   // cardsMod: chuyên khoa đang lọc ở danh sách; CS: phiên ôn đang chạy
function cardsHome() {
  const mods = Object.keys(MODULES).filter(m => !cardsMod || m === cardsMod), st = cardStat(allCards);
  const byNote = {}; allCards.forEach(c => (byNote[c.note] = byNote[c.note] || []).push(c));
  const deck = (n, col) => { const s = cardStat(byNote[n.id]); return `<div class="deck" style="--c:var(--${col})"><a class="dmain" href="#/cards/${n.id}"><b>${esc(n.short || n.title)}</b><span class="dmeta">${s.total} thẻ · ${s.due ? `<em>${s.due} cần ôn</em>` : "đã ôn xong"}</span><span class="dbar"><i style="width:${Math.round(100 * s.mastered / s.total)}%"></i></span></a><a class="dall" href="#/cards/${n.id}/all" title="Ôn lại cả bộ, kể cả thẻ chưa đến hạn">Ôn lại cả bộ</a></div>`; };
  const sections = mods.map(mod => {
    const ns = NOTES.filter(n => n.module === mod && byNote[n.id]);
    const dis = ns.filter(n => n.kind === "disease").sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    const fo = ns.filter(n => n.kind !== "disease");
    const lib = LIBS.map(([k, t]) => [t, fo.filter(n => libOf(n) === k)]).concat([["Bài khác", fo.filter(n => !libOf(n))]]).filter(([, l]) => l.length);
    const dueMod = cardStat(allCards.filter(c => byId[c.note].module === mod)).due;
    return `<section><h2>${modLabel(mod)}${dueMod ? ` <small class="cdue">${dueMod} cần ôn</small>` : ""}</h2>
      ${dis.length ? `<h3>Theo bệnh học</h3><div class="decks">${dis.map(n => deck(n, "s5")).join("")}</div>` : ""}
      ${lib.map(([t, l]) => `<h3>${esc(t)}</h3><div class="decks">${l.map(n => deck(n, "s3")).join("")}</div>`).join("")}
      ${dis.length || fo.length ? "" : `<p class="meta">Chưa có thẻ.</p>`}</section>`;
  }).join("");
  $("#main").style.maxWidth = "1080px";
  $("#main").innerHTML = `${crumb([{ t: "Trang chủ", href: "#/" }, { t: "Ôn thẻ" }])}
    ${pageHead({ c: `var(--s10)`, kicker: "Tự kiểm tra", title: `Ôn thẻ theo bệnh học`, desc: `Mỗi bệnh là một bộ thẻ tự kiểm tra. Chọn bệnh để ôn các thẻ của bệnh đó, hoặc ôn gộp mọi thẻ cần ôn. Thẻ được nhắc lại theo quãng 10 phút, 1, 3, 7 và 21 ngày tùy mức bạn nhớ.` })}
    <div class="cstats"><div><b>${st.total}</b><span>thẻ</span></div><div><b>${st.due}</b><span>cần ôn</span></div><div><b>${st.nw}</b><span>chưa học</span></div><div><b>${st.mastered}</b><span>đã thuộc</span></div></div>
    <div class="cact"><a class="btn p" href="#/cards/${cardsMod ? "mod:" + cardsMod : "_due"}">Ôn tất cả thẻ cần ôn${cardsMod ? " của " + esc(MODULES[cardsMod] || cardsMod) : ""} (${cardStat(cardPool(cardsMod ? "mod:" + cardsMod : "_due")).due})</a>
      ${Object.keys(MODULES).length > 1 ? `<span class="seg"><button data-cmod="" class="${cardsMod ? "" : "on"}">Tất cả</button>${Object.keys(MODULES).map(m => `<button data-cmod="${m}" class="${cardsMod === m ? "on" : ""}">${esc(MODULES[m] || m)}</button>`).join("")}</span>` : ""}</div>
    ${sections}`;
  document.querySelectorAll("[data-cmod]").forEach(b => { b.onclick = () => { cardsMod = b.dataset.cmod; cardsHome(); }; });
  window.scrollTo(0, 0);
}
function startSession(key, all) {
  const p = prog(), now = Date.now(), list = cardPool(key).filter(c => all || needReview(c, p, now));
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  CS = { key, all, queue: list, total: list.length, done: 0, counts: [0, 0, 0, 0] };
}
const deckTitle = key => key === "_due" ? "Tất cả thẻ cần ôn" : key.startsWith("mod:") ? (MODULES[key.slice(4)] || key.slice(4)) + ": thẻ cần ôn" : (byId[key] ? (byId[key].short || byId[key].title) : key);
// trạng thái sau khi chấm: 0 Quên · 1 Khó · 2 Nhớ · 3 Dễ
function nextState(c, r) {
  const x = prog()[c.id], box = x ? x.box : 0;
  if (r === 0) return { box: 0, due: Date.now() + 10 * 60e3, label: "10 phút" };
  const nb = r === 1 ? Math.max(1, box) : Math.min(4, box + (r === 2 ? 1 : 2)), d = DAYS[nb] || 1;
  return { box: nb, due: Date.now() + d * DAY, label: d + " ngày" };
}
function renderCard() {
  const el = $("#main"), title = deckTitle(CS.key);
  el.style.maxWidth = "760px";
  const head = `${crumb([{ t: "Trang chủ", href: "#/" }, { t: "Ôn thẻ", href: "#/cards" }, { t: title }])}`;
  if (!CS.total) { el.innerHTML = `${head}<div class="cend"><h2>Không có thẻ cần ôn</h2><p>Bộ "${esc(title)}" không còn thẻ đến hạn.</p><p><a class="btn p" href="#/cards/${CS.key}/all">Ôn lại cả bộ</a> <a class="btn" href="#/cards">Về danh sách bộ thẻ</a></p></div>`; return; }
  if (!CS.queue.length) {
    const left = cardStat(cardPool(CS.key)).due, [q, k, nh, de] = CS.counts;
    el.innerHTML = `${head}<div class="cend"><h2>Xong bộ thẻ</h2><p>Đã ôn <b>${CS.total}</b> thẻ: Quên ${q} lần · Khó ${k} · Nhớ ${nh} · Dễ ${de}.</p>${left ? `<p class="meta">Bộ này còn ${left} thẻ cần ôn.</p>` : ""}<p><a class="btn p" href="#/cards">Về danh sách bộ thẻ</a> <a class="btn" href="#/cards/${CS.key}/all">Ôn lại cả bộ</a></p></div>`;
    return;
  }
  const c = CS.queue[0], n = byId[c.note], pct = Math.round(100 * CS.done / CS.total);
  el.innerHTML = `${head}
    <div class="cs-head"><b>${esc(title)}</b><span>${CS.done}/${CS.total}${CS.queue.length + CS.done > CS.total ? " · gồm thẻ ôn lại" : ""}</span></div><div class="cs-bar"><i style="width:${pct}%"></i></div>
    <div class="cface" id="cface"><small class="cfrom">${esc(MODULES[n.module] || n.module)} · <a href="#/n/${n.id}${n.kind === "disease" ? "/9" : ""}">${esc(n.short || n.title)}</a></small><div class="cq">${inline(c.q)}</div><div class="ca" id="ca" hidden>${inline(c.a)}</div></div>
    <div class="cbtns" id="cb1"><button class="b p" id="cshow">Xem đáp án <kbd>Space</kbd></button></div>
    <div class="cbtns rate" id="cb2" hidden>${["Quên", "Khó", "Nhớ", "Dễ"].map((t, r) => `<button class="b r${r}" data-r="${r}"><b>${t}</b><small>${nextState(c, r).label}</small><kbd>${r + 1}</kbd></button>`).join("")}</div>`;
  $("#cshow").onclick = () => { $("#ca").hidden = false; $("#cb1").hidden = true; $("#cb2").hidden = false; };
  el.querySelectorAll("#cb2 [data-r]").forEach(b => { b.onclick = () => {
    const r = +b.dataset.r, card = CS.queue.shift(), p = prog(), s = nextState(card, r);
    p[card.id] = { box: s.box, due: s.due }; store.set("ykkb_cards", p); badge();
    CS.counts[r]++; if (r === 0) CS.queue.push(card); else CS.done++;
    renderCard();
  }; });
  window.scrollTo(0, 0);
}
function cards(key, all) {
  if (!key) { CS = null; return cardsHome(); }
  startSession(key, all); renderCard();
}
document.addEventListener("keydown", e => {   // phím tắt khi đang ôn: Space/Enter hiện đáp án; 1–4 chấm
  if (!CS || !$("#cface") || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.metaKey || e.ctrlKey) return;
  if (e.key === " " || e.key === "Enter") { const b = $("#cshow"); if (b && !$("#cb1").hidden) { e.preventDefault(); b.click(); } }
  else if (/^[1-4]$/.test(e.key) && !$("#cb2").hidden) $("#cb2").querySelectorAll("[data-r]")[+e.key - 1].click();
});

// ---- sơ đồ liên kết ----
let raf = 0;
// Lưu đồ dạng đồ thị: xếp theo tầng từ trên xuống, cạnh ngược (vòng lặp) đi vòng bên phải
function fcLayout(g) {
  const idx = Object.fromEntries(g.nodes.map((n, i) => [n.id, i])), out = {}, inc = {};
  g.nodes.forEach(n => { out[n.id] = []; inc[n.id] = []; });
  const back = new Set(), state = {};
  const dfs = u => { state[u] = 1; out[u].forEach(e => { if (state[e[1]] === 1) back.add(e); else if (!state[e[1]]) dfs(e[1]); }); state[u] = 2; };
  g.edges.forEach(e => out[e[0]].push(e));
  dfs(g.start);
  const fwd = g.edges.filter(e => !back.has(e));
  fwd.forEach(e => inc[e[1]].push(e[0]));
  const rank = { [g.start]: 0 }, order = [g.start];
  let changed = true;
  while (changed) { changed = false; fwd.forEach(([a, b]) => { if (a in rank && (rank[b] === undefined || rank[b] < rank[a] + 1)) { rank[b] = rank[a] + 1; changed = true; } }); }
  const maxR = Math.max(...Object.values(rank));
  const layers = Array.from({ length: maxR + 1 }, () => []);
  g.nodes.forEach(n => { if (rank[n.id] !== undefined) layers[rank[n.id]].push(n.id); });
  for (let pass = 0; pass < 4; pass++) for (let r = 1; r <= maxR; r++) {
    const pos = Object.fromEntries(layers.flat().map((id, i) => [id, i]));
    layers[r].sort((a, b) => { const bc = id => { const ps = inc[id]; return ps.length ? ps.reduce((s, p) => s + (pos[p] ?? 0), 0) / ps.length : 0; }; return bc(a) - bc(b); });
  }
  const wrap = (t, n) => { const words = t.split(" "), lines = []; let cur = ""; words.forEach(w => { if ((cur + " " + w).trim().length > n && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }); if (cur) lines.push(cur); return lines; };
  const box = {};
  g.nodes.forEach(n => {
    const lines = wrap(n.t, 24), w = Math.max(150, Math.min(230, Math.max(...lines.map(l => l.length)) * 7.4 + 30));
    box[n.id] = { n, lines, w, h: lines.length * 18 + (n.k === "dec" ? 26 : 24) };
  });
  const GAPX = 36, GAPY = 46, rowH = layers.map(L => Math.max(0, ...L.map(id => box[id].h)));
  const layerW = layers.map(L => L.reduce((s, id) => s + box[id].w, 0) + GAPX * (L.length - 1));
  const W = Math.max(...layerW, 300) + 90, rowY = []; let y = 24;
  for (let r = 0; r <= maxR; r++) { rowY[r] = y; y += rowH[r] + GAPY; }
  layers.forEach((L, r) => { let x = (W - layerW[r]) / 2; L.forEach(id => { const b = box[id]; b.x = x; b.y = rowY[r] + (rowH[r] - b.h) / 2; x += b.w + GAPX; }); });
  return { box, W, H: y + 10, back: [...back], fwd, idx };
}
function luudoGraph(g) {
  const { box, W, H, back, fwd } = fcLayout(g), cx = b => b.x + b.w / 2, cy = b => b.y + b.h / 2;
  const edgeSvg = e => {
    const a = box[e[0]], b = box[e[1]];
    const ym = (a.y + a.h + b.y) / 2, yn = e[2] === "Có" ? " fc-yes" : e[2] === "Không" ? " fc-no" : "";
    const lab = e[2] ? `<text class="fc-lab${yn}" x="${(cx(b) + 7).toFixed(1)}" y="${((ym + b.y) / 2 + 4).toFixed(1)}">${esc(e[2])}</text>` : "";
    if (back.includes(e)) {
      const xr = Math.max(a.x + a.w, b.x + b.w) + 26, y1 = cy(a), y2 = cy(b);
      return `<path class="fc-edge fc-back" d="M${a.x + a.w},${y1} H${xr} V${y2} H${b.x + b.w}" marker-end="url(#fc-arr)"/><text class="fc-lab" x="${xr + 6}" y="${(y1 + y2) / 2}">lặp lại</text>`;
    }
    return `<path class="fc-edge" d="M${cx(a)},${a.y + a.h} V${ym} H${cx(b)} V${b.y}" marker-end="url(#fc-arr)"/>${lab}`;
  };
  const nodeSvg = n => {
    const b = box[n.id], x = b.x, y = b.y, w = b.w, h = b.h;
    const cls = n.k === "dec" ? "fc-dec" : n.k === "start" ? "fc-start" : n.k === "proc" ? "fc-proc" : `fc-leaf tone-${n.tone || "ok"}`;
    const shape = n.k === "start" ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}"/>` : n.k === "dec" ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" stroke-dasharray="5 3"/>` : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/>`;
    const text = b.lines.map((l, i) => `<tspan x="${cx(b)}" dy="${i ? 18 : 0}">${esc(l)}</tspan>`).join("");
    const t = `<text class="fc-txt" x="${cx(b)}" y="${y + (h - b.lines.length * 18) / 2 + 13}" text-anchor="middle">${text}</text>`;
    const inner = `<g class="fc-node ${cls}">${shape}${t}</g>`;
    return n.href ? `<a href="${esc(n.href)}">${inner}</a>` : n.bai && n.bai.length && byId[n.bai[0]] ? `<a href="#/n/${n.bai[0]}">${inner}</a>` : inner;
  };
  return `<div class="fcwrap"><svg class="fc" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Lưu đồ"><defs><marker id="fc-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z"/></marker></defs>${g.edges.map(edgeSvg).join("")}${g.nodes.map(nodeSvg).join("")}</svg></div>`;
}
// Lưu đồ tiếp cận: cây câu hỏi Có/Không, lá là kết luận và các bài liên quan (nội dung lấy từ bài đã có)
const LUUDO = [
  { id: "kho-tho", title: "Khó thở (dự kiến)", desc: "Phân biệt khó thở cấp và mạn, nhận biết dấu hiệu nguy hiểm trước, rồi định hướng nguyên nhân. Có nhánh gộp và vòng lặp khi thiếu dữ kiện.", graph: {
    start: "s",
    nodes: [
      { id: "s", k: "start", t: "Khó thở" },
      { id: "b1", k: "dec", t: "Có dấu hiệu nguy hiểm: thở rít, tím tái, không nói trọn câu?" },
      { id: "c1", k: "leaf", tone: "red", t: "Xử trí cấp cứu ngay", bai: ["suy-ho-hap-cap"] },
      { id: "d1", k: "dec", t: "Khởi phát trong vài giờ đến vài ngày?" },
      { id: "e1", k: "dec", t: "Đau ngực, ngất, đau kiểu màng phổi?" },
      { id: "f1", k: "leaf", tone: "red", t: "Nghĩ thuyên tắc phổi hoặc tràn khí màng phổi", bai: ["kls-thang-thuyen-tac-phoi"] },
      { id: "g1", k: "dec", t: "Có ran rít hoặc thì thở ra kéo dài?" },
      { id: "h1", k: "leaf", tone: "warn", t: "Nghĩ hen hoặc đợt cấp COPD", bai: ["kho-tho-man"] },
      { id: "i1", k: "leaf", tone: "warn", t: "Nghĩ viêm phổi hoặc suy tim cấp", bai: ["suy-ho-hap-cap"] },
      { id: "j1", k: "dec", t: "Có tiền sử suy tim hoặc phù chân?" },
      { id: "k1", k: "leaf", tone: "warn", t: "Nghĩ suy tim", bai: ["kho-tho-man"] },
      { id: "l1", k: "dec", t: "Hút thuốc lá hoặc ho đờm kéo dài?" },
      { id: "m1", k: "leaf", tone: "warn", t: "Nghĩ COPD hoặc giãn phế quản", bai: ["kho-tho-man"] },
      { id: "n1", k: "leaf", tone: "warn", t: "Nghĩ bệnh phổi kẽ, thiếu máu, lo âu, nguyên nhân khác" },
      { id: "o1", k: "proc", t: "Cận lâm sàng nền: X-quang ngực, ECG, siêu âm tim, BNP", bai: ["kho-tho-man"] },
      { id: "p1", k: "dec", t: "Đã xác định được nguyên nhân?" },
      { id: "q1", k: "leaf", tone: "ok", t: "Điều trị theo bài bệnh tương ứng" },
      { id: "r1", k: "proc", t: "Khai thác lại bệnh sử, khám lại, theo dõi" },
    ],
    edges: [
      ["s", "b1"], ["b1", "c1", "Có"], ["b1", "d1", "Không"],
      ["d1", "e1", "Có"], ["d1", "j1", "Không"],
      ["e1", "f1", "Có"], ["e1", "g1", "Không"],
      ["g1", "h1", "Có"], ["g1", "i1", "Không"],
      ["j1", "k1", "Có"], ["j1", "l1", "Không"],
      ["l1", "m1", "Có"], ["l1", "n1", "Không"],
      ["k1", "o1"], ["m1", "o1"], ["n1", "o1"],
      ["o1", "p1"], ["p1", "q1", "Có"], ["p1", "r1", "Không"], ["r1", "j1"],
    ] } },
];
// Vẽ cây lưu đồ bằng danh sách lồng nhau; nút câu hỏi là khung chữ, nhánh có nhãn Có/Không, lá là kết luận
function luudoNode(n) {
  if (n.q) return `<div class="lq">${esc(n.q)}</div><ul>${luudoBranch("Có", n.yes)}${luudoBranch("Không", n.no)}</ul>`;
  const links = (n.bai || []).map(id => byId[id] ? `<a class="lbai" href="#/n/${id}">${esc(byId[id].short || byId[id].title)}</a>` : "").join("");
  return `<div class="lleaf tone-${n.tone || "ok"}"><span>${esc(n.r)}</span>${links ? `<div class="lbais">${links}</div>` : ""}</div>`;
}
const luudoBranch = (label, n) => `<li><span class="lbr">${label}</span>${luudoNode(n)}</li>`;
function luudo(id) {
  $("#main").style.maxWidth = "880px";
  const list = LUUDO.map(x => `<a class="rcard lib" style="--c:var(--s11)" href="#/luudo/${x.id}"><small>Lưu đồ</small><b>${esc(x.title)}</b><span>${esc(x.desc)}</span></a>`).join("");
  const one = LUUDO.find(x => x.id === id);
  $("#main").innerHTML = one
    ? `${crumb([{ t: "Trang chủ", href: "#/" }, { t: "Lưu đồ tiếp cận (dự kiến)", href: "#/luudo" }, { t: one.title }])}
       ${pageHead({ c: "var(--s11)", kicker: "Lưu đồ tiếp cận", title: esc(one.title), desc: esc(one.desc) })}
       ${one.graph ? luudoGraph(one.graph) : `<div class="luudo">${luudoNode(one.tree)}</div>`}
       <p class="meta">Lưu đồ chỉ là gợi ý ban đầu. Chi tiết và nguồn nằm trong từng bài.</p>`
    : `${crumb([{ t: "Trang chủ", href: "#/" }, { t: "Lưu đồ tiếp cận (dự kiến)" }])}
       ${pageHead({ c: "var(--s11)", kicker: "Khác", title: "Lưu đồ tiếp cận (dự kiến)", desc: "Cây câu hỏi Có/Không để định hướng chẩn đoán ban đầu, bấm vào kết luận để mở bài." })}
       <div class="rgrid libgrid">${list}</div>`;
  window.scrollTo(0, 0);
}
// ---- công cụ tính toán: gom mọi khối @@calc trong các bài thang điểm (một nguồn duy nhất, đồng bộ với thư viện) ----
// Nhóm hiển thị của công cụ, theo id bài thang điểm; bài chưa khai báo ở đây rơi vào nhóm "Khác"
const CALC_CATS = [
  ["Tri giác, thần kinh, tâm thần", ["kls-thang-tri-giac", "kls-thang-dot-quy", "kls-thang-sa-sut-tri-tue", "kls-thang-tam-than"]],
  ["Cấp cứu, nhiễm trùng, huyết động", ["kls-thang-canh-bao-som", "kls-thang-nhiem-trung", "kls-thang-huyet-dong"]],
  ["Tim mạch và huyết khối", ["kls-thang-dau-nguc", "kls-thang-rung-nhi", "kls-thang-thuyen-tac-phoi"]],
  ["Hô hấp", ["kls-thang-ho-hap"]],
  ["Gan, tiêu hoá", ["kls-thang-chuc-nang-gan", "kls-thang-dau-bung-cap", "kls-thang-tieu-hoa-cap"]],
  ["Thận, điện giải, kiềm toan", ["kls-thang-chuc-nang-than", "kls-thang-kiem-toan", "kls-thang-dien-giai"]],
  ["Dinh dưỡng, chuyển hoá", ["kls-thang-dinh-duong", "kls-thang-nhu-cau-dinh-duong", "kls-thang-chuyen-hoa"]],
  ["Sản khoa và sơ sinh", ["kls-thang-chuyen-da", "kls-thang-so-sinh"]],
  ["Ung bướu và liều thuốc", ["kls-thang-the-trang", "kls-thang-ung-buou"]],
];
const CALC_OLD = { bmi: "BMI", egfr: "eGFR", wells: "Wells PE", chads: "CHA2DS2-VASc", childpugh: "Child-Pugh" };   // đường dẫn cũ #/congcu/<id>
let CALCS = null;
function calcIndex() {
  if (CALCS) return CALCS;
  const catOf = id => { const i = CALC_CATS.findIndex(c => c[1].includes(id)); return i < 0 ? CALC_CATS.length : i; };
  CALCS = [];
  NOTES.filter(n => /(^|\n)@@calc\s/.test(n.body)).forEach(n => {
    const L = n.body.split("\n"); let sub = "", k = 0;
    const heads = []; L.forEach((l, i) => { if (/^###\s/.test(l.trim())) heads.push(i); });
    for (let i = 0; i < L.length; i++) {
      const t = L[i].trim(); let m;
      if ((m = t.match(/^#{3}\s+(.*)$/))) sub = plain(m[1]);
      if (!(m = t.match(/^@@calc\s+(.+)$/))) continue;
      let e = i + 1; while (e < L.length && L[e].trim() !== "@@end") e++;
      const lines = L.slice(i + 1, e), formula = lines.some(x => /^\s*@@(in|sel)\s/.test(x));
      const title = plain(m[1]);
      const hs = [...heads].reverse().find(h => h < i), he = heads.find(h => h > i) ?? L.length, sec = [];
      if (hs !== undefined) { let skip = false; for (const x of L.slice(hs + 1, he)) { const t = x.trim(); if (/^@@calc\s/.test(t)) { skip = true; continue; } if (skip) { if (t === "@@end") skip = false; continue; } if (/^####\s+Công cụ tính/.test(t)) continue; sec.push(x); } }
      CALCS.push({ id: `${n.id}.${k++}`, note: n.id, raw: m[1], title, sub, lines, sec, kind: formula ? "Công thức" : "Chấm điểm",
        src: [...m[1].matchAll(/\{\{\+?([^}]+)\}\}/g)].map(x => x[1]), cat: catOf(n.id), ord: n.order ?? 99, _s: noDia(`${title} ${sub} ${n.short || n.title} ${(n.tags || []).join(" ")}`) });
      i = e;
    }
  });
  CALCS.sort((a, b) => a.cat - b.cat || a.ord - b.ord || (a.id < b.id ? -1 : 1));
  return CALCS;
}
const calcByTitle = t => calcIndex().find(c => c.title === t);
const calcCatName = c => c.cat < CALC_CATS.length ? CALC_CATS[c.cat][0] : "Khác";
function calcCard(c) {
  const n = byId[c.note];
  return `<a class="rcard lib" style="--c:var(--s${(c.cat % 10) + 1})" href="#/congcu/${c.id}"><small>${c.kind}</small><b>${esc(c.title)}</b><span>${esc(n.short || n.title)}</span></a>`;
}
// Giải thích của một công cụ: các mục #### của bài (ý nghĩa, khi nào dùng, cách đánh điểm, cách đọc, hạn chế) + công thức và bảng mã lựa chọn
function calcExplain(c) {
  const parts = []; let cur = { t: "", b: [] };
  c.sec.forEach(x => { const m = x.trim().match(/^####\s+(.*)$/); if (m) { parts.push(cur); cur = { t: plain(m[1]), b: [] }; } else cur.b.push(x); });
  parts.push(cur);
  const fold = p => p.b.join("\n").trim() ? `<details class="fold"${/Ý nghĩa|Cách đánh|Cách tính/.test(p.t) ? " open" : ""}><summary>${esc(p.t || "Giới thiệu")}</summary>${md(p.b.join("\n"))}</details>` : "";
  const head = parts.filter(p => !p.t || /Ý nghĩa|Khi nào/.test(p.t)).map(fold).join(""), rest = parts.filter(p => p.t && !/Ý nghĩa|Khi nào/.test(p.t)).map(fold).join("");
  // công thức và mã lựa chọn của công cụ dạng công thức
  const lab = {}, sels = [], outs = [];
  let cs = null;
  c.lines.forEach(x => { const t = x.trim(); let m;
    if ((m = t.match(/^@@in\s+(.+)$/))) { const a = m[1].split("|").map(z => z.trim()); lab[a[0]] = a[1]; cs = null; }
    else if ((m = t.match(/^@@sel\s+(.+)$/))) { const a = m[1].split("|").map(z => z.trim()); lab[a[0]] = a[1]; cs = { n: a[1], o: [] }; sels.push(cs); }
    else if ((m = t.match(/^@@out\s+(.+)$/))) { const a = m[1].split("|").map(z => z.trim()); lab[a[0]] = a[1]; outs.push({ id: a[0], n: a[1], u: a[2] || "", e: a.slice(4).join("|") }); cs = null; }
    else if (cs && (m = t.match(/^-\s*(-?[\d.]+)\s*\|\s*(.+)$/))) cs.o.push(`${plain(m[2])} = ${m[1]}`);
    else if (/^@@(rules|res|bands)/.test(t)) cs = null; });
  let calcH = "";
  if (outs.length) {
    const short = id => (lab[id] || id).replace(/\s*\(.*$/, "");
    const pretty = e => e.replace(/[A-Za-z_]\w*/g, w => (w in CALC_FN ? w : (w in lab ? `[${short(w)}]` : w))).replace(/\*\*/g, "^").replace(/\*/g, "×").replace(/\//g, "÷");
    calcH = `<details class="fold" open><summary>Công thức và cách mã hóa lựa chọn</summary><ul>${outs.map(o => `<li><b>${esc(o.n)}</b> = <code>${esc(pretty(o.e))}</code>${o.u ? ` <small>(${esc(o.u)})</small>` : ""}</li>`).join("")}</ul>` +
      (sels.length ? `<p class="meta">Mã của các lựa chọn: ${sels.map(z => `<b>${esc(z.n)}</b>: ${esc(z.o.join("; "))}`).join(" · ")}. Tên trong ngoặc vuông là ô đã nhập hoặc kết quả trung gian.</p>` : `<p class="meta">Tên trong ngoặc vuông là ô đã nhập hoặc kết quả trung gian.</p>`) + `</details>`;
  } else {
    const max = c.lines.some(x => /^\s*@@checks/.test(x)) || c.lines.some(x => /^\s*@@item/.test(x));
    if (max) calcH = `<p class="meta">Mỗi lựa chọn hiện kèm số điểm ở đầu dòng; tổng điểm tự cộng và đối chiếu với các mức ở khung kết quả.</p>`;
  }
  return { head, rest: calcH + rest };
}
let ccQuery = "", ccCat = -1;
function ccList() {
  const all = calcIndex(), terms = noDia(ccQuery.trim()).split(/\s+/).filter(Boolean);
  const hit = all.filter(c => (ccCat < 0 || c.cat === ccCat) && terms.every(x => c._s.includes(x)));
  const cats = [...new Set(hit.map(c => c.cat))];
  return hit.length ? cats.map(k => `<h3>${esc(k < CALC_CATS.length ? CALC_CATS[k][0] : "Khác")} <small class="meta">(${hit.filter(c => c.cat === k).length})</small></h3><div class="rgrid libgrid">${hit.filter(c => c.cat === k).map(calcCard).join("")}</div>`).join("")
    : `<p class="meta">Không có công cụ khớp. Thử từ khóa ngắn hơn, ví dụ "gan", "thận", "đột quỵ".</p>`;
}
function congCu(id) {
  $("#main").style.maxWidth = "1000px";
  const all = calcIndex();
  const old = Object.keys(CALC_OLD).includes(id) ? all.find(c => c.title.startsWith(CALC_OLD[id])) : null;
  if (old) { location.replace("#/congcu/" + old.id); return; }
  const t = all.find(x => x.id === id);
  if (!t) {
    const cats = [...new Set(all.map(c => c.cat))].sort((a, b) => a - b), nNotes = new Set(all.map(c => c.note)).size;
    $("#main").innerHTML = `${crumb([{ t: "Trang chủ", href: "#/" }, { t: "Công cụ tính toán" }])}
      ${pageHead({ c: "var(--s11)", kicker: "Khác", title: "Công cụ tính toán", desc: `${all.length} công cụ từ ${nNotes} bài thang điểm lâm sàng. Nhập số hoặc chọn mức, kết quả hiện ngay. Mỗi công cụ có nguồn và liên kết sang bài thang điểm đầy đủ (ý nghĩa, cách chấm, cạm bẫy).` })}
      <div class="cc-bar"><input id="ccQ" class="cc-q" type="search" placeholder="Tìm công cụ: tên thang, cơ quan, bệnh…" value="${esc(ccQuery)}" aria-label="Tìm công cụ">
        <div class="cc-chips"><button data-cat="-1" class="${ccCat < 0 ? "on" : ""}">Tất cả</button>${cats.map(k => `<button data-cat="${k}" class="${ccCat === k ? "on" : ""}">${esc(k < CALC_CATS.length ? CALC_CATS[k][0] : "Khác")}</button>`).join("")}</div></div>
      <div id="ccList">${ccList()}</div>
      <p class="meta">Công cụ hỗ trợ tra cứu, không thay thế đánh giá lâm sàng. Danh sách tự cập nhật theo các bài thang điểm trong thư viện.</p>`;
    $("#ccQ").addEventListener("input", e => { ccQuery = e.target.value; $("#ccList").innerHTML = ccList(); });
    document.querySelectorAll(".cc-chips button").forEach(b => b.onclick = () => { ccCat = +b.dataset.cat; document.querySelectorAll(".cc-chips button").forEach(x => x.classList.toggle("on", x === b)); $("#ccList").innerHTML = ccList(); });
    window.scrollTo(0, 0); return;
  }
  const n = byId[t.note], same = all.filter(c => c.cat === t.cat), i = same.indexOf(t), prev = same[i - 1], next = same[i + 1];
  calcNoLink = true; const body = calcBlock(t.raw, t.lines); calcNoLink = false;
  const ex = calcExplain(t);
  $("#main").innerHTML = `${crumb([{ t: "Trang chủ", href: "#/" }, { t: "Công cụ tính toán", href: "#/congcu" }, { t: calcCatName(t) }, { t: t.title }])}
    ${pageHead({ c: `var(--s${(t.cat % 10) + 1})`, kicker: `${t.kind} · ${esc(calcCatName(t))}`, title: esc(t.title), desc: esc(t.sub && t.sub !== t.title ? t.sub : "") })}
    <div class="cc-tool">${ex.head}${body}</div>
    <div class="cc-why">${ex.rest}</div>
    <p class="meta">Nguồn: ${t.src.length ? t.src.map(s => `<span class="src ext">${esc(s)}</span>`).join(" ") : esc(n.source || "")}</p>
    <p class="meta">Bài thang điểm đầy đủ (ý nghĩa, khi nào dùng, cách chấm, cạm bẫy): <a href="#/n/${n.id}">${esc(n.short || n.title)}</a></p>
    ${same.filter(c => c.note === t.note && c !== t).length ? `<h3>Cùng bài</h3><div class="rgrid libgrid">${same.filter(c => c.note === t.note && c !== t).map(calcCard).join("")}</div>` : ""}
    <div class="cc-nav">${prev ? `<a class="btn" href="#/congcu/${prev.id}">← ${esc(prev.title)}</a>` : "<span></span>"}${next ? `<a class="btn" href="#/congcu/${next.id}">${esc(next.title)} →</a>` : ""}</div>
    <p class="meta">Công cụ hỗ trợ tra cứu, không thay thế đánh giá lâm sàng.</p>`;
  window.scrollTo(0, 0);
}
// ---- bản đồ tư duy của một module: gốc là module, nhánh là mục, lá là bài (tự dựng từ dữ liệu) ----
function mindmap(mod) {
  $("#main").style.maxWidth = "1080px";
  if (!mod || !MODULES[mod]) {
    $("#main").innerHTML = `${crumb([{ t: "Trang chủ", href: "#/" }, { t: "Bản đồ module" }])}
      ${pageHead({ c: "var(--s11)", kicker: "Khác", title: "Bản đồ module", desc: "Cấu trúc của từng chuyên khoa: mỗi nhánh là một mục, mỗi lá là một bài." })}
      <div class="rgrid libgrid">${mainMods().map(m => `<a class="rcard lib" style="--c:var(--s11)" href="#/mindmap/${m}"><small>${NOTES.filter(n => n.module === m).length} bài</small><b>${esc(MODULES[m])}</b></a>`).join("")}</div>`;
    window.scrollTo(0, 0); return;
  }
  const branch = sp => {
    if (sp.type === "overview" || sp.type === "sources") return "";
    const notes = NOTES.filter(n => n.module === mod && n.kind === "foundation" && sectionOfNote(n) === sp.n).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    const dis = sp.type === "diseases" ? diseases().filter(d => d.module === mod) : [];
    const leaves = [...notes, ...dis];
    return `<details class="mm-sec" open style="--c:var(--s${secC(mod, sp.n)})"><summary><b>${sp.n}</b> ${esc(sp.title)} <small>${leaves.length}</small></summary><ul>${leaves.map(n => `<li><a href="#/n/${n.id}">${esc(n.short || n.title)}</a></li>`).join("")}</ul></details>`;
  };
  $("#main").innerHTML = `${crumb([{ t: "Trang chủ", href: "#/" }, { t: "Bản đồ module", href: "#/mindmap" }, { t: MODULES[mod] }])}
    ${pageHead({ c: "var(--s11)", kicker: "Bản đồ module", title: esc(MODULES[mod]), desc: "Bản đồ tự dựng từ các mục và bài của module. Bấm vào một bài để mở." })}
    <div class="mm"><div class="mm-root">${esc(MODULES[mod])}</div><div class="mm-branches">${secsOf(mod).map(branch).join("")}</div></div>`;
  window.scrollTo(0, 0);
}
// Thuật ngữ triệu chứng của module Ung bướu, giải thích bằng ngôn ngữ thường ngày (chế độ "Giải thích thuật ngữ")
const GLOSS_MOD = "ung-buou";
const GLOSS = [
  ["chảy máu", "Máu chảy ra từ cơ thể một cách bất thường, ví dụ từ mũi, răng, âm đạo, đường tiêu hóa hoặc da."],
  ["liệt", "Mất hoặc giảm khả năng cử động một phần cơ thể, do thần kinh hoặc cơ bị tổn thương."],
  ["chèn ép", "Khối u đè lên các cấu trúc xung quanh làm chúng bị hẹp hoặc không hoạt động bình thường."],
  ["khối u", "Một khối bất thường mọc ra từ mô, có thể lành tính hoặc ác tính. Có thể sờ thấy hoặc thấy trên hình ảnh."],
  ["phù", "Sưng do dịch tích tụ trong mô, thường ấn vào thấy lõm và giữ lâu."],
  ["khó thở", "Cảm giác thở không đủ hơi hoặc phải thở gắng sức, dù không làm việc nặng."],
  ["sụt cân", "Cân nặng giảm nhiều mà không cố ý ăn kiêng hay tập luyện."],
  ["thiếu máu", "Số lượng hồng cầu hoặc hemoglobin thấp, thường gây mệt, xanh xao và chóng mặt."],
  ["ho ra máu", "Khạc máu từ đường thở. Khác với nôn ra máu, là máu từ dạ dày."],
  ["tắc ruột", "Thức ăn và hơi không đi qua được ruột, gây đau bụng, nôn và bí trung đại tiện."],
  ["núm vú", "Đầu núm vú. Thay đổi như lõm, tiết dịch hoặc lệch có thể cần khám."],
  ["nuốt nghẹn", "Cảm giác vướng hoặc khó khi nuốt, nhất là với thức ăn đặc."],
  ["vàng da", "Da và lòng trắng mắt ngả vàng, do bilirubin trong máu tăng."],
  ["tiết dịch", "Dịch chảy ra từ núm vú hoặc một vết thương, cơ quan nào đó."],
  ["táo bón", "Đi cầu ít hơn bình thường, phân cứng, khó đi."],
  ["tiêu chảy", "Đi cầu lỏng hoặc nhiều lần hơn bình thường trong thời gian ngắn."],
  ["hạch thượng đòn", "Hạch nổi ở hõm phía trên xương đòn, thường sờ thấy được dưới da."],
  ["đau xương", "Đau âm ỉ ở xương, có thể tăng về đêm, không liên quan đến vận động."],
  ["mót rặn", "Muốn đi đại tiện liên tục dù ruột đã rỗng. Khi rặn chỉ ra ít hoặc không ra."],
  ["tiểu máu", "Nước tiểu có màu hồng hoặc đỏ do lẫn máu."],
  ["khối ở vú", "Một khối sờ thấy trong vú. Không phải khối nào cũng là ung thư, nhưng cần khám."],
  ["nhức đầu", "Đau vùng đầu. Đau đầu tăng dần hoặc kèm buồn nôn cần được khám sớm."],
  ["mệt mỏi", "Cảm giác mệt kéo dài, nghỉ ngơi không hết."],
  ["co giật", "Cơn co cứng hoặc giật không kiểm soát, thường do não bị kích thích."],
  ["bí tiểu", "Không đi tiểu được dù bàng quang đã đầy."],
  ["cổ trướng", "Bụng to ra do dịch tích tụ trong ổ bụng."],
  ["tiểu khó", "Tiểu đau, tia nước yếu, hoặc phải rặn mới tiểu được."],
  ["khàn giọng", "Giọng bị khản, đổi khác, thường do dây thanh âm bị ảnh hưởng."],
  ["tiểu đêm", "Phải thức dậy ban đêm để đi tiểu."],
  ["sốt", "Thân nhiệt tăng trên 38°C. Có thể do nhiễm trùng hoặc do chính khối u."],
  ["đau bụng", "Cảm giác đau vùng bụng, có thể âm ỉ hoặc dữ dội."],
  ["buồn nôn", "Cảm giác muốn nôn, không nhất thiết phải nôn ra."],
  ["nôn", "Đẩy thức ăn hoặc dịch từ dạ dày ra ngoài qua miệng."],
  ["tràn dịch màng phổi", "Dịch tích tụ giữa hai lá màng phổi, gây đau ngực và khó thở."],
  ["báng bụng", "Dịch tích tụ trong ổ bụng làm bụng to lên. Cùng nghĩa với cổ trướng."],
  ["loét", "Tổn thương hở trên da hoặc niêm mạc, khó lành."],
  ["nốt", "Một tổn thương nhỏ nổi lên trên da hoặc niêm mạc."],
  ["hạch", "Cấu trúc nhỏ dọc đường bạch huyết. Hạch to, chắc, không đau có thể do ung thư lan đến."],
  ["nuốt đau", "Đau khi nuốt thức ăn, nước bọt hoặc thuốc."],
  ["đau ngực", "Cảm giác đau, tức hoặc nặng ở vùng ngực."],
  ["ho khan", "Ho không có đờm, kéo dài nhiều tuần cần khám."],
  ["xuất huyết âm đạo", "Chảy máu từ âm đạo, nhất là ngoài kỳ kinh hoặc sau mãn kinh."],
  ["đi ngoài ra máu", "Phân lẫn máu hoặc máu tươi khi đi cầu."],
  ["phân đen", "Phân màu đen như hắc ín, thường do chảy máu ở đường tiêu hóa trên."],
  ["da cam", "Da sần sùi, lỗ chân lông nổi rõ, giống vỏ cam. Thường gặp trong ung thư vú giai đoạn muộn."],
  ["tụt núm", "Núm vú bị kéo vào trong so với bên lành."],
  ["co kéo da", "Da bị kéo lõm lại, thường do khối u dính vào mô bên dưới."],
  ["khàn tiếng", "Giọng bị khàn, đổi khác, kéo dài trên 3 tuần cần khám."],
  ["nghẹn", "Cảm giác thức ăn bị mắc lại ở cổ hoặc ngực khi nuốt."],
  ["khối ở cổ", "Khối nổi lên vùng cổ, có thể sờ thấy được dưới da."],
  ["vết loét không lành", "Vết loét trên da hoặc niêm mạc kéo dài trên 3 tuần mà không liền."],
  ["hạch cổ", "Hạch nổi ở vùng cổ, có thể là dấu hiệu ung thư từ vùng đầu cổ lan đến."],
  ["khối vùng chậu", "Khối u hoặc cục sờ thấy trong vùng chậu (bụng dưới)."],
  ["yếu dần hai chi dưới", "Chân yếu dần, khó đi lại, có thể do khối u chèn ép tủy sống."],
  ["dò", "Đường thông bất thường từ một cơ quan ra ngoài hoặc sang cơ quan khác, có thể chảy dịch hoặc phân."],
  ["cục ở vú", "Cục hoặc khối sờ thấy trong vú."],
  ["khối ở bụng", "Khối u sờ thấy được trong bụng."],
  ["thăm trực tràng", "Khám bằng ngón tay đưa vào trực tràng để tìm khối hoặc bất thường."],
  ["tăng áp lực nội sọ", "Áp lực trong hộp sọ tăng, gây đau đầu, nôn và rối loạn ý thức."],
  ["suy thận sau thận", "Suy thận do tắc nghẽn đường tiết niệu phía sau thận."],
  ["hạch Virchow", "Hạch nổi ở hố thượng đòn trái, dấu hiệu ung thư lan vào ổ bụng."],
  ["xanh xao", "Da và niêm mạc nhợt, thường do thiếu máu."],
  ["suy mòn", "Gầy sút, yếu nhiều, cơ thể suy kiệt."],
  ["đổi thói quen đi tiêu", "Thay đổi về tần suất hoặc tính chất phân so với bình thường."],
  ["máu lẫn trong phân", "Máu lẫn với phân khi đi cầu, có thể đỏ tươi hoặc đen."],
  ["chảy máu bất thường", "Chảy máu hoặc chảy dịch từ cơ quan không theo đường sinh lý bình thường."],
  ["khó tiêu", "Cảm giác đầy, chướng, ăn không tiêu, hoặc khó nuốt."],
  ["nốt ruồi thay đổi", "Nốt ruồi đổi màu, to lên, bờ không đều: dấu hiệu cần khám."],
  ["chèn ép tủy", "Khối u ép vào tủy sống, gây đau lưng, yếu chi và rối loạn tiểu tiện."],
  ["phù chân", "Chân sưng, ấn lõm, thường do tắc tĩnh mạch hoặc phù bạch huyết."],
  ["gan to", "Gan lớn hơn bình thường, có thể sờ thấy dưới bờ sườn."],
  ["thở rít", "Tiếng rít khi thở, do đường thở bị hẹp."],
  ["nôn ra máu", "Nôn ra máu tươi hoặc máu đen như bã cà phê, thường từ dạ dày hoặc thực quản."],
  ["chảy máu mũi", "Chảy máu từ mũi kéo dài hoặc tái diễn cần khám."],
  ["nghẹt mũi", "Nghẹt kéo dài một bên mũi, có thể do khối trong mũi."],
  ["ù tai", "Nghe tiếng ù hoặc vo ve trong tai, không có nguồn âm từ bên ngoài."],
  ["giảm thính lực", "Nghe kém đi so với trước."],
  ["đau họng", "Đau vùng họng, đau khi nuốt hoặc khi nói."],
  ["động kinh mới", "Cơn co giật lần đầu ở người lớn, cần tìm nguyên nhân như khối u não."],
  ["đau lưng", "Đau vùng thắt lưng; đau kéo dài và kèm yếu chân cần khám."],
  ["đau, són phân", "Đau khi đi cầu hoặc không kiểm soát được phân."],
  ["huyết trắng", "Dịch âm đạo ra nhiều, bất thường về màu, mùi hoặc tính chất."],
  ["khối ở bẹn bìu", "Khối sờ thấy ở vùng bẹn hoặc bìu."],
  ["khối không đau", "Khối không gây đau khi sờ, nhưng vẫn cần khám nếu lớn dần."],
  ["hội chứng Horner", "Sụp mi, đồng tử co nhỏ và ít mồ hôi ở một bên mặt, do tổn thương dây thần kinh giao cảm vùng cổ."],
  ["phù áo khoác", "Sưng mặt, cổ và hai tay, do khối u chèn ép tĩnh mạch chủ trên."],
  ["nôn vọt", "Nôn đột ngột, phun ra xa, thường gặp khi tăng áp lực nội sọ."],
  ["phát hiện tình cờ", "Phát hiện khi khám vì lý do khác, không do có triệu chứng."],
  ["không triệu chứng", "Không có biểu hiện bệnh, thường phát hiện qua tầm soát."],
  ["sẹo phỏng cũ", "Ung thư phát sinh trên vết sẹo bỏng cũ, hiếm gặp."],
];
// Chữ viết tắt trong module Ung bướu (khớp đúng hoa thường, không chặn số lần xuất hiện)
const ABBR = [
  ["UT", "Ung thư (cancer)"],
  ["CT", "Chụp cắt lớp vi tính"],
  ["MRI", "Chụp cộng hưởng từ"],
  ["HER2", "Gen mã hóa một thụ thể tyrosine kinase, dấu ấn sinh học"],
  ["PET", "Kỹ thuật chẩn đoán hình ảnh chuyển hóa bằng positron"],
  ["DNA", "Axit deoxyribonucleic (ADN), vật chất di truyền"],
  ["ER", "Thụ thể estrogen, dấu ấn sinh học trong ung thư"],
  ["TNM", "Hệ thống phân loại khối u, hạch và di căn (T: khối u; N: hạch; M: di căn xa)"],
  ["PSA", "Kháng nguyên đặc hiệu tuyến tiền liệt (prostate-specific antigen), dấu ấn sinh học do tuyến tiền liệt tiết ra"],
  ["BRCA", "Gen ung thư vú"],
  ["CEA", "Dấu ấn ung thư (kháng nguyên ung thư phôi) trong máu"],
  ["HPV", "Virus u nhú ở người"],
  ["AFP", "Protein thai nhi, dấu ấn ung thư gan, tế bào mầm"],
  ["EGFR", "Gen mã hóa một thụ thể tyrosine kinase"],
  ["PR", "Thụ thể progesterone trên tế bào ung thư, dấu ấn nội tiết"],
  ["PD-L1", "Dấu ấn sinh học, protein thuộc nhóm ligand của PD-1"],
  ["FNA", "Chọc hút tế bào bằng kim nhỏ"],
  ["AJCC", "Ủy ban chung Hoa Kỳ về ung thư, ban hành phân giai đoạn TNM"],
  ["NSCLC", "Ung thư phổi không tế bào nhỏ"],
  ["MSI", "Bất ổn định vi vệ tinh (dấu ấn sai sót sửa chữa DNA)"],
  ["ECOG", "Thang đánh giá tình trạng toàn thân người bệnh ung thư"],
  ["SCLC", "Ung thư phổi tế bào nhỏ"],
  ["BRAF", "Gen mã hóa một enzym kinase"],
  ["BRCA1", "Gen mã hóa protein sửa chữa DNA (ung thư vú, buồng trứng)"],
  ["BYT", "Cơ quan ban hành hướng dẫn và phác đồ điều trị quốc gia"],
  ["KRAS", "Gen mã hóa một protein GTPase nhỏ (họ RAS)"],
  ["ALK", "Gen mã hóa một thụ thể tyrosine kinase"],
  ["RAS", "Nhóm gen mã hóa protein G nhỏ (gen sinh ung)"],
  ["WHO", "Tổ chức Y tế Thế giới"],
  ["EBV", "Virus thuộc họ herpes"],
  ["GPB", "Giải phẫu bệnh: chẩn đoán bệnh qua mẫu mô và tế bào"],
  ["AUC", "Diện tích dưới đường cong nồng độ–thời gian của thuốc"],
  ["FIGO", "Liên đoàn Sản phụ khoa Quốc tế, hệ thống phân giai đoạn ung thư phụ khoa"],
  ["BI-RADS", "Hệ thống phân loại kết quả chẩn đoán hình ảnh vú"],
  ["FOLFOX", "Phác đồ hóa chất gồm 5-fluorouracil, leucovorin (acid folinic) và oxaliplatin"],
  ["KPS", "Thang đánh giá toàn trạng Karnofsky"],
  ["AI", "Nhóm thuốc nội tiết ức chế enzym aromatase"],
  ["FAP", "Hội chứng đa polyp tuyến gia đình, di truyền"],
  ["BRCA1/2", "Nhóm gen mã hóa protein sửa chữa ADN"],
  ["MMR", "Hệ thống sửa chữa ghép cặp sai trong DNA"],
  ["ACS", "Hiệp hội Ung thư Hoa Kỳ (tổ chức ban hành khuyến cáo)"],
  ["HCC", "Ung thư biểu mô tế bào gan"],
  ["dMMR", "Mất chức năng sửa chữa ghép cặp sai"],
  ["pTNM", "Phân loại TNM dựa trên đánh giá sau mổ, giải phẫu bệnh"],
  ["TACE", "Hóa trị kết hợp nút mạch qua động mạch"],
  ["TSH", "Hormon kích thích tuyến giáp"],
  ["TKI", "Thuốc ức chế enzym tyrosin kinase"],
  ["HBV", "Virus viêm gan B"],
  ["BCLC", "Hệ thống phân giai đoạn và điều trị ung thư gan"],
  ["PARP", "Nhóm enzym sửa chữa ADN"],
  ["FIT", "Xét nghiệm miễn dịch phát hiện máu ẩn trong phân"],
  ["CA-125", "Dấu ấn ung thư, glycoprotein do tế bào biểu mô tạo ra"],
  ["APC", "Gen mã hóa một protein ức chế khối u"],
  ["XHTH", "Chảy máu trong đường tiêu hóa"],
  ["TDMP", "Tích tụ dịch trong khoang màng phổi"],
  ["CIN", "Tân sinh trong biểu mô cổ tử cung"],
  ["FOLFIRI", "Phác đồ hóa chất gồm fluorouracil, leucovorin và irinotecan"],
  ["UTG", "Bệnh ung thư xuất phát từ gan"],
  ["pCR", "Đáp ứng hoàn toàn về giải phẫu bệnh sau điều trị"],
  ["CSGN", "Chăm sóc giảm triệu chứng, nâng cao chất lượng sống"],
  ["UICC", "Liên minh Chống Ung thư Quốc tế"],
  ["HCV", "Virus viêm gan C"],
  ["RET", "Gen mã hóa một thụ thể tyrosine kinase"],
  ["TME", "Cắt trọn mạc treo trực tràng (phẫu thuật ung thư trực tràng)"],
  ["ASC-H", "Tế bào vảy không điển hình, chưa loại trừ tổn thương nội biểu mô vảy độ cao"],
  ["UV", "Tia cực tím"],
  ["SIRT", "Xạ trị nội bức xạ chọn lọc bằng vi cầu phóng xạ"],
  ["EUS", "Siêu âm nội soi"],
  ["NRAS", "Gen mã hóa một protein GTPase nhỏ (họ RAS)"],
  ["LCIS", "Carcinôm tiểu thùy tại chỗ"],
  ["IMRT", "Xạ trị điều biến cường độ"],
  ["cTNM", "Phân giai đoạn TNM lâm sàng, trước phẫu thuật"],
  ["IARC", "Cơ quan Nghiên cứu Ung thư Quốc tế, thuộc WHO"],
  ["CD4", "Dấu ấn bề mặt tế bào lympho T hỗ trợ"],
  ["HIV", "Virus gây suy giảm miễn dịch ở người"],
  ["FDA", "Cục Quản lý Thực phẩm và Dược phẩm Hoa Kỳ"],
  ["LDH", "Enzym lactat dehydrogenase, dấu ấn sinh học"],
  ["SPECT", "Chụp cắt lớp phát xạ photon đơn"],
  ["BRCA2", "Gen ức chế khối u, tham gia sửa chữa DNA"],
  ["UTBT", "Ung thư phát sinh từ buồng trứng"],
  ["SIADH", "Hội chứng tiết hormon chống bài niệu không thích hợp"],
  ["SCC", "Dấu ấn ung thư tế bào vảy (kháng nguyên trong máu)"],
  ["CIMP", "Kiểu hình tăng methyl hóa vùng đảo CpG của khối u"],
  ["NTRK", "Gen mã hóa một thụ thể tyrosine kinase"],
  ["DCIS", "Ung thư biểu mô ống tuyến vú tại chỗ"],
  ["hCG", "Hormon do nhau thai tiết ra"],
  ["VCA", "Kháng nguyên vỏ của virus Epstein–Barr"],
  ["ADT", "Điều trị ức chế androgen, giảm hormon nam"],
  ["FEC", "Phác đồ hóa chất gồm fluorouracil, epirubicin và cyclophosphamid"],
  ["PTEN", "Gen mã hóa một enzym phosphatase"],
  ["UFT", "Thuốc hóa chất uống phối hợp tegafur và uracil"],
  ["AASLD", "Hiệp hội nghiên cứu bệnh gan Hoa Kỳ"],
  ["HNPCC", "Ung thư đại trực tràng di truyền không polyp, còn gọi hội chứng Lynch"],
  ["TTM", "Đường đưa thuốc vào tĩnh mạch"],
  ["ROS1", "Gen mã hóa một thụ thể tyrosine kinase"],
  ["NSAID", "Thuốc chống viêm không steroid"],
  ["ADH", "Tăng sản ống tuyến vú không điển hình"],
  ["FOBT", "Xét nghiệm tìm máu ẩn trong phân"],
  ["SBRT", "Xạ trị định vị lập thể ngoài sọ"],
  ["ENE", "Hạch lan ra ngoài vỏ bao hạch"],
  ["PI3K", "Enzym kinase thuộc họ phosphoinositid 3-kinase"],
  ["NHL", "U lympho không Hodgkin"],
  ["CD8", "Dấu ấn bề mặt đặc trưng của lympho T gây độc"],
  ["MLH1", "Gen mã hóa protein sửa chữa sai sót khi nhân đôi DNA"],
  ["CK", "Protein khung tế bào biểu mô, dấu ấn hóa mô miễn dịch"],
  ["TP53", "Gen mã hóa protein ức chế khối u"],
  ["GIST", "U mô đệm đường tiêu hóa"],
  ["NCCN", "Tổ chức ban hành hướng dẫn điều trị ung thư Hoa Kỳ"],
  ["DCP", "Dấu ấn ung thư gan (prothrombin bất thường, còn gọi PIVKA-II)"],
  ["ATA", "Hiệp hội tuyến giáp Hoa Kỳ"],
  ["VABB", "Sinh thiết vú bằng kim hút chân không"],
  ["FOLFOX4", "Phác đồ hóa chất gồm fluorouracil, leucovorin và oxaliplatin"],
  ["PIK3CA", "Gen mã hóa một enzym kinase (tiểu đơn vị xúc tác PI3K)"],
  ["TIRADS", "Hệ thống phân loại nguy cơ ác tính nhân giáp trên siêu âm"],
  ["UTCTC", "Bệnh ung thư xuất phát từ cổ tử cung"],
  ["NSE", "Dấu ấn enzym enolase đặc hiệu tế bào thần kinh"],
  ["CD20", "Dấu ấn bề mặt tế bào lympho B (kháng nguyên CD20)"],
  ["MEN", "Hội chứng tân sinh nội tiết đa tuyến di truyền"],
  ["RTOG", "Nhóm hợp tác nghiên cứu xạ trị ung thư Hoa Kỳ"],
  ["BEP", "Phác đồ hóa chất gồm bleomycin, etoposid và cisplatin"],
  ["GnRH", "Hormone giải phóng gonadotropin của vùng dưới đồi"],
  ["IHC", "Hóa mô miễn dịch"],
  ["CDH1", "Gen mã hóa một protein kết dính tế bào (E-cadherin)"],
  ["IBS", "Hội chứng ruột kích thích"],
  ["RNA", "Axit ribonucleic (ARN), phân tử sinh học"],
  ["PCR", "Phản ứng chuỗi polymerase, kỹ thuật khuếch đại DNA"],
  ["RFA", "Đốt u bằng sóng cao tần"],
  ["VEGF", "Yếu tố tăng trưởng nội mô mạch máu, một protein"],
  ["LHRH", "Hormone giải phóng hormone luteinizing (tương tự GnRH)"],
  ["HDGC", "Ung thư dạ dày lan tỏa di truyền"],
  ["UNMTC", "Ung thư lớp niêm mạc lót buồng tử cung"],
  ["LVSI", "Xâm lấn khoang mạch bạch huyết và mạch máu"],
  ["XP", "Phác đồ hóa chất gồm capecitabin và cisplatin"],
  ["VMAT", "Xạ trị điều biến thể tích theo cung tròn"],
  ["CPS", "Chỉ số đánh giá biểu hiện PD-L1 (tổng điểm dương tính)"],
  ["UTTL", "Ung thư xuất phát từ tuyến tiền liệt"],
  ["HE4", "Dấu ấn sinh học, protein của biểu mô đường sinh dục"],
  ["NK", "Tế bào diệt tự nhiên thuộc hệ miễn dịch bẩm sinh"],
  ["ACOG", "Hiệp hội Sản phụ khoa Hoa Kỳ, đơn vị ban hành hướng dẫn"],
  ["HPV-DNA", "Xét nghiệm phát hiện DNA của virus papilloma ở người"],
  ["FEV1", "Thể tích khí thở ra gắng sức trong giây đầu"],
  ["INR", "Tỷ số chuẩn hóa quốc tế đo thời gian đông máu"],
  ["FOLFOXIRI", "Phác đồ hóa chất gồm fluorouracil, leucovorin, oxaliplatin và irinotecan"],
  ["gFOBT", "Xét nghiệm máu ẩn trong phân dựa trên phản ứng guaiac"],
  ["UTTQ", "Ung thư thực quản"],
  ["UTTG", "Ung thư xuất phát từ tuyến giáp"],
  ["FISH", "Kỹ thuật lai huỳnh quang tại chỗ để phát hiện bất thường gen"],
  ["MHC", "Phức hợp tương hợp mô chính, trình diện kháng nguyên"],
  ["RECIST", "Tiêu chuẩn đánh giá đáp ứng của khối u đặc"],
  ["ypTNM", "Phân giai đoạn TNM giải phẫu bệnh sau điều trị tân hỗ trợ"],
  ["PTH", "Hormon cận giáp"],
  ["ctDNA", "DNA của khối u lưu hành trong máu"],
  ["CDK4/6", "Enzym kinase điều hòa chu kỳ tế bào (CDK4 và CDK6)"],
  ["CD45", "Dấu ấn bề mặt tế bào, kháng nguyên bạch cầu chung"],
  ["TPF", "Phác đồ hóa chất gồm docetaxel, cisplatin và fluorouracil"],
  ["MSH2", "Gen mã hóa protein sửa chữa ghép cặp sai DNA"],
  ["MSS", "Ổn định vi vệ tinh, không mất ổn định MSI"],
  ["mRECIST", "Tiêu chuẩn đánh giá đáp ứng sửa đổi cho ung thư gan"],
  ["AIS", "Ung thư biểu mô tuyến tại chỗ"],
  ["mRNA", "RNA thông tin, mang mã để tổng hợp protein"],
  ["HDAC", "Enzym tháo nhóm acetyl khỏi histon"],
  ["TEM", "Phẫu thuật cắt u qua hậu môn bằng nội soi"],
  ["AKT", "Gen mã hóa một enzym kinase (protein kinase B)"],
  ["EMR", "Cắt niêm mạc qua nội soi"],
  ["ESD", "Kỹ thuật cắt bóc lớp dưới niêm mạc qua nội soi"],
  ["FAC", "Phác đồ hóa chất gồm fluorouracil, doxorubicin và cyclophosphamid"],
  ["AMH", "Hormon kháng Müller, dấu ấn chức năng buồng trứng"],
  ["ECF", "Phác đồ hóa chất gồm epirubicin, cisplatin và fluorouracil"],
  ["CD47", "Protein bề mặt tế bào miễn dịch (kháng nguyên CD47)"],
  ["EMT", "Quá trình chuyển dạng biểu mô thành trung mô"],
  ["EMA", "Dấu ấn mô học, kháng nguyên màng biểu mô"],
  ["CD117", "Dấu ấn bề mặt tế bào, tương ứng thụ thể KIT"],
  ["SSP", "Polyp răng cưa không cuống của đại tràng"],
  ["EASL", "Hiệp hội Nghiên cứu Gan châu Âu"],
  ["VATS", "Phẫu thuật nội soi lồng ngực có hỗ trợ video"],
  ["IORT", "Xạ trị thực hiện trong lúc phẫu thuật"],
  ["mTOR", "Gen mã hóa một enzym kinase điều hòa tăng trưởng tế bào"],
  ["TURP", "Cắt đốt tuyến tiền liệt qua niệu đạo"],
  ["ACR", "Hiệp hội Phóng xạ học Hoa Kỳ (ban hành phân loại hình ảnh)"],
  ["HMB45", "Kháng thể hóa mô miễn dịch đánh dấu tế bào hắc tố"],
  ["GERD", "Bệnh trào ngược dạ dày–thực quản"],
  ["ProGRP", "Dấu ấn ung thư, peptid tiền thân giải phóng gastrin"],
  ["ycTNM", "Phân giai đoạn TNM lâm sàng sau tân hỗ trợ, trước phẫu thuật"],
  ["PFS", "Thời gian sống không tiến triển bệnh"],
  ["MGMT", "Gen mã hóa enzym sửa chữa DNA"],
  ["NER", "Cơ chế sửa chữa DNA bằng cắt bỏ nucleotid"],
  ["HBsAg", "Kháng nguyên bề mặt của virus viêm gan B"],
  ["ACTH", "Hormon kích thích vỏ thượng thận"],
  ["TNT", "Điều trị tân hỗ trợ toàn diện trước phẫu thuật"],
  ["ICI", "Thuốc ức chế điểm kiểm soát miễn dịch"],
  ["XELOX", "Phác đồ hóa chất gồm capecitabin và oxaliplatin"],
  ["HCG", "Hormon sinh dục màng đệm người, dấu ấn sinh học"],
  ["ALDH2", "Gen mã hóa một enzym chuyển hóa aldehyd"],
  ["SERM", "Thuốc điều biến thụ thể estrogen chọn lọc"],
  ["ROMA", "Thuật toán đánh giá nguy cơ ác tính buồng trứng"],
  ["LEEP", "Cắt tổn thương cổ tử cung bằng vòng dây điện cao tần"],
  ["CAF", "Phác đồ hóa chất gồm cyclophosphamid, doxorubicin và fluorouracil"],
  ["CA125", "Dấu ấn ung thư (kháng nguyên 125) trong máu"],
  ["BHYT", "Chế độ bảo hiểm chi trả chi phí khám, chữa bệnh"],
  ["NHEJ", "Nối tận không đồng nhất, sửa chữa gãy đôi DNA"],
  ["HAT", "Enzym gắn nhóm acetyl vào histon"],
  ["MLO", "Tư thế chụp nhũ ảnh xiên trung–bên"],
  ["SMAD4", "Gen mã hóa một protein truyền tín hiệu SMAD"],
  ["CIMP-high", "Kiểu hình methyl hóa đảo CpG mức cao"],
  ["FOLFOX6", "Phác đồ hóa chất gồm leucovorin, fluorouracil và oxaliplatin"],
  ["SENSA", "Tên thương mại xét nghiệm máu ẩn trong phân (guaiac)"],
  ["PIAF", "Phác đồ hóa chất gồm platin, interferon alfa, doxorubicin và fluorouracil"],
  ["ASCO", "Hiệp hội ung thư lâm sàng Hoa Kỳ"],
  ["ALP", "Enzym phosphatase kiềm, một chỉ số men gan"],
  ["ISH", "Lai tại chỗ"],
  ["MALT", "U lympho mô lympho liên quan niêm mạc"],
  ["ECG", "Điện tâm đồ"],
  ["FOLFOX/CapeOX", "Phác đồ hóa chất FOLFOX hoặc CapeOX, đều có oxaliplatin"],
  ["CTL", "Lympho T độc tế bào (CD8+)"],
  ["FNAC", "Chọc hút kim nhỏ lấy tế bào làm xét nghiệm"],
  ["LVI", "Xâm lấn mạch bạch huyết hoặc mạch máu"],
  ["rTNM", "Phân giai đoạn TNM cho ung thư tái phát"],
  ["UV-A", "Tia cực tím loại A"],
  ["CHOP", "Phác đồ hóa chất gồm cyclophosphamid, doxorubicin, vincristin và prednison"],
  ["ABVD", "Phác đồ hóa chất gồm doxorubicin, bleomycin, vinblastin và dacarbazin"],
  ["BEACOPP", "Phác đồ hóa chất gồm bleomycin, etoposid, doxorubicin, cyclophosphamid, vincristin, pro..."],
  ["AST", "Men gan aspartate aminotransferase"],
  ["ALT", "Men gan (enzym), xét nghiệm đánh giá chức năng gan"],
  ["DFS", "Thời gian sống không bệnh (không tái phát)"],
  ["CMV", "Virus nhóm herpes gây nhiễm trùng cơ hội"],
  ["FLOT", "Phác đồ hóa chất gồm fluorouracil, leucovorin, oxaliplatin và docetaxel"],
  ["ATM", "Gen mã hóa một kinase đáp ứng tổn thương DNA"],
  ["CMF", "Phác đồ hóa chất gồm cyclophosphamid, methotrexat và fluorouracil"],
  ["DCF", "Phác đồ hóa chất gồm docetaxel, cisplatin và 5-fluorouracil"],
  ["HLA", "Hệ kháng nguyên bạch cầu người (tương hợp mô)"],
  ["SKSS", "Tình trạng sức khỏe liên quan sinh sản và hệ sinh dục"],
  ["CLL", "Bệnh bạch cầu lympho mạn"],
  ["CML", "Bạch cầu dòng tủy mạn tính"],
  ["CCL22", "Gen mã hóa một chemokine thu hút tế bào"],
  ["CCR4", "Gen mã hóa một thụ thể chemokine (trên tế bào T điều hòa)"],
  ["ICU", "Đơn vị hồi sức tích cực"],
  ["HBOC", "Hội chứng ung thư vú–buồng trứng di truyền"],
  ["FSH", "Hormon kích thích nang trứng"],
  ["ICE", "Phác đồ hóa chất gồm ifosfamid, carboplatin và etoposid"],
  ["DISC", "Phức hợp tín hiệu gây chết tế bào (đường ngoại sinh)"],
  ["LCA", "Dấu ấn hóa mô miễn dịch của tế bào bạch cầu (CD45)"],
  ["CK8/18", "Dấu ấn mô học, cytokeratin của tế bào biểu mô"],
  ["HNPCC/Lynch", "Ung thư đại trực tràng di truyền không đa polyp (hội chứng Lynch)"],
  ["LKB1", "Gen mã hóa một enzym kinase"],
  ["DRE", "Thăm khám trực tràng bằng ngón tay"],
  ["DOG1", "Dấu ấn hóa mô miễn dịch của u mô đệm đường tiêu hóa"],
  ["mFOLFOX6", "Phác đồ FOLFOX cải biên gồm oxaliplatin, leucovorin và 5-fluorouracil"],
  ["FOLFOX7", "Phác đồ hóa chất gồm fluorouracil, leucovorin và oxaliplatin"],
  ["XELOX/CapeOX", "Phác đồ hóa chất gồm capecitabin và oxaliplatin"],
  ["XELIRI", "Phác đồ hóa chất gồm capecitabin và irinotecan"],
  ["ILF", "Phác đồ hóa chất gồm irinotecan, leucovorin và fluorouracil"],
  ["IRINOX", "Phác đồ hóa chất gồm irinotecan và oxaliplatin"],
  ["FIT/iFOBT", "Xét nghiệm hóa miễn dịch tìm máu ẩn trong phân"],
  ["DCU", "Phác đồ hóa chất gồm docetaxel, cisplatin và tegafur–uracil"],
  ["PPI", "Thuốc ức chế bơm proton, giảm tiết acid dạ dày"],
  ["CAV", "Phác đồ hóa chất gồm cyclophosphamid, doxorubicin và vincristin"],
  ["CAE", "Phác đồ hóa chất gồm cyclophosphamid, doxorubicin và etoposid"],
  ["ALH", "Tăng sản tiểu thùy không điển hình (tổn thương tiền ung thư vú)"],
  ["TAC", "Phác đồ hóa chất gồm docetaxel, doxorubicin và cyclophosphamid"],
  ["TCH", "Phác đồ hóa chất gồm docetaxel, carboplatin và trastuzumab"],
  ["IOTA/O-RADS", "Hệ thống phân loại nguy cơ khối u buồng trứng trên siêu âm"],
  ["LH", "Hormon kích thích hoàng thể, do tuyến yên tiết"],
  ["PVB", "Phác đồ hóa chất gồm cisplatin, vinblastin và bleomycin"],
  ["PTV", "Thể tích đích dùng để lập kế hoạch xạ trị"],
  ["ECX", "Phác đồ hóa chất gồm epirubicin, cisplatin và capecitabin"],
  ["EOX", "Phác đồ hóa chất gồm epirubicin, oxaliplatin và capecitabin"],
  ["CBL", "Buổi học thảo luận theo ca lâm sàng"],
  ["GFR", "Mức lọc cầu thận, chỉ số chức năng thận"],
  ["CYP17", "Gen mã hóa enzym cytochrome, tham gia tổng hợp steroid"],
  ["EGF", "Yếu tố tăng trưởng biểu bì, phối tử của EGFR"],
  ["HIPEC", "Hóa trị tăng thân nhiệt trong ổ bụng"],
  ["Melan-A/MART-1", "Dấu ấn biệt hóa của tế bào hắc tố"],
  ["MAGE", "Họ gen mã hóa kháng nguyên ung thư"],
  ["NKG2D", "Thụ thể hoạt hóa trên bề mặt tế bào NK"],
  ["CD55", "Protein bề mặt tế bào điều hòa hoạt hóa bổ thể"],
  ["CD59", "Dấu ấn bề mặt tế bào, protein điều hòa bổ thể"],
  ["CD25", "Dấu ấn bề mặt tế bào, chuỗi alpha của thụ thể interleukin-2"],
  ["aTNM", "Phân loại TNM chỉ xác định khi khám nghiệm tử thi"],
  ["ERCC1", "Gen mã hóa protein tham gia sửa chữa DNA"],
  ["ERCC4", "Gen mã hóa protein sửa chữa ADN"],
  ["KU70/80", "Phức hợp protein sửa chữa ADN Ku70 và Ku80"],
  ["PADUA", "Thang điểm dự báo nguy cơ huyết khối tĩnh mạch nội trú"],
  ["TRAIL", "Phối tử thuộc họ TNF, tham gia tín hiệu chết tế bào"],
  ["TNFR1", "Thụ thể bề mặt tế bào gắn yếu tố hoại tử u"],
  ["UTPTBN", "Nhóm ung thư phổi có tế bào nhỏ (SCLC)"],
  ["PTHrP", "Peptid liên quan hormon cận giáp, chất cận u"],
  ["AFB/Xpert", "Xét nghiệm đờm tìm lao: soi AFB và Xpert"],
  ["FVC", "Dung tích sống gắng sức, chỉ số chức năng hô hấp"],
  ["PORT", "Xạ trị sau phẫu thuật"],
  ["FISH/CISH", "Kỹ thuật lai tại chỗ phát hiện bất thường gen hoặc nhiễm sắc thể"],
  ["MTX", "Thuốc chống chuyển hóa methotrexat"],
  ["DHEA", "Hormon steroid androgen, dấu ấn nội tiết"],
  ["IGRT", "Xạ trị có dẫn đường bằng hình ảnh"],
  ["EBRT", "Xạ trị bằng chùm tia từ ngoài cơ thể"],
  ["ERBB2", "Gen mã hóa một thụ thể tyrosine kinase (HER2)"],
  ["CD46", "Protein màng điều hòa hệ bổ thể, dấu ấn bề mặt"],
  ["FOXP3", "Gen mã hóa yếu tố phiên mã của lympho T điều hòa"],
  ["IDO", "Enzym chuyển hóa tryptophan"],
  ["rcTNM", "Phân loại TNM tái phát theo lâm sàng"],
  ["rpTNM", "Phân giai đoạn TNM tái phát, theo giải phẫu bệnh"],
  ["HTLV1", "Retrovirus hướng tế bào lympho T ở người"],
  ["HSV8", "Virus herpes ở người, liên quan sarcom Kaposi"],
  ["HBOCS", "Hội chứng ung thư vú–buồng trứng di truyền"],
  ["SSBR", "Cơ chế sửa chữa đứt gãy đơn mạch DNA"],
  ["BER", "Cơ chế sửa chữa DNA bằng cắt bỏ base"],
  ["PARP1", "Gen mã hóa một enzym sửa chữa DNA"],
  ["DSBR", "Cơ chế sửa chữa đứt gãy đôi mạch DNA"],
  ["TRADD", "Gen mã hóa protein tiếp hợp tín hiệu gây chết tế bào"],
  ["FADD", "Gen mã hóa protein tiếp hợp tín hiệu gây chết tế bào"],
  ["HMT", "Enzym gắn nhóm methyl lên histon"],
  ["HDM", "Enzym tháo nhóm methyl khỏi histon"],
  ["T-CD8", "Tế bào lympho T mang dấu ấn CD8"],
  ["CK10/13", "Dấu ấn hóa mô miễn dịch của biểu mô vảy"],
  ["CK7", "Dấu ấn hóa mô miễn dịch thuộc nhóm cytokeratin"],
  ["TCF", "Phác đồ hóa chất gồm docetaxel, cisplatin và fluorouracil"],
  ["CK5/6", "Dấu ấn hóa mô miễn dịch của tế bào biểu mô"],
  ["TTF1", "Dấu ấn hóa mô miễn dịch, yếu tố phiên mã"],
  ["CEV", "Phác đồ hóa chất gồm cyclophosphamid, epirubicin và vincristin"],
  ["VIP", "Phác đồ hóa chất gồm etoposid, ifosfamid và cisplatin"],
  ["CHEK2", "Gen mã hóa một enzym kinase kiểm soát chu kỳ tế bào"],
  ["PPV", "Giá trị tiên đoán dương"],
  ["CEF", "Phác đồ hóa chất gồm cyclophosphamid, epirubicin và fluorouracil"],
  ["PAC", "Phác đồ hóa chất gồm cisplatin, doxorubicin và cyclophosphamid"],
  ["VAC", "Phác đồ hóa chất gồm vincristin, dactinomycin và cyclophosphamid"],
  ["PEI", "Phác đồ hóa chất gồm ifosfamid, etoposid và cisplatin"],
  ["CTV", "Thể tích đích lâm sàng cần đưa liều xạ trị"],
  ["CTC/Pap", "Tầm soát ung thư cổ tử cung bằng tế bào học (Pap)"],
  ["AUB", "Xuất huyết tử cung bất thường"],
  ["GOG", "Nhóm nghiên cứu hợp tác ung thư phụ khoa Hoa Kỳ"],
  ["BTP", "Phác đồ hóa chất gồm bevacizumab, topotecan và paclitaxel"],
  ["VPP", "Giá trị tiên đoán dương hoặc âm của xét nghiệm"],
];
// Cụm chứa thuật ngữ nhưng không phải nghĩa của thuật ngữ đó (ví dụ "tuyến tiền liệt" không phải "liệt")
// Cụm chứa thuật ngữ nhưng không mang nghĩa của thuật ngữ đó: b = chữ đứng trước không được có, a = chữ đứng sau không được có
const GLOSS_NOT = {
  "liệt": { b: ["tiền "], a: [" kê"] },
  "tiết dịch": { b: ["tuyến "] },
  "dò": { b: ["đầu ", "thăm "] },
  "phù": { a: [" hợp"] },
};
let glossOn = false;
// Đánh dấu thuật ngữ trong phần nội dung bài (chỉ module Ung bướu, chỉ khi bật); chạm vào để xem nghĩa
function glossApply() {
  const box = document.querySelector("#main .notepage, #main .modpage");
  if (!box || document.documentElement.dataset.gl !== "on") return;
  const id = curNoteId(), n = id ? byId[id] : null, mod = n ? n.module : (location.hash.match(/^#\/m\/([^/]+)/) || [])[1];
  if (mod !== GLOSS_MOD) return;
  const seen = {};
  [...GLOSS.map(([t, d]) => [t, d, true]), ...ABBR.map(([t, d]) => [t, d, false])].forEach(([term, def, ci]) => {
    const ex = GLOSS_NOT[term] || {}, pre = ex.b ? "(?<!" + ex.b.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")" : "";
    const post = ex.a ? "(?!" + ex.a.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")" : "";
    const re = new RegExp("(^|[^\\p{L}\\p{N}])" + pre + "(" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")" + post + "(?=[^\\p{L}\\p{N}]|$)", ci ? "giu" : "gu");
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, { acceptNode: x => x.parentElement && x.parentElement.closest("a,code,pre,abbr,.gl,.glpop,h1,h2,h3,h4,h5") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const tn of nodes) {
      if (!re.test(tn.nodeValue)) continue;
      re.lastIndex = 0;
      const prevTxt = tn.previousSibling && tn.previousSibling.nodeType === 3 ? tn.previousSibling.nodeValue : "";
      const frag = document.createDocumentFragment(); let last = 0, m;
      while ((m = re.exec(tn.nodeValue))) {
        const start = m.index + m[1].length;
        if (ex.b && start === 0 && ex.b.some(x => prevTxt.endsWith(x))) continue;
        if (ci && seen[term] >= 2) break;
        frag.append(tn.nodeValue.slice(last, start));
        const sp = document.createElement("span"); sp.className = "gl"; sp.dataset.def = def; sp.textContent = m[2];
        frag.append(sp); last = start + m[2].length; if (ci) seen[term] = (seen[term] || 0) + 1;
      }
      frag.append(tn.nodeValue.slice(last));
      tn.replaceWith(frag);
      re.lastIndex = 0;
    }
  });
}
document.addEventListener("click", e => {
  const g = e.target.closest(".gl");
  document.querySelectorAll(".glpop").forEach(p => p.remove());
  if (!g) return;
  const pop = document.createElement("div"); pop.className = "glpop"; pop.setAttribute("role", "note");
  pop.innerHTML = `<b>${esc(g.textContent)}</b>${esc(g.dataset.def)}`;
  g.after(pop);
});
// Biểu đồ lượng kiến thức: số bài của từng chuyên khoa và tổng quan
function volume() {
  $("#main").style.maxWidth = "";
  const mods = Object.keys(MODULES), count = m => NOTES.filter(n => n.module === m).length;
  const max = Math.max(1, ...mods.map(count)), total = NOTES.length, diseases = NOTES.filter(n => n.kind === "disease").length;
  const rows = mods.map(m => `<div class="vrow"><span class="vname">${esc(MODULES[m] || m)}</span><span class="vbar"><i style="width:${(count(m) / max * 100).toFixed(1)}%"></i></span><b class="vnum">${count(m)}</b></div>`).join("");
  $("#main").innerHTML = `${pageHead({ c: "var(--brand)", kicker: "Khác", title: "Lượng kiến thức", desc: "Số bài trong từng chuyên khoa của ứng dụng." })}
    <div class="tiles vtiles"><div class="tile"><b>${total}</b><span>bài</span></div><div class="tile"><b>${diseases}</b><span>bài bệnh học</span></div><div class="tile"><b>${mods.length}</b><span>chuyên khoa</span></div></div>
    <div class="vchart">${rows}</div>`;
  window.scrollTo(0, 0);
}

// ---- thanh module: Ung bướu › 1 … 5 ----
function renderModbar(active) {
  const mod = curMod(), mods = Object.keys(MODULES), secs = secsOf(mod), cur = secs.find(x => x.n === active);
  const pick = `<select class="secpick" aria-label="Chọn mục" style="--c:var(--s${cur ? cur.c || cur.n : 1})">${cur ? "" : '<option value="" selected disabled>Chọn mục…</option>'}${secs.map(x => `<option value="${x.n}"${x.n === active ? " selected" : ""}>${x.n}. ${esc(x.title)}</option>`).join("")}</select>`;
  $("#modbar").innerHTML = (mods.length > 1
      ? `<select class="modpick" aria-label="Chọn chuyên khoa">${mods.map(m => `<option value="${m}"${m === mod ? " selected" : ""}>${esc(MODULES[m] || m)}</option>`).join("")}</select>`
      : `<a class="modname" href="#/m/${mod}/1">${esc(MODULES[mod] || mod)}<i>›</i></a>`) + pick +
    secs.map(x => `<a class="modsec${x.n === active ? " on" : ""}" style="--c:var(--s${x.c || x.n})" href="#/m/${mod}/${x.n}"><b>${x.n}</b>${esc(x.title)}</a>`).join("");
  const on = $("#modbar .modsec.on"); if (on) on.scrollIntoView({ inline: "center", block: "nearest" });   // khổ hẹp: cuộn tới mục đang chọn
}
document.addEventListener("change", e => {
  const sel = e.target.closest("select.modpick"); if (sel) location.hash = `#/m/${sel.value}/1`;
  const sp = e.target.closest("select.secpick"); if (sp && sp.value) location.hash = `#/m/${curMod()}/${sp.value}`;
});

// ---- chế độ tập trung: đọc một bài và hẹn giờ Pomodoro ----
const focus = { on: false, mode: 25, left: 25 * 60, timer: 0, audio: null };
const fmtClock = sec => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
const modeLabel = () => focus.mode === 25 ? "Học 25 phút" : "Nghỉ 5 phút";
function focusNeighbours(n) {
  const k = sectionOfNote(n);
  const list = NOTES.filter(x => x.module === n.module && x.kind === n.kind && sectionOfNote(x) === k).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  const i = list.findIndex(x => x.id === n.id);
  return { prev: list[i - 1], next: list[i + 1] };
}
function focusUpdate(n) {
  const { prev, next } = focusNeighbours(n);
  const pv = $("#fbPrev"), nx = $("#fbNext");
  pv.hidden = !prev; nx.hidden = !next;
  if (prev) { pv.href = `#/n/${prev.id}`; pv.title = prev.short || prev.title; }
  if (next) { nx.href = `#/n/${next.id}`; nx.title = next.short || next.title; }
}
function focusSet(on) {
  focus.on = on;
  document.documentElement.classList.toggle("focus", on);
  if (!on) pomoReset();
  $("#focusFab").hidden = on || !curNoteId();
}
const curNoteId = () => (location.hash.match(/^#\/n\/([^/]+)/) || [])[1] || "";
function pomoRender() { $("#fbTime").textContent = fmtClock(focus.left); }
function pomoReset() { clearInterval(focus.timer); focus.timer = 0; focus.left = focus.mode * 60; pomoRender(); $("#fbStart").textContent = "Bắt đầu"; }
function pomoToggle() {
  if (focus.timer) { clearInterval(focus.timer); focus.timer = 0; $("#fbStart").textContent = "Tiếp tục"; return; }
  focus.timer = setInterval(() => {
    focus.left--;
    if (focus.left <= 0) {
      clearInterval(focus.timer); focus.timer = 0;
      focus.mode = focus.mode === 25 ? 5 : 25; focus.left = focus.mode * 60;
      $("#fbMode").textContent = modeLabel(); $("#fbStart").textContent = "Bắt đầu";
      beep();
    }
    pomoRender();
  }, 1000);
  $("#fbStart").textContent = "Tạm dừng";
}
function pomoMode() { focus.mode = focus.mode === 25 ? 5 : 25; $("#fbMode").textContent = modeLabel(); pomoReset(); }
function beep() {
  try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.frequency.value = 660; g.gain.value = 0.15; o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.6); } catch {}
}
$("#focusFab").onclick = () => { focusSet(true); window.scrollTo(0, 0); };
$("#fbExit").onclick = () => focusSet(false);
$("#fbStart").onclick = pomoToggle; $("#fbReset").onclick = pomoReset; $("#fbMode").onclick = pomoMode;
pomoRender();

// ---- định tuyến ----
function route() {
  cancelAnimationFrame(raf);
  window.scrollTo(0, 0);   // chuyển trang luôn bắt đầu từ đầu trang (mục/bài có điểm đến sẽ tự cuộn sau)
  $("#main").style.maxWidth = ""; closeSheet();
  let h = decodeURIComponent(location.hash.slice(1)) || "/";
  if (h === "/pareto") h = `/m/${curMod()}/${secByType(curMod(), "summary")}`;
  const m = h.match(/^\/n\/([^/]+)(?:\/(\d+))?$/), mm = h.match(/^\/m\/([^/]+)\/(\d+)$/);
  let sec = 0, modActive = 0;
  const kh = h.match(/^\/khung(?:\/(\d+))?$/), lu = h.match(/^\/luudo(?:\/([^/]+))?$/), cc = h.match(/^\/congcu(?:\/([^/]+))?$/), mp = h.match(/^\/mindmap(?:\/([^/]+))?$/), lb = h.match(/^\/lib(?:\/([^/]+))?$/), cd = h.match(/^\/cards(?:\/([^/]+)(?:\/(all))?)?$/);
  if (kh) { $("#main").style.maxWidth = "1000px"; window.renderKhung($("#main"), kh[1]); }
  else if (mm) {
    const k = +mm[2], ov = NOTES.find(n => n.module === mm[1] && n.kind === "overview");
    modActive = k;
    if (k === 1 && ov) note(ov.id); else modSection(mm[1], k);
  }
  else if (m) { sec = note(m[1], m[2]) || 0; modActive = byId[m[1]] ? sectionOfNote(byId[m[1]]) : 0; }
  else if (lb) { lb[1] ? libPage(lb[1]) : libIndex(); }
  else if (h === "/volume") volume(); else if (lu) luudo(lu[1] || ""); else if (cc) congCu(cc[1] || ""); else if (mp) mindmap(mp[1] || ""); else if (cd) cards(cd[1] || "", cd[2] === "all"); else home();
  const navKey = kh ? "khung" : lu ? "luudo" : cc ? "congcu" : mp ? "mindmap" : h === "/volume" ? "volume" : cd ? "cards" : lb ? "lib" : (!m && !mm) ? "home" : "";
  document.querySelectorAll("[data-nav]").forEach(x => x.classList.toggle("on", x.dataset.nav === navKey));
  $("#bnMenu").classList.toggle("on", !!(mm || m)); $("#bnMore").classList.toggle("on", navKey === "khung" || navKey === "volume" || navKey === "luudo" || navKey === "congcu" || navKey === "mindmap");
  const inMod = !!(mm || m);   // thanh mục của chuyên khoa chỉ hiện khi đang trong một chuyên khoa
  $("#modbar").hidden = !inMod; document.documentElement.classList.toggle("no-modbar", !inMod);
  renderModbar(modActive);
  tree(m && m[1], sec || (m && +m[2]) || 0);
  // chân trang: mã bản dựng và tên trang đang mở
  const pb = $("#pfBuild"), pp = $("#pfPage");
  const ver = (window.BUILD || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);   // ngày dựng dd/mm/yyyy → phiên bản vyy.mm.dd
  if (pb) pb.textContent = ver ? `v${ver[3].slice(2)}.${ver[2]}.${ver[1]}` : "";
  if (pp) {   // tiêu đề trang; có tên tiếng Anh thì ghi "Tên Việt - English"
    const h = document.querySelector("#main .cover h1") || document.querySelector("#main h1"), en = h && h.querySelector(".en");
    const vi = h ? [...h.childNodes].filter(x => x !== en).map(x => x.textContent).join("").trim() : "";
    pp.textContent = h ? (en ? `${vi} - ${en.textContent}` : vi) : "Trang chủ";
  }
  stickyTables();
  glossApply();
  document.body.classList.remove("tocpop"); $("#tocFab").hidden = !($("#main details.toc") && narrow());
  if (m) focusUpdate(byId[m[1]]); if (!m && focus.on) focusSet(false); $("#focusFab").hidden = focus.on || !m;
  badge();
}
// vuốt ngang để chuyển tab của một bệnh (điện thoại, máy tính bảng); bỏ qua khi đang cuộn bảng, chọn chữ hay chạm vào ô nhập
(() => {
  let sx = 0, sy = 0, ok = false;
  document.addEventListener("touchstart", e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; ok = e.touches.length === 1 && !e.target.closest(".tw,table,pre,canvas,input,textarea,select,.dtabs,.tall,#sheet,#results,details.toc,.kctl"); }, { passive: true });
  document.addEventListener("touchend", e => {
    if (!ok) return; ok = false;
    const on = document.querySelector(".dtabs .dt.on"); if (!on) return;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) < 90 || Math.abs(dy) > 45 || String(getSelection()).length) return;
    const to = dx < 0 ? on.nextElementSibling : on.previousElementSibling;
    if (to && to.matches("a.dt")) location.hash = to.getAttribute("href");
  }, { passive: true });
})();
// bảng dài (trên 8 dòng): cuộn trong khung cao tối đa 70% màn hình để dòng tiêu đề luôn nhìn thấy
function stickyTables() {
  $("#main").querySelectorAll("table").forEach(t => {
    if (!t.tHead || t.rows.length < 9) return;
    (t.parentElement.classList.contains("tw") ? t.parentElement : t).classList.add("tall");
  });
}
addEventListener("hashchange", route);
route();
})();
