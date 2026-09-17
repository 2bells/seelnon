/**
 * Miliastra Wonderland interactive mirror (Lua-flavoured code ⇄ node graph)
 * Integrated development environment powered by genshin-ts
 */

import { LuaGenerator } from './luaGenerator.js';
import { LuaParser } from './luaParser.js';
import { GiaCodec } from '../giaCodec.js';
import { highlightLua, highlightLuaLine } from './utils/highlighter.js';
import { getNodeBlueprint, applyDataTypeToNode } from '../nodesData.js';
import { IdeAutocomplete } from './autocomplete.js';

const THE_LANG = {
  label: 'Lua',
  badge: 'lua-interactive',
  engine: 'Miliastra · interactive mirror',
  generate: g => LuaGenerator.generate(g),
  parse: c => LuaParser.parse(c),
  highlight: c => highlightLua(c),
};

export class MiliastraIde {
  /**
   * @param {HTMLElement} container - The container element to mount the IDE in
   * @param {GraphState} state - The global graph state instance
   * @param {GraphRenderer} renderer - The canvas renderer
   */
  constructor(container, state, renderer) {
    this.container = container || document.getElementById('workspaceBody') || document.body;
    this.state = state;
    this.renderer = renderer;
    this.viewMode = 'nodes'; // 'nodes' | 'code' | 'split'
    this.code = '';
    this.activeLogTab = 'compiler';
    this.codeDirty = false;      // user is editing the code textarea
    this.applyingFromCode = false; // currently pushing code edits into the graph

    this.initDom();
    this.autocomplete = new IdeAutocomplete(this, this.textarea, this.scrollContainer);
    this.bindEvents();
    this.attachState(this.state);
    this.syncFromGraph();
    this.setMirrorState('synced');
  }

  // Subscribe to whichever GraphState is currently active. The IDE must follow
  // graph switches (switchToGraph swaps `this.state`), so we tear the old
  // subscription down and re-arm it against the new state — otherwise graph
  // edits (picking a signal, flipping a value) never reach the Lua view.
  attachState(state) {
    if (state === this._state) return;
    if (this._unsub) { try { this._unsub(); } catch (_) {} }
    this._state = state;
    this.state = state;

    this._unsub = state.subscribe(() => {
      if (this.autocomplete) this.autocomplete.buildCatalog();
      // Never overwrite user editor buffer when editing or in code mode
      if (this.codeDirty) return;
      if (document.activeElement === this.textarea) return;
      if (this.viewMode === 'code') return;
      if (this.viewMode === 'split' && !this.applyingFromCode) {
        this.syncFromGraph();
        this.codeDirty = false;
        this.setMirrorState('synced');
      }
    });
  }

  initDom() {
    this.element = document.createElement('div');
    this.element.className = 'miliastra-ide-container';
    this.element.id = 'miliastraIde';
    this.element.style.display = 'none'; // Initially hidden if mode is 'nodes'

    this.element.innerHTML = `
      <!-- Toolbar -->
      <div class="ide-toolbar">
        <div class="ide-toolbar-left">
          <div class="ide-view-mode-group">
            <button class="ide-mode-btn" id="btnModeNodes" title="Visual Node Graph View">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M4 4h7v7H4zM13 13h7v7h-7z"/><path d="M14 7h4v4M10 17H6v-4" stroke="currentColor" stroke-width="2"/></svg>
              <span>Graph</span>
            </button>
            <button class="ide-mode-btn" id="btnModeCode" title="Lua-flavoured Code View">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              <span>Code</span>
            </button>
            <button class="ide-mode-btn" id="btnModeSplit" title="Side-by-Side Split View">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
              <span>Split</span>
            </button>
          </div>

          <div class="ide-tool-divider"></div>

          <button class="ide-tool-btn ide-tool-btn-primary" id="btnCompileTs" title="Validate & mirror back to the node graph (Lua)">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <span>Check (Lua)</span>
          </button>
        </div>

        <div class="ide-toolbar-right">
          <button class="ide-tool-btn" id="btnIdeImportGia" title="Import any .gia binary asset or JSON file">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Import .gia</span>
          </button>

          <button class="ide-tool-btn" id="btnIdeExportGia" title="Export working .gia binary asset">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span>Export .gia</span>
          </button>

          <button class="ide-tool-btn" id="btnCopyCode" title="Copy the Lua mirror to clipboard">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>Copy</span>
          </button>
        </div>
      </div>

      <!-- Main Split View & Code Editor -->
      <div class="ide-workspace-split">
        <div class="ide-editor-pane">
          <div class="ide-editor-scroll-container" id="ideScrollContainer">
            <div class="ide-line-numbers" id="ideLineNumbers">1</div>
            <div class="ide-code-surface">
              <pre class="ide-pre-highlight"><code class="language-lua" id="ideHighlightCode"></code></pre>
              <textarea class="ide-code-textarea" id="ideTextarea" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"></textarea>
            </div>
          </div>

          <!-- Bottom Drawer -->
          <div class="ide-bottom-drawer" id="ideBottomDrawer">
            <div class="ide-drawer-header">
              <div class="ide-drawer-tabs">
                <div class="ide-drawer-tab active" id="tabCompilerLogs">Compiler Output</div>
                <div class="ide-drawer-tab" id="tabGraphStats">Graph Diagnostics</div>
              </div>
              <span style="font-size:10px; color:#5C6370;">Miliastra · interactive · Lua</span>
            </div>
            <div class="ide-drawer-body" id="ideDrawerLogs">
              <div class="ide-log-line">
                <span class="ide-log-time">[${new Date().toLocaleTimeString()}]</span>
                <span class="ide-log-success">interactive mirror ready — nodes ⇄ Lua, one model, in step.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Status Bar -->
      <div class="ide-status-bar">
        <div class="ide-status-left">
          <div class="ide-status-item">
            <span>Target:</span>
            <span class="ide-badge-pill ide-badge-success">interactive mirror</span>
          </div>
          <div class="ide-status-item">
            <span>Graph:</span>
            <span id="ideStatusGraphName">${this.state.name}</span>
          </div>
          <div class="ide-status-item">
            <span>Nodes:</span>
            <span id="ideStatusNodeCount">${this.state.nodes.length}</span>
          </div>
        </div>

        <div class="ide-status-right">
          <div class="ide-status-item" id="ideMirrorState"><span class="mirror-dot">●</span> in sync</div>
          <div class="ide-status-item" id="ideCursorPos">Ln 1, Col 1</div>
          <div class="ide-status-item">
            <span class="ide-badge-pill">Lua</span>
          </div>
        </div>
      </div>
    `;

    if (this.container) {
      this.container.appendChild(this.element);
    } else {
      document.body.appendChild(this.element);
    }

    this.textarea = this.element.querySelector('#ideTextarea');
    this.highlightCode = this.element.querySelector('#ideHighlightCode');
    this.lineNumbers = this.element.querySelector('#ideLineNumbers');
    this.scrollContainer = this.element.querySelector('#ideScrollContainer');
    this.drawerLogs = this.element.querySelector('#ideDrawerLogs');
    this.cursorPos = this.element.querySelector('#ideCursorPos');
  }

  bindEvents() {
    // Mode Buttons
    const btnNodes = this.element.querySelector('#btnModeNodes');
    const btnCode = this.element.querySelector('#btnModeCode');
    const btnSplit = this.element.querySelector('#btnModeSplit');

    btnNodes.addEventListener('click', () => this.setViewMode('nodes'));
    btnCode.addEventListener('click', () => this.setViewMode('code'));
    btnSplit.addEventListener('click', () => this.setViewMode('split'));

    // Textarea Input — instantaneous isolated per-line highlight and status updates
    this.textarea.addEventListener('input', () => {
      this.handleEditorInput();
    });

    // Guard against internal textarea scroll by directing delta to scroll container
    this.textarea.addEventListener('scroll', () => {
      if (this.textarea.scrollTop !== 0 || this.textarea.scrollLeft !== 0) {
        this.scrollContainer.scrollTop += this.textarea.scrollTop;
        this.scrollContainer.scrollLeft += this.textarea.scrollLeft;
        this.textarea.scrollTop = 0;
        this.textarea.scrollLeft = 0;
      }
    });

    this.textarea.addEventListener('keyup', () => {
      this.updateCursorPos();
      this.ensureCursorVisible();
    });
    this.textarea.addEventListener('click', () => {
      this.updateCursorPos();
      this.ensureCursorVisible();
      if (this.autocomplete) this.autocomplete.hide();
    });

    // Tab & Enter Key Handling (auto-indentation) + Ctrl/Cmd+Enter = Check (Lua)
    this.textarea.addEventListener('keydown', (e) => {
      if (this.autocomplete && this.autocomplete.handleKeyDown(e)) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.checkMirror();
        return;
      }
      if (e.key === 'Enter') {
        const text = this.textarea.value;
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;

        // Find the beginning of the current line
        const lastNewline = text.lastIndexOf('\n', start - 1);
        const currentLine = text.substring(lastNewline + 1, start);
        
        // Measure leading whitespace of current line
        const matchIndent = currentLine.match(/^[ \t]*/);
        let indent = matchIndent ? matchIndent[0] : '';
        const trimmed = currentLine.trim();

        // Check if current line opens a block that requires +2 spaces indent:
        const opensBlock = (
          /\b(then|do|repeat)\s*$/.test(trimmed) ||
          /\bfunction\s*\(.*\)\s*$/.test(trimmed) ||
          /^f\.on\b/.test(trimmed) ||
          /^self\s*$/.test(trimmed) ||
          /^guid\b.*$/.test(trimmed) ||
          /:\s*$/.test(trimmed) ||
          /\{\s*$/.test(trimmed) ||
          /\(\s*$/.test(trimmed)
        );

        if (opensBlock) {
          indent += '  ';
        }

        e.preventDefault();
        const insertion = '\n' + indent;
        this.textarea.value = text.substring(0, start) + insertion + text.substring(end);
        this.textarea.selectionStart = this.textarea.selectionEnd = start + insertion.length;
        this.handleEditorInput();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        this.textarea.value = this.textarea.value.substring(0, start) + '  ' + this.textarea.value.substring(end);
        this.textarea.selectionStart = this.textarea.selectionEnd = start + 2;
        this.handleEditorInput();
      }
    });

    // Check (Lua) — the ONLY moment user edits are mirrored back to the graph.
    this.element.querySelector('#btnCompileTs').addEventListener('click', () => {
      this.checkMirror();
    });

    // Import .gia (open file picker for any .gia or .json file)
    const btnImport = this.element.querySelector('#btnIdeImportGia');
    if (btnImport) {
      btnImport.addEventListener('click', () => {
        const fileInput = document.getElementById('fileInputGia');
        if (fileInput) {
          fileInput.value = '';
          fileInput.click();
        } else {
          this.promptImportFile();
        }
      });
    }

    // Export .gia
    this.element.querySelector('#btnIdeExportGia').addEventListener('click', () => {
      GiaCodec.exportGiaFile(this.state);
      this.log(`Exported '${this.state.name}.gia' binary asset.`, 'success');
    });

    // Copy Code
    this.element.querySelector('#btnCopyCode').addEventListener('click', () => {
      navigator.clipboard.writeText(this.textarea.value).then(() => {
        this.log('Lua mirror copied to clipboard.', 'info');
      });
    });

    // Drawer Tabs
    const tabComp = this.element.querySelector('#tabCompilerLogs');
    const tabStats = this.element.querySelector('#tabGraphStats');

    tabComp.addEventListener('click', () => {
      tabComp.classList.add('active');
      tabStats.classList.remove('active');
      this.activeLogTab = 'compiler';
    });

    tabStats.addEventListener('click', () => {
      tabStats.classList.add('active');
      tabComp.classList.remove('active');
      this.activeLogTab = 'stats';
      this.showGraphDiagnostics();
    });
  }

  handleEditorInput() {
    const val = this.textarea.value;
    const sel = this.textarea.selectionStart;

    if (!this._linesCache) {
      this.updateHighlighting(true);
      this.updateLineNumbers(true);
    } else {
      const oldLen = this._linesCache.length;
      let currentLineCount = 1;
      for (let i = 0; i < val.length; i++) {
        if (val[i] === '\n') currentLineCount++;
      }

      if (currentLineCount === oldLen) {
        // High-speed single-line update (< 0.02ms)
        let lineIdx = 0;
        let lineStart = 0;
        for (let i = 0; i < sel; i++) {
          if (val[i] === '\n') {
            lineIdx++;
            lineStart = i + 1;
          }
        }
        let lineEnd = val.indexOf('\n', sel);
        if (lineEnd === -1) lineEnd = val.length;

        const currentLineText = val.substring(lineStart, lineEnd);
        if (this._linesCache[lineIdx] !== currentLineText) {
          this._linesCache[lineIdx] = currentLineText;
          const lineEl = this.highlightCode.children[lineIdx];
          if (lineEl) {
            lineEl.innerHTML = highlightLuaLine(currentLineText) || '&nbsp;';
          }
        }
      } else {
        // Multi-line / newline / deletion / paste update
        const lines = val.split('\n');
        this._linesCache = lines;
        this.highlightCode.innerHTML = lines.map(l => `<div class="ide-code-line">${highlightLuaLine(l) || '&nbsp;'}</div>`).join('');
        this.updateLineNumbers(false);
      }
    }

    this.updateCursorPos();
    this.ensureCursorVisible();
    this.codeDirty = true;
    this.setMirrorState('edited');
    if (this.autocomplete) this.autocomplete.handleInput();
  }

  ensureCursorVisible() {
    if (!this.scrollContainer || !this.textarea) return;
    const pos = this.textarea.selectionStart;
    const text = this.textarea.value;
    let row = 1;
    let lastNl = -1;
    for (let i = 0; i < pos; i++) {
      if (text[i] === '\n') {
        row++;
        lastNl = i;
      }
    }
    const col = Math.max(0, pos - lastNl - 1);
    const cursorY = (row - 1) * 20 + 12; // 20px line-height, 12px padding-top
    const cursorX = col * 7.82 + 16;

    const container = this.scrollContainer;
    const scrollTop = container.scrollTop;
    const scrollLeft = container.scrollLeft;
    const clientHeight = container.clientHeight;
    const clientWidth = container.clientWidth;

    // Vertical keep in view
    if (cursorY < scrollTop + 16) {
      container.scrollTop = Math.max(0, cursorY - 16);
    } else if (cursorY + 36 > scrollTop + clientHeight) {
      container.scrollTop = cursorY + 36 - clientHeight;
    }

    // Horizontal keep in view
    const visibleLeft = scrollLeft;
    const visibleRight = scrollLeft + clientWidth - 60;
    if (cursorX < visibleLeft) {
      container.scrollLeft = Math.max(0, cursorX - 20);
    } else if (cursorX > visibleRight) {
      container.scrollLeft = cursorX - clientWidth + 80;
    }
  }

  updateCursorPos() {
    const pos = this.textarea.selectionStart;
    const text = this.textarea.value;
    let row = 1;
    let lastNl = -1;
    for (let i = 0; i < pos; i++) {
      if (text[i] === '\n') {
        row++;
        lastNl = i;
      }
    }
    const col = pos - lastNl;
    this.cursorPos.textContent = `Ln ${row}, Col ${col}`;
  }

  updateLineNumbers(force = false) {
    const lineCount = this._linesCache ? this._linesCache.length : 1;
    if (this._lastLineCount === lineCount && !force) {
      return;
    }
    this._lastLineCount = lineCount;
    let numbers = '';
    for (let i = 1; i <= lineCount; i++) {
      numbers += `<div class="ide-line-number">${i}</div>`;
    }
    this.lineNumbers.innerHTML = numbers;
  }

  updateHighlighting(forceFull = false) {
    const code = this.textarea.value;
    const lines = code.split('\n');
    this._linesCache = lines;
    this.highlightCode.innerHTML = lines.map(l => `<div class="ide-code-line">${highlightLuaLine(l) || '&nbsp;'}</div>`).join('');
  }

  syncFromGraph() {
    const code = THE_LANG.generate(this.state);
    this.textarea.value = code;
    this.baselineLines = code.split('\n');
    this.updateHighlighting();
    this.updateLineNumbers(true);
    this.updateCursorPos();

    // Update status items
    const nameEl = this.element.querySelector('#ideStatusGraphName');
    const countEl = this.element.querySelector('#ideStatusNodeCount');
    if (nameEl) nameEl.textContent = this.state.name;
    if (countEl) countEl.textContent = this.state.nodes.length;
  }

  scheduleApplyFromCode() {
    clearTimeout(this._applyTimer);
    this._applyTimer = setTimeout(() => this.applyFromCode(), 500);
  }

  applyFromCode() {
    this.codeDirty = false;
    // Snapshot so a single bad edit can roll back inside this object instead of
    // corrupting the whole visual graph.
    const before = JSON.stringify({ nodes: this.state.nodes, wires: this.state.wires });
    try {
      this.reconcileFromCode();
    } catch (err) {
      try {
        const snap = JSON.parse(before);
        this.state.nodes = snap.nodes;
        this.state.wires = snap.wires;
      } catch (_) { /* keep whatever is left */ }
      this.log(`Apply rolled back (${err.message})`, 'error');
    }
    this.renderAllGraph();
  }

  renderAllGraph() {
    if (!this.renderer) return;
    try {
      this.renderer.render();
      requestAnimationFrame(() => {
        try { this.renderer.cachePinPositions?.(); this.renderer.renderWires?.(); } catch (_) {}
      });
    } catch (err) {
      console.warn('render error:', err);
    }
  }

  // A visible cascade position (stage coords) for newly-created-from-code nodes.
  spawnPoint() {
    const s = this.state;
    let cx = 200, cy = 120;
    const el = this.renderer && this.renderer.container;
    if (el) {
      try {
        const r = el.getBoundingClientRect();
        if (r.width > 10 && r.height > 10) {
          cx = (r.width / 2 - (s.panX || 0)) / (s.zoom || 1);
          cy = (r.height / 2 - (s.panY || 0)) / (s.zoom || 1);
        }
      } catch (_) {}
    }
    this._spawnCascade = ((this._spawnCascade || 0) + 1) % 6;
    const off = this._spawnCascade;
    return {
      x: Math.round(cx - 90 + (off % 3) * 30),
      y: Math.round(cy - 40 + Math.floor(off / 3) * 30)
    };
  }

  /**
   * Non-destructive code → graph. Parses the editor buffer, then reconciles it
   * against the live graph *by stable node id* (the `-- @id` stamps / the id
   * "background process" you see in the code).
   *
   * It is ADDITIVE-ONLY: the code can UPDATE nodes it names in place and ADD
   * brand-new nodes and links. It NEVER removes existing nodes or wires on its
   * own — the textual mirror can't name every data pin (Lua args are
   * positional), so a subtractive diff would "unplug" pins and then orphan the
   * nodes (exactly the nuking you saw). Removals stay graph-driven: delete a
   * node on the canvas and the next sync drops it from the code.
   */
  reconcileFromCode() {
    const code = this.textarea.value;
    let parsed;
    try {
      parsed = THE_LANG.parse(code);
    } catch (err) {
      this.log(`Parse error: ${err.message}`, 'error');
      return;
    }
    if (!parsed || !Array.isArray(parsed.nodes)) return;

    const state = this.state;
    this.applyingFromCode = true;
    try {
      // 0a) Custom Variables: synchronized per-nodegraph from Lua code
      if (Array.isArray(parsed.customVariables)) {
        const hasCustomVarHeader = /--\s*Custom\s*Variables/i.test(code);
        if (parsed.customVariables.length > 0 || hasCustomVarHeader) {
          state.setCustomVariables(parsed.customVariables);
        }
      }

      // 0b) Node Graph Variables: synchronized per-nodegraph from Lua code
      if (Array.isArray(parsed.graphVariables)) {
        const hasGraphVarHeader = /--\s*Node\s*Graph\s*Variables/i.test(code);
        if (parsed.graphVariables.length > 0 || hasGraphVarHeader) {
          const declaredNames = new Set(parsed.graphVariables.map(v => v.name.toLowerCase()));
          
          // Remove variables that were deleted in Lua
          const currentVars = state.getNodeGraphVariables ? state.getNodeGraphVariables() : (state.nodeGraphVariables || []);
          const toRemove = currentVars.filter(v => !declaredNames.has((v.name || '').toLowerCase()));
          for (const r of toRemove) {
            state.removeNodeGraphVariable(r.id);
          }

          // Add or update surviving/new variables
          for (const gv of parsed.graphVariables) {
            const existingVar = state.getNodeGraphVariableByName(gv.name);
            if (existingVar) {
              state.updateNodeGraphVariable(existingVar.id, {
                type: gv.type || existingVar.type,
                defaultValue: gv.defaultValue !== undefined ? gv.defaultValue : existingVar.defaultValue,
                value: gv.value !== undefined ? gv.value : existingVar.value
              });
            } else {
              state.addNodeGraphVariable(gv.name, gv.type || 'int', gv.defaultValue !== undefined ? gv.defaultValue : '');
            }
          }
          state.notify?.('node_vars_changed');
        }
      }

      const curById = new Map(state.nodes.map(n => [n.id, n]));
      const idMap = new Map(); // parsed node id -> final graph id

      // 1) Nodes: update-in-place every node the code contains; create brand-new
      //    nodes for statements the code adds. Never replaces the arrays, and
      //    never deletes a node the code didn't mention.
      const seen = new Set();
      const matchedExistingIds = new Set();
      const nodeMatchMap = new Map(); // pn.id -> existing node

      // Pass 1: Match parsed nodes to existing nodes with exact identifier / name / GUID / alias matches
      for (const pn of parsed.nodes) {
        if (seen.has(pn.id)) continue;
        seen.add(pn.id);

        let existing = curById.get(pn.id);
        if (existing && matchedExistingIds.has(existing.id)) existing = null;

        if (!existing && pn.varName) {
          existing = state.nodes.find(n => n.varName === pn.varName && !matchedExistingIds.has(n.id));
        }
        if (!existing && pn.category === 'event') {
          existing = state.nodes.find(n => n.category === 'event' && !matchedExistingIds.has(n.id) &&
            (n.blueprintId === pn.blueprintId || (pn.signalName && n.signalName === pn.signalName)));
        }
        if (!existing && pn.blueprintId === 'query_get_local_variable') {
          if (pn.varName) {
            existing = state.nodes.find(n => n.blueprintId === 'query_get_local_variable' && n.varName === pn.varName && !matchedExistingIds.has(n.id));
          } else if (pn.inputValues?.['Initial Value'] !== undefined) {
            existing = state.nodes.find(n => n.blueprintId === 'query_get_local_variable' && !n.varName && n.inputValues?.['Initial Value'] === pn.inputValues?.['Initial Value'] && !matchedExistingIds.has(n.id));
          }
        }
        if (!existing && pn.blueprintId === 'exec_set_local_var') {
          if (pn.varName) {
            existing = state.nodes.find(n => n.blueprintId === 'exec_set_local_var' && n.varName === pn.varName && !matchedExistingIds.has(n.id));
          }
        }
        if (!existing && pn.blueprintId === 'query_get_node_graph_var') {
          existing = state.nodes.find(n => n.blueprintId === 'query_get_node_graph_var' &&
            n.inputValues?.['Variable Name'] === pn.inputValues?.['Variable Name'] &&
            !matchedExistingIds.has(n.id));
        }
        if (!existing && pn.blueprintId === 'exec_set_node_graph_var') {
          existing = state.nodes.find(n => n.blueprintId === 'exec_set_node_graph_var' &&
            n.inputValues?.['Variable Name'] === pn.inputValues?.['Variable Name'] &&
            !matchedExistingIds.has(n.id));
        }
        if (!existing && pn.blueprintId === 'query_get_custom_var') {
          existing = state.nodes.find(n => n.blueprintId === 'query_get_custom_var' &&
            n.inputValues?.['Variable Name'] === pn.inputValues?.['Variable Name'] &&
            !matchedExistingIds.has(n.id));
        }
        if (!existing && pn.blueprintId === 'exec_set_custom_var') {
          existing = state.nodes.find(n => n.blueprintId === 'exec_set_custom_var' &&
            n.inputValues?.['Variable Name'] === pn.inputValues?.['Variable Name'] &&
            !matchedExistingIds.has(n.id));
        }
        if (!existing && pn.blueprintId === 'query_query_entity_by_guid') {
          existing = state.nodes.find(n => n.blueprintId === 'query_query_entity_by_guid' &&
            ((pn.guidAlias && n.guidAlias === pn.guidAlias) || (pn.inputValues?.['GUID'] && n.inputValues?.['GUID'] === pn.inputValues?.['GUID'])) &&
            !matchedExistingIds.has(n.id));
        }
        if (!existing && (pn.blueprintId === 'op_assembly_list' || (pn.name || '').toLowerCase() === 'assembly list')) {
          if (pn.listName) {
            existing = state.nodes.find(n => (n.blueprintId === 'op_assembly_list' || (n.name || '').toLowerCase() === 'assembly list') &&
              (n.listName || '').toLowerCase() === (pn.listName || '').toLowerCase() && !matchedExistingIds.has(n.id));
          }
        }
        if (!existing && pn.blueprintId === 'query_get_self_entity') {
          existing = state.nodes.find(n => n.blueprintId === 'query_get_self_entity' && !matchedExistingIds.has(n.id));
        }

        if (existing) {
          matchedExistingIds.add(existing.id);
          nodeMatchMap.set(pn.id, existing);
        }
      }

      // Pass 2: Fallback matching for renamed or restated nodes of identical blueprint
      for (const pn of parsed.nodes) {
        if (nodeMatchMap.has(pn.id)) continue;

        let existing = null;
        if (pn.blueprintId === 'op_assembly_list' || (pn.name || '').toLowerCase() === 'assembly list') {
          existing = state.nodes.find(n => (n.blueprintId === 'op_assembly_list' || (n.name || '').toLowerCase() === 'assembly list') && !matchedExistingIds.has(n.id));
        } else if (pn.blueprintId === 'query_get_custom_var') {
          existing = state.nodes.find(n => n.blueprintId === 'query_get_custom_var' && !matchedExistingIds.has(n.id));
        } else if (pn.blueprintId === 'exec_set_custom_var') {
          existing = state.nodes.find(n => n.blueprintId === 'exec_set_custom_var' && !matchedExistingIds.has(n.id));
        } else if (pn.blueprintId === 'query_query_entity_by_guid') {
          existing = state.nodes.find(n => n.blueprintId === 'query_query_entity_by_guid' && !matchedExistingIds.has(n.id));
        } else if (pn.blueprintId === 'op_equal') {
          existing = state.nodes.find(n => n.blueprintId === 'op_equal' && !matchedExistingIds.has(n.id));
        } else if (pn.blueprintId) {
          existing = state.nodes.find(n => n.blueprintId === pn.blueprintId && !matchedExistingIds.has(n.id));
        }

        if (existing) {
          matchedExistingIds.add(existing.id);
          nodeMatchMap.set(pn.id, existing);
        }
      }

      // Pass 3: Apply changes to matched nodes or spawn new nodes
      for (const pn of parsed.nodes) {
        const existing = nodeMatchMap.get(pn.id);

        if (existing) {
          this.mergeNodeFromCode(existing, pn);
          idMap.set(pn.id, existing.id);
        } else {
          const custom = {
            id: pn.id,
            inputValues: pn.inputValues || {},
            dataType: pn.dataType,
          };
          if (pn.varName) custom.varName = pn.varName;
          if (pn.listName) custom.listName = pn.listName;
          if (pn.dynamicInputs) custom.dynamicInputs = pn.dynamicInputs;
          if (pn.guidAlias) custom.guidAlias = pn.guidAlias;
          if (pn.alias) custom.alias = pn.alias;
          if (pn.customInputs) custom.customInputs = pn.customInputs;
          if (pn.signalName !== undefined) custom.signalName = pn.signalName;
          const pos = (typeof pn.x === 'number' && pn.x > 0) ? { x: pn.x, y: pn.y } : this.spawnPoint();
          const node = state.createNode(pn.blueprintId || pn.name, pos.x, pos.y, custom);
          if (node) {
            if (pn.dataType) {
              const bp = getNodeBlueprint(node.blueprintId) || getNodeBlueprint(node.name);
              if (bp) applyDataTypeToNode(node, bp, pn.dataType);
            }
            if (pn.listName) node.listName = pn.listName;
            if (pn.dynamicInputs) node.dynamicInputs = [...pn.dynamicInputs];
            if (pn.guidAlias) node.guidAlias = pn.guidAlias;
            if (pn.alias) node.alias = pn.alias;
            matchedExistingIds.add(node.id);
            idMap.set(pn.id, node.id);
          } else {
            // Unresolvable blueprint (hand-written fn not in the registry): keep the
            // parsed node verbatim so wiring and the code stay consistent.
            pn.id = `node_parsed_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
            state.nodes.push(pn);
            state.saveSnapshot?.();
            state.notify?.('node_add');
            matchedExistingIds.add(pn.id);
            idMap.set(pn.id, pn.id);
          }
        }
      }

      // 2) Wires: Lua code is the primary source of truth for the statements it controls.
      // - If code wires an input pin to a variable, connect that wire and remove any conflicting wire.
      // - If code specifies a literal or leaves an input pin unwired, remove any incoming data wire to that pin.
      // - If code changes execution flow or drops a branch statement, remove stale exec wires from that pin.
      const desiredWires = (parsed.wires || []).map(w => ({
        fromNode: idMap.get(w.fromNode) ?? w.fromNode,
        fromPin: w.fromPin,
        toNode: idMap.get(w.toNode) ?? w.toNode,
        toPin: w.toPin,
        isExec: !!w.isExec
      }));

      const codeNodeIds = new Set(parsed.nodes.map(pn => idMap.get(pn.id) ?? pn.id));

      for (const pn of parsed.nodes) {
        const nodeId = idMap.get(pn.id) ?? pn.id;
        const node = state.nodes.find(n => n.id === nodeId);
        if (!node) continue;
        const bp = getNodeBlueprint(node.blueprintId) || getNodeBlueprint(node.name);

        // A) Data input pins governed by this node in the code
        const inputPins = new Set();
        if (bp && Array.isArray(bp.inputs)) {
          bp.inputs.forEach(i => inputPins.add(i.name));
        }
        if (node.customInputs && Array.isArray(node.customInputs)) {
          node.customInputs.forEach(c => c && c.name && inputPins.add(c.name));
        }
        if (bp?.id === 'flow_double_branch') inputPins.add('Condition');
        if (bp?.id === 'flow_multiple_branches') inputPins.add('Control Expression');
        if (pn.inputValues) {
          Object.keys(pn.inputValues).forEach(k => inputPins.add(k));
        }

        for (const pinName of inputPins) {
          const desiredWire = desiredWires.find(w => !w.isExec && w.toNode === nodeId && w.toPin === pinName);
          if (desiredWire) {
            state.wires = state.wires.filter(w => {
              if (!w.isExec && w.toNode === nodeId && w.toPin === pinName) {
                return w.fromNode === desiredWire.fromNode && w.fromPin === desiredWire.fromPin;
              }
              return true;
            });
          } else {
            state.wires = state.wires.filter(w => !(w.toNode === nodeId && w.toPin === pinName && !w.isExec));
          }
        }

        // B) Exec output pins governed by this node in the code
        const execOutPins = new Set();
        if (bp?.id === 'flow_double_branch') {
          execOutPins.add('Yes');
          execOutPins.add('No');
        } else if (bp?.id === 'flow_multiple_branches') {
          const branches = node.dynamicBranches || ['Branch 0', 'Branch 1', 'Branch 2', 'Default'];
          branches.forEach(b => execOutPins.add(b));
        } else if (node.category === 'event' || bp?.execOut === true) {
          execOutPins.add('execOut');
        } else if (Array.isArray(bp?.execOut)) {
          bp.execOut.forEach(p => execOutPins.add(p));
        }

        for (const outPin of execOutPins) {
          const desiredExec = desiredWires.find(w => w.isExec && w.fromNode === nodeId && w.fromPin === outPin);
          if (desiredExec) {
            state.wires = state.wires.filter(w => {
              if (w.isExec && w.fromNode === nodeId && w.fromPin === outPin) {
                return w.toNode === desiredExec.toNode && w.toPin === desiredExec.toPin;
              }
              return true;
            });
          } else {
            state.wires = state.wires.filter(w => !(w.fromNode === nodeId && w.fromPin === outPin && w.isExec));
          }
        }
      }

      // C) Add all desired wires that don't already exist
      for (const w of desiredWires) {
        const exists = state.wires.some(x =>
          x.fromNode === w.fromNode && x.fromPin === w.fromPin &&
          x.toNode === w.toNode && x.toPin === w.toPin &&
          !!x.isExec === w.isExec
        );
        if (!exists) {
          state.addWire(w.fromNode, w.fromPin, w.toNode, w.toPin, w.isExec);
        }
      }

      // D) Re-evaluate dynamic pin types for any affected nodes
      for (const nodeId of codeNodeIds) {
        state.refreshNodePinTypes?.(nodeId);
      }

      // E) Clean up orphaned Assembly List nodes (list.name = {...}) that were removed from Lua
      const orphanListNodes = state.nodes.filter(n =>
        (n.blueprintId === 'op_assembly_list' || (n.name || '').toLowerCase() === 'assembly list') &&
        !matchedExistingIds.has(n.id)
      );
      for (const orphan of orphanListNodes) {
        state.removeNode?.(orphan.id);
      }

      // Clean up orphaned Custom Variable nodes (Set / Get) that were removed from Lua
      const orphanCustomVarNodes = state.nodes.filter(n =>
        (n.blueprintId === 'exec_set_custom_var' || n.blueprintId === 'query_get_custom_var') &&
        !matchedExistingIds.has(n.id)
      );
      for (const orphan of orphanCustomVarNodes) {
        state.removeNode?.(orphan.id);
      }

      // Clean up orphaned Node Graph Variable nodes (Set / Get) that were removed from Lua
      const orphanNodeGraphVarNodes = state.nodes.filter(n =>
        (n.blueprintId === 'exec_set_node_graph_var' || n.blueprintId === 'query_get_node_graph_var') &&
        !matchedExistingIds.has(n.id)
      );
      for (const orphan of orphanNodeGraphVarNodes) {
        state.removeNode?.(orphan.id);
      }

      // Clean up orphaned Exec / Flow nodes that were removed from Lua
      const orphanExecNodes = state.nodes.filter(n =>
        (n.category === 'execution' || n.category === 'flow' || n.blueprintId?.startsWith('exec_') || n.blueprintId?.startsWith('flow_')) &&
        !matchedExistingIds.has(n.id)
      );
      for (const orphan of orphanExecNodes) {
        state.removeNode?.(orphan.id);
      }

      // Clean up orphan Get Self Entity / Query Entity by GUID / Math Op nodes that have 0 remaining connections
      const orphanEntityQueryNodes = state.nodes.filter(n =>
        (n.blueprintId === 'query_get_self_entity' || n.blueprintId === 'query_query_entity_by_guid' || n.blueprintId?.startsWith('op_')) &&
        !matchedExistingIds.has(n.id) &&
        !state.wires.some(w => w.fromNode === n.id || w.toNode === n.id)
      );
      for (const orphan of orphanEntityQueryNodes) {
        state.removeNode?.(orphan.id);
      }
    } catch (err) {
      this.log(`✗ could not apply code → graph: ${err.message}`, 'error');
    } finally {
      this.applyingFromCode = false;
    }
  }

  // Carry the code-specified fields onto an existing node without disturbing
  // its position or any pin the code didn't mention (preserves true/false, etc.).
  // inputValues are normalized to the node's *real* pin set, so untouched pins
  // keep their values while stray `param_N` keys can never accumulate.
  mergeNodeFromCode(existing, pn) {
    const isList = existing.blueprintId === 'op_assembly_list' || (existing.name || '').toLowerCase() === 'assembly list';
    if (isList) {
      if (pn.listName) existing.listName = pn.listName;
      if (pn.dynamicInputs && Array.isArray(pn.dynamicInputs)) {
        existing.dynamicInputs = [...pn.dynamicInputs];
      }
      if (pn.inputValues) {
        existing.inputValues = { ...pn.inputValues };
      }
    } else {
      const pnVals = pn.inputValues || {};
      const next = Object.assign({}, existing.inputValues || {}, pnVals);
      existing.inputValues = next;
    }

    if (pn.dataType !== undefined && pn.dataType !== null) {
      existing.dataType = pn.dataType;
      const bp = getNodeBlueprint(existing.blueprintId) || getNodeBlueprint(existing.name);
      if (bp) applyDataTypeToNode(existing, bp, pn.dataType);
    }
    if (pn.varName) existing.varName = pn.varName;
    if (pn.guidAlias !== undefined) existing.guidAlias = pn.guidAlias;
    if (pn.alias !== undefined) existing.alias = pn.alias;
    if (pn.customInputs && Array.isArray(pn.customInputs)) existing.customInputs = pn.customInputs;
    if (pn.signalName !== undefined) existing.signalName = pn.signalName;
  }

  // Legacy alias — now non-destructive (apply on demand instead of full rebuild).
  syncToGraph() {
    this.applyFromCode();
  }

  // The "gate": user edits are mirrored back only here, on demand. Validate the
// Lua against the live graph, log the diff, then reconcile IN PLACE (by id)
// and regenerate clean Lua so both views are lock-step again.
checkMirror() {
  this.log('Checking Lua mirror against the node graph…', 'info');
  let parsed;
  try {
    parsed = THE_LANG.parse(this.textarea.value);
  } catch (err) {
    this.log(`✗ Lua could not be read back: ${err.message}`, 'error');
    this.setMirrorState('bad');
    return;
  }
  if (!parsed || !Array.isArray(parsed.nodes)) {
    this.log('✗ no handler found — drop a "when …" node or add utils.on(…)', 'error');
    this.setMirrorState('bad');
    return;
  }
  const preserved = parsed.nodes.filter(pn => this.state.nodes.some(n => n.id === pn.id)).length;
  const added = parsed.nodes.length - preserved;
  this.log(`✓ read back ${parsed.nodes.length} node(s) & ${parsed.wires.length} link(s) — ${preserved} kept, ${Math.max(0, added)} added`, 'success');

  this.applyFromCode();          // reconcile the graph in place
  this.codeDirty = false;
  this.setMirrorState('synced');
  this.syncFromGraph();          // regenerate clean, now-lock-step code
  this.log('↻ one model ⇄ two views · nodes and code are in step', 'info');
}

// Live status pill: ● in sync   △ edited — press Check to mirror.
setMirrorState(state) {
  const el = this.element.querySelector('#ideMirrorState');
  if (!el) return;
  if (state === 'edited') {
    el.className = 'ide-status-item ide-mirror-dirty';
    el.innerHTML = '<span class="mirror-dot">▲</span> edited — press Check';
  } else if (state === 'bad') {
    el.className = 'ide-status-item ide-mirror-bad';
    el.innerHTML = '<span class="mirror-dot">!</span> can’t read back';
  } else {
    el.className = 'ide-status-item ide-mirror-ok';
    el.innerHTML = '<span class="mirror-dot">●</span> in sync';
  }
}

  async loadGarageSample() {
    this.log('Loading authentic sample garage.gia...', 'info');
    try {
      const loaded = await GiaCodec.loadSampleGia(this.state);
      if (loaded) {
        this.renderer.render();
        this.syncFromGraph();
        this.log(`✓ Loaded 'garage.gia' with ${this.state.nodes.length} nodes and ${this.state.wires.length} connections.`, 'success');
      }
    } catch (err) {
      this.log(`Error loading garage.gia: ${err.message}`, 'error');
    }
  }

  showGraphDiagnostics() {
    let html = `<div class="ide-log-line ide-log-info">Graph '${this.state.name}' (${this.state.type})</div>`;
    this.state.nodes.forEach((n, i) => {
      const inWires = this.state.wires.filter(w => w.toNode === n.id).length;
      const outWires = this.state.wires.filter(w => w.fromNode === n.id).length;
      html += `<div class="ide-log-line">Node ${i + 1}: <strong>${n.name}</strong> [${n.category}] - In: ${inWires}, Out: ${outWires}</div>`;
    });
    this.drawerLogs.innerHTML = html;
  }

  log(message, type = 'info') {
    const line = document.createElement('div');
    line.className = 'ide-log-line';
    const time = new Date().toLocaleTimeString();
    line.innerHTML = `
      <span class="ide-log-time">[${time}]</span>
      <span class="ide-log-${type}">${message}</span>
    `;
    this.drawerLogs.appendChild(line);
    this.drawerLogs.scrollTop = this.drawerLogs.scrollHeight;
  }

  promptImportFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.gia,.json';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        this.log(`Importing '${file.name}' into Miliastra Wonderland...`, 'info');
        try {
          const success = await GiaCodec.importGiaFile(file, this.state);
          if (success) {
            this.renderer.render();
            const titleEl = document.getElementById('activeGraphTitle');
            if (titleEl) titleEl.textContent = `${this.state.name} (Nodes)`;
            this.syncFromGraph();
            this.log(`✓ Imported '${file.name}' with ${this.state.nodes.length} nodes and ${this.state.wires.length} connections.`, 'success');
            this.ensureNodesVisible();
          }
        } catch (err) {
          this.log(`Import failed: ${err.message}`, 'error');
        }
      }
      input.remove();
    });
    input.click();
  }

  ensureNodesVisible() {
    if (!this.state.nodes || this.state.nodes.length === 0 || !this.renderer) return;
    const canvasViewport = document.getElementById('canvasViewport');
    if (!canvasViewport) return;
    const rect = canvasViewport.getBoundingClientRect();
    if (rect.width <= 10 || rect.height <= 10) return;

    const zoom = this.state.zoom || 1;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of this.state.nodes) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + 220);
      maxY = Math.max(maxY, node.y + 140);
    }

    // Check if at least one node is in the visible viewport
    const anyVisible = this.state.nodes.some(n => {
      const sx = this.state.panX + n.x * zoom;
      const sy = this.state.panY + n.y * zoom;
      return sx < rect.width - 20 && sx + 220 * zoom > 20 &&
             sy < rect.height - 20 && sy + 140 * zoom > 20;
    });

    if (!anyVisible) {
      this.state.panX = 40 - minX * zoom;
      this.state.panY = 60 - minY * zoom;
      this.renderer.render();
      this.renderer.cachePinPositions();
      this.renderer.renderWires();
    }
  }

  setViewMode(mode) {
    this.viewMode = mode;
    const canvasViewport = document.getElementById('canvasViewport');
    const librarySlot = document.getElementById('librarySlot');
    const bottomDock = document.querySelector('.bottom-dock-container');
    const tabActive = document.getElementById('tabActiveGraph');
    const tabIde = document.getElementById('tabIdeView');

    // Update active button states in IDE toolbar
    this.element.querySelectorAll('.ide-mode-btn').forEach(btn => btn.classList.remove('active'));

    if (mode === 'nodes') {
      this.element.querySelector('#btnModeNodes')?.classList.add('active');
      this.element.style.display = 'none';

      if (canvasViewport) {
        canvasViewport.style.display = 'block';
        canvasViewport.style.position = 'absolute';
        canvasViewport.style.left = '0';
        canvasViewport.style.top = '0';
        canvasViewport.style.bottom = '0';
        canvasViewport.style.width = '100%';
        canvasViewport.style.height = '100%';
        canvasViewport.style.zIndex = '1';
      }
      if (librarySlot) librarySlot.style.display = 'block';
      if (bottomDock) {
        bottomDock.style.display = 'block';
        bottomDock.style.left = '50%';
      }

      tabActive?.classList.add('active');
      tabIde?.classList.remove('active');

      if (this.renderer) {
        this.renderer.render();
        requestAnimationFrame(() => {
          this.renderer.cachePinPositions();
          this.renderer.renderWires();
        });
      }
    } else if (mode === 'code') {
      this.element.querySelector('#btnModeCode')?.classList.add('active');
      this.element.style.display = 'flex';
      this.element.style.position = 'absolute';
      this.element.style.left = '0';
      this.element.style.top = '0';
      this.element.style.bottom = '0';
      this.element.style.width = '100%';
      this.element.style.height = '100%';
      this.element.style.borderRight = 'none';
      this.element.style.zIndex = '10';

      if (canvasViewport) canvasViewport.style.display = 'none';
      if (librarySlot) librarySlot.style.display = 'none';
      if (bottomDock) bottomDock.style.display = 'none';

      tabIde?.classList.add('active');
      tabActive?.classList.remove('active');

      this.syncFromGraph();
    } else if (mode === 'split') {
      this.element.querySelector('#btnModeSplit')?.classList.add('active');
      this.element.style.display = 'flex';
      this.element.style.position = 'absolute';
      this.element.style.left = '0';
      this.element.style.top = '0';
      this.element.style.bottom = '0';
      this.element.style.width = '50%';
      this.element.style.height = '100%';
      this.element.style.borderRight = '1px solid #2B303C';
      this.element.style.zIndex = '10';

      if (canvasViewport) {
        canvasViewport.style.display = 'block';
        canvasViewport.style.position = 'absolute';
        canvasViewport.style.left = '50%';
        canvasViewport.style.top = '0';
        canvasViewport.style.bottom = '0';
        canvasViewport.style.width = '50%';
        canvasViewport.style.height = '100%';
        canvasViewport.style.zIndex = '1';
      }
      if (librarySlot) librarySlot.style.display = 'block';
      if (bottomDock) {
        bottomDock.style.display = 'block';
        bottomDock.style.left = '75%';
      }

      tabActive?.classList.add('active');
      tabIde?.classList.add('active');

      this.syncFromGraph();

      if (this.renderer) {
        this.renderer.render();
        requestAnimationFrame(() => {
          this.renderer.cachePinPositions();
          this.renderer.renderWires();
          this.ensureNodesVisible();
        });
      }
    }
  }
}
