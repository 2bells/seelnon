/**
 * Kangxi Radical Calligraphy Trainer - IndexedDB Persistence Engine (db.js)
 * Fully local, offline-first storage to bypass LocalStorage 5MB limits and
 * handle unlimited stroke/character vector data and progress records.
 */

const DB_NAME = 'KangxiTrainerDB';
const DB_VERSION = 1;

let dbPromise = null;

function initDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      console.warn('IndexedDB is not supported in this browser. Falling back to in-memory/LocalStorage.');
      resolve(null);
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB failed to open:', event.target.error);
      resolve(null); // Resolve with null so the app falls back gracefully
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create svg_cache store (for hanzi-writer character vector datasets)
      if (!db.objectStoreNames.contains('svg_cache')) {
        db.createObjectStore('svg_cache');
      }

      // Create app_state store (for srs_state, config, radicals list, etc.)
      if (!db.objectStoreNames.contains('app_state')) {
        db.createObjectStore('app_state');
      }
    };
  });

  return dbPromise;
}

// Helper to perform a read transaction
async function readKey(storeName, key) {
  const db = await initDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch (e) {
      console.error(`IndexedDB readKey error in store ${storeName}:`, e);
      resolve(null);
    }
  });
}

// Helper to perform a write transaction
async function writeKey(storeName, key, value) {
  const db = await initDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(value, key);

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch (e) {
      console.error(`IndexedDB writeKey error in store ${storeName}:`, e);
      resolve(false);
    }
  });
}

// Helper to perform a delete transaction
async function deleteKey(storeName, key) {
  const db = await initDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch (e) {
      console.error(`IndexedDB deleteKey error in store ${storeName}:`, e);
      resolve(false);
    }
  });
}

// --- PUBLIC API ---

export async function getCachedSvg(char) {
  return await readKey('svg_cache', char);
}

export async function setCachedSvg(char, data) {
  return await writeKey('svg_cache', char, data);
}

export async function getSrsState() {
  return await readKey('app_state', 'srs_state');
}

export async function setSrsState(state) {
  return await writeKey('app_state', 'srs_state', state);
}

export async function getSrsConfig() {
  return await readKey('app_state', 'srs_config');
}

export async function setSrsConfig(config) {
  return await writeKey('app_state', 'srs_config', config);
}

export async function getRadicalsCache() {
  return await readKey('app_state', 'radicals_all_cached');
}

export async function setRadicalsCache(radicals) {
  return await writeKey('app_state', 'radicals_all_cached', radicals);
}

// Check how many items are currently cached inside IndexedDB stores for diagnostic / status display
export async function getDbStorageStats() {
  const db = await initDB();
  if (!db) return { svgsCount: 0, srsCount: 0 };

  const countStore = (storeName) => new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    } catch (e) {
      resolve(0);
    }
  });

  const svgsCount = await countStore('svg_cache');
  return { svgsCount };
}
