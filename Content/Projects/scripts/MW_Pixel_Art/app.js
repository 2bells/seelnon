import { buildComboGia } from "./encoder.js";

const $ = (id) => document.getElementById(id);
const canvas = $("grid"), ctx = canvas.getContext("2d");
const paletteEl = $("palette"), lastUsedEl = $("lastused"), wheel = $("wheel");
const bgColorEl = $("bgcolor");
const importBtn = $("import"), fileInput = $("file");
const out = $("out"), go = $("go"), dl = $("dl"), status = $("status"), copyBtn = $("copy");
const tabsEl = $("tabs"), layersEl = $("layers"), sizeSel = $("size"), fontSel = $("font"), penSizeEl = $("pensize");
const boxW = $("boxw"), boxH = $("boxh"), maxColorsEl = $("maxcolors");
const nameEl = $("name"), zoomXEl = $("zoomx"), zoomYEl = $("zoomy");
const fitEl = $("fit"), lenEl = $("len"), limitEl = $("limit");
const saveBtn = $("save"), delProjectBtn = $("delProject"), projectsSel = $("projects");
const docNameEl = $("docname"), editColor = $("editcolor"), zoomEl = $("zoom");
const zoomInBtn = $("zoomin"), zoomOutBtn = $("zoomout");
const addLayerBtn = $("addLayer");
const tools = document.querySelectorAll("[data-tool]");

let N = 64, CELL = 288 / 16;
let PALETTE = [
  "#000000", "#444444", "#888888", "#bbbbbb", "#ffffff",
  "#e50000", "#f96d00", "#f9c700", "#b8d200", "#3f8e00",
  "#00a0b0", "#1e57c7", "#7a3abf", "#ff4dd2", "#7a4425", "#d9924b",
];
const ERASE = null;
const BLANK = "\u3000";

let layers = [];
let activeLayer = 0;
let backgroundColor = "#1b1b1f";
let color = PALETTE[1];
let tool = "pencil";
let painting = false;
let altDown = false;
let zoomFactor = 1;
let activeTab = "All";
let comboBase = null;
let lastUsed = loadLastUsed();
let history = [];
let future = [];

/* ------------------------------------------------------------------ */
/* Layer helpers                                                       */
/* ------------------------------------------------------------------ */
const active = () => layers[activeLayer] || layers[0];
const makeLayer = (c) => ({
  grid: Array.from({ length: N }, () => Array(N).fill(ERASE)),
  color: c || color,
});
function emptyLayerGrid() { return Array.from({ length: N }, () => Array(N).fill(ERASE)); }

/* ------------------------------------------------------------------ */
/* History (undo/redo)                                                 */
/* ------------------------------------------------------------------ */
const snapLayers = () => layers.map((l) => ({ ...l, grid: l.grid.map((r) => r.slice()) }));
const loadSnapLayers = (s) => (layers = s.map((l) => ({ ...l, grid: l.grid.map((r) => r.slice()) })));
function pushHistory() { history.push(snapLayers()); if (history.length > 100) history.shift(); future = []; }
function undo() {
  if (!history.length) return;
  future.push(snapLayers());
  loadSnapLayers(history.pop());
  afterGridChange();
}
function redo() {
  if (!future.length) return;
  history.push(snapLayers());
  loadSnapLayers(future.pop());
  afterGridChange();
}
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey) {
    const k = e.key.toLowerCase();
    if (k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (k === "y") { e.preventDefault(); redo(); }
    return;
  }
  if (e.altKey && e.key.toLowerCase() === "i") { e.preventDefault(); selectTool("picker"); }
  const k = e.key.toLowerCase();
  if (k === "b") selectTool("pencil");
  else if (k === "e") selectTool("eraser");
  else if (k === "g") selectTool("fill");
  else if (k === "i") selectTool("picker");
  if (e.key === "Alt" && !altDown) { altDown = true; updateCursor(); }
});
window.addEventListener("keyup", (e) => {
  if (e.key === "Alt" && altDown) { altDown = false; updateCursor(); }
});
window.addEventListener("blur", () => { altDown = false; updateCursor(); });

function speak(msg, kind) {
  status.textContent = msg;
  status.className = "status" + (kind ? " " + kind : "");
}
function resetGrid() {
  layers = [makeLayer(PALETTE[1])];
  activeLayer = 0;
  canvas.width = N * CELL; canvas.height = N * CELL;
}
function afterGridChange() {
  draw(); render();
}

/* ------------------------------------------------------------------ */
/* Tools                                                               */
/* ------------------------------------------------------------------ */
tools.forEach((btn) => btn.addEventListener("click", () => selectTool(btn.dataset.tool)));
function selectTool(name) {
  tool = name;
  tools.forEach((b) => b.classList.toggle("on", b.dataset.tool === name));
  updateCursor();
  markActive();
}
const EYEDROPPER = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path d='M18.8 5.2a2 2 0 0 1 0 2.8l-.75.75-2.8-2.8.75-.75a2 2 0 0 1 2.8 0z' fill='%23fff' stroke='%23000' stroke-width='.8'/><path d='M13.3 9.7l1 1-7.3 7.3-.6 2.6 2.6-.6 7.3-7.3 1 1-7.1 7.1a1.2 1.2 0 0 1-1.7 0l-1.3-1.3a1.2 1.2 0 0 1 0-1.7z' fill='%23fff' stroke='%23000' stroke-width='.8' stroke-linejoin='round'/></svg>") 2 20, crosshair`;
function updateCursor() {
  const picking = altDown || tool === "picker";
  canvas.classList.toggle("pick", picking);
  canvas.style.cursor = picking ? EYEDROPPER : "";
}

/* ------------------------------------------------------------------ */
/* Canvas painting                                                     */
/* ------------------------------------------------------------------ */
function draw() {
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const S = CELL;
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (layer.visible === false) continue;
    const L = layer.grid;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = L[y][x];
      if (v != null) { ctx.fillStyle = v; ctx.fillRect(x * S, y * S, S, S); }
    }
  }
  ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineWidth = 1;
  for (let i = 0; i <= N; i++) {
    ctx.beginPath(); ctx.moveTo(i * S, 0); ctx.lineTo(i * S, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * S); ctx.lineTo(canvas.width, i * S); ctx.stroke();
  }
  drawBrushOutline();
}
let hoverP = null;
function drawBrushOutline() {
  if (!hoverP || tool === "picker" || tool === "fill") return;
  const size = Math.max(1, parseInt(penSizeEl.value, 10) || 1);
  const r = (size - 1) / 2;
  const x = Math.floor(hoverP.x - r), y = Math.floor(hoverP.y - r);
  const px = hoverP.x - r, py = hoverP.y - r;
  const w = size * CELL, h = size * CELL;
  const colorStroke = tool === "eraser" ? "#ff3b30" : "#ffffff";
  ctx.strokeStyle = colorStroke;
  ctx.lineWidth = 1;
  ctx.strokeRect(x * CELL, y * CELL, w, h);
  void px; void py;
}
function paintAt(p, use = tool) {
  const layer = active();
  if (p.x < 0 || p.y < 0 || p.x >= N || p.y >= N) return;
  const c = use === "eraser" ? ERASE : color;
  if (c != null) rememberUsed(c, 1);
  const size = Math.max(1, parseInt(penSizeEl.value, 10) || 1);
  const r = Math.floor((size - 1) / 2);
  for (let dy = -r; dy <= size - 1 - r; dy++) for (let dx = -r; dx <= size - 1 - r; dx++) {
    const nx = p.x + dx, ny = p.y + dy;
    if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
    layer.grid[ny][nx] = c;
  }
  draw(); render();
}
function rememberUsed(hex, count) {
  if (!hex) return;
  if (count < 1) count = 1;
  for (let i = 0; i < count; i++) rememberColor(hex);
}
function bucketFill(p) {
  const layer = active();
  const L = layer.grid;
  const target = L[p.y][p.x];
  const fill = color;
  if (target === fill) return;
  rememberUsed(fill, 20);
  const stack = [[p.x, p.y]];
  L[p.y][p.x] = fill;
  while (stack.length) {
    const [x, y] = stack.pop();
    const nbrs = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [nx, ny] of nbrs) {
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      if (L[ny][nx] === target) { L[ny][nx] = fill; stack.push([nx, ny]); }
    }
  }
  draw(); render();
}
function pos(e) {
  const r = canvas.getBoundingClientRect();
  const sx = canvas.width / r.width, sy = canvas.height / r.height;
  return {
    x: Math.max(0, Math.min(N - 1, Math.floor((e.clientX - r.left) * sx / CELL))),
    y: Math.max(0, Math.min(N - 1, Math.floor((e.clientY - r.top) * sy / CELL))),
  };
}
function composite() {
  const out = Array.from({ length: N }, () => Array(N).fill(ERASE));
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (layer.visible === false) continue;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = layer.grid[y][x];
      if (v != null) out[y][x] = v;
    }
  }
  return out;
}
function pickAt(p) {
  const c = composite()[p.y][p.x];
  if (c) setColor(c);
}
canvas.addEventListener("mousedown", (e) => {
  e.preventDefault();
  const p = pos(e);
  if (e.altKey || tool === "picker") { pickAt(p); return; }
  pushHistory();
  if (e.button === 2) { active().grid[p.y][p.x] = ERASE; draw(); render(); return; }
  if (tool === "fill") { bucketFill(p); return; }
  painting = true;
  paintAt(p);
  if (tool === "eraser") { active().grid[p.y][p.x] = ERASE; draw(); render(); }
});
canvas.addEventListener("mousemove", (e) => {
  const p = pos(e);
  hoverP = p;
  draw();
  if (!painting) return;
  paintAt(p, tool === "eraser" ? "eraser" : tool);
});
canvas.addEventListener("mouseleave", () => { hoverP = null; draw(); });
window.addEventListener("mouseup", () => (painting = false));
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

sizeSel.addEventListener("change", () => {
  N = parseInt(sizeSel.value, 10) || 64;
  resetGrid(); draw(); render();
  applyZoom();
});
fontSel.addEventListener("change", () => render());
wheel.addEventListener("input", () => setColor(wheel.value));
bgColorEl.addEventListener("input", () => { backgroundColor = bgColorEl.value; draw(); });

/* ------------------------------------------------------------------ */
/* Palette — fixed slots; editing one color never touches the others   */
/* ------------------------------------------------------------------ */
function loadPalette() {
  try {
    const v = JSON.parse(localStorage.getItem("pixelgia.palette") || "[]");
    if (Array.isArray(v) && v.length === PALETTE.length && v.every((c) => /^#[0-9a-f]{6}$/i.test(c))) return v;
  } catch {}
  return PALETTE.slice();
}
function savePalette() { try { localStorage.setItem("pixelgia.palette", JSON.stringify(PALETTE)); } catch {} }
function sw(hex, onPick, onAlt, extra) {
  const el = document.createElement("button");
  el.className = "swatch" + (extra || "");
  el.style.background = hex; el.title = hex;
  el.dataset.hex = hex.toLowerCase();
  el.addEventListener("click", () => onPick(hex));
  el.addEventListener("contextmenu", (e) => { e.preventDefault(); onAlt && onAlt(hex); });
  return el;
}
function buildPalette() {
  paletteEl.innerHTML = "";
  PALETTE.forEach((hex, i) => paletteEl.appendChild(sw(hex, setColor, editSlot(i))));
  markActive();
}
function buildLastUsed() {
  lastUsedEl.innerHTML = "";
  lastUsed.forEach((hex) => lastUsedEl.appendChild(sw(hex, setColor)));
  markActive();
}
function editSlot(i) {
  return () => {
    editColor.value = PALETTE[i];
    editColor.oninput = () => {
      PALETTE[i] = editColor.value;
      savePalette();
      const b = paletteEl.children[i];
      if (b) { b.style.background = editColor.value; b.title = editColor.value; }
      markActive();
    };
    editColor.onchange = () => setColor(editColor.value);
    editColor.click();
  };
}
function setColor(hex) {
  color = hex;
  wheel.value = hex;
  markActive();
}
function markActive() {
  [...paletteEl.children].forEach((el, i) => el.classList.toggle("active", PALETTE[i] === color));
  [...lastUsedEl.children].forEach((el) => el.classList.toggle("active", (el.dataset.hex || "") === (color || "").toLowerCase()));
}

/* ------------------------------------------------------------------ */
/* Last-used — only records colors not already present on canvas       */
/* ------------------------------------------------------------------ */
function loadLastUsed() {
  try { const v = JSON.parse(localStorage.getItem("pixelgia.lastused") || "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function saveLastUsed() { try { localStorage.setItem("pixelgia.lastused", JSON.stringify(lastUsed)); } catch {} }
function onCanvas(hex) {
  for (const layer of layers) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (layer.grid[y][x] === hex) return true;
  }
  return false;
}
function rememberColor(hex) {
  if (onCanvas(hex)) return;
  lastUsed = lastUsed.filter((h) => h !== hex);
  lastUsed.unshift(hex);
  if (lastUsed.length > 12) lastUsed.pop();
  saveLastUsed();
  buildLastUsed();
}

/* ------------------------------------------------------------------ */
/* Draw layers — stacking, add/delete/reorder/eye                      */
/* ------------------------------------------------------------------ */
function renderLayers() {
  layersEl.innerHTML = "";
  if (!layers.length) {
    const empty = document.createElement("div");
    empty.className = "layers-empty";
    empty.textContent = "no layers yet";
    layersEl.appendChild(empty);
    return;
  }
  // top layer first (front) at index 0
  for (let i = 0; i < layers.length; i++) {
    const l = layers[i];
    const idx = i;
    const isActive = idx === activeLayer;
    const row = document.createElement("div");
    row.className = "dlayer" + (isActive ? " active" : "") + (l.visible === false ? " hidden" : "");
    row.dataset.index = idx;

    const eye = document.createElement("button");
    eye.className = "leye";
    eye.textContent = l.visible === false ? "○" : "●";
    eye.title = l.visible === false ? "show layer" : "hide layer";
    eye.addEventListener("click", (e) => {
      e.stopPropagation();
      l.visible = (l.visible === false) ? true : false;
      renderLayers(); draw(); render();
    });

    const col = document.createElement("button");
    col.className = "lswatch";
    col.style.background = l.color;
    col.title = l.color;
    col.addEventListener("click", (e) => {
      e.stopPropagation();
      setActiveLayer(idx);
      editLayerColor(idx);
    });

    const nm = document.createElement("span");
    nm.className = "lname";
    nm.textContent = "Layer " + (idx + 1);
    nm.title = "layer " + (idx + 1);

    const up = document.createElement("button");
    up.className = "larrow";
    up.textContent = "↑";
    up.title = "move up";
    up.addEventListener("click", (e) => { e.stopPropagation(); moveLayer(idx, -1); });

    const down = document.createElement("button");
    down.className = "larrow";
    down.textContent = "↓";
    down.title = "move down";
    down.addEventListener("click", (e) => { e.stopPropagation(); moveLayer(idx, 1); });

    const del = document.createElement("button");
    del.className = "ldel";
    del.textContent = "×";
    del.title = "delete layer";
    del.addEventListener("click", (e) => { e.stopPropagation(); deleteLayer(idx); });

    row.addEventListener("click", () => setActiveLayer(idx));
    row.append(eye, col, nm, up, down, del);
    layersEl.appendChild(row);
  }
}
function setActiveLayer(i) {
  activeLayer = i;
  renderLayers(); markActive(); render();
}
function addLayer() {
  pushHistory();
  const nextColor = nextUnusedColor();
  layers.unshift(makeLayer(nextColor));
  activeLayer = 0;
  renderLayers(); markActive(); render();
  speak("layer added", "ok");
}
function nextUnusedColor() {
  const used = new Set(layers.map((l) => l.color));
  const base = PALETTE.concat(lastUsed);
  for (const c of base) if (!used.has(c)) return c;
  return color;
}
function deleteLayer(i) {
  if (layers.length <= 1) { speak("need at least one layer", "err"); return; }
  pushHistory();
  layers.splice(i, 1);
  if (activeLayer >= layers.length) activeLayer = layers.length - 1;
  renderLayers(); markActive(); render();
  speak("layer deleted", "ok");
}
function moveLayer(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= layers.length) return;
  pushHistory();
  [layers[i], layers[j]] = [layers[j], layers[i]];
  if (activeLayer === i) activeLayer = j;
  else if (activeLayer === j) activeLayer = i;
  renderLayers(); render();
}
function editLayerColor(idx) {
  const l = layers[idx];
  editColor.value = l.color;
  editColor.oninput = () => {
    l.color = editColor.value;
    const swatch = layersEl.querySelector(`[data-index="${idx}"] .lswatch`);
    if (swatch) { swatch.style.background = l.color; swatch.title = l.color; }
    if (idx === activeLayer) { color = l.color; markActive(); }
    draw();
  };
  editColor.onchange = () => {
    if (idx === activeLayer) { color = l.color; wheel.value = l.color; }
    if (l.grid.some((r) => r.some((v) => v != null))) rememberColor(l.color);
  };
  editColor.click();
}
addLayerBtn.addEventListener("click", addLayer);

/* ------------------------------------------------------------------ */
/* Image import + quantization                                         */
/* ------------------------------------------------------------------ */
function rgbToHex([r, g, b]) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}
function quantize(colors, maxColors) {
  if (colors.length <= maxColors) return colors.map((c) => c.slice());
  let buckets = [colors];
  while (buckets.length < maxColors) {
    let bi = -1, br = -1;
    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i];
      if (b.length < 2) continue;
      const r0 = Math.min(...b.map((c) => c[0])), r1 = Math.max(...b.map((c) => c[0]));
      const g0 = Math.min(...b.map((c) => c[1])), g1 = Math.max(...b.map((c) => c[1]));
      const bl0 = Math.min(...b.map((c) => c[2])), bl1 = Math.max(...b.map((c) => c[2]));
      const range = Math.max(r1 - r0, g1 - g0, bl1 - bl0);
      if (range > br) { br = range; bi = i; }
    }
    if (bi < 0) break;
    const bucket = buckets[bi];
    const r0 = Math.min(...bucket.map((c) => c[0])), r1 = Math.max(...bucket.map((c) => c[0]));
    const g0 = Math.min(...bucket.map((c) => c[1])), g1 = Math.max(...bucket.map((c) => c[1]));
    const bl0 = Math.min(...bucket.map((c) => c[2])), bl1 = Math.max(...bucket.map((c) => c[2]));
    const axis = (r1 - r0 >= g1 - g0 && r1 - r0 >= bl1 - bl0) ? 0 : (g1 - g0 >= bl1 - bl0 ? 1 : 2);
    bucket.sort((a, b) => a[axis] - b[axis]);
    const mid = Math.floor(bucket.length / 2);
    buckets.splice(bi, 1, bucket.slice(0, mid), bucket.slice(mid));
  }
  return buckets.map((b) => {
    if (!b.length) return [0, 0, 0];
    const n = b.length;
    return [
      Math.round(b.reduce((s, c) => s + c[0], 0) / n),
      Math.round(b.reduce((s, c) => s + c[1], 0) / n),
      Math.round(b.reduce((s, c) => s + c[2], 0) / n),
    ];
  });
}
function nearest(pal, c) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < pal.length; i++) {
    const d = (pal[i][0] - c[0]) ** 2 + (pal[i][1] - c[1]) ** 2 + (pal[i][2] - c[2]) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return pal[best];
}
importBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  const f = fileInput.files[0];
  if (!f) return;
  const img = new Image();
  img.onload = () => {
    pushHistory();
    const off = document.createElement("canvas");
    off.width = N; off.height = N;
    const oc = off.getContext("2d");
    oc.imageSmoothingEnabled = false;
    const scale = Math.max(N / img.width, N / img.height);
    const w = img.width * scale, h = img.height * scale;
    oc.drawImage(img, (N - w) / 2, (N - h) / 2, w, h);
    const data = oc.getImageData(0, 0, N, N).data;
    const px = [];
    for (let i = 0; i < N * N; i++) {
      if (data[i * 4 + 3] < 128) continue;
      px.push([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
    }
    const maxC = Math.max(1, parseInt(maxColorsEl.value, 10) || 7);
    const pal = quantize(px, maxC);
    mapToLayers(data, pal);
    pal.forEach((c) => rememberColor(rgbToHex(c)));
    draw(); render();
    speak(`imported · ${pal.length} color(s)`, "ok");
    fileInput.value = "";
  };
  img.onerror = () => speak("couldn't read image", "err");
  img.src = URL.createObjectURL(f);
});
function mapToLayers(data, pal) {
  layers = [];
  const assign = Array.from({ length: N }, () => Array(N).fill(ERASE));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4;
    if (data[i + 3] < 128) { assign[y][x] = ERASE; continue; }
    assign[y][x] = rgbToHex(nearest(pal, [data[i], data[i + 1], data[i + 2]]));
  }
  const colorSet = [];
  const byColor = {};
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const c = assign[y][x];
    if (!c) continue;
    if (!colorSet.includes(c)) { colorSet.push(c); byColor[c] = makeLayer(c); }
    byColor[c].grid[y][x] = c;
  }
  layers = colorSet.map((c) => byColor[c]);
  // active = front-most (last color)
  activeLayer = layers.length - 1;
  if (layers.length) { color = layers[activeLayer].color; wheel.value = color; }
}

/* ------------------------------------------------------------------ */
/* Export text + tabs                                                  */
/* ------------------------------------------------------------------ */
function effectiveFontSize() {
  const v = fontSel.value;
  if (v === "none") return null;
  if (v === "auto") {
    const bw = parseInt(boxW.value, 10) || 1, bh = parseInt(boxH.value, 10) || 1;
    return Math.max(1, Math.round(Math.min(bw, bh) / N));
  }
  return parseInt(v, 10) || null;
}
function combinedString() {
  const g = composite();
  let s = "", open = null;
  for (let y = 0; y < N; y++) {
    if (y > 0) s += "\\n";
    for (let x = 0; x < N; x++) {
      const c = g[y][x];
      if (c === ERASE) s += " ";
      else if (open === c) s += "\u2588";
      else {
        if (open !== null) s += "</color>";
        s += `<color=#${c.slice(1)}>\u2588`; open = c;
      }
    }
  }
  if (open !== null) s += "</color>";
  return s;
}
function distinctColors() {
  const order = [];
  const g = composite();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const c = g[y][x];
    if (c && !order.includes(c)) order.push(c);
  }
  return order;
}
function layerString(hex, fontSize) {
  let s = "";
  const enc = hex.slice(1).toLowerCase();
  const g = composite();
  for (let y = 0; y < N; y++) {
    if (y > 0) s += "\\n";
    for (let x = 0; x < N; x++) {
      s += g[y][x] === hex ? "\u2588" : "\u3000";
    }
  }
  const open = fontSize ? `<size=${fontSize}>` : "";
  const close = fontSize ? "</size>" : "";
  return open + `<color=#${enc}>` + s + "</color>" + close;
}
function render() {
  const fontSize = effectiveFontSize();
  const colors = distinctColors();
  const tabs = [{ label: "All", swatch: null, text: combinedString() }];
  colors.forEach((c) => tabs.push({ label: c, swatch: c, text: layerString(c, fontSize) }));
  if (!tabs.some((t) => t.label === activeTab)) activeTab = "All";
  tabsEl.innerHTML = "";
  tabs.forEach((t) => {
    const b = document.createElement("button");
    b.className = "tab" + (t.label === activeTab ? " active" : "");
    if (t.swatch) { const sw = document.createElement("i"); sw.style.background = t.swatch; b.appendChild(sw); }
    b.appendChild(document.createTextNode(t.label));
    b.title = t.label;
    b.addEventListener("click", () => { activeTab = t.label; render(); });
    tabsEl.appendChild(b);
  });
  const active = tabs.find((t) => t.label === activeTab) || tabs[0];
  out.value = active.text;
  updateLen(active.text.length);
  updateFit();
  renderLayers();
}
function updateLen(n) {
  const lim = parseInt(limitEl.value, 10) || 0;
  lenEl.textContent = `${n} chars`;
  lenEl.classList.toggle("over", lim > 0 && n > lim);
  if (lim > 0) lenEl.textContent += ` / limit ${lim} (${Math.max(0, lim - n)} left)`;
}
function updateFit() {
  const bw = parseInt(boxW.value, 10) || 1, bh = parseInt(boxH.value, 10) || 1;
  const mode = fontSel.value;
  const label = mode === "none" ? "size omitted" : (mode === "auto" ? `writes <size=${effectiveFontSize()}>` : `writes <size=${mode}>`);
  fitEl.textContent = `box ${bw}×${bh} · ${label}`;
}
copyBtn.addEventListener("click", () => {
  out.select();
  try { navigator.clipboard.writeText(out.value); }
  catch { document.execCommand("copy"); }
  speak(`copied ${activeTab} (${out.value.length} chars)`);
});
limitEl.addEventListener("input", () => updateLen(out.value.length));
boxW.addEventListener("input", render);
boxH.addEventListener("input", render);
maxColorsEl.addEventListener("input", updateFit);

/* ------------------------------------------------------------------ */
/* Save / load (IndexedDB)                                             */
/* ------------------------------------------------------------------ */
const DB_NAME = "pixel-gia", STORE = "projects", KEY = "current";
function openDB() {
  return new Promise((resolve, reject) => {
    const rq = indexedDB.open(DB_NAME, 1);
    rq.onupgradeneeded = () => { const db = rq.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE); };
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}
function dbPut(value) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }));
}
function dbGet() {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const rq = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
    rq.onsuccess = () => { db.close(); resolve(rq.result); };
    rq.onerror = () => { db.close(); reject(rq.error); };
  }));
}
async function saveProject() {
  const name = (docNameEl.value.trim() || "untitled");
  docNameEl.value = name;
  const data = { layers: snapLayers(), backgroundColor, color, tool, N, savedAt: Date.now() };
  try {
    const all = (await dbGet()) || {};
    all[name] = data;
    await dbPut(all);
    speak(`saved "${name}"`, "ok");
    refreshProjects();
  } catch { speak("couldn't save", "err"); }
}
async function loadProject(name) {
  try {
    const all = await dbGet();
    const data = all && all[name];
    if (!data) { speak("no saved project", "err"); return; }
    pushHistory();
    N = data.N || 64; sizeSel.value = String(N);
    if (data.layers && data.layers.length) {
      layers = data.layers.map((l) => ({ ...l, grid: l.grid.map((r) => r.slice()) }));
      activeLayer = 0;
    } else if (data.grid) {
      // legacy single-grid
      layers = [{ grid: data.grid.map((r) => r.slice()), color: data.color || PALETTE[1], visible: true }];
      activeLayer = 0;
    } else { resetGrid(); }
    backgroundColor = data.backgroundColor || "#1b1b1f"; bgColorEl.value = backgroundColor;
    color = layers[activeLayer].color || PALETTE[1]; wheel.value = color;
    if (data.tool) selectTool(data.tool);
    docNameEl.value = name;
    canvas.width = N * CELL; canvas.height = N * CELL;
    markActive();
    draw(); render();
    speak(`loaded "${name}"`, "ok");
  } catch { speak("couldn't load", "err"); }
}
async function deleteProject(name) {
  try {
    const all = await dbGet();
    if (!all || !all[name]) { speak("no such project", "err"); return; }
    delete all[name];
    await dbPut(all);
    speak(`deleted "${name}"`, "ok");
    refreshProjects();
  } catch { speak("couldn't delete", "err"); }
}
async function refreshProjects() {
  let all = {};
  try { all = (await dbGet()) || {}; } catch {}
  projectsSel.innerHTML = "";
  const isProject = (v) => v && typeof v === "object" && (Array.isArray(v.layers) || Array.isArray(v.grid));
  const names = Object.keys(all).filter((k) => isProject(all[k])).sort((a, b) => a.localeCompare(b));
  if (!names.length) {
    const placeholder = document.createElement("option");
    placeholder.value = ""; placeholder.textContent = "no saved projects";
    placeholder.disabled = true; placeholder.selected = true;
    projectsSel.appendChild(placeholder);
    return;
  }
  const cur = docNameEl.value.trim() || "untitled";
  let found = false;
  names.forEach((name) => {
    const o = document.createElement("option");
    o.value = name; o.textContent = name;
    if (name === cur) { o.selected = true; found = true; }
    projectsSel.appendChild(o);
  });
  if (!found) projectsSel.value = names[0];
}
saveBtn.addEventListener("click", saveProject);
delProjectBtn.addEventListener("click", () => {
  const name = projectsSel.value;
  if (name) deleteProject(name);
});
projectsSel.addEventListener("change", () => {
  const name = projectsSel.value;
  if (name) loadProject(name);
});

/* ------------------------------------------------------------------ */
/* Build                                                               */
/* ------------------------------------------------------------------ */
go.addEventListener("click", () => {
  if (!comboBase) { speak("template not loaded", "err"); return; }
  const colors = distinctColors();
  const maxC = Math.max(1, parseInt(maxColorsEl.value, 10) || 7);
  if (colors.length > maxC) {
    speak(`⚠ ${colors.length} colors — game may break above ${maxC}. Build anyway?`, "err");
    return;
  }
  const fontSize = effectiveFontSize();
  const texts = colors.map((c) => layerString(c, fontSize));
  const built = buildComboGia(comboBase, colors, {
    name: nameEl.value.trim() || "ASCII_Template",
    boxW: boxW.value, boxH: boxH.value,
    zoomX: zoomXEl.value, zoomY: zoomYEl.value,
    texts,
  });
  const blob = new Blob([built], { type: "application/octet-stream" });
  dl.href = URL.createObjectURL(blob);
  dl.hidden = false;
  dl.download = (nameEl.value.trim() || "ASCII_Template") + ".gia";
  speak(`ok · ${colors.length} color box(es) · .gia ${built.length} B`, "ok");
});

function applyZoom() {
  const px = Math.round(N * CELL * zoomFactor);
  canvas.style.width = px + "px";
  canvas.style.height = px + "px";
  zoomEl.textContent = Math.round(zoomFactor * 100) + "%";
}
zoomInBtn.addEventListener("click", () => setZoom(zoomFactor + 0.25));
zoomOutBtn.addEventListener("click", () => setZoom(zoomFactor - 0.25));
function setZoom(v) {
  zoomFactor = Math.max(0.25, Math.min(16, v));
  applyZoom();
}

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */
PALETTE = loadPalette();
resetGrid();
bgColorEl.value = backgroundColor;
buildPalette();
buildLastUsed();
selectTool("pencil");
draw();
render();
refreshProjects();
applyZoom();
fetch("./combo_base.gia")
  .then((r) => r.arrayBuffer())
  .then((b) => { comboBase = new Uint8Array(b); speak("ready · draw or import an image, then Build .gia"); })
  .catch(() => speak("couldn't load combo template", "err"));