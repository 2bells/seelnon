export class SoundGenerator {
  constructor(audioContext) {
    this.audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    this.masterGainNode = this.audioContext.createGain();
    this.masterGainNode.gain.value = 0.5; // Default volume at 50%
    this.masterGainNode.connect(this.audioContext.destination);
    this.currentBuffer = null;
  }

  setVolume(value) {
    this.masterGainNode.gain.value = value;
  }

  getVolume() {
    return this.masterGainNode.gain.value;
  }

  createOscillator(type, frequency, duration) {
    const oscillator = this.audioContext.createOscillator();
    oscillator.type = type; // 'sine', 'square', 'sawtooth', 'triangle'
    oscillator.frequency.value = frequency;
    
    const envelope = this.audioContext.createGain();
    envelope.gain.value = 0;
    
    // We'll set the envelope values when the oscillator is started with a specific start time
    oscillator.connect(envelope);
    
    // Store these parameters to be used when the oscillator is started
    oscillator.envelopeParams = {
      duration: duration
    };
    
    // Override the default start method to handle envelope timing
    const originalStart = oscillator.start;
    oscillator.start = function(startTime = 0) {
      envelope.gain.setValueAtTime(0, startTime);
      envelope.gain.linearRampToValueAtTime(1, startTime + 0.01);
      envelope.gain.linearRampToValueAtTime(0, startTime + this.envelopeParams.duration);
      originalStart.call(this, startTime);
    };
    
    return { oscillator, envelope };
  }

  createNoise(duration) {
    const bufferSize = this.audioContext.sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;
    
    const envelope = this.audioContext.createGain();
    envelope.gain.value = 0;
    
    noise.connect(envelope);
    
    // Override the default start method to handle envelope timing
    const originalStart = noise.start;
    noise.start = function(startTime = 0) {
      envelope.gain.setValueAtTime(0, startTime);
      envelope.gain.linearRampToValueAtTime(1, startTime + 0.01);
      envelope.gain.linearRampToValueAtTime(0, startTime + duration);
      originalStart.call(this, startTime);
    };
    
    return { noise, envelope };
  }

  generateJumpSound(params = {}) {
    const frequency = params.frequency || 300;
    const duration = params.duration || 0.3;
    const sweep = params.sweep || 700;
    const outputNode = params.outputNode || this.masterGainNode;
    const startTime = params.startTime !== undefined ? params.startTime : this.audioContext.currentTime;
    
    const { oscillator, envelope } = this.createOscillator('square', frequency, duration);
    
    // Jump sound typically has an upward frequency sweep
    oscillator.frequency.linearRampToValueAtTime(
      frequency + sweep, 
      startTime + duration * 0.8
    );
    
    envelope.connect(outputNode);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
    
    return { oscillator, envelope };
  }

  generateAttackSound(params = {}) {
    const frequency = params.frequency || 150;
    const duration = params.duration || 0.15;
    const outputNode = params.outputNode || this.masterGainNode;
    const startTime = params.startTime !== undefined ? params.startTime : this.audioContext.currentTime;
    
    // Create primary oscillator (mid-range)
    const { oscillator: mainOsc, envelope: mainEnv } = this.createOscillator('sawtooth', frequency, duration);
    
    // Create secondary oscillator (higher pitch)
    const { oscillator: subOsc, envelope: subEnv } = this.createOscillator('square', frequency * 2, duration * 0.7);
    
    // Create noise burst
    const { noise, envelope: noiseEnv } = this.createNoise(duration * 0.5);
    
    // Connect all sources
    mainEnv.connect(outputNode);
    subEnv.connect(outputNode);
    noiseEnv.connect(outputNode);
    
    // Start and stop with specified start time
    mainOsc.start(startTime);
    subOsc.start(startTime);
    noise.start(startTime);
    
    mainOsc.stop(startTime + duration);
    subOsc.stop(startTime + duration * 0.7);
    noise.stop(startTime + duration * 0.5);
    
    return { mainOsc, subOsc, noise };
  }

  generateCollectSound(params = {}) {
    const baseFrequency = params.frequency || 600;
    const duration = params.duration || 0.2;
    const outputNode = params.outputNode || this.masterGainNode;
    const startTime = params.startTime !== undefined ? params.startTime : this.audioContext.currentTime;
    
    // Two ascending notes in sequence
    const { oscillator: osc1, envelope: env1 } = this.createOscillator('sine', baseFrequency, duration * 0.5);
    const { oscillator: osc2, envelope: env2 } = this.createOscillator('sine', baseFrequency * 1.5, duration * 0.5);
    
    // Schedule the second note to start after the first
    osc2.start(startTime + duration * 0.4);
    env2.gain.setValueAtTime(0, startTime + duration * 0.4);
    env2.gain.linearRampToValueAtTime(1, startTime + duration * 0.45);
    env2.gain.linearRampToValueAtTime(0, startTime + duration);
    
    // Connect and start
    env1.connect(outputNode);
    env2.connect(outputNode);
    
    osc1.start(startTime);
    osc1.stop(startTime + duration * 0.5);
    osc2.stop(startTime + duration);
    
    return { osc1, osc2 };
  }

  generateDamageSound(params = {}) {
    const frequency = params.frequency || 150;
    const duration = params.duration || 0.3;
    const outputNode = params.outputNode || this.masterGainNode;
    const startTime = params.startTime !== undefined ? params.startTime : this.audioContext.currentTime;
    
    // Noise component for "hit" effect
    const { noise, envelope: noiseEnv } = this.createNoise(duration);
    
    // Low oscillator for "thud" effect
    const { oscillator, envelope } = this.createOscillator('square', frequency, duration);
    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.frequency.linearRampToValueAtTime(frequency * 0.7, startTime + duration);
    
    // Connect all to master
    noiseEnv.connect(outputNode);
    envelope.connect(outputNode);
    
    // Start and stop
    noise.start(startTime);
    oscillator.start(startTime);
    
    noise.stop(startTime + duration);
    oscillator.stop(startTime + duration);
    
    return { noise, oscillator };
  }

  generatePowerupSound(params = {}) {
    const startFreq = params.frequency || 300;
    const duration = params.duration || 0.6;
    const outputNode = params.outputNode || this.masterGainNode;
    const startTime = params.startTime !== undefined ? params.startTime : this.audioContext.currentTime;
    
    // Create a sequence of ascending notes
    const noteCount = 3;
    const noteDuration = duration / noteCount;
    const oscillators = [];
    
    for (let i = 0; i < noteCount; i++) {
      // Calculate frequency using equal temperament 
      const freq = startFreq * Math.pow(1.2, i);
      const { oscillator, envelope } = this.createOscillator('square', freq, noteDuration);
      
      // Schedule the note to start at the right time
      const noteStartTime = startTime + (i * noteDuration);
      oscillator.start(noteStartTime);
      oscillator.stop(noteStartTime + noteDuration);
      
      envelope.gain.setValueAtTime(0, noteStartTime);
      envelope.gain.linearRampToValueAtTime(1, noteStartTime + 0.01);
      envelope.gain.linearRampToValueAtTime(0, noteStartTime + noteDuration);
      
      envelope.connect(outputNode);
      oscillators.push(oscillator);
    }
    
    return { oscillators };
  }

  generateZapSound(params = {}) {
    const frequency = params.frequency || 800;
    const duration = params.duration || 0.15;
    const outputNode = params.outputNode || this.masterGainNode;
    const startTime = params.startTime !== undefined ? params.startTime : this.audioContext.currentTime;
    
    // Create main oscillator with a high starting frequency that drops
    const { oscillator, envelope } = this.createOscillator('sawtooth', frequency, duration);
    
    // Dramatic frequency drop for zap effect
    oscillator.frequency.exponentialRampToValueAtTime(
      frequency / 4, 
      startTime + duration * 0.9
    );
    
    // Create noise component for sizzle
    const { noise, envelope: noiseEnv } = this.createNoise(duration * 0.7);
    
    // Connect to output
    envelope.connect(outputNode);
    noiseEnv.connect(outputNode);
    
    // Start and stop
    oscillator.start(startTime);
    noise.start(startTime);
    
    oscillator.stop(startTime + duration);
    noise.stop(startTime + duration * 0.7);
    
    return { oscillator, noise };
  }

  generateBoomSound(params = {}) {
    const frequency = params.frequency || 120;
    const duration = params.duration || 0.5;
    const outputNode = params.outputNode || this.masterGainNode;
    const startTime = params.startTime !== undefined ? params.startTime : this.audioContext.currentTime;
    
    // Low frequency oscillator for the boom
    const { oscillator, envelope } = this.createOscillator('sine', frequency, duration);
    
    // Create noise burst for explosion
    const { noise, envelope: noiseEnv } = this.createNoise(duration * 0.8);
    
    // Shape the envelope for a punchy attack and longer decay
    envelope.gain.cancelScheduledValues(startTime);
    envelope.gain.setValueAtTime(0, startTime);
    envelope.gain.linearRampToValueAtTime(1, startTime + 0.005);
    envelope.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    noiseEnv.gain.cancelScheduledValues(startTime);
    noiseEnv.gain.setValueAtTime(0, startTime);
    noiseEnv.gain.linearRampToValueAtTime(1, startTime + 0.005);
    noiseEnv.gain.exponentialRampToValueAtTime(0.01, startTime + duration * 0.8);
    
    // Add a rapid frequency drop for the boom effect
    oscillator.frequency.setValueAtTime(frequency * 1.5, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.5, startTime + duration * 0.3);
    
    // Connect to output
    envelope.connect(outputNode);
    noiseEnv.connect(outputNode);
    
    // Start and stop
    oscillator.start(startTime);
    noise.start(startTime);
    
    oscillator.stop(startTime + duration);
    noise.stop(startTime + duration * 0.8);
    
    return { oscillator, noise };
  }

  generateLoseSound(params = {}) {
    const baseFrequency = params.frequency || 400;
    const duration = params.duration || 0.7;
    const outputNode = params.outputNode || this.masterGainNode;
    const startTime = params.startTime !== undefined ? params.startTime : this.audioContext.currentTime;
    
    // Create three descending notes for the sad "wah wah wah" effect
    const note1Freq = baseFrequency;
    const note2Freq = baseFrequency * 0.8;
    const note3Freq = baseFrequency * 0.65;
    
    const noteDuration = duration / 3;
    
    // Create the three notes
    const { oscillator: osc1, envelope: env1 } = this.createOscillator('sine', note1Freq, noteDuration);
    const { oscillator: osc2, envelope: env2 } = this.createOscillator('sine', note2Freq, noteDuration);
    const { oscillator: osc3, envelope: env3 } = this.createOscillator('sine', note3Freq, noteDuration);
    
    // Schedule note timings
    osc1.start(startTime);
    osc1.stop(startTime + noteDuration);
    
    osc2.start(startTime + noteDuration);
    osc2.stop(startTime + (noteDuration * 2));
    
    osc3.start(startTime + (noteDuration * 2));
    osc3.stop(startTime + duration);
    
    // Set envelopes for each note
    env2.gain.setValueAtTime(0, startTime + noteDuration);
    env2.gain.linearRampToValueAtTime(1, startTime + noteDuration + 0.01);
    env2.gain.linearRampToValueAtTime(0, startTime + (noteDuration * 2));
    
    env3.gain.setValueAtTime(0, startTime + (noteDuration * 2));
    env3.gain.linearRampToValueAtTime(1, startTime + (noteDuration * 2) + 0.01);
    env3.gain.linearRampToValueAtTime(0, startTime + duration);
    
    // Connect to output
    env1.connect(outputNode);
    env2.connect(outputNode);
    env3.connect(outputNode);
    
    return { osc1, osc2, osc3 };
  }

  generateBlipSound(params = {}) {
    const frequency = params.frequency || 700;
    const duration = params.duration || 0.05;
    const outputNode = params.outputNode || this.masterGainNode;
    const startTime = params.startTime !== undefined ? params.startTime : this.audioContext.currentTime;
    
    // Create a simple short pulse tone
    const { oscillator, envelope } = this.createOscillator('sine', frequency, duration);
    
    // Very quick attack and decay
    envelope.gain.cancelScheduledValues(startTime);
    envelope.gain.setValueAtTime(0, startTime);
    envelope.gain.linearRampToValueAtTime(1, startTime + 0.005);
    envelope.gain.linearRampToValueAtTime(0, startTime + duration);
    
    // Connect to output
    envelope.connect(outputNode);
    
    // Start and stop
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
    
    return { oscillator };
  }

  generateShootSound(params = {}) {
    const frequency = params.frequency || 350;
    const duration = params.duration || 0.2;
    const outputNode = params.outputNode || this.masterGainNode;
    const startTime = params.startTime !== undefined ? params.startTime : this.audioContext.currentTime;
    
    // Noise component for "whoosh"
    const { noise, envelope: noiseEnv } = this.createNoise(duration);
    
    // Primary tone that decreases in pitch 
    const { oscillator, envelope } = this.createOscillator('sawtooth', frequency, duration);
    
    // Add a rapid frequency drop
    oscillator.frequency.setValueAtTime(frequency * 1.2, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.8, startTime + duration);
    
    // Shape the envelopes
    envelope.gain.cancelScheduledValues(startTime);
    envelope.gain.setValueAtTime(0, startTime);
    envelope.gain.linearRampToValueAtTime(1, startTime + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    noiseEnv.gain.cancelScheduledValues(startTime);
    noiseEnv.gain.setValueAtTime(0, startTime);
    noiseEnv.gain.linearRampToValueAtTime(0.8, startTime + 0.01);
    noiseEnv.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    // Connect to output
    envelope.connect(outputNode);
    noiseEnv.connect(outputNode);
    
    // Start and stop
    oscillator.start(startTime);
    noise.start(startTime);
    
    oscillator.stop(startTime + duration);
    noise.stop(startTime + duration);
    
    return { oscillator, noise };
  }

  generateWinSound(params = {}) {
    const baseFrequency = params.frequency || 440;
    const duration = params.duration || 0.8;
    const outputNode = params.outputNode || this.masterGainNode;
    const startTime = params.startTime !== undefined ? params.startTime : this.audioContext.currentTime;
    
    // Create a happy fanfare with 5 ascending notes
    const noteCount = 5;
    const noteDuration = duration / noteCount;
    const oscillators = [];
    
    // Scale degrees for a happy victory melody (major scale intervals)
    const intervals = [0, 2, 4, 7, 12]; // C, D, E, G, C (one octave up)
    
    for (let i = 0; i < noteCount; i++) {
      // Calculate frequency using equal temperament 
      const freq = baseFrequency * Math.pow(2, intervals[i] / 12);
      const { oscillator, envelope } = this.createOscillator('triangle', freq, noteDuration);
      
      // Schedule the note to start at the right time
      const noteStartTime = startTime + (i * noteDuration);
      oscillator.start(noteStartTime);
      oscillator.stop(noteStartTime + noteDuration * 0.9); // Small gap between notes
      
      envelope.gain.setValueAtTime(0, noteStartTime);
      envelope.gain.linearRampToValueAtTime(1, noteStartTime + 0.01);
      envelope.gain.linearRampToValueAtTime(0, noteStartTime + noteDuration * 0.9);
      
      envelope.connect(outputNode);
      oscillators.push(oscillator);
    }
    
    return { oscillators };
  }

  generateGrabSound(params = {}) {
    const frequency = params.frequency || 250;
    const duration = params.duration || 0.15;
    const outputNode = params.outputNode || this.masterGainNode;
    const startTime = params.startTime !== undefined ? params.startTime : this.audioContext.currentTime;
    
    // Create a quick upward sweep with a "pluck" characteristic 
    const { oscillator, envelope } = this.createOscillator('triangle', frequency, duration);
    
    // Add a small frequency rise for the "grab" feeling
    oscillator.frequency.setValueAtTime(frequency * 0.9, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.1, startTime + duration);
    
    // Create a quick noise burst for texture
    const { noise, envelope: noiseEnv } = this.createNoise(duration * 0.5);
    
    // Shape the envelopes for a quick attack and decay (plucky feel)
    envelope.gain.cancelScheduledValues(startTime);
    envelope.gain.setValueAtTime(0, startTime);
    envelope.gain.linearRampToValueAtTime(1, startTime + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    noiseEnv.gain.cancelScheduledValues(startTime);
    noiseEnv.gain.setValueAtTime(0, startTime);
    noiseEnv.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
    noiseEnv.gain.exponentialRampToValueAtTime(0.01, startTime + duration * 0.5);
    
    // Connect to output
    envelope.connect(outputNode);
    noiseEnv.connect(outputNode);
    
    // Start and stop
    oscillator.start(startTime);
    noise.start(startTime);
    
    oscillator.stop(startTime + duration);
    noise.stop(startTime + duration * 0.5);
    
    return { oscillator, noise };
  }

  analyzePixelData(imageData, width, height) {
    // Extract color information for audio parameters
    let dominantFrequency = 0;
    let totalBrightness = 0;
    let totalSaturation = 0;
    let pixelCount = 0;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = imageData[idx];
        const g = imageData[idx + 1];
        const b = imageData[idx + 2];
        const a = imageData[idx + 3];
        
        if (a > 0) {
          // Skip transparent pixels
          pixelCount++;
          
          // Calculate brightness (0-255)
          const brightness = (r + g + b) / 3;
          totalBrightness += brightness;
          
          // Calculate rough saturation
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max > 0 ? (max - min) / max : 0;
          totalSaturation += saturation;
          
          // Use red channel to influence frequency
          dominantFrequency += r;
        }
      }
    }
    
    // Normalize values
    const avgBrightness = pixelCount > 0 ? totalBrightness / pixelCount : 128;
    const avgSaturation = pixelCount > 0 ? totalSaturation / pixelCount : 0.5;
    const baseFrequency = pixelCount > 0 ? 200 + (dominantFrequency / pixelCount) : 440;
    
    return {
      frequency: baseFrequency,
      duration: 0.2 + (avgBrightness / 255) * 0.4, // 0.2 to 0.6 seconds
      intensity: avgSaturation,
      complexity: pixelCount / (width * height)
    };
  }

  renderAudioToBuffer(duration) {
    const sampleRate = this.audioContext.sampleRate;
    const buffer = this.audioContext.createBuffer(
      2, // stereo
      sampleRate * duration,
      sampleRate
    );
    
    // To be implemented for exporting audio
    return buffer;
  }
  
  convertBufferToWav(buffer) {
    // Implementation for WAV export
    // This would convert the AudioBuffer to a WAV file format
    // To be implemented
    return new Blob();
  }
}