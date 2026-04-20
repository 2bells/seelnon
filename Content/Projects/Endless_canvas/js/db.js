/**
 * js/db.js - Brutalist IndexedDB wrapper for heavy image assets.
 * Keeps the main localStorage state small and fast.
 */

const DB_NAME = 'EndlessCanvasAssetDrive';
const STORE_NAME = 'imageAssets';
const STATE_STORE = 'canvasState';
const DB_VERSION = 2; // Bump version for new store

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
            if (!db.objectStoreNames.contains(STATE_STORE)) {
                db.createObjectStore(STATE_STORE);
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

export async function saveCanvasState(key, data) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STATE_STORE, 'readwrite');
        const store = transaction.objectStore(STATE_STORE);
        const request = store.put(data, key);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

export async function getCanvasState(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STATE_STORE, 'readonly');
        const store = transaction.objectStore(STATE_STORE);
        const request = store.get(key);
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
    const db = await openDB();
    const stores = [STORE_NAME, STATE_STORE];
    let totalChars = 0;

    for (const storeName of stores) {
        await new Promise((resolve) => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = (e) => {
                const all = e.target.result;
                all.forEach(item => {
                    const str = typeof item === 'string' ? item : JSON.stringify(item);
                    totalChars += str.length;
                });
                resolve();
            };
            request.onerror = () => resolve();
        });
    }

    return totalChars * 2;
}

export async function clearAllAssets() {
    const db = await openDB();
    const stores = [STORE_NAME, STATE_STORE];
    
    for (const storeName of stores) {
        await new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }
}
