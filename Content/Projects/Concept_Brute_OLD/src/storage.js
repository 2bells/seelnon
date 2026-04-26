export class SketchStorage {
  constructor() {
    this.dbName = 'BrutSketchDB';
    this.version = 2;
    this.db = null;
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

  async saveChunk(layerId, chunkX, chunkY, imageData) {
    if (!this.db) return;
    const id = `${layerId}_${chunkX}_${chunkY}`;
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['chunks'], 'readwrite');
      const store = transaction.objectStore('chunks');
      store.put({ id, data: imageData });
      transaction.oncomplete = () => resolve();
      transaction.onerror = (e) => reject(e);
    });
  }

  async loadChunk(layerId, chunkX, chunkY) {
    if (!this.db) return null;
    const id = `${layerId}_${chunkX}_${chunkY}`;
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
        const request = store.getAllKeys();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e);
    });
  }

  async saveSetting(id, value) {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');
        store.put({ id, value });
        transaction.oncomplete = () => resolve();
        transaction.onerror = (e) => reject(e);
    });
  }

  async loadSetting(id) {
    if (!this.db) return null;
    return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result ? request.result.value : null);
        request.onerror = (e) => reject(e);
    });
  }
}
