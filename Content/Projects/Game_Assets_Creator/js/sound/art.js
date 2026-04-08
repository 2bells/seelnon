export class SoundArtVisualizer {
  constructor(generator, soundGenerator, effectProcessors) {
    this.generator = generator;
    this.soundGenerator = soundGenerator;
    this.effectProcessors = effectProcessors;
    this.activeSprite = null;
    this.activePalette = null;
    this.activeSpriteId = null;
    this.activePaletteId = null;
    this.selectedSpriteSize = "32";
    this.selectedPaletteSize = "8";
    this.canvas = null;
    this.ctx = null;
    this.paletteCanvas = null; 
    this.paletteCtx = null;    
    this.pixelToEffectMapping = {
      brightness: 'frequency',
      saturation: 'bitDepth',
      hue: 'sampleRate', 
      edges: 'dryWet'
    };
    this.currentPixelData = null;
    this.isPlaying = false;
    this.playheadPosition = 0;
    this.animationFrame = null;
    this.warmColdValue = 0.5; 
    this.dryWetValue = 0.5;   
    // Palette playthrough state
    this.isPalettePlaying = false;
    this.palettePlayheadIndex = 0;
    this.paletteBeatInterval = null;
    this.paletteTempo = 240; // BPM for palette playthrough
    // Update the sound filters when the sliders change
    this.updateSoundFilters();
    this.fineTuner = null;
  }

  createUI(container) {
    const visualizerContainer = document.createElement('div');
    visualizerContainer.className = 'sound-art-visualizer';
    
    const title = document.createElement('h3');
    title.textContent = 'Sound Visualization';
    visualizerContainer.appendChild(title);
    
    const spritePreview = document.createElement('div');
    spritePreview.className = 'sound-sprite-preview-container';
    
    this.paletteCanvas = document.createElement('canvas');
    this.paletteCanvas.className = 'sound-palette-canvas';
    this.paletteCanvas.width = 256;
    this.paletteCanvas.height = 256;
    this.paletteCanvas.style.display = 'none'; 
    this.paletteCtx = this.paletteCanvas.getContext('2d');
    
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'sound-sprite-canvas';
    this.canvas.width = 256;
    this.canvas.height = 256;
    this.canvas.style.imageRendering = 'pixelated'; 
    this.ctx = this.canvas.getContext('2d', { alpha: true });
    this.ctx.imageSmoothingEnabled = false; 
    
    spritePreview.appendChild(this.canvas);
    visualizerContainer.appendChild(spritePreview);
    
    const mappingControls = document.createElement('div');
    mappingControls.className = 'sound-mapping-controls';
    
    const mappingTitle = document.createElement('h4');
    mappingTitle.textContent = 'Pixel to Sound Mapping';
    mappingControls.appendChild(mappingTitle);
    
    const mappingTypes = [
      { name: 'brightness', label: 'Brightness' },
      { name: 'saturation', label: 'Saturation' },
      { name: 'hue', label: 'Hue' },
      { name: 'edges', label: 'Edges' }
    ];
    
    const effectTypes = [
      { name: 'frequency', label: 'Frequency' },
      { name: 'bitDepth', label: 'Bit Depth' },
      { name: 'sampleRate', label: 'Sample Rate' },
      { name: 'distAmount', label: 'Distortion Amount' },
      { name: 'distAlgorithm', label: 'Distortion Algorithm' },
      { name: 'warmCold', label: 'Warm/Cold' },
      { name: 'dryWet', label: 'Dry/Wet' },
      { name: 'none', label: 'None' }
    ];
    
    mappingTypes.forEach(type => {
      const mappingRow = document.createElement('div');
      mappingRow.className = 'sound-mapping-row';
      
      const mappingLabel = document.createElement('span');
      mappingLabel.textContent = `${type.label} → `;
      mappingRow.appendChild(mappingLabel);
      
      const mappingSelect = document.createElement('select');
      mappingSelect.id = `map-${type.name}`;
      mappingSelect.className = 'sound-mapping-select';
      
      effectTypes.forEach(effect => {
        const option = document.createElement('option');
        option.value = effect.name;
        option.textContent = effect.label;
        if (this.pixelToEffectMapping[type.name] === effect.name) {
          option.selected = true;
        }
        mappingSelect.appendChild(option);
      });
      
      mappingSelect.addEventListener('change', (e) => {
        this.updatePixelToEffectMapping(type.name, e.target.value);
      });
      
      mappingRow.appendChild(mappingSelect);
      mappingControls.appendChild(mappingRow);
    });
    
    visualizerContainer.appendChild(mappingControls);
    
    const playControls = document.createElement('div');
    playControls.className = 'sound-play-controls';
    
    const playButton = document.createElement('button');
    playButton.className = 'sound-play-sprite-btn';
    playButton.textContent = 'Play Sprite';
    playButton.id = 'play-sprite-btn';
    
    playButton.addEventListener('click', () => {
      if (this.isPlaying) {
        this.stopPlaythrough();
      } else {
        this.startPlaythrough();
      }
    });
    
    const playPaletteButton = document.createElement('button');
    playPaletteButton.className = 'sound-play-palette-btn';
    playPaletteButton.textContent = 'Play Palette';
    playPaletteButton.id = 'play-palette-btn';
    
    playPaletteButton.addEventListener('click', () => {
      if (this.isPalettePlaying) {
        this.stopPalettePlaythrough();
      } else {
        this.startPalettePlaythrough();
      }
    });
    
    // Tempo control for palette playthrough
    const tempoControl = document.createElement('div');
    tempoControl.className = 'sound-control-slider palette-tempo-control';
    
    const tempoLabel = document.createElement('label');
    tempoLabel.textContent = 'Tempo:';
    tempoLabel.htmlFor = 'palette-tempo-slider';
    tempoControl.appendChild(tempoLabel);
    
    const tempoValue = document.createElement('span');
    tempoValue.id = 'palette-tempo-value';
    tempoValue.textContent = `${this.paletteTempo} BPM`;
    tempoControl.appendChild(tempoValue);
    
    const tempoSlider = document.createElement('input');
    tempoSlider.type = 'range';
    tempoSlider.min = '60';
    tempoSlider.max = '480';
    tempoSlider.value = this.paletteTempo;
    tempoSlider.id = 'palette-tempo-slider';
    tempoControl.appendChild(tempoSlider);
    
    tempoSlider.addEventListener('input', (e) => {
      this.paletteTempo = parseInt(e.target.value);
      tempoValue.textContent = `${this.paletteTempo} BPM`;
      
      // Update interval if currently playing
      if (this.isPalettePlaying) {
        this.stopPalettePlaythrough();
        this.startPalettePlaythrough();
      }
    });
    
    playControls.appendChild(playButton);
    playControls.appendChild(playPaletteButton);
    playControls.appendChild(tempoControl);
    visualizerContainer.appendChild(playControls);
    
    if (container) {
      container.appendChild(visualizerContainer);
    }
    
    import('./finetune.js').then(module => {
      const FineTuner = module.SoundFineTuner;
      this.fineTuner = new FineTuner(this);
      this.fineTuner.createUI();
    });
    
    return visualizerContainer;
  }
  
  updateSoundFilters() {
    if (this.effectProcessors.vibe) {
      this.effectProcessors.vibe.setWarmCold(this.warmColdValue);
      this.effectProcessors.vibe.setDryWet(this.dryWetValue);
    }
  }
  
  setActiveSprite(id, size) {
    this.activeSpriteId = id;
    this.selectedSpriteSize = size;
    
    const spriteData = this.generator.spriteStorage.getSprite(id, size);
    if (spriteData) {
      this.activeSprite = new Image();
      this.activeSprite.crossOrigin = 'anonymous'; 
      this.activeSprite.onload = () => {
        this.drawSprite();
        this.analyzeSprite();
      };
      this.activeSprite.src = spriteData;
    }
  }
  
  setActivePalette(id, size) {
    this.activePaletteId = id;
    this.selectedPaletteSize = size;
    
    const paletteData = this.generator.paletteStorage.getPalette(id, size);
    if (paletteData) {
      this.activePalette = paletteData;
      this.renderPaletteBackground();
      if (this.activeSprite) {
        this.drawSprite();
      }
    }
  }
  
  renderPaletteBackground() {
    if (!this.paletteCtx || !this.activePalette) return;
    
    const palette = this.activePalette;
    const width = this.paletteCanvas.width;
    const height = this.paletteCanvas.height;
    
    this.paletteCtx.clearRect(0, 0, width, height);
    
    // For palette playthrough visualization, render as stripes
    if (this.isPalettePlaying) {
      const colorHeight = height / palette.length;
      for (let i = 0; i < palette.length; i++) {
        const color = palette[i];
        this.paletteCtx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        
        // Highlight current color
        if (i === this.palettePlayheadIndex) {
          this.paletteCtx.fillStyle = `rgb(${Math.min(255, color[0] + 50)}, ${Math.min(255, color[1] + 50)}, ${Math.min(255, color[2] + 50)})`;
        }
        
        this.paletteCtx.fillRect(0, i * colorHeight, width, colorHeight);
      }
    } else {
      // Original pattern rendering when not in palette playthrough mode
      const tileSize = Math.max(16, Math.floor(width / palette.length));
      const rows = Math.ceil(height / tileSize);
      const cols = Math.ceil(width / tileSize);
      
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const colorIndex = (x + y) % palette.length;
          const color = palette[colorIndex];
          
          this.paletteCtx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
          this.paletteCtx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }
      }
    }
  }
  
  drawSprite() {
    if (!this.ctx) return;
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (this.paletteCanvas) {
      this.ctx.drawImage(this.paletteCanvas, 0, 0, this.canvas.width, this.canvas.height);
    }
    
    if (this.activeSprite) {
      this.ctx.drawImage(this.activeSprite, 0, 0, this.canvas.width, this.canvas.height);
    }
    
    if (this.isPlaying) {
      this.drawPlayhead();
    }
  }
  
  drawPlayhead() {
    if (!this.ctx) return;
    
    const x = Math.floor(this.playheadPosition * this.canvas.width);
    
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.7)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x, 0);
    this.ctx.lineTo(x, this.canvas.height);
    this.ctx.stroke();
    
    this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
    this.ctx.strokeRect(x - 4, 0, 8, this.canvas.height);
    this.ctx.restore();
  }
  
  analyzeSprite() {
    if (!this.ctx || !this.activeSprite) return;
    
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    this.currentPixelData = imageData;
    
    this.playheadPosition = 0;
    this.updateSoundFromCurrentPixel();
  }
  
  updateSoundFromCurrentPixel() {
    if (!this.currentPixelData) return;
    
    const x = Math.floor(this.playheadPosition * this.canvas.width);
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    const imageData = this.ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    let totalBrightness = 0;
    let totalSaturation = 0;
    let totalHue = 0;
    let pixelCount = 0;
    let edges = 0;
    
    // We read the entire column to include background palette colors
    for (let y = 0; y < height; y++) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const a = data[index + 3];
      
      // Only consider visible pixels
      if (a > 0) { 
        pixelCount++;
        
        const brightness = (r + g + b) / (3 * 255);
        totalBrightness += brightness;
        
        const max = Math.max(r, g, b) / 255;
        const min = Math.min(r, g, b) / 255;
        const delta = max - min;
        const saturation = max > 0 ? delta / max : 0;
        totalSaturation += saturation;
        
        let hue = 0;
        if (delta > 0) {
          if (max === r / 255) {
            hue = ((g / 255 - b / 255) / delta) % 6;
          } else if (max === g / 255) {
            hue = (b / 255 - r / 255) / delta + 2;
          } else {
            hue = (r / 255 - g / 255) / delta + 4;
          }
          hue /= 6;
          if (hue < 0) hue += 1;
        }
        totalHue += hue;
        
        // Calculate edges - check neighbors for significant color difference
        if (y > 0 && y < height - 1 && x > 0 && x < width - 1) {
          const leftIndex = (y * width + (x - 1)) * 4;
          const rightIndex = (y * width + (x + 1)) * 4;
          const topIndex = ((y - 1) * width + x) * 4;
          const bottomIndex = ((y + 1) * width + x) * 4;
          
          const leftDiff = Math.abs(r - data[leftIndex]) + Math.abs(g - data[leftIndex + 1]) + Math.abs(b - data[leftIndex + 2]);
          const rightDiff = Math.abs(r - data[rightIndex]) + Math.abs(g - data[rightIndex + 1]) + Math.abs(b - data[rightIndex + 2]);
          const topDiff = Math.abs(r - data[topIndex]) + Math.abs(g - data[topIndex + 1]) + Math.abs(b - data[topIndex + 2]);
          const bottomDiff = Math.abs(r - data[bottomIndex]) + Math.abs(g - data[bottomIndex + 1]) + Math.abs(b - data[bottomIndex + 2]);
          
          const totalDiff = leftDiff + rightDiff + topDiff + bottomDiff;
          if (totalDiff > 100) { 
            edges++;
          }
        }
      }
    }
    
    const avgBrightness = pixelCount > 0 ? totalBrightness / pixelCount : 0;
    const avgSaturation = pixelCount > 0 ? totalSaturation / pixelCount : 0;
    const avgHue = pixelCount > 0 ? totalHue / pixelCount : 0;
    const edgeRatio = pixelCount > 0 ? edges / pixelCount : 0;
    
    this.applySoundParameters({
      brightness: avgBrightness,
      saturation: avgSaturation,
      hue: avgHue,
      edges: edgeRatio
    });
  }
  
  applySoundParameters(params) {
    // Use the new fine-tuned mapping approach
    if (this.fineTuner) {
      // Frequency parameter (support direct or fine-tuned mapping)
      const freqValue = this.fineTuner.mapValue('brightness', 'frequency', params.brightness) || 
                       this.fineTuner.mapValue('saturation', 'frequency', params.saturation) ||
                       this.fineTuner.mapValue('hue', 'frequency', params.hue) ||
                       this.fineTuner.mapValue('edges', 'frequency', params.edges);
      
      if (freqValue !== null) {
        document.getElementById('freq-slider').value = freqValue;
        document.getElementById('freq-value').textContent = `${Math.round(freqValue)} Hz`;
      }
      
      // BitCrusher's bit depth parameter
      const bitDepthValue = this.fineTuner.mapValue('brightness', 'bitDepth', params.brightness) ||
                           this.fineTuner.mapValue('saturation', 'bitDepth', params.saturation) ||
                           this.fineTuner.mapValue('hue', 'bitDepth', params.hue) ||
                           this.fineTuner.mapValue('edges', 'bitDepth', params.edges);
      
      if (bitDepthValue !== null) {
        const bitDepth = Math.round(bitDepthValue);
        document.getElementById('bit-depth-slider').value = bitDepth;
        document.getElementById('bit-depth-value').textContent = bitDepth;
        this.effectProcessors.bitCrusher.setBitDepth(bitDepth);
      }
      
      // BitCrusher's sample rate parameter
      const sampleRateValue = this.fineTuner.mapValue('brightness', 'sampleRate', params.brightness) ||
                             this.fineTuner.mapValue('saturation', 'sampleRate', params.saturation) ||
                             this.fineTuner.mapValue('hue', 'sampleRate', params.hue) ||
                             this.fineTuner.mapValue('edges', 'sampleRate', params.edges);
      
      if (sampleRateValue !== null) {
        document.getElementById('sample-rate-slider').value = sampleRateValue;
        document.getElementById('sample-rate-value').textContent = `${Math.round(sampleRateValue * 100)}%`;
        this.effectProcessors.bitCrusher.setSampleRateReduction(sampleRateValue);
      }
      
      // Distortion amount parameter
      const distAmountValue = this.fineTuner.mapValue('brightness', 'distAmount', params.brightness) ||
                             this.fineTuner.mapValue('saturation', 'distAmount', params.saturation) ||
                             this.fineTuner.mapValue('hue', 'distAmount', params.hue) ||
                             this.fineTuner.mapValue('edges', 'distAmount', params.edges);
      
      if (distAmountValue !== null) {
        const distAmount = Math.round(distAmountValue);
        document.getElementById('distortion-slider').value = distAmount;
        document.getElementById('distortion-value').textContent = distAmount;
        this.effectProcessors.distortion.setAmount(distAmount);
      }
      
      // Distortion algorithm parameter
      const distAlgorithmValue = this.fineTuner.mapValue('brightness', 'distAlgorithm', params.brightness) ||
                                this.fineTuner.mapValue('saturation', 'distAlgorithm', params.saturation) ||
                                this.fineTuner.mapValue('hue', 'distAlgorithm', params.hue) ||
                                this.fineTuner.mapValue('edges', 'distAlgorithm', params.edges);
      
      if (distAlgorithmValue !== null) {
        document.getElementById('distortion-algorithm').value = distAlgorithmValue;
        this.effectProcessors.distortion.setAlgorithm(distAlgorithmValue);
      }
      
      // Vibe warm/cold parameter
      const warmColdValue = this.fineTuner.mapValue('brightness', 'warmCold', params.brightness) ||
                           this.fineTuner.mapValue('saturation', 'warmCold', params.saturation) ||
                           this.fineTuner.mapValue('hue', 'warmCold', params.hue) ||
                           this.fineTuner.mapValue('edges', 'warmCold', params.edges);
      
      if (warmColdValue !== null) {
        document.getElementById('warm-cold-slider').value = warmColdValue;
        document.getElementById('warm-cold-value').textContent = `${Math.round(warmColdValue * 100)}%`;
        this.warmColdValue = warmColdValue;
        this.effectProcessors.vibe.setWarmCold(warmColdValue);
      }
      
      // Vibe dry/wet parameter
      const dryWetValue = this.fineTuner.mapValue('brightness', 'dryWet', params.brightness) ||
                         this.fineTuner.mapValue('saturation', 'dryWet', params.saturation) ||
                         this.fineTuner.mapValue('hue', 'dryWet', params.hue) ||
                         this.fineTuner.mapValue('edges', 'dryWet', params.edges);
      
      if (dryWetValue !== null) {
        document.getElementById('dry-wet-slider').value = dryWetValue;
        document.getElementById('dry-wet-value').textContent = `${Math.round(dryWetValue * 100)}%`;
        this.dryWetValue = dryWetValue;
        this.effectProcessors.vibe.setDryWet(dryWetValue);
      }
    } else {
      for (const [pixelParam, effectName] of Object.entries(this.pixelToEffectMapping)) {
        if (effectName === 'none') continue;
        
        const value = params[pixelParam];
        switch(effectName) {
          case 'frequency':
            const freq = 100 + (value * 1900);
            document.getElementById('freq-slider').value = freq;
            document.getElementById('freq-value').textContent = `${Math.round(freq)} Hz`;
            break;
            
          case 'bitCrush':
            const bitDepth = 1 + Math.round(value * 15);
            document.getElementById('bit-depth-slider').value = bitDepth;
            document.getElementById('bit-depth-value').textContent = bitDepth;
            this.effectProcessors.bitCrusher.setBitDepth(bitDepth);
            
            const sampleRate = 0.1 + (value * 0.9);
            document.getElementById('sample-rate-slider').value = sampleRate;
            document.getElementById('sample-rate-value').textContent = `${Math.round(sampleRate * 100)}%`;
            this.effectProcessors.bitCrusher.setSampleRateReduction(sampleRate);
            break;
            
          case 'distortion':
            const distAmount = 1 + Math.round(value * 99);
            document.getElementById('distortion-slider').value = distAmount;
            document.getElementById('distortion-value').textContent = distAmount;
            this.effectProcessors.distortion.setAmount(distAmount);
            break;
            
          case 'vibe':
            const warmValue = value; // Use the parameter value directly for warm/cold
            const dryWetValue = 0.2 + (value * 0.8); // Map to a range from 0.2 to 1.0
            
            // Update UI sliders
            document.getElementById('warm-cold-slider').value = warmValue;
            document.getElementById('warm-cold-value').textContent = `${Math.round(warmValue * 100)}%`;
            document.getElementById('dry-wet-slider').value = dryWetValue;
            document.getElementById('dry-wet-value').textContent = `${Math.round(dryWetValue * 100)}%`;
            
            // Apply to sound character
            this.warmColdValue = warmValue;
            this.dryWetValue = dryWetValue;
            this.effectProcessors.vibe.setWarmCold(warmValue);
            this.effectProcessors.vibe.setDryWet(dryWetValue);
            break;
        }
      }
    }
  }
  
  updateMappingSettings(ranges) {
    // Apply immediately if we're currently playing
    if (this.isPlaying || this.isPalettePlaying) {
      this.updateSoundFromCurrentPixel();
    }
  }
  
  updatePixelToEffectMapping(pixelParam, effectParam) {
    this.pixelToEffectMapping[pixelParam] = effectParam;
    
    // Update fine tuner if available
    if (this.fineTuner) {
      this.fineTuner.updateFromMappingSelection(pixelParam, effectParam);
    }
    
    // Apply immediately if playing
    if (this.isPlaying || this.isPalettePlaying) {
      this.updateSoundFromCurrentPixel();
    }
  }
  
  startPlaythrough() {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    document.getElementById('play-sprite-btn').textContent = 'Stop';
    
    this.playheadPosition = 0;
    
    this.animatePlayhead();
  }
  
  stopPlaythrough() {
    this.isPlaying = false;
    document.getElementById('play-sprite-btn').textContent = 'Play Sprite';
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    this.drawSprite();
  }
  
  animatePlayhead() {
    if (!this.isPlaying) return;
    
    this.drawSprite();
    
    this.animationFrame = requestAnimationFrame(() => this.animatePlayhead());
  }
  
  updateFromLibrary() {
    if (this.generator.currentAssetId) {
      const size = this.generator.soundSelectedSpriteSize || "32";
      
      this.activeSpriteId = this.generator.currentAssetId;
      this.selectedSpriteSize = size;
      
      this.setActiveSprite(
        this.generator.currentAssetId, 
        size
      );
      
      this.setActivePalette(
        this.generator.currentAssetId,
        this.generator.paletteSize.toString()
      );
    }
  }
  
  startPalettePlaythrough() {
    if (this.isPalettePlaying || !this.activePalette || this.activePalette.length === 0) return;
    
    this.isPalettePlaying = true;
    this.palettePlayheadIndex = 0;
    
    // Update button text
    const playPaletteButton = document.getElementById('play-palette-btn');
    if (playPaletteButton) {
      playPaletteButton.textContent = 'Stop Palette';
    }
    
    // Calculate interval in milliseconds from BPM
    const intervalMs = (60 / this.paletteTempo) * 1000;
    
    // Initial sound for first color
    this.playPaletteColor(this.palettePlayheadIndex);
    
    // Set up the interval for playing through palette colors
    this.paletteBeatInterval = setInterval(() => {
      // Move to the next color
      this.palettePlayheadIndex = (this.palettePlayheadIndex + 1) % this.activePalette.length;
      
      // Play sound based on the current color
      this.playPaletteColor(this.palettePlayheadIndex);
      
      // Update visualization
      this.renderPaletteBackground();
      this.drawSprite();
    }, intervalMs);
  }
  
  stopPalettePlaythrough() {
    this.isPalettePlaying = false;
    
    // Clear the interval
    if (this.paletteBeatInterval) {
      clearInterval(this.paletteBeatInterval);
      this.paletteBeatInterval = null;
    }
    
    // Update button text
    const playPaletteButton = document.getElementById('play-palette-btn');
    if (playPaletteButton) {
      playPaletteButton.textContent = 'Play Palette';
    }
    
    // Redraw the palette background in normal mode
    this.renderPaletteBackground();
    this.drawSprite();
  }
  
  playPaletteColor(colorIndex) {
    if (!this.activePalette || colorIndex >= this.activePalette.length) return;
    
    const color = this.activePalette[colorIndex];
    const [r, g, b] = color;
    
    // Map color components to sound parameters
    const brightness = (r + g + b) / (3 * 255);
    const saturation = Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
    const normalizedSaturation = Math.min(1, saturation / 510);
    const hue = this.rgbToHue(r, g, b);
    
    // Create parameter mapping for this color
    const params = {
      brightness: brightness,
      saturation: normalizedSaturation,
      hue: hue,
      edges: colorIndex / this.activePalette.length // Use position in palette as edge value
    };
    
    // Apply these parameters to sound
    this.applySoundParameters(params);
    
    // Play a short sound with current settings
    this.playCurrentSound(0.1); // Short duration for rhythm
  }
  
  rgbToHue(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    
    if (delta === 0) return 0; // achromatic (gray)
    
    let hue;
    if (max === r) {
      hue = ((g - b) / delta) % 6;
    } else if (max === g) {
      hue = (b - r) / delta + 2;
    } else {
      hue = (r - g) / delta + 4;
    }
    
    hue /= 6; // normalize to 0-1
    if (hue < 0) hue += 1;
    
    return hue;
  }
  
  playCurrentSound(overrideDuration = null) {
    // Stop any currently playing sound
    if (this.activeSound) {
      // No direct way to stop, we'll just let it play out
      this.activeSound = null;
    }
    
    // Get parameters from UI
    const frequency = parseFloat(document.getElementById('freq-slider').value);
    
    // If sprite playthrough is active, use duration to scan through sprite
    const duration = this.isPlaying ? 
                    parseFloat(document.getElementById('duration-slider').value) : 
                    (overrideDuration !== null ? overrideDuration : parseFloat(document.getElementById('duration-slider').value));
    
    // If sprite playthrough is active, start from current playhead position
    if (this.isPlaying) {
      // Save current playhead position for synchronized playback
      const savedPosition = this.playheadPosition;
      
      // Set up animation that will scan through sprite during sound playback
      const startTime = performance.now();
      const animateDuringSoundPlayback = () => {
        const elapsed = (performance.now() - startTime) / 1000; // Convert to seconds
        if (elapsed < duration) {
          // Calculate new position based on elapsed time
          this.playheadPosition = savedPosition + (elapsed / duration) * (1 - savedPosition);
          this.updateSoundFromCurrentPixel();
          this.drawSprite();
          requestAnimationFrame(animateDuringSoundPlayback);
        } else {
          // Reset playhead when sound finishes
          this.playheadPosition = 0;
          this.drawSprite();
        }
      };
      
      // Start the animation
      requestAnimationFrame(animateDuringSoundPlayback);
    }
    
    // Route the sound through the effects chain
    const sourceNode = this.soundGenerator.audioContext.createGain();
    sourceNode.connect(this.effectProcessors.bitCrusher.node);
    
    // Update Vibe settings based on current slider values
    this.effectProcessors.vibe.setWarmCold(this.warmColdValue);
    this.effectProcessors.vibe.setDryWet(this.dryWetValue);
    
    // Generate the sound using the sound generator directly
    const params = { 
      frequency, 
      duration,
      outputNode: sourceNode // Connect to our effects chain
    };
    
    let sound;
    const soundType = document.querySelector('.sound-type-btn.active')?.dataset.type || 'jump';
    
    switch(soundType) {
      case 'jump':
        sound = this.soundGenerator.generateJumpSound(params);
        break;
      case 'attack':
        sound = this.soundGenerator.generateAttackSound(params);
        break;
      case 'collect':
        sound = this.soundGenerator.generateCollectSound(params);
        break;
      case 'damage':
        sound = this.soundGenerator.generateDamageSound(params);
        break;
      case 'power-up':
        sound = this.soundGenerator.generatePowerupSound(params);
        break;
      case 'zap':
        sound = this.soundGenerator.generateZapSound(params);
        break;
      case 'boom':
        sound = this.soundGenerator.generateBoomSound(params);
        break;
      case 'lose':
        sound = this.soundGenerator.generateLoseSound(params);
        break;
      case 'blip':
        sound = this.soundGenerator.generateBlipSound(params);
        break;
      case 'shoot':
        sound = this.soundGenerator.generateShootSound(params);
        break;
      case 'win':
        sound = this.soundGenerator.generateWinSound(params);
        break;
      case 'grab':
        sound = this.soundGenerator.generateGrabSound(params);
        break;
      default:
        sound = this.soundGenerator.generateJumpSound(params);
    }
    
    this.activeSound = sound;
  }
}