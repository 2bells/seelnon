import { TOOLS } from '../constants.js';
import { wasmCore } from '../wasm/wasmBridge.js';

export function initFluidPaint(app) {
  const btnFluid = document.getElementById('btn-fluid');
  const panelFluid = document.getElementById('panel-fluid');
  const btnCollapse = document.getElementById('btn-fluid-collapse');

  const sliderFluidity = document.getElementById('slider-fluidity');
  const valFluidity = document.getElementById('val-fluidity');
  const sliderBristles = document.getElementById('slider-bristles');
  const valBristles = document.getElementById('val-bristles');

  // Register panel draggable
  if (app._makeDraggable && panelFluid) {
    app._makeDraggable(panelFluid, document.getElementById('handle-fluid'));
  }

  // Event listeners
  if (btnCollapse) {
    btnCollapse.onclick = () => {
      const content = document.getElementById('fluid-content');
      if (content) {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'flex' : 'none';
        btnCollapse.innerText = isHidden ? '_' : '+';
      }
    };
  }

  if (sliderFluidity) {
    sliderFluidity.oninput = () => {
      const v = parseFloat(sliderFluidity.value);
      if (valFluidity) valFluidity.innerText = `${v}%`;
    };
  }

  if (sliderBristles) {
    sliderBristles.oninput = () => {
      const v = parseInt(sliderBristles.value);
      if (valBristles) valBristles.innerText = v;
    };
  }

  // Bind new performance & paint physics sliders
  const setupSlider = (sliderId, valId, defaultVal) => {
    const slider = document.getElementById(sliderId);
    const val = document.getElementById(valId);
    if (slider) {
      const saved = localStorage.getItem('fluid_setting_' + sliderId);
      if (saved !== null) {
        slider.value = saved;
      } else {
        slider.value = defaultVal;
      }
      if (val) val.innerText = `${slider.value}%`;

      slider.oninput = () => {
        if (val) val.innerText = `${slider.value}%`;
        localStorage.setItem('fluid_setting_' + sliderId, slider.value);
      };
    }
  };

  setupSlider('slider-fluid-flow', 'val-fluid-flow', 100);
  setupSlider('slider-fluid-vortex', 'val-fluid-vortex', 50);
  setupSlider('slider-fluid-turb', 'val-fluid-turb', 50);
  setupSlider('slider-fluid-retention', 'val-fluid-retention', 0);
  setupSlider('slider-fluid-pickup', 'val-fluid-pickup', 75);
  setupSlider('slider-fluid-depth', 'val-fluid-depth', 75);
  setupSlider('slider-fluid-gloss', 'val-fluid-gloss', 5);

  const chkShading = document.getElementById('chk-surface-shading');
  if (chkShading) {
    const savedShading = localStorage.getItem('fluid_setting_chk-surface-shading');
    if (savedShading !== null) {
      chkShading.checked = savedShading === 'true';
    }
    chkShading.onchange = () => {
      localStorage.setItem('fluid_setting_chk-surface-shading', chkShading.checked);
    };
  }
}

export function activateFluidPaint(app) {
  const panel = document.getElementById('panel-fluid');
  if (panel) panel.classList.remove('hidden');

  // Hide WebGL canvas overlays as we draw directly inside our 2D chunks space
  const canvas = document.getElementById('fluid-canvas');
  if (canvas) canvas.classList.add('hidden');

  app._status('NATIVE FLUID BRUSH ACTIVE');
}

export function deactivateFluidPaint(app) {
  const panel = document.getElementById('panel-fluid');
  if (panel) panel.classList.add('hidden');

  app._status('FLUID BRUSH DEACTIVATED');
}

// ----------------------------------------------------
// COLOR HELPERS
// ----------------------------------------------------
function hexToRgb(hex) {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  let fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

// ----------------------------------------------------
// PERSISTENT SCRATCH BUFFERS FOR HIGH-PERFORMANCE FLUID SOLVING
// ----------------------------------------------------
let scratchBufferA = null;
let scratchBufferB = null;

function getScratchA(size) {
  if (!scratchBufferA || scratchBufferA.length < size) {
    scratchBufferA = new Uint8ClampedArray(size);
  }
  return scratchBufferA;
}

function getScratchB(size) {
  if (!scratchBufferB || scratchBufferB.length < size) {
    scratchBufferB = new Uint8ClampedArray(size);
  }
  return scratchBufferB;
}

// ----------------------------------------------------
// CAPSULE DISTANCE HELPER FOR LINE BOUNDED DYNAMICS
// ----------------------------------------------------
function getSqDistanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const dax = px - ax;
    const day = py - ay;
    return dax * dax + day * day;
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const rx = px - (ax + t * dx);
  const ry = py - (ay + t * dy);
  return rx * rx + ry * ry;
}

// ----------------------------------------------------
// BRUSH STROKE EXECUTION HANDLER
// ----------------------------------------------------
export function paintFluidOnChunks(engine, from, to, size, opacity, color) {
  const strokeDx = to.x - from.x;
  const strokeDy = to.y - from.y;
  const strokeDist = Math.sqrt(strokeDx * strokeDx + strokeDy * strokeDy);

  const maxSubStepDist = Math.max(24, size * 0.45);
  if (strokeDist > maxSubStepDist) {
    const steps = Math.min(3, Math.ceil(strokeDist / maxSubStepDist));
    let prev = from;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const subTo = {
        x: from.x + strokeDx * t,
        y: from.y + strokeDy * t
      };
      _paintFluidSegment(engine, prev, subTo, size, opacity, color);
      prev = subTo;
    }
  } else {
    _paintFluidSegment(engine, from, to, size, opacity, color);
  }
}

function _paintFluidSegment(engine, from, to, size, opacity, color) {
  // Cap the calculation and fluid displacement size to prevent lagging on larger brushes
  const calcSize = Math.min(size, 20);

  // 1. Determine local bounding box of the brush movement
  // The bristles stamp outward up to tempBristleRadiusScale = size * 0.45, with bristle size up to size * 0.15.
  // To fully enclose the stamped pixels, the padding covers the full physical footprint of the brush.
  const tempBristleRadiusScale = size * 0.45;
  const tempBristleSize = Math.max(2.0, size * 0.15);
  const maxBristleReach = tempBristleRadiusScale + (tempBristleSize * 0.5) + 3;
  const pad = Math.max(25, maxBristleReach);

  const minX = Math.floor(Math.min(from.x, to.x) - pad);
  const maxX = Math.ceil(Math.max(from.x, to.x) + pad);
  const minY = Math.floor(Math.min(from.y, to.y) - pad);
  const maxY = Math.ceil(Math.max(from.y, to.y) + pad);

  // Safeguard viewport bounds (allow up to 2048 to support 1500px brush sizes)
  const w = maxX - minX;
  const h = maxY - minY;
  if (w <= 0 || h <= 0 || w > 2048 || h > 2048) return;

  // 2. Identify overlapping layered chunks
  const sCX = engine.isStatic ? 0 : Math.floor(minX / engine.chunkSize);
  const eCX = engine.isStatic ? 0 : Math.floor(maxX / engine.chunkSize);
  const sCY = engine.isStatic ? 0 : Math.floor(minY / engine.chunkSize);
  const eCY = engine.isStatic ? 0 : Math.floor(maxY / engine.chunkSize);

  const affectedChunks = new Map();
  for (let cx = sCX; cx <= eCX; cx++) {
    for (let cy = sCY; cy <= eCY; cy++) {
      const id = `${cx},${cy}`;
      const chunk = engine._getChunk(cx, cy);
      if (chunk) {
        affectedChunks.set(id, { cx, cy });
      }
    }
  }
  if (affectedChunks.size === 0) return;

  // Back up history blocks
  affectedChunks.forEach((info, id) => {
    const chunk = engine._getChunk(info.cx, info.cy);
    if (chunk && engine.isDrawing && !engine.currentStrokeDirtyChunks.has(id)) {
      const srcCanvas = chunk.canvases[engine.activeLayer];
      const backup = document.createElement('canvas');
      backup.width = srcCanvas.width;
      backup.height = srcCanvas.height;
      backup.getContext('2d').drawImage(srcCanvas, 0, 0);
      engine.currentStrokeDirtyChunks.set(id, { layer: engine.activeLayer, canvas: backup });
      engine._markDirty(id, engine.activeLayer);
    }
  });

  // 3. Composite original chunk pixels into a single segment canvas
  if (!engine.segmentCanvas) {
    engine.segmentCanvas = document.createElement('canvas');
    engine.segmentCtx = engine.segmentCanvas.getContext('2d', { willReadFrequently: true });
  }
  if (engine.segmentCanvas.width < w || engine.segmentCanvas.height < h) {
    engine.segmentCanvas.width = Math.max(engine.segmentCanvas.width, w + 128);
    engine.segmentCanvas.height = Math.max(engine.segmentCanvas.height, h + 128);
  }

  const sCtx = engine.segmentCtx;
  sCtx.clearRect(0, 0, w, h);

  affectedChunks.forEach((info, id) => {
    const chunk = engine._getChunk(info.cx, info.cy);
    if (chunk) {
      const lx = engine.isStatic ? -engine.staticWidth / 2 : info.cx * engine.chunkSize;
      const ly = engine.isStatic ? -engine.staticHeight / 2 : info.cy * engine.chunkSize;
      sCtx.drawImage(chunk.canvases[engine.activeLayer], lx - minX, ly - minY, chunk.width, chunk.height);
    }
  });

  // 4. Retrieve pixel data and setup high-fidelity height-maps
  const imgData = sCtx.getImageData(0, 0, w, h);
  const pixels = imgData.data;

  const segmentHeight = new Float32Array(w * h);

  affectedChunks.forEach((info, id) => {
    const chunk = engine._getChunk(info.cx, info.cy);
    if (chunk) {
      if (!chunk.layerHeights) {
        chunk.layerHeights = [];
      }
      if (!chunk.layerHeights[engine.activeLayer]) {
        chunk.layerHeights[engine.activeLayer] = new Float32Array(chunk.width * chunk.height);
        const ctx = chunk.ctxs[engine.activeLayer];
        const existingData = ctx.getImageData(0, 0, chunk.width, chunk.height);
        const hMap = chunk.layerHeights[engine.activeLayer];
        for (let i = 0; i < hMap.length; i++) {
          hMap[i] = existingData.data[i * 4 + 3] / 255.0; // range [0, 1]
        }
      }

      const hMap = chunk.layerHeights[engine.activeLayer];
      const lx = engine.isStatic ? -engine.staticWidth / 2 : info.cx * engine.chunkSize;
      const ly = engine.isStatic ? -engine.staticHeight / 2 : info.cy * engine.chunkSize;

      const cyStart = Math.max(0, minY - ly);
      const cyEnd = Math.min(chunk.height, maxY - ly);
      const cxStart = Math.max(0, minX - lx);
      const cxEnd = Math.min(chunk.width, maxX - lx);

      for (let cy = cyStart; cy < cyEnd; cy++) {
        const wy = ly + cy;
        const sy = wy - minY;
        if (sy < 0 || sy >= h) continue;
        const cRow = cy * chunk.width;
        const sRow = sy * w;
        for (let cx = cxStart; cx < cxEnd; cx++) {
          const wx = lx + cx;
          const sx = wx - minX;
          if (sx < 0 || sx >= w) continue;

          // Clear heights where the underlying pixels has been completely erased/cleared
          const segIdx = sRow + sx;
          if (pixels[segIdx * 4 + 3] === 0) {
            segmentHeight[segIdx] = 0;
          } else {
            segmentHeight[segIdx] = hMap[cRow + cx];
          }
        }
      }
    }
  });

  // 5. Apply fresh paint on the pixel buffer under the brush bristles
  const brushColor = hexToRgb(color);
  const flow = engine.brush.flow || 0.5;

  const bristleSlider = document.getElementById('slider-bristles');
  const bristleCount = bristleSlider ? parseInt(bristleSlider.value) : 40;

  const strokeDx = to.x - from.x;
  const strokeDy = to.y - from.y;
  const strokeDist = Math.sqrt(strokeDx*strokeDx + strokeDy*strokeDy);
  let nx = 0, ny = 0;
  if (strokeDist > 0.1) {
    nx = -strokeDy / strokeDist;
    ny = strokeDx / strokeDist;
  }
  
  const isRYB = false;
  const fluiditySlider = document.getElementById('slider-fluidity');
  const fluidityVal = fluiditySlider ? parseFloat(fluiditySlider.value) : 80;

  // Retrieve fine-tuning slider values dynamically with solid, robust defaults
  const getFineSlider = (id, def) => {
    const el = document.getElementById(id);
    return el ? parseFloat(el.value) : def;
  };

  const valFlow = getFineSlider('slider-fluid-flow', 30);
  const valVortex = getFineSlider('slider-fluid-vortex', 30);
  const valTurb = getFineSlider('slider-fluid-turb', 22);
  const valRetention = getFineSlider('slider-fluid-retention', 80);
  const valPickup = getFineSlider('slider-fluid-pickup', 35);
  const valDepth = getFineSlider('slider-fluid-depth', 40);
  const valGloss = getFineSlider('slider-fluid-gloss', 35);

  // Dynamic bristle optimization for large brush sizes is much more relaxed now because of the cap on active simulation grid size
  let activeBristleCount = bristleCount;
  if (size > 40) {
    const scale = 40 / size;
    activeBristleCount = Math.max(12, Math.round(bristleCount * scale));
  }

  // Persistent / cached wet bristle offsets with dynamic colors for smearing/wet-on-wet paint transfers
  let bristleOffsets = engine._fluidBristles;
  const bristleRadiusScale = size * 0.45;

  if (!bristleOffsets) {
    bristleOffsets = [];
    let sampledFromTip = false;

    if (engine.brush && engine.brush.tip) {
      const tip = engine.brush.tip;
      if (!tip._cachedNormalizedCoordinates) {
        try {
          const tCtx = tip.getContext('2d');
          if (tCtx) {
            const tWidth = tip.width;
            const tHeight = tip.height;
            const imgData = tCtx.getImageData(0, 0, tWidth, tHeight);
            const coords = [];
            if (imgData) {
              const data = imgData.data;
              const centerX = tWidth / 2;
              const centerY = tHeight / 2;
              const maxRadius = Math.max(centerX, centerY) || 1;
              for (let ty = 0; ty < tHeight; ty += 2) {
                for (let tx = 0; tx < tWidth; tx += 2) {
                  const idx = (ty * tWidth + tx) * 4;
                  const r = data[idx];
                  const g = data[idx + 1];
                  const b = data[idx + 2];
                  const a = data[idx + 3];
                  
                  const brightness = (r + g + b) / 3.0;
                  const density = (a / 255.0) * (1.0 - brightness / 255.0);
                  if (density > 0.08) {
                    coords.push({
                      ndx: (tx - centerX) / maxRadius,
                      ndy: (ty - centerY) / maxRadius,
                      density: density
                    });
                  }
                }
              }
              tip._cachedNormalizedCoordinates = coords;
            }
          }
        } catch (e) {
          console.warn("Failed sampling brush tip texture for fluid bristles:", e);
        }
      }

      const coords = tip._cachedNormalizedCoordinates;
      if (coords && coords.length > 0) {
        sampledFromTip = true;
        for (let b = 0; b < activeBristleCount; b++) {
          const randItem = coords[Math.floor(Math.random() * coords.length)];
          const jitterX = (Math.random() - 0.5) * 0.04;
          const jitterY = (Math.random() - 0.5) * 0.04;
          bristleOffsets.push({
            ndx: Math.max(-1.0, Math.min(1.0, randItem.ndx + jitterX)),
            ndy: Math.max(-1.0, Math.min(1.0, randItem.ndy + jitterY)),
            alpha: (0.18 + Math.random() * 0.22) * randItem.density,
            r: brushColor.r,
            g: brushColor.g,
            b: brushColor.b
          });
        }
      }
    }

    if (!sampledFromTip) {
      for (let b = 0; b < activeBristleCount; b++) {
        const angle = (b / activeBristleCount) * Math.PI * 2 + Math.random() * 0.4;
        const radiusFraction = 0.15 + 0.85 * Math.sqrt(Math.random());
        bristleOffsets.push({
          ndx: Math.cos(angle) * radiusFraction,
          ndy: Math.sin(angle) * radiusFraction,
          alpha: 0.22 + Math.random() * 0.28,
          r: brushColor.r,
          g: brushColor.g,
          b: brushColor.b
        });
      }
    }

    if (engine.isDrawing) {
      engine._fluidBristles = bristleOffsets;
    }
  }

  // Optimize stamp intervals dynamically.
  const stampSpacing = Math.max(1.8, size * 0.16);
  const numStamps = Math.max(1, Math.ceil(strokeDist / stampSpacing));

  // Blend wet pickup dynamically as brush moves
  const pickupRate = 0.35 * (valPickup / 100.0) * (fluidityVal / 100.0);
  const reservoirReplenish = 0.05 + 0.95 * (valRetention / 100.0);

  // CRITICAL FIX: Snapshot original pixels before stamping using zero-alloc scratch buffer
  // This completely breaks positive feedback loops while avoiding GC pressure
  const originalPixels = getScratchB(pixels.length).subarray(0, pixels.length);
  originalPixels.set(pixels);

  for (let step = 0; step <= numStamps; step++) {
    const t = step / numStamps;
    const bX = from.x + strokeDx * t - minX;
    const bY = from.y + strokeDy * t - minY;

    for (let bo = 0; bo < bristleOffsets.length; bo++) {
      const bristle = bristleOffsets[bo];
      const px = Math.round(bX + bristle.ndx * bristleRadiusScale);
      const py = Math.round(bY + bristle.ndy * bristleRadiusScale);

      if (px >= 0 && px < w && py >= 0 && py < h) {
        // Core reservoir replenishment: constant streaming of clean selected paint color
        bristle.r = bristle.r * (1.0 - reservoirReplenish) + brushColor.r * reservoirReplenish;
        bristle.g = bristle.g * (1.0 - reservoirReplenish) + brushColor.g * reservoirReplenish;
        bristle.b = bristle.b * (1.0 - reservoirReplenish) + brushColor.b * reservoirReplenish;

        // Sample unmodified background canvas color from originalPixels snapshot
        const sampleIdx = (py * w + px) * 4;
        const canvasAlpha = originalPixels[sampleIdx + 3];
        if (canvasAlpha > 10) {
          const canvasR = originalPixels[sampleIdx];
          const canvasG = originalPixels[sampleIdx + 1];
          const canvasB = originalPixels[sampleIdx + 2];
          
          // Smudge / load the bristle with canvas color
          bristle.r = bristle.r * (1.0 - pickupRate) + canvasR * pickupRate;
          bristle.g = bristle.g * (1.0 - pickupRate) + canvasG * pickupRate;
          bristle.b = bristle.b * (1.0 - pickupRate) + canvasB * pickupRate;
        }

        // Scale individual bristle diameter dynamically with the number of bristles to keep them distinct, fine, and beautiful
        const bristleSizeFactor = 0.45 / Math.sqrt(activeBristleCount);
        const bristleSize = Math.max(1.2, size * bristleSizeFactor);
        const bsR = bristleSize * 0.5;
        const bsSq = bsR * bsR;

        const startPX = Math.max(0, Math.floor(px - bsR));
        const endPX = Math.min(w - 1, Math.ceil(px + bsR));
        const startPY = Math.max(0, Math.floor(py - bsR));
        const endPY = Math.min(h - 1, Math.ceil(py + bsR));

        for (let y = startPY; y <= endPY; y++) {
          const dy = y - py;
          const dySq = dy * dy;
          for (let x = startPX; x <= endPX; x++) {
            const dx = x - px;
            const distSq = dx * dx + dySq;
            if (distSq < bsSq) {
              const dRatio = Math.sqrt(distSq) / bsR;
              const falloff = 1.0 - dRatio * dRatio;
              const blendFactor = falloff * bristle.alpha * opacity * flow * 0.7;

              const idx = (y * w + x) * 4;
              const bgAlpha = pixels[idx+3] / 255.0;
              const dstAlpha = blendFactor;
              const outAlpha = bgAlpha + dstAlpha * (1.0 - bgAlpha);

              if (outAlpha > 0) {
                const bgWeight = bgAlpha * (1.0 - dstAlpha) / outAlpha;
                const fgWeight = dstAlpha / outAlpha;

                if (isRYB) {
                  // Subtractive mixing with active bristle's color and scaled darkening
                  const darkFactor = bgAlpha * fgWeight * 0.03 * (valPickup / 100.0);
                  const rMix = Math.round((pixels[idx] * bgWeight + bristle.r * fgWeight) - darkFactor * (255 - pixels[idx]));
                  const gMix = Math.round((pixels[idx+1] * bgWeight + bristle.g * fgWeight) - darkFactor * (255 - pixels[idx+1]));
                  const bMix = Math.round((pixels[idx+2] * bgWeight + bristle.b * fgWeight) - darkFactor * (255 - pixels[idx+2]));

                  pixels[idx] = rMix < 0 ? 0 : (rMix > 255 ?  255 : rMix);
                  pixels[idx + 1] = gMix < 0 ? 0 : (gMix > 255 ? 255 : gMix);
                  pixels[idx + 2] = bMix < 0 ? 0 : (bMix > 255 ? 255 : bMix);
                } else {
                  // Standard RGB mixing with bristle color
                  pixels[idx] = Math.round(pixels[idx] * bgWeight + bristle.r * fgWeight);
                  pixels[idx + 1] = Math.round(pixels[idx + 1] * bgWeight + bristle.g * fgWeight);
                  pixels[idx + 2] = Math.round(pixels[idx + 2] * bgWeight + bristle.b * fgWeight);
                }
              }
              // Accumulate physical impasto paint thickness gently with gorgeous continuous bristle groove bumps
              const heightIdx = y * w + x;
              const currentH = segmentHeight[heightIdx];
              const perpDist = x * nx + y * ny;
              const ridgeNoise = Math.sin(perpDist * 1.1) * 0.16 + Math.sin(perpDist * 2.8) * 0.08 + (Math.random() - 0.5) * 0.05;
              const buildFactor = 0.08 * (valDepth / 100.0) * (1.0 + ridgeNoise);
              segmentHeight[heightIdx] = Math.max(outAlpha, Math.min(2.5, currentH + dstAlpha * buildFactor));
              pixels[idx + 3] = Math.max(pixels[idx + 3], Math.min(255, Math.round(segmentHeight[heightIdx] * 255)));
            }
          }
        }
      }
    }
  }

  // 6. Define the fluid velocity field (Accelerated via Rust WASM)
  const CELL_SIZE = 6;
  const invCellSize = 1.0 / CELL_SIZE;
  const cols = Math.ceil(w / CELL_SIZE);
  const rows = Math.ceil(h / CELL_SIZE);
  const u = new Float32Array(cols * rows);
  const v = new Float32Array(cols * rows);

  const ax = from.x - minX;
  const ay = from.y - minY;
  const bx = to.x - minX;
  const by = to.y - minY;

  // Very localized and gentle fluidity flow velocity (stops space-distortion/liquify look)
  const speedCap = Math.min(6.2, strokeDist * 0.45);
  const dragRatio = strokeDist > 0 ? (speedCap / strokeDist) : 0;
  const capDx = strokeDx * dragRatio;
  const capDy = strokeDy * dragRatio;

  // Dampen force on oversized brushes
  const brushPowerDamping = Math.max(0.4, Math.min(1.0, 120.0 / (size + 60.0)));

  if (strokeDist > 0) {
    const wasmVelOk = wasmCore.fluidComputeVelocityField(
      u,
      v,
      cols,
      rows,
      CELL_SIZE,
      ax,
      ay,
      bx,
      by,
      capDx,
      capDy,
      calcSize * 0.95,
      brushPowerDamping,
      speedCap,
      valVortex,
      valTurb
    );

    if (!wasmVelOk) {
      for (let cy = 0; cy < rows; cy++) {
        const py = cy * CELL_SIZE + CELL_SIZE * 0.5;
        for (let cx = 0; cx < cols; cx++) {
          const px = cx * CELL_SIZE + CELL_SIZE * 0.5;

          // Bounded within stroke line segment capsule
          const distSq = getSqDistanceToSegment(px, py, ax, ay, bx, by);
          const distToSegment = Math.sqrt(distSq);

          const localActiveRadius = calcSize * 0.95;
          if (distToSegment < localActiveRadius) {
            const ratio = distToSegment / localActiveRadius;
            const force = Math.pow(1.0 - ratio * ratio, 2.0);

            let cellU = capDx * 0.58 * force * brushPowerDamping;
            let cellV = capDy * 0.58 * force * brushPowerDamping;

            const dxAB = bx - ax;
            const dyAB = by - ay;
            const lenSq = dxAB * dxAB + dyAB * dyAB;
            let projX = ax, projY = ay;
            if (lenSq > 0) {
              let t = ((px - ax) * dxAB + (py - ay) * dyAB) / lenSq;
              t = Math.max(0, Math.min(1, t));
              projX = ax + t * dxAB;
              projY = ay + t * dyAB;
            }
            const normalX = px - projX;
            const normalY = py - projY;
            const distToSegmentNormal = Math.sqrt(normalX * normalX + normalY * normalY) || 1.0;

            const swirlPower = speedCap * 1.5 * (valVortex / 100.0) * brushPowerDamping;
            cellU += (-normalY / distToSegmentNormal) * swirlPower * force;
            cellV += (normalX / distToSegmentNormal) * swirlPower * force;

            const noiseU = Math.sin(py * 0.08 + px * 0.06) * speedCap * 1.0 * (valTurb / 100.0) * force * brushPowerDamping;
            const noiseV = Math.cos(px * 0.08 - py * 0.06) * speedCap * 1.0 * (valTurb / 100.0) * force * brushPowerDamping;

            const gridIdx = cx + cy * cols;
            u[gridIdx] = cellU + noiseU;
            v[gridIdx] = cellV + noiseV;
          }
        }
      }
    }
  }

  // 7. Perform Semi-Lagrangian Advection + 8. Surface Shading in Rust WASM
  const nextPixels = getScratchA(pixels.length).subarray(0, pixels.length);
  const nextHeight = new Float32Array(w * h);
  const dt = 0.4 * (valFlow / 100.0) * (fluidityVal / 100.0); // Fluid flow speed slider
  const isImpasto = document.getElementById('chk-surface-shading')?.checked !== false;

  const wasmFluidOk = wasmCore.fluidAdvectAndShade(
    pixels,
    nextPixels,
    segmentHeight,
    nextHeight,
    u,
    v,
    w,
    h,
    cols,
    rows,
    CELL_SIZE,
    ax,
    ay,
    bx,
    by,
    calcSize,
    dt,
    valGloss,
    isImpasto
  );

  if (!wasmFluidOk) {
    for (let Y = 0; Y < h; Y++) {
      for (let X = 0; X < w; X++) {
        const destIdx = (Y * w + X) * 4;

        const distSq = getSqDistanceToSegment(X, Y, ax, ay, bx, by);
        const outerBoundary = calcSize * 1.5;
        if (distSq > outerBoundary * outerBoundary) {
          nextPixels[destIdx] = pixels[destIdx];
          nextPixels[destIdx+1] = pixels[destIdx+1];
          nextPixels[destIdx+2] = pixels[destIdx+2];
          nextPixels[destIdx+3] = pixels[destIdx+3];
          nextHeight[Y * w + X] = segmentHeight[Y * w + X];
          continue;
        }

        const cellX = X * invCellSize;
        const cellY = Y * invCellSize;
        const cellX0 = cellX | 0;
        const cellY0 = cellY | 0;
        const cellX1 = cellX0 < cols - 1 ? cellX0 + 1 : cols - 1;
        const cellY1 = cellY0 < rows - 1 ? cellY0 + 1 : rows - 1;

        const tx = cellX - cellX0;
        const ty = cellY - cellY0;

        const idx00 = cellX0 + cellY0 * cols;
        const idx10 = cellX1 + cellY0 * cols;
        const idx01 = cellX0 + cellY1 * cols;
        const idx11 = cellX1 + cellY1 * cols;

        const velX = (1.0 - tx) * ((1.0 - ty) * u[idx00] + ty * u[idx01]) + tx * ((1.0 - ty) * u[idx10] + ty * u[idx11]);
        const velY = (1.0 - tx) * ((1.0 - ty) * v[idx00] + ty * v[idx01]) + tx * ((1.0 - ty) * v[idx10] + ty * v[idx11]);

        const srcX = X - velX * dt;
        const srcY = Y - velY * dt;

        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);
        
        const x1 = x0 < w - 1 ? (x0 < 0 ? 0 : x0 + 1) : w - 1;
        const y1 = y0 < h - 1 ? (y0 < 0 ? 0 : y0 + 1) : h - 1;
        const clampedX0 = x0 < 0 ? 0 : (x0 >= w ? w - 1 : x0);
        const clampedY0 = y0 < 0 ? 0 : (y0 >= h ? h - 1 : y0);

        const s1 = srcX - x0;
        const s0 = 1.0 - s1;
        const t1 = srcY - y0;
        const t0 = 1.0 - t1;

        const pix00 = (clampedY0 * w + clampedX0) * 4;
        const pix10 = (clampedY0 * w + x1) * 4;
        const pix01 = (y1 * w + clampedX0) * 4;
        const pix11 = (y1 * w + x1) * 4;

        const a00 = pixels[pix00 + 3];
        const a10 = pixels[pix10 + 3];
        const a01 = pixels[pix01 + 3];
        const a11 = pixels[pix11 + 3];

        const w00 = s0 * t0 * a00;
        const w10 = s1 * t0 * a10;
        const w01 = s0 * t1 * a01;
        const w11 = s1 * t1 * a11;

        const sumW = w00 + w10 + w01 + w11;
        let advectedR, advectedG, advectedB;
        if (sumW > 0.1) {
          advectedR = (w00 * pixels[pix00] + w10 * pixels[pix10] + w01 * pixels[pix01] + w11 * pixels[pix11]) / sumW;
          advectedG = (w00 * pixels[pix00+1] + w10 * pixels[pix10+1] + w01 * pixels[pix01+1] + w11 * pixels[pix11+1]) / sumW;
          advectedB = (w00 * pixels[pix00+2] + w10 * pixels[pix10+2] + w01 * pixels[pix01+2] + w11 * pixels[pix11+2]) / sumW;
        } else {
          advectedR = s0 * (t0 * pixels[pix00] + t1 * pixels[pix01]) + s1 * (t0 * pixels[pix10] + t1 * pixels[pix11]);
          advectedG = s0 * (t0 * pixels[pix00+1] + t1 * pixels[pix01+1]) + s1 * (t0 * pixels[pix10+1] + t1 * pixels[pix11+1]);
          advectedB = s0 * (t0 * pixels[pix00+2] + t1 * pixels[pix01+2]) + s1 * (t0 * pixels[pix10+2] + t1 * pixels[pix11+2]);
        }

        const h00 = segmentHeight[clampedY0 * w + clampedX0];
        const h10 = segmentHeight[clampedY0 * w + x1];
        const h01 = segmentHeight[y1 * w + clampedX0];
        const h11 = segmentHeight[y1 * w + x1];

        const origAlpha = pixels[destIdx+3];
        const origHeight = segmentHeight[Y * w + X];

        let advHeight = s0 * (t0 * h00 + t1 * h01) + s1 * (t0 * h10 + t1 * h11);
        if (origAlpha > 10 && advHeight < origHeight * 0.5) {
          advHeight = Math.max(advHeight, origHeight * 0.7);
        }

        const dist = Math.sqrt(distSq);
        const innerBoundary = calcSize * 0.45;
        let blendFactor = 1.0;
        if (dist > innerBoundary) {
          const t = (dist - innerBoundary) / (outerBoundary - innerBoundary);
          const clampedT = Math.max(0.0, Math.min(1.0, t));
          blendFactor = 1.0 - (clampedT * clampedT * (3.0 - 2.0 * clampedT));
        }

        const origR = pixels[destIdx];
        const origG = pixels[destIdx+1];
        const origB = pixels[destIdx+2];

        const resR = origR + (advectedR - origR) * blendFactor;
        const resG = origG + (advectedG - origG) * blendFactor;
        const resB = origB + (advectedB - origB) * blendFactor;

        const finalHeight = origHeight + (advHeight - origHeight) * blendFactor;
        const advAlpha = Math.max(origAlpha, Math.min(255, Math.round(finalHeight * 255)));
        const finalAlpha = origAlpha + (advAlpha - origAlpha) * blendFactor;

        nextPixels[destIdx] = Math.max(0, Math.min(255, Math.round(resR)));
        nextPixels[destIdx+1] = Math.max(0, Math.min(255, Math.round(resG)));
        nextPixels[destIdx+2] = Math.max(0, Math.min(255, Math.round(resB)));
        nextPixels[destIdx+3] = Math.max(0, Math.min(255, Math.round(finalAlpha)));
        nextHeight[Y * w + X] = finalHeight;
      }
    }

    if (isImpasto) {
      for (let Y = 1; Y < h - 1; Y++) {
        for (let X = 1; X < w - 1; X++) {
          const distSq = getSqDistanceToSegment(X, Y, ax, ay, bx, by);
          const outerBoundary = calcSize * 1.5;
          if (distSq > outerBoundary * outerBoundary) continue;

          const dist = Math.sqrt(distSq);
          const innerBoundary = calcSize * 0.45;
          let shadingBlend = 1.0;
          if (dist > innerBoundary) {
            const t = (dist - innerBoundary) / (outerBoundary - innerBoundary);
            const clampedT = Math.max(0.0, Math.min(1.0, t));
            shadingBlend = 1.0 - (clampedT * clampedT * (3.0 - 2.0 * clampedT));
          }

          const h00 = nextHeight[Y * w + (X - 1)];
          const h10 = nextHeight[Y * w + (X + 1)];
          const h01 = nextHeight[(Y - 1) * w + X];
          const h11 = nextHeight[(Y + 1) * w + X];

          const dh_dx = h10 - h00;
          const dh_dy = h11 - h01;
          const dot = -dh_dx * (-0.5) - dh_dy * (-0.5);

          const destIdx = (Y * w + X) * 4;
          const rOrig = nextPixels[destIdx];
          const gOrig = nextPixels[destIdx+1];
          const bOrig = nextPixels[destIdx+2];
          let rS, gS, bS;

          if (dot >= 0) {
            const valHighlight = dot * valGloss * shadingBlend;
            rS = rOrig + valHighlight * 1.15;
            gS = gOrig + valHighlight * 1.0;
            bS = bOrig + valHighlight * 0.4;
          } else {
            const valShadow = Math.abs(dot) * valGloss * shadingBlend;
            rS = rOrig - valShadow * 1.25;
            gS = gOrig - valShadow * 1.0;
            bS = bOrig - valShadow * 0.45;
          }

          nextPixels[destIdx] = Math.max(0, Math.min(255, Math.round(rS)));
          nextPixels[destIdx+1] = Math.max(0, Math.min(255, Math.round(gS)));
          nextPixels[destIdx+2] = Math.max(0, Math.min(255, Math.round(bS)));
        }
      }
    }
  }

  // 9. Write processed pixels and heights back into chunks
  imgData.data.set(nextPixels);
  sCtx.putImageData(imgData, 0, 0);

  affectedChunks.forEach((info, id) => {
    const chunk = engine._getChunk(info.cx, info.cy);
    if (chunk) {
      const lx = engine.isStatic ? -engine.staticWidth / 2 : info.cx * engine.chunkSize;
      const ly = engine.isStatic ? -engine.staticHeight / 2 : info.cy * engine.chunkSize;
      const chunkW = engine.isStatic ? engine.staticWidth : engine.chunkSize;
      const chunkH = engine.isStatic ? engine.staticHeight : engine.chunkSize;

      // Save the advected high-precision height back into chunk's persistent height map
      const hMap = chunk.layerHeights[engine.activeLayer];

      const iMinX = Math.max(lx, minX);
      const iMinY = Math.max(ly, minY);
      const iMaxX = Math.min(lx + chunkW, maxX);
      const iMaxY = Math.min(ly + chunkH, maxY);

      if (iMaxX > iMinX && iMaxY > iMinY) {
        // Write Canvas Pixels
        const lCtx = chunk.ctxs[engine.activeLayer];
        lCtx.save();
        lCtx.clearRect(iMinX - lx, iMinY - ly, iMaxX - iMinX, iMaxY - iMinY);
        lCtx.drawImage(
          engine.segmentCanvas,
          iMinX - minX, iMinY - minY, iMaxX - iMinX, iMaxY - iMinY,
          iMinX - lx, iMinY - ly, iMaxX - iMinX, iMaxY - iMinY
        );
        lCtx.restore();
        engine._markDirty(id, engine.activeLayer, false);
        if (engine.gpuRenderer) {
          engine.gpuRenderer.markChunkLayerDirty(chunk, engine.activeLayer);
        }

        // Write High-Precision Heights
        for (let cy = iMinY - ly; cy < iMaxY - ly; cy++) {
          const sy = ly + cy - minY;
          for (let cx = iMinX - lx; cx < iMaxX - lx; cx++) {
            const sx = lx + cx - minX;
            hMap[cy * chunk.width + cx] = nextHeight[sy * w + sx];
          }
        }
      }
    }
  });

  engine.refresh();
}

// ----------------------------------------------------
// FULL ACTIVE LAYER GLOBAL MELTING FUNCTION
// ----------------------------------------------------
function meltActiveLayer(app) {
  app._status('MELTING LIVE LAYER FLUIDLY...');
  const engine = app.engine;
  const activeLayer = engine.activeLayer;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  engine.chunks.forEach((chunk) => {
    const lx = engine.isStatic ? -engine.staticWidth / 2 : chunk.cx * engine.chunkSize;
    const ly = engine.isStatic ? -engine.staticHeight / 2 : chunk.cy * engine.chunkSize;
    const chunkW = engine.isStatic ? engine.staticWidth : engine.chunkSize;
    const chunkH = engine.isStatic ? engine.staticHeight : engine.chunkSize;
    minX = Math.min(minX, lx);
    minY = Math.min(minY, ly);
    maxX = Math.max(maxX, lx + chunkW);
    maxY = Math.max(maxY, ly + chunkH);
  });

  if (minX === Infinity) {
    minX = engine.isStatic ? -engine.staticWidth/2 : -512;
    maxX = engine.isStatic ? engine.staticWidth/2 : 512;
    minY = engine.isStatic ? -engine.staticHeight/2 : -512;
    maxY = engine.isStatic ? engine.staticHeight/2 : 512;
  }

  const w = maxX - minX;
  const h = maxY - minY;
  if (w <= 0 || h <= 0) return;

  const affectedChunks = new Map();
  engine.chunks.forEach((chunk, id) => {
    const srcCanvas = chunk.canvases[activeLayer];
    const backup = document.createElement('canvas');
    backup.width = srcCanvas.width;
    backup.height = srcCanvas.height;
    backup.getContext('2d').drawImage(srcCanvas, 0, 0);
    engine.currentStrokeDirtyChunks.set(id, { layer: activeLayer, canvas: backup });
    engine._markDirty(id, activeLayer);
    affectedChunks.set(id, { cx: chunk.cx, cy: chunk.cy });
  });

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.clearRect(0, 0, w, h);

  engine.chunks.forEach((chunk) => {
    const lx = engine.isStatic ? -engine.staticWidth / 2 : chunk.cx * engine.chunkSize;
    const ly = engine.isStatic ? -engine.staticHeight / 2 : chunk.cy * engine.chunkSize;
    tempCtx.drawImage(chunk.canvases[activeLayer], lx - minX, ly - minY, chunk.width, chunk.height);
  });

  const imgData = tempCtx.getImageData(0, 0, w, h);
  const pixels = imgData.data;

  // Retrieve or initialize the high-precision persistent height map segment
  const segmentHeight = new Float32Array(w * h);

  engine.chunks.forEach((chunk) => {
    if (!chunk.layerHeights) {
      chunk.layerHeights = [];
    }
    if (!chunk.layerHeights[activeLayer]) {
      chunk.layerHeights[activeLayer] = new Float32Array(chunk.width * chunk.height);
      const ctx = chunk.ctxs[activeLayer];
      const existingData = ctx.getImageData(0, 0, chunk.width, chunk.height);
      const hMap = chunk.layerHeights[activeLayer];
      for (let i = 0; i < hMap.length; i++) {
        hMap[i] = existingData.data[i * 4 + 3] / 255.0; // range [0, 1]
      }
    }

    const hMap = chunk.layerHeights[activeLayer];
    const lx = engine.isStatic ? -engine.staticWidth / 2 : chunk.cx * engine.chunkSize;
    const ly = engine.isStatic ? -engine.staticHeight / 2 : chunk.cy * engine.chunkSize;

    for (let cy = 0; cy < chunk.height; cy++) {
      const wy = ly + cy;
      const sy = wy - minY;
      if (sy < 0 || sy >= h) continue;
      for (let cx = 0; cx < chunk.width; cx++) {
        const wx = lx + cx;
        const sx = wx - minX;
        if (sx < 0 || sx >= w) continue;

        // Clear heights where the underlying pixels has been completely erased/cleared
        const segIdx = sy * w + sx;
        if (pixels[segIdx * 4 + 3] === 0) {
          segmentHeight[segIdx] = 0;
        } else {
          segmentHeight[segIdx] = hMap[cy * chunk.width + cx];
        }
      }
    }
  });

  // Create 6 large localized vortex nodes to melt the canvas in a swirl pattern
  const CELL_SIZE = 8;
  const cols = Math.ceil(w / CELL_SIZE);
  const rows = Math.ceil(h / CELL_SIZE);
  const u = new Float32Array(cols * rows);
  const v = new Float32Array(cols * rows);

  const vortexes = [];
  const count = 6;
  for (let i = 0; i < count; i++) {
    vortexes.push({
      x: 0.15 * w + Math.random() * 0.7 * w,
      y: 0.15 * h + Math.random() * 0.7 * h,
      radius: Math.min(w, h) * (0.2 + Math.random() * 0.25),
      strength: (Math.random() < 0.5 ? 1 : -1) * (30 + Math.random() * 40)
    });
  }

  for (let cy = 0; cy < rows; cy++) {
    const py = cy * CELL_SIZE + CELL_SIZE / 2;
    for (let cx = 0; cx < cols; cx++) {
      const px = cx * CELL_SIZE + CELL_SIZE / 2;

      let cellU = 0;
      let cellV = 0;

      for (const vor of vortexes) {
        const dx = px - vor.x;
        const dy = py - vor.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        if (dist < vor.radius) {
          const ratio = dist / vor.radius;
          const force = Math.pow(1.0 - ratio * ratio, 2.0);
          
          cellU += (-dy / dist) * vor.strength * force;
          cellV += (dx / dist) * vor.strength * force;
        }
      }

      const idx = cx + cy * cols;
      u[idx] = cellU;
      v[idx] = cellV;
    }
  }

  // Semi-Lagrangian Advection
  const nextPixels = new Uint8ClampedArray(pixels.length);
  const nextHeight = new Float32Array(w * h);
  const dt = 0.6;

  for (let Y = 0; Y < h; Y++) {
    for (let X = 0; X < w; X++) {
      const cellX = X / CELL_SIZE;
      const cellY = Y / CELL_SIZE;
      const cellX0 = Math.max(0, Math.floor(cellX));
      const cellY0 = Math.max(0, Math.floor(cellY));
      const cellX1 = Math.min(cols - 1, cellX0 + 1);
      const cellY1 = Math.min(rows - 1, cellY0 + 1);

      const tx = cellX - cellX0;
      const ty = cellY - cellY0;

      const idx00 = cellX0 + cellY0 * cols;
      const idx10 = cellX1 + cellY0 * cols;
      const idx01 = cellX0 + cellY1 * cols;
      const idx11 = cellX1 + cellY1 * cols;

      const velX = (1 - tx) * ((1 - ty) * u[idx00] + ty * u[idx01]) + tx * ((1 - ty) * u[idx10] + ty * u[idx11]);
      const velY = (1 - tx) * ((1 - ty) * v[idx00] + ty * v[idx01]) + tx * ((1 - ty) * v[idx10] + ty * v[idx11]);

      const srcX = X - velX * dt;
      const srcY = Y - velY * dt;

      const x0 = Math.floor(srcX);
      const y0 = Math.floor(srcY);
      const x1 = Math.max(0, Math.min(w - 1, x0 + 1));
      const y1 = Math.max(0, Math.min(h - 1, y0 + 1));
      const clampedX0 = Math.max(0, Math.min(w - 1, x0));
      const clampedY0 = Math.max(0, Math.min(h - 1, y0));

      const s1 = srcX - x0;
      const s0 = 1.0 - s1;
      const t1 = srcY - y0;
      const t0 = 1.0 - t1;

      const pix00 = (clampedY0 * w + clampedX0) * 4;
      const pix10 = (clampedY0 * w + x1) * 4;
      const pix01 = (y1 * w + clampedX0) * 4;
      const pix11 = (y1 * w + x1) * 4;

      const destIdx = (Y * w + X) * 4;

      // High-precision pre-multiplied alpha bilinear interpolation for color
      const a00 = pixels[pix00 + 3];
      const a10 = pixels[pix10 + 3];
      const a01 = pixels[pix01 + 3];
      const a11 = pixels[pix11 + 3];

      const w00 = s0 * t0 * a00;
      const w10 = s1 * t0 * a10;
      const w01 = s0 * t1 * a01;
      const w11 = s1 * t1 * a11;

      const sumW = w00 + w10 + w01 + w11;
      if (sumW > 0.1) {
        nextPixels[destIdx] = (w00 * pixels[pix00] + w10 * pixels[pix10] + w01 * pixels[pix01] + w11 * pixels[pix11]) / sumW;
        nextPixels[destIdx+1] = (w00 * pixels[pix00+1] + w10 * pixels[pix10+1] + w01 * pixels[pix01+1] + w11 * pixels[pix11+1]) / sumW;
        nextPixels[destIdx+2] = (w00 * pixels[pix00+2] + w10 * pixels[pix10+2] + w01 * pixels[pix01+2] + w11 * pixels[pix11+2]) / sumW;
      } else {
        nextPixels[destIdx] = s0 * (t0 * pixels[pix00] + t1 * pixels[pix01]) + s1 * (t0 * pixels[pix10] + t1 * pixels[pix11]);
        nextPixels[destIdx+1] = s0 * (t0 * pixels[pix00+1] + t1 * pixels[pix01+1]) + s1 * (t0 * pixels[pix10+1] + t1 * pixels[pix11+1]);
        nextPixels[destIdx+2] = s0 * (t0 * pixels[pix00+2] + t1 * pixels[pix01+2]) + s1 * (t0 * pixels[pix10+2] + t1 * pixels[pix11+2]);
      }

      const h00 = segmentHeight[clampedY0 * w + clampedX0];
      const h10 = segmentHeight[clampedY0 * w + x1];
      const h01 = segmentHeight[y1 * w + clampedX0];
      const h11 = segmentHeight[y1 * w + x1];

      // Safeguard reference state to prevent tearing artifacts during global melting
      const origAlpha = pixels[destIdx+3];
      const origHeight = segmentHeight[Y * w + X];

      let advHeight = s0 * (t0 * h00 + t1 * h01) + s1 * (t0 * h10 + t1 * h11);

      if (origAlpha > 10 && advHeight < origHeight * 0.5) {
        advHeight = Math.max(advHeight, origHeight * 0.7);
      }

      nextHeight[Y * w + X] = advHeight;
      nextPixels[destIdx+3] = Math.max(origAlpha, Math.min(255, Math.round(advHeight * 255)));
    }
  }

  // Write pixels back to composite and copy back into original individual chunks
  imgData.data.set(nextPixels);
  tempCtx.putImageData(imgData, 0, 0);

  engine.chunks.forEach((chunk) => {
    const lx = engine.isStatic ? -engine.staticWidth / 2 : chunk.cx * engine.chunkSize;
    const ly = engine.isStatic ? -engine.staticHeight / 2 : chunk.cy * engine.chunkSize;
    const chunkCtx = chunk.ctxs[activeLayer];
    chunkCtx.clearRect(0, 0, chunk.width, chunk.height);
    chunkCtx.drawImage(tempCanvas, lx - minX, ly - minY, chunk.width, chunk.height, 0, 0, chunk.width, chunk.height);
    if (engine.gpuRenderer) {
      engine.gpuRenderer.markChunkLayerDirty(chunk, activeLayer);
    }

    // Save advected heights back
    const hMap = chunk.layerHeights[activeLayer];
    for (let cy = 0; cy < chunk.height; cy++) {
      const wy = ly + cy;
      const sy = wy - minY;
      if (sy < 0 || sy >= h) continue;
      for (let cx = 0; cx < chunk.width; cx++) {
        const wx = lx + cx;
        const sx = wx - minX;
        if (sx < 0 || sx >= w) continue;

        hMap[cy * chunk.width + cx] = nextHeight[sy * w + sx];
      }
    }
  });

  // Record history
  const strokeDirtyBackups = new Map();
  engine.currentStrokeDirtyChunks.forEach((backupData, id) => {
    strokeDirtyBackups.set(id, backupData);
  });
  engine.currentStrokeDirtyChunks.clear();

  const action = {
    type: 'stroke',
    chunks: strokeDirtyBackups
  };
  engine._pushHistory(action);

  engine.refresh();
  app._status('CANVAS LIVE LAYER MELTED!');
}
