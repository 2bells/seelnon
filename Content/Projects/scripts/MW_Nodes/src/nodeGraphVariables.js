/**
 * Miliastra Wonderland Node Graph Variables Window
 * Authentic replica of the in-engine "Node Graph Variable" floating undocked sub-menu.
 * 
 * Supports:
 * - Persistent graph-level variables (HP, Attacked, Damage, etc.)
 * - Type selection (Integer, Boolean, Floating-Point, String, Entity, GUID, 3D Vector, etc.)
 * - Type-aware default values (number, bool select, floating placeholder, vector3)
 * - Draggable floating undocked window on canvas
 * - Drag or click to spawn Get/Set Node Graph Variable nodes
 * - Filter & options menu (Sort, export, clear)
 */

import { DATA_TYPES, PIN_COLORS } from './nodesData.js';

let windowZIndexCounter = 300;

export class NodeGraphVariablesWindow {
  constructor(graphState, renderer) {
    this.state = graphState;
    this.renderer = renderer;
    this.isOpen = false;
    this.filterQuery = '';
    this.showFilter = false;

    // Draft row settings for bottom add bar
    this.draftType = 'String';

    this.initDom();
    this.bindEvents();

    // Subscribe to graph variable changes
    this.state.subscribe((event) => {
      if (event === 'node_vars_changed' || event === 'node_var_value_changed' || event === 'scene_reset' || event === 'loaded') {
        if (this.isOpen) {
          this.render();
        }
      }
    });
  }

  initDom() {
    this.card = document.createElement('div');
    this.card.className = 'node-vars-card';
    this.card.id = 'nodeVarsCard';
    this.card.style.display = 'none';
    this.card.style.zIndex = `${++windowZIndexCounter}`;

    // Default position: top-right on canvas as shown in Image 1 & 2
    const defaultLeft = Math.max(380, window.innerWidth - 490);
    this.card.style.left = `${defaultLeft}px`;
    this.card.style.top = '60px';

    this.card.innerHTML = `
      <!-- Header (Draggable) -->
      <div class="node-vars-header" id="nodeVarsHeader">
        <div class="node-vars-title-group">
          <span class="node-vars-title">Node Graph Variable</span>
        </div>
        <div class="node-vars-header-actions">
          <button class="node-vars-btn-icon" id="nodeVarsCloseBtn" title="Close">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Subheader (Count + Options + Filter) -->
      <div class="node-vars-subheader">
        <span class="node-vars-count" id="nodeVarsCount">3 variables</span>
        <div class="node-vars-subactions">
          <div class="node-vars-opts-anchor">
            <button class="node-vars-subbtn" id="nodeVarsOptsBtn" title="Options">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <circle cx="5" cy="12" r="2"/>
                <circle cx="12" cy="12" r="2"/>
                <circle cx="19" cy="12" r="2"/>
              </svg>
            </button>
            <div class="node-vars-popover" id="nodeVarsOptsMenu" style="display: none;">
              <div class="popover-item" id="optSortVars">Sort Variables A-Z</div>
              <div class="popover-item" id="optSpawnGet">Spawn "Get Variable" Node</div>
              <div class="popover-item" id="optSpawnSet">Spawn "Set Variable" Node</div>
              <div class="popover-divider"></div>
              <div class="popover-item" id="optResetDefaultVars">Reset Sample Variables</div>
            </div>
          </div>
          <button class="node-vars-subbtn" id="nodeVarsFilterBtn" title="Filter Variables">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Filter Row (Collapsible) -->
      <div class="node-vars-filter-row" id="nodeVarsFilterRow" style="display: none;">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" class="filter-search-icon">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" class="node-vars-filter-input" id="nodeVarsFilterInput" placeholder="Filter variables..." />
      </div>

      <!-- Variables List -->
      <div class="node-vars-list" id="nodeVarsList"></div>

      <!-- Bottom Add Draft Row -->
      <div class="node-vars-add-row">
        <span class="node-vars-add-index" id="nodeVarsNextIndex">1</span>
        <div class="node-vars-add-type-wrap">
          <select class="node-vars-select" id="nodeVarsDraftType">
            <option value="string">String</option>
            <option value="int">Integer</option>
            <option value="bool">Boolean</option>
            <option value="float">Floating-Point</option>
            <option value="vector3">3D Vector</option>
            <option value="entity">Entity</option>
            <option value="guid">GUID</option>
            <option value="list">List</option>
            <option value="dict">Dictionary</option>
          </select>
          <svg class="select-chevron" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
        <button class="node-vars-add-btn" id="nodeVarsAddBtn">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add New Variables
        </button>
      </div>
    `;

    document.body.appendChild(this.card);
  }

  bindEvents() {
    // Bring window to front on click
    this.card.addEventListener('mousedown', () => {
      this.bringToFront();
    });

    // Draggable header
    const header = this.card.querySelector('#nodeVarsHeader');
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
    this.card.querySelector('#nodeVarsCloseBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });

    // Options dropdown toggle
    const optsBtn = this.card.querySelector('#nodeVarsOptsBtn');
    const optsMenu = this.card.querySelector('#nodeVarsOptsMenu');
    optsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      optsMenu.style.display = optsMenu.style.display === 'none' ? 'block' : 'none';
    });

    document.addEventListener('click', (e) => {
      if (!optsMenu.contains(e.target) && e.target !== optsBtn) {
        optsMenu.style.display = 'none';
      }
    });

    // Options menu actions
    this.card.querySelector('#optSortVars').addEventListener('click', () => {
      optsMenu.style.display = 'none';
      this.state.nodeGraphVariables.sort((a, b) => a.name.localeCompare(b.name));
      this.state.saveSnapshot();
      this.render();
    });

    this.card.querySelector('#optSpawnGet').addEventListener('click', () => {
      optsMenu.style.display = 'none';
      const firstVar = this.state.getNodeGraphVariables()[0];
      const varName = firstVar ? firstVar.name : 'HP';
      this.state.createNode('query_get_node_graph_var', 300, 300, {
        inputValues: { 'Variable Name': varName }
      });
      this.renderer.render();
    });

    this.card.querySelector('#optSpawnSet').addEventListener('click', () => {
      optsMenu.style.display = 'none';
      const firstVar = this.state.getNodeGraphVariables()[0];
      const varName = firstVar ? firstVar.name : 'HP';
      this.state.createNode('exec_set_node_graph_var', 500, 300, {
        inputValues: { 'Variable Name': varName, 'Trigger Event': 'No' }
      });
      this.renderer.render();
    });

    this.card.querySelector('#optResetDefaultVars').addEventListener('click', () => {
      optsMenu.style.display = 'none';
      this.state.nodeGraphVariables = [
        { id: 'var_1', name: 'HP', type: 'int', defaultValue: '0', value: '0' },
        { id: 'var_2', name: 'Attacked', type: 'bool', defaultValue: 'False', value: 'False' },
        { id: 'var_3', name: 'Damage', type: 'float', defaultValue: '0.0', value: '0.0' }
      ];
      this.state.saveSnapshot();
      this.state.notify('node_vars_changed');
      this.render();
    });

    // Filter button toggle
    const filterBtn = this.card.querySelector('#nodeVarsFilterBtn');
    const filterRow = this.card.querySelector('#nodeVarsFilterRow');
    const filterInput = this.card.querySelector('#nodeVarsFilterInput');

    filterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showFilter = !this.showFilter;
      filterRow.style.display = this.showFilter ? 'flex' : 'none';
      if (this.showFilter) {
        filterInput.focus();
      } else {
        this.filterQuery = '';
        filterInput.value = '';
        this.render();
      }
    });

    filterInput.addEventListener('input', (e) => {
      this.filterQuery = e.target.value.toLowerCase().trim();
      this.render();
    });

    // Add New Variables button
    const addBtn = this.card.querySelector('#nodeVarsAddBtn');
    const draftTypeSelect = this.card.querySelector('#nodeVarsDraftType');

    const handleAdd = () => {
      const type = draftTypeSelect.value || 'string';
      const vars = this.state.getNodeGraphVariables();
      const newVar = this.state.addNodeGraphVariable(`Var_${vars.length + 1}`, type);
      this.render();

      // Auto-focus the newly created variable's name input
      setTimeout(() => {
        const input = this.card.querySelector(`[data-var-id="${newVar.id}"] .node-var-name-input`);
        if (input) {
          input.focus();
          input.select();
        }
      }, 50);
    };

    addBtn.addEventListener('click', handleAdd);
  }

  bringToFront() {
    this.card.style.zIndex = `${++windowZIndexCounter}`;
  }

  open() {
    this.isOpen = true;
    this.card.style.display = 'flex';
    this.bringToFront();
    this.render();

    // Update bottom dock button state if present
    const dockBtn = document.getElementById('btnOpenVariables');
    if (dockBtn) dockBtn.classList.add('active');
  }

  close() {
    this.isOpen = false;
    this.card.style.display = 'none';

    // Update bottom dock button state if present
    const dockBtn = document.getElementById('btnOpenVariables');
    if (dockBtn) dockBtn.classList.remove('active');
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  render() {
    const listEl = this.card.querySelector('#nodeVarsList');
    const countEl = this.card.querySelector('#nodeVarsCount');
    const nextIndexEl = this.card.querySelector('#nodeVarsNextIndex');

    const allVars = this.state.getNodeGraphVariables();
    countEl.textContent = `${allVars.length} variable${allVars.length === 1 ? '' : 's'}`;
    nextIndexEl.textContent = `${allVars.length + 1}`;

    listEl.innerHTML = '';

    const filtered = allVars.filter(v => {
      if (!this.filterQuery) return true;
      return v.name.toLowerCase().includes(this.filterQuery) || v.type.toLowerCase().includes(this.filterQuery);
    });

    if (filtered.length === 0) {
      const emptyNotice = document.createElement('div');
      emptyNotice.className = 'node-vars-empty';
      emptyNotice.textContent = allVars.length === 0 
        ? 'No variables defined. Click "+ Add New Variables" below.' 
        : 'No matching variables found.';
      listEl.appendChild(emptyNotice);
      return;
    }

    filtered.forEach((v, idx) => {
      const row = document.createElement('div');
      row.className = 'node-var-row';
      row.dataset.varId = v.id;

      // 1. Pencil edit icon (Grey angled pencil)
      const pencilIcon = document.createElement('span');
      pencilIcon.className = 'node-var-pencil-icon';
      pencilIcon.title = 'Edit Variable';
      pencilIcon.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
        </svg>
      `;

      // 2. Index number (1, 2, 3...)
      const indexNum = document.createElement('span');
      indexNum.className = 'node-var-index';
      indexNum.textContent = `${idx + 1}`;

      // 3. Name Input
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'node-var-name-input';
      nameInput.value = v.name;
      nameInput.placeholder = 'Variable Name';
      nameInput.title = 'Variable Name';
      nameInput.addEventListener('mousedown', (e) => e.stopPropagation());
      nameInput.addEventListener('change', (e) => {
        const val = e.target.value.trim();
        if (val) {
          this.state.updateNodeGraphVariable(v.id, { name: val, forceUnique: true });
        } else {
          e.target.value = v.name;
        }
      });
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.target.blur();
        }
      });

      // 4. Type Dropdown
      const typeWrap = document.createElement('div');
      typeWrap.className = 'node-var-type-wrap';

      const typeSelect = document.createElement('select');
      typeSelect.className = 'node-vars-select';
      typeSelect.addEventListener('mousedown', (e) => e.stopPropagation());

      const typeOptions = [
        { val: 'int', label: 'Integer' },
        { val: 'bool', label: 'Boolean' },
        { val: 'float', label: 'Floating-Point' },
        { val: 'string', label: 'String' },
        { val: 'vector3', label: '3D Vector' },
        { val: 'entity', label: 'Entity' },
        { val: 'guid', label: 'GUID' },
        { val: 'list', label: 'List' },
        { val: 'dict', label: 'Dictionary' }
      ];

      typeOptions.forEach(opt => {
        const optEl = document.createElement('option');
        optEl.value = opt.val;
        optEl.textContent = opt.label;
        if (v.type === opt.val) optEl.selected = true;
        typeSelect.appendChild(optEl);
      });

      typeSelect.addEventListener('change', (e) => {
        const newType = e.target.value;
        let newDef = v.defaultValue;
        if (newType === 'int') newDef = '0';
        else if (newType === 'float') newDef = '0.0';
        else if (newType === 'bool') newDef = 'False';
        else if (newType === 'vector3') newDef = '(0, 0, 0)';
        else if (newType === 'string') newDef = '';

        this.state.updateNodeGraphVariable(v.id, { type: newType, defaultValue: newDef });
        this.render();
      });

      typeWrap.appendChild(typeSelect);
      typeWrap.insertAdjacentHTML('beforeend', `
        <svg class="select-chevron" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      `);

      // 5. Default Value Field (Type-Aware)
      const valWrap = document.createElement('div');
      valWrap.className = 'node-var-val-wrap';

      if (v.type === 'bool') {
        const boolSelect = document.createElement('select');
        boolSelect.className = 'node-vars-select node-var-val-select';
        boolSelect.addEventListener('mousedown', (e) => e.stopPropagation());

        const optEmpty = document.createElement('option');
        optEmpty.value = '';
        optEmpty.textContent = 'Select...';
        boolSelect.appendChild(optEmpty);

        const optFalse = document.createElement('option');
        optFalse.value = 'False';
        optFalse.textContent = 'False';
        if (v.defaultValue === 'False' || v.defaultValue === '0' || v.defaultValue === 'No') optFalse.selected = true;
        boolSelect.appendChild(optFalse);

        const optTrue = document.createElement('option');
        optTrue.value = 'True';
        optTrue.textContent = 'True';
        if (v.defaultValue === 'True' || v.defaultValue === '1' || v.defaultValue === 'Yes') optTrue.selected = true;
        boolSelect.appendChild(optTrue);

        boolSelect.addEventListener('change', (e) => {
          this.state.updateNodeGraphVariable(v.id, { defaultValue: e.target.value, value: e.target.value });
        });

        valWrap.appendChild(boolSelect);
        valWrap.insertAdjacentHTML('beforeend', `
          <svg class="select-chevron" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        `);
      } else if (v.type === 'int') {
        const numInput = document.createElement('input');
        numInput.type = 'number';
        numInput.step = '1';
        numInput.className = 'node-var-val-input';
        numInput.value = v.defaultValue !== undefined ? v.defaultValue : '0';
        numInput.placeholder = '0';
        numInput.addEventListener('mousedown', (e) => e.stopPropagation());
        numInput.addEventListener('change', (e) => {
          this.state.updateNodeGraphVariable(v.id, { defaultValue: e.target.value, value: e.target.value });
        });
        valWrap.appendChild(numInput);
      } else if (v.type === 'float') {
        const floatInput = document.createElement('input');
        floatInput.type = 'text';
        floatInput.className = 'node-var-val-input';
        floatInput.value = v.defaultValue !== undefined && v.defaultValue !== '0.0' ? v.defaultValue : '';
        floatInput.placeholder = 'Input Floating Point Number';
        floatInput.addEventListener('mousedown', (e) => e.stopPropagation());
        floatInput.addEventListener('change', (e) => {
          this.state.updateNodeGraphVariable(v.id, { defaultValue: e.target.value || '0.0', value: e.target.value || '0.0' });
        });
        valWrap.appendChild(floatInput);
      } else if (v.type === 'vector3') {
        const vecInput = document.createElement('input');
        vecInput.type = 'text';
        vecInput.className = 'node-var-val-input';
        vecInput.value = v.defaultValue || '(0, 0, 0)';
        vecInput.placeholder = '(0, 0, 0)';
        vecInput.addEventListener('mousedown', (e) => e.stopPropagation());
        vecInput.addEventListener('change', (e) => {
          this.state.updateNodeGraphVariable(v.id, { defaultValue: e.target.value, value: e.target.value });
        });
        valWrap.appendChild(vecInput);
      } else {
        const strInput = document.createElement('input');
        strInput.type = 'text';
        strInput.className = 'node-var-val-input';
        strInput.value = v.defaultValue || '';
        strInput.placeholder = `Input ${v.type}`;
        strInput.addEventListener('mousedown', (e) => e.stopPropagation());
        strInput.addEventListener('change', (e) => {
          this.state.updateNodeGraphVariable(v.id, { defaultValue: e.target.value, value: e.target.value });
        });
        valWrap.appendChild(strInput);
      }

      // 6. Actions (Get, Set, Delete)
      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'node-var-actions';

      const getBtn = document.createElement('button');
      getBtn.className = 'node-var-action-btn';
      getBtn.title = `Spawn "Get ${v.name}" node on canvas`;
      getBtn.textContent = 'Get';
      getBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.spawnVarNode('query_get_node_graph_var', v.name);
      });

      const setBtn = document.createElement('button');
      setBtn.className = 'node-var-action-btn';
      setBtn.title = `Spawn "Set ${v.name}" node on canvas`;
      setBtn.textContent = 'Set';
      setBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.spawnVarNode('exec_set_node_graph_var', v.name);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'node-var-btn-delete';
      deleteBtn.title = `Delete Variable "${v.name}"`;
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      `;
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.state.removeNodeGraphVariable(v.id);
        this.render();
      });

      actionsWrap.appendChild(getBtn);
      actionsWrap.appendChild(setBtn);
      actionsWrap.appendChild(deleteBtn);

      // Quick-drag to spawn: dragging the row creates a node at drop location!
      row.draggable = true;
      row.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({
          action: 'spawn_graph_var',
          varName: v.name,
          varType: v.type
        }));
      });

      row.appendChild(pencilIcon);
      row.appendChild(indexNum);
      row.appendChild(nameInput);
      row.appendChild(typeWrap);
      row.appendChild(valWrap);
      row.appendChild(actionsWrap);

      listEl.appendChild(row);
    });
  }

  spawnVarNode(blueprintId, varName) {
    const canvasRect = this.renderer.container.getBoundingClientRect();
    const centerScreenX = canvasRect.left + canvasRect.width / 2;
    const centerScreenY = canvasRect.top + canvasRect.height / 2;
    const pos = this.renderer.screenToCanvas(centerScreenX, centerScreenY);
    const offset = (Math.random() - 0.5) * 60;

    const initialValues = { 'Variable Name': varName };
    if (blueprintId === 'exec_set_node_graph_var') {
      initialValues['Trigger Event'] = 'No';
      const v = this.state.getNodeGraphVariableByName(varName);
      if (v && v.type === 'bool') {
        initialValues['Variable Value'] = 'No';
      }
    }

    const node = this.state.createNode(blueprintId, pos.x + offset - 80, pos.y + offset - 40, {
      inputValues: initialValues
    });
    this.state.selectedNodeIds.clear();
    this.state.selectedNodeIds.add(node.id);
    this.renderer.render();
  }
}
