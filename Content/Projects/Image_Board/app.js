import { ImageBoard } from './ImageBoard.js';
import { LayerManager } from './LayerManager.js';
import { CropTool } from './CropTool.js';
import { TextTool } from './TextTool.js';
import { FileManager } from './FileManager.js';

class App {
    constructor() {
        this.imageBoard = new ImageBoard();
        this.layerManager = new LayerManager(this); // Pass app context
        this.cropTool = new CropTool(); // Keep for potential future HTML-based crop UI, currently canvas-drawn
        this.textTool = new TextTool();
        this.fileManager = new FileManager();
        
        this.zoom = 1; // Initialize zoom level here, but ImageBoard will be the source of truth
        this.isPanning = false;
        this.lastPanPoint = { x: 0, y: 0 };
        this.inventory = []; // Store all imported images
        
        // New state tracking variables
        this.activeTool = 'select'; // 'select', 'move', 'resize', 'crop'
        this.isMovingItem = false; // Renamed from isMovingImage
        this.isResizingItem = false; // Renamed from isResizingImage
        this.isCropping = false; // True when an image is selected and crop tool is active
        this.cropDragMode = null; // 'move', 'nw', 'ne', 'sw', 'se'
        this.cropRect = { x: 0, y: 0, width: 0, height: 0 }; // Current interactive crop rectangle (in original image pixels)
        this.cropStartMouse = { x: 0, y: 0 }; // Mouse position at crop start (in original image pixels)
        this.initialCropRect = { x: 0, y: 0, width: 0, height: 0 }; // Crop rect state when drag starts
        
        // Cut Mode state
        this.isCutMode = false;
        // Cut region defined in Canvas coordinates (relative to canvas top-left, independent of pan/zoom)
        // Set initial values, these will be recalculated on canvas setup/resize
        this.cutRegion = { x: 0, y: 0, width: 256, height: 256 }; 
        // Lasso tool state
        this.isLassoDrawing = false; // If the lasso tool is active (button pressed)
        this.isLassoDrawingShape = false; // If the mouse button is currently held down to draw a shape
        this.currentLassoPath = []; // Current points for the path being drawn
        this.lassoShapes = []; // Array of completed lasso shape paths (arrays of {x, y} points in world coordinates)
        
        this.canvas = document.getElementById('viewport'); // Reference to the main canvas
        this.inventoryGridContainer = document.getElementById('inventoryGrid'); // Reference to inventory list container
        this.inventoryPanel = document.getElementById('inventoryPanel');
        this.layersPanel = document.getElementById('layersPanel');
        this.cutModePanel = document.getElementById('cutModePanel');

        this.panelDragging = null; // Stores { element, startX, startY, initialLeft, initialTop }
        this.panelResizing = null; // Stores { element, startX, startY, initialWidth, initialHeight, direction }

        // Export modal variables
        this.initialExportWidth = 0;
        this.initialExportHeight = 0;
        this.exportAspectRatio = 1; // Aspect ratio of the board or selected item for export
        this.currentExportScale = 1; // Current multiplier for export
        this.exportWithAlpha = false; // New: track transparency option for export

        this.imageBoard.onSelectionChange = (selectedId) => {
            this.layerManager.updateLayersList(selectedId);
        };
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners(); // Call after canvas setup
        this.setupInventoryEvents();
        this.setupPanelEvents(); // New: setup events for floating panels
        this.setupCutModeEvents(); // New: setup events for cut mode panel
        this.updateZoomDisplay(); // Update display with initial zoom from ImageBoard
        this.render(); // Initial render
        this.renderInventory(); // Initial render of inventory
        this.layerManager.updateLayersList(); // Initial render of layers
    }
    
    setupEventListeners() {
        // Toolbar buttons
        document.getElementById('importBtn').addEventListener('click', () => this.importImages());
        document.getElementById('addTextBtn').addEventListener('click', () => this.addText());
        document.getElementById('cropBtn').addEventListener('click', () => this.toggleCropMode()); // New crop button
        document.getElementById('cutModeBtn').addEventListener('click', () => this.toggleCutMode(true)); // New cut mode button
        document.getElementById('deleteBtn').addEventListener('click', () => this.deleteSelected()); // New delete button
        document.getElementById('saveBtn').addEventListener('click', () => this.saveBoard());
        document.getElementById('loadBtn').addEventListener('click', () => this.loadBoard());
        document.getElementById('exportBtn').addEventListener('click', () => this.showExportModal()); // New export button
        
        // Zoom controls
        document.getElementById('zoomIn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOut').addEventListener('click', () => this.zoomOut());
        
        // File inputs
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleImageImport(e));
        document.getElementById('loadFileInput').addEventListener('change', (e) => this.handleBoardLoad(e));
        
        // Canvas events - simplified to single handlers
        const viewport = document.getElementById('viewport');
        viewport.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        viewport.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        viewport.addEventListener('mouseup', () => this.handleMouseUp());
        viewport.addEventListener('wheel', (e) => this.handleWheel(e)); // Added wheel event for zoom
        
        // Keyboard events for spacebar
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (!this.isCropping && !this.isMovingItem && !this.isResizingItem) {
                    this.isSpacePressed = true;
                    document.getElementById('viewport').style.cursor = 'grab';
                }
            }
            this.handleKeyDown(e);
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.isSpacePressed = false;
                if (!this.isCropping && !this.isMovingItem && !this.isResizingItem) {
                    document.getElementById('viewport').style.cursor = 'default';
                } else if (this.isCropping) {
                    document.getElementById('viewport').style.cursor = 'crosshair';
                }
            }
        });
        
        // Window resize
        window.addEventListener('resize', () => this.setupCanvas());

        // Modal buttons
        document.getElementById('exportConfirmBtn').addEventListener('click', () => this.handleExportConfirm());
        document.getElementById('exportCancelBtn').addEventListener('click', () => this.hideExportModal());

        // Export modal scale radio buttons
        document.querySelectorAll('input[name="exportScale"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.currentExportScale = parseFloat(e.target.value);
                this.applyExportScale();
            });
        });

        // Export modal aspect ratio lock checkbox
        document.getElementById('lockAspectRatio').addEventListener('change', () => {
            this.adjustExportDimensions('exportWidth'); // Re-evaluate dimensions based on current width
        });

        // Export modal width/height input changes
        document.getElementById('exportWidth').addEventListener('input', () => this.adjustExportDimensions('exportWidth'));
        document.getElementById('exportHeight').addEventListener('input', () => this.adjustExportDimensions('exportHeight'));
        
        // New: Export modal transparency checkbox
        document.getElementById('exportWithAlpha').addEventListener('change', (e) => {
            this.exportWithAlpha = e.target.checked;
            const bgColorGroup = document.getElementById('exportBgColorGroup');
            if (this.exportWithAlpha) {
                bgColorGroup.classList.add('hidden');
            } else {
                bgColorGroup.classList.remove('hidden');
            }
        });
    }

    setupCutModeEvents() {
        document.getElementById('exitCutModeBtn').addEventListener('click', () => this.toggleCutMode(false));
        document.getElementById('cutModeSnapshotBtn').addEventListener('click', () => this.exportCutRegion());
        
        document.getElementById('startLassoBtn').addEventListener('click', () => this.toggleLassoDrawingTool());
        document.getElementById('clearLassoBtn').addEventListener('click', () => this.clearLassoShapes());
        
        // New Cut Size input listeners
        document.getElementById('cutSizeWidth').addEventListener('input', (e) => this.handleCutSizeChange('width', e.target.value));
        document.getElementById('cutSizeHeight').addEventListener('input', (e) => this.handleCutSizeChange('height', e.target.value));

        // Set initial panel properties
        this.cutRegion.width = 256;
        this.cutRegion.height = 256;
        this.setupCanvas(); // Initialize cutRegion position based on new width/height structure
    }
    
    handleCutSizeChange(dimension, value) {
        let size = parseInt(value);
        if (isNaN(size) || size < 1) {
            size = 1; // Minimum size of 1
        }
        
        if (dimension === 'width') {
            this.cutRegion.width = size;
            document.getElementById('cutSizeWidth').value = size;
        } else {
            this.cutRegion.height = size;
            document.getElementById('cutSizeHeight').value = size;
        }
        
        this.setupCutRegionPosition();
        this.render();
    }

    toggleCutMode(activate) {
        if (activate === undefined) {
            this.isCutMode = !this.isCutMode;
        } else {
            this.isCutMode = activate;
        }

        if (this.isCutMode) {
            // Disable other interactive modes
            this.isCropping = false;
            this.imageBoard.selectItem(null);
            this.cutModePanel.classList.remove('hidden');
            document.getElementById('viewport').style.cursor = 'default';
            this.setupCutRegionPosition(); // Recalculate cutRegion center position
            this.syncCutModeInputs();
        } else {
            // Exit all cut mode drawing tools
            this.isLassoDrawing = false;
            this.isLassoDrawingShape = false;
            this.currentLassoPath = [];
            this.cutModePanel.classList.add('hidden');
            this.toggleLassoDrawingTool(false); // Reset lasso button state
        }
        this.render();
    }
    
    syncCutModeInputs() {
        document.getElementById('cutSizeWidth').value = this.cutRegion.width;
        document.getElementById('cutSizeHeight').value = this.cutRegion.height;
    }
    
    toggleLassoDrawingTool(activate) {
        if (activate === undefined) {
            this.isLassoDrawing = !this.isLassoDrawing;
        } else {
            this.isLassoDrawing = activate;
        }
        
        // Reset drawing state whenever tool state changes
        this.isLassoDrawingShape = false;
        this.currentLassoPath = [];
        
        const lassoBtn = document.getElementById('startLassoBtn');
        
        if (this.isLassoDrawing) {
            lassoBtn.textContent = 'Lasso Active (Click & Drag)';
            lassoBtn.classList.remove('primary');
            lassoBtn.classList.add('danger'); // Use danger color to indicate active mode
            document.getElementById('viewport').style.cursor = 'crosshair';
        } else {
            lassoBtn.textContent = 'Start Freehand Lasso';
            lassoBtn.classList.add('primary');
            lassoBtn.classList.remove('danger');
            
            // If exiting cut mode entirely, cursor will be handled by toggleCutMode
            if (this.isCutMode) {
                document.getElementById('viewport').style.cursor = 'move'; // Back to pan cursor in cut mode
            } else {
                document.getElementById('viewport').style.cursor = 'default';
            }
        }
        this.render();
    }

    clearLassoShapes() {
        if (confirm('Are you sure you want to clear all drawn black shapes?')) {
            this.lassoShapes = [];
            this.render();
        }
    }

    setupPanelEvents() {
        // Generic mouse handlers for panels, will decide drag/resize based on target
        document.addEventListener('mousemove', (e) => this.handlePanelMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handlePanelMouseUp(e));

        [this.inventoryPanel, this.layersPanel, this.cutModePanel].forEach(panel => {
            if (!panel) return; // Guard against panel not existing

            const header = panel.querySelector('.panel-header');
            if (header) {
                header.addEventListener('mousedown', (e) => this.handlePanelMouseDown(e, panel, 'drag'));
            }

            panel.querySelectorAll('.resize-handle').forEach(handle => {
                handle.addEventListener('mousedown', (e) => {
                    e.stopPropagation(); // Prevent drag if resize handle is clicked
                    this.handlePanelMouseDown(e, panel, 'resize', handle.classList.item(1).replace('resize-', ''));
                });
            });
        });

        // Set initial positions for panels (cutModePanel uses CSS centering now)
        this.inventoryPanel.style.left = '20px';
        this.inventoryPanel.style.top = '80px';
        this.inventoryPanel.style.width = '300px';
        this.inventoryPanel.style.height = '400px';

        this.layersPanel.style.right = '20px';
        this.layersPanel.style.top = '80px';
        this.layersPanel.style.width = '280px';
        this.layersPanel.style.height = '400px';

        // Set default position for Cut Mode panel if it wasn't hidden by CSS transform
        // We'll rely on the default position set in CSS, but ensure it's hidden initially.
        this.cutModePanel.style.left = '50%';
        this.cutModePanel.style.transform = 'translateX(-50%)'; // Retain centering for default start
        this.cutModePanel.style.top = '80px'; 
        
        // Ensure cutModePanel starts hidden by CSS class if not explicitly positioned
        if (!this.isCutMode) {
            this.cutModePanel.classList.add('hidden');
        }
    }

    handlePanelMouseDown(e, panel, mode, direction = null) {
        if (e.button !== 0) return; // Only left click

        e.preventDefault(); // Prevent text selection etc.

        if (mode === 'drag') {
            const rect = panel.getBoundingClientRect();
            this.panelDragging = {
                element: panel,
                startX: e.clientX,
                startY: e.clientY,
                initialLeft: rect.left,
                initialTop: rect.top
            };
            panel.style.cursor = 'grabbing';
            panel.style.zIndex = '1001'; // Bring to front
            
            // If dragging the cut mode panel, remove its CSS centering for independent positioning
            if (panel.id === 'cutModePanel') {
                panel.style.transform = 'none'; // Use 'panel' instead of 'element'
                panel.style.left = `${rect.left}px`; // Fix position based on current visual location
            }

        } else if (mode === 'resize') {
            const rect = panel.getBoundingClientRect();
            this.panelResizing = {
                element: panel,
                startX: e.clientX,
                startY: e.clientY,
                initialLeft: rect.left,
                initialTop: rect.top,
                initialWidth: rect.width,
                initialHeight: rect.height,
                direction: direction
            };
            panel.style.zIndex = '1001'; // Bring to front
        }
    }

    handlePanelMouseMove(e) {
        if (this.panelDragging) {
            const { element, startX, startY, initialLeft, initialTop } = this.panelDragging;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            element.style.left = `${initialLeft + dx}px`;
            element.style.top = `${initialTop + dy}px`;
        } else if (this.panelResizing) {
            const { element, startX, startY, initialLeft, initialTop, initialWidth, initialHeight, direction } = this.panelResizing;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            let newLeft = initialLeft;
            let newTop = initialTop;
            let newWidth = initialWidth;
            let newHeight = initialHeight;

            const minWidth = 200;
            const minHeight = 150;

            switch (direction) {
                case 'n':
                    newHeight = Math.max(minHeight, initialHeight - dy);
                    newTop = initialTop + (initialHeight - newHeight);
                    break;
                case 's':
                    newHeight = Math.max(minHeight, initialHeight + dy);
                    break;
                case 'w':
                    newWidth = Math.max(minWidth, initialWidth - dx);
                    newLeft = initialLeft + (initialWidth - newWidth);
                    break;
                case 'e':
                    newWidth = Math.max(minWidth, initialWidth + dx);
                    break;
                case 'nw':
                    newWidth = Math.max(minWidth, initialWidth - dx);
                    newHeight = Math.max(minHeight, initialHeight - dy);
                    newLeft = initialLeft + (initialWidth - newWidth);
                    newTop = initialTop + (initialHeight - newHeight);
                    break;
                case 'ne':
                    newWidth = Math.max(minWidth, initialWidth + dx);
                    newHeight = Math.max(minHeight, initialHeight - dy);
                    newTop = initialTop + (initialHeight - newHeight);
                    break;
                case 'sw':
                    newWidth = Math.max(minWidth, initialWidth - dx);
                    newHeight = Math.max(minWidth, initialHeight + dy);
                    newLeft = initialLeft + (initialWidth - newWidth);
                    break;
                case 'se':
                    newWidth = Math.max(minWidth, initialWidth + dx);
                    newHeight = Math.max(minWidth, initialHeight + dy);
                    break;
            }

            element.style.left = `${newLeft}px`;
            element.style.top = `${newTop}px`;
            element.style.width = `${newWidth}px`;
            element.style.height = `${newHeight}px`;
        }
    }

    handlePanelMouseUp() {
        if (this.panelDragging) {
            this.panelDragging.element.style.cursor = 'grab';
            this.panelDragging.element.style.zIndex = '500'; // Reset z-index
            this.panelDragging = null;
        }
        if (this.panelResizing) {
            this.panelResizing.element.style.zIndex = '500'; // Reset z-index
            this.panelResizing = null;
        }
    }

    setupCanvas() {
        const canvas = document.getElementById('viewport');
        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        
        // Recalculate fixed cut region center on resize
        this.setupCutRegionPosition();

        this.render();
    }
    
    setupCutRegionPosition() {
        // Calculate fixed cut region center on resize or size change
        const cutWidth = this.cutRegion.width;
        const cutHeight = this.cutRegion.height;

        this.cutRegion.x = (this.canvas.width / 2) - (cutWidth / 2);
        this.cutRegion.y = (this.canvas.height / 2) - (cutHeight / 2);
        
        // Note: this.cutRegion now has x, y, width, height properties instead of x, y, size
    }

    // Returns world coordinates (board space after pan but before zoom)
    getTransformedCoords(e) {
        const rect = e.target.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / this.imageBoard.zoom - this.imageBoard.panX, // Use imageBoard's zoom
            y: (e.clientY - rect.top) / this.imageBoard.zoom - this.imageBoard.panY // Use imageBoard's zoom
        };
    }
    
    // Returns canvas coordinates (relative to canvas top-left, independent of pan/zoom)
    getCanvasCoords(e) {
        const rect = e.target.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    handleWheel(e) {
        e.preventDefault(); // Prevent page scrolling
        const zoomFactor = 1.1; // Adjust sensitivity
        
        // Get mouse position relative to canvas (before pan/zoom)
        const rect = e.target.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate world coordinates before zoom
        const worldX = (mouseX / this.imageBoard.zoom) - this.imageBoard.panX; // Use imageBoard's zoom
        const worldY = (mouseY / this.imageBoard.zoom) - this.imageBoard.panY; // Use imageBoard's zoom

        if (e.deltaY < 0) { // Zoom in
            this.imageBoard.zoom = Math.min(this.imageBoard.zoom * zoomFactor, 5); // Update imageBoard's zoom
        } else { // Zoom out
            this.imageBoard.zoom = Math.max(this.imageBoard.zoom / zoomFactor, 0.1); // Update imageBoard's zoom
        }

        // Calculate new pan to keep mouse position in the same world spot
        this.imageBoard.panX = (mouseX / this.imageBoard.zoom) - worldX;
        this.imageBoard.panY = (mouseY / this.imageBoard.zoom) - worldY;

        this.updateZoomDisplay();
        this.render();
    }
    
    toggleCropMode() {
        const selectedItem = this.imageBoard.getSelected();
        if (!selectedItem || selectedItem.type !== 'image') {
            console.log("Select an image to crop.");
            this.isCropping = false;
            document.getElementById('viewport').style.cursor = 'default'; // Reset cursor
            this.render();
            return;
        }

        // If currently in crop mode and this image has a crop, second trigger resets
        if (this.isCropping && selectedItem.crop) {
            this.imageBoard.cropItem(selectedItem.id, null); // Reset crop to full
            // Recalculate cropRect for the UI to represent the full image
            this.cropRect = { x: 0, y: 0, width: selectedItem.originalWidth, height: selectedItem.originalHeight };
            this.isCropping = false;
            document.getElementById('viewport').style.cursor = 'default';
            this.render();
            return;
        }

        this.isCropping = !this.isCropping;

        if (this.isCropping) {
            // Ensure we exit cut mode if entering crop mode
            if (this.isCutMode) this.toggleCutMode(false); 

            this.imageBoard.selectItem(selectedItem.id);
            const item = selectedItem;
            if (item.crop) {
                this.cropRect = { ...item.crop };
            } else {
                this.cropRect = { x: 0, y: 0, width: item.originalWidth, height: item.originalHeight };
            }
            document.getElementById('viewport').style.cursor = 'crosshair';
        } else {
            // If exiting crop mode, apply the current cropRect
            if (this.cropRect.width > 0 && this.cropRect.height > 0) {
                this.imageBoard.cropItem(selectedItem.id, this.cropRect);
            } else {
                // If crop area is invalid/zero, reset crop
                this.imageBoard.cropItem(selectedItem.id, null);
            }
            this.cropDragMode = null; // Clear any active drag
            document.getElementById('viewport').style.cursor = 'default';
        }
        this.render();
    }

    handleMouseDown(e) {
        if (e.button !== 0) return; // Only left click
        
        // If a panel is being dragged or resized, prevent canvas interaction
        if (this.panelDragging || this.panelResizing) return;

        const rect = e.target.getBoundingClientRect();
        const mouseCanvasX = e.clientX - rect.left;
        const mouseCanvasY = e.clientY - rect.top;
        
        const worldX = (mouseCanvasX / this.imageBoard.zoom) - this.imageBoard.panX; // Use imageBoard's zoom
        const worldY = (mouseCanvasY / this.imageBoard.zoom) - this.imageBoard.panY; // Use imageBoard's zoom
        
        // Handle Cut Mode interactions first
        if (this.isCutMode) {
            // Priority 1: Lasso drawing (if enabled)
            if (this.isLassoDrawing) {
                // If the lasso tool is active, start drawing a shape on mousedown
                this.isLassoDrawingShape = true;
                this.currentLassoPath = []; // Start a new shape
                const { x, y } = this.getTransformedCoords(e);
                this.currentLassoPath.push({ x, y });
                e.preventDefault();
                return;
            }

            // Priority 2: Dragging the Cut Region (now disabled as region is fixed center)
            // Interaction in Cut Mode is now exclusively pan/zoom of the canvas content.
            
            // Allow panning via click and drag anywhere on the canvas (unless lasso is active)
            this.isPanning = true;
            this.lastPanPoint = { x: e.clientX, y: e.clientY };
            document.getElementById('viewport').style.cursor = 'move'; // Use move cursor for drag pan
            return;
        }

        // Pan logic (highest priority with spacebar)
        if (this.isSpacePressed) {
            this.isPanning = true;
            this.lastPanPoint = { x: e.clientX, y: e.clientY };
            document.getElementById('viewport').style.cursor = 'grabbing';
            return;
        }

        const selectedItem = this.imageBoard.getSelected();

        if (this.isCropping && selectedItem && selectedItem.type === 'image') {
            const imageXOnBoard = selectedItem.x;
            const imageYOnBoard = selectedItem.y;
            // The item's width/height might have been adjusted for its initial aspect ratio
            // when it was first added to the board (e.g., to fit 512px width).
            // We need to use the current displayed width/height of the image element on the board.
            // When a crop is applied, the displayed dimensions change.
            let displayWidth = selectedItem.width;
            let displayHeight = selectedItem.height;

            if (selectedItem.crop) {
                const aspectRatio = selectedItem.crop.width / selectedItem.crop.height;
                if (selectedItem.crop.width > selectedItem.crop.height) {
                    displayWidth = selectedItem.width;
                    displayHeight = displayWidth / aspectRatio;
                } else {
                    displayHeight = selectedItem.height;
                    displayWidth = displayHeight * aspectRatio;
                }
            }

            const mouseXInImageBoardSpace = worldX - imageXOnBoard;
            const mouseYInImageBoardSpace = worldY - imageYOnBoard;
            
            // Scale factors from original image dimensions to current displayed dimensions on board
            const scaleX = selectedItem.originalWidth / displayWidth;
            const scaleY = selectedItem.originalHeight / displayHeight;
            const mouseXInOriginalImage = mouseXInImageBoardSpace * scaleX;
            const mouseYInOriginalImage = mouseYInImageBoardSpace * scaleY;

            const handleDetectionSize = 10;
            const handleRadiusOnBoard = handleDetectionSize / this.imageBoard.zoom; // Use imageBoard's zoom
            
            // Crop rectangle's coordinates on the board (relative to its image)
            const cropXOnBoard = imageXOnBoard + this.cropRect.x / scaleX;
            const cropYOnBoard = imageYOnBoard + this.cropRect.y / scaleY;
            const cropWidthOnBoard = this.cropRect.width / scaleX;
            const cropHeightOnBoard = this.cropRect.height / scaleY;

            const handles = {
                nw: { x: cropXOnBoard, y: cropYOnBoard, cursor: 'nwse-resize' },
                ne: { x: cropXOnBoard + cropWidthOnBoard, y: cropYOnBoard, cursor: 'nesw-resize' },
                sw: { x: cropXOnBoard, y: cropYOnBoard + cropHeightOnBoard, cursor: 'nesw-resize' },
                se: { x: cropXOnBoard + cropWidthOnBoard, y: cropYOnBoard + cropHeightOnBoard, cursor: 'nwse-resize' }
            };

            for (const key in handles) {
                const handle = handles[key];
                const dist = Math.sqrt(Math.pow(worldX - handle.x, 2) + Math.pow(worldY - handle.y, 2));
                if (dist <= handleRadiusOnBoard) {
                    this.cropDragMode = key;
                    this.cropStartMouse = { x: mouseXInOriginalImage, y: mouseYInOriginalImage };
                    this.initialCropRect = { ...this.cropRect };
                    document.getElementById('viewport').style.cursor = handle.cursor;
                    e.preventDefault();
                    return;
                }
            }

            // Check if clicking inside the crop rectangle to move it
            if (mouseXInOriginalImage >= this.cropRect.x && mouseXInOriginalImage <= this.cropRect.x + this.cropRect.width &&
                mouseYInOriginalImage >= this.cropRect.y && mouseYInOriginalImage <= this.cropRect.y + this.cropRect.height) {
                this.cropDragMode = 'move';
                this.cropStartMouse = { x: mouseXInOriginalImage, y: mouseYInOriginalImage };
                this.initialCropRect = { ...this.cropRect };
                document.getElementById('viewport').style.cursor = 'grab';
                e.preventDefault();
                return;
            }

            // If click outside of crop area, exit crop mode
            this.toggleCropMode();
            return;
        }
        
        this.isMovingItem = false;
        this.isResizingItem = false;
        
        if (selectedItem && selectedItem.type === 'image') {
            let displayWidth = selectedItem.width;
            let displayHeight = selectedItem.height;
            
            // Use actual dimensions for interaction (accounting for crop)
            if (selectedItem.crop) {
                const aspectRatio = selectedItem.crop.width / selectedItem.crop.height;
                if (selectedItem.crop.width > selectedItem.crop.height) {
                    displayWidth = selectedItem.width;
                    displayHeight = displayWidth / aspectRatio;
                } else {
                    displayHeight = selectedItem.height;
                    displayWidth = displayHeight * aspectRatio;
                }
            }

            // Transformed handle position for click detection
            const transformedHandleX = (selectedItem.x + displayWidth + this.imageBoard.panX) * this.imageBoard.zoom; // Use imageBoard's zoom
            const transformedHandleY = (selectedItem.y + displayHeight + this.imageBoard.panY) * this.imageBoard.zoom; // Use imageBoard's zoom
            
            const clickX = e.clientX - e.target.getBoundingClientRect().left;
            const clickY = e.clientY - e.target.getBoundingClientRect().top;
            
            if (Math.sqrt((clickX - transformedHandleX) ** 2 + (clickY - transformedHandleY) ** 2) <= 12) {
                this.isResizingItem = true;
                this.resizeStart = { 
                    x: worldX,
                    y: worldY,
                    width: displayWidth, 
                    height: displayHeight 
                };
                document.getElementById('viewport').style.cursor = 'nwse-resize';
                e.preventDefault();
                return;
            }
        }

        let clickedItem = null;
        // Iterate over items in reverse z-index order (top-most first) for picking
        const items = this.imageBoard.getAllItems().sort((a,b) => (a.zIndex || 0) - (b.zIndex || 0));
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            if (!item.visible) continue; // Don't pick hidden items

            let itemXForHit = item.x;
            let itemYForHit = item.y;
            let itemWidthForHit = item.width;
            let itemHeightForHit = item.height;
            
            // Use actual dimensions for interaction (accounting for crop for images, and actual text bounds for text)
            if (item.type === 'image' && item.crop) {
                const aspectRatio = item.crop.width / item.crop.height;
                if (item.crop.width > item.crop.height) {
                    itemWidthForHit = item.width;
                    itemHeightForHit = itemWidthForHit / aspectRatio;
                } else {
                    itemHeightForHit = item.height;
                    itemWidthForHit = itemHeightForHit * aspectRatio;
                }
            } else if (item.type === 'text') {
                 // For text, measure actual width for selection
                const canvas = document.getElementById('viewport');
                const ctx = canvas.getContext('2d');
                ctx.font = `${item.fontSize}px ${item.fontFamily}`;
                itemWidthForHit = ctx.measureText(item.content).width; 
                itemHeightForHit = item.fontSize * 1.2; 
                itemYForHit = item.y - item.fontSize; // Adjust item.y for hit detection to be the top of the text box
            }
            
            if (worldX >= itemXForHit && worldX <= itemXForHit + itemWidthForHit &&
                worldY >= itemYForHit && worldY <= itemYForHit + itemHeightForHit) {
                clickedItem = item;
                break;
            }
        }

        if (clickedItem) {
            this.imageBoard.selectItem(clickedItem.id);
            this.isMovingItem = true;
            this.dragStart = { x: worldX, y: worldY, itemX: clickedItem.x, itemY: clickedItem.y };
            document.getElementById('viewport').style.cursor = 'move';
        } else {
            // Clicked on empty space, deselect
            this.imageBoard.selectItem(null);
            document.getElementById('viewport').style.cursor = 'default';
        }

        this.render();
    }
    
    handleMouseMove(e) {
        // If a panel is being dragged or resized, prevent canvas interaction
        if (this.panelDragging || this.panelResizing) return;

        const rect = e.target.getBoundingClientRect();
        const mouseCanvasX = e.clientX - rect.left;
        const mouseCanvasY = e.clientY - rect.top;
        
        const worldX = (mouseCanvasX / this.imageBoard.zoom) - this.imageBoard.panX; // Use imageBoard's zoom
        const worldY = (mouseCanvasY / this.imageBoard.zoom) - this.imageBoard.panY; // Use imageBoard's zoom

        // Pan logic
        if (this.isPanning) {
            const deltaX = e.clientX - this.lastPanPoint.x;
            const deltaY = e.clientY - this.lastPanPoint.y;
            
            this.imageBoard.pan(deltaX / this.imageBoard.zoom, deltaY / this.imageBoard.zoom); // Use imageBoard's zoom
            this.lastPanPoint = { x: e.clientX, y: e.clientY };
            this.render();
            return;
        }
        
        // CUT MODE LOGIC
        if (this.isCutMode) {
            // Lasso Drawing
            if (this.isLassoDrawing && this.isLassoDrawingShape) {
                const { x, y } = this.getTransformedCoords(e);
                this.currentLassoPath.push({ x, y });
                this.render();
                return;
            }
            
            // Moving Cut Region (replaced by panning the entire board)
            if (this.isPanning) {
                const deltaX = e.clientX - this.lastPanPoint.x;
                const deltaY = e.clientY - this.lastPanPoint.y;
                
                this.imageBoard.pan(deltaX / this.imageBoard.zoom, deltaY / this.imageBoard.zoom);
                this.lastPanPoint = { x: e.clientX, y: e.clientY };
                this.render();
                document.getElementById('viewport').style.cursor = 'grabbing'; // Change to grabbing while moving
                return;
            }

            // If cut mode is active but not drawing/moving/panning, the cursor should reflect the active tool or pan availability
            if (this.isLassoDrawing) {
                 document.getElementById('viewport').style.cursor = 'crosshair';
            } else {
                 document.getElementById('viewport').style.cursor = 'move';
            }
            return;
        }
        // END CUT MODE LOGIC

        const selectedItem = this.imageBoard.getSelected();

        // CROP TOOL LOGIC
        if (this.isCropping && selectedItem && selectedItem.type === 'image' && this.cropDragMode) {
            // Calculate current mouse position in original image pixel space
            const imageXOnBoard = selectedItem.x;
            const imageYOnBoard = selectedItem.y;
            let displayWidth = selectedItem.width;
            let displayHeight = selectedItem.height;

            if (selectedItem.crop) { // If there's an existing crop influencing display size
                const aspectRatio = selectedItem.crop.width / selectedItem.crop.height;
                if (selectedItem.crop.width > selectedItem.crop.height) {
                    displayWidth = selectedItem.width;
                    displayHeight = displayWidth / aspectRatio;
                } else {
                    displayHeight = selectedItem.height;
                    displayWidth = displayHeight * aspectRatio;
                }
            }

            const mouseXInImageBoardSpace = worldX - imageXOnBoard;
            const mouseYInImageBoardSpace = worldY - imageYOnBoard;
            
            const scaleX = selectedItem.originalWidth / displayWidth;
            const scaleY = selectedItem.originalHeight / displayHeight;
            const currentMouseXInOriginalImage = mouseXInImageBoardSpace * scaleX;
            const currentMouseYInOriginalImage = mouseYInImageBoardSpace * scaleY;

            const dx = currentMouseXInOriginalImage - this.cropStartMouse.x;
            const dy = currentMouseYInOriginalImage - this.cropStartMouse.y;

            let newX = this.initialCropRect.x;
            let newY = this.initialCropRect.y;
            let newWidth = this.initialCropRect.width;
            let newHeight = this.initialCropRect.height;

            const originalImgWidth = selectedItem.originalWidth;
            const originalImgHeight = selectedItem.originalHeight;

            const minCropSize = 5; // Minimum size for crop rectangle in original image pixels

            switch (this.cropDragMode) {
                case 'move':
                    newX = this.initialCropRect.x + dx;
                    newY = this.initialCropRect.y + dy;
                    break;
                case 'nw':
                    newX = this.initialCropRect.x + dx;
                    newY = this.initialCropRect.y + dy;
                    newWidth = this.initialCropRect.width - dx;
                    newHeight = this.initialCropRect.height - dy;
                    break;
                case 'ne':
                    newY = this.initialCropRect.y + dy;
                    newWidth = this.initialCropRect.width + dx;
                    newHeight = this.initialCropRect.height - dy;
                    break;
                case 'sw':
                    newX = this.initialCropRect.x + dx;
                    newWidth = this.initialCropRect.width - dx;
                    newHeight = this.initialCropRect.height + dy;
                    break;
                case 'se':
                    newWidth = this.initialCropRect.width + dx;
                    newHeight = this.initialCropRect.height + dy;
                    break;
            }

            // Ensure width/height are positive and clamp minimum size
            newWidth = Math.max(minCropSize, newWidth);
            newHeight = Math.max(minCropSize, newHeight);

            // Clamp newX and newY to prevent going outside original image bounds
            // Also clamp newWidth/newHeight to not exceed image bounds
            newX = Math.max(0, Math.min(newX, originalImgWidth - newWidth));
            newY = Math.max(0, Math.min(newY, originalImgHeight - newHeight));
            
            newWidth = Math.min(newWidth, originalImgWidth - newX);
            newHeight = Math.min(newHeight, originalImgHeight - newY);

            this.cropRect = { x: newX, y: newY, width: newWidth, height: newHeight };
            this.render();
            return;
        }
        // END CROP TOOL LOGIC

        // Hover effects and dragging for items (only if NOT in crop mode and NOT panning)
        let cursor = 'default';
        if (!this.isSpacePressed && !this.isCropping) {
            if (this.isMovingItem && selectedItem) {
                const dx = worldX - this.dragStart.x;
                const dy = worldY - this.dragStart.y;
                
                selectedItem.x = this.dragStart.itemX + dx;
                selectedItem.y = this.dragStart.itemY + dy;
                this.render();
                cursor = 'move';
            } else if (this.isResizingItem && selectedItem && selectedItem.type === 'image') {
                const deltaX = worldX - this.resizeStart.x;
                
                let newWidth; // Declare newWidth here
                let newHeight; // Declare newWidth here

                // Maintain aspect ratio for original image, not crop ratio
                const aspectRatio = selectedItem.originalWidth / selectedItem.originalHeight;
                
                // If crop is active, resizing should maintain the *cropped* aspect ratio for display
                if (selectedItem.crop) {
                    const cropAspectRatio = selectedItem.crop.width / selectedItem.crop.height;
                    newWidth = this.resizeStart.width + deltaX;
                    newHeight = newWidth / cropAspectRatio;
                } else {
                    newWidth = this.resizeStart.width + deltaX;
                    newHeight = newWidth / aspectRatio;
                }
                
                // Enforce minimum size
                newWidth = Math.max(newWidth, 50);
                newHeight = Math.max(newHeight, 50);
                
                selectedItem.width = newWidth;
                selectedItem.height = newHeight;
                
                this.render();
                cursor = 'nwse-resize';
            } else { // Not dragging an item, check hover for cursor change
                // Check if hovering over resize handle of selected item
                if (selectedItem && selectedItem.type === 'image') {
                    let displayWidth = selectedItem.width;
                    let displayHeight = selectedItem.height;
                    if (selectedItem.crop) {
                        const aspectRatio = selectedItem.crop.width / selectedItem.crop.height;
                        if (selectedItem.crop.width > selectedItem.crop.height) {
                            displayWidth = selectedItem.width;
                            displayHeight = displayWidth / aspectRatio;
                        } else {
                            displayHeight = selectedItem.height;
                            displayWidth = displayHeight * aspectRatio;
                        }
                    }

                    const transformedHandleX = (selectedItem.x + displayWidth + this.imageBoard.panX) * this.imageBoard.zoom; // Use imageBoard's zoom
                    const transformedHandleY = (selectedItem.y + displayHeight + this.imageBoard.panY) * this.imageBoard.zoom; // Use imageBoard's zoom
                    
                    const mouseCheckX = e.clientX - e.target.getBoundingClientRect().left;
                    const mouseCheckY = e.clientY - e.target.getBoundingClientRect().top;
                    
                    if (Math.sqrt((mouseCheckX - transformedHandleX) ** 2 + (mouseCheckY - transformedHandleY) ** 2) <= 12) {
                        cursor = 'nwse-resize';
                    } else if (worldX >= selectedItem.x && worldX <= selectedItem.x + displayWidth &&
                               selectedItem.type !== 'text' && // Don't show move cursor for text unless selected
                               worldY >= selectedItem.y && worldY <= selectedItem.y + displayHeight) {
                        cursor = 'move';
                    }
                } else { // No selected item or not hovering over its handle
                    const items = this.imageBoard.getAllItems();
                    for (const item of items) {
                        if (!item.visible) continue; // Don't allow interaction with hidden items
                        let itemXForHover = item.x;
                        let itemYForHover = item.y;
                        let itemWidthForHover = item.width;
                        let itemHeightForHover = item.height;
                        
                        // Adjust for text item approximate bounds for accurate hover detection
                        if (item.type === 'text') {
                            const canvas = document.getElementById('viewport');
                            const ctx = canvas.getContext('2d');
                            ctx.font = `${item.fontSize}px ${item.fontFamily}`;
                            itemWidthForHover = ctx.measureText(item.content).width; 
                            itemHeightForHover = item.fontSize * 1.2; 
                            itemYForHover = item.y - item.fontSize; // Adjust item.y for hover detection (top of text)
                        } else if (item.type === 'image' && item.crop) {
                             const aspectRatio = item.crop.width / item.crop.height;
                             if (item.crop.width > item.crop.height) {
                                itemWidthForHover = item.width;
                                itemHeightForHover = itemWidthForHover / aspectRatio;
                            } else {
                                itemHeightForHover = item.height;
                                itemWidthForHover = itemHeightForHover * aspectRatio;
                            }
                        }

                        if (worldX >= itemXForHover && worldX <= itemXForHover + itemWidthForHover &&
                            worldY >= itemYForHover && worldY <= itemYForHover + itemHeightForHover) {
                            cursor = 'pointer'; // Indicate draggable/selectable item
                            break;
                        }
                    }
                }
            }
            document.getElementById('viewport').style.cursor = cursor;
        } else if (this.isCropping && selectedItem && selectedItem.type === 'image') {
            // When in cropping mode, if not dragging, determine hover cursor for handles
            const imageXOnBoard = selectedItem.x;
            const imageYOnBoard = selectedItem.y;
            
            let displayWidth = selectedItem.width;
            let displayHeight = selectedItem.height;
            if (selectedItem.crop) {
                const aspectRatio = selectedItem.crop.width / selectedItem.crop.height;
                if (selectedItem.crop.width > selectedItem.crop.height) {
                    displayWidth = selectedItem.width;
                    displayHeight = displayWidth / aspectRatio;
                } else {
                    displayHeight = selectedItem.height;
                    displayWidth = displayHeight * aspectRatio;
                }
            }

            const handleDetectionSize = 10;
            const handleRadiusOnBoard = handleDetectionSize / this.imageBoard.zoom; // Use imageBoard's zoom
            
            // Current crop rect in board coordinates
            const scaleX = displayWidth / selectedItem.originalWidth; // Scale from original to displayed
            const scaleY = displayHeight / selectedItem.originalHeight; // Scale from original to displayed

            const cropXOnBoard = imageXOnBoard + this.cropRect.x * scaleX;
            const cropYOnBoard = imageYOnBoard + this.cropRect.y * scaleY;
            const cropWidthOnBoard = this.cropRect.width * scaleX;
            const cropHeightOnBoard = this.cropRect.height * scaleY;
            
            const handles = {
                nw: { x: cropXOnBoard, y: cropYOnBoard, cursor: 'nwse-resize' },
                ne: { x: cropXOnBoard + cropWidthOnBoard, y: cropYOnBoard, cursor: 'nesw-resize' },
                sw: { x: cropXOnBoard, y: cropYOnBoard + cropHeightOnBoard, cursor: 'nesw-resize' },
                se: { x: cropXOnBoard + cropWidthOnBoard, y: cropYOnBoard + cropHeightOnBoard, cursor: 'nwse-resize' }
            };

            let handleHovered = false;
            for (const key in handles) {
                const handle = handles[key];
                const dist = Math.sqrt(Math.pow(worldX - handle.x, 2) + Math.pow(worldY - handle.y, 2));
                if (dist <= handleRadiusOnBoard) {
                    document.getElementById('viewport').style.cursor = handle.cursor;
                    handleHovered = true;
                    break;
                }
            }
            
            if (!handleHovered) {
                // Check if hovering inside the crop rectangle to show 'move' cursor
                const mouseXInImageBoardSpace = worldX - imageXOnBoard;
                const mouseYInImageBoardSpace = worldY - imageYOnBoard;
                
                const scaleXOriginalToDisplay = selectedItem.originalWidth / displayWidth;
                const scaleYOriginalToDisplay = selectedItem.originalHeight / displayHeight;
                const mouseXInOriginalImage = mouseXInImageBoardSpace * scaleXOriginalToDisplay;
                const mouseYInOriginalImage = mouseYInImageBoardSpace * scaleYOriginalToDisplay;

                if (mouseXInOriginalImage >= this.cropRect.x && mouseXInOriginalImage <= this.cropRect.x + this.cropRect.width &&
                    mouseYInOriginalImage >= this.cropRect.y && mouseYInOriginalImage <= this.cropRect.y + this.cropRect.height) {
                    document.getElementById('viewport').style.cursor = 'grab';
                } else {
                    document.getElementById('viewport').style.cursor = 'crosshair'; // Default crop cursor
                }
            }
        }
    }
    
    handleMouseUp() {
        if (this.isMovingItem || this.isResizingItem) {
            this.imageBoard.saveState(); // Save state after move/resize operation
            this.isMovingItem = false;
            this.isResizingItem = false;
        }

        if (this.isMovingCutRegion) {
            // This is no longer used, cut region is fixed
            this.isMovingCutRegion = false;
        }

        // CUT MODE: Finalize lasso shape on mouse up
        if (this.isCutMode && this.isLassoDrawing && this.isLassoDrawingShape) {
            this.isLassoDrawingShape = false;
            if (this.currentLassoPath.length > 2) {
                this.lassoShapes.push(this.currentLassoPath);
            }
            this.currentLassoPath = []; // Clear for next shape
            this.render();
        }
        
        // If a crop drag operation just finished, reset the drag mode
        if (this.isCropping && this.cropDragMode) {
            this.cropDragMode = null;
        }

        this.isPanning = false;
        
        // Reset cursor based on current mode
        if (this.isSpacePressed) {
            document.getElementById('viewport').style.cursor = 'grab';
        } else if (this.isCropping) {
            document.getElementById('viewport').style.cursor = 'crosshair';
        } else if (this.isCutMode) {
            if (this.isLassoDrawing) {
                document.getElementById('viewport').style.cursor = 'crosshair';
            } else {
                document.getElementById('viewport').style.cursor = 'move'; // Default to move to indicate pan is possible
            }
        } else {
            document.getElementById('viewport').style.cursor = 'default';
        }
    }
    
    importImages() {
        document.getElementById('fileInput').click();
    }
    
    async handleImageImport(event) {
        const files = Array.from(event.target.files);
        const images = await this.fileManager.importImages(files);
        
        for (const image of images) {
            this.inventory.push(image);
        }
        
        this.renderInventory(); // Update inventory UI
    }
    
    addText() {
        const text = prompt('Enter text:');
        if (text) {
            const textItem = this.textTool.createText(text, 100, 100);
            const id = this.imageBoard.addText(textItem);
            this.layerManager.addLayer(this.imageBoard.getItem(id)); // Get the full item with ID
            this.imageBoard.selectItem(id); // Select the newly added text
            this.render();
        }
    }
    
    zoomIn() {
        this.imageBoard.zoom = Math.min(this.imageBoard.zoom * 1.2, 5);
        this.updateZoomDisplay();
        this.render();
    }
    
    zoomOut() {
        this.imageBoard.zoom = Math.max(this.imageBoard.zoom / 1.2, 0.1);
        this.updateZoomDisplay();
        this.render();
    }
    
    updateZoomDisplay() {
        document.getElementById('zoomLevel').textContent = Math.round(this.imageBoard.zoom * 100) + '%';
    }
    
    renderInventory() {
        // Only update if the container exists
        if (!this.inventoryGridContainer) return;

        this.inventoryGridContainer.innerHTML = ''; // Clear and re-render for simplicity now

        this.inventory.forEach((image, index) => {
            const item = document.createElement('div');
            item.className = 'inventory-item';
            item.dataset.index = index;
            
            item.innerHTML = `
                <img src="${image.thumbnail}" alt="${image.file}" draggable="true">
                <div class="inventory-info">
                    <span class="inventory-name">${image.file}</span>
                    <button class="add-btn">+ Add to Board</button>
                </div>
            `;
            
            this.inventoryGridContainer.appendChild(item);
        });
    }
    
    addImageToBoard(imageData) {
        const id = this.imageBoard.addImage(imageData);
        this.layerManager.addLayer(this.imageBoard.getItem(id)); // Get the full item with ID, including new zIndex/visible
        this.imageBoard.selectItem(id); // Select the newly added image
        this.render();
    }
    
    clearInventory() {
        this.inventory = [];
        this.renderInventory();
    }
    
    handleKeyDown(e) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            const selected = this.imageBoard.getSelected();
            if (selected) {
                this.imageBoard.removeItem(selected.id);
                this.layerManager.removeLayer(selected.id);
                this.render();
            }
        }
        
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'z':
                    if (e.shiftKey) {
                        this.imageBoard.redo();
                    } else {
                        this.imageBoard.undo();
                    }
                    this.render();
                    break;
                case 's':
                    e.preventDefault();
                    this.saveBoard();
                    break;
                case 'o':
                    e.preventDefault();
                    this.loadBoard();
                    break;
                case 'c': // Ctrl+C to copy item, though not requested, good for future
                    e.preventDefault();
                    if (this.isCropping) {
                        this.toggleCropMode(); // Exit crop mode and apply crop
                    }
                    break;
            }
        }
    }
    
    saveBoard() {
        const appState = {
            cutRegion: { 
                width: this.cutRegion.width,
                height: this.cutRegion.height
            },
            lassoShapes: this.lassoShapes
        };
        const data = this.fileManager.serialize(this.imageBoard, this.layerManager, appState);
        this.fileManager.saveBoard(data);
    }
    
    loadBoard() {
        document.getElementById('loadFileInput').click();
    }
    
    async handleBoardLoad(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const data = await this.fileManager.loadBoard(file);
        
        // Restore items and link them to LayerManager items
        const restoredItemsMap = new Map();
        const promises = data.images.map(itemData => {
            return new Promise(resolve => {
                if (itemData.type === 'image' && itemData.dataUrl) {
                    const img = new Image();
                    img.onload = () => {
                        itemData.element = img;
                        // Ensure zIndex and visible are present, default if not
                        if (itemData.zIndex === undefined) itemData.zIndex = 0;
                        if (itemData.visible === undefined) itemData.visible = true;
                        restoredItemsMap.set(itemData.id, itemData);
                        resolve();
                    };
                    img.src = itemData.dataUrl;
                } else {
                    // For text items or non-dataUrl images, directly add
                    if (itemData.zIndex === undefined) itemData.zIndex = 0;
                    if (itemData.visible === undefined) itemData.visible = true;
                    restoredItemsMap.set(itemData.id, itemData);
                    resolve();
                }
            });
        });

        await Promise.all(promises);

        // Load data into ImageBoard
        this.imageBoard.loadData(Array.from(restoredItemsMap.values())); 
        
        // Load data into LayerManager, ensuring it references the restored items
        const restoredLayers = data.layers.map(layerData => {
            const correspondingItem = restoredItemsMap.get(layerData.id);
            if (correspondingItem) {
                layerData.item = correspondingItem; // Link the layer entry to the actual item
                // Ensure layer list also has correct visibility and zIndex
                if (layerData.visible === undefined) layerData.visible = correspondingItem.visible;
                if (layerData.zIndex === undefined) layerData.zIndex = correspondingItem.zIndex;
            }
            return layerData;
        }).filter(layer => layer.item); // Filter out layers whose items didn't load

        this.layerManager.loadData(restoredLayers);

        // Restore Cut Mode State
        if (data.cutModeState) {
            this.cutRegion.x = 0; // Will be recalculated by setupCutRegionPosition
            this.cutRegion.y = 0; // Will be recalculated by setupCutRegionPosition
            
            // Handle loading old 'size' format or new 'width/height' format
            if (data.cutModeState.cutRegion) {
                if (data.cutModeState.cutRegion.size) {
                    this.cutRegion.width = data.cutModeState.cutRegion.size;
                    this.cutRegion.height = data.cutModeState.cutRegion.size;
                } else {
                    this.cutRegion.width = data.cutModeState.cutRegion.width || 256;
                    this.cutRegion.height = data.cutModeState.cutRegion.height || 256;
                }
            } else {
                this.cutRegion.width = 256;
                this.cutRegion.height = 256;
            }
            
            this.lassoShapes = data.cutModeState.lassoShapes || [];
            
            // After loading, ensure cutRegion is centered relative to current canvas size
            this.setupCutRegionPosition();
            this.syncCutModeInputs();
        }

        // Restore zoom level
        this.zoom = this.imageBoard.zoom;
        this.updateZoomDisplay();

        this.imageBoard.saveState(); // Save the loaded state to history
        this.render();
    }

    showExportModal() {
        const modal = document.getElementById('exportModal');
        const exportWidthInput = document.getElementById('exportWidth');
        const exportHeightInput = document.getElementById('exportHeight');
        const lockAspectRatioCheckbox = document.getElementById('lockAspectRatio');
        const scaleRadios = document.querySelectorAll('input[name="exportScale"]');
        const exportWithAlphaCheckbox = document.getElementById('exportWithAlpha'); // New: get checkbox

        // Reset to default scale
        scaleRadios.forEach(radio => {
            if (radio.value === '1') {
                radio.checked = true;
            } else {
                radio.checked = false;
            }
        });
        this.currentExportScale = 1;

        // Set default values to current canvas dimensions
        this.initialExportWidth = this.canvas.width;
        this.initialExportHeight = this.canvas.height;
        this.exportAspectRatio = this.initialExportWidth / this.initialExportHeight;

        exportWidthInput.value = this.initialExportWidth;
        exportHeightInput.value = this.initialExportHeight;
        
        lockAspectRatioCheckbox.checked = true; // Default to locked aspect ratio
        exportWithAlphaCheckbox.checked = false; // New: Default to no transparency
        this.exportWithAlpha = false; // Sync internal state
        
        const bgColorGroup = document.getElementById('exportBgColorGroup');
        bgColorGroup.classList.remove('hidden');
        document.getElementById('exportBgColor').value = '#0a0a0a'; // Default to dark background

        modal.classList.remove('hidden');
    }

    hideExportModal() {
        document.getElementById('exportModal').classList.add('hidden');
    }

    applyExportScale() {
        const exportWidthInput = document.getElementById('exportWidth');
        const exportHeightInput = document.getElementById('exportHeight');
        const lockAspectRatioCheckbox = document.getElementById('lockAspectRatio');
        const minVal = 1; // Changed from 100 to 1

        let newWidth = Math.round(this.initialExportWidth * this.currentExportScale);
        let newHeight = Math.round(this.initialExportHeight * this.currentExportScale);

        // Ensure minimum values
        newWidth = Math.max(newWidth, minVal);
        newHeight = Math.max(newHeight, minVal);

        exportWidthInput.value = newWidth;
        exportHeightInput.value = newHeight;

        // If aspect ratio is locked, make sure values are consistent after scale application
        if (lockAspectRatioCheckbox.checked) {
            // Re-adjust based on width to be safe, using the new scaled width
            exportHeightInput.value = Math.round(newWidth / this.exportAspectRatio);
            // Re-check for minimum height
            if (parseInt(exportHeightInput.value) < minVal) {
                exportHeightInput.value = minVal;
                exportWidthInput.value = Math.round(minVal * this.exportAspectRatio);
            }
        }
    }

    adjustExportDimensions(sourceInputId) {
        const exportWidthInput = document.getElementById('exportWidth');
        const exportHeightInput = document.getElementById('exportHeight');
        const lockAspectRatioCheckbox = document.getElementById('lockAspectRatio');
        const minVal = 1; // Changed from 100 to 1

        let width = parseInt(exportWidthInput.value);
        let height = parseInt(exportHeightInput.value);

        if (isNaN(width)) width = minVal;
        if (isNaN(height)) height = minVal;

        width = Math.max(width, minVal);
        height = Math.max(height, minVal);

        if (lockAspectRatioCheckbox.checked) {
            if (sourceInputId === 'exportWidth') {
                height = Math.round(width / this.exportAspectRatio);
            } else { // sourceInputId === 'exportHeight'
                width = Math.round(height * this.exportAspectRatio);
            }
            // Re-check minimums after ratio adjustment
            width = Math.max(width, minVal);
            height = Math.max(height, minVal);
        }
        
        exportWidthInput.value = width;
        exportHeightInput.value = height;
    }

    handleExportConfirm() {
        const width = parseInt(document.getElementById('exportWidth').value);
        const height = parseInt(document.getElementById('exportHeight').value);

        if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
            alert('Please enter valid positive numbers for width and height.');
            return;
        }

        this.exportAsPNG(width, height);
        this.hideExportModal();
    }

    exportAsPNG(outputWidth, outputHeight) {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        tempCanvas.width = outputWidth;
        tempCanvas.height = outputHeight;

        // Fill background only if not exporting with alpha
        if (!this.exportWithAlpha) {
            const bgColor = document.getElementById('exportBgColor').value;
            tempCtx.fillStyle = bgColor; 
            tempCtx.fillRect(0, 0, outputWidth, outputHeight);
        } else {
            // Clear to transparent if exporting with alpha
            tempCtx.clearRect(0, 0, outputWidth, outputHeight);
        }
        
        // Calculate the overall scaling factor required to fit the current viewport
        // onto the new export canvas dimensions.
        const scaleX = outputWidth / this.canvas.width;
        const scaleY = outputHeight / this.canvas.height;
        
        // Apply the combined transformations: current board zoom/pan, scaled by export factor
        tempCtx.save();
        tempCtx.scale(this.imageBoard.zoom * scaleX, this.imageBoard.zoom * scaleY);
        tempCtx.translate(this.imageBoard.panX, this.imageBoard.panY);

        // Render all visible items to the temporary canvas
        const items = this.imageBoard.getAllItems();
        const sortedItems = [...items].sort((a,b) => (a.zIndex || 0) - (b.zIndex || 0)); 
        
        for (const item of sortedItems) {
            if (!item.visible) continue;

            if (item.type === 'image') {
                this.renderImage(tempCtx, item);
            } else if (item.type === 'text') {
                this.renderText(tempCtx, item);
            }
        }
        tempCtx.restore(); // Restore context state

        // Trigger download
        const dataURL = tempCanvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataURL;
        a.download = `image-board-export-${Date.now()}.png`;
        document.body.appendChild(a); // Append to body to make it clickable
        a.click();
        document.body.removeChild(a); // Clean up
        
        // Clean up temporary canvas
        tempCanvas.remove();
    }

    exportCutRegion() {
        if (!this.isCutMode) return;
        
        const outputWidth = this.cutRegion.width;
        const outputHeight = this.cutRegion.height;
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        tempCanvas.width = outputWidth;
        tempCanvas.height = outputHeight;

        // The background is always black in Cut Mode export
        tempCtx.fillStyle = '#000000';
        tempCtx.fillRect(0, 0, outputWidth, outputHeight);
        
        // 1. Calculate the fixed center position on the current canvas
        // We use the already calculated cutRegion.x/y
        const cutX = this.cutRegion.x;
        const cutY = this.cutRegion.y;
        
        // 2. Determine the World Coordinates (board space) that correspond to the top-left corner of the fixed cut region.
        // WorldX = (CanvasX / Zoom) - PanX
        const worldXStart = (cutX / this.imageBoard.zoom) - this.imageBoard.panX;
        const worldYStart = (cutY / this.imageBoard.zoom) - this.imageBoard.panY;
        
        // 3. Calculate the required scaling factor for this export.
        const exportScale = this.imageBoard.zoom;
        
        tempCtx.save();
        
        // Apply transformation: Scale by current zoom level
        tempCtx.scale(exportScale, exportScale);
        
        // Translate the context so that the (worldXStart, worldYStart) lands on (0, 0) of the temporary canvas.
        tempCtx.translate(-worldXStart, -worldYStart);

        // Render all visible items to the temporary canvas
        const items = this.imageBoard.getAllItems();
        const sortedItems = [...items].sort((a,b) => (a.zIndex || 0) - (b.zIndex || 0)); 
        
        for (const item of sortedItems) {
            if (!item.visible) continue;

            // Simple visibility check based on the target world bounding box 
            // is omitted here for simplicity, but could be added for performance.
            // Since we're drawing the whole world, only the area within the cut will be visible on the 256x256 canvas.

            if (item.type === 'image') {
                this.renderImage(tempCtx, item);
            } else if (item.type === 'text') {
                this.renderText(tempCtx, item);
            }
        }
        
        // 4. Draw the black lasso shapes on top of the rendered image data
        tempCtx.fillStyle = '#000000';
        this.lassoShapes.forEach(shape => {
            tempCtx.beginPath();
            shape.forEach((point, index) => {
                if (index === 0) {
                    tempCtx.moveTo(point.x, point.y);
                } else {
                    tempCtx.lineTo(point.x, point.y);
                }
            });
            tempCtx.closePath();
            tempCtx.fill();
        });
        
        tempCtx.restore(); // Restore context state (undoing export scale and translation)

        // Trigger download
        const dataURL = tempCanvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataURL;
        a.download = `image-board-cut-snapshot-${Date.now()}.png`;
        document.body.appendChild(a); // Append to body to make it clickable
        a.click();
        document.body.removeChild(a); // Clean up
        
        // Clean up temporary canvas
        tempCanvas.remove();
    }

    // Helper to check if an item is currently visible in the canvas viewport
    checkIfItemIsVisible(item, ctx) {
        let itemWorldX = item.x;
        let itemWorldY = item.y;
        let itemWorldWidth = item.width;
        let itemWorldHeight = item.height;

        // Adjust for image crop dimensions for visibility check
        if (item.type === 'image' && item.crop) {
            const aspectRatio = item.crop.width / item.crop.height;
            if (item.crop.width > item.crop.height) {
                itemWorldWidth = item.width;
                itemWorldHeight = itemWorldWidth / aspectRatio;
            } else {
                itemWorldHeight = item.height;
                itemWorldWidth = itemWorldHeight * aspectRatio;
            }
        } else if (item.type === 'text') {
            // For text, get actual rendered dimensions
            ctx.save(); // Save context state before changing font
            ctx.font = `${item.fontSize}px ${item.fontFamily}`;
            itemWorldWidth = ctx.measureText(item.content).width;
            itemWorldHeight = item.fontSize * 1.2; // Approximate text height
            ctx.restore(); // Restore context state
            itemWorldY = item.y - item.fontSize; // Text Y is baseline, adjust to top
        }

        // Convert item's world coordinates and dimensions to canvas coordinates and dimensions
        const itemCanvasX = (itemWorldX + this.imageBoard.panX) * this.imageBoard.zoom;
        const itemCanvasY = (itemWorldY + this.imageBoard.panY) * this.imageBoard.zoom;
        const itemCanvasWidth = itemWorldWidth * this.imageBoard.zoom;
        const itemCanvasHeight = itemWorldHeight * this.imageBoard.zoom;

        const canvasViewRect = {
            x: 0,
            y: 0,
            width: this.canvas.width,
            height: this.canvas.height
        };

        // Check for intersection:
        // Item's right edge is to the left of canvas's left edge
        // OR Item's left edge is to the right of canvas's right edge
        // OR Item's bottom edge is above canvas's top edge
        // OR Item's top edge is below canvas's bottom edge
        if (itemCanvasX + itemCanvasWidth < canvasViewRect.x ||
            itemCanvasX > canvasViewRect.x + canvasViewRect.width ||
            itemCanvasY + itemCanvasHeight < canvasViewRect.y ||
            itemCanvasY > canvasViewRect.y + canvasViewRect.height) {
            return false; // No intersection, item is outside view
        }
        return true; // Item is visible
    }
    
    render() {
        const ctx = this.canvas.getContext('2d');
        
        // Fill the background of the main canvas
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Apply zoom and pan
        ctx.save();
        ctx.scale(this.imageBoard.zoom, this.imageBoard.zoom); // Use imageBoard's zoom
        ctx.translate(this.imageBoard.panX, this.imageBoard.panY);
        
        // Render all items
        const items = this.imageBoard.getAllItems();
        // Sort items by Z-index for rendering, lowest first (drawn first, so higher zIndex appears on top)
        const sortedItems = [...items].sort((a,b) => (a.zIndex || 0) - (b.zIndex || 0)); 
        
        for (const item of sortedItems) {
            // Optimization: Only render items that are visible within the current viewport
            if (!item.visible || !this.checkIfItemIsVisible(item, ctx)) continue; 

            if (item.type === 'image') {
                this.renderImage(ctx, item);
            } else if (item.type === 'text') {
                this.renderText(ctx, item);
            }
        }
        
        // Render Cut Mode Overlay and Shapes
        if (this.isCutMode) {
            // Lasso shapes need to be drawn *before* we undo the transform, 
            // but the overlay mask needs to be drawn *after* we undo it.
            this.renderLassoShapes(ctx);
            this.renderCutModeOverlay(ctx); // This function handles restoring/saving context for overlay drawing
        }

        ctx.restore();
    }
    
    // New function to render lasso shapes in world coordinates
    renderLassoShapes(ctx) {
        ctx.fillStyle = '#000000';
        this.lassoShapes.forEach(shape => {
            ctx.beginPath();
            shape.forEach((point, index) => {
                if (index === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            });
            ctx.closePath();
            ctx.fill();
        });

        // Draw the currently drawing lasso path
        if (this.isLassoDrawing && this.isLassoDrawingShape && this.currentLassoPath.length > 0) {
            ctx.strokeStyle = '#ff4757';
            ctx.lineWidth = 2 / this.imageBoard.zoom; // Keep constant visual width
            ctx.beginPath();
            this.currentLassoPath.forEach((point, index) => {
                if (index === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            });
            ctx.stroke();
        }
    }

    // Renders the fixed cut region box and the black overlay mask
    renderCutModeOverlay(ctx) {
        // Must be called *after* world content (including items and lasso shapes) have been drawn 
        // but *before* the main ctx.restore() to draw in screen space.
        
        // Undo pan/zoom to draw overlay in screen space
        ctx.restore(); 
        
        const cutWidth = this.cutRegion.width;
        const cutHeight = this.cutRegion.height;
        const cutX = this.cutRegion.x;
        const cutY = this.cutRegion.y;
        
        // 1. Draw the surrounding dark overlay (mask)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.canvas.width, cutY); // Top
        ctx.fillRect(0, cutY + cutHeight, this.canvas.width, this.canvas.height - (cutY + cutHeight)); // Bottom
        ctx.fillRect(0, cutY, cutX, cutHeight); // Left
        ctx.fillRect(cutX + cutWidth, cutY, this.canvas.width - (cutX + cutWidth), cutHeight); // Right

        // 2. Draw the cut region highlight
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(cutX, cutY, cutWidth, cutHeight);
        ctx.setLineDash([]);
        
        // 3. Prepare for the original ctx.restore() caller
        ctx.save();
    }
    
    renderImage(ctx, image) {
        // Source rectangle (from original image)
        let sx = 0;
        let sy = 0;
        let sWidth = image.originalWidth;
        let sHeight = image.originalHeight;

        // Destination rectangle (on canvas board)
        let dx = image.x;
        let dy = image.y;
        let dWidth = image.width;
        let dHeight = image.height;

        // If a crop is applied to the image, use it for drawing the source
        if (image.crop) {
            sx = image.crop.x;
            sy = image.crop.y;
            sWidth = image.crop.width;
            sHeight = image.crop.height;

            // Calculate new display dimensions based on the cropped size
            const aspectRatio = sWidth / sHeight;
            if (sWidth > sHeight) {
                dWidth = image.width; // Use original display width as reference
                dHeight = dWidth / aspectRatio;
            } else {
                dHeight = image.height; // Use original display height as reference
                dWidth = dHeight * aspectRatio;
            }
        }
        
        ctx.drawImage(image.element, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
        
        // Draw selection border and resize handle if item is selected AND not in crop mode
        if (image.id === this.imageBoard.selectedId && !this.isCropping) {
            ctx.strokeStyle = '#667eea'; // Solid border for selected
            ctx.lineWidth = 2;
            ctx.setLineDash([]); // No dashes
            ctx.strokeRect(dx, dy, dWidth, dHeight);
            
            // Draw resize handle (bottom-right)
            ctx.fillStyle = '#667eea';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(dx + dWidth, dy + dHeight, 6, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        }

        // Draw crop overlay if in cropping mode AND this image is selected
        if (this.isCropping && image.id === this.imageBoard.selectedId) {
            // Calculate scale factors from original image to displayed board size
            const imageDisplayWidth = image.width;
            const imageDisplayHeight = image.height;

            // If a crop is applied, the displayed dimensions change
            let currentDisplayWidth = imageDisplayWidth;
            let currentDisplayHeight = imageDisplayHeight;
            if (image.crop) {
                const aspectRatio = image.crop.width / image.crop.height;
                if (image.crop.width > image.crop.height) {
                    currentDisplayWidth = imageDisplayWidth;
                    currentDisplayHeight = currentDisplayWidth / aspectRatio;
                } else {
                    currentDisplayHeight = image.height;
                    currentDisplayWidth = currentDisplayHeight * aspectRatio;
                }
            }

            const scaleX = currentDisplayWidth / image.originalWidth;
            const scaleY = currentDisplayHeight / image.originalHeight;

            // Calculate the crop rectangle's position and size in board coordinates
            const cropXOnBoard = dx + this.cropRect.x * scaleX;
            const cropYOnBoard = dy + this.cropRect.y * scaleY;
            const cropWidthOnBoard = this.cropRect.width * scaleX;
            const cropHeightOnBoard = this.cropRect.height * scaleY;
            
            // Draw a semi-transparent overlay outside the cropRect
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            // Top rect
            ctx.fillRect(dx, dy, currentDisplayWidth, cropYOnBoard - dy);
            // Bottom rect
            ctx.fillRect(dx, cropYOnBoard + cropHeightOnBoard, currentDisplayWidth, (dy + currentDisplayHeight) - (cropYOnBoard + cropHeightOnBoard));
            // Left rect
            ctx.fillRect(dx, cropYOnBoard, cropXOnBoard - dx, cropHeightOnBoard);
            // Right rect
            ctx.fillRect(cropXOnBoard + cropWidthOnBoard, cropYOnBoard, (dx + currentDisplayWidth) - (cropXOnBoard + cropWidthOnBoard), cropHeightOnBoard);
            
            // Draw the crop rectangle border
            ctx.strokeStyle = '#667eea';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]); // Dashed line
            ctx.strokeRect(cropXOnBoard, cropYOnBoard, cropWidthOnBoard, cropHeightOnBoard);

            // Draw handles
            const handleSize = 6;
            ctx.fillStyle = '#667eea';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 2;
            ctx.setLineDash([]); // Ensure no dashes for handles
            
            const handles = [
                { x: cropXOnBoard, y: cropYOnBoard }, // NW
                { x: cropXOnBoard + cropWidthOnBoard, y: cropYOnBoard }, // NE
                { x: cropXOnBoard, y: cropYOnBoard + cropHeightOnBoard }, // SW
                { x: cropXOnBoard + cropWidthOnBoard, y: cropYOnBoard + cropHeightOnBoard } // SE
            ];

            handles.forEach(h => {
                ctx.beginPath();
                ctx.arc(h.x, h.y, handleSize, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
            });
        }
    }
    
    renderText(ctx, text) {
        ctx.font = `${text.fontSize}px ${text.fontFamily}`;
        ctx.fillStyle = text.color;
        ctx.fillText(text.content, text.x, text.y);

        // Draw selection border for text if selected
        if (text.id === this.imageBoard.selectedId) {
            ctx.strokeStyle = '#667eea';
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            // Approximate bounding box for text selection
            const textWidth = ctx.measureText(text.content).width; // More accurate width
            const textHeight = text.fontSize * 1.2; // Approximate height including line spacing
            ctx.strokeRect(text.x, text.y - text.fontSize, textWidth, textHeight); // Adjust y to top of text
        }
    }
    
    setupInventoryEvents() {
        const inventoryGrid = document.getElementById('inventoryGrid');
        
        inventoryGrid.addEventListener('click', (e) => {
            const addBtn = e.target.closest('.add-btn');
            if (addBtn) {
                const imageItem = e.target.closest('.inventory-item');
                const imageData = this.inventory[parseInt(imageItem.dataset.index)];
                this.addImageToBoard(imageData);
            }
        });
        
        inventoryGrid.addEventListener('dragstart', (e) => {
            const imageItem = e.target.closest('.inventory-item');
            if (imageItem) {
                e.dataTransfer.setData('imageIndex', imageItem.dataset.index);
            }
        });

        document.getElementById('clearInventory').addEventListener('click', () => {
            this.clearInventory();
        });
    }
    
    deleteSelected() {
        const selected = this.imageBoard.getSelected();
        if (selected) {
            this.imageBoard.removeItem(selected.id);
            this.layerManager.removeLayer(selected.id); // Also remove from layer list
            this.render();
        }
    }
}

new App();
