export class LibraryShowcase {
  constructor(spriteStorage, paletteStorage) {
    this.spriteStorage = spriteStorage;
    this.paletteStorage = paletteStorage;
    this.soundStorage = null; // Will be set after initialization
    this.spriteIds = [];
  }

  generateId() {
    return 'sprite_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  }

  addNewAsset() {
    const id = this.generateId();
    this.spriteStorage.createSprite(id);
    this.paletteStorage.createPalette(id);
    this.spriteIds.push(id);
    return id;
  }

  generateShowcase() {
    const showcase = {
      sprites: this.spriteStorage.getAllSprites(),
      palettes: this.paletteStorage.getAllPalettes(),
      sounds: this.soundStorage ? this.soundStorage.getAllSounds() : {},
      currentId: this.spriteStorage.getCurrentId(),
      spriteIds: this.spriteIds
    };
    
    return showcase;
  }

  exportAsJson() {
    const showcase = this.generateShowcase();
    return JSON.stringify(showcase, null, 2);
  }

  importFromJson(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      
      // Import sprites
      if (data.sprites) {
        for (const id in data.sprites) {
          for (const size in data.sprites[id]) {
            if (data.sprites[id][size]) {
              this.spriteStorage.storeSprite(id, size, data.sprites[id][size]);
            }
          }
        }
      }
      
      // Import palettes
      if (data.palettes) {
        for (const id in data.palettes) {
          for (const size in data.palettes[id]) {
            if (data.palettes[id][size]) {
              this.paletteStorage.storePalette(id, size, data.palettes[id][size]);
            }
          }
        }
      }
      
      // Import sounds
      if (data.sounds && this.soundStorage) {
        for (const id in data.sounds) {
          if (data.sounds[id]) {
            this.soundStorage.storeSound(
              id,
              data.sounds[id].wav,
              data.sounds[id].type,
              data.sounds[id].params
            );
          }
        }
      }
      
      // Set current ID
      if (data.currentId) {
        this.spriteStorage.setCurrentId(data.currentId);
        this.paletteStorage.setCurrentId(data.currentId);
      }
      
      // Import sprite IDs list
      if (data.spriteIds) {
        this.spriteIds = data.spriteIds;
      }
      
      return true;
    } catch (error) {
      console.error('Error importing showcase:', error);
      return false;
    }
  }
  
  renderPalettePreview(canvasElement, id, paletteSize) {
    const palette = this.paletteStorage.getPalette(id, paletteSize);
    if (!palette || !canvasElement) return;
    
    const ctx = canvasElement.getContext('2d');
    const cellSize = canvasElement.width / Math.ceil(Math.sqrt(palette.length));
    
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    let x = 0;
    let y = 0;
    
    for (const color of palette) {
      ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      ctx.fillRect(x, y, cellSize, cellSize);
      
      x += cellSize;
      if (x + cellSize > canvasElement.width) {
        x = 0;
        y += cellSize;
      }
    }
  }
  
  updateSpritePreview(spriteItem, id, size) {
    // Find the image element within the sprite item
    const spriteImg = spriteItem.querySelector('img');
    if (spriteImg && this.spriteStorage.sprites[id][size]) {
      // Set crossOrigin attribute before setting src
      spriteImg.crossOrigin = 'anonymous';
      spriteImg.src = this.spriteStorage.sprites[id][size];
      
      // Update sound visualizer immediately with the new selection
      if (this.spriteStorage.generator && 
          this.spriteStorage.generator.soundViewport && 
          this.spriteStorage.generator.soundViewport.artVisualizer) {
        // Make sure to set these before calling update methods
        this.spriteStorage.generator.soundSelectedSpriteSize = size;
        this.spriteStorage.generator.currentAssetId = id;
        
        // First update the sound visualizer with the new sprite
        this.spriteStorage.generator.soundViewport.artVisualizer.setActiveSprite(id, size);
        
        // Now update the palette too
        const paletteSize = this.spriteStorage.generator.paletteSize.toString();
        this.spriteStorage.generator.soundViewport.artVisualizer.setActivePalette(id, paletteSize);
        
        // Update the sprite grid in sound viewport
        this.spriteStorage.generator.soundViewport.updateSpriteGrid();
      }
      
      // Update animation viewport if available
      if (this.spriteStorage.generator && 
          this.spriteStorage.generator.animateViewport) {
        this.spriteStorage.generator.animateViewport.selectSprite(id, size);
        this.spriteStorage.generator.animateViewport.updateSpriteGrid();
      }
      
      // Update pixel editor if available
      if (this.spriteStorage.generator && 
          this.spriteStorage.generator.pixelEditor) {
        const gridSize = parseInt(document.getElementById('pixel-grid-size')?.value || '32');
        this.spriteStorage.generator.pixelEditor.loadSpriteForEditing(id, gridSize);
      }
      
      // Stop any existing animation
      this.stopSpriteAnimation(spriteItem);
    }
  }
  
  playSpriteAnimation(spriteItem, id, size, animationType) {
    const animation = this.spriteStorage.getAnimation(id, animationType);
    if (!animation) return;
    
    const spriteImg = spriteItem.querySelector('img');
    if (!spriteImg) return;
    
    // Clear any existing animation
    this.stopSpriteAnimation(spriteItem);
    
    // Create image elements for each frame
    const frameImages = animation.frames.map(dataUrl => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = dataUrl;
      return img;
    });
    
    // Create an animation loop
    let currentFrame = 0;
    const fps = animation.fps || 12;
    const frameDuration = 1000 / fps;
    
    const animationInterval = setInterval(() => {
      if (currentFrame < frameImages.length && frameImages[currentFrame].complete) {
        spriteImg.src = frameImages[currentFrame].src;
      }
      currentFrame = (currentFrame + 1) % frameImages.length;
    }, frameDuration);
    
    // Store the animation information on the sprite item
    spriteItem.dataset.animationInterval = animationInterval;
  }
  
  stopSpriteAnimation(spriteItem) {
    if (spriteItem.dataset.animationInterval) {
      clearInterval(parseInt(spriteItem.dataset.animationInterval));
      delete spriteItem.dataset.animationInterval;
    }
  }
}