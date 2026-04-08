export class ArtTuner {
  constructor(generator) {
    this.generator = generator;
    this.isVisible = false;
    this.container = null;
    this.settings = {
      backgroundRemoval: {
        enabled: true,
        colorOnly: false,
        threshold: 30,
        colorKey: "#000000",
        tolerance: 30
      },
      edgeFinder: {
        enabled: true,
        threshold: 50,
        expandOffset: 2,
        drawMode: false
      }
    };
    this.manualMask = null;
    this.originalImageData = null;
  }

  createUI() {
    const artTuneToggle = document.createElement('div');
    artTuneToggle.className = 'arttune-toggle';
    artTuneToggle.textContent = 'Art Tune';
    artTuneToggle.id = 'arttune-toggle';
    artTuneToggle.style.borderRadius = '0 5px 5px 0';
    artTuneToggle.style.top = '30%';
    document.querySelector('.container').appendChild(artTuneToggle);

    this.container = document.createElement('div');
    this.container.className = 'arttune-panel';
    this.container.id = 'arttune-panel';

    const closeButton = document.createElement('button');
    closeButton.className = 'arttune-close';
    closeButton.innerHTML = '&times;';
    closeButton.id = 'arttune-close';
    this.container.appendChild(closeButton);

    const title = document.createElement('h3');
    title.textContent = 'Art Fine Tuning';
    this.container.appendChild(title);

    const originalSection = document.createElement('div');
    originalSection.className = 'arttune-section';

    const originalTitle = document.createElement('h4');
    originalTitle.textContent = 'Original Image';
    originalSection.appendChild(originalTitle);

    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'arttune-btn';
    restoreBtn.textContent = 'Restore Original';
    restoreBtn.id = 'restore-original-btn';
    originalSection.appendChild(restoreBtn);

    this.container.appendChild(originalSection);

    const bgSection = document.createElement('div');
    bgSection.className = 'arttune-section';

    const bgTitle = document.createElement('h4');
    bgTitle.textContent = 'Background Removal';
    bgSection.appendChild(bgTitle);

    const bgEnableWrapper = document.createElement('div');
    bgEnableWrapper.className = 'arttune-control-row';

    const bgEnableCheck = document.createElement('input');
    bgEnableCheck.type = 'checkbox';
    bgEnableCheck.id = 'bg-removal-enable';
    bgEnableCheck.checked = this.settings.backgroundRemoval.enabled;

    const bgEnableLabel = document.createElement('label');
    bgEnableLabel.htmlFor = 'bg-removal-enable';
    bgEnableLabel.textContent = 'Enable Background Removal';

    bgEnableWrapper.appendChild(bgEnableCheck);
    bgEnableWrapper.appendChild(bgEnableLabel);
    bgSection.appendChild(bgEnableWrapper);

    const colorOnlyWrapper = document.createElement('div');
    colorOnlyWrapper.className = 'arttune-control-row';

    const colorOnlyCheck = document.createElement('input');
    colorOnlyCheck.type = 'checkbox';
    colorOnlyCheck.id = 'color-only-removal';
    colorOnlyCheck.checked = this.settings.backgroundRemoval.colorOnly;

    const colorOnlyLabel = document.createElement('label');
    colorOnlyLabel.htmlFor = 'color-only-removal';
    colorOnlyLabel.textContent = 'Use Color-based Removal Only';

    colorOnlyWrapper.appendChild(colorOnlyCheck);
    colorOnlyWrapper.appendChild(colorOnlyLabel);
    bgSection.appendChild(colorOnlyWrapper);

    const colorKeyWrapper = document.createElement('div');
    colorKeyWrapper.className = 'arttune-control-row';

    const colorKeyLabel = document.createElement('label');
    colorKeyLabel.htmlFor = 'bg-color-key';
    colorKeyLabel.textContent = 'Background Color:';

    const colorKeyInput = document.createElement('input');
    colorKeyInput.type = 'color';
    colorKeyInput.id = 'bg-color-key';
    colorKeyInput.value = this.settings.backgroundRemoval.colorKey;

    colorKeyWrapper.appendChild(colorKeyLabel);
    colorKeyWrapper.appendChild(colorKeyInput);
    bgSection.appendChild(colorKeyWrapper);

    const toleranceWrapper = document.createElement('div');
    toleranceWrapper.className = 'arttune-control-row';

    const toleranceLabel = document.createElement('label');
    toleranceLabel.htmlFor = 'color-tolerance';
    toleranceLabel.textContent = 'Color Tolerance:';

    const toleranceValue = document.createElement('span');
    toleranceValue.id = 'tolerance-value';
    toleranceValue.textContent = this.settings.backgroundRemoval.tolerance;

    const toleranceSlider = document.createElement('input');
    toleranceSlider.type = 'range';
    toleranceSlider.min = '0';
    toleranceSlider.max = '100';
    toleranceSlider.value = this.settings.backgroundRemoval.tolerance;
    toleranceSlider.id = 'color-tolerance';

    toleranceWrapper.appendChild(toleranceLabel);
    toleranceWrapper.appendChild(toleranceValue);
    toleranceWrapper.appendChild(toleranceSlider);
    bgSection.appendChild(toleranceWrapper);

    this.container.appendChild(bgSection);

    const edgeSection = document.createElement('div');
    edgeSection.className = 'arttune-section';

    const edgeTitle = document.createElement('h4');
    edgeTitle.textContent = 'Edge Detection';
    edgeSection.appendChild(edgeTitle);

    const edgeEnableWrapper = document.createElement('div');
    edgeEnableWrapper.className = 'arttune-control-row';

    const edgeEnableCheck = document.createElement('input');
    edgeEnableCheck.type = 'checkbox';
    edgeEnableCheck.id = 'edge-finder-enable';
    edgeEnableCheck.checked = this.settings.edgeFinder.enabled;

    const edgeEnableLabel = document.createElement('label');
    edgeEnableLabel.htmlFor = 'edge-finder-enable';
    edgeEnableLabel.textContent = 'Enable Edge Detection';

    edgeEnableWrapper.appendChild(edgeEnableCheck);
    edgeEnableWrapper.appendChild(edgeEnableLabel);
    edgeSection.appendChild(edgeEnableWrapper);

    const thresholdWrapper = document.createElement('div');
    thresholdWrapper.className = 'arttune-control-row';

    const thresholdLabel = document.createElement('label');
    thresholdLabel.htmlFor = 'edge-threshold';
    thresholdLabel.textContent = 'Edge Threshold:';

    const thresholdValue = document.createElement('span');
    thresholdValue.id = 'threshold-value';
    thresholdValue.textContent = this.settings.edgeFinder.threshold;

    const thresholdSlider = document.createElement('input');
    thresholdSlider.type = 'range';
    thresholdSlider.min = '1';
    thresholdSlider.max = '100';
    thresholdSlider.value = this.settings.edgeFinder.threshold;
    thresholdSlider.id = 'edge-threshold';

    thresholdWrapper.appendChild(thresholdLabel);
    thresholdWrapper.appendChild(thresholdValue);
    thresholdWrapper.appendChild(thresholdSlider);
    edgeSection.appendChild(thresholdWrapper);

    const expansionWrapper = document.createElement('div');
    expansionWrapper.className = 'arttune-control-row';

    const expansionLabel = document.createElement('label');
    expansionLabel.htmlFor = 'edge-expansion';
    expansionLabel.textContent = 'Edge Expansion:';

    const expansionValue = document.createElement('span');
    expansionValue.id = 'expansion-value';
    expansionValue.textContent = this.settings.edgeFinder.expandOffset;

    const expansionSlider = document.createElement('input');
    expansionSlider.type = 'range';
    expansionSlider.min = '-1';
    expansionSlider.max = '10';
    expansionSlider.value = this.settings.edgeFinder.expandOffset;
    expansionSlider.id = 'edge-expansion';

    expansionWrapper.appendChild(expansionLabel);
    expansionWrapper.appendChild(expansionValue);
    expansionWrapper.appendChild(expansionSlider);
    edgeSection.appendChild(expansionWrapper);

    this.container.appendChild(edgeSection);

    const applyButton = document.createElement('button');
    applyButton.className = 'arttune-apply-btn';
    applyButton.textContent = 'Apply Settings';
    applyButton.id = 'arttune-apply-btn';
    this.container.appendChild(applyButton);

    document.querySelector('.container').appendChild(this.container);

    this.bindEvents();
    this.manualMask = null;
  }

  bindEvents() {
    const toggle = document.getElementById('arttune-toggle');
    const closeBtn = document.getElementById('arttune-close');
    const applyBtn = document.getElementById('arttune-apply-btn');
    const restoreBtn = document.getElementById('restore-original-btn');

    toggle.addEventListener('click', () => {
      this.togglePanel(true);
    });

    closeBtn.addEventListener('click', () => {
      this.togglePanel(false);
    });

    applyBtn.addEventListener('click', () => {
      this.applySettings();
    });

    restoreBtn.addEventListener('click', () => {
      this.restoreOriginal();
    });

    const bgEnableCheck = document.getElementById('bg-removal-enable');
    bgEnableCheck.addEventListener('change', (e) => {
      this.settings.backgroundRemoval.enabled = e.target.checked;
    });

    const colorOnlyCheck = document.getElementById('color-only-removal');
    colorOnlyCheck.addEventListener('change', (e) => {
      this.settings.backgroundRemoval.colorOnly = e.target.checked;
    });

    const colorKeyInput = document.getElementById('bg-color-key');
    colorKeyInput.addEventListener('input', (e) => {
      this.settings.backgroundRemoval.colorKey = e.target.value;
    });

    const toleranceSlider = document.getElementById('color-tolerance');
    toleranceSlider.addEventListener('input', (e) => {
      this.settings.backgroundRemoval.tolerance = parseInt(e.target.value);
      document.getElementById('tolerance-value').textContent = e.target.value;
    });

    const edgeEnableCheck = document.getElementById('edge-finder-enable');
    edgeEnableCheck.addEventListener('change', (e) => {
      this.settings.edgeFinder.enabled = e.target.checked;
    });

    const thresholdSlider = document.getElementById('edge-threshold');
    thresholdSlider.addEventListener('input', (e) => {
      this.settings.edgeFinder.threshold = parseInt(e.target.value);
      document.getElementById('threshold-value').textContent = e.target.value;
      this.updateEdgeFinderSettings();
    });

    const expansionSlider = document.getElementById('edge-expansion');
    expansionSlider.addEventListener('input', (e) => {
      this.settings.edgeFinder.expandOffset = parseInt(e.target.value);
      document.getElementById('expansion-value').textContent = e.target.value;
      this.updateEdgeFinderSettings();
    });
  }

  togglePanel(show) {
    this.isVisible = show !== undefined ? show : !this.isVisible;
    const panel = document.getElementById('arttune-panel');
    const toggle = document.getElementById('arttune-toggle');

    if (this.isVisible) {
      panel.classList.add('active');
      toggle.style.left = '300px';
    } else {
      panel.classList.remove('active');
      toggle.style.left = '0';
    }
  }

  applySettings() {
    const editorCanvas = document.getElementById('editor-canvas');
    const editorCtx = editorCanvas.getContext('2d');

    if (!this.originalImageData) {
      this.originalImageData = editorCtx.getImageData(0, 0, editorCanvas.width, editorCanvas.height);
    }

    const imageData = editorCtx.getImageData(0, 0, editorCanvas.width, editorCanvas.height);
    let processedImageData;

    if (this.settings.backgroundRemoval.enabled) {
      if (this.settings.backgroundRemoval.colorOnly) {
        processedImageData = this.removeBackgroundByColor(
          imageData,
          this.settings.backgroundRemoval.colorKey,
          this.settings.backgroundRemoval.tolerance
        );
      } else if (this.settings.edgeFinder.enabled) {
        processedImageData = this.generator.backgroundPlugin.autoRemoveBackground(
          imageData,
          editorCanvas.width,
          editorCanvas.height,
          this.settings
        );
      }
    }

    if (processedImageData) {
      editorCtx.putImageData(processedImageData, 0, 0);
    }
  }

  restoreOriginal() {
    const editorCanvas = document.getElementById('editor-canvas');
    const editorCtx = editorCanvas.getContext('2d');
    
    if (this.generator.currentAssetId && 
        this.generator.spriteStorage.sprites[this.generator.currentAssetId] && 
        this.generator.spriteStorage.sprites[this.generator.currentAssetId]['ORIGINAL']) {
      
      const originalUrl = this.generator.spriteStorage.sprites[this.generator.currentAssetId]['ORIGINAL'];
      const img = new Image();
      img.crossOrigin = 'anonymous'; 
      img.onload = () => {
        editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
        editorCtx.drawImage(img, 0, 0, editorCanvas.width, editorCanvas.height);
        this.originalImageData = editorCtx.getImageData(0, 0, editorCanvas.width, editorCanvas.height);
      };
      img.src = originalUrl;
      return;
    }
    
    const originalImg = document.getElementById('original-img');
    if (originalImg && originalImg.complete && originalImg.src) {
      const img = new Image();
      img.onload = () => {
        editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
        editorCtx.drawImage(img, 0, 0, editorCanvas.width, editorCanvas.height);
        this.originalImageData = editorCtx.getImageData(0, 0, editorCanvas.width, editorCanvas.height);
      };
      img.src = originalImg.src;
    } else if (this.originalImageData) {
      editorCtx.putImageData(this.originalImageData, 0, 0);
    } else if (this.generator.originalImage) {
      this.generator.viewportManager.loadImageToEditor(this.generator.originalImage);
    }
  }

  removeBackgroundByColor(imageData, colorHex, tolerance) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    const r = parseInt(colorHex.substr(1, 2), 16);
    const g = parseInt(colorHex.substr(3, 2), 16);
    const b = parseInt(colorHex.substr(5, 2), 16);

    for (let i = 0; i < data.length; i += 4) {
      const pixelR = data[i];
      const pixelG = data[i + 1];
      const pixelB = data[i + 2];

      const distance = Math.sqrt(
        Math.pow(pixelR - r, 2) +
        Math.pow(pixelG - g, 2) +
        Math.pow(pixelB - b, 2)
      );

      if (distance < tolerance) {
        data[i + 3] = 0;
      }
    }

    return imageData;
  }

  updateEdgeFinderSettings() {
    if (this.generator.backgroundPlugin) {
      this.generator.backgroundPlugin.edgeFinder.threshold = this.settings.edgeFinder.threshold;
      this.generator.backgroundPlugin.expansionOffset = this.settings.edgeFinder.expandOffset;
      
      console.log("Updated edge finder settings:", {
        threshold: this.settings.edgeFinder.threshold,
        expandOffset: this.settings.edgeFinder.expandOffset
      });
    }
  }
}