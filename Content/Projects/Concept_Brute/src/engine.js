import { CHUNK_SIZE, LAYERS_COUNT, TOOLS } from './constants.js';

export class Engine {
  constructor(container) {
    this.container = container;
    this.chunks = new Map(); // id -> { canvases: [canvas, canvas, canvas], ctxs: [ctx, ctx, ctx] }
    this.activeLayer = 1; // Default to first paint layer
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.keys = {};
    
    this.brush = {
      size: 40,
      color: '#333333',
      opacity: 1.0,
      flow: 1.0,
      spacing: 0.05, // Tightened for "cleaner" strokes
      speedSize: 8.0,
      speedOpacity: 6.0,
      speedValue: -4.0, // Requested default
      speedHue: -10.0,
      type: TOOLS.BRUSH 
    };

    this.strokePoints = [];
    this.spacingAccumulator = 0;

    this.history = [];
    this.redoStack = [];
    this.currentStrokeDirtyChunks = new Map();
    
    this.activeSelectionPath = null;
    this.floatingSelection = null;
    this.dirtyChunks = new Set(); // Tracks chunks that need persisting to storage

    this.canvasBg = '#ffffff';
    this.gridColor = '#cccccc';
    this.showGrid = true;
    this.isMirrored = false;

    // Dedicated wrapper for all canvas content that can be mirrored
    this.canvasWrapper = document.createElement('div');
    this.canvasWrapper.className = 'absolute inset-0 pointer-events-none w-full h-full';
    this.container.appendChild(this.canvasWrapper);

    this.brushCursor = document.getElementById('brush-cursor');
    this.canvasWrapper.appendChild(this.brushCursor);

    this.lastPos = null;
    this.lastTime = null;
    this.smoothedVelocity = 0;
    this.zoomAnchor = null;
    
    // Dedicated UI Layer for overlays (Selection, Lasso, etc)
    this.uiLayer = document.createElement('div');
    this.uiLayer.className = 'absolute inset-0 pointer-events-none z-100';
    this.canvasWrapper.appendChild(this.uiLayer);

    // Selection Viz Overlay
    this.selectionViz = document.createElement('canvas');
    this.selectionViz.className = 'absolute inset-0 pointer-events-none';
    this.uiLayer.appendChild(this.selectionViz);

    this._initEvents();
    this._startAnimationLoop();
  }

  _startAnimationLoop() {
      const loop = () => {
          this._drawSelectionViz();
          requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
  }

  _initEvents() {
    this.container.addEventListener('mousedown', (e) => this._startStroke(e));
    window.addEventListener('mousemove', (e) => {
      this._moveStroke(e);
      this._handlePickerMove(e);
      this._updateBrushCursor(e);
    });
    window.addEventListener('mouseup', (e) => this._endStroke(e));
    
    window.addEventListener('keydown', (e) => {
        this.keys[e.key.toLowerCase()] = true;
        this._updateCursor();
    });
    window.addEventListener('keyup', (e) => {
        this.keys[e.key.toLowerCase()] = false;
        this._updateCursor();
    });
    
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey) {
        // Zoom centered on cursor
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.setZoom(this.zoom * delta, e.clientX, e.clientY);
      } else {
        // Pan
        this.pan.x -= e.deltaX;
        this.pan.y -= e.deltaY;
        this.refresh();
      }
      this._updateCursor();
    }, { passive: false });
  }

  toggleMirror() {
    this.isMirrored = !this.isMirrored;
    if (this.isMirrored) {
        this.canvasWrapper.style.transform = 'scaleX(-1)';
    } else {
        this.canvasWrapper.style.transform = '';
    }
    this._status(this.isMirrored ? 'MIRRORED' : 'NORMAL');
  }

  _getMousePos(e) {
    const rect = this.container.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    
    if (this.isMirrored) {
        x = rect.width - x;
    }
    
    return {
        x: x, 
        y: y,
        wx: (x - this.pan.x) / this.zoom,
        wy: (y - this.pan.y) / this.zoom
    };
  }

  _updateCursor() {
    if (this.isPanning || this.keys[' ']) {
        this.container.style.cursor = 'grab';
    } else if (this.isZooming || this.keys['z']) {
        this.container.style.cursor = 'zoom-in';
    } else {
        this.container.style.cursor = 'crosshair';
    }
  }

  _markDirty(id, layer) {
      this.dirtyChunks.add(`${id}|${layer}`);
  }

  _getChunkCoords(x, y) {
    const cx = Math.floor((x - this.pan.x) / (CHUNK_SIZE * this.zoom));
    const cy = Math.floor((y - this.pan.y) / (CHUNK_SIZE * this.zoom));
    return { cx, cy };
  }

  _getChunk(cx, cy) {
    const id = `${cx},${cy}`;
    if (this.chunks.has(id)) return this.chunks.get(id);

    const chunk = {
      cx, cy,
      canvases: [],
      ctxs: [],
      element: document.createElement('div')
    };

    chunk.element.className = 'absolute border-white-5 pointer-events-none';
    chunk.element.style.width = `${CHUNK_SIZE}px`;
    chunk.element.style.height = `${CHUNK_SIZE}px`;
    
    for (let i = 0; i < LAYERS_COUNT; i++) {
      const canv = document.createElement('canvas');
      canv.width = CHUNK_SIZE;
      canv.height = CHUNK_SIZE;
      canv.className = 'absolute inset-0';
      chunk.element.appendChild(canv);
      chunk.canvases.push(canv);
      chunk.ctxs.push(canv.getContext('2d', { alpha: true }));
    }

    this.canvasWrapper.appendChild(chunk.element);
    this.chunks.set(id, chunk);
    this._updateChunkTransform(chunk);
    return chunk;
  }

  _updateChunkTransform(chunk) {
    const x = chunk.cx * CHUNK_SIZE * this.zoom + this.pan.x;
    const y = chunk.cy * CHUNK_SIZE * this.zoom + this.pan.y;
    chunk.element.style.transform = `translate(${x}px, ${y}px) scale(${this.zoom})`;
    chunk.element.style.transformOrigin = 'top left';
  }

  refresh() {
    this.chunks.forEach(chunk => this._updateChunkTransform(chunk));
    
    // Sync Grid Background
    const gridSize = 20 * this.zoom;
    this.container.style.backgroundColor = this.canvasBg;
    this.container.style.backgroundImage = 'none'; // Clear from container to avoid doubling with canvasWrapper

    if (this.showGrid) {
        this.canvasWrapper.style.backgroundImage = `radial-gradient(${this.gridColor} 1px, transparent 1px)`;
    } else {
        this.canvasWrapper.style.backgroundImage = 'none';
    }
    this.canvasWrapper.style.backgroundSize = `${gridSize}px ${gridSize}px`;
    this.canvasWrapper.style.backgroundPosition = `${this.pan.x}px ${this.pan.y}px`;

    this._drawSelectionViz();
    this._updateSelectionPreview();
  }

  _drawSelectionViz() {
      if (!this.selectionViz) return;
      const ctx = this.selectionViz.getContext('2d');
      const rect = this.container.getBoundingClientRect();
      if (this.selectionViz.width !== rect.width || this.selectionViz.height !== rect.height) {
          this.selectionViz.width = rect.width;
          this.selectionViz.height = rect.height;
      }
      ctx.clearRect(0,0, rect.width, rect.height);
      
      if (this.activeSelectionPath) {
          ctx.strokeStyle = '#000';
          ctx.setLineDash([5, 5]);
          ctx.lineDashOffset = (Date.now() / 50) % 10;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          this.activeSelectionPath.forEach((p, i) => {
              const sx = p.x * this.zoom + this.pan.x;
              const sy = p.y * this.zoom + this.pan.y;
              if (i === 0) ctx.moveTo(sx, sy);
              else ctx.lineTo(sx, sy);
          });
          ctx.closePath();
          ctx.stroke();
          
          ctx.strokeStyle = '#fff';
          ctx.lineDashOffset = ((Date.now() / 50) % 10) + 5;
          ctx.stroke();

          // NEW: Bounding box for selection
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          this.activeSelectionPath.forEach(p => {
              minX = Math.min(minX, p.x);
              minY = Math.min(minY, p.y);
              maxX = Math.max(maxX, p.x);
              maxY = Math.max(maxY, p.y);
          });
          
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.setLineDash([2, 6]);
          ctx.strokeRect(
              minX * this.zoom + this.pan.x - 2,
              minY * this.zoom + this.pan.y - 2,
              (maxX - minX) * this.zoom + 4,
              (maxY - minY) * this.zoom + 4
          );
      }
  }

  startTransform() {
      if (!this.activeSelectionPath) return;
      this._status('TRANSFORMING');
      
      // Perform final cut-out now
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      this.activeSelectionPath.forEach(p => {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
      });

      const width = Math.ceil(maxX - minX);
      const height = Math.ceil(maxY - minY);
      if (width < 1 || height < 1) return;

      const selectionCanvas = document.createElement('canvas');
      selectionCanvas.width = width;
      selectionCanvas.height = height;
      const sCtx = selectionCanvas.getContext('2d');

      const startCX = Math.floor(minX / CHUNK_SIZE);
      const startCY = Math.floor(minY / CHUNK_SIZE);
      const endCX = Math.floor(maxX / CHUNK_SIZE);
      const endCY = Math.floor(maxY / CHUNK_SIZE);

      const lassoHistory = new Map();
      for (let cx = startCX; cx <= endCX; cx++) {
          for (let cy = startCY; cy <= endCY; cy++) {
              const id = `${cx},${cy}`;
              const chunk = this.chunks.get(id);
              if (!chunk) continue;
              const lx = cx * CHUNK_SIZE;
              const ly = cy * CHUNK_SIZE;

              // Copy to selection canvas
              sCtx.save();
              sCtx.beginPath();
              this.activeSelectionPath.forEach((p, i) => {
                  if (i === 0) sCtx.moveTo(p.x - minX, p.y - minY);
                  else sCtx.lineTo(p.x - minX, p.y - minY);
              });
              sCtx.closePath();
              sCtx.clip();
              sCtx.drawImage(chunk.canvases[this.activeLayer], lx - minX, ly - minY);
              sCtx.restore();
              
              // Backup for undo
              const backup = document.createElement('canvas');
              backup.width = CHUNK_SIZE;
              backup.height = CHUNK_SIZE;
              backup.getContext('2d').drawImage(chunk.canvases[this.activeLayer], 0, 0);
              lassoHistory.set(id, { layer: this.activeLayer, canvas: backup });

              // Clear source
              const ctx = chunk.ctxs[this.activeLayer];
              ctx.save();
              ctx.beginPath();
              this.activeSelectionPath.forEach((p, i) => {
                  if (i === 0) ctx.moveTo(p.x - lx, p.y - ly);
                  else ctx.lineTo(p.x - lx, p.y - ly);
              });
              ctx.closePath();
              ctx.clip();
              ctx.clearRect(0,0, CHUNK_SIZE, CHUNK_SIZE);
              ctx.restore();
              this._markDirty(id, this.activeLayer);
          }
      }

      this.floatingSelection = {
          canvas: selectionCanvas,
          x: minX,
          y: minY,
          width: width,
          height: height
      };

      this.history.push({ 
          type: 'transform', 
          chunks: lassoHistory, 
          // Store old path so undo brings it back
          path: this.activeSelectionPath,
          selection: { ...this.floatingSelection }
      });

      this.activeSelectionPath = null;
      this._updateSelectionPreview();
      this.refresh();
  }

  _status(text) {
      if (this.onStatus) this.onStatus(text);
  }

  pickColor(x, y) {
    const m = this._getMousePos({ clientX: x, clientY: y });
    const wx = m.wx;
    const wy = m.wy;
    
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cy = Math.floor(wy / CHUNK_SIZE);
    const chunk = this.chunks.get(`${cx},${cy}`);
    if (!chunk) return '#000000';

    // Pick from top-most non-transparent layer
    for (let i = LAYERS_COUNT - 1; i >= 0; i--) {
        const lx = wx - cx * CHUNK_SIZE;
        const ly = wy - cy * CHUNK_SIZE;
        if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_SIZE) continue;
        const data = chunk.ctxs[i].getImageData(lx, ly, 1, 1).data;
        if (data[3] > 10) { // If not transparent
            const r = data[0].toString(16).padStart(2, '0');
            const g = data[1].toString(16).padStart(2, '0');
            const b = data[2].toString(16).padStart(2, '0');
            return `#${r}${g}${b}`;
        }
    }
    return '#ffffff';
  }

  _startStroke(e) {
    this.lastMousePos = { x: e.clientX, y: e.clientY };

    // Expanded UI shielding to prevent drawing through panels
    const target = e.target;
    if (target.closest('.ui-panel') || target.closest('button') || target.closest('input') || target.closest('#top-bar')) {
        return;
    }
    
    // Check if we are panning (Space) or zooming (Z)
    if (this.keys[' '] || this.isPanningMode) {
        this.isPanning = true;
        return;
    }
    
    if (this.keys['z'] || this.isZoomingMode) {
        this.isZooming = true;
        this.zoomAnchor = { x: e.clientX, y: e.clientY };
        return;
    }

    // No Color Pick for Wireframe
    if (this.brush.type === TOOLS.PICKER) {
        this.brush.color = this.pickColor(e.clientX, e.clientY);
    }

    // NEW: Handle Alt-Click for picking
    if (e.altKey) {
        const color = this.pickColor(e.clientX, e.clientY);
        this._notifyPicker(e.clientX, e.clientY, color, true); // true = SET color now
        return; // STOP HERE, don't start drawing
    }

    // Selection Apply Check: If we have a selection and click away, apply it
    if (this.floatingSelection) {
        const m = this._getMousePos(e);
        const wx = m.wx;
        const wy = m.wy;
        const sel = this.floatingSelection;
        
        if (wx >= sel.x && wx <= sel.x + sel.canvas.width && 
            wy >= sel.y && wy <= sel.y + sel.canvas.height) {
            // Click inside selection: start moving regardless of tool
            this.isDrawing = true;
            this.lastMousePos = { x: e.clientX, y: e.clientY };
            return;
        } else {
            // Click outside selection: apply it
            this._applySelection();
            if (this.onDrawEnd) this.onDrawEnd();
            // Don't return, let it start a new stroke (e.g. new lasso)
        }
    }

    // Clear Selection on new Lasso click if we aren't moving a transform
    if (this.brush.type === TOOLS.LASSO) {
        if (this.activeSelectionPath) {
            // Store clear action in history
            this.history.push({ type: 'selection', path: [...this.activeSelectionPath] });
            this.clearSelection();
        }
    }

    this.isDrawing = true;
    const m = this._getMousePos(e);
    this.lastPos = { x: m.x, y: m.y };
    this.lastTime = performance.now();
    this.smoothedVelocity = 0;
    this.strokePoints = [];
    this.spacingAccumulator = 0;
    
    // Clear dirty chunks tracking for this stroke
    this.currentStrokeDirtyChunks = new Map();
    this.redoStack = []; // Clear redo on new action
  }

  _moveStroke(e) {
    if (this.isPanning) {
        let dx = e.clientX - this.lastMousePos.x;
        const dy = e.clientY - this.lastMousePos.y;
        
        if (this.isMirrored) dx = -dx;
        
        this.pan.x += dx;
        this.pan.y += dy;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        this.refresh();
        return;
    }
    
    if (this.isZooming) {
        // Use vertical delta primarily for zoom, but now anchored to start pos
        const dy = e.clientY - this.lastMousePos.y;
        
        // Exponential zoom feel
        const zoomDelta = -dy * 0.01;
        const newZoom = this.zoom * (1 + zoomDelta);
        
        this.setZoom(newZoom, this.zoomAnchor.x, this.zoomAnchor.y);
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        return;
    }

    if (this.floatingSelection && this.isDrawing) {
        const pdx_raw = (e.clientX - this.lastMousePos.x) / this.zoom;
        const pdy = (e.clientY - this.lastMousePos.y) / this.zoom;
        // If mirrored, screen movement X is visually reversed relative to world storage
        const pdx = this.isMirrored ? -pdx_raw : pdx_raw;
        this.floatingSelection.x += pdx;
        this.floatingSelection.y += pdy;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        this._updateSelectionPreview();
        return;
    }

    if (!this.isDrawing) return;
    const m = this._getMousePos(e);
    const currentPos = { x: m.x, y: m.y };

    if (this.brush.type === TOOLS.LASSO) {
        this._drawLasso(this.lastPos, currentPos);
        this.lastPos = currentPos;
        return;
    }

    const currentTime = performance.now();

    const dx = currentPos.x - this.lastPos.x;
    const dy = currentPos.y - this.lastPos.y;
    const dt = Math.max(0.1, currentTime - this.lastTime); // Prevent division by zero or extreme near-zero
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Prevent artifacts from jitter (very small movements)
    if (dist < 0.1) return;
    
    // Raw velocity
    const rawVelocity = dist / dt;
    
    // Smooth velocity to prevent wild jumps (Exponential Moving Average)
    // Using a factor of 0.2 for a good balance of responsiveness and stability
    this.smoothedVelocity = this.smoothedVelocity * 0.8 + rawVelocity * 0.2;
    
    // Clamp smoothed velocity to avoid outliers from performance spikes
    const velocity = Math.min(this.smoothedVelocity, 500); 

    const worldFrom = {
      x: (this.lastPos.x - this.pan.x) / this.zoom,
      y: (this.lastPos.y - this.pan.y) / this.zoom
    };
    const worldTo = {
      x: (currentPos.x - this.pan.x) / this.zoom,
      y: (currentPos.y - this.pan.y) / this.zoom
    };

    // --- Brush Sensitivity ---
    // Enhanced velocity factor with higher range
    const threshold = 10 + (this.brush.flow * 40); 
    const vFactor = Math.pow(Math.min(velocity / threshold, 1.5), 1.2); 
    
    // Size: positive speedSize means faster=smaller
    const sizeMod = 1 - (vFactor * this.brush.speedSize * 0.2); 
    const dynamicSize = this.brush.size * Math.max(0.05, sizeMod);
    
    // Opacity: positive speedOpacity means faster=transparent
    const opacMod = 1 - (vFactor * this.brush.speedOpacity * 0.2);
    const dynamicOpacity = this.brush.opacity * Math.max(0.01, opacMod);

    let color = this.brush.color;
    // Color shift: Value and Hue
    if (this.brush.speedValue !== 0 || this.brush.speedHue !== 0) {
        // Value: speedValue (positive = faster:darker, negative = faster:lighter)
        color = this._shiftColor(color, vFactor * this.brush.speedHue * 60, -vFactor * (this.brush.speedValue / 10)); // Fixed mapping
    }

    if (this.brush.type === TOOLS.WIREFRAME) {
        this.strokePoints.push(worldTo);
        // 1. Core Ink Line
        this._paintOnChunks(worldFrom, worldTo, Math.max(1, dynamicSize * 0.1), dynamicOpacity, color);
        // 2. Wire connections
        const thresholdMax = dynamicSize * 4;
        const thresholdMin = dynamicSize * 0.5;
        const points = this.strokePoints;
        const count = points.length;
        // Connect to a few previous points within range
        const maxSeek = 30;
        for (let i = Math.max(0, count - maxSeek); i < count - 1; i++) {
            const p = points[i];
            const d = Math.sqrt((p.x - worldTo.x)**2 + (p.y - worldTo.y)**2);
            if (d > thresholdMin && d < thresholdMax) {
                this._paintOnChunks(p, worldTo, 1, dynamicOpacity * 0.2, color);
            }
        }
    } else {
        this._paintOnChunks(worldFrom, worldTo, dynamicSize, dynamicOpacity, color);
    }
    
    // Maintain spacing continuity
    const segDist = Math.sqrt((worldTo.x - worldFrom.x)**2 + (worldTo.y - worldFrom.y)**2);
    const step = Math.max(0.5, dynamicSize * this.brush.spacing);
    let nextStamp = this.spacingAccumulator;
    while (nextStamp <= segDist) {
        nextStamp += step;
    }
    this.spacingAccumulator = nextStamp - segDist;

    this.lastPos = currentPos;
    this.lastTime = currentTime;
  }

  _endStroke() {
    if (this.brush.type === TOOLS.LASSO && this.lassoPath?.length > 10) {
        this._processLassoSelection();
    }

    // Store the dirty chunks as a history state
    if (this.currentStrokeDirtyChunks.size > 0) {
        this.history.push({
            type: 'stroke',
            chunks: this.currentStrokeDirtyChunks,
            zoom: this.zoom,
            pan: { ...this.pan }
        });
        if (this.history.length > 30) this.history.shift();
        if (this.onDrawEnd) this.onDrawEnd();
    }
    
    this.isDrawing = false;
    this.isPanning = false;
    this.isZooming = false;
    this.lastPos = null;
    this.lassoPath = null;
    this._status('READY');
    
    if (this.lassoOverlay) this.lassoOverlay.remove();
    this.lassoOverlay = null;
  }

  _updateBrushCursor(e) {
    if (!this.brushCursor) return;

    const rect = this.container.getBoundingClientRect();

    // Hide if mouse is over UI
    if (e.target.closest('.ui-panel') || e.target.closest('button') || e.target.closest('input') || e.target.closest('#top-bar')) {
        this.brushCursor.style.display = 'none';
        return;
    } else {
        this.brushCursor.style.display = 'block';
    }

    const s = this.brush.size * this.zoom;
    let w = s;
    let h = s;
    let br = '0px';

    if (this.brush.type === TOOLS.WIREFRAME) {
        br = '50%';
    } else if (this.brush.type === TOOLS.BRUSH) {
        h = s / 2;
    } else if (this.brush.type === TOOLS.LASSO) {
        w = 10;
        h = 10;
        br = '50%';
    }

    this.brushCursor.style.width = `${w}px`;
    this.brushCursor.style.height = `${h}px`;
    this.brushCursor.style.borderRadius = br;
    
    // Position relative to container
    let x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.isMirrored) {
        x = rect.width - x;
    }
    
    this.brushCursor.style.left = `${x - w/2}px`;
    this.brushCursor.style.top = `${y - h/2}px`;
    
    // Inverted contrast for high visibility
    this.brushCursor.style.mixBlendMode = 'difference';
    // Using high brightness for difference mode to result in inversion
    this.brushCursor.style.borderColor = this.brush.type === TOOLS.ERASER ? '#ff6666' : '#ffffff';
  }

  _drawLasso(from, to) {
      if (!this.lassoPath) {
          this.lassoPath = [];
          this.lassoOverlay = document.createElement('canvas');
          this.lassoOverlay.className = 'absolute inset-0 pointer-events-none';
          const rect = this.container.getBoundingClientRect();
          this.lassoOverlay.width = rect.width;
          this.lassoOverlay.height = rect.height;
          this.uiLayer.appendChild(this.lassoOverlay);
      }
      const wx = (to.x - this.pan.x) / this.zoom;
      const wy = (to.y - this.pan.y) / this.zoom;
      this.lassoPath.push({ x: wx, y: wy });
      
      const ctx = this.lassoOverlay.getContext('2d');
      ctx.clearRect(0,0, this.lassoOverlay.width, this.lassoOverlay.height);
      ctx.strokeStyle = '#000';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      this.lassoPath.forEach((p, i) => {
          const sx = p.x * this.zoom + this.pan.x;
          const sy = p.y * this.zoom + this.pan.y;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
      
      this._status('LASSOING...');
  }

  _updateSelectionPreview() {
      if (!this.floatingSelection) {
          if (this.selectionOverlay) this.selectionOverlay.remove();
          this.selectionOverlay = null;
          return;
      }

      if (!this.selectionOverlay) {
          this.selectionOverlay = document.createElement('div');
          // Multiple borders for visibility on any background
          this.selectionOverlay.className = 'absolute pointer-events-none';
          this.selectionOverlay.style.boxShadow = '0 0 0 1px white, 0 0 0 2px black';
          this.selectionOverlay.style.border = '1px dashed white';
          this.uiLayer.appendChild(this.selectionOverlay);
          
          this.selectionCanvas = document.createElement('canvas');
          this.selectionCanvas.className = 'w-full h-full';
          this.selectionOverlay.appendChild(this.selectionCanvas);
      }

      const sel = this.floatingSelection;
      
      // Only resize canvas if dimensions actually changed (performance)
      if (this.selectionCanvas.width !== sel.canvas.width || this.selectionCanvas.height !== sel.canvas.height) {
          this.selectionCanvas.width = sel.canvas.width;
          this.selectionCanvas.height = sel.canvas.height;
          const ctx = this.selectionCanvas.getContext('2d');
          ctx.drawImage(sel.canvas, 0, 0);
      }

      this.selectionOverlay.style.width = `${sel.canvas.width}px`;
      this.selectionOverlay.style.height = `${sel.canvas.height}px`;
      
      const x = sel.x * this.zoom + this.pan.x;
      const y = sel.y * this.zoom + this.pan.y;
      this.selectionOverlay.style.transform = `translate(${x}px, ${y}px) scale(${this.zoom})`;
      this.selectionOverlay.style.transformOrigin = 'top left';
  }

  _processLassoSelection() {
      if (!this.lassoPath || this.lassoPath.length < 3) {
          this.lassoPath = null;
          if (this.lassoOverlay) this.lassoOverlay.remove();
          this.lassoOverlay = null;
          this.refresh();
          return;
      }
      const prevPath = this.activeSelectionPath ? [...this.activeSelectionPath] : null;
      this.activeSelectionPath = [...this.lassoPath];
      
      // Push previous path to history so undo can go back
      this.history.push({ type: 'selection', path: prevPath });

      this.lassoPath = null;
      if (this.lassoOverlay) this.lassoOverlay.remove();
      this.lassoOverlay = null;
      this.refresh();
  }

  clearSelection() {
      this.activeSelectionPath = null;
      this.floatingSelection = null;
      this.refresh();
      this._status('READY');
  }

  _applySelection() {
      if (!this.floatingSelection) return;
      
      const { canvas, x, y } = this.floatingSelection;
      const startCX = Math.floor(x / CHUNK_SIZE);
      const startCY = Math.floor(y / CHUNK_SIZE);
      const endCX = Math.floor((x + canvas.width) / CHUNK_SIZE);
      const endCY = Math.floor((y + canvas.height) / CHUNK_SIZE);

      const applyHistory = new Map();
      for (let cx = startCX; cx <= endCX; cx++) {
          for (let cy = startCY; cy <= endCY; cy++) {
              const id = `${cx},${cy}`;
              const chunk = this._getChunk(cx, cy);
              const ctx = chunk.ctxs[this.activeLayer];
              const lx = cx * CHUNK_SIZE;
              const ly = cy * CHUNK_SIZE;

              // Backup for undo
              const backup = document.createElement('canvas');
              backup.width = CHUNK_SIZE;
              backup.height = CHUNK_SIZE;
              backup.getContext('2d').drawImage(chunk.canvases[this.activeLayer], 0, 0);
              applyHistory.set(id, { layer: this.activeLayer, canvas: backup });

              ctx.drawImage(canvas, x - lx, y - ly);
              this._markDirty(id, this.activeLayer);
          }
      }

      this.history.push({ 
          type: 'stroke', 
          chunks: applyHistory,
          selection: { ...this.floatingSelection } 
      });
      this.floatingSelection = null;
      this._updateSelectionPreview();
      this.refresh();
      this._status('APPLIED');
  }

  _handlePickerMove(e) {
    if (e.altKey && !this.isDrawing) {
      const color = this.pickColor(e.clientX, e.clientY);
      this._notifyPicker(e.clientX, e.clientY, color, false);
    } else {
      this._notifyPicker(null);
    }
  }

  _notifyPicker(x, y, color, shouldSet = true) {
    const el = document.getElementById('color-picker-indicator');
    if (!x) {
      if (el) el.classList.add('hidden');
      return;
    }
    if (el) {
      el.classList.remove('hidden');
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.backgroundColor = color;
    }
    
    // Callback to main app
    if (shouldSet && this.onColorPicked) this.onColorPicked(color);
  }

  _shiftColor(hex, hDelta, lDelta) {
    // hex to hsl
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; } else {
      let d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    // Apply shifts
    h = (h + hDelta / 360) % 1;
    if (h < 0) h += 1;
    l = Math.max(0, Math.min(1, l + lDelta));

    // hsl to rgb
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    let p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3);
    const toHex = x => Math.round(x * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  _paintOnChunks(from, to, size, opacity, color) {
    const minX = Math.min(from.x, to.x) - size;
    const minY = Math.min(from.y, to.y) - size;
    const maxX = Math.max(from.x, to.x) + size;
    const maxY = Math.max(from.y, to.y) + size;

    const startCX = Math.floor(minX / CHUNK_SIZE);
    const startCY = Math.floor(minY / CHUNK_SIZE);
    const endCX = Math.floor(maxX / CHUNK_SIZE);
    const endCY = Math.floor(maxY / CHUNK_SIZE);

    for (let cx = startCX; cx <= endCX; cx++) {
      for (let cy = startCY; cy <= endCY; cy++) {
        const id = `${cx},${cy}`;
        const chunk = this._getChunk(cx, cy);
        const ctx = chunk.ctxs[this.activeLayer];
        
        // Lazy snapshot for undo
        if (this.isDrawing && !this.currentStrokeDirtyChunks.has(id)) {
            const backup = document.createElement('canvas');
            backup.width = CHUNK_SIZE;
            backup.height = CHUNK_SIZE;
            backup.getContext('2d').drawImage(chunk.canvases[this.activeLayer], 0, 0);
            this.currentStrokeDirtyChunks.set(id, { layer: this.activeLayer, canvas: backup });
        }
        
        this._markDirty(id, this.activeLayer);

        ctx.save();
        const lx = cx * CHUNK_SIZE;
        const ly = cy * CHUNK_SIZE;

        // Apply Selection Mask
        if (this.activeSelectionPath) {
            ctx.beginPath();
            this.activeSelectionPath.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p.x - lx, p.y - ly);
                else ctx.lineTo(p.x - lx, p.y - ly);
            });
            ctx.closePath();
            ctx.clip();
        }
        
        if (this.brush.type === TOOLS.ERASER) {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = `rgba(0,0,0,1)`;
        } else if (this.brush.type === TOOLS.WIREFRAME) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = color;
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = color;
        }

        ctx.globalAlpha = opacity * this.brush.flow;
        
        // Rectangular "Concept Art" Brush with texture/taper
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const dist = Math.sqrt((to.x - from.x)**2 + (to.y - from.y)**2);
        
        // Spacing based on brush size
        const step = size * this.brush.spacing;
        let currentPos = this.spacingAccumulator;

        while (currentPos <= dist) {
            const lerpVal = dist === 0 ? 0 : currentPos / dist;
            const px = Math.round(from.x + (to.x - from.x) * lerpVal - lx);
            const py = Math.round(from.y + (to.y - from.y) * lerpVal - ly);
            
            // Clean Sharp Stamping
            const s = Math.round(size);
            
            ctx.save();
            ctx.translate(px, py);
            
            if (this.brush.type === TOOLS.WIREFRAME) {
                // Round brush for wireframe as requested
                ctx.beginPath();
                ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Rectangular "Concept Art" Core stamp 
                ctx.fillRect(-s / 2, -s / 4, s, s / 2);
            }
            
            ctx.restore();
            currentPos += Math.max(0.5, step);
        }
        
        // Don't update accumulator here because _paintOnChunks is called multiple times for DIFFERENT chunks.
        // We need to keep a per-stroke accumulator in moveStroke.
        
        ctx.restore();
        this._markDirty(id, this.activeLayer);
      }
    }
  }

  importImage(img) {
    const layer = 0; // Bottom layer is image/reference
    const rect = this.container.getBoundingClientRect();
    
    // Position image in the absolute center of the world
    const worldX = (-this.pan.x + rect.width / 2) / this.zoom;
    const worldY = (-this.pan.y + rect.height / 2) / this.zoom;
    
    const drawX = worldX - img.width / 2;
    const drawY = worldY - img.height / 2;

    // Draw across all affected chunks
    const startCX = Math.floor(drawX / CHUNK_SIZE);
    const endCX = Math.floor((drawX + img.width) / CHUNK_SIZE);
    const startCY = Math.floor(drawY / CHUNK_SIZE);
    const endCY = Math.floor((drawY + img.height) / CHUNK_SIZE);

    for (let cx = startCX; cx <= endCX; cx++) {
      for (let cy = startCY; cy <= endCY; cy++) {
        const chunk = this._getChunk(cx, cy);
        const ctx = chunk.ctxs[layer];
        
        const lx = cx * CHUNK_SIZE;
        const ly = cy * CHUNK_SIZE;
        
        ctx.drawImage(img, drawX - lx, drawY - ly);
        this._markDirty(`${cx},${cy}`, layer);
      }
    }
    this.refresh();
  }

  undo() {
    if (this.history.length === 0) return;
    
    const action = this.history.pop();
    const redoAction = {
        type: action.type,
        chunks: new Map(),
        path: this.activeSelectionPath ? [...this.activeSelectionPath] : null,
        selection: this.floatingSelection ? { ...this.floatingSelection } : null
    };

    // Restore chunks
    if (action.chunks) {
        action.chunks.forEach((data, id) => {
            const chunk = this.chunks.get(id);
            if (chunk) {
                const redoBackup = document.createElement('canvas');
                redoBackup.width = CHUNK_SIZE;
                redoBackup.height = CHUNK_SIZE;
                redoBackup.getContext('2d').drawImage(chunk.canvases[data.layer], 0, 0);
                redoAction.chunks.set(id, { layer: data.layer, canvas: redoBackup });

                chunk.ctxs[data.layer].clearRect(0,0, CHUNK_SIZE, CHUNK_SIZE);
                chunk.ctxs[data.layer].drawImage(data.canvas, 0, 0);
                this._markDirty(id, data.layer);
            }
        });
    }

    // Restore Selection/Transform state
    if (action.type === 'selection') {
        this.activeSelectionPath = action.path;
    } else if (action.type === 'transform') {
        this.floatingSelection = null;
        this.activeSelectionPath = action.path;
    } else if (action.type === 'stroke') {
        if (action.selection) this.floatingSelection = action.selection;
    }

    this.redoStack.push(redoAction);
    this._updateSelectionPreview();
    this.refresh();
    this._status('UNDO');
  }

  redo() {
    if (this.redoStack.length === 0) return;
    
    const action = this.redoStack.pop();
    const undoAction = {
        type: action.type,
        chunks: new Map(),
        path: this.activeSelectionPath ? [...this.activeSelectionPath] : null,
        selection: this.floatingSelection ? { ...this.floatingSelection } : null
    };

    if (action.chunks) {
        action.chunks.forEach((data, id) => {
            const chunk = this.chunks.get(id);
            if (chunk) {
                const undoBackup = document.createElement('canvas');
                undoBackup.width = CHUNK_SIZE;
                undoBackup.height = CHUNK_SIZE;
                undoBackup.getContext('2d').drawImage(chunk.canvases[data.layer], 0, 0);
                undoAction.chunks.set(id, { layer: data.layer, canvas: undoBackup });

                chunk.ctxs[data.layer].clearRect(0,0, CHUNK_SIZE, CHUNK_SIZE);
                chunk.ctxs[data.layer].drawImage(data.canvas, 0, 0);
                this._markDirty(id, data.layer);
            }
        });
    }

    if (action.type === 'selection') {
        this.activeSelectionPath = action.path;
    } else if (action.type === 'transform') {
        this.floatingSelection = action.selection;
        this.activeSelectionPath = null;
    } else if (action.type === 'stroke') {
        if (action.selection) this.floatingSelection = null; // Re-applying stroke clears the "source" floating selection
    }

    this.history.push(undoAction);
    this._updateSelectionPreview();
    this.refresh();
    this._status('REDO');
  }

  clearLayer(index) {
      const snap = new Map();
      this.chunks.forEach((chunk, id) => {
          const backup = document.createElement('canvas');
          backup.width = CHUNK_SIZE;
          backup.height = CHUNK_SIZE;
          backup.getContext('2d').drawImage(chunk.canvases[index], 0, 0);
          snap.set(id, { layer: index, canvas: backup });
      });
      this.history.push({ type: 'stroke', chunks: snap, zoom: this.zoom, pan: { ...this.pan } });

      this.chunks.forEach((chunk, id) => {
          chunk.ctxs[index].clearRect(0, 0, CHUNK_SIZE, CHUNK_SIZE);
          this._markDirty(id, index);
      });
      this._status(`LAYER ${index} CLEARED`);
  }

  clear() {
    this.chunks.forEach((chunk, id) => {
      chunk.ctxs.forEach((ctx, index) => {
          ctx.clearRect(0,0, CHUNK_SIZE, CHUNK_SIZE);
          this._markDirty(id, index);
      });
    });
  }

  setZoom(z, cursorX = null, cursorY = null) {
    const oldZoom = this.zoom;
    this.zoom = Math.max(0.05, Math.min(20, z)); // Wider range

    if (cursorX !== null && cursorY !== null) {
        const rect = this.container.getBoundingClientRect();
        const x = cursorX - rect.left;
        const y = cursorY - rect.top;
        
        // Adjust pan to keep center under cursor
        this.pan.x = x - (this.zoom / oldZoom) * (x - this.pan.x);
        this.pan.y = y - (this.zoom / oldZoom) * (y - this.pan.y);
    }

    this.refresh();
    if (this.onZoomChange) this.onZoomChange(this.zoom);
  }

  fitZoom() {
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.refresh();
    if (this.onZoomChange) this.onZoomChange(this.zoom);
  }
}
