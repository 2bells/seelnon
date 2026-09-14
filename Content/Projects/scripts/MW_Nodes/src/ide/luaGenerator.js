/**
 * luaGenerator.js — graph → Lua "interactive mirror".
 *
 * SHOWCASE dialect of the Miliastra node graph. Nodes and code are two views
 * of ONE model: edit the graph and this re-renders the Lua; edit the Lua and
 * luaParser feeds the edit back. Every emitted node carries a stable
 * `-- @<id>` stamp so a code→graph pass reconciles IN PLACE by id — never a
 * wholesale rebuild, so positions and untouched pins survive.
 *
 * Dialect:
 *   f.on("name", function(ctx) ... end)                — event handler
 *   local d_1 = f.<fn>(...)             -- @id          — data/query node
 *   f.<fn>(...)                         -- @id          — action node
 *   if <expr> then ... else ... end        -- @id          — Double Branch
 *   if <ctrl> == 'Branch 0' then ...
 *       elseif ... else ... end                            — Branch-multiswitch
 */

import { getNodeBlueprint } from '../nodesData.js';
import { signalsManager } from '../signalsManager.js';

const EVENT_MAP = {
  'when tab selected': 'whenTabSelected',
  'when tab is selected': 'whenTabSelected',
  'monitor signal': 'monitorSignal',
  'when custom variable changes': 'whenCustomVariableChanges',
  'when entity is created': 'whenEntityIsCreated',
  'when character dies': 'whenCharacterDies',
};

export class LuaGenerator {
  static generate(graphState) {
    return new _LuaGen(graphState).run();
  }
}

function isEvent(n) { return (n.category || '') === 'event' || (n.blueprintId || '').startsWith('event_'); }
function isData(n) {
  return (n.category || '') === 'query' || (n.blueprintId || '').startsWith('query_') ||
         (n.category || '') === 'operation' || (n.blueprintId || '').startsWith('op_');
}

function toCamel(s) {
  return String(s || '')
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, c => c.toLowerCase()) || 'action';
}

function fnName(n) {
  return toCamel(n.name || n.blueprintId || 'action');
}

function shortLiteral(v) {
  if (v == null) return "''";
  const s = String(v).trim();
  const lower = s.toLowerCase();
  if (lower === 'true' || lower === 'yes' || lower === 'on') return 'true';
  if (lower === 'false' || lower === 'no' || lower === 'off') return 'false';
  if (/^-?[0-9]+(\.[0-9]+)?$/.test(s)) return s;
  return `'${s.replace(/'/g, "\\'")}'`;
}

// "Event Source Entity" -> "eventSourceEntity"; -> as Lua var -> "event_source_entity".
function slug(pin) {
  const camel = String(pin || '')
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, c => c.toLowerCase());
  return camel.replace(/([A-Z])/g, (_, c) => '_' + c.toLowerCase());
}

function isExecWire(w) { return w.isExec; }

class _LuaGen {
  constructor(graphState) {
    this.g = graphState;
    this.nodes = graphState.nodes || [];
    this.wires = graphState.wires || [];
    this.byId = new Map(this.nodes.map(n => [n.id, n]));
  }

  run() {
    const name = this.g.name || 'Untitled';
    const events = this.nodes.filter(isEvent);
    let out =
      `-- =========================================================\n` +
      `--  ${name} — Miliastra Wonderland · interactive mirror\n` +
      `--  ONE MODEL ⇄ two views  (nodes ↔ code) — edit either, both follow\n` +
      `--\n` +
      `--  f.<fn> — node blueprints as functions; pin values are the "constants".\n` +
      `--  It's illustrative Lua, not an engine — the point is the lock-step\n` +
      `--  between the visual graph and the code beside it.\n` +
      `-- =========================================================\n` +
      `local f = require("node_graph.functions")\n\n`;

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

  emitEvent(ev) {
    this.var = new Map();       // nodeId -> local var
    this.evVar = new Map();     // "evid::pin" -> local var
    this._n = 0;
    this.visited = new Set();
    this.ev = ev;

    const reach = this.reachableSet(ev);
    const evName = this.eventName(ev);

    // The pins the handler can read from the event. For signals, name each one
    // after its pin so the code reads like real data (source, origin, damage…)
    // instead of opaque `ctx`. Everything available is listed, not just what the
    // graph happens to wire — that's the descriptive "inputs from the game".
    const pins = this.readablePins(ev);
    let evConsts = '';
    for (const pin of pins) {
      const vn = slug(pin);
      this.evVar.set(`${ev.id}::${pin}`, vn);
      evConsts += `  local ${vn} = ctx -- @${ev.id} ${pin}\n`;
    }
    if (!evConsts) evConsts = '  -- ctx is the event payload (nothing read yet)\n';

    const dataConsts = this.emitDataConsts(reach);
    const body = this.walkFrom(ev, '  ');

    return (
      `-- -------- event · ${ev.name || 'handler'} (${evName}) --------\n` +
      `f.on("${evName}", function(ctx) -- @${ev.id}\n` +
      evConsts + '\n' +
      dataConsts +
      body +
      `end)\n`
    );
  }

  // Which output pins a handler can read. Signals add their payload params.
  readablePins(ev) {
    const bp = getNodeBlueprint(ev.blueprintId) || getNodeBlueprint(ev.name);
    const pins = [];
    if (bp && Array.isArray(bp.outputs)) bp.outputs.forEach(o => pins.push(o.name));
    if ((ev.blueprintId || '') === 'event_monitor_signal' || (ev.blueprintId || '').match(/signal/)) {
      let params = (ev.customInputs || []).map(c => c && c.name).filter(Boolean);
      const def = signalsManager && signalsManager.getSignal ? signalsManager.getSignal(this.eventName(ev)) : null;
      if (def && Array.isArray(def.params)) params = def.params.map(p => p.name);
      for (const p of params) if (!pins.includes(p)) pins.push(p);
    }
    return pins;
  }

  nextVar(prefix) { this._n++; return `${prefix}_${this._n}`; }

  eventName(ev) {
    // A Monitor Signal event is literally "on <signal name>" — that name is the
    // identity that links it to the broadcasts, so carry it (not a generic stub).
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

  // Data consts, ordered so consumers always come after their producers.
  emitDataConsts(reach) {
    const data = [...reach]
      .map(id => this.byId.get(id))
      .filter(Boolean).filter(isData)
      .filter(n => this.wires.some(w => !w.isExec && w.fromNode === n.id));

    const adj = new Map();   // producerId -> Set(consumerId)
    const indeg = new Map();
    for (const n of data) { indeg.set(n.id, 0); }
    for (const n of data) {
      for (const w of this.wires) {
        if (!w.isExec && w.toNode === n.id && indeg.has(w.fromNode) && w.fromNode !== n.id) {
          if (!adj.has(w.fromNode)) adj.set(w.fromNode, []);
          adj.get(w.fromNode).push(n.id);
          indeg.set(n.id, indeg.get(n.id) + 1);
        }
      }
    }
    const queue = data.filter(n => indeg.get(n.id) === 0).map(n => n.id);
    const orderIds = [];
    while (queue.length) {
      const id = queue.shift();
      orderIds.push(id);
      for (const c of (adj.get(id) || [])) {
        indeg.set(c, indeg.get(c) - 1);
        if (indeg.get(c) === 0) queue.push(c);
      }
    }
    for (const n of data) if (!orderIds.includes(n.id)) orderIds.push(n.id);

    let out = '';
    for (const id of orderIds) {
      const n = this.byId.get(id);
      if (this.var.has(n.id)) continue;
      // Keep any name the user gave this local in the editor (e.g. `local list = …`),
      // only auto-assign `d_N` when the node has no custom name yet.
      const vn = this.validVarName(n.varName) ? n.varName : this.nextVar('d');
      this.var.set(n.id, vn);
      out += `  local ${vn} = ${this.call(n)} -- @${n.id}\n`;
    }
    return out;
  }

  validVarName(name) {
    if (typeof name !== 'string' || !name) return false;
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !/^f$|^n$|^utils$|^ctx$|^payload$|^event$|^d_\d+$|^(true|false|nil)$/.test(name);
  }

  walkFrom(node, ind) {
    this.visited.add(node.id);
    let out = '';
    for (const t of this.execTargets(node)) out += this.walkNode(t, ind);
    return out;
  }

  walkNode(id, ind) {
    if (!id || this.visited.has(id)) return '';
    this.visited.add(id);
    const n = this.byId.get(id);
    if (!n) return '';
    const bi = n.blueprintId || '';
    const nm = (n.name || '').toLowerCase();

    if (bi === 'flow_double_branch' || nm === 'double branch') {
      const cond = this.cond(n) || 'true';
      const yes = this.execTargets(n, 'Yes');
      const no = this.execTargets(n, 'No');
      let s = `${ind}if ${cond} then -- @${n.id}\n`;
      for (const t of yes) s += this.walkNode(t, ind + '  ');
      if (no.length) {
        s += `${ind}else\n`;
        for (const t of no) s += this.walkNode(t, ind + '  ');
      } else {
        s += `${ind}  -- (no false-branch)\n`;
      }
      s += `${ind}end\n`;
      return s;
    }

    if (bi === 'flow_multiple_branches' || nm === 'multiple branches') {
      const ctrl = this.cond(n) || "'0'";
      const arms = (n.dynamicBranches && n.dynamicBranches.filter(b => b !== 'Default')) || this.collectBranchLabels(n);
      let s = '';
      let i = 0;
      for (const label of arms) {
        const targets = this.execTargets(n, label);
        if (!targets.length) continue;
        s += `${ind}${i === 0 ? 'if' : 'elseif'} ${ctrl} == ${shortLiteral(label)} then${i === 0 ? ' -- @' + n.id : ''}\n`;
        for (const t of targets) s += this.walkNode(t, ind + '  ');
        i++;
      }
      const dflt = this.execTargets(n, 'Default');
      if (dflt.length) {
        s += `${ind}else\n`;
        for (const t of dflt) s += this.walkNode(t, ind + '  ');
      }
      s += `${ind}end -- @${n.id}\n`;
      return s;
    }

    // plain action
    let out = `${ind}${this.call(n)} -- @${n.id}\n`;
    for (const t of this.execTargets(n)) out += this.walkNode(t, ind);
    return out;
  }

  collectBranchLabels(n) {
    const map = new Map();
    for (const w of this.wires) if (w.isExec && w.fromNode === n.id && w.fromPin && w.fromPin !== 'Default') map.set(w.fromPin, 1);
    const list = [...map.keys()];
    return list.length ? list : ['Branch 0', 'Branch 1'];
  }

  execTargets(node, pin) {
    return this.wires
      .filter(w => w.isExec && w.fromNode === node.id && (pin ? w.fromPin === pin : true))
      .map(w => w.toNode);
  }

  cond(node) {
    const w = this.wires.find(ww => !ww.isExec && ww.toNode === node.id &&
      (ww.toPin === 'Condition' || ww.toPin === 'Control Expression' || ww.toPin === 'control expression'));
    if (w) {
      if (this.evVar.has(`${w.fromNode}::${w.fromPin}`)) return this.evVar.get(`${w.fromNode}::${w.fromPin}`);
      if (this.var.has(w.fromNode)) return this.var.get(w.fromNode);
      return this.call(this.byId.get(w.fromNode)) || 'true';
    }
    const lit = node.inputValues?.['Condition'] ?? node.inputValues?.['Control Expression'];
    if (lit != null) {
      const s = String(lit).trim().toLowerCase();
      if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return 'true';
      if (s === 'false' || s === '0' || s === 'no' || s === 'off') return 'false';
      return shortLiteral(lit);
    }
    return 'true';
  }

  ctrlExpr(node) { return this.cond(node); }

  // Emit an instantiation for a data node, returning a local var name.
  localFor(nodeVar) {
    return nodeVar;
  }

  call(node) {
    if (!node) return 'nil';
    const fn = fnName(node);
    const args = this.args(node);
    return `f.${fn}(${args})`;
  }

  args(node) {
    const bp = getNodeBlueprint(node.blueprintId) || getNodeBlueprint(node.name);
    const isSignal = (node.blueprintId || '').match(/signal/);
    const pinDefs = this.knownPins(node);
    const out = [];
    // Signals: lead with the signal name, then its payload params — gathered in a
    // stable order so name + params come back exactly (never reset to defaults).
    if (isSignal && Array.isArray(node.customInputs)) {
      const namePin = 'Signal Name';
      out.push(this.argOut(node, namePin));
      for (const c of node.customInputs) {
        if (!c || c.name == null) continue;
        out.push(this.argOut(node, String(c.name), bp));
      }
      return out.join(', ');
    }
    for (const p of pinDefs) out.push(this.argOut(node, p, bp));
    return out.join(', ');
  }

  argOut(node, p, bp) {
    const w = this.wires.find(ww => !ww.isExec && ww.toNode === node.id && ww.toPin === p);
    if (w) {
      if (this.evVar.has(`${w.fromNode}::${w.fromPin}`)) return this.evVar.get(`${w.fromNode}::${w.fromPin}`);
      if (this.var.has(w.fromNode)) return this.var.get(w.fromNode);
      const src = this.byId.get(w.fromNode);
      if (src && src !== node) return this.call(src); // inline data call
      return this.argLiteral(node, p);
    }
    return this.renderValue(node, p, node.inputValues?.[p] ?? this.defaultValue(node, p));
  }

  argLiteral(node, p) {
    return this.renderValue(node, p, node.inputValues?.[p] ?? this.defaultValue(node, p));
  }

  knownPins(node) {
    const bp = getNodeBlueprint(node.blueprintId) || getNodeBlueprint(node.name);
    const pins = [];
    const seen = new Set();
    if (bp && Array.isArray(bp.inputs)) {
      for (const inp of bp.inputs) if (!seen.has(inp.name)) { seen.add(inp.name); pins.push(inp.name); }
    }
    if (Array.isArray(node.dynamicInputs)) {
      for (const dyn of node.dynamicInputs) if (!seen.has(String(dyn))) { seen.add(String(dyn)); pins.push(String(dyn)); }
    }
    if (Array.isArray(node.customInputs)) {
      for (const c of node.customInputs) if (c && typeof c === 'object' && c.name && !seen.has(c.name)) { seen.add(c.name); pins.push(c.name); }
    }
    return pins;
  }

  defaultValue(node, p) {
    const bp = getNodeBlueprint(node.blueprintId) || getNodeBlueprint(node.name);
    if (bp && Array.isArray(bp.inputs)) {
      const inp = bp.inputs.find(i => i.name === p);
      if (inp && inp.defaultVal !== undefined) return inp.defaultVal;
    }
    return '';
  }

  inputType(node, p) {
    const bp = getNodeBlueprint(node.blueprintId) || getNodeBlueprint(node.name);
    if (bp && Array.isArray(bp.inputs)) {
      const inp = bp.inputs.find(i => i.name === p);
      if (inp && inp.type) return inp.type;
    }
    return null;
  }

  renderValue(node, p, val) {
    const type = this.inputType(node, p);
    if (type === 'bool' || (node.pinTypes && node.pinTypes[p] === 'bool')) return this.boolLit(val);
    if (type === 'vector3' || (node.pinTypes && node.pinTypes[p] === 'vector3')) return this.vec3Lit(val);
    if (type === 'string') return this.strLit(val);
    const s = String(val ?? '').trim().toLowerCase();
    if (s === 'true' || s === 'false') return s;
    return this.literal(val);
  }

  vec3Lit(val) {
    let o = { x: 0, y: 0, z: 0 };
    if (typeof val === 'object' && val !== null) {
      o = { x: Number(val.x) || 0, y: Number(val.y) || 0, z: Number(val.z) || 0 };
    } else if (typeof val === 'string' && val.startsWith('(') && val.endsWith(')')) {
      const parts = val.slice(1, -1).split(',').map(s => Number(s.trim()) || 0);
      o = { x: parts[0] || 0, y: parts[1] || 0, z: parts[2] || 0 };
    } else {
      const n = Number(val);
      if (Number.isFinite(n)) o = { x: n, y: n, z: n };
    }
    return `{ x = ${o.x}, y = ${o.y}, z = ${o.z} }`;
  }

  boolLit(v) {
    const s = String(v ?? '').trim().toLowerCase();
    return (s === '1' || s === 'true' || s === 'yes' || s === 'on') ? 'true' : 'false';
  }

  strLit(v) {
    return `'${String(v == null ? '' : v).replace(/'/g, "\\'")}'`;
  }

  literal(val) {
    if (val == null || val === '') return "''";
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'object' && val !== null && val.x !== undefined) {
      return `{ x = ${Number(val.x) || 0}, y = ${Number(val.y) || 0}, z = ${Number(val.z) || 0} }`;
    }
    if (typeof val === 'string' && val.startsWith('(') && val.endsWith(')')) {
      const parts = val.slice(1, -1).split(',').map(s => Number(s.trim()) || 0);
      return `{ x = ${parts[0] || 0}, y = ${parts[1] || 0}, z = ${parts[2] || 0} }`;
    }
    if (typeof val === 'number' || (typeof val === 'string' && /^-?[0-9.]+$/.test(val.trim()))) {
      return val.trim && val.trim() !== '' ? val.trim() : String(val);
    }
    return this.strLit(val);
  }
}