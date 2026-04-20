/**
 * js/db.js - Brutalist IndexedDB wrapper for heavy image assets.
 * Keeps the main localStorage state small and fast.
 */

const DB_NAME = 'EndlessCanvasAssetDrive';
const STORE_NAME = 'imageAssets';
const DB_VERSION = 1;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

export async function saveImageAsset(id, dataUrl) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(dataUrl, id);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

export async function getImageAsset(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

export async function deleteImageAsset(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

export async function getDBSize() {
    // Note: Estimating size in IndexedDB is browser-dependent, 
    // but we can estimate based on stored string lengths for our simple use case.
    const db = await openDB();
    return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = (e) => {
            const all = e.target.result;
            let totalChars = 0;
            all.forEach(str => {
                if (typeof str === 'string') totalChars += str.length;
            });
            // Roughly 2 bytes per character for UTF-16 strings
            resolve(totalChars * 2);
        };
        request.onerror = () => resolve(0);
    });
}
