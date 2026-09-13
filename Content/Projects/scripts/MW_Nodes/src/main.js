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

class MiliastraApp {
  constructor() {
    this.appRoot = document.getElementById('app');
    this.state = new GraphState('Open_Garage', 'Server');
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

    window.addEventListener('open_signal_explorer', (e) => {
      this.signalExplorer.open(e.detail?.signalName);
    });

    window.addEventListener('open_node_graph_vars', (e) => {
      this.nodeGraphVars.open(e.detail?.varName);
    });

    this.initBottomToolbar();
    this.initConsoleDrawer();
    this.initKeyboardShortcuts();
    this.initWindowMenu();

    // Load authentic default scene from screenshots!
    this.state.loadDefaultGenshinScene();
    this.renderer.render();

    window.updateZoomDropdown = (val) => {
      const zSel = document.getElementById('zoomSelect');
      if (zSel && !document.activeElement.isSameNode(zSel)) zSel.value = `${Math.round(val * 100)}%`;
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
    this.renderer.state = s;
    this.library.state = s;
    this.quickSpawner.state = s;
    this.simulator.state = s;
    this.ide.state = s;
    this.signalExplorer.state = s;
    this.nodeGraphVars.state = s;
  }

  switchToGraph(g) {
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

  addNewGraph(name) {
    const base = name || 'Node_Graph';
    let n = base;
    let k = 1;
    while (this.graphs.some(g => g.name === n)) { n = `${base}_${k++}`; }
    const g = new GraphState(n, 'Server');
    this.graphs.push(g);
    this.switchToGraph(g);
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
  }

  renderGraphTabs() {
    const el = document.getElementById('graphTabs');
    if (!el) return;
    el.innerHTML = '';
    this.graphs.forEach((g, i) => {
      const tab = document.createElement('div');
      tab.className = 'doc-tab active-graph-tab' + (g === this.state ? ' active' : '');
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
      el.appendChild(tab);
    });
    const t = document.getElementById('activeGraphTitle');
    if (t) t.textContent = `${this.state.name} (Nodes)`;
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
          <div class="menu-item" id="menuHelpBtn">Help</div>
          
          <div class="window-dropdown-menu" id="windowDropdown" style="display:none;">
            <div class="dropdown-item" id="menuNewGraph">New Graph</div>
            <div class="dropdown-item" id="menuNodeGraphVars">Node Graph Variables...</div>
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
          <button class="dock-btn" id="btnStepReset" title="Reset Flow / Simulator">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="19 20 9 12 19 4"/><rect x="5" y="4" width="2" height="16"/></svg>
          </button>
          <button class="dock-btn" id="btnToggleConsole" title="Toggle Console & Logs">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </button>
          <button class="dock-btn" id="btnZoomFit" title="Search nodes in this graph">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          <button class="dock-btn" id="btnAutoAlign" title="Snap Nodes to Grid">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/></svg>
          </button>
          <button class="dock-btn" id="btnWireStyle" title="Toggle Wire Style (Curved / Orthogonal)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12c4-8 8-8 12 0s8 8 12 0"/></svg>
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
          
          <div class="dock-zoom-selector">
            <input id="zoomSelect" class="dock-zoom-input" value="100%" inputmode="decimal" title="Zoom — pick a preset or type a %" list="zoomLevels" />
            <datalist id="zoomLevels">
              <option value="25%"></option>
              <option value="50%"></option>
              <option value="75%"></option>
              <option value="100%"></option>
              <option value="125%"></option>
              <option value="150%"></option>
              <option value="200%"></option>
              <option value="Zoom to Fit"></option>
            </datalist>
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
    // Zoom control (editable input + preset datalist). "Zoom to Fit" is an option.
    const zoomSel = document.getElementById('zoomSelect');
    const applyZoomValue = (raw) => {
      const text = String(raw || '').trim();
      if (/fit/i.test(text)) { this.zoomToFit(); return; }
      const pct = parseInt(text, 10);
      if (!isNaN(pct)) {
        this.state.zoom = pct / 100;
        this.renderer.render();
      }
    };
    zoomSel.addEventListener('change', (e) => applyZoomValue(e.target.value));
    zoomSel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); applyZoomValue(e.target.value); zoomSel.blur(); }
    });
    zoomSel.addEventListener('input', () => {
      const text = String(zoomSel.value || '').trim();
      window.updateZoomDropdown(this.state.zoom); // keep a clean default display
    });

    // Zoom to fit (kept accessible via the dropdown's "Zoom to Fit" option)
    this.zoomToFit = this.zoomToFit.bind(this);
    this.initNodeSearch();
    document.getElementById('btnZoomFit').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleNodeSearch();
    });

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

    // Reset step
    document.getElementById('btnStepReset').addEventListener('click', () => {
      this.state.loadDefaultGenshinScene();
      this.renderer.render();
      this.simulator.log('Reset graph to default Miliastra Wonderland state.', 'info');
    });

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

    // Toggle console
    document.getElementById('btnToggleConsole').addEventListener('click', () => {
      this.toggleConsoleDrawer();
    });

    // Open Signal Explorer from toolbar
    document.getElementById('btnOpenSignals').addEventListener('click', () => {
      this.signalExplorer.open();
    });

    // Open Node Graph Variables from toolbar
    document.getElementById('btnOpenVariables').addEventListener('click', () => {
      this.nodeGraphVars.toggle();
    });
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

    winBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    });

    window.addEventListener('click', () => {
      dropdown.style.display = 'none';
    });

    document.getElementById('menuNewGraph').addEventListener('click', () => {
      this.addNewGraph('New_Node_Graph');
      this.simulator.log('Created a new node graph.', 'success');
    });

    document.getElementById('menuNodeGraphVars').addEventListener('click', () => {
      this.nodeGraphVars.open();
    });

    document.getElementById('menuSignalExplorer').addEventListener('click', () => {
      this.signalExplorer.open();
    });

    document.getElementById('menuLoadGarage').addEventListener('click', async () => {
      this.simulator.log("Creating a new graph and loading 'garage.gia' preset...", 'info');
      this.addNewGraph('Imported');
      const ok = await GiaCodec.loadSampleGia(this.state);
      if (ok) {
        this.renderer.clearCache();
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

    document.getElementById('btnNewTab').addEventListener('click', () => {
      this.addNewGraph('New_Node_Graph');
      this.simulator.log('Created a new node graph.', 'success');
    });
  }

  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Don't intercept if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
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
    });
  }
}

// Bootstrap application on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  new MiliastraApp();
});
