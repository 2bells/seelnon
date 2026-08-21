import { Chess } from "./chess.js";

const PIECE_DISP = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen" };

/* =============================================================== OPENING TREE
 * Openings are stored as a tree. Each node may carry a `name` (the name of the
 * opening this sequence of moves is called) plus a `plan` describing the piece
 * structure and typical idea built along the way. Children are keyed by the SAN
 * of the NEXT move, so the reply to an opening walks down its variations — the
 * depth a learner needs. */
const OPENING_TREE = {
  "e4": {
    name: "King's Pawn Opening", eco: "C20",
    plan: "White stakes the centre and opens lines for the queen and king's bishop.",
    children: {
      "e5": {
        name: "Open Game", eco: "C20",
        plan: "Both sides claim centre squares with pawns — the cleanest classical start.",
        children: {
          "Nf3": {
            plan: "Fighting for e5 while keeping d4 and Bb5/Bc4 in prospect.",
            children: {
              "Nc6": {
                children: {
                  "Bb5": {
                    name: "Ruy Lopez", eco: "C60",
                    plan: "The Spanish: the bishop pressures the knight that guards e5. White now aims for c3 + d4 to build a pawn centre.",
                    children: {
                      "a6": {
                        name: "Ruy Lopez, Morphy Defense", eco: "C78",
                        plan: "Black chases the bishop first (...a6/...b5). The classic: Ba4, O-O, Re1, c3, then d4 to break open the centre.",
                        children: {
                          "Ba4": {
                            plan: "Keeping the bishop on the a4-d1 diagonal to hold the pressure on c6/e5.",
                            children: {
                              "Nf6": {
                                name: "Ruy Lopez, Morphy", eco: "C77",
                                plan: "Black exerts pressure back on e4; the main Ruy road with O-O and Re1 next.",
                                children: {
                                  "O-O": {
                                    children: {
                                      "Be7": {
                                        children: {
                                          "Re1": {
                                            children: {
                                              "b5": {
                                                children: {
                                                  "Bb3": {
                                                    children: {
                                                      "d6": {
                                                        children: {
                                                          "c3": {
                                                            children: {
                                                              "O-O": {
                                                                children: {
                                                                  "d4": {
                                                                    name: "Ruy Lopez, Closed Main Line", eco: "C78",
                                                                    plan: "The classic Spanish breakthrough: c3 prepares d4 to hit Black's centre."
                                                                  }
                                                                }
                                                              }
                                                            }
                                                          }
                                                        }
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      },
                      "f5": {
                        name: "Ruy Lopez, Schliemann (Jaenisch)", eco: "C63",
                        plan: "Black gambits to rip open the e-file as a sharp counter to the Spanish bishop."
                      },
                      "Nf6": {
                        name: "Ruy Lopez, Berlin Defense", eco: "C65",
                        plan: "The rock-solid Berlin: Black develops before touching the a-pawn; the Berlin Wall holds even at top level."
                      },
                      "Bc5": {
                        name: "Ruy Lopez, Classical Defense", eco: "C64",
                        plan: "Black develops actively, pointing at f2 and keeping both bishops useful."
                      },
                      "Nge7": {
                        name: "Ruy Lopez, Cozio Defense", eco: "C60",
                        plan: "A flexible, slightly passive setup; Black keeps options before fianchettoing."
                      },
                      "f6": {
                        name: "Ruy Lopez, Steinitz Defense", eco: "C62",
                        plan: "Black reinforces e5 with ...f6 — solid but cramped, trading space for security."
                      }
                    }
                  },
                  "Bc4": {
                    name: "Italian Game", eco: "C50",
                    plan: "White's bishop aims at f7, the weak square. Development aims for a quick c3-d4 centre."
                  },
                  "d4": {
                    name: "Scotch Game", eco: "C45",
                    plan: "White opens the centre at once for rapid development and a lead that presses the exposed king."
                  }
                }
              }
            }
          },
          "f4": {
            name: "King's Gambit", eco: "C30",
            plan: "White offers the f-pawn to rip open the centre and seize attacking chances against the king."
          },
          "Nc3": {
            name: "Vienna Game", eco: "C25",
            plan: "A flexible first knight, keeping f4 or d4 in prospect for a pawn storm."
          }
        }
      },
      "c5": {
        name: "Sicilian Defense", eco: "B20",
        plan: "Black contests the d4 square and keeps things unbalanced — a lifetime of variations on one move.",
        children: {
          "Nf3": {
            plan: "The Open Sicilian: White will deliver d4 and inhabit the open file.",
            children: {
              "d6": {
                name: "Open Sicilian", eco: "B90",
                plan: "Black plays d6 first; now the pawns can flow ...Nf6, ...a6 (Najdorf) or ...e6.",
                children: {
                  "d4": {
                    children: {
                      "cxd4": {
                        children: {
                          "Nxd4": {
                            children: {
                              "Nf6": {
                                children: {
                                  "Nc3": {
                                    plan: "The main-line Sicilian centre. Black now chooses a variation.",
                                    children: {
                                      "a6": {
                                        name: "Sicilian, Najdorf Variation", eco: "B90",
                                        plan: "The sharpest and most modern Sicilian — a move to build the ...e5 counter and fight for the centre last."
                                      },
                                      "g6": {
                                        name: "Sicilian, Dragon Variation", eco: "B70",
                                        plan: "Black fianchettoes the bishop to the long diagonal and attacks on the queenside; White storms the h-file."
                                      },
                                      "e6": {
                                        name: "Sicilian, Scheveningen Variation", eco: "B80",
                                        plan: "A compact small-centre for Black; both sides finish development before the push to the wing."
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              },
              "Nc6": {
                name: "Sicilian, ...Nc6", eco: "B30",
                plan: "A flexible Sicilian that keeps the d-pawn free, often leading to Sveshnikov/Taimanov.",
                children: {
                  "d4": {
                    children: {
                      "cxd4": {
                        children: {
                          "Nxd4": {
                            children: {
                              "e6": {
                                name: "Sicilian, Taimanov (Taimanov)", eco: "B46",
                                plan: "A solid, riposting-styled setup for Black with quick development."
                              },
                              "Nf6": {
                                children: {
                                  "Nc3": {
                                    children: {
                                      "e5": {
                                        name: "Sicilian, Sveshnikov Variation", eco: "B33",
                                        plan: "Black lets White build a big centre for a lead in development and dynamic chances."
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "c3": {
            name: "Sicilian, Alapin", eco: "B22",
            plan: "White supports d4 while staying solid — less sharp but a reliable centre."
          },
          "Nc3": {
            name: "Sicilian, Closed", eco: "B23",
            plan: "White avoids opening the centre and steers toward a closed maneuvering game."
          },
          "d4": {
            name: "Sicilian, Smith-Morra Gambit", eco: "B21",
            plan: "White gives a pawn to build a big centre and fast attacking development."
          }
        }
      },
      "e6": {
        name: "French Defense", eco: "C00",
        plan: "Black intends d5, locking the centre, trading space for a very solid structure.",
        children: {
          "d4": {
            children: {
              "d5": {
                name: "French Defense", eco: "C02",
                plan: "The classic French barrier; Black's light-square bishop is condemned but the structure is a fortress.",
                children: {
                  "e5": {
                    name: "French, Advance Variation", eco: "C02",
                    plan: "White gains space but must watch ...c5 and ...f6 to tear down the pawn chain."
                  }
                }
              }
            }
          }
        }
      },
      "c6": {
        name: "Caro-Kann Defense", eco: "B10",
        plan: "Black builds a very solid structure to play d5 only once, keeping the bishop outside the pawns.",
        children: {
          "d4": {
            children: {
              "d5": {
                children: {
                  "e5": {
                    name: "Caro-Kann, Advance Variation", eco: "B12",
                    plan: "The central pawns face off; play comes on the kingside with the d-pawn as a lever."
                  },
                  "Nc3": {
                    children: {
                      "dxe4": {
                        children: {
                          "Nxe4": {
                            children: {
                              "Bf5": {
                                name: "Caro-Kann, Classical Variation", eco: "B18",
                                plan: "Black develops the bishop comfortably outside the pawn chain — the point of the Caro."
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "d5": {
        name: "Scandinavian Defense", eco: "B01",
        plan: "Black challenges e4 at once, though the queen to d5 invites trouble — White reproves with tempo."
      },
      "Nf6": {
        name: "Alekhine's Defense", eco: "B02",
        plan: "Black provokes an overextended centre, planning to strike it later."
      },
      "g6": {
        name: "Modern Defense", eco: "B06",
        plan: "A hypermodern approach pointing at Black's uncommitted centre."
      },
      "d6": {
        name: "Pirc Defense", eco: "B07",
        plan: "Black stays flexible (d6/g6/Bg7), letting White's pawns out then attacking them."
      }
    }
  },
  "d4": {
    name: "Queen's Pawn Opening", eco: "D00",
    plan: "A closed, flexible centre that controls e5 using the d-pawn.",
    children: {
      "d5": {
        name: "Closed Game", eco: "D00",
        plan: "Both sides advance the centre pawn and settle into a quiet positional battle.",
        children: {
          "c4": {
            name: "Queen's Gambit", eco: "D06",
            plan: "White offers the c-pawn to buy control of the centre; Black usually declines to keep it firm.",
            children: {
              "e6": {
                name: "Queen's Gambit Declined", eco: "D30",
                plan: "Black holds the centre with e6 — a solid, defensive badge, the battle for d5 ahead."
              },
              "dxc4": {
                name: "Queen's Gambit Accepted", eco: "D20",
                plan: "Black grabs the gambit pawn but must give back ground in development; White recaptures with tempo."
              },
              "c6": {
                name: "Slav Defense", eco: "D10",
                plan: "Black supports d5 with c6, the healthiest of the semi-open structures against 1.d4."
              },
              "Nf6": {
                name: "Queen's Gambit, Tartakower", eco: "D58",
                plan: "Transposes toward a stolid QGD with ...Nf6 instead of ...e6 first."
              }
            }
          },
          "Nf3": {
            children: {
              "c6": {
                name: "London System", eco: "D02",
                plan: "A compact, universal setup that sidesteps theory in the centre."
              }
            }
          }
        }
      },
      "Nf6": {
        name: "Indian Defense", eco: "A45",
        children: {
          "c4": {
            children: {
              "g6": {
                name: "King's Indian Defense", eco: "E60",
                plan: "Black fianchettoes and lets White build the centre, then attacks it from the wings.",
                children: {
                  "Nc3": {
                    children: {
                      "Bg7": {
                        children: {
                          "e4": {
                            name: "King's Indian, Classical Main Line", eco: "E97",
                            plan: "The archetypal KID: Black contests the big centre with ...e5 and later ...f5."
                          }
                        }
                      }
                    }
                  }
                }
              },
              "e6": {
                name: "Nimzo-Indian Defense", eco: "E20",
                plan: "Black pins the knight (Bb4) to control e4 and, after c3/dxc3, turns White's pawn structure into a target.",
                children: {
                  "Nc3": {
                    children: {
                      "Bb4": {
                        name: "Nimzo-Indian, Main Line", eco: "E20",
                        plan: "The pin on the knight for dominion over e4 is the whole fight."
                      }
                    }
                  }
                }
              },
              "c5": {
                name: "Modern Benoni", eco: "A56",
                plan: "Black challenges the centre immediately in an unbalanced, double-edged setup."
              },
              "b6": {
                name: "Queen's Indian Defense", eco: "E10",
                plan: "Black develops the queen's bishop to the b-file in a flexible Indian scheme."
              }
            }
          }
        }
      },
      "f5": {
        name: "Dutch Defense", eco: "A80",
        plan: "Black claims the kingside early, preparing attacking play on that wing."
      }
    }
  },
  "c4": {
    name: "English Opening", eco: "A10",
    plan: "A flanking opening that controls d5 and stays flexible between a Sicilian-style game and the closed queens."
  },
  "Nf3": {
    name: "Réti Opening", eco: "A04",
    plan: "White holds the centre undecided and will come to it later through flexible development."
  },
  "f4": {
    name: "Bird's Opening", eco: "A02",
    plan: "An unusual control of e5 with a flan king; a reversed Dutch off-angle."
  }
};

const OPENING_ROOT = { children: OPENING_TREE };

/* ------------------------------------------------------------------ walking
   Follow the SAN sequence down the tree and remember the deepest node that
   carries a name. Returns null if nothing matches at all. */
export function identifyOpening(sans) {
  let node = OPENING_ROOT;
  let depth = 0, best = null, bestDepth = 0;
  for (const san of sans) {
    if (node.children && node.children[san]) {
      node = node.children[san];
      depth++;
      if (node.name) { best = node; bestDepth = depth; }
    } else break;
  }
  if (!best) return null;
  return { opening: best, depth: bestDepth, inBook: bestDepth === sans.length };
}

/* Build the theory chip line: the moves already played, plus the main
   continuation still to come, capped at a sensible length. */
function theoryOf(opening, sans) {
  const line = [];
  let node = OPENING_ROOT;
  let consumed = 0;
  for (const san of sans) {
    if (node && node.children && node.children[san]) { node = node.children[san]; line.push(san); consumed++; }
    else break;
  }
  const cont = mainContinuation(node, 6);
  for (const san of cont) line.push(san);
  return { name: opening.name, eco: opening.eco, plan: opening.plan || null, moves: line, consumed };
}

function mainContinuation(node, max = 6) {
  const out = [];
  let kids = node ? node.children : null;
  while (kids && out.length < max) {
    const key = Object.keys(kids)[0];
    if (!key) break;
    out.push(key);
    kids = kids[key] ? kids[key].children : null;
  }
  return out;
}

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
  "Get the king safe: castle early. The castled king is checked from behind a wall of pawns.",
  "Don't move the same piece twice in the opening without good reason — each repeat costs a tempo.",
  "A 'good' vs 'bad' bishop: a bishop blocked in by your own pawns is bad; keep your pawns out of that diagonal.",
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
];
const ENDGAME_TIPS = [
  "The king becomes a fighting piece: bring it to the centre to support pawns and attack the enemy pawns.",
  "Opposition: when two kings face each other with one square between, the side to move is at a disadvantage.",
  "A passed pawn must be pushed (and supported). A far-advanced passed pawn decides the game.",
  "Rook endgame: a rook behind a passed pawn greatly strengthens it; activity is king.",
  "Trade pieces but not pawns when you are ahead — simplify to a won endgame.",
  "A draw: king + bishop vs king is not a win — you need a pawn or a rook.",
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
    if (best && best.pv && best.pv.length) {
      const cap = capturedOf(fen, best.pv[0]);
      const san = toSan(fen, best.pv[0]);
      out.tactics.push(cap
        ? { tag: "Tactic", text: `The best move <b>${san}</b> is a sharp tactic — it wins a ${PIECE_DISP[cap]}.` }
        : { tag: "Line", text: `A strong try is <b>${san}</b>.` });
    }
    out.tactics.push({ tag: "Material", text: leadText(m.w - m.b) });
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