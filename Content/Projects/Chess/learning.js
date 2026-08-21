import { Chess } from "./chess.js";
import { identifyOpening, theoryOf } from "./openings.js";

const PIECE_DISP = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen" };

/* ====================================================== material & material */
function materialOf(fen) {
  const board = fen.split(" ")[0];
  let w = 0, b = 0, wp = 0, bp = 0;
  for (const ch of board) {
    if (ch === "P") wp++;
    else if (ch === "p") bp++;
    else if (ch === "N" || ch === "B") w += 3;
    else if (ch === "n" || ch === "b") b += 3;
    else if (ch === "R") w += 5;
    else if (ch === "r") b += 5;
    else if (ch === "Q") w += 9;
    else if (ch === "q") b += 9;
  }
  return { w, b, wp, bp, total: w + b };
}

function leadText(x) {
  if (x === 0) return "Material is level.";
  const side = x > 0 ? "White" : "Black";
  const a = Math.abs(x);
  if (a === 1) return `${side} is up a pawn.`;
  if (a === 2) return `${side} is up two pawns.`;
  if (a === 3) return `${side} is up a minor piece.`;
  if (a === 5) return `${side} is up the exchange.`;
  if (a === 9) return `${side} is up a queen.`;
  return `${side} is up ${a} points of material.`;
}

/* Which part of the game we're in. The opening lasts while play follows a
   named line AND for a short while of normal development; the endgame is
   decided by how little material remains. */
export function gamePhase(sans, fen) {
  const op = identifyOpening(sans);
  const m = materialOf(fen);
  const plies = sans.length;
  const endgame = m.total <= 15;
  let phase = "opening";
  if (endgame) phase = "endgame";
  else if (!(op && op.inBook) && plies > 22) phase = "middlegame";
  return { phase, opening: op ? op.opening : null, theory: op, material: m, plies };
}

/* ------------------------------------------------------ a little wisdom */
const OPENING_TIPS = [
  "Tempo: a 'free move' — if you develop while attacking the opponent's piece, you gain time while they lose a turn.",
  "Control the centre: e4/d4 are worth two moves. Your pieces gain speed toward the centre.",
  "A knight on the rim is dim: knights shine from central, outpost squares.",
  "Get the king safe: castle early. The castled king is guarded by a wall of pawns.",
  "Don't move the same piece twice in the opening without good reason — each repeat costs a tempo.",
  "A 'good' vs 'bad' bishop: a bishop blocked in by your own pawns is bad; keep your pawns off that diagonal.",
  "Develop every piece — a piece that never enters the game is nearly the same as having no piece at all.",
  "Each piece wants to move once and land well, not dart around: rapid, purposeful development beats clever dithering.",
  "Knights before bishops in the opening: get the minor pieces out, then bring the heavy pieces.",
  "Don't move the same piece twice in the opening — it is a small tempo advantage that compounds move by move.",
  "Ready the king to castle before you think about opening a wing.",
  "Connect your rooks early; when they see each other you can fight over the open files.",
  "Avoid moving your queen out early — as an only attacker she becomes a target the opponent can develop against.",
  "Every pawn move is a the king's long-term safety signature: push the centre, don't touch the pawns in front of the castled king unless the attack asks.",
  "If you can develop a piece while attacking the opponent's development, you gain a free move — prefer it over a quiet developing move.",
  "Every pawn move leaves a permanent mark on the position: push the centre, but leave the pawns in front of your castled king alone unless the attack wants them forward.",
];
const MIDDLE_TIPS = [
  "A fork: one piece (often a knight) attacks two pieces at once; the opponent cannot save both.",
  "A pin: a piece cannot move because that would expose a king (or a more valuable piece) behind it.",
  "A skewer: the valuable piece is in front; forced to move, you win the piece behind it.",
  "A discovered attack: shift a masking piece out of the way to reveal an attack it was hiding.",
  "Hanging piece: a defender-free piece — grab it if the trade is fair.",
  "A knight outpost: a knight planted on a square no pawn can attack is worth more than a bishop.",
  "Don't stare at the opponent's plans — the best way to win is to have your own course.",
  "When you trade, ask: is the exchange improving my position? If not, hold.",
  "Before every move, ask what your last piece is doing — if it can be ignored, something is wrong.",
  "Kill the opponent's best piece: if you can't take it, see if a cheap defender is pinned or overloaded and take that instead.",
  "Look for checks, captures, and threats first — the strongest moves nearly always begin with one.",
  "On the move, the first thing to check is whether the square you're going to is defended by the opponent.",
  "In a quiet position, look for the worst piece sitting on a good square and ask whether it wants to move again.",
  "Sacrifice is fine when it's a sound line: force the exchange that leaves you with the last recapture.",
  "When you consider a trade, count both sides' recaptures — the side that gets the last word usually profits.",
  "Lost a piece? Find the hidden defender before you grab; a queen attacker can be trapped.",
  "A doubled pawn is normally strong in front of the king's structure but weak off-centre: prefer opening the file where your rook sits.",
  "After every one of your moves, check your own king's safety before spending the tempo on something else.",
];
const ENDGAME_TIPS = [
  "The king becomes a fighting piece: bring it to the centre to support pawns and attack the enemy pawns.",
  "Opposition: when two kings face each other with one square between, the side to move is at a disadvantage.",
  "A passed pawn must be pushed (and supported). A far-advanced passed pawn decides the game.",
  "Rook endgame: a rook behind a passed pawn greatly strengthens it; activity is king.",
  "Trade pieces but not pawns when you are ahead — simplify to a won endgame.",
  "A draw: king + bishop vs king is not a win — you need a pawn or a rook.",
  "Passed pawns should be supported by your king and shielded from blocked rooks; give them a runway.",
  "When you're up a piece, trade pawns only if it clearly serves the win — every pawn keeps a chance.",
  "In a pawn race, count first: whoever queens first dictates the endgame.",
  "A lone rook is powerful, but a rook trapped in front of a pawn it cannot push is nearly worthless — get it behind the pawn.",
  "Square of the pawn: a passed pawn wins if the defending king can't step inside the square before it promotes.",
  "In king + pawn vs king, opposition decides: the side to move when the kings are opposed loses the key tempo.",
];

/* ============================================================ EXPLAIN MOVE
   Compile a structured lesson for the move at index i (0-based ply). */
export function explainMove(i, sans, fen, best, klass, playedSan, playerColor) {
  const mover = i % 2 === 0 ? "w" : "b";
  const myMove = mover === playerColor;
  const gp = gamePhase(sans, fen);
  const m = gp.material;
  const seed = i % Math.max(OPENING_TIPS.length, 1);

  const out = {
    phase: gp.phase,
    mover, myMove, klass, playedSan,
    opening: gp.opening || null,
    theory: null,
    plan: null,
    tactics: null,
    endgame: null,
    wisdom: [],
  };

  if (gp.phase === "opening") {
    if (gp.opening) {
      out.theory = theoryOf(gp.opening, sans);
      out.plan = gp.opening.plan || null;
    }
    out.wisdom = [OPENING_TIPS[(seed + i) % OPENING_TIPS.length]];
  }

  if (gp.phase === "middlegame") {
    out.tactics = [];
    out.wisdom = [MIDDLE_TIPS[(seed + i) % MIDDLE_TIPS.length], MIDDLE_TIPS[(seed + i + 1) % MIDDLE_TIPS.length]];
  }

  if (gp.phase === "endgame") {
    out.endgame = { mat: leadText(m.w - m.b) };
    out.wisdom = [ENDGAME_TIPS[(seed + i) % ENDGAME_TIPS.length], ENDGAME_TIPS[(seed + i + 1) % ENDGAME_TIPS.length]];
  }

  return out;
}

/* ============================================================== utility */
function capturedOf(fen, uci) {
  try {
    const c = new Chess(fen);
    const from = uci.slice(0, 2), to = uci.slice(2, 4);
    const promo = uci.length > 4 ? uci[4] : undefined;
    const mv = promo ? c.move({ from, to, promotion: promo }) : c.move({ from, to });
    return mv.captured || null;
  } catch (e) { return null; }
}

function toSan(fen, uci) {
  try {
    const c = new Chess(fen);
    const from = uci.slice(0, 2), to = uci.slice(2, 4);
    const promo = uci.length > 4 ? uci[4] : undefined;
    const mv = promo ? c.move({ from, to, promotion: promo }) : c.move({ from, to });
    return mv.san;
  } catch (e) { return uci; }
}