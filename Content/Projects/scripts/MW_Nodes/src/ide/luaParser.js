/**
 * luaParser.js — Lua "interactive mirror" → node graph.
 *
 * Reads back Lua code and turns edits into the full node graph model.
 * Seamlessly handles:
 * - Proper Node Graph Variable declarations (e.g. `HP: int = 0`, `Num: int = 6`, `My_var: float = 2.1`)
 *   without requiring `local`, bound directly per-nodegraph.
 * - Custom Variable declarations (`self`, `guid = 1008221`) spawning `Set Custom Variable`
 *   nodes wired to `Get Self Entity` / `Query Entity by GUID` on Check (Lua).
 * - Variable references in expressions turning into `Get Node Graph Variable` nodes.
 * - Comparison statements (`if My_var == 7.2 then` / `if my_var = 7.2 then`) spawning
 *   `Get Node Graph Variable` -> `Equal` (typed as Float/Integer) -> `Double Branch` (Condition).
 * - Full math expressions, random queries, logic, and function calls.
 */

import { getNodeBlueprint, NODE_REGISTRY, applyDataTypeToNode } from '../nodesData.js';
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
      const idKey = toCamel(bp.id);
      if (idKey && !REVERSE.has(idKey)) REVERSE.set(idKey, bp);
    });

    // Explicit function name bindings for custom variables and entity queries
    const baseSetCustomVar = getNodeBlueprint('exec_set_custom_var');
    REVERSE.set('setCustomVar', baseSetCustomVar);
    REVERSE.set('setCustomVariable', baseSetCustomVar);
    REVERSE.set('setCustomVarInt', { ...baseSetCustomVar, dataType: 'int' });
    REVERSE.set('setCustomVarFloat', { ...baseSetCustomVar, dataType: 'float' });
    REVERSE.set('setCustomVarBool', { ...baseSetCustomVar, dataType: 'bool' });
    REVERSE.set('setCustomVarString', { ...baseSetCustomVar, dataType: 'string' });
    REVERSE.set('setCustomVarVector3', { ...baseSetCustomVar, dataType: 'vector3' });
    REVERSE.set('setCustomVarEntity', { ...baseSetCustomVar, dataType: 'entity' });

    const baseGetCustomVar = getNodeBlueprint('query_get_custom_var');
    REVERSE.set('getCustomVar', baseGetCustomVar);
    REVERSE.set('getCustomVariable', baseGetCustomVar);
    REVERSE.set('getCustomVarInt', { ...baseGetCustomVar, dataType: 'int' });
    REVERSE.set('getCustomVarFloat', { ...baseGetCustomVar, dataType: 'float' });
    REVERSE.set('getCustomVarBool', { ...baseGetCustomVar, dataType: 'bool' });
    REVERSE.set('getCustomVarString', { ...baseGetCustomVar, dataType: 'string' });
    REVERSE.set('getCustomVarVector3', { ...baseGetCustomVar, dataType: 'vector3' });
    REVERSE.set('getCustomVarEntity', { ...baseGetCustomVar, dataType: 'entity' });

    REVERSE.set('getSelfEntity', getNodeBlueprint('query_get_self_entity'));
    REVERSE.set('queryEntityByGuid', getNodeBlueprint('query_query_entity_by_guid'));
    REVERSE.set('queryEntitybyGUID', getNodeBlueprint('query_query_entity_by_guid'));
    REVERSE.set('queryEntityByGUID', getNodeBlueprint('query_query_entity_by_guid'));
    REVERSE.set('doubleBranch', getNodeBlueprint('flow_double_branch'));
  }
  return REVERSE.get(fn) || null;
}

function normalizeTypeName(t) {
  if (!t) return 'string';
  const lt = String(t).toLowerCase().trim();
  if (lt === 'int' || lt === 'integer' || lt === 'number') return 'int';
  if (lt === 'float' || lt === 'floating-point' || lt === 'real' || lt === 'double') return 'float';
  if (lt === 'bool' || lt === 'boolean') return 'bool';
  if (lt === 'string' || lt === 'str' || lt === 'text') return 'string';
  if (lt === 'vector3' || lt === 'vector' || lt === '3d vector' || lt === 'vec3') return 'vector3';
  if (lt === 'entity') return 'entity';
  if (lt === 'guid') return 'guid';
  if (lt === 'list') return 'list';
  if (lt === 'dict' || lt === 'dictionary') return 'dict';
  return 'string';
}

function inferTypeFromVal(valStr) {
  const s = String(valStr ?? '').trim();
  if (s === 'true' || s === 'false' || s === 'True' || s === 'False') return 'bool';
  if (/^-?\d+\.\d+$/.test(s)) return 'float';
  if (/^-?\d+$/.test(s)) return 'int';
  if (s.startsWith('{') || s.startsWith('(')) return 'vector3';
  return 'string';
}

export class LuaParser {
  static parse(code) { return new _LuaParser(code).run(); }
}

const PREFIX = new Set(['utils', 'f', 'n', 'math']);

class _LuaParser {
  constructor(code) { this.code = code || ''; }

  run() {
    this.nodes = [];
    this.wires = [];
    this._n = 1;
    this.takenIds = new Set();
    this.graphVariables = [];
    this.customVariables = [];
    this.guidEntities = new Map();
    this.varToGraphVar = new Map();

    const name = this.parseDocHeader(this.code);
    const T = this.tokenize(this.code);

    // Pass 0: Parse all Node Graph Variable and Custom Variable Declarations at top level
    this.parseTopLevelDeclarations(T);

    const handlers = this.findHandlers(T);

    if (handlers.length === 0) {
      // If no explicit `f.on(...)` handler is found, create a default root handler
      handlers.push({ bodyStart: 0, end: T.length, evId: null, evName: 'whenTabSelected' });
    }

    for (const h of handlers) {
      this.varToNode = new Map();
      this.varToEvent = new Map();
      this.varToLocalVar = new Map();
      this.x = 480; this.y = 150;

      this.T = T.slice(h.bodyStart, h.end);
      this.i = 0;

      const ev = this.makeEventNode(h.evName);
      ev.x = 100;
      ev.y = 150;
      if (h.evId && !this.takenIds.has(h.evId)) { ev.id = h.evId; this.takenIds.add(h.evId); }
      this.nodes.push(ev);

      // Pass 1: pre-register all event constants, expressions, math and locals
      this.preRegisterLocals();

      let currentExec = ev;
      let curX = ev.x + 360;

      // Authoritative Custom Variable Initialisation:
      // When `-- Custom Variables` is declared at top of file, it has absolute priority.
      // We synthesize the clean initialization nodes directly from `this.customVariables`.
      if (Array.isArray(this.customVariables) && this.customVariables.length > 0) {
        for (const cv of this.customVariables) {
          const setVarNode = this.makeNode('exec_set_custom_var', 'Set Custom Variable', 'execution');
          setVarNode.x = curX;
          setVarNode.y = 150;
          setVarNode.inputValues['Variable Name'] = cv.name;
          setVarNode.inputValues['Trigger Event'] = 'False';
          setVarNode.dataType = cv.type || 'float';
          const bp = getNodeBlueprint('exec_set_custom_var');
          if (bp) applyDataTypeToNode(setVarNode, bp, cv.type || 'float');
          this.nodes.push(setVarNode);

          // Create target entity query node
          if (cv.entityType === 'self') {
            const selfNode = this.makeNode('query_get_self_entity', 'Get Self Entity', 'query');
            selfNode.x = setVarNode.x - 140;
            selfNode.y = setVarNode.y + 230;
            this.nodes.push(selfNode);
            this.wires.push({
              id: this.nextWireId(),
              fromNode: selfNode.id,
              fromPin: 'Self Entity',
              toNode: setVarNode.id,
              toPin: 'Target Entity',
              isExec: false
            });
          } else if (cv.entityType === 'guid') {
            const guidNode = this.makeNode('query_query_entity_by_guid', 'Query Entity by GUID', 'query');
            guidNode.x = setVarNode.x - 220;
            guidNode.y = setVarNode.y + 230;
            guidNode.inputValues['GUID'] = cv.guid || '0';
            if (cv.guidAlias) guidNode.guidAlias = cv.guidAlias;
            this.nodes.push(guidNode);
            this.wires.push({
              id: this.nextWireId(),
              fromNode: guidNode.id,
              fromPin: 'Entity',
              toNode: setVarNode.id,
              toPin: 'Target Entity',
              isExec: false
            });
          }

          // Variable Value: if 'get' or empty or isGet, wire to Get Custom Variable
          const isGet = cv.defaultValue === 'get' || cv.isGet || !cv.defaultValue;
          if (isGet) {
            setVarNode.inputValues['Variable Value'] = '';
            if (cv.entityType === 'self') {
              const getVarRef = this.createGetCustomVarSelfNode(cv.name);
              if (getVarRef && getVarRef.nodeId) {
                this.wires.push({
                  id: this.nextWireId(),
                  fromNode: getVarRef.nodeId,
                  fromPin: 'Variable Value',
                  toNode: setVarNode.id,
                  toPin: 'Variable Value',
                  isExec: false
                });
              }
            } else if (cv.entityType === 'guid') {
              const getVarRef = this.createGetCustomVarGuidNode(cv.name, cv.guid || '0', cv.guidAlias);
              if (getVarRef && getVarRef.nodeId) {
                this.wires.push({
                  id: this.nextWireId(),
                  fromNode: getVarRef.nodeId,
                  fromPin: 'Variable Value',
                  toNode: setVarNode.id,
                  toPin: 'Variable Value',
                  isExec: false
                });
              }
            }
          } else {
            setVarNode.inputValues['Variable Value'] = cv.defaultValue;
          }

          // Wire in the execution chain at the start
          this.connectExec(currentExec, setVarNode);
          currentExec = setVarNode;
          curX += 360;
        }
      }

      this.x = curX;

      // Pass 2: build execution flow / control for game logic
      const res = this.parseBlock();
      if (res.first) {
        this.connectExec(currentExec, res.first);
      }
    }

    const seen = new Set();
    this.nodes = this.nodes.filter(n => { if (seen.has(n.id)) return false; seen.add(n.id); return true; });
    const seenW = new Set();
    this.wires = this.wires.filter(w => {
      const k = `${w.fromNode}|${w.fromPin}|${w.toNode}|${w.toPin}|${w.isExec ? 1 : 0}`;
      if (seenW.has(k)) return false; seenW.add(k); return true;
    });

    return {
      name,
      type: 'Server',
      nodes: this.nodes,
      wires: this.wires,
      graphVariables: this.graphVariables,
      customVariables: this.customVariables
    };
  }

  // ------------------------------------------------------------------
  // Top-Level Declarations Scanner
  // ------------------------------------------------------------------
  parseTopLevelDeclarations(T) {
    let i = 0;
    const n = T.length;
    let inCustomVarsSection = false;
    let currentCustomEntity = null; // { type: 'self' | 'guid', guid?: string, alias?: string }

    while (i < n) {
      const tk = T[i];

      // Detect section comments
      if (tk.t === 'ln') {
        const lineText = tk.v.toLowerCase();
        if (lineText.includes('custom variable')) {
          inCustomVarsSection = true;
          currentCustomEntity = null;
        } else if (lineText.includes('node graph variable')) {
          inCustomVarsSection = false;
          currentCustomEntity = null;
        } else if (lineText.includes('event')) {
          break; // Stop parsing declarations when event section starts
        }
        i++;
        continue;
      }

      // Stop top-level scanning once an event handler is reached
      if (tk.t === 'id' && (tk.v === 'f' || tk.v === 'require') && T[i + 1]?.t === '.' && T[i + 2]?.v === 'on') {
        break;
      }

      // 1. Direct namespaced syntax: `self.Damage: float = get` or `self.Damage: float`
      if (tk.t === 'id' && tk.v === 'self' && T[i + 1]?.t === '.' && T[i + 2]?.t === 'id') {
        const varName = T[i + 2].v;
        let j = i + 3;
        let varType = null;
        if (T[j]?.t === ':') {
          j++;
          if (T[j]?.t === 'id') {
            varType = normalizeTypeName(T[j].v);
            j++;
          }
        }
        let rawVal = 'get';
        if (T[j]?.t === '=') {
          j++;
          const valTk = T[j];
          if (valTk) { rawVal = String(valTk.v); j++; }
        }
        if (!varType) varType = inferTypeFromVal(rawVal);
        this.customVariables.push({
          entityType: 'self',
          guid: null,
          name: varName,
          type: varType,
          defaultValue: rawVal,
          isGet: rawVal === 'get' || !rawVal
        });
        i = j;
        continue;
      }

      // 2. Direct namespaced guid syntax: `guid.Boss = 1008221` (definition) or `guid.Boss.HP: int = 100` or `guid.HP: int = 100`
      if (tk.t === 'id' && tk.v === 'guid') {
        // A) `guid = 1008221`
        if (T[i + 1]?.t === '=') {
          const guidVal = T[i + 2]?.v ?? '0';
          currentCustomEntity = { type: 'guid', guid: String(guidVal) };
          this.guidEntities.set('guid', String(guidVal));
          i += 3;
          continue;
        }
        // B) `guid.Boss = 1008221` or `guid.1 = 1008221`
        if (T[i + 1]?.t === '.' && (T[i + 2]?.t === 'id' || T[i + 2]?.t === 'num') && T[i + 3]?.t === '=') {
          const alias = String(T[i + 2].v);
          const guidVal = String(T[i + 4]?.v ?? '0');
          this.guidEntities.set(alias.toLowerCase(), guidVal);
          currentCustomEntity = { type: 'guid', guid: guidVal, alias };
          i += 5;
          continue;
        }
        // C) `guid.Boss.HP: int = 100` or `guid.1.HP: int = 100` or `guid.Boss.HP: int`
        if (T[i + 1]?.t === '.' && (T[i + 2]?.t === 'id' || T[i + 2]?.t === 'num') && T[i + 3]?.t === '.' && T[i + 4]?.t === 'id') {
          const alias = String(T[i + 2].v);
          const varName = T[i + 4].v;
          const resolvedGuid = this.guidEntities.get(alias.toLowerCase()) || (/^\d+$/.test(alias) ? alias : '0');
          let j = i + 5;
          let varType = null;
          if (T[j]?.t === ':') {
            j++;
            if (T[j]?.t === 'id') { varType = normalizeTypeName(T[j].v); j++; }
          }
          let rawVal = 'get';
          if (T[j]?.t === '=') {
            j++;
            const valTk = T[j];
            if (valTk) { rawVal = String(valTk.v); j++; }
          }
          if (!varType) varType = inferTypeFromVal(rawVal);
          this.customVariables.push({
            entityType: 'guid',
            guid: resolvedGuid,
            guidAlias: alias,
            name: varName,
            type: varType,
            defaultValue: rawVal,
            isGet: rawVal === 'get' || !rawVal
          });
          i = j;
          continue;
        }
        // D) `guid.HP: int = 100` or `guid.HP: int`
        if (T[i + 1]?.t === '.' && T[i + 2]?.t === 'id' && (T[i + 3]?.t === ':' || T[i + 3]?.t === '=' || inCustomVarsSection)) {
          const varName = T[i + 2].v;
          let j = i + 3;
          let varType = null;
          if (T[j]?.t === ':') {
            j++;
            if (T[j]?.t === 'id') { varType = normalizeTypeName(T[j].v); j++; }
          }
          let rawVal = 'get';
          if (T[j]?.t === '=') {
            j++;
            const valTk = T[j];
            if (valTk) { rawVal = String(valTk.v); j++; }
          }
          if (!varType) varType = inferTypeFromVal(rawVal);
          const resolvedGuid = this.guidEntities.get('guid') || '1008221';
          this.customVariables.push({
            entityType: 'guid',
            guid: resolvedGuid,
            name: varName,
            type: varType,
            defaultValue: rawVal,
            isGet: rawVal === 'get' || !rawVal
          });
          i = j;
          continue;
        }
      }

      // 3. Section header keywords: `self` or `none` block
      if (inCustomVarsSection) {
        if (tk.t === 'id' && tk.v === 'self') {
          currentCustomEntity = { type: 'self' };
          i++;
          continue;
        }
        if (tk.t === 'id' && tk.v === 'none') {
          currentCustomEntity = { type: 'none' };
          i++;
          continue;
        }
      }

      // 4. Check for Variable Declarations: `<Ident>: <type> = <val>` or `<Ident>: <type>`
      let isLocalPrefixed = false;
      let varIdentIdx = i;

      if (tk.t === 'id' && tk.v === 'local') {
        isLocalPrefixed = true;
        varIdentIdx = i + 1;
      }

      const varTk = T[varIdentIdx];
      if (varTk && varTk.t === 'id' && !['f', 'function', 'require', 'if', 'end', 'self', 'guid', 'return'].includes(varTk.v)) {
        const rawVarName = varTk.v;
        let j = varIdentIdx + 1;
        let varType = null;

        // Check for type annotation: `: int`
        if (T[j]?.t === ':') {
          j++;
          if (T[j]?.t === 'id') {
            varType = normalizeTypeName(T[j].v);
            j++;
          }
        }

        // Check for assignment: `= <value>` or implicit get in custom vars section
        if (T[j]?.t === '=' || (inCustomVarsSection && currentCustomEntity && varType)) {
          let rawVal = (inCustomVarsSection && currentCustomEntity) ? 'get' : '0';
          if (T[j]?.t === '=') {
            j++;
            const valTk = T[j];
            if (valTk) {
              rawVal = String(valTk.v);
              j++;
            }
          }

          if (!varType) {
            varType = inferTypeFromVal(rawVal);
          }

          if (inCustomVarsSection && currentCustomEntity) {
            // Register Custom Variable under active entity block
            this.customVariables.push({
              entityType: currentCustomEntity.type,
              guid: currentCustomEntity.guid || null,
              guidAlias: currentCustomEntity.alias || null,
              name: rawVarName,
              type: varType,
              defaultValue: rawVal,
              isGet: rawVal === 'get' || !rawVal
            });
          } else if (!inCustomVarsSection || isLocalPrefixed) {
            // Register Node Graph Variable
            const gv = {
              name: rawVarName,
              type: varType,
              defaultValue: rawVal,
              value: rawVal
            };
            this.graphVariables.push(gv);
            this.varToGraphVar.set(rawVarName.toLowerCase(), gv);
            this.varToGraphVar.set(rawVarName, gv);
          }
          i = j;
          continue;
        }
      }

      i++;
    }
  }

  parseDocHeader(code) {
    const m = /--\s*([^\n—–]+?)\s*[—–]/.exec(code);
    return m ? m[1].trim() : 'Untitled';
  }

  tokenize(src) {
    const T = [];
    let i = 0; const n = src.length;
    while (i < n) {
      const c = src[i];

      // Comment lines
      if (c === '-' && src[i + 1] === '-') {
        let e = src.indexOf('\n', i);
        if (e < 0) e = n;
        T.push({ t: 'ln', v: src.slice(i, e) });
        i = e + 1;
        continue;
      }

      // Whitespace
      if (/\s/.test(c)) { i++; continue; }

      // Strings
      if (c === '"' || c === "'") {
        const q = c; let s = ''; i++;
        while (i < n && src[i] !== q) {
          if (src[i] === '\\' && i + 1 < n) { s += src[i + 1]; i += 2; }
          else { s += src[i]; i++; }
        }
        i++; // closing quote
        T.push({ t: 'str', v: s });
        continue;
      }

      // Numbers
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        let s = '';
        while (i < n && /[0-9.eE+-]/.test(src[i])) { s += src[i]; i++; }
        T.push({ t: 'num', v: parseFloat(s) });
        continue;
      }

      // Identifiers & Keywords
      if (/[a-zA-Z_]/.test(c)) {
        let s = '';
        while (i < n && /[a-zA-Z0-9_]/.test(src[i])) { s += src[i]; i++; }
        T.push({ t: 'id', v: s });
        continue;
      }

      // Two-character operators
      const two = src.slice(i, i + 2);
      if (['==', '~=', '!=', '<=', '>=', '..'].includes(two)) {
        T.push({ t: two, v: two });
        i += 2;
        continue;
      }

      // Single-character symbols
      T.push({ t: c, v: c });
      i++;
    }
    return T;
  }

  findHandlers(T) {
    const handlers = [];
    for (let i = 0; i < T.length; i++) {
      if (T[i].t === 'id' && (T[i].v === 'f' || T[i].v === 'utils') &&
          T[i + 1]?.t === '.' && T[i + 2]?.t === 'id' && T[i + 2].v === 'on' &&
          T[i + 3]?.t === '(') {
        let evName = 'whenTabSelected';
        let j = i + 4;
        if (T[j]?.t === 'str') { evName = T[j].v; j++; }
        while (j < T.length && !(T[j].t === 'id' && T[j].v === 'function')) j++;
        while (j < T.length && T[j].t !== ')') j++;
        const bodyStart = j + 1;
        let depth = 1;
        let k = bodyStart;
        while (k < T.length) {
          const tk = T[k];
          if (tk.t === 'id' && (tk.v === 'function' || tk.v === 'if' || tk.v === 'for' || tk.v === 'while')) depth++;
          else if (tk.t === 'id' && tk.v === 'end') { depth--; if (depth === 0) break; }
          k++;
        }
        let evId = null;
        if (i > 0 && T[i - 1].t === 'ln') {
          const m = /@([A-Za-z0-9_:.\-]+)/.exec(T[i - 1].v);
          if (m) evId = m[1];
        }
        handlers.push({ bodyStart, end: k, evId, evName });
        i = k;
      }
    }
    return handlers;
  }

  makeNode(blueprintId, name, cat) {
    const bp = getNodeBlueprint(blueprintId) || getNodeBlueprint(name);
    const id = `node_parsed_${Date.now()}_${this._n++}`;
    const node = {
      id,
      blueprintId: bp ? bp.id : blueprintId,
      name: bp ? bp.name : name,
      category: bp ? bp.category : (cat || 'execution'),
      x: this.x,
      y: this.y,
      inputValues: {},
      customInputs: [],
      customOutputs: []
    };
    if (bp && bp.inputs) {
      bp.inputs.forEach(inp => {
        if (inp.defaultVal !== undefined) node.inputValues[inp.name] = inp.defaultVal;
      });
    }
    return node;
  }

  makeEventNode(evName) {
    let bpId = 'event_when_tab_selected';
    let bpName = 'When Tab Selected';

    if (evName === 'whenGameStarts') { bpId = 'event_when_game_starts'; bpName = 'When Game Starts'; }
    else if (evName === 'whenGameTimerElapses') { bpId = 'event_when_game_timer_elapses'; bpName = 'When Game Timer Elapses'; }
    else if (evName === 'whenEntityCreated') { bpId = 'event_when_entity_created'; bpName = 'When Entity Is Created'; }
    else if (evName === 'whenEntityDestroyed') { bpId = 'event_when_entity_destroyed'; bpName = 'When Entity Is Destroyed'; }
    else if (evName === 'whenEntityTakesDamage') { bpId = 'event_when_entity_takes_damage'; bpName = 'When Entity Takes Damage'; }
    else if (evName === 'whenEntityDealsDamage') { bpId = 'event_when_entity_deals_damage'; bpName = 'When Entity Deals Damage'; }
    else if (evName === 'whenUiButtonClicked') { bpId = 'event_when_ui_button_clicked'; bpName = 'When UI Button Is Clicked'; }
    else if (evName && evName !== 'whenTabSelected') {
      bpId = 'event_monitor_signal';
      bpName = 'Monitor Signal';
    }

    const node = this.makeNode(bpId, bpName, 'event');
    if (bpId === 'event_monitor_signal') {
      node.signalName = evName;
      node.inputValues['Signal Name'] = evName;
    }
    return node;
  }

  placeFlow(node) {
    node.x = this.x;
    node.y = this.y;
    this.x += 320;
  }

  placeData(node) {
    node.x = this.x - 280;
    node.y = this.y + 120;
  }

  connectExec(fromNode, toNode) {
    if (!fromNode || !toNode) return;
    this.wires.push({
      id: this.nextWireId(),
      fromNode: fromNode.id,
      fromPin: 'execOut',
      toNode: toNode.id,
      toPin: 'execIn',
      isExec: true
    });
  }

  connectPin(fromNode, fromPin, toNode) {
    if (!fromNode || !toNode) return;
    this.wires.push({
      id: this.nextWireId(),
      fromNode: fromNode.id,
      fromPin,
      toNode: toNode.id,
      toPin: 'execIn',
      isExec: true
    });
  }

  nextWireId() { return `w_parsed_${Date.now()}_${Math.floor(Math.random() * 1e6)}`; }

  readNodeId() {
    const tk = this.T[this.i];
    if (tk && tk.t === 'ln') {
      const m = /@([A-Za-z0-9_:.\-]+)/.exec(tk.v);
      if (m) {
        this.i++;
        return m[1];
      }
    }
    return null;
  }

  // ------------------------------------------------------------------
  // Pre-Register Locals & Event Readouts
  // ------------------------------------------------------------------
  preRegisterLocals() {
    const T = this.T;
    let i = 0;
    const n = T.length;

    while (i < n) {
      if (T[i]?.t !== 'id' || T[i].v !== 'local') { i++; continue; }
      if (!(T[i + 1] && T[i + 1].t === 'id')) { i += 2; continue; }
      const varName = T[i + 1].v;
      let j = i + 2;
      let declaredType = null;
      if (T[j]?.t === ':') {
        j++;
        if (T[j]?.t === 'id') {
          declaredType = normalizeTypeName(T[j].v);
          j++;
        }
      }
      if (T[j]?.t === '=') j++;

      // Check if RHS is event readout: local origin = ctx -- Origin
      const nxt = T[j];
      if (nxt?.t === 'id' && (nxt.v === 'ctx' || nxt.v === 'payload' || nxt.v === 'event')) {
        let pin = '';
        if (T[j + 1]?.t === 'ln') {
          const com = T[j + 1].v;
          const cleanCom = com.replace(/^[-#/\s]+/, '').replace(/@[A-Za-z0-9_:.\-]+/g, '').replace(/[()]/g, '').trim();
          if (cleanCom) pin = cleanCom;
        }
        if (!pin) {
          pin = varName;
        }

        const curEvId = this.currentEventId();
        this.varToEvent.set(varName, { evId: curEvId, pin });

        const evNode = this.nodes.find(node => node.id === curEvId);
        if (evNode && (evNode.blueprintId === 'event_monitor_signal' || evNode.name === 'Monitor Signal')) {
          const builtin = [
            'Event Source Entity', 'Event Source GUID', 'Signal Source Entity',
            'event_source_entity', 'event_source_g_u_i_d', 'signal_source_entity',
            'execIn', 'execOut', 'Signal Name', 'Signal'
          ];
          if (pin && !builtin.includes(pin)) {
            if (!Array.isArray(evNode.customOutputs)) evNode.customOutputs = [];
            if (!evNode.customOutputs.some(o => o.name === pin)) {
              evNode.customOutputs.push({ name: pin, type: 'int' });
            }
          }
        }
        i = j + 2;
        continue;
      }
      i = j;
    }
  }

  skipLocal() {
    const T = this.T;
    let i = this.i + 1;
    if (T[i]?.t === 'id') i++;
    if (T[i]?.t === ':') { i += 2; }
    if (T[i]?.t === '=') i++;
    let parenDepth = 0;
    while (i < T.length) {
      const tk = T[i];
      if (tk.t === '(' || tk.t === '{') parenDepth++;
      else if (tk.t === ')' || tk.t === '}') {
        if (parenDepth > 0) parenDepth--;
      }
      if (tk.t === 'ln' && parenDepth === 0) { i++; break; }
      if (tk.t === 'id' && (tk.v === 'local' || tk.v === 'if' || tk.v === 'end' || tk.v === 'function') && parenDepth === 0) break;
      i++;
    }
    this.i = i;
  }

  currentEventId() {
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      if ((this.nodes[i].category || '') === 'event') return this.nodes[i].id;
    }
    return null;
  }

  // ------------------------------------------------------------------
  // Math and Expression Parsing
  // ------------------------------------------------------------------
  createConversionNode(operand, targetType = 'int') {
    let sourceOperand = operand;

    // If converting a literal constant (e.g. toFloat(2)), create Get Local Variable node as input source
    if (operand && operand.isLit) {
      const litVal = operand.value;
      const s = String(litVal);
      let srcType = 'int';
      if (s === 'True' || s === 'False' || s === 'true' || s === 'false') srcType = 'bool';
      else if (s.includes('.')) srcType = 'float';

      const getLocalNode = this.makeNode('query_get_local_variable', 'Get Local Variable', 'query');
      this.placeData(getLocalNode);
      getLocalNode.dataType = srcType;
      const bpGet = getNodeBlueprint('query_get_local_variable');
      if (bpGet) applyDataTypeToNode(getLocalNode, bpGet, srcType);
      getLocalNode.inputValues['Initial Value'] = String(litVal);
      this.nodes.push(getLocalNode);

      sourceOperand = {
        isVar: true,
        nodeId: getLocalNode.id,
        outputPin: 'Local Variable',
        dataType: srcType,
        node: getLocalNode
      };
    }

    const srcType = sourceOperand?.dataType || 'int';

    const node = this.makeNode('op_data_type_conversion', 'Data Type Conversion', 'operation');
    this.placeData(node);
    node.dataType = targetType;
    if (!node.pinTypes) node.pinTypes = {};
    node.pinTypes['Input'] = srcType;
    node.pinTypes['Output'] = targetType;

    const bp = getNodeBlueprint('op_data_type_conversion');
    if (bp) {
      applyDataTypeToNode(node, bp, targetType);
      node.pinTypes['Input'] = srcType;
      node.pinTypes['Output'] = targetType;
    }
    this.nodes.push(node);
    this.applyValueTo(node, 'Input', sourceOperand);
    return { isVar: true, nodeId: node.id, outputPin: 'Output', dataType: targetType, node };
  }

  createBinaryOpNode(bpId, bpName, left, right, leftPin = 'Input 1', rightPin = 'Input 2', outPin = 'Result', expectedType = null) {
    const node = this.makeNode(bpId, bpName, 'operation');
    this.placeData(node);

    const getType = (v) => {
      if (!v) return null;
      if (v.dataType) return v.dataType;
      if (v.isVar && v.nodeId) {
        const src = this.nodes.find(n => n.id === v.nodeId);
        if (src && src.dataType) return src.dataType;
        if (src && src.blueprintId === 'query_get_node_graph_var') {
          const vName = src.inputValues?.['Variable Name'];
          const gv = this.varToGraphVar.get(vName?.toLowerCase()) || this.varToGraphVar.get(vName);
          if (gv && gv.type) return gv.type;
        }
      } else if (v.isLit) {
        const s = String(v.value);
        if (s === 'True' || s === 'False' || s === 'true' || s === 'false') return 'bool';
        if (s.includes('.')) return 'float';
        if (/^-?\d+$/.test(s)) return 'int';
      }
      return null;
    };

    const leftType = getType(left);
    const rightType = getType(right);

    let inferredType = expectedType || leftType || rightType || 'int';
    if (!expectedType && (leftType === 'float' || rightType === 'float')) {
      inferredType = 'float';
    }

    let finalLeft = left;
    let finalRight = right;

    const isArithmetic = bpId.startsWith('op_addition') || bpId.startsWith('op_subtraction') ||
      bpId.startsWith('op_multiplication') || bpId.startsWith('op_division') ||
      bpId.startsWith('op_modulo') || bpId.startsWith('op_exponentiation');

    // Only convert non-literal node outputs if types mismatch
    if (isArithmetic || bpId.startsWith('op_equal') || bpId.startsWith('op_greater') || bpId.startsWith('op_less')) {
      if (left && !left.isLit && leftType && leftType !== inferredType && (leftType === 'float' || leftType === 'int') && (inferredType === 'float' || inferredType === 'int')) {
        finalLeft = this.createConversionNode(left, inferredType);
      }
      if (right && !right.isLit && rightType && rightType !== inferredType && (rightType === 'float' || rightType === 'int') && (inferredType === 'float' || inferredType === 'int')) {
        finalRight = this.createConversionNode(right, inferredType);
      }
    }

    node.dataType = inferredType;
    const bp = getNodeBlueprint(bpId) || getNodeBlueprint(bpName);
    if (bp) {
      applyDataTypeToNode(node, bp, inferredType);
    }

    this.nodes.push(node);
    this.applyValueTo(node, leftPin, finalLeft);
    this.applyValueTo(node, rightPin, finalRight);

    return { isVar: true, nodeId: node.id, outputPin: outPin, dataType: inferredType, node };
  }

  createMathOpNode(fn, args = []) {
    fn = fn.toLowerCase();
    if (fn === 'cos' || fn === 'cosine') {
      const node = this.makeNode('op_cosine_function', 'Cosine Function', 'operation');
      this.placeData(node);
      this.nodes.push(node);
      this.applyValueTo(node, 'Radian', args[0]);
      return { isVar: true, nodeId: node.id, outputPin: 'Result', dataType: 'float', node };
    }
    if (fn === 'sin' || fn === 'sine') {
      const node = this.makeNode('op_sine_function', 'Sine Function', 'operation');
      this.placeData(node);
      this.nodes.push(node);
      this.applyValueTo(node, 'Radian', args[0]);
      return { isVar: true, nodeId: node.id, outputPin: 'Result', dataType: 'float', node };
    }
    if (fn === 'tan' || fn === 'tangent') {
      const node = this.makeNode('op_tangent_function', 'Tangent Function', 'operation');
      this.placeData(node);
      this.nodes.push(node);
      this.applyValueTo(node, 'Radian', args[0]);
      return { isVar: true, nodeId: node.id, outputPin: 'Result', dataType: 'float', node };
    }
    if (fn === 'sqrt') {
      const node = this.makeNode('op_arithmetic_square_root_operation', 'Arithmetic Square Root Operation', 'operation');
      this.placeData(node);
      this.nodes.push(node);
      this.applyValueTo(node, 'Input', args[0]);
      return { isVar: true, nodeId: node.id, outputPin: 'Result', dataType: 'float', node };
    }
    if (fn === 'acos' || fn === 'arccosine') {
      const node = this.makeNode('op_arccosine_function', 'Arccosine Function', 'operation');
      this.placeData(node);
      this.nodes.push(node);
      this.applyValueTo(node, 'Input', args[0]);
      return { isVar: true, nodeId: node.id, outputPin: 'Radian', dataType: 'float', node };
    }
    if (fn === 'asin' || fn === 'arcsine') {
      const node = this.makeNode('op_arcsine_function', 'Arcsine Function', 'operation');
      this.placeData(node);
      this.nodes.push(node);
      this.applyValueTo(node, 'Input', args[0]);
      return { isVar: true, nodeId: node.id, outputPin: 'Radian', dataType: 'float', node };
    }
    if (fn === 'atan' || fn === 'arctangent') {
      const node = this.makeNode('op_arctangent_function', 'Arctangent Function', 'operation');
      this.placeData(node);
      this.nodes.push(node);
      this.applyValueTo(node, 'Input', args[0]);
      return { isVar: true, nodeId: node.id, outputPin: 'Radian', dataType: 'float', node };
    }
    if (fn === 'abs') {
      const node = this.makeNode('op_absolute_value_operation', 'Absolute Value Operation', 'operation');
      this.placeData(node);
      this.nodes.push(node);
      this.applyValueTo(node, 'Input', args[0]);
      return { isVar: true, nodeId: node.id, outputPin: 'Result', dataType: 'float', node };
    }
    if (fn === 'deg') {
      const node = this.makeNode('op_radians_to_degrees', 'Radians to Degrees', 'operation');
      this.placeData(node);
      this.nodes.push(node);
      this.applyValueTo(node, 'Radian Value', args[0]);
      return { isVar: true, nodeId: node.id, outputPin: 'Angle Value', dataType: 'float', node };
    }
    if (fn === 'rad') {
      const node = this.makeNode('op_degrees_to_radians', 'Degrees to Radians', 'operation');
      this.placeData(node);
      this.nodes.push(node);
      this.applyValueTo(node, 'Angle Value', args[0]);
      return { isVar: true, nodeId: node.id, outputPin: 'Radian Value', dataType: 'float', node };
    }
    if (fn === 'min') {
      const node = this.makeNode('op_take_smaller_value', 'Take Smaller Value', 'operation');
      this.placeData(node);
      this.nodes.push(node);
      this.applyValueTo(node, 'Input 1', args[0]);
      this.applyValueTo(node, 'Input 2', args[1]);
      return { isVar: true, nodeId: node.id, outputPin: 'Smaller Value', dataType: 'float', node };
    }
    if (fn === 'max') {
      const node = this.makeNode('op_take_larger_value', 'Take Larger Value', 'operation');
      this.placeData(node);
      this.nodes.push(node);
      this.applyValueTo(node, 'Input 1', args[0]);
      this.applyValueTo(node, 'Input 2', args[1]);
      return { isVar: true, nodeId: node.id, outputPin: 'Larger Value', dataType: 'float', node };
    }
    if (fn === 'clamp') {
      const node = this.makeNode('op_range_limiting', 'Range Limiting Operation', 'operation');
      this.placeData(node);
      this.nodes.push(node);
      this.applyValueTo(node, 'Input', args[0]);
      this.applyValueTo(node, 'Lower Limit', args[1]);
      this.applyValueTo(node, 'Upper Limit', args[2]);
      return { isVar: true, nodeId: node.id, outputPin: 'Result', dataType: 'float', node };
    }
    if (fn === 'floor' || fn === 'ceil' || fn === 'round' || fn === 'trunc') {
      const node = this.makeNode('op_round_to_integer_operation', 'Round to Integer Operation', 'operation');
      this.placeData(node);
      node.inputValues['Rounding Mode'] = fn === 'floor' ? 'Round Down' : (fn === 'ceil' ? 'Round Up' : (fn === 'trunc' ? 'Truncate' : 'Round'));
      this.nodes.push(node);
      this.applyValueTo(node, 'Input', args[0]);
      return { isVar: true, nodeId: node.id, outputPin: 'Result', dataType: 'int', node };
    }
    return null;
  }

  createUnaryOpNode(bpId, bpName, operand, inPin = 'Input', outPin = 'Result') {
    const node = this.makeNode(bpId, bpName, 'operation');
    this.placeData(node);
    this.nodes.push(node);
    this.applyValueTo(node, inPin, operand);
    return { isVar: true, nodeId: node.id, outputPin: outPin, node };
  }

  createRandomQueryNode(isFloat, minVal, maxVal) {
    const bpId = isFloat ? 'query_get_random_floating_point_number' : 'query_get_random_int';
    const bpName = isFloat ? 'Get Random Floating-Point Number' : 'Get Random Integer';
    const node = this.makeNode(bpId, bpName, 'query');
    this.placeData(node);
    this.nodes.push(node);
    node.inputValues['Lower Limit'] = String(minVal);
    node.inputValues['Upper Limit'] = String(maxVal);
    return { isVar: true, nodeId: node.id, outputPin: 'Result', dataType: isFloat ? 'float' : 'int', node };
  }

  createGetGraphVarNode(varName) {
    const gv = this.varToGraphVar.get(varName.toLowerCase()) || this.varToGraphVar.get(varName);
    const resolvedName = gv ? gv.name : varName;
    const resolvedType = gv ? gv.type : 'int';

    const node = this.makeNode('query_get_node_graph_var', 'Get Node Graph Variable', 'query');
    this.placeData(node);
    node.inputValues['Variable Name'] = resolvedName;
    node.dataType = resolvedType;
    const bp = getNodeBlueprint('query_get_node_graph_var');
    if (bp) {
      applyDataTypeToNode(node, bp, resolvedType);
    }
    this.nodes.push(node);
    return { isVar: true, nodeId: node.id, outputPin: 'Variable Value', dataType: resolvedType, node };
  }

  createGetCustomVarSelfNode(varName) {
    const cv = this.customVariables.find(c => c.entityType === 'self' && c.name.toLowerCase() === varName.toLowerCase());
    const resolvedName = cv ? cv.name : varName;
    const resolvedType = cv ? cv.type : 'float';

    const getVarNode = this.makeNode('query_get_custom_var', 'Get Custom Variable', 'query');
    this.placeData(getVarNode);
    getVarNode.inputValues['Variable Name'] = resolvedName;
    getVarNode.dataType = resolvedType;
    const bp = getNodeBlueprint('query_get_custom_var');
    if (bp) applyDataTypeToNode(getVarNode, bp, resolvedType);
    this.nodes.push(getVarNode);

    // Create Get Self Entity query node
    const selfNode = this.makeNode('query_get_self_entity', 'Get Self Entity', 'query');
    selfNode.x = getVarNode.x - 140;
    selfNode.y = getVarNode.y + 120;
    this.nodes.push(selfNode);
    this.wires.push({
      id: this.nextWireId(),
      fromNode: selfNode.id,
      fromPin: 'Self Entity',
      toNode: getVarNode.id,
      toPin: 'Target Entity',
      isExec: false
    });

    return { isVar: true, nodeId: getVarNode.id, outputPin: 'Variable Value', dataType: resolvedType, node: getVarNode };
  }

  createGetCustomVarGuidNode(varName, guidVal = '0', guidAlias = null) {
    const cv = this.customVariables.find(c => c.entityType === 'guid' && c.name.toLowerCase() === varName.toLowerCase());
    const resolvedName = cv ? cv.name : varName;
    const resolvedType = cv ? cv.type : 'float';
    const finalGuid = cv && cv.guid ? cv.guid : guidVal;
    const finalAlias = (cv && cv.guidAlias) ? cv.guidAlias : guidAlias;

    const getVarNode = this.makeNode('query_get_custom_var', 'Get Custom Variable', 'query');
    this.placeData(getVarNode);
    getVarNode.inputValues['Variable Name'] = resolvedName;
    getVarNode.dataType = resolvedType;
    const bp = getNodeBlueprint('query_get_custom_var');
    if (bp) applyDataTypeToNode(getVarNode, bp, resolvedType);
    this.nodes.push(getVarNode);

    // Create Query Entity by GUID node
    const guidNode = this.makeNode('query_query_entity_by_guid', 'Query Entity by GUID', 'query');
    guidNode.x = getVarNode.x - 220;
    guidNode.y = getVarNode.y + 120;
    guidNode.inputValues['GUID'] = String(finalGuid);
    if (finalAlias) guidNode.guidAlias = finalAlias;
    this.nodes.push(guidNode);
    this.wires.push({
      id: this.nextWireId(),
      fromNode: guidNode.id,
      fromPin: 'Entity',
      toNode: getVarNode.id,
      toPin: 'Target Entity',
      isExec: false
    });

    return { isVar: true, nodeId: getVarNode.id, outputPin: 'Variable Value', dataType: resolvedType, node: getVarNode };
  }

  parseExprTokens(tokens, allowAssignEqual = false, expectedType = null) {
    if (!tokens || tokens.length === 0) return { isLit: true, value: '' };

    let idx = 0;
    const peek = () => tokens[idx];
    const consume = () => tokens[idx++];

    const MATH_FN_NAMES = new Set([
      'cos', 'sin', 'tan', 'sqrt', 'acos', 'asin', 'atan', 'abs', 'deg', 'rad', 'min', 'max', 'clamp', 'floor', 'ceil', 'round', 'trunc'
    ]);

    const parsePrimary = () => {
      const tk = consume();
      if (!tk) return { isLit: true, value: '' };

      // Number literal
      if (tk.t === 'num') {
        return { isLit: true, value: tk.v };
      }

      // String literal
      if (tk.t === 'str') {
        return { isLit: true, value: tk.v };
      }

      // Parenthesized expression
      if (tk.t === '(') {
        const sub = parseOr();
        if (peek()?.t === ')') consume();
        return sub;
      }

      // Identifiers / Function calls
      if (tk.t === 'id') {
        const name = tk.v;

        if (name === 'true') return { isLit: true, value: 'True' };
        if (name === 'false') return { isLit: true, value: 'False' };
        if (name === 'nil') return { isLit: true, value: '' };

        // Constants: math.pi, f.pi, pi, pi()
        if ((name === 'math' || name === 'f') && peek()?.t === '.' && (tokens[idx + 1]?.v === 'pi' || tokens[idx + 1]?.v === 'PI')) {
          consume(); consume(); // '.' and 'pi'
          if (peek()?.t === '(') {
            consume();
            if (peek()?.t === ')') consume();
          }
          const piNode = this.makeNode('op_pi', 'Pi', 'operation');
          this.placeData(piNode);
          this.nodes.push(piNode);
          return { isVar: true, nodeId: piNode.id, outputPin: 'Pi (π)', dataType: 'float', node: piNode };
        }
        if (name === 'pi' || name === 'PI') {
          if (peek()?.t === '(') {
            consume();
            if (peek()?.t === ')') consume();
          }
          const piNode = this.makeNode('op_pi', 'Pi', 'operation');
          this.placeData(piNode);
          this.nodes.push(piNode);
          return { isVar: true, nodeId: piNode.id, outputPin: 'Pi (π)', dataType: 'float', node: piNode };
        }

        // Explicit conversion functions: toInt(expr), toFloat(expr), toBool(expr), tostring(expr), toVector3(expr)
        if ((name === 'toInt' || name === 'toFloat' || name === 'toBool' || name === 'tostring' || name === 'toVector3' || name === 'dataTypeConversion') && peek()?.t === '(') {
          consume(); // '('
          const arg = parseOr();
          if (peek()?.t === ')') consume();
          let targetType = 'int';
          if (name === 'toFloat') targetType = 'float';
          else if (name === 'toBool') targetType = 'bool';
          else if (name === 'tostring') targetType = 'string';
          else if (name === 'toVector3') targetType = 'vector3';
          return this.createConversionNode(arg, targetType);
        }

        // Random function calls: random(1, 2) or randomFloat(1.0, 5.0)
        if ((name === 'random' || name === 'randomFloat') && peek()?.t === '(') {
          consume(); // '('
          let minVal = 0, maxVal = 100;
          const arg1 = parseOr();
          if (arg1 && arg1.isLit) minVal = arg1.value;
          if (peek()?.t === ',') {
            consume();
            const arg2 = parseOr();
            if (arg2 && arg2.isLit) maxVal = arg2.value;
          }
          if (peek()?.t === ')') consume();
          const isFloat = name === 'randomFloat' ||
                          String(minVal).includes('.') ||
                          String(maxVal).includes('.');
          return this.createRandomQueryNode(isFloat, minVal, maxVal);
        }

        // Check math.random or math.randomFloat
        if (name === 'math' && peek()?.t === '.' && (tokens[idx + 1]?.v === 'random' || tokens[idx + 1]?.v === 'randomFloat')) {
          consume(); const rfn = consume().v; // '.' and 'random'
          if (peek()?.t === '(') consume();
          const arg1 = parseOr();
          let minVal = 0, maxVal = 100;
          if (arg1 && arg1.isLit) minVal = arg1.value;
          if (peek()?.t === ',') {
            consume();
            const arg2 = parseOr();
            if (arg2 && arg2.isLit) maxVal = arg2.value;
          }
          if (peek()?.t === ')') consume();
          const isFloat = rfn === 'randomFloat' ||
                          String(minVal).includes('.') ||
                          String(maxVal).includes('.');
          return this.createRandomQueryNode(isFloat, minVal, maxVal);
        }

        // Check math.<fn>(...) or f.<fn>(...) where fn in MATH_FN_NAMES
        if ((name === 'math' || name === 'f') && peek()?.t === '.' && MATH_FN_NAMES.has(tokens[idx + 1]?.v?.toLowerCase())) {
          consume(); const fn = consume().v;
          const args = [];
          if (peek()?.t === '(') {
            consume();
            while (peek() && peek().t !== ')') {
              args.push(parseOr());
              if (peek()?.t === ',') consume();
              else break;
            }
            if (peek()?.t === ')') consume();
          }
          const mathOp = this.createMathOpNode(fn, args);
          if (mathOp) return mathOp;
        }

        // Direct <fn>(...) where fn in MATH_FN_NAMES (e.g. cos(sum), sqrt(sum))
        if (MATH_FN_NAMES.has(name.toLowerCase()) && peek()?.t === '(') {
          consume(); // '('
          const args = [];
          while (peek() && peek().t !== ')') {
            args.push(parseOr());
            if (peek()?.t === ',') consume();
            else break;
          }
          if (peek()?.t === ')') consume();
          const mathOp = this.createMathOpNode(name, args);
          if (mathOp) return mathOp;
        }

        // Blueprint queries like f.<query>(...)
        if (PREFIX.has(name) && peek()?.t === '.') {
          consume(); // '.'
          const fnTk = consume();
          const fn = fnTk ? fnTk.v : '';

          if (fn === 'toInt' || fn === 'toFloat' || fn === 'toBool' || fn === 'tostring' || fn === 'toVector3' || fn === 'dataTypeConversion' || fn === 'convertDataType') {
            if (peek()?.t === '(') consume();
            const arg = parseOr();
            if (peek()?.t === ')') consume();
            let targetType = 'int';
            if (fn === 'toFloat') targetType = 'float';
            else if (fn === 'toBool') targetType = 'bool';
            else if (fn === 'tostring') targetType = 'string';
            else if (fn === 'toVector3') targetType = 'vector3';
            return this.createConversionNode(arg, targetType);
          }

          const groups = [];
          if (peek()?.t === '(') {
            const r = this.readGroupsFrom(tokens, idx);
            idx = r.end;
            groups.push(...r.groups);
          }
          const ent = resolveNode(fn);
          if (ent) {
            const qnode = this.makeNode(ent.id, ent.name, ent.cat || 'query');
            this.placeData(qnode);
            this.applyInputs(qnode, groups);
            this.nodes.push(qnode);
            return { isVar: true, nodeId: qnode.id, outputPin: this.dataOutputPin(qnode), node: qnode };
          }
        }

        // Custom Variable references: self.Damage, guid.HP, guid.Boss.HP, guid.1.HP
        if (name === 'self' && peek()?.t === '.') {
          consume(); // '.'
          const varTk = consume();
          const varName = varTk ? varTk.v : 'Variable';
          return this.createGetCustomVarSelfNode(varName);
        }

        if (name === 'guid' && peek()?.t === '.') {
          consume(); // '.'
          const firstPart = consume();
          let varName = firstPart ? firstPart.v : 'Variable';
          let resolvedGuid = this.guidEntities.get('guid') || '1008221';
          let guidAlias = null;
          if (peek()?.t === '.') {
            consume(); // second '.'
            const secondPart = consume();
            guidAlias = String(firstPart ? firstPart.v : '');
            varName = secondPart ? secondPart.v : 'Variable';
            resolvedGuid = this.guidEntities.get(guidAlias.toLowerCase()) || (/^\d+$/.test(guidAlias) ? guidAlias : '0');
          }
          return this.createGetCustomVarGuidNode(varName, resolvedGuid, guidAlias);
        }

        // Event parameter references
        if (this.varToEvent.has(name)) {
          const evRef = this.varToEvent.get(name);
          return { isEvent: true, evId: evRef.evId, pin: evRef.pin };
        }

        // Local variable references (Get Local Variable)
        if (this.varToLocalVar.has(name)) {
          const lNode = this.varToLocalVar.get(name);
          return { isVar: true, nodeId: lNode.id, outputPin: 'Value', dataType: lNode.dataType || 'float', node: lNode };
        }

        // Fallback local variable references
        if (this.varToNode.has(name)) {
          return { isVar: true, nodeId: this.varToNode.get(name) };
        }

        // Node Graph Variable references (e.g. `My_var`, `HP`, `num`)
        if (this.varToGraphVar.has(name.toLowerCase()) || this.varToGraphVar.has(name)) {
          return this.createGetGraphVarNode(name);
        }

        return { isLit: true, value: name };
      }

      return { isLit: true, value: tk.v };
    };

    const parseUnary = () => {
      if (peek()?.t === 'id' && peek().v === 'not') {
        consume();
        const operand = parseUnary();
        return this.createUnaryOpNode('op_logical_not_operation', 'Logical NOT Operation', operand, 'Input', 'Result');
      }
      if (peek()?.t === '-') {
        consume();
        const operand = parseUnary();
        if (operand.isLit && typeof operand.value === 'number') {
          return { isLit: true, value: -operand.value };
        }
        return this.createBinaryOpNode('op_subtraction', 'Subtraction', { isLit: true, value: 0 }, operand, 'Input 1', 'Input 2', 'Result', expectedType);
      }
      return parsePrimary();
    };

    const parseMulDivMod = () => {
      let left = parseUnary();
      while (peek() && ['*', '/', '%', '^'].includes(peek().t)) {
        const op = consume().t;
        const right = parseUnary();
        if (op === '*') left = this.createBinaryOpNode('op_multiplication', 'Multiplication', left, right, 'Input 1', 'Input 2', 'Result', expectedType);
        else if (op === '/') left = this.createBinaryOpNode('op_division', 'Division', left, right, 'Input 1', 'Input 2', 'Result', expectedType);
        else if (op === '%') left = this.createBinaryOpNode('op_modulo_operation', 'Modulo Operation', left, right, 'Input 1', 'Input 2', 'Result', expectedType);
        else if (op === '^') left = this.createBinaryOpNode('op_exponentiation', 'Exponentiation', left, right, 'Base', 'Exponent', 'Result', expectedType);
      }
      return left;
    };

    const parseAddSub = () => {
      let left = parseMulDivMod();
      while (peek() && (peek().t === '+' || peek().t === '-')) {
        const op = consume().t;
        const right = parseMulDivMod();
        if (op === '+') left = this.createBinaryOpNode('op_addition', 'Addition', left, right, 'Input 1', 'Input 2', 'Result', expectedType);
        else if (op === '-') left = this.createBinaryOpNode('op_subtraction', 'Subtraction', left, right, 'Input 1', 'Input 2', 'Result', expectedType);
      }
      return left;
    };

    const parseComparison = () => {
      let left = parseAddSub();
      const compOps = ['==', '~=', '!=', '<', '<=', '>', '>='];
      if (allowAssignEqual) compOps.push('=');

      while (peek() && compOps.includes(peek().t)) {
        const op = consume().t;
        const right = parseAddSub();
        if (op === '==' || op === '=') {
          left = this.createBinaryOpNode('op_equal', 'Equal', left, right, 'Input 1', 'Input 2', 'Result');
        } else if (op === '>') {
          left = this.createBinaryOpNode('op_greater_than', 'Greater Than', left, right, 'Left Value', 'Right Value', 'Result');
        } else if (op === '>=') {
          left = this.createBinaryOpNode('op_greater_than_or_equal_to', 'Greater Than or Equal To', left, right, 'Left Value', 'Right Value', 'Result');
        } else if (op === '<') {
          left = this.createBinaryOpNode('op_less_than', 'Less Than', left, right, 'Left Value', 'Right Value', 'Result');
        } else if (op === '<=') {
          left = this.createBinaryOpNode('op_less_than_or_equal_to', 'Less Than or Equal To', left, right, 'Left Value', 'Right Value', 'Result');
        } else if (op === '~=' || op === '!=') {
          const eq = this.createBinaryOpNode('op_equal', 'Equal', left, right, 'Input 1', 'Input 2', 'Result');
          left = this.createUnaryOpNode('op_logical_not_operation', 'Logical NOT Operation', eq, 'Input', 'Result');
        }
      }
      return left;
    };

    const parseAnd = () => {
      let left = parseComparison();
      while (peek()?.t === 'id' && peek().v === 'and') {
        consume();
        const right = parseComparison();
        left = this.createBinaryOpNode('op_logical_and_operation', 'Logical AND Operation', left, right);
      }
      return left;
    };

    const parseOr = () => {
      let left = parseAnd();
      while (peek()?.t === 'id' && peek().v === 'or') {
        consume();
        const right = parseAnd();
        left = this.createBinaryOpNode('op_logical_or_operation', 'Logical OR Operation', left, right);
      }
      return left;
    };

    return parseOr();
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

  argToValue(group) {
    if (!group || group.length === 0) return { isLit: true, value: '' };
    const filtered = group.filter(t => t.t !== 'ln');
    if (filtered.length === 0) return { isLit: true, value: '' };
    return this.parseExprTokens(filtered, false);
  }

  applyValueTo(node, pin, v) {
    if (!v) return;
    if (v.isVar && v.nodeId) {
      const src = this.nodes.find(n => n.id === v.nodeId);
      const outPin = v.outputPin || (src ? this.dataOutputPin(src) : 'Result');
      this.wires.push({
        id: this.nextWireId(), fromNode: v.nodeId,
        fromPin: outPin,
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

    // Signal Monitor / Send Signal
    if (node.blueprintId === 'exec_send_signal' || node.blueprintId === 'event_monitor_signal') {
      const nv = this.argToValue(groups[0] || []);
      const sig = nv.isLit ? String(nv.value) : nv.isVar ? (node.inputValues['Signal Name'] || '') : '';
      node.inputValues['Signal Name'] = sig;
      node.signalName = sig;
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

    // Set Custom Variable: f.setCustomVar(targetEntity, varName, varValue, triggerEvent)
    if (node.blueprintId === 'exec_set_custom_var') {
      // 1. Target Entity
      const g0 = groups[0] || [];
      const g0Str = g0.map(t => t.v).join('');
      if (g0Str.includes('getSelfEntity') || g0Str.includes('self') || g0Str === "'self'") {
        const selfNode = this.makeNode('query_get_self_entity', 'Get Self Entity', 'query');
        selfNode.x = node.x - 140;
        selfNode.y = node.y + 230;
        this.nodes.push(selfNode);
        this.wires.push({
          id: this.nextWireId(),
          fromNode: selfNode.id,
          fromPin: 'Self Entity',
          toNode: node.id,
          toPin: 'Target Entity',
          isExec: false
        });
      } else if (g0Str.includes('queryEntitybyGUID') || g0Str.includes('queryEntityByGuid') || g0Str.includes('guid')) {
        let guidVal = '0';
        let guidAlias = null;
        const aliasMatch = /guid\.([a-zA-Z0-9_]+)/i.exec(g0Str);
        if (aliasMatch) {
          guidAlias = aliasMatch[1];
          guidVal = this.guidEntities.get(guidAlias.toLowerCase()) || (/^\d+$/.test(guidAlias) ? guidAlias : '0');
        }
        const m = /(\d+)/.exec(g0Str);
        if (m && (!guidVal || guidVal === '0')) {
          guidVal = m[1];
        }
        if (!guidAlias && guidVal && guidVal !== '0') {
          for (const [a, g] of this.guidEntities.entries()) {
            if (g === guidVal) { guidAlias = a; break; }
          }
        }
        const guidNode = this.makeNode('query_query_entity_by_guid', 'Query Entity by GUID', 'query');
        guidNode.x = node.x - 220;
        guidNode.y = node.y + 230;
        guidNode.inputValues['GUID'] = guidVal;
        if (guidAlias) guidNode.guidAlias = guidAlias;
        this.nodes.push(guidNode);
        this.wires.push({
          id: this.nextWireId(),
          fromNode: guidNode.id,
          fromPin: 'Entity',
          toNode: node.id,
          toPin: 'Target Entity',
          isExec: false
        });
      } else {
        const g0Val = this.argToValue(g0);
        this.applyValueTo(node, 'Target Entity', g0Val);
      }

      // 2. Variable Name
      const g1Val = this.argToValue(groups[1] || []);
      const varName = g1Val.isLit ? String(g1Val.value) : '';
      node.inputValues['Variable Name'] = varName;

      // 3. Variable Value & Data Type
      const g2Val = this.argToValue(groups[2] || []);
      this.applyValueTo(node, 'Variable Value', g2Val);
      
      const matchedCv = this.customVariables.find(c => (c.name || '').toLowerCase() === varName.toLowerCase());
      if (matchedCv && matchedCv.type) {
        node.dataType = matchedCv.type;
        if (bp) applyDataTypeToNode(node, bp, matchedCv.type);
      } else if (g2Val.isLit) {
        const inferredType = inferTypeFromVal(g2Val.value);
        node.dataType = inferredType;
        if (bp) applyDataTypeToNode(node, bp, inferredType);
      }

      // 4. Trigger Event
      const g3Val = this.argToValue(groups[3] || []);
      const trigStr = String(g3Val.value || '').toLowerCase();
      node.inputValues['Trigger Event'] = (trigStr === 'false' || trigStr === 'no') ? 'False' : 'True';
      return;
    }

    groups.forEach((g, idx) => this.applyValueTo(node, this.pinForIndex(node, bp, idx), this.argToValue(g)));
  }

  dataOutputPin(node) {
    const bp = getNodeBlueprint(node.blueprintId) || getNodeBlueprint(node.name);
    if (!bp || !Array.isArray(bp.outputs) || bp.outputs.length === 0) return 'Result';
    const nonExec = bp.outputs.filter(o => !o.isExec && o.name !== 'execOut');
    return nonExec[0]?.name || bp.outputs[0]?.name || 'Result';
  }

  // ------------------------------------------------------------------
  // Main Block Parsing
  // ------------------------------------------------------------------
  parseBlock() {
    let first = null;
    let chainTail = null;
    while (this.i < this.T.length) {
      const tk = this.T[this.i];
      if (tk.t === 'id' && (tk.v === 'end' || tk.v === 'elseif' || tk.v === 'else')) return { first, last: chainTail };
      if (tk.t === 'ln') { this.i++; continue; }
      if (tk.t === ';' || tk.t === ',') { this.i++; continue; }
      if (tk.t === 'id' && tk.v === 'local') {
        const n = this.parseLocalDeclarationStmt();
        if (n) { if (!first) first = n; if (chainTail) this.connectExec(chainTail, n); chainTail = n; }
        continue;
      }
      if (tk.t === 'id' && (this.varToLocalVar.has(tk.v) || this.varToGraphVar.has(tk.v.toLowerCase()) || this.varToGraphVar.has(tk.v)) && (this.T[this.i + 1]?.t === '=')) {
        const n = this.parseAssignmentStmt(tk.v);
        if (n) { if (!first) first = n; if (chainTail) this.connectExec(chainTail, n); chainTail = n; }
        continue;
      }
      if (tk.t === 'id' && (tk.v === 'self' || tk.v === 'guid' || tk.v === 'target' || tk.v === 'entity' || this.guidEntities.has(tk.v.toLowerCase()) || this.varToNode.has(tk.v)) && (this.T[this.i + 1]?.t === '.') && (this.T[this.i + 2]?.t === 'id') && (this.T[this.i + 3]?.t === '=')) {
        const n = this.parseCustomVarAssignmentStmt();
        if (n) { if (!first) first = n; if (chainTail) this.connectExec(chainTail, n); chainTail = n; }
        continue;
      }
      if (tk.t === 'id' && tk.v === 'if') {
        const b = this.parseIf();
        if (b) {
          if (!first) first = b;
          if (chainTail) this.connectExec(chainTail, b);
          chainTail = b;
        }
        continue;
      }
      if (tk.t === 'id' && (tk.v === 'utils' || tk.v === 'f' || tk.v === 'n')) {
        const n = this.parseStmt();
        if (n) { if (!first) first = n; if (chainTail) this.connectExec(chainTail, n); chainTail = n; }
        continue;
      }
      this.i++;
    }
    return { first, last: chainTail };
  }

  parseLocalDeclarationStmt() {
    this.i++; // 'local'
    if (this.T[this.i]?.t !== 'id') return null;
    const varName = this.T[this.i].v;
    this.i++;

    let declaredType = null;
    if (this.T[this.i]?.t === ':') {
      this.i++;
      if (this.T[this.i]?.t === 'id') {
        declaredType = normalizeTypeName(this.T[this.i].v);
        this.i++;
      }
    }

    if (this.T[this.i]?.t === '=') {
      this.i++;
    }

    // Check if event readout (e.g. `ctx -- Origin`)
    if (this.T[this.i]?.t === 'id' && (this.T[this.i].v === 'ctx' || this.T[this.i].v === 'payload' || this.T[this.i].v === 'event')) {
      while (this.i < this.T.length && this.T[this.i]?.t !== 'ln') this.i++;
      return null;
    }

    // Collect expression tokens for RHS
    const exprTokens = [];
    let parenDepth = 0;
    while (this.i < this.T.length) {
      const tk = this.T[this.i];
      if (tk.t === '(' || tk.t === '{') parenDepth++;
      else if (tk.t === ')' || tk.t === '}') {
        if (parenDepth > 0) parenDepth--;
      }
      if (tk.t === 'ln' && parenDepth === 0) { this.i++; break; }
      if (tk.t === 'id' && (tk.v === 'local' || tk.v === 'if' || tk.v === 'end' || tk.v === 'function' || tk.v === 'else' || tk.v === 'elseif') && parenDepth === 0) break;
      exprTokens.push(tk);
      this.i++;
    }

    const valResult = this.parseExprTokens(exprTokens, false, declaredType);
    let resolvedType = declaredType;
    if (!resolvedType) {
      if (valResult.dataType) resolvedType = valResult.dataType;
      else if (valResult.isLit && typeof valResult.value === 'number') {
        resolvedType = String(valResult.value).includes('.') ? 'float' : 'int';
      } else {
        resolvedType = 'float';
      }
    }

    // 1. Create exec_set_local_var (the execution node in the flow chain)
    const setLocalNode = this.makeNode('exec_set_local_var', 'Set Local Variable', 'execution');
    setLocalNode.varName = varName;
    setLocalNode.dataType = resolvedType;
    if (declaredType) setLocalNode.declaredType = declaredType;
    const bpSet = getNodeBlueprint('exec_set_local_var');
    if (bpSet) applyDataTypeToNode(setLocalNode, bpSet, resolvedType);
    this.placeFlow(setLocalNode);
    this.nodes.push(setLocalNode);

    // Apply the RHS expression/value into Set Local Variable's "Value" pin
    this.applyValueTo(setLocalNode, 'Value', valResult);

    // 2. Create query_get_local_variable (holding hands via Local Variable pin)
    const getLocalNode = this.makeNode('query_get_local_variable', 'Get Local Variable', 'query');
    getLocalNode.varName = varName;
    getLocalNode.dataType = resolvedType;
    if (declaredType) getLocalNode.declaredType = declaredType;
    const bpGet = getNodeBlueprint('query_get_local_variable');
    if (bpGet) applyDataTypeToNode(getLocalNode, bpGet, resolvedType);

    // Position getLocalNode below/left of setLocalNode
    getLocalNode.x = setLocalNode.x - 260;
    getLocalNode.y = setLocalNode.y + 110;
    getLocalNode.inputValues['Initial Value'] = '0';
    this.nodes.push(getLocalNode);

    // Wire query_get_local_variable's "Local Variable" pin to exec_set_local_var's "Local Variable" pin
    this.wires.push({
      id: this.nextWireId(),
      fromNode: getLocalNode.id,
      fromPin: 'Local Variable',
      toNode: setLocalNode.id,
      toPin: 'Local Variable',
      isExec: false
    });

    this.varToLocalVar.set(varName, getLocalNode);
    this.varToNode.set(varName, getLocalNode.id);

    return setLocalNode;
  }

  parseAssignmentStmt(varName) {
    this.i++; // varName
    if (this.T[this.i]?.t === '=') this.i++;

    const exprTokens = [];
    let parenDepth = 0;
    while (this.i < this.T.length) {
      const tk = this.T[this.i];
      if (tk.t === '(' || tk.t === '{') parenDepth++;
      else if (tk.t === ')' || tk.t === '}') {
        if (parenDepth > 0) parenDepth--;
      }
      if (tk.t === 'ln' && parenDepth === 0) { this.i++; break; }
      if (tk.t === 'id' && (tk.v === 'local' || tk.v === 'if' || tk.v === 'end' || tk.v === 'function' || tk.v === 'else' || tk.v === 'elseif') && parenDepth === 0) break;
      exprTokens.push(tk);
      this.i++;
    }

    if (this.varToLocalVar.has(varName)) {
      const getLocalNode = this.varToLocalVar.get(varName);
      const valResult = this.parseExprTokens(exprTokens, false, getLocalNode.dataType);

      const setLocalNode = this.makeNode('exec_set_local_var', 'Set Local Variable', 'execution');
      setLocalNode.varName = varName;
      setLocalNode.dataType = getLocalNode.dataType;
      const bpSet = getNodeBlueprint('exec_set_local_var');
      if (bpSet) applyDataTypeToNode(setLocalNode, bpSet, setLocalNode.dataType);
      this.placeFlow(setLocalNode);
      this.nodes.push(setLocalNode);

      this.applyValueTo(setLocalNode, 'Value', valResult);
      this.wires.push({
        id: this.nextWireId(),
        fromNode: getLocalNode.id,
        fromPin: 'Local Variable',
        toNode: setLocalNode.id,
        toPin: 'Local Variable',
        isExec: false
      });
      return setLocalNode;
    }

    if (this.varToGraphVar.has(varName.toLowerCase()) || this.varToGraphVar.has(varName)) {
      const gv = this.varToGraphVar.get(varName.toLowerCase()) || this.varToGraphVar.get(varName);
      const valResult = this.parseExprTokens(exprTokens, false, gv.type);

      const setGvNode = this.makeNode('exec_set_node_graph_var', 'Set Node Graph Variable', 'execution');
      setGvNode.inputValues['Variable Name'] = gv.name;
      setGvNode.dataType = gv.type;
      const bp = getNodeBlueprint('exec_set_node_graph_var');
      if (bp) applyDataTypeToNode(setGvNode, bp, gv.type);
      this.placeFlow(setGvNode);
      this.nodes.push(setGvNode);

      this.applyValueTo(setGvNode, 'Variable Value', valResult);
      return setGvNode;
    }

    return null;
  }

  parseCustomVarAssignmentStmt() {
    const entityTk = this.T[this.i];
    this.i += 2; // skip entity and '.'
    const varTk = this.T[this.i];
    const varName = varTk ? varTk.v : 'Damage1';
    this.i++; // skip var name
    if (this.T[this.i]?.t === '=') this.i++;

    const exprTokens = [];
    let parenDepth = 0;
    while (this.i < this.T.length) {
      const tk = this.T[this.i];
      if (tk.t === '(' || tk.t === '{') parenDepth++;
      else if (tk.t === ')' || tk.t === '}') {
        if (parenDepth > 0) parenDepth--;
      }
      if (tk.t === 'ln' && parenDepth === 0) { this.i++; break; }
      if (tk.t === 'id' && (tk.v === 'local' || tk.v === 'if' || tk.v === 'end' || tk.v === 'function' || tk.v === 'else' || tk.v === 'elseif') && parenDepth === 0) break;
      exprTokens.push(tk);
      this.i++;
    }

    const cv = (this.customVariables || []).find(c => (c.name || '').toLowerCase() === varName.toLowerCase());
    const targetType = cv ? cv.type : 'float';

    let valResult = this.parseExprTokens(exprTokens, false, null);

    const valType = valResult.dataType || (valResult.isLit && typeof valResult.value === 'number' ? (String(valResult.value).includes('.') ? 'float' : 'int') : null);
    if (targetType === 'float' && valType === 'int') {
      valResult = this.createConversionNode(valResult, 'float');
    } else if (targetType === 'int' && valType === 'float') {
      valResult = this.createConversionNode(valResult, 'int');
    } else if (targetType === 'string' && valType && valType !== 'string') {
      valResult = this.createConversionNode(valResult, 'string');
    } else if (targetType === 'bool' && valType && valType !== 'bool') {
      valResult = this.createConversionNode(valResult, 'bool');
    }

    const setNode = this.makeNode('exec_set_custom_var', 'Set Custom Variable', 'execution');
    setNode.dataType = targetType;
    const bp = getNodeBlueprint('exec_set_custom_var');
    if (bp) applyDataTypeToNode(setNode, bp, targetType);

    setNode.inputValues['Variable Name'] = varName;
    setNode.inputValues['Trigger Event'] = 'No';

    this.placeFlow(setNode);
    this.nodes.push(setNode);

    if (entityTk.v === 'self') {
      const selfNode = this.makeNode('query_get_self_entity', 'Get Self Entity', 'query');
      selfNode.x = setNode.x - 300;
      selfNode.y = setNode.y - 140;
      this.nodes.push(selfNode);
      this.wires.push({
        id: this.nextWireId(),
        fromNode: selfNode.id,
        fromPin: 'Self Entity',
        toNode: setNode.id,
        toPin: 'Target Entity',
        isExec: false
      });
    } else if (this.guidEntities.has(entityTk.v.toLowerCase()) || entityTk.v === 'guid') {
      const guidVal = this.guidEntities.get(entityTk.v.toLowerCase()) || '1008221';
      const guidNode = this.makeNode('query_query_entity_by_guid', 'Query Entity by GUID', 'query');
      guidNode.x = setNode.x - 300;
      guidNode.y = setNode.y - 140;
      guidNode.inputValues['GUID'] = String(guidVal);
      this.nodes.push(guidNode);
      this.wires.push({
        id: this.nextWireId(),
        fromNode: guidNode.id,
        fromPin: 'Entity',
        toNode: setNode.id,
        toPin: 'Target Entity',
        isExec: false
      });
    } else if (this.varToNode.has(entityTk.v)) {
      const refNodeId = this.varToNode.get(entityTk.v);
      const refNode = this.nodes.find(n => n.id === refNodeId);
      this.wires.push({
        id: this.nextWireId(),
        fromNode: refNodeId,
        fromPin: this.dataOutputPin(refNode),
        toNode: setNode.id,
        toPin: 'Target Entity',
        isExec: false
      });
    }

    this.applyValueTo(setNode, 'Variable Value', valResult);

    return setNode;
  }

  parseStmt() {
    const r = this.readFn(this.T, this.i);
    this.i = r.end;
    const ann = this.readNodeId();
    if (!r.fn) return null;

    // If custom variables were declared at the top, they have already formed the authoritative
    // initialization sequence. Do not spawn duplicate initialization nodes for f.setCustomVar calls.
    if ((r.fn.startsWith('setCustomVar') || r.fn.startsWith('setCustomVariable')) && Array.isArray(this.customVariables) && this.customVariables.length > 0) {
      const g1Val = this.argToValue(r.groups[1] || []);
      const varName = g1Val.isLit ? String(g1Val.value) : '';
      if (!varName || this.customVariables.some(cv => (cv.name || '').toLowerCase() === varName.toLowerCase())) {
        return null;
      }
    }

    const ent = resolveNode(r.fn) || { name: r.fn, id: 'exec_' + r.fn, cat: 'execution' };
    const node = this.makeNode(ent.id, ent.name, ent.cat);
    if (ann && !this.takenIds.has(ann)) { node.id = ann; this.takenIds.add(ann); }
    if (ent.dataType) {
      node.dataType = ent.dataType;
      const bp = getNodeBlueprint(node.blueprintId) || getNodeBlueprint(node.name);
      if (bp) applyDataTypeToNode(node, bp, ent.dataType);
    }
    this.applyInputs(node, r.groups);
    this.placeFlow(node);
    this.nodes.push(node);
    return node;
  }

  parseIf() {
    this.i++; // 'if'

    let depth = 0;
    const condTokens = [];
    while (this.i < this.T.length) {
      const t = this.T[this.i];
      if (t.t === '(') depth++;
      else if (t.t === ')') depth--;
      if (t.t === 'id' && t.v === 'then' && depth === 0) { this.i++; break; }
      condTokens.push(t); this.i++;
    }

    // Standard Double Branch with rich expression parsing
    const node = this.makeNode('flow_double_branch', 'Double Branch', 'flow');
    const id = this.readNodeId();
    if (id && !this.takenIds.has(id)) { node.id = id; this.takenIds.add(id); }

    const condResult = this.parseExprTokens(condTokens, true);
    this.applyValueTo(node, 'Condition', condResult);
    this.placeFlow(node);
    this.nodes.push(node);

    // Layout adjustment:
    // Align Get Node Graph Variable -> Equal -> Double Branch horizontally
    if (condResult && condResult.node) {
      const eqNode = condResult.node;
      eqNode.x = node.x - 300;
      eqNode.y = node.y + 120;

      const feederWire = this.wires.find(w => !w.isExec && w.toNode === eqNode.id);
      if (feederWire) {
        const feederNode = this.nodes.find(n => n.id === feederWire.fromNode);
        if (feederNode) {
          feederNode.x = eqNode.x - 300;
          feederNode.y = eqNode.y;
        }
      }
    }

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

  parseBody() {
    const res = this.parseBlock();
    if (this.T[this.i]?.t === 'ln') this.i++;
    return res;
  }
}
