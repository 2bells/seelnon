/**
 * ============================================================================
 * COMPOSITE NODES & SUBGRAPH SYSTEM - Miliastra Wonderland
 * High-performance Composite Node Manager, Subgraph Navigation,
 * Sticking-Out Pin Tags & Live Pin Inspector
 * ============================================================================
 */

import { GraphState } from './graphState.js';
import { CATEGORIES, getNodeBlueprint, PIN_COLORS, registerCustomCompositeNode } from './nodesData.js';

export class CompositeNodeManager {
  constructor(app) {
    this.app = app;
    this.activeCompositeNode = null;
    this.parentState = null;
    this.subgraphState = null;
    this.selectedPinId = null;

    // Pin Merge Mode State (Images 4, 5)
    this.mergeMode = false;
    this.mergeTargetPin = null;
    this.mergeCandidates = new Set();

    // DOM References
    this.breadcrumbEl = null;
    this.watermarkEl = null;
    this.inspectorEl = null;
    this.tagsLayerSvg = null;
    this.tagsLayerDom = null;

    this.init();
  }

  init() {
    window.miliastraCompositeManager = this;

    // Listen for canvas transform changes to reposition sticking-out pins
    window.addEventListener('resize', () => {
      if (this.activeCompositeNode) {
        this.renderStickingOutPins();
      }
    });
  }

  /**
   * Check if user is currently inside a composite node editor
   */
  isEditingComposite() {
    return this.activeCompositeNode !== null;
  }

  /**
   * Helper: Return trifid / cluster SVG icon for Composite Nodes
   */
  getTrifidIconSVG(size = 18, color = 'currentColor') {
    return `
      <svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}">
        <line x1="12" y1="5" x2="6.5" y2="17.5" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>
        <line x1="12" y1="5" x2="17.5" y2="17.5" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>
        <line x1="6.5" y1="17.5" x2="17.5" y2="17.5" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="12" cy="5" r="3.2" fill="${color}"/>
        <circle cx="6.5" cy="17.5" r="3.2" fill="${color}"/>
        <circle cx="17.5" cy="17.5" r="3.2" fill="${color}"/>
      </svg>
    `;
  }

  /**
   * Create a new blank or template Composite Node
   */
  createBlankCompositeNode(x = 300, y = 300, name = 'Create Composite Node') {
    const subState = new GraphState();
    
    // Add default Double Branch node inside starter composite
    const starterNode = {
      id: 'node_starter_' + Date.now().toString(36),
      name: 'Double Branch',
      blueprintId: 'double_branch',
      category: 'flow',
      x: 180,
      y: 140,
      inputValues: {}
    };
    subState.nodes.push(starterNode);

    const compNode = {
      id: 'node_comp_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      name: name,
      blueprintId: 'composite_node',
      category: 'composite',
      isComposite: true,
      x: x,
      y: y,
      compositeCategory: 'Uncategorized Tab',
      compositePins: [
        {
          id: 'pin_in_1',
          index: 1,
          direction: 'input',
          kind: 'exec',
          type: 'exec',
          name: 'execIn',
          originalName: 'execIn',
          hint: '',
          targetNodeId: starterNode.id,
          targetPinName: 'execIn',
          mergedTargets: []
        },
        {
          id: 'pin_out_1',
          index: 1,
          direction: 'output',
          kind: 'exec',
          type: 'exec',
          name: 'Yes',
          originalName: 'Yes',
          hint: '',
          targetNodeId: starterNode.id,
          targetPinName: 'Yes',
          mergedTargets: []
        }
      ],
      subgraph: subState.toJSON()
    };

    return compNode;
  }

  /**
   * Generate Composite Node from selected nodes on main canvas (Image 9)
   */
  createCompositeFromSelection(state = this.app.state) {
    const selectedIds = Array.from(state.selectedNodeIds);
    if (selectedIds.length === 0) {
      if (this.app.showNotice) {
        this.app.showNotice('Please select one or more nodes to create a Composite Node', 'warning');
      }
      return null;
    }

    const selectedSet = new Set(selectedIds);
    const selectedNodes = state.nodes.filter(n => selectedSet.has(n.id));

    // Calculate bounding box center
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    selectedNodes.forEach(n => {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x + 220);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y + 160);
    });
    const centerX = Math.round((minX + maxX) / 2) - 120;
    const centerY = Math.round((minY + maxY) / 2) - 80;

    // Categorize wires
    const internalWires = [];
    const incomingWires = [];
    const outgoingWires = [];

    state.wires.forEach(w => {
      const fromSelected = selectedSet.has(w.fromNode);
      const toSelected = selectedSet.has(w.toNode);

      if (fromSelected && toSelected) {
        internalWires.push({ ...w });
      } else if (!fromSelected && toSelected) {
        incomingWires.push({ ...w });
      } else if (fromSelected && !toSelected) {
        outgoingWires.push({ ...w });
      }
    });

    // Create exposed pins mapping
    const exposedPins = [];
    let inIdx = 1;
    let outIdx = 1;

    // Incoming wires become composite input pins
    const seenInTargets = new Map();
    incomingWires.forEach(w => {
      const key = `${w.toNode}::${w.toPin}`;
      if (!seenInTargets.has(key)) {
        const pinId = `pin_in_${inIdx}`;
        const pin = {
          id: pinId,
          index: inIdx++,
          direction: 'input',
          kind: w.isExec ? 'exec' : 'data',
          type: w.dataType || 'any',
          name: w.toPin === 'execIn' ? 'execIn' : w.toPin,
          originalName: w.toPin,
          hint: w.isExec ? '' : `Input ${w.toPin}`,
          targetNodeId: w.toNode,
          targetPinName: w.toPin,
          mergedTargets: []
        };
        seenInTargets.set(key, pin);
        exposedPins.push(pin);
      }
    });

    // Outgoing wires become composite output pins
    const seenOutTargets = new Map();
    outgoingWires.forEach(w => {
      const key = `${w.fromNode}::${w.fromPin}`;
      if (!seenOutTargets.has(key)) {
        const pinId = `pin_out_${outIdx}`;
        const pin = {
          id: pinId,
          index: outIdx++,
          direction: 'output',
          kind: w.isExec ? 'exec' : 'data',
          type: w.dataType || 'any',
          name: w.fromPin === 'execOut' ? 'execOut' : w.fromPin,
          originalName: w.fromPin,
          hint: '',
          targetNodeId: w.fromNode,
          targetPinName: w.fromPin,
          mergedTargets: []
        };
        seenOutTargets.set(key, pin);
        exposedPins.push(pin);
      }
    });

    // If no exposed pins were detected, create default flow pins
    if (exposedPins.length === 0) {
      exposedPins.push({
        id: 'pin_in_1',
        index: 1,
        direction: 'input',
        kind: 'exec',
        type: 'exec',
        name: 'execIn',
        originalName: 'execIn',
        hint: '',
        targetNodeId: selectedNodes[0].id,
        targetPinName: 'execIn',
        mergedTargets: []
      });
      exposedPins.push({
        id: 'pin_out_1',
        index: 1,
        direction: 'output',
        kind: 'exec',
        type: 'exec',
        name: 'Yes',
        originalName: 'Yes',
        hint: '',
        targetNodeId: selectedNodes[0].id,
        targetPinName: 'Yes',
        mergedTargets: []
      });
    }

    // Offset internal nodes coordinates to fit nicely
    const offsetX = minX - 100;
    const offsetY = minY - 100;
    const copiedNodes = selectedNodes.map(n => ({
      ...n,
      x: Math.max(60, n.x - offsetX),
      y: Math.max(60, n.y - offsetY)
    }));

    // Construct composite node
    const compNode = {
      id: 'node_comp_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      name: 'Create Composite Node',
      blueprintId: 'composite_node',
      category: 'composite',
      isComposite: true,
      x: centerX,
      y: centerY,
      compositeCategory: 'Uncategorized Tab',
      compositePins: exposedPins,
      subgraph: {
        nodes: copiedNodes,
        wires: internalWires
      }
    };

    // Remove selected nodes & internal wires from parent graph
    state.nodes = state.nodes.filter(n => !selectedSet.has(n.id));
    state.wires = state.wires.filter(w => !selectedSet.has(w.fromNode) && !selectedSet.has(w.toNode));

    // Add composite node to parent graph
    state.nodes.push(compNode);

    // Reconnect external wires to the composite node's exposed pins
    incomingWires.forEach(w => {
      const key = `${w.toNode}::${w.toPin}`;
      const exposedPin = seenInTargets.get(key);
      if (exposedPin) {
        state.wires.push({
          id: `wire_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`,
          fromNode: w.fromNode,
          fromPin: w.fromPin,
          toNode: compNode.id,
          toPin: exposedPin.name,
          isExec: exposedPin.kind === 'exec',
          dataType: exposedPin.type
        });
      }
    });

    outgoingWires.forEach(w => {
      const key = `${w.fromNode}::${w.fromPin}`;
      const exposedPin = seenOutTargets.get(key);
      if (exposedPin) {
        state.wires.push({
          id: `wire_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`,
          fromNode: compNode.id,
          fromPin: exposedPin.name,
          toNode: w.toNode,
          toPin: w.toPin,
          isExec: exposedPin.kind === 'exec',
          dataType: exposedPin.type
        });
      }
    });

    state.selectedNodeIds.clear();
    state.selectedNodeIds.add(compNode.id);
    state.notify('composite_generated');

    if (this.app.showNotice) {
      this.app.showNotice(`Generated Composite Node "${compNode.name}" with ${selectedNodes.length} nodes!`, 'success');
    }

    return compNode;
  }

  /**
   * Enter / Open Composite Node Editor (Images 2-8)
   */
  enterCompositeNode(node, focusPinName = null) {
    if (!node || !node.isComposite) return;

    this.activeCompositeNode = node;
    this.parentState = this.app.state;

    // Load or instantiate subgraph GraphState
    const subState = new GraphState();
    if (node.subgraph) {
      subState.fromJSON(node.subgraph);
    } else {
      node.subgraph = { nodes: [], wires: [] };
      subState.fromJSON(node.subgraph);
    }
    subState.name = node.name || 'Composite Subgraph';
    this.subgraphState = subState;

    // Ensure compositePins array exists
    node.compositePins = node.compositePins || [];

    // Switch full app and renderer to subgraph state
    this.app.state = subState;
    this.app.syncStateRefs();
    this.app.renderer.setState(subState);
    this.app.renderer.clearCache();
    this.app.renderer.render();
    this.app.renderGraphTabs();

    if (this.app.workspaceBody) {
      this.app.workspaceBody.classList.add('is-composite-active');
    }

    // Select initial pin if specified or first available
    if (focusPinName) {
      const targetPin = node.compositePins.find(p => p.name === focusPinName || p.originalName === focusPinName);
      this.selectedPinId = targetPin ? targetPin.id : (node.compositePins[0] ? node.compositePins[0].id : null);
    } else {
      this.selectedPinId = node.compositePins.length > 0 ? node.compositePins[0].id : null;
    }

    // Build UI Overlays
    this.buildBreadcrumbUI();
    this.buildWatermarkUI();
    this.buildInspectorPanel();
    this.renderStickingOutPins();

    // Subscribe to subgraph changes to refresh pins and auto-save
    this._subgraphUnsub = subState.subscribe(() => {
      this.renderStickingOutPins();
      if (this.activeCompositeNode) {
        this.activeCompositeNode.subgraph = subState.toJSON();
      }
    });

    if (this.app.showNotice) {
      this.app.showNotice(`Editing Composite Node: ${node.name}`, 'info');
    }
  }

  /**
   * Exit Composite Node and return to parent graph
   */
  exitCompositeNode() {
    if (!this.activeCompositeNode) return;

    // Save subgraph state back into composite node
    if (this.subgraphState) {
      this.activeCompositeNode.subgraph = this.subgraphState.toJSON();
    }

    if (this.activeCompositeNode.name && this.activeCompositeNode.name !== 'Create Composite Node') {
      registerCustomCompositeNode(this.activeCompositeNode, true);
    }

    if (this._subgraphUnsub) {
      this._subgraphUnsub();
      this._subgraphUnsub = null;
    }

    // Remove UI elements
    this.cleanupUI();

    if (this.app.workspaceBody) {
      this.app.workspaceBody.classList.remove('is-composite-active');
    }

    const returningTo = this.parentState;
    this.activeCompositeNode = null;
    this.subgraphState = null;
    this.selectedPinId = null;
    this.mergeMode = false;
    this.mergeTargetPin = null;
    this.mergeCandidates.clear();

    // Restore parent state in full app and renderer
    this.app.state = returningTo;
    this.app.syncStateRefs();
    this.app.renderer.setState(returningTo);
    this.app.renderer.clearCache();
    this.app.renderer.render();
    this.app.renderGraphTabs();
    if (this.app.persistGraphs) this.app.persistGraphs();

    if (this.app.showNotice) {
      this.app.showNotice('Returned to main node graph', 'info');
    }
  }

  /**
   * Build breadcrumb bar at the top of the canvas
   */
  buildBreadcrumbUI() {
    if (this.breadcrumbEl) this.breadcrumbEl.remove();

    const bar = document.createElement('div');
    bar.className = 'composite-breadcrumb-bar';
    bar.addEventListener('mousedown', (e) => e.stopPropagation());
    bar.addEventListener('click', (e) => e.stopPropagation());

    const parentTitle = this.parentState && this.parentState.name ? this.parentState.name : 'Main Graph';
    bar.innerHTML = `
      <button class="composite-back-btn" title="Return to parent graph">
        <span>◀</span> Back to ${parentTitle}
      </button>
      <div class="composite-breadcrumb-text">
        <span class="composite-breadcrumb-sep">/</span>
        <span class="composite-breadcrumb-badge">Composite</span>
        <span class="composite-breadcrumb-active-name">${this.activeCompositeNode.name}</span>
      </div>
    `;

    bar.querySelector('.composite-back-btn').addEventListener('click', () => {
      this.exitCompositeNode();
    });

    this.app.renderer.container.appendChild(bar);
    this.breadcrumbEl = bar;
  }

  /**
   * Watermark at bottom of canvas: "Edit Composite Nodes" (Image 2)
   */
  buildWatermarkUI() {
    if (this.app.renderer && this.app.renderer.watermark) {
      this.app.renderer.watermark.textContent = 'Edit Composite Nodes';
    }
  }

  /**
   * Build Right Inspector Panel for Composite Node (Images 2-8)
   */
  buildInspectorPanel() {
    if (this.inspectorEl) this.inspectorEl.remove();

    const panel = document.createElement('div');
    panel.className = 'composite-inspector-panel';

    panel.addEventListener('mousedown', (e) => e.stopPropagation());
    panel.addEventListener('click', (e) => e.stopPropagation());
    panel.addEventListener('dblclick', (e) => e.stopPropagation());
    panel.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    panel.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });

    const node = this.activeCompositeNode;

    // 1. Header (Icon box + Editable Title + Category Select + Exit button)
    const header = document.createElement('div');
    header.className = 'composite-insp-header';
    header.innerHTML = `
      <div class="composite-insp-iconbox">
        ${this.getTrifidIconSVG(24, '#1A1D24')}
      </div>
      <div class="composite-insp-titles">
        <div class="composite-insp-name-row">
          <input type="text" class="composite-insp-name-input" value="${node.name}" title="Click to rename composite node" />
          <button class="composite-insp-edit-btn" title="Rename">✎</button>
          <button class="composite-insp-close-btn" title="Exit Composite Editor (Esc)" style="background:#363B48;border:1px solid #4C566A;color:#E2E8F0;border-radius:4px;padding:3px 9px;cursor:pointer;font-size:12px;font-weight:700;margin-left:auto;">✕</button>
        </div>
        <select class="composite-insp-category-select">
          <option value="Uncategorized Tab" ${node.compositeCategory === 'Uncategorized Tab' ? 'selected' : ''}>Uncategorized Tab</option>
          <option value="Combat" ${node.compositeCategory === 'Combat' ? 'selected' : ''}>Combat</option>
          <option value="Logic" ${node.compositeCategory === 'Logic' ? 'selected' : ''}>Logic</option>
          <option value="Entity" ${node.compositeCategory === 'Entity' ? 'selected' : ''}>Entity</option>
          <option value="Quest" ${node.compositeCategory === 'Quest' ? 'selected' : ''}>Quest</option>
          <option value="Custom" ${node.compositeCategory === 'Custom' ? 'selected' : ''}>Custom</option>
        </select>
      </div>
    `;

    const nameInput = header.querySelector('.composite-insp-name-input');
    nameInput.addEventListener('input', (e) => {
      node.name = e.target.value;
      if (this.breadcrumbEl) {
        const breadcrumbName = this.breadcrumbEl.querySelector('.composite-breadcrumb-active-name');
        if (breadcrumbName) breadcrumbName.textContent = node.name;
      }
      if (node.name && node.name !== 'Create Composite Node') {
        registerCustomCompositeNode(node, true);
      }
      this.updatePreviewCard();
    });

    header.querySelector('.composite-insp-edit-btn').addEventListener('click', () => {
      nameInput.focus();
      nameInput.select();
    });

    const closeBtn = header.querySelector('.composite-insp-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.exitCompositeNode();
      });
    }

    header.querySelector('.composite-insp-category-select').addEventListener('change', (e) => {
      node.compositeCategory = e.target.value;
      if (node.name && node.name !== 'Create Composite Node') {
        registerCustomCompositeNode(node, true);
      }
    });

    panel.appendChild(header);

    // 2. Preview Section with Live Composite Node Card (Images 2-5, 8)
    const prevSection = document.createElement('div');
    prevSection.className = 'composite-insp-preview-section';
    this.previewContainer = prevSection;
    panel.appendChild(prevSection);

    // 3. Dynamic Lower Section: Merge Banner (if active) + Pin Details Form
    const detailsContainer = document.createElement('div');
    detailsContainer.className = 'composite-insp-details-container';
    this.detailsContainer = detailsContainer;
    panel.appendChild(detailsContainer);

    if (this.app.workspaceBody) {
      this.app.workspaceBody.appendChild(panel);
    } else {
      this.app.renderer.container.appendChild(panel);
    }
    this.inspectorEl = panel;

    // Render preview and form
    this.updatePreviewCard();
    this.updatePinDetailsForm();
  }

  /**
   * Get display color for pin data types
   */
  getPinTypeColor(type) {
    switch (type) {
      case 'integer':
      case 'int':
        return '#81A1C1';
      case 'float':
      case 'number':
        return '#88C0D0';
      case 'string':
        return '#EBCB8B';
      case 'boolean':
      case 'bool':
        return '#BF616A';
      case 'entity':
        return '#A3BE8C';
      case 'vector':
      case 'vector3':
        return '#B48EAD';
      case 'exec':
        return '#ECEFF4';
      default:
        return '#CBD5E1';
    }
  }

  /**
   * Return socket glyph SVG: pointy square/pentagon for exec, circular ring for data
   */
  getSocketGlyphSVG(kind, type, isSelected = false) {
    const strokeColor = isSelected ? '#F2A93B' : (kind === 'exec' ? '#ECEFF4' : this.getPinTypeColor(type));
    if (kind === 'exec') {
      // Pointy square / pentagon pointing right
      return `<svg class="prev-socket-glyph exec" viewBox="0 0 16 16" width="13" height="13">
        <polygon points="2,3 9,3 14,8 9,13 2,13" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linejoin="round"/>
      </svg>`;
    } else {
      // Circular ring socket
      return `<svg class="prev-socket-glyph data" viewBox="0 0 16 16" width="13" height="13">
        <circle cx="8" cy="8" r="4.8" fill="none" stroke="${strokeColor}" stroke-width="2"/>
      </svg>`;
    }
  }

  /**
   * Check if two pins can be merged together
   */
  canMergePins(pinA, pinB) {
    if (!pinA || !pinB) return false;
    if (pinA.id === pinB.id) return false;
    // Must have same direction (input with input, output with output)
    if (pinA.direction !== pinB.direction) return false;
    // Must have same kind (data with data, exec with exec)
    if (pinA.kind !== pinB.kind) return false;
    return true;
  }

  /**
   * Return tag badge HTML for preview card
   */
  getPreviewTagBadgeHTML(pin, isSelected) {
    if (!pin) return '';
    const isLeft = pin.direction === 'input';
    const sideClass = isLeft ? 'badge-left' : 'badge-right';
    const isExec = pin.kind === 'exec';
    const shapeClass = isExec ? 'badge-exec' : 'badge-data';

    if (this.mergeMode && this.mergeTargetPin) {
      if (this.mergeTargetPin.id === pin.id) {
        // The merge target pin (Images 1 & 2): filled amber circle with its index number
        return `<div class="prev-tag-badge ${sideClass} merge-target" title="Merge Target (Pin #${pin.index})">
          ${pin.index}
        </div>`;
      } else if (this.canMergePins(pin, this.mergeTargetPin)) {
        if (this.mergeCandidates.has(pin.id)) {
          // Selected merge candidate (Image 2): amber circle with checkmark
          return `<div class="prev-tag-badge ${sideClass} merge-candidate checked" title="Click to unselect candidate">
            ✓
          </div>`;
        } else {
          // Open hole pin that can be merged with (Image 1): hollow ring with hole in the center
          return `<div class="prev-tag-badge ${sideClass} merge-candidate open-hole" title="Click to merge into ${this.mergeTargetPin.name}">
          </div>`;
        }
      } else {
        // Incompatible pin during merge mode
        return `<div class="prev-tag-badge ${sideClass} ${shapeClass} disabled-merge" title="Cannot merge (different type/direction)">
          ${pin.index}
        </div>`;
      }
    }

    // Normal mode: standard badge with index number (Exec = pointy, Data = circular)
    return `<div class="prev-tag-badge ${sideClass} ${shapeClass} ${isSelected ? 'selected' : ''}" title="Pin #${pin.index}">
      ${pin.index}
    </div>`;
  }

  /**
   * Update the live preview card inside the inspector panel
   */
  updatePreviewCard() {
    if (!this.previewContainer || !this.activeCompositeNode) return;

    const node = this.activeCompositeNode;
    const inputs = (node.compositePins || []).filter(p => p.direction === 'input');
    const outputs = (node.compositePins || []).filter(p => p.direction === 'output');

    let rowsHtml = '';
    const maxRows = Math.max(inputs.length, outputs.length, 1);

    for (let i = 0; i < maxRows; i++) {
      const inPin = inputs[i];
      const outPin = outputs[i];

      const isInputSelected = inPin && (inPin.id === this.selectedPinId);
      const isOutputSelected = outPin && (outPin.id === this.selectedPinId);

      rowsHtml += `
        <div class="prev-pin-row ${isInputSelected || isOutputSelected ? 'selected' : ''}">
          <!-- Left (Input) -->
          <div class="prev-pin-left" data-pin-id="${inPin ? inPin.id : ''}">
            ${inPin ? `
              ${this.getPreviewTagBadgeHTML(inPin, isInputSelected)}
              <div class="prev-socket-box">
                ${this.getSocketGlyphSVG(inPin.kind, inPin.type, isInputSelected)}
              </div>
              <div class="prev-pin-info">
                <span class="prev-pin-label">${inPin.name}</span>
                ${inPin.kind !== 'exec' ? `<div class="prev-param-input">${inPin.hint || 'Input Integer'}</div>` : ''}
              </div>
            ` : ''}
          </div>

          <!-- Right (Output) -->
          <div class="prev-pin-right" data-pin-id="${outPin ? outPin.id : ''}">
            ${outPin ? `
              <div class="prev-pin-info prev-pin-info-right">
                <span class="prev-pin-label">${outPin.name}</span>
              </div>
              <div class="prev-socket-box">
                ${this.getSocketGlyphSVG(outPin.kind, outPin.type, isOutputSelected)}
              </div>
              ${this.getPreviewTagBadgeHTML(outPin, isOutputSelected)}
            ` : ''}
          </div>
        </div>
      `;
    }

    this.previewContainer.innerHTML = `
      <div class="composite-node-preview-card">
        <div class="prev-header">
          ${this.getTrifidIconSVG(16, '#1A1D24')}
          <span>${node.name}</span>
        </div>
        <div class="prev-body">
          ${rowsHtml || '<div style="color: #6c7689; text-align: center; font-size: 11px; padding: 12px 0;">No pins exposed</div>'}
        </div>
      </div>
    `;

    // Add click & right-click context menu listeners to preview rows / tags
    this.previewContainer.querySelectorAll('.prev-pin-left, .prev-pin-right').forEach(el => {
      const pinId = el.dataset.pinId;
      if (!pinId) return;
      const targetPin = (this.activeCompositeNode.compositePins || []).find(p => p.id === pinId);
      if (!targetPin) return;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.mergeMode) {
          if (this.canMergePins(targetPin, this.mergeTargetPin)) {
            this.toggleMergeCandidate(pinId);
          }
        } else {
          this.selectPin(pinId);
        }
      });

      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.mergeMode) return;
        this.selectPin(targetPin.id);
        this.openPinTagContextMenu(targetPin, e);
      });
    });

    const cardEl = this.previewContainer.querySelector('.composite-node-preview-card');
    if (cardEl) {
      cardEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    }
  }

  /**
   * Update Pin Details Section in Inspector (Images 2, 3, 5, 8)
   */
  updatePinDetailsForm() {
    if (!this.detailsContainer || !this.activeCompositeNode) return;

    this.detailsContainer.innerHTML = '';

    // Merge Banner (Images 1 & 2)
    if (this.mergeMode && this.mergeTargetPin) {
      const banner = document.createElement('div');
      banner.className = 'composite-merge-banner';
      banner.innerHTML = `
        <span class="merge-banner-title">Select pins to merge to {${this.mergeTargetPin.name}}</span>
        <div class="merge-banner-actions">
          <button class="merge-banner-btn merge-cancel" title="Cancel merge">✕</button>
          <button class="merge-banner-btn merge-confirm" title="Confirm merge">✓</button>
        </div>
      `;

      banner.querySelector('.merge-cancel').addEventListener('click', (e) => {
        e.stopPropagation();
        this.cancelMerge();
      });
      banner.querySelector('.merge-confirm').addEventListener('click', (e) => {
        e.stopPropagation();
        this.confirmMerge();
      });
      this.detailsContainer.appendChild(banner);
      return; // In merge mode, banner is the primary control (Images 1 & 2)
    }

    const pin = (this.activeCompositeNode.compositePins || []).find(p => p.id === this.selectedPinId);

    if (!pin) {
      const noPin = document.createElement('div');
      noPin.className = 'composite-no-pin';
      noPin.textContent = 'No pin selected';
      this.detailsContainer.appendChild(noPin);
      return;
    }

    // Pin Details Card (Images 3, 5, 8)
    const card = document.createElement('div');
    card.className = 'composite-pin-details';

    // Find source node name in subgraph
    let sourceNodeName = 'Node';
    if (this.subgraphState) {
      const srcNode = this.subgraphState.nodes.find(n => n.id === pin.targetNodeId);
      if (srcNode) sourceNodeName = srcNode.name;
    }

    card.innerHTML = `
      <div class="composite-pin-title-row">
        <span class="composite-pin-title-text">
          ${pin.direction === 'input' ? 'Input Pin' : 'Output Pin'} (${pin.index})
        </span>
        <button class="composite-pin-options-btn" title="Pin options">···</button>
      </div>

      <!-- Comes from -->
      <div class="composite-form-row">
        <span class="composite-form-label">Comes from</span>
        <div class="composite-comes-from-badge">
          <span>❖</span>
          <span>${sourceNodeName}</span>
        </div>
      </div>

      <!-- Original Pin Name -->
      <div class="composite-form-row">
        <span class="composite-form-label">Original Pin Name</span>
        <span style="font-size: 12px; color: #CBD5E1; font-weight: 500;">
          ${pin.originalName || 'Default Exec'}
        </span>
      </div>

      <!-- Custom Pin Name -->
      <div class="composite-form-row">
        <span class="composite-form-label">Custom Pin Name</span>
        <input type="text" class="composite-form-input pin-custom-name-input" value="${pin.name || ''}" placeholder="Enter pin name" />
      </div>

      <!-- Parameter Box Hint -->
      ${pin.kind !== 'exec' ? `
        <div class="composite-form-row">
          <span class="composite-form-label">Parameter Box Hint</span>
          <input type="text" class="composite-form-input pin-hint-input" value="${pin.hint || ''}" placeholder="Input Integer" />
        </div>
      ` : ''}

      <!-- Pins Merged Section (Image 5) -->
      ${pin.mergedTargets && pin.mergedTargets.length > 0 ? `
        <div class="composite-merged-section">
          <div class="composite-merged-title">Pins merged</div>
          ${pin.mergedTargets.map((m, idx) => `
            <div class="composite-merged-item">
              <div class="composite-merged-info">
                <span>❖</span>
                <span>${m.nodeName || 'Node'}</span>
                <span style="color: #8C97AC;">${m.pinName}</span>
              </div>
              <button class="composite-unmerge-btn" data-unmerge-idx="${idx}" title="Unmerge pin">✕</button>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;

    // Input handlers
    const nameInput = card.querySelector('.pin-custom-name-input');
    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        pin.name = e.target.value;
        this.updatePreviewCard();
        this.renderStickingOutPins();
      });
    }

    const hintInput = card.querySelector('.pin-hint-input');
    if (hintInput) {
      hintInput.addEventListener('input', (e) => {
        pin.hint = e.target.value;
        this.updatePreviewCard();
      });
    }

    // Options button (···) opens pin context menu (Image 6)
    card.querySelector('.composite-pin-options-btn').addEventListener('click', (e) => {
      this.openPinTagContextMenu(pin, e);
    });

    // Unmerge buttons
    card.querySelectorAll('.composite-unmerge-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.dataset.unmergeIdx, 10);
        this.unmergePin(pin.id, idx);
      });
    });

    this.detailsContainer.appendChild(card);
  }

  /**
   * Select a pin to highlight in inspector and on canvas
   */
  selectPin(pinId) {
    this.selectedPinId = pinId;
    this.updatePreviewCard();
    this.updatePinDetailsForm();
    this.renderStickingOutPins();
  }

  /**
   * Render sticking-out pins layer directly inside canvas stage (Images 2, 3, 4, 5, 7, 8)
   */
  renderStickingOutPins(isDragging = false) {
    if (!this.activeCompositeNode || !this.app.renderer || !this.app.renderer.stage) return;

    // Create or reuse SVG & DOM layers inside renderer stage, placed BEFORE nodesLayer
    // so node boxes stay in front and pins/lines remain behind the boxes!
    if (!this.tagsLayerSvg) {
      this.tagsLayerSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.tagsLayerSvg.setAttribute('class', 'composite-pin-tag-layer composite-svg-layer');
      if (this.app.renderer.nodesLayer && this.app.renderer.nodesLayer.parentNode === this.app.renderer.stage) {
        this.app.renderer.stage.insertBefore(this.tagsLayerSvg, this.app.renderer.nodesLayer);
      } else {
        this.app.renderer.stage.appendChild(this.tagsLayerSvg);
      }
    } else if (this.app.renderer.nodesLayer && this.tagsLayerSvg.parentElement === this.app.renderer.stage) {
      // Ensure SVG layer stays behind nodesLayer
      if (this.app.renderer.nodesLayer.previousElementSibling !== this.tagsLayerSvg && this.tagsLayerSvg !== this.tagsLayerDom?.previousElementSibling) {
        this.app.renderer.stage.insertBefore(this.tagsLayerSvg, this.app.renderer.nodesLayer);
      }
    }

    if (!this.tagsLayerDom) {
      this.tagsLayerDom = document.createElement('div');
      this.tagsLayerDom.className = 'composite-pin-tag-layer composite-dom-layer';
      if (this.app.renderer.nodesLayer && this.app.renderer.nodesLayer.parentNode === this.app.renderer.stage) {
        this.app.renderer.stage.insertBefore(this.tagsLayerDom, this.app.renderer.nodesLayer);
      } else {
        this.app.renderer.stage.appendChild(this.tagsLayerDom);
      }
    } else if (this.app.renderer.nodesLayer && this.tagsLayerDom.parentElement === this.app.renderer.stage) {
      // Ensure DOM tag layer stays behind nodesLayer
      if (this.app.renderer.nodesLayer.previousElementSibling !== this.tagsLayerDom) {
        this.app.renderer.stage.insertBefore(this.tagsLayerDom, this.app.renderer.nodesLayer);
      }
    }

    this.tagsLayerSvg.innerHTML = '';
    this.tagsLayerDom.innerHTML = '';

    const pins = this.activeCompositeNode.compositePins || [];
    if (!isDragging) {
      this.app.renderer.cachePinPositions();
    }

    pins.forEach(pin => {
      const isSelected = pin.id === this.selectedPinId;
      const isInput = pin.direction === 'input';
      const isMergeTarget = this.mergeMode && this.mergeTargetPin && this.mergeTargetPin.id === pin.id;
      const canMergeWithTarget = this.mergeMode && this.mergeTargetPin && this.canMergePins(pin, this.mergeTargetPin);

      // All sockets that belong to this composite pin (primary + any merged targets)
      // "after the merge, pins stay visually attached, but they have same ID number"
      const allSockets = [
        { nodeId: pin.targetNodeId, pinName: pin.targetPinName, isPrimary: true },
        ...(pin.mergedTargets || [])
      ];

      allSockets.forEach(sock => {
        // Find socket coordinates
        const key = `${sock.nodeId}::${sock.pinName}`;
        let p = this.app.renderer.pinCoords.get(key);

        if (!p) {
          const targetNode = this.subgraphState ? this.subgraphState.nodes.find(n => n.id === sock.nodeId) : null;
          if (targetNode) {
            const cached = this.app.renderer.pinRelCache ? this.app.renderer.pinRelCache.get(key) : null;
            const relX = cached ? cached.relX : (isInput ? 8 : 198);
            const relY = cached ? cached.relY : 60;
            p = { x: targetNode.x + relX, y: targetNode.y + relY };
          } else {
            const sel = `.socket[data-node-id="${sock.nodeId}"][data-pin-name="${sock.pinName}"], .pin-exec[data-node-id="${sock.nodeId}"][data-pin-name="${sock.pinName}"]`;
            const el = this.app.renderer.stage.querySelector(sel);
            if (el) {
              const rect = el.getBoundingClientRect();
              p = this.app.renderer.screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2);
            }
          }
        }

        if (!p) return;

        const isExec = pin.kind === 'exec';
        const shapeClass = isExec ? 'tag-exec' : 'tag-data';

        // Compact line length: 18px
        const tagLineLen = 18;
        const tagW = isExec ? 26 : 22; // Exec tag is 26px wide, Data circle tag is 22px wide
        const tagX = isInput ? (p.x - tagLineLen - tagW) : (p.x + tagLineLen);
        const tagY = p.y - 11; // 22px badge height / 2 = 11

        let badgeClass = `sticking-pin-tag ${isInput ? 'tag-input' : 'tag-output'} ${shapeClass}`;
        let wireClass = 'sticking-wire-path';
        let displayContent = `${pin.index}`;
        let isClickableForMerge = false;

        if (this.mergeMode && this.mergeTargetPin) {
          if (isMergeTarget) {
            badgeClass += ' merge-target';
            wireClass += ' selected';
            displayContent = `${pin.index}`;
          } else if (canMergeWithTarget) {
            isClickableForMerge = true;
            if (this.mergeCandidates.has(pin.id)) {
              badgeClass += ' merge-candidate checked';
              wireClass += ' selected';
              displayContent = '✓';
            } else {
              badgeClass += ' merge-candidate open-hole';
              wireClass += ' open-hole';
              displayContent = '';
            }
          } else {
            badgeClass += ' disabled-merge';
          }
        } else {
          // Normal mode: all sockets belonging to this pin share the SAME pin index!
          if (isSelected) {
            badgeClass += ' selected';
            wireClass += ' selected';
          }
        }

        // Draw SVG straight connecting wire behind node box
        const wirePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        wirePath.setAttribute('class', wireClass);
        const pathD = isInput ? `M ${tagX + tagW} ${p.y} L ${p.x} ${p.y}` : `M ${p.x} ${p.y} L ${tagX} ${p.y}`;
        wirePath.setAttribute('d', pathD);
        this.tagsLayerSvg.appendChild(wirePath);

        // Create Tag Badge Element
        const tag = document.createElement('div');
        tag.className = badgeClass;
        tag.style.left = `${tagX}px`;
        tag.style.top = `${tagY}px`;
        tag.title = `${pin.name} (Pin #${pin.index})${sock.isPrimary ? '' : ' [Merged]'}`;
        tag.textContent = displayContent;

        tag.addEventListener('mousedown', (e) => {
          e.stopPropagation();
        });

        tag.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.mergeMode) {
            if (isClickableForMerge) {
              this.toggleMergeCandidate(pin.id);
            }
          } else {
            this.selectPin(pin.id);
          }
        });

        tag.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (this.mergeMode) return;
          this.selectPin(pin.id);
          this.openPinTagContextMenu(pin, e);
        });

        this.tagsLayerDom.appendChild(tag);
      });
    });
  }

  /**
   * Context Menu for Sticking Out Pin Tag or preview (Matches Image 1 reference)
   */
  openPinTagContextMenu(pin, e) {
    this.closePopups();

    const sameDirPins = (this.activeCompositeNode.compositePins || []).filter(p => p.direction === pin.direction);
    const dirIdx = sameDirPins.findIndex(p => p.id === pin.id);
    const canMoveUp = dirIdx > 0;
    const canMoveDown = dirIdx >= 0 && dirIdx < sameDirPins.length - 1;

    const menu = document.createElement('div');
    menu.className = 'composite-popup-menu';
    
    const menuW = 210;
    const menuH = 175;
    const posX = Math.min(e.clientX, window.innerWidth - menuW - 10);
    const posY = Math.min(e.clientY, window.innerHeight - menuH - 10);
    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;

    menu.innerHTML = `
      <div class="composite-popup-item" data-action="view">
        <span>View in Node Graph</span>
      </div>
      <div class="composite-popup-item ${canMoveUp ? '' : 'disabled'}" data-action="up">
        <span>Move Up</span>
      </div>
      <div class="composite-popup-item ${canMoveDown ? '' : 'disabled'}" data-action="down">
        <span>Move Down</span>
      </div>
      <div class="composite-popup-item" data-action="merge">
        <span>Merge Pins</span>
      </div>
      <div class="composite-popup-item danger" data-action="hide">
        <span>Hide Display on Composite Node</span>
      </div>
    `;

    menu.addEventListener('mousedown', (ev) => ev.stopPropagation());
    menu.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    });

    menu.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const item = ev.target.closest('.composite-popup-item');
      if (!item || item.classList.contains('disabled')) return;
      const action = item.dataset.action;
      this.closePopups();

      if (action === 'view') {
        this.focusNodeInGraph(pin.targetNodeId);
      } else if (action === 'up') {
        this.reorderPin(pin.id, -1);
      } else if (action === 'down') {
        this.reorderPin(pin.id, 1);
      } else if (action === 'merge') {
        this.startMergeMode(pin);
      } else if (action === 'hide') {
        this.removeExposedPin(pin.id);
      }
    });

    document.body.appendChild(menu);
    this.activeMenu = menu;

    // Dismiss listener on window in CAPTURE phase so ANY click anywhere on the page
    // (canvas, inspector, empty space, nodes) immediately closes the popup!
    this._outsidePopupListener = (ev) => {
      if (this.activeMenu && !this.activeMenu.contains(ev.target)) {
        this.closePopups();
      }
    };
    this._outsidePopupKeyHandler = (ev) => {
      if (ev.key === 'Escape') {
        this.closePopups();
      }
    };

    setTimeout(() => {
      if (!this.activeMenu) return;
      window.addEventListener('pointerdown', this._outsidePopupListener, true);
      window.addEventListener('contextmenu', this._outsidePopupListener, true);
      window.addEventListener('keydown', this._outsidePopupKeyHandler, true);
    }, 15);
  }

  /**
   * Focus and center the canvas onto a specific node inside composite
   */
  focusNodeInGraph(nodeId) {
    if (!this.subgraphState || !this.app.renderer) return;
    const node = this.subgraphState.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const container = this.app.renderer.container;
    const rect = container.getBoundingClientRect();

    this.subgraphState.panX = (rect.width / 2) - (node.x + 100) * this.subgraphState.zoom;
    this.subgraphState.panY = (rect.height / 2) - (node.y + 80) * this.subgraphState.zoom;

    this.subgraphState.selectedNodeIds.clear();
    this.subgraphState.selectedNodeIds.add(node.id);

    this.app.renderer.updateTransform();
    this.app.renderer.render();
    this.renderStickingOutPins();
  }

  /**
   * Reorder a pin up or down within its direction group (inputs vs outputs)
   */
  reorderPin(pinId, direction) {
    if (!this.activeCompositeNode || !this.activeCompositeNode.compositePins) return;
    const pins = this.activeCompositeNode.compositePins;
    const targetPin = pins.find(p => p.id === pinId);
    if (!targetPin) return;

    // Filter indices of pins with same direction
    const sameDirIndices = [];
    pins.forEach((p, idx) => {
      if (p.direction === targetPin.direction) sameDirIndices.push(idx);
    });

    const curPos = sameDirIndices.findIndex(idx => pins[idx].id === pinId);
    if (curPos === -1) return;
    const newPos = curPos + direction;
    if (newPos < 0 || newPos >= sameDirIndices.length) return;

    const idxA = sameDirIndices[curPos];
    const idxB = sameDirIndices[newPos];

    // Swap in main array
    const temp = pins[idxA];
    pins[idxA] = pins[idxB];
    pins[idxB] = temp;

    // Renumber indices
    this.renumberPins();
    this.updatePreviewCard();
    this.updatePinDetailsForm();
    this.renderStickingOutPins();
  }

  /**
   * Renumber pin indices (1, 2, 3...) per direction and kind (Exec vs Data)
   * Matches Images 1, 2, 3 reference (Exec input 1, Data inputs 1, 2, 3; Exec output 1, 2)
   */
  renumberPins() {
    let inExecCount = 1;
    let inDataCount = 1;
    let outExecCount = 1;
    let outDataCount = 1;
    (this.activeCompositeNode.compositePins || []).forEach(p => {
      if (p.direction === 'input') {
        if (p.kind === 'exec') {
          p.index = inExecCount++;
        } else {
          p.index = inDataCount++;
        }
      } else {
        if (p.kind === 'exec') {
          p.index = outExecCount++;
        } else {
          p.index = outDataCount++;
        }
      }
    });
  }

  /**
   * Expose a pin as a composite node pin (Image 7, 8)
   */
  addExposedPin(nodeId, pinName, isOutput, isExec, dataType = 'any') {
    if (!this.activeCompositeNode) return;

    const pins = this.activeCompositeNode.compositePins = this.activeCompositeNode.compositePins || [];

    // Check if already exposed
    const existing = pins.find(p => p.targetNodeId === nodeId && p.targetPinName === pinName);
    if (existing) {
      this.selectPin(existing.id);
      return existing;
    }

    const direction = isOutput ? 'output' : 'input';
    const sameDirPins = pins.filter(p => p.direction === direction);
    const nextIdx = sameDirPins.length + 1;
    const pinId = `pin_${direction}_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`;

    const newPin = {
      id: pinId,
      index: nextIdx,
      direction: direction,
      kind: isExec ? 'exec' : 'data',
      type: dataType,
      name: pinName,
      originalName: pinName,
      hint: isExec ? '' : `Input ${pinName}`,
      targetNodeId: nodeId,
      targetPinName: pinName,
      mergedTargets: []
    };

    pins.push(newPin);
    this.renumberPins();
    this.selectPin(newPin.id);

    if (this.app.showNotice) {
      this.app.showNotice(`Exposed pin "${pinName}" as Composite Pin #${newPin.index}`, 'success');
    }

    return newPin;
  }

  /**
   * Remove / un-expose pin from composite node
   */
  removeExposedPin(pinId) {
    if (!this.activeCompositeNode) return;
    this.activeCompositeNode.compositePins = (this.activeCompositeNode.compositePins || []).filter(p => p.id !== pinId);
    this.renumberPins();

    if (this.selectedPinId === pinId) {
      this.selectedPinId = this.activeCompositeNode.compositePins.length > 0 ? this.activeCompositeNode.compositePins[0].id : null;
    }

    this.updatePreviewCard();
    this.updatePinDetailsForm();
    this.renderStickingOutPins();
  }

  /**
   * Start Pin Merge Mode (Image 4)
   */
  startMergeMode(targetPin) {
    this.mergeMode = true;
    this.mergeTargetPin = targetPin;
    this.mergeCandidates.clear();

    this.updatePreviewCard();
    this.updatePinDetailsForm();
    this.renderStickingOutPins();

    if (this.app.showNotice) {
      this.app.showNotice(`Select pins to merge into "${targetPin.name}"`, 'info');
    }
  }

  /**
   * Toggle candidate pin during merge mode
   */
  toggleMergeCandidate(pinId) {
    if (!this.mergeMode || !this.mergeTargetPin) return;
    if (pinId === this.mergeTargetPin.id) return; // Can't merge into itself

    if (this.mergeCandidates.has(pinId)) {
      this.mergeCandidates.delete(pinId);
    } else {
      this.mergeCandidates.add(pinId);
    }

    this.updatePreviewCard();
    this.renderStickingOutPins();
  }

  /**
   * Confirm Pin Merge (Image 5)
   */
  confirmMerge() {
    if (!this.mergeMode || !this.mergeTargetPin || this.mergeCandidates.size === 0) {
      this.cancelMerge();
      return;
    }

    const targetPin = this.mergeTargetPin;
    targetPin.mergedTargets = targetPin.mergedTargets || [];

    this.mergeCandidates.forEach(candId => {
      const candPin = this.activeCompositeNode.compositePins.find(p => p.id === candId);
      if (candPin) {
        // Find node name
        let nName = 'Node';
        if (this.subgraphState) {
          const n = this.subgraphState.nodes.find(x => x.id === candPin.targetNodeId);
          if (n) nName = n.name;
        }

        targetPin.mergedTargets.push({
          nodeId: candPin.targetNodeId,
          nodeName: nName,
          pinName: candPin.targetPinName,
          type: candPin.type,
          kind: candPin.kind
        });

        // Also absorb any previously merged targets of candidate
        if (candPin.mergedTargets && candPin.mergedTargets.length > 0) {
          candPin.mergedTargets.forEach(m => targetPin.mergedTargets.push(m));
        }

        // Remove candidate as separate exposed pin
        this.activeCompositeNode.compositePins = this.activeCompositeNode.compositePins.filter(p => p.id !== candId);
      }
    });

    this.mergeMode = false;
    this.mergeTargetPin = null;
    this.mergeCandidates.clear();

    this.renumberPins();
    this.updatePreviewCard();
    this.updatePinDetailsForm();
    this.renderStickingOutPins();

    if (this.app.showNotice) {
      this.app.showNotice(`Pins merged! All merged sockets share Pin #${targetPin.index}`, 'success');
    }
  }

  /**
   * Cancel Pin Merge
   */
  cancelMerge() {
    this.mergeMode = false;
    this.mergeTargetPin = null;
    this.mergeCandidates.clear();

    this.updatePreviewCard();
    this.updatePinDetailsForm();
    this.renderStickingOutPins();
  }

  /**
   * Unmerge a single target from a merged pin and restore it as its own pin
   */
  unmergePin(pinId, targetIndex) {
    const pin = (this.activeCompositeNode.compositePins || []).find(p => p.id === pinId);
    if (!pin || !pin.mergedTargets || targetIndex < 0 || targetIndex >= pin.mergedTargets.length) return;

    const [removed] = pin.mergedTargets.splice(targetIndex, 1);
    if (removed) {
      this.addExposedPin(removed.nodeId, removed.pinName, pin.direction === 'output', pin.kind === 'exec', removed.type || pin.type);
    }

    this.renumberPins();
    this.updatePreviewCard();
    this.updatePinDetailsForm();
    this.renderStickingOutPins();

    if (this.app.showNotice) {
      this.app.showNotice('Target pin unmerged and restored', 'info');
    }
  }

  /**
   * Close any open popups or context menus
   */
  closePopups() {
    if (this._outsidePopupListener) {
      window.removeEventListener('pointerdown', this._outsidePopupListener, true);
      window.removeEventListener('contextmenu', this._outsidePopupListener, true);
      this._outsidePopupListener = null;
    }
    if (this._outsidePopupKeyHandler) {
      window.removeEventListener('keydown', this._outsidePopupKeyHandler, true);
      this._outsidePopupKeyHandler = null;
    }
    if (this.activeMenu) {
      this.activeMenu.remove();
      this.activeMenu = null;
    }
  }

  /**
   * Remove all composite editor UI overlays
   */
  cleanupUI() {
    this.closePopups();
    if (this.app.renderer && this.app.renderer.watermark) {
      this.app.renderer.watermark.textContent = 'Edit Server Node Graph';
    }
    if (this.breadcrumbEl) {
      this.breadcrumbEl.remove();
      this.breadcrumbEl = null;
    }
    if (this.watermarkEl) {
      this.watermarkEl.remove();
      this.watermarkEl = null;
    }
    if (this.inspectorEl) {
      this.inspectorEl.remove();
      this.inspectorEl = null;
    }
    if (this.tagsLayerSvg) {
      this.tagsLayerSvg.remove();
      this.tagsLayerSvg = null;
    }
    if (this.tagsLayerDom) {
      this.tagsLayerDom.remove();
      this.tagsLayerDom = null;
    }
  }
}
