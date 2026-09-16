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
  'when tab selected': 'whenTabSelected',
  'when signal received': 'whenSignalReceived',
  'monitor signal': 'whenSignalReceived'
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

function lit(v) {
  if (v === null || v === undefined) return "''";
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  const s = String(v);
  if (s === 'true' || s === 'false') return s;
  if (/^-?\d+(\.\d+)?$/.test(s)) return s;
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
    const graphVars = (this.g.getNodeGraphVariables ? this.g.getNodeGraphVariables() : (this.g.nodeGraphVariables || []));
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
          formattedVal = (defVal === 'True' || defVal === '1' || defVal === 'true' || defVal === 'Yes') ? 'false' : 'false';
          if (defVal === 'True' || defVal === '1' || defVal === 'true' || defVal === 'Yes') formattedVal = 'true';
        } else if (varType === 'string') {
          formattedVal = `"${defVal.replace(/"/g, '\\"')}"`;
        } else if (varType === 'vector3') {
          formattedVal = defVal || '{ 0, 0, 0 }';
        }

        out += `${varName}: ${varType} = ${formattedVal}\n`;
      }
      out += `\n`;
    }

    // 2. Emit Custom Variables Header (from Set Custom Variable nodes and custom variables registry)
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

    // From nodes in graph
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
    this._n = 0;
    this.visited = new Set();
    this.ev = ev;

    const reach = this.reachableSet(ev);
    const evName = this.eventName(ev);

    // Register all Get Node Graph Variable and Get Local Variable nodes
    for (const n of this.nodes) {
      if (n.blueprintId === 'query_get_node_graph_var' || (n.name || '').toLowerCase() === 'get node graph variable') {
        const vn = n.inputValues?.['Variable Name'] || 'Num';
        this.var.set(n.id, vn);
      }
      if (n.blueprintId === 'query_get_local_variable' || (n.name || '').toLowerCase() === 'get local variable') {
        const vn = n.varName || 'sum';
        this.var.set(n.id, vn);
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

    return (
      `-- -------- event · ${ev.name || 'handler'} (${evName}) --------\n` +
      `f.on("${evName}", function(ctx)\n` +
      evConsts + '\n' +
      dataConsts +
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

  nextVar(prefix) { this._n++; return `${prefix}_${this._n}`; }

  eventName(ev) {
    if ((ev.blueprintId || '') === 'event_monitor_signal') {
      return ev.inputValues?.['Signal Name'] || ev.signalName || 'no_signal';
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

  walkFrom(node, ind) {
    let out = '';
    let curr = this.nextExec(node, 'execOut');
    let inInitPhase = true;
    let hasEmittedInitHeader = false;
    let hasEmittedLogicHeader = false;

    while (curr) {
      if (this.visited.has(curr.id)) break;
      this.visited.add(curr.id);

      const isSetCustomVar = curr.blueprintId === 'exec_set_custom_var' || (curr.name || '').toLowerCase() === 'set custom variable';

      if (inInitPhase && isSetCustomVar) {
        if (!hasEmittedInitHeader) {
          out += `${ind}-- Custom Var Initialisation\n`;
          hasEmittedInitHeader = true;
        }
        out += `${ind}${this.emitSetCustomVar(curr)}\n`;
      } else {
        if (inInitPhase) {
          inInitPhase = false;
          if (hasEmittedInitHeader) out += '\n';
        }
        if (!hasEmittedLogicHeader) {
          out += `${ind}-- Logic\n`;
          hasEmittedLogicHeader = true;
        }

        if (curr.blueprintId === 'flow_double_branch' || curr.name === 'Double Branch') {
          out += this.emitDoubleBranch(curr, ind);
          break;
        }
        if (curr.blueprintId === 'flow_multiple_branches' || curr.name === 'Multiple Branches') {
          out += this.emitMultiBranch(curr, ind);
          break;
        }

        // Check for set node graph variable
        if (curr.blueprintId === 'exec_set_node_graph_var' || (curr.name || '').toLowerCase() === 'set node graph variable') {
          const vn = curr.inputValues?.['Variable Name'] || 'num';
          const val = this.argOut(curr, 'Variable Value') || '0';
          out += `${ind}${vn} = ${val}\n`;
        } else if (curr.blueprintId === 'exec_set_local_var' || (curr.name || '').toLowerCase() === 'set local variable') {
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
          varName = varName || 'sum';
          const val = this.argOut(curr, 'Value') || '0';
          const typeAnno = dt ? `: ${dt}` : '';

          if (!this.emittedLocals) this.emittedLocals = new Set();
          if (!this.emittedLocals.has(varName)) {
            this.emittedLocals.add(varName);
            out += `${ind}local ${varName}${typeAnno} = ${val}\n`;
          } else {
            out += `${ind}${varName} = ${val}\n`;
          }
        } else if (isSetCustomVar) {
          out += `${ind}${this.emitSetCustomVar(curr)}\n`;
        } else {
          out += `${ind}${this.call(curr)}\n`;
        }
      }
      curr = this.nextExec(curr, 'execOut');
    }

    if (!hasEmittedLogicHeader && hasEmittedInitHeader) {
      out += `\n${ind}-- Logic\n`;
    } else if (!hasEmittedLogicHeader && !hasEmittedInitHeader) {
      out += `${ind}-- Logic\n`;
    }

    return out;
  }

  emitSetCustomVar(node) {
    const targetWire = this.wires.find(w => !w.isExec && w.toNode === node.id && w.toPin === 'Target Entity');
    let targetStr = "''";
    let targetEntityNode = null;
    if (targetWire) {
      targetEntityNode = this.byId.get(targetWire.fromNode);
      if (targetEntityNode) {
        if (targetEntityNode.blueprintId === 'query_get_self_entity' || targetEntityNode.name === 'Get Self Entity') {
          targetStr = "'f.getSelfEntity'";
        } else if (targetEntityNode.blueprintId === 'query_query_entity_by_guid' || targetEntityNode.name === 'Query Entity by GUID') {
          const guidVal = targetEntityNode.inputValues?.['GUID'] || '0';
          targetStr = `'f.queryEntitybyGUID(${guidVal})'`;
        }
      }
    } else {
      const rawTarget = node.inputValues?.['Target Entity'];
      if (rawTarget === 'self' || rawTarget === 'Self Entity') targetStr = "'f.getSelfEntity'";
      else targetStr = lit(rawTarget || '');
    }

    const varName = node.inputValues?.['Variable Name'] || '';
    
    // Check if Variable Value is wired to a Get Custom Variable node
    let valStr = '';
    const valWire = this.wires.find(w => !w.isExec && w.toNode === node.id && w.toPin === 'Variable Value');
    if (valWire) {
      const valSrc = this.byId.get(valWire.fromNode);
      if (valSrc && (valSrc.blueprintId === 'query_get_custom_var' || valSrc.name === 'Get Custom Variable')) {
        valStr = this.call(valSrc);
      } else if (valSrc) {
        valStr = this.call(valSrc);
      }
    } else {
      const rawVal = node.inputValues?.['Variable Value'];
      if (rawVal === 'get' || rawVal === '' || rawVal === undefined) {
        if (targetEntityNode && (targetEntityNode.blueprintId === 'query_query_entity_by_guid' || targetEntityNode.name === 'Query Entity by GUID')) {
          const alias = targetEntityNode.guidAlias || targetEntityNode.alias;
          const guid = targetEntityNode.inputValues?.['GUID'] || '';
          valStr = alias ? `guid.${alias}.${varName}` : (guid ? `guid.${guid}.${varName}` : `guid.${varName}`);
        } else {
          valStr = `self.${varName}`;
        }
      } else {
        valStr = this.argOut(node, 'Variable Value') || '0';
      }
    }

    const trig = node.inputValues?.['Trigger Event'] || 'False';
    const trigStr = (trig === 'True' || trig === 'true' || trig === 'Yes') ? "'True'" : "'False'";

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
      this.visited.add(yesTarget.id);
      if (yesTarget.blueprintId === 'exec_set_node_graph_var') {
        const vn = yesTarget.inputValues?.['Variable Name'] || 'num';
        const val = this.argOut(yesTarget, 'Variable Value') || '0';
        out += `${ind}  ${vn} = ${val}\n`;
      } else if (yesTarget.blueprintId === 'exec_set_custom_var') {
        out += `${ind}  ${this.emitSetCustomVar(yesTarget)}\n`;
      } else {
        out += `${ind}  ${this.call(yesTarget)}\n`;
      }
      out += this.walkFrom(yesTarget, ind + '  ');
    }

    if (noTarget) {
      this.visited.add(noTarget.id);
      out += `${ind}else\n`;
      if (noTarget.blueprintId === 'exec_set_node_graph_var') {
        const vn = noTarget.inputValues?.['Variable Name'] || 'num';
        const val = this.argOut(noTarget, 'Variable Value') || '0';
        out += `${ind}  ${vn} = ${val}\n`;
      } else if (noTarget.blueprintId === 'exec_set_custom_var') {
        out += `${ind}  ${this.emitSetCustomVar(noTarget)}\n`;
      } else {
        out += `${ind}  ${this.call(noTarget)}\n`;
      }
      out += this.walkFrom(noTarget, ind + '  ');
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
        this.visited.add(target.id);
        out += `${ind}  ${this.call(target)}\n`;
        out += this.walkFrom(target, ind + '  ');
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

    // Local Variable
    if (bi === 'query_get_local_variable' || nm === 'get local variable') {
      const lvWire = this.wires.find(w => !w.isExec && w.fromNode === node.id && w.fromPin === 'Local Variable');
      let boundVarName = node.varName;
      if (lvWire) {
        const setNode = this.byId.get(lvWire.toNode);
        if (setNode && setNode.varName) boundVarName = setNode.varName;
      }
      if (boundVarName) return boundVarName;
      if (this.var.has(node.id)) {
        return this.var.get(node.id);
      }
      const initVal = node.inputValues?.['Initial Value'];
      if (initVal !== undefined && initVal !== '') return initVal;
      return 'sum';
    }

    // Pi Constant
    if (bi === 'op_pi' || nm === 'pi') {
      return 'math.pi()';
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
        if (this.var.has(src.id)) return this.var.get(src.id);
        return this.call(src);
      }
    }
    return lit(node.inputValues?.[pinName] ?? '');
  }
}
