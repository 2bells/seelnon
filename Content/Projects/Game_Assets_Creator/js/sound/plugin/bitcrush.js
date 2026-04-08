export class BitCrusher {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.node = this.createBitCrusherNode();
    this.bitDepth = 8;
    this.sampleRateReduction = 0.5;
  }
  
  createBitCrusherNode() {
    // Create a ScriptProcessorNode (deprecated but widely supported)
    // In production, you'd use AudioWorkletNode instead
    const bufferSize = 4096;
    const node = this.audioContext.createScriptProcessor(
      bufferSize, // Buffer size
      2,          // Number of input channels
      2           // Number of output channels
    );
    
    // Use class properties to make them accessible from onaudioprocess
    let phaser = 0;
    
    node.onaudioprocess = (event) => {
      const inputL = event.inputBuffer.getChannelData(0);
      const inputR = event.inputBuffer.getChannelData(1);
      const outputL = event.outputBuffer.getChannelData(0);
      const outputR = event.outputBuffer.getChannelData(1);
      
      const step = Math.pow(0.5, this.bitDepth);
      
      for (let i = 0; i < inputL.length; i++) {
        // Sample rate reduction
        phaser += this.sampleRateReduction;
        if (phaser >= 1.0) {
          phaser -= 1.0;
          
          // Bit reduction (quantization)
          outputL[i] = Math.floor(inputL[i] / step) * step;
          outputR[i] = Math.floor(inputR[i] / step) * step;
        } else {
          // Hold previous sample
          outputL[i] = (i > 0) ? outputL[i - 1] : 0;
          outputR[i] = (i > 0) ? outputR[i - 1] : 0;
        }
      }
    };
    
    return node;
  }
  
  connect(destination) {
    this.node.connect(destination);
    return this;
  }
  
  disconnect() {
    this.node.disconnect();
    return this;
  }
  
  setBitDepth(value) {
    // Valid range: 1-16 bits
    this.bitDepth = Math.max(1, Math.min(16, value));
    return this;
  }
  
  setSampleRateReduction(value) {
    // Valid range: 0.01-1.0 
    // 1.0 = no reduction, 0.5 = half sample rate, 0.01 = 1% of original sample rate
    this.sampleRateReduction = Math.max(0.01, Math.min(1, value));
    return this;
  }
}