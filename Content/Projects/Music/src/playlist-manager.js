/**
 * PLAYLIST & QUEUE MANAGER
 * Dynamic playlist generation from metadata (Artists, Albums, Genres, Decades),
 * Queue manipulation, search filtering, JSON import/export, and smart shuffle.
 */

export class PlaylistManager {
  constructor() {
    this.tracks = []; // Master library
    this.queue = [];  // Playback queue
    this.currentIndex = -1;
    this.repeatMode = 'ALL'; // 'OFF' | 'ALL' | 'ONE'
    this.isShuffled = false;
    this.unshuffledQueue = [];

    // Filter and view state
    this.activeFilter = { type: 'ALL', value: null };
    this.searchQuery = '';
    this.sortBy = 'DEFAULT'; // 'DEFAULT' | 'TITLE' | 'ARTIST' | 'ALBUM' | 'DURATION' | 'BPM'
    this.sortAsc = true;
  }

  setTracks(trackList) {
    this.tracks = [...trackList];
    this.rebuildQueue();
  }

  addTrack(track) {
    // Avoid duplicate IDs
    const existingIndex = this.tracks.findIndex((t) => t.id === track.id);
    if (existingIndex >= 0) {
      this.tracks[existingIndex] = track;
    } else {
      this.tracks.push(track);
    }
    this.rebuildQueue();
  }

  addTracks(trackList) {
    trackList.forEach((track) => {
      const idx = this.tracks.findIndex((t) => t.id === track.id);
      if (idx >= 0) {
        this.tracks[idx] = track;
      } else {
        this.tracks.push(track);
      }
    });
    this.rebuildQueue();
  }

  removeTrack(trackId) {
    const isPlaying = this.getCurrentTrack()?.id === trackId;
    this.tracks = this.tracks.filter((t) => t.id !== trackId);
    this.queue = this.queue.filter((t) => t.id !== trackId);

    if (isPlaying) {
      if (this.queue.length > 0) {
        this.currentIndex = Math.min(this.currentIndex, this.queue.length - 1);
      } else {
        this.currentIndex = -1;
      }
    } else {
      const newIdx = this.queue.findIndex((t) => t.id === this.getCurrentTrack()?.id);
      this.currentIndex = newIdx;
    }
    return isPlaying;
  }

  toggleFavorite(trackId) {
    const track = this.tracks.find((t) => t.id === trackId);
    if (track) {
      track.isFavorite = !track.isFavorite;
      const qTrack = this.queue.find((t) => t.id === trackId);
      if (qTrack) qTrack.isFavorite = track.isFavorite;
      return track.isFavorite;
    }
    return false;
  }

  setFilter(type, value = null) {
    this.activeFilter = { type, value };
    this.rebuildQueue();
  }

  setSearchQuery(query) {
    this.searchQuery = (query || '').toLowerCase().trim();
    this.rebuildQueue();
  }

  setSorting(sortBy) {
    if (this.sortBy === sortBy) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortBy = sortBy;
      this.sortAsc = true;
    }
    this.rebuildQueue();
  }

  getFilteredTracks() {
    let list = [...this.tracks];

    // 1. Dynamic group filter
    const { type, value } = this.activeFilter;
    if (type === 'ARTIST' && value) {
      list = list.filter((t) => t.artist === value);
    } else if (type === 'ALBUM' && value) {
      list = list.filter((t) => t.album === value);
    } else if (type === 'GENRE' && value) {
      list = list.filter((t) => t.genre === value);
    } else if (type === 'DECADE' && value) {
      const decStart = parseInt(value, 10);
      list = list.filter((t) => {
        const yr = parseInt(t.year, 10);
        return yr >= decStart && yr < decStart + 10;
      });
    } else if (type === 'FAVORITES') {
      list = list.filter((t) => t.isFavorite);
    }

    // 2. Search query match
    if (this.searchQuery) {
      const q = this.searchQuery;
      list = list.filter((t) => {
        return (
          (t.title && t.title.toLowerCase().includes(q)) ||
          (t.artist && t.artist.toLowerCase().includes(q)) ||
          (t.album && t.album.toLowerCase().includes(q)) ||
          (t.genre && t.genre.toLowerCase().includes(q)) ||
          (t.year && t.year.toString().includes(q)) ||
          (t.comments && t.comments.toLowerCase().includes(q))
        );
      });
    }

    // 3. Sorting
    list.sort((a, b) => {
      let cmp = 0;
      if (this.sortBy === 'TITLE') {
        cmp = (a.title || '').localeCompare(b.title || '');
      } else if (this.sortBy === 'ARTIST') {
        cmp = (a.artist || '').localeCompare(b.artist || '');
      } else if (this.sortBy === 'ALBUM') {
        cmp = (a.album || '').localeCompare(b.album || '');
      } else if (this.sortBy === 'DURATION') {
        cmp = (a.duration || 0) - (b.duration || 0);
      } else if (this.sortBy === 'BPM') {
        cmp = (a.bpm || 0) - (b.bpm || 0);
      } else {
        // DEFAULT: trackNumber or dateAdded
        const tA = parseInt(a.trackNumber, 10) || 0;
        const tB = parseInt(b.trackNumber, 10) || 0;
        cmp = tA !== tB ? tA - tB : (b.dateAdded || 0) - (a.dateAdded || 0);
      }
      return this.sortAsc ? cmp : -cmp;
    });

    return list;
  }

  rebuildQueue() {
    const currentTrack = this.getCurrentTrack();
    this.queue = this.getFilteredTracks();

    if (this.isShuffled) {
      this._applyShuffle();
    }

    if (currentTrack) {
      const newIndex = this.queue.findIndex((t) => t.id === currentTrack.id);
      this.currentIndex = newIndex >= 0 ? newIndex : 0;
    } else {
      this.currentIndex = this.queue.length > 0 ? 0 : -1;
    }
  }

  _applyShuffle() {
    const current = this.getCurrentTrack();
    const rest = this.queue.filter((t) => t.id !== current?.id);

    // Fisher-Yates
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }

    this.queue = current ? [current, ...rest] : rest;
    this.currentIndex = current ? 0 : -1;
  }

  toggleShuffle() {
    this.isShuffled = !this.isShuffled;
    if (this.isShuffled) {
      this.unshuffledQueue = [...this.queue];
      this._applyShuffle();
    } else {
      const current = this.getCurrentTrack();
      this.queue = this.getFilteredTracks();
      if (current) {
        this.currentIndex = this.queue.findIndex((t) => t.id === current.id);
      }
    }
    return this.isShuffled;
  }

  toggleRepeat() {
    if (this.repeatMode === 'ALL') {
      this.repeatMode = 'ONE';
    } else if (this.repeatMode === 'ONE') {
      this.repeatMode = 'OFF';
    } else {
      this.repeatMode = 'ALL';
    }
    return this.repeatMode;
  }

  getCurrentTrack() {
    if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
      return this.queue[this.currentIndex];
    }
    return null;
  }

  playTrackById(trackId) {
    const idx = this.queue.findIndex((t) => t.id === trackId);
    if (idx >= 0) {
      this.currentIndex = idx;
      return this.queue[this.currentIndex];
    }
    // If track is not in current filtered queue, reset filter and find it
    const masterIdx = this.tracks.findIndex((t) => t.id === trackId);
    if (masterIdx >= 0) {
      this.activeFilter = { type: 'ALL', value: null };
      this.searchQuery = '';
      this.rebuildQueue();
      this.currentIndex = this.queue.findIndex((t) => t.id === trackId);
      return this.getCurrentTrack();
    }
    return null;
  }

  nextTrack() {
    if (this.queue.length === 0) return null;

    if (this.repeatMode === 'ONE') {
      return this.getCurrentTrack();
    }

    if (this.currentIndex < this.queue.length - 1) {
      this.currentIndex++;
      return this.queue[this.currentIndex];
    } else if (this.repeatMode === 'ALL') {
      this.currentIndex = 0;
      return this.queue[this.currentIndex];
    }

    return null; // Ended and repeat is off
  }

  prevTrack() {
    if (this.queue.length === 0) return null;

    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.queue[this.currentIndex];
    } else if (this.repeatMode === 'ALL') {
      this.currentIndex = this.queue.length - 1;
      return this.queue[this.currentIndex];
    }

    return this.queue[0];
  }

  moveQueueItem(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.queue.length || toIndex < 0 || toIndex >= this.queue.length) return;
    const item = this.queue.splice(fromIndex, 1)[0];
    this.queue.splice(toIndex, 0, item);
  }

  getDynamicMetadataSummary() {
    const artists = new Set();
    const albums = new Set();
    const genres = new Set();
    const decades = new Set();

    let totalDuration = 0;
    this.tracks.forEach((t) => {
      if (t.artist) artists.add(t.artist);
      if (t.album) albums.add(t.album);
      if (t.genre) genres.add(t.genre);
      if (t.year) {
        const y = parseInt(t.year, 10);
        if (!isNaN(y)) {
          decades.add(Math.floor(y / 10) * 10);
        }
      }
      totalDuration += t.duration || 0;
    });

    return {
      artists: Array.from(artists).sort(),
      albums: Array.from(albums).sort(),
      genres: Array.from(genres).sort(),
      decades: Array.from(decades).sort((a, b) => b - a),
      trackCount: this.tracks.length,
      totalDuration
    };
  }

  /**
   * Export library or current playlist to standard JSON manifest
   */
  exportToJson() {
    const exportData = {
      version: '1.0',
      generator: 'BRUTAL_AUDIO_ENGINE',
      exportedAt: new Date().toISOString(),
      playlistName: this.activeFilter.type === 'ALL' ? 'MASTER PLAYLIST' : `${this.activeFilter.type}: ${this.activeFilter.value}`,
      trackCount: this.queue.length,
      tracks: this.queue.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        album: t.album,
        year: t.year,
        genre: t.genre,
        trackNumber: t.trackNumber,
        bpm: t.bpm,
        duration: t.duration,
        audioUrl: t.isLocal ? null : t.audioUrl,
        coverUrl: t.coverUrl?.startsWith('data:image/svg+xml') ? t.coverUrl : null,
        lyrics: t.lyrics,
        comments: t.comments,
        format: t.format
      }))
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brutal-playlist-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Import playlist from parsed JSON object or array
   */
  importFromJson(jsonData) {
    let rawTracks = [];
    if (Array.isArray(jsonData)) {
      rawTracks = jsonData;
    } else if (jsonData && Array.isArray(jsonData.tracks)) {
      rawTracks = jsonData.tracks;
    } else {
      throw new Error('Invalid playlist JSON format. Expected array or object with "tracks" array.');
    }

    const imported = rawTracks.map((item, idx) => ({
      id: item.id || `json-${Date.now()}-${idx}`,
      title: item.title || 'UNTITLED TRACK',
      artist: item.artist || 'UNKNOWN ARTIST',
      album: item.album || 'IMPORTED JSON ARCHIVE',
      year: item.year || new Date().getFullYear().toString(),
      genre: item.genre || 'ELECTRONIC',
      trackNumber: item.trackNumber || String(idx + 1).padStart(2, '0'),
      bpm: item.bpm || null,
      duration: item.duration || 0,
      audioUrl: item.audioUrl || item.url || item.src || null,
      coverUrl: item.coverUrl || item.cover || null,
      lyrics: item.lyrics || item.subtitles || null,
      comments: item.comments || item.notes || item.description || null,
      format: item.format || 'AUDIO/JSON',
      dateAdded: Date.now(),
      isFavorite: false
    }));

    return imported;
  }
}
