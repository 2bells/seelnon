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
        return;
    }

    if (!engine.selectionOverlay) {
        engine.selectionOverlay = document.createElement('div');
        engine.selectionOverlay.className = 'absolute pointer-events-none';
        engine.selectionOverlay.style.boxShadow = '0 0 0 1px white, 0 0 0 2px black';
        engine.selectionOverlay.style.border = '1px dashed white';
        engine.uiLayer.appendChild(engine.selectionOverlay);
        
        engine.selectionCanvas = document.createElement('canvas');
        engine.selectionCanvas.className = 'w-full h-full';
        engine.selectionOverlay.appendChild(engine.selectionCanvas);
    }

    const rect = engine.container.getBoundingClientRect();
    const sel = engine.floatingSelection;
    
    // Only resize canvas if dimensions actually changed (performance)
    if (engine.selectionCanvas.width !== sel.canvas.width || engine.selectionCanvas.height !== sel.canvas.height) {
        engine.selectionCanvas.width = sel.canvas.width;
        engine.selectionCanvas.height = sel.canvas.height;
        const ctx = engine.selectionCanvas.getContext('2d');
        ctx.drawImage(sel.canvas, 0, 0);
    }

    engine.selectionOverlay.style.width = `${sel.canvas.width}px`;
    engine.selectionOverlay.style.height = `${sel.canvas.height}px`;
    
    // pivot point calculation in screen space
    const s = engine._worldToScreen(sel.x + sel.canvas.width / 2, sel.y + sel.canvas.height / 2);
    
    let rot = (sel.rotation || 0);
    const sc = (sel.scale || 1);
    const displayScale = sc * engine.zoom;
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
    engine.selectionOverlay.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%) rotate(${finalRot}rad) scale(${displayScale * mirrorX}, ${displayScale * mirrorY})`;
    engine.selectionOverlay.style.opacity = opacity;
    
    // Update info status
    engine._status(`TRANSFORM: ${Math.round(sc * 100)}% | ${Math.round(rot * 180 / Math.PI)}° | OPACITY: ${Math.round(opacity * 100)}%`);
}

export function processLassoSelection(engine) {
    if (!engine.lassoPath || engine.lassoPath.length < 3) {
        engine.lassoPath = null;
        engine.refresh();
        return;
    }
    const prevPath = engine.activeSelectionPath ? [...engine.activeSelectionPath] : null;
    engine.activeSelectionPath = [...engine.lassoPath];
    
    // Push previous path to history so undo can go back
    engine._pushHistory({ type: 'selection', path: prevPath });

    engine.lassoPath = null;
    engine.refresh();
}

export function applySelection(engine) {
    if (!engine.floatingSelection) return;
    
    const sel = engine.floatingSelection;
    const { canvas, x, y, rotation, scale, opacity, mirrorX, mirrorY } = sel;
    const rot = rotation || 0;
    const sc = scale || 1;
    const op = opacity !== undefined ? opacity : 1;
    
    // Calculate bounding box for rotated/scaled canvas to find relevant chunks
    const cos = Math.abs(Math.cos(rot));
    const sin = Math.abs(Math.sin(rot));
    const bbW = (canvas.width * sc * cos + canvas.height * sc * sin);
    const bbH = (canvas.width * sc * sin + canvas.height * sc * cos);

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
            ctx.scale(sc * (mirrorX ? -1 : 1), sc * (mirrorY ? -1 : 1));
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
