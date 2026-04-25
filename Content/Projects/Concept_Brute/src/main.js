import { Engine } from './engine.js';
import { SketchStorage } from './storage.js';
import { TOOLS, LAYERS_COUNT } from './constants.js';
import { PaletteManager } from './paletteManager.js';
import { TipManager } from './tipManager.js';
import { hexToRgb, rgbToHex, rgbToHsv, hsvToRgb } from './colorUtils.js';

class App {
  constructor() {
    this.engine = new Engine(document.getElementById('canvas-container'));
    this.engine.onColorPicked = (color) => this.setColor(color);
    this.engine.onStatus = (text) => this._status(text);
    this.storage = new SketchStorage();
    this.palette = new PaletteManager();
    this.tipManager = new TipManager(document.getElementById('panel-brush-tips'), (tip, height, oiliness, airbrush) => {
        this.brushSettings[TOOLS.BRUSH].tip = tip;
        if (height !== undefined) {
            this.brushSettings[TOOLS.BRUSH].paintHeight = height;
            this.engine.brush.paintHeight = height;
        }
        if (oiliness !== undefined) {
            this.brushSettings[TOOLS.BRUSH].oiliness = oiliness;
            this.engine.brush.oiliness = oiliness;
        }
        if (airbrush !== undefined) {
            this.brushSettings[TOOLS.BRUSH].airbrush = airbrush;
            this.engine.brush.airbrush = airbrush;
        }
        this._updateBrushSettingsUI(TOOLS.BRUSH);
        
        if (this.activeTool === TOOLS.BRUSH || this.activeTool === TOOLS.ERASER || this.activeTool === TOOLS.SMUDGE) {
            this.engine.brush.tip = tip;
        }
    }, this.storage);
    this.activeTool = TOOLS.BRUSH;
    this.lastBrush = TOOLS.BRUSH; // Track for smart switching back to painting
    this.prevTool = TOOLS.BRUSH; 
    
    // Per-brush settings
    this.brushSettings = {};
    Object.values(TOOLS).forEach(tool => {
        this.brushSettings[tool] = {
            size: 40,
            opacity: 1.0,
            flow: 1.0,
            speedSize: 8.0,
            speedOpacity: 6.0,
            speedValue: -4.0,
            speedHue: -10.0,
            paintHeight: 0,
            oiliness: 0.5,
            airbrush: 0.0,
            tip: null
        };
    });
    // Set some defaults
    this.brushSettings[TOOLS.ERASER].opacity = 1.0;
    this.brushSettings[TOOLS.SMUDGE].opacity = 0.5;
    this.brushSettings[TOOLS.SMUDGE].flow = 0.5;
    this.brushSettings[TOOLS.WIREFRAME].size = 20;

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

        const savedSensitivities = await this.storage.loadSetting('sensitivities');
        if (savedSensitivities) {
            // Migrating old sensitivities to default brush if present
            this.brushSettings[TOOLS.BRUSH].speedSize = savedSensitivities.size ?? 8.0;
            this.brushSettings[TOOLS.BRUSH].speedOpacity = savedSensitivities.opacity ?? 6.0;
            this.brushSettings[TOOLS.BRUSH].speedValue = savedSensitivities.value ?? -4.0;
            this.brushSettings[TOOLS.BRUSH].speedHue = savedSensitivities.hue ?? -10.0;
        }

        let savedBrushes = null;
        try {
            const raw = localStorage.getItem('brushSettings');
            if (raw) savedBrushes = JSON.parse(raw);
        } catch(e) {}

        if (!savedBrushes) {
            // Fallback for legacy
            savedBrushes = await this.storage.loadSetting('brushSettings');
        }

        if (savedBrushes) {
            Object.keys(savedBrushes).forEach(tool => {
                if (this.brushSettings[tool]) {
                    this.brushSettings[tool] = { ...this.brushSettings[tool], ...savedBrushes[tool] };
                }
            });
        }

        // Apply initial tool settings
        this.setTool(this.activeTool);

        const spacing = await this.storage.loadSetting('brushSpacing');
        if (spacing) {
            this.engine.brush.spacing = parseFloat(spacing);
            if (document.getElementById('settings-brush-spacing')) {
                document.getElementById('settings-brush-spacing').value = spacing;
            }
        }

        this.engine.refresh();
    } catch (e) {
        console.error("Data load failed", e);
    }

    this._renderPalette();
    
    this._status('READY');
    this.engine.onDrawStart = () => this._clearSaveTimer();
    this.engine.onDrawMove = () => this._triggerAutoSave();
    this.engine.onDrawEnd = () => this._triggerAutoSave();
    this.engine.onZoomChange = () => this._updateZoomUI();
    this.engine.onTipCaptured = (canvas) => {
        this.tipManager.setTipFromCanvas(canvas);
        this.isCapturingTip = false;
        document.getElementById('btn-tip-capture').classList.remove('active-btn');
        this._status('TIP CAPTURED');
    };

    this.tipManager.onCaptureRequest = () => {
        this.isCapturingTip = !this.isCapturingTip;
        this.engine.isCapturingTip = this.isCapturingTip;
        document.getElementById('btn-tip-capture').classList.toggle('active-btn', this.isCapturingTip);
        document.getElementById('capture-reticle').style.display = this.isCapturingTip ? 'block' : 'none';
        if (this.isCapturingTip) {
            this._status('CLICK ON CANVAS TO CAPTURE AREA');
        } else {
            this._status('CAPTURE CANCELLED');
        }
    };

    // Init picker state
    const firstColor = this.palette.baseColors[0];
    this._updateHSVFromHex(firstColor);
    this._initColorSelector();
  }

  _clearSaveTimer() {
    if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = null;
    }
  }

  _triggerAutoSave() {
    this._clearSaveTimer();
    this.saveTimeout = setTimeout(() => this.save(), 4000);
  }

  _setupUI() {
    // Toolbar buttons
    document.getElementById('btn-brush').onclick = () => this.setTool(TOOLS.BRUSH);
    document.getElementById('btn-eraser').onclick = () => this.setTool(TOOLS.ERASER);
    document.getElementById('btn-wireframe').onclick = () => this.setTool(TOOLS.WIREFRAME);
    document.getElementById('btn-lasso').onclick = () => this.setTool(TOOLS.LASSO);
    document.getElementById('btn-smudge').onclick = () => this.setTool(TOOLS.SMUDGE);
    document.getElementById('btn-ref_move').onclick = () => this.setTool(TOOLS.REF_MOVE);
    document.getElementById('btn-undo').onclick = () => this.engine.undo();
    document.getElementById('btn-redo').onclick = () => this.engine.redo();
    const btnClear = document.getElementById('btn-clear');
    if (btnClear) {
        btnClear.dataset.state = 'idle';
        btnClear.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (btnClear.dataset.state === 'idle') {
                btnClear.dataset.state = 'confirm';
                btnClear.innerText = 'REALLY?';
                btnClear.style.backgroundColor = '#ff0000';
                btnClear.style.color = 'white';
                
                setTimeout(() => {
                    if (btnClear.dataset.state === 'confirm') {
                        btnClear.dataset.state = 'idle';
                        btnClear.innerText = 'Clear';
                        btnClear.style.backgroundColor = '';
                        btnClear.style.color = '';
                    }
                }, 3000);
            } else {
                this.engine.clear();
                this._status('CANVAS PURGED');
                btnClear.dataset.state = 'idle';
                btnClear.innerText = 'PURGED!';
                setTimeout(() => {
                    btnClear.innerText = 'Clear';
                    btnClear.style.backgroundColor = '';
                    btnClear.style.color = '';
                }, 1000);
            }
        });
    }
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

    const sizeSlider = document.getElementById('brush-size');
    const sizeVal = document.getElementById('size-val');
    sizeSlider.oninput = (e) => {
      const val = parseInt(e.target.value);
      this.brushSettings[this.activeTool].size = val;
      this.engine.brush.size = val;
      sizeVal.innerText = val;
    };

    const opacitySlider = document.getElementById('brush-opacity');
    const opacityVal = document.getElementById('opacity-val');
    if (opacitySlider) {
        opacitySlider.oninput = (e) => {
          const val = parseInt(e.target.value);
          this.brushSettings[this.activeTool].opacity = val / 100;
          this.engine.brush.opacity = val / 100;
          opacityVal.innerText = `${val}%`;
        };
    }

    const flowSlider = document.getElementById('brush-flow');
    const flowVal = document.getElementById('flow-val');
    if (flowSlider) {
        flowSlider.oninput = (e) => {
          const val = parseInt(e.target.value);
          this.brushSettings[this.activeTool].flow = val / 100;
          this.engine.brush.flow = val / 100;
          flowVal.innerText = `${val}%`;
        };
    }

    const heightSlider = document.getElementById('brush-height');
    const heightVal = document.getElementById('height-val');
    if (heightSlider) {
        heightSlider.oninput = (e) => {
            const val = parseInt(e.target.value);
            this.brushSettings[this.activeTool].paintHeight = val / 100;
            this.engine.brush.paintHeight = val / 100;
            heightVal.innerText = `${val}%`;
        };
    }

    const oilinessSlider = document.getElementById('brush-oiliness');
    const oilinessVal = document.getElementById('oiliness-val');
    if (oilinessSlider) {
        oilinessSlider.oninput = (e) => {
            const val = parseInt(e.target.value);
            this.brushSettings[this.activeTool].oiliness = val / 100;
            this.engine.brush.oiliness = val / 100;
            oilinessVal.innerText = `${val}%`;
            // If it's a brush, we might want to save it to the tip data in TipManager?
            // Actually, for now, let's just update TipManager's active tip if it's BRUSH tool
            if (this.activeTool === TOOLS.BRUSH && this.tipManager.activeBankIndex >= 0) {
                this.tipManager.tips[this.tipManager.activeBankIndex].oiliness = val / 100;
                this.tipManager._saveToStorage();
            }
        };
    }

    const airbrushSlider = document.getElementById('brush-airbrush');
    const airbrushVal = document.getElementById('airbrush-val');
    if (airbrushSlider) {
        airbrushSlider.oninput = (e) => {
            const val = parseInt(e.target.value);
            this.brushSettings[this.activeTool].airbrush = val / 100;
            this.engine.brush.airbrush = val / 100;
            airbrushVal.innerText = `${val}%`;
            if (this.activeTool === TOOLS.BRUSH && this.tipManager.activeBankIndex >= 0) {
                this.tipManager.tips[this.tipManager.activeBankIndex].airbrush = val / 100;
                this.tipManager._saveToStorage();
            }
        };
    }

    // Speed Sliders - sensitivity tuning
    const sSize = document.getElementById('speed-size');
    const sOpac = document.getElementById('speed-opacity');
    const sVal = document.getElementById('speed-value');
    const sHue = document.getElementById('speed-hue');

    if (sSize) sSize.oninput = (e) => {
        const val = parseInt(e.target.value) / 100;
        this.engine.brush.speedSize = val;
        this.brushSettings[this.activeTool].speedSize = val;
        this._saveBrushSettings();
    };
    if (sOpac) sOpac.oninput = (e) => {
        const val = parseInt(e.target.value) / 100;
        this.engine.brush.speedOpacity = val;
        this.brushSettings[this.activeTool].speedOpacity = val;
        this._saveBrushSettings();
    };
    if (sVal) sVal.oninput = (e) => {
        const val = parseInt(e.target.value) / 100;
        this.engine.brush.speedValue = val;
        this.brushSettings[this.activeTool].speedValue = val;
        this._saveBrushSettings();
    };
    if (sHue) sHue.oninput = (e) => {
        const val = parseInt(e.target.value) / 100;
        this.engine.brush.speedHue = val;
        this.brushSettings[this.activeTool].speedHue = val;
        this._saveBrushSettings();
    };

    // Draggable Panels
    this._makeDraggable(document.getElementById('panel-color'), document.getElementById('handle-color'));
    this._makeDraggable(document.getElementById('panel-images'), document.getElementById('handle-images'));
    this._makeDraggable(document.getElementById('panel-layers'), document.getElementById('handle-layers'));
    this._makeDraggable(document.getElementById('panel-settings'), document.getElementById('handle-settings'));
    this._makeDraggable(document.getElementById('panel-brush-tips'), document.getElementById('handle-brush-tips'));
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
        case '2': this.setTool(TOOLS.WIREFRAME); break;
        case '3': this.setTool(TOOLS.LASSO); break;
        case '4': this.setTool(TOOLS.SMUDGE); break;
        case '5': this.setTool(TOOLS.ERASER); break;
        case '6': this.setTool(TOOLS.REF_MOVE); break;
        case 'b': 
          if (this.engine.floatingSelection) {
              this.engine.floatingSelection.mirrorX = !this.engine.floatingSelection.mirrorX;
              this.engine.refresh();
          } else if (this.activeTool === TOOLS.REF_MOVE && this.engine.selectedRefIndex !== -1) {
              const ref = this.engine.referenceImages[this.engine.selectedRefIndex];
              ref.mirrorX = !ref.mirrorX;
              this.engine.refresh();
              this._triggerAutoSave();
          } else {
              this.engine.toggleMirror(); 
          }
          break;
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
        case 'delete':
        case 'backspace':
          if (this.engine.activeSelectionPath) {
            this.engine.deleteSelection();
            e.preventDefault();
          }
          break;
        case 't':
          this.engine.startTransform();
          break;
        case 'l': this.setTool(TOOLS.LASSO); break;
        case 'c':
          if (e.ctrlKey) {
            this.engine.copy();
            e.preventDefault();
          }
          break;
        case 'v':
          if (e.ctrlKey) {
            this.engine.paste();
            e.preventDefault();
          }
          break;
        case 'x':
          if (e.ctrlKey) {
            this.engine.cut();
            e.preventDefault();
          }
          break;
        case 'z': 
          if (e.ctrlKey) {
              if (e.shiftKey) this.engine.redo();
              else this.engine.undo();
              e.preventDefault();
          }
          break;
        case 'enter':
          if (this.engine.floatingSelection) {
              this.engine._applySelection();
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
    const currentVal = parseInt(el.value);
    
    // Low amount precision bias: if current value < 20, reduce delta effect
    let effectiveDelta = delta;
    if (currentVal < 20) {
        effectiveDelta = Math.sign(delta) * Math.max(1, Math.floor(Math.abs(delta) / 4));
    }
    
    const newVal = Math.max(1, Math.min(500, currentVal + effectiveDelta));
    el.value = newVal;
    this.brushSettings[this.activeTool].size = newVal;
    this.engine.brush.size = newVal;
    if (valEl) valEl.innerText = newVal;
    this._saveBrushSettings();
  }

  _adjOpacity(delta) {
    const el = document.getElementById('brush-opacity');
    const valEl = document.getElementById('opacity-val');
    const pVal = el ? parseInt(el.value) : (this.brushSettings[this.activeTool].opacity * 100);
    
    // Low amount precision bias: if current value < 20, reduce delta effect
    let effectiveDelta = delta;
    if (pVal < 20) {
        effectiveDelta = Math.sign(delta) * Math.max(1, Math.floor(Math.abs(delta) / 4));
    }
    
    const newVal = Math.max(0, Math.min(100, pVal + effectiveDelta));
    if (el) el.value = newVal;
    this.brushSettings[this.activeTool].opacity = newVal / 100;
    this.engine.brush.opacity = newVal / 100;
    if (valEl) valEl.innerText = `${newVal}%`;
    this._saveBrushSettings();
  }

  _handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const ref = this.engine.addReferenceImage(img, file.name);
        this._updateRefImageList();
        this._status('IMAGE IMPORTED');
        this.setLayer(0);
        this._triggerAutoSave();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  _updateRefImageList() {
      const list = document.getElementById('image-list');
      if (!list) return;
      list.innerHTML = '';
      
      if (this.engine.referenceImages.length === 0) {
          list.innerHTML = '<div class="empty-state">Empty</div>';
          return;
      }

      this.engine.referenceImages.forEach((ref, index) => {
          const item = document.createElement('div');
          item.className = 'image-item';
          if (index === this.engine.selectedRefIndex) item.classList.add('active-ref');

          item.onclick = (e) => {
              this.engine.selectedRefIndex = index;
              this.setLayer(0);
              this.engine.refresh();
              this._updateRefImageList();
          };

          const nameSpan = document.createElement('span');
          nameSpan.className = 'truncate';
          nameSpan.innerText = ref.name;
          item.appendChild(nameSpan);

          const delBtn = document.createElement('button');
          delBtn.className = 'btn-del-img';
          delBtn.innerText = 'X';
          delBtn.title = 'Remove Reference';
          delBtn.onclick = (e) => {
              e.stopPropagation();
              this.engine.removeReferenceImage(index);
              this._updateRefImageList();
              this._triggerAutoSave();
          };
          item.appendChild(delBtn);

          list.appendChild(item);
      });
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

  _updateBrushSettingsUI(tool) {
    const settings = this.brushSettings[tool];
    if (this.activeTool === tool) {
        // Update UI Sliders
        document.getElementById('brush-size').value = settings.size;
        document.getElementById('size-val').innerText = settings.size;
        
        const opacEl = document.getElementById('brush-opacity');
        if (opacEl) {
            opacEl.value = settings.opacity * 100;
            document.getElementById('opacity-val').innerText = `${Math.round(settings.opacity * 100)}%`;
        }

        const flowEl = document.getElementById('brush-flow');
        if (flowEl) {
            flowEl.value = settings.flow * 100;
            document.getElementById('flow-val').innerText = `${Math.round(settings.flow * 100)}%`;
        }

        const heightEl = document.getElementById('brush-height');
        if (heightEl) {
            heightEl.value = (settings.paintHeight || 0) * 100;
            const hVal = document.getElementById('height-val');
            if (hVal) hVal.innerText = `${Math.round((settings.paintHeight || 0) * 100)}%`;
        }

        const oilEl = document.getElementById('brush-oiliness');
        if (oilEl) {
            oilEl.value = (settings.oiliness ?? 0.5) * 100;
            const oVal = document.getElementById('oiliness-val');
            if (oVal) oVal.innerText = `${Math.round((settings.oiliness ?? 0.5) * 100)}%`;
        }

        const airEl = document.getElementById('brush-airbrush');
        if (airEl) {
            airEl.value = (settings.airbrush || 0) * 100;
            const aVal = document.getElementById('airbrush-val');
            if (aVal) aVal.innerText = `${Math.round((settings.airbrush || 0) * 100)}%`;
        }

        // Update Sensitivity UI
        if (document.getElementById('speed-size')) document.getElementById('speed-size').value = settings.speedSize * 100;
        if (document.getElementById('speed-opacity')) document.getElementById('speed-opacity').value = settings.speedOpacity * 100;
        if (document.getElementById('speed-value')) document.getElementById('speed-value').value = settings.speedValue * 100;
        if (document.getElementById('speed-hue')) document.getElementById('speed-hue').value = settings.speedHue * 100;
    }
  }

  setTool(tool) {
    if (this.activeTool !== tool) {
        this.prevTool = this.activeTool;
    }
    this.activeTool = tool;
    if (tool === TOOLS.BRUSH || tool === TOOLS.WIREFRAME) {
        this.lastBrush = tool;
    }
    
    // Apply per-brush settings
    const settings = this.brushSettings[tool];
    this.engine.brush.type = tool;
    this.engine.brush.size = settings.size;
    this.engine.brush.opacity = settings.opacity;
    this.engine.brush.flow = settings.flow;
    this.engine.brush.speedSize = settings.speedSize;
    this.engine.brush.speedOpacity = settings.speedOpacity;
    this.engine.brush.speedValue = settings.speedValue;
    this.engine.brush.speedHue = settings.speedHue;
    this.engine.brush.paintHeight = settings.paintHeight || 0;
    this.engine.brush.oiliness = settings.oiliness ?? 0.5;
    this.engine.brush.airbrush = settings.airbrush || 0;

    if (tool === TOOLS.ERASER || tool === TOOLS.SMUDGE) {
        // Shared tip from Brush 1
        this.engine.brush.tip = this.brushSettings[TOOLS.BRUSH].tip;
    } else {
        this.engine.brush.tip = settings.tip;
    }

    this._updateBrushSettingsUI(tool);
    
    // Update UI Buttons
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
    if (this.activeTool === TOOLS.ERASER || this.activeTool === TOOLS.LASSO || this.activeTool === TOOLS.SMUDGE) {
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

    if (index === 0) {
        this.setTool(TOOLS.REF_MOVE);
    } else if (this.activeTool === TOOLS.REF_MOVE) {
        this.setTool(this.lastBrush);
    }

    this._status(`L${index + 1}`);
  }

  async load() {
    this._status('LOADING...');
    try {
        const refs = await this.storage.loadSetting('referenceImages');
        if (refs && Array.isArray(refs)) {
            for (const r of refs) {
                const img = new Image();
                await new Promise(res => {
                    img.onload = res;
                    img.src = r.src;
                });
                this.engine.addReferenceImage(img, r.name, r.x, r.y, {
                    rotation: r.rotation,
                    scale: r.scale,
                    opacity: r.opacity,
                    mirrorX: r.mirrorX,
                    mirrorY: r.mirrorY
                });
            }
            this._updateRefImageList();
        }

        const allKeys = await this.storage.getAllKeys();
        for (const key of allKeys) {
            const parts = key.split('_');
            if (parts.length !== 3) continue;
            const [layerId, cx, cy] = parts.map(Number);
            // Skip layer 0 as it's now handled by referenceImages
            if (layerId === 0) continue;

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
    if (this.engine.isDrawing) {
        this._triggerAutoSave();
        return;
    }
    
    this._status('SAVING...');
    try {
        // Save Reference Images
        const refData = this.engine.referenceImages.map(r => ({
            name: r.name,
            src: r.img.src,
            x: r.x,
            y: r.y,
            rotation: r.rotation,
            scale: r.scale,
            opacity: r.opacity,
            mirrorX: r.mirrorX,
            mirrorY: r.mirrorY
        }));
        await this.storage.saveSetting('referenceImages', refData);

        if (this.engine.dirtyChunks.size === 0) {
            this._status('SAVED');
            this._showSaved();
            return;
        }

        const dirty = Array.from(this.engine.dirtyChunks);
        this.engine.dirtyChunks.clear(); 

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

  _saveBrushSettings() {
    const toSave = {};
    Object.keys(this.brushSettings).forEach(tool => {
        const s = this.brushSettings[tool];
        toSave[tool] = { ...s };
        // Canvas elements cannot be cloned in IndexedDB/Storage
        if (toSave[tool].tip instanceof HTMLCanvasElement) {
            toSave[tool].tip = null; 
        }
    });
    localStorage.setItem('brushSettings', JSON.stringify(toSave));
  }

  async _updateStorageStat() {
      const keys = await this.storage.getAllKeys();
      const stat = document.getElementById('storage-stat');
      if (stat) stat.innerText = `${keys.length} chunks`;
  }
}

new App();
