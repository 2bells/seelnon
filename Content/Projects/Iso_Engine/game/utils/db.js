// rpg/game/utils/db.js
console.log("rpg/game/utils/db.js loaded");

/**
 * Robust IndexedDB utility to store local RPG assets and map data, bypassing the 5MB localStorage limit.
 * Gracefully falls back to localStorage if IndexedDB is unavailable or blocked in iframe sandboxes.
 */

const DB_NAME = 'rpg_engine_db';
const DB_VERSION = 1;

// Define our virtual folders (stores)
export const STORES = {
    MAPS: 'maps',
    PREFABS: 'prefabs', // Object2 custom baked prefabs
    NPCS: 'npcs',
    ABILITIES: 'abilities',
    ITEMS: 'items',
    PROJECTILES: 'projectiles',
    EVENTS: 'events'
};

let dbInstance = null;
let isIndexedDBAvailable = true;

// Pre-flight check to see if IndexedDB is supported and accessible
try {
    if (!window.indexedDB) {
        console.warn("IndexedDB not supported in this browser. Falling back to localStorage wrapper.");
        isIndexedDBAvailable = false;
    }
} catch (e) {
    console.warn("IndexedDB blocked or throws access error. Falling back to localStorage wrapper.", e);
    isIndexedDBAvailable = false;
}

/**
 * Open or upgrade the database connection
 */
function initDB() {
    if (!isIndexedDBAvailable) return Promise.reject("IndexedDB unavailable");
    if (dbInstance) return Promise.resolve(dbInstance);

    return new Promise((resolve, reject) => {
        try {
            const request = window.indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Create object stores for each virtual directory/folder
                Object.values(STORES).forEach(storeName => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        db.createObjectStore(storeName);
                    }
                });
                console.log("IndexedDB stores initialized successfully.");
            };

            request.onsuccess = (event) => {
                dbInstance = event.target.result;
                resolve(dbInstance);
            };

            request.onerror = (event) => {
                console.error("Failed to open IndexedDB:", event.target.error);
                isIndexedDBAvailable = false; // Fallback to localStorage on failure
                resolve(null);
            };
        } catch (err) {
            console.error("Catch error opening IndexedDB:", err);
            isIndexedDBAvailable = false;
            resolve(null);
        }
    });
}

/**
 * Helper to execute a transaction on a store
 */
async function runTransaction(storeName, mode, callback) {
    if (!isIndexedDBAvailable) {
        return handleLocalStorageFallback(storeName, mode, callback);
    }

    try {
        const db = await initDB();
        if (!db) {
            return handleLocalStorageFallback(storeName, mode, callback);
        }

        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, mode);
            const store = tx.objectStore(storeName);
            let result = null;

            callback(store, (res) => {
                result = res;
            });

            tx.oncomplete = () => {
                resolve(result);
            };

            tx.onerror = (event) => {
                console.error(`IndexedDB transaction error for store "${storeName}":`, tx.error || event.target.error);
                reject(tx.error || event.target.error);
            };
        });
    } catch (err) {
        console.warn(`IndexedDB transaction failed. Trying localStorage fallback...`, err);
        return handleLocalStorageFallback(storeName, mode, callback);
    }
}

/**
 * LocalStorage Fallback Handler
 * To keep code compatible, we structure localStorage keys as:
 * "rpg_db_fallback_[storeName]_[key]"
 */
function handleLocalStorageFallback(storeName, mode, callback) {
    console.warn(`[LocalDB Fallback] Executing operation on store "${storeName}" via localStorage.`);
    const keyPrefix = `rpg_db_fallback_${storeName}_`;
    
    // Create an API mimicking a subset of ObjectStore
    const fakeStore = {
        get: (reqKey) => {
            const dataStr = localStorage.getItem(`${keyPrefix}${reqKey}`);
            let value = null;
            if (dataStr !== null) {
                try { value = JSON.parse(dataStr); } catch(e) { value = dataStr; }
            }
            return { result: value, onsuccess: null };
        },
        put: (val, reqKey) => {
            const key = reqKey;
            localStorage.setItem(`${keyPrefix}${key}`, JSON.stringify(val));
            return { result: key, onsuccess: null };
        },
        delete: (reqKey) => {
            localStorage.removeItem(`${keyPrefix}${reqKey}`);
            return { result: undefined, onsuccess: null };
        },
        getAllKeys: () => {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k.startsWith(keyPrefix)) {
                    keys.push(k.substring(keyPrefix.length));
                }
            }
            return { result: keys, onsuccess: null };
        },
        getAll: () => {
            const items = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k.startsWith(keyPrefix)) {
                    const dataStr = localStorage.getItem(k);
                    try { items.push(JSON.parse(dataStr)); } catch(e) { items.push(dataStr); }
                }
            }
            return { result: items, onsuccess: null };
        }
    };

    return new Promise((resolve) => {
        let callbackResult = null;
        callback(fakeStore, (res) => {
            callbackResult = res;
        });
        // Immediately resolve for localStorage
        resolve(callbackResult);
    });
}

/**
 * --- PUBLIC APIS ---
 */

export const db = {
    /**
     * Store an item in a virtual folder (store)
     * @param {string} storeName - One of STORES values
     * @param {string} key - Unique key string
     * @param {any} value - Serializable object/value to store
     */
    async set(storeName, key, value) {
        return runTransaction(storeName, 'readwrite', (store, setResult) => {
            const request = store.put(value, key);
            request.onsuccess = () => {
                setResult(request.result || key);
            };
        });
    },

    /**
     * Retrieve an item from a virtual folder (store)
     * @param {string} storeName - One of STORES values
     * @param {string} key - Unique key string
     * @returns {Promise<any>} The stored value, or null if not found
     */
    async get(storeName, key) {
        return runTransaction(storeName, 'readonly', (store, setResult) => {
            const request = store.get(key);
            request.onsuccess = () => {
                setResult(request.result);
            };
        });
    },

    /**
     * Delete an item from a virtual folder (store)
     * @param {string} storeName - One of STORES values
     * @param {string} key - Unique key string
     */
    async delete(storeName, key) {
        return runTransaction(storeName, 'readwrite', (store, setResult) => {
            const request = store.delete(key);
            request.onsuccess = () => {
                setResult(true);
            };
        });
    },

    /**
     * List all keys in a virtual folder (store)
     * @param {string} storeName - One of STORES values
     * @returns {Promise<string[]>} List of keys
     */
    async getAllKeys(storeName) {
        return runTransaction(storeName, 'readonly', (store, setResult) => {
            // Check if getAllKeys is supported by store (standard in modern browsers)
            if (typeof store.getAllKeys === 'function') {
                const request = store.getAllKeys();
                request.onsuccess = () => {
                    setResult(request.result || []);
                };
            } else {
                // Fallback cursor implementation if getAllKeys not supported
                const keys = [];
                const request = store.openKeyCursor ? store.openKeyCursor() : store.openCursor();
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        keys.push(cursor.key);
                        cursor.continue();
                    } else {
                        setResult(keys);
                    }
                };
            }
        });
    },

    /**
     * Fetch all items in a virtual folder (store)
     * @param {string} storeName - One of STORES values
     * @returns {Promise<any[]>} List of stored items
     */
    async getAll(storeName) {
        return runTransaction(storeName, 'readonly', (store, setResult) => {
            if (typeof store.getAll === 'function') {
                const request = store.getAll();
                request.onsuccess = () => {
                    setResult(request.result || []);
                };
            } else {
                // Fallback cursor implementation
                const list = [];
                const request = store.openCursor();
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        list.push(cursor.value);
                        cursor.continue();
                    } else {
                        setResult(list);
                    }
                };
            }
        });
    },

    /**
     * Check if IndexedDB is currently operating or falling back
     */
    isUsingIndexedDB() {
        return isIndexedDBAvailable;
    }
};
