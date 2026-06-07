import { SECTOR_SIZE } from './constants.js';

export class SketchStorage {
  constructor() {
    this.projectId = 'default';
    this.dbName = 'ConceptBruteDB';
    this.version = 1;
    this.db = null;
  }

  setProjectId(id) {
    this.projectId = id || 'default';
  }

  async init() {
    if (this.db) return;
    
    return new Promise((resolve, reject) => {
      let request;
      try {
        request = indexedDB.open(this.dbName, this.version);
      } catch (err) {
        reject(new Error('IndexedDB open block: ' + err.message));
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
        this.db = event.target.result;
        resolve();
      };
      
      request.onerror = (event) => {
        reject(event.target.error || new Error('Unknown database open error'));
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
    if (!this.db) throw new Error('Database not initialized');
    const key = this._getSectorKey(sx, sy);
    
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
    if (!this.db) throw new Error('Database not initialized');
    const key = this._getSectorKey(sx, sy);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sectors'], 'readonly');
      const store = transaction.objectStore('sectors');
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(event.target.error || new Error('Load sector failed'));
    });
  }

  async getAllSectorKeys() {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sectors'], 'readonly');
      const store = transaction.objectStore('sectors');
      const range = IDBKeyRange.bound(`p_${this.projectId}_s_`, `p_${this.projectId}_s_\uffff`);
      const request = store.getAllKeys(range);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(event.target.error || new Error('Get keys failed'));
    });
  }

  async getAllLegacyKeys() {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['chunks'], 'readonly');
      const store = transaction.objectStore('chunks');
      const range = IDBKeyRange.bound(`p_${this.projectId}_c_`, `p_${this.projectId}_c_\uffff`);
      const request = store.getAllKeys(range);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(event.target.error || new Error('Get legacy keys failed'));
    });
  }

  async loadLegacyChunk(id) {
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
    if (!this.db) throw new Error('Database not initialized');
    const key = this._getSettingKey(id);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      store.put({ id: key, value });
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject(event.target.error || new Error('Save setting failed'));
    });
  }

  async loadSetting(id) {
    if (!this.db) throw new Error('Database not initialized');
    const key = this._getSettingKey(id);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result ? request.result.value : null);
      request.onerror = (event) => reject(event.target.error || new Error('Load setting failed'));
    });
  }

  async saveGlobalSetting(id, value) {
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
