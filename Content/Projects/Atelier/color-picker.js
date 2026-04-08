class ColorPicker {
    constructor(panelElementId, app) {
        this.app = app;
        this.panel = document.getElementById(panelElementId);
        this.contentContainer = this.panel.querySelector('.panel-content');
        this.dragHandle = this.panel.querySelector('.drag-handle');
        this.color = '#2c3e50';
        this.defaultSwatches = [
            '#2c3e50', '#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6',
            '#34495e', '#c0392b', '#f39c12', '#16a085', '#2980b9', '#8e44ad'
        ];
        this.userSwatches = []; // This will hold the actual palette colors
        this.activeSwatchIndex = 0; // Index of the currently active swatch in userSwatches

        this.STORAGE_KEY_PALETTE = 'atelier-color-palette';
        this.STORAGE_KEY_PANEL_POS = 'colorPickerPosition';

        this.isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;

        this.init();
    }

    init() {
        this.loadPalette(); // Load user-defined palette or use default
        this.render();
        this.attachListeners();
        this.loadPosition(); // Load saved panel position
        this.setColor(this.color); // Set initial color from app, this will also activate a swatch if matched
    }

    render() {
        if (!this.contentContainer) {
            console.error('Color picker content container not found!');
            return;
        }
        this.contentContainer.innerHTML = `
            <div id="main-color-picker-wrapper">
                <input type="color" id="main-color-picker" value="${this.color}">
            </div>
            <div id="color-palette">
                <!-- Swatches will be rendered by renderSwatches() -->
            </div>
            <button id="reset-palette-btn" class="action-btn" style="margin-top: 10px;">Reset Palette</button>
        `;
        this.renderSwatches(); // Call new method to populate swatches
    }

    renderSwatches() {
        const paletteContainer = this.contentContainer.querySelector('#color-palette');
        paletteContainer.innerHTML = this.userSwatches.map((color, index) => `
            <div class="color-swatch ${index === this.activeSwatchIndex ? 'active' : ''}" 
                 data-color="${color}" 
                 data-index="${index}" 
                 style="background-color: ${color};"></div>
        `).join('');
    }

    attachListeners() {
        // Color input change
        this.contentContainer.querySelector('#main-color-picker').addEventListener('input', (e) => {
            this.setColor(e.target.value);
        });

        // Event delegation for color swatches
        this.contentContainer.querySelector('#color-palette').addEventListener('click', (e) => {
            if (e.target.classList.contains('color-swatch')) {
                const newColor = e.target.dataset.color;
                this.activeSwatchIndex = parseInt(e.target.dataset.index); // Store the index
                this.setColor(newColor);
            }
        });

        // Reset palette button
        this.contentContainer.querySelector('#reset-palette-btn').addEventListener('click', () => {
            this.resetPalette();
        });

        // Draggable functionality
        this.dragHandle.addEventListener('mousedown', (e) => this.startDrag(e));
        // Use document for mousemove and mouseup to ensure drag continues even if mouse leaves panel
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.endDrag());

        // Prevent dragging when interacting with color picker or swatches
        this.contentContainer.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    startDrag(e) {
        this.isDragging = true;
        this.dragOffsetX = e.clientX - this.panel.getBoundingClientRect().left;
        this.dragOffsetY = e.clientY - this.panel.getBoundingClientRect().top;
        this.panel.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none'; // Prevent text selection during drag
    }

    drag(e) {
        if (!this.isDragging) return;

        let newX = e.clientX - this.dragOffsetX;
        let newY = e.clientY - this.dragOffsetY;

        const toolbar = document.getElementById('toolbar');
        const toolbarHeight = toolbar ? toolbar.offsetHeight : 0;
        
        // Keep panel within viewport bounds and below toolbar
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

    setColor(color) {
        if (!color) return;
        this.color = color;
        
        // Update the main color input if it exists
        const mainColorPicker = this.contentContainer.querySelector('#main-color-picker');
        if (mainColorPicker) {
            mainColorPicker.value = color;
        }
        
        this.updatePaletteAndActiveSwatch(color); // New method to handle palette logic
        
        // Dispatch a global event for other components to listen to
        const event = new CustomEvent('colorchange', { detail: { color: this.color } });
        document.dispatchEvent(event);
    }

    updatePaletteAndActiveSwatch(newColor) {
        let matchedIndex = -1;
        // Check if the new color already exists in the user palette
        for (let i = 0; i < this.userSwatches.length; i++) {
            if (this.userSwatches[i].toLowerCase() === newColor.toLowerCase()) {
                matchedIndex = i;
                break;
            }
        }

        if (matchedIndex !== -1) {
            this.activeSwatchIndex = matchedIndex;
        } else {
            // If the new color is NOT in the palette, replace the currently active one
            // Or the first one if no activeSwatchIndex is set (e.g., initial load or reset)
            const indexToReplace = this.activeSwatchIndex !== undefined && this.activeSwatchIndex !== null 
                                ? this.activeSwatchIndex 
                                : 0;
            this.userSwatches[indexToReplace] = newColor;
            this.activeSwatchIndex = indexToReplace;
            this.savePalette(); // Save changes to persistent storage
        }
        
        this.renderSwatches(); // Re-render to update active class and new color
    }

    loadPalette() {
        try {
            const storedPalette = localStorage.getItem(this.STORAGE_KEY_PALETTE);
            if (storedPalette) {
                this.userSwatches = JSON.parse(storedPalette);
            } else {
                this.userSwatches = [...this.defaultSwatches]; // Copy defaults
            }
        } catch (e) {
            console.error("Failed to load color palette from localStorage", e);
            this.userSwatches = [...this.defaultSwatches]; // Fallback to defaults
        }
        // Ensure activeSwatchIndex is valid. If somehow the loaded palette is empty
        // or the index is out of bounds, default to 0.
        if (this.userSwatches.length === 0) {
            this.userSwatches = [...this.defaultSwatches];
        }
        if (this.activeSwatchIndex === undefined || this.activeSwatchIndex >= this.userSwatches.length) {
            this.activeSwatchIndex = 0;
        }
    }

    savePalette() {
        try {
            localStorage.setItem(this.STORAGE_KEY_PALETTE, JSON.stringify(this.userSwatches));
        } catch (e) {
            console.error("Failed to save color palette to localStorage", e);
        }
    }

    resetPalette() {
        if (!confirm('Are you sure you want to reset the color palette to its default colors?')) {
            return;
        }
        this.userSwatches = [...this.defaultSwatches];
        this.savePalette();
        this.renderSwatches();
        this.setColor(this.userSwatches[0]); // Set first color as active after reset
    }

    savePosition() {
        const position = {
            left: this.panel.style.left,
            top: this.panel.style.top
        };
        localStorage.setItem(this.STORAGE_KEY_PANEL_POS, JSON.stringify(position));
    }

    loadPosition() {
        const savedPosition = localStorage.getItem(this.STORAGE_KEY_PANEL_POS);
        const toolbar = document.getElementById('toolbar');
        const toolbarHeight = toolbar ? toolbar.offsetHeight : 0;

        if (savedPosition) {
            const position = JSON.parse(savedPosition);
            this.panel.style.left = position.left;
            // Ensure panel does not go above toolbar
            this.panel.style.top = `${Math.max(toolbarHeight, parseFloat(position.top))}px`;
        } else {
            // Default position if not saved, e.g., top-right
            this.panel.style.top = `${toolbarHeight + 20}px`;
            this.panel.style.right = '20px';
            this.panel.style.left = 'auto'; // Ensure right is honored
        }
    }
}