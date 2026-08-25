import "./aurora.js";

const DECK = [
  { num: 0, name: "The Fool", read: "Begin with an open, trusting step; the path is laid before you." },
  { num: 1, name: "The Magician", read: "Your will and tools are gathered &mdash; manifest what you desire." },
  { num: 2, name: "The High Priestess", read: "Listen to intuition; the answers lie beneath the surface." },
  { num: 3, name: "The Empress", read: "Nurture what grows. Fertility of life, art, and feeling." },
  { num: 4, name: "The Emperor", read: "Build on structure and authority. Take firm command." },
  { num: 5, name: "The Hierophant", read: "Find wisdom in tradition, study, and the guidance of elders." },
  { num: 6, name: "The Lovers", read: "A choice about union and values arises &mdash; choose with heart and head." },
  { num: 7, name: "The Chariot", read: "Willpower conquers obstacles. Steer with discipline." },
  { num: 8, name: "Strength", read: "Gentle courage tames the inner wildness. Patience is might." },
  { num: 9, name: "The Hermit", read: "Withdraw to find the inner light. Solitude carries wisdom." },
  { num: 10, name: "Wheel of Fortune", read: "A turn of fate. Ride the cycle with acceptance." },
  { num: 11, name: "Justice", read: "Cause and effect. Seek truth and balance in your dealings." },
  { num: 12, name: "The Hanged Man", read: "Pause and see things from a new, suspended angle." },
  { num: 13, name: "Death", read: "A chapter ends so a new one begins. Shed the old." },
  { num: 14, name: "Temperance", read: "Blend, moderate, find the middle alchemical path." },
  { num: 15, name: "The Devil", read: "Name the chains you serve; attachment can be released." },
  { num: 16, name: "The Tower", read: "A sudden shaking frees foundations. Let it fall to rebuild." },
  { num: 17, name: "The Star", read: "Hope restores. A calm light after the storm." },
  { num: 18, name: "The Moon", read: "Illusions and dreams. Trust slowly; shadows pass." },
  { num: 19, name: "The Sun", read: "Radiance, joy, vitality. Clarity and success shine." },
  { num: 20, name: "Judgement", read: "A call to awaken and be reborn by your own judgment." },
  { num: 21, name: "The World", read: "Completion and integration. One cycle closes whole." },
];

const SLOTS = [
  { label: "mind" },
  { label: "body" },
  { label: "spirit" },
];

const castBtn = document.getElementById("cast");
const energyEl = document.getElementById("energy");

// --- visual energy: FUN ONLY, updated only while hovering the button ---
// (Separate from the date seed that actually drives the reading.)
let tick = 0n;
let chaos = 0n;
const base = 10n ** 96n;

castBtn.addEventListener("pointermove", (e) => {
  tick += 1n;
  const raw =
    BigInt((e.clientX ^ (e.clientY * 31)) * 1009) +
    BigInt(Date.now() % 1000000) * 31n +
    tick;
  chaos = (chaos * 7919n + raw * 37n + 1234567n) % base;
  chaos = (chaos ^ (tick << 40n)) % base;

  castBtn.disabled = false;
  energyEl.textContent = (chaos % 97777n + 1n) + "";
});

// --- countdown to local midnight, when the next read unlocks ---
function nextMidnight() {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

function tickCountdown() {
  const ms = nextMidnight() - Date.now();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n) => String(n).padStart(2, "0");
  const str = `${pad(h)}:${pad(m)}:${pad(s)}`;
  const a = document.getElementById("timer");
  const b = document.getElementById("timer2");
  if (a) a.textContent = str;
  if (b) b.textContent = str;
}
setInterval(tickCountdown, 1000);
tickCountdown();

castBtn.addEventListener("click", cast);
// also allow re-drawing the same card by re-clicking; result is constant all day
window.addEventListener("keydown", (e) => e.key === "Enter" && cast());

// --- the daily reading: one per day, derived from the local date ---
// The "background number" the reading actually uses is seeded purely from
// today's date, completely separate from the visual energy above.
const today = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function bigNumberOfDate(dateStr) {
  let n = 2166136261n;
  for (const ch of dateStr) n = (n * 16777619n) ^ BigInt(ch.charCodeAt(0));
  return (n * (10n ** 200n) + n) % (10n ** 36n);
}

// deterministic PRNG seeded from the date, so a day's reading never changes
function seededRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function cast() {
  const user = await window.websim?.getUser?.();
  const uid = user?.id ?? "anonymous";
  const rng = seededRng(Number(bigNumberOfDate(today() + uid) % 4294967296n));

  // shuffle the 22-card deck and take the first 3 (mind, body, spirit).
  // Drawing without replacement means: mind from 22, body from 21, spirit
  // from 20 — never a repeat, and each slot is a fair pick.
  const deck = DECK.map((_, i) => i);
  for (let i = 0; i < 3; i++) {
    const j = i + Math.floor(rng() * (DECK.length - i));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const picks = deck.slice(0, 3);

  // today's number: sum the three cards, keep the ones digit (drop the tens)
  const total = picks.reduce((a, b) => a + b, 0);
  const todayNumber = total % 10;

  showReading(picks, todayNumber);
}

function showReading(picks, todayNumber) {
  const wrap = document.getElementById("cards");
  wrap.innerHTML = "";
  picks.forEach((idx, i) => {
    const card = DECK[idx];
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `
      <span class="slot">${SLOTS[i].label}</span>
      <span class="numeral">${card.num}</span>
      <span class="name">${card.name}</span>
      <span class="read">${card.read}</span>`;
    wrap.appendChild(el);
  });
  document.getElementById("todayNumber").textContent = todayNumber;
  document.getElementById("draw").classList.add("hidden");
  document.getElementById("reading").classList.remove("hidden");
}

document.getElementById("again").addEventListener("click", () => {
  document.getElementById("reading").classList.add("hidden");
  document.getElementById("draw").classList.remove("hidden");
  castBtn.disabled = true;
  energyEl.textContent = "0";
});