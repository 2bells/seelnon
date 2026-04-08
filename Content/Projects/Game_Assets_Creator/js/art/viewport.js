import { PixelEditor } from './pixeleditor.js';

export class ViewportManager {
  constructor(generator) {
    this.generator = generator;
  }

  createUI() {
    const container = document.createElement('div');
    container.className = 'container';
    
    const title = document.createElement('h1');
    title.textContent = 'Pixel Art Sprite Generator';
    container.appendChild(title);
    
    const promptContainer = document.createElement('div');
    promptContainer.className = 'prompt-container';
    
    const promptInput = document.createElement('textarea');
    promptInput.id = 'prompt-input';
    promptInput.placeholder = 'Example: A brave warrior with a sword and shield, pixel art, RPG sprite';
    promptInput.value = 'A cute slime monster, blue color, 16-bit pixel art, RPG sprite, Final Fantasy style';

    const promptLabel = document.createElement('label');
    promptLabel.textContent = 'Describe your sprite (Final Fantasy/Dragon Quest style):';
    promptLabel.setAttribute('for', 'prompt-input');
    promptLabel.style.textAlign = 'center';  
    promptLabel.style.display = 'block';     
    promptLabel.style.marginBottom = '10px'; 
    
    promptContainer.appendChild(promptLabel);
    promptContainer.appendChild(promptInput);

    const actionButtons = document.createElement('div');
    actionButtons.className = 'action-buttons';
    
    const generateBtn = document.createElement('button');
    generateBtn.className = 'generate-btn';
    generateBtn.textContent = '🎮 Generate Sprite';
    generateBtn.id = 'generate-btn';

    
    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'upload-btn';
    uploadBtn.textContent = '📤 Upload';
    uploadBtn.id = 'upload-btn';
    actionButtons.appendChild(generateBtn);
    actionButtons.appendChild(uploadBtn);
    
    promptContainer.appendChild(actionButtons);
    container.appendChild(promptContainer);
    
    const loading = document.createElement('div');
    loading.className = 'loading';
    loading.id = 'loading';
    
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    loading.appendChild(spinner);
    
    const loadingText = document.createElement('p');
    loadingText.textContent = 'Generating your pixel art sprite...';
    loading.appendChild(loadingText);
    
    container.appendChild(loading);
    
    const editorContainer = document.createElement('div');
    editorContainer.className = 'editor-container';
    editorContainer.id = 'editor-container';
    
    const editorControls = document.createElement('div');
    editorControls.className = 'editor-controls';
    
    const toolControls = document.createElement('div');
    toolControls.className = 'tool-controls';
    
    const bgRemovalWrapper = document.createElement('div');
    bgRemovalWrapper.className = 'bg-removal-wrapper';
    
    const bgRemovalCheckbox = document.createElement('input');
    bgRemovalCheckbox.type = 'checkbox';
    bgRemovalCheckbox.id = 'bg-removal-toggle';
    bgRemovalCheckbox.checked = true;
    
    const bgRemovalLabel = document.createElement('label');
    bgRemovalLabel.htmlFor = 'bg-removal-toggle';
    bgRemovalLabel.textContent = 'Auto-Remove';
    
    bgRemovalWrapper.appendChild(bgRemovalCheckbox);
    bgRemovalWrapper.appendChild(bgRemovalLabel);
    toolControls.appendChild(bgRemovalWrapper);
    
    const autoRemoveBtn = document.createElement('button');
    autoRemoveBtn.textContent = 'Auto-Remove Background';
    autoRemoveBtn.className = 'tool-btn';
    autoRemoveBtn.id = 'auto-remove-bg';
    toolControls.appendChild(autoRemoveBtn);
    
    const downscaleBtn = document.createElement('button');
    downscaleBtn.textContent = 'Apply/Library Update';  
    downscaleBtn.className = 'tool-btn';
    downscaleBtn.id = 'downscale-btn';
    toolControls.appendChild(downscaleBtn);
    
    editorControls.appendChild(toolControls);
    editorContainer.appendChild(editorControls);
    
    const optionsWrapper = document.createElement('div');
    optionsWrapper.className = 'editor-options-wrapper';
    
    const downscaleSection = document.createElement('div');
    downscaleSection.className = 'editor-option-section';
    
    const downscaleTitle = document.createElement('h4');
    downscaleTitle.textContent = 'Downscale Size';
    downscaleSection.appendChild(downscaleTitle);
    
    const downscaleRadioGroup = document.createElement('div');
    downscaleRadioGroup.className = 'radio-group';
    
    const downscaleSizes = [32, 64, 128, 256];
    downscaleSizes.forEach(size => {
      const radioWrapper = document.createElement('div');
      radioWrapper.className = 'radio-wrapper';
      
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'downscale-size';
      radio.id = `downscale-${size}`;
      radio.value = size;
      radio.checked = size === 32;
      
      const label = document.createElement('label');
      label.htmlFor = `downscale-${size}`;
      label.textContent = `${size} pix`;
      
      radioWrapper.appendChild(radio);
      radioWrapper.appendChild(label);
      downscaleRadioGroup.appendChild(radioWrapper);
    });
    
    downscaleSection.appendChild(downscaleRadioGroup);
    optionsWrapper.appendChild(downscaleSection);
    
    const paletteSection = document.createElement('div');
    paletteSection.className = 'editor-option-section';
    
    const paletteTitle = document.createElement('h4');
    paletteTitle.textContent = 'Color Palette';
    paletteSection.appendChild(paletteTitle);
    
    const paletteRadioGroup = document.createElement('div');
    paletteRadioGroup.className = 'radio-group';
    
    const paletteSizes = [8, 16, 32, 64];
    paletteSizes.forEach(size => {
      const radioWrapper = document.createElement('div');
      radioWrapper.className = 'radio-wrapper';
      
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'palette-size';
      radio.id = `palette-${size}`;
      radio.value = size;
      radio.checked = size === 8;
      
      const label = document.createElement('label');
      label.htmlFor = `palette-${size}`;
      label.textContent = `${size} col`;
      
      radioWrapper.appendChild(radio);
      radioWrapper.appendChild(label);
      paletteRadioGroup.appendChild(radioWrapper);
    });
    
    paletteSection.appendChild(paletteRadioGroup);
    optionsWrapper.appendChild(paletteSection);
    
    editorContainer.appendChild(optionsWrapper);
    
    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'canvas-container';
    
    const editorCanvas = document.createElement('canvas');
    editorCanvas.id = 'editor-canvas';
    editorCanvas.width = 256;
    editorCanvas.height = 256;
    canvasContainer.appendChild(editorCanvas);
    
    editorContainer.appendChild(canvasContainer);
    
    container.appendChild(editorContainer);
    
    const resultContainer = document.createElement('div');
    resultContainer.className = 'result-container';
    resultContainer.id = 'result-container';
    
    const imageDisplay = document.createElement('div');
    imageDisplay.className = 'image-display';
    
    const originalCard = document.createElement('div');
    originalCard.className = 'image-card';
    
    const originalTitle = document.createElement('h3');
    originalTitle.textContent = 'Original';
    originalCard.appendChild(originalTitle);
    
    const originalContainer = document.createElement('div');
    originalContainer.className = 'image-container original';
    
    const originalImg = document.createElement('img');
    originalImg.id = 'original-img';
    originalImg.style.width = 'auto';
    originalImg.style.height = 'auto';
    originalImg.style.maxWidth = '100%';
    originalImg.style.maxHeight = '100%';
    originalContainer.appendChild(originalImg);
    
    originalCard.appendChild(originalContainer);
    
    const downloadOriginalBtn = document.createElement('button');
    downloadOriginalBtn.className = 'download-btn';
    downloadOriginalBtn.textContent = 'Download';
    downloadOriginalBtn.id = 'download-original';
    downloadOriginalBtn.disabled = true;
    originalCard.appendChild(downloadOriginalBtn);
    
    const processedCard = document.createElement('div');
    processedCard.className = 'image-card';
    
    const processedTitle = document.createElement('h3');
    processedTitle.id = 'processed-sprite-title';
    processedTitle.textContent = '32x32 Sprite'; 
    processedCard.appendChild(processedTitle);
    
    const processedContainer = document.createElement('div');
    processedContainer.className = 'image-container processed';
    processedContainer.style.backgroundColor = 'transparent';
    processedContainer.style.display = 'flex';
    processedContainer.style.justifyContent = 'center';
    processedContainer.style.alignItems = 'center';
    
    const processedImg = document.createElement('img');
    processedImg.id = 'processed-img';
    processedImg.style.maxWidth = '100%';
    processedImg.style.maxHeight = '100%';
    processedImg.style.objectFit = 'contain';
    processedContainer.appendChild(processedImg);
    
    processedCard.appendChild(processedContainer);
    
    const downloadProcessedBtn = document.createElement('button');
    downloadProcessedBtn.className = 'download-btn';
    downloadProcessedBtn.textContent = 'Download';
    downloadProcessedBtn.id = 'download-processed';
    downloadProcessedBtn.disabled = true;
    processedCard.appendChild(downloadProcessedBtn);
    
    imageDisplay.appendChild(originalCard);
    imageDisplay.appendChild(processedCard);
    
    resultContainer.appendChild(imageDisplay);
    container.appendChild(resultContainer);
    
    const featureButtonsContainer = document.createElement('div');
    featureButtonsContainer.className = 'feature-buttons-container';
    
    const designSoundBtn = document.createElement('button');
    designSoundBtn.className = 'feature-btn design-sound-btn';
    designSoundBtn.id = 'design-sound-btn';
    designSoundBtn.innerHTML = '<i>🎵</i> Design Sound From Art';
    designSoundBtn.style.display = 'none'; // Hidden by default, shown after image generation
    
    const animateBtn = document.createElement('button');
    animateBtn.className = 'feature-btn animate-btn';
    animateBtn.id = 'animate-btn';
    animateBtn.innerHTML = '<i>🎬</i> Animate';
    animateBtn.style.display = 'none'; // Hidden until a sprite is created
    
    featureButtonsContainer.appendChild(designSoundBtn);
    featureButtonsContainer.appendChild(animateBtn);
    
    container.appendChild(featureButtonsContainer);
    
    document.body.appendChild(container);
    
    // Add the pixel editor to the editor container
    const editorContainerElement = document.getElementById('editor-container');
    if (editorContainerElement) {
      // Create a collapsible section for the pixel editor
      const editorCollapse = document.createElement('div');
      editorCollapse.className = 'collapsible-section';
      
      const editorCollapseHeader = document.createElement('div');
      editorCollapseHeader.className = 'collapsible-header';
      editorCollapseHeader.innerHTML = '<h3>Pixel Editor</h3><span class="collapse-icon">▼</span>';
      editorCollapse.appendChild(editorCollapseHeader);
      
      const editorCollapseContent = document.createElement('div');
      editorCollapseContent.className = 'collapsible-content';
      editorCollapseContent.style.display = 'none'; // Hidden by default
      editorCollapse.appendChild(editorCollapseContent);
      
      // Add collapse functionality
      editorCollapseHeader.addEventListener('click', () => {
        const isVisible = editorCollapseContent.style.display !== 'none';
        editorCollapseContent.style.display = isVisible ? 'none' : 'block';
        editorCollapseHeader.querySelector('.collapse-icon').textContent = isVisible ? '▼' : '▲';
      });
      
      // Initialize pixel editor in the collapsible section
      this.generator.pixelEditor.createUI(editorCollapseContent);
      
      // Add the collapsible section to the editor container
      editorContainerElement.appendChild(editorCollapse);
    }
    
    this.createLibraryPanel();
  }

  createLibraryPanel() {
    const libraryToggle = document.createElement('div');
    libraryToggle.className = 'library-toggle';
    libraryToggle.textContent = 'Library';
    libraryToggle.id = 'library-toggle';
    document.body.appendChild(libraryToggle);
    
    const libraryPanel = document.createElement('div');
    libraryPanel.className = 'library-panel';
    libraryPanel.id = 'library-panel';
    
    const closeButton = document.createElement('button');
    closeButton.className = 'library-close';
    closeButton.innerHTML = '&times;';
    closeButton.id = 'library-close';
    libraryPanel.appendChild(closeButton);
    
    // Sprites Section with collapsible header
    const spritesSection = document.createElement('div');
    spritesSection.className = 'library-section';
    
    const spritesHeader = document.createElement('div');
    spritesHeader.className = 'library-section-header';
    spritesHeader.innerHTML = '<h3>My Sprites</h3><span class="collapse-icon">▼</span>';
    spritesSection.appendChild(spritesHeader);
    
    const spriteContent = document.createElement('div');
    spriteContent.className = 'library-section-content';
    
    const spriteGrid = document.createElement('div');
    spriteGrid.className = 'sprite-grid';
    spriteGrid.id = 'sprite-grid';
    spriteContent.appendChild(spriteGrid);
    
    spritesSection.appendChild(spriteContent);
    libraryPanel.appendChild(spritesSection);
    
    // Make sprites section collapsible
    spritesHeader.addEventListener('click', () => {
      spriteContent.style.display = spriteContent.style.display === 'none' ? 'block' : 'none';
      spritesHeader.querySelector('.collapse-icon').textContent = 
        spriteContent.style.display === 'none' ? '▶' : '▼';
    });
    
    // Palettes Section with collapsible header
    const palettesSection = document.createElement('div');
    palettesSection.className = 'library-section';
    
    const palettesHeader = document.createElement('div');
    palettesHeader.className = 'library-section-header';
    palettesHeader.innerHTML = '<h3>My Palettes</h3><span class="collapse-icon">▼</span>';
    palettesSection.appendChild(palettesHeader);
    
    const paletteContent = document.createElement('div');
    paletteContent.className = 'library-section-content';
    
    const paletteGrid = document.createElement('div');
    paletteGrid.className = 'palette-grid';
    paletteGrid.id = 'palette-grid';
    paletteContent.appendChild(paletteGrid);
    
    palettesSection.appendChild(paletteContent);
    libraryPanel.appendChild(palettesSection);
    
    // Make palettes section collapsible
    palettesHeader.addEventListener('click', () => {
      paletteContent.style.display = paletteContent.style.display === 'none' ? 'block' : 'none';
      palettesHeader.querySelector('.collapse-icon').textContent = 
        paletteContent.style.display === 'none' ? '▶' : '▼';
    });
    
    // Sounds Section with collapsible header
    const soundsSection = document.createElement('div');
    soundsSection.className = 'library-section sounds-section';
    
    const soundsHeader = document.createElement('div');
    soundsHeader.className = 'library-section-header';
    soundsHeader.innerHTML = '<h3>My Sounds</h3><span class="collapse-icon">▼</span>';
    soundsSection.appendChild(soundsHeader);
    
    const soundContent = document.createElement('div');
    soundContent.className = 'library-section-content';
    
    const soundGrid = document.createElement('div');
    soundGrid.className = 'sound-grid';
    soundGrid.id = 'sound-grid';
    soundContent.appendChild(soundGrid);
    
    soundsSection.appendChild(soundContent);
    libraryPanel.appendChild(soundsSection);
    
    // Make sounds section collapsible
    soundsHeader.addEventListener('click', () => {
      soundContent.style.display = soundContent.style.display === 'none' ? 'block' : 'none';
      soundsHeader.querySelector('.collapse-icon').textContent = 
        soundContent.style.display === 'none' ? '▶' : '▼';
    });
    
    document.body.appendChild(libraryPanel);
  }

  bindViewportEvents() {
    const downloadOriginalBtn = document.getElementById('download-original');
    const downloadProcessedBtn = document.getElementById('download-processed');
    const uploadBtn = document.getElementById('upload-btn');
    
    // Create a hidden file input for uploads
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    // Connect upload button to file input
    uploadBtn.addEventListener('click', () => fileInput.click());
    
    // Handle file selection
    fileInput.addEventListener('change', (e) => this.handleImageUpload(e));
    
    downloadOriginalBtn.addEventListener('click', () => this.generator.downloadImage('original'));
    downloadProcessedBtn.addEventListener('click', () => this.generator.downloadImage('processed'));
    
    const downscaleSizeRadios = document.querySelectorAll('input[name="downscale-size"]');
    const paletteSizeRadios = document.querySelectorAll('input[name="palette-size"]');
    const bgRemovalCheckbox = document.getElementById('bg-removal-toggle');

    // Add event listener for background removal toggle
    bgRemovalCheckbox.addEventListener('change', (e) => {
      this.generator.autoRemoveBackground = e.target.checked;
    });

    downscaleSizeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const size = parseInt(e.target.value);
        this.generator.outputWidth = size;
        this.generator.outputHeight = size;
        
        const processedTitle = document.getElementById('processed-sprite-title');
        processedTitle.textContent = `${size}x${size} Sprite`;
        
        // Update sound visualizer if it exists
        if (this.generator.soundViewport && this.generator.soundViewport.artVisualizer) {
          this.generator.soundViewport.artVisualizer.setActivePalette(this.generator.currentAssetId, size);
        }
        
        // Update animation viewport if it exists
        if (this.generator.animateViewport) {
          this.generator.animateViewport.selectSprite(this.generator.currentAssetId, size);
          this.generator.animateViewport.updateSpriteGrid();
        }
      });
    });

    paletteSizeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.generator.paletteSize = parseInt(e.target.value);
      });
    });
    
    const libraryToggle = document.getElementById('library-toggle');
    const libraryPanel = document.getElementById('library-panel');
    const libraryClose = document.getElementById('library-close');
    const designSoundBtn = document.getElementById('design-sound-btn');
    
    libraryToggle.addEventListener('click', () => {
      libraryPanel.classList.add('active');
      libraryToggle.style.right = '300px';
    });
    
    libraryClose.addEventListener('click', () => {
      libraryPanel.classList.remove('active');
      libraryToggle.style.right = '0';
    });
    
    // Sound design button event
    designSoundBtn.addEventListener('click', () => {
      this.generator.soundViewport.toggleView(true);
    });
    
    // Animation button event
    const animateBtn = document.getElementById('animate-btn');
    animateBtn.addEventListener('click', () => {
      this.generator.animateViewport.toggleView(true);
    });

    // Add event listener to generate button to prevent multiple generations
    const generateBtn = document.getElementById('generate-btn');
    generateBtn.addEventListener('click', () => {
      if (generateBtn.disabled) {
        this.showGenerateDisabledPopup();
      }
    });
  }

  async loadImageToEditor(imageUrl) {
    try {
      const img = await this.generator.loadImage(imageUrl);
      
      const originalImg = document.getElementById('original-img');
      originalImg.src = imageUrl;
      originalImg.style.width = 'auto';
      originalImg.style.height = 'auto';
      originalImg.style.maxWidth = '100%';
      originalImg.style.maxHeight = '100%';
      
      this.generator.originalImage = imageUrl;
      
      const editorCanvas = document.getElementById('editor-canvas');
      editorCanvas.width = 256;  
      editorCanvas.height = 256;
      this.generator.originalWidth = 256;
      this.generator.originalHeight = 256;
      
      const editorCtx = editorCanvas.getContext('2d');
      editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
      editorCtx.drawImage(img, 0, 0, 256, 256);
      
      document.getElementById('download-original').disabled = false;
      document.getElementById('editor-container').style.display = 'block';
      
      const processedTitle = document.getElementById('processed-sprite-title');
      processedTitle.textContent = `${this.generator.outputWidth}x${this.generator.outputHeight} Sprite`;
      
      // Enhanced logging and visibility control for animate button
      const animateBtn = document.getElementById('animate-btn');
      if (animateBtn) {
        console.log('Animate button found, setting display to block');
        animateBtn.style.display = 'block';
      } else {
        console.error('Animate button not found in the DOM');
      }
      
      // Also load the image to the pixel editor if it exists
      if (this.generator.pixelEditor && this.generator.pixelEditor.canvas) {
        const gridSize = parseInt(document.getElementById('pixel-grid-size')?.value || '32');
        this.generator.pixelEditor.resizeGrid(gridSize);
        this.generator.pixelEditor.loadSpriteForEditing(this.generator.currentAssetId, gridSize);
      }
    } catch (error) {
      console.error('Error loading image to editor:', error);
      throw error;
    }
  }

  async handleImageUpload(event) {
    if (event.target.files && event.target.files[0]) {
      this.updateUIForLoading(true);
      
      try {
        const file = event.target.files[0];
        const imageUrl = URL.createObjectURL(file);
        
        // Process the uploaded image
        await this.generator.processUploadedImage(imageUrl);
        
        // Generate all sizes automatically
        this.generator.generateAllSizes();
        
        // Enhanced logging and visibility control
        const designSoundBtn = document.getElementById('design-sound-btn');
        const animateBtn = document.getElementById('animate-btn');
        
        if (designSoundBtn) {
          console.log('Design Sound button found, setting display to block');
          designSoundBtn.style.display = 'block';
        } else {
          console.error('Design Sound button not found');
        }
        
        if (animateBtn) {
          console.log('Animate button found, setting display to block');
          animateBtn.style.display = 'block';
        } else {
          console.error('Animate button not found in the DOM');
        }
      } catch (error) {
        console.error('Error processing uploaded image:', error);
        alert('Failed to process the uploaded image. Please try again with a different image.');
      } finally {
        this.updateUIForLoading(false);
        // Reset file input so the same file can be selected again
        event.target.value = '';
      }
    }
  }

  updateUIForLoading(isLoading) {
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
      generateBtn.disabled = isLoading;
    }

    const loading = document.getElementById('loading');
    loading.style.display = isLoading ? 'block' : 'none';
  }

  showGenerateDisabledPopup() {
    const popup = document.createElement('div');
    popup.id = 'generate-disabled-popup';
    popup.className = 'animation-popup warning';

    const content = document.createElement('div');
    content.className = 'animation-popup-content';
    content.textContent = 'Please wait while generating the sprite.';

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
}