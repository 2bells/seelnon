export class SoundFineTuner {
  constructor(artVisualizer) {
    this.artVisualizer = artVisualizer;
    this.isVisible = false;
    this.container = null;
    
    // Update default ranges and enabled states
    this.ranges = {
      brightness: {
        frequency: { min: 100, max: 2000, enabled: true },
        bitDepth: { min: 1, max: 16, enabled: false },
        sampleRate: { min: 0.1, max: 1.0, enabled: false },
        distAmount: { min: 1, max: 100, enabled: false },
        distAlgorithm: { options: ['soft', 'hard', 'sine', 'cubic'], enabled: false },
        warmCold: { min: 0, max: 1, enabled: false },
        dryWet: { min: 0, max: 1, enabled: false }
      },
      saturation: {
        frequency: { min: 100, max: 2000, enabled: false },
        bitDepth: { min: 1, max: 16, enabled: true },
        sampleRate: { min: 0.1, max: 1.0, enabled: false },
        distAmount: { min: 1, max: 100, enabled: false },
        distAlgorithm: { options: ['soft', 'hard', 'sine', 'cubic'], enabled: false },
        warmCold: { min: 0, max: 1, enabled: false },
        dryWet: { min: 0, max: 1, enabled: false }
      },
      hue: {
        frequency: { min: 100, max: 2000, enabled: false },
        bitDepth: { min: 1, max: 16, enabled: false },
        sampleRate: { min: 0.1, max: 1.0, enabled: true },
        distAmount: { min: 1, max: 100, enabled: false },
        distAlgorithm: { options: ['soft', 'hard', 'sine', 'cubic'], enabled: false },
        warmCold: { min: 0, max: 1, enabled: false },
        dryWet: { min: 0, max: 1, enabled: false }
      },
      edges: {
        frequency: { min: 100, max: 2000, enabled: false },
        bitDepth: { min: 1, max: 16, enabled: false },
        sampleRate: { min: 0.1, max: 1.0, enabled: false },
        distAmount: { min: 1, max: 100, enabled: false },
        distAlgorithm: { options: ['soft', 'hard', 'sine', 'cubic'], enabled: false },
        warmCold: { min: 0, max: 1, enabled: false },
        dryWet: { min: 0, max: 1, enabled: true }
      }
    };
  }
  
  createUI() {
    // Create the fine-tune toggle
    const fineTuneToggle = document.createElement('div');
    fineTuneToggle.className = 'finetune-toggle';
    fineTuneToggle.textContent = 'Fine Tune';
    fineTuneToggle.id = 'finetune-toggle';
    fineTuneToggle.style.borderRadius = '0 5px 5px 0'; 
    document.getElementById('sound-container').appendChild(fineTuneToggle);
    
    // Create the fine-tune panel
    this.container = document.createElement('div');
    this.container.className = 'finetune-panel';
    this.container.id = 'finetune-panel';
    
    const closeButton = document.createElement('button');
    closeButton.className = 'finetune-close';
    closeButton.innerHTML = '&times;';
    closeButton.id = 'finetune-close';
    this.container.appendChild(closeButton);
    
    const title = document.createElement('h3');
    title.textContent = 'Fine Tune Controls';
    this.container.appendChild(title);
    
    const pixelAttributes = ['brightness', 'saturation', 'hue', 'edges'];
    const parameterGroups = [
      { name: 'frequency', label: 'Frequency', type: 'range' },
      { name: 'bitDepth', label: 'Bit Depth', type: 'range' },
      { name: 'sampleRate', label: 'Sample Rate', type: 'range' },
      { name: 'distAmount', label: 'Distortion Amount', type: 'range' },
      { name: 'distAlgorithm', label: 'Distortion Algorithm', type: 'select' },
      { name: 'warmCold', label: 'Warm/Cold', type: 'range' },
      { name: 'dryWet', label: 'Dry/Wet', type: 'range' }
    ];
    
    for (const attr of pixelAttributes) {
      const section = document.createElement('div');
      section.className = 'finetune-section';
      
      const sectionTitle = document.createElement('h4');
      sectionTitle.textContent = `${attr.charAt(0).toUpperCase() + attr.slice(1)} Mapping`;
      section.appendChild(sectionTitle);
      
      for (const param of parameterGroups) {
        const range = this.ranges[attr][param.name];
        if (!range) continue;
        
        const controlRow = document.createElement('div');
        controlRow.className = 'finetune-control-row';
        
        const enableCheck = document.createElement('input');
        enableCheck.type = 'checkbox';
        enableCheck.id = `enable-${attr}-${param.name}`;
        enableCheck.checked = range.enabled;
        
        const enableLabel = document.createElement('label');
        enableLabel.htmlFor = `enable-${attr}-${param.name}`;
        enableLabel.textContent = param.label;
        
        controlRow.appendChild(enableCheck);
        controlRow.appendChild(enableLabel);
        
        if (param.type === 'range') {
          const minControl = document.createElement('div');
          minControl.className = 'finetune-range-control';
          
          const minLabel = document.createElement('span');
          minLabel.textContent = 'Min:';
          minControl.appendChild(minLabel);
          
          const minInput = document.createElement('input');
          minInput.type = 'number';
          minInput.id = `min-${attr}-${param.name}`;
          minInput.value = range.min;
          minInput.step = param.name === 'sampleRate' ? '0.01' : '1';
          minInput.className = 'finetune-number-input';
          minControl.appendChild(minInput);
          
          const maxControl = document.createElement('div');
          maxControl.className = 'finetune-range-control';
          
          const maxLabel = document.createElement('span');
          maxLabel.textContent = 'Max:';
          maxControl.appendChild(maxLabel);
          
          const maxInput = document.createElement('input');
          maxInput.type = 'number';
          maxInput.id = `max-${attr}-${param.name}`;
          maxInput.value = range.max;
          maxInput.step = param.name === 'sampleRate' ? '0.01' : '1';
          maxInput.className = 'finetune-number-input';
          maxControl.appendChild(maxInput);
          
          controlRow.appendChild(minControl);
          controlRow.appendChild(maxControl);
        } else if (param.type === 'select' && range.options) {
          const infoText = document.createElement('span');
          infoText.textContent = '(Auto-selects algorithm)';
          infoText.className = 'finetune-info-text';
          controlRow.appendChild(infoText);
        }
        
        section.appendChild(controlRow);
      }
      
      this.container.appendChild(section);
    }
    
    const applyButton = document.createElement('button');
    applyButton.className = 'finetune-apply-btn';
    applyButton.textContent = 'Apply Settings';
    applyButton.id = 'finetune-apply-btn';
    this.container.appendChild(applyButton);
    
    document.getElementById('sound-container').appendChild(this.container);
    
    this.bindEvents();
  }
  
  bindEvents() {
    const toggle = document.getElementById('finetune-toggle');
    const closeBtn = document.getElementById('finetune-close');
    const applyBtn = document.getElementById('finetune-apply-btn');
    
    toggle.addEventListener('click', () => {
      this.togglePanel(true);
    });
    
    closeBtn.addEventListener('click', () => {
      this.togglePanel(false);
    });
    
    applyBtn.addEventListener('click', () => {
      this.applySettings();
    });
    
    const pixelAttributes = ['brightness', 'saturation', 'hue', 'edges'];
    const parameterNames = ['frequency', 'bitDepth', 'sampleRate', 'distAmount', 'distAlgorithm', 'warmCold', 'dryWet'];
    
    for (const attr of pixelAttributes) {
      for (const param of parameterNames) {
        const checkbox = document.getElementById(`enable-${attr}-${param}`);
        if (checkbox) {
          checkbox.addEventListener('change', (e) => {
            if (this.ranges[attr] && this.ranges[attr][param]) {
              this.ranges[attr][param].enabled = e.target.checked;
            }
          });
        }
      }
    }
  }
  
  togglePanel(show) {
    this.isVisible = show !== undefined ? show : !this.isVisible;
    const panel = document.getElementById('finetune-panel');
    const toggle = document.getElementById('finetune-toggle');
    
    if (this.isVisible) {
      panel.classList.add('active');
      toggle.style.left = '300px';
    } else {
      panel.classList.remove('active');
      toggle.style.left = '0';
    }
  }
  
  applySettings() {
    const pixelAttributes = ['brightness', 'saturation', 'hue', 'edges'];
    const parameterNames = ['frequency', 'bitDepth', 'sampleRate', 'distAmount', 'distAlgorithm', 'warmCold', 'dryWet'];
    
    for (const attr of pixelAttributes) {
      for (const param of parameterNames) {
        const range = this.ranges[attr][param];
        if (!range) continue;
        
        const enableCheckbox = document.getElementById(`enable-${attr}-${param}`);
        if (enableCheckbox) {
          range.enabled = enableCheckbox.checked;
        }
        
        if (param !== 'distAlgorithm') {
          const minInput = document.getElementById(`min-${attr}-${param}`);
          const maxInput = document.getElementById(`max-${attr}-${param}`);
          
          if (minInput && maxInput) {
            range.min = parseFloat(minInput.value);
            range.max = parseFloat(maxInput.value);
          }
        }
      }
    }
    
    if (this.artVisualizer) {
      this.artVisualizer.updateMappingSettings(this.ranges);
      
      this.syncWithPixelMappingDropdowns();

    }
  }
  
  syncWithPixelMappingDropdowns() {
    const pixelAttributes = ['brightness', 'saturation', 'hue', 'edges'];
    
    for (const attr of pixelAttributes) {
      const enabledParams = [];
      
      for (const paramName in this.ranges[attr]) {
        if (this.ranges[attr][paramName] && this.ranges[attr][paramName].enabled) {
          enabledParams.push(paramName);
        }
      }
      
      const dropdown = document.getElementById(`map-${attr}`);
      if (dropdown && enabledParams.length > 0) {
        dropdown.value = enabledParams[0];
      }
    }
  }
  
  updateFromMappingSelection(pixelAttr, effectParam) {
    for (const paramName in this.ranges[pixelAttr]) {
      if (this.ranges[pixelAttr][paramName]) {
        this.ranges[pixelAttr][paramName].enabled = false;
        
        const checkbox = document.getElementById(`enable-${pixelAttr}-${paramName}`);
        if (checkbox) {
          checkbox.checked = false;
        }
      }
    }
    
    if (effectParam !== 'none' && this.ranges[pixelAttr][effectParam]) {
      this.ranges[pixelAttr][effectParam].enabled = true;
      
      const checkbox = document.getElementById(`enable-${pixelAttr}-${effectParam}`);
      if (checkbox) {
        checkbox.checked = true;
      }
    }
  }
  
  getMappingRanges() {
    return this.ranges;
  }
  
  mapValue(pixelProperty, paramName, value) {
    const range = this.ranges[pixelProperty][paramName];
    if (!range || !range.enabled) return null;
    
    if (paramName === 'distAlgorithm') {
      const index = Math.floor(value * range.options.length);
      return range.options[Math.min(index, range.options.length - 1)];
    } else {
      return range.min + value * (range.max - range.min);
    }
  }
}