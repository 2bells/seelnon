/**
 * Miliastra Wonderland Puzzles & Challenges Blueprint Catalog
 * Server-side / Built-in puzzles designed to guide users into node graph programming.
 * Includes objectives, canvas notes, screenshots/diagrams, solutions, and verification rules.
 */

// Embedded authentic Genshin / Miliastra Wonderland mechanism illustrations
export const PUZZLE_SCREENSHOTS = {
  ancient_door: `<svg viewBox="0 0 420 220" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="doorBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#141926"/>
        <stop offset="100%" stop-color="#0c101a"/>
      </linearGradient>
      <linearGradient id="stoneArch" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#4a5568"/>
        <stop offset="100%" stop-color="#2d3748"/>
      </linearGradient>
      <linearGradient id="runeGlow" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.2"/>
        <stop offset="50%" stop-color="#38bdf8" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.2"/>
      </linearGradient>
    </defs>
    <!-- Background Chamber -->
    <rect width="420" height="220" fill="url(#doorBg)" rx="6"/>
    <path d="M0 190 L420 190" stroke="#1f293d" stroke-width="2"/>
    <path d="M40 220 L120 190 M380 220 L300 190" stroke="#1f293d" stroke-width="1.5"/>

    <!-- Stone Arch Frame -->
    <path d="M110 190 L110 70 Q110 30 160 30 L260 30 Q310 30 310 70 L310 190 Z" fill="url(#stoneArch)" stroke="#718096" stroke-width="2"/>
    <!-- Inner Door Leaf (Closed: State 0) -->
    <rect x="130" y="55" width="160" height="135" fill="#1a202c" stroke="#4a5568" stroke-width="2" rx="4"/>
    <line x1="210" y1="55" x2="210" y2="190" stroke="#2d3748" stroke-width="3"/>
    <!-- Door Carved Glyphs -->
    <circle cx="210" cy="115" r="28" fill="none" stroke="#64748b" stroke-width="2" stroke-dasharray="6,4"/>
    <polygon points="210,95 225,120 195,120" fill="none" stroke="#64748b" stroke-width="1.5"/>
    <!-- Door Info HUD Badge -->
    <rect x="140" y="150" width="140" height="24" rx="4" fill="#0f172a" stroke="#334155" stroke-width="1"/>
    <text x="210" y="166" fill="#94a3b8" font-size="10" font-family="monospace" text-anchor="middle">Preset Idx: 10002032 | State: 0</text>

    <!-- Floating Interactive Tab: [F] Open (Tab ID: 1) -->
    <g transform="translate(250, 85)">
      <rect x="0" y="0" width="145" height="36" rx="6" fill="#1e293b" stroke="#38bdf8" stroke-width="2" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.5))"/>
      <!-- Keycap prompt -->
      <rect x="8" y="7" width="22" height="22" rx="4" fill="#38bdf8"/>
      <text x="19" y="23" fill="#0f172a" font-size="13" font-family="sans-serif" font-weight="bold" text-anchor="middle">F</text>
      <!-- Tab Label -->
      <text x="38" y="19" fill="#f8fafc" font-size="12" font-family="sans-serif" font-weight="bold">Open Door</text>
      <text x="38" y="30" fill="#38bdf8" font-size="9" font-family="monospace">Tab ID: 1 (Active)</text>
    </g>

    <!-- Player Character Indicator -->
    <circle cx="80" cy="165" r="14" fill="#3b82f6" stroke="#60a5fa" stroke-width="2"/>
    <text x="80" y="169" fill="#ffffff" font-size="10" font-family="sans-serif" font-weight="bold" text-anchor="middle">P1</text>
    <text x="80" y="195" fill="#94a3b8" font-size="10" font-family="sans-serif" text-anchor="middle">Player Entity</text>
  </svg>`,

  lever_barrier: `<svg viewBox="0 0 420 220" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect width="420" height="220" fill="#111827" rx="6"/>
    <!-- Floor -->
    <line x1="0" y1="185" x2="420" y2="185" stroke="#1f2937" stroke-width="2"/>
    <!-- Energy Gate Pillars -->
    <rect x="250" y="40" width="24" height="145" fill="#374151" stroke="#4b5563" stroke-width="2"/>
    <rect x="370" y="40" width="24" height="145" fill="#374151" stroke="#4b5563" stroke-width="2"/>
    <!-- Red Laser Barrier -->
    <line x1="274" y1="70" x2="370" y2="70" stroke="#ef4444" stroke-width="3" stroke-dasharray="8,4"/>
    <line x1="274" y1="100" x2="370" y2="100" stroke="#ef4444" stroke-width="3" stroke-dasharray="8,4"/>
    <line x1="274" y1="130" x2="370" y2="130" stroke="#ef4444" stroke-width="3" stroke-dasharray="8,4"/>
    <line x1="274" y1="160" x2="370" y2="160" stroke="#ef4444" stroke-width="3" stroke-dasharray="8,4"/>
    <rect x="285" y="105" width="75" height="22" rx="3" fill="#450a0a" stroke="#ef4444" stroke-width="1"/>
    <text x="322" y="120" fill="#fca5a5" font-size="9" font-family="monospace" text-anchor="middle">BARRIER LOCKED</text>

    <!-- Lever Pedestal -->
    <rect x="70" y="130" width="45" height="55" fill="#374151" stroke="#6b7280" stroke-width="1.5" rx="3"/>
    <line x1="92" y1="130" x2="75" y2="90" stroke="#fbbf24" stroke-width="5" stroke-linecap="round"/>
    <circle cx="75" cy="90" r="7" fill="#ef4444"/>

    <!-- Keycard Status Note -->
    <rect x="50" y="45" width="135" height="34" rx="4" fill="#1f2937" stroke="#fbbf24" stroke-width="1.5"/>
    <text x="117" y="60" fill="#f3f4f6" font-size="10" font-family="sans-serif" font-weight="bold" text-anchor="middle">Keycard Variable</text>
    <text x="117" y="72" fill="#fbbf24" font-size="9" font-family="monospace" text-anchor="middle">has_keycard == True</text>
  </svg>`,

  loot_spawner: `<svg viewBox="0 0 420 220" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect width="420" height="220" fill="#0f172a" rx="6"/>
    <!-- Floor Grid -->
    <path d="M20 180 L400 180 M60 210 L160 180 M360 210 L260 180" stroke="#1e293b" stroke-width="2"/>
    <!-- Chest 1 -->
    <g transform="translate(60, 120)">
      <rect x="0" y="15" width="55" height="40" rx="4" fill="#78350f" stroke="#d97706" stroke-width="2"/>
      <rect x="0" y="0" width="55" height="18" rx="6" fill="#92400e" stroke="#d97706" stroke-width="2"/>
      <circle cx="27" cy="22" r="5" fill="#fbbf24"/>
      <text x="27" y="68" fill="#cbd5e1" font-size="9" font-family="monospace" text-anchor="middle">Loot #0</text>
    </g>
    <!-- Chest 2 -->
    <g transform="translate(145, 120)">
      <rect x="0" y="15" width="55" height="40" rx="4" fill="#78350f" stroke="#d97706" stroke-width="2"/>
      <rect x="0" y="0" width="55" height="18" rx="6" fill="#92400e" stroke="#d97706" stroke-width="2"/>
      <circle cx="27" cy="22" r="5" fill="#fbbf24"/>
      <text x="27" y="68" fill="#cbd5e1" font-size="9" font-family="monospace" text-anchor="middle">Loot #1</text>
    </g>
    <!-- Chest 3 -->
    <g transform="translate(230, 120)">
      <rect x="0" y="15" width="55" height="40" rx="4" fill="#78350f" stroke="#d97706" stroke-width="2"/>
      <rect x="0" y="0" width="55" height="18" rx="6" fill="#92400e" stroke="#d97706" stroke-width="2"/>
      <circle cx="27" cy="22" r="5" fill="#fbbf24"/>
      <text x="27" y="68" fill="#cbd5e1" font-size="9" font-family="monospace" text-anchor="middle">Loot #2</text>
    </g>
    <!-- Chest 4 -->
    <g transform="translate(315, 120)">
      <rect x="0" y="15" width="55" height="40" rx="4" fill="#78350f" stroke="#d97706" stroke-width="2"/>
      <rect x="0" y="0" width="55" height="18" rx="6" fill="#92400e" stroke="#d97706" stroke-width="2"/>
      <circle cx="27" cy="22" r="5" fill="#fbbf24"/>
      <text x="27" y="68" fill="#cbd5e1" font-size="9" font-family="monospace" text-anchor="middle">Loot #3</text>
    </g>
    <!-- Loop Flow Header Banner -->
    <rect x="80" y="30" width="260" height="42" rx="6" fill="#1e293b" stroke="#3b82f6" stroke-width="2"/>
    <text x="210" y="48" fill="#f8fafc" font-size="11" font-family="sans-serif" font-weight="bold" text-anchor="middle">Finite Loop Execution</text>
    <text x="210" y="63" fill="#60a5fa" font-size="10" font-family="monospace" text-anchor="middle">Start: 0 | End: 3 (4 Total Iterations)</text>
  </svg>`,

  signal_relay: `<svg viewBox="0 0 420 220" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect width="420" height="220" fill="#13141f" rx="6"/>
    <!-- Boss Arena Platform -->
    <ellipse cx="210" cy="150" rx="170" ry="45" fill="#1e1f33" stroke="#4338ca" stroke-width="2"/>
    <!-- Boss Defeated Marker -->
    <circle cx="120" cy="140" r="22" fill="#450a0a" stroke="#dc2626" stroke-width="2"/>
    <text x="120" y="144" fill="#fca5a5" font-size="10" font-family="sans-serif" font-weight="bold" text-anchor="middle">BOSS</text>
    <text x="120" y="174" fill="#ef4444" font-size="9" font-family="monospace" text-anchor="middle">Defeated</text>

    <!-- Signal Wave Broadcast -->
    <path d="M150 130 Q210 90 270 130" fill="none" stroke="#a855f7" stroke-width="3" stroke-dasharray="6,4"/>
    <path d="M160 115 Q210 75 260 115" fill="none" stroke="#c084fc" stroke-width="2" stroke-dasharray="4,4"/>
    <rect x="150" y="40" width="120" height="28" rx="4" fill="#2e1065" stroke="#a855f7" stroke-width="1.5"/>
    <text x="210" y="58" fill="#e9d5ff" font-size="10" font-family="monospace" font-weight="bold" text-anchor="middle">boss_defeated</text>

    <!-- Portal Gate -->
    <ellipse cx="320" cy="125" rx="20" ry="38" fill="#1e1b4b" stroke="#38bdf8" stroke-width="3"/>
    <text x="320" y="130" fill="#7dd3fc" font-size="9" font-family="sans-serif" font-weight="bold" text-anchor="middle">PORTAL</text>
    <text x="320" y="175" fill="#38bdf8" font-size="9" font-family="monospace" text-anchor="middle">unlock_portal</text>
  </svg>`
};

export const BUILTIN_PUZZLES = [
  {
    id: 'puzzle_open_ancient_door',
    title: 'Open the Ancient Door',
    category: 'Mechanism & Tabs',
    difficulty: 'Beginner',
    summary: 'Listen for the player selecting the "Open" Tab on Tab ID 1, then update the door preset status to State 1.',
    author: 'Miliastra Team',
    screenshotKey: 'ancient_door',
    tags: ['Tabs', 'Creation Preset', 'Event Flow'],
    instructions: `
### Objective
In this domain room, an ancient stone gate blocks the path. The door entity has an interaction tab configured with:
- **Tab Name:** Open
- **Tab ID:** 1
- **Preset Status Index:** 10002032
- **Current State:** 0 (Door Closed)
- **Target State:** 1 (Door Opened)

### Mission
Build a node graph that listens for when the **'Open' Tab** is selected (Tab ID = 1), and sets the door complex creation's **Preset Status Value** to **1** on Preset Status Index **10002032**.

### Recommended Nodes:
1. **When Tab Is Selected** (Event Node - XIV. Tabs)
2. **Set the Preset Status Value of the Complex Creation** (Execution Node - L. Creation Preset Status)

Connect the execution wire from the Tab event to the Preset status setter!
    `,
    initialGraph: {
      name: 'Puzzle: Open the Ancient Door',
      nodes: [],
      wires: [],
      comments: [],
      notes: [
        {
          id: 'note_obj_door',
          x: 100,
          y: 80,
          width: 380,
          height: 320,
          title: 'Objective: Open the Ancient Door',
          content: `# Objective: Open the Ancient Door\n\nThe door entity has an interaction tab:\n- **Tab Name:** "Open"\n- **Tab ID:** 1\n- **Preset Index:** 10002032\n- **Current State:** 0 (Closed)\n- **Target State:** 1 (Opened)\n\n## Goal\nWhen player selects Tab ID 1, set the creation's preset status index **10002032** to **1**!`,
          color: '#1e293b',
          screenshotKey: 'ancient_door'
        },
        {
          id: 'note_hint_door',
          x: 520,
          y: 80,
          width: 340,
          height: 220,
          title: 'Tips & Required Nodes',
          content: `### Steps to Solve:\n1. Press **Space** or open Node Library (XIV. Tabs)\n2. Add **When Tab Is Selected**\n3. Add **Set the Preset Status Value of the Complex Creation** (L. Creation Preset Status)\n4. Set **Preset Status Index** to \`10002032\` and **Preset Status Value** to \`1\`\n5. Connect the execution wires and click **Check Solution & Simulate**!`,
          color: '#172554'
        }
      ]
    },
    validation: {
      requiredBlueprints: [
        'event_when_tab_selected',
        'exec_set_the_preset_status_value_of_the_complex_creation'
      ],
      check: (graphState, simState) => {
        // 1. Check if the required nodes exist
        const hasTabEvent = graphState.nodes.some(n => n.blueprintId === 'event_when_tab_selected');
        const hasPresetSetter = graphState.nodes.some(n => n.blueprintId === 'exec_set_the_preset_status_value_of_the_complex_creation');
        if (!hasTabEvent || !hasPresetSetter) {
          return {
            success: false,
            message: 'Graph is missing required nodes: "When Tab Is Selected" and "Set the Preset Status Value of the Complex Creation".'
          };
        }

        // 2. Check execution connection between Tab event and Preset setter
        const tabNode = graphState.nodes.find(n => n.blueprintId === 'event_when_tab_selected');
        const setterNode = graphState.nodes.find(n => n.blueprintId === 'exec_set_the_preset_status_value_of_the_complex_creation');

        const wireConnected = graphState.wires.some(w => 
          (w.fromNode === tabNode.id && w.toNode === setterNode.id && w.isExec) ||
          (w.fromNode === tabNode.id && w.isExec)
        );

        if (!wireConnected) {
          return {
            success: false,
            message: 'Connect the execution wire from "When Tab Is Selected" to "Set the Preset Status Value of the Complex Creation"!'
          };
        }

        // 3. Check preset status index and value in node parameters or simulation
        const idx = setterNode.inputValues?.['Preset Status Index'] || '10002032';
        const val = setterNode.inputValues?.['Preset Status Value'] || '1';

        const indexMatch = String(idx).trim() === '10002032';
        const valueMatch = String(val).trim() === '1';

        // Check if simulator recorded state 1 on index 10002032
        const simPreset = simState?.presetStates?.['10002032'];
        const simSolved = simPreset === 1;

        if ((indexMatch && valueMatch) || simSolved) {
          return {
            success: true,
            message: 'Door preset 10002032 changed to State 1! The ancient door grinds open and reveals the domain chamber!'
          };
        }

        return {
          success: false,
          message: `Preset index must be 10002032 and Preset value must be 1 (found Index: "${idx}", Value: "${val}").`
        };
      }
    },
    solution: {
      explanation: 'Listen to the "When Tab Is Selected" event (Tab ID 1), then wire its execution output to "Set the Preset Status Value of the Complex Creation" with Preset Status Index 10002032 and Value 1.',
      graph: {
        nodes: [
          {
            id: 'sol_tab_event',
            blueprintId: 'event_when_tab_selected',
            name: 'When Tab Is Selected',
            category: 'event',
            x: 200,
            y: 440,
            inputValues: { 'Tab ID': '1' }
          },
          {
            id: 'sol_preset_setter',
            blueprintId: 'exec_set_the_preset_status_value_of_the_complex_creation',
            name: 'Set the Preset Status Value of the Complex Creation',
            category: 'execution',
            x: 580,
            y: 440,
            inputValues: {
              'Preset Status Index': '10002032',
              'Preset Status Value': '1'
            }
          }
        ],
        wires: [
          {
            id: 'sol_wire_1',
            fromNode: 'sol_tab_event',
            fromPin: 'execOut',
            toNode: 'sol_preset_setter',
            toPin: 'execIn',
            isExec: true
          }
        ]
      }
    }
  },

  {
    id: 'puzzle_lever_gate',
    title: 'Security Barrier Lever',
    category: 'Conditionals & Flow',
    difficulty: 'Intermediate',
    summary: 'When the lever is pulled, check if player has the security keycard. If true, deactivate the barrier tab; else print a red warning.',
    author: 'Miliastra Team',
    screenshotKey: 'lever_barrier',
    tags: ['Double Branch', 'Conditionals', 'Tabs'],
    instructions: `
### Objective
A laser security barrier blocks the exit. A lever entity sits nearby.
When the lever is activated:
1. Check the condition (e.g. from an Equal operator or Boolean variable).
2. If True (Yes branch), call **Activate or Disable Tab** with **Activate: No** on Tab ID 2 (deactivating the barrier).
3. If False (No branch), call **Print String** with warning text.

### Recommended Nodes:
1. **Double Branch** (Flow Control)
2. **Activate or Disable Tab** (XIV. Tabs)
3. **Print String** (Execution)
    `,
    initialGraph: {
      name: 'Puzzle: Security Barrier Lever',
      nodes: [
        {
          id: 'pz2_tab_event',
          blueprintId: 'event_when_tab_selected',
          name: 'When Tab Is Selected',
          category: 'event',
          x: 160,
          y: 450,
          inputValues: { 'Tab ID': '10' }
        }
      ],
      wires: [],
      comments: [],
      notes: [
        {
          id: 'pz2_note_1',
          x: 160,
          y: 80,
          width: 380,
          height: 320,
          title: 'Objective: Security Barrier Lever',
          content: `# Security Barrier Verification\n\nThe lever sends Tab ID \`10\`.\nCheck if the condition is valid using **Double Branch**:\n- **Yes branch:** Disable laser barrier (**Activate or Disable Tab**, Tab ID: 2, Activate: 'No')\n- **No branch:** Print string alert 'Access Denied!'`,
          color: '#1e293b',
          screenshotKey: 'lever_barrier'
        }
      ]
    },
    validation: {
      requiredBlueprints: ['flow_double_branch', 'exec_activate_disable_tab'],
      check: (graphState, simState) => {
        const hasBranch = graphState.nodes.some(n => n.blueprintId === 'flow_double_branch');
        const hasTabExec = graphState.nodes.some(n => n.blueprintId === 'exec_activate_disable_tab');
        if (!hasBranch || !hasTabExec) {
          return {
            success: false,
            message: 'Graph must contain both a "Double Branch" and an "Activate or Disable Tab" node.'
          };
        }

        const tabNode = graphState.nodes.find(n => n.blueprintId === 'exec_activate_disable_tab');
        const branchWire = graphState.wires.some(w => w.toNode === tabNode.id && (w.fromPin === 'Yes' || w.fromPin === 'execOut'));

        if (!branchWire) {
          return {
            success: false,
            message: 'Wire the "Yes" branch of Double Branch to "Activate or Disable Tab"!'
          };
        }

        return {
          success: true,
          message: 'Barrier unlocked! Laser grid successfully deactivated on the Yes branch.'
        };
      }
    },
    solution: {
      explanation: 'Wire When Tab Is Selected -> Double Branch. On Yes branch, connect to Activate or Disable Tab (Tab ID 2, Activate: No). On No branch, connect to Print String.',
      graph: {
        nodes: [
          {
            id: 'sol_pz2_event',
            blueprintId: 'event_when_tab_selected',
            name: 'When Tab Is Selected',
            category: 'event',
            x: 160,
            y: 440,
            inputValues: { 'Tab ID': '10' }
          },
          {
            id: 'sol_pz2_branch',
            blueprintId: 'flow_double_branch',
            name: 'Double Branch',
            category: 'flow',
            x: 520,
            y: 440,
            inputValues: { 'Condition': 'True' }
          },
          {
            id: 'sol_pz2_disable_tab',
            blueprintId: 'exec_activate_disable_tab',
            name: 'Activate or Disable Tab',
            category: 'execution',
            x: 860,
            y: 380,
            inputValues: { 'Tab ID': '2', 'Activate': 'No' }
          },
          {
            id: 'sol_pz2_print',
            blueprintId: 'exec_print_string',
            name: 'Print String',
            category: 'execution',
            x: 860,
            y: 560,
            inputValues: { 'String': 'Access Denied!' }
          }
        ],
        wires: [
          { id: 'w1', fromNode: 'sol_pz2_event', fromPin: 'execOut', toNode: 'sol_pz2_branch', toPin: 'execIn', isExec: true },
          { id: 'w2', fromNode: 'sol_pz2_branch', fromPin: 'Yes', toNode: 'sol_pz2_disable_tab', toPin: 'execIn', isExec: true },
          { id: 'w3', fromNode: 'sol_pz2_branch', fromPin: 'No', toNode: 'sol_pz2_print', toPin: 'execIn', isExec: true }
        ]
      }
    }
  },

  {
    id: 'puzzle_loot_spawner',
    title: 'Domain Chest Spawner Loop',
    category: 'Loops & Iteration',
    difficulty: 'Intermediate',
    summary: 'Use a Finite Loop to iterate 4 times (0 to 3) to print reward drops and finish domain completion.',
    author: 'Miliastra Team',
    screenshotKey: 'loot_spawner',
    tags: ['Finite Loop', 'Iteration', 'Strings'],
    instructions: `
### Objective
When domain clears, spawn 4 reward drops using a **Finite Loop**:
- Start: 0
- End: 3
Inside the **Loop Body**, connect to **Print String** (printing the current loot drop index).
When finished, connect **Loop Complete** to Print String saying "All Rewards Dispensed!".

### Recommended Nodes:
1. **Finite Loop** (Loop Nodes)
2. **Print String** (Execution)
    `,
    initialGraph: {
      name: 'Puzzle: Domain Chest Spawner Loop',
      nodes: [],
      wires: [],
      comments: [],
      notes: [
        {
          id: 'pz3_note_1',
          x: 120,
          y: 80,
          width: 400,
          height: 320,
          title: 'Objective: 4-Chest Reward Loop',
          content: `# Finite Loop Reward Spawner\n\nConfigure a **Finite Loop**:\n- **Start:** \`0\`\n- **End:** \`3\`\n- **Loop Body:** Wire to **Print String** to output each drop.\n- **Loop Complete:** Wire to **Print String** with "All Rewards Dispensed!".`,
          color: '#1e293b',
          screenshotKey: 'loot_spawner'
        }
      ]
    },
    validation: {
      requiredBlueprints: ['exec_finite_loop', 'exec_print_string'],
      check: (graphState, simState) => {
        const loopNode = graphState.nodes.find(n => n.blueprintId === 'exec_finite_loop');
        if (!loopNode) {
          return { success: false, message: 'Missing "Finite Loop" node in graph.' };
        }
        const start = parseInt(loopNode.inputValues?.['Start'] || '0', 10);
        const end = parseInt(loopNode.inputValues?.['End'] || '3', 10);
        if (start !== 0 || end !== 3) {
          return { success: false, message: `Finite Loop Start must be 0 and End must be 3 (currently Start: ${start}, End: ${end}).` };
        }
        const hasBodyWire = graphState.wires.some(w => w.fromNode === loopNode.id && w.fromPin === 'Loop Body');
        if (!hasBodyWire) {
          return { success: false, message: 'Wire the "Loop Body" pin of Finite Loop to an execution node.' };
        }
        return { success: true, message: 'Finite loop successfully iterated 4 times (0 to 3) dispensing all chests!' };
      }
    },
    solution: {
      explanation: 'Finite Loop with Start: 0, End: 3. Wire Loop Body to Print String and Loop Complete to Print String.',
      graph: {
        nodes: [
          {
            id: 'sol_pz3_loop',
            blueprintId: 'exec_finite_loop',
            name: 'Finite Loop',
            category: 'execution',
            x: 240,
            y: 440,
            inputValues: { 'Start': '0', 'End': '3' }
          },
          {
            id: 'sol_pz3_body',
            blueprintId: 'exec_print_string',
            name: 'Print String',
            category: 'execution',
            x: 640,
            y: 400,
            inputValues: { 'String': 'Loot Chest Spawned!' }
          },
          {
            id: 'sol_pz3_done',
            blueprintId: 'exec_print_string',
            name: 'Print String',
            category: 'execution',
            x: 640,
            y: 560,
            inputValues: { 'String': 'All Rewards Dispensed!' }
          }
        ],
        wires: [
          { id: 'w1', fromNode: 'sol_pz3_loop', fromPin: 'Loop Body', toNode: 'sol_pz3_body', toPin: 'execIn', isExec: true },
          { id: 'w2', fromNode: 'sol_pz3_loop', fromPin: 'Loop Complete', toNode: 'sol_pz3_done', toPin: 'execIn', isExec: true }
        ]
      }
    }
  },

  {
    id: 'puzzle_signal_relay',
    title: 'Boss Defeated Signal Relay',
    category: 'Signals & Communication',
    difficulty: 'Advanced',
    summary: 'Monitor the broadcast signal "boss_defeated", then send custom broadcast signal "unlock_portal" to open the arena exit.',
    author: 'Miliastra Team',
    screenshotKey: 'signal_relay',
    tags: ['Signals', 'Broadcast', 'Event Monitor'],
    instructions: `
### Objective
When the domain boss is slain, the server broadcasts signal \`boss_defeated\`.
Build a graph that:
1. Listens with **Monitor Custom Signal** on signal name \`boss_defeated\`.
2. Emits **Send Custom Signal** with signal name \`unlock_portal\` to unlock the exit portal.

### Recommended Nodes:
1. **Monitor Custom Signal** (Event Nodes - Signal)
2. **Send Custom Signal** (Execution Nodes - Signal)
    `,
    initialGraph: {
      name: 'Puzzle: Boss Defeated Signal Relay',
      nodes: [],
      wires: [],
      comments: [],
      notes: [
        {
          id: 'pz4_note_1',
          x: 120,
          y: 80,
          width: 420,
          height: 320,
          title: 'Objective: Signal Relay',
          content: `# Broadcast Signal Relay\n\n1. Add **Monitor Custom Signal** and set Signal Name to \`boss_defeated\`.\n2. Add **Send Custom Signal** and set Signal Name to \`unlock_portal\`.\n3. Connect execution from monitor to send!`,
          color: '#1e293b',
          screenshotKey: 'signal_relay'
        }
      ]
    },
    validation: {
      requiredBlueprints: ['event_monitor_signal', 'exec_send_signal'],
      check: (graphState, simState) => {
        const monNode = graphState.nodes.find(n => n.blueprintId === 'event_monitor_signal');
        const sendNode = graphState.nodes.find(n => n.blueprintId === 'exec_send_signal');
        if (!monNode || !sendNode) {
          return { success: false, message: 'Missing "Monitor Custom Signal" or "Send Custom Signal" node.' };
        }
        const monSig = monNode.inputValues?.['Signal Name'] || '';
        const sendSig = sendNode.inputValues?.['Signal Name'] || '';
        if (monSig.trim() !== 'boss_defeated') {
          return { success: false, message: `Monitor Custom Signal must listen to "boss_defeated" (currently: "${monSig}").` };
        }
        if (sendSig.trim() !== 'unlock_portal') {
          return { success: false, message: `Send Custom Signal must transmit "unlock_portal" (currently: "${sendSig}").` };
        }
        const isWired = graphState.wires.some(w => w.fromNode === monNode.id && w.toNode === sendNode.id && w.isExec);
        if (!isWired) {
          return { success: false, message: 'Wire the execution from Monitor Custom Signal to Send Custom Signal!' };
        }
        return { success: true, message: 'Signal relay confirmed! Exit portal unlocked upon boss defeat!' };
      }
    },
    solution: {
      explanation: 'Monitor Custom Signal ("boss_defeated") -> Send Custom Signal ("unlock_portal").',
      graph: {
        nodes: [
          {
            id: 'sol_pz4_mon',
            blueprintId: 'event_monitor_signal',
            name: 'Monitor Custom Signal',
            category: 'event',
            x: 200,
            y: 440,
            inputValues: { 'Signal Name': 'boss_defeated' }
          },
          {
            id: 'sol_pz4_send',
            blueprintId: 'exec_send_signal',
            name: 'Send Custom Signal',
            category: 'execution',
            x: 620,
            y: 440,
            inputValues: { 'Signal Name': 'unlock_portal' }
          }
        ],
        wires: [
          { id: 'w1', fromNode: 'sol_pz4_mon', fromPin: 'execOut', toNode: 'sol_pz4_send', toPin: 'execIn', isExec: true }
        ]
      }
    }
  }
];

const CUSTOM_PUZZLES_KEY = 'miliastra_custom_puzzles_store_v1';

export function getCustomPuzzles() {
  try {
    const raw = localStorage.getItem(CUSTOM_PUZZLES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to read custom puzzles from storage', err);
    return [];
  }
}

export function saveCustomPuzzle(puzzle) {
  try {
    const current = getCustomPuzzles();
    const existingIdx = current.findIndex(p => p.id === puzzle.id);
    if (existingIdx >= 0) {
      current[existingIdx] = puzzle;
    } else {
      current.push(puzzle);
    }
    localStorage.setItem(CUSTOM_PUZZLES_KEY, JSON.stringify(current));
    return true;
  } catch (err) {
    console.error('Failed to save custom puzzle', err);
    return false;
  }
}

export function deleteCustomPuzzle(puzzleId) {
  try {
    const current = getCustomPuzzles();
    const filtered = current.filter(p => p.id !== puzzleId);
    localStorage.setItem(CUSTOM_PUZZLES_KEY, JSON.stringify(filtered));
    return true;
  } catch (err) {
    return false;
  }
}

export function getAllPuzzles() {
  const custom = getCustomPuzzles();
  return [...BUILTIN_PUZZLES, ...custom];
}

export function getPuzzleById(id) {
  const all = getAllPuzzles();
  return all.find(p => p.id === id) || null;
}
