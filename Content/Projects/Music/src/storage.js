/**
 * STORAGE ENGINE - IndexedDB persistent store for tracks, audio blobs, and app state.
 * Enables local files to persist across page reloads without relying on transient object URLs.
 */

const DB_NAME = 'BrutalAudioPlayerDB';
const DB_VERSION = 1;
const STORE_TRACKS = 'tracks';
const STORE_STATE = 'state';

let dbInstance = null;

export async function initStorage() {
  if (dbInstance) return dbInstance;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_TRACKS)) {
        const trackStore = db.createObjectStore(STORE_TRACKS, { keyPath: 'id' });
        trackStore.createIndex('artist', 'artist', { unique: false });
        trackStore.createIndex('album', 'album', { unique: false });
        trackStore.createIndex('genre', 'genre', { unique: false });
        trackStore.createIndex('dateAdded', 'dateAdded', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_STATE)) {
        db.createObjectStore(STORE_STATE, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB init error:', event.target.error);
      reject(event.target.error);
    };
  });
}

export async function saveTrack(track) {
  const db = await initStorage();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_TRACKS], 'readwrite');
    const store = tx.objectStore(STORE_TRACKS);
    const req = store.put(track);
    req.onsuccess = () => resolve(track);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function saveTracks(tracks) {
  const db = await initStorage();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_TRACKS], 'readwrite');
    const store = tx.objectStore(STORE_TRACKS);
    tracks.forEach((track) => store.put(track));
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function getAllTracks() {
  const db = await initStorage();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_TRACKS], 'readonly');
    const store = tx.objectStore(STORE_TRACKS);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function deleteTrack(id) {
  const db = await initStorage();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_TRACKS], 'readwrite');
    const store = tx.objectStore(STORE_TRACKS);
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function clearAllTracks() {
  const db = await initStorage();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_TRACKS], 'readwrite');
    const store = tx.objectStore(STORE_TRACKS);
    const req = store.clear();
    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function saveAppState(key, value) {
  const db = await initStorage();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_STATE], 'readwrite');
    const store = tx.objectStore(STORE_STATE);
    const req = store.put({ key, value });
    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function getAppState(key, defaultValue = null) {
  const db = await initStorage();
  return new Promise((resolve) => {
    const tx = db.transaction([STORE_STATE], 'readonly');
    const store = tx.objectStore(STORE_STATE);
    const req = store.get(key);
    req.onsuccess = () => {
      resolve(req.result ? req.result.value : defaultValue);
    };
    req.onerror = () => resolve(defaultValue);
  });
}
