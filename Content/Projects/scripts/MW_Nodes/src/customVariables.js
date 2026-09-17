/**
 * Miliastra Wonderland Custom Variables Window
 * Replicates the authentic Server Signal Explorer layout & styling,
 * featuring a left sidebar for parent entities ('self' + GUID object references),
 * '+ Add Entity' button, right content panel for variables and values,
 * and Apply / Clear Changes workflow.
 */

import { DATA_TYPES } from './nodesData.js';

let windowZIndexCounter = 310;

export class CustomVariablesWindow {
  constructor(graphState, renderer) {
    this.state = graphState;
    this.renderer = renderer;
    this.isOpen = false;

    this.draftCustomVars = [];
    this.selectedParentKey = 'self';
    this.searchQuery = '';
    this.hasPendingChanges = false;

    // Draft for new variable input row
    this.draftVarName = '';
    this.draftVarType = 'float';
    this.draftVarVal = '0.0';

    this.initDom();
    this.bindEvents();

    // Subscribe to graph variable changes
    this.state.subscribe((event) => {
      if (event === 'custom_vars_changed' || event === 'scene_reset' || event === 'loaded' || event === 'undo' || event === 'redo') {
        if (this.isOpen && !this.hasPendingChanges) {
          this.resetDraftFromManager();
          this.render();
        }
      }
    });
  }

  bringToFront() {
    this.card.style.zIndex = `${++windowZIndexCounter}`;
  }

  initDom() {
    this.card = document.createElement('div');
    this.card.className = 'signal-explorer-card custom-vars-card';
    this.card.id = 'customVarsCard';
    this.card.style.display = 'none';
    this.card.style.position = 'fixed';
    this.card.style.left = '60px';
    this.card.style.top = '80px';
    this.card.style.zIndex = `${++windowZIndexCounter}`;

    this.card.innerHTML = `
      <!-- Header (Draggable) -->
      <div class="sig-header" id="customVarsHeader">
        <div class="sig-header-left">
          <span class="sig-header-icon" style="color: #e5c07b;">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 7v10M7 12h10" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="sig-header-title">Custom Variables</span>
        </div>
        <div class="sig-header-actions">
          <button class="sig-btn-icon sig-help-btn" id="customVarsHelpBtn" title="Help & Information">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="4"/>
              <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2 2-2 3"/>
              <circle cx="12" cy="16.5" r="0.75" fill="currentColor"/>
            </svg>
          </button>
          <button class="sig-btn-icon sig-close-btn" id="customVarsCloseBtn" title="Close">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Body Split Container -->
      <div class="sig-body">
        <!-- Left Sidebar: Entities / Parent Objects List -->
        <div class="sig-sidebar" style="width: 230px;">
          <div class="sig-search-row">
            <span class="sig-search-icon">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input type="text" class="sig-search-input" id="customVarsSearchInput" placeholder="Search entities..." autocomplete="off" />
            <button class="sig-search-clear-btn" id="customVarsSearchClearBtn" style="display:none;">✕</button>
          </div>

          <div class="sig-list-container" id="customVarsListContainer"></div>

          <button class="sig-add-signal-btn" id="customVarsAddEntityBtn" title="Add parent object reference via GUID">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Entity
          </button>
        </div>

        <!-- Right Content: Selected Parent & Variables Table -->
        <div class="sig-content">
          <div class="sig-content-header" id="customVarsContentHeader"></div>

          <!-- Variables Scroll Area -->
          <div class="sig-params-scroll">
            <div class="sig-params-list" id="customVarsParamsList"></div>

            <!-- Draft Row for Adding New Variable -->
            <div class="sig-draft-param-row" style="gap: 6px;">
              <span class="sig-param-idx" id="customVarsNextIdx">1</span>
              <input type="text" class="sig-param-input" id="customVarsDraftName" placeholder="Variable Name" style="flex: 1.2;" />
              <div class="sig-type-select-wrap" style="width: 125px; flex-shrink: 0;">
                <select class="sig-param-select" id="customVarsDraftType"></select>
                <span class="sig-select-arrow">▼</span>
              </div>
              <input type="text" class="sig-param-input" id="customVarsDraftVal" placeholder="Value / get" style="width: 85px; flex: 0 0 85px;" />
            </div>

            <button class="sig-add-param-btn" id="customVarsAddParamBtn">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Variable
            </button>
          </div>
        </div>
      </div>

      <!-- Footer Action Bar -->
      <div class="sig-footer">
        <button class="sig-footer-btn sig-btn-clear" id="customVarsClearBtn">Clear Changes</button>
        <button class="sig-footer-btn sig-btn-apply" id="customVarsApplyBtn">Apply Changes</button>
      </div>
    `;

    document.body.appendChild(this.card);

    // Populate type options in draft selector
    const draftTypeSelect = this.card.querySelector('#customVarsDraftType');
    const typeOpts = [
      { val: 'int', label: 'Integer' },
      { val: 'float', label: 'Float' },
      { val: 'bool', label: 'Boolean' },
      { val: 'string', label: 'String' },
      { val: 'vector3', label: 'Vector3' },
      { val: 'list', label: 'List' },
      { val: 'dict', label: 'Dict' },
      { val: 'entity', label: 'Entity' },
      { val: 'guid', label: 'GUID' }
    ];
    typeOpts.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.val;
      opt.textContent = t.label;
      if (t.val === 'float') opt.selected = true;
      draftTypeSelect.appendChild(opt);
    });
  }

  bindEvents() {
    this.card.addEventListener('mousedown', () => this.bringToFront());

    // Draggable header
    const header = this.card.querySelector('#customVarsHeader');
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

    window.addEventListener('mouseup', () => { isDragging = false; });

    // Close & Help
    this.card.querySelector('#customVarsCloseBtn').addEventListener('click', () => this.close());
    this.card.querySelector('#customVarsHelpBtn').addEventListener('click', () => {
      alert("Custom Variables Window:\n\nManage hierarchical custom variables associated with game objects (self or GUID references).\n\n• Left sidebar lists parent entities. Click 'Add Entity' to create a GUID entity.\n• Select a parent to view and edit its custom variables and values on the right.\n• Click 'Get' or 'Set' to spawn corresponding graph nodes.\n• Click 'Apply Changes' to save updates to the graph.");
    });

    // Search input
    const searchInput = this.card.querySelector('#customVarsSearchInput');
    const searchClear = this.card.querySelector('#customVarsSearchClearBtn');
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

    // Add Entity button
    this.card.querySelector('#customVarsAddEntityBtn').addEventListener('click', () => {
      this.addEntity();
    });

    // Add Variable button
    const addParamBtn = this.card.querySelector('#customVarsAddParamBtn');
    const draftNameInp = this.card.querySelector('#customVarsDraftName');
    const draftTypeSel = this.card.querySelector('#customVarsDraftType');
    const draftValInp = this.card.querySelector('#customVarsDraftVal');

    const handleAddVar = () => {
      const parentGroup = this.getSelectedParentGroup();
      if (!parentGroup) return;

      let name = draftNameInp.value.trim().replace(/[^a-zA-Z0-9_]/g, '');
      if (!name) {
        name = `Var_${parentGroup.vars.length + 1}`;
      }
      const type = draftTypeSel.value || 'float';
      let val = draftValInp.value.trim();
      if (!val) {
        if (type === 'int') val = '0';
        else if (type === 'float') val = '0.0';
        else if (type === 'bool') val = 'False';
        else if (type === 'vector3') val = '{0, 0, 0}';
        else if (type === 'list' || type === 'dict') val = '{}';
        else val = '0';
      }

      this.draftCustomVars.push({
        id: `cvar_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        entityType: parentGroup.entityType,
        guid: parentGroup.guid,
        guidAlias: parentGroup.guidAlias,
        name,
        type,
        defaultValue: val,
        isGet: (val === 'get')
      });

      this.hasPendingChanges = true;
      draftNameInp.value = '';
      draftValInp.value = '';
      draftTypeSel.value = 'float';

      this.render();
      draftNameInp.focus();
    };

    addParamBtn.addEventListener('click', handleAddVar);
    draftNameInp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddVar();
      }
    });

    // Clear & Apply buttons
    this.card.querySelector('#customVarsClearBtn').addEventListener('click', () => {
      this.resetDraftFromManager();
      this.hasPendingChanges = false;
      this.render();
    });

    this.card.querySelector('#customVarsApplyBtn').addEventListener('click', () => {
      this.applyChanges();
    });

    window.addEventListener('open_custom_vars', (e) => {
      this.open(e.detail?.varName);
    });
  }

  open(highlightVarName = null) {
    this.isOpen = true;
    this.resetDraftFromManager();
    this.hasPendingChanges = false;
    this.render();
    this.card.style.display = 'flex';
    this.bringToFront();

    const dockBtn = document.getElementById('btnOpenCustomVariables');
    if (dockBtn) dockBtn.classList.add('active');

    if (highlightVarName) {
      setTimeout(() => {
        const inp = this.card.querySelector(`input[value="${highlightVarName}"]`);
        if (inp) {
          inp.focus();
          inp.select();
        }
      }, 50);
    }
  }

  close() {
    this.isOpen = false;
    this.card.style.display = 'none';

    const dockBtn = document.getElementById('btnOpenCustomVariables');
    if (dockBtn) dockBtn.classList.remove('active');
  }

  toggle(highlightVarName = null) {
    if (this.isOpen) {
      this.close();
    } else {
      this.open(highlightVarName);
    }
  }

  resetDraftFromManager() {
    const raw = this.state.getCustomVariables ? this.state.getCustomVariables() : (this.state.customVariables || []);
    this.draftCustomVars = JSON.parse(JSON.stringify(raw));
  }

  getParentGroups() {
    const groups = new Map();
    // Always include 'self'
    groups.set('self', {
      key: 'self',
      entityType: 'self',
      guid: null,
      guidAlias: null,
      vars: []
    });

    for (const v of this.draftCustomVars) {
      if (v.entityType === 'self' || !v.entityType) {
        groups.get('self').vars.push(v);
      } else {
        const alias = v.guidAlias || (v.guid ? `entity_${v.guid}` : 'boss');
        const guid = v.guid || '0000000000';
        const pKey = `guid_${alias.toLowerCase()}_${guid}`;
        if (!groups.has(pKey)) {
          groups.set(pKey, {
            key: pKey,
            entityType: 'guid',
            guid,
            guidAlias: alias,
            vars: []
          });
        }
        groups.get(pKey).vars.push(v);
      }
    }
    return groups;
  }

  getSelectedParentGroup() {
    const groups = this.getParentGroups();
    if (groups.has(this.selectedParentKey)) {
      return groups.get(this.selectedParentKey);
    }
    // Fallback to first group (self)
    const firstKey = groups.keys().next().value;
    this.selectedParentKey = firstKey || 'self';
    return groups.get(this.selectedParentKey);
  }

  addEntity() {
    const groups = this.getParentGroups();
    const existingAliases = new Set();
    for (const g of groups.values()) {
      if (g.guidAlias) existingAliases.add(g.guidAlias.toLowerCase());
    }

    let nextNum = 1;
    let newAlias = 'boss';
    while (existingAliases.has(newAlias.toLowerCase())) {
      newAlias = `entity_${nextNum++}`;
    }

    const newGuid = '10003222';
    const newPKey = `guid_${newAlias.toLowerCase()}_${newGuid}`;

    this.draftCustomVars.push({
      id: `cvar_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      entityType: 'guid',
      guid: newGuid,
      guidAlias: newAlias,
      name: 'HP',
      type: 'int',
      defaultValue: '100',
      isGet: false
    });

    this.selectedParentKey = newPKey;
    this.hasPendingChanges = true;
    this.render();

    setTimeout(() => {
      const aliasInp = this.card.querySelector('#customActiveAliasInput');
      if (aliasInp) {
        aliasInp.focus();
        aliasInp.select();
      }
    }, 50);
  }

  spawnGetCustomVar(cv) {
    const cx = (this.state.panX ? -this.state.panX / this.state.zoom : 0) + 400;
    const cy = (this.state.panY ? -this.state.panY / this.state.zoom : 0) + 260;

    const getNode = this.state.createNode('query_get_custom_var', cx, cy, {
      inputValues: { 'Variable Name': cv.name || 'Damage3' },
      dataType: cv.type || 'float'
    });

    if (getNode) {
      if (cv.entityType === 'guid') {
        const guidVal = cv.guid || '0000000000';
        const guidNode = this.state.createNode('query_query_entity_by_guid', cx - 260, cy + 80, {
          inputValues: { 'GUID': guidVal }
        });
        if (guidNode) {
          if (cv.guidAlias) guidNode.guidAlias = cv.guidAlias;
          this.state.addWire(guidNode.id, 'Entity', getNode.id, 'Target Entity');
        }
      } else {
        const selfNode = this.state.createNode('query_get_self_entity', cx - 200, cy + 80);
        if (selfNode) {
          this.state.addWire(selfNode.id, 'Self Entity', getNode.id, 'Target Entity');
        }
      }
    }

    if (this.renderer) this.renderer.render();
  }

  spawnSetCustomVar(cv) {
    const cx = (this.state.panX ? -this.state.panX / this.state.zoom : 0) + 450;
    const cy = (this.state.panY ? -this.state.panY / this.state.zoom : 0) + 260;

    let defVal = cv.isGet ? '' : (cv.defaultValue !== undefined ? String(cv.defaultValue) : '0');
    if (defVal === 'get') defVal = '';

    const setNode = this.state.createNode('exec_set_custom_var', cx, cy, {
      inputValues: {
        'Variable Name': cv.name || 'DMG_Float',
        'Trigger Event': 'False',
        'Variable Value': defVal
      },
      dataType: cv.type || 'float'
    });

    if (setNode) {
      if (cv.entityType === 'guid') {
        const guidVal = cv.guid || '0000000000';
        const guidNode = this.state.createNode('query_query_entity_by_guid', cx - 260, cy + 120, {
          inputValues: { 'GUID': guidVal }
        });
        if (guidNode) {
          if (cv.guidAlias) guidNode.guidAlias = cv.guidAlias;
          this.state.addWire(guidNode.id, 'Entity', setNode.id, 'Target Entity');
        }
      } else {
        const selfNode = this.state.createNode('query_get_self_entity', cx - 200, cy + 120);
        if (selfNode) {
          this.state.addWire(selfNode.id, 'Self Entity', setNode.id, 'Target Entity');
        }
      }
    }

    if (this.renderer) this.renderer.render();
  }

  applyChanges() {
    this.state.setCustomVariables(this.draftCustomVars);
    this.hasPendingChanges = false;
    this.render();
    if (this.renderer) this.renderer.render();
  }

  render() {
    this.renderSidebar();
    this.renderContent();
  }

  renderSidebar() {
    const listContainer = this.card.querySelector('#customVarsListContainer');
    listContainer.innerHTML = '';

    const groups = this.getParentGroups();

    for (const [pKey, group] of groups.entries()) {
      const isSelf = group.entityType === 'self';
      const labelText = isSelf ? 'self' : `guid.${group.guidAlias || 'object'}`;

      if (this.searchQuery) {
        const match = labelText.toLowerCase().includes(this.searchQuery) ||
          group.vars.some(v => v.name.toLowerCase().includes(this.searchQuery) || (v.type || '').toLowerCase().includes(this.searchQuery));
        if (!match) continue;
      }

      const item = document.createElement('div');
      item.className = 'sig-item';
      if (pKey === this.selectedParentKey) {
        item.classList.add('selected');
      }

      const nameSpan = document.createElement('span');
      nameSpan.className = 'sig-item-name';
      nameSpan.textContent = labelText;
      item.appendChild(nameSpan);

      if (this.hasPendingChanges) {
        const dot = document.createElement('span');
        dot.className = 'sig-item-dot';
        item.appendChild(dot);
      }

      item.addEventListener('click', () => {
        this.selectedParentKey = pKey;
        this.render();
      });

      listContainer.appendChild(item);
    }
  }

  renderContent() {
    const parentGroup = this.getSelectedParentGroup();
    const headerRow = this.card.querySelector('#customVarsContentHeader');
    const paramsList = this.card.querySelector('#customVarsParamsList');
    const nextIdxSpan = this.card.querySelector('#customVarsNextIdx');

    if (!parentGroup) {
      headerRow.innerHTML = '<div class="sig-empty-notice">No parent selected</div>';
      paramsList.innerHTML = '<div class="sig-empty-notice">Select an entity from the left sidebar.</div>';
      nextIdxSpan.textContent = '1';
      return;
    }

    // Render Right Content Header
    headerRow.innerHTML = '';
    const titleRow = document.createElement('div');
    titleRow.className = 'sig-title-row';

    const isSelf = parentGroup.entityType === 'self';

    if (isSelf) {
      titleRow.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-family: monospace; font-size: 14px; font-weight: 600; color: #61afef;">self</span>
          <span class="custom-parent-badge">Default Object</span>
        </div>
        <div style="font-size: 11px; color: #7b889e;">Built-in Entity</div>
      `;
    } else {
      titleRow.innerHTML = `
        <div style="display: flex; align-items: center; gap: 4px; font-family: monospace; font-size: 13px; font-weight: 600; color: #c678dd;">
          <span>guid.</span>
          <input type="text" id="customActiveAliasInput" value="${parentGroup.guidAlias || 'boss'}" style="background: #181d28; border: 1px solid #364154; border-radius: 3px; color: #c678dd; font-family: inherit; font-size: 12px; font-weight: 600; padding: 2px 6px; width: 90px; outline: none;" title="Object Alias" />
          <span style="color: #56b6c2;">=</span>
          <input type="text" id="customActiveGuidInput" value="${parentGroup.guid || '0000000000'}" maxlength="10" style="background: #181d28; border: 1px solid #364154; border-radius: 3px; color: #d19a66; font-family: inherit; font-size: 12px; padding: 2px 6px; width: 110px; outline: none;" title="10-digit GUID" />
        </div>
        <button class="sig-param-del-btn" id="customActiveDeleteParentBtn" title="Delete Entity and its variables" style="position: static; opacity: 1; width: 26px; height: 26px; background: rgba(224, 108, 117, 0.15); color: #e06c75; border-radius: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      `;
    }
    headerRow.appendChild(titleRow);

    // Bind event handlers for active parent inputs if GUID
    if (!isSelf) {
      const aliasInp = headerRow.querySelector('#customActiveAliasInput');
      const guidInp = headerRow.querySelector('#customActiveGuidInput');
      const delParentBtn = headerRow.querySelector('#customActiveDeleteParentBtn');

      aliasInp.addEventListener('change', (e) => {
        const newAlias = e.target.value.trim().replace(/[^a-zA-Z0-9_]/g, '') || 'boss';
        e.target.value = newAlias;
        for (const v of this.draftCustomVars) {
          if (v.entityType === 'guid' && (v.guidAlias === parentGroup.guidAlias || v.guid === parentGroup.guid)) {
            v.guidAlias = newAlias;
          }
        }
        this.hasPendingChanges = true;
        this.selectedParentKey = `guid_${newAlias.toLowerCase()}_${parentGroup.guid}`;
        this.render();
      });

      guidInp.addEventListener('change', (e) => {
        const newGuid = e.target.value.trim() || '0000000000';
        e.target.value = newGuid;
        for (const v of this.draftCustomVars) {
          if (v.entityType === 'guid' && (v.guidAlias === parentGroup.guidAlias || v.guid === parentGroup.guid)) {
            v.guid = newGuid;
          }
        }
        this.hasPendingChanges = true;
        this.selectedParentKey = `guid_${parentGroup.guidAlias.toLowerCase()}_${newGuid}`;
        this.render();
      });

      delParentBtn.addEventListener('click', () => {
        this.draftCustomVars = this.draftCustomVars.filter(v => !(v.entityType === 'guid' && (v.guidAlias === parentGroup.guidAlias || v.guid === parentGroup.guid)));
        this.selectedParentKey = 'self';
        this.hasPendingChanges = true;
        this.render();
      });
    }

    // Render Variables List
    paramsList.innerHTML = '';
    const vars = parentGroup.vars;
    nextIdxSpan.textContent = `${vars.length + 1}`;

    if (vars.length === 0) {
      paramsList.innerHTML = '<div class="sig-empty-notice">No custom variables defined under this entity. Use "Add Variable" below.</div>';
      return;
    }

    vars.forEach((cv, idx) => {
      const row = document.createElement('div');
      row.className = 'sig-param-row';
      row.style.gap = '6px';

      // 1. Index
      const idxSpan = document.createElement('span');
      idxSpan.className = 'sig-param-idx';
      idxSpan.textContent = `${idx + 1}`;
      row.appendChild(idxSpan);

      // 2. Name input
      const nameInp = document.createElement('input');
      nameInp.type = 'text';
      nameInp.className = 'sig-param-input';
      nameInp.value = cv.name;
      nameInp.placeholder = 'Var Name';
      nameInp.style.flex = '1.2';
      nameInp.addEventListener('change', (e) => {
        const val = e.target.value.trim().replace(/[^a-zA-Z0-9_]/g, '');
        if (val) {
          cv.name = val;
          this.hasPendingChanges = true;
        } else {
          e.target.value = cv.name;
        }
      });
      row.appendChild(nameInp);

      // 3. Type select
      const typeWrap = document.createElement('div');
      typeWrap.className = 'sig-type-select-wrap';
      typeWrap.style.width = '115px';
      typeWrap.style.flexShrink = '0';

      const select = document.createElement('select');
      select.className = 'sig-param-select';
      const typeOpts = [
        { val: 'int', label: 'Integer' },
        { val: 'float', label: 'Float' },
        { val: 'bool', label: 'Boolean' },
        { val: 'string', label: 'String' },
        { val: 'vector3', label: 'Vector3' },
        { val: 'list', label: 'List' },
        { val: 'dict', label: 'Dict' },
        { val: 'entity', label: 'Entity' },
        { val: 'guid', label: 'GUID' }
      ];
      typeOpts.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.val;
        opt.textContent = t.label;
        if (cv.type === t.val) opt.selected = true;
        select.appendChild(opt);
      });

      select.addEventListener('change', (e) => {
        cv.type = e.target.value;
        this.hasPendingChanges = true;
      });
      typeWrap.appendChild(select);

      const arrow = document.createElement('span');
      arrow.className = 'sig-select-arrow';
      arrow.textContent = '▼';
      typeWrap.appendChild(arrow);
      row.appendChild(typeWrap);

      // 4. Value input
      const valInp = document.createElement('input');
      valInp.type = 'text';
      valInp.className = 'sig-param-input';
      valInp.value = cv.isGet ? 'get' : (cv.defaultValue !== undefined ? cv.defaultValue : '0');
      valInp.placeholder = 'Value / get';
      valInp.style.width = '85px';
      valInp.style.flex = '0 0 85px';
      valInp.style.fontFamily = 'monospace';
      valInp.style.color = '#d19a66';
      valInp.addEventListener('change', (e) => {
        const raw = e.target.value.trim();
        cv.defaultValue = raw || 'get';
        cv.isGet = (raw === 'get' || raw === '');
        this.hasPendingChanges = true;
      });
      row.appendChild(valInp);

      // 5. Actions: Get, Set, Delete
      const actionsDiv = document.createElement('div');
      actionsDiv.style.display = 'flex';
      actionsDiv.style.alignItems = 'center';
      actionsDiv.style.gap = '3px';
      actionsDiv.style.flexShrink = '0';

      const btnGet = document.createElement('button');
      btnGet.className = 'custom-btn-node-spawn';
      btnGet.title = "Spawn 'Get Custom Variable' node on canvas";
      btnGet.textContent = 'Get';
      btnGet.addEventListener('click', () => this.spawnGetCustomVar(cv));

      const btnSet = document.createElement('button');
      btnSet.className = 'custom-btn-node-spawn btn-spawn-set';
      btnSet.title = "Spawn 'Set Custom Variable' node on canvas";
      btnSet.textContent = 'Set';
      btnSet.addEventListener('click', () => this.spawnSetCustomVar(cv));

      const btnDel = document.createElement('button');
      btnDel.className = 'sig-param-del-btn';
      btnDel.innerHTML = '✕';
      btnDel.title = 'Remove variable';
      btnDel.style.position = 'static';
      btnDel.style.opacity = '1';
      btnDel.addEventListener('click', () => {
        this.draftCustomVars = this.draftCustomVars.filter(item => item.id !== cv.id);
        this.hasPendingChanges = true;
        this.render();
      });

      actionsDiv.appendChild(btnGet);
      actionsDiv.appendChild(btnSet);
      actionsDiv.appendChild(btnDel);
      row.appendChild(actionsDiv);

      paramsList.appendChild(row);
    });
  }
}
