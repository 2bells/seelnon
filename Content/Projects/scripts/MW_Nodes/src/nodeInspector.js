/**
 * NODE INSPECTOR MODAL & EXPLODED BLUEPRINT VIEWER
 * Authentic brutalist interface replicating the Miliastra system.
 * Features an on-demand interactive inspector:
 * - Default: Clean, focused Node Function & Overview
 * - Pin Click: Focused connector specifications (isolating the selected pin)
 * - Type Pill Click ([entity], [vector3], etc.): Full Miliastra Data Types Cheatsheet
 * - Big Node Click: Returns to Node Function view
 */

import { CATEGORIES, PIN_COLORS, DATA_TYPES, getAllNodes, getNodeBlueprint } from './nodesData.js';

let windowZIndexCounter = 350;

/**
 * Standard pin knowledge dictionary for Miliastra node graphs
 */
export const PIN_KNOWLEDGE_BASE = {
  // Common Entity & Graph Pins
  'event source entity': {
    desc: 'The primary Entity (Character, Stage Object, Mechanism, or Player) that owns this Node Graph or originated the event.',
    usage: 'Connect to query nodes (e.g. Get Entity Position) or action nodes (e.g. Deal Damage, Add Status) to act upon the event origin.'
  },
  'event source guid': {
    desc: 'The unique global 64-bit identifier string (GUID) of the entity executing or receiving this graph event.',
    usage: 'Useful for dictionary lookups, multiplayer synchronization, and target verification.'
  },
  'triggering entity': {
    desc: 'The Entity that actively caused or initiated this interaction (e.g. the player who pressed interact or entered a trigger zone).',
    usage: 'Use to verify if the interactor is a player or specific faction.'
  },
  'target entity': {
    desc: 'The destination Entity upon which this action, status modification, query, or damage will be applied.',
    usage: 'Pass player entities, stage mechanisms, or monster entities.'
  },
  'target player': {
    desc: 'The specific Player Entity receiving the notification, camera control, UI screen, or inventory reward.',
    usage: 'Defaults to the triggering player if left blank.'
  },

  // Variable Pins
  'variable name': {
    desc: 'Identifier name of the variable (Custom Variable or Node Graph Variable) being read or written.',
    usage: 'Must match the key defined in the Node Graph Variables dock or Entity custom variables.'
  },
  'pre-change value': {
    desc: 'The value contained in the variable immediately before this change event was dispatched.',
    usage: 'Compare against Post-Change Value to detect delta increments or state transitions.'
  },
  'post-change value': {
    desc: 'The updated new value stored in the variable after the modification was committed.',
    usage: 'Pass directly into downstream logic calculations or branch evaluations.'
  },
  'local variable': {
    desc: 'Reference handle to a scoped local variable allocated in this graph execution thread.',
    usage: 'Connect to Set Local Variable or Get Local Variable nodes.'
  },
  'value': {
    desc: 'Primary data payload consumed by this node to perform its calculation or state change.',
    usage: 'Accepts literals, constants, or data outputs from upstream Query nodes.'
  },
  'result': {
    desc: 'The computed output or extracted data returned by this node for downstream consumption.',
    usage: 'Wire to arithmetic, logic branches, or execution parameter inputs.'
  },

  // Flow & Loop Pins
  'execution in': {
    desc: 'Control signal input. When receiving execution pulse from an upstream node, this node activates.',
    usage: 'Triggers node evaluation.'
  },
  'execution out': {
    desc: 'Standard control signal output. Fires immediately upon successful completion of this node’s task.',
    usage: 'Connect to the next action or query in the sequence.'
  },
  'loop start value': {
    desc: 'Starting integer index for the finite loop sequence (inclusive).',
    usage: 'Usually set to 1 or 0.'
  },
  'loop end value': {
    desc: 'Ending integer index for the finite loop sequence (inclusive).',
    usage: 'Defines total iteration count = (End - Start + 1).'
  },
  'current loop value': {
    desc: 'Integer index of the current iteration step during active loop execution.',
    usage: 'Connect to list lookups, staggered spawners, or progress counters.'
  },
  'loop body': {
    desc: 'Execution branch evaluated repeatedly once per iteration step before advancing.',
    usage: 'Connect logic blocks that should repeat for each item or index.'
  },
  'loop complete': {
    desc: 'Execution branch evaluated once after all loop iterations have finished or after Break Loop.',
    usage: 'Connect subsequent sequential logic to resume standard graph execution.'
  },
  'break loop': {
    desc: 'Control flow interrupt pin. Prematurely terminates the active loop execution thread.',
    usage: 'Connect from an inside loop conditional branch to exit early.'
  },
  'condition': {
    desc: 'Boolean logic expression (true/false) evaluated to determine control flow branching.',
    usage: 'Wire from comparison operations (==, !=, >, <, AND, OR).'
  },
  'branch true': {
    desc: 'Execution branch taken when the tested condition evaluates to TRUE.',
    usage: 'Carries out the positive logic path.'
  },
  'branch false': {
    desc: 'Execution branch taken when the tested condition evaluates to FALSE.',
    usage: 'Carries out the fallback or alternative logic path.'
  },
  'yes': {
    desc: 'Execution branch taken when the Boolean test succeeds (True).',
    usage: 'True outcome path.'
  },
  'no': {
    desc: 'Execution branch taken when the Boolean test fails (False).',
    usage: 'False outcome path.'
  },

  // Spatial / Physical Pins
  'location': {
    desc: '3D spatial coordinates [X, Y, Z] in world space representing location, target point, or origin.',
    usage: 'Pass vector3 objects or query results like Get Entity Position.'
  },
  'position': {
    desc: '3D spatial coordinates [X, Y, Z] in world space representing entity placement.',
    usage: 'Use for spatial offsets, distance checks, and spawners.'
  },
  'rotation': {
    desc: 'Euler angles [Pitch, Yaw, Roll] in degrees defining 3D orientation.',
    usage: 'Determines facing direction of spawned prefabs or rotated stage entities.'
  },
  'scale': {
    desc: '3D scaling factors [X, Y, Z] applied to the entity geometry.',
    usage: 'Defaults to [1, 1, 1] for normal proportion.'
  },
  'direction': {
    desc: 'Normalized 3D direction vector representing forward trajectory or movement impulse.',
    usage: 'Used for character dashing, projectile physics, and line-of-sight checks.'
  },
  'radius': {
    desc: 'Radial distance in meters defining the spherical or cylindrical zone of effect.',
    usage: 'Controls area-of-effect damage, trigger detection, and query bounding spheres.'
  },
  'distance': {
    desc: 'Linear distance measurement between two positions or entities.',
    usage: 'Use for proximity triggers, interaction ranges, and spatial gating.'
  },

  // Config & Asset Pins
  'unit status config id': {
    desc: 'Preset ID referencing a Unit Status (buff, debuff, state modifier) configured in the stage catalog.',
    usage: 'Applied to entities via Add Unit Status.'
  },
  'config id': {
    desc: 'Static configuration index referencing an entry in the Miliastra asset database.',
    usage: 'Identifies prefabs, monster types, audio tracks, or stage widgets.'
  },
  'prefab id': {
    desc: 'Asset template ID for dynamic instantiation and entity spawning.',
    usage: 'Pass to Spawn Prefab Entity.'
  },
  'faction': {
    desc: 'Faction alignment group ID (e.g. Friendly, Hostile, Neutral, Player Team).',
    usage: 'Determines auto-targeting, friendly fire rules, and perception.'
  },
  'signal name': {
    desc: 'Unique string identifier for the server/client custom broadcast signal.',
    usage: 'Must match the signal name registered in the Server Signal Explorer.'
  },
  'signal parameters': {
    desc: 'Dynamic dictionary or ordered argument list transmitted alongside the broadcast signal.',
    usage: 'Provides context parameters to listeners on other entities or clients.'
  },
  'string': {
    desc: 'Text string literal or formatted message.',
    usage: 'Used for debug logs, UI notices, variable keys, and dialogue prompts.'
  },
  'duration': {
    desc: 'Time duration in seconds for timer intervals, status lifespans, or delays.',
    usage: 'Specified in seconds (float or integer).'
  }
};

/**
 * Intelligent pin explanation extrapolator
 */
export function extrapolatePinDoc(pinName, pinType = 'generic', pinDirection = 'input', node = null) {
  const normName = String(pinName || '').toLowerCase().trim();

  // 1. Direct Knowledge Base Match
  if (PIN_KNOWLEDGE_BASE[normName]) {
    return {
      title: pinName,
      type: pinType,
      direction: pinDirection,
      desc: PIN_KNOWLEDGE_BASE[normName].desc,
      usage: PIN_KNOWLEDGE_BASE[normName].usage,
      source: 'exact'
    };
  }

  // 2. Keyword & Stem Extrapolation Rules
  if (normName.includes('entity') && normName.includes('source')) {
    return {
      title: pinName,
      type: pinType || 'entity',
      direction: pinDirection,
      desc: 'The origin Entity that dispatched or owns this event sequence.',
      usage: 'Pass to entity-specific modifier nodes or spatial queries.',
      source: 'extrapolated'
    };
  }

  if (normName.includes('guid')) {
    return {
      title: pinName,
      type: 'guid',
      direction: pinDirection,
      desc: 'Global unique 64-bit identifier string corresponding to an active entity.',
      usage: 'Used for precise entity lookup and persistent reference indexing.',
      source: 'extrapolated'
    };
  }

  if (normName.includes('entity')) {
    return {
      title: pinName,
      type: 'entity',
      direction: pinDirection,
      desc: 'Reference handle to an active game entity (Player, Character, Mechanism, or Creature).',
      usage: 'Connect to query or execution nodes targeting game objects.',
      source: 'extrapolated'
    };
  }

  if (normName.includes('pos') || normName.includes('loc') || normName.includes('coord')) {
    return {
      title: pinName,
      type: 'vector3',
      direction: pinDirection,
      desc: '3-dimensional vector coordinates [X, Y, Z] in stage world space.',
      usage: 'Used for position calculations, spatial offsets, and spawner origins.',
      source: 'extrapolated'
    };
  }

  if (normName.includes('rot') || normName.includes('angle') || normName.includes('yaw')) {
    return {
      title: pinName,
      type: 'vector3',
      direction: pinDirection,
      desc: 'Euler angles [Pitch, Yaw, Roll] representing orientation in degrees.',
      usage: 'Controls rotation transformations and facing directions.',
      source: 'extrapolated'
    };
  }

  if (normName.includes('status') || normName.includes('buff')) {
    return {
      title: pinName,
      type: pinType || 'config_id',
      direction: pinDirection,
      desc: 'Unit status configuration ID defining active buffs, debuffs, or state tags.',
      usage: 'Must correspond to a valid Unit Status configuration entry.',
      source: 'extrapolated'
    };
  }

  if (normName.includes('speed') || normName.includes('velocity') || normName.includes('spd')) {
    return {
      title: pinName,
      type: 'float',
      direction: pinDirection,
      desc: 'Movement speed or velocity scalar magnitude measured in meters per second.',
      usage: 'Used for speed comparisons, impulse adjustments, and motion pacing.',
      source: 'extrapolated'
    };
  }

  if (normName.includes('count') || normName.includes('amount') || normName.includes('num') || normName.includes('index')) {
    return {
      title: pinName,
      type: 'int',
      direction: pinDirection,
      desc: 'Discrete integer numerical quantity or list indexing integer.',
      usage: 'Used for arithmetic, repetition checks, or container indices.',
      source: 'extrapolated'
    };
  }

  if (normName.includes('time') || normName.includes('delay') || normName.includes('interval') || normName.includes('durat')) {
    return {
      title: pinName,
      type: 'float',
      direction: pinDirection,
      desc: 'Time duration measured in seconds before triggering, ticking, or expiring.',
      usage: 'Provide positive decimal seconds (e.g. 0.5, 2.0).',
      source: 'extrapolated'
    };
  }

  if (normName.includes('signal')) {
    return {
      title: pinName,
      type: pinType || 'string',
      direction: pinDirection,
      desc: 'Signal broadcast identifier name connecting sender and monitor nodes.',
      usage: 'Must match across emitting and listening node graphs.',
      source: 'extrapolated'
    };
  }

  if (normName.includes('var') || normName.includes('name') || normName.includes('key')) {
    return {
      title: pinName,
      type: pinType || 'string',
      direction: pinDirection,
      desc: 'String lookup key used to index dictionary items or variables.',
      usage: 'Ensure exact matching case and spelling.',
      source: 'extrapolated'
    };
  }

  // 3. Fallback based on Data Type
  const typeObj = DATA_TYPES.find(t => t.id === pinType) || { desc: 'Generic node data parameter' };
  return {
    title: pinName,
    type: pinType,
    direction: pinDirection,
    desc: `${typeObj.desc} used by this node for logic execution.`,
    usage: `Connect compatible ${pinType.toUpperCase()} output wires or specify parameter default value.`,
    source: 'type_fallback'
  };
}

/**
 * Node Inspector Class
 */
export class NodeInspector {
  constructor(app) {
    this.app = app;
    this.activeBlueprint = null;
    this.selectedPinKey = null;
    this.currentView = 'node'; // 'node' | 'pin' | 'cheatsheet'
    this.previousView = 'node';
    this.selectedPinDoc = null;
    this.selectedPinColor = null;
    this.highlightedType = null;
    this.isOpen = false;

    this.initDOM();
    this.bindEvents();
  }

  bringToFront() {
    this.card.style.zIndex = `${++windowZIndexCounter}`;
  }

  initDOM() {
    this.card = document.createElement('div');
    this.card.className = 'node-inspector-card';
    this.card.id = 'nodeInspectorCard';
    this.card.style.display = 'none';
    this.card.style.position = 'fixed';
    this.card.style.left = 'calc(50vw - 480px)';
    this.card.style.top = 'calc(50vh - 340px)';
    this.card.style.zIndex = `${++windowZIndexCounter}`;

    this.card.innerHTML = `
      <!-- Header (Draggable) -->
      <div class="insp-header" id="inspHeader">
        <div class="insp-header-left">
          <span class="insp-header-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="4"/>
              <line x1="12" y1="2" x2="12" y2="6"/>
              <line x1="12" y1="18" x2="12" y2="22"/>
              <line x1="2" y1="12" x2="6" y2="12"/>
              <line x1="18" y1="12" x2="22" y2="12"/>
            </svg>
          </span>
          <div class="insp-header-title-group">
            <span class="insp-header-title" id="inspHeaderTitle">Inspect Node</span>
            <span class="insp-category-badge" id="inspCategoryBadge" style="background:#4a6b46;">EVENT</span>
          </div>
          <div class="insp-header-nav">
            <button class="insp-nav-btn" id="inspPrevNodeBtn" title="Previous Node in Library">◀</button>
            <button class="insp-nav-btn" id="inspNextNodeBtn" title="Next Node in Library">▶</button>
          </div>
        </div>

        <!-- Center Quick Search -->
        <div class="insp-header-center">
          <div class="insp-search-box">
            <span class="insp-search-icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input type="text" class="insp-search-input" id="inspSearchInput" placeholder="Jump to node blueprint..." autocomplete="off" />
            <button class="insp-search-clear" id="inspSearchClear" style="display:none;">✕</button>
            <div class="insp-search-dropdown" id="inspSearchDropdown" style="display:none;"></div>
          </div>
        </div>

        <!-- Header Actions: [ℹ Data Types Reference] [★ Favorite] [✕ Close] -->
        <div class="insp-header-actions">
          <button class="insp-btn-icon" id="inspCheatsheetBtn" title="Data Types Reference">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
          <button class="insp-btn-icon" id="inspFavBtn" title="Favorite this Node">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </button>
          <button class="insp-btn-icon insp-close-btn" id="inspCloseBtn" title="Close Inspector (Esc)">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Main Body Split View -->
      <div class="insp-body">
        <!-- Left Pane: Exploded Blueprint -->
        <div class="insp-diagram-pane">
          <div class="insp-diagram-canvas" id="inspDiagramCanvas">
            <!-- Exploded diagram rendered dynamically here -->
          </div>
        </div>

        <!-- Right Pane: Direct Inspector -->
        <div class="insp-specs-pane">
          <div class="insp-specs-scroll" id="inspSpecsScroll">
            <!-- Content rendered directly here without nested frames -->
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.card);
  }

  bindEvents() {
    // Draggable header
    const header = this.card.querySelector('#inspHeader');
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      const rect = this.card.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      this.bringToFront();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      this.card.style.left = `${Math.max(10, Math.min(window.innerWidth - 300, initialLeft + dx))}px`;
      this.card.style.top = `${Math.max(10, Math.min(window.innerHeight - 100, initialTop + dy))}px`;
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    this.card.addEventListener('mousedown', () => {
      this.bringToFront();
    });

    // Close button
    this.card.querySelector('#inspCloseBtn').addEventListener('click', () => {
      this.close();
    });

    // Favorite button
    this.card.querySelector('#inspFavBtn').addEventListener('click', () => {
      if (!this.activeBlueprint) return;
      if (this.app?.library) {
        this.app.library.toggleFavorite(this.activeBlueprint.id);
        this.updateFavoriteButton();
      }
    });

    // Topbar Data Types Reference Cheatsheet Button [ℹ]
    const btnCheatsheet = this.card.querySelector('#inspCheatsheetBtn');
    if (btnCheatsheet) {
      btnCheatsheet.addEventListener('click', () => {
        if (this.currentView === 'cheatsheet') {
          if (this.selectedPinKey && this.selectedPinDoc) {
            this.showPinDetails(this.selectedPinKey, this.selectedPinDoc, this.selectedPinColor);
          } else {
            this.showNodeOverview();
          }
        } else {
          this.showCheatsheet();
        }
      });
    }

    // Prev / Next Navigation
    this.card.querySelector('#inspPrevNodeBtn').addEventListener('click', () => {
      this.navigateRelative(-1);
    });

    this.card.querySelector('#inspNextNodeBtn').addEventListener('click', () => {
      this.navigateRelative(1);
    });

    // Search Box & Jump Dropdown
    const searchInput = this.card.querySelector('#inspSearchInput');
    const searchClear = this.card.querySelector('#inspSearchClear');
    const searchDropdown = this.card.querySelector('#inspSearchDropdown');

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      searchClear.style.display = q ? 'block' : 'none';
      if (!q) {
        searchDropdown.style.display = 'none';
        return;
      }
      const all = getAllNodes();
      const matches = all.filter(n =>
        n.name.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q) ||
        (n.folder && n.folder.toLowerCase().includes(q))
      ).slice(0, 15);

      if (matches.length === 0) {
        searchDropdown.innerHTML = '<div style="padding:8px 12px;font-size:11px;color:#64748b;">No matching blueprints</div>';
      } else {
        searchDropdown.innerHTML = matches.map(m => {
          const cat = CATEGORIES[m.category] || { name: 'Node', headerColor: '#4a6b46' };
          return `
            <div class="insp-search-item" data-id="${m.id}">
              <div style="display:flex;align-items:center;gap:6px;min-width:0;">
                <span style="width:6px;height:6px;border-radius:50%;background:${cat.headerColor};flex-shrink:0;"></span>
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.name}</span>
              </div>
              <span style="font-size:10px;color:#64748b;font-family:monospace;">${m.folder || ''}</span>
            </div>
          `;
        }).join('');

        searchDropdown.querySelectorAll('.insp-search-item').forEach(item => {
          item.addEventListener('click', () => {
            const bp = getNodeBlueprint(item.dataset.id);
            if (bp) this.inspect(bp);
            searchDropdown.style.display = 'none';
            searchInput.value = '';
            searchClear.style.display = 'none';
          });
        });
      }
      searchDropdown.style.display = 'block';
    });

    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchClear.style.display = 'none';
      searchDropdown.style.display = 'none';
    });

    // Close search dropdown on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.insp-search-box')) {
        searchDropdown.style.display = 'none';
      }
    });

    // Global keyboard Escape handler
    window.addEventListener('keydown', (e) => {
      if (this.isOpen && e.key === 'Escape') {
        this.close();
      }
    });
  }

  navigateRelative(offset) {
    const all = getAllNodes();
    if (all.length === 0 || !this.activeBlueprint) return;
    const currentIndex = all.findIndex(n => n.id === this.activeBlueprint.id);
    if (currentIndex === -1) return;
    let nextIndex = currentIndex + offset;
    if (nextIndex < 0) nextIndex = all.length - 1;
    if (nextIndex >= all.length) nextIndex = 0;
    this.inspect(all[nextIndex]);
  }

  open(nodeOrBlueprint) {
    this.card.style.display = 'flex';
    this.isOpen = true;
    this.bringToFront();
    this.inspect(nodeOrBlueprint || getAllNodes()[0]);
  }

  close() {
    this.card.style.display = 'none';
    this.isOpen = false;
  }

  updateFavoriteButton() {
    const favBtn = this.card.querySelector('#inspFavBtn');
    if (!favBtn || !this.activeBlueprint || !this.app?.library) return;
    const isFav = this.app.library.isFavorite(this.activeBlueprint.id);
    if (isFav) {
      favBtn.classList.add('active-fav');
      favBtn.querySelector('svg').setAttribute('fill', '#f59e0b');
    } else {
      favBtn.classList.remove('active-fav');
      favBtn.querySelector('svg').setAttribute('fill', 'none');
    }
  }

  inspect(nodeOrBlueprint) {
    if (!nodeOrBlueprint) return;
    let bp = nodeOrBlueprint;
    if (typeof bp === 'string') {
      bp = getNodeBlueprint(bp);
    } else if (bp.blueprintId) {
      bp = getNodeBlueprint(bp.blueprintId) || bp;
    }
    if (!bp) return;

    this.activeBlueprint = bp;
    this.selectedPinKey = null;
    this.currentView = 'node';

    // Update Header
    const cat = CATEGORIES[bp.category] || { name: bp.category || 'Node', headerColor: '#4a6b46' };
    const titleEl = this.card.querySelector('#inspHeaderTitle');
    const badgeEl = this.card.querySelector('#inspCategoryBadge');

    if (titleEl) titleEl.textContent = bp.name;
    if (badgeEl) {
      badgeEl.textContent = (cat.name || bp.category || 'Node').toUpperCase();
      badgeEl.style.background = cat.headerColor || '#4a6b46';
    }

    this.updateFavoriteButton();
    this.renderExplodedDiagram(bp, cat);
    this.showNodeOverview();
  }

  getCategoryIcon(iconType) {
    switch (iconType) {
      case 'composite-tri':
      case 'composite':
        return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="5" r="2.8"/><circle cx="6.5" cy="17.5" r="2.8"/><circle cx="17.5" cy="17.5" r="2.8"/><line x1="12" y1="5" x2="6.5" y2="17.5" stroke="currentColor" stroke-width="1.8"/><line x1="12" y1="5" x2="17.5" y2="17.5" stroke="currentColor" stroke-width="1.8"/><line x1="6.5" y1="17.5" x2="17.5" y2="17.5" stroke="currentColor" stroke-width="1.8"/></svg>`;
      case 'cycle-arrows':
        return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-1.19"/><polyline points="2.5 22 2.5 16 8.5 16"/></svg>`;
      case 'flow-snake':
        return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>`;
      case 'branch-split':
        return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="6" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="18" r="3"/><line x1="8.7" y1="10.7" x2="15.3" y2="7.3"/><line x1="8.7" y1="13.3" x2="15.3" y2="16.7"/></svg>`;
      case 'compass-query':
        return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`;
      case 'calc-math':
        return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"/></svg>`;
      default:
        return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="8"/></svg>`;
    }
  }

  getExecChevron(color = '#FFFFFF') {
    return `
      <svg viewBox="0 0 16 14" width="16" height="14" class="miliastra-exec-arrow">
        <path d="M 2,1.5 L 9.5,1.5 L 15,7 L 9.5,12.5 L 2,12.5 Z" fill="rgba(26, 30, 40, 0.95)" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" />
      </svg>
    `;
  }

  /**
   * Render the visual Exploded View Diagram on the left
   * Follows authentic Miliastra node header colors and typography!
   */
  renderExplodedDiagram(bp, cat) {
    const canvas = this.card.querySelector('#inspDiagramCanvas');
    canvas.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'exploded-node-wrapper';

    const isDarkTextCategory = bp.category === 'event' || bp.category === 'execution' || bp.category === 'flow';
    const headerTextColor = isDarkTextCategory ? '#111111' : '#FFFFFF';
    const iconSVG = this.getCategoryIcon(cat.iconType || 'flow-snake');
    const isSigNode = bp.id === 'event_monitor_signal' || bp.id === 'exec_send_signal' || bp.isSignalNode;

    // 1. Central Exploded Node Box (The Big Main Node formatted like real canvas node)
    const nodeBox = document.createElement('div');
    nodeBox.className = 'exploded-node-box selected';
    nodeBox.title = 'Click to view Node Function description';
    nodeBox.innerHTML = `
      <div class="exploded-node-header" style="background-color: ${cat.headerColor}; color: ${headerTextColor};">
        <span class="exploded-node-icon" style="stroke: ${headerTextColor}; color: ${headerTextColor};">
          ${iconSVG}
        </span>
        <div class="exploded-node-title" style="color: ${headerTextColor}; font-weight: 700;">${bp.name}</div>
        <span class="exploded-header-badge" style="color: ${headerTextColor};">${(bp.category || '').toUpperCase()}</span>
      </div>

      <!-- Execution Flow Ports Row (if applicable) -->
      ${(bp.execIn || bp.execOut) ? `
        <div class="exploded-flow-row">
          <div class="exploded-flow-in ${bp.execIn ? '' : 'disabled'}" data-pin-key="exec_in" style="${bp.execIn ? '' : 'opacity:0.25;pointer-events:none;'}">
            ${this.getExecChevron('#FFFFFF')}
            <span>Exec In</span>
          </div>

          <div class="exploded-flow-out ${bp.execOut ? '' : 'disabled'}" data-pin-key="exec_out" style="${bp.execOut ? '' : 'opacity:0.25;pointer-events:none;'}">
            <span>${bp.customExecOutputs && bp.customExecOutputs.length ? bp.customExecOutputs.join(' / ') : 'Exec Out'}</span>
            ${this.getExecChevron('#FFFFFF')}
          </div>
        </div>
      ` : ''}

      <!-- Signal Selector Preview for Signal Nodes -->
      ${isSigNode ? `
        <div class="exploded-signal-preview-row">
          <span class="exploded-signal-icon">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4.93 19.07A10 10 0 0 1 19.07 4.93" stroke-linecap="round"/>
              <path d="M7.76 16.24a6 6 0 0 1 8.48-8.48" stroke-linecap="round"/>
              <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
            </svg>
          </span>
          <span style="color:#cbd5e1;font-size:12px;font-weight:600;">Signal:</span>
          <span class="exploded-signal-badge">No Signal ▾</span>
        </div>
      ` : ''}

      <!-- Core Execution Mode Indicator -->
      <div class="exploded-core-body">
        <div class="exploded-core-chip">
          <span>Execution Engine Mode:</span>
          <span class="exploded-core-badge">${bp.category === 'event' ? 'Event Trigger Listener' : (bp.category === 'query' ? 'Pure Query Function' : 'Synchronous Action')}</span>
        </div>
      </div>
    `;

    // Clicking the central node brings back the Node Functions / Overview!
    nodeBox.addEventListener('click', (e) => {
      if (e.target.closest('.exploded-flow-in') || e.target.closest('.exploded-flow-out')) return;
      this.selectedPinKey = null;
      this.highlightPort(null);
      nodeBox.classList.add('selected');
      this.showNodeOverview();
    });

    wrapper.appendChild(nodeBox);

    // 2. Exploded Ports Breakdown (Inputs Column on Left, Outputs Column on Right)
    const portsRow = document.createElement('div');
    portsRow.className = 'exploded-ports-container';

    // Inputs
    const inputsCol = document.createElement('div');
    inputsCol.className = 'exploded-inputs-col';

    const inputPins = bp.inputs || [];
    if (inputPins.length === 0) {
      inputsCol.innerHTML = '<div style="font-size:11px;color:#556277;text-align:center;padding:12px;">No Input Parameters</div>';
    } else {
      inputPins.forEach((p, idx) => {
        const pinKey = `in_${idx}_${p.name}`;
        const pinColor = PIN_COLORS[p.type] || PIN_COLORS.generic;
        const item = document.createElement('div');
        item.className = 'exploded-port-item';
        item.dataset.pinKey = pinKey;
        item.innerHTML = `
          <span class="exploded-port-socket" style="border-color:${pinColor};color:${pinColor};background:${pinColor}33;"></span>
          <div class="exploded-port-info">
            <span class="exploded-port-name">${p.name}</span>
            <span class="exploded-port-type" style="color:${pinColor};">[${p.type || 'generic'}]</span>
          </div>
        `;

        item.addEventListener('click', () => {
          const doc = extrapolatePinDoc(p.name, p.type, 'input', bp);
          this.showPinDetails(pinKey, doc, pinColor, p.defaultVal !== undefined ? `Default: ${p.defaultVal || '0'}` : null);
        });

        inputsCol.appendChild(item);
      });
    }

    // Outputs
    const outputsCol = document.createElement('div');
    outputsCol.className = 'exploded-outputs-col';

    const outputPins = bp.outputs || [];
    if (outputPins.length === 0) {
      outputsCol.innerHTML = '<div style="font-size:11px;color:#556277;text-align:center;padding:12px;">No Output Parameters</div>';
    } else {
      outputPins.forEach((p, idx) => {
        const pinKey = `out_${idx}_${p.name}`;
        const pinColor = PIN_COLORS[p.type] || PIN_COLORS.generic;
        const item = document.createElement('div');
        item.className = 'exploded-port-item';
        item.dataset.pinKey = pinKey;
        item.innerHTML = `
          <div class="exploded-port-info" style="text-align:right;">
            <span class="exploded-port-name">${p.name}</span>
            <span class="exploded-port-type" style="color:${pinColor};">[${p.type || 'generic'}]</span>
          </div>
          <span class="exploded-port-socket" style="border-color:${pinColor};color:${pinColor};background:${pinColor}33;"></span>
        `;

        item.addEventListener('click', () => {
          const doc = extrapolatePinDoc(p.name, p.type, 'output', bp);
          this.showPinDetails(pinKey, doc, pinColor, 'Computed Value');
        });

        outputsCol.appendChild(item);
      });
    }

    portsRow.appendChild(inputsCol);
    portsRow.appendChild(outputsCol);
    wrapper.appendChild(portsRow);

    // Bind Exec Pin clicks
    const execInEl = nodeBox.querySelector('.exploded-flow-in');
    if (execInEl && bp.execIn) {
      execInEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const execDoc = extrapolatePinDoc('Execution In', 'exec', 'input', bp);
        this.showPinDetails('exec_in', execDoc, PIN_COLORS.exec, 'Flow Pulse');
      });
    }

    const execOutEl = nodeBox.querySelector('.exploded-flow-out');
    if (execOutEl && bp.execOut) {
      execOutEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const execDoc = extrapolatePinDoc('Execution Out', 'exec', 'output', bp);
        this.showPinDetails('exec_out', execDoc, PIN_COLORS.exec, 'Flow Signal');
      });
    }

    canvas.appendChild(wrapper);
  }

  /**
   * Highlight port in diagram
   */
  highlightPort(pinKey) {
    const nodeBox = this.card.querySelector('.exploded-node-box');
    if (nodeBox) {
      if (!pinKey) {
        nodeBox.classList.add('selected');
      } else {
        nodeBox.classList.remove('selected');
      }
    }

    this.card.querySelectorAll('.exploded-port-item, .exploded-flow-in, .exploded-flow-out').forEach(el => {
      if (pinKey && el.dataset.pinKey === pinKey) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });
  }

  /**
   * VIEW 1: Clean Node Functions & Overview (Default / Big node clicked)
   */
  showNodeOverview() {
    this.currentView = 'node';
    this.selectedPinKey = null;
    this.highlightPort(null);

    const btnCheatsheet = this.card.querySelector('#inspCheatsheetBtn');
    if (btnCheatsheet) btnCheatsheet.classList.remove('active');

    const bp = this.activeBlueprint;
    if (!bp) return;

    const cat = CATEGORIES[bp.category] || { name: bp.category || 'Node', headerColor: '#4a6b46' };

    const scroll = this.card.querySelector('#inspSpecsScroll');
    scroll.innerHTML = '';

    // 1. Node Function & Description
    const descSection = document.createElement('div');
    descSection.className = 'insp-section-card';
    descSection.innerHTML = `
      <div class="insp-section-header">
        <span>Node Function</span>
        <span style="font-size:10.5px;color:#818cf8;">Category: ${cat.name}</span>
      </div>
      <div class="insp-section-body">
        <div class="insp-desc-text">${bp.description || 'Executes logic node operations within the Miliastra graph architecture.'}</div>
      </div>
    `;
    scroll.appendChild(descSection);

    // 2. Connectors Summary
    const inputPins = bp.inputs || [];
    const outputPins = bp.outputs || [];

    const connectorsSection = document.createElement('div');
    connectorsSection.className = 'insp-section-card';
    connectorsSection.innerHTML = `
      <div class="insp-section-header">
        <span>Available Connectors</span>
        <span style="font-size:10.5px;color:#94a3b8;">${inputPins.length + outputPins.length + (bp.execIn ? 1 : 0) + (bp.execOut ? 1 : 0)} Total</span>
      </div>
      <div class="insp-section-body">
        <div class="insp-connectors-overview-grid">
          <!-- Inputs Column -->
          <div>
            <div class="insp-connector-group-title">Inputs (${inputPins.length + (bp.execIn ? 1 : 0)})</div>
            <div class="insp-connector-chip-list">
              ${bp.execIn ? `
                <div class="insp-connector-chip" data-pin-key="exec_in">
                  <span class="insp-connector-chip-name">
                    <span style="width:6px;height:6px;border-radius:50%;background:#ffffff;"></span>
                    <span>Exec In</span>
                  </span>
                  <span class="insp-connector-chip-type">[flow]</span>
                </div>
              ` : ''}
              ${inputPins.map((p, idx) => {
                const pinKey = `in_${idx}_${p.name}`;
                const pinColor = PIN_COLORS[p.type] || PIN_COLORS.generic;
                return `
                  <div class="insp-connector-chip" data-pin-key="${pinKey}">
                    <span class="insp-connector-chip-name">
                      <span style="width:6px;height:6px;border-radius:50%;background:${pinColor};"></span>
                      <span>${p.name}</span>
                    </span>
                    <span class="insp-connector-chip-type" style="color:${pinColor};">[${p.type || 'generic'}]</span>
                  </div>
                `;
              }).join('')}
              ${!bp.execIn && inputPins.length === 0 ? '<div style="font-size:11px;color:#556277;">No inputs</div>' : ''}
            </div>
          </div>

          <!-- Outputs Column -->
          <div>
            <div class="insp-connector-group-title">Outputs (${outputPins.length + (bp.execOut ? 1 : 0)})</div>
            <div class="insp-connector-chip-list">
              ${bp.execOut ? `
                <div class="insp-connector-chip" data-pin-key="exec_out">
                  <span class="insp-connector-chip-name">
                    <span style="width:6px;height:6px;border-radius:50%;background:#ffffff;"></span>
                    <span>Exec Out</span>
                  </span>
                  <span class="insp-connector-chip-type">[flow]</span>
                </div>
              ` : ''}
              ${outputPins.map((p, idx) => {
                const pinKey = `out_${idx}_${p.name}`;
                const pinColor = PIN_COLORS[p.type] || PIN_COLORS.generic;
                return `
                  <div class="insp-connector-chip" data-pin-key="${pinKey}">
                    <span class="insp-connector-chip-name">
                      <span style="width:6px;height:6px;border-radius:50%;background:${pinColor};"></span>
                      <span>${p.name}</span>
                    </span>
                    <span class="insp-connector-chip-type" style="color:${pinColor};">[${p.type || 'generic'}]</span>
                  </div>
                `;
              }).join('')}
              ${!bp.execOut && outputPins.length === 0 ? '<div style="font-size:11px;color:#556277;">No outputs</div>' : ''}
            </div>
          </div>
        </div>
      </div>
    `;

    // Connect clicks on chips
    connectorsSection.querySelectorAll('.insp-connector-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const pinKey = chip.dataset.pinKey;
        if (pinKey === 'exec_in') {
          const doc = extrapolatePinDoc('Execution In', 'exec', 'input', bp);
          this.showPinDetails('exec_in', doc, PIN_COLORS.exec, 'Flow Pulse');
        } else if (pinKey === 'exec_out') {
          const doc = extrapolatePinDoc('Execution Out', 'exec', 'output', bp);
          this.showPinDetails('exec_out', doc, PIN_COLORS.exec, 'Flow Signal');
        } else if (pinKey.startsWith('in_')) {
          const idx = parseInt(pinKey.split('_')[1], 10);
          const p = inputPins[idx];
          if (p) {
            const doc = extrapolatePinDoc(p.name, p.type, 'input', bp);
            this.showPinDetails(pinKey, doc, PIN_COLORS[p.type] || PIN_COLORS.generic, p.defaultVal !== undefined ? `Default: ${p.defaultVal || '0'}` : null);
          }
        } else if (pinKey.startsWith('out_')) {
          const idx = parseInt(pinKey.split('_')[1], 10);
          const p = outputPins[idx];
          if (p) {
            const doc = extrapolatePinDoc(p.name, p.type, 'output', bp);
            this.showPinDetails(pinKey, doc, PIN_COLORS[p.type] || PIN_COLORS.generic, 'Computed Value');
          }
        }
      });
    });

    scroll.appendChild(connectorsSection);
  }

  /**
   * VIEW 2: Focused Single Connector Details (When a connector/pin is pressed)
   */
  showPinDetails(pinKey, doc, pinColor, metaExtra = null) {
    this.previousView = this.currentView;
    this.currentView = 'pin';
    this.selectedPinKey = pinKey;
    this.selectedPinDoc = doc;
    this.selectedPinColor = pinColor;
    this.highlightPort(pinKey);

    const btnCheatsheet = this.card.querySelector('#inspCheatsheetBtn');
    if (btnCheatsheet) btnCheatsheet.classList.remove('active');

    const scroll = this.card.querySelector('#inspSpecsScroll');
    scroll.innerHTML = '';

    // Direct clean layout (no nested inner-box inside outer-box)
    const pinDetailsView = document.createElement('div');
    pinDetailsView.className = 'insp-pin-flat-view';
    pinDetailsView.innerHTML = `
      <div class="insp-pin-flat-header">
        <div class="insp-pin-identity">
          <span class="insp-pin-dot" style="background:${pinColor};"></span>
          <span class="insp-pin-name">${doc.title}</span>
        </div>
        <span class="insp-pin-type-tag" style="color:${pinColor};">[${doc.type}]</span>
      </div>

      <div class="insp-pin-flat-desc">
        ${doc.desc}
      </div>

      <div class="insp-pin-meta-grid">
        <div class="insp-pin-meta-item">
          <span class="insp-pin-meta-label">Signal Direction</span>
          <span class="insp-pin-meta-value" style="color:${doc.direction === 'input' ? '#38bdf8' : '#4ade80'};">${doc.direction.toUpperCase()}</span>
        </div>

        <div class="insp-pin-meta-item">
          <span class="insp-pin-meta-label">Parameter Payload</span>
          <span class="insp-pin-meta-value">${doc.type.toUpperCase()}</span>
        </div>

        ${metaExtra ? `
          <div class="insp-pin-meta-item" style="grid-column: span 2;">
            <span class="insp-pin-meta-label">Attribute Specification</span>
            <span class="insp-pin-meta-value">${metaExtra}</span>
          </div>
        ` : ''}
      </div>

      ${doc.usage ? `
        <div class="insp-pin-usage-box">
          <span style="color:#38bdf8;font-size:14px;flex-shrink:0;">💡</span>
          <div>
            <div style="font-weight:600;margin-bottom:2px;color:#e0f2fe;">Usage Guidelines</div>
            <div>${doc.usage}</div>
          </div>
        </div>
      ` : ''}
    `;

    scroll.appendChild(pinDetailsView);
  }

  /**
   * VIEW 3: Miliastra Data Types Cheatsheet
   * Triggered from top header [ℹ] button
   */
  showCheatsheet(highlightType = null) {
    this.previousView = this.currentView;
    this.currentView = 'cheatsheet';
    this.highlightedType = highlightType ? String(highlightType).toLowerCase() : null;

    const btnCheatsheet = this.card.querySelector('#inspCheatsheetBtn');
    if (btnCheatsheet) btnCheatsheet.classList.add('active');

    const scroll = this.card.querySelector('#inspSpecsScroll');
    scroll.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'insp-cheatsheet-container';

    // Intro explanation
    const hero = document.createElement('div');
    hero.className = 'insp-cheatsheet-hero';
    hero.innerHTML = `
      <div style="font-weight:600;color:#f8fafc;margin-bottom:4px;">Miliastra .GIA Type System</div>
      <div>Values passed through graph pins are strongly typed. Click on any pin or the node on the left to return.</div>
    `;
    container.appendChild(hero);

    // Types Grid
    const grid = document.createElement('div');
    grid.className = 'insp-cheatsheet-grid';

    DATA_TYPES.forEach(t => {
      const isHighlighted = this.highlightedType && (t.id.toLowerCase() === this.highlightedType || this.highlightedType.includes(t.id.toLowerCase()));
      const card = document.createElement('div');
      card.className = `insp-cheatsheet-card ${isHighlighted ? 'highlighted' : ''}`;
      card.id = `typeCard_${t.id}`;
      card.innerHTML = `
        <div class="insp-cheatsheet-card-top">
          <div class="insp-cheatsheet-tag">
            <span style="width:8px;height:8px;border-radius:50%;background:${t.color};"></span>
            <span style="color:${t.color};">[${t.id}]</span>
          </div>
          <span class="insp-cheatsheet-label">${t.label}</span>
        </div>
        <div class="insp-cheatsheet-desc">${t.desc}</div>
        <div class="insp-cheatsheet-meta">
          ${t.id === 'vector3' ? 'Format: {x: 0, y: 0, z: 0}' : (t.id === 'entity' ? 'Ref: Game Object Handle' : (t.id === 'guid' ? 'Format: 64-bit UUID string' : `Standard ${t.label}`))}
        </div>
      `;

      grid.appendChild(card);
    });

    container.appendChild(grid);
    scroll.appendChild(container);

    // Auto-scroll to highlighted card if specified
    if (this.highlightedType) {
      setTimeout(() => {
        const target = scroll.querySelector(`.insp-cheatsheet-card.highlighted`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    }
  }
}
