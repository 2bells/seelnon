/**
 * .GIA / Binary & JSON Codec for Genshin Impact Miliastra Wonderland
 * Enables saving, loading, importing, and exporting genuine .gia binary assets.
 *
 * Fully client-side: decodes/encodes real .gia binaries in the browser using
 * protobufjs (CDN) + the local protobuf schema (gia.proto) + local node data.
 * No server, no injection, no .gil integration.
 */

import { getNodeBlueprint, parseNodeBlueprintAndType, applyDataTypeToNode, NODE_REGISTRY } from './nodesData.js';
import { NODE_ID } from './ide/utils/MW-Node-Editor-Pack/node_data/node_id.js';
import { signalsManager } from './signalsManager.js';

const GIA_SCHEMA_URL = './src/ide/utils/MW-Node-Editor-Pack/protobuf/gia.proto';
const SAMPLE_GIA_URL = './ref/gia/garage.gia';

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
// A parallel map for the app's own blueprints (query_get_… / exec_… / op_…) that
// don't exist in the real game's NODE_ID table. We hand them a stable synthetic
// id so a graph we encode round-trips cleanly back through OUR decoder.
let localNodeIdMap = null;
function getLocalNodeIdMap() {
  if (!localNodeIdMap) {
    localNodeIdMap = new Map();
    let i = 0;
    (NODE_REGISTRY || []).forEach(bp => {
      if (bp && bp.id && !localNodeIdMap.has(bp.id)) localNodeIdMap.set(bp.id, 1050000 + (++i));
    });
  }
  return localNodeIdMap;
}
function getReverseNodeIdMap() {
  if (!reverseNodeIdMap) {
    reverseNodeIdMap = {};
    for (const [key, id] of Object.entries(NODE_ID)) {
      if (id == null) continue;
      if (!reverseNodeIdMap[id]) reverseNodeIdMap[id] = [];
      reverseNodeIdMap[id].push(key);
    }
    // Merge our synthetic app-blueprint ids so decode resolves them by blueprintId.
    const localReverse = {};
    for (const [bpId, id] of getLocalNodeIdMap()) {
      localReverse[id] = [bpId];
    }
    Object.assign(reverseNodeIdMap, localReverse);
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

function normalizeBoolValue(val) {
  const s = String(val).trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes' || s === 'on') return 'True';
  if (s === '0' || s === 'false' || s === 'no' || s === 'off') return 'False';
  if (s === '') return '';
  return val;
}

// App data-type -> GIA VarType enum value.
const APP_TYPE_CODE = {
  entity: 1, guid: 2, 'config_id': 20, 'prefab_id': 21,
  int: 3, bool: 4, float: 5, string: 6, list: 8, dict: 27,
  'vector3': 12, enum: 14, faction: 17, generic: 0
};
function typeCode(type) {
  const t = (type == null ? 'generic' : String(type)).toLowerCase();
  return APP_TYPE_CODE[t] != null ? APP_TYPE_CODE[t] : 0;
}
// Build a game-shaped VarBase for a literal pin value, or null when empty.
// Mirrors the shape seen in genuine .gia files: the oneof value plus
// `alreadySetVal` and an `itemType` describing the declared data type.
function valueItemType(code) {
  return { classBase: 1, typeServer: { type: code, kind: 0 } };
}

// Some node templates order their input pins differently than our Editor blueprints.
// Provide the game-template slot for each input by name; anything not listed uses
// its blueprint array position. (Observed from real in-game .gia exports.)
const GAME_INPUT_SLOTS = {
  exec_create_prefab: [
    'Prefab ID', 'Location', 'Rotate', 'Owner Entity', 'Level', 'Overwrite Level', 'Unit Tag Index List'
  ]
};
function gameInputSlot(bpId, inpName, fallback) {
  const list = GAME_INPUT_SLOTS[bpId];
  if (!list) return fallback;
  const i = list.indexOf(inpName);
  return i >= 0 ? i : fallback;
}
// The game numbers data outputs by blueprint position (Addition Result -> 0). Any
// template needing a custom output order can be added here like GAME_INPUT_SLOTS.
function gameOutputSlot(bpId, outName, fallback) {
  return fallback;
}
function baseValue(type, valStr) {
  if (valStr == null) return null;
  const s = String(valStr);
  const t = (type == null ? 'generic' : String(type)).toLowerCase();
  if (s === '' && t !== 'string') return null;
  const code = typeCode(t);
  switch (t) {
    case 'bool': {
      const b = normalizeBoolValue(s);
      if (b === '') return null;
      return { class: 6, alreadySetVal: true, itemType: valueItemType(code), bEnum: { val: (b === 'True' ? 1 : 0) } };
    }
    case 'int': {
      const n = parseInt(s, 10);
      if (!isFinite(n)) return null;
      return { class: 2, alreadySetVal: true, itemType: valueItemType(code), bInt: { val: n } };
    }
    case 'float': {
      const n = parseFloat(s);
      if (!isFinite(n)) return null;
      return { class: 4, alreadySetVal: true, itemType: valueItemType(code), bFloat: { val: n } };
    }
    case 'vector3': {
      let x = 0, y = 0, z = 0;
      if (s.startsWith('(') && s.endsWith(')')) {
        const p = s.slice(1, -1).split(',').map(v => parseFloat(v) || 0);
        x = p[0] || 0; y = p[1] || 0; z = p[2] || 0;
      }
      return { class: 7, alreadySetVal: true, itemType: valueItemType(code), bVector: { val: { x, y, z } } };
    }
    case 'entity':
    case 'guid':
    case 'config_id':
    case 'prefab_id':
    case 'faction':
      if (!isNaN(Number(s))) {
        return { class: 1, alreadySetVal: true, itemType: valueItemType(code), bId: { val: Number(s) } };
      }
      return { class: 5, alreadySetVal: true, itemType: valueItemType(code), bString: { val: s } };
    default:
      return { class: 5, alreadySetVal: true, itemType: valueItemType(code), bString: { val: s } };
  }
}

// A literal number on a numeric input pin: the game wraps it as a "concrete"
// (reflective) value — class 10000 -> bConcreteValue with indexOfConcrete 5 for
// Int, and the nested IntBaseValue carrying the number (this is the "= 1" case).
function concreteNumericValue(num) {
  return {
    class: 10000,
    alreadySetVal: true,
    bConcreteValue: {
      indexOfConcrete: 5,
      value: { class: 2, alreadySetVal: true, itemType: valueItemType(3), bInt: { val: num } }
    }
  };
}

// Decide the value written onto an *input pin*. The declared pin type is
// authoritative: asset ids / floats / vectors / strings / bools stay as plain Base
// values (matching real files). Only declared `int` (and truly generic numeric)
// literals use the game's "concrete/reflective" wrapper.
function inputPinValue(blueprintType, existingVal) {
  const raw = existingVal == null ? '' : String(existingVal);
  const t = (blueprintType == null ? 'generic' : String(blueprintType)).toLowerCase();
  const isConcreteNum = (t === 'int' || t === 'generic') && /^-?(\d+|\d*\.\d+)$/.test(raw.trim()) && raw.trim() !== '';
  if (isConcreteNum) {
    const n = parseFloat(raw);
    if (Number.isInteger(n) && !raw.trim().includes('.')) return concreteNumericValue(n);
    return {
      class: 10000, alreadySetVal: true,
      bConcreteValue: { indexOfConcrete: 5, value: { class: 4, alreadySetVal: true, itemType: valueItemType(5), bFloat: { val: n } } }
    };
  }
  return baseValue(blueprintType, raw);
}

const DATATYPE_SUFFIX = {
  int: 'Int', float: 'Float', string: 'Str', bool: 'Bool', entity: 'Entity',
  guid: 'GUID', 'vector3': 'Vec', faction: 'Faction', 'config_id': 'Config',
  'prefab_id': 'Prefab', list: 'List', dict: 'Dict', enum: 'Enum', generic: 'Generic'
};

// Index of a producer node's output pin by name (used to address data wires).
function outputIndexFor(node, pinName) {
  if (!node) return 0;
  const bp = getNodeBlueprint(node.blueprintId) || getNodeBlueprint(node.name);
  // The game's Monitor Signal composite exposes its runtime value on output index 3
  // (Pin_Path), behind the two Entity / GUID event-source outputs. Anything wired out
  // of a monitor that isn't a named source is that runtime value.
  if (node.blueprintId === 'event_monitor_signal') {
    const named = ['Event Source Entity', 'Event Source GUID', 'Signal Source Entity'];
    const i = named.indexOf(pinName);
    return i >= 0 ? i : 3;
  }
  const outs = (bp && bp.outputs) || [];
  const isSig = node.blueprintId === 'event_monitor_signal' || node.blueprintId === 'exec_send_signal';
  const customOuts = (isSig && Array.isArray(node.customOutputs)) ? node.customOutputs : [];
  const all = customOuts.length ? outs.concat(customOuts) : outs;
  const i = all.findIndex(o => o.name === pinName);
  return i >= 0 ? i : 0;
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

    const sigRename = new Map();
    if (payload.signals && Array.isArray(payload.signals)) {
      const created = signalsManager.importSignals(payload.signals);
      payload.signals.forEach((s, i) => {
        if (!s || !s.name) return;
        const finalName = created[i] && created[i].name;
        if (finalName && finalName !== s.name) sigRename.set(s.name, finalName);
      });
    }

    if (Array.isArray(payload.nodeGraphVariables)) {
      // Bring across the .gia's Node Graph Variables as brand-new variables
      // (name collisions get the trailing '_2' from addNodeGraphVariable).
      payload.nodeGraphVariables.forEach(v => {
        if (v && v.name) {
          graphState.addNodeGraphVariable(v.name, v.type, v.defaultValue || v.value || '');
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

      // Point signal nodes at the freshly imported (possibly name-suffixed) signal.
      if (nodeObj.inputValues?.['Signal Name'] && sigRename.has(nodeObj.inputValues['Signal Name'])) {
        const finalName = sigRename.get(nodeObj.inputValues['Signal Name']);
        nodeObj.inputValues['Signal Name'] = finalName;
        nodeObj.signalName = finalName;
      } else if (nodeObj.signalName && sigRename.has(nodeObj.signalName)) {
        nodeObj.signalName = sigRename.get(nodeObj.signalName);
        if (nodeObj.inputValues) nodeObj.inputValues['Signal Name'] = nodeObj.signalName;
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
      const dynamicInputKeys = [];

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
          } else if (p.value.bConcreteValue) {
            // Numeric literals are stored inside the concrete/reflective wrapper.
            const cv = p.value.bConcreteValue.value;
            if (cv?.bInt?.val !== undefined) val = String(cv.bInt.val);
            else if (cv?.bFloat?.val !== undefined) val = String(cv.bFloat.val);
            else if (cv?.bString?.val !== undefined) val = cv.bString.val;
            else if (cv?.bEnum?.val !== undefined) val = String(cv.bEnum.val);
            else if (cv?.bVector?.val) {
              const v = cv.bVector.val;
              val = `(${v.x || 0}, ${v.y || 0}, ${v.z || 0})`;
            }
          }
        }

        if (kind === 5 || p.clientExecNode?.kind === 6 || (p.value?.bString?.val && (baseName.includes('Signal') || baseName.includes('signal')))) {
          if (p.value?.bString?.val) {
            detectedSignalName = p.value.bString.val;
          }
        }

        if (kind === 3) {
          let inputType = null;
          let inputName = null;
          if (customInputs && customInputs[pIdx]) {
            inputType = customInputs[pIdx].type;
            inputName = customInputs[pIdx].name;
          } else if (bp && bp.inputs && bp.inputs[pIdx]) {
            inputType = bp.inputs[pIdx].type;
            inputName = bp.inputs[pIdx].name;
          } else {
            inputName = `param_${pIdx}`;
          }
          // Booleans surface as raw 0/1 (or Yes/No / True/False); normalize to True/False.
          const assignVal = inputType === 'bool' ? normalizeBoolValue(val) : val;
          // For dynamic-input nodes (Assembly List etc.) every kind:3 pin is one list
          // element, so we rebuild `.dynamicInputs` and key the value by element index.
          if (bp?.canAddDynamicInputs && bp?.id === 'op_assembly_list') {
            dynamicInputKeys.push(String(pIdx));
            inputValues[String(pIdx)] = assignVal;
          } else {
            inputValues[inputName] = assignVal;
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

      if (dynamicInputKeys.length > 0) {
        nodeInstance.dynamicInputs = dynamicInputKeys.sort((a, b) => Number(a) - Number(b));
      }

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

    // Collect the signals actually referenced by Send/Monitor Signal nodes in this
    // graph (e.g. "Spawn Grass" with an int Points_Set payload). These are the
    // meaningful signals the .gia carries, so importing registers them.
    const nodeSignalsByName = {};
    stateNodes.forEach(n => {
      if (n.blueprintId !== 'event_monitor_signal' && n.blueprintId !== 'exec_send_signal') return;
      const sigName = n.signalName || n.inputValues?.['Signal Name'];
      if (!sigName) return;
      let params;
      if (n.blueprintId === 'event_monitor_signal') {
        // Monitor Signal payload variables surface as output sockets beyond the 3 base outputs.
        const base = new Set(['Event Source Entity', 'Event Source GUID', 'Signal Source Entity']);
        params = (n.customOutputs || []).filter(p => !base.has(p.name)).map(p => ({ name: p.name, type: p.type }));
      } else {
        // Send Signal payload variables surface as its custom inputs.
        params = (n.customInputs || []).map(p => ({ name: p.name, type: p.type }));
      }
      if (!nodeSignalsByName[sigName]) {
        nodeSignalsByName[sigName] = { name: sigName, params };
      }
    });
    const nodeSignals = Object.values(nodeSignalsByName);

    // Prefer the node-referenced signals; fall back to accessory-derived defs.
    const importedSignals = nodeSignals.length > 0 ? nodeSignals : signals;

    // Read the graph's variables (round-trip for node graph variables).
    const graphNodeGraph = graphUnit?.graph?.inner?.graph;
    const importedGraphVars = ((graphNodeGraph && graphNodeGraph.graphValues) || []).map(gv => {
      let value = '';
      const v = gv.values;
      if (v) {
        if (v.bString?.val !== undefined) value = v.bString.val;
        else if (v.bInt?.val !== undefined) value = String(v.bInt.val);
        else if (v.bFloat?.val !== undefined) value = String(v.bFloat.val);
        else if (v.bEnum?.val !== undefined) value = v.bEnum.val ? 'True' : 'False';
        else if (v.bVector?.val) value = `(${v.bVector.val.x || 0}, ${v.bVector.val.y || 0}, ${v.bVector.val.z || 0})`;
        else if (v.bId?.val !== undefined) value = String(v.bId.val);
      }
      return { name: gv.name, type: mapVarType(gv.type), defaultValue: value, value };
    });

    return {
      graph: {
        name: graphName,
        type: 'Server',
        nodes: stateNodes,
        wires: stateWires,
        signals: importedSignals,
        nodeGraphVariables: importedGraphVars,
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

    const skipped = this._lastSkipped || [];
    if (skipped.length) {
      console.warn(
        `[gia] Skipped ${skipped.length} node(s) with no game template (omitted from .gia): ` +
        skipped.join(', ') +
        ' — these app-only nodes do not exist in Miliastra Wonderland, so they can\'t be encoded. Only real game nodes are exported.'
      );
    }

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
   * Build a genuine .gia binary from the CURRENT GraphState — encoding the
   * actual nodes, pin values, wires, signals and graph variables into the
   * protobuf structure. (Replaces the old behaviour of cloning garage.gia.)
   */
  static _graphStateToAst(graphState) {
    const stateNodes = graphState.nodes || [];
    const wires = graphState.wires || [];

    // Canonical signal composite accessories. The Miliastra game emits the three
    // standard composite defs (Monitor Signal / Send Signal / Send Signal to Server
    // Node Graph) crosslinked by relatedIds whenever a signal node is used. All
    // signal nodes then reference the matching composite by id; the actual signal
    // to (monitor|send) is carried on the node's own kind:5 param pin.
    const accessories = [];
    const MON_ID = 0x60000001;
    const SEND_ID = 0x60000002;
    const SEND_SRV_ID = 0x60000003;
    const usesMonitor = stateNodes.some(n => n.blueprintId === 'event_monitor_signal');
    const usesSend = stateNodes.some(n => n.blueprintId === 'exec_send_signal');
    const auditor = new Set();
    // The game always references the complete composite "family" (Monitor + Send +
    // Send-to-Server) as siblings via relatedIds. A lone Monitor composite gets
    // dropped because its family is incomplete.
    if (usesMonitor || usesSend) {
      auditor.add(MON_ID);
      auditor.add(SEND_ID);
      auditor.add(SEND_SRV_ID);
    }

    // Signal node -> the composite id it instantiates.
    const sigAccFor = n => {
      if (n.blueprintId === 'event_monitor_signal') return { id: MON_ID, label: 'Monitor Signal' };
      if (n.blueprintId === 'exec_send_signal') return { id: SEND_ID, label: 'Send Signal' };
      return null;
    };

    // Resolve a node to real game template ids. `real:false` means it's an
    // app-only blueprint with no counterpart in the game — writing a fabricated
    // id corrupts the target, so such nodes are skipped during export.
    const nodeIdNumbers = (n) => {
      // Signal (Monitor/Send) nodes are addressed by their composite accessory id —
      // both genericId and concreteId carry it (as in real .gia files).
      if (isSignalNode(n)) {
        const acc = sigAccFor(n);
        if (!acc) return { generic: null, concrete: null, real: false };
        return { generic: acc.id, concrete: acc.id, real: true };
      }
      const bp = getNodeBlueprint(n.blueprintId) || getNodeBlueprint(n.name);
      const baseKey = (n.name || bp?.name || bp?.id || 'Node').replace(/[^A-Za-z0-9]+/g, '_');
      let dataType = n.dataType || (n.pinTypes && n.pinTypes['Result']) || null;
      let concrete = null, generic = null;
      if (dataType && DATATYPE_SUFFIX[dataType]) {
        concrete = NODE_ID[`${baseKey}__${DATATYPE_SUFFIX[dataType]}`] ?? null;
      }
      generic = NODE_ID[`${baseKey}__Generic`] ?? NODE_ID[baseKey] ?? concrete ?? null;
      let real = generic != null;
      if (!concrete) concrete = generic;
      if (generic == null) { generic = concrete; }
      return { generic, concrete, real };
    };
    const isSignalNode = (n) => n.blueprintId === 'event_monitor_signal' || n.blueprintId === 'exec_send_signal';

    // Two passes: first resolve which nodes are real & keepable, then index.
    let kept = [];
    this._lastSkipped = [];
    stateNodes.forEach(n => {
      const nums = nodeIdNumbers(n);
      if (nums.real && nums.generic != null) {
        kept.push({ n, nums });
      } else {
        this._lastSkipped.push(n.name || n.blueprintId || 'unknown');
      }
    });
    const nodeIndex = new Map();
    kept.forEach((k, i) => nodeIndex.set(k.n.id, i + 1));   // game uses 1-based node indices
    const stateNodesKept = kept.map(k => k.n);
    const keptNums = new Map();
    kept.forEach(k => keptNums.set(k.n.id, k.nums));
    // Only wires between kept nodes survive.
    const keptWires = wires.filter(w => nodeIndex.has(w.fromNode) && nodeIndex.has(w.toNode));

    const byIdKept = new Map();
    stateNodesKept.forEach(n => byIdKept.set(n.id, n));

    const graphNodes = stateNodesKept.map((n, mi) => {
      const { generic, concrete } = keptNums.get(n.id);
      const bp = getNodeBlueprint(n.blueprintId) || getNodeBlueprint(n.name);
      const isSig = isSignalNode(n);

      const pins = [];
      const pin = (i1, extra) => Object.assign({
        i1: { kind: i1[0], index: i1[1] },
        i2: { kind: i1[0], index: i1[1] },
        type: 0
      }, extra);

      // Event source nodes ("the red ones") only carry the exec outflow — no input
      // or output pins (matches real .gia files exactly). Signal (monitor/send)
      // nodes are NOT bare events: they additionally carry their composite signal.
      const isEvent = !isSig && ((n.category || '') === 'event' || (n.blueprintId || '').startsWith('event_'));

      // Signal / Send nodes bind to a signal via a composite (kind:5) param pin that
      // carries the signal name as a string (the game template requires the pin to
      // exist). We export that value EMPTY: the node and its composite accessory are
      // kept so it survives round-trip, but the signal name is blanked out. We can't
      // wire real .gil signal references from the app (ids/references don't match our
      // app-side signals, and a fabricated one "nukes" the node), so the user re-assigns
      // the signal in the editor after importing.
      if (isSig) {
        pins.push(pin([5, 0], {
          value: { class: 5, alreadySetVal: true, itemType: valueItemType(6), bString: { val: '' } }
        }));
      }

      // Input parameters (data inputs). Wires on an input surface as connects.
      if (!isEvent) {
        const inputs = (bp && bp.inputs) || [];
        // Assembly List's only declared input (`0~99`) is a stand-in for its dynamic
        // element pins, which are exported separately below — don't double-emit it.
        const skipStatic = bp?.id === 'op_assembly_list';
        const allIns = skipStatic ? [] : ((isSig && bp?.id === 'exec_send_signal' && Array.isArray(n.customInputs)) ? inputs.concat(n.customInputs) : inputs);
        allIns.forEach((inp, i) => {
          const connWires = keptWires.filter(w => !w.isExec && w.toNode === n.id && w.toPin === inp.name);
          // Resolve the input's data type: use the connected producer's output type,
          // else infer a numeric literal, else the blueprint default.
          let resolvedType = inp.type || 'generic';
          if (connWires.length > 0) {
            // Resolve the connected producer's ACTUAL output type — first from the
            // node's configured pin type (the game writes the concrete type, e.g. an
            // Addition that gears its Result to ""), else from the blueprint output.
            const fromN = byIdKept.get(connWires[0].fromNode);
            const fromBp = (fromN && (getNodeBlueprint(fromN.blueprintId) || getNodeBlueprint(fromN.name))) || null;
            let fromType = fromN && fromN.pinTypes && fromN.pinTypes[connWires[0].fromPin];
            if (fromType && fromType !== 'generic') {
              resolvedType = fromType;
            } else {
              const out = fromBp && fromBp.outputs ? fromBp.outputs.find(o => o.name === connWires[0].fromPin) : null;
              if (out && out.type) resolvedType = out.type;
            }
          } else if (resolvedType === 'generic' || resolvedType === '') {
            // Only infer a numeric literal type when the interface truly is generic/
            // untyped — never override a declared asset type (prefab_id etc.).
            const lit = n.inputValues?.[inp.name] != null ? String(n.inputValues[inp.name]) : '';
            if (/^-?\d+$/.test(lit.trim())) resolvedType = 'int';
            else if (/^-?\d*\.\d+$/.test(lit.trim())) resolvedType = 'float';
          }
          const p = pin([3, gameInputSlot(bp?.id, inp.name, i)], { type: typeCode(resolvedType) });
          if (connWires.length === 0) {
            const raw = n.inputValues?.[inp.name] != null ? n.inputValues[inp.name] : inp.defaultVal;
            const val = inputPinValue(resolvedType, raw);
            if (val) p.value = val;
          } else {
            p.connects = connWires.map(w => {
              const prodOut = outputIndexFor(byIdKept.get(w.fromNode), w.fromPin);
              const conn = { kind: 4, index: prodOut };
              const c = { id: nodeIndex.get(w.fromNode), connect: conn, connect2: conn };
              return c;
            });
            // Real files also carry a placeholder value on wired inputs (a concrete
            // zero with alreadySetVal:false) so the slot is declared but unused.
            if (resolvedType === 'int' || resolvedType === 'float' || resolvedType === 'generic') {
              const num = 0;
              p.value = {
                class: 10000,
                alreadySetVal: false,
                bConcreteValue: {
                  indexOfConcrete: 5,
                  value: { class: resolvedType === 'float' ? 4 : 2, alreadySetVal: false, itemType: valueItemType(resolvedType === 'float' ? 5 : 3), bInt: { val: num } }
                }
              };
            }
          }
          pins.push(p);
        });

        // Data output pins (kind:4). The game's .gia carries a kind:4 pin per data
        // output, declaring the output's concrete data type (its type code + a value
        // slot). Nodes whose output type is generic/gear (e.g. Addition Result,
        // Get Custom Variable Value) draw their concrete type from the pin — without
        // it the game doesn't know the node's data type and any output wire upstream
        // is rejected, so the type and connection are lost. We emit a matching pin
        // for every data output, typed from the node's configured pin type.
        (bp?.outputs || []).forEach((out, oi) => {
          // The game only carries a kind:4 data-output pin for outputs whose type is
          // generic/gear (e.g. Addition Result, Get Variable Value), where the pin
          // declares the node's concrete data type. Fixed-type outputs (Equal Result =
          // bool, Get Random Result = int, Self Entity) get no k4 pin in real .gia files.
          const isGear = out.type === 'generic' || out.hasGear;
          if (!isGear) return;
          const outType = n.pinTypes?.[out.name] || out.type || 'generic';
          const p = pin([4, gameOutputSlot(bp?.id, out.name, oi)], { type: typeCode(outType) });
          if (outType === 'int' || outType === 'float' || outType === 'generic') {
            const isFl = outType === 'float';
            p.value = {
              class: 10000,
              alreadySetVal: false,
              bConcreteValue: {
                indexOfConcrete: 5,
                value: { class: isFl ? 4 : 2, alreadySetVal: false, itemType: valueItemType(isFl ? 5 : 3), bInt: { val: 0 } }
              }
            };
          }
          pins.push(p);
        });
        const dynKeys = Array.isArray(n.dynamicInputs) ? n.dynamicInputs : (bp?.canAddDynamicInputs ? ['0'] : []);
        if (bp?.canAddDynamicInputs && bp?.id === 'op_assembly_list') {
          // Element type: the gear on any element / the node datatype / the List pin.
          const elemType = n.pinTypes?.[dynKeys[0] || '0'] || n.dataType || n.pinTypes?.['List'] || 'generic';
          const tCode = typeCode(elemType);
          dynKeys.forEach((key, k) => {
            const connWires = keptWires.filter(w => !w.isExec && w.toNode === n.id && w.toPin === key);
            const p = pin([3, k], { type: tCode });
            if (connWires.length === 0) {
              const raw = n.inputValues?.[key] != null ? n.inputValues[key] : '';
              const val = inputPinValue(elemType, raw);
              if (val) p.value = val;
            } else {
              p.connects = connWires.map(w => {
                const prodOut = outputIndexFor(byIdKept.get(w.fromNode), w.fromPin);
                const conn = { kind: 4, index: prodOut };
                return { id: nodeIndex.get(w.fromNode), connect: conn, connect2: conn };
              });
            }
            pins.push(p);
          });
        }

        // Multiple Branches: the diagram's template also carries the branch indices as
        // a second input (kind:3 index:1, type list) — without it the imported node
        // shows only the orphaned Default/ghost wire and no branch pins.
        if ((bp?.id === 'flow_multiple_branches' || (n.name || '').toLowerCase() === 'multiple branches')) {
          const names = (bp && Array.isArray(bp.execOut)) ? bp.execOut.map(o => o.name) : ['Branch 0', 'Branch 1', 'Default'];
          const branchCount = Math.max(names.length - 1, 0); // all but Default
          if (branchCount > 0) {
            pins.push(pin([3, 1], {
              type: 8,
              value: {
                class: 10000, alreadySetVal: true,
                bConcreteValue: {
                  indexOfConcrete: 0,
                  value: {
                    class: 10002, alreadySetVal: true, itemType: valueItemType(8),
                    bArray: {
                      entries: Array.from({ length: branchCount }, (_, k) =>
                        ({ class: 2, alreadySetVal: true, itemType: valueItemType(3), bInt: { val: k } })
                      )
                    }
                  }
                }
              }
            }));
          }
        }
      }

      // Exec outflow — carries exec wires as connects on the sender.
      const outExecWires = keptWires.filter(w => w.isExec && w.fromNode === n.id);
      if (outExecWires.length > 0) {
        const byPin = new Map();
        outExecWires.forEach(w => {
          if (!byPin.has(w.fromPin)) byPin.set(w.fromPin, []);
          byPin.get(w.fromPin).push(w);
        });
        // Resolve each exec branch to its game outflow index. Double Branch uses
        // Yes=0 / No=1; Multiple Branches uses Branch N = N and Default = last slot.
        const isDouble = bp?.id === 'flow_double_branch' || (n.name || '').toLowerCase() === 'double branch';
        const isMulti = bp?.id === 'flow_multiple_branches' || (n.name || '').toLowerCase() === 'multiple branches';
        let outflowIndexForPin = () => 0;
        if (isDouble) outflowIndexForPin = (pinName) => (pinName === 'Yes' ? 0 : 1);
        else if (isMulti) {
          // In-game Multiple Branches numbering: Default = 0, then the user-made
          // branches follow as 1,2,3... So our "Branch 0/1/2" live at slots 1/2/3.
          outflowIndexForPin = (pinName) => {
            if (pinName === 'Default') return 0;
            const m = /^Branch\s*(\d+)$/i.exec(pinName || '');
            return m ? parseInt(m[1], 10) + 1 : 0;
          };
        }
        for (const [pinName, group] of byPin) {
          const s = outflowIndexForPin(pinName) || 0;
          pins.push(pin([2, s], {
            connects: group.map(w => {
              const conn = { kind: 1, index: 0 };
              return { id: nodeIndex.get(w.toNode), connect: conn, connect2: conn };
            })
          }));
        }
      }

      const nodeObj = {
        nodeIndex: mi + 1,
        genericId: { class: 10001, type: 20000, kind: 22000, nodeId: generic },
        x: Math.round(n.x || 0),
        y: Math.round(n.y || 0),
        pins,
        usingStruct: []
      };
      if (concrete != null) nodeObj.concreteId = { class: 10001, type: 20000, kind: 22000, nodeId: concrete };
      return nodeObj;
    });

    const accessoryIds = [...auditor];
    // Graph wrapper (mirrors the real unit: packed id, related unit refs).
    const graphUnit = {
      name: graphState.name || 'Exported_Graph',
      id: { class: 5, type: 0, id: 1073741824 + 4 },
      relatedIds: accessoryIds.map(i => ({ class: 0, type: 0, id: i })),
      which: 9,
      graph: {
        inner: {
          graph: {
            name: graphState.name || 'Exported_Graph',
            id: { class: 10000, type: 20000, kind: 21001, id: 1073741824 + 4 },
            nodes: graphNodes,
            graphValues: [],
            comments: [],
            compositePins: []
          }
        }
      }
    };

    // Accessories (signal composite defs) — mirror the game's canonical templates.
    if (auditor.size > 0) {
      const related = accessoryIds;
      const addAcc = (id, label, which, kind, pins) => {
        accessories.push({
          name: label,
          id: { class: 23, type: 0, id },
          relatedIds: related.filter(o => o !== id).map(i => ({ class: 23, type: 0, id: i })),
          which,
          compositeDef: {
            inner: {
              def: {
                name: label,
                description: '',
                inflows: pins.inflow || [],
                outflows: pins.outflow || [],
                inputs: pins.input || [],
                outputs: pins.output || [],
                id: {
                  genericId: { class: 10001, type: kind, kind: 22001, id },
                  concreteId: { class: 10001, type: kind, kind: 22000, id },
                  graphId: { class: 0, type: 0, kind: 0, id: 0 }
                },
                type: { kind: which === 12 ? 1002 : 1001 },
                xxx: 1
              }
            }
          }
        });
      };
      // Monitor Signal template (which:12, server composite)
      if (auditor.has(MON_ID)) {
        addAcc(MON_ID, 'Monitor Signal', 12, 20000, {
          outflow: [{ name: '', visible: true, index: { kind: 2, index: 0 }, description: '', pinIndex: 209 }],
          output: [
            { name: 'Event Source Entity', visible: true, index: { kind: 4, index: 0 }, type: { class: 0, type1: 1, type2: 1, valueId: null }, pinIndex: 211 },
            { name: 'Event Source GUID',   visible: true, index: { kind: 4, index: 1 }, type: { class: 1, type1: 2, type2: 2, valueId: null }, pinIndex: 212 },
            { name: 'Signal Source Entity', visible: true, index: { kind: 4, index: 2 }, type: { class: 0, type1: 1, type2: 1, valueId: null }, pinIndex: 213 },
            { name: 'Pick_Path', visible: true, index: { kind: 4, index: 3 }, type: { class: 2, type1: 3, type2: 3, valueId: null }, pinIndex: 214 }
          ]
        });
      }
      // Send Signal — which:14 (client composite), inflow + outflow + one Pick_Path input.
      if (auditor.has(SEND_ID)) {
        addAcc(SEND_ID, 'Send Signal', 14, 20002, {
          inflow: [{ name: '', visible: true, index: { kind: 1, index: 0 }, description: '', pinIndex: 205 }],
          outflow: [{ name: '', visible: true, index: { kind: 2, index: 0 }, description: '', pinIndex: 206 }],
          input: [{ name: 'Pick_Path', visible: true, index: { kind: 3, index: 0 }, type: { class: 2, type1: 3, type2: 3, valueId: null }, pinIndex: 208 }]
        });
      }
      // Send Signal to Server Node Graph (one-way, composer style).
      if (auditor.has(SEND_SRV_ID)) {
        addAcc(SEND_SRV_ID, 'Send Signal to Server Node Graph', 14, 20002, {
          inflow: [{ name: '', visible: true, index: { kind: 1, index: 0 }, description: '', pinIndex: 215 }],
          outflow: [{ name: '', visible: true, index: { kind: 2, index: 0 }, description: '', pinIndex: 216 }],
          input: [{ name: 'Pick_Path', visible: true, index: { kind: 3, index: 0 }, type: { class: 2, type1: 3, type2: 3, valueId: null }, pinIndex: 219 }]
        });
      }
    }

    return {
      filePath: `704602757-1789383177-1073741915-\\${(graphState.name || 'Exported_Graph').replace(/[^\w-]/g, '_')}.gia`,
      gameVersion: '7.0.0',
      graph: graphUnit,
      accessories
    };
  }

  /**
   * Rebuild a valid .gia binary from the current GraphState.
   */
  static async _buildGiaBinary(graphState) {
    const root = await getProtoRoot();
    const Type = root.lookupType('Root');

    const ast = this._graphStateToAst(graphState);

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
