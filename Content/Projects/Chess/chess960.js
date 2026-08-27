// Chess960 helpers: generate a valid Fischer Random starting position and
// translate castling rights between chess.js's KQkq field and the Shredder-FEN
// notation Stockfish needs when UCI_Chess960 is on.

// Build a random back-rank string for White, files a..h. Rules:
//   - bishops on opposite-colored squares
//   - king strictly between the two rooks
export function randomBackRank() {
  const dark = [0, 2, 4, 6];
  const light = [1, 3, 5, 7];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  for (let attempt = 0; attempt < 200; attempt++) {
    const sq = new Array(8).fill(null);
    sq[pick(dark)] = "B";
    sq[pick(light)] = "B";
    const rem = [];
    for (let f = 0; f < 8; f++) if (!sq[f]) rem.push(f);
    const king = pick(rem);
    const left = rem.filter((f) => f < king);
    const right = rem.filter((f) => f > king);
    if (!left.length || !right.length) continue;
    sq[king] = "K";
    sq[pick(left)] = "R";
    sq[pick(right)] = "R";
    const free = [];
    for (let f = 0; f < 8; f++) if (!sq[f]) free.push(f);
    for (let i = free.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [free[i], free[j]] = [free[j], free[i]];
    }
    sq[free[0]] = "Q";
    sq[free[1]] = "N";
    sq[free[2]] = "N";
    return sq.join("");
  }
  return "RNBQKBNR"; // extremely unlikely fallback
}

// Full starting FEN for a freshly generated Chess960 position.
export function randomStartFen() {
  const w = randomBackRank();
  return `${w.toLowerCase()}/pppppppp/8/8/8/8/PPPPPPPP/${w} w KQkq - 0 1`;
}

// Expand a FEN rank (digits count empty squares) into an 8-element array,
// a-file first.
function expandRank(rank) {
  const out = [];
  for (const ch of rank) {
    if (ch >= "1" && ch <= "8") for (let i = +ch; i > 0; i--) out.push(null);
    else out.push(ch);
  }
  return out;
}

// Given the plain chess.js castling field ("KQkq"-style) and both back ranks,
// build the Shredder-FEN castling field ("HAh a"-style, or "-").
export function shredderCastleField(castling, backRankW, backRankB) {
  let out = "";
  if (castling.includes("K")) out += rookFile(expandRank(backRankW), true, true);
  if (castling.includes("Q")) out += rookFile(expandRank(backRankW), false, true);
  if (castling.includes("k")) out += rookFile(expandRank(backRankB), true, false);
  if (castling.includes("q")) out += rookFile(expandRank(backRankB), false, false);
  return out || "-";
}

// File letters (a..h) of the two castling rooks given an expanded rank;
// `white` picks upper vs lower case output. side: true = kingside (rightmost
// rook that lies on that side of the king), false = queenside (leftmost).
function rookFile(rank, side, white) {
  const king = rank.indexOf(white ? "K" : "k");
  let rf = -1;
  for (let f = 0; f < 8; f++) {
    const p = rank[f];
    if (p === (white ? "R" : "r") && (side ? f > king : f < king)) {
      if (rf === -1 || (side ? f > rf : f < rf)) rf = f;
    }
  }
  const ch = rf >= 0 ? "abcdefgh"[rf] : "-";
  return white ? ch.toUpperCase() : ch.toLowerCase();
}

export function toShredderFen(fen) {
  const parts = fen.split(/\s+/);
  if (parts[2] === "-") return fen;
  const ranks = parts[0].split("/");
  parts[2] = shredderCastleField(parts[2], ranks[7], ranks[0]);
  return parts.join(" ");
}