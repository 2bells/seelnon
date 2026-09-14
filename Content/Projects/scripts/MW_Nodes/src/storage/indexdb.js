/**
 * Miliastra Wonderland - IndexedDB Storage Engine
 * Pure Native JS - Zero Dependencies - Persistent Browser Storage
 * Manages Folder Hierarchy and Node Graphs
 */

const DB_NAME = 'MiliastraWonderlandDB';
const DB_VERSION = 1;

class MiliastraIndexedDB {
  constructor() {
    this.db = null;
    this.initPromise = null;
    this.listeners = new Set();
  }

  /**
   * Subscribe to database updates (folders/graphs changed)
   */
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(event, payload) {
    for (const fn of this.listeners) {
      try {
        fn(event, payload);
      } catch (err) {
        console.error('IndexedDB listener error:', err);
      }
    }
  }

  /**
   * Open or initialize the IndexedDB instance
   */
  async init() {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Folders store
        if (!db.objectStoreNames.contains('folders')) {
          const folderStore = db.createObjectStore('folders', { keyPath: 'id' });
          folderStore.createIndex('parentId', 'parentId', { unique: false });
          folderStore.createIndex('name', 'name', { unique: false });
        }

        // Node Graphs store
        if (!db.objectStoreNames.contains('graphs')) {
          const graphStore = db.createObjectStore('graphs', { keyPath: 'id' });
          graphStore.createIndex('folderId', 'folderId', { unique: false });
          graphStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          graphStore.createIndex('name', 'name', { unique: false });
        }
      };

      req.onsuccess = async (e) => {
        this.db = e.target.result;
        try {
          await this.seedDefaultsIfEmpty();
        } catch (seedErr) {
          console.warn('Error during default seeding:', seedErr);
        }
        resolve(this.db);
      };

      req.onerror = (e) => {
        console.error('IndexedDB open failed:', e.target.error);
        reject(e.target.error);
      };
    });

    return this.initPromise;
  }

  /**
   * Seed default folders and starter graphs if database is fresh
   */
  async seedDefaultsIfEmpty() {
    const folders = await this.getFolders();
    if (folders.length > 0) return;

    // Default folders structure
    const defaultFolders = [
      {
        id: 'f_stages',
        name: 'Domain Stages',
        parentId: 'root',
        color: '#e5c07b',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'f_mechanics',
        name: 'Player & Combat Mechanics',
        parentId: 'root',
        color: '#9fb343',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'f_custom',
        name: 'Custom Graphs',
        parentId: 'root',
        color: '#5b92c2',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];

    for (const f of defaultFolders) {
      await this.putRecord('folders', f);
    }

    // Check if graphs exist
    const graphs = await this.getAllGraphs();
    if (graphs.length === 0) {
      // Create initial Open_Garage record in Domain Stages
      const defaultGraphRecord = {
        id: 'graph_open_garage',
        name: 'Open_Garage',
        folderId: 'f_stages',
        type: 'Server',
        nodeCount: 16,
        wireCount: 15,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        data: null // will be populated by main.js if needed or default
      };
      await this.putRecord('graphs', defaultGraphRecord);
    }
  }

  // ================= Low-level IndexedDB Helpers =================

  async getTransaction(storeName, mode = 'readonly') {
    const db = await this.init();
    return db.transaction(storeName, mode);
  }

  async getAllRecords(storeName) {
    const tx = await this.getTransaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getRecord(storeName, key) {
    const tx = await this.getTransaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async putRecord(storeName, value) {
    const tx = await this.getTransaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.put(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteRecord(storeName, key) {
    const tx = await this.getTransaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // ================= Folder Operations =================

  async getFolders() {
    const list = await this.getAllRecords('folders');
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getFolder(id) {
    if (!id || id === 'root') {
      return { id: 'root', name: 'Root Folder', parentId: null };
    }
    return this.getRecord('folders', id);
  }

  async createFolder(name, parentId = 'root') {
    const cleanName = (name || '').trim() || 'New Folder';
    const folder = {
      id: 'f_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      name: cleanName,
      parentId: parentId || 'root',
      color: '#e5c07b',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await this.putRecord('folders', folder);
    this.notify('folder_created', folder);
    return folder;
  }

  async renameFolder(id, newName) {
    if (!id || id === 'root') return null;
    const folder = await this.getRecord('folders', id);
    if (!folder) return null;
    folder.name = (newName || '').trim() || folder.name;
    folder.updatedAt = Date.now();
    await this.putRecord('folders', folder);
    this.notify('folder_renamed', folder);
    return folder;
  }

  async deleteFolder(id) {
    if (!id || id === 'root') return false;
    // Move contained graphs to root or delete them
    const graphs = await this.getAllGraphs();
    for (const g of graphs) {
      if (g.folderId === id) {
        g.folderId = 'root';
        g.updatedAt = Date.now();
        await this.putRecord('graphs', g);
      }
    }
    // Delete any subfolders recursively
    const allFolders = await this.getFolders();
    for (const f of allFolders) {
      if (f.parentId === id) {
        await this.deleteFolder(f.id);
      }
    }
    await this.deleteRecord('folders', id);
    this.notify('folder_deleted', { id });
    return true;
  }

  // ================= Graph Operations =================

  async getAllGraphs() {
    const list = await this.getAllRecords('graphs');
    return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async getGraphsByFolder(folderId = 'root') {
    const all = await this.getAllGraphs();
    if (!folderId || folderId === 'all') return all;
    return all.filter(g => (g.folderId || 'root') === folderId);
  }

  async getGraph(id) {
    return this.getRecord('graphs', id);
  }

  /**
   * Save or update a GraphState instance in IndexedDB
   * @param {GraphState|object} graphState - GraphState or plain object
   * @param {string} [folderId] - target folder id
   */
  async saveGraph(graphState, folderId = null) {
    if (!graphState) return null;

    const snap = typeof graphState.toJSON === 'function' ? graphState.toJSON() : graphState;
    const id = graphState.id || snap.id || ('g_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
    if (graphState && !graphState.id) graphState.id = id;

    const existing = await this.getRecord('graphs', id);
    const targetFolder = folderId || graphState.folderId || (existing ? existing.folderId : 'root') || 'root';
    if (graphState) graphState.folderId = targetFolder;

    const nodeCount = Array.isArray(snap.nodes) ? snap.nodes.length : 0;
    const wireCount = Array.isArray(snap.wires) ? snap.wires.length : 0;

    const record = {
      id,
      name: snap.name || 'Node_Graph',
      folderId: targetFolder,
      type: snap.type || 'Server',
      nodeCount,
      wireCount,
      data: snap,
      createdAt: existing ? existing.createdAt : Date.now(),
      updatedAt: Date.now()
    };

    await this.putRecord('graphs', record);
    this.notify('graph_saved', record);
    return record;
  }

  async renameGraph(id, newName) {
    const record = await this.getRecord('graphs', id);
    if (!record) return null;
    record.name = (newName || '').trim() || record.name;
    if (record.data) record.data.name = record.name;
    record.updatedAt = Date.now();
    await this.putRecord('graphs', record);
    this.notify('graph_renamed', record);
    return record;
  }

  async moveGraph(id, targetFolderId) {
    const record = await this.getRecord('graphs', id);
    if (!record) return null;
    record.folderId = targetFolderId || 'root';
    if (record.data) record.data.folderId = record.folderId;
    record.updatedAt = Date.now();
    await this.putRecord('graphs', record);
    this.notify('graph_moved', record);
    return record;
  }

  async duplicateGraph(id, newName = '') {
    const source = await this.getRecord('graphs', id);
    if (!source) return null;

    const copyId = 'g_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const copyName = newName || `${source.name}_Copy`;
    const copyData = source.data ? JSON.parse(JSON.stringify(source.data)) : {};
    copyData.id = copyId;
    copyData.name = copyName;

    const record = {
      ...source,
      id: copyId,
      name: copyName,
      data: copyData,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await this.putRecord('graphs', record);
    this.notify('graph_created', record);
    return record;
  }

  async deleteGraph(id) {
    await this.deleteRecord('graphs', id);
    this.notify('graph_deleted', { id });
    return true;
  }

  /**
   * Export all database data to a clean JSON object for backup
   */
  async exportAll() {
    const folders = await this.getAllRecords('folders');
    const graphs = await this.getAllRecords('graphs');
    return {
      version: 1,
      appName: 'Miliastra Wonderland',
      exportedAt: Date.now(),
      folders,
      graphs
    };
  }

  /**
   * Import database data from JSON backup
   */
  async importAll(payload) {
    if (!payload || typeof payload !== 'object') return false;
    if (Array.isArray(payload.folders)) {
      for (const f of payload.folders) {
        await this.putRecord('folders', f);
      }
    }
    if (Array.isArray(payload.graphs)) {
      for (const g of payload.graphs) {
        await this.putRecord('graphs', g);
      }
    }
    this.notify('imported_all', payload);
    return true;
  }
}

// Export singleton instance
export const graphStorage = new MiliastraIndexedDB();
