/**
 * genshin-ts TypeScript Code Generator
 * Walks the execution-flow graph and emits clean, idiomatic code with real
 * nested control flow (if/else, switch, call sequences) — not a flat node list.
 */

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
      code += `g.server({ name: '${graphName}' }).on('${eventName}', (${param}) => {\n`;
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
      out += `${indent}const ${vn} = gsts.f.${fn}(${this.args(node, wires, varMap, ctx)});\n`;
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
      const yes = this.execTarget(node, wires, 'Yes');
      const no = this.execTarget(node, wires, 'No');
      let s = `${indent}if (${cond}) {\n`;
      s += this.walkExec(yes, indent + '  ', byId, wires, varMap, visited, ctx);
      s += `${indent}} else {\n`;
      s += this.walkExec(no, indent + '  ', byId, wires, varMap, visited, ctx);
      s += `${indent}}\n`;
      s += this.walkContinuation(node, indent, byId, wires, varMap, visited, ctx);
      return s;
    }

    if (id === 'flow_multiple_branches' || name === 'multiple branches') {
      const cond = this.cond(node, wires, varMap, ctx);
      const entries = this.execBranchPins(node, wires).filter(e => e.pin !== 'Default');
      let s = `${indent}switch (${cond}) {\n`;
      for (const { pin, target } of entries) {
        s += `${indent}  case '${pin}': {\n`;
        s += this.walkExec(target, indent + '    ', byId, wires, varMap, visited, ctx);
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

    // Regular execution node: imperative call, then follow the exec chain.
    const call = this.call(node, wires, varMap, ctx);
    let out = `${indent}${call};\n`;
    out += this.walkExec(this.execTarget(node, wires), indent, byId, wires, varMap, visited, ctx);
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
    const args = [];
    Object.keys(node.inputValues || {}).forEach(p => {
      const w = wires.find(ww => !ww.isExec && ww.toNode === node.id && ww.toPin === p);
      if (w && ctx && w.fromNode === ctx.eventId) { args.push(ctx.eventVarMap.get(w.fromPin) ?? 'event'); return; }
      if (w && varMap.has(w.fromNode)) { args.push(varMap.get(w.fromNode)); return; }
      args.push(this.literal(node.inputValues[p]));
    });
    return args.join(', ');
  }

  static literal(val) {
    if (val == null || val === '') return '0';
    if (val === true || val === 'True' || val === '1' || val === 1) return '1';
    if (val === false || val === 'False' || val === '0' || val === 0) return '0';
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