class AtelierApp {
    constructor() {
        this.canvasEngine = null;
        this.brushEngine = null;
        this.historyManager = null;
        this.colorPicker = null;
        this.imageManager = null;
        this.imageViewerInstances = new Map(); // Map<instanceId, ImageViewerPanel>
        this.nextZIndex = 900; // Starting z-index for all draggable panels

        this.brushes = [];
        this.isLoading = true;
        this.isSpacePanActive = false;
        this.isZoomModeActive = false;
        this.zoomStartPoint = null;
        
        this.isSelecting = false;
        this.selection = null; // {x, y, width, height} in world coords
        this.selectionStartPoint = null;
        
        this.isTransformingSelection = false;
        this.floatingSelectionData = null; // { canvas, x, y, width, height }
        this.transformStartPoint = null; // {worldX, worldY, screenX, screenY}
        this.selectionOriginalPosition = null;

        this.isAltEyedropperActive = false;
        this.previousToolState = null;

        this.isMirroredX = false; // New state for mirroring
        
        // New property to store user-adjusted brush settings per brush ID
        // This acts as a "recent memory" for size and opacity for each brush,
        // overriding its default properties for the current session.
        // Format: { brushId: { size: number, opacity: number } }
        this.brushOverrides = {}; 
        
        this.init();
    }
    
    async init() {
        try {
            this.showLoading();
            
            // Initialize canvas engine
            const container = document.getElementById('canvas-container');
            this.canvasEngine = new InfiniteCanvas(container, this); // Pass app reference

            // Initialize History Manager
            this.historyManager = new HistoryManager(this.canvasEngine, this);
            
            // Wait for canvas to be ready
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Initialize brush engine
            this.brushEngine = new BrushEngine(this.canvasEngine, this);

            // Initialize Color Picker with its detached panel ID
            this.colorPicker = new ColorPicker('color-panel', this);

            // Initialize Image Manager
            this.imageManager = new ImageManagerPanel('image-manager-panel', this);
            
            // Setup UI event listeners
            this.setupUI();

            // Load custom brushes
            this.loadBrushes();
            
            // Set initial color
            this.brushEngine.setColor(this.colorPicker.color);
            
            // Load previously opened Image Viewer instances
            await this.loadImageViewerInstances(); // Wait for viewers to load
            
            // Select default tool/brush after everything is loaded
            if (this.brushes.length > 0) {
                this.selectBrush(this.brushes[0].id); // Select the first custom brush
            } else {
                this.selectTool('pan'); // Fallback if no custom brushes
            }

            this.hideLoading();
        } catch (error) {
            console.error('Failed to initialize Atelier:', error);
            this.hideLoading();
        }
    }
    
    setupUI() {
        // Tool selection (for pan, eyedropper, etc.)
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = btn.dataset.tool;
                this.selectTool(tool);
            });
        });
        
        // Brush size
        const brushSizeInput = document.getElementById('brush-size');
        const sizeDisplay = document.getElementById('size-display');
        
        brushSizeInput.addEventListener('input', (e) => {
            const size = parseInt(e.target.value);
            this.brushEngine.setBrushSize(size);
            sizeDisplay.textContent = size;
        });
        
        // Opacity
        const opacityInput = document.getElementById('opacity');
        const opacityDisplay = document.getElementById('opacity-display');
        
        opacityInput.addEventListener('input', (e) => {
            const opacity = parseInt(e.target.value);
            this.brushEngine.setOpacity(opacity);
            opacityDisplay.textContent = opacity + '%';
        });
        
        // Listen for color picked by eyedropper
        // This listener is now general for any component that dispatches 'colorpicked'
        document.addEventListener('colorpicked', (e) => {
            const { color } = e.detail;
            this.setCurrentColor(color);
            
            // If the eyedropper was a one-off click (not hold-alt), switch back.
            // This logic ensures that if you pick a color with 'I' tool, it goes back to brush.
            // If you pick with Alt, it stays eyedropper until Alt is released.
            if (!this.isAltEyedropperActive && this.brushEngine.currentTool === 'eyedropper') {
                if (this.previousToolState && this.previousToolState.brush) {
                    this.selectBrush(this.previousToolState.brush.id);
                } else {
                    const firstBrush = this.brushes[0];
                    if (firstBrush) this.selectBrush(firstBrush.id);
                }
            }
        });

        // Listen for color changes from the color picker component
        document.addEventListener('colorchange', (e) => {
            this.setCurrentColor(e.detail.color, false); // Don't re-update the picker
        });
        
        // Clear button - now also clears storage
        document.getElementById('clear-btn').addEventListener('click', () => {
            if (confirm('Clear the entire canvas and all its saved data? This action cannot be undone.')) {
                this.canvasEngine.clear();
                this.historyManager.clear();
            }
        });

        // Manual save button
        document.getElementById('manual-save-btn').addEventListener('click', () => {
            this.canvasEngine.saveToStorage();
            console.log('Manually saved canvas');
        });

        // Save Button -> now opens modal
        document.getElementById('save-btn').addEventListener('click', () => this.showSaveModal());
        
        // Fullscreen button
        document.getElementById('fullscreen-btn').addEventListener('click', () => {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                document.documentElement.requestFullscreen();
            }
        });
        
        // Zoom controls
        document.getElementById('zoom-in').addEventListener('click', () => {
            this.canvasEngine.setZoom(this.canvasEngine.viewport.zoom * 1.2);
        });
        
        document.getElementById('zoom-out').addEventListener('click', () => {
            this.canvasEngine.setZoom(this.canvasEngine.viewport.zoom * 0.8);
        });
        
        document.getElementById('zoom-fit').addEventListener('click', () => {
            this.canvasEngine.fitToContent();
        });
        
        // Undo/Redo Buttons
        document.getElementById('undo-btn').addEventListener('click', () => this.historyManager.undo());
        document.getElementById('redo-btn').addEventListener('click', () => this.historyManager.redo());

        // Mirror View Button
        document.getElementById('mirror-view-btn').addEventListener('click', () => {
            this.toggleMirrorView();
        });

        // Image Manager Button
        document.getElementById('image-manager-btn').addEventListener('click', () => {
            this.imageManager.show();
        });

        // Hold Alt for Eyedropper
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Alt' && !this.isAltEyedropperActive) {
                if (document.activeElement.tagName === 'INPUT') return;
                e.preventDefault();
                this.isAltEyedropperActive = true;
                
                this.previousToolState = {
                    tool: this.brushEngine.currentTool,
                    brush: this.brushEngine.activeBrush
                };
                
                // If already on eyedropper, do nothing
                if (this.previousToolState.tool !== 'eyedropper') {
                    this.selectTool('eyedropper');
                }

                // Attach a temporary mousemove listener to handle color picking from various sources
                this._altMouseMoveHandler = (mouseEvent) => {
                    let pickedColor = null;

                    // Check if mouse is over any Image Viewer Panel first
                    for (const [instanceId, viewer] of this.imageViewerInstances.entries()) {
                        if (!viewer.panel.classList.contains('hidden') && viewer.currentImage) {
                            const viewerPanelRect = viewer.panel.getBoundingClientRect();
                            if (mouseEvent.clientX >= viewerPanelRect.left &&
                                mouseEvent.clientX <= viewerPanelRect.right &&
                                mouseEvent.clientY >= viewerPanelRect.top &&
                                mouseEvent.clientY <= viewerPanelRect.bottom) {

                                // Mouse is over this specific viewer panel
                                // Calculate local coordinates within the content area of this viewer
                                const panelPaddingLeft = parseFloat(getComputedStyle(viewer.panel).paddingLeft);
                                const panelPaddingTop = parseFloat(getComputedStyle(viewer.panel).paddingTop);
                                const headerHeight = viewer.dragHandle.offsetHeight; // Assuming dragHandle is the header

                                const localX = mouseEvent.clientX - viewerPanelRect.left - panelPaddingLeft;
                                const localY = mouseEvent.clientY - viewerPanelRect.top - panelPaddingTop - headerHeight;

                                pickedColor = viewer.pickColor(localX, localY);
                                if (pickedColor) {
                                    // Dispatch and return, as we've found a color
                                    const event = new CustomEvent('colorpicked', { detail: { color: pickedColor }, bubbles: true });
                                    document.dispatchEvent(event);
                                    return;
                                }
                            }
                        }
                    }

                    // If no color picked from any viewer, then try main canvas
                    const canvasRect = this.canvasEngine.canvas.getBoundingClientRect();
                    if (mouseEvent.clientX >= canvasRect.left &&
                        mouseEvent.clientX <= canvasRect.right &&
                        mouseEvent.clientY >= canvasRect.top &&
                        mouseEvent.clientY <= canvasRect.bottom) {
                        
                        const sx = mouseEvent.clientX - canvasRect.left;
                        const sy = mouseEvent.clientY - canvasRect.top;
                        const world = this.canvasEngine.screenToWorld(sx, sy);
                        pickedColor = this.canvasEngine.pickColor(world.x, world.y);
                    }

                    if (pickedColor) {
                        const event = new CustomEvent('colorpicked', { detail: { color: pickedColor }, bubbles: true });
                        document.dispatchEvent(event);
                    }
                };
                document.addEventListener('mousemove', this._altMouseMoveHandler);
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'Alt') {
                if (!this.isAltEyedropperActive) return;
                e.preventDefault();
                this.isAltEyedropperActive = false;

                // Remove the temporary mousemove listener used by Alt-eyedropper
                if (this._altMouseMoveHandler) {
                    document.removeEventListener('mousemove', this._altMouseMoveHandler);
                    this._altMouseMoveHandler = null;
                }

                if (this.previousToolState) {
                    if (this.previousToolState.brush) {
                        this.selectBrush(this.previousToolState.brush.id);
                    } else if (this.previousToolState.tool) {
                        this.selectTool(this.previousToolState.tool);
                    }
                    this.previousToolState = null;
                }
            }
        });

        // Zoom with Z key
        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'z' && !this.isZoomModeActive) {
                e.preventDefault(); // Prevent default browser behavior
                this.isZoomModeActive = true;
                this.canvasEngine.canvas.style.cursor = 'zoom-in';
                // Disable brush engine while in zoom mode
                if (this.brushEngine) {
                    this.brushEngine.isZoomModeActive = true;
                }
                this.updateCursor();
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key.toLowerCase() === 'z') {
                e.preventDefault();
                this.isZoomModeActive = false;
                this.zoomStartPoint = null;
                this.canvasEngine.canvas.style.cursor = 'zoom-in';
                // Re-enable brush engine
                if (this.brushEngine) {
                    this.brushEngine.isZoomModeActive = false;
                }
                this.updateCursor();
            }
        });

        // Zoom drag functionality - make less sensitive
        this.canvasEngine.canvas.addEventListener('mousedown', (e) => {
            if (this.isAltEyedropperActive) {
                // Prevent brush engine's startStroke when Alt is held.
                // Eyedropper logic is handled within the brush engine on mousedown.
                return;
            }
            if (this.isZoomModeActive && e.button === 0) {
                e.preventDefault();
                this.zoomStartPoint = { x: e.clientX, y: e.clientY };
                this.canvasEngine.canvas.style.cursor = 'zoom-in';
            }
            if (this.brushEngine.currentTool === 'select' && e.button === 0) {
                const rect = this.canvasEngine.canvas.getBoundingClientRect();
                const screenX = e.clientX - rect.left;
                const screenY = e.clientY - rect.top;
                const worldPos = this.canvasEngine.screenToWorld(screenX, screenY);
                
                // If there's an existing selection and the user clicks inside it, start transforming.
                if (this.selection && this.pointInRect(worldPos, this.selection)) {
                    this.isTransformingSelection = true;
                    this.transformStartPoint = { ...worldPos, screenX: e.clientX, screenY: e.clientY };
                    this.selectionOriginalPosition = { ...this.selection };

                    if (!this.floatingSelectionData) {
                        this.cutSelection();
                    }
                } else {
                    // Otherwise, start drawing a new selection.
                    this.isSelecting = true;
                    this.selectionStartPoint = worldPos;
                    this.selection = null; // Reset previous selection
                    this.floatingSelectionData = null; // Clear any floating data
                    this.canvasEngine.setSelection(null);
                    this.canvasEngine.setFloatingSelection(null);
                }
            }
        });

        this.canvasEngine.canvas.addEventListener('mousemove', (e) => {
            if (this.isSelecting) {
                const rect = this.canvasEngine.canvas.getBoundingClientRect();
                const screenX = e.clientX - rect.left;
                const screenY = e.clientY - rect.top;
                const currentPoint = this.canvasEngine.screenToWorld(screenX, screenY);

                const x = Math.min(this.selectionStartPoint.x, currentPoint.x);
                const y = Math.min(this.selectionStartPoint.y, currentPoint.y);
                const width = Math.abs(this.selectionStartPoint.x - currentPoint.x);
                const height = Math.abs(this.selectionStartPoint.y - currentPoint.y);

                this.selection = { x, y, width, height };
                this.canvasEngine.setSelection(this.selection);
            }

            if (this.isTransformingSelection && this.floatingSelectionData) {
                const rect = this.canvasEngine.canvas.getBoundingClientRect();
                const screenX = e.clientX - rect.left;
                const screenY = e.clientY - rect.top;
                const worldPos = this.canvasEngine.screenToWorld(screenX, screenY);
                
                // Calculate delta from the original transform start point
                const deltaX = worldPos.x - this.transformStartPoint.x;
                const deltaY = worldPos.y - this.transformStartPoint.y;
                
                // Apply delta to the original selection position
                this.floatingSelectionData.x = this.selectionOriginalPosition.x + deltaX;
                this.floatingSelectionData.y = this.selectionOriginalPosition.y + deltaY;
                
                this.canvasEngine.setFloatingSelection(this.floatingSelectionData);
            }

            if (this.isZoomModeActive && this.zoomStartPoint && e.buttons === 1) {
                e.preventDefault();
                
                const deltaY = e.clientY - this.zoomStartPoint.y;
                const sensitivity = 0.005; // Reduced sensitivity for smoother zoom
                
                if (Math.abs(deltaY) > 5) {
                    const zoomFactor = 1 + (Math.abs(deltaY) * sensitivity);
                    const newZoom = deltaY < 0 
                        ? this.canvasEngine.viewport.zoom * zoomFactor 
                        : this.canvasEngine.viewport.zoom / zoomFactor;
                    
                    const rect = this.canvasEngine.canvas.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const mouseY = e.clientY - rect.top;
                    
                    const worldPoint = this.canvasEngine.screenToWorld(mouseX, mouseY);
                    
                    const clampedZoom = Math.max(0.1, Math.min(10, newZoom));
                    
                    // Adjust mouseX for calculation if mirrored, for consistency with worldPoint
                    let transformedMouseX = mouseX;
                    if (this.canvasEngine.app.isMirroredX) {
                        transformedMouseX = this.canvasEngine.viewport.width - mouseX;
                    }

                    this.canvasEngine.viewport.x = worldPoint.x - (transformedMouseX / clampedZoom);
                    this.canvasEngine.viewport.y = worldPoint.y - (mouseY / clampedZoom);
                    this.canvasEngine.viewport.zoom = clampedZoom;
                    
                    this.canvasEngine.updateZoomDisplay();
                    this.canvasEngine.markDirty();
                    
                    this.canvasEngine.canvas.style.cursor = deltaY < 0 ? 'zoom-in' : 'zoom-out';
                }
            }
        });

        this.canvasEngine.canvas.addEventListener('mouseup', (e) => {
            if (this.isZoomModeActive && e.button === 0) {
                this.zoomStartPoint = null;
                this.canvasEngine.canvas.style.cursor = 'zoom-in';
            }
            if (this.isSelecting) {
                this.isSelecting = false;
                this.selectionStartPoint = null;
                // If a tiny selection was made, discard it.
                if (this.selection && (this.selection.width < 5 || this.selection.height < 5)) {
                    this.selection = null;
                    this.canvasEngine.setSelection(null);
                }
                 // The selection is now final until a new one is drawn
            }
            if (this.isTransformingSelection) {
                this.pasteSelection();
                this.isTransformingSelection = false;
                this.transformStartPoint = null;
                this.selectionOriginalPosition = null;
                // Keep the selection active at the new location
                if (this.floatingSelectionData) {
                    this.selection = { ...this.floatingSelectionData };
                    this.canvasEngine.setSelection(this.selection);
                }
                this.floatingSelectionData = null;
                this.canvasEngine.setFloatingSelection(null);
            }
        });

        // Pan with Spacebar
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !this.isSpacePanActive) {
                if (document.activeElement.tagName === 'INPUT') return;
                e.preventDefault();
                this.isSpacePanActive = true;
                this.canvasEngine.setSpacePan(true);
                this.updateCursor();
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.isSpacePanActive = false;
                this.canvasEngine.setSpacePan(false);
                this.updateCursor();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // This event listener should not interfere with the Alt keydown handler above.
            // Alt key state is checked via e.altKey for combinations.
            if (e.key === 'Alt') return;

            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'z':
                        e.preventDefault();
                        this.historyManager.undo();
                        break;
                    case 'y':
                    case 'Z':
                         e.preventDefault();
                         this.historyManager.redo();
                         break;
                    case '=':
                    case '+':
                        e.preventDefault();
                        this.canvasEngine.setZoom(this.canvasEngine.viewport.zoom * 1.2);
                        break;
                    case '-':
                        e.preventDefault();
                        this.canvasEngine.setZoom(this.canvasEngine.viewport.zoom * 0.8);
                        break;
                    case '0':
                        e.preventDefault();
                        this.canvasEngine.setZoom(1);
                        break;
                }
            } else if (document.activeElement.tagName !== 'INPUT') {
                switch (e.key.toLowerCase()) {
                    case '1':
                    case '2':
                    case '3':
                    case '4':
                    case '5':
                        const brushIndex = parseInt(e.key) - 1; // '1' -> index 0
                        if (this.brushes[brushIndex]) {
                            this.selectBrush(this.brushes[brushIndex].id);
                        }
                        break;
                    case 'w':
                        this.adjustBrushSize(-5);
                        break;
                    case 'e':
                        this.adjustBrushSize(5);
                        break;
                    case 'q':
                        this.adjustOpacity(-5);
                        break;
                    case 'a':
                        this.adjustOpacity(5);
                        break;
                    case 'h':
                        this.selectTool('pan');
                        break;
                    case 'i':
                        this.selectTool('eyedropper');
                        break;
                    case 'm':
                        this.selectTool('select');
                        break;
                    case 'v':
                        e.preventDefault();
                        // Switch to brush tool and select first brush if none active
                        if (this.brushes.length > 0) {
                            this.selectBrush(this.brushes[0].id);
                        }
                        break;
                    case 'g':
                        e.preventDefault();
                        this.selectTool('select');
                        break;
                    case 'b': // Mirror view hotkey
                        e.preventDefault();
                        this.toggleMirrorView();
                        break;
                }
            }
        });
    }
    
    setCurrentColor(color, updatePicker = true) {
        if (!color) return;
        
        // Tell the color picker to update its state and UI
        if (updatePicker) {
            this.colorPicker.setColor(color);
        }

        // Tell the brush engine to use the new color
        this.brushEngine.setColor(color);
    }
    
    selectTool(tool) {
        // Deactivate all tool-buttons first
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        // Deactivate all brush-buttons
        document.querySelectorAll('.brush-btn').forEach(btn => btn.classList.remove('active'));

        // Activate the selected tool button if it exists
        const selectedToolBtn = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
        if (selectedToolBtn) {
            selectedToolBtn.classList.add('active');
        }

        // If switching away from select tool, commit any floating selection
        if (this.brushEngine.currentTool === 'select' && tool !== 'select') {
            if (this.floatingSelectionData) {
                this.pasteSelection();
            }
            this.selection = null;
            this.floatingSelectionData = null;
            this.canvasEngine.setSelection(null);
            this.canvasEngine.setFloatingSelection(null);
        }
        
        // Set the tool in brushEngine
        this.brushEngine.setTool(tool);

        // Pan tool also affects canvasEngine's pan state
        this.canvasEngine.setPanTool(tool === 'pan');

        // If not a drawing tool, deactivate active brush
        if (tool === 'pan' || tool === 'eyedropper' || tool === 'select') {
            this.brushEngine.setBrush(null);
        }
        
        this.updateCursor();
    }
    
    adjustBrushSize(delta) {
        const currentSize = this.brushEngine.brushSize;
        const newSize = Math.max(1, Math.min(200, currentSize + delta)); // Max 200 for consistency with editor

        this.brushEngine.setBrushSize(newSize);
        document.getElementById('brush-size').value = newSize;
        document.getElementById('size-display').textContent = newSize;

        // Store this user-adjusted size as an override for the currently active brush
        if (this.brushEngine.activeBrush) {
            if (!this.brushOverrides[this.brushEngine.activeBrush.id]) {
                this.brushOverrides[this.brushEngine.activeBrush.id] = {};
            }
            this.brushOverrides[this.brushEngine.activeBrush.id].size = newSize;
        }
    }

    adjustOpacity(delta) {
        const currentOpacity = this.brushEngine.opacity * 100; // Convert 0-1 to 0-100
        const newOpacity = Math.max(0, Math.min(100, currentOpacity + delta));

        this.brushEngine.setOpacity(newOpacity);
        document.getElementById('opacity').value = newOpacity;
        document.getElementById('opacity-display').textContent = newOpacity + '%';

        // Store this user-adjusted opacity as an override for the currently active brush
        if (this.brushEngine.activeBrush) {
            if (!this.brushOverrides[this.brushEngine.activeBrush.id]) {
                this.brushOverrides[this.brushEngine.activeBrush.id] = {};
            }
            this.brushOverrides[this.brushEngine.activeBrush.id].opacity = newOpacity;
        }
    }

    toggleMirrorView() {
        this.isMirroredX = !this.isMirroredX;
        document.getElementById('mirror-view-btn').classList.toggle('active', this.isMirroredX);
        this.canvasEngine.markDirty(); // Request a repaint to apply the new mirror state
        this.updateCursor(); // Update cursor if needed (though not strictly for mirroring)

        // Ensure all pinned image viewers update their position
        for (const [instanceId, viewer] of this.imageViewerInstances.entries()) {
            if (viewer.isPinned) {
                viewer.updatePinnedPosition(this.canvasEngine.viewport);
            }
        }
    }
    
    loadBrushes() {
        try {
            const storedBrushes = localStorage.getItem('atelier-brushes');
            if (storedBrushes) {
                this.brushes = JSON.parse(storedBrushes);
                // Ensure all loaded brushes have the new smudgeStrength property
                this.brushes.forEach(brush => {
                    if (brush.smudgeStrength === undefined) {
                        brush.smudgeStrength = 0;
                    }
                });
            } else {
                 // Add default brushes if none exist
                this.brushes = [
                    { id: Date.now(), name: 'Simple Round', size: 20, opacity: 100, blending: 'source-over', hardness: 80, pressureSize: 50, pressureOpacity: 0, smoothing: 20, tip: 'round', smudgeStrength: 0 },
                    { id: Date.now() + 1, name: 'Soft Airbrush', size: 50, opacity: 60, blending: 'source-over', hardness: 10, pressureSize: 80, pressureOpacity: 70, smoothing: 30, tip: 'round', smudgeStrength: 0 },
                    { id: Date.now() + 2, name: 'Basic Eraser', size: 40, opacity: 100, blending: 'destination-out', hardness: 90, pressureSize: 60, pressureOpacity: 0, smoothing: 10, tip: 'round', smudgeStrength: 0 },
                ];
                localStorage.setItem('atelier-brushes', JSON.stringify(this.brushes));
            }
        } catch (e) {
            console.error("Failed to load brushes", e);
            this.brushes = [];
        }
        this.renderBrushSelector();
        // Initial brush selection is now handled in init()
    }

    renderBrushSelector() {
        const container = document.getElementById('brush-selector');
        container.innerHTML = '';
        this.brushes.forEach(brush => {
            const btn = document.createElement('button');
            btn.className = 'brush-btn';
            btn.dataset.id = brush.id;
            btn.title = brush.name;
            btn.addEventListener('click', () => this.selectBrush(brush.id));
            
            const canvas = document.createElement('canvas');
            canvas.className = 'brush-preview-canvas';
            canvas.width = 40;
            canvas.height = 40;
            this.drawBrushPreview(canvas, brush);

            btn.appendChild(canvas);
            container.appendChild(btn);
        });
    }
    
    drawBrushPreview(canvas, brush) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const size = Math.min(canvas.width * 0.8, brush.size);
        const hardness = brush.hardness / 100;
        const opacity = brush.opacity / 100;
        const x = canvas.width / 2;
        const y = canvas.height / 2;
        const tip = brush.tip || 'round';

        // Use a default preview color, as the actual color comes from the color picker.
        // For smudge, we don't simulate actual canvas picking in the small preview.
        const isEraser = brush.blending === 'destination-out';
        
        if (tip === 'square') {
             ctx.globalAlpha = opacity;
             ctx.fillStyle = isEraser ? 'rgba(255,255,255,0.8)' : 'rgba(44, 62, 80, 1)'; // Show eraser as semi-transparent white
             ctx.fillRect(x - size/2, y - size/2, size, size);
             ctx.globalAlpha = 1;
        } else { // Round tip
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, size / 2);
            const previewColor = isEraser ? `rgba(255, 255, 255, ${opacity * 0.8})` : `rgba(44, 62, 80, ${opacity})`;
            const transparentColor = isEraser ? `rgba(255, 255, 255, 0)` : `rgba(44, 62, 80, 0)`;

            gradient.addColorStop(0, previewColor);
            gradient.addColorStop(Math.max(0, hardness - 0.01), previewColor);
            gradient.addColorStop(1, transparentColor);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    selectBrush(brushId) {
        const brush = this.brushes.find(b => b.id === brushId);
        if (!brush) return;

        // Set the active brush for the engine
        this.brushEngine.setBrush(brush);
        // Set the current tool to 'brush' to enable drawing mode
        this.brushEngine.setTool('brush');

        // Determine effective size and opacity for the UI and brush engine:
        // Prioritize user overrides if they exist for this brush's ID.
        // If no override, use the brush's default stored property.
        const override = this.brushOverrides[brush.id];
        const effectiveSize = override && override.size !== undefined ? override.size : brush.size;
        const effectiveOpacity = override && override.opacity !== undefined ? override.opacity : brush.opacity;

        // Sync main toolbar UI and brush engine with the selected brush's effective values
        this.brushEngine.setBrushSize(effectiveSize);
        document.getElementById('brush-size').value = effectiveSize;
        document.getElementById('size-display').textContent = effectiveSize;
        
        this.brushEngine.setOpacity(effectiveOpacity);
        document.getElementById('opacity').value = effectiveOpacity;
        document.getElementById('opacity-display').textContent = effectiveOpacity + '%';

        // Update active classes for UI buttons
        document.querySelectorAll('.brush-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.id == brushId);
        });
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', this.brushEngine.currentTool === btn.dataset.tool);
        });
        
        this.updateCursor();
    }
    
    updateHistoryButtons() {
        document.getElementById('undo-btn').disabled = !this.historyManager.canUndo();
        document.getElementById('redo-btn').disabled = !this.historyManager.canRedo();
    }

    showSaveModal() {
        const modal = document.getElementById('save-modal');
        modal.classList.remove('hidden');

        const widthInput = document.getElementById('export-width');
        const heightInput = document.getElementById('export-height');
        const ratioCheckbox = document.getElementById('keep-aspect-ratio');
        const fullCanvasRadio = document.querySelector('input[name="export-source"][value="full"]');
        const selectionRadio = document.querySelector('input[name="export-source"][value="selection"]');

        let sourceRect;
        let aspectRatio;

        const updateInputs = () => {
            const source = document.querySelector('input[name="export-source"]:checked').value;
            if (source === 'selection' && this.selection) {
                sourceRect = this.selection;
            } else {
                const { minX, minY, width, height } = this.getFullCanvasBounds();
                sourceRect = { x: minX, y: minY, width, height };
            }
            aspectRatio = sourceRect.width / sourceRect.height;
            widthInput.value = Math.round(sourceRect.width);
            heightInput.value = Math.round(sourceRect.height);
        };

        if (this.selection && this.selection.width > 0 && this.selection.height > 0) {
            selectionRadio.disabled = false;
            selectionRadio.checked = true;
        } else {
            selectionRadio.disabled = true;
            fullCanvasRadio.checked = true;
        }
        updateInputs();

        const onWidthChange = () => {
            if (ratioCheckbox.checked) {
                heightInput.value = Math.round(widthInput.value / aspectRatio);
            }
        };
        const onHeightChange = () => {
            if (ratioCheckbox.checked) {
                widthInput.value = Math.round(heightInput.value * aspectRatio);
            }
        };
        
        widthInput.addEventListener('input', onWidthChange);
        heightInput.addEventListener('input', onHeightChange);
        document.querySelectorAll('input[name="export-source"]').forEach(radio => {
            radio.addEventListener('change', updateInputs);
        });

        const hideAndCleanup = () => {
            modal.classList.add('hidden');
            widthInput.removeEventListener('input', onWidthChange);
            heightInput.removeEventListener('input', onHeightChange);
            document.getElementById('export-btn').onclick = null;
            document.getElementById('cancel-export-btn').onclick = null;
        };

        document.getElementById('export-btn').onclick = () => {
            const settings = {
                source: document.querySelector('input[name="export-source"]:checked').value,
                rect: sourceRect,
                width: parseInt(widthInput.value),
                height: parseInt(heightInput.value),
                useAlpha: document.getElementById('include-alpha').checked
            };
            this.exportImage(settings);
            hideAndCleanup();
        };

        document.getElementById('cancel-export-btn').onclick = hideAndCleanup;
    }

    getFullCanvasBounds() {
        const { chunks } = this.canvasEngine;
        if (chunks.size === 0) {
            return { minX: 0, minY: 0, width: 1, height: 1 };
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const chunk of chunks.values()) {
            minX = Math.min(minX, chunk.x);
            minY = Math.min(minY, chunk.y);
            maxX = Math.max(maxX, chunk.x + this.canvasEngine.chunkSize);
            maxY = Math.max(maxY, chunk.y + this.canvasEngine.chunkSize);
        }
        return { minX, minY, width: maxX - minX, height: maxY - minY };
    }

    pointInRect(point, rect) {
        return point.x >= rect.x && point.x <= rect.x + rect.width &&
               point.y >= rect.y && point.y <= rect.y + rect.height;
    }

    cutSelection() {
        if (!this.selection || this.selection.width <= 0 || this.selection.height <= 0) return;

        this.historyManager.startStroke(); // Start a history action for the cut/paste operation
        const { canvas, affectedChunks } = this.canvasEngine.getPixelsForArea(this.selection);

        this.floatingSelectionData = {
            canvas,
            x: this.selection.x,
            y: this.selection.y,
            width: this.selection.width,
            height: this.selection.height
        };
        
        // Clear the original area
        this.canvasEngine.clearRect(this.selection, affectedChunks);

        // Update canvas engine to show floating selection and hide static selection
        this.canvasEngine.setSelection(null);
        this.canvasEngine.setFloatingSelection(this.floatingSelectionData);
    }

    pasteSelection() {
        if (!this.floatingSelectionData) return;
        
        this.canvasEngine.pasteImageData(this.floatingSelectionData);
        this.historyManager.endStroke(); // End the history action
    }

    handleImagePan(e) {
        if (!this.isTransformingSelection || !this.floatingSelectionData) return;
        
        const worldPos = this.canvasEngine.screenToWorld(e.clientX, e.clientY);
        const deltaX = worldPos.x - this.transformStartPoint.x;
        const deltaY = worldPos.y - this.transformStartPoint.y;
        
        // The issue was here - we were adding the delta to the original position
        // instead of calculating the new position based on the current mouse position
        this.floatingSelectionData.x = this.selectionOriginalPosition.x + deltaX;
        this.floatingSelectionData.y = this.selectionOriginalPosition.y + deltaY;
        
        this.canvasEngine.setFloatingSelection(this.floatingSelectionData);
    }

    async exportImage(settings) {
        this.showLoading();
        await new Promise(resolve => setTimeout(resolve, 50)); // Allow UI to update

        try {
            if (settings.rect.width <= 0 || settings.rect.height <= 0) {
                alert("The selected area has no content.");
                return;
            }

            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = settings.width;
            exportCanvas.height = settings.height;
            const ctx = exportCanvas.getContext('2d');

            if (!settings.useAlpha) {
                ctx.fillStyle = '#f0f0f0'; // Default background color
                ctx.fillRect(0, 0, settings.width, settings.height);
            }

            // Draw content from chunks onto the export canvas, scaled
            ctx.drawImage(
                this.canvasEngine.canvas,
                // source rect from main canvas (in screen pixels)
                (settings.rect.x - this.canvasEngine.viewport.x) * this.canvasEngine.viewport.zoom * this.canvasEngine.pixelRatio,
                (settings.rect.y - this.canvasEngine.viewport.y) * this.canvasEngine.viewport.zoom * this.canvasEngine.pixelRatio,
                settings.rect.width * this.canvasEngine.viewport.zoom * this.canvasEngine.pixelRatio,
                settings.rect.height * this.canvasEngine.viewport.zoom * this.canvasEngine.pixelRatio,
                // destination rect on export canvas
                0, 0, settings.width, settings.height
            );

            // This is a simplified method. A more robust one would iterate chunks.
            // For now, let's create a temporary canvas with all chunks drawn on it.
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.getFullCanvasBounds().width;
            tempCanvas.height = this.getFullCanvasBounds().height;
            const tempCtx = tempCanvas.getContext('2d');
            const bounds = this.getFullCanvasBounds();

            for (const chunk of this.canvasEngine.chunks.values()) {
                const dx = chunk.x - bounds.minX;
                const dy = chunk.y - bounds.minY;
                tempCtx.drawImage(chunk.canvas,
                    this.canvasEngine.chunkRenderPadding, this.canvasEngine.chunkRenderPadding,
                    this.canvasEngine.chunkSize, this.canvasEngine.chunkSize,
                    dx, dy, this.canvasEngine.chunkSize, this.canvasEngine.chunkSize);
            }

            ctx.clearRect(0, 0, settings.width, settings.height);
            if (!settings.useAlpha) {
                ctx.fillStyle = '#f0f0f0';
                ctx.fillRect(0, 0, settings.width, settings.height);
            }

            ctx.drawImage(
                tempCanvas,
                settings.rect.x - bounds.minX,
                settings.rect.y - bounds.minY,
                settings.rect.width,
                settings.rect.height,
                0, 0, settings.width, settings.height
            );

            const dataUrl = exportCanvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `atelier-export-${Date.now()}.png`;
            link.href = dataUrl;
            link.click();

        } catch (e) {
            console.error("Failed to save image:", e);
            alert("An error occurred while saving the image.");
        } finally {
            this.hideLoading();
        }
    }
    
    async loadImageViewerInstances() {
        // Look for all saved image viewer positions
        const viewerKeys = Object.keys(localStorage).filter(key => key.startsWith('imageViewerPosition-'));
        const loadPromises = [];

        for (const key of viewerKeys) {
            try {
                const savedPosition = JSON.parse(localStorage.getItem(key));
                const instanceId = key.replace('imageViewerPosition-', ''); // Extract instanceId

                // Try to find the image for this viewer
                const imageData = this.imageManager.getImageById(savedPosition.currentImageId);

                if (imageData) {
                    const newViewer = new ImageViewerPanel(instanceId, this, this.canvasEngine);
                    this.imageViewerInstances.set(instanceId, newViewer);
                    // Load position and display image in the new viewer instance
                    // displayImage will implicitly call show() and handle loading the image element
                    loadPromises.push(newViewer.loadPosition().then(() => newViewer.displayImage(imageData)));
                } else {
                    // Image not found (deleted?), so clean up this viewer's saved data
                    console.warn(`Saved image viewer for ID ${savedPosition.currentImageId} not found. Removing viewer data.`);
                    localStorage.removeItem(key);
                }
            } catch (e) {
                console.error(`Error loading saved image viewer instance from key ${key}:`, e);
                localStorage.removeItem(key); // Clean up corrupted data
            }
        }
        await Promise.allSettled(loadPromises); // Wait for all viewers to attempt loading
    }

    showImageViewer(imageId) {
        const imageData = this.imageManager.getImageById(imageId);
        if (!imageData) return;

        // Check if this image is already open in any viewer. If so, bring that specific instance to front.
        for (const [instanceId, viewer] of this.imageViewerInstances.entries()) {
            if (viewer.currentImage && viewer.currentImage.id === imageId) {
                viewer.show(); // Ensure visible
                this.bringPanelToFront(viewer.panel); // Bring to front
                return;
            }
        }

        // If not already open, create a new viewer instance
        const instanceId = `viewer-${Date.now()}-${Math.floor(Math.random() * 1000)}`; // More robust unique ID
        const newViewer = new ImageViewerPanel(instanceId, this, this.canvasEngine);
        this.imageViewerInstances.set(instanceId, newViewer);
        newViewer.displayImage(imageData); // This will call show() internally
        this.bringPanelToFront(newViewer.panel);
    }

    imageDeleted(id) {
        // Iterate through a copy of the map entries because we might delete elements
        for (const [instanceId, viewer] of Array.from(this.imageViewerInstances.entries())) {
            if (viewer.currentImage && viewer.currentImage.id === id) {
                viewer.destroy(); // Remove panel and its saved data
                this.imageViewerInstances.delete(instanceId); // Remove from map
            }
        }
    }

    clearAllImages() {
        // Destroy all viewer instances
        for (const [instanceId, viewer] of Array.from(this.imageViewerInstances.entries())) {
            viewer.destroy(); // Destroy all viewer instances
        }
        this.imageViewerInstances.clear(); // Clear the map
    }

    bringPanelToFront(panelElement) {
        // Increment global z-index and apply it to the panel
        this.nextZIndex++;
        panelElement.style.zIndex = this.nextZIndex;
        // Also save the position immediately to persist the z-index change
        // We need to check if the panel itself (not just its element) has a savePosition method
        if (panelElement.id.startsWith('image-viewer-panel-')) {
            const instanceId = panelElement.id.replace('image-viewer-panel-', '');
            const viewerInstance = this.imageViewerInstances.get(instanceId);
            if (viewerInstance) viewerInstance.savePosition();
        } else if (panelElement.id === 'image-manager-panel') {
            this.imageManager.savePosition();
        } else if (panelElement.id === 'color-panel') {
            this.colorPicker.savePosition();
        }
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    }
    
    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }
    
    updateCursor() {
        if (this.canvasEngine.isPanning) {
            this.canvasEngine.canvas.style.cursor = 'grabbing';
        } else if (this.isZoomModeActive) {
            this.canvasEngine.canvas.style.cursor = 'zoom-in';
        } else if (this.isSpacePanActive || this.canvasEngine.isPanToolActive) {
            this.canvasEngine.canvas.style.cursor = 'grab';
        } else if (this.brushEngine.currentTool === 'select') {
            this.canvasEngine.canvas.style.cursor = 'crosshair';
        } else {
            // Default crosshair for drawing tools
            this.canvasEngine.canvas.style.cursor = 'crosshair';
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new AtelierApp();
});