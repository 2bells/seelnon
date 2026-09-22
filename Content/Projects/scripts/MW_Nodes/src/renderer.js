/**
 * Miliastra Wonderland Canvas & Node Renderer
 * High-performance DOM node layout + SVG wire rendering
 */

import { getNodeBlueprint, CATEGORIES, PIN_COLORS, DATA_TYPES } from './nodesData.js';
import { signalsManager, getPinTypeFromSignalType } from './signalsManager.js';
import { wasmEngine } from './wasmEngine.js';

function normalizeBool(val) {
  const s = String(val).trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes' || s === 'on') return 'True';
  if (s === '0' || s === 'false' || s === 'no' || s === 'off') return 'False';
  return s;
}
function optionsAreBooleans(opts) {
  const truthy = new Set(['True', 'true', 'Yes', 'yes', '1', 'On', 'on']);
  const falsy = new Set(['False', 'false', 'No', 'no', '0', 'Off', 'off']);
  return opts.length === 2 && truthy.has(opts[0]) && falsy.has(opts[1]);
}

function parseVec3(rawVal) {
  let vec = { x: 0, y: 0, z: 0 };
  if (typeof rawVal === 'object' && rawVal !== null) {
    vec = { x: rawVal.x !== undefined ? rawVal.x : 0, y: rawVal.y !== undefined ? rawVal.y : 0, z: rawVal.z !== undefined ? rawVal.z : 0 };
  } else if (typeof rawVal === 'string') {
    const s = rawVal.trim();
    if ((s.startsWith('(') && s.endsWith(')')) || (s.startsWith('{') && s.endsWith('}'))) {
      const inner = s.slice(1, -1).trim();
      const xM = /\bx\s*[:=]\s*([^,]+)/i.exec(inner);
      const yM = /\by\s*[:=]\s*([^,]+)/i.exec(inner);
      const zM = /\bz\s*[:=]\s*([^,]+)/i.exec(inner);
      if (xM || yM || zM) {
        vec = {
          x: xM ? xM[1].trim() : 0,
          y: yM ? yM[1].trim() : 0,
          z: zM ? zM[1].trim() : 0
        };
      } else {
        const parts = inner.split(',').map(p => p.trim());
        vec = {
          x: parts[0] !== undefined ? parts[0] : 0,
          y: parts[1] !== undefined ? parts[1] : 0,
          z: parts[2] !== undefined ? parts[2] : 0
        };
      }
    }
  }
  return vec;
}

function formatVec3Str(vec) {
  return `(x = ${vec.x !== undefined ? vec.x : 0}, y = ${vec.y !== undefined ? vec.y : 0}, z = ${vec.z !== undefined ? vec.z : 0})`;
}

export class GraphRenderer {
  constructor(canvasContainer, graphState) {
    this.container = canvasContainer;
    this.state = graphState;

    this.svgLayer = null;
    this.nodesLayer = null;
    this.marqueeEl = null;

    // Interaction state
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.draggedNodes = null;
    this.nodeDragStart = { x: 0, y: 0 };
    this.isBoxSelecting = false;
    this.boxStart = { x: 0, y: 0 };

    // Wire connection dragging
    this.activeDragWire = null;

    // Pin coordinate cache for wire recalculation
    this.pinCoords = new Map();
    this.pinRelCache = new Map();
    this._renderRafPending = false;
    this.nodeElements = new Map();
    this.wireElements = new Map();

    // Active popup / context menu tracking
    this.activePicker = null;
    this.activeContextMenu = null;
    this.closePopups = this.closePopups.bind(this);

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.type-picker-popup, .param-gear, .wire-context-menu')) {
        this.closePopups();
      }
    });

    document.addEventListener('contextmenu', (e) => {
      if (!e.target.closest('input, textarea')) {
        e.preventDefault();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closePopups();
    });

    this.initDOM();
    this.attachEvents();
    this.setState(this.state);

    // Rerender wires on any canvas/container layout change
    if (typeof ResizeObserver !== 'undefined' && this.container) {
      this.resizeObserver = new ResizeObserver(() => {
        this.cachePinPositions();
        this.renderWires();
      });
      this.resizeObserver.observe(this.container);
    }

    window.addEventListener('resize', () => {
      this.cachePinPositions();
      this.renderWires();
    });
  }

  setState(state) {
    if (this._stateUnsub) this._stateUnsub();
    this.state = state;
    this._stateUnsub = state.subscribe((changeType) => {
      if (changeType === 'value_change' || changeType === 'branch_value_change') {
        return;
      }
      this.render();
    });
  }

  initDOM() {
    this.container.innerHTML = '';
    this.container.classList.add('miliastra-canvas');

    // Grid container
    this.gridLayer = document.createElement('div');
    this.gridLayer.className = 'grid-background';
    this.container.appendChild(this.gridLayer);

    // Transform stage
    this.stage = document.createElement('div');
    this.stage.className = 'canvas-stage';
    this.container.appendChild(this.stage);

    // Comments layer (trays rendered behind wires and nodes)
    this.commentsLayer = document.createElement('div');
    this.commentsLayer.className = 'comments-layer';
    this.stage.appendChild(this.commentsLayer);

    // SVG layer for wires
    this.svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgLayer.setAttribute('class', 'wires-svg');
    this.stage.appendChild(this.svgLayer);

    // Temp wire for interactive connection dragging
    this.dragWirePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.dragWirePath.setAttribute('class', 'wire-drag-preview');
    this.dragWirePath.style.display = 'none';
    this.svgLayer.appendChild(this.dragWirePath);

    // DOM Nodes container
    this.nodesLayer = document.createElement('div');
    this.nodesLayer.className = 'nodes-layer';
    this.stage.appendChild(this.nodesLayer);

    // Notes layer (text bubbles above nodes)
    this.notesLayer = document.createElement('div');
    this.notesLayer.className = 'notes-layer';
    this.stage.appendChild(this.notesLayer);

    // Marquee selection element
    this.marqueeEl = document.createElement('div');
    this.marqueeEl.className = 'selection-marquee';
    this.marqueeEl.style.display = 'none';
    this.container.appendChild(this.marqueeEl);

    // Watermarks (bottom right like screenshot)
    this.watermark = document.createElement('div');
    this.watermark.className = 'canvas-watermark';
    this.watermark.textContent = 'Edit Server Node Graph';
    this.container.appendChild(this.watermark);

    this.versionMark = document.createElement('div');
    this.versionMark.className = 'canvas-versionmark';
    this.versionMark.textContent = 'OS 7.0.0.47194594';
    this.container.appendChild(this.versionMark);
  }

  updateTransform() {
    const { panX, panY, zoom } = this.state;
    this.stage.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${zoom})`;
    this.gridLayer.style.backgroundPosition = `${panX}px ${panY}px`;
    this.gridLayer.style.backgroundSize = `${24 * zoom}px ${24 * zoom}, ${120 * zoom}px ${120 * zoom}`;
    if (window.miliastraCompositeManager && window.miliastraCompositeManager.isEditingComposite()) {
      window.miliastraCompositeManager.renderStickingOutPins();
    }
  }

  screenToCanvas(screenX, screenY) {
    const rect = this.container.getBoundingClientRect();
    const x = (screenX - rect.left - this.state.panX) / this.state.zoom;
    const y = (screenY - rect.top - this.state.panY) / this.state.zoom;
    return { x, y };
  }

  freeze() {
    this.isFrozen = true;
  }

  unfreeze(renderImmediately = true) {
    this.isFrozen = false;
    if (renderImmediately) {
      this.render();
    }
  }

  render() {
    if (this.isFrozen) return;
    this.updateTransform();
    this.renderNodes();
    if (window.miliastraComments) {
      window.miliastraComments.render();
    }
    // Synchronously compute exact socket coordinates and render wires
    this.cachePinPositions();
    this.renderWires();

    if (window.miliastraCompositeManager && window.miliastraCompositeManager.isEditingComposite()) {
      window.miliastraCompositeManager.renderStickingOutPins();
    }

    // Secondary pass on next animation frame to guarantee wire endpoints align after browser layout/reflow
    if (!this._renderRafPending) {
      this._renderRafPending = true;
      requestAnimationFrame(() => {
        this._renderRafPending = false;
        if (this.isFrozen) return;
        if (window.miliastraComments) {
          window.miliastraComments.render();
        }
        this.cachePinPositions();
        this.renderWires();
        if (window.miliastraCompositeManager && window.miliastraCompositeManager.isEditingComposite()) {
          window.miliastraCompositeManager.renderStickingOutPins();
        }
      });
    }
  }

  renderNodes() {
    const currentIds = new Set(this.state.nodes.map(n => n.id));

    // Remove old elements
    for (const [id, el] of this.nodeElements.entries()) {
      if (!currentIds.has(id)) {
        el.remove();
        this.nodeElements.delete(id);
      }
    }

    // Render or update each node
    for (const node of this.state.nodes) {
      let nodeEl = this.nodeElements.get(node.id);
      if (!nodeEl) {
        nodeEl = this.createNodeElement(node);
        this.nodeElements.set(node.id, nodeEl);
        this.nodesLayer.appendChild(nodeEl);
      } else {
        this.updateNodeElement(node, nodeEl);
      }

      nodeEl.style.transform = `translate3d(${node.x}px, ${node.y}px, 0)`;
      if (this.state.selectedNodeIds.has(node.id)) {
        nodeEl.classList.add('selected');
      } else {
        nodeEl.classList.remove('selected');
      }

      // Hide node if it is collapsed inside any comment tray
      const isHiddenInCollapsedTray = (this.state.comments || []).some(
        c => c.collapsed && Array.isArray(c.collapsedNodeIds) && c.collapsedNodeIds.includes(node.id)
      );
      if (isHiddenInCollapsedTray) {
        nodeEl.style.display = 'none';
      } else {
        nodeEl.style.display = '';
      }
    }
  }

  createNodeElement(node) {
    if (node.isComposite) {
      const el = document.createElement('div');
      this.populateCompositeNode(node, el);
      return el;
    }

    let bp = getNodeBlueprint(node.blueprintId) || getNodeBlueprint(node.name);
    if (!bp) {
      // Synthesize clean blueprint from node and connected wires so all sockets are in DOM
      const hasExecIn = this.state.wires.some(w => w.toNode === node.id && (w.isExec || w.toPin === 'execIn'));
      const hasExecOut = this.state.wires.some(w => w.fromNode === node.id && (w.isExec || w.fromPin === 'execOut'));
      const inputNames = new Set(Object.keys(node.inputValues || {}));
      this.state.wires.filter(w => w.toNode === node.id && !w.isExec && w.toPin !== 'execIn').forEach(w => inputNames.add(w.toPin));
      const outputNames = new Set();
      this.state.wires.filter(w => w.fromNode === node.id && !w.isExec && w.fromPin !== 'execOut').forEach(w => outputNames.add(w.fromPin));

      bp = {
        id: node.blueprintId || 'custom_node',
        name: node.name || 'Node',
        category: node.category || (hasExecIn || hasExecOut ? 'execution' : 'query'),
        execIn: hasExecIn || (node.category === 'execution'),
        execOut: hasExecOut || (node.category === 'execution'),
        inputs: Array.from(inputNames).map(name => ({ name, type: 'any' })),
        outputs: Array.from(outputNames).map(name => ({ name, type: 'any' }))
      };
    }

    const cat = CATEGORIES[bp.category] || CATEGORIES.execution;
    const el = document.createElement('div');
    el.className = `miliastra-node node-cat-${bp.category}`;
    el.dataset.nodeId = node.id;

    // Header
    const header = document.createElement('div');
    header.className = 'node-header';
    header.style.backgroundColor = cat.headerColor;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'node-icon';
    iconSpan.innerHTML = this.getCategoryIconSVG(cat.iconType);
    header.appendChild(iconSpan);

    const titleSpan = document.createElement('span');
    titleSpan.className = 'node-title';
    titleSpan.textContent = bp.name;
    header.appendChild(titleSpan);

    // Double click header to inspect node
    header.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (window.miliastraNodeInspector) {
        window.miliastraNodeInspector.open(bp.id ? bp : node);
      }
    });

    // If node has a specialized data type or supports variable type configuration, display clickable badge
    const supportsType = this.canNodeConfigureDataType(node, bp);
    if (supportsType) {
      const currentDataType = node.dataType || 'generic';
      const typeBadge = document.createElement('span');
      typeBadge.className = 'node-type-badge';
      const color = PIN_COLORS[currentDataType] || '#50E3C2';
      typeBadge.style.color = color;
      typeBadge.style.backgroundColor = `${color}22`;
      typeBadge.style.borderColor = `${color}55`;
      const dtObj = DATA_TYPES.find(d => d.id === currentDataType);
      typeBadge.textContent = dtObj ? dtObj.label : currentDataType;
      typeBadge.title = `Variable / Data Type: ${dtObj ? dtObj.label : currentDataType} (Click to change)`;
      typeBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openNodeTypePicker(typeBadge, node);
      });
      header.appendChild(typeBadge);
    }

    el.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'node-body';

    // Specialized Multiple Branches Layout (Images 3, 4, 5)
    if (bp.canAddDynamicBranches) {
      el.classList.add('node-multiple-branches');

      const execRow = document.createElement('div');
      execRow.className = 'node-exec-row';
      this.populateExecRow(node, bp, execRow);
      body.appendChild(execRow);

      const mbContainer = document.createElement('div');
      mbContainer.className = 'multiple-branches-container';
      this.populateMultipleBranches(node, bp, mbContainer);
      body.appendChild(mbContainer);

      el.appendChild(body);
      return el;
    }

    // 1. Exec flow pins row (if applicable)
    if (bp.execIn || bp.execOut) {
      const execRow = document.createElement('div');
      execRow.className = 'node-exec-row';
      this.populateExecRow(node, bp, execRow);
      body.appendChild(execRow);
    }

    // 1.5. Signal selector for signal nodes (Monitor Signal & Send Signal)
    const isSigNode = bp.id === 'event_monitor_signal' || bp.id === 'exec_send_signal' || bp.isSignalNode;
    if (isSigNode) {
      const sigContainer = document.createElement('div');
      sigContainer.className = 'node-signal-selector';
      this.populateSignalSelector(node, bp, sigContainer);
      body.appendChild(sigContainer);
    }

    // 1.6. List name selector for Assembly List nodes
    if (bp.id === 'op_assembly_list' || (bp.name || '').toLowerCase() === 'assembly list') {
      const listNameRow = document.createElement('div');
      listNameRow.className = 'node-list-name-row';
      listNameRow.style.display = 'flex';
      listNameRow.style.alignItems = 'center';
      listNameRow.style.padding = '4px 10px';
      listNameRow.style.background = 'rgba(255, 255, 255, 0.03)';
      listNameRow.style.borderBottom = '1px solid rgba(255, 255, 255, 0.08)';
      listNameRow.style.gap = '6px';
      listNameRow.style.fontSize = '12px';
      listNameRow.style.color = '#8ea1b4';

      const label = document.createElement('span');
      label.textContent = 'list.';
      label.style.fontFamily = 'monospace';
      label.style.fontWeight = 'bold';
      label.style.color = '#50E3C2';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'param-input list-name-input';
      input.value = node.listName || 'name_a';
      input.style.flex = '1';
      input.style.height = '22px';
      input.style.fontSize = '11px';
      input.style.padding = '0 6px';
      input.style.background = '#151921';
      input.style.border = '1px solid rgba(255, 255, 255, 0.15)';
      input.style.borderRadius = '3px';
      input.style.color = '#e0e6ed';
      input.style.fontFamily = 'monospace';

      input.addEventListener('change', (e) => {
        const val = e.target.value.trim().replace(/[^a-zA-Z0-9_]/g, '') || 'name_a';
        node.listName = val;
        input.value = val;
        this.state.saveSnapshot();
        this.state.notify('node_modified');
      });
      input.addEventListener('keydown', (e) => e.stopPropagation());
      input.addEventListener('pointerdown', (e) => e.stopPropagation());

      listNameRow.appendChild(label);
      listNameRow.appendChild(input);
      body.appendChild(listNameRow);
    }

    // 2. Data parameters content (Inputs & Outputs)
    const content = document.createElement('div');
    content.className = 'node-content';

    // Left column: Inputs
    const inputsCol = document.createElement('div');
    inputsCol.className = 'pins-col pins-in';

    // Right column: Outputs
    const outputsCol = document.createElement('div');
    outputsCol.className = 'pins-col pins-out';

    body.appendChild(content);
    content.appendChild(inputsCol);
    content.appendChild(outputsCol);
    el.appendChild(body);

    this.populateNodePins(node, bp, inputsCol, outputsCol);

    return el;
  }

  getExecArrowSVG(color, isConnected) {
    // Miliastra Wonderland code flow arrow: flat vertical back, horizontal top/bottom, pointed right
    const pathD = 'M 2,1.5 L 9.5,1.5 L 15,7 L 9.5,12.5 L 2,12.5 Z';
    const fill = isConnected ? color : 'rgba(26, 30, 40, 0.95)';
    const stroke = color;
    const strokeWidth = isConnected ? '1.2' : '1.8';

    return `
      <svg viewBox="0 0 16 14" width="16" height="14" class="miliastra-exec-arrow">
        <path d="${pathD}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />
      </svg>
    `;
  }

  populateExecRow(node, bp, execRow) {
    execRow.innerHTML = '';

    // In exec pin(s)
    const execIns = bp.execInputs || (bp.execIn ? ['execIn'] : []);
    if (execIns.length > 1) {
      const inGroup = document.createElement('div');
      inGroup.className = 'exec-in-group';

      for (const item of execIns) {
        const pinName = typeof item === 'string' ? item : (item && item.name ? item.name : 'execIn');
        const isMain = pinName === 'execIn';
        const displayName = isMain ? '' : pinName;

        const row = document.createElement('div');
        row.className = 'branch-item-row';
        row.style.justifyContent = 'flex-start';

        const inPin = document.createElement('div');
        inPin.className = 'pin-exec pin-exec-in';
        inPin.dataset.nodeId = node.id;
        inPin.dataset.pinName = pinName;
        inPin.dataset.isExec = 'true';
        inPin.dataset.isOutput = 'false';
        inPin.title = isMain ? 'Execution In' : pinName;

        const isConnected = this.state.wires.some(w => w.toNode === node.id && w.toPin === pinName);
        inPin.innerHTML = this.getExecArrowSVG('#FFFFFF', isConnected);

        if (displayName) {
          const label = document.createElement('span');
          label.className = 'exec-label';
          label.style.color = '#FFFFFF';
          label.style.fontWeight = '600';
          label.textContent = displayName;
          row.appendChild(inPin);
          row.appendChild(label);
        } else {
          row.appendChild(inPin);
        }
        inGroup.appendChild(row);
      }

      execRow.appendChild(inGroup);
    } else if (bp.execIn) {
      const inPin = document.createElement('div');
      inPin.className = 'pin-exec pin-exec-in';
      inPin.dataset.nodeId = node.id;
      inPin.dataset.pinName = 'execIn';
      inPin.dataset.isExec = 'true';
      inPin.dataset.isOutput = 'false';
      inPin.title = 'Execution In';

      const isConnected = this.state.wires.some(w => w.toNode === node.id && w.toPin === 'execIn');
      inPin.innerHTML = this.getExecArrowSVG('#FFFFFF', isConnected);
      execRow.appendChild(inPin);
    } else {
      execRow.appendChild(document.createElement('div'));
    }

    // Multiple branches has its exec outputs rendered directly in its dedicated layout
    if (bp.canAddDynamicBranches) {
      return;
    }

    // Out exec pin(s)
    if (bp.execOut) {
      if (Array.isArray(bp.execOut)) {
        // Multiple outputs like Double Branch (Yes / No)
        const outGroup = document.createElement('div');
        outGroup.className = 'exec-out-group';

        for (const item of bp.execOut) {
          const pinName = typeof item === 'string' ? item : (item && item.name ? item.name : 'Branch');
          const isYes = pinName === 'Yes';
          const isNo = pinName === 'No';
          const color = isYes ? '#4CD964' : (isNo ? '#E05353' : '#FFFFFF');

          const branchRow = document.createElement('div');
          branchRow.className = 'branch-item-row';

          const pinClassSuffix = String(pinName || '').toLowerCase().replace(/\s+/g, '-');
          const outPin = document.createElement('div');
          outPin.className = `pin-exec pin-exec-out exec-${pinClassSuffix}`;
          outPin.dataset.nodeId = node.id;
          outPin.dataset.pinName = pinName;
          outPin.dataset.isExec = 'true';
          outPin.dataset.isOutput = 'true';

          const isConnected = this.state.wires.some(w => w.fromNode === node.id && w.fromPin === pinName);

          outPin.innerHTML = `
            <span class="exec-label" style="color:${color}; font-weight: 600;">${pinName}</span>
            ${this.getExecArrowSVG(color, isConnected)}
          `;
          branchRow.appendChild(outPin);
          outGroup.appendChild(branchRow);
        }

        execRow.appendChild(outGroup);
      } else {
        const outPin = document.createElement('div');
        outPin.className = 'pin-exec pin-exec-out';
        outPin.dataset.nodeId = node.id;
        outPin.dataset.pinName = 'execOut';
        outPin.dataset.isExec = 'true';
        outPin.dataset.isOutput = 'true';
        outPin.title = 'Execution Out';

        const isConnected = this.state.wires.some(w => w.fromNode === node.id && w.fromPin === 'execOut');
        outPin.innerHTML = this.getExecArrowSVG('#FFFFFF', isConnected);
        execRow.appendChild(outPin);
      }
    }
  }

  populateMultipleBranches(node, bp, mbContainer) {
    mbContainer.innerHTML = '';
    const ctrlType = this.state.getPinType(node.id, 'Control Expression', 'generic');
    const ctrlColor = PIN_COLORS[ctrlType] || PIN_COLORS.generic;
    const typeObj = DATA_TYPES.find(t => t.id === ctrlType);
    const typeLabel = typeObj ? typeObj.label : 'Integer';
    const placeholderText = ctrlType === 'generic' ? 'Input Integer' : `Input ${typeLabel}`;

    // 1. Control Expression Header: (•) Control Expression [⚙]
    const headerRow = document.createElement('div');
    headerRow.className = 'ctrl-expr-header-row';

    const socket = document.createElement('div');
    socket.className = 'socket socket-in';
    socket.dataset.nodeId = node.id;
    socket.dataset.pinName = 'Control Expression';
    socket.dataset.pinType = ctrlType;
    socket.dataset.isOutput = 'false';
    socket.dataset.isExec = 'false';

    const incomingBadge = this.state.getPinBadge(node.id, 'Control Expression');
    if (incomingBadge) {
      socket.classList.add('connected');
      socket.style.backgroundColor = ctrlColor;
      socket.style.borderColor = ctrlColor;
    } else {
      socket.style.borderColor = ctrlColor;
      socket.style.backgroundColor = '#1a1e27';
    }
    headerRow.appendChild(socket);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'param-name';
    nameSpan.textContent = 'Control Expression';
    headerRow.appendChild(nameSpan);

    const gear = document.createElement('span');
    gear.className = 'param-gear';
    gear.innerHTML = this.getGearIconSVG();
    gear.title = `Configure data type for Control Expression (Current: ${typeLabel})`;
    gear.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openDataTypePicker(node, 'Control Expression', true, gear, e);
    });
    headerRow.appendChild(gear);
    mbContainer.appendChild(headerRow);

    // 2. Control Expression Value Row
    const inputRow = document.createElement('div');
    inputRow.className = 'ctrl-expr-input-row';
    if (incomingBadge) {
      const badgeSpan = document.createElement('div');
      badgeSpan.className = 'param-badge-pill';
      badgeSpan.textContent = incomingBadge;
      inputRow.appendChild(badgeSpan);
    } else {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'param-input';
      input.value = (node.inputValues && node.inputValues['Control Expression'] !== undefined) ? node.inputValues['Control Expression'] : '0';
      input.placeholder = placeholderText;
      input.addEventListener('mousedown', (e) => e.stopPropagation());
      input.addEventListener('click', (e) => e.stopPropagation());
      input.addEventListener('input', (e) => {
        this.state.setInputValue(node.id, 'Control Expression', e.target.value, false);
      });
      input.addEventListener('blur', () => {
        this.state.setInputValue(node.id, 'Control Expression', input.value, true);
      });
      inputRow.appendChild(input);
    }
    mbContainer.appendChild(inputRow);

    // 3. Section Title: Judge Parameter
    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'judge-param-title';
    sectionTitle.textContent = 'Judge Parameter';
    mbContainer.appendChild(sectionTitle);

    // 4. Default Branch Row: Default [>]
    const defaultRow = document.createElement('div');
    defaultRow.className = 'branch-default-row';

    const defaultLabel = document.createElement('span');
    defaultLabel.className = 'branch-default-label';
    defaultLabel.textContent = 'Default';
    defaultRow.appendChild(defaultLabel);

    const defaultPin = document.createElement('div');
    defaultPin.className = 'pin-exec pin-exec-out exec-default';
    defaultPin.dataset.nodeId = node.id;
    defaultPin.dataset.pinName = 'Default';
    defaultPin.dataset.isExec = 'true';
    defaultPin.dataset.isOutput = 'true';
    defaultPin.title = 'Default Branch';
    const isDefaultConnected = this.state.wires.some(w => w.fromNode === node.id && w.fromPin === 'Default');
    defaultPin.innerHTML = this.getExecArrowSVG('#A0AEC0', isDefaultConnected);
    defaultRow.appendChild(defaultPin);

    mbContainer.appendChild(defaultRow);

    // 5. Dynamic Branch Rows (Branch 0, Branch 1, Branch 2...)
    const branches = (node.dynamicBranches || ['Branch 0', 'Branch 1', 'Branch 2', 'Default']).filter(b => b !== 'Default');
    node.branchValues = node.branchValues || {};

    branches.forEach((bName, idx) => {
      const bRow = document.createElement('div');
      bRow.className = 'branch-interactive-row';

      const inputGroup = document.createElement('div');
      inputGroup.className = 'branch-input-group';

      // Remove button
      const delBtn = document.createElement('button');
      delBtn.className = 'param-remove-btn';
      delBtn.innerHTML = '✕';
      delBtn.title = `Remove ${bName}`;
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.state.removeDynamicBranch(node.id, bName);
        this.render();
      });
      inputGroup.appendChild(delBtn);

      const bInput = document.createElement('input');
      bInput.type = 'text';
      bInput.className = 'param-input branch-input';
      bInput.value = node.branchValues[bName] !== undefined ? node.branchValues[bName] : `${idx}`;
      bInput.placeholder = placeholderText;
      bInput.addEventListener('mousedown', (e) => e.stopPropagation());
      bInput.addEventListener('click', (e) => e.stopPropagation());
      bInput.addEventListener('input', (e) => {
        this.state.setBranchValue(node.id, bName, e.target.value, false);
      });
      bInput.addEventListener('blur', () => {
        this.state.setBranchValue(node.id, bName, bInput.value, true);
      });
      inputGroup.appendChild(bInput);
      bRow.appendChild(inputGroup);

      // Exec Out Pin
      const bPin = document.createElement('div');
      bPin.className = 'pin-exec pin-exec-out';
      bPin.dataset.nodeId = node.id;
      bPin.dataset.pinName = bName;
      bPin.dataset.isExec = 'true';
      bPin.dataset.isOutput = 'true';
      bPin.title = bName;
      const isBranchConnected = this.state.wires.some(w => w.fromNode === node.id && w.fromPin === bName);
      bPin.innerHTML = this.getExecArrowSVG('#FFFFFF', isBranchConnected);
      bRow.appendChild(bPin);

      mbContainer.appendChild(bRow);
    });

    // 6. Add Branch row
    const addRow = document.createElement('div');
    addRow.className = 'branch-add-row';

    const addBtn = document.createElement('button');
    addBtn.className = 'branch-add-plus-btn';
    addBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add Branch
    `;
    addBtn.title = 'Add execution branch';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.state.addDynamicBranch(node.id);
      this.render();
    });
    addRow.appendChild(addBtn);
    mbContainer.appendChild(addRow);
  }

  canNodeConfigureDataType(node, bp) {
    if (!bp) return false;
    if (bp.canAddDynamicInputs) return true;
    if (node.dataType) return true;
    const isLoopOp = bp.id === 'exec_list_iteration_loop' || bp.id.includes('list_iteration_loop');
    const isListOp = bp.id === 'exec_list_sorting' || bp.id === 'exec_concatenate_list';
    if (isLoopOp || isListOp) return true;
    if (bp.id === 'query_get_local_variable' || bp.id === 'exec_set_local_var') return true;
    if (bp.id === 'query_get_custom_var' || bp.id === 'exec_set_custom_var') return true;
    if (bp.id === 'op_data_type_conversion') return true;
    if (bp.inputs && bp.inputs.some(i => i.hasGear || i.type === 'generic')) return true;
    if (bp.outputs && bp.outputs.some(o => o.hasGear || o.type === 'generic')) return true;
    return false;
  }

  updateNodeElement(node, el) {
    if (node.isComposite) {
      const titleEl = el.querySelector('.node-title');
      if (titleEl && titleEl.textContent !== (node.name || 'Composite Node')) {
        titleEl.textContent = node.name || 'Composite Node';
      }
      const pinsHash = (node.compositePins || []).map(p => `${p.id}:${p.name}:${p.type}:${p.direction}`).join('|');
      if (el.dataset.pinsHash !== pinsHash) {
        el.dataset.pinsHash = pinsHash;
        el.innerHTML = '';
        this.populateCompositeNode(node, el);
      }
      return;
    }

    const bp = getNodeBlueprint(node.blueprintId) || getNodeBlueprint(node.name);
    if (!bp) return;

    if (bp.canAddDynamicBranches) {
      const execRow = el.querySelector('.node-exec-row');
      if (execRow) {
        this.populateExecRow(node, bp, execRow);
      }
      const mbContainer = el.querySelector('.multiple-branches-container');
      if (mbContainer) {
        this.populateMultipleBranches(node, bp, mbContainer);
      }
      return;
    }

    const execRow = el.querySelector('.node-exec-row');
    if (execRow) {
      this.populateExecRow(node, bp, execRow);
    }

    const isSigNode = bp.id === 'event_monitor_signal' || bp.id === 'exec_send_signal' || bp.isSignalNode;
    if (isSigNode) {
      const sigContainer = el.querySelector('.node-signal-selector');
      if (sigContainer) {
        this.populateSignalSelector(node, bp, sigContainer);
      }
    }

    const isListNode = bp.id === 'op_assembly_list' || (bp.name || '').toLowerCase() === 'assembly list';
    if (isListNode) {
      const listNameInput = el.querySelector('.list-name-input');
      if (listNameInput && listNameInput !== document.activeElement) {
        listNameInput.value = node.listName || 'name_a';
      }
    }

    const header = el.querySelector('.node-header');
    if (header) {
      const supportsType = this.canNodeConfigureDataType(node, bp);
      let typeBadge = header.querySelector('.node-type-badge:not(.composite-edit-btn)');
      if (supportsType) {
        const currentDataType = node.dataType || 'generic';
        const dtObj = DATA_TYPES.find(d => d.id === currentDataType);
        const labelText = dtObj ? dtObj.label : currentDataType;
        const color = PIN_COLORS[currentDataType] || '#50E3C2';
        if (!typeBadge) {
          typeBadge = document.createElement('span');
          typeBadge.className = 'node-type-badge';
          typeBadge.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openNodeTypePicker(typeBadge, node);
          });
          header.appendChild(typeBadge);
        }
        typeBadge.style.color = color;
        typeBadge.style.backgroundColor = `${color}22`;
        typeBadge.style.borderColor = `${color}55`;
        typeBadge.textContent = labelText;
        typeBadge.title = `Variable / Data Type: ${labelText} (Click to change)`;
      } else if (typeBadge) {
        typeBadge.remove();
      }
    }

    const inputsCol = el.querySelector('.pins-in');
    const outputsCol = el.querySelector('.pins-out');
    if (inputsCol && outputsCol) {
      // If user is currently typing in an input inside this node, preserve focus and do not destroy DOM!
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      const isTyping = (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || document.activeElement?.isContentEditable);
      if (el.contains(document.activeElement) && isTyping) {
        return;
      }

      // Check if pin structure or wire connections to this node changed
      const connectedWires = this.state.wires
        .filter(w => w.toNode === node.id || w.fromNode === node.id)
        .map(w => `${w.fromNode}:${w.fromPin}->${w.toNode}:${w.toPin}`)
        .sort().join('|');
      const typesSig = JSON.stringify(node.pinTypes || {});
      const dynamicSig = bp.canAddDynamicInputs ? (node.dynamicInputs || []).join(',') : '';
      const isSigNodeCheck = bp.id === 'event_monitor_signal' || bp.id === 'exec_send_signal' || bp.isSignalNode;
      const sigName = isSigNodeCheck ? (node.inputValues?.['Signal Name'] || node.signalName || '') : '';
      const listNameSig = isListNode ? (node.listName || '') : '';
      const dataTypeSig = node.dataType || '';
      const pinsSig = `${connectedWires}#${typesSig}#${dynamicSig}#${sigName}#${listNameSig}#${dataTypeSig}`;

      if (el.dataset.pinsSig !== pinsSig) {
        el.dataset.pinsSig = pinsSig;
        inputsCol.innerHTML = '';
        outputsCol.innerHTML = '';
        this.populateNodePins(node, bp, inputsCol, outputsCol);
      } else {
        this.syncNodeInputValuesToDom(node, el);
      }
    }
  }

  syncNodeInputValuesToDom(node, el) {
    if (!node || !el) return;
    const rows = el.querySelectorAll('.param-in-row, .param-row, .pin-row, .pins-in > div');
    for (const row of rows) {
      const socket = row.querySelector('.socket.socket-in') || row.querySelector('.socket');
      const pinName = socket?.dataset?.pinName || row.dataset?.pinName;
      if (!pinName || !node.inputValues || node.inputValues[pinName] === undefined) continue;
      const rawVal = node.inputValues[pinName];

      const vecContainer = row.querySelector('.vector3-input-container');
      if (vecContainer) {
        const currentVec = parseVec3(rawVal);
        const axisInputs = vecContainer.querySelectorAll('.vector-axis-input');
        axisInputs.forEach((inp, idx) => {
          if (inp === document.activeElement) return;
          const axis = idx === 0 ? 'x' : (idx === 1 ? 'y' : 'z');
          const v = currentVec[axis] !== undefined ? String(currentVec[axis]) : '0';
          if (inp.value !== v) inp.value = v;
        });
        continue;
      }

      const inp = row.querySelector('.param-input, .param-select, input, select');
      if (!inp || inp === document.activeElement) continue;

      if (inp.tagName === 'SELECT') {
        const s = String(rawVal).trim().toLowerCase();
        const isBoolVal = s === 'true' || s === 'false' || s === '1' || s === '0' || s === 'yes' || s === 'no' || s === 'on' || s === 'off';
        let matched = false;
        for (let optIdx = 0; optIdx < inp.options.length; optIdx++) {
          const opt = inp.options[optIdx];
          if (opt.value === String(rawVal) || opt.textContent.trim() === String(rawVal)) {
            if (inp.selectedIndex !== optIdx) inp.selectedIndex = optIdx;
            matched = true;
            break;
          }
        }
        if (!matched && isBoolVal) {
          const isT = s === '1' || s === 'true' || s === 'yes' || s === 'on';
          for (let optIdx = 0; optIdx < inp.options.length; optIdx++) {
            const optVal = inp.options[optIdx].value;
            const optText = inp.options[optIdx].textContent.trim();
            const optS = optVal.toLowerCase();
            const optTS = optText.toLowerCase();
            if (isT && (optVal === '1' || optVal === 'True' || optVal === 'Yes' || optS === 'true' || optS === 'yes' || optS === 'on' || optTS.startsWith('true') || optTS.startsWith('yes'))) {
              if (inp.selectedIndex !== optIdx) inp.selectedIndex = optIdx;
              matched = true;
              break;
            }
            if (!isT && (optVal === '0' || optVal === 'False' || optVal === 'No' || optS === 'false' || optS === 'no' || optS === 'off' || optTS.startsWith('false') || optTS.startsWith('no'))) {
              if (inp.selectedIndex !== optIdx) inp.selectedIndex = optIdx;
              matched = true;
              break;
            }
          }
        }
      } else {
        const strVal = String(rawVal ?? '');
        if (inp.value !== strVal) {
          inp.value = strVal;
        }
      }
    }
  }

  populateCompositeNode(node, el) {
    el.className = 'miliastra-node node-cat-composite';
    el.dataset.nodeId = node.id;
    const pinsHash = (node.compositePins || []).map(p => `${p.id}:${p.name}:${p.type}:${p.direction}`).join('|');
    el.dataset.pinsHash = pinsHash;

    // Direct double-click on composite node element opens it immediately
    el.addEventListener('dblclick', (e) => {
      if (e.target.closest('input, select, .param-gear, .param-remove-btn')) return;
      e.preventDefault();
      e.stopPropagation();
      const pinEl = e.target.closest('.socket, .pin-exec, .pin-row');
      const pinName = pinEl ? pinEl.dataset.pinName : null;
      if (window.miliastraCompositeManager) {
        window.miliastraCompositeManager.enterCompositeNode(node, pinName);
      }
    });

    // Header
    const header = document.createElement('div');
    header.className = 'node-header';
    header.style.backgroundColor = '#B8B8D0';
    header.style.color = '#1A1D24';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'node-icon';
    iconSpan.innerHTML = this.getCategoryIconSVG('composite-tri');
    header.appendChild(iconSpan);

    const titleSpan = document.createElement('span');
    titleSpan.className = 'node-title';
    titleSpan.textContent = node.name || 'Composite Node';
    titleSpan.style.color = '#1A1D24';
    titleSpan.style.textShadow = 'none';
    header.appendChild(titleSpan);

    // Edit Subgraph button
    const editSubBtn = document.createElement('button');
    editSubBtn.className = 'node-type-badge composite-edit-btn';
    editSubBtn.style.color = '#1A1D24';
    editSubBtn.style.borderColor = 'rgba(26, 29, 36, 0.4)';
    editSubBtn.style.backgroundColor = 'rgba(26, 29, 36, 0.15)';
    editSubBtn.style.cursor = 'pointer';
    editSubBtn.style.fontWeight = '700';
    editSubBtn.style.display = 'inline-flex';
    editSubBtn.style.alignItems = 'center';
    editSubBtn.style.gap = '3px';
    editSubBtn.textContent = 'Edit ⮞';
    editSubBtn.title = 'Edit Composite Node (Double-click)';
    editSubBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
    editSubBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.miliastraCompositeManager) {
        window.miliastraCompositeManager.enterCompositeNode(node);
      }
    });
    header.appendChild(editSubBtn);
    el.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'node-body';

    const pins = node.compositePins || [];
    const execIns = pins.filter(p => p.direction === 'input' && p.kind === 'exec');
    const execOuts = pins.filter(p => p.direction === 'output' && p.kind === 'exec');

    if (execIns.length > 0 || execOuts.length > 0) {
      const execRow = document.createElement('div');
      execRow.className = 'node-exec-row';

      const inGroup = document.createElement('div');
      inGroup.className = 'exec-in-group';
      execIns.forEach(p => {
        const pinEl = document.createElement('div');
        pinEl.className = 'pin-exec pin-exec-in';
        pinEl.dataset.nodeId = node.id;
        pinEl.dataset.pinName = p.name;
        pinEl.dataset.isExec = 'true';
        pinEl.dataset.isOutput = 'false';
        pinEl.title = `Execute Flow In (${p.name})`;
        const isConn = this.state.wires.some(w => w.toNode === node.id && w.toPin === p.name);
        pinEl.innerHTML = this.getExecArrowSVG('#FFFFFF', isConn);
        inGroup.appendChild(pinEl);
      });
      execRow.appendChild(inGroup);

      const outGroup = document.createElement('div');
      outGroup.className = 'exec-out-group';
      execOuts.forEach(p => {
        const wrapper = document.createElement('div');
        wrapper.className = 'exec-out-wrapper';
        if (p.name && p.name !== 'execOut') {
          const lbl = document.createElement('span');
          lbl.className = 'exec-out-label';
          lbl.textContent = p.name;
          wrapper.appendChild(lbl);
        }
        const pinEl = document.createElement('div');
        pinEl.className = 'pin-exec pin-exec-out';
        pinEl.dataset.nodeId = node.id;
        pinEl.dataset.pinName = p.name;
        pinEl.dataset.isExec = 'true';
        pinEl.dataset.isOutput = 'true';
        pinEl.title = `Execute Flow Out (${p.name})`;
        const isConn = this.state.wires.some(w => w.fromNode === node.id && w.fromPin === p.name);
        pinEl.innerHTML = this.getExecArrowSVG('#FFFFFF', isConn);
        wrapper.appendChild(pinEl);
        outGroup.appendChild(wrapper);
      });
      execRow.appendChild(outGroup);
      body.appendChild(execRow);
    }

    const dataIns = pins.filter(p => p.direction === 'input' && p.kind !== 'exec');
    const dataOuts = pins.filter(p => p.direction === 'output' && p.kind !== 'exec');

    if (dataIns.length > 0 || dataOuts.length > 0) {
      const content = document.createElement('div');
      content.className = 'node-content';

      const inputsCol = document.createElement('div');
      inputsCol.className = 'pins-col pins-in';

      dataIns.forEach(p => {
        const row = document.createElement('div');
        row.className = 'param-row param-in-row';

        const pType = p.type || 'generic';
        const color = PIN_COLORS[pType] || PIN_COLORS.generic;

        const leftGroup = document.createElement('div');
        leftGroup.className = 'param-left';

        const socket = document.createElement('div');
        socket.className = 'socket socket-in';
        socket.dataset.nodeId = node.id;
        socket.dataset.pinName = p.name;
        socket.dataset.pinType = pType;
        socket.dataset.isOutput = 'false';
        socket.dataset.isExec = 'false';

        const isConn = this.state.wires.some(w => w.toNode === node.id && w.toPin === p.name);
        if (isConn) {
          socket.classList.add('connected');
          socket.style.backgroundColor = color;
          socket.style.borderColor = color;
        } else {
          socket.style.borderColor = color;
          socket.style.backgroundColor = '#1a1e27';
        }

        const nameLabel = document.createElement('span');
        nameLabel.className = 'param-name';
        nameLabel.textContent = p.name;

        leftGroup.appendChild(socket);
        leftGroup.appendChild(nameLabel);
        row.appendChild(leftGroup);

        const rightWidget = document.createElement('div');
        rightWidget.className = 'param-right';
        if (!isConn) {
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'param-input';
          input.placeholder = p.hint || 'Input Value';
          input.value = (node.inputValues && node.inputValues[p.name] !== undefined) ? node.inputValues[p.name] : '';
          input.addEventListener('mousedown', e => e.stopPropagation());
          input.addEventListener('input', e => {
            this.state.setInputValue(node.id, p.name, e.target.value, false);
          });
          input.addEventListener('blur', () => {
            this.state.setInputValue(node.id, p.name, input.value, true);
          });
          rightWidget.appendChild(input);
        }
        row.appendChild(rightWidget);

        inputsCol.appendChild(row);
      });

      const outputsCol = document.createElement('div');
      outputsCol.className = 'pins-col pins-out';

      dataOuts.forEach(p => {
        const row = document.createElement('div');
        row.className = 'param-row param-out-row';

        const pType = p.type || 'generic';
        const color = PIN_COLORS[pType] || PIN_COLORS.generic;

        const nameLabel = document.createElement('span');
        nameLabel.className = 'param-name';
        nameLabel.textContent = p.name;

        const socket = document.createElement('div');
        socket.className = 'socket socket-out';
        socket.dataset.nodeId = node.id;
        socket.dataset.pinName = p.name;
        socket.dataset.pinType = pType;
        socket.dataset.isOutput = 'true';
        socket.dataset.isExec = 'false';

        const isConn = this.state.wires.some(w => w.fromNode === node.id && w.fromPin === p.name);
        if (isConn) {
          socket.classList.add('connected');
          socket.style.backgroundColor = color;
          socket.style.borderColor = color;
        } else {
          socket.style.borderColor = color;
          socket.style.backgroundColor = '#1a1e27';
        }

        row.appendChild(nameLabel);
        row.appendChild(socket);
        outputsCol.appendChild(row);
      });

      content.appendChild(inputsCol);
      content.appendChild(outputsCol);
      body.appendChild(content);
    }

    el.appendChild(body);
  }

  populateNodePins(node, bp, inputsCol, outputsCol) {
    // Dynamic List Assembly Inputs
    if (bp.canAddDynamicInputs) {
      const dynamicKeys = node.dynamicInputs || ['0'];

      dynamicKeys.forEach((keyName, idx) => {
        const pinRow = document.createElement('div');
        pinRow.className = 'param-row param-in-row';
        pinRow.dataset.pinName = keyName;

        const pinType = this.state.getPinType(node.id, keyName, 'generic');
        const pinColor = PIN_COLORS[pinType] || PIN_COLORS.generic;

        const socket = document.createElement('div');
        socket.className = 'socket socket-in';
        socket.dataset.nodeId = node.id;
        socket.dataset.pinName = keyName;
        socket.dataset.pinType = pinType;
        socket.dataset.isOutput = 'false';
        socket.dataset.isExec = 'false';

        const badge = this.state.getPinBadge(node.id, keyName);
        if (badge) {
          socket.classList.add('connected');
          socket.style.backgroundColor = pinColor;
          socket.style.borderColor = pinColor;
        } else {
          socket.style.borderColor = pinColor;
          socket.style.backgroundColor = '#1a1e27';
        }
        const leftGroup = document.createElement('div');
        leftGroup.className = 'param-left';

        leftGroup.appendChild(socket);

        // Index badge: [0], [1], [2]
        const indexBadge = document.createElement('span');
        indexBadge.className = 'param-index-badge';
        indexBadge.textContent = keyName;
        leftGroup.appendChild(indexBadge);

        // Gear icon to change parameter data type
        const gear = document.createElement('span');
        gear.className = 'param-gear';
        gear.innerHTML = this.getGearIconSVG();
        gear.title = `Configure data type for [${keyName}]`;
        gear.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openDataTypePicker(node, keyName, true, gear, e);
        });
        leftGroup.appendChild(gear);

        pinRow.appendChild(leftGroup);

        const rightWidget = document.createElement('div');
        rightWidget.className = 'param-right';

        if (badge) {
          const badgeSpan = document.createElement('div');
          badgeSpan.className = 'param-badge-pill';
          badgeSpan.textContent = badge;
          rightWidget.appendChild(badgeSpan);
        } else if (pinType === 'vector3' || node.dataType === 'vector3') {
          const vecContainer = document.createElement('div');
          vecContainer.className = 'vector3-input-container';
          vecContainer.style.cssText = 'display: flex; gap: 4px; align-items: center; width: 100%;';
          
          let currentVec = parseVec3(node.inputValues[keyName]);

          ['X', 'Y', 'Z'].forEach((axis) => {
            const axisWrap = document.createElement('div');
            axisWrap.style.cssText = 'position: relative; flex: 1; display: flex; align-items: center; min-width: 0;';

            const axisInput = document.createElement('input');
            axisInput.type = 'text';
            axisInput.className = 'param-input vector-axis-input';
            const axisColor = axis === 'X' ? '#EF4444' : (axis === 'Y' ? '#22C55E' : '#3B82F6');
            const axisBg = axis === 'X' ? 'rgba(239, 68, 68, 0.18)' : (axis === 'Y' ? 'rgba(34, 197, 94, 0.18)' : 'rgba(59, 130, 246, 0.18)');
            axisInput.style.cssText = `width: 100%; text-align: center; padding: 2px 2px; font-size: 11px; font-family: monospace; font-weight: bold; background: ${axisBg}; border: 1px solid ${axisColor}; border-radius: 3px; color: #FFFFFF; outline: none;`;
            const axisVal = currentVec[axis.toLowerCase()];
            axisInput.value = (axisVal !== undefined) ? axisVal : 0;
            axisInput.title = `Element ${keyName} (${axis} Axis)`;

            axisInput.addEventListener('mousedown', (e) => e.stopPropagation());
            axisInput.addEventListener('click', (e) => e.stopPropagation());
            axisInput.addEventListener('focus', () => {
              axisInput.style.borderColor = '#FFFFFF';
              axisInput.style.boxShadow = `0 0 5px ${axisColor}`;
            });
            axisInput.addEventListener('input', (e) => {
              currentVec[axis.toLowerCase()] = e.target.value;
              const valStr = formatVec3Str(currentVec);
              this.state.setInputValue(node.id, keyName, valStr, false);
            });
            axisInput.addEventListener('blur', () => {
              axisInput.style.borderColor = axisColor;
              axisInput.style.boxShadow = 'none';
              const valStr = formatVec3Str(currentVec);
              this.state.setInputValue(node.id, keyName, valStr, true);
            });

            axisWrap.appendChild(axisInput);
            vecContainer.appendChild(axisWrap);
          });
          rightWidget.appendChild(vecContainer);
        } else {
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'param-input';
          input.value = node.inputValues[keyName] || '';
          input.placeholder = 'Input Element';
          input.addEventListener('mousedown', (e) => e.stopPropagation());
          input.addEventListener('click', (e) => e.stopPropagation());
          input.addEventListener('input', (e) => {
            this.state.setInputValue(node.id, keyName, e.target.value, false);
          });
          input.addEventListener('blur', () => {
            this.state.setInputValue(node.id, keyName, input.value, true);
          });
          rightWidget.appendChild(input);
        }

        pinRow.appendChild(rightWidget);

        // Delete button for list elements (if more than 1 item)
        if (dynamicKeys.length > 1) {
          const removeBtn = document.createElement('button');
          removeBtn.className = 'param-remove-btn';
          removeBtn.innerHTML = '✕';
          removeBtn.title = `Delete element ${keyName}`;
          removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.state.removeDynamicInput(node.id, keyName);
            const nodeEl = this.nodeElements?.get(node.id) || this.nodesLayer?.querySelector(`.node[data-id="${node.id}"]`);
            if (nodeEl) {
              delete nodeEl.dataset.pinsSig;
            }
            this.render();
          });
          pinRow.appendChild(removeBtn);
        } else {
          const spacer = document.createElement('span');
          spacer.className = 'param-remove-spacer';
          pinRow.appendChild(spacer);
        }

        inputsCol.appendChild(pinRow);
      });

      // "+ Add Element" Button
      const addElementBtn = document.createElement('button');
      addElementBtn.className = 'list-add-element-btn';
      addElementBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Element
      `;
      addElementBtn.title = 'Add dynamic list element';
      addElementBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
          document.activeElement.blur();
        }
        this.state.addDynamicInput(node.id);
        const nodeEl = this.nodeElements?.get(node.id) || this.nodesLayer?.querySelector(`.node[data-id="${node.id}"]`);
        if (nodeEl) {
          delete nodeEl.dataset.pinsSig;
        }
        this.render();
      });
      inputsCol.appendChild(addElementBtn);

    } else if (bp.id === 'exec_send_signal') {
      // Dynamic Input Parameters for Send Signal node based on selected Signal
      const currentSigName = node.inputValues?.['Signal Name'] || node.signalName || '';
      const signalDef = signalsManager.getSignal(currentSigName);
      let signalParams = signalDef ? (signalDef.params || []) : [];
      if (signalParams.length === 0 && Array.isArray(node.customInputs) && node.customInputs.length > 0) {
        signalParams = node.customInputs;
      }

      if (signalParams.length === 0) {
        const emptyNotice = document.createElement('div');
        emptyNotice.className = 'sig-node-empty-params';
        emptyNotice.textContent = '(No payload parameters)';
        inputsCol.appendChild(emptyNotice);
      } else {
        signalParams.forEach((param) => {
          const pinRow = document.createElement('div');
          pinRow.className = 'param-row param-in-row';
          pinRow.dataset.pinName = param.name;

          const pinType = this.state.getPinType(node.id, param.name, getPinTypeFromSignalType(param.type));
          const pinColor = PIN_COLORS[pinType] || PIN_COLORS.generic;

          const socket = document.createElement('div');
          socket.className = 'socket socket-in';
          socket.dataset.nodeId = node.id;
          socket.dataset.pinName = param.name;
          socket.dataset.pinType = pinType;
          socket.dataset.isOutput = 'false';
          socket.dataset.isExec = 'false';

          const badge = this.state.getPinBadge(node.id, param.name);
          if (badge) {
            socket.classList.add('connected');
            socket.style.backgroundColor = pinColor;
            socket.style.borderColor = pinColor;
          } else {
            socket.style.borderColor = pinColor;
            socket.style.backgroundColor = '#1a1e27';
          }

          const leftGroup = document.createElement('div');
          leftGroup.className = 'param-left';
          leftGroup.appendChild(socket);

          const label = document.createElement('span');
          label.className = 'param-name';
          label.textContent = param.name;
          leftGroup.appendChild(label);

          pinRow.appendChild(leftGroup);

          const rightWidget = document.createElement('div');
          rightWidget.className = 'param-right';

          if (badge) {
            const badgeSpan = document.createElement('div');
            badgeSpan.className = 'param-badge-pill';
            badgeSpan.textContent = badge;
            rightWidget.appendChild(badgeSpan);
          } else {
            if (pinType === 'bool') {
              const select = document.createElement('select');
              select.className = 'param-select';
              select.addEventListener('mousedown', (e) => e.stopPropagation());
              select.addEventListener('click', (e) => e.stopPropagation());
              [
                { val: '1', label: 'True (1)' },
                { val: '0', label: 'False (0)' }
              ].forEach(b => {
                const optEl = document.createElement('option');
                optEl.value = b.val;
                optEl.textContent = b.label;
                const curVal = node.inputValues[param.name] !== undefined ? String(node.inputValues[param.name]) : '1';
                if (curVal === b.val || (curVal === 'True' && b.val === '1') || (curVal === 'False' && b.val === '0')) {
                  optEl.selected = true;
                }
                select.appendChild(optEl);
              });
              select.addEventListener('change', (e) => {
                this.state.setInputValue(node.id, param.name, e.target.value);
              });
              rightWidget.appendChild(select);
            } else if (pinType === 'vector3') {
              const vecContainer = document.createElement('div');
              vecContainer.className = 'vector3-input-container';
              vecContainer.style.cssText = 'display: flex; gap: 4px; align-items: center; width: 100%;';
              
              let currentVec = parseVec3(node.inputValues[param.name]);

              ['X', 'Y', 'Z'].forEach((axis) => {
                const axisWrap = document.createElement('div');
                axisWrap.style.cssText = 'position: relative; flex: 1; display: flex; align-items: center; min-width: 0;';

                const axisInput = document.createElement('input');
                axisInput.type = 'text';
                axisInput.className = 'param-input vector-axis-input';
                const axisColor = axis === 'X' ? '#EF4444' : (axis === 'Y' ? '#22C55E' : '#3B82F6');
                const axisBg = axis === 'X' ? 'rgba(239, 68, 68, 0.18)' : (axis === 'Y' ? 'rgba(34, 197, 94, 0.18)' : 'rgba(59, 130, 246, 0.18)');
                axisInput.style.cssText = `width: 100%; text-align: center; padding: 2px 2px; font-size: 11.5px; font-family: monospace; font-weight: bold; background: ${axisBg}; border: 1px solid ${axisColor}; border-radius: 3px; color: #FFFFFF; outline: none;`;
                const axisVal = currentVec[axis.toLowerCase()];
                axisInput.value = (axisVal !== undefined) ? axisVal : 0;
                axisInput.title = `${param.name} (${axis} Axis)`;

                axisInput.addEventListener('mousedown', (e) => e.stopPropagation());
                axisInput.addEventListener('click', (e) => e.stopPropagation());
                axisInput.addEventListener('focus', () => {
                  axisInput.style.borderColor = '#FFFFFF';
                  axisInput.style.boxShadow = `0 0 5px ${axisColor}`;
                });
                axisInput.addEventListener('input', (e) => {
                  currentVec[axis.toLowerCase()] = e.target.value;
                  const valStr = formatVec3Str(currentVec);
                  this.state.setInputValue(node.id, param.name, valStr, false);
                });
                axisInput.addEventListener('blur', () => {
                  axisInput.style.borderColor = axisColor;
                  axisInput.style.boxShadow = 'none';
                  const valStr = formatVec3Str(currentVec);
                  this.state.setInputValue(node.id, param.name, valStr, true);
                });

                axisWrap.appendChild(axisInput);
                vecContainer.appendChild(axisWrap);
              });
              rightWidget.appendChild(vecContainer);
            } else {
              const input = document.createElement('input');
              input.type = 'text';
              input.className = 'param-input';
              input.value = node.inputValues[param.name] !== undefined ? node.inputValues[param.name] : '';
              input.placeholder = pinType === 'int' ? '0' : (pinType === 'float' ? '0.0' : 'Value');
              input.addEventListener('mousedown', (e) => e.stopPropagation());
              input.addEventListener('click', (e) => e.stopPropagation());
              input.addEventListener('input', (e) => {
                this.state.setInputValue(node.id, param.name, e.target.value, false);
              });
              input.addEventListener('blur', () => {
                this.state.setInputValue(node.id, param.name, input.value, true);
              });
              rightWidget.appendChild(input);
            }
          }

          pinRow.appendChild(rightWidget);
          inputsCol.appendChild(pinRow);
        });
      }
    } else {
      // 2. Standard Input Parameters
      const inputs = bp.inputs || [];
      const hasMathSymbol = bp.centerSymbol && inputs.length === 2;

      inputs.forEach((inp, idx) => {
        // Insert clean math operator between Input 1 and Input 2
        if (hasMathSymbol && idx === 1) {
          const opRow = document.createElement('div');
          opRow.className = 'math-operator-row';
          opRow.innerHTML = `<span class="math-operator-pill">${bp.centerSymbol}</span>`;
          inputsCol.appendChild(opRow);
        }

        const pinRow = document.createElement('div');
        pinRow.className = 'param-row param-in-row';
        pinRow.dataset.pinName = inp.name;

        const pinType = this.state.getPinType(node.id, inp.name, inp.type);
        const lowerInpName = String(inp.name || '').toLowerCase();
        const isListPin = pinType === 'list' || inp.type === 'list' || lowerInpName === 'list' || lowerInpName.includes('list') || lowerInpName.includes('target list') || lowerInpName.includes('input list') || lowerInpName.includes('iteration list') || lowerInpName.includes('weight list') || lowerInpName.includes('id list');
        const isLocalVarPin = pinType === 'local_var' || inp.type === 'local_var' || lowerInpName === 'local variable' || lowerInpName === 'local_var';
        const effectivePinType = isListPin ? 'list' : (isLocalVarPin ? 'local_var' : pinType);
        const pinColor = PIN_COLORS[effectivePinType] || PIN_COLORS.generic;

        const socket = document.createElement('div');
        socket.className = 'socket socket-in';
        socket.dataset.nodeId = node.id;
        socket.dataset.pinName = inp.name;
        socket.dataset.pinType = effectivePinType;
        socket.dataset.isOutput = 'false';
        socket.dataset.isExec = 'false';

        const badge = this.state.getPinBadge(node.id, inp.name);
        if (badge) {
          socket.classList.add('connected');
          socket.style.backgroundColor = pinColor;
          socket.style.borderColor = pinColor;
        } else {
          socket.style.borderColor = pinColor;
          socket.style.backgroundColor = '#1a1e27';
        }
        const leftGroup = document.createElement('div');
        leftGroup.className = 'param-left';

        leftGroup.appendChild(socket);

        // Label
        const label = document.createElement('span');
        label.className = 'param-name';
        label.textContent = inp.name;
        if (hasMathSymbol) {
          label.style.display = 'none';
        }
        leftGroup.appendChild(label);

        // Gear icon if present or configurable
        if (inp.hasGear) {
          const gear = document.createElement('span');
          gear.className = 'param-gear';
          gear.innerHTML = this.getGearIconSVG();
          gear.title = `Configure data type for ${inp.name} (Current: ${effectivePinType})`;
          gear.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openDataTypePicker(node, inp.name, true, gear, e);
          });
          leftGroup.appendChild(gear);
        }

        pinRow.appendChild(leftGroup);

        const rightWidget = document.createElement('div');
        rightWidget.className = 'param-right';

        // Connected badge pill or editable field
        if (badge) {
          const badgeSpan = document.createElement('div');
          badgeSpan.className = 'param-badge-pill';
          badgeSpan.textContent = badge;
          rightWidget.appendChild(badgeSpan);
        } else {
          if (isListPin || isLocalVarPin) {
            // List or local variable input accepts only wires - do not include text input window, but rightWidget maintains alignment width
          } else if (inp.name === 'Variable Name') {
            const isCustomVarNode = node.blueprintId === 'query_get_custom_var' ||
                                    node.blueprintId === 'exec_set_custom_var' ||
                                    (node.name || '').toLowerCase().includes('custom variable');

            const varWrap = document.createElement('div');
            varWrap.className = 'param-var-search-wrap';

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'param-input param-var-input';
            input.value = node.inputValues[inp.name] !== undefined ? node.inputValues[inp.name] : (inp.defaultVal || 'HP');
            input.placeholder = inp.placeholder || 'Variable Name';
            input.title = isCustomVarNode ? 'Click 🔍 to select from Custom Variables' : 'Click 🔍 to select from Node Graph Variables';
            input.addEventListener('mousedown', (e) => e.stopPropagation());
            input.addEventListener('click', (e) => e.stopPropagation());
            input.addEventListener('input', (e) => {
              this.state.setInputValue(node.id, inp.name, e.target.value, false);
            });
            input.addEventListener('blur', () => {
              this.state.setInputValue(node.id, inp.name, input.value, true);
            });

            const searchBtn = document.createElement('button');
            searchBtn.className = 'param-var-search-btn';
            searchBtn.type = 'button';
            searchBtn.title = isCustomVarNode ? 'Browse Custom Variables' : 'Browse Node Graph Variables';
            searchBtn.innerHTML = `
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="11" cy="11" r="7"/>
                <line x1="21" y1="21" x2="16" y2="16"/>
              </svg>
            `;
            searchBtn.addEventListener('mousedown', (e) => e.stopPropagation());
            searchBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.openVariablePicker(node, inp.name, searchBtn);
            });

            varWrap.appendChild(input);
            varWrap.appendChild(searchBtn);
            rightWidget.appendChild(varWrap);
          } else if (inp.name === 'Trigger Event') {
            const select = document.createElement('select');
            select.className = 'param-select';
            select.addEventListener('mousedown', (e) => e.stopPropagation());
            select.addEventListener('click', (e) => e.stopPropagation());
            const opts = ['No', 'Yes'];
            for (const opt of opts) {
              const optEl = document.createElement('option');
              optEl.value = opt;
              optEl.textContent = opt;
              const cur = node.inputValues[inp.name] !== undefined ? String(node.inputValues[inp.name]) : 'No';
              if (cur === opt || (cur === 'False' && opt === 'No') || (cur === 'True' && opt === 'Yes') ||
                  (cur === '0' && opt === 'No') || (cur === '1' && opt === 'Yes')) {
                optEl.selected = true;
              }
              select.appendChild(optEl);
            }
            select.addEventListener('change', (e) => {
              this.state.setInputValue(node.id, inp.name, e.target.value);
            });
            rightWidget.appendChild(select);
          } else if (node.blueprintId === 'exec_set_node_graph_var' && inp.name === 'Variable Value') {
            const currentVarName = node.inputValues?.['Variable Name'] || '';
            const varDef = currentVarName ? this.state.getNodeGraphVariableByName(currentVarName) : null;
            const isBool = varDef ? varDef.type === 'bool' : (pinType === 'bool');
            if (isBool && node.pinTypes) node.pinTypes['Variable Value'] = 'bool';

            if (isBool) {
              const select = document.createElement('select');
              select.className = 'param-select';
              select.addEventListener('mousedown', (e) => e.stopPropagation());
              select.addEventListener('click', (e) => e.stopPropagation());
              ['No', 'Yes'].forEach(opt => {
                const optEl = document.createElement('option');
                optEl.value = opt;
                optEl.textContent = opt;
                const cur = node.inputValues[inp.name] !== undefined ? String(node.inputValues[inp.name]) : 'No';
                if (cur === opt || (cur === 'False' && opt === 'No') || (cur === 'True' && opt === 'Yes') || (cur === '0' && opt === 'No') || (cur === '1' && opt === 'Yes')) {
                  optEl.selected = true;
                }
                select.appendChild(optEl);
              });
              select.addEventListener('change', (e) => {
                this.state.setInputValue(node.id, inp.name, e.target.value);
              });
              rightWidget.appendChild(select);
            } else {
              const input = document.createElement('input');
              input.type = 'text';
              input.className = 'param-input';
              const curVal = node.inputValues[inp.name] !== undefined ? node.inputValues[inp.name] :
                (idx === 0 && node.inputValues['Generic'] !== undefined ? node.inputValues['Generic'] :
                (node.inputValues[`param_${idx}`] !== undefined ? node.inputValues[`param_${idx}`] : (inp.defaultVal !== undefined ? inp.defaultVal : '0')));
              input.value = curVal;
              input.placeholder = inp.placeholder || '0';
              input.addEventListener('mousedown', (e) => e.stopPropagation());
              input.addEventListener('click', (e) => e.stopPropagation());
              input.addEventListener('input', (e) => {
                this.state.setInputValue(node.id, inp.name, e.target.value, false);
              });
              input.addEventListener('blur', () => {
                this.state.setInputValue(node.id, inp.name, input.value, true);
              });
              rightWidget.appendChild(input);
            }
          } else if (inp.options || inp.type === 'enum' || pinType === 'enum') {
            const select = document.createElement('select');
            select.className = 'param-select';
            select.addEventListener('mousedown', (e) => e.stopPropagation());
            select.addEventListener('click', (e) => e.stopPropagation());
            const opts = inp.options || (inp.name === 'Sort By' ? ['Ascending', 'Descending'] : ['Default', 'Option 1']);
            const boolOpts = optionsAreBooleans(opts);
            let curSel = node.inputValues[inp.name];
            if (inp.name === 'Sort By') {
              if (curSel === '600' || curSel === 600) curSel = 'Ascending';
              else if (curSel === '601' || curSel === 601) curSel = 'Descending';
            }
            if (boolOpts && curSel !== undefined && curSel !== opts[0] && curSel !== opts[1]) {
              curSel = normalizeBool(curSel) === 'True' ? opts[0] : opts[1];
            }
            for (const opt of opts) {
              const optEl = document.createElement('option');
              optEl.value = opt;
              optEl.textContent = opt;
              if ((curSel || opts[0]) === opt) optEl.selected = true;
              select.appendChild(optEl);
            }
            select.addEventListener('change', (e) => {
              this.state.setInputValue(node.id, inp.name, e.target.value);
            });
            rightWidget.appendChild(select);
          } else if (pinType === 'bool' || inp.type === 'bool') {
            const select = document.createElement('select');
            select.className = 'param-select';
            select.addEventListener('mousedown', (e) => e.stopPropagation());
            select.addEventListener('click', (e) => e.stopPropagation());
            const curVal = node.inputValues[inp.name] !== undefined ? node.inputValues[inp.name] : (inp.defaultVal !== undefined ? inp.defaultVal : '1');
            const isT = normalizeBool(curVal) === 'True';
            [
              { val: '1', label: 'True (1)' },
              { val: '0', label: 'False (0)' }
            ].forEach(b => {
              const optEl = document.createElement('option');
              optEl.value = b.val;
              optEl.textContent = b.label;
              if ((isT && b.val === '1') || (!isT && b.val === '0')) {
                optEl.selected = true;
              }
              select.appendChild(optEl);
            });
            select.addEventListener('change', (e) => {
              this.state.setInputValue(node.id, inp.name, e.target.value);
            });
            rightWidget.appendChild(select);
          } else if (pinType === 'vector3' || inp.type === 'vector3' || lowerInpName.includes('location') || lowerInpName.includes('rotation') || lowerInpName.includes('offset') || lowerInpName.includes('vector')) {
            const vecContainer = document.createElement('div');
            vecContainer.className = 'vector3-input-container';
            vecContainer.style.cssText = 'display: flex; gap: 4px; align-items: center; width: 100%;';
            
            let currentVec = parseVec3(node.inputValues[inp.name]);

            ['X', 'Y', 'Z'].forEach((axis) => {
              const axisWrap = document.createElement('div');
              axisWrap.style.cssText = 'position: relative; flex: 1; display: flex; align-items: center; min-width: 0;';

              const axisInput = document.createElement('input');
              axisInput.type = 'text';
              axisInput.className = 'param-input vector-axis-input';
              const axisColor = axis === 'X' ? '#EF4444' : (axis === 'Y' ? '#22C55E' : '#3B82F6');
              const axisBg = axis === 'X' ? 'rgba(239, 68, 68, 0.18)' : (axis === 'Y' ? 'rgba(34, 197, 94, 0.18)' : 'rgba(59, 130, 246, 0.18)');
              axisInput.style.cssText = `width: 100%; text-align: center; padding: 2px 2px; font-size: 11px; font-family: monospace; font-weight: bold; background: ${axisBg}; border: 1px solid ${axisColor}; border-radius: 3px; color: #FFFFFF; outline: none;`;
              const axisVal = currentVec[axis.toLowerCase()];
              axisInput.value = (axisVal !== undefined) ? axisVal : 0;
              axisInput.title = `${inp.name} (${axis} Axis)`;

              axisInput.addEventListener('mousedown', (e) => e.stopPropagation());
              axisInput.addEventListener('click', (e) => e.stopPropagation());
              axisInput.addEventListener('focus', () => {
                axisInput.style.borderColor = '#FFFFFF';
                axisInput.style.boxShadow = `0 0 5px ${axisColor}`;
              });
              axisInput.addEventListener('input', (e) => {
                currentVec[axis.toLowerCase()] = e.target.value;
                const valStr = formatVec3Str(currentVec);
                this.state.setInputValue(node.id, inp.name, valStr, false);
              });
              axisInput.addEventListener('blur', () => {
                axisInput.style.borderColor = axisColor;
                axisInput.style.boxShadow = 'none';
                const valStr = formatVec3Str(currentVec);
                this.state.setInputValue(node.id, inp.name, valStr, true);
              });

              axisWrap.appendChild(axisInput);
              vecContainer.appendChild(axisWrap);
            });
            rightWidget.appendChild(vecContainer);
          } else {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'param-input';
            input.value = node.inputValues[inp.name] !== undefined ? node.inputValues[inp.name] : (inp.defaultVal !== undefined ? inp.defaultVal : '');
            input.placeholder = inp.placeholder || (lowerInpName.includes('id') || lowerInpName.includes('asset') || lowerInpName.includes('guid') || lowerInpName.includes('index') || lowerInpName.includes('prefab') || lowerInpName.includes('config') ? '10001234' : '0');
            input.addEventListener('mousedown', (e) => e.stopPropagation());
            input.addEventListener('click', (e) => e.stopPropagation());
            input.addEventListener('input', (e) => {
              this.state.setInputValue(node.id, inp.name, e.target.value, false);
            });
            input.addEventListener('blur', () => {
              this.state.setInputValue(node.id, inp.name, input.value, true);
            });
            rightWidget.appendChild(input);
          }
        }

        pinRow.appendChild(rightWidget);
        inputsCol.appendChild(pinRow);
      });
    }

    // 3. Render Output Parameters
    for (const out of (bp.outputs || [])) {
      const pinRow = document.createElement('div');
      pinRow.className = 'param-row param-out-row';

      const outType = this.state.getPinType(node.id, out.name, out.type);
      const lowerOutName = String(out.name || '').toLowerCase();
      const isListOut = outType === 'list' || outType.endsWith(' list') || out.type === 'list' || lowerOutName === 'list' || lowerOutName.includes('list');
      const outColor = PIN_COLORS[outType] || PIN_COLORS[outType?.replace(/\s+list$/i, '')] || (isListOut ? (PIN_COLORS.list || '#00D2B4') : PIN_COLORS.generic);

      const outLeft = document.createElement('div');
      outLeft.className = 'param-out-left';

      if (out.hasGear) {
        const gear = document.createElement('span');
        gear.className = 'param-gear';
        gear.innerHTML = this.getGearIconSVG();
        gear.title = `Configure data type for ${out.name} (Current: ${outType})`;
        gear.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openDataTypePicker(node, out.name, false, gear, e);
        });
        outLeft.appendChild(gear);
      }

      const label = document.createElement('span');
      label.className = 'param-name';
      label.textContent = out.name;
      outLeft.appendChild(label);

      pinRow.appendChild(outLeft);

      const outRight = document.createElement('div');
      outRight.className = 'param-out-right';

      const socket = document.createElement('div');
      socket.className = 'socket socket-out';
      socket.dataset.nodeId = node.id;
      socket.dataset.pinName = out.name;
      socket.dataset.pinType = outType;
      socket.dataset.isOutput = 'true';
      socket.dataset.isExec = 'false';

      const isConnected = this.state.wires.some(w => w.fromNode === node.id && w.fromPin === out.name);
      if (isConnected) {
        socket.classList.add('connected');
        socket.style.backgroundColor = outColor;
        socket.style.borderColor = outColor;
      } else {
        socket.style.borderColor = outColor;
        socket.style.backgroundColor = '#1a1e27';
      }

      outRight.appendChild(socket);
      pinRow.appendChild(outRight);

      outputsCol.appendChild(pinRow);
    }

    // Dynamic Output Parameters for Monitor Signal node based on selected Signal
    if (bp.id === 'event_monitor_signal') {
      const currentSigName = node.inputValues?.['Signal Name'] || node.signalName || '';
      const signalDef = signalsManager.getSignal(currentSigName);
      let signalParams = signalDef ? (signalDef.params || []) : [];
      if (signalParams.length === 0 && Array.isArray(node.customOutputs) && node.customOutputs.length > 0) {
        signalParams = node.customOutputs.filter(o =>
          o.name !== 'Event Source Entity' &&
          o.name !== 'Event Source GUID' &&
          o.name !== 'Signal Source Entity'
        );
      }
      // Also include any connected wires from this node with custom pin names
      const wiredPinNames = new Set(this.state.wires.filter(w => w.fromNode === node.id && !w.isExec).map(w => w.fromPin));
      ['Event Source Entity', 'Event Source GUID', 'Signal Source Entity'].forEach(p => wiredPinNames.delete(p));
      wiredPinNames.forEach(pinName => {
        if (!signalParams.some(p => p.name === pinName)) {
          signalParams.push({ name: pinName, type: 'float' });
        }
      });

      signalParams.forEach((param) => {
        const pinRow = document.createElement('div');
        pinRow.className = 'param-row param-out-row';

        const outType = this.state.getPinType(node.id, param.name, getPinTypeFromSignalType(param.type));
        const outColor = PIN_COLORS[outType] || PIN_COLORS.generic;

        const outLeft = document.createElement('div');
        outLeft.className = 'param-out-left';

        const label = document.createElement('span');
        label.className = 'param-name';
        label.textContent = param.name;
        outLeft.appendChild(label);

        pinRow.appendChild(outLeft);

        const outRight = document.createElement('div');
        outRight.className = 'param-out-right';

        const socket = document.createElement('div');
        socket.className = 'socket socket-out';
        socket.dataset.nodeId = node.id;
        socket.dataset.pinName = param.name;
        socket.dataset.pinType = outType;
        socket.dataset.isOutput = 'true';
        socket.dataset.isExec = 'false';

        const isConnected = this.state.wires.some(w => w.fromNode === node.id && w.fromPin === param.name);
        if (isConnected) {
          socket.classList.add('connected');
          socket.style.backgroundColor = outColor;
          socket.style.borderColor = outColor;
        } else {
          socket.style.borderColor = outColor;
          socket.style.backgroundColor = '#1a1e27';
        }

        outRight.appendChild(socket);
        pinRow.appendChild(outRight);

        outputsCol.appendChild(pinRow);
      });
    }
  }

  populateSignalSelector(node, bp, container) {
    container.innerHTML = '';
    const currentSigName = node.inputValues?.['Signal Name'] || '';

    const row = document.createElement('div');
    row.className = 'node-signal-selector-row';

    // Antenna icon & label
    const labelGroup = document.createElement('div');
    labelGroup.className = 'sig-selector-label-group';
    labelGroup.innerHTML = `
      <span class="sig-selector-icon">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4.93 19.07A10 10 0 0 1 19.07 4.93" stroke-linecap="round"/>
          <path d="M7.76 16.24a6 6 0 0 1 8.48-8.48" stroke-linecap="round"/>
          <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
        </svg>
      </span>
      <span class="sig-selector-text">Signal:</span>
    `;
    row.appendChild(labelGroup);

    // Searchable dropdown trigger button
    const dropdownWrap = document.createElement('div');
    dropdownWrap.className = 'sig-dropdown-wrap';

    const dropBtn = document.createElement('button');
    dropBtn.className = 'sig-dropdown-trigger-btn';
    dropBtn.title = 'Select or search signal';
    dropBtn.innerHTML = `
      <span class="sig-dropdown-val">${currentSigName || 'No Signal'}</span>
      <span class="sig-dropdown-arrow">▼</span>
    `;

    dropBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openSignalPicker(node, dropBtn);
    });

    dropdownWrap.appendChild(dropBtn);
    row.appendChild(dropdownWrap);

    // Quick open Server Signal Explorer button
    const openExplorerBtn = document.createElement('button');
    openExplorerBtn.className = 'sig-open-explorer-btn';
    openExplorerBtn.title = 'Open in Server Signal Explorer';
    openExplorerBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4.93 19.07A10 10 0 0 1 19.07 4.93" stroke-linecap="round"/>
        <path d="M7.76 16.24a6 6 0 0 1 8.48-8.48" stroke-linecap="round"/>
        <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
      </svg>
    `;
    openExplorerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('open_signal_explorer', {
        detail: { signalName: currentSigName }
      }));
    });
    row.appendChild(openExplorerBtn);

    container.appendChild(row);
  }

  openSignalPicker(node, anchorEl) {
    const existing = document.getElementById('canvasSignalPickerPopup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'canvasSignalPickerPopup';
    popup.className = 'canvas-signal-picker-popup';

    const rect = anchorEl.getBoundingClientRect();
    popup.style.position = 'fixed';
    popup.style.left = `${rect.left}px`;
    popup.style.top = `${rect.bottom + 4}px`;
    popup.style.zIndex = '1000';

    popup.innerHTML = `
      <div class="sig-picker-search-box">
        <span class="sig-picker-search-icon">🔍</span>
        <input type="text" class="sig-picker-search-inp" placeholder="Search signals..." autocomplete="off" />
      </div>
      <div class="sig-picker-list"></div>
      <div class="sig-picker-footer">
        <button class="sig-picker-open-mgr-btn">
          <span>+ Open Server Signal Explorer</span>
        </button>
      </div>
    `;

    document.body.appendChild(popup);

    const searchInp = popup.querySelector('.sig-picker-search-inp');
    const listContainer = popup.querySelector('.sig-picker-list');
    const openMgrBtn = popup.querySelector('.sig-picker-open-mgr-btn');

    const renderList = (query = '') => {
      listContainer.innerHTML = '';
      const allSignals = signalsManager.getSignals();
      const filtered = allSignals.filter(s => !query || s.name.toLowerCase().includes(query.toLowerCase().trim()));

      if (filtered.length === 0) {
        const none = document.createElement('div');
        none.className = 'sig-picker-empty';
        none.textContent = 'No matching signals';
        listContainer.appendChild(none);
        return;
      }

      filtered.forEach(s => {
        const item = document.createElement('div');
        item.className = 'sig-picker-item';
        if (s.name === (node.inputValues['Signal Name'] || '')) {
          item.classList.add('selected');
        }

        const nameSpan = document.createElement('span');
        nameSpan.className = 'sig-picker-item-name';
        nameSpan.textContent = s.name;
        item.appendChild(nameSpan);

        if (s.params && s.params.length > 0) {
          const countSpan = document.createElement('span');
          countSpan.className = 'sig-picker-param-count';
          countSpan.textContent = `${s.params.length}p`;
          item.appendChild(countSpan);
        }

        if (s.hasDot) {
          const dot = document.createElement('span');
          dot.className = 'sig-picker-dot';
          item.appendChild(dot);
        }

        item.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.state && typeof this.state.setSignalNode === 'function') {
            this.state.setSignalNode(node.id, s.name);
          } else {
            node.inputValues['Signal Name'] = s.name;
          }
          popup.remove();
          this.state.saveSnapshot();
          this.render();
        });

        listContainer.appendChild(item);
      });
    };

    renderList();

    searchInp.addEventListener('input', (e) => {
      renderList(e.target.value);
    });
    searchInp.addEventListener('click', (e) => e.stopPropagation());

    openMgrBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      popup.remove();
      window.dispatchEvent(new CustomEvent('open_signal_explorer', {
        detail: { signalName: node.inputValues['Signal Name'] }
      }));
    });

    const outsideClick = (e) => {
      if (!popup.contains(e.target) && e.target !== anchorEl) {
        popup.remove();
        document.removeEventListener('click', outsideClick);
        document.removeEventListener('keydown', keyHandler);
      }
    };
    const keyHandler = (e) => {
      if (e.key === 'Escape') {
        popup.remove();
        document.removeEventListener('click', outsideClick);
        document.removeEventListener('keydown', keyHandler);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', outsideClick);
      document.addEventListener('keydown', keyHandler);
      searchInp.focus();
    }, 10);
  }

  openVariablePicker(node, paramName, anchorEl) {
    const isCustomVarNode = node.blueprintId === 'query_get_custom_var' ||
                            node.blueprintId === 'exec_set_custom_var' ||
                            (node.name || '').toLowerCase().includes('custom variable');

    const existing = document.getElementById('canvasVarPickerPopup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'canvasVarPickerPopup';
    popup.className = 'canvas-signal-picker-popup canvas-var-picker-popup';

    const rect = anchorEl.getBoundingClientRect();
    popup.style.position = 'fixed';
    popup.style.left = `${rect.left}px`;
    popup.style.top = `${rect.bottom + 4}px`;
    popup.style.zIndex = '1000';

    const titleText = isCustomVarNode ? 'Custom Variables' : 'Node Graph Variables';
    const openBtnText = isCustomVarNode ? '+ Open Custom Variables' : '+ Open Node Graph Variables';

    popup.innerHTML = `
      <div class="sig-picker-search-box">
        <span class="sig-picker-search-icon">🔍</span>
        <input type="text" class="sig-picker-search-inp" placeholder="Search ${titleText.toLowerCase()}..." autocomplete="off" />
      </div>
      <div class="sig-picker-list"></div>
      <div class="sig-picker-footer">
        <button class="sig-picker-open-mgr-btn">
          <span>${openBtnText}</span>
        </button>
      </div>
    `;

    document.body.appendChild(popup);

    const searchInp = popup.querySelector('.sig-picker-search-inp');
    const listContainer = popup.querySelector('.sig-picker-list');
    const openMgrBtn = popup.querySelector('.sig-picker-open-mgr-btn');

    const renderList = (query = '') => {
      listContainer.innerHTML = '';
      const allVars = isCustomVarNode ? this.state.getCustomVariables() : this.state.getNodeGraphVariables();
      const filtered = allVars.filter(v => !query || v.name.toLowerCase().includes(query.toLowerCase().trim()));

      if (filtered.length === 0) {
        const none = document.createElement('div');
        none.className = 'sig-picker-empty';
        none.textContent = `No matching ${isCustomVarNode ? 'custom' : 'node graph'} variables`;
        listContainer.appendChild(none);
        return;
      }

      filtered.forEach(v => {
        const item = document.createElement('div');
        item.className = 'sig-picker-item';
        if (v.name === (node.inputValues[paramName] || '')) {
          item.classList.add('selected');
        }

        const nameSpan = document.createElement('span');
        nameSpan.className = 'sig-picker-item-name';
        nameSpan.textContent = v.name;
        item.appendChild(nameSpan);

        if (isCustomVarNode && v.entityType) {
          const entBadge = document.createElement('span');
          entBadge.className = 'var-entity-badge';
          entBadge.style.fontSize = '10px';
          entBadge.style.padding = '1px 5px';
          entBadge.style.borderRadius = '3px';
          entBadge.style.marginRight = '4px';
          entBadge.style.background = 'rgba(255,255,255,0.08)';
          entBadge.style.color = '#abb2bf';
          entBadge.textContent = v.entityType === 'self' ? 'self' : (v.guidAlias || v.guid || 'guid');
          item.appendChild(entBadge);
        }

        const typeBadge = document.createElement('span');
        typeBadge.className = `var-type-badge type-${v.type}`;
        typeBadge.textContent = v.type;
        item.appendChild(typeBadge);

        item.addEventListener('click', (e) => {
          e.stopPropagation();
          this.state.setInputValue(node.id, paramName, v.name);
          if (v.type && (node.dataType !== v.type)) {
            this.state.setNodeDataType(node.id, v.type);
          }
          popup.remove();
          this.render();
        });

        listContainer.appendChild(item);
      });
    };

    renderList();

    searchInp.addEventListener('input', (e) => {
      renderList(e.target.value);
    });
    searchInp.addEventListener('click', (e) => e.stopPropagation());

    openMgrBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      popup.remove();
      if (isCustomVarNode) {
        if (window.miliastraCustomVars) {
          window.miliastraCustomVars.open(node.inputValues[paramName]);
        } else {
          window.dispatchEvent(new CustomEvent('open_custom_vars', {
            detail: { varName: node.inputValues[paramName] }
          }));
        }
      } else {
        if (window.miliastraNodeGraphVars) {
          window.miliastraNodeGraphVars.open();
        } else {
          window.dispatchEvent(new CustomEvent('open_node_graph_vars', {
            detail: { varName: node.inputValues[paramName] }
          }));
        }
      }
    });

    const outsideClick = (e) => {
      if (!popup.contains(e.target) && e.target !== anchorEl) {
        popup.remove();
        document.removeEventListener('click', outsideClick);
        document.removeEventListener('keydown', keyHandler);
      }
    };
    const keyHandler = (e) => {
      if (e.key === 'Escape') {
        popup.remove();
        document.removeEventListener('click', outsideClick);
        document.removeEventListener('keydown', keyHandler);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', outsideClick);
      document.addEventListener('keydown', keyHandler);
      searchInp.focus();
    }, 10);
  }

  cachePinPositions() {
    const stageRect = this.stage.getBoundingClientRect();
    const zoom = this.state.zoom || 1;
    const hasValidStage = stageRect && stageRect.width > 0 && stageRect.height > 0;

    const allSockets = this.container.querySelectorAll('.socket, .pin-exec');

    for (const s of allSockets) {
      const r = s.getBoundingClientRect();
      const isExec = s.dataset.isExec === 'true';
      const isOutput = s.dataset.isOutput === 'true';
      const nodeId = s.dataset.nodeId;
      const pinName = s.dataset.pinName;
      const key = `${nodeId}::${pinName}`;

      const node = this.state.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      let x = 0;
      let y = 0;
      let relX = 0;
      let relY = 0;
      let validMeasure = false;

      // 1. Direct DOM measurement via getBoundingClientRect if viewport has valid layout
      if (hasValidStage && r.width > 0 && r.height > 0) {
        if (isExec) {
          x = isOutput ? (r.right - 2 - stageRect.left) / zoom : (r.left + 2 - stageRect.left) / zoom;
          y = (r.top + r.height / 2 - stageRect.top) / zoom;
        } else {
          x = (r.left + r.width / 2 - stageRect.left) / zoom;
          y = (r.top + r.height / 2 - stageRect.top) / zoom;
        }

        relX = x - node.x;
        relY = y - node.y;

        // Plausibility check: relative offset should be within reasonable node boundaries
        if (relX >= -20 && relX <= 500 && relY >= 0 && relY <= 1200) {
          validMeasure = true;
          this.pinRelCache.set(key, { relX, relY, isExec, isOutput });
        }
      }

      // 2. If DOM rect was unmeasured (offscreen, collapsed, or hidden), use previous cached relative offset
      if (!validMeasure && this.pinRelCache.has(key)) {
        const cached = this.pinRelCache.get(key);
        relX = cached.relX;
        relY = cached.relY;
        x = node.x + relX;
        y = node.y + relY;
        validMeasure = true;
      }

      // 3. Fallback: compute deterministic pin coordinates from offsetParent or node structure
      if (!validMeasure) {
        const nodeEl = this.nodeElements.get(nodeId);
        let offX = 0, offY = 0;
        if (nodeEl) {
          let cur = s;
          while (cur && cur !== nodeEl && cur !== document.body) {
            offX += cur.offsetLeft || 0;
            offY += cur.offsetTop || 0;
            cur = cur.offsetParent;
          }
        }

        if (offX > 0 || offY > 0) {
          if (isExec) {
            relX = isOutput ? offX + (s.offsetWidth || 16) - 2 : offX + 2;
            relY = offY + ((s.offsetHeight || 14) / 2);
          } else {
            relX = offX + ((s.offsetWidth || 14) / 2);
            relY = offY + ((s.offsetHeight || 14) / 2);
          }
        } else {
          // Geometric estimation
          if (isExec) {
            relX = isOutput ? 198 : 8;
            relY = 46;
          } else {
            relX = isOutput ? 192 : 12;
            relY = 76;
          }
        }

        x = node.x + relX;
        y = node.y + relY;
        this.pinRelCache.set(key, { relX, relY, isExec, isOutput });
      }

      this.pinCoords.set(key, { x, y, relX, relY, nodeId, pinName, isExec, isOutput });
    }

    // 4. Guarantee pin coordinates for any wires whose pins were not in DOM
    for (const wire of this.state.wires) {
      const fromKey = `${wire.fromNode}::${wire.fromPin}`;
      if (!this.pinCoords.has(fromKey)) {
        const fromNode = this.state.nodes.find(n => n.id === wire.fromNode);
        if (fromNode) {
          const cached = this.pinRelCache.get(fromKey);
          const relX = cached ? cached.relX : 198;
          const relY = cached ? cached.relY : (wire.isExec ? 46 : 76);
          this.pinCoords.set(fromKey, {
            x: fromNode.x + relX,
            y: fromNode.y + relY,
            relX,
            relY,
            nodeId: wire.fromNode,
            pinName: wire.fromPin,
            isExec: wire.isExec,
            isOutput: true
          });
        }
      }

      const toKey = `${wire.toNode}::${wire.toPin}`;
      if (!this.pinCoords.has(toKey)) {
        const toNode = this.state.nodes.find(n => n.id === wire.toNode);
        if (toNode) {
          const cached = this.pinRelCache.get(toKey);
          const relX = cached ? cached.relX : 8;
          const relY = cached ? cached.relY : (wire.isExec ? 46 : 76);
          this.pinCoords.set(toKey, {
            x: toNode.x + relX,
            y: toNode.y + relY,
            relX,
            relY,
            nodeId: wire.toNode,
            pinName: wire.toPin,
            isExec: wire.isExec,
            isOutput: false
          });
        }
      }
    }

    // 5. Let commentsManager cache socket positions for collapsed comment trays
    if (window.miliastraComments) {
      window.miliastraComments.cacheCollapsedSockets(this.pinCoords);
    }
  }

  updateNodePinCoordinates(node) {
    for (const [key, pin] of this.pinCoords.entries()) {
      if (pin.nodeId === node.id) {
        pin.x = node.x + pin.relX;
        pin.y = node.y + pin.relY;
      }
    }
  }

  renderWires(targetNodeIds = null) {
    const currentWireIds = new Set(this.state.wires.map(w => w.id));

    // Remove obsolete wires when performing a full render pass
    if (!targetNodeIds) {
      for (const [id, group] of this.wireElements.entries()) {
        if (!currentWireIds.has(id)) {
          if (group.hitbox) group.hitbox.remove();
          if (group.path) group.path.remove();
          this.wireElements.delete(id);
        }
      }
    }

    const targetSet = targetNodeIds ? (targetNodeIds instanceof Set ? targetNodeIds : new Set(targetNodeIds)) : null;

    // Identify collapsed comment trays to hide purely internal wires
    const collapsedTrays = (this.state.comments || []).filter(c => c.collapsed);

    for (const wire of this.state.wires) {
      // Differential wire update fast-path: skip wires not touching targeted nodes
      if (targetSet && !targetSet.has(wire.fromNode) && !targetSet.has(wire.toNode)) {
        continue;
      }

      // If both endpoints are inside the SAME collapsed comment tray, hide wire path
      const isInternalCollapsed = collapsedTrays.some(tray => {
        const set = new Set(tray.collapsedNodeIds || []);
        return set.has(wire.fromNode) && set.has(wire.toNode);
      });
      if (isInternalCollapsed) {
        const group = this.wireElements.get(wire.id);
        if (group) {
          group.hitbox.setAttribute('d', '');
          group.path.setAttribute('d', '');
        }
        continue;
      }

      const fromKey = `${wire.fromNode}::${wire.fromPin}`;
      const toKey = `${wire.toNode}::${wire.toPin}`;
      const p1 = this.pinCoords.get(fromKey);
      const p2 = this.pinCoords.get(toKey);

      let group = this.wireElements.get(wire.id);

      if (!p1 || !p2 || isNaN(p1.x) || isNaN(p1.y) || isNaN(p2.x) || isNaN(p2.y)) {
        if (group) {
          group.hitbox.setAttribute('d', '');
          group.path.setAttribute('d', '');
        }
        continue;
      }

      // Check distance - if points are coincident (< 4px apart), do not draw hanging loop!
      const distSq = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
      if (distSq < 16) {
        if (group) {
          group.hitbox.setAttribute('d', '');
          group.path.setAttribute('d', '');
        }
        continue;
      }

      const pathData = this.calculateWirePath(p1.x, p1.y, p2.x, p2.y, wire.isExec);
      if (!pathData) {
        if (group) {
          group.hitbox.setAttribute('d', '');
          group.path.setAttribute('d', '');
        }
        continue;
      }

      if (group) {
        // Fast SVG update without DOM allocation
        group.hitbox.setAttribute('d', pathData);
        group.path.setAttribute('d', pathData);
        if (!wire.isExec) {
          const srcType = this.state.getPinType(wire.fromNode, wire.fromPin);
          const wireColor = PIN_COLORS[srcType] || '#538cc4';
          group.path.style.stroke = wireColor;
        }
        if (this.state.selectedWireIds.has(wire.id)) {
          group.path.classList.add('selected');
        } else {
          group.path.classList.remove('selected');
        }
      } else {
        const onWireMouseDown = (e) => {
          e.stopPropagation();
        };
        const onWireMouseUp = (e) => {
          e.stopPropagation();
        };
        const onWireClick = (e) => {
          e.stopPropagation();
          this.selectWire(wire.id);
        };
        const onWireContextMenu = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openWireContextMenu(wire, e);
        };

        // 1. Invisible thick hitbox for reliable click & right-click
        const hitbox = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hitbox.setAttribute('d', pathData);
        hitbox.setAttribute('class', 'wire-hitbox');
        hitbox.dataset.wireId = wire.id;
        hitbox.addEventListener('mousedown', onWireMouseDown);
        hitbox.addEventListener('mouseup', onWireMouseUp);
        hitbox.addEventListener('click', onWireClick);
        hitbox.addEventListener('contextmenu', onWireContextMenu);
        this.svgLayer.appendChild(hitbox);

        // 2. Visible styled wire path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);

        if (wire.isExec) {
          path.setAttribute('class', 'wire wire-exec');
        } else {
          path.setAttribute('class', 'wire wire-data');
          const srcType = this.state.getPinType(wire.fromNode, wire.fromPin);
          const wireColor = PIN_COLORS[srcType] || '#538cc4';
          path.style.stroke = wireColor;
        }

        if (this.state.selectedWireIds.has(wire.id)) {
          path.classList.add('selected');
        }

        path.dataset.wireId = wire.id;
        path.addEventListener('mousedown', onWireMouseDown);
        path.addEventListener('mouseup', onWireMouseUp);
        path.addEventListener('click', onWireClick);
        path.addEventListener('contextmenu', onWireContextMenu);

        this.svgLayer.appendChild(path);

        this.wireElements.set(wire.id, { hitbox, path });
      }
    }
  }

  selectWire(wireId) {
    this.state.selectedNodeIds.clear();
    this.state.selectedWireIds.clear();
    this.state.selectedWireIds.add(wireId);
    this.renderWires();
    this.renderNodes();
  }

  openWireContextMenu(wire, e) {
    this.closePopups();

    const srcNode = this.state.nodes.find(n => n.id === wire.fromNode);
    const tgtNode = this.state.nodes.find(n => n.id === wire.toNode);

    const fromTitle = srcNode ? srcNode.name : 'Unknown';
    const toTitle = tgtNode ? tgtNode.name : 'Unknown';

    const menu = document.createElement('div');
    menu.className = 'wire-context-menu';

    menu.innerHTML = `
      <div class="wire-menu-header">
        <div class="wire-menu-title">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Connection
        </div>
        <div class="wire-menu-subtitle">${fromTitle} [${wire.fromPin}] → ${toTitle} [${wire.toPin}]</div>
      </div>
      <div class="wire-menu-list">
        <div class="wire-menu-item danger" data-action="disconnect">
          <span class="wire-menu-icon">✕</span>
          <span>Disconnect</span>
        </div>
        <div class="wire-menu-divider"></div>
        <div class="wire-menu-item" data-action="jump-src">
          <span class="wire-menu-icon">⮌</span>
          <span>Jump to Source (${fromTitle})</span>
        </div>
        <div class="wire-menu-item" data-action="jump-tgt">
          <span class="wire-menu-icon">⮎</span>
          <span>Jump to Target (${toTitle})</span>
        </div>
        <div class="wire-menu-divider"></div>
        <div class="wire-menu-item" data-action="insert-node">
          <span class="wire-menu-icon">＋</span>
          <span>Insert Node Here / Jump to New Node...</span>
        </div>
      </div>
    `;

    // Calculate viewport bounds
    let x = e.clientX;
    let y = e.clientY;
    const menuW = 250;
    const menuH = 190;
    if (x + menuW > window.innerWidth - 10) x = window.innerWidth - menuW - 10;
    if (y + menuH > window.innerHeight - 10) y = window.innerHeight - menuH - 10;
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    menu.addEventListener('mousedown', (ev) => ev.stopPropagation());
    menu.addEventListener('click', (ev) => {
      const item = ev.target.closest('.wire-menu-item');
      if (!item) return;
      const action = item.dataset.action;

      if (action === 'disconnect') {
        const desc = `${fromTitle} [${wire.fromPin}] ✕ ${toTitle} [${wire.toPin}]`;
        this.state.removeWire(wire.id);
        this.closePopups();
        this.render();
        if (window.miliastraApp && window.miliastraApp.simulator) {
          window.miliastraApp.simulator.log(`Disconnected wire: ${desc}`, 'info');
        }
      } else if (action === 'jump-src') {
        this.closePopups();
        this.state.jumpToNode(wire.fromNode, this.container.clientWidth, this.container.clientHeight);
      } else if (action === 'jump-tgt') {
        this.closePopups();
        this.state.jumpToNode(wire.toNode, this.container.clientWidth, this.container.clientHeight);
      } else if (action === 'insert-node') {
        this.closePopups();
        const fromKey = `${wire.fromNode}::${wire.fromPin}`;
        const toKey = `${wire.toNode}::${wire.toPin}`;
        const p1 = this.pinCoords.get(fromKey);
        const p2 = this.pinCoords.get(toKey);
        const midX = (p1 && p2) ? (p1.x + p2.x) / 2 : this.screenToCanvas(e.clientX, e.clientY).x;
        const midY = (p1 && p2) ? (p1.y + p2.y) / 2 : this.screenToCanvas(e.clientX, e.clientY).y;

        if (window.miliastraQuickSpawner) {
          window.miliastraQuickSpawner.openAt(e.clientX, e.clientY, midX, midY, {
            splitWire: wire
          });
        }
      }
    });

    document.body.appendChild(menu);
    this.activeContextMenu = menu;
  }

  openPinContextMenu(nodeId, pinName, isOutput, isExec, e) {
    this.closePopups();

    const node = this.state.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Find all connected wires for this pin
    const connectedWires = this.state.wires.filter(w => {
      if (isOutput) {
        return w.fromNode === nodeId && w.fromPin === pinName;
      } else {
        return w.toNode === nodeId && w.toPin === pinName;
      }
    });

    const menu = document.createElement('div');
    menu.className = 'wire-context-menu pin-context-menu';

    let listHtml = '';

    if (connectedWires.length === 0) {
      listHtml = `
        <div class="wire-menu-item" style="color: #6c7689; cursor: default;">
          <span class="wire-menu-icon">○</span>
          <span>No active connections</span>
        </div>
      `;
    } else if (connectedWires.length === 1) {
      const wire = connectedWires[0];
      const otherNodeId = isOutput ? wire.toNode : wire.fromNode;
      const otherPinName = isOutput ? wire.toPin : wire.fromPin;
      const otherNode = this.state.nodes.find(n => n.id === otherNodeId);
      const otherTitle = otherNode ? otherNode.name : otherNodeId;

      listHtml = `
        <div class="wire-menu-item danger" data-action="disconnect-single" data-wire-id="${wire.id}">
          <span class="wire-menu-icon">✕</span>
          <span>Disconnect (${otherTitle} [${otherPinName}])</span>
        </div>
        <div class="wire-menu-divider"></div>
        <div class="wire-menu-item" data-action="jump-other" data-node-id="${otherNodeId}">
          <span class="wire-menu-icon">⮎</span>
          <span>Jump to Connected Node (${otherTitle})</span>
        </div>
      `;
    } else {
      listHtml = `
        <div class="wire-menu-item danger" data-action="disconnect-all">
          <span class="wire-menu-icon">✕</span>
          <span>Disconnect All (${connectedWires.length} connections)</span>
        </div>
        <div class="wire-menu-divider"></div>
      `;
      connectedWires.forEach(wire => {
        const otherNodeId = isOutput ? wire.toNode : wire.fromNode;
        const otherPinName = isOutput ? wire.toPin : wire.fromPin;
        const otherNode = this.state.nodes.find(n => n.id === otherNodeId);
        const otherTitle = otherNode ? otherNode.name : otherNodeId;
        listHtml += `
          <div class="wire-menu-item danger" data-action="disconnect-single" data-wire-id="${wire.id}">
            <span class="wire-menu-icon">✕</span>
            <span>Disconnect → ${otherTitle} [${otherPinName}]</span>
          </div>
        `;
      });
    }

    const pinDirection = isOutput ? 'Output' : 'Input';
    const pinTypeLabel = isExec ? 'Exec Flow' : 'Parameter';

    if (window.miliastraCompositeManager && window.miliastraCompositeManager.isEditingComposite()) {
      listHtml += `
        <div class="wire-menu-divider"></div>
        <div class="wire-menu-item" data-action="set-composite-pin" style="color: #F2A93B; font-weight: 600;">
          <span class="wire-menu-icon">❖</span>
          <span>Set as Composite Node Pin</span>
        </div>
      `;
    }

    listHtml += `
      <div class="wire-menu-divider"></div>
      <div class="wire-menu-item" data-action="inspect-node" style="color: #38bdf8;">
        <span class="wire-menu-icon">🔍</span>
        <span>Inspect Node (${node.name})</span>
      </div>
    `;

    menu.innerHTML = `
      <div class="wire-menu-header">
        <div class="wire-menu-title">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="6"/></svg>
          Pin: ${pinName}
        </div>
        <div class="wire-menu-subtitle">${node.name} • ${pinDirection} (${pinTypeLabel})</div>
      </div>
      <div class="wire-menu-list">
        ${listHtml}
      </div>
    `;

    // Calculate viewport bounds
    let x = e.clientX;
    let y = e.clientY;
    const menuW = 260;
    const menuH = 180;
    if (x + menuW > window.innerWidth - 10) x = window.innerWidth - menuW - 10;
    if (y + menuH > window.innerHeight - 10) y = window.innerHeight - menuH - 10;
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    menu.addEventListener('mousedown', (ev) => ev.stopPropagation());
    menu.addEventListener('click', (ev) => {
      const item = ev.target.closest('.wire-menu-item');
      if (!item) return;
      const action = item.dataset.action;

      if (action === 'inspect-node') {
        this.closePopups();
        if (window.miliastraNodeInspector) {
          window.miliastraNodeInspector.open(node);
        }
        return;
      }

      if (action === 'set-composite-pin') {
        this.closePopups();
        if (window.miliastraCompositeManager) {
          window.miliastraCompositeManager.addExposedPin(nodeId, pinName, isOutput, isExec);
        }
        return;
      }

      if (action === 'disconnect-single') {
        const wireId = item.dataset.wireId;
        if (wireId) {
          this.state.removeWire(wireId);
          this.closePopups();
          this.render();
          if (window.miliastraApp && window.miliastraApp.simulator) {
            window.miliastraApp.simulator.log(`Disconnected pin connection on ${node.name} [${pinName}]`, 'info');
          }
        }
      } else if (action === 'disconnect-all') {
        connectedWires.forEach(w => this.state.removeWire(w.id));
        this.closePopups();
        this.render();
        if (window.miliastraApp && window.miliastraApp.simulator) {
          window.miliastraApp.simulator.log(`Disconnected all ${connectedWires.length} wires from ${node.name} [${pinName}]`, 'info');
        }
      } else if (action === 'jump-other') {
        const targetId = item.dataset.nodeId;
        this.closePopups();
        if (targetId) {
          this.state.jumpToNode(targetId, this.container.clientWidth, this.container.clientHeight);
        }
      }
    });

    document.body.appendChild(menu);
    this.activeContextMenu = menu;
  }

  openDataTypePicker(node, pinName, isInput, anchorEl, e) {
    this.closePopups();

    const rect = anchorEl.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.className = 'type-picker-popup';

    const currentType = this.state.getPinType(node.id, pinName, 'generic');
    const isListPin = (!isInput && (pinName === 'List' || pinName.toLowerCase().endsWith('list') || node.blueprintId === 'op_assembly_list' || node.blueprintId === 'exec_list_sorting')) ||
                      (isInput && (pinName === 'List' || pinName.toLowerCase().endsWith('list') || node.blueprintId === 'exec_list_sorting' || node.blueprintId === 'exec_list_iteration_loop'));

    popup.innerHTML = `
      <div class="type-picker-header">
        <div class="type-picker-title">
          <span>Change Data Type</span>
        </div>
        <div class="type-picker-subtitle">Data type is defined as</div>
      </div>
      <div class="type-picker-search">
        <input type="text" class="type-picker-input" placeholder="Search data types..." autofocus />
      </div>
      <div class="type-picker-list"></div>
    `;

    const listEl = popup.querySelector('.type-picker-list');
    const searchInput = popup.querySelector('.type-picker-input');

    const isConvNode = node.blueprintId === 'op_data_type_conversion' || node.name === 'Data Type Conversion';
    const isConvOutput = isConvNode && pinName === 'Output';
    const isConvInput = isConvNode && pinName === 'Input';

    const renderList = (filter = '') => {
      listEl.innerHTML = '';
      const filterLower = String(filter || '').toLowerCase();
      let basePool = DATA_TYPES;
      if (isListPin) {
        basePool = DATA_TYPES.filter(t => t.id === 'list' || t.id.endsWith(' list'));
      } else if (isConvOutput) {
        const allowed = new Set(['bool', 'float', 'string', 'int']);
        basePool = DATA_TYPES.filter(t => allowed.has(t.id));
      } else if (isConvInput) {
        const allowed = new Set(['generic', 'int', 'float', 'entity', 'bool', 'guid', 'vector3', 'faction']);
        basePool = DATA_TYPES.filter(t => allowed.has(t.id));
      }

      const filtered = basePool.filter(t => {
        if (!t) return false;
        const label = String(t.label || t.id || '').toLowerCase();
        const id = String(t.id || '').toLowerCase();
        const desc = String(t.desc || '').toLowerCase();
        return label.includes(filterLower) || id.includes(filterLower) || desc.includes(filterLower);
      });

      if (filtered.length === 0) {
        listEl.innerHTML = `<div style="padding: 10px; color: #7b8599; font-size: 11px; text-align: center;">No matching data types</div>`;
        return;
      }

      filtered.forEach(t => {
        const item = document.createElement('div');
        item.className = `type-picker-item ${currentType === t.id ? 'active' : ''}`;
        item.innerHTML = `
          <span class="type-picker-dot" style="background-color: ${t.color}; color: ${t.color}"></span>
          <div class="type-picker-item-info">
            <span class="type-picker-item-label">${t.label}</span>
            <span class="type-picker-item-desc">${t.desc}</span>
          </div>
          ${currentType === t.id ? '<span class="type-picker-check">✓</span>' : ''}
        `;

        item.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.state.setPinType(node.id, pinName, t.id);
          const nodeEl = this.nodeElements?.get(node.id) || this.nodesLayer?.querySelector(`.node[data-id="${node.id}"]`);
          if (nodeEl) {
            delete nodeEl.dataset.pinsSig;
          }
          this.closePopups();
          this.render();
        });

        listEl.appendChild(item);
      });
    };

    renderList();

    searchInput.addEventListener('input', (ev) => {
      renderList(ev.target.value.trim());
    });
    searchInput.addEventListener('mousedown', (ev) => ev.stopPropagation());
    searchInput.addEventListener('click', (ev) => ev.stopPropagation());

    // Position popup next to anchor
    let x = rect.right + 6;
    let y = rect.top - 10;
    const popW = 230;
    const popH = 280;
    if (x + popW > window.innerWidth - 10) {
      x = rect.left - popW - 6;
    }
    if (y + popH > window.innerHeight - 10) {
      y = window.innerHeight - popH - 10;
    }
    if (y < 10) y = 10;

    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
    popup.addEventListener('mousedown', (ev) => ev.stopPropagation());

    document.body.appendChild(popup);
    this.activePicker = popup;

    setTimeout(() => {
      searchInput.focus();
    }, 20);
  }

  openNodeTypePicker(anchorEl, node) {
    this.closePopups();

    const rect = anchorEl.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.className = 'type-picker-popup';

    const currentType = node.dataType || 'generic';

    popup.innerHTML = `
      <div class="type-picker-header">
        <div class="type-picker-title">
          <span>Set Node Data Type</span>
        </div>
        <div class="type-picker-subtitle">Specializes ${node.name || 'Node'} inputs & outputs</div>
      </div>
      <div class="type-picker-search">
        <input type="text" class="type-picker-input" placeholder="Search data types..." autofocus />
      </div>
      <div class="type-picker-list"></div>
    `;

    const listEl = popup.querySelector('.type-picker-list');
    const searchInput = popup.querySelector('.type-picker-input');

    const isConvNode = node.blueprintId === 'op_data_type_conversion' || node.name === 'Data Type Conversion';

    const renderList = (filter = '') => {
      listEl.innerHTML = '';
      const filterLower = String(filter || '').toLowerCase();
      let basePool = DATA_TYPES;
      if (isConvNode) {
        const allowed = new Set(['bool', 'float', 'string', 'int']);
        basePool = DATA_TYPES.filter(t => allowed.has(t.id));
      }
      const filtered = basePool.filter(t => {
        if (!t) return false;
        const label = String(t.label || t.id || '').toLowerCase();
        const id = String(t.id || '').toLowerCase();
        const desc = String(t.desc || '').toLowerCase();
        return label.includes(filterLower) || id.includes(filterLower) || desc.includes(filterLower);
      });

      if (filtered.length === 0) {
        listEl.innerHTML = `<div style="padding: 10px; color: #7b8599; font-size: 11px; text-align: center;">No matching data types</div>`;
        return;
      }

      filtered.forEach(t => {
        const item = document.createElement('div');
        item.className = `type-picker-item ${currentType === t.id ? 'active' : ''}`;
        item.innerHTML = `
          <span class="type-picker-dot" style="background-color: ${t.color}; color: ${t.color}"></span>
          <div class="type-picker-item-info">
            <span class="type-picker-item-label">${t.label}</span>
            <span class="type-picker-item-desc">${t.desc}</span>
          </div>
          ${currentType === t.id ? '<span class="type-picker-check">✓</span>' : ''}
        `;

        item.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.state.setNodeDataType(node.id, t.id);
          const nodeEl = this.nodeElements?.get(node.id) || this.nodesLayer?.querySelector(`.node[data-id="${node.id}"]`);
          if (nodeEl) {
            delete nodeEl.dataset.pinsSig;
          }
          this.closePopups();
          this.render();
        });

        listEl.appendChild(item);
      });
    };

    renderList();

    searchInput.addEventListener('input', (ev) => {
      renderList(ev.target.value.trim());
    });
    searchInput.addEventListener('mousedown', (ev) => ev.stopPropagation());
    searchInput.addEventListener('click', (ev) => ev.stopPropagation());

    let x = rect.left;
    let y = rect.bottom + 6;
    const popW = 230;
    const popH = 280;
    if (x + popW > window.innerWidth - 10) {
      x = window.innerWidth - popW - 10;
    }
    if (y + popH > window.innerHeight - 10) {
      y = rect.top - popH - 6;
    }
    if (y < 10) y = 10;

    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
    popup.addEventListener('mousedown', (ev) => ev.stopPropagation());

    document.body.appendChild(popup);
    this.activePicker = popup;

    setTimeout(() => {
      searchInput.focus();
    }, 20);
  }

  closePopups() {
    if (this.activePicker) {
      this.activePicker.remove();
      this.activePicker = null;
    }
    if (this.activeContextMenu) {
      this.activeContextMenu.remove();
      this.activeContextMenu = null;
    }
    const leftovers = document.querySelectorAll('.wire-context-menu, .pin-context-menu, .type-picker-popup, .composite-popup-menu');
    for (const el of leftovers) el.remove();
  }

  openNodeContextMenu(e) {
    this.closePopups();
    const selectedNodes = this.state.nodes.filter(n => this.state.selectedNodeIds.has(n.id));
    if (selectedNodes.length === 0) return;

    const hasComposite = selectedNodes.some(n => n.isComposite);

    const menu = document.createElement('div');
    menu.className = 'composite-popup-menu';
    menu.style.left = `${Math.min(e.clientX, window.innerWidth - 240)}px`;
    menu.style.top = `${Math.min(e.clientY, window.innerHeight - 280)}px`;

    menu.innerHTML = `
      ${hasComposite ? `
        <div class="composite-popup-item" data-action="open-composite">
          <span>Open Composite Node</span>
          <span class="composite-popup-shortcut">Double-click</span>
        </div>
        <div class="composite-popup-divider"></div>
      ` : ''}
      <div class="composite-popup-item" data-action="delete">
        <span>Delete</span>
        <span class="composite-popup-shortcut">Delete</span>
      </div>
      <div class="composite-popup-item" data-action="cut">
        <span>Cut</span>
        <span class="composite-popup-shortcut">Ctrl+X</span>
      </div>
      <div class="composite-popup-item" data-action="copy">
        <span>Copy</span>
        <span class="composite-popup-shortcut">Ctrl+C</span>
      </div>
      <div class="composite-popup-item" data-action="disconnect">
        <span>Disconnect Node Connection</span>
        <span class="composite-popup-shortcut"></span>
      </div>
      <div class="composite-popup-item" data-action="notes">
        <span>Notes</span>
        <span class="composite-popup-shortcut"></span>
      </div>
      <div class="composite-popup-divider"></div>
      <div class="composite-popup-item" data-action="generate-composite" style="font-weight: 600; color: #88C0D0;">
        <span>Generate Composite Node</span>
        <span class="composite-popup-shortcut">Ctrl+G</span>
      </div>
    `;

    menu.addEventListener('mousedown', (ev) => ev.stopPropagation());
    menu.addEventListener('click', (ev) => {
      const item = ev.target.closest('.composite-popup-item');
      if (!item) return;
      const action = item.dataset.action;
      this.closePopups();

      if (action === 'open-composite') {
        const compNode = selectedNodes.find(n => n.isComposite);
        if (compNode && window.miliastraCompositeManager) {
          window.miliastraCompositeManager.enterCompositeNode(compNode);
        }
      } else if (action === 'delete') {
        if (typeof this.state.deleteSelected === 'function') {
          this.state.deleteSelected();
        } else {
          this.state.removeSelected();
        }
        this.render();
      } else if (action === 'copy') {
        this.state.copySelected();
      } else if (action === 'cut') {
        if (typeof this.state.cutSelected === 'function') {
          this.state.cutSelected();
        } else {
          this.state.copySelected();
          this.state.removeSelected();
        }
        this.render();
      } else if (action === 'disconnect') {
        const selectedSet = new Set(this.state.selectedNodeIds);
        this.state.wires = this.state.wires.filter(w => !selectedSet.has(w.fromNode) && !selectedSet.has(w.toNode));
        this.state.notify('wires_change');
        this.render();
      } else if (action === 'notes') {
        if (window.miliastraComments && selectedNodes[0]) {
          const target = selectedNodes[0];
          window.miliastraComments.addNote(
            target.x + 20,
            Math.max(20, target.y - 140),
            'Note on ' + (target.name || 'node') + '...',
            target.id
          );
        } else {
          const noteText = prompt('Add comment / note to node:', selectedNodes[0].notes || '');
          if (noteText !== null) {
            selectedNodes[0].notes = noteText;
            this.render();
          }
        }
      } else if (action === 'generate-composite') {
        if (window.miliastraCompositeManager) {
          window.miliastraCompositeManager.createCompositeFromSelection(this.state);
        }
      }
    });

    document.body.appendChild(menu);
    this.activeContextMenu = menu;
  }

  clearCache() {
    this.closePopups();
    this.pinCoords.clear();
    this.pinRelCache.clear();
    for (const [_, el] of this.nodeElements.entries()) {
      el.remove();
    }
    this.nodeElements.clear();
    for (const [_, group] of this.wireElements.entries()) {
      if (group.hitbox) group.hitbox.remove();
      if (group.path) group.path.remove();
    }
    this.wireElements.clear();
    if (this.nodesLayer) {
      this.nodesLayer.innerHTML = '';
    }
  }

  calculateWirePath(x1, y1, x2, y2, isExec) {
    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return '';
    return wasmEngine.calculateWireBezier(x1, y1, x2, y2, this.state.wireStyle);
  }

  attachEvents() {
    // Canvas mouse down: panning, marquee, node dragging, socket interaction
    this.container.addEventListener('mousedown', (e) => {
      // Right-click hold, middle-click, or Alt+Left-click: ALWAYS pan the canvas,
      // even when clicking or hovering directly over a node, socket, or pin!
      if (e.button === 2 || e.button === 1 || (e.button === 0 && e.altKey)) {
        if (e.button === 2) {
          this.rightClickStart = {
            x: e.clientX,
            y: e.clientY,
            targetPin: e.target.closest('.socket, .pin-exec'),
            targetNode: e.target.closest('.miliastra-node'),
            targetControl: e.target.closest('input, select, button, .param-gear, .param-remove-btn')
          };
          this.hasPannedDuringRightClick = false;
        }
        this.isPanning = true;
        this.panStart = { x: e.clientX - this.state.panX, y: e.clientY - this.state.panY };
        document.body.classList.add('is-panning');
        return;
      }

      // Ignore left clicks on controls, popup menus, and wire hitboxes
      if (e.target.closest('input, select, button, .composite-edit-btn, .composite-insp-panel, .param-gear, .param-remove-btn, .type-picker-popup, .wire-context-menu, .wire, .wire-hitbox')) {
        return;
      }

      // Pin / Socket interaction (Left click)
      const socket = e.target.closest('.socket, .pin-exec');
      if (socket) {
        e.stopPropagation();
        if (e.button === 0) {
          this.startWireDrag(socket, e);
        }
        return;
      }

      // Node selection and dragging (Left click only)
      const nodeEl = e.target.closest('.miliastra-node');
      if (nodeEl && e.button === 0) {
        const nid = nodeEl.dataset.nodeId;
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          if (this.state.selectedNodeIds.has(nid)) {
            this.state.selectedNodeIds.delete(nid);
          } else {
            this.state.selectedNodeIds.add(nid);
          }
        } else {
          if (!this.state.selectedNodeIds.has(nid)) {
            this.state.selectedNodeIds.clear();
            this.state.selectedNodeIds.add(nid);
          }
        }
        this.state.selectedWireIds.clear();
        this.nodeElements.forEach((nel, id) => {
          if (this.state.selectedNodeIds.has(id)) {
            nel.classList.add('selected');
          } else {
            nel.classList.remove('selected');
          }
        });

        // Start node drag
        this.draggedNodes = Array.from(this.state.selectedNodeIds).map(id => {
          const n = this.state.nodes.find(x => x.id === id);
          return { id, origX: n.x, origY: n.y };
        });
        this.draggedNodeIdsSet = new Set(this.state.selectedNodeIds);
        this.nodeDragStart = { x: e.clientX, y: e.clientY };
        document.body.classList.add('is-dragging-node');
        return;
      }

      // If commenting mode is active, handle tray drawing or note placement
      if (window.miliastraComments && window.miliastraComments.handleCanvasMouseDown(e)) {
        return;
      }

      // Empty canvas left click: box marquee selection
      if (e.button === 0) {
        this.state.selectedNodeIds.clear();
        this.state.selectedWireIds.clear();
        this.render();

        const rect = this.container.getBoundingClientRect();
        this.isBoxSelecting = true;
        this.boxStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        this.marqueeEl.style.left = `${this.boxStart.x}px`;
        this.marqueeEl.style.top = `${this.boxStart.y}px`;
        this.marqueeEl.style.width = '0px';
        this.marqueeEl.style.height = '0px';
        this.marqueeEl.style.display = 'block';
      }
    });

    let moveRafPending = false;
    let latestMouseEvent = null;

    const processMouseMove = () => {
      moveRafPending = false;
      const e = latestMouseEvent;
      if (!e) return;

      this.lastMouseCanvasPos = this.screenToCanvas(e.clientX, e.clientY);

      // Panning
      if (this.isPanning) {
        if (this.rightClickStart) {
          const dist = Math.hypot(e.clientX - this.rightClickStart.x, e.clientY - this.rightClickStart.y);
          if (dist > 3) {
            this.hasPannedDuringRightClick = true;
          }
        }
        this.state.panX = e.clientX - this.panStart.x;
        this.state.panY = e.clientY - this.panStart.y;
        this.updateTransform();
        return;
      }

      // Node dragging (fluid 120fps hardware-accelerated update)
      if (this.draggedNodes) {
        const dx = (e.clientX - this.nodeDragStart.x) / this.state.zoom;
        const dy = (e.clientY - this.nodeDragStart.y) / this.state.zoom;
        for (const item of this.draggedNodes) {
          const n = this.state.nodes.find(x => x.id === item.id);
          if (n) {
            n.x = Math.round(item.origX + dx);
            n.y = Math.round(item.origY + dy);
            const nodeEl = this.nodeElements.get(n.id);
            if (nodeEl) {
              nodeEl.style.transform = `translate3d(${n.x}px, ${n.y}px, 0)`;
            }
            this.updateNodePinCoordinates(n);
            if (window.miliastraComments) {
              window.miliastraComments.onNodeDragged(n);
            }
          }
        }
        this.renderWires(this.draggedNodeIdsSet);
        if (window.miliastraCompositeManager && window.miliastraCompositeManager.isEditingComposite()) {
          window.miliastraCompositeManager.renderStickingOutPins(true);
        }
        return;
      }

      // Marquee box selection
      if (this.isBoxSelecting) {
        const rect = this.container.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        const x = Math.min(this.boxStart.x, currentX);
        const y = Math.min(this.boxStart.y, currentY);
        const w = Math.abs(currentX - this.boxStart.x);
        const h = Math.abs(currentY - this.boxStart.y);

        this.marqueeEl.style.left = `${x}px`;
        this.marqueeEl.style.top = `${y}px`;
        this.marqueeEl.style.width = `${w}px`;
        this.marqueeEl.style.height = `${h}px`;

        // Check overlapping nodes
        const minCanvas = this.screenToCanvas(rect.left + x, rect.top + y);
        const maxCanvas = this.screenToCanvas(rect.left + x + w, rect.top + y + h);

        this.state.selectedNodeIds.clear();
        for (const n of this.state.nodes) {
          if (n.x + 180 >= minCanvas.x && n.x <= maxCanvas.x &&
              n.y + 120 >= minCanvas.y && n.y <= maxCanvas.y) {
            this.state.selectedNodeIds.add(n.id);
          }
        }
        this.renderNodes();
        return;
      }

      // Wire drag preview
      if (this.activeDragWire) {
        const pos = this.screenToCanvas(e.clientX, e.clientY);
        const p1 = this.activeDragWire.fromPos;
        const isOutput = this.activeDragWire.isOutput;
        const x1 = isOutput ? p1.x : pos.x;
        const y1 = isOutput ? p1.y : pos.y;
        const x2 = isOutput ? pos.x : p1.x;
        const y2 = isOutput ? pos.y : p1.y;

        this.dragWirePath.setAttribute('d', this.calculateWirePath(x1, y1, x2, y2, this.activeDragWire.isExec));
        this.dragWirePath.style.display = 'block';
      }
    };

    window.addEventListener('mousemove', (e) => {
      latestMouseEvent = e;
      if (!moveRafPending) {
        moveRafPending = true;
        requestAnimationFrame(processMouseMove);
      }
    });

    window.addEventListener('mouseup', (e) => {
      document.body.classList.remove('is-dragging-node');
      document.body.classList.remove('is-panning');
      document.body.classList.remove('is-dragging-wire');
      this.draggedNodeIdsSet = null;

      if (this.isPanning) {
        this.isPanning = false;
        // Right click without movement on empty canvas triggers quick spawner!
        if (this.rightClickStart && e.button === 2) {
          const dist = Math.hypot(e.clientX - this.rightClickStart.x, e.clientY - this.rightClickStart.y);
          if (dist < 5 && !this.rightClickStart.targetPin && !this.rightClickStart.targetNode && !this.rightClickStart.targetControl) {
            if (window.miliastraQuickSpawner) {
              const canvasCoord = this.screenToCanvas(e.clientX, e.clientY);
              window.miliastraQuickSpawner.openAt(e.clientX, e.clientY, canvasCoord.x, canvasCoord.y);
            }
          }
        }
        // Retain right-click state briefly so contextmenu handler knows if a pan occurred
        setTimeout(() => {
          this.rightClickStart = null;
          this.hasPannedDuringRightClick = false;
        }, 50);
      }

      if (this.draggedNodes) {
        this.draggedNodes = null;
        this.cachePinPositions();
        this.state.saveSnapshot();
        if (window.miliastraCompositeManager && window.miliastraCompositeManager.isEditingComposite()) {
          window.miliastraCompositeManager.renderStickingOutPins(false);
        }
      }

      if (this.isBoxSelecting) {
        this.isBoxSelecting = false;
        this.marqueeEl.style.display = 'none';
      }

      if (this.activeDragWire) {
        this.finishWireDrag(e);
      }
    });

    // Right-click context menus & canvas fluid right-click
    this.container.addEventListener('contextmenu', (e) => {
      e.preventDefault();

      // If user panned with right-click, suppress context menus
      if (this.hasPannedDuringRightClick) {
        return;
      }

      // Pin / Socket right click: disconnect line menu (only if not panning)
      const pin = e.target.closest('.socket, .pin-exec');
      if (pin) {
        e.stopPropagation();
        const nodeId = pin.dataset.nodeId;
        const pinName = pin.dataset.pinName;
        const isOutput = pin.dataset.isOutput === 'true';
        const isExec = pin.dataset.isExec === 'true';
        this.openPinContextMenu(nodeId, pinName, isOutput, isExec, e);
        return;
      }

      // Node right click: context menu (Cut, Copy, Delete, Disconnect, Generate Composite Node)
      const nodeEl = e.target.closest('.miliastra-node');
      if (nodeEl) {
        e.stopPropagation();
        const nodeId = nodeEl.dataset.nodeId;
        if (!this.state.selectedNodeIds.has(nodeId)) {
          this.state.selectedNodeIds.clear();
          this.state.selectedNodeIds.add(nodeId);
          this.render();
        }
        this.openNodeContextMenu(e);
        return;
      }
    });

    // Double-click to open composite nodes or pins
    this.container.addEventListener('dblclick', (e) => {
      if (e.target.closest('input, select, .param-gear, .param-remove-btn')) return;
      const compNodeEl = e.target.closest('.node-cat-composite, .miliastra-node');
      if (compNodeEl) {
        const nodeId = compNodeEl.dataset.nodeId;
        const targetNode = this.state.nodes.find(n => n.id === nodeId);
        if (targetNode && targetNode.isComposite && window.miliastraCompositeManager) {
          e.preventDefault();
          e.stopPropagation();
          const pinEl = e.target.closest('.socket, .pin-exec, .pin-row');
          const pinName = pinEl ? pinEl.dataset.pinName : null;
          window.miliastraCompositeManager.enterCompositeNode(targetNode, pinName);
        }
      }
    });

    // Mouse wheel zoom (hardware-accelerated, zero DOM rebuild overhead)
    this.container.addEventListener('wheel', (e) => {
      // Priority scrolling for notes and comment trays: in both edit and preview modes, scroll note content and lock canvas zooming
      const noteEl = e.target.closest('.note-bubble, .comment-tray');
      if (noteEl) {
        const scrollTarget = e.target.closest('.note-bubble-textarea, .note-bubble-content, .note-bubble-body, .comment-tray-body') ||
                             noteEl.querySelector('.note-bubble-body, .note-bubble-content, .note-bubble-textarea, .comment-tray-body');
        if (scrollTarget) {
          scrollTarget.scrollTop += e.deltaY;
        }
        e.preventDefault();
        return;
      }

      e.preventDefault();
      const rect = this.container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const oldZoom = this.state.zoom;
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      let newZoom = Math.min(Math.max(oldZoom * factor, 0.25), 2.5);

      // Zoom towards cursor
      this.state.panX = mouseX - (mouseX - this.state.panX) * (newZoom / oldZoom);
      this.state.panY = mouseY - (mouseY - this.state.panY) * (newZoom / oldZoom);
      this.state.zoom = newZoom;

      this.updateTransform();
      if (window.updateZoomDropdown) {
        window.updateZoomDropdown(newZoom);
      }
    }, { passive: false });
  }

  startWireDrag(socket, e) {
    const isExec = socket.dataset.isExec === 'true';
    const isOutput = socket.dataset.isOutput === 'true';
    const nodeId = socket.dataset.nodeId;
    const pinName = socket.dataset.pinName;

    const key = `${nodeId}::${pinName}`;
    let p = this.pinCoords.get(key);
    if (!p) {
      this.cachePinPositions();
      p = this.pinCoords.get(key) || this.screenToCanvas(e.clientX, e.clientY);
    }

    this.activeDragWire = {
      nodeId,
      pinName,
      isExec,
      isOutput,
      fromPos: p
    };

    // Calculate canvas coordinates of cursor immediately so old wire path NEVER flashes
    const mouseCanvas = this.screenToCanvas(e.clientX, e.clientY);
    const x1 = isOutput ? p.x : mouseCanvas.x;
    const y1 = isOutput ? p.y : mouseCanvas.y;
    const x2 = isOutput ? mouseCanvas.x : p.x;
    const y2 = isOutput ? mouseCanvas.y : p.y;

    this.dragWirePath.setAttribute('d', this.calculateWirePath(x1, y1, x2, y2, isExec));
    this.dragWirePath.setAttribute('class', `wire-drag-preview ${isExec ? 'wire-exec' : 'wire-data'}`);
    this.dragWirePath.style.display = 'block';
    document.body.classList.add('is-dragging-wire');
  }

  clearActiveDragWire() {
    this.activeDragWire = null;
    this.dragWirePath.style.display = 'none';
    this.dragWirePath.setAttribute('d', '');
    document.body.classList.remove('is-dragging-wire');
  }

  finishWireDrag(e) {
    document.body.classList.remove('is-dragging-wire');
    const drag = this.activeDragWire;
    if (!drag) return;

    // Find socket under cursor
    const elUnder = document.elementFromPoint(e.clientX, e.clientY);
    const targetSocket = elUnder ? elUnder.closest('.socket, .pin-exec') : null;

    if (targetSocket) {
      this.clearActiveDragWire();
      const targetNodeId = targetSocket.dataset.nodeId;
      const targetPinName = targetSocket.dataset.pinName;
      const targetIsExec = targetSocket.dataset.isExec === 'true';
      const targetIsOutput = targetSocket.dataset.isOutput === 'true';

      // Validate connection
      if (targetNodeId !== drag.nodeId && targetIsExec === drag.isExec && targetIsOutput !== drag.isOutput) {
        const fromNode = drag.isOutput ? drag.nodeId : targetNodeId;
        const fromPin = drag.isOutput ? drag.pinName : targetPinName;
        const toNode = drag.isOutput ? targetNodeId : drag.nodeId;
        const toPin = drag.isOutput ? targetPinName : drag.pinName;

        const added = this.state.addWire(fromNode, fromPin, toNode, toPin, drag.isExec);
        if (added) this.render();
        return;
      }
    } else {
      // Dropped on empty canvas: freeze wire preview at exact drop point & open Quick Spawner
      const canvasCoord = this.screenToCanvas(e.clientX, e.clientY);
      const p1 = drag.fromPos;
      const x1 = drag.isOutput ? p1.x : canvasCoord.x;
      const y1 = drag.isOutput ? p1.y : canvasCoord.y;
      const x2 = drag.isOutput ? canvasCoord.x : p1.x;
      const y2 = drag.isOutput ? canvasCoord.y : p1.y;

      this.dragWirePath.setAttribute('d', this.calculateWirePath(x1, y1, x2, y2, drag.isExec));
      this.dragWirePath.style.display = 'block';

      // Stop active drag tracking so moving mouse over spawner doesn't shift the wire
      const pendingData = {
        fromNode: drag.nodeId,
        fromPin: drag.pinName,
        isExec: drag.isExec,
        isOutput: drag.isOutput
      };
      this.activeDragWire = null;

      if (window.miliastraQuickSpawner) {
        window.miliastraQuickSpawner.openAt(e.clientX, e.clientY, canvasCoord.x, canvasCoord.y, pendingData);
      }
    }
  }

  getCategoryIconSVG(type) {
    switch (type) {
      case 'composite-tri':
      case 'composite':
        return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="5" r="2.8"/><circle cx="6.5" cy="17.5" r="2.8"/><circle cx="17.5" cy="17.5" r="2.8"/><line x1="12" y1="5" x2="6.5" y2="17.5" stroke="currentColor" stroke-width="1.8"/><line x1="12" y1="5" x2="17.5" y2="17.5" stroke="currentColor" stroke-width="1.8"/><line x1="6.5" y1="17.5" x2="17.5" y2="17.5" stroke="currentColor" stroke-width="1.8"/></svg>`;
      case 'cycle-arrows':
        return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-1.19"/><polyline points="2.5 22 2.5 16 8.5 16"/></svg>`;
      case 'flow-snake':
        return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>`;
      case 'branch-split':
        return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="6" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="18" r="3"/><line x1="8.7" y1="10.7" x2="15.3" y2="7.3"/><line x1="8.7" y1="13.3" x2="15.3" y2="16.7"/></svg>`;
      case 'compass-query':
        return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`;
      case 'calc-math':
        return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"/></svg>`;
      default:
        return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="8"/></svg>`;
    }
  }

  getGearIconSVG() {
    return `<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`;
  }
}
