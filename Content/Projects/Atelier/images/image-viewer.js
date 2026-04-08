class ImageViewerPanel {
    constructor(instanceId, app, canvasEngine) {
        this.app = app;
        this.canvasEngine = canvasEngine;
        this.instanceId = instanceId; // Unique ID for this viewer instance

        // Create the panel element dynamically
        this.panel = this.createPanelElement();
        document.body.appendChild(this.panel); // Append to body

        this.contentContainer = this.panel.querySelector('.panel-content');
        this.dragHandle = this.panel.querySelector('.panel-header'); // Drag handle is the whole header
        this.closeBtn = this.panel.querySelector('.panel-close-btn');
        this.pinBtn = this.panel.querySelector('.pin-btn'); // Select by class, not ID
        this.titleElement = this.panel.querySelector('.image-viewer-panel-title'); // Select by class, not ID

        this.viewerCanvas = null;
        this.viewerCtx = null;
        this.currentImage = null; // { id, name, dataUrl, width, height, imageElement }

        this.isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;

        this.isPinned = false;
        this.pinnedWorldX = 0;
        this.pinnedWorldY = 0;
        this.pinnedWorldWidth = 0; // NEW: Stored width in world units
        this.pinnedWorldHeight = 0; // NEW: Stored height in world units

        // --- New properties for internal pan/zoom ---
        this.imageViewport = { x: 0, y: 0, zoom: 1 };
        this.isPanningImage = false;
        this.lastPanPoint = { x: 0, y: 0 };
        // --- End new properties ---
        
        this.resizeObserver = null; // For handling manual panel resize

        // Use the same pixelRatio as the main canvas engine for consistency
        this.pixelRatio = this.canvasEngine.pixelRatio; // NEW

        // Unique storage key for this specific viewer instance
        this.STORAGE_KEY_VIEWER_POS = `imageViewerPosition-${this.instanceId}`;

        this.init();
    }

    createPanelElement() {
        const panel = document.createElement('div');
        panel.id = `image-viewer-panel-${this.instanceId}`; // Unique ID for the panel DOM element
        panel.className = 'draggable-panel hidden'; // Apply base styles

        // The inner HTML structure is largely the same, but element IDs are changed to classes
        // or made unique by appending instanceId if truly needed (not for this case).
        panel.innerHTML = `
            <div class="panel-header drag-handle">
                <span class="image-viewer-panel-title"></span>
                <button class="action-btn reset-view-btn" title="Reset View"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/></svg></button>
                <button class="action-btn pin-btn" title="Pin to Canvas"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17.5V3M6 8L12 3l6 5M12 17.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"></path></svg></button>
                <button class="panel-close-btn">&times;</button>
            </div>
            <div class="panel-content">
                <!-- Canvas will be inserted here by render() -->
            </div>
        `;
        return panel;
    }

    init() {
        this.render();
        this.attachListeners();
        // Reset viewport on init - this will use default canvas size until image is displayed
        this.resetImageViewport();

        // Load position and current image (if any)
        // Make loadPosition async to handle image loading before updating pinned state
        this.loadPosition().then(() => {
            // After loading, if pinned and currentImage exists, ensure correct position and size
            if (this.isPinned && this.currentImage) {
                this.updatePinnedPosition(this.canvasEngine.viewport);
            }
        });
    }

    render() {
        this.contentContainer.innerHTML = `
            <canvas id="image-viewer-canvas-${this.instanceId}"></canvas>
        `;
        this.viewerCanvas = this.contentContainer.querySelector(`#image-viewer-canvas-${this.instanceId}`);
        this.viewerCtx = this.viewerCanvas.getContext('2d', { willReadFrequently: true });
        this.viewerCtx.scale(this.pixelRatio, this.pixelRatio); // Apply pixel ratio scaling once
    }

    attachListeners() {
        // Draggable functionality - using bound functions for correct 'this' context
        this._boundStartDrag = this.startDrag.bind(this);
        this._boundDrag = this.drag.bind(this);
        this._boundEndDrag = this.endDrag.bind(this);

        this.dragHandle.addEventListener('mousedown', this._boundStartDrag);
        document.addEventListener('mousemove', this._boundDrag);
        document.addEventListener('mouseup', this._boundEndDrag);

        // Close button
        this.closeBtn.addEventListener('click', () => this.hide());

        // Pin button
        this.pinBtn.addEventListener('click', () => this.togglePin());

        // New: Reset View button
        this.panel.querySelector('.reset-view-btn').addEventListener('click', () => {
            // This button should reset the internal image view to fit its current panel size
            this.resetImageViewport(); // No arguments means use current offsetWidth/Height
            this.redrawImage();
        });

        // Add ResizeObserver to handle manual panel resizing and prevent distortion
        this.resizeObserver = new ResizeObserver(entries => {
            if (this.isPinned) return; // Don't run this logic when pinned, as it's handled by updatePinnedPosition

            for (const entry of entries) {
                // Use logical (CSS) pixels for calculations
                const newWidth = entry.contentRect.width;
                const newHeight = entry.contentRect.height;
                
                if (newWidth > 0 && newHeight > 0) {
                    this.onManualResize(newWidth, newHeight);
                }
            }
        });
        this.resizeObserver.observe(this.contentContainer);

        // Listen to main canvas viewport changes for pinned mode
        this.canvasEngine.canvas.addEventListener('viewportchange', (e) => {
            if (this.isPinned) {
                this.updatePinnedPosition(e.detail);
            }
        });

        // Eyedropper listener for this canvas
        this.viewerCanvas.addEventListener('mousemove', (e) => {
            if (this.app.isAltEyedropperActive && this.currentImage) {
                // Get mouse position relative to this viewer canvas
                const rect = this.viewerCanvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                const pickedColor = this.pickColor(mouseX, mouseY);
                if (pickedColor) {
                    const event = new CustomEvent('colorpicked', { detail: { color: pickedColor }, bubbles: true });
                    document.dispatchEvent(event); // Dispatch to document, app listens globally
                }
            }
        });
        // Prevent drawing on the viewer canvas
        this.viewerCanvas.addEventListener('mousedown', (e) => {
            // Prevent drawing only if not in eyedropper mode.
            // Alt-eyedropper mode is handled by a global listener in app.js
            if (!this.app.isAltEyedropperActive) {
                e.stopPropagation(); // Stop propagation to prevent main canvas drawing if mouse is over viewer
            }
            // Bring panel to front on any click inside
            this.app.bringPanelToFront(this.panel);
        });

        // Bring panel to front when drag handle is clicked
        this.dragHandle.addEventListener('mousedown', () => {
            this.app.bringPanelToFront(this.panel);
        });

        // --- New listeners for internal pan/zoom on the viewer canvas ---
        this.viewerCanvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.handleImageZoom(e);
        });

        this.viewerCanvas.addEventListener('mousedown', (e) => {
            // Prevent drawing only if not in eyedropper mode.
            if (!this.app.isAltEyedropperActive) {
                e.stopPropagation();
            }
             // Bring panel to front on any click inside
            this.app.bringPanelToFront(this.panel);

            // Left mouse button for panning the image inside
            if (e.button === 0) {
                this.isPanningImage = true;
                this.lastPanPoint = { x: e.clientX, y: e.clientY };
                this.viewerCanvas.style.cursor = 'grabbing';
            }
        });

        this.viewerCanvas.addEventListener('mousemove', (e) => {
            if (this.isPanningImage) {
                this.handleImagePan(e);
            }
        });

        const endImagePan = () => {
            if (this.isPanningImage) {
                this.isPanningImage = false;
                this.viewerCanvas.style.cursor = 'grab';
            }
        };

        this.viewerCanvas.addEventListener('mouseup', endImagePan);
        this.viewerCanvas.addEventListener('mouseleave', endImagePan);
        // --- End new listeners ---
    }

    onManualResize(newWidth, newHeight) {
        if (!this.viewerCanvas || !this.currentImage) return;

        // Store old center point
        const oldWidth = this.viewerCanvas.offsetWidth;
        const oldHeight = this.viewerCanvas.offsetHeight;
        if (oldWidth === 0 || oldHeight === 0) return; // Avoid division by zero on initial setup
        
        const oldCenterX = oldWidth / 2;
        const oldCenterY = oldHeight / 2;
        
        // Calculate what point on the image was at the old center
        const imagePointAtOldCenter_X = (oldCenterX - this.imageViewport.x) / this.imageViewport.zoom;
        const imagePointAtOldCenter_Y = (oldCenterY - this.imageViewport.y) / this.imageViewport.zoom;

        // Update canvas physical resolution
        this.viewerCanvas.width = newWidth * this.pixelRatio;
        this.viewerCanvas.height = newHeight * this.pixelRatio;
        // Update canvas logical size
        this.viewerCanvas.style.width = `${newWidth}px`;
        this.viewerCanvas.style.height = `${newHeight}px`;

        // Adjust pan to keep the same image point at the new center
        const newCenterX = newWidth / 2;
        const newCenterY = newHeight / 2;
        
        this.imageViewport.x = newCenterX - (imagePointAtOldCenter_X * this.imageViewport.zoom);
        this.imageViewport.y = newCenterY - (imagePointAtOldCenter_Y * this.imageViewport.zoom);

        this.redrawImage();
    }

    startDrag(e) {
        if (this.isPinned) {
            // If pinned and the user drags the header, unpin first
            this.togglePin();
        }
        this.isDragging = true;
        this.dragOffsetX = e.clientX - this.panel.getBoundingClientRect().left;
        this.dragOffsetY = e.clientY - this.panel.getBoundingClientRect().top;
        this.panel.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        // Set the viewer canvas cursor to grab by default
        this.viewerCanvas.style.cursor = 'grab';
    }

    drag(e) {
        if (!this.isDragging) return;

        let newX = e.clientX - this.dragOffsetX;
        let newY = e.clientY - this.dragOffsetY;

        const toolbar = document.getElementById('toolbar');
        const toolbarHeight = toolbar ? toolbar.offsetHeight : 0;

        newX = Math.max(0, Math.min(newX, window.innerWidth - this.panel.offsetWidth));
        newY = Math.max(toolbarHeight, Math.min(newY, window.innerHeight - this.panel.offsetHeight));

        this.panel.style.left = `${newX}px`;
        this.panel.style.top = `${newY}px`;
    }

    endDrag() {
        this.isDragging = false;
        this.panel.style.cursor = 'grab';
        document.body.style.userSelect = 'auto';
        this.savePosition();
    }

    async displayImage(imageData) {
        if (!imageData) {
            this.hide();
            return;
        }

        this.show();
        this.currentImage = { ...imageData };

        // Load image into an Image object first to get actual dimensions
        const img = new Image();
        img.src = imageData.dataUrl;

        await new Promise(resolve => {
            img.onload = () => {
                this.currentImage.imageElement = img; // Store for later use
                resolve();
            };
            img.onerror = () => {
                console.error("Failed to load image for viewer:", imageData);
                // No alert here, just console error for silent failure.
                this.hide();
                resolve(); // Resolve to not block
            };
        });

        if (!this.currentImage.imageElement) return;

        const imgNaturalWidth = this.currentImage.imageElement.naturalWidth;
        const imgNaturalHeight = this.currentImage.imageElement.naturalHeight;

        // Calculate initial logical (CSS) dimensions for the image viewer
        // This will be the base size if not pinned.
        let logicalDisplayWidth = imgNaturalWidth;
        let logicalDisplayHeight = imgNaturalHeight;

        // Apply a maximum logical size for the unpinned panel to prevent excessively large panels
        const maxLogicalPanelWidth = 600;
        const maxLogicalPanelHeight = 400;

        if (logicalDisplayWidth > maxLogicalPanelWidth || logicalDisplayHeight > maxLogicalPanelHeight) {
            const widthRatio = maxLogicalPanelWidth / logicalDisplayWidth;
            const heightRatio = maxLogicalPanelHeight / logicalDisplayHeight;
            const scale = Math.min(widthRatio, heightRatio);
            logicalDisplayWidth = imgNaturalWidth * scale;
            logicalDisplayHeight = imgNaturalHeight * scale;
        }
        
        logicalDisplayWidth = Math.round(logicalDisplayWidth);
        logicalDisplayHeight = Math.round(logicalDisplayHeight);

        // Set canvas physical pixels (width/height) and CSS logical pixels (style.width/height)
        this.viewerCanvas.width = logicalDisplayWidth * this.pixelRatio;
        this.viewerCanvas.height = logicalDisplayHeight * this.pixelRatio;
        this.viewerCanvas.style.width = `${logicalDisplayWidth}px`;
        this.viewerCanvas.style.height = `${logicalDisplayHeight}px`;

        // Adjust panel size to fit canvas + header + padding
        const panelPaddingTop = parseFloat(getComputedStyle(this.panel).paddingTop);
        const panelPaddingBottom = parseFloat(getComputedStyle(this.panel).paddingBottom);
        const panelPaddingLeft = parseFloat(getComputedStyle(this.panel).paddingLeft);
        const panelPaddingRight = parseFloat(getComputedStyle(this.panel).paddingRight);
        const headerHeight = this.dragHandle.offsetHeight; // The header element itself

        this.panel.style.width = `${logicalDisplayWidth + panelPaddingLeft + panelPaddingRight}px`;
        this.panel.style.height = `${logicalDisplayHeight + headerHeight + panelPaddingTop + panelPaddingBottom}px`;

        // Force a "reset view" update to ensure image is 'fit' inside the window perfectly.
        // Pass the calculated logical dimensions to ensure accurate fitting.
        this.resetImageViewport(logicalDisplayWidth, logicalDisplayHeight);
        this.redrawImage();

        // If pinned, the displayImage (re)calculates the base size. This update
        // ensures the pinned positioning and scaling are applied immediately.
        if (this.isPinned) {
            this.updatePinnedPosition(this.canvasEngine.viewport);
        } else {
            this.savePosition(); // Save new size/position if not pinned
        }
    }

    togglePin() {
        this.isPinned = !this.isPinned;
        this.pinBtn.classList.toggle('active', this.isPinned);
        this.panel.classList.toggle('pinned', this.isPinned);

        if (this.isPinned) {
            // When pinning, capture the current logical screen dimensions of the viewer canvas
            const currentLogicalScreenWidth = this.viewerCanvas.offsetWidth;
            const currentLogicalScreenHeight = this.viewerCanvas.offsetHeight;
            
            // Convert these screen dimensions to world dimensions at the *current zoom level*
            this.pinnedWorldWidth = currentLogicalScreenWidth / this.canvasEngine.viewport.zoom;
            this.pinnedWorldHeight = currentLogicalScreenHeight / this.canvasEngine.viewport.zoom;
            
            // Capture the current world coordinates of the viewer's top-left corner
            const panelRect = this.panel.getBoundingClientRect();
            const canvasRect = this.canvasEngine.canvas.getBoundingClientRect();
            
            // Calculate panel's top-left relative to main canvas *display area*
            // This accounts for the main canvas's actual position on screen
            const screenX = panelRect.left - canvasRect.left;
            const screenY = panelRect.top - canvasRect.top;

            // Convert screen coordinates to world coordinates.
            const worldPos = this.canvasEngine.screenToWorld(screenX, screenY);
            this.pinnedWorldX = worldPos.x;
            this.pinnedWorldY = worldPos.y;
            
            // Immediately update its position and size based on the current viewport
            this.updatePinnedPosition(this.canvasEngine.viewport);
        } else {
            // Restore normal draggable behavior and panel resizing for unpinned state
            this.panel.style.pointerEvents = 'auto'; // Re-enable pointer events for the whole panel
            // Revert to non-pinned display logic to set correct size/position
            if (this.currentImage) {
                this.displayImage(this.currentImage); // This will set the panel size back to unpinned max size
            }
            this.savePosition();
        }
    }

    updatePinnedPosition(viewport) {
        if (!this.isPinned || !this.currentImage || !this.panel || !this.currentImage.imageElement) return;

        // Calculate the new logical (CSS) screen dimensions for the image based on world size and current viewport zoom
        const newLogicalScreenWidth = this.pinnedWorldWidth * viewport.zoom;
        const newLogicalScreenHeight = this.pinnedWorldHeight * viewport.zoom;
        
        // Round to integers for comparison to avoid floating point issues causing constant redraws
        const roundedNewLogicalScreenWidth = Math.round(newLogicalScreenWidth);
        const roundedNewLogicalScreenHeight = Math.round(newLogicalScreenHeight);

        // Get the current rendered CSS dimensions of the canvas
        const currentLogicalCanvasWidth = Math.round(parseFloat(this.viewerCanvas.style.width));
        const currentLogicalCanvasHeight = Math.round(parseFloat(this.viewerCanvas.style.height));

        // Only redraw the physical canvas if its logical dimensions have changed significantly
        if (roundedNewLogicalScreenWidth !== currentLogicalCanvasWidth || roundedNewLogicalScreenHeight !== currentLogicalCanvasHeight) {
             // Store old center point to maintain view
            const oldCenterX = currentLogicalCanvasWidth / 2;
            const oldCenterY = currentLogicalCanvasHeight / 2;

            // Calculate what point on the image was at the old center
            const imagePointAtOldCenter_X = (oldCenterX - this.imageViewport.x) / this.imageViewport.zoom;
            const imagePointAtOldCenter_Y = (oldCenterY - this.imageViewport.y) / this.imageViewport.zoom;

            this.viewerCanvas.width = roundedNewLogicalScreenWidth * this.pixelRatio;
            this.viewerCanvas.height = roundedNewLogicalScreenHeight * this.pixelRatio;
            
            // Adjust pan to keep the same image point at the new center, preserving internal zoom.
            // Adjust newCenterX/Y by pixelRatio when calculating `imagePointAtOldCenter`
            const newCenterX = roundedNewLogicalScreenWidth / 2;
            const newCenterY = roundedNewLogicalScreenHeight / 2;

            this.imageViewport.x = newCenterX - (imagePointAtOldCenter_X * this.imageViewport.zoom);
            this.imageViewport.y = newCenterY - (imagePointAtOldCenter_Y * this.imageViewport.zoom);

            this.redrawImage();
        }

        // Always update the CSS style width/height for smooth resizing appearance
        this.viewerCanvas.style.width = `${roundedNewLogicalScreenWidth}px`;
        this.viewerCanvas.style.height = `${roundedNewLogicalScreenHeight}px`;

        // Adjust panel size to fit the newly scaled canvas plus header and padding
        const panelPaddingTop = parseFloat(getComputedStyle(this.panel).paddingTop);
        const panelPaddingBottom = parseFloat(getComputedStyle(this.panel).paddingBottom);
        const panelPaddingLeft = parseFloat(getComputedStyle(this.panel).paddingLeft);
        const panelPaddingRight = parseFloat(getComputedStyle(this.panel).paddingRight);
        const headerHeight = this.dragHandle.offsetHeight; // The header element itself

        this.panel.style.width = `${roundedNewLogicalScreenWidth + panelPaddingLeft + panelPaddingRight}px`;
        this.panel.style.height = `${roundedNewLogicalScreenHeight + headerHeight + panelPaddingTop + panelPaddingBottom}px`;

        // Calculate screen coordinates from pinned world coordinates, relative to canvas internal coordinate system
        const screenPos = this.canvasEngine.worldToScreen(this.pinnedWorldX, this.pinnedWorldY);
        
        const canvasRect = this.canvasEngine.canvas.getBoundingClientRect();
        
        let finalScreenX;
        let finalScreenY = screenPos.y + canvasRect.top;

        if (this.app.isMirroredX) {
            // When the main canvas is mirrored, the effective X coordinate on the screen
            // is mirrored relative to the canvas's center.
            // worldToScreen returns an X relative to the (0,0) of the *unmirrored* canvas viewport.
            // To get the mirrored screen position, we take the canvas's viewport width, subtract the non-mirrored screen X,
            // then add the canvas's physical left offset, and finally subtract the panel's own width to align its left edge.
            finalScreenX = (this.canvasEngine.viewport.width - screenPos.x) + canvasRect.left - this.panel.offsetWidth;
        } else {
            // If not mirrored, use the direct screen position.
            finalScreenX = screenPos.x + canvasRect.left;
        }

        this.panel.style.left = `${finalScreenX}px`;
        this.panel.style.top = `${finalScreenY}px`;
    }

    pickColor(localX, localY) {
        if (!this.viewerCanvas || !this.currentImage) return null;

        try {
            // Invert the viewport transformation to find image coordinates
            const imageX = (localX - this.imageViewport.x) / this.imageViewport.zoom;
            const imageY = (localY - this.imageViewport.y) / this.imageViewport.zoom;

            // Create a temporary canvas to pick color from original image data
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 1;
            tempCanvas.height = 1;
            const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

            tempCtx.drawImage(this.currentImage.imageElement, Math.floor(imageX), Math.floor(imageY), 1, 1, 0, 0, 1, 1);
            
            const imageData = tempCtx.getImageData(0, 0, 1, 1).data;
            if (imageData[3] === 0) { // Transparent
                return null;
            }
            return `#${('0' + imageData[0].toString(16)).slice(-2)}${('0' + imageData[1].toString(16)).slice(-2)}${('0' + imageData[2].toString(16)).slice(-2)}`;
        } catch (e) {
            console.error("Could not pick color from image viewer:", e);
            // This can happen due to CORS if image loaded from external source
            return null;
        }
    }

    savePosition() {
        const position = {
            left: this.panel.style.left,
            top: this.panel.style.top,
            width: this.panel.style.width,
            height: this.panel.style.height,
            isPinned: this.isPinned,
            pinnedWorldX: this.pinnedWorldX,
            pinnedWorldY: this.pinnedWorldY,
            pinnedWorldWidth: this.pinnedWorldWidth, // NEW
            pinnedWorldHeight: this.pinnedWorldHeight, // NEW
            currentImageId: this.currentImage ? this.currentImage.id : null,
            zIndex: this.panel.style.zIndex // Save z-index to restore stack order
        };
        localStorage.setItem(this.STORAGE_KEY_VIEWER_POS, JSON.stringify(position));
    }

    async loadPosition() {
        const savedPosition = localStorage.getItem(this.STORAGE_KEY_VIEWER_POS);
        const toolbar = document.getElementById('toolbar');
        const toolbarHeight = toolbar ? toolbar.offsetHeight : 0;

        if (savedPosition) {
            const position = JSON.parse(savedPosition);
            this.panel.style.left = position.left;
            // Ensure panel does not go above toolbar
            this.panel.style.top = `${Math.max(toolbarHeight, parseFloat(position.top))}px`;
            this.panel.style.width = position.width || '';
            this.panel.style.height = position.height || '';
            this.panel.style.zIndex = position.zIndex || this.app.nextZIndex; // Restore z-index

            this.isPinned = position.isPinned || false;
            this.pinnedWorldX = position.pinnedWorldX || 0;
            this.pinnedWorldY = position.pinnedWorldY || 0;
            this.pinnedWorldWidth = position.pinnedWorldWidth || 0; // NEW
            this.pinnedWorldHeight = position.pinnedWorldHeight || 0; // NEW
            
            this.pinBtn.classList.toggle('active', this.isPinned);
            this.panel.classList.toggle('pinned', this.isPinned);

            // Re-display the last viewed image if an ID was saved
            if (position.currentImageId) {
                const imgData = this.app.imageManager.getImageById(position.currentImageId);
                if (imgData) {
                    await this.displayImage(imgData); // Wait for image to load and display

                    // If it's pinned but loaded pinnedWorldWidth/Height are 0 (e.g., old data),
                    // re-calculate them from the currently displayed logical size.
                    // This relies on displayImage having already set viewerCanvas.style.width/height
                    // based on unpinned logic or default size.
                    if (this.isPinned && (this.pinnedWorldWidth === 0 || this.pinnedWorldHeight === 0)) {
                         this.pinnedWorldWidth = this.viewerCanvas.offsetWidth / this.canvasEngine.viewport.zoom;
                         this.pinnedWorldHeight = this.viewerCanvas.offsetHeight / this.canvasEngine.viewport.zoom;
                         // After recalculating, ensure updatePinnedPosition is called to apply the new size
                         this.updatePinnedPosition(this.canvasEngine.viewport);
                         this.savePosition(); // Save the newly calculated world dimensions
                    }
                } else {
                    // Image not found, hide this viewer and clear its saved data
                    this.hide();
                    localStorage.removeItem(this.STORAGE_KEY_VIEWER_POS);
                    console.warn(`Image for viewer ${this.instanceId} not found. Viewer closed and data cleared.`);
                }
            }
        } else {
            // Default position if not saved, e.g., top-right
            this.panel.style.right = '20px';
            this.panel.style.top = `${toolbarHeight + 20}px`;
            this.panel.style.left = 'auto'; // Ensure right is honored
            this.panel.style.zIndex = this.app.nextZIndex; // Assign initial z-index
            this.savePosition(); // Save this default position
        }
    }

    show() {
        this.panel.classList.remove('hidden');
        this.app.bringPanelToFront(this.panel); // Bring to front when shown
    }

    hide() {
        this.panel.classList.add('hidden');
        this.currentImage = null; // Clear the current image
        this.isPinned = false;
        this.pinBtn.classList.remove('active');
        this.panel.classList.remove('pinned');
        this.savePosition(); // Save state when closing
    }

    destroy() {
        // Remove event listeners
        this.dragHandle.removeEventListener('mousedown', this._boundStartDrag);
        document.removeEventListener('mousemove', this._boundDrag);
        document.removeEventListener('mouseup', this._boundEndDrag);
        this.closeBtn.removeEventListener('click', this.hide);
        this.pinBtn.removeEventListener('click', this.togglePin);
        
        // Disconnect the ResizeObserver
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        // We cannot remove canvasEngine's global viewportchange listener here,
        // it's a shared listener. The updatePinnedPosition will simply no-op
        // if this.panel is null.

        // Remove panel from DOM
        if (this.panel && this.panel.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
        }
        // Clear its saved position from local storage
        localStorage.removeItem(this.STORAGE_KEY_VIEWER_POS);

        // Nullify references to aid garbage collection
        this.panel = null;
        this.contentContainer = null;
        this.dragHandle = null;
        this.closeBtn = null;
        this.pinBtn = null;
        this.titleElement = null;
        this.viewerCanvas = null;
        this.viewerCtx = null;
        this.currentImage = null;
        this.app = null;
        this.canvasEngine = null;
    }

    // --- New Methods for Internal Pan/Zoom ---

    resetImageViewport(contentLogicalWidth = null, contentLogicalHeight = null) {
        if (!this.currentImage || !this.viewerCanvas) {
            this.imageViewport = { x: 0, y: 0, zoom: 1 };
            return;
        }

        // Use provided dimensions, or fallback to current canvas logical dimensions
        const canvasWidth = contentLogicalWidth !== null ? contentLogicalWidth : this.viewerCanvas.offsetWidth;
        const canvasHeight = contentLogicalHeight !== null ? contentLogicalHeight : this.viewerCanvas.offsetHeight;
        
        const imageWidth = this.currentImage.imageElement.naturalWidth;
        const imageHeight = this.currentImage.imageElement.naturalHeight;

        const zoomX = canvasWidth / imageWidth;
        const zoomY = canvasHeight / imageHeight;
        const initialZoom = Math.min(zoomX, zoomY);

        // Center the image
        const initialX = (canvasWidth - (imageWidth * initialZoom)) / 2;
        const initialY = (canvasHeight - (imageHeight * initialZoom)) / 2;

        this.imageViewport = {
            x: initialX,
            y: initialY,
            zoom: initialZoom
        };
    }

    handleImageZoom(e) {
        if (!this.currentImage) return;

        const rect = this.viewerCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate mouse position relative to the current viewport (already adjusted for pixelRatio by style)
        const mousePointX = (mouseX - this.imageViewport.x) / this.imageViewport.zoom;
        const mousePointY = (mouseY - this.imageViewport.y) / this.imageViewport.zoom;

        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.02, Math.min(50, this.imageViewport.zoom * zoomFactor));

        // Adjust pan to keep the point under the mouse stationary
        this.imageViewport.x = mouseX - mousePointX * newZoom;
        this.imageViewport.y = mouseY - mousePointY * newZoom;
        this.imageViewport.zoom = newZoom;

        this.redrawImage();
    }

    handleImagePan(e) {
        const deltaX = e.clientX - this.lastPanPoint.x;
        const deltaY = e.clientY - this.lastPanPoint.y;

        this.imageViewport.x += deltaX;
        this.imageViewport.y += deltaY;

        this.lastPanPoint = { x: e.clientX, y: e.clientY };

        this.redrawImage();
    }

    redrawImage() {
        if (!this.currentImage || !this.viewerCtx || !this.currentImage.imageElement) return;

        const ctx = this.viewerCtx;
        const canvas = this.viewerCanvas;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to identity
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Apply pixel ratio scale first to affect actual drawing
        ctx.scale(this.pixelRatio, this.pixelRatio);

        // Apply image viewport transformations (pan and zoom)
        ctx.translate(this.imageViewport.x, this.imageViewport.y);
        ctx.scale(this.imageViewport.zoom, this.imageViewport.zoom);

        // Draw the image
        ctx.drawImage(this.currentImage.imageElement, 0, 0);
        ctx.restore();
    }

    // --- End New Methods ---
}