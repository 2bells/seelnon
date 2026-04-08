export class Distortion {
  constructor(audioContext) {
    this.audioContext = audioContext;
    
    // Create a waveshaper distortion node
    this.distortionNode = this.audioContext.createWaveShaper();
    this.distortionNode.oversample = '4x'; // Reduce aliasing
    
    // Create a gain node to control the amount of distortion
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 1.0;
    
    // Update default amount
    this.amount = 10;
    this.algorithm = 'sine'; // Default to sine algorithm
    this.updateCurve();
    
    // Connect the internal nodes
    this.gainNode.connect(this.distortionNode);
  }
  
  updateCurve() {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    
    for (let i = 0; i < samples; ++i) {
      const x = (i * 2) / samples - 1;
      
      // Different distortion algorithms
      switch (this.algorithm) {
        case 'soft':
          // Soft clipping (smooth distortion)
          curve[i] = Math.tanh(this.amount * x);
          break;
          
        case 'hard':
          // Hard clipping (brutal distortion)
          curve[i] = x < 0 
            ? -Math.min(1, Math.abs(x) * this.amount) 
            : Math.min(1, x * this.amount);
          break;
          
        case 'sine':
          // Sine-based distortion (interesting harmonics)
          curve[i] = Math.sin(x * this.amount * deg);
          break;
          
        default:
          // Default to cubic distortion
          curve[i] = (3 + this.amount) * x * 20 * deg / (Math.PI + this.amount * Math.abs(x));
      }
    }
    
    this.distortionNode.curve = curve;
  }
  
  setAmount(value) {
    // 1 = subtle, 100 = extreme
    this.amount = Math.max(1, Math.min(100, value));
    this.updateCurve();
    return this;
  }
  
  setAlgorithm(type) {
    // Different distortion types
    if (['soft', 'hard', 'sine', 'cubic'].includes(type)) {
      this.algorithm = type;
      this.updateCurve();
    }
    return this;
  }
  
  setDrive(value) {
    // Controls the input gain
    this.gainNode.gain.value = Math.max(1, Math.min(10, value));
    return this;
  }
  
  connect(destination) {
    this.distortionNode.connect(destination);
    return this;
  }
  
  disconnect() {
    this.distortionNode.disconnect();
    return this;
  }
  
  input() {
    return this.gainNode;
  }
}