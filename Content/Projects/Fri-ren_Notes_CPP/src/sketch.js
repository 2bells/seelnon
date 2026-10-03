/**
 * Fri-ren Notes - Vector Sketch Module (sketch.js)
 * Native, zero-dependency, high-performance vector sketching engine
 * Supports [sketch W H], smooth ink strokes, circular color wheel, themes & preview SVG
 * Implements Dormant/Baked mode to eliminate idle overhead and CPU leaks
 */

export class SketchManager {
  constructor(app) {
    this.app = app;
    this.widgets = new Map(); // sketchId -> SketchWidget instance
    this.activeWidget = null;
    this.container = document.getElementById('editor-sketch-widgets');
    this.scrollPane = null;
    this.initContainer();
  }

  initContainer() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'editor-sketch-widgets';
      const wrapper = document.getElementById('editor-wrapper');
      if (wrapper) wrapper.appendChild(this.container);
    }
    let pane = this.container.querySelector('.sketch-scroll-pane');
    if (!pane) {
      pane = document.createElement('div');
      pane.className = 'sketch-scroll-pane';
      pane.style.transform = 'translate3d(0, 0, 0)';
      pane.style.willChange = 'transform';
      this.container.appendChild(pane);
    }
    this.scrollPane = pane;
  }

  getThemeBgColor() {
    return document.body.classList.contains('night-mode') ? '#241f1a' : '#E4E3E0';
  }

  getSketchData(sketchId) {
    if (!this.app.currentNote) return null;
    if (!this.app.currentNote.sketches) {
      this.app.currentNote.sketches = {};
    }
    return this.app.currentNote.sketches[sketchId] || null;
  }

  saveSketchData(sketchId, data) {
    if (!this.app.currentNote) return;
    if (!this.app.currentNote.sketches) {
      this.app.currentNote.sketches = {};
    }
    this.app.currentNote.sketches[sketchId] = data;

    // Cache SVG string in vault
    const isNight = document.body.classList.contains('night-mode');
    const svgStr = this.renderSVGString(data.width || 300, data.height || 300, data.strokes || [], isNight);
    const svgDataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgStr);
    if (this.app.vault) {
      this.app.vault.saveImage(sketchId, svgDataUrl).catch(() => {});
      this.app.vault.saveNote(this.app.currentNote).catch(() => {});
    }
  }

  parseSketchTag(tagLine) {
    if (!tagLine || typeof tagLine !== 'string') return null;
    // Matches: [sketch], [sketch 300 300], [sketch:sk-123 400 300], [sketch sk-123 300 300]
    const m = tagLine.match(/\[sketch(?::([a-zA-Z0-9_-]+))?(?:\s+([a-zA-Z0-9_-]+))?(?:\s+(\d+))?(?:\s+(\d+))?(?:\s+([a-zA-Z0-9_-]+))?\]/i);
    if (!m) return null;

    let id = m[1] || null;
    let width = 300;
    let height = 300;

    const tokens = [m[2], m[3], m[4], m[5]].filter(Boolean);
    const numTokens = [];
    const strTokens = [];

    for (const t of tokens) {
      if (/^\d+$/.test(t)) {
        numTokens.push(parseInt(t, 10));
      } else {
        strTokens.push(t);
      }
    }

    if (!id && strTokens.length > 0) {
      id = strTokens[0];
    }
    if (numTokens.length >= 2) {
      width = numTokens[0];
      height = numTokens[1];
    } else if (numTokens.length === 1) {
      width = numTokens[0];
      height = numTokens[0];
    }

    width = Math.max(100, Math.min(1600, width));
    height = Math.max(80, Math.min(2000, height));

    return { id, width, height };
  }

  syncWidgets(lines, lineTops) {
    if (!this.container || !this.scrollPane || !this.app.currentNote) {
      this.clearWidgets();
      return;
    }

    const activeSketchIds = new Set();
    const totalLines = lines.length;

    for (let i = 0; i < totalLines; i++) {
      const line = lines[i];
      if (!line) continue;
      const trimmed = line.trim();

      if (/^\[sketch/i.test(trimmed)) {
        const parsed = this.parseSketchTag(trimmed);
        if (parsed) {
          const startLine = i;
          let sketchId = parsed.id;
          if (!sketchId) {
            sketchId = 'sk-' + Math.random().toString(36).substring(2, 8);
          }

          activeSketchIds.add(sketchId);

          // Position widget directly below the opening tag line (+24px)
          const topPos = 32 + (lineTops ? (lineTops[startLine] || 0) : startLine * 24) + 24;

          let widget = this.widgets.get(sketchId);
          if (!widget) {
            const initialData = this.getSketchData(sketchId) || {
              id: sketchId,
              width: parsed.width,
              height: parsed.height,
              strokes: []
            };
            widget = new SketchWidget(this, sketchId, parsed.width, parsed.height, initialData);
            this.widgets.set(sketchId, widget);
            this.scrollPane.appendChild(widget.el);
          } else {
            widget.updateDimensions(parsed.width, parsed.height);
            widget.redrawSVG();
          }

          widget.setPosition(topPos, 20);
        }
      }
    }

    // Cleanly destroy and remove widgets that are no longer in the document
    for (const [id, widget] of this.widgets.entries()) {
      if (!activeSketchIds.has(id)) {
        if (this.activeWidget === widget) this.activeWidget = null;
        widget.destroy();
        this.widgets.delete(id);
      }
    }

    // Cleanly delete from currentNote.sketches so deleted sketches are completely gone from memory and storage
    if (this.app.currentNote && this.app.currentNote.sketches) {
      let modified = false;
      for (const savedId of Object.keys(this.app.currentNote.sketches)) {
        if (!activeSketchIds.has(savedId)) {
          delete this.app.currentNote.sketches[savedId];
          modified = true;
          if (this.app.vault) {
            this.app.vault.deleteImage(savedId).catch(() => {});
          }
        }
      }
      if (modified && this.app.vault) {
        this.app.vault.saveNote(this.app.currentNote).catch(() => {});
      }
    }
  }

  deactivateAllExcept(activeWidget) {
    this.activeWidget = activeWidget;
    for (const widget of this.widgets.values()) {
      if (widget !== activeWidget && !widget.isBaked) {
        widget.bake();
      }
    }
  }

  bakeAll() {
    this.activeWidget = null;
    for (const widget of this.widgets.values()) {
      if (!widget.isBaked) {
        widget.bake();
      }
    }
  }

  clearWidgets() {
    this.activeWidget = null;
    for (const widget of this.widgets.values()) {
      widget.destroy();
    }
    this.widgets.clear();
    if (this.scrollPane) {
      this.scrollPane.innerHTML = '';
    }
  }

  updateTheme(isNightMode) {
    for (const widget of this.widgets.values()) {
      widget.updateTheme(isNightMode);
    }
  }

  syncScroll(scrollTop, scrollLeft) {
    if (this.scrollPane) {
      this.scrollPane.style.transform = `translate3d(${-scrollLeft}px, ${-scrollTop}px, 0)`;
    }
  }

  renderSVGString(width, height, strokes, isNightMode) {
    const isNight = isNightMode !== undefined ? isNightMode : document.body.classList.contains('night-mode');
    const bgColor = isNight ? '#241f1a' : '#E4E3E0';
    let pathsHtml = '';

    for (const s of strokes) {
      let color = s.color;
      if (!color || color === 'theme-ink') {
        color = isNight ? '#e5c07b' : '#141414';
      }
      const opacity = s.opacity !== undefined ? s.opacity : 1;
      const strokeWidth = s.width || 2.5;
      const d = s.d || this.pointsToPath(s.points);
      if (d) {
        pathsHtml += `<path d="${d}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="${opacity}" />`;
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background-color: ${bgColor}; width: 100%; height: auto; display: block; border-radius: 2px;">
      ${pathsHtml}
    </svg>`;
  }

  pointsToPath(points) {
    if (!points || points.length === 0) return '';
    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y}`;
    }
    if (points.length === 2) {
      return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    }

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      d += ` Q ${p1.x} ${p1.y}, ${mx} ${my}`;
    }
    const last = points[points.length - 1];
    d += ` L ${last.x} ${last.y}`;
    return d;
  }
}

export class SketchWidget {
  constructor(manager, sketchId, width, height, initialData) {
    this.manager = manager;
    this.sketchId = sketchId;
    this.width = width;
    this.height = height;
    this.strokes = initialData && initialData.strokes ? [...initialData.strokes] : [];
    this.redoStack = [];

    // State: starts baked (dormant) by default to prevent leaks and idle CPU overhead
    this.isBaked = true;
    this.isDrawing = false;
    this.currentPoints = [];
    this.activeTool = 'pen'; // 'pen', 'highlighter', 'eraser'
    const isNight = document.body.classList.contains('night-mode');
    this.activeColor = isNight ? '#e5c07b' : '#141414';
    this.activeWidth = 3;
    this.colorWheelOpen = false;

    this.initDOM();
    this.initCanvas();
    this.bindEvents();
    this.redrawSVG();
    this.bake(); // Enter dormant baked mode initially
  }

  initDOM() {
    this.el = document.createElement('div');
    this.el.className = 'sketch-widget-block baked';
    this.el.style.width = `${this.width + 4}px`;

    const isNight = document.body.classList.contains('night-mode');
    const initialDefaultInk = isNight ? '#e5c07b' : '#141414';

    this.el.innerHTML = `
      <div class="sketch-widget-header">
        <div class="sketch-widget-title">
          <span class="sketch-dot"></span>
          <button type="button" class="sketch-status-badge" title="Click to draw or edit">✎ DORMANT</button>
        </div>
        <div class="sketch-header-actions">
          <button type="button" class="sketch-btn sketch-undo-btn hidden" title="Undo (Ctrl+Z)">↶</button>
          <button type="button" class="sketch-btn sketch-redo-btn hidden" title="Redo (Ctrl+Y)">↷</button>
          <button type="button" class="sketch-btn sketch-clear-btn hidden" title="Clear Sketch">🗑</button>
          <button type="button" class="sketch-btn sketch-bake-btn hidden" title="Bake & Finish">✔ BAKE</button>
          <button type="button" class="sketch-btn sketch-copy-btn" title="Copy SVG">⤓</button>
        </div>
      </div>

      <div class="sketch-canvas-container" style="width: ${this.width}px; height: ${this.height}px;">
        <svg class="sketch-svg-layer" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}" style="width: 100%; height: 100%; display: block;"></svg>
        <canvas class="sketch-active-canvas hidden" width="${this.width}" height="${this.height}" style="width: 100%; height: 100%; display: block;"></canvas>
        <div class="sketch-baked-overlay" title="Click to edit sketch"></div>
      </div>

      <div class="sketch-widget-toolbar hidden">
        <div class="sketch-tools-group">
          <button type="button" class="sketch-tool-btn active" data-tool="pen" title="Ink Pen">✒ Ink</button>
          <button type="button" class="sketch-tool-btn" data-tool="highlighter" title="Highlighter">🖌 Highlight</button>
          <button type="button" class="sketch-tool-btn" data-tool="eraser" title="Eraser">⌫ Erase</button>
        </div>

        <div class="sketch-sizes-group">
          <button type="button" class="sketch-size-btn" data-size="1.5" title="Fine (1.5px)"><span class="size-dot dot-sm"></span></button>
          <button type="button" class="sketch-size-btn active" data-size="3" title="Medium (3px)"><span class="size-dot dot-md"></span></button>
          <button type="button" class="sketch-size-btn" data-size="6" title="Thick (6px)"><span class="size-dot dot-lg"></span></button>
          <button type="button" class="sketch-size-btn" data-size="12" title="Marker (12px)"><span class="size-dot dot-xl"></span></button>
        </div>

        <div class="sketch-palette-group">
          <button type="button" class="sketch-swatch-chip active" data-color="${initialDefaultInk}" style="background-color: ${initialDefaultInk};" title="Default Ink"></button>
          <button type="button" class="sketch-swatch-chip" data-color="#a18a5e" style="background-color: #a18a5e;" title="Altus Gold"></button>
          <button type="button" class="sketch-swatch-chip" data-color="#e06c75" style="background-color: #e06c75;" title="Crimson"></button>
          <button type="button" class="sketch-swatch-chip" data-color="#61afef" style="background-color: #61afef;" title="Magic Blue"></button>
          <button type="button" class="sketch-swatch-chip" data-color="#98c379" style="background-color: #98c379;" title="Poison Green"></button>
          <button type="button" class="sketch-swatch-chip" data-color="#ffffff" style="background-color: #ffffff; border: 1px solid #777;" title="White"></button>
          
          <button type="button" class="sketch-color-wheel-btn" title="Color Wheel & Custom Picker">
            <span class="color-wheel-icon"></span>
          </button>
        </div>
      </div>

      <!-- Circular Color Wheel Popover -->
      <div class="sketch-wheel-popover hidden">
        <div class="wheel-popover-header">
          <span>COLOR WHEEL</span>
          <button type="button" class="wheel-close-btn">×</button>
        </div>
        <div class="wheel-canvas-wrap">
          <canvas class="wheel-disc-canvas" width="130" height="130"></canvas>
          <div class="wheel-disc-pin"></div>
        </div>
        <div class="wheel-slider-wrap">
          <label>LIGHTNESS</label>
          <input type="range" class="wheel-val-slider" min="0" max="100" value="100" />
        </div>
        <div class="wheel-footer">
          <span class="wheel-preview-chip"></span>
          <input type="text" class="wheel-hex-input" maxlength="7" value="${initialDefaultInk}" />
          <button type="button" class="wheel-apply-btn">OK</button>
        </div>
      </div>
    `;

    this.canvasContainer = this.el.querySelector('.sketch-canvas-container');
    this.svgLayer = this.el.querySelector('.sketch-svg-layer');
    this.activeCanvas = this.el.querySelector('.sketch-active-canvas');
    this.ctx = this.activeCanvas.getContext('2d');
    this.bakedOverlay = this.el.querySelector('.sketch-baked-overlay');
    this.statusBadge = this.el.querySelector('.sketch-status-badge');
    this.toolbar = this.el.querySelector('.sketch-widget-toolbar');

    this.undoBtn = this.el.querySelector('.sketch-undo-btn');
    this.redoBtn = this.el.querySelector('.sketch-redo-btn');
    this.clearBtn = this.el.querySelector('.sketch-clear-btn');
    this.bakeBtn = this.el.querySelector('.sketch-bake-btn');

    this.wheelPopover = this.el.querySelector('.sketch-wheel-popover');
    this.wheelCanvas = this.el.querySelector('.wheel-disc-canvas');
    this.wheelPin = this.el.querySelector('.wheel-disc-pin');
    this.wheelSlider = this.el.querySelector('.wheel-val-slider');
    this.wheelPreviewChip = this.el.querySelector('.wheel-preview-chip');
    this.wheelHexInput = this.el.querySelector('.wheel-hex-input');

    this.initWheelDisc();
  }

  initCanvas() {
    this.activeCanvas.width = this.width;
    this.activeCanvas.height = this.height;
    this.svgLayer.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
    this.svgLayer.setAttribute('width', this.width);
    this.svgLayer.setAttribute('height', this.height);
  }

  setPosition(top, left) {
    this.el.style.top = `${top}px`;
    this.el.style.left = `${left}px`;
  }

  updateDimensions(width, height) {
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;
    this.el.style.width = `${this.width + 4}px`;
    if (this.canvasContainer) {
      this.canvasContainer.style.width = `${this.width}px`;
      this.canvasContainer.style.height = `${this.height}px`;
    }
    this.initCanvas();
    this.redrawSVG();
  }

  updateTheme(isNightMode) {
    const isNight = isNightMode !== undefined ? isNightMode : document.body.classList.contains('night-mode');
    const defaultInk = isNight ? '#e5c07b' : '#141414';
    const firstSwatch = this.el.querySelector('.sketch-swatch-chip');
    if (firstSwatch) {
      firstSwatch.dataset.color = defaultInk;
      firstSwatch.style.backgroundColor = defaultInk;
    }
    // Update active color if user was using default ink
    if (this.activeColor === '#141414' || this.activeColor === '#e5c07b') {
      this.setColor(defaultInk);
    }
    this.redrawSVG();
  }

  activate() {
    if (!this.isBaked) return;
    this.manager.deactivateAllExcept(this);
    this.isBaked = false;

    this.el.classList.remove('baked');
    this.el.classList.add('active-editing');
    if (this.bakedOverlay) this.bakedOverlay.style.display = 'none';
    if (this.activeCanvas) {
      this.activeCanvas.style.display = 'block';
      this.activeCanvas.classList.remove('hidden');
    }
    this.toolbar.classList.remove('hidden');
    this.undoBtn.classList.remove('hidden');
    this.redoBtn.classList.remove('hidden');
    this.clearBtn.classList.remove('hidden');
    this.bakeBtn.classList.remove('hidden');

    this.statusBadge.textContent = '● ACTIVE';
    this.statusBadge.classList.add('badge-active');

    this.initCanvas();
    this.redrawSVG();
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  bake() {
    if (this.isBaked) return;
    this.isBaked = true;

    this.closeWheelPopover();
    this.el.classList.add('baked');
    this.el.classList.remove('active-editing');
    if (this.bakedOverlay) this.bakedOverlay.style.display = 'flex';
    if (this.activeCanvas) {
      this.activeCanvas.style.display = 'none';
      this.activeCanvas.classList.add('hidden');
    }
    this.toolbar.classList.add('hidden');
    this.undoBtn.classList.add('hidden');
    this.redoBtn.classList.add('hidden');
    this.clearBtn.classList.add('hidden');
    this.bakeBtn.classList.add('hidden');

    this.statusBadge.textContent = '✎ DORMANT';
    this.statusBadge.classList.remove('badge-active');

    this.ctx.clearRect(0, 0, this.width, this.height);
    this.redrawSVG();
    this.save();
  }

  initWheelDisc() {
    const wCtx = this.wheelCanvas.getContext('2d');
    const size = 130;
    const radius = size / 2;
    const imgData = wCtx.createImageData(size, size);
    const data = imgData.data;

    const val = parseInt(this.wheelSlider.value, 10) / 100;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - radius;
        const dy = y - radius;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const idx = (y * size + x) * 4;

        if (dist <= radius) {
          let angle = Math.atan2(dy, dx) * (180 / Math.PI);
          if (angle < 0) angle += 360;
          const sat = dist / radius;

          const rgb = this.hsvToRgb(angle, sat, val);
          data[idx] = rgb.r;
          data[idx + 1] = rgb.g;
          data[idx + 2] = rgb.b;
          data[idx + 3] = 255;
        } else {
          data[idx + 3] = 0;
        }
      }
    }
    wCtx.putImageData(imgData, 0, 0);
  }

  hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;

    if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
    else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
    else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
    else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
    else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
    else if (h >= 300 && h < 360) { r = c; g = 0; b = x; }

    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }

  rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  bindEvents() {
    // Single click activation from dormant mode
    this.bakedOverlay.addEventListener('click', (e) => {
      e.stopPropagation();
      this.activate();
    });

    // Toggle button in header
    this.statusBadge.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isBaked) {
        this.activate();
      } else {
        this.bake();
      }
    });

    this.bakeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.bake();
    });

    // Tool buttons
    this.el.querySelectorAll('.sketch-tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.el.querySelectorAll('.sketch-tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTool = btn.dataset.tool;
      });
    });

    // Size buttons
    this.el.querySelectorAll('.sketch-size-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.el.querySelectorAll('.sketch-size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeWidth = parseFloat(btn.dataset.size);
      });
    });

    // Swatches
    this.el.querySelectorAll('.sketch-swatch-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        this.el.querySelectorAll('.sketch-swatch-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.setColor(chip.dataset.color);
      });
    });

    // Color Wheel Button
    const wheelBtn = this.el.querySelector('.sketch-color-wheel-btn');
    wheelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleWheelPopover();
    });

    const wheelClose = this.el.querySelector('.wheel-close-btn');
    wheelClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeWheelPopover();
    });

    const wheelApply = this.el.querySelector('.wheel-apply-btn');
    wheelApply.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setColor(this.wheelHexInput.value);
      this.closeWheelPopover();
    });

    this.wheelSlider.addEventListener('input', () => {
      this.initWheelDisc();
    });

    this.wheelHexInput.addEventListener('input', () => {
      let hex = (this.wheelHexInput.value || '').trim();
      if (!hex) return;
      if (!hex.startsWith('#')) hex = '#' + hex;
      if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
        this.wheelPreviewChip.style.backgroundColor = hex;
      }
    });

    // Wheel disc click / drag
    let draggingWheel = false;
    const handleWheelDisc = (e) => {
      const rect = this.wheelCanvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const radius = 130 / 2;
      const x = clientX - rect.left - radius;
      const y = clientY - rect.top - radius;

      const dist = Math.min(radius, Math.sqrt(x * x + y * y));
      let angle = Math.atan2(y, x) * (180 / Math.PI);
      if (angle < 0) angle += 360;

      const sat = dist / radius;
      const val = parseInt(this.wheelSlider.value, 10) / 100;
      const rgb = this.hsvToRgb(angle, sat, val);
      const hex = this.rgbToHex(rgb.r, rgb.g, rgb.b);

      const pinX = radius + Math.cos(angle * Math.PI / 180) * dist;
      const pinY = radius + Math.sin(angle * Math.PI / 180) * dist;
      this.wheelPin.style.left = `${pinX}px`;
      this.wheelPin.style.top = `${pinY}px`;
      this.wheelPin.style.display = 'block';

      this.wheelPreviewChip.style.backgroundColor = hex;
      this.wheelHexInput.value = hex;
    };

    this.wheelCanvas.addEventListener('pointerdown', (e) => {
      draggingWheel = true;
      this.wheelCanvas.setPointerCapture(e.pointerId);
      handleWheelDisc(e);
    });
    this.wheelCanvas.addEventListener('pointermove', (e) => {
      if (draggingWheel) handleWheelDisc(e);
    });
    const stopWheel = (e) => {
      if (draggingWheel) {
        draggingWheel = false;
        try { this.wheelCanvas.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    };
    this.wheelCanvas.addEventListener('pointerup', stopWheel);
    this.wheelCanvas.addEventListener('pointercancel', stopWheel);

    // Canvas pointer events for drawing
    this.activeCanvas.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.onPointerDown(e);
    });
    this.activeCanvas.addEventListener('pointermove', (e) => {
      e.stopPropagation();
      this.onPointerMove(e);
    });
    this.activeCanvas.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      this.onPointerUp(e);
    });
    this.activeCanvas.addEventListener('pointercancel', (e) => {
      e.stopPropagation();
      this.onPointerUp(e);
    });

    // Header Actions
    this.undoBtn.addEventListener('click', (e) => { e.stopPropagation(); this.undo(); });
    this.redoBtn.addEventListener('click', (e) => { e.stopPropagation(); this.redo(); });
    this.clearBtn.addEventListener('click', (e) => { e.stopPropagation(); this.clear(); });
    this.el.querySelector('.sketch-copy-btn').addEventListener('click', (e) => { e.stopPropagation(); this.copySVG(); });

    // Shortcuts when active on this widget
    this.el.addEventListener('keydown', (e) => {
      if (this.isBaked) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.redo();
        else this.undo();
      }
    });
  }

  setColor(hex) {
    if (!hex || typeof hex !== 'string') {
      const isNight = document.body.classList.contains('night-mode');
      hex = isNight ? '#e5c07b' : '#141414';
    }
    if (!hex.startsWith('#')) hex = '#' + hex;
    this.activeColor = hex;
    if (this.wheelPreviewChip) this.wheelPreviewChip.style.backgroundColor = hex;
    if (this.wheelHexInput) this.wheelHexInput.value = hex;

    let found = false;
    this.el.querySelectorAll('.sketch-swatch-chip').forEach(c => {
      const chipColor = c.dataset.color || '';
      if (chipColor.toLowerCase() === hex.toLowerCase()) {
        c.classList.add('active');
        found = true;
      } else {
        c.classList.remove('active');
      }
    });

    const wheelIcon = this.el.querySelector('.color-wheel-icon');
    if (wheelIcon && !found) {
      wheelIcon.style.borderColor = hex;
    }
  }

  toggleWheelPopover() {
    this.colorWheelOpen = !this.colorWheelOpen;
    this.wheelPopover.classList.toggle('hidden', !this.colorWheelOpen);
    if (this.colorWheelOpen) {
      this.initWheelDisc();
      this.wheelPreviewChip.style.backgroundColor = this.activeColor;
      this.wheelHexInput.value = this.activeColor;
    }
  }

  closeWheelPopover() {
    this.colorWheelOpen = false;
    this.wheelPopover.classList.add('hidden');
  }

  getPointerPos(e) {
    const rect = this.activeCanvas.getBoundingClientRect();
    const scaleX = this.width / (rect.width || this.width);
    const scaleY = this.height / (rect.height || this.height);
    return {
      x: Math.max(0, Math.min(this.width, (e.clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(this.height, (e.clientY - rect.top) * scaleY))
    };
  }

  onPointerDown(e) {
    if (this.isBaked) {
      this.activate();
    }
    if (e.button !== 0) return;
    this.isDrawing = true;
    try { this.activeCanvas.setPointerCapture(e.pointerId); } catch (_) {}

    const pos = this.getPointerPos(e);

    if (this.activeTool === 'eraser') {
      this.eraseAt(pos.x, pos.y);
      return;
    }

    this.currentPoints = [pos];
    this.redoStack = [];

    this.ctx.clearRect(0, 0, this.width, this.height);
    this.drawCurrentActiveStroke();
  }

  onPointerMove(e) {
    if (!this.isDrawing || this.isBaked) return;
    const pos = this.getPointerPos(e);

    if (this.activeTool === 'eraser') {
      this.eraseAt(pos.x, pos.y);
      return;
    }

    const last = this.currentPoints[this.currentPoints.length - 1];
    if (last) {
      const dist = Math.hypot(pos.x - last.x, pos.y - last.y);
      if (dist < 2) return;
    }

    this.currentPoints.push(pos);
    this.drawCurrentActiveStroke();
  }

  onPointerUp(e) {
    if (!this.isDrawing || this.isBaked) return;
    this.isDrawing = false;
    try { this.activeCanvas.releasePointerCapture(e.pointerId); } catch (_) {}

    if (this.activeTool === 'eraser') return;

    if (this.currentPoints.length > 0) {
      const d = this.manager.pointsToPath(this.currentPoints);
      const isHighlighter = this.activeTool === 'highlighter';

      const stroke = {
        d,
        points: this.currentPoints,
        color: this.activeColor,
        width: isHighlighter ? this.activeWidth * 3.5 : this.activeWidth,
        opacity: isHighlighter ? 0.35 : 1,
        tool: this.activeTool
      };

      this.strokes.push(stroke);
      this.currentPoints = [];
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.redrawSVG();
      this.save();
    }
  }

  eraseAt(x, y) {
    const threshold = this.activeWidth * 4;
    const beforeCount = this.strokes.length;

    this.strokes = this.strokes.filter(stroke => {
      if (!stroke.points) return true;
      for (const p of stroke.points) {
        if (Math.hypot(p.x - x, p.y - y) <= threshold) {
          return false;
        }
      }
      return true;
    });

    if (this.strokes.length !== beforeCount) {
      this.redrawSVG();
      this.save();
    }
  }

  drawCurrentActiveStroke() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    if (this.currentPoints.length === 0) return;

    const isHighlighter = this.activeTool === 'highlighter';
    const width = isHighlighter ? this.activeWidth * 3.5 : this.activeWidth;
    const opacity = isHighlighter ? 0.35 : 1;

    this.ctx.save();
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = this.activeColor;
    this.ctx.lineWidth = width;
    this.ctx.globalAlpha = opacity;

    if (this.currentPoints.length === 1) {
      this.ctx.beginPath();
      this.ctx.arc(this.currentPoints[0].x, this.currentPoints[0].y, width / 2, 0, Math.PI * 2);
      this.ctx.fillStyle = this.activeColor;
      this.ctx.fill();
    } else {
      this.ctx.beginPath();
      this.ctx.moveTo(this.currentPoints[0].x, this.currentPoints[0].y);

      for (let i = 1; i < this.currentPoints.length - 1; i++) {
        const p1 = this.currentPoints[i];
        const p2 = this.currentPoints[i + 1];
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        this.ctx.quadraticCurveTo(p1.x, p1.y, mx, my);
      }

      const last = this.currentPoints[this.currentPoints.length - 1];
      this.ctx.lineTo(last.x, last.y);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  redrawSVG() {
    const isNight = document.body.classList.contains('night-mode');
    let pathsHtml = '';

    for (const s of this.strokes) {
      let color = s.color;
      if (!color || color === 'theme-ink') {
        color = isNight ? '#e5c07b' : '#141414';
      }
      const opacity = s.opacity !== undefined ? s.opacity : 1;
      const strokeWidth = s.width || 2.5;
      const d = s.d || this.manager.pointsToPath(s.points);
      if (d) {
        pathsHtml += `<path d="${d}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="${opacity}" />`;
      }
    }

    this.svgLayer.innerHTML = pathsHtml;
  }

  undo() {
    if (this.strokes.length === 0) return;
    const stroke = this.strokes.pop();
    this.redoStack.push(stroke);
    this.redrawSVG();
    this.save();
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const stroke = this.redoStack.pop();
    this.strokes.push(stroke);
    this.redrawSVG();
    this.save();
  }

  clear() {
    if (this.strokes.length === 0) return;
    this.redoStack = [...this.strokes];
    this.strokes = [];
    this.redrawSVG();
    this.save();
  }

  async copySVG() {
    const isNight = document.body.classList.contains('night-mode');
    const svgStr = this.manager.renderSVGString(this.width, this.height, this.strokes, isNight);
    try {
      await navigator.clipboard.writeText(svgStr);
      if (this.manager.app.statusMessenger) {
        this.manager.app.statusMessenger.show('SVG copied to clipboard');
      }
    } catch (_) {}
  }

  save() {
    this.manager.saveSketchData(this.sketchId, {
      id: this.sketchId,
      width: this.width,
      height: this.height,
      strokes: this.strokes
    });
  }

  destroy() {
    this.closeWheelPopover();
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }
}
