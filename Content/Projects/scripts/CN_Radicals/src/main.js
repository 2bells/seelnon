// Core Logic for the Chinese Radicals Study Application
// Built with pure Vanilla JS, Canvas, and WebGPU fallback. Zero modern bloat.

import { radicals } from './data/radicals.js';

// --- APPLICATION STATE ---
const STATE = {
  activeTab: 'dictionary', // 'dictionary' | 'srs'
  selectedRadicalNo: 1, // Currently viewed radical (1-214)
  searchQuery: '',
  filterCategory: 'ALL',
  filterStrokes: 'ALL',
  
  // SRS (Spaced Repetition System) State
  srs: {
    learned: {}, // radicalNo -> { interval, ease, repetitions, nextReview, forgotCount }
    streak: 0,
    lastReviewDate: null
  },
  
  // Quiz Active State
  quizQueue: [],
  quizIndex: 0,
  quizFlipped: false,

  // Calligraphy Canvas State
  canvas: null,
  ctx: null,
  gridCanvas: null,
  gridCtx: null,
  isDrawing: false,
  drawnPoints: [], // coords of current stroke
  userSuccessfulStrokes: [], // coords of successfully completed user strokes
  practiceStrokeIndex: 0, // which stroke is the user practicing
  practiceSuccessCount: 0,
  isPracticing: false,
  multiCharSequence: [], // characters in a multi-character word
  multiCharIndex: 0, // current character index being practiced
  
  // Particle Systems
  particles2D: [],
  webGpuActive: false
};

// --- WEBGPU STATE & CODE ---
let gpuDevice = null;
let gpuContext = null;
let gpuPipeline = null;
let gpuParticleBuffer = null;
let webGpuCanvas = null;

// WGSL Shaders for WebGPU Particle Flow
const wgslShaders = `
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
};

struct Particle {
  pos: vec2<f32>,
  vel: vec2<f32>,
  color: vec4<f32>,
  size: f32,
  alpha: f32,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
  @location(0) pos: vec2<f32>,
  @location(1) color: vec4<f32>,
  @location(2) size: f32,
  @location(3) alpha: f32
) -> VertexOutput {
  // Vertices of a small particle quad
  var local_pos = array<vec2<f32>, 4>(
    vec2<f32>(-0.015, -0.015),
    vec2<f32>( 0.015, -0.015),
    vec2<f32>(-0.015,  0.015),
    vec2<f32>( 0.015,  0.015)
  );

  var out: VertexOutput;
  let offset = local_pos[vertexIndex] * size;
  out.position = vec4<f32>(pos + offset, 0.0, 1.0);
  out.color = vec4<f32>(color.rgb, color.a * alpha);
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  // Give particle a soft circular fade
  let dist = length(in.position.xy - vec2<f32>(0.5, 0.5));
  return in.color;
}
`;

// Initialize WebGPU if available
async function initWebGPU() {
  if (!navigator.gpu) {
    console.log("WebGPU not supported in this browser. Running high-performance 2D canvas particle fallback.");
    updateWebGpuStatus(false);
    return;
  }
  
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      updateWebGpuStatus(false);
      return;
    }
    
    gpuDevice = await adapter.requestDevice();
    webGpuCanvas = document.getElementById("webgpu-canvas");
    if (!webGpuCanvas) return;
    
    gpuContext = webGpuCanvas.getContext("webgpu");
    const format = navigator.gpu.getPreferredCanvasFormat();
    
    gpuContext.configure({
      device: gpuDevice,
      format: format,
      alphaMode: "premultiplied"
    });
    
    // WebGPU module setup
    const shaderModule = gpuDevice.createShaderModule({ code: wgslShaders });
    
    // Simple render pipeline
    gpuPipeline = gpuDevice.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: 36, // 2D pos (8b), Color (16b), Size (4b), Alpha (4b), Vel (8b)
            stepMode: "instance",
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x2" }, // position
              { shaderLocation: 1, offset: 8, format: "float32x4" }, // color
              { shaderLocation: 2, offset: 24, format: "float32" },   // size
              { shaderLocation: 3, offset: 28, format: "float32" }    // alpha
            ]
          }
        ]
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main",
        targets: [{ format: format, writeMask: GPUColorWrite.ALL }]
      },
      primitive: { topology: "triangle-strip" }
    });
    
    STATE.webGpuActive = true;
    updateWebGpuStatus(true);
    console.log("WebGPU Engine Active: Philosophical ink particles deployed successfully on GPU.");
  } catch (e) {
    console.warn("Failed to initialize WebGPU context:", e);
    updateWebGpuStatus(false);
  }
}

function updateWebGpuStatus(active) {
  const badge = document.getElementById("webgpu-badge");
  if (!badge) return;
  if (active) {
    badge.className = "webgpu-status status-active";
    badge.innerHTML = "🌀 WEBGPU: ACTIVE (GPU PARCHMENT EFFECTS)";
  } else {
    badge.className = "webgpu-status status-inactive";
    badge.innerHTML = "✍️ WEBGPU: INACTIVE (2D CALLIGRAPHY CORE)";
  }
}

// --- PARTICLE EMISSION CORE ---
function emitInkParticles(x, y, count = 8, colorHex = '#1a1a1a') {
  // Splashes and particle emission disabled for a cleaner and highly-polished drawing style.
  return;
}

// Update particle values & render WebGPU frame
function updateAndRenderParticles() {
  // Update particles
  for (let i = STATE.particles2D.length - 1; i >= 0; i--) {
    const p = STATE.particles2D[i];
    p.x += p.vx;
    p.y += p.vy;
    p.gpuX += p.gpuVx;
    p.gpuY += p.gpuVy;
    
    p.vx *= 0.95; // Fluid friction
    p.vy *= 0.95;
    p.gpuVx *= 0.95;
    p.gpuVy *= 0.95;
    
    p.life -= p.decay;
    p.alpha = p.life;
    
    if (p.life <= 0) {
      STATE.particles2D.splice(i, 1);
    }
  }
  
  // Render fallbacks & standard canvas additions
  if (STATE.particles2D.length > 0 && STATE.canvas) {
    // We draw the ink particles on the main canvas as a gorgeous bleed layer
    const tempCtx = STATE.ctx;
    tempCtx.save();
    for (const p of STATE.particles2D) {
      tempCtx.fillStyle = p.color;
      tempCtx.globalAlpha = p.alpha * 0.5;
      tempCtx.beginPath();
      tempCtx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
      tempCtx.fill();
    }
    tempCtx.restore();
  }
  
  // Render WebGPU system
  if (STATE.webGpuActive && gpuDevice && gpuContext && STATE.particles2D.length > 0) {
    try {
      // Pack particles into binary buffer for WebGPU
      const particleBytes = 36; // 9 floats * 4 bytes
      const maxGpuParticles = Math.min(STATE.particles2D.length, 1000);
      const data = new Float32Array(maxGpuParticles * 9);
      
      for (let i = 0; i < maxGpuParticles; i++) {
        const p = STATE.particles2D[i];
        const offset = i * 9;
        data[offset + 0] = p.gpuX;
        data[offset + 1] = p.gpuY;
        
        // Parse Color to RGBA
        data[offset + 2] = 0.1; // R
        data[offset + 3] = 0.1; // G
        data[offset + 4] = 0.1; // B
        data[offset + 5] = p.alpha; // A
        
        data[offset + 6] = p.size * 0.05; // size scalar
        data[offset + 7] = p.alpha;       // alpha
        
        // Unused properties
        data[offset + 8] = 0.0;
      }
      
      const vertexBuffer = gpuDevice.createBuffer({
        size: data.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: false
      });
      
      gpuDevice.queue.writeBuffer(vertexBuffer, 0, data);
      
      const commandEncoder = gpuDevice.createCommandEncoder();
      const textureView = gpuContext.getCurrentTexture().createView();
      
      const renderPassDescriptor = {
        colorAttachments: [{
          view: textureView,
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 }, // Transparent canvas
          loadOp: "clear",
          storeOp: "store"
        }]
      };
      
      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.setPipeline(gpuPipeline);
      passEncoder.setVertexBuffer(0, vertexBuffer);
      passEncoder.draw(4, maxGpuParticles, 0, 0); // 4 vertices for a quad
      passEncoder.end();
      
      gpuDevice.queue.submit([commandEncoder.finish()]);
    } catch (err) {
      console.warn("WebGPU Render error:", err);
    }
  }
  
  requestAnimationFrame(updateAndRenderParticles);
}

// --- LOCAL STORAGE PERSISTENCE ---
function loadSrsData() {
  const saved = localStorage.getItem('kangxi_srs_state');
  if (saved) {
    try {
      STATE.srs = JSON.parse(saved);
      // Ensure essential fields exist
      if (!STATE.srs.learned) STATE.srs.learned = {};
      if (!STATE.srs.streak) STATE.srs.streak = 0;
    } catch (e) {
      console.warn("Could not load local storage SRS data.", e);
    }
  }
}

function saveSrsData() {
  localStorage.setItem('kangxi_srs_state', JSON.stringify(STATE.srs));
  renderStats();
}

// --- CALIGRAPHY CANVAS DRAWING ENGINE ---
function setupCalligraphyCanvas() {
  STATE.canvas = document.getElementById('practice-canvas');
  if (!STATE.canvas) return;
  STATE.ctx = STATE.canvas.getContext('2d');
  
  // Set physical resolution
  STATE.canvas.width = 320;
  STATE.canvas.height = 320;

  STATE.gridCanvas = document.getElementById('grid-canvas');
  if (STATE.gridCanvas) {
    STATE.gridCanvas.width = 320;
    STATE.gridCanvas.height = 320;
    STATE.gridCtx = STATE.gridCanvas.getContext('2d');
    drawCalligraphyGrid();
  }

  clearDrawingCanvas();

  const container = document.getElementById('hanzi-writer-container');
  if (container) {
    // Prevent touch action from scrolling or zooming while drawing
    container.style.touchAction = 'none';

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let lastT = 0;
    let lastWidth = 10;

    const startDrawing = (e) => {
      isDrawing = true;
      const rect = container.getBoundingClientRect();
      // Mathematically map client coordinate space back to the 320x320 canvas pixels
      const x = ((e.clientX - rect.left) / rect.width) * STATE.canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * STATE.canvas.height;

      // Always clear user drawing canvas to start fresh on a new user attempt
      clearDrawingCanvas();

      lastX = x;
      lastY = y;
      lastT = Date.now();
      lastWidth = 12; // Initial solid brush down

      drawInkSegment(x, y, x, y, lastWidth, lastWidth);
    };

    const draw = (e) => {
      if (!isDrawing) return;
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * STATE.canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * STATE.canvas.height;

      const t = Date.now();
      const d = Math.hypot(x - lastX, y - lastY);
      const dt = t - lastT;

      const velocity = d / (dt || 1); // pixels/ms

      // Dynamic stroke thickness based on velocity:
      // Quick drawing thins the line (mimics fast brush lifting).
      // Deliberate or slow movement thickens it (mimics absorption).
      let targetWidth = 12 - (velocity * 3.5);
      targetWidth = Math.max(3, Math.min(14, targetWidth));

      // Interpolate width transitions to simulate dynamic brush flexibility
      const currentWidth = lastWidth * 0.6 + targetWidth * 0.4;

      drawInkSegment(lastX, lastY, x, y, lastWidth, currentWidth);

      lastX = x;
      lastY = y;
      lastT = t;
      lastWidth = currentWidth;
    };

    const stopDrawing = () => {
      isDrawing = false;
    };

    // Remove any previously bound listeners if we setup multiple times (prevent memory leaks / duplicate events)
    container.removeEventListener('pointerdown', container._startDrawing);
    container.removeEventListener('pointermove', container._draw);
    container.removeEventListener('pointerup', container._stopDrawing);
    container.removeEventListener('pointercancel', container._stopDrawing);

    // Cache handlers to clean up later
    container._startDrawing = startDrawing;
    container._draw = draw;
    container._stopDrawing = stopDrawing;

    container.addEventListener('pointerdown', startDrawing);
    container.addEventListener('pointermove', draw);
    container.addEventListener('pointerup', stopDrawing);
    container.addEventListener('pointercancel', stopDrawing);
  }
}

// Draw calligraphy brush segment with interpolations to keep it ultra smooth
function drawInkSegment(x1, y1, x2, y2, w1, w2) {
  if (!STATE.ctx) return;
  const ctx = STATE.ctx;
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.ceil(dist / 0.5); // 0.5px steps for seamless ink fill (no gaps/beads)

  ctx.save();
  for (let i = 0; i <= steps; i++) {
    const fraction = steps === 0 ? 1 : i / steps;
    const cx = x1 + (x2 - x1) * fraction;
    const cy = y1 + (y2 - y1) * fraction;
    const cw = w1 + (w2 - w1) * fraction;

    ctx.beginPath();
    ctx.arc(cx, cy, cw / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a1a'; // Pitch black charcoal ink
    ctx.fill();
  }
  ctx.restore();
}

// Traditional Mizige (米字格) Tracing Grid
function drawCalligraphyGrid() {
  if (!STATE.gridCanvas || !STATE.gridCtx) return;
  const ctx = STATE.gridCtx;
  const w = STATE.gridCanvas.width;
  const h = STATE.gridCanvas.height;
  
  // Clear grid canvas completely
  ctx.clearRect(0, 0, w, h);
  
  ctx.save();
  ctx.strokeStyle = "#e5930e"; // Traditional red/amber ink grid color
  ctx.lineWidth = 1.5;
  
  // Draw outer border
  ctx.strokeRect(4, 4, w - 8, h - 8);
  
  // Draw internal dashed guides
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  
  // Horizontal center
  ctx.moveTo(4, h / 2);
  ctx.lineTo(w - 4, h / 2);
  
  // Vertical center
  ctx.moveTo(w / 2, 4);
  ctx.lineTo(w / 2, h - 4);
  
  // Diagonals
  ctx.moveTo(4, 4);
  ctx.lineTo(w - 4, h - 4);
  ctx.moveTo(w - 4, 4);
  ctx.lineTo(4, h - 4);
  
  ctx.stroke();
  ctx.restore();
}

// High performance clear for the drawing layers
function clearDrawingCanvas() {
  if (!STATE.canvas || !STATE.ctx) return;
  STATE.ctx.clearRect(0, 0, STATE.canvas.width, STATE.canvas.height);
}

// Hanzi Writer Integration Core
function initHanziWriter(char) {
  const container = document.getElementById('hanzi-writer-container');
  if (!container) return;
  container.innerHTML = '';
  
  const canvasBox = document.getElementById('practice-canvas-box');
  if (canvasBox) {
    canvasBox.classList.remove('error-state', 'success-state', 'mastered-state');
  }
  
  // Always draw our traditional Mizige grid backdrop first
  drawCalligraphyGrid();

  // Handle multi-character sequence routing
  let targetChar = char;
  const indicator = document.getElementById('sequence-indicator');
  
  if (char && char.length > 1) {
    const sequenceStr = STATE.multiCharSequence.join('');
    if (sequenceStr !== char) {
      STATE.multiCharSequence = char.split('');
      STATE.multiCharIndex = 0;
    }
    targetChar = STATE.multiCharSequence[STATE.multiCharIndex];
    
    if (indicator) {
      indicator.style.display = 'block';
      indicator.innerText = `${STATE.multiCharIndex + 1} / ${STATE.multiCharSequence.length} [ ${targetChar} ]`;
    }
  } else {
    STATE.multiCharSequence = [];
    STATE.multiCharIndex = 0;
    if (indicator) {
      indicator.style.display = 'none';
    }
  }
  
  if (typeof HanziWriter !== 'undefined') {
    STATE.hanziWriter = HanziWriter.create('hanzi-writer-container', targetChar, {
      width: 320,
      height: 320,
      padding: 30,
      strokeColor: '#1a1a1a', // Pitch black charcoal ink
      outlineColor: 'rgba(0, 0, 0, 0.08)', // Faint trace guide
      drawingColor: 'rgba(0, 0, 0, 0)', // User drawing is handled in high-perf custom canvas with speed sensitivity
      drawingWidth: 10,
      showOutline: true,
      showCharacter: false, // hide initially so they can practice
      highlightColor: '#ff4d4d', // Red highlight guide
    });
    
    startHanziQuiz();
  } else {
    console.error('HanziWriter library is not loaded.');
  }
}

function startHanziQuiz() {
  if (!STATE.hanziWriter) return;
  
  STATE.hanziWriter.quiz({
    onMistake: function(strokeData) {
      const canvasBox = document.getElementById('practice-canvas-box');
      if (canvasBox) {
        canvasBox.classList.remove('success-state', 'mastered-state', 'error-state');
        void canvasBox.offsetWidth; // Force reflow
        canvasBox.classList.add('error-state');
      }
      emitInkParticles(160, 160, 10, 'var(--accent-red)');
      clearDrawingCanvas(); // Reset speed-sensitive canvas for another attempt
    },
    onCorrectStroke: function(strokeData) {
      const canvasBox = document.getElementById('practice-canvas-box');
      if (canvasBox) {
        canvasBox.classList.remove('error-state', 'mastered-state');
        canvasBox.classList.add('success-state');
        setTimeout(() => {
          if (canvasBox.classList.contains('success-state') && !canvasBox.classList.contains('mastered-state')) {
            canvasBox.classList.remove('success-state');
          }
        }, 800);
      }
      emitInkParticles(160, 160, 15, '#1a1a1a');
      clearDrawingCanvas(); // Clear speed-sensitive drawing so HanziWriter vector renders perfectly
    },
    onComplete: function(summary) {
      const canvasBox = document.getElementById('practice-canvas-box');
      if (canvasBox) {
        canvasBox.classList.remove('success-state', 'error-state');
        canvasBox.classList.add('mastered-state');
      }
      triggerMasteryCelebration();
      
      // If we are in a multi-character sequence and have characters remaining, advance to the next
      if (STATE.multiCharSequence.length > 1 && STATE.multiCharIndex < STATE.multiCharSequence.length - 1) {
        STATE.multiCharIndex++;
        setTimeout(() => {
          initHanziWriter(STATE.multiCharSequence.join(''));
        }, 1200);
        return;
      }
      
      markRadicalPracticed(STATE.selectedRadicalNo);
      clearDrawingCanvas(); // Clear speed-sensitive canvas on completion
    }
  });
}

function resetPracticeSession() {
  const rad = radicals.find(r => r.no === STATE.selectedRadicalNo);
  if (rad) {
    initHanziWriter(rad.char);
  } else {
    clearDrawingCanvas();
  }
}

// Flash green particle flows around the canvas
function triggerMasteryCelebration() {
  for (let k = 0; k < 5; k++) {
    setTimeout(() => {
      emitInkParticles(80 + Math.random() * 160, 80 + Math.random() * 160, 30, 'var(--accent-green)');
    }, k * 100);
  }
}

// Automatic Stroke Animation Player
function playStrokeAnimation() {
  if (STATE.hanziWriter) {
    STATE.hanziWriter.cancelQuiz();
    STATE.hanziWriter.animateCharacter({
      onComplete: function() {
        startHanziQuiz();
      }
    });
  }
}

// --- RENDERING VIEWS ---

// Filter and display the Left Radical Grid list
function renderRadicalGrid() {
  const grid = document.getElementById('radical-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  // Filters matching logic
  const filtered = radicals.filter(rad => {
    // Search query matches character, pinyin, or meaning
    const matchesSearch = 
      rad.char.includes(STATE.searchQuery) ||
      rad.pinyin.toLowerCase().includes(STATE.searchQuery.toLowerCase()) ||
      rad.meaning.toLowerCase().includes(STATE.searchQuery.toLowerCase());
      
    // Stroke count filter
    const matchesStrokes = STATE.filterStrokes === 'ALL' || rad.strokes === parseInt(STATE.filterStrokes);
    
    // Category filter
    const matchesCategory = STATE.filterCategory === 'ALL' || rad.category === STATE.filterCategory;
    
    return matchesSearch && matchesStrokes && matchesCategory;
  });
  
  // Render counter update
  const countDisplay = document.getElementById('grid-results-count');
  if (countDisplay) {
    countDisplay.innerText = `${filtered.length} / ${radicals.length}`;
  }
  
  filtered.forEach(rad => {
    const cell = document.createElement('div');
    const isActive = rad.no === STATE.selectedRadicalNo;
    cell.className = `radical-cell ${isActive ? 'active' : ''}`;
    cell.setAttribute('data-no', rad.no);
    cell.id = `cell-${rad.no}`;
    
    // Display index inside grid item
    cell.innerHTML = `
      <span class="cell-no">${rad.no}</span>
      <span class="cell-char">${rad.char}</span>
      <span class="cell-desc">${rad.meaning}</span>
      <span class="cell-strokes">${rad.strokes}</span>
    `;
    
    cell.addEventListener('click', () => {
      selectRadical(rad.no);
    });
    
    grid.appendChild(cell);
  });
}

// Load details of the active selected radical into the Right View
function renderRadicalDetail() {
  const rad = radicals.find(r => r.no === STATE.selectedRadicalNo);
  if (!rad) return;
  
  // Update texts
  document.getElementById('detail-char-huge').innerText = rad.char;
  document.getElementById('detail-char-title').innerText = `${rad.char} - ${rad.meaning.toUpperCase()}`;
  document.getElementById('detail-char-pinyin').innerText = `[ ${rad.pinyin.toUpperCase()} ]`;
  
  // Details table fields
  document.getElementById('meta-no').innerText = `# ${rad.no}`;
  const metaMoreLink = document.getElementById('meta-more-link');
  if (metaMoreLink) {
    metaMoreLink.href = `https://www.yellowbridge.com/chinese/dictionary.php?word=${encodeURIComponent(rad.char)}`;
  }
  const metaStrokes = document.getElementById('meta-strokes');
  if (metaStrokes) metaStrokes.innerText = rad.strokes;
  
  // Category Badge update
  const categoryBadge = document.getElementById('meta-category');
  categoryBadge.className = `badge badge-${rad.category.toLowerCase()}`;
  categoryBadge.innerText = rad.category;
  
  // Historical facts & philosophy
  document.getElementById('etymology-text').innerText = rad.etymology;
  document.getElementById('funfact-text').innerText = rad.funFact;
  document.getElementById('philosophy-quote').innerText = `“ ${rad.philosophy} ”`;
  
  // Setup practice engine state
  resetPracticeSession();
}

function selectRadical(no) {
  // Unhighlight previous
  const prevActive = document.querySelector('.radical-cell.active');
  if (prevActive) prevActive.classList.remove('active');
  
  STATE.selectedRadicalNo = no;
  
  // Highlight new cell
  const newActive = document.getElementById(`cell-${no}`);
  if (newActive) newActive.classList.add('active');
  
  // Reset multi-character sequence on selection of a different item
  STATE.multiCharSequence = [];
  STATE.multiCharIndex = 0;
  
  renderRadicalDetail();
}

// Render total core metrics in Header Stats bar
function renderStats() {
  const learnedKeys = Object.keys(STATE.srs.learned);
  const masteredCount = learnedKeys.filter(k => STATE.srs.learned[k].interval >= 14).length;
  const activeCount = learnedKeys.filter(k => STATE.srs.learned[k].interval < 14).length;
  
  const m = document.getElementById('stat-mastered');
  const l = document.getElementById('stat-learning');
  const u = document.getElementById('stat-unlocked');
  const s = document.getElementById('stat-streak');
  if (m) m.innerText = masteredCount;
  if (l) l.innerText = activeCount;
  if (u) u.innerText = `${learnedKeys.length}/${radicals.length}`;
  if (s) s.innerText = `${STATE.srs.streak} Days`;
}

// --- SPACED REPETITION CORE IMPLEMENTATION ---

// Mark radical as practiced/correct during normal dictionary run
function markRadicalPracticed(no) {
  const srsRecord = STATE.srs.learned[no];
  if (!srsRecord) {
    // New unlocked radical!
    STATE.srs.learned[no] = {
      interval: 1,
      ease: 2.5,
      repetitions: 1,
      nextReview: new Date().toISOString(),
      forgotCount: 0
    };
  } else {
    // Increment practice repetitions
    srsRecord.repetitions += 1;
  }
  saveSrsData();
}

// Build SRS review queue based on nextReviewDate
function buildQuizQueue() {
  const now = new Date();
  const queue = [];
  
  radicals.forEach(rad => {
    const srsRecord = STATE.srs.learned[rad.no];
    if (srsRecord) {
      const nextReviewDate = new Date(srsRecord.nextReview);
      if (nextReviewDate <= now) {
        queue.push(rad);
      }
    } else {
      // Unlearned cards are injected over time to avoid overwhelming the user
      // If we have less than 5 active items, we inject unlearned radicals
    }
  });
  
  // If no reviews are due right now, let's inject a few fresh new ones!
  if (queue.length === 0) {
    const activeList = Object.keys(STATE.srs.learned);
    // Find unlearned radicals
    const unlearned = radicals.filter(r => !activeList.includes(r.no.toString()));
    
    // Pull the next 5 unlearned radicals
    const limit = Math.min(5, unlearned.length);
    for (let i = 0; i < limit; i++) {
      queue.push(unlearned[i]);
    }
  }
  
  // Shuffle queue to randomize study order
  STATE.quizQueue = queue.sort(() => Math.random() - 0.5);
  STATE.quizIndex = 0;
  STATE.quizFlipped = false;
  
  renderSrsQuizView();
}

// Render SRS Dashboard & Active Quiz Item
function renderSrsView() {
  loadSrsData();
  renderStats();
  
  // Update internal metrics inside SRS View
  const srsData = STATE.srs.learned;
  const masteredCount = Object.keys(srsData).filter(k => srsData[k].interval >= 14).length;
  const activeCount = Object.keys(srsData).filter(k => srsData[k].interval < 14).length;
  
  document.getElementById('srs-mastered-val').innerText = masteredCount;
  document.getElementById('srs-learning-val').innerText = activeCount;
  document.getElementById('srs-streak-val').innerText = `${STATE.srs.streak} Days`;
  
  // Next review counts calculation
  const now = new Date();
  const pendingCount = Object.keys(srsData).filter(k => new Date(srsData[k].nextReview) <= now).length;
  document.getElementById('srs-pending-val').innerText = pendingCount;
  
  // Render forgotten trouble radicals
  renderTroubleRadicals();
  
  // Initialize or resume study queue
  buildQuizQueue();
}

function renderSrsQuizView() {
  const container = document.getElementById('srs-quiz-box');
  if (!container) return;
  
  if (STATE.quizQueue.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; margin: auto;">
        <span style="font-size: 4rem;">🏮</span>
        <h2 style="margin-top: 15px;">CONGRATULATIONS! ALL CAUGHT UP.</h2>
        <p style="margin-top: 10px; max-width: 400px; line-height: 1.6;">Your retention cycles are perfect. There are no Chinese Radicals due for immediate review. Select a radical from the grid on the left to practice drawing or unlock more characters!</p>
        <button class="btn-raw btn-accent" style="margin: 20px auto 0 auto; width: 220px;" onclick="switchTab('dictionary')">BACK TO DICTIONARY</button>
      </div>
    `;
    return;
  }
  
  const rad = STATE.quizQueue[STATE.quizIndex];
  const total = STATE.quizQueue.length;
  const currentNum = STATE.quizIndex + 1;
  
  container.innerHTML = `
    <div class="quiz-progress">
      <span>SRS REVIEW SESSION</span>
      <span>CARD ${currentNum} OF ${total}</span>
    </div>
    
    <div class="flashcard-container" id="flashcard-box">
      <div class="flashcard ${STATE.quizFlipped ? 'flipped' : ''}" id="flashcard">
        <!-- Front of card -->
        <div class="card-face card-front">
          <span class="char-display">${rad.char}</span>
          <span class="hint-text">CLICK TO REVEAL WISDOM</span>
        </div>
        
        <!-- Back of card -->
        <div class="card-face card-back">
          <span class="char-meaning">${rad.meaning}</span>
          <span class="char-pinyin-display">[ ${rad.pinyin.toUpperCase()} ]</span>
          <p style="font-size:0.8rem; margin-top: 12px; text-align:center; padding: 0 10px;">
            ${rad.etymology.substring(0, 100)}...
          </p>
          <span class="hint-text">CLICK TO CLOSE</span>
        </div>
      </div>
    </div>
    
    <div class="quiz-actions">
      ${!STATE.quizFlipped ? `
        <button class="btn-raw btn-accent" style="flex:1; padding: 15px;" id="reveal-btn">REVEAL CARD DETAILS</button>
      ` : `
        <button class="btn-raw btn-red" id="srs-forgot">FORGOT (LEVEL down)</button>
        <button class="btn-raw btn-raw" style="border-color:#e5930e; background:#fffbf0;" id="srs-hard">HARD</button>
        <button class="btn-raw btn-green" id="srs-good">GOOD</button>
        <button class="btn-raw" style="background:#ccfffc;" id="srs-mastered">EASY (MASTERED)</button>
      `}
    </div>
  `;
  
  // Attach listeners to quiz card
  const fbox = document.getElementById('flashcard-box');
  if (fbox) {
    fbox.addEventListener('click', toggleFlashcardFlip);
  }
  
  const rbtn = document.getElementById('reveal-btn');
  if (rbtn) {
    rbtn.addEventListener('click', toggleFlashcardFlip);
  }
  
  // Quiz rating buttons actions (SuperMemo SM-2 algorithm simplified)
  if (STATE.quizFlipped) {
    document.getElementById('srs-forgot').addEventListener('click', () => submitSrsScore(rad.no, 1));
    document.getElementById('srs-hard').addEventListener('click', () => submitSrsScore(rad.no, 3));
    document.getElementById('srs-good').addEventListener('click', () => submitSrsScore(rad.no, 4));
    document.getElementById('srs-mastered').addEventListener('click', () => submitSrsScore(rad.no, 5));
  }
}

function toggleFlashcardFlip() {
  STATE.quizFlipped = !STATE.quizFlipped;
  const fcard = document.getElementById('flashcard');
  if (fcard) {
    if (STATE.quizFlipped) {
      fcard.classList.add('flipped');
    } else {
      fcard.classList.remove('flipped');
    }
  }
  renderSrsQuizView();
}

// SM-2 Spaced Repetition core computation
function submitSrsScore(radicalNo, score) {
  let record = STATE.srs.learned[radicalNo];
  
  if (!record) {
    record = {
      interval: 1,
      ease: 2.5,
      repetitions: 0,
      nextReview: new Date().toISOString(),
      forgotCount: 0
    };
  }
  
  record.repetitions += 1;
  
  if (score < 3) {
    // Forgot item: reset spacing sequence
    record.interval = 1;
    record.forgotCount = (record.forgotCount || 0) + 1;
    // Reduce ease factor to show more frequently
    record.ease = Math.max(1.3, record.ease - 0.2);
    emitInkParticles(160, 160, 20, 'var(--accent-red)');
  } else {
    // Answer was correct: expand review interval
    if (record.interval === 1) {
      record.interval = 3;
    } else if (record.interval === 3) {
      record.interval = 7;
    } else {
      // Multiply current interval by ease factor
      record.interval = Math.min(180, Math.round(record.interval * record.ease));
    }
    
    // Adjust ease parameter based on score
    record.ease = record.ease + (0.1 - (5 - score) * (0.08 + (5 - score) * 0.02));
    record.ease = Math.max(1.3, record.ease);
    emitInkParticles(160, 160, 20, 'var(--accent-green)');
  }
  
  // Compute next review date
  const now = new Date();
  now.setDate(now.getDate() + record.interval);
  record.nextReview = now.toISOString();
  
  // Commit to state
  STATE.srs.learned[radicalNo] = record;
  
  // Daily Streak calculation
  updateStreak();
  
  saveSrsData();
  
  // Transition to next card in queue
  STATE.quizIndex++;
  STATE.quizFlipped = false;
  
  if (STATE.quizIndex >= STATE.quizQueue.length) {
    // End of session! Build queue again to pull fresh cards or exit
    buildQuizQueue();
  } else {
    renderSrsQuizView();
  }
}

function updateStreak() {
  const nowStr = new Date().toDateString();
  if (STATE.srs.lastReviewDate !== nowStr) {
    if (STATE.srs.lastReviewDate) {
      const lastDate = new Date(STATE.srs.lastReviewDate);
      const diffTime = Math.abs(new Date(nowStr) - lastDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        STATE.srs.streak++;
      } else if (diffDays > 1) {
        STATE.srs.streak = 1;
      }
    } else {
      STATE.srs.streak = 1;
    }
    STATE.srs.lastReviewDate = nowStr;
  }
}

// Track and render top forgotten radicals
function renderTroubleRadicals() {
  const container = document.getElementById('trouble-grid');
  if (!container) return;
  container.innerHTML = '';
  
  const srsData = STATE.srs.learned;
  const troubleList = Object.keys(srsData)
    .map(k => ({ no: parseInt(k), record: srsData[k] }))
    .filter(item => item.record.forgotCount > 0)
    .sort((a, b) => b.record.forgotCount - a.record.forgotCount); // Sort worst first
    
  if (troubleList.length === 0) {
    container.innerHTML = `
      <p style="grid-column: 1/-1; padding: 12px; font-weight:700; color:var(--text-muted); text-align:center;">
        👍 EXCELLENT RETENTION! NO CURRENT TROUBLESOME RADICALS FOUND.
      </p>
    `;
    return;
  }
  
  troubleList.slice(0, 4).forEach(item => {
    const rad = radicals.find(r => r.no === item.no);
    if (!rad) return;
    
    const card = document.createElement('div');
    card.className = "trouble-card";
    card.innerHTML = `
      <span class="trouble-char">${rad.char}</span>
      <div class="trouble-details">
        <span class="trouble-meaning">${rad.meaning.toUpperCase()}</span>
        <span class="trouble-score">FORGOT: ${item.record.forgotCount}x</span>
      </div>
    `;
    
    card.addEventListener('click', () => {
      switchTab('dictionary');
      selectRadical(rad.no);
    });
    
    container.appendChild(card);
  });
}

// --- MAIN ROUTER / TAB VIEW TRANSITIONS ---
window.switchTab = function(tabName) {
  STATE.activeTab = tabName;
  
  const tabDic = document.getElementById('tab-dictionary');
  const tabSrs = document.getElementById('tab-srs');
  
  const viewDic = document.getElementById('view-dictionary');
  const viewSrs = document.getElementById('view-srs');
  
  if (tabName === 'dictionary') {
    tabDic.classList.add('active');
    tabSrs.classList.remove('active');
    viewDic.style.display = 'block';
    viewSrs.style.display = 'none';
    
    // Re-bind drawing canvas and reset
    setTimeout(() => {
      setupCalligraphyCanvas();
      renderRadicalDetail();
    }, 50);
  } else {
    tabDic.classList.remove('active');
    tabSrs.classList.add('active');
    viewDic.style.display = 'none';
    viewSrs.style.display = 'block';
    
    renderSrsView();
  }
};

// Speech Synthesis for Hanzi character pronunciation
function speakChinese(text) {
  if ('speechSynthesis' in window) {
    // Cancel any ongoing speech to avoid overlaps or queue blocks
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN'; // Set language to Mandarin
    utterance.rate = 0.75;    // Slightly slower for language learners
    
    window.speechSynthesis.speak(utterance);
  } else {
    console.error("Speech synthesis not supported in this browser.");
  }
}

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', async () => {
  // Load local state
  loadSrsData();
  renderStats();
  
  // Set up canvas first to prevent null drawing errors on page load
  setupCalligraphyCanvas();
  
  // Set up Left list and select default
  renderRadicalGrid();
  selectRadical(1); // Default to 一 (One)
  
  // Setup Search Input Event
  const sInput = document.getElementById('search-input');
  if (sInput) {
    sInput.addEventListener('input', (e) => {
      STATE.searchQuery = e.target.value;
      renderRadicalGrid();
    });
  }
  
  // Setup Category Filter
  const fCat = document.getElementById('filter-category');
  if (fCat) {
    fCat.addEventListener('change', (e) => {
      STATE.filterCategory = e.target.value;
      renderRadicalGrid();
    });
  }
  
  // Setup Stroke Count Filter
  const fStrs = document.getElementById('filter-strokes');
  if (fStrs) {
    fStrs.addEventListener('change', (e) => {
      STATE.filterStrokes = e.target.value;
      renderRadicalGrid();
    });
  }
  
  // UI buttons in Dictionary Canvas area
  document.getElementById('play-btn').addEventListener('click', playStrokeAnimation);
  document.getElementById('clear-btn').addEventListener('click', resetPracticeSession);
  
  // Setup Speak Button
  const speakBtn = document.getElementById('speak-btn');
  if (speakBtn) {
    speakBtn.addEventListener('click', () => {
      const rad = radicals.find(r => r.no === STATE.selectedRadicalNo);
      if (rad) {
        speakChinese(rad.char);
      }
    });
  }
  
  // Launch WebGPU engine asynchronously (runs fallback particle loops if missing)
  await initWebGPU();
  
  // Start uniform particle computation loops
  requestAnimationFrame(updateAndRenderParticles);
});
