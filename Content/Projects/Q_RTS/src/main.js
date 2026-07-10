import { Simulation } from './simulation.js';
import { MothershipBase } from './mothership/base.js';
import { ConquestBattle } from './maps/conquest.js';

// DOM Elements
const canvas = document.getElementById('sim-canvas');
const qmDisplay = document.getElementById('qm-display');
const buildFighter = document.getElementById('build-fighter');
const buildCruiser = document.getElementById('build-cruiser');
const buildDreadnought = document.getElementById('build-dreadnought');
const btnRecall = document.getElementById('btn-recall');
const btnHyperjump = document.getElementById('btn-hyperjump');
const btnSpawnEnemy = document.getElementById('btn-spawn-enemy');
const btnTriggerStorm = document.getElementById('btn-trigger-storm');
const btnHealSpacetime = document.getElementById('btn-heal-spacetime');
const btnToggleDeployTool = document.getElementById('btn-toggle-deploy-tool');
const selectionDeck = document.getElementById('selection-deck');
const radarCanvas = document.getElementById('radar-canvas');
const tabTactical = document.getElementById('tab-tactical');
const hudFleetCount = document.getElementById('hud-fleet-count');
const hudCamCoords = document.getElementById('hud-cam-coords');
const hudThreatLevel = document.getElementById('hud-threat-level');
const eventLogList = document.getElementById('event-log-list');
const clockDisplay = document.getElementById('clock-display');
const sectorThreatLabel = document.getElementById('sector-threat');

// Core Simulation Instance
let sim = null;
let activeMode = 'cosmic'; // 'cosmic', 'mothership', 'conquest'
let mothershipBase = null; // instance of MothershipBase
let conquestBattle = null; // instance of ConquestBattle

// Game State tracking
const keysPressed = {};
let mousePos = { x: 0, y: 0 };
window.mousePos = mousePos;
let debugMenuVisible = false;
let lastToolClickTime = 0;
let isCameraDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let camStartX = 0;
let camStartY = 0;
let clickDistance = 0;

// Log message queue helper
function appendLog(message) {
  if (!eventLogList) return;
  const line = document.createElement('div');
  line.innerHTML = `&gt; ${message}`;
  eventLogList.appendChild(line);
  eventLogList.scrollTop = eventLogList.scrollHeight;
  
  // Keep logs list trimmed to prevent performance memory bloat
  while (eventLogList.childNodes.length > 200) {
    eventLogList.removeChild(eventLogList.firstChild);
  }
}
window.appendLog = appendLog; // Expose to Simulation engine

// Initialize application
function initApp() {
  if (!canvas) return;

  // Set canvas scale to fill containment window
  const container = canvas.parentElement;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;

  // Spin up Simulation class
  sim = new Simulation(canvas);
  sim.mousePos = mousePos;

  // Resize listener
  window.addEventListener('resize', () => {
    if (sim) {
      sim.resize(container.clientWidth, container.clientHeight);
    }
  });

  // Bind shipyard blueprints buttons
  buildFighter.addEventListener('click', () => {
    if (sim.qm >= 50) {
      sim.qm -= 50;
      sim.spawnShip('fighter', -100 + Math.random() * 50, -50 + Math.random() * 100);
    } else {
      appendLog("<span class='text-red'>BLUEPRINT_REJECTED: INSUFFICIENT QM FOR FT-FIGHTER (50 QM REQUIRED).</span>");
    }
  });

  buildCruiser.addEventListener('click', () => {
    if (sim.qm >= 150) {
      sim.qm -= 150;
      sim.spawnShip('cruiser', -120 + Math.random() * 60, -60 + Math.random() * 120);
    } else {
      appendLog("<span class='text-red'>BLUEPRINT_REJECTED: INSUFFICIENT QM FOR CR-CRUISER (150 QM REQUIRED).</span>");
    }
  });

  buildDreadnought.addEventListener('click', () => {
    if (sim.qm >= 450) {
      sim.qm -= 450;
      sim.spawnShip('dreadnought', -150 + Math.random() * 80, -80 + Math.random() * 160);
    } else {
      appendLog("<span class='text-red'>BLUEPRINT_REJECTED: INSUFFICIENT QM FOR DN-DREADNOUGHT (450 QM REQUIRED).</span>");
    }
  });

  // Fleet command utilities
  btnRecall.addEventListener('click', () => {
    sim.recallFleet();
  });

  btnHyperjump.addEventListener('click', () => {
    sim.hyperjumpCarrier();
  });

  btnSpawnEnemy.addEventListener('click', () => {
    sim.summonEnemies();
  });

  btnTriggerStorm.addEventListener('click', () => {
    sim.triggerSpacetimeStorm();
  });

  if (btnHealSpacetime) {
    btnHealSpacetime.addEventListener('click', () => {
       sim.triggerSpacetimeHealPulse();
    });
  }

  const btnBuildSymmetricGuns = document.getElementById('btn-build-symmetric-guns');
  if (btnBuildSymmetricGuns) {
    btnBuildSymmetricGuns.addEventListener('click', () => {
      if (!mothershipBase) return;
      const inv = mothershipBase.inventory;
      if (
        inv.earthElement >= 5 &&
        inv.airElement >= 5 &&
        inv.waterElement >= 5 &&
        inv.metalElement >= 5 &&
        inv.soilElement >= 5 &&
        inv.symmetryCrystal >= 3
      ) {
        inv.earthElement -= 5;
        inv.airElement -= 5;
        inv.waterElement -= 5;
        inv.metalElement -= 5;
        inv.soilElement -= 5;
        inv.symmetryCrystal -= 3;

        sim.carrierSymmetricGunsUpgrade = true;
        // Upgrade carrier ship values inside sim
        const carrier = sim.ships.find(s => s.type === 'carrier');
        if (carrier) {
          carrier.weaponRange = 550;
          carrier.maxCooldown = 40;
          carrier.damage = 150;
        }

        appendLog("📡 UPGRADE_COMPLETE: Flagship Carrier equipped with Symmetric Pulse Laser Arrays! Special energy weapons online.");
      } else {
        appendLog("❌ UPGRADE_BLOCKED: Insufficient elemental resources or Symmetry Crystals. Go to planetary Conquest to collect them!");
      }
    });
  }

  // Debug Spatial Deploy Tool State & Bindings
  window.deployToolActive = false;

  if (btnToggleDeployTool) {
    btnToggleDeployTool.addEventListener('click', () => {
      window.deployToolActive = !window.deployToolActive;
      if (window.deployToolActive) {
        btnToggleDeployTool.textContent = "🔧 DEPLOY_LASER: ACTIVE (Click map)";
        btnToggleDeployTool.style.borderColor = "var(--color-green)";
        btnToggleDeployTool.style.color = "var(--color-green)";
        btnToggleDeployTool.style.background = "rgba(0, 255, 102, 0.08)";
        appendLog("🔧 DEBUG_DEPLOY: Spatial deployment laser ACTIVE. Choose type and left-click on empty space.");
      } else {
        btnToggleDeployTool.textContent = "🔧 DEPLOY_LASER: INACTIVE";
        btnToggleDeployTool.style.borderColor = "var(--color-cyan)";
        btnToggleDeployTool.style.color = "var(--color-cyan)";
        btnToggleDeployTool.style.background = "rgba(0, 229, 255, 0.05)";
        appendLog("🔧 DEBUG_DEPLOY: Spatial deployment laser deactivated.");
      }
    });
  }

  function handleSpatialDeploy(worldX, worldY) {
    if (!sim) return;

    const selectEl = document.getElementById('deploy-type-select');
    if (!selectEl) return;
    const deployType = selectEl.value;
    
    if (deployType === 'citadel') {
      sim.enemies.push({
        id: 'hostile-citadel-' + Math.random().toString(36).substr(2, 5),
        type: 'citadel',
        name: 'Krell Siphon Citadel (DEBUG)',
        x: worldX,
        y: worldY,
        radius: 65,
        mass: 300,
        health: 1200,
        maxHealth: 1200,
        shield: 0,
        damage: 15,
        fireCooldown: 0,
        speed: 0,
        color: '#ff3344',
        gravityRange: 150
      });
      appendLog(`🔧 DEBUG_DEPLOY: Deployed Hostile Citadel at [${Math.round(worldX)}, ${Math.round(worldY)}].`);
    } 
    else if (deployType.startsWith('space_tear_')) {
      const themeId = deployType.replace('space_tear_', '');
      if (!sim.spaceTears) sim.spaceTears = [];
      const isSmall = Math.random() < 0.5;
      sim.spaceTears.push({
        id: `tear-${Date.now()}`,
        x: worldX,
        y: worldY,
        radius: 300,
        themeId: themeId,
        completed: false,
        isSmallGrind: isSmall
      });
      appendLog(`🔧 DEBUG_DEPLOY: Deployed Space Tear [${themeId.toUpperCase()}] at [${Math.round(worldX)}, ${Math.round(worldY)}]. Mode: [${isSmall ? "SMALL_GRIND" : "STANDARD_CONQUEST"}]. Click inside to enter!`);
    } 
    else if (deployType === 'vortex') {
      sim.createVortex(worldX, worldY, 'raid', 2);
      appendLog(`🔧 DEBUG_DEPLOY: Spawned Void Vortex portal at [${Math.round(worldX)}, ${Math.round(worldY)}].`);
    } 
    else if (deployType === 'interceptor') {
      sim.enemies.push({
        id: 'hostile-guard-' + Math.random().toString(36).substr(2, 5),
        type: 'interceptor',
        name: 'Void Raider (DEBUG)',
        x: worldX,
        y: worldY,
        radius: 12,
        mass: 20,
        health: 100,
        maxHealth: 100,
        damage: 8,
        speed: 3.5,
        fireCooldown: 0,
        color: '#ff4444'
      });
      appendLog(`🔧 DEBUG_DEPLOY: Deployed Hostile Raider at [${Math.round(worldX)}, ${Math.round(worldY)}].`);
    } 
    else if (deployType.startsWith('anomaly_')) {
      const anomalyType = deployType === 'anomaly_bh' ? 'black_hole' : 'white_hole';
      sim.blackHoles.push({
        id: 'anomaly-debug-' + Math.random().toString(36).substr(2, 5),
        type: anomalyType,
        x: worldX,
        y: worldY,
        radius: 35,
        gravityRange: 500,
        stability: 0
      });
      appendLog(`🔧 DEBUG_DEPLOY: Deployed Cosmic Anomaly [${anomalyType.toUpperCase()}] at [${Math.round(worldX)}, ${Math.round(worldY)}].`);
    } 
    else if (deployType.startsWith('player_')) {
      const shipType = deployType.replace('player_', '');
      const preset = {
        raider: { name: 'Vanguard Raider', radius: 10, maxHealth: 200, damage: 12 },
        tank: { name: 'Aegis Dreadnought', radius: 16, maxHealth: 600, damage: 25 },
        gunship: { name: 'Xylar Gunship', radius: 11, maxHealth: 300, damage: 18 }
      }[shipType];

      if (preset) {
        sim.ships.push({
          id: 'ship-debug-' + Math.random().toString(36).substr(2, 5),
          type: shipType,
          name: preset.name + ' (DEBUG)',
          x: worldX,
          y: worldY,
          targetX: worldX,
          targetY: worldY,
          radius: preset.radius,
          health: preset.maxHealth,
          maxHealth: preset.maxHealth,
          damage: preset.damage,
          speed: shipType === 'raider' ? 4.5 : shipType === 'tank' ? 2.5 : 3.5,
          selected: false,
          color: '#00ff66'
        });
        appendLog(`🔧 DEBUG_DEPLOY: Deployed Player Escort [${shipType.toUpperCase()}] at [${Math.round(worldX)}, ${Math.round(worldY)}].`);
      }
    }
  }
  window.handleSpatialDeploy = handleSpatialDeploy;

  // Minimap interactive click handling: Centering camera relative to mothership
  if (radarCanvas) {
    radarCanvas.style.cursor = 'crosshair';
    radarCanvas.addEventListener('click', (e) => {
      if (!sim) return;
      const rect = radarCanvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Project coordinates relative to the Carrier/Mothership
      const carrier = sim.ships.find(s => s.type === 'carrier');
      const cx = carrier ? carrier.x : 0;
      const cy = carrier ? carrier.y : 0;
      const scale = 0.045; // World to pixel scale helper

      const targetWorldX = cx + (clickX - radarCanvas.width / 2) / scale;
      const targetWorldY = cy + (clickY - radarCanvas.height / 2) / scale;

      sim.camera.targetX = targetWorldX - sim.width / 2;
      sim.camera.targetY = targetWorldY - sim.height / 2;

      // Add a tactical flash indicator waypoint at the target
      sim.waypoints.push({
        id: `waypoint-${sim.time}`,
        x: targetWorldX,
        y: targetWorldY,
        radius: 6,
        alpha: 1.0,
        color: '#00e5ff'
      });

      appendLog(`🛰️ RADAR_LOCK: SENSORS LOCKED AND VIEWPORT TRANSFERRED TO [${Math.round(targetWorldX)}, ${Math.round(targetWorldY)}].`);
    });
  }

  // Collapsible tactical combat log panel toggle
  const collapsibleLog = document.getElementById('collapsible-log');
  const logHeaderToggle = document.getElementById('log-header-toggle');
  const logToggleIndicator = document.getElementById('log-toggle-indicator');
  
  if (logHeaderToggle && collapsibleLog) {
    logHeaderToggle.addEventListener('click', () => {
      collapsibleLog.classList.toggle('collapsed');
      if (collapsibleLog.classList.contains('collapsed')) {
        logToggleIndicator.textContent = '[+]';
      } else {
        logToggleIndicator.textContent = '[—]';
      }
    });
  }

  // Switch visual mode orchestrator
  function switchMode(newMode) {
    if (newMode === 'grid') {
      newMode = 'cosmic'; // Redirect grid mode to cosmic sector
    }
    activeMode = newMode;
    
    // Update Tab active classes
    const tabTacticalBtn = document.getElementById('tab-tactical');
    const tabMothershipBtn = document.getElementById('tab-mothership');
    const tabConquestBtn = document.getElementById('tab-conquest');
    
    if (tabTacticalBtn) tabTacticalBtn.classList.remove('active');
    if (tabMothershipBtn) tabMothershipBtn.classList.remove('active');
    if (tabConquestBtn) tabConquestBtn.classList.remove('active');
    
    // Show/Hide overlays
    const shipyardHud = document.getElementById('shipyard-hud-overlay');
    const commandHud = document.getElementById('command-hud-overlay');
    const formationHud = document.getElementById('formation-hud-overlay');
    const radarContainer = document.querySelector('.radar-container');
    const controlsOverlay = document.querySelector('.controls-overlay');
    const canvasHud = document.querySelector('.canvas-hud');
    const btnToggleDebugMenu = document.getElementById('btn-toggle-debug-menu');
    
    const mothershipHud = document.getElementById('mothership-hud-overlay');
    const conquestHud = document.getElementById('conquest-hud-overlay');
    const debugDeployHud = document.getElementById('debug-deploy-hud-overlay');
    
    if (newMode === 'cosmic') {
      if (shipyardHud) shipyardHud.style.display = 'flex';
      if (commandHud) commandHud.style.display = 'flex';
      if (formationHud) formationHud.style.display = 'flex';
      if (radarContainer) radarContainer.style.display = 'block';
      if (controlsOverlay) controlsOverlay.style.display = 'block';
      if (canvasHud) canvasHud.style.display = 'block';
      if (btnToggleDebugMenu) btnToggleDebugMenu.style.display = 'flex';
      
      if (debugDeployHud) {
        debugDeployHud.style.display = debugMenuVisible ? 'flex' : 'none';
      }
      
      if (mothershipHud) {
        mothershipHud.style.display = 'none';
        mothershipHud.classList.remove('active');
      }
      if (conquestHud) {
        conquestHud.style.display = 'none';
        conquestHud.classList.remove('active');
      }
      
      if (tabTacticalBtn) tabTacticalBtn.classList.add('active');
      if (sim) sim.renderMode = 'tactical';
    } 
    else if (newMode === 'mothership') {
      if (shipyardHud) shipyardHud.style.display = 'none';
      if (commandHud) commandHud.style.display = 'none';
      if (formationHud) formationHud.style.display = 'none';
      if (radarContainer) radarContainer.style.display = 'none';
      if (controlsOverlay) controlsOverlay.style.display = 'none';
      if (canvasHud) canvasHud.style.display = 'none';
      if (btnToggleDebugMenu) btnToggleDebugMenu.style.display = 'none';
      if (debugDeployHud) debugDeployHud.style.display = 'none';
      
      if (mothershipHud) {
        mothershipHud.style.display = 'block';
        mothershipHud.classList.add('active');
      }
      if (conquestHud) {
        conquestHud.style.display = 'none';
        conquestHud.classList.remove('active');
      }
      
      if (tabMothershipBtn) tabMothershipBtn.classList.add('active');
      
      // Lazy initialize MothershipBase
      if (!mothershipBase && sim) {
        mothershipBase = new MothershipBase(canvas);
        // Sync material stockpile from simulation to mothership
        mothershipBase.inventory.quantumMatter = Math.round(sim.qm);
      }
    } 
    else if (newMode === 'conquest') {
      if (shipyardHud) shipyardHud.style.display = 'none';
      if (commandHud) commandHud.style.display = 'none';
      if (formationHud) formationHud.style.display = 'none';
      if (radarContainer) radarContainer.style.display = 'none';
      if (controlsOverlay) controlsOverlay.style.display = 'none';
      if (canvasHud) canvasHud.style.display = 'none';
      if (btnToggleDebugMenu) btnToggleDebugMenu.style.display = 'none';
      if (debugDeployHud) debugDeployHud.style.display = 'none';
      
      if (mothershipHud) {
        mothershipHud.style.display = 'none';
        mothershipHud.classList.remove('active');
      }
      if (conquestHud) {
        conquestHud.style.display = 'block';
        conquestHud.classList.add('active');
      }
      
      if (tabConquestBtn) tabConquestBtn.classList.add('active');
    }
  }
  window.switchMode = switchMode;

  function launchConquest(themeId, isSmallGrind = false) {
    conquestBattle = new ConquestBattle(canvas, themeId, isSmallGrind);
    
    // Show Conquest tab and make active
    const tabConquestBtn = document.getElementById('tab-conquest');
    if (tabConquestBtn) tabConquestBtn.style.display = 'block';
    
    switchMode('conquest');
  }
  window.launchConquest = launchConquest;

  // Tab buttons layout toggle
  tabTactical.addEventListener('click', () => {
    switchMode('cosmic');
    appendLog("TACTICAL_VIEWPORTS_ENGAGED.");
  });

  // Debug Toggle Button handler
  const btnToggleDebugMenu = document.getElementById('btn-toggle-debug-menu');
  if (btnToggleDebugMenu) {
    btnToggleDebugMenu.addEventListener('click', () => {
      debugMenuVisible = !debugMenuVisible;
      btnToggleDebugMenu.classList.toggle('active', debugMenuVisible);
      const debugDeployHud = document.getElementById('debug-deploy-hud-overlay');
      if (debugDeployHud) {
        debugDeployHud.style.display = debugMenuVisible ? 'flex' : 'none';
      }
      appendLog(`DEBUG_SYSTEM: Spatial deployment overlay ${debugMenuVisible ? "ONLINE" : "OFFLINE"}.`);
    });
  }

  const tabMothershipBtn = document.getElementById('tab-mothership');
  if (tabMothershipBtn) {
    tabMothershipBtn.addEventListener('click', () => {
      switchMode('mothership');
      appendLog("MOTHERSHIP_BASE_ENGAGED: Accessing internal production grid.");
    });
  }

  const tabConquestBtn = document.getElementById('tab-conquest');
  if (tabConquestBtn) {
    tabConquestBtn.addEventListener('click', () => {
      switchMode('conquest');
      appendLog("CONQUEST_MISSION_VIEWPORT_ENGAGED.");
    });
  }

  // Bind Mothership Building Placer tool buttons
  const baseTools = ['extractor', 'belt', 'synthesizer', 'storage', 'assembler', 'deployer'];
  baseTools.forEach(tool => {
    const btn = document.getElementById(`tool-${tool}`);
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const now = Date.now();
        if (now - lastToolClickTime < 150) return;
        lastToolClickTime = now;

        if (!mothershipBase) return;
        
        // Deselect demolish tool if active
        const btnDemolish = document.getElementById('tool-demolish');
        if (btnDemolish) btnDemolish.classList.remove('active');

        if (mothershipBase.selectedTool === tool) {
          mothershipBase.selectedTool = null;
          btn.classList.remove('active');
          appendLog(`MOTHERSHIP_BASE: Deselected placer.`);
        } else {
          baseTools.forEach(t => document.getElementById(`tool-${t}`)?.classList.remove('active'));
          mothershipBase.selectedTool = tool;
          btn.classList.add('active');
          appendLog(`MOTHERSHIP_BASE: Placer equipped [${tool.toUpperCase()}]. Click empty factory grid slot to build.`);
        }
      });
    }
  });

  const btnDemolish = document.getElementById('tool-demolish');
  if (btnDemolish) {
    btnDemolish.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const now = Date.now();
      if (now - lastToolClickTime < 150) return;
      lastToolClickTime = now;

      if (!mothershipBase) return;
      
      // Deactivate other build tools
      baseTools.forEach(t => document.getElementById(`tool-${t}`)?.classList.remove('active'));

      if (mothershipBase.selectedTool === 'demolish') {
        mothershipBase.selectedTool = null;
        btnDemolish.classList.remove('active');
        appendLog(`MOTHERSHIP_BASE: Deselected demolish tool.`);
      } else {
        mothershipBase.selectedTool = 'demolish';
        btnDemolish.classList.add('active');
        appendLog(`MOTHERSHIP_BASE: Demolish laser active. Click placed structures to recycle for full refund.`);
      }
    });
  }

  // Bind Launch Conquest drop button
  const btnLaunchConquest = document.getElementById('btn-launch-conquest');
  const dropThemeSelect = document.getElementById('drop-theme-select');
  if (btnLaunchConquest && dropThemeSelect) {
    btnLaunchConquest.addEventListener('click', () => {
      const theme = dropThemeSelect.value;
      appendLog(`🚀 LAUNCHING DROP: Command ship preparing planetary deployment on biome: [${theme.toUpperCase()}].`);
      launchConquest(theme);
    });
  }

  // Bind Conquest recruit queue buttons
  const buildConquestRaider = document.getElementById('build-conquest-raider');
  const buildConquestTank = document.getElementById('build-conquest-tank');
  const buildConquestGunship = document.getElementById('build-conquest-gunship');
  
  if (buildConquestRaider) {
    buildConquestRaider.addEventListener('click', () => {
      if (conquestBattle) conquestBattle.queueUnit('raider');
    });
  }
  if (buildConquestTank) {
    buildConquestTank.addEventListener('click', () => {
      if (conquestBattle) conquestBattle.queueUnit('tank');
    });
  }
  if (buildConquestGunship) {
    buildConquestGunship.addEventListener('click', () => {
      if (conquestBattle) conquestBattle.queueUnit('gunship');
    });
  }

  // Bind Conquest return button
  const btnConquestReturn = document.getElementById('btn-conquest-return');
  if (btnConquestReturn) {
    btnConquestReturn.addEventListener('click', () => {
      if (conquestBattle) {
        if (conquestBattle.conquestWon) {
          // Grant substantial rewards
          sim.qm = Math.min(sim.maxQm, sim.qm + 1000);
          if (mothershipBase) {
            mothershipBase.inventory.exoticCores += 10;
            mothershipBase.inventory.zodiacTethers += 5;
            mothershipBase.inventory.quantumMatter += 1000;
          }
          appendLog(`🏆 CLAIMED REWARDS: Transmuted and claimed drop cargo! +1000 QM, +10 Exotic Cores, +5 Zodiac Tethers.`);
          
          // Clear any nearby enemies and close vortices
          sim.enemies = [];
          sim.vortices = [];
          
          // Clear nearest Space Tear
          const carrier = sim.ships.find(s => s.type === 'carrier');
          if (carrier && sim.spaceTears) {
            sim.spaceTears = sim.spaceTears.filter(t => {
              const dx = t.x - carrier.x;
              const dy = t.y - carrier.y;
              return Math.sqrt(dx*dx + dy*dy) > 500;
            });
          }
        } else {
          appendLog(`↩ RETREATING: Retreated to Orbit. Planetary bases salvaged and infantry returned.`);
        }
      }
      switchMode('cosmic');
    });
  }

  // Prevent default context menu on right click to allow piloting orders
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // Mouse interactivity handlers
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeMode === 'cosmic' || activeMode === 'grid') {
      if (e.button === 0) {
        if (window.deployToolActive) {
          const worldPos = sim.screenToWorld(x, y);
          window.handleSpatialDeploy(worldPos.x, worldPos.y);
          return;
        }
        // Left click: Selection Marquee Start
        sim.selectionStart = { x: x, y: y };
        sim.selectionEnd = { x: x, y: y };
        sim.isDragging = true;
        clickDistance = 0;

        // Selection has priority: disable pointer events on the minimap during active drag selection
        const radarContainer = document.querySelector('.radar-container');
        if (radarContainer) {
          radarContainer.style.pointerEvents = 'none';
        }
      } else if (e.button === 1) {
        // Middle click: Drag Camera map
        isCameraDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        camStartX = sim.camera.targetX;
        camStartY = sim.camera.targetY;
        clickDistance = 0;
      }
    } 
    else if (activeMode === 'mothership' && mothershipBase) {
      if (e.button === 0) {
        mothershipBase.handleClick(x, y, e.shiftKey);
      } else if (e.button === 2) {
        e.preventDefault();
        if (mothershipBase.selectedTool) {
          mothershipBase.selectedTool = null;
          // Deactivate all button UI highlights
          const baseTools = ['extractor', 'belt', 'synthesizer', 'storage', 'assembler', 'deployer'];
          baseTools.forEach(t => {
            const btn = document.getElementById(`tool-${t}`);
            if (btn) btn.classList.remove('active');
          });
          const demolishBtn = document.getElementById('tool-demolish');
          if (demolishBtn) demolishBtn.classList.remove('active');
          appendLog("MOTHERSHIP_BASE: Deselected active placer tool.");
        }
      }
    } 
    else if (activeMode === 'conquest' && conquestBattle) {
      if (e.button === 0) {
        // Left click: Selection Marquee Start
        conquestBattle.selectionStart = { x: x, y: y };
        conquestBattle.selectionEnd = { x: x, y: y };
        conquestBattle.isDragging = true;
        clickDistance = 0;
      } else if (e.button === 1) {
        // Middle click: Drag Camera map
        isCameraDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        camStartX = conquestBattle.camera.targetX;
        camStartY = conquestBattle.camera.targetY;
        clickDistance = 0;
      }
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    mousePos.x = x;
    mousePos.y = y;

    if (activeMode === 'cosmic' || activeMode === 'grid') {
      if (sim.isDragging) {
        sim.selectionEnd = { x: x, y: y };
        clickDistance += Math.abs(e.movementX) + Math.abs(e.movementY);
      } else if (isCameraDragging) {
        const zoom = sim.camera.zoom || 1.0;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        sim.camera.targetX = camStartX - dx / zoom;
        sim.camera.targetY = camStartY - dy / zoom;
        clickDistance += Math.abs(dx) + Math.abs(dy);
      }
    } 
    else if (activeMode === 'conquest' && conquestBattle) {
      if (conquestBattle.isDragging) {
        conquestBattle.selectionEnd = { x: x, y: y };
        clickDistance += Math.abs(e.movementX) + Math.abs(e.movementY);
      } else if (isCameraDragging) {
        const zoom = conquestBattle.camera.zoom || 1.0;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        conquestBattle.camera.targetX = camStartX - dx / zoom;
        conquestBattle.camera.targetY = camStartY - dy / zoom;
        clickDistance += Math.abs(dx) + Math.abs(dy);
      }
    }
  });

  canvas.addEventListener('mouseup', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Restore minimap interactive pointer events
    const radarContainer = document.querySelector('.radar-container');
    if (radarContainer) {
      radarContainer.style.pointerEvents = 'auto';
    }

    if (activeMode === 'cosmic' || activeMode === 'grid') {
      if (e.button === 0 && sim.isDragging) {
        sim.isDragging = false;
        
        // If was quick click/tap select individual ship (generous 22px deadzone for shake)
        if (clickDistance < 22) {
          const worldPos = sim.screenToWorld(x, y);
          const worldX = worldPos.x;
          const worldY = worldPos.y;

          // Check click inside Space Tears first!
          if (sim.spaceTears && sim.spaceTears.length > 0) {
            const clickedTear = sim.spaceTears.find(t => {
              const dx = worldPos.x - t.x;
              const dy = worldPos.y - t.y;
              return Math.sqrt(dx*dx + dy*dy) < t.radius;
            });
            if (clickedTear) {
              appendLog(`🚀 VOID_TEAR_ENGAGED: Transitioning fleet inside spacetime rip. Drop target theme: [${clickedTear.themeId.toUpperCase()}].`);
              launchConquest(clickedTear.themeId, clickedTear.isSmallGrind);
              sim.selectionStart = null;
              sim.selectionEnd = null;
              return;
            }
          }

          let selectedAny = false;
          
          // Prioritize clicking fleet escorts or carrier
          sim.ships.forEach(ship => {
            const dx = ship.x - worldX;
            const dy = ship.y - worldY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < ship.radius * 1.5 && !selectedAny) {
              ship.selected = true;
              selectedAny = true;
              appendLog(`SELECTED_UNIT: ${ship.name.toUpperCase()} ACTIVATED.`);
            } else {
              ship.selected = false;
            }
          });

          if (!selectedAny) {
            // Clear selections
            sim.ships.forEach(s => s.selected = false);
          }
        } else {
          // Drag select box evaluation
          const p1 = sim.screenToWorld(sim.selectionStart.x, sim.selectionStart.y);
          const p2 = sim.screenToWorld(x, y);
          sim.handleDragSelection(p1.x, p1.y, p2.x, p2.y);
        }

        sim.selectionStart = null;
        sim.selectionEnd = null;

      } else if (e.button === 2) {
        // Right click: Order movement instantly
        const worldPos = sim.screenToWorld(x, y);
        const worldX = worldPos.x;
        const worldY = worldPos.y;
        sim.orderMovement(worldX, worldY);
      } else if (e.button === 1 && isCameraDragging) {
        isCameraDragging = false;
      }
    } 
    else if (activeMode === 'conquest' && conquestBattle) {
      if (e.button === 0 && conquestBattle.isDragging) {
        conquestBattle.isDragging = false;
        
        if (clickDistance < 22) {
          const worldPos = conquestBattle.screenToWorld(x, y);
          
          // Check if click is inside the center of the Mothership (the portal gateway!)
          const ms = conquestBattle.mothership;
          const mdx = worldPos.x - ms.x;
          const mdy = worldPos.y - ms.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mdist < ms.radius - 12) {
            switchMode('mothership');
            appendLog("🌌 CORE_GATEWAY: Entering internal Mothership assembly base deck.");
            conquestBattle.selectionStart = null;
            conquestBattle.selectionEnd = null;
            return;
          }

          let selectedAny = false;
          conquestBattle.playerUnits.forEach(unit => {
            const dx = unit.x - worldPos.x;
            const dy = unit.y - worldPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < unit.radius * 2.2 && !selectedAny) {
              unit.selected = true;
              selectedAny = true;
            } else {
              unit.selected = false;
            }
          });
        } else {
          const p1 = conquestBattle.screenToWorld(conquestBattle.selectionStart.x, conquestBattle.selectionStart.y);
          const p2 = conquestBattle.screenToWorld(x, y);
          conquestBattle.handleDragSelection(p1.x, p1.y, p2.x, p2.y);
        }
        
        conquestBattle.selectionStart = null;
        conquestBattle.selectionEnd = null;
      } else if (e.button === 2) {
        const worldPos = conquestBattle.screenToWorld(x, y);
        conquestBattle.orderMovement(worldPos.x, worldPos.y);
      } else if (e.button === 1 && isCameraDragging) {
        isCameraDragging = false;
      }
    }
  });

  // Zoom on wheel scroll: zoom in/out with mouse wheel centering
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (activeMode === 'cosmic' || activeMode === 'grid') {
      if (!sim) return;

      const zoomSpeed = 0.08;
      const oldZoom = sim.camera.zoom || 1.0;
      let newZoom = oldZoom;

      if (e.deltaY < 0) {
        newZoom = Math.min(2.2, oldZoom + zoomSpeed);
      } else {
        newZoom = Math.max(0.12, oldZoom - zoomSpeed);
      }

      sim.camera.zoom = newZoom;
      appendLog(`VIEWPORT_ZOOM: Magnification set to ${Math.round(newZoom * 100)}%.`);
    } else if (activeMode === 'conquest' && conquestBattle) {
      const zoomSpeed = 0.08;
      const oldZoom = conquestBattle.camera.zoom || 1.0;
      let newZoom = oldZoom;

      if (e.deltaY < 0) {
        newZoom = Math.min(1.8, oldZoom + zoomSpeed);
      } else {
        newZoom = Math.max(0.2, oldZoom - zoomSpeed);
      }

      conquestBattle.camera.zoom = newZoom;
    }
  }, { passive: false });

  // Double click selects all units of the same type OR handles quick toggles on mothership base
  canvas.addEventListener('dblclick', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeMode === 'cosmic' || activeMode === 'grid') {
      const worldPos = sim.screenToWorld(x, y);
      
      // Find if a ship was double-clicked
      let clickedShip = null;
      for (let i = 0; i < sim.ships.length; i++) {
        const ship = sim.ships[i];
        const dx = ship.x - worldPos.x;
        const dy = ship.y - worldPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < ship.radius * 1.8) {
          clickedShip = ship;
          break;
        }
      }

      if (clickedShip) {
        const targetType = clickedShip.type;
        let selectCount = 0;
        sim.ships.forEach(ship => {
          if (ship.type === targetType) {
            ship.selected = true;
            selectCount++;
          } else {
            ship.selected = false;
          }
        });
        appendLog(`DBL_CLICK_SELECT: Selected all ${selectCount} units of type ${targetType.toUpperCase()}.`);
      }
    } else if (activeMode === 'mothership' && mothershipBase) {
      mothershipBase.handleDoubleClick(x, y);
    }
  });

  // Track WASD keys for map scrolling
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    keysPressed[key] = true;
    
    if (activeMode === 'mothership' && mothershipBase) {
      if (key === 'r') {
        mothershipBase.handleRotateKey();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    keysPressed[e.key.toLowerCase()] = false;
  });

  // Initialize loop
  tickGameLoop();
}

// Keyboard scrolling camera speed
const scrollSpeed = 14;

// Continuous keyboard / edge scrolling ticks
function handleCameraScrolling() {
  if (activeMode === 'cosmic' || activeMode === 'grid') {
    if (!sim) return;

    // WASD / Arrows
    if (keysPressed['w'] || keysPressed['arrowup']) sim.camera.targetY -= scrollSpeed;
    if (keysPressed['s'] || keysPressed['arrowdown']) sim.camera.targetY += scrollSpeed;
    if (keysPressed['a'] || keysPressed['arrowleft']) sim.camera.targetX -= scrollSpeed;
    if (keysPressed['d'] || keysPressed['arrowright']) sim.camera.targetX += scrollSpeed;

    // Edge panning (only if mouse inside window frame bounds)
    const pad = 35;
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;

    if (mousePos.x >= 0 && mousePos.x <= canvasWidth && mousePos.y >= 0 && mousePos.y <= canvasHeight) {
      if (mousePos.x < pad) sim.camera.targetX -= scrollSpeed * 0.8;
      if (mousePos.x > canvasWidth - pad) sim.camera.targetX += scrollSpeed * 0.8;
      if (mousePos.y < pad) sim.camera.targetY -= scrollSpeed * 0.8;
      if (mousePos.y > canvasHeight - pad) sim.camera.targetY += scrollSpeed * 0.8;
    }

    // Constrain endless target map drift to prevent infinite scroll out of bounds
    const mapBound = 9999999;
    sim.camera.targetX = Math.max(-mapBound, Math.min(mapBound, sim.camera.targetX));
    sim.camera.targetY = Math.max(-mapBound, Math.min(mapBound, sim.camera.targetY));
  } else if (activeMode === 'conquest' && conquestBattle) {
    // WASD / Arrows
    if (keysPressed['w'] || keysPressed['arrowup']) conquestBattle.camera.targetY -= scrollSpeed;
    if (keysPressed['s'] || keysPressed['arrowdown']) conquestBattle.camera.targetY += scrollSpeed;
    if (keysPressed['a'] || keysPressed['arrowleft']) conquestBattle.camera.targetX -= scrollSpeed;
    if (keysPressed['d'] || keysPressed['arrowright']) conquestBattle.camera.targetX += scrollSpeed;

    // Edge panning
    const pad = 35;
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;

    if (mousePos.x >= 0 && mousePos.x <= canvasWidth && mousePos.y >= 0 && mousePos.y <= canvasHeight) {
      if (mousePos.x < pad) conquestBattle.camera.targetX -= scrollSpeed * 0.8;
      if (mousePos.x > canvasWidth - pad) conquestBattle.camera.targetX += scrollSpeed * 0.8;
      if (mousePos.y < pad) conquestBattle.camera.targetY -= scrollSpeed * 0.8;
      if (mousePos.y > canvasHeight - pad) conquestBattle.camera.targetY += scrollSpeed * 0.8;
    }
  }
}

// Master clock HUD timer updates
function updateRealtimeClock() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  if (clockDisplay) {
    clockDisplay.textContent = `${h}:${m}:${s} UTC`;
  }
}

// Render selected unit decks status bars
function updateSelectionDecks() {
  const selectedList = sim.ships.filter(s => s.selected);
  const carrierSelected = selectedList.some(s => s.type === 'carrier');
  
  // Update overall overlay container visibility
  const shipyardPanel = document.getElementById('shipyard-hud-overlay');
  const commandPanel = document.getElementById('command-hud-overlay');
  const formationPanel = document.getElementById('formation-hud-overlay');

  if (selectedList.length > 0) {
    if (formationPanel) formationPanel.classList.add('active');
    
    if (carrierSelected) {
      if (shipyardPanel) shipyardPanel.classList.add('active');
      if (commandPanel) commandPanel.classList.add('active');
    } else {
      if (shipyardPanel) shipyardPanel.classList.remove('active');
      if (commandPanel) commandPanel.classList.remove('active');
    }
  } else {
    if (shipyardPanel) shipyardPanel.classList.remove('active');
    if (commandPanel) commandPanel.classList.remove('active');
    if (formationPanel) formationPanel.classList.remove('active');
  }

  // Update Carrier production status panel
  const prodStatusPanel = document.getElementById('carrier-production-status');
  if (prodStatusPanel) {
    const carrier = sim.ships.find(s => s.type === 'carrier');
    if (carrier) {
      if (carrier.productionQueue && carrier.productionQueue.length > 0) {
        const item = carrier.productionQueue[0];
        const progress = Math.floor(carrier.productionProgress);
        prodStatusPanel.innerHTML = `
          <div class="prod-queue-item">
            <span class="text-amber">BUILDING: ${item.toUpperCase()}</span>
            <span>${progress}%</span>
          </div>
          <div class="prod-progress-bg">
            <div class="prod-progress-bar" style="width: ${progress}%;"></div>
          </div>
          <div style="font-size: 8px; color: var(--color-text-dim); margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap;">
            <span>QUEUED:</span>
            ${carrier.productionQueue.slice(1).map(q => `<span style="border: 1px solid rgba(255,255,255,0.15); padding: 0 3px;">${q.toUpperCase()}</span>`).join(' ') || 'none'}
          </div>
          <button id="btn-cancel-production" class="tactics-btn font-mono" style="background: rgba(255,51,68,0.1); border: 1px solid var(--color-red); color: var(--color-red); font-size: 8px; padding: 2px 4px; cursor: pointer; margin-top: 4px; width: 100%;">CANCEL_BUILD (REFUND_75%)</button>
        `;
        
        // Wire cancel button
        const cancelBtn = document.getElementById('btn-cancel-production');
        if (cancelBtn) {
          cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (carrier.productionQueue && carrier.productionQueue.length > 0) {
              const cancelledType = carrier.productionQueue.shift();
              let refund = 37;
              if (cancelledType === 'cruiser') refund = 112;
              if (cancelledType === 'dreadnought') refund = 337;
              sim.qm = Math.min(sim.maxQm, sim.qm + refund);
              carrier.productionProgress = 0;
              appendLog(`PRODUCTION_BAY: Cancelled ${cancelledType.toUpperCase()} manufacture. Refunded ${refund} QM.`);
              updateSelectionDecks();
            }
          });
        }
      } else {
        prodStatusPanel.innerHTML = `
          <div class="empty-selection-msg" style="padding-top: 15px; font-size: 8.5px; text-align: center; color: var(--color-text-dim);">
            CONSTRUCTION YARDS IDLE.<br/>SELECT BLUEPRINT TO DIRECT MATRICES.
          </div>
        `;
      }
    } else {
      prodStatusPanel.innerHTML = `
        <div class="empty-selection-msg" style="padding-top: 15px; font-size: 8.5px; text-align: center; color: var(--color-red);">
          FLAGSHIP DESTROYED.<br/>MANUFACTURING SYSTEMS OFFLINE.
        </div>
      `;
    }
  }

  // Update selected auxiliary ships list
  selectionDeck.innerHTML = '';

  if (selectedList.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'empty-selection-msg';
    msg.style.paddingTop = '2px';
    msg.style.fontSize = '8.5px';
    msg.textContent = 'No auxiliary fleet selected. Click-drag box to select escorts.';
    selectionDeck.appendChild(msg);
    return;
  }

  selectedList.forEach(ship => {
    const card = document.createElement('div');
    card.className = 'unit-card';
    
    const hpRatio = (ship.health / ship.maxHealth) * 100;
    const shieldRatio = (ship.shield / ship.maxShield) * 100;

    card.innerHTML = `
      <div class="unit-card-header" style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 2px;">
        <span>${ship.name}</span>
        <span class="${ship.health < ship.maxHealth * 0.35 ? 'text-red' : 'text-green'}">
          HP: ${Math.round(ship.health)}/${ship.maxHealth}
        </span>
      </div>
      
      <!-- Health Progress Bar -->
      <div class="unit-health-bar-bg" style="height: 3px; background-color: rgba(255,255,255,0.05); margin-bottom: 2px; width: 100%;">
        <div class="unit-health-bar" style="height: 100%; width: ${hpRatio}%; background-color: ${ship.health < ship.maxHealth * 0.3 ? 'var(--color-red)' : 'var(--color-green)'}"></div>
      </div>
      
      <!-- Shield Progress Bar -->
      <div class="unit-health-bar-bg" style="height: 3px; background-color: rgba(255,255,255,0.05); margin-bottom: 4px; width: 100%;">
        <div class="unit-health-bar" style="height: 100%; width: ${shieldRatio}%; background-color: var(--color-cyan)"></div>
      </div>

      <div class="unit-card-stats" style="display: flex; justify-content: space-between; color: var(--color-text-dim); font-size: 7.5px;">
        <span>MASS: ${ship.mass}</span>
        <span>SHIELD: ${Math.round(ship.shield)}</span>
        <span>SPEED: ${ship.speed || 'STATIC'}</span>
      </div>
    `;

    // Click to focus camera on selected ship
    card.addEventListener('click', (e) => {
      sim.camera.targetX = ship.x - sim.width / 2;
      sim.camera.targetY = ship.y - sim.height / 2;
      appendLog(`TELEMETRY_LOCK: SENSORS CENTRED ON ${ship.name.toUpperCase()}.`);
    });

    selectionDeck.appendChild(card);
  });
}

// Draw a miniature neon grid tactical minimap on the sidebar, projected from the mothership
function drawRadarMinimap() {
  if (!radarCanvas) return;
  const ctx = radarCanvas.getContext('2d');
  const w = radarCanvas.width;
  const h = radarCanvas.height;
  
  ctx.fillStyle = '#020204';
  ctx.fillRect(0, 0, w, h);

  // Draw circular green scanner grids
  ctx.strokeStyle = 'rgba(0, 255, 102, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(w/2, h/2, 40, 0, Math.PI * 2);
  ctx.arc(w/2, h/2, 80, 0, Math.PI * 2);
  ctx.stroke();

  // Draw scanner crosshairs
  ctx.strokeStyle = 'rgba(0, 255, 102, 0.1)';
  ctx.beginPath();
  ctx.moveTo(w/2, 0); ctx.lineTo(w/2, h);
  ctx.moveTo(0, h/2); ctx.lineTo(w, h/2);
  ctx.stroke();

  // Draw sweep line
  const sweepAngle = (sim.time * 1.4) % (Math.PI * 2);
  ctx.strokeStyle = 'rgba(0, 255, 102, 0.25)';
  ctx.beginPath();
  ctx.moveTo(w/2, h/2);
  ctx.lineTo(w/2 + Math.cos(sweepAngle) * 90, h/2 + Math.sin(sweepAngle) * 90);
  ctx.stroke();

  // Map world scale helper: Map world coordinates +-2000 relative to the mothership
  const scale = 0.045; // World to pixel multiplier

  // Project from Carrier mothership
  const carrier = sim.ships.find(s => s.type === 'carrier');
  const cx = carrier ? carrier.x : 0;
  const cy = carrier ? carrier.y : 0;

  // Draw weather clouds on the radar minimap as soft glowing atmospheric nebulas
  if (sim.foldActive && sim.weatherClouds) {
    sim.weatherClouds.forEach(cloud => {
      const rx = w / 2 + (cloud.x - cx) * scale;
      const ry = h / 2 + (cloud.y - cy) * scale;
      const rRadius = cloud.radius * scale;
      
      // Keep within the boundaries
      if (rx >= -rRadius && rx <= w + rRadius && ry >= -rRadius && ry <= h + rRadius) {
        ctx.save();
        const grad = ctx.createRadialGradient(rx, ry, 1, rx, ry, rRadius);
        // Use soft translucent colors based on the actual cloud intensity
        const alpha = 0.16 * (cloud.intensity || 1.0);
        grad.addColorStop(0, cloud.color + Math.round(alpha * 255).toString(16).padStart(2, '0'));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(rx, ry, rRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });
  }

  // Draw debris scrap
  ctx.fillStyle = 'rgba(0, 229, 255, 0.6)';
  sim.debris.forEach(scrap => {
    const rx = w/2 + (scrap.x - cx) * scale;
    const ry = h/2 + (scrap.y - cy) * scale;
    if (rx >= 0 && rx <= w && ry >= 0 && ry <= h) {
      ctx.fillRect(rx - 1, ry - 1, 2, 2);
    }
  });

  // Draw Black Holes
  ctx.fillStyle = '#ff3344';
  sim.blackHoles.forEach(bh => {
    const rx = w/2 + (bh.x - cx) * scale;
    const ry = h/2 + (bh.y - cy) * scale;
    ctx.strokeStyle = 'rgba(255, 51, 68, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(rx, ry, 6, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(rx, ry, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw Enemy Citadels & Interceptors
  sim.enemies.forEach(enemy => {
    const rx = w/2 + (enemy.x - cx) * scale;
    const ry = h/2 + (enemy.y - cy) * scale;
    if (rx >= 0 && rx <= w && ry >= 0 && ry <= h) {
      ctx.fillStyle = '#ff3344';
      ctx.beginPath();
      ctx.arc(rx, ry, enemy.type === 'citadel' ? 4.5 : 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Draw Player ships
  sim.ships.forEach(ship => {
    const rx = w/2 + (ship.x - cx) * scale;
    const ry = h/2 + (ship.y - cy) * scale;
    if (rx >= 0 && rx <= w && ry >= 0 && ry <= h) {
      ctx.fillStyle = ship.type === 'carrier' ? '#ffffff' : '#00ff66';
      ctx.beginPath();
      ctx.arc(rx, ry, ship.type === 'carrier' ? 4 : 2, 0, Math.PI * 2);
      ctx.fill();

      // Highlight if selected
      if (ship.selected) {
        ctx.strokeStyle = '#00ff66';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(rx, ry, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  });

  // Draw small green camera viewport outline box showing where player is currently looking
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.38)';
  ctx.lineWidth = 1;
  const camW = sim.width * scale;
  const camH = sim.height * scale;
  const camX = w/2 + (sim.camera.x - cx) * scale;
  const camY = h/2 + (sim.camera.y - cy) * scale;
  ctx.strokeRect(camX, camY, camW, camH);
}

let lastFrameTime = 0;
const fpsInterval = 1000 / 60; // ~16.67ms per frame

let lastFpsTimestamp = 0;
let fpsFrames = 0;
let hasSentFpsWarning = false;

// Master loop tick
function tickGameLoop(timestamp) {
  if (!sim) return;

  // Request next frame immediately
  requestAnimationFrame(tickGameLoop);

  if (!timestamp) timestamp = performance.now();

  // Measure real FPS regardless of requestAnimationFrame limiting
  fpsFrames++;
  if (!lastFpsTimestamp) lastFpsTimestamp = timestamp;
  if (timestamp >= lastFpsTimestamp + 1000) {
    const currentFps = Math.round((fpsFrames * 1000) / (timestamp - lastFpsTimestamp));
    const fpsCounterEl = document.getElementById('fps-counter');
    if (fpsCounterEl) {
      fpsCounterEl.textContent = `FPS: ${currentFps}`;
      if (currentFps < 50) {
        fpsCounterEl.style.color = '#ff3344';
        if (!hasSentFpsWarning) {
          hasSentFpsWarning = true;
          appendLog(`<span class="text-red">⚠️ PERF_ALERT: Spacetime grid strain detected. Frame rate dipped to ${currentFps} FPS. (hey, it went down)</span>`);
        }
      } else {
        fpsCounterEl.style.color = 'var(--color-text-dim)';
      }
    }
    fpsFrames = 0;
    lastFpsTimestamp = timestamp;
  }

  const elapsed = timestamp - lastFrameTime;

  // Only execute when enough time has passed to maintain a stable 60 FPS
  if (elapsed >= fpsInterval) {
    lastFrameTime = timestamp - (elapsed % fpsInterval);

    // 1. Handle Keyboard edge scrollings
    handleCameraScrolling();

    if (activeMode === 'cosmic' || activeMode === 'grid') {
      // 2. Perform core physics tick
      sim.tick();

      // 3. Render Canvas
      sim.render();

      // 4. Update HUD and sidebar details
      qmDisplay.textContent = Math.round(sim.qm);
      hudFleetCount.textContent = `${sim.ships.length} / 50`;
      hudCamCoords.textContent = `${Math.round(sim.camera.x + sim.width/2)}, ${Math.round(sim.camera.y + sim.height/2)}`;

      // Update cosmic region info in real-time based on camera center
      const hudRegionName = document.getElementById('hud-region-name');
      const hudRegionTitle = document.getElementById('hud-region-title');
      if (hudRegionName && hudRegionTitle) {
        const camCenterX = sim.camera.x + sim.width / 2;
        const camCenterY = sim.camera.y + sim.height / 2;
        const region = sim.getRegionAt(camCenterX, camCenterY);
        if (region) {
          hudRegionName.textContent = `${region.zodiac} ${region.name}`;
          hudRegionName.style.color = region.color;
          hudRegionTitle.textContent = region.title;
        }
      }
      
      // Update Cosmic Weather display in top HUD
      const weatherDisplay = document.getElementById('weather-display');
      if (weatherDisplay) {
        if (sim.foldActive) {
          weatherDisplay.textContent = `SPACETIME_FOLD (${Math.round(sim.foldProgress * 100)}%)`;
          weatherDisplay.className = 'indicator-val text-red';
        } else {
          const remainingPct = Math.round(((sim.foldCooldown - sim.foldTimer) / sim.foldCooldown) * 100);
          weatherDisplay.textContent = `STABLE FOLDS (${remainingPct}%)`;
          weatherDisplay.className = 'indicator-val text-green';
        }
      }
      
      // Threat estimation calculations
      const enemyCount = sim.enemies.length;
      let threatText = 'STABLE';
      let threatClass = 'text-green';
      if (enemyCount > 5) {
        threatText = 'CRITICAL_AMBUSH';
        threatClass = 'text-red';
      } else if (enemyCount > 2) {
        threatText = 'VOID_ENGAGED';
        threatClass = 'text-amber';
      } else if (enemyCount > 0) {
        threatText = 'MINIMAL_RAID';
        threatClass = 'text-cyan';
      }
      hudThreatLevel.textContent = threatText;
      hudThreatLevel.className = `hud-val ${threatClass}`;
      if (sectorThreatLabel) {
        sectorThreatLabel.textContent = threatText;
        sectorThreatLabel.className = `indicator-value ${threatClass}`;
      }

      // 5. Render side list cards and real-time clock
      updateSelectionDecks();
      updateRealtimeClock();
      
      // 6. Draw tactical radar Minimap
      drawRadarMinimap();
    } 
    else if (activeMode === 'mothership' && mothershipBase) {
      // Tick & render mothership
      mothershipBase.tick();
      mothershipBase.render();

      // Update Mothership stockpile numbers
      const baseQmVal = document.getElementById('base-qm-val');
      const exoticCoresVal = document.getElementById('exotic-cores-val');
      const zodiacTethersVal = document.getElementById('zodiac-tethers-val');

      const elemEarth = document.getElementById('elem-earth-val');
      const elemAir = document.getElementById('elem-air-val');
      const elemWater = document.getElementById('elem-water-val');
      const elemMetal = document.getElementById('elem-metal-val');
      const elemSoil = document.getElementById('elem-soil-val');
      const elemSymmetry = document.getElementById('elem-symmetry-val');

      if (baseQmVal) baseQmVal.textContent = Math.round(mothershipBase.inventory.quantumMatter);
      if (exoticCoresVal) exoticCoresVal.textContent = Math.round(mothershipBase.inventory.exoticCores);
      if (zodiacTethersVal) zodiacTethersVal.textContent = Math.round(mothershipBase.inventory.zodiacTethers);

      if (elemEarth) elemEarth.textContent = Math.round(mothershipBase.inventory.earthElement || 0);
      if (elemAir) elemAir.textContent = Math.round(mothershipBase.inventory.airElement || 0);
      if (elemWater) elemWater.textContent = Math.round(mothershipBase.inventory.waterElement || 0);
      if (elemMetal) elemMetal.textContent = Math.round(mothershipBase.inventory.metalElement || 0);
      if (elemSoil) elemSoil.textContent = Math.round(mothershipBase.inventory.soilElement || 0);
      if (elemSymmetry) elemSymmetry.textContent = Math.round(mothershipBase.inventory.symmetryCrystal || 0);

      // Keep simulation QM in sync with Mothership Base so we share resources!
      sim.qm = mothershipBase.inventory.quantumMatter;
      qmDisplay.textContent = Math.round(sim.qm);
      
      hudFleetCount.textContent = "N/A";
      hudCamCoords.textContent = "DOCK_O1";
      hudThreatLevel.textContent = "STABLE";
      hudThreatLevel.className = "hud-val text-green";

      updateRealtimeClock();
    }
    else if (activeMode === 'conquest' && conquestBattle) {
      // Tick & render Conquest
      conquestBattle.tick();
      conquestBattle.render();

      // Update Conquest UI info
      const oreVal = document.getElementById('battle-ore-val');
      const campsVal = document.getElementById('conquest-camps-val');
      const statusText = document.getElementById('conquest-status-text');

      if (oreVal) oreVal.textContent = Math.round(conquestBattle.battleOre);
      
      const totalCamps = conquestBattle.totalCamps || 0;
      const clearedCamps = conquestBattle.clearedCamps || 0;
      if (campsVal) campsVal.textContent = `${clearedCamps} / ${totalCamps}`;

      if (statusText) {
        if (conquestBattle.conquestWon) {
          statusText.textContent = "🏆 CONQUEST SECURED! Return to Sector to claim 1,000 QM & exotic components.";
          statusText.style.color = "var(--color-green)";
        } else if (conquestBattle.conquestLost) {
          statusText.textContent = "💀 MISSION FAILED: Heavy casualties sustained. Pull back immediately.";
          statusText.style.color = "var(--color-red)";
        } else {
          statusText.textContent = `Assault ongoing. Deploy Vanguard Raiders (35 Alloy) to conquer remaining ${totalCamps - clearedCamps} hostile camps.`;
          statusText.style.color = "var(--color-text-dim)";
        }
      }

      hudFleetCount.textContent = `${conquestBattle.playerUnits.length} UNITS`;
      hudCamCoords.textContent = "SURFACE";
      hudThreatLevel.textContent = "PLANETARY_WAR";
      hudThreatLevel.className = "hud-val text-amber";

      updateRealtimeClock();
    }
  }
}

let appInitialized = false;

// Initialize on window loading
window.addEventListener('load', () => {
  if (!appInitialized) {
    initApp();
    appInitialized = true;
  }
});
// Also fallback auto-run if window load already completed
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  if (!appInitialized) {
    initApp();
    appInitialized = true;
  }
}
