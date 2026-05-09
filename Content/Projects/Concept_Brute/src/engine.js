import { CHUNK_SIZE as DEFAULT_CHUNK_SIZE, LAYERS_COUNT, TOOLS } from './constants.js';

export class Engine {
  constructor(container, settings = {}) {
    this.container = container;
    this.chunkSize = settings.chunkSize || DEFAULT_CHUNK_SIZE;
    this.saveQuality = settings.quality || 0.92; // Higher default quality to avoid edge artifacts
    this.chunks = new Map(); // id -> { canvases: [canvas, canvas, canvas], ctxs: [ctx, ctx, ctx] }
    this.activeLayer = 2; // Default to second paint layer as requested
    this.currentProjectId = null;
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.rotation = 0; // In radians
    this.keys = {};
    this.lastRKeyTime = 0;
    this.isMouseDown = false;
    
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
      paintHeight: 0,
      oiliness: 0.5,
      airbrush: 0.0,
      smudgeFlowBoost: 4.5,
      smudgePickup: 1.0,
      brushSharpen: 0,
      wireDensity: 30,
      wireRange: 4.0,
      wireMinDist: 0.5,
      pressureEnabled: true,
      pressureInfluence: 1.0,
      type: TOOLS.BRUSH 
    };

    this.strokePoints = [];
    this.spacingAccumulator = 0;

    this.history = [];
    this.redoStack = [];
    this.currentStrokeDirtyChunks = new Map();

    this.layerSettings = Array.from({ length: LAYERS_COUNT }, () => ({ 
        alphaLock: false,
        visible: true
    }));
    
    this.activeSelectionPath = null;
    this.clipboard = null;
    this.floatingSelection = null;
    this.dirtyChunks = new Set(); // Tracks chunks that need persisting to storage
    this.referenceImages = [];
    this.selectedRefIndex = -1;
    this.refsDirty = false;

    this.isExportMode = false;
    this.exportRect = null;
    this.exportStartPos = null;

    this.canvasBg = '#ffffff';
    this.gridColor = '#cccccc';
    this.gridPattern = 'dots';
    this.gridSize = 20;
    this.gridIntensity = 1.0;
    this.showGrid = true;
    this.isMirrored = false;
    this.isCapturingTip = false;
    this.activePointers = new Map(); // For multitouch gestures
    this._gridTexture = null;
    this._lastGridParams = null;
    
    this.captureReticle = document.getElementById('capture-reticle');
    
    // Dedicated wrapper for all canvas content that can be mirrored
    this.canvasWrapper = document.createElement('div');
    this.canvasWrapper.id = 'canvas-wrapper';
    this.canvasWrapper.className = 'absolute';
    
    // Dedicated layer for reference images
    this.refLayer = document.createElement('div');
    this.refLayer.className = 'absolute inset-0';
    this.canvasWrapper.appendChild(this.refLayer);

    // Make wrapper larger to handle rotation without edges showing
    this.canvasWrapper.style.width = '10000px';
    this.canvasWrapper.style.height = '10000px';
    this.canvasWrapper.style.left = 'calc(50% - 5000px)';
    this.canvasWrapper.style.top = 'calc(50% - 5000px)';
    this.canvasWrapper.style.transformOrigin = '5000px 5000px';
    this.canvasWrapper.style.backgroundColor = this.canvasBg;
    this.container.appendChild(this.canvasWrapper);

    if (!this.scratchCanvas) {
        this.scratchCanvas = document.createElement('canvas');
        this.scratchCtx = this.scratchCanvas.getContext('2d', { alpha: true });
    }

    this.brushCursor = document.getElementById('brush-cursor');
    this.container.appendChild(this.brushCursor);

    this.lastPos = null;
    this.lastTime = null;
    this.smoothedVelocity = 0;
    this.zoomAnchor = null;

    this.loadViewport();
    
    // Dedicated UI Layer for overlays (Selection, Lasso, etc)
    this.uiLayer = document.createElement('div');
    this.uiLayer.className = 'absolute inset-0 pointer-events-none z-100 w-full h-full';
    this.container.appendChild(this.uiLayer);

    // Selection Viz Overlay
    this.selectionViz = document.createElement('canvas');
    this.selectionViz.className = 'absolute inset-0 pointer-events-none';
    this.uiLayer.appendChild(this.selectionViz);

    this._initEvents();
    window.addEventListener('resize', () => this.refresh());
    this._startAnimationLoop();
  }

  _startAnimationLoop() {
      const loop = () => {
          this._drawSelectionViz();
          requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
  }

  captureArea(screenX, screenY, size = 128) {
    const temp = document.createElement('canvas');
    temp.width = size;
    temp.height = size;
    const tctx = temp.getContext('2d');
    
    const m = this._getMousePos({ clientX: screenX, clientY: screenY });

    const rect = {
      x: m.wx - (size / (2 * this.zoom)),
      y: m.wy - (size / (2 * this.zoom)),
      w: size / this.zoom,
      h: size / this.zoom
    };
    
    this.chunks.forEach(chunk => {
        const chunkX = chunk.cx * this.chunkSize;
        const chunkY = chunk.cy * this.chunkSize;
        
        if (chunkX < rect.x + rect.w && chunkX + this.chunkSize > rect.x &&
            chunkY < rect.y + rect.h && chunkY + this.chunkSize > rect.y) {
            
            for (let i = 1; i < LAYERS_COUNT; i++) {
                const srcX = Math.max(0, rect.x - chunkX);
                const srcY = Math.max(0, rect.y - chunkY);
                const overlapX = Math.max(chunkX, rect.x);
                const overlapY = Math.max(chunkY, rect.y);
                const overlapW = Math.min(chunkX + this.chunkSize, rect.x + rect.w) - overlapX;
                const overlapH = Math.min(chunkY + this.chunkSize, rect.y + rect.h) - overlapY;

                if (overlapW > 0 && overlapH > 0) {
                    const dstX = (overlapX - rect.x) * this.zoom;
                    const dstY = (overlapY - rect.y) * this.zoom;
                    const dstW = overlapW * this.zoom;
                    const dstH = overlapH * this.zoom;
                    
                    tctx.drawImage(chunk.canvases[i], overlapX - chunkX, overlapY - chunkY, overlapW, overlapH, dstX, dstY, dstW, dstH);
                }
            }
        }
    });

    const imageData = tctx.getImageData(0,0,size,size);
    const data = imageData.data;
    for(let i=0; i<data.length; i+=4) {
        const grayscale = (data[i] + data[i+1] + data[i+2]) / 3;
        const alpha = 255 - grayscale;
        data[i] = 0; data[i+1] = 0; data[i+2] = 0;
        data[i+3] = Math.min(255, (alpha * data[i+3]) / 255);
    }
    tctx.putImageData(imageData, 0, 0);
    return temp;
  }

  _initEvents() {
    this.container.addEventListener('pointerdown', (e) => {
        this.activePointers.set(e.pointerId, e);

        if (this.activePointers.size > 1) {
            // Cancel current stroke if a second finger is added
            if (this.isDrawing) {
                this._endStroke();
            }
            this.isGesture = true;
            this._initGesture();
            return;
        }

        if (this.isExportMode) {
            const m = this._getMousePos(e);
            this.exportStartPos = { x: m.wx, y: m.wy };
            this.exportRect = { x: m.wx, y: m.wy, w: 0, h: 0 };
            this.isDrawing = true;
            return;
        }

        if (this.isCapturingTip) {
            const tip = this.captureArea(e.clientX, e.clientY);
            this.isCapturingTip = false;
            this.captureReticle.style.display = 'none';
            if (this.onTipCaptured) this.onTipCaptured(tip);
            return;
        }

        this.isMouseDown = true;
        if (e.button === 1 || this.keys[' ']) { // Middle click or Space
            this.isPanning = true;
            this.lastMousePos = { x: e.clientX, y: e.clientY };
            this._updateCursor();
            return;
        }
        this._startStroke(e);
    });

    window.addEventListener('pointermove', (e) => {
      this.activePointers.set(e.pointerId, e);

      if (this.activePointers.size > 1) {
          this._handleGesture();
          return;
      }

      if (this.isGesture) return;

      if (this.isExportMode && this.isDrawing) {
          const m = this._getMousePos(e);
          const x1 = this.exportStartPos.x;
          const y1 = this.exportStartPos.y;
          const x2 = m.wx;
          const y2 = m.wy;
          
          this.exportRect = {
              x: Math.min(x1, x2),
              y: Math.min(y1, y2),
              w: Math.abs(x2 - x1),
              h: Math.abs(y2 - y1)
          };
          this._updateExportReticle();
          return;
      }
      if (this.isCapturingTip) {
          this.captureReticle.style.width = '128px';
          this.captureReticle.style.height = '128px';
          this.captureReticle.style.left = (e.clientX - 64) + 'px';
          this.captureReticle.style.top = (e.clientY - 64) + 'px';
          return;
      }

      // Use coalesced events for smoother input, but cap them to prevent saturation
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      const maxEvents = 12; 
      const step = Math.max(1, Math.ceil(events.length / maxEvents));
      
      for (let i = 0; i < events.length; i += step) {
          this._moveStroke(events[i]);
      }
      
      // Always process the final event to ensure accuracy
      if ((events.length - 1) % step !== 0) {
          this._moveStroke(events[events.length - 1]);
      }

      this._handlePickerMove(e);
      this._updateBrushCursor(e);
    });

    const endHandler = (e) => {
        this.activePointers.delete(e.pointerId);
        
        if (this.activePointers.size < 2) {
            this.isGesture = false;
        }

        if (this.isExportMode && this.isDrawing) {
            this.isDrawing = false;
            this.isExportMode = false;
            this.container.classList.remove('export-mode');
            
            // Only trigger if selection has some area
            if (this.exportRect && this.exportRect.w > 4 && this.exportRect.h > 4) {
                if (this.onExportSelectionDone) this.onExportSelectionDone(this.exportRect);
            }
            this.exportRect = null;
            return;
        }
        this.isMouseDown = false;
        if (e.button === 1) {
            this.isPanning = false;
            this._updateCursor();
            return;
        }
        this._endStroke(e);
    };

    window.addEventListener('pointerup', endHandler);
    window.addEventListener('pointercancel', endHandler);
       
    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        
        if (key === 'r') {
            if (e.repeat) return;
            const now = performance.now();
            if (now - this.lastRKeyTime < 300) {
                this.setRotation(0);
                this._status('ROTATION RESET');
            }
            this.lastRKeyTime = now;
        }

        this.keys[key] = true;
        this._updateCursor();
    });
    window.addEventListener('keyup', (e) => {
        this.keys[e.key.toLowerCase()] = false;
        this._updateCursor();
    });
    
    this.container.addEventListener('wheel', (e) => {
      // Disable zoom/pan if hovering over UI panels
      if (e.target.closest('.ui-panel')) return;

      e.preventDefault();
      if (e.ctrlKey) {
        // Pan Y with Ctrl+Scroll
        this.pan.y -= e.deltaY;
        this.saveViewport();
        this.refresh();
      } else {
        // Zoom with Scroll
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.setZoom(this.zoom * delta, e.clientX, e.clientY);
      }
      this._updateCursor();
    }, { passive: false });
  }

  toggleMirror() {
    const rect = this.container.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    
    // Get current world point at screen center
    const worldCenter = this._getMousePos({ clientX: cx, clientY: cy });
    
    this.isMirrored = !this.isMirrored;
    
    // Refresh to update matrix internal state
    this.refresh();
    
    // Find where that world point is now
    const screenCenterAfter = this._worldToScreen(worldCenter.wx, worldCenter.wy);
    
    // Adjust pan to keep it exactly at center
    this.pan.x += cx - screenCenterAfter.x;
    this.pan.y += cy - screenCenterAfter.y;

    this.refresh();
    this.saveViewport();
    this._status(this.isMirrored ? 'MIRRORED' : 'NORMAL');
  }

  _getMousePos(e) {
    const rect = this.container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const world = this._screenToWorld(x, y);
    
    return {
        x: x, 
        y: y,
        wx: world.wx,
        wy: world.wy
    };
  }

  _screenToWorld(x, y) {
    const rect = this.container.getBoundingClientRect();
    const cx = Math.floor(rect.width / 2);
    const cy = Math.floor(rect.height / 2);

    const dx = x - cx - this.pan.x;
    const dy = y - cy - this.pan.y;

    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    
    let wx = (dx * cos - dy * sin) / this.zoom;
    let wy = (dx * sin + dy * cos) / this.zoom;

    if (this.isMirrored) {
        wx = -wx;
    }
    
    return { wx, wy };
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

  _markDirty(id, layer, isEmpty = false) {
      if (this.chunks.has(id)) {
          const chunk = this.chunks.get(id);
          if (chunk.isEmpty) chunk.isEmpty[layer] = isEmpty;
      }
      this.dirtyChunks.add(`${id}|${layer}`);
  }

  _getChunkCoords(x, y) {
    const pos = this._getMousePos({ clientX: x, clientY: y });
    const cx = Math.floor(pos.wx / this.chunkSize);
    const cy = Math.floor(pos.wy / this.chunkSize);
    return { cx, cy };
  }

  _getChunk(cx, cy) {
    const id = `${cx},${cy}`;
    if (this.chunks.has(id)) return this.chunks.get(id);

    const chunk = {
      cx, cy,
      canvases: [],
      ctxs: [],
      isEmpty: new Array(LAYERS_COUNT).fill(true),
      element: document.createElement('div')
    };

    chunk.element.className = 'absolute pointer-events-none'; // Removed border-white-5 which caused seams
    
    // Quality bump: use device pixel ratio for sharper drawing if requested, 
    // but for now let's just ensure clean tiling.
    const dpr = 1; // Keeping it 1 for now to avoid breaking coordinate logic, but using auto rendering
    
    for (let i = 0; i < LAYERS_COUNT; i++) {
      const canv = document.createElement('canvas');
      canv.width = this.chunkSize * dpr;
      canv.height = this.chunkSize * dpr;
      canv.className = 'absolute inset-0';
      // Smooth rendering for better brush quality (seams are handled by chunk alignment)
      canv.style.imageRendering = 'auto'; 
      canv.style.backfaceVisibility = 'hidden';
      canv.style.webkitBackfaceVisibility = 'hidden';
      chunk.element.appendChild(canv);
      chunk.canvases.push(canv);
      chunk.ctxs.push(canv.getContext('2d', { alpha: true }));
      
      // Respect visibility
      if (this.layerSettings[i] && !this.layerSettings[i].visible) {
          canv.style.display = 'none';
      }
    }

    // Per-stroke buffer
    const strokeCanv = document.createElement('canvas');
    strokeCanv.width = this.chunkSize;
    strokeCanv.height = this.chunkSize;
    strokeCanv.className = 'absolute inset-0';
    strokeCanv.style.imageRendering = 'auto';
    strokeCanv.style.backfaceVisibility = 'hidden';
    strokeCanv.style.webkitBackfaceVisibility = 'hidden';
    strokeCanv.style.opacity = '0';
    chunk.element.appendChild(strokeCanv);
    chunk.strokeCanvas = strokeCanv;
    chunk.strokeCtx = strokeCanv.getContext('2d', { alpha: true });

    this.canvasWrapper.appendChild(chunk.element);
    this.chunks.set(id, chunk);
    this._updateChunkTransform(chunk);
    return chunk;
  }

  _updateChunkTransform(chunk) {
    // Chunks are positioned at integer coordinates within the wrapper
    const x = chunk.cx * this.chunkSize + 5000;
    const y = chunk.cy * this.chunkSize + 5000;
    chunk.element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    // Slightly larger than 100% to overlap and hide fractional seams
    chunk.element.style.width = `${this.chunkSize + 1}px`;
    chunk.element.style.height = `${this.chunkSize + 1}px`;
    chunk.element.style.transformOrigin = 'top left';
  }

  _updateRefImagesTransform() {
    this.referenceImages.forEach((ref, index) => {
        if (!ref.element) return;
        const x = ref.x + 5000;
        const y = ref.y + 5000;
        
        let transform = `translate(${x}px, ${y}px) rotate(${ref.rotation}rad) scale(${ref.scale})`;
        if (ref.mirrorX) transform += ' scaleX(-1)';
        if (ref.mirrorY) transform += ' scaleY(-1)';
        
        ref.element.style.transform = transform;
        ref.element.style.transformOrigin = 'center center';
        ref.element.style.opacity = ref.opacity;
        
        if (index === this.selectedRefIndex) {
            ref.element.style.outline = '2px dashed #000';
            ref.element.style.outlineOffset = '2px';
            ref.element.style.boxShadow = '0 0 0 3px #fff';
        } else {
            ref.element.style.outline = 'none';
            ref.element.style.boxShadow = 'none';
        }
    });
  }

  refreshTransforms() {
    this.chunks.forEach(chunk => this._updateChunkTransform(chunk));
    this._updateRefImagesTransform();
    
    // Move pan and zoom to the wrapper to prevent sub-pixel gaps between chunks
    const px = Math.round(this.pan.x);
    const py = Math.round(this.pan.y);
    
    // Use container dimensions to center exactly on pixels
    const rect = this.container.getBoundingClientRect();
    const ox = Math.floor(rect.width / 2) - 5000;
    const oy = Math.floor(rect.height / 2) - 5000;
    
    this.canvasWrapper.style.left = `${ox}px`;
    this.canvasWrapper.style.top = `${oy}px`;
    
    let transform = `translate3d(${px}px, ${py}px, 0) scale(${this.zoom}) rotate(${this.rotation}rad)`;
    if (this.isMirrored) {
        transform += ' scaleX(-1)';
    }
    this.canvasWrapper.style.transform = transform;
  }

  refreshGrid() {
    this.container.style.backgroundColor = this.canvasBg;
    this.canvasWrapper.style.backgroundColor = this.canvasBg;
    
    if (this.showGrid) {
        const currentKey = `${this.gridSize}-${this.gridColor}-${this.gridIntensity}-${this.gridPattern}`;
        if (this._lastGridParams !== currentKey) {
            this._gridTexture = this._generateGridTexture();
            this._lastGridParams = currentKey;
        }

        this.canvasWrapper.style.backgroundImage = `url(${this._gridTexture})`;
        const texSize = this._gridTextureSize || 1024;
        this.canvasWrapper.style.backgroundSize = `${texSize}px ${texSize}px`;
        this.canvasWrapper.style.backgroundPosition = `5000px 5000px`;
        this.canvasWrapper.style.backgroundRepeat = 'repeat';
    } else {
        this.canvasWrapper.style.backgroundImage = 'none';
    }
  }

  _generateGridTexture() {
      const targetSize = 1024;
      const cellCount = Math.max(1, Math.round(targetSize / this.gridSize));
      const size = cellCount * this.gridSize;
      this._gridTextureSize = size;

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      
      const color = this.gridColor;
      const opacity = this.gridIntensity;
      
      let r=200, g=200, b=200;
      if (color.startsWith('#')) {
          if (color.length === 4) {
              r = parseInt(color[1] + color[1], 16);
              g = parseInt(color[2] + color[2], 16);
              b = parseInt(color[3] + color[3], 16);
          } else {
              r = parseInt(color.slice(1, 3), 16);
              g = parseInt(color.slice(3, 5), 16);
              b = parseInt(color.slice(5, 7), 16);
          }
      }
      const gridColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
      
      ctx.strokeStyle = gridColor;
      ctx.fillStyle = gridColor;
      ctx.lineWidth = 1;

      // Adjust gridSize slightly so it tiles perfectly
      const step = this.gridSize;
      
      if (this.gridPattern === 'dots') {
          const radius = Math.max(0.5, step * 0.05);
          for (let x = 0; x < cellCount; x++) {
              for (let y = 0; y < cellCount; y++) {
                  ctx.beginPath();
                  ctx.arc(x * step + step/2, y * step + step/2, radius, 0, Math.PI * 2);
                  ctx.fill();
              }
          }
      } else if (this.gridPattern === 'lines') {
          for (let i = 0; i <= cellCount; i++) {
              ctx.beginPath();
              ctx.moveTo(0, i * step);
              ctx.lineTo(size, i * step);
              ctx.stroke();
          }
      } else if (this.gridPattern === 'squares') {
          for (let i = 0; i <= cellCount; i++) {
              // Vert
              ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, size); ctx.stroke();
              // Horiz
              ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(size, i * step); ctx.stroke();
          }
      } else if (this.gridPattern === 'crosses') {
          const arm = Math.max(1, step * 0.2);
          for (let x = 0; x < cellCount; x++) {
              for (let y = 0; y < cellCount; y++) {
                  const px = x * step + step/2;
                  const py = y * step + step/2;
                  ctx.beginPath();
                  ctx.moveTo(px - arm, py); ctx.lineTo(px + arm, py);
                  ctx.stroke();
                  ctx.beginPath();
                  ctx.moveTo(px, py - arm); ctx.lineTo(px, py + arm);
                  ctx.stroke();
              }
          }
      }
      
      return canvas.toDataURL();
  }

  refresh() {
    this.refreshTransforms();
    this.refreshGrid();
    this._drawSelectionViz();
    this._updateSelectionPreview();
  }

  _worldToScreen(wx, wy) {
    const rect = this.container.getBoundingClientRect();
    const cx = Math.floor(rect.width / 2);
    const cy = Math.floor(rect.height / 2);
    
    // Mirroring is applied FIRST
    let rx = wx;
    let ry = wy;
    if (this.isMirrored) rx = -rx;

    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    
    const finalX = (rx * cos - ry * sin) * this.zoom;
    const finalY = (rx * sin + ry * cos) * this.zoom;
    
    return {
        x: cx + this.pan.x + finalX,
        y: cy + this.pan.y + finalY
    };
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
      
      const pathToShow = this.lassoPath || this.activeSelectionPath;
      
      if (pathToShow || this.isExportMode) {
          ctx.save();

          if (this.isExportMode) {
              // Draw dimming overlay
              ctx.fillStyle = 'rgba(0,0,0,0.4)';
              
              if (this.exportRect) {
                  const r = this.exportRect;
                  // Handle export rect bounds in screen space
                  // Rect is defined by two world points
                  const s1 = this._worldToScreen(r.x, r.y);
                  const s2 = this._worldToScreen(r.x + r.w, r.y + r.h);
                  
                  const sx = Math.min(s1.x, s2.x);
                  const sy = Math.min(s1.y, s2.y);
                  const sw = Math.abs(s2.x - s1.x);
                  const sh = Math.abs(s2.y - s1.y);

                  // Dim around selection
                  ctx.fillRect(0, 0, rect.width, sy);
                  ctx.fillRect(0, sy + sh, rect.width, rect.height - (sy + sh));
                  ctx.fillRect(0, sy, sx, sh);
                  ctx.fillRect(sx + sw, sy, rect.width - (sx + sw), sh);

                  // Border
                  ctx.strokeStyle = '#3b82f6';
                  ctx.setLineDash([5, 5]);
                  ctx.lineDashOffset = (Date.now() / 50) % 10;
                  ctx.lineWidth = 2;
                  ctx.strokeRect(sx, sy, sw, sh);
                  
                  ctx.strokeStyle = '#fff';
                  ctx.lineDashOffset = (Date.now() / 50) % 10 + 5;
                  ctx.strokeRect(sx, sy, sw, sh);
              } else {
                  ctx.fillRect(0, 0, rect.width, rect.height);
              }
          } else if (pathToShow) {
              ctx.strokeStyle = '#3b82f6';
              ctx.setLineDash([5, 5]);
              ctx.lineDashOffset = (Date.now() / 50) % 10;
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              
              const skip = Math.max(1, Math.floor(pathToShow.length / 500));
              pathToShow.forEach((p, i) => {
                  if (i % skip !== 0 && i !== pathToShow.length - 1) return;
                  const s = this._worldToScreen(p.x, p.y);
                  if (i === 0) ctx.moveTo(s.x, s.y);
                  else ctx.lineTo(s.x, s.y);
              });
              
              if (this.activeSelectionPath) ctx.closePath();
              ctx.stroke();
              
              ctx.strokeStyle = '#fff';
              ctx.setLineDash([5, 5]);
              ctx.lineDashOffset = (Date.now() / 50) % 10 + 5;
              ctx.stroke();
          }
          ctx.restore();
      }
  }

  _updateExportReticle() {
      // Reticle is just visual, mostly handled by _drawSelectionViz for precision
  }

  _getSelectionData(clearSource = false) {
      if (!this.activeSelectionPath) return null;
      
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      this.activeSelectionPath.forEach(p => {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
      });

      const width = Math.ceil(maxX - minX);
      const height = Math.ceil(maxY - minY);
      if (width < 1 || height < 1) return null;

      const selectionCanvas = document.createElement('canvas');
      selectionCanvas.width = width;
      selectionCanvas.height = height;
      const sCtx = selectionCanvas.getContext('2d');

      const startCX = Math.floor(minX / this.chunkSize);
      const startCY = Math.floor(minY / this.chunkSize);
      const endCX = Math.floor(maxX / this.chunkSize);
      const endCY = Math.floor(maxY / this.chunkSize);

      const affectedChunks = new Map();
      for (let cx = startCX; cx <= endCX; cx++) {
          for (let cy = startCY; cy <= endCY; cy++) {
              const id = `${cx},${cy}`;
              const chunk = this.chunks.get(id);
              if (!chunk) continue;
              const lx = cx * this.chunkSize;
              const ly = cy * this.chunkSize;

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
              
              if (clearSource) {
                  // Backup for undo
                  const backup = document.createElement('canvas');
                  backup.width = this.chunkSize;
                  backup.height = this.chunkSize;
                  backup.getContext('2d').drawImage(chunk.canvases[this.activeLayer], 0, 0);
                  affectedChunks.set(id, { layer: this.activeLayer, canvas: backup });

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
                  ctx.clearRect(0,0, this.chunkSize, this.chunkSize);
                  ctx.restore();
                  this._markDirty(id, this.activeLayer);
              }
          }
      }

      return {
          canvas: selectionCanvas,
          x: minX,
          y: minY,
          width: width,
          height: height,
          affectedChunks: affectedChunks
      };
  }

  copy() {
      const data = this._getSelectionData(false);
      if (data) {
          const clip = document.createElement('canvas');
          clip.width = data.width;
          clip.height = data.height;
          clip.getContext('2d').drawImage(data.canvas, 0, 0);
          this.clipboard = clip;
          this._status('COPIED');
          return true;
      }
      return false;
  }

  cut() {
      if (this.floatingSelection) {
          // If we already have a floating selection, "cutting" it just moves it to clipboard and clears it
          const clip = document.createElement('canvas');
          clip.width = this.floatingSelection.canvas.width;
          clip.height = this.floatingSelection.canvas.height;
          clip.getContext('2d').drawImage(this.floatingSelection.canvas, 0, 0);
          this.clipboard = clip;
          this.floatingSelection = null;
          this.refresh();
          this._updateSelectionPreview();
          this._status('CUT');
          return true;
      }

      const data = this._getSelectionData(true);
      if (data) {
          this.clipboard = data.canvas;
          this.history.push({ 
              type: 'stroke', 
              chunks: data.affectedChunks 
          });
          this.activeSelectionPath = null;
          this.refresh();
          this._status('CUT');
          if (this.onDrawEnd) this.onDrawEnd();
          return true;
      }
      return false;
  }

  paste() {
      if (!this.clipboard) return false;
      
      if (this.floatingSelection) {
          this._applySelection();
      }

      const rect = this.container.getBoundingClientRect();
      const center = this._getMousePos({ clientX: rect.left + rect.width/2, clientY: rect.top + rect.height/2 });
      
      const clip = this.clipboard;
      this.floatingSelection = {
          canvas: clip,
          x: center.wx - clip.width/2,
          y: center.wy - clip.height/2,
          width: clip.width,
          height: clip.height,
          opacity: 1,
          scale: 1,
          rotation: 0,
          mirrorX: false,
          mirrorY: false
      };

      this.activeSelectionPath = null;
      this.refresh();
      this._updateSelectionPreview();
      this._status('TRANSFORMING');
      return true;
  }

  startTransform() {
      if (!this.activeSelectionPath) return;
      this._status('TRANSFORMING');
      
      const data = this._getSelectionData(true);
      if (!data) return;

      this.floatingSelection = {
          canvas: data.canvas,
          x: data.x,
          y: data.y,
          width: data.width,
          height: data.height,
          opacity: 1,
          scale: 1,
          rotation: 0,
          mirrorX: false,
          mirrorY: false
      };

      this.history.push({ 
          type: 'transform', 
          chunks: data.affectedChunks, 
          path: this.activeSelectionPath,
          selection: { ...this.floatingSelection }
      });

      this.activeSelectionPath = null;
      this._updateSelectionPreview();
      this.refresh();
      if (this.onDrawEnd) this.onDrawEnd();
  }

  deleteSelection() {
      if (!this.activeSelectionPath) return;
      
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      this.activeSelectionPath.forEach(p => {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
      });

      const startCX = Math.floor(minX / this.chunkSize);
      const startCY = Math.floor(minY / this.chunkSize);
      const endCX = Math.floor(maxX / this.chunkSize);
      const endCY = Math.floor(maxY / this.chunkSize);

      const deleteHistory = new Map();
      for (let cx = startCX; cx <= endCX; cx++) {
          for (let cy = startCY; cy <= endCY; cy++) {
              const id = `${cx},${cy}`;
              const chunk = this.chunks.get(id);
              if (!chunk) continue;
              const lx = cx * this.chunkSize;
              const ly = cy * this.chunkSize;

              // Backup for undo
              const backup = document.createElement('canvas');
              backup.width = this.chunkSize;
              backup.height = this.chunkSize;
              backup.getContext('2d').drawImage(chunk.canvases[this.activeLayer], 0, 0);
              deleteHistory.set(id, { layer: this.activeLayer, canvas: backup });

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
              ctx.clearRect(0,0, this.chunkSize, this.chunkSize);
              ctx.restore();
              this._markDirty(id, this.activeLayer);
          }
      }

      this.history.push({ 
          type: 'stroke', // Reusing stroke type since it handles chunk Map history
          chunks: deleteHistory
      });

      this.clearSelection();
      this.refresh();
      this._status('DELETED');
      if (this.onDrawEnd) this.onDrawEnd();
  }

  _status(text) {
      if (this.onStatus) this.onStatus(text);
  }

  pickColor(x, y) {
    const m = this._getMousePos({ clientX: x, clientY: y });
    const wx = m.wx;
    const wy = m.wy;

    if (!this._pickerCanvas) {
      this._pickerCanvas = document.createElement('canvas');
      this._pickerCanvas.width = 1;
      this._pickerCanvas.height = 1;
      // using willReadFrequently: true is key for GPU->CPU readback performance
      this._pickerCtx = this._pickerCanvas.getContext('2d', { willReadFrequently: true });
    }
    
    const pctx = this._pickerCtx;
    pctx.imageSmoothingEnabled = false;
    pctx.clearRect(0, 0, 1, 1);
    
    // 1. Fill with background
    pctx.fillStyle = this.canvasBg || '#ffffff';
    pctx.fillRect(0, 0, 1, 1);

    // 2. Draw reference images (bottom to top)
    for (let i = 0; i < this.referenceImages.length; i++) {
        const ref = this.referenceImages[i];
        const dx = wx - ref.x;
        const dy = wy - ref.y;
        const cos = Math.cos(-ref.rotation);
        const sin = Math.sin(-ref.rotation);
        let lx = dx * cos - dy * sin;
        let ly = dx * sin + dy * cos;
        lx /= ref.scale;
        ly /= ref.scale;
        if (ref.mirrorX) lx = -lx;
        if (ref.mirrorY) ly = -ly;

        const imgX = lx + ref.img.width / 2;
        const imgY = ly + ref.img.height / 2;

        if (imgX >= 0 && imgX < ref.img.width && imgY >= 0 && imgY < ref.img.height) {
            pctx.save();
            pctx.globalAlpha = ref.opacity;
            // Draw 1x1 to scratch to get pixel
            pctx.drawImage(ref.img, Math.floor(imgX), Math.floor(imgY), 1, 1, 0, 0, 1, 1);
            pctx.restore();
        }
    }
    
    // 3. Draw paint layers (bottom to top)
    const cx = Math.floor(wx / this.chunkSize);
    const cy = Math.floor(wy / this.chunkSize);
    const chunk = this.chunks.get(`${cx},${cy}`);

    if (chunk) {
        const lx = Math.floor(wx - cx * this.chunkSize);
        const ly = Math.floor(wy - cy * this.chunkSize);
        if (lx >= 0 && lx < this.chunkSize && ly >= 0 && ly < this.chunkSize) {
            for (let i = 1; i < LAYERS_COUNT; i++) {
                pctx.drawImage(chunk.canvases[i], lx, ly, 1, 1, 0, 0, 1, 1);
            }
        }
    }

    const data = pctx.getImageData(0, 0, 1, 1).data;
    const r = data[0].toString(16).padStart(2, '0');
    const g = data[1].toString(16).padStart(2, '0');
    const b = data[2].toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }

  _startStroke(e) {
    this.lastMousePos = { x: e.clientX, y: e.clientY };

    if (this.isExportMode) return;

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
    
    if (this.keys['z'] || this.isZoomingMode || this.keys['r']) {
        this.isZooming = this.keys['z'] || this.isZoomingMode;
        this.transformAnchor = { x: e.clientX, y: e.clientY };
        this.lastMousePos = { x: e.clientX, y: e.clientY };
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

    if (this.brush.type === TOOLS.REF_MOVE) {
        const m = this._getMousePos(e);
        if (this.selectReferenceAt(m.wx, m.wy)) {
            this.isDrawing = true;
            this.lastMousePos = { x: e.clientX, y: e.clientY };
            if (this.onDrawStart) this.onDrawStart();
            return;
        } else {
            this.selectedRefIndex = -1;
            this.refresh();
            return; // STOP HERE, don't start painting
        }
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
            if (this.onDrawStart) this.onDrawStart();
            this.isDrawing = true;
            this.lastMousePos = { x: e.clientX, y: e.clientY };
            return;
        } else {
            // Click outside selection: apply it
            this._applySelection();
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

    if (this.onDrawStart) this.onDrawStart();
    this.isDrawing = true;
    const m = this._getMousePos(e);
    this.lastPos = { x: m.x, y: m.y };
    this.lastWorldPos = { x: m.wx, y: m.wy };
    this.lastTime = e.timeStamp || performance.now();
    this.smoothedVelocity = 0;
    
    // Improved pressure detection (default to 1.0 for mouse, use raw for pen)
    let pressure = 1.0;
    if (e.pointerType === 'pen' || e.pointerType === 'touch') {
        // If pressure is 0 or 0.5 (neutral/unsupported), we use a sensible starting floor (0.15)
        // to avoid tiny first-stamp artifacts while still feeling responsive.
        pressure = (e.pressure !== undefined && e.pressure !== 0 && e.pressure !== 0.5) ? e.pressure : 0.15;
    }
    
    // Size modulated by initial pressure
    let initSize = this.brush.size;
    if (e.pointerType === 'pen' || e.pointerType === 'touch') {
        initSize *= (0.2 + pressure * 0.8);
    }

    const worldPos = {
        x: m.wx,
        y: m.wy,
        size: initSize,
        opacity: (0.3 + pressure * 0.7),
        pressure: pressure,
        color: this.brush.color
    };
    this.strokePoints = [worldPos];
    this.lastDynamicSize = initSize;
    this.lastDynamicOpac = worldPos.opacity;
    this.lastPressure = pressure;
    
    this.spacingAccumulator = 0;
    this.shiftOrigin = null;
    this.shiftLockAxis = null;

    if (this.brush.type === TOOLS.SMUDGE) {
        this.smudgeDirty = false;
    }
    
    // Clear dirty chunks tracking for this stroke
    this.currentStrokeDirtyChunks = new Map();
    this._clearStack(this.redoStack);
  }

  _moveStroke(e) {
    if (this.isDrawing && this.onDrawMove) this.onDrawMove();

    if (this.isPanning || (this.keys['r'] && this.isMouseDown)) {
        let dx = e.clientX - this.lastMousePos.x;
        let dy = e.clientY - this.lastMousePos.y;
        
        if (this.keys['r']) {
            // Rotate
            const rect = this.container.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            
            // Calculate rotation angle relative to center
            const a1 = Math.atan2(this.lastMousePos.y - cy, this.lastMousePos.x - cx);
            const a2 = Math.atan2(e.clientY - cy, e.clientX - cx);
            
            // Pivot around the point where they first pressed
            const anchor = this.transformAnchor || { x: cx, y: cy };
            this.setRotation(this.rotation + (a2 - a1), anchor.x, anchor.y);
        } else {
            // Pan
            const dx = e.clientX - this.lastMousePos.x;
            const dy = e.clientY - this.lastMousePos.y;
            
            this.pan.x += dx;
            this.pan.y += dy;
            this.saveViewport();
        }
        
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
        
        this.setZoom(newZoom, this.transformAnchor.x, this.transformAnchor.y);
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        return;
    }

    if (this.floatingSelection && this.isDrawing) {
        const sel = this.floatingSelection;
        const m1 = this._getMousePos({ clientX: this.lastMousePos.x, clientY: this.lastMousePos.y });
        const m2 = this._getMousePos(e);
        const dwx = m2.wx - m1.wx;
        const dwy = m2.wy - m1.wy;

        if (this.keys['t']) {
            // T + Drag: Opacity
            const dy = e.clientY - this.lastMousePos.y;
            const opDelta = -dy * 0.01;
            sel.opacity = Math.max(0, Math.min(1, (sel.opacity !== undefined ? sel.opacity : 1) + opDelta));
            this._status(`OPACITY: ${Math.round(sel.opacity * 100)}%`);
        } else if (this.keys['shift']) {
            // Scale
            const dy = e.clientY - this.lastMousePos.y;
            const factor = 1 + dy * 0.01;
            sel.scale = (sel.scale || 1) * factor;
        } else if (this.keys['alt'] || this.keys['control']) {
            // Rotate (5x slower sensitivity as requested)
            const dx = e.clientX - this.lastMousePos.x;
            const factor = dx * 0.01;
            sel.rotation = (sel.rotation || 0) + factor;
        } else {
            // Move using world space deltas
            sel.x += dwx;
            sel.y += dwy;
        }
        
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        this._updateSelectionPreview();
        return;
    }

    if (this.brush.type === TOOLS.REF_MOVE && this.isDrawing && this.selectedRefIndex !== -1) {
        const sel = this.referenceImages[this.selectedRefIndex];
        const m1 = this._getMousePos({ clientX: this.lastMousePos.x, clientY: this.lastMousePos.y });
        const m2 = this._getMousePos(e);
        const dwx = m2.wx - m1.wx;
        const dwy = m2.wy - m1.wy;

        if (this.keys['t']) {
            const dy = e.clientY - this.lastMousePos.y;
            const opDelta = -dy * 0.01;
            sel.opacity = Math.max(0, Math.min(1, (sel.opacity !== undefined ? sel.opacity : 1) + opDelta));
            this._status(`OPACITY: ${Math.round(sel.opacity * 100)}%`);
        } else if (this.keys['shift']) {
            const dy = e.clientY - this.lastMousePos.y;
            const factor = 1 + dy * 0.01;
            sel.scale = (sel.scale || 1) * factor;
        } else if (this.keys['alt'] || this.keys['control']) {
            const dx = e.clientX - this.lastMousePos.x;
            const factor = dx * 0.01;
            sel.rotation = (sel.rotation || 0) + factor;
        } else if (this.keys['b']) { // Mirror hotkey while dragging
            // This might be better as a toggle on keydown, but let's see
        } else {
            sel.x += dwx;
            sel.y += dwy;
        }
        
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        this.refresh();
        return;
    }

    if (!this.isDrawing) return;
    
    const m = this._getMousePos(e);
    let currentPos = { x: m.x, y: m.y };

    // Shift Constraint
    if ((this.keys['shift'] || e.shiftKey) && this.lastPos) {
        if (!this.shiftOrigin) {
            this.shiftOrigin = { ...this.lastPos };
            this.shiftLockAxis = null;
        }

        const dx = currentPos.x - this.shiftOrigin.x;
        const dy = currentPos.y - this.shiftOrigin.y;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        const tolerance = 4; 
        if (!this.shiftLockAxis) {
            if (absX > tolerance || absY > tolerance) {
                this.shiftLockAxis = absX > absY ? 'x' : 'y';
            }
        }

        if (this.shiftLockAxis === 'x') {
            currentPos.y = this.shiftOrigin.y;
        } else if (this.shiftLockAxis === 'y') {
            currentPos.x = this.shiftOrigin.x;
        } else {
            currentPos.x = this.shiftOrigin.x;
            currentPos.y = this.shiftOrigin.y;
        }
        
        // Update world coordinates based on the constrained screen coordinates
        const constrainedWorld = this._screenToWorld(currentPos.x, currentPos.y);
        m.wx = constrainedWorld.wx;
        m.wy = constrainedWorld.wy;
    } else {
        this.shiftOrigin = null;
        this.shiftLockAxis = null;
    }

    if (this.brush.type === TOOLS.LASSO) {
        this._drawLasso(this.lastPos, currentPos);
        this.lastPos = currentPos;
        return;
    }

    const currentTime = e.timeStamp || performance.now();
    let pressure = 1.0;
    if (e.pointerType === 'pen' || e.pointerType === 'touch') {
        pressure = (e.pressure !== undefined && e.pressure !== 0 && e.pressure !== 0.5) ? e.pressure : (this.lastPressure || 0.15);
    }
    this.lastPressure = (this.lastPressure || pressure) * 0.7 + pressure * 0.3;

    const dx = currentPos.x - this.lastPos.x;
    const dy = currentPos.y - this.lastPos.y;
    const dt = Math.max(0.1, currentTime - this.lastTime); // Prevent division by zero or extreme near-zero
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Prevent artifacts from jitter (very small movements)
    if (dist < 0.1) return;
    
    // Raw velocity
    const rawVelocity = dist / dt;
    
    // Smooth velocity to prevent wild jumps (Exponential Moving Average)
    this.smoothedVelocity = this.smoothedVelocity * 0.8 + rawVelocity * 0.2;
    
    // Clamp smoothed velocity to avoid outliers - increased to 2000 for fast gestures
    const velocity = Math.min(this.smoothedVelocity, 2000); 

    const worldTo = {
      x: m.wx,
      y: m.wy
    };

    // --- Brush Sensitivity ---
    const threshold = 10 + (this.brush.flow * 40); 
    const vFactor = Math.pow(Math.min(velocity / threshold, 1.5), 1.2); 
    
    const sensitivityMult = 2.0; 
    
    // Size: positive speedSize means faster=smaller. Add pressure influence.
    const sizeMod = 1 - (vFactor * this.brush.speedSize * sensitivityMult); 
    let dynamicSize = this.brush.size * Math.max(0.05, sizeMod);
    
    if (this.brush.pressureEnabled && (e.pointerType === 'pen' || e.pointerType === 'touch')) {
        const inf = this.brush.pressureInfluence ?? 1.0;
        dynamicSize *= ( (1 - inf) + this.lastPressure * inf );
    }
    
    // Opacity: positive speedOpacity means faster=transparent. Add pressure influence.
    const opacBase = 1 - (vFactor * this.brush.speedOpacity * sensitivityMult);
    let opacMod = Math.max(0.01, opacBase);
    
    if (this.brush.pressureEnabled && (e.pointerType === 'pen' || e.pointerType === 'touch')) {
        const inf = this.brush.pressureInfluence ?? 1.0;
        opacMod *= ( (1 - inf) + this.lastPressure * inf );
    }

    let color = this.brush.color;
    if (this.brush.speedValue !== 0 || this.brush.speedHue !== 0) {
        color = this._shiftColor(color, vFactor * this.brush.speedHue * 60, -vFactor * (this.brush.speedValue / 5)); 
    }

    const worldPos = {
        ...worldTo,
        size: dynamicSize,
        opacity: opacMod,
        color: color,
        pressure: pressure
    };

    if (this.brush.type === TOOLS.WIREFRAME) {
        // Point density normalization: only store points if we moved significantly in world space
        // This fixes the "stylus has 10x points in same area" issue
        const lastP = this.strokePoints[this.strokePoints.length - 1];
        const worldDist = Math.sqrt((worldPos.x - lastP.x)**2 + (worldPos.y - lastP.y)**2);
        
        // Minimal distance between points in buffer (e.g., 2 pixels at size 20)
        const minBufferDist = Math.max(1, dynamicSize * 0.1);
        
        if (worldDist > minBufferDist) {
            this.strokePoints.push(worldPos);
        }

        const from = this.lastWorldPos || worldTo;
        this._paintOnChunks(from, worldTo, Math.max(1, dynamicSize * 0.1), opacMod, color);
        
        const thresholdMax = dynamicSize * (this.brush.wireRange ?? 4.0);
        const thresholdMin = dynamicSize * (this.brush.wireMinDist ?? 0.5);
        const points = this.strokePoints;
        const count = points.length;
        const maxSeek = this.brush.wireDensity ?? 30;
        
        for (let i = Math.max(0, count - maxSeek); i < count - 1; i++) {
            const p = points[i];
            const d = Math.sqrt((p.x - worldTo.x)**2 + (p.y - worldTo.y)**2);
            if (d > thresholdMin && d < thresholdMax) {
                this._paintOnChunks(p, worldTo, 1, opacMod * 0.2, color);
            }
        }
    } else {
        this.strokePoints.push(worldPos);
        
        if (this.strokePoints.length === 2) {
            // First segment: P0 -> Mid(P0, P1)
            const p0 = this.strokePoints[0];
            const mid = { x: (p0.x + worldPos.x) / 2, y: (p0.y + worldPos.y) / 2 };
            this._paintOnChunks(p0, mid, p0.size, p0.opacity, p0.color);
        } else if (this.strokePoints.length > 2) {
            // Curve from Mid(P_n-2, P_n-1) to Mid(P_n-1, P_n) with P_n-1 as control
            const p_n2 = this.strokePoints[this.strokePoints.length - 3];
            const p_n1 = this.strokePoints[this.strokePoints.length - 2];
            const p_n = this.strokePoints[this.strokePoints.length - 1];
            
            const mid1 = { x: (p_n2.x + p_n1.x) / 2, y: (p_n2.y + p_n1.y) / 2 };
            const mid2 = { x: (p_n1.x + p_n.x) / 2, y: (p_n1.y + p_n.y) / 2 };
            
            this._paintCurveOnChunks(mid1, p_n1, mid2, p_n1.size, p_n.size, p_n1.opacity, p_n.opacity, p_n.color);
        }
    }
    
    this.lastPos = currentPos;
    this.lastWorldPos = worldTo;
    this.lastTime = currentTime;
  }

  _endStroke() {
    // Finish last part of smoothed curve
    if (this.isDrawing && this.brush.type !== TOOLS.LASSO && this.strokePoints.length > 1 && this.brush.type !== TOOLS.WIREFRAME) {
        const p_last = this.strokePoints[this.strokePoints.length - 1];
        const p_prev = this.strokePoints[this.strokePoints.length - 2];
        const mid = { x: (p_last.x + p_prev.x) / 2, y: (p_last.y + p_prev.y) / 2 };
        this._paintOnChunks(mid, p_last, p_last.size, p_last.opacity, p_last.color);
    }
    if (this.brush.type === TOOLS.LASSO && this.lassoPath?.length > 10) {
        this._processLassoSelection();
    }

    // Bake per-stroke buffer
    if (this.brush.type !== TOOLS.ERASER && this.brush.type !== TOOLS.SMUDGE) {
        this.currentStrokeDirtyChunks.forEach((data, id) => {
            const chunk = this.chunks.get(id);
            if (chunk) {
                const ctx = chunk.ctxs[this.activeLayer];
                const lx = chunk.cx * this.chunkSize;
                const ly = chunk.cy * this.chunkSize;

                ctx.save();
                
                // Clip bake to selection if active
                if (this.activeSelectionPath) {
                    ctx.beginPath();
                    this.activeSelectionPath.forEach((p, i) => {
                        if (i === 0) ctx.moveTo(p.x - lx, p.y - ly);
                        else ctx.lineTo(p.x - lx, p.y - ly);
                    });
                    ctx.closePath();
                    ctx.clip();
                }

                ctx.globalAlpha = this.brush.opacity; // Per-stroke opacity from UI
                
                const layerSet = this.layerSettings[this.activeLayer];
                if (layerSet && layerSet.alphaLock) {
                    ctx.globalCompositeOperation = 'source-atop';
                } else {
                    ctx.globalCompositeOperation = 'source-over';
                }

                ctx.drawImage(chunk.strokeCanvas, 0, 0);
                ctx.restore();

                // Clear stroke buffer for next stroke
                chunk.strokeCtx.clearRect(0, 0, this.chunkSize, this.chunkSize);
                chunk.strokeCanvas.style.opacity = '0';
            }
        });
    } else {
        // Just clear stroke buffers just in case, though they shouldn't have been used
        this.currentStrokeDirtyChunks.forEach((data, id) => {
            const chunk = this.chunks.get(id);
            if (chunk) {
                chunk.strokeCtx.clearRect(0, 0, this.chunkSize, this.chunkSize);
                chunk.strokeCanvas.style.opacity = '0';
            }
        });
    }

    // Store the dirty chunks as a history state
    if (this.currentStrokeDirtyChunks.size > 0) {
        this.history.push({
            type: 'stroke',
            chunks: this.currentStrokeDirtyChunks,
            zoom: this.zoom,
            pan: { ...this.pan }
        });
        if (this.history.length > 50) { // Increased history slightly but with disposal
            const oldest = this.history.shift();
            this._disposeAction(oldest);
        }
    }
    
    if (this.brush.type === TOOLS.REF_MOVE) {
        this.refsDirty = true;
    }
    
    if (this.onDrawEnd && this.isDrawing) this.onDrawEnd();
    
    this.isDrawing = false;
    this.isPanning = false;
    this.isZooming = false;
    this.lastPos = null;
    this.lassoPath = null;
    this.shiftOrigin = null;
    this.shiftLockAxis = null;
    this._status('READY');
  }

  _updateBrushCursor(e) {
    if (!this.brushCursor) return;

    // Clear cursor on touch if no pointers are touching
    if (this.activePointers.size === 0 && (e.pointerType === 'touch' || e.pointerType === 'pen')) {
        this.brushCursor.style.display = 'none';
        return;
    }

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
    let bgColor = this.brush.color;
    let border = '1px solid rgba(0, 0, 0, 0.4)';
    let mask = 'none';

    this.brushCursor.innerHTML = '';

    if (this.isExportMode) {
        w = 32; h = 32;
        bgColor = 'transparent';
        border = '2px solid #000';
        br = '0';
        mask = 'none';
        this.brushCursor.innerHTML = '<div style="position:absolute;top:50%;left:0;right:0;height:1px;background:rgba(0,0,0,0.5)"></div><div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(0,0,0,0.5)"></div><div style="position:absolute;top:0;left:0;width:4px;height:4px;border-top:2px solid black;border-left:2px solid black"></div><div style="position:absolute;bottom:0;right:0;width:4px;height:4px;border-bottom:2px solid black;border-right:2px solid black"></div>';
    } else if (this.brush.type === TOOLS.WIREFRAME) {
        br = '50%';
        bgColor = 'transparent';
    } else if (this.brush.type === TOOLS.BRUSH) {
        h = s / 2;
        if (this.brush.tip) {
            h = s; // Tips are 1:1 usually
            mask = `url(${this.brush.tip.toDataURL()})`;
        }
    } else if (this.brush.type === TOOLS.ERASER || this.brush.type === TOOLS.SMUDGE) {
        h = s / 2;
        bgColor = 'transparent';
        border = this.brush.type === TOOLS.ERASER ? '2px solid #ff4444' : '2px solid #3b82f6';
        if (this.brush.tip) {
            h = s;
            mask = `url(${this.brush.tip.toDataURL()})`;
            bgColor = this.brush.type === TOOLS.ERASER ? 'rgba(255, 68, 68, 0.25)' : 'rgba(59, 130, 246, 0.25)';
        }
    } else if (this.brush.type === TOOLS.REF_MOVE) {
        w = 24;
        h = 24;
        bgColor = 'rgba(59, 130, 246, 0.4)';
        border = '2px solid #fff';
        br = '2px';
        mask = 'none';
        this.brushCursor.innerHTML = '<div style="position:absolute;top:50%;left:5px;right:5px;height:2px;background:white;transform:translateY(-50%)"></div><div style="position:absolute;left:50%;top:5px;bottom:5px;width:2px;background:white;transform:translateX(-50%)"></div>';
    } else if (this.brush.type === TOOLS.LASSO) {
        w = 10;
        h = 10;
        br = '50%';
        bgColor = 'transparent';
        border = '1px solid black';
    }

    this.brushCursor.style.width = `${w}px`;
    this.brushCursor.style.height = `${h}px`;
    this.brushCursor.style.borderRadius = br;
    this.brushCursor.style.backgroundColor = bgColor;
    this.brushCursor.style.border = border;
    this.brushCursor.style.webkitMaskImage = mask;
    this.brushCursor.style.webkitMaskSize = '100% 100%';
    this.brushCursor.style.maskImage = mask;
    this.brushCursor.style.maskSize = '100% 100%';

    // Position relative to container
    let mouseX = e.clientX - rect.left;
    let mouseY = e.clientY - rect.top;

    this.brushCursor.style.left = `${mouseX - w/2}px`;
    this.brushCursor.style.top = `${mouseY - h/2}px`;
    
    let transform = `rotate(${this.rotation}rad)`;
    if (this.isMirrored) {
        transform += ' scaleX(-1)';
    }
    this.brushCursor.style.transform = transform;
  }

  _drawLasso(from, to) {
      if (!this.lassoPath) {
          this.lassoPath = [];
      }
      const m = this._getMousePos({ clientX: to.x + this.container.getBoundingClientRect().left, clientY: to.y + this.container.getBoundingClientRect().top });
      this.lassoPath.push({ x: m.wx, y: m.wy });
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

      const rect = this.container.getBoundingClientRect();
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
      
      // pivot point calculation in screen space
      const s = this._worldToScreen(sel.x + sel.canvas.width / 2, sel.y + sel.canvas.height / 2);
      
      let rot = (sel.rotation || 0);
      const sc = (sel.scale || 1);
      const displayScale = sc * this.zoom;
      const opacity = (sel.opacity !== undefined ? sel.opacity : 1);
      
      let mirrorX = sel.mirrorX ? -1 : 1;
      let mirrorY = sel.mirrorY ? -1 : 1;
      
      let finalRot = rot + this.rotation;
      if (this.isMirrored) {
          mirrorX *= -1;
          finalRot = -finalRot;
      }

      this.selectionOverlay.style.left = '0px';
      this.selectionOverlay.style.top = '0px';
      this.selectionOverlay.style.transformOrigin = 'center center';
      // Center on pivot, then rotate and scale
      this.selectionOverlay.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%) rotate(${finalRot}rad) scale(${displayScale * mirrorX}, ${displayScale * mirrorY})`;
      this.selectionOverlay.style.opacity = opacity;
      
      // Update info status
      this._status(`TRANSFORM: ${Math.round(sc * 100)}% | ${Math.round(rot * 180 / Math.PI)}° | OPACITY: ${Math.round(opacity * 100)}%`);
  }

  removeReferenceImage(index) {
      if (index >= 0 && index < this.referenceImages.length) {
          const ref = this.referenceImages[index];
          if (ref.element) ref.element.remove();
          this.referenceImages.splice(index, 1);
          this.refsDirty = true;
          if (this.selectedRefIndex === index) {
              this.selectedRefIndex = this.referenceImages.length - 1;
          } else if (this.selectedRefIndex > index) {
              this.selectedRefIndex--;
          }
          this.refresh();
      }
  }

  extractPaletteFromRef(index) {
      const ref = this.referenceImages[index];
      if (!ref) return Promise.resolve();
      
      return new Promise((resolve) => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = 128;
          canvas.height = 128;
          ctx.drawImage(ref.img, 0, 0, 128, 128);
          const data = ctx.getImageData(0, 0, 128, 128).data;
          
          const candidates = [];
          for (let i = 0; i < data.length; i += 4 * 4) {
              const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
              if (a < 220) continue;
              const lum = 0.299 * r + 0.587 * g + 0.114 * b;
              candidates.push({ color: [r, g, b], lum });
          }

          // Categorize into 3 buckets
          const lights = candidates.filter(c => c.lum >= 170).sort((a,b) => b.lum - a.lum);
          const shadows = candidates.filter(c => c.lum <= 85).sort((a,b) => a.lum - b.lum);
          const mids = candidates.filter(c => c.lum > 85 && c.lum < 170).sort((a,b) => Math.abs(128 - a.lum) - Math.abs(128 - b.lum));

          const getUnique = (source, count, threshold) => {
              const result = [];
              for (const cand of source) {
                  if (!result.some(r => {
                      return Math.sqrt(Math.pow(r[0]-cand.color[0], 2) + Math.pow(r[1]-cand.color[1], 2) + Math.pow(r[2]-cand.color[2], 2)) < threshold;
                  })) {
                      result.push(cand.color);
                  }
                  if (result.length >= count) break;
              }
              return result;
          };

          const extractedLights = getUnique(lights, 4, 30);
          const extractedMids = getUnique(mids, 4, 30);
          const extractedShadows = getUnique(shadows, 4, 30);

          while (extractedLights.length < 4 && lights.length > extractedLights.length) extractedLights.push(lights[extractedLights.length].color);
          while (extractedMids.length < 4 && mids.length > extractedMids.length) extractedMids.push(mids[extractedMids.length].color);
          while (extractedShadows.length < 4 && shadows.length > extractedShadows.length) extractedShadows.push(shadows[extractedShadows.length].color);

          const colorToLum = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
          extractedLights.sort((a,b) => colorToLum(b) - colorToLum(a));

          const final12 = [...extractedLights, ...extractedMids, ...extractedShadows];
          final12.sort((a,b) => colorToLum(b) - colorToLum(a)); 

          const colorArray = final12.map(c => {
              return `#${((1 << 24) + (c[0] << 16) + (c[1] << 8) + c[2]).toString(16).slice(1).toUpperCase()}`;
          });
          
          // Store on ref
          ref.extractedPalette = colorArray;
          
          const swatchCanvas = document.createElement('canvas');
          const sCtx = swatchCanvas.getContext('2d');
          swatchCanvas.width = colorArray.length * 20; 
          swatchCanvas.height = 20;
          
          colorArray.forEach((c, i) => {
              sCtx.fillStyle = c;
              sCtx.fillRect(i * 20, 0, 20, 20);
          });
          
          const swatchImg = new Image();
          swatchImg.onload = () => {
              const x = ref.x;
              const y = ref.y - (ref.img.height * ref.scale / 2) - 15;
              this.addReferenceImage(swatchImg, `Palette: ${ref.name}`, x, y);
              this.refresh();
              this._status('PALETTE EXTRACTED (12 VALUES)');
              if (this.onPaletteExtracted) this.onPaletteExtracted(colorArray);
              resolve();
          };
          swatchImg.src = swatchCanvas.toDataURL();
      });
  }

  cropRefImage(index) { this._status('CROP TOOL ACTIVE (WIP)'); }
  knifeRefImage(index) { this._status('KNIFE TOOL ACTIVE (WIP)'); }
  colorCorrectRefImage(index) { this._status('COLOR TOOLS ACTIVE (WIP)'); }

  _processLassoSelection() {
      if (!this.lassoPath || this.lassoPath.length < 3) {
          this.lassoPath = null;
          this.refresh();
          return;
      }
      const prevPath = this.activeSelectionPath ? [...this.activeSelectionPath] : null;
      this.activeSelectionPath = [...this.lassoPath];
      
      // Push previous path to history so undo can go back
      this.history.push({ type: 'selection', path: prevPath });

      this.lassoPath = null;
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
      
      const sel = this.floatingSelection;
      const { canvas, x, y, rotation, scale, opacity, mirrorX, mirrorY } = sel;
      const rot = rotation || 0;
      const sc = scale || 1;
      const op = opacity !== undefined ? opacity : 1;
      
      // Calculate bounding box for rotated/scaled canvas to find relevant chunks
      const cos = Math.abs(Math.cos(rot));
      const sin = Math.abs(Math.sin(rot));
      const bbW = (canvas.width * sc * cos + canvas.height * sc * sin);
      const bbH = (canvas.width * sc * sin + canvas.height * sc * cos);

      const startCX = Math.floor((x + canvas.width / 2 - bbW / 2) / this.chunkSize);
      const startCY = Math.floor((y + canvas.height / 2 - bbH / 2) / this.chunkSize);
      const endCX = Math.floor((x + canvas.width / 2 + bbW / 2) / this.chunkSize);
      const endCY = Math.floor((y + canvas.height / 2 + bbH / 2) / this.chunkSize);

      const applyHistory = new Map();
      for (let cx = startCX; cx <= endCX; cx++) {
          for (let cy = startCY; cy <= endCY; cy++) {
              const id = `${cx},${cy}`;
              const chunk = this._getChunk(cx, cy);
              const ctx = chunk.ctxs[this.activeLayer];
              const lx = cx * this.chunkSize;
              const ly = cy * this.chunkSize;

              // Backup for undo
              if (!applyHistory.has(id)) {
                const backup = document.createElement('canvas');
                backup.width = this.chunkSize;
                backup.height = this.chunkSize;
                backup.getContext('2d').drawImage(chunk.canvases[this.activeLayer], 0, 0);
                applyHistory.set(id, { layer: this.activeLayer, canvas: backup });
              }

              ctx.save();
              // Pivot around the center of the selection in world space
              const worldPivotX = x + canvas.width / 2;
              const worldPivotY = y + canvas.height / 2;
              
              ctx.translate(worldPivotX - lx, worldPivotY - ly);
              ctx.rotate(rot);
              ctx.scale(sc * (mirrorX ? -1 : 1), sc * (mirrorY ? -1 : 1));
              ctx.globalAlpha = op;
              // Draw centered at the pivot
              ctx.drawImage(canvas, -canvas.width/2, -canvas.height/2);
              ctx.restore();
              
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
      if (this.onDrawEnd) this.onDrawEnd();
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

  _paintCurveOnChunks(p0, p1, p2, size1, size2, opac1, opac2, color) {
      const dist = Math.sqrt((p1.x - p0.x)**2 + (p1.y - p0.y)**2) + Math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2);
      
      if (dist < 6) {
          this._paintOnChunks(p0, p2, size2, opac2, color);
          return;
      }

      // Much more aggressive simplification for speed (sacrificing quality as requested)
      const steps = Math.min(6, Math.max(1, Math.ceil(dist / 24)));
      
      let prev = p0;
      for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const tInv = 1 - t;
          const next = {
              x: tInv * tInv * p0.x + 2 * tInv * t * p1.x + t * t * p2.x,
              y: tInv * tInv * p0.y + 2 * tInv * t * p1.y + t * t * p2.y
          };
          const curSize = size1 + (size2 - size1) * t;
          const curOpac = opac1 + (opac2 - opac1) * t;
          this._paintOnChunks(prev, next, curSize, curOpac, color);
          prev = next;
      }
  }

  _paintOnChunks(from, to, size, opacity, color) {
    if (this.activeLayer === 0) return;
    
    // 1. Prepare Brush Params
    const isSmudge = this.brush.type === TOOLS.SMUDGE;
    const bSize = Math.round(size);
    const spacing = isSmudge ? Math.max(1, bSize * 0.05) : Math.max(2, bSize * this.brush.spacing); 
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const flow = this.brush.flow || 0.5;
    
    const isEraser = this.brush.type === TOOLS.ERASER;
    const isWire = this.brush.type === TOOLS.WIREFRAME;
    const tip = this.brush.tip;
    const airbrush = this.brush.airbrush || 0;
    const oil = this.brush.oiliness || 0;
    const height = this.brush.paintHeight || 0;

    // 2. Generate Stamp Positions
    // Airbrush step optimization: higher airbrush = fewer stamps (capped at ~0.3 steps at 65% airbrush)
    // Most important for performance and visual consistency of overlapping blurs.
    let currentSpacing = spacing;
    if (!isSmudge && !isWire && airbrush > 0 && dist > 1) {
        const airWeight = Math.min(1.0, airbrush / 0.65);
        const airSpacing = dist / 0.3;
        if (airSpacing > currentSpacing) {
            currentSpacing = currentSpacing + (airSpacing - currentSpacing) * airWeight;
        }
    }

    const stamps = [];
    let p = this.spacingAccumulator;
    while (p <= dist) {
        const t = dist === 0 ? 0 : p / dist;
        stamps.push({ x: from.x + dx * t, y: from.y + dy * t });
        p += currentSpacing;
    }
    this.spacingAccumulator = p - dist;

    if (stamps.length === 0) return;

    // 3. Cache and Smudge Prep
    if (tip && !isSmudge) {
        const sharpen = this.brush.brushSharpen || 0;
        const cacheKey = `${airbrush}_${bSize}_${sharpen}`;
        if (!this._tipColorCache || this._tipColorCache.key !== cacheKey || this._tipColorCache.color !== color) {
            this._updateTipCache(bSize, airbrush, color);
        }
        if ((oil > 0 || height > 0) && dist < 500) {
            // Oiliness now produces sharper highlights for a "wet" look, while impasto stays soft
            const reliefBlur = Math.max(0.2, (height * 0.1 + oil * 0.02)) * 4 * (1 - airbrush * 0.4);
            const reliefKey = `${bSize}_${reliefBlur}`;
            if (!this._reliefCache || this._reliefCache.key !== reliefKey) {
                this._updateReliefCache(bSize, reliefBlur);
            }
        }
    }

    if (isSmudge && !this.smudgeCanvas) {
        this.smudgeCanvas = document.createElement('canvas');
        this.smudgeCanvas.width = 128; // Standard smudge tip size
        this.smudgeCanvas.height = 128;
        this.smudgeCtx = this.smudgeCanvas.getContext('2d', { willReadFrequently: true });
        this.smudgeDirty = false;
    }

    // 4. Find Affected Chunks and grouping stamps
    const stampR = bSize / 2;
    const affectedChunks = new Map();

    for (const s of stamps) {
        const sCX = Math.floor((s.x - stampR) / this.chunkSize);
        const eCX = Math.floor((s.x + stampR) / this.chunkSize);
        const sCY = Math.floor((s.y - stampR) / this.chunkSize);
        const eCY = Math.floor((s.y + stampR) / this.chunkSize);

        for (let cx = sCX; cx <= eCX; cx++) {
            for (let cy = sCY; cy <= eCY; cy++) {
                const id = `${cx},${cy}`;
                let group = affectedChunks.get(id);
                if (!group) {
                    group = { cx, cy, stamps: [] };
                    affectedChunks.set(id, group);
                }
                group.stamps.push(s);
            }
        }
    }

    // 5. Draw
    // Eraser and Smudge are direct-to-layer, so they must apply the main brush opacity immediately.
    // Regular brushes apply it at the end of the stroke (baking step).
    const opacityBase = (isEraser || isSmudge) ? (opacity * flow * this.brush.opacity) : (opacity * flow);
    const hasRotation = this.rotation !== 0;

    if (isSmudge) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const s of stamps) {
            minX = Math.min(minX, s.x - stampR); minY = Math.min(minY, s.y - stampR);
            maxX = Math.max(maxX, s.x + stampR); maxY = Math.max(maxY, s.y + stampR);
        }
        minX = Math.floor(minX - 4); minY = Math.floor(minY - 4);
        maxX = Math.ceil(maxX + 4); maxY = Math.ceil(maxY + 4);
        const w = maxX - minX, h = maxY - minY;

        if (w > 0 && h > 0) {
            if (!this.segmentCanvas) {
                this.segmentCanvas = document.createElement('canvas');
                this.segmentCtx = this.segmentCanvas.getContext('2d', { willReadFrequently: true });
            }
            if (this.segmentCanvas.width < w || this.segmentCanvas.height < h) {
                this.segmentCanvas.width = Math.max(this.segmentCanvas.width, w + 128);
                this.segmentCanvas.height = Math.max(this.segmentCanvas.height, h + 128);
            }
            this.segmentCtx.clearRect(0, 0, w, h);

            affectedChunks.forEach((group, id) => {
                const chunk = this._getChunk(group.cx, group.cy);
                if (chunk) {
                    const lx = group.cx * this.chunkSize;
                    const ly = group.cy * this.chunkSize;
                    
                    this.segmentCtx.save();
                    // We must clip the pickup and the smudge draw too
                    if (this.activeSelectionPath) {
                        this.segmentCtx.beginPath();
                        this.activeSelectionPath.forEach((p, i) => {
                            this.segmentCtx[i === 0 ? 'moveTo' : 'lineTo'](p.x - minX, p.y - minY);
                        });
                        this.segmentCtx.closePath();
                        this.segmentCtx.clip();
                    }

                    this.segmentCtx.drawImage(chunk.canvases[this.activeLayer], lx - minX, ly - minY);
                    this.segmentCtx.restore();

                    if (this.isDrawing && !this.currentStrokeDirtyChunks.has(id)) {
                        const backup = document.createElement('canvas');
                        backup.width = this.chunkSize; backup.height = this.chunkSize;
                        backup.getContext('2d').drawImage(chunk.canvases[this.activeLayer], 0, 0);
                        this.currentStrokeDirtyChunks.set(id, { layer: this.activeLayer, canvas: backup });
                        this._markDirty(id, this.activeLayer);
                    }
                }
            });

            const sCtx = this.segmentCtx;
            for (const s of stamps) {
                const px = s.x - minX, py = s.y - minY;
                const sSz = Math.max(4, bSize), sR = sSz / 2;
                
                if (this.smudgeDirty) {
                    sCtx.save();
                    sCtx.translate(px, py); if (hasRotation) sCtx.rotate(this.rotation);                    // Boost visibility of smudge. 
                    // Higher flow = more opaque smudge stamp.
                    sCtx.globalAlpha = Math.min(1.0, flow * (this.brush.smudgeFlowBoost ?? 10.0)); 
                    sCtx.drawImage(this.smudgeCanvas, -sR, -sR, sSz, sSz);
                    sCtx.restore();
                }
 
                this.smudgeCtx.save();
                this.smudgeCtx.clearRect(0, 0, 128, 128);
                
                if (this.smudgeDirty) {
                    // Previous smudge content
                    this.smudgeCtx.globalAlpha = 1.0;
                    this.smudgeCtx.drawImage(this.smudgeCanvas, 0, 0);
                    
                    // Pickup from segment.
                    // Higher flow = more pickup (wetness).
                    // Higher opacity = less update (drag length).
                    const pickupMul = this.brush.smudgePickup ?? 2.0;
                    const pickUpAlpha = (0.3 + flow * 0.4 * pickupMul) * (1.1 - opacity * 0.8);
                    this.smudgeCtx.globalAlpha = Math.min(1.0, pickUpAlpha);
                } else {
                    this.smudgeCtx.globalAlpha = 1.0;
                }
                
                // 1. Pick up color from the segment
                this.smudgeCtx.drawImage(this.segmentCanvas, px - sR, py - sR, sSz, sSz, 0, 0, 128, 128);

                // 2. MASK the smudge content with the brush tip
                this.smudgeCtx.globalCompositeOperation = 'destination-in';
                this.smudgeCtx.globalAlpha = 1.0;
                if (tip) {
                    this.smudgeCtx.drawImage(tip, 0, 0, 128, 128);
                } else {
                    this.smudgeCtx.beginPath();
                    this.smudgeCtx.arc(64, 64, 64, 0, Math.PI * 2);
                    this.smudgeCtx.fill();
                }

                this.smudgeCtx.restore();
                this.smudgeDirty = true;
            }

            affectedChunks.forEach((group, id) => {
                const chunk = this._getChunk(group.cx, group.cy);
                if (chunk) {
                    const lx = group.cx * this.chunkSize, ly = group.cy * this.chunkSize;
                    const iMinX = Math.max(lx, minX), iMinY = Math.max(ly, minY);
                    const iMaxX = Math.min(lx + this.chunkSize, maxX), iMaxY = Math.min(ly + this.chunkSize, maxY);
                    if (iMaxX > iMinX && iMaxY > iMinY) {
                        const lCtx = chunk.ctxs[this.activeLayer];
                        const layerSet = this.layerSettings[this.activeLayer];
                        
                        if (layerSet && layerSet.alphaLock) {
                            lCtx.save();
                            // If alpha lock is on, we don't clear.
                            // We use source-atop to paint only on existing pixels.
                            lCtx.globalCompositeOperation = 'source-atop';
                            lCtx.drawImage(this.segmentCanvas, iMinX - minX, iMinY - minY, iMaxX - iMinX, iMaxY - iMinY, iMinX - lx, iMinY - ly, iMaxX - iMinX, iMaxY - iMinY);
                            lCtx.restore();
                        } else {
                            lCtx.clearRect(iMinX - lx, iMinY - ly, iMaxX - iMinX, iMaxY - iMinY);
                            lCtx.drawImage(this.segmentCanvas, iMinX - minX, iMinY - minY, iMaxX - iMinX, iMaxY - iMinY, iMinX - lx, iMinY - ly, iMaxX - iMinX, iMaxY - iMinY);
                        }
                    }
                }
            });
        }
        return;
    }

    affectedChunks.forEach((group, id) => {
        const chunk = this._getChunk(group.cx, group.cy);
        if (!chunk) return;

        if (this.isDrawing && !this.currentStrokeDirtyChunks.has(id)) {
            const backup = document.createElement('canvas');
            backup.width = this.chunkSize; backup.height = this.chunkSize;
            backup.getContext('2d').drawImage(chunk.canvases[this.activeLayer], 0, 0);
            this.currentStrokeDirtyChunks.set(id, { layer: this.activeLayer, canvas: backup });
            this._markDirty(id, this.activeLayer);
        }

        const ctx = isEraser ? chunk.ctxs[this.activeLayer] : chunk.strokeCtx;
        if (!isEraser) chunk.strokeCanvas.style.opacity = this.brush.opacity;

        const lx = group.cx * this.chunkSize;
        const ly = group.cy * this.chunkSize;

        ctx.save();
        
        // Clip to selection if active
        if (this.activeSelectionPath) {
            ctx.beginPath();
            this.activeSelectionPath.forEach((p, i) => {
                const px = p.x - lx;
                const py = p.y - ly;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            });
            ctx.closePath();
            ctx.clip();
        }

        ctx.globalAlpha = opacityBase;
        
        if (isEraser) {
            const layerSet = this.layerSettings[this.activeLayer];
            if (layerSet && layerSet.alphaLock) {
                ctx.restore();
                return;
            }
            ctx.globalCompositeOperation = 'destination-out';
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = color;
        }

        for (const s of group.stamps) {
            const px = Math.round(s.x - lx);
            const py = Math.round(s.y - ly);
            
            // Regular stamps: optimized by avoiding save/restore if no rotation/tip
            if (!hasRotation && !tip && !isWire) {
                if (isEraser) {
                    ctx.clearRect(px - stampR, py - stampR/2, bSize, bSize/2);
                } else {
                    ctx.fillRect(px - stampR, py - stampR/2, bSize, bSize/2);
                }
            } else {
                ctx.save();
                ctx.translate(px, py);
                if (hasRotation) ctx.rotate(this.rotation);

                if (isWire) {
                    ctx.beginPath(); ctx.arc(0, 0, stampR, 0, Math.PI*2);
                    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
                } else if (tip) {
                    // Relief / Impasto effect
                    if ((oil > 0 || height > 0) && dist < 500 && !isEraser) {
                        // 1. Shadow Pass (Multiply) - Strictly reserved for Impasto (Paint Height)
                        if (height > 0) {
                            ctx.save();
                            ctx.globalCompositeOperation = 'multiply';
                            ctx.translate(1, 1);
                            ctx.globalAlpha = height * 0.22;
                            ctx.drawImage(this._reliefCache.shadow, -stampR, -stampR);
                            ctx.restore();
                        }

                        // 2. Highlight Pass - Oiliness boosts this and uses color-dodge for "wet" look
                        const highlightOpacity = (height * 0.15) + (oil * 0.35);
                        const highlightMode = oil > 0 ? 'color-dodge' : 'screen';
                        
                        ctx.save();
                        ctx.globalCompositeOperation = highlightMode;
                        ctx.translate(-1, -1);
                        ctx.globalAlpha = Math.min(1.0, highlightOpacity);
                        ctx.drawImage(this._reliefCache.highlight, -stampR, -stampR);
                        ctx.restore();
                    }
                    ctx.drawImage(this._tipColorCache.canvas, -stampR, -stampR);
                } else {
                    ctx.fillRect(-stampR, -stampR/2, bSize, bSize/2);
                }
                ctx.restore();
            }
        }
        ctx.restore();
    });
  }

  _updateTipCache(s, airbrush, color) {
    const blur = airbrush * s * 0.45;
    const scale = 1.0 / (1.0 + airbrush * 1.5);
    const dSize = Math.max(1, s * scale);
    const canv = document.createElement('canvas'); canv.width = s; canv.height = s;
    const tctx = canv.getContext('2d');
    
    if (airbrush > 0) tctx.filter = `blur(${blur}px)`;
    
    const sharpen = this.brush.brushSharpen || 0;
    if (sharpen > 0) {
        const contrast = 100 + sharpen * 900;
        const currentFilter = (tctx.filter && tctx.filter !== 'none') ? tctx.filter : '';
        tctx.filter = (currentFilter ? currentFilter + ' ' : '') + `contrast(${contrast}%)`;
    }

    tctx.drawImage(this.brush.tip, (s-dSize)/2, (s-dSize)/2, dSize, dSize);
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = color; tctx.fillRect(0,0,s,s);
    this._tipColorCache = { canvas: canv, key: `${airbrush}_${s}_${sharpen}`, color, srcTip: this.brush.tip };
  }

  _updateReliefCache(s, blur) {
    if (!this.brush.tip || this.brush.tip.width === 0 || s < 1) return;
    const shad = document.createElement('canvas'); shad.width = s; shad.height = s;
    const sctx = shad.getContext('2d');
    if (blur > 0) sctx.filter = `blur(${blur}px)`;
    try {
        sctx.drawImage(this.brush.tip, 0, 0, s, s);
    } catch(e) { return; }
    sctx.globalCompositeOperation = 'source-in'; sctx.fillStyle = 'black'; sctx.fillRect(0,0,s,s);

    const high = document.createElement('canvas'); high.width = s; high.height = s;
    const hctx = high.getContext('2d');
    if (blur > 0) hctx.filter = `blur(${blur}px)`;
    try {
        hctx.drawImage(this.brush.tip, 0, 0, s, s);
    } catch(e) { return; }
    hctx.globalCompositeOperation = 'source-in'; hctx.fillStyle = 'white'; hctx.fillRect(0,0,s,s);
    
    this._reliefCache = { shadow: shad, highlight: high, key: `${s}_${blur}`, srcTip: this.brush.tip };
  }

  addReferenceImage(img, name, x = null, y = null, config = {}, autoSelect = true) {
    const rect = this.container.getBoundingClientRect();
    const wx = x !== null ? x : (-this.pan.x) / this.zoom;
    const wy = y !== null ? y : (-this.pan.y) / this.zoom;

    const el = document.createElement('img');
    el.src = img.src;
    el.className = 'absolute pointer-events-none';
    el.style.left = `-${img.width/2}px`; // Center on pivot
    el.style.top = `-${img.height/2}px`;
    
    this.refLayer.appendChild(el);

    const ref = {
      id: Math.random().toString(36).substring(7),
      name: name || 'Untitled',
      img: img,
      element: el,
      x: wx,
      y: wy,
      rotation: config.rotation || 0,
      scale: config.scale || 1.0,
      opacity: config.opacity !== undefined ? config.opacity : 1.0,
      mirrorX: config.mirrorX || false,
      mirrorY: config.mirrorY || false
    };

    this.referenceImages.push(ref);
    this.refsDirty = true;
    if (autoSelect) {
        this.selectedRefIndex = this.referenceImages.length - 1;
    }
    this.refresh();
    return ref;
  }



  selectReferenceAt(wx, wy) {
    // Check from top to bottom
    for (let i = this.referenceImages.length - 1; i >= 0; i--) {
        const ref = this.referenceImages[i];
        
        // Transform wx, wy to image local space (relative to pivot)
        const dx = wx - ref.x;
        const dy = wy - ref.y;
        const cos = Math.cos(-ref.rotation);
        const sin = Math.sin(-ref.rotation);
        let lx = dx * cos - dy * sin;
        let ly = dx * sin + dy * cos;
        
        lx /= ref.scale;
        ly /= ref.scale;
        
        if (ref.mirrorX) lx = -lx;
        if (ref.mirrorY) ly = -ly;

        if (lx >= -ref.img.width/2 && lx <= ref.img.width/2 &&
            ly >= -ref.img.height/2 && ly <= ref.img.height/2) {
            this.selectedRefIndex = i;
            this.refresh();
            return true;
        }
    }
    return false;
  }

  importImage(img) {
      this.addReferenceImage(img, 'Imported');
  }

  _disposeAction(action) {
      if (!action || !action.chunks) return;
      action.chunks.forEach(data => {
          if (data.canvas) {
              data.canvas.width = 1;
              data.canvas.height = 1;
              data.canvas = null;
          }
      });
      action.chunks.clear();
  }

  _clearStack(stack) {
      if (!stack) return;
      while (stack.length > 0) {
          this._disposeAction(stack.pop());
      }
  }

  compact() {
      // Clear redo stack on save to free up memory
      this._clearStack(this.redoStack);
      
      // If history is very large, maybe trim it? 
      // But 50 is usually fine with disposal.
  }

  setLayerVisibility(index, visible) {
      if (this.layerSettings[index]) {
          this.layerSettings[index].visible = visible;
          
          if (index === 0) {
              this.refLayer.style.display = visible ? 'block' : 'none';
          }
          
          this.chunks.forEach(chunk => {
              if (chunk.canvases[index]) {
                  chunk.canvases[index].style.display = visible ? 'block' : 'none';
              }
          });
      }
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
                redoBackup.width = this.chunkSize;
                redoBackup.height = this.chunkSize;
                redoBackup.getContext('2d').drawImage(chunk.canvases[data.layer], 0, 0);
                redoAction.chunks.set(id, { layer: data.layer, canvas: redoBackup });

                chunk.ctxs[data.layer].clearRect(0,0, this.chunkSize, this.chunkSize);
                chunk.ctxs[data.layer].drawImage(data.canvas, 0, 0);
                this._markDirty(id, data.layer);
            }
        });
        this._disposeAction(action);
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
    if (this.onDrawEnd) this.onDrawEnd();
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
                undoBackup.width = this.chunkSize;
                undoBackup.height = this.chunkSize;
                undoBackup.getContext('2d').drawImage(chunk.canvases[data.layer], 0, 0);
                undoAction.chunks.set(id, { layer: data.layer, canvas: undoBackup });

                chunk.ctxs[data.layer].clearRect(0,0, this.chunkSize, this.chunkSize);
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
    this._disposeAction(action);
    this._updateSelectionPreview();
    this.refresh();
    this._status('REDO');
    if (this.onDrawEnd) this.onDrawEnd();
  }

  clearLayer(index) {
      const snap = new Map();
      this.chunks.forEach((chunk, id) => {
          const backup = document.createElement('canvas');
          backup.width = this.chunkSize;
          backup.height = this.chunkSize;
          backup.getContext('2d').drawImage(chunk.canvases[index], 0, 0);
          snap.set(id, { layer: index, canvas: backup });
      });
      this.history.push({ type: 'stroke', chunks: snap, zoom: this.zoom, pan: { ...this.pan } });

      this.chunks.forEach((chunk, id) => {
          chunk.ctxs[index].clearRect(0, 0, this.chunkSize, this.chunkSize);
          this._markDirty(id, index, true);
      });
      this._status(`LAYER ${index} CLEARED`);
      if (this.onDrawEnd) this.onDrawEnd();
  }

  clear() {
    this.chunks.forEach((chunk, id) => {
      chunk.ctxs.forEach((ctx, index) => {
          ctx.clearRect(0,0, this.chunkSize, this.chunkSize);
          this._markDirty(id, index, true);
      });
    });
    if (this.onDrawEnd) this.onDrawEnd();
  }

  setZoom(z, cursorX = null, cursorY = null) {
    const oldZoom = this.zoom;
    this.zoom = Math.max(0.01, Math.min(50, z));

    const rect = this.container.getBoundingClientRect();
    const cx = Math.floor(rect.width / 2);
    const cy = Math.floor(rect.height / 2);

    if (cursorX === null || cursorY === null) {
        cursorX = rect.left + cx;
        cursorY = rect.top + cy;
    }

    const x = cursorX - rect.left;
    const y = cursorY - rect.top;
    const dx = x - cx;
    const dy = y - cy;

    const factor = this.zoom / oldZoom;
    
    // Fixed point zoom: keep world point under cursor
    const vx = dx - this.pan.x;
    const vy = dy - this.pan.y;
    this.pan.x = dx - vx * factor;
    this.pan.y = dy - vy * factor;

    this.refresh();
    this.saveViewport();
    if (this.onZoomChange) this.onZoomChange(this.zoom);
  }

  setRotation(r, cursorX = null, cursorY = null) {
    const oldRot = this.rotation;
    this.rotation = r;

    const rect = this.container.getBoundingClientRect();
    const cx = Math.floor(rect.width / 2);
    const cy = Math.floor(rect.height / 2);

    if (cursorX === null || cursorY === null) {
        cursorX = rect.left + cx;
        cursorY = rect.top + cy;
    }

    const x = cursorX - rect.left;
    const y = cursorY - rect.top;
    const dx = x - cx;
    const dy = y - cy;

    // Fixed point rotation: keep world point under cursor
    const vx = dx - this.pan.x;
    const vy = dy - this.pan.y;
    
    const dRot = this.rotation - oldRot;
    const cos = Math.cos(dRot);
    const sin = Math.sin(dRot);
    
    const nvx = vx * cos - vy * sin;
    const nvy = vx * sin + vy * cos;
    
    this.pan.x = dx - nvx;
    this.pan.y = dy - nvy;

    this.refresh();
    this.saveViewport();
  }

  fitZoom() {
    this.setZoom(1);
  }

  saveViewport() {
    const prefix = this.currentProjectId ? `v_${this.currentProjectId}_` : 'v_';
    localStorage.setItem(prefix + 'zoom', this.zoom);
    localStorage.setItem(prefix + 'pan', JSON.stringify(this.pan));
  }

  loadViewport(projectId = null) {
    if (projectId) this.currentProjectId = projectId;
    try {
        const prefix = this.currentProjectId ? `v_${this.currentProjectId}_` : 'v_';
        const savedZoom = localStorage.getItem(prefix + 'zoom');
        const savedPan = localStorage.getItem(prefix + 'pan');
        if (savedZoom) this.zoom = parseFloat(savedZoom);
        if (savedPan) this.pan = JSON.parse(savedPan);
        this.refresh();
        if (this.onZoomChange) this.onZoomChange(this.zoom);
    } catch(e) {
        console.warn('Failed to load viewport', e);
    }
  }

  _initGesture() {
    const pointers = Array.from(this.activePointers.values());
    if (pointers.length < 2) return;
    const p1 = pointers[0];
    const p2 = pointers[1];
    
    this.gestureStartCenter = { x: (p1.clientX + p2.clientX) / 2, y: (p1.clientY + p2.clientY) / 2 };
    this.gestureStartDist = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
    this.gestureStartAngle = Math.atan2(p2.clientY - p1.clientY, p2.clientX - p1.clientX);
    
    this.gestureStartPan = { ...this.pan };
    this.gestureStartZoom = this.zoom;
    this.gestureStartRotation = this.rotation;
  }

  _handleGesture() {
    const pointers = Array.from(this.activePointers.values());
    if (pointers.length < 2) return;
    const p1 = pointers[0];
    const p2 = pointers[1];
    
    const center = { x: (p1.clientX + p2.clientX) / 2, y: (p1.clientY + p2.clientY) / 2 };
    const dist = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
    const angle = Math.atan2(p2.clientY - p1.clientY, p2.clientX - p1.clientX);
    
    const zoomFactor = dist / Math.max(1, this.gestureStartDist);
    const angleDelta = angle - this.gestureStartAngle;
    const dx = center.x - this.gestureStartCenter.x;
    const dy = center.y - this.gestureStartCenter.y;
    
    // Multi-finger gesture logic:
    // Reset to starting point state first to avoid accumulation drift
    this.pan = { ...this.gestureStartPan };
    this.zoom = this.gestureStartZoom;
    this.rotation = this.gestureStartRotation;
    
    // Apply zoom & rotation anchored at the original midpoint of the fingers
    this.setZoom(this.gestureStartZoom * zoomFactor, this.gestureStartCenter.x, this.gestureStartCenter.y);
    this.setRotation(this.gestureStartRotation + angleDelta, this.gestureStartCenter.x, this.gestureStartCenter.y);
    
    // Finally apply translation of the center point itself
    this.pan.x += dx;
    this.pan.y += dy;
    
    this.refresh();
  }
}
