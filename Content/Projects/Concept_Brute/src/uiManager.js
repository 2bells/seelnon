import { TOOLS, LAYERS_COUNT } from './constants.js';
import { PaletteManager } from './paletteManager.js';

export function setupUI(app) {
    // Prevents Windows Ink and stylus/pointer interactions from keeping buttons "selected" or focused,
    // which would cause Spacebar (used for panning) to reactivate the last used action/button.
    document.addEventListener('pointerdown', (e) => {
        // Blur active element immediately on click/press so keyboard focus is released
        // Exclude select elements so select dropdowns (like Grid Pattern) function correctly.
        if (e.target.closest('button, [role="button"], input[type="range"]')) {
            setTimeout(() => {
                if (document.activeElement && document.activeElement !== document.body && document.activeElement.tagName !== 'SELECT') {
                    document.activeElement.blur();
                }
            }, 50);
        }
    });

    // Capture Spacebar pressed down when focused on a button or range slider
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
            if (document.activeElement && (
                document.activeElement.tagName === 'BUTTON' || 
                document.activeElement.tagName === 'SELECT' || 
                document.activeElement.type === 'range' ||
                document.activeElement.closest('.brutal-btn, .mini-btn, .tool-btn')
            )) {
                e.preventDefault();
                document.activeElement.blur();
            }
        }
    }, { capture: true });

    // Toolbar buttons
    document.getElementById('btn-brush').onclick = () => app.setTool(TOOLS.BRUSH);
    document.getElementById('btn-eraser').onclick = () => app.setTool(TOOLS.ERASER);
    document.getElementById('btn-wireframe').onclick = () => app.setTool(TOOLS.WIREFRAME);
    document.getElementById('btn-lasso').onclick = () => app.setTool(TOOLS.LASSO);
    document.getElementById('btn-smudge').onclick = () => app.setTool(TOOLS.SMUDGE);
    document.getElementById('btn-ref_move').onclick = () => app.setTool(TOOLS.REF_MOVE);
    document.getElementById('btn-save').onclick = () => {
        if (app.engine.isStatic) {
            app._status('SAVING CODES TO INDEXED-DB...');
            import('./projectManager.js').then(module => {
                module.saveProject(app).then(() => {
                    const rect = {
                        x: -app.engine.isStatic ? app.engine.staticWidth / 2 : 0,
                        y: -app.engine.isStatic ? app.engine.staticHeight / 2 : 0,
                        w: app.engine.isStatic ? app.engine.staticWidth : 0,
                        h: app.engine.isStatic ? app.engine.staticHeight : 0
                    };
                    app._showExportModal(rect);
                    app._status('PROJECT SAVED - EXPORT READY');
                });
            });
        } else {
            app._startExportMode();
        }
    };

    document.getElementById('btn-undo').onclick = () => app.engine.undo();
    document.getElementById('btn-redo').onclick = () => app.engine.redo();
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
                app.engine.clear();
                app._status('CANVAS PURGED');
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
    document.getElementById('file-import').onchange = (e) => app._handleImport(e);

    // Settings
    app.settingsPanel = document.getElementById('panel-settings');
    document.getElementById('btn-settings').onclick = () => {
        app.settingsPanel.classList.toggle('hidden');
        app._updateStorageStat();
    };
    document.getElementById('btn-close-settings').onclick = () => app.settingsPanel.classList.add('hidden');

    // Settings Tabs
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            
            tab.classList.add('active');
            const paneId = `tab-${tab.dataset.tab}`;
            document.getElementById(paneId).classList.add('active');
            
            if (tab.dataset.tab === 'data') app._updateStorageStat();
            if (tab.dataset.tab === 'projects') app._renderProjectList();
        };
    });

    document.getElementById('btn-project-new').onclick = (e) => {
        e.stopPropagation();
        const modal = document.getElementById('modal-new-project');
        modal.classList.remove('hidden');
        // Reset inputs
        document.getElementById('new-project-mode').value = 'infinite';
        document.getElementById('new-project-static-dimensions').classList.add('hidden');
        // Reset/Sync quality value display
        const qualitySlider = document.getElementById('new-project-quality');
        document.getElementById('new-quality-val').innerText = qualitySlider.value;
    };

    document.getElementById('new-project-mode').onchange = (e) => {
        const dimPanel = document.getElementById('new-project-static-dimensions');
        if (e.target.value === 'static') {
            dimPanel.classList.remove('hidden');
        } else {
            dimPanel.classList.add('hidden');
        }
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
        const mode = document.getElementById('new-project-mode').value;
        const isStatic = (mode === 'static');
        const width = isStatic ? (parseInt(document.getElementById('new-project-width').value) || 2400) : 0;
        const height = isStatic ? (parseInt(document.getElementById('new-project-height').value) || 3600) : 0;
        
        const newProj = { 
            id, 
            name, 
            settings: { 
                chunkSize, 
                quality,
                isStatic,
                width,
                height,
                dpiScale: 1.0
            } 
        };
        app.projects.push(newProj);
        await app.storage.saveGlobalSetting('projects_list', app.projects);
        
        document.getElementById('modal-new-project').classList.add('hidden');
        app.switchProject(id);
    };

    // Export Modal
    document.getElementById('btn-close-export').onclick = () => {
        app._endExportMode();
    };

    document.getElementById('export-scale').oninput = (e) => {
        document.getElementById('export-scale-val').innerText = `${e.target.value}%`;
        app._updateExportDimensions();
    };

    const updateDim = () => {
        if (document.getElementById('export-keep-ratio').checked) {
            app._updateExportDimensions(true);
        }
    };
    document.getElementById('export-width').oninput = updateDim;
    document.getElementById('export-height').oninput = updateDim;

    document.getElementById('btn-export-final').onclick = () => app._performExport();

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
            app._status('WIPING DATA...');
            await app.storage.clearDatabase();
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

    // Static settings update triggers
    document.getElementById('btn-apply-static-settings').onclick = async () => {
        const wVal = parseInt(document.getElementById('settings-static-width').value);
        const hVal = parseInt(document.getElementById('settings-static-height').value);
        const dpiVal = parseFloat(document.getElementById('settings-static-dpi').value);

        if (isNaN(wVal) || wVal < 100 || wVal > 15000 || isNaN(hVal) || hVal < 100 || hVal > 15000) {
            app._status('LIMIT REACHED: 100 - 15000 PX');
            return;
        }

        const currentW = app.engine.staticWidth;
        const currentH = app.engine.staticHeight;
        const currentDpi = app.engine.dpiScale || 1.0;

        if (wVal === currentW && hVal === currentH && dpiVal === currentDpi) {
            app._status('NO CHANGES MADE');
            return;
        }

        // Apply settings & upscale artwork smoothly
        app._status('RECONFIGURING CANVAS...');
        
        // Find static chunk
        const chunk = app.engine.chunks.get("0,0");
        const backups = [];

        if (chunk) {
            for (let l = 0; l < 4; l++) {  // LAYERS_COUNT (4)
                const backup = document.createElement('canvas');
                backup.width = chunk.canvases[l].width;
                backup.height = chunk.canvases[l].height;
                backup.getContext('2d').drawImage(chunk.canvases[l], 0, 0);
                backups.push(backup);
            }
        }

        app.engine.staticWidth = wVal;
        app.engine.staticHeight = hVal;
        app.engine.dpiScale = dpiVal;

        // Update in global projects list
        const project = app.projects.find(p => p.id === app.currentProjectId);
        if (project) {
            if (!project.settings) project.settings = {};
            project.settings.width = wVal;
            project.settings.height = hVal;
            project.settings.dpiScale = dpiVal;
            await app.storage.saveGlobalSetting('projects_list', app.projects);
        }

        // Reconfigure chunk canvases
        if (chunk) {
            chunk.width = wVal;
            chunk.height = hVal;

            for (let l = 0; l < 4; l++) {
                const canv = chunk.canvases[l];
                canv.width = wVal * dpiVal;
                canv.height = hVal * dpiVal;

                const ctx = chunk.ctxs[l];
                ctx.restore(); // Clear any existing scales
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clearRect(0, 0, canv.width, canv.height);
                
                // Draw upscaled backup smoothly
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(backups[l], 0, 0, backups[l].width, backups[l].height, 0, 0, canv.width, canv.height);

                if (dpiVal !== 1) {
                    ctx.scale(dpiVal, dpiVal);
                }
            }

            // Reconstruct strokeCanvas
            const sCanv = chunk.strokeCanvas;
            sCanv.width = wVal * dpiVal;
            sCanv.height = hVal * dpiVal;
            
            const sCtx = chunk.strokeCtx;
            sCtx.setTransform(1, 0, 0, 1, 0, 0);
            sCtx.clearRect(0, 0, sCanv.width, sCanv.height);
            if (dpiVal !== 1) {
                sCtx.scale(dpiVal, dpiVal);
            }
        }

        // Reset undo stack since coordinate/backing store size differs
        app.engine.history = [];
        app.engine.redoStack = [];

        // Reposition Board
        if (app.engine.setupBoard) {
            app.engine.setupBoard();
        }

        // Recenter
        app.engine.refresh();
        app.engine.fitZoom();
        app._updateStorageStat();
        
        // Final Save-Out
        if (app.save) {
            await app.save();
        }

        app._status('CANVAS RECONFIGURED!');
    };

    // Original Settings inputs
    document.getElementById('settings-bg-color').oninput = (e) => {
        app.engine.canvasBg = e.target.value;
        app.engine.refreshGrid();
        app.storage.saveSetting('canvasBg', e.target.value);
    };
    document.getElementById('settings-grid-color').oninput = (e) => {
        app.engine.gridColor = e.target.value;
        app.engine.refreshGrid();
        app.storage.saveSetting('gridColor', e.target.value);
    };
    document.getElementById('settings-grid-pattern').onchange = (e) => {
        app.engine.gridPattern = e.target.value;
        app.engine.refreshGrid();
        app.storage.saveSetting('gridPattern', e.target.value);
    };
    document.getElementById('settings-grid-size').oninput = (e) => {
        const val = parseInt(e.target.value);
        app.engine.gridSize = val;
        document.getElementById('grid-size-val').innerText = `${val}px`;
        app.engine.refreshGrid();
        app.storage.saveSetting('gridSize', val);
    };
    document.getElementById('settings-grid-intensity').oninput = (e) => {
        const val = parseInt(e.target.value);
        app.engine.gridIntensity = val / 100;
        document.getElementById('grid-intensity-val').innerText = `${val}%`;
        app.engine.refreshGrid();
        app.storage.saveSetting('gridIntensity', val);
    };
    document.getElementById('settings-grid-show').onchange = (e) => {
        app.engine.showGrid = e.target.checked;
        app.engine.refreshGrid();
        app.storage.saveSetting('showGrid', e.target.checked);
    };
    document.getElementById('settings-brush-spacing').oninput = (e) => {
        const val = parseFloat(e.target.value);
        app.engine.brush.spacing = val;
        if (app.brushSettings[app.activeTool]) {
            app.brushSettings[app.activeTool].spacing = val;
            app._saveBrushSettings();
        }
    };

    const pressureEnable = document.getElementById('settings-pressure-enable');
    const pressureInf = document.getElementById('settings-pressure-influence');
    const pressureVal = document.getElementById('pressure-val');

    if (pressureEnable && pressureInf) {
        pressureEnable.onchange = (e) => {
            const val = e.target.checked;
            app.engine.brush.pressureEnabled = val;
            if (app.brushSettings[app.activeTool]) {
                app.brushSettings[app.activeTool].pressureEnabled = val;
                app._saveBrushSettings();
            }
        };
        pressureInf.oninput = (e) => {
            const val = parseFloat(e.target.value);
            app.engine.brush.pressureInfluence = val;
            pressureVal.innerText = val.toFixed(1);
            if (app.brushSettings[app.activeTool]) {
                app.brushSettings[app.activeTool].pressureInfluence = val;
                app._saveBrushSettings();
            }
        };
    }

    // Jitter sliders
    const jitterSizeInput = document.getElementById('settings-jitter-size');
    const jitterAngleInput = document.getElementById('settings-jitter-angle');
    const jitterPosInput = document.getElementById('settings-jitter-pos');
    const jitterHueInput = document.getElementById('settings-jitter-hue');

    if (jitterSizeInput) {
        jitterSizeInput.oninput = (e) => {
            const rawVal = parseFloat(e.target.value);
            const val = Math.round(app._mapSliderToPrecision(rawVal, 100));
            app.engine.brush.jitterSize = val / 100;
            const valEl = document.getElementById('jitter-size-val');
            if (valEl) valEl.innerText = `${val}%`;
            if (app.brushSettings[app.activeTool]) {
                app.brushSettings[app.activeTool].jitterSize = val;
                app._saveBrushSettings();
            }
        };
    }
    if (jitterAngleInput) {
        jitterAngleInput.oninput = (e) => {
            const rawVal = parseFloat(e.target.value);
            const val = Math.round(app._mapSliderToPrecision(rawVal, 180));
            app.engine.brush.jitterAngle = (val * Math.PI) / 180;
            const valEl = document.getElementById('jitter-angle-val');
            if (valEl) valEl.innerText = `${val}°`;
            if (app.brushSettings[app.activeTool]) {
                app.brushSettings[app.activeTool].jitterAngle = val;
                app._saveBrushSettings();
            }
        };
    }
    if (jitterPosInput) {
        jitterPosInput.oninput = (e) => {
            const rawVal = parseFloat(e.target.value);
            const val = Math.round(app._mapSliderToPrecision(rawVal, 200));
            app.engine.brush.jitterPos = val / 100;
            const valEl = document.getElementById('jitter-pos-val');
            if (valEl) valEl.innerText = `${val}%`;
            if (app.brushSettings[app.activeTool]) {
                app.brushSettings[app.activeTool].jitterPos = val;
                app._saveBrushSettings();
            }
        };
    }
    if (jitterHueInput) {
        jitterHueInput.oninput = (e) => {
            const rawVal = parseFloat(e.target.value);
            const val = Math.round(app._mapSliderToPrecision(rawVal, 100));
            app.engine.brush.jitterHue = val / 100;
            const valEl = document.getElementById('jitter-hue-val');
            if (valEl) valEl.innerText = `${val}%`;
            if (app.brushSettings[app.activeTool]) {
                app.brushSettings[app.activeTool].jitterHue = val;
                app._saveBrushSettings();
            }
        };
    }

    // Zoom controls
    const ZOOM_LEVELS = [0.05, 0.1, 0.15, 0.2, 0.25, 0.33, 0.4, 0.5, 0.66, 0.75, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0, 16.0, 20.0, 24.0, 32.0, 40.0, 50.0];

    document.getElementById('btn-zoom-in').onclick = () => {
        const cur = app.engine.zoom;
        let nextZoom = ZOOM_LEVELS.find(z => z > cur + 0.005);
        if (nextZoom === undefined) nextZoom = cur * 1.2;
        app.engine.setZoom(nextZoom);
        app._updateZoomUI();
    };
    document.getElementById('btn-zoom-out').onclick = () => {
        const cur = app.engine.zoom;
        let prevZoom = [...ZOOM_LEVELS].reverse().find(z => z < cur - 0.005);
        if (prevZoom === undefined) prevZoom = cur / 1.2;
        app.engine.setZoom(prevZoom);
        app._updateZoomUI();
    };
    document.getElementById('btn-zoom-fit').onclick = () => {
        app.engine.fitZoom();
        app._updateZoomUI();
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
            app.autosaveDelay = seconds * 1000;
            autosaveVal.innerText = `${seconds}s`;
            app.storage.saveSetting('autosaveDelaySlider', v);
        };
    }

    if (autosaveEnable) {
        autosaveEnable.onchange = (e) => {
            app.autosaveEnabled = e.target.checked;
            app.storage.saveSetting('autosaveEnabled', e.target.checked);
            if (!app.autosaveEnabled) app._clearSaveTimer();
        };
    }

    if (btnForceSave) {
        btnForceSave.onclick = () => {
            app.save();
            app._status('FORCE SAVED');
        };
    }

    // Palette
    app._renderPalette();

    document.getElementById('btn-reset-palette').onclick = () => {
        app.palette = new PaletteManager();
        app._renderPalette();
        app.storage.saveSetting('palette', app.palette.baseColors);
        app.setColor('#333333');
    };

    // Layers
    const layerStack = document.getElementById('layer-stack');
    layerStack.innerHTML = '';
    // Reverse UI display: Index 3 at top, Index 0 at bottom
    // Index 0 is IMG REF, Indices 1-3 are PAINT LAYERS
    for (let i = LAYERS_COUNT - 1; i >= 0; i--) {
      const container = document.createElement('div');
      container.className = 'layer-item';
      if (i === app.engine.activeLayer) container.classList.add('active-layer');

      const btn = document.createElement('button');
      btn.className = 'layer-btn';
      btn.id = `layer-btn-${i}`;
      btn.innerHTML = i === 0 ? 'IMG REF' : `PAINT ${i}`;
      btn.onclick = () => app.setLayer(i);
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
        if (app.engine.layerSettings[i].alphaLock) lockBtn.classList.add('lock-active');
        lockBtn.onclick = (e) => {
            e.stopPropagation();
            app.engine.layerSettings[i].alphaLock = !app.engine.layerSettings[i].alphaLock;
            lockBtn.classList.toggle('lock-active');
        };
        controls.appendChild(lockBtn);
      }

      // Visibility Toggle for ALL layers
      const visBtn = document.createElement('button');
      visBtn.className = 'layer-vis-btn';
      visBtn.title = 'Toggle Visibility';
      
      const eyeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7"/><circle cx="12" cy="12" r="3"/></svg>`;
      const eyeOffIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`;
      
      visBtn.innerHTML = app.engine.layerSettings[i].visible ? eyeIcon : eyeOffIcon;
      if (!app.engine.layerSettings[i].visible) visBtn.classList.add('vis-hidden');
      
      visBtn.onclick = (e) => {
          e.stopPropagation();
          const newVis = !app.engine.layerSettings[i].visible;
          app.engine.setLayerVisibility(i, newVis);
          visBtn.innerHTML = newVis ? eyeIcon : eyeOffIcon;
          visBtn.classList.toggle('vis-hidden', !newVis);
      };
      controls.appendChild(visBtn);

      container.appendChild(controls);
      layerStack.appendChild(container);
    }
    app.engine.activeLayer = 2; // Default to second paint layer as requested

    const sizeSlider = document.getElementById('brush-size');
    const sizeVal = document.getElementById('size-val');
    sizeSlider.oninput = (e) => {
      const val = parseInt(e.target.value);
      const size = Math.round(app._mapSliderToSize(val));
      if (!app.activeTool) return;
      app.brushSettings[app.activeTool].size = size;
      app.engine.brush.size = size;
      sizeVal.innerText = size;
      app._saveBrushSettings();
    };

    const opacitySlider = document.getElementById('brush-opacity');
    const opacityVal = document.getElementById('opacity-val');
    if (opacitySlider) {
        opacitySlider.oninput = (e) => {
          const val = parseInt(e.target.value);
          if (!app.activeTool) return;
          app.brushSettings[app.activeTool].opacity = val / 100;
          app.engine.brush.opacity = val / 100;
          opacityVal.innerText = `${val}%`;
          app._saveBrushSettings();
        };
    }

    const flowSlider = document.getElementById('brush-flow');
    const flowVal = document.getElementById('flow-val');
    if (flowSlider) {
        flowSlider.oninput = (e) => {
          const val = parseInt(e.target.value);
          if (!app.activeTool) return;
          app.brushSettings[app.activeTool].flow = val / 100;
          app.engine.brush.flow = val / 100;
          flowVal.innerText = `${val}%`;
          app._saveBrushSettings();
        };
    }

    const heightSlider = document.getElementById('brush-height');
    const heightVal = document.getElementById('height-val');
    if (heightSlider) {
        heightSlider.oninput = (e) => {
            const val = parseInt(e.target.value);
            if (!app.activeTool) return;
            app.brushSettings[app.activeTool].paintHeight = val / 100;
            app.engine.brush.paintHeight = val / 100;
            heightVal.innerText = `${val}%`;
            
            if (app.activeTool === TOOLS.BRUSH || app.activeTool === TOOLS.SMUDGE) {
                app.tipManager.updateActiveTipSettings(val / 100, undefined, undefined);
            }
            app._saveBrushSettings();
        };
    }

    const oilinessSlider = document.getElementById('brush-oiliness');
    const oilinessVal = document.getElementById('oiliness-val');
    if (oilinessSlider) {
        oilinessSlider.oninput = (e) => {
            const val = parseInt(e.target.value);
            if (!app.activeTool) return;
            app.brushSettings[app.activeTool].oiliness = val / 100;
            app.engine.brush.oiliness = val / 100;
            oilinessVal.innerText = `${val}%`;
            
            if (app.activeTool === TOOLS.BRUSH || app.activeTool === TOOLS.SMUDGE) {
                app.tipManager.updateActiveTipSettings(undefined, val / 100, undefined);
            }
            app._saveBrushSettings();
        };
    }

    const airbrushSlider = document.getElementById('brush-airbrush');
    const airbrushVal = document.getElementById('airbrush-val');
    if (airbrushSlider) {
        airbrushSlider.oninput = (e) => {
            const val = parseInt(e.target.value);
            if (!app.activeTool) return;
            app.brushSettings[app.activeTool].airbrush = val / 100;
            app.engine.brush.airbrush = val / 100;
            airbrushVal.innerText = `${val}%`;
            
            if (app.activeTool === TOOLS.BRUSH || app.activeTool === TOOLS.SMUDGE) {
                app.tipManager.updateActiveTipSettings(undefined, undefined, val / 100);
            }
            app._saveBrushSettings();
        };
    }

    // Speed Sliders - sensitivity tuning
    const sSize = document.getElementById('speed-size');
    const sOpac = document.getElementById('speed-opacity');
    const sVal = document.getElementById('speed-value');
    const sHue = document.getElementById('speed-hue');

    if (sSize) sSize.oninput = (e) => {
        const val = parseInt(e.target.value) / 100;
        app.engine.brush.speedSize = val;
        const el = document.getElementById('s-size-val');
        if (el) el.innerText = e.target.value;
        if (app.activeTool) {
            app.brushSettings[app.activeTool].speedSize = val;
            app._saveBrushSettings();
        }
    };
    if (sOpac) sOpac.oninput = (e) => {
        const val = parseInt(e.target.value) / 100;
        app.engine.brush.speedOpacity = val;
        const el = document.getElementById('s-opac-val');
        if (el) el.innerText = e.target.value;
        if (app.activeTool) {
            app.brushSettings[app.activeTool].speedOpacity = val;
            app._saveBrushSettings();
        }
    };
    if (sVal) sVal.oninput = (e) => {
        const val = parseInt(e.target.value) / 100;
        app.engine.brush.speedValue = val;
        const el = document.getElementById('s-val-val');
        if (el) el.innerText = e.target.value;
        if (app.activeTool) {
            app.brushSettings[app.activeTool].speedValue = val;
            app._saveBrushSettings();
        }
    };
    if (sHue) sHue.oninput = (e) => {
        const val = parseInt(e.target.value) / 100;
        app.engine.brush.speedHue = val;
        const el = document.getElementById('s-hue-val');
        if (el) el.innerText = e.target.value;
        if (app.activeTool) {
            app.brushSettings[app.activeTool].speedHue = val;
            app._saveBrushSettings();
        }
    };

    // Wire up speed sliders reset arrows to snap back to 0
    document.querySelectorAll('.slider-reset-arrow').forEach(btn => {
        btn.onclick = () => {
            const targetId = btn.getAttribute('data-target');
            const targetInput = document.getElementById(targetId);
            if (targetInput) {
                targetInput.value = 0;
                targetInput.dispatchEvent(new Event('input'));
            }
        };
    });

    // Draggable Panels
    app._makeDraggable(document.getElementById('panel-color'), document.getElementById('handle-color'));
    app._makeDraggable(document.getElementById('panel-images'), document.getElementById('handle-images'));
    app._makeDraggable(document.getElementById('panel-layers'), document.getElementById('handle-layers'));
    app._makeDraggable(app.settingsPanel, document.getElementById('handle-settings'));
    app._makeDraggable(document.getElementById('panel-brush-tips'), document.getElementById('handle-brush-tips'));
    app._makeDraggable(document.getElementById('panel-advanced-brush'), document.getElementById('handle-advanced-brush'));
    app._makeDraggable(document.getElementById('panel-touch-shortcuts'), document.getElementById('handle-touch-shortcuts'));

    // Toggle Touch Shortcuts Panel
    const toggleShortcutsBtn = document.getElementById('btn-toggle-shortcuts');
    const touchShortcutsPanel = document.getElementById('panel-touch-shortcuts');
    if (toggleShortcutsBtn && touchShortcutsPanel) {
        toggleShortcutsBtn.onclick = () => {
            const isHidden = touchShortcutsPanel.classList.toggle('hidden');
            if (isHidden) {
                toggleShortcutsBtn.classList.remove('active');
            } else {
                toggleShortcutsBtn.classList.add('active');
                // Sync current active brush size with the touch slider when opened
                const activeSizeSlider = document.getElementById('touch-brush-size');
                if (activeSizeSlider && app.activeTool) {
                    const currentSize = app.brushSettings[app.activeTool].size;
                    activeSizeSlider.value = app._mapSizeToSlider(currentSize);
                    const touchSizeValDisplay = document.getElementById('touch-size-val');
                    if (touchSizeValDisplay) touchSizeValDisplay.innerText = currentSize;
                }
            }
        };
    }

    const closeShortcutsBtn = document.getElementById('btn-close-shortcuts');
    if (closeShortcutsBtn && touchShortcutsPanel && toggleShortcutsBtn) {
        closeShortcutsBtn.onclick = () => {
            touchShortcutsPanel.classList.add('hidden');
            toggleShortcutsBtn.classList.remove('active');
        };
    }

    // Touch Tools Execution Hooks
    const btnTouchUndo = document.getElementById('btn-touch-undo');
    if (btnTouchUndo) {
        btnTouchUndo.onclick = () => {
            if (app.engine) app.engine.undo();
        };
    }

    const btnTouchRedo = document.getElementById('btn-touch-redo');
    if (btnTouchRedo) {
        btnTouchRedo.onclick = () => {
            if (app.engine) app.engine.redo();
        };
    }

    const btnTouchTransform = document.getElementById('btn-touch-transform');
    if (btnTouchTransform) {
        btnTouchTransform.onclick = () => {
            if (app.engine) {
                if (app.engine.activeSelectionPath) {
                    app.engine.startTransform();
                } else if (!app.engine.floatingSelection) {
                    app._status('SELECT WITH LASSO FIRST');
                    setTimeout(() => app._status(app.activeTool), 1500);
                }
            }
        };
    }

    const btnTouchApply = document.getElementById('btn-touch-apply');
    if (btnTouchApply) {
        btnTouchApply.onclick = () => {
            if (app.engine && app.engine.floatingSelection) {
                app.engine._applySelection();
            }
        };
    }

    const btnTouchDeselect = document.getElementById('btn-touch-deselect');
    if (btnTouchDeselect) {
        btnTouchDeselect.onclick = () => {
            if (app.engine) app.engine.clearSelection();
        };
    }

    const btnTouchPicker = document.getElementById('btn-touch-picker');
    if (btnTouchPicker) {
        btnTouchPicker.onclick = () => {
            if (app.activeTool === TOOLS.PICKER) {
                app.setTool(app.lastBrush || TOOLS.BRUSH);
            } else {
                app.setTool(TOOLS.PICKER);
            }
        };
    }

    const touchBrushSize = document.getElementById('touch-brush-size');
    if (touchBrushSize) {
        touchBrushSize.oninput = (e) => {
            const sliderVal = parseInt(e.target.value);
            const size = app._mapSliderToSize(sliderVal);
            
            if (app.activeTool) {
                app.brushSettings[app.activeTool].size = size;
                app.engine.brush.size = size;
                app._saveBrushSettings();
                
                // Sync main size inputs
                const mainSizeInput = document.getElementById('brush-size');
                if (mainSizeInput) mainSizeInput.value = sliderVal;
                const mainSizeVal = document.getElementById('size-val');
                if (mainSizeVal) mainSizeVal.innerText = size;
                
                const touchSizeValDisplay = document.getElementById('touch-size-val');
                if (touchSizeValDisplay) touchSizeValDisplay.innerText = size;
            }
        };
    }

    const btnTouchSizeDown = document.getElementById('btn-touch-size-down');
    if (btnTouchSizeDown) {
        btnTouchSizeDown.onclick = () => {
            app._adjSize(-5);
        };
    }

    const btnTouchSizeUp = document.getElementById('btn-touch-size-up');
    if (btnTouchSizeUp) {
        btnTouchSizeUp.onclick = () => {
            app._adjSize(5);
        };
    }

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
            app.brushSettings[TOOLS.SMUDGE].smudgeFlowBoost = val;
            if (app.activeTool === TOOLS.SMUDGE) app.engine.brush.smudgeFlowBoost = val;
            document.getElementById('adv-smudge-flow-boost-val').innerText = val.toFixed(1);
            app._saveBrushSettings();
        };
    }

    const smudgePickupInput = document.getElementById('adv-smudge-pickup');
    if (smudgePickupInput) {
        smudgePickupInput.oninput = (e) => {
            const val = parseFloat(e.target.value);
            app.brushSettings[TOOLS.SMUDGE].smudgePickup = val;
            if (app.activeTool === TOOLS.SMUDGE) app.engine.brush.smudgePickup = val;
            document.getElementById('adv-smudge-pickup-val').innerText = val.toFixed(1);
            app._saveBrushSettings();
        };
    }

    const sharpenInput = document.getElementById('adv-brush-sharpen');
    if (sharpenInput) {
        sharpenInput.oninput = (e) => {
            const val = parseFloat(e.target.value);
            // Apply to Brush 1 specifically as it's the primary tool for the tip
            app.brushSettings[TOOLS.BRUSH].brushSharpen = val;
            if (app.activeTool === TOOLS.BRUSH) app.engine.brush.brushSharpen = val;
            document.getElementById('adv-brush-sharpen-val').innerText = val.toFixed(2);
            app._saveBrushSettings();
        };
    }

    // Wireframe Settings
    const wireDensityInput = document.getElementById('adv-wire-density');
    if (wireDensityInput) {
        wireDensityInput.oninput = (e) => {
            const val = parseInt(e.target.value);
            app.brushSettings[TOOLS.WIREFRAME].wireDensity = val;
            if (app.activeTool === TOOLS.WIREFRAME) app.engine.brush.wireDensity = val;
            document.getElementById('adv-wire-density-val').innerText = val;
            app._saveBrushSettings();
        };
    }

    const wireRangeInput = document.getElementById('adv-wire-range');
    if (wireRangeInput) {
        wireRangeInput.oninput = (e) => {
            const val = parseFloat(e.target.value);
            app.brushSettings[TOOLS.WIREFRAME].wireRange = val;
            if (app.activeTool === TOOLS.WIREFRAME) app.engine.brush.wireRange = val;
            document.getElementById('adv-wire-range-val').innerText = val.toFixed(1);
            app._saveBrushSettings();
        };
    }

    const wireMinDistInput = document.getElementById('adv-wire-min-dist');
    if (wireMinDistInput) {
        wireMinDistInput.oninput = (e) => {
            const val = parseFloat(e.target.value);
            app.brushSettings[TOOLS.WIREFRAME].wireMinDist = val;
            if (app.activeTool === TOOLS.WIREFRAME) app.engine.brush.wireMinDist = val;
            document.getElementById('adv-wire-min-dist-val').innerText = val.toFixed(1);
            app._saveBrushSettings();
        };
    }
}
