const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: true });
const fileInput = document.getElementById('file');
const gridRange = document.getElementById('gridRange');
const strengthRange = document.getElementById('strengthRange');
const falloffRange = document.getElementById('falloffRange');
const resetBtn = document.getElementById('reset');

// wave and bounce parameter controls
const waveStrengthRange = document.getElementById('waveStrengthRange');
const waveSpeedRange = document.getElementById('waveSpeedRange');
const waveDecayRange = document.getElementById('waveDecayRange');
const waveThresholdRange = document.getElementById('waveThresholdRange');
const stiffnessRange = document.getElementById('stiffnessRange');
const dampingRange = document.getElementById('dampingRange');

let img = new Image();
let imgReady = false;

// Grid / physics
let cols = 30, rows = 0; // default grid set to 30
let points = []; // {x0,y0, x,y, vx,vy}
let indices = []; // triangle indices for drawing optional debug
let scale = 1, offsetX = 0, offsetY = 0;
let dragging = false;
let pointer = {x:0,y:0, down:false, dragStart:null, moved:false};
let lastPointer = {x:0,y:0};
let strength = parseFloat(document.getElementById('strengthRange')?.value || 0.1);
let falloff = 120;
let stiffness = parseFloat(stiffnessRange?.value || 0.12); // spring strength (adjustable)
let damping = parseFloat(dampingRange?.value || 0.85);     // velocity damping (adjustable)

// wave tuning multipliers
let waveStrengthMultiplier = parseFloat(waveStrengthRange?.value || 5);
let waveSpeedBase = parseFloat(waveSpeedRange?.value || 600);
let waveDecay = parseFloat(waveDecayRange?.value || 2.2);
let waveThreshold = parseFloat(waveThresholdRange?.value || 80);

let pins = []; // {x, y, radius} - pins now act as area-of-influence rather than a single locked vertex
let pinMode = false;
let activePin = null; // {pin, pointerId}
let pinRadius = 40; // default radius in canvas pixels

// bounce waves: each wave has {x,y,strength,age,speed,decay,maxRadius}
let waves = [];
// queue a wave to be triggered on first bounce-back
let pendingWave = null;

// add missing liquid state defaults to avoid ReferenceError
let liquids = [];
let liquidEnabled = false;
let liquidViscosity = 2.0;
let liquidAmount = 5.0;
let liquidSpread = 300;
let liquidColor = null; // color removed — liquids render neutral
let liquidSpeed = 600; // new: controls pour/wave speed for liquids

// new: temp visual offsets used only for rendering during drag (not applied to physics)
let tempOffsets = null;
let currentDragDelta = { x: 0, y: 0 };
// new: saved baseline positions while dragging so we can apply preview directly to points
let savedPositions = null;

// new: rendering mode toggle (pixelated vs smooth)
const renderModeSelect = document.getElementById('renderModeSelect');
let imageSmooth = false; // false => pixelated (no smoothing), true => smooth (antialias)

// helper to apply CSS + context smoothing
function applyRenderMode(){
  // CSS image-rendering for canvas (handles scaled DOM appearance)
  if(imageSmooth){
    canvas.style.imageRendering = 'auto';
  } else {
    // prefer crisp-edges / pixelated variants for cross-browser
    canvas.style.imageRendering = 'pixelated';
  }
  // context smoothing for drawImage
  ctx.imageSmoothingEnabled = !!imageSmooth;
}

// init from select if present
if(renderModeSelect){
  renderModeSelect.addEventListener('change', ()=>{
    imageSmooth = renderModeSelect.value === 'smooth';
    applyRenderMode();
  });
  // set initial
  imageSmooth = renderModeSelect.value === 'smooth';
  applyRenderMode();
}

// add hide pins toggle
const hidePinsBtn = document.getElementById('hidePinsBtn');
let hidePins = false;

if(hidePinsBtn){
  hidePinsBtn.addEventListener('click', ()=>{
    hidePins = !hidePins;
    hidePinsBtn.textContent = 'Hide pins: ' + (hidePins ? 'on' : 'off');
  });
}

function resizeCanvas(w,h){
  canvas.width = w;
  canvas.height = h;
}

function setupGridForImage(){
  // limit grid by longest side; user controls cols (approx)
  const maxCols = Math.max(8, Math.min(120, parseInt(gridRange.value||40)));
  cols = maxCols;
  const iw = img.width, ih = img.height;
  const aspect = iw/ih;
  // allow scaling UP for small sprites: use full available area (contain)
  const canvasMaxW = window.innerWidth - 60;
  const canvasMaxH = window.innerHeight * 0.66;
  // scale to fit area while preserving aspect (contain)
  let cw = canvasMaxW, ch = cw / aspect;
  if(ch > canvasMaxH){ ch = canvasMaxH; cw = ch * aspect; }
  scale = cw / iw;
  resizeCanvas(Math.round(cw), Math.round(ch));
  offsetX = 0; offsetY = 0;

  rows = Math.max(4, Math.round(cols / aspect));
  points = [];
  for(let j=0;j<=rows;j++){
    for(let i=0;i<=cols;i++){
      const x0 = (i/cols)*img.width;
      const y0 = (j/rows)*img.height;
      // map to canvas space with scale
      const x = x0 * scale + offsetX;
      const y = y0 * scale + offsetY;
      points.push({
        x0, y0,
        x, y,
        vx:0, vy:0,
        invMass: 1 // could vary
      });
    }
  }

  // after creating points, re-map existing pins to nearest points if any
  if(pins.length){
    const oldPins = pins.slice();
    pins = [];
    for(const op of oldPins){
      // compute image coords from old canvas pos and add
      addPinAt(op.x, op.y);
    }
  }
}

function imageToCanvas(p){
  return { x: p.x*scale + offsetX, y: p.y*scale + offsetY };
}

function canvasToImageCoords(cx, cy){
  return { x: (cx - offsetX)/scale, y: (cy - offsetY)/scale };
}

// physics update
function updatePhysics(dt){
  // dt in seconds
  // check for pending wave trigger by monitoring velocity along spring displacement
  // (we compute per-point projection and compare to previous frame stored as p.prevAlong)
  for(let k=0;k<points.length;k++){
    const p = points[k];
    // ensure prevAlong exists
    if(p.prevAlong === undefined) p.prevAlong = 0;
  }
  // apply pin influences first (each pin attracts nearby points with falloff)
  for(const pin of pins){
    const r = pin.radius || pinRadius;
    for(let k=0;k<points.length;k++){
      const p = points[k];
      const dx = pin.x - p.x;
      const dy = pin.y - p.y;
      const d2 = dx*dx + dy*dy;
      const dist = Math.sqrt(d2) || 0.0001;
      // gradient falloff: 1 at center -> 0 at r (smoothly clamped)
      const falloffFactor = Math.max(0, 1 - (dist / r));
      if(falloffFactor <= 0) continue;
      // stronger stiffness near center; accentuate center influence a bit
      const pinStiff = 0.6 * Math.pow(falloffFactor, 0.9);
      // if this is the pinned point (exact index) lock it to pin center
      if(pin.pointIndex === k){
        p.x = pin.x; p.y = pin.y; p.vx = 0; p.vy = 0; p.invMass = 0;
      } else if(p.invMass !== 0){
        // apply spring towards pin position
        // scale by falloffFactor so points farther are moved less
        p.vx += dx * pinStiff * dt * 60 * strength;
        p.vy += dy * pinStiff * dt * 60 * strength;
      }
    }
  }
  // apply spring to rest
  for(let k=0;k<points.length;k++){
    const p = points[k];
    if(p.invMass === 0) {
      // keep prevAlong zero for pinned points
      p.prevAlong = 0;
      continue;
    }
    // spring towards rest position (x0,y0 transformed to canvas)
    const tx = p.x0*scale + offsetX;
    const ty = p.y0*scale + offsetY;
    const dx = tx - p.x;
    const dy = ty - p.y;
    // project current velocity onto displacement vector to detect bounce flips
    const dispLen = Math.sqrt(dx*dx + dy*dy) || 0.0001;
    const along = (p.vx*dx + p.vy*dy) / dispLen; // positive => moving toward rest
    // Hooke's law + damping
    p.vx += dx * stiffness * dt * 60;
    p.vy += dy * stiffness * dt * 60;
    p.vx *= Math.pow(damping, dt*60);
    p.vy *= Math.pow(damping, dt*60);
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    // detect bounce-back: previously moving away (prevAlong < -thresh) and now moving toward (along > thresh)
    if(pendingWave){
      const thresh = 0.5; // velocity projection threshold to consider a bounce
      if(p.prevAlong < -thresh && along > thresh){
        // trigger queued wave once, using pendingWave params
        waves.push(Object.assign({}, pendingWave));
        pendingWave = null;
        // break early: wave queued, but continue physics updates
      }
    }
    // store for next frame
    p.prevAlong = along;
  }

  // process bounce waves: propagate and apply radial velocity impulses
  if(waves.length){
    for(let i=waves.length-1;i>=0;i--){
      const w = waves[i];
      w.age += dt;
      const waveFront = w.speed * w.age;
      // if completely decayed, remove
      if(w.age > w.maxRadius / w.speed * 1.2 || w.strength * Math.exp(-w.decay * w.age) < 0.001){
        waves.splice(i,1);
        continue;
      }
      const curStrength = w.strength * Math.exp(-w.decay * w.age);
      const maxR2 = (w.maxRadius)*(w.maxRadius);
      for(let k=0;k<points.length;k++){
        const p = points[k];
        const dx = p.x - w.x;
        const dy = p.y - w.y;
        const d = Math.sqrt(dx*dx + dy*dy) || 0.0001;
        if(d > w.maxRadius) continue;
        // falloff by distance and slight band around the wave front for ripple feeling
        const band = 24 * scale; // thickness of wave front in canvas px
        const frontDelta = Math.abs(d - waveFront);
        const bandFactor = Math.max(0, 1 - (frontDelta / band));
        const distFall = Math.max(0, 1 - (d / w.maxRadius));
        // radial impulse outward
        const impulse = curStrength * bandFactor * distFall * dt * 60;
        p.vx += (dx / d) * impulse;
        p.vy += (dy / d) * impulse;
      }
    }
  }
}

// update liquids (decay & interact slightly with waves)
function updateLiquids(dt){
  for(let i=liquids.length-1;i>=0;i--){
    const L = liquids[i];
    L.age += dt;
    // slightly expand as it spreads
    L.r += dt * 8 * (1 / Math.max(0.5, liquidViscosity));
    L.alpha *= Math.max(0.96, 1 - dt * 0.3 * (liquidViscosity/2));
    if(L.age > L.life || L.alpha < 0.02) liquids.splice(i,1);
    // small interaction: spawn micro-waves as viscosity lowers (splash)
    if(Math.random() < dt * 0.6 && L.alpha > 0.05){
      waves.push({ x: L.x + (Math.random()-0.5)*L.r, y: L.y + (Math.random()-0.5)*L.r, strength: 0.2 * liquidAmount, age:0, speed: Math.max(40, liquidSpeed) * scale, decay: Math.max(0.05, 0.6/liquidViscosity), maxRadius: L.r*6 });
    }
  }
}

// apply pointer interaction: on drag, displace nearby points by vector with falloff
function applyPointerForce(px, py, dx, dy, intensity){
  // px,py in canvas coords; dx,dy are pointer delta
  const fall = falloff;
  const fall2 = fall*fall;
  for(let k=0;k<points.length;k++){
    const p = points[k];
    const ddx = p.x - px;
    const ddy = p.y - py;
    const dist2 = ddx*ddx + ddy*ddy;
    if(dist2 > fall2) continue;
    const dist = Math.sqrt(dist2) || 0.0001;
    const falloffFactor = 1 - (dist / fall);
    // apply displacement scaled by falloff and user strength
    const forceX = dx * intensity * falloffFactor;
    const forceY = dy * intensity * falloffFactor;
    p.vx += forceX;
    p.vy += forceY;
    // Optionally push further depending on distance
    p.x += forceX * 0.25;
    p.y += forceY * 0.25;
  }
}

// render: after drawing image, draw pins
function render(){
  // draw deformed image by sampling quad mapping per grid cell
  // We'll draw each cell as two triangles using drawImage with clipping via pattern:
  // ensure context smoothing follows selected mode
  ctx.imageSmoothingEnabled = !!imageSmooth;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(!imgReady) return;
  // For each cell in grid:
  const W = cols+1;
  for(let j=0;j<rows;j++){
    for(let i=0;i<cols;i++){
      const a = points[j*W + i];
      const b = points[j*W + i+1];
      const c = points[(j+1)*W + i];
      const d = points[(j+1)*W + i+1];

      // if visual preview active, apply tempOffsets only for drawing positions
      const aVis = { x: a.x, y: a.y }, bVis = { x: b.x, y: b.y }, cVis = { x: c.x, y: c.y }, dVis = { x: d.x, y: d.y };
      if(tempOffsets){
        const ia = j*W + i;
        aVis.x += tempOffsets[ia*2] || 0; aVis.y += tempOffsets[ia*2+1] || 0;
        const ib = j*W + i+1;
        bVis.x += tempOffsets[ib*2] || 0; bVis.y += tempOffsets[ib*2+1] || 0;
        const ic = (j+1)*W + i;
        cVis.x += tempOffsets[ic*2] || 0; cVis.y += tempOffsets[ic*2+1] || 0;
        const id = (j+1)*W + i+1;
        dVis.x += tempOffsets[id*2] || 0; dVis.y += tempOffsets[id*2+1] || 0;
      }

      // For each triangle (a,b,c) and (b,d,c) we map corresponding source triangle
      drawTriangleMapped({...a, x: aVis.x, y: aVis.y}, {...b, x: bVis.x, y: bVis.y}, {...c, x: cVis.x, y: cVis.y});
      drawTriangleMapped({...b, x: bVis.x, y: bVis.y}, {...d, x: dVis.x, y: dVis.y}, {...c, x: cVis.x, y: cVis.y});
    }
  }

  // draw pins as circles on canvas using DOM overlay or canvas
  // We'll draw simple circles on canvas for simplicity:
  ctx.save();
  if(!hidePins){
    for(const pin of pins){
      ctx.beginPath();
      // draw white circle outline only (no fill)
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.lineWidth = 2.5;
      ctx.arc(pin.x, pin.y, 7, 0, Math.PI*2);
      ctx.stroke();
    }
  }
  ctx.restore();

  // draw liquid overlays (tinted translucent blobs) on top of image but under pins outlines
  if(liquids.length){
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    for(const L of liquids){
      const gradR = Math.max(8, L.r);
      const g = ctx.createRadialGradient(L.x, L.y, gradR*0.15, L.x, L.y, gradR);
      // neutral (white) tint with low alpha so color doesn't dominate
      const base = hexToRgba('#ffffff', Math.max(0.06, L.alpha * 0.9));
      const mid = hexToRgba('#ffffff', Math.max(0.03, L.alpha * 0.45));
      const outer = hexToRgba('#ffffff', 0);
      let rippleBoost = 0;
      for(const w of waves){
        const d = Math.hypot(w.x - L.x, w.y - L.y);
        const front = w.speed * w.age;
        const band = 24 * scale;
        const delta = Math.abs(d - front);
        if(delta < band){
          rippleBoost = Math.max(rippleBoost, 0.35 * (1 - (delta / band)) * Math.min(1, w.strength * 0.25));
        }
      }
      g.addColorStop(0, base);
      g.addColorStop(Math.min(0.6, 0.45 + rippleBoost), mid);
      g.addColorStop(1, outer);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(L.x, L.y, gradR*1.4, gradR*0.9, 0, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// draw triangle mapping from source image triangle to dest canvas triangle
function drawTriangleMapped(p0,p1,p2){
  // source coordinates in image space
  const sx0 = p0.x0, sy0 = p0.y0;
  const sx1 = p1.x0, sy1 = p1.y0;
  const sx2 = p2.x0, sy2 = p2.y0;
  // dest coords in canvas space (original)
  let dx0 = p0.x, dy0 = p0.y;
  let dx1 = p1.x, dy1 = p1.y;
  let dx2 = p2.x, dy2 = p2.y;

  // Expand triangle slightly outward to avoid 1px cracks between triangles
  const eps = 1.4; // increased expansion to remove visible seams/cracks
  const cx = (dx0 + dx1 + dx2) / 3;
  const cy = (dy0 + dy1 + dy2) / 3;
  function pushOut(x,y){
    const vx = x - cx, vy = y - cy;
    const len = Math.sqrt(vx*vx + vy*vy) || 1;
    return { x: x + (vx/len) * eps, y: y + (vy/len) * eps };
  }
  const np0 = pushOut(dx0, dy0);
  const np1 = pushOut(dx1, dy1);
  const np2 = pushOut(dx2, dy2);
  dx0 = np0.x; dy0 = np0.y;
  dx1 = np1.x; dy1 = np1.y;
  dx2 = np2.x; dy2 = np2.y;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(dx0, dy0);
  ctx.lineTo(dx1, dy1);
  ctx.lineTo(dx2, dy2);
  ctx.closePath();
  ctx.clip();

  // source triangle (unchanged)
  const x0 = sx0, y0 = sy0, x1 = sx1, y1 = sy1, x2 = sx2, y2 = sy2;
  const X0 = dx0, Y0 = dy0, X1 = dx1, Y1 = dy1, X2 = dx2, Y2 = dy2;

  const denom = (x0*(y1 - y2) + x1*(y2 - y0) + x2*(y0 - y1));
  if(Math.abs(denom) < 1e-6){
    ctx.restore();
    return;
  }
  const a = (X0*(y1 - y2) + X1*(y2 - y0) + X2*(y0 - y1)) / denom;
  const b = (Y0*(y1 - y2) + Y1*(y2 - y0) + Y2*(y0 - y1)) / denom;
  const c = (X0*(x2 - x1) + X1*(x0 - x2) + X2*(x1 - x0)) / denom;
  const d = (Y0*(x2 - x1) + Y1*(x0 - x2) + Y2*(x1 - x0)) / denom;
  const e = (X0*(x1*y2 - x2*y1) + X1*(x2*y0 - x0*y2) + X2*(x0*y1 - x1*y0)) / denom;
  const f = (Y0*(x1*y2 - x2*y1) + Y1*(x2*y0 - x0*y2) + Y2*(x0*y1 - x1*y0)) / denom;

  // ensure pixelated drawing and avoid subpixel smoothing
  ctx.imageSmoothingEnabled = false;
  // ensure composite and antialias are neutral while drawing transformed image
  const prevComp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'source-over';
  ctx.setTransform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.setTransform(1,0,0,1,0,0);
  ctx.globalCompositeOperation = prevComp;
  ctx.restore();
}

// animation loop
let lastTime = 0;
function loop(t){
  if(!lastTime) lastTime = t;
  const dt = Math.min(0.05, (t - lastTime)/1000);
  lastTime = t;
  updateLiquids(dt);

  // pause physics during active pointer drag so previewed positions are authoritative
  if(!pointer.down){
    updatePhysics(dt);
  }
  render();

  lastPointer.x = pointer.x;
  lastPointer.y = pointer.y;

  requestAnimationFrame(loop);
}

// pointer handlers: improved for pin dragging & pin placing in pinMode
function getEventPos(e){
  if(e.touches && e.touches[0]) e = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  // map DOM (CSS) pixels to canvas coordinate space to account for CSS scaling / DPI
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

canvas.addEventListener('pointerdown', (e)=>{
  canvas.setPointerCapture(e.pointerId);
  const ppos = getEventPos(e);
  // check if clicking near an existing pin
  let hit = null;
  for(const pin of pins){
    const dx = pin.x - ppos.x, dy = pin.y - ppos.y;
    if(dx*dx + dy*dy < 10*10){ hit = pin; break; }
  }
  if(hit){
    activePin = { pin: hit, pointerId: e.pointerId };
  } else if(pinMode){
    addPinAt(ppos.x, ppos.y);
  } else {
    // start a grab — record start pos but do NOT apply forces until release
    pointer.down = true;
    pointer.dragStart = { x: ppos.x, y: ppos.y };
    pointer.moved = false;
    // initialize visual preview structures and save current grid positions as baseline
    tempOffsets = new Float32Array(points.length * 2);
    savedPositions = new Float32Array(points.length * 2);
    for(let k=0;k<points.length;k++){
      savedPositions[k*2] = points[k].x;
      savedPositions[k*2+1] = points[k].y;
    }
    currentDragDelta.x = 0; currentDragDelta.y = 0;
  }
  pointer.x = ppos.x; pointer.y = ppos.y;
  lastPointer.x = ppos.x; lastPointer.y = ppos.y;

  if(liquidEnabled && !pinMode){
    // when liquids are enabled, treat pointerdown as a pour action only and prevent normal drag/pull
    spawnPour(ppos.x, ppos.y);
    pointer.down = false;
    pointer.dragStart = null;
    // do not continue into grab behavior
    return;
  }
});

canvas.addEventListener('pointermove', (e)=>{
  const p = getEventPos(e);
  // if dragging a pin, move its attached point and update pin canvas pos
  if(activePin && activePin.pointerId === e.pointerId){
    const pin = activePin.pin;
    // compute delta and apply to nearby points with falloff so pin "grabs" an area
    const dx = p.x - pin.x, dy = p.y - pin.y;
    pin.x = p.x; pin.y = p.y;
    const r = pin.radius || pinRadius;
    for(let k=0;k<points.length;k++){
      const pt = points[k];
      const ddx = pt.x - pin.x, ddy = pt.y - pin.y;
      const dist = Math.sqrt(ddx*ddx + ddy*ddy) || 0.0001;
      const f = Math.max(0, 1 - (dist / r)); // smooth gradient 1..0
      if(f <= 0) continue;
      // amplify displacement so influence matches amount of pin movement and radius:
      // closer points move almost fully, farther points get an extra scale based on radius/dist
      const distanceBoost = Math.min(2.5, (r / dist) * 0.18); // tuned multiplier, clamped
      const moveScale = 1 + distanceBoost;
      pt.x += dx * f * moveScale;
      pt.y += dy * f * moveScale;
      pt.vx = 0; pt.vy = 0;
      // prevent this manual pin move from being interpreted as a bounce trigger
      pt.prevAlong = 0;
    }
    pointer.x = p.x; pointer.y = p.y;
    return;
  }
  // normal pointer update for dragging image: only record movement while held
  pointer.x = p.x; pointer.y = p.y;
  if(pointer.down) {
    pointer.moved = true;
    // compute current drag delta for visual preview
    currentDragDelta.x = pointer.x - (pointer.dragStart ? pointer.dragStart.x : pointer.x);
    currentDragDelta.y = pointer.y - (pointer.dragStart ? pointer.dragStart.y : pointer.y);
    // update tempOffsets per-point using same falloff logic as applyPointerForce but only for display
    if(tempOffsets && tempOffsets.length && savedPositions){
      const fall = falloff;
      const fall2 = fall*fall;
      for(let k=0;k<points.length;k++){
        const pp = points[k];
        const ddx = savedPositions[k*2] - (pointer.dragStart ? pointer.dragStart.x : pointer.x);
        const ddy = savedPositions[k*2+1] - (pointer.dragStart ? pointer.dragStart.y : pointer.y);
        const dist2 = ddx*ddx + ddy*ddy;
        if(dist2 > fall2){
          tempOffsets[k*2] = 0; tempOffsets[k*2+1] = 0;
          // restore to baseline if previously modified
          points[k].x = savedPositions[k*2];
          points[k].y = savedPositions[k*2+1];
          continue;
        }
        const dist = Math.sqrt(dist2) || 0.0001;
        const f = 1 - (dist / fall);
        // visual displacement scaled down to avoid over-stretch preview
        const ox = currentDragDelta.x * 0.6 * f;
        const oy = currentDragDelta.y * 0.6 * f;
        tempOffsets[k*2] = ox;
        tempOffsets[k*2+1] = oy;
        // apply preview directly to point positions so grid follows the mouse live
        points[k].x = savedPositions[k*2] + ox;
        points[k].y = savedPositions[k*2+1] + oy;
      }
    }
  }
});

canvas.addEventListener('pointerup', (e)=>{
  canvas.releasePointerCapture(e.pointerId);
  // if we were dragging a pin, release it
  if(activePin && activePin.pointerId === e.pointerId){
    activePin = null;
    return;
  }

  // if this was a grab-drag (not pin), apply a single impulse based on total drag delta
  if(pointer.down && pointer.dragStart){
    const dx = pointer.x - pointer.dragStart.x;
    const dy = pointer.y - pointer.dragStart.y;
    // only apply if there was meaningful movement
    const mag = Math.sqrt(dx*dx + dy*dy);
    if(mag > 1){
      // apply from the drag start position outward using falloff; scale intensity by drag magnitude
      const intensity = Math.min(3.0, 0.02 * mag * strength); // tuned multiplier
      applyPointerForce(pointer.dragStart.x, pointer.dragStart.y, dx * intensity, dy * intensity, 1.0);

      // queue a global bounce wave to trigger on first bounce-back instead of immediately
      const WAVE_THRESHOLD = waveThreshold;
      if(mag > WAVE_THRESHOLD){
        pendingWave = {
          x: pointer.dragStart.x,
          y: pointer.dragStart.y,
          strength: Math.min(12.0, 0.025 * mag * strength * waveStrengthMultiplier),
          age: 0,
          speed: Math.max(60, waveSpeedBase) * (scale),
          decay: waveDecay,
          maxRadius: Math.max(canvas.width, canvas.height) * 1.5
        };
      }

      // also give a small velocity kick to nearby points for lively bounce
      for(let k=0;k<points.length;k++){
        const p = points[k];
        const ddx = p.x - pointer.dragStart.x, ddy = p.y - pointer.dragStart.y;
        const d2 = ddx*ddx + ddy*ddy;
        const r = falloff;
        if(d2 > r*r) continue;
        const d = Math.sqrt(d2) || 0.0001;
        const f = 1 - (d / r);
        p.vx += (dx * 0.02) * f;
        p.vy += (dy * 0.02) * f;
      }
    }
  }

  // clear visual preview data and saved baselines so physics can resume from current points positions
  tempOffsets = null;
  savedPositions = null;
  currentDragDelta.x = 0; currentDragDelta.y = 0;

  pointer.down = false;
  pointer.dragStart = null;
  pointer.moved = false;
});

// helper to find nearest grid point index to canvas coord
function findNearestPointIndex(cx, cy){
  let best = {idx:-1, d2: Infinity};
  for(let i=0;i<points.length;i++){
    const p = points[i];
    const dx = p.x - cx, dy = p.y - cy;
    const d2 = dx*dx + dy*dy;
    if(d2 < best.d2){ best = {idx:i, d2}; }
  }
  return best.idx;
}

// add pin at canvas coords (attach to nearest point)
function addPinAt(cx, cy){
  if(!imgReady) return;
  // Avoid adding duplicate pins at nearly same location (use canvas coords)
  if(pins.some(p=> (Math.hypot(p.x - cx, p.y - cy) < 6))) return;
  // Create an area pin located exactly under the cursor (no snapping)
  pins.push({ x: cx, y: cy, radius: pinRadius });
  // no invMass changes — pin influence is applied dynamically while dragging
}

// clear pins
function clearPins(){
  // previous code restored invMass on a single point per-pin; now pins don't lock points so just clear
  pins.length = 0;
}

// UI events
fileInput.addEventListener('change', (ev)=>{
  const f = ev.target.files[0];
  if(!f) return;
  const url = URL.createObjectURL(f);
  img = new Image();
  img.onload = ()=>{
    imgReady = true;
    setupGridForImage();
    URL.revokeObjectURL(url);
  };
  img.src = url;
});

gridRange.addEventListener('input', ()=>{
  if(!imgReady) return;
  setupGridForImage();
});

strengthRange.addEventListener('input', ()=>{
  strength = parseFloat(strengthRange.value);
});

falloffRange.addEventListener('input', ()=>{
  falloff = parseFloat(falloffRange.value);
});

resetBtn.addEventListener('click', ()=>{
  if(!imgReady) return;
  setupGridForImage();
});

// simple mouse velocity for stronger pulls when dragging
let prevTime = performance.now();
canvas.addEventListener('pointerdown', ()=>{ prevTime = performance.now(); });
canvas.addEventListener('pointerup', ()=>{
  // on release, add a small outward impulse to nearby points based on last velocity for bounce realism
  // compute last velocity
  const dt = (performance.now() - prevTime) / 1000;
  // small effect already handled during dragging; no extra needed here
});

// UI events for pin mode and clear pins
const pinModeBtn = document.getElementById('pinMode');
const clearPinsBtn = document.getElementById('clearPins');
pinModeBtn.addEventListener('click', ()=>{
  pinMode = !pinMode;
  pinModeBtn.textContent = 'Pin mode: ' + (pinMode ? 'on' : 'off');
});
clearPinsBtn.addEventListener('click', ()=>{
  clearPins();
});

// pin radius UI binding
const pinRadiusRange = document.getElementById('pinRadiusRange');
pinRadiusRange.addEventListener('input', ()=>{
  pinRadius = parseFloat(pinRadiusRange.value);
  // update existing pins' radii to new value
  for(const pin of pins) pin.radius = pinRadius;
});

// update UI numeric displays and bind live updates
const gridVal = document.getElementById('gridVal');
const strengthVal = document.getElementById('strengthVal');
const falloffVal = document.getElementById('falloffVal');
const pinRadiusVal = document.getElementById('pinRadiusVal');

if(gridVal) gridVal.textContent = gridRange.value;
gridRange.addEventListener('input', ()=>{
  if(gridVal) gridVal.textContent = gridRange.value;
  if(imgReady) setupGridForImage();
});

if(strengthVal) strengthVal.textContent = strengthRange.value;
strengthRange.addEventListener('input', ()=>{
  strength = parseFloat(strengthRange.value);
  if(strengthVal) strengthVal.textContent = strengthRange.value;
});

if(falloffVal) falloffVal.textContent = falloffRange.value;
falloffRange.addEventListener('input', ()=>{
  falloff = parseFloat(falloffRange.value);
  if(falloffVal) falloffVal.textContent = falloffRange.value;
});

if(pinRadiusVal) pinRadiusVal.textContent = pinRadiusRange.value;
pinRadiusRange.addEventListener('input', ()=>{
  pinRadius = parseFloat(pinRadiusRange.value);
  if(pinRadiusVal) pinRadiusVal.textContent = pinRadiusRange.value;
  for(const pin of pins) pin.radius = pinRadius;
});

// bind new UI controls and numeric displays
const waveStrengthVal = document.getElementById('waveStrengthVal');
const waveSpeedVal = document.getElementById('waveSpeedVal');
const waveDecayVal = document.getElementById('waveDecayVal');
const waveThresholdVal = document.getElementById('waveThresholdVal');
const stiffnessVal = document.getElementById('stiffnessVal');
const dampingVal = document.getElementById('dampingVal');

if(waveStrengthVal) waveStrengthVal.textContent = waveStrengthRange.value;
waveStrengthRange.addEventListener('input', ()=>{
  waveStrengthMultiplier = parseFloat(waveStrengthRange.value);
  if(waveStrengthVal) waveStrengthVal.textContent = waveStrengthRange.value;
});

if(waveSpeedVal) waveSpeedVal.textContent = waveSpeedRange.value;
waveSpeedRange.addEventListener('input', ()=>{
  waveSpeedBase = parseFloat(waveSpeedRange.value);
  if(waveSpeedVal) waveSpeedVal.textContent = waveSpeedRange.value;
});

if(waveDecayVal) waveDecayVal.textContent = waveDecayRange.value;
waveDecayRange.addEventListener('input', ()=>{
  waveDecay = parseFloat(waveDecayRange.value);
  if(waveDecayVal) waveDecayVal.textContent = waveDecayRange.value;
});

if(waveThresholdVal) waveThresholdVal.textContent = waveThresholdRange.value;
waveThresholdRange.addEventListener('input', ()=>{
  waveThreshold = parseFloat(waveThresholdRange.value);
  if(waveThresholdVal) waveThresholdVal.textContent = waveThresholdRange.value;
});

if(stiffnessVal) stiffnessVal.textContent = stiffnessRange.value;
stiffnessRange.addEventListener('input', ()=>{
  stiffness = parseFloat(stiffnessRange.value);
  if(stiffnessVal) stiffnessVal.textContent = stiffnessRange.value;
});

if(dampingVal) dampingVal.textContent = dampingRange.value;
dampingRange.addEventListener('input', ()=>{
  damping = parseFloat(dampingRange.value);
  if(dampingVal) dampingVal.textContent = dampingRange.value;
});

// bind new UI elements for liquid
const liquidToggle = document.getElementById('liquidToggle');
const liquidityViscosity = document.getElementById('liquidityViscosity');
const liquidityAmount = document.getElementById('liquidityAmount');
const liquiditySpread = document.getElementById('liquiditySpread');
const liquiditySpeed = document.getElementById('liquiditySpeed');
const liquidityViscosityVal = document.getElementById('liquidityViscosityVal');
const liquidityAmountVal = document.getElementById('liquidityAmountVal');
const liquiditySpreadVal = document.getElementById('liquiditySpreadVal');
const liquiditySpeedVal = document.getElementById('liquiditySpeedVal');
const liquidPreset = document.getElementById('liquidPreset');
const liquidColorInput = document.getElementById('liquidColor');

if(liquidToggle){ liquidToggle.addEventListener('click', ()=>{ liquidEnabled = !liquidEnabled; liquidToggle.textContent = liquidEnabled ? 'on' : 'off'; }); }
if(liquidityViscosity){ liquidityViscosity.addEventListener('input', ()=>{ liquidViscosity = parseFloat(liquidityViscosity.value); liquidityViscosityVal.textContent = liquidViscosity.toFixed(1); }); }
if(liquidityAmount){ liquidityAmount.addEventListener('input', ()=>{ liquidAmount = parseFloat(liquidityAmount.value); liquidityAmountVal.textContent = String(liquidAmount); }); }
if(liquiditySpread){ liquiditySpread.addEventListener('input', ()=>{ liquidSpread = parseFloat(liquiditySpread.value); liquiditySpreadVal.textContent = String(liquidSpread); }); }
if(liquiditySpeed){ liquiditySpeed.addEventListener('input', ()=>{ liquidSpeed = parseFloat(liquiditySpeed.value); liquiditySpeedVal.textContent = String(liquidSpeed); }); }
if(liquidPreset){ liquidPreset.addEventListener('change', ()=>{
  const v = liquidPreset.value;
  if(v === 'water'){ liquidViscosity = 1.2; liquidAmount = 6; liquidSpread = 420; liquidSpeed = 900; }
  else if(v === 'milk'){ liquidViscosity = 2.4; liquidAmount = 5; liquidSpread = 320; liquidSpeed = 700; }
  else if(v === 'honey'){ liquidViscosity = 6.0; liquidAmount = 10; liquidSpread = 220; liquidSpeed = 260; }
  liquidityViscosity.value = liquidViscosity; liquidityAmount.value = liquidAmount; liquiditySpread.value = liquidSpread;
  if(liquiditySpeed) liquiditySpeed.value = liquidSpeed;
  liquidityViscosityVal.textContent = liquidViscosity.toFixed(1); liquidityAmountVal.textContent = String(liquidAmount); liquiditySpreadVal.textContent = String(liquidSpread);
  // no color updates (removed)
}); }
if(liquidColorInput){
  // keep input variable defined safely if present but ignore color changes (UI color picker removed from markup)
}

function tinyColorHex(hex){ try{ return hex; }catch(e){ return '#9ee0ff'; } }

// virtual mouse instances per timeline track to allow independent simulated pointers
const timelineVirtualPointers = {}; // trackId -> { down, dragStart: {x,y}, x,y, savedPositions, tempOffsets }

// interpolation helper: compute interpolated x,y and down state for a track at a given frame
function computeTrackStateAtFrame(track, frame) {
    if(!track || !track.keyframes || track.keyframes.length === 0) return null;
    // sort keyframes by frame for safe lookup (non-destructive)
    const kfs = track.keyframes.slice().sort((a,b)=>a.frame - b.frame);
    // find last keyframe at or before frame, and first after
    let prev = null, next = null;
    for(let i=0;i<kfs.length;i++){
        if(kfs[i].frame <= frame) prev = kfs[i];
        if(kfs[i].frame > frame){ next = kfs[i]; break; }
    }
    // determine down state by last event <= frame
    let down = false;
    if(prev){
      if(prev.type === 'release') down = false;
      else if(prev.type === 'grab' || prev.type === 'move') down = true;
    }
    // compute interpolated position
    let x = null, y = null;
    if(prev && next && typeof prev.x === 'number' && typeof next.x === 'number' && next.frame !== prev.frame){
      const t = (frame - prev.frame) / (next.frame - prev.frame);
      x = prev.x + (next.x - prev.x) * t;
      y = prev.y + (next.y - prev.y) * t;
    } else if(prev && typeof prev.x === 'number'){
      x = prev.x; y = prev.y;
    } else if(next && typeof next.x === 'number'){
      x = next.x; y = next.y;
    }
    return { down, x, y, prev, next };
}

if(window.timelineAPI){
  window.timelineAPI.onFrame = function(frame, frameFps){
    const data = window.timelineAPI.getData();
    if(!data || !data.tracks) return;
    const trackIds = Object.keys(data.tracks);

    // --- existing mouse track handling (unchanged) ---
    for(const tid of trackIds){
      const track = data.tracks[tid];
      if(!track || track.type !== 'mouse') continue;
      if(!timelineVirtualPointers[tid]){
        timelineVirtualPointers[tid] = {
          down: false,
          dragStart: null,
          x: 0, y: 0,
          tempOffsets: null,
          savedPositions: null,
          currentDragDelta: {x:0,y:0}
        };
      }
      const vptr = timelineVirtualPointers[tid];
      const state = computeTrackStateAtFrame(track, frame);
      if(!state) continue;
      // handle transitions: if became down now but wasn't before, initialize savedPositions/tempOffsets
      if(state.down && !vptr.down){
        vptr.down = true;
        vptr.dragStart = { x: state.x || 0, y: state.y || 0 };
        vptr.x = state.x || 0; vptr.y = state.y || 0;
        vptr.tempOffsets = new Float32Array(points.length * 2);
        vptr.savedPositions = new Float32Array(points.length * 2);
        for(let i=0;i<points.length;i++){
          vptr.savedPositions[i*2] = points[i].x;
          vptr.savedPositions[i*2+1] = points[i].y;
        }
        vptr.currentDragDelta.x = 0; vptr.currentDragDelta.y = 0;
      } else if(!state.down && vptr.down){
        // transition from dragging -> released: clear all preview state so physics takes over
        // commit previewed positions into physics points so simulation continues naturally
        commitVirtualPreview(vptr);
        vptr.down = false;
        vptr.dragStart = null;
        vptr.tempOffsets = null;
        vptr.savedPositions = null;
        vptr.currentDragDelta.x = 0;
        vptr.currentDragDelta.y = 0;
      }
      // update position when available and compute preview offsets if dragging
      if(typeof state.x === 'number' && typeof state.y === 'number'){
        // update pointer pos
        vptr.x = state.x; vptr.y = state.y;
        if(vptr.down && vptr.dragStart && vptr.savedPositions){
          vptr.currentDragDelta.x = vptr.x - vptr.dragStart.x;
          vptr.currentDragDelta.y = vptr.y - vptr.dragStart.y;
          const fall = falloff;
          const fall2 = fall*fall;
          for(let k=0;k<points.length;k++){
            const ddx = vptr.savedPositions[k*2] - vptr.dragStart.x;
            const ddy = vptr.savedPositions[k*2+1] - vptr.dragStart.y;
            const dist2 = ddx*ddx + ddy*ddy;
            if(dist2 > fall2){
              vptr.tempOffsets[k*2] = 0; vptr.tempOffsets[k*2+1] = 0;
              continue;
            }
            const dist = Math.sqrt(dist2) || 0.0001;
            const f = 1 - (dist / fall);
            const ox = vptr.currentDragDelta.x * 0.6 * f;
            const oy = vptr.currentDragDelta.y * 0.6 * f;
            vptr.tempOffsets[k*2] = ox;
            vptr.tempOffsets[k*2+1] = oy;
          }
        }
      }
      // if there is an exact 'release' keyframe at this frame, trigger impulse similar to manual release
      const exactReleases = track.keyframes.filter(k=>k.frame === frame && k.type === 'release');
      if(exactReleases.length){
        // use last release keyframe for coordinates
        const rel = exactReleases[exactReleases.length-1];
        // before applying impulses, commit any preview to physics so physics continues from the visual state
        commitVirtualPreview(vptr);
        const dx = (rel.x || vptr.x || 0) - (vptr.dragStart ? vptr.dragStart.x : (rel.x||0));
        const dy = (rel.y || vptr.y || 0) - (vptr.dragStart ? vptr.dragStart.y : (rel.y||0));
        const mag = Math.sqrt(dx*dx + dy*dy);
        if(mag > 0.5){
          const intensity = Math.min(3.0, 0.02 * mag * strength);
          applyPointerForce(vptr.dragStart ? vptr.dragStart.x : rel.x, vptr.dragStart ? vptr.dragStart.y : rel.y, dx * intensity, dy * intensity, 1.0);
          if(mag > waveThreshold){
            pendingWave = {
              x: vptr.dragStart ? vptr.dragStart.x : rel.x,
              y: vptr.dragStart ? vptr.dragStart.y : rel.y,
              strength: Math.min(12.0, 0.025 * mag * strength * waveStrengthMultiplier),
              age: 0,
              speed: Math.max(60, waveSpeedBase) * (scale),
              decay: waveDecay,
              maxRadius: Math.max(canvas.width, canvas.height) * 1.5
            };
          }
          for(let k=0;k<points.length;k++){
            const p = points[k];
            const ddx = p.x - (vptr.dragStart ? vptr.dragStart.x : rel.x), ddy = p.y - (vptr.dragStart ? vptr.dragStart.y : rel.y);
            const d2 = ddx*ddx + ddy*ddy;
            const r = falloff;
            if(d2 > r*r) continue;
            const d = Math.sqrt(d2) || 0.0001;
            const f = 1 - (d / r);
            p.vx += (dx * 0.02) * f;
            p.vy += (dy * 0.02) * f;
          }
        }
        // clear preview state on release and let physics run freely
        vptr.down = false;
        vptr.dragStart = null;
        vptr.tempOffsets = null;
        vptr.savedPositions = null;
        vptr.currentDragDelta.x = 0; vptr.currentDragDelta.y = 0;
        composeAllVirtualOffsets();
      } else {
        // always compose offsets so multiple tracks blend
        composeAllVirtualOffsets();
      }
    }

    // NEW: process numeric/value tracks (pinRadius and physics) each frame
    // helper to sample a numeric keyframe value for a given control within a track
    function sampleValueForControl(track, controlId, frame){
      if(!track || !track.keyframes || track.keyframes.length === 0) return null;
      // filter keyframes for this control (or global value kfs without control)
      const kfs = track.keyframes.filter(k=> (k.control ? k.control === controlId : true)).slice().sort((a,b)=>a.frame-b.frame);
      if(kfs.length === 0) return null;
      let prev = null, next = null;
      for(let i=0;i<kfs.length;i++){
        if(kfs[i].frame <= frame) prev = kfs[i];
        if(kfs[i].frame > frame){ next = kfs[i]; break; }
      }
      if(prev && next && typeof prev.value === 'number' && typeof next.value === 'number' && next.frame !== prev.frame){
        const t = (frame - prev.frame) / (next.frame - prev.frame);
        return prev.value + (next.value - prev.value) * t;
      } else if(prev && typeof prev.value === 'number') return prev.value;
      else if(next && typeof next.value === 'number') return next.value;
      return null;
    }

    // map timeline track types to controls and apply to runtime state/UI
    for(const tid of trackIds){
      const track = data.tracks[tid];
      if(!track) continue;

      // pin radius track controls a single numeric radius
      if(track.type === 'pinRadius'){
        const v = sampleValueForControl(track, 'pinRadiusRange', frame);
        if(typeof v === 'number'){
          pinRadius = v;
          // update existing pins' radii immediately so visual influence during playback shows
          for(const pin of pins) pin.radius = pinRadius;
          if(pinRadiusRange) pinRadiusRange.value = String(pinRadius);
          if(pinRadiusVal) pinRadiusVal.textContent = String(Math.round(pinRadius));
        }
      }

      // physics track contains multiple control keyframes; sample each known slider/control
      if(track.type === 'physics'){
        // list of controls we care about and how to apply them (var name and optional UI elements)
        const mapping = {
          strengthRange: (val)=>{ strength = val; if(strengthRange) strengthRange.value = String(val); if(strengthVal) strengthVal.textContent = String(val); },
          falloffRange: (val)=>{ falloff = val; if(falloffRange) falloffRange.value = String(val); if(falloffVal) falloffVal.textContent = String(val); },
          waveStrengthRange: (val)=>{ waveStrengthMultiplier = val; if(waveStrengthRange) waveStrengthRange.value = String(val); if(waveStrengthVal) waveStrengthVal.textContent = String(val); },
          waveSpeedRange: (val)=>{ waveSpeedBase = val; if(waveSpeedRange) waveSpeedRange.value = String(val); if(waveSpeedVal) waveSpeedVal.textContent = String(val); },
          waveDecayRange: (val)=>{ waveDecay = val; if(waveDecayRange) waveDecayRange.value = String(val); if(waveDecayVal) waveDecayVal.textContent = String(val); },
          waveThresholdRange: (val)=>{ waveThreshold = val; if(waveThresholdRange) waveThresholdRange.value = String(val); if(waveThresholdVal) waveThresholdVal.textContent = String(val); },
          stiffnessRange: (val)=>{ stiffness = val; if(stiffnessRange) stiffnessRange.value = String(val); if(stiffnessVal) stiffnessVal.textContent = String(val); },
          dampingRange: (val)=>{ damping = val; if(dampingRange) dampingRange.value = String(val); if(dampingVal) dampingVal.textContent = String(val); }
        };
        for(const controlId of Object.keys(mapping)){
          const sampled = sampleValueForControl(track, controlId, frame);
          if(typeof sampled === 'number'){
            mapping[controlId](sampled);
          }
        }
      }
    }

    // always recompute composed virtual offsets after applying any updates so preview shows blended state
    composeAllVirtualOffsets();
  };
}

// helper to combine offsets from all virtual pointers into the global tempOffsets used by render
function composeAllVirtualOffsets(){
  // create combined offsets array (sum of per-pointer ox/oy where defined)
  const combined = new Float32Array(points.length * 2);
  for(const tid in timelineVirtualPointers){
    const v = timelineVirtualPointers[tid];
    if(!v.tempOffsets) continue;
    for(let i=0;i<points.length;i++){
      combined[i*2] += v.tempOffsets[i*2];
      combined[i*2+1] += v.tempOffsets[i*2+1];
    }
  }
  // assign to global tempOffsets so render uses composed preview
  if(combined.some((v)=>v !== 0)){
    tempOffsets = combined;
  } else {
    tempOffsets = null;
  }
}

// helper to commit a virtual pointer's preview into actual points and give a small velocity based on drag
function commitVirtualPreview(vptr){
  if(!vptr || !vptr.savedPositions) return;
  const fall = falloff;
  const fall2 = fall*fall;
  // apply savedPositions + tempOffsets into points and give a small velocity from the last drag delta
  for(let k=0;k<points.length;k++){
    const baseX = vptr.savedPositions[k*2];
    const baseY = vptr.savedPositions[k*2+1];
    const ox = (vptr.tempOffsets && vptr.tempOffsets.length) ? vptr.tempOffsets[k*2] : 0;
    const oy = (vptr.tempOffsets && vptr.tempOffsets.length) ? vptr.tempOffsets[k*2+1] : 0;
    points[k].x = baseX + ox;
    points[k].y = baseY + oy;
    // small velocity proportional to the local displacement relative to drag start for lively release
    const ddx = baseX - (vptr.dragStart ? vptr.dragStart.x : baseX);
    const ddy = baseY - (vptr.dragStart ? vptr.dragStart.y : baseY);
    const d2 = ddx*ddx + ddy*ddy;
    if(d2 <= fall2){
      const dist = Math.sqrt(d2) || 0.0001;
      const f = 1 - (dist / fall);
      // apply velocity derived from last drag delta scaled by falloff factor
      points[k].vx += vptr.currentDragDelta.x * 0.02 * f;
      points[k].vy += vptr.currentDragDelta.y * 0.02 * f;
    }
  }
  // clear preview buffers
  vptr.tempOffsets = null;
  vptr.savedPositions = null;
  vptr.currentDragDelta.x = 0; vptr.currentDragDelta.y = 0;
}

// spawnPour: create a viscous radial wave and a liquid blob overlay
function spawnPour(cx, cy){
  const strength = Math.min(18, 0.02 * liquidAmount * 60);
  waves.push({ x: cx, y: cy, strength, age: 0, speed: Math.max(40, liquidSpeed) * (scale), decay: Math.max(0.05, 0.4 / Math.max(0.001, liquidViscosity)), maxRadius: liquidSpread });
}

// start loop
requestAnimationFrame(loop);

// tiny util: hex color + alpha => rgba string
function hexToRgba(hex, alpha=1){
  if(!hex) return `rgba(255,255,255,${alpha})`;
  const h = hex.replace('#','');
  const bigint = parseInt(h.length === 3 ? h.split('').map(c=>c+c).join('') : h, 16);
  const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}