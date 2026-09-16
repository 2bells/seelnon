/**
 * Graph State Management
 * Handles node instances, wires, connections, undo/redo history, and selection.
 */

import { getNodeBlueprint, parseNodeBlueprintAndType, applyDataTypeToNode, CATEGORIES, registerCustomCompositeNode } from './nodesData.js';
import { signalsManager, getPinTypeFromSignalType } from './signalsManager.js';

let nextNodeId = 1;
let nextWireId = 1;

export class GraphState {
  constructor(name = 'Open_Garage', type = 'Server', id = null) {
    this.id = id || ('graph_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
    this.folderId = 'root';
    this.name = name;
    this.type = type; // 'Server' or 'Client'
    this.nodes = [];
    this.wires = [];
    this.selectedNodeIds = new Set();
    this.selectedWireIds = new Set();
    
    // History for Undo / Redo
    this.history = [];
    this.historyIndex = -1;
    this.listeners = new Set();

    // Canvas view transform
    this.zoom = 1.0;
    this.panX = 40;
    this.panY = 60;
    this.wireStyle = 'curved'; // 'curved' | 'orthogonal'

    // Node Graph Variables (persist inside this graph, as in Miliastra Wonderland)
    this.nodeGraphVariables = [
      { id: 'var_1', name: 'HP', type: 'int', defaultValue: '0', value: '0' },
      { id: 'var_2', name: 'Attacked', type: 'bool', defaultValue: 'False', value: 'False' },
      { id: 'var_3', name: 'Damage', type: 'float', defaultValue: '0.0', value: '0.0' }
    ];

    // Comment Trays and Text Bubble Notes
    this.comments = []; // [{ id, title, x, y, width, height, collapsed, color, collapsedNodeIds }]
    this.notes = [];    // [{ id, text, x, y, width, height, attachedNodeId, attachedOffset, color, isMinimized, isEditing }]

    // Subscribe to global signal updates
    this.signalUnsub = signalsManager.subscribe((event, data) => {
      this.notify('signals_changed');
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(changeType = 'general') {
    for (const l of this.listeners) {
      l(changeType, this);
    }
  }

  // Serializable snapshot used for local persistence (localStorage cache) and
  // for rebuilding a graph without losing nodes/wires/variables/comments/notes.
  toJSON() {
    return {
      version: 1,
      id: this.id,
      folderId: this.folderId || 'root',
      name: this.name,
      type: this.type,
      nodes: this.nodes,
      wires: this.wires,
      nodeGraphVariables: this.nodeGraphVariables,
      comments: this.comments || [],
      notes: this.notes || [],
      signals: signalsManager.serialize(),
      panX: this.panX,
      panY: this.panY,
      zoom: this.zoom
    };
  }

  static fromJSON(obj) {
    const g = new GraphState((obj && obj.name) || 'Noda', (obj && obj.type) || 'Server', (obj && obj.id) || null);
    if (obj && obj.folderId) g.folderId = obj.folderId;
    if (obj && Array.isArray(obj.nodes)) {
      g.nodes = obj.nodes;
      // Auto-register any custom composite nodes into registry
      g.nodes.forEach(n => {
        if (n && n.isComposite && n.name && n.name !== 'Create Composite Node') {
          registerCustomCompositeNode(n, true);
        }
      });
    }
    if (obj && Array.isArray(obj.wires)) g.wires = obj.wires;
    if (obj && Array.isArray(obj.nodeGraphVariables)) g.nodeGraphVariables = obj.nodeGraphVariables;
    if (obj && Array.isArray(obj.comments)) g.comments = obj.comments;
    if (obj && Array.isArray(obj.notes)) g.notes = obj.notes;
    if (obj && obj.signals && Array.isArray(obj.signals)) signalsManager.deserialize(obj.signals);
    if (obj && typeof obj.panX === 'number') g.panX = obj.panX;
    if (obj && typeof obj.panY === 'number') g.panY = obj.panY;
    if (obj && typeof obj.zoom === 'number') g.zoom = obj.zoom;
    return g;
  }

  saveSnapshot() {
    // Truncate future if branching
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    const snap = JSON.stringify({
      nodes: this.nodes,
      wires: this.wires,
      nodeGraphVariables: this.nodeGraphVariables,
      comments: this.comments || [],
      notes: this.notes || []
    });
    this.history.push(snap);
    if (this.history.length > 50) this.history.shift();
    this.historyIndex = this.history.length - 1;
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const snap = JSON.parse(this.history[this.historyIndex]);
      this.nodes = snap.nodes;
      this.wires = snap.wires;
      if (snap.nodeGraphVariables) {
        this.nodeGraphVariables = snap.nodeGraphVariables;
      }
      this.comments = snap.comments || [];
      this.notes = snap.notes || [];
      this.selectedNodeIds.clear();
      this.selectedWireIds.clear();
      this.notify('undo');
      return true;
    }
    return false;
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const snap = JSON.parse(this.history[this.historyIndex]);
      this.nodes = snap.nodes;
      this.wires = snap.wires;
      if (snap.nodeGraphVariables) {
        this.nodeGraphVariables = snap.nodeGraphVariables;
      }
      this.comments = snap.comments || [];
      this.notes = snap.notes || [];
      this.selectedNodeIds.clear();
      this.selectedWireIds.clear();
      this.notify('redo');
      return true;
    }
    return false;
  }

  // Node Graph Variables API
  getNodeGraphVariables() {
    return [...(this.nodeGraphVariables || [])];
  }

  getNodeGraphVariableByName(name) {
    if (!name) return null;
    return (this.nodeGraphVariables || []).find(v => v.name.toLowerCase() === name.toLowerCase()) || null;
  }

  addNodeGraphVariable(name = '', type = 'string', defaultValue = '') {
    this.nodeGraphVariables = this.nodeGraphVariables || [];
    let cleanName = name.trim();
    if (!cleanName) {
      cleanName = `Var_${this.nodeGraphVariables.length + 1}`;
    }

    // Ensure unique name
    let finalName = cleanName;
    let counter = 1;
    while (this.nodeGraphVariables.some(v => v.name.toLowerCase() === finalName.toLowerCase())) {
      finalName = `${cleanName}_${counter++}`;
    }

    let defVal = defaultValue;
    if (defVal === '') {
      if (type === 'int') defVal = '0';
      else if (type === 'float') defVal = '0.0';
      else if (type === 'bool') defVal = 'False';
      else if (type === 'vector3') defVal = '(0, 0, 0)';
      else if (type === 'string') defVal = '';
      else defVal = '';
    }

    const newVar = {
      id: `var_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: finalName,
      type,
      defaultValue: String(defVal),
      value: String(defVal)
    };

    this.nodeGraphVariables.push(newVar);
    this.saveSnapshot();
    this.notify('node_vars_changed');
    return newVar;
  }

  updateNodeGraphVariable(id, updates = {}) {
    const v = (this.nodeGraphVariables || []).find(item => item.id === id);
    if (!v) return false;

    const oldName = v.name;
    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (trimmed && (!updates.forceUnique || !this.nodeGraphVariables.some(other => other.id !== id && other.name.toLowerCase() === trimmed.toLowerCase()))) {
        v.name = trimmed;
      }
    }

    if (updates.type !== undefined) {
      v.type = updates.type;
    }
    if (updates.defaultValue !== undefined) {
      v.defaultValue = String(updates.defaultValue);
      if (v.value === undefined || v.value === '') {
        v.value = v.defaultValue;
      }
    }
    if (updates.value !== undefined) {
      v.value = String(updates.value);
    }

    // If name changed, optionally update node references
    if (oldName && v.name !== oldName) {
      this.nodes.forEach(node => {
        if ((node.blueprintId === 'query_get_node_graph_var' || node.blueprintId === 'exec_set_node_graph_var') &&
            node.inputValues && node.inputValues['Variable Name'] === oldName) {
          node.inputValues['Variable Name'] = v.name;
        }
      });
    }

    this.saveSnapshot();
    this.notify('node_vars_changed');
    return true;
  }

  removeNodeGraphVariable(id) {
    this.nodeGraphVariables = (this.nodeGraphVariables || []).filter(v => v.id !== id);
    this.saveSnapshot();
    this.notify('node_vars_changed');
  }

  setNodeGraphVariableValue(name, val, triggerEvent = true) {
    const v = this.getNodeGraphVariableByName(name);
    if (!v) return false;
    v.value = String(val);
    this.notify('node_var_value_changed');
    return true;
  }

  createNode(blueprintId, x = 200, y = 200, customData = {}) {
    const parsed = parseNodeBlueprintAndType(blueprintId);
    const bp = parsed.blueprint || getNodeBlueprint(blueprintId);
    if (!bp) return null;

    // Specialized Composite Node creation (blank or custom composite node like "Test")
    if (bp.category === 'composite' || bp.id === 'composite_node' || bp.isComposite || customData.isComposite) {
      const compId = `node_comp_${Date.now()}_${nextNodeId++}`;
      const starterId = `node_starter_${Date.now()}_1`;
      
      const isCustomBp = bp.isComposite && bp.compositePins && bp.compositePins.length > 0;
      const initialPins = customData.compositePins 
        ? JSON.parse(JSON.stringify(customData.compositePins))
        : (isCustomBp ? JSON.parse(JSON.stringify(bp.compositePins)) : [
          {
            id: 'pin_in_1',
            index: 1,
            direction: 'input',
            kind: 'exec',
            type: 'exec',
            name: 'execIn',
            originalName: 'execIn',
            hint: '',
            targetNodeId: starterId,
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
            targetNodeId: starterId,
            targetPinName: 'Yes',
            mergedTargets: []
          }
        ]);

      const initialSubgraph = customData.subgraph 
        ? JSON.parse(JSON.stringify(customData.subgraph))
        : (isCustomBp && bp.subgraph ? JSON.parse(JSON.stringify(bp.subgraph)) : {
          nodes: [
            {
              id: starterId,
              name: 'Double Branch',
              blueprintId: 'double_branch',
              category: 'flow',
              x: 180,
              y: 140,
              inputValues: {}
            }
          ],
          wires: []
        });

      const compInstance = {
        id: compId,
        blueprintId: bp.id || 'composite_node',
        name: customData.name || bp.name || 'Create Composite Node',
        category: 'composite',
        isComposite: true,
        compositeCategory: customData.compositeCategory || bp.compositeCategory || 'Uncategorized Tab',
        compositePins: initialPins,
        subgraph: initialSubgraph,
        x: Math.round(x),
        y: Math.round(y),
        inputValues: customData.inputValues || {}
      };

      // Register custom composite definition so it stays known
      if (compInstance.name && compInstance.name !== 'Create Composite Node') {
        registerCustomCompositeNode(compInstance, true);
      }

      this.nodes.push(compInstance);
      this.saveSnapshot();
      this.notify('node_add');
      return compInstance;
    }

    const id = (customData && customData.id && !this.nodes.some(n => n.id === customData.id))
      ? customData.id
      : `node_${Date.now()}_${nextNodeId++}`;
    const inputValues = {};
    if (bp.inputs) {
      for (const inp of bp.inputs) {
        inputValues[inp.name] = inp.defaultVal !== undefined ? inp.defaultVal : (inp.options ? inp.options[0] : '');
      }
    }

    const detectedDataType = customData.dataType || parsed.dataType || null;

    const nodeInstance = {
      id,
      blueprintId: bp.id,
      name: bp.name,
      category: bp.category,
      dataType: detectedDataType,
      x: Math.round(x),
      y: Math.round(y),
      inputValues: { ...inputValues, ...customData.inputValues },
      pinTypes: { ...(customData.pinTypes || {}) },
      varName: customData.varName || null,
      guidAlias: customData.guidAlias || null,
      alias: customData.alias || null,
      dynamicInputs: customData.dynamicInputs || (bp.canAddDynamicInputs ? ['0'] : []),
      dynamicBranches: customData.dynamicBranches || (bp.canAddDynamicBranches ? ['Branch 0', 'Branch 1', 'Branch 2', 'Default'] : null),
      branchValues: customData.branchValues || {},
      customProps: customData.customProps || {}
    };

    if (bp && detectedDataType) {
      applyDataTypeToNode(nodeInstance, bp, detectedDataType);
    }

    // Default signal name for signal nodes if not explicitly specified
    if (bp.id === 'event_monitor_signal' || bp.id === 'exec_send_signal') {
      if (!nodeInstance.inputValues['Signal Name']) {
        nodeInstance.inputValues['Signal Name'] = '';
      }
    }

    this.nodes.push(nodeInstance);
    this.saveSnapshot();
    this.notify('node_add');
    return nodeInstance;
  }

  // Change which signal a Monitor/Send node is bound to. Swapping signals must
  // not leave "ghost" data wires behind: outputs that the new signal no longer
  // exposes (e.g. HC_Shot's Origin/Damage after switching to HC_Reload) are
  // auto-disconnected so stale pins don't leak into the other signal.
  setSignalNode(nodeId, signalName) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const prev = node.inputValues?.['Signal Name'] ?? node.signalName;
    if (prev === signalName) return;

    node.inputValues = node.inputValues || {};
    node.inputValues['Signal Name'] = signalName || '';
    node.signalName = signalName || '';

    // Allowed output pins for the new signal: the blueprint's fixed outputs plus
    // the signal's own payload params.
    const bp = getNodeBlueprint(node.blueprintId) || getNodeBlueprint(node.name);
    const allowed = new Set((bp && bp.outputs || []).map(o => o.name));
    const def = signalName ? signalsManager.getSignal(signalName) : null;
    if (def && Array.isArray(def.params)) def.params.forEach(p => allowed.add(p.name));

    for (const w of [...this.wires]) {
      // Only prune DATA wires leaving this signal node to pins it no longer has.
      if (w.fromNode === nodeId && !w.isExec && !allowed.has(w.fromPin)) {
        this.removeWire(w.id);
      }
    }

    this.saveSnapshot();
    this.notify('signal_changed');
  }

  removeNode(nodeId) {
    const affectedTgtNodes = new Set();
    this.wires.forEach(w => {
      if (w.fromNode === nodeId && !w.isExec) affectedTgtNodes.add(w.toNode);
    });
    this.nodes = this.nodes.filter(n => n.id !== nodeId);
    // Remove attached wires
    this.wires = this.wires.filter(w => w.fromNode !== nodeId && w.toNode !== nodeId);
    this.selectedNodeIds.delete(nodeId);
    affectedTgtNodes.forEach(tn => this.refreshNodePinTypes(tn));
    this.saveSnapshot();
    this.notify('node_remove');
  }

  removeSelected() {
    if (this.selectedNodeIds.size === 0 && this.selectedWireIds.size === 0) return;
    const affectedTgtNodes = new Set();
    this.wires.forEach(w => {
      if ((this.selectedWireIds.has(w.id) || this.selectedNodeIds.has(w.fromNode)) && !w.isExec) {
        affectedTgtNodes.add(w.toNode);
      }
    });
    this.nodes = this.nodes.filter(n => !this.selectedNodeIds.has(n.id));
    this.wires = this.wires.filter(w => 
      !this.selectedWireIds.has(w.id) &&
      !this.selectedNodeIds.has(w.fromNode) &&
      !this.selectedNodeIds.has(w.toNode)
    );
    this.selectedNodeIds.clear();
    this.selectedWireIds.clear();
    affectedTgtNodes.forEach(tn => this.refreshNodePinTypes(tn));
    this.saveSnapshot();
    this.notify('selection_removed');
  }

  duplicateSelected(offsetX = 40, offsetY = 40) {
    if (this.selectedNodeIds.size === 0) return;
    this.copySelected();
    this.paste({ x: null, y: null }, offsetX, offsetY);
  }

  copySelected() {
    if (this.selectedNodeIds.size === 0) return null;
    const copiedNodes = [];
    const copiedIdSet = new Set();

    for (const nid of this.selectedNodeIds) {
      const orig = this.nodes.find(n => n.id === nid);
      if (!orig) continue;
      copiedNodes.push(JSON.parse(JSON.stringify(orig)));
      copiedIdSet.add(nid);
    }

    // Also copy wires between copied nodes
    const copiedWires = this.wires
      .filter(w => copiedIdSet.has(w.fromNode) && copiedIdSet.has(w.toNode))
      .map(w => JSON.parse(JSON.stringify(w)));

    this.clipboard = {
      nodes: copiedNodes,
      wires: copiedWires,
      pasteCount: 0
    };

    return this.clipboard;
  }

  paste(targetPos = null, overrideOffsetX = null, overrideOffsetY = null) {
    if (!this.clipboard || !this.clipboard.nodes || this.clipboard.nodes.length === 0) {
      return [];
    }

    this.clipboard.pasteCount++;
    const step = this.clipboard.pasteCount * 30;
    const offsetX = overrideOffsetX !== null ? overrideOffsetX : step;
    const offsetY = overrideOffsetY !== null ? overrideOffsetY : step;

    let minX = Infinity;
    let minY = Infinity;
    for (const n of this.clipboard.nodes) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
    }

    const oldToNew = new Map();
    const newNodes = [];

    for (const orig of this.clipboard.nodes) {
      const newId = `node_${Date.now()}_${nextNodeId++}`;
      oldToNew.set(orig.id, newId);

      let newX, newY;
      if (targetPos && targetPos.x !== null && targetPos.y !== null) {
        newX = Math.round(targetPos.x + (orig.x - minX) + (this.clipboard.pasteCount > 1 ? (this.clipboard.pasteCount - 1) * 20 : 0));
        newY = Math.round(targetPos.y + (orig.y - minY) + (this.clipboard.pasteCount > 1 ? (this.clipboard.pasteCount - 1) * 20 : 0));
      } else {
        newX = Math.round(orig.x + offsetX);
        newY = Math.round(orig.y + offsetY);
      }

      const clone = {
        ...JSON.parse(JSON.stringify(orig)),
        id: newId,
        x: newX,
        y: newY
      };
      newNodes.push(clone);
    }

    this.nodes.push(...newNodes);

    // Recreate internal wires between copied nodes
    if (this.clipboard.wires) {
      for (const w of this.clipboard.wires) {
        const newFrom = oldToNew.get(w.fromNode);
        const newTo = oldToNew.get(w.toNode);
        if (newFrom && newTo) {
          const newWire = {
            id: `wire_${Date.now()}_${nextWireId++}`,
            fromNode: newFrom,
            fromPin: w.fromPin,
            toNode: newTo,
            toPin: w.toPin,
            isExec: w.isExec
          };
          this.wires.push(newWire);
        }
      }
    }

    this.selectedNodeIds.clear();
    this.selectedWireIds.clear();
    for (const n of newNodes) {
      this.selectedNodeIds.add(n.id);
    }

    this.saveSnapshot();
    this.notify('nodes_pasted');
    return newNodes;
  }

  addWire(fromNode, fromPin, toNode, toPin, isExec = false) {
    // Avoid duplicates
    const exists = this.wires.some(w => 
      w.toNode === toNode && w.toPin === toPin && (!isExec || w.fromNode === fromNode)
    );
    if (exists) {
      // If data pin, replace existing incoming wire because an input socket only accepts one data driver
      if (!isExec) {
        this.wires = this.wires.filter(w => !(w.toNode === toNode && w.toPin === toPin));
      }
    }

    // Type-matching on data wires. Rules (matching the game):
    //  - A socket with a fixed concrete type rejects a source of a different type
    //    (int can't feed a float socket, and vice versa).
    //  - A Generic socket accepts any source and inherits the source's type.
    //  - For Equal / comparison / arithmetic nodes the two inputs always share one
    //    type and change together (both are set to the incoming source type).
    if (!isExec) {
      const srcNode = this.nodes.find(n => n.id === fromNode);
      const tgtNode = this.nodes.find(n => n.id === toNode);
      if (srcNode && tgtNode) {
        const srcBp = getNodeBlueprint(srcNode.blueprintId);
        const tgtBp = getNodeBlueprint(tgtNode.blueprintId);

        let srcType = 'generic';
        if (srcNode.pinTypes && srcNode.pinTypes[fromPin]) {
          srcType = srcNode.pinTypes[fromPin];
        } else if (srcBp?.id === 'op_assembly_list' && fromPin === 'List') {
          srcType = srcNode.pinTypes?.['List'] || (srcNode.dataType ? `${srcNode.dataType} list` : 'generic list');
        } else if (srcBp && srcBp.outputs) {
          const outDef = srcBp.outputs.find(o => o.name === fromPin);
          if (outDef && outDef.type) srcType = outDef.type;
        }

        // Special backward inheritance for Data Type Conversion node
        const isSrcConversion = (srcBp?.id === 'op_data_type_conversion' || (srcNode.name || '').toLowerCase() === 'data type conversion') && fromPin === 'Output';
        const isTgtConversion = (tgtBp?.id === 'op_data_type_conversion' || (tgtNode.name || '').toLowerCase() === 'data type conversion') && toPin === 'Input';

        if (isSrcConversion && (srcType === 'generic' || !srcNode.dataType || srcNode.dataType === 'generic')) {
          const tgtCurrentType = this.getPinType(toNode, toPin, 'generic');
          if (tgtCurrentType && tgtCurrentType !== 'generic' && ['int', 'float', 'bool', 'string'].includes(tgtCurrentType)) {
            srcNode.dataType = tgtCurrentType;
            if (!srcNode.pinTypes) srcNode.pinTypes = {};
            srcNode.pinTypes['Output'] = tgtCurrentType;
            applyDataTypeToNode(srcNode, srcBp, tgtCurrentType);
            srcType = tgtCurrentType;
          }
        }

        if (isTgtConversion && srcType && srcType !== 'generic') {
          if (!tgtNode.pinTypes) tgtNode.pinTypes = {};
          tgtNode.pinTypes['Input'] = srcType;
        }

        if (srcType && srcType !== 'generic') {
          const tgtCurrentType = this.getPinType(toNode, toPin, 'generic');
          const tgtInDef = (tgtBp?.inputs || []).find(i => i.name === toPin);
          const isListTargetPin = toPin === 'List' || toPin === 'Target List' || toPin === 'Iteration List' || toPin === 'Input List';
          const isTgtGeneric = tgtCurrentType === 'generic' || 
                                tgtInDef?.type === 'generic' || 
                                tgtInDef?.hasGear === true || 
                                isListTargetPin ||
                                (tgtCurrentType.endsWith('list') && (srcType.endsWith('list') || srcType === 'list')) || 
                                (tgtInDef?.type === 'list' && (srcType.endsWith('list') || srcType === 'list')) || 
                                (tgtBp?.id === 'op_assembly_list') || 
                                (tgtBp?.id === 'exec_list_sorting') || 
                                (tgtBp?.id === 'exec_list_iteration_loop') ||
                                (tgtBp?.id === 'exec_concatenate_list');

          // A concrete (non-generic) target socket only accepts a matching source.
          if (!isTgtGeneric && tgtCurrentType !== 'generic' && tgtCurrentType !== srcType) {
            return null; // reject mismatched concrete types
          }

          if (!tgtNode.pinTypes) tgtNode.pinTypes = {};
          tgtNode.pinTypes[toPin] = srcType;

          const isPairOp =
            tgtBp && ['op_equal', 'op_not_equal', 'op_greater_than', 'op_less_than',
              'op_greater_than_or_equal_to', 'op_less_than_or_equal_to',
              'op_addition', 'op_subtraction', 'op_multiplication', 'op_division',
              'op_modulo_operation', 'op_exponentiation', 'op_take_larger', 'op_take_smaller']
              .includes(tgtBp.id);

          const isLoopOp = tgtBp && (tgtBp.id === 'exec_list_iteration_loop' || tgtBp.id.includes('list_iteration_loop'));
          const isSortOp = tgtBp && (tgtBp.id === 'exec_list_sorting' || tgtBp.id.includes('list_sorting'));
          const isConcatOp = tgtBp && (tgtBp.id === 'exec_concatenate_list' || tgtBp.id.includes('concatenate_list'));
          const isAssemblyOp = tgtBp && (tgtBp.id === 'op_assembly_list' || tgtBp.id.includes('assembly_list'));

          // 1. Equal / comparison / arithmetic: both inputs (and Result) change together.
          if (isPairOp) {
            tgtNode.dataType = srcType;
            applyDataTypeToNode(tgtNode, tgtBp, srcType);
          } 
          // 2. Assembly List dynamic slots
          else if (isAssemblyOp) {
            const elemType = srcType.replace(/\s+list$/i, '').trim() || srcType;
            tgtNode.dataType = elemType;
            applyDataTypeToNode(tgtNode, tgtBp, elemType);
          }
          // 3. Local Variable Bond ("holding hands")
          else if ((srcBp?.id === 'query_get_local_variable' || srcNode.name === 'Get Local Variable') &&
                   (tgtBp?.id === 'exec_set_local_var' || tgtNode.name === 'Set Local Variable') &&
                   fromPin === 'Local Variable' && toPin === 'Local Variable') {
            const chosenType = srcNode.dataType || tgtNode.dataType || srcType || 'generic';
            if (chosenType && chosenType !== 'generic') {
              srcNode.dataType = chosenType;
              tgtNode.dataType = chosenType;
              if (srcBp) applyDataTypeToNode(srcNode, srcBp, chosenType);
              if (tgtBp) applyDataTypeToNode(tgtNode, tgtBp, chosenType);
            }
          }
          // 3. List Sorting
          else if (isSortOp && (toPin === 'List' || toPin === 'Sorted List')) {
            const listType = srcType.endsWith('list') ? srcType : `${srcType} list`;
            const elemType = srcType.replace(/\s+list$/i, '').trim();
            tgtNode.dataType = elemType;
            tgtNode.pinTypes['List'] = listType;
            tgtNode.pinTypes['Sorted List'] = listType;
          }
          // 4. List Iteration Loop
          else if (isLoopOp && toPin === 'List') {
            const listType = srcType.endsWith('list') ? srcType : `${srcType} list`;
            const elemType = srcType.replace(/\s+list$/i, '').trim() || 'generic';
            tgtNode.dataType = elemType === 'generic' ? null : elemType;
            tgtNode.pinTypes['List'] = listType;
            tgtNode.pinTypes['Value'] = elemType;
          }
          // 5. Concatenate List
          else if (isConcatOp) {
            const listType = srcType.endsWith('list') ? srcType : `${srcType} list`;
            const elemType = srcType.replace(/\s+list$/i, '').trim();
            tgtNode.dataType = elemType;
            tgtNode.pinTypes['Target List'] = listType;
            tgtNode.pinTypes['List'] = listType;
            tgtNode.pinTypes['Combined List'] = listType;
          }
        }
      }
    }

    const wire = {
      id: `wire_${Date.now()}_${nextWireId++}`,
      fromNode,
      fromPin,
      toNode,
      toPin,
      isExec
    };

    this.wires.push(wire);
    this.saveSnapshot();
    this.notify('wire_add');
    return wire;
  }

  removeWire(wireId) {
    const wire = this.wires.find(w => w.id === wireId);
    this.wires = this.wires.filter(w => w.id !== wireId);
    this.selectedWireIds.delete(wireId);
    if (wire && !wire.isExec) {
      this.refreshNodePinTypes(wire.toNode);
    }
    this.saveSnapshot();
    this.notify('wire_remove');
  }

  refreshNodePinTypes(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const bp = getNodeBlueprint(node.blueprintId) || getNodeBlueprint(node.name);
    if (!bp) return;

    const isPairOp = ['op_equal', 'op_not_equal', 'op_greater_than', 'op_less_than',
      'op_greater_than_or_equal_to', 'op_less_than_or_equal_to',
      'op_addition', 'op_subtraction', 'op_multiplication', 'op_division',
      'op_modulo_operation', 'op_exponentiation', 'op_take_larger', 'op_take_smaller']
      .includes(bp.id);

    const isLoopOp = bp.id === 'exec_list_iteration_loop' || bp.id.includes('list_iteration_loop');

    if (isPairOp) {
      const inWires = this.wires.filter(w => !w.isExec && w.toNode === nodeId);
      let detectedType = null;
      for (const w of inWires) {
        const srcType = this.getPinType(w.fromNode, w.fromPin, 'generic');
        if (srcType && srcType !== 'generic') {
          detectedType = srcType;
          break;
        }
      }
      if (detectedType) {
        if (!node.pinTypes) node.pinTypes = {};
        (bp.inputs || []).forEach(inp => {
          if (inp.hasGear || inp.type === 'generic') node.pinTypes[inp.name] = detectedType;
        });
        (bp.outputs || []).forEach(out => {
          if (out.hasGear || out.type === 'generic') node.pinTypes[out.name] = detectedType;
        });
      } else {
        if (node.pinTypes) {
          (bp.inputs || []).forEach(inp => {
            if (inp.hasGear || inp.type === 'generic') delete node.pinTypes[inp.name];
          });
          (bp.outputs || []).forEach(out => {
            if (out.hasGear || out.type === 'generic') delete node.pinTypes[out.name];
          });
        }
      }
    } else if (isLoopOp) {
      const listWire = this.wires.find(w => !w.isExec && w.toNode === nodeId && w.toPin === 'List');
      if (listWire) {
        const srcType = this.getPinType(listWire.fromNode, listWire.fromPin, 'generic');
        if (srcType && srcType !== 'generic') {
          if (!node.pinTypes) node.pinTypes = {};
          node.pinTypes['List'] = srcType;
          const elemType = srcType.replace(/\s+list$/i, '').trim() || 'generic';
          node.dataType = elemType === 'generic' ? null : elemType;
          node.pinTypes['Value'] = elemType;
        }
      } else {
        if (node.pinTypes) {
          node.pinTypes['List'] = 'list';
          node.pinTypes['Value'] = 'generic';
          node.dataType = null;
        }
      }
    }
  }

  setInputValue(nodeId, pinName, value, triggerNotify = true) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (node) {
      node.inputValues[pinName] = value;
      if (triggerNotify) {
        this.saveSnapshot();
        this.notify('value_change');
      }
    }
  }

  // Dynamically configure parameter data type (gear icon)
  setPinType(nodeId, pinName, newType) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.pinTypes) node.pinTypes = {};
    node.pinTypes[pinName] = newType;

    const bp = getNodeBlueprint(node.blueprintId) || getNodeBlueprint(node.name);
    if (bp) {
      if (bp.id === 'op_data_type_conversion' || bp.id.includes('data_type_conversion')) {
        if (pinName === 'Output') {
          node.dataType = newType;
        }
      } else {
        applyDataTypeToNode(node, bp, newType);
      }
    }

    this.saveSnapshot();
    this.notify('pin_type_change');
  }

  // Set the specialized data type for an entire node (e.g. Equal -> Entity, Addition -> Float)
  setNodeDataType(nodeId, newType) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return false;
    node.dataType = newType;
    const bp = getNodeBlueprint(node.blueprintId) || getNodeBlueprint(node.name);
    if (bp && newType) {
      applyDataTypeToNode(node, bp, newType);
    }

    // Synchronize paired Local Variable nodes ("holding hands")
    if (node.blueprintId === 'query_get_local_variable' || node.name === 'Get Local Variable') {
      const pairWire = this.wires.find(w => !w.isExec && w.fromNode === node.id && w.fromPin === 'Local Variable');
      if (pairWire) {
        const setNode = this.nodes.find(n => n.id === pairWire.toNode);
        if (setNode && setNode.dataType !== newType) {
          setNode.dataType = newType;
          const setBp = getNodeBlueprint(setNode.blueprintId) || getNodeBlueprint(setNode.name);
          if (setBp) applyDataTypeToNode(setNode, setBp, newType);
        }
      }
    } else if (node.blueprintId === 'exec_set_local_var' || node.name === 'Set Local Variable') {
      const pairWire = this.wires.find(w => !w.isExec && w.toNode === node.id && w.toPin === 'Local Variable');
      if (pairWire) {
        const getNode = this.nodes.find(n => n.id === pairWire.fromNode);
        if (getNode && getNode.dataType !== newType) {
          getNode.dataType = newType;
          const getBp = getNodeBlueprint(getNode.blueprintId) || getNodeBlueprint(getNode.name);
          if (getBp) applyDataTypeToNode(getNode, getBp, newType);
        }
      }
    }

    this.saveSnapshot();
    this.notify('node_type_changed');
    return true;
  }

  getPinType(nodeId, pinName, defaultType = 'generic') {
    const node = this.nodes.find(n => n.id === nodeId);
    if (node && node.pinTypes && node.pinTypes[pinName]) {
      return node.pinTypes[pinName];
    }

    // Dynamic signal parameters support
    if (node && (node.blueprintId === 'event_monitor_signal' || node.blueprintId === 'exec_send_signal')) {
      const sigName = node.inputValues?.['Signal Name'] || node.inputValues?.['signalName'];
      if (sigName) {
        const sig = signalsManager.getSignal(sigName);
        if (sig && sig.params) {
          const param = sig.params.find(p => p.name === pinName);
          if (param) {
            return getPinTypeFromSignalType(param.type);
          }
        }
      }
    }

    // Dynamic Node Graph Variable pin type support
    if (node && (node.blueprintId === 'query_get_node_graph_var' || node.blueprintId === 'exec_set_node_graph_var')) {
      if (pinName === 'Variable Value') {
        const varName = node.inputValues?.['Variable Name'];
        if (varName) {
          const v = this.getNodeGraphVariableByName(varName);
          if (v && v.type) {
            return v.type;
          }
        }
      }
    }

    // Data Type Conversion pin type resolution
    if (node && (node.blueprintId === 'op_data_type_conversion' || node.name === 'Data Type Conversion')) {
      if (pinName === 'Output') {
        return node.pinTypes?.['Output'] || node.dataType || 'generic';
      }
      if (pinName === 'Input') {
        return node.pinTypes?.['Input'] || 'generic';
      }
    }

    const lowerName = String(pinName || '').toLowerCase();
    const isListPin = lowerName === 'list' || lowerName === 'sorted list' || lowerName.includes('list') || lowerName.includes('target list') || lowerName.includes('input list') || lowerName.includes('iteration list') || lowerName.includes('weight list') || lowerName.includes('id list');
    if (isListPin && node && node.dataType && node.dataType !== 'generic') {
      return `${node.dataType} list`;
    }
    if (isListPin && defaultType === 'generic') {
      return 'list';
    }
    if (node) {
      const bp = getNodeBlueprint(node.blueprintId);
      if (bp) {
        if (bp.id === 'exec_list_iteration_loop' || bp.id.includes('list_iteration_loop')) {
          if (pinName === 'Value') {
            return (node.dataType && node.dataType !== 'generic') ? node.dataType : 'generic';
          }
          if (pinName === 'List') {
            return (node.dataType && node.dataType !== 'generic') ? `${node.dataType} list` : 'list';
          }
        }
        const inp = (bp.inputs || []).find(i => i.name === pinName);
        if (inp && inp.type) {
          if (inp.type === 'list' || isListPin) {
            return (node.dataType && node.dataType !== 'generic') ? `${node.dataType} list` : 'list';
          }
          return inp.type;
        }
        const out = (bp.outputs || []).find(o => o.name === pinName);
        if (out && out.type) {
          if (out.type === 'list' || isListPin) {
            return (node.dataType && node.dataType !== 'generic') ? `${node.dataType} list` : 'list';
          }
          return out.type;
        }
      }
    }
    return defaultType;
  }

  // Dynamic list manipulation (Assembly List)
  addDynamicInput(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.dynamicInputs = node.dynamicInputs || ['0'];
    const nextIdx = `${node.dynamicInputs.length}`;
    node.dynamicInputs.push(nextIdx);
    node.inputValues[nextIdx] = '';

    // Inherit and enforce node/list data type for ALL dynamic input slots
    const currentElemType = (node.dataType || (node.pinTypes && node.pinTypes['0']) || 'generic').replace(/\s+list$/i, '').trim();
    if (!node.pinTypes) node.pinTypes = {};
    node.dynamicInputs.forEach(k => {
      node.pinTypes[k] = currentElemType;
    });
    node.pinTypes['0~99'] = currentElemType;
    node.pinTypes['List'] = currentElemType === 'generic' ? 'list' : `${currentElemType} list`;

    this.saveSnapshot();
    this.notify('dynamic_input_add');
  }

  removeDynamicInput(nodeId, inputName) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !node.dynamicInputs || node.dynamicInputs.length <= 1) return;
    
    // Remove wire attached to this input pin
    this.wires = this.wires.filter(w => !(w.toNode === nodeId && w.toPin === inputName));
    delete node.inputValues[inputName];
    if (node.pinTypes) delete node.pinTypes[inputName];

    // Remove and re-index remaining
    const idx = node.dynamicInputs.indexOf(inputName);
    if (idx !== -1) {
      node.dynamicInputs.splice(idx, 1);
    }
    // Re-index remaining inputs sequentially: 0, 1, 2...
    const newInputValues = {};
    const newPinTypes = {};
    const currentElemType = node.dataType || 'generic';
    const oldWires = [...this.wires];
    const newDynamic = [];
    node.dynamicInputs.forEach((oldKey, i) => {
      const newKey = `${i}`;
      newDynamic.push(newKey);
      newInputValues[newKey] = node.inputValues[oldKey] || '';
      newPinTypes[newKey] = (node.pinTypes && node.pinTypes[oldKey]) || currentElemType;
      // Rewire if needed
      for (const w of oldWires) {
        if (w.toNode === nodeId && w.toPin === oldKey) {
          w.toPin = newKey;
        }
      }
    });
    node.dynamicInputs = newDynamic;
    node.inputValues = { ...node.inputValues, ...newInputValues };
    node.pinTypes = { ...node.pinTypes, ...newPinTypes };
    this.saveSnapshot();
    this.notify('dynamic_input_remove');
  }

  // Dynamic branch manipulation (Multiple Branches)
  addDynamicBranch(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.dynamicBranches = node.dynamicBranches || ['Branch 0', 'Branch 1', 'Branch 2', 'Default'];
    // Insert new branch right before 'Default'
    const defaultIdx = node.dynamicBranches.indexOf('Default');
    const branchCount = node.dynamicBranches.filter(b => b.startsWith('Branch ')).length;
    const newBranchName = `Branch ${branchCount}`;
    if (defaultIdx !== -1) {
      node.dynamicBranches.splice(defaultIdx, 0, newBranchName);
    } else {
      node.dynamicBranches.push(newBranchName);
    }
    this.saveSnapshot();
    this.notify('dynamic_branch_add');
  }

  removeDynamicBranch(nodeId, branchName) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !node.dynamicBranches || node.dynamicBranches.length <= 2) return;
    if (branchName === 'Default') return; // Cannot delete Default branch

    // Remove wires attached to this branch
    this.wires = this.wires.filter(w => !(w.fromNode === nodeId && w.fromPin === branchName));

    node.dynamicBranches = node.dynamicBranches.filter(b => b !== branchName);
    this.saveSnapshot();
    this.notify('dynamic_branch_remove');
  }

  // Smooth canvas viewport focus on a target node
  jumpToNode(nodeId, viewportWidth = 1000, viewportHeight = 700) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    this.selectedNodeIds.clear();
    this.selectedNodeIds.add(nodeId);
    this.selectedWireIds.clear();

    const targetX = viewportWidth / 2 - (node.x + 110) * this.zoom;
    const targetY = viewportHeight / 2 - (node.y + 60) * this.zoom;

    // Smooth pan
    const startX = this.panX;
    const startY = this.panY;
    const startTime = performance.now();
    const duration = 280;

    const animatePan = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      this.panX = startX + (targetX - startX) * ease;
      this.panY = startY + (targetY - startY) * ease;
      this.notify('viewport_jump');
      if (progress < 1) {
        requestAnimationFrame(animatePan);
      }
    };
    requestAnimationFrame(animatePan);
  }

  // Check if an input pin has an incoming connection
  getIncomingWire(nodeId, pinName) {
    return this.wires.find(w => w.toNode === nodeId && w.toPin === pinName);
  }

  // Get the badge text for an input pin: concise pin name without redundant node prefix
  getPinBadge(nodeId, pinName) {
    const wire = this.getIncomingWire(nodeId, pinName);
    if (!wire) return null;
    return wire.fromPin;
  }

  setBranchValue(nodeId, branchName, value, triggerNotify = true) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.branchValues = node.branchValues || {};
    node.branchValues[branchName] = value;
    if (triggerNotify) {
      this.saveSnapshot();
      this.notify('branch_value_change');
    }
  }

  loadDefaultGenshinScene() {
    this.nodes = [];
    this.wires = [];
    this.selectedNodeIds.clear();
    this.selectedWireIds.clear();

    // Ensure default node graph variables match screenshot
    this.nodeGraphVariables = [
      { id: 'var_1', name: 'HP', type: 'int', defaultValue: '0', value: '0' },
      { id: 'var_2', name: 'Attacked', type: 'bool', defaultValue: 'False', value: 'False' },
      { id: 'var_3', name: 'Damage', type: 'float', defaultValue: '0.0', value: '0.0' }
    ];

    // 1. Event Node: Monitor Signal (Matching [img 1])
    const nMonitor = this.createNode('event_monitor_signal', 50, 150, {
      inputValues: { 'Signal Name': 'HC_Shot' }
    });

    // 2. Flow Control: Double Branch 1 (Matching [img 1])
    const nBranch1 = this.createNode('flow_double_branch', 480, 150);

    // 3. Flow Control: Double Branch 2 (Matching [img 1])
    const nBranch2 = this.createNode('flow_double_branch', 820, 150);

    // 4. Operation: Equal (feeder for Double Branch 1 Condition -> "Equal - Result")
    const nEqual = this.createNode('op_equal', 180, 440, {
      inputValues: { 'Input 1': '1', 'Input 2': '1' }
    });

    // 5. Query: Get Custom Variable (feeder for Double Branch 2 Condition -> "Get Custom Variable - Variable Value")
    const nGetVar = this.createNode('query_get_custom_var', 520, 440, {
      inputValues: { 'Variable Name': 'Strike_Allowed' }
    });

    // 6. Query: Get Self Entity
    const nSelfEntity = this.createNode('query_get_self_entity', 50, 440);

    // 7. Query: Get Node Graph Variable - "Attacked" (Matching Image 1 & 2)
    const nGetVarAttacked = this.createNode('query_get_node_graph_var', 420, 360, {
      inputValues: { 'Variable Name': 'Attacked' }
    });

    // 8. Query: Get Node Graph Variable - "Damage" (Matching Image 1 & 2)
    const nGetVarDamage = this.createNode('query_get_node_graph_var', 420, 500, {
      inputValues: { 'Variable Name': 'Damage' }
    });

    // 9. Execution: Set Node Graph Variable - "Attacked" (Matching Image 1 & 2)
    const nSetVarAttacked = this.createNode('exec_set_node_graph_var', 680, 360, {
      inputValues: {
        'Variable Name': 'Attacked',
        'Variable Value': 'No',
        'Trigger Event': 'No'
      }
    });

    // 10. Execution: Set Node Graph Variable - "Damage" (Matching Image 1 & 2)
    const nSetVarDamage = this.createNode('exec_set_node_graph_var', 980, 360, {
      inputValues: {
        'Variable Name': 'Damage',
        'Variable Value': '0',
        'Trigger Event': 'No'
      }
    });

    // Wires (Matching Image 1 & 2 EXACTLY!)
    // Exec White Wire: Monitor Signal [execOut] -> Double Branch 1 [execIn]
    this.addWire(nMonitor.id, 'execOut', nBranch1.id, 'execIn', true);

    // Exec White Wire: Double Branch 1 [No] -> Double Branch 2 [execIn]
    this.addWire(nBranch1.id, 'No', nBranch2.id, 'execIn', true);

    // Data Wire: Equal [Result] -> Double Branch 1 [Condition]
    this.addWire(nEqual.id, 'Result', nBranch1.id, 'Condition', false);

    // Data Wire: Get Custom Variable [Variable Value] -> Double Branch 2 [Condition]
    this.addWire(nGetVar.id, 'Variable Value', nBranch2.id, 'Condition', false);

    // Data Wire: Monitor Signal [Signal Source Entity] -> Get Custom Variable [Target Entity]
    this.addWire(nMonitor.id, 'Signal Source Entity', nGetVar.id, 'Target Entity', false);

    // Data Wire: Get Self Entity -> Equal [Input 1]
    this.addWire(nSelfEntity.id, 'Self Entity', nEqual.id, 'Input 1', false);

    // Exec White Wire between Set Node Graph Variable: Attacked -> Damage
    this.addWire(nSetVarAttacked.id, 'execOut', nSetVarDamage.id, 'execIn', true);

    // Data Wire: Get Node Graph Variable (Attacked) -> Set Node Graph Variable (Attacked)
    this.addWire(nGetVarAttacked.id, 'Variable Value', nSetVarAttacked.id, 'Variable Value', false);

    // Default starter Comment Tray & Instructions Note Bubble
    this.comments = [
      {
        id: 'comment_door_actuation',
        title: 'Door Actuation & State Evaluation',
        x: 40,
        y: 40,
        width: 1080,
        height: 480,
        collapsed: false,
        color: 'slate',
        collapsedNodeIds: []
      }
    ];

    this.notes = [
      {
        id: 'note_welcome',
        text: '### Node Graph Notes & Instructions\n- Click the **comment icon** in the bottom dock or press **[C]** to toggle **Commenting Mode**.\n- In commenting mode:\n  - **Drag on empty space** to draw a rectangular **Comment Tray**.\n  - **Click anywhere** to place an instruction **Note Bubble**.\n- Trays support **Collapsing** into a single clean node with sticking-out pins!\n- Notes support full Markdown and image URLs: `https://...`',
        x: 1140,
        y: 50,
        width: 270,
        height: 220,
        attachedNodeId: nEqual.id,
        attachedOffset: { x: 310, y: -200 },
        color: '#88C0D0',
        isMinimized: false,
        isEditing: false
      }
    ];

    this.history = [];
    this.saveSnapshot();
    this.notify('scene_reset');
  }

  fromJSON(data) {
    if (!data) return;
    this.name = data.name || this.name;
    this.type = data.type || this.type;
    this.nodes = data.nodes || [];
    this.wires = data.wires || [];
    this.panX = data.panX !== undefined ? data.panX : this.panX;
    this.panY = data.panY !== undefined ? data.panY : this.panY;
    this.zoom = data.zoom !== undefined ? data.zoom : this.zoom;
    if (data.signals && Array.isArray(data.signals)) {
      signalsManager.deserialize(data.signals);
    }
    if (data.nodeGraphVariables && Array.isArray(data.nodeGraphVariables)) {
      this.nodeGraphVariables = data.nodeGraphVariables;
    }
    if (data.comments && Array.isArray(data.comments)) {
      this.comments = data.comments;
    } else {
      this.comments = [];
    }
    if (data.notes && Array.isArray(data.notes)) {
      this.notes = data.notes;
    } else {
      this.notes = [];
    }
    this.selectedNodeIds.clear();
    this.selectedWireIds.clear();
    this.history = [];
    this.saveSnapshot();
    this.notify('loaded');
  }
}
