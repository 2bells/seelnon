import PuppetTool from './puppetTool.js';
import Timeline from './timeline.js';
import PixelEditor from './editor/pixelEditor.js';
import SaveManager from './saveManager.js'; // Import SaveManager

const GIF_TRANSPARENCY_KEY_COLOR_HEX = '#FF00FF'; // Magenta
const GIF_TRANSPARENCY_KEY_COLOR_NUM = 0xFF00FF;

class PixelPuppetApp {
  constructor() {
    this.currentTool = 'pin'; // Initial tool is pin
    this.spriteCanvas = document.getElementById('spriteCanvas');
    this.pinCanvas = document.getElementById('pinCanvas');
    
    if (!this.spriteCanvas || !this.pinCanvas) {
      console.error('Canvas elements not found');
      return;
    }
    
    this.spriteCtx = this.spriteCanvas.getContext('2d');
    this.pinCtx = this.pinCanvas.getContext('2d');

    // History for undo/redo
    this.historyStack = [];
    this.historyIndex = -1;
    this.maxHistorySize = 50; // Max number of undo steps
    
    this.puppetTool = new PuppetTool(this.spriteCanvas, this.pinCanvas, this); // Pass app instance
    this.timeline = new Timeline(16, this.puppetTool, this); // Pass app instance
    this.pixelEditor = new PixelEditor();
    this.saveManager = new SaveManager(this); // Instantiate SaveManager
    
    this.puppetWorkingResolution = 64; // Default puppet tool working resolution
    this.uploadedImageOriginalData = null; // Stores the unscaled original image
    this.basePuppetImage = null; // Stores the image/canvas scaled to puppetWorkingResolution for the base

    this.setupListeners();
    this.setupTimeline();
    this.setupExportControls();
    this.setupNewSpriteModal(); // Ensure the modal for "New Sprite" is initialized
    
    this.wireframeVisible = true;
    this.pinsVisible = true;
    
    this.zoomLevel = 1; // Initial zoom level
    
    // Defensive check to ensure resizing works
    try {
      this.resizeCanvases();
    } catch (error) {
      console.error('Error resizing canvases:', error);
    }
    
    this.setStatus('Ready! Create or load a sprite to begin.');
    
    this.setupFileUpload();
    this.setupCollapsibleSections();
    this.setupPixelEditorFrameListener();
    this.setupGlobalKeyboardShortcuts(); // For puppet tool undo/redo
    this.setupKeyImageManagement(); // New setup for key images
    this.setupPuppetResolutionControl();
    this.setupSaveLoadModals(); // New setup for save/load modals and buttons

    // Initialize button states and cursor after everything is set up
    this.updatePuppetToolButtonStates();
    this.updatePuppetToolCursor();
    this.updateToggleButtonsUI();
    this.updateKeepMeshToggleUI(); // Initialize Keep Mesh button UI
    this.updateExportFrameOptions(); // Initialize export options based on default frame count

    // Set initial state for the play button
    const playButton = document.getElementById('playAnimation');
    if (playButton) {
        playButton.textContent = 'Play';
        playButton.classList.add('play-state');
        playButton.classList.remove('stop-state');
    }
  }
  
  setupFileUpload() {
    const uploadButton = document.getElementById('uploadImage');
    const fileInput = document.getElementById('imageUpload');
    
    if (!uploadButton || !fileInput) {
      console.warn('File upload elements not found');
      return;
    }
    
    uploadButton.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.loadUserImage(file);
      }
    });
    
    // Setup Spritesheet Upload to Timeline
    const uploadSheetButton = document.getElementById('uploadSheet');
    const sheetInput = document.getElementById('spritesheetUploadForTimeline');
    const uploadSheetModal = document.getElementById('uploadSheetModal');
    const closeUploadSheetModal = uploadSheetModal ? uploadSheetModal.querySelector('.close-upload-sheet') : null;
    const confirmUploadSheetBtn = document.getElementById('confirmUploadSheet');

    if (uploadSheetButton && sheetInput && uploadSheetModal && closeUploadSheetModal && confirmUploadSheetBtn) {
        uploadSheetButton.addEventListener('click', () => {
            sheetInput.click();
        });

        sheetInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // Store file temporarily and show modal for parameters
                this.tempSpritesheetFile = file;
                uploadSheetModal.style.display = 'block';
            }
            sheetInput.value = ''; // Clear file input
        });
        
        closeUploadSheetModal.addEventListener('click', () => uploadSheetModal.style.display = 'none');
        // REMOVED: Listener to close modal when clicking outside
        /*
        window.addEventListener('click', (e) => {
            if (e.target === uploadSheetModal) uploadSheetModal.style.display = 'none';
        });
        */

        confirmUploadSheetBtn.addEventListener('click', () => {
            const width = parseInt(document.getElementById('sheetFrameWidth').value);
            const height = parseInt(document.getElementById('sheetFrameHeight').value);
            const count = parseInt(document.getElementById('sheetFrameCount').value);

            if (isNaN(width) || isNaN(height) || isNaN(count) || width <= 0 || height <= 0 || count <= 0) {
                this.setStatus('Invalid sheet parameters.');
                return;
            }

            if (this.tempSpritesheetFile) {
                this.loadUserSpritesheetToKeyImages(this.tempSpritesheetFile, width, height, count);
                this.tempSpritesheetFile = null;
                uploadSheetModal.style.display = 'none';
            }
        });
    }

    // Setup spritesheet upload (Pixel Editor)
    const spritesheetButton = document.getElementById('uploadSpritesheet');
    const spritesheetInput = document.getElementById('spritesheetUpload');
    
    if (spritesheetButton && spritesheetInput) {
      spritesheetButton.addEventListener('click', () => {
        spritesheetInput.click();
      });
      
      spritesheetInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.loadUserSpritesheet(file);
        }
      });
    }
  }
  
  setupNewSpriteModal() {
    const modal = document.getElementById('newSpriteModal');
    const btn = document.getElementById('newSprite');
    const span = document.getElementsByClassName('close')[0];
    const createBtn = document.getElementById('createSprite');
    
    if (!modal || !btn || !span || !createBtn) {
        console.warn('New Sprite Modal elements not found');
        return;
    }
    
    btn.addEventListener('click', () => {
      modal.style.display = 'block';
    });
    
    span.addEventListener('click', () => {
      modal.style.display = 'none';
    });
    
    // REMOVED: Listener to close modal when clicking outside
    /*
    window.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
    */
    
    createBtn.addEventListener('click', () => {
      const widthInput = document.getElementById('spriteWidth');
      const heightInput = document.getElementById('spriteHeight');
      const backgroundSelect = document.getElementById('spriteBackground');

      if (!widthInput || !heightInput || !backgroundSelect) {
          console.warn('Modal form elements not found');
          return;
      }

      const width = parseInt(widthInput.value);
      const height = parseInt(heightInput.value);
      const background = backgroundSelect.value;
      
      if (width && height) {
        this.pixelEditor.createNewSprite(width, height, background);
        this.setStatus(`New ${width}x${height} sprite created.`);
        modal.style.display = 'none';
      } else {
        this.setStatus('Please enter valid width and height.');
      }
    });
  }

  setupPuppetResolutionControl() {
    const resolutionSelect = document.getElementById('puppetResolutionSelect');
    if (resolutionSelect) {
      resolutionSelect.value = this.puppetWorkingResolution.toString();
      resolutionSelect.addEventListener('change', async (e) => {
        const newRes = parseInt(e.target.value);
        if (!isNaN(newRes) && newRes > 0) {
          this.puppetWorkingResolution = newRes;
          this.setStatus(`Puppet tool resolution set to ${newRes}x${newRes}.`);
          await this.reprocessBaseImageForPuppetTool();
        }
      });
    }
  }

  async reprocessBaseImageForPuppetTool() {
    if (this.uploadedImageOriginalData) {
      const scaledCanvas = this.scaleImageToResolution(this.uploadedImageOriginalData, this.puppetWorkingResolution); // This is sync
      
      this.basePuppetImage = scaledCanvas;

      // No need for complex checks here, puppetTool.loadSprite will handle it.
      // The 'false' for isKeyImageChange will ensure pins are reset for the new resolution context.
      await this.puppetTool.loadSprite(this.basePuppetImage, this.uploadedImageOriginalData, false);
      this.timeline.updatePuppetToolState();
    }
  }

  scaleImageToResolution(sourceImageElement, targetResolution) {
    if (!sourceImageElement || !sourceImageElement.width || !sourceImageElement.height) {
        console.warn("ScaleImageToResolution: Invalid source image element.");
        const errorCanvas = document.createElement('canvas');
        errorCanvas.width = targetResolution;
        errorCanvas.height = targetResolution;
        return errorCanvas; // Return a blank canvas
    }

    const tempCanvas = document.createElement('canvas');
    
    const sourceWidth = sourceImageElement.naturalWidth || sourceImageElement.width;
    const sourceHeight = sourceImageElement.naturalHeight || sourceImageElement.height;

    let newWidth, newHeight;
    const aspectRatio = sourceWidth / sourceHeight;

    if (sourceWidth > sourceHeight) {
        newWidth = targetResolution;
        newHeight = targetResolution / aspectRatio;
    } else {
        newHeight = targetResolution;
        newWidth = targetResolution * aspectRatio;
    }
    
    // Ensure dimensions are integers to avoid subpixel issues.
    newWidth = Math.round(newWidth);
    newHeight = Math.round(newHeight);

    // The canvas itself should be targetResolution x targetResolution for consistent puppet tool input size.
    // The image will be drawn scaled *within* this canvas, centered.
    tempCanvas.width = targetResolution;
    tempCanvas.height = targetResolution;
    
    const ctx = tempCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false; // Important for pixel art

    // Calculate x, y to center the image on the targetResolution canvas
    const x = Math.round((targetResolution - newWidth) / 2);
    const y = Math.round((targetResolution - newHeight) / 2);

    ctx.drawImage(sourceImageElement, x, y, newWidth, newHeight);
    return tempCanvas;
  }

  setupListeners() {
    window.addEventListener('resize', () => this.resizeCanvases());
    
    const setupButtonListener = (id, handler, statusMessage) => {
      const button = document.getElementById(id);
      if (button) {
        button.addEventListener('click', () => {
          handler();
          if (statusMessage) this.setStatus(statusMessage);
        });
      } else {
        console.warn(`Button ${id} not found`);
      }
    };
    
    setupButtonListener('pinTool', () => {
      this.currentTool = 'pin';
      this.puppetTool.setMode('pin');
      this.updatePuppetToolButtonStates(); // Update button states
      this.updatePuppetToolCursor();
    }, 'Pin Tool selected. Click on the sprite to place pins.');
    
    setupButtonListener('moveTool', () => {
      this.currentTool = 'move';
      this.puppetTool.setMode('move');
      this.updatePuppetToolButtonStates(); // Update button states
      this.updatePuppetToolCursor();
    }, 'Move Tool selected. Drag pins to deform the mesh.');
    
    setupButtonListener('removePinTool', () => {
      this.currentTool = 'removePin';
      this.puppetTool.setMode('removePin');
      this.updatePuppetToolButtonStates();
      this.updatePuppetToolCursor();
    }, 'Remove Pin Tool selected. Click on a pin to remove it.');
    
    setupButtonListener('clearPins', () => {
      this.puppetTool.clearPins(); // This will now internally call addHistoryAction
      // Status message will be set by addHistoryAction
    }, null); 
    
    setupButtonListener('loadSample', () => {
      this.loadSampleSprite();
    });
    
    setupButtonListener('bakeAnimation', () => {
      const resolutionSelect = document.getElementById('spritesheetSize');
      const frameSelect = document.getElementById('spritesheetFrames');
      
      if (!resolutionSelect || !frameSelect) {
         this.setStatus('Export controls not found for baking.');
         return;
      }

      const resolution = parseInt(resolutionSelect.value) || 64;
      const frameCount = parseInt(frameSelect.value) || 16;

      if (!this.puppetTool.originalSprite) {
        this.setStatus('No sprite loaded for baking. Please upload an image or send a frame from the pixel editor first.');
        return;
      }

      this.setStatus('Baking animation...');

      this.timeline.generateSpritesheet(resolution, frameCount).then(spritesheet => {
        if (spritesheet) {
          // Create a temporary image to load the spritesheet
          const img = new Image();
          img.onload = () => {
            // Load the spritesheet into the pixel editor
            this.pixelEditor.loadFromSpritesheet(img, frameCount);
            this.setStatus(`Animation baked into frames. Edit each frame in the pixel editor.`);
          };
          img.onerror = (e) => {
              console.error("Failed to load baked spritesheet image:", e);
              this.setStatus('Error loading baked animation sprite.');
          };
          img.src = spritesheet;
        } else {
          this.setStatus('Failed to bake animation. Make sure you have a sprite and animation setup.');
        }
      })
      .catch(error => {
          console.error('Error during bake animation:', error);
          this.setStatus('An error occurred during baking.');
      });
    }, null);

    // Add these listeners
    setupButtonListener('toggleWireframe', () => {
      this.wireframeVisible = !this.wireframeVisible;
      this.puppetTool.setWireframeVisibility(this.wireframeVisible);
      this.updateToggleButtonsUI(); // Update button appearance
    }, 'Wireframe toggled.');

    setupButtonListener('togglePins', () => {
      this.pinsVisible = !this.pinsVisible;
      this.puppetTool.setPinsVisibility(this.pinsVisible);
      this.updateToggleButtonsUI(); // Update button appearance
    }, 'Pin visibility toggled.');
    
    setupButtonListener('toggleKeepMesh', () => {
      const newKeepMeshState = !this.puppetTool.keepMesh;
      this.puppetTool.setKeepMesh(newKeepMeshState);
      this.updateKeepMeshToggleUI();
      this.setStatus(`Keep Mesh ${newKeepMeshState ? 'enabled' : 'disabled'}. Mesh will ${newKeepMeshState ? 'be preserved' : 'recalculate optimally'}.`);
    }, null);

    setupButtonListener('addKeyframe', () => {
      this.timeline.addKeyframe(); // Will call addHistoryAction internally
      // Status message will be set by addHistoryAction or addKeyframe itself
    }, null); 
    
    setupButtonListener('deleteKeyframe', () => {
      if (this.timeline.deleteKeyframe(this.timeline.currentFrame)) { // Will call addHistoryAction internally
         // Status message handled by deleteKeyframe for success/failure
      }
    });

    // New button for updating pin keyframes
    setupButtonListener('updatePinKeyframe', () => {
        this.timeline.updateActivePinKeyframe();
        // Status will be set by updateActivePinKeyframe or addPinKeyframe
    }, null);

    // Puppet Tool Undo/Redo Buttons
    setupButtonListener('undoPuppet', () => {
        this.undo(); // Call app's undo
    }, null);

    setupButtonListener('redoPuppet', () => {
        this.redo(); // Call app's redo
    }, null);
    
    setupButtonListener('prevFrame', () => {
      this.timeline.prevFrame();
    }, null); // Status updated by timeline.goToFrame
    
    setupButtonListener('nextFrame', () => {
      this.timeline.nextFrame();
    }, null); // Status updated by timeline.goToFrame
    
    setupButtonListener('togglePinTracks', () => {
      this.timeline.toggleExpand();
    }, 'Toggled pin tracks visibility.');
    
    // Playback toggle
    const playButton = document.getElementById('playAnimation');
    if (playButton) {
      playButton.addEventListener('click', () => {
        if (this.timeline.isPlaying) {
          this.timeline.stopPlayback();
          playButton.textContent = 'Play';
          playButton.classList.add('play-state');
          playButton.classList.remove('stop-state');
          this.setStatus('Animation playback stopped.');
        } else {
          if (Object.keys(this.timeline.keyframes).length < 0 && Object.keys(this.timeline.pinKeyframes).length < 0) { // don't need to check for frames, but maybe will be usefull in the future
             this.setStatus('Need 0 keyframes to play animation.');
             return;
          }
          this.timeline.startPlayback();
          playButton.textContent = 'Stop';
          playButton.classList.add('stop-state');
          playButton.classList.remove('play-state');
          this.setStatus('Playing animation...');
        }
      });
    }
    
    // Easing dropdown
    const easingSelect = document.getElementById('easingType');
    if (easingSelect) {
      easingSelect.addEventListener('change', (e) => {
        const selectedEasing = e.target.value;
        this.timeline.setEasingType(this.timeline.currentFrame, selectedEasing);
        this.setStatus(`Easing set to ${selectedEasing} for Frame ${this.timeline.currentFrame}`);
      });
    }
    
    // Add zoom controls
    const zoomInButton = document.getElementById('zoomIn');
    const zoomOutButton = document.getElementById('zoomOut');
    
    if (zoomInButton) {
        zoomInButton.addEventListener('click', () => {
            this.zoomIn();
        });
    } else {
        console.warn("Zoom In button not found");
    }

    if (zoomOutButton) {
        zoomOutButton.addEventListener('click', () => {
            this.zoomOut();
        });
    } else {
         console.warn("Zoom Out button not found");
    }
    
    const viewport = document.querySelector('.viewport');
    if (viewport) {
      viewport.addEventListener('mouseenter', () => this.updatePuppetToolCursor());
      viewport.addEventListener('mouseleave', () => this.resetPuppetToolCursor());
    }
    
    // Set Total Frames button
    const setTotalFramesButton = document.getElementById('setTotalFrames');
    if (setTotalFramesButton) {
        setTotalFramesButton.addEventListener('click', () => {
            const totalFramesInput = document.getElementById('totalFramesInput');
            const newCount = parseInt(totalFramesInput.value);
            if (!isNaN(newCount) && newCount > 0) {
                this.timeline.setTotalFrames(newCount);
                this.setStatus(`Total frames set to ${this.timeline.getFrameCount()}.`);
                this.updateExportFrameOptions(); // Update export options when timeline length changes
            } else {
                this.setStatus('Invalid total frames value.');
                totalFramesInput.value = this.timeline.getFrameCount(); // Reset to current valid
            }
        });
    }
  }
  
  updatePuppetToolButtonStates() {
    const pinButton = document.getElementById('pinTool');
    const moveButton = document.getElementById('moveTool');
    const removePinButton = document.getElementById('removePinTool');

    if (pinButton) pinButton.classList.remove('active');
    if (moveButton) moveButton.classList.remove('active');
    if (removePinButton) removePinButton.classList.remove('active');

    if (this.currentTool === 'pin' && pinButton) {
        pinButton.classList.add('active');
    } else if (this.currentTool === 'move' && moveButton) {
        moveButton.classList.add('active');
    } else if (this.currentTool === 'removePin' && removePinButton) {
        removePinButton.classList.add('active');
    }
  }
  
  updatePuppetToolCursor() {
    const viewport = document.querySelector('.viewport');
    if (!viewport) return;

    // Remove any existing cursor classes
    viewport.classList.remove('pin-tool-cursor', 'move-tool-cursor', 'remove-pin-tool-cursor');

    // Add appropriate cursor based on current tool
    if (this.currentTool === 'pin') {
      viewport.classList.add('pin-tool-cursor');
    } else if (this.currentTool === 'move') {
      viewport.classList.add('move-tool-cursor');
    } else if (this.currentTool === 'removePin') {
      viewport.classList.add('remove-pin-tool-cursor');
    }
  }

  resetPuppetToolCursor() {
    const viewport = document.querySelector('.viewport');
    if (!viewport) return;

    // Remove any cursor classes
    viewport.classList.remove('pin-tool-cursor', 'move-tool-cursor', 'remove-pin-tool-cursor');
  }
  
  updateToggleButtonsUI() {
      const wireframeButton = document.getElementById('toggleWireframe');
      const pinsButton = document.getElementById('togglePins');

      if (wireframeButton) {
          if (this.wireframeVisible) {
              wireframeButton.classList.add('active');
          } else {
              wireframeButton.classList.remove('active');
          }
      }
      
      if (pinsButton) {
           if (this.pinsVisible) {
              pinsButton.classList.add('active');
          } else {
              pinsButton.classList.remove('active');
          }
      }
  }

  updateKeepMeshToggleUI() {
      const keepMeshButton = document.getElementById('toggleKeepMesh');
      if (keepMeshButton) {
          if (this.puppetTool.keepMesh) {
              keepMeshButton.classList.add('active');
          } else {
              keepMeshButton.classList.remove('active');
          }
      }
  }

  setupTimeline() {
    const timelineContainer = document.querySelector('.timeline');
     if (!timelineContainer) {
        console.warn("Timeline container not found");
        return;
     }
    timelineContainer.innerHTML = '';
    
    this.timeline.initDOM(timelineContainer);
    this.timeline.updateTimelineUI();
  }
  
  setupExportControls() {
    let exportControlsContainer = document.querySelector('.export-controls-container');
    if (!exportControlsContainer) {
      exportControlsContainer = document.createElement('div');
      exportControlsContainer.className = 'export-controls-container'; 
      
      const exportSaveLoadArea = document.createElement('div');
      exportSaveLoadArea.className = 'export-save-load-area';

      const exportOptionsDiv = document.createElement('div');
      exportOptionsDiv.className = 'export-options'; 
      
      // Rebuild exportOptionsDiv content with DOM elements
      const h3 = document.createElement('h3');
      h3.textContent = 'Export';
      exportOptionsDiv.appendChild(h3);

      // Size option
      const sizeOptionDiv = document.createElement('div');
      sizeOptionDiv.className = 'export-option';
      const sizeLabel = document.createElement('label');
      sizeLabel.htmlFor = 'spritesheetSize';
      sizeLabel.textContent = 'Size:';
      const sizeSelect = document.createElement('select');
      sizeSelect.id = 'spritesheetSize';
      sizeSelect.innerHTML = `
        <option value="32">32×32</option>
        <option value="64" selected>64×64</option>
        <option value="128">128×128</option>
        <option value="256">256×256</option> 
      `;
      sizeOptionDiv.appendChild(sizeLabel);
      sizeOptionDiv.appendChild(sizeSelect);
      exportOptionsDiv.appendChild(sizeOptionDiv);

      // Frames option
      const framesOptionDiv = document.createElement('div');
      framesOptionDiv.className = 'export-option';
      const framesLabel = document.createElement('label');
      framesLabel.htmlFor = 'spritesheetFrames';
      framesLabel.textContent = 'Frames:';
      const framesSelect = document.createElement('select');
      framesSelect.id = 'spritesheetFrames';
      // Options will be populated by JS
      framesOptionDiv.appendChild(framesLabel);
      framesOptionDiv.appendChild(framesSelect);
      exportOptionsDiv.appendChild(framesOptionDiv);

      // Format option
      const formatOptionDiv = document.createElement('div');
      formatOptionDiv.className = 'export-option';
      const formatLabel = document.createElement('label');
      formatLabel.htmlFor = 'exportFormat';
      formatLabel.textContent = 'Format:';
      const formatSelect = document.createElement('select');
      formatSelect.id = 'exportFormat';
      formatSelect.innerHTML = `
        <option value="png" selected>PNG</option>
        <option value="gif">GIF</option>
      `;
      formatOptionDiv.appendChild(formatLabel);
      formatOptionDiv.appendChild(formatSelect);
      exportOptionsDiv.appendChild(formatOptionDiv);

      // GIF Frame Delay option (initially hidden)
      const gifDelayOptionDiv = document.createElement('div');
      gifDelayOptionDiv.className = 'export-option';
      gifDelayOptionDiv.id = 'gifDelayOption';
      gifDelayOptionDiv.style.display = 'none'; // Hidden by default
      const gifDelayLabel = document.createElement('label');
      gifDelayLabel.htmlFor = 'gifFrameDelay';
      gifDelayLabel.textContent = 'Delay (ms):';
      const gifDelayInput = document.createElement('input');
      gifDelayInput.type = 'number';
      gifDelayInput.id = 'gifFrameDelay';
      gifDelayInput.value = '90';
      gifDelayInput.min = '10';
      gifDelayInput.style.width = '70px';
      gifDelayOptionDiv.appendChild(gifDelayLabel);
      gifDelayOptionDiv.appendChild(gifDelayInput);
      exportOptionsDiv.appendChild(gifDelayOptionDiv);
      
      formatSelect.addEventListener('change', (e) => {
        gifDelayOptionDiv.style.display = e.target.value === 'gif' ? 'flex' : 'none';
      });

      // Export Puppet Animation button
      const exportPuppetButton = document.createElement('button');
      exportPuppetButton.id = 'exportSpritesheet';
      exportPuppetButton.textContent = 'Export Puppet';
      exportOptionsDiv.appendChild(exportPuppetButton);
      
      // Export Pixel Animation button
      const exportPixelButton = document.createElement('button');
      exportPixelButton.id = 'exportPixelSpritesheet';
      exportPixelButton.textContent = 'Export Pixel';
      exportOptionsDiv.appendChild(exportPixelButton);

      // "Include background" toggle for Pixel Animation
      const includeBackgroundOptionDiv = document.createElement('div');
      includeBackgroundOptionDiv.className = 'export-option';
      const includeBackgroundToggle = document.createElement('input');
      includeBackgroundToggle.type = 'checkbox';
      includeBackgroundToggle.id = 'includeBackgroundToggle';
      includeBackgroundToggle.style.marginRight = '4px';
      const includeBackgroundLabel = document.createElement('label');
      includeBackgroundLabel.htmlFor = 'includeBackgroundToggle';
      includeBackgroundLabel.textContent = 'Include BG';
      includeBackgroundLabel.style.marginBottom = '0'; // Override default label margin
      includeBackgroundOptionDiv.appendChild(includeBackgroundToggle);
      includeBackgroundOptionDiv.appendChild(includeBackgroundLabel);
      exportOptionsDiv.appendChild(includeBackgroundOptionDiv);

      exportSaveLoadArea.appendChild(exportOptionsDiv);

      const saveLoadControlsDiv = document.createElement('div');
      saveLoadControlsDiv.className = 'save-load-controls';
      exportSaveLoadArea.appendChild(saveLoadControlsDiv);
      
      exportControlsContainer.appendChild(exportSaveLoadArea);
      
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.appendChild(exportControlsContainer);
      } else {
          console.warn("Main content container not found, cannot add export controls.");
      }
      
      // Add event listeners to the created buttons
      if (exportPixelButton) {
        exportPixelButton.addEventListener('click', async () => {
          if (!this.pixelEditor.frames || this.pixelEditor.frames.length === 0) {
             this.setStatus('No frames in Pixel Editor to export.');
             return;
          }
          this.setStatus('Generating pixel animation...');
          const selectedFormat = document.getElementById('exportFormat').value;
          const gifDelay = parseInt(document.getElementById('gifFrameDelay').value) || 100;

          try {
            if (selectedFormat === 'png') {
              const spritesheet = await this.pixelEditor.generateSpritesheet();
              if (spritesheet) {
                const link = document.createElement('a');
                link.download = `pixel_spritesheet.png`;
                link.href = spritesheet;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                this.setStatus(`Pixel animation spritesheet exported with ${this.pixelEditor.frames.length} frames`);
              } else {
                this.setStatus('Failed to generate pixel spritesheet.');
              }
            } else if (selectedFormat === 'gif') {
              await this.generatePixelGif(gifDelay);
            }
          } catch (error) {
            console.error('Pixel animation export error:', error);
            this.setStatus('Error generating pixel animation');
          }
        });
      }

      if (exportPuppetButton) {
        exportPuppetButton.addEventListener('click', async () => {
          const resolutionSelect = document.getElementById('spritesheetSize');
          const frameSelect = document.getElementById('spritesheetFrames');
          const formatSelectElem = document.getElementById('exportFormat');
          const gifDelayInputElem = document.getElementById('gifFrameDelay');
          
          if (!resolutionSelect || !frameSelect || !formatSelectElem || !gifDelayInputElem) {
            this.setStatus('Export controls not found');
            return;
          }
          
          const resolution = parseInt(resolutionSelect.value);
          const frameCount = parseInt(frameSelect.value); 
          const format = formatSelectElem.value;
          const delay = parseInt(gifDelayInputElem.value) || 100;
          
          if (isNaN(frameCount) || frameCount <= 0) {
            this.setStatus('Invalid frame count selected for export.');
            return;
          }

          if (!this.puppetTool.originalSprite) {
            this.setStatus('No sprite loaded for puppet animation. Please upload an image or send a frame from the pixel editor.');
            return;
          }
           if (Object.keys(this.timeline.keyframes).length === 0 && frameCount > 1) { 
              this.setStatus('No keyframes found in timeline to export puppet animation. Exporting current frame.');
           }
          
          this.setStatus(`Generating puppet animation ${format.toUpperCase()}...`);
          
          try {
            if (format === 'png') {
              const spritesheet = await this.timeline.generateSpritesheet(resolution, frameCount);
              if (spritesheet) {
                const link = document.createElement('a');
                link.download = `puppet_spritesheet_${resolution}x${resolution}_${frameCount}frames.png`;
                link.href = spritesheet;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                this.setStatus(`Puppet animation spritesheet exported: ${resolution}x${resolution}, ${frameCount} frames`);
              } else {
                this.setStatus('Failed to generate puppet animation spritesheet. Ensure keyframes are set or image is loaded.');
              }
            } else if (format === 'gif') {
                 await this.generatePuppetGif(resolution, frameCount, delay);
            }
          } catch (error) {
            console.error(`Puppet ${format.toUpperCase()} generation error:`, error);
            this.setStatus(`Error generating puppet animation ${format.toUpperCase()}`);
          }
        });
      }
    }
    this.updateExportFrameOptions(); 
  }

  updateExportFrameOptions() {
    const frameSelect = document.getElementById('spritesheetFrames');
    if (!frameSelect) return;

    const currentTimelineFrames = this.timeline.getFrameCount();
    const standardOptions = [4, 8, 12, 16];
    
    let lastSelectedValue = frameSelect.value;

    frameSelect.innerHTML = ''; // Clear existing options

    standardOptions.forEach(val => {
        const option = document.createElement('option');
        option.value = val;
        option.textContent = val;
        frameSelect.appendChild(option);
    });

    if (!standardOptions.includes(currentTimelineFrames)) {
        const customOption = document.createElement('option');
        customOption.value = currentTimelineFrames;
        customOption.textContent = `${currentTimelineFrames} (Timeline)`;
        frameSelect.appendChild(customOption);
    }
    
    if (Array.from(frameSelect.options).some(opt => opt.value == lastSelectedValue)) {
        frameSelect.value = lastSelectedValue;
    } else if (Array.from(frameSelect.options).some(opt => opt.value == currentTimelineFrames)) {
        frameSelect.value = currentTimelineFrames;
    } else if (frameSelect.options.length > 0) {
        const defaultSelection = standardOptions.includes(currentTimelineFrames) ? currentTimelineFrames : standardOptions[standardOptions.length -1];
        if (Array.from(frameSelect.options).some(opt => opt.value == defaultSelection)) {
           frameSelect.value = defaultSelection;
        } else {
           frameSelect.selectedIndex = frameSelect.options.length -1; 
        }
    }
  }
  
  setupCollapsibleSections() {
    document.querySelectorAll('.collapse-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const section = button.closest('.collapsible-section');
        if (section) {
            section.classList.toggle('collapsed');
            
            const canvases = section.querySelectorAll('canvas');
            if (canvases.length > 0) {
               setTimeout(() => window.dispatchEvent(new Event('resize')), 350); 
            } else {
                window.dispatchEvent(new Event('resize'));
            }
            
            e.stopPropagation();
        }
      });
    });

    const pixelEditorSection = document.querySelector('.collapsible-section.collapsed');
    if (pixelEditorSection && !pixelEditorSection.classList.contains('collapsed')) {
         pixelEditorSection.classList.add('collapsed');
    }
  }
  
  async setupPixelEditorFrameListener() { 
    window.addEventListener('pixelEditorFrameSent', async (e) => { 
      const imageFromEditor = e.detail.image; // This is an Image object
      
      this.uploadedImageOriginalData = imageFromEditor;
      const scaledForPuppet = this.scaleImageToResolution(imageFromEditor, this.puppetWorkingResolution); // This is sync
      
      this.basePuppetImage = scaledForPuppet; 
      await this.puppetTool.loadSprite(scaledForPuppet, imageFromEditor, false); // Added await
      
      this.pixelEditor.loadFromImage(imageFromEditor); // Pixel editor gets the original sample
      this.setStatus('Frame sent to Puppet Tool, set as base image.');
      this.timeline.updatePuppetToolState(); 
    });
  }
  
  setupGlobalKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        const activeElement = document.activeElement;
        const isInputElement = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT' || activeElement.tagName === 'TEXTAREA');

        if (isInputElement && (e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
            return; 
        }

        if ((e.ctrlKey || e.metaKey)) {
            if (e.key.toLowerCase() === 'z') {
                e.preventDefault(); 
                if (e.shiftKey) {
                     this.redo(); 
                } else {
                     this.undo();
                }
            } else if (e.key.toLowerCase() === 'y') {
                e.preventDefault(); 
                this.redo();
            }
        }
    });
  }
  
  setupKeyImageManagement() {
    this.keyImages = []; 
    this.basePuppetImage = null; 

    const uploadKeyImageButton = document.getElementById('uploadKeyImage');
    const manageKeyImagesButton = document.getElementById('manageKeyImages');
    const keyImagesModal = document.getElementById('keyImagesModal');
    const closeKeyImagesModal = keyImagesModal.querySelector('.close-key-images');
    const keyImageUploadInput = document.getElementById('keyImageUploadInput');
    const addMoreKeyImagesButton = document.getElementById('addMoreKeyImages');

    if (!uploadKeyImageButton || !manageKeyImagesButton || !keyImagesModal || !closeKeyImagesModal || !keyImageUploadInput || !addMoreKeyImagesButton) {
        console.warn('Key Image management UI elements not found.');
        return;
    }

    uploadKeyImageButton.addEventListener('click', () => keyImageUploadInput.click());
    addMoreKeyImagesButton.addEventListener('click', () => keyImageUploadInput.click());

    keyImageUploadInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            Array.from(files).forEach(file => this.loadKeyImageFile(file));
            keyImageUploadInput.value = ''; 
            if (keyImagesModal.style.display !== 'block') { 
                manageKeyImagesButton.click();
            }
        }
    });

    manageKeyImagesButton.addEventListener('click', () => {
        keyImagesModal.style.display = 'block';
        this.renderKeyImagesList();
    });

    closeKeyImagesModal.addEventListener('click', () => {
        keyImagesModal.style.display = 'none';
    });

    // REMOVED: Listener to close modal when clicking outside
    /*
    window.addEventListener('click', (e) => {
        if (e.target === keyImagesModal) {
            keyImagesModal.style.display = 'none';
        }
    });
    */
  }

  loadKeyImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const keyImageEntry = {
                id: Date.now() + Math.random().toString(36).substring(2, 9), 
                name: file.name,
                imageObject: img,
                activeFrame: 0 
            };
            this.keyImages.push(keyImageEntry);
            this.renderKeyImagesList(); 
            this.timeline.updatePuppetToolState(); 
            this.setStatus(`Key image "${file.name}" uploaded.`);
        };
        img.onerror = () => {
            this.setStatus(`Error loading key image "${file.name}".`);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  renderKeyImagesList() {
    const container = document.getElementById('keyImagesListContainer');
    if (!container) return;
    container.innerHTML = ''; 

    if (this.keyImages.length === 0) {
        container.innerHTML = '<p>No key images uploaded yet. Click "Upload Key Image" or "Upload More Key Images".</p>';
        return;
    }

    this.keyImages.forEach(ki => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'key-image-item';
        itemDiv.dataset.id = ki.id;

        const thumb = new Image();
        thumb.src = ki.imageObject.src;
        itemDiv.appendChild(thumb);

        const infoDiv = document.createElement('div');
        infoDiv.className = 'info';
        const nameSpan = document.createElement('span');
        nameSpan.textContent = ki.name;
        infoDiv.appendChild(nameSpan);
        itemDiv.appendChild(infoDiv);

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'controls';
        
        const frameLabel = document.createElement('label');
        frameLabel.textContent = 'Active Frame:';
        const frameInput = document.createElement('input');
        frameInput.type = 'number';
        frameInput.min = '0'; 
        frameInput.max = this.timeline.getFrameCount(); 
        frameInput.value = ki.activeFrame;
        frameInput.addEventListener('change', (e) => {
            const newFrame = parseInt(e.target.value, 10);
            if (!isNaN(newFrame)) {
                ki.activeFrame = Math.max(0, Math.min(newFrame, this.timeline.getFrameCount()));
                e.target.value = ki.activeFrame; 
                this.timeline.updatePuppetToolState(); 
                this.timeline.updateTimelineUI(); 
                 this.setStatus(`Key image "${ki.name}" active frame set to ${ki.activeFrame}.`);
            }
        });

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => {
            this.keyImages = this.keyImages.filter(img => img.id !== ki.id);
            this.renderKeyImagesList();
            this.timeline.updatePuppetToolState();
            this.setStatus(`Key image "${ki.name}" deleted.`);
        });

        controlsDiv.appendChild(frameLabel);
        controlsDiv.appendChild(frameInput);
        controlsDiv.appendChild(deleteButton);
        itemDiv.appendChild(controlsDiv);

        container.appendChild(itemDiv);
    });
  }
  
  getBasePuppetImage() {
    // This now returns an HTMLCanvasElement or null
    return this.basePuppetImage;
  }

  addHistoryAction(action) {
    if (this.historyIndex < this.historyStack.length - 1) {
      this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
    }

    this.historyStack.push(action);
    this.historyIndex++;

    if (this.historyStack.length > this.maxHistorySize) {
      this.historyStack.shift();
      this.historyIndex--;
    }
    if (action.description) {
        this.setStatus(action.description + " (recorded for undo)");
    }
  }

  undo() {
    if (this.historyIndex < 0) {
      this.setStatus('Nothing to undo.');
      return;
    }

    const action = this.historyStack[this.historyIndex];
    let undone = false;

    try {
        switch (action.module) {
            case 'puppet':
                undone = this.undoPuppetAction(action);
                break;
            case 'timeline':
                undone = this.undoTimelineAction(action);
             case 'pixelEditor': 
                if (this.pixelEditor && typeof this.pixelEditor.undo === 'function' && action.type && action.type.startsWith('pixelEdit')) {
                     this.pixelEditor.undo(); // Call its internal undo
                     undone = true; 
                } else {
                    console.warn("Unhandled pixelEditor undo action at app level:", action);
                }
                break;
        }

        if (undone) {
            this.historyIndex--;
            if (!action.description || action.description.includes("(recorded for undo)")) {
                 this.setStatus(`Undid: ${action.description?.replace(" (recorded for undo)", "") || 'last action'}`);
             }
            this.timeline.updateTimelineUI(); 
            this.timeline.updatePuppetToolState(); 
            this.puppetTool.drawSprite(); 
            this.puppetTool.drawPins();   
             this.pixelEditor.updateFramesUI(); 
             this.pixelEditor.redraw(); 
        } else {
            this.setStatus(`Could not undo: ${action.description || 'last action'}`);
        }
    } catch (error) {
        console.error('Error during undo:', error, action);
        this.setStatus(`Error undoing: ${action.description || 'last action'}`);
    }
  }

  redo() {
    if (this.historyIndex >= this.historyStack.length - 1) {
      this.setStatus('Nothing to redo.');
      return;
    }

    this.historyIndex++;
    const action = this.historyStack[this.historyIndex];
    let redone = false;

    try {
        switch (action.module) {
            case 'puppet':
                redone = this.redoPuppetAction(action);
                break;
            case 'timeline':
                redone = this.redoTimelineAction(action);
             case 'pixelEditor': 
                 if (this.pixelEditor && typeof this.pixelEditor.redo === 'function' && action.type && action.type.startsWith('pixelEdit')) {
                     this.pixelEditor.redo(); // Call its internal redo
                     redone = true; 
                } else {
                    console.warn("Unhandled pixelEditor redo action at app level:", action);
                }
                break;
        }
        if (redone) {
             if (!action.description || action.description.includes("(recorded for undo)")) {
                 this.setStatus(`Redid: ${action.description?.replace(" (recorded for undo)", "") || 'next action'}`);
             }
            this.timeline.updateTimelineUI();
            this.timeline.updatePuppetToolState();
            this.puppetTool.drawSprite();
            this.puppetTool.drawPins();
            this.pixelEditor.updateFramesUI();
            this.pixelEditor.redraw();
        } else {
             this.setStatus(`Could not redo: ${action.description || 'next action'}`);
             this.historyIndex--; 
        }
    } catch (error) {
        console.error('Error during redo:', error, action);
        this.setStatus(`Error redoing: ${action.description || 'next action'}`);
        this.historyIndex--; 
    }
  }

  undoPuppetAction(action) {
    switch (action.actionType) {
        case 'pinMove':
        case 'addPin':
        case 'removePin':
        case 'clearPins':
            if (action.undoData && Array.isArray(action.undoData.pins)) {
                this.puppetTool.setPinStates(action.undoData.pins, true); // true for isInternal
                return true;
            } else {
                console.error(`Undo data missing or malformed for puppet action: ${action.actionType}`, action);
                return false;
            }
        default:
            console.warn(`Unknown puppet action type for undo: ${action.actionType}`);
            return false;
    }
  }

  redoPuppetAction(action) {
    switch (action.actionType) {
        case 'pinMove':
        case 'addPin':
        case 'removePin':
        case 'clearPins':
            if (action.redoData && Array.isArray(action.redoData.pins)) {
                this.puppetTool.setPinStates(action.redoData.pins, true); // true for isInternal
                return true;
            } else {
                console.error(`Redo data missing or malformed for puppet action: ${action.actionType}`, action);
                return false;
            }
        default:
            console.warn(`Unknown puppet action type for redo: ${action.actionType}`);
            return false;
    }
  }

  undoTimelineAction(action) {
    switch (action.actionType) {
      case 'addKeyframe':
        if (action.undoData && action.undoData.frameNumber !== undefined) {
             this.timeline.deleteKeyframe(action.undoData.frameNumber, true); 
             return true;
        } else {
            console.error("Undo data missing frameNumber for timeline action: addKeyframe. Data:", action.undoData);
            return false;
        }

      case 'addPinKeyframe': // Undo an add/update
        if (action.undoData && action.undoData.frameNumber !== undefined && action.undoData.pinIndex !== undefined) {
            if (action.undoData.previousData) { // This means it was an update, restore previous
                this.timeline.addPinKeyframe(action.undoData.pinIndex, action.undoData.frameNumber, action.undoData.previousData.state, action.undoData.previousData.easing, true);
            } else { // This means it was a new add, so delete it
                this.timeline.deletePinKeyframe(action.undoData.pinIndex, action.undoData.frameNumber, true);
            }
            return true;
        } else {
            console.error("Undo data missing for timeline action: addPinKeyframe", action);
            return false;
        }

      case 'deletePinKeyframe': // Undo a delete = add
        if (action.undoData && action.undoData.frameNumber !== undefined && action.undoData.pinIndex !== undefined && action.undoData.data) {
             this.timeline.addPinKeyframe(action.undoData.pinIndex, action.undoData.frameNumber, action.undoData.data.state, action.undoData.data.easing, true);
             return true;
        } else {
            console.error("Undo data missing for timeline action: deletePinKeyframe", action);
            return false;
        }

      case 'moveKeyframe': // Master keyframe move
         if (action.undoData && action.undoData.targetMoveFrame !== undefined && action.undoData.sourceMoveFrame !== undefined && action.undoData.keyframeData !== undefined) {
             this.timeline.moveKeyframe(
                 action.undoData.sourceMoveFrame, 
                 action.undoData.targetMoveFrame, 
                 true,                           
                 action.undoData.keyframeData,
                 action.undoData.easingType
             );
             return true;
        } else {
            console.error("Undo data missing for timeline action: moveKeyframe", action);
            return false;
        }
      case 'movePinKeyframe':
        if (action.undoData && action.undoData.pinIndex !== undefined &&
            action.undoData.currentFrameOfMovedKeyframe !== undefined &&
            action.undoData.originalFrameOfMovedKeyframe !== undefined &&
            action.undoData.movedData !== undefined) { // movedData is {state, easing}
            
            const { pinIndex, currentFrameOfMovedKeyframe, originalFrameOfMovedKeyframe, movedData, dataThatWasAtTarget } = action.undoData;

            // 1. Delete the keyframe from its current position (where it was moved TO)
            this.timeline.deletePinKeyframe(pinIndex, currentFrameOfMovedKeyframe, action.undoData.isInternal ? true : false);
            
            // 2. Add the keyframe back to its original position
            this.timeline.addPinKeyframe(pinIndex, originalFrameOfMovedKeyframe, movedData.state, movedData.easing, action.undoData.isInternal ? true : false);
            
            // 3. If there was a keyframe at the target that was overwritten, restore it
            if (dataThatWasAtTarget) {
                this.timeline.addPinKeyframe(pinIndex, currentFrameOfMovedKeyframe, dataThatWasAtTarget.state, dataThatWasAtTarget.easing, action.undoData.isInternal ? true : false);
            }
            return true;
        } else {
            console.error("Undo data missing or malformed for timeline action: movePinKeyframe", action);
            return false;
        }
      case 'setMasterKeyframeEasing': // Changed from 'setEasing'
        if (action.undoData && action.undoData.frameNumber !== undefined && action.undoData.easingType !== undefined) {
            this.timeline.setEasingType(action.undoData.frameNumber, action.undoData.easingType, true);
            return true;
        } else {
            console.error("Undo data missing for timeline action: setMasterKeyframeEasing", action);
            return false;
        }
      case 'setPinKeyframeEasing':
        if (action.undoData && action.undoData.frameNumber !== undefined && action.undoData.pinIndex !== undefined && action.undoData.easingType !== undefined) {
            this.timeline.setEasingType(action.undoData.frameNumber, action.undoData.easingType, true);
            this.timeline.activeEditingTrack = null; // Reset context
            return true;
        } else {
            console.error("Undo data missing for timeline action: setPinKeyframeEasing", action);
            return false;
        }
      case 'deleteKeyframe': 
        if (action.undoData &&
            action.undoData.frameNumber !== undefined &&
            action.undoData.keyframeData && // Expected: array
            action.undoData.hasOwnProperty('easingType')) { // Check for property existence
            // Ensure easingType is at least null if it was undefined, to pass to addKeyframeAt
            const easingToApply = action.undoData.easingType === undefined ? null : action.undoData.easingType;
             this.timeline.addKeyframeAt(action.undoData.frameNumber, action.undoData.keyframeData, easingToApply, true);
             return true;
        } else {
            console.error(
                "Undo data missing or malformed for timeline action: deleteKeyframe. Data:", action.undoData,
                "\nDetails:",
                `action.undoData exists: ${!!action.undoData}`,
                `frameNumber exists: ${action.undoData?.hasOwnProperty('frameNumber')}, value: ${action.undoData?.frameNumber}`,
                `keyframeData exists: ${action.undoData?.hasOwnProperty('keyframeData')}, isArray: ${Array.isArray(action.undoData?.keyframeData)}, value:`, action.undoData?.keyframeData,
                `easingType exists: ${action.undoData?.hasOwnProperty('easingType')}, value: ${action.undoData?.easingType}`
            );
            return false;
        }
      case 'updateKeyframe': 
        if (action.undoData &&
            action.undoData.frameNumber !== undefined &&
            action.undoData.previousKeyframeData && // Expected: array
            action.undoData.hasOwnProperty('previousEasingType')) { // Check for property existence
            const easingToApply = action.undoData.previousEasingType === undefined ? null : action.undoData.previousEasingType;
            this.timeline.addKeyframeAt(action.undoData.frameNumber, action.undoData.previousKeyframeData, easingToApply, true);
            return true;
        } else {
            console.error(
                "Undo data missing or malformed for timeline action: updateKeyframe. Data:", action.undoData,
                "\nDetails:",
                `action.undoData exists: ${!!action.undoData}`,
                `frameNumber exists: ${action.undoData?.hasOwnProperty('frameNumber')}, value: ${action.undoData?.frameNumber}`,
                `previousKeyframeData exists: ${action.undoData?.hasOwnProperty('previousKeyframeData')}, isArray: ${Array.isArray(action.undoData?.previousKeyframeData)}, value:`, action.undoData?.previousKeyframeData,
                `previousEasingType exists: ${action.undoData?.hasOwnProperty('previousEasingType')}, value: ${action.undoData?.previousEasingType}`
            );
            return false;
        }
    }
    return false;
  }

  redoTimelineAction(action) {
     switch (action.actionType) {
      case 'addKeyframe':
        if (action.redoData &&
            action.redoData.frameNumber !== undefined &&
            action.redoData.keyframeData &&
            action.redoData.hasOwnProperty('easingType')) {
             const easingToApply = action.redoData.easingType === undefined ? null : action.redoData.easingType;
             this.timeline.addKeyframeAt(action.redoData.frameNumber, action.redoData.keyframeData, easingToApply, true); 
             return true;
        } else {
            console.error(
                "Redo data missing or malformed for timeline action: addKeyframe. Data:", action.redoData,
                "\nDetails:",
                `action.redoData exists: ${!!action.redoData}`,
                `frameNumber exists: ${action.redoData?.hasOwnProperty('frameNumber')}, value: ${action.redoData?.frameNumber}`,
                `keyframeData exists: ${action.redoData?.hasOwnProperty('keyframeData')}, isArray: ${Array.isArray(action.redoData?.keyframeData)}, value:`, action.redoData?.keyframeData,
                `easingType exists: ${action.redoData?.hasOwnProperty('easingType')}, value: ${action.redoData?.easingType}`
            );
            return false;
        }

      case 'addPinKeyframe': // Redo an add/update
        if (action.redoData && action.redoData.frameNumber !== undefined && action.redoData.pinIndex !== undefined && action.redoData.data) {
             this.timeline.addPinKeyframe(action.redoData.pinIndex, action.redoData.frameNumber, action.redoData.data.state, action.redoData.data.easing, true);
             return true;
        } else {
            console.error("Redo data missing for timeline action: addPinKeyframe", action);
            return false;
        }

      case 'deletePinKeyframe': // Redo a delete = delete
        if (action.redoData && action.redoData.frameNumber !== undefined) {
             this.timeline.deleteKeyframe(action.redoData.frameNumber, true);
             return true;
        } else {
            console.error("Redo data missing frameNumber for timeline action: deleteKeyframe. Data:", action.redoData);
            return false;
        }

      case 'updateKeyframe': // Redo an update
        if (action.redoData &&
            action.redoData.frameNumber !== undefined &&
            action.redoData.keyframeData &&
            action.redoData.hasOwnProperty('easingType')) {
            const easingToApply = action.redoData.easingType === undefined ? null : action.redoData.easingType;
            this.timeline.addKeyframeAt(action.redoData.frameNumber, action.redoData.keyframeData, easingToApply, true);
            return true;
        } else {
            console.error(
                "Redo data missing or malformed for timeline action: updateKeyframe. Data:", action.redoData,
                "\nDetails:",
                `action.redoData exists: ${!!action.redoData}`,
                `frameNumber exists: ${action.redoData?.hasOwnProperty('frameNumber')}, value: ${action.redoData?.frameNumber}`,
                `keyframeData exists: ${action.redoData?.hasOwnProperty('keyframeData')}, isArray: ${Array.isArray(action.redoData?.keyframeData)}, value:`, action.redoData?.keyframeData,
                `easingType exists: ${action.redoData?.hasOwnProperty('easingType')}, value: ${action.redoData?.easingType}`
            );
            return false;
        }
      
      case 'moveKeyframe': // Master keyframe move
         if (action.redoData && action.redoData.sourceMoveFrame !== undefined && action.redoData.targetMoveFrame !== undefined && action.redoData.keyframeData !== undefined) {
             this.timeline.moveKeyframe(
                 action.redoData.sourceMoveFrame, 
                 action.redoData.targetMoveFrame, 
                 true,                           
                 action.redoData.keyframeData,
                 action.redoData.easingType
             );
             return true;
        } else {
            console.error("Redo data missing for timeline action: moveKeyframe", action);
            return false;
        }
      case 'movePinKeyframe':
        if (action.redoData && action.redoData.pinIndex !== undefined &&
            action.redoData.originalFrameOfMovedKeyframe !== undefined &&
            action.redoData.targetFrameForKeyframe !== undefined &&
            action.redoData.movedData !== undefined) { // movedData is {state, easing}

            const { pinIndex, originalFrameOfMovedKeyframe, targetFrameForKeyframe, movedData, dataThatWillBeOverwritten } = action.redoData;

            // 1. Delete the keyframe from its original position
            this.timeline.deletePinKeyframe(pinIndex, originalFrameOfMovedKeyframe, action.redoData.isInternal ? true : false);

            // 2. If a keyframe at the target will be overwritten, ensure it's cleared for the add operation to correctly place the new one.
            if (dataThatWillBeOverwritten) {
                this.timeline.deletePinKeyframe(pinIndex, targetFrameForKeyframe, action.redoData.isInternal ? true : false);
            }
            
            // 3. Add the keyframe to its new target position
            this.timeline.addPinKeyframe(pinIndex, targetFrameForKeyframe, movedData.state, movedData.easing, action.redoData.isInternal ? true : false);
            return true;
        } else {
            console.error("Redo data missing or malformed for timeline action: movePinKeyframe", action);
            return false;
        }
      case 'setMasterKeyframeEasing': // Changed from 'setEasing'
        if (action.redoData && action.redoData.frameNumber !== undefined && action.redoData.easingType !== undefined) {
            this.timeline.setEasingType(action.redoData.frameNumber, action.redoData.easingType, true);
            return true;
        } else {
            console.error("Undo data missing for timeline action: setMasterKeyframeEasing", action);
            return false;
        }
      case 'setPinKeyframeEasing':
        if (action.redoData && action.redoData.frameNumber !== undefined && action.redoData.pinIndex !== undefined && action.redoData.easingType !== undefined) {
            this.timeline.setEasingType(action.redoData.frameNumber, action.redoData.easingType, true);
            this.timeline.activeEditingTrack = null; // Reset context
            return true;
        } else {
            console.error("Redo data missing for timeline action: setPinKeyframeEasing", action);
            return false;
        }
    }
    return false;
  }
  
  resizeCanvases() {
    const viewport = document.querySelector('.viewport');
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    
    this.spriteCanvas.width = width;
    this.spriteCanvas.height = height;
    this.pinCanvas.width = width;
    this.pinCanvas.height = height;
    
    this.puppetTool.resizeCanvases(width, height, this.wireframeVisible, this.pinsVisible, this.zoomLevel);
  }
  
  async loadSampleSprite() { 
    const img = new Image();
    img.onload = async () => { 
      this.uploadedImageOriginalData = img;
      const scaledForPuppetSample = this.scaleImageToResolution(img, this.puppetWorkingResolution); // This is sync

      this.basePuppetImage = scaledForPuppetSample;
      await this.puppetTool.loadSprite(scaledForPuppetSample, img, false); // Added await
      
      this.pixelEditor.loadFromImage(img); // Pixel editor gets the original sample
      this.setStatus('Sample sprite loaded in both puppet tool and pixel editor.');
      this.timeline.updatePuppetToolState(); 
    };
    img.src = this.createSamplePixelArt();
  }
  
  createSamplePixelArt() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = 'transparent';
    ctx.fillRect(0, 0, 32, 32);
    
    ctx.fillStyle = '#8BC34A';
    ctx.fillRect(8, 12, 16, 16);
    
    ctx.fillStyle = '#FFF';
    ctx.fillRect(12, 16, 2, 2);
    ctx.fillRect(18, 16, 2, 2);
    
    ctx.fillStyle = '#F44336';
    ctx.fillRect(14, 22, 4, 2);
    
    ctx.fillStyle = '#8BC34A';
    ctx.fillRect(4, 18, 4, 2);
    ctx.fillRect(24, 18, 4, 2);
    
    ctx.fillRect(10, 28, 2, 4);
    ctx.fillRect(20, 28, 2, 4);
    
    return canvas.toDataURL();
  }
  
  async loadUserImage(file) { 
    const reader = new FileReader();
    reader.onload = async (e_reader) => { 
      const img = new Image();
      img.onload = async () => { 
        this.uploadedImageOriginalData = img;
        const scaledForPuppet = this.scaleImageToResolution(img, this.puppetWorkingResolution); // This is sync

        this.basePuppetImage = scaledForPuppet;
        await this.puppetTool.loadSprite(scaledForPuppet, img, false); // Added await
        
        this.pixelEditor.loadFromImage(img); // Pixel editor gets the original uploaded image
        this.setStatus('Base Image loaded in both puppet tool and pixel editor.');
        this.timeline.updatePuppetToolState(); 
      };
      img.src = e_reader.target.result;
    };
    reader.readAsDataURL(file);
  }
  
  async loadUserSpritesheet(file) { 
    const reader = new FileReader();
    reader.onload = async (e_reader) => { 
      const img = new Image();
      img.onload = async () => { 
        const frameCount = parseInt(prompt('How many frames are in this spritesheet?', '4'));
        
        if (!frameCount || isNaN(frameCount) || frameCount <= 0) {
          this.setStatus('Invalid frame count. Please try again.');
          return;
        }
        
        const frameWidth = img.width / frameCount;
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = frameWidth;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.drawImage(
          img,
          0, 0, frameWidth, img.height,
          0, 0, frameWidth, img.height
        );
        
        const firstFrameImage = new Image();
        firstFrameImage.onload = async () => { 
            this.uploadedImageOriginalData = firstFrameImage;
            const scaledForPuppetSample = this.scaleImageToResolution(firstFrameImage, this.puppetWorkingResolution); // Sync
            
            this.basePuppetImage = scaledForPuppetSample;
            await this.puppetTool.loadSprite(scaledForPuppetSample, firstFrameImage, false); // Added await
            this.setStatus('First frame loaded to puppet tool. Spritesheet loaded to pixel editor.');
            this.timeline.updatePuppetToolState();
        }
        firstFrameImage.src = tempCanvas.toDataURL();
        
        this.pixelEditor.loadFromSpritesheet(img, frameCount);
        // Status message for spritesheet load to pixel editor can be set here or inside pixelEditor.
      };
      img.src = e_reader.target.result;
    };
    reader.readAsDataURL(file);
  }

  async loadUserSpritesheetToKeyImages(file, frameWidth, frameHeight, frameCount) {
    this.setStatus('Slicing spritesheet for key images...');
    
    const reader = new FileReader();
    reader.onload = async (e_reader) => {
        const img = new Image();
        img.onload = async () => {
            if (img.width < frameWidth * frameCount || img.height < frameHeight) {
                this.setStatus('Error: Spritesheet dimensions are too small for the specified parameters.');
                return;
            }
            
            // Clear existing key images and reset timeline to frame count
            this.keyImages = [];
            this.timeline.setTotalFrames(frameCount); 
            
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = frameWidth;
            tempCanvas.height = frameHeight;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.imageSmoothingEnabled = false;

            for (let i = 0; i < frameCount; i++) {
                tempCtx.clearRect(0, 0, frameWidth, frameHeight);
                tempCtx.drawImage(
                    img,
                    i * frameWidth, 0, frameWidth, frameHeight, // Source rect
                    0, 0, frameWidth, frameHeight // Destination rect
                );

                const slicedImage = new Image();
                const dataUrl = tempCanvas.toDataURL();
                await new Promise(resolve => {
                    slicedImage.onload = resolve;
                    slicedImage.src = dataUrl;
                });
                
                const keyImageEntry = {
                    id: Date.now() + Math.random().toString(36).substring(2, 9), 
                    name: `${file.name.replace(/\.[^/.]+$/, "")}_frame_${i + 1}`,
                    imageObject: slicedImage,
                    activeFrame: i + 1 // Assign sequentially to timeline frames
                };
                this.keyImages.push(keyImageEntry);
            }
            
            this.renderKeyImagesList();
            this.timeline.updatePuppetToolState(); // Update current frame
            this.timeline.updateTimelineUI(); // Ensure new total frames is drawn
            this.updateExportFrameOptions(); 
            this.setStatus(`Spritesheet sliced into ${frameCount} key images and applied to timeline.`);
        };
        img.onerror = () => {
            this.setStatus(`Error loading spritesheet image: ${file.name}`);
        };
        img.src = e_reader.target.result;
    };
    reader.readAsDataURL(file);
  }
  
  setStatus(message) {
    document.getElementById('status').textContent = message;
  }
  
  zoomIn() {
    this.zoomLevel = Math.min(this.zoomLevel + 0.1, 2); 
    this.resizeCanvases();
    this.updateZoomLevelDisplay();
  }
  
  zoomOut() {
    this.zoomLevel = Math.max(this.zoomLevel - 0.1, 0.1); 
    this.resizeCanvases();
    this.updateZoomLevelDisplay();
  }
  
  updateZoomLevelDisplay() {
    document.getElementById('zoomLevel').textContent = `${Math.round(this.zoomLevel * 100)}%`;
  }

  async generatePuppetGif(resolution, frameCount, delay) {
    if (!this.puppetTool.originalSprite) {
        this.setStatus('No sprite loaded for puppet GIF generation.');
        return;
    }
    this.setStatus('Generating Puppet GIF...');

    const includeBackground = document.getElementById('includeBackgroundToggle').checked;
    
    let userPaletteRGB = [];
    const editorColors = Array.from(this.pixelEditor.usedColors);
    editorColors.forEach(hex => {
        const rgb = this.pixelEditor.hexToRgb(hex);
        if (rgb) userPaletteRGB.push(rgb.r, rgb.g, rgb.b);
    });

    const GIF_MAGENTA_RGB_ARRAY = [255, 0, 255];
    let transparencyRequested = !includeBackground;

    if (transparencyRequested) {
        let magentaPresent = false;
        for (let i = 0; i < userPaletteRGB.length; i += 3) {
            if (userPaletteRGB[i] === GIF_MAGENTA_RGB_ARRAY[0] &&
                userPaletteRGB[i+1] === GIF_MAGENTA_RGB_ARRAY[1] &&
                userPaletteRGB[i+2] === GIF_MAGENTA_RGB_ARRAY[2]) {
                magentaPresent = true;
                break;
            }
        }
        if (!magentaPresent) {
            // Prepend magenta to prioritize it, especially if palette might be truncated
            userPaletteRGB.unshift(...GIF_MAGENTA_RGB_ARRAY);
        }
    }
    
    // Truncate if more than 256 colors (GIF limit)
    const MAX_GIF_COLORS = 256;
    if (userPaletteRGB.length / 3 > MAX_GIF_COLORS) {
        userPaletteRGB = userPaletteRGB.slice(0, MAX_GIF_COLORS * 3);
        // If magenta was critical and got truncated, this is a problem.
        // For now, assume user colors + magenta usually < 256.
        // Re-check and re-add magenta if transparency is on and it got cut.
        if (transparencyRequested) {
            let magentaStillPresent = false;
            for (let i = 0; i < userPaletteRGB.length; i+=3) {
                 if (userPaletteRGB[i] === GIF_MAGENTA_RGB_ARRAY[0] &&
                    userPaletteRGB[i+1] === GIF_MAGENTA_RGB_ARRAY[1] &&
                    userPaletteRGB[i+2] === GIF_MAGENTA_RGB_ARRAY[2]) {
                    magentaStillPresent = true;
                    break;
                }
            }
            if (!magentaStillPresent && userPaletteRGB.length <= (MAX_GIF_COLORS-1)*3) { // Check if there's space to add it back
                 userPaletteRGB.unshift(...GIF_MAGENTA_RGB_ARRAY); // Add it back at the start
                 if (userPaletteRGB.length / 3 > MAX_GIF_COLORS) { // If adding it made it too long again, remove last color
                    userPaletteRGB.splice(MAX_GIF_COLORS*3 -3, 3);
                 }
            } else if (!magentaStillPresent && userPaletteRGB.length > (MAX_GIF_COLORS-1)*3) {
                // No space to add magenta without removing another color, replace last color
                 userPaletteRGB.splice((MAX_GIF_COLORS-1)*3, 3, ...GIF_MAGENTA_RGB_ARRAY);
            }
        }
    }


    const gifOptions = {
        workers: 2,
        quality: 5, // Lower is better for NeuQuant, but we're often bypassing it.
        dither: false, // Disable dithering for sharp pixels
        workerScript: 'gif/dist/gif.worker.js',
        globalPalette: userPaletteRGB.length > 0 ? userPaletteRGB : null,
        transparent: transparencyRequested ? GIF_TRANSPARENCY_KEY_COLOR_NUM : null,
    };

    const gif = new GIF(gifOptions);

    const initialTimelineFrame = this.timeline.currentFrame;
    const wasPlaying = this.timeline.isPlaying;
    if (wasPlaying) this.timeline.stopPlayback();

    const delayPromise = ms => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < frameCount; i++) {
        this.timeline.goToFrame(i + 1);
        await delayPromise(50); // Ensure UI update and puppet tool processes the frame
        const keyColorForFrameRender = transparencyRequested ? GIF_TRANSPARENCY_KEY_COLOR_HEX : null;
        const frameImage = await this.timeline.getPuppetToolFrame(resolution, resolution, keyColorForFrameRender); // Returns HTMLImageElement
        gif.addFrame(frameImage, { delay: delay, copy: true }); // Copy true to keep pixel data
        this.setStatus(`Generating Puppet GIF: Frame ${i + 1}/${frameCount}`);
    }

    gif.on('finished', (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `puppet_animation_${resolution}x${resolution}_${frameCount}frames.gif`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        this.setStatus('Puppet GIF exported successfully!');
        this.timeline.goToFrame(initialTimelineFrame);
        if (wasPlaying) this.timeline.startPlayback();
    });
    
    gif.on('progress', (p) => {
      this.setStatus(`Rendering Puppet GIF: ${Math.round(p * 100)}%`);
    });

    gif.render();
  }

  async generatePixelGif(delay) {
    if (!this.pixelEditor.frames || this.pixelEditor.frames.length === 0) {
        this.setStatus('No frames in Pixel Editor for GIF generation.');
        return;
    }
    this.setStatus('Generating Pixel GIF...');

    const includeBackground = document.getElementById('includeBackgroundToggle').checked;

    let userPaletteRGB = [];
    const editorColors = Array.from(this.pixelEditor.usedColors);
    editorColors.forEach(hex => {
        const rgb = this.pixelEditor.hexToRgb(hex);
        if (rgb) userPaletteRGB.push(rgb.r, rgb.g, rgb.b);
    });
    
    const GIF_MAGENTA_RGB_ARRAY = [255, 0, 255];
    let transparencyRequested = !includeBackground;

    if (transparencyRequested) {
        let magentaPresent = false;
        for (let i = 0; i < userPaletteRGB.length; i += 3) {
            if (userPaletteRGB[i] === GIF_MAGENTA_RGB_ARRAY[0] &&
                userPaletteRGB[i+1] === GIF_MAGENTA_RGB_ARRAY[1] &&
                userPaletteRGB[i+2] === GIF_MAGENTA_RGB_ARRAY[2]) {
                magentaPresent = true;
                break;
            }
        }
        if (!magentaPresent) {
            userPaletteRGB.unshift(...GIF_MAGENTA_RGB_ARRAY);
        }
    }

    const MAX_GIF_COLORS = 256;
    if (userPaletteRGB.length / 3 > MAX_GIF_COLORS) {
        userPaletteRGB = userPaletteRGB.slice(0, MAX_GIF_COLORS * 3);
         if (transparencyRequested) {
            let magentaStillPresent = false;
            for (let i = 0; i < userPaletteRGB.length; i+=3) {
                 if (userPaletteRGB[i] === GIF_MAGENTA_RGB_ARRAY[0] &&
                    userPaletteRGB[i+1] === GIF_MAGENTA_RGB_ARRAY[1] &&
                    userPaletteRGB[i+2] === GIF_MAGENTA_RGB_ARRAY[2]) {
                    magentaStillPresent = true;
                    break;
                }
            }
             if (!magentaStillPresent && userPaletteRGB.length <= (MAX_GIF_COLORS-1)*3) { 
                 userPaletteRGB.unshift(...GIF_MAGENTA_RGB_ARRAY); 
                 if (userPaletteRGB.length / 3 > MAX_GIF_COLORS) { 
                    userPaletteRGB.splice(MAX_GIF_COLORS*3 -3, 3);
                 }
            } else if (!magentaStillPresent && userPaletteRGB.length > (MAX_GIF_COLORS-1)*3) {
                 userPaletteRGB.splice((MAX_GIF_COLORS-1)*3, 3, ...GIF_MAGENTA_RGB_ARRAY);
            }
        }
    }
    
    const gifOptions = {
        workers: 2,
        quality: 5,
        dither: false,
        workerScript: 'gif/dist/gif.worker.js',
        globalPalette: userPaletteRGB.length > 0 ? userPaletteRGB : null,
        transparent: transparencyRequested ? GIF_TRANSPARENCY_KEY_COLOR_NUM : null,
    };
    const gif = new GIF(gifOptions);

    for (let i = 0; i < this.pixelEditor.frames.length; i++) {
        const rawFrameCanvas = await this.pixelEditor.getFrameAsCanvas(i, includeBackground);
        
        let frameToSendToGif = rawFrameCanvas;

        if (!includeBackground) {
            const keyedCanvas = document.createElement('canvas');
            keyedCanvas.width = rawFrameCanvas.width;
            keyedCanvas.height = rawFrameCanvas.height;
            const keyedCtx = keyedCanvas.getContext('2d');
            keyedCtx.imageSmoothingEnabled = false;

            keyedCtx.fillStyle = GIF_TRANSPARENCY_KEY_COLOR_HEX;
            keyedCtx.fillRect(0, 0, keyedCanvas.width, keyedCanvas.height);
            keyedCtx.drawImage(rawFrameCanvas, 0, 0);
            frameToSendToGif = keyedCanvas;
        }
        
        gif.addFrame(frameToSendToGif, { delay: delay });
        this.setStatus(`Generating Pixel GIF: Frame ${i + 1}/${this.pixelEditor.frames.length}`);
    }

    gif.on('finished', (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'pixel_animation.gif';
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        this.setStatus('Pixel GIF exported successfully!');
    });

    gif.on('progress', (p) => {
      this.setStatus(`Rendering Pixel GIF: ${Math.round(p * 100)}%`);
    });
    
    gif.render();
  }

  setupSaveLoadModals() {
    const saveProjectBtn = document.getElementById('saveProjectBtn');
    const loadProjectBtn = document.getElementById('loadProjectBtn');

    const saveModal = document.getElementById('saveProjectModal');
    const closeSaveModalBtn = saveModal.querySelector('.close-save-modal');
    const confirmSaveBtn = document.getElementById('confirmSaveProject');
    const saveNameInput = document.getElementById('saveProjectName');

    const loadModal = document.getElementById('loadProjectModal');
    const closeLoadModalBtn = loadModal.querySelector('.close-load-modal');
    const localSavesListDiv = document.getElementById('localSavesList');
    const importFileElem = document.getElementById('importProjectFile');
    const confirmLoadFileBtn = document.getElementById('confirmLoadProjectFile');

    if (!saveProjectBtn || !loadProjectBtn || !saveModal || !closeSaveModalBtn || !confirmSaveBtn || !saveNameInput ||
        !loadModal || !closeLoadModalBtn || !localSavesListDiv || !importFileElem || !confirmLoadFileBtn) {
        console.warn('Save/Load UI elements missing.');
        return;
    }
    
    // Save Project Logic
    saveProjectBtn.addEventListener('click', () => {
        saveNameInput.value = `project-${new Date().toISOString().slice(0,10)}`; // Default name
        saveModal.style.display = 'block';
    });
    closeSaveModalBtn.addEventListener('click', () => saveModal.style.display = 'none');
    confirmSaveBtn.addEventListener('click', async () => {
        const name = saveNameInput.value.trim();
        if (!name) {
            this.setStatus('Please enter a name for the save.');
            return;
        }
        const projectData = await this.saveManager.serializeProjectState();
        if (this.saveManager.saveProjectLocally(name, projectData)) {
            this.setStatus(`Project "${name}" saved locally.`);
            saveModal.style.display = 'none';
            this.renderLocalSavesList(localSavesListDiv); // Update list if load modal is open
        }
    });

    // Load Project Logic
    loadProjectBtn.addEventListener('click', () => {
        this.renderLocalSavesList(localSavesListDiv);
        importFileElem.value = ''; // Clear file input
        loadModal.style.display = 'block';
    });
    closeLoadModalBtn.addEventListener('click', () => loadModal.style.display = 'none');

    confirmLoadFileBtn.addEventListener('click', async () => {
        const file = importFileElem.files[0];
        if (!file) {
            this.setStatus('Please select a project JSON file to load.');
            return;
        }
        try {
            const projectData = await this.saveManager.importProjectFromJson(file);
            if (await this.saveManager.deserializeAndLoadProjectState(projectData)) {
                loadModal.style.display = 'none';
            }
        } catch (error) {
            this.setStatus('Failed to load project from file.');
            console.error("Error loading project from file:", error);
        }
    });
    
    // REMOVED: Listener to close modals when clicking outside
    /*
    window.addEventListener('click', (e) => {
      if (e.target === saveModal) saveModal.style.display = 'none';
      if (e.target === loadModal) loadModal.style.display = 'none';
    });
    */
  }

  renderLocalSavesList(containerDiv) {
    containerDiv.innerHTML = '';
    const saves = this.saveManager.getAllLocalSaveNames();

    if (saves.length === 0) {
        containerDiv.innerHTML = '<p>No projects saved in browser storage yet.</p>';
        return;
    }

    saves.forEach(name => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'local-save-item';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        itemDiv.appendChild(nameSpan);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'actions';

        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'Load';
        loadBtn.className = 'load-btn';
        loadBtn.addEventListener('click', async () => {
            const projectData = this.saveManager.loadProjectFromLocal(name);
            if (projectData) {
                if (await this.saveManager.deserializeAndLoadProjectState(projectData)) {
                    document.getElementById('loadProjectModal').style.display = 'none';
                }
            } else {
                this.setStatus(`Could not load project "${name}".`);
            }
        });
        actionsDiv.appendChild(loadBtn);

        const downloadBtn = document.createElement('button');
        downloadBtn.textContent = 'Download';
        downloadBtn.className = 'download-btn';
        downloadBtn.addEventListener('click', () => {
            const projectData = this.saveManager.loadProjectFromLocal(name);
            if (projectData) {
                this.saveManager.exportProjectAsJson(projectData, `${name}.json`);
            }
        });
        actionsDiv.appendChild(downloadBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'delete-btn';
        deleteBtn.addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete the local save "${name}"?`)) {
                if (this.saveManager.deleteLocalSave(name)) {
                    this.renderLocalSavesList(containerDiv); // Re-render the list
                }
            }
        });
        actionsDiv.appendChild(deleteBtn);
        itemDiv.appendChild(actionsDiv);

        containerDiv.appendChild(itemDiv);
    });
  }

}

document.addEventListener('DOMContentLoaded', () => {
  try {
    window.app = new PixelPuppetApp();
  } catch (error) {
    console.error('Failed to initialize PixelPuppetApp:', error);
  }
});