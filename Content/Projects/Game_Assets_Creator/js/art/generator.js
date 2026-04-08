import { EditorPlugin } from './editor.js';
import { BackgroundRemovalPlugin } from './plugin/base-plugin.js';
import { ViewportManager } from './viewport.js';
import { SpriteStorage } from '../storage/sprites.js';
import { PaletteStorage } from '../storage/palette.js';
import { SoundStorage } from '../storage/sounds.js';
import { LibraryShowcase } from '../storage/library.js';
import { SoundViewport } from '../sound/viewport.js';
import { ArtTuner } from './arttune.js';
import { AnimateViewport } from '../animate/viewport.js';
import { PixelEditor } from './pixeleditor.js';

export class PixelArtGenerator {
  constructor() {
    this.originalImage = null;
    this.processedImage = null;
    this.isGenerating = false;
    this.editorPlugin = new EditorPlugin(this);
    this.backgroundPlugin = new BackgroundRemovalPlugin(this);
    this.viewportManager = new ViewportManager(this);
    this.soundViewport = new SoundViewport(this);
    this.artTuner = new ArtTuner(this);
    this.animateViewport = new AnimateViewport(this);
    this.pixelEditor = new PixelEditor(this);
    
    this.spriteStorage = new SpriteStorage();
    this.spriteStorage.generator = this; // Pass reference to generator
    this.paletteStorage = new PaletteStorage();
    this.soundStorage = new SoundStorage();
    this.soundStorage.generator = this;
    this.libraryShowcase = new LibraryShowcase(this.spriteStorage, this.paletteStorage);
    this.libraryShowcase.soundStorage = this.soundStorage;
    
    this.pixelSize = 10; 
    this.editorZoom = 1;
    this.isErasing = false;
    this.isDrawing = false;
    this.originalWidth = 1024; 
    this.originalHeight = 1024;
    this.outputWidth = 32; 
    this.outputHeight = 32;
    this.paletteSize = 8;
    this.originalFullResImage = null;
    this.autoRemoveBackground = true;
    this.currentAssetId = null;
    this.soundSelectedSpriteSize = "32";
  }

  init() {
    this.viewportManager.createUI();
    this.soundViewport.createUI();
    this.artTuner.createUI();
    this.animateViewport.createUI();
    this.bindEvents();
  }

  bindEvents() {
    // Use requestAnimationFrame to ensure DOM is fully loaded
    requestAnimationFrame(() => {
        // Safely get generate button
        const generateBtn = document.getElementById('generate-btn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateImage());
        } else {
            console.warn('Generate button not found');
        }
        
        // Safely bind editor events
        try {
            this.editorPlugin.bindEditorEvents();
        } catch (error) {
            console.error('Error binding editor events:', error);
        }
        
        // Safely bind viewport events
        try {
            this.viewportManager.bindViewportEvents();
        } catch (error) {
            console.error('Error binding viewport events:', error);
        }
    });
  }

  async generateImage() {
    if (this.isGenerating) return;
    
    const promptInput = document.getElementById('prompt-input');
    const prompt = promptInput.value.trim();
    
    if (!prompt) {
      alert('Please enter a description for your sprite.');
      return;
    }
    
    this.isGenerating = true;
    this.updateUIForLoading(true);
    
    try {
      // Create a new asset ID for this generation
      this.currentAssetId = this.libraryShowcase.addNewAsset();
      
      const enhancedPrompt = `black background, ${prompt},pixel art style, black background`;
      
      // Log the prompt to see what's being sent
      console.log("Sending prompt to AI:", enhancedPrompt);
      
      // Generate at a larger size to ensure good quality
      const result = await websim.imageGen({
        prompt: enhancedPrompt,
        width: 1024,  // Larger initial generation
        height: 1024
      });
      
      // Store the original image in storage
      this.spriteStorage.storeSprite(this.currentAssetId, 'ORIGINAL', result.url);
      
      // Load and resize to 256x256
      await this.loadAndResizeImage(result.url);
      
      // Automatically remove background if toggle is enabled
      if (this.autoRemoveBackground) {
        const editorCanvas = document.getElementById('editor-canvas');
        const editorCtx = editorCanvas.getContext('2d');
        const imageData = editorCtx.getImageData(0, 0, editorCanvas.width, editorCanvas.height);
        
        const processedImageData = this.backgroundPlugin.autoRemoveBackground(imageData, editorCanvas.width, editorCanvas.height);
        editorCtx.putImageData(processedImageData, 0, 0);
      }
      
      // Generate all sizes automatically
      this.generateAllSizes();
      
      // Show the design sound button after generation
      const designSoundBtn = document.getElementById('design-sound-btn');
      if (designSoundBtn) {
        designSoundBtn.style.display = 'block';
      }
      
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Failed to generate image. Please try again.');
    } finally {
      this.isGenerating = false;
      this.updateUIForLoading(false);
    }
  }

  async loadAndResizeImage(imageUrl) {
    try {
      const img = await this.loadImage(imageUrl);
      
      // Create a canvas to resize the image
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      
      // Draw the image, scaling it down to 256x256
      ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, 256, 256);
      
      // Get image data for color analysis only
      const imageData = ctx.getImageData(0, 0, 256, 256);
      
      // Analyze color diversity
      const colorAnalysis = this.backgroundPlugin.analyzeColorDiversity(imageData, 256, 256);
      
      // Set default resolution instead of analyzing complexity
      const defaultResolution = 32;
      
      // Update UI based on color analysis only
      this.updateUIForAnalysisResults(colorAnalysis, { suggestedResolution: defaultResolution });
      
      // Store the full resolution image URL separately
      this.originalFullResImage = imageUrl;
      
      // Load the resized image to the editor
      const resizedUrl = canvas.toDataURL('image/png');
      
      // Store in sprite storage with the current asset ID
      this.spriteStorage.storeSprite(this.currentAssetId, 'EDIT', resizedUrl);
      
      return this.viewportManager.loadImageToEditor(resizedUrl);
    } catch (error) {
      console.error('Failed to load and resize image:', error);
      throw error;
    }
  }
  
  async processUploadedImage(imageUrl) {
    try {
      // Create a new asset ID for this upload
      this.currentAssetId = this.libraryShowcase.addNewAsset();
      
      // Load the image
      const img = await this.loadImage(imageUrl);
      
      // Create a canvas for resizing while maintaining aspect ratio
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Calculate dimensions while maintaining aspect ratio
      let width = img.width;
      let height = img.height;
      const maxDimension = 256;
      
      if (width > height && width > maxDimension) {
        height = (height / width) * maxDimension;
        width = maxDimension;
      } else if (height > width && height > maxDimension) {
        width = (width / height) * maxDimension;
        height = maxDimension;
      } else if (width === height && width > maxDimension) {
        width = maxDimension;
        height = maxDimension;
      }
      
      // Set canvas to 256x256 (container size)
      canvas.width = 256;
      canvas.height = 256;
      
      // Fill with transparent background
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Calculate position to center the image
      const offsetX = (256 - width) / 2;
      const offsetY = (256 - height) / 2;
      
      // Draw the image centered
      ctx.drawImage(img, offsetX, offsetY, width, height);
      
      // Get image data for analysis
      const imageData = ctx.getImageData(0, 0, 256, 256);
      
      // Analyze color diversity only
      const colorAnalysis = this.backgroundPlugin.analyzeColorDiversity(imageData, 256, 256);
      
      // Set default resolution instead of complexity analysis
      const defaultResolution = 32;
      
      // Update UI based on color analysis only
      this.updateUIForAnalysisResults(colorAnalysis, { suggestedResolution: defaultResolution });
      
      // Store the resized image URL with the current asset ID
      const resizedUrl = canvas.toDataURL('image/png');
      this.spriteStorage.storeSprite(this.currentAssetId, 'EDIT', resizedUrl);
      
      // Load the image to editor
      await this.viewportManager.loadImageToEditor(resizedUrl);
      
      // Automatically remove background if toggle is enabled
      if (this.autoRemoveBackground) {
        const editorCanvas = document.getElementById('editor-canvas');
        const editorCtx = editorCanvas.getContext('2d');
        const editorImageData = editorCtx.getImageData(0, 0, editorCanvas.width, editorCanvas.height);
        
        const processedImageData = this.backgroundPlugin.autoRemoveBackground(editorImageData, editorCanvas.width, editorCanvas.height);
        editorCtx.putImageData(processedImageData, 0, 0);
      }
      
      // Store the original full resolution image URL
      this.originalFullResImage = imageUrl;
      
      // Store the original image in storage as well
      this.spriteStorage.storeSprite(this.currentAssetId, 'ORIGINAL', imageUrl);
      
      // Show the design sound button after upload
      const designSoundBtn = document.getElementById('design-sound-btn');
      if (designSoundBtn) {
        designSoundBtn.style.display = 'block';
      }
      
      return resizedUrl;
    } catch (error) {
      console.error('Failed to process uploaded image:', error);
      throw error;
    }
  }

  // Helper method to load an image
  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; 
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
    });
  }
  
  // Helper method to update UI based on analysis results
  updateUIForAnalysisResults(colorAnalysis, complexityAnalysis) {
    // Palette size suggestion
    const paletteSizeRadios = document.querySelectorAll('input[name="palette-size"]');
    paletteSizeRadios.forEach(radio => {
      radio.checked = parseInt(radio.value) === colorAnalysis.suggestedPaletteSize;
    });
    this.paletteSize = colorAnalysis.suggestedPaletteSize;
    
    // Store palettes from color analysis with the current asset ID
    if (colorAnalysis.topColors) {
      // Store different palette sizes
      this.paletteStorage.storePalette(this.currentAssetId, '8', colorAnalysis.topColors.slice(0, 8));
      this.paletteStorage.storePalette(this.currentAssetId, '16', colorAnalysis.topColors.slice(0, 16));
      this.paletteStorage.storePalette(this.currentAssetId, '32', colorAnalysis.topColors.slice(0, 32));
      this.paletteStorage.storePalette(this.currentAssetId, '64', colorAnalysis.topColors.slice(0, 64));
    }
    
    // Resolution suggestion - use provided value directly
    const suggestedResolution = complexityAnalysis.suggestedResolution;
    const downscaleSizeRadios = document.querySelectorAll('input[name="downscale-size"]');
    downscaleSizeRadios.forEach(radio => {
      radio.checked = parseInt(radio.value) === suggestedResolution;
    });
    this.outputWidth = suggestedResolution;
    this.outputHeight = suggestedResolution;
    
    // Update the processed sprite title
    const processedTitle = document.getElementById('processed-sprite-title');
    if (processedTitle) {
      processedTitle.textContent = `${this.outputWidth}x${this.outputHeight} Sprite`;
    }
    
    // Store sprites in storage and update library
    this.updateLibraryPanel();
  }
  
  // New method to update library panel contents
  updateLibraryPanel() {
    const spriteGrid = document.getElementById('sprite-grid');
    const paletteGrid = document.getElementById('palette-grid');
    
    if (!spriteGrid || !paletteGrid) return;
    
    // Clear existing content
    spriteGrid.innerHTML = '';
    paletteGrid.innerHTML = '';
    
    // Add sprites to library
    for (const id of this.libraryShowcase.spriteIds) {
      const spriteContainer = document.createElement('div');
      spriteContainer.className = 'sprite-container';
      spriteContainer.dataset.id = id;
      
      // Create the main sprite item with dropdown
      const spriteItem = document.createElement('div');
      spriteItem.className = 'sprite-item';
      
      // Use the default size or 256 if not available
      const defaultSize = this.spriteStorage.sprites[id]['256'] ? '256' : 
                         this.spriteStorage.sprites[id]['128'] ? '128' :
                         this.spriteStorage.sprites[id]['64'] ? '64' : '32';
      
      const spriteImg = document.createElement('img');
      spriteImg.src = this.spriteStorage.sprites[id][defaultSize];
      spriteImg.alt = 'Sprite';
      
      const spriteLabel = document.createElement('div');
      spriteLabel.className = 'sprite-label';
      spriteLabel.textContent = `Sprite ${id.split('_')[2]}`;
      
      spriteItem.appendChild(spriteImg);
      spriteItem.appendChild(spriteLabel);
      
      // Create dropdown for sizes
      const sizesDropdown = document.createElement('div');
      sizesDropdown.className = 'sizes-dropdown';
      
      const sizes = ['32', '64', '128', '256', 'EDIT', 'ORIGINAL'];
      sizes.forEach(size => {
        if (this.spriteStorage.sprites[id][size]) {
          const sizeOption = document.createElement('div');
          sizeOption.className = 'size-option';
          sizeOption.textContent = size === 'EDIT' ? 'Editor Size' : 
                                 size === 'ORIGINAL' ? 'Original' : 
                                 `${size}x${size}`;
          sizeOption.dataset.size = size;
          
          // Add click handler to load this size
          sizeOption.addEventListener('click', (e) => {
            e.stopPropagation();
            this.spriteStorage.setCurrentId(id);
            this.paletteStorage.setCurrentId(id);
            
            // Update the sprite preview in the library
            const parentSpriteItem = sizeOption.closest('.sprite-container').querySelector('.sprite-item');
            this.libraryShowcase.updateSpritePreview(parentSpriteItem, id, size);
            
            // Set these values immediately before loading the sprite
            this.soundSelectedSpriteSize = size;
            this.currentAssetId = id;
            
            // Load the sprite in the preview and editor
            if (size === 'EDIT') {
              this.viewportManager.loadImageToEditor(this.spriteStorage.sprites[id][size]);
            } else if (size === 'ORIGINAL') {
              // For original, update all relevant fields
              const originalUrl = this.spriteStorage.sprites[id][size];
              this.originalFullResImage = originalUrl;
              this.originalImage = originalUrl;
              
              // Update original image preview
              const originalImg = document.getElementById('original-img');
              if (originalImg) {
                originalImg.src = originalUrl;
              }
              
              // Also load it to editor if needed
              this.viewportManager.loadImageToEditor(this.spriteStorage.sprites[id]['EDIT'] || originalUrl);
            } else {
              // For smaller sizes, update the processed image preview
              const processedImg = document.getElementById('processed-img');
              processedImg.src = this.spriteStorage.getSprite(this.currentAssetId, String(size));
              this.processedImage = processedImg.src;
              
              // Also update original image if available
              if (this.spriteStorage.sprites[id]['ORIGINAL']) {
                const originalImg = document.getElementById('original-img');
                if (originalImg) {
                  originalImg.src = this.spriteStorage.sprites[id]['ORIGINAL'];
                  this.originalImage = this.spriteStorage.sprites[id]['ORIGINAL'];
                  this.originalFullResImage = this.spriteStorage.sprites[id]['ORIGINAL'];
                }
              }
              
              // Always update the editor image when selecting a sprite
              const editorImage = this.spriteStorage.sprites[id]['EDIT'] || this.spriteStorage.sprites[id]['ORIGINAL'];
              if (editorImage) {
                this.viewportManager.loadImageToEditor(editorImage);
              }
            }
            
            // Update size selection UI
            if (size !== 'EDIT' && size !== 'ORIGINAL') {
              document.querySelectorAll('input[name="downscale-size"]').forEach(radio => {
                radio.checked = parseInt(radio.value) === parseInt(size);
              });
              
              const processedTitle = document.getElementById('processed-sprite-title');
              processedTitle.textContent = `${size}x${size} Sprite`;
            }
            
            // Enable download buttons
            document.getElementById('download-original').disabled = false;
            document.getElementById('download-processed').disabled = false;
            
            // Hide the dropdown after selection
            sizesDropdown.style.display = 'none';
          });
          
          sizesDropdown.appendChild(sizeOption);
        }
      });
      
      // Add animation dropdown if there are animations
      const animationTypes = this.spriteStorage.getAnimationTypes(id);
      if (animationTypes.length > 0) {
        const animDropdown = document.createElement('div');
        animDropdown.className = 'animation-dropdown';
        
        const animLabel = document.createElement('div');
        animLabel.className = 'animation-label';
        animLabel.textContent = 'Animations:';
        animDropdown.appendChild(animLabel);
        
        // Add 'None' option first to stop animation
        const noneOption = document.createElement('div');
        noneOption.className = 'animation-option';
        noneOption.textContent = 'None';
        noneOption.addEventListener('click', (e) => {
          e.stopPropagation();
          this.libraryShowcase.stopSpriteAnimation(spriteItem);
        });
        animDropdown.appendChild(noneOption);
        
        // Add each animation type
        animationTypes.forEach(type => {
          const animOption = document.createElement('div');
          animOption.className = 'animation-option';
          animOption.textContent = type.charAt(0).toUpperCase() + type.slice(1);
          
          // Add click handler to play animation
          animOption.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Get the current size that's displayed
            const size = spriteItem.dataset.currentSize || defaultSize;
            
            // Play the animation
            this.libraryShowcase.playSpriteAnimation(spriteItem, id, size, type);
          });
          
          animDropdown.appendChild(animOption);
        });
        
        // Add animation dropdown to the sprite container
        spriteContainer.appendChild(animDropdown);
      }
      
      // Main sprite item click toggles dropdown
      spriteItem.addEventListener('click', () => {
        // Toggle dropdown visibility
        const current = sizesDropdown.style.display;
        sizesDropdown.style.display = current === 'block' ? 'none' : 'block';
        
        // Close other dropdowns
        document.querySelectorAll('.sizes-dropdown').forEach(dropdown => {
          if (dropdown !== sizesDropdown) {
            dropdown.style.display = 'none';
          }
        });
        
        // Close palette dropdowns too
        document.querySelectorAll('.palette-sizes-dropdown').forEach(dropdown => {
          dropdown.style.display = 'none';
        });
      });
      
      spriteContainer.appendChild(spriteItem);
      spriteContainer.appendChild(sizesDropdown);
      spriteGrid.appendChild(spriteContainer);
    }
    
    // Add palettes to library with dropdown similar to sprites
    for (const id of this.libraryShowcase.spriteIds) {
      const palettes = this.paletteStorage.palettes[id];
      if (palettes) {
        const paletteContainer = document.createElement('div');
        paletteContainer.className = 'palette-container';
        paletteContainer.dataset.id = id;
        
        // Create the main palette item with dropdown
        const paletteItem = document.createElement('div');
        paletteItem.className = 'palette-item';
        
        const paletteCanvas = document.createElement('canvas');
        paletteCanvas.className = 'palette-canvas';
        paletteCanvas.width = 100;
        paletteCanvas.height = 80;
        
        // Display the default palette (8 colors)
        this.libraryShowcase.renderPalettePreview(paletteCanvas, id, '8');
        
        const paletteLabel = document.createElement('div');
        paletteLabel.className = 'palette-label';
        paletteLabel.textContent = `Palette ${id.split('_')[2]}`;
        
        paletteItem.appendChild(paletteCanvas);
        paletteItem.appendChild(paletteLabel);
        
        // Create dropdown for palette sizes
        const paletteSizesDropdown = document.createElement('div');
        paletteSizesDropdown.className = 'palette-sizes-dropdown';
        
        const paletteSizes = ['8', '16', '32', '64'];
        paletteSizes.forEach(size => {
          if (palettes[size]) {
            const sizeOption = document.createElement('div');
            sizeOption.className = 'size-option';
            sizeOption.textContent = `${size} Colors`;
            sizeOption.dataset.size = size;
            
            // Add click handler to select this palette size
            sizeOption.addEventListener('click', (e) => {
              e.stopPropagation();
              this.spriteStorage.setCurrentId(id);
              this.paletteStorage.setCurrentId(id);
              this.currentAssetId = id;
              
              // Set the palette size
              this.paletteSize = parseInt(size);
              
              // Update palette size selection UI
              document.querySelectorAll('input[name="palette-size"]').forEach(radio => {
                radio.checked = parseInt(radio.value) === parseInt(size);
              });
              
              // Update the canvas preview with the selected palette size
              this.libraryShowcase.renderPalettePreview(paletteCanvas, id, size);

              // Update sound visualizer if it exists
              if (this.soundViewport && this.soundViewport.artVisualizer) {
                this.soundViewport.artVisualizer.setActivePalette(id, size);
              }
            });
            
            paletteSizesDropdown.appendChild(sizeOption);
          }
        });
        
        // Main palette item click toggles dropdown
        paletteItem.addEventListener('click', () => {
          // Toggle dropdown visibility
          const current = paletteSizesDropdown.style.display;
          paletteSizesDropdown.style.display = current === 'block' ? 'none' : 'block';
          
          // Close other dropdowns
          document.querySelectorAll('.palette-sizes-dropdown').forEach(dropdown => {
            if (dropdown !== paletteSizesDropdown) {
              dropdown.style.display = 'none';
            }
          });
          
          // Close sprite dropdowns too
          document.querySelectorAll('.sizes-dropdown').forEach(dropdown => {
            dropdown.style.display = 'none';
          });
        });
        
        paletteContainer.appendChild(paletteItem);
        paletteContainer.appendChild(paletteSizesDropdown);
        paletteGrid.appendChild(paletteContainer);
      }
    }
  }

  async loadImageToEditor(imageUrl) {
    return this.viewportManager.loadImageToEditor(imageUrl);
  }

  updateUIForLoading(isLoading) {
    this.viewportManager.updateUIForLoading(isLoading);
  }

  removeWhiteBackground(img) {
    return this.backgroundPlugin.removeWhiteBackground(img);
  }

  downloadImage(type) {
    const imageUrl = type === 'original' 
      ? (this.originalFullResImage || this.originalImage) 
      : this.processedImage;
    
    if (!imageUrl) return;
    
    const downloadLink = document.createElement('a');
    downloadLink.href = imageUrl;
    downloadLink.download = `pixel-sprite-${type}-${Date.now()}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }

  generateAllSizes() {
    const sizes = [32, 64, 128, 256];
    const editorCanvas = document.getElementById('editor-canvas');
    const editorCtx = editorCanvas.getContext('2d');
    const originalImageData = editorCtx.getImageData(0, 0, editorCanvas.width, editorCanvas.height);
    
    // Process and store all sizes
    sizes.forEach(size => {
      
      // Set output dimensions for downscaling
      this.outputWidth = size;
      this.outputHeight = size;
      
      // Downscale to this size
      const dataUrl = this.backgroundPlugin.smartDownscale(
        originalImageData,
        editorCanvas.width,
        editorCanvas.height
      );
      
      // Store in sprite storage with current asset ID
      this.spriteStorage.storeSprite(this.currentAssetId, String(size), dataUrl);
    });
    
    // Use the default or suggested resolution
    const suggestedResolution = this.outputWidth || 32;
    
    // Update processed image preview with the suggested size
    const processedImg = document.getElementById('processed-img');
    processedImg.src = this.spriteStorage.getSprite(this.currentAssetId, String(suggestedResolution));
    this.processedImage = processedImg.src;
    
    document.getElementById('download-processed').disabled = false;
    
    // Update library panel to show the new sprites
    this.updateLibraryPanel();
    
    // Update the processed sprite title to match the selected size
    const processedTitle = document.getElementById('processed-sprite-title');
    processedTitle.textContent = `${suggestedResolution}x${suggestedResolution} Sprite`;
    
    // Update the radio buttons to match the selected size
    document.querySelectorAll('input[name="downscale-size"]').forEach(radio => {
      radio.checked = parseInt(radio.value) === suggestedResolution;
    });
  }
}