/**
 * Server Signal Explorer Modal
 * Replicates the authentic Miliastra Wonderland Signal Manager UI from the game.
 * Supports signal creation, search filtering, parameter definitions (Name + Type),
 * reference inspection, and real-time synchronization with Monitor/Send Signal nodes.
 */

import { signalsManager, SIGNAL_PARAM_TYPES, getSignalTypeLabel, normalizeSignalType } from './signalsManager.js';

let windowZIndexCounter = 300;

export class SignalExplorer {
  constructor(graphState, renderer) {
    this.graphState = graphState;
    this.renderer = renderer;
    this.isOpen = false;

    // Working draft of signals (cloned on open to support Clear Changes / Apply Changes)
    this.draftSignals = [];
    this.selectedSignalName = 'HC_Weapon';
    this.searchQuery = '';
    this.hasPendingChanges = false;

    // Draft for new parameter input row
    this.draftParamName = '';
    this.draftParamType = 'int';

    this.initDom();
    this.bindEvents();
  }

  bringToFront() {
    this.card.style.zIndex = `${++windowZIndexCounter}`;
  }

  initDom() {
    this.card = document.createElement('div');
    this.card.className = 'signal-explorer-card';
    this.card.id = 'signalExplorerCard';
    this.card.style.display = 'none';
    this.card.style.position = 'fixed';
    this.card.style.left = '40px';
    this.card.style.top = '60px';
    this.card.style.zIndex = `${++windowZIndexCounter}`;

    this.card.innerHTML = `
      <!-- Header (Draggable) -->
      <div class="sig-header" id="sigHeader">
        <div class="sig-header-left">
          <span class="sig-header-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4.93 19.07A10 10 0 0 1 19.07 4.93" stroke-linecap="round"/>
              <path d="M7.76 16.24a6 6 0 0 1 8.48-8.48" stroke-linecap="round"/>
              <path d="M10.59 13.41a2 2 0 0 1 2.82-2.82" stroke-linecap="round"/>
              <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
            </svg>
          </span>
          <span class="sig-header-title">Server Signal Explorer</span>
        </div>
        <div class="sig-header-actions">
          <button class="sig-btn-icon sig-help-btn" id="sigHelpBtn" title="Help & Information">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor"/>
              <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2 2-2 3"/>
              <circle cx="12" cy="16.5" r="0.75" fill="currentColor"/>
            </svg>
          </button>
          <button class="sig-btn-icon sig-close-btn" id="sigCloseBtn" title="Close">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Body Split Container -->
      <div class="sig-body">
        <!-- Left Sidebar: Search & Signal List -->
        <div class="sig-sidebar">
          <div class="sig-search-row">
            <span class="sig-search-icon">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input type="text" class="sig-search-input" id="sigSearchInput" placeholder="Search signals..." autocomplete="off" />
            <button class="sig-search-clear-btn" id="sigSearchClearBtn" style="display:none;">✕</button>
          </div>

          <div class="sig-list-container" id="sigListContainer"></div>

          <button class="sig-add-signal-btn" id="sigAddSignalBtn">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Signal
          </button>
        </div>

        <!-- Right Content: Signal Parameter Configuration -->
        <div class="sig-content">
          <div class="sig-content-header">
            <div class="sig-title-row">
              <input type="text" class="sig-name-input" id="sigNameInput" value="" title="Click to rename signal" />
              <button class="sig-options-btn" id="sigOptionsBtn" title="Signal Options">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <circle cx="5" cy="12" r="2"/>
                  <circle cx="12" cy="12" r="2"/>
                  <circle cx="19" cy="12" r="2"/>
                </svg>
              </button>
              <div class="sig-options-menu" id="sigOptionsMenu" style="display:none;">
                <div class="sig-menu-item" id="sigMenuRename">Rename Signal</div>
                <div class="sig-menu-item" id="sigMenuDuplicate">Duplicate Signal</div>
                <div class="sig-menu-divider"></div>
                <div class="sig-menu-item sig-menu-danger" id="sigMenuDelete">Delete Signal</div>
              </div>
            </div>

            <div class="sig-reference-row">
              <button class="sig-reference-link" id="sigRefLink">
                <span class="sig-ref-text">View Node Graph Reference</span>
                <span class="sig-ref-icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="9"/>
                    <line x1="12" y1="16" x2="12" y2="11"/>
                    <circle cx="12" cy="8" r="0.8" fill="currentColor"/>
                  </svg>
                </span>
              </button>
              <div class="sig-ref-popover" id="sigRefPopover" style="display:none;"></div>
            </div>
          </div>

          <!-- Parameter Rows Table -->
          <div class="sig-params-scroll" id="sigParamsScroll">
            <div class="sig-params-list" id="sigParamsList"></div>

            <!-- Draft Row for Adding New Parameter -->
            <div class="sig-draft-param-row">
              <span class="sig-param-idx" id="sigNextParamIdx">1</span>
              <input type="text" class="sig-param-input" id="sigDraftParamName" placeholder="Parameter Name" />
              <div class="sig-type-select-wrap">
                <select class="sig-param-select" id="sigDraftParamType"></select>
                <span class="sig-select-arrow">▼</span>
              </div>
            </div>

            <button class="sig-add-param-btn" id="sigAddParamBtn">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Parameter
            </button>
          </div>
        </div>
      </div>

      <!-- Footer Action Bar -->
      <div class="sig-footer">
        <button class="sig-footer-btn sig-btn-clear" id="sigClearChangesBtn">Clear Changes</button>
        <button class="sig-footer-btn sig-btn-apply" id="sigApplyChangesBtn">Apply Changes</button>
      </div>
    `;

    document.body.appendChild(this.card);

    // Populate type options in draft selector
    const draftTypeSelect = this.card.querySelector('#sigDraftParamType');
    SIGNAL_PARAM_TYPES.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.label;
      if (t.id === 'int') opt.selected = true;
      draftTypeSelect.appendChild(opt);
    });
  }

  bindEvents() {
    // Bring window to front on click
    this.card.addEventListener('mousedown', () => {
      this.bringToFront();
    });

    // Draggable header
    const header = this.card.querySelector('#sigHeader');
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      isDragging = true;
      const rect = this.card.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      this.bringToFront();
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const maxLeft = window.innerWidth - 100;
      const maxTop = window.innerHeight - 80;
      const newLeft = Math.max(10, Math.min(maxLeft, e.clientX - dragOffsetX));
      const newTop = Math.max(30, Math.min(maxTop, e.clientY - dragOffsetY));
      this.card.style.left = `${newLeft}px`;
      this.card.style.top = `${newTop}px`;
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // Close button
    this.card.querySelector('#sigCloseBtn').addEventListener('click', () => {
      this.close();
    });

    // Help button
    this.card.querySelector('#sigHelpBtn').addEventListener('click', () => {
      alert("Server Signal Explorer:\n\nDefine global custom signals and their data payload parameters.\n\n• 'Send Signal' nodes broadcast signals with the specified parameters.\n• 'Monitor Signal' nodes dynamically receive the parameters as output sockets to wire into your graph logic.\n• Click 'Apply Changes' to propagate changes to your canvas nodes.");
    });

    // Search input
    const searchInput = this.card.querySelector('#sigSearchInput');
    const searchClear = this.card.querySelector('#sigSearchClearBtn');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      searchClear.style.display = this.searchQuery ? 'block' : 'none';
      this.renderSidebar();
    });
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      this.searchQuery = '';
      searchClear.style.display = 'none';
      this.renderSidebar();
    });

    // Add Signal button
    this.card.querySelector('#sigAddSignalBtn').addEventListener('click', () => {
      let idx = 1;
      let newName = `Signal_${idx}`;
      while (this.draftSignals.some(s => s.name === newName)) {
        idx++;
        newName = `Signal_${idx}`;
      }
      this.draftSignals.push({
        name: newName,
        params: [],
        hasDot: true
      });
      this.selectedSignalName = newName;
      this.hasPendingChanges = true;
      this.render();
      
      // Auto-focus name input
      setTimeout(() => {
        const nameInp = this.card.querySelector('#sigNameInput');
        if (nameInp) {
          nameInp.focus();
          nameInp.select();
        }
      }, 50);
    });

    // Rename active signal via header input
    const nameInput = this.card.querySelector('#sigNameInput');
    nameInput.addEventListener('change', (e) => {
      const newName = e.target.value.trim();
      if (!newName || newName === this.selectedSignalName) return;
      const curSig = this.getSelectedSignal();
      if (curSig) {
        curSig.name = newName;
        curSig.hasDot = true;
        this.selectedSignalName = newName;
        this.hasPendingChanges = true;
        this.renderSidebar();
      }
    });

    // Options dropdown button
    const optBtn = this.card.querySelector('#sigOptionsBtn');
    const optMenu = this.card.querySelector('#sigOptionsMenu');
    optBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      optMenu.style.display = optMenu.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', () => {
      optMenu.style.display = 'none';
    });

    // Rename option
    this.card.querySelector('#sigMenuRename').addEventListener('click', () => {
      optMenu.style.display = 'none';
      nameInput.focus();
      nameInput.select();
    });

    // Duplicate option
    this.card.querySelector('#sigMenuDuplicate').addEventListener('click', () => {
      optMenu.style.display = 'none';
      const curSig = this.getSelectedSignal();
      if (!curSig) return;
      let newName = `${curSig.name}_Copy`;
      let count = 1;
      while (this.draftSignals.some(s => s.name === newName)) {
        count++;
        newName = `${curSig.name}_Copy_${count}`;
      }
      this.draftSignals.push({
        name: newName,
        params: JSON.parse(JSON.stringify(curSig.params || [])),
        hasDot: true
      });
      this.selectedSignalName = newName;
      this.hasPendingChanges = true;
      this.render();
    });

    // Delete option
    this.card.querySelector('#sigMenuDelete').addEventListener('click', () => {
      optMenu.style.display = 'none';
      const curSig = this.getSelectedSignal();
      if (!curSig) return;
      if (confirm(`Delete signal "${curSig.name}"?`)) {
        const idx = this.draftSignals.findIndex(s => s.name === curSig.name);
        if (idx !== -1) {
          this.draftSignals.splice(idx, 1);
          this.hasPendingChanges = true;
          this.selectedSignalName = this.draftSignals.length > 0 ? this.draftSignals[0].name : '';
          this.render();
        }
      }
    });

    // View Node Graph Reference popover
    const refLink = this.card.querySelector('#sigRefLink');
    const refPopover = this.card.querySelector('#sigRefPopover');
    refLink.addEventListener('click', (e) => {
      e.stopPropagation();
      if (refPopover.style.display === 'block') {
        refPopover.style.display = 'none';
      } else {
        this.renderReferences(refPopover);
        refPopover.style.display = 'block';
      }
    });
    document.addEventListener('click', (e) => {
      if (!refPopover.contains(e.target) && e.target !== refLink) {
        refPopover.style.display = 'none';
      }
    });

    // Add Parameter button
    const addParamBtn = this.card.querySelector('#sigAddParamBtn');
    const draftNameInput = this.card.querySelector('#sigDraftParamName');
    const draftTypeSelect = this.card.querySelector('#sigDraftParamType');

    const handleAddParam = () => {
      const curSig = this.getSelectedSignal();
      if (!curSig) return;
      let paramName = draftNameInput.value.trim();
      if (!paramName) {
        paramName = `Param_${(curSig.params || []).length + 1}`;
      }
      const paramType = draftTypeSelect.value || 'int';

      curSig.params = curSig.params || [];
      curSig.params.push({
        id: `p_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: paramName,
        type: paramType
      });
      curSig.hasDot = true;
      this.hasPendingChanges = true;

      // Reset draft input
      draftNameInput.value = '';
      draftTypeSelect.value = 'int';

      this.renderContent();
      draftNameInput.focus();
    };

    addParamBtn.addEventListener('click', handleAddParam);
    draftNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddParam();
      }
    });

    // Clear Changes button
    this.card.querySelector('#sigClearChangesBtn').addEventListener('click', () => {
      this.resetDraftFromManager();
      this.hasPendingChanges = false;
      this.render();
    });

    // Apply Changes button
    this.card.querySelector('#sigApplyChangesBtn').addEventListener('click', () => {
      this.applyChanges();
    });
  }

  open(preferredSignalName = null) {
    this.isOpen = true;
    this.resetDraftFromManager();

    if (preferredSignalName && this.draftSignals.some(s => s.name === preferredSignalName)) {
      this.selectedSignalName = preferredSignalName;
    } else if (!this.draftSignals.some(s => s.name === this.selectedSignalName)) {
      this.selectedSignalName = this.draftSignals.length > 0 ? this.draftSignals[0].name : '';
    }

    this.hasPendingChanges = false;
    this.render();
    this.card.style.display = 'flex';
    this.bringToFront();

    const dockBtn = document.getElementById('btnOpenSignals');
    if (dockBtn) dockBtn.classList.add('active');
  }

  close() {
    this.isOpen = false;
    this.card.style.display = 'none';

    const dockBtn = document.getElementById('btnOpenSignals');
    if (dockBtn) dockBtn.classList.remove('active');
  }

  toggle(preferredSignalName = null) {
    if (this.isOpen) {
      this.close();
    } else {
      this.open(preferredSignalName);
    }
  }

  resetDraftFromManager() {
    const raw = signalsManager.serialize();
    this.draftSignals = JSON.parse(JSON.stringify(raw));
  }

  getSelectedSignal() {
    return this.draftSignals.find(s => s.name === this.selectedSignalName) || null;
  }

  render() {
    this.renderSidebar();
    this.renderContent();
  }

  renderSidebar() {
    const listContainer = this.card.querySelector('#sigListContainer');
    listContainer.innerHTML = '';

    const filtered = this.draftSignals.filter(s => {
      if (!this.searchQuery) return true;
      return s.name.toLowerCase().includes(this.searchQuery);
    });

    if (filtered.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'sig-empty-notice';
      emptyDiv.textContent = 'No matching signals';
      listContainer.appendChild(emptyDiv);
      return;
    }

    filtered.forEach(sig => {
      const item = document.createElement('div');
      item.className = 'sig-item';
      if (sig.name === this.selectedSignalName) {
        item.classList.add('selected');
      }

      const nameSpan = document.createElement('span');
      nameSpan.className = 'sig-item-name';
      nameSpan.textContent = sig.name;
      item.appendChild(nameSpan);

      // Status indicator dot (orange dot as seen in screenshot for custom / active signals)
      if (sig.hasDot) {
        const dot = document.createElement('span');
        dot.className = 'sig-item-dot';
        item.appendChild(dot);
      }

      item.addEventListener('click', () => {
        this.selectedSignalName = sig.name;
        this.render();
      });

      listContainer.appendChild(item);
    });
  }

  renderContent() {
    const curSig = this.getSelectedSignal();
    const nameInput = this.card.querySelector('#sigNameInput');
    const paramsList = this.card.querySelector('#sigParamsList');
    const nextIdxSpan = this.card.querySelector('#sigNextParamIdx');

    if (!curSig) {
      nameInput.value = 'No Signal Selected';
      nameInput.disabled = true;
      paramsList.innerHTML = '<div class="sig-empty-notice">Select or add a signal from the left sidebar.</div>';
      nextIdxSpan.textContent = '1';
      return;
    }

    nameInput.disabled = false;
    nameInput.value = curSig.name;

    const params = curSig.params || [];
    paramsList.innerHTML = '';
    nextIdxSpan.textContent = `${params.length + 1}`;

    params.forEach((param, idx) => {
      const row = document.createElement('div');
      row.className = 'sig-param-row';

      // 1. Index Number
      const idxSpan = document.createElement('span');
      idxSpan.className = 'sig-param-idx';
      idxSpan.textContent = `${idx + 1}`;
      row.appendChild(idxSpan);

      // 2. Name input
      const pNameInput = document.createElement('input');
      pNameInput.type = 'text';
      pNameInput.className = 'sig-param-input';
      pNameInput.value = param.name;
      pNameInput.placeholder = 'Parameter Name';
      pNameInput.addEventListener('change', (e) => {
        param.name = e.target.value.trim() || `Param_${idx + 1}`;
        curSig.hasDot = true;
        this.hasPendingChanges = true;
      });
      row.appendChild(pNameInput);

      // 3. Type select
      const typeWrap = document.createElement('div');
      typeWrap.className = 'sig-type-select-wrap';

      const select = document.createElement('select');
      select.className = 'sig-param-select';
      SIGNAL_PARAM_TYPES.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.label;
        if (normalizeSignalType(param.type) === t.id) {
          opt.selected = true;
        }
        select.appendChild(opt);
      });

      select.addEventListener('change', (e) => {
        param.type = e.target.value;
        curSig.hasDot = true;
        this.hasPendingChanges = true;
      });
      typeWrap.appendChild(select);

      const arrow = document.createElement('span');
      arrow.className = 'sig-select-arrow';
      arrow.textContent = '▼';
      typeWrap.appendChild(arrow);

      row.appendChild(typeWrap);

      // 4. Delete parameter button
      const delBtn = document.createElement('button');
      delBtn.className = 'sig-param-del-btn';
      delBtn.innerHTML = '✕';
      delBtn.title = 'Remove parameter';
      delBtn.addEventListener('click', () => {
        curSig.params.splice(idx, 1);
        curSig.hasDot = true;
        this.hasPendingChanges = true;
        this.renderContent();
      });
      row.appendChild(delBtn);

      paramsList.appendChild(row);
    });
  }

  renderReferences(container) {
    container.innerHTML = '';
    const curSig = this.getSelectedSignal();
    if (!curSig) {
      container.innerHTML = '<div class="sig-ref-item">No signal selected</div>';
      return;
    }

    const refs = signalsManager.getSignalNodeReferences(curSig.name, this.graphState);

    const titleDiv = document.createElement('div');
    titleDiv.className = 'sig-ref-title';
    titleDiv.textContent = `Referenced in ${refs.length} node(s):`;
    container.appendChild(titleDiv);

    if (refs.length === 0) {
      const noneDiv = document.createElement('div');
      noneDiv.className = 'sig-ref-item text-muted';
      noneDiv.textContent = 'Not currently placed in node graph.';
      container.appendChild(noneDiv);
      return;
    }

    refs.forEach(node => {
      const refItem = document.createElement('div');
      refItem.className = 'sig-ref-item sig-ref-clickable';
      const nodeRole = node.blueprintId === 'event_monitor_signal' ? 'Monitor Signal' : 'Send Signal';
      refItem.innerHTML = `
        <span class="sig-ref-role">${nodeRole}</span>
        <span class="sig-ref-id">${node.id}</span>
      `;

      // Jump to node when clicked
      refItem.addEventListener('click', () => {
        container.style.display = 'none';
        this.close();

        // Focus and pan to node on canvas
        if (this.graphState && this.renderer) {
          this.graphState.selectedNodeIds.clear();
          this.graphState.selectedNodeIds.add(node.id);
          
          const viewport = document.getElementById('canvasViewport');
          const vpW = viewport ? viewport.clientWidth : 800;
          const vpH = viewport ? viewport.clientHeight : 600;
          
          this.graphState.panX = (vpW / 2) - node.x * this.graphState.zoom;
          this.graphState.panY = (vpH / 2) - node.y * this.graphState.zoom;
          
          this.renderer.updateTransform();
          this.renderer.render();
        }
      });

      container.appendChild(refItem);
    });
  }

  applyChanges() {
    // Commit draft signals to signalsManager
    signalsManager.deserialize(this.draftSignals);

    // Synchronize all canvas nodes referencing signals
    if (this.graphState) {
      // 1. Clean up stale wires if parameter names changed
      const sigMap = new Map(this.draftSignals.map(s => [s.name, s]));
      
      this.graphState.nodes.forEach(node => {
        if (node.blueprintId === 'event_monitor_signal' || node.blueprintId === 'exec_send_signal') {
          const sigName = node.inputValues?.['Signal Name'] || node.inputValues?.['signalName'];
          const signalDef = sigMap.get(sigName);
          if (signalDef) {
            const validParamNames = new Set(signalDef.params.map(p => p.name));
            // For monitor node, base outputs are preserved
            if (node.blueprintId === 'event_monitor_signal') {
              validParamNames.add('Event Source Entity');
              validParamNames.add('Event Source GUID');
              validParamNames.add('Signal Source Entity');
            }
            // Filter wires connected to removed parameters
            this.graphState.wires = this.graphState.wires.filter(w => {
              if (w.fromNode === node.id && !w.isExec && !validParamNames.has(w.fromPin)) {
                return false;
              }
              if (w.toNode === node.id && !w.isExec && !validParamNames.has(w.toPin)) {
                return false;
              }
              return true;
            });
          }
        }
      });

      this.graphState.saveSnapshot();
      this.graphState.notify('signals_updated');
    }

    if (this.renderer) {
      this.renderer.render();
    }

    this.hasPendingChanges = false;
    this.close();
  }
}
