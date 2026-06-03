import { LAYERS_COUNT, SECTOR_SIZE } from './constants.js';
import { isCanvasEmpty } from './colorUtils.js';

export async function initProjectSystem(app) {
    const list = await app.storage.loadGlobalSetting('projects_list') || [{id: 'default', name: 'ORIGINAL', settings: { chunkSize: 1024, quality: 0.92 }}];
    app.projects = list;
    const currentId = await app.storage.loadGlobalSetting('current_project_id') || 'default';
    app.currentProjectId = currentId;
    app.storage.setProjectId(currentId);
    app.engine.currentProjectId = currentId;
    app.engine.loadViewport(currentId);
    
    // Set Engine settings from current project
    const project = app.projects.find(p => p.id === currentId);
    if (project && project.settings) {
        app.engine.chunkSize = project.settings.chunkSize || 1024;
        app.engine.saveQuality = project.settings.quality || 0.92;
        app.engine.isStatic = project.settings.isStatic || false;
        app.engine.staticWidth = project.settings.width || 2400;
        app.engine.staticHeight = project.settings.height || 3600;
        app.engine.dpiScale = project.settings.dpiScale || 1.0;
        if (app.engine.setupBoard) {
            app.engine.setupBoard();
        }
        syncStaticSettingsUI(app);
    }
    
    await renderProjectList(app);
}

export async function renderProjectList(app) {
    const container = document.getElementById('project-list');
    if (!container) return;
    container.innerHTML = '';

    app.projects.forEach(proj => {
        const item = document.createElement('div');
        item.className = 'project-item';
        if (proj.id === app.currentProjectId) item.classList.add('active');

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
            deleteProject(app, proj.id);
        };
        item.appendChild(delBtn);

        item.onclick = () => switchProject(app, proj.id);
        container.appendChild(item);
    });
}

export async function switchProject(app, id) {
    if (id === app.currentProjectId) return;
    app._status('SAVING...');
    
    // Generate thumbnail before switching
    const thumbnail = await generateThumbnail(app);
    const currentProj = app.projects.find(p => p.id === app.currentProjectId);
    if (currentProj) currentProj.thumbnail = thumbnail;
    await app.storage.saveGlobalSetting('projects_list', app.projects);
    await renderProjectList(app);

    await saveProject(app);
    
    app._status('SWITCHING...');
    app.currentProjectId = id;
    app.storage.setProjectId(id);
    await app.storage.saveGlobalSetting('current_project_id', id);
    
    // Load project settings
    const project = app.projects.find(p => p.id === id);
    const settings = project ? project.settings : {};
    
    // Update Engine with new settings
    app.engine.chunkSize = settings.chunkSize || 1024;
    app.engine.saveQuality = settings.quality || 0.92;
    app.engine.isStatic = settings.isStatic || false;
    app.engine.staticWidth = settings.width || 2400;
    app.engine.staticHeight = settings.height || 3600;
    app.engine.dpiScale = settings.dpiScale || 1.0;
    if (app.engine.setupBoard) {
        app.engine.setupBoard();
    }
    syncStaticSettingsUI(app);
    
    // Wipe engine state
    app.engine.resetEngineState();
    
    app.engine._updateSelectionPreview();
    app.engine.fitZoom();
    
    // Sync UI settings
    document.getElementById('settings-brush-spacing').value = app.engine.brush.spacing;
    
    await loadProject(app);
    app._updateRefImageList();
    await renderProjectList(app);
}

export async function deleteProject(app, id) {
    if (id === 'default') {
        app._status('CANNOT DELETE STANDARD PROJECT');
        return;
    }
    if (!confirm('DELETE THIS PROJECT PERMANENTLY?')) return;
    
    app._status('DELETING...');
    app.projects = app.projects.filter(p => p.id !== id);
    await app.storage.saveGlobalSetting('projects_list', app.projects);
    
    // If we deleted the active project, fallback to default
    if (id === app.currentProjectId) {
        app.currentProjectId = 'default';
        app.storage.setProjectId('default');
        await app.storage.saveGlobalSetting('current_project_id', 'default');
        
        // Reset Engine
        app.engine.resetEngineState();
        app.engine.chunkSize = 1024;
        app.engine.saveQuality = 0.92;
        app.engine.isStatic = false;
        app.engine.staticWidth = 2400;
        app.engine.staticHeight = 3600;
        if (app.engine.setupBoard) {
            app.engine.setupBoard();
        }
        app.engine.fitZoom();
        
        await loadProject(app);
        app._updateRefImageList();
    }
    
    await renderProjectList(app);
    app._status('PROJECT DELETED');
}

export async function loadProject(app) {
    app._status('LOADING...');
    app.engine.selectedRefIndex = -1; // Ensure de-selected on load
    try {
        const refs = await app.storage.loadSetting('referenceImages');
        if (refs && Array.isArray(refs)) {
            for (const r of refs) {
                const img = new Image();
                await new Promise(res => {
                    img.onload = res;
                    img.src = r.src;
                });
                app.engine.addReferenceImage(img, r.name, r.x, r.y, {
                    rotation: r.rotation,
                    scale: r.scale,
                    opacity: r.opacity,
                    mirrorX: r.mirrorX,
                    mirrorY: r.mirrorY
                }, false);
            }
            app._updateRefImageList();
        }

        // 1. LEGACY MIGRATION
        const legacyKeys = await app.storage.getAllLegacyKeys();
        if (legacyKeys.length > 0) {
            app._status('MIGRATING...');
            for (const key of legacyKeys) {
                const parts = key.split('_');
                const cy = parseInt(parts[parts.length - 1]);
                const cx = parseInt(parts[parts.length - 2]);
                const layerId = parseInt(parts[parts.length - 3]);
                
                if (isNaN(layerId) || layerId < 0 || layerId >= LAYERS_COUNT) {
                    continue;
                }

                if (layerId === 0) continue;

                const dataUrl = await app.storage.loadLegacyChunk(key);
                if (dataUrl) {
                    const img = new Image();
                    await new Promise(r => { img.onload = r; img.src = dataUrl; });
                    const chunk = app.engine._getChunk(cx, cy);
                    if (chunk && chunk.ctxs[layerId]) {
                        chunk.ctxs[layerId].drawImage(img, 0, 0);
                        if (chunk.isEmpty) chunk.isEmpty[layerId] = false;
                        app.engine._markDirty(`${cx},${cy}`, layerId, false);
                    }
                }
                await app.storage.deleteLegacyChunk(key);
            }
        }

        // 2. SECTOR LOADING
        const sectorKeys = await app.storage.getAllSectorKeys();
        for (const key of sectorKeys) {
            const parts = key.split('_'); 
            const sy = parseInt(parts[parts.length - 1]);
            const sx = parseInt(parts[parts.length - 2]);
            
            const sector = await app.storage.loadSector(sx, sy);
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
                        const chunk = app.engine._getChunk(cx, cy);
                        if (chunk && chunk.ctxs[layerId]) {
                            chunk.ctxs[layerId].drawImage(img, 0, 0);
                            if (chunk.isEmpty) chunk.isEmpty[layerId] = false;
                        }
                    }
                }
            }
        }

        app.engine.refresh();
        app._status('READY');
    } catch (e) {
        console.error("Load failed", e);
        app._status('LOAD ERROR');
    }
}

export async function saveProject(app) {
    if (app.engine.isDrawing) {
        app._triggerAutoSave();
        return;
    }
    
    app._status('SAVING...');
    try {
        if (app.engine.refsDirty) {
            const refData = app.engine.referenceImages.map(r => ({
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
            await app.storage.saveSetting('referenceImages', refData);
            app.engine.refsDirty = false;
        }

        app.engine.compact();

        if (!app.engine.dirtyChunks || app.engine.dirtyChunks.size === 0) {
            app._status('SAVED');
            app._showSaved();
            return;
        }

        const dirty = Array.from(app.engine.dirtyChunks);
        app.engine.dirtyChunks.clear(); 

        const sectorGroups = new Map();
        
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
        
        for (const [sKey, affectedItems] of sectorGroups) {
            const [sx, sy] = sKey.split(',').map(Number);
            
            let sector = await app.storage.loadSector(sx, sy);
            if (!sector) {
                sector = { chunks: {} };
            }

            for (const item of affectedItems) {
                const [chunkId, layerStr] = item.split('|');
                const l = parseInt(layerStr);
                const [cx, cy] = chunkId.split(',').map(Number);
                const chunkKey = `${l}_${cx}_${cy}`;

                const chunk = app.engine.chunks.get(chunkId);
                if (chunk) {
                    const isEmpty = chunk.isEmpty[l] || isCanvasEmpty(chunk.canvases[l]);
                    
                    if (isEmpty) {
                        delete sector.chunks[chunkKey];
                    } else {
                        const tempCanv = document.createElement('canvas');
                        tempCanv.width = chunk.canvases[l].width;
                        tempCanv.height = chunk.canvases[l].height;
                        const tempCtx = tempCanv.getContext('2d');
                        if (tempCtx) {
                            tempCtx.drawImage(chunk.canvases[l], 0, 0);
                        }
                        const dataUrl = tempCanv.toDataURL('image/png'); 
                        sector.chunks[chunkKey] = dataUrl;

                        // FORCE load from memory (re-render the clean saved PNG back onto the canvas)
                        // This resolves any transient rendering artifact or GPU seam/line residue instantly!
                        try {
                            const img = new Image();
                            await new Promise(resolve => {
                                img.onload = resolve;
                                img.src = dataUrl;
                            });
                            const chunkCtx = chunk.ctxs[l];
                            if (chunkCtx) {
                                chunkCtx.clearRect(0, 0, chunk.canvases[l].width, chunk.canvases[l].height);
                                chunkCtx.drawImage(img, 0, 0);
                            }
                        } catch (err) {
                            console.error("GPU Rebound Force Reload failed for chunk:", chunkKey, err);
                        }

                        // FORCE Promotion back to GPU hardware acceleration
                        // Browser flushes GPU buffers on toDataURL (readback), demoting the layer composition. 
                        // We write a microscopic transparent pixel to immediately re-promote to GPU.
                        const chunkCtx = chunk.ctxs[l];
                        if (chunkCtx) {
                            chunkCtx.fillStyle = 'rgba(0,0,0,0.004)'; // 1/255 opaque, completely invisible
                            chunkCtx.fillRect(0, 0, 2, 2); // 2x2 GPU flush
                        }
                    }
                }
            }

            promises.push(app.storage.saveSector(sx, sy, sector));
        }
        
        await Promise.all(promises);
        
        // Promote all active layer canvases back to GPU after saving & readbacks
        if (app.engine.promoteAllToGPU) {
            app.engine.promoteAllToGPU();
        }

        if (app.engine.refresh) {
            app.engine.refresh();
        }

        app._status('SAVED');
        app._showSaved();
        await updateStorageStat(app);
    } catch (e) {
        console.error("Save failed", e);
        app._status('SAVE ERROR');
    }
}

export async function generateThumbnail(app) {
    const size = 128;
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = size;
    thumbCanvas.height = size;
    const tctx = thumbCanvas.getContext('2d');
    
    tctx.fillStyle = app.engine.canvasBg;
    tctx.fillRect(0, 0, size, size);
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (app.engine.isStatic) {
        minX = -app.engine.staticWidth / 2;
        minY = -app.engine.staticHeight / 2;
        maxX = app.engine.staticWidth / 2;
        maxY = app.engine.staticHeight / 2;
    } else {
        app.engine.chunks.forEach(c => {
            minX = Math.min(minX, c.cx * app.engine.chunkSize);
            minY = Math.min(minY, c.cy * app.engine.chunkSize);
            maxX = Math.max(maxX, (c.cx + 1) * app.engine.chunkSize);
            maxY = Math.max(maxY, (c.cy + 1) * app.engine.chunkSize);
        });
    }
    
    if (minX === Infinity) return '';
    
    const w = maxX - minX;
    const h = maxY - minY;
    const scale = Math.min(size / w, size / h, 1);
    
    tctx.save();
    tctx.translate(size/2, size/2);
    tctx.scale(scale, scale);
    tctx.translate(-(minX + w/2), -(minY + h/2));
    
    app.engine.chunks.forEach(chunk => {
        const lx = app.engine.isStatic ? -app.engine.staticWidth / 2 : chunk.cx * app.engine.chunkSize;
        const ly = app.engine.isStatic ? -app.engine.staticHeight / 2 : chunk.cy * app.engine.chunkSize;
        for (let i = 1; i < LAYERS_COUNT; i++) {
            tctx.drawImage(chunk.canvases[i], lx, ly);
        }
    });
    tctx.restore();
    
    // Sweep and promote all memory-loaded chunk canvases back to GPU after the readback
    if (app.engine.promoteAllToGPU) {
        app.engine.promoteAllToGPU();
    }
    
    return thumbCanvas.toDataURL('image/webp', 0.5);
}

export async function updateStorageStat(app) {
    const stats = await app.storage.getStorageStats();
    
    const chunksEl = document.getElementById('storage-chunks');
    if (chunksEl) {
        if (app.engine.isStatic) {
            chunksEl.innerText = `STATIC SHEET: ${app.engine.staticWidth} x ${app.engine.staticHeight} @ ${app.engine.dpiScale || 1}x`;
        } else {
            chunksEl.innerText = `${stats.chunks} CHUNKS (${stats.sectors} SECTORS)`;
        }
    }

    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    const sizeEl = document.getElementById('storage-size');
    if (sizeEl) sizeEl.innerText = sizeMB;
}

export async function performExport(app) {
    if (!app.currentExportRect) return;
    
    const w = parseInt(document.getElementById('export-width').value);
    const h = parseInt(document.getElementById('export-height').value);
    const alpha = document.getElementById('export-alpha').checked;
    
    const rect = app.currentExportRect;
    
    const xStart = Math.floor(rect.x);
    const yStart = Math.floor(rect.y);
    const xEnd = Math.ceil(rect.x + rect.w);
    const yEnd = Math.ceil(rect.y + rect.h);
    const exactW = Math.max(1, xEnd - xStart);
    const exactH = Math.max(1, yEnd - yStart);
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = exactW;
    tempCanvas.height = exactH;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    tempCtx.save();
    tempCtx.translate(-xStart, -yStart);
    app.engine.referenceImages.forEach(ref => {
        tempCtx.save();
        tempCtx.translate(ref.x, ref.y);
        tempCtx.rotate(ref.rotation);
        tempCtx.scale(ref.scale, ref.scale);
        if (ref.mirrorX) tempCtx.scale(-1, 1);
        if (ref.mirrorY) tempCtx.scale(1, -1);
        tempCtx.globalAlpha = ref.opacity;
        tempCtx.drawImage(ref.img, -ref.img.width/2, -ref.img.height/2);
        tempCtx.restore();
    });
    tempCtx.restore();
    
    app.engine.chunks.forEach(chunk => {
        const lx = app.engine.isStatic ? -app.engine.staticWidth / 2 : chunk.cx * app.engine.chunkSize;
        const ly = app.engine.isStatic ? -app.engine.staticHeight / 2 : chunk.cy * app.engine.chunkSize;
        const chunkW = app.engine.isStatic ? app.engine.staticWidth : app.engine.chunkSize;
        const chunkH = app.engine.isStatic ? app.engine.staticHeight : app.engine.chunkSize;
        
        if (lx < xEnd && lx + chunkW > xStart &&
            ly < yEnd && ly + chunkH > yStart) {
            
            for (let i = 1; i < LAYERS_COUNT; i++) {
                tempCtx.drawImage(chunk.canvases[i], lx - xStart, ly - yStart, chunkW, chunkH);
            }
        }
    });
    
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = w;
    exportCanvas.height = h;
    const exCtx = exportCanvas.getContext('2d');
    if (!exCtx) return;
    
    if (!alpha) {
        exCtx.fillStyle = app.engine.canvasBg;
        exCtx.fillRect(0, 0, w, h);
    }
    
    const cropX = rect.x - xStart;
    const cropY = rect.y - yStart;
    
    exCtx.imageSmoothingEnabled = true;
    exCtx.imageSmoothingQuality = 'high';
    
    exCtx.drawImage(
        tempCanvas,
        cropX, cropY, rect.w, rect.h,
        0, 0, w, h
    );
    
    const link = document.createElement('a');
    link.download = `CONCEPT_BRUTE_${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
    
    // Sweep and promote all memory-loaded chunk canvases back to GPU after export readback
    if (app.engine.promoteAllToGPU) {
        app.engine.promoteAllToGPU();
    }

    app._endExportMode();
    app._status('EXPORTED');
}

export function syncStaticSettingsUI(app) {
    const staticSec = document.getElementById('settings-static-section');
    if (staticSec) {
        if (app.engine.isStatic) {
            staticSec.classList.remove('hidden');
            const wInput = document.getElementById('settings-static-width');
            const hInput = document.getElementById('settings-static-height');
            const dpiSelect = document.getElementById('settings-static-dpi');
            if (wInput) wInput.value = app.engine.staticWidth;
            if (hInput) hInput.value = app.engine.staticHeight;
            if (dpiSelect) {
                dpiSelect.value = String(app.engine.dpiScale || 1);
            }
        } else {
            staticSec.classList.add('hidden');
        }
    }
}
