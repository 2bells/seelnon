import * as MP4Box from "./mp4box.js";
import { analyzeMp4 } from "./parser.js";
import { extractStrings } from "./strings.js";
import { scoreEditingLikelihood } from "./heuristics.js";

/* State */
let currentFile = null;
let lastAnalysis = null;
let extractedStrings = null;
let searchMatches = [];
let searchIndex = -1;
let currentSearchQuery = "";

/* Elements */
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const progressWrap = document.getElementById("progress-wrap");
const progressBar = document.getElementById("progress");
const progressText = document.getElementById("progress-text");
const summary = document.getElementById("summary");
const heuristicsPanel = document.getElementById("heuristics");
const metadataPanel = document.getElementById("metadata");
const structurePanel = document.getElementById("structure");
const stringsPanel = document.getElementById("strings");

const fileNameEl = document.getElementById("file-name");
const fileSizeEl = document.getElementById("file-size");
const durationEl = document.getElementById("duration");
const brandsEl = document.getElementById("brands");
const codecsEl = document.getElementById("codecs");
const toolEl = document.getElementById("tool");
const deviceEl = document.getElementById("device");
const scoreEl = document.getElementById("score");
const heuristicsList = document.getElementById("heuristics-list");
const kvMetadata = document.getElementById("kv-metadata");
const boxTree = document.getElementById("box-tree");
const stringsOut = document.getElementById("strings-output");
const numericalOutput = document.getElementById("numerical-output"); // New element reference
const rawPanel = document.getElementById("raw");
const rawDump = document.getElementById("raw-dump");

const exportBtn = document.getElementById("export-json");
const clearBtn = document.getElementById("clear");
const rescanBtn = document.getElementById("rescan");
const dlStringsBtn = document.getElementById("download-strings");
const minlenInput = document.getElementById("minlen");
const utf16Chk = document.getElementById("include-utf16");
const searchInput = document.getElementById("search");
const searchPrevBtn = document.getElementById("search-prev");
const searchNextBtn = document.getElementById("search-next");
const searchCount = document.getElementById("search-count");

const chooseBtn = document.getElementById("choose-btn");

/* UI helpers */
function show(el) { el.hidden = false; }
function hide(el) { el.hidden = true; }
function setProgress(p, text) {
  show(progressWrap);
  progressBar.style.width = `${Math.max(0, Math.min(100, p))}%`;
  progressText.textContent = text || "";
}

/* Drag & drop */
["dragenter","dragover"].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add("active"); }));
["dragleave","drop"].forEach(evt => dropzone.addEventListener(evt, () => dropzone.classList.remove("active")));
dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") fileInput.click(); });
chooseBtn.addEventListener("click", e => {
  e.stopPropagation();
  fileInput.click();
});
dropzone.addEventListener("drop", e => {
  e.preventDefault();
  const file = e.dataTransfer.files?.[0];
  if (file) handleFile(file);
});
fileInput.addEventListener("change", e => {
  const file = e.target.files?.[0];
  if (file) handleFile(file);
});

/* File handling */
async function handleFile(file) {
  reset();
  currentFile = file;
  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = `${(file.size/1024/1024).toFixed(2)} MB`;
  setProgress(0, "Parsing MP4 structure…");

  try {
    const analysis = await analyzeMp4(file, MP4Box, setProgress);
    lastAnalysis = analysis;

    // Summary
    const durationSec = analysis.durationSec ?? null;
    durationEl.textContent = durationSec != null ? `${durationSec.toFixed(3)} s` : "—";
    brandsEl.textContent = (analysis.brands?.join(", ")) || "—";
    codecsEl.textContent = (analysis.codecs?.join(", ")) || "—";
    toolEl.textContent = analysis.softwareTool || analysis.encoder || "—";
    deviceEl.textContent = analysis.device || "—";
    show(summary);

    // Heuristics
    const scored = scoreEditingLikelihood(analysis);
    scoreEl.textContent = `${(scored.score*100).toFixed(0)}% likely edited`;
    heuristicsList.innerHTML = "";
    scored.evidence.forEach(ev => {
      const li = document.createElement("li");
      li.textContent = `${ev.weight>0?"+":"-"} ${ev.reason}`;
      heuristicsList.appendChild(li);
    });
    show(heuristicsPanel);

    // Metadata key-values
    kvMetadata.innerHTML = "";
    const addKV = (k,v) => {
      const kEl = document.createElement("div"); kEl.className = "k mono"; kEl.textContent = k;
      const vEl = document.createElement("div"); vEl.className = "v mono"; vEl.textContent = v;
      kvMetadata.appendChild(kEl); kvMetadata.appendChild(vEl);
    };
    Object.entries(analysis.tags || {}).forEach(([k,v]) => addKV(k, Array.isArray(v)? v.join(", "): String(v)));
    show(metadataPanel);

    // Structure
    boxTree.textContent = analysis.boxTreeText || "";
    show(structurePanel);

    // Strings
    setProgress(50, "Extracting readable strings and numerical data…");
    extractedStrings = await extractStrings(file, { minLen: Number(minlenInput.value)||4, includeUTF16: utf16Chk.checked });
    renderStringsList(extractedStrings.items);
    stringsOut.scrollTop = 0;
    
    // Format numerical candidates for display
    numericalOutput.textContent = extractedStrings.numericalCandidates
      .slice(0, 5000)
      .map(cand => {
        return `Value: ${cand.value}\n  Context: ${cand.context}\n  Source: "${cand.sourceString}"\n---`;
      })
      .join("\n");

    dlStringsBtn.disabled = extractedStrings.all.length === 0;
    show(stringsPanel);
    hide(rawPanel);

    setProgress(100, "Done");
    setTimeout(() => hide(progressWrap), 800);
    exportBtn.disabled = false;
  } catch (err) {
    setProgress(100, "Error");
    console.error(err);
    alert(`Failed to analyze file: ${err.message || err}`);
  }
}

/* Actions */
exportBtn.addEventListener("click", () => {
  if (!lastAnalysis) return;
  const payload = {
    file: { name: currentFile.name, size: currentFile.size },
    analysis: lastAnalysis,
    strings: extractedStrings?.all?.slice(0, 20000) || [], // limit export size
    numericalCandidates: extractedStrings?.numericalCandidates?.slice(0, 20000) || [] // Include numerical candidates in export
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${currentFile.name}.forensics.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

clearBtn.addEventListener("click", () => reset());

rescanBtn.addEventListener("click", async () => {
  if (!currentFile) return;
  setProgress(0, "Rescanning strings and numerical data…");
  extractedStrings = await extractStrings(currentFile, { minLen: Number(minlenInput.value)||4, includeUTF16: utf16Chk.checked });
  renderStringsList(extractedStrings.items);
  numericalOutput.textContent = extractedStrings.numericalCandidates
    .slice(0, 5000)
    .map(cand => {
      return `Value: ${cand.value}\n  Context: ${cand.context}\n  Source: "${cand.sourceString}"\n---`;
    })
    .join("\n");
  dlStringsBtn.disabled = extractedStrings.all.length === 0;
  setProgress(100, "Done");
  setTimeout(() => hide(progressWrap), 500);
});

dlStringsBtn.addEventListener("click", () => {
  if (!extractedStrings) return;
  const blob = new Blob([extractedStrings.all.join("\n")], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${currentFile.name}.strings.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
});

searchInput.addEventListener("input", ()=> performSearch(searchInput.value.trim()));
searchNextBtn.addEventListener("click", ()=> cycleMatch(1));
searchPrevBtn.addEventListener("click", ()=> cycleMatch(-1));

/* Reset */
function reset() {
  lastAnalysis = null;
  extractedStrings = null;
  fileInput.value = "";
  hide(progressWrap);
  [summary, heuristicsPanel, metadataPanel, structurePanel, stringsPanel].forEach(hide);
  hide(rawPanel);
  exportBtn.disabled = true;
  stringsOut.textContent = "";
  numericalOutput.textContent = ""; // Clear numerical output
  boxTree.textContent = "";
  kvMetadata.innerHTML = "";
  heuristicsList.innerHTML = "";
  [fileNameEl, fileSizeEl, durationEl, brandsEl, codecsEl, toolEl, deviceEl, scoreEl].forEach(el => el.textContent = "");
}

function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function renderStringsList(items){
  const lines = (items||[]).slice(0,5000).map(it=>`<div class="str" data-start="${it.start}" data-end="${it.end}">${escapeHtml(it.text)}</div>`);
  stringsOut.innerHTML = lines.join("\n");
  if (currentSearchQuery) performSearch(currentSearchQuery);
}
stringsOut.addEventListener("click", (e)=>{
  const el = e.target.closest(".str"); if(!el || !currentFile) return;
  const start = Number(el.dataset.start), end = Number(el.dataset.end);
  openRawAt(start, end);
});

function openRawAt(hlStart, hlEnd){
  const contextBefore = 512, contextAfter = 1536;
  const start = Math.max(0, hlStart - contextBefore);
  const end = Math.min(currentFile.size, hlEnd + contextAfter);
  currentFile.slice(start, end).arrayBuffer().then(buf=>{
    const u8 = new Uint8Array(buf);
    rawDump.innerHTML = hexDumpHTML(u8, start, hlStart, hlEnd);
    show(rawPanel);
    rawDump.scrollTop = 0;
  });
}
function hexDumpHTML(u8, base, hlStart, hlEnd){
  const isPrint = b => b>=32 && b<=126;
  let out = [];
  for(let i=0;i<u8.length;i+=16){
    const offs = (base + i).toString(16).padStart(8,'0');
    const bytes = [];
    const ascii = [];
    for(let j=0;j<16;j++){
      const idx=i+j; if(idx>=u8.length){ bytes.push("  "); ascii.push(" "); continue; }
      const b=u8[idx], pos=base+idx;
      const hx=b.toString(16).padStart(2,'0');
      const ch=isPrint(b)?String.fromCharCode(b):'.';
      const inHL = pos>=hlStart && pos<hlEnd;
      bytes.push(inHL?`<span class="hl">${hx}</span>`:hx);
      ascii.push(inHL?`<span class="hl">${escapeHtml(ch)}</span>`:escapeHtml(ch));
    }
    out.push(`${offs}  ${bytes.slice(0,8).join(" ")}  ${bytes.slice(8).join(" ")}  |${ascii.join("")}|`);
  }
  return out.join("\n");
}

function performSearch(q){
  currentSearchQuery = q;
  const els = [...stringsOut.querySelectorAll(".str")];
  els.forEach(el => el.classList.remove("current"));
  // reset highlights
  els.forEach(el => el.innerHTML = escapeHtml(el.textContent));
  searchMatches = [];
  if (!q){ updateSearchUI(); return; }
  const qEsc = escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re = new RegExp(qEsc, 'gi');
  els.forEach(el => {
    const esc = escapeHtml(el.textContent);
    if (re.test(esc)) {
      el.innerHTML = esc.replace(re, m=>`<span class="hl">${m}</span>`);
      searchMatches.push(el);
    }
  });
  searchIndex = searchMatches.length ? 0 : -1;
  gotoMatch(searchIndex);
  updateSearchUI();
}
function cycleMatch(dir){
  if (!searchMatches.length) return;
  searchIndex = (searchIndex + dir + searchMatches.length) % searchMatches.length;
  gotoMatch(searchIndex); updateSearchUI();
}
function gotoMatch(i){
  [...stringsOut.querySelectorAll(".str")].forEach(el=>el.classList.remove("current"));
  if (i<0 || i>=searchMatches.length) return;
  const el = searchMatches[i];
  el.classList.add("current");
  el.scrollIntoView({ block: "center", behavior: "smooth" });
}
function updateSearchUI(){
  searchCount.textContent = searchMatches.length ? `${searchIndex+1} / ${searchMatches.length}` : "0 / 0";
  const has = searchMatches.length>0;
  searchPrevBtn.disabled = !has; searchNextBtn.disabled = !has;
}