const $ = (id) => document.getElementById(id);
const canvas = $("grid"), ctx = canvas.getContext("2d");
const paletteEl = $("palette"), eraseBtn = $("erase"), clearBtn = $("clear");
const out = $("out"), go = $("go"), dl = $("dl"), status = $("status");
const blankSel = $("blank"), bgWrap = $("bgwrap"), bgColor = $("bg");
const tabsEl = $("tabs"), copyBtn = $("copy"), sizeSel = $("size"), fontEl = $("font");

let N = parseInt(sizeSel.value, 10) || 16, CELL = canvas.width / N;
const PALETTE = [
  "#000000", "#444444", "#888888", "#bbbbbb", "#ffffff",
  "#e50000", "#f96d00", "#f9c700", "#b8d200", "#3f8e00",
  "#00a0b0", "#1e57c7", "#7a3abf", "#ff4dd2", "#7a4425", "#d9924b",
];
const ERASE = null;
const BLANK = { space: " ", full: "\u3000", block: "█" };

let fontSize = 10;

let grid = [];
let color = PALETTE[1];
let painting = false;
let activeTab = "All";
let comboBase = null; // combo_test1 template (multi-box .gia export)
const td = new TextDecoder();

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
  ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
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

fontEl.addEventListener("input", () => {
  fontSize = Math.min(72, Math.max(1, parseInt(fontEl.value, 10) || 10));
  render();
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
  [...paletteEl.children].forEach((sw, i) => sw.classList.toggle("active", PALETTE[i] === color));
}
eraseBtn.addEventListener("click", () => {
  eraseBtn.classList.toggle("on");
  color = eraseBtn.classList.contains("on") ? ERASE : PALETTE[1];
  markActive();
});
clearBtn.addEventListener("click", () => { resetGrid(); draw(); render(); });

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
  return `<size=${fontSize}><color=#${color.slice(1)}>` + s + "</color></size>";
}
function render() {
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
limit.addEventListener("input", () => updateLen(out.value.length));
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
/* We inject text into boxes AND dynamically resize the combo to match  */
/* the color count — growing/shrinking both the box resources and the   */
/* combo's box references, but we ALWAYS preserve the board field order */
/* and only ever touch the packed box-GUID list (comb.19.1.503) + the   */
/* reference_list, never the nested position blocks.                    */
/* ------------------------------------------------------------------ */
function encodePacked(guids) { return concat(guids.map((g) => writeVarint(g))); }
function getGuid(boxRaw) {
  const id = splitFrames(boxRaw).find((x) => x.fn === 1);
  if (!id || !id.raw) return null;
  const g = splitFrames(id.raw).find((x) => x.fn === 4);
  return g ? Number(g.v) : null;
}
// Re-encode every wire-0 field whose value === from as `to` (varint-length preserved for adjacent GUIDs).
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
// ResourceLocator identity: { field2: 1, field3: 8, field4: guid }
function makeIdentity(guid) {
  return concat([writeVarint(2 << 3), writeVarint(1), writeVarint(3 << 3), writeVarint(8), writeVarint(4 << 3), writeVarint(guid)]);
}
// Replace the payload of the FIRST occurrence of field `fn` (length-delimited) inside `msg`,
// preserving every other byte and the field order exactly.
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
// Rebuild the combo: reference_list = the N boxes (in place), packed box list = the N boxes.
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
      if (fn === 2) { // reference_list slot: emit all N identities once, in original position
        if (!emitted) { emitted = true; for (const g of orderedGuids) { const id = makeIdentity(g); out.push(writeVarint(2 << 3 | 2), writeVarint(id.length), id); } }
        continue;
      }
      if (fn === 19 && raw) { // only the direct child 503 of f19.1 must match (leave nested f505 lists alone)
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
function buildExport(comboBase, colors) {
  const enc = new TextEncoder();
  const frames = splitFrames(comboBase.slice(20, -4));
  const boxFrames = frames.filter((f) => f.fn === 2);
  const TEMPLATE = boxFrames.length;
  const N = colors.length;
  const baseGUIDs = boxFrames.map((f) => getGuid(f.raw));
  let boxes = boxFrames.map((f, i) => ({ raw: f.raw, guid: baseGUIDs[i], color: i < N ? colors[i] : null }));
  if (N < TEMPLATE) boxes = boxes.slice(0, N); // drop unused template boxes
  let nextGuid = Math.max(...baseGUIDs) + 1;   // clone extras if more colors than template boxes
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
    orderedGuids.push(bx.guid);
  }
  const combFrame = frames.find((f) => f.fn === 1);
  const combRaw = setComboRefs(combFrame.raw, orderedGuids);
  const result = [{ tb: writeVarint(1 << 3 | 2), val: writeVarint(combRaw.length), raw: combRaw }];
  for (const bx of boxes) result.push({ tb: writeVarint(2 << 3 | 2), val: writeVarint(bx.raw.length), raw: bx.raw });
  for (const f of frames) if (f.fn !== 1 && f.fn !== 2) result.push(f);
  return repack(rebuild(result));
}

go.addEventListener("click", () => {
  if (!comboBase) { speak("template not loaded", "err"); return; }
  const colors = distinctColors();
  const built = buildExport(comboBase, colors);
  const blob = new Blob([built], { type: "application/octet-stream" });
  dl.href = URL.createObjectURL(blob);
  dl.hidden = false;
  dl.download = "pixel-combo.gia";
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
  .then((b) => { comboBase = new Uint8Array(b); if (grid) speak("ready · draw, pick a color tab, then Build .gia"); })
  .catch(() => speak("couldn’t load combo template", "err"));