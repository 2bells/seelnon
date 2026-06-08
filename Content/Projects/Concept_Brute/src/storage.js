import { SECTOR_SIZE } from './constants.js';

export class SketchStorage {
  constructor() {
    this.projectId = 'default';
    this.dbName = 'ConceptBruteDB';
    this.version = 1;
    this.db = null;
    this.isFallback = false;
    this.fallbackStore = {
      chunks: {},
      settings: {},
      sectors: {}
    };
  }

  setProjectId(id) {
    this.projectId = id || 'default';
  }

  _enableFallback() {
    this.isFallback = true;
    this.fallbackStore = {
      chunks: {},
      settings: {},
      sectors: {}
    };
    
    // Attempt to load settings/metadata keys from localStorage to preserve state
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(`p_${this.projectId}_`) || key.startsWith(`brushTips`) || key === 'window_positions' || key === 'canvas_palette' || key.startsWith('cat_collapsed_'))) {
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (key.includes('_s_')) {
                // If it is a sector or setting key
                if (key.includes('_s_0_') || key.includes('_s_1_') || key.includes('_s_2_') || key.includes('_s_3_') || key.includes('_s_minus_')) {
                  this.fallbackStore.sectors[key] = parsed;
                } else {
                  this.fallbackStore.settings[key] = parsed;
                }
              } else {
                this.fallbackStore.settings[key] = parsed;
              }
            }
          } catch (e) {
            // Keep as raw string if JSON parsing falls through
            const raw = localStorage.getItem(key);
            this.fallbackStore.settings[key] = raw;
          }
        }
      }
    } catch (err) {
      console.warn('LocalStorage reads disabled or blocked:', err);
    }
  }

  async init() {
    if (this.db || this.isFallback) return;
    
    return new Promise((resolve) => {
      // 1-second timeout guard to prevent mobile IndexedDB hangs
      const timeoutId = setTimeout(() => {
        console.warn('IndexedDB handshake timed out. Activating high-performance in-memory fallback.');
        this._enableFallback();
        resolve();
      }, 1000);

      let request;
      try {
        request = indexedDB.open(this.dbName, this.version);
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn('IndexedDB blocked by security rules. Activating in-memory fallback.', err.message);
        this._enableFallback();
        resolve();
        return;
      }
      
      request.onupgradeneeded = (event) => {
        const database = event.target.result;
        if (!database.objectStoreNames.contains('chunks')) {
          database.createObjectStore('chunks', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('settings')) {
          database.createObjectStore('settings', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('sectors')) {
          database.createObjectStore('sectors', { keyPath: 'id' });
        }
      };
      
      request.onsuccess = (event) => {
        clearTimeout(timeoutId);
        this.db = event.target.result;
        resolve();
      };
      
      request.onerror = (event) => {
        clearTimeout(timeoutId);
        console.warn('IndexedDB refused connection. Activating in-memory fallback.');
        this._enableFallback();
        resolve();
      };
    });
  }

  _getSectorKey(sx, sy) {
    return `p_${this.projectId}_s_${sx}_${sy}`;
  }

  _getSettingKey(id) {
    return `p_${this.projectId}_s_${id}`;
  }

  async saveSector(sx, sy, sectorData) {
    const key = this._getSectorKey(sx, sy);

    if (this.isFallback) {
      if (!sectorData || Object.keys(sectorData.chunks || {}).length === 0) {
        delete this.fallbackStore.sectors[key];
        try { localStorage.removeItem(key); } catch (e) {}
      } else {
        this.fallbackStore.sectors[key] = sectorData;
        try { localStorage.setItem(key, JSON.stringify(sectorData)); } catch (e) {}
      }
      return;
    }

    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sectors'], 'readwrite');
      const store = transaction.objectStore('sectors');
      
      if (!sectorData || Object.keys(sectorData.chunks || {}).length === 0) {
        store.delete(key);
      } else {
        store.put({ id: key, ...sectorData });
      }
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject(event.target.error || new Error('Save sector failed'));
    });
  }

  async loadSector(sx, sy) {
    const key = this._getSectorKey(sx, sy);

    if (this.isFallback) {
      return this.fallbackStore.sectors[key] || null;
    }

    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sectors'], 'readonly');
      const store = transaction.objectStore('sectors');
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = (event) => reject(event.target.error || new Error('Load sector failed'));
    });
  }

  async loadSectorsBatch(keys) {
    if (this.isFallback) {
      return keys.map(key => ({
        key,
        sector: this.fallbackStore.sectors[key] || null
      }));
    }

    if (!this.db) throw new Error('Database not initialized');
    if (keys.length === 0) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sectors'], 'readonly');
      const store = transaction.objectStore('sectors');
      const results = [];
      let loadedCount = 0;
      let failed = false;

      keys.forEach((key, index) => {
        const request = store.get(key);
        request.onsuccess = () => {
          if (failed) return;
          results[index] = { key, sector: request.result || null };
          loadedCount++;
          if (loadedCount === keys.length) {
            resolve(results);
          }
        };
        request.onerror = (event) => {
          if (failed) return;
          failed = true;
          reject(event.target.error || new Error('Load sectors batch failed'));
        };
      });
    });
  }

  async getAllSectorKeys() {
    if (this.isFallback) {
      const prefix = `p_${this.projectId}_s_`;
      return Object.keys(this.fallbackStore.sectors).filter(k => k.startsWith(prefix));
    }

    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sectors'], 'readonly');
      const store = transaction.objectStore('sectors');
      const range = IDBKeyRange.bound(`p_${this.projectId}_s_`, `p_${this.projectId}_s_\uffff`);
      const request = store.getAllKeys(range);
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (event) => reject(event.target.error || new Error('Get keys failed'));
    });
  }

  async getAllLegacyKeys() {
    if (this.isFallback) {
      const prefix = `p_${this.projectId}_c_`;
      return Object.keys(this.fallbackStore.chunks).filter(k => k.startsWith(prefix));
    }

    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['chunks'], 'readonly');
      const store = transaction.objectStore('chunks');
      const range = IDBKeyRange.bound(`p_${this.projectId}_c_`, `p_${this.projectId}_c_\uffff`);
      const request = store.getAllKeys(range);
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (event) => reject(event.target.error || new Error('Get legacy keys failed'));
    });
  }

  async loadLegacyChunk(id) {
    if (this.isFallback) {
      return this.fallbackStore.chunks[id] ? this.fallbackStore.chunks[id].data : null;
    }

    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['chunks'], 'readonly');
      const store = transaction.objectStore('chunks');
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result ? request.result.data : null);
      request.onerror = (event) => reject(event.target.error || new Error('Load legacy chunk failed'));
    });
  }

  async deleteLegacyChunk(id) {
    if (this.isFallback) {
      delete this.fallbackStore.chunks[id];
      return;
    }

    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['chunks'], 'readwrite');
      const store = transaction.objectStore('chunks');
      store.delete(id);
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject(event.target.error || new Error('Delete legacy chunk failed'));
    });
  }

  async saveSetting(id, value) {
    const key = this._getSettingKey(id);

    if (this.isFallback) {
      this.fallbackStore.settings[key] = value;
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
      return;
    }

    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      store.put({ id: key, value });
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject(event.target.error || new Error('Save setting failed'));
    });
  }

  async loadSetting(id) {
    const key = this._getSettingKey(id);

    if (this.isFallback) {
      if (this.fallbackStore.settings[key] !== undefined) {
        return this.fallbackStore.settings[key];
      }
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }

    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result ? request.result.value : null);
      request.onerror = (event) => reject(event.target.error || new Error('Load setting failed'));
    });
  }

  async loadSettingsBatch(keys) {
    if (this.isFallback) {
      const results = {};
      keys.forEach(k => {
        const key = this._getSettingKey(k);
        if (this.fallbackStore.settings[key] !== undefined) {
          results[k] = this.fallbackStore.settings[key];
        } else {
          try {
            const raw = localStorage.getItem(key);
            results[k] = raw ? JSON.parse(raw) : null;
          } catch (e) {
            results[k] = null;
          }
        }
      });
      return results;
    }

    if (!this.db) throw new Error('Database not initialized');
    if (keys.length === 0) return {};

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const results = {};
      let loadedCount = 0;
      let failed = false;

      keys.forEach((k) => {
        const key = this._getSettingKey(k);
        const request = store.get(key);
        request.onsuccess = () => {
          if (failed) return;
          results[k] = request.result ? request.result.value : null;
          loadedCount++;
          if (loadedCount === keys.length) {
            resolve(results);
          }
        };
        request.onerror = (event) => {
          if (failed) return;
          failed = true;
          reject(event.target.error || new Error('Batch settings load failed'));
        };
      });
    });
  }

  async saveGlobalSetting(id, value) {
    if (this.isFallback) {
      this.fallbackStore.settings[id] = value;
      try { localStorage.setItem(id, JSON.stringify(value)); } catch (e) {}
      return;
    }

    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      store.put({ id, value });
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject(event.target.error || new Error('Save global setting failed'));
    });
  }

  async loadGlobalSetting(id) {
    if (this.isFallback) {
      if (this.fallbackStore.settings[id] !== undefined) {
        return this.fallbackStore.settings[id];
      }
      try {
        const raw = localStorage.getItem(id);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }

    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result ? request.result.value : null);
      request.onerror = (event) => reject(event.target.error || new Error('Load global setting failed'));
    });
  }

  async getStorageStats() {
    if (this.isFallback) {
      let size = 0;
      let sectors = 0;
      let chunks = 0;
      const prefix = `p_${this.projectId}_s_`;
      
      for (const key in this.fallbackStore.sectors) {
        if (key.startsWith(prefix)) {
          sectors++;
          const chunkData = this.fallbackStore.sectors[key].chunks || {};
          for (const k in chunkData) {
            chunks++;
            size += (chunkData[k]?.length || 0);
          }
        }
      }
      return { size, sectors, chunks };
    }

    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      let size = 0;
      let sectors = 0;
      let chunks = 0;
      
      const transaction = this.db.transaction(['sectors'], 'readonly');
      const store = transaction.objectStore('sectors');
      const range = IDBKeyRange.bound(`p_${this.projectId}_s_`, `p_${this.projectId}_s_\uffff`);
      const request = store.openCursor(range);
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          sectors++;
          const chunkData = cursor.value.chunks || {};
          for (const key in chunkData) {
            chunks++;
            size += (chunkData[key]?.length || 0);
          }
          cursor.continue();
        } else {
          resolve({ size, sectors, chunks });
        }
      };
      
      request.onerror = (event) => reject(event.target.error || new Error('Get storage stats failed'));
    });
  }

  async clearDatabase() {
    if (this.isFallback) {
      this.fallbackStore = {
        chunks: {},
        settings: {},
        sectors: {}
      };
      // Attempt to clear corresponding localStorage keys
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith(`p_${this.projectId}_`) || key.startsWith(`brushTips_`))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => {
          try { localStorage.removeItem(k); } catch (e) {}
        });
      } catch (e) {}
      return;
    }

    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['chunks', 'settings', 'sectors'], 'readwrite');
      transaction.objectStore('chunks').clear();
      transaction.objectStore('settings').clear();
      transaction.objectStore('sectors').clear();
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject(event.target.error || new Error('Clear database failed'));
    });
  }
}
