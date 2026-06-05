import { SECTOR_SIZE } from './constants.js';

const workerCode = `
  let dbName = 'ConceptBruteDB';
  let version = 1;
  let db = null;
  let projectId = 'default';

  function getSectorKey(pId, sx, sy) {
    return 'p_' + pId + '_s_' + sx + '_' + sy;
  }

  function getSettingKey(pId, id) {
    return 'p_' + pId + '_s_' + id;
  }

  self.onmessage = async function(e) {
    const { id, type, payload } = e.data;
    
    try {
      if (type === 'init') {
        if (db) {
          self.postMessage({ id, success: true });
          return;
        }
        const request = indexedDB.open(dbName, version);
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
          db = event.target.result;
          self.postMessage({ id, success: true });
        };
        request.onerror = (event) => {
          self.postMessage({ id, success: false, error: event.target.error ? event.target.error.message : 'Unknown database open error' });
        };
      }
      else if (type === 'setProjectId') {
        projectId = payload || 'default';
        self.postMessage({ id, success: true });
      }
      else if (type === 'saveSector') {
        if (!db) throw new Error('Database not initialized');
        const { sx, sy, sectorData } = payload;
        const key = getSectorKey(projectId, sx, sy);
        
        const transaction = db.transaction(['sectors'], 'readwrite');
        const store = transaction.objectStore('sectors');
        
        if (!sectorData || Object.keys(sectorData.chunks || {}).length === 0) {
          store.delete(key);
        } else {
          store.put({ id: key, ...sectorData });
        }
        
        transaction.oncomplete = () => {
          self.postMessage({ id, success: true });
        };
        transaction.onerror = (event) => {
          self.postMessage({ id, success: false, error: event.target.error ? event.target.error.message : 'Save sector failed' });
        };
      }
      else if (type === 'loadSector') {
        if (!db) throw new Error('Database not initialized');
        const { sx, sy } = payload;
        const key = getSectorKey(projectId, sx, sy);
        
        const transaction = db.transaction(['sectors'], 'readonly');
        const store = transaction.objectStore('sectors');
        const request = store.get(key);
        
        request.onsuccess = () => {
          self.postMessage({ id, success: true, result: request.result });
        };
        request.onerror = (event) => {
          self.postMessage({ id, success: false, error: event.target.error ? event.target.error.message : 'Load sector failed' });
        };
      }
      else if (type === 'getAllSectorKeys') {
        if (!db) throw new Error('Database not initialized');
        const transaction = db.transaction(['sectors'], 'readonly');
        const store = transaction.objectStore('sectors');
        const range = IDBKeyRange.bound('p_' + projectId + '_s_', 'p_' + projectId + '_s_\\uffff');
        const request = store.getAllKeys(range);
        
        request.onsuccess = () => {
          self.postMessage({ id, success: true, result: request.result });
        };
        request.onerror = (event) => {
          self.postMessage({ id, success: false, error: event.target.error ? event.target.error.message : 'Get keys failed' });
        };
      }
      else if (type === 'getAllLegacyKeys') {
        if (!db) throw new Error('Database not initialized');
        const transaction = db.transaction(['chunks'], 'readonly');
        const store = transaction.objectStore('chunks');
        const range = IDBKeyRange.bound('p_' + projectId + '_c_', 'p_' + projectId + '_c_\\uffff');
        const request = store.getAllKeys(range);
        
        request.onsuccess = () => {
          self.postMessage({ id, success: true, result: request.result });
        };
        request.onerror = (event) => {
          self.postMessage({ id, success: false, error: event.target.error ? event.target.error.message : 'Get legacy keys failed' });
        };
      }
      else if (type === 'loadLegacyChunk') {
        if (!db) throw new Error('Database not initialized');
        const chunkId = payload;
        const transaction = db.transaction(['chunks'], 'readonly');
        const store = transaction.objectStore('chunks');
        const request = store.get(chunkId);
        
        request.onsuccess = () => {
          self.postMessage({ id, success: true, result: request.result ? request.result.data : null });
        };
        request.onerror = (event) => {
          self.postMessage({ id, success: false, error: event.target.error ? event.target.error.message : 'Load legacy chunk failed' });
        };
      }
      else if (type === 'deleteLegacyChunk') {
        if (!db) throw new Error('Database not initialized');
        const chunkId = payload;
        const transaction = db.transaction(['chunks'], 'readwrite');
        const store = transaction.objectStore('chunks');
        store.delete(chunkId);
        
        transaction.oncomplete = () => {
          self.postMessage({ id, success: true });
        };
        transaction.onerror = (event) => {
          self.postMessage({ id, success: false, error: event.target.error ? event.target.error.message : 'Delete legacy chunk failed' });
        };
      }
      else if (type === 'saveSetting') {
        if (!db) throw new Error('Database not initialized');
        const { settingId, value } = payload;
        const key = getSettingKey(projectId, settingId);
        
        const transaction = db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');
        store.put({ id: key, value });
        
        transaction.oncomplete = () => {
          self.postMessage({ id, success: true });
        };
        transaction.onerror = (event) => {
          self.postMessage({ id, success: false, error: event.target.error ? event.target.error.message : 'Save setting failed' });
        };
      }
      else if (type === 'loadSetting') {
        if (!db) throw new Error('Database not initialized');
        const settingId = payload;
        const key = getSettingKey(projectId, settingId);
        
        const transaction = db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');
        const request = store.get(key);
        
        request.onsuccess = () => {
          self.postMessage({ id, success: true, result: request.result ? request.result.value : null });
        };
        request.onerror = (event) => {
          self.postMessage({ id, success: false, error: event.target.error ? event.target.error.message : 'Load setting failed' });
        };
      }
      else if (type === 'saveGlobalSetting') {
        if (!db) throw new Error('Database not initialized');
        const { settingId, value } = payload;
        
        const transaction = db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');
        store.put({ id: settingId, value });
        
        transaction.oncomplete = () => {
          self.postMessage({ id, success: true });
        };
        transaction.onerror = (event) => {
          self.postMessage({ id, success: false, error: event.target.error ? event.target.error.message : 'Save global setting failed' });
        };
      }
      else if (type === 'loadGlobalSetting') {
        if (!db) throw new Error('Database not initialized');
        const settingId = payload;
        
        const transaction = db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');
        const request = store.get(settingId);
        
        request.onsuccess = () => {
          self.postMessage({ id, success: true, result: request.result ? request.result.value : null });
        };
        request.onerror = (event) => {
          self.postMessage({ id, success: false, error: event.target.error ? event.target.error.message : 'Load global setting failed' });
        };
      }
      else if (type === 'getStorageStats') {
        if (!db) throw new Error('Database not initialized');
        let size = 0;
        let sectors = 0;
        let chunks = 0;
        const transaction = db.transaction(['sectors'], 'readonly');
        const store = transaction.objectStore('sectors');
        const range = IDBKeyRange.bound('p_' + projectId + '_s_', 'p_' + projectId + '_s_\\uffff');
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
            self.postMessage({ id, success: true, result: { size, sectors, chunks } });
          }
        };
        request.onerror = (event) => {
          self.postMessage({ id, success: false, error: event.target.error ? event.target.error.message : 'Get storage stats failed' });
        };
      }
      else if (type === 'clearDatabase') {
        if (!db) throw new Error('Database not initialized');
        const transaction = db.transaction(['chunks', 'settings', 'sectors'], 'readwrite');
        transaction.objectStore('chunks').clear();
        transaction.objectStore('settings').clear();
        transaction.objectStore('sectors').clear();
        
        transaction.oncomplete = () => {
          self.postMessage({ id, success: true });
        };
        transaction.onerror = (event) => {
          self.postMessage({ id, success: false, error: event.target.error ? event.target.error.message : 'Clear database failed' });
        };
      }
    } catch (err) {
      self.postMessage({ id, success: false, error: err.message });
    }
  };
`;

export class SketchStorage {
  constructor() {
    this.projectId = 'default';
    this.worker = null;
    this.pendingRequests = new Map();
    this._requestCounter = 0;
  }

  setProjectId(id) {
    this.projectId = id || 'default';
    this._sendRequest('setProjectId', this.projectId).catch((err) => {
      console.warn('Failed to set project id in storage worker', err);
    });
  }

  async init() {
    this._requestCounter = 0;
    this.pendingRequests = new Map();

    const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(workerBlob);
    this.worker = new Worker(workerUrl);

    this.worker.onmessage = (e) => {
      const { id, success, result, error } = e.data;
      const pending = this.pendingRequests.get(id);
      if (pending) {
        this.pendingRequests.delete(id);
        if (success) {
          pending.resolve(result);
        } else {
          pending.reject(new Error(error));
        }
      }
    };

    return this._sendRequest('init');
  }

  _sendRequest(type, payload = null) {
    if (!this.worker) {
      return Promise.reject(new Error('Storage Web Worker not initialized'));
    }
    const requestId = 'req_' + (this._requestCounter++);
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
      this.worker.postMessage({ id: requestId, type, payload });
    });
  }

  async saveSector(sx, sy, sectorData) {
    return this._sendRequest('saveSector', { sx, sy, sectorData });
  }

  async loadSector(sx, sy) {
    return this._sendRequest('loadSector', { sx, sy });
  }

  async getAllSectorKeys() {
    return this._sendRequest('getAllSectorKeys');
  }

  async getAllLegacyKeys() {
    return this._sendRequest('getAllLegacyKeys');
  }

  async loadLegacyChunk(id) {
    return this._sendRequest('loadLegacyChunk', id);
  }

  async deleteLegacyChunk(id) {
    return this._sendRequest('deleteLegacyChunk', id);
  }

  async saveSetting(id, value) {
    return this._sendRequest('saveSetting', { settingId: id, value });
  }

  async loadSetting(id) {
    return this._sendRequest('loadSetting', id);
  }

  async saveGlobalSetting(id, value) {
    return this._sendRequest('saveGlobalSetting', { settingId: id, value });
  }

  async loadGlobalSetting(id) {
    return this._sendRequest('loadGlobalSetting', id);
  }

  async getStorageStats() {
    return this._sendRequest('getStorageStats');
  }

  async clearDatabase() {
    return this._sendRequest('clearDatabase');
  }
}
