import { Chess } from "./chess.js";
import { weakMove } from "./weakengine.js";
import { explainMove } from "./learning.js";
import { identifyOpening } from "./openings.js";
import { createTester } from "./tester.js";

const $ = (id) => document.getElementById(id);
const boardEl = $("board"), movesEl = $("moves"), analysisEl = $("analysis");
const sideEl = document.querySelector(".side");
const statusEl = $("statustext"), statusBar = $("status"), rewindBtn = $("rewind"), livelineEl = $("liveline");
const eloS = $("elo"), eloV = $("eloval"), newBtn = $("newgame");
const promEl = $("promo");
const evFill = $("evfill"), evNum = $("evnum"), evBar = $("evbar");
const resBar = $("resumebar"), resumeBtn = $("resume"), liveBtn = $("wellive");
const menu = $("menu"), settingsBtn = $("settings"), menuClose = $("menuclose");
const colorPick = $("colorpick");
const tabMoves = $("tabmoves"), tabAnalysis = $("tabanalysis");
const arrowsSvg = $("arrows"), clearArrBtn = $("cleararr");
const spoilerBtn = $("spoiler"), spillockEl = $("spillock");
const dangerBtn = $("dangerbtn");
const learnEl = $("learn"), learnTitle = $("learnTitle"), learnBody = $("learnBody"),
      learnBoard = $("learnboard"), learnArrows = $("learnarrows"), learnClose = $("learnClose");

let arrows = [];
let arrowFrom = null;
let spoilerOn = localStorage.getItem("chessx.spoiler") !== "off";
let dangerOn = localStorage.getItem("chessx.danger") === "on";

/* ---------- sound ---------- */
let muted = localStorage.getItem("chessx.mute") === "on";
// Decoded audio buffers, played through Web Audio. Decoding into memory makes
// every sound instant (no re-fetching on first play, which is what made the
// first move sound laggy/drop with the old cloneNode approach).
const tracks = {};      // decoded AudioBuffer per sound key
const sound = (() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const gain = ctx.createGain();
  gain.gain.value = 0.6;
  gain.connect(ctx.destination);
  // Browsers keep the context suspended until a user gesture. Resume on the
  // first interaction so even the very first move has working audio.
  function resume() { if (ctx.state === "suspended") ctx.resume(); }
  window.addEventListener("click", resume, { once: true });
  window.addEventListener("keydown", resume, { once: true });
  return { ctx, gain };
})();

async function loadSfx() {
  const FILES = { move: "move", capture: "capture", check: "move-2", promote: "promote" };
  if (!sound) return;
  await Promise.all(Object.entries(FILES).map(async ([key, file]) => {
    try {
      const res = await fetch(`sfx/${file}.wav`);
      const buf = await res.arrayBuffer();
      tracks[key] = await sound.ctx.decodeAudioData(buf);
    } catch (e) { tracks[key] = null; }
  }));
}
function play(name) {
  if (muted || !sound || !tracks[name]) return;
  const src = sound.ctx.createBufferSource();
  src.buffer = tracks[name];
  src.connect(sound.gain);
  src.start();
}
function moveSound(mv) {
  if (mv.promotion) play("promote");
  else if (mv.captured) play("capture");
  else play("move");
  if (chess.inCheck()) play("check");
}

let playerColor = "w";
let engineColor = "b";
const CODES = ["wK", "wQ", "wR", "wB", "wN", "wP", "bK", "bQ", "bR", "bB", "bN", "bP"];

/* ---------- theme config ---------- */
const THEMES = {
  wooden: { name: "Wooden", light: "#e9cf9f", dark: "#a97650" },
  green: { name: "Green", light: "#ebecd0", dark: "#779556" },
  classic: { name: "Classic", light: "#f0d9b5", dark: "#b58863" },
  slate: { name: "Slate", light: "#cbd2da", dark: "#5a6472" },
};
const SETS = {
  staunty: {
    name: "Staunty",
    map: {
      w: [["#f0f0f0", "W_BODY"], ["#fff", "W_HL"], ["#3c3c3c", "W_STROKE"]],
      b: [["#5f5955", "B_BODY"], ["#fff", "B_HL"], ["#1e1e1e", "B_STROKE"]],
    },
  },
  merida: {
    name: "Merida",
    map: {
      b: [["#1f1a17", "B_BODY"]],
      w: [["#fff", "W_BODY"]],
    },
  },
  alpha: {
    name: "Alpha",
    map: {
      w: [["#f9f9f9", "W_BODY"], ["#101010", "W_STROKE"]],
      b: [["#101010", "B_BODY"], ["#f9f9f9", "B_HL"]],
    },
  },
};
const PALETTES = {
  wooden: { name: "Coffee",
    W_BODY: "#f4e7c8", W_HL: "#fff9ec", W_STROKE: "#3b2a20",
    B_BODY: "#3b2a20", B_HL: "#cba97b", B_STROKE: "#1d1610" },
  classic: { name: "Classic",
    W_BODY: "#ffffff", W_HL: "#f0f0f0", W_STROKE: "#4a4a4a",
    B_BODY: "#000000", B_HL: "#c9c9c9", B_STROKE: "#000000" },
  slate: { name: "Slate",
    W_BODY: "#f2f4f7", W_HL: "#ffffff", W_STROKE: "#333b46",
    B_BODY: "#232a33", B_HL: "#7b8899", B_STROKE: "#10141a" },
};

let themeName = localStorage.getItem("chessx.theme") || "wooden";
if (!THEMES[themeName]) themeName = "wooden";
let setName = localStorage.getItem("chessx.set") || "staunty";
if (!SETS[setName]) setName = "staunty";
let palName = localStorage.getItem("chessx.pal") || "wooden";
if (!PALETTES[palName]) palName = "wooden";
let rawCache = {};
for (const s of Object.keys(SETS)) { rawCache[s] = {}; }

// Side-aware recolor driven by each set's source colors -> palette targets.
// Works for filled AND outline-drawn pieces; every piece of a side gets a
// uniform body/highlight/outline from the palette.
function recolor(svg, set, pal, code) {
  if (!svg) return "";
  const map = SETS[set].map;
  const side = code.startsWith("w") ? "w" : "b";
  const pairs = map[side] || [];
  if (!pairs.length) return svg;
  // Single-pass replacement over the ORIGINAL string. Sequential split/join
  // would let a palette target color (e.g. #ffffff) be re-matched by a later
  // source (e.g. #fff) and corrupt the fill. Longest-first so a source that is
  // a prefix of another source wins.
  const sorted = pairs.slice().sort((a, b) => b[0].length - a[0].length);
  const re = new RegExp(sorted.map(([src]) => src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
  const lookup = new Map(sorted.map(([src, key]) => [src, pal[key]]));
  return svg.replace(re, (m) => lookup.get(m));
}

function pieceMarkup(code) {
  const raw = rawCache[setName][code];
  return raw ? recolor(raw, setName, PALETTES[palName], code) : "";
}

async function preloadSets() {
  const sets = Object.keys(SETS);
  await Promise.all(sets.map(async (set) => {
    await Promise.all(CODES.map(async (c) => {
      try { rawCache[set][c] = await fetch(`vendor/pieces/${set}/${c}.svg`).then((r) => r.text()); }
      catch (e) { rawCache[set][c] = ""; }
    }));
  }));
  render(); renderPreview();
}

function applyTheme() {
  const t = THEMES[themeName];
  document.documentElement.style.setProperty("--sq-light", t.light);
  document.documentElement.style.setProperty("--sq-dark", t.dark);
}
function refreshArts() { buildMenu(); renderPreview(); render(); renderEval(); }
function buildMenu() {
  const bo = $("boardopts");
  bo.innerHTML = Object.entries(THEMES).map(([k, t]) =>
    `<div class="optc ${themeName === k ? "on" : ""}" data-theme="${k}" title="${t.name}">` +
    `<div class="sw" style="background:${t.light}"></div><div class="sw" style="background:${t.dark}"></div></div>`
  ).join("");
  const po = $("pieceopts");
  po.innerHTML = Object.entries(SETS).map(([k, s]) =>
    `<button class="optbtn ${setName === k ? "on" : ""}" data-set="${k}">${s.name}</button>`
  ).join("");
  const pao = $("paletteopts");
  pao.innerHTML = Object.entries(PALETTES).map(([k, p]) =>
    `<button class="optbtn ${palName === k ? "on" : ""}" data-pal="${k}">${p.name}</button>`
  ).join("");
  bo.querySelectorAll("[data-theme]").forEach((el) => el.addEventListener("click", () => {
    themeName = el.dataset.theme; localStorage.setItem("chessx.theme", themeName);
    applyTheme(); refreshArts();
  }));
  po.querySelectorAll("[data-set]").forEach((el) => el.addEventListener("click", () => {
    setName = el.dataset.set; localStorage.setItem("chessx.set", setName);
    refreshArts();
  }));
  pao.querySelectorAll("[data-pal]").forEach((el) => el.addEventListener("click", () => {
    palName = el.dataset.pal; localStorage.setItem("chessx.pal", palName);
    refreshArts();
  }));
  renderPreview();
}
function renderPreview() {
  const pv = $("preview");
  pv.innerHTML = ["wK", "wQ", "wR", "wN", "wP", "bK", "bQ", "bR", "bN", "bP"]
    .map((c) => `<span class="pre">${pieceMarkup(c)}</span>`).join("");
}

/* ---------- state ---------- */
let chess = new Chess();
let engine = null;
let engineReady = false;
let thinking = false;
let gameOver = false;
let analyzing = false;
let moveRows = [];
let gameFens = [chess.fen()];
let viewIndex = 0;
let selected = null;
let legalTargets = [];
let currentCb = null;
let pendingPromo = null;
let gen = 0;
let posEvals = new Map();
let posHints = new Map();
let analysis = [];
// Last eval the bar actually displayed, so during a recalculation it stays put
// (no flicker back to neutral) until a fresh evaluation for this position lands.
let lastShownEval = null;

// Learn-panel replay: the Stockfish best continuation, clicked through on the
// mini board. cur===0 shows the position after the played move; cur>=1 steps
// into the engine line.
let learnReplay = { row: null, idx: 0, cur: 0, steps: [] };

const KCLASS = {
  brilliant: { n: "Brilliant", c: "k-bril" },
  best: { n: "Best", c: "k-best" },
  excellent: { n: "Excellent", c: "k-exc" },
  good: { n: "Good", c: "k-good" },
  inaccuracy: { n: "Inaccuracy", c: "k-acc" },
  mistake: { n: "Mistake", c: "k-mis" },
  blunder: { n: "Blunder", c: "k-blu" },
};

const isLive = () => viewIndex === gameFens.length - 1;

/* ---------- engine ---------- */
try {
  engine = new Worker("vendor/stockfish.js");
  engine.onmessage = (e) => { const cb = currentCb; if (cb) cb(String(e.data)); };
} catch (err) { statusEl.textContent = "Engine failed to load"; engine = null; }

function send(cmd) { if (engine) engine.postMessage(cmd); }
function waitFor(predicate, timeout = 60000, collect) {
  return new Promise((resolve, reject) => {
    if (!engine) return reject(new Error("no engine"));
    const prev = currentCb;
    const cb = (line) => {
      if (collect) collect(line);
      if (predicate(line)) { currentCb = prev; clearTimeout(timer); resolve(line); }
    };
    const timer = setTimeout(() => { if (currentCb === cb) currentCb = prev; reject(new Error("timeout")); }, timeout);
    currentCb = cb;
  });
}
function applyOptions() {
  send("setoption name Threads value 1");
  send("setoption name Hash value 32");
  send("setoption name MultiPV value 4");
  send("setoption name UCI_LimitStrength value true");
  send(`setoption name UCI_Elo value ${eloS.value}`);
  send("ucinewgame");
}
async function initEngine() {
  if (!engine) return;
  const u = waitFor((l) => l === "uciok", 30000); send("uci"); await u;
  applyOptions();
  const r = waitFor((l) => l === "readyok", 30000); send("isready"); await r;
  engineReady = true;
  updateStatus();
}

function parseInfo(line) {
  const tokens = line.split(/\s+/);
  let multipv = 1, stype = null, sval = null, pvStart = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === "multipv") multipv = +tokens[i + 1];
    else if (tokens[i] === "score") { stype = tokens[i + 1]; sval = +tokens[i + 2]; }
    else if (tokens[i] === "pv") { pvStart = i + 1; break; }
  }
  if (stype === null || sval === null || pvStart < 0) return null;
  const pv = tokens.slice(pvStart).filter(Boolean);
  if (!pv.length) return null;
  return { multipv, stype, sval, pv };
}

async function searchOnce(fen, depth, collect) {
  const lines = [];
  if (!engine) return lines;
  const pending = waitFor((l) => l.startsWith("bestmove"), 60000, (l) => {
    if (l.startsWith("info")) { const p = parseInfo(l); if (p) { const i = lines.findIndex((x) => x.multipv === p.multipv); if (i >= 0) lines[i] = p; else lines.push(p); } }
    if (collect) collect(l);
  });
  send("position fen " + fen);
  send("go depth " + depth);
  inflight++;
  try { await pending; } catch (e) {}
  inflight--;
  lines.sort((a, b) => a.multipv - b.multipv);
  return lines;
}
let searchLock = Promise.resolve();
let inflight = 0;
function enqueue(run) {
  const p = searchLock.then(run, run);
  searchLock = p.catch(() => {});
  return p;
}
function search(fen, { depth = 10, collect } = {}) {
  return enqueue(() => searchOnce(fen, depth, collect));
}

// Evaluate a position at FULL strength, ignoring the Elo limit. Used only for
// the accuracy/analysis "perfect line" reference so that the difficulty slider
// (UCI_Elo) never weakens the standard a player is measured against. Runs on
// the same serialized engine queue so it never interleaves with a weak search.
function strongSearch(fen, { depth = 12 } = {}) {
  return enqueue(async () => {
    send("setoption name UCI_LimitStrength value false");
    send("setoption name UCI_Elo value 3000");
    try { return await searchOnce(fen, depth); }
    finally {
      send("setoption name UCI_LimitStrength value true");
      send(`setoption name UCI_Elo value ${eloS.value}`);
    }
  });
}
function cancelEngine() { if (inflight > 0) send("stop"); }

function uciToMove(uci) { return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : null }; }
function uciToSan(fen, uci) {
  try { const c = new Chess(fen); const m = uciToMove(uci);
    const mv = m.promotion ? c.move({ from: m.from, to: m.to, promotion: m.promotion }) : c.move({ from: m.from, to: m.to });
    return mv.san; } catch (e) { const m = uciToMove(uci); return m.from + m.to; }
}
function scoreMapPos(lines) { return lines.length ? lines[0] : null; }
function scoreString(st) {
  if (!st) return "";
  if (st.stype === "mate") return (st.sval > 0 ? "+" : "") + "M" + Math.abs(st.sval);
  const c = st.sval / 100; return (c > 0 ? "+" : "") + c.toFixed(2);
}
// Share (0-100 %) of the bar owned by the + side of `st` — the player. The player
// fills from the bottom (their side). Mate scores pin to the extremes.
function playerPct(st) {
  if (st.stype === "mate") return st.sval > 0 ? 97 : 3;
  return Math.max(3, Math.min(97, 50 + (st.sval / 100) * 8));
}
// Re-express a Stockfish eval (relative to the side to move `to`) from the
// PLAYER's fixed point of view, returned as a fresh {stype, sval} object.
function toPlayerPov(st, to, player) {
  const same = to === player;
  if (st.stype === "mate") return { stype: "mate", sval: same ? st.sval : -st.sval };
  return { stype: st.stype, sval: same ? st.sval : -st.sval };
}

function matchesMove(line, mv) {
  const b = uciToMove(line.pv[0]);
  return b.from === mv.from && b.to === mv.to && (b.promotion || null) === (mv.promotion || null);
}
// Stockfish's `score cp` is reported from the side that is TO MOVE's point of
// view. advOf() converts an eval (whose reference side is `to`) into an
// advantage for `color`, so moves for White and Black are scored on equal terms.
// Mate scores are bound to ~3000 (highest numpy for a forced win) so that
// differences between strong moves stay human-sized instead of ±100000.
function advOf(st, to, color) {
  if (st.stype === "mate") {
    const cut = Math.abs(st.sval);
    const v = (st.sval > 0 ? 3000 - cut * 10 : -3000 + cut * 10);
    return to === color ? v : -v;
  }
  return to === color ? st.sval : -st.sval;
}
// Advantage of `mover` in the position it is about to move in (mover = to move).
function moverScore(st, mover) { return advOf(st, mover, mover); }

// Classic piece values in centipawns (100 = one pawn). The blunder/mistake/
// inaccuracy thresholds below anchor to real material rather than an opaque
// rating: a blunder means you gave a piece away, not that an engine disliked it.
const MAT = { p: 100, n: 320, b: 330, r: 500, q: 900 };

// Classify a played move from its centipawn loss vs the best line and whether
// it equalled the engine's best. Works even when the played move wasn't among
// the searched PV lines (its fallback loss is passed in), so a queen hang gets
// flagged as a blunder regardless of the engine's line list.
function classifyMove(best, loss, isBest, mover, lines, san) {
  if (!best) return null;
  if (isBest) {
    const bestN = moverScore(best, mover);
    const second = lines && lines[1];
    const edge = second ? bestN - moverScore(second, mover) : 500;
    // Only call a move Brilliant if it's a genuine non-obvious breakthrough.
    // A simple capture that just scoops up a piece the opponent hung is NOT
    // brilliant — it's the obvious punishment. Award Brilliant only when the
    // best move clearly outgains the next-best AND (for captures) the move
    // isn't winning purely by being an obvious free grab.
    const isCapture = san.includes("x");
    if (edge >= 120 && bestN >= 300 && !isCapture) return "brilliant";
    return "best";
  }
  if (loss == null) return "excellent";
  // Chess.com's centipawn-loss scale (looser than a strict piece-value cutoff):
  // losing up to ~a quarter-pawn is fine, an inaccuracy is roughly half-to-one
  // pawn, a mistake is over a pawn, and a blunder means forfeiting a whole piece.
  if (loss > MAT.p * 2.5) return "blunder";      // > 250 cp
  if (loss > MAT.p * 1.2) return "mistake";      // > 120 cp
  if (loss > MAT.p * 0.6) return "inaccuracy";   // > 60 cp
  if (loss > MAT.p * 0.25) return "good";        // > 25 cp
  return "excellent";
}

/* ---------- board ---------- */
function fenToPieces(fen) {
  const place = fen.split(" ")[0].split("/");
  const p = Array.from({ length: 8 }, () => new Array(8).fill(null));
  for (let r = 0; r < 8; r++) { let c = 0;
    for (const ch of place[r]) { if (/[0-9]/.test(ch)) c += +ch; else p[r][c++] = ch; } }
  return p;
}
function render() {
  const pieces = fenToPieces(gameFens[viewIndex]);
  const last = viewIndex > 0 ? moveRows[viewIndex - 1] : null;
  const flip = playerColor === "b";
  const danger = dangerOn ? dangerSquares(gameFens[viewIndex]) : null;
  renderCaptured(gameFens[viewIndex]);
  let html = "";
  for (let dr = 0; dr < 8; dr++) for (let dc = 0; dc < 8; dc++) {
    const r = flip ? 7 - dr : dr;
    const c = flip ? 7 - dc : dc;
    const rank = 8 - r, file = String.fromCharCode(97 + c), sq = file + rank;
    const dark = (r + c) % 2 === 1, pc = pieces[r][c];
    const isLast = last && (sq === last.from || sq === last.to);
    const isSel = selected === sq, isTarget = legalTargets.includes(sq);
    let cls = "sq " + (dark ? "dark" : "light") + (isLast ? " last" : "") + (isSel ? " selected" : "") +
      (danger && danger.has(sq) ? " danger" : "");
    let inner = "";
    if (isTarget) inner += '<div class="dot"></div>';
    if (pc) { const code = (pc === pc.toUpperCase() ? "w" : "b") + pc.toUpperCase();
      inner += `<span class="piece">${pieceMarkup(code)}</span>`; }
    let coord = "";
    if (c === 0) coord += `<span class="coord rk">${rank}</span>`;
    if (r === 7) coord += `<span class="coord fl">${file}</span>`;
    html += `<div class="${cls}" data-sq="${sq}">${coord}${inner}</div>`;
  }
  boardEl.innerHTML = html;
  boardEl.querySelectorAll(".sq").forEach((el) => el.addEventListener("click", () => onSquare(el.dataset.sq)));
  drawArrows();
}
/* Every square the opponent attacks in the given position, so you can see
   where a piece would be a free capture. */
function dangerSquares(fen) {
  const pos = new Chess(fen);
  const enemy = pos.turn() === "w" ? "b" : "w";
  const set = new Set();
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const sq = String.fromCharCode(97 + c) + (8 - r);
    if (pos.attackers(sq, enemy).length) set.add(sq);
  }
  return set;
}
function clearSel() { selected = null; legalTargets = []; }

/* Cute tray of the captured pieces, hugging the board's right edge. White's
   captures are black pieces it has taken, and vice versa. */
function renderCaptured(fen) {
  const place = fen.split(" ")[0];
  const count = { w: {}, b: {} };
  for (const ch of place) {
    if (ch === "/" || /[0-9]/.test(ch)) continue;
    const side = ch === ch.toUpperCase() ? "w" : "b";
    const type = ch.toUpperCase();
    count[side][type] = (count[side][type] || 0) + 1;
  }
  const start = { P: 8, N: 2, B: 2, R: 2, Q: 1, K: 1 };
  // capturedBy[s] = pieces of the OPPONENT that side took (so they render in
  // the opponent's color), biggest pieces first for a nice descending stack.
  const order = ["Q", "R", "B", "N", "P"];
  const line = (takers, taken) => {
    const code = (t) => (taken === "w" ? "w" : "b") + t;
    const got = order.map((t) => Math.max(0, start[t] - (count[taken][t] || 0)))
      .map((n, k) => Array(n).fill(code(order[k]))).flat();
    if (!got.length) return `<span class="empty">·</span>`;
    return got.map((c) => pieceMarkup(c)).join("");
  };
  const el = document.getElementById("captured");
  if (el) el.innerHTML =
    `<div class="caprow" title="Black has captured">${line("b", "w")}</div>` +
    `<div class="caprow" title="White has captured">${line("w", "b")}</div>`;
}

/* ---------- arrows (right-click) ---------- */
function sqXY(sq) {
  const col = sq.charCodeAt(0) - 97, row = 8 - +sq[1];
  let x = col + 0.5, y = row + 0.5;
  if (playerColor === "b") { x = 8 - x; y = 8 - y; }
  return [x, y];
}
function squareAt(el) {
  while (el && el !== boardEl) { if (el.dataset && el.dataset.sq) return el.dataset.sq; el = el.parentElement; }
  return null;
}
function arrowLine(from, to, cls) {
  const [x1, y1] = sqXY(from), [x2, y2] = sqXY(to);
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const px = -uy, py = ux;
  const sx = x1 + ux * 0.42, sy = y1 + uy * 0.42;
  const hl = 0.34, hw = 0.18, w = 0.08;
  const bx = x2 - ux * hl, by = y2 - uy * hl;
  const b1x = bx + px * hw, b1y = by + py * hw;
  const b2x = bx - px * hw, b2y = by - py * hw;
  const s1x = sx + px * w, s1y = sy + py * w;
  const s2x = sx - px * w, s2y = sy - py * w;
  const e1x = bx + px * w, e1y = by + py * w;
  const e2x = bx - px * w, e2y = by - py * w;
  const f = (n) => n.toFixed(3);
  const d = `M ${f(s1x)} ${f(s1y)} L ${f(e1x)} ${f(e1y)} L ${f(b1x)} ${f(b1y)} L ${f(x2)} ${f(y2)} L ${f(b2x)} ${f(b2y)} L ${f(e2x)} ${f(e2y)} L ${f(s2x)} ${f(s2y)} Z`;
  return `<path class="arrow ${cls || ""}" d="${d}" />`;
}
function drawArrows() {
  let html = "";
  for (const a of arrows) html += arrowLine(a.from, a.to, "");
  arrowsSvg.innerHTML = html;
  clearArrBtn.classList.toggle("hidden", arrows.length === 0);
}
function drawPreview(to) {
  const el = arrowsSvg.querySelector(".preview");
  if (!to || !arrowFrom) { if (el) el.remove(); return; }
  if (el) {
    const [x1, y1] = sqXY(arrowFrom), [x2, y2] = sqXY(to);
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    el.setAttribute("x1", x1 + dx / len * 0.42); el.setAttribute("y1", y1 + dy / len * 0.42);
    el.setAttribute("x2", x2); el.setAttribute("y2", y2);
    return;
  }
  const [x1, y1] = sqXY(arrowFrom), [x2, y2] = sqXY(to);
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  arrowsSvg.insertAdjacentHTML("beforeend",
    `<line class="arrow preview" x1="${(x1 + dx / len * 0.42).toFixed(3)}" y1="${(y1 + dy / len * 0.42).toFixed(3)}" x2="${x2.toFixed(3)}" y2="${y2.toFixed(3)}" />`);
}

function startArrow(sq) { if (!sq) return; arrowFrom = sq; }
function updateArrowFocus(target) {
  if (!arrowFrom) return;
  const sq = squareAt(target);
  drawPreview(sq && sq !== arrowFrom ? sq : null);
}
function endArrow(target) {
  const sq = squareAt(target);
  if (arrowFrom && sq && sq !== arrowFrom) arrows.push({ from: arrowFrom, to: sq });
  else if (arrowFrom) { arrows = []; }
  arrowFrom = null;
  drawPreview(null);
  drawArrows();
}

function onSquare(sq) {
  if (!tester.isOn()) {
    if (!engineReady || thinking || analyzing || gameOver || !isLive()) { clearSel(); render(); return; }
  }
  if (pendingPromo) { pendingPromo = null; promEl.classList.add("hidden"); }
  if (selected && selected === sq) { clearSel(); render(); return; }
  const piece = chess.get(sq);
  if (selected && legalTargets.includes(sq)) { playMove(selected, sq, null); return; }
  // In test mode the player controls both sides, so any piece is draggable at
  // any time. Otherwise only the player's own pieces on their own turn.
  if (piece && (tester.isOn() || (piece.color === playerColor && chess.turn() === playerColor))) {
    selected = sq; legalTargets = chess.moves({ square: sq, verbose: true }).map((m) => m.to); render(); return;
  }
  clearSel(); render();
}

function isPromotion(from, to) { const p = chess.get(from); if (!p || p.type !== "p") return false;
  return (p.color === "w" && to[1] === "8") || (p.color === "b" && to[1] === "1"); }

function playMove(from, to, prom) {
  if (!tester.isOn() && (gameOver || thinking || !engineReady)) return;
  if (!prom && isPromotion(from, to)) { pendingPromo = { from, to }; promEl.classList.remove("hidden"); return; }
  let mv;
  try { mv = prom ? chess.move({ from, to, promotion: prom }) : chess.move({ from, to }); }
  catch (e) { clearSel(); render(); return; }
  moveSound(mv);
  moveRows.push({ from: mv.from, to: mv.to, san: mv.san, promotion: mv.promotion || null });
  gameFens.push(chess.fen());
  viewIndex = moveRows.length;
  clearSel(); render(); renderMoves(); renderAnalysis(); updateStatus(); renderResume();
  if (tester.isOn()) tester.afterMove(); else afterPlayerMove();
}
function afterPlayerMove() {
  if (chess.isGameOver()) { gameOver = true; thinking = false; updateStatus(); renderResume(); finalizeAnalysis(); return; }
  const i = moveRows.length - 1;
  thinking = true;
  statusEl.textContent = "Analyzing your move…";
  analyzeIndex(i).then(() => {
    if (gameOver) return;
    const k = analysis[i] && analysis[i].klass;
    statusEl.textContent = k ? KCLASS[k].n + " move!" : "Opponent thinking…";
    renderMoves(); renderAnalysis(); renderEval();
    setTimeout(() => { if (!gameOver) engineMove(); }, 550);
  });
}

function engineMove() {
  const myGen = gen, fen = chess.fen();
  const elo = +eloS.value;
  thinking = true; updateStatus(); render();

  // Below Stockfish's UCI Elo floor (~1320) it clamps and plays ~the same
  // strength no matter how low you set it, so a purpose-built weak engine takes
  // over there. At/above 1320 real Stockfish plays the game.
  if (elo < 1320) {
    let chosen = null;
    try { chosen = weakMove(fen, elo); } catch (e) { chosen = null; }
    if (!chosen) { thinking = false; weakFallback(); return; }
    if (gen !== myGen || gameOver) { thinking = false; return; }
    thinking = false;
    applyChosen(chosen);
    return;
  }

  const inOpening = moveRows.length < 8;
  const depth = inOpening ? 14 : 12;
  search(fen, { depth }).then((lines) => {
    if (gen !== myGen || gameOver) { thinking = false; return; }
    if (lines.length) { posEvals.set(fen, lines[0]); posHints.set(fen, uciToSan(fen, lines[0].pv[0])); }
    let chosen = null;
    if (lines.length) {
      // Stockfish is Elo-limited via UCI_LimitStrength + UCI_Elo. Let it play
      // its own best move at that strength; the eval is later compared against
      // a full-strength reference for accuracy, so any real weakness the engine
      // has at this Elo shows up as honest inaccuracy instead of forced chaos.
      chosen = lines[0].pv[0];
    }
    thinking = false;
    if (!chosen) { return; }
    applyChosen(chosen);
  });
}

// Fallback if the weak engine can't produce a move: ask anyway via stockfish.
function weakFallback() {
  const inOpening = moveRows.length < 8;
  const depth = inOpening ? 14 : 12;
  search(chess.fen(), { depth }).then((lines) => {
    if (!lines.length) { thinking = false; return; }
    thinking = false;
    applyChosen(lines[0].pv[0]);
  });
}

function applyChosen(chosen) {
  const m = uciToMove(chosen);
  const myGen = gen;
  try { const mv = m.promotion ? chess.move({ from: m.from, to: m.to, promotion: m.promotion }) : chess.move({ from: m.from, to: m.to });
    moveSound(mv);
    moveRows.push({ from: mv.from, to: mv.to, san: mv.san, promotion: mv.promotion || null });
    gameFens.push(chess.fen()); viewIndex = moveRows.length; }
  catch (e) { thinking = false; return; }
  clearSel(); render(); renderMoves(); renderAnalysis(); renderResume();
  afterEngineMove();
}
function afterEngineMove() {
  if (chess.isGameOver()) { gameOver = true; updateStatus(); renderResume(); finalizeAnalysis(); return; }
  const i = moveRows.length - 1;
  analyzeIndex(i).then(() => {
    if (gameOver) return;
    updateStatus(); renderMoves(); renderAnalysis(); renderEval();
    refreshLive();
  });
}

async function refreshLive() {
  const myGen = gen, fen = gameFens[gameFens.length - 1];
  if (thinking || !engineReady || gameOver) return;
  if (posEvals.has(fen)) { renderEval(); renderHint(); return; }
  try {
    const lines = await search(fen, { depth: 11 });
    if (gen !== myGen) return;
    if (lines.length) { posEvals.set(fen, lines[0]); posHints.set(fen, uciToSan(fen, lines[0].pv[0])); }
  } catch (e) {}
  renderEval(); renderHint();
}

/* ---------- navigation / continue ---------- */
function viewAt(i) {
  viewIndex = i; clearSel(); render(); renderMoves(); renderAnalysis(); renderResume(); renderEval(); renderHint();
}

/* ---------- learn (second board) panel ---------- */
function miniBoardMarkup(fen, from, to) {
  const pieces = fenToPieces(fen);
  let html = "";
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const rank = 8 - r, file = String.fromCharCode(97 + c), sq = file + rank;
    const dark = (r + c) % 2 === 1, pc = pieces[r][c];
    const cls = "sq " + (dark ? "dark" : "light") +
      (sq === from ? " hl" : "") + (sq === to ? " hlto" : "");
    let inner = "";
    if (pc) { const code = (pc === pc.toUpperCase() ? "w" : "b") + pc.toUpperCase();
      inner += `<span class="piece">${pieceMarkup(code)}</span>`; }
    html += `<div class="${cls}">${inner}</div>`;
  }
  return html;
}
/* ---- learn (second board) panel ---- */

/* Build the clickable chip row for the current replay line (Stockfish or mate). */
function chipRowHTML() {
  const n = learnReplay.steps.length;
  let r = "";
  for (let k = 0; k < n; k++) {
    const s = learnReplay.steps[k];
    r += `<button class="lk" data-step="${k + 1}">${s.san}</button>`;
  }
  return r;
}

/* Wikibooks study resources, each tagged by the game phase it belongs to.
   "always" shows in every panel; "opening"/"middle"/"endgame" only in that
   phase. Pages are stable — no move-chasing, so the link always lands on a
   real, useful chapter. */
const WB_STUDY = [
  ["Tempo", "Chess/Tempo", "opening"],
  ["Chess Opening Theory", "Chess_Opening_Theory", "opening"],
  ["Tactics", "Chess/Tactics", "middle"],
  ["Tactics Exercises", "Chess/Tactics_Exercises", "middle"],
  ["Strategy", "Chess/Strategy", "middle"],
  ["Chess Strategy", "Chess_Strategy", "endgame"],
  ["Checkmates", "Chess/Checkmates", "endgame"],
  ["Endgame", "Chess/The_Endgame/King_and_Queen_vs._King", "endgame"],
];
const WB_BASE = "https://en.wikibooks.org/wiki/";
const wbUrl = (page) => WB_BASE + encodeURIComponent(page).replace(/%2F/g, "/");

/* The identified opening's theory — moves played so far vs still to come. */
function theoryRowHTML(theory) {
  if (!theory || !theory.moves || !theory.moves.length) return "";
  const from = theory.consumed || 0;
  const chips = theory.moves.map((m, k) =>
    `<span class="lk ty ${k < from ? "" : "fu"}">${m}</span>`).join(" ");
  return `<div class="lcap"><span>Theory · ${theory.name}</span></div><div class="lchips">${chips}</div>`;
}

/* A "keep studying" footer shown on every learn panel; the chips shown depend
   on the game state so the links match what you're working on right now. */
function studyRowHTML(ex) {
  const raw = ex && ex.phase ? ex.phase : "middlegame";
  const phase = raw === "endgame" ? "endgame" : raw === "opening" ? "opening" : "middle";
  const shown = WB_STUDY.filter(([, , w]) => w === phase);
  const chips = shown.map(([label, page]) =>
    `<a class="lk ty sbook" href="${wbUrl(page)}" target="_blank" rel="noopener">${label}</a>`).join("");
  return `<div class="lcap">More · Wikibooks <span class="dim">(${phase})</span></div><div class="lchips sres">${chips}</div>`;
}

/* Phase badge for the learn panel header. */
function phaseLabel(ex) {
  if (ex.phase === "opening") {
    const o = ex.opening;
    return o ? `Opening · ${o.eco} <span class="oname">${o.name}</span>` : "Opening";
  }
  if (ex.phase === "endgame") return "Endgame · <span class=\"oname\">checkmate showcase</span>";
  return "Middlegame · <span class=\"oname\">tactics</span>";
}

/* Rebuild the replay line's step list from a UCI PV. */
function buildReplay(pv, fen) {
  learnReplay.steps = [];
  if (!pv || !pv.length) return;
  const c = new Chess(fen);
  for (const u of pv) {
    const m = uciToMove(u);
    let mv;
    try { mv = m.promotion ? c.move({ from: m.from, to: m.to, promotion: m.promotion }) : c.move({ from: m.from, to: m.to }); }
    catch (e) { break; }
    learnReplay.steps.push({ san: mv.san, from: mv.from, to: mv.to, fen: c.fen() });
  }
}

/* Re-render the line chips/label and rebind after an async mate search. */
function renderLineUI() {
  const wrap = document.getElementById("linewrap");
  if (!wrap) return;
  const n = learnReplay.steps.length;
  const label = document.getElementById("llabel");
  if (label) label.textContent = learnReplay.label;
  const mem = document.getElementById("lmem");
  if (mem) mem.textContent = n ? `${n} plies` : "";
  wrap.innerHTML = `<button class="lvg" id="lprevx" data-way="-1">‹</button>` +
    `<div class="lchips scroll">${chipRowHTML()}</div>` +
    `<button class="lvg" id="lnextx" data-way="1">›</button>`;
  wrap.querySelectorAll(".lk[data-step]").forEach((el) =>
    el.addEventListener("click", () => replayStep(+el.dataset.step)));
  wrap.querySelectorAll(".lvg").forEach((el) =>
    el.addEventListener("click", () => replayStep(learnReplay.cur + (+el.dataset.way))));
  replayStep(0);
}

/* Move the learn mini-board to a replay step (0 = played move as played). */
function replayStep(cur) {
  const n = learnReplay.steps.length;
  learnReplay.cur = Math.max(0, Math.min(n, cur));
  renderLearnBoard();
  const cap = learnBody.querySelector(".lmem");
  if (cap) cap.textContent = n ? `${learnReplay.cur}/${n} plies` : "";
  const prev = document.getElementById("lprevx"), next = document.getElementById("lnextx");
  if (prev) prev.disabled = learnReplay.cur === 0;
  if (next) next.disabled = learnReplay.cur === n;
}

/* ------------------------------------------------ punishment (refutation)
   When the player misses (blunder/inaccuracy/mistake), the most instructive
   thing to show is the OPPONENT's punishment — the refutation that exploits
   the error. We analyse the position right after the played move and report
   where (and after how many moves) the damage lands. */
const PUN_MAT = { p: 1, n: 3, b: 3, r: 5, q: 9 };
function punMat(fen, color) {
  const board = fen.split(" ")[0];
  let s = 0;
  for (const ch of board) {
    const type = ch.toLowerCase();
    if (!(type in PUN_MAT)) continue;
    if ((ch === ch.toUpperCase() ? "w" : "b") === color) s += PUN_MAT[type];
  }
  return s;
}

/* Walk the opponent's continuation pv (opponent = side to move at startFen) and
   find the first decisive event: the opponent winning at least a minor piece,
   or checkmate. Returns { kinds, plies, gain } where plies = number of pv plies
   (moves after the played move) until it lands. */
function analyzePunishment(startFen, pv) {
  if (!pv || !pv.length) return null;
  const c = new Chess(startFen);
  const punisher = c.turn();
  const defender = punisher === "w" ? "b" : "w";
  const base = punMat(startFen, punisher) - punMat(startFen, defender);
  for (let k = 0; k < pv.length; k++) {
    const m = uciToMove(pv[k]);
    try { c.move({ from: m.from, to: m.to, promotion: m.promotion || "q" }); } catch (e) { break; }
    if (c.isCheckmate()) return { kind: "mate", plies: k + 1, gain: 0 };
    const gain = (punMat(c.fen(), punisher) - punMat(c.fen(), defender)) - base;
    if (gain >= 3) return { kind: "material", plies: k + 1, gain };
    if (k >= 15) break;
  }
  return { kind: "edge", plies: pv.length, gain: 0 };
}

function punishSummary(res, klass) {
  const moves = Math.ceil(res.plies / 2);
  const m = moves === 1 ? "move" : "moves";
  const label = (klass || "move").toLowerCase();
  if (res.kind === "mate") return `This ${label} is decisive: it allows a forced checkmate in ${moves} ${m}. Replay the line to see where it ends.`;
  if (res.kind === "material") return `This ${label} hands your opponent material in ${moves} ${m}. Replay the line to watch it land.`;
  return `This ${label} leaves the opponent with a clear upper hand. Replay the line to see how they press the advantage.`;
}

/* Redraw the learn mini board and chip highlights at the replay position. */
function renderLearnBoard() {
  const st = learnReplay.steps[learnReplay.cur - 1];
  if (st) {
    learnBoard.innerHTML = miniBoardMarkup(st.fen, st.from, st.to);
    learnArrows.innerHTML = arrowLine(st.from, st.to, "");
  } else {
    learnBoard.innerHTML = miniBoardMarkup(gameFens[learnReplay.idx], learnReplay.row.from, learnReplay.row.to);
    learnArrows.innerHTML = arrowLine(learnReplay.row.from, learnReplay.row.to, "");
  }
  const chips = learnBody.querySelectorAll(".lk[data-step]");
  for (const el of chips) el.classList.toggle("on", +el.dataset.step === learnReplay.cur);
}

async function openLearn(idx) {
  if (idx < 1 || idx > moveRows.length) return;
  const i = idx - 1;
  viewAt(idx);
  const row = moveRows[i];
  const a = analysis[i];
  const sans = moveRows.slice(0, idx).map((m) => m.san);
  const fen = gameFens[i];
  const best = a && a.best ? a.best : null;
  const klass = a && a.klass ? a.klass : null;
  const ex = explainMove(i, sans, fen, best, klass, row.san, playerColor);

  // A real miss (inaccuracy/mistake/blunder) is best learned from the opponent's
  // REFUTATION — how the error is punished — rather than the "better move" alone.
  // If there's a position after the played move that isn't already the end, we
  // show the punishment as the primary replay line (fetched async below).
  const isMiss = klass === "blunder" || klass === "mistake" || klass === "inaccuracy";
  const afterFen = gameFens[i + 1];
  const canPunish = isMiss && afterFen && !new Chess(afterFen).isGameOver();

  learnReplay = { row, idx, cur: 0, steps: [], label: canPunish ? "How it's punished" : (ex.phase === "endgame" ? "Checkmate line" : "Stockfish line") };

  // Default to the normal engine continuation; the endgame may replace it with
  // a dedicated forced-mate line once the search below finishes. A punishable
  // miss skips both and uses the opponent's refutation instead.
  let initialPv = null;
  if (!canPunish) {
    initialPv = (ex.phase === "endgame" && best && best.stype === "mate") ? best.pv : (best ? best.pv : null);
  }
  buildReplay(initialPv || [], fen);

  learnTitle.innerHTML = `${Math.floor(i / 2) + 1}${i % 2 === 0 ? "." : "…"} ${row.san}` +
    (klass ? ` <span class="kbad ${KCLASS[klass].c}">${KCLASS[klass].n}</span>` : "");

  let body = "";
  body += `<p class="ofirst">${phaseLabel(ex)}</p>`;

  if (canPunish) {
    body += `<div id="pmon" class="learn-op"><div class="oname">Where it bites</div><p class="odesc">Analysing the punishment…</p></div>`;
    if (a && a.bestSan) {
      body += `<div class="learn-op"><div class="oname">Instead, play ${a.bestSan}</div></div>`;
    }
  }

  if (ex.theory) {
    body += theoryRowHTML(ex.theory);
    if (ex.theory.plan) {
      body += `<div class="learn-op"><div class="oname">The plan</div><p class="odesc">${ex.theory.plan}</p></div>`;
    }
  }

  if (ex.tactics) {
    for (const t of ex.tactics) {
      body += `<div class="learn-op"><div class="oname">${t.tag}</div><p class="odesc">${t.text}</p></div>`;
    }
  }

  if (ex.endgame && !canPunish) {
    body += `<div id="matebox" class="learn-op"><div class="oname">Checkmate showcase</div>` +
      `<p class="odesc">Looking for a forced mate…</p></div>`;
  }

  body += studyRowHTML(ex);

  // Default line header shows only when a line already exists; for a punishable
  // miss the punishment line is filled in async, so always reserve the slot here
  // (otherwise the later async render has nothing to draw into).
  if (learnReplay.steps.length || canPunish) {
    body += `<div class="lcap"><span id="llabel">${learnReplay.label}</span><span class="lmem" id="lmem"></span></div>` +
      `<div class="lnav" id="linewrap"></div>`;
  }

  // "Chess wisdom" is always the very last section.
  if (ex.wisdom && ex.wisdom.length) {
    body += `<div class="lcap">Chess wisdom</div>`;
    for (const w of ex.wisdom) body += `<p class="odesc">${w}</p>`;
  }

  learnBody.innerHTML = body;
  renderLineUI();
  learnEl.classList.remove("hidden");

  // In the endgame, ask the engine for a forced-mate continuation and show it
  // as the "checkmate showcase" — how to finish with the pieces left.
  if (ex.endgame && !canPunish) {
    const box = document.getElementById("matebox");
    try {
      const lines = await strongSearch(fen, { depth: 20 });
      const top = lines[0];
      if (top && top.stype === "mate" && top.pv && top.pv.length) {
        learnReplay.label = `Checkmate in ${top.sval}`;
        buildReplay(top.pv, fen);
        renderLineUI();
        if (box) box.innerHTML = `<div class="oname">Checkmate showcase</div>` +
          `<p class="odesc">Forced mate in ${top.sval} — watch the line above.</p>`;
      } else if (box) {
        box.innerHTML = `<div class="oname">Checkmate showcase</div>` +
          `<p class="odesc">No forced mate in sight — accurate and steady play is enough here.</p>`;
      }
    } catch (e) {
      if (box) box.innerHTML = `<div class="oname">Checkmate showcase</div>` +
        `<p class="odesc">Could not analyse this position.</p>`;
    }
  }

  // For a miss, find the opponent's best refutation from the position AFTER the
  // played move — this is the punishment. Build it as the primary replay line
  // and tell the player where (and in how many moves) it lands.
  if (canPunish) {
    const box = document.getElementById("pmon");
    try {
      const lines = await strongSearch(afterFen, { depth: 16 });
      const top = lines && lines[0];
      if (top && top.pv && top.pv.length) {
        const res = analyzePunishment(afterFen, top.pv);
        learnReplay.label = "How it's punished";
        buildReplay(top.pv, afterFen);
        renderLineUI();
        // Proof: reshape the refutation's eval (which Stockfish reports from
        // the side to move = the opponent) onto the player's fixed view and
        // state who the line leaves ahead.
        const toMove = afterFen.split(" ")[1];
        const pSt = toPlayerPov(top, toMove, playerColor);
        let evTxt = pSt.stype === "mate"
          ? (pSt.sval > 0 ? "+" : "-") + "M" + Math.abs(pSt.sval)
          : (pSt.sval > 0 ? "+" : "") + (pSt.sval / 100).toFixed(2);
        const whom = pSt.sval > 0 ? "for you" : pSt.sval < 0 ? "for your opponent" : "even";
        if (box) box.innerHTML = `<div class="oname">Where it bites</div><p class="odesc">${punishSummary(res, klass)}</p>` +
          `<p class="odesc">Evaluation after the line: <b>${evTxt}</b> ${whom}.</p>`;
      } else if (box) {
        box.innerHTML = `<div class="oname">Where it bites</div><p class="odesc">Could not find a clear punishment.</p>`;
      }
    } catch (e) {
      if (box) box.innerHTML = `<div class="oname">Where it bites</div><p class="odesc">Could not analyse the punishment.</p>`;
    }
  }
}

function resumeFrom(i) {
  cancelEngine();
  gen++;
  chess = new Chess(gameFens[i]);
  moveRows = moveRows.slice(0, i);
  gameFens = gameFens.slice(0, i + 1);
  viewIndex = i;
  gameOver = false; analyzing = false; analysis = [];
  clearSel(); promEl.classList.add("hidden"); pendingPromo = null;
  render(); renderMoves(); renderAnalysis(); renderResume(); renderAccuracy(); updateStatus();
  if (chess.turn() === engineColor) engineMove(); else refreshLive();
}
function renderResume() {
  if (!isLive()) { resBar.classList.remove("hidden"); resumeBtn.disabled = thinking || analyzing; return; }
  resBar.classList.add("hidden");
}

// Take back the last move without re-running a full analysis: step the board
// back to just before the opponent's reply and reuse the existing per-move
// analysis for everything we keep. Returns to the player's turn so they can
// play again immediately.
function rewind() {
  if (tester.isOn() || thinking || analyzing || gameOver || !isLive()) return;
  if (moveRows.length === 0) return;
  cancelEngine(); gen++;
  const i = Math.max(0, moveRows.length - 2);
  chess = new Chess(gameFens[i]);
  moveRows = moveRows.slice(0, i);
  gameFens = gameFens.slice(0, i + 1);
  analysis = analysis.slice(0, i);
  viewIndex = i;
  gameOver = false; analyzing = false; thinking = false;
  clearSel(); promEl.classList.add("hidden"); pendingPromo = null;
  render(); renderMoves(); renderAnalysis(); renderResume(); renderAccuracy(); renderEval(); renderHint(); updateStatus();
  refreshLive();
}

/* ---------- analysis ---------- */
async function analyzeIndex(i) {
  if (analysis[i]) return analysis[i];
  const fen = gameFens[i];
  const mover = i % 2 === 0 ? "w" : "b";
  const lines = await strongSearch(fen, { depth: 14 });
  const best = lines[0] || null;
  let playedLine = null;
  if (lines.length) playedLine = lines.find((l) => matchesMove(l, moveRows[i])) || null;
  const bestSan = best ? uciToSan(fen, best.pv[0]) : null;
  let loss = null;
  let isBest = !!playedLine && best && playedLine.multipv === best.multipv;
  if (isBest) {
    loss = 0;
  } else if (best && playedLine) {
    // The played move is among the searched PV lines: its score comes directly
    // from the same search as the best, so the loss is exact (this is exactly
    // how chess.com measures a move).
    loss = Math.max(0, moverScore(best, mover) - moverScore(playedLine, mover));
  } else if (best) {
    // The played move wasn't good enough to appear in the PV at all (a real
    // blunder). Evaluate the position after the played move and convert back.
    const afterFen = gameFens[i + 1];
    try {
      const opponent = mover === "w" ? "b" : "w";
      const a = await strongSearch(afterFen, { depth: 14 });
      if (a[0]) loss = Math.max(0, moverScore(best, mover) - advOf(a[0], opponent, mover));
    } catch (e) { /* leave loss unknown rather than score it 100 */ }
  }
  const klass = classifyMove(best, loss, isBest, mover, lines, moveRows[i].san);
  analysis[i] = { best, playedLine, bestSan, klass, loss };
  if (best) posEvals.set(fen, best);
  if (bestSan) posHints.set(fen, bestSan);
  renderEval();
  return analysis[i];
}

async function finalizeAnalysis() {
  analyzing = true;
  renderAnalysis();
  const n = moveRows.length;
  for (let i = 0; i < n; i++) { if (!analysis[i]) await analyzeIndex(i); renderAnalysis(); }
  analyzing = false;
  posEvals.set(gameFens[n], terminalScore());
  renderAnalysis(); renderEval(); renderHint(); renderAccuracy();
  showTab("analysis");
}
function showTab(name) {
  const toAnalysis = name === "analysis";
  analysisEl.classList.toggle("hidden", !toAnalysis);
  movesEl.classList.toggle("hidden", toAnalysis);
  tabAnalysis.classList.toggle("active", toAnalysis);
  tabMoves.classList.toggle("active", !toAnalysis);
}
function terminalScore() {
  if (chess.isCheckmate()) return chess.turn() === "w" ? { stype: "mate", sval: -1 } : { stype: "mate", sval: 1 };
  return { stype: "cp", sval: 0 };
}

/* ---------- accuracy ---------- */
// Reverse-engineered Chess.com style accuracy from a move's centipawn loss.
function moveAccuracy(loss) {
  const v = 103.1668 * Math.exp(-0.004354 * loss) - 3.1669;
  return Math.max(0, Math.min(100, v));
}
function sideAccuracy(color) {
  let tot = 0, n = 0;
  for (let i = 0; i < moveRows.length; i++) {
    if ((i % 2 === 0 ? "w" : "b") !== color) continue;
    const a = analysis[i];
    if (!a || a.loss == null) continue;
    tot += moveAccuracy(a.loss); n++;
  }
  return n ? Math.round(tot / n) : null;
}
function renderAccuracy() {
  const bar = $("accbar");
  if (!bar) return;
  const done = gameOver && !analyzing && moveRows.length > 0;
  bar.classList.toggle("hidden", !done);
  if (!done) return;
  const mW = sideAccuracy("w"), mB = sideAccuracy("b");
  const you = playerColor === "w" ? mW : mB;
  const opp = playerColor === "w" ? mB : mW;
  $("accname1").textContent = playerColor === "w" ? "You" : "Opponent";
  $("accname2").textContent = playerColor === "w" ? "Opponent" : "You";
  setAccRow("1", you);
  setAccRow("2", opp);
}
function setAccRow(id, pct) {
  const fill = $("pt" + id), pctEl = $("accpct" + id);
  if (pct == null) { fill.style.width = "0%"; pctEl.textContent = "—"; return; }
  fill.style.width = pct + "%";
  pctEl.textContent = pct + "%";
}

function renderMoves() {
  let html = "", rowOpen = false;
  for (let i = 0; i < moveRows.length; i++) {
    const mv = moveRows[i];
    if (i % 2 === 0) { html += `<div class="mrow"><span class="mnum">${Math.floor(i / 2) + 1}.</span>`; rowOpen = true; }
    const kl = analysis[i] && analysis[i].klass;
    const badge = kl ? `<span class="kbad ${KCLASS[kl].c}">${KCLASS[kl].n}</span>` : "";
    html += `<span class="m ${viewIndex === i + 1 ? "cur" : ""}" data-keep="${i}">${mv.san}${badge}</span>`;
    if (i % 2 === 1) { html += "</div>"; rowOpen = false; }
  }
  if (rowOpen) html += "</div>";
  if (!moveRows.length) html = '<div class="mrow" style="color:var(--text-dim)">Make a move to begin.</div>';
  movesEl.innerHTML = html;
  movesEl.querySelectorAll(".m").forEach((el) => el.addEventListener("click", () => openLearn(+el.dataset.keep + 1)));
  if (isLive()) movesEl.scrollTop = movesEl.scrollHeight;
}

function renderAnalysis() {
  let html = "";
  for (let i = 0; i < moveRows.length; i++) {
    const row = analysis[i];
    const ev = row && row.best ? scoreString(row.best) : "…";
    const sideCls = i % 2 === 0 ? " wh" : " bl";
    let mark = "";
    if (row && row.klass) mark = `<span class="kbad ${KCLASS[row.klass].c}">${KCLASS[row.klass].n}</span>`;
    const sug = (row && row.bestSan && row.klass !== "best" && row.klass !== "brilliant")
      ? `<span class="sug">${row.bestSan}</span>` : "";
    const lossEl = (row && row.loss >= 25) ? `<span class="loss" title="±${Math.round(row.loss)} cp">±${Math.round(row.loss)}</span>` : "";
    const accel = (row && row.loss != null) ? `<span class="ma">${Math.round(moveAccuracy(row.loss))}</span>` : "";
    html += `<div class="analine ${viewIndex === i + 1 ? "cur" : ""}${sideCls}" data-keep="${i}">` +
      `<span class="num">${Math.floor(i / 2) + 1}${i % 2 === 0 ? "." : "…"}</span>` +
      `<span class="san">${moveRows[i].san}</span>` +
      `<span class="ev">${ev}</span>${accel}${lossEl}${mark}${sug}</div>`;
  }
  if (!html) html = '<div class="mrow" style="color:var(--text-dim)">Analysis appears as the game is played.</div>';
  analysisEl.innerHTML = html;
  analysisEl.querySelectorAll(".analine").forEach((el) => el.addEventListener("click", () => openLearn(+el.dataset.keep + 1)));
  if (isLive()) analysisEl.scrollTop = analysisEl.scrollHeight;
}

/* ---------- eval bar / hint ---------- */
function renderEval() {
  if (spoilerOn) { evNum.textContent = ""; evBar.classList.add("locked"); return; }
  evBar.classList.remove("locked");
  let sc = null;
  if (isLive() && gameOver) { sc = terminalScore(); }
  else if (analysis && analysis[viewIndex]) sc = analysis[viewIndex].best;
  else sc = posEvals.get(gameFens[viewIndex]) || null;
  const pal = PALETTES[palName];
  // Player always sits at the bottom of the board. The bar always measures the
  // position from the PLAYER's fixed perspective, so the shown value never flips
  // as the side to move alternates. The player's own color fills up from the
  // bottom: ahead -> it fills up, behind -> it drains to the top.
  const playerLight = playerColor === "w";
  evBar.classList.add("flip");
  evBar.style.background = playerLight ? pal.B_BODY : pal.W_BODY;
  evNum.style.color = pal.B_HL;
  const toMove = gameFens[viewIndex].split(" ")[1];
  let pSt;
  if (!sc) {
    // No fresh evaluation for this position yet (it's being recalculated). Keep
    // showing the previous value instead of snapping back to neutral each time.
    // lastShownEval is stored in player perspective, so it's NOT re-negated for
    // the new side to move — otherwise the bar would flip every move.
    if (lastShownEval) { pSt = lastShownEval; }
    else { evFill.style.background = pal.W_BODY; evFill.style.height = "50%"; evNum.textContent = ""; return; }
  } else {
    pSt = toPlayerPov(sc, toMove, playerColor);
  }
  evFill.style.background = playerLight ? pal.W_BODY : pal.B_BODY;
  evFill.style.height = playerPct(pSt) + "%";
  evNum.textContent = scoreString(pSt);
  lastShownEval = pSt;
}
function renderHint() {
  if (spoilerOn) { livelineEl.classList.add("locked"); return; }
  const show = (isLive() && !gameOver) && (tester.isOn() || (!thinking && chess.turn() === playerColor));
  const hint = posHints.get(gameFens[viewIndex]);
  if (show && hint) { livelineEl.innerHTML = `Engine suggests <b>${hint}</b>`; livelineEl.classList.remove("hidden"); }
  else livelineEl.classList.add("hidden");
}

/* ---------- status ---------- */
function updateStatus() {
  if (!engineReady) { statusEl.textContent = "Starting opponent…"; rewindBtn.classList.add("hidden"); return; }
  if (gameOver) {
    if (chess.isCheckmate()) statusEl.textContent = chess.turn() === playerColor ? "Checkmate — you lost" : "Checkmate — you won";
    else if (chess.isStalemate()) statusEl.textContent = "Stalemate — draw";
    else if (chess.isInsufficientMaterial()) statusEl.textContent = "Draw — insufficient material";
    else if (chess.isThreefoldRepetition()) statusEl.textContent = "Draw — repetition";
    else if (chess.isDraw()) statusEl.textContent = "Draw — 50-move rule";
    else statusEl.textContent = "Game over";
    rewindBtn.classList.add("hidden");
    return;
  }
  if (thinking) { statusEl.textContent = "Opponent thinking…"; updateRewind(); return; }
  if (chess.turn() === playerColor) statusEl.textContent = chess.inCheck() ? "Your move — check!" : "Your move";
  else statusEl.textContent = "Opponent thinking…";
  updateRewind();
}

// Show the take-back arrow while it's the player's move and there's something
// to take back. Hidden in test mode (which has its own Reset) and while the
// engine is thinking or the game is over.
function updateRewind() {
  const on = !tester.isOn() && !gameOver && !thinking && !analyzing &&
    isLive() && chess.turn() === playerColor && moveRows.length > 0;
  rewindBtn.classList.toggle("hidden", !on);
}

/* ---------- controls ---------- */
eloS.addEventListener("input", () => { eloV.textContent = eloS.value; if (engine) send(`setoption name UCI_Elo value ${eloS.value}`); });
newBtn.addEventListener("click", () => colorPick.classList.remove("hidden"));
settingsBtn.addEventListener("click", () => menu.classList.toggle("hidden"));
menuClose.addEventListener("click", () => menu.classList.add("hidden"));
learnClose.addEventListener("click", () => learnEl.classList.add("hidden"));
resumeBtn.addEventListener("click", () => { if (!thinking && !analyzing) resumeFrom(viewIndex); });
rewindBtn.addEventListener("click", rewind);
liveBtn.addEventListener("click", () => viewAt(gameFens.length - 1));
tabMoves.addEventListener("click", () => showTab("moves"));
tabAnalysis.addEventListener("click", () => showTab("analysis"));
promEl.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
  promEl.classList.add("hidden"); if (pendingPromo) { const { from, to } = pendingPromo; pendingPromo = null; playMove(from, to, b.dataset.p); }
}));
$("pickclose").addEventListener("click", () => colorPick.classList.add("hidden"));
$("pickw").addEventListener("click", () => { colorPick.classList.add("hidden"); startGame("w"); });
$("pickb").addEventListener("click", () => { colorPick.classList.add("hidden"); startGame("b"); });
$("pickr").addEventListener("click", () => { colorPick.classList.add("hidden"); startGame(Math.random() < 0.5 ? "w" : "b"); });

/* ---- arrows: right-click draws arrows (native context menu muted) ---- */
boardEl.addEventListener("contextmenu", (e) => e.preventDefault());
boardEl.addEventListener("mousedown", (e) => {
  if (e.button === 2) { e.preventDefault(); startArrow(squareAt(e.target)); }
});
boardEl.addEventListener("mousemove", (e) => updateArrowFocus(e.target));
boardEl.addEventListener("mouseup", (e) => { if (e.button === 2) endArrow(e.target); });
boardEl.addEventListener("mouseleave", () => { if (arrowFrom) drawPreview(null); });
clearArrBtn.addEventListener("click", () => { arrows = []; drawArrows(); });

/* ---- spoiler toggle ---- */
function applySpoiler() {
  evBar.classList.toggle("locked", spoilerOn);
  movesEl.classList.toggle("locked", spoilerOn);
  analysisEl.classList.toggle("locked", spoilerOn);
  livelineEl.classList.toggle("locked", spoilerOn);
  spillockEl.classList.toggle("hidden", !spoilerOn);
  spoilerBtn.classList.toggle("on", spoilerOn);
  spoilerBtn.textContent = spoilerOn ? "🔒 Spoilers" : "🔓 Spoilers";
  renderEval();
}
spoilerBtn.addEventListener("click", () => {
  spoilerOn = !spoilerOn;
  localStorage.setItem("chessx.spoiler", spoilerOn ? "on" : "off");
  applySpoiler();
});

/* ---- danger (attacked-square) toggle ---- */
function applyDanger() {
  dangerBtn.classList.toggle("on", dangerOn);
  render();
}
dangerBtn.addEventListener("click", () => {
  dangerOn = !dangerOn;
  localStorage.setItem("chessx.danger", dangerOn ? "on" : "off");
  applyDanger();
});

function startGame(color) {
  if (tester.isOn()) tester.stop();
  cancelEngine();
  gen++;
  playerColor = color;
  engineColor = color === "w" ? "b" : "w";
  chess = new Chess();
  moveRows = []; gameFens = [chess.fen()]; viewIndex = 0;
  gameOver = false; analyzing = false; analysis = []; thinking = false;
  arrows = []; arrowFrom = null; drawArrows();
  clearSel(); promEl.classList.add("hidden"); pendingPromo = null;
  render(); renderMoves(); renderAnalysis(); renderResume(); renderAccuracy(); renderEval(); renderHint(); updateStatus();
  if (engineColor === "w") { engineMove(); }
}

function newGame() { startGame(playerColor); }

/* The board's height (a square) should dictate the side panel's height. When
   the move/analysis list is longer than the board, the side must scroll
   instead of stretching the whole layout (which would also stretch the eval
   bar). Watch the board's real rendered size and keep the side capped to it —
   re-syncing whenever the board actually changes size. */
function syncSideHeight() {
  const h = boardEl.offsetHeight;
  if (h > 0) sideEl.style.maxHeight = h + "px";
}
if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(() => requestAnimationFrame(syncSideHeight)).observe(boardEl);
} else {
  window.addEventListener("resize", syncSideHeight);
}
syncSideHeight();

/* ---- mute toggle ---- */
function applyMute() {
  const icon = $("muteicon"), label = $("mutelabel");
  icon.textContent = muted ? "🔇" : "🔊";
  label.textContent = muted ? "Off" : "On";
  $("mutebtn").classList.toggle("on", !muted);
}
$("mutebtn").addEventListener("click", () => {
  muted = !muted;
  localStorage.setItem("chessx.mute", muted ? "on" : "off");
  applyMute();
});

/* ---- test mode controller ---- */
// The board's working area, seeded from a FEN: used both when entering test
// mode and when resetting it, to start (again) from the chosen position.
function setWorking(fen) {
  cancelEngine(); gen++;
  chess = new Chess(fen);
  moveRows = []; gameFens = [chess.fen()]; viewIndex = 0;
  gameOver = false; analyzing = false; analysis = []; thinking = false;
  arrows = []; arrowFrom = null; drawArrows();
  clearSel(); promEl.classList.add("hidden"); pendingPromo = null;
}
// Snapshot the real game so test mode can be put back exactly as found.
function testSnapshot() {
  return { fen: chess.fen(), moveRows: moveRows.slice(), gameFens: gameFens.slice(), viewIndex, gameOver, analysis: analysis.slice() };
}
function restoreTest(b) {
  cancelEngine(); gen++;
  chess = new Chess(b.fen);
  moveRows = b.moveRows; gameFens = b.gameFens; viewIndex = b.viewIndex;
  gameOver = b.gameOver; analysis = b.analysis; analyzing = false; thinking = false;
  arrows = []; arrowFrom = null; drawArrows();
  clearSel(); promEl.classList.add("hidden"); pendingPromo = null;
}
function renderAll() {
  render(); renderMoves(); renderAnalysis(); renderResume(); renderAccuracy();
  renderEval(); renderHint(); updateStatus();
}
function resumeTest() {
  if (gameOver || !engineReady) { updateStatus(); return; }
  if (chess.turn() === engineColor) engineMove(); else refreshLive();
  updateStatus(); renderHint();
}

const tester = createTester({
  testBtn: $("testtoggle"), resetBtn: $("testreset"),
  cancelEngine: () => { cancelEngine(); gen++; },
  snapshot: testSnapshot,
  setWorking, restoreTest, renderAll, resume: resumeTest,
  currentIndex: () => moveRows.length - 1,
  analyzeIndex, renderMoves, renderAnalysis, renderEval, refreshLive, updateStatus,
});

/* ---------- boot ---------- */
const loadingEl = $("loading"), loadingPieces = $("loadingpieces");
// Build the piece parade (pawn → … → king) so the loading screen visibly
// finishes building right as the board becomes fully interactive.
function showLoadingPieces() {
  loadingPieces.innerHTML = ["wP", "wN", "wB", "wR", "wQ", "wK"]
    .map((c, i) => `<span class="lpiece" style="animation-delay:${i * 130}ms">${pieceMarkup(c)}</span>`).join("");
}
function hideLoading() {
  loadingEl.classList.add("done");
  setTimeout(() => loadingEl.classList.add("hidden"), 480);
}
async function boot() {
  const sfxReady = loadSfx();
  applyTheme();
  buildMenu();
  eloV.textContent = eloS.value;
  render(); renderMoves(); renderAnalysis(); renderResume(); renderEval(); renderHint(); updateStatus();
  applySpoiler();
  applyDanger();
  applyMute();
  await Promise.all([sfxReady, preloadSets()].map((p) => Promise.resolve(p).catch(() => {})));
  showLoadingPieces();
  await initEngine();
  syncSideHeight();
  // Let the piece parade finish before sweeping the screen away.
  setTimeout(hideLoading, 1100);
}
boot();
