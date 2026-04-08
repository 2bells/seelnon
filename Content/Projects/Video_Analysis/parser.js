export async function analyzeMp4(file, MP4Box, onProgress = () => {}) {
  const chunkSize = 2 * 1024 * 1024; // 2MB
  const mp4boxfile = MP4Box.createFile();
  const info = { brands: [], codecs: [], tags: {}, boxTreeText: "", durationSec: null };

  let totalRead = 0;
  let aborted = false;

  // Gathered data
  let brands = [];
  let majorBrand = "";
  let minorVersion = 0;
  let ilst = {};
  let quicktimeMeta = {};
  let userData = {};
  let encoder = null;
  let softwareTool = null;
  let device = null;
  let codecs = new Set();
  let durationSec = null;
  let boxTreeText = "";

  mp4boxfile.onMoovStart = () => {};
  mp4boxfile.onReady = (infoReady) => {
    durationSec = infoReady.duration / infoReady.timescale;
    if (infoReady.brands) {
      brands = infoReady.brands;
    }
    if (infoReady.mime) {
      // no-op
    }
    if (infoReady.videoTracks) {
      infoReady.videoTracks.forEach(t => {
        if (t.codec) codecs.add(t.codec);
      });
    }
    if (infoReady.audioTracks) {
      infoReady.audioTracks.forEach(t => {
        if (t.codec) codecs.add(t.codec);
      });
    }
  };

  mp4boxfile.onError = (e) => {
    // keep going; we can still dump what we have
    console.warn("MP4Box error:", e);
  };

  // Request items to build a box tree
  mp4boxfile.onItem = (id, user, data) => { /* not used */ };

  // We will build a tree by scanning boxes via mp4box internal structure once ready
  function dumpBoxes(node, depth=0, out=[]) {
    if (!node) return out;
    const indent = "  ".repeat(depth);
    const nm = node.type || node.name || "box";
    const size = node.size || node.hdr_size || node.total_size || "";
    out.push(`${indent}${nm}${size?` (${size})`:""}`);
    const ch = node.boxes || node.elements || node.children;
    if (Array.isArray(ch)) ch.forEach(c => dumpBoxes(c, depth+1, out));
    return out;
  }

  // Feed file in chunks
  let nextStart = 0;
  while (nextStart < file.size && !aborted) {
    const end = Math.min(nextStart + chunkSize, file.size);
    const slice = file.slice(nextStart, end);
    const buffer = await readAsArrayBuffer(slice);
    buffer.fileStart = nextStart; // required by mp4box.js
    mp4boxfile.appendBuffer(buffer);
    nextStart = end;
    totalRead = end;
    onProgress(Math.round((totalRead / file.size) * 50), `Parsing MP4 structure… ${(totalRead/file.size*100).toFixed(0)}%`);
    // Stop early if moov parsed and we already have enough? We'll keep reading to catch udta/meta later.
  }
  mp4boxfile.flush();

  // XMP extraction for Adobe tool hints
  const xmp = await extractXMPFromFile(file);
  if (xmp) {
    Object.assign(quicktimeMeta, xmp.tags);
    if (!softwareTool) softwareTool = xmp.tags["xmp:CreatorTool"] || (xmp.tags["xmpMM:History.softwareAgents"]?.[0]) || softwareTool;
    if (xmp.xml) { const m = xmp.xml.match(/(After Effects|Premiere Pro|Photoshop|Media Encoder|Audition)/i); if (m) softwareTool = softwareTool? `${softwareTool}; ${m[1]}`: m[1]; }
  }

  // Dive into internal structures if accessible
  const moov = mp4boxfile.moov;
  if (moov) {
    // ftyp
    const ftyp = mp4boxfile.ftyp;
    if (ftyp) {
      majorBrand = ftyp.major_brand;
      minorVersion = ftyp.minor_version;
      if (Array.isArray(ftyp.compatible_brands)) {
        brands = Array.from(new Set([ftyp.major_brand, ...ftyp.compatible_brands].filter(Boolean)));
      }
    }

    // Collect metadata from udta/meta/ilst and others
    const udta = (moov.udta && moov.udta.meta) ? moov.udta.meta : moov.udta;
    if (udta) {
      // QuickTime meta can live under moov.udta.meta.ilst
      const meta = udta.meta || udta;
      const ilstBox = meta.ilst || meta.tags || meta.boxes?.find(b => b.type === "ilst");
      if (ilstBox) {
        ilst = flattenIlst(ilstBox);
        // Known keys:
        encoder = encoder || ilst["encoder"] || ilst["©enc"] || ilst["com.apple.quicktime.software"] || ilst["©swr"];
        softwareTool = softwareTool || ilst["©too"] || ilst["com.apple.quicktime.software"];
        device = device || ilst["com.apple.quicktime.make"] && ilst["com.apple.quicktime.model"]
          ? `${ilst["com.apple.quicktime.make"]} ${ilst["com.apple.quicktime.model"]}` : (ilst["model"] || ilst["make"]);
      }
      quicktimeMeta = flattenAny(meta);
      userData = flattenAny(moov.udta);
    }

    // Tracks -> codecs and camera/device hints in track metadata
    const traks = moov.traks || moov.boxes?.filter(b=>b.type==="trak") || [];
    traks.forEach(t => {
      const mdia = t.mdia || t.boxes?.find(b=>b.type==="mdia");
      const hdlr = mdia?.hdlr;
      const handler = hdlr?.handler_type || hdlr?.name;
      // Codec names from stsd entries
      const stsd = mdia?.minf?.stbl?.stsd;
      const entries = stsd?.entries || stsd?.boxes || [];
      entries.forEach(e => {
        if (e.type) codecs.add(e.type);
        if (e.avcC?.configurationVersion) codecs.add("avc1");
        if (e.hvcC?.configurationVersion) codecs.add("hvc1");
      });
      // Device details sometimes embedded in track meta
      const tmeta = flattenAny(t);
      if (!device) {
        device = tmeta["com.android.version"] || tmeta["androidVersion"] || tmeta["com.apple.quicktime.model"] || device;
      }
      if (!softwareTool) {
        softwareTool = tmeta["©too"] || tmeta["software"] || softwareTool;
      }
    });

    // Build box tree textual dump
    try {
      boxTreeText = dumpBoxes({ type:"root", boxes:[mp4boxfile.ftyp, moov, ...Object.values(mp4boxfile).filter(b=>b?.type && !["ftyp","moov"].includes(b.type))].filter(Boolean) }, -1).join("\n");
      boxTreeText = boxTreeText.replace(/^root\s*\(\)$/,'mp4'); // tiny cleanup
    } catch {
      // fallback: only moov
      boxTreeText = dumpBoxes(moov, 0, []).join("\n");
    }
  }

  // Consolidate tags
  const tags = { ...quicktimeMeta, ...userData, ...ilst };
  // Common surfacing
  const software = softwareTool || tags["©too"] || tags["software"] || tags["com.apple.quicktime.software"] || null;
  const enc = encoder || tags["encoder"] || null;

  info.brands = brands.length ? brands : (majorBrand ? [majorBrand] : []);
  info.codecs = Array.from(codecs);
  info.tags = cleanObj(tags);
  info.boxTreeText = boxTreeText;
  info.durationSec = durationSec;
  info.softwareTool = software || null;
  info.encoder = enc || null;
  info.device = device || tags["model"] || tags["com.apple.quicktime.model"] || null;

  onProgress(75, "Analyzing metadata…");
  return info;
}

/* Helpers */
function readAsArrayBuffer(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(fr.error || new Error("FileReader error"));
    fr.readAsArrayBuffer(blob);
  });
}

function flattenIlst(ilstBox) {
  const out = {};
  const boxes = ilstBox.boxes || ilstBox.entries || [];
  boxes.forEach(b => {
    const key = b.name || b.type || b.key;
    if (!key) return;
    // Data boxes can be nested
    const val = extractIlstValue(b);
    if (val != null) out[key] = val;
  });
  return out;
}
function extractIlstValue(b) {
  if (typeof b.data === "string" || typeof b.data === "number") return b.data;
  if (Array.isArray(b.data)) return b.data.map(x => String(x));
  if (b.data && b.data.value) return b.data.value;
  // search nested 'data' boxes
  const child = (b.boxes || []).find(x => x.type === "data");
  if (child?.data?.value != null) return child.data.value;
  return null;
}
function flattenAny(node, prefix = "", out = {}) {
  if (!node || typeof node !== "object") return out;
  const keys = Object.keys(node);
  keys.forEach(k => {
    const v = node[k];
    if (!v || typeof v !== "object") return;
    // capture string/number leaves commonly used
    if (typeof v === "string" || typeof v === "number") {
      out[prefix + k] = v;
    }
    if (Array.isArray(v)) {
      v.forEach((it, i) => {
        if (typeof it === "string" || typeof it === "number") out[`${prefix}${k}[${i}]`] = it;
        else flattenAny(it, `${prefix}${k}.${i}.`, out);
      });
    } else {
      // known key-value containers
      if (v.data && (typeof v.data.value === "string" || typeof v.data.value === "number")) {
        out[prefix + (v.type || k)] = v.data.value;
      }
      flattenAny(v, `${prefix}${k}.`, out);
    }
  });
  return out;
}
function cleanObj(obj) {
  const out = {};
  Object.entries(obj).forEach(([k,v]) => {
    if (v == null) return;
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed.length) out[k] = trimmed;
    } else {
      out[k] = v;
    }
  });
  return out;
}

/* XMP helpers */
async function extractXMPFromFile(file){ const t=await readAsText(file); const m=t&&t.match(/<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/gi); if(!m) return null; const xml=m.join("\n"); const tags={}; const ct=xml.match(/xmp:CreatorTool="([^"]+)"/i)||xml.match(/<xmp:CreatorTool>([^<]+)</i); if(ct) tags["xmp:CreatorTool"]=ct[1]; const agents=[...xml.matchAll(/stEvt:softwareAgent="([^"]+)"/gi)].map(x=>x[1]); if(agents.length) tags["xmpMM:History.softwareAgents"]=agents; return { xml, tags }; }
function readAsText(blob){ return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(String(fr.result||"")); fr.onerror=()=>rej(fr.error||new Error("FileReader error")); fr.readAsText(blob); }); }