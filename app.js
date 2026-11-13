// The demo page. All spreadsheet logic is the Gleam engine compiled to
// JavaScript; this file only draws the grid and forwards edits.
import * as web from "./lib/sutra/sutra/web.mjs";
import { toList } from "./lib/sutra/gleam.mjs";
import { samples } from "./samples.js";

const COLS = 12;
const MIN_ROWS = 30;

const $ = (id) => document.getElementById(id);
const grid = $("grid");
const input = $("input");

let book = null;
let sample = null;
let sheets = [];
let sheet = "";
let rows = MIN_ROWS;
let sel = { col: 0, row: 0 };
let cells = new Map(); // "col,row" -> [shown, kind, input, spill]
let tds = new Map();

const colName = (c) => {
  let s = "";
  c += 1;
  while (c > 0) {
    const m = (c - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    c = Math.floor((c - 1) / 26);
  }
  return s;
};
const a1 = (c, r) => colName(c) + (r + 1);
const key = (c, r) => c + "," + r;

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

function loadSample(id) {
  sample = samples.find((s) => s.id === id) || samples[0];
  sheets = sample.sheets.map((s) => s.name);
  const all = [];
  for (const s of sample.sheets) for (const [c, r, text] of s.cells) all.push([s.name, c, r, text]);
  const t0 = performance.now();
  const [b, report] = web.load(toList(sheets), toList(all));
  const ms = performance.now() - t0;
  book = b;
  $("note").textContent = sample.note;
  const [selSheet, selCol, selRow] = sample.select;
  sheet = selSheet;
  sel = { col: selCol, row: selRow };
  drawTabs();
  drawGrid();
  select(sel.col, sel.row);
  const r = JSON.parse(report);
  $("statline").innerHTML =
    `Loaded ${sheets.length} sheet${sheets.length > 1 ? "s" : ""} and computed <strong>${r.formulas}</strong> formulas in ${ms.toFixed(1)} ms.` +
    `<br><span class="badge">full build</span>`;
  history.replaceState(null, "", "#" + sample.id);
}

function drawTabs() {
  const tabs = $("tabs");
  tabs.innerHTML = "";
  for (const name of sheets) {
    const b = document.createElement("button");
    b.textContent = name;
    b.className = name === sheet ? "active" : "";
    b.onclick = () => {
      sheet = name;
      sel = { col: 0, row: 0 };
      drawTabs();
      drawGrid();
      select(0, 0);
      grid.focus({ preventScroll: true });
    };
    tabs.appendChild(b);
  }
}

function refreshCells() {
  cells = new Map();
  for (const [c, r, shown, kind, inp, spill] of JSON.parse(web.view(book, sheet, 1000, COLS))) {
    cells.set(key(c, r), [shown, kind, inp, spill]);
  }
  let maxRow = 0;
  for (const k of cells.keys()) maxRow = Math.max(maxRow, +k.split(",")[1]);
  return Math.max(MIN_ROWS, maxRow + 6);
}

function drawGrid() {
  rows = refreshCells();
  $("gridwrap").scrollLeft = 0;
  $("gridwrap").scrollTop = 0;
  grid.innerHTML = "";
  tds = new Map();
  const head = grid.createTHead().insertRow();
  const corner = document.createElement("th");
  corner.className = "corner";
  head.appendChild(corner);
  for (let c = 0; c < COLS; c++) {
    const th = document.createElement("th");
    th.textContent = colName(c);
    head.appendChild(th);
  }
  const body = grid.createTBody();
  for (let r = 0; r < rows; r++) {
    const tr = body.insertRow();
    const rh = tr.insertCell();
    rh.className = "rowhead";
    rh.textContent = r + 1;
    for (let c = 0; c < COLS; c++) {
      const td = tr.insertCell();
      td.dataset.c = c;
      td.dataset.r = r;
      tds.set(key(c, r), td);
      paint(c, r);
    }
  }
}

function paint(c, r) {
  const td = tds.get(key(c, r));
  if (!td) return;
  const cell = cells.get(key(c, r));
  const keep = ["selected", "reads", "readby", "flash", "spill-edge-t", "spill-edge-b", "spill-edge-l", "spill-edge-r"].filter((x) => td.classList.contains(x));
  td.className = "";
  for (const x of keep) td.classList.add(x);
  if (!cell) {
    td.textContent = "";
    td.title = "";
    return;
  }
  const [shown, kind, inp, spill] = cell;
  td.textContent = shown;
  td.classList.add(kind);
  // like a spreadsheet, long text runs on over empty cells to its right
  if (kind === "text" && !cells.has(key(c + 1, r))) td.classList.add("overflow");
  if (inp.startsWith("=")) td.classList.add("formula");
  if (spill && spill !== "anchor") td.classList.add("spilled");
  td.title = inp.startsWith("=") ? inp : spill && spill !== "anchor" ? "spilled from " + spill : "";
}

// ---------------------------------------------------------------------------
// Selection and inspection
// ---------------------------------------------------------------------------

function clearMarks() {
  for (const td of tds.values()) {
    td.classList.remove(
      "selected", "reads", "readby",
      "spill-edge-t", "spill-edge-b", "spill-edge-l", "spill-edge-r",
    );
  }
}

function markRange(cls, [c1, r1, c2, r2]) {
  for (let r = r1; r <= Math.min(r2, rows - 1); r++)
    for (let c = c1; c <= Math.min(c2, COLS - 1); c++) tds.get(key(c, r))?.classList.add(cls);
}

function markSpill([c1, r1, c2, r2]) {
  for (let r = r1; r <= r2; r++)
    for (let c = c1; c <= c2; c++) {
      const td = tds.get(key(c, r));
      if (!td) continue;
      if (r === r1) td.classList.add("spill-edge-t");
      if (r === r2) td.classList.add("spill-edge-b");
      if (c === c1) td.classList.add("spill-edge-l");
      if (c === c2) td.classList.add("spill-edge-r");
    }
}

function chip(label, onClick) {
  const b = document.createElement("span");
  b.className = "chip";
  b.textContent = label;
  b.onclick = onClick;
  return b;
}

function goTo(sheetName, c, r) {
  if (sheetName.toLowerCase() !== sheet.toLowerCase()) {
    sheet = sheets.find((s) => s.toLowerCase() === sheetName.toLowerCase()) || sheet;
    drawTabs();
    drawGrid();
  }
  select(c, r);
  grid.focus({ preventScroll: true });
}

/// Scroll a cell into view without hiding it under the sticky headers.
function reveal(td) {
  const wrap = $("gridwrap");
  const headH = grid.tHead.offsetHeight;
  const rowW = grid.tBodies[0].rows[0].cells[0].offsetWidth;
  const left = td.offsetLeft;
  const top = td.offsetTop;
  if (left - rowW < wrap.scrollLeft) wrap.scrollLeft = left - rowW;
  else if (left + td.offsetWidth > wrap.scrollLeft + wrap.clientWidth)
    wrap.scrollLeft = left + td.offsetWidth - wrap.clientWidth;
  if (top - headH < wrap.scrollTop) wrap.scrollTop = top - headH;
  else if (top + td.offsetHeight > wrap.scrollTop + wrap.clientHeight)
    wrap.scrollTop = top + td.offsetHeight - wrap.clientHeight;
}

function select(c, r) {
  sel = { col: Math.max(0, Math.min(COLS - 1, c)), row: Math.max(0, Math.min(rows - 1, r)) };
  clearMarks();
  const td = tds.get(key(sel.col, sel.row));
  td?.classList.add("selected");
  if (td) reveal(td);
  const cell = cells.get(key(sel.col, sel.row));
  $("address").textContent = a1(sel.col, sel.row);
  input.value = cell ? cell[2] : "";
  showParse();

  const info = JSON.parse(web.inspect(book, sheet, sel.col, sel.row));
  $("value").textContent = info.kind === "empty" ? "(empty)" : info.value;

  const reads = $("reads");
  reads.innerHTML = "";
  for (const p of info.precedents) {
    const [c1, r1, c2, r2] = p.range;
    const name = (c1 === c2 && r1 === r2 ? a1(c1, r1) : a1(c1, r1) + ":" + a1(c2, r2));
    const label = p.sheet.toLowerCase() === sheet.toLowerCase() ? name : p.sheet + "!" + name;
    reads.appendChild(chip(label, () => goTo(p.sheet, c1, r1)));
    if (p.sheet.toLowerCase() === sheet.toLowerCase()) markRange("reads", p.range);
  }
  if (!info.precedents.length) reads.textContent = "—";

  const readby = $("readby");
  readby.innerHTML = "";
  for (const [s, c, r] of info.dependents) {
    const label = s.toLowerCase() === sheet.toLowerCase() ? a1(c, r) : s + "!" + a1(c, r);
    readby.appendChild(chip(label, () => goTo(s, c, r)));
    if (s.toLowerCase() === sheet.toLowerCase()) tds.get(key(c, r))?.classList.add("readby");
  }
  if (!info.dependents.length) readby.textContent = "—";

  if (info.spill) markSpill(info.spill);
  else if (cell && cell[3] && cell[3] !== "anchor") {
    // a spilled cell: outline the array it belongs to
    const m = /^([A-Z]+)(\d+)$/.exec(cell[3]);
    if (m) {
      let col = 0;
      for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
      const anchor = JSON.parse(web.inspect(book, sheet, col - 1, +m[2] - 1));
      if (anchor.spill) markSpill(anchor.spill);
    }
  }
  $("explain").textContent = info.explain;
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

function commit(text) {
  const cell = cells.get(key(sel.col, sel.row));
  if ((cell ? cell[2] : "") === text) return;
  const t0 = performance.now();
  const [b, json] = web.set(book, sheet, sel.col, sel.row, text);
  const ms = performance.now() - t0;
  book = b;
  const report = JSON.parse(json);
  const before = rows;
  rows = refreshCells();
  if (rows !== before) drawGrid();
  else for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) paint(c, r);

  let elsewhere = 0;
  for (const [s, c, r] of report.changed) {
    if (s.toLowerCase() !== sheet.toLowerCase()) {
      elsewhere++;
      continue;
    }
    const td = tds.get(key(c, r));
    if (td) {
      td.classList.remove("flash");
      void td.offsetWidth;
      td.classList.add("flash");
    }
  }
  const n = report.changed.length;
  $("statline").innerHTML =
    `Recalculated <strong>${report.evaluated}</strong> of ${report.formulas} formula${report.formulas === 1 ? "" : "s"} · ` +
    `${n} cell${n === 1 ? "" : "s"} changed${elsewhere ? ` (${elsewhere} on other sheets)` : ""} · ${ms.toFixed(2)} ms` +
    `<br><span class="badge">${report.rebuilt ? "full rebuild: a dynamic array changed shape" : "incremental"}</span>` +
    (report.cycles.length ? ` <span class="badge">${report.cycles.length} in a circular reference</span>` : "");
}

function showParse() {
  const problem = JSON.parse(web.check_formula(input.value));
  const box = $("parse");
  if (!problem) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.textContent = `${problem.message} — at character ${problem.position + 1}`;
}

input.addEventListener("input", showParse);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    commit(input.value);
    select(sel.col, sel.row + (e.shiftKey ? -1 : 1));
    grid.focus({ preventScroll: true });
  } else if (e.key === "Tab") {
    e.preventDefault();
    commit(input.value);
    select(sel.col + (e.shiftKey ? -1 : 1), sel.row);
    grid.focus({ preventScroll: true });
  } else if (e.key === "Escape") {
    e.preventDefault();
    select(sel.col, sel.row);
    grid.focus({ preventScroll: true });
  }
});

grid.addEventListener("mousedown", (e) => {
  const td = e.target.closest("td[data-c]");
  if (!td) return;
  select(+td.dataset.c, +td.dataset.r);
});
grid.addEventListener("dblclick", () => {
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
});

grid.addEventListener("keydown", (e) => {
  const moves = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  if (moves[e.key]) {
    e.preventDefault();
    select(sel.col + moves[e.key][0], sel.row + moves[e.key][1]);
  } else if (e.key === "Enter" || e.key === "F2") {
    e.preventDefault();
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  } else if (e.key === "Tab") {
    e.preventDefault();
    select(sel.col + (e.shiftKey ? -1 : 1), sel.row);
  } else if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    commit("");
    select(sel.col, sel.row);
  } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    input.value = e.key;
    input.focus();
    showParse();
  }
});

// ---------------------------------------------------------------------------
// Function reference
// ---------------------------------------------------------------------------

const catalogue = JSON.parse(web.catalogue());
$("fcount").textContent = `(${catalogue.length})`;

function drawFunctions(q) {
  const list = $("flist");
  list.innerHTML = "";
  const needle = q.trim().toLowerCase();
  for (const [cat, name, syntax] of catalogue) {
    if (needle && !(name.toLowerCase().includes(needle) || cat.toLowerCase().includes(needle))) continue;
    const li = document.createElement("li");
    li.innerHTML = `<span class="cat"></span>`;
    li.querySelector(".cat").textContent = cat;
    li.appendChild(document.createTextNode(syntax));
    li.onclick = () => {
      const v = input.value;
      input.value = (v === "" ? "=" : v) + name + "(";
      input.focus();
      showParse();
    };
    list.appendChild(li);
  }
}
$("fsearch").addEventListener("input", (e) => drawFunctions(e.target.value));
drawFunctions("");

// ---------------------------------------------------------------------------

const picker = $("sample");
for (const s of samples) {
  const o = document.createElement("option");
  o.value = s.id;
  o.textContent = s.title;
  picker.appendChild(o);
}
picker.addEventListener("change", () => loadSample(picker.value));
const start = location.hash.slice(1);
picker.value = samples.some((s) => s.id === start) ? start : samples[0].id;
loadSample(picker.value);
grid.focus({ preventScroll: true });
