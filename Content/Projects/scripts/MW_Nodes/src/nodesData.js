/**
 * Miliastra Wonderland Node Graph System - Node Registry
 * Refactored modular registry sourcing all 478+ nodes directly from src/nodes/server/:
 * - eventNodes.js (Event Nodes, 65 nodes)
 * - executionNodes.js (Execution Nodes, 198 nodes)
 * - flowNodes.js (Flow Control Nodes, 2 nodes)
 * - operationNodes.js (Operation Nodes, 62 nodes)
 * - queryNodes.js (Query Nodes, 151 nodes)
 * - Composite Nodes (Subgraphs & Macros)
 */

import {
  EVENT_NODES,
  EXECUTION_NODES,
  FLOW_NODES,
  OPERATION_NODES,
  QUERY_NODES,
  ALL_SERVER_NODES
} from './nodes/server/index.js';

export {
  EVENT_NODES,
  EXECUTION_NODES,
  FLOW_NODES,
  OPERATION_NODES,
  QUERY_NODES,
  ALL_SERVER_NODES
};

export const CATEGORIES = {
  execution: {
    id: 'execution',
    name: 'Execution Node',
    count: 198,
    headerColor: '#9FB343', // Olive green from Miliastra Wonderland
    accentColor: '#9FB343',
    iconType: 'flow-snake'
  },
  event: {
    id: 'event',
    name: 'Event Node',
    count: 65,
    headerColor: '#D9536D', // Rose pink
    accentColor: '#D9536D',
    iconType: 'cycle-arrows'
  },
  flow: {
    id: 'flow',
    name: 'Flow Control Node',
    count: 2,
    headerColor: '#E57842', // Coral orange
    accentColor: '#E57842',
    iconType: 'branch-split'
  },
  query: {
    id: 'query',
    name: 'Query Node',
    count: 151,
    headerColor: '#6373BF', // Periwinkle / lavender indigo
    accentColor: '#6373BF',
    iconType: 'compass-query'
  },
  operation: {
    id: 'operation',
    name: 'Operation Node',
    count: 62,
    headerColor: '#3E8BB8', // Steel cyan-blue
    accentColor: '#3E8BB8',
    iconType: 'calc-math'
  },
  composite: {
    id: 'composite',
    name: 'Composite Node',
    count: 3,
    headerColor: '#B8B8D0', // Lavender periwinkle-grey from Miliastra
    accentColor: '#B8B8D0',
    iconType: 'composite-tri'
  }
};

export const PIN_COLORS = {
  exec: '#FFFFFF',
  execYes: '#4CD964',
  execNo: '#E05353',
  int: '#4A90E2',
  float: '#50E3C2',
  string: '#F5A623',
  bool: '#FF7474',
  entity: '#B8E986',
  guid: '#9013FE',
  vector3: '#F8E71C',
  generic: '#B0B0B0',
  dict: '#7ED321',
  list: '#A1C6E6',
  enum: '#E57842',
  config_id: '#D49B55',
  faction: '#54C5D0',
  prefab_id: '#9B51E0',
  local_var: '#4A90E2'
};

export const DATA_TYPES = [
  { id: 'generic', label: 'Generic', color: PIN_COLORS.generic, desc: 'Wildcard or generic data type' },
  { id: 'int', label: 'Integer', color: PIN_COLORS.int, desc: 'Whole number (e.g. 1, 42)' },
  { id: 'float', label: 'Floating Point', color: PIN_COLORS.float, desc: 'Decimal number (e.g. 3.14)' },
  { id: 'string', label: 'String', color: PIN_COLORS.string, desc: 'Text string' },
  { id: 'bool', label: 'Boolean', color: PIN_COLORS.bool, desc: 'True / False logic state' },
  { id: 'entity', label: 'Entity', color: PIN_COLORS.entity, desc: 'Character, monster, or object' },
  { id: 'guid', label: 'GUID', color: PIN_COLORS.guid, desc: 'Unique entity identifier' },
  { id: 'vector3', label: '3D Vector', color: PIN_COLORS.vector3, desc: '3-axis vector (X, Y, Z)' },
  { id: 'list', label: 'List', color: PIN_COLORS.list, desc: 'Ordered array of elements' },
  { id: 'dict', label: 'Dictionary', color: PIN_COLORS.dict, desc: 'Key-value map' },
  { id: 'enum', label: 'Enumeration', color: PIN_COLORS.enum, desc: 'Predefined named state' },
  { id: 'config_id', label: 'Config ID', color: PIN_COLORS.config_id, desc: 'Configuration index' },
  { id: 'faction', label: 'Faction', color: PIN_COLORS.faction, desc: 'Entity faction identifier' },
  { id: 'prefab_id', label: 'Prefab ID', color: PIN_COLORS.prefab_id, desc: 'Object prefab asset ID' }
];

export const BASE_COMPOSITE_NODES = [
  {
    id: 'composite_node',
    name: 'Create Composite Node',
    category: 'composite',
    folder: 'Composite Nodes',
    description: 'Blank encapsulated composite node group with customizable pins.',
    execIn: true,
    execOut: true,
    inputs: [],
    outputs: []
  }
];

const customCompositeMap = new Map();

export function loadSavedCustomComposites() {
  try {
    const raw = localStorage.getItem('miliastra.compositeDefinitions');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach(c => {
          if (c && c.name && c.name !== 'Create Composite Node') {
            registerCustomCompositeNode(c, false);
          }
        });
      }
    }
  } catch (e) {}
}

export function saveCustomComposites() {
  try {
    const unique = getCustomCompositeNodes();
    localStorage.setItem('miliastra.compositeDefinitions', JSON.stringify(unique));
  } catch (e) {}
}

export function registerCustomCompositeNode(comp, persist = true) {
  if (!comp || !comp.name) return null;
  // Don't duplicate the base creator node
  if (comp.name === 'Create Composite Node' && !comp.compositePins) return null;

  const id = comp.blueprintId && comp.blueprintId.startsWith('comp_custom_') 
    ? comp.blueprintId 
    : (comp.id && comp.id.startsWith('comp_custom_') ? comp.id : ('comp_custom_' + comp.name.toLowerCase().replace(/[^a-z0-9_]/g, '_')));
  
  const inPins = (comp.compositePins || []).filter(p => p.direction === 'input');
  const outPins = (comp.compositePins || []).filter(p => p.direction === 'output');

  const hasExecIn = inPins.some(p => p.kind === 'exec');
  const hasExecOut = outPins.some(p => p.kind === 'exec');

  const inputs = inPins.filter(p => p.kind !== 'exec').map(p => ({
    name: p.name || `Input ${p.index}`,
    type: p.type || 'generic',
    hint: p.hint || ''
  }));

  const outputs = outPins.filter(p => p.kind !== 'exec').map(p => ({
    name: p.name || `Output ${p.index}`,
    type: p.type || 'generic',
    hint: p.hint || ''
  }));

  const entry = {
    id: id,
    name: comp.name,
    category: 'composite',
    folder: comp.compositeCategory || 'Custom Subgraphs',
    description: comp.description || `Composite Subgraph (${inPins.length} in, ${outPins.length} out)`,
    isComposite: true,
    compositeCategory: comp.compositeCategory || 'Uncategorized Tab',
    compositePins: JSON.parse(JSON.stringify(comp.compositePins || [])),
    subgraph: JSON.parse(JSON.stringify(comp.subgraph || { nodes: [], wires: [] })),
    execIn: hasExecIn,
    execOut: hasExecOut,
    inputs: inputs,
    outputs: outputs
  };

  customCompositeMap.set(id, entry);
  customCompositeMap.set(comp.name.toLowerCase().trim(), entry);

  updateCompositeCount();
  if (persist) {
    saveCustomComposites();
  }
  return entry;
}

export function unregisterCustomCompositeNode(idOrName) {
  if (!idOrName) return;
  const target = String(idOrName).toLowerCase().trim();
  const found = customCompositeMap.get(idOrName) || customCompositeMap.get(target);
  if (found) {
    customCompositeMap.delete(found.id);
    customCompositeMap.delete(found.name.toLowerCase().trim());
  }
  updateCompositeCount();
  saveCustomComposites();
}

export function getCustomCompositeNodes() {
  const seen = new Set();
  const list = [];
  for (const item of customCompositeMap.values()) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      list.push(item);
    }
  }
  return list;
}

export function getAllCompositeNodes() {
  return [...BASE_COMPOSITE_NODES, ...getCustomCompositeNodes()];
}

export function updateCompositeCount() {
  CATEGORIES.composite.count = getAllCompositeNodes().length;
}

export function getAllNodes() {
  return [...ALL_SERVER_NODES, ...getAllCompositeNodes()];
}

// Initial load of custom composites
loadSavedCustomComposites();
updateCompositeCount();

export const COMPOSITE_NODES = getAllCompositeNodes();

export const NODE_REGISTRY = getAllNodes();

// Helper to look up a node blueprint by ID or Name (resilient matching)
export function getNodeBlueprint(idOrName) {
  if (!idOrName) return null;
  const target = String(idOrName).toLowerCase().trim();

  // Check custom composite nodes first
  if (customCompositeMap.has(idOrName)) return customCompositeMap.get(idOrName);
  if (customCompositeMap.has(target)) return customCompositeMap.get(target);

  const all = getAllNodes();
  let found = all.find(n => n.id === idOrName || (n.name && n.name.toLowerCase() === target));
  if (found) return found;

  // Normalized matching (removes slashes, underscores, hyphens, and whitespace)
  const norm = target.replace(/[\/\-_\s]/g, '');
  found = all.find(n => {
    const nNorm = n.name ? n.name.replace(/[\/\-_\s]/g, '').toLowerCase() : '';
    const idNorm = n.id ? n.id.replace(/[\/\-_\s]/g, '').toLowerCase() : '';
    return nNorm === norm || idNorm === norm || idNorm.endsWith(norm) || norm.endsWith(idNorm);
  });
  if (found) return found;

  // Fallback: check if idOrName has a type specialization (e.g. "Equal Entity", "Equal__Entity", "Addition Float")
  const parsed = parseNodeBlueprintAndType(idOrName);
  return parsed.blueprint || null;
}

export const TYPE_NAME_NORMALIZATION = {
  'int': 'int',
  'integer': 'int',
  'float': 'float',
  'str': 'string',
  'string': 'string',
  'bool': 'bool',
  'boolean': 'bool',
  'entity': 'entity',
  'guid': 'guid',
  'vec': 'vector3',
  'vector': 'vector3',
  'vector3': 'vector3',
  '_3d_vector': 'vector3',
  '3d_vector': 'vector3',
  'faction': 'faction',
  'config': 'config_id',
  'config_id': 'config_id',
  'configuration': 'config_id',
  'prefab': 'prefab_id',
  'prefab_id': 'prefab_id',
  'list': 'list',
  'dict': 'dict',
  'dictionary': 'dict',
  'enum': 'enum',
  'generic': 'generic'
};

export function normalizeDataType(str) {
  if (!str) return null;
  const clean = String(str).toLowerCase().replace(/^_+|_+$/g, '').trim();
  if (TYPE_NAME_NORMALIZATION[clean]) return TYPE_NAME_NORMALIZATION[clean];
  if (clean.startsWith('list')) return 'list';
  if (clean.startsWith('dict')) return 'dict';
  return null;
}

/**
 * Intelligent parser separating specialized node names into base blueprint and data type.
 * Examples:
 *   "Equal__Entity" -> { blueprint: op_equal, baseName: "Equal", dataType: "entity" }
 *   "Equal Entity" -> { blueprint: op_equal, baseName: "Equal", dataType: "entity" }
 *   "Addition Float" -> { blueprint: op_addition, baseName: "Addition", dataType: "float" }
 *   "Set Custom Variable Entity" -> { blueprint: exec_set_custom_var, baseName: "Set Custom Variable", dataType: "entity" }
 *   "Get Node Graph Variable Int" -> { blueprint: query_get_node_graph_var, baseName: "Get Node Graph Variable", dataType: "int" }
 */
export function parseNodeBlueprintAndType(idOrName) {
  if (!idOrName) return { blueprint: null, baseName: '', dataType: null };
  const raw = String(idOrName).trim();

  const COMMON_ALIASES = {
    'node graph variable': 'query_get_node_graph_var',
    'get node graph variable': 'query_get_node_graph_var',
    'set node graph variable': 'exec_set_node_graph_var',
    'custom variable': 'query_get_custom_var',
    'get custom variable': 'query_get_custom_var',
    'set custom variable': 'exec_set_custom_var',
    'local variable': 'query_get_local_variable',
    'get local variable': 'query_get_local_variable',
    'set local variable': 'exec_set_local_var',
    'math': 'op_addition',
    'comparison': 'op_equal'
  };

  const findBp = (query) => {
    if (!query) return null;
    const qLower = query.toLowerCase().trim();
    if (COMMON_ALIASES[qLower]) {
      const aliasId = COMMON_ALIASES[qLower];
      const match = NODE_REGISTRY.find(n => n.id === aliasId);
      if (match) return match;
    }
    const direct = NODE_REGISTRY.find(n => n.id === query || (n.name && n.name.toLowerCase() === qLower));
    if (direct) return direct;
    const qNorm = qLower.replace(/[\/\-_\s]/g, '');
    return NODE_REGISTRY.find(n => {
      const nNorm = n.name ? n.name.replace(/[\/\-_\s]/g, '').toLowerCase() : '';
      const idNorm = n.id ? n.id.replace(/[\/\-_\s]/g, '').toLowerCase() : '';
      return nNorm === qNorm || idNorm === qNorm;
    }) || null;
  };

  // 1. Direct blueprint lookup (pure name or ID)
  let found = findBp(raw);
  if (found) {
    return { blueprint: found, baseName: found.name, dataType: null };
  }

  // 2. Check for double underscore separator e.g. Equal__Entity, Addition__Float, Set_Custom_Variable__Entity
  if (raw.includes('__')) {
    const parts = raw.split('__');
    const baseCandidate = parts[0].replace(/_/g, ' ').trim();
    const typeCandidate = normalizeDataType(parts[1]);
    const bp = findBp(baseCandidate);
    if (bp) {
      return { blueprint: bp, baseName: bp.name, dataType: typeCandidate };
    }
  }

  // 3. Check for space-separated trailing type name e.g. "Equal Entity", "Addition Float", "Get Custom Variable Entity"
  const words = raw.split(/\s+/);
  if (words.length > 1) {
    const lastWord = words[words.length - 1];
    const typeCandidate = normalizeDataType(lastWord);
    if (typeCandidate) {
      const baseCandidate = words.slice(0, -1).join(' ').trim();
      const bp = findBp(baseCandidate);
      if (bp) {
        return { blueprint: bp, baseName: bp.name, dataType: typeCandidate };
      }
    }
  }

  // 4. Normalized fallback matching
  return { blueprint: null, baseName: raw, dataType: null };
}

/**
 * Configure node instance pins and dataType property according to blueprint and specialized data type
 */
export function applyDataTypeToNode(nodeInstance, blueprint, dataType) {
  if (!nodeInstance || !blueprint || !dataType) return;
  nodeInstance.dataType = dataType;
  nodeInstance.pinTypes = nodeInstance.pinTypes || {};

  const bpId = blueprint.id || '';

  // 1. Equal / Not Equal operations
  if (bpId === 'op_equal' || bpId === 'op_not_equal') {
    nodeInstance.pinTypes['Input 1'] = dataType;
    nodeInstance.pinTypes['Input 2'] = dataType;
  }
  // 2. Comparison operations (Greater Than, Less Than, etc.) — the two inputs
  // always share one data type and change together. Pins are named per blueprint
  // (Left Value / Right Value), not the hardcoded Input 1 / Input 2.
  else if (bpId.startsWith('op_greater') || bpId.startsWith('op_less')) {
    (blueprint.inputs || []).forEach(inp => {
      if (inp.hasGear || inp.type === 'generic') nodeInstance.pinTypes[inp.name] = dataType;
    });
  }
  // 3. Math / Arithmetic operations (Addition, Subtraction, Multiplication, Division, Modulo, Exponentiation)
  else if (
    bpId.startsWith('op_addition') ||
    bpId.startsWith('op_subtraction') ||
    bpId.startsWith('op_multiplication') ||
    bpId.startsWith('op_division') ||
    bpId.startsWith('op_modulo') ||
    bpId.startsWith('op_exponentiation') ||
    bpId.startsWith('op_take_larger') ||
    bpId.startsWith('op_take_smaller')
  ) {
    (blueprint.inputs || []).forEach(inp => {
      if (inp.hasGear || inp.type === 'generic') nodeInstance.pinTypes[inp.name] = dataType;
    });
    (blueprint.outputs || []).forEach(out => {
      if (out.hasGear || out.type === 'generic') nodeInstance.pinTypes[out.name] = dataType;
    });
  }
  // 4. Custom Variables & Node Graph Variables
  else if (bpId.includes('custom_var') || bpId.includes('node_graph_var')) {
    if (blueprint.inputs?.some(i => i.name === 'Variable Value') || nodeInstance.pinTypes['Variable Value'] !== undefined) {
      nodeInstance.pinTypes['Variable Value'] = dataType;
    }
    if (blueprint.outputs?.some(o => o.name === 'Variable Value')) {
      nodeInstance.pinTypes['Variable Value'] = dataType;
    }
    if (blueprint.outputs?.some(o => o.name === 'Pre-Change Value')) {
      nodeInstance.pinTypes['Pre-Change Value'] = dataType;
      nodeInstance.pinTypes['Post-Change Value'] = dataType;
    }
  }
  // 5. Local Variables
  else if (bpId === 'exec_set_local_var') {
    nodeInstance.pinTypes['Value'] = dataType;
  } else if (bpId === 'query_get_local_variable') {
    nodeInstance.pinTypes['Initial Value'] = dataType;
    nodeInstance.pinTypes['Value'] = dataType;
  }
  // 6. Flow Multiple Branches
  else if (bpId === 'flow_multiple_branches') {
    nodeInstance.pinTypes['Control Expression'] = dataType;
  }
  // 7. Generic pins with hasGear or generic types
  else {
    (blueprint.inputs || []).forEach(inp => {
      if (inp.hasGear || inp.type === 'generic') {
        nodeInstance.pinTypes[inp.name] = dataType;
      }
    });
    (blueprint.outputs || []).forEach(out => {
      if (out.hasGear || out.type === 'generic') {
        nodeInstance.pinTypes[out.name] = dataType;
      }
    });
  }
}

