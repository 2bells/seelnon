import { CHUNK_SIZE as DEFAULT_CHUNK_SIZE, LAYERS_COUNT, TOOLS } from './constants.js';
import * as liquifyNew from './tools/liquify.js';
import * as liquifyOld from './tools/liquify_was_fast.js';
import { paintWireframeIncrementally } from './tools/wireframe.js';
import {
  drawLasso,
  updateSelectionPreview,
  processLassoSelection,
  applySelection,
  normalizeSelectionPath,
  drawSelectionMask
} from './tools/selection.js';
import { paintSmudgeOnChunks } from './tools/smudge.js';
import { isMobileDevice } from './colorUtils.js';

import {
  getContainerRect,
  _screenToWorld,
  _worldToScreen,
  _getMousePos,
  _worldToScreenScale
} from './engine/coordinates.js';
import {
  _initGesture,
  _handleGesture,
  setZoom,
  setRotation,
  fitZoom,
  saveViewport,
  loadViewport
} from './engine/gestures.js';
import {
  _startStroke,
  _moveStroke,
  _endStroke,
  _paintCurveOnChunks,
  _paintWireframeIncrementally,
  _paintOnChunks
} from './engine/stroke.js';
import {
  _disposeAction,
  _pushHistory,
  _clearStack,
  compact,
  undo,
  redo
} from './engine/history.js';
import {
  _updateMobileGridPosition,
  setupBoard,
  refreshGrid,
  _generateGridTexture
} from './engine/grid.js';


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
      jitterSize: 0,
      jitterAngle: 0,
      jitterPos: 0,
      jitterHue: 0,
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
    this.transformMode = 'move';
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
    this.gridThickness = 2;
    this.gridIntensity = 1.0;
    this.showGrid = true;
    this.isMirrored = false;
    this.isCapturingTip = false;
    
    // Texture Reveal / Paint Mode
    this.textureModeEnabled = false;
    this.texturePattern = 'dot'; // 'dot', 'square', 'line', 'triangle'
    this.textureDensity = 0.5;   // 0.0 to 1.0
    this.textureGridSize = 16;   // spacing in pixels
    this._currentTexturePattern = null;
    this._lastTextureParams = null;
    
    this.activePointers = new Map(); // For multitouch gestures
    this._gridTexture = null;
    this._lastGridParams = null;
    this.worldCenter = 200000;
    
    this.captureReticle = document.getElementById('capture-reticle');
    
    // Static canvas state properties
    this.isStatic = false;
    this.staticWidth = 2400;
    this.staticHeight = 3600;
    this.dpiScale = 1.0;

    // Dedicated wrapper for all canvas content that can be mirrored
    this.canvasWrapper = document.createElement('div');
    this.canvasWrapper.id = 'canvas-wrapper';
    this.canvasWrapper.className = 'absolute';
    
    // Dedicated board container to hold chunks and elements (acting as paper sheet)
    this.boardContainer = document.createElement('div');
    this.boardContainer.id = 'board-container';
    this.boardContainer.style.position = 'absolute';
    this.canvasWrapper.appendChild(this.boardContainer);

    // Dedicated layer for reference images (nested inside canvasWrapper)
    this.refLayer = document.createElement('div');
    this.refLayer.className = 'absolute inset-0';
    this.canvasWrapper.appendChild(this.refLayer);

    // Make wrapper larger to handle rotation without edges showing
    this.canvasWrapper.style.width = `${this.worldCenter * 2}px`;
    this.canvasWrapper.style.height = `${this.worldCenter * 2}px`;
    this.canvasWrapper.style.left = `calc(50% - ${this.worldCenter}px)`;
    this.canvasWrapper.style.top = `calc(50% - ${this.worldCenter}px)`;
    this.canvasWrapper.style.transformOrigin = `${this.worldCenter}px ${this.worldCenter}px`;
    this.canvasWrapper.style.backgroundColor = 'transparent'; // Let setupBoard draw paper
    this.container.appendChild(this.canvasWrapper);

    if (!this.scratchCanvas) {
        this.scratchCanvas = document.createElement('canvas');
        this.scratchCtx = this.scratchCanvas.getContext('2d', { alpha: true });
    }

    this.brushCursor = document.getElementById('brush-cursor');
    this.brushCrosshair = document.getElementById('brush-crosshair');
    if (this.brushCursor) this.container.appendChild(this.brushCursor);
    if (this.brushCrosshair) this.container.appendChild(this.brushCrosshair);

    this.lastPos = null;
    this.lastMousePos = { x: 0, y: 0 };
    this.lastTime = null;
    this.smoothedVelocity = 0;
    this.zoomAnchor = null;

    this.loadViewport();
    this.setupBoard();
    
    // Dedicated UI Layer for overlays (Selection, Lasso, etc)
    this.uiLayer = document.createElement('div');
    this.uiLayer.className = 'absolute inset-0 pointer-events-none z-100 w-full h-full';
    this.container.appendChild(this.uiLayer);

    // Selection Viz Overlay
    this.selectionViz = document.createElement('canvas');
    this.selectionViz.className = 'absolute inset-0 pointer-events-none';
    this.uiLayer.appendChild(this.selectionViz);

    this._initEvents();
    window.addEventListener('resize', () => {
        this._containerRect = null;
        this.refresh();
    });
    this.offscreenDirty = new Set();
    this._startAnimationLoop();
  }

  _startAnimationLoop() {
      const loop = () => {
          this._drawSelectionViz();
          requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
  }

  resetEngineState() {
      // Clear chunks from DOM and reset
      this.chunks.forEach(chunk => {
          if (chunk.isAttached && chunk.element.parentNode) {
              chunk.element.remove();
          }
          chunk.canvases.forEach(c => {
              c.width = 0;
              c.height = 0;
          });
          if (chunk.strokeCanvas) {
              chunk.strokeCanvas.width = 0;
              chunk.strokeCanvas.height = 0;
          }
      });
      this.chunks.clear();
      this.dirtyChunks.clear();

      // Clear ref images from DOM
      this.referenceImages.forEach(ref => {
          if (ref.element && ref.element.parentNode) {
              ref.element.remove();
          }
      });
      this.referenceImages = [];
      this.selectedRefIndex = -1;
      this.refsDirty = false;
      this.pan = { x: 0, y: 0 };
      this.zoom = 1.0;
      
      this.history = [];
      this.redoStack = [];
      this.activeSelectionPath = null;
      this.floatingSelection = null;
      this.activeLayer = 2; // Default to layer 2
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
        const chunkX = this.isStatic ? -this.staticWidth / 2 : chunk.cx * this.chunkSize;
        const chunkY = this.isStatic ? -this.staticHeight / 2 : chunk.cy * this.chunkSize;
        const chunkW = this.isStatic ? this.staticWidth : this.chunkSize;
        const chunkH = this.isStatic ? this.staticHeight : this.chunkSize;
        
        if (chunkX < rect.x + rect.w && chunkX + chunkW > rect.x &&
            chunkY < rect.y + rect.h && chunkY + chunkH > rect.y) {
            
            for (let i = 1; i < LAYERS_COUNT; i++) {
                const srcX = Math.max(0, rect.x - chunkX);
                const srcY = Math.max(0, rect.y - chunkY);
                const overlapX = Math.max(chunkX, rect.x);
                const overlapY = Math.max(chunkY, rect.y);
                const overlapW = Math.min(chunkX + chunkW, rect.x + rect.w) - overlapX;
                const overlapH = Math.min(chunkY + chunkH, rect.y + rect.h) - overlapY;

                if (overlapW > 0 && overlapH > 0) {
                    const dstX = (overlapX - rect.x) * this.zoom;
                    const dstY = (overlapY - rect.y) * this.zoom;
                    const dstW = overlapW * this.zoom;
                    const dstH = overlapH * this.zoom;
                    
                    const scale = this.isStatic ? this.dpiScale : 1;
                    const sx = (overlapX - chunkX) * scale;
                    const sy = (overlapY - chunkY) * scale;
                    const sw = overlapW * scale;
                    const sh = overlapH * scale;
                    tctx.drawImage(chunk.canvases[i], sx, sy, sw, sh, dstX, dstY, dstW, dstH);
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
        this._containerRect = null;
        if (e.pointerType === 'pen' || e.pointerType === 'touch') {
            this.lastPenTouchTime = performance.now();
        }

        // UI SHIELD: Ignore if hitting any UI element
        if (e.target !== this.container && e.target.closest('.ui-panel, .tool-btn, .brutal-btn, .dots-btn, #top-bar, #top-bar-ref, .brutal-range, button, input, select')) {
            return;
        }

        // Stop browser gestures, drag-outs, selection, especially for Alt-click and Windows Ink
        if (e.cancelable) e.preventDefault();
        
        // Prioritize non-mouse pointers (Pen/Touch)
        const pointers = Array.from(this.activePointers.values());
        const hasNonMouse = pointers.some(p => p.pointerType !== 'mouse');
        
        // If we have a pen/touch active, ignore any new mouse downs
        if (hasNonMouse && e.pointerType === 'mouse') return;
        
        // If this is a pen/touch down, clear any ghost mouse pointers
        if (e.pointerType !== 'mouse') {
            for (const [id, p] of this.activePointers) {
                if (p.pointerType === 'mouse') this.activePointers.delete(id);
            }
        }

        this.activePointers.set(e.pointerId, e);

        const currentPointers = Array.from(this.activePointers.values());
        const hasPen = currentPointers.some(p => p.pointerType === 'pen');
        const hasTouch = currentPointers.some(p => p.pointerType === 'touch');

        // IF we have a pen, IGNORE ALL touch pointers in the map (and from event)
        if (hasPen && e.pointerType === 'touch') {
            this.activePointers.delete(e.pointerId);
            return;
        }

        if (this.activePointers.size > 1) {
            // Only allow gestures if ALL active pointers are touch (no pen interfering)
            const allTouch = currentPointers.every(p => p.pointerType === 'touch');
            if (allTouch) {
                // Cancel current stroke if a second finger is added
                if (this.isDrawing) {
                    this._endStroke();
                }
                this.isGesture = true;
                this._initGesture();
            } else if (hasPen) {
                // If we have a pen and something else, keep only the pen
                for (const [id, p] of this.activePointers) {
                    if (p.pointerType !== 'pen') this.activePointers.delete(id);
                }
            }
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

    // Block browser gestures and selection on the canvas
    this.container.addEventListener('selectstart', (e) => e.preventDefault());
    this.container.addEventListener('gesturestart', (e) => e.preventDefault());
    this.container.addEventListener('gesturechange', (e) => e.preventDefault());
    this.container.addEventListener('gestureend', (e) => e.preventDefault());

    window.addEventListener('pointermove', (e) => {
      // Stop browser gestures (zoom/pan) especially for Windows Ink/Stylus
      if (e.cancelable && e.target === this.container) e.preventDefault();

      if (e.pointerType === 'pen' || e.pointerType === 'touch') {
          this.lastPenTouchTime = performance.now();
      }

      // Ignore simulated mouse events right after pen/touch interaction to prevent cursor teleportation at stroke start/end
      if (e.pointerType === 'mouse' && this.lastPenTouchTime && (performance.now() - this.lastPenTouchTime < 1000)) {
          return;
      }

      // Ignore mouse moves if we already have non-mouse pointers active, BUT only if target is the canvas
      // This allows mouse to still work on UI sliders even if stylus is hovering.
      const hasNonMouse = Array.from(this.activePointers.values()).some(p => p.pointerType !== 'mouse');
      if (hasNonMouse && e.pointerType === 'mouse' && e.target === this.container) return;

      const pointers = Array.from(this.activePointers.values());
      const hasPen = pointers.some(p => p.pointerType === 'pen');
      if (hasPen && e.pointerType === 'touch') {
          this.activePointers.delete(e.pointerId);
          return;
      }

      this.activePointers.set(e.pointerId, e);

      // Filter pointers list again after set
      const currentPointers = Array.from(this.activePointers.values());
      const nonMouseCount = currentPointers.filter(p => p.pointerType !== 'mouse').length;
      
      if (this.isGesture && nonMouseCount > 1) {
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
        
        if (e.pointerType === 'pen' || e.pointerType === 'touch') {
            this.lastPenTouchTime = performance.now();
        }
        
        if (this.activePointers.size < 2) {
            const wasGesture = this.isGesture;
            this.isGesture = false;
            if (wasGesture) {
                this.refresh();
            }
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
    window.addEventListener('pointerout', (e) => {
        this.activePointers.delete(e.pointerId);
        if (e.pointerType !== 'mouse') {
            if (this.brushCursor) this.brushCursor.style.display = 'none';
            if (this.brushCrosshair) this.brushCrosshair.style.display = 'none';
        }
    });
    window.addEventListener('pointerleave', (e) => {
        this.activePointers.delete(e.pointerId);
        if (e.pointerType !== 'mouse') {
            if (this.brushCursor) this.brushCursor.style.display = 'none';
            if (this.brushCrosshair) this.brushCrosshair.style.display = 'none';
        }
    });

    // Reset pointing and typing states when leaving active window
    const handleReset = () => {
        if (this.isDrawing) {
            this._endStroke();
        }
        this.activePointers.clear();
        this.isDrawing = false;
        this.isPanning = false;
        this.isGesture = false;
        this.isMouseDown = false;
        this.keys = {};
        this._updateCursor();
    };

    window.addEventListener('blur', handleReset);

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            handleReset();
        }
    });
       
    window.addEventListener('keydown', (e) => {
        if (
            document.activeElement && 
            (document.activeElement.tagName === 'INPUT' || 
             document.activeElement.tagName === 'TEXTAREA' || 
             document.activeElement.tagName === 'SELECT' || 
             document.activeElement.isContentEditable)
        ) {
            return;
        }
        const key = e.key.toLowerCase();
        
        if (key === 'alt') {
            e.preventDefault();
        }
        
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
        if (
            document.activeElement && 
            (document.activeElement.tagName === 'INPUT' || 
             document.activeElement.tagName === 'TEXTAREA' || 
             document.activeElement.tagName === 'SELECT' || 
             document.activeElement.isContentEditable)
        ) {
            return;
        }
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
    return _getMousePos.call(this, e);
  }

  _screenToWorld(x, y) {
    return _screenToWorld.call(this, x, y);
  }

  _updateCursor() {
    if (this.isDrawing) {
        this.container.style.cursor = 'none';
    } else if (this.isPanning || this.keys[' ']) {
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
          if (chunk._cachedOffscreenImageData) {
              chunk._cachedOffscreenImageData[layer] = null;
          }
      }
      this.dirtyChunks.add(`${id}|${layer}`);
      if (!this.offscreenDirty) {
          this.offscreenDirty = new Set();
      }
      this.offscreenDirty.add(`${id}|${layer}`);
  }

  clearAllOffscreenCanvases() {
      this.chunks.forEach(chunk => {
          if (chunk.offscreenCanvases) {
              chunk.offscreenCanvases.forEach(canv => {
                  if (canv) {
                      canv.width = 0;
                      canv.height = 0;
                  }
              });
              chunk.offscreenCanvases = [];
              chunk.offscreenCtxs = [];
          }
          if (chunk._cachedOffscreenImageData) {
              chunk._cachedOffscreenImageData = [];
          }
      });
  }

  syncOffscreenCanvases() {
      if (isMobileDevice) {
          if (this.offscreenDirty) this.offscreenDirty.clear();
          return;
      }
      if (!this.offscreenDirty || this.offscreenDirty.size === 0) return;
      for (const item of this.offscreenDirty) {
          const [chunkId, layerStr] = item.split('|');
          const l = parseInt(layerStr);
          const chunk = this.chunks.get(chunkId);
          if (chunk) {
              this._syncChunkOffscreen(chunk, l);
          }
      }
      this.offscreenDirty.clear();
  }

  _syncChunkOffscreen(chunk, l) {
      if (isMobileDevice) return;
      if (!chunk.offscreenCanvases) {
          chunk.offscreenCanvases = [];
          chunk.offscreenCtxs = [];
      }
      while (chunk.offscreenCanvases.length < LAYERS_COUNT) {
          chunk.offscreenCanvases.push(null);
          chunk.offscreenCtxs.push(null);
      }
      
      let offCanv = chunk.offscreenCanvases[l];
      if (!offCanv) {
          offCanv = document.createElement('canvas');
          offCanv.width = chunk.canvases[l].width;
          offCanv.height = chunk.canvases[l].height;
          chunk.offscreenCanvases[l] = offCanv;
          chunk.offscreenCtxs[l] = offCanv.getContext('2d', { willReadFrequently: true });
      }
      
      const oCtx = chunk.offscreenCtxs[l];
      if (oCtx) {
          oCtx.clearRect(0, 0, offCanv.width, offCanv.height);
          oCtx.drawImage(chunk.canvases[l], 0, 0);
      }
  }

  _getChunkCoords(x, y) {
    if (this.isStatic) {
        return { cx: 0, cy: 0 };
    }
    const pos = this._getMousePos({ clientX: x, clientY: y });
    const cx = Math.floor(pos.wx / this.chunkSize);
    const cy = Math.floor(pos.wy / this.chunkSize);
    return { cx, cy };
  }

  _getChunk(cx, cy) {
    if (this.isStatic) {
        cx = 0;
        cy = 0;
    }
    const id = `${cx},${cy}`;
    if (this.chunks.has(id)) {
        return this.chunks.get(id);
    }

    const w = this.isStatic ? this.staticWidth : this.chunkSize;
    const h = this.isStatic ? this.staticHeight : this.chunkSize;

    const chunk = {
      cx, cy,
      canvases: [],
      ctxs: [],
      offscreenCanvases: [],
      offscreenCtxs: [],
      isEmpty: new Array(LAYERS_COUNT).fill(true),
      element: document.createElement('div'),
      isAttached: false,
      strokeCanvas: null,
      strokeCtx: null,
      width: w,
      height: h
    };

    chunk.element.className = 'absolute pointer-events-none';
    const scale = this.isStatic ? this.dpiScale : 1;
    
    for (let i = 0; i < LAYERS_COUNT; i++) {
      const canv = document.createElement('canvas');
      canv.width = chunk.width * scale;
      canv.height = chunk.height * scale;
      canv.className = 'absolute inset-0';
      canv.style.touchAction = 'none';
      canv.style.imageRendering = 'auto'; 
      canv.style.backfaceVisibility = 'hidden';
      canv.style.webkitBackfaceVisibility = 'hidden';
      canv.style.transform = 'translate3d(0, 0, 0)';
      canv.style.willChange = 'transform';
      
      chunk.canvases.push(canv);
      const ctx = canv.getContext('2d', { alpha: true });
      if (scale !== 1) {
          ctx.scale(scale, scale);
      }
      chunk.ctxs.push(ctx);
      
      // Respect visibility
      if (this.layerSettings[i]) {
          canv.style.display = this.layerSettings[i].visible ? 'block' : 'none';
      }
      chunk.element.appendChild(canv);
    }

    chunk.strokeCanvas = null;
    chunk.strokeCtx = null;

    this.chunks.set(id, chunk);
    this._updateChunkTransform(chunk);
    
    const rect = this.container.getBoundingClientRect();
    if (rect.width && rect.height) {
        const cxCenter = rect.width / 2;
        const cyCenter = rect.height / 2;
        const center = this._screenToWorld(cxCenter, cyCenter);
        const diag = Math.sqrt(rect.width * rect.width + rect.height * rect.height);
        const radius = (diag / 2) / (this.zoom || 1);
        const cullingRadius = radius + this.chunkSize * 2.5;

        const wx = (chunk.cx + 0.5) * this.chunkSize;
        const wy = (chunk.cy + 0.5) * this.chunkSize;
        const dx = wx - center.wx;
        const dy = wy - center.wy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= cullingRadius) {
            this.boardContainer.appendChild(chunk.element);
            chunk.isAttached = true;
        }
    } else {
        this.boardContainer.appendChild(chunk.element);
        chunk.isAttached = true;
    }

    return chunk;
  }

  _ensureStrokeCanvas(chunk) {
    const scale = this.isStatic ? this.dpiScale : 1;
    if (!chunk.strokeCanvas) {
        const strokeCanv = document.createElement('canvas');
        strokeCanv.width = chunk.width * scale;
        strokeCanv.height = chunk.height * scale;
        strokeCanv.className = 'absolute inset-0';
        strokeCanv.style.imageRendering = 'auto';
        strokeCanv.style.backfaceVisibility = 'hidden';
        strokeCanv.style.webkitBackfaceVisibility = 'hidden';
        strokeCanv.style.transform = 'translate3d(0, 0, 0)';
        strokeCanv.style.willChange = 'transform';
        strokeCanv.style.opacity = '0';
        chunk.strokeCanvas = strokeCanv;
        const sCtx = strokeCanv.getContext('2d', { alpha: true });
        if (scale !== 1) {
            sCtx.scale(scale, scale);
        }
        chunk.strokeCtx = sCtx;
    }

    // Always position strokeCanvas immediately above the active layer's canvas inside chunk.element.
    // This ensures during the active painting stroke, any higher layers are drawn on top.
    const nextCanvas = chunk.canvases[this.activeLayer + 1];
    if (nextCanvas) {
        if (chunk.strokeCanvas.nextSibling !== nextCanvas) {
            chunk.element.insertBefore(chunk.strokeCanvas, nextCanvas);
        }
    } else {
        if (chunk.element.lastChild !== chunk.strokeCanvas) {
            chunk.element.appendChild(chunk.strokeCanvas);
        }
    }
  }

  promoteAllToGPU() {
    this.chunks.forEach(chunk => {
        for (let i = 0; i < LAYERS_COUNT; i++) {
            const ctx = chunk.ctxs[i];
            if (ctx) {
                // Draw a tiny transparent 2x2 rect utilizing extremely small opacity and alpha.
                ctx.save();
                ctx.globalAlpha = 0.001;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.001)';
                ctx.fillRect(0, 0, 2, 2);
                ctx.restore();
            }
        }
    });
  }

  updateCulling(force = false) {
    if (this.isStatic) {
        this.chunks.forEach(chunk => {
            if (!chunk.isAttached) {
                this.boardContainer.appendChild(chunk.element);
                chunk.isAttached = true;
            }
        });
        return;
    }

    const rect = this.getContainerRect();
    if (!rect.width || !rect.height) return;

    if (!force) {
        const dx = this.pan.x - (this._lastCullPan ? this._lastCullPan.x : 0);
        const dy = this.pan.y - (this._lastCullPan ? this._lastCullPan.y : 0);
        const distSq = dx * dx + dy * dy;
        const zoomRatio = Math.abs(this.zoom - (this._lastCullZoom || 0)) / (this._lastCullZoom || 1);
        
        // Only run culling when shift > 200px (40000 px^2) or zoom > 5%
        if (this._lastCullPan && this._lastCullZoom && distSq < 40000 && zoomRatio < 0.05) {
            return;
        }
    }

    this._lastCullPan = { x: this.pan.x, y: this.pan.y };
    this._lastCullZoom = this.zoom;

    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const center = this._screenToWorld(cx, cy);
    
    const diag = Math.sqrt(rect.width * rect.width + rect.height * rect.height);
    const radius = (diag / 2) / (this.zoom || 1);
    const cullingRadius = radius + this.chunkSize * 2.5;
    
    this.chunks.forEach(chunk => {
        const wx = (chunk.cx + 0.5) * this.chunkSize;
        const wy = (chunk.cy + 0.5) * this.chunkSize;
        
        const dx = wx - center.wx;
        const dy = wy - center.wy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        let isVisible = dist <= cullingRadius;
        
        if (this.floatingSelection) {
            const sel = this.floatingSelection;
            const scX = sel.scaleX !== undefined ? sel.scaleX : (sel.scale || 1);
            const scY = sel.scaleY !== undefined ? sel.scaleY : (sel.scale || 1);
            const rot = sel.rotation || 0;
            const cos = Math.abs(Math.cos(rot));
            const sin = Math.abs(Math.sin(rot));
            const bbW = (sel.canvas.width * scX * cos + sel.canvas.height * scY * sin);
            const bbH = (sel.canvas.width * scX * sin + sel.canvas.height * scY * cos);

            const startCX = this.isStatic ? 0 : Math.floor((sel.x + sel.canvas.width / 2 - bbW / 2) / this.chunkSize);
            const startCY = this.isStatic ? 0 : Math.floor((sel.y + sel.canvas.height / 2 - bbH / 2) / this.chunkSize);
            const endCX = this.isStatic ? 0 : Math.floor((sel.x + sel.canvas.width / 2 + bbW / 2) / this.chunkSize);
            const endCY = this.isStatic ? 0 : Math.floor((sel.y + sel.canvas.height / 2 + bbH / 2) / this.chunkSize);

            if (chunk.cx >= startCX && chunk.cx <= endCX && chunk.cy >= startCY && chunk.cy <= endCY) {
                isVisible = true;
            }
        }
        
        if (isVisible) {
            if (!chunk.isAttached) {
                this.boardContainer.appendChild(chunk.element);
                chunk.isAttached = true;
                // Newly attached chunk should get its transform applied immediately
                this._updateChunkTransform(chunk);
            }
        } else {
            if (chunk.isAttached) {
                chunk.element.remove();
                chunk.isAttached = false;
            }
        }
    });
  }

  _updateChunkTransform(chunk) {
    // Position offset calculation depends on whether we are in a static size layout or infinite
    const offsetX = this.isStatic ? 0 : this.worldCenter;
    const offsetY = this.isStatic ? 0 : this.worldCenter;
    const x = chunk.cx * this.chunkSize + offsetX;
    const y = chunk.cy * this.chunkSize + offsetY;
    chunk.element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    
    if (this.isStatic) {
        chunk.element.style.width = `${this.staticWidth}px`;
        chunk.element.style.height = `${this.staticHeight}px`;
    } else {
        const overlap = Math.max(1, Math.ceil(1.8 / (this.zoom || 1)));
        chunk.element.style.width = `${this.chunkSize + overlap}px`;
        chunk.element.style.height = `${this.chunkSize + overlap}px`;
    }
    chunk.element.style.transformOrigin = 'top left';
  }

  _updateRefImagesTransform() {
    const rect = this.getContainerRect();
    const hasRect = rect && rect.width && rect.height;
    
    let viewMinX = -Infinity, viewMaxX = Infinity, viewMinY = -Infinity, viewMaxY = Infinity;
    if (hasRect) {
        const topLeft = this._screenToWorld(0, 0);
        const bottomRight = this._screenToWorld(rect.width, rect.height);
        
        const minX = Math.min(topLeft.wx, bottomRight.wx);
        const maxX = Math.max(topLeft.wx, bottomRight.wx);
        const minY = Math.min(topLeft.wy, bottomRight.wy);
        const maxY = Math.max(topLeft.wy, bottomRight.wy);
        
        const pad = 200 / (this.zoom || 1);
        viewMinX = minX - pad;
        viewMaxX = maxX + pad;
        viewMinY = minY - pad;
        viewMaxY = maxY + pad;
    }

    this.referenceImages.forEach((ref, index) => {
        if (!ref.element) return;
        
        const imgW = ref.img.width || 100;
        const imgH = ref.img.height || 100;
        const halfDiag = Math.sqrt(imgW * imgW + imgH * imgH) * ref.scale / 2;
        
        const isVisible = (ref.x + halfDiag >= viewMinX) && (ref.x - halfDiag <= viewMaxX) &&
                          (ref.y + halfDiag >= viewMinY) && (ref.y - halfDiag <= viewMaxY);
                          
        if (!isVisible) {
            ref.element.style.display = 'none';
            return;
        }
        
        ref.element.style.display = 'block';

        const offsetX = this.worldCenter;
        const offsetY = this.worldCenter;
        const x = ref.x + offsetX;
        const y = ref.y + offsetY;
        
        let transform = `translate3d(${x}px, ${y}px, 0px) rotate(${ref.rotation}rad) scale(${ref.scale})`;
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

  getContainerRect() {
    return getContainerRect.call(this);
  }

  refreshTransforms() {
    this.updateCulling();
    
    // Zoom/Dimension changes affect static size width/height or overlap calculation,
    // so we only update individual chunk attributes when zoom changes.
    const zoomChanged = this.zoom !== this._lastTransformZoom;
    if (zoomChanged && !this.isGesture) {
        this.chunks.forEach(chunk => {
            if (chunk.isAttached) {
                this._updateChunkTransform(chunk);
            }
        });
        this._lastTransformZoom = this.zoom;
    }
    this._updateRefImagesTransform();
    
    // Move pan and zoom to the wrapper to prevent sub-pixel gaps between chunks
    const px = Math.round(this.pan.x);
    const py = Math.round(this.pan.y);
    
    // Use container dimensions to center exactly on pixels
    const rect = this.getContainerRect();
    const ox = Math.floor(rect.width / 2) - this.worldCenter;
    const oy = Math.floor(rect.height / 2) - this.worldCenter;
    
    if (ox !== this._lastWrapperOx || oy !== this._lastWrapperOy) {
        this.canvasWrapper.style.left = `${ox}px`;
        this.canvasWrapper.style.top = `${oy}px`;
        this._lastWrapperOx = ox;
        this._lastWrapperOy = oy;
    }
    
    let transform = `translate3d(${px}px, ${py}px, 0) scale(${this.zoom}) rotate(${this.rotation}rad)`;
    if (this.isMirrored) {
        transform += ' scaleX(-1)';
    }
    this.canvasWrapper.style.transform = transform;
    
    // Sync the optimized high-performance mobile viewport grid
    this._updateMobileGridPosition();
  }

  _updateMobileGridPosition() {
    return _updateMobileGridPosition.call(this);
  }

  setupBoard(force = false) {
    return setupBoard.call(this, force);
  }

  refreshGrid() {
    return refreshGrid.call(this);
  }

  _generateGridTexture() {
    return _generateGridTexture.call(this);
  }

  refresh() {
    this.refreshTransforms();
    this.refreshGrid();
    this._drawSelectionViz();
    this._updateSelectionPreview();
    this._updateWireframeOverlay();
  }

  _worldToScreen(wx, wy) {
    return _worldToScreen.call(this, wx, wy);
  }

  _drawSelectionViz() {
      if (!this.selectionViz) return;
      
      const isExport = this.isExportMode;
      const hasLasso = !!(this.lassoPath && this.lassoPath.length > 0);
      const hasSelection = !!(this.activeSelectionPath);
      
      if (!hasLasso && !hasSelection && !isExport) {
          if (this._selectionVizCleared) return;
          const ctx = this.selectionViz.getContext('2d');
          const rect = this.getContainerRect();
          ctx.clearRect(0, 0, rect.width, rect.height);
          this._selectionVizCleared = true;
          return;
      }
      this._selectionVizCleared = false;
      
      const ctx = this.selectionViz.getContext('2d');
      const rect = this.getContainerRect();
      if (this.selectionViz.width !== rect.width || this.selectionViz.height !== rect.height) {
          this.selectionViz.width = rect.width;
          this.selectionViz.height = rect.height;
      }
      ctx.clearRect(0, 0, rect.width, rect.height);
      
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
      } else {
          // Draw existing active selection if present
          if (hasSelection) {
              // 1. Ensure our offscreen mask layout canvases exist and have correct dimensions
              if (!this._tempMaskCanvas) {
                  this._tempMaskCanvas = document.createElement('canvas');
              }
              if (this._tempMaskCanvas.width !== rect.width || this._tempMaskCanvas.height !== rect.height) {
                  this._tempMaskCanvas.width = rect.width;
                  this._tempMaskCanvas.height = rect.height;
              }
              const tempMaskCtx = this._tempMaskCanvas.getContext('2d');
              tempMaskCtx.clearRect(0, 0, rect.width, rect.height);
              
              // Draw the unified compound mask onto tempMaskCanvas
              // All individual paths are rendered here.
              const norm = this.normalizeSelectionPath(this.activeSelectionPath);
              norm.forEach(sub => {
                  tempMaskCtx.beginPath();
                  const points = sub.points;
                  const skip = Math.max(1, Math.floor(points.length / 500));
                  points.forEach((p, i) => {
                      if (i % skip !== 0 && i !== points.length - 1) return;
                      const s = this._worldToScreen(p.x, p.y);
                      if (i === 0) tempMaskCtx.moveTo(s.x, s.y);
                      else tempMaskCtx.lineTo(s.x, s.y);
                  });
                  tempMaskCtx.closePath();
                  
                  if (sub.type === 'subtract') {
                      tempMaskCtx.globalCompositeOperation = 'destination-out';
                  } else {
                      tempMaskCtx.globalCompositeOperation = 'source-over';
                  }
                  tempMaskCtx.fillStyle = '#ffffff';
                  tempMaskCtx.fill();
              });

              // 2. Ensure our outline canvas exists and matches size
              if (!this._tempOutlineCanvas) {
                  this._tempOutlineCanvas = document.createElement('canvas');
              }
              if (this._tempOutlineCanvas.width !== rect.width || this._tempOutlineCanvas.height !== rect.height) {
                  this._tempOutlineCanvas.width = rect.width;
                  this._tempOutlineCanvas.height = rect.height;
              }
              const tempOutlineCtx = this._tempOutlineCanvas.getContext('2d');
              tempOutlineCtx.clearRect(0, 0, rect.width, rect.height);
              
              // Render edge boundaries by dilating and subtracting (classic erosion/dilation outline shader)
              tempOutlineCtx.save();
              // Offset offsets to draw dilated contour (1.5px border)
              const thickness = 1.5;
              const offsets = [
                  [-thickness, 0], [thickness, 0], [0, -thickness], [0, thickness],
                  [-thickness, -thickness], [thickness, thickness], [thickness, -thickness], [-thickness, thickness]
              ];
              offsets.forEach(([dx, dy]) => {
                  tempOutlineCtx.drawImage(this._tempMaskCanvas, dx, dy);
              });
              
              // Subtract center/original mask
              tempOutlineCtx.globalCompositeOperation = 'destination-out';
              tempOutlineCtx.drawImage(this._tempMaskCanvas, 0, 0);
              tempOutlineCtx.restore();

              // 3. Create the gorgeous animating marching-ants pattern if we haven't already
              if (!this._stripePatternCanvas) {
                  this._stripePatternCanvas = document.createElement('canvas');
                  this._stripePatternCanvas.width = 16;
                  this._stripePatternCanvas.height = 16;
                  const stripeCtx = this._stripePatternCanvas.getContext('2d');
                  // alternating blue and white stripes
                  stripeCtx.fillStyle = '#3b82f6';
                  stripeCtx.fillRect(0, 0, 16, 16);
                  stripeCtx.fillStyle = '#ffffff';
                  stripeCtx.beginPath();
                  stripeCtx.moveTo(0, 16);
                  stripeCtx.lineTo(16, 0);
                  stripeCtx.lineTo(16, 8);
                  stripeCtx.lineTo(8, 16);
                  stripeCtx.fill();
                  stripeCtx.beginPath();
                  stripeCtx.moveTo(0, 8);
                  stripeCtx.lineTo(8, 0);
                  stripeCtx.lineTo(0, 0);
                  stripeCtx.fill();
              }

              // 4. Fill with pattern, then mask it to the exact 1px outline
              ctx.save();
              const stripePat = ctx.createPattern(this._stripePatternCanvas, 'repeat');
              ctx.fillStyle = stripePat;
              
              const moveOffset = (Date.now() / 40) % 16;
              ctx.translate(moveOffset, 0);
              ctx.fillRect(-moveOffset, 0, rect.width + moveOffset, rect.height);
              ctx.restore();

              // Mask step
              ctx.save();
              ctx.globalCompositeOperation = 'destination-in';
              ctx.drawImage(this._tempOutlineCanvas, 0, 0);
              ctx.restore();
          }

          // Draw the actively dragging lasso if present (WITHOUT ctx.closePath())
          if (hasLasso) {
              const points = this.lassoPath;
              const skip = Math.max(1, Math.floor(points.length / 500));
              
              const strokeMode = this.lassoStrokeMode;
              const isAdditive = strokeMode === 'add' || (strokeMode === undefined && this.keys['shift']);
              const isSubtractive = strokeMode === 'subtract' || (strokeMode === undefined && this.keys['alt']);
              
              // Use distinctive colors for additive/subtractive lasso lines during draw
              let dragColor = '#3b82f6'; // normal blue
              if (isSubtractive) {
                  dragColor = '#ef4444'; // warm red for subtract path
              } else if (isAdditive) {
                  dragColor = '#10b981'; // green for add path
              }

              ctx.strokeStyle = dragColor;
              ctx.setLineDash([5, 5]);
              ctx.lineDashOffset = (Date.now() / 50) % 10;
              ctx.lineWidth = 2.0;
              
              ctx.beginPath();
              points.forEach((p, i) => {
                  if (i % skip !== 0 && i !== points.length - 1) return;
                  const s = this._worldToScreen(p.x, p.y);
                  if (i === 0) ctx.moveTo(s.x, s.y);
                  else ctx.lineTo(s.x, s.y);
              });
              ctx.stroke();

              // High-contrast second pass (dashed white offkey)
              ctx.strokeStyle = '#fff';
              ctx.lineDashOffset = (Date.now() / 50) % 10 + 5;
              ctx.lineWidth = 2.0;
              ctx.beginPath();
              points.forEach((p, i) => {
                  if (i % skip !== 0 && i !== points.length - 1) return;
                  const s = this._worldToScreen(p.x, p.y);
                  if (i === 0) ctx.moveTo(s.x, s.y);
                  else ctx.lineTo(s.x, s.y);
              });
              ctx.stroke();
          }
      }
      ctx.restore();
  }

  _updateExportReticle() {
      // Reticle is just visual, mostly handled by _drawSelectionViz for precision
  }

  _getSelectionData(clearSource = false) {
      if (!this.activeSelectionPath) return null;
      
      const norm = this.normalizeSelectionPath(this.activeSelectionPath);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      norm.forEach(sub => {
          sub.points.forEach(p => {
              minX = Math.min(minX, p.x);
              minY = Math.min(minY, p.y);
              maxX = Math.max(maxX, p.x);
              maxY = Math.max(maxY, p.y);
          });
      });

      // Align boundaries to exact integers with a 2-pixel padding to prevent subpixel antialiasing edge crops
      const padding = 2;
      const fMinX = Math.floor(minX) - padding;
      const fMinY = Math.floor(minY) - padding;
      const cMaxX = Math.ceil(maxX) + padding;
      const cMaxY = Math.ceil(maxY) + padding;

      const width = cMaxX - fMinX;
      const height = cMaxY - fMinY;
      if (width < 1 || height < 1) return null;

      const selectionCanvas = document.createElement('canvas');
      selectionCanvas.width = width;
      selectionCanvas.height = height;
      const sCtx = selectionCanvas.getContext('2d');

      const startCX = this.isStatic ? 0 : Math.floor(fMinX / this.chunkSize);
      const startCY = this.isStatic ? 0 : Math.floor(fMinY / this.chunkSize);
      const endCX = this.isStatic ? 0 : Math.floor(cMaxX / this.chunkSize);
      const endCY = this.isStatic ? 0 : Math.floor(cMaxY / this.chunkSize);

      const affectedChunks = new Map();

      // Draw all overlapping chunk pixels onto selectionCanvas first
      for (let cx = startCX; cx <= endCX; cx++) {
          for (let cy = startCY; cy <= endCY; cy++) {
              const id = `${cx},${cy}`;
              const chunk = this.chunks.get(id);
              if (!chunk) continue;
              const lx = this.isStatic ? -this.staticWidth / 2 : cx * this.chunkSize;
              const ly = this.isStatic ? -this.staticHeight / 2 : cy * this.chunkSize;
              
              sCtx.drawImage(chunk.canvases[this.activeLayer], lx - fMinX, ly - fMinY, chunk.width, chunk.height);
          }
      }

      // Intersect selectionCanvas with our compound selection mask using destination-in
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = width;
      maskCanvas.height = height;
      const maskCtx = maskCanvas.getContext('2d');
      this.drawSelectionMask(maskCtx, this.activeSelectionPath, fMinX, fMinY);

      sCtx.save();
      sCtx.globalCompositeOperation = 'destination-in';
      sCtx.drawImage(maskCanvas, 0, 0);
      sCtx.restore();

      // Clear the source areas if requested
      if (clearSource) {
          for (let cx = startCX; cx <= endCX; cx++) {
              for (let cy = startCY; cy <= endCY; cy++) {
                  const id = `${cx},${cy}`;
                  const chunk = this.chunks.get(id);
                  if (!chunk) continue;
                  const lx = this.isStatic ? -this.staticWidth / 2 : cx * this.chunkSize;
                  const ly = this.isStatic ? -this.staticHeight / 2 : cy * this.chunkSize;

                  // Backup for undo
                  const srcCanvas = chunk.canvases[this.activeLayer];
                  const backup = document.createElement('canvas');
                  backup.width = srcCanvas.width;
                  backup.height = srcCanvas.height;
                  backup.getContext('2d').drawImage(srcCanvas, 0, 0);
                  affectedChunks.set(id, { layer: this.activeLayer, canvas: backup });

                  // Create chunk-local selection mask
                  const chunkMask = document.createElement('canvas');
                  chunkMask.width = chunk.width;
                  chunkMask.height = chunk.height;
                  const cmCtx = chunkMask.getContext('2d');
                  this.drawSelectionMask(cmCtx, this.activeSelectionPath, lx, ly);

                  // Subtract mask from main context
                  const ctx = chunk.ctxs[this.activeLayer];
                  ctx.save();
                  ctx.globalCompositeOperation = 'destination-out';
                  ctx.drawImage(chunkMask, 0, 0);
                  ctx.restore();
                  
                  this._markDirty(id, this.activeLayer);
              }
          }
      }

      return {
          canvas: selectionCanvas,
          x: fMinX,
          y: fMinY,
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
          this._pushHistory({ 
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
      
      const prevSelection = this.floatingSelection ? { ...this.floatingSelection } : null;
      const prevPath = this.activeSelectionPath ? [...this.activeSelectionPath] : null;

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

      this._pushHistory({
          type: 'transform',
          chunks: new Map(), // No base pixels deleted or painted in the background automatically
          path: prevPath,
          selection: prevSelection
      });

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

      this._pushHistory({ 
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
      
      const data = this._getSelectionData(true);
      if (data) {
          this._pushHistory({ 
              type: 'stroke', 
              chunks: data.affectedChunks 
          });
      }

      this.clearSelection();
      this.refresh();
      this._status('DELETED');
      if (this.onDrawEnd) this.onDrawEnd();
  }

  _status(text) {
      if (this.onStatus) this.onStatus(text);
  }

  pickColor(x, y) {
    const m = this._getMousePos({ clientX: x, clientY: y, altKey: true });
    const wx = m.wx;
    const wy = m.wy;

    if (!this._pickerCanvas) {
      this._pickerCanvas = document.createElement('canvas');
      this._pickerCanvas.width = 1;
      this._pickerCanvas.height = 1;
      // using willReadFrequently: true is key for GPU->CPU readback performance, but buggy on mobile Safari
      this._pickerCtx = this._pickerCanvas.getContext('2d', isMobileDevice ? undefined : { willReadFrequently: true });
    }
    
    const pctx = this._pickerCtx;
    pctx.imageSmoothingEnabled = false;
    pctx.clearRect(0, 0, 1, 1);
    
    // 1. Fill with background
    pctx.fillStyle = this.canvasBg || '#ffffff';
    pctx.fillRect(0, 0, 1, 1);

    // 2. Draw reference images (bottom to top) - only if reference layer is visible
    const refVisible = this.layerSettings[0] ? this.layerSettings[0].visible : true;
    if (refVisible) {
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
    }
    
    // 3. Draw paint layers (bottom to top) - only if paint layers are visible
    const cx = this.isStatic ? 0 : Math.floor(wx / this.chunkSize);
    const cy = this.isStatic ? 0 : Math.floor(wy / this.chunkSize);
    const chunk = this.chunks.get(`${cx},${cy}`);

    if (chunk) {
        const chunkLX = this.isStatic ? -this.staticWidth / 2 : cx * this.chunkSize;
        const chunkLY = this.isStatic ? -this.staticHeight / 2 : cy * this.chunkSize;
        const lx = Math.floor(wx - chunkLX);
        const ly = Math.floor(wy - chunkLY);
        if (lx >= 0 && lx < chunk.width && ly >= 0 && ly < chunk.height) {
            const scale = this.isStatic ? this.dpiScale : 1;
            const sx = lx * scale;
            const sy = ly * scale;
            for (let i = 1; i < LAYERS_COUNT; i++) {
                if (this.layerSettings[i] && !this.layerSettings[i].visible) {
                    continue;
                }
                pctx.drawImage(chunk.canvases[i], Math.floor(sx), Math.floor(sy), Math.max(1, Math.round(scale)), Math.max(1, Math.round(scale)), 0, 0, 1, 1);
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
        const color = this.pickColor(e.clientX, e.clientY);
        this.brush.color = color;
        this._notifyPicker(e.clientX, e.clientY, color, true); // true = SET color now
        return; // STOP HERE, don't start drawing
    }

    // NEW: Handle Alt-Click for picking
    if (e.altKey && this.brush.type !== TOOLS.LASSO) {
        const color = this.pickColor(e.clientX, e.clientY);
        this._notifyPicker(e.clientX, e.clientY, color, true); // true = SET color now
        return; // STOP HERE, don't start drawing
    }

    if (this.brush.type === TOOLS.REF_MOVE) {
        const m = this._getMousePos(e);
        if (this.selectReferenceAt(m.wx, m.wy)) {
            this._pushHistory({
                type: 'reference_change',
                referenceImagesState: this.captureReferenceImagesState()
            });
            this._clearStack(this.redoStack);

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
        
        const scX = sel.scaleX !== undefined ? sel.scaleX : (sel.scale || 1);
        const scY = sel.scaleY !== undefined ? sel.scaleY : (sel.scale || 1);
        const rot = sel.rotation || 0;
        
        const cx = sel.x + sel.canvas.width / 2;
        const cy = sel.y + sel.canvas.height / 2;
        
        const dx = wx - cx;
        const dy = wy - cy;
        
        const localX = dx * Math.cos(-rot) - dy * Math.sin(-rot);
        const localY = dx * Math.sin(-rot) + dy * Math.cos(-rot);
        
        const hw = (sel.canvas.width * scX) / 2;
        const hh = (sel.canvas.height * scY) / 2;
        
        // Pad by 10 pixels in world units for comfortable grabbing
        const isInside = (localX >= -hw - 10 && localX <= hw + 10 && localY >= -hh - 10 && localY <= hh + 10);
        
        if (isInside) {
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

    // Clear Selection on new Lasso click if we aren't moving a transform and we aren't holding shift/alt
    if (this.brush.type === TOOLS.LASSO) {
        const isAdditive = (this.keys['shift'] || e.shiftKey);
        const isSubtractive = (this.keys['alt'] || e.altKey);
        
        // Lock the lasso stroke mode at the start of the stroke
        if (isAdditive) {
            this.lassoStrokeMode = 'add';
        } else if (isSubtractive) {
            this.lassoStrokeMode = 'subtract';
        } else {
            this.lassoStrokeMode = 'new';
        }

        if (!isAdditive && !isSubtractive) {
            if (this.activeSelectionPath) {
                const prevPath = this.activeSelectionPath ? 
                    this.normalizeSelectionPath(this.activeSelectionPath).map(p => ({ points: [...p.points], type: p.type })) : 
                    null;
                this._pushHistory({ type: 'selection', path: prevPath });
                this.clearSelection();
            }
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
    if (!Number.isFinite(pressure) || pressure <= 0) pressure = 0.5;
    pressure = Math.max(0.01, Math.min(1.0, pressure));
    
    // Size modulated by initial pressure
    let initSize = this.brush.size;
    if (e.pointerType === 'pen' || e.pointerType === 'touch') {
        initSize *= (0.2 + pressure * 0.8);
    }
    if (!Number.isFinite(initSize) || initSize < 0.1) initSize = Math.max(0.1, this.brush.size);

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

    const pad = (initSize || 10) + 15;
    this.strokeMinX = worldPos.x - pad;
    this.strokeMaxX = worldPos.x + pad;
    this.strokeMinY = worldPos.y - pad;
    this.strokeMaxY = worldPos.y + pad;
    
    this.spacingAccumulator = 0;
    this.shiftOrigin = null;
    this.shiftLockAxis = null;
    this._currentHueJitterColor = null;
    this._hueJitterStampCount = 0;
    this._lastHueJitterBaseColor = null;

    if (this.brush.type === TOOLS.SMUDGE) {
        this.smudgeDirty = false;
    }
    
    // Clear dirty chunks tracking for this stroke
    this.currentStrokeDirtyChunks = new Map();
    if (this.brush.type === TOOLS.LIQUIFY) {
        this.liquifySteps = [];
    }
    this._clearStack(this.redoStack);
  }

  _moveStroke(e) {
    if (this.isDrawing && this.onDrawMove) this.onDrawMove();

    if (this.isPanning || (this.keys['r'] && this.isMouseDown)) {
        let dx = e.clientX - this.lastMousePos.x;
        let dy = e.clientY - this.lastMousePos.y;
        
        if (this.keys['r']) {
            // Rotate
            const rect = this.getContainerRect();
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
        
        this.setZoom(newZoom, this.transformAnchor.x, this.transformAnchor.y, true);
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        return;
    }

    if (this.floatingSelection && this.isDrawing) {
        const sel = this.floatingSelection;
        const m1 = this._getMousePos({ clientX: this.lastMousePos.x, clientY: this.lastMousePos.y });
        const m2 = this._getMousePos(e);
        const dwx = m2.wx - m1.wx;
        const dwy = m2.wy - m1.wy;

        const isOpacity = this.keys['t'] || this.transformMode === 'opacity';
        const isScale = this.keys['shift'] || this.transformMode === 'scale';
        const isRotate = this.keys['alt'] || this.keys['control'] || this.transformMode === 'rotate';

        if (isOpacity) {
            // T + Drag: Opacity
            const dy = e.clientY - this.lastMousePos.y;
            const opDelta = -dy * 0.01;
            sel.opacity = Math.max(0, Math.min(1, (sel.opacity !== undefined ? sel.opacity : 1) + opDelta));
            this._status(`OPACITY: ${Math.round(sel.opacity * 100)}%`);
        } else if (isScale) {
            // Scale
            const dy = e.clientY - this.lastMousePos.y;
            const factor = 1 + dy * 0.01;
            const scX = sel.scaleX !== undefined ? sel.scaleX : (sel.scale || 1);
            const scY = sel.scaleY !== undefined ? sel.scaleY : (sel.scale || 1);
            sel.scaleX = Math.max(0.01, scX * factor);
            sel.scaleY = Math.max(0.01, scY * factor);
            sel.scale = (sel.scale || 1) * factor; // Compatibility fallback
        } else if (isRotate) {
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
    if (this.brush.type !== TOOLS.LASSO && (this.keys['shift'] || e.shiftKey) && this.lastPos) {
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
        // More robust pressure fallback
        pressure = (e.pressure !== undefined && e.pressure !== 0 && e.pressure !== 0.5) ? e.pressure : (this.lastPressure || 0.2);
    }
    if (!Number.isFinite(pressure) || pressure <= 0) pressure = this.lastPressure || 0.5;
    pressure = Math.max(0.01, Math.min(1.0, pressure));

    // Smoother pressure
    this.lastPressure = (this.lastPressure || pressure) * 0.6 + pressure * 0.4;
    this.lastPressure = Math.max(0.01, Math.min(1.0, this.lastPressure));

    const dx = currentPos.x - this.lastPos.x;
    const dy = currentPos.y - this.lastPos.y;
    // dt: increase min to 20ms to smooth out sudden hardware micro-burst touch events
    const dt = Math.max(20, currentTime - this.lastTime); 
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (!Number.isFinite(dist)) return;
    if (dist < 0.1) return;
    
    // Clamp high instantaneous speed before running it through the low-pass filter
    const rawVelocity = Math.min(120, dist / dt);
    // Smoother velocity tracking across longer frame averages
    this.smoothedVelocity = this.smoothedVelocity * 0.88 + rawVelocity * 0.12;
    if (!Number.isFinite(this.smoothedVelocity)) this.smoothedVelocity = rawVelocity;
    
    // Clamp velocity more strictly to avoid giant "crashes"
    const velocity = Math.min(this.smoothedVelocity, 120); 

    const worldTo = {
      x: m.wx,
      y: m.wy
    };

    // --- Brush Sensitivity ---
    // Higher threshold means you need to move faster to see the effect
    const threshold = 35 + (this.brush.flow * 50); 
    // Lower exponent (0.75) makes the response much less explosive
    const vFactor = Math.pow(Math.min(velocity / threshold, 1.8), 0.75); 
    
    const sensitivityMult = 1.0; // Reduced further from 1.2 for more control
    
    // Size: Clamp sizeMod
    const speedSizeFactor = this.brush.speedSize || 0;
    const sizeMod = 1 - (vFactor * speedSizeFactor * sensitivityMult); 
    let dynamicSize = this.brush.size * Math.max(0.01, sizeMod);
    
    if (this.brush.pressureEnabled && (e.pointerType === 'pen' || e.pointerType === 'touch')) {
        const inf = this.brush.pressureSizeInfluence !== undefined ? this.brush.pressureSizeInfluence : (this.brush.pressureInfluence ?? 1.0);
        dynamicSize *= ( (1 - inf) + this.lastPressure * inf );
    }
    // Final clamp to prevent "crashed chunks" (e.g. 5000px stamps)
    dynamicSize = Math.max(0.1, Math.min(1500, dynamicSize));
    if (!Number.isFinite(dynamicSize)) dynamicSize = this.brush.size;
    
    // Opacity: Clamp opacMod
    const opacBase = 1 - (vFactor * this.brush.speedOpacity * sensitivityMult);
    let opacMod = Math.max(0.01, Math.min(1.0, opacBase));
    
    if (this.brush.pressureEnabled && (e.pointerType === 'pen' || e.pointerType === 'touch')) {
        const inf = this.brush.pressureOpacityInfluence !== undefined ? this.brush.pressureOpacityInfluence : (this.brush.pressureInfluence ?? 1.0);
        opacMod *= ( (1 - inf) + this.lastPressure * inf );
    }
    opacMod = Math.max(0.005, Math.min(1.0, opacMod));
    if (!Number.isFinite(opacMod)) opacMod = 1.0;

    let color = this.brush.color;
    if (this.brush.speedValue !== 0 || this.brush.speedHue !== 0) {
        // Reduced color shift sensitivity
        color = this._shiftColor(color, vFactor * this.brush.speedHue * 40, -vFactor * (this.brush.speedValue / 8)); 
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
        // This fixes the stylus coordinate storm / high Dpi storm
        const lastP = this.strokePoints[this.strokePoints.length - 1];
        const worldDist = Math.sqrt((worldPos.x - lastP.x)**2 + (worldPos.y - lastP.y)**2);
        
        // Minimal distance between points in buffer (e.g., 2 pixels at size 20)
        const minBufferDist = Math.max(2, dynamicSize * 0.15);
        
        if (worldDist > minBufferDist) {
            this.strokePoints.push(worldPos);
            this._paintWireframeIncrementally(this.strokePoints.length - 1);
        }
    } else if (this.brush.type === TOOLS.LIQUIFY) {
        const lastP = this.strokePoints[this.strokePoints.length - 1];
        const dist = Math.sqrt((worldTo.x - lastP.x)**2 + (worldTo.y - lastP.y)**2);
        
        // High-precision immediate feedback: significantly reduced minimum drag distance required for warp steps
        const minWarpDist = Math.max(1.0, Math.min(2.0, this.brush.size * 0.005));
        
        if (dist >= minWarpDist) {
            // Determine intermediate points to create "arcs that are smooth" (interpolation)
            // Tighter stepSize ensures smooth curvature even on fast drags with high-DPI input
            let stepSize = Math.max(3, Math.min(10, this.brush.size * 0.02));
            if (this.brush.type === TOOLS.LIQUIFY) {
                if (this.brush.liquifyQuality === 1) {
                    // FAST mode: large step size, very few sub-steps or none at all (boosting dragging speed massively)
                    stepSize = Math.max(30, this.brush.size * 0.30);
                } else if (this.brush.liquifyQuality === 3) {
                    // ULTRA mode: tighter sub-steps for sub-pixel accuracy
                    stepSize = Math.max(2, Math.min(6, this.brush.size * 0.015));
                }
            }
            const numSteps = Math.max(1, Math.floor(dist / stepSize));
            
            let prevPt = lastP;
            const affectedThisFrame = new Map();
            for (let i = 1; i <= numSteps; i++) {
                const t = i / numSteps;
                const subPt = {
                    x: lastP.x + (worldTo.x - lastP.x) * t,
                    y: lastP.y + (worldTo.y - lastP.y) * t,
                    size: lastP.size + (dynamicSize - lastP.size) * t
                };
                this._displaceLiquifyCoords(prevPt, subPt, affectedThisFrame);
                
                if (!this.liquifySteps) this.liquifySteps = [];
                this.liquifySteps.push({
                    p0: { x: prevPt.x, y: prevPt.y, size: prevPt.size },
                    p1: { x: subPt.x, y: subPt.y, size: subPt.size },
                    brushSize: this.brush.size,
                    brushFlow: this.brush.flow || 0.40,
                    brushFalloff: this.brush.falloff ?? 0.50
                });
                
                prevPt = subPt;
            }
            
            // Execute the single efficient pixel rendering draw call for this move frame
            this._renderLiquifyChunks(affectedThisFrame);
            
            // Add the final point of this step to our permanent stroke points tracking
            this.strokePoints.push(worldPos);
        }
    } else {
        this.strokePoints.push(worldPos);
        
        if (this.strokePoints.length === 2) {
            // First segment: P0 -> Mid(P0, P1)
            const p0 = this.strokePoints[0];
            
            // Recalibrate start point's size & opacity to align with first move/pressure
            if (this.brush.pressureEnabled && (e.pointerType === 'pen' || e.pointerType === 'touch')) {
                p0.size = dynamicSize;
                p0.opacity = opacMod;
                p0.pressure = pressure;
            }
            
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

  _endStroke(e = null) {
    // Finish last part of smoothed curve first, so that final stamps are drawn and final box boundaries set
    if (this.isDrawing && this.brush.type !== TOOLS.LASSO && this.strokePoints.length > 1 && this.brush.type !== TOOLS.WIREFRAME && this.brush.type !== TOOLS.LIQUIFY) {
        const p_last = this.strokePoints[this.strokePoints.length - 1];
        const p_prev = this.strokePoints[this.strokePoints.length - 2];
        const mid = { x: (p_last.x + p_prev.x) / 2, y: (p_last.y + p_prev.y) / 2 };
        this._paintOnChunks(mid, p_last, p_last.size, p_last.opacity, p_last.color);
    }

    // 1. Calculate bounding box of this stroke based on actual generated/scattered stamp bounds
    let minX = this.strokeMinX;
    let maxX = this.strokeMaxX;
    let minY = this.strokeMinY;
    let maxY = this.strokeMaxY;

    // Fallback if bounds are not set
    if (minX === undefined || minX === Infinity || maxX === -Infinity || minY === Infinity || maxY === -Infinity) {
        minX = Infinity; maxX = -Infinity; minY = Infinity; maxY = -Infinity;
        if (this.strokePoints && this.strokePoints.length > 0) {
            for (const p of this.strokePoints) {
                const pad = (p.size || this.brush.size || 10) + 15; // 15px safety padding
                minX = Math.min(minX, p.x - pad);
                maxX = Math.max(maxX, p.x + pad);
                minY = Math.min(minY, p.y - pad);
                maxY = Math.max(maxY, p.y + pad);
            }
        }
    }

    if (this.brush.type === TOOLS.LASSO && this.lassoPath?.length > 10) {
        this._processLassoSelection(e);
    }

    // Bake per-stroke buffer
    if (this.brush.type !== TOOLS.ERASER && this.brush.type !== TOOLS.SMUDGE && this.brush.type !== TOOLS.LIQUIFY) {
        this.currentStrokeDirtyChunks.forEach((data, id) => {
            const chunk = this.chunks.get(id);
            if (chunk) {
                const ctx = chunk.ctxs[this.activeLayer];
                const lx = this.isStatic ? -this.staticWidth / 2 : chunk.cx * this.chunkSize;
                const ly = this.isStatic ? -this.staticHeight / 2 : chunk.cy * this.chunkSize;

                ctx.save();
                
                // Mask strokeCanvas to compound selection before drawing it on the layer
                if (this.activeSelectionPath && chunk.strokeCanvas) {
                    const maskCanvas = document.createElement('canvas');
                    maskCanvas.width = chunk.width;
                    maskCanvas.height = chunk.height;
                    const maskCtx = maskCanvas.getContext('2d');
                    this.drawSelectionMask(maskCtx, this.activeSelectionPath, lx, ly);

                    const sCtx = chunk.strokeCanvas.getContext('2d');
                    sCtx.save();
                    sCtx.globalCompositeOperation = 'destination-in';
                    sCtx.drawImage(maskCanvas, 0, 0);
                    sCtx.restore();
                }

                ctx.globalAlpha = this.brush.opacity; // Per-stroke opacity from UI
                
                const layerSet = this.layerSettings[this.activeLayer];
                if (layerSet && layerSet.alphaLock) {
                    ctx.globalCompositeOperation = 'source-atop';
                } else {
                    ctx.globalCompositeOperation = 'source-over';
                }

                const scale = this.isStatic ? this.dpiScale : 1;
                let chunkMinX = 0;
                let chunkMinY = 0;
                let chunkW = chunk.width;
                let chunkH = chunk.height;

                if (minX !== Infinity) {
                    chunkMinX = Math.max(0, Math.floor(minX - lx));
                    chunkMinY = Math.max(0, Math.floor(minY - ly));
                    const chunkMaxX = Math.min(chunk.width, Math.ceil(maxX - lx));
                    const chunkMaxY = Math.min(chunk.height, Math.ceil(maxY - ly));
                    chunkW = chunkMaxX - chunkMinX;
                    chunkH = chunkMaxY - chunkMinY;
                }

                if (chunkW > 0 && chunkH > 0 && chunk.strokeCanvas) {
                    ctx.drawImage(
                        chunk.strokeCanvas,
                        chunkMinX * scale,
                        chunkMinY * scale,
                        chunkW * scale,
                        chunkH * scale,
                        chunkMinX,
                        chunkMinY,
                        chunkW,
                        chunkH
                    );
                }
                ctx.restore();

                // Clear stroke buffer for next stroke
                const cMinX = chunkMinX;
                const cMinY = chunkMinY;
                const cW = chunkW;
                const cH = chunkH;
                requestAnimationFrame(() => {
                    if (cW > 0 && cH > 0 && chunk.strokeCtx) {
                        chunk.strokeCtx.clearRect(cMinX, cMinY, cW, cH);
                    }
                    if (chunk.strokeCanvas) {
                        chunk.strokeCanvas.style.opacity = '0';
                    }
                });
            }
        });
    } else {
        // High-precision Liquify Resolve pass for RESOLVE (2) and ULTRA (3) modes
        if (this.brush.type === TOOLS.LIQUIFY && (this.brush.liquifyQuality ?? 2) >= 2) {
            if (this.liquifyChunkData && this.liquifySteps && this.liquifySteps.length > 0) {
                // Reset all map grids to zero first
                this.liquifyChunkData.forEach((chunkData) => {
                    if (chunkData.map) {
                        chunkData.map.fill(0);
                    }
                });
                
                const resolveAffected = new Map();
                for (const stepInfo of this.liquifySteps) {
                    const origSize = this.brush.size;
                    const origFlow = this.brush.flow;
                    const origFalloff = this.brush.falloff;
                    
                    if (stepInfo.brushSize !== undefined) this.brush.size = stepInfo.brushSize;
                    if (stepInfo.brushFlow !== undefined) this.brush.flow = stepInfo.brushFlow;
                    if (stepInfo.brushFalloff !== undefined) this.brush.falloff = stepInfo.brushFalloff;
                    
                    this._displaceLiquifyCoords(stepInfo.p0, stepInfo.p1, resolveAffected, true); // forceStepOne = true
                    
                    this.brush.size = origSize;
                    this.brush.flow = origFlow;
                    this.brush.falloff = origFalloff;
                }
                
                this._renderLiquifyChunks(resolveAffected, true); // forceBilinear = true
            }
        }

        // If it was smudge or liquify under active selection, we perform our once-off selection clipping mask
        if ((this.brush.type === TOOLS.SMUDGE || this.brush.type === TOOLS.LIQUIFY) && this.activeSelectionPath) {
            this.currentStrokeDirtyChunks.forEach((data, id) => {
                const chunk = this.chunks.get(id);
                if (chunk) {
                    const lx = this.isStatic ? -this.staticWidth / 2 : chunk.cx * this.chunkSize;
                    const ly = this.isStatic ? -this.staticHeight / 2 : chunk.cy * this.chunkSize;
                    
                    // 1. Create temporary canvas and copy the current (unclipped) chunk content of the layer to it
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = chunk.width;
                    tempCanvas.height = chunk.height;
                    const tempCtx = tempCanvas.getContext('2d');
                    tempCtx.drawImage(chunk.canvases[this.activeLayer], 0, 0);

                    // Create selection mask
                    const maskCanvas = document.createElement('canvas');
                    maskCanvas.width = chunk.width;
                    maskCanvas.height = chunk.height;
                    const maskCtx = maskCanvas.getContext('2d');
                    this.drawSelectionMask(maskCtx, this.activeSelectionPath, lx, ly);

                    // Intersect tempCanvas with mask
                    tempCtx.save();
                    tempCtx.globalCompositeOperation = 'destination-in';
                    tempCtx.drawImage(maskCanvas, 0, 0);
                    tempCtx.restore();

                    // 2. Clear layer and restore original pre-stroke snapshot
                    const lCtx = chunk.ctxs[this.activeLayer];
                    lCtx.clearRect(0, 0, chunk.width, chunk.height);
                    lCtx.drawImage(data.canvas, 0, 0);

                    // 3. Clear the area of the selection from the restored layer first to prevent overlay blending
                    lCtx.save();
                    lCtx.globalCompositeOperation = 'destination-out';
                    lCtx.drawImage(maskCanvas, 0, 0);
                    lCtx.restore();

                    // 4. Draw the newly painted smudge back
                    lCtx.drawImage(tempCanvas, 0, 0);
                }
            });
        }

        // If it was eraser under active selection, we perform our once-off selection clipping mask
        if (this.brush.type === TOOLS.ERASER && this.activeSelectionPath) {
            this.currentStrokeDirtyChunks.forEach((data, id) => {
                const chunk = this.chunks.get(id);
                if (chunk) {
                    const lx = this.isStatic ? -this.staticWidth / 2 : chunk.cx * this.chunkSize;
                    const ly = this.isStatic ? -this.staticHeight / 2 : chunk.cy * this.chunkSize;
                    
                    const backupCanvas = data.canvas;
                    if (backupCanvas) {
                        const layerCtx = chunk.ctxs[this.activeLayer];

                        // 1. Create selection mask
                        const maskCanvas = document.createElement('canvas');
                        maskCanvas.width = chunk.width;
                        maskCanvas.height = chunk.height;
                        const maskCtx = maskCanvas.getContext('2d');
                        this.drawSelectionMask(maskCtx, this.activeSelectionPath, lx, ly);

                        // 2. Create standard temp canvas containing the CURRENT canvas (erased state)
                        const tempCurrent = document.createElement('canvas');
                        tempCurrent.width = chunk.width;
                        tempCurrent.height = chunk.height;
                        const tempCurrentCtx = tempCurrent.getContext('2d');
                        tempCurrentCtx.drawImage(chunk.canvases[this.activeLayer], 0, 0);

                        // Retain only CURRENT pixels inside mask
                        tempCurrentCtx.save();
                        tempCurrentCtx.globalCompositeOperation = 'destination-in';
                        tempCurrentCtx.drawImage(maskCanvas, 0, 0);
                        tempCurrentCtx.restore();

                        // 3. Create a temp canvas containing original BACKUP pixels
                        const tempBackup = document.createElement('canvas');
                        tempBackup.width = chunk.width;
                        tempBackup.height = chunk.height;
                        const tempBackupCtx = tempBackup.getContext('2d');
                        tempBackupCtx.drawImage(backupCanvas, 0, 0);

                        // Retain only BACKUP pixels outside mask
                        tempBackupCtx.save();
                        tempBackupCtx.globalCompositeOperation = 'destination-out';
                        tempBackupCtx.drawImage(maskCanvas, 0, 0);
                        tempBackupCtx.restore();

                        // 4. Combine them back onto chunk's canvas
                        layerCtx.clearRect(0, 0, chunk.width, chunk.height);
                        layerCtx.drawImage(tempCurrent, 0, 0);
                        layerCtx.drawImage(tempBackup, 0, 0);
                    }
                }
            });
        }

        // Just clear stroke buffers just in case, though they shouldn't have been used
        this.currentStrokeDirtyChunks.forEach((data, id) => {
            const chunk = this.chunks.get(id);
            if (chunk) {
                const lx = this.isStatic ? -this.staticWidth / 2 : chunk.cx * this.chunkSize;
                const ly = this.isStatic ? -this.staticHeight / 2 : chunk.cy * this.chunkSize;
                let chunkMinX = 0;
                let chunkMinY = 0;
                let chunkW = chunk.width;
                let chunkH = chunk.height;

                if (minX !== Infinity) {
                    chunkMinX = Math.max(0, Math.floor(minX - lx));
                    chunkMinY = Math.max(0, Math.floor(minY - ly));
                    const chunkMaxX = Math.min(chunk.width, Math.ceil(maxX - lx));
                    const chunkMaxY = Math.min(chunk.height, Math.ceil(maxY - ly));
                    chunkW = chunkMaxX - chunkMinX;
                    chunkH = chunkMaxY - chunkMinY;
                }
                const cMinX = chunkMinX;
                const cMinY = chunkMinY;
                const cW = chunkW;
                const cH = chunkH;
                requestAnimationFrame(() => {
                    if (cW > 0 && cH > 0 && chunk.strokeCtx) {
                        chunk.strokeCtx.clearRect(cMinX, cMinY, cW, cH);
                    }
                    if (chunk.strokeCanvas) {
                        chunk.strokeCanvas.style.opacity = '0';
                    }
                });
            }
        });
    }

    this.liquifyChunkData = null;

    // Store the dirty chunks as a history state
    if (this.currentStrokeDirtyChunks.size > 0) {
        this._pushHistory({
            type: 'stroke',
            chunks: this.currentStrokeDirtyChunks,
            zoom: this.zoom,
            pan: { ...this.pan }
        });
    }
    
    if (this.brush.type === TOOLS.REF_MOVE) {
        this.refsDirty = true;
    }
    
    if (this.brush.type === TOOLS.LIQUIFY) {
        this.clearAllOffscreenCanvases();
    }
    
    if (this.onDrawEnd && this.isDrawing) this.onDrawEnd();
    
    this.isDrawing = false;
    this.isPanning = false;
    this.isZooming = false;
    this.lastPos = null;
    this.lassoPath = null;
    this.lassoStrokeMode = null;
    this.shiftOrigin = null;
    this.shiftLockAxis = null;
    this._status('READY');
    this._updateCursor();
    
    if (e) {
        if (e.pointerType !== 'mouse') {
            if (this.brushCursor) this.brushCursor.style.display = 'none';
            if (this.brushCrosshair) this.brushCrosshair.style.display = 'none';
        } else {
            this._updateBrushCursor(e);
        }
    } else {
        this._updateBrushCursor();
    }
  }

  _updateBrushCursor(e) {
    if (!this.brushCursor) return;

    this._updateCursor();

    if (e && e.pointerType === 'mouse' && this.lastPenTouchTime && (performance.now() - this.lastPenTouchTime < 1000)) {
        return;
    }

    if (e && e.clientX !== undefined && e.clientY !== undefined) {
        this.lastMousePos = { x: e.clientX, y: e.clientY };
    }

    // Fallback if e is missing or doesn't have coords
    const mouseX = (e && e.clientX !== undefined) ? e.clientX : this.lastMousePos.x;
    const mouseY = (e && e.clientY !== undefined) ? e.clientY : this.lastMousePos.y;

    // Clear cursor on touch if no pointers are touching
    if (this.activePointers.size === 0 && e && (e.pointerType === 'touch' || e.pointerType === 'pen')) {
        this.brushCursor.style.display = 'none';
        if (this.brushCrosshair) this.brushCrosshair.style.display = 'none';
        return;
    }

    const rect = this.getContainerRect();

    // Hide if mouse is over UI
    if (e && (e.target.closest('.ui-panel') || e.target.closest('button') || e.target.closest('input') || e.target.closest('#top-bar'))) {
        this.brushCursor.style.display = 'none';
        if (this.brushCrosshair) this.brushCrosshair.style.display = 'none';
        return;
    }

    // Position relative to container
    let mX = mouseX - rect.left;
    let mY = mouseY - rect.top;

    // Manage brush crosshair visibility and positioning
    let showCrosshair = this.isDrawing && !this.isExportMode && this.brush.type !== TOOLS.REF_MOVE;
    if (showCrosshair) {
        if (this.brushCrosshair) {
            this.brushCrosshair.style.display = 'block';
            this.brushCrosshair.style.left = `${mX - 8.5}px`;
            this.brushCrosshair.style.top = `${mY - 8.5}px`;
        }
    } else {
        if (this.brushCrosshair) this.brushCrosshair.style.display = 'none';
    }

    // Manage brush cursor (stamp outer circle)
    if (this.isDrawing && this.brush.type !== TOOLS.LIQUIFY) {
        this.brushCursor.style.display = 'none'; // Hide bulky circle stamp when drawing/painting, except for Liquify to see the shape boundaries!
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
    let boxShadow = 'none';

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
            if (!this.brush.tip._dataUrl) {
                this.brush.tip._dataUrl = this.brush.tip.toDataURL();
            }
            mask = `url(${this.brush.tip._dataUrl})`;
        }
    } else if (this.brush.type === TOOLS.ERASER || this.brush.type === TOOLS.SMUDGE) {
        h = s / 2;
        bgColor = 'transparent';
        border = this.brush.type === TOOLS.ERASER ? '2px solid #ff4444' : '2px solid #3b82f6';
        if (this.brush.tip) {
            h = s;
            if (!this.brush.tip._dataUrl) {
                this.brush.tip._dataUrl = this.brush.tip.toDataURL();
            }
            mask = `url(${this.brush.tip._dataUrl})`;
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
    } else if (this.brush.type === TOOLS.LIQUIFY) {
        w = s;
        h = s;
        br = '50%';
        bgColor = 'transparent';
        border = '1.5px solid rgba(0, 0, 0, 0.75)';
        boxShadow = '0 0 0 1.5px rgba(255, 255, 255, 0.65)';
    }

    this.brushCursor.style.width = `${w}px`;
    this.brushCursor.style.height = `${h}px`;
    this.brushCursor.style.borderRadius = br;
    this.brushCursor.style.backgroundColor = bgColor;
    this.brushCursor.style.border = border;
    this.brushCursor.style.boxShadow = boxShadow;
    this.brushCursor.style.webkitMaskImage = mask;
    this.brushCursor.style.webkitMaskSize = '100% 100%';
    this.brushCursor.style.maskImage = mask;
    this.brushCursor.style.maskSize = '100% 100%';

    this.brushCursor.style.mixBlendMode = 'normal';

    this.brushCursor.style.left = `${mX - w/2}px`;
    this.brushCursor.style.top = `${mY - h/2}px`;
    
    let transform = `rotate(${this.rotation}rad)`;
    if (this.isMirrored) {
        transform += ' scaleX(-1)';
    }
    this.brushCursor.style.transform = transform;
  }

  _drawLasso(from, to) {
    return drawLasso(this, from, to);
  }

  _updateSelectionPreview() {
    return updateSelectionPreview(this);
  }

  captureReferenceImagesState() {
    return this.referenceImages.map(ref => {
        return {
            id: ref.id,
            name: ref.name,
            img: ref.img, 
            x: ref.x,
            y: ref.y,
            rotation: ref.rotation,
            scale: ref.scale,
            opacity: ref.opacity,
            mirrorX: ref.mirrorX,
            mirrorY: ref.mirrorY,
            extractedPalette: ref.extractedPalette ? [...ref.extractedPalette] : null
        };
    });
  }

  restoreReferenceImagesState(state) {
    this.referenceImages.forEach(ref => {
        if (ref.element) ref.element.remove();
    });
    this.referenceImages = [];

    state.forEach(savedState => {
        const el = document.createElement('img');
        el.src = savedState.img.src;
        el.className = 'absolute pointer-events-none board-ref-image';
        el.style.left = `-${savedState.img.width/2}px`;
        el.style.top = `-${savedState.img.height/2}px`;
        this.refLayer.appendChild(el);

        const ref = {
            id: savedState.id,
            name: savedState.name,
            img: savedState.img,
            element: el,
            x: savedState.x,
            y: savedState.y,
            rotation: savedState.rotation,
            scale: savedState.scale,
            opacity: savedState.opacity,
            mirrorX: savedState.mirrorX,
            mirrorY: savedState.mirrorY,
            extractedPalette: savedState.extractedPalette ? [...savedState.extractedPalette] : null
        };
        this.referenceImages.push(ref);
    });

    this.selectedRefIndex = this.referenceImages.length - 1;
    this.refsDirty = true;
    this.refresh();
  }

  removeReferenceImage(index) {
      if (index >= 0 && index < this.referenceImages.length) {
          this._pushHistory({
              type: 'reference_change',
              referenceImagesState: this.captureReferenceImagesState()
          });
          this._clearStack(this.redoStack);

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

          function rgbToHsl(r, g, b) {
              r /= 255; g /= 255; b /= 255;
              const max = Math.max(r, g, b), min = Math.min(r, g, b);
              let h, s, l = (max + min) / 2;

              if (max === min) {
                  h = s = 0;
              } else {
                  const d = max - min;
                  s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                  switch (max) {
                      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                      case g: h = (b - r) / d + 2; break;
                      case b: h = (r - g) / d + 4; break;
                  }
                  h /= 6;
              }
              return { h: h * 360, s: s * 100, l: l * 100 };
          }

          function colorDistance(c1, c2) {
              const r1 = c1[0], g1 = c1[1], b1 = c1[2];
              const r2 = c2[0], g2 = c2[1], b2 = c2[2];
              
              const hsl1 = rgbToHsl(r1, g1, b1);
              const hsl2 = rgbToHsl(r2, g2, b2);
              
              if (hsl1.s > 10 && hsl2.s > 10) {
                  const dh = Math.min(Math.abs(hsl1.h - hsl2.h), 360 - Math.abs(hsl1.h - hsl2.h));
                  const ds = Math.abs(hsl1.s - hsl2.s);
                  const dl = Math.abs(hsl1.l - hsl2.l);
                  return (dh / 180) * 120 + (ds / 100) * 30 + (dl / 100) * 30;
              } else {
                  const dr = r1 - r2;
                  const dg = g1 - g2;
                  const db = b1 - b2;
                  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
              }
          }

          function getDiverseColors(srcCandidates, count) {
              if (srcCandidates.length === 0) return [];
              
              const colorCounts = {};
              for (const cand of srcCandidates) {
                  const [r, g, b] = cand.color;
                  const qr = Math.round(r / 16) * 16;
                  const qg = Math.round(g / 16) * 16;
                  const qb = Math.round(b / 16) * 16;
                  const key = `${qr},${qg},${qb}`;
                  
                  if (!colorCounts[key]) {
                      colorCounts[key] = {
                          sumR: 0, sumG: 0, sumB: 0,
                          count: 0
                      };
                  }
                  colorCounts[key].count++;
                  colorCounts[key].sumR += r;
                  colorCounts[key].sumG += g;
                  colorCounts[key].sumB += b;
              }
              
              const uniqueList = Object.keys(colorCounts).map(key => {
                  const val = colorCounts[key];
                  const avgColor = [
                      Math.round(val.sumR / val.count),
                      Math.round(val.sumG / val.count),
                      Math.round(val.sumB / val.count)
                  ];
                  return {
                      color: avgColor,
                      count: val.count,
                      hsl: rgbToHsl(avgColor[0], avgColor[1], avgColor[2])
                  };
              });
              
              const selected = [];
              for (let step = 0; step < count; step++) {
                  if (uniqueList.length === 0) break;
                  
                  let bestCand = null;
                  let bestScore = -Infinity;
                  let bestIndex = -1;
                  
                  for (let i = 0; i < uniqueList.length; i++) {
                      const cand = uniqueList[i];
                      const baseScore = cand.count * (1.0 + (cand.hsl.s / 100) * 3.5);
                      
                      let minDistance = Infinity;
                      for (const sel of selected) {
                          const dist = colorDistance(cand.color, sel);
                          if (dist < minDistance) {
                              minDistance = dist;
                          }
                      }
                      
                      let penalty = 1.0;
                      if (selected.length > 0) {
                          penalty = Math.min(1.0, minDistance / 50);
                      }
                      
                      const finalScore = baseScore * penalty;
                      if (finalScore > bestScore) {
                          bestScore = finalScore;
                          bestCand = cand;
                          bestIndex = i;
                      }
                  }
                  
                  if (bestCand && bestScore > 0) {
                      selected.push(bestCand.color);
                      uniqueList.splice(bestIndex, 1);
                  } else {
                      break;
                  }
              }
              return selected;
          }

          // Categorize into 3 buckets
          const lights = candidates.filter(c => c.lum >= 170).sort((a,b) => b.lum - a.lum);
          const shadows = candidates.filter(c => c.lum <= 85).sort((a,b) => a.lum - b.lum);
          const mids = candidates.filter(c => c.lum > 85 && c.lum < 170).sort((a,b) => Math.abs(128 - a.lum) - Math.abs(128 - b.lum));

          const extractedLights = getDiverseColors(lights, 4);
          const extractedMids = getDiverseColors(mids, 4);
          const extractedShadows = getDiverseColors(shadows, 4);

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
              const swatchRef = this.addReferenceImage(swatchImg, `Palette: ${ref.name}`, x, y);
              swatchRef.extractedPalette = colorArray;
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

  _processLassoSelection(e = null) {
    return processLassoSelection(this, e);
  }

  normalizeSelectionPath(path) {
    return normalizeSelectionPath(path);
  }

  drawSelectionMask(maskCtx, activeSelectionPath, lx, ly) {
    return drawSelectionMask(maskCtx, activeSelectionPath, lx, ly);
  }

  clearSelection() {
      this.activeSelectionPath = null;
      this.floatingSelection = null;
      this._updateSelectionPreview();
      this.refresh();
      this._status('READY');
  }

  _applySelection() {
    return applySelection(this);
  }

  _handlePickerMove(e) {
    if (e.altKey && !this.isDrawing && this.brush.type !== TOOLS.LASSO) {
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
    if (!hex || typeof hex !== 'string') return '#000000';
    let colorStr = hex.trim().toLowerCase();
    let r = 0, g = 0, b = 0;
    
    if (colorStr.startsWith('#')) {
      if (colorStr.length === 4) {
        r = parseInt(colorStr[1] + colorStr[1], 16) / 255;
        g = parseInt(colorStr[2] + colorStr[2], 16) / 255;
        b = parseInt(colorStr[3] + colorStr[3], 16) / 255;
      } else {
        r = parseInt(colorStr.slice(1, 3), 16) / 255;
        g = parseInt(colorStr.slice(3, 5), 16) / 255;
        b = parseInt(colorStr.slice(5, 7), 16) / 255;
      }
    } else if (colorStr.startsWith('rgb')) {
      const parts = colorStr.match(/\d+/g);
      if (parts && parts.length >= 3) {
        r = parseInt(parts[0], 10) / 255;
        g = parseInt(parts[1], 10) / 255;
        b = parseInt(parts[2], 10) / 255;
      }
    }
    
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      r = 0; g = 0; b = 0;
    }

    // hex to hsl
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
    const toHex = x => {
      const val = Math.max(0, Math.min(255, Math.round(x * 255)));
      return val.toString(16).padStart(2, '0');
    };
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

  _updateWireframeOverlay() {
    // No-op: now handled incrementally directly onto chunks in real-time!
  }

  _paintWireframeIncrementally(j) {
    return paintWireframeIncrementally(this, j);
  }

  _paintOnChunks(from, to, size, opacity, color) {
    if (this.activeLayer === 0) return;
    
    // 1. Prepare Brush Params
    const isSmudge = this.brush.type === TOOLS.SMUDGE;
    const isWire = this.brush.type === TOOLS.WIREFRAME;
    const bSize = Math.round(size);
    let spacing = isSmudge ? Math.max(1, bSize * 0.05) : Math.max(2, bSize * this.brush.spacing); 
    if (!Number.isFinite(spacing) || spacing < 0.5) spacing = 2;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const flow = this.brush.flow || 0.5;
    
    const isEraser = this.brush.type === TOOLS.ERASER;
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

    // Additional heavy stamp optimization for impasto / wet oil brushes at speed to prevent clogging up browser queue
    if (!isSmudge && !isWire && (oil > 0 || height > 0) && this.smoothedVelocity > 5) {
        // Scaled up to 3x standard spacing as velocity goes from 5 to 50
        const speedScale = 1 + Math.min(2.0, (this.smoothedVelocity - 5) / 22.5);
        currentSpacing *= speedScale;
    }

    const stamps = [];
    let p = this.spacingAccumulator;
    const jPos = this.brush.jitterPos || 0;
    const jSize = this.brush.jitterSize || 0;
    const jAngle = this.brush.jitterAngle || 0;
    const jHue = this.brush.jitterHue || 0;

    while (p <= dist) {
        const t = dist === 0 ? 0 : p / dist;
        let sx = from.x + dx * t;
        let sy = from.y + dy * t;
        
        // Position Jitter
        if (jPos > 0) {
            const range = bSize * jPos * 2;
            sx += (Math.random() - 0.5) * range;
            sy += (Math.random() - 0.5) * range;
        }

        const stamp = { x: sx, y: sy };

        // Size Jitter
        if (jSize > 0) {
            stamp.size = bSize * (1 + (Math.random() - 0.5) * jSize);
        } else {
            stamp.size = bSize;
        }

        // Angle Jitter
        if (jAngle > 0) {
            stamp.angle = (this.rotation || 0) + (Math.random() - 0.5) * jAngle * 2;
        } else {
            stamp.angle = this.rotation || 0;
        }

        // Hue Jitter
        if (jHue > 0) {
            this._hueJitterStampCount = (this._hueJitterStampCount || 0) + 1;
            if (!this._currentHueJitterColor || this._hueJitterStampCount % 8 === 0 || this._lastHueJitterBaseColor !== color) {
                this._lastHueJitterBaseColor = color;
                this._currentHueJitterColor = this._shiftColor(color, (Math.random() - 0.5) * jHue * 360, 0);
            }
            stamp.color = this._currentHueJitterColor;
        } else {
            stamp.color = color;
        }

        const pad = (stamp.size / 2) + 15;
        this.strokeMinX = Math.min(this.strokeMinX, sx - pad);
        this.strokeMaxX = Math.max(this.strokeMaxX, sx + pad);
        this.strokeMinY = Math.min(this.strokeMinY, sy - pad);
        this.strokeMaxY = Math.max(this.strokeMaxY, sy + pad);

        stamps.push(stamp);
        p += currentSpacing;
    }
    this.spacingAccumulator = p - dist;
    if (!Number.isFinite(this.spacingAccumulator)) this.spacingAccumulator = 0;

    if (stamps.length === 0) return;

    // 3. Cache and Smudge Prep
    if (tip && !isSmudge) {
        const sharpen = this.brush.brushSharpen || 0;
        // Round size for caching to prevent constant canvas/filter redevelopment overhead
        const cacheSize = this._getCacheSize(bSize);
        const cacheKey = `${airbrush}_${cacheSize}_${sharpen}`;
        if (!this._tipColorCache || this._tipColorCache.key !== cacheKey || this._tipColorCache.color !== color) {
            this._updateTipCache(cacheSize, airbrush, color);
        }
        if ((oil > 0 || height > 0) && dist < 500) {
            // Oiliness now produces sharper highlights for a "wet" look, while impasto stays soft
            const reliefBlur = Math.max(0.2, (height * 0.1 + oil * 0.02)) * 4 * (1 - airbrush * 0.4);
            const reliefKey = `${cacheSize}_${reliefBlur}`;
            if (!this._reliefCache || this._reliefCache.key !== reliefKey) {
                this._updateReliefCache(cacheSize, reliefBlur);
            }
        }
    }

    if (isSmudge && !this.smudgeCanvas) {
        this.smudgeCanvas = document.createElement('canvas');
        this.smudgeCanvas.width = 128; // Standard smudge tip size
        this.smudgeCanvas.height = 128;
        this.smudgeCtx = this.smudgeCanvas.getContext('2d', isMobileDevice ? undefined : { willReadFrequently: true });
        this.smudgeDirty = false;
    }

    // 4. Find Affected Chunks and grouping stamps
    const affectedChunks = new Map();

    for (const s of stamps) {
        const sR = s.size / 2;
        const sCX = this.isStatic ? 0 : Math.floor((s.x - sR) / this.chunkSize);
        const eCX = this.isStatic ? 0 : Math.floor((s.x + sR) / this.chunkSize);
        const sCY = this.isStatic ? 0 : Math.floor((s.y - sR) / this.chunkSize);
        const eCY = this.isStatic ? 0 : Math.floor((s.y + sR) / this.chunkSize);

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
    const hasSpecialJitter = (jSize > 0 || jHue > 0);

    if (isSmudge) {
        paintSmudgeOnChunks(this, stamps, affectedChunks, flow, opacity, tip);
        return;
    }

    affectedChunks.forEach((group, id) => {
        const chunk = this._getChunk(group.cx, group.cy);
        if (!chunk) return;

        if (this.isDrawing && !this.currentStrokeDirtyChunks.has(id)) {
            const srcCanvas = chunk.canvases[this.activeLayer];
            const backup = document.createElement('canvas');
            backup.width = srcCanvas.width; backup.height = srcCanvas.height;
            // Only request willReadFrequently if performing costly pixel readback operations (e.g. Liquify)
            const useReadBack = (this.brush.type === TOOLS.LIQUIFY);
            backup.getContext('2d', useReadBack ? { willReadFrequently: true } : undefined).drawImage(srcCanvas, 0, 0);
            this.currentStrokeDirtyChunks.set(id, { layer: this.activeLayer, canvas: backup });
            this._markDirty(id, this.activeLayer);
        }

        if (!isEraser) {
            this._ensureStrokeCanvas(chunk);
            chunk.strokeCanvas.style.opacity = this.brush.opacity;
        }
        const ctx = isEraser ? chunk.ctxs[this.activeLayer] : chunk.strokeCtx;

        const lx = this.isStatic ? -this.staticWidth / 2 : group.cx * this.chunkSize;
        const ly = this.isStatic ? -this.staticHeight / 2 : group.cy * this.chunkSize;

        ctx.save();
        
        // We only clip the eraser dynamically since other brushes draw on strokeCanvas and are masked once-off inside _endStroke!

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
            try {
                const px = Math.round(s.x - lx);
                const py = Math.round(s.y - ly);
                const curSize = Math.round(s.size);
                if (curSize < 1) continue;
                const curR = curSize / 2;
                
                if (this.textureModeEnabled && !isEraser && !isSmudge) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(px, py, curR, 0, Math.PI * 2);
                    
                    const texColor = s.color || color || '#000000';
                    const pattern = this._getTexturePattern(this.texturePattern, this.textureDensity, this.textureGridSize, texColor);
                    if (pattern) {
                        const matrix = new DOMMatrix().translate(-lx, -ly).rotate(45);
                        pattern.setTransform(matrix);
                        ctx.fillStyle = pattern;
                        ctx.fill();
                    }
                    ctx.restore();
                    continue;
                }
                
                // Regular stamps: optimized by avoiding save/restore if no rotation, wireframe or custom tips are active
                // Simple procedural rect brush doesn't need save/restore even if hue/size jitter is active, as long as angle === 0!
                if (s.angle === 0 && !tip && !isWire) {
                    if (isEraser) {
                        ctx.clearRect(px - curR, py - curR/2, curSize, curSize/2);
                    } else {
                        ctx.fillStyle = s.color || color || '#000000';
                        ctx.fillRect(px - curR, py - curR/2, curSize, curSize/2);
                    }
                } else {
                    ctx.save();
                    try {
                        ctx.translate(px, py);
                        if (s.angle !== 0) ctx.rotate(s.angle);

                        if (isWire) {
                            ctx.beginPath(); ctx.arc(0, 0, curR, 0, Math.PI*2);
                            ctx.strokeStyle = s.color || color || '#000000'; ctx.lineWidth = 1.5; ctx.stroke();
                        } else if (tip) {
                            let useTip = (this._tipColorCache && this._tipColorCache.canvas) ? this._tipColorCache.canvas : null;
                            if (!useTip) {
                                ctx.fillStyle = s.color || color || '#000000';
                                ctx.beginPath();
                                ctx.arc(0, 0, curR, 0, Math.PI * 2);
                                ctx.fill();
                            } else {
                                // Relief / Impasto effect
                                if ((oil > 0 || height > 0) && dist < 500 && !isEraser) {
                                    // Sync color for tip if jittered
                                    if (jHue > 0) {
                                        if (!this.scratchCanvas) {
                                            this.scratchCanvas = document.createElement('canvas');
                                            this.scratchCtx = this.scratchCanvas.getContext('2d', { alpha: true });
                                        }
                                        if (this.scratchCanvas.width < curSize || this.scratchCanvas.height < curSize) {
                                            this.scratchCanvas.width = Math.max(this.scratchCanvas.width, curSize);
                                            this.scratchCanvas.height = Math.max(this.scratchCanvas.height, curSize);
                                        }
                                        this.scratchCtx.globalCompositeOperation = 'source-over'; // Reset first!
                                        this.scratchCtx.clearRect(0, 0, curSize, curSize);
                                        this.scratchCtx.drawImage(useTip, 0, 0, curSize, curSize);
                                        this.scratchCtx.globalCompositeOperation = 'source-in';
                                        this.scratchCtx.fillStyle = s.color || color || '#000000';
                                        this.scratchCtx.fillRect(0, 0, curSize, curSize);
                                        ctx.drawImage(this.scratchCanvas, 0, 0, curSize, curSize, -curR, -curR, curSize, curSize);
                                    } else {
                                        ctx.drawImage(useTip, -curR, -curR, curSize, curSize);
                                    }

                                    const origAlpha = ctx.globalAlpha;
                                    const origGCO = ctx.globalCompositeOperation;

                                    // 1. Shadow Pass (Multiply) - Strictly reserved for Impasto (Paint Height)
                                    if (height > 0 && !(this.smoothedVelocity > 35) && this._reliefCache) {
                                        ctx.globalCompositeOperation = 'multiply';
                                        ctx.globalAlpha = origAlpha * height * 0.22;
                                        ctx.drawImage(this._reliefCache.shadow, -curR + 1, -curR + 1, curSize, curSize);
                                    }

                                    // 2. Base Highlight Pass - Using screen for volumetric height stability
                                    const baseHighlightOpacity = height * 0.15;
                                    const oilOpacity = oil * 0.35;
                                    const skipBaseHighlight = (this.smoothedVelocity > 15);
                                    if (baseHighlightOpacity > 0 && (!skipBaseHighlight || oilOpacity <= 0) && this._reliefCache) {
                                        ctx.globalCompositeOperation = 'screen';
                                        ctx.globalAlpha = origAlpha * Math.min(1.0, baseHighlightOpacity);
                                        ctx.drawImage(this._reliefCache.highlight, -curR - 1, -curR - 1, curSize, curSize);
                                    }

                                    // 3. Wet/Oil Pass - Using overlay or dodge for that high-specular shiny look
                                    if (oilOpacity > 0 && this._reliefCache) {
                                        ctx.globalCompositeOperation = 'overlay'; 
                                        ctx.globalAlpha = origAlpha * Math.min(0.8, oilOpacity);
                                        ctx.drawImage(this._reliefCache.highlight, -curR - 1.5, -curR - 1.5, curSize, curSize);
                                    }

                                    // Restore original properties directly
                                    ctx.globalAlpha = origAlpha;
                                    ctx.globalCompositeOperation = origGCO;
                                } else {
                                    if (jHue > 0) {
                                        if (!this.scratchCanvas) {
                                            this.scratchCanvas = document.createElement('canvas');
                                            this.scratchCtx = this.scratchCanvas.getContext('2d', { alpha: true });
                                        }
                                        if (this.scratchCanvas.width < curSize || this.scratchCanvas.height < curSize) {
                                            this.scratchCanvas.width = Math.max(this.scratchCanvas.width, curSize);
                                            this.scratchCanvas.height = Math.max(this.scratchCanvas.height, curSize);
                                        }
                                        this.scratchCtx.globalCompositeOperation = 'source-over'; // Reset first!
                                        this.scratchCtx.clearRect(0, 0, curSize, curSize);
                                        this.scratchCtx.drawImage(useTip, 0, 0, curSize, curSize);
                                        this.scratchCtx.globalCompositeOperation = 'source-in';
                                        this.scratchCtx.fillStyle = s.color || color || '#000000';
                                        this.scratchCtx.fillRect(0, 0, curSize, curSize);
                                        ctx.drawImage(this.scratchCanvas, 0, 0, curSize, curSize, -curR, -curR, curSize, curSize);
                                    } else {
                                        ctx.drawImage(useTip, -curR, -curR, curSize, curSize);
                                    }
                                }
                            }
                        } else {
                            ctx.fillStyle = s.color || color || '#000000';
                            ctx.fillRect(-curR, -curR/2, curSize, curSize/2);
                        }
                    } finally {
                        ctx.restore();
                    }
                }
            } catch (err) {
                console.error("Stamp sub-draw error:", err);
            }
        }
        ctx.restore();
    });
  }

  _getTexturePattern(shape, density, gridSize, color) {
    const key = `${shape}_${density}_${gridSize}_${color}`;
    if (this._currentTexturePattern && this._lastTextureParams === key) {
        return this._currentTexturePattern;
    }
    
    const tile = document.createElement('canvas');
    tile.width = gridSize;
    tile.height = gridSize;
    const ctx = tile.getContext('2d');
    
    ctx.clearRect(0, 0, gridSize, gridSize);
    ctx.fillStyle = color || '#ffffff';
    
    const cx = gridSize / 2;
    const cy = gridSize / 2;
    
    if (shape === 'dot') {
        if (density <= 0.5) {
            // Area = pi * r^2 = density * gridSize^2
            const r = gridSize * Math.sqrt(density / Math.PI);
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(0, 0, gridSize, gridSize);
            ctx.globalCompositeOperation = 'destination-out';
            // Area of white circle = (1 - density) * gridSize^2
            const r = gridSize * Math.sqrt((1 - density) / Math.PI);
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (shape === 'square') {
        if (density <= 0.5) {
            // Area = side^2 = density * gridSize^2
            const side = gridSize * Math.sqrt(density);
            const x = cx - side / 2;
            const y = cy - side / 2;
            ctx.fillRect(x, y, side, side);
        } else {
            ctx.fillRect(0, 0, gridSize, gridSize);
            ctx.globalCompositeOperation = 'destination-out';
            // Area of white square = (1 - density) * gridSize^2
            const side = gridSize * Math.sqrt(1 - density);
            const x = cx - side / 2;
            const y = cy - side / 2;
            ctx.fillRect(x, y, side, side);
        }
    } else if (shape === 'line') {
        // Area = thickness * gridSize = density * gridSize^2
        const thickness = gridSize * density;
        ctx.fillRect(0, cx - thickness / 2, gridSize, thickness);
    } else if (shape === 'triangle') {
        // Area of equilateral-like triangle is approx 0.5 * b * h where b = h * 1.1547 => Area = 0.57735 * h^2
        const factor = 0.57735;
        if (density <= 0.5) {
            const h = gridSize * Math.sqrt(density / factor);
            const b = h * 1.1547;
            const y_top = cy - h * (2 / 3);
            const y_bottom = cy + h * (1 / 3);
            ctx.beginPath();
            ctx.moveTo(cx, y_top);
            ctx.lineTo(cx - b / 2, y_bottom);
            ctx.lineTo(cx + b / 2, y_bottom);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.fillRect(0, 0, gridSize, gridSize);
            ctx.globalCompositeOperation = 'destination-out';
            const h = gridSize * Math.sqrt((1 - density) / factor);
            const b = h * 1.1547;
            const y_bottom = cy - h * (2 / 3);
            const y_top = cy + h * (1 / 3);
            ctx.beginPath();
            ctx.moveTo(cx, y_top);
            ctx.lineTo(cx - b / 2, y_bottom);
            ctx.lineTo(cx + b / 2, y_bottom);
            ctx.closePath();
            ctx.fill();
        }
    }
    
    const patternCtx = document.createElement('canvas').getContext('2d');
    const pattern = patternCtx.createPattern(tile, 'repeat');
    
    this._currentTexturePattern = pattern;
    this._lastTextureParams = key;
    return pattern;
  }

  _getCacheSize(s) {
    if (s <= 1) return 1;
    if (s <= 16) return Math.max(2, Math.round(s / 2) * 2);
    if (s <= 64) return Math.round(s / 4) * 4;
    if (s <= 256) return Math.round(s / 8) * 8;
    return Math.round(s / 16) * 16;
  }

  _updateTipCache(s, airbrush, color) {
    if (!this.brush.tip || this.brush.tip.width === 0 || s < 1) return;
    
    const blur = airbrush * s * 0.45;
    const scale = 1.0 / (1.0 + airbrush * 1.5);
    const dSize = Math.max(1, s * scale);
    const canv = document.createElement('canvas'); canv.width = s; canv.height = s;
    const tctx = canv.getContext('2d');
    
    // Check for filter support, excluding Safari & iOS web view due to broken offscreen canvas filters
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const supportsFilters = typeof tctx.filter !== 'undefined' && !isIOS && !isSafari;
    
    if (airbrush > 0 && blur > 0) {
        if (supportsFilters) {
            tctx.filter = `blur(${blur}px)`;
            tctx.drawImage(this.brush.tip, (s-dSize)/2, (s-dSize)/2, dSize, dSize);
            tctx.globalCompositeOperation = 'source-in';
            tctx.fillStyle = color; 
            tctx.fillRect(0,0,s,s);
        } else {
            // Shadow fallback for mobile/Safari
            tctx.shadowBlur = blur;
            tctx.shadowColor = color;
            tctx.shadowOffsetX = s;
            tctx.shadowOffsetY = 0;
            // Draw off-canvas to only see the shadow
            tctx.drawImage(this.brush.tip, (s-dSize)/2 - s, (s-dSize)/2, dSize, dSize);
        }
    } else {
        const sharpen = this.brush.brushSharpen || 0;
        if (sharpen > 0 && supportsFilters) {
            const contrast = 100 + sharpen * 900;
            tctx.filter = `contrast(${contrast}%)`;
        }
        tctx.drawImage(this.brush.tip, (s-dSize)/2, (s-dSize)/2, dSize, dSize);
        tctx.globalCompositeOperation = 'source-in';
        tctx.fillStyle = color; 
        tctx.fillRect(0,0,s,s);
    }
    
    this._tipColorCache = { canvas: canv, key: `${airbrush}_${s}_${this.brush.brushSharpen || 0}`, color, srcTip: this.brush.tip };
  }

  _updateReliefCache(s, blur) {
    if (!this.brush.tip || this.brush.tip.width === 0 || s < 1) return;
    const shad = document.createElement('canvas'); shad.width = s; shad.height = s;
    const sctx = shad.getContext('2d');
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const supportsFilters = typeof sctx.filter !== 'undefined' && !isIOS && !isSafari;

    if (blur > 0) {
        if (supportsFilters) {
            sctx.filter = `blur(${blur}px)`;
            try {
                sctx.drawImage(this.brush.tip, 0, 0, s, s);
            } catch(e) { return; }
            sctx.globalCompositeOperation = 'source-in'; sctx.fillStyle = 'black'; sctx.fillRect(0,0,s,s);
        } else {
            // Shadow fallback
            sctx.shadowBlur = blur;
            sctx.shadowColor = 'black';
            sctx.shadowOffsetX = s;
            sctx.shadowOffsetY = 0;
            try {
                sctx.drawImage(this.brush.tip, -s, 0, s, s);
            } catch(e) { return; }
        }
    } else {
        try {
            sctx.drawImage(this.brush.tip, 0, 0, s, s);
        } catch(e) { return; }
        sctx.globalCompositeOperation = 'source-in'; sctx.fillStyle = 'black'; sctx.fillRect(0,0,s,s);
    }

    // Erase the solid core of the brush tip to prevent value/hue shifts in the flat middle of strokes
    sctx.save();
    sctx.globalCompositeOperation = 'destination-out';
    if (supportsFilters) sctx.filter = 'none';
    sctx.shadowBlur = 0;
    sctx.shadowOffsetX = 0;
    try {
        sctx.drawImage(this.brush.tip, 0, 0, s, s);
    } catch (e) {}
    sctx.restore();

    const high = document.createElement('canvas'); high.width = s; high.height = s;
    const hctx = high.getContext('2d');
    
    if (blur > 0) {
        if (supportsFilters) {
            hctx.filter = `blur(${blur}px)`;
            try {
                hctx.drawImage(this.brush.tip, 0, 0, s, s);
            } catch(e) { return; }
            hctx.globalCompositeOperation = 'source-in'; hctx.fillStyle = 'white'; hctx.fillRect(0,0,s,s);
        } else {
            // Shadow fallback
            hctx.shadowBlur = blur;
            hctx.shadowColor = 'white';
            hctx.shadowOffsetX = s;
            hctx.shadowOffsetY = 0;
            try {
                hctx.drawImage(this.brush.tip, -s, 0, s, s);
            } catch(e) { return; }
        }
    } else {
        try {
            hctx.drawImage(this.brush.tip, 0, 0, s, s);
        } catch(e) { return; }
        hctx.globalCompositeOperation = 'source-in'; hctx.fillStyle = 'white'; hctx.fillRect(0,0,s,s);
    }

    // Erase the solid core of the brush tip to prevent value/hue shifts in the flat middle of strokes
    hctx.save();
    hctx.globalCompositeOperation = 'destination-out';
    if (supportsFilters) hctx.filter = 'none';
    hctx.shadowBlur = 0;
    hctx.shadowOffsetX = 0;
    try {
        hctx.drawImage(this.brush.tip, 0, 0, s, s);
    } catch (e) {}
    hctx.restore();
    
    this._reliefCache = { shadow: shad, highlight: high, key: `${s}_${blur}`, srcTip: this.brush.tip };
  }

  addReferenceImage(img, name, x = null, y = null, config = {}, autoSelect = true) {
    this._pushHistory({
        type: 'reference_change',
        referenceImagesState: this.captureReferenceImagesState()
    });
    this._clearStack(this.redoStack);

    const rect = this.container.getBoundingClientRect();
    const wx = x !== null ? x : (-this.pan.x) / this.zoom;
    const wy = y !== null ? y : (-this.pan.y) / this.zoom;

    // Downsample massive reference images to avoid GPU memory overflow and slow performance
    const maxDim = 1200;
    let finalImg = img;
    if (img.width > maxDim || img.height > maxDim) {
         const scale = Math.min(maxDim / img.width, maxDim / img.height);
         const canvas = document.createElement('canvas');
         canvas.width = Math.round(img.width * scale);
         canvas.height = Math.round(img.height * scale);
         const ctx = canvas.getContext('2d');
         ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
         
         const newImg = new Image();
         newImg.src = canvas.toDataURL('image/jpeg', 0.85); // High quality compact compression
         newImg.width = canvas.width;
         newImg.height = canvas.height;
         finalImg = newImg;
    }

    const el = document.createElement('img');
    el.src = finalImg.src;
    el.className = 'absolute pointer-events-none board-ref-image';
    el.style.left = `-${finalImg.width/2}px`; // Center on pivot
    el.style.top = `-${finalImg.height/2}px`;
    
    this.refLayer.appendChild(el);

    const ref = {
      id: Math.random().toString(36).substring(7),
      name: name || 'Untitled',
      img: finalImg,
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
      if (!action) return;
      if (action.chunks) {
          action.chunks.forEach(data => {
              if (data.canvas) {
                  data.canvas.width = 1;
                  data.canvas.height = 1;
                  data.canvas = null;
              }
          });
          action.chunks.clear();
      }
      if (action.selection && action.selection.canvas) {
          if (this && this.floatingSelection && (action.selection === this.floatingSelection || action.selection.canvas === this.floatingSelection.canvas)) {
              // Do not destroy the canvas as it is currently being used by the active floatingSelection!
          } else {
              action.selection.canvas.width = 1;
              action.selection.canvas.height = 1;
              action.selection.canvas = null;
          }
      }
  }

  _pushHistory(action) {
      this.history.push(action);
      if (this.history.length > 50) {
          const oldest = this.history.shift();
          this._disposeAction(oldest);
      }
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
                const srcCanvas = chunk.canvases[data.layer];
                const redoBackup = document.createElement('canvas');
                redoBackup.width = srcCanvas.width;
                redoBackup.height = srcCanvas.height;
                redoBackup.getContext('2d').drawImage(srcCanvas, 0, 0);
                redoAction.chunks.set(id, { layer: data.layer, canvas: redoBackup });

                const ctx = chunk.ctxs[data.layer];
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clearRect(0, 0, srcCanvas.width, srcCanvas.height);
                ctx.drawImage(data.canvas, 0, 0);
                ctx.restore();
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

    // Dispose action containing selection only after restoring it to this.floatingSelection
    if (action.chunks) {
        this._disposeAction(action);
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
                const srcCanvas = chunk.canvases[data.layer];
                const undoBackup = document.createElement('canvas');
                undoBackup.width = srcCanvas.width;
                undoBackup.height = srcCanvas.height;
                undoBackup.getContext('2d').drawImage(srcCanvas, 0, 0);
                undoAction.chunks.set(id, { layer: data.layer, canvas: undoBackup });

                const ctx = chunk.ctxs[data.layer];
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clearRect(0, 0, srcCanvas.width, srcCanvas.height);
                ctx.drawImage(data.canvas, 0, 0);
                ctx.restore();
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

    this._pushHistory(undoAction);
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
          backup.width = chunk.width;
          backup.height = chunk.height;
          backup.getContext('2d').drawImage(chunk.canvases[index], 0, 0);
          snap.set(id, { layer: index, canvas: backup });
      });
      this._pushHistory({ type: 'stroke', chunks: snap, zoom: this.zoom, pan: { ...this.pan } });

      this.chunks.forEach((chunk, id) => {
          chunk.ctxs[index].clearRect(0, 0, chunk.width, chunk.height);
          this._markDirty(id, index, true);
      });
      this._status(`LAYER ${index} CLEARED`);
      if (this.onDrawEnd) this.onDrawEnd();
  }

  clear() {
    this.chunks.forEach((chunk, id) => {
      chunk.ctxs.forEach((ctx, index) => {
          ctx.clearRect(0, 0, chunk.width, chunk.height);
          this._markDirty(id, index, true);
      });
    });
    if (this.onDrawEnd) this.onDrawEnd();
  }

  setZoom(z, cursorX = null, cursorY = null, bypassSnap = false) {
    return setZoom.call(this, z, cursorX, cursorY, bypassSnap);
  }

  setRotation(r, cursorX = null, cursorY = null) {
    return setRotation.call(this, r, cursorX, cursorY);
  }

  fitZoom() {
    return fitZoom.call(this);
  }

  saveViewport() {
    return saveViewport.call(this);
  }

  loadViewport(projectId = null) {
    return loadViewport.call(this, projectId);
  }

  _initGesture() {
    return _initGesture.call(this);
  }

  _handleGesture() {
    return _handleGesture.call(this);
  }

  _displaceLiquifyCoords(p0, p1, affectedThisFrame, forceStepOne = false) {
    const isFast = (this.brush.liquifyQuality === 1);
    const mod = isFast ? liquifyOld : liquifyNew;
    return mod.displaceLiquifyCoords(this, p0, p1, affectedThisFrame, forceStepOne);
  }

  _getOriginalChunkDataFromId(id) {
    const isFast = (this.brush.liquifyQuality === 1);
    const mod = isFast ? liquifyOld : liquifyNew;
    return mod.getOriginalChunkDataFromId(this, id);
  }

  _getIntPixelDataAndIdx(wx, wy, chunkCache) {
    const isFast = (this.brush.liquifyQuality === 1);
    const mod = isFast ? liquifyOld : liquifyNew;
    return mod.getIntPixelDataAndIdx(this, wx, wy, chunkCache);
  }

  _sampleOriginalWorldPixel(wx, wy, chunkCache, dstData, dstIdx) {
    const isFast = (this.brush.liquifyQuality === 1);
    const mod = isFast ? liquifyOld : liquifyNew;
    return mod.sampleOriginalWorldPixel(this, wx, wy, chunkCache, dstData, dstIdx);
  }

  _renderLiquifyChunks(affectedThisFrame, forceBilinear = false) {
    const isFast = (this.brush.liquifyQuality === 1);
    const mod = isFast ? liquifyOld : liquifyNew;
    return mod.renderLiquifyChunks(this, affectedThisFrame, forceBilinear);
  }

  _bilinearSampleImageData(srcData, w, h, x, y, dstData, dstIdx) {
    const isFast = (this.brush.liquifyQuality === 1);
    const mod = isFast ? liquifyOld : liquifyNew;
    return mod.bilinearSampleImageData(this, srcData, w, h, x, y, dstData, dstIdx);
  }

  _bilinearSample(srcData, w, h, x, y, dstData, dstIdx) {
    const x0 = Math.floor(x);
    const x1 = x0 + 1;
    const y0 = Math.floor(y);
    const y1 = y0 + 1;
    
    const tx = x - x0;
    const ty = y - y0;
    
    const ix0 = x0 < 0 ? 0 : (x0 >= w ? w - 1 : x0);
    const ix1 = x1 < 0 ? 0 : (x1 >= w ? w - 1 : x1);
    const iy0 = y0 < 0 ? 0 : (y0 >= h ? h - 1 : y0);
    const iy1 = y1 < 0 ? 0 : (y1 >= h ? h - 1 : y1);
    
    const idx00 = (iy0 * w + ix0) * 4;
    const idx10 = (iy0 * w + ix1) * 4;
    const idx01 = (iy1 * w + ix0) * 4;
    const idx11 = (iy1 * w + ix1) * 4;
    
    // Normalize and convert to premultiplied alpha space
    const a00 = srcData[idx00 + 3] / 255;
    const r00 = srcData[idx00] * a00;
    const g00 = srcData[idx00 + 1] * a00;
    const b00 = srcData[idx00 + 2] * a00;

    const a10 = srcData[idx10 + 3] / 255;
    const r10 = srcData[idx10] * a10;
    const g10 = srcData[idx10 + 1] * a10;
    const b10 = srcData[idx10 + 2] * a10;

    const a01 = srcData[idx01 + 3] / 255;
    const r01 = srcData[idx01] * a01;
    const g01 = srcData[idx01 + 1] * a01;
    const b01 = srcData[idx01 + 2] * a01;

    const a11 = srcData[idx11 + 3] / 255;
    const r11 = srcData[idx11] * a11;
    const g11 = srcData[idx11 + 1] * a11;
    const b11 = srcData[idx11 + 2] * a11;

    // Bilinear interpolate in  pre-multiplied space
    const r0_a = a00 + tx * (a10 - a00);
    const r1_a = a01 + tx * (a11 - a01);
    const interp_a = r0_a + ty * (r1_a - r0_a);

    const r0_r = r00 + tx * (r10 - r00);
    const r1_r = r01 + tx * (r11 - r01);
    const interp_r = r0_r + ty * (r1_r - r0_r);

    const r0_g = g00 + tx * (g10 - g00);
    const r1_g = g01 + tx * (g11 - g01);
    const interp_g = r0_g + ty * (r1_g - r0_g);

    const r0_b = b00 + tx * (b10 - b00);
    const r1_b = b01 + tx * (b11 - b01);
    const interp_b = r0_b + ty * (r1_b - r0_b);

    const alphaFinal = Math.round(interp_a * 255);
    dstData[dstIdx + 3] = alphaFinal;

    if (interp_a > 1e-5) {
        dstData[dstIdx] = Math.max(0, Math.min(255, Math.round(interp_r / interp_a)));
        dstData[dstIdx + 1] = Math.max(0, Math.min(255, Math.round(interp_g / interp_a)));
        dstData[dstIdx + 2] = Math.max(0, Math.min(255, Math.round(interp_b / interp_a)));
    } else {
        dstData[dstIdx] = 0;
        dstData[dstIdx + 1] = 0;
        dstData[dstIdx + 2] = 0;
    }
  }

  _nearestSample(srcData, w, h, x, y, dstData, dstIdx) {
    const ix = Math.max(0, Math.min(w - 1, Math.round(x)));
    const iy = Math.max(0, Math.min(h - 1, Math.round(y)));
    const srcIdx = (iy * w + ix) * 4;
    dstData[dstIdx] = srcData[srcIdx];
    dstData[dstIdx + 1] = srcData[srcIdx + 1];
    dstData[dstIdx + 2] = srcData[srcIdx + 2];
    dstData[dstIdx + 3] = srcData[srcIdx + 3];
  }
}

// Assign coordinate conversion prototype methods
Engine.prototype.getContainerRect = getContainerRect;
Engine.prototype._screenToWorld = _screenToWorld;
Engine.prototype._worldToScreen = _worldToScreen;
Engine.prototype._getMousePos = _getMousePos;
Engine.prototype._worldToScreenScale = _worldToScreenScale;

// Assign gestures prototype methods
Engine.prototype._initGesture = _initGesture;
Engine.prototype._handleGesture = _handleGesture;
Engine.prototype.setZoom = setZoom;
Engine.prototype.setRotation = setRotation;
Engine.prototype.fitZoom = fitZoom;
Engine.prototype.saveViewport = saveViewport;
Engine.prototype.loadViewport = loadViewport;

// Assign stroke prototype methods
Engine.prototype._startStroke = _startStroke;
Engine.prototype._moveStroke = _moveStroke;
Engine.prototype._endStroke = _endStroke;
Engine.prototype._paintCurveOnChunks = _paintCurveOnChunks;
Engine.prototype._paintWireframeIncrementally = _paintWireframeIncrementally;
Engine.prototype._paintOnChunks = _paintOnChunks;

// Assign history prototype methods
Engine.prototype._disposeAction = _disposeAction;
Engine.prototype._pushHistory = _pushHistory;
Engine.prototype._clearStack = _clearStack;
Engine.prototype.compact = compact;
Engine.prototype.undo = undo;
Engine.prototype.redo = redo;

// Assign grid prototype methods
Engine.prototype._updateMobileGridPosition = _updateMobileGridPosition;
Engine.prototype.setupBoard = setupBoard;
Engine.prototype.refreshGrid = refreshGrid;
Engine.prototype._generateGridTexture = _generateGridTexture;

