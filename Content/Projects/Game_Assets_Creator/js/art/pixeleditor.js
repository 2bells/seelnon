export class PixelEditor {
  constructor(generator) {
    this.generator = generator;
    this.canvas = null;
    this.ctx = null;
    this.gridCanvas = null;
    this.gridCtx = null;
    this.canvasSize = 512; 
    this.pixelSize = 16; 
    this.gridSize = 32; 
    this.isDrawing = false;
    this.currentColor = '#000000';
    this.palette = [];
    this.undoStack = [];
    this.redoStack = [];
    this.tool = 'pencil'; 
    this.cursorPosition = { x: -1, y: -1 };  // Store current cursor position
    this.editorZoom = 1;
    this.isErasing = false;
    this.zoomLevel = 1; // Initialize zoom level
    this.currentAnimation = null; // Store the current animation
    this.animationFrames = []; // Store animation frames
    this.currentFrameIndex = 0; // Current frame index
  }

  createUI(container) {
    const editorContainer = document.createElement('div');
    editorContainer.className = 'pixel-editor-container';
    
    const editorTitle = document.createElement('h3');
    editorTitle.textContent = 'Pixel Editor';
    editorContainer.appendChild(editorTitle);
    
    const toolbar = document.createElement('div');
    toolbar.className = 'pixel-editor-toolbar';
    
    const gridSizeSelector = document.createElement('div');
    gridSizeSelector.className = 'pixel-editor-control-group';
    
    const gridSizeLabel = document.createElement('label');
    gridSizeLabel.textContent = 'Grid Size:';
    gridSizeSelector.appendChild(gridSizeLabel);
    
    const gridSizeSelect = document.createElement('select');
    gridSizeSelect.id = 'pixel-grid-size';
    
    const gridSizes = [32, 64, 128, 256];
    gridSizes.forEach(size => {
      const option = document.createElement('option');
      option.value = size;
      option.textContent = `${size}x${size}`;
      gridSizeSelect.appendChild(option);
    });
    
    gridSizeSelector.appendChild(gridSizeSelect);
    toolbar.appendChild(gridSizeSelector);
    
    const toolSelector = document.createElement('div');
    toolSelector.className = 'pixel-editor-control-group';
    
    const toolSelectorLabel = document.createElement('label');
    toolSelectorLabel.textContent = 'Tool:';
    toolSelector.appendChild(toolSelectorLabel);
    
    const tools = [
      { id: 'pencil', name: 'Pencil', icon: '✏️' },
      { id: 'eraser', name: 'Eraser', icon: '❌' },
      { id: 'fill', name: 'Fill', icon: '💦' },
      { id: 'eyedropper', name: 'Eyedropper', icon: '👁️' }
    ];
    
    tools.forEach(tool => {
      const toolBtn = document.createElement('button');
      toolBtn.className = 'pixel-editor-tool-btn';
      toolBtn.id = `tool-${tool.id}`;
      toolBtn.title = tool.name;
      toolBtn.innerHTML = tool.icon;
      toolBtn.dataset.tool = tool.id;
      
      if (tool.id === this.tool) {
        toolBtn.classList.add('active');
      }
      
      toolSelector.appendChild(toolBtn);
    });
    
    toolbar.appendChild(toolSelector);
    
    const zoomControls = document.createElement('div');
    zoomControls.className = 'pixel-editor-control-group';
    
    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.className = 'pixel-editor-action-btn';
    zoomOutBtn.id = 'pixel-editor-zoom-out';
    zoomOutBtn.title = 'Zoom Out';
    zoomOutBtn.innerHTML = '🔍-';
    
    const zoomLabel = document.createElement('span');
    zoomLabel.textContent = '100%';
    zoomLabel.id = 'pixel-editor-zoom-level';
    
    const zoomInBtn = document.createElement('button');
    zoomInBtn.className = 'pixel-editor-action-btn';
    zoomInBtn.id = 'pixel-editor-zoom-in';
    zoomInBtn.title = 'Zoom In';
    zoomInBtn.innerHTML = '🔍+';
    
    zoomControls.appendChild(zoomOutBtn);
    zoomControls.appendChild(zoomLabel);
    zoomControls.appendChild(zoomInBtn);
    
    toolbar.appendChild(zoomControls);
    
    const actionBtns = document.createElement('div');
    actionBtns.className = 'pixel-editor-control-group';
    
    const undoBtn = document.createElement('button');
    undoBtn.className = 'pixel-editor-action-btn';
    undoBtn.id = 'pixel-editor-undo';
    undoBtn.title = 'Undo';
    undoBtn.innerHTML = '↩️';
    undoBtn.disabled = true;
    
    const redoBtn = document.createElement('button');
    redoBtn.className = 'pixel-editor-action-btn';
    redoBtn.id = 'pixel-editor-redo';
    redoBtn.title = 'Redo';
    redoBtn.innerHTML = '↪️';
    redoBtn.disabled = true;
    
    actionBtns.appendChild(undoBtn);
    actionBtns.appendChild(redoBtn);
    toolbar.appendChild(actionBtns);
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'pixel-editor-save-btn';
    saveBtn.id = 'pixel-editor-save';
    saveBtn.textContent = 'Save to Library';
    toolbar.appendChild(saveBtn);
    
    editorContainer.appendChild(toolbar);
    
    const editorWorkspace = document.createElement('div');
    editorWorkspace.className = 'pixel-editor-workspace';
    
    const editorArea = document.createElement('div');
    editorArea.className = 'pixel-editor-canvas-container';
    
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pixel-editor-canvas';
    this.canvas.width = this.canvasSize;
    this.canvas.height = this.canvasSize;
    this.canvas.id = 'pixel-editor-canvas';
    editorArea.appendChild(this.canvas);
    
    this.gridCanvas = document.createElement('canvas');
    this.gridCanvas.className = 'pixel-editor-grid-canvas';
    this.gridCanvas.width = this.canvasSize;
    this.gridCanvas.height = this.canvasSize;
    this.gridCanvas.id = 'pixel-editor-grid-canvas';
    editorArea.appendChild(this.gridCanvas);
    
    editorWorkspace.appendChild(editorArea);
    
    const paletteContainer = document.createElement('div');
    paletteContainer.className = 'pixel-editor-palette';
    
    const paletteTitle = document.createElement('h4');
    paletteTitle.textContent = 'Color Palette';
    paletteContainer.appendChild(paletteTitle);
    
    const selectedColorContainer = document.createElement('div');
    selectedColorContainer.className = 'pixel-editor-selected-color';
    
    const selectedColorPreview = document.createElement('div');
    selectedColorPreview.className = 'pixel-editor-color-preview';
    selectedColorPreview.id = 'pixel-editor-current-color';
    selectedColorPreview.style.backgroundColor = this.currentColor;
    selectedColorContainer.appendChild(selectedColorPreview);
    
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.id = 'pixel-editor-color-input';
    colorInput.value = this.currentColor;
    selectedColorContainer.appendChild(colorInput);
    
    paletteContainer.appendChild(selectedColorContainer);
    
    const paletteGrid = document.createElement('div');
    paletteGrid.className = 'pixel-editor-palette-grid';
    paletteGrid.id = 'pixel-editor-palette-grid';
    paletteContainer.appendChild(paletteGrid);
    
    const paletteSelector = document.createElement('div');
    paletteSelector.className = 'pixel-editor-palette-selector';
    
    const paletteSelectorLabel = document.createElement('label');
    paletteSelectorLabel.textContent = 'Palette:';
    paletteSelectorLabel.htmlFor = 'pixel-editor-palette-select';
    paletteSelector.appendChild(paletteSelectorLabel);
    
    const paletteSelect = document.createElement('select');
    paletteSelect.id = 'pixel-editor-palette-select';
    
    const paletteSizes = [8, 16, 32, 64];
    paletteSizes.forEach(size => {
      const option = document.createElement('option');
      option.value = size;
      option.textContent = `${size} Colors`;
      paletteSelect.appendChild(option);
    });
    
    paletteSelector.appendChild(paletteSelect);
    paletteContainer.appendChild(paletteSelector);
    
    editorWorkspace.appendChild(paletteContainer);
    
    const animationSection = document.createElement('div');
    animationSection.className = 'pixel-editor-animation-section';
    
    const animationTitle = document.createElement('h4');
    animationTitle.textContent = 'Animation Frames';
    animationSection.appendChild(animationTitle);
    
    const animationControls = document.createElement('div');
    animationControls.className = 'pixel-editor-animation-controls';
    
    const animSelectContainer = document.createElement('div');
    animSelectContainer.className = 'pixel-editor-anim-select-container';
    
    const animSelectLabel = document.createElement('label');
    animSelectLabel.htmlFor = 'pixel-editor-anim-select';
    animSelectLabel.textContent = 'Animation:';
    animSelectContainer.appendChild(animSelectLabel);
    
    const animSelect = document.createElement('select');
    animSelect.id = 'pixel-editor-anim-select';
    
    const noneOption = document.createElement('option');
    noneOption.value = '';
    noneOption.textContent = 'None';
    animSelect.appendChild(noneOption);
    
    animSelectContainer.appendChild(animSelect);
    animationControls.appendChild(animSelectContainer);
    
    const frameNavContainer = document.createElement('div');
    frameNavContainer.className = 'pixel-editor-frame-nav';
    
    const prevFrameBtn = document.createElement('button');
    prevFrameBtn.className = 'pixel-editor-frame-btn';
    prevFrameBtn.id = 'pixel-editor-prev-frame';
    prevFrameBtn.textContent = '◀ Prev';
    prevFrameBtn.disabled = true;
    frameNavContainer.appendChild(prevFrameBtn);
    
    const frameCounter = document.createElement('span');
    frameCounter.className = 'pixel-editor-frame-counter';
    frameCounter.id = 'pixel-editor-frame-counter';
    frameCounter.textContent = 'Frame: 0/0';
    frameNavContainer.appendChild(frameCounter);
    
    const nextFrameBtn = document.createElement('button');
    nextFrameBtn.className = 'pixel-editor-frame-btn';
    nextFrameBtn.id = 'pixel-editor-next-frame';
    nextFrameBtn.textContent = 'Next ▶';
    nextFrameBtn.disabled = true;
    frameNavContainer.appendChild(nextFrameBtn);
    animationControls.appendChild(frameNavContainer);
    
    const saveFrameBtn = document.createElement('button');
    saveFrameBtn.className = 'pixel-editor-frame-btn';
    saveFrameBtn.id = 'pixel-editor-save-frame';
    saveFrameBtn.textContent = 'Save Frame';
    saveFrameBtn.disabled = true;
    saveFrameBtn.addEventListener('click', () => this.saveCurrentFrame());
    animationControls.appendChild(saveFrameBtn);
    

    
    const previewAnimBtn = document.createElement('button');
    previewAnimBtn.className = 'pixel-editor-anim-preview-btn';
    previewAnimBtn.id = 'pixel-editor-anim-preview';
    previewAnimBtn.textContent = 'Preview Animation';
    previewAnimBtn.disabled = true;
    animationControls.appendChild(previewAnimBtn);
    
    const downloadSpriteSheetBtn = document.createElement('button');
    downloadSpriteSheetBtn.className = 'pixel-editor-anim-preview-btn';
    downloadSpriteSheetBtn.id = 'pixel-editor-download-spritesheet';
    downloadSpriteSheetBtn.textContent = 'Download Sprite Sheet';
    downloadSpriteSheetBtn.disabled = true;
    downloadSpriteSheetBtn.addEventListener('click', () => this.downloadSpriteSheet());
    animationControls.appendChild(downloadSpriteSheetBtn);
    
    animationSection.appendChild(animationControls);
    paletteContainer.appendChild(animationSection);
    
    editorContainer.appendChild(editorWorkspace);
    
    if (container) {
      container.appendChild(editorContainer);
    }
    
    this.ctx = this.canvas.getContext('2d');
    this.gridCtx = this.gridCanvas.getContext('2d');
    
    this.bindEvents();
    this.resizeGrid(this.gridSize);
    this.drawGrid();
    
    this.canvas.addEventListener('mousemove', (e) => this.updateCursorPosition(e));
    this.canvas.addEventListener('mouseleave', () => {
      this.cursorPosition = { x: -1, y: -1 };
      this.drawGrid(); 
    });
    
    return editorContainer;
  }
  
  bindEvents() {
    requestAnimationFrame(() => {
      const gridSizeSelect = document.getElementById('pixel-grid-size');
      if (!gridSizeSelect) return; 
      
      gridSizeSelect.addEventListener('change', (e) => {
        this.resizeGrid(parseInt(e.target.value));
      });
      
      const toolBtns = document.querySelectorAll('.pixel-editor-tool-btn');
      toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          toolBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.tool = btn.dataset.tool;
        });
      });
      
      const undoBtn = document.getElementById('pixel-editor-undo');
      const redoBtn = document.getElementById('pixel-editor-redo');
      
      undoBtn.addEventListener('click', () => this.undo());
      redoBtn.addEventListener('click', () => this.redo());
      
      const zoomInBtn = document.getElementById('pixel-editor-zoom-in');
      const zoomOutBtn = document.getElementById('pixel-editor-zoom-out');
      
      zoomInBtn.addEventListener('click', () => this.changeZoom(0.5));
      zoomOutBtn.addEventListener('click', () => this.changeZoom(-0.5));
      
      const saveBtn = document.getElementById('pixel-editor-save');
      saveBtn.addEventListener('click', () => this.saveToLibrary());
      
      const colorInput = document.getElementById('pixel-editor-color-input');
      colorInput.addEventListener('input', (e) => {
        this.currentColor = e.target.value;
        document.getElementById('pixel-editor-current-color').style.backgroundColor = this.currentColor;
      });
      
      const paletteSelect = document.getElementById('pixel-editor-palette-select');
      paletteSelect.addEventListener('change', (e) => {
        this.loadPalette(parseInt(e.target.value));
      });
      
      const animSelect = document.getElementById('pixel-editor-anim-select');
      const prevFrameBtn = document.getElementById('pixel-editor-prev-frame');
      const nextFrameBtn = document.getElementById('pixel-editor-next-frame');
      const previewAnimBtn = document.getElementById('pixel-editor-anim-preview');
      const downloadSpriteSheetBtn = document.getElementById('pixel-editor-download-spritesheet');
      
      if (animSelect && prevFrameBtn && nextFrameBtn && previewAnimBtn && downloadSpriteSheetBtn) {
        animSelect.addEventListener('change', (e) => {
          this.loadAnimation(e.target.value);
        });
        
        prevFrameBtn.addEventListener('click', () => {
          this.saveCurrentFrame();
          this.showPreviousFrame();
        });
        
        nextFrameBtn.addEventListener('click', () => {
          this.saveCurrentFrame();
          this.showNextFrame();
        });
        
        previewAnimBtn.addEventListener('click', () => {
          if (!this.isPreviewingAnimation) {
            this.saveCurrentFrame();
          }
          this.toggleAnimationPreview();
        });
      }
      
      this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
      this.canvas.addEventListener('mousemove', (e) => this.draw(e));
      this.canvas.addEventListener('mouseup', () => this.stopDrawing());
      this.canvas.addEventListener('mouseleave', () => this.stopDrawing());
      
      // Add keyboard event listener for tool selection hotkeys
      document.addEventListener('keydown', (e) => {
        // Prevent default if a modifier key is not pressed 
        // to avoid interfering with browser shortcuts
        if (!e.altKey && !e.ctrlKey && !e.metaKey) {
          switch(e.key.toLowerCase()) {
            case 'w':
              this.selectTool('pencil');
              break;
            case 'e':
              this.selectTool('eraser');
              break;
            case 'r':
              this.selectTool('fill');
              break;
            case 't':
              this.selectTool('eyedropper');
              break;
          }
        }
      });

      // Method to handle tool selection 
      this.selectTool = (toolId) => {
        toolBtns.forEach(btn => {
          btn.classList.remove('active');
          if (btn.dataset.tool === toolId) {
            btn.classList.add('active');
            this.tool = toolId;
          }
        });
      };

      this.loadPalette(8);
      
      this.animateCursor();
    });
  }
  
  resizeGrid(size) {
    this.gridSize = size;
    this.pixelSize = this.canvasSize / size;
    
    this.ctx.clearRect(0, 0, this.canvasSize, this.canvasSize);
    this.gridCtx.clearRect(0, 0, this.canvasSize, this.canvasSize);
    
    this.drawGrid();
    
    if (this.generator.currentAssetId) {
      this.loadSpriteForEditing(this.generator.currentAssetId, size);
    }
  }
  
  drawGrid() {
    this.gridCtx.clearRect(0, 0, this.canvasSize, this.canvasSize);
    
    // Adjust line width based on zoom level
    const baseLineWidth = 0.5;
    const adjustedLineWidth = baseLineWidth / this.zoomLevel;
    
    this.gridCtx.beginPath();
    this.gridCtx.strokeStyle = `rgba(200, 200, 200, ${0.5 / this.zoomLevel})`;
    this.gridCtx.lineWidth = adjustedLineWidth;
    
    for (let x = 0; x <= this.canvasSize; x += this.pixelSize) {
      this.gridCtx.moveTo(x, 0);
      this.gridCtx.lineTo(x, this.canvasSize);
    }
  
    for (let y = 0; y <= this.canvasSize; y += this.pixelSize) {
      this.gridCtx.moveTo(0, y);
      this.gridCtx.lineTo(this.canvasSize, y);
    }
    
    this.gridCtx.stroke();
    
    if (this.cursorPosition.x >= 0 && this.cursorPosition.x < this.gridSize &&
        this.cursorPosition.y >= 0 && this.cursorPosition.y < this.gridSize) {
      
      // Adjust cursor highlight thickness
      const baseHighlightWidth = 2;
      const adjustedHighlightWidth = baseHighlightWidth / this.zoomLevel;
      const highlightAlpha = 0.8;
      
      this.gridCtx.strokeStyle = this.tool === 'eraser' 
        ? `rgba(255, 0, 0, ${highlightAlpha})` 
        : `rgba(255, 255, 0, ${highlightAlpha})`;
      
      this.gridCtx.lineWidth = adjustedHighlightWidth;
      this.gridCtx.beginPath();
      this.gridCtx.rect(
        this.cursorPosition.x * this.pixelSize,
        this.cursorPosition.y * this.pixelSize,
        this.pixelSize,
        this.pixelSize
      );
      this.gridCtx.stroke();
      
      // Adjust corner marker size
      const baseCornerSize = 3;
      const adjustedCornerSize = baseCornerSize / this.zoomLevel;
      
      this.gridCtx.fillStyle = this.tool === 'eraser' 
        ? `rgba(255, 0, 0, ${highlightAlpha})` 
        : `rgba(255, 255, 0, ${highlightAlpha})`;
      
      // Draw corner markers
      const positions = [
        { x: this.cursorPosition.x * this.pixelSize, y: this.cursorPosition.y * this.pixelSize },
        { x: (this.cursorPosition.x + 1) * this.pixelSize, y: this.cursorPosition.y * this.pixelSize },
        { x: this.cursorPosition.x * this.pixelSize, y: (this.cursorPosition.y + 1) * this.pixelSize },
        { x: (this.cursorPosition.x + 1) * this.pixelSize, y: (this.cursorPosition.y + 1) * this.pixelSize }
      ];
      
      positions.forEach(pos => {
        this.gridCtx.fillRect(
          pos.x - adjustedCornerSize,
          pos.y - adjustedCornerSize,
          adjustedCornerSize * 2,
          adjustedCornerSize * 2
        );
      });
    }
  }
  
  startDrawing(e) {
    this.saveState();
    
    this.isDrawing = true;
    const rect = this.canvas.getBoundingClientRect();
    
    const x = Math.floor((e.clientX - rect.left) / this.zoomLevel * (this.gridSize / (rect.width / this.zoomLevel)));
    const y = Math.floor((e.clientY - rect.top) / this.zoomLevel * (this.gridSize / (rect.height / this.zoomLevel)));
    
    this.cursorPosition = { x, y }; 
    this.handleTools(x, y);
  }
  
  draw(e) {
    if (!this.isDrawing) return;
    
    const rect = this.canvas.getBoundingClientRect();
    
    const x = Math.floor((e.clientX - rect.left) / this.zoomLevel * (this.gridSize / (rect.width / this.zoomLevel)));
    const y = Math.floor((e.clientY - rect.top) / this.zoomLevel * (this.gridSize / (rect.height / this.zoomLevel)));
    
    this.cursorPosition = { x, y }; 
    this.handleTools(x, y);
  }
  
  stopDrawing() {
    if (this.isDrawing && this.currentAnimation && this.animationFrames.length > 0) {
      this.saveCurrentFrame();
    }
    this.isDrawing = false;
  }
  
  handleTools(x, y) {
    if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) return;
    
    switch (this.tool) {
      case 'pencil':
        this.drawPixel(x, y, this.currentColor);
        break;
      case 'eraser':
        this.drawPixel(x, y, 'rgba(0, 0, 0, 0)');
        break;
      case 'fill':
        this.floodFill(x, y, this.getPixelColor(x, y), this.currentColor);
        break;
      case 'eyedropper':
        const color = this.getPixelColor(x, y);
        if (color !== 'rgba(0, 0, 0, 0)') {
          this.currentColor = this.rgbaToHex(color);
          document.getElementById('pixel-editor-color-input').value = this.currentColor;
          document.getElementById('pixel-editor-current-color').style.backgroundColor = this.currentColor;
        }
        break;
    }
  }
  
  drawPixel(x, y, color) {
    this.ctx.fillStyle = color;
    this.ctx.clearRect(
      Math.floor(x * this.pixelSize), 
      Math.floor(y * this.pixelSize), 
      Math.ceil(this.pixelSize), 
      Math.ceil(this.pixelSize)
    );
    
    if (color !== 'rgba(0, 0, 0, 0)') {
      this.ctx.fillRect(
        Math.floor(x * this.pixelSize), 
        Math.floor(y * this.pixelSize), 
        Math.ceil(this.pixelSize), 
        Math.ceil(this.pixelSize)
      );
    }
  }
  
  getPixelColor(x, y) {
    const data = this.ctx.getImageData(
      x * this.pixelSize + this.pixelSize / 2, 
      y * this.pixelSize + this.pixelSize / 2, 
      1, 1
    ).data;
    
    if (data[3] === 0) {
      return 'rgba(0, 0, 0, 0)';
    }
    
    return `rgba(${data[0]}, ${data[1]}, ${data[2]}, ${data[3] / 255})`;
  }
  
  floodFill(x, y, targetColor, fillColor) {
    if (targetColor === fillColor) return;
    
    const queue = [{x, y}];
    const visited = new Set();
    
    while (queue.length > 0) {
      const pixel = queue.shift();
      const key = `${pixel.x},${pixel.y}`;
      
      if (
        pixel.x < 0 || 
        pixel.x >= this.gridSize || 
        pixel.y < 0 || 
        pixel.y >= this.gridSize || 
        visited.has(key)
      ) {
        continue;
      }
      
      const currentColor = this.getPixelColor(pixel.x, pixel.y);
      if (currentColor !== targetColor) {
        continue;
      }
      
      this.drawPixel(pixel.x, pixel.y, fillColor);
      visited.add(key);
      
      queue.push({x: pixel.x + 1, y: pixel.y});
      queue.push({x: pixel.x - 1, y: pixel.y});
      queue.push({x: pixel.x, y: pixel.y + 1});
      queue.push({x: pixel.x, y: pixel.y - 1});
    }
  }
  
  saveState() {
    const imageData = this.ctx.getImageData(0, 0, this.canvasSize, this.canvasSize);
    this.undoStack.push(imageData);
    
    if (this.undoStack.length > 10) {
      this.undoStack.shift(); 
    }
    
    this.redoStack = [];
    
    document.getElementById('pixel-editor-undo').disabled = false;
    document.getElementById('pixel-editor-redo').disabled = true;
  }
  
  undo() {
    if (this.undoStack.length === 0) return;
    
    const currentState = this.ctx.getImageData(0, 0, this.canvasSize, this.canvasSize);
    this.redoStack.push(currentState);
    
    const previousState = this.undoStack.pop();
    this.ctx.putImageData(previousState, 0, 0);
    
    document.getElementById('pixel-editor-undo').disabled = this.undoStack.length === 0;
    document.getElementById('pixel-editor-redo').disabled = false;
  }
  
  redo() {
    if (this.redoStack.length === 0) return;
    
    const currentState = this.ctx.getImageData(0, 0, this.canvasSize, this.canvasSize);
    this.undoStack.push(currentState);
    
    const nextState = this.redoStack.pop();
    this.ctx.putImageData(nextState, 0, 0);
    
    document.getElementById('pixel-editor-undo').disabled = false;
    document.getElementById('pixel-editor-redo').disabled = this.redoStack.length === 0;
  }
  
  createDefaultPalette(size) {
    this.palette = [];
    
    const basicColors = [
      [0, 0, 0], 
      [255, 255, 255], 
      [255, 0, 0], 
      [0, 255, 0], 
      [0, 0, 255], 
      [255, 255, 0], 
      [255, 0, 255], 
      [0, 255, 255] 
    ];
    
    this.palette = [...basicColors];
    
    if (size > 8) {
      for (let i = basicColors.length; i < size; i++) {
        const h = Math.floor(Math.random() * 360);
        const s = 0.7 + Math.random() * 0.3; 
        const v = 0.6 + Math.random() * 0.4; 
        
        const rgb = this.hsvToRgb(h, s, v);
        this.palette.push(rgb);
      }
    }
  }
  
  loadPalette(paletteSize) {
    if (this.generator.currentAssetId) {
      this.palette = this.generator.paletteStorage.getPalette(
        this.generator.currentAssetId, 
        paletteSize.toString()
      );
    }
    
    if (!this.palette || !this.palette.length) {
      this.createDefaultPalette(paletteSize);
    } else {
      this.palette = this.palette.map(color => [
        Math.min(255, Math.max(0, color[0])),
        Math.min(255, Math.max(0, color[1])),
        Math.min(255, Math.max(0, color[2]))
      ]);
    }
    
    this.updatePaletteUI();
  }
  
  updatePaletteUI() {
    const paletteGrid = document.getElementById('pixel-editor-palette-grid');
    paletteGrid.innerHTML = '';
    
    this.palette.forEach((color, index) => {
      const colorBox = document.createElement('div');
      colorBox.className = 'pixel-editor-color-box';
      colorBox.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      colorBox.title = `RGB(${color[0]}, ${color[1]}, ${color[2]})`;
      
      colorBox.addEventListener('click', () => {
        this.currentColor = this.rgbToHex(color[0], color[1], color[2]);
        document.getElementById('pixel-editor-color-input').value = this.currentColor;
        document.getElementById('pixel-editor-current-color').style.backgroundColor = this.currentColor;
      });
      
      paletteGrid.appendChild(colorBox);
    });
  }
  
  rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }
  
  rgbaToHex(rgba) {
    const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    if (match) {
      return this.rgbToHex(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]));
    }
    return '#000000';
  }
  
  hsvToRgb(h, s, v) {
    let r, g, b;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }
    
    return [
      Math.min(255, Math.round(r * 255)),
      Math.min(255, Math.round(g * 255)),
      Math.min(255, Math.round(b * 255))
    ];
  }
  
  loadSpriteForEditing(spriteId, size) {
    const spriteData = this.generator.spriteStorage.getSprite(spriteId, size.toString());
    
    if (spriteData) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        this.ctx.clearRect(0, 0, this.canvasSize, this.canvasSize);
        
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.drawImage(img, 0, 0, this.canvasSize, this.canvasSize);
        
        this.updateAnimationOptions(spriteId);
      };
      
      img.src = spriteData;
    } else {
      for (const availableSize of ['32', '64', '128', '256']) {
        const availableSpriteData = this.generator.spriteStorage.getSprite(spriteId, availableSize);
        
        if (availableSpriteData) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvasSize, this.canvasSize);
            
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = size;
            tempCanvas.height = size;
            const tempCtx = tempCanvas.getContext('2d');
            
            tempCtx.imageSmoothingEnabled = false;
            tempCtx.drawImage(img, 0, 0, size, size);
            
            this.ctx.drawImage(tempCanvas, 0, 0, this.canvasSize, this.canvasSize);
            
            this.updateAnimationOptions(spriteId);
          };
          
          img.src = availableSpriteData;
          break;
        }
      }
    }
    
    const selectedPaletteSize = document.getElementById('pixel-editor-palette-select').value || '8';
    this.loadPalette(parseInt(selectedPaletteSize));
  }
  
  updateAnimationOptions(spriteId) {
    const animSelect = document.getElementById('pixel-editor-anim-select');
    if (!animSelect) return;
    
    while (animSelect.options.length > 1) {
      animSelect.remove(1);
    }
    
    this.currentAnimation = null;
    this.animationFrames = [];
    this.currentFrameIndex = 0;
    
    const frameCounter = document.getElementById('pixel-editor-frame-counter');
    if (frameCounter) {
      frameCounter.textContent = 'Frame: 0/0';
    }
    
    const prevFrameBtn = document.getElementById('pixel-editor-prev-frame');
    const nextFrameBtn = document.getElementById('pixel-editor-next-frame');
    const previewAnimBtn = document.getElementById('pixel-editor-anim-preview');
    const saveFrameBtn = document.getElementById('pixel-editor-save-frame');
    const downloadSpriteSheetBtn = document.getElementById('pixel-editor-download-spritesheet');
    
    if (prevFrameBtn) prevFrameBtn.disabled = true;
    if (nextFrameBtn) nextFrameBtn.disabled = true;
    if (previewAnimBtn) previewAnimBtn.disabled = true;
    if (saveFrameBtn) saveFrameBtn.disabled = true;
    if (downloadSpriteSheetBtn) downloadSpriteSheetBtn.disabled = true;
    
    const animationTypes = this.generator.spriteStorage.getAnimationTypes(spriteId);
    
    if (animationTypes && animationTypes.length > 0) {
      animationTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        animSelect.appendChild(option);
      });
    }
  }
  
  loadAnimation(animationType) {
    if (!animationType || !this.generator.currentAssetId) {
      this.currentAnimation = null;
      this.animationFrames = [];
      this.currentFrameIndex = 0;
      
      const frameCounter = document.getElementById('pixel-editor-frame-counter');
      if (frameCounter) {
        frameCounter.textContent = 'Frame: 0/0';
      }
      
      const prevFrameBtn = document.getElementById('pixel-editor-prev-frame');
      const nextFrameBtn = document.getElementById('pixel-editor-next-frame');
      const previewAnimBtn = document.getElementById('pixel-editor-anim-preview');
      const saveFrameBtn = document.getElementById('pixel-editor-save-frame');
      const downloadSpriteSheetBtn = document.getElementById('pixel-editor-download-spritesheet');
      
      if (prevFrameBtn) prevFrameBtn.disabled = true;
      if (nextFrameBtn) nextFrameBtn.disabled = true;
      if (previewAnimBtn) previewAnimBtn.disabled = true;
      if (saveFrameBtn) saveFrameBtn.disabled = true;
      if (downloadSpriteSheetBtn) downloadSpriteSheetBtn.disabled = true;
      
      return;
    }
    
    const animation = this.generator.spriteStorage.getAnimation(
      this.generator.currentAssetId, 
      animationType
    );
    
    if (!animation || !animation.frames || animation.frames.length === 0) {
      console.warn('No animation frames found');
      return;
    }
    
    this.currentAnimation = animationType;
    this.animationFrames = [];
    this.currentFrameIndex = 0;
    
    const framePromises = animation.frames.map(dataUrl => {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.src = dataUrl;
      });
    });
    
    Promise.all(framePromises).then(frames => {
      this.animationFrames = frames;
      
      const frameCounter = document.getElementById('pixel-editor-frame-counter');
      if (frameCounter) {
        frameCounter.textContent = `Frame: ${this.currentFrameIndex + 1}/${frames.length}`;
      }
      
      const prevFrameBtn = document.getElementById('pixel-editor-prev-frame');
      const nextFrameBtn = document.getElementById('pixel-editor-next-frame');
      const previewAnimBtn = document.getElementById('pixel-editor-anim-preview');
      const saveFrameBtn = document.getElementById('pixel-editor-save-frame');
      const downloadSpriteSheetBtn = document.getElementById('pixel-editor-download-spritesheet');
      
      if (prevFrameBtn) prevFrameBtn.disabled = false;
      if (nextFrameBtn) nextFrameBtn.disabled = false;
      if (previewAnimBtn) previewAnimBtn.disabled = false;
      if (saveFrameBtn) saveFrameBtn.disabled = false;
      if (downloadSpriteSheetBtn) downloadSpriteSheetBtn.disabled = false;
      
      this.showFrame(0);
    });
  }
  
  showFrame(index) {
    if (!this.animationFrames.length || index < 0 || index >= this.animationFrames.length) {
      return;
    }
    
    this.saveState();
    
    this.currentFrameIndex = index;
    
    this.ctx.clearRect(0, 0, this.canvasSize, this.canvasSize);
    this.ctx.drawImage(this.animationFrames[index], 0, 0, this.canvasSize, this.canvasSize);
    
    const frameCounter = document.getElementById('pixel-editor-frame-counter');
    if (frameCounter) {
      frameCounter.textContent = `Frame: ${index + 1}/${this.animationFrames.length}`;
    }
  }
  
  showNextFrame() {
    if (!this.animationFrames.length) return;
    
    const nextIndex = (this.currentFrameIndex + 1) % this.animationFrames.length;
    this.showFrame(nextIndex);
  }
  
  showPreviousFrame() {
    if (!this.animationFrames.length) return;
    
    const prevIndex = (this.currentFrameIndex - 1 + this.animationFrames.length) % this.animationFrames.length;
    this.showFrame(prevIndex);
  }
  
  isPreviewingAnimation = false;
  previewInterval = null;
  
  toggleAnimationPreview() {
    if (this.isPreviewingAnimation) {
      this.stopAnimationPreview();
    } else {
      this.startAnimationPreview();
    }
  }
  
  startAnimationPreview() {
    if (!this.animationFrames.length || this.isPreviewingAnimation) return;
    
    const previewBtn = document.getElementById('pixel-editor-anim-preview');
    if (previewBtn) {
      previewBtn.textContent = 'Stop Preview';
    }
    
    this.isPreviewingAnimation = true;
    
    const fps = this.generator.spriteStorage.getAnimation(
      this.generator.currentAssetId, 
      this.currentAnimation
    )?.fps || 12;
    
    const frameDuration = 1000 / fps;
    
    let frameIndex = 0;
    this.previewInterval = setInterval(() => {
      this.showFrame(frameIndex);
      frameIndex = (frameIndex + 1) % this.animationFrames.length;
    }, frameDuration);
  }
  
  stopAnimationPreview() {
    if (!this.isPreviewingAnimation) return;
    
    clearInterval(this.previewInterval);
    this.previewInterval = null;
    
    this.isPreviewingAnimation = false;
    
    const previewBtn = document.getElementById('pixel-editor-anim-preview');
    if (previewBtn) {
      previewBtn.textContent = 'Preview Animation';
    }
    
    this.showFrame(this.currentFrameIndex);
    this.saveCurrentFrame();
  }
  
  saveToLibrary() {
    if (!this.generator.currentAssetId) {
      this.generator.currentAssetId = this.generator.libraryShowcase.addNewAsset();
    }
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.gridSize;
    tempCanvas.height = this.gridSize;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.imageSmoothingEnabled = false;
    tempCtx.drawImage(this.canvas, 0, 0, this.canvasSize, this.canvasSize, 0, 0, this.gridSize, this.gridSize);
    
    const dataUrl = tempCanvas.toDataURL('image/png');
    
    this.generator.spriteStorage.storeSprite(
      this.generator.currentAssetId, 
      this.gridSize.toString(), 
      dataUrl
    );
    
    if (this.gridSize === 256) {
      this.generator.spriteStorage.storeSprite(
        this.generator.currentAssetId, 
        'EDIT', 
        dataUrl
      );
    }
    
    if (this.currentAnimation && this.animationFrames.length > 0) {
      const animation = this.generator.spriteStorage.getAnimation(
        this.generator.currentAssetId,
        this.currentAnimation
      );
      
      if (animation) {
        animation.frames[this.currentFrameIndex] = dataUrl;
        
        this.generator.spriteStorage.storeAnimation(
          this.generator.currentAssetId,
          this.currentAnimation,
          animation.frames,
          animation.fps || 12
        );
        
        this.animationFrames[this.currentFrameIndex].src = dataUrl;
      }
    }
    
    if (this.palette && this.palette.length) {
      const paletteSize = document.getElementById('pixel-editor-palette-select').value || '8';
      this.generator.paletteStorage.storePalette(
        this.generator.currentAssetId,
        paletteSize,
        this.palette
      );
    }
    
    this.generator.updateLibraryPanel();
    
    const processedImg = document.getElementById('processed-img');
    if (processedImg) {
      processedImg.src = dataUrl;
      this.generator.processedImage = dataUrl;
      document.getElementById('download-processed').disabled = false;
    }
    
    this.showPopup(`Saved ${this.gridSize}x${this.gridSize} sprite to library!`, 'success');
  }
  
  showPopup(message, type = 'info') {
    const existingPopup = document.getElementById('pixel-editor-popup');
    if (existingPopup) {
      existingPopup.remove();
    }

    const popup = document.createElement('div');
    popup.id = 'pixel-editor-popup';
    popup.className = `animation-popup ${type}`;

    const content = document.createElement('div');
    content.className = 'animation-popup-content';
    content.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'animation-popup-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
      popup.classList.add('fadeout');
      setTimeout(() => popup.remove(), 300);
    });

    popup.appendChild(content);
    popup.appendChild(closeBtn);

    document.body.appendChild(popup);

    setTimeout(() => {
      if (popup.parentNode) {
        popup.classList.add('fadeout');
        setTimeout(() => popup.remove(), 300);
      }
    }, 3000);
  }
  
  updateCursorPosition(e) {
    const rect = this.canvas.getBoundingClientRect();
    
    const exactX = (e.clientX - rect.left) / this.zoomLevel;
    const exactY = (e.clientY - rect.top) / this.zoomLevel;
    
    const pixelX = Math.floor(exactX * (this.gridSize / (rect.width / this.zoomLevel)));
    const pixelY = Math.floor(exactY * (this.gridSize / (rect.height / this.zoomLevel)));
    
    if ((this.cursorPosition.x !== pixelX || this.cursorPosition.y !== pixelY) &&
        pixelX >= 0 && pixelX < this.gridSize && pixelY >= 0 && pixelY < this.gridSize) {
      this.cursorPosition = { x: pixelX, y: pixelY };
      this.drawGrid(); 
    }
  }
  
  animateCursor() {
    this.drawGrid();
    requestAnimationFrame(() => this.animateCursor());
  }
  
  changeZoom(amount) {
    this.zoomLevel = Math.max(0.5, Math.min(4, this.zoomLevel + amount));
    
    const zoomLabel = document.getElementById('pixel-editor-zoom-level');
    if (zoomLabel) {
      zoomLabel.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    }
    
    const canvasContainer = this.canvas.parentElement;
    if (canvasContainer) {
      this.canvas.style.imageRendering = 'pixelated';
      this.canvas.style.imageRendering = '-moz-crisp-edges';
      this.canvas.style.imageRendering = 'crisp-edges';
      
      this.gridCanvas.style.imageRendering = 'pixelated';
      this.gridCanvas.style.imageRendering = '-moz-crisp-edges';
      this.gridCanvas.style.imageRendering = 'crisp-edges';
      
      this.canvas.style.transform = `scale(${this.zoomLevel})`;
      this.canvas.style.transformOrigin = 'top left';
      this.gridCanvas.style.transform = `scale(${this.zoomLevel})`;
      this.gridCanvas.style.transformOrigin = 'top left';
      
      canvasContainer.style.overflow = this.zoomLevel > 1 ? 'auto' : 'hidden';
    }
    
    this.drawGrid();
    
    this.gridCtx.imageSmoothingEnabled = false;
  }
  
  saveCurrentFrame() {
    if (!this.currentAnimation || !this.animationFrames.length) return;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.gridSize;
    tempCanvas.height = this.gridSize;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.imageSmoothingEnabled = false;
    tempCtx.drawImage(this.canvas, 0, 0, this.canvasSize, this.canvasSize, 0, 0, this.gridSize, this.gridSize);
    
    const dataUrl = tempCanvas.toDataURL('image/png');
    
    const animation = this.generator.spriteStorage.getAnimation(
      this.generator.currentAssetId,
      this.currentAnimation
    );
    
    if (animation) {
      animation.frames[this.currentFrameIndex] = dataUrl;
      
      this.generator.spriteStorage.storeAnimation(
        this.generator.currentAssetId,
        this.currentAnimation,
        animation.frames,
        animation.fps || 12
      );
      
      this.animationFrames[this.currentFrameIndex].src = dataUrl;
      
      console.log(`Saved changes to frame ${this.currentFrameIndex + 1}`);
    }
  }
  
  downloadSpriteSheet() {
    if (!this.currentAnimation || !this.animationFrames.length) {
      alert('No animation frames available to download.');
      return;
    }
    
    this.saveCurrentFrame();
    
    const spriteSheetCanvas = document.createElement('canvas');
    const spriteSize = this.gridSize;
    spriteSheetCanvas.width = spriteSize * this.animationFrames.length;
    spriteSheetCanvas.height = spriteSize;
    const ctx = spriteSheetCanvas.getContext('2d');
    
    Promise.all(this.animationFrames.map(frame => {
      return new Promise((resolve) => {
        if (frame.complete) {
          resolve(frame);
        } else {
          frame.onload = () => resolve(frame);
        }
      });
    })).then(frames => {
      frames.forEach((frame, index) => {
        ctx.drawImage(frame, index * spriteSize, 0, spriteSize, spriteSize);
      });
      
      const dataUrl = spriteSheetCanvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `spritesheet_${this.generator.currentAssetId}_${this.currentAnimation}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }
}