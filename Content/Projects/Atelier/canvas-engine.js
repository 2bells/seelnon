class InfiniteCanvas {
    constructor(container, app) {
        this.container = container;
        this.app = app; // Reference to main app
        this.canvas = null;
        this.ctx = null;
        
        // Viewport properties
        this.viewport = {
            x: 0,
            y: 0,
            zoom: 1,
            width: 0,
            height: 0
        };
        
        // Panning state
        this.isPanning = false;
        this.isSpacePan = false;
        this.isPanToolActive = false;
        
        // Canvas chunks for infinite drawing
        this.chunks = new Map();
        this.chunkSize = 512;
        this.chunkRenderPadding = 2; // Overlap chunks to prevent seams
        this.activeChunks = new Set();
        
        // Selection state
        this.selection = null; // {x, y, width, height} in world coordinates
        this.floatingSelection = null; // {canvas, x, y, width, height} for moving selections

        // Performance optimization
        this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        this.isDirty = false;
        this.animationFrameId = null;
        
        this.STORAGE_KEY = 'atelier-canvas';
        this.saveDebounceTimer = null;
        this.isInitialized = false;
        
        this.init();
        this.setupEventListeners();
    }
    
    init() {
        this.canvas = document.getElementById('main-canvas');
        this.ctx = this.canvas.getContext('2d', {
            alpha: true, // Enable alpha for background color
            desynchronized: true,
            willReadFrequently: false
        });
        
        this.loadFromStorage();
        this.isInitialized = true;
        
        this.resize();
        this.render();
    }
    
    resize() {
        const rect = this.container.getBoundingClientRect();
        this.viewport.width = rect.width;
        this.viewport.height = rect.height;
        
        this.canvas.width = rect.width * this.pixelRatio;
        this.canvas.height = rect.height * this.pixelRatio;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        this.markDirty();
        this.dispatchViewportChange(); // Notify about resize which changes viewport dimensions
    }
    
    setupEventListeners() {
        window.addEventListener('resize', () => this.resize());
        
        // Pan functionality
        let lastPanPoint = { x: 0, y: 0 };
        
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1 || (e.button === 0 && (this.isSpacePan || this.isPanToolActive))) { // Middle mouse or Space+Left or Pan tool
                this.isPanning = true;
                lastPanPoint = { x: e.clientX, y: e.clientY };
                this.app.updateCursor();
                e.preventDefault();
            }
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                let deltaX = e.clientX - lastPanPoint.x;
                const deltaY = e.clientY - lastPanPoint.y;

                // Adjust deltaX for mirroring during panning
                if (this.app.isMirroredX) {
                    deltaX = -deltaX; 
                }
                
                this.viewport.x -= deltaX / this.viewport.zoom;
                this.viewport.y -= deltaY / this.viewport.zoom;
                
                lastPanPoint = { x: e.clientX, y: e.clientY };
                this.markDirty();
                this.dispatchViewportChange(); // Notify about pan
                e.preventDefault();
            }
        });
        
        this.canvas.addEventListener('mouseup', (e) => {
            if (this.isPanning) {
                this.isPanning = false;
                this.app.updateCursor();
            }
        });

        // Handle mouse leaving the canvas while panning
        this.canvas.addEventListener('mouseleave', (e) => {
            if (this.isPanning) {
                this.isPanning = false;
                this.app.updateCursor();
            }
        });
        
        // Zoom functionality
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const worldX = (mouseX / this.viewport.zoom) + this.viewport.x;
            const worldY = (mouseY / this.viewport.zoom) + this.viewport.y;
            
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = Math.max(0.1, Math.min(10, this.viewport.zoom * zoomFactor));
            
            this.viewport.x = worldX - (mouseX / newZoom);
            this.viewport.y = worldY - (mouseY / newZoom);
            this.viewport.zoom = newZoom;
            
            this.updateZoomDisplay();
            this.markDirty();
            this.dispatchViewportChange(); // Notify about zoom
        });
    }

    dispatchViewportChange() {
        // Dispatch a custom event with the current viewport state
        this.canvas.dispatchEvent(new CustomEvent('viewportchange', { detail: { ...this.viewport } }));
    }
    
    getChunkKey(worldX, worldY) {
        const chunkX = Math.floor(worldX / this.chunkSize);
        const chunkY = Math.floor(worldY / this.chunkSize);
        return `${chunkX},${chunkY}`;
    }
    
    getOrCreateChunk(worldX, worldY) {
        const key = this.getChunkKey(worldX, worldY);
        
        if (!this.chunks.has(key)) {
            const canvas = document.createElement('canvas');
            const paddedSize = this.chunkSize + 2 * this.chunkRenderPadding;
            canvas.width = paddedSize;
            canvas.height = paddedSize;
            const ctx = canvas.getContext('2d', {
                alpha: true,
                desynchronized: true,
                willReadFrequently: false
            });
            
            const [chunkX, chunkY] = key.split(',').map(Number);
            
            this.chunks.set(key, {
                canvas,
                ctx,
                x: chunkX * this.chunkSize,
                y: chunkY * this.chunkSize,
                dirty: false
            });
        }
        
        return this.chunks.get(key);
    }
    
    getVisibleChunks() {
        const visible = [];
        const startX = Math.floor((this.viewport.x - 100) / this.chunkSize);
        const endX = Math.ceil((this.viewport.x + this.viewport.width / this.viewport.zoom + 100) / this.chunkSize);
        const startY = Math.floor((this.viewport.y - 100) / this.chunkSize);
        const endY = Math.ceil((this.viewport.y + this.viewport.height / this.viewport.zoom + 100) / this.chunkSize);
        
        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                const key = `${x},${y}`;
                if (this.chunks.has(key)) {
                    visible.push(this.chunks.get(key));
                }
            }
        }
        
        return visible;
    }
    
    drawAcrossChunks(worldX, worldY, brushSize, drawFunction) {
        const radius = brushSize / 2;
        const minX = worldX - radius;
        const maxX = worldX + radius;
        const minY = worldY - radius;
        const maxY = worldY + radius;
    
        const startChunkX = Math.floor(minX / this.chunkSize);
        const endChunkX = Math.floor(maxX / this.chunkSize);
        const startChunkY = Math.floor(minY / this.chunkSize);
        const endChunkY = Math.floor(maxY / this.chunkSize);
    
        for (let cx = startChunkX; cx <= endChunkX; cx++) {
            for (let cy = startChunkY; cy <= endChunkY; cy++) {
                const worldChunkX = cx * this.chunkSize;
                const worldChunkY = cy * this.chunkSize;
                
                const chunk = this.getOrCreateChunk(worldChunkX, worldChunkY);
    
                // --- History/Undo Change ---
                // If a stroke is active, notify the history manager to save the chunk's state
                // before it's modified for the first time in this stroke.
                const key = `${cx},${cy}`;
                this.canvas.dispatchEvent(new CustomEvent('beforechunkdraw', { detail: { chunk, key } }));
                // --- End History/Undo Change ---
    
                const localX = worldX - chunk.x + this.chunkRenderPadding;
                const localY = worldY - chunk.y + this.chunkRenderPadding;
    
                chunk.ctx.save();
                drawFunction(chunk.ctx, localX, localY);
                chunk.ctx.restore();
    
                chunk.dirty = true;
            }
        }
    
        this.markDirty();
        this.scheduleSave(); // Schedule save after drawing
    }
    
    drawToChunk(worldX, worldY, drawFunction) {
        const chunk = this.getOrCreateChunk(worldX, worldY);
        const localX = worldX - chunk.x + this.chunkRenderPadding;
        const localY = worldY - chunk.y + this.chunkRenderPadding;
        
        chunk.ctx.save();
        drawFunction(chunk.ctx, localX, localY);
        chunk.ctx.restore();
        
        chunk.dirty = true;
        this.markDirty();
    }
    
    screenToWorld(screenX, screenY) {
        let transformedScreenX = screenX;
        // If the view is mirrored, effectively flip the screen X coordinate
        // to get the correct underlying canvas X for drawing.
        if (this.app.isMirroredX) {
            transformedScreenX = this.viewport.width - screenX; 
        }

        return {
            x: (transformedScreenX / this.viewport.zoom) + this.viewport.x,
            y: (screenY / this.viewport.zoom) + this.viewport.y
        };
    }
    
    worldToScreen(worldX, worldY) {
        return {
            x: (worldX - this.viewport.x) * this.viewport.zoom,
            y: (worldY - this.viewport.y) * this.viewport.zoom
        };
    }
    
    markDirty() {
        this.isDirty = true;
        if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(() => this.render());
        }
    }
    
    render() {
        if (!this.isDirty) return;
        
        this.ctx.save(); // Save the context state before any transformations
        this.ctx.scale(this.pixelRatio, this.pixelRatio); // Apply pixel ratio scaling

        // Clear with background color (now scaled)
        this.ctx.fillStyle = '#f0f0f0';
        this.ctx.fillRect(0, 0, this.canvas.width / this.pixelRatio, this.canvas.height / this.pixelRatio);
        
        // --- Mirroring Transformation ---
        if (this.app.isMirroredX) {
            const viewCenterX = (this.viewport.width / 2); // Screen center X (pre-pixelRatio scale)
            this.ctx.translate(viewCenterX, 0); 
            this.ctx.scale(-1, 1);             
            this.ctx.translate(-viewCenterX, 0); 
        }
        // --- End Mirroring Transformation ---
        
        // Draw grid - this will also be mirrored
        this.drawGrid();
        
        // Draw visible chunks
        const visibleChunks = this.getVisibleChunks();
        for (const chunk of visibleChunks) {
            // Screen coordinates adjusted for viewport and zoom, *before* pixelRatio
            const screenStartX = (chunk.x - this.viewport.x) * this.viewport.zoom;
            const screenStartY = (chunk.y - this.viewport.y) * this.viewport.zoom;
            const screenEndX = (chunk.x + this.chunkSize - this.viewport.x) * this.viewport.zoom;
            const screenEndY = (chunk.y + this.chunkSize - this.viewport.y) * this.viewport.zoom;

            const destX = Math.round(screenStartX);
            const destY = Math.round(screenStartY);
            const destWidth = Math.round(screenEndX) - destX;
            const destHeight = Math.round(screenEndY) - destY;

            if (destWidth <= 0 || destHeight <= 0) {
                continue;
            }

            this.ctx.save(); // Save state for this specific chunk draw (allows setting globalAlpha etc.)
            this.ctx.globalAlpha = 1;
            this.ctx.drawImage(
                chunk.canvas,
                this.chunkRenderPadding, 
                this.chunkRenderPadding, 
                this.chunkSize,          
                this.chunkSize,          
                destX,                   
                destY,                   
                destWidth,               
                destHeight               
            );
            this.ctx.restore(); // Restore chunk-specific state
        }
        
        // --- Draw Selection Rectangle ---
        if (this.selection) {
            this.drawSelection();
        }
        // --- End Draw Selection ---
        
        // --- Draw Floating Selection ---
        if (this.floatingSelection) {
            this.drawFloatingSelection();
        }
        // --- End Draw Floating Selection ---

        this.ctx.restore(); // Restore the context to its initial state (undo pixelRatio and mirroring)

        this.isDirty = false;
        this.animationFrameId = null;
    }
    
    drawGrid() {
        const gridSize = 50;
        const screenGridSize = gridSize * this.viewport.zoom;
        
        if (screenGridSize < 10) return; // Don't draw grid when too zoomed out
        
        this.ctx.save();
        this.ctx.fillStyle = '#cccccc';
        this.ctx.globalAlpha = Math.min(1, (screenGridSize - 10) / 40);
        
        const startX = Math.floor(this.viewport.x / gridSize) * gridSize;
        const startY = Math.floor(this.viewport.y / gridSize) * gridSize;
        const endX = startX + (this.viewport.width / this.viewport.zoom) + gridSize;
        const endY = startY + (this.viewport.height / this.viewport.zoom) + gridSize;
        
        for (let x = startX; x <= endX; x += gridSize) {
            const screenX = (x - this.viewport.x) * this.viewport.zoom;
            for (let y = startY; y <= endY; y += gridSize) {
                const screenY = (y - this.viewport.y) * this.viewport.zoom;
                this.ctx.beginPath();
                this.ctx.arc(screenX, screenY, 1, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        this.ctx.restore();
    }
    
    drawSelection() {
        if (!this.selection) return;

        const screenRect = {
            x: (this.selection.x - this.viewport.x) * this.viewport.zoom,
            y: (this.selection.y - this.viewport.y) * this.viewport.zoom,
            width: this.selection.width * this.viewport.zoom,
            height: this.selection.height * this.viewport.zoom,
        };

        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(0, 123, 255, 0.8)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([4, 4]);

        this.ctx.strokeRect(screenRect.x, screenRect.y, screenRect.width, screenRect.height);

        // Animate the dashes
        this.ctx.lineDashOffset = -performance.now() / 100;
        this.ctx.strokeRect(screenRect.x, screenRect.y, screenRect.width, screenRect.height);

        this.ctx.restore();
        // Since the selection is animated, we need to keep re-rendering
        this.markDirty();
    }

    drawFloatingSelection() {
        if (!this.floatingSelection) return;

        const screenRect = {
            x: (this.floatingSelection.x - this.viewport.x) * this.viewport.zoom,
            y: (this.floatingSelection.y - this.viewport.y) * this.viewport.zoom,
            width: this.floatingSelection.width * this.viewport.zoom,
            height: this.floatingSelection.height * this.viewport.zoom,
        };
        
        this.ctx.save();
        this.ctx.globalAlpha = 0.85;
        this.ctx.drawImage(this.floatingSelection.canvas, screenRect.x, screenRect.y, screenRect.width, screenRect.height);
        
        // Draw a border around the floating selection
        this.ctx.strokeStyle = 'rgba(0, 123, 255, 0.9)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(screenRect.x, screenRect.y, screenRect.width, screenRect.height);

        this.ctx.restore();
        this.markDirty(); // Keep rendering while floating
    }

    setSelection(selectionRect) {
        this.selection = selectionRect;
        this.markDirty();
    }

    setFloatingSelection(selectionData) {
        this.floatingSelection = selectionData;
        this.markDirty();
    }

    clear() {
        // Clear in-memory chunks
        this.chunks.clear();
        
        // Clear from localStorage
        try {
            const manifestString = localStorage.getItem(this.STORAGE_KEY);
            if (manifestString) {
                const manifest = JSON.parse(manifestString);
                if (manifest.chunkKeys) {
                    for (const key of manifest.chunkKeys) {
                        localStorage.removeItem(`${this.STORAGE_KEY}-chunk-${key}`);
                    }
                }
            }
            localStorage.removeItem(this.STORAGE_KEY);
            console.log('Canvas cleared from storage.');
        } catch (e) {
            console.error('Error clearing canvas from storage:', e);
        }
        
        this.selection = null;
        this.floatingSelection = null;
        
        this.markDirty();
        this.dispatchViewportChange(); // Notify that content might have changed
    }
    
    setZoom(zoom, centerX = null, centerY = null) {
        if (centerX === null) centerX = this.viewport.width / 2;
        if (centerY === null) centerY = this.viewport.height / 2;
        
        const worldPoint = this.screenToWorld(centerX, centerY);
        // Make zoom less sensitive by adjusting the factor
        this.viewport.zoom = Math.max(0.1, Math.min(10, zoom));
        
        // Adjust centerX for calculation if mirrored, to ensure the visual point under cursor remains fixed
        let adjustedScreenXForCalculation = centerX;
        if (this.app.isMirroredX) {
            adjustedScreenXForCalculation = this.viewport.width - centerX; 
        }

        this.viewport.x = worldPoint.x - (adjustedScreenXForCalculation / this.viewport.zoom);
        this.viewport.y = worldPoint.y - (centerY / this.viewport.zoom);
        
        this.updateZoomDisplay();
        this.markDirty();
        this.dispatchViewportChange(); // Notify about zoom
    }
    
    fitToContent() {
        if (this.chunks.size === 0) {
            this.viewport.x = -this.viewport.width / 2;
            this.viewport.y = -this.viewport.height / 2;
            this.viewport.zoom = 1;
        } else {
            // Calculate bounding box of all chunks
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;
            
            for (const chunk of this.chunks.values()) {
                minX = Math.min(minX, chunk.x);
                minY = Math.min(minY, chunk.y);
                maxX = Math.max(maxX, chunk.x + this.chunkSize);
                maxY = Math.max(maxY, chunk.y + this.chunkSize);
            }
            
            const contentWidth = maxX - minX;
            const contentHeight = maxY - minY;
            const padding = 50;
            
            const zoomX = (this.viewport.width - padding * 2) / contentWidth;
            const zoomY = (this.viewport.height - padding * 2) / contentHeight;
            this.viewport.zoom = Math.min(zoomX, zoomY, 1);
            
            this.viewport.x = minX - ((this.viewport.width / this.viewport.zoom) - contentWidth) / 2;
            this.viewport.y = minY - ((this.viewport.height / this.viewport.zoom) - contentHeight) / 2;
        }
        
        this.updateZoomDisplay();
        this.markDirty();
        this.dispatchViewportChange(); // Notify about fit-to-content
    }
    
    updateZoomDisplay() {
        const zoomElement = document.getElementById('zoom-level');
        if (zoomElement) {
            zoomElement.textContent = Math.round(this.viewport.zoom * 100) + '%';
        }
    }

    getPixelsForArea(rect) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = rect.width;
        tempCanvas.height = rect.height;
        const tempCtx = tempCanvas.getContext('2d');
        const affectedChunks = new Set();

        const startChunkX = Math.floor(rect.x / this.chunkSize);
        const endChunkX = Math.floor((rect.x + rect.width) / this.chunkSize);
        const startChunkY = Math.floor(rect.y / this.chunkSize);
        const endChunkY = Math.floor((rect.y + rect.height) / this.chunkSize);

        for (let cx = startChunkX; cx <= endChunkX; cx++) {
            for (let cy = startChunkY; cy <= endChunkY; cy++) {
                const key = `${cx},${cy}`;
                if (this.chunks.has(key)) {
                    const chunk = this.chunks.get(key);
                    affectedChunks.add(chunk); // Track chunks that were part of the selection

                    // Calculate intersection of the selection rectangle (rect) and the current chunk
                    const chunkWorldX = chunk.x;
                    const chunkWorldY = chunk.y;
                    const chunkWorldWidth = this.chunkSize;
                    const chunkWorldHeight = this.chunkSize;

                    const intersectionWorldX = Math.max(rect.x, chunkWorldX);
                    const intersectionWorldY = Math.max(rect.y, chunkWorldY);
                    const intersectionWorldMaxX = Math.min(rect.x + rect.width, chunkWorldX + chunkWorldWidth);
                    const intersectionWorldMaxY = Math.min(rect.y + rect.height, chunkWorldY + chunkWorldHeight);

                    const intersectionWidth = intersectionWorldMaxX - intersectionWorldX;
                    const intersectionHeight = intersectionWorldMaxY - intersectionWorldY;

                    if (intersectionWidth <= 0 || intersectionHeight <= 0) {
                        continue; // No overlap
                    }

                    // Source rectangle on the chunk's padded canvas
                    const sx = (intersectionWorldX - chunkWorldX) + this.chunkRenderPadding;
                    const sy = (intersectionWorldY - chunkWorldY) + this.chunkRenderPadding;

                    // Destination rectangle on the temporary selection canvas
                    const dx = intersectionWorldX - rect.x;
                    const dy = intersectionWorldY - rect.y;

                    tempCtx.drawImage(
                        chunk.canvas,
                        sx, sy, intersectionWidth, intersectionHeight, // Source rectangle from chunk canvas
                        dx, dy, intersectionWidth, intersectionHeight  // Destination rectangle on tempCanvas
                    );
                }
            }
        }
        return { canvas: tempCanvas, affectedChunks };
    }

    clearRect(rect, affectedChunks) {
        for (const chunk of affectedChunks) {
             const key = this.getChunkKey(chunk.x, chunk.y);
             this.canvas.dispatchEvent(new CustomEvent('beforechunkdraw', { detail: { chunk, key } }));

            // Calculate intersection for clearing
            const chunkWorldX = chunk.x;
            const chunkWorldY = chunk.y;
            const chunkWorldWidth = this.chunkSize;
            const chunkWorldHeight = this.chunkSize;

            const intersectionWorldX = Math.max(rect.x, chunkWorldX);
            const intersectionWorldY = Math.max(rect.y, chunkWorldY);
            const intersectionWorldMaxX = Math.min(rect.x + rect.width, chunkWorldX + chunkWorldWidth);
            const intersectionWorldMaxY = Math.min(rect.y + rect.height, chunkWorldY + chunkWorldHeight);

            const intersectionWidth = intersectionWorldMaxX - intersectionWorldX;
            const intersectionHeight = intersectionWorldMaxY - intersectionWorldY;

            if (intersectionWidth <= 0 || intersectionHeight <= 0) {
                continue; // No overlap, nothing to clear
            }

            // Destination rectangle on the chunk's padded canvas where clearing occurs
            const dx = (intersectionWorldX - chunkWorldX) + this.chunkRenderPadding;
            const dy = (intersectionWorldY - chunkWorldY) + this.chunkRenderPadding;

            chunk.ctx.clearRect(dx, dy, intersectionWidth, intersectionHeight);
            chunk.dirty = true;
        }
        this.markDirty();
        this.scheduleSave();
    }
    
    pasteImageData({ canvas: sourceCanvas, x, y, width, height }) {
        const startChunkX = Math.floor(x / this.chunkSize);
        const endChunkX = Math.floor((x + width) / this.chunkSize);
        const startChunkY = Math.floor(y / this.chunkSize);
        const endChunkY = Math.floor((y + height) / this.chunkSize);
        
        for (let cx = startChunkX; cx <= endChunkX; cx++) {
            for (let cy = startChunkY; cy <= endChunkY; cy++) {
                 const worldChunkX = cx * this.chunkSize;
                 const worldChunkY = cy * this.chunkSize;
                 const chunk = this.getOrCreateChunk(worldChunkX, worldChunkY);

                 const key = `${cx},${cy}`;
                 this.canvas.dispatchEvent(new CustomEvent('beforechunkdraw', { detail: { chunk, key } }));

                 // Calculate intersection of the floating selection (defined by x, y, width, height) and the current chunk
                 const selectionWorldX = x;
                 const selectionWorldY = y;
                 const selectionWorldWidth = width;
                 const selectionWorldHeight = height;

                 const chunkWorldX = chunk.x;
                 const chunkWorldY = chunk.y;
                 const chunkWorldWidth = this.chunkSize;
                 const chunkWorldHeight = this.chunkSize;

                 const intersectionWorldX = Math.max(selectionWorldX, chunkWorldX);
                 const intersectionWorldY = Math.max(selectionWorldY, chunkWorldY);
                 const intersectionWorldMaxX = Math.min(selectionWorldX + selectionWorldWidth, chunkWorldX + chunkWorldWidth);
                 const intersectionWorldMaxY = Math.min(selectionWorldY + selectionWorldHeight, chunkWorldY + chunkWorldHeight);

                 const intersectionWidth = intersectionWorldMaxX - intersectionWorldX;
                 const intersectionHeight = intersectionWorldMaxY - intersectionWorldY;
                 
                 if (intersectionWidth <= 0 || intersectionHeight <= 0) {
                    continue; // No overlap, skip drawing on this chunk
                 }

                 // Source rectangle on the floating selection's canvas (`sourceCanvas`)
                 const sx = intersectionWorldX - selectionWorldX;
                 const sy = intersectionWorldY - selectionWorldY;

                 // Destination rectangle on the chunk's padded canvas (`chunk.ctx`)
                 const dx = (intersectionWorldX - chunkWorldX) + this.chunkRenderPadding;
                 const dy = (intersectionWorldY - chunkWorldY) + this.chunkRenderPadding;
                 
                 chunk.ctx.drawImage(
                     sourceCanvas,
                     sx, sy, intersectionWidth, intersectionHeight, // Source rectangle
                     dx, dy, intersectionWidth, intersectionHeight    // Destination rectangle
                 );
                 chunk.dirty = true;
            }
        }
        this.markDirty();
        this.scheduleSave();
    }

    setPanTool(isActive) {
        this.isPanToolActive = isActive;
    }

    setSpacePan(isActive) {
        this.isSpacePan = isActive;
    }

    pickColor(worldX, worldY) {
        const key = this.getChunkKey(worldX, worldY);
        if (!this.chunks.has(key)) {
            // Pick background color
            const bgColor = getComputedStyle(this.container).backgroundColor || '#f0f0f0';
            // console.log(`Eyedropper: Chunk ${key} does not exist. Returning background color: ${bgColor}`);
            return this.rgbaToHex(bgColor);
        }
    
        const chunk = this.chunks.get(key);
        const localX = Math.floor(worldX - chunk.x) + this.chunkRenderPadding;
        const localY = Math.floor(worldY - chunk.y) + this.chunkRenderPadding;
    
        try {
            // Ensure localX and localY are within chunk bounds adjusted for padding
            const clampedLocalX = Math.max(0, Math.min(localX, chunk.canvas.width - 1));
            const clampedLocalY = Math.max(0, Math.min(localY, chunk.canvas.height - 1));

            const imageData = chunk.ctx.getImageData(clampedLocalX, clampedLocalY, 1, 1).data;
            // console.log(`Eyedropper: Picked pixel at world (${worldX}, ${worldY}) / local (${clampedLocalX}, ${clampedLocalY}) in chunk ${key}. RGBA: (${imageData[0]}, ${imageData[1]}, ${imageData[2]}, ${imageData[3]})`);

            if (imageData[3] === 0) { // Transparent, return background color
                 const bgColor = getComputedStyle(this.container).backgroundColor || '#f0f0f0';
                //  console.log(`Eyedropper: Pixel is transparent. Returning background color: ${bgColor}`);
                 return this.rgbaToHex(bgColor);
            }
            const pickedHex = `#${('0' + imageData[0].toString(16)).slice(-2)}${('0' + imageData[1].toString(16)).slice(-2)}${('0' + imageData[2].toString(16)).slice(-2)}`;
            // console.log(`Eyedropper: Pixel is opaque. Returning color: ${pickedHex}`);
            return pickedHex;
        } catch (e) {
            console.error("Could not pick color:", e);
            // This can happen due to security restrictions if canvas is tainted.
            // Or if coordinates are out of bounds, though we try to prevent that.
            return null; 
        }
    }

    rgbaToHex(rgba) {
        // Handle cases where hex might be undefined or invalid
        if (!rgba || typeof rgba !== 'string') {
            return '#2c3e50'; // Default color
        }
        if (rgba.startsWith('#')) return rgba;
        const parts = rgba.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
        if (!parts) return '#000000';
        
        const r = parseInt(parts[1]).toString(16).padStart(2, '0');
        const g = parseInt(parts[2]).toString(16).padStart(2, '0');
        const b = parseInt(parts[3]).toString(16).padStart(2, '0');
        
        return `#${r}${g}${b}`;
    }

    scheduleSave() {
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
        }
        this.saveDebounceTimer = setTimeout(() => this.saveToStorage(), 5000); // Save 5 seconds after last change
    }

    async saveToStorage() {
        try {
            const dirtyChunks = [];
            for (const chunk of this.chunks.values()) {
                if (chunk.dirty) {
                    dirtyChunks.push(chunk);
                }
            }

            // If no chunks are dirty and viewport hasn't changed, no need to save anything.
            // If viewport has changed, manifest will be updated below.
            if (dirtyChunks.length === 0) {
                const manifestString = localStorage.getItem(this.STORAGE_KEY);
                if (manifestString) {
                   const manifest = JSON.parse(manifestString);
                   // Only update manifest if viewport changed, otherwise skip writing to localStorage
                   if (JSON.stringify(manifest.viewport) !== JSON.stringify(this.viewport)) {
                       manifest.viewport = this.viewport;
                       localStorage.setItem(this.STORAGE_KEY, JSON.stringify(manifest));
                       console.log('Autosave: Viewport updated in storage.');
                   }
                }
                return;
            }

            console.log(`Saving ${dirtyChunks.length} dirty chunks...`);
            
            // Get existing manifest to know all chunk keys
            let manifest = { viewport: this.viewport, chunkKeys: [] };
            const manifestString = localStorage.getItem(this.STORAGE_KEY);
            if (manifestString) {
                manifest = JSON.parse(manifestString);
            }
            const chunkKeySet = new Set(manifest.chunkKeys);

            let quotaExceeded = false;
            let savedChunkCount = 0;

            for (const chunk of dirtyChunks) {
                const key = `${Math.floor(chunk.x / this.chunkSize)},${Math.floor(chunk.y / this.chunkSize)}`;
                const chunkStorageKey = `${this.STORAGE_KEY}-chunk-${key}`;
                
                // Check if the chunk actually contains any non-transparent pixels, using the *entire* chunk canvas
                const imageData = chunk.ctx.getImageData(0, 0, chunk.canvas.width, chunk.canvas.height).data;
                const hasContent = imageData.some((val, i) => i % 4 === 3 && val > 0);
                
                if (hasContent) {
                    try {
                        // Using image/webp for smaller file size, quality 0.8
                        const dataURL = chunk.canvas.toDataURL('image/webp', 0.8);
                        localStorage.setItem(chunkStorageKey, dataURL);
                        chunkKeySet.add(key);
                        chunk.dirty = false; // Mark as saved
                        savedChunkCount++;
                    } catch (e) {
                         if (e.name === 'QuotaExceededError') {
                            console.error(`Storage quota exceeded while trying to save chunk ${key}. This chunk will not be saved in this session.`);
                            quotaExceeded = true;
                            // Do NOT return here, attempt to save other chunks if possible
                        } else {
                            console.error(`Error saving chunk ${key}:`, e);
                        }
                        // chunk.dirty remains true if save failed
                    }
                } else {
                    // If a chunk is dirty but has no content (completely transparent), remove it from storage and map
                    localStorage.removeItem(chunkStorageKey);
                    chunkKeySet.delete(key);
                    chunk.dirty = false;
                    this.chunks.delete(key); 
                }
            }

            // Update and save the manifest if any chunk operation occurred or viewport changed
            // Ensure manifest is saved even if some chunk writes failed due to quota,
            // so existing data (and viewport) is preserved.
            manifest.viewport = this.viewport;
            manifest.chunkKeys = Array.from(chunkKeySet);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(manifest));
            
            console.log(`Autosave complete. Saved ${savedChunkCount} chunks. Total chunks in manifest: ${manifest.chunkKeys.length}.`);

            if (quotaExceeded) {
                alert("Warning: Local storage full. Some changes may not have been saved. Consider clearing canvas data to free space.");
            }

        } catch (e) {
            console.error('An unhandled error occurred during the save process:', e);
            alert("An unexpected error occurred while saving. Your changes might not be saved.");
        }
    }

    loadFromStorage() {
        try {
            const manifestString = localStorage.getItem(this.STORAGE_KEY);
            if (!manifestString) {
                this.fitToContent(); // Default view if no saved data
                this.dispatchViewportChange();
                return; // Exit early if no manifest
            }

            const manifest = JSON.parse(manifestString);
            
            // Load viewport
            if (manifest.viewport) {
                this.viewport.x = manifest.viewport.x;
                this.viewport.y = manifest.viewport.y;
                this.viewport.zoom = manifest.viewport.zoom;
                this.updateZoomDisplay();
            } else {
                // If no viewport saved, fit to content or default
                this.fitToContent();
            }

            // Load chunks from individual storage items
            if (manifest.chunkKeys && manifest.chunkKeys.length > 0) {
                let loadedCount = 0;
                // Initialize chunkKeySet here so it's available in the img.onerror handler
                const chunkKeySet = new Set(manifest.chunkKeys);

                // Use a promise-based approach to know when all chunks are loaded
                const loadPromises = manifest.chunkKeys.map(key => {
                    return new Promise((resolve) => { // Always resolve to avoid Promise.allSettled being rejected
                        const chunkDataURL = localStorage.getItem(`${this.STORAGE_KEY}-chunk-${key}`);
                        if (!chunkDataURL) {
                            console.warn(`Chunk data not found for key: ${key}. It might have been cleared manually or corrupted.`);
                            chunkKeySet.delete(key); // Also delete from set if not found
                            resolve(); 
                            return;
                        }

                        const [chunkX, chunkY] = key.split(',').map(Number);
                        const worldX = chunkX * this.chunkSize;
                        const worldY = chunkY * this.chunkSize;
                        
                        const chunk = this.getOrCreateChunk(worldX, worldY);
                        
                        const img = new Image();
                        img.onload = () => {
                            chunk.ctx.drawImage(img, 0, 0);
                            chunk.dirty = false; // Mark as clean after loading
                            loadedCount++;
                            resolve();
                        };
                        img.onerror = () => {
                            console.error("Failed to load chunk image from dataURL for key:", key, "Removing problematic chunk from storage.");
                            localStorage.removeItem(`${this.STORAGE_KEY}-chunk-${key}`); // Remove corrupted data
                            chunkKeySet.delete(key); // Also remove from the set for manifest update
                            resolve(); // Resolve to allow other chunks to load
                        };
                        img.src = chunkDataURL;
                    });
                });

                Promise.allSettled(loadPromises).then(() => {
                    console.log(`Canvas loaded from storage. ${loadedCount} chunks retrieved.`);
                    // After loading, update manifest to reflect any removed corrupted chunks
                    manifest.chunkKeys = Array.from(chunkKeySet);
                    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(manifest));

                    this.markDirty(); // Ensure full redraw after all chunks are loaded
                    this.dispatchViewportChange(); // Notify that content might have changed
                });
            } else {
                // If manifest has no chunk keys, ensure canvas is empty and default view
                this.fitToContent();
                this.markDirty();
                this.dispatchViewportChange();
            }
            
        } catch (e) {
            console.error('Failed to load canvas from storage (corrupted manifest or other error):', e);
            // If manifest itself is corrupted, clear everything canvas-related to prevent future errors
            alert("Error loading saved canvas data. It might be corrupted. Starting with a fresh canvas.");
            this.clear(); // This will clear all canvas related local storage items too.
        }
    }
}