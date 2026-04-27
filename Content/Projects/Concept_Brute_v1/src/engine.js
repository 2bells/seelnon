import { CHUNK_SIZE as DEFAULT_CHUNK_SIZE, LAYERS_COUNT, TOOLS } from './constants.js';

export class Engine {
  constructor(container, settings = {}) {
    this.container = container;
    this.chunkSize = settings.chunkSize || DEFAULT_CHUNK_SIZE;
    this.saveQuality = settings.quality || 0.5;
    this.chunks = new Map(); // id -> { canvases: [canvas, canvas, canvas], ctxs: [ctx, ctx, ctx] }
    this.activeLayer = 1; // Default to first paint layer
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
      type: TOOLS.BRUSH 
    };

    this.strokePoints = [];
    this.spacingAccumulator = 0;

    this.history = [];
    this.redoStack = [];
    this.currentStrokeDirtyChunks = new Map();
    
    this.activeSelectionPath = null;
    this.clipboard = null;
    this.floatingSelection = null;
    this.dirtyChunks = new Set(); // Tracks chunks that need persisting to storage
    this.referenceImages = [];
    this.selectedRefIndex = -1;

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
    this.canvasWrapper.style.left = '-5000px';
    this.canvasWrapper.style.top = '-5000px';
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
    
    // Dedicated UI Layer for overlays (Selection, Lasso, etc)
    this.uiLayer = document.createElement('div');
    this.uiLayer.className = 'absolute inset-0 pointer-events-none z-100 w-full h-full';
    this.container.appendChild(this.uiLayer);

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

  captureArea(screenX, screenY, size = 128) {
    const temp = document.createElement('canvas');
    temp.width = size;
    temp.height = size;
    const tctx = temp.getContext('2d');
    
    // Account for container's offset on screen
    const containerRect = this.container.getBoundingClientRect();
    const localX = screenX - containerRect.left;
    const localY = screenY - containerRect.top;

    const rect = {
      x: (localX - this.pan.x) / this.zoom - (size / (2 * this.zoom)),
      y: (localY - this.pan.y) / this.zoom - (size / (2 * this.zoom)),
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
    this.container.addEventListener('mousedown', (e) => {
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
        if (e.button === 1) { // Middle click
            this.isPanning = true;
            this.lastMousePos = { x: e.clientX, y: e.clientY };
            this._updateCursor();
            return;
        }
        this._startStroke(e);
    });
    window.addEventListener('mousemove', (e) => {
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
      this._moveStroke(e);
      this._handlePickerMove(e);
      this._updateBrushCursor(e);
    });
    window.addEventListener('mouseup', (e) => {
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
    });
       
    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        
        if (key === 'r') {
            if (e.repeat) return;
            const now = performance.now();
            if (now - this.lastRKeyTime < 300) {
                this.rotation = 0;
                this.refresh();
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
      e.preventDefault();
      if (e.ctrlKey) {
        // Pan Y with Ctrl+Scroll
        this.pan.y -= e.deltaY;
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
    this.isMirrored = !this.isMirrored;
    this.refresh();
    this._status(this.isMirrored ? 'MIRRORED' : 'NORMAL');
  }

  _getMousePos(e) {
    const rect = this.container.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    
    // Account for rotation around container center
    if (this.rotation !== 0) {
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const dx = x - cx;
        const dy = y - cy;
        const cos = Math.cos(-this.rotation);
        const sin = Math.sin(-this.rotation);
        x = dx * cos - dy * sin + cx;
        y = dx * sin + dy * cos + cy;
    }

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

  _markDirty(id, layer, isEmpty = false) {
      if (this.chunks.has(id)) {
          const chunk = this.chunks.get(id);
          if (chunk.isEmpty) chunk.isEmpty[layer] = isEmpty;
      }
      this.dirtyChunks.add(`${id}|${layer}`);
  }

  _getChunkCoords(x, y) {
    const cx = Math.floor((x - this.pan.x) / (this.chunkSize * this.zoom));
    const cy = Math.floor((y - this.pan.y) / (this.chunkSize * this.zoom));
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

    chunk.element.className = 'absolute border-white-5 pointer-events-none';
    chunk.element.style.width = `${this.chunkSize}px`;
    chunk.element.style.height = `${this.chunkSize}px`;
    
    for (let i = 0; i < LAYERS_COUNT; i++) {
      const canv = document.createElement('canvas');
      canv.width = this.chunkSize;
      canv.height = this.chunkSize;
      canv.className = 'absolute inset-0';
      // Use default rendering when potentially rotating to reduce seams
      canv.style.imageRendering = 'auto';
      canv.style.backfaceVisibility = 'hidden';
      canv.style.webkitBackfaceVisibility = 'hidden';
      chunk.element.appendChild(canv);
      chunk.canvases.push(canv);
      chunk.ctxs.push(canv.getContext('2d', { alpha: true }));
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
    const x = chunk.cx * this.chunkSize * this.zoom + this.pan.x + 5000;
    const y = chunk.cy * this.chunkSize * this.zoom + this.pan.y + 5000;
    chunk.element.style.transform = `translate(${x}px, ${y}px) scale(${this.zoom})`;
    chunk.element.style.transformOrigin = 'top left';
  }

  _updateRefImagesTransform() {
    this.referenceImages.forEach((ref, index) => {
        if (!ref.element) return;
        const x = ref.x * this.zoom + this.pan.x + 5000;
        const y = ref.y * this.zoom + this.pan.y + 5000;
        
        let transform = `translate(${x}px, ${y}px) rotate(${ref.rotation}rad) scale(${ref.scale * this.zoom})`;
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
    
    const rect = this.container.getBoundingClientRect();
    const cx = rect.width / 2 + 5000;
    const cy = rect.height / 2 + 5000;
    this.canvasWrapper.style.transformOrigin = `${cx}px ${cy}px`;
    
    let transform = `rotate(${this.rotation}rad)`;
    if (this.isMirrored) {
        transform += ' scaleX(-1)';
    }
    this.canvasWrapper.style.transform = transform;
  }

  refreshGrid() {
    // Sync Background
    this.container.style.backgroundColor = this.canvasBg;
    
    if (this.showGrid) {
        const scaledSize = this.gridSize * this.zoom;
        const color = this.gridColor;
        const opacity = this.gridIntensity;
        
        let gridColorWithOpacity = color;
        if (color.startsWith('#')) {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            gridColorWithOpacity = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }

        let bgImage = '';
        if (this.gridPattern === 'dots') {
            bgImage = `radial-gradient(${gridColorWithOpacity} 1px, transparent 1px)`;
        } else if (this.gridPattern === 'lines') {
            bgImage = `linear-gradient(0deg, ${gridColorWithOpacity} 1px, transparent 1px)`;
        } else if (this.gridPattern === 'squares') {
            bgImage = `linear-gradient(90deg, ${gridColorWithOpacity} 1px, transparent 1px), linear-gradient(0deg, ${gridColorWithOpacity} 1px, transparent 1px)`;
        } else if (this.gridPattern === 'crosses') {
            // Crosses: small vertical and horizontal lines intersecting at grid points
            bgImage = `linear-gradient(90deg, transparent 48%, ${gridColorWithOpacity} 48%, ${gridColorWithOpacity} 52%, transparent 52%), 
                       linear-gradient(0deg, transparent 48%, ${gridColorWithOpacity} 48%, ${gridColorWithOpacity} 52%, transparent 52%)`;
        }

        this.canvasWrapper.style.backgroundImage = bgImage;
        this.canvasWrapper.style.backgroundSize = `${scaledSize}px ${scaledSize}px`;
        this.canvasWrapper.style.backgroundPosition = `${5000 + this.pan.x}px ${5000 + this.pan.y}px`;
    } else {
        this.canvasWrapper.style.backgroundImage = 'none';
        this.canvasWrapper.style.backgroundPosition = '0 0';
    }
  }

  refresh() {
    this.refreshTransforms();
    this.refreshGrid();
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
      
      const pathToShow = this.lassoPath || this.activeSelectionPath;
      
      if (pathToShow || this.isExportMode) {
          ctx.save();
          // Apply Camera Transform
          ctx.translate(rect.width/2, rect.height/2);
          if (this.isMirrored) ctx.scale(-1, 1);
          ctx.rotate(this.rotation);
          ctx.translate(-rect.width/2, -rect.height/2);

          if (this.isExportMode) {
              // Draw dimming overlay
              ctx.fillStyle = 'rgba(0,0,0,0.4)';
              
              if (this.exportRect) {
                  const r = this.exportRect;
                  const sx = r.x * this.zoom + this.pan.x;
                  const sy = r.y * this.zoom + this.pan.y;
                  const sw = r.w * this.zoom;
                  const sh = r.h * this.zoom;

                  // Dim around selection
                  // Top
                  ctx.fillRect(0, 0, rect.width, sy);
                  // Bottom
                  ctx.fillRect(0, sy + sh, rect.width, rect.height - (sy + sh));
                  // Left
                  ctx.fillRect(0, sy, sx, sh);
                  // Right
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
                  // Full screen dim if no selection yet
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
                  const sx = p.x * this.zoom + this.pan.x;
                  const sy = p.y * this.zoom + this.pan.y;
                  if (i === 0) ctx.moveTo(sx, sy);
                  else ctx.lineTo(sx, sy);
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
              const chunk = this._getChunk(cx, cy);
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
    this.lastTime = performance.now();
    this.smoothedVelocity = 0;
    this.strokePoints = [];
    this.spacingAccumulator = 0;
    
    // Clear dirty chunks tracking for this stroke
    this.currentStrokeDirtyChunks = new Map();
    this.redoStack = []; // Clear redo on new action
  }

  _moveStroke(e) {
    if (this.isDrawing && this.onDrawMove) this.onDrawMove();

    if (this.isPanning || (this.keys['r'] && this.isMouseDown)) {
        let dx = e.clientX - this.lastMousePos.x;
        let dy = e.clientY - this.lastMousePos.y;
        
        if (this.keys['r']) {
            // Rotate
            const rect = this.container.getBoundingClientRect();
            const cx = rect.width / 2;
            const cy = rect.height / 2;
            
            const a1 = Math.atan2(this.lastMousePos.y - cy, this.lastMousePos.x - cx);
            const a2 = Math.atan2(e.clientY - cy, e.clientX - cx);
            this.rotation += (a2 - a1);
        } else {
            // Pan
            let dx = e.clientX - this.lastMousePos.x;
            let dy = e.clientY - this.lastMousePos.y;
            
            // Account for rotation in panning
            if (this.rotation !== 0) {
                const rx = dx * Math.cos(-this.rotation) - dy * Math.sin(-this.rotation);
                const ry = dx * Math.sin(-this.rotation) + dy * Math.cos(-this.rotation);
                dx = rx;
                dy = ry;
            }

            if (this.isMirrored) dx = -dx;
            this.pan.x += dx;
            this.pan.y += dy;
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
        
        this.setZoom(newZoom, this.zoomAnchor.x, this.zoomAnchor.y);
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
    if (this.keys['shift'] && this.lastPos) {
        const dx = currentPos.x - this.lastPos.x;
        const dy = currentPos.y - this.lastPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        
        // Snap to 45 degrees (Pi / 4)
        const snap = Math.PI / 4;
        const snappedAngle = Math.round(angle / snap) * snap;
        
        currentPos = {
            x: this.lastPos.x + Math.cos(snappedAngle) * dist,
            y: this.lastPos.y + Math.sin(snappedAngle) * dist
        };
    }

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
    
    // Multiplier for speed sensitivity to make them much more pronounced
    const sensitivityMult = 2.0; 
    
    // Size: positive speedSize means faster=smaller
    const sizeMod = 1 - (vFactor * this.brush.speedSize * sensitivityMult); 
    const dynamicSize = this.brush.size * Math.max(0.05, sizeMod);
    
    // Opacity: positive speedOpacity means faster=transparent
    const opacMod = Math.max(0.01, 1 - (vFactor * this.brush.speedOpacity * sensitivityMult));

    let color = this.brush.color;
    // Color shift: Value and Hue
    if (this.brush.speedValue !== 0 || this.brush.speedHue !== 0) {
        // Value: speedValue (positive = faster:darker, negative = faster:lighter)
        color = this._shiftColor(color, vFactor * this.brush.speedHue * 60, -vFactor * (this.brush.speedValue / 5)); // More sensitive value shift
    }

    if (this.brush.type === TOOLS.WIREFRAME) {
        this.strokePoints.push(worldTo);
        // 1. Core Ink Line
        this._paintOnChunks(worldFrom, worldTo, Math.max(1, dynamicSize * 0.1), opacMod, color);
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
                this._paintOnChunks(p, worldTo, 1, opacMod * 0.2, color);
            }
        }
    } else {
        this._paintOnChunks(worldFrom, worldTo, dynamicSize, opacMod, color);
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

    // Bake per-stroke buffer
    if (this.brush.type !== TOOLS.ERASER && this.brush.type !== TOOLS.SMUDGE) {
        this.currentStrokeDirtyChunks.forEach((data, id) => {
            const chunk = this.chunks.get(id);
            if (chunk) {
                const ctx = chunk.ctxs[this.activeLayer];
                ctx.save();
                ctx.globalAlpha = this.brush.opacity; // Per-stroke opacity from UI
                ctx.globalCompositeOperation = 'source-over';
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
        if (this.history.length > 30) this.history.shift();
    }
    
    if (this.onDrawEnd && this.isDrawing) this.onDrawEnd();
    
    this.isDrawing = false;
    this.isPanning = false;
    this.isZooming = false;
    this.lastPos = null;
    this.lassoPath = null;
    this._status('READY');
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
        border = '1px solid black';
        if (this.brush.tip) {
            h = s;
            mask = `url(${this.brush.tip.toDataURL()})`;
            bgColor = 'rgba(0,0,0,0.1)'; // Small fill for eraser tip visibility
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
      const wx = (to.x - this.pan.x) / this.zoom;
      const wy = (to.y - this.pan.y) / this.zoom;
      this.lassoPath.push({ x: wx, y: wy });
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
      
      // pivot point calculation
      const worldPivotX = sel.x + sel.canvas.width / 2;
      const worldPivotY = sel.y + sel.canvas.height / 2;
      
      const screenPivotX = worldPivotX * this.zoom + this.pan.x;
      const screenPivotY = worldPivotY * this.zoom + this.pan.y;
      
      let rot = sel.rotation || 0;
      const sc = (sel.scale || 1);
      const displayScale = sc * this.zoom;
      const opacity = (sel.opacity !== undefined ? sel.opacity : 1);
      
      let mirrorX = sel.mirrorX ? -1 : 1;
      let mirrorY = sel.mirrorY ? -1 : 1;
      
      let finalX = screenPivotX;
      if (this.isMirrored) {
          finalX = rect.width - screenPivotX;
          mirrorX *= -1;
          rot = -rot;
      }

      this.selectionOverlay.style.left = '0px';
      this.selectionOverlay.style.top = '0px';
      this.selectionOverlay.style.transformOrigin = 'center center';
      // Center on pivot, then rotate and scale
      this.selectionOverlay.style.transform = `translate(${finalX}px, ${screenPivotY}px) translate(-50%, -50%) rotate(${rot}rad) scale(${displayScale * mirrorX}, ${displayScale * mirrorY})`;
      this.selectionOverlay.style.opacity = opacity;
      
      // Update info status
      this._status(`TRANSFORM: ${Math.round(sc * 100)}% | ${Math.round(rot * 180 / Math.PI)}° | OPACITY: ${Math.round(opacity * 100)}%`);
  }

  removeReferenceImage(index) {
      if (index >= 0 && index < this.referenceImages.length) {
          const ref = this.referenceImages[index];
          if (ref.element) ref.element.remove();
          this.referenceImages.splice(index, 1);
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

  _paintOnChunks(from, to, size, opacity, color) {
    if (this.activeLayer === 0) return; // Guard: No painting on reference image layer
    const minX = Math.min(from.x, to.x) - size;
    const minY = Math.min(from.y, to.y) - size;
    const maxX = Math.max(from.x, to.x) + size;
    const maxY = Math.max(from.y, to.y) + size;

    const startCX = Math.floor(minX / this.chunkSize);
    const startCY = Math.floor(minY / this.chunkSize);
    const endCX = Math.floor(maxX / this.chunkSize);
    const endCY = Math.floor(maxY / this.chunkSize);

    for (let cx = startCX; cx <= endCX; cx++) {
      for (let cy = startCY; cy <= endCY; cy++) {
        const id = `${cx},${cy}`;
        const chunk = this._getChunk(cx, cy);
        
        // Lazy snapshot for undo (must happen before we start drawing on strokeCtx if we used it as source, 
        // but here it's for the main layer which we bake into later)
        if (this.isDrawing && !this.currentStrokeDirtyChunks.has(id)) {
            const backup = document.createElement('canvas');
            backup.width = this.chunkSize;
            backup.height = this.chunkSize;
            backup.getContext('2d').drawImage(chunk.canvases[this.activeLayer], 0, 0);
            this.currentStrokeDirtyChunks.set(id, { layer: this.activeLayer, canvas: backup });
        }
        
        this._markDirty(id, this.activeLayer);

        const isEraser = this.brush.type === TOOLS.ERASER;
        const isSmudge = this.brush.type === TOOLS.SMUDGE;
        const ctx = (isEraser || isSmudge) ? chunk.ctxs[this.activeLayer] : chunk.strokeCtx;
        
        // Ensure height canvas exists if needed
        if (this.brush.paintHeight > 0 && !chunk.heightCanvas) {
            chunk.heightCanvas = document.createElement('canvas');
            chunk.heightCanvas.width = this.chunkSize;
            chunk.heightCanvas.height = this.chunkSize;
            chunk.heightCtx = chunk.heightCanvas.getContext('2d');
            // Background is 128 (flat)
            chunk.heightCtx.fillStyle = '#808080';
            chunk.heightCtx.fillRect(0,0, this.chunkSize, this.chunkSize);
        }

        if (!isEraser && !isSmudge) {
            chunk.strokeCanvas.style.opacity = this.brush.opacity; // Per-stroke opacity
        } else {
            chunk.strokeCanvas.style.opacity = '0';
        }
        
        ctx.save();
        const lx = cx * this.chunkSize;
        const ly = cy * this.chunkSize;

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
        
        if (isEraser) {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(0,0,0,1)';
            ctx.globalAlpha = opacity * this.brush.flow * this.brush.opacity;
        } else if (isSmudge) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = opacity * this.brush.flow * this.brush.opacity * 0.5; // Smudge is softer
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = color;
            ctx.globalAlpha = opacity * this.brush.flow; // Flow * Modulation is per-stamp opacity
        }
        
        // Rectangular "Concept Art" Brush with texture/taper
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
            ctx.rotate(this.rotation);
            
            if (this.brush.type === TOOLS.WIREFRAME) {
                // Outline brush for wireframe
                ctx.beginPath();
                ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            } else if (isSmudge) {
                // Smudge Pick and Stamp
                const sW = Math.max(1, Math.round(s));
                const sH = Math.max(1, Math.round(s / 2));
                
                // Pick center in world coordinates
                const pickX = from.x + (to.x - from.x) * lerpVal - (to.x - from.x) * 0.4;
                const pickY = from.y + (to.y - from.y) * lerpVal - (to.y - from.y) * 0.4;

                // Optimization: reuse scratch canvas without constant resizing unless size changes significantly
                if (this.scratchCanvas.width !== sW || this.scratchCanvas.height !== sH) {
                    this.scratchCanvas.width = sW;
                    this.scratchCanvas.height = sH;
                }
                this.scratchCtx.clearRect(0, 0, sW, sH);

                // Sample from nearby chunks
                const pMinX = pickX - sW / 2;
                const pMinY = pickY - sH / 2;
                const pcxS = Math.floor(pMinX / this.chunkSize);
                const pcyS = Math.floor(pMinY / this.chunkSize);
                const pcxE = Math.floor((pickX + sW / 2) / this.chunkSize);
                const pcyE = Math.floor((pickY + sH / 2) / this.chunkSize);

                for (let pcx = pcxS; pcx <= pcxE; pcx++) {
                    for (let pcy = pcyS; pcy <= pcyE; pcy++) {
                        const sID = `${pcx},${pcy}`;
                        const sChunk = this.chunks.get(sID);
                        if (sChunk) {
                            const clx = pcx * this.chunkSize;
                            const cly = pcy * this.chunkSize;
                            this.scratchCtx.drawImage(sChunk.canvases[this.activeLayer], clx - pMinX, cly - pMinY);
                        }
                    }
                }
                ctx.drawImage(this.scratchCanvas, -sW / 2, -sH / 4, sW, sH);
            } else {
                // TOOLS.BRUSH or TOOLS.ERASER (Eraser draws into stroke buffer as solid color first)
                if (this.brush.tip) {
                    // Update tip cache if needed
                    const airbrushAmount = this.brush.airbrush || 0;
                    const airbrushBlur = airbrushAmount * size * 0.45; // x3 factor (was 0.15)
                    const drawScale = 1.0 / (1.0 + airbrushAmount * 1.5); // compensated scale
                    const drawSize = Math.max(1, size * drawScale);
                    const offset = (size - drawSize) / 2;

                    const cacheKey = `${airbrushAmount}_${size}`;
                    
                    if (!this._tipColorCache || this._tipColorCache.srcTip !== this.brush.tip || this._tipColorCache.color !== color || this._tipColorCache.key !== cacheKey) {
                        const tempSize = Math.max(1, size);
                        const temp = document.createElement('canvas');
                        temp.width = tempSize;
                        temp.height = tempSize;
                        const tctx = temp.getContext('2d');
                        
                        if (airbrushAmount > 0) {
                            tctx.filter = `blur(${airbrushBlur}px)`;
                        }
                        
                        tctx.fillStyle = color;
                        tctx.fillRect(0, 0, tempSize, tempSize);
                        tctx.globalCompositeOperation = 'destination-in';
                        tctx.drawImage(this.brush.tip, offset, offset, drawSize, drawSize);
                        tctx.filter = 'none';
                        this._tipColorCache = { canvas: temp, srcTip: this.brush.tip, color: color, key: cacheKey };
                    }
                    
                    const tipCanvas = this._tipColorCache.canvas;
                    
                    if (this.brush.paintHeight > 0 && !isEraser && !isSmudge) {
                        const h = this.brush.paintHeight;
                        const opacityBase = opacity * this.brush.flow * this.brush.opacity;
                        const oil = this.brush.oiliness ?? 0.5;
                        const airbrushAmount = this.brush.airbrush || 0;
                        // Reduce extra blur from oiliness if tip is already blurred by airbrush
                        const reliefBlur = oil * 4 * (1 - airbrushAmount * 0.4); 

                        // Pre-prepare relief tips for the segment if possible
                        const reliefKey = `${size}_${reliefBlur}_${airbrushAmount}`;
                        if (!this._reliefCache || this._reliefCache.srcTip !== this.brush.tip || this._reliefCache.key !== reliefKey) {
                            const tempSize = Math.max(1, size);
                            
                            const sTip = document.createElement('canvas');
                            sTip.width = tempSize; sTip.height = tempSize;
                            const sCtx = sTip.getContext('2d');
                            
                            const hTip = document.createElement('canvas');
                            hTip.width = tempSize; hTip.height = tempSize;
                            const hCtx = hTip.getContext('2d');

                            // Use the already colored (and potentially blurred) tip as source for height map
                            const sourceForRelief = this._tipColorCache.canvas;

                            if (reliefBlur > 0) sCtx.filter = `blur(${reliefBlur}px)`;
                            sCtx.fillStyle = 'black';
                            sCtx.fillRect(0,0,tempSize,tempSize);
                            sCtx.globalCompositeOperation = 'destination-in';
                            sCtx.drawImage(sourceForRelief, 0, 0);
                            
                            if (reliefBlur > 0) hCtx.filter = `blur(${reliefBlur}px)`;
                            hCtx.fillStyle = 'white';
                            hCtx.fillRect(0,0,tempSize,tempSize);
                            hCtx.globalCompositeOperation = 'destination-in';
                            hCtx.drawImage(sourceForRelief, 0, 0);
                            
                            this._reliefCache = { key: reliefKey, shadow: sTip, highlight: hTip, srcTip: this.brush.tip };
                        }

                        // Shadow (offset south-east)
                        ctx.save();
                        ctx.globalCompositeOperation = 'multiply';
                        ctx.translate(1, 1);
                        ctx.globalAlpha = opacityBase * h * 0.4;
                        ctx.drawImage(this._reliefCache.shadow, -size/2, -size/2);
                        ctx.restore();

                        // Highlight (offset north-west)
                        ctx.save();
                        ctx.globalCompositeOperation = 'screen';
                        ctx.translate(-1, -1);
                        ctx.globalAlpha = opacityBase * h * 0.25; // More subtle highlight
                        ctx.drawImage(this._reliefCache.highlight, -size/2, -size/2);
                        ctx.restore();
                    }

                    ctx.drawImage(tipCanvas, -size / 2, -size / 2);
                } else {
                    ctx.fillRect(-s / 2, -s / 4, s, s / 2);
                }
            }
            
            ctx.restore();
            currentPos += Math.max(0.5, step);
        }
        
        ctx.restore();
      }
    }
  }

  addReferenceImage(img, name, x = null, y = null, config = {}) {
    const rect = this.container.getBoundingClientRect();
    const wx = x !== null ? x : (-this.pan.x + rect.width / 2) / this.zoom;
    const wy = y !== null ? y : (-this.pan.y + rect.height / 2) / this.zoom;

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
    this.selectedRefIndex = this.referenceImages.length - 1;
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
