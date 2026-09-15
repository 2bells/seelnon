/**
 * Miliastra Wonderland - Node Graph Explorer
 * Authentic Folder-based Node Graph Resource Manager
 * Integrates directly with IndexedDB for long-term persistent storage.
 */

import { graphStorage } from './indexdb.js';
import { GraphState } from '../graphState.js';

let zIndexCounter = 350;

export class NodeGraphExplorer {
  static draggingGraphId = null;
  /**
   * @param {object} app - The main MiliastraApp instance
   */
  constructor(app) {
    this.app = app;
    this.isOpen = false;
    this.currentFolderId = 'all'; // 'all' | 'root' | folder_id
    this.searchQuery = '';
    this.sortMode = 'date_desc'; // 'date_desc' | 'name_asc' | 'nodes_desc'

    this.folders = [];
    this.graphs = [];

    this.initDom();
    this.bindEvents();

    // Subscribe to database changes to stay in sync
    graphStorage.subscribe((event, data) => {
      if (this.isOpen) {
        this.loadAndRefresh();
      }
    });
  }

  bringToFront() {
    this.card.style.zIndex = `${++zIndexCounter}`;
  }

  initDom() {
    this.card = document.createElement('div');
    this.card.className = 'graph-explorer-card';
    this.card.id = 'graphExplorerCard';
    this.card.style.display = 'none';
    this.card.style.position = 'fixed';
    this.card.style.zIndex = `${++zIndexCounter}`;

    // Center window by default
    const left = Math.max(20, Math.floor((window.innerWidth - 820) / 2));
    const top = Math.max(50, Math.floor((window.innerHeight - 600) / 2));
    this.card.style.left = `${left}px`;
    this.card.style.top = `${top}px`;

    this.card.innerHTML = `
      <!-- Header -->
      <div class="ge-header" id="geHeader">
        <div class="ge-header-left">
          <span class="ge-header-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              <line x1="12" y1="11" x2="12" y2="17"/>
              <line x1="9" y1="14" x2="15" y2="14"/>
            </svg>
          </span>
          <span class="ge-header-title">Node Graph Explorer</span>
          <span class="ge-header-badge" id="geTotalBadge">0 Graphs</span>
        </div>
        <div class="ge-header-actions">
          <button class="ge-btn-icon" id="geRefreshBtn" title="Refresh Database">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
          <button class="ge-btn-icon ge-close-btn" id="geCloseBtn" title="Close Explorer">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="ge-toolbar">
        <div class="ge-toolbar-left">
          <div class="ge-breadcrumbs" id="geBreadcrumbs">
            <span class="ge-crumb-item active">All Graphs</span>
          </div>
        </div>

        <div class="ge-toolbar-actions">
          <div class="ge-search-box">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" class="ge-search-icon">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" class="ge-search-input" id="geSearchInput" placeholder="Search graphs..." autocomplete="off" />
            <button class="ge-search-clear" id="geSearchClear" style="display:none;">✕</button>
          </div>

          <button class="ge-btn-primary" id="geBtnNewGraph" title="Create New Node Graph">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Main Body (Sidebar + Content) -->
      <div class="ge-body">
        <!-- Sidebar: Folder Tree -->
        <div class="ge-sidebar">
          <div class="ge-sidebar-title-row">
            <span>Folders & Categories</span>
          </div>
          <div class="ge-tree-scroll" id="geTreeContainer"></div>
          <div class="ge-sidebar-bottom">
            <button class="ge-btn-add-folder" id="geBtnSidebarAddFolder">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span>Add Folder</span>
            </button>
          </div>
        </div>

        <!-- Content: File and Graph Cards -->
        <div class="ge-content">
          <div class="ge-content-header" id="geContentHeader">
            <span id="geContentSummary">0 items</span>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:11px;">Sort:</span>
              <select id="geSortSelect" style="background:#141620;border:1px solid #2d3545;color:#e2e8f0;font-size:11px;padding:2px 6px;border-radius:3px;outline:none;">
                <option value="date_desc">Last Modified</option>
                <option value="name_asc">Name (A-Z)</option>
                <option value="nodes_desc">Node Count</option>
              </select>
            </div>
          </div>
          <div class="ge-content-scroll" id="geContentScroll"></div>
        </div>
      </div>

      <!-- Footer Status Bar -->
      <div class="ge-footer">
        <div class="ge-footer-left">
          <span class="ge-status-dot"></span>
          <span>IndexedDB: Connected (Persistence Ready)</span>
        </div>
        <div>
          <span id="geFooterActiveGraph">Active: None</span>
        </div>
      </div>

      <!-- Modal Prompt Placeholder -->
      <div class="ge-prompt-overlay" id="gePromptOverlay" style="display:none;"></div>
    `;

    document.body.appendChild(this.card);

    // Create and append body-level context menus to prevent clipping and ensure topmost layering
    const ctxMenu = document.createElement('div');
    ctxMenu.className = 'ge-ctx-menu';
    ctxMenu.id = 'geCtxMenu';
    ctxMenu.style.display = 'none';
    ctxMenu.innerHTML = `
      <div class="ge-ctx-item" id="geCtxNewGraph">Create Node Graph</div>
      <div class="ge-ctx-item ge-ctx-has-sub">
        Sort <span style="margin-left:auto;">›</span>
        <div class="ge-ctx-submenu">
          <div class="ge-ctx-subitem" data-sort="date_desc">Last Modified</div>
          <div class="ge-ctx-subitem" data-sort="name_asc">Name (A-Z)</div>
          <div class="ge-ctx-subitem" data-sort="nodes_desc">Node Count</div>
        </div>
      </div>
    `;
    document.body.appendChild(ctxMenu);

    const graphCtxMenu = document.createElement('div');
    graphCtxMenu.className = 'ge-ctx-menu';
    graphCtxMenu.id = 'geGraphCtxMenu';
    graphCtxMenu.style.display = 'none';
    graphCtxMenu.innerHTML = `
      <div class="ge-ctx-item" id="geGraphCtxOpen">Open</div>
      <div class="ge-ctx-item" id="geGraphCtxRename">Rename</div>
      <div class="ge-ctx-item" id="geGraphCtxDuplicate">Duplicate</div>
      <div class="ge-ctx-item ge-ctx-has-sub" id="geGraphCtxMoveParent">
        Move to <span style="margin-left:auto;">›</span>
        <div class="ge-ctx-submenu" id="geGraphCtxMoveSub">
          <div class="ge-ctx-subitem" data-folder="root">Root Directory</div>
        </div>
      </div>
      <div class="ge-ctx-item" id="geGraphCtxDelete" style="color:#f43f5e;">Delete</div>
      <div class="ge-ctx-item" id="geGraphCtxExport">Export</div>
    `;
    document.body.appendChild(graphCtxMenu);
  }

  bindEvents() {
    // Make window draggable
    const header = this.card.querySelector('#geHeader');
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      initialLeft = this.card.offsetLeft;
      initialTop = this.card.offsetTop;
      this.bringToFront();
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      this.card.style.left = `${Math.max(10, initialLeft + dx)}px`;
      this.card.style.top = `${Math.max(10, initialTop + dy)}px`;
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    this.card.addEventListener('mousedown', () => {
      this.bringToFront();
    });

    // Close button
    this.card.querySelector('#geCloseBtn').addEventListener('click', () => {
      this.close();
    });

    // Refresh button
    this.card.querySelector('#geRefreshBtn').addEventListener('click', () => {
      this.loadAndRefresh();
    });

    // New Folder button
    const openNewFolder = () => this.promptNewFolder();
    this.card.querySelector('#geBtnSidebarAddFolder').addEventListener('click', openNewFolder);

    // New Graph button
    this.card.querySelector('#geBtnNewGraph').addEventListener('click', () => {
      this.promptNewGraph();
    });

    // Search input
    const searchInput = this.card.querySelector('#geSearchInput');
    const searchClear = this.card.querySelector('#geSearchClear');

    searchInput.addEventListener('input', (e) => {
      this.searchQuery = (e.target.value || '').trim().toLowerCase();
      searchClear.style.display = this.searchQuery ? 'block' : 'none';
      this.renderContent();
    });

    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      this.searchQuery = '';
      searchClear.style.display = 'none';
      this.renderContent();
    });

    // Sort selector
    const sortSelect = this.card.querySelector('#geSortSelect');
    sortSelect.addEventListener('change', (e) => {
      this.sortMode = e.target.value;
      this.renderContent();
    });

    // Context Menu
    const ctxMenu = document.getElementById('geCtxMenu');
    const graphCtxMenu = document.getElementById('geGraphCtxMenu');
    const contentScroll = this.card.querySelector('#geContentScroll');
    const treeContainer = this.card.querySelector('#geTreeContainer');

    const hideMenus = () => {
      if (ctxMenu) ctxMenu.style.display = 'none';
      if (graphCtxMenu) graphCtxMenu.style.display = 'none';
    };

    contentScroll.addEventListener('contextmenu', (e) => {
      // Only show general context menu if not right-clicking a graph card
      if (e.target.closest('.ge-graph-card')) return;
      e.preventDefault();
      if (graphCtxMenu) graphCtxMenu.style.display = 'none';
      ctxMenu.style.left = `${e.clientX}px`;
      ctxMenu.style.top = `${e.clientY}px`;
      ctxMenu.style.display = 'block';
    });

    contentScroll.addEventListener('scroll', hideMenus);
    if (treeContainer) treeContainer.addEventListener('scroll', hideMenus);
    window.addEventListener('scroll', hideMenus, true);

    document.addEventListener('click', () => {
      hideMenus();
    });

    const ctxNewGraphBtn = document.getElementById('geCtxNewGraph');
    if (ctxNewGraphBtn) {
      ctxNewGraphBtn.addEventListener('click', () => {
        hideMenus();
        this.promptNewGraph();
      });
    }

    const graphCtxOpen = document.getElementById('geGraphCtxOpen');
    if (graphCtxOpen) {
      graphCtxOpen.addEventListener('click', () => {
        hideMenus();
        if (this.activeGraph) this.openGraphInEditor(this.activeGraph);
      });
    }

    const graphCtxRename = document.getElementById('geGraphCtxRename');
    if (graphCtxRename) {
      graphCtxRename.addEventListener('click', () => {
        hideMenus();
        if (this.activeGraph) this.promptRenameGraph(this.activeGraph);
      });
    }

    const graphCtxDuplicate = document.getElementById('geGraphCtxDuplicate');
    if (graphCtxDuplicate) {
      graphCtxDuplicate.addEventListener('click', () => {
        hideMenus();
        if (this.activeGraph) this.duplicateGraph(this.activeGraph);
      });
    }

    const graphCtxDelete = document.getElementById('geGraphCtxDelete');
    if (graphCtxDelete) {
      graphCtxDelete.addEventListener('click', async () => {
        hideMenus();
        if (this.activeGraph) {
          await graphStorage.deleteGraph(this.activeGraph.id);
          const idx = this.app.graphs?.findIndex(openG => openG.id === this.activeGraph.id || openG.name === this.activeGraph.name);
          if (idx !== undefined && idx >= 0 && this.app.graphs.length > 1) {
            this.app.closeGraph(idx);
          } else if (idx !== undefined && idx >= 0 && this.app.graphs.length === 1) {
            this.app.state.nodes = [];
            this.app.state.wires = [];
            this.app.renderer.render();
          }
          await this.loadAndRefresh();
        }
      });
    }

    const graphCtxExport = document.getElementById('geGraphCtxExport');
    if (graphCtxExport) {
      graphCtxExport.addEventListener('click', () => {
        hideMenus();
        if (this.activeGraph) this.exportGraph(this.activeGraph);
      });
    }

    const moveSubContainer = document.getElementById('geGraphCtxMoveSub');
    if (moveSubContainer) {
      moveSubContainer.addEventListener('click', async (e) => {
        const targetFolderId = e.target.getAttribute('data-folder');
        if (targetFolderId && this.activeGraph) {
          if (graphCtxMenu) graphCtxMenu.style.display = 'none';
          const rec = await graphStorage.getRecord('graphs', this.activeGraph.id);
          if (rec) {
            rec.folderId = targetFolderId;
            if (rec.data) rec.data.folderId = targetFolderId;
            rec.updatedAt = Date.now();
            await graphStorage.putRecord('graphs', rec);
            await this.loadAndRefresh();
            if (this.app.simulator) {
              this.app.simulator.log(`Moved graph '${rec.name}' to folder.`, 'info');
            }
          }
        }
      });
    }

    this.card.querySelectorAll('.ge-ctx-subitem').forEach(sub => {
      sub.addEventListener('click', (e) => {
        ctxMenu.style.display = 'none';
        const val = e.target.getAttribute('data-sort');
        const sel = this.card.querySelector('#geSortSelect');
        if (sel) {
          sel.value = val;
          this.sortMode = val;
          this.renderContent();
        }
      });
    });
  }

  async open(folderId = null) {
    if (folderId !== null) {
      this.currentFolderId = folderId;
    }
    this.isOpen = true;
    this.card.style.display = 'flex';
    this.bringToFront();
    await this.loadAndRefresh();
  }

  close() {
    this.isOpen = false;
    this.card.style.display = 'none';
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  async loadAndRefresh() {
    try {
      await graphStorage.init();
      this.folders = await graphStorage.getFolders();
      let allGraphs = await graphStorage.getAllGraphs();

      // Deduplication safeguard: clean up any redundant records with the same name from previous sessions
      const nameMap = new Map();
      for (const g of allGraphs) {
        if (!g || !g.name) continue;
        const list = nameMap.get(g.name) || [];
        list.push(g);
        nameMap.set(g.name, list);
      }
      for (const [, list] of nameMap.entries()) {
        if (list.length > 1) {
          list.sort((a, b) => ((b && b.updatedAt) || 0) - ((a && a.updatedAt) || 0));
          const keep = list.find(item => item && this.app?.state?.id === item.id) || list[0];
          for (const dup of list) {
            if (dup && keep && dup.id !== keep.id) {
              await graphStorage.deleteGraph(dup.id);
            }
          }
        }
      }

      this.graphs = (await graphStorage.getAllGraphs()).filter(Boolean);

      // Synchronize currently open graphs into DB if missing
      if (this.app && Array.isArray(this.app.graphs)) {
        for (const g of this.app.graphs) {
          if (!g) continue;
          if (!g.id) {
            g.id = g.name === 'Open_Garage' ? 'graph_open_garage' : ('g_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
          }
          const found = this.graphs.find(rec => rec && (rec.id === g.id || rec.name === g.name));
          if (!found) {
            await graphStorage.saveGraph(g, g.folderId || 'root');
          } else if (found.id !== g.id) {
            g.id = found.id;
          }
        }
        this.graphs = (await graphStorage.getAllGraphs()).filter(Boolean);
      }

      this.renderTree();
      this.renderContent();
      this.updateFooter();
    } catch (err) {
      console.error('Failed to load explorer data:', err);
    }
  }

  renderTree() {
    const container = this.card.querySelector('#geTreeContainer');
    if (!container) return;
    container.innerHTML = '';

    const setupDropTarget = (el, targetFolderId) => {
      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        el.classList.add('drag-over');
      });
      el.addEventListener('dragleave', (e) => {
        if (!el.contains(e.relatedTarget)) {
          el.classList.remove('drag-over');
        }
      });
      el.addEventListener('drop', async (e) => {
        e.preventDefault();
        el.classList.remove('drag-over');
        try {
          let graphId = NodeGraphExplorer.draggingGraphId || e.dataTransfer.getData('text/plain');
          if (!graphId) {
            try {
              const data = JSON.parse(e.dataTransfer.getData('application/json'));
              graphId = data.graphId;
            } catch {}
          }
          if (graphId) {
            const rec = await graphStorage.getRecord('graphs', graphId);
            if (rec) {
              rec.folderId = targetFolderId;
              if (rec.data) rec.data.folderId = targetFolderId;
              rec.updatedAt = Date.now();
              await graphStorage.putRecord('graphs', rec);
              await this.loadAndRefresh();
              if (this.app.simulator) {
                this.app.simulator.log(`Moved graph '${rec.name}' to folder.`, 'info');
              }
            }
          }
          NodeGraphExplorer.draggingGraphId = null;
        } catch (err) {
          console.error(err);
        }
      });
    };

    // 1. "All Graphs" item
    const allItem = document.createElement('div');
    allItem.className = `ge-tree-item ${this.currentFolderId === 'all' ? 'active' : ''}`;
    allItem.innerHTML = `
      <div class="ge-tree-item-left">
        <span class="ge-tree-icon">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
            <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>
          </svg>
        </span>
        <span class="ge-tree-name">All Graphs</span>
      </div>
      <span class="ge-tree-count">${this.graphs.length}</span>
    `;
    allItem.addEventListener('click', () => {
      this.currentFolderId = 'all';
      this.renderTree();
      this.renderContent();
    });
    container.appendChild(allItem);

    // 2. "Root Directory" item
    const rootGraphs = this.graphs.filter(g => !g.folderId || g.folderId === 'root');
    const rootItem = document.createElement('div');
    rootItem.className = `ge-tree-item ${this.currentFolderId === 'root' ? 'active' : ''}`;
    rootItem.innerHTML = `
      <div class="ge-tree-item-left">
        <span class="ge-tree-icon">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </span>
        <span class="ge-tree-name">Root Directory</span>
      </div>
      <span class="ge-tree-count">${rootGraphs.length}</span>
    `;
    rootItem.addEventListener('click', () => {
      this.currentFolderId = 'root';
      this.renderTree();
      this.renderContent();
    });
    setupDropTarget(rootItem, 'root');
    container.appendChild(rootItem);

    // 3. User Folders
    this.folders.forEach(f => {
      const folderGraphs = this.graphs.filter(g => g.folderId === f.id);
      const item = document.createElement('div');
      item.className = `ge-tree-item ${this.currentFolderId === f.id ? 'active' : ''}`;
      item.innerHTML = `
        <div class="ge-tree-item-left">
          <span class="ge-tree-icon" style="color: ${f.color || '#e5c07b'}">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
              <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
            </svg>
          </span>
          <span class="ge-tree-name" title="${this.esc(f.name)}">${this.esc(f.name)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
          <span class="ge-tree-count">${folderGraphs.length}</span>
          <div class="ge-tree-actions">
            <button class="ge-tree-btn edit-folder-btn" title="Rename Folder">✎</button>
            <button class="ge-tree-btn del-folder-btn" title="Delete Folder">✕</button>
          </div>
        </div>
      `;

      item.querySelector('.ge-tree-item-left').addEventListener('click', () => {
        this.currentFolderId = f.id;
        this.renderTree();
        this.renderContent();
      });

      setupDropTarget(item, f.id);

      item.querySelector('.edit-folder-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.promptRenameFolder(f);
      });

      const delFolderBtn = item.querySelector('.del-folder-btn');
      let folderDelTimer = null;
      delFolderBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (delFolderBtn.dataset.sure === '1') {
          clearTimeout(folderDelTimer);
          await graphStorage.deleteFolder(f.id);
          if (this.currentFolderId === f.id) {
            this.currentFolderId = 'all';
          }
          if (this.app?.simulator) {
            this.app.simulator.log(`Deleted folder '${f.name}'.`, 'info');
          }
          await this.loadAndRefresh();
        } else {
          delFolderBtn.dataset.sure = '1';
          delFolderBtn.textContent = 'Sure?';
          delFolderBtn.classList.add('btn-sure');
          folderDelTimer = setTimeout(() => {
            delFolderBtn.dataset.sure = '0';
            delFolderBtn.textContent = '✕';
            delFolderBtn.classList.remove('btn-sure');
          }, 3000);
        }
      });

      container.appendChild(item);
    });
  }

  renderContent() {
    const scrollArea = this.card.querySelector('#geContentScroll');
    const breadcrumbs = this.card.querySelector('#geBreadcrumbs');
    const summary = this.card.querySelector('#geContentSummary');
    if (!scrollArea) return;

    scrollArea.innerHTML = '';

    // Render breadcrumb navigation
    let currentFolderName = 'All Graphs';
    if (this.currentFolderId === 'root') {
      currentFolderName = 'Root Directory';
    } else if (this.currentFolderId !== 'all') {
      const folder = this.folders.find(f => f.id === this.currentFolderId);
      if (folder) currentFolderName = folder.name;
    }

    breadcrumbs.innerHTML = `
      <span class="ge-crumb-item ${this.currentFolderId === 'all' ? 'active' : ''}" id="crumbHome">All Graphs</span>
      ${this.currentFolderId !== 'all' ? `
        <span class="ge-crumb-sep">/</span>
        <span class="ge-crumb-item active">${this.esc(currentFolderName)}</span>
      ` : ''}
    `;

    const crumbHome = breadcrumbs.querySelector('#crumbHome');
    if (crumbHome) {
      crumbHome.addEventListener('click', () => {
        this.currentFolderId = 'all';
        this.renderTree();
        this.renderContent();
      });
    }

    // Filter graphs
    let visibleGraphs = this.graphs.slice();
    if (this.currentFolderId !== 'all') {
      visibleGraphs = visibleGraphs.filter(g => (g.folderId || 'root') === this.currentFolderId);
    }

    if (this.searchQuery) {
      visibleGraphs = visibleGraphs.filter(g =>
        g.name.toLowerCase().includes(this.searchQuery)
      );
    }

    // Sort graphs
    if (this.sortMode === 'name_asc') {
      visibleGraphs.sort((a, b) => a.name.localeCompare(b.name));
    } else if (this.sortMode === 'nodes_desc') {
      visibleGraphs.sort((a, b) => (b.nodeCount || 0) - (a.nodeCount || 0));
    } else {
      // date_desc
      visibleGraphs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    // Render subfolders as full-width 'lines'
    let hasSubfolders = false;
    if (!this.searchQuery && (this.currentFolderId === 'root' || this.currentFolderId === 'all')) {
      const subfolders = this.currentFolderId === 'root'
        ? this.folders.filter(f => f.parentId === 'root')
        : this.folders;

      if (subfolders.length > 0) {
        hasSubfolders = true;
        const folderSection = document.createElement('div');
        folderSection.className = 'ge-folders-section';
        folderSection.innerHTML = `
          <div class="ge-section-title">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span>Folders (${subfolders.length})</span>
          </div>
        `;

        const folderList = document.createElement('div');
        folderList.className = 'ge-folders-list';

        subfolders.forEach(f => {
          const fCount = this.graphs.filter(g => g.folderId === f.id).length;
          const fLine = document.createElement('div');
          fLine.className = 'ge-folder-line';
          fLine.innerHTML = `
            <div class="ge-folder-line-left">
              <span class="ge-folder-line-icon" style="color:${f.color || '#e5c07b'}">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
                </svg>
              </span>
              <span class="ge-folder-line-name">${this.esc(f.name)}</span>
              <span class="ge-folder-line-count">${fCount} graph${fCount === 1 ? '' : 's'}</span>
            </div>
            <span class="ge-folder-line-arrow">▶</span>
          `;
          fLine.addEventListener('click', () => {
            this.currentFolderId = f.id;
            this.renderTree();
            this.renderContent();
          });
          folderList.appendChild(fLine);
        });

        folderSection.appendChild(folderList);
        scrollArea.appendChild(folderSection);
      }
    }

    summary.textContent = `${visibleGraphs.length} node graph(s)`;

    // Empty state
    if (visibleGraphs.length === 0 && !hasSubfolders) {
      const empty = document.createElement('div');
      empty.className = 'ge-empty-state';
      empty.innerHTML = `
        <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.5" class="ge-empty-icon">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="3"/>
        </svg>
        <div class="ge-empty-title">${this.searchQuery ? 'No matching node graphs' : 'Folder is empty'}</div>
        <div class="ge-empty-desc">${this.searchQuery ? 'Try a different search query' : 'Create a new graph to get started.'}</div>
        <button class="ge-btn-primary" id="geEmptyNewGraphBtn" style="margin-top:8px;">+ Create New Graph</button>
      `;
      empty.querySelector('#geEmptyNewGraphBtn').addEventListener('click', () => {
        this.promptNewGraph();
      });
      scrollArea.appendChild(empty);
      return;
    }

    // Render node graphs grid section
    if (visibleGraphs.length > 0) {
      const graphsSection = document.createElement('div');
      graphsSection.className = 'ge-graphs-section';
      if (hasSubfolders) {
        graphsSection.innerHTML = `
          <div class="ge-section-title">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M7 8h10M7 12h10M7 16h6"/>
            </svg>
            <span>Node Graphs (${visibleGraphs.length})</span>
          </div>
        `;
      }

      const columnContainer = document.createElement('div');
      columnContainer.className = 'ge-graphs-column';

      // Render each graph card
      visibleGraphs.forEach(g => {
        if (!g) return;
        const isOpenInApp = this.app.graphs && this.app.graphs.some(openG => openG && (openG.id === g.id || openG.name === g.name));
        const isActiveGraph = this.app.state && (this.app.state.id === g.id || this.app.state.name === g.name);

        const card = document.createElement('div');
        card.className = `ge-graph-card ${isActiveGraph ? 'active-graph' : ''}`;
        card.setAttribute('draggable', 'true');
        card.title = `Double-click to open '${g.name || 'Graph'}'`;

        card.addEventListener('dragstart', (e) => {
          NodeGraphExplorer.draggingGraphId = g.id;
          e.dataTransfer.setData('text/plain', g.id);
          e.dataTransfer.setData('application/json', JSON.stringify({ graphId: g.id }));
          e.dataTransfer.effectAllowed = 'move';
          card.classList.add('dragging');
        });

        card.addEventListener('dragend', () => {
          card.classList.remove('dragging');
        });

        card.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          columnContainer.querySelectorAll('.ge-graph-card').forEach(c => c.classList.remove('selected-graph'));
          card.classList.add('selected-graph');
          this.activeGraph = g;

          const moveSub = document.getElementById('geGraphCtxMoveSub');
          if (moveSub) {
            moveSub.innerHTML = `<div class="ge-ctx-subitem" data-folder="root">Root Directory</div>`;
            this.folders.forEach(f => {
              const subItem = document.createElement('div');
              subItem.className = 'ge-ctx-subitem';
              subItem.setAttribute('data-folder', f.id);
              subItem.textContent = f.name;
              moveSub.appendChild(subItem);
            });
          }

          const graphCtx = document.getElementById('geGraphCtxMenu');
          if (graphCtx) {
            graphCtx.style.left = `${e.clientX}px`;
            graphCtx.style.top = `${e.clientY}px`;
            graphCtx.style.display = 'block';
          }
        });

        const formattedTime = this.formatRelativeTime(g.updatedAt);

        card.innerHTML = `
          <div class="ge-graph-row-left">
            <div class="ge-graph-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <circle cx="6" cy="6" r="3"/>
                <circle cx="18" cy="18" r="3"/>
                <path d="M6 9v3a3 3 0 0 0 3 3h6" stroke="currentColor" stroke-width="2" fill="none"/>
              </svg>
            </div>
            <div class="ge-graph-info">
              <div class="ge-graph-name">${this.esc(g.name)}</div>
              <div class="ge-graph-meta">
                <span>${g.nodeCount || 0} nodes</span>
                <span>•</span>
                <span>${g.wireCount || 0} wires</span>
                <span>•</span>
                <span>${formattedTime}</span>
              </div>
            </div>
          </div>
          <div class="ge-graph-row-right">
            ${isActiveGraph ? '<span class="ge-graph-badge ge-badge-active">ACTIVE</span>' : (isOpenInApp ? '<span class="ge-graph-badge ge-badge-server">OPEN</span>' : '<span class="ge-graph-badge ge-badge-server">SAVED</span>')}
          </div>
        `;

        // Single click selects card
        card.addEventListener('click', () => {
          columnContainer.querySelectorAll('.ge-graph-card').forEach(c => c.classList.remove('selected-graph'));
          card.classList.add('selected-graph');
        });

        // Double-click card body to open
        card.addEventListener('dblclick', () => {
          this.openGraphInEditor(g);
        });

      columnContainer.appendChild(card);
    });

    graphsSection.appendChild(columnContainer);
    scrollArea.appendChild(graphsSection);
  }
}

  updateFooter() {
    const totalBadge = this.card.querySelector('#geTotalBadge');
    if (totalBadge) {
      totalBadge.textContent = `${this.graphs.length} Graph${this.graphs.length === 1 ? '' : 's'}`;
    }

    const footerActive = this.card.querySelector('#geFooterActiveGraph');
    if (footerActive && this.app.state) {
      footerActive.textContent = `Active: ${this.app.state.name} (${this.app.state.nodes.length} nodes)`;
    }
  }

  /**
   * Opens the node graph into the actual editor workspace & tabs
   * @param {object} graphRecord
   */
  async openGraphInEditor(graphRecord) {
    if (!this.app) return;

    // Check if graph is already loaded in tabs
    let target = (this.app.graphs || []).find(g => g.id === graphRecord.id || g.name === graphRecord.name);

    if (!target) {
      // Need to instantiate from record data
      if (graphRecord.data) {
        target = GraphState.fromJSON(graphRecord.data);
      } else {
        target = new GraphState(graphRecord.name, graphRecord.type || 'Server');
        if (graphRecord.id === 'graph_open_garage') {
          target.loadDefaultGenshinScene();
        }
      }
      target.id = graphRecord.id;
      target.folderId = graphRecord.folderId || 'root';
      this.app.graphs.push(target);
      this.app.attachPersist(target);
    }

    // Switch active graph
    this.app.switchToGraph(target);
    this.renderContent();
    this.updateFooter();

    if (this.app.simulator) {
      this.app.simulator.log(`Opened node graph '${target.name}' from storage.`, 'success');
    }

    // Close or minimize explorer card so user immediately sees their workspace
    this.close();
  }

  // ================= Prompts and Dialogs =================

  showPromptModal({ title, inputLabel, inputValue = '', selectLabel, selectOptions = [], onOk }) {
    const overlay = this.card.querySelector('#gePromptOverlay');
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div class="ge-prompt-modal">
        <div class="ge-prompt-title">${this.esc(title)}</div>
        ${inputLabel ? `<input type="text" class="ge-prompt-input" id="geModalInput" value="${this.esc(inputValue)}" placeholder="${this.esc(inputLabel)}" spellcheck="false" autocomplete="off" />` : ''}
        ${selectOptions.length > 0 ? `
          <div style="font-size:12px;color:#94a3b8;margin-top:4px;">${this.esc(selectLabel || 'Choose:')}</div>
          <select class="ge-prompt-select" id="geModalSelect">
            ${selectOptions.map(opt => `<option value="${this.esc(opt.value)}">${this.esc(opt.label)}</option>`).join('')}
          </select>
        ` : ''}
        <div class="ge-prompt-actions">
          <button class="ge-action-btn" id="geModalCancel">Cancel</button>
          <button class="ge-action-btn btn-open" id="geModalOk">Confirm</button>
        </div>
      </div>
    `;

    const closeOverlay = () => {
      overlay.style.display = 'none';
      overlay.innerHTML = '';
    };

    const input = overlay.querySelector('#geModalInput');
    const select = overlay.querySelector('#geModalSelect');

    overlay.querySelector('#geModalCancel').addEventListener('click', closeOverlay);

    const submit = () => {
      const val = input ? input.value.trim() : '';
      const selVal = select ? select.value : '';
      closeOverlay();
      onOk({ value: val, selected: selVal });
    };

    overlay.querySelector('#geModalOk').addEventListener('click', submit);

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
        if (e.key === 'Escape') closeOverlay();
      });
      setTimeout(() => input.focus(), 50);
    }
  }

  async promptNewGraph() {
    const defaultFolder = this.currentFolderId === 'all' ? 'root' : this.currentFolderId;
    const folderOptions = [
      { value: 'root', label: '📁 Root Directory' },
      ...this.folders.map(f => ({ value: f.id, label: `📁 ${f.name}` }))
    ];

    this.showPromptModal({
      title: 'Create New Node Graph',
      inputLabel: 'e.g. Domain_Trigger / Combat_Logic',
      inputValue: `Node_Graph_${this.graphs.length + 1}`,
      selectLabel: 'Save in folder:',
      selectOptions: folderOptions,
      onOk: async ({ value, selected }) => {
        const name = value || `Node_Graph_${this.graphs.length + 1}`;
        const targetFolder = selected || defaultFolder;

        // Create new GraphState
        const g = new GraphState(name, 'Server');
        g.folderId = targetFolder;

        // Save to IndexedDB
        const record = await graphStorage.saveGraph(g, targetFolder);

        // Add to active tabs and switch
        this.app.graphs.push(g);
        this.app.attachPersist(g);
        this.app.switchToGraph(g);

        await this.loadAndRefresh();

        if (this.app.simulator) {
          this.app.simulator.log(`Created and opened new node graph: '${name}'.`, 'success');
        }

        this.close();
      }
    });
  }

  async promptNewFolder() {
    this.showPromptModal({
      title: 'Create New Folder',
      inputLabel: 'e.g. Boss Encounters / Sub-quests',
      inputValue: '',
      onOk: async ({ value }) => {
        if (!value) return;
        const parent = this.currentFolderId === 'all' ? 'root' : this.currentFolderId;
        await graphStorage.createFolder(value, parent);
        await this.loadAndRefresh();
        if (this.app.simulator) {
          this.app.simulator.log(`Created folder: '${value}'.`, 'info');
        }
      }
    });
  }

  async promptRenameFolder(folder) {
    this.showPromptModal({
      title: `Rename Folder "${folder.name}"`,
      inputLabel: 'New folder name',
      inputValue: folder.name,
      onOk: async ({ value }) => {
        if (!value || value === folder.name) return;
        await graphStorage.renameFolder(folder.id, value);
        await this.loadAndRefresh();
      }
    });
  }

  async confirmDeleteFolder(folder) {
    if (confirm(`Delete folder "${folder.name}"? Graphs inside will be moved to the Root directory.`)) {
      await graphStorage.deleteFolder(folder.id);
      if (this.currentFolderId === folder.id) {
        this.currentFolderId = 'all';
      }
      await this.loadAndRefresh();
    }
  }

  async promptRenameGraph(graphRecord) {
    this.showPromptModal({
      title: `Rename Graph "${graphRecord.name}"`,
      inputLabel: 'New graph name',
      inputValue: graphRecord.name,
      onOk: async ({ value }) => {
        if (!value || value === graphRecord.name) return;
        await graphStorage.renameGraph(graphRecord.id, value);

        // If currently open in editor tabs, update its name in real-time
        const openG = this.app.graphs?.find(g => g.id === graphRecord.id || g.name === graphRecord.name);
        if (openG) {
          openG.name = value;
          this.app.renderGraphTabs();
        }

        await this.loadAndRefresh();
      }
    });
  }

  async promptMoveGraph(graphRecord) {
    const folderOptions = [
      { value: 'root', label: '📁 Root Directory' },
      ...this.folders.map(f => ({ value: f.id, label: `📁 ${f.name}` }))
    ];

    this.showPromptModal({
      title: `Move "${graphRecord.name}" to Folder`,
      selectLabel: 'Target folder:',
      selectOptions: folderOptions,
      onOk: async ({ selected }) => {
        await graphStorage.moveGraph(graphRecord.id, selected || 'root');
        const openG = this.app.graphs?.find(g => g.id === graphRecord.id || g.name === graphRecord.name);
        if (openG) openG.folderId = selected || 'root';
        await this.loadAndRefresh();
      }
    });
  }

  async duplicateGraph(graphRecord) {
    const newName = `${graphRecord.name}_Copy`;
    await graphStorage.duplicateGraph(graphRecord.id, newName);
    await this.loadAndRefresh();
    if (this.app.simulator) {
      this.app.simulator.log(`Duplicated graph '${graphRecord.name}' -> '${newName}'.`, 'info');
    }
  }

  async confirmDeleteGraph(graphRecord) {
    if (confirm(`Delete node graph "${graphRecord.name}" from database?`)) {
      await graphStorage.deleteGraph(graphRecord.id);

      // If open in app tabs, close it
      const idx = this.app.graphs?.findIndex(g => g.id === graphRecord.id || g.name === graphRecord.name);
      if (idx !== undefined && idx >= 0 && this.app.graphs.length > 1) {
        this.app.closeGraph(idx);
      }

      await this.loadAndRefresh();
      if (this.app.simulator) {
        this.app.simulator.log(`Deleted graph '${graphRecord.name}'.`, 'info');
      }
    }
  }

  exportGraph(g) {
    const blob = new Blob([JSON.stringify(g, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${g.name || 'node_graph'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    if (this.app.simulator) {
      this.app.simulator.log(`Exported graph '${g.name}'.`, 'info');
    }
  }

  // Utilities
  esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  formatRelativeTime(ts) {
    if (!ts) return 'Unknown';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}
