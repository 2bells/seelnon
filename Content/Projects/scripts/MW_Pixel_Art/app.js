const $ = (id) => document.getElementById(id);
const canvas = $("grid"), ctx = canvas.getContext("2d");
const paletteEl = $("palette"), eraseBtn = $("erase"), clearBtn = $("clear");
const out = $("out"), go = $("go"), dl = $("dl"), status = $("status");
const blankSel = $("blank"), bgWrap = $("bgwrap"), bgColor = $("bg");
const tabsEl = $("tabs"), copyBtn = $("copy"), sizeSel = $("size");
const fontSel = $("font"), boxW = $("boxw"), boxH = $("boxh"), maxColorsEl = $("maxcolors");
const importBtn = $("import"), fileInput = $("file"), fitEl = $("fit"), wheel = $("wheel");
const nameEl = $("name"), zoomXEl = $("zoomx"), zoomYEl = $("zoomy");

let N = parseInt(sizeSel.value, 10) || 16, CELL = canvas.width / N;
const PALETTE = [
  "#000000", "#444444", "#888888", "#bbbbbb", "#ffffff",
  "#e50000", "#f96d00", "#f9c700", "#b8d200", "#3f8e00",
  "#00a0b0", "#1e57c7", "#7a3abf", "#ff4dd2", "#7a4425", "#d9924b",
];
const ERASE = null;
const BLANK = { space: " ", full: "\u3000", block: "█" };

let fontSize = null; // resolved <size> value; null = omit the tag
let grid = [];
let color = PALETTE[1];
let painting = false;
let activeTab = "All";
let comboBase = null; // combo_test1 template (multi-box .gia export)
const td = new TextDecoder();

function effectiveFontSize() {
  const v = fontSel.value;
  if (v === "none") return null;
  if (v === "auto") {
    const bw = parseInt(boxW.value, 10) || 1, bh = parseInt(boxH.value, 10) || 1;
    return Math.max(1, Math.round(Math.min(bw, bh) / N));
  }
  return parseInt(v, 10) || null;
}

function speak(msg, kind) {
  status.textContent = msg;
  status.className = "status" + (kind ? " " + kind : "");
}

function resetGrid() {
  grid = Array.from({ length: N }, () => Array(N).fill(ERASE));
  canvas.width = N * (288 / 16); canvas.height = N * (288 / 16);
  CELL = canvas.width / N;
}

/* ------------------------------------------------------------------ */
/* Canvas painting                                                     */
/* ------------------------------------------------------------------ */
function draw() {
  ctx.fillStyle = "#1b1b1f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const S = CELL;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const c = grid[y][x];
    if (c) { ctx.fillStyle = c; ctx.fillRect(x * S, y * S, S, S); }
  }
  ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineWidth = 1;
  for (let i = 0; i <= N; i++) {
    ctx.beginPath(); ctx.moveTo(i * S, 0); ctx.lineTo(i * S, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * S); ctx.lineTo(canvas.width, i * S); ctx.stroke();
  }
}
function paint(x, y) {
  if (x < 0 || y < 0 || x >= N || y >= N) return;
  grid[y][x] = color; draw(); render();
}
function pos(e) {
  const r = canvas.getBoundingClientRect();
  const sx = canvas.width / r.width, sy = canvas.height / r.height;
  return {
    x: Math.floor((e.clientX - r.left) * sx / CELL),
    y: Math.floor((e.clientY - r.top) * sy / CELL),
  };
}
canvas.addEventListener("mousedown", (e) => {
  e.preventDefault(); painting = true;
  const p = pos(e);
  if (e.button === 2) { grid[p.y][p.x] = ERASE; draw(); render(); }
  else paint(p.x, p.y);
});
canvas.addEventListener("mousemove", (e) => {
  if (!painting) return;
  const p = pos(e);
  if (e.buttons & 2) { grid[p.y][p.x] = ERASE; draw(); render(); }
  else paint(p.x, p.y);
});
window.addEventListener("mouseup", () => (painting = false));
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

sizeSel.addEventListener("change", () => {
  N = parseInt(sizeSel.value, 10) || 16;
  resetGrid(); draw(); render();
});

fontSel.addEventListener("change", () => {
  fontSize = effectiveFontSize();
  render();
});
wheel.addEventListener("input", () => {
  color = wheel.value;
  eraseBtn.classList.remove("on");
  markActive();
});

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */
function buildPalette() {
  PALETTE.forEach((hex) => {
    const sw = document.createElement("button");
    sw.className = "swatch"; sw.style.background = hex; sw.title = hex;
    sw.addEventListener("click", () => { color = hex; eraseBtn.classList.remove("on"); markActive(); });
    paletteEl.appendChild(sw);
  });
  markActive();
}
function markActive() {
  [...paletteEl.children].forEach((sw, i) => {
    const isSwatch = sw.classList.contains("swatch");
    if (isSwatch) sw.classList.toggle("active", PALETTE[i] === color);
  });
}
eraseBtn.addEventListener("click", () => {
  eraseBtn.classList.toggle("on");
  color = eraseBtn.classList.contains("on") ? ERASE : PALETTE[1];
  markActive();
});
clearBtn.addEventListener("click", () => { resetGrid(); draw(); render(); });

/* ------------------------------------------------------------------ */
/* Image import + color quantization                                   */
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
    N = 64; sizeSel.value = "64"; resetGrid();
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
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      if (data[i + 3] < 128) { grid[y][x] = ERASE; continue; }
      grid[y][x] = rgbToHex(nearest(pal, [data[i], data[i + 1], data[i + 2]]));
    }
    draw(); render();
    speak(`imported · ${pal.length} color(s)`, "ok");
    fileInput.value = "";
  };
  img.onerror = () => speak("couldn’t read image", "err");
  img.src = URL.createObjectURL(f);
});

/* ------------------------------------------------------------------ */
/* Tabs: All + one per color (single-color layer)                     */
/* ------------------------------------------------------------------ */
function combinedString() {
  let s = "", open = null;
  const mode = blankSel.value;
  for (let y = 0; y < N; y++) {
    if (y > 0) s += "\\n";
    for (let x = 0; x < N; x++) {
      const c = grid[y][x];
      if (c === ERASE) {
        if (mode === "block") {
          const bg = bgColor.value;
          if (open !== bg) { if (open !== null) s += "</color>"; s += `<color=#${bg.slice(1)}>`; open = bg; }
          s += "█";
        } else s += BLANK[mode];
      } else if (open === c) s += "█";
      else {
        if (open !== null) s += "</color>";
        s += `<color=#${c.slice(1)}>█`; open = c;
      }
    }
  }
  if (open !== null) s += "</color>";
  return s;
}
function distinctColors() {
  const order = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const c = grid[y][x];
    if (c && !order.includes(c)) order.push(c);
  }
  return order;
}
function layerString(color) {
  let s = "";
  for (let y = 0; y < N; y++) {
    if (y > 0) s += "\\n";
    for (let x = 0; x < N; x++) s += grid[y][x] === color ? "█" : "\u3000";
  }
  const open = fontSize ? `<size=${fontSize}>` : "";
  const close = fontSize ? "</size>" : "";
  return open + `<color=#${color.slice(1)}>` + s + "</color>" + close;
}
function render() {
  fontSize = effectiveFontSize();
  const colors = distinctColors();
  const tabs = [{ label: "All", swatch: null, text: combinedString() }];
  colors.forEach((c) => tabs.push({ label: c, swatch: c, text: layerString(c) }));
  if (!tabs.some((t) => t.label === activeTab)) activeTab = "All";
  tabsEl.innerHTML = "";
  tabs.forEach((t) => {
    const b = document.createElement("button");
    b.className = "tab" + (t.label === activeTab ? " active" : "");
    if (t.swatch) {
      const sw = document.createElement("i");
      sw.style.background = t.swatch;
      b.appendChild(sw);
    }
    b.appendChild(document.createTextNode(t.label));
    b.title = t.label;
    b.addEventListener("click", () => { activeTab = t.label; render(); });
    tabsEl.appendChild(b);
  });
  const active = tabs.find((t) => t.label === activeTab) || tabs[0];
  out.value = active.text;
  updateLen(active.text.length);
  updateFit();
}
copyBtn.addEventListener("click", () => {
  out.select();
  try { navigator.clipboard.writeText(out.value); }
  catch { document.execCommand("copy"); }
  speak(`copied ${activeTab} (${out.value.length} chars)`);
});

const limit = $("limit"), lenEl = $("len");
function updateLen(n) {
  const lim = parseInt(limit.value, 10) || 0;
  lenEl.textContent = `${n} chars`;
  lenEl.classList.toggle("over", lim > 0 && n > lim);
  if (lim > 0) lenEl.textContent += ` / limit ${lim} (${Math.max(0, lim - n)} left)`;
}
function updateFit() {
  const bw = parseInt(boxW.value, 10) || 1, bh = parseInt(boxH.value, 10) || 1;
  const fit = Math.floor(Math.min(bw, bh) / N);
  const mode = fontSel.value;
  const label = mode === "none" ? "size omitted" : (mode === "auto" ? `writes <size=${effectiveFontSize()}>` : `writes <size=${mode}>`);
  fitEl.textContent = `box ${bw}×${bh} · ${label}`;
}
limit.addEventListener("input", () => updateLen(out.value.length));
boxW.addEventListener("input", render);
boxH.addEventListener("input", render);
maxColorsEl.addEventListener("input", updateFit);
blankSel.addEventListener("change", () => {
  bgWrap.hidden = blankSel.value !== "block";
  render();
});
bgColor.addEventListener("input", render);

/* ------------------------------------------------------------------ */
/* Raw protobuf helpers (lossless)                                    */
/* ------------------------------------------------------------------ */
function readVarint(data, pos) {
  let res = 0n, shift = 0n;
  while (true) {
    const b = data[pos]; pos++;
    res |= BigInt(b & 0x7f) << shift;
    if (!(b & 0x80)) break;
    shift += 7n;
  }
  return { v: res, pos };
}
function writeVarint(n) {
  let x = BigInt(n);
  const out = [];
  while (x >= 0x80n) { out.push(Number(x & 0x7fn) | 0x80); x >>= 7n; }
  out.push(Number(x));
  return new Uint8Array(out);
}
function concat(parts) {
  const len = parts.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function isMessage(raw) {
  try {
    let pos = 0, end = raw.length;
    while (pos < end) {
      const { v: tag, pos: p2 } = readVarint(raw, pos);
      pos = p2;
      const field = Number(tag >> 3n), wire = Number(tag & 0x7n);
      if (field === 0) return false;
      if (wire === 0) ({ pos } = readVarint(raw, pos));
      else if (wire === 5) pos += 4;
      else if (wire === 1) pos += 8;
      else if (wire === 2) {
        const { v, pos: p3 } = readVarint(raw, pos);
        pos = p3 + Number(v);
        if (pos > end) return false;
      } else return false;
    }
    return true;
  } catch { return false; }
}

/* ------------------------------------------------------------------ */
/* Multi-box .gia export  (combo_test1 template)                      */
/* ------------------------------------------------------------------ */
function bestStr(data) {
  let bestRaw = null, bestLen = 0, pos = 0, end = data.length;
  while (pos < end) {
    const { v: tag, pos: p1 } = readVarint(data, pos); pos = p1;
    const w = Number(tag & 0x7n);
    if (w === 0) ({ pos } = readVarint(data, pos));
    else if (w === 5) pos += 4;
    else if (w === 1) pos += 8;
    else {
      const { v: size, pos: p2 } = readVarint(data, pos);
      const raw = data.slice(p2, p2 + Number(size)); pos = p2 + Number(size);
      let d = true, s = "";
      try { s = td.decode(raw); } catch { d = false; }
      if (d && !isMessage(raw) && raw.length > 0 && raw.length > bestLen) { bestLen = raw.length; bestRaw = raw; }
      else if (isMessage(raw)) { const r = bestStr(raw); if (r && r.length > bestLen) { bestLen = r.length; bestRaw = r; } }
    }
  }
  return bestRaw;
}
function eq(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function replaceText(data, target, newStr) {
  const body = []; let pos = 0, end = data.length;
  while (pos < end) {
    const { v: tag, pos: p1 } = readVarint(data, pos); pos = p1;
    const wire = Number(tag & 0x7n); const tb = writeVarint(tag);
    if (wire === 0) { const { v, pos: p2 } = readVarint(data, pos); pos = p2; body.push(tb, writeVarint(v)); }
    else if (wire === 5) { body.push(tb, data.slice(pos, pos + 4)); pos += 4; }
    else if (wire === 1) { body.push(tb, data.slice(pos, pos + 8)); pos += 8; }
    else {
      const { v: size, pos: p2 } = readVarint(data, pos);
      const raw = data.slice(p2, p2 + Number(size)); pos = p2 + Number(size);
      let nv = raw;
      if (eq(raw, target)) nv = newStr;
      else if (isMessage(raw)) nv = replaceText(raw, target, newStr);
      body.push(tb, writeVarint(nv.length), nv);
    }
  }
  return concat(body);
}
function splitFrames(data) {
  const f = []; let pos = 0, end = data.length;
  while (pos < end) {
    const { v: tag, pos: p1 } = readVarint(data, pos); pos = p1;
    const wire = Number(tag & 0x7n), fn = Number(tag >> 3n); const tb = writeVarint(tag);
    if (wire === 0) { const { v, pos: p2 } = readVarint(data, pos); pos = p2; f.push({ tb, val: writeVarint(v), v: Number(v), fn }); }
    else if (wire === 5) { f.push({ tb, val: data.slice(pos, pos + 4), fn }); pos += 4; }
    else if (wire === 1) { f.push({ tb, val: data.slice(pos, pos + 8), fn }); pos += 8; }
    else {
      const { v: size, pos: p2 } = readVarint(data, pos);
      const raw = data.slice(p2, p2 + Number(size)); pos = p2 + Number(size);
      f.push({ tb, val: writeVarint(raw.length), raw, fn });
    }
  }
  return f;
}
function rebuild(frames) {
  const parts = [];
  for (const f of frames) {
    if (f.raw) parts.push(f.tb, f.val, f.raw);
    else parts.push(f.tb, f.val);
  }
  return concat(parts);
}
function repack(payload) {
  const header = new Uint8Array(20);
  const dv = new DataView(header.buffer);
  dv.setUint32(0, payload.length + 20, false);
  dv.setUint32(4, 1, false);
  dv.setUint32(8, 0x0326, false);
  dv.setUint32(12, 3, false);
  dv.setUint32(16, payload.length, false);
  return concat([header, payload, new Uint8Array([0x00, 0x00, 0x06, 0x79])]);
}

/* ------------------------------------------------------------------ */
/* Build .gia: combination of text boxes (one per color).               */
/* ------------------------------------------------------------------ */
function encodePacked(guids) { return concat(guids.map((g) => writeVarint(g))); }
function getGuid(boxRaw) {
  const id = splitFrames(boxRaw).find((x) => x.fn === 1);
  if (!id || !id.raw) return null;
  const g = splitFrames(id.raw).find((x) => x.fn === 4);
  return g ? Number(g.v) : null;
}
function remapGuid(data, from, to) {
  const out = []; let pos = 0, end = data.length;
  while (pos < end) {
    const { v: tag, pos: p1 } = readVarint(data, pos); pos = p1;
    const wire = Number(tag & 0x7n); const tb = writeVarint(tag);
    if (wire === 0) { const { v, pos: p2 } = readVarint(data, pos); pos = p2; out.push(tb, writeVarint(Number(v) === from ? to : v)); }
    else if (wire === 5) { out.push(tb, data.slice(pos, pos + 4)); pos += 4; }
    else if (wire === 1) { out.push(tb, data.slice(pos, pos + 8)); pos += 8; }
    else {
      const { v: size, pos: p2 } = readVarint(data, pos);
      const raw = data.slice(p2, p2 + Number(size)); pos = p2 + Number(size);
      const nv = isMessage(raw) ? remapGuid(raw, from, to) : raw;
      out.push(tb, writeVarint(nv.length), nv);
    }
  }
  return concat(out);
}
function makeIdentity(guid) {
  return concat([writeVarint(2 << 3), writeVarint(1), writeVarint(3 << 3), writeVarint(8), writeVarint(4 << 3), writeVarint(guid)]);
}
function setPayload(msg, fn, newPayload) {
  const out = []; let pos = 0, end = msg.length; let done = false;
  while (pos < end) {
    const { v: tag, pos: p1 } = readVarint(msg, pos); pos = p1;
    const wire = Number(tag & 0x7n), f = Number(tag >> 3n); const tb = writeVarint(tag);
    if (wire === 0) { const { v, pos: p2 } = readVarint(msg, pos); pos = p2; out.push(tb, writeVarint(v)); }
    else if (wire === 5) { out.push(tb, msg.slice(pos, pos + 4)); pos += 4; }
    else if (wire === 1) { out.push(tb, msg.slice(pos, pos + 8)); pos += 8; }
    else {
      const { v: size, pos: p2 } = readVarint(msg, pos);
      const raw = msg.slice(p2, p2 + Number(size)); pos = p2 + Number(size);
      if (f === fn && !done) { out.push(tb, writeVarint(newPayload.length), newPayload); done = true; }
      else out.push(tb, writeVarint(raw.length), raw);
    }
  }
  return concat(out);
}
function setComboRefs(combRaw, orderedGuids) {
  const packed = encodePacked(orderedGuids);
  const out = []; let pos = 0, end = combRaw.length; let emitted = false;
  while (pos < end) {
    const { v: tag, pos: p1 } = readVarint(combRaw, pos); pos = p1;
    const wire = Number(tag & 0x7n), fn = Number(tag >> 3n); const tb = writeVarint(tag);
    if (wire === 0) { const { v, pos: p2 } = readVarint(combRaw, pos); pos = p2; out.push(tb, writeVarint(v)); }
    else if (wire === 5) { out.push(tb, combRaw.slice(pos, pos + 4)); pos += 4; }
    else if (wire === 1) { out.push(tb, combRaw.slice(pos, pos + 8)); pos += 8; }
    else {
      const { v: size, pos: p2 } = readVarint(combRaw, pos);
      const raw = combRaw.slice(p2, p2 + Number(size)); pos = p2 + Number(size);
      if (fn === 2) {
        if (!emitted) { emitted = true; for (const g of orderedGuids) { const id = makeIdentity(g); out.push(writeVarint(2 << 3 | 2), writeVarint(id.length), id); } }
        continue;
      }
      if (fn === 19 && raw) {
        let f19_1 = null;
        { let q = 0; while (q < raw.length) { const { v: tag2, pos: q1 } = readVarint(raw, q); q = q1; const w2 = Number(tag2 & 0x7n), f2 = Number(tag2 >> 3n); if (w2 === 2 && f2 === 1) { const { v: sz, pos: q2 } = readVarint(raw, q); f19_1 = raw.slice(q2, q2 + Number(sz)); q = q2 + Number(sz); } else if (w2 === 0) ({ q } = readVarint(raw, q)); else if (w2 === 5) q += 4; else if (w2 === 1) q += 8; else { const { v: sz, pos: q2 } = readVarint(raw, q); q = q2 + Number(sz); } } }
        const newF19_1 = f19_1 ? setPayload(f19_1, 503, packed) : f19_1;
        const newF19 = newF19_1 ? setPayload(raw, 1, newF19_1) : raw;
        out.push(tb, writeVarint(newF19.length), newF19);
        continue;
      }
      out.push(tb, writeVarint(raw.length), raw);
    }
  }
  return concat(out);
}
/* Offset-aware proto frame splitter (for in-place float edits) */
function sfAbs(data, base) {
  base = base || 0;
  const f = [];
  let pos = 0, end = data.length;
  while (pos < end) {
    const { v: tag, pos: p1 } = readVarint(data, pos); pos = p1;
    const wire = Number(tag & 7n), fn = Number(tag >> 3n);
    if (wire === 0) { const { v, pos: p2 } = readVarint(data, pos); pos = p2; f.push({ fn, wire, v: Number(v), abs: base + p1 }); }
    else if (wire === 5) { f.push({ fn, wire, abs: base + pos }); pos += 4; }
    else if (wire === 1) { f.push({ fn, wire, abs: base + pos }); pos += 8; }
    else {
      const { v: size, pos: p2 } = readVarint(data, pos);
      const absRaw = base + p2; pos = p2 + Number(size);
      f.push({ fn, wire, raw: data.subarray(absRaw, absRaw + Number(size)), abs: absRaw });
    }
  }
  return f;
}
function f32bytes(v) {
  const b = new Uint8Array(4); new DataView(b.buffer).setFloat32(0, v, true); return b;
}
/* Absolute-offset frame splitter: parses frames within [from,to) of `out`,
   returning frames with absolute byte offsets (wire-5/1 point at the payload)
   plus content `abs`/`len` for length-delimited fields. Unlike sfAbs, it does
   NOT index the buffer with absolute offsets against a subarray — the known
   source of the box-size/zoom injection bug. */
function frameSpan(out, from, to) {
  const f = [];
  let p = from;
  while (p < to) {
    const { v: tag, pos: p1 } = readVarint(out, p); p = p1;
    const wire = Number(tag & 7n), fn = Number(tag >> 3n);
    if (wire === 0) { const { v, pos: p2 } = readVarint(out, p); p = p2; f.push({ fn, wire, v: Number(v) }); }
    else if (wire === 5) { f.push({ fn, wire, abs: p }); p += 4; }
    else if (wire === 1) { f.push({ fn, wire, abs: p }); p += 8; }
    else {
      const { v: size, pos: p2 } = readVarint(out, p); p = p2;
      const cs = p; p += Number(size);
      f.push({ fn, wire, abs: cs, len: Number(size) });
    }
  }
  return f;
}
/* patch every quad's zoom (vec field1/field2) + box dims (vec 501/502) in a color box frame */
function patchBoxQuads(raw, W, H, zx, zy) {
  if (!raw || !W || !H) return raw;
  const out = new Uint8Array(raw);
  const SEG = (from, to) => frameSpan(out, from, to);
  let m = SEG(0, out.length);
  const f19 = m.find((x) => x.fn === 19 && x.len);
  if (!f19) return raw;
  m = SEG(f19.abs, f19.abs + f19.len);
  const f1 = m.find((x) => x.fn === 1 && x.len);
  if (!f1) return raw;
  m = SEG(f1.abs, f1.abs + f1.len);
  for (const e of m) {
    if (e.fn !== 505 || !e.len) continue;
    const inner = SEG(e.abs, e.abs + e.len);
    const qf502 = inner.find((x) => x.fn === 502 && x.v === 12);
    if (!qf502) continue;
    const q503 = inner.find((x) => x.fn === 503 && x.len);
    if (!q503) continue;
    let mm = SEG(q503.abs, q503.abs + q503.len);
    const f13 = mm.find((x) => x.fn === 13 && x.len);
    if (!f13) continue;
    mm = SEG(f13.abs, f13.abs + f13.len);
    const f12 = mm.find((x) => x.fn === 12 && x.len);
    if (!f12) continue;
    mm = SEG(f12.abs, f12.abs + f12.len);
    for (const q of mm) {
      if (q.fn !== 501 || !q.len) continue;
      const qm = SEG(q.abs, q.abs + q.len);
      const qz = qm.find((x) => x.fn === 502 && x.len);
      if (!qz) continue;
      const qz2 = SEG(qz.abs, qz.abs + qz.len);
      const zoom = qz2.find((x) => x.fn === 501 && x.len);
      const dims = qz2.find((x) => x.fn === 505 && x.len);
      if (!zoom || !dims) continue;
      const zm = SEG(zoom.abs, zoom.abs + zoom.len);
      const dm = SEG(dims.abs, dims.abs + dims.len);
      for (const zf of zm) { if (zf.fn === 1 && zf.wire === 5) out.set(f32bytes(zx), zf.abs); else if (zf.fn === 2 && zf.wire === 5) out.set(f32bytes(zy), zf.abs); }
      for (const df of dm) { if (df.fn === 501 && df.wire === 5) out.set(f32bytes(W), df.abs); else if (df.fn === 502 && df.wire === 5) out.set(f32bytes(H), df.abs); }
    }
  }
  return out;
}
function readTemplateName(combRaw) {
  const f3 = sfAbs(combRaw, 0).find((x) => x.fn === 3 && x.raw);
  if (!f3) return null;
  try { return td.decode(f3.raw); } catch { return null; }
}
function applyName(combRaw) {
  const cur = readTemplateName(combRaw);
  const nm = (nameEl.value.trim() || "ASCII_Template");
  if (!cur || cur === nm) return combRaw;
  const enc2 = new TextEncoder();
  return replaceText(combRaw, enc2.encode(cur), enc2.encode(nm));
}

function buildExport(comboBase, colors) {
  const enc = new TextEncoder();
  const bw = Math.abs(parseFloat(boxW.value)) || 1200;
  const bh = Math.abs(parseFloat(boxH.value)) || 1500;
  const zx = parseFloat(zoomXEl.value); const ZX = Number.isFinite(zx) ? zx : 1;
  const zy = parseFloat(zoomYEl.value); const ZY = Number.isFinite(zy) ? zy : 0.8;
  const frames = splitFrames(comboBase.slice(20, -4));
  const boxFrames = frames.filter((f) => f.fn === 2);
  const TEMPLATE = boxFrames.length;
  const N = colors.length;
  const baseGUIDs = boxFrames.map((f) => getGuid(f.raw));
  let boxes = boxFrames.map((f, i) => ({ raw: f.raw, guid: baseGUIDs[i], color: i < N ? colors[i] : null }));
  if (N < TEMPLATE) boxes = boxes.slice(0, N);
  let nextGuid = Math.max(...baseGUIDs) + 1;
  while (boxes.length < N) {
    const src = boxFrames[boxes.length % TEMPLATE];
    boxes.push({ raw: remapGuid(src.raw, getGuid(src.raw), nextGuid), guid: nextGuid, color: colors[boxes.length] });
    nextGuid++;
  }
  const orderedGuids = [];
  for (const bx of boxes) {
    const best = bestStr(bx.raw);
    const layer = enc.encode(bx.color ? layerString(bx.color) : "");
    if (best) bx.raw = replaceText(bx.raw, best, layer);
    if (bx.color) bx.raw = patchBoxQuads(bx.raw, bw, bh, ZX, ZY);
    orderedGuids.push(bx.guid);
  }
  const combFrame = frames.find((f) => f.fn === 1);
  let combRaw = applyName(setComboRefs(combFrame.raw, orderedGuids));
  const result = [{ tb: writeVarint(1 << 3 | 2), val: writeVarint(combRaw.length), raw: combRaw }];
  for (const bx of boxes) result.push({ tb: writeVarint(2 << 3 | 2), val: writeVarint(bx.raw.length), raw: bx.raw });
  for (const f of frames) if (f.fn !== 1 && f.fn !== 2) result.push(f);
  return repack(rebuild(result));
}

go.addEventListener("click", () => {
  if (!comboBase) { speak("template not loaded", "err"); return; }
  const colors = distinctColors();
  const maxC = Math.max(1, parseInt(maxColorsEl.value, 10) || 7);
  if (colors.length > maxC) {
    speak(`⚠ ${colors.length} colors — game may break above ${maxC}. Build anyway?`, "err");
    return;
  }
  const built = buildExport(comboBase, colors);
  const blob = new Blob([built], { type: "application/octet-stream" });
  dl.href = URL.createObjectURL(blob);
  dl.hidden = false;
  dl.download = (nameEl.value.trim() || "ASCII_Template") + ".gia";
  speak(`ok · ${colors.length} color box(es) · .gia ${built.length} B`, "ok");
});

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */
resetGrid();
buildPalette();
draw();
render();
fetch("combo_base.gia")
  .then((r) => r.arrayBuffer())
  .then((b) => { comboBase = new Uint8Array(b); if (grid) speak("ready · draw or import an image, then Build .gia"); })
  .catch(() => speak("couldn’t load combo template", "err"));