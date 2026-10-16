/**
 * AUDIO ENGINE - Web Audio API & HTML5 Audio Core
 * Implements 5-band EQ, Stereo Panner, Analyser, A-B Loop, Speed/Pitch, and Event Dispatching.
 */

export const EQ_FREQUENCIES = [60, 250, 1000, 4000, 12000];

export const EQ_PRESETS = {
  FLAT: [0, 0, 0, 0, 0],
  BASS_BOOST: [7, 4, 0, -1, 1],
  TECHNO_PUNCH: [6, 2, -2, 3, 5],
  BRUTAL_CRUNCH: [8, 5, 2, 4, 7],
  VOCAL_CLARITY: [-3, -1, 4, 5, 2],
  LO_FI_TAPE: [4, 1, 3, -4, -8]
};

export class AudioEngine {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';

    this.audioContext = null;
    this.sourceNode = null;
    this.gainNode = null;
    this.pannerNode = null;
    this.analyserNode = null;
    this.eqFilters = [];

    this.loopPointA = null;
    this.loopPointB = null;
    this.isAbLoopActive = false;

    this.listeners = {
      timeupdate: [],
      ended: [],
      play: [],
      pause: [],
      loadedmetadata: [],
      error: []
    };

    this._bindAudioEvents();
  }

  _ensureAudioContext() {
    if (this.audioContext) {
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('Web Audio API not supported on this browser.');
      return;
    }

    this.audioContext = new AudioContextClass();

    try {
      this.sourceNode = this.audioContext.createMediaElementSource(this.audio);
    } catch (e) {
      console.warn('Could not create media element source:', e);
      return;
    }

    // Create 5-band EQ
    this.eqFilters = EQ_FREQUENCIES.map((freq, idx) => {
      const filter = this.audioContext.createBiquadFilter();
      if (idx === 0) {
        filter.type = 'lowshelf';
      } else if (idx === EQ_FREQUENCIES.length - 1) {
        filter.type = 'highshelf';
      } else {
        filter.type = 'peaking';
        filter.Q.value = 1.0;
      }
      filter.frequency.value = freq;
      filter.gain.value = 0;
      return filter;
    });

    // Create Stereo Panner
    if (this.audioContext.createStereoPanner) {
      this.pannerNode = this.audioContext.createStereoPanner();
    }

    // Create Master Gain
    this.gainNode = this.audioContext.createGain();

    // Create FFT Analyser
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.8;

    // Connect node graph: Source -> EQ1 -> EQ2 -> EQ3 -> EQ4 -> EQ5 -> Panner -> Gain -> Analyser -> Destination
    let lastNode = this.sourceNode;
    this.eqFilters.forEach((filter) => {
      lastNode.connect(filter);
      lastNode = filter;
    });

    if (this.pannerNode) {
      lastNode.connect(this.pannerNode);
      lastNode = this.pannerNode;
    }

    lastNode.connect(this.gainNode);
    this.gainNode.connect(this.analyserNode);
    this.analyserNode.connect(this.audioContext.destination);
  }

  _bindAudioEvents() {
    this.audio.addEventListener('timeupdate', () => {
      if (this.isAbLoopActive && this.loopPointB !== null && this.loopPointA !== null) {
        if (this.audio.currentTime >= this.loopPointB) {
          this.audio.currentTime = this.loopPointA;
        }
      }
      this._emit('timeupdate', {
        currentTime: this.audio.currentTime,
        duration: this.audio.duration || 0
      });
    });

    this.audio.addEventListener('ended', () => this._emit('ended'));
    this.audio.addEventListener('play', () => this._emit('play'));
    this.audio.addEventListener('pause', () => this._emit('pause'));
    this.audio.addEventListener('loadedmetadata', () => {
      this._emit('loadedmetadata', {
        duration: this.audio.duration || 0,
        sampleRate: this.audioContext?.sampleRate || 44100
      });
    });
    this.audio.addEventListener('error', (event) => {
      const mediaErr = this.audio.error;
      const errorDetail = {
        code: mediaErr ? mediaErr.code : 0,
        message: mediaErr ? mediaErr.message : 'Unknown audio error',
        source: this.audio.src
      };
      console.warn('AudioEngine error detail:', errorDetail);
      this._emit('error', errorDetail);
    });
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  _emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((cb) => cb(data));
    }
  }

  async load(src) {
    this._ensureAudioContext();
    if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
      this.audio.crossOrigin = 'anonymous';
    } else {
      this.audio.removeAttribute('crossorigin');
    }
    this.audio.src = src;
    this.audio.load();

    return new Promise((resolve) => {
      if (this.audio.readyState >= 1 && Number.isFinite(this.audio.duration) && this.audio.duration > 0) {
        resolve({ duration: this.audio.duration });
        return;
      }
      const onMeta = () => {
        cleanup();
        resolve({ duration: this.audio.duration || 0 });
      };
      const onErr = () => {
        cleanup();
        resolve({ duration: 0 });
      };
      const timer = setTimeout(() => {
        cleanup();
        resolve({ duration: this.audio.duration || 0 });
      }, 1500);
      const cleanup = () => {
        clearTimeout(timer);
        this.audio.removeEventListener('loadedmetadata', onMeta);
        this.audio.removeEventListener('error', onErr);
      };
      this.audio.addEventListener('loadedmetadata', onMeta);
      this.audio.addEventListener('error', onErr);
    });
  }

  async play() {
    this._ensureAudioContext();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    return this.audio.play();
  }

  pause() {
    this.audio.pause();
  }

  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  seek(seconds) {
    if (!isNaN(seconds) && isFinite(seconds)) {
      const dur = (Number.isFinite(this.audio.duration) && this.audio.duration > 0) ? this.audio.duration : seconds;
      this.audio.currentTime = Math.max(0, Math.min(seconds, dur));
    }
  }

  setVolume(val) {
    const clamped = Math.max(0, Math.min(1, val));
    this.audio.volume = clamped;
  }

  getVolume() {
    return this.audio.volume;
  }

  setMuted(muted) {
    this.audio.muted = !!muted;
  }

  isMuted() {
    return this.audio.muted;
  }

  setPlaybackRate(rate) {
    this.audio.playbackRate = Math.max(0.25, Math.min(3.0, rate));
  }

  getPlaybackRate() {
    return this.audio.playbackRate;
  }

  setPan(val) {
    if (this.pannerNode) {
      this.pannerNode.pan.value = Math.max(-1, Math.min(1, val));
    }
  }

  setEqBandGain(bandIndex, gainDb) {
    if (this.eqFilters[bandIndex]) {
      this.eqFilters[bandIndex].gain.value = Math.max(-15, Math.min(15, gainDb));
    }
  }

  applyEqPreset(presetName) {
    const preset = EQ_PRESETS[presetName] || EQ_PRESETS.FLAT;
    preset.forEach((gain, idx) => {
      this.setEqBandGain(idx, gain);
    });
    return preset;
  }

  setLoopA(time = null) {
    this.loopPointA = time !== null ? time : this.audio.currentTime;
    if (this.loopPointB !== null && this.loopPointA > this.loopPointB) {
      this.loopPointB = null;
    }
    this.isAbLoopActive = this.loopPointA !== null && this.loopPointB !== null;
    return { a: this.loopPointA, b: this.loopPointB, active: this.isAbLoopActive };
  }

  setLoopB(time = null) {
    this.loopPointB = time !== null ? time : this.audio.currentTime;
    if (this.loopPointA !== null && this.loopPointB < this.loopPointA) {
      this.loopPointB = this.loopPointA + 1;
    }
    this.isAbLoopActive = this.loopPointA !== null && this.loopPointB !== null;
    return { a: this.loopPointA, b: this.loopPointB, active: this.isAbLoopActive };
  }

  clearAbLoop() {
    this.loopPointA = null;
    this.loopPointB = null;
    this.isAbLoopActive = false;
  }

  getFrequencyData() {
    if (!this.analyserNode) return null;
    const buffer = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(buffer);
    return buffer;
  }

  getTimeDomainData() {
    if (!this.analyserNode) return null;
    const buffer = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteTimeDomainData(buffer);
    return buffer;
  }

  getTechnicalInfo() {
    return {
      sampleRate: this.audioContext?.sampleRate || 44100,
      state: this.audioContext?.state || 'inactive',
      playbackRate: this.audio.playbackRate,
      volume: Math.round(this.audio.volume * 100),
      duration: this.audio.duration || 0,
      currentTime: this.audio.currentTime || 0,
      paused: this.audio.paused,
      muted: this.audio.muted
    };
  }
}
