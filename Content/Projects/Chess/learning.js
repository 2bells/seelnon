import { Chess } from "./chess.js";

const PIECE_NAME = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen" };

/* ---------------------------------------------------------------- openings
 * A small curated opening library keyed by standard algebraic move sequence.
 * `identifyOpening` matches the longest prefix against what has actually been
 * played, so we can say which opening you're in and whether the current move
 * is still theory. */
const OPENINGS = [
  { eco: "C60", name: "Ruy Lopez", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"],
    desc: "A classical open game where White pressures the e5 pawn and Black's knight with the bishop, aiming for long-term positional pressure." },
  { eco: "C50", name: "Italian Game", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"],
    desc: "White develops the bishop to the active c4 square, targeting f7 and preparing quick central and kingside play." },
  { eco: "C50", name: "Giuoco Piano", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"],
    desc: "The quiet Italian classic — both sides develop toward the center and the game often opens up with d4." },
  { eco: "C55", name: "Two Knights Defense", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"],
    desc: "Black develops actively, inviting sharp play where both knights occupy strong central squares." },
  { eco: "C45", name: "Scotch Game", moves: ["e4", "e5", "Nf3", "Nc6", "d4"],
    desc: "White opens the center immediately, aiming for quick piece activity and a lead in development." },
  { eco: "C42", name: "Petrov Defense", moves: ["e4", "e5", "Nf3", "Nf6"],
    desc: "Black mirrors White's knight to grab a pawn and enter a solid, slightly symmetric battle." },
  { eco: "C25", name: "Vienna Game", moves: ["e4", "e5", "Nc3"],
    desc: "White develops the knight first, keeping flexible central plans and the f2-f4 attacking idea in reserve." },
  { eco: "C30", name: "King's Gambit", moves: ["e4", "e5", "f4"],
    desc: "White offers a pawn to rip open the center and seize attacking chances against the black king." },
  { eco: "B20", name: "Sicilian Defense", moves: ["e4", "c5"],
    desc: "Black answers e4 with c5, fighting for the d4 square and creating a sharp, unbalanced game." },
  { eco: "B90", name: "Open Sicilian", moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4"],
    desc: "The main-line Sicilian — White opens the center for rapid development against Black's solid pawn structure." },
  { eco: "B30", name: "Sicilian Defense", moves: ["e4", "c5", "Nf3", "Nc6"],
    desc: "A flexible Sicilian where Black develops the knight before committing the d-pawn." },
  { eco: "B22", name: "Sicilian Defense (Alapin)", moves: ["e4", "c5", "c3"],
    desc: "White supports an immediate d4, trading sharpness for a solid, compact setup." },
  { eco: "B23", name: "Sicilian Defense (Closed)", moves: ["e4", "c5", "Nc3"],
    desc: "White avoids opening the center, keeping the pawn tension and steering toward a closed maneuvering game." },
  { eco: "B10", name: "Caro-Kann Defense", moves: ["e4", "c6"],
    desc: "Black prepares d5 with a solid pawn, building a strong but somewhat passive defensive structure." },
  { eco: "B15", name: "Caro-Kann Defense", moves: ["e4", "c6", "d4", "d5"],
    desc: "The characteristic Caro-Kann center — Black immediately challenges e4, aiming for a sound French-like structure without the light-squared bishop problem." },
  { eco: "C00", name: "French Defense", moves: ["e4", "e6"],
    desc: "Black plans d5, locking the center and playing for a solid but slightly passive position." },
  { eco: "C10", name: "French Defense", moves: ["e4", "e6", "d4", "d5"],
    desc: "The French center clash — White pushes d4, Black strikes at e4, and the game revolves around Black's blocked light-squared bishop." },
  { eco: "B01", name: "Scandinavian Defense", moves: ["e4", "d5"],
    desc: "Black immediately challenges the e4 pawn, taking the game out of prepared book lines." },
  { eco: "B02", name: "Alekhine's Defense", moves: ["e4", "Nf6"],
    desc: "Black provokes White's central pawns to advance, hoping to attack their overextension later." },
  { eco: "B06", name: "Modern Defense", moves: ["e4", "g6"],
    desc: "Black fianchettoes the king's bishop, playing a hypermodern game against White's big center." },
  { eco: "D00", name: "Queen's Pawn Game", moves: ["d4", "d5"],
    desc: "A closed game where both sides commit their central pawns and the play is slower and more positional." },
  { eco: "D06", name: "Queen's Gambit", moves: ["d4", "d5", "c4"],
    desc: "White offers the c-pawn to gain central control; the gambit is nearly always declined in practice." },
  { eco: "D30", name: "Queen's Gambit Declined", moves: ["d4", "d5", "c4", "e6"],
    desc: "Black holds the center solidly, accepting a cramped but very safe position." },
  { eco: "D20", name: "Queen's Gambit Accepted", moves: ["d4", "d5", "c4", "dxc4"],
    desc: "Black takes the pawn but must spend time giving it back or defending it while White gains activity." },
  { eco: "A45", name: "Indian Defense", moves: ["d4", "Nf6"],
    desc: "Black develops the knight, keeping the center flexible and ready for a hypermodern setup." },
  { eco: "E60", name: "King's Indian Defense", moves: ["d4", "Nf6", "c4", "g6"],
    desc: "Black fianchettoes the bishop and builds a strong kingside, often counterattacking on that wing." },
  { eco: "E20", name: "Nimzo-Indian Defense", moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"],
    desc: "Black pins the knight, fighting for control of e4 and doubling White's pawns if captured." },
  { eco: "E10", name: "Queen's Indian Defense", moves: ["d4", "Nf6", "c4", "e6", "Nf3"],
    desc: "A flexible, sound defense where Black aims for a harmonious, pressure-free setup." },
  { eco: "A56", name: "Benoni Defense", moves: ["d4", "Nf6", "c4", "c5"],
    desc: "Black challenges the center immediately, creating an unbalanced and double-edged game." },
  { eco: "A80", name: "Dutch Defense", moves: ["d4", "f5"],
    desc: "Black stakes a claim on the kingside early, preparing aggressive play on that wing." },
  { eco: "A04", name: "Réti Opening", moves: ["Nf3", "d5"],
    desc: "White keeps the center fluid, preparing to pressure Black's d5 pawn with pieces and a later c4." },
  { eco: "A10", name: "English Opening", moves: ["c4"],
    desc: "White plays a flank opening, controlling d5 with the c-pawn and keeping the center flexible." },
  { eco: "C20", name: "Open Game", moves: ["e4", "e5"],
    desc: "Both sides claim the center with their pawns — a clean classical start that leaves many roads open." },
  { eco: "C20", name: "King's Pawn Opening", moves: ["e4"],
    desc: "The most popular opening move — White claims the center and opens lines for the queen and king's bishop." },
  { eco: "D00", name: "Closed Game", moves: ["d4", "d5"],
    desc: "A solid, symmetrical center where play tends to stay locked and positional for a long while." },
  { eco: "D00", name: "Queen's Pawn Opening", moves: ["d4"],
    desc: "White plays a closed center, controlling e5 and leading to quieter, positional games." },
  { eco: "A00", name: "Flexible Opening", moves: [],
    desc: "Opening moves that keep many plans alive — nothing committed, everything negotiable." },
];

/* Match the deepest COMPLETED book line against the moves actually played.
 * An opening only gets named once its whole move sequence is on the board, so
 * a couple of generic e4/e5 plies never gets mislabelled as a specific opening. */
export function identifyOpening(sans) {
  let best = null, bestLen = -1;
  for (const o of OPENINGS) {
    if (o.moves.length > sans.length) continue;
    let ok = true;
    for (let k = 0; k < o.moves.length; k++) if (o.moves[k] !== sans[k]) { ok = false; break; }
    if (ok && o.moves.length > bestLen) { bestLen = o.moves.length; best = o; }
  }
  if (!best) return null;
  return { opening: best, consumed: bestLen, inBook: bestLen === sans.length };
}

/* Is the move at index `i` still theory for the identified opening? */
function isBookMove(sans, opening, i) {
  if (!opening) return false;
  return i < opening.moves.length && sans[i] === opening.moves[i];
}

/* Best move's captured piece, via the chess.js Move object's `.captured`. */
function capturedOf(fen, uci) {
  try {
    const c = new Chess(fen);
    const from = uci.slice(0, 2), to = uci.slice(2, 4);
    const promo = uci.length > 4 ? uci[4] : undefined;
    const mv = promo ? c.move({ from, to, promotion: promo }) : c.move({ from, to });
    return mv.captured || null;
  } catch (e) { return null; }
}

/* Fluent helpers for talking about a side. */
const SIDE = { w: "White", b: "Black" };
function evalText(stype, sval) {
  if (stype === "mate") return "a forced checkmate";
  const cp = sval / 100;
  const a = Math.abs(cp);
  if (a >= 3) return `a decisive advantage (${cp > 0 ? "+" : ""}${cp.toFixed(1)})`;
  if (a >= 1) return `a clear advantage (${cp > 0 ? "+" : ""}${cp.toFixed(1)})`;
  if (a >= 0.4) return `a slight advantage (${cp > 0 ? "+" : ""}${cp.toFixed(1)})`;
  return "roughly equal chances";
}

const KLASS_MSG = {
  brilliant: "Brilliant — a deep, non-obvious move that the engine ranks clearly above the alternatives.",
  best: "The best move here — Stockfish's own top choice.",
  excellent: "Excellent — essentially perfect, matching the engine's top line within a whisker.",
  good: "Good — a solid move, only marginally below the engine's ideal.",
  inaccuracy: "An inaccuracy — a smaller miss that lets the opponent ease the pressure or gain a little ground.",
  mistake: "A mistake — this cost real advantage; the position is now worse than it needed to be.",
  blunder: "A blunder — a serious error that hands the opponent a big advantage or loses material.",
};

/* ---------------------------------------------------------- explanation
 * Produce a structured, human-readable explanation for the move at index i.
 * Takes the already-computed analysis row plus the raw engine line so the
 * "what you could have done instead" bit can be concrete. */
export function explainMove(i, sans, fen, best, klass, playedSan, playerColor) {
  const mover = i % 2 === 0 ? "w" : "b";
  const myMove = mover === playerColor;
  const parts = [];

  const op = identifyOpening(sans);
  let openingLine = null;
  if (op && op.consumed > 0) {
    const book = isBookMove(sans, op.opening, i);
    openingLine = {
      eco: op.opening.eco,
      name: op.opening.name,
      book: book && op.consumed >= op.opening.moves.length,
      desc: op.opening.desc,
      moves: op.opening.moves,
      consumed: op.consumed,
    };
  }

  const klassMsg = KLASS_MSG[klass];
  const klassParts = klassMsg ? [klassMsg] : [];

  let bestParts = [];
  if (best && best.pv && best.pv.length) {
    const bestUci = best.pv[0];
    const bestCaptured = capturedOf(fen, bestUci);
    let tip = `The engine wanted <b>${playedSan}</b>`; // placeholder replaced below
    const san = toSan(fen, bestUci);
    const theyCould = myMove ? "You could have" : "Your opponent could have";
    if (bestCaptured) {
      const cn = PIECE_NAME[bestCaptured] || "piece";
      if (san === playedSan) {
        tip = `${san} — a good capture (${cn}).`;
      } else {
        tip = `${theyCould} played <b>${san}</b>, capturing a ${cn}.`;
      }
    } else {
      tip = `A stronger try is <b>${san}</b>.`;
    }
    bestParts.push(tip);
    const swing = best.loss;
    if (klass === "mistake" || klass === "blunder" || klass === "inaccuracy") {
      const pl = SIDE[mover];
      const swingText = best.loss != null
        ? ` that move gives up roughly ${Math.round(best.loss / 100)} pawn${Math.round(best.loss / 100) === 1 ? "" : "s"} of the edge.`
        : ".";
      bestParts.push(`${pl} missed the best continuation${swingText}`);
    }
    bestParts.push(`After the best line, the position holds ${evalText(best.stype, best.sval)} for ${SIDE[mover]}.`);
  }

  return { opening: openingLine, klassParts, bestParts, klass, mover, playedSan };
}

/* Convert a UCI move to SAN given a starting fen. */
function toSan(fen, uci) {
  try {
    const c = new Chess(fen);
    const from = uci.slice(0, 2), to = uci.slice(2, 4);
    const promo = uci.length > 4 ? uci[4] : undefined;
    const mv = promo ? c.move({ from, to, promotion: promo }) : c.move({ from, to });
    return mv.san;
  } catch (e) { return uci; }
}
