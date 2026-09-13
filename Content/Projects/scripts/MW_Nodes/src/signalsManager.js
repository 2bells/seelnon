/**
 * Signals Manager for Miliastra Wonderland Node Graph System
 * Stores and manages global signal definitions and their payload parameters.
 * Provides lookup, CRUD operations, reference tracking, and serialization.
 * Matches Miliastra Wonderland and genshin-ts signal architecture.
 */

// Mapping of signal data types to internal types and human-readable labels
export const SIGNAL_PARAM_TYPES = [
  { id: 'vec3', alias: 'vector3', label: '3D Vector', code: 12 },
  { id: 'bool', alias: 'bool', label: 'Boolean', code: 4 },
  { id: 'int', alias: 'int', label: 'Integer', code: 3 },
  { id: 'float', alias: 'float', label: 'Floating Point', code: 5 },
  { id: 'str', alias: 'string', label: 'String', code: 6 },
  { id: 'entity', alias: 'entity', label: 'Entity', code: 1 },
  { id: 'guid', alias: 'guid', label: 'GUID', code: 2 },
  { id: 'list', alias: 'list', label: 'List', code: 8 },
  { id: 'dict', alias: 'dict', label: 'Dictionary', code: 14 },
  { id: 'faction', alias: 'faction', label: 'Faction', code: 17 },
  { id: 'config_id', alias: 'config_id', label: 'Config ID', code: 20 },
  { id: 'prefab_id', alias: 'prefab_id', label: 'Prefab ID', code: 21 },
  { id: 'generic', alias: 'generic', label: 'Generic', code: 0 }
];

export function normalizeSignalType(type) {
  if (!type) return 'generic';
  const lower = String(type).toLowerCase().trim();
  for (const t of SIGNAL_PARAM_TYPES) {
    if (t.id === lower || t.alias === lower || t.label.toLowerCase() === lower) {
      return t.id;
    }
  }
  return 'generic';
}

export function getSignalTypeLabel(type) {
  const norm = normalizeSignalType(type);
  const found = SIGNAL_PARAM_TYPES.find(t => t.id === norm || t.alias === norm);
  return found ? found.label : 'Integer';
}

export function getPinTypeFromSignalType(type) {
  const norm = normalizeSignalType(type);
  const found = SIGNAL_PARAM_TYPES.find(t => t.id === norm);
  return found ? found.alias : 'generic';
}

export class SignalsManager {
  constructor() {
    this.listeners = new Set();
    
    // Initial global signals matching Miliastra Wonderland (as shown in the user's screenshot)
    this.signals = [
      {
        name: 'Ramlethal_Weapon',
        params: [
          { id: 'p_1', name: 'Damage', type: 'float' },
          { id: 'p_2', name: 'Hit_Type', type: 'int' }
        ],
        hasDot: false
      },
      {
        name: 'P1_P2',
        params: [
          { id: 'p_1', name: 'Player_Index', type: 'int' },
          { id: 'p_2', name: 'Ready', type: 'bool' }
        ],
        hasDot: false
      },
      {
        name: 'HC_Shot',
        params: [
          { id: 'p_1', name: 'Origin', type: 'vec3' },
          { id: 'p_2', name: 'Damage', type: 'float' }
        ],
        hasDot: false
      },
      {
        name: 'HC_Reload',
        params: [
          { id: 'p_1', name: 'Ammo_Count', type: 'int' }
        ],
        hasDot: false
      },
      {
        name: 'HC_Weapon',
        params: [
          { id: 'p_1', name: 'Locaiton', type: 'vec3' },
          { id: 'p_2', name: 'Light', type: 'bool' },
          { id: 'p_3', name: 'Heavy', type: 'bool' },
          { id: 'p_4', name: 'Parry', type: 'bool' },
          { id: 'p_5', name: 'Block_Counter', type: 'bool' },
          { id: 'p_6', name: 'Combo', type: 'bool' }
        ],
        hasDot: false
      },
      {
        name: '(1)',
        params: [
          { id: 'p_1', name: 'Trigger_Code', type: 'int' }
        ],
        hasDot: true
      },
      {
        name: '(2)',
        params: [
          { id: 'p_1', name: 'Target_Entity', type: 'entity' }
        ],
        hasDot: true
      },
      {
        name: '(3)',
        params: [
          { id: 'p_1', name: 'Active', type: 'bool' }
        ],
        hasDot: true
      },
      {
        name: 'Strike',
        params: [
          { id: 'p_1', name: 'Target_Entity', type: 'entity' },
          { id: 'p_2', name: 'Hit_Power', type: 'float' }
        ],
        hasDot: false
      }
    ];
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(eventType, data) {
    for (const listener of this.listeners) {
      try {
        listener(eventType, data);
      } catch (err) {
        console.error('SignalsManager listener error:', err);
      }
    }
  }

  getSignals() {
    return this.signals;
  }

  getSignal(name) {
    if (!name) return null;
    return this.signals.find(s => s.name === name) || null;
  }

  hasSignal(name) {
    return this.signals.some(s => s.name === name);
  }

  registerSignal(name, params = []) {
    if (!name) return null;
    let existing = this.signals.find(s => s.name === name);
    if (existing) {
      if (Array.isArray(params)) {
        params.forEach(p => {
          if (p && p.name && !existing.params.some(ep => ep.name === p.name)) {
            existing.params.push({
              id: p.id || `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: p.name,
              type: p.type || 'float'
            });
          }
        });
      }
      return existing;
    }
    const newSig = {
      name: name.trim(),
      params: (params || []).map((p, i) => ({
        id: p.id || `p_${Date.now()}_${i}`,
        name: p.name || `Param_${i + 1}`,
        type: p.type || 'float'
      })),
      hasDot: false
    };
    this.signals.push(newSig);
    this.notify('add', newSig);
    return newSig;
  }

  addSignal(name, params = [], hasDot = false) {
    let finalName = name ? name.trim() : '';
    if (!finalName) {
      let idx = 1;
      while (this.hasSignal(`Signal_${idx}`)) {
        idx++;
      }
      finalName = `Signal_${idx}`;
    }

    // Prevent name collisions
    if (this.hasSignal(finalName)) {
      let idx = 1;
      while (this.hasSignal(`${finalName}_${idx}`)) {
        idx++;
      }
      finalName = `${finalName}_${idx}`;
    }

    const newSignal = {
      name: finalName,
      params: params.map((p, i) => ({
        id: p.id || `p_${Date.now()}_${i}`,
        name: p.name || `Param_${i + 1}`,
        type: normalizeSignalType(p.type)
      })),
      hasDot
    };

    this.signals.push(newSignal);
    this.notify('signal_added', newSignal);
    return newSignal;
  }

  updateSignal(oldName, newName, params, hasDot = false) {
    const sig = this.getSignal(oldName);
    if (!sig) return null;

    let targetName = newName ? newName.trim() : oldName;
    if (targetName !== oldName && this.hasSignal(targetName)) {
      let idx = 1;
      while (this.hasSignal(`${targetName}_${idx}`)) {
        idx++;
      }
      targetName = `${targetName}_${idx}`;
    }

    sig.name = targetName;
    sig.hasDot = hasDot;
    sig.params = params.map((p, i) => ({
      id: p.id || `p_${Date.now()}_${i}`,
      name: p.name ? p.name.trim() : `Param_${i + 1}`,
      type: normalizeSignalType(p.type)
    }));

    this.notify('signal_updated', { oldName, signal: sig });
    return sig;
  }

  removeSignal(name) {
    const idx = this.signals.findIndex(s => s.name === name);
    if (idx !== -1) {
      const removed = this.signals.splice(idx, 1)[0];
      this.notify('signal_removed', removed);
      return true;
    }
    return false;
  }

  duplicateSignal(name) {
    const orig = this.getSignal(name);
    if (!orig) return null;

    let newName = `${orig.name}_Copy`;
    let count = 1;
    while (this.hasSignal(newName)) {
      count++;
      newName = `${orig.name}_Copy_${count}`;
    }

    const cloned = {
      name: newName,
      params: orig.params.map(p => ({
        id: `p_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: p.name,
        type: p.type
      })),
      hasDot: orig.hasDot
    };

    this.signals.push(cloned);
    this.notify('signal_added', cloned);
    return cloned;
  }

  /**
   * Finds all nodes in graphState referencing a signal name.
   */
  getSignalNodeReferences(signalName, graphState) {
    if (!graphState || !graphState.nodes) return [];
    return graphState.nodes.filter(node => {
      if (node.blueprintId === 'event_monitor_signal' || node.blueprintId === 'exec_send_signal') {
        const selectedSig = node.inputValues?.['Signal Name'] || node.inputValues?.['signalName'];
        return selectedSig === signalName;
      }
      return false;
    });
  }

  serialize() {
    return JSON.parse(JSON.stringify(this.signals));
  }

  deserialize(data) {
    if (Array.isArray(data)) {
      this.signals = data.map(item => ({
        name: item.name,
        params: (item.params || []).map(p => ({
          id: p.id || `p_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: p.name,
          type: normalizeSignalType(p.type)
        })),
        hasDot: !!item.hasDot
      }));
      this.notify('signals_reset', this.signals);
    }
  }
}

// Global Singleton Instance
export const signalsManager = new SignalsManager();
