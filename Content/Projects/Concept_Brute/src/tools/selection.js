export function drawLasso(engine, from, to) {
    if (!engine.lassoPath) {
        engine.lassoPath = [];
    }
    const m = engine._getMousePos({
        clientX: to.x + engine.container.getBoundingClientRect().left,
        clientY: to.y + engine.container.getBoundingClientRect().top
    });
    engine.lassoPath.push({ x: m.wx, y: m.wy });
    engine._status('LASSOING...');
}

export function updateSelectionPreview(engine) {
    if (!engine.floatingSelection) {
        if (engine.selectionOverlay) engine.selectionOverlay.remove();
        engine.selectionOverlay = null;

        // Clean up all chunk selection canvases
        engine.chunks.forEach(chunk => {
            if (chunk.selectionCanvas) {
                chunk.selectionCanvas.remove();
                chunk.selectionCanvas = null;
                chunk.selectionCtx = null;
            }
        });
        return;
    }

    const sel = engine.floatingSelection;
    const scX = sel.scaleX !== undefined ? sel.scaleX : (sel.scale || 1);
    const scY = sel.scaleY !== undefined ? sel.scaleY : (sel.scale || 1);

    // Pre-emptively load and attach chunks inside selection bounding box during transform selection preview
    const rotVal = sel.rotation || 0;
    const cosVal = Math.abs(Math.cos(rotVal));
    const sinVal = Math.abs(Math.sin(rotVal));
    const boundingW = (sel.canvas.width * scX * cosVal + sel.canvas.height * scY * sinVal);
    const boundingH = (sel.canvas.width * scX * sinVal + sel.canvas.height * scY * cosVal);

    const startCX = engine.isStatic ? 0 : Math.floor((sel.x + sel.canvas.width / 2 - boundingW / 2) / engine.chunkSize);
    const startCY = engine.isStatic ? 0 : Math.floor((sel.y + sel.canvas.height / 2 - boundingH / 2) / engine.chunkSize);
    const endCX = engine.isStatic ? 0 : Math.floor((sel.x + sel.canvas.width / 2 + boundingW / 2) / engine.chunkSize);
    const endCY = engine.isStatic ? 0 : Math.floor((sel.y + sel.canvas.height / 2 + boundingH / 2) / engine.chunkSize);

    for (let cx = startCX; cx <= endCX; cx++) {
        for (let cy = startCY; cy <= endCY; cy++) {
            const chunk = engine._getChunk(cx, cy);
            if (chunk && !chunk.isAttached) {
                engine.boardContainer.appendChild(chunk.element);
                chunk.isAttached = true;
                engine._updateChunkTransform(chunk);
            }
        }
    }

    if (!engine.selectionOverlay) {
        engine.selectionOverlay = document.createElement('div');
        engine.selectionOverlay.className = 'absolute pointer-events-none selection-overlay-gpu';
        engine.selectionOverlay.style.boxSizing = 'border-box';
        // Use layout-independent outline and boxShadow for high-contrast marquee look to avoid 1px coordinate shifting.
        engine.selectionOverlay.style.outline = '1px dashed #ffffff';
        engine.selectionOverlay.style.boxShadow = '0 0 0 1px #000000, 0 0 0 2px #ffffff';
        engine.uiLayer.appendChild(engine.selectionOverlay);
    }

    const rect = engine.container.getBoundingClientRect();
    
    engine.selectionOverlay.style.width = `${sel.canvas.width}px`;
    engine.selectionOverlay.style.height = `${sel.canvas.height}px`;
    
    // pivot point calculation in screen space
    const s = engine._worldToScreen(sel.x + sel.canvas.width / 2, sel.y + sel.canvas.height / 2);
    
    let rot = (sel.rotation || 0);
    const displayScaleX = scX * engine.zoom;
    const displayScaleY = scY * engine.zoom;
    const opacity = (sel.opacity !== undefined ? sel.opacity : 1);
    
    let mirrorX = sel.mirrorX ? -1 : 1;
    let mirrorY = sel.mirrorY ? -1 : 1;
    
    let finalRot = rot + engine.rotation;
    if (engine.isMirrored) {
        mirrorX *= -1;
        finalRot = -finalRot;
    }

    engine.selectionOverlay.style.left = '0px';
    engine.selectionOverlay.style.top = '0px';
    engine.selectionOverlay.style.transformOrigin = 'center center';
    // Center on pivot, then rotate and scale
    engine.selectionOverlay.style.transform = `translate3d(${s.x}px, ${s.y}px, 0px) translate3d(-50%, -50%, 0px) rotate(${finalRot}rad) scale(${displayScaleX * mirrorX}, ${displayScaleY * mirrorY})`;
    
    // Opacity shouldn't change opacity of outer UI/bounding box and the menu, so keep overlay fully opaque
    engine.selectionOverlay.style.opacity = '1';

    // Position/update the selectionCanvas on each attached chunk
    const worldPivotX = sel.x + sel.canvas.width / 2;
    const worldPivotY = sel.y + sel.canvas.height / 2;

    engine.chunks.forEach(chunk => {
        if (!chunk.isAttached) {
            if (chunk.selectionCanvas) {
                chunk.selectionCanvas.remove();
                chunk.selectionCanvas = null;
                chunk.selectionCtx = null;
            }
            return;
        }

        const scale = engine.isStatic ? engine.dpiScale : 1;
        
        if (!chunk.selectionCanvas) {
            const sCanv = document.createElement('canvas');
            sCanv.width = chunk.width * scale;
            sCanv.height = chunk.height * scale;
            sCanv.className = 'absolute inset-0';
            sCanv.style.imageRendering = 'auto';
            sCanv.style.backfaceVisibility = 'hidden';
            sCanv.style.webkitBackfaceVisibility = 'hidden';
            sCanv.style.transform = 'translate3d(0, 0, 0)';
            sCanv.style.willChange = 'transform';
            
            const sCtx = sCanv.getContext('2d', { alpha: true });
            if (scale !== 1) {
                sCtx.scale(scale, scale);
            }
            chunk.selectionCanvas = sCanv;
            chunk.selectionCtx = sCtx;
        }
        
        // Ensure its DOM insertion position is correct (immediately above active layer in this chunk)
        const nextCanvas = chunk.canvases[engine.activeLayer + 1];
        if (nextCanvas) {
            if (chunk.selectionCanvas.nextSibling !== nextCanvas) {
                chunk.element.insertBefore(chunk.selectionCanvas, nextCanvas);
            }
        } else {
            if (chunk.element.lastChild !== chunk.selectionCanvas) {
                chunk.element.appendChild(chunk.selectionCanvas);
            }
        }
        
        // Now draw the selection content onto this chunk's canvas
        const sCtx = chunk.selectionCtx;
        sCtx.clearRect(0, 0, chunk.width, chunk.height);
        
        const cxWorld = engine.isStatic ? -engine.staticWidth / 2 : chunk.cx * engine.chunkSize;
        const cyWorld = engine.isStatic ? -engine.staticHeight / 2 : chunk.cy * engine.chunkSize;
        
        sCtx.save();
        sCtx.globalAlpha = opacity;
        
        // Translate relative to chunk coordinate space
        sCtx.translate(-cxWorld, -cyWorld);
        
        // 1. Pivot point of selection in world coordinates
        sCtx.translate(worldPivotX, worldPivotY);
        
        // 2. Rotate
        if (sel.rotation) {
            sCtx.rotate(sel.rotation);
        }
        
        // 3. Scale & Mirror
        let mX = sel.mirrorX ? -1 : 1;
        let mY = sel.mirrorY ? -1 : 1;
        sCtx.scale(scX * mX, scY * mY);
        
        // 4. Draw centrally
        sCtx.drawImage(sel.canvas, -sel.canvas.width / 2, -sel.canvas.height / 2);
        
        sCtx.restore();
    });
    
    // Create/update the mode selector toolbar at the bottom of the bounding box
    let toolbar = document.getElementById('selection-mode-toolbar');
    const isCollapsed = localStorage.getItem('transform_menu_collapsed') === 'true';

    if (!toolbar && engine.selectionOverlay) {
        toolbar = document.createElement('div');
        toolbar.id = 'selection-mode-toolbar';
        toolbar.className = 'absolute pointer-events-auto';
        toolbar.style.top = '100%';
        toolbar.style.bottom = 'auto';
        toolbar.style.left = '50%';
        toolbar.style.display = 'flex';
        toolbar.style.gap = '3px';
        toolbar.style.padding = '3px';
        toolbar.style.backgroundColor = '#ebebeb';
        toolbar.style.border = '2px solid black';
        toolbar.style.boxShadow = 'none';
        toolbar.style.zIndex = '110';
        
        // Horizontal triple dot button to toggle collapse
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'selection-toolbar-toggle-btn';
        toggleBtn.className = 'brutal-btn';
        toggleBtn.textContent = '⋯';
        toggleBtn.style.fontSize = '9px';
        toggleBtn.style.fontFamily = 'monospace';
        toggleBtn.style.fontWeight = '900';
        toggleBtn.style.padding = '2px 6px';
        toggleBtn.style.height = '20px';
        toggleBtn.style.cursor = 'pointer';
        toggleBtn.style.backgroundColor = '#ffffff';
        toggleBtn.style.color = '#000000';
        toggleBtn.style.border = '1px solid black';
        toggleBtn.style.boxShadow = '1px 1px 0px 0px black';
        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            const currentlyCollapsed = localStorage.getItem('transform_menu_collapsed') === 'true';
            localStorage.setItem('transform_menu_collapsed', currentlyCollapsed ? 'false' : 'true');
            engine._updateSelectionPreview();
        };
        toolbar.appendChild(toggleBtn);
        
        // Mode buttons
        const modesContainer = document.createElement('div');
        modesContainer.id = 'selection-modes-container';
        modesContainer.style.display = 'flex';
        modesContainer.style.gap = '3px';
        
        const modes = ['move', 'scale', 'rotate', 'opacity'];
        modes.forEach(mode => {
            const btn = document.createElement('button');
            btn.className = 'brutal-btn';
            btn.textContent = mode.toUpperCase();
            btn.style.fontSize = '9px';
            btn.style.fontFamily = 'monospace';
            btn.style.fontWeight = '900';
            btn.style.padding = '2px 6px';
            btn.style.height = '20px';
            btn.style.cursor = 'pointer';
            
            const currentMode = engine.transformMode || 'move';
            if (currentMode === mode) {
                if (mode === 'scale') {
                    btn.style.backgroundColor = engine.scaleNonUniform ? '#00ffff' : '#ffff00';
                } else {
                    btn.style.backgroundColor = '#ffff00';
                }
            } else {
                btn.style.backgroundColor = '#ffffff';
            }
            
            btn.style.color = '#000000';
            btn.style.border = '1px solid black';
            btn.style.boxShadow = '1px 1px 0px 0px black';
            
            btn.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                if (mode === 'scale') {
                    if (engine.transformMode === 'scale') {
                        engine.scaleNonUniform = !engine.scaleNonUniform;
                    } else {
                        engine.transformMode = 'scale';
                        engine.scaleNonUniform = false; // Default to uniform
                    }
                } else {
                    engine.transformMode = mode;
                }
                
                // Update active states
                const btns = modesContainer.querySelectorAll('button');
                btns.forEach((b, idx) => {
                    const m = modes[idx];
                    if (!m) return;
                    if (m === engine.transformMode) {
                        if (m === 'scale') {
                            b.style.backgroundColor = engine.scaleNonUniform ? '#00ffff' : '#ffff00';
                        } else {
                            b.style.backgroundColor = '#ffff00';
                        }
                    } else {
                        b.style.backgroundColor = '#ffffff';
                    }
                });
            };
            modesContainer.appendChild(btn);
        });

        // Append Mirror Button for easy visual flip access
        const mirrorBtn = document.createElement('button');
        mirrorBtn.className = 'brutal-btn';
        mirrorBtn.textContent = 'MIRROR';
        mirrorBtn.style.fontSize = '9px';
        mirrorBtn.style.fontFamily = 'monospace';
        mirrorBtn.style.fontWeight = '900';
        mirrorBtn.style.padding = '2px 6px';
        mirrorBtn.style.height = '20px';
        mirrorBtn.style.cursor = 'pointer';
        mirrorBtn.style.backgroundColor = '#ffffff';
        mirrorBtn.style.color = '#000000';
        mirrorBtn.style.border = '1px solid black';
        mirrorBtn.style.boxShadow = '1px 1px 0px 0px black';
        mirrorBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            engine.floatingSelection.mirrorX = !engine.floatingSelection.mirrorX;
            engine.refresh();
        };
        modesContainer.appendChild(mirrorBtn);
        
        toolbar.appendChild(modesContainer);
        engine.selectionOverlay.appendChild(toolbar);
    }
        if (toolbar) {
        const modesContainer = document.getElementById('selection-modes-container');
        const toggleBtn = document.getElementById('selection-toolbar-toggle-btn');
        
        if (isCollapsed) {
            // Highly discrete, almost invisible, non-distracting triple dot when collapsed
            toolbar.style.backgroundColor = 'transparent';
            toolbar.style.border = 'none';
            toolbar.style.boxShadow = 'none';
            toolbar.style.padding = '0px';
            
            if (toggleBtn) {
                toggleBtn.style.backgroundColor = 'transparent';
                toggleBtn.style.color = '#000000';
                toggleBtn.style.opacity = '0.35';
                toggleBtn.style.border = 'none';
                toggleBtn.style.boxShadow = 'none';
                toggleBtn.style.fontSize = '12px';
                toggleBtn.style.fontWeight = 'bold';
                toggleBtn.style.width = '24px';
                toggleBtn.style.height = '20px';
                toggleBtn.onmouseenter = () => { toggleBtn.style.opacity = '1.0'; };
                toggleBtn.onmouseleave = () => { toggleBtn.style.opacity = '0.35'; };
            }
            if (modesContainer) {
                modesContainer.style.display = 'none';
            }
        } else {
            // Expanded: flat, neat, clean container with a 2px solid black border (no brutal offset shadow)
            toolbar.style.backgroundColor = '#ebebeb';
            toolbar.style.border = '2px solid black';
            toolbar.style.boxShadow = 'none';
            toolbar.style.padding = '3px';
            
            if (toggleBtn) {
                toggleBtn.style.backgroundColor = '#ffffff';
                toggleBtn.style.color = '#000000';
                toggleBtn.style.opacity = '1.0';
                toggleBtn.style.border = '1px solid black';
                toggleBtn.style.boxShadow = '1px 1px 0px 0px black';
                toggleBtn.style.fontSize = '9px';
                toggleBtn.style.fontWeight = '900';
                toggleBtn.style.width = 'auto';
                toggleBtn.style.height = '20px';
                toggleBtn.onmouseenter = null;
                toggleBtn.onmouseleave = null;
            }
            if (modesContainer) {
                modesContainer.style.display = 'flex';
            }
        }

        const modes = ['move', 'scale', 'rotate', 'opacity'];
        const mContainer = document.getElementById('selection-modes-container');
        if (mContainer) {
            const btns = mContainer.querySelectorAll('button');
            btns.forEach((b, idx) => {
                const m = modes[idx];
                if (!m) return; // Skip mirror button
                if (m === (engine.transformMode || 'move')) {
                    if (m === 'scale') {
                        b.style.backgroundColor = engine.scaleNonUniform ? '#00ffff' : '#ffff00';
                    } else {
                        b.style.backgroundColor = '#ffff00';
                    }
                } else {
                    b.style.backgroundColor = '#ffffff';
                }
            });
        }
        
        const parentScaleX = (scX * engine.zoom) * mirrorX;
        const parentScaleY = (scY * engine.zoom) * mirrorY;
        const invScaleX = 1 / parentScaleX;
        const invScaleY = 1 / parentScaleY;
        toolbar.style.transform = `translateX(-50%) translateY(${12 * Math.abs(invScaleY)}px) scale(${invScaleX}, ${invScaleY})`;
    }

    // Update info status
    const comboScale = scX === scY ? `${Math.round(scX * 100)}%` : `X:${Math.round(scX * 100)}% Y:${Math.round(scY * 100)}%`;
    engine._status(`TRANSFORM: ${comboScale} | ${Math.round(rot * 180 / Math.PI)}° | OPACITY: ${Math.round(opacity * 100)}%`);
}

export function normalizeSelectionPath(path) {
    if (!path) return null;
    if (path.length === 0) return [];
    if (path[0] && Array.isArray(path[0].points)) {
        return path;
    }
    return [{ points: path, type: 'add' }];
}

export function drawSelectionMask(maskCtx, activeSelectionPath, lx, ly) {
    if (!activeSelectionPath) return;
    const norm = normalizeSelectionPath(activeSelectionPath);
    norm.forEach(sub => {
        if (sub.points.length < 3) return;
        maskCtx.save();
        if (sub.type === 'subtract') {
            maskCtx.globalCompositeOperation = 'destination-out';
        } else {
            maskCtx.globalCompositeOperation = 'source-over';
        }
        maskCtx.beginPath();
        sub.points.forEach((p, i) => {
            if (i === 0) maskCtx.moveTo(p.x - lx, p.y - ly);
            else maskCtx.lineTo(p.x - lx, p.y - ly);
        });
        maskCtx.closePath();
        maskCtx.fillStyle = '#ffffff';
        maskCtx.fill();
        maskCtx.restore();
    });
}

export function processLassoSelection(engine, e = null) {
    if (!engine.lassoPath || engine.lassoPath.length < 3) {
        engine.lassoPath = null;
        engine.refresh();
        return;
    }

    const strokeMode = engine.lassoStrokeMode;
    const isAdditive = strokeMode === 'add' || (strokeMode === undefined && (engine.keys['shift'] || (e && e.shiftKey)));
    const isSubtractive = strokeMode === 'subtract' || (strokeMode === undefined && (engine.keys['alt'] || (e && e.altKey)));

    const prevPath = engine.activeSelectionPath ? 
        normalizeSelectionPath(engine.activeSelectionPath).map(p => ({ points: [...p.points], type: p.type })) : 
        null;

    let newPathList = [];
    if (prevPath) {
        newPathList = prevPath.map(p => ({ points: [...p.points], type: p.type }));
    }

    if (isAdditive) {
        newPathList.push({ points: [...engine.lassoPath], type: 'add' });
    } else if (isSubtractive) {
        newPathList.push({ points: [...engine.lassoPath], type: 'subtract' });
    } else {
        newPathList = [{ points: [...engine.lassoPath], type: 'add' }];
    }

    engine.activeSelectionPath = newPathList;
    
    // Push previous path to history so undo can go back
    engine._pushHistory({ type: 'selection', path: prevPath });

    engine.lassoPath = null;
    engine.refresh();
}

export function applySelection(engine) {
    if (!engine.floatingSelection) return;
    
    const sel = engine.floatingSelection;
    const { canvas, x, y, rotation, opacity, mirrorX, mirrorY } = sel;
    const scX = sel.scaleX !== undefined ? sel.scaleX : (sel.scale || 1);
    const scY = sel.scaleY !== undefined ? sel.scaleY : (sel.scale || 1);
    const rot = rotation || 0;
    const op = opacity !== undefined ? opacity : 1;
    
    // Calculate bounding box for rotated/scaled canvas to find relevant chunks
    const cos = Math.abs(Math.cos(rot));
    const sin = Math.abs(Math.sin(rot));
    const bbW = (canvas.width * scX * cos + canvas.height * scY * sin);
    const bbH = (canvas.width * scX * sin + canvas.height * scY * cos);

    const startCX = engine.isStatic ? 0 : Math.floor((x + canvas.width / 2 - bbW / 2) / engine.chunkSize);
    const startCY = engine.isStatic ? 0 : Math.floor((y + canvas.height / 2 - bbH / 2) / engine.chunkSize);
    const endCX = engine.isStatic ? 0 : Math.floor((x + canvas.width / 2 + bbW / 2) / engine.chunkSize);
    const endCY = engine.isStatic ? 0 : Math.floor((y + canvas.height / 2 + bbH / 2) / engine.chunkSize);

    const applyHistory = new Map();
    for (let cx = startCX; cx <= endCX; cx++) {
        for (let cy = startCY; cy <= endCY; cy++) {
            const id = `${cx},${cy}`;
            const chunk = engine._getChunk(cx, cy);
            const ctx = chunk.ctxs[engine.activeLayer];
            const lx = engine.isStatic ? -engine.staticWidth / 2 : cx * engine.chunkSize;
            const ly = engine.isStatic ? -engine.staticHeight / 2 : cy * engine.chunkSize;

            // Backup for undo
            if (!applyHistory.has(id)) {
                const srcCanvas = chunk.canvases[engine.activeLayer];
                const backup = document.createElement('canvas');
                backup.width = srcCanvas.width;
                backup.height = srcCanvas.height;
                backup.getContext('2d').drawImage(srcCanvas, 0, 0);
                applyHistory.set(id, { layer: engine.activeLayer, canvas: backup });
            }

            ctx.save();
            // Pivot around the center of the selection in world space
            const worldPivotX = x + canvas.width / 2;
            const worldPivotY = y + canvas.height / 2;
            
            ctx.translate(worldPivotX - lx, worldPivotY - ly);
            ctx.rotate(rot);
            ctx.scale(scX * (mirrorX ? -1 : 1), scY * (mirrorY ? -1 : 1));
            ctx.globalAlpha = op;
            // Draw centered at the pivot
            ctx.drawImage(canvas, -canvas.width/2, -canvas.height/2);
            ctx.restore();
            
            engine._markDirty(id, engine.activeLayer);
        }
    }

    engine._pushHistory({ 
        type: 'stroke', 
        chunks: applyHistory,
        selection: { ...engine.floatingSelection } 
    });
    engine.floatingSelection = null;
    engine._updateSelectionPreview();
    engine.refresh();
    engine._status('APPLIED');
    if (engine.onDrawEnd) engine.onDrawEnd();
}
