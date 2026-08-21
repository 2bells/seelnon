// Opening book: one fav entry per named opening line.
// Entry shape: [name, eco, plan, movesSeq]
export const OPENINGS = [
  ["Alekhine's Defense", "B02", "Black provokes an overextended centre, planning to strike it later.", ["e4", "Nf6"]],
  ["Bird's Opening", "A02", "An unusual control of e5 with a flan king; a reversed Dutch off-angle.", ["f4"]],
  ["Caro-Kann, Advance Variation", "B12", "The central pawns face off; play comes on the kingside with the d-pawn as a lever.", ["e4", "c6", "d4", "d5", "e5"]],
  ["Caro-Kann, Classical Variation", "B18", "Black develops the bishop comfortably outside the pawn chain — the point of the Caro.", ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Bf5"]],
  ["Caro-Kann Defense", "B10", "Black builds a very solid structure to play d5 only once, keeping the bishop outside the pawns.", ["e4", "c6"]],
  ["Closed Game", "D00", "Both sides advance the centre pawn and settle into a quiet positional battle.", ["d4", "d5"]],
  ["Dutch Defense", "A80", "Black claims the kingside early, preparing attacking play on that wing.", ["d4", "f5"]],
  ["English Opening", "A10", "A flanking opening that controls d5 and stays flexible between a Sicilian-style game and the closed queens.", ["c4"]],
  ["French, Advance Variation", "C02", "White gains space but must watch ...c5 and ...f6 to tear down the pawn chain.", ["e4", "e6", "d4", "d5", "e5"]],
  ["French Defense", "C00", "Black intends d5, locking the centre, trading space for a very solid structure.", ["e4", "e6"]],
  ["French Defense", "C02", "The classic French barrier; Black's light-square bishop is condemned but the structure is a fortress.", ["e4", "e6", "d4", "d5"]],
  ["Indian Defense", "A45", null, ["d4", "Nf6"]],
  ["Italian Game", "C50", "White's bishop aims at f7, the weak square. Development aims for a quick c3-d4 centre.", ["e4", "e5", "Nf3", "Nc6", "Bc4"]],
  ["King's Gambit", "C30", "White offers the f-pawn to rip open the centre and seize attacking chances against the king.", ["e4", "e5", "f4"]],
  ["King's Indian, Classical Main Line", "E97", "The archetypal KID: Black contests the big centre with ...e5 and later ...f5.", ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4"]],
  ["King's Indian Defense", "E60", "Black fianchettoes and lets White build the centre, then attacks it from the wings.", ["d4", "Nf6", "c4", "g6"]],
  ["King's Pawn Opening", "C20", "White stakes the centre and opens lines for the queen and king's bishop.", ["e4"]],
  ["London System", "D02", "A compact, universal setup that sidesteps theory in the centre.", ["d4", "d5", "Nf3", "c6"]],
  ["Modern Benoni", "A56", "Black challenges the centre immediately in an unbalanced, double-edged setup.", ["d4", "Nf6", "c4", "c5"]],
  ["Modern Defense", "B06", "A hypermodern approach pointing at Black's uncommitted centre.", ["e4", "g6"]],
  ["Nimzo-Indian Defense", "E20", "Black pins the knight (Bb4) to control e4 and, after c3/dxc3, turns White's pawn structure into a target.", ["d4", "Nf6", "c4", "e6"]],
  ["Nimzo-Indian, Main Line", "E20", "The pin on the knight for dominion over e4 is the whole fight.", ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"]],
  ["Open Game", "C20", "Both sides claim centre squares with pawns — the cleanest classical start.", ["e4", "e5"]],
  ["Open Sicilian", "B90", "Black plays d6 first; now the pawns can flow ...Nf6, ...a6 (Najdorf) or ...e6.", ["e4", "c5", "Nf3", "d6"]],
  ["Pirc Defense", "B07", "Black stays flexible (d6/g6/Bg7), letting White's pawns out then attacking them.", ["e4", "d6"]],
  ["Queen's Gambit", "D06", "White offers the c-pawn to buy control of the centre; Black usually declines to keep it firm.", ["d4", "d5", "c4"]],
  ["Queen's Gambit Accepted", "D20", "Black grabs the gambit pawn but must give back ground in development; White recaptures with tempo.", ["d4", "d5", "c4", "dxc4"]],
  ["Queen's Gambit Declined", "D30", "Black holds the centre with e6 — a solid, defensive badge, the battle for d5 ahead.", ["d4", "d5", "c4", "e6"]],
  ["Queen's Gambit, Tartakower", "D58", "Transposes toward a stolid QGD with ...Nf6 instead of ...e6 first.", ["d4", "d5", "c4", "Nf6"]],
  ["Queen's Indian Defense", "E10", "Black develops the queen's bishop to the b-file in a flexible Indian scheme.", ["d4", "Nf6", "c4", "b6"]],
  ["Queen's Pawn Opening", "D00", "A closed, flexible centre that controls e5 using the d-pawn.", ["d4"]],
  ["Réti Opening", "A04", "White holds the centre undecided and will come to it later through flexible development.", ["Nf3"]],
  ["Ruy Lopez", "C60", "The Spanish: the bishop pressures the knight that guards e5. White now aims for c3 + d4 to build a pawn centre.", ["e4", "e5", "Nf3", "Nc6", "Bb5"]],
  ["Ruy Lopez, Berlin Defense", "C65", "The rock-solid Berlin: Black develops before touching the a-pawn; the Berlin Wall holds even at top level.", ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6"]],
  ["Ruy Lopez, Classical Defense", "C64", "Black develops actively, pointing at f2 and keeping both bishops useful.", ["e4", "e5", "Nf3", "Nc6", "Bb5", "Bc5"]],
  ["Ruy Lopez, Closed Main Line", "C78", "The classic Spanish breakthrough: c3 prepares d4 to hit Black's centre.", ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5", "Bb3", "d6", "c3", "O-O", "d4"]],
  ["Ruy Lopez, Cozio Defense", "C60", "A flexible, slightly passive setup; Black keeps options before fianchettoing.", ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nge7"]],
  ["Ruy Lopez, Morphy", "C77", "Black exerts pressure back on e4; the main Ruy road with O-O and Re1 next.", ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6"]],
  ["Ruy Lopez, Morphy Defense", "C78", "Black chases the bishop first (...a6/...b5). The classic: Ba4, O-O, Re1, c3, then d4 to break open the centre.", ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"]],
  ["Ruy Lopez, Schliemann (Jaenisch)", "C63", "Black gambits to rip open the e-file as a sharp counter to the Spanish bishop.", ["e4", "e5", "Nf3", "Nc6", "Bb5", "f5"]],
  ["Ruy Lopez, Steinitz Defense", "C62", "Black reinforces e5 with ...f6 — solid but cramped, trading space for security.", ["e4", "e5", "Nf3", "Nc6", "Bb5", "f6"]],
  ["Scandinavian Defense", "B01", "Black challenges e4 at once, though the queen to d5 invites trouble — White reproves with tempo.", ["e4", "d5"]],
  ["Scotch Game", "C45", "White opens the centre at once for rapid development and a lead that presses the exposed king.", ["e4", "e5", "Nf3", "Nc6", "d4"]],
  ["Sicilian, Alapin", "B22", "White supports d4 while staying solid — less sharp but a reliable centre.", ["e4", "c5", "c3"]],
  ["Sicilian, Closed", "B23", "White avoids opening the centre and steers toward a closed maneuvering game.", ["e4", "c5", "Nc3"]],
  ["Sicilian Defense", "B20", "Black contests the d4 square and keeps things unbalanced — a lifetime of variations on one move.", ["e4", "c5"]],
  ["Sicilian, Dragon Variation", "B70", "Black fianchettoes the bishop to the long diagonal and attacks on the queenside; White storms the h-file.", ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "g6"]],
  ["Sicilian, Najdorf Variation", "B90", "The sharpest and most modern Sicilian — a move to build the ...e5 counter and fight for the centre last.", ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"]],
  ["Sicilian, ...Nc6", "B30", "A flexible Sicilian that keeps the d-pawn free, often leading to Sveshnikov/Taimanov.", ["e4", "c5", "Nf3", "Nc6"]],
  ["Sicilian, Scheveningen Variation", "B80", "A compact small-centre for Black; both sides finish development before the push to the wing.", ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "e6"]],
  ["Sicilian, Smith-Morra Gambit", "B21", "White gives a pawn to build a big centre and fast attacking development.", ["e4", "c5", "d4"]],
  ["Sicilian, Sveshnikov Variation", "B33", "Black lets White build a big centre for a lead in development and dynamic chances.", ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "e5"]],
  ["Sicilian, Taimanov (Taimanov)", "B46", "A solid, riposting-styled setup for Black with quick development.", ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4", "e6"]],
  ["Slav Defense", "D10", "Black supports d5 with c6, the healthiest of the semi-open structures against 1.d4.", ["d4", "d5", "c4", "c6"]],
  ["Vienna Game", "C25", "A flexible first knight, keeping f4 or d4 in prospect for a pawn storm.", ["e4", "e5", "Nc3"]]
];
function isPrefix(prefix, arr) {
  if (prefix.length > arr.length) return false;
  for (let i = 0; i < prefix.length; i++) if (prefix[i] !== arr[i]) return false;
  return true;
}

export function identifyOpening(movesSeq) {
  let best = null;
  for (const [name, eco, plan, line] of OPENINGS) {
    if (line.length <= movesSeq.length && isPrefix(line, movesSeq)) {
      if (!best || line.length > best.line.length) best = { name, eco, plan, line };
    }
  }
  if (!best) return null;
  return { opening: { name: best.name, eco: best.eco, plan: best.plan },
           depth: best.line.length,
           inBook: best.line.length === movesSeq.length };
}

function bookPrefixLen(movesSeq) {
  let k = movesSeq.length;
  while (k > 0) {
    const p = movesSeq.slice(0, k);
    if (OPENINGS.some(o => isPrefix(p, o[3]))) return k;
    k--;
  }
  return 0;
}

// The continuation follows the deepest book branch that still has theory ahead,
// so after 1.e4 we suggest the main line (Nf3 → Ruy Lopez) rather than a shallow
// sideline like Alekhine's.
function continuation(movesSeq, consumed, maxC) {
  const p = movesSeq.slice(0, consumed);
  let best = null;
  for (const o of OPENINGS) {
    if (o[3].length > consumed && isPrefix(p, o[3])) {
      if (!best || o[3].length > best.length) best = o[3];
    }
  }
  return best ? best.slice(consumed, consumed + maxC) : [];
}

export function theoryOf(opening, movesSeq) {
  const consumed = bookPrefixLen(movesSeq);
  const line = movesSeq.slice(0, consumed);
  for (const san of continuation(movesSeq, consumed, 6)) line.push(san);
  return { name: opening.name, eco: opening.eco, plan: opening.plan || null, moves: line, consumed };
}
