import { Engine } from './engine.js';
import { SketchStorage } from './storage.js';
import { TOOLS, LAYERS_COUNT } from './constants.js';
import { PaletteManager } from './paletteManager.js';
import { hexToRgb, rgbToHex, rgbToHsv, hsvToRgb } from './colorUtils.js';

class App {
  constructor() {
    this.engine = new Engine(document.getElementById('canvas-container'));
    this.engine.onColorPicked = (color) => this.setColor(color);
    this.engine.onStatus = (text) => this._status(text);
    this.storage = new SketchStorage();
    this.palette = new PaletteManager();
    this.activeTool = TOOLS.BRUSH;
    this.lastBrush = TOOLS.BRUSH; // Track for smart switching back to painting
    this.prevTool = TOOLS.BRUSH; 
    this.hsv = { h: 0, s: 70, v: 70 };
    
    this.init();
  }

  async init() {
    try {
        await this.storage.init();
    } catch (e) {
        console.error("Storage init failed", e);
        this._status('STORAGE ERROR');
    }

    this._setupUI();
    this._setupHotkeys();
    
    // Load existing data
    try {
        await this.load();
        
        const savedPalette = await this.storage.loadSetting('palette');
        if (savedPalette) this.palette.baseColors = savedPalette;

        const canvasBg = await this.storage.loadSetting('canvasBg');
        if (canvasBg) {
            this.engine.canvasBg = canvasBg;
            document.getElementById('settings-bg-color').value = canvasBg;
        }

        const gridColor = await this.storage.loadSetting('gridColor');
        if (gridColor) {
            this.engine.gridColor = gridColor;
            document.getElementById('settings-grid-color').value = gridColor;
        }

        const showGrid = await this.storage.loadSetting('showGrid');
        if (showGrid !== undefined) {
            this.engine.showGrid = showGrid;
            document.getElementById('settings-grid-show').checked = showGrid;
        }

        const spacing = await this.storage.loadSetting('brushSpacing');
        if (spacing) {
            this.engine.brush.spacing = parseFloat(spacing);
            document.getElementById('settings-brush-spacing').value = spacing;
        }

        const sensitivities = await this.storage.loadSetting('sensitivities');
        if (sensitivities) {
            if (sensitivities.size !== undefined) {
                this.engine.brush.speedSize = sensitivities.size;
                document.getElementById('speed-size').value = sensitivities.size * 100;
            }
            if (sensitivities.opacity !== undefined) {
                this.engine.brush.speedOpacity = sensitivities.opacity;
                document.getElementById('speed-opacity').value = sensitivities.opacity * 100;
            }
            if (sensitivities.value !== undefined) {
                this.engine.brush.speedValue = sensitivities.value;
                document.getElementById('speed-value').value = sensitivities.value * 100;
            }
            if (sensitivities.hue !== undefined) {
                this.engine.brush.speedHue = sensitivities.hue;
                document.getElementById('speed-hue').value = sensitivities.hue * 100;
            }
        }

        this.engine.refresh();
    } catch (e) {
        console.error("Data load failed", e);
    }

    this._renderPalette();
    
    this._status('READY');
    this.engine.onDrawEnd = () => this._triggerAutoSave();
    this.engine.onZoomChange = () => this._updateZoomUI();

    // Init picker state
    const firstColor = this.palette.baseColors[0];
    this._updateHSVFromHex(firstColor);
    this._initColorSelector();
  }

  _triggerAutoSave() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.save(), 4000);
  }

  _setupUI() {
    // Toolbar buttons
    document.getElementById('btn-brush').onclick = () => this.setTool(TOOLS.BRUSH);
    document.getElementById('btn-eraser').onclick = () => this.setTool(TOOLS.ERASER);
    document.getElementById('btn-wireframe').onclick = () => this.setTool(TOOLS.WIREFRAME);
    document.getElementById('btn-lasso').onclick = () => this.setTool(TOOLS.LASSO);
    document.getElementById('btn-undo').onclick = () => this.engine.undo();
    document.getElementById('btn-redo').onclick = () => this.engine.redo();
    document.getElementById('btn-clear').onclick = () => this.engine.clear();
    document.getElementById('btn-fullscreen').onclick = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    document.getElementById('btn-import').onclick = () => document.getElementById('file-import').click();
    document.getElementById('file-import').onchange = (e) => this._handleImport(e);

    // Settings
    const settingsPanel = document.getElementById('panel-settings');
    document.getElementById('btn-settings').onclick = () => {
        settingsPanel.classList.toggle('hidden');
        this._updateStorageStat();
    };
    document.getElementById('btn-close-settings').onclick = () => settingsPanel.classList.add('hidden');

    document.getElementById('settings-bg-color').oninput = (e) => {
        this.engine.canvasBg = e.target.value;
        this.engine.refresh();
        this.storage.saveSetting('canvasBg', e.target.value);
    };
    document.getElementById('settings-grid-color').oninput = (e) => {
        this.engine.gridColor = e.target.value;
        this.engine.refresh();
        this.storage.saveSetting('gridColor', e.target.value);
    };
    document.getElementById('settings-grid-show').onchange = (e) => {
        this.engine.showGrid = e.target.checked;
        this.engine.refresh();
        this.storage.saveSetting('showGrid', e.target.checked);
    };
    document.getElementById('settings-brush-spacing').oninput = (e) => {
        this.engine.brush.spacing = parseFloat(e.target.value);
        this.storage.saveSetting('brushSpacing', e.target.value);
    };

    // Zoom controls
    document.getElementById('btn-zoom-in').onclick = () => {
        this.engine.setZoom(this.engine.zoom * 1.2);
        this._updateZoomUI();
    };
    document.getElementById('btn-zoom-out').onclick = () => {
        this.engine.setZoom(this.engine.zoom / 1.2);
        this._updateZoomUI();
    };
    document.getElementById('btn-zoom-fit').onclick = () => {
        this.engine.fitZoom();
        this._updateZoomUI();
    };

    // Palette
    this._renderPalette();

    document.getElementById('btn-reset-palette').onclick = () => {
        this.palette = new PaletteManager();
        this._renderPalette();
        this.storage.saveSetting('palette', this.palette.baseColors);
        this.setColor('#333333');
    };

    // Layers
    const layerStack = document.getElementById('layer-stack');
    layerStack.innerHTML = '';
    // Reverse UI display: Index 3 at top, Index 0 at bottom
    // Index 0 is IMG REF, Indices 1-3 are PAINT LAYERS
    for (let i = LAYERS_COUNT - 1; i >= 0; i--) {
      const btn = document.createElement('button');
      btn.className = 'layer-btn';
      if (i === 1) btn.classList.add('active-tool');
      btn.id = `layer-btn-${i}`;
      btn.innerHTML = i === 0 ? 'IMG REF' : `PAINT ${i}`;
      btn.onclick = () => this.setLayer(i);
      layerStack.appendChild(btn);
    }
    this.engine.activeLayer = 1; // Default to first paint layer

    // Settings
    const sizeSlider = document.getElementById('brush-size');
    const sizeVal = document.getElementById('size-val');
    sizeSlider.oninput = (e) => {
      const val = parseInt(e.target.value);
      this.engine.brush.size = val;
      sizeVal.innerText = val;
    };

    const opacitySlider = document.getElementById('brush-opacity');
    const opacityVal = document.getElementById('opacity-val');
    if (opacitySlider) {
        opacitySlider.oninput = (e) => {
          const val = parseInt(e.target.value);
          this.engine.brush.opacity = val / 100;
          opacityVal.innerText = `${val}%`;
        };
    }

    const flowSlider = document.getElementById('brush-flow');
    const flowVal = document.getElementById('flow-val');
    if (flowSlider) {
        flowSlider.oninput = (e) => {
          const val = parseInt(e.target.value);
          this.engine.brush.flow = val / 100;
          flowVal.innerText = `${val}%`;
        };
    }

    // Speed Sliders - sensitivity tuning
    const sSize = document.getElementById('speed-size');
    const sOpac = document.getElementById('speed-opacity');
    const sVal = document.getElementById('speed-value');
    const sHue = document.getElementById('speed-hue');

    const saveSens = () => {
        this.storage.saveSetting('sensitivities', {
            size: this.engine.brush.speedSize,
            opacity: this.engine.brush.speedOpacity,
            value: this.engine.brush.speedValue,
            hue: this.engine.brush.speedHue
        });
    };

    if (sSize) sSize.oninput = (e) => {
        this.engine.brush.speedSize = parseInt(e.target.value) / 100;
        saveSens();
    };
    if (sOpac) sOpac.oninput = (e) => {
        this.engine.brush.speedOpacity = parseInt(e.target.value) / 100;
        saveSens();
    };
    if (sVal) sVal.oninput = (e) => {
        this.engine.brush.speedValue = parseInt(e.target.value) / 100;
        saveSens();
    };
    if (sHue) sHue.oninput = (e) => {
        this.engine.brush.speedHue = parseInt(e.target.value) / 100;
        saveSens();
    };

    // Draggable Panels
    this._makeDraggable(document.getElementById('panel-color'), document.getElementById('handle-color'));
    this._makeDraggable(document.getElementById('panel-images'), document.getElementById('handle-images'));
    this._makeDraggable(document.getElementById('panel-layers'), document.getElementById('handle-layers'));
    this._makeDraggable(document.getElementById('panel-settings'), document.getElementById('handle-settings'));
  }

  _makeDraggable(el, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      e.preventDefault();
      e.stopPropagation();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      el.style.top = (el.offsetTop - pos2) + "px";
      el.style.left = (el.offsetLeft - pos1) + "px";
      el.style.right = 'auto'; // Disable right-anchor if it was there
      el.style.bottom = 'auto'; // Disable bottom-anchor to prevent stretching
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  _updateZoomUI() {
      document.getElementById('zoom-val').innerText = `${Math.round(this.engine.zoom * 100)}%`;
  }

  _setupHotkeys() {
    window.onkeydown = (e) => {
      if (e.repeat && ['z', 'y'].includes(e.key.toLowerCase())) return;
      
      const key = e.key.toLowerCase();
      switch (key) {
        case '1': this.setTool(TOOLS.BRUSH); break;
        case '2': this.setTool(TOOLS.ERASER); break;
        case '3': this.setTool(TOOLS.WIREFRAME); break;
        case '4': this.setTool(TOOLS.LASSO); break;
        case 'b': this.setTool(TOOLS.BRUSH); break;
        case 'x': this.setTool(TOOLS.ERASER); break; 
        case 's': this._adjOpacity(-5); break; // S lowers opacity
        case 'd': 
          if (e.ctrlKey) {
            if (this.engine.activeSelectionPath) {
                this.engine.history.push({ type: 'selection', path: [...this.engine.activeSelectionPath] });
                this.engine.clearSelection();
            }
            e.preventDefault();
          } else {
            this._adjOpacity(5); 
          }
          break;
        case 't':
          this.engine.startTransform();
          break;
        case 'l': this.setTool(TOOLS.LASSO); break;
        case 'z': 
          if (e.ctrlKey) {
              if (e.shiftKey) this.engine.redo();
              else this.engine.undo();
              e.preventDefault();
          }
          break;
        case 'y': if (e.ctrlKey) { this.engine.redo(); e.preventDefault(); } break;
        case 'w': this._adjSize(-8); break; 
        case 'e': this._adjSize(8); break;  
        case '[': this._adjSize(-5); break;
        case ']': this._adjSize(5); break;
      }
    };
  }

  _adjSize(delta) {
    const el = document.getElementById('brush-size');
    const valEl = document.getElementById('size-val');
    const newVal = Math.max(1, Math.min(500, parseInt(el.value) + delta));
    el.value = newVal;
    this.engine.brush.size = newVal;
    if (valEl) valEl.innerText = newVal;
  }

  _adjOpacity(delta) {
    const el = document.getElementById('brush-opacity');
    const valEl = document.getElementById('opacity-val');
    const newVal = Math.max(0, Math.min(100, parseInt(el.value) + delta));
    el.value = newVal;
    this.engine.brush.opacity = newVal / 100;
    if (valEl) valEl.innerText = `${newVal}%`;
  }

  _handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        this.engine.importImage(img);
        this._updateImageList(file.name);
        this._status('IMAGE IMPORTED');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  _updateImageList(name) {
      const list = document.getElementById('image-list');
      if (list && list.children[0]?.innerHTML === 'Empty') list.innerHTML = '';
      
      const item = document.createElement('div');
      item.className = 'image-item group';
      item.innerHTML = `
        <span class="truncate w-32 font-black tracking-tighter uppercase">${name}</span>
        <button class="btn-del-img text-black font-black px-1" title="Clear Image Layer">X</button>
      `;
      
      item.querySelector('.btn-del-img').onclick = () => {
          this.engine.clearLayer(0); // Clear reference layer
          item.remove();
          if (list.children.length === 0) {
            list.innerHTML = '<div class="text-9 text-center py-2 uppercase">Empty</div>';
          }
      };
      
      list.appendChild(item);
  }

  _renderPalette() {
    const paletteEl = document.getElementById('palette');
    const frag = document.createDocumentFragment();
    const rows = this.palette.generate();

    rows.forEach((row) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'palette-row';
        
        row.forEach(item => {
            const swatch = document.createElement('div');
            swatch.className = `swatch ${item.type}`;
            if (item.active) swatch.classList.add('active-swatch');
            swatch.style.backgroundColor = item.color;
            if (item.span) swatch.style.flex = item.span;
            
            swatch.onclick = (e) => {
                e.stopPropagation();
                if (item.type === 'main') {
                    this.palette.activeIndex = item.index;
                    // Only update the actual influence colors if we picked from the main row
                    this._updateHSVFromHex(item.color);
                    this._applyHSV(); // This syncs and regenerates palette
                } else {
                    // Just set the color for the brush, don't update row 1 or regenerate
                    this.setColor(item.color);
                }
            };
            
            swatch.title = item.color;
            rowEl.appendChild(swatch);
        });
        
        frag.appendChild(rowEl);
    });
    
    paletteEl.innerHTML = '';
    paletteEl.appendChild(frag);
  }

  _initColorSelector() {
    const svPicker = document.getElementById('sv-picker');
    const svCursor = svPicker.querySelector('.sv-cursor');
    const hueSlider = document.getElementById('hue-slider');

    const updateFromSV = (e) => {
        const rect = svPicker.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        x = Math.max(0, Math.min(rect.width, x));
        y = Math.max(0, Math.min(rect.height, y));
        
        this.hsv.s = (x / rect.width) * 100;
        this.hsv.v = 100 - (y / rect.height) * 100;
        
        this._applyHSV();
    };

    svPicker.onmousedown = (e) => {
        updateFromSV(e);
        const onMouseMove = (me) => updateFromSV(me);
        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    hueSlider.oninput = (e) => {
        this.hsv.h = parseFloat(e.target.value);
        this._applyHSV();
    };
  }

  _applyHSV() {
    const rgb = hsvToRgb(this.hsv.h, this.hsv.s, this.hsv.v);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    
    // Update active base color
    this.palette.setBaseColor(this.palette.activeIndex, hex);
    this.setColor(hex);
    this._renderPalette();
    this._updateColorUI();
    this.storage.saveSetting('palette', this.palette.baseColors);
  }

  _updateHSVFromHex(hex) {
    const rgb = hexToRgb(hex);
    this.hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    this._updateColorUI();
  }

  _updateColorUI() {
    const svPicker = document.getElementById('sv-picker');
    const svCursor = svPicker.querySelector('.sv-cursor');
    const hueSlider = document.getElementById('hue-slider');

    // Update SV background to reflect hue
    const pureRgb = hsvToRgb(this.hsv.h, 100, 100);
    const pureHex = rgbToHex(pureRgb.r, pureRgb.g, pureRgb.b);
    svPicker.style.backgroundColor = pureHex;

    // Position cursor
    svCursor.style.left = `${this.hsv.s}%`;
    svCursor.style.top = `${100 - this.hsv.v}%`;

    // Update hue slider
    hueSlider.value = this.hsv.h;
  }

  setTool(tool) {
    if (this.activeTool !== tool) {
        this.prevTool = this.activeTool;
    }
    this.activeTool = tool;
    if (tool === TOOLS.BRUSH || tool === TOOLS.WIREFRAME) {
        this.lastBrush = tool;
    }
    this.engine.brush.type = tool;
    
    // Update UI
    document.querySelectorAll('.tool-group .tool-btn').forEach(btn => {
      btn.classList.remove('active-tool');
    });

    const activeBtnId = `btn-${tool}`;
    const btn = document.getElementById(activeBtnId);
    if (btn) {
      btn.classList.add('active-tool');
    }

    this._status(tool);
  }

  setColor(color) {
    this.engine.brush.color = color;
    const preview = document.getElementById('current-color-preview');
    if (preview) preview.style.backgroundColor = color;
    
    // Sync picker if it differs significantly or always sync?
    // Always sync to ensure the selector matches current color
    const rgb = hexToRgb(color);
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    this.hsv = hsv;
    this._updateColorUI();

    // Smart Switch check: if color picked while using non-painting tools, switch to last brush
    if (this.activeTool === TOOLS.ERASER || this.activeTool === TOOLS.LASSO) {
        this.setTool(this.lastBrush);
    }
  }

  setLayer(index) {
    this.engine.activeLayer = index;
    // Update UI
    for (let i = 0; i < LAYERS_COUNT; i++) {
        const btn = document.getElementById(`layer-btn-${i}`);
        if (btn) {
            btn.classList.remove('active-tool');
        }
    }
    const active = document.getElementById(`layer-btn-${index}`);
    if (active) {
        active.classList.add('active-tool');
    }
    this._status(`L${index + 1}`);
  }

  async load() {
    this._status('LOADING...');
    try {
        const layersToLoad = [0, 1, 2, 3];
        // We scan a reasonable area or have a manifest? 
        // For now, let's just use the current chunks in engine if we save them to a list
        // Or better: SketchStorage could just return all IDs.
        // Actually, we can just load chunks when requested. 
        // But for initial load, we need to know WHICH were saved.
        const allKeys = await this.storage.getAllKeys();
        for (const key of allKeys) {
            const [layerId, cx, cy] = key.split('_').map(Number);
            const dataUrl = await this.storage.loadChunk(layerId, cx, cy);
            if (dataUrl) {
                const img = new Image();
                await new Promise(r => {
                    img.onload = r;
                    img.src = dataUrl;
                });
                const chunk = this.engine._getChunk(cx, cy);
                chunk.ctxs[layerId].drawImage(img, 0, 0);
            }
        }
        this.engine.refresh();
        this._status('READY');
    } catch (e) {
        console.error("Load failed", e);
        this._status('LOAD ERROR');
    }
  }

  async save() {
    if (this.engine.dirtyChunks.size === 0) return;

    this._status('SAVING...');
    try {
        const dirty = Array.from(this.engine.dirtyChunks);
        this.engine.dirtyChunks.clear(); // Clear immediately to capture new changes during save

        const promises = [];
        for (const item of dirty) {
            const [chunkId, layerStr] = item.split('|');
            const l = parseInt(layerStr);
            const [cx, cy] = chunkId.split(',').map(Number);
            
            const chunk = this.engine.chunks.get(chunkId);
            if (chunk) {
                const dataUrl = chunk.canvases[l].toDataURL('image/webp', 0.8);
                promises.push(this.storage.saveChunk(l, cx, cy, dataUrl));
            }
        }
        
        await Promise.all(promises);
        this._status('SAVED');
        this._showSaved();
    } catch (e) {
        console.error("Save failed", e);
        this._status('SAVE ERROR');
    }
  }

  _showSaved() {
      const el = document.getElementById('save-status');
      if (!el) return;
      el.classList.remove('hidden');
      if (this.saveStatusTimeout) clearTimeout(this.saveStatusTimeout);
      this.saveStatusTimeout = setTimeout(() => {
          el.classList.add('hidden');
      }, 2000);
  }

  _status(text) {
    const el = document.getElementById('status');
    if (el) el.innerText = text;
  }

  async _updateStorageStat() {
      const keys = await this.storage.getAllKeys();
      const stat = document.getElementById('storage-stat');
      if (stat) stat.innerText = `${keys.length} chunks`;
  }
}

new App();
