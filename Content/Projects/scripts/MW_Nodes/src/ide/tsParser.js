/**
 * genshin-ts TypeScript Parser
 * Parses the structured code emitted by TsGenerator back into a Miliastra
 * Wonderland node graph. Understands the exact schema the generator writes:
 *   - `g.server({ name: 'X' }).on('<event>', (<param>) => { ... })`
 *   - data sources:  `const x_1 = gsts.f.<fn>(...);`
 *   - calls:         `gsts.f.<fn>(...);`
 *   - control:       nested `if (...) { } else { }` and
 *                    `switch (...) { case 'Branch 0': { ...; break; } default: { ...; break; } }`
 */

import { getNodeBlueprint, NODE_REGISTRY } from '../nodesData.js';
import { signalsManager } from '../signalsManager.js';

function toCamelCase(str) {
  if (!str) return '';
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^[A-Z]/, chr => chr.toLowerCase());
}

// Reverse index from emitted camelCase fn -> real node blueprint, so any node
// the generator serializes (division, hPLoss, setNodeGraphVariable, ...) comes
// back as its true node instead of a throwaway `parsed_*` stub.
let REVERSE_INDEX = null;
function resolveNode(fn) {
  if (FN_NODE[fn]) return FN_NODE[fn];
  if (!REVERSE_INDEX) {
    REVERSE_INDEX = new Map();
    (NODE_REGISTRY || []).forEach(bp => {
      const key = toCamelCase(bp.name);
      if (key && !REVERSE_INDEX.has(key)) {
        REVERSE_INDEX.set(key, { name: bp.name, id: bp.id, cat: bp.category });
      }
    });
  }
  return REVERSE_INDEX.get(fn) || null;
}

// fn -> { name (pretty lookup), id (fallback), cat }
const FN_NODE = {
  getCustomVariable: { name: 'Get Custom Variable', id: 'query_get_custom_var', cat: 'query' },
  queryEntityByGuid: { name: 'Query Entity by GUID', id: 'query_query_entity_by_guid', cat: 'query' },
  getSelfEntity: { name: 'Get Self Entity', id: 'query_get_self_entity', cat: 'query' },
  equal: { name: 'Equal', id: 'op_equal', cat: 'operation' },
  sendSignal: { name: 'Send Signal', id: 'exec_send_signal', cat: 'execution' },
  setCustomVariable: { name: 'Set Custom Variable', id: 'exec_set_custom_var', cat: 'execution' },
  playTimedEffects: { name: 'Play Timed Effects', id: 'exec_play_timed_effects', cat: 'execution' },
  activateBasicMotionDevice: { name: 'Activate Basic Motion Device', id: 'exec_activate_basic_motion_device', cat: 'execution' },
  activateDisableTab: { name: 'Activate/Disable Tab', id: 'exec_activate_disable_tab', cat: 'execution' },
  setPresetStatus: { name: 'Set Preset Status', id: 'exec_set_preset_status', cat: 'execution' },
  triggerEvent: { name: 'Trigger Event', id: 'exec_trigger_event', cat: 'execution' },
  clearSpecialEffectsBasedOnSpecialEffectAssets: { name: 'Clear Special Effects Based on Special Effect Assets', id: 'exec_clear_special_effects_based_on_special_effect_assets', cat: 'execution' },
  mountLoopingSpecialEffect: { name: 'Mount Looping Special Effect', id: 'exec_mount_looping_special_effect', cat: 'execution' },
  listSorting: { name: 'List Sorting', id: 'exec_list_sorting', cat: 'execution' }
};

// event name -> { name (pretty), id }
const EVENT_NODE = {
  whenTabIsSelected: { name: 'When Tab Is Selected', id: 'event_when_tab_selected' },
  monitorSignal: { name: 'Monitor Signal', id: 'event_monitor_signal' },
  whenCustomVariableChanges: { name: 'When Custom Variable Changes', id: 'event_when_custom_var_changes' },
  whenEntityIsCreated: { name: 'When Entity Is Created', id: 'event_when_entity_created' },
  whenCharacterDies: { name: 'When Character Dies', id: 'event_character_dies' }
};

export class TsParser {
  /**
   * @param {string} code - generated genshin-ts source
   * @returns {{name:string,type:string,nodes:any[],wires:any[]}}
   */
  static parse(code) {
    return new _TsParser(code).run();
  }
}

class _TsParser {
  constructor(code) {
    this.code = code || '';
    this.nodes = [];
    this.wires = [];
    this.nodeCounter = 1;
    this.wireCounter = 1;
    this.varToNode = new Map();
    this.LX = 420;
    this.LY = 260;
    this.dataCol = 0;
    // id → already created node / uniqueness guard (enables pasting code as copies)
    this.takenIds = new Set();
    this.idNode = new Map();
  }

  run() {
    let name = 'Open_Garage';
    const nMatch = this.code.match(/g\.server\(\s*\{\s*name:\s*['"]([^'"]+)['"]/);
    if (nMatch) name = nMatch[1];

    const eventRe = /\.on\(\s*'([^']+)'\s*,\s*\(\s*(\w*)\s*\)\s*=>\s*\{/g;
    let m;
    while ((m = eventRe.exec(this.code)) !== null) {
      const eventName = m[1];
      const openIdx = this.code.indexOf('{', m.index);
      if (openIdx < 0) continue;
      const closeIdx = this.matchBrace(this.code, openIdx);
      if (closeIdx < 0) continue;
      const bodySrc = this.code.slice(openIdx + 1, closeIdx);

      const evNode = this.makeEventNode(eventName);
      evNode.x = 60;
      evNode.y = 260;
      const hdrAnn = bodySrc.match(/^\s*\/\/\s*#([^\s]+)/);
      if (hdrAnn && !this.takenIds.has(hdrAnn[1])) { evNode.id = hdrAnn[1]; this.takenIds.add(hdrAnn[1]); }
      this.nodes.push(evNode);

      this.varToNode = new Map();
      // Event data-output consts: `const x = payload; // Output Name`
      const evConstRe = /const\s+(\w+)\s*=\s*(event|payload)\s*;\s*\/\/\s*([^\n]+)/g;
      let ec;
      while ((ec = evConstRe.exec(bodySrc)) !== null) {
        this.varToNode.set(ec[1], { node: evNode, pin: ec[3].trim() });
      }
      this.T = this.tokenize(bodySrc);
      this.i = 0;
      const block = this.parseBlock();
      if (block.first) this.connectExec(evNode, block.first);
    }

    // Drop duplicate wire edges. Node-level id-dedup lives in the reconcile step
    // (so pasted code can create copies), not here.
    const seenW = new Set();
    this.wires = this.wires.filter(w => {
      const k = `${w.fromNode}|${w.fromPin}|${w.toNode}|${w.toPin}|${w.isExec}`;
      if (seenW.has(k)) return false;
      seenW.add(k);
      return true;
    });

    return { name, type: 'Server', nodes: this.nodes, wires: this.wires };
  }

  // ---------- utilities ----------

  matchBrace(src, open) {
    let depth = 0;
    let inStr = null;
    for (let i = open; i < src.length; i++) {
      const c = src[i];
      if (inStr) {
        if (c === '\\') i++;
        else if (c === inStr) inStr = null;
        continue;
      }
      if (c === '"' || c === "'") { inStr = c; continue; }
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return i; }
    }
    return -1;
  }

  tokenize(src) {
    const toks = [];
    let i = 0;
    const n = src.length;
    const isWs = c => /\s/.test(c);
    const isId = c => /[A-Za-z0-9_$]/.test(c);
    while (i < n) {
      const c = src[i];
      if (isWs(c)) { i++; continue; }
      if (c === '/' && src[i + 1] === '/') { let s = ''; i += 2; while (i < n && src[i] !== '\n') { s += src[i]; i++; } toks.push({ t: 'lncomment', v: s }); continue; }
      if (c === '/' && src[i + 1] === '*') {
        i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
        i += 2;
        continue;
      }
      if (c === '`') { i++; while (i < n && src[i] !== '`') i++; i++; continue; }
      if (c === '"' || c === "'") {
        const q = c; let s = ''; i++;
        while (i < n && src[i] !== q) {
          if (src[i] === '\\' && i + 1 < n) { s += src[i + 1]; i += 2; }
          else { s += src[i]; i++; }
        }
        i++;
        toks.push({ t: 'str', v: s });
        continue;
      }
      if (c === '-' || c === '+' || /[0-9]/.test(c)) {
        let s = c; i++;
        while (i < n && (/[0-9]/.test(src[i]) || src[i] === '.')) { s += src[i]; i++; }
        toks.push({ t: 'num', v: s });
        continue;
      }
      if (isId(c)) {
        let s = ''; while (i < n && isId(src[i])) { s += src[i]; i++; }
        toks.push({ t: 'id', v: s });
        continue;
      }
      if ('(){[]};,:.' .includes(c)) { toks.push({ t: c }); i++; continue; }
      i++;
    }
    return toks;
  }

  // ---------- node factories ----------

  nextNodeId() { return `node_parsed_${this.nodeCounter++}`; }
  nextWireId() { return `wire_${this.wireCounter++}`; }

  // Reads a trailing `// #<id>` annotation already positioned at the cursor.
  readTrailingNodeId() {
    const tk = this.T[this.i];
    if (tk && tk.t === 'lncomment') {
      this.i++;
      const m = tk.v.match(/[@#]([A-Za-z0-9_:.\-]+)/);
      return m ? m[1] : null;
    }
    return null;
  }

  makeNode(id, name, cat) {
    const bp = getNodeBlueprint(id) || getNodeBlueprint(name) || null;
    const inputValues = {};
    if (bp && Array.isArray(bp.inputs)) {
      bp.inputs.forEach(inp => {
        inputValues[inp.name] = inp.defaultVal !== undefined ? inp.defaultVal : (inp.options ? inp.options[0] : '');
      });
    }
    return {
      id: this.nextNodeId(),
      blueprintId: (bp && bp.id) || id || name,
      name: (bp && bp.name) || name,
      category: (bp && bp.category) || cat,
      x: 0,
      y: 0,
      inputValues
    };
  }

  makeEventNode(eventName) {
    const ent = EVENT_NODE[eventName] || {
      name: eventName.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim(),
      id: 'event_' + eventName
    };
    const node = this.makeNode(ent.id, ent.name, 'event');
    node.inputValues = {};
    return node;
  }

  placeData(node) { node.x = 80 + this.dataCol * 340; node.y = 40; this.dataCol++; }
  placeFlow(node) { node.x = this.LX; node.y = this.LY; this.LX += 360; }

  // ---------- wiring helpers ----------

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
    if (bp && Array.isArray(bp.outputs) && bp.outputs.length) return bp.outputs[0].name;
    return 'Value';
  }

  // ---------- call / args ----------

  // cursor at 'gsts'; reads `gsts . f . <fn> ( args )` -> { fn, groups }
  readGstsCall() {
    const toks = this.T;
    let i = this.i;
    if (toks[i]?.t === 'id' && toks[i].v === 'gsts') i++;
    if (toks[i]?.t === '.') i++;
    if (toks[i]?.t === 'id' && toks[i].v === 'f') i++;
    if (toks[i]?.t === '.') i++;
    if (toks[i]?.t !== 'id') return { fn: null, groups: [] };
    const fn = toks[i].v;
    this.i = i + 1;
    const groups = this.readArgGroups();
    return { fn, groups };
  }

  // cursor at '('; reads balanced arg groups split by top-level commas, consumes ')'
  readArgGroups() {
    const toks = this.T;
    const groups = [];
    if (toks[this.i]?.t === '(') this.i++;
    let depth = 0;
    let group = [];
    while (this.i < toks.length) {
      const tk = toks[this.i];
      if (tk.t === '(' || tk.t === '{') depth++;
      else if (tk.t === ')' || tk.t === '}') {
        if (depth === 0) { if (group.length) groups.push(group); group = []; this.i++; break; }
        depth--;
      }
      if (tk.t === ',' && depth === 0) { groups.push(group); group = []; this.i++; continue; }
      group.push(tk);
      this.i++;
    }
    if (group.length) groups.push(group);
    return groups;
  }

  // Convert a single arg token-group into { isVar, node } or { isLit, value }.
  argToValue(group) {
    if (!group || group.length === 0) return { isLit: true, value: '' };
    // vector/object literal: { x: A, y: B, z: C } -> "(A,B,C)"
    if (group[0].t === '{' || group[0].t === '(') {
      const nums = group
        .filter(t => t.t === 'num' || /^-?[0-9]/.test(t.v || ''))
        .map(t => t.v);
      return { isLit: true, value: `(${nums.join(',')})` };
    }
    if (group.length === 1) {
      const t = group[0];
      if (t.t === 'str') return { isLit: true, value: t.v };
      if (t.t === 'num') return { isLit: true, value: t.v };
      if (t.t === 'id') {
        const entry = this.varToNode.get(t.v);
        if (entry) {
          if (entry.node) return { isVar: true, node: entry.node, fromPin: entry.pin || null };
          return { isVar: true, node: entry, fromPin: null };
        }
        return { isLit: true, value: t.v };
      }
    }
    // composite fallback
    const t = group[0];
    if (t.t === 'str') return { isLit: true, value: t.v };
    if (t.t === 'num') return { isLit: true, value: t.v };
    if (t.t === 'id') {
      const entry = this.varToNode.get(t.v);
      if (entry) {
        if (entry.node) return { isVar: true, node: entry.node, fromPin: entry.pin || null };
        return { isVar: true, node: entry, fromPin: null };
      }
    }
    return { isLit: true, value: t.v };
  }

  applyInputs(node, groups) {
    const bp = getNodeBlueprint(node.blueprintId) || getNodeBlueprint(node.name) || null;
    const isSignal = node.blueprintId === 'exec_send_signal' || node.blueprintId === 'event_monitor_signal';

    // Signal nodes: arg 0 is the signal name, remaining args are payload params.
    if (isSignal) {
      const nameV = this.argToValue(groups[0] || []);
      const sigName = nameV.isLit ? String(nameV.value) : '';
      node.inputValues['Signal Name'] = sigName;
      node.signalName = sigName;

      // Restore the payload params from the registered signal definition.
      const signalDef = signalsManager.getSignal(sigName);
      const params = (signalDef && signalDef.params) || [];
      node.customInputs = params.map(p => ({ name: p.name, type: p.type }));

      for (let i = 1; i < groups.length; i++) {
        const param = params[i - 1];
        if (!param) break;
        const v = this.argToValue(groups[i]);
        if (v.isVar && v.node) {
          this.wires.push({
            id: this.nextWireId(),
            fromNode: v.node.id,
            fromPin: v.fromPin || this.dataOutputPin(v.node),
            toNode: node.id,
            toPin: param.name,
            isExec: false
          });
        } else {
          node.inputValues[param.name] = param.type === 'bool'
            ? ((String(v.value).trim().toLowerCase() === 'true' || String(v.value) === '1') ? '1' : '0')
            : v.value;
        }
      }
      return;
    }

    groups.forEach((group, idx) => {
      const pin = this.pinNameForIndex(node, bp, idx);
      const v = this.argToValue(group);
      if (v.isVar && v.node) {
        this.wires.push({
          id: this.nextWireId(),
          fromNode: v.node.id,
          fromPin: v.fromPin || this.dataOutputPin(v.node),
          toNode: node.id,
          toPin: pin,
          isExec: false
        });
      } else {
        node.inputValues[pin] = this.coerceForPin(node, bp, pin, v.value);
      }
    });
  }

  // Normalize a read-back literal to the pin's type (bools → '1'/'0') so true/false
  // passed as strings in code still flip the graph boolean correctly.
  coerceForPin(node, bp, pin, raw) {
    let type = null;
    if (bp && Array.isArray(bp.inputs)) {
      const inp = bp.inputs.find(i => i.name === pin);
      if (inp && inp.type) type = inp.type;
    }
    if (type === 'bool') {
      const s = String(raw).trim().toLowerCase();
      return (s === '1' || s === 'true' || s === 'yes' || s === 'on') ? '1' : '0';
    }
    return raw;
  }

  // Resolve an argument index to a real pin name: blueprint inputs first, then
  // dynamic inputs, falling back to a positional `param_<idx>` for hand-written
  // excess args (these are ignored by the reconcile merge so they don't inflate
  // the graph node).
  pinNameForIndex(node, bp, idx) {
    if (bp && Array.isArray(bp.inputs) && idx < bp.inputs.length) return bp.inputs[idx].name;
    const offset = (bp && Array.isArray(bp.inputs)) ? bp.inputs.length : 0;
    if (Array.isArray(node.dynamicInputs) && idx - offset < node.dynamicInputs.length) {
      return String(node.dynamicInputs[idx - offset]);
    }
    return `param_${idx}`;
  }

  applyControlexpr(node, groups, pin) {
    if (!groups || groups.length === 0) return;
    const v = this.argToValue(groups[0]);
    if (v.isVar && v.node) {
      this.wires.push({
        id: this.nextWireId(),
        fromNode: v.node.id,
        fromPin: v.fromPin || this.dataOutputPin(v.node),
        toNode: node.id,
        toPin: pin,
        isExec: false
      });
    } else {
      node.inputValues[pin] = v.value;
    }
  }

  // ---------- statements ----------

  parseBlock() {
    let first = null;
    let chainTail = null;

    while (this.i < this.T.length) {
      const tk = this.T[this.i];
      if (tk.t === '}') break;
      if (tk.t === ';') { this.i++; continue; }
      if (tk.t === 'id' && tk.v === 'const') { this.parseDataConst(); continue; }
      if (tk.t === 'id' && tk.v === 'if') { const b = this.parseIf(); if (b) { if (!first) first = b; chainTail = null; } continue; }
      if (tk.t === 'id' && tk.v === 'switch') { const s = this.parseSwitch(); if (s) { if (!first) first = s; chainTail = null; } continue; }
      if (tk.t === 'id' && tk.v === 'gsts') {
        const { fn, groups } = this.readGstsCall();
        if (this.T[this.i]?.t === ';') this.i++;
        const ann = this.readTrailingNodeId();
        if (fn) {
          const ent = resolveNode(fn) || { name: fn, id: 'exec_' + fn, cat: 'execution' };
          const node = this.makeNode(ent.id, ent.name, ent.cat);
          if (ann && !this.takenIds.has(ann)) { node.id = ann; this.takenIds.add(ann); }
          this.applyInputs(node, groups);
          this.placeFlow(node);
          this.nodes.push(node);
          if (!first) first = node;
          if (chainTail) this.connectExec(chainTail, node);
          chainTail = node;
        }
        continue;
      }
      this.i++;
    }
    return { first, last: chainTail };
  }

  parseDataConst() {
    const toks = this.T;
    if (toks[this.i]?.t === 'id' && toks[this.i].v === 'const') this.i++;
    if (toks[this.i]?.t !== 'id') return null;
    const name = toks[this.i].v;
    this.i++;
    if (toks[this.i]?.t === '=') this.i++;
    // Event data-output const: `const x = event|payload; // Pin` (already handled in run()).
    const ptk = this.T[this.i];
    if (ptk?.t === 'id' && (ptk.v === 'event' || ptk.v === 'payload')) {
      this.i++;
      if (this.T[this.i]?.t === ';') this.i++;
      return null;
    }
    const { fn, groups } = this.readGstsCall();
    if (toks[this.i]?.t === ';') this.i++;
    const ann = this.readTrailingNodeId();
    if (!fn) return null;

    // Shared data node emitted in multiple handlers → reuse the first occurrence
    // so the graph keeps ONE node wired to every handler that uses it.
    if (ann && this.idNode.has(ann)) {
      const prev = this.idNode.get(ann);
      this.varToNode.set(name, prev);
      return prev;
    }

    const ent = resolveNode(fn) || { name: fn, id: 'parsed_' + fn, cat: 'operation' };
    const node = this.makeNode(ent.id, ent.name, ent.cat);
    if (ann) { node.id = ann; this.takenIds.add(ann); this.idNode.set(ann, node); }
    this.applyInputs(node, groups);
    this.placeData(node);
    this.nodes.push(node);
    this.varToNode.set(name, node);
    return node;
  }

  // cursor at 'if'; parses `if (cond) { yes } else { no }` and builds a Double Branch.
  parseIf() {
    const toks = this.T;
    this.i++;
    if (toks[this.i]?.t !== '(') return null;
    const cStart = this.i + 1;
    let depth = 1; let ci = cStart;
    while (ci < toks.length && depth > 0) {
      if (toks[ci].t === '(') depth++;
      else if (toks[ci].t === ')') depth--;
      if (depth === 0) break;
      ci++;
    }
    const cond = toks.slice(cStart, ci);
    this.i = ci + 1;
    if (toks[this.i]?.t === '{') this.i++;
    const branchAnn = this.readTrailingNodeId();

    const branch = this.makeNode('flow_double_branch', 'Double Branch', 'flow');
    if (branchAnn && !this.takenIds.has(branchAnn)) { branch.id = branchAnn; this.takenIds.add(branchAnn); }
    this.placeFlow(branch);
    this.nodes.push(branch);
    this.applyControlexpr(branch, [cond], 'Condition');

    const saveX = this.LX, saveY = this.LY;
    this.LX = saveX + 60; this.LY = saveY + 240;
    const yes = this.parseBlock();
    if (this.T[this.i]?.t === '}') this.i++;
    if (this.T[this.i]?.t === 'id' && this.T[this.i].v === 'else') this.i++;
    if (this.T[this.i]?.t === '{') this.i++;
    this.LX = saveX + 60; this.LY = saveY + 480;
    const no = this.parseBlock();
    if (this.T[this.i]?.t === '}') this.i++;
    this.LX = saveX; this.LY = saveY;

    if (yes.first) this.connectPin(branch, 'Yes', yes.first);
    if (no.first) this.connectPin(branch, 'No', no.first);
    return branch;
  }

  // cursor at 'switch'; parses `switch (expr) { case '..': {..} default: {..} }`.
  parseSwitch() {
    const toks = this.T;
    this.i++;
    if (toks[this.i]?.t !== '(') return null;
    const cStart = this.i + 1;
    let depth = 1; let ci = cStart;
    while (ci < toks.length && depth > 0) {
      if (toks[ci].t === '(') depth++;
      else if (toks[ci].t === ')') depth--;
      if (depth === 0) break;
      ci++;
    }
    const cond = toks.slice(cStart, ci);
    this.i = ci + 1;
    if (toks[this.i]?.t === '{') this.i++;
    const swAnn = this.readTrailingNodeId();

    const sw = this.makeNode('flow_multiple_branches', 'Multiple Branches', 'flow');
    if (swAnn && !this.takenIds.has(swAnn)) { sw.id = swAnn; this.takenIds.add(swAnn); }
    this.placeFlow(sw);
    this.nodes.push(sw);
    this.applyControlexpr(sw, [cond], 'Control Expression');

    const saveX = this.LX, saveY = this.LY;
    let row = 1;
    while (this.i < toks.length && toks[this.i]?.t !== '}') {
      const tk = toks[this.i];
      let caseLabel = null;
      if (tk.t === 'id' && tk.v === 'case') {
        this.i++;
        if (toks[this.i]?.t === 'str') { caseLabel = toks[this.i].v; this.i++; }
        if (toks[this.i]?.t === ':') this.i++;
        if (toks[this.i]?.t === '{') this.i++;
      } else if (tk.t === 'id' && tk.v === 'default') {
        caseLabel = 'Default';
        this.i++;
        if (toks[this.i]?.t === ':') this.i++;
        if (toks[this.i]?.t === '{') this.i++;
      } else {
        this.i++;
        continue;
      }
      this.LX = saveX + 60; this.LY = saveY + row * 220;
      const sub = this.parseBlock();
      if (this.T[this.i]?.t === '}') this.i++;
      if (sub.first) this.connectPin(sw, caseLabel, sub.first);
      row++;
    }
    if (toks[this.i]?.t === '}') this.i++;
    this.LX = saveX; this.LY = saveY;
    return sw;
  }
}