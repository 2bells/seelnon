import { SECTOR_SIZE } from './constants.js';

export class SketchStorage {
  constructor() {
    this.dbName = 'ConceptBruteDB';
    this.version = 1; // Resetting version for the new DB name
    this.db = null;
    this.projectId = 'default';
  }

  setProjectId(id) {
    this.projectId = id || 'default';
  }

  async init() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
          reject(new Error("IndexedDB initialization timed out. Close other tabs of this app and refresh."));
      }, 8000); // 8 seconds timeout

      const request = indexedDB.open(this.dbName, this.version);
      
      request.onblocked = (e) => {
          console.warn("IndexedDB open BLOCKED. Older version:", e.oldVersion, "New version:", e.newVersion);
          alert("A newer version of the app is trying to load. Please close all other tabs of this application to proceed.");
      };

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        // Legacy chunks store (keep for migration or reference, but we'll use sectors)
        if (!db.objectStoreNames.contains('chunks')) {
          db.createObjectStore('chunks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
        // New Sectors Store
        if (!db.objectStoreNames.contains('sectors')) {
          db.createObjectStore('sectors', { keyPath: 'id' });
        }
      };
      
      request.onsuccess = (e) => {
        clearTimeout(timeout);
        this.db = e.target.result;
        resolve();
      };

      request.onerror = (e) => {
        clearTimeout(timeout);
        reject(e);
      };
    });
  }

  _getSectorKey(sx, sy) {
    return `p_${this.projectId}_s_${sx}_${sy}`;
  }

  async saveSector(sx, sy, sectorData) {
    if (!this.db) return;
    const id = this._getSectorKey(sx, sy);
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sectors'], 'readwrite');
      const store = transaction.objectStore('sectors');
      
      // If sectorData has no chunks, delete the sector to keep DB clean
      if (!sectorData || Object.keys(sectorData.chunks || {}).length === 0) {
          store.delete(id);
      } else {
          store.put({ id, ...sectorData });
      }
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = (e) => reject(e);
    });
  }

  async loadSector(sx, sy) {
    if (!this.db) return null;
    const id = this._getSectorKey(sx, sy);
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sectors'], 'readonly');
      const store = transaction.objectStore('sectors');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e);
    });
  }

  async getAllSectorKeys() {
    if (!this.db) return [];
    return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['sectors'], 'readonly');
        const store = transaction.objectStore('sectors');
        const range = IDBKeyRange.bound(`p_${this.projectId}_s_`, `p_${this.projectId}_s_\uffff`);
        const request = store.getAllKeys(range);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e);
    });
  }

  // LEGACY METHODS (MIGRATION SUPPORT)
  async getAllLegacyKeys() {
    if (!this.db) return [];
    return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['chunks'], 'readonly');
        const store = transaction.objectStore('chunks');
        const range = IDBKeyRange.bound(`p_${this.projectId}_c_`, `p_${this.projectId}_c_\uffff`);
        const request = store.getAllKeys(range);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e);
    });
  }

  async loadLegacyChunk(id) {
    if (!this.db) return null;
    return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['chunks'], 'readonly');
        const store = transaction.objectStore('chunks');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result ? request.result.data : null);
        request.onerror = (e) => reject(e);
    });
  }

  async deleteLegacyChunk(id) {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['chunks'], 'readwrite');
        const store = transaction.objectStore('chunks');
        store.delete(id);
        transaction.oncomplete = () => resolve();
        transaction.onerror = (e) => reject(e);
    });
  }

  // SETTINGS
  async saveSetting(id, value) {
    if (!this.db) return;
    const key = `p_${this.projectId}_s_${id}`;
    return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');
        store.put({ id: key, value });
        transaction.oncomplete = () => resolve();
        transaction.onerror = (e) => reject(e);
    });
  }

  async loadSetting(id) {
    if (!this.db) return null;
    const key = `p_${this.projectId}_s_${id}`;
    return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result ? request.result.value : null);
        request.onerror = (e) => reject(e);
    });
  }

  async saveGlobalSetting(id, value) {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');
        store.put({ id, value });
        transaction.oncomplete = () => resolve();
        transaction.onerror = (e) => reject(e);
    });
  }

  async loadGlobalSetting(id) {
    if (!this.db) return null;
    return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result ? request.result.value : null);
        request.onerror = (e) => reject(e);
    });
  }

  async getStorageStats() {
      if (!this.db) return { size: 0, sectors: 0, chunks: 0 };
      return new Promise((resolve) => {
          let size = 0;
          let sectors = 0;
          let chunks = 0;
          const transaction = this.db.transaction(['sectors'], 'readonly');
          const store = transaction.objectStore('sectors');
          const range = IDBKeyRange.bound(`p_${this.projectId}_s_`, `p_${this.projectId}_s_\uffff`);
          const request = store.openCursor(range);
          request.onsuccess = (e) => {
              const cursor = e.target.result;
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
      });
  }

  async clearDatabase() {
      return new Promise((resolve, reject) => {
          const transaction = this.db.transaction(['chunks', 'settings', 'sectors'], 'readwrite');
          transaction.objectStore('chunks').clear();
          transaction.objectStore('settings').clear();
          transaction.objectStore('sectors').clear();
          transaction.oncomplete = () => resolve();
          transaction.onerror = (e) => reject(e);
      });
  }
}
