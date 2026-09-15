/**
 * Miliastra Wonderland Execution Simulator
 * Simulates signal flow, evaluates data pins, logs execution, and animates wire pulses.
 */

import { signalsManager } from './signalsManager.js';

export class GraphSimulator {
  constructor(graphState, renderer) {
    this.state = graphState;
    this.renderer = renderer;
    this.isRunning = false;
    this.logs = [];
    this.logListeners = new Set();
    this.loopBreakFlags = new Map();
  }

  onLog(listener) {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  log(msg, type = 'info') {
    const entry = {
      time: new Date().toLocaleTimeString(),
      msg,
      type
    };
    this.logs.push(entry);
    for (const l of this.logListeners) {
      l(entry, this.logs);
    }
  }

  clearLogs() {
    this.logs = [];
    for (const l of this.logListeners) {
      l(null, this.logs);
    }
  }

  async runSimulation() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.simulatedState = {
      presetStates: {},
      tabStates: {},
      signalsEmitted: [],
      printedStrings: [],
      variables: {}
    };
    this.log(`[Miliastra Engine] Initializing Server Node Graph execution context: "${this.state.name}"`, 'system');

    // 1. Find root Event nodes
    const eventNodes = this.state.nodes.filter(n => n.category === 'event');
    if (eventNodes.length === 0) {
      this.log('[Warning] No Event Node found in graph to trigger execution flow.', 'warn');
      this.isRunning = false;
      window.dispatchEvent(new CustomEvent('miliastra_simulation_completed', { 
        detail: { simulatedState: this.simulatedState, graphName: this.state.name } 
      }));
      return;
    }

    for (const evNode of eventNodes) {
      this.log(`[Event Triggered] >> "${evNode.name}"`, 'event');
      await this.highlightNode(evNode.id);
      await this.stepExec(evNode.id, 'execOut');
    }

    this.log(`[Miliastra Engine] Execution complete for "${this.state.name}". All branches settled.`, 'success');
    this.isRunning = false;
    window.dispatchEvent(new CustomEvent('miliastra_simulation_completed', { 
      detail: { simulatedState: this.simulatedState, graphName: this.state.name } 
    }));
  }

  async stepExec(fromNodeId, fromPinName) {
    // Find outgoing exec wires
    const wires = this.state.wires.filter(w => w.fromNode === fromNodeId && w.fromPin === fromPinName && w.isExec);

    for (const wire of wires) {
      await this.animateWirePulse(wire.id);
      const targetNode = this.state.nodes.find(n => n.id === wire.toNode);
      if (!targetNode) continue;

      await this.highlightNode(targetNode.id);
      await this.executeNodeLogic(targetNode);
    }
  }

  async executeNodeLogic(node) {
    this.log(`[Executing] "${node.name}"`, 'exec');

    if (node.blueprintId === 'exec_activate_disable_tab') {
      const tabId = node.inputValues['Tab ID'] || '1';
      const activate = node.inputValues['Activate'] || 'Yes';
      const target = this.resolveInputData(node.id, 'Target Entity') || 'Self Entity';
      this.log(` → Setting Tab ID [${tabId}] on [${target}] to [${activate}]`, 'action');
      await this.sleep(250);
      await this.stepExec(node.id, 'execOut');
    } 
    else if (node.blueprintId === 'flow_double_branch') {
      const cond = this.resolveInputData(node.id, 'Condition');
      const isTrue = cond === true || cond === 'True' || cond === '1' || cond === 1;
      this.log(` → Evaluating Double Branch Condition: [${isTrue ? 'TRUE' : 'FALSE'}]`, isTrue ? 'success' : 'warn');
      await this.sleep(250);
      if (isTrue) {
        this.log(` → Taking branch [Yes]`, 'branch');
        await this.stepExec(node.id, 'Yes');
      } else {
        this.log(` → Taking branch [No]`, 'branch');
        await this.stepExec(node.id, 'No');
      }
    }
    else if (node.blueprintId === 'flow_multiple_branches') {
      // 1. Resolve Control Expression
      const ctrlType = this.state.getPinType(node.id, 'Control Expression', 'generic');
      let ctrlVal = this.resolveInputData(node.id, 'Control Expression');
      if (ctrlVal === null || ctrlVal === undefined || ctrlVal === '') {
        ctrlVal = (node.inputValues && node.inputValues['Control Expression'] !== undefined) 
          ? node.inputValues['Control Expression'] 
          : '0';
      }

      this.log(` → Evaluating Multiple Branches: Control Expression = [${ctrlVal}] (${ctrlType})`, 'exec');
      await this.sleep(250);

      // 2. Iterate through each dynamic branch and check against input
      const branches = (node.dynamicBranches || ['Branch 0', 'Branch 1', 'Branch 2', 'Default']).filter(b => b !== 'Default');
      let matchedBranch = null;

      for (const bName of branches) {
        const branchTargetVal = (node.branchValues && node.branchValues[bName] !== undefined) 
          ? node.branchValues[bName] 
          : '';

        // Check if control expression matches branch condition
        const isMatch = (String(ctrlVal).trim().toLowerCase() === String(branchTargetVal).trim().toLowerCase()) ||
          (!isNaN(Number(ctrlVal)) && !isNaN(Number(branchTargetVal)) && Number(ctrlVal) === Number(branchTargetVal) && branchTargetVal !== '');

        this.log(`   • Branch [${bName}] ("${branchTargetVal}") check against [${ctrlVal}]: ${isMatch ? 'MATCH ✓' : 'NO'}`, isMatch ? 'success' : 'info');

        if (isMatch) {
          matchedBranch = bName;
          break;
        }
      }

      if (matchedBranch) {
        this.log(` → Branch matched: [${matchedBranch}]. Firing execution flow!`, 'branch');
        await this.stepExec(node.id, matchedBranch);
      } else {
        this.log(` → No branch matched. Taking fallback [Default] branch!`, 'warn');
        await this.stepExec(node.id, 'Default');
      }
    }
    else if (node.blueprintId === 'exec_break_loop') {
      this.log(` → Break Loop executed. Locating target loop node connected to Break Loop pin...`, 'warn');
      const breakWire = this.state.wires.find(w => w.fromNode === node.id && w.fromPin === 'execOut' && w.isExec);
      if (breakWire && breakWire.toPin === 'Break Loop') {
        this.log(`   • Target loop [${breakWire.toNode}] signaled to break!`, 'success');
        this.loopBreakFlags.set(breakWire.toNode, true);
      }
      await this.sleep(200);
      await this.stepExec(node.id, 'execOut');
    }
    else if (node.blueprintId === 'exec_finite_loop') {
      const startVal = parseInt(node.inputValues['Start'] || '0', 10);
      const endVal = parseInt(node.inputValues['End'] || '3', 10);
      this.log(` → Starting Finite Loop from [${startVal}] to [${endVal}]`, 'exec');
      this.loopBreakFlags.set(node.id, false);

      for (let i = startVal; i <= endVal; i++) {
        if (this.loopBreakFlags.get(node.id)) {
          this.log(` → Finite Loop broken early at iteration [${i}]!`, 'warn');
          break;
        }
        node.currentIterationValue = i;
        this.log(`   • Finite Loop Iteration [${i}]`, 'info');
        await this.sleep(150);
        await this.stepExec(node.id, 'Loop Body');
      }

      this.log(` → Finite Loop completed. Executing [Loop Complete]`, 'success');
      await this.sleep(200);
      await this.stepExec(node.id, 'Loop Complete');
    }
    else if (node.blueprintId === 'exec_list_iteration_loop') {
      const listData = this.resolveInputData(node.id, 'List') || ['Item_0', 'Item_1', 'Item_2'];
      const items = Array.isArray(listData) ? listData : [listData];
      this.log(` → Starting List Iteration Loop over [${items.length}] items`, 'exec');
      this.loopBreakFlags.set(node.id, false);

      for (let idx = 0; idx < items.length; idx++) {
        if (this.loopBreakFlags.get(node.id)) {
          this.log(` → List Iteration Loop broken early at index [${idx}]!`, 'warn');
          break;
        }
        node.currentIterationValue = items[idx];
        this.log(`   • List Loop Item [${idx}]: ${items[idx]}`, 'info');
        await this.sleep(150);
        await this.stepExec(node.id, 'Loop Body');
      }

      this.log(` → List Iteration Loop completed. Executing [Loop Complete]`, 'success');
      await this.sleep(200);
      await this.stepExec(node.id, 'Loop Complete');
    }
    else if (node.blueprintId === 'exec_send_signal') {
      const sigName = node.inputValues['Signal Name'] || '';
      const sigDef = signalsManager.getSignal(sigName);
      const payload = {};
      if (sigDef && sigDef.params) {
        for (const p of sigDef.params) {
          const val = this.resolveInputData(node.id, p.name);
          payload[p.name] = val !== null && val !== undefined ? val : (node.inputValues[p.name] || '(default)');
        }
      }

      this.log(`📡 Broadcast Signal [${sigName}] fired with payload: ${JSON.stringify(payload)}`, 'signal');
      await this.sleep(200);

      // Trigger any Monitor Signal nodes in the graph listening to this signal
      const monitorNodes = this.state.nodes.filter(n => 
        n.blueprintId === 'event_monitor_signal' && 
        (n.inputValues['Signal Name'] || '') === sigName
      );

      for (const mNode of monitorNodes) {
        mNode.receivedSignalPayload = payload;
        this.log(`   • Monitor Signal [${mNode.id}] triggered by broadcast "${sigName}"!`, 'success');
        this.stepExec(mNode.id, 'execOut');
      }

      await this.stepExec(node.id, 'execOut');
    }
    else if (node.blueprintId === 'exec_set_local_var') {
      const val = this.resolveInputData(node.id, 'Value');
      this.log(` → Setting Local Variable to value: [${val}]`, 'exec');

      const varWire = this.state.wires.find(w => w.toNode === node.id && w.toPin === 'Local Variable' && !w.isExec);
      if (varWire) {
        const getVarNode = this.state.nodes.find(n => n.id === varWire.fromNode && n.blueprintId === 'query_get_local_variable');
        if (getVarNode) {
          getVarNode.cachedValue = val;
          this.log(`   • Synchronized with Get Local Variable [${getVarNode.id}], cached value = [${val}]`, 'success');
        }
      }

      await this.sleep(200);
      await this.stepExec(node.id, 'execOut');
    }
    else if (node.blueprintId === 'exec_set_the_preset_status_value_of_the_complex_creation') {
      const target = this.resolveInputData(node.id, 'Target Entity') || 'Door_Entity_1001';
      const presetIdx = this.resolveInputData(node.id, 'Preset Status Index') || node.inputValues?.['Preset Status Index'] || '10002032';
      const presetVal = this.resolveInputData(node.id, 'Preset Status Value') || node.inputValues?.['Preset Status Value'] || '1';
      this.log(` → Setting Preset Status Index [${presetIdx}] on [${target}] to Value [${presetVal}]`, 'action');
      if (!this.simulatedState) this.simulatedState = { presetStates: {}, tabStates: {}, signalsEmitted: [], printedStrings: [], variables: {} };
      if (!this.simulatedState.presetStates) this.simulatedState.presetStates = {};
      this.simulatedState.presetStates[String(presetIdx)] = Number(presetVal);
      this.log(`   • [Preset Status Updated] Index ${presetIdx} = State ${presetVal}`, 'success');
      await this.sleep(250);
      await this.stepExec(node.id, 'execOut');
    }
    else if (node.blueprintId === 'exec_print_string') {
      const str = node.inputValues['String'] || 'Hello Teyvat';
      this.log(`[Print String Log] "${str}"`, 'print');
      if (!this.simulatedState) this.simulatedState = { presetStates: {}, tabStates: {}, signalsEmitted: [], printedStrings: [], variables: {} };
      if (!this.simulatedState.printedStrings) this.simulatedState.printedStrings = [];
      this.simulatedState.printedStrings.push(str);
      await this.sleep(200);
      await this.stepExec(node.id, 'execOut');
    }
    else {
      // Generic execution pass-through
      await this.sleep(200);
      await this.stepExec(node.id, 'execOut');
    }
  }

  resolveInputData(nodeId, pinName) {
    const wire = this.state.wires.find(w => w.toNode === nodeId && w.toPin === pinName && !w.isExec);
    if (!wire) {
      const node = this.state.nodes.find(n => n.id === nodeId);
      return node ? node.inputValues[pinName] : null;
    }

    const srcNode = this.state.nodes.find(n => n.id === wire.fromNode);
    if (!srcNode) return null;

    if (srcNode.blueprintId === 'event_when_tab_selected') {
      if (wire.fromPin === 'Tab ID') return srcNode.inputValues?.['Tab ID'] || 1;
      if (wire.fromPin === 'Target Entity') return 'Door_Entity_1001';
      if (wire.fromPin === 'Target GUID') return '10002032';
      if (wire.fromPin === 'Trigger Entity') return 'Player_Entity_Local';
    }

    if (srcNode.blueprintId === 'event_monitor_signal') {
      if (srcNode.receivedSignalPayload && srcNode.receivedSignalPayload[wire.fromPin] !== undefined) {
        return srcNode.receivedSignalPayload[wire.fromPin];
      }
      if (wire.fromPin === 'Signal Source Entity') return 'Player_1';
      if (wire.fromPin === 'Event Source Entity') return 'Entity_Stage_1001';
      if (wire.fromPin === 'Event Source GUID') return 'GUID_84920491';
      return '(signal_data)';
    }

    if (srcNode.blueprintId === 'op_equal') {
      const v1 = srcNode.inputValues['Input 1'] || '1';
      const v2 = srcNode.inputValues['Input 2'] || '1';
      return v1 === v2;
    }
    if (srcNode.blueprintId === 'op_addition') {
      const v1 = parseFloat(srcNode.inputValues['Input 1'] || '0');
      const v2 = parseFloat(srcNode.inputValues['Input 2'] || '0');
      return v1 + v2;
    }
    if (srcNode.blueprintId === 'query_get_local_variable' && pinName === 'Value') {
      if (srcNode.cachedValue !== undefined) {
        return srcNode.cachedValue;
      }
      return srcNode.inputValues['Initial Value'] || '0';
    }
    if (srcNode.blueprintId === 'query_query_entity_by_guid') {
      const guid = srcNode.inputValues['GUID'] || srcNode.inputValues['Entity GUID'] || '1077936132';
      return `Entity_[GUID:${guid}]`;
    }
    if (srcNode.blueprintId === 'query_get_self_entity') {
      return 'Player_Entity_Local[GUID:8044192]';
    }
    if (srcNode.blueprintId === 'exec_finite_loop' && pinName === 'Current') {
      return srcNode.currentIterationValue !== undefined ? srcNode.currentIterationValue : 0;
    }
    if (srcNode.blueprintId === 'exec_list_iteration_loop' && pinName === 'Value') {
      return srcNode.currentIterationValue !== undefined ? srcNode.currentIterationValue : 'Item_0';
    }

    return `Value_From_${srcNode.name}`;
  }

  highlightNode(nodeId) {
    return new Promise(resolve => {
      const el = this.renderer.container.querySelector(`.miliastra-node[data-node-id="${nodeId}"]`);
      if (el) {
        el.classList.add('node-sim-active');
        setTimeout(() => {
          el.classList.remove('node-sim-active');
          resolve();
        }, 350);
      } else {
        resolve();
      }
    });
  }

  animateWirePulse(wireId) {
    return new Promise(resolve => {
      const pathEl = this.renderer.svgLayer.querySelector(`path[data-wire-id="${wireId}"]`);
      if (pathEl) {
        pathEl.classList.add('wire-sim-pulse');
        setTimeout(() => {
          pathEl.classList.remove('wire-sim-pulse');
          resolve();
        }, 300);
      } else {
        resolve();
      }
    });
  }

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}
