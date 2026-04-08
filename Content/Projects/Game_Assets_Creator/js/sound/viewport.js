import { SoundGenerator } from './plugin/generate.js';
import { BitCrusher } from './plugin/bitcrush.js';
import { Distortion } from './plugin/distort.js';
import { Vibe } from './plugin/vibe.js';
import { SoundArtVisualizer } from './art.js';
import { SoundFineTuner } from './finetune.js';
import { SoundSequencer } from './sequencer.js';

export class SoundViewport {
  constructor(generator) {
    this.generator = generator;
    this.activeSpriteId = null;
    this.activePaletteId = null;
    this.selectedSpriteSize = "32";
    this.selectedPaletteSize = "8";
    
    // Initialize audio components
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.soundGenerator = new SoundGenerator(this.audioContext);
    this.bitCrusher = new BitCrusher(this.audioContext);
    this.distortion = new Distortion(this.audioContext);
    this.vibe = new Vibe(this.audioContext);
    
    // Setup audio routing
    this.bitCrusher.connect(this.distortion.input());
    this.distortion.connect(this.vibe.input());
    this.vibe.connect(this.soundGenerator.masterGainNode);
    
    this.lastGeneratedSound = null;
    this.activeSound = null;
    this.currentSoundType = 'jump';
    
    // Create the art visualizer
    this.artVisualizer = new SoundArtVisualizer(
      generator,
      this.soundGenerator,
      {
        bitCrusher: this.bitCrusher,
        distortion: this.distortion,
        vibe: this.vibe,
        filter: null,
        reverb: null
      }
    );
    
    // Create sound sequencer
    this.sequencer = new SoundSequencer(
      this.artVisualizer,
      this.soundGenerator,
      {
        bitCrusher: this.bitCrusher,
        distortion: this.distortion,
        vibe: this.vibe
      }
    );
  }

  createUI() {
    const container = document.createElement('div');
    container.className = 'sound-container';
    container.id = 'sound-container';
    container.style.display = 'none';
    
    const title = document.createElement('h1');
    title.textContent = 'Pixel Art Sound Designer';
    container.appendChild(title);
    
    // Back button to return to the pixel art editor
    const backBtn = document.createElement('button');
    backBtn.className = 'back-btn';
    backBtn.textContent = '← Back to Pixel Art';
    backBtn.id = 'back-to-pixel-art';
    container.appendChild(backBtn);
    
    // Split view for sprite and sound controls
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'sound-content-wrapper';
    
    // Left side - sprite preview and art visualizer
    const spriteSection = document.createElement('div');
    spriteSection.className = 'sound-sprite-section';
    
    // Create and add the art visualizer (replaces old sprite preview)
    this.artVisualizer.createUI(spriteSection);
    
    // Replace Library integration button with sprite grid
    const spriteGridSection = document.createElement('div');
    spriteGridSection.className = 'sound-sprite-grid-section';
    
    const gridTitle = document.createElement('h4');
    gridTitle.textContent = 'Select Sprite';
    spriteGridSection.appendChild(gridTitle);
    
    const soundSpriteGrid = document.createElement('div');
    soundSpriteGrid.className = 'sound-sprite-grid';
    soundSpriteGrid.id = 'sound-sprite-grid';
    spriteGridSection.appendChild(soundSpriteGrid);
    
    spriteSection.appendChild(spriteGridSection);
    
    // Right side - sound controls
    const soundSection = document.createElement('div');
    soundSection.className = 'sound-control-section';
    
    const soundTitle = document.createElement('h3');
    soundTitle.textContent = 'Sound Controls';
    soundSection.appendChild(soundTitle);
    
    // Master volume control
    const volumeControl = document.createElement('div');
    volumeControl.className = 'sound-volume-control';
    
    const volumeLabel = document.createElement('label');
    volumeLabel.textContent = 'Volume:';
    volumeLabel.htmlFor = 'volume-slider';
    volumeControl.appendChild(volumeLabel);
    
    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.min = '0';
    volumeSlider.max = '1';
    volumeSlider.step = '0.01';
    volumeSlider.value = '0.5';
    volumeSlider.id = 'volume-slider';
    volumeControl.appendChild(volumeSlider);
    
    soundSection.appendChild(volumeControl);
    
    // Sound generation controls
    const soundControls = document.createElement('div');
    soundControls.className = 'sound-controls';
    
    const soundTypeLabel = document.createElement('div');
    soundTypeLabel.textContent = 'Sound Type:';
    soundControls.appendChild(soundTypeLabel);
    
    const soundTypeButtons = document.createElement('div');
    soundTypeButtons.className = 'sound-type-buttons';
    
    const soundTypes = [
      'Jump', 'Attack', 'Collect', 'Damage', 'Power-up', 
      'Zap', 'Boom', 'Lose', 'Blip', 'Shoot', 'Win', 'Grab'
    ];
    
    soundTypes.forEach(type => {
      const btn = document.createElement('button');
      btn.className = 'sound-type-btn';
      btn.textContent = type;
      btn.dataset.type = type.toLowerCase();
      if (type.toLowerCase() === 'jump') {
        btn.classList.add('active');
      }
      soundTypeButtons.appendChild(btn);
    });
    
    soundControls.appendChild(soundTypeButtons);
    
    // Audio Effects Controls
    const effectsControls = document.createElement('div');
    effectsControls.className = 'sound-effects-controls';
    
    // BitCrusher Controls
    const bitCrusherSection = document.createElement('div');
    bitCrusherSection.className = 'sound-effect-section';
    
    const bitCrusherTitle = document.createElement('h4');
    bitCrusherTitle.textContent = 'Bit Crusher';
    bitCrusherSection.appendChild(bitCrusherTitle);
    
    // Bit depth slider
    const bitDepthControl = document.createElement('div');
    bitDepthControl.className = 'sound-control-slider';
    
    const bitDepthLabel = document.createElement('label');
    bitDepthLabel.textContent = 'Bit Depth:';
    bitDepthLabel.htmlFor = 'bit-depth-slider';
    bitDepthControl.appendChild(bitDepthLabel);
    
    const bitDepthValue = document.createElement('span');
    bitDepthValue.id = 'bit-depth-value';
    bitDepthValue.textContent = '8';
    bitDepthControl.appendChild(bitDepthValue);
    
    const bitDepthSlider = document.createElement('input');
    bitDepthSlider.type = 'range';
    bitDepthSlider.min = '1';
    bitDepthSlider.max = '16';
    bitDepthSlider.value = '8';
    bitDepthSlider.id = 'bit-depth-slider';
    bitDepthControl.appendChild(bitDepthSlider);
    
    bitCrusherSection.appendChild(bitDepthControl);
    
    // Sample rate reduction slider
    const sampleRateControl = document.createElement('div');
    sampleRateControl.className = 'sound-control-slider';
    
    const sampleRateLabel = document.createElement('label');
    sampleRateLabel.textContent = 'Sample Rate:';
    sampleRateLabel.htmlFor = 'sample-rate-slider';
    sampleRateControl.appendChild(sampleRateLabel);
    
    const sampleRateValue = document.createElement('span');
    sampleRateValue.id = 'sample-rate-value';
    sampleRateValue.textContent = '50%';
    sampleRateControl.appendChild(sampleRateValue);
    
    const sampleRateSlider = document.createElement('input');
    sampleRateSlider.type = 'range';
    sampleRateSlider.min = '0.01';
    sampleRateSlider.max = '1';
    sampleRateSlider.step = '0.01';
    sampleRateSlider.value = '0.5';
    sampleRateSlider.id = 'sample-rate-slider';
    sampleRateControl.appendChild(sampleRateSlider);
    
    bitCrusherSection.appendChild(sampleRateControl);
    effectsControls.appendChild(bitCrusherSection);
    
    // Distortion Controls
    const distortionSection = document.createElement('div');
    distortionSection.className = 'sound-effect-section';
    
    const distortionTitle = document.createElement('h4');
    distortionTitle.textContent = 'Distortion';
    distortionSection.appendChild(distortionTitle);
    
    // Distortion amount slider
    const distortionControl = document.createElement('div');
    distortionControl.className = 'sound-control-slider';
    
    const distortionLabel = document.createElement('label');
    distortionLabel.textContent = 'Amount:';
    distortionLabel.htmlFor = 'distortion-slider';
    distortionControl.appendChild(distortionLabel);
    
    const distortionValue = document.createElement('span');
    distortionValue.id = 'distortion-value';
    distortionValue.textContent = '20';
    distortionControl.appendChild(distortionValue);
    
    const distortionSlider = document.createElement('input');
    distortionSlider.type = 'range';
    distortionSlider.min = '1';
    distortionSlider.max = '100';
    distortionSlider.value = '20';
    distortionSlider.id = 'distortion-slider';
    distortionControl.appendChild(distortionSlider);
    
    distortionSection.appendChild(distortionControl);
    
    // Distortion algorithm selector
    const algorithmControl = document.createElement('div');
    algorithmControl.className = 'sound-control-dropdown';
    
    const algorithmLabel = document.createElement('label');
    algorithmLabel.textContent = 'Algorithm:';
    algorithmLabel.htmlFor = 'distortion-algorithm';
    algorithmControl.appendChild(algorithmLabel);
    
    const algorithmSelect = document.createElement('select');
    algorithmSelect.id = 'distortion-algorithm';
    
    const algorithms = ['sine', 'hard', 'cubic', 'soft'];
    algorithms.forEach(alg => {
      const option = document.createElement('option');
      option.value = alg;
      option.textContent = alg.charAt(0).toUpperCase() + alg.slice(1);
      algorithmSelect.appendChild(option);
    });
    
    algorithmControl.appendChild(algorithmSelect);
    distortionSection.appendChild(algorithmControl);
    effectsControls.appendChild(distortionSection);
    
    // Vibe Controls
    const vibeSection = document.createElement('div');
    vibeSection.className = 'sound-effect-section';
    
    const vibeTitle = document.createElement('h4');
    vibeTitle.textContent = 'Vibe / Sound Character';
    vibeSection.appendChild(vibeTitle);
    
    // Warm/Cold slider
    const warmColdControl = document.createElement('div');
    warmColdControl.className = 'sound-control-slider';
    
    const warmColdLabel = document.createElement('label');
    warmColdLabel.textContent = 'Cold/Warm:';
    warmColdLabel.htmlFor = 'warm-cold-slider';
    warmColdControl.appendChild(warmColdLabel);
    
    const warmColdValue = document.createElement('span');
    warmColdValue.id = 'warm-cold-value';
    warmColdValue.textContent = '50%';
    warmColdControl.appendChild(warmColdValue);
    
    const warmColdSlider = document.createElement('input');
    warmColdSlider.type = 'range';
    warmColdSlider.min = '0';
    warmColdSlider.max = '1';
    warmColdSlider.step = '0.01';
    warmColdSlider.value = '0.5';
    warmColdSlider.id = 'warm-cold-slider';
    warmColdControl.appendChild(warmColdSlider);
    
    vibeSection.appendChild(warmColdControl);
    
    // Dry/Wet slider
    const dryWetControl = document.createElement('div');
    dryWetControl.className = 'sound-control-slider';
    
    const dryWetLabel = document.createElement('label');
    dryWetLabel.textContent = 'Dry/Wet:';
    dryWetLabel.htmlFor = 'dry-wet-slider';
    dryWetControl.appendChild(dryWetLabel);
    
    const dryWetValue = document.createElement('span');
    dryWetValue.id = 'dry-wet-value';
    dryWetValue.textContent = '50%';
    dryWetControl.appendChild(dryWetValue);
    
    const dryWetSlider = document.createElement('input');
    dryWetSlider.type = 'range';
    dryWetSlider.min = '0';
    dryWetSlider.max = '1';
    dryWetSlider.step = '0.01';
    dryWetSlider.value = '0.5';
    dryWetSlider.id = 'dry-wet-slider';
    dryWetControl.appendChild(dryWetSlider);
    
    vibeSection.appendChild(dryWetControl);
    effectsControls.appendChild(vibeSection);
    
    // Sound parameter controls
    const paramSection = document.createElement('div');
    paramSection.className = 'sound-effect-section';
    
    const paramTitle = document.createElement('h4');
    paramTitle.textContent = 'Sound Parameters';
    paramSection.appendChild(paramTitle);
    
    // Frequency control
    const freqControl = document.createElement('div');
    freqControl.className = 'sound-control-slider';
    
    const freqLabel = document.createElement('label');
    freqLabel.textContent = 'Frequency:';
    freqLabel.htmlFor = 'freq-slider';
    freqControl.appendChild(freqLabel);
    
    const freqValue = document.createElement('span');
    freqValue.id = 'freq-value';
    freqValue.textContent = '440 Hz';
    freqControl.appendChild(freqValue);
    
    const freqSlider = document.createElement('input');
    freqSlider.type = 'range';
    freqSlider.min = '50';
    freqSlider.max = '2000';
    freqSlider.value = '440';
    freqSlider.id = 'freq-slider';
    freqControl.appendChild(freqSlider);
    
    paramSection.appendChild(freqControl);
    
    // Duration control
    const durationControl = document.createElement('div');
    durationControl.className = 'sound-control-slider';
    
    const durationLabel = document.createElement('label');
    durationLabel.textContent = 'Duration:';
    durationLabel.htmlFor = 'duration-slider';
    durationControl.appendChild(durationLabel);
    
    const durationValue = document.createElement('span');
    durationValue.id = 'duration-value';
    durationValue.textContent = '0.3s';
    durationControl.appendChild(durationValue);
    
    const durationSlider = document.createElement('input');
    durationSlider.type = 'range';
    durationSlider.min = '0.05';
    durationSlider.max = '1';
    durationSlider.step = '0.01';
    durationSlider.value = '0.3';
    durationSlider.id = 'duration-slider';
    durationControl.appendChild(durationSlider);
    
    paramSection.appendChild(durationControl);
    effectsControls.appendChild(paramSection);
    
    soundControls.appendChild(effectsControls);
    
    // Sound preview and controls
    const soundPreview = document.createElement('div');
    soundPreview.className = 'sound-preview';
    
    const playBtn = document.createElement('button');
    playBtn.className = 'sound-play-btn';
    playBtn.textContent = 'Play Sound';
    playBtn.id = 'play-sound-btn';
    soundPreview.appendChild(playBtn);
    
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'sound-download-btn';
    downloadBtn.textContent = 'Download Sound';
    downloadBtn.id = 'download-sound-btn';
    soundPreview.appendChild(downloadBtn);
    
    const addToLibraryBtn = document.createElement('button');
    addToLibraryBtn.className = 'sound-add-to-library-btn';
    addToLibraryBtn.textContent = 'Add to Library';
    addToLibraryBtn.id = 'add-to-library-btn';
    soundPreview.appendChild(addToLibraryBtn);
    
    soundControls.appendChild(soundPreview);
    soundSection.appendChild(soundControls);
    
    contentWrapper.appendChild(spriteSection);
    contentWrapper.appendChild(soundSection);
    container.appendChild(contentWrapper);
    
    // Add a button to open the sequencer in a separate window
    const openSequencerBtn = document.createElement('button');
    openSequencerBtn.className = 'sound-open-sequencer-btn';
    openSequencerBtn.textContent = 'Open Palette Sequencer';
    openSequencerBtn.id = 'open-sequencer-btn';
    openSequencerBtn.style.display = 'block';
    openSequencerBtn.style.margin = '15px auto';
    openSequencerBtn.style.padding = '10px 20px';
    openSequencerBtn.style.backgroundColor = '#9b59b6';
    openSequencerBtn.style.color = 'white';
    openSequencerBtn.style.border = 'none';
    openSequencerBtn.style.borderRadius = '5px';
    openSequencerBtn.style.cursor = 'pointer';
    openSequencerBtn.style.fontWeight = 'bold';
    container.appendChild(openSequencerBtn);
    
    document.body.appendChild(container);
    
    // Create the sequencer in its own container but don't add to DOM yet
    if (this.sequencer) {
      this.sequencerContainer = document.createElement('div');
      this.sequencerContainer.className = 'sound-sequencer-window';
      this.sequencerContainer.id = 'sound-sequencer-window';
      this.sequencerContainer.style.display = 'none';
      this.sequencerContainer.style.position = 'fixed';
      this.sequencerContainer.style.top = '50px';
      this.sequencerContainer.style.left = '50px';
      this.sequencerContainer.style.right = '50px';
      this.sequencerContainer.style.bottom = '50px';
      this.sequencerContainer.style.backgroundColor = '#34495e';
      this.sequencerContainer.style.borderRadius = '8px';
      this.sequencerContainer.style.padding = '20px';
      this.sequencerContainer.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';
      this.sequencerContainer.style.zIndex = '1000';
      this.sequencerContainer.style.overflowY = 'auto';
      
      // Add close button
      const closeBtn = document.createElement('button');
      closeBtn.className = 'sequencer-close-btn';
      closeBtn.innerHTML = '&times;';
      closeBtn.style.position = 'absolute';
      closeBtn.style.top = '10px';
      closeBtn.style.right = '10px';
      closeBtn.style.backgroundColor = 'transparent';
      closeBtn.style.border = 'none';
      closeBtn.style.color = 'white';
      closeBtn.style.fontSize = '24px';
      closeBtn.style.cursor = 'pointer';
      closeBtn.addEventListener('click', () => this.toggleSequencerWindow(false));
      this.sequencerContainer.appendChild(closeBtn);
      
      // Add the sequencer UI to the container
      this.sequencerContainer.appendChild(this.sequencer.createUI());
      
      document.body.appendChild(this.sequencerContainer);
    }
    
    // Update the sprite grid
    this.updateSpriteGrid();
    
    // Bind events
    this.bindEvents();
  }
  
  toggleSequencerWindow(show) {
    if (!this.sequencerContainer) return;
    
    this.sequencerContainer.style.display = show ? 'block' : 'none';
    
    // Update palette colors when opening
    if (show && this.sequencer) {
      this.sequencer.updatePaletteColors();
    }
  }
  
  bindEvents() {
    const backBtn = document.getElementById('back-to-pixel-art');
    backBtn.addEventListener('click', () => {
      this.toggleView(false);
    });
    
    // Volume slider
    const volumeSlider = document.getElementById('volume-slider');
    volumeSlider.addEventListener('input', (e) => {
      this.soundGenerator.setVolume(parseFloat(e.target.value));
    });
    
    // Sound type buttons
    const soundTypeButtons = document.querySelectorAll('.sound-type-btn');
    soundTypeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        soundTypeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentSoundType = btn.dataset.type;
        
        // Update UI with appropriate default parameters for this sound type
        this.updateParametersForSoundType(this.currentSoundType);
      });
    });
    
    // BitCrusher controls
    const bitDepthSlider = document.getElementById('bit-depth-slider');
    bitDepthSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      document.getElementById('bit-depth-value').textContent = value;
      this.bitCrusher.setBitDepth(value);
    });
    
    const sampleRateSlider = document.getElementById('sample-rate-slider');
    sampleRateSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById('sample-rate-value').textContent = `${Math.round(value * 100)}%`;
      this.bitCrusher.setSampleRateReduction(value);
    });
    
    // Distortion controls
    const distortionSlider = document.getElementById('distortion-slider');
    distortionSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      document.getElementById('distortion-value').textContent = value;
      this.distortion.setAmount(value);
    });
    
    const algorithmSelect = document.getElementById('distortion-algorithm');
    algorithmSelect.addEventListener('change', (e) => {
      this.distortion.setAlgorithm(e.target.value);
    });
    
    // Vibe controls
    const warmColdSlider = document.getElementById('warm-cold-slider');
    warmColdSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById('warm-cold-value').textContent = `${Math.round(value * 100)}%`;
      this.artVisualizer.warmColdValue = value;
      this.vibe.setWarmCold(value);
    });
    
    const dryWetSlider = document.getElementById('dry-wet-slider');
    dryWetSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById('dry-wet-value').textContent = `${Math.round(value * 100)}%`;
      this.artVisualizer.dryWetValue = value;
      this.vibe.setDryWet(value);
    });
    
    // Sound parameter controls
    const freqSlider = document.getElementById('freq-slider');
    freqSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      document.getElementById('freq-value').textContent = `${value} Hz`;
    });
    
    const durationSlider = document.getElementById('duration-slider');
    durationSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById('duration-value').textContent = `${value.toFixed(2)}s`;
    });
    
    // Play button
    const playBtn = document.getElementById('play-sound-btn');
    playBtn.addEventListener('click', () => {
      this.playCurrentSound();
    });
    
    // Download button
    const downloadBtn = document.getElementById('download-sound-btn');
    downloadBtn.addEventListener('click', () => {
      this.downloadCurrentSound();
    });
    
    // Add to Library button
    const addToLibraryBtn = document.getElementById('add-to-library-btn');
    addToLibraryBtn.addEventListener('click', () => {
      this.addCurrentSoundToLibrary();
    });
    
    // Add event listeners to mapping selects
    const mappingSelects = document.querySelectorAll('.sound-mapping-select');
    mappingSelects.forEach(select => {
      select.addEventListener('change', (e) => {
        const pixelAttr = select.id.replace('map-', '');
        const effectParam = e.target.value;
        
        // Update the mapping in art visualizer
        if (this.artVisualizer) {
          this.artVisualizer.updatePixelToEffectMapping(pixelAttr, effectParam);
        }
      });
    });
    
    // Add event listener for the sequencer button
    const openSequencerBtn = document.getElementById('open-sequencer-btn');
    if (openSequencerBtn) {
      openSequencerBtn.addEventListener('click', () => {
        this.toggleSequencerWindow(true);
      });
    }
  }
  
  updateSpriteGrid() {
    const spriteGrid = document.getElementById('sound-sprite-grid');
    if (!spriteGrid) return;
    
    // Clear existing content
    spriteGrid.innerHTML = '';
    
    // Add thumbnails for all sprites in storage
    for (const id of this.generator.libraryShowcase.spriteIds) {
      const sizes = ['32', '64', '128', '256'];
      
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
        thumbnail.className = 'sound-sprite-thumbnail';
        thumbnail.dataset.id = id;
        thumbnail.dataset.size = spriteSize;
        
        if (id === this.activeSpriteId) {
          thumbnail.classList.add('active');
        }
        
        const img = document.createElement('img');
        img.src = spriteUrl;
        img.alt = `Sprite ${id.split('_')[2]}`;
        
        thumbnail.appendChild(img);
        
        // Add click handler to select this sprite
        thumbnail.addEventListener('click', () => {
          // Update selection UI
          document.querySelectorAll('.sound-sprite-thumbnail').forEach(t => 
            t.classList.remove('active'));
          thumbnail.classList.add('active');
          
          // Select this sprite for sound generation
          this.selectSprite(id, spriteSize);
        });
        
        spriteGrid.appendChild(thumbnail);
      }
    }
  }
  
  setupLibraryForSoundView() {
    // Add click handlers to sprites in the library panel for sound view
    const spriteItems = document.querySelectorAll('.sprite-item');
    spriteItems.forEach(item => {
      // Save original click handler (if any)
      const originalClickHandler = item.onclick;
      item.dataset.originalClick = originalClickHandler ? 'true' : 'false';
      
      // Temporarily replace the click handler
      item.onclick = (e) => {
        // Get the sprite container (parent element)
        const container = item.closest('.sprite-container');
        if (container) {
          const id = container.dataset.id;
          
          // Find the dropdown
          const dropdown = container.querySelector('.sizes-dropdown');
          if (dropdown) {
            // Toggle dropdown visibility
            const current = dropdown.style.display;
            dropdown.style.display = current === 'block' ? 'none' : 'block';
            
            // Add special click handlers to size options
            const sizeOptions = dropdown.querySelectorAll('.size-option');
            sizeOptions.forEach(option => {
              const originalSizeClickHandler = option.onclick;
              option.dataset.originalClick = originalSizeClickHandler ? 'true' : 'false';
              
              option.onclick = (sizeEvent) => {
                sizeEvent.stopPropagation();
                
                // Get the sprite size
                const size = option.dataset.size;
                
                // Select this sprite for sound generation
                this.selectSprite(id, size);
                
                // Update the art visualizer with this sprite
                this.artVisualizer.setActiveSprite(id, size);
                
                // Update the sprite grid to reflect selection
                this.updateSpriteGrid();
                
                // Close the library after selection
                const mainLibraryPanel = document.getElementById('library-panel');
                const mainLibraryToggle = document.getElementById('library-toggle');
                
                if (mainLibraryPanel && mainLibraryToggle) {
                  mainLibraryPanel.classList.remove('active');
                  mainLibraryToggle.style.right = '0';
                }
                
                // Restore original click handlers
                this.restoreLibraryClickHandlers();
              };
            });
          }
        }
      };
    });
    
    // Also handle palette items
    const paletteItems = document.querySelectorAll('.palette-item');
    paletteItems.forEach(item => {
      // Save original click handler (if any)
      const originalClickHandler = item.onclick;
      item.dataset.originalClick = originalClickHandler ? 'true' : 'false';
      
      // Temporarily replace the click handler
      item.onclick = (e) => {
        // Get the palette container
        const container = item.closest('.palette-container');
        if (container) {
          const id = container.dataset.id;
          
          // Find the dropdown
          const dropdown = container.querySelector('.palette-sizes-dropdown');
          if (dropdown) {
            // Toggle dropdown visibility
            const current = dropdown.style.display;
            dropdown.style.display = current === 'block' ? 'none' : 'block';
            
            // Add special click handlers to size options
            const sizeOptions = dropdown.querySelectorAll('.size-option');
            sizeOptions.forEach(option => {
              const originalSizeClickHandler = option.onclick;
              option.dataset.originalClick = originalSizeClickHandler ? 'true' : 'false';
              
              option.onclick = (sizeEvent) => {
                sizeEvent.stopPropagation();
                
                // Get the palette size
                const size = option.dataset.size;
                
                // Select this palette for sound generation
                this.activePaletteId = id;
                this.selectedPaletteSize = size;
                
                // Update the art visualizer with this palette
                this.artVisualizer.setActivePalette(id, size);
                
                // Close the library after selection
                const mainLibraryPanel = document.getElementById('library-panel');
                const mainLibraryToggle = document.getElementById('library-toggle');
                
                if (mainLibraryPanel && mainLibraryToggle) {
                  mainLibraryPanel.classList.remove('active');
                  mainLibraryToggle.style.right = '0';
                }
                
                // Restore original click handlers
                this.restoreLibraryClickHandlers();
              };
            });
          }
        }
      };
    });
  }
  
  selectSprite(id, size) {
    this.activeSpriteId = id;
    this.selectedSpriteSize = size;
    this.generator.soundSelectedSpriteSize = size;
    this.generator.currentAssetId = id;
    
    // Immediately update the art visualizer with this sprite
    this.artVisualizer.setActiveSprite(id, size);
    
    // Also update the palette to match
    const paletteSize = this.generator.paletteSize.toString();
    this.artVisualizer.setActivePalette(id, paletteSize);
    
    // Update the sequencer palette
    if (this.sequencer) {
      this.sequencer.updatePaletteColors();
    }
  }

  toggleView(show) {
    const soundContainer = document.getElementById('sound-container');
    const container = document.querySelector('.container');
    
    if (show) {
      soundContainer.style.display = 'block';
      container.style.display = 'none';
      
      // Update the sprite grid
      this.updateSpriteGrid();
      
      // If we have a current asset ID from the generator, use it
      if (this.generator.currentAssetId) {
        // Get the processed sprite title to determine size
        const processedTitle = document.getElementById('processed-sprite-title');
        let size = this.selectedSpriteSize;
        
        if (processedTitle) {
          // Extract size from title (format: "32x32 Sprite")
          const titleText = processedTitle.textContent;
          const match = titleText.match(/(\d+)x\d+/);
          if (match && match[1]) {
            size = match[1];
          }
        }
        
        this.selectSprite(this.generator.currentAssetId, size);
        
        // Update art visualizer from library
        this.artVisualizer.updateFromLibrary();
      }
    } else {
      soundContainer.style.display = 'none';
      container.style.display = 'block';
    }
  }
  
  updateParametersForSoundType(type) {
    // Set default parameters based on sound type
    const freqSlider = document.getElementById('freq-slider');
    const durationSlider = document.getElementById('duration-slider');
    const freqValue = document.getElementById('freq-value');
    const durationValue = document.getElementById('duration-value');
    
    let freq, duration;
    
    switch(type) {
      case 'jump':
        freq = 300;
        duration = 0.3;
        break;
      case 'attack':
        freq = 150;
        duration = 0.15;
        break;
      case 'collect':
        freq = 600;
        duration = 0.2;
        break;
      case 'damage':
        freq = 150;
        duration = 0.3;
        break;
      case 'power-up':
        freq = 300;
        duration = 0.6;
        break;
      case 'zap':
        freq = 800;
        duration = 0.15;
        break;
      case 'boom':
        freq = 120;
        duration = 0.5;
        break;
      case 'lose':
        freq = 400;
        duration = 0.7;
        break;
      case 'blip':
        freq = 700;
        duration = 0.05;
        break;
      case 'shoot':
        freq = 350;
        duration = 0.2;
        break;
      case 'win':
        freq = 440;
        duration = 0.8;
        break;
      case 'grab':
        freq = 250;
        duration = 0.15;
        break;
      default:
        freq = 300;
        duration = 0.3;
    }
    
    freqSlider.value = freq;
    freqValue.textContent = `${freq} Hz`;
    
    durationSlider.value = duration;
    durationValue.textContent = `${duration.toFixed(2)}s`;
  }

  analyzeCurrentSprite() {
    if (!this.activeSpriteId) return;
    
    // Get the sprite image
    // const spriteImg = document.getElementById('sound-sprite-img');
    // if (!spriteImg.complete) {
    //   // Wait for image to load if needed
    //   spriteImg.onload = () => this.performAnalysis(spriteImg);
    //   return;
    // }
    
    // this.performAnalysis(spriteImg);
  }

  performAnalysis(spriteImg) {
    // Create a canvas to analyze the image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = spriteImg.naturalWidth;
    canvas.height = spriteImg.naturalHeight;
    
    // Draw the image
    ctx.drawImage(spriteImg, 0, 0);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Analyze pixel data
    const analysis = this.soundGenerator.analyzePixelData(
      imageData.data, 
      canvas.width, 
      canvas.height
    );
    
    // Only apply mappings if checkboxes are checked
    // if (document.getElementById('map-brightness').checked) {
    //   // Update frequency based on brightness
    //   const freqSlider = document.getElementById('freq-slider');
    //   const freqValue = document.getElementById('freq-value');
    //   freqSlider.value = analysis.frequency;
    //   freqValue.textContent = `${Math.round(analysis.frequency)} Hz`;
    // }
    
    // if (document.getElementById('map-saturation').checked) {
    //   // Update bit crusher based on saturation
    //   const bitDepthSlider = document.getElementById('bit-depth-slider');
    //   const bitDepthValue = document.getElementById('bit-depth-value');
    //   const bitDepth = Math.round(4 + (analysis.intensity * 12)); // Map 0-1 to 4-16
    //   bitDepthSlider.value = bitDepth;
    //   bitDepthValue.textContent = bitDepth;
    //   this.bitCrusher.setBitDepth(bitDepth);
      
    //   const sampleRateSlider = document.getElementById('sample-rate-slider');
    //   const sampleRateValue = document.getElementById('sample-rate-value');
    //   const sampleRate = 0.1 + (analysis.intensity * 0.9); // Map 0-1 to 0.1-1.0
    //   sampleRateSlider.value = sampleRate;
    //   sampleRateValue.textContent = `${Math.round(sampleRate * 100)}%`;
    //   this.bitCrusher.setSampleRateReduction(sampleRate);
    // }
    
    // if (document.getElementById('map-complexity').checked) {
    //   // Update distortion based on complexity
    //   const distortionSlider = document.getElementById('distortion-slider');
    //   const distortionValue = document.getElementById('distortion-value');
    //   const distortion = Math.round(1 + (analysis.complexity * 99)); // Map 0-1 to 1-100
    //   distortionSlider.value = distortion;
    //   distortionValue.textContent = distortion;
    //   this.distortion.setAmount(distortion);
    // }
    
    // Update duration
    // const durationSlider = document.getElementById('duration-slider');
    // const durationValue = document.getElementById('duration-value');
    // durationSlider.value = analysis.duration;
    // durationValue.textContent = `${analysis.duration.toFixed(2)}s`;
  }

  playCurrentSound() {
    if (this.artVisualizer) {
      this.artVisualizer.playCurrentSound();
    } else {
      // Fallback to old implementation if artVisualizer isn't available
      // Stop any currently playing sound
      if (this.activeSound) {
        // No direct way to stop, we'll just let it play out
        this.activeSound = null;
      }
      
      // Get parameters from UI
      const frequency = parseFloat(document.getElementById('freq-slider').value);
      const duration = parseFloat(document.getElementById('duration-slider').value);
      
      // Route the sound through the effects chain
      const sourceNode = this.audioContext.createGain();
      sourceNode.connect(this.bitCrusher.node);
      
      // Update Vibe settings based on current slider values
      this.vibe.setWarmCold(this.artVisualizer.warmColdValue);
      this.vibe.setDryWet(this.artVisualizer.dryWetValue);
      
      // Generate the appropriate sound
      let sound;
      const params = { 
        frequency, 
        duration,
        outputNode: sourceNode // Pass the source node to connect oscillators to
      };
      
      switch(this.currentSoundType) {
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
      this.lastGeneratedSound = {
        type: this.currentSoundType,
        params: params
      };
    }
  }

  downloadCurrentSound() {
    if (!this.artVisualizer || !this.artVisualizer.activeSound) {
      alert('Please play a sound first before downloading.');
      return;
    }
    
    // Create an offline audio context to render the sound
    const offlineCtx = new OfflineAudioContext(
      2, // stereo
      this.audioContext.sampleRate * (parseFloat(document.getElementById('duration-slider').value) + 0.2), 
      this.audioContext.sampleRate
    );
    
    // Set up the sound chain in the offline context
    const bitCrusher = new BitCrusher(offlineCtx);
    const distortion = new Distortion(offlineCtx);
    const vibe = new Vibe(offlineCtx);
    
    // Copy the parameter settings
    bitCrusher.setBitDepth(this.bitCrusher.bitDepth);
    bitCrusher.setSampleRateReduction(this.bitCrusher.sampleRateReduction);
    
    distortion.setAmount(this.distortion.amount || 20);
    distortion.setAlgorithm(document.getElementById('distortion-algorithm').value);
    
    vibe.setWarmCold(parseFloat(document.getElementById('warm-cold-slider').value));
    vibe.setDryWet(parseFloat(document.getElementById('dry-wet-slider').value));
    
    // Set up audio routing
    bitCrusher.connect(distortion.input());
    distortion.connect(vibe.input());
    vibe.connect(offlineCtx.destination);
    
    // Generate the sound with current settings
    const frequency = parseFloat(document.getElementById('freq-slider').value);
    const duration = parseFloat(document.getElementById('duration-slider').value);
    
    // Create source node to connect to effects chain
    const sourceNode = offlineCtx.createGain();
    sourceNode.connect(bitCrusher.node);
    
    // Generate the sound
    const soundType = document.querySelector('.sound-type-btn.active')?.dataset.type || 'jump';
    const params = { 
      frequency, 
      duration,
      outputNode: sourceNode
    };
    
    // Create a sound generator for the offline context
    const generator = new SoundGenerator(offlineCtx);
    
    // Generate the appropriate sound
    let sound;
    switch(soundType) {
      case 'jump':
        sound = generator.generateJumpSound(params);
        break;
      case 'attack':
        sound = generator.generateAttackSound(params);
        break;
      case 'collect':
        sound = generator.generateCollectSound(params);
        break;
      case 'damage':
        sound = generator.generateDamageSound(params);
        break;
      case 'power-up':
        sound = generator.generatePowerupSound(params);
        break;
      case 'zap':
        sound = generator.generateZapSound(params);
        break;
      case 'boom':
        sound = generator.generateBoomSound(params);
        break;
      case 'lose':
        sound = generator.generateLoseSound(params);
        break;
      case 'blip':
        sound = generator.generateBlipSound(params);
        break;
      case 'shoot':
        sound = generator.generateShootSound(params);
        break;
      case 'win':
        sound = generator.generateWinSound(params);
        break;
      case 'grab':
        sound = generator.generateGrabSound(params);
        break;
      default:
        sound = generator.generateJumpSound(params);
    }
    
    // Render the audio
    offlineCtx.startRendering().then(renderedBuffer => {
      // Convert the rendered buffer to WAV format
      const wavData = this.bufferToWav(renderedBuffer);
      
      // Create a download link
      const blob = new Blob([wavData], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pixel-sound-${soundType}-${Date.now()}.wav`;
      link.click();
      
      // Clean up
      URL.revokeObjectURL(url);
    }).catch(err => {
      console.error('Error rendering audio:', err);
      alert('Failed to download sound. Please try again.');
    });
  }
  
  // Convert AudioBuffer to WAV format
  bufferToWav(buffer) {
    const numOfChannels = buffer.numberOfChannels;
    const length = buffer.length * numOfChannels * 2; // 2 bytes per sample (16-bit)
    const sampleRate = buffer.sampleRate;
    
    // Create the WAV file buffer
    const wavBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(wavBuffer);
    
    // Write the WAV header
    // "RIFF" chunk descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    this.writeString(view, 8, 'WAVE');
    
    // "fmt " sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // audio format (1 for PCM)
    view.setUint16(22, numOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numOfChannels * 2, true); // byte rate
    view.setUint16(32, numOfChannels * 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    
    // "data" sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, length, true);
    
    // Write the PCM samples
    const dataOffset = 44;
    let offset = dataOffset;
    
    // Get audio data from each channel and interleave
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        const sampleInt = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, sampleInt, true);
        offset += 2;
      }
    }
    
    return new Uint8Array(wavBuffer);
  }
  
  // Helper to write strings to DataView
  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  addCurrentSoundToLibrary() {
    if (!this.activeSpriteId) {
      this.showPopup('Please select a sprite before adding a sound to the library.', 'warning');
      return;
    }
    
    // Create an offline audio context to render the sound
    const offlineCtx = new OfflineAudioContext(
      2, // stereo
      this.audioContext.sampleRate * (parseFloat(document.getElementById('duration-slider').value) + 0.2), 
      this.audioContext.sampleRate
    );
    
    // Set up the sound chain in the offline context (same as downloadCurrentSound)
    const bitCrusher = new BitCrusher(offlineCtx);
    const distortion = new Distortion(offlineCtx);
    const vibe = new Vibe(offlineCtx);
    
    // Copy the parameter settings
    bitCrusher.setBitDepth(this.bitCrusher.bitDepth);
    bitCrusher.setSampleRateReduction(this.bitCrusher.sampleRateReduction);
    
    distortion.setAmount(this.distortion.amount || 20);
    distortion.setAlgorithm(document.getElementById('distortion-algorithm').value);
    
    vibe.setWarmCold(parseFloat(document.getElementById('warm-cold-slider').value));
    vibe.setDryWet(parseFloat(document.getElementById('dry-wet-slider').value));
    
    // Set up audio routing
    bitCrusher.connect(distortion.input());
    distortion.connect(vibe.input());
    vibe.connect(offlineCtx.destination);
    
    // Generate the sound with current settings
    const frequency = parseFloat(document.getElementById('freq-slider').value);
    const duration = parseFloat(document.getElementById('duration-slider').value);
    
    // Create source node to connect to effects chain
    const sourceNode = offlineCtx.createGain();
    sourceNode.connect(bitCrusher.node);
    
    // Generate the sound
    const soundType = document.querySelector('.sound-type-btn.active')?.dataset.type || 'jump';
    const params = { 
      frequency, 
      duration,
      outputNode: sourceNode
    };
    
    // Create a sound generator for the offline context
    const generator = new SoundGenerator(offlineCtx);
    
    // Generate the appropriate sound (same as downloadCurrentSound)
    let sound;
    switch(soundType) {
      case 'jump':
        sound = generator.generateJumpSound(params);
        break;
      case 'attack':
        sound = generator.generateAttackSound(params);
        break;
      case 'collect':
        sound = generator.generateCollectSound(params);
        break;
      case 'damage':
        sound = generator.generateDamageSound(params);
        break;
      case 'power-up':
        sound = generator.generatePowerupSound(params);
        break;
      case 'zap':
        sound = generator.generateZapSound(params);
        break;
      case 'boom':
        sound = generator.generateBoomSound(params);
        break;
      case 'lose':
        sound = generator.generateLoseSound(params);
        break;
      case 'blip':
        sound = generator.generateBlipSound(params);
        break;
      case 'shoot':
        sound = generator.generateShootSound(params);
        break;
      case 'win':
        sound = generator.generateWinSound(params);
        break;
      case 'grab':
        sound = generator.generateGrabSound(params);
        break;
      default:
        sound = generator.generateJumpSound(params);
    }
    
    // Render the audio
    offlineCtx.startRendering().then(renderedBuffer => {
      // Convert the rendered buffer to WAV format
      const wavData = this.bufferToWav(renderedBuffer);
      
      // Store in the sound storage with unique ID
      const newSoundId = this.generator.soundStorage.storeSound(
        this.activeSpriteId,
        wavData,
        soundType,
        {
          frequency,
          duration,
          bitDepth: this.bitCrusher.bitDepth,
          sampleRateReduction: this.bitCrusher.sampleRateReduction,
          distortion: this.distortion.amount || 20,
          algorithm: document.getElementById('distortion-algorithm').value,
          warmCold: parseFloat(document.getElementById('warm-cold-slider').value),
          dryWet: parseFloat(document.getElementById('dry-wet-slider').value)
        }
      );
      
      // Update the library panel to include the new sound
      this.updateSoundLibrary();
      
      this.showPopup(`${soundType.charAt(0).toUpperCase() + soundType.slice(1)} sound added to library!`, 'success');
    }).catch(err => {
      console.error('Error rendering audio:', err);
      this.showPopup('Failed to add sound to library. Please try again.', 'warning');
    });
  }

  updateSoundLibrary() {
    // Get the library panel
    const libraryPanel = document.getElementById('library-panel');
    
    // Check if the sounds section already exists, otherwise create it
    let soundsSection = libraryPanel.querySelector('.sounds-section');
    if (!soundsSection) {
      soundsSection = document.createElement('div');
      soundsSection.className = 'library-section sounds-section';
      
      const soundsTitle = document.createElement('h3');
      soundsTitle.textContent = 'My Sounds';
      soundsSection.appendChild(soundsTitle);
      
      const soundGrid = document.createElement('div');
      soundGrid.className = 'sound-grid';
      soundGrid.id = 'sound-grid';
      soundsSection.appendChild(soundGrid);
      
      libraryPanel.appendChild(soundsSection);
    }
    
    // Update the sound grid with stored sounds grouped by sprite ID
    const soundGrid = document.getElementById('sound-grid');
    if (!soundGrid) return;
    
    // Clear existing content
    soundGrid.innerHTML = '';
    
    // Get all sprite IDs with sounds
    const soundGroups = {};
    for (const id in this.generator.soundStorage.sounds) {
      if (!this.generator.soundStorage.sounds[id] || !this.generator.soundStorage.sounds[id].wav) continue;
      
      // Get the sprite ID from the sound ID (format: spriteId_sound_timestamp)
      const parts = id.split('_sound_');
      const spriteId = parts[0];
      
      if (!soundGroups[spriteId]) {
        soundGroups[spriteId] = [];
      }
      
      soundGroups[spriteId].push(id);
    }
    
    // Create containers for each sprite's sounds
    for (const spriteId in soundGroups) {
      // Create the sound container for this sprite
      const spriteContainer = document.createElement('div');
      spriteContainer.className = 'sound-sprite-container';
      spriteContainer.dataset.id = spriteId;
      
      // Create the header with sprite ID that can be clicked to expand
      const spriteHeader = document.createElement('div');
      spriteHeader.className = 'sound-sprite-header';
      spriteHeader.textContent = `Sounds for Sprite ${spriteId.split('_')[2]}`;
      spriteContainer.appendChild(spriteHeader);
      
      // Create dropdown container for this sprite's sounds
      const soundsDropdown = document.createElement('div');
      soundsDropdown.className = 'sounds-dropdown';
      soundsDropdown.style.display = 'none';
      
      // Add each sound to the dropdown
      soundGroups[spriteId].forEach(soundId => {
        const soundData = this.generator.soundStorage.getSound(soundId);
        
        const soundItem = document.createElement('div');
        soundItem.className = 'sound-item';
        soundItem.dataset.id = soundId;
        
        const soundIcon = document.createElement('div');
        soundIcon.className = 'sound-icon';
        soundIcon.innerHTML = '🔊';
        
        const soundInfo = document.createElement('div');
        soundInfo.className = 'sound-info';
        
        const soundType = document.createElement('div');
        soundType.className = 'sound-type';
        soundType.textContent = soundData.type.charAt(0).toUpperCase() + soundData.type.slice(1);
        
        const playButton = document.createElement('button');
        playButton.className = 'sound-item-play';
        playButton.textContent = 'Play';
        
        playButton.addEventListener('click', (e) => {
          e.stopPropagation();
          this.playStoredSound(soundId);
        });
        
        soundInfo.appendChild(soundType);
        soundInfo.appendChild(playButton);
        
        soundItem.appendChild(soundIcon);
        soundItem.appendChild(soundInfo);
        
        // Add click handler to select this sound
        soundItem.addEventListener('click', () => {
          this.loadStoredSound(soundId);
        });
        
        soundsDropdown.appendChild(soundItem);
      });
      
      // Toggle dropdown on header click
      spriteHeader.addEventListener('click', () => {
        // Close all other dropdowns
        document.querySelectorAll('.sounds-dropdown').forEach(dropdown => {
          if (dropdown !== soundsDropdown) {
            dropdown.style.display = 'none';
          }
        });
        
        // Toggle this dropdown
        soundsDropdown.style.display = 
          soundsDropdown.style.display === 'none' ? 'block' : 'none';
      });
      
      spriteContainer.appendChild(soundsDropdown);
      soundGrid.appendChild(spriteContainer);
    }
  }

  playStoredSound(id) {
    const soundData = this.generator.soundStorage.getSound(id);
    if (!soundData || !soundData.wav) return;
    
    // Create audio element to play the stored sound
    const audio = new Audio();
    const blob = new Blob([soundData.wav], { type: 'audio/wav' });
    audio.src = URL.createObjectURL(blob);
    audio.play();
  }

  loadStoredSound(id) {
    const soundData = this.generator.soundStorage.getSound(id);
    if (!soundData || !soundData.params) return;
    
    // Apply stored parameters to UI
    const params = soundData.params;
    
    // Update sound type button
    document.querySelectorAll('.sound-type-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.type === soundData.type) {
        btn.classList.add('active');
        this.currentSoundType = soundData.type;
      }
    });
    
    // Update all sliders and selects with stored values
    document.getElementById('freq-slider').value = params.frequency;
    document.getElementById('freq-value').textContent = `${Math.round(params.frequency)} Hz`;
    
    document.getElementById('duration-slider').value = params.duration;
    document.getElementById('duration-value').textContent = `${params.duration.toFixed(2)}s`;
    
    document.getElementById('bit-depth-slider').value = params.bitDepth;
    document.getElementById('bit-depth-value').textContent = params.bitDepth;
    this.bitCrusher.setBitDepth(params.bitDepth);
    
    document.getElementById('sample-rate-slider').value = params.sampleRateReduction;
    document.getElementById('sample-rate-value').textContent = `${Math.round(params.sampleRateReduction * 100)}%`;
    this.bitCrusher.setSampleRateReduction(params.sampleRateReduction);
    
    document.getElementById('distortion-slider').value = params.distortion;
    document.getElementById('distortion-value').textContent = params.distortion;
    this.distortion.setAmount(params.distortion);
    
    document.getElementById('distortion-algorithm').value = params.algorithm;
    this.distortion.setAlgorithm(params.algorithm);
    
    document.getElementById('warm-cold-slider').value = params.warmCold;
    document.getElementById('warm-cold-value').textContent = `${Math.round(params.warmCold * 100)}%`;
    this.vibe.setWarmCold(params.warmCold);
    
    document.getElementById('dry-wet-slider').value = params.dryWet;
    document.getElementById('dry-wet-value').textContent = `${Math.round(params.dryWet * 100)}%`;
    this.vibe.setDryWet(params.dryWet);
  }

  showPopup(message, type = 'info') {
    // Remove any existing popups
    const existingPopup = document.getElementById('sound-popup');
    if (existingPopup) {
      existingPopup.remove();
    }

    // Create popup container
    const popup = document.createElement('div');
    popup.id = 'sound-popup';
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