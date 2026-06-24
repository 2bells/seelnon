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
  isDrawing: false,
  drawnPoints: [], // coords of current stroke
  practiceStrokeIndex: 0, // which stroke is the user practicing
  practiceSuccessCount: 0,
  isPracticing: false,
  
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
  
  // Handle interaction
  STATE.canvas.addEventListener('mousedown', startDrawing);
  STATE.canvas.addEventListener('mousemove', draw);
  STATE.canvas.addEventListener('mouseup', stopDrawing);
  STATE.canvas.addEventListener('mouseleave', stopDrawing);
  
  // Touch support for mobile/tablets
  STATE.canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = STATE.canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    startDrawing({ clientX: touch.clientX, clientY: touch.clientY });
  }, { passive: false });
  
  STATE.canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    draw({ clientX: touch.clientX, clientY: touch.clientY });
  }, { passive: false });
  
  STATE.canvas.addEventListener('touchend', stopDrawing);

  drawCalligraphyGrid();
}

// Traditional Mizige (米字格) Tracing Grid
function drawCalligraphyGrid() {
  if (!STATE.canvas || !STATE.ctx) return;
  const ctx = STATE.ctx;
  const w = STATE.canvas.width;
  const h = STATE.canvas.height;
  
  // Clear canvas
  ctx.fillStyle = "#faf9f6";
  ctx.fillRect(0, 0, w, h);
  
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

function drawBackgroundRadicalGlyph() {
  if (!STATE.canvas || !STATE.ctx) return;
  const rad = radicals.find(r => r.no === STATE.selectedRadicalNo);
  if (!rad) return;
  
  const ctx = STATE.ctx;
  ctx.save();
  ctx.font = `200px var(--font-serif)`;
  ctx.fillStyle = "rgba(0, 0, 0, 0.08)"; // Faint gray trace guide
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(rad.char, 160, 160);
  ctx.restore();
}

function startDrawing(e) {
  const canvasBox = document.getElementById('practice-canvas-box');
  if (canvasBox) {
    canvasBox.classList.remove('error-state', 'success-state', 'mastered-state');
  }
  STATE.isDrawing = true;
  STATE.drawnPoints = [];
  const coords = getCanvasCoords(e);
  STATE.drawnPoints.push(coords);
  
  // Standard calligraphy ink effect start
  STATE.ctx.save();
  STATE.ctx.beginPath();
  STATE.ctx.moveTo(coords.x, coords.y);
}

function draw(e) {
  if (!STATE.isDrawing) return;
  const coords = getCanvasCoords(e);
  const lastPoint = STATE.drawnPoints[STATE.drawnPoints.length - 1];
  
  // Brush speed calculation for dynamic ink-bleed width
  const dist = Math.hypot(coords.x - lastPoint.x, coords.y - lastPoint.y);
  STATE.drawnPoints.push(coords);
  
  // Calligraphy brush simulation (thinner line when moving fast, thicker when slow/anchoring)
  const brushWidth = Math.max(3, Math.min(18, 12 - (dist * 0.6)));
  
  STATE.ctx.strokeStyle = '#1a1a1a'; // Pitch black charcoal ink
  STATE.ctx.lineWidth = brushWidth;
  STATE.ctx.lineCap = 'round';
  STATE.ctx.lineJoin = 'round';
  
  STATE.ctx.beginPath();
  STATE.ctx.moveTo(lastPoint.x, lastPoint.y);
  STATE.ctx.lineTo(coords.x, coords.y);
  STATE.ctx.stroke();
  
  // Emit gorgeous particles from the brush tip
  emitInkParticles(coords.x, coords.y, 3);
}

function stopDrawing() {
  if (!STATE.isDrawing) return;
  STATE.isDrawing = false;
  
  // Analyze current stroke accuracy if in practice/study mode
  if (STATE.drawnPoints.length > 3) {
    evaluateStrokePractice();
  }
}

function getCanvasCoords(e) {
  const rect = STATE.canvas.getBoundingClientRect();
  const clientX = e.clientX || (e.touches && e.touches[0].clientX);
  const clientY = e.clientY || (e.touches && e.touches[0].clientY);
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

// Evaluate user's drawn stroke against expected radical coordinate paths
function evaluateStrokePractice() {
  const rad = radicals.find(r => r.no === STATE.selectedRadicalNo);
  if (!rad || !rad.strokePaths || rad.strokePaths.length === 0) return;
  
  const currentExpectedPath = rad.strokePaths[STATE.practiceStrokeIndex];
  if (!currentExpectedPath) return;
  
  const drawnStart = STATE.drawnPoints[0];
  const drawnEnd = STATE.drawnPoints[STATE.drawnPoints.length - 1];
  
  // Maps target points (from 0-100 percentage layout to actual 320px coordinates)
  const expectedStart = {
    x: (currentExpectedPath[0][0] / 100) * 320,
    y: (currentExpectedPath[0][1] / 100) * 320
  };
  const expectedEnd = {
    x: (currentExpectedPath[currentExpectedPath.length - 1][0] / 100) * 320,
    y: (currentExpectedPath[currentExpectedPath.length - 1][1] / 100) * 320
  };
  
  // Calculate spatial accuracy: compare start to start and end to end
  const dStart = Math.hypot(drawnStart.x - expectedStart.x, drawnStart.y - expectedStart.y);
  const dEnd = Math.hypot(drawnEnd.x - expectedEnd.x, drawnEnd.y - expectedEnd.y);
  
  // Reverse direction fallback check
  const dReverseStart = Math.hypot(drawnStart.x - expectedEnd.x, drawnStart.y - expectedEnd.y);
  const dReverseEnd = Math.hypot(drawnEnd.x - expectedStart.x, drawnEnd.y - expectedStart.y);
  
  const maxDistance = 90; // Tolerant pixel radius
  let strokeValid = false;
  let directionCorrect = true;
  
  if (dStart < maxDistance && dEnd < maxDistance) {
    strokeValid = true;
  } else if (dReverseStart < maxDistance && dReverseEnd < maxDistance) {
    // Correct stroke placement but wrong direction
    strokeValid = true;
    directionCorrect = false;
  }
  
  const canvasBox = document.getElementById('practice-canvas-box');
  
  if (strokeValid) {
    if (directionCorrect) {
      STATE.practiceStrokeIndex++;
      STATE.practiceSuccessCount++;
      
      if (canvasBox) {
        canvasBox.classList.remove('error-state');
        canvasBox.classList.add('success-state');
      }
      
      if (STATE.practiceStrokeIndex >= rad.strokePaths.length) {
        if (canvasBox) {
          canvasBox.classList.remove('success-state');
          canvasBox.classList.add('mastered-state');
        }
        triggerMasteryCelebration();
        // Record as reviewed / remembered
        markRadicalPracticed(rad.no);
      }
    } else {
      // Stroke is physically right, but drawn backwards (vital in Chinese calligraphy!)
      if (canvasBox) {
        canvasBox.classList.remove('success-state', 'mastered-state');
        // Force reflow to restart shake animation on subsequent errors
        canvasBox.classList.remove('error-state');
        void canvasBox.offsetWidth;
        canvasBox.classList.add('error-state');
      }
    }
  } else {
    if (canvasBox) {
      canvasBox.classList.remove('success-state', 'mastered-state');
      // Force reflow to restart shake animation on subsequent errors
      canvasBox.classList.remove('error-state');
      void canvasBox.offsetWidth;
      canvasBox.classList.add('error-state');
    }
  }
  
  // Redraw canvas to preserve guidelines & drawn strokes
  redrawCurrentStrokeSession();
}

function redrawCurrentStrokeSession() {
  if (!STATE.canvas || !STATE.ctx) return;
  const rad = radicals.find(r => r.no === STATE.selectedRadicalNo);
  drawCalligraphyGrid();
  drawBackgroundRadicalGlyph();
  
  // Highlight the current active stroke to guide the user visually
  if (rad && rad.strokePaths && rad.strokePaths[STATE.practiceStrokeIndex]) {
    const stroke = rad.strokePaths[STATE.practiceStrokeIndex];
    const ctx = STATE.ctx;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 77, 77, 0.55)"; // Red highlight guide
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo((stroke[0][0] / 100) * 320, (stroke[0][1] / 100) * 320);
    for (let i = 1; i < stroke.length; i++) {
      ctx.lineTo((stroke[i][0] / 100) * 320, (stroke[i][1] / 100) * 320);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// Reset the interactive practice mode
function resetPracticeSession() {
  STATE.practiceStrokeIndex = 0;
  STATE.practiceSuccessCount = 0;
  drawCalligraphyGrid();
  drawBackgroundRadicalGlyph();
  redrawCurrentStrokeSession();
  
  const canvasBox = document.getElementById('practice-canvas-box');
  if (canvasBox) {
    canvasBox.classList.remove('error-state', 'success-state', 'mastered-state');
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
async function playStrokeAnimation() {
  const rad = radicals.find(r => r.no === STATE.selectedRadicalNo);
  if (!rad || !rad.strokePaths || rad.strokePaths.length === 0) return;
  
  resetPracticeSession();
  
  const ctx = STATE.ctx;
  
  // Step through each stroke sequentially with a beautiful delay loop
  for (let sIndex = 0; sIndex < rad.strokePaths.length; sIndex++) {
    const strokePoints = rad.strokePaths[sIndex];
    if (strokePoints.length < 2) continue;
    
    // Animate drawing this single stroke
    await new Promise((resolve) => {
      let step = 0;
      const totalSteps = 15;
      
      function animateFrame() {
        if (step > totalSteps) {
          resolve();
          return;
        }
        
        const percent = step / totalSteps;
        
        // Redraw base and all previous completed strokes
        drawCalligraphyGrid();
        drawBackgroundRadicalGlyph();
        
        // Redraw completed strokes in full ink
        ctx.save();
        ctx.strokeStyle = "#1a1a1a";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        
        for (let prev = 0; prev < sIndex; prev++) {
          const prevStroke = rad.strokePaths[prev];
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.moveTo((prevStroke[0][0] / 100) * 320, (prevStroke[0][1] / 100) * 320);
          for (let j = 1; j < prevStroke.length; j++) {
            ctx.lineTo((prevStroke[j][0] / 100) * 320, (prevStroke[j][1] / 100) * 320);
          }
          ctx.stroke();
        }
        
        // Draw current animating stroke up to current percentage interpolation
        ctx.lineWidth = 10;
        ctx.beginPath();
        const startX = (strokePoints[0][0] / 100) * 320;
        const startY = (strokePoints[0][1] / 100) * 320;
        ctx.moveTo(startX, startY);
        
        // Interpolate along coordinates points list
        const pointsCount = strokePoints.length;
        const currentTargetIndex = Math.min(
          pointsCount - 1,
          Math.floor(percent * (pointsCount - 1))
        );
        
        for (let k = 1; k <= currentTargetIndex; k++) {
          ctx.lineTo((strokePoints[k][0] / 100) * 320, (strokePoints[k][1] / 100) * 320);
        }
        
        // Add final smooth vector projection for fluid look
        if (currentTargetIndex < pointsCount - 1) {
          const nextPt = strokePoints[currentTargetIndex + 1];
          const currPt = strokePoints[currentTargetIndex];
          const segmentPercent = (percent * (pointsCount - 1)) % 1;
          const interpX = currPt[0] + (nextPt[0] - currPt[0]) * segmentPercent;
          const interpY = currPt[1] + (nextPt[1] - currPt[1]) * segmentPercent;
          
          ctx.lineTo((interpX / 100) * 320, (interpY / 100) * 320);
          emitInkParticles((interpX / 100) * 320, (interpY / 100) * 320, 4);
        }
        
        ctx.stroke();
        ctx.restore();
        
        step++;
        requestAnimationFrame(animateFrame);
      }
      
      animateFrame();
    });
    
    // Tiny pause between sequential strokes
    await new Promise(r => setTimeout(r, 200));
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
    countDisplay.innerText = `${filtered.length} / 214`;
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
      <span class="cell-strokes">${rad.strokes} ${rad.strokes === 1 ? 'Str' : 'Strs'}</span>
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
  document.getElementById('meta-strokes').innerText = rad.strokes;
  
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
  
  renderRadicalDetail();
}

// Render total core metrics in Header Stats bar
function renderStats() {
  const learnedKeys = Object.keys(STATE.srs.learned);
  const masteredCount = learnedKeys.filter(k => STATE.srs.learned[k].interval >= 14).length;
  const activeCount = learnedKeys.filter(k => STATE.srs.learned[k].interval < 14).length;
  
  document.getElementById('stat-mastered').innerText = masteredCount;
  document.getElementById('stat-learning').innerText = activeCount;
  document.getElementById('stat-unlocked').innerText = `${learnedKeys.length}/214`;
  document.getElementById('stat-streak').innerText = `${STATE.srs.streak} Days`;
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
  
  // Launch WebGPU engine asynchronously (runs fallback particle loops if missing)
  await initWebGPU();
  
  // Start uniform particle computation loops
  requestAnimationFrame(updateAndRenderParticles);
});
