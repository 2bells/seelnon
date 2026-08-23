const canvas = document.getElementById("aurora");
const ctx = canvas.getContext("2d");

let w, h;
function resize() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

// two drifting blobs of color behind everything
const blobs = [
  { x: 0.3, y: 0.35, r: 0.42, hue: 268, amp: 0.05 },
  { x: 0.7, y: 0.65, r: 0.4, hue: 43, amp: 0.04 },
];

let t = 0;
function frame() {
  t += 0.004;
  ctx.clearRect(0, 0, w, h);

  for (const b of blobs) {
    const cx = (b.x + Math.sin(t * 0.7 + b.hue) * b.amp) * w;
    const cy = (b.y + Math.cos(t * 0.5 + b.hue) * b.amp) * h;
    const rad = b.r * (w + h) / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, `hsla(${b.hue}, 65%, 55%, 0.16)`);
    g.addColorStop(1, "hsla(0,0%,0%,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  requestAnimationFrame(frame);
}
frame();