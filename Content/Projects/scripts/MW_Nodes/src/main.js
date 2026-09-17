/**
 * Miliastra Wonderland Node Graph System
 * Main Application Orchestrator
 */

import { GraphState } from './graphState.js';
import { GraphRenderer } from './renderer.js';
import { NodeLibrary } from './nodeLibrary.js';
import { QuickSpawner } from './quickSpawner.js';
import { GraphSimulator } from './simulator.js';
import { GiaCodec } from './giaCodec.js';
import { MiliastraIde } from './ide/ide.js';
import { SignalExplorer } from './signalExplorer.js';
import { NodeGraphVariablesWindow } from './nodeGraphVariables.js';
import { CustomVariablesWindow } from './customVariables.js';
import { graphStorage } from './storage/indexdb.js';
import { NodeGraphExplorer } from './storage/graphExplorer.js';
import { CompositeNodeManager } from './compositeNode.js';
import { NodeInspector } from './nodeInspector.js';
import { CommentsManager } from './commentsManager.js';
import { PuzzleManager } from './puzzles/puzzleManager.js';
import { PuzzleExplorer } from './puzzles/puzzleExplorer.js';

class MiliastraApp {
  constructor() {
    this.appRoot = document.getElementById('app');
    this.state = new GraphState('Open_Garage', 'Server', 'graph_open_garage');
    this.state.folderId = 'f_stages';
    this.initLayout();
    this.renderer = new GraphRenderer(this.canvasContainer, this.state);
    this.library = new NodeLibrary(this.libraryContainer, this.state, this.renderer);
    this.quickSpawner = new QuickSpawner(this.appRoot, this.state, this.renderer);
    window.miliastraQuickSpawner = this.quickSpawner;
    this.simulator = new GraphSimulator(this.state, this.renderer);

    this.ide = new MiliastraIde(this.workspaceBody, this.state, this.renderer);
    window.miliastraIde = this.ide;

    this.signalExplorer = new SignalExplorer(this.state, this.renderer);
    window.miliastraSignalExplorer = this.signalExplorer;

    this.nodeGraphVars = new NodeGraphVariablesWindow(this.state, this.renderer);
    window.miliastraNodeGraphVars = this.nodeGraphVars;

    this.customVars = new CustomVariablesWindow(this.state, this.renderer);
    window.miliastraCustomVars = this.customVars;

    this.graphExplorer = new NodeGraphExplorer(this);
    window.miliastraGraphExplorer = this.graphExplorer;

    this.compositeManager = new CompositeNodeManager(this);
    window.miliastraCompositeManager = this.compositeManager;

    this.nodeInspector = new NodeInspector(this);
    window.miliastraNodeInspector = this.nodeInspector;

    this.commentsManager = new CommentsManager(this);
    window.miliastraComments = this.commentsManager;

    this.puzzleManager = new PuzzleManager(this.state, this.renderer, this.simulator);
    window.miliastraPuzzleManager = this.puzzleManager;

    this.puzzleExplorer = new PuzzleExplorer(this.puzzleManager);
    window.miliastraPuzzleExplorer = this.puzzleExplorer;

    window.addEventListener('open_signal_explorer', (e) => {
      this.signalExplorer.open(e.detail?.signalName);
    });

    window.addEventListener('open_node_graph_vars', (e) => {
      this.nodeGraphVars.open(e.detail?.varName);
    });

    window.addEventListener('open_custom_vars', (e) => {
      this.customVars.open(e.detail?.varName);
    });

    window.addEventListener('open_graph_explorer', (e) => {
      this.graphExplorer.open(e.detail?.folderId);
    });

    window.addEventListener('open_node_inspector', (e) => {
      this.nodeInspector.open(e.detail?.node || e.detail?.blueprintId);
    });

    this.initBottomToolbar();
    this.initConsoleDrawer();
    this.initKeyboardShortcuts();
    this.initWindowMenu();

    // Local persistence: restore graphs saved in the cache, then keep them in sync.
    this.restorePersistedGraphs();
    if (Array.isArray(this.graphs)) {
      this.graphs.forEach(g => this.attachPersist(g));
    }
    window.addEventListener('beforeunload', () => this.persistGraphs());

    // Load authentic default scene from screenshots! (unless a saved session exists)
    if (this.restoredGraphs) {
      this.simulator.log(`Restored ${this.restoredGraphs} saved node graph(s) from cache.`, 'info');
    } else {
      this.state.loadDefaultGenshinScene();
    }
    this.renderer.render();

    // Sync any custom composite nodes across all loaded graphs into the library
    if (this.library) {
      this.library.syncStateCompositeNodes();
      this.library.updateCategoryOptions();
      this.library.renderList();
    }

    // Initialize IndexedDB in the background and ensure active graphs are persisted
    graphStorage.init().then(async () => {
      if (this.state) {
        if (!this.state.id) this.state.id = 'graph_open_garage';
        if (!this.state.folderId) this.state.folderId = 'f_stages';
        await graphStorage.saveGraph(this.state, this.state.folderId);
      }
      if (Array.isArray(this.graphs)) {
        for (const g of this.graphs) {
          await graphStorage.saveGraph(g, g.folderId || 'root');
        }
      }
    }).catch(err => console.warn('IndexedDB startup sync error:', err));

    window.updateZoomDropdown = (val) => {
      const zSel = document.getElementById('zoomSelect');
      if (!zSel) return;
      const pct = Math.round((val || 1) * 100);
      const presets = Array.from(zSel.options)
        .map(o => parseInt(o.value, 10))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);
      if (presets.length === 0) return;
      let nearest = presets.reduce((a, b) => Math.abs(b - pct) < Math.abs(a - pct) ? b : a, presets[0]);
      if (pct < presets[0]) nearest = presets[0];
      if (pct > presets[presets.length - 1]) nearest = presets[presets.length - 1];
      if (zSel.disabled) zSel.disabled = false;
      zSel.value = String(nearest);
    };

    // Multi-graph tabs
    this.graphs = [this.state];
    this.renderGraphTabs();
  }

  esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  syncStateRefs() {
    const s = this.state;
    this.renderer.setState(s);
    this.library.state = s;
    this.quickSpawner.state = s;
    this.simulator.state = s;
    this.ide.state = s;
    this.ide.attachState?.(s);
    this.signalExplorer.state = s;
    this.nodeGraphVars.state = s;
    if (this.customVars) {
      this.customVars.state = s;
    }
    if (this.commentsManager) {
      this.commentsManager.state = s;
    }
    if (this.puzzleManager) {
      this.puzzleManager.state = s;
    }
    if (this.graphExplorer && this.graphExplorer.isOpen) {
      this.graphExplorer.updateFooter();
      this.graphExplorer.renderContent();
    }
  }

  switchToGraph(g) {
    if (this.compositeManager && this.compositeManager.isEditingComposite()) {
      this.compositeManager.exitCompositeNode();
    }
    this.state = g;
    this.syncStateRefs();
    const tabIde = document.getElementById('tabIdeView');
    if (tabIde) tabIde.classList.remove('active');
    this.ide.setViewMode('nodes');
    this.renderer.clearCache();
    this.renderer.render();
    this.ide.syncFromGraph();
    this.renderGraphTabs();
  }

  addNewGraph(name, folderId = 'root') {
    const base = name || 'Node_Graph';
    let n = base;
    let k = 1;
    while (this.graphs.some(g => g && g.name === n)) { n = `${base}_${k++}`; }
    const g = new GraphState(n, 'Server');
    g.folderId = folderId || 'root';
    this.graphs.push(g);
    this.attachPersist(g);
    this.switchToGraph(g);
    this.persistGraphs();
    graphStorage.saveGraph(g, g.folderId).catch(() => {});
  }

  // Keep the local cache updated whenever the graph (or any graph) changes.
  attachPersist(g) {
    if (!g || g.__persisted) return;
    g.__persisted = true;
    g.subscribe(() => this.persistGraphs());
  }

  persistGraphs() {
    clearTimeout(this.__persistTimer);
    this.__persistTimer = setTimeout(() => {
      try {
        const data = (this.graphs || []).filter(Boolean).map(g => g.toJSON());
        localStorage.setItem('miliastra.graphs', JSON.stringify(data));
      } catch (err) {
        /* storage full / unavailable — non-fatal */
      }
      // Also write each open graph to IndexedDB
      if (Array.isArray(this.graphs)) {
        this.graphs.filter(Boolean).forEach(g => {
          graphStorage.saveGraph(g, g.folderId || 'root').catch(() => {});
        });
      }
    }, 350);
  }

  restorePersistedGraphs() {
    this.restoredGraphs = 0;
    try {
      const raw = localStorage.getItem('miliastra.graphs');
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || arr.length === 0) return;
      const loaded = arr.map(o => GraphState.fromJSON(o)).filter(Boolean);
      if (loaded.length > 0) {
        this.graphs = loaded;
        this.state = loaded[0];
        this.syncStateRefs();
        this.restoredGraphs = loaded.length;
        this.renderGraphTabs();
      }
    } catch (err) {
      // Bad/wrong-era cache — ignore and start fresh.
    }
  }

  closeGraph(idx) {
    if (this.graphs.length <= 1) return;
    const wasActive = this.graphs[idx] === this.state;
    this.graphs.splice(idx, 1);
    if (wasActive) {
      this.switchToGraph(this.graphs[this.graphs.length - 1]);
    } else {
      this.renderGraphTabs();
    }
    this.persistGraphs();
  }

  renderGraphTabs() {
    const el = document.getElementById('graphTabs');
    if (!el) return;
    el.innerHTML = '';
    this.graphs.forEach((g, i) => {
      const isCurrent = g === this.state;
      const tab = document.createElement('div');
      tab.className = 'doc-tab active-graph-tab' + (isCurrent ? ' active' : '');
      tab.title = g.name;
      tab.innerHTML = `
        <span class="tab-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="#98C379"><path d="M4 4h7v7H4zM13 13h7v7h-7z" fill="currentColor"/><path d="M14 7h4v4M10 17H6v-4" stroke="currentColor" stroke-width="2"/></svg></span>
        <span class="tab-title">${this.esc(g.name)}</span>
        <span class="tab-close-btn" data-close="${i}" title="Close graph">✕</span>`;
      tab.querySelector('.tab-close-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeGraph(i);
      });
      tab.addEventListener('click', () => this.switchToGraph(this.graphs[i]));
      tab.addEventListener('dblclick', async (e) => {
        if (e.target.closest('.tab-close-btn')) return;
        const g = this.graphs[i];
        const name = await this.promptGraphName(g.name);
        if (name) {
          g.name = name;
          this.switchToGraph(g);
          this.persistGraphs();
          this.simulator.log(`Renamed graph to '${name}'.`, 'info');
        }
      });
      el.appendChild(tab);
    });

    // If currently editing a composite node subgraph, display a composite tab with close button
    if (this.compositeManager && this.compositeManager.isEditingComposite()) {
      const compNode = this.compositeManager.activeCompositeNode;
      const compTab = document.createElement('div');
      compTab.className = 'doc-tab active-graph-tab active composite-graph-tab';
      compTab.title = `Composite Subgraph: ${compNode.name}`;
      compTab.innerHTML = `
        <span class="tab-icon" style="color:#88C0D0;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M4 4h7v7H4zM13 13h7v7h-7z"/></svg>
        </span>
        <span class="tab-title" style="color:#ECEFF4;font-weight:600;">${this.esc(compNode.name)} (Composite)</span>
        <span class="tab-close-btn" title="Exit Composite Editor (Esc)">✕</span>`;
      compTab.querySelector('.tab-close-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.compositeManager.exitCompositeNode();
      });
      el.appendChild(compTab);
    }

    const t = document.getElementById('activeGraphTitle');
    if (t) {
      if (this.compositeManager && this.compositeManager.isEditingComposite()) {
        t.textContent = `${this.compositeManager.activeCompositeNode.name} (Composite)`;
      } else {
        t.textContent = `${this.state.name} (Nodes)`;
      }
    }
  }

  initLayout() {
    this.appRoot.innerHTML = `
      <!-- Top Title Bar -->
      <div class="window-titlebar">
        <div class="titlebar-left">
          <div class="game-logo-icon" title="Genshin Impact Miliastra Wonderland">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <circle cx="12" cy="12" r="10" fill="#3B4252" stroke="#E5C07B" stroke-width="1.8"/>
              <path d="M12 4 L14 10 L20 12 L14 14 L12 20 L10 14 L4 12 L10 10 Z" fill="#E5C07B"/>
            </svg>
          </div>
          <div class="menu-item" id="menuWindowBtn">Window</div>
          <div class="menu-item" id="menuExplorerBtn">Explorer</div>
          <div class="menu-item" id="menuCompositeBtn" title="Composite Nodes Menu">Composite ▾</div>
          <div class="menu-item" id="menuPuzzlesBtn" title="Miliastra Wonderland Puzzles Explorer" style="color: #38bdf8; font-weight: 700;">Puzzles</div>
          <div class="menu-item" id="menuHelpBtn">Help</div>
          
          <div class="window-dropdown-menu" id="compositeDropdown" style="display:none; left: 160px; min-width: 260px;">
            <div class="dropdown-item" id="menuEditCompositeNode" style="color: #88C0D0; font-weight: 600;">✎ Edit Composite Node</div>
            <div class="dropdown-item" id="menuGroupToComposite">⚏ Create Composite from Selection (Ctrl+G)</div>
            <div class="dropdown-item" id="menuNewBlankComposite">+ Create Blank Composite Node</div>
            <div class="dropdown-divider"></div>
            <div class="dropdown-item" id="menuExitCompositeEditor">◀ Exit to Main Graph (Esc)</div>
          </div>

          <div class="window-dropdown-menu" id="windowDropdown" style="display:none;">
            <div class="dropdown-item" id="menuPuzzlesItem" style="color: #38bdf8; font-weight: 700;">🧩 Puzzle Explorer (Challenges & Notes)...</div>
            <div class="dropdown-item" id="menuNodeExplorer">Node Graph Explorer...</div>
            <div class="dropdown-item" id="menuInspectNode" style="color: #38bdf8; font-weight: 600;">Inspect Node (Exploded View)...</div>
            <div class="dropdown-item" id="menuNewGraph">New Graph</div>
            <div class="dropdown-item" id="menuCreateComposite" style="color: #88C0D0; font-weight: 600;">Create Composite Node (Ctrl+G)</div>
            <div class="dropdown-item" id="menuNodeGraphVars">Node Graph Variables...</div>
            <div class="dropdown-item" id="menuCustomVars" style="color: #E5C07B; font-weight: 600;">Custom Variables...</div>
            <div class="dropdown-item" id="menuSignalExplorer">Server Signal Explorer (Signals)...</div>
            <div class="dropdown-item" id="menuImportGia">Import .gia Asset...</div>
            <div class="dropdown-item" id="menuExportGia">Export .gia Binary Asset</div>
            <div class="dropdown-divider"></div>
            <div class="dropdown-item" id="menuToggleIde">TypeScript IDE (genshin-ts)</div>
            <div class="dropdown-item" id="menuSyncTs">Sync TypeScript to Visual Graph</div>
            <div class="dropdown-divider"></div>
            <div class="dropdown-item" id="menuLoadGarage">Load 'garage.gia' Sample</div>
            <div class="dropdown-item" id="menuResetSample">Reset to 'Open_Garage' Sample</div>
            <div class="dropdown-item" id="menuClearAll">Clear Canvas</div>
          </div>
        </div>

        <div class="titlebar-right">
          <button class="win-btn win-help" id="btnWinHelp" title="About / Shortcuts">?</button>
          <button class="win-btn win-min" title="Minimize">_</button>
          <button class="win-btn win-max" title="Maximize">▢</button>
          <button class="win-btn win-close" title="Close">✕</button>
        </div>
      </div>

      <!-- Top Document Tabs Bar -->
      <div class="tabs-bar">
        <button class="ide-tab-btn" id="tabIdeView" title="Switch to TypeScript IDE">
          <span class="ide-tab-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></span>
          <span class="ide-tab-title">IDE</span>
        </button>
        <div class="graph-tabs-scroll" id="graphTabs"></div>
        <div class="doc-tab active-graph-tab" id="tabActiveGraph" style="display:none;">
          <span class="tab-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="#98C379"><path d="M4 4h7v7H4zM13 13h7v7h-7z" fill="currentColor"/><path d="M14 7h4v4M10 17H6v-4" stroke="currentColor" stroke-width="2"/></svg></span>
          <span class="tab-title" id="activeGraphTitle">Open_Garage (Nodes)</span>
        </div>
        <button class="new-tab-btn" id="btnNewTab" title="New Node Graph">+</button>
      </div>

      <!-- Main Workspace -->
      <div class="workspace-body" id="workspaceBody">
        <div class="canvas-viewport" id="canvasViewport"></div>
        <div class="floating-library-slot" id="librarySlot"></div>
      </div>

      <!-- Hidden file input for .gia import -->
      <input type="file" id="fileInputGia" accept=".gia,.json" style="display:none;" />

      <!-- Bottom Floating Toolbar Dock (from screenshot) -->
      <div class="bottom-dock-container">
        <div class="node-search-box" id="nodeSearchBox" style="display:none;">
          <input id="nodeSearchInput" class="node-search-input" type="text" placeholder="Search nodes in this graph..." autocomplete="off" />
          <div class="node-search-results" id="nodeSearchResults"></div>
        </div>
        <div class="floating-toolbar">
          <button class="dock-btn dock-btn-comments" id="btnToggleComments" title="Notes & Comments Mode (C)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
          <button class="dock-btn dock-btn-puzzles" id="btnOpenPuzzles" title="Miliastra Puzzle Explorer (Challenges & Notes)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#38bdf8" stroke-width="2">
              <path d="M19.439 7.85c0-1.571-1.286-2.85-2.87-2.85a2.86 2.86 0 0 0-2.85 2.85v.714H9.281v-.714a2.86 2.86 0 0 0-2.85-2.85C4.846 5 3.56 6.279 3.56 7.85c0 1.25.807 2.314 1.93 2.686v3.928c-1.123.372-1.93 1.436-1.93 2.686 0 1.571 1.286 2.85 2.87 2.85a2.86 2.86 0 0 0 2.85-2.85v-.714h4.438v.714a2.86 2.86 0 0 0 2.85 2.85 2.86 2.86 0 0 0 2.87-2.85c0-1.25-.807-2.314-1.93-2.686v-3.928c1.123-.372 1.93-1.436 1.93-2.686z"/>
            </svg>
          </button>
          <button class="dock-btn" id="btnAutoAlign" title="Snap Nodes to Grid">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/></svg>
          </button>
          <button class="dock-btn" id="btnWireStyle" title="Toggle Wire Style (Curved / Orthogonal)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12c4-8 8-8 12 0s8 8 12 0"/></svg>
          </button>

          <button class="dock-btn dock-btn-explorer" id="btnOpenExplorer" title="Node Graph Explorer (Folders & Storage)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              <line x1="12" y1="11" x2="12" y2="17"/>
              <line x1="9" y1="14" x2="15" y2="14"/>
            </svg>
          </button>

          <button class="dock-btn dock-btn-signals" id="btnOpenSignals" title="Server Signal Explorer (Signals)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4.93 19.07A10 10 0 0 1 19.07 4.93" stroke-linecap="round"/>
              <path d="M7.76 16.24a6 6 0 0 1 8.48-8.48" stroke-linecap="round"/>
              <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
            </svg>
          </button>

          <button class="dock-btn dock-btn-nodegraph-vars" id="btnOpenVariables" title="Node Graph Variables">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor"/>
              <path d="M7 8h10M7 12h6M7 16h10" stroke-linecap="round"/>
            </svg>
          </button>

          <button class="dock-btn dock-btn-custom-vars" id="btnOpenCustomVariables" title="Custom Variables (Game Objects &amp; References)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#E5C07B" stroke-width="2">
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 7v10M7 12h10" stroke-linecap="round"/>
            </svg>
          </button>

          <button class="dock-btn dock-btn-composite" id="btnCreateComposite" title="Create / Open Composite Node (Ctrl+G)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <circle cx="12" cy="5" r="2.8"/>
              <circle cx="6.5" cy="17.5" r="2.8"/>
              <circle cx="17.5" cy="17.5" r="2.8"/>
              <line x1="12" y1="5" x2="6.5" y2="17.5" stroke="currentColor" stroke-width="1.8"/>
              <line x1="12" y1="5" x2="17.5" y2="17.5" stroke="currentColor" stroke-width="1.8"/>
              <line x1="6.5" y1="17.5" x2="17.5" y2="17.5" stroke="currentColor" stroke-width="1.8"/>
            </svg>
          </button>

          <button class="dock-btn" id="btnOpenInspector" title="Inspect Node (Exploded Blueprint View)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#38bdf8" stroke-width="2">
              <circle cx="12" cy="12" r="9"/>
              <circle cx="12" cy="12" r="3"/>
              <line x1="12" y1="3" x2="12" y2="6"/>
              <line x1="12" y1="18" x2="12" y2="21"/>
              <line x1="3" y1="12" x2="6" y2="12"/>
              <line x1="18" y1="12" x2="21" y2="12"/>
            </svg>
          </button>
          
          <div class="dock-zoom-selector">
            <select id="zoomSelect" class="dock-zoom-input" title="Zoom level">
              <option value="25">25%</option>
              <option value="50">50%</option>
              <option value="75">75%</option>
              <option value="100" selected>100%</option>
              <option value="150">150%</option>
              <option value="200">200%</option>
            </select>
            <button class="dock-btn" id="btnZoomFit" title="Zoom to fit">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/><circle cx="11" cy="11" r="4"/></svg>
            </button>
          </div>

          <button class="dock-btn dock-btn-sim" id="btnSimulate" title="Simulate Graph Execution">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>
          </button>

          <button class="dock-btn" id="btnUndo" title="Undo (Ctrl+Z)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          </button>
          <button class="dock-btn" id="btnRedo" title="Redo (Ctrl+Y)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>

          <button class="dock-btn" id="btnSaveGia" title="Save / Export .gia">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          </button>
          <button class="dock-btn" id="btnLoadGia" title="Open / Import .gia / JSON">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </button>
        </div>
      </div>

      <!-- Collapsible Console Drawer -->
      <div class="console-drawer" id="consoleDrawer" style="display:none;">
        <div class="console-header">
          <span class="console-title">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
            Execution Console & Event Log
          </span>
          <div class="console-actions">
            <button class="console-clear-btn" id="consoleClearBtn">Clear</button>
            <button class="console-close-btn" id="consoleCloseBtn">✕</button>
          </div>
        </div>
        <div class="console-logs-list" id="consoleLogsList"></div>
      </div>

      <!-- Help / Guide Modal -->
      <div class="help-modal-backdrop" id="helpModal" style="display:none;">
        <div class="help-modal-card">
          <div class="help-modal-header">
            <h3>Miliastra Wonderland Logic Node Graph Guide</h3>
            <button class="help-modal-close" id="helpCloseBtn">✕</button>
          </div>
          <div class="help-modal-body">
            <p><strong>Genshin Impact Miliastra Wonderland</strong> is the engine-native node-based visual scripting system for user-generated stages and domain logic.</p>
            <h4>Controls & Shortcuts:</h4>
            <ul>
              <li><strong>Right-Click or Spacebar</strong>: Open Quick Spawner directly under mouse cursor to search & place any node in milliseconds.</li>
              <li><strong>Left-Click & Drag on Empty Canvas</strong>: Box selection (marquee) to select multiple nodes.</li>
              <li><strong>Middle-Click or Space+Left-Click Drag</strong>: Pan canvas smoothly.</li>
              <li><strong>Mouse Wheel</strong>: Zoom towards mouse cursor (25% to 200%).</li>
              <li><strong>Drag from Socket to Socket</strong>: Connect execution or data wires.</li>
              <li><strong>Drag from Socket to Empty Canvas</strong>: Opens Quick Spawner filtered to compatible nodes and auto-connects upon placement!</li>
              <li><strong>Ctrl + Z / Ctrl + Y</strong>: Undo / Redo.</li>
              <li><strong>Ctrl + D</strong>: Duplicate selected nodes.</li>
              <li><strong>Delete or Backspace</strong>: Delete selected nodes or wires.</li>
              <li><strong>Press '/' key</strong>: Instant focus to Node Library search bar.</li>
            </ul>
            <h4>Node Categories:</h4>
            <ul>
              <li><span style="color:#D9536D">●</span> <strong>Event Nodes (64)</strong>: Entry triggers (Tab Selected, Entity Created, Attack Hit, Timer, etc.).</li>
              <li><span style="color:#9FB343">●</span> <strong>Execution Nodes (201)</strong>: Procedural commands (Activate Tab, Recover HP, Teleport, Print String, etc.).</li>
              <li><span style="color:#E57842">●</span> <strong>Flow Control Nodes (2)</strong>: Branching logic (Double Branch Yes/No, Multiple Branches).</li>
              <li><span style="color:#6373BF">●</span> <strong>Query Nodes (149)</strong>: Read stage state, player data, entities, math constants.</li>
              <li><span style="color:#3E8BB8">●</span> <strong>Operation Nodes (62)</strong>: Math, logic operators, vectors, list assembly.</li>
            </ul>
            <p class="help-note">Ready for direct integration with <code>genshin-ts</code> and <code>.gia</code> bytecode compilers.</p>
          </div>
        </div>
      </div>
    `;

    this.canvasContainer = document.getElementById('canvasViewport');
    this.libraryContainer = document.getElementById('librarySlot');
    this.workspaceBody = document.getElementById('workspaceBody');
  }

  initBottomToolbar() {
    // Zoom control (preset dropdown) + separate "Zoom to Fit" button.
    const zoomSel = document.getElementById('zoomSelect');
    zoomSel.addEventListener('change', (e) => {
      const pct = parseInt(e.target.value, 10);
      if (!isNaN(pct)) {
        this.state.zoom = pct / 100;
        this.renderer.render();
        window.updateZoomDropdown(this.state.zoom);
      }
    });

    this.zoomToFit = this.zoomToFit.bind(this);
    document.getElementById('btnZoomFit').addEventListener('click', (e) => {
      e.stopPropagation();
      this.zoomToFit();
    });
    this.initNodeSearch();

    // Wire style toggle
    document.getElementById('btnWireStyle').addEventListener('click', () => {
      this.state.wireStyle = this.state.wireStyle === 'curved' ? 'orthogonal' : 'curved';
      this.renderer.render();
      this.simulator.log(`Wire routing style changed to [${this.state.wireStyle.toUpperCase()}]`);
    });

    // Snap nodes to grid
    document.getElementById('btnAutoAlign').addEventListener('click', () => {
      this.gridAlignNodes();
    });

    // Simulation
    document.getElementById('btnSimulate').addEventListener('click', () => {
      this.openConsoleDrawer();
      this.simulator.runSimulation();
    });

    // Notes & Comments Mode Toggle
    const btnToggleComments = document.getElementById('btnToggleComments');
    if (btnToggleComments) {
      btnToggleComments.addEventListener('click', () => {
        if (this.commentsManager) {
          this.commentsManager.toggleCommentingMode();
        }
      });
    }

    // Undo / Redo
    document.getElementById('btnUndo').addEventListener('click', () => {
      const res = this.state.undo();
      this.renderer.render();
      if (this.simulator) this.simulator.log(res ? 'Undone previous action' : 'Nothing to undo', 'info');
    });
    document.getElementById('btnRedo').addEventListener('click', () => {
      const res = this.state.redo();
      this.renderer.render();
      if (this.simulator) this.simulator.log(res ? 'Redone action' : 'Nothing to redo', 'info');
    });

    // Save .gia binary asset
    document.getElementById('btnSaveGia').addEventListener('click', async () => {
      await GiaCodec.exportGiaFile(this.state);
      this.simulator.log(`Exported graph "${this.state.name}.gia" binary asset successfully.`, 'success');
    });

    // Load .gia from file input
    const fileInput = document.getElementById('fileInputGia');
    document.getElementById('btnLoadGia').addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        this.simulator.log(`Loading '${file.name}' into a new node graph...`, 'info');
        this.addNewGraph('Imported');
        try {
          const success = await GiaCodec.importGiaFile(file, this.state);
          if (success) {
            this.renderer.clearCache();
            this.renderer.render();
            this.ide.syncFromGraph();
            this.renderGraphTabs();
            this.simulator.log(`Imported graph from "${file.name}" (${this.state.nodes.length} nodes).`, 'success');
            this.ide.ensureNodesVisible();
          }
        } catch (err) {
          alert('Error loading .gia file: ' + err.message);
        }
      }
      e.target.value = '';
    });

    // Support drag and drop of any .gia or .json graph file
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file && (file.name.endsWith('.gia') || file.name.endsWith('.json'))) {
        this.simulator.log(`Importing dropped file '${file.name}' into a new node graph...`, 'info');
        this.addNewGraph('Imported');
        try {
          const success = await GiaCodec.importGiaFile(file, this.state);
          if (success) {
            this.renderer.clearCache();
            this.renderer.render();
            this.ide.syncFromGraph();
            this.renderGraphTabs();
            this.ide.log(`✓ Imported '${file.name}' (${this.state.nodes.length} nodes, ${this.state.wires.length} wires).`, 'success');
            this.simulator.log(`Imported '${file.name}' (${this.state.nodes.length} nodes).`, 'success');
            this.ide.ensureNodesVisible();
          }
        } catch (err) {
          alert('Error importing .gia file: ' + err.message);
        }
      }
    });

    // Open Signal Explorer from toolbar
    document.getElementById('btnOpenSignals').addEventListener('click', () => {
      this.signalExplorer.open();
    });

    // Open Node Graph Variables from toolbar
    document.getElementById('btnOpenVariables').addEventListener('click', () => {
      this.nodeGraphVars.toggle();
    });

    // Open Custom Variables from toolbar
    const btnOpenCustomVars = document.getElementById('btnOpenCustomVariables');
    if (btnOpenCustomVars) {
      btnOpenCustomVars.addEventListener('click', () => {
        this.customVars.toggle();
      });
    }

    // Open Node Inspector from toolbar
    const btnOpenInsp = document.getElementById('btnOpenInspector');
    if (btnOpenInsp) {
      btnOpenInsp.addEventListener('click', () => {
        let targetNode = null;
        if (this.state.selectedNodeIds && this.state.selectedNodeIds.size > 0) {
          const selId = Array.from(this.state.selectedNodeIds)[0];
          targetNode = this.state.nodes.find(n => n.id === selId);
        }
        this.nodeInspector.open(targetNode);
      });
    }
  }

  // Snap each node to the nearest grid point, keeping the existing layout shape.
  gridAlignNodes() {
    const GX = 60;
    const GY = 60;
    this.state.nodes.forEach(n => {
      n.x = Math.round(n.x / GX) * GX;
      n.y = Math.round(n.y / GY) * GY;
    });
    this.state.saveSnapshot();
    this.renderer.render();
    this.simulator.log('Snapped nodes to grid.', 'info');
  }

  // Fit the whole graph into the current viewport.
  zoomToFit() {
    const vp = this.renderer.container || document.getElementById('canvasViewport');
    const vw = vp.clientWidth || 800;
    const vh = vp.clientHeight || 600;
    const nodes = this.state.nodes;
    if (!nodes.length) {
      this.state.zoom = 1;
      this.state.panX = 60;
      this.state.panY = 80;
      this.renderer.render();
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      const w = 240, h = 64;
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x + w);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y + h);
    });
    const gw = maxX - minX, gh = maxY - minY;
    const zoom = Math.max(0.2, Math.min((vw - 60) / gw, (vh - 60) / gh, 1.5));
    this.state.zoom = zoom;
    this.state.panX = Math.round((vw - gw * zoom) / 2 - minX * zoom);
    this.state.panY = Math.round((vh - gh * zoom) / 2 - minY * zoom);
    this.renderer.render();
    if (window.updateZoomDropdown) window.updateZoomDropdown(zoom);
    this.simulator.log(`Zoomed to fit (${Math.round(zoom * 100)}%).`, 'info');
  }

  centerOnNode(node) {
    if (!node) return;
    const vp = this.renderer.container || document.getElementById('canvasViewport');
    const vw = vp.clientWidth || 800, vh = vp.clientHeight || 600;
    const cx = node.x + 120, cy = node.y + 30;
    this.state.panX = Math.round(vw / 2 - cx * this.state.zoom);
    this.state.panY = Math.round(vh / 2 - cy * this.state.zoom);
    this.state.selectedNodeIds.clear();
    this.state.selectedNodeIds.add(node.id);
    this.renderer.render();
  }

  initNodeSearch() {
    this.nodeSearchBox = document.getElementById('nodeSearchBox');
    this.nodeSearchInput = document.getElementById('nodeSearchInput');
    this.nodeSearchResults = document.getElementById('nodeSearchResults');
    if (!this.nodeSearchBox) return;

    this.nodeSearchInput.addEventListener('input', () => this.nodeSearchFilter());
    this.nodeSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.hideNodeSearch(); e.stopPropagation(); }
      if (e.key === 'Enter') {
        const first = this.nodeSearchResults.querySelector('.node-search-item');
        if (first) first.click();
      }
    });

    document.addEventListener('click', (e) => {
      if (!this.nodeSearchBox.contains(e.target)) this.hideNodeSearch();
    });
  }

  toggleNodeSearch() {
    if (this.nodeSearchBox.style.display === 'block') {
      this.hideNodeSearch();
    } else {
      this.nodeSearchBox.style.display = 'block';
      this.nodeSearchInput.value = '';
      this.nodeSearchFilter();
      setTimeout(() => { try { this.nodeSearchInput.focus(); } catch (e) {} }, 0);
    }
  }

  hideNodeSearch() {
    if (this.nodeSearchBox) this.nodeSearchBox.style.display = 'none';
  }

  nodeSearchFilter() {
    const q = (this.nodeSearchInput.value || '').trim().toLowerCase();
    const box = this.nodeSearchResults;
    box.innerHTML = '';
    const matches = q
      ? this.state.nodes.filter(n => String(n.name || '').toLowerCase().includes(q)).slice(0, 30)
      : this.state.nodes.slice(0, 30);
    if (!matches.length) {
      box.innerHTML = '<div class="node-search-empty">No matching nodes</div>';
      return;
    }
    matches.forEach(n => {
      const el = document.createElement('div');
      el.className = 'node-search-item';
      el.innerHTML = `<span class="node-search-name">${this.esc(n.name)}</span>`;
      el.addEventListener('click', () => {
        this.centerOnNode(n);
        this.hideNodeSearch();
      });
      box.appendChild(el);
    });
  }

  initConsoleDrawer() {
    this.consoleDrawer = document.getElementById('consoleDrawer');
    this.consoleLogsList = document.getElementById('consoleLogsList');

    this.simulator.onLog((entry, allLogs) => {
      if (!entry) {
        this.consoleLogsList.innerHTML = '';
        return;
      }
      const el = document.createElement('div');
      el.className = `console-log-entry log-${entry.type}`;
      el.innerHTML = `<span class="log-time">[${entry.time}]</span> <span class="log-msg">${entry.msg}</span>`;
      this.consoleLogsList.appendChild(el);
      this.consoleLogsList.scrollTop = this.consoleLogsList.scrollHeight;
    });

    document.getElementById('consoleClearBtn').addEventListener('click', () => {
      this.simulator.clearLogs();
    });

    document.getElementById('consoleCloseBtn').addEventListener('click', () => {
      this.consoleDrawer.style.display = 'none';
    });
  }

  toggleConsoleDrawer() {
    if (this.consoleDrawer.style.display === 'none') {
      this.openConsoleDrawer();
    } else {
      this.consoleDrawer.style.display = 'none';
    }
  }

  openConsoleDrawer() {
    this.consoleDrawer.style.display = 'flex';
  }

  initWindowMenu() {
    const winBtn = document.getElementById('menuWindowBtn');
    const dropdown = document.getElementById('windowDropdown');
    const compTopBtn = document.getElementById('menuCompositeBtn');
    const compDropdown = document.getElementById('compositeDropdown');

    const closeAllTopDropdowns = () => {
      if (dropdown) dropdown.style.display = 'none';
      if (compDropdown) compDropdown.style.display = 'none';
    };

    winBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = dropdown.style.display === 'none';
      closeAllTopDropdowns();
      if (willOpen) {
        dropdown.style.display = 'block';
      }
    });

    window.addEventListener('click', () => {
      closeAllTopDropdowns();
    });

    const explorerBtn = document.getElementById('menuExplorerBtn');
    if (explorerBtn) {
      explorerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllTopDropdowns();
        this.graphExplorer.toggle();
      });
    }

    const menuPuzzlesBtn = document.getElementById('menuPuzzlesBtn');
    if (menuPuzzlesBtn) {
      menuPuzzlesBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllTopDropdowns();
        this.puzzleExplorer.open();
      });
    }

    const menuPuzzlesItem = document.getElementById('menuPuzzlesItem');
    if (menuPuzzlesItem) {
      menuPuzzlesItem.addEventListener('click', () => {
        closeAllTopDropdowns();
        this.puzzleExplorer.open();
      });
    }

    const btnOpenPuzzles = document.getElementById('btnOpenPuzzles');
    if (btnOpenPuzzles) {
      btnOpenPuzzles.addEventListener('click', () => {
        this.puzzleExplorer.open();
      });
    }

    const menuNodeExp = document.getElementById('menuNodeExplorer');
    if (menuNodeExp) {
      menuNodeExp.addEventListener('click', () => {
        closeAllTopDropdowns();
        this.graphExplorer.open();
      });
    }

    const menuInsp = document.getElementById('menuInspectNode');
    if (menuInsp) {
      menuInsp.addEventListener('click', () => {
        closeAllTopDropdowns();
        let targetNode = null;
        if (this.state.selectedNodeIds && this.state.selectedNodeIds.size > 0) {
          const selId = Array.from(this.state.selectedNodeIds)[0];
          targetNode = this.state.nodes.find(n => n.id === selId);
        }
        this.nodeInspector.open(targetNode);
      });
    }

    const dockExp = document.getElementById('btnOpenExplorer');
    if (dockExp) {
      dockExp.addEventListener('click', () => {
        this.graphExplorer.toggle();
      });
    }

    const handleCreateComposite = () => {
      if (this.state.selectedNodeIds && this.state.selectedNodeIds.size > 0) {
        // If a single composite node is selected, open it!
        if (this.state.selectedNodeIds.size === 1) {
          const selId = Array.from(this.state.selectedNodeIds)[0];
          const node = this.state.nodes.find(n => n.id === selId);
          if (node && node.isComposite) {
            this.compositeManager.enterCompositeNode(node);
            return;
          }
        }
        this.compositeManager.createCompositeFromSelection(this.state);
        this.renderer.render();
      } else {
        handleCreateBlankComposite(false);
      }
    };

    const handleCreateBlankComposite = (autoOpen = false) => {
      const rect = this.canvasContainer.getBoundingClientRect();
      const center = this.renderer.screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const compNode = this.compositeManager.createBlankCompositeNode(Math.round(center.x) - 100, Math.round(center.y) - 60, 'Composite Group');
      this.state.nodes.push(compNode);
      this.state.selectedNodeIds.clear();
      this.state.selectedNodeIds.add(compNode.id);
      this.state.notify('node_created');
      this.renderer.render();
      this.simulator.log(`Created new Composite Node: "${compNode.name}". Double-click to open.`, 'success');
      if (autoOpen) {
        this.compositeManager.enterCompositeNode(compNode);
      }
    };

    if (compTopBtn && compDropdown) {
      compTopBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = compDropdown.style.display === 'none';
        closeAllTopDropdowns();

        if (willOpen) {
          // Update dropdown item labels based on current context before opening
          const editItem = document.getElementById('menuEditCompositeNode');
          const selectedCompNode = this.state.nodes.find(n => n.isComposite && this.state.selectedNodeIds.has(n.id));
          const firstCompNode = selectedCompNode || this.state.nodes.find(n => n.isComposite);

          if (editItem) {
            if (this.compositeManager && this.compositeManager.isEditingComposite()) {
              editItem.textContent = `✎ Already Editing: ${this.compositeManager.activeCompositeNode.name}`;
              editItem.style.opacity = '0.6';
            } else if (firstCompNode) {
              editItem.textContent = `✎ Edit Composite Node: "${firstCompNode.name}"`;
              editItem.style.opacity = '1';
            } else {
              editItem.textContent = `✎ Edit Composite Node (None on canvas - click to create)`;
              editItem.style.opacity = '0.8';
            }
          }

          const exitItem = document.getElementById('menuExitCompositeEditor');
          if (exitItem) {
            exitItem.style.display = (this.compositeManager && this.compositeManager.isEditingComposite()) ? 'flex' : 'none';
          }

          compDropdown.style.display = 'block';
        }
      });
    }

    const editCompBtn = document.getElementById('menuEditCompositeNode');
    if (editCompBtn) {
      editCompBtn.addEventListener('click', () => {
        closeAllTopDropdowns();
        if (this.compositeManager && this.compositeManager.isEditingComposite()) return;
        let targetComp = this.state.nodes.find(n => n.isComposite && this.state.selectedNodeIds.has(n.id));
        if (!targetComp) {
          targetComp = this.state.nodes.find(n => n.isComposite);
        }
        if (targetComp) {
          this.compositeManager.enterCompositeNode(targetComp);
        } else {
          handleCreateBlankComposite(true);
        }
      });
    }

    const groupCompBtn = document.getElementById('menuGroupToComposite');
    if (groupCompBtn) {
      groupCompBtn.addEventListener('click', () => {
        closeAllTopDropdowns();
        handleCreateComposite();
      });
    }

    const newBlankCompBtn = document.getElementById('menuNewBlankComposite');
    if (newBlankCompBtn) {
      newBlankCompBtn.addEventListener('click', () => {
        closeAllTopDropdowns();
        handleCreateBlankComposite(false);
      });
    }

    const exitCompBtn = document.getElementById('menuExitCompositeEditor');
    if (exitCompBtn) {
      exitCompBtn.addEventListener('click', () => {
        closeAllTopDropdowns();
        if (this.compositeManager && this.compositeManager.isEditingComposite()) {
          this.compositeManager.exitCompositeNode();
        }
      });
    }

    const compMenuBtn = document.getElementById('menuCreateComposite');
    if (compMenuBtn) {
      compMenuBtn.addEventListener('click', () => {
        closeAllTopDropdowns();
        handleCreateComposite();
      });
    }

    const dockCompBtn = document.getElementById('btnCreateComposite');
    if (dockCompBtn) {
      dockCompBtn.addEventListener('click', () => {
        handleCreateComposite();
      });
    }

    document.getElementById('menuNewGraph').addEventListener('click', async () => {
      const name = await this.promptGraphName();
      if (name == null) return; // cancelled
      this.addNewGraph(name);
      this.simulator.log(`Created a new node graph: ${name}.`, 'success');
    });

    document.getElementById('menuNodeGraphVars').addEventListener('click', () => {
      this.nodeGraphVars.open();
    });

    const menuCustomVars = document.getElementById('menuCustomVars');
    if (menuCustomVars) {
      menuCustomVars.addEventListener('click', () => {
        closeAllTopDropdowns();
        this.customVars.open();
      });
    }

    document.getElementById('menuSignalExplorer').addEventListener('click', () => {
      this.signalExplorer.open();
    });

    document.getElementById('menuLoadGarage').addEventListener('click', async () => {
      this.simulator.log("Creating a new graph and loading 'garage.gia' preset...", 'info');
      this.addNewGraph('Imported');
      const ok = await GiaCodec.loadSampleGia(this.state);
      if (ok) {
        this.renderer.clearCache();
        this.renderer.render();
        this.ide.syncFromGraph();
        this.renderGraphTabs();
        this.simulator.log(`Loaded 'garage.gia' with ${this.state.nodes.length} nodes and ${this.state.wires.length} wires.`, 'success');
        this.ide.ensureNodesVisible();
      }
    });

    document.getElementById('menuToggleIde').addEventListener('click', () => {
      this.ide.setViewMode(this.ide.viewMode === 'code' ? 'nodes' : 'code');
      const tabIde = document.getElementById('tabIdeView');
      if (this.ide.viewMode === 'code') {
        if (tabIde) tabIde.classList.add('active');
      } else {
        if (tabIde) tabIde.classList.remove('active');
      }
    });

    document.getElementById('menuSyncTs').addEventListener('click', () => {
      this.ide.syncToGraph();
      this.ide.setViewMode('nodes');
      const tabIde = document.getElementById('tabIdeView');
      if (tabIde) tabIde.classList.remove('active');
    });

    document.getElementById('menuImportGia').addEventListener('click', () => {
      document.getElementById('btnLoadGia').click();
    });

    document.getElementById('menuExportGia').addEventListener('click', () => {
      document.getElementById('btnSaveGia').click();
    });

    document.getElementById('menuResetSample').addEventListener('click', () => {
      this.state.loadDefaultGenshinScene();
      this.renderer.clearCache();
      this.renderer.render();
      this.ide.syncFromGraph();
    });

    document.getElementById('menuClearAll').addEventListener('click', () => {
      if (confirm('Clear all nodes and wires on this graph?')) {
        this.state.nodes = [];
        this.state.wires = [];
        this.state.saveSnapshot();
        this.renderer.clearCache();
        this.renderer.render();
        this.ide.syncFromGraph();
      }
    });

    // Help modal
    const helpModal = document.getElementById('helpModal');
    const openHelp = () => helpModal.style.display = 'flex';
    const closeHelp = () => helpModal.style.display = 'none';

    document.getElementById('menuHelpBtn').addEventListener('click', openHelp);
    document.getElementById('btnWinHelp').addEventListener('click', openHelp);
    document.getElementById('helpCloseBtn').addEventListener('click', closeHelp);
    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) closeHelp();
    });

    // Tab interaction: the lower IDE tab switches to code view.
    const tabIde = document.getElementById('tabIdeView');
    tabIde.addEventListener('click', () => {
      this.ide.setViewMode('code');
      tabIde.classList.add('active');
    });

    // The dynamic graph tabs (in #graphTabs) are bound in renderGraphTabs().

    document.getElementById('btnNewTab').addEventListener('click', async () => {
      const name = await this.promptGraphName();
      if (name == null) return;
      this.addNewGraph(name);
      this.simulator.log(`Created a new node graph: ${name}.`, 'success');
    });
  }

  // A small styled inline prompt for naming a node graph. Resolves the trimmed
  // name, or null if the user dismisses it; defaults to the given/New Node Graph.
  promptGraphName(initial = '') {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'graph-name-overlay';
      overlay.innerHTML = `
        <div class="graph-name-modal">
          <div class="graph-name-title">Name your node graph</div>
          <input class="graph-name-input" type="text" maxlength="64" autocomplete="off" spellcheck="false" value="${this.esc(initial)}" placeholder="e.g. Enemy_AI / Garage_Door" />
          <div class="graph-name-actions">
            <button class="gn-btn gn-cancel" type="button">Cancel</button>
            <button class="gn-btn gn-ok" type="button">Create</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      const input = overlay.querySelector('.graph-name-input');
      const done = (val) => {
        overlay.remove();
        resolve(val);
      };
      overlay.querySelector('.gn-cancel').addEventListener('click', () => done(null));
      overlay.querySelector('.gn-ok').addEventListener('click', () => {
        const v = input.value.trim() || 'New_Node_Graph';
        done(this.ensureUniqueGraphName(v));
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const v = input.value.trim() || 'New_Node_Graph';
          done(this.ensureUniqueGraphName(v));
        } else if (e.key === 'Escape') {
          done(null);
        }
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) done(null);
      });
      setTimeout(() => input.focus(), 0);
    });
  }

  ensureUniqueGraphName(base) {
    let n = base;
    let k = 1;
    while (this.graphs.some(g => g.name === n)) { n = `${base}_${k++}`; }
    return n;
  }

  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      const activeTag = (document.activeElement && document.activeElement.tagName) ? document.activeElement.tagName.toLowerCase() : '';
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable ||
                       activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || document.activeElement?.isContentEditable ||
                       e.target.closest?.('.quick-spawn-input, .quick-spawn-popup, .node-search-input, .comment-tray-title, .note-bubble-title, .note-bubble-textarea, .param-input, .ide-container, input, textarea') ||
                       document.activeElement?.closest?.('.quick-spawn-input, .quick-spawn-popup, .node-search-input, .comment-tray-title, .note-bubble-title, .note-bubble-textarea, .param-input, .ide-container, input, textarea');

      // If user is actively typing in any input, search box (quickSpawn), contentEditable, or note/tray title,
      // allow native input text shortcuts (Ctrl+A to select all text, Ctrl+C, Ctrl+V, Ctrl+Z) and bypass canvas shortcuts.
      if (isTyping) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          GiaCodec.exportToFile(this.state, 'gia');
        }
        return;
      }

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        const res = this.state.undo();
        this.renderer.render();
        if (this.simulator) this.simulator.log(res ? 'Undone change (Ctrl+Z)' : 'Nothing to undo', 'info');
      }
      // Redo: Ctrl+Y or Ctrl+Shift+Z
      else if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
               ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        const res = this.state.redo();
        this.renderer.render();
        if (this.simulator) this.simulator.log(res ? 'Redone change (Ctrl+Y)' : 'Nothing to redo', 'info');
      }
      // Copy: Ctrl+C / Cmd+C
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (this.state.selectedNodeIds.size > 0) {
          e.preventDefault();
          const clip = this.state.copySelected();
          if (clip && this.simulator) {
            this.simulator.log(`Copied ${clip.nodes.length} node(s) to clipboard (Ctrl+C)`, 'info');
          }
        }
      }
      // Paste: Ctrl+V / Cmd+V
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (this.state.clipboard && this.state.clipboard.nodes && this.state.clipboard.nodes.length > 0) {
          e.preventDefault();
          const targetPos = this.renderer.lastMouseCanvasPos || null;
          const pasted = this.state.paste(targetPos);
          this.renderer.render();
          if (this.simulator) {
            this.simulator.log(`Pasted ${pasted.length} node(s) from clipboard (Ctrl+V)`, 'success');
          }
        }
      }
      // Delete selected: Delete or Backspace
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.state.selectedNodeIds.size > 0 || this.state.selectedWireIds.size > 0) {
          e.preventDefault();
          const count = this.state.selectedNodeIds.size + this.state.selectedWireIds.size;
          this.state.removeSelected();
          this.renderer.render();
          if (this.simulator) {
            this.simulator.log(`Deleted ${count} item(s)`, 'info');
          }
        }
      }
      // Duplicate: Ctrl+D
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        this.state.duplicateSelected(40, 40);
        this.renderer.render();
      }
      // Select All: Ctrl+A
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        this.state.selectedNodeIds.clear();
        for (const n of this.state.nodes) {
          this.state.selectedNodeIds.add(n.id);
        }
        this.renderer.render();
      }
      // Save: Ctrl+S
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        GiaCodec.exportToFile(this.state, 'gia');
      }
      // Create Composite Node: Ctrl+G
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (this.state.selectedNodeIds.size > 0) {
          this.compositeManager.createCompositeFromSelection(this.state);
          this.renderer.render();
        } else {
          const targetPos = this.renderer.lastMouseCanvasPos || { x: 300, y: 300 };
          const compNode = this.compositeManager.createBlankCompositeNode(targetPos.x, targetPos.y, 'Composite Group');
          this.state.nodes.push(compNode);
          this.state.selectedNodeIds.clear();
          this.state.selectedNodeIds.add(compNode.id);
          this.state.notify('node_created');
          this.renderer.render();
          if (this.simulator) {
            this.simulator.log(`Created Composite Node: "${compNode.name}" (Ctrl+G). Double-click to open.`, 'success');
          }
        }
      }
      // Toggle Notes & Comments Mode: 'C' key without modifier
      else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'c') {
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
        const activeTag = (document.activeElement && document.activeElement.tagName) ? document.activeElement.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable ||
            activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || document.activeElement?.isContentEditable) {
          return;
        }
        if (this.commentsManager) {
          e.preventDefault();
          this.commentsManager.toggleCommentingMode();
        }
      }
      // Escape key: exit comments mode, cancel merge mode or exit composite node
      else if (e.key === 'Escape') {
        if (this.commentsManager && this.commentsManager.commentMode) {
          this.commentsManager.setCommentingMode(false);
          return;
        }
        if (this.compositeManager && this.compositeManager.isEditingComposite()) {
          if (this.compositeManager.mergeMode) {
            this.compositeManager.cancelMergeMode();
          } else {
            this.compositeManager.exitCompositeNode();
          }
        }
      }
      // Enter key: open selected composite node
      else if (e.key === 'Enter' && !e.target.closest('input, textarea, select')) {
        if (!this.compositeManager || !this.compositeManager.isEditingComposite()) {
          const compNode = this.state.nodes.find(n => n.isComposite && this.state.selectedNodeIds.has(n.id));
          if (compNode) {
            e.preventDefault();
            this.compositeManager.enterCompositeNode(compNode);
          }
        }
      }
    });
  }
}

// Bootstrap application on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  new MiliastraApp();
});
