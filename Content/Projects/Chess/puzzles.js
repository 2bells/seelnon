import CATALOG from "./puzzles-data.js";
import { Chess } from "./chess.js";

/* ---------- catalog ---------- */
let PUZZLES = CATALOG.slice();
const byId = new Map();
CATALOG.forEach((p) => byId.set(p.id, p));

const BUCKETS = [
  { key: "random", label: "r", random: true },
  { key: "all", label: "All", min: -Infinity, max: Infinity },
  { key: "400-1000", label: "400–1000", min: 400, max: 1000 },
  { key: "1000-1500", label: "1000–1500", min: 1000, max: 1500 },
  { key: "1500-2000", label: "1500–2000", min: 1500, max: 2000 },
  { key: "2000-2500", label: "2000–2500", min: 2000, max: 2500 },
  { key: "2500+", label: "2500+", min: 2500, max: Infinity },
];
let activeBucketKey = "all";
let viewCache = null, viewCacheKey = null;
function bucketOf(key) { return BUCKETS.find((b) => b.key === key); }
function view() {
  if (viewCacheKey === activeBucketKey) return viewCache;
  const b = bucketOf(activeBucketKey);
  if (!b || b.random) return [];
  viewCache = PUZZLES.filter((p) => p.rating >= b.min && p.rating < b.max);
  viewCacheKey = activeBucketKey;
  return viewCache;
}

export function catalog() { return view(); }
export function getPuzzle(i) { return view()[i] || null; }

/* ---------- completion ---------- */
const DONE_KEY = "chessx.puzzles.done";
const EXTRA_KEY = "chessx.puzzles.extra";
const done = new Set();
function load() {
  done.clear();
  try {
    const a = JSON.parse(localStorage.getItem(DONE_KEY) || "[]");
    if (Array.isArray(a)) a.forEach((id) => done.add(id));
  } catch (e) {}
}
function save() {
  try { localStorage.setItem(DONE_KEY, JSON.stringify([...done])); } catch (e) {}
}
load();
export function isDone(id) { return done.has(id); }
export function markDone(id) { done.add(id); save(); }
export function resetDone() { done.clear(); save(); return done.size; }

/* Restore API-fetched puzzles (ids) across reloads and swap them into the catalog. */
function loadExtra() {
  let ids = [];
  try { ids = JSON.parse(localStorage.getItem(EXTRA_KEY) || "[]"); } catch (e) {}
  return Array.isArray(ids) ? ids : [];
}
const extraTried = new Set(loadExtra());

/* ---------- solver hooks ---------- */
let startHandler = null;
export function setStartHandler(fn) { startHandler = fn; }

/* ---------- API: refresh / expand from lichess ---------- */
const API = "https://lichess.org/api/puzzle/daily";
export async function addDailyPuzzle() {
  try {
    const res = await fetch(API);
    if (!res.ok) return null;
    const j = await res.json();
    const p = j && j.puzzle;
    if (!p || !p.id || !Array.isArray(p.solution) || !p.fen) return null;
    const entry = { id: p.id, fen: p.fen, moves: p.solution, rating: p.rating || 0, themes: (p.themes || []).join(" ") };
    if (!byId.has(entry.id) && !extraTried.has(entry.id)) {
      PUZZLES.push(entry);
      byId.set(entry.id, entry);
      extraTried.add(entry.id);
      viewCacheKey = null; // the new puzzle may join the current bucket
      try { localStorage.setItem(EXTRA_KEY, JSON.stringify([...extraTried])); } catch (e) {}
      return entry;
    }
    return byId.get(entry.id) || null;
  } catch (e) {
    return null;
  }
}

/* Derive the puzzle-start FEN and the game history from a game PGN. The
   lichess `next` API gives `initialPly`, but its exact offset into the PGN is
   not consistent across puzzles, so we search a small window and accept the
   deepest replay depth where the WHOLE solution plays with alternating colors
   (opponent, solver, opponent, …). That replay point is the position BEFORE
   the opponent's setup move; `gameMoves` are the moves that led there, so the
   puzzle can show the full game leading into the tactic. */
function analyzeGame(pgn, ply, solution) {
  try {
    const src = new Chess();
    src.loadPgn(pgn);
    const all = src.history({ verbose: true });
    if (all.length < 2 || !solution || !solution.length) return null;
    const lo = Math.max(0, (ply | 0) - 6);
    const hi = Math.min(all.length, (ply | 0) + 10);
    let deepest = -1;
    for (let n = lo; n <= hi; n++) {
      const c = new Chess();
      for (let i = 0; i < n; i++) c.move(all[i].san);
      const turn = c.turn();
      const opp = turn === "w" ? "b" : "w";
      let valid = true;
      for (let ix = 0; ix < solution.length; ix++) {
        const want = ix % 2 === 0 ? turn : opp;
        const u = solution[ix];
        const from = u.slice(0, 2), to = u.slice(2, 4);
        const promo = u.length > 4 ? u[4] : undefined;
        let m;
        try { m = promo ? c.move({ from, to, promotion: promo }) : c.move({ from, to }); }
        catch (e) { valid = false; break; }
        if (m.color !== want) { valid = false; break; }
      }
      if (valid) deepest = n;
    }
    if (deepest < 0) return null;
    const c = new Chess();
    const gameMoves = [];
    for (let i = 0; i < deepest; i++) {
      c.move(all[i].san);
      gameMoves.push(all[i].from + all[i].to + (all[i].promotion || ""));
    }
    const fen = c.fen();
    if (!c.isGameOver() && /[rnbqkRNBQK]/.test(fen)) return { fen, gameMoves };
    return null;
  } catch (e) {
    return null;
  }
}

const RANDOM_API = "https://lichess.org/api/puzzle/next";
function randomButton() {
  return menuEl ? menuEl.querySelector('.pz-tab[data-k="random"]') : null;
}
/* Fetch one puzzle at random from lichess's full database and start it. */
async function startRandom() {
  const btn = randomButton();
  if (btn) { btn.classList.add("busy"); btn.textContent = "…"; }
  let entry = null;
  try {
    const res = await fetch(RANDOM_API);
    if (res.ok) {
      const j = await res.json();
      const p = j && j.puzzle;
      if (p && p.id && Array.isArray(p.solution) && p.solution.length && j.game && j.game.pgn) {
        const g = analyzeGame(j.game.pgn, p.initialPly, p.solution);
        if (g) entry = { id: p.id, fen: g.fen, gameMoves: g.gameMoves, moves: p.solution, rating: p.rating || 0, themes: (p.themes || []).join(" ") };
      }
    }
  } catch (e) {}
  if (!entry) {
    // Fallback: a random puzzle from the local catalog.
    const list = view();
    if (!list.length) return finish();
    entry = list[Math.floor(Math.random() * list.length)];
  }
  function finish() {
    if (btn) { btn.classList.remove("busy"); btn.textContent = "r"; }
    if (entry) { closeMenu(); if (startHandler) startHandler(entry); }
  }
  finish();
}

/* ---------- menu ---------- */
let menuEl = null, gridEl = null, scroller = null, headBar = null;
export const TILE = 54, GAP = 6;
let cols = 8, rows = 0, rendered = new Map();

function tileClick(i) {
  const p = getPuzzle(i);
  if (!p) return;
  closeMenu();
  if (startHandler) startHandler(p);
}

function cellHTML(i) {
  const p = getPuzzle(i);
  const ok = isDone(p.id);
  return `<button class="ptile${ok ? " done" : ""}" data-i="${i}" title="${p.themes} · ${p.rating}">
    <span class="ptile-num">${i + 1}</span>
    ${ok ? '<span class="ptile-check">✓</span>' : ""}
  </button>`;
}

function layout() {
  const w = scroller ? scroller.clientWidth : 400;
  // Cap at 10 columns so the grid is sized for what it actually shows (no
  // reserved space for an eleventh, empty block). Flex leaves the rest of the
  // panel width as breathing room on the right.
  cols = Math.max(4, Math.min(10, Math.floor((w - GAP * 3) / (TILE + GAP))));
  rows = Math.ceil(view().length / cols);
  if (gridEl) gridEl.style.width = (GAP + cols * (TILE + GAP)) + "px";
}

function renderVisible() {
  const list = view();
  const top = scroller.scrollTop;
  const vh = scroller.clientHeight;
  const band = TILE + GAP;
  // Size the virtual canvas to the full content height so the scroller works.
  gridEl.style.height = (GAP + rows * band) + "px";
  const first = Math.max(0, Math.floor(top / band) - 3);
  const last = Math.min(rows - 1, Math.ceil((top + vh) / band) + 3);
  const want = new Set();
  for (let r = first; r <= last; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (i < list.length) want.add(i);
    }
  }
  gridEl.innerHTML = "";
  // Center the final, partially-filled row so it never leaves an awkward empty
  // gap on the right.
  const countLast = list.length - (rows - 1) * cols;
  const lastOffset = countLast < cols ? Math.floor((cols - countLast) * (TILE + GAP) / 2) : 0;
  // Recompose the blank grid with absolute tiles.
  for (const i of want) {
    const r = Math.floor(i / cols), c = i % cols;
    const el = document.createElement("div");
    el.className = "ptile-wrap";
    el.style.left = (GAP + c * (TILE + GAP) + (r === rows - 1 ? lastOffset : 0)) + "px";
    el.style.top = (GAP + r * (TILE + GAP)) + "px";
    el.innerHTML = cellHTML(i);
    const b = el.firstElementChild;
    b.addEventListener("click", () => tileClick(+b.dataset.i));
    gridEl.appendChild(el);
  }
}

function renderBuckets() {
  const el = menuEl.querySelector("#puzzbuckets");
  el.innerHTML = BUCKETS.map((b) =>
    `<button class="pz-tab${b.key === activeBucketKey ? " on" : ""}${b.random ? " rand" : ""}" data-k="${b.key}"${b.random ? ' title="Random puzzle from Lichess"' : ""}>${b.label}</button>`).join("");
  el.querySelectorAll(".pz-tab").forEach((btn) => btn.addEventListener("click", () => {
    const k = btn.dataset.k;
    if (k === "random") { startRandom(); return; }
    activeBucketKey = k;
    viewCacheKey = null;
    if (scroller) scroller.scrollTop = 0;
    renderBuckets();
    renderMenuCounts();
    layout();
    renderVisible();
  }));
}

export function buildMenu() {
  // Simple flow: build the overlay once, append to body.
  menuEl = document.createElement("div");
  menuEl.className = "puzzmenu hidden";
  menuEl.innerHTML = `
    <div class="puzzmenu-in">
      <div class="puzzhead">
        <div class="puzz-title">Puzzles</div>
        <div class="puzz-count"><span id="puzzdone">0</span> / <span id="puzztotal">0</span>
          <button id="puzzreset" class="puzzreset" title="Clear progress">reset</button>
        </div>
        <button id="puzzclose" class="x">&times;</button>
      </div>
      <div class="puzzbuckets"><div id="puzzbuckets" class="puzzbuckets-in"></div></div>
      <div class="puzzscroller"><div class="puzzgrid"></div></div>
      <div class="puzzfoot">
        <span id="puzzapi" class="puzzapi"></span>
      </div>
    </div>`;
  document.body.appendChild(menuEl);
  scroller = menuEl.querySelector(".puzzscroller");
  gridEl = menuEl.querySelector(".puzzgrid");
  headBar = menuEl.querySelector(".puzzhead");
  renderBuckets();
  const close = menuEl.querySelector("#puzzclose");
  close.addEventListener("click", () => closeMenu());
  const reset = menuEl.querySelector("#puzzreset");
  reset.addEventListener("click", () => {
    if (confirm("Clear all solved-puzzle progress?")) {
      resetDone();
      if (menuEl && !menuEl.classList.contains("hidden")) openMenu(false);
      else renderMenuCounts();
    }
  });
  scroller.addEventListener("scroll", () => { layout(); renderVisible(); }, { passive: true });
  window.addEventListener("resize", () => { if (menuEl && !menuEl.classList.contains("hidden")) { layout(); renderVisible(); } });
}

export function renderMenuCounts() {
  const list = view();
  const total = menuEl ? menuEl.querySelector("#puzztotal") : null;
  const dnum = menuEl ? menuEl.querySelector("#puzzdone") : null;
  if (total) total.textContent = list.length;
  if (dnum) dnum.textContent = list.filter((p) => isDone(p.id)).length;
}

export function openMenu(refresh) {
  if (!menuEl) buildMenu();
  menuEl.classList.remove("hidden");
  renderMenuCounts();
  layout();
  renderVisible();
  if (refresh !== false) addDailyPuzzle(); // best-effort API expansion
  renderMenuCounts();
}
export function closeMenu() {
  if (menuEl) menuEl.classList.add("hidden");
}