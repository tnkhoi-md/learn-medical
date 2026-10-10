(() => {
const NOTES = window.NOTES || [], MODULES = window.MODULES || {}, MODSPEC = window.MODSPEC || {};
const LAYERS = [
  ["nen", "Nền tảng (sinh học PT, giải phẫu, sinh lý)"],
  ["trieuchung", "Triệu chứng – tiếp cận"],
  ["benh", "Bệnh học – lâm sàng"],
  ["cls", "Cận lâm sàng – chẩn đoán"],
  ["dieutri", "Điều trị"],
  ["phacdo", "Phác đồ Bộ Y tế"],
];
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
const secC = (mod, k) => secOf(mod, k).c || k;          // số màu (--s1…--s10) của một mục
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
  .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  .replace(/\[([^\]]+)\]\((#\/[^)]+)\)/g, '<a href="$2">$1</a>');

function cardsOf(n) {
  return n.body.split("\n").map(l => l.match(/^[-*]\s*(.+?)\s::\s(.+)$/)).filter(Boolean).map(m => ({ id: n.id + "|" + m[1], q: m[1], a: m[2], note: n.id }));
}

function md(src) { return blocks(src.split("\n")); }

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
      if (/^@@(tabs|fold)/.test(t)) d++;
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
        if (/^@@(tabs|fold)/.test(tx)) d++; else if (tx === "@@end") d--;
        if (tabs.length) tabs[tabs.length - 1].lines.push(x);
      }
      h.push(`<div class="tabs"><div class="tabbar">${tabs.map((x, k) => `<button class="tabbtn${k ? "" : " on"}" data-t="${k}">${inline(x.name)}</button>`).join("")}</div>` +
        tabs.map((x, k) => `<div class="tabpanel${k ? "" : " on"}" data-t="${k}">${blocks(x.lines)}</div>`).join("") + `</div>`);
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
      h.push(`<h${m[1].length + 1}>${inline(m[2])}</h${m[1].length + 1}>`); i++; continue;
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
      h.push('<div class="tw"><table><thead><tr>' + cells(rows[0]).map(c => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>" +
        rows.slice(2).map(r => "<tr>" + cells(r).map(c => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") + "</tbody></table></div>");
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
  $("#side").classList.remove("open");
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

// Mục lục bài: đánh id cho các tiêu đề ### (h4) để cuộn tới; không đổi địa chỉ trang
function withToc(html) {
  const items = [];
  const out = html.replace(/<h4>(.*?)<\/h4>/g, (_, t) => { const id = "sec-" + items.length; items.push({ id, t }); return `<h4 id="${id}">${t}</h4>`; });
  return { html: out, items };
}
function tocBox(items) {
  if (items.length < 3) return "";
  return `<details class="toc" open><summary>Nội dung mục</summary><ol>${items.map(x => `<li><a href="#${x.id}" data-jump="${x.id}">${x.t.replace(/<\/?a[^>]*>/g, "")}</a></li>`).join("")}</ol></details>`;
}
document.addEventListener("click", e => {
  const a = e.target.closest("a[data-jump]"); if (!a) return;
  e.preventDefault();
  const t = document.getElementById(a.dataset.jump); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
});

// ---- thanh bên: mục lục thu gọn theo khung 1–9 ----
const diseases = () => NOTES.filter(n => n.kind === "disease").sort((a, b) => (a.order || 99) - (b.order || 99));
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
  ["benhhoc", "Bệnh học", "Cơ chế, nguyên nhân và từng bệnh: lâm sàng, chẩn đoán, điều trị, tiên lượng.", "s5", []],
  ["cls", "Cận lâm sàng", "Chọn và đọc xét nghiệm, hình ảnh, giải phẫu bệnh, phân giai đoạn.", "s4", [5, 6]],
  ["capcuu", "Cấp cứu", "Nhận diện nhanh và xử trí ban đầu các tình huống cấp cứu.", "s6", []],
  ["dieutri", "Điều trị", "Nguyên tắc và phương pháp điều trị.", "s10", [7, 10]],
  ["phongngua", "Phòng ngừa", "Phòng ngừa, tầm soát, tiên lượng và theo dõi.", "s2", [8]],
];
function libOf(n) {
  if (n.lib) return n.lib;
  if (n.kind === "disease") return "benhhoc";
  if (n.kind !== "foundation") return "";
  const sp = secOf(n.module, sectionOfNote(n));
  const g = sp.type === "groups" ? (sp.groups || []).find(x => gKey(x) === (n.group || "Khác")) : null;
  return (g && g.lib) || sp.lib || "";
}
function libItems(cat) {
  const tabs = (LIBS.find(l => l[0] === cat) || [])[4] || [];
  return Object.keys(MODULES).map(mod => {
    const notes = NOTES.filter(n => n.module === mod && n.kind === "foundation" && libOf(n) === cat).sort((a, b) => {
      const sa = sectionOfNote(a), sb = sectionOfNote(b);
      return sa - sb || groupList(mod, sa).indexOf(a.group || "Khác") - groupList(mod, sb).indexOf(b.group || "Khác") || (a.order || 99) - (b.order || 99);
    });
    return { mod, notes, di: diseases().filter(d => d.module === mod), tabs };
  }).filter(x => x.notes.length || (x.di.length && (cat === "benhhoc" || x.tabs.length)));
}
const libCount = cat => cat === "trieuchung" ? sympCount() : libItems(cat).reduce((c, x) => c + x.notes.length + ((cat === "benhhoc" || x.tabs.length) ? x.di.length : 0), 0);
// các tab của từng bệnh thuộc một loại (ví dụ Điều trị = tab 7 của mọi bệnh)
const diseaseChips = (di, tabs, mod) => `<div class="rgrid">${di.map(d => { const { secs } = diseaseParts(d); const have = tabs.filter(t => secs[t]); return have.length ? `<div class="rcard"><b>${esc(d.short || d.title)}</b>${have.map(t => `<a class="chip wide" href="#/n/${d.id}/${t}">${dnum(t, mod)} ${esc(SECNAME[t])}</a>`).join("")}</div>` : ""; }).join("")}</div>`;
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
    <header class="cover" style="--c:var(--${col})"><h1>${esc(title)}</h1><p>Bệnh nhân đến khám vì một lý do: đau bụng, đau đầu, nôn ói, vàng da… Chọn lý do đến khám để đọc cách tiếp cận, hỏi bệnh tiếp, rồi xem các bệnh cần nghĩ tới. Các vấn đề theo Khung 128 của kỳ thi.</p></header>
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
function libIndex() {
  $("#main").style.maxWidth = "1080px";
  $("#main").innerHTML = `${crumb([{ t: "Trang chủ", href: "#/" }, { t: "Thư viện học tập" }])}
    <header class="cover" style="--c:var(--brand)"><h1>Thư viện học tập</h1><p>Tra cứu theo loại kiến thức, gom từ mọi chuyên khoa. Muốn học theo trình tự của một chuyên khoa thì vào mục Module.</p></header>
    <div class="rgrid libgrid">${LIBS.map(([k, t, d, col]) => `<a class="rcard lib" style="--c:var(--${col})" href="#/lib/${k}"><small>${libCount(k)} mục</small><b>${esc(t)}</b><span>${esc(d)}</span></a>`).join("")}</div>`;
  window.scrollTo(0, 0);
}
function libPage(cat) {
  const L = LIBS.find(l => l[0] === cat); if (!L) return libIndex();
  if (cat === "trieuchung") return symptomPage(L);
  const [, title, desc, col] = L, items = libItems(cat);
  const body = items.map(({ mod, notes, di, tabs }) => `<section><h2>${esc(MODULES[mod] || mod)}</h2>
    ${notes.length ? `<div class="rgrid">${notes.map(n => `<a class="rcard" href="#/n/${n.id}"><small>${esc(secOf(mod, sectionOfNote(n)).title)}${n.group ? " · " + esc(gSide(mod, n.group)) : ""}</small><b>${esc(n.short || n.title)}</b></a>`).join("")}</div>` : ""}
    ${cat === "benhhoc" ? (di.length ? `<h3>Từng bệnh</h3>${diseaseGrid(di, mod)}` : "") : (tabs.length && di.length ? `<h3>Theo từng bệnh</h3>${diseaseChips(di, tabs, mod)}` : "")}
  </section>`).join("") || `<p class="meta">Chưa có bài nào thuộc loại này.</p>`;
  $("#main").style.maxWidth = "1080px";
  $("#main").innerHTML = `${crumb([{ t: "Trang chủ", href: "#/" }, { t: "Thư viện học tập", href: "#/lib" }, { t: title }])}
    <header class="cover" style="--c:var(--${col})"><h1>${esc(title)}</h1><p>${esc(desc)}</p></header>
    <div class="modpage" style="--c:var(--${col})">${body}</div>`;
  window.scrollTo(0, 0);
}
function tree(cur, sec) {
  const curN = byId[cur], curSec = curN ? sectionOfNote(curN) : +((location.hash.match(/^#\/m\/[^/]+\/(\d+)$/) || [])[1] || 0);   // đang ở trang mục thì mở đúng mục đó
  const here = curMod(), hashM = location.hash.match(/^#\/m\/([^/]+)\/(\d+)$/) || [];
  const modsHtml = Object.keys(MODULES).map(mod => {
    const ns = NOTES.filter(n => n.module === mod), di = diseases().filter(n => n.module === mod);
    const isHere = mod === here;
    const link = (n, s, label, c) => `<a href="#/n/${n.id}${s ? "/" + s : ""}" class="${n.id === cur && (!s || +s === sec) ? "on" : ""}"${c ? ` style="--c:var(--${c})"` : ""}>${esc(label || n.short || n.title)}</a>`;
    const gen = k => ns.filter(n => n.kind === "foundation" && sectionOfNote(n) === k).sort((x, y) => (x.order || 99) - (y.order || 99));
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
      if (s.type === "notes" && s.byDisease) return sub(s, `<a href="#/m/${mod}/${s.n}">${esc(s.overviewLabel || "Khái quát")}</a>` + gen(s.n).map(n => link(n)).join("") + `<div class="lay">Theo bệnh</div>` + di.map(d => link(d, s.byDisease[0], d.short || d.title)).join(""), on || (isDis && isHere && s.byDisease.includes(sec)));
      if (s.type === "notes" && s.tree === "list") return sub(s, `<a href="#/m/${mod}/${s.n}">${esc(s.overviewLabel || "Xem cả mục")}</a>` + gen(s.n).map(n => link(n)).join(""), on);
      return top(s, on);
    });
    return `<details class="mod"${isHere ? " open" : ""}><summary>${esc(MODULES[mod] || mod)}</summary>
      ${rows.join("\n      ")}
    </details>`;
  }).join("");
  const libCur = (location.hash.match(/^#\/lib\/([^/]+)/) || [])[1] || "", isHome = !location.hash || location.hash === "#/" || location.hash === "#";
  $("#tree").innerHTML = `<a class="sbhome${isHome ? " on" : ""}" href="#/"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5"/><path d="M6 10.5V19h12v-8.5"/></svg><span>Trang chủ</span></a>
    <div class="sbh">Module</div>${modsHtml}
    <div class="sbh"><a href="#/lib">Thư viện học tập</a></div>${LIBS.map(([k, t, , col]) => `<a class="sblib${libCur === k ? " on" : ""}" style="--c:var(--${col})" href="#/lib/${k}"><span>${esc(t)}</span><small>${libCount(k)}</small></a>`).join("")}`;
}
// ---- thanh công cụ: tìm kiếm, cài đặt hiển thị, điều hướng dưới (điện thoại) ----
const noDia = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
const plain = s => s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, k, label) => label || k).replace(/\{\{\+?[^}]*\}\}/g, "").replace(/==|\*\*|\{[rgbop]\|/g, "").replace(/[{}>@#|\[\]!`]/g, " ").replace(/\s+/g, " ").trim();
NOTES.forEach(n => { n._t = noDia(n.title + " " + (n.short || "")); n._g = noDia(n.tags.join(" ")); n._b = noDia(n.body); });
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
function runSearch(raw) {
  const terms = noDia(raw.trim()).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return NOTES.map(n => {
    let sc = 0, first = -1;
    for (const t of terms) {
      const it = n._t.includes(t), ig = n._g.includes(t), ib = n._b.indexOf(t);
      if (!it && !ig && ib < 0) return null;
      sc += (it ? 6 : 0) + (ig ? 3 : 0) + (ib >= 0 ? 1 : 0);
      if (ib >= 0 && first < 0) first = ib;
    }
    return { n, sc, pos: first };
  }).filter(Boolean).sort((a, b) => b.sc - a.sc).slice(0, 10);
}
function renderResults() {
  const box = $("#results"), q = $("#q").value;
  if (!q.trim()) { box.hidden = true; box.innerHTML = ""; return; }
  const hits = runSearch(q);
  box.hidden = false;
  box.innerHTML = hits.length ? hits.map(({ n, pos }) => {
    const sec = pos >= 0 ? secAt(n, pos) : 0;
    const href = `#/n/${n.id}${sec ? "/" + sec : ""}`;
    const sc = secOf(n.module, sectionOfNote(n));
    const where = n.kind === "disease" ? (sec ? `${dnum(sec, n.module)} ${SECNAME[sec]}` : (sc.title || "Bệnh học")) : (n.kind === "overview" ? "Tổng quan" : (sc.title || "Nền tảng"));
    const snip = pos >= 0 ? esc(plain(n.body.slice(Math.max(0, pos - 40), pos + 90))) : "";
    return `<a href="${href}"><b>${esc(n.short || n.title)}</b> <span class="where">${esc(where)}</span>${snip ? `<small>…${snip}…</small>` : ""}</a>`;
  }).join("") : '<div class="none">Không có kết quả.</div>';
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
// Mục lục bên trái: điện thoại mở như ngăn kéo; máy tính ẩn/hiện và nhớ lựa chọn trên thiết bị này
const narrow = () => matchMedia("(max-width:820px)").matches;
const setSideOff = off => {
  document.documentElement.classList.toggle("side-off", off);
  $("#sideEdge").setAttribute("aria-expanded", String(!off));
};
const toggleSide = () => {
  if (narrow()) { const open = $("#side").classList.toggle("open"); return $("#sideEdge").setAttribute("aria-expanded", String(open)); }
  const off = !document.documentElement.classList.contains("side-off");
  setSideOff(off);
  try { off ? localStorage.setItem("ykkb_side", "off") : localStorage.removeItem("ykkb_side"); } catch {}
};
$("#sideEdge").onclick = toggleSide; $("#bnMenu").onclick = toggleSide;
$("#bnSearch").onclick = e => { e.stopPropagation(); focusSearch(); };
// cỡ chữ và giao diện (lưu trên từng thiết bị)
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } }, lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
function applyPrefs() {
  const fs = parseFloat(lsGet("ykkb_fs")) || 1, th = lsGet("ykkb_theme") || "auto";
  setSideOff(!narrow() && lsGet("ykkb_side") === "off");
  document.documentElement.style.setProperty("--fs", fs);
  if (th === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = th;
  $("#setPanel").querySelectorAll("[data-fs]").forEach(b => b.classList.toggle("on", Math.abs(parseFloat(b.dataset.fs) - fs) < .01));
  $("#setPanel").querySelectorAll("[data-th]").forEach(b => b.classList.toggle("on", b.dataset.th === th));
}
$("#setPanel").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.fs) lsSet("ykkb_fs", b.dataset.fs);
  if (b.dataset.th) lsSet("ykkb_theme", b.dataset.th === "auto" ? null : b.dataset.th);
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
const crumb = parts => `<nav class="crumb">${parts.map((p, i) => p.href ? `<a href="${p.href}">${esc(p.t)}</a>` : `<span>${esc(p.t)}</span>`).join('<i>›</i>')}</nav>`;

// ---- thẻ ôn tập (Leitner đơn giản) ----
const DAYS = [0, 1, 3, 7, 21], DAY = 864e5;
const allCards = NOTES.flatMap(cardsOf);
const prog = () => store.get("ykkb_cards", {});
const dueCards = () => { const p = prog(), now = Date.now(); return allCards.filter(c => !p[c.id] || p[c.id].due <= now); };
function badge() { const el = $("#dueBadge"); if (el) el.textContent = dueCards().length || ""; }

// ---- trang ----
function hasPareto(d) { return /^## 9\.[^\n]*Pareto/m.test(d.body); }
function diseaseGrid(ds, mod = curMod()) {
  return `<div class="dgrid">${ds.map(d => { const { secs } = diseaseParts(d); return `<article class="dcard"><a class="dtitle" href="#/n/${d.id}/3">${esc(d.short || d.title)}</a>
      <div class="dchips">${SECS.map(([n, t, c]) => secs[n] ? `<a class="chip" style="--c:var(--${c})" href="#/n/${d.id}/${n}" title="${dnum(n, mod)} ${esc(t)}">${dnum(n, mod)}</a>` : `<span class="chip off" title="${dnum(n, mod)} ${esc(t)} (chưa có)">${dnum(n, mod)}</span>`).join("")}</div>
      <div class="dfoot">${hasPareto(d) ? `<a class="pill9" href="#/n/${d.id}/9">★ Tóm tắt</a>` : '<span class="meta">Tóm tắt: chưa có</span>'}${(d.khung || []).map(k => `<a class="chip wide" href="#/khung/${k}">STT ${k}</a>`).join("")}</div></article>`; }).join("")}</div>
    <p class="legend2 meta">${SECS.map(([n, t, c]) => `<span><i class="dot" style="background:var(--${c})"></i>${dnum(n, mod)} ${esc(t)}</span>`).join("")}</p>`;
}

function home() {
  const ds = diseases(), mods = Object.keys(MODULES), cm = curMod();   // cm: chuyên khoa xem gần nhất
  const fo = NOTES.filter(n => n.kind === "foundation").length;
  const nKhung = window.KHUNG ? window.KHUNG.items.length : 128;
  const recent = (store.get(RK, []) || []).map(r => ({ ...r, n: byId[r.id] })).filter(r => r.n).slice(0, 4);
  const due = dueCards().length, sumN = secByType(cm, "summary"), cardN = secByType(cm, "cards");
  const article = mod => {
    const dsm = ds.filter(n => n.module === mod), fom = NOTES.filter(n => n.module === mod && n.kind === "foundation").length, sN = secByType(mod, "summary");
    return `<article class="spec"><div class="spechead"><span class="sdot"></span><div><h3>${esc(MODULES[mod] || mod)}</h3><small>${dsm.length} bệnh · ${fom} bài chung</small></div>
      <div class="specact"><a class="btn p" href="#/m/${mod}/1">Tổng quan module</a>${sN ? `<a class="btn" href="#/m/${mod}/${sN}">Tóm tắt Pareto</a>` : ""}</div></div>
      <ol class="stepper">${secsOf(mod).map(s => `<li style="--c:var(--s${secC(mod, s.n)})"><a href="#/m/${mod}/${s.n}"><b>${s.n}</b>${esc(s.title)}</a></li>`).join("")}</ol>
    </article>`;
  };
  $("#main").style.maxWidth = "1080px";
  $("#main").innerHTML = `
  <section class="hero">
    <div class="herotxt"><h1>Học tập Y khoa</h1><p>Kho kiến thức ôn thi chứng chỉ hành nghề bác sĩ đa khoa: từ nền tảng đến phác đồ, mỗi bệnh một trang có tab.</p></div>
    <button class="herosearch" id="heroSearch"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg> Tìm bài, bệnh, thuốc… <kbd>/</kbd></button>
    <div class="stats"><div><b>${NOTES.length}</b><span>bài</span></div><div><b>${ds.length}</b><span>bệnh</span></div><div><b>${fo}</b><span>bài chung</span></div><div><b>${nKhung}</b><span>vấn đề khung thi</span></div></div>
  </section>
  <section class="intro"><h2>Giới thiệu</h2>
    <p>Học tập Y khoa là kho kiến thức cá nhân để ôn thi chứng chỉ hành nghề bác sĩ đa khoa. Nội dung được soạn lại từ giáo trình giảng dạy và văn bản của Bộ Y tế; các nhận định chính đều gắn nguồn (tên tài liệu và số trang) để kiểm tra lại. Đây là tài liệu học tập, không thay cho hướng dẫn chuyên môn hay quyết định lâm sàng.</p>
    <div class="rgrid">
      <a class="rcard lib" style="--c:var(--s5)" href="#/lib"><small>Tra theo loại</small><b>Thư viện học tập</b><span>Triệu chứng học, bệnh học, cận lâm sàng, cấp cứu, điều trị, phòng ngừa, gom từ mọi chuyên khoa.</span></a>
      <a class="rcard lib" style="--c:var(--s2)" href="#/m/${cm}/1"><small>Học theo trình tự</small><b>Module</b><span>Mỗi chuyên khoa một lộ trình: tổng quan, nền tảng, bệnh học, tóm tắt.</span></a>
      <a class="rcard lib" style="--c:var(--s3)" href="#/khung"><small>Bám đề thi</small><b>Đề cương ôn thi CCHN YKQGQ</b><span>Khung 128 vấn đề lâm sàng của kỳ thi, nối tới các bài liên quan.</span></a>
      <a class="rcard lib" style="--c:var(--s10)" href="#/cards"><small>Tự kiểm tra</small><b>Ôn thẻ</b><span>${due} thẻ đến hạn, lặp lại ngắn quãng.</span></a>
    </div>
  </section>
  <section><h2>Cách đọc một trang</h2>
    <div class="legend3">
      <div class="callout key"><div class="ct">Ý chính</div><p>Điều cần nhớ nhất của bài.</p></div>
      <div class="callout warn"><div class="ct">Lưu ý – bẫy thi</div><p>Chỗ dễ nhầm và nơi các nguồn khác nhau.</p></div>
      <div class="callout red"><div class="ct">Cấp cứu – nguy hiểm</div><p>Dấu hiệu cần xử trí hoặc chuyển tuyến ngay.</p></div>
    </div>
    <p>Ô nguồn như <span class="src">Y5 tr.12</span> cho biết ý lấy từ trang nào của tài liệu nào. Ô <span class="src">Notion</span> là phần bổ sung từ ghi chú chép lại giáo trình cũ, chỉ dùng khi giáo trình mới không có; khi hai nguồn khác nhau, bài theo nguồn mới hơn và ghi rõ chỗ khác. Chữ "tài liệu không nêu" nghĩa là nguồn đã dùng không trả lời điểm đó.</p>
  </section>
  <section><h2>Chuyên khoa</h2>${mods.map(article).join("")}</section>
  ${recent.length ? `<section><h2>Tiếp tục</h2><div class="rgrid">${recent.map(r => `<a class="rcard" href="#/n/${r.id}${r.sec ? "/" + r.sec : ""}"><small>${r.sec ? dnum(r.sec, r.n.module) + " · " + SECNAME[r.sec] : esc(r.n.group || (r.n.kind === "overview" ? "Tổng quan" : "Bài"))}</small><b>${esc(r.n.short || r.n.title)}</b></a>`).join("")}</div></section>` : ""}
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
      <summary>${esc(n.short || n.title)}</summary>
      ${md(n.body)}
    </details>`).join("");
}

// Trang giới thiệu của từng mục trên thanh công cụ (2–5); openId mở sẵn một bài khi đi từ #/n/<id>
function modSection(mod, k, openId) {
  const sp = secOf(mod, k), { title, desc, type } = sp;
  const ns = NOTES.filter(n => n.module === mod), di = diseases().filter(n => n.module === mod);
  const gen = ns.filter(n => n.kind === "foundation" && sectionOfNote(n) === k).sort((x, y) => (x.order || 99) - (y.order || 99));
  const groups = type === "groups" ? groupList(mod, k) : [];
  const flat = type === "groups" ? groups.flatMap(g => gen.filter(n => (n.group || "Khác") === g)) : gen;
  const openSet = sp.openAll ? new Set(gen.map(n => n.id)) : openByDefault(flat, openId);
  const allBtn = gen.length ? `<p><button class="btn" data-act="toggleall" data-scope="details.note-t">Mở / đóng tất cả</button></p>` : "";
  const byDisease = (secNums) => `<div class="rgrid">${di.map(d => `<div class="rcard"><b>${esc(d.short || d.title)}</b>${secNums.map(s => `<a class="chip wide" href="#/n/${d.id}/${s}">${dnum(s, mod)} ${esc(SECNAME[s])}</a>`).join("")}</div>`).join("")}</div>`;
  let body = "";
  if (type === "groups") {
    body = allBtn + groups.map(g => `<section id="${gId(mod, k, g)}"><h2>${esc(gTitle(mod, g))}</h2>${noteToggles(flat.filter(n => (n.group || "Khác") === g), openSet)}</section>`).join("");
  } else if (type === "notes" && sp.byDisease) {
    body = `<section><h2>${esc(sp.genTitle || "Bài khái quát")}</h2>${gen.length ? allBtn + noteToggles(gen, openSet) : "<p class='meta'>Chưa có.</p>"}</section>
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
    body = gen.length ? allBtn + noteToggles(gen, openSet) : "<p class='meta'>Chưa có.</p>";
  } else if (type === "cards") {
    const withCards = ns.map(n => ({ n, c: cardsOf(n) })).filter(x => x.c.length);
    const total = withCards.reduce((s, x) => s + x.c.length, 0);
    body = `<div class="callout note"><div class="ct">Ghi chú</div><p>Các thẻ tự kiểm tra đã tạo được <b>lưu lại</b>. Hiện <b>tạm thời chưa xây dựng thêm</b>.</p></div>
      <p><b>${total}</b> thẻ trong <b>${withCards.length}</b> bài · <a class="btn p" href="#/cards">Bắt đầu ôn thẻ (lặp lại ngắn quãng)</a></p>` +
      withCards.map(({ n, c }) => `<details class="fold"><summary>${esc(n.short || n.title)} <small>${c.length} thẻ</small></summary>${c.map(x => `<details class="card"><summary>${inline(x.q)}</summary><div>${inline(x.a)}</div></details>`).join("")}</details>`).join("");
  }
  $("#main").style.maxWidth = "1080px";
  $("#main").innerHTML = `${crumb([{ t: "Trang chủ", href: "#/" }, { t: MODULES[mod] || mod, href: `#/m/${mod}/1` }])}
    <header class="cover" style="--c:var(--s${secC(mod, k)})"><h1>${k}. ${esc(title)}</h1><p>${esc(desc)}</p></header>
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
  for (; j < L.length; j++) { const t = L[j].trim(); if (/^@@(tabs|fold)/.test(t)) d++; else if (t === "@@end" && --d === 0) break; }
  return L.slice(i + 1, j).join("\n");
}

function diseasePage(n, sec) {
  const { pre, secs } = diseaseParts(n);
  const have = SECS.filter(([num]) => secs[num]).map(([num]) => num);
  const isSummary = +sec === 9 && secs[9];
  sec = isSummary ? 9 : (secs[sec] ? sec : have[0]);
  const khung = (n.khung || []).map(k => `<a class="chip wide" href="#/khung/${k}">Khung STT ${k}</a>`).join("");
  pushRecent(n.id, sec);
  const mod = n.module, dk = secByType(mod, "diseases") || 5, body = isSummary ? summaryOnly(secs[9].body) : secs[sec].body;
  const col = `var(--${SECCOL[sec]})`, cont = withToc(md(relabel(body)));
  $("#main").innerHTML = `${crumb([{ t: "Trang chủ", href: "#/" }, { t: MODULES[mod] || mod, href: `#/m/${mod}/1` }, { t: `${dk} ${secOf(mod, dk).title}`, href: `#/m/${mod}/${dk}` }])}
    <header class="cover" style="--c:var(--s${secC(mod, dk)})">
    <h1>${esc(n.title)}</h1>
    <div class="meta">${n.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")} ${khung}</div></header>
    <div class="dtabs">${SECS.filter(([num]) => secs[num]).map(([num, t, c]) => `<a class="dt${num === sec ? " on" : ""}" style="--c:var(--${c})" href="#/n/${n.id}/${num}"><b>${dnum(num)}</b> ${t}</a>`).join("")}${secs[9] ? `<a class="dt sum${isSummary ? " on" : ""}" href="#/n/${n.id}/9">★ Tóm tắt</a>` : ""}</div>
    ${!isSummary && sec === have[0] && pre.trim() ? `<div class="pre">${md(relabel(pre))}</div>` : ""}
    <div class="notepage" style="--c:${col}">${tocBox(cont.items)}${cont.html}</div>
    ${n.source ? `<p class="meta srcline">Nguồn: ${esc(n.source)}</p>` : ""}`;
  window.scrollTo(0, 0);
  return sec;
}

function note(id, sec) {
  const n = byId[id];
  if (!n) { $("#main").innerHTML = "<h1>Không tìm thấy bài</h1>"; return; }
  if (n.kind === "disease") return diseasePage(n, +sec || 0);
  const k = sectionOfNote(n), mod = n.module, sp = secOf(mod, k);
  pushRecent(id, 0);
  if (n.kind === "foundation" && ["groups", "notes"].includes(sp.type)) return modSection(mod, k, id);
  const cont = withToc(md(n.body));
  $("#main").innerHTML = `${crumb([{ t: "Trang chủ", href: "#/" }, { t: MODULES[mod] || mod, href: `#/m/${mod}/1` }, ...(k > 1 ? [{ t: `${k} ${sp.title}`, href: `#/m/${mod}/${k}` }] : [{ t: "1 Tổng quan" }])])}
    <header class="cover" style="--c:var(--s${secC(mod, k)})">
    <h1>${esc(n.title)}</h1>
    <div class="meta">${n.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}${n.source ? ` Nguồn: ${esc(n.source)}` : ""}</div></header>
    <div class="notepage" style="--c:var(--s${secC(mod, k)})">${tocBox(cont.items)}${cont.html}</div>`;
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
    const dis = ns.filter(n => n.kind === "disease").sort((a, b) => (a.order || 99) - (b.order || 99));
    const fo = ns.filter(n => n.kind !== "disease");
    const lib = LIBS.map(([k, t]) => [t, fo.filter(n => libOf(n) === k)]).concat([["Bài khác", fo.filter(n => !libOf(n))]]).filter(([, l]) => l.length);
    const dueMod = cardStat(allCards.filter(c => byId[c.note].module === mod)).due;
    return `<section><h2>${esc(MODULES[mod] || mod)}${dueMod ? ` <small class="cdue">${dueMod} cần ôn</small>` : ""}</h2>
      ${dis.length ? `<h3>Theo bệnh học</h3><div class="decks">${dis.map(n => deck(n, "s5")).join("")}</div>` : ""}
      ${lib.map(([t, l]) => `<h3>${esc(t)}</h3><div class="decks">${l.map(n => deck(n, "s3")).join("")}</div>`).join("")}
      ${dis.length || fo.length ? "" : `<p class="meta">Chưa có thẻ.</p>`}</section>`;
  }).join("");
  $("#main").style.maxWidth = "1080px";
  $("#main").innerHTML = `${crumb([{ t: "Trang chủ", href: "#/" }, { t: "Ôn thẻ" }])}
    <header class="cover" style="--c:var(--s10)"><h1>Ôn thẻ theo bệnh học</h1><p>Mỗi bệnh là một bộ thẻ tự kiểm tra. Chọn bệnh để ôn các thẻ của bệnh đó, hoặc ôn gộp mọi thẻ cần ôn. Thẻ được nhắc lại theo quãng 10 phút, 1, 3, 7 và 21 ngày tùy mức bạn nhớ.</p></header>
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
const GROUPS = [
  ["", "Tất cả"],
  ["chung", "Chỉ bài chung (nền tảng, tiếp cận)"],
  ["vu", "Chung + Ung thư vú"],
  ["cotucung", "Chung + Ung thư cổ tử cung"],
  ["daitruc", "Chung + Ung thư đại trực tràng"],
  ["phoi", "Chung + Ung thư phổi"],
];
const groupOf = id => (byId[id] && byId[id].disease) || "chung";
let graphFilter = "";
function graph() {
  $("#main").style.maxWidth = "none";
  $("#main").innerHTML = `<h1>Sơ đồ liên kết</h1><div class="legend meta">${LAYERS.map(([k, n]) => `<span><i class="dot" style="background:${css(k)}"></i>${n.split(" (")[0]}</span>`).join("")}</div>
    <p class="meta"><select id="gf">${GROUPS.map(([k, n]) => `<option value="${k}" ${k === graphFilter ? "selected" : ""}>${n}</option>`).join("")}</select> Rê chuột vào một nút để xem tên và các bài liên kết; bấm để mở bài.</p><canvas id="cv"></canvas>`;
  $("#gf").onchange = e => { graphFilter = e.target.value; cancelAnimationFrame(raf); graph(); };
  const cv = $("#cv"), ctx = cv.getContext("2d"), dpr = devicePixelRatio || 1;
  const W = cv.clientWidth, H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.scale(dpr, dpr);
  const col = Object.fromEntries(LAYERS.map(([k]) => [k, css(k)]));
  const ly = Object.fromEntries(LAYERS.map(([k], i) => [k, (i + .5) / LAYERS.length]));
  const keep = n => !graphFilter || (graphFilter === "chung" ? groupOf(n.id) === "chung" : (groupOf(n.id) === "chung" || groupOf(n.id) === graphFilter));
  const list = NOTES.filter(keep);
  const nodes = list.map((n, i) => ({ n, x: W / 2 + Math.cos(i * 2.4) * (W / 3), y: H * ly[n.layer] + Math.sin(i) * 30, vx: 0, vy: 0 }));
  const idx = Object.fromEntries(nodes.map((o, i) => [o.n.id, i]));
  const edges = list.filter(n => n.kind !== "overview").flatMap(n => (out[n.id] || []).filter(t => t in idx).map(t => [idx[n.id], idx[t]]));
  const nb = nodes.map(() => new Set());
  edges.forEach(([i, j]) => { nb[i].add(j); nb[j].add(i); });
  const rep = 90000 / Math.max(1, Math.sqrt(nodes.length) * 4);
  let hov = -1, ticks = 0;
  const step = () => {
    for (const a of nodes) for (const b of nodes) if (a !== b) {
      let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 40; const f = rep / d2;
      a.vx += dx / Math.sqrt(d2) * f; a.vy += dy / Math.sqrt(d2) * f;
    }
    for (const [i, j] of edges) { const a = nodes[i], b = nodes[j], dx = b.x - a.x, dy = b.y - a.y; a.vx += dx * .004; a.vy += dy * .004; b.vx -= dx * .004; b.vy -= dy * .004; }
    for (const o of nodes) { o.vy += (H * ly[o.n.layer] - o.y) * .03; o.vx += (W / 2 - o.x) * .0006; o.x = Math.max(30, Math.min(W - 30, o.x + (o.vx *= .6))); o.y = Math.max(20, Math.min(H - 20, o.y + (o.vy *= .6))); }
  };
  const draw = () => {
    if (ticks++ < 400) step();
    ctx.clearRect(0, 0, W, H);
    const line = css("line"), ink = css("ink"), acc = css("accent");
    for (const [i, j] of edges) { const a = nodes[i], b = nodes[j], on = hov === i || hov === j; ctx.strokeStyle = on ? acc : line; ctx.globalAlpha = hov < 0 || on ? 1 : .35; ctx.lineWidth = on ? 2 : 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.font = "13px system-ui"; ctx.textAlign = "center";
    nodes.forEach((o, i) => { const near = hov >= 0 && (i === hov || nb[hov].has(i)); ctx.globalAlpha = hov < 0 || near ? 1 : .35; ctx.fillStyle = col[o.n.layer]; ctx.beginPath(); ctx.arc(o.x, o.y, i === hov ? 9 : 6, 0, 7); ctx.fill(); });
    ctx.globalAlpha = 1;
    nodes.forEach((o, i) => { if (hov >= 0 && (i === hov || nb[hov].has(i))) { const t = o.n.title.length > 40 ? o.n.title.slice(0, 39) + "…" : o.n.title, w = ctx.measureText(t).width + 8; ctx.fillStyle = css("panel"); ctx.globalAlpha = .92; ctx.fillRect(o.x - w / 2, o.y + 9, w, 18); ctx.globalAlpha = 1; ctx.fillStyle = ink; ctx.fillText(t, o.x, o.y + 22); } });
    raf = requestAnimationFrame(draw);
  };
  const pick = e => { const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; return nodes.findIndex(o => (o.x - x) ** 2 + (o.y - y) ** 2 < 150); };
  cv.onmousemove = e => { hov = pick(e); cv.style.cursor = hov >= 0 ? "pointer" : "default"; };
  cv.onclick = e => { const i = pick(e); if (i >= 0) location.hash = "#/n/" + nodes[i].n.id; };
  draw();
}

// ---- thanh module: Ung bướu › 1 … 5 ----
function renderModbar(active) {
  const mod = curMod(), mods = Object.keys(MODULES);
  $("#modbar").innerHTML = (mods.length > 1
      ? `<select class="modpick" aria-label="Chọn chuyên khoa">${mods.map(m => `<option value="${m}"${m === mod ? " selected" : ""}>${esc(MODULES[m] || m)}</option>`).join("")}</select>`
      : `<a class="modname" href="#/m/${mod}/1">${esc(MODULES[mod] || mod)}<i>›</i></a>`) +
    secsOf(mod).map(s => `<a class="modsec${s.n === active ? " on" : ""}" style="--c:var(--s${s.c || s.n})" href="#/m/${mod}/${s.n}"><b>${s.n}</b>${esc(s.title)}</a>`).join("");
  const on = $("#modbar .modsec.on"); if (on) on.scrollIntoView({ inline: "center", block: "nearest" });   // khổ hẹp: cuộn tới mục đang chọn
}
document.addEventListener("change", e => { const sel = e.target.closest("select.modpick"); if (sel) location.hash = `#/m/${sel.value}/1`; });

// ---- định tuyến ----
function route() {
  cancelAnimationFrame(raf);
  window.scrollTo(0, 0);   // chuyển trang luôn bắt đầu từ đầu trang (mục/bài có điểm đến sẽ tự cuộn sau)
  $("#main").style.maxWidth = ""; $("#side").classList.remove("open");
  let h = decodeURIComponent(location.hash.slice(1)) || "/";
  if (h === "/pareto") h = `/m/${curMod()}/${secByType(curMod(), "summary")}`;
  const m = h.match(/^\/n\/([^/]+)(?:\/(\d+))?$/), mm = h.match(/^\/m\/([^/]+)\/(\d+)$/);
  let sec = 0, modActive = 0;
  const kh = h.match(/^\/khung(?:\/(\d+))?$/), lb = h.match(/^\/lib(?:\/([^/]+))?$/), cd = h.match(/^\/cards(?:\/([^/]+)(?:\/(all))?)?$/);
  if (kh) { $("#main").style.maxWidth = "1000px"; window.renderKhung($("#main"), kh[1]); }
  else if (mm) {
    const k = +mm[2], ov = NOTES.find(n => n.module === mm[1] && n.kind === "overview");
    modActive = k;
    if (k === 1 && ov) note(ov.id); else modSection(mm[1], k);
  }
  else if (m) { sec = note(m[1], m[2]) || 0; modActive = byId[m[1]] ? sectionOfNote(byId[m[1]]) : 0; }
  else if (lb) { lb[1] ? libPage(lb[1]) : libIndex(); }
  else if (h === "/graph") graph(); else if (cd) cards(cd[1] || "", cd[2] === "all"); else home();
  const navKey = kh ? "khung" : h === "/graph" ? "graph" : cd ? "cards" : lb ? "lib" : (!m && !mm) ? "home" : "";
  document.querySelectorAll("[data-nav]").forEach(x => x.classList.toggle("on", x.dataset.nav === navKey));
  const inMod = !!(mm || m);   // thanh mục của chuyên khoa chỉ hiện khi đang trong một chuyên khoa
  $("#modbar").hidden = !inMod; document.documentElement.classList.toggle("no-modbar", !inMod);
  renderModbar(modActive);
  tree(m && m[1], sec || (m && +m[2]) || 0);
  const bd = $("#build"); if (bd) bd.textContent = window.BUILD ? "Bản dựng: " + window.BUILD : "";
  badge();
}
addEventListener("hashchange", route);
route();
})();
