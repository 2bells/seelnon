export class SketchStorage {
  constructor() {
    this.dbName = 'BrutSketchDB';
    this.version = 2;
    this.db = null;
    this.projectId = 'default';
  }

  setProjectId(id) {
    this.projectId = id || 'default';
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('chunks')) {
          db.createObjectStore('chunks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      request.onerror = (e) => reject(e);
    });
  }

  _getChunkKey(layerId, cx, cy) {
    return `p_${this.projectId}_c_${layerId}_${cx}_${cy}`;
  }

  async saveChunk(layerId, chunkX, chunkY, imageData) {
    if (!this.db) return;
    const id = this._getChunkKey(layerId, chunkX, chunkY);
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['chunks'], 'readwrite');
      const store = transaction.objectStore('chunks');
      store.put({ id, data: imageData });
      transaction.oncomplete = () => resolve();
      transaction.onerror = (e) => reject(e);
    });
  }

  async deleteChunk(layerId, chunkX, chunkY) {
    if (!this.db) return;
    const id = this._getChunkKey(layerId, chunkX, chunkY);
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['chunks'], 'readwrite');
      const store = transaction.objectStore('chunks');
      store.delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = (e) => reject(e);
    });
  }

  async loadChunk(layerId, chunkX, chunkY) {
    if (!this.db) return null;
    const id = this._getChunkKey(layerId, chunkX, chunkY);
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['chunks'], 'readonly');
      const store = transaction.objectStore('chunks');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result ? request.result.data : null);
      request.onerror = (e) => reject(e);
    });
  }

  async getAllKeys() {
    if (!this.db) return [];
    return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['chunks'], 'readonly');
        const store = transaction.objectStore('chunks');
        const range = IDBKeyRange.bound(`p_${this.projectId}_c_`, `p_${this.projectId}_c_\uffff`);
        const request = store.getAllKeys(range);
        request.onsuccess = () => {
            // Strip the project prefix for the engine to consume
            resolve(request.result.map(k => k.replace(`p_${this.projectId}_c_`, '')));
        };
        request.onerror = (e) => reject(e);
    });
  }

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

  async estimateSize() {
      if (!this.db) return 0;
      return new Promise((resolve) => {
          let size = 0;
          const transaction = this.db.transaction(['chunks'], 'readonly');
          const store = transaction.objectStore('chunks');
          const request = store.openCursor();
          request.onsuccess = (e) => {
              const cursor = e.target.result;
              if (cursor) {
                  size += (cursor.value.data?.length || 0);
                  cursor.continue();
              } else {
                  resolve(size);
              }
          };
      });
  }

  async clearDatabase() {
      return new Promise((resolve, reject) => {
          const transaction = this.db.transaction(['chunks', 'settings'], 'readwrite');
          transaction.objectStore('chunks').clear();
          transaction.objectStore('settings').clear();
          transaction.oncomplete = () => resolve();
          transaction.onerror = (e) => reject(e);
      });
  }
}
