/**
 * js/save-worker.js - Background worker for non-blocking IndexedDB writes.
 * Frees the main thread paint loop from database transactions and serialization.
 */

const DB_NAME = 'EndlessCanvasAssetDrive';
const STORE_NAME = 'imageAssets';
const STATE_STORE = 'canvasState';
const SECTORS_STORE = 'sectors';
const PROJECTS_STORE = 'projects';
const DB_VERSION = 4;

let dbPromise = null;

function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
            if (!db.objectStoreNames.contains(STATE_STORE)) {
                db.createObjectStore(STATE_STORE);
            }
            if (!db.objectStoreNames.contains(SECTORS_STORE)) {
                db.createObjectStore(SECTORS_STORE);
            }
            if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
                db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
    return dbPromise;
}

self.onmessage = async (e) => {
    const { id, type, payload } = e.data;
    try {
        const db = await openDB();
        
        if (type === 'saveSector') {
            const { key, strokes } = payload;
            const transaction = db.transaction(SECTORS_STORE, 'readwrite');
            const store = transaction.objectStore(SECTORS_STORE);
            const request = store.put(strokes, key);
            
            request.onsuccess = () => {
                self.postMessage({ id, success: true });
            };
            request.onerror = (err) => {
                self.postMessage({ id, success: false, error: err.target.error ? err.target.error.message : 'Write failed' });
            };
        } else if (type === 'saveCanvasState') {
            const { key, data } = payload;
            const transaction = db.transaction(STATE_STORE, 'readwrite');
            const store = transaction.objectStore(STATE_STORE);
            const request = store.put(data, key);
            
            request.onsuccess = () => {
                self.postMessage({ id, success: true });
            };
            request.onerror = (err) => {
                self.postMessage({ id, success: false, error: err.target.error ? err.target.error.message : 'Write failed' });
            };
        } else if (type === 'saveProjectMeta') {
            const { meta } = payload;
            const transaction = db.transaction(PROJECTS_STORE, 'readwrite');
            const store = transaction.objectStore(PROJECTS_STORE);
            const request = store.put(meta);
            
            request.onsuccess = () => {
                self.postMessage({ id, success: true });
            };
            request.onerror = (err) => {
                self.postMessage({ id, success: false, error: err.target.error ? err.target.error.message : 'Write failed' });
            };
        } else if (type === 'saveImageAsset') {
            const { key, dataUrl } = payload;
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(dataUrl, key);
            
            request.onsuccess = () => {
                self.postMessage({ id, success: true });
            };
            request.onerror = (err) => {
                self.postMessage({ id, success: false, error: err.target.error ? err.target.error.message : 'Write failed' });
            };
        } else if (type === 'clearAll') {
            const stores = [STORE_NAME, STATE_STORE, PROJECTS_STORE, SECTORS_STORE];
            const transaction = db.transaction(stores, 'readwrite');
            stores.forEach(storeName => {
                transaction.objectStore(storeName).clear();
            });
            
            transaction.oncomplete = () => {
                self.postMessage({ id, success: true });
            };
            transaction.onerror = (err) => {
                self.postMessage({ id, success: false, error: err.target.error ? err.target.error.message : 'Clear failed' });
            };
        }
    } catch (err) {
        self.postMessage({ id, success: false, error: err.message });
    }
};
