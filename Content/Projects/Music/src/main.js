/**
 * BRUTAL // AUDIO - MAIN APPLICATION CONTROLLER
 * Zero-dependency, pure JavaScript architecture orchestrating
 * Web Audio Engine, ID3 Parser, Lyrics Engine, Storage, and Dynamic Playlists.
 */

import { AudioEngine, EQ_FREQUENCIES, EQ_PRESETS } from './audio-engine.js';
import { AudioVisualizer } from './visualizer.js';
import { parseAudioMetadata } from './id3-parser.js';
import { parseLyrics, getActiveCueIndex, formatTime } from './lyrics-parser.js';
import { PlaylistManager } from './playlist-manager.js';
import { DEFAULT_DEMO_TRACKS, renderSynthAudio } from './synth-tracks.js';
import {
  initStorage,
  getAllTracks,
  saveTrack,
  saveTracks,
  deleteTrack,
  clearAllTracks,
  saveAppState,
  getAppState
} from './storage.js';

// Global Instances
let audioEngine;
let visualizer;
let playlist;
let activeLyricsCues = [];
let lastActiveLyricIdx = -1;
let tapeCounterInterval = null;

// DOM Elements cache
const dom = {};

function initDomElements() {
  dom.app = document.getElementById('app');
  dom.canvas = document.getElementById('visualizer-canvas');
  dom.visModeBtn = document.getElementById('vis-mode-toggle');
  dom.tapeCounter = document.getElementById('tape-counter');
  dom.cacheStatus = document.getElementById('cache-status');

  // Master Deck Left
  dom.coverImg = document.getElementById('deck-cover-img');
  dom.coverPlaceholder = document.getElementById('deck-cover-placeholder');
  dom.tapeHub = document.getElementById('tape-hub');
  dom.nowTitle = document.getElementById('now-title');
  dom.nowArtist = document.getElementById('now-artist');
  dom.nowAlbum = document.getElementById('now-album');
  dom.nowGenreBadge = document.getElementById('now-genre-badge');
  dom.nowBpmBadge = document.getElementById('now-bpm-badge');
  dom.nowFormatBadge = document.getElementById('now-format-badge');

  // Scrub & Transport
  dom.seekSlider = document.getElementById('seek-slider');
  dom.currentTimeDisplay = document.getElementById('current-time-display');
  dom.durationDisplay = document.getElementById('duration-display');
  dom.btnPlay = document.getElementById('btn-play');
  dom.btnPrev = document.getElementById('btn-prev');
  dom.btnNext = document.getElementById('btn-next');
  dom.btnStop = document.getElementById('btn-stop');
  dom.btnShuffle = document.getElementById('btn-shuffle');
  dom.btnRepeat = document.getElementById('btn-repeat');
  dom.btnMute = document.getElementById('btn-mute');
  dom.btnSpeed = document.getElementById('btn-speed');

  // Controls Matrix
  dom.volumeSlider = document.getElementById('volume-slider');
  dom.volumeVal = document.getElementById('volume-val');
  dom.panSlider = document.getElementById('pan-slider');
  dom.panVal = document.getElementById('pan-val');

  // A-B Loop
  dom.btnLoopA = document.getElementById('btn-loop-a');
  dom.btnLoopB = document.getElementById('btn-loop-b');
  dom.btnLoopClear = document.getElementById('btn-loop-clear');
  dom.loopStatus = document.getElementById('loop-status');

  // Tab Navigation & Panels
  dom.tabButtons = document.querySelectorAll('.tab-btn');
  dom.tabPanels = document.querySelectorAll('.tab-content-panel');

  // Playlist Browser
  dom.filterChips = document.querySelectorAll('.filter-chip');
  dom.dynamicSubBar = document.getElementById('dynamic-sub-bar');
  dom.searchInput = document.getElementById('playlist-search');
  dom.sortSelect = document.getElementById('playlist-sort');
  dom.trackListEl = document.getElementById('track-list-body');
  dom.trackCountDisplay = document.getElementById('track-count-badge');

  // Lyrics Teleprompter
  dom.lyricsContainer = document.getElementById('lyrics-teleprompter');
  dom.lyricsTrackTitle = document.getElementById('lyrics-track-title');
  dom.lyricsStatus = document.getElementById('lyrics-status');

  // Extended Info
  dom.metaGrid = document.getElementById('meta-inspector-grid');

  // Equalizer
  dom.eqSliders = document.querySelectorAll('.eq-slider-vertical');
  dom.eqGainDisplays = document.querySelectorAll('.eq-gain-display');
  dom.eqPresetBtns = document.querySelectorAll('.eq-preset-btn');

  // Modals & Triggers
  dom.btnOpenJsonModal = document.getElementById('btn-open-json-modal');
  dom.btnOpenImportModal = document.getElementById('btn-open-import-modal');
  dom.btnExportJson = document.getElementById('btn-export-json');
  dom.btnClearCache = document.getElementById('btn-clear-cache');

  // JSON Modal
  dom.modalJson = document.getElementById('modal-json');
  dom.btnCloseJsonModal = document.getElementById('btn-close-json-modal');
  dom.jsonUrlInput = document.getElementById('json-url-input');
  dom.btnFetchJsonUrl = document.getElementById('btn-fetch-json-url');
  dom.jsonFileInput = document.getElementById('json-file-input');
  dom.jsonPasteArea = document.getElementById('json-paste-area');
  dom.btnApplyJsonPaste = document.getElementById('btn-apply-json-paste');
  dom.btnLoadDemoJson = document.getElementById('btn-load-demo-json');

  // Import Modal
  dom.modalImport = document.getElementById('modal-import');
  dom.btnCloseImportModal = document.getElementById('btn-close-import-modal');
  dom.dropzone = document.getElementById('main-dropzone');
  dom.filePickerInput = document.getElementById('file-picker-input');

  // Toast
  dom.toast = document.getElementById('brutal-toast');
}

/**
 * Toast Notification Helper
 */
function showToast(message, duration = 3000) {
  if (!dom.toast) return;
  dom.toast.textContent = message;
  dom.toast.style.display = 'block';
  setTimeout(() => {
    dom.toast.style.display = 'none';
  }, duration);
}

/**
 * Setup Application
 */
export async function bootApp() {
  initDomElements();

  audioEngine = new AudioEngine();
  visualizer = new AudioVisualizer(dom.canvas, audioEngine);
  playlist = new PlaylistManager();

  // Storage initialization
  await initStorage();
  updateCacheStatusBadge();

  // Setup Event Listeners
  bindPlayerEvents();
  bindTransportControls();
  bindPlaylistUI();
  bindEqualizer();
  bindModalsAndImports();

  // Load Tracks from Cache or Fallback to procedural Synth Tracks
  await loadInitialTracks();

  // Restore previous volume / mute state
  const savedVol = await getAppState('volume', 0.85);
  audioEngine.setVolume(savedVol);
  if (dom.volumeSlider) dom.volumeSlider.value = savedVol * 100;
  if (dom.volumeVal) dom.volumeVal.textContent = `${Math.round(savedVol * 100)}%`;

  // Start visualizer loop
  visualizer.start();

  // Update clock & counter
  startSystemClock();

  showToast('BRUTAL // AUDIO READY. ZERO DEPENDENCY LOADED.');
}

/**
 * Loads tracks from IndexedDB or initial synthesized brutalist demos
 */
async function loadInitialTracks() {
  try {
    const cached = await getAllTracks();
    if (cached && cached.length > 0) {
      // Re-hydrate any blob audio URLs
      for (const t of cached) {
        if (t.audioBlob) {
          t.audioUrl = URL.createObjectURL(t.audioBlob);
        }
        if (t.coverBlob) {
          t.coverUrl = URL.createObjectURL(t.coverBlob);
        }
      }
      playlist.setTracks(cached);
      showToast(`RESTORED ${cached.length} TRACKS FROM PERSISTENT CACHE`);
    } else {
      // Boot default demo tracks
      showToast('SYNTHESIZING BRUTALIST AUDIO ARTIFACTS...');
      const demos = [...DEFAULT_DEMO_TRACKS];

      for (const d of demos) {
        if (!d.audioUrl && d.synthType) {
          d.audioUrl = await renderSynthAudio(d.synthType, d.duration);
        }
      }
      playlist.setTracks(demos);
      await saveTracks(demos);
      showToast('DEMO PLAYLIST ONLINE // READY');
    }

    renderPlaylist();
    updateSubFilters();

    // Auto-select first track
    const first = playlist.getCurrentTrack();
    if (first) {
      loadTrackIntoDeck(first, false);
    }
  } catch (err) {
    console.error('Error loading initial tracks:', err);
    showToast('INITIALIZATION ERROR: CHECK CONSOLE');
  }
}

/**
 * Load Track into Playback Deck
 */
async function loadTrackIntoDeck(track, autoPlay = true) {
  if (!track) return;

  // Render Track Cover
  if (track.coverUrl) {
    dom.coverImg.src = track.coverUrl;
    dom.coverImg.style.display = 'block';
    dom.coverPlaceholder.style.display = 'none';
  } else {
    dom.coverImg.style.display = 'none';
    dom.coverPlaceholder.style.display = 'flex';
  }

  // Render Metadata Headlines
  dom.nowTitle.textContent = track.title || 'UNTITLED AUDIO';
  dom.nowArtist.textContent = track.artist || 'UNKNOWN ARTIST';
  dom.nowAlbum.textContent = track.album ? `[${track.album}]` : '';
  dom.nowGenreBadge.textContent = (track.genre || 'RAW AUDIO').toUpperCase();
  dom.nowBpmBadge.textContent = track.bpm ? `${track.bpm} BPM` : 'VAR BPM';
  dom.nowFormatBadge.textContent = (track.format || 'AUDIO/WAV').toUpperCase();

  // Reset Seek Bar
  dom.seekSlider.value = 0;
  dom.currentTimeDisplay.textContent = '00:00';
  dom.durationDisplay.textContent = formatTime(track.duration || 0);

  // Parse and Load Lyrics
  activeLyricsCues = parseLyrics(track.lyrics);
  lastActiveLyricIdx = -1;
  renderLyrics(activeLyricsCues, track.title);

  // Render Extended Technical Inspector
  renderExtendedInfo(track);

  // Clear existing A-B loop for new track
  audioEngine.clearAbLoop();
  updateAbLoopUI();

  // Load into AudioEngine
  if (track.audioUrl) {
    try {
      await audioEngine.load(track.audioUrl);
      if (autoPlay) {
        await audioEngine.play();
        setPlaybackUiState(true);
      }
    } catch (err) {
      console.warn('Playback error for track:', err);
      showToast(`AUDIO PLAYBACK FAILED: ${err.message || 'FORMAT ERROR'}`);
    }
  } else {
    showToast('NO AUDIO SOURCE FOUND FOR THIS TRACK');
  }

  // Highlight in table
  renderPlaylistHighlight();
  saveAppState('lastTrackId', track.id);
}

/**
 * Bind AudioEngine events
 */
function bindPlayerEvents() {
  audioEngine.on('play', () => {
    setPlaybackUiState(true);
  });

  audioEngine.on('pause', () => {
    setPlaybackUiState(false);
  });

  audioEngine.on('ended', () => {
    const next = playlist.nextTrack();
    if (next) {
      loadTrackIntoDeck(next, true);
    } else {
      setPlaybackUiState(false);
    }
  });

  audioEngine.on('timeupdate', ({ currentTime, duration }) => {
    // Update seek bar
    if (!dom.seekSlider.matches(':active')) {
      dom.seekSlider.value = duration > 0 ? (currentTime / duration) * 100 : 0;
    }
    dom.currentTimeDisplay.textContent = formatTime(currentTime);
    dom.durationDisplay.textContent = formatTime(duration);

    // Update tape counter
    if (dom.tapeCounter) {
      const frames = Math.floor((currentTime % 1) * 30);
      dom.tapeCounter.textContent = `${formatTime(currentTime)}:${frames.toString().padStart(2, '0')}`;
    }

    // Synchronize lyrics teleprompter
    syncLyrics(currentTime);
  });

  audioEngine.on('loadedmetadata', ({ duration }) => {
    dom.durationDisplay.textContent = formatTime(duration);
    const curr = playlist.getCurrentTrack();
    if (curr && (!curr.duration || curr.duration === 0)) {
      curr.duration = duration;
      saveTrack(curr);
    }
  });

  audioEngine.on('error', (e) => {
    console.error('Audio engine error:', e);
    setPlaybackUiState(false);
  });
}

function setPlaybackUiState(isPlaying) {
  if (isPlaying) {
    dom.btnPlay.textContent = 'PAUSE ||';
    dom.btnPlay.classList.add('brutal-btn-gold');
    if (dom.tapeHub) dom.tapeHub.classList.add('spinning');
  } else {
    dom.btnPlay.textContent = 'PLAY ▶';
    dom.btnPlay.classList.remove('brutal-btn-gold');
    if (dom.tapeHub) dom.tapeHub.classList.remove('spinning');
  }
}

/**
 * Bind Transport & Audio Controls
 */
function bindTransportControls() {
  // Play / Pause Toggle
  dom.btnPlay.addEventListener('click', async () => {
    const curr = playlist.getCurrentTrack();
    if (!curr) return;

    if (audioEngine.audio.paused) {
      try {
        await audioEngine.play();
      } catch (err) {
        console.warn('Playback error:', err);
      }
    } else {
      audioEngine.pause();
    }
  });

  // Stop
  dom.btnStop.addEventListener('click', () => {
    audioEngine.stop();
    setPlaybackUiState(false);
    dom.seekSlider.value = 0;
    dom.currentTimeDisplay.textContent = '00:00';
  });

  // Next & Prev
  dom.btnNext.addEventListener('click', () => {
    const next = playlist.nextTrack();
    if (next) loadTrackIntoDeck(next, !audioEngine.audio.paused);
  });

  dom.btnPrev.addEventListener('click', () => {
    // If > 3 seconds in, restart current track
    if (audioEngine.audio.currentTime > 3) {
      audioEngine.seek(0);
    } else {
      const prev = playlist.prevTrack();
      if (prev) loadTrackIntoDeck(prev, !audioEngine.audio.paused);
    }
  });

  // Seek Slider
  dom.seekSlider.addEventListener('input', (e) => {
    const ratio = parseFloat(e.target.value) / 100;
    const dur = audioEngine.audio.duration || playlist.getCurrentTrack()?.duration || 0;
    dom.currentTimeDisplay.textContent = formatTime(ratio * dur);
  });

  dom.seekSlider.addEventListener('change', (e) => {
    const ratio = parseFloat(e.target.value) / 100;
    const dur = audioEngine.audio.duration || playlist.getCurrentTrack()?.duration || 0;
    audioEngine.seek(ratio * dur);
  });

  // Shuffle & Repeat
  dom.btnShuffle.addEventListener('click', () => {
    const isShuffled = playlist.toggleShuffle();
    dom.btnShuffle.classList.toggle('active', isShuffled);
    dom.btnShuffle.textContent = isShuffled ? 'SHUF: ON' : 'SHUF: OFF';
    renderPlaylist();
    showToast(isShuffled ? 'RANDOMIZED QUEUE' : 'RESTORED PLAYLIST ORDER');
  });

  dom.btnRepeat.addEventListener('click', () => {
    const mode = playlist.toggleRepeat();
    dom.btnRepeat.textContent = `REP: ${mode}`;
    dom.btnRepeat.classList.toggle('active', mode !== 'OFF');
    showToast(`REPEAT MODE: ${mode}`);
  });

  // Volume & Mute
  dom.volumeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value) / 100;
    audioEngine.setVolume(val);
    dom.volumeVal.textContent = `${Math.round(val * 100)}%`;
    saveAppState('volume', val);
  });

  dom.btnMute.addEventListener('click', () => {
    const isMuted = !audioEngine.isMuted();
    audioEngine.setMuted(isMuted);
    dom.btnMute.classList.toggle('active', isMuted);
    dom.btnMute.textContent = isMuted ? 'UNMUTE' : 'MUTE';
  });

  // Stereo Panner
  dom.panSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value) / 100;
    audioEngine.setPan(val);
    dom.panVal.textContent = val === 0 ? 'CENTER' : val < 0 ? `L ${Math.round(Math.abs(val) * 100)}` : `R ${Math.round(val * 100)}`;
  });

  // Speed / Pitch Selector
  const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  let speedIdx = 2; // 1.0x
  dom.btnSpeed.addEventListener('click', () => {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    const newSpeed = SPEEDS[speedIdx];
    audioEngine.setPlaybackRate(newSpeed);
    dom.btnSpeed.textContent = `${newSpeed}x`;
    showToast(`PLAYBACK SPEED: ${newSpeed}x`);
  });

  // A-B Loop Controls
  dom.btnLoopA.addEventListener('click', () => {
    const res = audioEngine.setLoopA();
    updateAbLoopUI();
    showToast(`LOOP A SET @ ${formatTime(res.a)}`);
  });

  dom.btnLoopB.addEventListener('click', () => {
    const res = audioEngine.setLoopB();
    updateAbLoopUI();
    showToast(`LOOP B SET @ ${formatTime(res.b)}`);
  });

  dom.btnLoopClear.addEventListener('click', () => {
    audioEngine.clearAbLoop();
    updateAbLoopUI();
    showToast('A-B REPEAT CLEARED');
  });

  // Visualizer Mode Switch
  const VIS_MODES = ['SPECTRUM', 'OSCILLOSCOPE', 'VU_METER'];
  let visIdx = 0;
  dom.visModeBtn.addEventListener('click', () => {
    visIdx = (visIdx + 1) % VIS_MODES.length;
    const mode = VIS_MODES[visIdx];
    visualizer.setMode(mode);
    dom.visModeBtn.textContent = `MODE: ${mode}`;
  });
}

function updateAbLoopUI() {
  const { a, b, active } = audioEngine;
  dom.btnLoopA.classList.toggle('active', a !== null);
  dom.btnLoopB.classList.toggle('active', b !== null);
  dom.btnLoopA.textContent = a !== null ? `A: ${formatTime(a)}` : 'SET A';
  dom.btnLoopB.textContent = b !== null ? `B: ${formatTime(b)}` : 'SET B';

  if (active) {
    dom.loopStatus.textContent = `ACTIVE [${formatTime(a)} - ${formatTime(b)}]`;
    dom.loopStatus.style.color = 'var(--accent-yellow)';
  } else if (a !== null) {
    dom.loopStatus.textContent = `A SET: ${formatTime(a)} (WAITING FOR B)`;
    dom.loopStatus.style.color = '#888';
  } else {
    dom.loopStatus.textContent = 'OFF';
    dom.loopStatus.style.color = '#555';
  }
}

/**
 * Playlist UI, Grouping & Search
 */
function bindPlaylistUI() {
  // Tab Switching
  dom.tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      dom.tabButtons.forEach((b) => b.classList.remove('active'));
      dom.tabPanels.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.dataset.tab;
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) targetPanel.classList.add('active');
    });
  });

  // Category Filter Chips (ALL, ARTISTS, ALBUMS, GENRES, DECADES, FAVORITES)
  dom.filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      dom.filterChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');

      const filterType = chip.dataset.filter;
      playlist.setFilter(filterType, null);
      updateSubFilters();
      renderPlaylist();
    });
  });

  // Search Input
  dom.searchInput.addEventListener('input', (e) => {
    playlist.setSearchQuery(e.target.value);
    renderPlaylist();
  });

  // Sort Selector
  dom.sortSelect.addEventListener('change', (e) => {
    playlist.setSorting(e.target.value);
    renderPlaylist();
  });

  // Export & Clear Cache buttons
  dom.btnExportJson.addEventListener('click', () => {
    playlist.exportToJson();
    showToast('PLAYLIST JSON EXPORTED');
  });

  dom.btnClearCache.addEventListener('click', async () => {
    if (confirm('RESET ALL CACHED TRACKS AND METADATA?')) {
      await clearAllTracks();
      await loadInitialTracks();
      updateCacheStatusBadge();
      showToast('CACHE EMPTIED & RESTORED TO DEFAULT');
    }
  });
}

/**
 * Renders the secondary filter row (dynamic sub-chips)
 */
function updateSubFilters() {
  const meta = playlist.getDynamicMetadataSummary();
  const filterType = playlist.activeFilter.type;
  dom.dynamicSubBar.innerHTML = '';

  if (filterType === 'ALL' || filterType === 'FAVORITES') {
    dom.dynamicSubBar.style.display = 'none';
    return;
  }

  dom.dynamicSubBar.style.display = 'flex';
  let items = [];

  if (filterType === 'ARTIST') items = meta.artists;
  else if (filterType === 'ALBUM') items = meta.albums;
  else if (filterType === 'GENRE') items = meta.genres;
  else if (filterType === 'DECADE') items = meta.decades.map((d) => `${d}s`);

  if (items.length === 0) {
    dom.dynamicSubBar.innerHTML = '<span style="color:#666; font-size:10px;">NO METADATA TAGS IN CURRENT LIBRARY</span>';
    return;
  }

  items.forEach((item) => {
    const rawVal = filterType === 'DECADE' ? item.replace('s', '') : item;
    const btn = document.createElement('button');
    btn.className = `sub-chip ${playlist.activeFilter.value === rawVal ? 'active' : ''}`;
    btn.textContent = item;
    btn.addEventListener('click', () => {
      if (playlist.activeFilter.value === rawVal) {
        playlist.setFilter(filterType, null);
      } else {
        playlist.setFilter(filterType, rawVal);
      }
      updateSubFilters();
      renderPlaylist();
    });
    dom.dynamicSubBar.appendChild(btn);
  });
}

/**
 * Renders the track list rows
 */
function renderPlaylist() {
  const current = playlist.getCurrentTrack();
  const tracks = playlist.queue;
  dom.trackListEl.innerHTML = '';
  dom.trackCountDisplay.textContent = `${tracks.length} TRACKS`;

  if (tracks.length === 0) {
    dom.trackListEl.innerHTML = `
      <div style="padding: 30px; text-align: center; color: #777; font-weight: 800;">
        NO TRACKS MATCHING CURRENT CRITERIA.<br>
        <button class="brutal-btn brutal-btn-yellow" id="btn-empty-reset" style="margin-top: 10px;">RESET FILTERS</button>
      </div>
    `;
    document.getElementById('btn-empty-reset')?.addEventListener('click', () => {
      playlist.setFilter('ALL', null);
      playlist.setSearchQuery('');
      dom.searchInput.value = '';
      dom.filterChips.forEach((c) => c.classList.toggle('active', c.dataset.filter === 'ALL'));
      updateSubFilters();
      renderPlaylist();
    });
    return;
  }

  tracks.forEach((track, index) => {
    const isPlaying = current && current.id === track.id;
    const row = document.createElement('div');
    row.className = `track-row ${isPlaying ? 'playing' : ''}`;
    row.dataset.id = track.id;

    // Mini cover image or fallback
    const coverSrc = track.coverUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30"><rect width="30" height="30" fill="%23222"/></svg>';

    row.innerHTML = `
      <div class="track-num">${isPlaying ? '▶' : String(index + 1).padStart(2, '0')}</div>
      <img class="track-cover-mini" src="${coverSrc}" alt="" />
      <div class="track-info-col">
        <span class="track-meta-title">${escapeHtml(track.title)}</span>
        <span class="track-meta-artist">${escapeHtml(track.artist)}</span>
      </div>
      <div class="track-genre">${escapeHtml(track.genre || 'OTHER')}</div>
      <div class="track-genre">${escapeHtml(track.bpm ? `${track.bpm} BPM` : (track.year || ''))}</div>
      <div class="track-duration">${formatTime(track.duration || 0)}</div>
      <div class="track-actions">
        <span class="fav-star ${track.isFavorite ? 'active' : ''}" title="Favorite">★</span>
        <button class="brutal-btn brutal-btn-icon btn-del-track" title="Remove" style="padding: 2px 5px; font-size: 9px;">✕</button>
      </div>
    `;

    // Row click: play track
    row.addEventListener('click', (e) => {
      if (e.target.closest('.track-actions')) return;
      const t = playlist.playTrackById(track.id);
      if (t) loadTrackIntoDeck(t, true);
    });

    // Favorite toggle
    row.querySelector('.fav-star').addEventListener('click', async (e) => {
      e.stopPropagation();
      const fav = playlist.toggleFavorite(track.id);
      await saveTrack(track);
      e.target.classList.toggle('active', fav);
    });

    // Remove track with double-click / two-step red confirmation
    const delBtn = row.querySelector('.btn-del-track');
    let deleteArmed = false;
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!deleteArmed) {
        deleteArmed = true;
        delBtn.classList.add('brutal-btn-red');
        delBtn.style.background = 'var(--accent-crimson)';
        delBtn.style.color = '#fff';
        delBtn.textContent = '?!';
        setTimeout(() => {
          if (deleteArmed) {
            deleteArmed = false;
            delBtn.classList.remove('brutal-btn-red');
            delBtn.style.background = '';
            delBtn.style.color = '';
            delBtn.textContent = '✕';
          }
        }, 3000);
      } else {
        // Second press: actually delete
        const wasPlaying = playlist.removeTrack(track.id);
        await deleteTrack(track.id);
        updateCacheStatusBadge();
        renderPlaylist();
        updateSubFilters();
        if (wasPlaying) {
          const next = playlist.getCurrentTrack();
          if (next) loadTrackIntoDeck(next, false);
          else audioEngine.stop();
        }
        showToast('TRACK REMOVED');
      }
    });

    dom.trackListEl.appendChild(row);
  });
}

function renderPlaylistHighlight() {
  const current = playlist.getCurrentTrack();
  if (!current) return;
  const rows = dom.trackListEl.querySelectorAll('.track-row');
  rows.forEach((r) => {
    const isThis = r.dataset.id === current.id;
    r.classList.toggle('playing', isThis);
    const numEl = r.querySelector('.track-num');
    if (numEl) {
      if (isThis) numEl.textContent = '▶';
    }
  });
}

/**
 * Lyrics & Subtitle Teleprompter Engine
 */
function renderLyrics(cues, trackTitle) {
  dom.lyricsTrackTitle.textContent = trackTitle ? `// ${trackTitle.toUpperCase()}` : '';
  dom.lyricsContainer.innerHTML = '';

  if (!cues || cues.length === 0) {
    dom.lyricsStatus.textContent = 'NO SYNCED LYRICS';
    dom.lyricsContainer.innerHTML = `
      <div class="empty-lyrics-notice">
        <span>NO SYNCHRONIZED LRC / SRT SUBTITLES FOUND FOR THIS TRACK.</span>
        <span style="font-size: 11px; color: #888;">Drop a .lrc or .srt file with matching name, or import files with embedded USLT ID3 tags.</span>
      </div>
    `;
    return;
  }

  dom.lyricsStatus.textContent = `${cues.length} CUES SYNCED`;

  cues.forEach((cue, idx) => {
    const lineEl = document.createElement('div');
    lineEl.className = 'lyric-line';
    lineEl.dataset.idx = idx;
    lineEl.dataset.time = cue.time;

    lineEl.innerHTML = `
      <span class="lyric-timestamp">[${formatTime(cue.time)}]</span>
      <span class="lyric-text">${escapeHtml(cue.text)}</span>
    `;

    // Click on lyric line jumps directly to that timestamp in audio!
    lineEl.addEventListener('click', () => {
      audioEngine.seek(cue.time);
      showToast(`SEEKED TO [${formatTime(cue.time)}]`);
    });

    dom.lyricsContainer.appendChild(lineEl);
  });
}

function syncLyrics(currentTime) {
  if (!activeLyricsCues || activeLyricsCues.length === 0) return;
  const activeIdx = getActiveCueIndex(activeLyricsCues, currentTime);

  if (activeIdx !== lastActiveLyricIdx) {
    lastActiveLyricIdx = activeIdx;
    const lines = dom.lyricsContainer.querySelectorAll('.lyric-line');

    lines.forEach((l, i) => {
      if (i === activeIdx) {
        l.classList.add('active');
        // Auto scroll
        l.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        l.classList.remove('active');
      }
    });
  }
}

/**
 * Extended Technical Information Inspector
 */
function renderExtendedInfo(track) {
  const tech = audioEngine.getTechnicalInfo();
  dom.metaGrid.innerHTML = `
    <div class="inspector-card">
      <div class="inspector-card-title">FILE & CONTAINER TELEMETRY</div>
      <div class="meta-kv"><span class="meta-k">FORMAT:</span><span class="meta-v">${track.format || 'AUDIO'}</span></div>
      <div class="meta-kv"><span class="meta-k">FILE SIZE:</span><span class="meta-v">${track.fileSize ? `${(track.fileSize / 1048576).toFixed(2)} MB` : 'STREAMED'}</span></div>
      <div class="meta-kv"><span class="meta-k">DURATION:</span><span class="meta-v">${formatTime(track.duration || 0)} (${Math.round(track.duration || 0)}s)</span></div>
      <div class="meta-kv"><span class="meta-k">STORAGE:</span><span class="meta-v">${track.audioBlob ? 'LOCAL INDEXEDDB CACHE' : 'STATIC/REMOTE URL'}</span></div>
      <div class="meta-kv"><span class="meta-k">TAG SPEC:</span><span class="meta-v">${track.tagVersion || 'ID3v2.4'}</span></div>
    </div>

    <div class="inspector-card">
      <div class="inspector-card-title">AUDIO ENGINE HARDWARE SPECS</div>
      <div class="meta-kv"><span class="meta-k">SAMPLE RATE:</span><span class="meta-v">${tech.sampleRate.toLocaleString()} Hz</span></div>
      <div class="meta-kv"><span class="meta-k">BIT DEPTH:</span><span class="meta-v">16-BIT / 24-BIT LPCM</span></div>
      <div class="meta-kv"><span class="meta-k">CHANNELS:</span><span class="meta-v">2 (STEREO L/R)</span></div>
      <div class="meta-kv"><span class="meta-k">FFT RESOLUTION:</span><span class="meta-v">256 BINS / 44.1kHz</span></div>
      <div class="meta-kv"><span class="meta-k">EQUALIZER:</span><span class="meta-v">5-BAND ACTIVE CASCADE</span></div>
    </div>

    <div class="inspector-card">
      <div class="inspector-card-title">MUSICAL DESCRIPTORS</div>
      <div class="meta-kv"><span class="meta-k">TRACK NUMBER:</span><span class="meta-v">${track.trackNumber || '01'}</span></div>
      <div class="meta-kv"><span class="meta-k">TEMPO (BPM):</span><span class="meta-v">${track.bpm ? `${track.bpm} BPM` : 'NOT SPECIFIED'}</span></div>
      <div class="meta-kv"><span class="meta-k">GENRE:</span><span class="meta-v">${track.genre || 'OTHER'}</span></div>
      <div class="meta-kv"><span class="meta-k">RELEASE YEAR:</span><span class="meta-v">${track.year || 'UNKNOWN'}</span></div>
      <div class="meta-kv"><span class="meta-k">SUBTITLES / LRC:</span><span class="meta-v">${activeLyricsCues.length > 0 ? `${activeLyricsCues.length} TIMED CUES` : 'NONE'}</span></div>
    </div>

    <div class="inspector-card" style="grid-column: 1 / -1;">
      <div class="inspector-card-title">ARCHIVE NOTES & LINER TEXT</div>
      <div style="font-size: 11px; color: #ccc; line-height: 1.6; padding: 4px 0;">
        ${escapeHtml(track.comments || 'No extended comment frame found in audio container headers.')}
      </div>
    </div>
  `;
}

/**
 * 5-Band Equalizer Setup
 */
function bindEqualizer() {
  dom.eqSliders.forEach((slider, idx) => {
    slider.addEventListener('input', (e) => {
      const gain = parseFloat(e.target.value);
      audioEngine.setEqBandGain(idx, gain);
      dom.eqGainDisplays[idx].textContent = `${gain > 0 ? '+' : ''}${gain}dB`;
    });
  });

  dom.eqPresetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      dom.eqPresetBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const presetName = btn.dataset.preset;
      const values = audioEngine.applyEqPreset(presetName);

      dom.eqSliders.forEach((s, idx) => {
        s.value = values[idx];
        dom.eqGainDisplays[idx].textContent = `${values[idx] > 0 ? '+' : ''}${values[idx]}dB`;
      });
      showToast(`EQ PRESET APPLIED: ${presetName.replace('_', ' ')}`);
    });
  });
}

/**
 * Modals & Import Handlers
 */
function bindModalsAndImports() {
  // Modal Open / Close
  dom.btnOpenJsonModal.addEventListener('click', () => {
    dom.modalJson.classList.add('open');
  });

  dom.btnCloseJsonModal.addEventListener('click', () => {
    dom.modalJson.classList.remove('open');
  });

  dom.btnOpenImportModal.addEventListener('click', () => {
    dom.modalImport.classList.add('open');
  });

  dom.btnCloseImportModal.addEventListener('click', () => {
    dom.modalImport.classList.remove('open');
  });

  // Close modals on background click
  window.addEventListener('click', (e) => {
    if (e.target === dom.modalJson) dom.modalJson.classList.remove('open');
    if (e.target === dom.modalImport) dom.modalImport.classList.remove('open');
  });

  // --- JSON LOADING OPTIONS ---

  // 1. Fetch JSON via URL (Standard fetch, static and local friendly)
  dom.btnFetchJsonUrl.addEventListener('click', async () => {
    const url = dom.jsonUrlInput.value.trim();
    if (!url) return alert('ENTER A VALID JSON URL');

    try {
      showToast(`FETCHING ${url}...`);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP error ${resp.status}`);
      const data = await resp.json();
      const tracks = playlist.importFromJson(data);
      playlist.addTracks(tracks);
      await saveTracks(tracks);
      updateCacheStatusBadge();
      renderPlaylist();
      updateSubFilters();
      dom.modalJson.classList.remove('open');
      showToast(`IMPORTED ${tracks.length} TRACKS FROM REMOTE JSON`);
    } catch (err) {
      alert(`FAILED TO FETCH JSON: ${err.message}`);
    }
  });

  // 2. Load JSON File from Disk
  dom.jsonFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const tracks = playlist.importFromJson(data);
      playlist.addTracks(tracks);
      await saveTracks(tracks);
      updateCacheStatusBadge();
      renderPlaylist();
      updateSubFilters();
      dom.modalJson.classList.remove('open');
      showToast(`LOADED ${tracks.length} TRACKS FROM ${file.name}`);
    } catch (err) {
      alert(`ERROR PARSING JSON FILE: ${err.message}`);
    }
  });

  // 3. Paste Raw JSON
  dom.btnApplyJsonPaste.addEventListener('click', async () => {
    const text = dom.jsonPasteArea.value.trim();
    if (!text) return alert('PASTE JSON FIRST');

    try {
      const data = JSON.parse(text);
      const tracks = playlist.importFromJson(data);
      playlist.addTracks(tracks);
      await saveTracks(tracks);
      updateCacheStatusBadge();
      renderPlaylist();
      updateSubFilters();
      dom.modalJson.classList.remove('open');
      showToast(`IMPORTED ${tracks.length} TRACKS FROM PASTED JSON`);
    } catch (err) {
      alert(`MALFORMED JSON: ${err.message}`);
    }
  });

  // 4. Load Demo JSON
  dom.btnLoadDemoJson.addEventListener('click', async () => {
    const demos = [...DEFAULT_DEMO_TRACKS];
    for (const d of demos) {
      if (!d.audioUrl && d.synthType) {
        d.audioUrl = await renderSynthAudio(d.synthType, d.duration);
      }
    }
    playlist.addTracks(demos);
    await saveTracks(demos);
    updateCacheStatusBadge();
    renderPlaylist();
    updateSubFilters();
    dom.modalJson.classList.remove('open');
    showToast('BRUTALIST DEMO MANIFEST RELOADED');
  });

  // --- LOCAL FILE IMPORT & DRAG/DROP ---

  // Click on dropzone opens native file picker
  dom.dropzone.addEventListener('click', () => {
    dom.filePickerInput.click();
  });

  dom.filePickerInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processImportedFiles(Array.from(e.target.files));
      dom.modalImport.classList.remove('open');
    }
  });

  // Drag & Drop onto dropzone or window
  ['dragenter', 'dragover'].forEach((eventName) => {
    window.addEventListener(eventName, (e) => {
      e.preventDefault();
      dom.dropzone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    window.addEventListener(eventName, (e) => {
      e.preventDefault();
      dom.dropzone.classList.remove('drag-over');
    });
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processImportedFiles(Array.from(e.dataTransfer.files));
      dom.modalImport.classList.remove('open');
    }
  });
}

/**
 * Processes a batch of imported files:
 * Categorizes audio, images, and subtitles/lyrics,
 * parses audio ID3 tags and embedded cover pictures,
 * matches companion .jpg/.lrc files by base name,
 * stores in IndexedDB for permanent caching across browser reloads.
 */
async function processImportedFiles(files) {
  showToast(`PROCESSING ${files.length} IMPORTED FILE(S)...`);

  const audioFiles = [];
  const imageFiles = new Map(); // baseName -> File
  const lyricsFiles = new Map(); // baseName -> File
  const jsonFiles = [];

  for (const file of files) {
    const ext = file.name.split('.').pop().toLowerCase();
    const baseName = file.name.replace(/\.[^/.]+$/, '').toLowerCase();

    if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'weba'].includes(ext)) {
      audioFiles.push(file);
    } else if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) {
      imageFiles.set(baseName, file);
      // Also register generic cover names
      if (['cover', 'folder', 'album', 'front'].includes(baseName)) {
        imageFiles.set('__generic_cover__', file);
      }
    } else if (['lrc', 'srt', 'vtt', 'txt'].includes(ext)) {
      lyricsFiles.set(baseName, file);
    } else if (ext === 'json') {
      jsonFiles.push(file);
    }
  }

  // Handle any dropped JSON playlists
  for (const jFile of jsonFiles) {
    try {
      const content = await jFile.text();
      const parsed = JSON.parse(content);
      const importedTracks = playlist.importFromJson(parsed);
      playlist.addTracks(importedTracks);
      await saveTracks(importedTracks);
    } catch (e) {
      console.warn('Error reading dropped JSON:', e);
    }
  }

  if (audioFiles.length === 0 && jsonFiles.length === 0 && imageFiles.size === 0 && lyricsFiles.size === 0) {
    showToast('NO RECOGNIZED AUDIO OR PLAYLIST FILES FOUND');
    return;
  }

  const newTracks = [];

  for (const aFile of audioFiles) {
    try {
      const baseName = aFile.name.replace(/\.[^/.]+$/, '').toLowerCase();

      // Parse ID3v1 / ID3v2 tags and embedded cover art
      const meta = await parseAudioMetadata(aFile);

      // Check companion image file
      let coverUrl = meta.coverUrl;
      let coverBlob = meta.coverBlob;

      if (!coverUrl) {
        const matchingImg = imageFiles.get(baseName) || imageFiles.get('__generic_cover__');
        if (matchingImg) {
          coverBlob = matchingImg;
          coverUrl = URL.createObjectURL(matchingImg);
        }
      }

      // Check companion lyrics file
      let lyrics = meta.lyrics;
      const matchingLyricsFile = lyricsFiles.get(baseName);
      if (matchingLyricsFile) {
        lyrics = await matchingLyricsFile.text();
      }

      const audioUrl = URL.createObjectURL(aFile);

      const trackObj = {
        id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        title: meta.title,
        artist: meta.artist,
        album: meta.album,
        year: meta.year,
        genre: meta.genre,
        trackNumber: meta.trackNumber,
        bpm: meta.bpm,
        duration: 0, // Will be updated on loadedmetadata
        audioUrl,
        audioBlob: aFile, // Persist blob into IndexedDB!
        coverUrl,
        coverBlob,
        lyrics,
        comments: meta.comments || `Imported local file: ${aFile.name}`,
        format: meta.format,
        fileSize: meta.fileSize,
        tagVersion: meta.tagVersion,
        isLocal: true,
        dateAdded: Date.now(),
        isFavorite: false
      };

      newTracks.push(trackObj);
    } catch (err) {
      console.warn(`Failed to process audio file ${aFile.name}:`, err);
    }
  }

  if (newTracks.length > 0) {
    playlist.addTracks(newTracks);
    await saveTracks(newTracks);
    updateCacheStatusBadge();
    renderPlaylist();
    updateSubFilters();

    // If nothing currently playing, play the first imported track
    if (!audioEngine.audio.src || audioEngine.audio.paused) {
      loadTrackIntoDeck(newTracks[0], true);
    }
    showToast(`SUCCESSFULLY IMPORTED ${newTracks.length} TRACK(S)`);
  }
}

/**
 * Updates the persistent cache badge in header
 */
async function updateCacheStatusBadge() {
  if (!dom.cacheStatus) return;
  try {
    const all = await getAllTracks();
    dom.cacheStatus.textContent = `INDEXEDDB: ${all.length} CACHED`;
  } catch (e) {
    dom.cacheStatus.textContent = 'CACHE: ACTIVE';
  }
}

/**
 * Brutalist System Clock
 */
function startSystemClock() {
  const clockEl = document.getElementById('system-clock');
  if (!clockEl) return;
  const update = () => {
    const d = new Date();
    clockEl.textContent = d.toISOString().replace('T', ' ').slice(0, 19);
  };
  update();
  setInterval(update, 1000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Auto-boot on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}
