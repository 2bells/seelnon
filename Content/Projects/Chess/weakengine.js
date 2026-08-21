// Engine for the human 500-1320 range, where Stockfish's UCI_Elo floor (~1320)
// cannot go. Uses js-chess-engine — a real minimax engine whose strength is set
// by search depth (levels 1-5) plus a randomness knob. It never plays illegal
// moves and, unlike Stockfish's clamped floor, it genuinely plays weak when set
// so. Returns a legal UCI move string for the current position.
import { ai } from "./js-chess-engine.js";
import { Chess } from "./chess.js";

// Map an Elo to a js-chess-engine level (1=easiest .. 5=hardest) + randomness.
// Levels only span 1-5, so we bucket the range; low Elo also gets more
// randomness so it doesn't play the identical deterministic move every game.
function tune(rating) {
  if (rating < 700) return { level: 1, randomness: 60 };
  if (rating < 900) return { level: 2, randomness: 45 };
  if (rating < 1050) return { level: 3, randomness: 30 };
  if (rating < 1180) return { level: 4, randomness: 15 };
  return { level: 5, randomness: 0 };
}

export function weakMove(fen, rating) {
  try {
    const t = tune(rating);
    const result = ai(fen, { level: t.level, randomness: t.randomness });
    const move = result && result.move;
    if (!move) return null;
    const from = Object.keys(move)[0];
    const to = move[from];
    if (!from || !to) return null;
    let uci = from.toLowerCase() + to.toLowerCase();
    // js-chess-engine auto-promotes to queen; add the promotion flag so the
    // app's chess.js accepts it.
    const toRank = +to[1];
    if (toRank === 8 || toRank === 1) {
      try {
        const b = new Chess(fen);
        const p = b.get(from.toLowerCase());
        if (p && p.type === "p") uci += "q";
      } catch (e) { uci += "q"; }
    }
    return uci;
  } catch (e) {
    return null;
  }
}