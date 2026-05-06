import { Engine } from './engine.js';
import { SketchStorage } from './storage.js';
import { TOOLS, LAYERS_COUNT, SECTOR_SIZE } from './constants.js';
import { PaletteManager } from './paletteManager.js';
import { TipManager } from './tipManager.js';
import { ImgHandler } from './imgHandler.js';
import { hexToRgb, rgbToHex, rgbToHsv, hsvToRgb, isCanvasEmpty } from './colorUtils.js';

class App {
  constructor() {
    this.engine = new Engine(document.getElementById('canvas-container'));
    this.engine.onColorPicked = (color) => this.setColor(color);
    this.engine.onStatus = (text) => this._status(text);
    this.engine.onDrawEnd = () => {
        if (this.autosaveEnabled) this._triggerAutoSave();
    };
    this.engine.onPaletteExtracted = (colors) => {
        // Pick 2 bright, 2 mid, 2 dark from the 12 extracted values
        // Extraction is sorted by lum: [0..3] Light, [4..7] Mid, [8..11] Dark
        const indices = [0, 1, 5, 6, 10, 11];
        indices.forEach((extractedIdx, paletteIdx) => {
            if (colors[extractedIdx]) {
                this.palette.setBaseColor(paletteIdx, colors[extractedIdx]);
            }
        });
        this._renderPalette();
        if (colors.length > 0) {
            this.setColor(colors[0]);
            this._updateHSVFromHex(colors[0]);
        }
        this._status('PALETTE UPDATED (6 SELECTED)');
        this._updateRefImageList();
        localStorage.setItem('canvas_palette', JSON.stringify(this.palette.baseColors));
    };
    this.storage = new SketchStorage();
    this.palette = new PaletteManager();
    this.imgHandler = new ImgHandler(this.engine, () => this._updateRefImageList());

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
            speedSize: 3.0,
            speedOpacity: 2.0,
            speedValue: -4.0,
            speedHue: -10.0,
            paintHeight: 0,
            oiliness: 0.5,
            airbrush: 0.0,
            smudgeFlowBoost: 10.0,
            smudgePickup: 2.0,
            brushSharpen: 0.0,
            wireDensity: 30,
            wireRange: 4.0,
            wireMinDist: 0.5,
            tip: null
        };
    });
    // Set some defaults
    this.brushSettings[TOOLS.ERASER].opacity = 1.0;
    this.brushSettings[TOOLS.SMUDGE].opacity = 0.5;
    this.brushSettings[TOOLS.SMUDGE].flow = 0.5;
    this.brushSettings[TOOLS.WIREFRAME].size = 20;

    this.tipManager = new TipManager(document.getElementById('panel-brush-tips'), (tip, height, oiliness, airbrush) => {
        // Always store tip in BRUSH settings as it serves as the source for shared tips
        if (this.brushSettings[TOOLS.BRUSH]) {
            this.brushSettings[TOOLS.BRUSH].tip = tip;
            if (height !== undefined) this.brushSettings[TOOLS.BRUSH].paintHeight = height;
            if (oiliness !== undefined) this.brushSettings[TOOLS.BRUSH].oiliness = oiliness;
            if (airbrush !== undefined) this.brushSettings[TOOLS.BRUSH].airbrush = airbrush;
        }

        // Only update active engine brush and current tool settings if they are relevant
        const currentSettings = this.brushSettings[this.activeTool];
        if (currentSettings) {
            // Update tip for all compatible tools (Brush, Eraser, Smudge)
            if (this.activeTool === TOOLS.BRUSH || this.activeTool === TOOLS.ERASER || this.activeTool === TOOLS.SMUDGE) {
                this.engine.brush.tip = tip;
            }

            // Specific property synchronization
            if (this.activeTool === TOOLS.BRUSH) {
                if (height !== undefined) this.engine.brush.paintHeight = height;
                if (oiliness !== undefined) this.engine.brush.oiliness = oiliness;
                if (airbrush !== undefined) this.engine.brush.airbrush = airbrush;
            } else if (this.activeTool === TOOLS.SMUDGE) {
                // Smudge might want oiliness from tip, but usually airbrush stays at tool setting
                if (oiliness !== undefined) {
                    this.engine.brush.oiliness = oiliness;
                    currentSettings.oiliness = oiliness;
                }
            } else if (this.activeTool === TOOLS.ERASER) {
                // Eraser strictly ignores tip properties for blur/height
                this.engine.brush.airbrush = currentSettings.airbrush || 0;
                this.engine.brush.paintHeight = 0;
            }
        }

        this._updateBrushSettingsUI(this.activeTool);
        this._updateBrushPreview();
    }, this.storage);

    this.hsv = { h: 0, s: 70, v: 70 };
    
    this.autosaveDelay = 4000;
    this.autosaveEnabled = true;
    
    this.projects = [];
    this.currentProjectId = 'default';

    this.windowPositions = {};

    this.init();
  }

  async initProjectSystem() {
    const list = await this.storage.loadGlobalSetting('projects_list') || [{id: 'default', name: 'ORIGINAL', settings: { chunkSize: 1024, quality: 0.92 }}];
    this.projects = list;
    const currentId = await this.storage.loadGlobalSetting('current_project_id') || 'default';
    this.currentProjectId = currentId;
    this.storage.setProjectId(currentId);
    this.engine.currentProjectId = currentId;
    this.engine.loadViewport(currentId);
    
    // Set Engine settings from current project
    const project = this.projects.find(p => p.id === currentId);
    if (project && project.settings) {
        this.engine.chunkSize = project.settings.chunkSize || 1024;
        this.engine.saveQuality = project.settings.quality || 0.92;
    }
    
    this._renderProjectList();
  }

  async _renderProjectList() {
    const container = document.getElementById('project-list');
    if (!container) return;
    container.innerHTML = '';

    this.projects.forEach(proj => {
        const item = document.createElement('div');
        item.className = 'project-item';
        if (proj.id === this.currentProjectId) item.classList.add('active');

        const thumbContainer = document.createElement('div');
        thumbContainer.style.width = '100%';
        thumbContainer.style.aspectRatio = '1';
        thumbContainer.style.background = '#eee';
        thumbContainer.style.border = '1px solid #000';
        thumbContainer.style.marginBottom = '4px';
        thumbContainer.style.overflow = 'hidden';
        thumbContainer.style.display = 'flex';
        thumbContainer.style.alignItems = 'center';
        thumbContainer.style.justifyContent = 'center';

        if (proj.thumbnail) {
            const thumb = document.createElement('img');
            thumb.className = 'project-thumb';
            thumb.src = proj.thumbnail;
            thumb.style.width = '100%';
            thumb.style.height = '100%';
            thumb.style.objectFit = 'cover';
            thumbContainer.appendChild(thumb);
        } else {
            const placeholder = document.createElement('div');
            placeholder.innerText = proj.name ? proj.name[0].toUpperCase() : '?';
            placeholder.style.fontSize = '24px';
            placeholder.style.fontWeight = '900';
            placeholder.style.opacity = '0.2';
            thumbContainer.appendChild(placeholder);
        }
        item.appendChild(thumbContainer);

        const name = document.createElement('div');
        name.className = 'project-name';
        name.innerText = proj.name || proj.id;
        item.appendChild(name);

        const delBtn = document.createElement('button');
        delBtn.className = 'btn-delete-proj';
        delBtn.innerText = 'X';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            this.deleteProject(proj.id);
        };
        item.appendChild(delBtn);

        item.onclick = () => this.switchProject(proj.id);
        container.appendChild(item);
    });
  }

  async switchProject(id) {
    if (id === this.currentProjectId) return;
    this._status('SAVING...');
    
    // Generate thumbnail before switching
    const thumbnail = await this._generateThumbnail();
    const currentProj = this.projects.find(p => p.id === this.currentProjectId);
    if (currentProj) currentProj.thumbnail = thumbnail;
    await this.storage.saveGlobalSetting('projects_list', this.projects);
    this._renderProjectList();

    await this.save();
    
    this._status('SWITCHING...');
    this.currentProjectId = id;
    this.storage.setProjectId(id);
    await this.storage.saveGlobalSetting('current_project_id', id);
    
    // Load project settings
    const project = this.projects.find(p => p.id === id);
    const settings = project ? project.settings : {};
    
    // Update Engine with new settings
    this.engine.chunkSize = settings.chunkSize || 1024;
    this.engine.saveQuality = settings.quality || 0.92;
    
    // Wipe engine state
    this.engine.chunks.forEach(c => {
        // Explicitly clear chunk canvases
        c.canvases.forEach(canv => {
            canv.width = 1;
            canv.height = 1;
        });
        if (c.strokeCanvas) {
            c.strokeCanvas.width = 1;
            c.strokeCanvas.height = 1;
        }
        c.element.remove();
    });
    this.engine.chunks.clear();
    this.engine.loadViewport(id);
    this.engine.rotation = 0;
    this.engine._clearStack(this.engine.history);
    this.engine._clearStack(this.engine.redoStack);
    this.engine.referenceImages.forEach(r => r.element.remove());
    this.engine.referenceImages = [];
    this._updateRefImageList();
    this.engine.dirtyChunks.clear();
    
    await this.load();
    this.engine.refresh();
    this._renderProjectList();
    this._status('SWITCHED');
  }

  async deleteProject(id) {
    if (id === 'default') {
        this._status('CANNOT DELETE ORIGINAL');
        return;
    }
    if (!confirm('DELETE THIS PROJECT FOREVER?')) return;

    this.projects = this.projects.filter(p => p.id !== id);
    await this.storage.saveGlobalSetting('projects_list', this.projects);
    
    if (this.currentProjectId === id) {
        this.switchProject('default');
    } else {
        this._renderProjectList();
    }
  }

  async init() {
    this._status('INITIALIZING...');

    // 1. STORAGE & PROJECTS (Lightweight metadata)
    try {
        await this.storage.init();
        await this.initProjectSystem();
    } catch (e) {
        console.error("Storage init failed", e);
        this._status('STORAGE ERROR');
    }

    // 2. PANELS & UI (Instant responsiveness)
    await this.tipManager.ready;
    this._setupUI();
    this._setupHotkeys();
    await this._loadWindowPositions();
    this._restoreWindowPositions();

    // 3. LOAD NON-CANVAS SETTINGS (Fast)
    try {
        // Load autosave settings
        const savedAutosaveSlider = await this.storage.loadSetting('autosaveDelaySlider');
        const savedAutosaveEnabled = await this.storage.loadSetting('autosaveEnabled');
        if (savedAutosaveSlider !== null) {
            const sliderEl = document.getElementById('settings-autosave');
            if (sliderEl) sliderEl.value = savedAutosaveSlider;
            const seconds = Math.round(4 * Math.pow(300 / 4, savedAutosaveSlider / 100));
            this.autosaveDelay = seconds * 1000;
            const valEl = document.getElementById('autosave-val');
            if (valEl) valEl.innerText = `${seconds}s`;
        }
        if (savedAutosaveEnabled !== null) {
            this.autosaveEnabled = savedAutosaveEnabled;
            const enableEl = document.getElementById('settings-autosave-enable');
            if (enableEl) enableEl.checked = savedAutosaveEnabled;
        }

        const savedPalette = await this.storage.loadSetting('palette');
        if (savedPalette) this.palette.baseColors = savedPalette;

        const canvasBg = await this.storage.loadSetting('canvasBg');
        if (canvasBg) {
            this.engine.canvasBg = canvasBg;
            const bgEl = document.getElementById('settings-bg-color');
            if (bgEl) bgEl.value = canvasBg;
        }

        const gridColor = await this.storage.loadSetting('gridColor');
        if (gridColor) {
            this.engine.gridColor = gridColor;
            const gcEl = document.getElementById('settings-grid-color');
            if (gcEl) gcEl.value = gridColor;
        }

        const gridPattern = await this.storage.loadSetting('gridPattern');
        if (gridPattern) {
            this.engine.gridPattern = gridPattern;
            const gpEl = document.getElementById('settings-grid-pattern');
            if (gpEl) gpEl.value = gridPattern;
        }

        const gridSize = await this.storage.loadSetting('gridSize');
        if (gridSize) {
            this.engine.gridSize = parseInt(gridSize);
            const gsEl = document.getElementById('settings-grid-size');
            if (gsEl) gsEl.value = gridSize;
            const gsvEl = document.getElementById('grid-size-val');
            if (gsvEl) gsvEl.innerText = `${gridSize}px`;
        }

        const gridIntensity = await this.storage.loadSetting('gridIntensity');
        if (gridIntensity) {
            this.engine.gridIntensity = parseInt(gridIntensity) / 100;
            const giEl = document.getElementById('settings-grid-intensity');
            if (giEl) giEl.value = gridIntensity;
            const givEl = document.getElementById('grid-intensity-val');
            if (givEl) givEl.innerText = `${gridIntensity}%`;
        }

        const showGrid = await this.storage.loadSetting('showGrid');
        if (showGrid !== undefined) {
            this.engine.showGrid = showGrid;
            const sgEl = document.getElementById('settings-grid-show');
            if (sgEl) sgEl.checked = showGrid;
            this.engine.refreshGrid();
        }

        // BRUSH SETTINGS
        let savedBrushes = null;
        try {
            const raw = localStorage.getItem('brushSettings');
            if (raw) savedBrushes = JSON.parse(raw);
        } catch(e) {}
        if (!savedBrushes) savedBrushes = await this.storage.loadSetting('brushSettings');
        if (savedBrushes) {
            Object.keys(savedBrushes).forEach(tool => {
                if (this.brushSettings[tool]) {
                    this.brushSettings[tool] = { ...this.brushSettings[tool], ...savedBrushes[tool] };
                }
            });
        }

        const spacing = await this.storage.loadSetting('brushSpacing');
        if (spacing) {
            this.engine.brush.spacing = parseFloat(spacing);
            const spEl = document.getElementById('settings-brush-spacing');
            if (spEl) spEl.value = spacing;
        }

    } catch (e) {
        console.warn("Settings load failed", e);
    }

    // 4. RENDER UI STATE
    this._renderPalette();
    this._initColorSelector();
    
    const lastColor = await this.storage.loadSetting('lastColor') || this.palette.baseColors[0];
    this.setColor(lastColor);
    this._updateHSVFromHex(lastColor);
    
    // 5. APPLY BRUSH (Sync UI sliders)
    this.setTool(this.activeTool, true);

    // 6. HEAVY ASSETS (References & Canvas chunks)
    this._status('LOADING ASSETS...');
    await this.load();
    
    // Final sync
    this.engine.refresh();
    this._status('READY');

    // Event hooks
    this.engine.onDrawStart = () => this._clearSaveTimer();
    this.engine.onDrawMove = () => this._triggerAutoSave();
    this.engine.onDrawEnd = () => this._triggerAutoSave();
    this.engine.onZoomChange = () => this._updateZoomUI();
    this.engine.onExportSelectionDone = (rect) => this._showExportModal(rect);
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
  }

  _clearSaveTimer() {
    if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = null;
    }
  }

  _triggerAutoSave() {
    this._clearSaveTimer();
    if (this.autosaveEnabled) {
        this.saveTimeout = setTimeout(() => this.save(), this.autosaveDelay);
    }
  }

  _setupUI() {
    // Toolbar buttons
    document.getElementById('btn-brush').onclick = () => this.setTool(TOOLS.BRUSH);
    document.getElementById('btn-eraser').onclick = () => this.setTool(TOOLS.ERASER);
    document.getElementById('btn-wireframe').onclick = () => this.setTool(TOOLS.WIREFRAME);
    document.getElementById('btn-lasso').onclick = () => this.setTool(TOOLS.LASSO);
    document.getElementById('btn-smudge').onclick = () => this.setTool(TOOLS.SMUDGE);
    document.getElementById('btn-ref_move').onclick = () => this.setTool(TOOLS.REF_MOVE);
    document.getElementById('btn-save').onclick = () => {
        this._startExportMode();
    };

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
    this.settingsPanel = document.getElementById('panel-settings');
    document.getElementById('btn-settings').onclick = () => {
        this.settingsPanel.classList.toggle('hidden');
        this._updateStorageStat();
    };
    document.getElementById('btn-close-settings').onclick = () => this.settingsPanel.classList.add('hidden');

    // Settings Tabs
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            
            tab.classList.add('active');
            const paneId = `tab-${tab.dataset.tab}`;
            document.getElementById(paneId).classList.add('active');
            
            if (tab.dataset.tab === 'data') this._updateStorageStat();
            if (tab.dataset.tab === 'projects') this._renderProjectList();
        };
    });

    document.getElementById('btn-project-new').onclick = (e) => {
        e.stopPropagation();
        const modal = document.getElementById('modal-new-project');
        modal.classList.remove('hidden');
        // Reset/Sync quality value display
        const qualitySlider = document.getElementById('new-project-quality');
        document.getElementById('new-quality-val').innerText = qualitySlider.value;
    };

    document.getElementById('btn-close-new-project').onclick = () => {
        document.getElementById('modal-new-project').classList.add('hidden');
    };

    document.getElementById('new-project-quality').oninput = (e) => {
        document.getElementById('new-quality-val').innerText = e.target.value;
    };

    document.getElementById('btn-create-project-final').onclick = async () => {
        const name = document.getElementById('new-project-name').value || 'SKETCH';
        const id = 'prj_' + Date.now();
        const chunkSize = parseInt(document.getElementById('new-project-chunk-size').value);
        const quality = parseFloat(document.getElementById('new-project-quality').value);
        
        const newProj = { id, name, settings: { chunkSize, quality } };
        this.projects.push(newProj);
        await this.storage.saveGlobalSetting('projects_list', this.projects);
        
        document.getElementById('modal-new-project').classList.add('hidden');
        this.switchProject(id);
    };

    // Export Modal
    document.getElementById('btn-close-export').onclick = () => {
        this._endExportMode();
    };

    document.getElementById('export-scale').oninput = (e) => {
        document.getElementById('export-scale-val').innerText = `${e.target.value}%`;
        this._updateExportDimensions();
    };

    const updateDim = () => {
        if (document.getElementById('export-keep-ratio').checked) {
            this._updateExportDimensions(true);
        }
    };
    document.getElementById('export-width').oninput = updateDim;
    document.getElementById('export-height').oninput = updateDim;

    document.getElementById('btn-export-final').onclick = () => this._performExport();

    let resetClicks = 0;
    document.getElementById('btn-clear-storage').onclick = async (e) => {
        resetClicks++;
        if (resetClicks === 1) {
            e.target.innerText = 'ARE YOU SURE?';
            e.target.style.background = '#ff0000';
        } else if (resetClicks === 2) {
            e.target.innerText = 'TRULY SURE?';
            e.target.style.background = '#880000';
        } else if (resetClicks === 3) {
            this._status('WIPING DATA...');
            await this.storage.clearDatabase();
            localStorage.clear();
            location.reload();
        }
        
        // Reset timer
        setTimeout(() => {
            if (resetClicks < 3) {
                resetClicks = 0;
                e.target.innerText = 'RESET SYSTEM';
                e.target.style.background = '#ff4444';
            }
        }, 3000);
    };

    // Original Settings inputs
    document.getElementById('settings-bg-color').oninput = (e) => {
        this.engine.canvasBg = e.target.value;
        this.engine.refreshGrid();
        this.storage.saveSetting('canvasBg', e.target.value);
    };
    document.getElementById('settings-grid-color').oninput = (e) => {
        this.engine.gridColor = e.target.value;
        this.engine.refreshGrid();
        this.storage.saveSetting('gridColor', e.target.value);
    };
    document.getElementById('settings-grid-pattern').onchange = (e) => {
        this.engine.gridPattern = e.target.value;
        this.engine.refreshGrid();
        this.storage.saveSetting('gridPattern', e.target.value);
    };
    document.getElementById('settings-grid-size').oninput = (e) => {
        const val = parseInt(e.target.value);
        this.engine.gridSize = val;
        document.getElementById('grid-size-val').innerText = `${val}px`;
        this.engine.refreshGrid();
        this.storage.saveSetting('gridSize', val);
    };
    document.getElementById('settings-grid-intensity').oninput = (e) => {
        const val = parseInt(e.target.value);
        this.engine.gridIntensity = val / 100;
        document.getElementById('grid-intensity-val').innerText = `${val}%`;
        this.engine.refreshGrid();
        this.storage.saveSetting('gridIntensity', val);
    };
    document.getElementById('settings-grid-show').onchange = (e) => {
        this.engine.showGrid = e.target.checked;
        this.engine.refreshGrid();
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

    // Autosave inputs
    const autosaveSlider = document.getElementById('settings-autosave');
    const autosaveVal = document.getElementById('autosave-val');
    const autosaveEnable = document.getElementById('settings-autosave-enable');
    const btnForceSave = document.getElementById('btn-force-save');

    if (autosaveSlider) {
        autosaveSlider.oninput = (e) => {
            const v = parseInt(e.target.value);
            // Exponential mapping: 4 * pow(300/4, v/100)
            const seconds = Math.round(4 * Math.pow(300 / 4, v / 100));
            this.autosaveDelay = seconds * 1000;
            autosaveVal.innerText = `${seconds}s`;
            this.storage.saveSetting('autosaveDelaySlider', v);
        };
    }

    if (autosaveEnable) {
        autosaveEnable.onchange = (e) => {
            this.autosaveEnabled = e.target.checked;
            this.storage.saveSetting('autosaveEnabled', e.target.checked);
            if (!this.autosaveEnabled) this._clearSaveTimer();
        };
    }

    if (btnForceSave) {
        btnForceSave.onclick = () => {
            this.save();
            this._status('FORCE SAVED');
        };
    }

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
      const container = document.createElement('div');
      container.className = 'layer-item';
      if (i === this.engine.activeLayer) container.classList.add('active-layer');

      const btn = document.createElement('button');
      btn.className = 'layer-btn';
      btn.id = `layer-btn-${i}`;
      btn.innerHTML = i === 0 ? 'IMG REF' : `PAINT ${i}`;
      btn.onclick = () => this.setLayer(i);
      container.appendChild(btn);

      // Controls container
      const controls = document.createElement('div');
      controls.className = 'layer-controls';

      // Alpha Lock toggle for paint layers
      if (i > 0) {
        const lockBtn = document.createElement('button');
        lockBtn.className = 'layer-lock-btn';
        lockBtn.title = 'Alpha Lock';
        lockBtn.innerHTML = 'A';
        if (this.engine.layerSettings[i].alphaLock) lockBtn.classList.add('lock-active');
        lockBtn.onclick = (e) => {
            e.stopPropagation();
            this.engine.layerSettings[i].alphaLock = !this.engine.layerSettings[i].alphaLock;
            lockBtn.classList.toggle('lock-active');
        };
        controls.appendChild(lockBtn);
      }

      // Visibility Toggle for ALL layers
      const visBtn = document.createElement('button');
      visBtn.className = 'layer-vis-btn';
      visBtn.title = 'Toggle Visibility';
      
      const eyeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
      const eyeOffIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`;
      
      visBtn.innerHTML = this.engine.layerSettings[i].visible ? eyeIcon : eyeOffIcon;
      if (!this.engine.layerSettings[i].visible) visBtn.classList.add('vis-hidden');
      
      visBtn.onclick = (e) => {
          e.stopPropagation();
          const newVis = !this.engine.layerSettings[i].visible;
          this.engine.setLayerVisibility(i, newVis);
          visBtn.innerHTML = newVis ? eyeIcon : eyeOffIcon;
          visBtn.classList.toggle('vis-hidden', !newVis);
      };
      controls.appendChild(visBtn);

      container.appendChild(controls);
      layerStack.appendChild(container);
    }
    this.engine.activeLayer = 2; // Default to second paint layer as requested

    const sizeSlider = document.getElementById('brush-size');
    const sizeVal = document.getElementById('size-val');
    sizeSlider.oninput = (e) => {
      const val = parseInt(e.target.value);
      if (!this.activeTool) return;
      this.brushSettings[this.activeTool].size = val;
      this.engine.brush.size = val;
      sizeVal.innerText = val;
      this._saveBrushSettings();
    };

    const opacitySlider = document.getElementById('brush-opacity');
    const opacityVal = document.getElementById('opacity-val');
    if (opacitySlider) {
        opacitySlider.oninput = (e) => {
          const val = parseInt(e.target.value);
          if (!this.activeTool) return;
          this.brushSettings[this.activeTool].opacity = val / 100;
          this.engine.brush.opacity = val / 100;
          opacityVal.innerText = `${val}%`;
          this._saveBrushSettings();
        };
    }

    const flowSlider = document.getElementById('brush-flow');
    const flowVal = document.getElementById('flow-val');
    if (flowSlider) {
        flowSlider.oninput = (e) => {
          const val = parseInt(e.target.value);
          if (!this.activeTool) return;
          this.brushSettings[this.activeTool].flow = val / 100;
          this.engine.brush.flow = val / 100;
          flowVal.innerText = `${val}%`;
          this._saveBrushSettings();
        };
    }

    const heightSlider = document.getElementById('brush-height');
    const heightVal = document.getElementById('height-val');
    if (heightSlider) {
        heightSlider.oninput = (e) => {
            const val = parseInt(e.target.value);
            if (!this.activeTool) return;
            this.brushSettings[this.activeTool].paintHeight = val / 100;
            this.engine.brush.paintHeight = val / 100;
            heightVal.innerText = `${val}%`;
            
            if (this.activeTool === TOOLS.BRUSH || this.activeTool === TOOLS.SMUDGE) {
                this.tipManager.updateActiveTipSettings(val / 100, undefined, undefined);
            }
            this._saveBrushSettings();
        };
    }

    const oilinessSlider = document.getElementById('brush-oiliness');
    const oilinessVal = document.getElementById('oiliness-val');
    if (oilinessSlider) {
        oilinessSlider.oninput = (e) => {
            const val = parseInt(e.target.value);
            if (!this.activeTool) return;
            this.brushSettings[this.activeTool].oiliness = val / 100;
            this.engine.brush.oiliness = val / 100;
            oilinessVal.innerText = `${val}%`;
            
            if (this.activeTool === TOOLS.BRUSH || this.activeTool === TOOLS.SMUDGE) {
                this.tipManager.updateActiveTipSettings(undefined, val / 100, undefined);
            }
            this._saveBrushSettings();
        };
    }

    const airbrushSlider = document.getElementById('brush-airbrush');
    const airbrushVal = document.getElementById('airbrush-val');
    if (airbrushSlider) {
        airbrushSlider.oninput = (e) => {
            const val = parseInt(e.target.value);
            if (!this.activeTool) return;
            this.brushSettings[this.activeTool].airbrush = val / 100;
            this.engine.brush.airbrush = val / 100;
            airbrushVal.innerText = `${val}%`;
            
            if (this.activeTool === TOOLS.BRUSH || this.activeTool === TOOLS.SMUDGE) {
                this.tipManager.updateActiveTipSettings(undefined, undefined, val / 100);
            }
            this._saveBrushSettings();
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
        if (this.activeTool) {
            this.brushSettings[this.activeTool].speedSize = val;
            this._saveBrushSettings();
        }
    };
    if (sOpac) sOpac.oninput = (e) => {
        const val = parseInt(e.target.value) / 100;
        this.engine.brush.speedOpacity = val;
        if (this.activeTool) {
            this.brushSettings[this.activeTool].speedOpacity = val;
            this._saveBrushSettings();
        }
    };
    if (sVal) sVal.oninput = (e) => {
        const val = parseInt(e.target.value) / 100;
        this.engine.brush.speedValue = val;
        if (this.activeTool) {
            this.brushSettings[this.activeTool].speedValue = val;
            this._saveBrushSettings();
        }
    };
    if (sHue) sHue.oninput = (e) => {
        const val = parseInt(e.target.value) / 100;
        this.engine.brush.speedHue = val;
        if (this.activeTool) {
            this.brushSettings[this.activeTool].speedHue = val;
            this._saveBrushSettings();
        }
    };

    // Draggable Panels
    this._makeDraggable(document.getElementById('panel-color'), document.getElementById('handle-color'));
    this._makeDraggable(document.getElementById('panel-images'), document.getElementById('handle-images'));
    this._makeDraggable(document.getElementById('panel-layers'), document.getElementById('handle-layers'));
    this._makeDraggable(this.settingsPanel, document.getElementById('handle-settings'));
    this._makeDraggable(document.getElementById('panel-brush-tips'), document.getElementById('handle-brush-tips'));
    this._makeDraggable(document.getElementById('panel-advanced-brush'), document.getElementById('handle-advanced-brush'));

    document.getElementById('btn-advanced-brush').onclick = () => {
        document.getElementById('panel-advanced-brush').classList.toggle('hidden');
    };
    document.getElementById('btn-close-advanced-brush').onclick = () => {
        document.getElementById('panel-advanced-brush').classList.add('hidden');
    };

    const smudgeBoostInput = document.getElementById('adv-smudge-flow-boost');
    if (smudgeBoostInput) {
        smudgeBoostInput.oninput = (e) => {
            const val = parseFloat(e.target.value);
            this.brushSettings[TOOLS.SMUDGE].smudgeFlowBoost = val;
            if (this.activeTool === TOOLS.SMUDGE) this.engine.brush.smudgeFlowBoost = val;
            document.getElementById('adv-smudge-flow-boost-val').innerText = val.toFixed(1);
            this._saveBrushSettings();
        };
    }

    const smudgePickupInput = document.getElementById('adv-smudge-pickup');
    if (smudgePickupInput) {
        smudgePickupInput.oninput = (e) => {
            const val = parseFloat(e.target.value);
            this.brushSettings[TOOLS.SMUDGE].smudgePickup = val;
            if (this.activeTool === TOOLS.SMUDGE) this.engine.brush.smudgePickup = val;
            document.getElementById('adv-smudge-pickup-val').innerText = val.toFixed(1);
            this._saveBrushSettings();
        };
    }

    const sharpenInput = document.getElementById('adv-brush-sharpen');
    if (sharpenInput) {
        sharpenInput.oninput = (e) => {
            const val = parseFloat(e.target.value);
            // Apply to Brush 1 specifically as it's the primary tool for the tip
            this.brushSettings[TOOLS.BRUSH].brushSharpen = val;
            if (this.activeTool === TOOLS.BRUSH) this.engine.brush.brushSharpen = val;
            document.getElementById('adv-brush-sharpen-val').innerText = val.toFixed(2);
            this._saveBrushSettings();
        };
    }

    // Wireframe Settings
    const wireDensityInput = document.getElementById('adv-wire-density');
    if (wireDensityInput) {
        wireDensityInput.oninput = (e) => {
            const val = parseInt(e.target.value);
            this.brushSettings[TOOLS.WIREFRAME].wireDensity = val;
            if (this.activeTool === TOOLS.WIREFRAME) this.engine.brush.wireDensity = val;
            document.getElementById('adv-wire-density-val').innerText = val;
            this._saveBrushSettings();
        };
    }

    const wireRangeInput = document.getElementById('adv-wire-range');
    if (wireRangeInput) {
        wireRangeInput.oninput = (e) => {
            const val = parseFloat(e.target.value);
            this.brushSettings[TOOLS.WIREFRAME].wireRange = val;
            if (this.activeTool === TOOLS.WIREFRAME) this.engine.brush.wireRange = val;
            document.getElementById('adv-wire-range-val').innerText = val.toFixed(1);
            this._saveBrushSettings();
        };
    }

    const wireMinDistInput = document.getElementById('adv-wire-min-dist');
    if (wireMinDistInput) {
        wireMinDistInput.oninput = (e) => {
            const val = parseFloat(e.target.value);
            this.brushSettings[TOOLS.WIREFRAME].wireMinDist = val;
            if (this.activeTool === TOOLS.WIREFRAME) this.engine.brush.wireMinDist = val;
            document.getElementById('adv-wire-min-dist-val').innerText = val.toFixed(1);
            this._saveBrushSettings();
        };
    }
  }

  _makeDraggable(el, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.onmousedown = dragMouseDown;

    const self = this;

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
      
      // Save position
      self.windowPositions[el.id] = {
          top: el.offsetTop,
          left: el.offsetLeft
      };
      self._saveWindowPositions();
    }
  }

  _saveWindowPositions() {
      localStorage.setItem('window_positions', JSON.stringify(this.windowPositions));
  }

  async _loadWindowPositions() {
      try {
          const raw = localStorage.getItem('window_positions');
          if (raw) this.windowPositions = JSON.parse(raw);
      } catch (e) {}
  }

  _restoreWindowPositions() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      Object.keys(this.windowPositions).forEach(id => {
          const el = document.getElementById(id);
          if (!el) return;

          let { top, left } = this.windowPositions[id];
          
          // Force layout if not visible to get dimensions, or fallback to defaults
          const w = el.offsetWidth || (id === 'panel-brush-tips' ? 180 : 200);
          const h = el.offsetHeight || 200;

          // Strictly clamp within viewport
          if (left + w > vw) left = vw - w;
          if (left < 0) left = 0;
          if (top + h > vh) top = vh - h;
          if (top < 0) top = 0;

          el.style.top = `${top}px`;
          el.style.left = `${left}px`;
          el.style.right = 'auto';
          el.style.bottom = 'auto';
      });
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
          } else if (this.activeTool === TOOLS.REF_MOVE && this.engine.selectedRefIndex !== -1) {
            this.engine.removeReferenceImage(this.engine.selectedRefIndex);
            this._updateRefImageList();
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
        case 's':
          if (e.ctrlKey) {
            e.preventDefault();
            this._startExportMode();
          } else {
            this._adjOpacity(-5);
          }
          break;
        case 'x':
          if (e.ctrlKey) {
            this.engine.cut();
            e.preventDefault();
          } else {
            this.setTool(TOOLS.ERASER); 
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
        case 'escape':
          if (this.engine.isExportMode) {
              this._endExportMode();
              this._status('EXPORT CANCELLED');
          }
          this.settingsPanel.classList.add('hidden');
          document.getElementById('modal-new-project').classList.add('hidden');
          document.getElementById('modal-export').classList.add('hidden');
          this.isCapturingTip = false;
          this.engine.isCapturingTip = false;
          document.getElementById('capture-reticle').style.display = 'none';
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
    if (!this.activeTool) return;
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
    if (!this.activeTool) return;
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
    e.target.value = ''; // Clear value
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

          // Add mini palette if exists
          if (ref.extractedPalette) {
              const palPreview = document.createElement('div');
              palPreview.className = 'ref-mini-palette';
              ref.extractedPalette.forEach(c => {
                  const s = document.createElement('div');
                  s.style.backgroundColor = c;
                  palPreview.appendChild(s);
              });
              item.appendChild(palPreview);
          }

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
    if (!tool) return;
    const settings = this.brushSettings[tool];
    if (this.activeTool === tool) {
        // Toggle visibility of specific properties based on tool
        const heightCtrl = document.getElementById('height-control');
        const oilCtrl = document.getElementById('oiliness-control');
        const airCtrl = document.getElementById('airbrush-control');
        const advBtn = document.getElementById('btn-advanced-brush');

        if (heightCtrl) heightCtrl.style.display = (tool === TOOLS.BRUSH) ? 'block' : 'none';
        if (oilCtrl) oilCtrl.style.display = (tool === TOOLS.BRUSH || tool === TOOLS.SMUDGE) ? 'block' : 'none';
        if (airCtrl) airCtrl.style.display = (tool === TOOLS.BRUSH) ? 'block' : 'none';
        
        // Advanced settings button visibility
        if (advBtn) {
            const hasAdv = (tool === TOOLS.BRUSH || tool === TOOLS.SMUDGE || tool === TOOLS.WIREFRAME);
            advBtn.style.display = hasAdv ? 'block' : 'none';
        }

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

        // Update Advanced Sliders
        const smudgeBoost = document.getElementById('adv-smudge-flow-boost');
        if (smudgeBoost) {
            smudgeBoost.value = settings.smudgeFlowBoost;
            const valEl = document.getElementById('adv-smudge-flow-boost-val');
            if (valEl) valEl.innerText = settings.smudgeFlowBoost.toFixed(1);
        }
        
        const smudgePickup = document.getElementById('adv-smudge-pickup');
        if (smudgePickup) {
            smudgePickup.value = settings.smudgePickup;
            const valEl = document.getElementById('adv-smudge-pickup-val');
            if (valEl) valEl.innerText = settings.smudgePickup.toFixed(1);
        }
        
        const sharpen = document.getElementById('adv-brush-sharpen');
        if (sharpen) {
            sharpen.value = settings.brushSharpen;
            const valEl = document.getElementById('adv-brush-sharpen-val');
            if (valEl) valEl.innerText = settings.brushSharpen.toFixed(2);
        }
        
        const wireDensity = document.getElementById('adv-wire-density');
        if (wireDensity) {
            wireDensity.value = settings.wireDensity;
            const valEl = document.getElementById('adv-wire-density-val');
            if (valEl) valEl.innerText = settings.wireDensity;
        }
        
        const wireRange = document.getElementById('adv-wire-range');
        if (wireRange) {
            wireRange.value = settings.wireRange;
            const valEl = document.getElementById('adv-wire-range-val');
            if (valEl) valEl.innerText = settings.wireRange.toFixed(1);
        }
        
        const wireMinDist = document.getElementById('adv-wire-min-dist');
        if (wireMinDist) {
            wireMinDist.value = settings.wireMinDist;
            const valEl = document.getElementById('adv-wire-min-dist-val');
            if (valEl) valEl.innerText = settings.wireMinDist.toFixed(1);
        }
    }
  }

  setTool(tool, force = false) {
    if (this.activeTool === tool && !force) return;
    this.prevTool = this.activeTool;
    this.activeTool = tool;
    
    // Deselect reference image when switching to anything that isn't generic move
    if (tool !== TOOLS.REF_MOVE) {
        this.engine.selectedRefIndex = -1;
        this.engine.refresh();
    }

    if (tool === TOOLS.REF_MOVE) {
        if (this.engine.activeLayer !== 0) this.setLayer(0);
    }

    const sensitivityGroup = document.querySelector('.sensitivity-group');
    if (sensitivityGroup) {
        if (tool === TOOLS.BRUSH || tool === TOOLS.SMUDGE || tool === TOOLS.ERASER || tool === TOOLS.WIREFRAME) {
            sensitivityGroup.classList.remove('hidden');
        } else {
            sensitivityGroup.classList.add('hidden');
        }
    }
    
    if (!tool) {
        // Deselecting all tools
        document.querySelectorAll('.tool-group .tool-btn').forEach(btn => {
            btn.classList.remove('active-tool');
        });
        return;
    }

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
    this.engine.brush.paintHeight = (tool === TOOLS.ERASER) ? 0 : (settings.paintHeight || 0);
    this.engine.brush.oiliness = (tool === TOOLS.ERASER) ? 0 : (settings.oiliness ?? 0.5);
    this.engine.brush.airbrush = (tool === TOOLS.ERASER) ? 0 : (settings.airbrush || 0);
    
    this.engine.brush.smudgeFlowBoost = settings.smudgeFlowBoost;
    this.engine.brush.smudgePickup = settings.smudgePickup;
    this.engine.brush.brushSharpen = settings.brushSharpen;
    this.engine.brush.wireDensity = settings.wireDensity;
    this.engine.brush.wireRange = settings.wireRange;
    this.engine.brush.wireMinDist = settings.wireMinDist;

    if (tool === TOOLS.ERASER || tool === TOOLS.SMUDGE) {
        // Shared tip from Brush 1
        this.engine.brush.tip = this.brushSettings[TOOLS.BRUSH].tip;
    } else {
        this.engine.brush.tip = settings.tip;
    }

    if (tool === TOOLS.BRUSH || tool === TOOLS.WIREFRAME || tool === TOOLS.ERASER || tool === TOOLS.SMUDGE) {
        if (this.tipManager) this.tipManager.refreshTip();
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

    if (tool) this._status(tool);
  }

  setColor(color) {
    this.engine.brush.color = color;
    const preview = document.getElementById('current-color-preview');
    if (preview) preview.style.backgroundColor = color;
    this._updateBrushPreview();
    
    if (this.storage) this.storage.saveSetting('lastColor', color);

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
    const prevLayer = this.engine.activeLayer;
    this.engine.activeLayer = index;

    // Deselect reference when switching to paint layer
    if (index !== 0) {
        this.engine.selectedRefIndex = -1;
        this.engine.refresh();
        this._updateRefImageList();
    }

    // Update UI
    for (let i = 0; i < LAYERS_COUNT; i++) {
        const btn = document.getElementById(`layer-btn-${i}`);
        const item = btn?.parentElement;
        if (item) item.classList.remove('active-layer');
    }
    const active = document.getElementById(`layer-btn-${index}`);
    const activeItem = active?.parentElement;
    if (activeItem) activeItem.classList.add('active-layer');

    if (index === 0) {
        if (this.activeTool !== TOOLS.REF_MOVE) this.setTool(TOOLS.REF_MOVE);
        this.imgHandler.activate();
    } else {
        if (this.activeTool === TOOLS.REF_MOVE) {
            this.setTool(this.lastBrush);
        }
        this.imgHandler.deactivate();
    }

    this._status(index === 0 ? 'IMG REF' : `L${index}`);

    const refToolbar = document.getElementById('top-bar-ref');
    const mainToolbar = document.getElementById('top-bar');
    if (index === 0) {
        if (refToolbar) refToolbar.classList.remove('hidden');
        if (mainToolbar) mainToolbar.classList.add('hidden');
    } else {
        if (refToolbar) refToolbar.classList.add('hidden');
        if (mainToolbar) mainToolbar.classList.remove('hidden');
    }
  }

  async load() {
    this._status('LOADING...');
    this.engine.selectedRefIndex = -1; // Ensure de-selected on load
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
                }, false);
            }
            this._updateRefImageList();
        }

        // 1. LEGACY MIGRATION
        const legacyKeys = await this.storage.getAllLegacyKeys();
        if (legacyKeys.length > 0) {
            this._status('MIGRATING...');
            for (const key of legacyKeys) {
                const parts = key.split('_');
                // Format: p_{projectId}_c_{layerId}_{cx}_{cy}
                // Use indices from end to avoid projectId underscore issues
                const cy = parseInt(parts[parts.length - 1]);
                const cx = parseInt(parts[parts.length - 2]);
                const layerId = parseInt(parts[parts.length - 3]);
                
                if (isNaN(layerId) || layerId < 0 || layerId >= LAYERS_COUNT) {
                    // Invalid key or out of bounds, skip
                    continue;
                }

                if (layerId === 0) continue;

                const dataUrl = await this.storage.loadLegacyChunk(key);
                if (dataUrl) {
                    const img = new Image();
                    await new Promise(r => { img.onload = r; img.src = dataUrl; });
                    const chunk = this.engine._getChunk(cx, cy);
                    if (chunk && chunk.ctxs[layerId]) {
                        chunk.ctxs[layerId].drawImage(img, 0, 0);
                        if (chunk.isEmpty) chunk.isEmpty[layerId] = false;
                        // Mark as dirty so it gets saved to the new sector store
                        this.engine._markDirty(`${cx},${cy}`, layerId, false);
                    }
                }
                // Delete legacy key after loading it into memory
                await this.storage.deleteLegacyChunk(key);
            }
        }

        // 2. SECTOR LOADING
        const sectorKeys = await this.storage.getAllSectorKeys();
        for (const key of sectorKeys) {
            const parts = key.split('_'); 
            // Key format: p_${projectId}_s_${sx}_${sy}
            const sy = parseInt(parts[parts.length - 1]);
            const sx = parseInt(parts[parts.length - 2]);
            
            const sector = await this.storage.loadSector(sx, sy);
            if (sector && sector.chunks) {
                for (const chunkKey in sector.chunks) {
                    const cParts = chunkKey.split('_');
                    const cy = parseInt(cParts[cParts.length - 1]);
                    const cx = parseInt(cParts[cParts.length - 2]);
                    const layerId = parseInt(cParts[cParts.length - 3]);
                    const dataUrl = sector.chunks[chunkKey];
                    
                    if (dataUrl && !isNaN(layerId) && layerId >= 0 && layerId < LAYERS_COUNT) {
                        const img = new Image();
                        await new Promise(r => { img.onload = r; img.src = dataUrl; });
                        const chunk = this.engine._getChunk(cx, cy);
                        if (chunk && chunk.ctxs[layerId]) {
                            chunk.ctxs[layerId].drawImage(img, 0, 0);
                            if (chunk.isEmpty) chunk.isEmpty[layerId] = false;
                        }
                    }
                }
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
        // Save Reference Images only if modified
        if (this.engine.refsDirty) {
            const refData = this.engine.referenceImages.map(r => ({
                id: r.id,
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
            this.engine.refsDirty = false;
        }

        this.engine.compact();

        if (!this.engine.dirtyChunks || this.engine.dirtyChunks.size === 0) {
            this._status('SAVED');
            this._showSaved();
            return;
        }

        const dirty = Array.from(this.engine.dirtyChunks);
        this.engine.dirtyChunks.clear(); 

        // Group dirty chunks by sector
        const sectorGroups = new Map(); // "sx,sy" -> Set of "cx,cy,l"
        
        for (const item of dirty) {
            const [chunkId, layerStr] = item.split('|');
            const [cx, cy] = chunkId.split(',').map(Number);
            const sx = Math.floor(cx / SECTOR_SIZE);
            const sy = Math.floor(cy / SECTOR_SIZE);
            const sKey = `${sx},${sy}`;
            
            if (!sectorGroups.has(sKey)) sectorGroups.set(sKey, new Set());
            sectorGroups.get(sKey).add(item);
        }

        const promises = [];
        
        // Process each affected sector
        for (const [sKey, affectedItems] of sectorGroups) {
            const [sx, sy] = sKey.split(',').map(Number);
            
            // Load existing sector data
            let sector = await this.storage.loadSector(sx, sy);
            if (!sector) {
                sector = { chunks: {} };
            }

            // Update sector with dirty chunks
            for (const item of affectedItems) {
                const [chunkId, layerStr] = item.split('|');
                const l = parseInt(layerStr);
                const [cx, cy] = chunkId.split(',').map(Number);
                const chunkKey = `${l}_${cx}_${cy}`;

                const chunk = this.engine.chunks.get(chunkId);
                if (chunk) {
                    // Double check emptiness to ensure we don't store "erased" but not "empty-flagged" chunks
                    const isEmpty = chunk.isEmpty[l] || isCanvasEmpty(chunk.canvases[l]);
                    
                    if (isEmpty) {
                        // Chunk is empty, remove from sector
                        delete sector.chunks[chunkKey];
                    } else {
                        // Serialize chunk to PNG which is lossless and won't leave artifacts at edges
                        const dataUrl = chunk.canvases[l].toDataURL('image/png'); 
                        sector.chunks[chunkKey] = dataUrl;
                    }
                }
            }

            // Save updated sector
            promises.push(this.storage.saveSector(sx, sy, sector));
        }
        
        await Promise.all(promises);
        this._status('SAVED');
        this._showSaved();
        this._updateStorageStat();
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
    this.storage.saveSetting('brushSettings', toSave);
  }

  async _generateThumbnail() {
      // Capture a small version of the canvas
      const size = 128;
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = size;
      thumbCanvas.height = size;
      const tctx = thumbCanvas.getContext('2d');
      
      // Draw background
      tctx.fillStyle = this.engine.canvasBg;
      tctx.fillRect(0, 0, size, size);
      
      // We want to capture the "meat" of the drawing.
      // Easiest is to just use engine.exportImage results but it might be too large.
      // Instead, let's find the bounds of all chunks.
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      this.engine.chunks.forEach(c => {
          minX = Math.min(minX, c.cx * this.engine.chunkSize);
          minY = Math.min(minY, c.cy * this.engine.chunkSize);
          maxX = Math.max(maxX, (c.cx + 1) * this.engine.chunkSize);
          maxY = Math.max(maxY, (c.cy + 1) * this.engine.chunkSize);
      });
      
      if (minX === Infinity) return ''; // Empty
      
      const w = maxX - minX;
      const h = maxY - minY;
      const scale = Math.min(size / w, size / h, 1);
      
      tctx.save();
      tctx.translate(size/2, size/2);
      tctx.scale(scale, scale);
      tctx.translate(-(minX + w/2), -(minY + h/2));
      
      this.engine.chunks.forEach(chunk => {
          for (let i = 1; i < LAYERS_COUNT; i++) {
              tctx.drawImage(chunk.canvases[i], chunk.cx * this.engine.chunkSize, chunk.cy * this.engine.chunkSize);
          }
      });
      tctx.restore();
      
      return thumbCanvas.toDataURL('image/webp', 0.5);
  }

  async _updateStorageStat() {
      const stats = await this.storage.getStorageStats();
      
      const chunksEl = document.getElementById('storage-chunks');
      if (chunksEl) chunksEl.innerText = `${stats.chunks} CHUNKS (${stats.sectors} SECTORS)`;

      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      const sizeEl = document.getElementById('storage-size');
      if (sizeEl) sizeEl.innerText = sizeMB;
  }

  _showExportModal(rect) {
      if (!rect || rect.w <= 0 || rect.h <= 0) return;
      this.currentExportRect = rect;
      
      const modal = document.getElementById('modal-export');
      modal.classList.remove('hidden');
      
      const wInput = document.getElementById('export-width');
      const hInput = document.getElementById('export-height');
      wInput.value = Math.round(rect.w);
      hInput.value = Math.round(rect.h);
      
      this.exportAspectRatio = rect.w / rect.h;
      
      document.getElementById('export-scale').value = 100;
      document.getElementById('export-scale-val').innerText = '100%';
      
      // Force repaint/reflow to ensure it shows up
      modal.style.display = 'none';
      modal.offsetHeight; // reflow
      modal.style.display = 'block';
  }

  _updateExportDimensions(ratioOnly = false) {
      if (!this.currentExportRect) return;
      
      const wInput = document.getElementById('export-width');
      const hInput = document.getElementById('export-height');
      const scaleInput = document.getElementById('export-scale');
      const keepRatio = document.getElementById('export-keep-ratio').checked;
      
      if (ratioOnly && keepRatio) {
          // If width changed, update height, and vice versa
          // We need to know which one was modified last. 
          // For simplicity, let's assume width is master if both changed?
          // Actually, let's just use the current active element.
          if (document.activeElement === wInput) {
              hInput.value = Math.round(wInput.value / this.exportAspectRatio);
          } else if (document.activeElement === hInput) {
              wInput.value = Math.round(hInput.value * this.exportAspectRatio);
          }
      } else {
          // Scale changed
          const scale = parseInt(scaleInput.value) / 100;
          wInput.value = Math.round(this.currentExportRect.w * scale);
          hInput.value = Math.round(this.currentExportRect.h * scale);
      }
  }

  async _performExport() {
      if (!this.currentExportRect) return;
      
      const w = parseInt(document.getElementById('export-width').value);
      const h = parseInt(document.getElementById('export-height').value);
      const alpha = document.getElementById('export-alpha').checked;
      
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = w;
      exportCanvas.height = h;
      const exCtx = exportCanvas.getContext('2d');
      
      if (!alpha) {
          exCtx.fillStyle = this.engine.canvasBg;
          exCtx.fillRect(0, 0, w, h);
      }
      
      const rect = this.currentExportRect;
      const scaleX = w / rect.w;
      const scaleY = h / rect.h;
      
      exCtx.save();
      exCtx.scale(scaleX, scaleY);
      exCtx.translate(-rect.x, -rect.y);
      
      // Draw reference images (Layer 0)
      this.engine.referenceImages.forEach(ref => {
          exCtx.save();
          exCtx.translate(ref.x, ref.y);
          exCtx.rotate(ref.rotation);
          exCtx.scale(ref.scale, ref.scale);
          if (ref.mirrorX) exCtx.scale(-1, 1);
          if (ref.mirrorY) exCtx.scale(1, -1);
          exCtx.globalAlpha = ref.opacity;
          exCtx.drawImage(ref.img, -ref.img.width/2, -ref.img.height/2);
          exCtx.restore();
      });
      
      this.engine.chunks.forEach(chunk => {
          const chunkX = chunk.cx * this.engine.chunkSize;
          const chunkY = chunk.cy * this.engine.chunkSize;
          
          // Check overlap
          if (chunkX < rect.x + rect.w && chunkX + this.engine.chunkSize > rect.x &&
              chunkY < rect.y + rect.h && chunkY + this.engine.chunkSize > rect.y) {
              
              for (let i = 1; i < LAYERS_COUNT; i++) {
                  // Use a tiny 1px overlap to hide seams when drawing scaled chunks
                  exCtx.drawImage(chunk.canvases[i], chunkX, chunkY, this.engine.chunkSize + 1, this.engine.chunkSize + 1);
              }
          }
      });
      exCtx.restore();
      
      // Download
      const link = document.createElement('a');
      link.download = `CONCEPT_BRUTE_${Date.now()}.png`;
      link.href = exportCanvas.toDataURL('image/png');
      link.click();
      
      this._endExportMode();
      this._status('EXPORTED');
  }

  _startExportMode() {
      this.engine.isExportMode = true;
      this.engine.container.classList.add('export-mode');
      this.setTool(null);
      this._status('DRAG TO SELECT EXPORT AREA (ESC TO CANCEL)');
  }

  _endExportMode() {
      const modal = document.getElementById('modal-export');
      if (modal) {
          modal.classList.add('hidden');
          modal.style.display = 'none';
      }
      this.engine.isExportMode = false;
      this.engine.container.classList.remove('export-mode');
      if (this.prevTool) this.setTool(this.prevTool);
      else this.setTool(TOOLS.BRUSH);
  }

  _updateBrushPreview() {
      const canvas = document.getElementById('brush-preview-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 32, 32);
      
      const tip = this.engine.brush.tip;
      if (!tip) return;
      
      const color = this.engine.brush.color;
      
      const temp = document.createElement('canvas');
      temp.width = 32; temp.height = 32;
      const tctx = temp.getContext('2d');
      tctx.fillStyle = color;
      tctx.fillRect(0, 0, 32, 32);
      tctx.globalCompositeOperation = 'destination-in';
      tctx.drawImage(tip, 4, 4, 24, 24);
      
      ctx.drawImage(temp, 0, 0);
  }
}

new App();
