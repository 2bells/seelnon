export default class SaveManager {
  constructor(app) {
    this.app = app;
    this.localStorageKey = 'pixelPuppetProjects';
  }

  async serializeProjectState() {
    const projectData = {
      version: 1,
      timestamp: new Date().toISOString(),
      puppetWorkingResolution: this.app.puppetWorkingResolution,
      totalFrames: this.app.timeline.getFrameCount(),
      pins: this.app.puppetTool.getPinStates(),
      masterKeyframes: this.app.timeline.keyframes,
      masterEasingTypes: this.app.timeline.easingTypes,
      pinKeyframes: this.app.timeline.pinKeyframes,
      keyImages: [],
      // pixelEditorData: this.app.pixelEditor.exportProjectData(), // If pixel editor had its own full export
    };

    // Serialize base sprite
    if (this.app.uploadedImageOriginalData) {
      projectData.spriteBase64 = await this.imageToDataURL(this.app.uploadedImageOriginalData);
    } else {
      projectData.spriteBase64 = null;
    }

    // Serialize key images
    for (const ki of this.app.keyImages) {
      if (ki.imageObject) {
        projectData.keyImages.push({
          id: ki.id,
          name: ki.name,
          activeFrame: ki.activeFrame,
          base64: await this.imageToDataURL(ki.imageObject),
        });
      }
    }
    return projectData;
  }

  async deserializeAndLoadProjectState(projectData) {
    if (!projectData || projectData.version !== 1) {
      this.app.setStatus('Error: Invalid or unsupported project file format.');
      console.error('Invalid project data:', projectData);
      return false;
    }

    this.app.setStatus('Loading project...');
    this.app.historyStack = []; // Clear history for new project
    this.app.historyIndex = -1;

    // 1. Restore Puppet Resolution
    this.app.puppetWorkingResolution = projectData.puppetWorkingResolution || 64;
    const puppetResSelect = document.getElementById('puppetResolutionSelect');
    if (puppetResSelect) puppetResSelect.value = this.app.puppetWorkingResolution;


    // 2. Load Base Sprite
    if (projectData.spriteBase64) {
      try {
        const mainImage = await this.dataURLToImage(projectData.spriteBase64);
        this.app.uploadedImageOriginalData = mainImage;
        this.app.basePuppetImage = this.app.scaleImageToResolution(mainImage, this.app.puppetWorkingResolution);
        
        await this.app.puppetTool.loadSprite(this.app.basePuppetImage, mainImage, false);
        
        // Load into PixelEditor
        this.app.pixelEditor.loadFromImage(mainImage);

      } catch (error) {
        this.app.setStatus('Error loading main sprite from project.');
        console.error('Error loading main sprite:', error);
      }
    } else {
      this.app.uploadedImageOriginalData = null;
      this.app.basePuppetImage = null;
      await this.app.puppetTool.loadSprite(null, null, false); // Clear puppet tool
      this.app.pixelEditor.createNewSprite(32,32); 
    }

    // 3. Restore Pins (after sprite is loaded and scaled)
    // loadSprite already sets default pins if preservePins is false.
    // Now we set the actual saved pins.
    if (projectData.pins) {
      await this.app.puppetTool.setPinStates(projectData.pins, true); // true for isInternal/skip history
    }

    // 4. Restore Timeline settings
    this.app.timeline.setTotalFrames(projectData.totalFrames || 16); // This updates UI
    this.app.timeline.keyframes = projectData.masterKeyframes || {};
    this.app.timeline.easingTypes = projectData.masterEasingTypes || {};
    this.app.timeline.pinKeyframes = projectData.pinKeyframes || {};
    
    // 5. Restore Key Images
    this.app.keyImages = [];
    if (projectData.keyImages && projectData.keyImages.length > 0) {
      for (const kiData of projectData.keyImages) {
        try {
          const img = await this.dataURLToImage(kiData.base64);
          this.app.keyImages.push({
            id: kiData.id,
            name: kiData.name,
            activeFrame: kiData.activeFrame,
            imageObject: img,
          });
        } catch (error) {
          console.error(`Error loading key image ${kiData.name}:`, error);
        }
      }
    }
    this.app.renderKeyImagesList(); // Update key images UI

    // 6. Final UI updates and refresh state
    // Ensure puppet tool's display reflects the loaded state
    if (this.app.puppetTool.originalSprite) {
        this.app.puppetTool.drawSprite();
        this.app.puppetTool.drawPins();
    } else { // If no sprite was loaded (e.g. projectData.spriteBase64 was null)
        this.app.puppetTool.spriteCtx.clearRect(0, 0, this.app.puppetTool.spriteCanvas.width, this.app.puppetTool.spriteCanvas.height);
        this.app.puppetTool.pinCtx.clearRect(0, 0, this.app.puppetTool.pinCanvas.width, this.app.puppetTool.pinCanvas.height);
    }


    // Go to frame 1 and update everything related to timeline state
    this.app.timeline.currentFrame = 1; 
    this.app.timeline.goToFrame(1); // This calls updateTimelineUI, updatePuppetToolState, etc.
    
    this.app.updateExportFrameOptions(); // Update export options based on new totalFrames
    
    this.app.setStatus('Project loaded successfully!');
    return true;
  }

  imageToDataURL(imageElement) {
    return new Promise((resolve, reject) => {
      if (!imageElement || (!imageElement.src && !(imageElement instanceof HTMLCanvasElement))) {
        reject(new Error("Invalid image element for imageToDataURL"));
        return;
      }
      
      // If it's an image and its src is already a data URL and it's loaded
      if (imageElement instanceof HTMLImageElement && imageElement.src && imageElement.src.startsWith('data:image') && imageElement.complete && imageElement.naturalWidth > 0) {
         resolve(imageElement.src);
         return;
      }

      // For all other cases (including canvas, or image not yet loaded/not dataURL), draw to a new canvas
      const canvas = document.createElement('canvas');
      canvas.width = imageElement.naturalWidth || imageElement.width;
      canvas.height = imageElement.naturalHeight || imageElement.height;
      
      if (canvas.width === 0 || canvas.height === 0) {
          // Handle case where image might not be loaded yet if it's an HTMLImageElement without a data URL src
          if (imageElement instanceof HTMLImageElement && !imageElement.complete) {
              imageElement.onload = () => {
                  canvas.width = imageElement.naturalWidth;
                  canvas.height = imageElement.naturalHeight;
                  const ctx = canvas.getContext('2d');
                  ctx.drawImage(imageElement, 0, 0);
                  resolve(canvas.toDataURL('image/png'));
              };
              imageElement.onerror = (e) => reject(new Error("Image failed to load in imageToDataURL: " + e));
              // If src isn't set or something else, this onload might never fire.
              // This path should ideally be hit if imageElement.complete is false.
              return; 
          } else if (imageElement instanceof HTMLImageElement && (imageElement.naturalWidth === 0 || imageElement.naturalHeight === 0)){
               reject(new Error("Image has zero dimensions in imageToDataURL."));
               return;
          }
      }

      const ctx = canvas.getContext('2d');
      try {
          ctx.drawImage(imageElement, 0, 0);
          resolve(canvas.toDataURL('image/png'));
      } catch (error) {
          console.error("Error converting image to Data URL:", error, imageElement);
          reject(error);
      }
    });
  }

  dataURLToImage(dataURL) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = dataURL;
    });
  }

  // --- Local Storage Functions ---
  saveProjectLocally(name, projectData) {
    try {
      const localSaves = this.getAllLocalSavesObject();
      localSaves[name] = projectData;
      localStorage.setItem(this.localStorageKey, JSON.stringify(localSaves));
      this.app.setStatus(`Project "${name}" saved locally.`);
      return true;
    } catch (error) {
      console.error('Error saving project locally:', error);
      this.app.setStatus('Error: Could not save project locally. Storage might be full.');
      return false;
    }
  }

  loadProjectFromLocal(name) {
    const localSaves = this.getAllLocalSavesObject();
    return localSaves[name] || null;
  }

  getAllLocalSavesObject() {
    try {
      const rawData = localStorage.getItem(this.localStorageKey);
      return rawData ? JSON.parse(rawData) : {};
    } catch (error) {
      console.error('Error reading local saves:', error);
      return {};
    }
  }
  
  getAllLocalSaveNames() {
    return Object.keys(this.getAllLocalSavesObject());
  }

  deleteLocalSave(name) {
    const localSaves = this.getAllLocalSavesObject();
    if (localSaves[name]) {
      delete localSaves[name];
      localStorage.setItem(this.localStorageKey, JSON.stringify(localSaves));
      this.app.setStatus(`Local save "${name}" deleted.`);
      return true;
    }
    return false;
  }

  // --- JSON File Functions ---
  exportProjectAsJson(projectData, fileName = 'pixel-puppet-project.json') {
    const jsonString = JSON.stringify(projectData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.app.setStatus(`Project exported as ${fileName}.`);
  }

  importProjectFromJson(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('No file provided for import.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const projectData = JSON.parse(event.target.result);
          resolve(projectData);
        } catch (error) {
          this.app.setStatus('Error: Invalid JSON file.');
          console.error('Error parsing project JSON:', error);
          reject(error);
        }
      };
      reader.onerror = (error) => {
        this.app.setStatus('Error reading file.');
        console.error('Error reading project file:', error);
        reject(error);
      };
      reader.readAsText(file);
    });
  }
}