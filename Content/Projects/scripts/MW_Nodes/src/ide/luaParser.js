/**
 * luaParser.js — Lua "interactive mirror" → node graph.
 *
 * Reads back the Lua that luaGenerator emits and turns edits back into the SAME
 * node model. ide.js reconciles the result IN PLACE via the stable `-- @<id>`
 * stamps, so node ids & positions survive — only what the code changed applies.
 *
 *   utils.on("ev", function(ctx) … end)                handler
 *   local d = utils.<fn>(…)             -- @<id>       data/query node
 *   utils.<fn>(…)                       -- @<id>       action node
 *   if <cond> then …  else …  end       -- @<id>       Double Branch
 *   if <c>=='A' then … elseif <c>=='B' then … else … end   multiswitch
 */

import { getNodeBlueprint, NODE_REGISTRY } from '../nodesData.js';
import { signalsManager } from '../signalsManager.js';

function toCamel(s) {
  return String(s || '')
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, c => c.toLowerCase());
}

let REVERSE = null;
function resolveNode(fn) {
  if (!REVERSE) {
    REVERSE = new Map();
    (NODE_REGISTRY || []).forEach(bp => {
      const key = toCamel(bp.name);
      if (key && !REVERSE.has(key)) REVERSE.set(key, bp);
    });
  }
  return REVERSE.get(fn) || null;
}

export class LuaParser {
  static parse(code) { return new _LuaParser(code).run(); }
}

const PREFIX = new Set(['utils', 'f', 'n']);

class _LuaParser {
  constructor(code) { this.code = code || ''; }

  run() {
    this.nodes = [];
    this.wires = [];
    this._n = 1;
    this.takenIds = new Set();

    let name = 'Untitled';
    const hn = /(?:f|n|utils)\.on\(\s*'([^']+)'/.exec(this.code);
    if (hn && hn[1]) name = hn[1].replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();

    const T = this.tokenize(this.code);
    const handlers = this.findHandlers(T);

    for (const h of handlers) {
      this.varToNode = new Map();
      this.varToEvent = new Map();
      this.x = 320; this.y = 240;

      this.T = T.slice(h.bodyStart, h.end);
      this.i = 0;

      const ev = this.makeEventNode(h.evName);
      if (h.evId && !this.takenIds.has(h.evId)) { ev.id = h.evId; this.takenIds.add(h.evId); }
      this.nodes.push(ev);

      // Pass 1: pre-register every data/ctx local so variable references resolve
      // no matter the order they're written (a data node can be used before its
      // `local` line and still wire up).
      this.preRegisterLocals();

      // Pass 2: build execution flow / control (locals already handled above).
      const res = this.parseBlock();
      if (res.first) this.connectExec(ev, res.first);
    }

    const seen = new Set();
    this.nodes = this.nodes.filter(n => { if (seen.has(n.id)) return false; seen.add(n.id); return true; });
    const seenW = new Set();
    this.wires = this.wires.filter(w => {
      const k = `${w.fromNode}|${w.fromPin}|${w.toNode}|${w.toPin}|${w.isExec ? 1 : 0}`;
      if (seenW.has(k)) return false; seenW.add(k); return true;
    });
    return { name, type: 'Server', nodes: this.nodes, wires: this.wires };
  }

  findHandlers(T) {
    const out = [];
    for (let i = 0; i < T.length; i++) {
      if (T[i].t !== 'id' || T[i].v !== 'function') continue;
      const isOn = T.slice(Math.max(0, i - 7), i).some(t => t.t === 'id' && t.v === 'on');
      if (!isOn) continue;
      // The event name is the nearest string literal in the closing `(` of the head.
      let evName = null;
      for (let q = i - 1; q >= Math.max(0, i - 10) && !evName; q--) {
        if (T[q].t === 'str') { evName = T[q].v; }
      }
      let depth = 1, closed = -1, k = i + 1;
      while (k < T.length) {
        const tk = T[k];
        if (tk.t === 'id' && (tk.v === 'function' || tk.v === 'if' || tk.v === 'for' || tk.v === 'while')) depth++;
        else if (tk.t === 'id' && tk.v === 'end') { depth--; if (depth === 0) { closed = k; break; } }
        k++;
      }
      if (closed < 0) continue;
      let evId = null;
      for (let j = i; j <= Math.min(closed, i + 9); j++) {
        if (T[j].t === 'ln') { const m = /@([A-Za-z0-9_:.\-]+)/.exec(T[j].v); if (m) { evId = m[1]; break; } }
      }
      out.push({ bodyStart: i + 1, end: closed, evId, evName });
      i = closed;
    }
    return out;
  }

  tokenize(src) {
    const toks = [];
    let i = 0; const n = src.length;
    const isId = c => /[A-Za-z0-9_]/.test(c);
    while (i < n) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '-' && src[i + 1] === '-') {
        let s = ''; i += 2;
        while (i < n && src[i] !== '\n') { s += src[i]; i++; }
        toks.push({ t: 'ln', v: s });
        continue;
      }
      if (c === '"' || c === "'") {
        const q = c; let s = ''; i++;
        while (i < n && src[i] !== q) { if (src[i] === '\\' && i + 1 < n) { s += src[i + 1]; i += 2; } else { s += src[i]; i++; } }
        i++; toks.push({ t: 'str', v: s }); continue;
      }
      if (c === '-' || c === '+' || /[0-9]/.test(c)) {
        let s = c; i++;
        while (i < n && (/[0-9]/.test(src[i]) || src[i] === '.')) { s += src[i]; i++; }
        toks.push({ t: 'num', v: s }); continue;
      }
      if (isId(c)) {
        let s = ''; while (i < n && isId(src[i])) { s += src[i]; i++; }
        toks.push({ t: 'id', v: s }); continue;
      }
      if (c === '=' && src[i + 1] === '=') { toks.push({ t: '==', v: '==' }); i += 2; continue; }
      if ('(){[]};,:.' .includes(c)) { toks.push({ t: c }); i++; continue; }
      i++;
    }
    return toks;
  }

  nextNodeId() { return `node_parsed_${this._n++}`; }
  nextWireId() { return `wire_${this._n++}`; }

  makeEventNode(evName) {
    const cleanEv = (evName || '').trim();
    const isNoSig = !cleanEv || cleanEv === 'no_signal' || cleanEv === 'Monitor Signal' || cleanEv === 'monitorSignal';
    let typeId = 'event_custom';
    let pretty = cleanEv ? cleanEv.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim() : 'Event';
    let iv = {};

    if (isNoSig) {
      typeId = 'event_monitor_signal';
      pretty = 'Monitor Signal';
      iv['Signal Name'] = '';
    } else if (signalsManager && signalsManager.getSignal && signalsManager.getSignal(cleanEv)) {
      typeId = 'event_monitor_signal';
      pretty = 'Monitor Signal';
      iv['Signal Name'] = cleanEv;
    } else {
      // Check if it's a known built-in event
      const bp = getNodeBlueprint(`event_${cleanEv}`) || getNodeBlueprint(cleanEv);
      if (bp && bp.category === 'event') {
        typeId = bp.id;
        pretty = bp.name;
      } else {
        // Any custom event in Lua is treated as a Signal monitor
        typeId = 'event_monitor_signal';
        pretty = 'Monitor Signal';
        iv['Signal Name'] = cleanEv;
        if (signalsManager && signalsManager.registerSignal) {
          signalsManager.registerSignal(cleanEv, []);
        }
      }
    }
    const node = this.makeNode(typeId, pretty, 'event');
    node.inputValues = iv;
    if (typeId === 'event_monitor_signal') {
      node.signalName = isNoSig ? '' : cleanEv;
      const sigDef = (signalsManager && signalsManager.getSignal) ? signalsManager.getSignal(cleanEv) : null;
      if (sigDef && Array.isArray(sigDef.params) && sigDef.params.length > 0) {
        node.customOutputs = sigDef.params.map(p => ({ name: p.name, type: p.type || 'int' }));
      }
    }
    return node;
  }

  makeNode(typeId, name, cat) {
    const bp = getNodeBlueprint(typeId) || getNodeBlueprint(name) || null;
    const inputValues = {};
    if (bp && Array.isArray(bp.inputs)) {
      bp.inputs.forEach(inp => {
        inputValues[inp.name] = inp.defaultVal !== undefined ? inp.defaultVal : (inp.options ? inp.options[0] : '');
      });
    }
    return {
      id: this.nextNodeId(),
      blueprintId: (bp && bp.id) || typeId || name,
      name: (bp && bp.name) || name,
      category: (bp && bp.category) || cat,
      x: 0, y: 0,
      inputValues
    };
  }

  connectExec(from, to) {
    if (!from || !to) return;
    this.wires.push({ id: this.nextWireId(), fromNode: from.id, fromPin: 'execOut', toNode: to.id, toPin: 'execIn', isExec: true });
  }
  connectPin(from, fromPin, to) {
    if (!from || !to) return;
    this.wires.push({ id: this.nextWireId(), fromNode: from.id, fromPin, toNode: to.id, toPin: 'execIn', isExec: true });
  }
  dataOutputPin(node) {
    const bp = getNodeBlueprint(node.blueprintId) || getNodeBlueprint(node.name);
    if (bp && Array.isArray(bp.outputs) && bp.outputs.length) {
      const preferred = bp.outputs.find(o => o.name === 'Result' || o.name === 'Value');
      if (preferred) return preferred.name;
      return bp.outputs[0].name;
    }
    return 'Value';
  }
  placeData(n) { n.x = 80; n.y = this.y; this.y += 180; }
  placeFlow(n) { n.x = this.x; n.y = this.y; this.x += 360; }

  readNodeId() {
    const tk = this.T[this.i];
    if (tk && tk.t === 'ln') {
      const m = /@([A-Za-z0-9_:.\-]+)/.exec(tk.v);
      this.i++;
      return m ? m[1] : null;
    }
    return null;
  }

  readUtilsCall(Tarr, i) {
    // Accepts `f.<fn>`, `n.<fn>` or `utils.<fn>`.
    return this.readFn(Tarr || this.T, i != null ? i : this.i);
  }

  readFn(T2, i) {
    const toks = T2; let k = i;
    if (toks[k]?.t === 'id' && PREFIX.has(toks[k].v)) k++;
    let fn = null;
    if (toks[k]?.t === '.') { k++; if (toks[k]?.t === 'id') { fn = toks[k].v; k++; } }
    let groups = [];
    let end = k;
    if (toks[k]?.t === '(') {
      const r = this.readGroupsFrom(T2, k);
      groups = r.groups; end = r.end;
    }
    return { fn, groups, end };
  }

  // Read balanced arg groups starting at an index (cursor on '('), returning
  // { groups, end } where end is the index just after the matching ')'.
  readGroupsFrom(T2, idx) {
    const groups = [];
    if (T2[idx]?.t === '(') idx++;
    let depth = 0; let group = []; const n = T2.length;
    while (idx < n) {
      const tk = T2[idx];
      if (tk.t === '(' || tk.t === '{') depth++;
      else if (tk.t === ')' || tk.t === '}') {
        if (depth === 0) { if (group.length) groups.push(group); group = []; idx++; break; }
        depth--;
      }
      if (tk.t === ',' && depth === 0) { groups.push(group); group = []; idx++; continue; }
      group.push(tk); idx++;
    }
    if (group.length) groups.push(group);
    return { groups, end: idx };
  }

  readArgGroups() {
    const r = this.readGroupsFrom(this.T, this.i);
    this.i = r.end;
    return r.groups;
  }

  argToValue(group) {
    if (!group || group.length === 0) return { isLit: true, value: '' };
    group = group.filter(t => t.t !== 'ln');
    if (group.length === 0) return { isLit: true, value: '' };

    while (group.length >= 2 && group[0].t === '(' && group[group.length - 1].t === ')') {
      let d = 0;
      let matched = true;
      for (let k = 0; k < group.length - 1; k++) {
        if (group[k].t === '(') d++;
        else if (group[k].t === ')') d--;
        if (d === 0) { matched = false; break; }
      }
      if (matched) group = group.slice(1, -1);
      else break;
    }
    if (group.length === 0) return { isLit: true, value: '' };

    if (group[0].t === '{') {
      const nums = group.filter(t => t.t === 'num').map(t => Number(t.v) || 0);
      return { isLit: true, value: `(${nums.join(',')})` };
    }
    if (group.length === 1) {
      const t = group[0];
      return this.singleArgToValue(t);
    }
    const t = group[0];
    if (t.t === 'id') {
      const ev = this.varToEvent.get(t.v);
      if (ev) return { isEvent: true, evId: ev.evId, pin: ev.pin };
      const nd = this.varToNode.get(t.v);
      if (nd) return { isVar: true, nodeId: nd };
    }
    return { isLit: true, value: group.map(x => x.v ?? x.t).join(' ') };
  }

  singleArgToValue(t) {
    if (t.t === 'str') return { isLit: true, value: t.v };
    if (t.t === 'num') return { isLit: true, value: t.v };
    if (t.t === 'id') {
      const lv = t.v.toLowerCase();
      if (lv === 'true' || lv === 'false') {
        return { isLit: true, value: lv };
      }
      const ev = this.varToEvent.get(t.v);
      if (ev) return { isEvent: true, evId: ev.evId, pin: ev.pin };
      const nd = this.varToNode.get(t.v);
      if (nd) return { isVar: true, nodeId: nd };
      return { isLit: true, value: t.v };
    }
    return { isLit: true, value: t.v ?? t.t };
  }

  applyValueTo(node, pin, v) {
    if (v.isVar && v.nodeId) {
      const src = this.nodes.find(n => n.id === v.nodeId);
      this.wires.push({
        id: this.nextWireId(), fromNode: v.nodeId,
        fromPin: src ? this.dataOutputPin(src) : 'Value',
        toNode: node.id, toPin: pin, isExec: false
      });
    } else if (v.isEvent && v.evId) {
      this.wires.push({ id: this.nextWireId(), fromNode: v.evId, fromPin: v.pin, toNode: node.id, toPin: pin, isExec: false });
    } else {
      node.inputValues[pin] = this.coerce(node, pin, v.value);
    }
  }

  coerce(node, pin, raw) {
    const s0 = String(raw ?? '').trim().toLowerCase();
    const bp = getNodeBlueprint(node.blueprintId) || getNodeBlueprint(node.name);
    let inp = null;
    if (bp && Array.isArray(bp.inputs)) {
      inp = bp.inputs.find(i => i.name === pin);
    }
    const isBool = (inp && inp.type === 'bool') || (node.pinTypes && node.pinTypes[pin] === 'bool') || s0 === 'true' || s0 === 'false';
    if (isBool) {
      const isTruthy = s0 === '1' || s0 === 'true' || s0 === 'yes' || s0 === 'on';
      if (inp?.options && inp.options.includes('True') && inp.options.includes('False')) {
        return isTruthy ? 'True' : 'False';
      }
      if (inp?.options && inp.options.includes('Yes') && inp.options.includes('No')) {
        return isTruthy ? 'Yes' : 'No';
      }
      return isTruthy ? 'True' : 'False';
    }
    return raw;
  }

  pinForIndex(node, bp, idx) {
    if (bp && Array.isArray(bp.inputs) && idx < bp.inputs.length) return bp.inputs[idx].name;
    return `param_${idx}`;
  }

  applyInputs(node, groups) {
    const bp = getNodeBlueprint(node.blueprintId) || getNodeBlueprint(node.name) || null;
    if (node.blueprintId === 'exec_send_signal' || node.blueprintId === 'event_monitor_signal') {
      // Signals are name + payload params. Never reset them to defaults.
      const nv = this.argToValue(groups[0] || []);
      const sig = nv.isLit ? String(nv.value) : nv.isVar ? (node.inputValues['Signal Name'] || '') : '';
      node.inputValues['Signal Name'] = sig;
      node.signalName = sig;
      // Restore the real param layout from the signal registry.
      const def = (signalsManager && signalsManager.getSignal) ? signalsManager.getSignal(sig) : null;
      const params = (def && Array.isArray(def.params)) ? def.params : [];
      node.customInputs = params.map(p => ({ name: p.name, type: p.type }));
      for (let i = 1; i < groups.length; i++) {
        const param = params[i - 1];
        if (param) this.applyValueTo(node, param.name, this.argToValue(groups[i]));
        else this.applyValueTo(node, `Param ${i}`, this.argToValue(groups[i]));
      }
      return;
    }
    groups.forEach((g, idx) => this.applyValueTo(node, this.pinForIndex(node, bp, idx), this.argToValue(g)));
  }

  // ------------------------------------------------------------------
  parseBlock() {
    let first = null;
    let chainTail = null;
    while (this.i < this.T.length) {
      const tk = this.T[this.i];
      if (tk.t === 'id' && (tk.v === 'end' || tk.v === 'elseif' || tk.v === 'else')) return { first, last: chainTail };
      if (tk.t === 'ln') { this.i++; continue; }
      if (tk.t === ';' || tk.t === ',') { this.i++; continue; }
      if (tk.t === 'id' && tk.v === 'local') { this.skipLocal(); continue; }
      if (tk.t === 'id' && tk.v === 'if') { const b = this.parseIf(); if (b && !first) first = b; continue; }
      if (tk.t === 'id' && (tk.v === 'utils' || tk.v === 'f' || tk.v === 'n')) {
        const n = this.parseStmt();
        if (n) { if (!first) first = n; if (chainTail) this.connectExec(chainTail, n); chainTail = n; }
        continue;
      }
      this.i++;
    }
    return { first, last: chainTail };
  }

  // Pass 1: scan the handler for every `local <name> = <ctx> | f.<fn>(…)`,
  // create each data node and register its variable, THEN apply inputs. Doing
  // it in two loops means a data node can be referenced before its `local`
  // line and still wire up (order-independent).
  preRegisterLocals() {
    const defs = [];   // data locals (create a node)
    let i = 0; const T = this.T; const n = T.length;
    while (i < n) {
      if (!(T[i].t === 'id' && T[i].v === 'local')) { i++; continue; }
      if (!(T[i + 1] && T[i + 1].t === 'id')) { i += 2; continue; }
      const name = T[i + 1].v;
      let j = i + 2;
      if (T[j]?.t === '=') j++;
      const nxt = T[j];
      if (nxt?.t === 'id' && (nxt.v === 'ctx' || nxt.v === 'payload' || nxt.v === 'event')) {
        // event data readout — resolve its pin from the trailing stamp
        let pin = 'Value';
        if (T[j + 1]?.t === 'ln') {
          const m = T[j + 1].v.match(/@\S+\s*([^\r\n]+)/);
          if (m) pin = m[1].replace(/[()]/g, '').trim();
        }
        const curEvId = this.currentEventId();
        this.varToEvent.set(name, { evId: curEvId, pin: pin || 'Value' });

        const evNode = this.nodes.find(n => n.id === curEvId);
        if (evNode && (evNode.blueprintId === 'event_monitor_signal' || evNode.name === 'Monitor Signal')) {
          const builtin = ['Event Source Entity', 'Event Source GUID', 'Signal Source Entity'];
          if (pin && !builtin.includes(pin)) {
            if (!Array.isArray(evNode.customOutputs)) evNode.customOutputs = [];
            if (!evNode.customOutputs.some(o => o.name === pin)) {
              evNode.customOutputs.push({ name: pin, type: 'int' });
            }
            if (evNode.signalName && signalsManager && signalsManager.registerSignal) {
              signalsManager.registerSignal(evNode.signalName, [{ name: pin, type: 'int' }]);
            }
          }
        }
        i = j + 2;
        continue;
      }
      if (nxt?.t === 'id' && (nxt.v === 'utils' || nxt.v === 'f' || nxt.v === 'n')) {
        const r = this.readFn(T, j);
        let ann = null;
        let end = r.end;
        if (T[r.end]?.t === 'ln') { const m = /@([A-Za-z0-9_:.\-]+)/.exec(T[r.end].v); if (m) ann = m[1]; end = r.end + 1; }
        defs.push({ name, fn: r.fn, groups: r.groups, ann, end });
        i = end;
        continue;
      }
      i = j + 1;
    }

    // Two sub-phases: register all ids, then applyInputs (forward refs).
    for (const d of defs) {
      if (!d.fn) continue;
      const ent = resolveNode(d.fn) || { name: d.fn, id: 'query_' + d.fn, cat: 'operation' };
      const node = this.makeNode(ent.id, ent.name, ent.cat);
      node.varName = d.name;
      if (d.ann && !this.takenIds.has(d.ann)) { node.id = d.ann; this.takenIds.add(d.ann); }
      this.placeData(node);
      this.nodes.push(node);
      this.varToNode.set(d.name, node.id);
      d.node = node;
    }
    for (const d of defs) {
      if (d.node) this.applyInputs(d.node, d.groups);
    }
  }

  // Pass 2 helper: a `local …` has already been built by preRegisterLocals, so
  // just skip past it on the main walk.
  skipLocal() {
    const T = this.T;
    let i = this.i + 1; // 'local'
    if (T[i]?.t === 'id') i++;
    if (T[i]?.t === '=') i++;
    const nxt = T[i];
    if (nxt?.t === 'id' && (nxt.v === 'ctx' || nxt.v === 'payload' || nxt.v === 'event')) {
      if (T[i + 1]?.t === 'ln') i += 2; else i += 1;
      this.i = i; return;
    }
    if (nxt?.t === 'id' && (nxt.v === 'utils' || nxt.v === 'f' || nxt.v === 'n')) {
      const r = this.readFn(T, i);
      let end = r.end;
      if (T[end]?.t === 'ln') end++;
      this.i = end; return;
    }
    this.i = i + 1;
  }

  currentEventId() {
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      if ((this.nodes[i].category || '') === 'event') return this.nodes[i].id;
    }
    return null;
  }

  eventId() {
    return this.currentEventId();
  }

  // f.<fn>(...)  -> action node
  parseStmt() {
    const r = this.readFn(this.T, this.i);
    this.i = r.end;
    const ann = this.readNodeId();
    if (!r.fn) return null;
    const ent = resolveNode(r.fn) || { name: r.fn, id: 'exec_' + r.fn, cat: 'execution' };
    const node = this.makeNode(ent.id, ent.name, ent.cat);
    if (ann && !this.takenIds.has(ann)) { node.id = ann; this.takenIds.add(ann); }
    this.applyInputs(node, r.groups);
    this.placeFlow(node);
    this.nodes.push(node);
    return node;
  }

  parseIf() {
    this.i++; // 'if'

    let depth = 0;
    const cond = [];
    while (this.i < this.T.length) {
      const t = this.T[this.i];
      if (t.t === '(') depth++;
      else if (t.t === ')') depth--;
      if (t.t === 'id' && t.v === 'then' && depth === 0) { this.i++; break; }
      cond.push(t); this.i++;
    }

    const eq = cond.findIndex(t => t.t === '==');
    if (eq >= 0) return this.parseMultiBranch(cond, eq);

    const node = this.makeNode('flow_double_branch', 'Double Branch', 'flow');
    const id = this.readNodeId();
    if (id && !this.takenIds.has(id)) { node.id = id; this.takenIds.add(id); }
    this.applyControl(node, cond, 'Condition');
    this.placeFlow(node);
    this.nodes.push(node);

    const yes = this.parseBlock();
    if (this.T[this.i]?.t === 'ln') this.i++;
    if (yes.first) this.connectPin(node, 'Yes', yes.first);

    let noFirst = null;
    if (this.T[this.i]?.t === 'id' && this.T[this.i].v === 'else') {
      this.i++;
      const no = this.parseBody();
      noFirst = no.first;
    }
    if (this.T[this.i]?.t === 'id' && this.T[this.i].v === 'end') this.i++;
    if (noFirst) this.connectPin(node, 'No', noFirst);
    return node;
  }

  parseMultiBranch(cond, eq) {
    const ctrl = cond.slice(0, eq);
    const lt = cond[eq + 1];
    const label = (lt && (lt.t === 'str' || lt.t === 'num')) ? String(lt.v) : 'Branch 1';

    const node = this.makeNode('flow_multiple_branches', 'Multiple Branches', 'flow');
    // stamp id right after this first `then`
    const id = this.readNodeId();
    if (id && !this.takenIds.has(id)) { node.id = id; this.takenIds.add(id); }
    this.applyControl(node, ctrl, 'Control Expression');
    this.placeFlow(node);
    this.nodes.push(node);

    const first = this.parseBody();
    if (first.first) this.connectPin(node, label, first.first);

    while ((this.T[this.i]?.t === 'id') && (this.T[this.i].v === 'elseif' || this.T[this.i].v === 'else')) {
      if (this.T[this.i].v === 'elseif') {
        this.i++;
        const c2 = [];
        let d2 = 0;
        while (this.i < this.T.length) {
          const t = this.T[this.i];
          if (t.t === '(') d2++; else if (t.t === ')') d2--;
          if (t.t === 'id' && t.v === 'then' && d2 === 0) { this.i++; break; }
          c2.push(t); this.i++;
        }
        const e2 = c2.findIndex(t => t.t === '==');
        const lt2 = e2 >= 0 ? c2[e2 + 1] : null;
        const lbl = (lt2 && (lt2.t === 'str' || lt2.t === 'num')) ? String(lt2.v) : 'Label';
        if (d2 >= 0) { const b = this.parseBody(); if (b.first) this.connectPin(node, lbl, b.first); }
      } else {
        this.i++;
        const b = this.parseBody();
        if (b.first) this.connectPin(node, 'Default', b.first);
      }
    }
    if (this.T[this.i]?.t === 'id' && this.T[this.i].v === 'end') this.i++;
    return node;
  }

  parseBody() {
    const res = this.parseBlock();
    if (this.T[this.i]?.t === 'ln') this.i++;
    return res;
  }

  applyControl(node, ctrlTokens, pin) {
    if (!ctrlTokens || ctrlTokens.length === 0) return;
    this.applyValueTo(node, pin, this.argToValue(ctrlTokens));
  }
}