export class Vibe {
  constructor(audioContext) {
    this.audioContext = audioContext;
    
    // Create the filter nodes
    this.lowpassFilter = this.audioContext.createBiquadFilter();
    this.lowpassFilter.type = 'lowpass';
    this.lowpassFilter.frequency.value = 2000; // Default value
    
    this.highpassFilter = this.audioContext.createBiquadFilter();
    this.highpassFilter.type = 'highpass';
    this.highpassFilter.frequency.value = 100; // Default value
    
    // Create gain nodes for wet/dry mix
    this.dryGain = this.audioContext.createGain();
    this.wetGain = this.audioContext.createGain();
    this.outputGain = this.audioContext.createGain();
    
    // Default values
    this.dryGain.gain.value = 0.5;
    this.wetGain.gain.value = 0.5;
    this.warmColdValue = 0.5;
    
    // Connect the nodes
    this.highpassFilter.connect(this.lowpassFilter);
    this.lowpassFilter.connect(this.wetGain);
    this.dryGain.connect(this.outputGain);
    this.wetGain.connect(this.outputGain);
  }
  
  setWarmCold(value) {
    // 0 = cold (more highpass, higher frequencies)
    // 1 = warm (more lowpass, lower frequencies)
    this.warmColdValue = Math.max(0, Math.min(1, value));
    
    // Adjust the filters based on warm/cold value
    // Cold settings emphasize higher frequencies (higher lowpass cutoff)
    // Warm settings emphasize lower frequencies (lower lowpass cutoff)
    const lowpassFreq = 500 + (1 - this.warmColdValue) * 7500; // Range: 500Hz - 8000Hz
    const highpassFreq = 20 + this.warmColdValue * 480; // Range: 20Hz - 500Hz
    
    this.lowpassFilter.frequency.setValueAtTime(lowpassFreq, this.audioContext.currentTime);
    this.highpassFilter.frequency.setValueAtTime(highpassFreq, this.audioContext.currentTime);
    
    return this;
  }
  
  setDryWet(value) {
    // 0 = dry (direct sound, no filtering)
    // 1 = wet (filtered sound only)
    const dryWetValue = Math.max(0, Math.min(1, value));
    
    this.dryGain.gain.setValueAtTime(1 - dryWetValue, this.audioContext.currentTime);
    this.wetGain.gain.setValueAtTime(dryWetValue, this.audioContext.currentTime);
    
    return this;
  }
  
  connect(destination) {
    this.outputGain.connect(destination);
    return this;
  }
  
  disconnect() {
    this.outputGain.disconnect();
    return this;
  }
  
  input() {
    // For direct signal (dry)
    const inputSplitter = this.audioContext.createGain();
    inputSplitter.connect(this.dryGain);
    inputSplitter.connect(this.highpassFilter);
    return inputSplitter;
  }
}