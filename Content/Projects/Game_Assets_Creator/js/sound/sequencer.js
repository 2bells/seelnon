import { BitCrusher } from './plugin/bitcrush.js';
import { Distortion } from './plugin/distort.js';
import { Vibe } from './plugin/vibe.js';
import { SoundGenerator } from './plugin/generate.js';

export class SoundSequencer {
  constructor(artVisualizer, soundGenerator, effectProcessors) {
    this.artVisualizer = artVisualizer;
    this.soundGenerator = soundGenerator;
    this.effectProcessors = effectProcessors;
    this.container = null;
    this.canvas = null;
    this.ctx = null;
    this.isPlaying = false;
    this.currentPosition = 0;
    this.animationFrame = null;

    // Sequencer settings
    this.tracks = [];
    this.steps = 16;
    this.currentStep = 0;
    this.tempo = 120; // BPM
    this.stepInterval = null;
    
    // UI state
    this.selectedTrack = 0;
    this.selectedSoundType = 'blip';
    this.availableSoundTypes = [
      'blip', 'collect', 'jump', 'hit', 'grab',
      'shoot', 'attack', 'power-up', 'zap', 'boom'
    ];
    
    // Initialize with 4 tracks
    this.initializeTracks(4);
  }
  
  initializeTracks(count) {
    this.tracks = [];
    for (let i = 0; i < count; i++) {
      this.tracks.push({
        name: `Track ${i+1}`,
        soundType: this.availableSoundTypes[i % this.availableSoundTypes.length],
        steps: new Array(this.steps).fill(null),
        muted: false,
        volume: 0.8,
        duration: 0.2
      });
    }
  }
  
  createUI() {
    this.container = document.createElement('div');
    this.container.className = 'sound-sequencer-container';
    this.container.id = 'sound-sequencer';
    
    const headerRow = document.createElement('div');
    headerRow.className = 'sequencer-header-row';
    
    const title = document.createElement('h3');
    title.textContent = 'Palette Sequencer';
    headerRow.appendChild(title);
    
    const controlsRow = document.createElement('div');
    controlsRow.className = 'sequencer-controls';
    
    const playBtn = document.createElement('button');
    playBtn.className = 'sequencer-play-btn';
    playBtn.id = 'sequencer-play';
    playBtn.innerHTML = '▶ Play';
    playBtn.addEventListener('click', () => this.togglePlayback());
    
    const stopBtn = document.createElement('button');
    stopBtn.className = 'sequencer-stop-btn';
    stopBtn.id = 'sequencer-stop';
    stopBtn.innerHTML = '■ Stop';
    stopBtn.addEventListener('click', () => this.stopPlayback());
    
    const clearBtn = document.createElement('button');
    clearBtn.className = 'sequencer-clear-btn';
    clearBtn.id = 'sequencer-clear';
    clearBtn.innerHTML = '🗑 Clear';
    clearBtn.addEventListener('click', () => this.clearSequence());
    
    const addTrackBtn = document.createElement('button');
    addTrackBtn.className = 'sequencer-add-track-btn';
    addTrackBtn.id = 'sequencer-add-track';
    addTrackBtn.innerHTML = '+ Add Track';
    addTrackBtn.addEventListener('click', () => this.addTrack());
    
    // Pattern length control
    const patternLengthControl = document.createElement('div');
    patternLengthControl.className = 'sequencer-steps-control';
    
    const patternLengthLabel = document.createElement('span');
    patternLengthLabel.textContent = 'Steps:';
    patternLengthControl.appendChild(patternLengthLabel);
    
    const patternLengthSelect = document.createElement('select');
    patternLengthSelect.id = 'sequencer-steps';
    [8, 16, 24, 32].forEach(stepCount => {
      const option = document.createElement('option');
      option.value = stepCount;
      option.textContent = stepCount;
      if (stepCount === this.steps) {
        option.selected = true;
      }
      patternLengthSelect.appendChild(option);
    });
    
    patternLengthSelect.addEventListener('change', (e) => {
      this.resizePattern(parseInt(e.target.value));
    });
    
    patternLengthControl.appendChild(patternLengthSelect);
    
    // Tempo control
    const tempoControl = document.createElement('div');
    tempoControl.className = 'sequencer-tempo-control';
    
    const tempoLabel = document.createElement('span');
    tempoLabel.textContent = 'Tempo:';
    tempoControl.appendChild(tempoLabel);
    
    const tempoValue = document.createElement('span');
    tempoValue.id = 'sequencer-tempo-value';
    tempoValue.textContent = `${this.tempo} BPM`;
    tempoControl.appendChild(tempoValue);
    
    const tempoSlider = document.createElement('input');
    tempoSlider.type = 'range';
    tempoSlider.min = '60';
    tempoSlider.max = '240';
    tempoSlider.value = this.tempo;
    tempoSlider.id = 'sequencer-tempo';
    tempoSlider.addEventListener('input', (e) => {
      this.tempo = parseInt(e.target.value);
      tempoValue.textContent = `${this.tempo} BPM`;
      if (this.isPlaying) {
        this.restartPlayback();
      }
    });
    tempoControl.appendChild(tempoSlider);
    
    // Export and save buttons
    const exportBtn = document.createElement('button');
    exportBtn.className = 'sequencer-export-btn';
    exportBtn.textContent = '🔊 Export as WAV';
    exportBtn.addEventListener('click', () => this.exportSequenceAudio());
    
    controlsRow.appendChild(playBtn);
    controlsRow.appendChild(stopBtn);
    controlsRow.appendChild(tempoControl);
    controlsRow.appendChild(patternLengthControl);
    controlsRow.appendChild(clearBtn);
    controlsRow.appendChild(addTrackBtn);
    controlsRow.appendChild(exportBtn);
    
    headerRow.appendChild(controlsRow);
    this.container.appendChild(headerRow);
    
    // Create the grid container
    const sequencerGrid = document.createElement('div');
    sequencerGrid.className = 'sequencer-grid';
    
    // Create the grid UI for each track
    this.createTrackGrid(sequencerGrid);
    
    this.container.appendChild(sequencerGrid);
    
    // Create color palette picker
    const paletteSection = document.createElement('div');
    paletteSection.className = 'sequencer-palette-section';
    
    const paletteTitle = document.createElement('h4');
    paletteTitle.textContent = 'Color Palette';
    paletteSection.appendChild(paletteTitle);
    
    const paletteGrid = document.createElement('div');
    paletteGrid.className = 'sequencer-palette-grid';
    paletteGrid.id = 'sequencer-palette-grid';
    
    // Load palette colors from active palette
    this.updatePaletteColors(paletteGrid);
    
    paletteSection.appendChild(paletteGrid);
    
    // Preset patterns section
    const presetSection = document.createElement('div');
    presetSection.className = 'sequencer-preset-section';
    
    const presetTitle = document.createElement('h4');
    presetTitle.textContent = 'Pattern Presets';
    presetSection.appendChild(presetTitle);
    
    const presetGrid = document.createElement('div');
    presetGrid.className = 'sequencer-preset-grid';
    
    const presets = [
      { name: 'Basic Beat', id: 'basic-beat' },
      { name: 'Funky Groove', id: 'funky-groove' },
      { name: 'Epic 8-bit', id: 'epic-8bit' },
      { name: 'Chiptune', id: 'chiptune' }
    ];
    
    presets.forEach(preset => {
      const presetBtn = document.createElement('button');
      presetBtn.className = 'sequencer-preset-btn';
      presetBtn.textContent = preset.name;
      presetBtn.addEventListener('click', () => this.loadPreset(preset.id));
      presetGrid.appendChild(presetBtn);
    });
    
    presetSection.appendChild(presetGrid);
    
    const controlsSection = document.createElement('div');
    controlsSection.className = 'sequencer-controls-section';
    controlsSection.appendChild(paletteSection);
    controlsSection.appendChild(presetSection);
    
    this.container.appendChild(controlsSection);
    
    return this.container;
  }
  
  updatePaletteColors(paletteGrid = null) {
    if (!paletteGrid) {
      paletteGrid = document.getElementById('sequencer-palette-grid');
      if (!paletteGrid) return;
    }
    
    // Clear existing palette
    paletteGrid.innerHTML = '';
    
    // Get palette from artVisualizer
    let palette;
    
    if (this.artVisualizer && this.artVisualizer.activePalette) {
      palette = this.artVisualizer.activePalette;
    } else if (this.artVisualizer && this.artVisualizer.generator && 
               this.artVisualizer.generator.currentAssetId) {
      // Try to get palette from storage
      const paletteSize = this.artVisualizer.generator.paletteSize || 8;
      palette = this.artVisualizer.generator.paletteStorage.getPalette(
        this.artVisualizer.generator.currentAssetId,
        paletteSize.toString()
      );
    }
    
    if (!palette || palette.length === 0) {
      // Create default colors if no palette available
      palette = [
        [255, 0, 0], [255, 165, 0], [255, 255, 0], [0, 255, 0],
        [0, 255, 255], [0, 0, 255], [128, 0, 128], [255, 255, 255]
      ];
    }
    
    // Add the palette colors
    palette.forEach((color, index) => {
      const colorBtn = document.createElement('div');
      colorBtn.className = 'sequencer-color-btn';
      colorBtn.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      colorBtn.dataset.colorIndex = index;
      colorBtn.addEventListener('click', () => {
        // Set as active color
        document.querySelectorAll('.sequencer-color-btn').forEach(btn => 
          btn.classList.remove('active'));
        colorBtn.classList.add('active');
      });
      
      paletteGrid.appendChild(colorBtn);
    });
    
    // Select the first color by default
    const firstColorBtn = paletteGrid.querySelector('.sequencer-color-btn');
    if (firstColorBtn) {
      firstColorBtn.classList.add('active');
    }
  }
  
  createTrackGrid(container) {
    container.innerHTML = ''; // Clear existing content
    
    // Create header row with step numbers
    const headerRow = document.createElement('div');
    headerRow.className = 'sequencer-track-row sequencer-header';
    
    // Empty cell for track controls
    const emptyHeaderCell = document.createElement('div');
    emptyHeaderCell.className = 'sequencer-track-cell sequencer-track-controls';
    headerRow.appendChild(emptyHeaderCell);
    
    // Add step numbers
    for (let i = 0; i < this.steps; i++) {
      const stepCell = document.createElement('div');
      stepCell.className = 'sequencer-track-cell sequencer-step-header';
      stepCell.textContent = (i + 1).toString().padStart(2, '0');
      
      // Add beat markers (every 4 steps)
      if (i % 4 === 0) {
        stepCell.classList.add('beat-marker');
      }
      
      headerRow.appendChild(stepCell);
    }
    
    container.appendChild(headerRow);
    
    // Create a row for each track
    this.tracks.forEach((track, trackIndex) => {
      const trackRow = document.createElement('div');
      trackRow.className = 'sequencer-track-row';
      trackRow.dataset.track = trackIndex;
      
      // Track controls (sound type, mute, etc.)
      const trackControls = document.createElement('div');
      trackControls.className = 'sequencer-track-cell sequencer-track-controls';
      
      const trackName = document.createElement('div');
      trackName.className = 'sequencer-track-name';
      trackName.textContent = track.name;
      trackControls.appendChild(trackName);
      
      const soundTypeSelect = document.createElement('select');
      soundTypeSelect.className = 'sequencer-sound-type';
      
      this.availableSoundTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        if (type === track.soundType) {
          option.selected = true;
        }
        soundTypeSelect.appendChild(option);
      });
      
      soundTypeSelect.addEventListener('change', (e) => {
        track.soundType = e.target.value;
      });
      
      trackControls.appendChild(soundTypeSelect);
      
      trackRow.appendChild(trackControls);
      
      // Create cells for each step in the track
      for (let stepIndex = 0; stepIndex < this.steps; stepIndex++) {
        const stepCell = document.createElement('div');
        stepCell.className = 'sequencer-track-cell sequencer-step';
        stepCell.dataset.track = trackIndex;
        stepCell.dataset.step = stepIndex;
        
        // Add beat markers (every 4 steps)
        if (stepIndex % 4 === 0) {
          stepCell.classList.add('beat-marker');
        }
        
        // If there's a color set for this step, display it
        if (track.steps[stepIndex] !== null) {
          const colorData = track.steps[stepIndex];
          stepCell.style.backgroundColor = `rgb(${colorData[0]}, ${colorData[1]}, ${colorData[2]})`;
          stepCell.classList.add('active');
        }
        
        // Add click event to toggle step
        stepCell.addEventListener('click', () => {
          const activeColorBtn = document.querySelector('.sequencer-color-btn.active');
          if (!activeColorBtn) return;
          
          // Get color index or use first color if none is active
          const colorIndex = parseInt(activeColorBtn.dataset.colorIndex || 0);
          
          // Get color from artVisualizer or default palette
          let color;
          if (this.artVisualizer && this.artVisualizer.activePalette && 
              this.artVisualizer.activePalette[colorIndex]) {
            color = this.artVisualizer.activePalette[colorIndex];
          } else {
            // Default colors if palette not available
            const defaultColors = [
              [255, 0, 0], [255, 165, 0], [255, 255, 0], [0, 255, 0],
              [0, 255, 255], [0, 0, 255], [128, 0, 128], [255, 255, 255]
            ];
            color = defaultColors[colorIndex % defaultColors.length];
          }
          
          if (stepCell.classList.contains('active')) {
            // Remove step
            track.steps[stepIndex] = null;
            stepCell.style.backgroundColor = '';
            stepCell.classList.remove('active');
          } else {
            // Add step with selected color
            track.steps[stepIndex] = color;
            stepCell.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            stepCell.classList.add('active');
            
            // Play the sound when adding a step
            this.playSoundForTrack(track.soundType, {
              frequency: 220 + (colorIndex * 110), // Different note for each color
              duration: track.duration || 0.1,
              saturation: 0.5,
              brightness: 0.8,
              volume: track.volume
            });
          }
        });
        
        trackRow.appendChild(stepCell);
      }
      
      // Create dropdown container for track controls
      const trackControlsDropdown = document.createElement('div');
      trackControlsDropdown.className = 'sequencer-track-controls-dropdown';
      
      // Create a toggle button for the dropdown
      const toggleButton = document.createElement('button');
      toggleButton.className = 'sequencer-track-dropdown-toggle';
      toggleButton.innerHTML = '⚙️';
      toggleButton.title = 'Track Controls';
      
      // Create the dropdown content
      const dropdownContent = document.createElement('div');
      dropdownContent.className = 'sequencer-track-dropdown-content';
      dropdownContent.style.display = 'none';
      
      // Duration slider
      const durationControl = document.createElement('div');
      durationControl.className = 'sequencer-control-slider';
      
      const durationLabel = document.createElement('label');
      durationLabel.textContent = 'Duration:';
      durationControl.appendChild(durationLabel);
      
      const durationSlider = document.createElement('input');
      durationSlider.type = 'range';
      durationSlider.min = '0.05';
      durationSlider.max = '0.5';
      durationSlider.step = '0.05';
      durationSlider.value = track.duration || 0.2;
      durationSlider.addEventListener('input', (e) => {
        track.duration = parseFloat(e.target.value);
      });
      
      durationControl.appendChild(durationSlider);
      dropdownContent.appendChild(durationControl);
      
      // Volume slider
      const volumeControl = document.createElement('div');
      volumeControl.className = 'sequencer-volume-control';
      
      const volumeLabel = document.createElement('label');
      volumeLabel.textContent = 'Volume:';
      volumeControl.appendChild(volumeLabel);
      
      const volumeSlider = document.createElement('input');
      volumeSlider.type = 'range';
      volumeSlider.min = '0';
      volumeSlider.max = '1';
      volumeSlider.step = '0.1';
      volumeSlider.value = track.volume;
      volumeSlider.addEventListener('input', (e) => {
        track.volume = parseFloat(e.target.value);
      });
      
      volumeControl.appendChild(volumeSlider);
      dropdownContent.appendChild(volumeControl);
      
      // Mute button
      const muteBtn = document.createElement('button');
      muteBtn.className = 'sequencer-mute-btn';
      muteBtn.textContent = track.muted ? '🔇' : '🔊';
      muteBtn.addEventListener('click', () => {
        track.muted = !track.muted;
        muteBtn.textContent = track.muted ? '🔇' : '🔊';
      });
      dropdownContent.appendChild(muteBtn);
      
      // Delete track button
      const deleteTrackBtn = document.createElement('button');
      deleteTrackBtn.className = 'sequencer-delete-track-btn';
      deleteTrackBtn.textContent = '×';
      deleteTrackBtn.addEventListener('click', () => {
        if (this.tracks.length > 1) {
          this.deleteTrack(trackIndex);
        }
      });
      dropdownContent.appendChild(deleteTrackBtn);
      
      // Toggle dropdown on click
      toggleButton.addEventListener('click', () => {
        dropdownContent.style.display = dropdownContent.style.display === 'none' ? 'block' : 'none';
      });
      
      trackControlsDropdown.appendChild(toggleButton);
      trackControlsDropdown.appendChild(dropdownContent);
      trackRow.appendChild(trackControlsDropdown);
      
      container.appendChild(trackRow);
    });
  }
  
  addTrack() {
    const newTrackIndex = this.tracks.length;
    
    this.tracks.push({
      name: `Track ${newTrackIndex + 1}`,
      soundType: this.availableSoundTypes[newTrackIndex % this.availableSoundTypes.length],
      steps: new Array(this.steps).fill(null),
      muted: false,
      volume: 0.8,
      duration: 0.2
    });
    
    // Refresh the grid
    this.refreshGrid();
  }
  
  deleteTrack(trackIndex) {
    this.tracks.splice(trackIndex, 1);
    this.refreshGrid();
  }
  
  clearSequence() {
    // Reset all steps to null
    this.tracks.forEach(track => {
      track.steps = new Array(this.steps).fill(null);
    });
    
    // Refresh the grid
    this.refreshGrid();
  }
  
  refreshGrid() {
    const sequencerGrid = this.container.querySelector('.sequencer-grid');
    if (sequencerGrid) {
      this.createTrackGrid(sequencerGrid);
    }
  }
  
  togglePlayback() {
    if (this.isPlaying) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }
  
  startPlayback() {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.currentStep = 0;
    
    const playBtn = document.getElementById('sequencer-play');
    if (playBtn) {
      playBtn.innerHTML = '❚❚ Pause';
    }
    
    // Calculate interval in milliseconds based on tempo
    const intervalMs = (60 / this.tempo) * 1000 / 4; // 4 steps per beat
    
    // Start playback
    this.stepInterval = setInterval(() => {
      this.playStep();
      this.currentStep = (this.currentStep + 1) % this.steps;
    }, intervalMs);
    
    // Highlight first step
    this.updateStepHighlight();
  }
  
  stopPlayback() {
    if (!this.isPlaying) return;
    
    this.isPlaying = false;
    clearInterval(this.stepInterval);
    
    const playBtn = document.getElementById('sequencer-play');
    if (playBtn) {
      playBtn.innerHTML = '▶ Play';
    }
    
    // Remove step highlights
    this.clearStepHighlights();
  }
  
  restartPlayback() {
    if (this.isPlaying) {
      clearInterval(this.stepInterval);
      
      // Calculate interval in milliseconds based on tempo
      const intervalMs = (60 / this.tempo) * 1000 / 4; // 4 steps per beat
      
      // Restart interval
      this.stepInterval = setInterval(() => {
        this.playStep();
        this.currentStep = (this.currentStep + 1) % this.steps;
      }, intervalMs);
    }
  }
  
  playStep() {
    // Play sounds for current step
    this.tracks.forEach((track, trackIndex) => {
      // Skip if track is muted or no color at this step
      if (track.muted || track.steps[this.currentStep] === null) return;
      
      // Get the color for this step
      const color = track.steps[this.currentStep];
      
      // Map color to sound parameters
      const brightness = (color[0] + color[1] + color[2]) / (3 * 255);
      
      // Calculate frequency based on brightness (brighter = higher pitch)
      const baseFreq = 220; // A3
      const frequency = baseFreq + (brightness * 880); // Range from A3 to A5
      
      // Use track-specific duration rather than hardcoded values
      const duration = track.duration || 0.2;
      
      // Calculate saturation for effects
      const max = Math.max(color[0], color[1], color[2]) / 255;
      const min = Math.min(color[0], color[1], color[2]) / 255;
      const saturation = max > 0 ? (max - min) / max : 0;
      
      // Play the sound
      this.playSoundForTrack(track.soundType, {
        frequency,
        duration,
        saturation,
        brightness,
        volume: track.volume
      });
      
      // Highlight the step that just played with a flash effect
      const stepCell = document.querySelector(`.sequencer-step[data-track="${trackIndex}"][data-step="${this.currentStep}"]`);
      if (stepCell) {
        stepCell.classList.add('playing');
        
        // Remove the flash effect after the animation completes
        setTimeout(() => {
          stepCell.classList.remove('playing');
        }, 100);
      }
    });
    
    // Update step highlighting
    this.updateStepHighlight();
  }
  
  playSoundForTrack(soundType, params) {
    // Route through bit crusher for LoFi effect
    const sourceNode = this.soundGenerator.audioContext.createGain();
    sourceNode.gain.value = params.volume || 0.8;
    sourceNode.connect(this.effectProcessors.bitCrusher.node);
    
    // Set bit crusher parameters based on saturation
    this.effectProcessors.bitCrusher.setBitDepth(4 + Math.round(params.saturation * 10));
    this.effectProcessors.bitCrusher.setSampleRateReduction(0.5 + params.saturation * 0.5);
    
    // Set vibe parameters
    this.effectProcessors.vibe.setWarmCold(1 - params.brightness);
    this.effectProcessors.vibe.setDryWet(0.7);
    
    // Get current effect settings from main controls if available
    const getMainControlValue = (id) => {
      const element = document.getElementById(id);
      return element ? element.value : null;
    };
    
    // Try to use main control settings if they exist
    const frequency = params.frequency;
    const duration = params.duration; // Use the actual duration parameter passed in
    
    // Copy current settings from main controls to preserve sound character
    const bitDepth = getMainControlValue('bit-depth-slider');
    if (bitDepth !== null) {
      this.effectProcessors.bitCrusher.setBitDepth(parseInt(bitDepth));
    }
    
    const sampleRate = getMainControlValue('sample-rate-slider');
    if (sampleRate !== null) {
      this.effectProcessors.bitCrusher.setSampleRateReduction(parseFloat(sampleRate));
    }
    
    const distAmount = getMainControlValue('distortion-slider');
    if (distAmount !== null) {
      this.effectProcessors.distortion.setAmount(parseInt(distAmount));
    }
    
    const distAlgorithm = getMainControlValue('distortion-algorithm');
    if (distAlgorithm !== null) {
      this.effectProcessors.distortion.setAlgorithm(distAlgorithm);
    }
    
    const warmCold = getMainControlValue('warm-cold-slider');
    if (warmCold !== null) {
      this.effectProcessors.vibe.setWarmCold(parseFloat(warmCold));
    }
    
    const dryWet = getMainControlValue('dry-wet-slider');
    if (dryWet !== null) {
      this.effectProcessors.vibe.setDryWet(parseFloat(dryWet));
    }
    
    // Generate the sound with current settings
    const soundParams = { 
      frequency, 
      duration,
      outputNode: sourceNode
    };
    
    let sound;
    
    switch(soundType) {
      case 'blip':
        sound = this.soundGenerator.generateBlipSound(soundParams);
        break;
      case 'collect':
        sound = this.soundGenerator.generateCollectSound(soundParams);
        break;
      case 'jump':
        sound = this.soundGenerator.generateJumpSound(soundParams);
        break;
      case 'hit':
        sound = this.soundGenerator.generateDamageSound(soundParams);
        break;
      case 'grab':
        sound = this.soundGenerator.generateGrabSound(soundParams);
        break;
      case 'shoot':
        sound = this.soundGenerator.generateShootSound(soundParams);
        break;
      case 'attack':
        sound = this.soundGenerator.generateAttackSound(soundParams);
        break;
      case 'power-up':
        sound = this.soundGenerator.generatePowerupSound(soundParams);
        break;
      case 'zap':
        sound = this.soundGenerator.generateZapSound(soundParams);
        break;
      case 'boom':
        sound = this.soundGenerator.generateBoomSound(soundParams);
        break;
      default:
        sound = this.soundGenerator.generateBlipSound(soundParams);
    }
    
    return sound;
  }
  
  updateStepHighlight() {
    // Clear previous highlight
    this.clearStepHighlights();
    
    // Add highlight to current step
    const stepCells = document.querySelectorAll(`.sequencer-step[data-step="${this.currentStep}"]`);
    stepCells.forEach(cell => {
      cell.classList.add('current');
    });
  }
  
  clearStepHighlights() {
    const highlightedCells = document.querySelectorAll('.sequencer-step.current');
    highlightedCells.forEach(cell => {
      cell.classList.remove('current');
    });
  }
  
  resizePattern(newStepCount) {
    // Resize all tracks to the new step count
    this.tracks.forEach(track => {
      // If expanding, add null steps
      if (newStepCount > this.steps) {
        track.steps = [...track.steps, ...new Array(newStepCount - this.steps).fill(null)];
      } 
      // If contracting, trim steps
      else if (newStepCount < this.steps) {
        track.steps = track.steps.slice(0, newStepCount);
      }
    });
    
    this.steps = newStepCount;
    this.refreshGrid();
  }
  
  exportSequence() {
    return {
      tracks: this.tracks.map(track => ({
        name: track.name,
        soundType: track.soundType,
        steps: track.steps,
        muted: track.muted,
        volume: track.volume
      })),
      tempo: this.tempo,
      steps: this.steps
    };
  }
  
  loadPreset(presetId) {
    let preset;
    
    switch(presetId) {
      case 'basic-beat':
        preset = this.createBasicBeatPreset();
        break;
      case 'funky-groove':
        preset = this.createFunkyGroovePreset();
        break;
      case 'epic-8bit':
        preset = this.createEpic8BitPreset();
        break;
      case 'chiptune':
        preset = this.createChiptunePreset();
        break;
      default:
        return;
    }
    
    if (preset) {
      this.importSequence(preset);
    }
  }
  
  createBasicBeatPreset() {
    // Get colors from current palette
    const palette = this.getPaletteColors();
    
    return {
      tempo: 120,
      steps: 16,
      tracks: [
        {
          name: "Kick",
          soundType: "boom",
          steps: [palette[0], null, null, null, palette[0], null, null, null, 
                  palette[0], null, null, null, palette[0], null, null, null],
          muted: false,
          volume: 0.8,
          duration: 0.2
        },
        {
          name: "Snare",
          soundType: "hit",
          steps: [null, null, palette[1], null, null, null, palette[1], null, 
                  null, null, palette[1], null, null, null, palette[1], palette[1]],
          muted: false,
          volume: 0.7,
          duration: 0.2
        },
        {
          name: "Hi-Hat",
          soundType: "blip",
          steps: [palette[2], null, palette[2], null, palette[2], null, palette[2], null,
                  palette[2], null, palette[2], null, palette[2], null, palette[2], null],
          muted: false,
          volume: 0.5,
          duration: 0.2
        }
      ]
    };
  }
  
  createFunkyGroovePreset() {
    const palette = this.getPaletteColors();
    
    return {
      tempo: 110,
      steps: 16,
      tracks: [
        {
          name: "Kick",
          soundType: "boom",
          steps: [palette[0], null, null, palette[0], null, null, palette[0], null, 
                  null, palette[0], null, null, palette[0], null, null, null],
          muted: false,
          volume: 0.8,
          duration: 0.2
        },
        {
          name: "Clap",
          soundType: "hit",
          steps: [null, null, palette[3], null, null, null, palette[3], null, 
                  null, null, palette[3], null, null, null, palette[3], null],
          muted: false,
          volume: 0.6,
          duration: 0.2
        },
        {
          name: "Melody",
          soundType: "collect",
          steps: [palette[4], null, null, palette[5], null, palette[6], null, palette[5], 
                  palette[4], null, null, palette[5], null, palette[6], null, palette[7]],
          muted: false,
          volume: 0.7,
          duration: 0.2
        }
      ]
    };
  }
  
  createEpic8BitPreset() {
    const palette = this.getPaletteColors();
    
    return {
      tempo: 140,
      steps: 16,
      tracks: [
        {
          name: "Bass",
          soundType: "attack",
          steps: [palette[0], null, null, null, palette[1], null, null, null, 
                  palette[2], null, null, null, palette[3], null, palette[0], null],
          muted: false,
          volume: 0.8,
          duration: 0.2
        },
        {
          name: "Arpeggio",
          soundType: "blip",
          steps: [palette[4], palette[4], palette[5], palette[5], palette[6], palette[6], palette[5], palette[5], 
                  palette[4], palette[4], palette[5], palette[5], palette[6], palette[6], palette[7], palette[7]],
          muted: false,
          volume: 0.5,
          duration: 0.2
        },
        {
          name: "Lead",
          soundType: "power-up",
          steps: [null, null, null, palette[7], null, null, palette[6], null, 
                  null, null, null, palette[5], null, palette[4], null, null],
          muted: false,
          volume: 0.7,
          duration: 0.2
        }
      ]
    };
  }
  
  createChiptunePreset() {
    const palette = this.getPaletteColors();
    
    return {
      tempo: 150,
      steps: 16,
      tracks: [
        {
          name: "Drums",
          soundType: "hit",
          steps: [palette[0], null, palette[0], null, palette[1], null, palette[0], null, 
                  palette[0], null, palette[0], null, palette[1], palette[1], null, null],
          muted: false,
          volume: 0.7,
          duration: 0.2
        },
        {
          name: "Bass",
          soundType: "grab",
          steps: [palette[2], null, null, null, palette[2], null, null, null, 
                  palette[3], null, null, null, palette[3], null, palette[2], null],
          muted: false,
          volume: 0.8,
          duration: 0.2
        },
        {
          name: "Lead",
          soundType: "collect",
          steps: [palette[4], null, palette[5], null, palette[6], null, palette[7], palette[6], 
                  palette[5], null, palette[4], null, palette[5], null, palette[6], null],
          muted: false,
          volume: 0.6,
          duration: 0.2
        },
        {
          name: "FX",
          soundType: "zap",
          steps: [null, null, null, null, null, null, null, null, 
                  null, null, null, null, null, null, palette[7], null],
          muted: false,
          volume: 0.4,
          duration: 0.2
        }
      ]
    };
  }
  
  getPaletteColors() {
    // Try to get colors from artVisualizer
    if (this.artVisualizer && this.artVisualizer.activePalette && 
        this.artVisualizer.activePalette.length > 0) {
      return this.artVisualizer.activePalette;
    }
    
    // Default colors if no palette is available
    return [
      [255, 0, 0], [255, 165, 0], [255, 255, 0], [0, 255, 0],
      [0, 255, 255], [0, 0, 255], [128, 0, 128], [255, 255, 255]
    ];
  }
  
  importSequence(data) {
    if (!data || !data.tracks) return false;
    
    this.tempo = data.tempo || 120;
    this.steps = data.steps || 16;
    this.tracks = data.tracks.map(track => ({
      name: track.name,
      soundType: track.soundType,
      steps: track.steps,
      muted: track.muted || false,
      volume: track.volume || 0.8,
      duration: track.duration || 0.2
    }));
    
    this.refreshGrid();
    
    // Update tempo display
    const tempoValue = document.getElementById('sequencer-tempo-value');
    const tempoSlider = document.getElementById('sequencer-tempo');
    
    if (tempoValue) tempoValue.textContent = `${this.tempo} BPM`;
    if (tempoSlider) tempoSlider.value = this.tempo;
    
    return true;
  }
  
  exportSequenceAudio() {
    if (this.tracks.length === 0) {
      alert('No tracks to export. Please add some patterns first.');
      return;
    }

    // Stop any existing playback
    if (this.isPlaying) {
      this.stopPlayback();
    }
    
    // Calculate total duration based on tempo and steps
    const stepDuration = (60 / this.tempo) * 1000 / 4; // ms per step
    const totalDuration = (stepDuration * this.steps) / 1000 + 0.2; // in seconds, add 0.2 seconds buffer
    
    // Create an offline audio context to render the sequence
    const offlineCtx = new OfflineAudioContext(
      2, // stereo
      Math.ceil(this.soundGenerator.audioContext.sampleRate * totalDuration), 
      this.soundGenerator.audioContext.sampleRate
    );
    
    // Create effects for the offline context
    const bitCrusher = new BitCrusher(offlineCtx);
    const distortion = new Distortion(offlineCtx);
    const vibe = new Vibe(offlineCtx);
    
    // Copy current effect settings
    bitCrusher.setBitDepth(this.effectProcessors.bitCrusher.bitDepth);
    bitCrusher.setSampleRateReduction(this.effectProcessors.bitCrusher.sampleRateReduction);
    
    distortion.setAmount(this.effectProcessors.distortion.amount);
    distortion.setAlgorithm(this.effectProcessors.distortion.algorithm);
    
    vibe.setWarmCold(this.effectProcessors.vibe.warmColdValue || 0.5);
    vibe.setDryWet(this.effectProcessors.vibe.dryWetValue || 0.5);
    
    // Connect effects
    bitCrusher.connect(distortion.input());
    distortion.connect(vibe.input());
    vibe.connect(offlineCtx.destination);
    
    // Create sound generator for offline context
    const generator = new SoundGenerator(offlineCtx);
    
    // Schedule all sounds
    let currentTime = 0;
    const stepTimeInSeconds = stepDuration / 1000;
    
    // Play through each step
    for (let step = 0; step < this.steps; step++) {
      // For each track at this step
      this.tracks.forEach(track => {
        // Skip if track is muted or has no sound at this step
        if (track.muted || track.steps[step] === null) return;
        
        // Get color for this step and map to audio parameters
        const color = track.steps[step];
        const brightness = (color[0] + color[1] + color[2]) / (3 * 255);
        const baseFreq = 220; // A3
        const frequency = baseFreq + (brightness * 880);
        
        // Use track-specific duration instead of isPercussive check
        const duration = track.duration || 0.2;
        
        // Calculate saturation for effects
        const max = Math.max(color[0], color[1], color[2]) / 255;
        const min = Math.min(color[0], color[1], color[2]) / 255;
        const saturation = max > 0 ? (max - min) / max : 0;
        
        // Create a gain node for track volume
        const trackGain = offlineCtx.createGain();
        trackGain.gain.value = track.volume;
        trackGain.connect(bitCrusher.node);
        
        // Schedule the sound at the current step time
        const params = {
          frequency,
          duration,
          outputNode: trackGain,
          startTime: currentTime  // Add explicit start time
        };
        
        // Create the sound based on track type
        switch(track.soundType) {
          case 'blip':
            generator.generateBlipSound(params);
            break;
          case 'collect':
            generator.generateCollectSound(params);
            break;
          case 'jump':
            generator.generateJumpSound(params);
            break;
          case 'hit':
            generator.generateDamageSound(params);
            break;
          case 'grab':
            generator.generateGrabSound(params);
            break;
          case 'shoot':
            generator.generateShootSound(params);
            break;
          case 'attack':
            generator.generateAttackSound(params);
            break;
          case 'power-up':
            generator.generatePowerupSound(params);
            break;
          case 'zap':
            generator.generateZapSound(params);
            break;
          case 'boom':
            generator.generateBoomSound(params);
            break;
          default:
            generator.generateBlipSound(params);
        }
      });
      
      // Move to next step time
      currentTime += stepTimeInSeconds;
    }
    
    // Start rendering
    offlineCtx.startRendering().then(renderedBuffer => {
      // Convert the rendered buffer to WAV format
      const wavData = this.bufferToWav(renderedBuffer);
      
      // Create a download link
      const blob = new Blob([wavData], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pixel-sequencer-${Date.now()}.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      alert('Pattern exported as WAV audio file!');
    }).catch(err => {
      console.error('Error rendering audio:', err);
      alert('Failed to export audio. Please try again.');
    });
  }
  
  // Helper function to convert AudioBuffer to WAV format
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
}