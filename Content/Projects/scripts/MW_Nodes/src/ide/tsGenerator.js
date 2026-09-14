/**
 * genshin-ts TypeScript Code Generator
 * Walks the execution-flow graph and emits clean, idiomatic code with real
 * nested control flow (if/else, switch, call sequences) — not a flat node list.
 */

import { getNodeBlueprint } from '../nodesData.js';

const METHOD_MAP = {
  'when tab is selected': { event: 'whenTabIsSelected' },
  'when tab selected': { event: 'whenTabIsSelected' },
  'monitor signal': { event: 'monitorSignal' },
  'when custom variable changes': { event: 'whenCustomVariableChanges' },
  'when entity is created': { event: 'whenEntityIsCreated' },
  'when character dies': { event: 'whenCharacterDies' },
  'get custom variable': { fn: 'getCustomVariable' },
  'query entity by guid': { fn: 'queryEntityByGuid' },
  'get self entity': { fn: 'getSelfEntity' },
  'equal': { fn: 'equal' },
  'send signal': { fn: 'sendSignal' },
  'set custom variable': { fn: 'setCustomVariable' },
  'play timed effects': { fn: 'playTimedEffects' },
  'activate basic motion device': { fn: 'activateBasicMotionDevice' },
  'activate/disable tab': { fn: 'activateDisableTab' },
  'activate disable tab': { fn: 'activateDisableTab' },
  'set preset status': { fn: 'setPresetStatus' },
  'trigger event': { fn: 'triggerEvent' },
  'clear special effects based on special effect assets': { fn: 'clearSpecialEffectsBasedOnSpecialEffectAssets' },
  'mount looping special effect': { fn: 'mountLoopingSpecialEffect' },
  'list sorting': { fn: 'listSorting' }
};

export class TsGenerator {
  static generate(graphState) {
    const graphName = graphState.name || 'Open_Garage';
    const nodes = graphState.nodes || [];
    const wires = graphState.wires || [];
    const byId = new Map();
    nodes.forEach(n => byId.set(n.id, n));

    const eventNodes = nodes.filter(n =>
      n.category === 'event' ||
      n.blueprintId?.startsWith('event_') ||
      METHOD_MAP[n.name.toLowerCase()]?.event
    );

    // Data sources, topologically ordered so emits have no forward references.
    const dataOrder = this.topologicalDataNodes(nodes, wires);

    let code = `import { g, gsts } from 'genshin-ts';\n\n`;
    code += `/**\n * ${graphName} — generated from the Miliastra Wonderland node graph\n */\n\n`;

    if (eventNodes.length === 0) {
      code += `g.server({ name: '${graphName}' }).on('whenTabSelected', (event) => {\n`;
      code += this.emitBody(null, byId, wires, dataOrder);
      code += `});\n`;
      return code;
    }

    eventNodes.forEach((evNode) => {
      const mapping = METHOD_MAP[evNode.name.toLowerCase()];
      const eventName = mapping?.event || this.toCamelCase(evNode.name);
      const reach = this.reachable(evNode, byId, wires);
      const usedData = dataOrder.filter(id => reach.has(id));
      const param = eventName === 'monitorSignal' ? 'payload' : 'event';

      // Event data outputs (e.g. Signal Source Entity) used by this handler.
      const eventOutPins = [...new Set(
        wires.filter(w => !w.isExec && w.fromNode === evNode.id && reach.has(w.toNode)).map(w => w.fromPin)
      )];
      const ctx = { eventId: evNode.id, eventVarMap: new Map() };

      code += `// Event: ${evNode.name}\n`;
      code += `g.server({ name: '${graphName}' }).on('${eventName}', (${param}) => { // #${evNode.id}\n`;
      code += this.emitBody(evNode, byId, wires, usedData, param, eventOutPins, ctx);
      code += `});\n\n`;
    });

    return code.trimEnd() + '\n';
  }

  // Transitive closure over exec + data wires starting at a node, so data
  // consts only include what this event body actually references.
  static reachable(root, byId, wires) {
    const set = new Set([root.id]);
    const queue = [root.id];
    while (queue.length) {
      const id = queue.shift();
      // downstream exec/data targets
      wires.forEach(w => { if (w.fromNode === id && !set.has(w.toNode)) { set.add(w.toNode); queue.push(w.toNode); } });
      // data producers feeding this node
      wires.forEach(w => { if (w.toNode === id && !w.isExec && !set.has(w.fromNode)) { set.add(w.fromNode); queue.push(w.fromNode); } });
    }
    return set;
  }

  static topologicalDataNodes(nodes, wires) {
    const dataNodes = nodes.filter(n =>
      n.category === 'query' || n.blueprintId?.startsWith('query_') ||
      n.category === 'operation' || n.blueprintId?.startsWith('op_')
    );
    const producers = new Set(wires.filter(w => !w.isExec).map(w => w.fromNode));
    const needed = dataNodes.filter(n => producers.has(n.id));

    const indeg = new Map();
    const adj = new Map();
    needed.forEach(n => { indeg.set(n.id, 0); adj.set(n.id, []); });
    needed.forEach(n => {
      Object.keys(n.inputValues || {}).forEach(pin => {
        const w = wires.find(ww => !ww.isExec && ww.toNode === n.id && ww.toPin === pin);
        if (w && indeg.has(w.fromNode)) {
          adj.get(w.fromNode).push(n.id);
          indeg.set(n.id, indeg.get(n.id) + 1);
        }
      });
    });

    const queue = needed.filter(n => indeg.get(n.id) === 0);
    const order = [];
    while (queue.length) {
      const id = queue.shift();
      order.push(id);
      (adj.get(id) || []).forEach(dst => {
        indeg.set(dst, indeg.get(dst) - 1);
        if (indeg.get(dst) === 0) queue.push(dst);
      });
    }
    needed.forEach(n => { if (!order.includes(n.id)) order.push(n.id); });
    return order;
  }

  static emitBody(eventNode, byId, wires, dataOrder, param, eventOutPins, ctx) {
    const indent = '  ';
    let out = '';
    const varMap = new Map();
    let vc = 1;
    const visited = new Set();

    // 0) Event data outputs as consts referencing the handler param.
    if (eventOutPins && eventOutPins.length) {
      eventOutPins.forEach(pin => {
        const vn = `${this.safeVar(pin) || 'event'}_${vc++}`;
        ctx.eventVarMap.set(pin, vn);
        out += `${indent}const ${vn} = ${param}; // ${pin}\n`;
      });
      out += `\n`;
    }

    // 1) Data sources as consts (topological, no forward refs).
    for (const id of dataOrder) {
      const node = byId.get(id);
      if (!node) continue;
      const mapping = METHOD_MAP[node.name.toLowerCase()];
      const fn = mapping?.fn || this.toCamelCase(node.name);
      const vn = `${this.safeVar(fn) || 'value'}_${vc++}`;
      varMap.set(id, vn);
      out += `${indent}const ${vn} = gsts.f.${fn}(${this.args(node, wires, varMap, ctx)}); // #${id}\n`;
    }
    if (dataOrder.length) out += `\n`;

    // 2) Walk exec-flow out of the event node.
    const starts = eventNode
      ? wires.filter(w => w.isExec && w.fromNode === eventNode.id).map(w => w.toNode)
      : [];
    (starts.length ? starts : [null]).forEach(t => {
      out += this.walkExec(t, indent, byId, wires, varMap, visited, ctx);
    });

    if (!out.trim()) out += `${indent}// (empty graph — no execution steps)\n`;
    return out;
  }

  static walkExec(nodeId, indent, byId, wires, varMap, visited, ctx) {
    if (!nodeId || visited.has(nodeId)) return '';
    visited.add(nodeId);
    const node = byId.get(nodeId);
    if (!node) return '';

    const id = node.blueprintId || '';
    const name = (node.name || '').toLowerCase();

    if (id === 'flow_double_branch' || name === 'double branch') {
      const cond = this.cond(node, wires, varMap, ctx);
      const yes = this.execTargets(node, wires, 'Yes');
      const no = this.execTargets(node, wires, 'No');
      let s = `${indent}if (${cond}) { // #${node.id}\n`;
      for (const t of yes) s += this.walkExec(t, indent + '  ', byId, wires, varMap, visited, ctx);
      s += `${indent}} else {\n`;
      for (const t of no) s += this.walkExec(t, indent + '  ', byId, wires, varMap, visited, ctx);
      s += `${indent}}\n`;
      s += this.walkContinuation(node, indent, byId, wires, varMap, visited, ctx);
      return s;
    }

    if (id === 'flow_multiple_branches' || name === 'multiple branches') {
      const cond = this.cond(node, wires, varMap, ctx);
      const entries = this.execBranchPins(node, wires).filter(e => e.pin !== 'Default');
      let s = `${indent}switch (${cond}) { // #${node.id}\n`;
      for (const { pin, target } of entries) {
        s += `${indent}  case '${pin}': {\n`;
        for (const t of this.orderedTargets(node, wires, pin, target)) {
          s += this.walkExec(t, indent + '    ', byId, wires, varMap, visited, ctx);
        }
        s += `${indent}    break;\n${indent}  }\n`;
      }
      const dflt = this.execTarget(node, wires, 'Default');
      if (dflt) {
        s += `${indent}  default: {\n`;
        s += this.walkExec(dflt, indent + '    ', byId, wires, varMap, visited, ctx);
        s += `${indent}    break;\n${indent}  }\n`;
      }
      s += `${indent}}\n`;
      return s;
    }

    // Regular execution node: imperative call, then follow every parallel exec child in order.
    const call = this.call(node, wires, varMap, ctx);
    let out = `${indent}${call}; // #${node.id}\n`;
    for (const t of this.execTargets(node, wires)) {
      out += this.walkExec(t, indent, byId, wires, varMap, visited, ctx);
    }
    return out;
  }

  static walkContinuation(node, indent, byId, wires, varMap, visited, ctx) {
    const cont = this.execTarget(node, wires, undefined, ['Yes', 'No']);
    return cont ? this.walkExec(cont, indent, byId, wires, varMap, visited, ctx) : '';
  }

  static execTarget(node, wires, pin, excludePins) {
    const w = wires.find(ww =>
      ww.isExec && ww.fromNode === node.id &&
      (pin ? ww.fromPin === pin : true) &&
      (!excludePins || !excludePins.includes(ww.fromPin))
    );
    return w ? w.toNode : null;
  }

  // All outgoing exec targets for a node/pin, in .gia connection order (state.wires order).
  // Parallel connections from one socket therefore execute sequentially, in order.
  static execTargets(node, wires, pin) {
    return wires
      .filter(w => w.isExec && w.fromNode === node.id && (pin ? w.fromPin === pin : true))
      .map(w => w.toNode);
  }

  // Re-derive the ordered target list for a branch pin given the known first target.
  static orderedTargets(node, wires, pin, first) {
    return this.execTargets(node, wires, pin);
  }

  static execBranchPins(node, wires) {
    const map = new Map();
    wires.forEach(w => { if (w.isExec && w.fromNode === node.id) map.set(w.fromPin, w.toNode); });
    return [...map.entries()]
      .filter(([pin]) => pin)
      .map(([pin, target]) => ({ pin, target }));
  }

  static cond(node, wires, varMap, ctx) {
    const w = wires.find(ww =>
      !ww.isExec && ww.toNode === node.id &&
      (ww.toPin === 'Condition' || ww.toPin === 'Control Expression' || ww.toPin === 'control expression')
    );
    if (w && ctx && w.fromNode === ctx.eventId) return ctx.eventVarMap.get(w.fromPin) ?? 'event';
    if (w && varMap.has(w.fromNode)) return varMap.get(w.fromNode);
    const lit = node.inputValues?.['Condition'] ?? node.inputValues?.['Control Expression'] ?? null;
    if (lit != null) return this.literal(lit);
    return 'true';
  }

  static call(node, wires, varMap, ctx) {
    const mapping = METHOD_MAP[node.name.toLowerCase()];
    const fn = mapping?.fn || this.toCamelCase(node.name);
    const args = this.args(node, wires, varMap, ctx);
    return `gsts.f.${fn}(${args})`;
  }

  static args(node, wires, varMap, ctx) {
    const iv = node.inputValues || {};
    const isSignal = node.blueprintId === 'exec_send_signal' || node.blueprintId === 'event_monitor_signal';

    // Emit only *known* input pins, in blueprint order — never stray keys left
    // over from previous code↔graph cycles (prevents pin inflation on nodes like
    // Activate/Disable Tab that gain spurious `param_N` entries).
    const pinDefs = this.knownPins(node);
    let orderedKeys;
    if (isSignal) {
      const nameKeys = [];
      const sigName = iv['Signal Name'] ?? node.signalName;
      pinDefs.forEach(p => { if (p !== 'Signal Name') nameKeys.push(p); });
      if (iv['Signal Name'] === undefined && sigName != null) {
        orderedKeys = [['__signalName__', sigName], ...nameKeys.map(p => [p, iv[p]])];
      } else {
        orderedKeys = [['Signal Name', iv['Signal Name']], ...nameKeys.map(p => [p, iv[p]])];
      }
    } else {
      orderedKeys = pinDefs.map(p => [p, iv[p]]);
    }

    const args = [];
    orderedKeys.forEach(([p, val]) => {
      const w = wires.find(ww => !ww.isExec && ww.toNode === node.id && ww.toPin === p && p !== '__signalName__');
      if (w && ctx && w.fromNode === ctx.eventId) { args.push(ctx.eventVarMap.get(w.fromPin) ?? 'event'); return; }
      if (w && varMap.has(w.fromNode)) { args.push(varMap.get(w.fromNode)); return; }
      // Always emit every known pin (falling back to its default), so boolean
      // and numeric inputs are always present & editable instead of vanishing.
      // Values are emitted type-aware: bools stay 0/1, strings stay quoted.
      args.push(this.renderValue(node, p, val !== undefined ? val : this.defaultValueForPin(node, p)));
    });
    return args.join(', ');
  }

  static inputType(node, p) {
    const bp = getNodeBlueprint(node.blueprintId) || getNodeBlueprint(node.name);
    if (bp && Array.isArray(bp.inputs)) {
      const inp = bp.inputs.find(i => i.name === p);
      if (inp && inp.type) return inp.type;
    }
    return null;
  }

  static renderValue(node, p, val) {
    const type = this.inputType(node, p);
    if (type === 'bool') return this.boolLit(val);
    if (type === 'string') return JSON.stringify(String(val == null ? '' : val));
    return this.literal(val);
  }

  static boolLit(v) {
    const s = String(v).trim().toLowerCase();
    return (s === '1' || s === 'true' || s === 'yes' || s === 'on') ? '1' : '0';
  }

  static defaultValueForPin(node, p) {
    const bp = getNodeBlueprint(node.blueprintId) || getNodeBlueprint(node.name);
    if (bp && Array.isArray(bp.inputs)) {
      const inp = bp.inputs.find(i => i.name === p);
      if (inp && inp.defaultVal !== undefined) return inp.defaultVal;
    }
    return '';
  }

  // Authoritative pin list for a node: blueprint inputs + dynamic inputs, in order.
  static knownPins(node) {
    const bp = getNodeBlueprint(node.blueprintId) || getNodeBlueprint(node.name);
    const pins = [];
    const seen = new Set();
    if (bp && Array.isArray(bp.inputs)) {
      for (const inp of bp.inputs) {
        if (!seen.has(inp.name)) { seen.add(inp.name); pins.push(inp.name); }
      }
    }
    if (Array.isArray(node.dynamicInputs)) {
      for (const d of node.dynamicInputs) {
        const p = String(d);
        if (!seen.has(p)) { seen.add(p); pins.push(p); }
      }
    }
    return pins;
  }

  static literal(val) {
    if (val == null || val === '') return '0';
    if (val === true || val === 'True' || val === 'true' || val === 'Yes' || val === '1' || val === 1) return '1';
    if (val === false || val === 'False' || val === 'false' || val === 'No' || val === '0' || val === 0) return '0';
    // Object-form vector (from .gia or the graph): emit as { x, y, z }.
    if (typeof val === 'object' && val !== null && (val.x !== undefined)) {
      return `{ x: ${Number(val.x) || 0}, y: ${Number(val.y) || 0}, z: ${Number(val.z) || 0 } }`;
    }
    if (typeof val === 'string' && val.startsWith('(') && val.endsWith(')')) {
      const parts = val.slice(1, -1).split(',').map(s => Number(s.trim()) || 0);
      return `{ x: ${parts[0] || 0}, y: ${parts[1] || 0}, z: ${parts[2] || 0} }`;
    }
    if (typeof val === 'number' || (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val)))) {
      return String(val).trim();
    }
    return JSON.stringify(String(val));
  }

  static safeVar(s) {
    return String(s || '').replace(/[^a-zA-Z0-9_$]/g, '').replace(/^(\d)/, '_$1');
  }

  static toCamelCase(str) {
    if (!str) return 'nodeAction';
    return str
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
      .replace(/^[A-Z]/, chr => chr.toLowerCase());
  }
}