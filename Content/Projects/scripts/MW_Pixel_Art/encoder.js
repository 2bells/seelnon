/* Pure .gia encoder — no DOM. Receives a settings object + per-color layer
   text and returns the packed .gia bytes. */

const td = new TextDecoder();

/* ------------------------------------------------------------------ */
/* Raw protobuf helpers                                                */
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
/* .gia structural helpers                                             */
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
/* Multi-box .gia composition                                          */
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
/* patch every quad's zoom (vec 501/502) + box dims (vec 501/502) in a color box frame */
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
function applyName(combRaw, name) {
  const cur = readTemplateName(combRaw);
  const nm = (name && name.trim()) || "ASCII_Template";
  if (!cur || cur === nm) return combRaw;
  const enc2 = new TextEncoder();
  return replaceText(combRaw, enc2.encode(cur), enc2.encode(nm));
}

/** Build a complete .gia file.
 *  settings: {
 *    name, boxW, boxH, zoomX, zoomY,
 *    texts: string[]  // one ASCII layer per color, aligned with colors
 *  }
 *  colors: string[] lowercased hex layers (e.g. "#ff0000"), aligned to texts.
 */
function buildComboGia(comboBase, colors, settings) {
  const enc = new TextEncoder();
  const name = settings.name;
  const boxW = Math.abs(parseFloat(settings.boxW)) || 1200;
  const boxH = Math.abs(parseFloat(settings.boxH)) || 1500;
  const zx = parseFloat(settings.zoomX); const ZX = Number.isFinite(zx) ? zx : 1;
  const zy = parseFloat(settings.zoomY); const ZY = Number.isFinite(zy) ? zy : 0.8;
  const texts = settings.texts || [];
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
  boxes.forEach((bx, idx) => {
    const best = bestStr(bx.raw);
    const layer = enc.encode(bx.color ? texts[idx] : "");
    if (best) bx.raw = replaceText(bx.raw, best, layer);
    if (bx.color) bx.raw = patchBoxQuads(bx.raw, boxW, boxH, ZX, ZY);
    orderedGuids.push(bx.guid);
  });
  const combFrame = frames.find((f) => f.fn === 1);
  let combRaw = applyName(setComboRefs(combFrame.raw, orderedGuids), name);
  const result = [{ tb: writeVarint(1 << 3 | 2), val: writeVarint(combRaw.length), raw: combRaw }];
  for (const bx of boxes) result.push({ tb: writeVarint(2 << 3 | 2), val: writeVarint(bx.raw.length), raw: bx.raw });
  for (const f of frames) if (f.fn !== 1 && f.fn !== 2) result.push(f);
  return repack(rebuild(result));
}

export { buildComboGia };