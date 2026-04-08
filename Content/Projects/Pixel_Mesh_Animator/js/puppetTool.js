import Delaunator from 'https://cdn.skypack.dev/delaunator@5.0.0';

export default class PuppetTool {
  constructor(spriteCanvas, pinCanvas, app) {
    this.spriteCanvas = spriteCanvas;
    this.pinCanvas = pinCanvas;
    this.app = app;
    this.spriteCtx = spriteCanvas.getContext('2d');
    this.pinCtx = pinCanvas.getContext('2d');
    
    this.pins = [];
    this.mesh = null;
    this.originalSprite = null; 
    this.currentOriginalSpriteSource = null; 
    this.currentSprite = null; 
    this.mode = 'pin'; 
    this.selectedPin = null;
    this.scale = 1; 
    this.wireframeVisible = true;
    this.pinsVisible = true;
    this.zoomLevel = 1; 
    this.spritePosition = null; // Initialize to null
    this.keepMesh = true; // Initialize keepMesh state to true

    this.initialPinStateForUndo = null;
    
    this.setupListeners();
  }
  
  setupListeners() {
    this.pinCanvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.pinCanvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.pinCanvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.pinCanvas.addEventListener('mouseleave', (e) => { 
        if (this.mode === 'move' && this.selectedPin !== null) {
            if (this.initialPinStateForUndo) {
                 const finalPinState = this.getPinStates();
                 if (JSON.stringify(this.initialPinStateForUndo) !== JSON.stringify(finalPinState)) {
                    this.app.addHistoryAction({
                        module: 'puppet',
                        actionType: 'pinMove',
                        undoData: { pins: this.initialPinStateForUndo },
                        redoData: { pins: finalPinState },
                        description: 'Move Pin'
                    });
                 }
                 this.initialPinStateForUndo = null;
            }
            this.selectedPin = null;
            this.drawPins();
        }
    });
  }
  
  setMode(mode) {
    this.mode = mode;
  }
  
  async loadSprite(imageElementOrCanvas, unscaledSource, preservePins = false) {
    if (!imageElementOrCanvas || typeof imageElementOrCanvas.width !== 'number' || typeof imageElementOrCanvas.height !== 'number' || 
        imageElementOrCanvas.width <= 0 || imageElementOrCanvas.height <= 0 || 
        isNaN(imageElementOrCanvas.width) || isNaN(imageElementOrCanvas.height) ||
        !Number.isFinite(imageElementOrCanvas.width) || !Number.isFinite(imageElementOrCanvas.height)) {
      console.warn('PuppetTool.loadSprite: Invalid imageElementOrCanvas or dimensions received.', imageElementOrCanvas);
      this.originalSprite = null;
      this.currentOriginalSpriteSource = null;
      this.currentSprite = null;
      this.pins = []; 
      this.mesh = null;
      this.selectedPin = null;
      this.spritePosition = null;
      this.spriteCtx.clearRect(0, 0, this.spriteCanvas.width, this.spriteCanvas.height);
      this.pinCtx.clearRect(0, 0, this.pinCanvas.width, this.pinCanvas.height);
      if (this.app && this.app.timeline) this.app.timeline.updateTimelineUI(); 
      return;
    }

    this.originalSprite = imageElementOrCanvas; 
    this.currentOriginalSpriteSource = unscaledSource; 
    
    if (this.originalSprite instanceof HTMLCanvasElement) {
        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload = () => {
                this.currentSprite = img;
                resolve();
            }
            img.onerror = () => {
                console.error("Failed to load canvas to image for currentSprite");
                this.currentSprite = null; 
                resolve(); 
            }
            img.src = this.originalSprite.toDataURL();
        });
    } else { 
        this.currentSprite = this.originalSprite;
    }
    await this.continueLoadSpriteAfterAsync(preservePins); 
  }

  async continueLoadSpriteAfterAsync(preservePins) { 
    if (!this.currentSprite && this.originalSprite) {
        console.warn("continueLoadSpriteAfterAsync: currentSprite is null, drawing might be affected.");
    }

    if (!preservePins) { 
        if (this.originalSprite) {
            this.pins = [ 
                { x: 0, y: 0, originalX: 0, originalY: 0 },
                { x: this.originalSprite.width, y: 0, originalX: this.originalSprite.width, originalY: 0 },
                { x: this.originalSprite.width, y: this.originalSprite.height, originalX: this.originalSprite.width, originalY: this.originalSprite.height },
                { x: 0, y: this.originalSprite.height, originalX: 0, originalY: this.originalSprite.height }
            ];
        } else {
            this.pins = [];
        }
        this.mesh = null; 
    }
    
    // If pins.length < 3, we draw the original sprite.
    // If pins.length >= 3, deformImage will handle setting currentSprite and drawing.
    if (this.pins.length >= 3) {
      this.createMesh(); // Sets up this.mesh and calls drawPins
      await this.deformImage(); // This will set currentSprite to deformed and call drawSprite
    } else {
      this.mesh = null;
      // If not deforming, we need to ensure the (undeformed) currentSprite is drawn
      this.drawSprite(); // Draw the undeformed sprite (currentSprite should be original at this point)
      this.drawPins();   // Draw the few pins
    }
  }

  resizeCanvases(width, height, wireframeVisible, pinsVisible, zoomLevel) {
    this.canvasWidth = width;
    this.canvasHeight = height;

    this.wireframeVisible = wireframeVisible;
    this.pinsVisible = pinsVisible
    this.zoomLevel = zoomLevel;
    
    if (this.originalSprite) {
      this.drawSprite();
      this.drawPins();
    }
  }
  
  drawSprite() {
    this.spriteCtx.clearRect(0, 0, this.spriteCanvas.width, this.spriteCanvas.height);
    
    if (this.currentSprite && this.originalSprite) { 
      const displayWidth = this.originalSprite.width;
      const displayHeight = this.originalSprite.height;

      const scale = Math.min(
        (this.spriteCanvas.width * 0.8) / displayWidth,
        (this.spriteCanvas.height * 0.8) / displayHeight
      );
      
      this.scale = scale > 0 && Number.isFinite(scale) ? scale : 1; // Ensure scale is valid
      
      const finalDisplayWidth = displayWidth * this.scale * this.zoomLevel;
      const finalDisplayHeight = displayHeight * this.scale * this.zoomLevel;

      const x = (this.spriteCanvas.width - finalDisplayWidth) / 2;
      const y = (this.spriteCanvas.height - finalDisplayHeight) / 2;
      
      this.spritePosition = { x, y, width: finalDisplayWidth, height: finalDisplayHeight };
      
      this.spriteCtx.imageSmoothingEnabled = false;
      this.spriteCtx.drawImage(
        this.currentSprite, 
        x, y,
        finalDisplayWidth,
        finalDisplayHeight
      );

      this.spriteCtx.strokeStyle = 'rgba(0, 0, 0, 0.5)'; 
      this.spriteCtx.lineWidth = 1;
      this.spriteCtx.strokeRect(x, y, finalDisplayWidth, finalDisplayHeight);
    } else {
        this.spritePosition = null; // Explicitly nullify if cannot draw
    }
  }
  
  addPin(x, y) {
    if (!this.spritePosition) {
        console.warn("Cannot add pin, spritePosition is not defined.");
        return;
    }
    const pinsBeforeAdd = this.getPinStates();

    const relativeX = (x - this.spritePosition.x) / this.scale / this.zoomLevel;
    const relativeY = (y - this.spritePosition.y) / this.scale / this.zoomLevel;
    
    this.pins.push({
      x: relativeX,
      y: relativeY,
      originalX: relativeX,
      originalY: relativeY
    });
    
    this.mesh = null; // Force re-triangulation when adding a pin

    const pinsAfterAdd = this.getPinStates();
    this.app.addHistoryAction({
        module: 'puppet',
        actionType: 'addPin',
        undoData: { pins: pinsBeforeAdd },
        redoData: { pins: pinsAfterAdd },
        description: 'Add Pin'
    });

    this.drawPins();
    
    if (this.pins.length >= 3) {
      this.createMesh(); 
      this.deformImage(); // This is now async, but addPin is sync. Consider if addPin should be async. For now, let it run.
    }
  }
  
  drawPins() {
    this.pinCtx.clearRect(0, 0, this.pinCanvas.width, this.pinCanvas.height);
    
    if (!this.spritePosition) { 
        // console.warn("drawPins called but spritePosition is undefined.");
        return; 
    }

    if (this.pinsVisible) {
      this.pins.forEach((pin, index) => {
        const screenX = this.spritePosition.x + pin.x * this.scale * this.zoomLevel;
        const screenY = this.spritePosition.y + pin.y * this.scale * this.zoomLevel;
        
        this.pinCtx.fillStyle = this.selectedPin === index ? '#ff0000' : '#00aaff';
        this.pinCtx.beginPath();
        this.pinCtx.arc(screenX, screenY, 6 * this.zoomLevel, 0, Math.PI * 2);
        this.pinCtx.fill();
        
        this.pinCtx.fillStyle = '#ffffff';
        this.pinCtx.font = '10px Arial';
        this.pinCtx.textAlign = 'center';
        this.pinCtx.textBaseline = 'middle';
        this.pinCtx.fillText(index.toString(), screenX, screenY);
      });
    }
    
    if (this.mesh && this.wireframeVisible) {
      this.pinCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      this.pinCtx.lineWidth = 1;
      
      for (let i = 0; i < this.mesh.triangles.length; i += 3) {
        const p1 = this.mesh.points[this.mesh.triangles[i]];
        const p2 = this.mesh.points[this.mesh.triangles[i + 1]];
        const p3 = this.mesh.points[this.mesh.triangles[i + 2]];
        
        this.pinCtx.beginPath();
        this.pinCtx.moveTo(
          this.spritePosition.x + p1.x * this.scale * this.zoomLevel,
          this.spritePosition.y + p1.y * this.scale * this.zoomLevel
        );
        this.pinCtx.lineTo(
          this.spritePosition.x + p2.x * this.scale * this.zoomLevel,
          this.spritePosition.y + p2.y * this.scale * this.zoomLevel
        );
        this.pinCtx.lineTo(
          this.spritePosition.x + p3.x * this.scale * this.zoomLevel,
          this.spritePosition.y + p3.y * this.scale * this.zoomLevel
        );
        this.pinCtx.closePath();
        this.pinCtx.stroke();
      }
    }
  }
  
  createMesh() {
    if (this.pins.length < 3) {
      this.mesh = null; 
      this.drawPins();    
      return;
    }

    const points = [...this.pins];
    
    const hasInvalidCoordinates = points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y));
    if (hasInvalidCoordinates) {
        console.error("PuppetTool.createMesh: Pins have non-finite coordinates. Cannot create mesh.");
        this.mesh = { points: points, triangles: [] }; 
        this.drawPins();
        return;
    }

    const allSameX = points.length > 0 && points.every(p => p.x === points[0].x);
    const allSameY = points.length > 0 && points.every(p => p.y === points[0].y);

    if (allSameX || allSameY) {
        // Potentially log a warning or handle gracefully if all points are collinear
        // console.warn("PuppetTool.createMesh: All pins are collinear. Delaunay triangulation might produce unexpected results or fail.");
    }
    
    // If keepMesh is true AND a valid mesh structure already exists (this.mesh is not null, and its triangles are populated)
    if (this.keepMesh && this.mesh && this.mesh.triangles && this.mesh.triangles.length > 0) {
        // Mesh structure is kept. Points (this.pins) are assumed to be updated externally (e.g., by mouse move or timeline).
        this.drawPins(); // Redraw wireframe using existing triangles and current pin positions
        return; // Skip re-triangulation
    }

    // Re-triangulate if not keeping mesh, or no valid mesh to keep, or mesh was nulled (e.g., after add/remove pin)
    const positions = this.pins.flatMap(p => [p.x, p.y]);
    
    // Check for non-finite coordinates before sending to Delaunator
    const hasInvalidPinCoordinates = this.pins.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y));
    if (hasInvalidPinCoordinates) {
        console.error("PuppetTool.createMesh: Pins array contains non-finite coordinates. Cannot create mesh.");
        this.mesh = { points: this.pins, triangles: [] }; 
        this.drawPins();
        return;
    }
    // Also check the flattened positions array just in case, though above check should cover it.
    if (positions.some(val => !Number.isFinite(val))) {
        console.error("PuppetTool.createMesh: Flattened positions array contains non-finite values. Cannot create mesh.");
        this.mesh = { points: this.pins, triangles: [] };
        this.drawPins();
        return;
    }


    try {
      const delaunay = new Delaunator(positions);
      this.mesh = {
        points: this.pins, // Reference current pins array
        triangles: Array.from(delaunay.triangles)
      };
    } catch (error) {
      console.error("Error during Delaunay triangulation:", error);
      this.mesh = { points: this.pins, triangles: [] }; 
    }
    
    this.drawPins(); 
  }
  
  async deformImage() {
    if (!this.mesh || this.pins.length < 3 || !this.originalSprite || !this.currentSprite) return;
    
    const sourceTexture = this.originalSprite; // Always deform from the original pristine sprite texture

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = sourceTexture.width;
    offscreenCanvas.height = sourceTexture.height;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    offscreenCtx.imageSmoothingEnabled = false; 
    
    // Draw the original sprite (if it's an image) or the currentSprite (if original is canvas, current is its image form)
    // For deformation, we need pixel data from the *undeformed* source.
    // If originalSprite is a canvas, currentSprite should be its direct image rendering.
    // If originalSprite is an image, it's the source.
    // The crucial part is that `drawImage` below uses the image that represents the undeformed state.
    let imageToDrawToOffscreen;
    if (this.originalSprite instanceof HTMLImageElement) {
        imageToDrawToOffscreen = this.originalSprite;
    } else if (this.originalSprite instanceof HTMLCanvasElement) {
        // Need to ensure we use the direct image version of originalSprite, not a previously deformed one
        const tempImg = new Image();
        await new Promise((resolve, reject) => {
            tempImg.onload = resolve;
            tempImg.onerror = reject;
            tempImg.src = this.originalSprite.toDataURL();
        });
        imageToDrawToOffscreen = tempImg;
    } else {
        console.error("Cannot determine source texture for deformation.");
        return;
    }
    offscreenCtx.drawImage(imageToDrawToOffscreen, 0, 0); 
    
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = sourceTexture.width;
    resultCanvas.height = sourceTexture.height;
    const resultCtx = resultCanvas.getContext('2d');
    resultCtx.imageSmoothingEnabled = false;
    
    const originalImageData = offscreenCtx.getImageData(
      0, 0, offscreenCanvas.width, offscreenCanvas.height
    );
    
    const resultImageData = resultCtx.createImageData(
      resultCanvas.width, resultCanvas.height
    );
    
    const data = resultImageData.data;
    
    for (let i = 0; i < this.mesh.triangles.length; i += 3) {
      const idx1 = this.mesh.triangles[i];
      const idx2 = this.mesh.triangles[i + 1];
      const idx3 = this.mesh.triangles[i + 2];
      
      const p1 = { x: this.pins[idx1].x, y: this.pins[idx1].y };
      const p2 = { x: this.pins[idx2].x, y: this.pins[idx2].y };
      const p3 = { x: this.pins[idx3].x, y: this.pins[idx3].y };
      
      const o1 = { x: this.pins[idx1].originalX, y: this.pins[idx1].originalY };
      const o2 = { x: this.pins[idx2].originalX, y: this.pins[idx2].originalY };
      const o3 = { x: this.pins[idx3].originalX, y: this.pins[idx3].originalY };
      
      const minX = Math.max(0, Math.floor(Math.min(p1.x, p2.x, p3.x)));
      const minY = Math.max(0, Math.floor(Math.min(p1.y, p2.y, p3.y)));
      const maxX = Math.min(resultCanvas.width - 1, Math.ceil(Math.max(p1.x, p2.x, p3.x)));
      const maxY = Math.min(resultCanvas.height - 1, Math.ceil(Math.max(p1.y, p2.y, p3.y)));
      
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (this.pointInTriangle(x, y, p1, p2, p3)) {
            const baryCoords = this.getBarycentricCoordinates(x, y, p1, p2, p3);
            
            const origX = Math.round(
              baryCoords.a * o1.x + baryCoords.b * o2.x + baryCoords.c * o3.x
            );
            const origY = Math.round(
              baryCoords.a * o1.y + baryCoords.b * o2.y + baryCoords.c * o3.y
            );
            
            if (origX >= 0 && origX < originalImageData.width && 
                origY >= 0 && origY < originalImageData.height) {
              
              const origPos = (origY * originalImageData.width + origX) * 4;
              const newPos = (y * resultCanvas.width + x) * 4;
              
              data[newPos] = originalImageData.data[origPos];
              data[newPos + 1] = originalImageData.data[origPos + 1];
              data[newPos + 2] = originalImageData.data[origPos + 2];
              data[newPos + 3] = originalImageData.data[origPos + 3];
            }
          }
        }
      }
    }
    
    resultCtx.putImageData(resultImageData, 0, 0);
    
    const deformedImage = new Image();
    await new Promise((resolve, reject) => {
        deformedImage.onload = () => {
          this.currentSprite = deformedImage;
          this.drawSprite();
          resolve();
        };
        deformedImage.onerror = () => {
            console.error("Failed to load deformed image from data URL in deformImage.");
            resolve(); // Or reject
        }
        deformedImage.src = resultCanvas.toDataURL();
    });
  }
  
  pointInTriangle(px, py, p1, p2, p3) {
    const area = 0.5 * Math.abs(
      (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y))
    );
    
    const a1 = 0.5 * Math.abs((px * (p2.y - p3.y) + p2.x * (p3.y - py) + p3.x * (py - p2.y)));
    const a2 = 0.5 * Math.abs((p1.x * (py - p3.y) + px * (p3.y - p1.y) + p3.x * (p1.y - py)));
    const a3 = 0.5 * Math.abs((p1.x * (p2.y - py) + p2.x * (py - p1.y) + px * (p1.y - p2.y)));
    
    return Math.abs(area - (a1 + a2 + a3)) < 0.00001;
  }
  
  getBarycentricCoordinates(px, py, p1, p2, p3) {
    const denominator = ((p2.y - p3.y) * (p1.x - p3.x) + (p3.x - p2.x) * (p1.y - p3.y));
    
    const a = ((p2.y - p3.y) * (px - p3.x) + (p3.x - p2.x) * (py - p3.y)) / denominator;
    const b = ((p3.y - p1.y) * (px - p3.x) + (p1.x - p3.x) * (py - p3.y)) / denominator;
    const c = 1 - a - b;
    
    return { a, b, c };
  }
  
  clearPins() {
    if (this.pins.length === 0 && !this.mesh) return; 

    const pinsBeforeClear = this.getPinStates();

    this.pins = [];
    this.mesh = null;
    this.selectedPin = null;
    
    this.app.addHistoryAction({
        module: 'puppet',
        actionType: 'clearPins',
        undoData: { pins: pinsBeforeClear },
        redoData: { pins: [] }, 
        description: 'Clear Pins'
    });

    if (this.originalSprite) {
      // Reset currentSprite to the image version of originalSprite
      if (this.originalSprite instanceof HTMLCanvasElement) {
          const img = new Image();
          // This part is tricky if clearPins is synchronous.
          // For now, assume it might briefly show old currentSprite if this is async.
          img.onload = () => { this.currentSprite = img; this.drawSprite(); this.drawPins(); }
          img.src = this.originalSprite.toDataURL();
      } else {
          this.currentSprite = this.originalSprite; 
          this.drawSprite(); 
      }
    } else {
        this.currentSprite = null;
        this.drawSprite(); // Will clear and set spritePosition to null
    }
    
    this.pinCtx.clearRect(0, 0, this.pinCanvas.width, this.pinCanvas.height); 
    this.drawPins(); // Redraw pins (which will be empty)
  }
  
  findNearestPin(x, y) {
    if (!this.spritePosition) return -1;
    let nearestIndex = -1;
    let minDistance = Infinity;
    
    this.pins.forEach((pin, index) => {
      const screenX = this.spritePosition.x + pin.x * this.scale * this.zoomLevel;
      const screenY = this.spritePosition.y + pin.y * this.scale * this.zoomLevel;
      
      const distance = Math.sqrt((x - screenX) ** 2 + (y - screenY) ** 2);
      
      if (distance < minDistance && distance < 10 * this.zoomLevel) { // Scale click radius with zoom
        minDistance = distance;
        nearestIndex = index;
      }
    });
    
    return nearestIndex;
  }
  
  async removePin(pinIndex) { // Make async due to potential deformImage
    if (pinIndex < 0 || pinIndex >= this.pins.length) {
      console.warn(`Invalid pinIndex ${pinIndex} for removal.`);
      return;
    }

    const pinsBeforeRemove = this.getPinStates();

    this.pins.splice(pinIndex, 1);
    this.mesh = null; // Force re-triangulation when removing a pin

    const pinsAfterRemove = this.getPinStates();

    this.app.addHistoryAction({
        module: 'puppet',
        actionType: 'removePin',
        undoData: { pins: pinsBeforeRemove },
        redoData: { pins: pinsAfterRemove },
        description: 'Remove Pin'
    });

    if (this.pins.length < 3) {
        this.mesh = null;
        if (this.originalSprite) {
            if (this.originalSprite instanceof HTMLCanvasElement) {
                const img = new Image();
                await new Promise(resolve => {
                    img.onload = () => { this.currentSprite = img; resolve(); };
                    img.onerror = () => { this.currentSprite = null; resolve(); };
                    img.src = this.originalSprite.toDataURL();
                });
            } else {
                this.currentSprite = this.originalSprite;
            }
            this.drawSprite();
        }
    } else {
        this.createMesh(); 
        await this.deformImage();
    }
    this.drawPins(); 
  }
  
  handleMouseDown(e) {
    const rect = this.pinCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (!this.originalSprite || !this.spritePosition) { 
      return;
    }

    if (this.mode === 'pin') {
      if (
        x >= this.spritePosition.x && 
        x <= this.spritePosition.x + this.spritePosition.width && 
        y >= this.spritePosition.y && 
        y <= this.spritePosition.y + this.spritePosition.height
      ) {
        this.addPin(x, y); // addPin might become async if deformImage is consistently awaited
      }
    } else if (this.mode === 'move') {
      this.selectedPin = this.findNearestPin(x, y);
      if (this.selectedPin !== null && this.selectedPin !== -1) { 
        this.initialPinStateForUndo = this.getPinStates(); 
      }
      this.drawPins();
    } else if (this.mode === 'removePin') {
      const pinToRemoveIndex = this.findNearestPin(x, y);
      if (pinToRemoveIndex !== -1) {
        this.removePin(pinToRemoveIndex); // removePin is now async
      }
    }
  }
  
  async handleMouseMove(e) { // make async
    if (this.mode === 'move' && this.selectedPin !== null && this.selectedPin !== -1 && this.pins[this.selectedPin]) {
      if (!this.spritePosition) return;
      const rect = this.pinCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const newPinX = (x - this.spritePosition.x) / this.scale / this.zoomLevel;
      const newPinY = (y - this.spritePosition.y) / this.scale / this.zoomLevel;

      if (Math.abs(this.pins[this.selectedPin].x - newPinX) > 0.01 || Math.abs(this.pins[this.selectedPin].y - newPinY) > 0.01) {
        this.pins[this.selectedPin].x = newPinX;
        this.pins[this.selectedPin].y = newPinY;
        
        this.drawPins(); 
        await this.deformImage(); 
      }
    }
  }
  
  handleMouseUp() {
    if (this.mode === 'move' && this.selectedPin !== null && this.selectedPin !== -1 && this.initialPinStateForUndo) {
      const finalPinState = this.getPinStates();
      if (JSON.stringify(this.initialPinStateForUndo) !== JSON.stringify(finalPinState)) {
        this.app.addHistoryAction({
            module: 'puppet',
            actionType: 'pinMove',
            undoData: { pins: this.initialPinStateForUndo },
            redoData: { pins: finalPinState },
            description: 'Move Pin'
        });
      }
      this.initialPinStateForUndo = null;
      this.selectedPin = null;
      this.drawPins(); 
    } else if (this.mode === 'move') { 
        this.initialPinStateForUndo = null;
        this.selectedPin = null;
        this.drawPins();
    } else { 
        this.selectedPin = null;
        this.initialPinStateForUndo = null;
    }
  }
  
  getPinStates() {
    return this.pins.map(pin => ({ 
      x: pin.x, 
      y: pin.y, 
      originalX: pin.originalX, 
      originalY: pin.originalY 
    }));
  }
  
  async setPinStates(pinStates, isInternal = false) { 
    const oldPinCount = this.pins.length;
    const newPinsArray = pinStates.map(state => ({ 
      x: state.x, 
      y: state.y, 
      originalX: state.originalX, 
      originalY: state.originalY 
    }));
    const newPinCount = newPinsArray.length;
    
    let oldTriangles = null;
    if (this.keepMesh && this.mesh && oldPinCount === newPinCount && newPinCount >=3) {
        oldTriangles = this.mesh.triangles;
    }

    this.pins = newPinsArray;

    if (!this.originalSprite) {
        this.spriteCtx.clearRect(0, 0, this.spriteCanvas.width, this.spriteCanvas.height);
        this.pinCtx.clearRect(0, 0, this.pinCanvas.width, this.pinCanvas.height);
        this.mesh = null;
        this.spritePosition = null;
        this.currentSprite = null; 
        return; 
    }
    
    if (this.pins.length >= 3) {
        if (oldTriangles) { 
            this.mesh = {
                points: this.pins, 
                triangles: oldTriangles 
            };
            this.drawPins(); 
        } else {
            this.mesh = null; 
            this.createMesh(); 
        }
        await this.deformImage(); // This will set currentSprite to deformed and call drawSprite.
    } else {
        this.mesh = null;
        // Less than 3 pins, no deformation. Set currentSprite to the original and draw.
        if (this.originalSprite instanceof HTMLCanvasElement) {
            const img = new Image();
            await new Promise((resolve) => {
                img.onload = () => { this.currentSprite = img; resolve(); };
                img.onerror = () => { this.currentSprite = null; resolve(); }; // Handle error
                img.src = this.originalSprite.toDataURL();
            });
        } else { // originalSprite is an Image
            this.currentSprite = this.originalSprite;
        }
        this.drawSprite(); 
        this.drawPins(); 
    }
  }
  
  setWireframeVisibility(visible) {
    this.wireframeVisible = visible;
    this.drawPins();
  }

  setPinsVisibility(visible) {
    this.pinsVisible = visible;
    this.drawPins();
  }

  setKeepMesh(enabled) {
    this.keepMesh = enabled;
    if (!enabled && this.pins.length >= 3) { // Turning OFF "Keep Mesh"
        this.mesh = null; // Force re-triangulation
        this.createMesh();
        if (this.mesh) { // Ensure mesh was successfully created before deforming
            this.deformImage(); // Redraw with new optimal mesh
        }
    } else if (enabled && (!this.mesh || (this.mesh.triangles && this.mesh.triangles.length === 0)) && this.pins.length >= 3) { 
        // Turning ON "Keep Mesh", but no valid mesh exists to be "kept" (e.g., first time or after mesh was cleared)
        this.createMesh(); // Create an initial mesh
        if (this.mesh) {
            this.deformImage();
        }
    }
    // If turning ON and a valid mesh already exists, it's now "kept" for subsequent operations.
    // If <3 pins, mesh will be null anyway, and createMesh handles that.
  }
  
  getCurrentRenderAsImageData(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    ctx.imageSmoothingEnabled = false;
    
    if (this.currentSprite) {
      ctx.drawImage(this.currentSprite, 0, 0, width, height);
    }
    
    return ctx.getImageData(0, 0, width, height);
  }
}