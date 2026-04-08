import { AnimatePlugin } from './plugin.js';

export class AnimateViewport {
  constructor(generator) {
    this.generator = generator;
    this.plugin = new AnimatePlugin(this);
    this.activeSpriteId = null;
    this.activeSpriteSize = "32";
    this.frames = [];
    this.currentFrame = 0;
    this.isPlaying = false;
    this.fps = 12;
    this.animationInterval = null;
    this.animationType = 'breathe';
  }

  createUI() {
    const container = document.createElement('div');
    container.className = 'animate-container';
    container.id = 'animate-container';
    container.style.display = 'none';
    
    const title = document.createElement('h1');
    title.textContent = 'Sprite Animation Studio';
    container.appendChild(title);
    
    // Back button to return to the main editor
    const backBtn = document.createElement('button');
    backBtn.className = 'back-btn';
    backBtn.textContent = '← Back to Pixel Art';
    backBtn.id = 'back-to-pixel-art-from-animate';
    container.appendChild(backBtn);
    
    // Split view for sprite and animation controls
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'animate-content-wrapper';
    
    // Left side - sprite preview and grid
    const spriteSection = document.createElement('div');
    spriteSection.className = 'animate-sprite-section';
    
    // Animation preview area
    const animationPreview = document.createElement('div');
    animationPreview.className = 'animation-preview';
    
    const animationCanvas = document.createElement('canvas');
    animationCanvas.className = 'animation-canvas';
    animationCanvas.width = 256;
    animationCanvas.height = 256;
    animationCanvas.id = 'animation-canvas';
    animationPreview.appendChild(animationCanvas);
    
    spriteSection.appendChild(animationPreview);
    
    // Sprite selection grid
    const spriteGridSection = document.createElement('div');
    spriteGridSection.className = 'animate-sprite-grid-section';
    
    const gridTitle = document.createElement('h4');
    gridTitle.textContent = 'Select Sprite';
    spriteGridSection.appendChild(gridTitle);
    
    const spriteGrid = document.createElement('div');
    spriteGrid.className = 'animate-sprite-grid';
    spriteGrid.id = 'animate-sprite-grid';
    spriteGridSection.appendChild(spriteGrid);
    
    spriteSection.appendChild(spriteGridSection);
    
    // Right side - animation controls
    const animateControlSection = document.createElement('div');
    animateControlSection.className = 'animate-control-section';
    
    const controlTitle = document.createElement('h3');
    controlTitle.textContent = 'Animation Controls';
    animateControlSection.appendChild(controlTitle);
    
    // Animation type selector
    const animTypeControl = document.createElement('div');
    animTypeControl.className = 'animation-type-control';
    
    const animTypeLabel = document.createElement('label');
    animTypeLabel.textContent = 'Animation Type:';
    animTypeControl.appendChild(animTypeLabel);
    
    const animTypeSelect = document.createElement('select');
    animTypeSelect.id = 'animation-type';
    
    const animationTypes = ['breathe', 'hit', 'run', 'jump', 'attack', 'attack-2', 
                          'death', 'bounce', 'bounce-2', 'side-wave', 'side-wave-2', 'finale'];
    animationTypes.forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
      animTypeSelect.appendChild(option);
    });
    
    animTypeControl.appendChild(animTypeSelect);
    animateControlSection.appendChild(animTypeControl);
    
    // FPS control
    const fpsControl = document.createElement('div');
    fpsControl.className = 'fps-control';
    
    const fpsLabel = document.createElement('label');
    fpsLabel.textContent = 'Speed (FPS):';
    fpsLabel.htmlFor = 'fps-slider';
    fpsControl.appendChild(fpsLabel);
    
    const fpsValue = document.createElement('span');
    fpsValue.id = 'fps-value';
    fpsValue.textContent = '12';
    fpsControl.appendChild(fpsValue);
    
    const fpsSlider = document.createElement('input');
    fpsSlider.type = 'range';
    fpsSlider.min = '1';
    fpsSlider.max = '30';
    fpsSlider.value = '12';
    fpsSlider.id = 'fps-slider';
    fpsControl.appendChild(fpsSlider);
    
    animateControlSection.appendChild(fpsControl);
    
    // Parameter sliders
    const paramSection = document.createElement('div');
    paramSection.className = 'animation-param-section';
    
    const paramTitle = document.createElement('h4');
    paramTitle.textContent = 'Animation Parameters';
    paramSection.appendChild(paramTitle);
    
    // Intensity control
    const intensityControl = document.createElement('div');
    intensityControl.className = 'param-control';
    
    const intensityLabel = document.createElement('label');
    intensityLabel.textContent = 'Intensity:';
    intensityLabel.htmlFor = 'intensity-slider';
    intensityControl.appendChild(intensityLabel);
    
    const intensityValue = document.createElement('span');
    intensityValue.id = 'intensity-value';
    intensityValue.textContent = '50%';
    intensityControl.appendChild(intensityValue);
    
    const intensitySlider = document.createElement('input');
    intensitySlider.type = 'range';
    intensitySlider.min = '0';
    intensitySlider.max = '100';
    intensitySlider.value = '50';
    intensitySlider.id = 'intensity-slider';
    intensityControl.appendChild(intensitySlider);
    
    paramSection.appendChild(intensityControl);
    
    // Smoothness control
    const smoothnessControl = document.createElement('div');
    smoothnessControl.className = 'param-control';
    
    const smoothnessLabel = document.createElement('label');
    smoothnessLabel.textContent = 'Smoothness:';
    smoothnessLabel.htmlFor = 'smoothness-slider';
    smoothnessControl.appendChild(smoothnessLabel);
    
    const smoothnessValue = document.createElement('span');
    smoothnessValue.id = 'smoothness-value';
    smoothnessValue.textContent = '50%';
    smoothnessControl.appendChild(smoothnessValue);
    
    const smoothnessSlider = document.createElement('input');
    smoothnessSlider.type = 'range';
    smoothnessSlider.min = '0';
    smoothnessSlider.max = '100';
    smoothnessSlider.value = '50';
    smoothnessSlider.id = 'smoothness-slider';
    smoothnessControl.appendChild(smoothnessSlider);
    
    paramSection.appendChild(smoothnessControl);
    
    // Frames control
    const framesControl = document.createElement('div');
    framesControl.className = 'param-control';
    
    const framesLabel = document.createElement('label');
    framesLabel.textContent = 'Frames:';
    framesLabel.htmlFor = 'frames-slider';
    framesControl.appendChild(framesLabel);
    
    const framesValue = document.createElement('span');
    framesValue.id = 'frames-value';
    framesValue.textContent = '8';
    framesControl.appendChild(framesValue);
    
    const framesSlider = document.createElement('input');
    framesSlider.type = 'range';
    framesSlider.min = '2';
    framesSlider.max = '16';
    framesSlider.value = '8';
    framesSlider.id = 'frames-slider';
    framesControl.appendChild(framesSlider);
    
    paramSection.appendChild(framesControl);
    
    animateControlSection.appendChild(paramSection);
    
    // Animation preview controls
    const previewControls = document.createElement('div');
    previewControls.className = 'animation-preview-controls';
    
    const generateBtn = document.createElement('button');
    generateBtn.className = 'animation-generate-btn';
    generateBtn.textContent = 'Generate Animation';
    generateBtn.id = 'generate-animation-btn';
    previewControls.appendChild(generateBtn);
    
    const playBtn = document.createElement('button');
    playBtn.className = 'animation-play-btn';
    playBtn.textContent = 'Play';
    playBtn.id = 'play-animation-btn';
    playBtn.disabled = true;
    previewControls.appendChild(playBtn);
    
    const stopBtn = document.createElement('button');
    stopBtn.className = 'animation-stop-btn';
    stopBtn.textContent = 'Stop';
    stopBtn.id = 'stop-animation-btn';
    stopBtn.disabled = true;
    previewControls.appendChild(stopBtn);
    
    // Export options
    const exportBtn = document.createElement('button');
    exportBtn.className = 'animation-export-btn';
    exportBtn.textContent = 'Export Spritesheet';
    exportBtn.id = 'export-animation-btn';
    exportBtn.disabled = true;
    previewControls.appendChild(exportBtn);
    
    const addToLibraryBtn = document.createElement('button');
    addToLibraryBtn.className = 'animation-add-to-library-btn';
    addToLibraryBtn.textContent = 'Add to Library to Edit';
    addToLibraryBtn.id = 'add-animation-to-library-btn';
    addToLibraryBtn.disabled = true;
    previewControls.appendChild(addToLibraryBtn);
    
    animateControlSection.appendChild(previewControls);
    
    // Frame navigation
    const frameNav = document.createElement('div');
    frameNav.className = 'frame-navigation';
    
    const frameTitle = document.createElement('h4');
    frameTitle.textContent = 'Frame Navigation';
    frameNav.appendChild(frameTitle);
    
    const frameDisplay = document.createElement('div');
    frameDisplay.className = 'frame-display';
    frameDisplay.id = 'frame-display';
    frameDisplay.textContent = 'Frame: 0 / 0';
    frameNav.appendChild(frameDisplay);
    
    const frameButtons = document.createElement('div');
    frameButtons.className = 'frame-buttons';
    
    const prevFrameBtn = document.createElement('button');
    prevFrameBtn.className = 'prev-frame-btn';
    prevFrameBtn.textContent = '◀ Previous';
    prevFrameBtn.id = 'prev-frame-btn';
    prevFrameBtn.disabled = true;
    frameButtons.appendChild(prevFrameBtn);
    
    const nextFrameBtn = document.createElement('button');
    nextFrameBtn.className = 'next-frame-btn';
    nextFrameBtn.textContent = 'Next ▶';
    nextFrameBtn.id = 'next-frame-btn';
    nextFrameBtn.disabled = true;
    frameButtons.appendChild(nextFrameBtn);
    
    frameNav.appendChild(frameButtons);
    animateControlSection.appendChild(frameNav);
    
    contentWrapper.appendChild(spriteSection);
    contentWrapper.appendChild(animateControlSection);
    container.appendChild(contentWrapper);
    
    document.body.appendChild(container);
    
    // Update the sprite grid
    this.updateSpriteGrid();
    
    // Bind events
    this.bindEvents();
    
    return container;
  }
  
  bindEvents() {
    const backBtn = document.getElementById('back-to-pixel-art-from-animate');
    backBtn.addEventListener('click', () => {
      // Stop any running animation before toggling the view
      if (this.isPlaying) {
        this.stopAnimation();
      }
      this.toggleView(false);
    });
    
    // Animation type selector
    const animTypeSelect = document.getElementById('animation-type');
    animTypeSelect.addEventListener('change', (e) => {
      // Stop any currently playing animation when changing types
      if (this.isPlaying) {
        this.stopAnimation();
      }
      this.animationType = e.target.value;
    });
    
    // FPS slider
    const fpsSlider = document.getElementById('fps-slider');
    fpsSlider.addEventListener('input', (e) => {
      this.fps = parseInt(e.target.value);
      document.getElementById('fps-value').textContent = this.fps;
      
      // Update animation speed if playing
      if (this.isPlaying) {
        this.stopAnimation();
        this.playAnimation();
      }
    });
    
    // Parameter sliders
    const intensitySlider = document.getElementById('intensity-slider');
    intensitySlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      document.getElementById('intensity-value').textContent = `${value}%`;
    });
    
    const smoothnessSlider = document.getElementById('smoothness-slider');
    smoothnessSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      document.getElementById('smoothness-value').textContent = `${value}%`;
    });
    
    const framesSlider = document.getElementById('frames-slider');
    framesSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      document.getElementById('frames-value').textContent = value;
    });
    
    // Animation controls
    const generateBtn = document.getElementById('generate-animation-btn');
    generateBtn.addEventListener('click', () => {
      this.generateAnimation();
    });
    
    const playBtn = document.getElementById('play-animation-btn');
    playBtn.addEventListener('click', () => {
      this.playAnimation();
    });
    
    const stopBtn = document.getElementById('stop-animation-btn');
    stopBtn.addEventListener('click', () => {
      this.stopAnimation();
    });
    
    const exportBtn = document.getElementById('export-animation-btn');
    exportBtn.addEventListener('click', () => {
      this.exportSpritesheet();
    });
    
    const addToLibraryBtn = document.getElementById('add-animation-to-library-btn');
    addToLibraryBtn.addEventListener('click', () => {
      this.addAnimationToLibrary();
    });
    
    // Frame navigation
    const prevFrameBtn = document.getElementById('prev-frame-btn');
    prevFrameBtn.addEventListener('click', () => {
      this.showPreviousFrame();
    });
    
    const nextFrameBtn = document.getElementById('next-frame-btn');
    nextFrameBtn.addEventListener('click', () => {
      this.showNextFrame();
    });
  }
  
  updateSpriteGrid() {
    const spriteGrid = document.getElementById('animate-sprite-grid');
    if (!spriteGrid) return;
    
    // Clear existing content
    spriteGrid.innerHTML = '';
    
    // Add thumbnails for all sprites in storage
    for (const id of this.generator.libraryShowcase.spriteIds) {
      const sizes = ['32', '64', '128', '256'];
      
      // Create container for sprite with dropdown
      const spriteContainer = document.createElement('div');
      spriteContainer.className = 'animate-sprite-container';
      spriteContainer.dataset.id = id;
      
      // Find first available sprite size
      let spriteUrl = null;
      let spriteSize = null;
      
      for (const size of sizes) {
        if (this.generator.spriteStorage.sprites[id][size]) {
          spriteUrl = this.generator.spriteStorage.sprites[id][size];
          spriteSize = size;
          break;
        }
      }
      
      if (spriteUrl) {
        const thumbnail = document.createElement('div');
        thumbnail.className = 'animate-sprite-thumbnail';
        thumbnail.dataset.id = id;
        thumbnail.dataset.size = spriteSize;
        
        if (id === this.activeSpriteId && spriteSize === this.activeSpriteSize) {
          thumbnail.classList.add('active');
        }
        
        const img = document.createElement('img');
        img.crossOrigin = 'anonymous';
        img.src = spriteUrl;
        img.alt = `Sprite ${id.split('_')[2]}`;
        
        thumbnail.appendChild(img);
        
        // Create resolution dropdown
        const resolutionDropdown = document.createElement('select');
        resolutionDropdown.className = 'animate-sprite-resolution';
        
        sizes.forEach(size => {
          if (this.generator.spriteStorage.sprites[id][size]) {
            const option = document.createElement('option');
            option.value = size;
            option.textContent = `${size}x${size} px`;
            
            if (size === spriteSize) {
              option.selected = true;
            }
            
            resolutionDropdown.appendChild(option);
          }
        });
        
        // Add change event to dropdown
        resolutionDropdown.addEventListener('change', (e) => {
          const selectedSize = e.target.value;
          this.selectSprite(id, selectedSize);
        });
        
        // Add click handler to select this sprite
        thumbnail.addEventListener('click', () => {
          // Update selection UI
          document.querySelectorAll('.animate-sprite-thumbnail').forEach(t => 
            t.classList.remove('active'));
          thumbnail.classList.add('active');
          
          // Select this sprite for animation
          this.selectSprite(id, resolutionDropdown.value);
        });
        
        spriteContainer.appendChild(thumbnail);
        spriteContainer.appendChild(resolutionDropdown);
        
        spriteGrid.appendChild(spriteContainer);
      }
    }
  }
  
  selectSprite(id, size) {
    this.activeSpriteId = id;
    this.activeSpriteSize = size;
    
    // Load the sprite into the animation canvas
    const spriteData = this.generator.spriteStorage.getSprite(id, size);
    if (spriteData) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.getElementById('animation-canvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Calculate scaling to fit the canvas while maintaining aspect ratio
        const scale = Math.min(
          canvas.width / img.width,
          canvas.height / img.height
        );
        
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        const x = (canvas.width - scaledWidth) / 2;
        const y = (canvas.height - scaledHeight) / 2;
        
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
      };
      img.src = spriteData;
    }
    
    // Reset animation state
    this.frames = [];
    this.currentFrame = 0;
    this.isPlaying = false;
    this.updateFrameDisplay();
    
    // Disable buttons until animation is generated
    document.getElementById('play-animation-btn').disabled = true;
    document.getElementById('stop-animation-btn').disabled = true;
    document.getElementById('export-animation-btn').disabled = true;
    document.getElementById('add-animation-to-library-btn').disabled = true;
    document.getElementById('prev-frame-btn').disabled = true;
    document.getElementById('next-frame-btn').disabled = true;
  }
  
  toggleView(show) {
    const animateContainer = document.getElementById('animate-container');
    const container = document.querySelector('.container');
    
    if (show) {
      animateContainer.style.display = 'block';
      container.style.display = 'none';
      
      // Update the sprite grid
      this.updateSpriteGrid();
      
      // If we have a current asset ID from the generator, use it
      if (this.generator.currentAssetId) {
        const size = this.generator.soundSelectedSpriteSize || "32";
        this.selectSprite(this.generator.currentAssetId, size);
      }
    } else {
      // Stop any running animation before toggling the view
      if (this.isPlaying) {
        this.stopAnimation();
      }
      animateContainer.style.display = 'none';
      container.style.display = 'block';
    }
  }
  
  async generateAnimation() {
    if (!this.activeSpriteId) {
      this.showPopup('Please select a sprite first.', 'warning');
      return;
    }
    
    // Stop any currently playing animation first
    if (this.isPlaying) {
      this.stopAnimation();
    }
    
    // Get animation parameters
    const framesCount = parseInt(document.getElementById('frames-slider').value);
    const intensity = parseInt(document.getElementById('intensity-slider').value) / 100;
    const smoothness = parseInt(document.getElementById('smoothness-slider').value) / 100;
    
    console.log(`Starting animation generation with: ${framesCount} frames, intensity ${intensity}, smoothness ${smoothness}`);
    
    try {
      // Generate animation frames - await the promise
      this.frames = await this.plugin.generateAnimationFrames(
        this.activeSpriteId,
        this.activeSpriteSize,
        this.animationType,
        framesCount,
        intensity,
        smoothness
      );
      
      console.log(`Received ${this.frames.length} frames from plugin`);
      
      this.currentFrame = 0;
      this.showCurrentFrame();
      
      // Enable animation controls
      document.getElementById('play-animation-btn').disabled = false;
      document.getElementById('stop-animation-btn').disabled = false;
      document.getElementById('export-animation-btn').disabled = false;
      document.getElementById('add-animation-to-library-btn').disabled = false;
      document.getElementById('prev-frame-btn').disabled = false;
      document.getElementById('next-frame-btn').disabled = false;
      
      // Update frame display
      this.updateFrameDisplay();
    } catch (error) {
      console.error("Error generating animation:", error);
      this.showPopup('Failed to generate animation. Please try again.', 'warning');
    }
  }
  
  showCurrentFrame() {
    if (this.frames.length === 0 || this.currentFrame >= this.frames.length) return;
    
    const canvas = document.getElementById('animation-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the current frame
    const frameImg = this.frames[this.currentFrame];
    if (frameImg) {
      // Calculate scaling to fit the canvas while maintaining aspect ratio
      const scale = Math.min(
        canvas.width / frameImg.width,
        canvas.height / frameImg.height
      );
      
      const scaledWidth = frameImg.width * scale;
      const scaledHeight = frameImg.height * scale;
      const x = (canvas.width - scaledWidth) / 2;
      const y = (canvas.height - scaledHeight) / 2;
      
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(frameImg, x, y, scaledWidth, scaledHeight);
    }
    
    this.updateFrameDisplay();
  }
  
  showNextFrame() {
    if (this.frames.length === 0) return;
    this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    this.showCurrentFrame();
  }
  
  showPreviousFrame() {
    if (this.frames.length === 0) return;
    this.currentFrame = (this.currentFrame - 1 + this.frames.length) % this.frames.length;
    this.showCurrentFrame();
  }
  
  playAnimation() {
    if (this.frames.length === 0 || this.isPlaying) return;
    
    this.isPlaying = true;
    document.getElementById('play-animation-btn').disabled = true;
    document.getElementById('stop-animation-btn').disabled = false;
    
    // Calculate frame duration based on FPS
    const frameDuration = 1000 / this.fps;
    
    this.animationInterval = setInterval(() => {
      this.showNextFrame();
    }, frameDuration);
  }
  
  stopAnimation() {
    if (!this.isPlaying) return;
    
    clearInterval(this.animationInterval);
    this.isPlaying = false;
    document.getElementById('play-animation-btn').disabled = false;
    document.getElementById('stop-animation-btn').disabled = true;
  }
  
  updateFrameDisplay() {
    const frameDisplay = document.getElementById('frame-display');
    if (this.frames && this.frames.length > 0) {
      frameDisplay.textContent = `Frame: ${this.currentFrame + 1} / ${this.frames.length}`;
    } else {
      frameDisplay.textContent = 'Frame: 0 / 0';
    }
  }
  
  exportSpritesheet() {
    if (this.frames.length === 0) {
      this.showPopup('No animation to export. Please generate an animation first.', 'warning');
      return;
    }
    
    // Create a canvas for the spritesheet
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const frameWidth = parseInt(this.activeSpriteSize);
    const frameHeight = parseInt(this.activeSpriteSize);
    
    // Set canvas size to fit all frames in a row
    canvas.width = frameWidth * this.frames.length;
    canvas.height = frameHeight;
    
    // Draw each frame side by side
    this.frames.forEach((frameImg, i) => {
      ctx.drawImage(frameImg, i * frameWidth, 0, frameWidth, frameHeight);
    });
    
    // Convert to data URL and trigger download
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `sprite-animation-${this.animationType}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  addAnimationToLibrary() {
    if (!this.activeSpriteId || this.frames.length === 0) {
      this.showPopup('Please generate an animation first.', 'warning');
      return;
    }

    // Store the animation in sprite storage
    this.generator.spriteStorage.storeAnimation(
      this.activeSpriteId,
      this.animationType,
      this.frames,
      this.fps
    );

    // Update the library panel to show the animation options
    this.generator.updateLibraryPanel();
    
    // Update the pixel editor with the current sprite and grid size
    if (this.generator.pixelEditor) {
      const gridSize = parseInt(document.getElementById('pixel-grid-size')?.value || '32');
      this.generator.pixelEditor.loadSpriteForEditing(
        this.activeSpriteId, 
        gridSize
      );
    }
    
    // Show a nice success popup
    this.showPopup(`${this.animationType.charAt(0).toUpperCase() + this.animationType.slice(1)} animation added to library!`, 'success');
  }
  
  showPopup(message, type = 'info') {
    // Remove any existing popups
    const existingPopup = document.getElementById('animation-popup');
    if (existingPopup) {
      existingPopup.remove();
    }

    // Create popup container
    const popup = document.createElement('div');
    popup.id = 'animation-popup';
    popup.className = `animation-popup ${type}`;

    // Create popup content
    const content = document.createElement('div');
    content.className = 'animation-popup-content';
    content.textContent = message;

    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'animation-popup-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
      popup.classList.add('fadeout');
      setTimeout(() => popup.remove(), 300);
    });

    // Assemble popup
    popup.appendChild(content);
    popup.appendChild(closeBtn);

    // Add to body and auto-remove after a few seconds
    document.body.appendChild(popup);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (popup.parentNode) {
        popup.classList.add('fadeout');
        setTimeout(() => popup.remove(), 300);
      }
    }, 3000);
  }
}