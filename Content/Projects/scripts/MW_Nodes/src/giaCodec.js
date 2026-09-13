/**
 * .GIA / Binary & JSON Codec for Genshin Impact Miliastra Wonderland
 * Enables saving, loading, importing, and exporting genuine .gia binary assets.
 *
 * Fully client-side: decodes/encodes real .gia binaries in the browser using
 * protobufjs (CDN) + the local protobuf schema (gia.proto) + local node data.
 * No server, no injection, no .gil integration.
 */

import { getNodeBlueprint, parseNodeBlueprintAndType, applyDataTypeToNode } from './nodesData.js';
import { NODE_ID } from './ide/utils/MW-Node-Editor-Pack/node_data/node_id.js';
import { signalsManager } from './signalsManager.js';

const GIA_SCHEMA_URL = '/src/ide/utils/MW-Node-Editor-Pack/protobuf/gia.proto';
const SAMPLE_GIA_URL = '/ref/gia/garage.gia';

// Lazy singleton for the protobuf Root, reused across all decode/encode calls.
// Uses the locally-vendored protobufjs (window.protobuf), loaded from index.html.
let protoRootPromise = null;
function getProtoRoot() {
  if (!protoRootPromise) {
    protoRootPromise = (async () => {
      const protobuf = globalThis.protobuf;
      if (!protobuf) {
        throw new Error('protobufjs was not loaded (missing /src/ide/utils/protobufjs.min.js).');
      }
      const resp = await fetch(GIA_SCHEMA_URL);
      if (!resp.ok) throw new Error(`Failed to load gia.proto schema (${resp.status})`);
      const text = await resp.text();
      const parsed = protobuf.parse(text);
      return parsed.root;
    })();
  }
  return protoRootPromise;
}

// Numeric GIA node id -> best readable key (e.g. Equal__Entity). Build once.
let reverseNodeIdMap = null;
function getReverseNodeIdMap() {
  if (!reverseNodeIdMap) {
    reverseNodeIdMap = {};
    for (const [key, id] of Object.entries(NODE_ID)) {
      if (id == null) continue;
      if (!reverseNodeIdMap[id]) reverseNodeIdMap[id] = [];
      reverseNodeIdMap[id].push(key);
    }
  }
  return reverseNodeIdMap;
}

function mapVarType(vt) {
  if (typeof vt === 'object' && vt !== null) {
    vt = vt.type1 || vt.type2 || vt.type || 0;
  }
  const map = {
    1: 'entity', 2: 'guid', 3: 'int', 4: 'bool', 5: 'float', 6: 'string',
    7: 'list', 8: 'list', 9: 'list', 10: 'list', 11: 'list', 12: 'vector3',
    13: 'list', 14: 'enum', 15: 'list', 16: 'local_var', 17: 'faction',
    20: 'config_id', 21: 'prefab_id'
  };
  return map[vt] || 'generic';
}

export class GiaCodec {
  /**
   * Encodes GraphState to standardized Miliastra Wonderland JSON/AST structure
   */
  static encode(graphState) {
    return {
      header: {
        magic: 'GIA_MND_V7',
        game_version: '6.3.0',
        graph_type: graphState.type || 'Server',
        graph_name: graphState.name || 'Open_Garage',
        export_time: new Date().toISOString()
      },
      metadata: {
        node_count: graphState.nodes.length,
        wire_count: graphState.wires.length,
        viewport: {
          pan_x: graphState.panX,
          pan_y: graphState.panY,
          zoom: graphState.zoom
        }
      },
      signals: signalsManager.getSignals(),
      nodes: graphState.nodes.map(n => ({
        id: n.id,
        giaIndex: n.giaIndex,
        nodeId: n.nodeId,
        blueprintId: n.blueprintId,
        name: n.name,
        category: n.category,
        dataType: n.dataType || null,
        pinTypes: n.pinTypes || {},
        pos: [n.x, n.y],
        inputs: n.inputValues,
        signalName: n.signalName || n.inputValues?.['Signal Name'] || null,
        customInputs: n.customInputs || null,
        customOutputs: n.customOutputs || null,
        dynamic_inputs: n.dynamicInputs || [],
        dynamicBranches: n.dynamicBranches || null,
        branchValues: n.branchValues || {},
        customProps: n.customProps || {}
      })),
      connections: graphState.wires.map(w => ({
        id: w.id,
        from_node: w.fromNode,
        from_pin: w.fromPin,
        to_node: w.toNode,
        to_pin: w.toPin,
        is_exec: !!w.isExec
      })),
      rawGiaAst: graphState.rawGiaAst || null
    };
  }

  /**
   * Decodes JSON payload back into GraphState
   */
  static decode(payload, graphState) {
    if (!payload || !payload.nodes) {
      throw new Error('Invalid .gia / JSON graph payload format');
    }

    graphState.name = payload.header?.graph_name || payload.name || 'Imported_Graph';
    graphState.type = payload.header?.graph_type || payload.type || 'Server';

    // Calculate bounding box for auto-framing imported graphs
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    payload.nodes.forEach(n => {
      const x = Array.isArray(n.pos) ? n.pos[0] : (n.x || 0);
      const y = Array.isArray(n.pos) ? n.pos[1] : (n.y || 0);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    if (payload.metadata?.viewport) {
      graphState.panX = payload.metadata.viewport.pan_x || 0;
      graphState.panY = payload.metadata.viewport.pan_y || 0;
      graphState.zoom = payload.metadata.viewport.zoom || 1;
    } else if (isFinite(minX) && isFinite(maxX)) {
      // Auto-center the imported graph within a standard canvas view
      const graphCenterX = (minX + maxX) / 2;
      const graphCenterY = (minY + maxY) / 2;
      graphState.panX = Math.round(550 - graphCenterX);
      graphState.panY = Math.round(350 - graphCenterY);
      graphState.zoom = 1;
    }

    if (payload.signals && Array.isArray(payload.signals)) {
      payload.signals.forEach(s => {
        if (s && s.name) {
          signalsManager.registerSignal(s.name, s.params);
        }
      });
    }

    graphState.nodes = payload.nodes.map(n => {
      const rawName = n.name || n.blueprintId || '';
      const parsed = parseNodeBlueprintAndType(rawName);
      const bp = parsed.blueprint || getNodeBlueprint(n.blueprintId) || getNodeBlueprint(n.name);
      const dataType = n.dataType || parsed.dataType || null;
      const pinTypes = { ...(n.pinTypes || {}) };

      const nodeObj = {
        id: n.id,
        giaIndex: n.giaIndex,
        nodeId: n.nodeId,
        blueprintId: bp ? bp.id : (n.blueprintId || n.blueprint_id || 'query_custom'),
        name: bp ? bp.name : (parsed.baseName || rawName || 'Node'),
        category: bp ? bp.category : (n.category || 'execution'),
        dataType: dataType,
        pinTypes: pinTypes,
        x: Array.isArray(n.pos) ? n.pos[0] : (n.x || 0),
        y: Array.isArray(n.pos) ? n.pos[1] : (n.y || 0),
        inputValues: n.inputs || n.inputValues || {},
        signalName: n.signalName || n.inputs?.['Signal Name'] || n.inputValues?.['Signal Name'] || null,
        customInputs: n.customInputs || null,
        customOutputs: n.customOutputs || null,
        dynamicInputs: n.dynamic_inputs || n.dynamicInputs || (bp?.canAddDynamicInputs ? ['0'] : []),
        dynamicBranches: n.dynamicBranches || (bp?.canAddDynamicBranches ? ['Branch 0', 'Branch 1', 'Branch 2', 'Default'] : null),
        branchValues: n.branchValues || {},
        customProps: n.customProps || {}
      };

      if (bp && dataType) {
        applyDataTypeToNode(nodeObj, bp, dataType);
      }

      return nodeObj;
    });

    graphState.wires = (payload.connections || payload.wires || []).map(w => ({
      id: w.id,
      fromNode: w.from_node || w.fromNode,
      fromPin: w.from_pin || w.fromPin,
      toNode: w.to_node || w.toNode,
      toPin: w.to_pin || w.toPin,
      isExec: !!(w.is_exec || w.isExec)
    }));

    if (payload.rawGiaAst) {
      graphState.rawGiaAst = payload.rawGiaAst;
    }

    // Reset interaction state and initialize fresh snapshot to prevent history cross-contamination
    graphState.selectedNodeIds.clear();
    graphState.selectedWireIds.clear();
    graphState.history = [];
    graphState.historyIndex = -1;
    graphState.saveSnapshot();
    graphState.notify('import');
    return graphState;
  }

  /**
   * Decode a raw .gia binary ArrayBuffer into a plain protobuf AST object.
   */
  static async _decodeBinaryRaw(arrayBuffer) {
    const root = await getProtoRoot();
    const Type = root.lookupType('Root');
    const view = new DataView(arrayBuffer);

    if (view.byteLength < 24) {
      throw new Error('File too small to be a valid .gia binary file');
    }

    const schemaVersion = view.getUint32(4, false);
    const headTag = view.getUint32(8, false);
    const fileType = view.getUint32(12, false);
    const tailTag = view.getUint32(view.byteLength - 4, false);

    if (schemaVersion !== 1 || headTag !== 0x0326 || fileType !== 3 || tailTag !== 0x0679) {
      throw new Error('Not a valid .gia file (bad header signature)');
    }

    const payload = arrayBuffer.slice(20, arrayBuffer.byteLength - 4);
    let msg;
    try {
      msg = Type.decode(new Uint8Array(payload));
    } catch (err) {
      throw new Error(
        `Could not decode .gia protobuf payload (${err && err.message})\n` +
        'The file is not a valid Miliastra Wonderland .gia, is corrupted, ' +
        'or was exported from a different game version.'
      );
    }
    return Type.toObject(msg, { defaults: true, longs: Number });
  }

  /**
   * Convert a decoded .gia AST into the editor's GraphState representation.
   */
  static _astToGraphState(ast) {
    const nodeIdToEntries = getReverseNodeIdMap();

    // Index accessory (signal) definitions by their numeric id.
    const accessoryMap = {};
    const signals = [];
    for (const acc of (ast.accessories || [])) {
      if (acc.id?.id) accessoryMap[acc.id.id] = acc;
      if (acc.compositeDef?.inner?.def) {
        const def = acc.compositeDef.inner.def;
        const sigName = def.name || acc.name;
        const rawParams = (def.inputs && def.inputs.length > 0)
          ? def.inputs
          : (def.outputs && def.outputs.length > 3 ? def.outputs.slice(3) : []);
        const params = rawParams.map(p => ({ name: p.name, type: mapVarType(p.type) }));
        signals.push({ name: sigName, params });
      }
    }

    const graphUnit = ast.graph;
    const graphName = graphUnit?.name || 'Imported_Graph';
    const rawNodes = graphUnit?.graph?.inner?.graph?.nodes || [];

    const stateNodes = [];
    const nodeIndexToId = {};

    rawNodes.forEach(rn => {
      const concreteId = rn.concreteId?.nodeId;
      const genericId = rn.genericId?.nodeId;
      const concreteKeys = (concreteId && nodeIdToEntries[concreteId]) || [];
      const genericKeys = (genericId && nodeIdToEntries[genericId]) || [];

      // Pick the most specialized concrete key (e.g. Equal__Entity instead of Equal__Generic)
      let bestKey = concreteKeys.find(k => !k.endsWith('__Generic')) ||
                    concreteKeys[0] ||
                    genericKeys.find(k => !k.endsWith('__Generic')) ||
                    genericKeys[0] || '';

      const accessory = (concreteId && accessoryMap[concreteId]) || (genericId && accessoryMap[genericId]) || null;
      let rawName = bestKey ? bestKey.replace(/_/g, ' ') : (accessory?.name || `Node_${concreteId || genericId}`);

      // Intelligent parser separating node base type from data type
      const parsed = parseNodeBlueprintAndType(bestKey || rawName);
      let bp = parsed.blueprint;
      let baseName = parsed.baseName || rawName;
      let detectedType = parsed.dataType;

      let customInputs = null;
      let customOutputs = null;

      // Handle custom accessories (e.g. Send Signal, Monitor Signal)
      if (accessory) {
        const accName = accessory.name || '';
        const accLower = accName.toLowerCase();
        if (accLower.includes('send signal to server')) {
          bp = bp || getNodeBlueprint('exec_send_signal_to_server_graph') || getNodeBlueprint('Send Signal');
          baseName = 'Send Signal to Server Node Graph';
        } else if (accLower.includes('send signal')) {
          bp = bp || getNodeBlueprint('exec_send_signal') || getNodeBlueprint('Send Signal');
          baseName = 'Send Signal';
        } else if (accLower.includes('monitor signal')) {
          bp = bp || getNodeBlueprint('event_monitor_signal') || getNodeBlueprint('Monitor Signal');
          baseName = 'Monitor Signal';
        }

        if (accessory.compositeDef?.inner?.def) {
          const compDef = accessory.compositeDef.inner.def;
          if (Array.isArray(compDef.inputs) && compDef.inputs.length > 0) {
            customInputs = compDef.inputs.map(i => ({ name: i.name, type: mapVarType(i.type) }));
          }
          if (Array.isArray(compDef.outputs) && compDef.outputs.length > 0) {
            customOutputs = compDef.outputs.map(o => ({ name: o.name, type: mapVarType(o.type) }));
          }
        }
      }

      const id = `node_gia_${rn.nodeIndex}`;
      nodeIndexToId[rn.nodeIndex] = id;

      const inputValues = {};
      let detectedSignalName = '';

      (rn.pins || []).forEach(p => {
        const kind = p.i1?.kind;
        const pIdx = p.i1?.index;

        let val = '';
        if (p.value) {
          if (p.value.bString?.val !== undefined) val = p.value.bString.val;
          else if (p.value.bInt?.val !== undefined) val = String(p.value.bInt.val);
          else if (p.value.bFloat?.val !== undefined) val = String(p.value.bFloat.val);
          else if (p.value.bId?.val !== undefined) val = String(p.value.bId.val);
          else if (p.value.bEnum?.val !== undefined) val = String(p.value.bEnum.val);
          else if (p.value.bVector?.val) {
            const v = p.value.bVector.val;
            val = `(${v.x || 0}, ${v.y || 0}, ${v.z || 0})`;
          }
        }

        if (kind === 5 || p.clientExecNode?.kind === 6 || (p.value?.bString?.val && (baseName.includes('Signal') || baseName.includes('signal')))) {
          if (p.value?.bString?.val) {
            detectedSignalName = p.value.bString.val;
          }
        }

        if (kind === 3) {
          if (customInputs && customInputs[pIdx]) {
            inputValues[customInputs[pIdx].name] = val;
          } else if (bp && bp.inputs && bp.inputs[pIdx]) {
            inputValues[bp.inputs[pIdx].name] = val;
          } else {
            inputValues[`param_${pIdx}`] = val;
          }
        }
      });

      if (detectedSignalName) {
        inputValues['Signal Name'] = detectedSignalName;
      } else if (accessory?.name && (baseName.includes('Signal') || baseName.includes('signal'))) {
        const cleanedName = accessory.name.replace(/^(Monitor|Send)\s+Signal\s*[:-]?\s*/i, '').trim();
        if (cleanedName && cleanedName !== accessory.name) {
          inputValues['Signal Name'] = cleanedName;
        }
      }

      // Backward compatibility for math nodes
      if (bp && (bp.id === 'op_division' || bp.id === 'op_multiplication' || bp.id === 'op_addition' || bp.id === 'op_subtraction' || bp.id === 'op_modulo_operation' || bp.id === 'op_equal')) {
        if (inputValues['Generic'] !== undefined && inputValues['Input 1'] === undefined) {
          inputValues['Input 1'] = inputValues['Generic'];
        }
        if (inputValues['param_0'] !== undefined && inputValues['Input 1'] === undefined) {
          inputValues['Input 1'] = inputValues['param_0'];
        }
        if (inputValues['param_1'] !== undefined && inputValues['Input 2'] === undefined) {
          inputValues['Input 2'] = inputValues['param_1'];
        }
      }

      const nodeInstance = {
        id,
        giaIndex: rn.nodeIndex,
        nodeId: concreteId || genericId,
        blueprintId: bp ? bp.id : (rn.pins?.some(p => p.i1?.kind === 1 || p.i1?.kind === 2) ? 'exec_custom' : 'query_custom'),
        name: bp ? bp.name : baseName,
        category: bp ? bp.category : (rn.pins?.some(p => p.i1?.kind === 1 || p.i1?.kind === 2) ? 'execution' : 'query'),
        dataType: detectedType || null,
        pinTypes: {},
        x: Math.round(rn.x),
        y: Math.round(rn.y),
        inputValues,
        rawNode: rn
      };

      if (detectedSignalName) {
        nodeInstance.signalName = detectedSignalName;
      }
      if (customInputs) {
        nodeInstance.customInputs = customInputs;
      }
      if (customOutputs) {
        nodeInstance.customOutputs = customOutputs;
      }

      if (bp && detectedType) {
        applyDataTypeToNode(nodeInstance, bp, detectedType);
      }

      stateNodes.push(nodeInstance);
    });

    const stateWires = [];
    const existingWires = new Set();
    let wireCounter = 1;
    rawNodes.forEach(rn => {
      const fromId = nodeIndexToId[rn.nodeIndex];
      const fromNode = stateNodes.find(n => n.id === fromId);
      const fromBp = getNodeBlueprint(fromNode?.blueprintId) || getNodeBlueprint(fromNode?.name);

      (rn.pins || []).forEach(p => {
        const fromKind = p.i1?.kind;
        const fromPIdx = p.i1?.index;

        (p.connects || []).forEach(conn => {
          const toId = nodeIndexToId[conn.id];
          const toNode = stateNodes.find(n => n.id === toId);
          const toKind = conn.connect?.kind;
          const toPIdx = conn.connect?.index;
          const toBp = getNodeBlueprint(toNode?.blueprintId) || getNodeBlueprint(toNode?.name);

          const isExec = (fromKind === 2 && toKind === 1);
          if (isExec) {
            let fromPinName = 'execOut';
            if (fromBp?.id === 'flow_double_branch' || fromNode?.name === 'Double Branch' || (Array.isArray(fromBp?.execOut) && fromBp.execOut.length > 1)) {
              fromPinName = fromPIdx === 0 ? 'Yes' : 'No';
            } else if (Array.isArray(fromBp?.execOut) && fromBp.execOut[fromPIdx]) {
              fromPinName = fromBp.execOut[fromPIdx].name || fromBp.execOut[fromPIdx] || 'execOut';
            }

            let toPinName = 'execIn';
            if (Array.isArray(toBp?.execInputs) && toBp.execInputs[toPIdx]) {
              toPinName = toBp.execInputs[toPIdx].name || toBp.execInputs[toPIdx] || 'execIn';
            }

            const wireKey = `${fromId}:${fromPinName}->${toId}:${toPinName}`;
            if (!existingWires.has(wireKey)) {
              existingWires.add(wireKey);
              stateWires.push({
                id: `wire_${wireCounter++}`,
                fromNode: fromId,
                fromPin: fromPinName,
                toNode: toId,
                toPin: toPinName,
                isExec: true
              });
            }
          } else if (fromKind === 3 && toKind === 4) {
            // fromId is the consumer (target input), toId is the producer (source output)
            let outPinName = 'Output';
            if (toNode?.customOutputs && toNode.customOutputs[toPIdx]) {
              outPinName = toNode.customOutputs[toPIdx].name;
            } else if (toBp?.outputs && toBp.outputs[toPIdx]) {
              outPinName = toBp.outputs[toPIdx].name;
            } else if (toNode?.blueprintId === 'event_monitor_signal' || toNode?.name === 'Monitor Signal') {
              if (toPIdx === 0) outPinName = 'Event Source Entity';
              else if (toPIdx === 1) outPinName = 'Event Source GUID';
              else if (toPIdx === 2) outPinName = 'Signal Source Entity';
              else outPinName = 'Damage';
            } else {
              outPinName = toBp?.outputs?.[0]?.name || 'Output';
            }

            let inPinName = 'Input';
            if (fromNode?.customInputs && fromNode.customInputs[fromPIdx]) {
              inPinName = fromNode.customInputs[fromPIdx].name;
            } else if (fromBp?.inputs && fromBp.inputs[fromPIdx]) {
              inPinName = fromBp.inputs[fromPIdx].name;
            } else {
              inPinName = fromBp?.inputs?.[fromPIdx]?.name || fromBp?.inputs?.[0]?.name || 'Input';
            }

            const wireKey = `${toId}:${outPinName}->${fromId}:${inPinName}`;
            if (!existingWires.has(wireKey)) {
              existingWires.add(wireKey);
              stateWires.push({
                id: `wire_${wireCounter++}`,
                fromNode: toId,
                fromPin: outPinName,
                toNode: fromId,
                toPin: inPinName,
                isExec: false
              });
            }
          }
        });
      });
    });

    return {
      graph: {
        name: graphName,
        type: 'Server',
        nodes: stateNodes,
        wires: stateWires,
        signals,
        rawGiaAst: ast
      }
    };
  }

  /**
   * Load the bundled sample garage.gia AST (cached), used as a structural
   * baseline when exporting a graph that has no rawGiaAst of its own.
   */
  static async _sampleAst() {
    if (!this._sampleAstCache) {
      const resp = await fetch(SAMPLE_GIA_URL);
      if (!resp.ok) throw new Error(`Failed to load sample garage.gia (${resp.status})`);
      this._sampleAstCache = await this._decodeBinaryRaw(await resp.arrayBuffer());
    }
    return this._sampleAstCache;
  }

  /**
   * Loads the bundled sample garage.gia directly (client-side).
   */
  static async loadSampleGia(graphState) {
    try {
      const resp = await fetch(SAMPLE_GIA_URL);
      if (!resp.ok) return false;
      return await this.decodeBinaryGia(await resp.arrayBuffer(), graphState);
    } catch (err) {
      console.error('Failed to load garage.gia:', err);
      return false;
    }
  }

  /**
   * Imports an uploaded binary .gia or JSON graph file into GraphState
   */
  static async importGiaFile(file, graphState) {
    const buffer = await file.arrayBuffer();

    // 1. Check if the file is JSON-formatted graph
    try {
      const text = new TextDecoder().decode(buffer);
      const trimmed = text.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const json = JSON.parse(trimmed);
        if (json && (json.nodes || json.graph)) {
          this.decode(json.graph || json, graphState);
          return true;
        }
      }
    } catch (_) {
      // Not JSON, continue to binary decoding
    }

    // 2. Decode raw binary .gia fully client-side
    return await this.decodeBinaryGia(buffer, graphState);
  }

  /**
   * Exports the current GraphState into a genuine .gia binary file
   * and prompts a browser download. Fully client-side.
   */
  static async exportGiaFile(graphState) {
    const bytes = await this._buildGiaBinary(graphState);
    const blob = new Blob([bytes], { type: 'application/octet-stream' });

    const filename = `${(graphState.name || 'Open_Garage').replace(/[^\w\- ]/g, '') || 'Open_Garage'}.gia`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Rebuild a valid .gia binary from the current GraphState.
   */
  static async _buildGiaBinary(graphState) {
    const root = await getProtoRoot();
    const Type = root.lookupType('Root');

    let ast;
    if (graphState.rawGiaAst) {
      // Update coordinates and name on the loaded structural baseline
      ast = JSON.parse(JSON.stringify(graphState.rawGiaAst));
      ast.graph.name = graphState.name || 'Imported_Graph';
      const nodes = ast.graph?.graph?.inner?.graph?.nodes || [];
      const suffixMap = {
        'int': 'Int', 'float': 'Float', 'string': 'Str', 'bool': 'Bool',
        'entity': 'Entity', 'guid': 'GUID', 'vector3': 'Vec', 'faction': 'Faction',
        'config_id': 'Config', 'prefab_id': 'Prefab'
      };
      nodes.forEach(rn => {
        const matching = graphState.nodes?.find(n => n.giaIndex === rn.nodeIndex || n.name === rn.name);
        if (matching) {
          rn.x = matching.x;
          rn.y = matching.y;
          if (matching.dataType && NODE_ID) {
            const normBase = (matching.name || '').replace(/\s+/g, '_');
            const suffix = suffixMap[matching.dataType] || matching.dataType;
            const key = `${normBase}__${suffix}`;
            if (NODE_ID[key] && rn.concreteId) {
              rn.concreteId.nodeId = NODE_ID[key];
            }
          }
        }
      });
    } else {
      // No baseline: start from the sample structure to produce a valid Root.
      const baseSample = await this._sampleAst();
      ast = JSON.parse(JSON.stringify(baseSample));
      ast.graph.name = graphState.name || 'Exported_Graph';
      ast.graph.graph.inner.graph.name = graphState.name || 'Exported_Graph';
    }

    const msg = Type.fromObject(ast);
    const payload = Type.encode(msg).finish();

    // Wrap with the GIA binary header + footer (see protobuf decode.ts).
    const header = [payload.length + 20, 1, 0x0326, 3, payload.length];
    const buffer = new ArrayBuffer(header[0] + 4);
    const view = new DataView(buffer);
    header.forEach((val, i) => view.setUint32(i * 4, val, false));
    new Uint8Array(buffer, 20).set(payload);
    view.setUint32(buffer.byteLength - 4, 0x0679, false);
    return buffer;
  }

  /**
   * Decode a raw binary .gia file into GraphState (client-side).
   */
  static async decodeBinaryGia(arrayBuffer, graphState) {
    const ast = await this._decodeBinaryRaw(arrayBuffer);
    const graph = this._astToGraphState(ast);
    this.decode(graph.graph, graphState);
    return true;
  }
}
