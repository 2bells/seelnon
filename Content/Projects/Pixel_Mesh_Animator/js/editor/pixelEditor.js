import { defaultPixelEditorSettings } from './settings.js';

export default class PixelEditor {
  constructor() {
    this.canvas = document.getElementById('editorCanvas');
    this.overlayCanvas = document.getElementById('editorOverlay');
    this.ctx = this.canvas.getContext('2d');
    this.overlayCtx = this.overlayCanvas.getContext('2d');

    this.width = 32;
    this.height = 32;
    this.pixelSize = 10;
    this.zoomLevel = 1;
    this.showGrid = true; // Initial state

    this.currentTool = 'draw';
    this.currentColor = '#000000';
    this.previousColor = '#ffffff';
    this.brushSize = 1;

    this.isDrawing = false;
    this.lastPos = { x: 0, y: 0 };

    this.spriteData = null;
    this.frames = [];
    this.currentFrame = 0;

    this.undoStack = [];
    this.redoStack = [];
    this.usedColors = new Set(); // Track used colors

    this.showEditorBackground = false; // For custom editor background
    this.editorBackgroundColor = '#ffffff'; // Default custom background color
    this.referenceImage = null; // For underpainting/reference image
    this.referenceImageFrameCount = 1; // Number of frames in the reference image/spritesheet

    this.animationPlaying = false;
    this.animationInterval = null;
    this.animationFPS = 12; // Default 12 FPS

    // Onion skin settings
    this.onionSkinEnabled = defaultPixelEditorSettings.onionSkin.enabled;
    this.onionSkinMode = defaultPixelEditorSettings.onionSkin.mode; // 'previous' or 'next'
    this.onionSkinOpacity = defaultPixelEditorSettings.onionSkin.opacity;

    this.draggedFrameIndex = null; // For drag-and-drop reordering of frames

    this.initialPixelDataForUndo = null; // For pixel edit operations

    this.setupDefaultColors();
    this.setupCanvases();
    this.setupListeners(); // This will now append to the new toolbar
    this.setupSendToAnimateButton(); // This will also append to the new toolbar

    // Initialize button states
    this.updateGridButtonUI();
    this.updateEditorBackgroundButtonUI(); // Initialize background button state
  }

  setupCanvases() {
    // Set initial canvas size
    this.resizeCanvas();

    // Ensure pixelated rendering
    this.ctx.imageSmoothingEnabled = false;
    this.overlayCtx.imageSmoothingEnabled = false;

    // Add CSS to force pixelated rendering
    this.canvas.style.imageRendering = 'pixelated';
    this.overlayCanvas.style.imageRendering = 'pixelated';
  }

  resizeCanvas() {
    const container = document.querySelector('.editor-canvas-container');
    if (!container) {
        console.warn("Editor canvas container not found in resizeCanvas");
        return;
    }
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Calculate the base pixel size to fit the sprite in the container without zoom
    // this.width and this.height are the native dimensions of the sprite (e.g., 32x32)
    let baseFitPixelWidth = 10; // Default value
    if (this.width && containerWidth > 0) { // Check this.width to prevent division by zero or NaN
        baseFitPixelWidth = containerWidth / this.width;
    }
    
    let baseFitPixelHeight = 10; // Default value
    if (this.height && containerHeight > 0) { // Check this.height
        baseFitPixelHeight = containerHeight / this.height;
    }
    
    this.pixelSize = Math.min(baseFitPixelWidth, baseFitPixelHeight);
    // Ensure pixelSize is a sensible positive number
    if (!isFinite(this.pixelSize) || this.pixelSize <= 0) {
        this.pixelSize = 10; // Fallback to a default reasonable pixel size
    }
    
    // Apply zoom
    const scaledPixelSize = this.pixelSize * this.zoomLevel;
    
    const canvasDisplayWidth = this.width * scaledPixelSize;
    const canvasDisplayHeight = this.height * scaledPixelSize;

    // Update canvas backing store size (actual resolution of the canvas)
    this.canvas.width = canvasDisplayWidth;
    this.canvas.height = canvasDisplayHeight;
    this.overlayCanvas.width = canvasDisplayWidth;
    this.overlayCanvas.height = canvasDisplayHeight;
    
    // Update canvas CSS size (how it's displayed on the page)
    // These should typically match the backing store unless CSS scaling is intentionally used.
    this.canvas.style.width = canvasDisplayWidth + 'px';
    this.canvas.style.height = canvasDisplayHeight + 'px';
    this.overlayCanvas.style.width = canvasDisplayWidth + 'px';
    this.overlayCanvas.style.height = canvasDisplayHeight + 'px';

    // Position the canvas elements within the container
    // If canvas is larger than container, align to top-left for scrolling.
    // Otherwise, center it.
    if (canvasDisplayWidth <= containerWidth) {
      this.canvas.style.left = `${(containerWidth - canvasDisplayWidth) / 2}px`;
    } else {
      this.canvas.style.left = '0px';
    }
    this.overlayCanvas.style.left = this.canvas.style.left;

    if (canvasDisplayHeight <= containerHeight) {
      this.canvas.style.top = `${(containerHeight - canvasDisplayHeight) / 2}px`;
    } else {
      this.canvas.style.top = '0px';
    }
    this.overlayCanvas.style.top = this.canvas.style.top;
    
    // Ensure pixelated rendering settings
    this.ctx.imageSmoothingEnabled = false;
    this.overlayCtx.imageSmoothingEnabled = false;
    this.canvas.style.imageRendering = 'pixelated'; // CSS property
    this.overlayCanvas.style.imageRendering = 'pixelated';
    
    // Redraw everything with new sizes/scaling
    this.redraw();
    
    // Adjust scroll position of the container to center the view on the canvas content
    if (canvasDisplayWidth > containerWidth) {
      container.scrollLeft = (canvasDisplayWidth - containerWidth) / 2;
    } else {
      // If canvas is narrower than or same width as container, it's centered by 'left' style, so no horizontal scroll needed.
      container.scrollLeft = 0;
    }

    if (canvasDisplayHeight > containerHeight) {
      container.scrollTop = (canvasDisplayHeight - containerHeight) / 2;
    } else {
      // If canvas is shorter than or same height as container, it's centered by 'top' style, so no vertical scroll needed.
      container.scrollTop = 0;
    }
  }
  
  setupDefaultColors() {
    // Start with black and white as defaults
    this.colorPalette = ['#000000', '#ffffff'];
    this.updateColorPalette();
  }
  
  updateColorPalette() {
    const paletteEl = document.getElementById('colorPalette');
    paletteEl.innerHTML = '';
    
    Array.from(this.usedColors).forEach(color => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.style.backgroundColor = color;
      swatch.dataset.color = color;
      
      if (color === this.currentColor) {
        swatch.classList.add('active');
      }
      
      swatch.addEventListener('click', () => {
        this.setColor(color);
      });
      
      paletteEl.appendChild(swatch);
    });
  }
  
  setupListeners() {
    // Tool selection
    document.getElementById('drawTool').addEventListener('click', () => this.setTool('draw'));
    document.getElementById('eraseTool').addEventListener('click', () => this.setTool('erase'));
    document.getElementById('fillTool').addEventListener('click', () => this.setTool('fill'));
    document.getElementById('fillEraseTool').addEventListener('click', () => this.setTool('fillerase'));
    document.getElementById('eyedropperTool').addEventListener('click', () => this.setTool('eyedropper'));
    
    // Grid toggle 
    const toggleGridButton = document.getElementById('toggleGrid');
    if (toggleGridButton) {
        toggleGridButton.addEventListener('click', () => this.toggleGrid());
    } else {
        console.warn("toggleGridButton not found");
    }

    // Background toggle and color picker 
    const toggleEditorBackgroundButton = document.getElementById('toggleEditorBackground');
    if (toggleEditorBackgroundButton) {
        toggleEditorBackgroundButton.addEventListener('click', () => this.toggleEditorBackgroundView());
    } else {
        console.warn("toggleEditorBackgroundButton not found");
    }

    const editorBgColorPicker = document.getElementById('editorBackgroundColorPicker');
    if (editorBgColorPicker) {
        editorBgColorPicker.addEventListener('input', (e) => {
            this.editorBackgroundColor = e.target.value;
            if (this.showEditorBackground && !this.referenceImage) { // Only redraw if solid color bg is visible
                this.redraw();
            }
        });
         // Initialize picker value
        editorBgColorPicker.value = this.editorBackgroundColor;
    } else {
        console.warn("editorBackgroundColorPicker not found");
    }

    // Reference Image Upload
    const uploadReferenceImageBtn = document.getElementById('uploadReferenceImageBtn');
    const referenceImageUploadInput = document.getElementById('referenceImageUploadInput');
    const referenceImageFrameCountInput = document.getElementById('referenceImageFrameCountInput');

    if (uploadReferenceImageBtn && referenceImageUploadInput && referenceImageFrameCountInput) {
        uploadReferenceImageBtn.addEventListener('click', () => referenceImageUploadInput.click());
        referenceImageUploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.loadReferenceImage(file);
            }
            referenceImageUploadInput.value = ''; // Reset file input
        });
        referenceImageFrameCountInput.addEventListener('input', (e) => {
            const count = parseInt(e.target.value, 10);
            if (!isNaN(count) && count >= 1) {
                this.referenceImageFrameCount = count;
                if (this.referenceImage && this.showEditorBackground) {
                    this.redraw();
                }
            } else {
                // Reset to 1 if invalid input
                e.target.value = 1;
                this.referenceImageFrameCount = 1;
            }
        });

    } else {
        console.warn("Reference image upload elements not found.");
    }
    
    // Color picker
    const colorPicker = document.getElementById('colorPicker');
    colorPicker.addEventListener('input', (e) => {
      this.setColor(e.target.value);
    });

    // Brush size
    const brushSizeEl = document.getElementById('brushSize');
    const brushSizeValueEl = document.getElementById('brushSizeValue');
    
    brushSizeEl.addEventListener('input', (e) => {
      this.brushSize = parseInt(e.target.value);
      brushSizeValueEl.textContent = this.brushSize;
    });
    
    // Zoom controls
    document.getElementById('editorZoomIn').addEventListener('click', () => this.zoomIn());
    document.getElementById('editorZoomOut').addEventListener('click', () => this.zoomOut());

    // Onion Skin controls
    const onionSkinToggle = document.getElementById('onionSkinToggle');
    const onionSkinModeSelect = document.getElementById('onionSkinMode');
    const onionSkinOpacitySlider = document.getElementById('onionSkinOpacity');
    const onionSkinOpacityValue = document.getElementById('onionSkinOpacityValue');

    if (onionSkinToggle) onionSkinToggle.checked = this.onionSkinEnabled;
    if (onionSkinModeSelect) onionSkinModeSelect.value = this.onionSkinMode;
    if (onionSkinOpacitySlider) onionSkinOpacitySlider.value = this.onionSkinOpacity;
    if (onionSkinOpacityValue) onionSkinOpacityValue.textContent = this.onionSkinOpacity.toFixed(2);

    if (onionSkinToggle) onionSkinToggle.addEventListener('change', (e) => {
      this.onionSkinEnabled = e.target.checked;
      this.redraw();
    });
    if (onionSkinModeSelect) onionSkinModeSelect.addEventListener('change', (e) => {
      this.onionSkinMode = e.target.value;
      this.redraw();
    });
    if (onionSkinOpacitySlider) onionSkinOpacitySlider.addEventListener('input', (e) => {
      this.onionSkinOpacity = parseFloat(e.target.value);
      if (onionSkinOpacityValue) onionSkinOpacityValue.textContent = this.onionSkinOpacity.toFixed(2);
      if (this.onionSkinEnabled) { // Only redraw if enabled to avoid unnecessary redraws
        this.redraw();
      }
    });


    // Undo/Redo buttons
    document.getElementById('editorUndo').addEventListener('click', () => this.undo());
    document.getElementById('editorRedo').addEventListener('click', () => this.redo());
    
    // Canvas events
    this.overlayCanvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.overlayCanvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.overlayCanvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.overlayCanvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    
    // Keyboard shortcuts
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    
    // Window resize
    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });
    
    // Add to editor settings toolbar
    const editorSettingsToolbar = document.getElementById('pixelEditorSettingsToolbar');
    if (editorSettingsToolbar) {
      const animationControls = document.createElement('div');
      animationControls.className = 'animation-controls';
      animationControls.style.display = 'flex';
      animationControls.style.alignItems = 'center';
      animationControls.style.gap = '8px';
      
      const prevFrameButton = document.createElement('button');
      prevFrameButton.innerHTML = '◀';
      prevFrameButton.title = 'Previous Frame';
      prevFrameButton.addEventListener('click', () => {
        this.stopAnimationPlayback();
        this.prevFrame();
      });
      
      const editorPlayButton = document.createElement('button');
      editorPlayButton.id = 'editorPlayAnimation';
      editorPlayButton.innerHTML = '▶';
      editorPlayButton.title = 'Play/Stop Animation';
      
      editorPlayButton.addEventListener('click', () => {
        if (this.animationPlaying) {
          this.stopAnimationPlayback();
        } else {
          this.startAnimationPlayback();
        }
      });
      
      const nextFrameButton = document.createElement('button');
      nextFrameButton.innerHTML = '▶';
      nextFrameButton.title = 'Next Frame';
      nextFrameButton.addEventListener('click', () => {
        this.stopAnimationPlayback();
        this.nextFrame();
      });
      
      const fpsLabel = document.createElement('label');
      fpsLabel.textContent = 'FPS:';
      fpsLabel.setAttribute('for', 'editorAnimationFPS');
      
      const fpsInput = document.createElement('input');
      fpsInput.type = 'number';
      fpsInput.id = 'editorAnimationFPS';
      fpsInput.min = '1';
      fpsInput.max = '60';
      fpsInput.value = this.animationFPS;
      fpsInput.title = 'Animation FPS';
      
      fpsInput.addEventListener('change', (e) => {
        const fps = parseInt(e.target.value);
        this.setAnimationFPS(fps);
      });
      
      animationControls.appendChild(prevFrameButton);
      animationControls.appendChild(editorPlayButton);
      animationControls.appendChild(nextFrameButton);
      animationControls.appendChild(fpsLabel);
      animationControls.appendChild(fpsInput);
      
      editorSettingsToolbar.appendChild(animationControls);
    }
  }
  
  setupSendToAnimateButton() {
    // Create Send to Animate button
    const sendToAnimateBtn = document.createElement('button');
    sendToAnimateBtn.id = 'sendToAnimate';
    sendToAnimateBtn.textContent = 'Send to Animate';
    sendToAnimateBtn.style.backgroundColor = '#ff9800';
    sendToAnimateBtn.title = 'Use current frame in Puppet Tool';

    sendToAnimateBtn.addEventListener('click', () => {
      this.sendCurrentFrameToPuppetTool();
    });

    // Add the button to the editor settings toolbar
    const editorSettingsToolbar = document.getElementById('pixelEditorSettingsToolbar');
    if (editorSettingsToolbar) {
      editorSettingsToolbar.appendChild(sendToAnimateBtn);
    }
  }

  setTool(tool) {
    this.currentTool = tool;
    
    // Update UI
    const tools = ['drawTool', 'eraseTool', 'fillTool', 'fillEraseTool', 'eyedropperTool'];
    tools.forEach(id => {
      document.getElementById(id).classList.remove('active');
    });
    
    let toolId;
    switch (tool) {
      case 'draw': toolId = 'drawTool'; break;
      case 'erase': toolId = 'eraseTool'; break;
      case 'fill': toolId = 'fillTool'; break;
      case 'fillerase': toolId = 'fillEraseTool'; break;
      case 'eyedropper': toolId = 'eyedropperTool'; break;
    }
    
    if (toolId) {
      document.getElementById(toolId).classList.add('active');
    }
  }
  
  setColor(color) {
    this.previousColor = this.currentColor;
    this.currentColor = color;
    
    // Update UI
    const colorPicker = document.getElementById('colorPicker');
    if (colorPicker) {
        colorPicker.value = color;
    }
    
    const swatches = document.querySelectorAll('.color-swatch');
    swatches.forEach(swatch => {
      swatch.classList.remove('active');
      if (swatch.dataset.color === color) {
        swatch.classList.add('active');
      }
    });
  }
  
  toggleGrid() {
    this.showGrid = !this.showGrid;
    this.updateGridButtonUI(); // Update button state
    this.redraw();
  }

  updateGridButtonUI() {
    const toggleGridButton = document.getElementById('toggleGrid');
    if (toggleGridButton) {
        if (this.showGrid) {
            toggleGridButton.classList.add('active');
        } else {
            toggleGridButton.classList.remove('active');
        }
    }
  }
  
  toggleEditorBackgroundView() {
    this.showEditorBackground = !this.showEditorBackground;
    this.updateEditorBackgroundButtonUI(); // Update button state
    this.redraw();
  }

  updateEditorBackgroundButtonUI() {
    const toggleEditorBackgroundButton = document.getElementById('toggleEditorBackground');
    if (toggleEditorBackgroundButton) {
        if (this.showEditorBackground) {
            toggleEditorBackgroundButton.classList.add('active');
        } else {
            toggleEditorBackgroundButton.classList.remove('active');
        }
    }
  }
  
  zoomIn() {
    this.zoomLevel = Math.min(10, this.zoomLevel + 0.5);
    this.updateZoomLevelUI();
    this.resizeCanvas();
  }
  
  zoomOut() {
    this.zoomLevel = Math.max(0.5, this.zoomLevel - 0.5);
    this.updateZoomLevelUI();
    this.resizeCanvas();
  }
  
  updateZoomLevelUI() {
    document.getElementById('editorZoomLevel').textContent = `${Math.round(this.zoomLevel * 100)}%`;
  }
  
  // Create a new sprite
  createNewSprite(width, height, background = 'transparent', isUndoRedo = false) {
    // For undo/redo of creating a new sprite, this might need more context,
    // but for now, frame operations might lead to an empty state which calls this.
    // If called by user, it would be its own undoable action.
    // Current implementation doesn't make "createNewSprite" undoable itself,
    // but it correctly resets state for subsequent operations.

    this.width = width;
    this.height = height;
    this.referenceImage = null; // Clear reference image
    this.referenceImageFrameCount = 1;
    const refFrameCountInput = document.getElementById('referenceImageFrameCountInput');
    if (refFrameCountInput) refFrameCountInput.value = 1;
    
    // Create an empty ImageData
    this.spriteData = this.ctx.createImageData(width, height);
    
    // Fill with background color if not transparent
    if (background !== 'transparent') {
      const rgb = this.hexToRgb(background);
      const data = this.spriteData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = rgb.r;
        data[i + 1] = rgb.g;
        data[i + 2] = rgb.b;
        data[i + 3] = 255; // Fully opaque
      }
    }
    
    // Reset frames
    this.frames = [this.cloneImageData(this.spriteData)];
    this.currentFrame = 0;
    
    // Reset undo/redo stacks only if not part of an undo/redo sequence itself
    if (!isUndoRedo) {
        this.undoStack = [];
        this.redoStack = [];
    }
    
    // Resize and redraw
    this.resizeCanvas();
    this.updateFramesUI();
  }
  
  // Load from image
  loadFromImage(image) {
    // Create a temporary canvas to get image data
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = image.width;
    tempCanvas.height = image.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Draw the image
    tempCtx.drawImage(image, 0, 0);
    
    // Update dimensions
    this.width = image.width;
    this.height = image.height;
    this.referenceImage = null; // Clear reference image
    this.referenceImageFrameCount = 1;
    const refFrameCountInput = document.getElementById('referenceImageFrameCountInput');
    if (refFrameCountInput) refFrameCountInput.value = 1;
    
    // Get the image data
    this.spriteData = tempCtx.getImageData(0, 0, this.width, this.height);
    
    // Reset frames
    this.frames = [this.cloneImageData(this.spriteData)];
    this.currentFrame = 0;
    
    // Reset undo/redo stacks
    this.undoStack = [];
    this.redoStack = [];
    
    // Resize and redraw
    this.resizeCanvas();
    this.updateFramesUI();
    this.scanSpriteColors();
  }
  
  // Load from spritesheet
  loadFromSpritesheet(image, frameCount = 1) {
    // Calculate frame width (assuming 1 row)
    const frameWidth = Math.floor(image.width / frameCount);
    const frameHeight = image.height;
    
    // Update dimensions
    this.width = frameWidth;
    this.height = frameHeight;
    this.referenceImage = null; // Clear reference image
    this.referenceImageFrameCount = 1;
    const refFrameCountInput = document.getElementById('referenceImageFrameCountInput');
    if (refFrameCountInput) refFrameCountInput.value = 1;
    
    // Create a temporary canvas with pixelated rendering
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = frameWidth;
    tempCanvas.height = frameHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.imageSmoothingEnabled = false;
    
    // Reset frames array
    this.frames = [];
    
    // Extract each frame
    for (let i = 0; i < frameCount; i++) {
        tempCtx.clearRect(0, 0, frameWidth, frameHeight);
        tempCtx.drawImage(
            image,
            i * frameWidth, 0, frameWidth, frameHeight,
            0, 0, frameWidth, frameHeight
        );
        
        const frameData = tempCtx.getImageData(0, 0, frameWidth, frameHeight);
        this.frames.push(frameData);
    }
    
    // Set current frame
    this.currentFrame = 0;
    this.spriteData = this.cloneImageData(this.frames[0]);
    
    // Reset undo/redo stacks
    this.undoStack = [];
    this.redoStack = [];
    
    // Resize and redraw
    this.resizeCanvas();
    this.updateFramesUI();
    this.scanSpriteColors();
  }
  
  // Drawing operations
  drawPixel(x, y, color) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    
    const idx = (y * this.width + x) * 4;
    const data = this.spriteData.data;
    
    if (color === 'transparent') {
      data[idx + 3] = 0;
    } else {
      const rgb = this.hexToRgb(color);
      data[idx] = rgb.r;
      data[idx + 1] = rgb.g;
      data[idx + 2] = rgb.b;
      data[idx + 3] = 255;
      
      // Add color to used colors
      this.usedColors.add(color);
      this.updateColorPalette();
    }
    
    this.redraw(); 
  }
  
  // Draw with brush size
  drawWithBrush(x, y, color) {
    const startX = Math.floor(x - (this.brushSize - 1) / 2);
    const startY = Math.floor(y - (this.brushSize - 1) / 2);
    
    for (let i = 0; i < this.brushSize; i++) {
      for (let j = 0; j < this.brushSize; j++) {
        this.drawPixel(startX + i, startY + j, color);
      }
    }
  }
  
  // Fill an area with color
  fillArea(x, y, targetColor, fillColor) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    
    const data = this.spriteData.data;
    const stack = [{x, y}];
    const targetRgba = this.getPixelColor(x, y);
    const fillRgba = this.hexToRgba(fillColor);
    
    // If target color is the same as fill color, do nothing
    if (this.rgbaEqual(targetRgba, fillRgba)) return;
    
    while (stack.length > 0) {
      const {x, y} = stack.pop();
      const idx = (y * this.width + x) * 4;
      
      // Check if this pixel matches the target color
      if (!this.rgbaEqual(this.getPixelRgba(idx), targetRgba)) {
        continue;
      }
      
      // Set the pixel to the fill color
      data[idx] = fillRgba.r;
      data[idx + 1] = fillRgba.g;
      data[idx + 2] = fillRgba.b;
      data[idx + 3] = fillRgba.a;
      
      // Add color to used colors
      this.usedColors.add(fillColor);
      this.updateColorPalette();
      
      // Add neighboring pixels to stack
      if (x > 0) stack.push({x: x - 1, y});
      if (x < this.width - 1) stack.push({x: x + 1, y});
      if (y > 0) stack.push({x, y: y - 1});
      if (y < this.height - 1) stack.push({x, y: y + 1});
    }
    
    this.redraw(); 
  }
  
  // Get pixel color at x,y
  getPixelColor(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    
    const idx = (y * this.width + x) * 4;
    return this.getPixelRgba(idx);
  }
  
  // Get RGBA values from pixel index
  getPixelRgba(idx) {
    const data = this.spriteData.data;
    return {
      r: data[idx],
      g: data[idx + 1],
      b: data[idx + 2],
      a: data[idx + 3]
    };
  }
  
  // Compare two RGBA values
  rgbaEqual(rgba1, rgba2) {
    return rgba1.r === rgba2.r && 
           rgba1.g === rgba2.g && 
           rgba1.b === rgba2.b && 
           rgba1.a === rgba2.a;
  }
  
  // Eyedropper tool - get color at position
  eyedropperColor(x, y) {
    const rgba = this.getPixelColor(x, y);
    if (!rgba) return;
    
    if (rgba.a === 0) {
      // Transparent
      return 'transparent';
    }
    
    return this.rgbToHex(rgba.r, rgba.g, rgba.b);
  }
  
  // Redraw the canvas
  redraw() {
    if (!this.spriteData) {
        // Clear everything if no sprite data
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        // Draw transparency checkerboard or background color even if no sprite
        this.drawEditorBackgroundLayer();
        this.drawGrid(); // Still draw grid if enabled, even on empty canvas
        return;
    }
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw editor background (checkerboard or solid color)
    this.drawEditorBackgroundLayer();
    
    // Draw the sprite data
    const scaledPixelSize = this.pixelSize * this.zoomLevel;
    
    // Create temporary canvas at 1:1 scale
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.width;
    tempCanvas.height = this.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(this.spriteData, 0, 0);
    
    // Draw scaled up image
    this.ctx.drawImage(
      tempCanvas,
      0, 0, this.width, this.height,
      0, 0, this.width * scaledPixelSize, this.height * scaledPixelSize
    );

    // Draw onion skin layer if enabled (drawn on top of current sprite)
    if (this.onionSkinEnabled) {
      this.drawOnionSkinLayer();
    }
    
    // Draw grid
    if (this.showGrid) {
      this.drawGrid();
    }
  }
  
  // Draw transparency checkerboard
  drawTransparencyCheckerboard() {
    const ctx = this.ctx;
    const scaledPixelSize = this.pixelSize * this.zoomLevel; 

    ctx.fillStyle = '#eeeeee'; 
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    ctx.fillStyle = '#cccccc'; 
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if ((x + y) % 2 === 0) {
          ctx.fillRect(
            x * scaledPixelSize,
            y * scaledPixelSize,
            scaledPixelSize,
            scaledPixelSize
          );
        }
      }
    }
  }

  // Draw editor background layer (custom color or checkerboard)
  drawEditorBackgroundLayer() {
    const ctx = this.ctx;
    ctx.globalAlpha = 1.0; // Ensure full opacity for background
    if (this.showEditorBackground) {
        if (this.referenceImage && this.width > 0 && this.height > 0) {
            const scaledPixelSize = this.pixelSize * this.zoomLevel;
            const refTempCanvas = document.createElement('canvas');
            refTempCanvas.width = this.width; // Editor grid width
            refTempCanvas.height = this.height; // Editor grid height
            const refTempCtx = refTempCanvas.getContext('2d');
            refTempCtx.imageSmoothingEnabled = false;

            let sourceX = 0, sourceY = 0;
            let sourceFrameWidth = this.referenceImage.naturalWidth;
            let sourceFrameHeight = this.referenceImage.naturalHeight;

            if (this.referenceImageFrameCount > 1) {
                const refSpriteFrameToShow = (this.currentFrame % this.referenceImageFrameCount);
                sourceFrameWidth = this.referenceImage.naturalWidth / this.referenceImageFrameCount;
                // sourceFrameHeight is already this.referenceImage.naturalHeight
                sourceX = refSpriteFrameToShow * sourceFrameWidth;
                // sourceY is 0
            }

            // Calculate new dimensions to maintain aspect ratio of the source frame
            const refAspect = sourceFrameWidth / sourceFrameHeight;
            const spriteAspect = this.width / this.height; // Editor grid aspect
            let drawWidth, drawHeight, drawX, drawY;

            if (refAspect > spriteAspect) { // Reference frame is wider than editor grid aspect
                drawWidth = this.width;
                drawHeight = this.width / refAspect;
                drawX = 0;
                drawY = (this.height - drawHeight) / 2;
            } else { // Reference frame is taller or same aspect as editor grid aspect
                drawHeight = this.height;
                drawWidth = this.height * refAspect;
                drawY = 0;
                drawX = (this.width - drawWidth) / 2;
            }
            drawWidth = Math.round(drawWidth);
            drawHeight = Math.round(drawHeight);
            drawX = Math.round(drawX);
            drawY = Math.round(drawY);

            refTempCtx.clearRect(0,0, this.width, this.height); // Clear temp canvas
            // Draw the (potentially specific frame of) reference image, scaled and centered, onto the temp canvas
            refTempCtx.drawImage(
                this.referenceImage,    // Full spritesheet or single image
                sourceX, sourceY, sourceFrameWidth, sourceFrameHeight, // Source rect from reference image
                drawX, drawY, drawWidth, drawHeight // Destination rect on temp canvas (scaled to fit editor grid)
            );

            // Draw the temp canvas (now holding the scaled and letterboxed reference image/frame) onto the main editor canvas
            ctx.drawImage(
              refTempCanvas,
              0, 0, this.width, this.height, // Source from temp canvas (full area)
              0, 0, this.width * scaledPixelSize, this.height * scaledPixelSize // Destination on main canvas (scaled by zoom)
            );
        } else {
            // Draw solid background color
            ctx.fillStyle = this.editorBackgroundColor;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    } else {
        this.drawTransparencyCheckerboard(); 
    }
  }
  
  // Draw onion skin layer
  drawOnionSkinLayer() {
    if (!this.onionSkinEnabled || this.frames.length < 1) return;

    let targetFrameIndex = -1;
    if (this.onionSkinMode === 'previous') {
      targetFrameIndex = this.currentFrame - 1;
    } else if (this.onionSkinMode === 'next') {
      targetFrameIndex = this.currentFrame + 1;
    }

    if (targetFrameIndex >= 0 && targetFrameIndex < this.frames.length) {
      const onionSkinData = this.frames[targetFrameIndex];
      const scaledPixelSize = this.pixelSize * this.zoomLevel;

      // Create temporary canvas for the onion skin frame at 1:1 scale
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = this.width;
      tempCanvas.height = this.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.putImageData(onionSkinData, 0, 0);

      // Set opacity and draw scaled up image
      this.ctx.globalAlpha = this.onionSkinOpacity;
      this.ctx.drawImage(
        tempCanvas,
        0, 0, this.width, this.height,
        0, 0, this.width * scaledPixelSize, this.height * scaledPixelSize
      );
      this.ctx.globalAlpha = 1.0; // Reset global alpha
    }
  }
  
  // Draw grid
  drawGrid() {
    const ctx = this.ctx;
    const scaledPixelSize = this.pixelSize * this.zoomLevel;
    
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    
    // Draw vertical lines
    for (let x = 0; x <= this.width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * scaledPixelSize, 0);
      ctx.lineTo(x * scaledPixelSize, this.height * scaledPixelSize);
      ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let y = 0; y <= this.height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * scaledPixelSize);
      ctx.lineTo(this.width * scaledPixelSize, y * scaledPixelSize);
      ctx.stroke();
    }
  }
  
  // Draw overlay for brush preview
  drawOverlay(x, y) {
    this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    
    if (x < 0 || y < 0) return;
    
    const scaledPixelSize = this.pixelSize * this.zoomLevel;
    
    if (this.currentTool === 'draw' || this.currentTool === 'erase') {
      // Draw brush outline
      const startX = Math.floor(x - (this.brushSize - 1) / 2);
      const startY = Math.floor(y - (this.brushSize - 1) / 2);
      
      this.overlayCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      this.overlayCtx.lineWidth = 2;
      this.overlayCtx.strokeRect(
        startX * scaledPixelSize,
        startY * scaledPixelSize,
        this.brushSize * scaledPixelSize,
        this.brushSize * scaledPixelSize
      );
      
      this.overlayCtx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      this.overlayCtx.lineWidth = 1;
      this.overlayCtx.strokeRect(
        startX * scaledPixelSize,
        startY * scaledPixelSize,
        this.brushSize * scaledPixelSize,
        this.brushSize * scaledPixelSize
      );
    } else if (this.currentTool === 'fill' || this.currentTool === 'fillerase' || this.currentTool === 'eyedropper') {
      // Draw crosshair
      this.overlayCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      this.overlayCtx.lineWidth = 2;
      
      // Horizontal line
      this.overlayCtx.beginPath();
      this.overlayCtx.moveTo(x * scaledPixelSize - 5, y * scaledPixelSize);
      this.overlayCtx.lineTo(x * scaledPixelSize + 5, y * scaledPixelSize);
      this.overlayCtx.stroke();
      
      // Vertical line
      this.overlayCtx.beginPath();
      this.overlayCtx.moveTo(x * scaledPixelSize, y * scaledPixelSize - 5);
      this.overlayCtx.lineTo(x * scaledPixelSize, y * scaledPixelSize + 5);
      this.overlayCtx.stroke();
      
      // Outline the target pixel
      this.overlayCtx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      this.overlayCtx.lineWidth = 1;
      this.overlayCtx.strokeRect(
        x * scaledPixelSize,
        y * scaledPixelSize,
        scaledPixelSize,
        scaledPixelSize
      );
    }
  }
  
  // Event handlers
  handleMouseDown(e) {
    if (!this.spriteData) return;
    
    this.isDrawing = true;
    const { x, y } = this.getCanvasCoordinates(e);
    this.lastPos = { x, y };
    
    // Save current state for undo for pixel operations
    if (this.currentTool === 'draw' || this.currentTool === 'erase' || this.currentTool === 'fill' || this.currentTool === 'fillerase') {
      this.initialPixelDataForUndo = this.cloneImageData(this.spriteData);
    }
    
    switch (this.currentTool) {
      case 'draw':
        this.drawWithBrush(x, y, this.currentColor);
        break;
      case 'erase':
        this.drawWithBrush(x, y, 'transparent');
        break;
      case 'fill':
        this.fillArea(x, y, this.getPixelColor(x, y), this.currentColor);
        if (this.initialPixelDataForUndo) { // If fill actually changed something
            this.pushUndoState({ 
                type: 'pixelEdit', 
                frameIndex: this.currentFrame, 
                undoData: this.initialPixelDataForUndo, 
                redoData: this.cloneImageData(this.spriteData) 
            });
            this.initialPixelDataForUndo = null;
        }
        this.saveFrame(); 
        break;
      case 'fillerase':
        this.fillArea(x, y, this.getPixelColor(x, y), 'transparent');
        if (this.initialPixelDataForUndo) { // If fill actually changed something
            this.pushUndoState({ 
                type: 'pixelEdit', 
                frameIndex: this.currentFrame, 
                undoData: this.initialPixelDataForUndo, 
                redoData: this.cloneImageData(this.spriteData) 
            });
            this.initialPixelDataForUndo = null;
        }
        this.saveFrame(); 
        break;
      case 'eyedropper':
        const color = this.eyedropperColor(x, y);
        if (color && color !== 'transparent') {
          this.setColor(color);
        }
        break;
    }
  }
  
  handleMouseMove(e) {
    if (!this.spriteData) return;
    
    const { x, y } = this.getCanvasCoordinates(e);
    
    // Always update the overlay
    this.drawOverlay(x, y);
    
    if (!this.isDrawing) return;
    
    switch (this.currentTool) {
      case 'draw':
        this.drawLine(this.lastPos.x, this.lastPos.y, x, y, this.currentColor);
        break;
      case 'erase':
        this.drawLine(this.lastPos.x, this.lastPos.y, x, y, 'transparent');
        break;
    }
    
    this.lastPos = { x, y };
  }
  
  handleMouseUp() {
    if (this.isDrawing) {
        if ((this.currentTool === 'draw' || this.currentTool === 'erase') && this.initialPixelDataForUndo) {
            // Check if anything actually changed to avoid redundant undos
            const currentDataStr = JSON.stringify(Array.from(this.spriteData.data));
            const initialDataStr = JSON.stringify(Array.from(this.initialPixelDataForUndo.data));

            if (currentDataStr !== initialDataStr) {
                this.pushUndoState({ 
                    type: 'pixelEdit', 
                    frameIndex: this.currentFrame, 
                    undoData: this.initialPixelDataForUndo, 
                    redoData: this.cloneImageData(this.spriteData) 
                });
            }
            this.initialPixelDataForUndo = null;
            this.saveFrame(); 
        }
    }
    this.isDrawing = false;
  }
  
  handleMouseLeave() {
    if (this.isDrawing) { 
        if ((this.currentTool === 'draw' || this.currentTool === 'erase') && this.initialPixelDataForUndo) {
            const currentDataStr = JSON.stringify(Array.from(this.spriteData.data));
            const initialDataStr = JSON.stringify(Array.from(this.initialPixelDataForUndo.data));
            if (currentDataStr !== initialDataStr) {
                 this.pushUndoState({ 
                    type: 'pixelEdit', 
                    frameIndex: this.currentFrame, 
                    undoData: this.initialPixelDataForUndo, 
                    redoData: this.cloneImageData(this.spriteData) 
                });
            }
            this.initialPixelDataForUndo = null;
            this.saveFrame(); 
        }
    }
    this.isDrawing = false; 
    this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
  }
  
  handleKeyDown(e) {
    const activeElement = document.activeElement;
    const isInputElement = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT' || activeElement.tagName === 'TEXTAREA');

    // If focus is on an input element, editor shortcuts (except possibly universal undo/redo) should not activate.
    // Let browser handle Ctrl+Z/Y for text inputs.
    if (isInputElement) {
        // Allow Ctrl/Cmd+Z and Y for text inputs specifically
         if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
             // Do nothing, let the browser handle text input undo/redo
         } else {
            // Allow arrow keys for text input navigation
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                return; // Let browser handle navigation in input fields
            }
            return;
         }
    }

    // If not an input element, then editor shortcuts can apply.
    switch (e.key.toLowerCase()) {
      case 'w':
        this.setTool('draw');
        e.preventDefault();
        break;
      case 'e':
        this.setTool('erase');
        e.preventDefault();
        break;
      case 'f':
        this.setTool('fill');
        e.preventDefault();
        break;
      case 'r':
        this.setTool('fillerase');
        e.preventDefault();
        break;
      case 't':
        this.setTool('eyedropper');
        e.preventDefault();
        break;
      case 'g':
        this.toggleGrid();
        e.preventDefault();
        break;
      case 'b':
        this.toggleEditorBackgroundView();
        e.preventDefault();
        break;
      case 'a': // Shortcut for Onion Skin
        const onionSkinToggle = document.getElementById('onionSkinToggle');
        if (onionSkinToggle) {
            onionSkinToggle.checked = !onionSkinToggle.checked; // Toggle the checkbox state
            this.onionSkinEnabled = onionSkinToggle.checked; // Update internal state
            this.redraw(); // Redraw to show/hide onion skin
            e.preventDefault();
        }
        break;
      case 'z':
        if (e.ctrlKey || e.metaKey) {
          // Check if not in an input element or if it's just Ctrl+Z/Y without shift
          // The isInputElement check above handles most cases, but explicit check here too.
          if (!isInputElement || (!e.shiftKey && e.key.toLowerCase() === 'z') || (e.shiftKey && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y'))) {
               e.preventDefault();
               e.stopPropagation(); // Prevent app's global undo/redo IF editor undo/redo is active
               if (e.shiftKey) {
                  this.redo();
               } else {
                  this.undo();
               }
           }
        }
        break;
      case 'y':
        if (e.ctrlKey || e.metaKey) {
            if (!isInputElement || (e.key.toLowerCase() === 'y')) {
                e.preventDefault();
                e.stopPropagation(); // Prevent app's global undo/redo IF editor undo/redo is active
                this.redo();
            }
        }
        break;
      case 'arrowleft': // Shortcut for Previous Frame
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
          this.stopAnimationPlayback();
          this.prevFrame();
          e.preventDefault(); // Prevent browser scrolling
        }
        break;
      case 'arrowright': // Shortcut for Next Frame
         if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
          this.stopAnimationPlayback();
          this.nextFrame();
          e.preventDefault(); // Prevent browser scrolling
        }
        break;
    }
  }

  // Convert mouse event to canvas coordinates
  getCanvasCoordinates(e) {
    const rect = this.overlayCanvas.getBoundingClientRect();
    const scaledPixelSize = this.pixelSize * this.zoomLevel;
    
    const x = Math.floor((e.clientX - rect.left) / scaledPixelSize);
    const y = Math.floor((e.clientY - rect.top) / scaledPixelSize);
    
    return { x, y };
  }
  
  // Draw a line using Bresenham's algorithm
  drawLine(x0, y0, x1, y1, color) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = (x0 < x1) ? 1 : -1;
    const sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;
    
    while (true) {
      this.drawWithBrush(x0, y0, color);
      
      if (x0 === x1 && y0 === y1) break;
      
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  
  // Utility function to convert hex to rgb
  hexToRgb(hex) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }
  
  // Utility function to convert hex to rgba
  hexToRgba(hex) {
    if (hex === 'transparent') {
      return { r: 0, g: 0, b: 0, a: 0 };
    }
    
    const rgb = this.hexToRgb(hex);
    return { ...rgb, a: 255 };
  }
  
  // Utility function to convert rgb to hex
  rgbToHex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  
  // Clone ImageData object
  cloneImageData(imageData) {
    return new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );
  }
  
  // Push action to undo stack
  pushUndoState(action) {
    // Ensure consistency for pixelEdit actions
    if (action.type === 'pixelEdit') {
        if (!action.undoData || !action.redoData) {
            console.warn("PixelEdit undo action missing data", action);
            return;
        }
    }
    this.undoStack.push(action);
    this.redoStack = []; 
  }
  
  // Undo the last action
  undo() {
    if (this.undoStack.length === 0) return;
    
    const action = this.undoStack.pop();
    this.redoStack.push(action);
    
    switch (action.type) {
      case 'pixelEdit':
        this.currentFrame = action.frameIndex; // Restore context
        this.spriteData = this.cloneImageData(action.undoData);
        this.frames[this.currentFrame] = this.cloneImageData(this.spriteData);
        break;
      case 'addFrame': // Undo: Remove the added frame
        this.frames.splice(action.frameIndex, 1);
        this.currentFrame = action.originalCurrentFrame;
        break;
      case 'deleteFrame': // Undo: Re-insert the deleted frame
        this.frames.splice(action.deletedFrameIndex, 0, this.cloneImageData(action.deletedFrameData));
        this.currentFrame = action.originalCurrentFrame;
        break;
      case 'duplicateFrame': // Undo: Remove the duplicated frame
        this.frames.splice(action.duplicatedFrameIndex, 1);
        this.currentFrame = action.originalCurrentFrame;
        break;
      case 'moveFrame': // Undo: Move frame from newDest back to oldSource
        this.moveFrame(action.destinationIndex, action.sourceIndex, true); // isUndoRedo = true
        this.currentFrame = action.currentFrameBeforeMove; // Restore context
        break;
    }

    // Common post-undo operations
    if (this.frames.length === 0) {
        // This should ideally not happen if UI prevents deleting the last frame or if addFrame is forced.
        // For safety, create a new default sprite.
        this.createNewSprite(this.width || 32, this.height || 32, 'transparent', true); // Pass isUndoRedo to prevent loop
    } else {
        // Ensure currentFrame is valid after operations
        this.currentFrame = Math.max(0, Math.min(this.frames.length - 1, this.currentFrame));
        this.spriteData = this.cloneImageData(this.frames[this.currentFrame]);
    }
    
    this.updateFramesUI();
    this.redraw();
    this.scanSpriteColors();
  }
  
  // Redo the last undone action
  redo() {
    if (this.redoStack.length === 0) return;
    
    const action = this.redoStack.pop();
    this.undoStack.push(action);
    
    switch (action.type) {
      case 'pixelEdit':
        this.currentFrame = action.frameIndex;
        this.spriteData = this.cloneImageData(action.redoData);
        this.frames[this.currentFrame] = this.cloneImageData(this.spriteData);
        break;
      case 'addFrame': // Redo: Add the frame back
        this.frames.splice(action.frameIndex, 0, this.cloneImageData(action.frameData));
        this.currentFrame = action.newCurrentFrame;
        break;
      case 'deleteFrame': // Redo: Delete the frame again
        this.frames.splice(action.deletedFrameIndex, 1);
        this.currentFrame = action.newCurrentFrame;
        break;
      case 'duplicateFrame': // Redo: Duplicate the frame again
        this.frames.splice(action.duplicatedFrameIndex, 0, this.cloneImageData(action.duplicatedFrameData));
        this.currentFrame = action.newCurrentFrame;
        break;
      case 'moveFrame': // Redo: Move frame from oldSource to newDest
        this.moveFrame(action.sourceIndex, action.destinationIndex, true); // isUndoRedo = true
        this.currentFrame = action.currentFrameAfterMove; // Restore context
        break;
    }

    // Common post-redo operations
    if (this.frames.length === 0) {
        this.createNewSprite(this.width || 32, this.height || 32, 'transparent', true);
    } else {
        this.currentFrame = Math.max(0, Math.min(this.frames.length - 1, this.currentFrame));
        this.spriteData = this.cloneImageData(this.frames[this.currentFrame]);
    }
    
    this.updateFramesUI();
    this.redraw();
    this.scanSpriteColors();
  }

  // Save current frame
  saveFrame() {
    if (!this.spriteData || this.currentFrame < 0 || this.currentFrame >= this.frames.length) return;
    
    // Update the current frame in the frames array
    this.frames[this.currentFrame] = this.cloneImageData(this.spriteData);
    
    // Update frames UI
    this.updateFramesUI();
    this.scanSpriteColors(); // Rescan colors after saving a frame change
  }
  
  // Add a new frame
  addFrame(isUndoRedo = false) {
    const originalCurrentFrame = this.currentFrame;

    if (!this.width || !this.height) {
        console.warn("Cannot add frame: sprite dimensions not set.");
        // Attempt to use default if spriteData exists but width/height are somehow not set on instance
        if (this.spriteData) {
            this.width = this.spriteData.width;
            this.height = this.spriteData.height;
        } else {
            // Fallback to a default size if no sprite data exists at all
            // This case should ideally be prevented by disabling add frame if no sprite is loaded/created
            this.width = 32; 
            this.height = 32;
            console.warn("Falling back to default 32x32 for new frame.");
        }
    }
    
    // Create new empty (transparent) ImageData
    // this.ctx might not be the best context if canvas is not sized, use document.createElement
    const tempCanvasForEmptyFrame = document.createElement('canvas');
    const tempCtxForEmptyFrame = tempCanvasForEmptyFrame.getContext('2d');
    const newEmptyFrameData = tempCtxForEmptyFrame.createImageData(this.width, this.height);
    // The data buffer is already initialized to all zeros (transparent black) by createImageData.
    
    // Add the new empty frame
    const addedFrameIndex = this.frames.length; // Assuming adding at the end
    this.frames.push(newEmptyFrameData);
    
    this.currentFrame = addedFrameIndex;
    this.spriteData = this.cloneImageData(this.frames[this.currentFrame]); // Correctly clones the new empty frame for editing
    
    const newCurrentFrame = this.currentFrame;

    if (!isUndoRedo) {
      this.pushUndoState({
        type: 'addFrame',
        frameIndex: addedFrameIndex, // Index where it was added
        frameData: this.cloneImageData(newEmptyFrameData), // Data of the added frame
        originalCurrentFrame,
        newCurrentFrame
      });
      // For a new frame, reset its specific undo/redo history if needed,
      // but here global undo/redo handles the addFrame action.
      // this.undoStack = []; // This would be if each frame had its own undo stack.
      // this.redoStack = [];
    }
    
    this.updateFramesUI();
    this.redraw();
  }
  
  // Delete current frame
  deleteFrame(isUndoRedo = false) {
    if (this.frames.length <= 1 && !isUndoRedo) return; // Prevent deleting the last frame by user action

    const originalCurrentFrame = this.currentFrame;
    const deletedFrameIndex = this.currentFrame; // Assuming deleting the active frame
    const deletedFrameData = this.cloneImageData(this.frames[deletedFrameIndex]);
    
    this.frames.splice(deletedFrameIndex, 1);
    
    if (this.frames.length === 0) { // Should only happen if isUndoRedo bypasses the >1 check
        this.currentFrame = -1; // Handled by common undo/redo block to create new
    } else if (this.currentFrame >= this.frames.length) {
      this.currentFrame = this.frames.length - 1;
    }
    // If currentFrame was deleted, it might shift. The above line handles it.
    
    const newCurrentFrame = this.currentFrame;

    if (!isUndoRedo) {
      this.pushUndoState({
        type: 'deleteFrame',
        deletedFrameIndex,
        deletedFrameData,
        originalCurrentFrame,
        newCurrentFrame
      });
    }
    
    if (this.frames.length > 0) {
        this.spriteData = this.cloneImageData(this.frames[this.currentFrame]);
    } else {
        this.spriteData = null; // Will be handled by createNewSprite in undo/redo
    }
    
    this.updateFramesUI();
    this.redraw();
  }
  
  // Duplicate current frame
  duplicateFrame(isUndoRedo = false) {
    if (!this.spriteData) return;

    const originalCurrentFrame = this.currentFrame;
    const sourceFrameIndex = this.currentFrame;
    const frameToDuplicateData = this.cloneImageData(this.frames[sourceFrameIndex]);
    
    const duplicatedFrameIndex = sourceFrameIndex + 1;
    this.frames.splice(duplicatedFrameIndex, 0, frameToDuplicateData);
    
    this.currentFrame = duplicatedFrameIndex; // Switch to the new duplicated frame
    this.spriteData = this.cloneImageData(this.frames[this.currentFrame]);

    const newCurrentFrame = this.currentFrame;

    if (!isUndoRedo) {
      this.pushUndoState({
        type: 'duplicateFrame',
        sourceFrameIndex, // Frame that was copied
        duplicatedFrameIndex, // Index where the new copy was inserted
        duplicatedFrameData: this.cloneImageData(frameToDuplicateData),
        originalCurrentFrame,
        newCurrentFrame
      });
    }
    
    this.updateFramesUI();
    this.redraw(); // Redraw will pick up new currentFrame and its spriteData
  }
  
  // Move frame
  moveFrame(sourceIndex, destinationIndex, isUndoRedo = false) {
    if (sourceIndex === destinationIndex) return;

    const currentFrameBeforeMove = this.currentFrame;

    const item = this.frames.splice(sourceIndex, 1)[0];
    
    if (destinationIndex > this.frames.length) {
        destinationIndex = this.frames.length;
    }

    this.frames.splice(destinationIndex, 0, item);

    const oldCurrentFrameTracker = this.currentFrame; // Use a temporary variable for tracking

    if (oldCurrentFrameTracker === sourceIndex) {
        this.currentFrame = destinationIndex;
    } else {
        if (sourceIndex < oldCurrentFrameTracker && destinationIndex >= oldCurrentFrameTracker) {
            this.currentFrame--;
        } else if (sourceIndex > oldCurrentFrameTracker && destinationIndex <= oldCurrentFrameTracker) {
            this.currentFrame++;
        }
    }
    
    this.currentFrame = Math.max(0, Math.min(this.frames.length - 1, this.currentFrame));
    const currentFrameAfterMove = this.currentFrame;

    if (!isUndoRedo) {
        this.pushUndoState({
            type: 'moveFrame',
            sourceIndex, // Original source
            destinationIndex, // Original destination
            currentFrameBeforeMove, // currentFrame state *before* this move action
            currentFrameAfterMove // currentFrame state *after* this move action
        });
    }
    
    if (this.frames.length > 0) {
        this.spriteData = this.cloneImageData(this.frames[this.currentFrame]);
    } else {
        this.spriteData = null; // Will be handled by createNewSprite in undo/redo
    }
    
    this.updateFramesUI();
    this.redraw();
  }

  // Update frames UI
  updateFramesUI() {
    const framesContainer = document.getElementById('animationFrames');
    framesContainer.innerHTML = '';

    // Add drag-and-drop listeners to the container for appending
    framesContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        framesContainer.classList.add('drag-over-container');
    });
    framesContainer.addEventListener('dragleave', () => {
        framesContainer.classList.remove('drag-over-container');
    });
    framesContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        framesContainer.classList.remove('drag-over-container');
        if (this.draggedFrameIndex !== null) {
            const sourceIndex = this.draggedFrameIndex;
            // Move to the end of the list. destinationIndex will be current frames.length
            // which means it will be appended.
            this.moveFrame(sourceIndex, this.frames.length);
        }
        this.draggedFrameIndex = null;
        this.clearDraggingStyles();
    });
    
    this.frames.forEach((frame, index) => {
        const thumbnail = document.createElement('div');
        thumbnail.className = 'frame-thumbnail';
        if (index === this.currentFrame) {
            thumbnail.classList.add('active');
        }
        
        // Make draggable
        thumbnail.draggable = true;
        thumbnail.addEventListener('dragstart', (e) => {
            this.draggedFrameIndex = index;
            e.dataTransfer.setData('text/plain', index.toString());
            e.dataTransfer.effectAllowed = 'move';
            // Add delay to allow browser to render drag image before adding class
            setTimeout(() => thumbnail.classList.add('dragging'), 0);
        });

        thumbnail.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (this.draggedFrameIndex !== null && this.draggedFrameIndex !== index) {
                thumbnail.classList.add('drag-over-target');
            }
        });

        thumbnail.addEventListener('dragleave', (e) => {
            thumbnail.classList.remove('drag-over-target');
        });

        thumbnail.addEventListener('drop', (e) => {
            e.preventDefault();
            thumbnail.classList.remove('drag-over-target');
            if (this.draggedFrameIndex !== null) {
                const sourceIndex = this.draggedFrameIndex;
                const destinationIndex = index;
                if (sourceIndex !== destinationIndex) {
                    this.moveFrame(sourceIndex, destinationIndex);
                }
            }
            this.draggedFrameIndex = null;
            this.clearDraggingStyles();
        });
        
        thumbnail.addEventListener('dragend', (e) => {
            this.draggedFrameIndex = null;
            this.clearDraggingStyles();
        });

        // Create a canvas for the thumbnail with pixel-perfect rendering
        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Draw checkerboard for transparency
        ctx.fillStyle = '#eeeeee';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#cccccc';
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if ((x + y) % 2 === 0) {
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
        
        // Draw the frame
        ctx.putImageData(frame, 0, 0);
        
        // Create image with pixel-perfect rendering
        const img = document.createElement('img');
        img.style.imageRendering = 'pixelated';
        img.src = canvas.toDataURL();
        thumbnail.appendChild(img);
        
        // Add frame number
        const frameNumber = document.createElement('div');
        frameNumber.className = 'frame-number';
        frameNumber.textContent = index + 1;
        thumbnail.appendChild(frameNumber);
        
        // Add frame actions
        const frameActions = document.createElement('div');
        frameActions.className = 'frame-actions';
        
        // Add button
        const addBtn = document.createElement('button');
        addBtn.className = 'frame-action';
        addBtn.innerHTML = '+';
        addBtn.title = 'Add frame';
        addBtn.addEventListener('click', () => {
            this.addFrame();
        });
        frameActions.appendChild(addBtn);
        
        // Delete button
        if (this.frames.length > 1) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'frame-action';
            deleteBtn.innerHTML = '×';
            deleteBtn.title = 'Delete frame';
            deleteBtn.addEventListener('click', () => {
                this.deleteFrame();
            });
            frameActions.appendChild(deleteBtn);
        }
        
        // Duplicate button
        const dupBtn = document.createElement('button');
        dupBtn.className = 'frame-action';
        dupBtn.innerHTML = 'D';
        dupBtn.title = 'Duplicate frame';
        dupBtn.addEventListener('click', () => {
            this.duplicateFrame();
        });
        frameActions.appendChild(dupBtn);
        
        thumbnail.appendChild(frameActions);
        
        // Add click handler to select frame
        thumbnail.addEventListener('click', () => {
            this.goToFrame(index);
        });
        
        framesContainer.appendChild(thumbnail);
    });
  }

  clearDraggingStyles() {
    document.querySelectorAll('.frame-thumbnail.dragging').forEach(el => el.classList.remove('dragging'));
    document.querySelectorAll('.frame-thumbnail.drag-over-target').forEach(el => el.classList.remove('drag-over-target'));
    document.getElementById('animationFrames').classList.remove('drag-over-container');
  }

  // Generate a spritesheet from frames
  generateSpritesheet() {
    return new Promise(resolve => {
      const frameCount = this.frames.length;
      if (frameCount === 0 || !this.width || !this.height) {
        console.warn("Cannot generate spritesheet: No frames or dimensions not set.");
        resolve(null);
        return;
      }

      const includeBackgroundToggle = document.getElementById('includeBackgroundToggle');
      const shouldIncludeBackground = includeBackgroundToggle ? includeBackgroundToggle.checked : false;
      
      const spritesheetCanvas = document.createElement('canvas');
      spritesheetCanvas.width = this.width * frameCount;
      spritesheetCanvas.height = this.height;
      const spritesheetCtx = spritesheetCanvas.getContext('2d');
      spritesheetCtx.imageSmoothingEnabled = false;
      
      this.frames.forEach((frameData, i) => {
        const currentFrameOutputCanvas = document.createElement('canvas');
        currentFrameOutputCanvas.width = this.width;
        currentFrameOutputCanvas.height = this.height;
        const currentFrameOutputCtx = currentFrameOutputCanvas.getContext('2d');
        currentFrameOutputCtx.imageSmoothingEnabled = false;

        if (shouldIncludeBackground && this.showEditorBackground) {
          // 1. Draw the background for this frame
          if (this.referenceImage && this.width > 0 && this.height > 0) {
            let sourceX = 0, sourceY = 0;
            let sourceFrameWidth = this.referenceImage.naturalWidth;
            let sourceFrameHeight = this.referenceImage.naturalHeight;

            if (this.referenceImageFrameCount > 1) {
                const refSpriteFrameToShow = (i % this.referenceImageFrameCount); // Use 'i' (current editor frame index in loop)
                sourceFrameWidth = this.referenceImage.naturalWidth / this.referenceImageFrameCount;
                sourceX = refSpriteFrameToShow * sourceFrameWidth;
            }

            const refAspect = sourceFrameWidth / sourceFrameHeight;
            const spriteAspect = this.width / this.height;
            let drawWidth, drawHeight, drawX, drawY;

            if (refAspect > spriteAspect) {
                drawWidth = this.width;
                drawHeight = this.width / refAspect;
                drawX = 0;
                drawY = (this.height - drawHeight) / 2;
            } else {
                drawHeight = this.height;
                drawWidth = this.height * refAspect;
                drawY = 0;
                drawX = (this.width - drawWidth) / 2;
            }
            drawWidth = Math.round(drawWidth);
            drawHeight = Math.round(drawHeight);
            drawX = Math.round(drawX);
            drawY = Math.round(drawY);

            currentFrameOutputCtx.drawImage(
                this.referenceImage,
                sourceX, sourceY, sourceFrameWidth, sourceFrameHeight,
                drawX, drawY, drawWidth, drawHeight
            );
          } else {
            // Draw solid background color
            currentFrameOutputCtx.fillStyle = this.editorBackgroundColor;
            currentFrameOutputCtx.fillRect(0, 0, this.width, this.height);
          }

          // 2. Draw the actual sprite frame data on top of the background
          const tempSpriteCanvas = document.createElement('canvas');
          tempSpriteCanvas.width = this.width;
          tempSpriteCanvas.height = this.height;
          const tempSpriteCtx = tempSpriteCanvas.getContext('2d');
          tempSpriteCtx.imageSmoothingEnabled = false;
          tempSpriteCtx.putImageData(frameData, 0, 0);
          currentFrameOutputCtx.drawImage(tempSpriteCanvas, 0, 0);

        } else {
          // Not including background, or showEditorBackground is off - just draw the frame data
          currentFrameOutputCtx.putImageData(frameData, 0, 0);
        }
        
        // 3. Draw this composed frame (currentFrameOutputCanvas) onto the main spritesheet canvas
        spritesheetCtx.drawImage(currentFrameOutputCanvas, i * this.width, 0);
      });
      
      resolve(spritesheetCanvas.toDataURL());
    });
  }
  
  // Get the current sprite as an Image
  getCurrentSpriteAsImage() {
    return new Promise(resolve => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = this.width;
      tempCanvas.height = this.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.putImageData(this.spriteData, 0, 0);
      
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = tempCanvas.toDataURL();
    });
  }
  
  // Send current frame to Puppet Tool
  async sendCurrentFrameToPuppetTool() {
    try {
      // Get current frame as image
      const currentFrameImage = await this.getCurrentSpriteAsImage();

      // Dispatch a custom event that the app can listen for
      const event = new CustomEvent('pixelEditorFrameSent', { 
        detail: { image: currentFrameImage } 
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Failed to send frame to Puppet Tool:', error);
    }
  }
  
  // Scan sprite for colors
  scanSpriteColors() {
    this.usedColors = new Set(); // Reset before scanning all frames

    if (!this.frames || this.frames.length === 0) {
        this.updateColorPalette();
        return;
    }

    this.frames.forEach(frameData => {
        if (!frameData || !frameData.data) return; // Skip if a frame is somehow invalid

        const data = frameData.data;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 0) { // If not fully transparent
                const color = this.rgbToHex(data[i], data[i + 1], data[i + 2]);
                this.usedColors.add(color);
            }
        }
    });

    this.updateColorPalette();
  }
  
  startAnimationPlayback() {
    if (this.animationPlaying || this.frames.length <= 1) return;


    this.animationPlaying = true;
    
    // Update play button UI
    const playButton = document.getElementById('editorPlayAnimation');
    if (playButton) {
      playButton.textContent = '⏹';
    }
    
    this.animationInterval = setInterval(() => {
      this.nextFrame();
    }, 1000 / this.animationFPS);
  }

  stopAnimationPlayback() {
    if (!this.animationPlaying) return;
    
    this.animationPlaying = false;
    clearInterval(this.animationInterval);
    
    // Update play button UI
    const playButton = document.getElementById('editorPlayAnimation');
    if (playButton) {
      playButton.textContent = '▶';
    }
  }

  setAnimationFPS(fps) {
    this.animationFPS = Math.max(1, Math.min(60, fps)); 
    
    if (this.animationPlaying) {
      // Restart interval with new FPS
      this.stopAnimationPlayback();
      this.startAnimationPlayback();
    }
    
    // Update UI
    const fpsInput = document.getElementById('editorAnimationFPS');
    if (fpsInput) {
      fpsInput.value = this.animationFPS;
    }
  }

  prevFrame() {
    if (this.frames.length <= 1) return;
    
    this.currentFrame--;
    if (this.currentFrame < 0) {
      this.currentFrame = this.frames.length - 1;
    }
    
    this.spriteData = this.cloneImageData(this.frames[this.currentFrame]);
    this.redraw();
    this.updateFramesUI();
  }

  nextFrame() {
    if (this.frames.length <= 1) return;
    
    this.currentFrame++;
    if (this.currentFrame >= this.frames.length) {
      this.currentFrame = 0;
    }
    
    this.spriteData = this.cloneImageData(this.frames[this.currentFrame]);
    this.redraw();
    this.updateFramesUI();
  }

  goToFrame(frameIndex) {
    if (frameIndex < 0 || frameIndex >= this.frames.length) {
      console.warn(`Attempted to go to invalid frame index: ${frameIndex}`);
      return;
    }

    if (this.animationPlaying) {
        this.stopAnimationPlayback();
    }

    this.currentFrame = frameIndex;
    if (this.frames[this.currentFrame]) {
        this.spriteData = this.cloneImageData(this.frames[this.currentFrame]);
    } else {
        // This case should ideally not happen if frames array is managed correctly
        console.error(`Frame data not found for index: ${frameIndex}`);
        // Potentially create a new empty sprite or handle error appropriately
        this.createNewSprite(this.width, this.height, 'transparent', true); // isUndoRedo to avoid history push
    }
    
    this.redraw();
    this.updateFramesUI(); // To update the active state of thumbnails
  }

  loadReferenceImage(file) {
    const reader = new FileReader();
    reader.onload = (e_reader) => {
        const img = new Image();
        img.onload = () => {
            this.referenceImage = img;
            // Read frame count from input after image is loaded
            const frameCountInput = document.getElementById('referenceImageFrameCountInput');
            this.referenceImageFrameCount = parseInt(frameCountInput.value, 10) || 1;
            if (this.referenceImageFrameCount < 1) this.referenceImageFrameCount = 1;
            frameCountInput.value = this.referenceImageFrameCount; // Ensure UI matches

            this.redraw(); // Redraw to show the new reference image if BG is active
            // Optionally, automatically switch to BG view if not already
            // if (!this.showEditorBackground) {
            //    this.toggleEditorBackgroundView();
            // }
        };
        img.onerror = () => {
            console.error("Failed to load reference image.");
            // Handle error, e.g., show a message to the user
        };
        img.src = e_reader.target.result;
    };
    reader.onerror = () => {
        console.error("Failed to read reference image file.");
    };
    reader.readAsDataURL(file);
  }

  async getFrameAsCanvas(frameIndex, includeBackground) {
    if (frameIndex < 0 || frameIndex >= this.frames.length || !this.width || !this.height) {
        console.warn("Cannot get frame as canvas: Invalid index or dimensions not set.");
        const errorCanvas = document.createElement('canvas');
        errorCanvas.width = this.width || 32;
        errorCanvas.height = this.height || 32;
        return errorCanvas; // Return a blank canvas
    }

    const frameData = this.frames[frameIndex];
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = this.width;
    outputCanvas.height = this.height;
    const outputCtx = outputCanvas.getContext('2d');
    outputCtx.imageSmoothingEnabled = false;

    if (includeBackground && this.showEditorBackground) {
        // Draw the background for this frame
        if (this.referenceImage && this.width > 0 && this.height > 0) {
            let sourceX = 0, sourceY = 0;
            let sourceFrameWidth = this.referenceImage.naturalWidth;
            let sourceFrameHeight = this.referenceImage.naturalHeight;

            if (this.referenceImageFrameCount > 1) {
                const refSpriteFrameToShow = (frameIndex % this.referenceImageFrameCount);
                sourceFrameWidth = this.referenceImage.naturalWidth / this.referenceImageFrameCount;
                sourceX = refSpriteFrameToShow * sourceFrameWidth;
            }

            const refAspect = sourceFrameWidth / sourceFrameHeight;
            const spriteAspect = this.width / this.height;
            let drawWidth, drawHeight, drawX, drawY;

            if (refAspect > spriteAspect) {
                drawWidth = this.width;
                drawHeight = this.width / refAspect;
                drawX = 0;
                drawY = (this.height - drawHeight) / 2;
            } else {
                drawHeight = this.height;
                drawWidth = this.height * refAspect;
                drawY = 0;
                drawX = (this.width - drawWidth) / 2;
            }
            drawWidth = Math.round(drawWidth);
            drawHeight = Math.round(drawHeight);
            drawX = Math.round(drawX);
            drawY = Math.round(drawY);

            outputCtx.drawImage(
                this.referenceImage,
                sourceX, sourceY, sourceFrameWidth, sourceFrameHeight,
                drawX, drawY, drawWidth, drawHeight
            );
        } else {
            // Draw solid background color
            outputCtx.fillStyle = this.editorBackgroundColor;
            outputCtx.fillRect(0, 0, this.width, this.height);
        }

        // Draw the actual sprite frame data on top of the background
        const tempSpriteCanvas = document.createElement('canvas');
        tempSpriteCanvas.width = this.width;
        tempSpriteCanvas.height = this.height;
        const tempSpriteCtx = tempSpriteCanvas.getContext('2d');
        tempSpriteCtx.imageSmoothingEnabled = false;
        tempSpriteCtx.putImageData(frameData, 0, 0);
        outputCtx.drawImage(tempSpriteCanvas, 0, 0);

    } else {
        // Not including background, or showEditorBackground is off - just draw the frame data
        outputCtx.putImageData(frameData, 0, 0);
    }
    return outputCanvas;
  }
}