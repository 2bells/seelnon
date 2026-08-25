// opponent.js — bot definitions, persistence, and a state-machine "brain" that
// makes a bot feel human. Instead of playing the same solid move every time, a
// bot cycles through moods (solid / sloppy / locked-in / desperate), each
// lasting a few moves, and picks moves that fit the mood: sometimes the best
// move, sometimes a good-but-not-best one, sometimes a real blunder. Moods also
// react to the game — a bot that's winning tends to lock in, one that's losing
// gets desperate.

import { OPENINGS } from "./openings.js";

export const STYLES = {
  solid:      { label: "Solid",      base: { solid: 0.55, sloppy: 0.22, locked: 0.18, desperate: 0.05 } },
  aggressive: { label: "Aggressive", base: { solid: 0.25, sloppy: 0.22, locked: 0.33, desperate: 0.20 } },
  cautious:   { label: "Cautious",  base: { solid: 0.65, sloppy: 0.20, locked: 0.10, desperate: 0.05 } },
  tactical:   { label: "Tactical",  base: { solid: 0.30, sloppy: 0.38, locked: 0.22, desperate: 0.10 } },
  random:     { label: "Random",    base: { solid: 0.25, sloppy: 0.25, locked: 0.25, desperate: 0.25 } },
};

export const MOODS = {
  solid:     { label: "Solid",     offBest: 0.18, experiment: 0.40 },
  sloppy:    { label: "Sloppy",    offBest: 0.60, experiment: 0.60 },
  locked:    { label: "Locked in", offBest: 0.06, experiment: 0.15 },
  desperate: { label: "Desperate", offBest: 0.50, experiment: 0.85 },
};

const BOTS_KEY = "chessx.bots";
const ACTIVE_KEY = "chessx.activeBot";

function uid() { return "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export function defaultBot() {
  return {
    id: uid(), name: "New bot", elo: 1500, style: "solid",
    blunder: 15, aggression: 30, lockIn: 50, sloppy: 40,
    lockLen: 4, sloppyLen: 3, opening: true,
    pfp: "", desc: "", country: "", favOpening: "",
  };
}

export function loadBots() { try { const b = JSON.parse(localStorage.getItem(BOTS_KEY)); return Array.isArray(b) ? b : []; } catch { return []; } }
export function saveBots(bots) { localStorage.setItem(BOTS_KEY, JSON.stringify(bots)); }
export function getActiveBotId() { return localStorage.getItem(ACTIVE_KEY); }
export function setActiveBotId(id) { if (id) localStorage.setItem(ACTIVE_KEY, id); else localStorage.removeItem(ACTIVE_KEY); }
export function findBot(bots, id) { return bots.find((b) => b.id === id) || null; }

/* ---- opening book ---- */
function isPrefix(prefix, arr) {
  if (prefix.length > arr.length) return false;
  for (let i = 0; i < prefix.length; i++) if (prefix[i] !== arr[i]) return false;
  return true;
}
// Given the moves played so far (SAN), return the next book move (SAN) if the
// game is still in a known opening line, else null.
export function bookMove(moveRows) {
  const seq = moveRows.map((m) => m.san);
  let best = null;
  for (const o of OPENINGS) {
    const line = o[3];
    if (line.length > seq.length && isPrefix(seq, line)) {
      if (!best || line.length > best.length) best = line;
    }
  }
  return best ? best[seq.length] : null;
}

/* ---- brain ----
   The engine is a calm, stable Stockfish. The personality knobs are the angel
   and the devil whispering from its shoulders — every value is a SUGGESTION
   that gets rolled as a die around it, never injected verbatim:
     - lock-in (angel): how often it settles down and plays its best, solid
       chess. A rolled 30 means it locks in anywhere from 15–45.
     - sloppy (devil): how often it loosens up and gambles. Rolls around value.
     - blunder (devil): when the devil is loud, how readily it just shoves some
       random piece. Rolls around value.
     - aggression (devil): how "experimental" a move it tries — wider picks can
       turn brilliant OR hang material. Rolls around value.
     - window lengths are suggestions too: a 5 is really a 3–7 stretch.
   One die roll is drawn at the START of each window, so a whole stretch of
   moves shares the same rolled personality — that's the "a few moves long"
   character, not a fresh stat every move. */
function dice(center, jitter = 0.5) {
  const v = center + (Math.random() * 2 - 1) * center * jitter;
  return Math.max(0, v);
}
function diceInt(center, spread) {
  return Math.max(1, Math.round(center - Math.random() * spread));
}

// Under the hood each move is decided between the angel and the devil: the
// angel votes for a solid, near-best move; the devil votes for a wild gambit or
// a plain blunder. Their roll is weighted by the current mood + personality.
function rollMood(bot, evalScore, used) {
  const d = { ...STYLES[bot.style].base };
  const lock = dice(bot.lockIn), sloppy = dice(bot.sloppy);
  d.locked += (lock / 100) * 0.5;
  d.sloppy += (sloppy / 100) * 0.5;
  d.solid += (lock / 100) * 0.15;
  // The game whispers too: winning -> angel takes over, losing -> devil.
  if (evalScore > 1.2) d.locked += 0.25;
  else if (evalScore < -1.2) { d.desperate += 0.2; d.sloppy += 0.15; }
  for (const k in d) d[k] = Math.max(0, d[k]);
  // The sloppy window is a one-shot: the player gets one chance to punish it,
  // then the devil is done gambling for the whole game. Shut its weight off so
  // we never bounce back into sloppiness ("up and down a lot").
  if (used.sloppy) d.sloppy = 0;
  const total = d.solid + d.sloppy + d.locked + d.desperate;
  let r = Math.random() * total;
  for (const k of ["solid", "sloppy", "locked", "desperate"]) { r -= d[k]; if (r <= 0) return k; }
  return "solid";
}
function windowLen(bot, mood) {
  // Windows only ever shrink from the set value (5 gives 3-5, 7 gives 5-7) —
  // a long sloppy/locked stretch of 7+ could win or lose an entire game, so
  // the set number is a ceiling, not a target.
  if (mood === "locked") return Math.max(2, diceInt(bot.lockLen, 2));
  if (mood === "sloppy") return Math.max(2, diceInt(bot.sloppyLen, 2));
  return 2 + Math.floor(Math.random() * 2);
}
function weightedPick(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
  return weights.length - 1;
}
function randomBlunder(legalMoves, best) {
  if (!legalMoves || !legalMoves.length) return null;
  const pool = best ? legalMoves.filter((m) => m !== best) : legalMoves;
  if (!pool.length) return best;
  return pool[Math.floor(Math.random() * pool.length)];
}
// The devil picks among the engine's MultiPV alternatives. Wider (higher
// aggression / sloppier mood) -> reaches further from best, so a pick can be a
// great experiment or a dud. Kept to the engine's top alternatives so it never
// picks something outright illegal.
function pickFromLines(bot, mood, lines, low) {
  const n = Math.min(lines.length, 4);
  if (n === 0) return null;
  const aggr = dice(bot.aggression) / 100;
  const offBest = Math.min(0.92, mood.offBest + aggr * 0.45 + low * 0.3);
  const weights = [];
  for (let i = 0; i < n; i++) {
    let w = i === 0 ? 1 - offBest : offBest / (n - 1);
    if (i > 0 && Math.random() < aggr) w += 0.25;
    weights.push(Math.max(0.05, w));
  }
  return lines[weightedPick(weights)].pv[0];
}

export function createBrain(bot) {
  // Below Stockfish's UCI_Elo floor (~1320) the engine clamps, so scale up the
  // devil's volume to keep genuinely weak bots weak.
  const low = Math.max(0, (1320 - bot.elo) / 1320);
  // How devastating a blunder this bot can afford to make. Runs 0 at ~1350 up to
  // 1 at ~1600: above that strength the bot never hangs whole pieces — sloppy
  // stops meaning "shove the queen" and becomes plain inaccuracy instead. A
  // (1 - strength) multiplier dries the big-random-blunder path out entirely.
  const strength = Math.min(1, Math.max(0, (bot.elo - 1350) / 250));
  const blunderMult = 1 - strength;
  let mood = "solid";
  let moodLeft = 0;
  let prevEval = null;
  // One-shot flags: the player gets exactly ONE sloppy window and ONE big
  // blunder per game, so the bot isn't careening up and down the whole time.
  const used = { sloppy: false, blunder: false };
  const setMood = (m, len) => { mood = m; moodLeft = len; };
  return {
    mood: () => MOODS[mood].label,
    // lines: MultiPV search lines (best first). baseMove: fallback single move.
    // legalMoves: array of UCI strings. evalScore: from the bot's perspective
    // (positive = bot better). Returns a UCI move string or null.
    choose({ lines, baseMove, legalMoves, evalScore }) {
      evalScore = evalScore || 0;
      // REBOUND: the eval tells whether a stretch is backfiring. A bot that
      // starts bleeding material while sloppy panics and locks in ("omg, this is
      // bad"); one already far ahead gets cocky and loosens up ("not even
      // funny anymore"). A big swing cuts the current window short and flips the
      // mood on the spot — the character reacts to the game, not just to a dice.
      // The sloppy window is one-shot, so its rebound can only ever lock in, and
      // the game never bounces back into a second sloppy stretch.
      if (prevEval !== null && mood === "sloppy" && evalScore - prevEval < -2.0) {
        used.sloppy = true;
        setMood("locked", Math.max(2, diceInt(bot.lockLen, 2)));
      } else if (prevEval !== null && mood === "locked" && evalScore - prevEval > 2.0 && !used.sloppy) {
        setMood("sloppy", Math.max(2, diceInt(bot.sloppyLen, 2)));
      }
      prevEval = evalScore;

      // Draw the window's rolled personality once it's time for a new stretch.
      if (moodLeft <= 0) {
        const nm = rollMood(bot, evalScore, used);
        if (nm === "sloppy") used.sloppy = true;
        setMood(nm, windowLen(bot, nm));
      }
      moodLeft--;
      const m = MOODS[mood];

      // Devil's loudest suggestion: just move some random piece. Blunders get
      // weaker in "locked" windows and ride on the rolled blunder + sloppiness.
      // The whole path fades out for strong bots (blunderMult -> 0 above ~1600)
      // and can only fire ONCE per game (used.blunder). Above that a strong
      // bot's "off" moments still come from pickFromLines below — a slightly
      // suboptimal but sane engine line = an inaccuracy, never a hung queen.
      if (!used.blunder) {
        const devilBlunder = dice(bot.blunder) / 100 + (mood === "sloppy" ? 0.1 : 0) + (mood === "desperate" ? 0.15 : 0) + low * 0.2;
        if (Math.random() < Math.min(0.7, devilBlunder) * blunderMult) {
          const best = lines && lines.length ? lines[0].pv[0] : baseMove;
          const b = randomBlunder(legalMoves, best);
          if (b) { used.blunder = true; return b; }
        }
      }
      // Otherwise angel vs devil bid on which engine line to play.
      if (lines && lines.length) return pickFromLines(bot, m, lines, low);
      return baseMove || null;
    },
  };
}
