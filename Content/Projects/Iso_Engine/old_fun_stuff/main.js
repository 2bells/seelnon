/**
 * ==========================================================================
 *  BRUTALIST GAME ENGINE SIMULATOR (VANILLA JAVASCRIPT)
 *  Pure HTML5 Canvas, Web Audio API, and physical solver loop.
 * ==========================================================================
 */

// Global State
const state = {
  gravity: 1.5,
  damping: 0.98,
  maxParticles: 400,
  renderStyle: 'matrix', // 'matrix', 'gravity', 'pulse'
  audioEnabled: false,
  particles: [],
  gridWaves: [],
  lastTime: performance.now(),
  fps: 0,
  frameCount: 0,
  fpsTimer: 0,
  audioCtx: null
};

// Log counter
let logCount = 0;

/**
 * Terminal logger helper
 */
function logToTerminal(text, type = 'muted') {
  const terminal = document.getElementById('cmd-terminal');
  if (!terminal) return;
  
  const line = document.createElement('div');
  line.className = `terminal-line text-${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
  
  // Clean up old log outputs to save memory
  if (terminal.children.length > 20) {
    terminal.removeChild(terminal.firstElementChild);
  }
}

/**
 * Web Audio Synthesizer Node
 * Generates custom synthesized sounds without any files/assets!
 */
function playSynthSound(freq, type = 'sine', duration = 0.15, sweep = false) {
  if (!state.audioEnabled) return;
  
  try {
    // Lazily initialize AudioContext on user action
    if (!state.audioCtx) {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      logToTerminal('audio synthesis initialized.', 'accent');
    }
    
    // Resume context if suspended (browser security policy)
    if (state.audioCtx.state === 'suspended') {
      state.audioCtx.resume();
    }
    
    const osc = state.audioCtx.createOscillator();
    const gainNode = state.audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, state.audioCtx.currentTime);
    
    if (sweep) {
      // Frequency sweep for arcade retro effect (e.g. coin bounce)
      osc.frequency.exponentialRampToValueAtTime(freq * 2.5, state.audioCtx.currentTime + duration);
    }
    
    // Envelope: trigger gain rise and standard decay fall
    gainNode.gain.setValueAtTime(0.12, state.audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, state.audioCtx.currentTime + duration);
    
    osc.connect(gainNode);
    gainNode.connect(state.audioCtx.destination);
    
    osc.start();
    osc.stop(state.audioCtx.currentTime + duration);
  } catch (err) {
    console.error('Audio synthesis failed:', err);
  }
}

/**
 * Custom math vector class for pure standard physics
 */
class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 6;
    this.vy = (Math.random() - 0.5) * 6;
    this.radius = Math.random() * 4 + 1.5;
    this.color = Math.random() > 0.4 ? 'var(--accent-color)' : 'var(--accent-secondary)';
    this.energy = Math.random() * 0.5 + 0.5;
  }

  update(width, height) {
    // Apply state gravity & damping physics variables
    this.vy += state.gravity * 0.05;
    this.vx *= state.damping;
    this.vy *= state.damping;

    this.x += this.vx;
    this.y += this.vy;

    // Standard boundary bounce collisions
    if (this.x < this.radius) {
      this.x = this.radius;
      this.vx = -this.vx * 0.8;
      playSynthSound(180, 'sine', 0.08);
    } else if (this.x > width - this.radius) {
      this.x = width - this.radius;
      this.vx = -this.vx * 0.8;
      playSynthSound(180, 'sine', 0.08);
    }

    if (this.y < this.radius) {
      this.y = this.radius;
      this.vy = -this.vy * 0.8;
      playSynthSound(220, 'sine', 0.08);
    } else if (this.y > height - this.radius) {
      this.y = height - this.radius;
      this.vy = -this.vy * 0.85; // slightly higher bounce absorption
      if (Math.abs(this.vy) > 1.0) {
        // Play coin-bounce or sound FX index frequency based on size
        playSynthSound(260 + (this.vx * 20), 'triangle', 0.12, true);
      }
    }
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }
}

/**
 * Initialize / Reset elements buffer
 */
function resetBuffer(canvas) {
  state.particles = [];
  
  // Re-seed particle nodes
  for (let i = 0; i < Math.min(state.maxParticles / 2, 200); i++) {
    state.particles.push(new Particle(
      canvas.width * 0.1 + Math.random() * canvas.width * 0.8,
      canvas.height * 0.1 + Math.random() * canvas.height * 0.5
    ));
  }

  // Setup Grid wave indexes (Mode 3)
  state.gridWaves = [];
  const spacing = 40;
  for (let x = 30; x < canvas.width; x += spacing) {
    for (let y = 30; y < canvas.height; y += spacing) {
      state.gridWaves.push({
        origX: x,
        origY: y,
        x: x,
        y: y,
        phase: Math.random() * Math.PI * 2,
        activePulse: 0
      });
    }
  }

  logToTerminal(`Buffer seed: ${state.particles.length} particles init.`, 'accent');
}

/**
 * Setup canvas dynamic Resize observer pattern
 */
function setupCanvas(canvas) {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  const resizeObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
      // Get exact device pixels matching container geometry
      const dpr = window.devicePixelRatio || 1;
      const width = entry.contentRect.width;
      const height = entry.contentRect.height;
      
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // Draw standard coordinate layout matrices scaling
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      resetBuffer(canvas);
      logToTerminal(`viewport resize: ${Math.round(width)}x${Math.round(height)}`, 'warn');
    }
  });

  resizeObserver.observe(container);
}

/**
 * Update UI state element sliders
 */
function syncUI() {
  document.getElementById('val-gravity').textContent = state.gravity.toFixed(1);
  document.getElementById('val-damping').textContent = state.damping.toFixed(2);
  document.getElementById('val-quantity').textContent = state.maxParticles;

  const status = document.getElementById('status-display');
  if (status) {
    status.textContent = 'SOLVER_RUNNING';
  }
}

/**
 * Configure DOM Event listeners for panels
 */
function setupInputListeners(canvas) {
  const gravSlider = document.getElementById('slider-gravity');
  gravSlider.addEventListener('input', (e) => {
    state.gravity = parseFloat(e.target.value);
    syncUI();
  });

  const dampSlider = document.getElementById('slider-damping');
  dampSlider.addEventListener('input', (e) => {
    state.damping = parseFloat(e.target.value);
    syncUI();
  });

  const quantSlider = document.getElementById('slider-quantity');
  quantSlider.addEventListener('input', (e) => {
    state.maxParticles = parseInt(e.target.value);
    if (state.particles.length > state.maxParticles) {
      state.particles.length = state.maxParticles;
    }
    syncUI();
  });

  const styleSelect = document.getElementById('select-effect');
  styleSelect.addEventListener('change', (e) => {
    state.renderStyle = e.target.value;
    logToTerminal(`style mode changed: ${state.renderStyle.toUpperCase()}`, 'warn');
  });

  const resetBtn = document.getElementById('btn-reset-scene');
  resetBtn.addEventListener('click', () => {
    resetBuffer(canvas);
    playSynthSound(440, 'triangle', 0.2, true);
  });

  const audioBtn = document.getElementById('btn-audio-toggle');
  audioBtn.addEventListener('click', () => {
    state.audioEnabled = !state.audioEnabled;
    if (state.audioEnabled) {
      audioBtn.classList.add('btn-active');
      audioBtn.textContent = 'AUDIO SYNTH: ON';
      logToTerminal('synthesizer module armed.', 'accent');
      // Initialize Context right away if not already done
      if (!state.audioCtx) {
        state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      playSynthSound(520, 'sine', 0.15, true);
    } else {
      audioBtn.classList.remove('btn-active');
      audioBtn.textContent = 'AUDIO SYNTH: OFF';
      logToTerminal('synthesizer module muted.', 'muted');
    }
  });

  // Track cursor position inside the canvas block
  let mouse = { x: -1000, y: -1000, active: false };

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = true;
  });

  canvas.addEventListener('mouseleave', () => {
    mouse.x = -1000;
    mouse.y = -1000;
    mouse.active = false;
  });

  // Canvas interaction listener (spawns particles & triggers Web Audio sounds)
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    playSynthSound(800, 'square', 0.18, true);

    // Spawn interactive particles
    const spawnNum = 15;
    for (let i = 0; i < spawnNum; i++) {
      if (state.particles.length < state.maxParticles) {
        const p = new Particle(clickX, clickY);
        // Blast velocity outwards radially on click
        const angle = (i / spawnNum) * Math.PI * 2 + Math.random() * 0.5;
        const speed = Math.random() * 8 + 3;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        state.particles.push(p);
      }
    }

    if (state.renderStyle === 'pulse') {
      // Trigger spatial ripple coordinates in grid wave
      state.gridWaves.forEach(w => {
        const dx = w.origX - clickX;
        const dy = w.origY - clickY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180) {
          w.activePulse = 1.0 - (dist / 180);
        }
      });
    }

    const eventsPrompt = document.getElementById('hud-events');
    if (eventsPrompt) {
      eventsPrompt.textContent = `EMITTED ENERGY AT [${Math.round(clickX)}, ${Math.round(clickY)}]`;
      setTimeout(() => {
        if (eventsPrompt.textContent.startsWith('EMITTED')) {
          eventsPrompt.textContent = 'CLICK CANVAS TO EMIT ENERGY';
        }
      }, 2000);
    }
  });

  canvas.mouse = mouse;
}

/**
 * Main game loop physical solver and graphic framework render
 */
function gameLoop(timestamp, canvas, ctx) {
  // Frame rate counter
  state.frameCount++;
  const delta = timestamp - state.lastTime;
  state.fpsTimer += delta;
  state.lastTime = timestamp;

  if (state.fpsTimer >= 1000) {
    state.fps = state.frameCount;
    state.frameCount = 0;
    state.fpsTimer = 0;
    
    // Smooth zero padding display element
    const fpsCounter = document.getElementById('fps-counter');
    if (fpsCounter) {
      fpsCounter.textContent = state.fps.toString().padStart(2, '0');
    }
  }

  // Clear workspace background canvas each frame
  const width = canvas.width / (window.devicePixelRatio || 1);
  const height = canvas.height / (window.devicePixelRatio || 1);
  ctx.fillStyle = '#06070a';
  ctx.fillRect(0, 0, width, height);

  // Render selection pathways
  if (state.renderStyle === 'matrix') {
    // Mode 1: Neon Matrix Connections (Charged particles drawing linkages)
    const connectDist = 90;
    const len = state.particles.length;

    // Physics solver
    state.particles.forEach(p => p.update(width, height));

    // Connect nodes within range
    ctx.lineWidth = 0.8;
    for (let i = 0; i < len; i++) {
      const pi = state.particles[i];
      for (let j = i + 1; j < len; j++) {
        const pj = state.particles[j];
        const dx = pi.x - pj.x;
        const dy = pi.y - pj.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < connectDist * connectDist) {
          const dist = Math.sqrt(distSq);
          const alpha = (1 - dist / connectDist) * 0.45;
          ctx.strokeStyle = `rgba(0, 255, 102, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(pi.x, pi.y);
          ctx.lineTo(pj.x, pj.y);
          ctx.stroke();
        }
      }
    }

    // Connect cursor attraction
    const mouse = canvas.mouse;
    if (mouse && mouse.active) {
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 60, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 221, 255, 0.15)';
      ctx.stroke();

      state.particles.forEach(p => {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          // Attract towards cursor
          const force = (120 - dist) * 0.008;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }
      });
    }

    // Draw particle orbs
    state.particles.forEach(p => p.draw(ctx));

  } else if (state.renderStyle === 'gravity') {
    // Mode 2: Gravitating Orbs solver
    state.particles.forEach(p => {
      // Attract/Gravity simulation center coordinate point
      const centerX = width / 2;
      const centerY = height / 2;
      const dx = centerX - p.x;
      const dy = centerY - p.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      
      // Pull particles inwards
      const gravityFactor = state.gravity * 0.04;
      p.vx += (dx / dist) * gravityFactor;
      p.vy += (dy / dist) * gravityFactor;

      // Cursor gravity interaction repulse
      const mouse = canvas.mouse;
      if (mouse && mouse.active) {
        const mdx = mouse.x - p.x;
        const mdy = mouse.y - p.y;
        const mdist = Math.max(Math.sqrt(mdx * mdx + mdy * mdy), 1);
        if (mdist < 150) {
          // Repulsive force push outward
          const repulse = (150 - mdist) * 0.12;
          p.vx -= (mdx / mdist) * repulse * 0.3;
          p.vy -= (mdy / mdist) * repulse * 0.3;
        }
      }

      p.update(width, height);
      p.draw(ctx);
    });

    // Draw gravity core source indicator
    ctx.beginPath();
    ctx.arc(width/2, height/2, 8, 0, Math.PI * 2);
    ctx.strokeStyle = 'var(--accent-secondary)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(width/2, height/2, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'var(--accent-secondary)';
    ctx.fill();

  } else if (state.renderStyle === 'pulse') {
    // Mode 3: Cyberpunk Grid Wave simulation
    const timeFactor = timestamp * 0.002;
    const mouse = canvas.mouse;

    state.gridWaves.forEach(w => {
      // Calculate wave distance offsets using sine wave timing
      const waveOffset = Math.sin(timeFactor + w.phase) * 6;
      
      let hoverOffset = 0;
      let angle = 0;

      if (mouse && mouse.active) {
        const dx = mouse.x - w.origX;
        const dy = mouse.y - w.origY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          hoverOffset = (100 - dist) * 0.35;
          angle = Math.atan2(dy, dx);
        }
      }

      // Dynamic calculation adjustments
      w.x = w.origX + Math.cos(angle + Math.PI) * hoverOffset;
      w.y = w.origY + Math.sin(angle + Math.PI) * hoverOffset + waveOffset;

      // Handle spatial click impulses
      if (w.activePulse > 0.01) {
        w.y += Math.sin(timestamp * 0.01) * 35 * w.activePulse;
        w.activePulse *= 0.95; // decay
      }

      // Render dot grid
      ctx.beginPath();
      ctx.arc(w.x, w.y, hoverOffset > 0 ? 3.5 : 2, 0, Math.PI * 2);
      
      if (hoverOffset > 0) {
        ctx.fillStyle = 'var(--accent-secondary)';
      } else if (w.activePulse > 0.02) {
        ctx.fillStyle = 'var(--accent-danger)';
      } else {
        ctx.fillStyle = 'var(--border-color)';
      }
      ctx.fill();
    });
  }

  // Trigger continuous run frame cycles
  requestAnimationFrame((time) => gameLoop(time, canvas, ctx));
}

/**
 * Main module initialization orchestration point
 */
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  
  // Bind resize observers and layout configs
  setupCanvas(canvas);
  
  // Set default state values to DOM indicators
  syncUI();

  // Register controllers and parameters
  setupInputListeners(canvas);

  // Kickstart prime physics render pipeline!
  requestAnimationFrame((time) => gameLoop(time, canvas, ctx));

  logToTerminal('engine pipeline active.', 'accent');
});
