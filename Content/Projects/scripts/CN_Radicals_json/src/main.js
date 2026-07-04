// Core Logic for the Chinese Radicals Study Application
// Built with pure Vanilla JS, Canvas, and WebGPU fallback. Zero modern bloat.

import { getRadicals } from './constructor.js';

let radicals = [];

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
  
  // SRS Config
  srsConfig: {
    quizMode: 'flashcard', // 'flashcard' | 'pinyin' | 'translation' | 'symbol'
    enabledCategories: [], // populated dynamically
    enabledStrokes: []     // populated dynamically
  },
  
  // Interactive quiz state
  quizAnswerSubmitted: false,
  quizUserAnswer: '',
  quizAnswerCorrect: false,
  quizCheated: false,
  quizGrepQuery: '',
  
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
  hanziWriterLoaded: false,
  
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
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) {
    console.log("Mobile device detected. Bypassing WebGPU initialization for an ultra-lightweight mobile experience.");
    updateWebGpuStatus(false);
    return;
  }

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
  // Completely disabled based on user feedback. It doesn't match the clean calligraphy lines.
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
    
    // Calligraphy liquid dynamics: strong gravity pull downwards, horizontal drag
    p.vy += 0.12; // Gravity
    p.gpuVy -= 0.12 / 160;
    
    p.vx *= 0.91; // Horizontal friction (limits wide spreading)
    p.vy *= 0.95; // Heavy fluid friction (creates realistic viscous terminal velocity)
    p.gpuVx *= 0.91;
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
      tempCtx.globalAlpha = p.alpha * 0.55;
      
      // Calculate speed and angle to stretch the ink droplet along its motion path
      const speed = Math.hypot(p.vx, p.vy);
      const angle = Math.atan2(p.vy, p.vx);
      
      tempCtx.beginPath();
      const rx = p.size * 1.1;
      const ry = p.size * (1.1 + speed * 0.35); // Visually elongates the drip based on velocity
      
      if (tempCtx.ellipse) {
        // Draw standard teardrop-shaped ellipse pointing along velocity vector
        tempCtx.ellipse(p.x, p.y, rx, ry, angle - Math.PI / 2, 0, Math.PI * 2);
      } else {
        tempCtx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
      }
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
        data[offset + 2] = p.r || 0.1; // R
        data[offset + 3] = p.g || 0.1; // G
        data[offset + 4] = p.b || 0.1; // B
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
  
  if (STATE.particles2D.length > 0) {
    requestAnimationFrame(updateAndRenderParticles);
  }
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
  
  // Load srsConfig
  const savedConfig = localStorage.getItem('kangxi_srs_config');
  if (savedConfig) {
    try {
      STATE.srsConfig = JSON.parse(savedConfig);
      if (!STATE.srsConfig.quizMode) STATE.srsConfig.quizMode = 'flashcard';
      if (!STATE.srsConfig.enabledCategories) STATE.srsConfig.enabledCategories = [];
      if (!STATE.srsConfig.enabledStrokes) STATE.srsConfig.enabledStrokes = [];
    } catch (e) {
      console.warn("Could not load local storage SRS config.", e);
    }
  } else {
    // Enable all categories & strokes by default
    const allCategories = Array.from(new Set(radicals.map(r => r.category.toUpperCase())));
    const allStrokes = Array.from(new Set(radicals.map(r => r.strokes)));
    STATE.srsConfig = {
      quizMode: 'flashcard',
      enabledCategories: allCategories,
      enabledStrokes: allStrokes
    };
  }
}

function saveSrsConfig() {
  localStorage.setItem('kangxi_srs_config', JSON.stringify(STATE.srsConfig));
}

function saveSrsData() {
  localStorage.setItem('kangxi_srs_state', JSON.stringify(STATE.srs));
  renderStats();
}

// --- CALIGRAPHY CANVAS DRAWING ENGINE ---
function setupCalligraphyCanvas() {
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1);
  
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

  if (isMobileDevice) {
    // Hide our custom practice canvas on mobile/iPad to avoid heavy ink bleed SVG filters and use high performance native SVG drawing instead
    STATE.canvas.style.display = 'none';
    return;
  } else {
    STATE.canvas.style.display = 'block';
  }

  const container = document.getElementById('hanzi-writer-container');
  if (container) {
    // Prevent touch action from scrolling or zooming while drawing
    container.style.touchAction = 'none';

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let lastT = 0;
    let lastWidth = 10;
    let rect = null; // Cache rect to completely prevent layout thrashing on pointermove

    const startDrawing = (e) => {
      isDrawing = true;
      
      // Compute and cache rect once at the beginning of the stroke gesture
      rect = container.getBoundingClientRect();
      
      // Safe clientX/clientY with TouchEvent fallback for mobile WebKit / iPads
      const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

      // Mathematically map client coordinate space back to the 320x320 canvas pixels
      const x = ((clientX - rect.left) / rect.width) * STATE.canvas.width;
      const y = ((clientY - rect.top) / rect.height) * STATE.canvas.height;

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
      
      // Robust fallback if rect wasn't cached on pointerdown
      if (!rect) {
        rect = container.getBoundingClientRect();
      }
      
      // Safe clientX/clientY with TouchEvent fallback for mobile WebKit / iPads
      const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

      const x = ((clientX - rect.left) / rect.width) * STATE.canvas.width;
      const y = ((clientY - rect.top) / rect.height) * STATE.canvas.height;

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
      rect = null; // Reset cached rect
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

  // Extremely streamlined native rendering - no heavy ctx.save() or ctx.restore() overhead
  ctx.lineWidth = (w1 + w2) / 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
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
  // Configure default drawing state once to avoid context state mutation overhead inside drawInkSegment
  STATE.ctx.lineCap = 'round';
  STATE.ctx.lineJoin = 'round';
  STATE.ctx.strokeStyle = '#1a1a1a'; // Pitch black charcoal ink
}

// Hanzi Writer Integration Core with Dual-Layer caching (In-Memory + persistent LocalStorage)
const HANZI_CHAR_DATA_CACHE = new Map();

function customCharDataLoader(char, onComplete, onFailure) {
  // 1. Check in-memory cache
  if (HANZI_CHAR_DATA_CACHE.has(char)) {
    onComplete(HANZI_CHAR_DATA_CACHE.get(char));
    return;
  }
  
  // 2. Check localStorage cache to completely eliminate slow loading & lags!
  try {
    const cached = localStorage.getItem(`hanzi-char-svg-${char}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      HANZI_CHAR_DATA_CACHE.set(char, parsed);
      onComplete(parsed);
      return;
    }
  } catch (e) {
    console.warn("localStorage read error in customCharDataLoader:", e);
  }
  
  // 3. Fallback to fast JSDelivr CDN
  const cdnUrl = `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${encodeURIComponent(char)}.json`;
  
  fetch(cdnUrl)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return res.json();
    })
    .then(data => {
      // Save to memory cache
      HANZI_CHAR_DATA_CACHE.set(char, data);
      
      // Save to persistent storage cache
      try {
        localStorage.setItem(`hanzi-char-svg-${char}`, JSON.stringify(data));
      } catch (e) {
        // Safe check for quota limits or incognito restrictions
      }
      onComplete(data);
    })
    .catch(err => {
      onFailure(err);
    });
}

function initHanziWriter(char) {
  // Properly cancel previous quiz to release any internal HanziWriter references/timers
  if (STATE.hanziWriter) {
    try {
      STATE.hanziWriter.cancelQuiz();
    } catch (e) {
      console.warn("Could not cancel previous quiz:", e);
    }
    STATE.hanziWriter = null;
  }

  let container = document.getElementById('hanzi-writer-container');
  if (!container) return;
  
  // Re-create the container by cloning to strip all HanziWriter and previous event listeners completely
  const newContainer = container.cloneNode(false);
  container.parentNode.replaceChild(newContainer, container);
  container = newContainer;
  
  // Re-run calligraphy canvas setup to attach clean drawing listeners to the new container node
  setupCalligraphyCanvas();
  
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
  
  // Handle Latin or ASCII characters (like 'Q' or space or numbers) which can't be drawn
  const isLatin = targetChar && (/^[A-Za-z0-9\s\-_]$/.test(targetChar) || targetChar.charCodeAt(0) < 128);
  if (isLatin) {
    container.innerHTML = `
      <div class="latin-char-display" style="font-size: 6rem; font-family: var(--font-sans); font-weight: 800; color: var(--accent-amber); text-align: center; line-height: 320px; animation: popIn 0.5s ease; position: relative; z-index: 2; user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; pointer-events: none;">
        ${targetChar}
        <div style="font-size: 0.8rem; font-family: var(--font-mono); color: #888; position: absolute; bottom: 20px; left: 0; right: 0; line-height: 1.2; letter-spacing: 1px; text-transform: uppercase; user-select: none; -webkit-user-select: none;">Latin Character - Auto OK</div>
      </div>
    `;
    
    setTimeout(() => {
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
      clearDrawingCanvas();
    }, 1000);
    return;
  }
  
  STATE.hanziWriterLoaded = false;
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1);

  if (typeof HanziWriter !== 'undefined') {
    STATE.hanziWriter = HanziWriter.create('hanzi-writer-container', targetChar, {
      width: 320,
      height: 320,
      padding: 30,
      strokeColor: '#1a1a1a', // Pitch black charcoal ink
      outlineColor: 'rgba(0, 0, 0, 0.08)', // Faint trace guide
      drawingColor: isMobileDevice ? '#1a1a1a' : 'rgba(0, 0, 0, 0)', // User drawing is native on mobile, custom-buffered on desktop
      drawingWidth: 10,
      showOutline: true,
      showCharacter: false, // hide initially so they can practice
      highlightColor: '#ff4d4d', // Red highlight guide
      charDataLoader: customCharDataLoader, // Enable instant local storage caching
      onLoadCharDataSuccess: function(charData) {
        STATE.hanziWriterLoaded = true;
        // Once successfully loaded, perform a clean programmatical clear to avoid scuffed states
        setTimeout(() => {
          clearDrawingCanvas();
          const canvasBox = document.getElementById('practice-canvas-box');
          if (canvasBox) {
            canvasBox.classList.remove('error-state', 'success-state', 'mastered-state');
          }
        }, 80);
      },
      onLoadCharDataError: function(err) {
        console.warn('Failed to load Hanzi character data:', err);
      }
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
  
  // ALWAYS clear the user's drawing layers and container status classes instantly!
  clearDrawingCanvas();
  const canvasBox = document.getElementById('practice-canvas-box');
  if (canvasBox) {
    canvasBox.className = 'brush-canvas-box'; // Reset state modifier classes
  }

  if (rad) {
    if (STATE.hanziWriter && STATE.hanziWriterLoaded) {
      // Re-use the existing, already loaded HanziWriter instance to prevent redundant network requests and DOM recreations!
      try {
        STATE.hanziWriter.cancelQuiz();
      } catch (e) {}
      startHanziQuiz();
    } else if (!STATE.hanziWriter) {
      // Create new writer only when starting or when explicitly nullified
      STATE.multiCharSequence = [];
      STATE.multiCharIndex = 0;
      initHanziWriter(rad.char);
    }
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

// Normalize string by converting to lowercase and stripping accents / diacritics for search
function normalizeForSearch(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ü/g, 'v');
}

// Render a string of characters (single or multi-character) as a grid or beautifully aligned box
function renderCharAsGrid(char) {
  if (!char) return '';
  if (char.length <= 1) {
    return `<div style="font-size: 1.8rem; font-family: var(--font-serif); font-weight: 700; color: var(--accent-amber); display: flex; align-items: center; justify-content: center; height: 100%; user-select: none; -webkit-user-select: none;">${char}</div>`;
  }
  
  let columns = 2;
  let fontSize = '0.9rem';
  let lineHeight = '1.1';
  
  if (char.length === 2) {
    columns = 2;
    fontSize = '1.1rem';
  } else if (char.length === 3) {
    columns = 2;
    fontSize = '0.95rem';
  } else if (char.length >= 4) {
    columns = 2;
    fontSize = '0.85rem';
  }
  
  const chars = Array.from(char);
  const items = chars.map(c => `<span style="display: flex; align-items: center; justify-content: center; user-select: none; -webkit-user-select: none;">${c}</span>`).join('');
  
  return `
    <div style="display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: 1px; justify-items: center; align-items: center; font-size: ${fontSize}; font-family: var(--font-serif); font-weight: 700; color: var(--accent-amber); line-height: ${lineHeight}; width: 100%; height: 100%; text-align: center; box-sizing: border-box; user-select: none; -webkit-user-select: none;">
      ${items}
    </div>
  `;
}

// Filter and display the Left Radical Grid list
function renderRadicalGrid() {
  const grid = document.getElementById('radical-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  const enabledCats = STATE.srsConfig.enabledCategories || [];
  const enabledStrs = STATE.srsConfig.enabledStrokes || [];
  
  // Filters matching logic
  const filtered = radicals.filter(rad => {
    // Check if radical belongs to globally enabled category pool
    if (enabledCats.length > 0 && !enabledCats.includes(rad.category.toUpperCase())) {
      return false;
    }
    // Check if radical belongs to globally enabled stroke count pool
    if (enabledStrs.length > 0 && !enabledStrs.includes(rad.strokes)) {
      return false;
    }

    // Search query matches character, pinyin, or meaning
    const queryNorm = normalizeForSearch(STATE.searchQuery);
    const matchesSearch = 
      rad.char.includes(STATE.searchQuery) ||
      normalizeForSearch(rad.pinyin).includes(queryNorm) ||
      normalizeForSearch(rad.meaning).includes(queryNorm);
      
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
  
  // Limit visible items for blazing-fast DOM performance and zero layout lag!
  if (!STATE.gridLimit) {
    STATE.gridLimit = 120;
  }
  const LIMIT = STATE.gridLimit;
  const visibleItems = filtered.slice(0, LIMIT);
  
  visibleItems.forEach(rad => {
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
  
  // Render show more button if there are more remaining matching items
  if (filtered.length > LIMIT) {
    const showMoreCell = document.createElement('div');
    showMoreCell.className = 'radical-cell show-more-cell';
    showMoreCell.style.gridColumn = '1 / -1';
    showMoreCell.style.aspectRatio = 'auto';
    showMoreCell.style.padding = '14px';
    showMoreCell.style.marginTop = '6px';
    showMoreCell.style.textAlign = 'center';
    showMoreCell.style.background = 'rgba(212, 175, 55, 0.08)';
    showMoreCell.style.border = '1px dashed rgba(212, 175, 55, 0.4)';
    showMoreCell.style.borderRadius = 'var(--radius-md)';
    showMoreCell.style.color = 'var(--accent-amber)';
    showMoreCell.style.fontWeight = '700';
    showMoreCell.style.fontSize = '0.8rem';
    showMoreCell.style.fontFamily = 'var(--font-mono)';
    showMoreCell.style.cursor = 'pointer';
    showMoreCell.style.transition = 'all 0.2s ease';
    
    // Simple hover effect
    showMoreCell.addEventListener('mouseenter', () => {
      showMoreCell.style.background = 'rgba(212, 175, 55, 0.15)';
      showMoreCell.style.borderColor = 'var(--accent-amber)';
    });
    showMoreCell.addEventListener('mouseleave', () => {
      showMoreCell.style.background = 'rgba(212, 175, 55, 0.08)';
      showMoreCell.style.borderColor = 'rgba(212, 175, 55, 0.4)';
    });
    
    showMoreCell.innerHTML = `<span>SHOW MORE RADICALS (+${filtered.length - LIMIT} REMAINING)</span>`;
    
    showMoreCell.addEventListener('click', () => {
      STATE.gridLimit += 120;
      renderRadicalGrid();
    });
    
    grid.appendChild(showMoreCell);
  }
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
  
  // Setup practice engine state with a small delay to avoid thread contention with DOM updates
  setTimeout(() => {
    resetPracticeSession();
  }, 100);
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
  
  // Explicitly cancel and nullify previous HanziWriter reference on new selection
  if (STATE.hanziWriter) {
    try {
      STATE.hanziWriter.cancelQuiz();
    } catch (e) {}
    STATE.hanziWriter = null;
  }
  STATE.hanziWriterLoaded = false;
  
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

// Normalization helper to strip tone accents from Pinyin (for forgiving matching)
function normalizePinyin(str) {
  if (!str) return '';
  return str.toLowerCase()
    .normalize('NFD') // splits accents from characters
    .replace(/[\u0300-\u036f]/g, '') // removes accents
    .replace(/v/g, 'u') // map v to u/ü
    .replace(/ü/g, 'u')
    .replace(/\s+/g, '') // strip spacing
    .trim();
}

// Translation matcher helper supporting split meanings
function checkTranslationMatch(userAns, correctMeaning) {
  if (!userAns || !correctMeaning) return false;
  const normalizedUser = userAns.toLowerCase().trim();
  
  // Split correct meaning by comma, slash, semicolon, or parenthesis
  const segments = correctMeaning.toLowerCase()
    .split(/[\/,;\(\)]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
    
  return segments.some(seg => seg === normalizedUser || seg.includes(normalizedUser) && normalizedUser.length >= 3);
}

// Helper to detect if a character is slang/meme or contains a double/triple structure
function isSlangOrDoubleTriple(r) {
  const slangCats = ['SLANG_ALPHA', 'NETIZEN_BUZZ', 'ALPHA_ACRONYM', 'NUMERIC_CODE'];
  if (slangCats.includes(r.category.toUpperCase())) {
    return true;
  }
  const desc = (r.meaning + ' ' + (r.etymology || '') + ' ' + (r.funFact || '')).toLowerCase();
  if (desc.includes('double') || desc.includes('triple') || desc.includes('slang') || desc.includes('meme')) {
    return true;
  }
  return false;
}

// Build SRS review queue based on nextReviewDate & Pool Settings
function buildQuizQueue() {
  const now = new Date();
  const queue = [];
  const activeList = Object.keys(STATE.srs.learned);
  
  // Get active pool filters
  const enabledCats = STATE.srsConfig.enabledCategories || [];
  const enabledStrs = STATE.srsConfig.enabledStrokes || [];
  
  radicals.forEach(rad => {
    // Check if radical belongs to active category pool
    if (enabledCats.length > 0 && !enabledCats.includes(rad.category.toUpperCase())) {
      return;
    }
    // Check if radical belongs to active stroke count pool
    if (enabledStrs.length > 0 && !enabledStrs.includes(rad.strokes)) {
      return;
    }

    // Low chance for slang/double/triple unless explicitly filtering for it
    if (isSlangOrDoubleTriple(rad)) {
      const isFilteringSlang = enabledCats.some(c => ['SLANG_ALPHA', 'NETIZEN_BUZZ', 'ALPHA_ACRONYM', 'NUMERIC_CODE'].includes(c.toUpperCase()));
      if (!isFilteringSlang) {
        if (Math.random() > 0.1) {
          return;
        }
      }
    }

    const srsRecord = STATE.srs.learned[rad.no];
    if (srsRecord) {
      const nextReviewDate = new Date(srsRecord.nextReview);
      
      // Calculate weight based on SRS status
      let weight = 10; // Default weight
      if (nextReviewDate <= now) weight = 100; // Due cards - high priority
      else if (srsRecord.forgotCount > 0 || srsRecord.interval < 3) weight = 100; // Forgotten/Needs review
      else if (srsRecord.interval >= 14) weight = 1; // Mastered cards - low priority

      // Add to queue based on weight
      if (Math.random() * 100 < weight) {
        queue.push(rad);
      }
    }
  });
  
  // If no reviews are due right now, let's inject a few of our already learned/drawn cards so we can still practice!
  if (queue.length === 0) {
    radicals.forEach(rad => {
      const srsRecord = STATE.srs.learned[rad.no];
      if (srsRecord) {
        // Check if radical belongs to active category pool
        if (enabledCats.length > 0 && !enabledCats.includes(rad.category.toUpperCase())) {
          return;
        }
        // Check if radical belongs to active stroke count pool
        if (enabledStrs.length > 0 && !enabledStrs.includes(rad.strokes)) {
          return;
        }
        queue.push(rad);
      }
    });
  }
  
  // Shuffle queue to randomize study order
  STATE.quizQueue = queue.sort(() => Math.random() - 0.5);
  STATE.quizIndex = 0;
  STATE.quizFlipped = false;
  STATE.quizAnswerSubmitted = false;
  STATE.quizUserAnswer = '';
  STATE.quizAnswerCorrect = false;
  STATE.quizCheated = false;
  STATE.quizGrepQuery = '';
  
  renderSrsQuizView();
}

// Render the bento toggle boxes in pool configurations
function renderPoolToggles() {
  const catContainer = document.getElementById('modal-category-pool-toggles');
  const strokeContainer = document.getElementById('modal-strokes-pool-toggles');
  if (!catContainer || !strokeContainer) return;
  
  // Extract all categories and strokes present in radicals dataset
  const allCategories = Array.from(new Set(radicals.map(r => r.category.toUpperCase()))).sort();
  const allStrokes = Array.from(new Set(radicals.map(r => r.strokes))).sort((a,b) => a-b);
  
  const cfg = STATE.tempSrsConfig || STATE.srsConfig;
  const enabledCats = cfg.enabledCategories || [];
  const enabledStrs = cfg.enabledStrokes || [];
  
  // Render category buttons
  catContainer.innerHTML = '';
  allCategories.forEach(cat => {
    const isActive = enabledCats.includes(cat);
    const btn = document.createElement('button');
    btn.className = `pool-toggle-btn ${isActive ? 'active' : ''}`;
    btn.innerText = cat.replace(/_/g, ' ');
    btn.onclick = () => {
      window.toggleCategoryFilter(cat);
    };
    catContainer.appendChild(btn);
  });
  
  // Render stroke buttons
  strokeContainer.innerHTML = '';
  allStrokes.forEach(str => {
    const isActive = enabledStrs.includes(str);
    const btn = document.createElement('button');
    btn.className = `pool-toggle-btn ${isActive ? 'active' : ''}`;
    btn.innerText = `${str} STROKE${str > 1 ? 'S' : ''}`;
    btn.onclick = () => {
      window.toggleStrokeFilter(str);
    };
    strokeContainer.appendChild(btn);
  });
}

// Global functions for toggles (called from DOM)
window.toggleCategoryFilter = function(cat) {
  if (!STATE.tempSrsConfig) {
    STATE.tempSrsConfig = {
      enabledCategories: [...(STATE.srsConfig.enabledCategories || [])],
      enabledStrokes: [...(STATE.srsConfig.enabledStrokes || [])]
    };
  }
  const idx = STATE.tempSrsConfig.enabledCategories.indexOf(cat);
  if (idx > -1) {
    STATE.tempSrsConfig.enabledCategories.splice(idx, 1);
  } else {
    STATE.tempSrsConfig.enabledCategories.push(cat);
  }
  renderPoolToggles();
};

window.toggleStrokeFilter = function(str) {
  if (!STATE.tempSrsConfig) {
    STATE.tempSrsConfig = {
      enabledCategories: [...(STATE.srsConfig.enabledCategories || [])],
      enabledStrokes: [...(STATE.srsConfig.enabledStrokes || [])]
    };
  }
  const idx = STATE.tempSrsConfig.enabledStrokes.indexOf(str);
  if (idx > -1) {
    STATE.tempSrsConfig.enabledStrokes.splice(idx, 1);
  } else {
    STATE.tempSrsConfig.enabledStrokes.push(str);
  }
  renderPoolToggles();
};

window.toggleAllCategories = function(enableAll) {
  if (!STATE.tempSrsConfig) {
    STATE.tempSrsConfig = {
      enabledCategories: [...(STATE.srsConfig.enabledCategories || [])],
      enabledStrokes: [...(STATE.srsConfig.enabledStrokes || [])]
    };
  }
  if (enableAll) {
    STATE.tempSrsConfig.enabledCategories = Array.from(new Set(radicals.map(r => r.category.toUpperCase()))).sort();
  } else {
    STATE.tempSrsConfig.enabledCategories = [];
  }
  renderPoolToggles();
};

window.toggleAllStrokes = function(enableAll) {
  if (!STATE.tempSrsConfig) {
    STATE.tempSrsConfig = {
      enabledCategories: [...(STATE.srsConfig.enabledCategories || [])],
      enabledStrokes: [...(STATE.srsConfig.enabledStrokes || [])]
    };
  }
  if (enableAll) {
    STATE.tempSrsConfig.enabledStrokes = Array.from(new Set(radicals.map(r => r.strokes))).sort((a,b) => a-b);
  } else {
    STATE.tempSrsConfig.enabledStrokes = [];
  }
  renderPoolToggles();
};

window.setQuizMode = function(mode) {
  STATE.srsConfig.quizMode = mode;
  saveSrsConfig();
  
  const modes = ['flashcard', 'pinyin', 'translation', 'symbol'];
  modes.forEach(m => {
    const btn = document.getElementById(`mode-btn-${m}`);
    if (btn) {
      if (m === mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });
  
  // Reset active quiz interaction state
  STATE.quizFlipped = false;
  STATE.quizAnswerSubmitted = false;
  STATE.quizUserAnswer = '';
  STATE.quizAnswerCorrect = false;
  STATE.quizCheated = false;
  STATE.quizGrepQuery = '';
  
  renderSrsQuizView();
};

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
  
  // Next review counts calculation
  const now = new Date();
  const pendingCount = Object.keys(srsData).filter(k => new Date(srsData[k].nextReview) <= now).length;
  document.getElementById('srs-pending-val').innerText = pendingCount;

  // Forgotten count calculation (learned items that have been forgotten at least once)
  const forgottenCount = Object.keys(srsData).filter(k => srsData[k].forgotCount > 0).length;
  document.getElementById('srs-forgotten-val').innerText = forgottenCount;
  
  // Render mode selector highlighted buttons
  const modes = ['flashcard', 'pinyin', 'translation', 'symbol'];
  modes.forEach(m => {
    const btn = document.getElementById(`mode-btn-${m}`);
    if (btn) {
      if (m === STATE.srsConfig.quizMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });
  
  // Render forgotten trouble radicals
  renderTroubleRadicals();
  
  // Render pool toggles
  renderPoolToggles();
  
  // Initialize or resume study queue
  buildQuizQueue();
}

function getPinyinSuggestions(typed, targetPinyin) {
  const cleanTyped = normalizePinyin(typed);
  if (!cleanTyped) return [];

  // Get unique pinyins from radicals database
  const uniquePinyins = Array.from(new Set(radicals.map(r => r.pinyin.toLowerCase().trim())));

  // Filter those whose normalized form starts with cleanTyped
  const matches = uniquePinyins.filter(p => {
    const cleanP = normalizePinyin(p);
    return cleanP.startsWith(cleanTyped);
  });

  const targetClean = normalizePinyin(targetPinyin);
  
  // Sort them
  matches.sort((a, b) => {
    const cleanA = normalizePinyin(a);
    const cleanB = normalizePinyin(b);
    
    // Exact target base match first (e.g. if target is "yī", show other "yi" variants like "yǐ", "yì" first)
    const aIsTargetBase = (cleanA === targetClean);
    const bIsTargetBase = (cleanB === targetClean);
    if (aIsTargetBase && !bIsTargetBase) return -1;
    if (!aIsTargetBase && bIsTargetBase) return 1;
    
    // Exact typed match next
    const aIsExact = (cleanA === cleanTyped);
    const bIsExact = (cleanB === cleanTyped);
    if (aIsExact && !bIsExact) return -1;
    if (!aIsExact && bIsExact) return 1;
    
    return cleanA.localeCompare(cleanB);
  });

  return matches.slice(0, 8);
}

window.updatePinyinSuggestions = function() {
  const qInput = document.getElementById('quiz-input');
  const suggestionsBox = document.getElementById('pinyin-suggestions-box');
  if (!qInput || !suggestionsBox) return;

  const typed = qInput.value;
  const rad = STATE.quizQueue[STATE.quizIndex];
  if (!rad) return;

  const suggestions = getPinyinSuggestions(typed, rad.pinyin);

  if (suggestions.length === 0) {
    suggestionsBox.innerHTML = '';
    suggestionsBox.style.display = 'none';
    return;
  }

  suggestionsBox.style.display = 'flex';
  suggestionsBox.innerHTML = suggestions.map(s => {
    return `
      <button class="pinyin-sugg-btn" data-val="${s}">
        ${s.toUpperCase()}
      </button>
    `;
  }).join('');

  // Add click listeners to suggestions
  suggestionsBox.querySelectorAll('.pinyin-sugg-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const val = e.currentTarget.getAttribute('data-val');
      qInput.value = val;
      checkTypedQuizAns();
    });
  });
};

window.toggleSrsCardFlip = function() {
  const mode = STATE.srsConfig.quizMode || 'flashcard';
  
  STATE.quizFlipped = !STATE.quizFlipped;
  
  if (mode !== 'flashcard') {
    // Interactive modes: pinyin, translation, symbol
    // If they haven't submitted a typed answer yet, flipping the card toggles the cheat/reveal state
    if (!STATE.quizAnswerSubmitted || STATE.quizCheated) {
      if (STATE.quizFlipped) {
        STATE.quizCheated = true;
        STATE.quizAnswerSubmitted = true;
      } else {
        STATE.quizCheated = false;
        STATE.quizAnswerSubmitted = false;
        STATE.quizUserAnswer = '';
        STATE.quizAnswerCorrect = false;
      }
    }
  }
  renderSrsQuizView();
};

function renderSrsQuizView() {
  const container = document.getElementById('srs-quiz-box');
  if (!container) return;
  
  // Dynamically update bottom SRS stats
  const srsData = STATE.srs.learned;
  const masteredCount = Object.keys(srsData).filter(k => srsData[k].interval >= 14).length;
  const activeCount = Object.keys(srsData).filter(k => srsData[k].interval < 14).length;
  
  const mVal = document.getElementById('srs-mastered-val');
  if (mVal) mVal.innerText = masteredCount;
  const lVal = document.getElementById('srs-learning-val');
  if (lVal) lVal.innerText = activeCount;
  
  const now = new Date();
  const pendingCount = Object.keys(srsData).filter(k => new Date(srsData[k].nextReview) <= now).length;
  const pVal = document.getElementById('srs-pending-val');
  if (pVal) pVal.innerText = pendingCount;

  const forgottenCount = Object.keys(srsData).filter(k => srsData[k].forgotCount > 0).length;
  const fVal = document.getElementById('srs-forgotten-val');
  if (fVal) fVal.innerText = forgottenCount;

  renderTroubleRadicals();
  
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
  const mode = STATE.srsConfig.quizMode || 'flashcard';
  
  let cardContentHTML = '';
  let quizActionsHTML = '';
  
  if (mode === 'flashcard') {
    cardContentHTML = `
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
              ${rad.etymology ? rad.etymology.substring(0, 100) + '...' : ''}
            </p>
            <span class="hint-text">CLICK TO CLOSE</span>
          </div>
        </div>
      </div>
    `;
    
    quizActionsHTML = `
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
  } 
  else if (mode === 'pinyin') {
    cardContentHTML = `
      <div class="flashcard-container" id="flashcard-box" style="cursor: pointer;" title="Click card to flip">
        <div class="flashcard ${STATE.quizFlipped ? 'flipped' : ''}" id="flashcard">
          <!-- Front of card -->
          <div class="card-face card-front" style="border-radius: var(--radius-lg);">
            <span class="char-display">${rad.char}</span>
            <div class="mode-prompt-info">Meaning: ${rad.meaning.toUpperCase()}</div>
            <div class="hint-text">Type Pinyin Below or Click Card to Reveal</div>
          </div>
          <!-- Back of card -->
          <div class="card-face card-back" style="border-radius: var(--radius-lg);">
            <span class="char-meaning">${rad.meaning}</span>
            <span class="char-pinyin-display">[ ${rad.pinyin.toUpperCase()} ]</span>
            <p style="font-size:0.8rem; margin-top: 12px; text-align:center; padding: 0 10px;">
              ${rad.etymology ? rad.etymology.substring(0, 100) + '...' : ''}
            </p>
            <span class="hint-text">CLICK CARD TO FLIP BACK</span>
          </div>
        </div>
      </div>
    `;
    
    if (!STATE.quizAnswerSubmitted) {
      quizActionsHTML = `
        <div class="quiz-input-container">
          <input type="text" id="quiz-input" class="quiz-input-field" placeholder="Enter Pinyin pronunciation..." autocomplete="off" />
          <div id="pinyin-suggestions-box" class="pinyin-suggestions" style="display: none; width: 100%;"></div>
          <div class="quiz-actions" style="width:100%;">
            <button class="btn-raw btn-accent" style="flex:1;" id="submit-ans-btn">SUBMIT ANSWER</button>
          </div>
        </div>
      `;
    } else {
      let statusClass = 'correct';
      let statusText = `✨ Correct! [ ${rad.pinyin.toUpperCase()} ]`;
      if (STATE.quizCheated) {
        statusClass = 'cheated';
        statusText = `👁️ Revealed: [ ${rad.pinyin.toUpperCase()} ]`;
      } else if (!STATE.quizAnswerCorrect) {
        statusClass = 'incorrect';
        statusText = `❌ Incorrect! Answer: "${STATE.quizUserAnswer}". Correct: [ ${rad.pinyin.toUpperCase()} ]`;
      }
      
      quizActionsHTML = `
        <div class="quiz-input-container">
          <div class="quiz-status-msg ${statusClass}">${statusText}</div>
          <p style="font-size:0.75rem; text-align:center; font-weight:700; margin-bottom:4px; margin-top:8px;">RATE YOUR RETENTION LEVEL TO SAVE PROGRESS:</p>
          <div class="quiz-actions" style="width:100%;">
            <button class="btn-raw btn-red" id="srs-forgot">FORGOT</button>
            <button class="btn-raw btn-raw" style="border-color:#e5930e; background:#fffbf0;" id="srs-hard">HARD</button>
            <button class="btn-raw btn-green" id="srs-good">GOOD</button>
            <button class="btn-raw" style="background:#ccfffc;" id="srs-mastered">EASY</button>
          </div>
        </div>
      `;
    }
  } 
  else if (mode === 'translation') {
    cardContentHTML = `
      <div class="flashcard-container" id="flashcard-box" style="cursor: pointer;" title="Click card to flip">
        <div class="flashcard ${STATE.quizFlipped ? 'flipped' : ''}" id="flashcard">
          <!-- Front of card -->
          <div class="card-face card-front" style="border-radius: var(--radius-lg);">
            <span class="char-display">${rad.char}</span>
            <div class="mode-prompt-info">Pronunciation: ${rad.pinyin.toUpperCase()}</div>
            <div class="hint-text">Type Translation Below or Click Card to Reveal</div>
          </div>
          <!-- Back of card -->
          <div class="card-face card-back" style="border-radius: var(--radius-lg);">
            <span class="char-meaning">${rad.meaning}</span>
            <span class="char-pinyin-display">[ ${rad.pinyin.toUpperCase()} ]</span>
            <p style="font-size:0.8rem; margin-top: 12px; text-align:center; padding: 0 10px;">
              ${rad.etymology ? rad.etymology.substring(0, 100) + '...' : ''}
            </p>
            <span class="hint-text">CLICK CARD TO FLIP BACK</span>
          </div>
        </div>
      </div>
    `;
    
    if (!STATE.quizAnswerSubmitted) {
      quizActionsHTML = `
        <div class="quiz-input-container">
          <input type="text" id="quiz-input" class="quiz-input-field" placeholder="Enter translation/meaning..." autocomplete="off" />
          <div class="quiz-actions" style="width:100%;">
            <button class="btn-raw btn-accent" style="flex:1;" id="submit-ans-btn">SUBMIT ANSWER</button>
          </div>
        </div>
      `;
    } else {
      let statusClass = 'correct';
      let statusText = `✨ Correct! [ ${rad.meaning.toUpperCase()} ]`;
      if (STATE.quizCheated) {
        statusClass = 'cheated';
        statusText = `👁️ Revealed: [ ${rad.meaning.toUpperCase()} ]`;
      } else if (!STATE.quizAnswerCorrect) {
        statusClass = 'incorrect';
        statusText = `❌ Incorrect! Answer: "${STATE.quizUserAnswer}". Correct: [ ${rad.meaning.toUpperCase()} ]`;
      }
      
      quizActionsHTML = `
        <div class="quiz-input-container">
          <div class="quiz-status-msg ${statusClass}">${statusText}</div>
          <p style="font-size:0.75rem; text-align:center; font-weight:700; margin-bottom:4px; margin-top:8px;">RATE YOUR RETENTION LEVEL TO SAVE PROGRESS:</p>
          <div class="quiz-actions" style="width:100%;">
            <button class="btn-raw btn-red" id="srs-forgot">FORGOT</button>
            <button class="btn-raw btn-raw" style="border-color:#e5930e; background:#fffbf0;" id="srs-hard">HARD</button>
            <button class="btn-raw btn-green" id="srs-good">GOOD</button>
            <button class="btn-raw" style="background:#ccfffc;" id="srs-mastered">EASY</button>
          </div>
        </div>
      `;
    }
  } 
  else if (mode === 'symbol') {
    cardContentHTML = `
      <div class="flashcard-container" id="flashcard-box" style="cursor: pointer;" title="Click card to flip">
        <div class="flashcard ${STATE.quizFlipped ? 'flipped' : ''}" id="flashcard">
          <!-- Front of card -->
          <div class="card-face card-front" style="border-radius: var(--radius-lg);">
            <span class="char-display" style="font-size: 2.8rem; line-height: 1.2;">${rad.meaning.toUpperCase()}</span>
            <div class="mode-prompt-info">Pronunciation: ${rad.pinyin.toUpperCase()}</div>
            <div class="hint-text" style="margin-top: 15px;">Pick symbol below or Click Card to Reveal</div>
          </div>
          <!-- Back of card -->
          <div class="card-face card-back" style="border-radius: var(--radius-lg);">
            <span class="char-meaning" style="font-size: 5rem; line-height: 1;">${rad.char}</span>
            <span class="char-meaning" style="font-size: 1.5rem; margin-top: 8px;">${rad.meaning}</span>
            <span class="char-pinyin-display">[ ${rad.pinyin.toUpperCase()} ]</span>
            <span class="hint-text">CLICK CARD TO FLIP BACK</span>
          </div>
        </div>
      </div>
    `;
    
    if (!STATE.quizAnswerSubmitted) {
      // Get stable symbol options from STATE
      let symbolOptions = [];
      if (STATE.quizSymbolOptions && STATE.quizSymbolOptions.char === rad.char) {
        symbolOptions = STATE.quizSymbolOptions.options;
      } else {
        const targetLen = rad.char.length;
        const pool = [rad];
        const otherRadicals = radicals.filter(r => r.char !== rad.char);
        
        // Find other radicals of exactly the same character length
        let sameLenOthers = otherRadicals.filter(r => r.char.length === targetLen);
        
        // Shuffle those
        sameLenOthers.sort(() => Math.random() - 0.5);
        
        // Take up to 11 of those
        const limit = Math.min(11, sameLenOthers.length);
        for (let i = 0; i < limit; i++) {
          pool.push(sameLenOthers[i]);
        }
        
        // If we still need to fill the pool of 12 (e.g. because there are not enough same-length radicals)
        if (pool.length < 12) {
          const singleCharRadicals = radicals.filter(r => r.char.length === 1);
          while (pool.length < 12 && singleCharRadicals.length > 0) {
            let fakeChar = '';
            for (let k = 0; k < targetLen; k++) {
              const randR = singleCharRadicals[Math.floor(Math.random() * singleCharRadicals.length)];
              fakeChar += randR.char;
            }
            if (!pool.some(p => p.char === fakeChar)) {
              pool.push({ char: fakeChar });
            }
          }
        }
        
        // Shuffle the final pool of 12
        const finalShuffled = pool.sort(() => Math.random() - 0.5);
        symbolOptions = finalShuffled.map(r => r.char);
        STATE.quizSymbolOptions = {
          char: rad.char,
          options: symbolOptions
        };
      }
 
      let gridItemsHTML = symbolOptions.map(char => `
        <button class="grep-cell-btn" onclick="submitSymbolQuizAns('${char}')">${char}</button>
      `).join('');
      
      quizActionsHTML = `
        <div class="quiz-input-container">
          <div class="grep-results-grid">
            ${gridItemsHTML}
          </div>
        </div>
      `;
    } else {
      let statusClass = 'correct';
      let statusText = `✨ Correct! [ ${rad.char} ]`;
      if (STATE.quizCheated) {
        statusClass = 'cheated';
        statusText = `👁️ Revealed: [ ${rad.char} ]`;
      } else if (!STATE.quizAnswerCorrect) {
        statusClass = 'incorrect';
        statusText = `❌ Incorrect! Answered: "${STATE.quizUserAnswer}". Correct: [ ${rad.char} ]`;
      }
      
      quizActionsHTML = `
        <div class="quiz-input-container">
          <div class="quiz-status-msg ${statusClass}">${statusText}</div>
          <p style="font-size:0.75rem; text-align:center; font-weight:700; margin-bottom:4px; margin-top:8px;">RATE YOUR RETENTION LEVEL TO SAVE PROGRESS:</p>
          <div class="quiz-actions" style="width:100%;">
            <button class="btn-raw btn-red" id="srs-forgot">FORGOT</button>
            <button class="btn-raw btn-raw" style="border-color:#e5930e; background:#fffbf0;" id="srs-hard">HARD</button>
            <button class="btn-raw btn-green" id="srs-good">GOOD</button>
            <button class="btn-raw" style="background:#ccfffc;" id="srs-mastered">EASY</button>
          </div>
        </div>
      `;
    }
  }
  
  container.innerHTML = `
    <div class="quiz-progress">
      <span>SRS REVIEW SESSION (${mode.toUpperCase()} MODE)</span>
      <span>CARD ${currentNum} OF ${total}</span>
    </div>
    
    ${cardContentHTML}
    ${quizActionsHTML}
  `;
  
  // Attach unified listeners to quiz card
  const fbox = document.getElementById('flashcard-box');
  if (fbox) {
    fbox.addEventListener('click', window.toggleSrsCardFlip);
  }
  
  const rbtn = document.getElementById('reveal-btn');
  if (rbtn) {
    rbtn.addEventListener('click', window.toggleSrsCardFlip);
  }
  
  // Input submit listeners
  const submitBtn = document.getElementById('submit-ans-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', checkTypedQuizAns);
  }
  
  const qInput = document.getElementById('quiz-input');
  if (qInput) {
    qInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        checkTypedQuizAns();
      }
    });
    
    // Auto-complete suggestion listener for Pinyin mode
    if (mode === 'pinyin') {
      qInput.addEventListener('input', window.updatePinyinSuggestions);
      // Run initially to show suggestions if there's already some input
      window.updatePinyinSuggestions();
    }
    
    // autofocus the input field
    setTimeout(() => qInput.focus(), 50);
  }
  
  // Symbol search grep input listener
  const grepInput = document.getElementById('grep-input');
  if (grepInput) {
    grepInput.addEventListener('input', (e) => {
      STATE.quizGrepQuery = e.target.value;
      // Re-render
      renderSrsQuizView();
      // Keep focus on the search input
      const input = document.getElementById('grep-input');
      if (input) {
        input.focus();
        // Move cursor to end of text
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
    });
    // autofocus the grep input
    setTimeout(() => grepInput.focus(), 50);
  }
  
  // Quiz rating buttons actions (SuperMemo SM-2 algorithm simplified)
  if (STATE.quizFlipped || STATE.quizAnswerSubmitted) {
    const btnForgot = document.getElementById('srs-forgot');
    if (btnForgot) btnForgot.addEventListener('click', () => submitSrsScore(rad.no, 1));
    const btnHard = document.getElementById('srs-hard');
    if (btnHard) btnHard.addEventListener('click', () => submitSrsScore(rad.no, 3));
    const btnGood = document.getElementById('srs-good');
    if (btnGood) btnGood.addEventListener('click', () => submitSrsScore(rad.no, 4));
    const btnMastered = document.getElementById('srs-mastered');
    if (btnMastered) btnMastered.addEventListener('click', () => submitSrsScore(rad.no, 5));
  }
}

function checkTypedQuizAns() {
  const inputEl = document.getElementById('quiz-input');
  if (!inputEl) return;
  const userText = inputEl.value.trim();
  if (!userText) return;
  
  const rad = STATE.quizQueue[STATE.quizIndex];
  const mode = STATE.srsConfig.quizMode;
  
  STATE.quizUserAnswer = userText;
  STATE.quizAnswerSubmitted = true;
  
  if (mode === 'pinyin') {
    const normUser = normalizePinyin(userText);
    const normCorrect = normalizePinyin(rad.pinyin);
    if (normUser === normCorrect || userText.toLowerCase().trim() === rad.pinyin.toLowerCase().trim()) {
      STATE.quizAnswerCorrect = true;
      emitInkParticles(160, 160, 15, 'var(--accent-green)');
    } else {
      STATE.quizAnswerCorrect = false;
      emitInkParticles(160, 160, 15, 'var(--accent-red)');
    }
  } 
  else if (mode === 'translation') {
    if (checkTranslationMatch(userText, rad.meaning)) {
      STATE.quizAnswerCorrect = true;
      emitInkParticles(160, 160, 15, 'var(--accent-green)');
    } else {
      STATE.quizAnswerCorrect = false;
      emitInkParticles(160, 160, 15, 'var(--accent-red)');
    }
  }
  
  renderSrsQuizView();
}

window.submitSymbolQuizAns = function(symbolChar) {
  const rad = STATE.quizQueue[STATE.quizIndex];
  STATE.quizUserAnswer = symbolChar;
  STATE.quizAnswerSubmitted = true;
  
  if (symbolChar === rad.char) {
    STATE.quizAnswerCorrect = true;
    emitInkParticles(160, 160, 15, 'var(--accent-green)');
  } else {
    STATE.quizAnswerCorrect = false;
    emitInkParticles(160, 160, 15, 'var(--accent-red)');
  }
  
  renderSrsQuizView();
};

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
  } else if (score === 3) {
    // Hard item: set interval to 0 so it remains/goes back to "due reviews" immediately
    record.interval = 0;
    record.ease = Math.max(1.3, record.ease - 0.1);
    emitInkParticles(160, 160, 20, 'var(--accent-amber)');
  } else {
    // Answer was correct: expand review interval
    if (record.interval === 0 || record.interval === 1) {
      record.interval = 3;
    } else if (record.interval === 3) {
      record.interval = 7;
    } else {
      // Multiply current interval by ease factor
      record.interval = Math.min(365, Math.round(record.interval * record.ease));
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
  STATE.quizAnswerSubmitted = false;
  STATE.quizUserAnswer = '';
  STATE.quizAnswerCorrect = false;
  STATE.quizCheated = false;
  STATE.quizGrepQuery = '';
  
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
      <div class="trouble-char" style="width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 2px; box-sizing: border-box; flex-shrink: 0;">
        ${renderCharAsGrid(rad.char)}
      </div>
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
    viewDic.style.display = 'flex';
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
    viewSrs.style.display = 'flex';
    
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
  radicals = await getRadicals();
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
      STATE.gridLimit = 120;
      renderRadicalGrid();
    });
  }
  
  // Setup Category Filter
  const fCat = document.getElementById('filter-category');
  if (fCat) {
    const categories = Array.from(new Set(radicals.map(r => r.category))).sort();
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.innerText = cat.replace(/_/g, ' ');
      fCat.appendChild(option);
    });
    
    fCat.addEventListener('change', (e) => {
      STATE.filterCategory = e.target.value;
      STATE.gridLimit = 120;
      renderRadicalGrid();
    });
  }
  
  // Setup Stroke Count Filter
  const fStrs = document.getElementById('filter-strokes');
  if (fStrs) {
    fStrs.addEventListener('change', (e) => {
      STATE.filterStrokes = e.target.value;
      STATE.gridLimit = 120;
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
  
  // Setup Settings Modal Open/Close listeners
  const openSettingsBtn = document.getElementById('open-settings-btn');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const settingsModal = document.getElementById('settings-modal');

  if (openSettingsBtn && settingsModal) {
    openSettingsBtn.addEventListener('click', () => {
      // Clone srsConfig to tempSrsConfig so changes are isolated until apply
      STATE.tempSrsConfig = {
        enabledCategories: [...(STATE.srsConfig.enabledCategories || [])],
        enabledStrokes: [...(STATE.srsConfig.enabledStrokes || [])]
      };
      renderPoolToggles();
      settingsModal.style.display = 'flex';
    });
  }

  if (closeSettingsBtn && settingsModal) {
    closeSettingsBtn.addEventListener('click', () => {
      STATE.tempSrsConfig = null; // Discard changes
      settingsModal.style.display = 'none';
    });
  }

  if (saveSettingsBtn && settingsModal) {
    saveSettingsBtn.addEventListener('click', () => {
      if (STATE.tempSrsConfig) {
        STATE.srsConfig.enabledCategories = STATE.tempSrsConfig.enabledCategories;
        STATE.srsConfig.enabledStrokes = STATE.tempSrsConfig.enabledStrokes;
        saveSrsConfig();
      }
      STATE.tempSrsConfig = null;
      settingsModal.style.display = 'none';
      
      // Perform heavy operations once
      buildQuizQueue();
      renderRadicalGrid();
    });
  }

  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        STATE.tempSrsConfig = null; // Discard changes
        settingsModal.style.display = 'none';
      }
    });
  }

  // --- COLLAPSIBLE TROUBLESOME SECTION ---
  window.toggleTroubleSection = function() {
    const grid = document.getElementById('trouble-grid');
    const icon = document.getElementById('trouble-toggle-icon');
    const header = document.getElementById('trouble-header');
    if (!grid || !icon) return;
    
    if (grid.style.display === 'none') {
      grid.style.display = 'grid';
      icon.innerText = '▼';
      if (header) {
        header.style.borderBottom = '2px solid var(--border-color)';
        header.style.paddingBottom = '12px';
      }
    } else {
      grid.style.display = 'none';
      icon.innerText = '▶';
      if (header) {
        header.style.borderBottom = 'none';
        header.style.paddingBottom = '0px';
      }
    }
  };

  // --- SRS LIBRARY MODAL MANAGEMENT ---
  STATE.currentLibraryType = null; // Track current opened type ('mastered', 'learning', 'due', 'forgotten')

  window.openSrsLibrary = function(type) {
    STATE.currentLibraryType = type;
    const modal = document.getElementById('srs-library-modal');
    const title = document.getElementById('srs-library-modal-title');
    const desc = document.getElementById('srs-library-modal-desc');
    
    if (!modal) return;
    
    let friendlyType = '';
    let friendlyDesc = '';
    if (type === 'mastered') {
      friendlyType = 'MASTERED RADICALS';
      friendlyDesc = 'Items that you have successfully committed to long-term memory (SRS Interval >= 14 days).';
    } else if (type === 'learning') {
      friendlyType = 'LEARNING QUEUE';
      friendlyDesc = 'Items currently in progress that require regular reinforcement (SRS Interval < 14 days).';
    } else if (type === 'due') {
      friendlyType = 'DUE REVIEWS';
      friendlyDesc = 'Items that are currently pending review in your active study session.';
    } else if (type === 'forgotten') {
      friendlyType = 'FORGOTTEN / TROUBLESOME';
      friendlyDesc = 'Items that you have marked forgotten during review sessions. Clear them to reset their counters.';
    }
    
    title.innerText = friendlyType;
    desc.innerText = friendlyDesc;
    
    renderSrsLibraryList();
    modal.style.display = 'flex';
  };

  window.closeSrsLibrary = function() {
    const modal = document.getElementById('srs-library-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    STATE.currentLibraryType = null;
  };

  // Render the list of items inside the library manager
  function renderSrsLibraryList() {
    const container = document.getElementById('srs-library-list');
    if (!container) return;
    
    container.innerHTML = '';
    const type = STATE.currentLibraryType;
    const srsData = STATE.srs.learned;
    const now = new Date();
    
    // Filter the radicals depending on their current SRS state
    let filteredList = [];
    
    Object.keys(srsData).forEach(noKey => {
      const radNo = parseInt(noKey);
      const rad = radicals.find(r => r.no === radNo);
      if (!rad) return;
      
      const record = srsData[noKey];
      let matches = false;
      
      if (type === 'mastered' && record.interval >= 14) {
        matches = true;
      } else if (type === 'learning' && record.interval < 14) {
        matches = true;
      } else if (type === 'due' && new Date(record.nextReview) <= now) {
        matches = true;
      } else if (type === 'forgotten' && record.forgotCount > 0) {
        matches = true;
      }
      
      if (matches) {
        filteredList.push({ rad, record });
      }
    });
    
    if (filteredList.length === 0) {
      container.innerHTML = `
        <p style="padding: 24px; text-align: center; font-weight: 700; color: var(--text-muted); font-family: var(--font-mono); font-size: 0.9rem;">
          NO ITEMS FOUND IN THIS CATEGORY.
        </p>
      `;
      return;
    }
    
    // Sort alphabetically or numerically
    filteredList.sort((a, b) => a.rad.no - b.rad.no);
    
    filteredList.forEach(item => {
      const itemHtml = `
        <div class="srs-library-item" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--bg-card-alt); border: 1px solid var(--border-color); border-radius: var(--radius-md); gap: 16px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div class="srs-library-char" style="background: var(--bg-primary); width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); border: 1px solid var(--border-color); padding: 2px; box-sizing: border-box; flex-shrink: 0;">
              ${renderCharAsGrid(item.rad.char)}
            </div>
            <div style="display: flex; flex-direction: column;">
              <span style="font-weight: 700; color: var(--text-light); font-size: 1rem;">${item.rad.meaning.toUpperCase()}</span>
              <span style="font-size: 0.8rem; color: var(--text-muted); font-family: var(--font-mono);">${item.rad.pinyin.toUpperCase()}</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            ${item.record.interval ? `<span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">Int: ${item.record.interval}d</span>` : ''}
            ${item.record.forgotCount ? `<span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--accent-red); background: rgba(255,77,77,0.1); padding: 2px 6px; border-radius: 4px;">Forgot: ${item.record.forgotCount}x</span>` : ''}
            <button class="btn-raw" style="color: var(--accent-red); border: 1px solid var(--accent-red); padding: 6px 12px; font-size: 0.75rem; font-weight: 700; border-radius: var(--radius-sm); cursor: pointer; transition: all 0.2s;" onclick="removeSrsItem(${item.rad.no})">REMOVE</button>
          </div>
        </div>
      `;
      container.insertAdjacentHTML('beforeend', itemHtml);
    });
  }

  window.removeSrsItem = function(no) {
    if (STATE.srs.learned[no]) {
      delete STATE.srs.learned[no];
      saveSrsData();
      
      // Refresh both the list inside the modal and the main SRS panel counts/widgets
      renderSrsLibraryList();
      renderSrsView();
    }
  };
  
  // Close library modal by clicking outside
  const libraryModal = document.getElementById('srs-library-modal');
  if (libraryModal) {
    libraryModal.addEventListener('click', (e) => {
      if (e.target === libraryModal) {
        closeSrsLibrary();
      }
    });
  }
  
  // Launch WebGPU engine asynchronously (runs fallback particle loops if missing)
  await initWebGPU();
  
  // Start uniform particle computation loops
  requestAnimationFrame(updateAndRenderParticles);
});
