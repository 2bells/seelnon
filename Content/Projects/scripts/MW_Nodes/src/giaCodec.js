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
    // Miliastra Wonderland built-in signal & structure node IDs
    reverseNodeIdMap[300000] = ['Send_Signal', 'exec_send_signal'];
    reverseNodeIdMap[300001] = ['Monitor_Signal', 'event_monitor_signal'];
    reverseNodeIdMap[300002] = ['Send_Signal_to_Server_Node_Graph', 'exec_send_signal_to_server_graph'];
    reverseNodeIdMap[300003] = ['Split_Structure', 'op_split_structure'];
    reverseNodeIdMap[300004] = ['Modify_Structure', 'op_modify_structure'];

    // Merge our synthetic app-blueprint ids so decode resolves them by blueprintId.
    const localReverse = {};
    for (const [bpId, id] of getLocalNodeIdMap()) {
      localReverse[id] = [bpId];
    }
    Object.assign(reverseNodeIdMap, localReverse);
  }
  return reverseNodeIdMap;
}

function accessoryTypeForPin(typeStr) {
  const t = (typeStr || 'generic').toLowerCase();
  const code = APP_TYPE_CODE[t] != null ? APP_TYPE_CODE[t] : 0;
  let cls = 0;
  if (t === 'entity') cls = 0;
  else if (t === 'guid') cls = 1;
  else if (t === 'int') cls = 2;
  else if (t === 'bool') cls = 3;
  else if (t === 'float') cls = 6;
  else if (t === 'string' || t === 'str') cls = 5;
  else if (t === 'vector3' || t === 'vec3') cls = 7;
  return { class: cls, type1: code, type2: code, valueId: null };
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
function enumValToString(val) {
  const n = typeof val === 'number' ? val : parseInt(val, 10);
  if (n === 600) return 'Ascending';
  if (n === 601) return 'Descending';
  if (n === 700) return 'Round';
  if (n === 701) return 'Round Up';
  if (n === 702) return 'Round Down';
  if (n === 703) return 'Truncate';
  return String(val);
}

function stringToEnumVal(valStr) {
  if (valStr == null) return 0;
  const s = String(valStr).trim();
  const n = parseInt(s, 10);
  if (isFinite(n)) return n;
  const lower = s.toLowerCase();
  if (lower === 'ascending') return 600;
  if (lower === 'descending') return 601;
  if (lower === 'round') return 700;
  if (lower === 'round up' || lower === 'ceil') return 701;
  if (lower === 'round down' || lower === 'floor') return 702;
  if (lower === 'truncate' || lower === 'trunc') return 703;
  return 0;
}

function baseValue(type, valStr) {
  if (valStr == null) return null;
  const s = String(valStr);
  const t = (type == null ? 'generic' : String(type)).toLowerCase();
  if (s === '' && t !== 'string') return null;
  const code = typeCode(t);
  switch (t) {
    case 'enum': {
      const n = stringToEnumVal(s);
      return { class: 6, alreadySetVal: true, itemType: valueItemType(code || 14), bEnum: { val: n } };
    }
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

// Decide the value written onto an unwired input pin for standard nodes.
function inputPinValue(blueprintType, existingVal) {
  const raw = existingVal == null ? '' : String(existingVal);
  return baseValue(blueprintType, raw);
}

const ASSEMBLY_LIST_CONCRETE = {
  int: 169, string: 170, str: 170, entity: 171, guid: 172,
  float: 173, vector3: 174, vec: 174, bool: 175, config_id: 568,
  config: 568, prefab_id: 569, prefab: 569, faction: 2640, generic: 169
};

const ASSEMBLY_CONCRETE_TYPE_INFO = {
  int:       { concIdx: 0, elemType: 3,  listType: 8,  elemClass: 2, defaultKey: 'bInt', defaultVal: { val: 0 } },
  bool:      { concIdx: 1, elemType: 4,  listType: 9,  elemClass: 6, defaultKey: 'bEnum', defaultVal: { val: 0 } },
  entity:    { concIdx: 2, elemType: 1,  listType: 13, elemClass: 1, defaultKey: 'bId', defaultVal: { val: 0 } },
  guid:      { concIdx: 3, elemType: 2,  listType: 7,  elemClass: 1, defaultKey: 'bId', defaultVal: { val: 0 } },
  float:     { concIdx: 4, elemType: 5,  listType: 10, elemClass: 4, defaultKey: 'bFloat', defaultVal: { val: 0 } },
  string:    { concIdx: 5, elemType: 6,  listType: 11, elemClass: 5, defaultKey: 'bString', defaultVal: { val: '' } },
  str:       { concIdx: 5, elemType: 6,  listType: 11, elemClass: 5, defaultKey: 'bString', defaultVal: { val: '' } },
  vector3:   { concIdx: 6, elemType: 12, listType: 15, elemClass: 7, defaultKey: 'bVector', defaultVal: { val: { x: 0, y: 0, z: 0 } } },
  vec:       { concIdx: 6, elemType: 12, listType: 15, elemClass: 7, defaultKey: 'bVector', defaultVal: { val: { x: 0, y: 0, z: 0 } } },
  config_id: { concIdx: 7, elemType: 20, listType: 22, elemClass: 1, defaultKey: 'bId', defaultVal: { val: 0 } },
  config:    { concIdx: 7, elemType: 20, listType: 22, elemClass: 1, defaultKey: 'bId', defaultVal: { val: 0 } },
  prefab_id: { concIdx: 8, elemType: 21, listType: 23, elemClass: 1, defaultKey: 'bId', defaultVal: { val: 0 } },
  prefab:    { concIdx: 8, elemType: 21, listType: 23, elemClass: 1, defaultKey: 'bId', defaultVal: { val: 0 } },
  faction:   { concIdx: 9, elemType: 17, listType: 24, elemClass: 1, defaultKey: 'bId', defaultVal: { val: 0 } },
  generic:   { concIdx: 0, elemType: 3,  listType: 8,  elemClass: 2, defaultKey: 'bInt', defaultVal: { val: 0 } }
};

const DATATYPE_SUFFIX = {
  int: 'Int', float: 'Float', string: 'Str', bool: 'Bool', entity: 'Entity',
  guid: 'GUID', 'vector3': 'Vec', faction: 'Faction', 'config_id': 'Config',
  'prefab_id': 'Prefab', list: 'List', dict: 'Dict', enum: 'Enum', generic: 'Generic',
  'int list': 'List_Int', 'float list': 'List_Float', 'string list': 'List_Str',
  'bool list': 'List_Bool', 'entity list': 'List_Entity', 'guid list': 'List_GUID',
  'vector3 list': 'List_Vec', 'config_id list': 'List_Config', 'prefab_id list': 'List_Prefab',
  'faction list': 'List_Faction'
};

function isGenericOpNode(bp, baseKey) {
  if (!bp && !baseKey) return false;
  const id = bp?.id || '';
  const key = baseKey || (bp?.name || '').replace(/[^A-Za-z0-9]+/g, '_');
  if (id === 'op_assembly_list' || id === 'exec_list_sorting' || id === 'exec_list_iteration_loop' || id === 'flow_multiple_branches') {
    return false;
  }
  if (['Addition', 'Subtraction', 'Multiplication', 'Division', 'Remainder', 'Negate',
       'Round_to_Integer_Operation', 'Clamp', 'Max', 'Min', 'Abs', 'Sign',
       'Equal', 'Not_Equal', 'Greater_Than', 'Less_Than', 'Greater_Than_or_Equal_To', 'Less_Than_or_Equal_To'
      ].includes(key)) {
    return true;
  }
  if (id.startsWith('op_addition') || id.startsWith('op_subtraction') || id.startsWith('op_multiplication') ||
      id.startsWith('op_division') || id.startsWith('op_clamp') || id.startsWith('op_max') ||
      id.startsWith('op_min') || id.startsWith('op_abs') || id.startsWith('op_equal') || id.startsWith('op_compare')) {
    return true;
  }
  return false;
}

// Index of a producer node's output pin by name (used to address data wires).
function outputIndexFor(node, pinName) {
  if (!node) return 0;
  const bp = getNodeBlueprint(node.blueprintId) || getNodeBlueprint(node.name);
  if (node.blueprintId === 'event_monitor_signal') {
    const named = ['Event Source Entity', 'Event Source GUID', 'Signal Source Entity'];
    const i = named.indexOf(pinName);
    if (i >= 0) return i;
    const sigName = (node.inputValues?.['Signal Name'] || node.signalName || '').trim();
    const def = (signalsManager && signalsManager.getSignal) ? signalsManager.getSignal(sigName) : null;
    const params = (def && Array.isArray(def.params)) ? def.params : (Array.isArray(node.customOutputs) ? node.customOutputs : []);
    const pIdx = params.findIndex(p => p.name === pinName);
    return pIdx >= 0 ? 3 + pIdx : 3;
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
    for (const acc of (ast.accessories || [])) {
      if (acc.id?.id) accessoryMap[acc.id.id] = acc;
    }

    const graphUnit = ast.graph;
    const graphName = graphUnit?.name || 'Imported_Graph';
    const rawNodes = graphUnit?.graph?.inner?.graph?.nodes || [];

    const signals = [];
    const getAccParams = (acc) => {
      const def = acc?.compositeDef?.inner?.def;
      if (!def) return [];
      const isMon = (acc?.name || def.name || '').toLowerCase().includes('monitor');
      const rawParams = (def.inputs && def.inputs.length > 0)
        ? def.inputs
        : (def.outputs && def.outputs.length > 3 && isMon ? def.outputs.slice(3) : (def.outputs || []));
      return rawParams.map(p => ({ name: p.name, type: mapVarType(p.type) }));
    };

    // Pre-pass: associate signal names on nodes with their accessory definitions
    const knownSignalMap = new Map();
    rawNodes.forEach(rn => {
      const concreteId = rn.concreteId?.nodeId;
      const genericId = rn.genericId?.nodeId;
      const acc = (concreteId && accessoryMap[concreteId]) || (genericId && accessoryMap[genericId]);
      let sigName = '';
      (rn.pins || []).forEach(p => {
        if (p.value?.bString?.val) sigName = p.value.bString.val.trim();
      });
      if (sigName && sigName !== 'no_signal') {
        const params = acc ? getAccParams(acc) : [];
        if (!knownSignalMap.has(sigName) || (params.length > 0 && knownSignalMap.get(sigName).length === 0)) {
          knownSignalMap.set(sigName, params);
        }
      }
    });

    for (const acc of (ast.accessories || [])) {
      const def = acc.compositeDef?.inner?.def;
      const accName = (def?.name || acc.name || '').trim();
      const isGenericName = ['monitor signal', 'send signal', 'send signal to server node graph'].includes(accName.toLowerCase());
      if (!isGenericName && accName) {
        if (!knownSignalMap.has(accName)) {
          knownSignalMap.set(accName, getAccParams(acc));
        }
      }
    }

    for (const [sigName, params] of knownSignalMap.entries()) {
      signalsManager.registerSignal(sigName, params);
      signals.push({ name: sigName, params });
    }

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

      // Direct identification of built-in special IDs (Signals & Structures)
      if (concreteId === 300001 || genericId === 300001) {
        bp = getNodeBlueprint('event_monitor_signal');
        baseName = 'Monitor Signal';
        rawName = 'Monitor Signal';
      } else if (concreteId === 300000 || genericId === 300000) {
        bp = getNodeBlueprint('exec_send_signal');
        baseName = 'Send Signal';
        rawName = 'Send Signal';
      } else if (concreteId === 300002 || genericId === 300002) {
        bp = getNodeBlueprint('exec_send_signal_to_server_graph') || getNodeBlueprint('exec_send_signal');
        baseName = 'Send Signal to Server Node Graph';
        rawName = 'Send Signal to Server Node Graph';
      } else if (concreteId === 300003 || genericId === 300003) {
        bp = getNodeBlueprint('op_split_structure');
        baseName = 'Split Structure';
        rawName = 'Split Structure';
      } else if (concreteId === 300004 || genericId === 300004) {
        bp = getNodeBlueprint('op_modify_structure');
        baseName = 'Modify Structure';
        rawName = 'Modify Structure';
      }

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
            const isMon = baseName.includes('Monitor') || accLower.includes('monitor');
            const rawOuts = isMon ? (compDef.outputs.length > 3 ? compDef.outputs.slice(3) : []) : compDef.outputs;
            if (rawOuts.length > 0) {
              customOutputs = rawOuts.map(o => ({ name: o.name, type: mapVarType(o.type) }));
            }
          }
        }
      }

      const id = `node_gia_${rn.nodeIndex}`;
      nodeIndexToId[rn.nodeIndex] = id;

      const inputValues = {};
      let detectedSignalName = '';
      if (accessory?.compositeDef?.inner?.def) {
        const cDef = accessory.compositeDef.inner.def;
        detectedSignalName = cDef.type?.monitorSignalRef?.name ||
                             cDef.type?.sendSignalRef?.name ||
                             (cDef.signalPins || []).find(sp => sp.name === 'Signal Name')?.value?.bString?.val ||
                             '';
      }
      const dynamicInputKeys = [];

      const isAssemblyList = (bp?.id === 'op_assembly_list' || bp?.canAddDynamicInputs || baseName === 'Assembly List' || genericId === 169);

      if (isAssemblyList) {
        // Assembly List: Pin 0 is the dynamic element COUNT (Int), Pins 1..N are element slots
        const countPin = (rn.pins || []).find(p => p.i1?.kind === 3 && p.i1?.index === 0);
        let listCount = 0;
        if (countPin?.value) {
          if (countPin.value.bInt?.val !== undefined) listCount = countPin.value.bInt.val;
          else if (countPin.value.bConcreteValue?.value?.bInt?.val !== undefined) listCount = countPin.value.bConcreteValue.value.bInt.val;
        }
        if (listCount <= 0) {
          const activePins = (rn.pins || []).filter(p => p.i1?.kind === 3 && p.i1?.index >= 1 && (p.connects?.length > 0 || p.value?.alreadySetVal || p.value?.bConcreteValue?.value?.alreadySetVal));
          listCount = activePins.length > 0 ? Math.max(...activePins.map(p => p.i1.index)) : 1;
        }

        for (let i = 0; i < listCount; i++) {
          const key = String(i);
          dynamicInputKeys.push(key);
          const p = (rn.pins || []).find(pin => pin.i1?.kind === 3 && pin.i1?.index === (i + 1));
          let val = '';
          if (p?.value) {
            const isSet = p.value.alreadySetVal !== false && (!p.value.bConcreteValue || p.value.bConcreteValue.value?.alreadySetVal !== false);
            if (isSet) {
              if (p.value.bString?.val !== undefined) val = p.value.bString.val;
              else if (p.value.bInt?.val !== undefined) val = String(p.value.bInt.val);
              else if (p.value.bFloat?.val !== undefined) val = String(p.value.bFloat.val);
              else if (p.value.bId?.val !== undefined) val = String(p.value.bId.val);
              else if (p.value.bEnum?.val !== undefined) val = enumValToString(p.value.bEnum.val);
              else if (p.value.bConcreteValue?.value) {
                const cv = p.value.bConcreteValue.value;
                if (cv.bInt?.val !== undefined) val = String(cv.bInt.val);
                else if (cv.bFloat?.val !== undefined) val = String(cv.bFloat.val);
                else if (cv.bString?.val !== undefined) val = cv.bString.val;
                else if (cv.bEnum?.val !== undefined) val = enumValToString(cv.bEnum.val);
              }
            }
          }
          inputValues[key] = val;
        }
      } else {
        (rn.pins || []).forEach(p => {
          const kind = p.i1?.kind;
          const pIdx = p.i1?.index;

          let val = '';
          if (p.value) {
            if (p.value.bString?.val !== undefined) val = p.value.bString.val;
            else if (p.value.bInt?.val !== undefined) val = String(p.value.bInt.val);
            else if (p.value.bFloat?.val !== undefined) val = String(p.value.bFloat.val);
            else if (p.value.bId?.val !== undefined) val = String(p.value.bId.val);
            else if (p.value.bEnum?.val !== undefined) val = enumValToString(p.value.bEnum.val);
            else if (p.value.bVector?.val) {
              const v = p.value.bVector.val;
              val = `(${v.x || 0}, ${v.y || 0}, ${v.z || 0})`;
            } else if (p.value.bConcreteValue) {
              // Numeric literals are stored inside the concrete/reflective wrapper.
              const cv = p.value.bConcreteValue.value;
              if (cv?.bInt?.val !== undefined) val = String(cv.bInt.val);
              else if (cv?.bFloat?.val !== undefined) val = String(cv.bFloat.val);
              else if (cv?.bString?.val !== undefined) val = cv.bString.val;
              else if (cv?.bEnum?.val !== undefined) val = enumValToString(cv.bEnum.val);
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
            inputValues[inputName] = assignVal;
          }
        });
      }

      const isSignalNode = (bp && (bp.id === 'event_monitor_signal' || bp.id === 'exec_send_signal' || bp.id === 'exec_send_signal_to_server_graph')) ||
        baseName.includes('Signal') || baseName.includes('signal') ||
        concreteId === 300000 || concreteId === 300001 || concreteId === 300002 ||
        genericId === 300000 || genericId === 300001 || genericId === 300002;

      if (detectedSignalName) {
        inputValues['Signal Name'] = detectedSignalName;
      } else if (accessory?.name && isSignalNode) {
        const cleanedName = accessory.name.replace(/^(Monitor|Send)\s+Signal\s*[:-]?\s*/i, '').trim();
        if (cleanedName && cleanedName !== accessory.name && !cleanedName.toLowerCase().includes('server node graph')) {
          inputValues['Signal Name'] = cleanedName;
          detectedSignalName = cleanedName;
        } else {
          inputValues['Signal Name'] = '';
        }
      } else if (isSignalNode) {
        inputValues['Signal Name'] = '';
      }

      if (isSignalNode && !bp) {
        if (baseName.includes('Server') || concreteId === 300002 || genericId === 300002) {
          bp = getNodeBlueprint('exec_send_signal_to_server_graph') || getNodeBlueprint('exec_send_signal');
        } else if (baseName.includes('Send') || concreteId === 300000 || genericId === 300000) {
          bp = getNodeBlueprint('exec_send_signal');
        } else {
          bp = getNodeBlueprint('event_monitor_signal');
        }
      }

      // Restore custom inputs/outputs from signalsManager if available
      const resolvedSigName = inputValues['Signal Name'];
      if (resolvedSigName && signalsManager.getSignal) {
        const sigDef = signalsManager.getSignal(resolvedSigName);
        if (sigDef && Array.isArray(sigDef.params) && sigDef.params.length > 0) {
          if (bp?.id === 'event_monitor_signal' && (!customOutputs || customOutputs.length === 0)) {
            customOutputs = sigDef.params.map(p => ({ name: p.name, type: p.type }));
          } else if ((bp?.id === 'exec_send_signal' || bp?.id === 'exec_send_signal_to_server_graph') && (!customInputs || customInputs.length === 0)) {
            customInputs = sigDef.params.map(p => ({ name: p.name, type: p.type }));
          }
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
      } else if (isSignalNode) {
        nodeInstance.signalName = '';
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
            if (fromBp?.id === 'flow_double_branch' || fromNode?.name === 'Double Branch') {
              fromPinName = fromPIdx === 0 ? 'Yes' : 'No';
            } else if (fromBp?.id === 'flow_multiple_branches' || fromNode?.name === 'Multiple Branches') {
              fromPinName = fromPIdx === 0 ? 'Default' : `Branch ${fromPIdx - 1}`;
            } else if (Array.isArray(fromBp?.execOut) && fromBp.execOut[fromPIdx]) {
              fromPinName = fromBp.execOut[fromPIdx].name || fromBp.execOut[fromPIdx] || 'execOut';
            }

            let toPinName = 'execIn';
            if (Array.isArray(toBp?.execInputs) && toBp.execInputs[toPIdx]) {
              toPinName = toBp.execInputs[toPIdx].name || toBp.execInputs[toPIdx] || 'execIn';
            } else if (Array.isArray(toBp?.execIn) && toBp.execIn[toPIdx]) {
              toPinName = toBp.execIn[toPIdx].name || toBp.execIn[toPIdx] || 'execIn';
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
            if (toNode?.blueprintId === 'op_assembly_list' || toNode?.name === 'Assembly List' || toBp?.id === 'op_assembly_list') {
              outPinName = 'List';
            } else if (toNode?.customOutputs && toNode.customOutputs[toPIdx]) {
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
            if (fromNode?.blueprintId === 'op_assembly_list' || fromNode?.name === 'Assembly List' || fromBp?.id === 'op_assembly_list') {
              inPinName = String(Math.max(0, fromPIdx - 1));
            } else if (fromNode?.customInputs && fromNode.customInputs[fromPIdx]) {
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

    // Canonical signal composite accessories. The Miliastra game emits composite defs
    // (Monitor Signal / Send Signal / Send Signal to Server Node Graph) crosslinked
    // by relatedIds whenever configured signal nodes are used. All configured signal
    // nodes then reference their matching composite by id, and carry the signal name
    // on the node's own kind:5 param pin.
    // Empty/unconfigured signal nodes use the built-in game node IDs (300001 / 300000 / 300002).
    const accessories = [];
    const isSignalNode = (n) => n.blueprintId === 'event_monitor_signal' || n.blueprintId === 'exec_send_signal' || n.blueprintId === 'exec_send_signal_to_server_graph';

    const allSignalsMap = new Map();

    // 1. Gather signals from nodes on canvas (only export signals actively used in this graph)
    // If a signal node has no name or 'no_signal', auto-assign a valid signal name to prevent empty ghost signals in-game
    stateNodes.forEach(n => {
      if (!isSignalNode(n)) return;
      let rawSig = (n.inputValues?.['Signal Name'] || n.signalName || '').trim();
      if (!rawSig || rawSig === 'no_signal') {
        const allSigs = (signalsManager && signalsManager.getSignals) ? signalsManager.getSignals() : [];
        if (allSigs.length > 0 && allSigs[0].name) {
          rawSig = allSigs[0].name;
        } else {
          rawSig = 's_Signal_1';
          if (signalsManager && signalsManager.addSignal) {
            signalsManager.addSignal(rawSig, []);
          }
        }
        if (!n.inputValues) n.inputValues = {};
        n.inputValues['Signal Name'] = rawSig;
        n.signalName = rawSig;
      }
      if (!allSignalsMap.has(rawSig)) {
        let params = [];
        const def = (signalsManager && signalsManager.getSignal) ? signalsManager.getSignal(rawSig) : null;
        if (def && Array.isArray(def.params) && def.params.length > 0) {
          params = def.params;
        } else if (Array.isArray(n.customInputs) && n.customInputs.length > 0) {
          params = n.customInputs;
        } else if (Array.isArray(n.customOutputs) && n.customOutputs.length > 0 && n.blueprintId === 'event_monitor_signal') {
          params = n.customOutputs.filter(p => !['Event Source Entity', 'Event Source GUID', 'Signal Source Entity'].includes(p.name));
        }
        allSignalsMap.set(rawSig, params);
      }
    });

    // 2. Allocate canonical triplets and accurate pin indices for each signal
    const sigDefMap = new Map();
    let nextAccId = 1610612737; // 0x60000001
    let currentBasePinIdx = 220;
    let sigIdxCounter = 1;

    allSignalsMap.forEach((params, sigName) => {
      const sendId = nextAccId++;
      const monitorId = nextAccId++;
      const serverSendId = nextAccId++;
      const sigIndex = sigIdxCounter++;

      const paramCount = params.length;
      const sendInflowPinIdx = currentBasePinIdx;
      const sendOutflowPinIdx = currentBasePinIdx + 1;
      const sendNamePinIdx = currentBasePinIdx + 2;
      const sendInputPinIdxs = [];
      for (let i = 0; i < paramCount; i++) {
        sendInputPinIdxs.push(currentBasePinIdx + 3 + i);
      }

      const monitorBase = sendInputPinIdxs.length > 0 ? (sendInputPinIdxs[sendInputPinIdxs.length - 1] + 1) : (currentBasePinIdx + 4);
      const monitorOutflowPinIdx = monitorBase;
      const monitorNamePinIdx = monitorBase + 1;
      const monitorBuiltinPinIdxs = [
        monitorNamePinIdx + 1, // Event Source Entity
        monitorNamePinIdx + 2, // Event Source GUID
        monitorNamePinIdx + 3  // Signal Source Entity
      ];
      const monitorOutputPinIdxs = [];
      for (let i = 0; i < paramCount; i++) {
        monitorOutputPinIdxs.push(monitorNamePinIdx + 4 + i);
      }

      const serverSendBase = (monitorOutputPinIdxs.length > 0 ? monitorOutputPinIdxs[monitorOutputPinIdxs.length - 1] : monitorBuiltinPinIdxs[2]) + 1;
      const serverSendInflowPinIdx = serverSendBase;
      const serverSendOutflowPinIdx = serverSendBase + 1;
      const serverSendNamePinIdx = serverSendBase + 2;
      const serverSendInputPinIdxs = [];
      for (let i = 0; i < paramCount; i++) {
        serverSendInputPinIdxs.push(serverSendBase + 3 + i);
      }

      currentBasePinIdx = (serverSendInputPinIdxs.length > 0 ? serverSendInputPinIdxs[serverSendInputPinIdxs.length - 1] : serverSendOutflowPinIdx) + 5;

      sigDefMap.set(sigName, {
        sigName,
        sigIndex,
        sendId,
        monitorId,
        serverSendId,
        params,
        sendInflowPinIdx,
        sendOutflowPinIdx,
        sendNamePinIdx,
        sendInputPinIdxs,
        monitorOutflowPinIdx,
        monitorNamePinIdx,
        monitorBuiltinPinIdxs,
        monitorOutputPinIdxs,
        serverSendInflowPinIdx,
        serverSendOutflowPinIdx,
        serverSendNamePinIdx,
        serverSendInputPinIdxs
      });
    });

    const sigAccFor = (n) => {
      if (!isSignalNode(n)) return null;
      const rawSig = (n.inputValues?.['Signal Name'] || n.signalName || '').trim();
      if (!rawSig || rawSig === 'no_signal') return null;
      const entry = sigDefMap.get(rawSig);
      if (!entry) return null;
      const id = (n.blueprintId === 'event_monitor_signal')
        ? entry.monitorId
        : (n.blueprintId === 'exec_send_signal_to_server_graph' ? entry.serverSendId : entry.sendId);
      return { id, entry };
    };

    // Resolve a node to real game template ids. `real:false` means it's an
    // app-only blueprint with no counterpart in the game — writing a fabricated
    // id corrupts the target, so such nodes are skipped during export.
    const nodeIdNumbers = (n) => {
      // Signal (Monitor/Send) nodes: if configured with a signal name, addressed by composite accessory id.
      // If empty, addressed by built-in node ID (300001 for Monitor, 300000 for Send, 300002 for Server Send).
      if (isSignalNode(n)) {
        const acc = sigAccFor(n);
        if (acc) {
          return { generic: acc.id, concrete: acc.id, real: true, isComposite: true };
        }
        const emptyId = n.blueprintId === 'event_monitor_signal' ? 300001
                      : n.blueprintId === 'exec_send_signal_to_server_graph' ? 300002
                      : 300000;
        return { generic: emptyId, concrete: emptyId, real: true, isComposite: false };
      }
      const bp = getNodeBlueprint(n.blueprintId) || getNodeBlueprint(n.name);
      const baseKey = (n.name || bp?.name || bp?.id || 'Node').replace(/[^A-Za-z0-9]+/g, '_');

      if (bp?.id === 'op_assembly_list' || baseKey === 'Assembly_List' || (n.name || '').toLowerCase() === 'assembly list') {
        const dynKeys = Array.isArray(n.dynamicInputs) ? n.dynamicInputs : ['0'];
        const rawElem = n.dataType || n.pinTypes?.[dynKeys[0] || '0'] || n.pinTypes?.['List'] || 'generic';
        const elemType = String(rawElem).replace(/\s+list$/i, '').trim().toLowerCase();
        const concrete = ASSEMBLY_LIST_CONCRETE[elemType] || 169;
        return { generic: 169, concrete, real: true, isComposite: false };
      }

      let dataType = n.dataType || (n.pinTypes && n.pinTypes['Result']) || null;
      if (!dataType) {
        const outW = wires.find(w => !w.isExec && w.fromNode === n.id);
        if (outW) {
          const toN = stateNodes.find(sn => sn.id === outW.toNode);
          const toBp = toN && (getNodeBlueprint(toN.blueprintId) || getNodeBlueprint(toN.name));
          const targetInp = toBp?.inputs?.find(i => i.name === outW.toPin);
          if (targetInp && targetInp.type && targetInp.type !== 'generic') {
            dataType = targetInp.type;
          }
        }
      }
      if (!dataType) {
        const inW = wires.find(w => !w.isExec && w.toNode === n.id);
        if (inW) {
          const fromN = stateNodes.find(sn => sn.id === inW.fromNode);
          const fromBp = fromN && (getNodeBlueprint(fromN.blueprintId) || getNodeBlueprint(fromN.name));
          let fType = fromN?.pinTypes?.[inW.fromPin];
          if (!fType || fType === 'generic') {
            const outDef = fromBp?.outputs?.find(o => o.name === inW.fromPin);
            fType = outDef?.type;
          }
          if (fType && fType !== 'generic') {
            dataType = fType;
          }
        }
      }
      if (!dataType && bp?.category === 'operation') {
        if (n.inputValues) {
          for (const v of Object.values(n.inputValues)) {
            if (/^-?\d*\.\d+$/.test(String(v || '').trim()) && String(v || '').includes('.')) {
              dataType = 'float';
              break;
            }
          }
        }
      }
      if (!dataType && isGenericOpNode(bp, baseKey)) {
        dataType = 'int';
      }

      let concrete = null, generic = null;
      if (dataType && DATATYPE_SUFFIX[dataType]) {
        concrete = NODE_ID[`${baseKey}__${DATATYPE_SUFFIX[dataType]}`] ?? null;
      }
      generic = NODE_ID[`${baseKey}__Generic`] ?? NODE_ID[baseKey] ?? concrete ?? null;
      let real = generic != null;
      if (!concrete) concrete = generic;
      if (generic == null) { generic = concrete; }
      return { generic, concrete, real, isComposite: false, dataType };
    };

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
      const nums = keptNums.get(n.id) || {};
      const { generic, concrete } = nums;
      const bp = getNodeBlueprint(n.blueprintId) || getNodeBlueprint(n.name);
      const baseKey = (n.name || bp?.name || bp?.id || 'Node').replace(/[^A-Za-z0-9]+/g, '_');
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
      // carries the signal name as a string when configured.
      if (isSig) {
        const rawSig = (n.inputValues?.['Signal Name'] || n.signalName || '').trim();
        const sigEntry = (rawSig && rawSig !== 'no_signal') ? sigDefMap.get(rawSig) : null;
        if (sigEntry) {
          const namePinIdx = (n.blueprintId === 'event_monitor_signal')
            ? sigEntry.monitorNamePinIdx
            : sigEntry.sendNamePinIdx;
          pins.push({
            i1: { kind: 5, index: 0 },
            i2: null,
            type: 0,
            value: { class: 5, alreadySetVal: true, itemType: valueItemType(0), bString: { val: rawSig } },
            clientExecNode: { kind: 6, index: sigEntry.sigIndex || 1 },
            compositePinIndex: namePinIdx
          });
        }
      }

      // Input parameters (data inputs). Wires on an input surface as connects.
      if (!isEvent) {
        const inputs = (bp && bp.inputs) || [];
        // Assembly List's only declared input (`0~99`) is a stand-in for its dynamic
        // element pins, which are exported separately below — don't double-emit it.
        const skipStatic = bp?.id === 'op_assembly_list';
        let allIns = skipStatic ? [] : inputs;
        if (isSig && (bp?.id === 'exec_send_signal' || bp?.id === 'exec_send_signal_to_server_graph')) {
          const rawSig = (n.inputValues?.['Signal Name'] || n.signalName || '').trim();
          const def = (signalsManager && signalsManager.getSignal) ? signalsManager.getSignal(rawSig) : null;
          const sigParams = (def && Array.isArray(def.params) && def.params.length > 0)
            ? def.params
            : (Array.isArray(n.customInputs) ? n.customInputs : []);
          allIns = inputs.concat(sigParams);
        }
        const nodeDataType = nums.dataType || n.dataType || 'int';

        allIns.forEach((inp, i) => {
          const connWires = keptWires.filter(w => !w.isExec && w.toNode === n.id && w.toPin === inp.name);
          let resolvedType = inp.type || 'generic';
          const isGenOp = isGenericOpNode(bp, baseKey);

          if (isGenOp && (inp.type === 'generic' || inp.hasGear || !inp.type)) {
            resolvedType = (nodeDataType === 'float' ? 'float' : 'int');
          } else if (connWires.length > 0) {
            const fromN = byIdKept.get(connWires[0].fromNode);
            const fromBp = (fromN && (getNodeBlueprint(fromN.blueprintId) || getNodeBlueprint(fromN.name))) || null;
            let fromType = fromN && fromN.pinTypes && fromN.pinTypes[connWires[0].fromPin];
            if (!fromType || fromType === 'generic') {
              if (fromN && fromN.dataType) fromType = fromN.dataType;
            }
            if (fromType && fromType !== 'generic') {
              resolvedType = fromType;
            } else {
              const out = fromBp && fromBp.outputs ? fromBp.outputs.find(o => o.name === connWires[0].fromPin) : null;
              if (out && out.type) resolvedType = out.type;
            }
          } else if (resolvedType === 'generic' || resolvedType === '') {
            const lit = n.inputValues?.[inp.name] != null ? String(n.inputValues[inp.name]) : '';
            if (/^-?\d*\.\d+$/.test(lit.trim()) && lit.includes('.')) resolvedType = 'float';
            else if (/^-?\d+$/.test(lit.trim())) resolvedType = 'int';
          }

          if (bp?.id === 'exec_list_sorting' && inp.name === 'List') {
            if (connWires.length > 0) {
              const fromN = byIdKept.get(connWires[0].fromNode);
              const fromElem = fromN?.dataType || 'float';
              resolvedType = fromElem === 'float' ? 'float list' : 'int list';
            } else {
              resolvedType = (n.dataType === 'float' ? 'float list' : 'int list');
            }
          }

          const slotIdx = gameInputSlot(bp?.id, inp.name, i);
          const p = pin([3, slotIdx], { type: typeCode(resolvedType) });

          if (connWires.length === 0) {
            const raw = n.inputValues?.[inp.name] != null ? n.inputValues[inp.name] : inp.defaultVal;
            if (isGenOp) {
              const isFl = resolvedType === 'float';
              const concIdx = isFl ? 1 : 0;
              const typeNum = isFl ? 5 : 3;
              const valClass = isFl ? 4 : 2;
              const valKey = isFl ? 'bFloat' : 'bInt';
              const num = isFl ? (parseFloat(raw) || 0) : (parseInt(raw, 10) || 0);
              p.type = typeNum;
              p.value = {
                class: 10000,
                alreadySetVal: true,
                bConcreteValue: {
                  indexOfConcrete: concIdx,
                  value: {
                    class: valClass,
                    alreadySetVal: true,
                    itemType: valueItemType(typeNum),
                    [valKey]: { val: num }
                  }
                }
              };
            } else {
              const val = baseValue(resolvedType, raw);
              if (val) p.value = val;
            }
          } else {
            p.connects = connWires.map(w => {
              const prodOut = outputIndexFor(byIdKept.get(w.fromNode), w.fromPin);
              const conn = { kind: 4, index: prodOut };
              return { id: nodeIndex.get(w.fromNode), connect: conn, connect2: conn };
            });

            if (bp?.id === 'exec_list_sorting' && inp.name === 'List') {
              const isFl = (resolvedType === 'float list' || n.dataType === 'float');
              const listType = isFl ? 10 : 8;
              const concIdx = isFl ? 1 : 0;
              p.type = listType;
              p.value = {
                class: 10000,
                alreadySetVal: true,
                bConcreteValue: {
                  indexOfConcrete: concIdx,
                  value: {
                    class: 10002,
                    alreadySetVal: false,
                    itemType: valueItemType(listType),
                    bArray: { entries: [] }
                  }
                }
              };
            } else if (bp?.id === 'exec_list_iteration_loop' && inp.name === 'List') {
              const isFl = (resolvedType === 'float list' || n.dataType === 'float');
              const listType = isFl ? 10 : 8;
              const concIdx = isFl ? 1 : 4;
              p.type = listType;
              p.value = {
                class: 10000,
                alreadySetVal: true,
                bConcreteValue: {
                  indexOfConcrete: concIdx,
                  value: {
                    class: 10002,
                    alreadySetVal: false,
                    itemType: valueItemType(listType),
                    bArray: { entries: [] }
                  }
                }
              };
            } else if (bp?.id === 'exec_set_node_graph_variable' && inp.name === 'Variable Value') {
              const isFl = (resolvedType === 'float' || n.dataType === 'float');
              const varType = isFl ? 5 : 3;
              p.type = varType;
              p.value = {
                class: 10000,
                alreadySetVal: true,
                bConcreteValue: {
                  indexOfConcrete: 0,
                  value: {
                    class: isFl ? 4 : 2,
                    alreadySetVal: false,
                    itemType: valueItemType(varType),
                    [isFl ? 'bFloat' : 'bInt']: { val: 0 }
                  }
                }
              };
            } else if (bp?.id === 'flow_multiple_branches' && inp.name === 'Control Expression') {
              p.type = 3;
              p.value = {
                class: 10000,
                alreadySetVal: true,
                bConcreteValue: {
                  indexOfConcrete: 0,
                  value: {
                    class: 2,
                    alreadySetVal: false,
                    itemType: valueItemType(3),
                    bInt: { val: 0 }
                  }
                }
              };
            } else {
              // Standard wired inputs: value is null!
              p.value = null;
            }
          }
          pins.push(p);
        });

        // Data output pins (kind:4).
        const isAssemblyList = bp?.id === 'op_assembly_list' || (n.name || '').toLowerCase() === 'assembly list';
        if (!isAssemblyList) {
          (bp?.outputs || []).forEach((out, oi) => {
            const isGear = out.type === 'generic' || out.hasGear;
            if (!isGear && bp?.id !== 'exec_list_iteration_loop') return;

            let outType = n.pinTypes?.[out.name] || out.type || 'generic';
            const isGenOp = isGenericOpNode(bp, baseKey);
            if (isGenOp) {
              outType = (nodeDataType === 'float' ? 'float' : 'int');
            }

            const p = pin([4, gameOutputSlot(bp?.id, out.name, oi)], { type: typeCode(outType) });
            if (isGenOp) {
              const isFl = outType === 'float';
              const concIdx = isFl ? 1 : 0;
              const typeNum = isFl ? 5 : 3;
              const valClass = isFl ? 4 : 2;
              const valKey = isFl ? 'bFloat' : 'bInt';
              p.type = typeNum;
              p.value = {
                class: 10000,
                alreadySetVal: true,
                bConcreteValue: {
                  indexOfConcrete: concIdx,
                  value: {
                    class: valClass,
                    alreadySetVal: false,
                    itemType: valueItemType(typeNum),
                    [valKey]: { val: 0 }
                  }
                }
              };
            } else if (bp?.id === 'exec_list_iteration_loop' && out.name === 'Value') {
              const isFl = (nodeDataType === 'float' || outType === 'float');
              const typeNum = isFl ? 5 : 3;
              const concIdx = isFl ? 1 : 4;
              p.type = typeNum;
              p.value = {
                class: 10000,
                alreadySetVal: true,
                bConcreteValue: {
                  indexOfConcrete: concIdx,
                  value: {
                    class: isFl ? 4 : 2,
                    alreadySetVal: false,
                    itemType: valueItemType(typeNum),
                    [isFl ? 'bFloat' : 'bInt']: { val: 0 }
                  }
                }
              };
            }
            pins.push(p);
          });
        }

        // Assembly List: exactly 102 pins (Pin 0 = count, Pins 1..100 = dynamic elements, Pin 101 = List outParam)
        if (isAssemblyList) {
          const dynKeys = Array.isArray(n.dynamicInputs) ? n.dynamicInputs : ['0'];
          const rawElem = n.dataType || n.pinTypes?.[dynKeys[0] || '0'] || n.pinTypes?.['List'] || 'generic';
          const elemType = String(rawElem).replace(/\s+list$/i, '').trim().toLowerCase();
          const info = ASSEMBLY_CONCRETE_TYPE_INFO[elemType] || ASSEMBLY_CONCRETE_TYPE_INFO.generic;

          // Pin 0: Count of dynamic elements (type: 3 Int)
          pins.push(pin([3, 0], {
            type: 3,
            value: {
              class: 2,
              alreadySetVal: true,
              itemType: valueItemType(3),
              bInt: { val: dynKeys.length }
            }
          }));

          // Pins 1 to 100: dynamic input elements (100 total parameter slots)
          for (let slot = 1; slot <= 100; slot++) {
            const keyIdx = slot - 1;
            const p = pin([3, slot], { type: info.elemType });
            if (keyIdx < dynKeys.length) {
              const key = dynKeys[keyIdx];
              const connWires = keptWires.filter(w => !w.isExec && w.toNode === n.id && w.toPin === key);
              if (connWires.length > 0) {
                p.connects = connWires.map(w => {
                  const prodOut = outputIndexFor(byIdKept.get(w.fromNode), w.fromPin);
                  const conn = { kind: 4, index: prodOut };
                  return { id: nodeIndex.get(w.fromNode), connect: conn, connect2: conn };
                });
              } else {
                const raw = n.inputValues?.[key] != null ? n.inputValues[key] : '';
                const base = baseValue(elemType, raw) || {
                  class: info.elemClass,
                  alreadySetVal: raw !== '',
                  itemType: valueItemType(info.elemType),
                  [info.defaultKey]: info.defaultVal
                };
                p.value = {
                  class: 10000,
                  alreadySetVal: true,
                  bConcreteValue: {
                    indexOfConcrete: info.concIdx,
                    value: base
                  }
                };
              }
            } else {
              // Unused element placeholder
              p.value = {
                class: 10000,
                alreadySetVal: true,
                bConcreteValue: {
                  indexOfConcrete: info.concIdx,
                  value: {
                    class: info.elemClass,
                    alreadySetVal: false,
                    itemType: valueItemType(info.elemType),
                    [info.defaultKey]: info.defaultVal
                  }
                }
              };
            }
            pins.push(p);
          }

          // Pin 101: Data Output 'List' (kind: 4, index: 0, type: listType)
          pins.push(pin([4, 0], {
            type: info.listType,
            value: {
              class: 10000,
              alreadySetVal: true,
              bConcreteValue: {
                indexOfConcrete: info.concIdx,
                value: {
                  class: 10002,
                  alreadySetVal: false,
                  itemType: valueItemType(info.listType),
                  bArray: { entries: [] }
                }
              }
            }
          }));
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
      // Exec outflow — carries exec wires as connects on the sender.
      const outExecWires = keptWires.filter(w => w.isExec && w.fromNode === n.id);
      if (outExecWires.length > 0) {
        const byPin = new Map();
        outExecWires.forEach(w => {
          if (!byPin.has(w.fromPin)) byPin.set(w.fromPin, []);
          byPin.get(w.fromPin).push(w);
        });

        const isDouble = bp?.id === 'flow_double_branch' || (n.name || '').toLowerCase() === 'double branch';
        const isMulti = bp?.id === 'flow_multiple_branches' || (n.name || '').toLowerCase() === 'multiple branches';
        let outflowIndexForPin = (pinName) => 0;
        if (isDouble) {
          outflowIndexForPin = (pinName) => (pinName === 'Yes' ? 0 : 1);
        } else if (isMulti) {
          outflowIndexForPin = (pinName) => {
            if (pinName === 'Default') return 0;
            const m = /^Branch\s*(\d+)$/i.exec(pinName || '');
            return m ? parseInt(m[1], 10) + 1 : 0;
          };
        } else if (Array.isArray(bp?.execOut) && bp.execOut.length > 1) {
          outflowIndexForPin = (pinName) => {
            const idx = bp.execOut.findIndex(e => (typeof e === 'string' ? e : e.name) === pinName);
            return idx >= 0 ? idx : 0;
          };
        }

        const bySlot = new Map();
        for (const [pinName, group] of byPin) {
          const s = outflowIndexForPin(pinName) || 0;
          if (!bySlot.has(s)) bySlot.set(s, []);
          bySlot.get(s).push(...group);
        }

        const sortedSlots = [...bySlot.keys()].sort((a, b) => a - b);
        for (const s of sortedSlots) {
          const group = bySlot.get(s);
          const p = pin([2, s], {
            connects: group.map(w => {
              let toPIdx = 0;
              const toTarget = byIdKept.get(w.toNode);
              const toBp = toTarget && (getNodeBlueprint(toTarget.blueprintId) || getNodeBlueprint(toTarget.name));
              if (toBp && Array.isArray(toBp.execInputs)) {
                const idx = toBp.execInputs.findIndex(e => (typeof e === 'string' ? e : e.name) === w.toPin);
                if (idx >= 0) toPIdx = idx;
              } else if (toBp && Array.isArray(toBp.execIn)) {
                const idx = toBp.execIn.findIndex(e => (typeof e === 'string' ? e : e.name) === w.toPin);
                if (idx >= 0) toPIdx = idx;
              }
              const conn = { kind: 1, index: toPIdx };
              return { id: nodeIndex.get(w.toNode), connect: conn, connect2: conn };
            })
          });
          if (isSig) {
            const rawSig = (n.inputValues?.['Signal Name'] || n.signalName || '').trim();
            const sigEntry = (rawSig && rawSig !== 'no_signal') ? sigDefMap.get(rawSig) : null;
            if (sigEntry) {
              p.compositePinIndex = (n.blueprintId === 'event_monitor_signal')
                ? sigEntry.monitorOutflowPinIdx
                : (n.blueprintId === 'exec_send_signal_to_server_graph' ? sigEntry.serverSendOutflowPinIdx : sigEntry.sendOutflowPinIdx);
            }
          }
          pins.push(p);
        }
      }

      // Sort pins so kinds are ordered: 2 (exec outflow), 3 (inputs), 4 (data outputs), 5 (signal)
      pins.sort((a, b) => {
        const order = { 2: 1, 3: 2, 4: 3, 5: 4 };
        const ka = order[a.i1?.kind] || 99;
        const kb = order[b.i1?.kind] || 99;
        if (ka !== kb) return ka - kb;
        return (a.i1?.index || 0) - (b.i1?.index || 0);
      });

      const nodeObj = {
        nodeIndex: mi + 1,
        genericId: { class: 10001, type: 20000, kind: nums.isComposite ? 22001 : 22000, nodeId: generic },
        x: Math.round(n.x || 0),
        y: Math.round(n.y || 0),
        pins,
        usingStruct: []
      };
      if (nums.isComposite) {
        nodeObj.concreteId = { class: 10001, type: 20000, kind: 22001, nodeId: concrete };
      } else if (concrete != null && concrete !== 300001 && concrete !== 300000 && concrete !== 300002) {
        nodeObj.concreteId = { class: 10001, type: 20000, kind: 22000, nodeId: concrete };
      }
      if (isSig) {
        const rawSig = (n.inputValues?.['Signal Name'] || n.signalName || '').trim();
        if (rawSig && rawSig !== 'no_signal') {
          nodeObj.signalVersion = (n.blueprintId === 'event_monitor_signal' || n.name === 'Monitor Signal') ? 2 : 1;
        }
      }
      return nodeObj;
    });

    const graphRelatedIds = [];
    sigDefMap.forEach(item => {
      graphRelatedIds.push({ class: 23, type: 0, id: item.monitorId });
    });

    // Graph wrapper (mirrors the real unit: packed id, related unit refs).
    const graphUnit = {
      name: graphState.name || 'Exported_Graph',
      id: { class: 5, type: 0, id: 1073741824 + 4 },
      relatedIds: graphRelatedIds,
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

    // Accessories (signal composite defs) — mirror the game's canonical triplets.
    if (sigDefMap.size > 0) {
      sigDefMap.forEach((item) => {
        const {
          sigName, sigIndex,
          sendId, monitorId, serverSendId, params,
          sendInflowPinIdx, sendOutflowPinIdx, sendNamePinIdx, sendInputPinIdxs,
          monitorOutflowPinIdx, monitorNamePinIdx, monitorBuiltinPinIdxs, monitorOutputPinIdxs,
          serverSendInflowPinIdx, serverSendOutflowPinIdx, serverSendNamePinIdx, serverSendInputPinIdxs
        } = item;

        // 1. Monitor Signal (which: 12, xxx: 2, relatedIds: [sendId, serverSendId])
        accessories.push({
          name: 'Monitor Signal',
          id: { class: 23, type: 0, id: monitorId },
          relatedIds: [
            { class: 23, type: 0, id: sendId },
            { class: 23, type: 0, id: serverSendId }
          ],
          which: 12,
          compositeDef: {
            inner: {
              def: {
                name: 'Monitor Signal',
                description: '',
                inflows: [],
                outflows: [{ name: '', visible: true, index: { kind: 2, index: 0 }, description: '', pinIndex: monitorOutflowPinIdx }],
                inputs: [],
                outputs: [
                  { name: 'Event Source Entity', visible: true, index: { kind: 4, index: 0 }, type: { class: 0, type1: 1, type2: 1, valueId: null }, pinIndex: monitorBuiltinPinIdxs[0] },
                  { name: 'Event Source GUID',   visible: true, index: { kind: 4, index: 1 }, type: { class: 1, type1: 2, type2: 2, valueId: null }, pinIndex: monitorBuiltinPinIdxs[1] },
                  { name: 'Signal Source Entity', visible: true, index: { kind: 4, index: 2 }, type: { class: 0, type1: 1, type2: 1, valueId: null }, pinIndex: monitorBuiltinPinIdxs[2] },
                  ...params.map((p, pi) => ({
                    name: p.name,
                    visible: true,
                    index: { kind: 4, index: 3 + pi },
                    type: accessoryTypeForPin(p.type),
                    pinIndex: monitorOutputPinIdxs[pi]
                  }))
                ],
                signalPins: [
                  {
                    name: 'Signal Name',
                    visible: true,
                    value: { class: 5, alreadySetVal: true, itemType: valueItemType(0), bString: { val: sigName } },
                    clientExecNode: { kind: 6, index: sigIndex || 1 },
                    pinIndex: monitorNamePinIdx
                  }
                ],
                id: {
                  genericId: { class: 10001, type: 20000, kind: 22001, id: monitorId },
                  concreteId: { class: 10001, type: 20000, kind: 22001, id: monitorId },
                  graphId: { class: 0, type: 0, kind: 0, id: 0 }
                },
                type: {
                  kind: 1002,
                  monitorSignalRef: {
                    name: sigName,
                    relatedId1: { class: 10001, type: 20000, kind: 22001, id: sendId },
                    relatedId2: { class: 10001, type: 20002, kind: 22001, id: serverSendId }
                  }
                },
                xxx: 2,
                signalVersion: 8
              }
            }
          }
        });

        // 2. Send Signal (which: 14, xxx: 1, relatedIds: [monitorId, serverSendId])
        accessories.push({
          name: 'Send Signal',
          id: { class: 23, type: 0, id: sendId },
          relatedIds: [
            { class: 23, type: 0, id: monitorId },
            { class: 23, type: 0, id: serverSendId }
          ],
          which: 14,
          compositeDef: {
            inner: {
              def: {
                name: 'Send Signal',
                description: '',
                inflows: [{ name: '', visible: true, index: { kind: 1, index: 0 }, description: '', pinIndex: sendInflowPinIdx }],
                outflows: [{ name: '', visible: true, index: { kind: 2, index: 0 }, description: '', pinIndex: sendOutflowPinIdx }],
                inputs: params.map((p, pi) => ({
                  name: p.name,
                  visible: true,
                  index: { kind: 3, index: pi },
                  type: accessoryTypeForPin(p.type),
                  pinIndex: sendInputPinIdxs[pi]
                })),
                outputs: [],
                signalPins: [
                  {
                    name: 'Signal Name',
                    visible: true,
                    value: { class: 5, alreadySetVal: true, itemType: valueItemType(0), bString: { val: sigName } },
                    clientExecNode: { kind: 6, index: sigIndex || 1 },
                    pinIndex: sendNamePinIdx
                  }
                ],
                id: {
                  genericId: { class: 10001, type: 20000, kind: 22001, id: sendId },
                  concreteId: { class: 10001, type: 20000, kind: 22001, id: sendId },
                  graphId: { class: 0, type: 0, kind: 0, id: 0 }
                },
                type: {
                  kind: 1001,
                  sendSignalRef: {
                    name: sigName,
                    relatedId1: { class: 10001, type: 20000, kind: 22001, id: monitorId },
                    relatedId2: { class: 10001, type: 20002, kind: 22001, id: serverSendId }
                  }
                },
                xxx: 1,
                signalVersion: 8
              }
            }
          }
        });

        // 3. Send Signal to Server Node Graph (which: 14, xxx: 1, relatedIds: [monitorId, sendId])
        accessories.push({
          name: 'Send Signal to Server Node Graph',
          id: { class: 23, type: 0, id: serverSendId },
          relatedIds: [
            { class: 23, type: 0, id: monitorId },
            { class: 23, type: 0, id: sendId }
          ],
          which: 14,
          compositeDef: {
            inner: {
              def: {
                name: 'Send Signal to Server Node Graph',
                description: '',
                inflows: [{ name: '', visible: true, index: { kind: 1, index: 0 }, description: '', pinIndex: serverSendInflowPinIdx }],
                outflows: [{ name: '', visible: true, index: { kind: 2, index: 0 }, description: '', pinIndex: serverSendOutflowPinIdx }],
                inputs: params.map((p, pi) => ({
                  name: p.name,
                  visible: true,
                  index: { kind: 3, index: pi },
                  type: accessoryTypeForPin(p.type),
                  pinIndex: serverSendInputPinIdxs[pi]
                })),
                outputs: [],
                signalPins: [
                  {
                    name: 'Signal Name',
                    visible: true,
                    value: { class: 5, alreadySetVal: true, itemType: valueItemType(0), bString: { val: sigName } },
                    clientExecNode: { kind: 6, index: sigIndex || 1 },
                    pinIndex: serverSendNamePinIdx
                  }
                ],
                id: {
                  genericId: { class: 10001, type: 20002, kind: 22001, id: serverSendId },
                  concreteId: { class: 10001, type: 20002, kind: 22000, id: 2000 },
                  graphId: { class: 0, type: 0, kind: 0, id: 0 }
                },
                type: {
                  kind: 1001,
                  sendSignalRef: {
                    name: sigName,
                    relatedId1: { class: 10001, type: 20000, kind: 22001, id: monitorId },
                    relatedId2: { class: 10001, type: 20000, kind: 22001, id: sendId }
                  }
                },
                xxx: 1,
                signalVersion: 8
              }
            }
          }
        });
      });
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
