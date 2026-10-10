// Trang "Khung 128 vấn đề": QĐ 22/QĐ-HĐYKQG + sách "Các vấn đề lâm sàng thiết yếu"
(() => {
const K = window.KHUNG;
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const noDia = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
const SEC = [
  ["daicuong", "Đại cương – Sự cần thiết"],
  ["benhly", "Các bệnh lý nguyên nhân"],
  ["cotloi", "Mục tiêu cốt lõi"],
  ["cuthe", "Mục tiêu cụ thể"],
  ["khainiem", "Khái niệm khoa học cơ bản được áp dụng"],
];

function blocks(bs) {
  let out = "", open = false;
  for (const b of bs) {
    if (b.t === "li") { if (!open) { out += "<ul>"; open = true; } out += `<li>${esc(b.x)}</li>`; continue; }
    if (open) { out += "</ul>"; open = false; }
    out += b.t === "h" ? `<h4>${esc(b.x)}</h4>` : `<p>${esc(b.x)}</p>`;
  }
  return out + (open ? "</ul>" : "");
}

function bookPart(b) {
  const pages = b.bookPageEnd > b.bookPage ? `tr. ${b.bookPage}–${b.bookPageEnd}` : `tr. ${b.bookPage}`;
  const secs = SEC.map(([k, name]) => b.sections[k]?.length ? `<section class="ksec"><h3>${esc(k === "benhly" && b.benhlyTitle ? b.benhlyTitle : name)}</h3>${blocks(b.sections[k])}</section>` : "").join("");
  const refs = b.refs?.length ? `<section class="ksec refs"><h3>Tài liệu tham khảo (chú thích của sách)</h3><ol>${b.refs.map(r => `<li>${esc(r)}</li>`).join("")}</ol></section>` : "";
  return `<div class="kbook"><div class="ksrc">Sách mục ${b.no}. ${esc(b.title)} · ${pages} (PDF tr. ${b.pdfPage}–${b.pdfPageEnd})</div>${secs || "<p class='meta'>Chưa trích được nội dung mục này.</p>"}${refs}</div>`;
}

function itemHtml(it) {
  const badge = it.onco ? `<span class="kbadge" title="${esc(it.onco)}">Ung bướu</span>` : "";
  const body = it.book.length ? it.book.map(bookPart).join("") : `<p class="meta">QĐ 22 có vấn đề này nhưng sách chưa có mục cùng tên (sách ra trước QĐ 22 nên cách chia khác). Xem mục "Sách chưa ghép" cuối trang.</p>`;
  const srcs = `<div class="ksrcline">Nguồn khung: QĐ 22/QĐ-HĐYKQG, phụ lục mục 3, STT ${it.no}${it.book.length ? ` · Nội dung: sách "Các vấn đề lâm sàng thiết yếu", ${it.book.map(b => `mục ${b.no}`).join(", ")}` : ""}</div>`;
  const hay = noDia(it.title + " " + it.book.map(b => b.title + " " + SEC.map(([k]) => (b.sections[k] || []).map(x => x.x).join(" ")).join(" ")).join(" "));
  return `<details class="kitem" id="k${it.no}" data-hay="${esc(hay)}" data-g="${it.group}" data-onco="${it.onco ? 1 : 0}"><summary><span class="kno">${it.no}</span> ${esc(it.title)} ${badge}</summary>${srcs}${body}</details>`;
}

function bar(g) {
  const max = 17;
  return `<div class="wrow"><span class="wname">${g.id}. ${esc(g.name)}</span><span class="wbar"><i style="left:${g.min / max * 100}%;width:${(g.max - g.min) / max * 100}%"></i></span><span class="wnum">${g.min}–${g.max}</span><span class="wcnt">${g.to - g.from + 1} vấn đề</span></div>`;
}

window.renderKhung = function (main, focus) {
  if (!K) { main.innerHTML = "<h1>Chưa có dữ liệu</h1><p>Chạy <code>python3 tools/build_khung.py</code>.</p>"; return; }
  const q = K.qd22, bk = K.book, nOnco = K.items.filter(i => i.onco).length, nBook = K.items.filter(i => i.book.length).length;
  main.innerHTML = `
  <h1>Khung kiến thức thi hành nghề — 128 vấn đề cốt lõi</h1>
  <p class="meta">Tổng hợp từ hai nguồn. Mỗi vấn đề có đủ các phần như trong sách và ghi rõ nguồn.</p>
  <div class="srcs">
    <div class="box"><b>Khung thi: ${esc(q.source.short)}</b><br>${esc(q.source.title)}.<br><small>${esc(q.source.about)}</small><br><small>${esc(q.source.note)}</small><br><small>File: ${esc(q.source.file)}</small></div>
    <div class="box"><b>Nội dung: sách ĐH Y Dược TP.HCM</b><br>${esc(bk.title)}<br><small>${esc(bk.editors)}. ${esc(bk.publisher)}.<br>${esc(bk.decision)}.<br>${esc(bk.pageNote)}</small><br><small>File: ${esc(bk.file)}</small></div>
  </div>
  <p><b>Hình thức thi:</b> ${esc(q.format)} <b>Bốn miền năng lực:</b> ${q.domains.map(esc).join("; ")}. <b>Bloom:</b> 100% câu từ mức Áp dụng trở lên (Nhớ, Hiểu = 0).</p>

  <h2>Cấu trúc đề (test blueprint)</h2>
  <p class="meta">Trọng số 17 đề mục (min–max, theo QĐ 22 mục 4.1; có thể điều chỉnh theo từng kỳ).</p>
  <div class="wtable">${q.groups.map(bar).join("")}</div>
  <h3>Lĩnh vực năng lực (mục 4.2)</h3>
  <table><thead><tr><th>#</th><th>Nhóm</th><th>Năng lực</th><th>Min</th><th>Max</th></tr></thead><tbody>
  ${q.competencies.map(c => `<tr><td>${c.no}</td><td>${esc(c.group)}</td><td>${esc(c.name)}</td><td>${c.min ?? ""}</td><td>${c.max ?? ""}</td></tr>`).join("")}</tbody></table>
  <p class="meta">${esc(q.competencyNote)}</p>

  <h2>Danh mục 128 vấn đề</h2>
  <div class="kctl">
    <input id="kq" type="search" placeholder="Tìm trong tiêu đề và nội dung…">
    <select id="kg"><option value="">Tất cả hệ</option>${q.groups.map(g => `<option value="${g.id}">${g.id}. ${esc(g.name)}</option>`).join("")}</select>
    <label><input type="checkbox" id="ko"> Chỉ liên quan ung bướu (${nOnco})</label>
    <button class="b" id="kopen">Mở / đóng tất cả</button>
  </div>
  <p class="meta" id="kcount"></p>
  <div id="klist">${q.groups.map(g => `<section class="kgrp" data-g="${g.id}"><h2>${g.id}. ${esc(g.name)} <small>trọng số ${g.min}–${g.max}</small></h2>${K.items.filter(i => i.group === g.id).map(itemHtml).join("")}</section>`).join("")}</div>
  ${K.unmatchedBook.length ? `<h2>Sách chưa ghép với QĐ 22</h2><p class="meta">Các mục của sách không có vấn đề cùng tên trong QĐ 22 (hoặc đã được gộp/đổi tên). Bạn kiểm tra và chỉnh trong <code>data/mapping-manual.json</code>.</p><ul>${K.unmatchedBook.map(u => `<li>Sách mục ${u.no}: ${esc(u.title)} (tr. ${u.bookPage})</li>`).join("")}</ul>` : ""}
  <p class="meta">Đã có nội dung sách cho ${nBook}/128 vấn đề. Dữ liệu OCR từ bản scan nên có thể còn lỗi chính tả; luôn đối chiếu bản gốc khi cần số liệu chính xác.</p>`;

  const $ = s => main.querySelector(s);
  const apply = () => {
    const t = noDia($("#kq").value.trim()), g = $("#kg").value, o = $("#ko").checked;
    let n = 0;
    main.querySelectorAll(".kitem").forEach(d => {
      const ok = (!t || d.dataset.hay.includes(t)) && (!g || d.dataset.g === g) && (!o || d.dataset.onco === "1");
      d.style.display = ok ? "" : "none"; if (ok) n++;
      if (t && ok) d.open = true;
    });
    main.querySelectorAll(".kgrp").forEach(s => s.style.display = [...s.querySelectorAll(".kitem")].some(d => d.style.display !== "none") ? "" : "none");
    $("#kcount").textContent = `Hiển thị ${n}/128 vấn đề`;
  };
  ["input", "change"].forEach(e => main.querySelector(".kctl").addEventListener(e, apply));
  let all = false;
  $("#kopen").onclick = () => { all = !all; main.querySelectorAll(".kitem").forEach(d => { if (d.style.display !== "none") d.open = all; }); };
  apply();
  if (focus) { const d = main.querySelector("#k" + focus); if (d) { d.open = true; d.scrollIntoView(); } }
};
})();
