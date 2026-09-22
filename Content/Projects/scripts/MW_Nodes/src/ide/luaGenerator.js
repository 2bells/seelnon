/**
 * luaGenerator.js — GraphState -> Lua representation
 *
 * Emits clean, readable Lua with:
 * - Proper top-level Node Graph Variable declarations (e.g. `HP: int = 0`, `Num: int = 6`, `My_var: float = 2.1`)
 * - Top-level Custom Variable declarations (`self`, `guid = 1008221`)
 * - Custom Variable mutations via `f.setCustomVar(...)`
 * - Direct comparison and arithmetic expressions in conditions (`if My_var == 7.2 then`)
 * - Clean event handlers without intrusive ID markers
 */

import { getNodeBlueprint } from '../nodesData.js';
import { signalsManager } from '../signalsManager.js';

// Mapping from in-game event names (lowercase) to Lua function names.
const EVENT_MAP = {
  'when entity is created': 'whenEntityCreated',
  'when entity is destroyed': 'whenEntityDestroyed',
  'when entity takes damage': 'whenEntityTakesDamage',
  'when entity deals damage': 'whenEntityDealsDamage',
  'when entity attacks': 'whenEntityAttacks',
  'when entity enters trigger': 'whenEntityEntersTrigger',
  'when entity exits trigger': 'whenEntityExitsTrigger',
  'when entity health changes': 'whenEntityHealthChanges',
  'when entity state changes': 'whenEntityStateChanges',
  'when game starts': 'whenGameStarts',
  'when game timer elapses': 'whenGameTimerElapses',
  'when ui button is clicked': 'whenUiButtonClicked',
  'when custom event triggers': 'whenCustomEventTriggers',
  'when custom variable changes': 'whenCustomVariableChanges',
  'when custom var changes': 'whenCustomVariableChanges',
  'when tab selected': 'whenTabSelected',
  'when tab is selected': 'whenTabSelected',
  'when preset status changes': 'whenPresetStatusChanges',
  'when status stacks change': 'whenStatusStacksChange',
  'when timer ends': 'whenTimerEnds',
  'when signal received': 'whenSignalReceived',
  'monitor signal': 'monitorSignal'
};

function toCamel(s) {
  return String(s || '')
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, c => c.toLowerCase());
}

function fnName(node) {
  if (!node) return 'unknown';
  if (node.blueprintId) {
    const raw = node.blueprintId.replace(/^(exec_|query_|op_|flow_)/, '');
    return toCamel(raw);
  }
  return toCamel(node.name || 'node');
}

function isEvent(n) { return n && (n.category === 'event' || (n.blueprintId && n.blueprintId.startsWith('event_'))); }
function isFlow(n) {
  return n && (
    n.category === 'flow' ||
    (n.blueprintId && n.blueprintId.startsWith('flow_')) ||
    n.blueprintId === 'flow_double_branch' ||
    n.name === 'Double Branch' ||
    n.blueprintId === 'flow_multiple_branches' ||
    n.name === 'Multiple Branches'
  );
}
function isExec(n) {
  return n && (
    n.category === 'execution' ||
    (n.blueprintId && n.blueprintId.startsWith('exec_')) ||
    n.blueprintId === 'exec_set_custom_var' ||
    n.name === 'Set Custom Variable' ||
    n.blueprintId === 'exec_set_node_graph_var' ||
    n.name === 'Set Node Graph Variable'
  );
}
function isData(n) { return n && !isEvent(n) && !isFlow(n) && !isExec(n); }

export function formatVec3(val) {
  if (val === null || val === undefined) return '(x = 0.0, y = 0.0, z = 0.0)';
  if (typeof val === 'object' && val !== null) {
    const x = val.x !== undefined ? val.x : '0.0';
    const y = val.y !== undefined ? val.y : '0.0';
    const z = val.z !== undefined ? val.z : '0.0';
    return `(x = ${x}, y = ${y}, z = ${z})`;
  }
  const s = String(val).trim();
  if ((s.startsWith('(') && s.endsWith(')')) || (s.startsWith('{') && s.endsWith('}'))) {
    const inner = s.slice(1, -1).trim();
    const xMatch = /\bx\s*[:=]\s*([^,]+)/i.exec(inner);
    const yMatch = /\by\s*[:=]\s*([^,]+)/i.exec(inner);
    const zMatch = /\bz\s*[:=]\s*([^,]+)/i.exec(inner);
    if (xMatch || yMatch || zMatch) {
      const x = xMatch ? xMatch[1].trim() : '0.0';
      const y = yMatch ? yMatch[1].trim() : '0.0';
      const z = zMatch ? zMatch[1].trim() : '0.0';
      return `(x = ${x}, y = ${y}, z = ${z})`;
    }
    const parts = inner.split(',').map(p => p.trim());
    if (parts.length === 3) {
      return `(x = ${parts[0] || '0.0'}, y = ${parts[1] || '0.0'}, z = ${parts[2] || '0.0'})`;
    }
  }
  return s;
}

function lit(v) {
  if (v === null || v === undefined) return "''";
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  const s = String(v).trim();
  if (s === 'true' || s === 'false') return s;
  if (s === 'True' || s === 'Yes') return 'true';
  if (s === 'False' || s === 'No') return 'false';
  if (/^-?\d+(\.\d+)?$/.test(s)) return s;

  // Vector3 literal in circle brackets
  if ((s.startsWith('(') && s.endsWith(')')) || (s.startsWith('{') && s.endsWith('}'))) {
    const inner = s.slice(1, -1).trim();
    const parts = inner.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length === 3 && (parts.every(p => /^-?\d+(\.\d+)?$/.test(p)) || /\b[xyz]\s*[:=]/i.test(inner))) {
      return formatVec3(s);
    }
    return s;
  }

  return `'${s.replace(/'/g, "\\'")}'`;
}

function slug(pin) {
  const camel = String(pin || '')
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, c => c.toLowerCase());
  return camel.replace(/([A-Z])/g, (_, c) => '_' + c.toLowerCase());
}

function isExecWire(w) { return w.isExec; }

export class LuaGenerator {
  static generate(graphState) {
    return new _LuaGen(graphState).run();
  }
}

class _LuaGen {
  constructor(graphState) {
    this.g = graphState;
    this.nodes = graphState.nodes || [];
    this.wires = graphState.wires || [];
    this.byId = new Map(this.nodes.map(n => [n.id, n]));
  }

  run() {
    let out = `local f = require("node_graph.functions")\n\n`;

    // 1. Emit Node Graph Variables (without 'local')
    const graphVars = (this.g.getNodeGraphVariables ? this.g.getNodeGraphVariables() : (this.g.nodeGraphVariables || this.g.graphVariables || []));
    if (graphVars && graphVars.length > 0) {
      out += `-- Node Graph Variables\n`;
      for (const v of graphVars) {
        const varName = v.name;
        const varType = v.type || 'int';
        let defVal = v.defaultValue !== undefined && v.defaultValue !== '' ? v.defaultValue : (v.value || '0');
        
        let formattedVal = defVal;
        if (varType === 'int') {
          formattedVal = String(parseInt(defVal, 10) || 0);
        } else if (varType === 'float') {
          formattedVal = defVal.includes('.') ? defVal : `${defVal}.0`;
        } else if (varType === 'bool') {
          formattedVal = (defVal === 'True' || defVal === '1' || defVal === 'true' || defVal === 'Yes') ? 'true' : 'false';
        } else if (varType === 'string') {
          formattedVal = `"${defVal.replace(/"/g, '\\"')}"`;
        } else if (varType === 'vector3' || varType === '3d_vector' || varType === '_3d_vector') {
          formattedVal = formatVec3(defVal || '(x = 0.0, y = 0.0, z = 0.0)');
        }

        out += `${varName}: ${varType} = ${formattedVal}\n`;
      }
      out += `\n`;
    }

    // 2. Emit Standalone Assembly Lists (Lone Nodes)
    const assemblyNodes = this.nodes.filter(n => n.blueprintId === 'op_assembly_list' || (n.name || '').toLowerCase() === 'assembly list');
    const standaloneAssemblyNodes = assemblyNodes.filter(n => {
      return n.listName || !this.wires.some(w => w.fromNode === n.id && (w.toPin === 'Value' || w.toPin === 'Initial Value'));
    });
    if (standaloneAssemblyNodes.length > 0) {
      out += `-- Lists\n`;
      for (const an of standaloneAssemblyNodes) {
        const listName = an.listName || 'name_a';
        const elemType = an.dataType || 'int';
        const dynamicKeys = (an.dynamicInputs && an.dynamicInputs.length > 0)
          ? an.dynamicInputs
          : Object.keys(an.inputValues || {}).filter(k => /^\d+$/.test(k));
        if (dynamicKeys.length === 0) dynamicKeys.push('0');
        const elems = [];
        for (const k of dynamicKeys) {
          let v = an.inputValues?.[k];
          if (v === undefined || v === null || v === '') {
            if (elemType === 'int') v = '0';
            else if (elemType === 'float') v = '0.0';
            else if (elemType === 'bool') v = 'false';
            else if (elemType === 'vector3') v = '(x = 0.0, y = 0.0, z = 0.0)';
            else if (elemType === 'string') v = "''";
            else v = '0';
          }
          if (elemType === 'vector3') {
            elems.push(formatVec3(v || '(x = 0.0, y = 0.0, z = 0.0)'));
          } else if (elemType === 'string') {
            const s = String(v).trim();
            if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
              elems.push(s);
            } else {
              elems.push(`'${s.replace(/'/g, "\\'")}'`);
            }
          } else if (elemType === 'bool') {
            elems.push((v === 'true' || v === 'True' || v === '1' || v === true) ? 'true' : 'false');
          } else if (elemType === 'float') {
            const s = String(v).trim();
            elems.push(s.includes('.') ? s : `${s || 0}.0`);
          } else {
            elems.push(String(v).trim() || '0');
          }
        }
        out += `list.${listName}: ${elemType} list = { ${elems.join(', ')} }\n`;
      }
      out += `\n`;
    }

    // 3. Emit Custom Variables Header (from Set Custom Variable nodes and custom variables registry)
    const customVarsByEntity = this.collectCustomVariables();
    out += `-- Custom Variables\n`;
    if (customVarsByEntity.size > 0) {
      for (const [entityKey, vars] of customVarsByEntity.entries()) {
        out += `${entityKey}\n`;
        for (const cv of vars) {
          out += `  ${cv.name}: ${cv.type} = ${cv.defaultValue}\n`;
        }
        out += `\n`;
      }
    } else {
      out += `-- self\n` +
        `--   Damage: float = get\n` +
        `-- guid.boss = 1077936131\n` +
        `--   HP: int = get\n\n`;
    }

    const events = this.nodes.filter(isEvent);
    if (!events.length) {
      out += `-- (no event node yet — drop a "when …" node on the canvas)\n` +
        `f.on("whenTabSelected", function(ctx)\n` +
        `  --\n` +
        `end)\n`;
      return out;
    }

    for (const ev of events) out += this.emitEvent(ev) + '\n';
    return out.trimEnd() + '\n';
  }

  collectCustomVariables() {
    const map = new Map(); // entityKey -> Array<{ name, type, defaultValue }>

    // 1. First priority: authoritative customVariables from graph state
    const stateCustomVars = (this.g && typeof this.g.getCustomVariables === 'function')
      ? this.g.getCustomVariables()
      : (this.g?.customVariables || []);

    if (Array.isArray(stateCustomVars) && stateCustomVars.length > 0) {
      for (const cv of stateCustomVars) {
        let entityKey = 'self';
        if (cv.entityType === 'guid') {
          if (cv.guidAlias) {
            entityKey = cv.guid ? `guid.${cv.guidAlias} = ${cv.guid}` : `guid.${cv.guidAlias}`;
          } else if (cv.guid) {
            entityKey = `guid = ${cv.guid}`;
          } else {
            entityKey = 'guid.boss = 10003222';
          }
        } else if (cv.entityType === 'entity') {
          entityKey = cv.guidAlias ? `entity.${cv.guidAlias}` : 'entity';
        } else {
          entityKey = 'self';
        }

        let defVal = cv.defaultValue !== undefined && cv.defaultValue !== '' ? String(cv.defaultValue) : 'get';
        if (cv.isGet || defVal === 'get') {
          defVal = 'get';
        } else if (cv.type === 'float' && !defVal.includes('.')) {
          defVal = `${defVal}.0`;
        } else if (cv.type === 'bool') {
          defVal = (defVal === 'True' || defVal === 'true' || defVal === '1') ? 'true' : 'false';
        }

        if (!map.has(entityKey)) map.set(entityKey, []);
        map.get(entityKey).push({
          name: cv.name,
          type: cv.type || 'float',
          defaultValue: defVal
        });
      }
      return map;
    }

    // 2. Fallback: scan nodes in graph if no customVariables in state
    for (const n of this.nodes) {
      if (n.blueprintId === 'exec_set_custom_var' || (n.name || '').toLowerCase() === 'set custom variable' ||
          n.blueprintId === 'query_get_custom_var' || (n.name || '').toLowerCase() === 'get custom variable') {
        const varName = n.inputValues?.['Variable Name'] || 'Variable';
        if (!varName) continue;
        const val = n.inputValues?.['Variable Value'] ?? '0';
        const type = n.dataType || 'float';

        // Check target entity
        const targetWire = this.wires.find(w => !w.isExec && w.toNode === n.id && w.toPin === 'Target Entity');
        let entityKey = 'self';
        if (targetWire) {
          const targetNode = this.byId.get(targetWire.fromNode);
          if (targetNode) {
            if (targetNode.blueprintId === 'query_query_entity_by_guid' || targetNode.name === 'Query Entity by GUID') {
              const guid = targetNode.inputValues?.['GUID'] || '0';
              const alias = targetNode.guidAlias || targetNode.alias;
              if (alias) {
                entityKey = `guid.${alias} = ${guid}`;
              } else {
                entityKey = `guid = ${guid}`;
              }
            } else if (targetNode.blueprintId === 'query_get_self_entity' || targetNode.name === 'Get Self Entity') {
              entityKey = 'self';
            }
          }
        }

        // Check if Variable Value is wired to a Get Custom Variable node
        let isGet = false;
        if (n.blueprintId === 'exec_set_custom_var') {
          const valWire = this.wires.find(w => !w.isExec && w.toNode === n.id && w.toPin === 'Variable Value');
          if (valWire) {
            const srcNode = this.byId.get(valWire.fromNode);
            if (srcNode && (srcNode.blueprintId === 'query_get_custom_var' || srcNode.name === 'Get Custom Variable')) {
              isGet = true;
            }
          } else if (val === 'get' || val === '' || val === undefined) {
            isGet = true;
          }
        } else if (n.blueprintId === 'query_get_custom_var') {
          isGet = true;
        }

        let formattedVal = isGet ? 'get' : String(val);
        if (!isGet) {
          if (type === 'float' && !formattedVal.includes('.')) formattedVal += '.0';
          if (type === 'bool') formattedVal = (formattedVal === 'True' || formattedVal === 'true') ? 'true' : 'false';
        }

        if (!map.has(entityKey)) map.set(entityKey, []);
        const list = map.get(entityKey);
        const existing = list.find(item => item.name === varName);
        if (!existing) {
          list.push({ name: varName, type, defaultValue: formattedVal });
        } else if (n.blueprintId === 'exec_set_custom_var' && !isGet && formattedVal !== '0' && formattedVal !== '0.0') {
          existing.defaultValue = formattedVal;
        }
      }
    }

    return map;
  }

  emitEvent(ev) {
    this.var = new Map();       // nodeId -> local var
    this.evVar = new Map();     // "evid::pin" -> local var
    this.emittedLocals = new Set();
    this.usedVarNames = new Set();
    this._n = 0;
    this.visited = new Set();
    this.ev = ev;

    // Track all pre-existing variable names
    for (const n of this.nodes) {
      if (n.varName) this.usedVarNames.add(String(n.varName).toLowerCase());
    }

    const reach = this.reachableSet(ev);
    const isSignalNode = (ev.blueprintId === 'event_monitor_signal' || (ev.name || '').toLowerCase() === 'monitor signal');
    const evName = this.eventName(ev);

    // Register all Get Node Graph Variable and Get Local Variable nodes
    for (const n of this.nodes) {
      if (n.blueprintId === 'query_get_node_graph_var' || (n.name || '').toLowerCase() === 'get node graph variable') {
        const vn = n.inputValues?.['Variable Name'] || 'Num';
        this.var.set(n.id, vn);
      }
      if (n.blueprintId === 'query_get_local_variable' || (n.name || '').toLowerCase() === 'get local variable') {
        const lvWire = this.wires.find(w => !w.isExec && w.fromNode === n.id && w.fromPin === 'Local Variable');
        let boundVarName = n.varName;
        if (lvWire) {
          const setNode = this.byId.get(lvWire.toNode);
          if (setNode && (setNode.blueprintId === 'exec_set_local_var' || (setNode.name || '').toLowerCase() === 'set local variable')) {
            boundVarName = setNode.varName || boundVarName;
          }
        }
        if (boundVarName) {
          this.var.set(n.id, boundVarName);
        }
      }
    }

    const pins = this.readablePins(ev);
    let evConsts = '';
    for (const pin of pins) {
      const vn = slug(pin);
      this.evVar.set(`${ev.id}::${pin}`, vn);
      evConsts += `  local ${vn} = ctx -- ${pin}\n`;
    }
    if (!evConsts) evConsts = '  -- ctx is the event payload (nothing read yet)\n';

    const dataConsts = this.emitDataConsts(reach);
    const body = this.walkFrom(ev, '  ');

    let onHeader = '';
    let commentHeader = '';
    if (isSignalNode) {
      const sigName = ev.inputValues?.['Signal Name'] || ev.signalName || 'HC_Shot';
      commentHeader = `-- -------- event · Monitor Signal (${sigName}) --------\n`;
      onHeader = `f.on(signal:"${sigName}", function(ctx)\n`;
    } else {
      commentHeader = `-- -------- event · ${ev.name || 'handler'} (${evName}) --------\n`;
      onHeader = `f.on("${evName}", function(ctx)\n`;
    }

    return (
      commentHeader +
      onHeader +
      evConsts + '\n' +
      dataConsts +
      `  -- Logic\n` +
      body +
      `end)\n`
    );
  }

  readablePins(ev) {
    const bp = getNodeBlueprint(ev.blueprintId) || getNodeBlueprint(ev.name);
    const pins = [];
    if (bp && Array.isArray(bp.outputs)) {
      bp.outputs.forEach(o => {
        if (!o.isExec && o.name !== 'execOut' && !pins.includes(o.name)) pins.push(o.name);
      });
    }
    if ((ev.blueprintId || '') === 'event_monitor_signal' || (ev.blueprintId || '').match(/signal/)) {
      let params = [];
      const sigName = this.eventName(ev);
      const def = signalsManager && signalsManager.getSignal ? signalsManager.getSignal(sigName) : null;
      if (def && Array.isArray(def.params)) {
        params = def.params.map(p => String(p.name).replace(/^[-#/\s]+/, '').trim()).filter(Boolean);
      } else if (Array.isArray(ev.customInputs)) {
        params = ev.customInputs.map(c => c && String(c.name).replace(/^[-#/\s]+/, '').trim()).filter(Boolean);
      }
      for (const p of params) {
        if (p && !pins.includes(p)) pins.push(p);
      }
    }
    return pins;
  }

  nextVar(prefix = 'var') {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    let name;
    do {
      if (this._n < 26) {
        name = `${prefix}_${letters[this._n]}`;
      } else {
        name = `${prefix}_${this._n + 1}`;
      }
      this._n++;
    } while (this.usedVarNames && this.usedVarNames.has(name));
    if (this.usedVarNames) this.usedVarNames.add(name);
    return name;
  }

  eventName(ev) {
    if ((ev.blueprintId || '') === 'event_monitor_signal' || (ev.name || '').toLowerCase() === 'monitor signal') {
      return ev.inputValues?.['Signal Name'] || ev.signalName || 'HC_Shot';
    }
    const key = (ev.name || '').toLowerCase();
    return EVENT_MAP[key] || toCamel(ev.name || 'Event');
  }

  reachableSet(root) {
    const set = new Set([root.id]);
    const q = [root.id];
    while (q.length) {
      const id = q.shift();
      for (const w of this.wires) {
        if (w.fromNode === id && !set.has(w.toNode)) { set.add(w.toNode); q.push(w.toNode); }
        if (w.toNode === id && !w.isExec && !set.has(w.fromNode)) { set.add(w.fromNode); q.push(w.fromNode); }
      }
    }
    return set;
  }

  emitDataConsts(reach) {
    const reachData = [...reach].map(id => this.byId.get(id)).filter(Boolean);
    const allLocalVars = this.nodes.filter(n => n && (n.isExplicitLocal || n.blueprintId === 'query_get_local_variable' || (n.name || '').toLowerCase() === 'get local variable'));
    
    const combined = Array.from(new Set([...reachData, ...allLocalVars]))
      .filter(isData);

    // Filter out:
    // 1) Get Node Graph Variable (maps directly to variable name)
    // 2) Get Custom Variable (maps directly to self.X / guid.X)
    // 3) Get Self Entity / Query Entity by GUID (rendered inlined)
    // 4) Data Type Conversion (rendered inlined as toInt(...), toFloat(...), etc.)
    // 5) Operation / Query nodes that were not explicitly declared as local variables by the user
    const filteredData = combined.filter(n => {
      const bi = n.blueprintId || '';
      const nm = (n.name || '').toLowerCase();

      if (bi === 'query_get_node_graph_var' || nm === 'get node graph variable') {
        return false;
      }

      if (bi === 'query_get_custom_var' || nm === 'get custom variable') {
        return false;
      }

      if (bi === 'query_get_self_entity' || nm === 'get self entity' ||
          bi === 'query_query_entity_by_guid' || nm === 'query entity by guid') {
        return false;
      }

      if (bi === 'op_data_type_conversion' || nm === 'data type conversion') {
        return false;
      }

      if (bi === 'query_get_local_variable' || nm === 'get local variable') {
        return false;
      }

      // Only emit as local if the user EXPLICITLY declared it as a local variable
      if (!n.isExplicitLocal) {
        return false;
      }

      return true;
    });

    const adj = new Map();
    const indeg = new Map();
    for (const n of filteredData) { indeg.set(n.id, 0); }
    for (const n of filteredData) {
      for (const w of this.wires) {
        if (!w.isExec && w.toNode === n.id && indeg.has(w.fromNode) && w.fromNode !== n.id) {
          if (!adj.has(w.fromNode)) adj.set(w.fromNode, []);
          adj.get(w.fromNode).push(n.id);
          indeg.set(n.id, indeg.get(n.id) + 1);
        }
      }
    }
    const queue = filteredData.filter(n => indeg.get(n.id) === 0).map(n => n.id);
    const orderIds = [];
    while (queue.length) {
      const id = queue.shift();
      orderIds.push(id);
      for (const c of (adj.get(id) || [])) {
        indeg.set(c, indeg.get(c) - 1);
        if (indeg.get(c) === 0) queue.push(c);
      }
    }
    for (const n of filteredData) if (!orderIds.includes(n.id)) orderIds.push(n.id);

    let out = '';
    for (const id of orderIds) {
      const n = this.byId.get(id);
      if (this.var.has(n.id)) continue;
      const vn = this.validVarName(n.varName) ? n.varName : this.nextVar('d');
      this.var.set(n.id, vn);
      const typeAnno = n.declaredType ? `: ${n.declaredType}` : '';
      let rhs = '';
      if (n.blueprintId === 'query_get_local_variable' || (n.name || '').toLowerCase() === 'get local variable') {
        const initVal = this.argOut(n, 'Initial Value');
        rhs = (initVal !== undefined && initVal !== '') ? initVal : (n.inputValues?.['Initial Value'] || '0');
      } else {
        rhs = this.call(n);
      }
      out += `  local ${vn}${typeAnno} = ${rhs}\n`;
    }
    return out ? out + '\n' : '';
  }

  validVarName(name) {
    return typeof name === 'string' && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) && !['f', 'ctx', 'f_on', 'require', 'local'].includes(name);
  }

  emitNodeStmt(curr) {
    if (curr.blueprintId === 'exec_set_node_graph_var' || (curr.name || '').toLowerCase() === 'set node graph variable') {
      const vn = curr.inputValues?.['Variable Name'] || 'num';
      const val = this.argOut(curr, 'Variable Value') || '0';
      return `${vn} = ${val}`;
    }
    if (curr.blueprintId === 'exec_set_local_var' || (curr.name || '').toLowerCase() === 'set local variable') {
      const lvWire = this.wires.find(w => !w.isExec && w.toNode === curr.id && w.toPin === 'Local Variable');
      let varName = curr.varName;
      let dt = curr.declaredType || curr.dataType;
      if (lvWire) {
        const getLv = this.byId.get(lvWire.fromNode);
        if (getLv) {
          varName = varName || getLv.varName;
          dt = dt || getLv.declaredType || getLv.dataType;
        }
      }
      if (!varName) {
        varName = this.nextVar('var');
      }
      const val = this.argOut(curr, 'Value') || '0';
      const typeAnno = dt ? `: ${dt}` : '';

      if (!this.emittedLocals) this.emittedLocals = new Set();
      if (!this.emittedLocals.has(varName)) {
        this.emittedLocals.add(varName);
        return `local ${varName}${typeAnno} = ${val}`;
      }
      return `${varName} = ${val}`;
    }
    if (curr.blueprintId === 'exec_set_custom_var' || (curr.name || '').toLowerCase() === 'set custom variable') {
      return this.emitSetCustomVar(curr);
    }
    if (curr.blueprintId === 'exec_break_loop' || (curr.name || '').toLowerCase() === 'break loop') {
      return 'f.breakLoop()';
    }
    return this.call(curr);
  }

  emitExecutionChain(curr, ind) {
    let out = '';
    while (curr) {
      if (this.visited.has(curr.id)) break;
      this.visited.add(curr.id);

      if (curr.blueprintId === 'flow_double_branch' || curr.name === 'Double Branch') {
        out += this.emitDoubleBranch(curr, ind);
        break;
      }
      if (curr.blueprintId === 'flow_multiple_branches' || curr.name === 'Multiple Branches') {
        out += this.emitMultiBranch(curr, ind);
        break;
      }
      if (curr.blueprintId === 'exec_list_iteration_loop' || curr.name === 'List Iteration Loop') {
        out += this.emitListIterationLoop(curr, ind);
        break;
      }
      if (curr.blueprintId === 'exec_finite_loop' || curr.name === 'Finite Loop') {
        out += this.emitFiniteLoop(curr, ind);
        break;
      }

      out += `${ind}${this.emitNodeStmt(curr)}\n`;
      curr = this.nextExec(curr, 'execOut');
    }
    return out;
  }

  walkFrom(node, ind) {
    const curr = this.nextExec(node, 'execOut');
    return this.emitExecutionChain(curr, ind);
  }

  emitListIterationLoop(loopNode, ind) {
    let varName = loopNode.varName;
    if (!varName) {
      const valWire = this.wires.find(w => !w.isExec && w.fromNode === loopNode.id && (w.fromPin === 'Value' || w.fromPin === 'Iteration Value'));
      if (valWire) {
        const toNode = this.byId.get(valWire.toNode);
        if (toNode) {
          const pinLower = (valWire.toPin || '').toLowerCase();
          if (pinLower.includes('player')) varName = 'player';
          else if (pinLower.includes('entity')) varName = 'entity';
          else if (pinLower.includes('item')) varName = 'item';
          else if (pinLower.includes('id')) varName = 'id';
          else if (pinLower.includes('value')) varName = 'val';
        }
      }
    }
    if (!varName) varName = 'id';
    this.var.set(loopNode.id, varName);

    const listWire = this.wires.find(w => !w.isExec && w.toNode === loopNode.id && w.toPin === 'List');
    let listExpr = 'list.name';
    if (listWire) {
      const listSrc = this.byId.get(listWire.fromNode);
      if (listSrc) {
        if (listSrc.blueprintId === 'op_assembly_list' || listSrc.name === 'Assembly List') {
          listExpr = `list.${listSrc.listName || listSrc.inputValues?.['Name'] || 'name'}`;
        } else {
          listExpr = this.call(listSrc);
        }
      }
    } else {
      const rawList = loopNode.inputValues?.['List'];
      if (rawList) listExpr = rawList;
    }

    const bodyTarget = this.nextExec(loopNode, 'Loop Body');
    const completeTarget = this.nextExec(loopNode, 'Loop Complete');

    let out = `${ind}for ${varName} in ${listExpr} do\n`;
    if (bodyTarget) {
      out += this.emitExecutionChain(bodyTarget, ind + '  ');
    }
    out += `${ind}end\n`;

    if (completeTarget) {
      out += this.emitExecutionChain(completeTarget, ind);
    }
    return out;
  }

  emitFiniteLoop(loopNode, ind) {
    let varName = loopNode.varName || 'i';
    this.var.set(loopNode.id, varName);

    const startVal = this.argOut(loopNode, 'Start') || loopNode.inputValues?.['Start'] || '0';
    const endVal = this.argOut(loopNode, 'End') || loopNode.inputValues?.['End'] || '2';

    const bodyTarget = this.nextExec(loopNode, 'Loop Body');
    const completeTarget = this.nextExec(loopNode, 'Loop Complete');

    let out = `${ind}for ${varName} from ${startVal} to ${endVal} do\n`;
    if (bodyTarget) {
      out += this.emitExecutionChain(bodyTarget, ind + '  ');
    }
    out += `${ind}end\n`;

    if (completeTarget) {
      out += this.emitExecutionChain(completeTarget, ind);
    }
    return out;
  }

  emitSetCustomVar(node) {
    const targetWire = this.wires.find(w => !w.isExec && w.toNode === node.id && w.toPin === 'Target Entity');
    let targetStr = "f.getSelfEntity()";
    let targetEntityNode = null;

    if (targetWire) {
      targetEntityNode = this.byId.get(targetWire.fromNode);
      if (targetEntityNode) {
        if (targetEntityNode.blueprintId === 'query_get_self_entity' || targetEntityNode.name === 'Get Self Entity') {
          targetStr = "f.getSelfEntity()";
        } else if (targetEntityNode.blueprintId === 'query_query_entity_by_guid' || targetEntityNode.name === 'Query Entity by GUID') {
          const guidVal = targetEntityNode.inputValues?.['GUID'] || '0';
          targetStr = `f.queryEntitybyGUID(${guidVal})`;
        } else {
          targetStr = this.call(targetEntityNode);
        }
      }
    } else {
      const rawTarget = node.inputValues?.['Target Entity'];
      if (rawTarget === 'self' || rawTarget === 'Self Entity' || !rawTarget) {
        targetStr = "f.getSelfEntity()";
      } else {
        targetStr = lit(rawTarget || '');
      }
    }

    const varName = node.inputValues?.['Variable Name'] || '';
    
    // Check if Variable Value is wired to a node
    let valStr = '';
    const valWire = this.wires.find(w => !w.isExec && w.toNode === node.id && w.toPin === 'Variable Value');
    if (valWire) {
      const valSrc = this.byId.get(valWire.fromNode);
      if (valSrc) {
        valStr = this.call(valSrc);
      }
    } else {
      const rawVal = node.inputValues?.['Variable Value'];
      if (rawVal === 'get' || rawVal === '' || rawVal === undefined) {
        valStr = `self.${varName}`;
      } else {
        valStr = this.argOut(node, 'Variable Value') || '0';
      }
    }

    const trig = node.inputValues?.['Trigger Event'] || 'False';
    const trigBool = (trig === 'True' || trig === 'true' || trig === 'Yes');
    const trigStr = trigBool ? 'true' : 'false';

    let fnName = 'f.setCustomVar';
    const dt = (node.dataType || '').toLowerCase();
    if (dt === 'int' || dt === 'integer') fnName = 'f.setCustomVarInt';
    else if (dt === 'float') fnName = 'f.setCustomVarFloat';
    else if (dt === 'bool' || dt === 'boolean') fnName = 'f.setCustomVarBool';
    else if (dt === 'string' || dt === 'str') fnName = 'f.setCustomVarString';
    else if (dt === 'vector3' || dt === '3d_vector') fnName = 'f.setCustomVarVector3';
    else if (dt === 'entity') fnName = 'f.setCustomVarEntity';

    return `${fnName}(${targetStr}, '${varName}', ${valStr}, ${trigStr})`;
  }

  emitDoubleBranch(branch, ind) {
    const c = this.cond(branch);
    const yesTarget = this.nextExec(branch, 'Yes');
    const noTarget = this.nextExec(branch, 'No');

    let out = `${ind}if ${c} then\n`;
    if (yesTarget) {
      out += this.emitExecutionChain(yesTarget, ind + '  ');
    }

    if (noTarget) {
      out += `${ind}else\n`;
      out += this.emitExecutionChain(noTarget, ind + '  ');
    }

    out += `${ind}end\n`;
    return out;
  }

  emitMultiBranch(branch, ind) {
    const expr = this.ctrlExpr(branch);
    const branches = branch.dynamicBranches || ['Branch 0', 'Branch 1', 'Branch 2', 'Default'];
    let out = '';
    let first = true;
    for (const b of branches) {
      const target = this.nextExec(branch, b);
      if (!target && b === 'Default') continue;
      const kw = first ? `${ind}if ${expr} == "${b}" then\n` : (b === 'Default' ? `${ind}else\n` : `${ind}elseif ${expr} == "${b}" then\n`);
      first = false;
      out += kw;
      if (target) {
        out += this.emitExecutionChain(target, ind + '  ');
      }
    }
    out += `${ind}end\n`;
    return out;
  }

  nextExec(node, pin) {
    const w = this.wires.find(x => isExecWire(x) && x.fromNode === node.id && x.fromPin === pin);
    return w ? this.byId.get(w.toNode) : null;
  }

  cond(node) {
    const w = this.wires.find(x => !x.isExec && x.toNode === node.id && (x.toPin === 'Condition' || x.toPin === 'Control Expression'));
    if (!w) return lit(node.inputValues?.['Condition'] ?? true);
    const src = this.byId.get(w.fromNode);
    if (!src) return 'true';
    if (this.var.has(src.id)) return this.var.get(src.id);
    return this.call(src);
  }

  ctrlExpr(node) { return this.cond(node); }

  call(node) {
    if (!node) return 'nil';
    const bi = node.blueprintId || '';
    const nm = (node.name || '').toLowerCase();

    // Loops (referenced as data/value source)
    if (bi === 'exec_list_iteration_loop' || nm === 'list iteration loop') {
      return this.var.get(node.id) || node.varName || 'id';
    }
    if (bi === 'exec_finite_loop' || nm === 'finite loop') {
      return this.var.get(node.id) || node.varName || 'i';
    }

    // Local Variable
    if (bi === 'query_get_local_variable' || nm === 'get local variable') {
      const lvWire = this.wires.find(w => !w.isExec && w.fromNode === node.id && w.fromPin === 'Local Variable');
      let boundVarName = node.varName;
      if (lvWire) {
        const setNode = this.byId.get(lvWire.toNode);
        if (setNode && (setNode.blueprintId === 'exec_set_local_var' || (setNode.name || '').toLowerCase() === 'set local variable')) {
          boundVarName = setNode.varName || boundVarName;
        }
      }
      if (boundVarName) return boundVarName;
      if (this.var.has(node.id)) {
        return this.var.get(node.id);
      }
      const initVal = node.inputValues?.['Initial Value'];
      if (initVal !== undefined && initVal !== '') {
        let s = String(initVal);
        if (node.dataType === 'float' && !s.includes('.')) s += '.0';
        return s;
      }
      return node.dataType === 'float' ? '0.0' : '0';
    }

    // Pi Constant (Query Node -> Math -> Pi)
    if (bi === 'query_pi' || bi === 'op_pi' || nm === 'pi' || nm === 'pi (π)') {
      return 'f.pi()';
    }

    // Math: Trigonometry & Common functions
    if (bi === 'op_cosine_function' || nm === 'cosine function') {
      const rad = this.argOut(node, 'Radian') || '0';
      return `math.cos(${rad})`;
    }
    if (bi === 'op_sine_function' || nm === 'sine function') {
      const rad = this.argOut(node, 'Radian') || '0';
      return `math.sin(${rad})`;
    }
    if (bi === 'op_tangent_function' || nm === 'tangent function') {
      const rad = this.argOut(node, 'Radian') || '0';
      return `math.tan(${rad})`;
    }
    if (bi === 'op_arithmetic_square_root_operation' || nm === 'arithmetic square root operation') {
      const inp = this.argOut(node, 'Input') || '0';
      return `math.sqrt(${inp})`;
    }
    if (bi === 'op_arccosine_function' || nm === 'arccosine function') {
      const inp = this.argOut(node, 'Input') || '0';
      return `math.acos(${inp})`;
    }
    if (bi === 'op_arcsine_function' || nm === 'arcsine function') {
      const inp = this.argOut(node, 'Input') || '0';
      return `math.asin(${inp})`;
    }
    if (bi === 'op_arctangent_function' || nm === 'arctangent function') {
      const inp = this.argOut(node, 'Input') || '0';
      return `math.atan(${inp})`;
    }
    if (bi === 'op_absolute_value_operation' || nm === 'absolute value operation') {
      const inp = this.argOut(node, 'Input') || '0';
      return `math.abs(${inp})`;
    }
    if (bi === 'op_radians_to_degrees' || nm === 'radians to degrees') {
      const inp = this.argOut(node, 'Radian Value') || '0';
      return `math.deg(${inp})`;
    }
    if (bi === 'op_degrees_to_radians' || nm === 'degrees to radians') {
      const inp = this.argOut(node, 'Angle Value') || '0';
      return `math.rad(${inp})`;
    }
    if (bi === 'op_take_smaller_value' || nm === 'take smaller value') {
      const in1 = this.argOut(node, 'Input 1') || '0';
      const in2 = this.argOut(node, 'Input 2') || '0';
      return `math.min(${in1}, ${in2})`;
    }
    if (bi === 'op_take_larger_value' || nm === 'take larger value') {
      const in1 = this.argOut(node, 'Input 1') || '0';
      const in2 = this.argOut(node, 'Input 2') || '0';
      return `math.max(${in1}, ${in2})`;
    }
    if (bi === 'op_range_limiting' || nm === 'range limiting operation') {
      const inp = this.argOut(node, 'Input') || '0';
      const lower = this.argOut(node, 'Lower Limit') || '0';
      const upper = this.argOut(node, 'Upper Limit') || '0';
      return `math.clamp(${inp}, ${lower}, ${upper})`;
    }
    if (bi === 'op_round_to_integer_operation' || nm === 'round to integer operation') {
      const inp = this.argOut(node, 'Input') || '0';
      const mode = node.inputValues?.['Rounding Mode'];
      if (mode === 'Round Down') return `math.floor(${inp})`;
      if (mode === 'Round Up') return `math.ceil(${inp})`;
      if (mode === 'Truncate') return `math.trunc(${inp})`;
      return `math.round(${inp})`;
    }

    // Node Graph Variable
    if (bi === 'query_get_node_graph_var' || nm === 'get node graph variable') {
      return node.inputValues?.['Variable Name'] || 'Num';
    }

    // Custom Variable (Get Custom Variable)
    if (bi === 'query_get_custom_var' || nm === 'get custom variable') {
      const varName = node.inputValues?.['Variable Name'] || 'Variable';
      const targetWire = this.wires.find(w => !w.isExec && w.toNode === node.id && w.toPin === 'Target Entity');
      if (targetWire) {
        const targetNode = this.byId.get(targetWire.fromNode);
        if (targetNode) {
          if (targetNode.blueprintId === 'query_query_entity_by_guid' || targetNode.name === 'Query Entity by GUID') {
            const alias = targetNode.guidAlias || targetNode.alias;
            const guid = targetNode.inputValues?.['GUID'] || '';
            return alias ? `guid.${alias}.${varName}` : (guid ? `guid.${guid}.${varName}` : `guid.${varName}`);
          }
        }
      }
      return `self.${varName}`;
    }

    // Data Type Conversion
    if (bi === 'op_data_type_conversion' || nm === 'data type conversion') {
      const inp = this.argOut(node, 'Input') || '0';
      const dt = (node.dataType || '').toLowerCase();
      if (dt === 'int' || dt === 'integer') return `toInt(${inp})`;
      if (dt === 'float') return `toFloat(${inp})`;
      if (dt === 'bool' || dt === 'boolean') return `toBool(${inp})`;
      if (dt === 'string' || dt === 'str') return `tostring(${inp})`;
      if (dt === 'vector3' || dt === '3d_vector') return `toVector3(${inp})`;
      return `toInt(${inp})`;
    }

    // Math: Random
    if (bi === 'query_get_random_int' || nm === 'get random integer') {
      const min = this.argOut(node, 'Lower Limit') || '0';
      const max = this.argOut(node, 'Upper Limit') || '0';
      return `random(${min}, ${max})`;
    }
    if (bi === 'query_get_random_floating_point_number' || nm === 'get random floating point number') {
      const min = this.argOut(node, 'Lower Limit') || '0.0';
      const max = this.argOut(node, 'Upper Limit') || '0.0';
      return `randomFloat(${min}, ${max})`;
    }

    // Math: Binary arithmetic operators
    if (bi === 'op_addition' || nm === 'addition') {
      const in1 = this.argOut(node, 'Input 1') || '0';
      const in2 = this.argOut(node, 'Input 2') || '0';
      return `${in1} + ${in2}`;
    }
    if (bi === 'op_subtraction' || nm === 'subtraction') {
      const in1 = this.argOut(node, 'Input 1') || '0';
      const in2 = this.argOut(node, 'Input 2') || '0';
      return `${in1} - ${in2}`;
    }
    if (bi === 'op_multiplication' || nm === 'multiplication') {
      const in1 = this.argOut(node, 'Input 1') || '0';
      const in2 = this.argOut(node, 'Input 2') || '0';
      return `${in1} * ${in2}`;
    }
    if (bi === 'op_division' || nm === 'division') {
      const in1 = this.argOut(node, 'Input 1') || '0';
      const in2 = this.argOut(node, 'Input 2') || '0';
      return `${in1} / ${in2}`;
    }
    if (bi === 'op_modulo_operation' || nm === 'modulo operation') {
      const in1 = this.argOut(node, 'Input 1') || '0';
      const in2 = this.argOut(node, 'Input 2') || '0';
      return `${in1} % ${in2}`;
    }
    if (bi === 'op_exponentiation' || nm === 'exponentiation') {
      const base = this.argOut(node, 'Base') || '0';
      const exp = this.argOut(node, 'Exponent') || '0';
      return `${base} ^ ${exp}`;
    }

    // Comparisons / Logic
    if (bi === 'op_equal' || nm === 'equal') {
      const in1 = this.argOut(node, 'Input 1') || '0';
      const in2 = this.argOut(node, 'Input 2') || '0';
      return `${in1} == ${in2}`;
    }
    if (bi === 'op_greater_than' || nm === 'greater than') {
      const left = this.argOut(node, 'Left Value') || '0';
      const right = this.argOut(node, 'Right Value') || '0';
      return `${left} > ${right}`;
    }
    if (bi === 'op_greater_than_or_equal_to' || nm === 'greater than or equal to') {
      const left = this.argOut(node, 'Left Value') || '0';
      const right = this.argOut(node, 'Right Value') || '0';
      return `${left} >= ${right}`;
    }
    if (bi === 'op_less_than' || nm === 'less than') {
      const left = this.argOut(node, 'Left Value') || '0';
      const right = this.argOut(node, 'Right Value') || '0';
      return `${left} < ${right}`;
    }
    if (bi === 'op_less_than_or_equal_to' || nm === 'less than or equal to') {
      const left = this.argOut(node, 'Left Value') || '0';
      const right = this.argOut(node, 'Right Value') || '0';
      return `${left} <= ${right}`;
    }
    if (bi === 'op_logical_and_operation' || nm === 'logical and operation') {
      const in1 = this.argOut(node, 'Input 1') || 'true';
      const in2 = this.argOut(node, 'Input 2') || 'true';
      return `${in1} and ${in2}`;
    }
    if (bi === 'op_logical_or_operation' || nm === 'logical or operation') {
      const in1 = this.argOut(node, 'Input 1') || 'false';
      const in2 = this.argOut(node, 'Input 2') || 'false';
      return `${in1} or ${in2}`;
    }
    if (bi === 'op_logical_not_operation' || nm === 'logical not operation') {
      const inp = this.argOut(node, 'Input') || 'false';
      return `not (${inp})`;
    }

    // Vector3 Constants
    if (bi === 'query_3d_vector_zero_vector' || bi === 'query_vector3_zero_vector' || nm === 'zero vector') {
      return '(x = 0.0, y = 0.0, z = 0.0)';
    }
    if (bi === 'query_3d_vector_forward' || bi === 'query_vector3_forward' || nm === 'forward') {
      return '(x = 0.0, y = 0.0, z = 1.0)';
    }
    if (bi === 'query_3d_vector_backward' || bi === 'query_vector3_backward' || nm === 'backward') {
      return '(x = 0.0, y = 0.0, z = -1.0)';
    }
    if (bi === 'query_3d_vector_up' || bi === 'query_vector3_up' || nm === 'up') {
      return '(x = 0.0, y = 1.0, z = 0.0)';
    }
    if (bi === 'query_3d_vector_down' || bi === 'query_vector3_down' || nm === 'down') {
      return '(x = 0.0, y = -1.0, z = 0.0)';
    }
    if (bi === 'query_3d_vector_right' || bi === 'query_vector3_right' || nm === 'right') {
      return '(x = 1.0, y = 0.0, z = 0.0)';
    }
    if (bi === 'query_3d_vector_left' || bi === 'query_vector3_left' || nm === 'left') {
      return '(x = -1.0, y = 0.0, z = 0.0)';
    }

    // List Assembly
    if (bi === 'op_assembly_list' || nm === 'assembly list') {
      const dynamicKeys = node.dynamicInputs || ['0'];
      const elemType = node.dataType || 'int';
      const elems = [];
      for (const k of dynamicKeys) {
        const val = this.argOut(node, k);
        if (elemType === 'vector3') {
          elems.push(formatVec3(val || '(x = 0.0, y = 0.0, z = 0.0)'));
        } else {
          elems.push(val !== undefined && val !== '' ? val : '0');
        }
      }
      return `{ ${elems.join(', ')} }`;
    }

    // List Queries
    if (bi === 'query_get_val_from_list' || nm === 'get corresponding value from list' || nm === 'get value from list') {
      const listWire = this.wires.find(w => !w.isExec && w.toNode === node.id && (w.toPin === 'List' || w.toPin === 'Target List'));
      let listArg = 'list';
      if (listWire) {
        const srcNode = this.byId.get(listWire.fromNode);
        if (srcNode) {
          if (srcNode.listName) {
            listArg = `list.${srcNode.listName}`;
          } else if (srcNode.varName) {
            listArg = srcNode.varName;
          } else {
            listArg = this.call(srcNode);
          }
        }
      } else {
        listArg = node.inputValues?.['List'] || node.inputValues?.['Target List'] || 'list';
      }
      const idArg = this.argOut(node, 'ID') || '0';
      return `f.getValFromList(${listArg}, ${idArg})`;
    }

    if (bi === 'exec_set_custom_var' || nm === 'set custom variable') {
      return this.emitSetCustomVar(node);
    }

    const fn = fnName(node);
    const args = this.args(node);
    return `f.${fn}(${args})`;
  }

  args(node) {
    const bp = getNodeBlueprint(node.blueprintId) || getNodeBlueprint(node.name);
    if (!bp || !Array.isArray(bp.inputs)) return '';

    if (node.blueprintId === 'exec_send_signal') {
      const sig = node.inputValues?.['Signal Name'] || 'signal';
      const def = signalsManager && signalsManager.getSignal ? signalsManager.getSignal(sig) : null;
      const params = def && Array.isArray(def.params) ? def.params : [];
      const parts = [`"${sig}"`];
      for (const p of params) {
        const val = this.argOut(node, p.name);
        parts.push(val !== undefined ? val : '0');
      }
      return parts.join(', ');
    }

    const parts = [];
    for (const inp of bp.inputs) {
      parts.push(this.argOut(node, inp.name));
    }
    return parts.join(', ');
  }

  argOut(node, pinName) {
    const w = this.wires.find(x => !x.isExec && x.toNode === node.id && x.toPin === pinName);
    if (w) {
      const src = this.byId.get(w.fromNode);
      if (src) {
        if (isEvent(src)) {
          const k = `${src.id}::${w.fromPin}`;
          if (this.evVar.has(k)) return this.evVar.get(k);
          return slug(w.fromPin);
        }
        if (src.blueprintId === 'exec_list_iteration_loop' || src.name === 'List Iteration Loop') {
          return this.var.get(src.id) || src.varName || 'id';
        }
        if (src.blueprintId === 'exec_finite_loop' || src.name === 'Finite Loop') {
          return this.var.get(src.id) || src.varName || 'i';
        }
        if (this.var.has(src.id)) return this.var.get(src.id);
        return this.call(src);
      }
    }
    const val = node.inputValues?.[pinName];
    const pinType = this.g?.getPinType ? this.g.getPinType(node.id, pinName) : '';
    if (pinType === 'vector3' || (typeof val === 'string' && val.startsWith('(') && val.endsWith(')'))) {
      return formatVec3(val || '(x = 0.0, y = 0.0, z = 0.0)');
    }
    return lit(val ?? '');
  }
}
