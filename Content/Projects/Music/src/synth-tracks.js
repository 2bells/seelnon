/**
 * SYNTH TRACKS GENERATOR & BUILT-IN DEMO MANIFEST
 * Generates offline Web Audio WAV blobs with full metadata, brutalist cover art, and LRC lyrics.
 * Ensures the player is immediately playable out of the box with zero external dependencies.
 */

// Generate brutalist SVG cover art data URIs with Fri-Ren / Altus Gold theme
function createBrutalistCoverSvg(title, artist, color = '#c8a96e', bg = '#151310') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360" width="600" height="360">
    <rect width="600" height="360" fill="${bg}" />
    <!-- Ancient Coordinates Grid -->
    <defs>
      <pattern id="brutGrid" width="28" height="28" patternUnits="userSpaceOnUse">
        <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#262017" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="600" height="360" fill="url(#brutGrid)" />
    <!-- Fine technical borders and nodes (from Img 1 & 3) -->
    <rect x="24" y="24" width="552" height="312" fill="none" stroke="#3b3226" stroke-width="2" />
    <rect x="40" y="40" width="160" height="110" fill="#1b1814" stroke="${color}" stroke-width="2" />
    <text x="54" y="80" fill="${color}" font-family="monospace" font-weight="800" font-size="12" letter-spacing="1">NODE // CH-01</text>
    <text x="54" y="105" fill="#82735e" font-family="monospace" font-size="10">COORDINATES: 48.2N</text>
    <line x1="200" y1="95" x2="280" y2="95" stroke="${color}" stroke-width="1.5" />
    
    <rect x="280" y="55" width="260" height="80" fill="#1b1814" stroke="#4ea8d8" stroke-width="1.5" />
    <text x="296" y="90" fill="#4ea8d8" font-family="monospace" font-weight="700" font-size="12">PROTOCOL: ALTUS HARMONICS</text>
    <text x="296" y="112" fill="#82735e" font-family="monospace" font-size="10">STATUS: ACTIVE CARRIER</text>
    
    <line x1="120" y1="150" x2="120" y2="210" stroke="#3b3226" stroke-width="1.5" />
    <circle cx="120" cy="210" r="4" fill="${color}" />

    <!-- Headline plate -->
    <rect x="24" y="240" width="552" height="96" fill="#1a1713" stroke="#3b3226" stroke-width="1" />
    <text x="44" y="278" fill="#c8a96e" font-family="monospace" font-weight="900" font-size="22" letter-spacing="2">${title.toUpperCase()}</text>
    <text x="44" y="308" fill="#dfcfaf" font-family="monospace" font-weight="700" font-size="13" letter-spacing="1">${artist.toUpperCase()}</text>
    <text x="500" y="308" fill="#82735e" font-family="monospace" font-size="11">REV 4.0</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Convert AudioBuffer to WAV Blob
function audioBufferToWavBlob(buffer) {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels = [];
  let sampleRate = buffer.sampleRate;
  let offset = 0;
  let pos = 0;

  function setUint16(data) {
    out.setUint16(pos, data, true);
    pos += 2;
  }
  function setUint32(data) {
    out.setUint32(pos, data, true);
    pos += 4;
  }

  // RIFF identifier
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  // FMT sub-chunk
  setUint32(0x20746d66); // "fmt "
  setUint32(16); // subchunk1size (16 for PCM)
  setUint16(1); // audio format (1 = PCM)
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan); // byte rate
  setUint16(numOfChan * 2); // block align
  setUint16(16); // bits per sample

  // data sub-chunk
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4); // chunk length

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (offset < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out.buffer], { type: 'audio/wav' });
}

/**
 * Procedurally generates a brutalist audio track using Web Audio OfflineAudioContext
 */
export async function renderSynthAudio(type = 'techno', durationSec = 32) {
  const sampleRate = 44100;
  const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
    2,
    sampleRate * durationSec,
    sampleRate
  );

  const bpm = type === 'ambient' ? 88 : type === 'glitch' ? 140 : 132;
  const secondsPerBeat = 60 / bpm;
  const totalBeats = Math.floor(durationSec / secondsPerBeat);

  // Master bus
  const masterComp = offlineCtx.createDynamicsCompressor();
  masterComp.threshold.value = -12;
  masterComp.knee.value = 10;
  masterComp.ratio.value = 8;
  masterComp.attack.value = 0.005;
  masterComp.release.value = 0.1;
  masterComp.connect(offlineCtx.destination);

  // KICK DRUM
  for (let beat = 0; beat < totalBeats; beat++) {
    // 4-on-the-floor for techno / glitch; halftime for ambient
    if (type === 'ambient' && beat % 2 !== 0) continue;

    const t = beat * secondsPerBeat;
    const osc = offlineCtx.createOscillator();
    const gain = offlineCtx.createGain();

    osc.frequency.setValueAtTime(type === 'glitch' ? 160 : 130, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.12);

    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(masterComp);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  // HI-HATS / NOISE
  const hatStep = secondsPerBeat / 2;
  const hatCount = Math.floor(durationSec / hatStep);

  // Noise buffer for hats & claps
  const noiseBufferSize = sampleRate * 0.1;
  const noiseBuffer = offlineCtx.createBuffer(1, noiseBufferSize, sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseBufferSize; i++) {
    noiseData[i] = Math.random() * 2 - 1;
  }

  for (let h = 0; h < hatCount; h++) {
    const t = h * hatStep;
    if (type === 'techno' && h % 2 === 1) {
      // Offbeat open/closed hat
      const noiseSource = offlineCtx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const filter = offlineCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 7500;

      const gain = offlineCtx.createGain();
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(masterComp);

      noiseSource.start(t);
      noiseSource.stop(t + 0.09);
    }
  }

  // BASSLINE SYNTH
  const bassNotes = type === 'ambient'
    ? [55, 55, 65.4, 49] // A1, C2, G1
    : type === 'glitch'
    ? [65.4, 65.4, 73.4, 82.4, 61.7, 65.4] // C2, D2, E2, B1
    : [87.3, 87.3, 98.0, 87.3, 116.5, 103.8]; // F2, G2, Bb2, Ab2

  const bassStep = secondsPerBeat / 2;
  const bassCount = Math.floor(durationSec / bassStep);

  for (let b = 0; b < bassCount; b++) {
    const t = b * bassStep;
    const noteFreq = bassNotes[b % bassNotes.length];

    const osc = offlineCtx.createOscillator();
    osc.type = type === 'glitch' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(noteFreq, t);

    // Filter
    const filter = offlineCtx.createBiquadFilter();
    filter.type = 'lowpass';
    const cutoff = 250 + Math.sin(b * 0.3) * 200;
    filter.frequency.setValueAtTime(cutoff, t);
    filter.Q.value = 4.0;

    const gain = offlineCtx.createGain();
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.02, t + bassStep * 0.9);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterComp);

    osc.start(t);
    osc.stop(t + bassStep);
  }

  // RENDER AUDIO BUFFER
  const renderedBuffer = await offlineCtx.startRendering();
  const wavBlob = audioBufferToWavBlob(renderedBuffer);
  return {
    blob: wavBlob,
    url: URL.createObjectURL(wavBlob)
  };
}

/**
 * Default Built-In Brutalist Demo Tracks
 */
export const DEFAULT_DEMO_TRACKS = [
  {
    id: 'demo-01',
    title: 'CONCRETE MONOLITH',
    artist: 'RAW SECTOR 09',
    album: 'INDUSTRIAL ARTIFACTS',
    year: '2026',
    genre: 'Industrial Techno',
    trackNumber: '01',
    bpm: 132,
    duration: 32,
    audioUrl: null, // Generated at boot
    synthType: 'techno',
    coverUrl: createBrutalistCoverSvg('CONCRETE MONOLITH', 'RAW SECTOR 09', '#c8a96e', '#151310'),
    format: 'WAV 44.1kHz / 16-BIT',
    fileSize: 5644844,
    dateAdded: Date.now() - 300000,
    isFavorite: true,
    comments: 'Constructed from heavy synthesized resonant kick pulses, 132 BPM master clock, and brutalist sub-bass architecture.',
    lyrics: `[00:00.00] RAW SECTOR 09 // INITIALIZING MONOLITH
[00:02.00] Concrete walls vibrating at 132 BPM
[00:05.50] Steel reinforcements absorb the low-end pressure
[00:09.00] >> FREQUENCY MODULATION ENGAGED <<
[00:12.80] Sub-bass transmission pulses through the foundation
[00:16.50] Unfiltered harmonics cutting the industrial night
[00:20.00] Static in the signal line, purely mechanical
[00:24.20] Architectural soundwaves in direct confrontation
[00:28.00] SYSTEM STABILIZED. RESUME SEQUENCE.`
  },
  {
    id: 'demo-02',
    title: 'SUB-BASS PROTOCOL',
    artist: 'NEO CONSTRUCT',
    album: 'BRUTAL VOID EXPANSE',
    year: '2025',
    genre: 'Dark Ambient / Drone',
    trackNumber: '02',
    bpm: 88,
    duration: 32,
    audioUrl: null,
    synthType: 'ambient',
    coverUrl: createBrutalistCoverSvg('SUB-BASS PROTOCOL', 'NEO CONSTRUCT', '#7da564', '#151310'),
    format: 'WAV 44.1kHz / 16-BIT',
    fileSize: 5644844,
    dateAdded: Date.now() - 200000,
    isFavorite: false,
    comments: 'Deep tectonic drone oscillations designed for low-frequency sound system calibration and spatial resonance testing.',
    lyrics: `[00:00.00] CALIBRATION SEQUENCE: PROTOCOL 49HZ
[00:04.00] Zero ambient light. Pure magnetic field.
[00:08.50] Resonance detected in auxiliary channels.
[00:13.20] >> OSCILLATOR DRIFT: WITHIN TOLERANCE <<
[00:18.00] Deep tectonic drone sustaining through the core
[00:22.50] No compression. No harmonic compromises.
[00:27.00] Echoes decay into the brutalist chamber.`
  },
  {
    id: 'demo-03',
    title: 'NEO-CYBER STATIC',
    artist: 'UNIT 808-X',
    album: 'GLITCHED TELEMETRY',
    year: '2026',
    genre: 'EBM / Glitch Synth',
    trackNumber: '03',
    bpm: 140,
    duration: 32,
    audioUrl: null,
    synthType: 'glitch',
    coverUrl: createBrutalistCoverSvg('NEO-CYBER STATIC', 'UNIT 808-X', '#c85252', '#151310'),
    format: 'WAV 44.1kHz / 16-BIT',
    fileSize: 5644844,
    dateAdded: Date.now() - 100000,
    isFavorite: true,
    comments: 'Fast rhythmic glitch telemetry synthesized at 140 BPM with square-wave modulation and digital noise spikes.',
    lyrics: `[00:00.00] UNIT 808-X ONLINE // 140 BPM
[00:03.20] Glitched packets across the fiber circuit
[00:06.80] Square-wave attack on channel 1 and 2
[00:10.50] >> DIGITAL OVERLOAD OVERRIDE <<
[00:14.00] Telemetry pulses synced to the master clock
[00:17.50] Noise spikes registered at +3dB threshold
[00:21.00] High velocity byte stream decoded
[00:25.00] FINAL SEQUENCE COMPLETE.`
  }
];
