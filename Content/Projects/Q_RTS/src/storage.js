/**
 * Storage.js
 * Ground-up brutalist IndexedDB wrapper for full offline state persistence.
 */

const DB_NAME = 'MothershipConquestDB';
const DB_VERSION = 1;
const STORE_NAME = 'savestate';

export class GameStorage {
  static init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (e) => {
        resolve(e.target.result);
      };

      request.onerror = (e) => {
        console.error('IndexedDB failed to initialize:', e);
        reject(e.target.error);
      };
    });
  }

  static save(key, data) {
    return this.init().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const payload = { id: key, val: data, timestamp: Date.now() };
        
        const request = store.put(payload);
        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e.target.error);
      });
    });
  }

  static load(key) {
    return this.init().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);
        
        request.onsuccess = (e) => {
          const result = e.target.result;
          resolve(result ? result.val : null);
        };
        request.onerror = (e) => reject(e.target.error);
      });
    });
  }

  static clear() {
    return this.init().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e.target.error);
      });
    });
  }
}
