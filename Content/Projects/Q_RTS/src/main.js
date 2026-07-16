import { Simulation } from './simulation.js';
import { MothershipBase } from './mothership/base.js';
import { ConquestBattle } from './maps/conquest.js';
import { GameStorage } from './storage.js';
import { getStructureAt, getStructureInChunk } from './generation.js';
import { SolarSystem } from './planets/solar_system.js';

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
const btnTacticalEnterSystem = document.getElementById('btn-tactical-enter-system');
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
let activeMode = 'cosmic'; // 'cosmic', 'mothership', 'conquest', 'solarsystem'
let mothershipBase = null; // instance of MothershipBase
let conquestBattle = null; // instance of ConquestBattle
let currentSolarSystem = null; // instance of SolarSystem
let selectedTavern = null; // Active clicked tavern landmark

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
  if (window.appInitializedReal) return;
  window.appInitializedReal = true;
  window.keysPressed = keysPressed;
  window.GameStorage = GameStorage;
  window.activeMode = activeMode;
  window.currentSolarSystem = currentSolarSystem;

  if (!canvas) return;

  // Set canvas scale to fill containment window
  const container = canvas.parentElement;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;

  // Spin up Simulation class
  sim = new Simulation(canvas);
  window.sim = sim;
  sim.mousePos = mousePos;

  // Pre-load mothership base layout and synchronize resources from the start
  ensureMothershipBase().then(() => {
    if (mothershipBase) {
      sim.qm = mothershipBase.inventory.quantumMatter || 0;
      updateMothershipUiStockpile();
    }
  });

  // Resize listener
  window.addEventListener('resize', () => {
    if (sim) {
      sim.resize(container.clientWidth, container.clientHeight);
    }
  });

  // Bind shipyard blueprints buttons
  buildFighter.addEventListener('click', () => {
    const carrier = sim.ships.find(s => s.type === 'carrier');
    if (!carrier) {
      appendLog("<span class='text-red'>BLUEPRINT_REJECTED: FLAGSHIP CARRIER NOT FOUND IN SECTOR.</span>");
      return;
    }
    if (sim.qm >= 50) {
      sim.qm -= 50;
      if (!carrier.productionQueue) carrier.productionQueue = [];
      carrier.productionQueue.push('fighter');
      appendLog("🏭 QUEUED: Added FIGHTER manufacture sequence to flagship carrier grid.");
    } else {
      appendLog("<span class='text-red'>BLUEPRINT_REJECTED: INSUFFICIENT QM FOR FT-FIGHTER (50 QM REQUIRED).</span>");
    }
  });

  buildCruiser.addEventListener('click', () => {
    const carrier = sim.ships.find(s => s.type === 'carrier');
    if (!carrier) {
      appendLog("<span class='text-red'>BLUEPRINT_REJECTED: FLAGSHIP CARRIER NOT FOUND IN SECTOR.</span>");
      return;
    }
    if (sim.qm >= 150) {
      sim.qm -= 150;
      if (!carrier.productionQueue) carrier.productionQueue = [];
      carrier.productionQueue.push('cruiser');
      appendLog("🏭 QUEUED: Added CRUISER manufacture sequence to flagship carrier grid.");
    } else {
      appendLog("<span class='text-red'>BLUEPRINT_REJECTED: INSUFFICIENT QM FOR CR-CRUISER (150 QM REQUIRED).</span>");
    }
  });

  buildDreadnought.addEventListener('click', () => {
    const carrier = sim.ships.find(s => s.type === 'carrier');
    if (!carrier) {
      appendLog("<span class='text-red'>BLUEPRINT_REJECTED: FLAGSHIP CARRIER NOT FOUND IN SECTOR.</span>");
      return;
    }
    if (sim.qm >= 450) {
      sim.qm -= 450;
      if (!carrier.productionQueue) carrier.productionQueue = [];
      carrier.productionQueue.push('dreadnought');
      appendLog("🏭 QUEUED: Added DREADNOUGHT manufacture sequence to flagship carrier grid.");
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

  if (btnTacticalEnterSystem) {
    btnTacticalEnterSystem.addEventListener('click', () => {
      const carrier = sim.ships.find(s => s.type === 'carrier');
      const nearby = getNearbySystem(carrier);
      if (nearby) {
        selectedTavern = nearby.struct;
        sim.discoveredSolarSystems = sim.discoveredSolarSystems || {};
        const ssKey = `${selectedTavern.x},${selectedTavern.y}`;
        let solSystem = sim.discoveredSolarSystems[ssKey];
        if (!solSystem) {
          solSystem = new SolarSystem(canvas, selectedTavern.x, selectedTavern.y, selectedTavern, sim.getRegionAt(selectedTavern.x, selectedTavern.y));
          sim.discoveredSolarSystems[ssKey] = solSystem;
        }
        currentSolarSystem = solSystem;
        appendLog(`🚀 DOCKING: Successfully docked flagship inside orbital pathways of ${selectedTavern.name.toUpperCase()}! Harmonization deck online.`);
        switchMode('solarsystem');
      }
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

  // Deployed flagship panel bindings
  const btnDeployedLaunch = document.getElementById('btn-deployed-launch');
  const btnDeployedUndeploy = document.getElementById('btn-deployed-undeploy');
  const btnDeployedFinalize = document.getElementById('btn-deployed-finalize');

  if (btnDeployedLaunch) {
    btnDeployedLaunch.addEventListener('click', () => {
      const carrier = sim.ships.find(s => s.type === 'carrier');
      if (carrier && carrier.deployState === 'deployed' && carrier.dockedTearId) {
        const activeTearId = sim.activeTearId || carrier.dockedTearId;
        const tear = sim.spaceTears.find(t => t.id === activeTearId);
        if (tear) {
          if (!sim.activeTearId) {
            appendLog(`🔮 VOID_GATEWAY: Commencing Conquest deployment. Drop target theme: [${tear.themeId.toUpperCase()}].`);
            sim.activeTearId = tear.id;
            launchConquest(tear.themeId, tear.isSmallGrind);
          } else {
            appendLog(`🔮 VOID_GATEWAY: Re-entering active Conquest field [${tear.themeId.toUpperCase()}].`);
            switchMode('conquest');
          }
        }
      }
    });
  }

  if (btnDeployedFinalize) {
    btnDeployedFinalize.addEventListener('click', () => {
      const carrier = sim.ships.find(s => s.type === 'carrier');
      if (carrier && sim.activeTearId && conquestBattle && conquestBattle.conquestWon) {
        // Calculate units remaining on the conquest field to transmute to quantum energy!
        let extraQm = 0;
        let unitsTransmuted = 0;
        if (conquestBattle.allies) {
          conquestBattle.allies.forEach(u => {
            if (u.type === 'raider') { extraQm += 50; unitsTransmuted++; }
            else if (u.type === 'tank') { extraQm += 150; unitsTransmuted++; }
            else if (u.type === 'gunship') { extraQm += 250; unitsTransmuted++; }
          });
        }

        // Grant substantial rewards
        const baseRewardQm = 1000;
        const totalQmGained = baseRewardQm + extraQm;
        sim.qm = Math.min(sim.maxQm, sim.qm + totalQmGained);
        
        const battleGathered = { ...conquestBattle.gatheredElements };

        ensureMothershipBase().then(() => {
          if (mothershipBase) {
            mothershipBase.inventory.exoticCores += 10;
            mothershipBase.inventory.zodiacTethers += 5;
            mothershipBase.inventory.quantumMatter = Math.round(sim.qm);

            // Transfer harvested surface elements
            mothershipBase.inventory.earthElement = (mothershipBase.inventory.earthElement || 0) + (battleGathered.earth || 0);
            mothershipBase.inventory.airElement = (mothershipBase.inventory.airElement || 0) + (battleGathered.air || 0);
            mothershipBase.inventory.waterElement = (mothershipBase.inventory.waterElement || 0) + (battleGathered.water || 0);
            mothershipBase.inventory.metalElement = (mothershipBase.inventory.metalElement || 0) + (battleGathered.metal || 0);
            mothershipBase.inventory.soilElement = (mothershipBase.inventory.soilElement || 0) + (battleGathered.soil || 0);
            mothershipBase.inventory.symmetryCrystal = (mothershipBase.inventory.symmetryCrystal || 0) + (battleGathered.symmetry || 0);

            mothershipBase.updateUiDisplay();
            mothershipBase.saveToStorage();
          }

          appendLog(`🏆 CLAIMED REWARDS: Transmuted and claimed drop cargo! +${baseRewardQm} QM, +10 Exotic Cores, +5 Zodiac Tethers.`);
          if (battleGathered && (battleGathered.earth || battleGathered.air || battleGathered.water || battleGathered.metal || battleGathered.soil || battleGathered.symmetry)) {
            appendLog(`⛏️ SECURED CARGO: Earth Essence: +${battleGathered.earth || 0}, Air: +${battleGathered.air || 0}, Water: +${battleGathered.water || 0}, Metal: +${battleGathered.metal || 0}, Soil: +${battleGathered.soil || 0}, Symmetry Crystals: +${battleGathered.symmetry || 0}.`);
          }
          if (unitsTransmuted > 0) {
            appendLog(`⚡ QUANTUM_TRANSMUTATION: Transmuted ${unitsTransmuted} planetary units left on the battlefield into +${extraQm} extra pure QM!`);
          }

          // Clear any nearby enemies and close vortices in simulation
          sim.enemies = [];
          sim.vortices = [];

          // Heal the completed Spacetime Tear (closes void portal and spawns element/crystal debris remnants)
          sim.healSpacetimeTear(sim.activeTearId);
          sim.activeTearId = null;
          conquestBattle = null; // Wipe the conquest battle!

          // Hide the conquest tab!
          const tabConquestBtn = document.getElementById('tab-conquest');
          if (tabConquestBtn) tabConquestBtn.style.display = 'none';

          // Undock/undeploy carrier
          carrier.deployState = 'undeploying';
          appendLog(`⚓ UN-DOCKING: Conquest completed. Flagship has initiated un-docking procedures.`);
          
          updateSelectionDecks();
          updateMothershipUiStockpile();
        });
      }
    });
  }

  if (btnDeployedUndeploy) {
    btnDeployedUndeploy.addEventListener('click', () => {
      const carrier = sim.ships.find(s => s.type === 'carrier');
      if (carrier && (carrier.deployState === 'deployed' || carrier.deployState === 'deploying')) {
        if (sim.activeTearId) {
          appendLog(`↩ ABANDONED: Active conquest field aborted. All deployed planet units lost.`);
          sim.activeTearId = null;
          conquestBattle = null; // Wipe the conquest battle!
          const tabConquestBtn = document.getElementById('tab-conquest');
          if (tabConquestBtn) tabConquestBtn.style.display = 'none';
        }
        carrier.deployState = 'undeploying';
        appendLog(`⚓ UN-DOCKING: Flagship has initiated un-docking procedures. Retracting tentacles...`);
        updateSelectionDecks();
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

  // Planetary tactical radar minimap click interaction
  const conquestRadarCanvas = document.getElementById('conquest-radar-canvas');
  if (conquestRadarCanvas) {
    conquestRadarCanvas.style.cursor = 'crosshair';
    conquestRadarCanvas.addEventListener('click', (e) => {
      if (!conquestBattle) return;
      const rect = conquestRadarCanvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const mapW = conquestBattle.map.width;
      const mapH = conquestBattle.map.height;
      const scaleX = conquestRadarCanvas.width / mapW;
      const scaleY = conquestRadarCanvas.height / mapH;
      const scale = Math.min(scaleX, scaleY);

      const drawW = mapW * scale;
      const drawH = mapH * scale;
      const offsetX = (conquestRadarCanvas.width - drawW) / 2;
      const offsetY = (conquestRadarCanvas.height - drawH) / 2;

      // Project clicked pixel coordinates back to raw planetary world coordinates
      const worldX = (clickX - offsetX) / scale;
      const worldY = (clickY - offsetY) / scale;

      // Bounds clamping for camera target to prevent scrolling out of the map boundaries
      conquestBattle.camera.targetX = Math.max(0, Math.min(mapW - conquestBattle.canvas.width / conquestBattle.camera.zoom, worldX - conquestBattle.canvas.width / (2 * conquestBattle.camera.zoom)));
      conquestBattle.camera.targetY = Math.max(0, Math.min(mapH - conquestBattle.canvas.height / conquestBattle.camera.zoom, worldY - conquestBattle.canvas.height / (2 * conquestBattle.camera.zoom)));

      // Visual flash indicator at camera destination
      if (sim && sim.waypoints) {
        sim.waypoints.push({
          id: `conquest-wp-${Date.now()}`,
          x: worldX,
          y: worldY,
          radius: 8,
          alpha: 1.0,
          color: '#00ffff'
        });
      }

      appendLog(`🛰️ PLANETARY_RADAR: Sensor grid locked and camera centered at [${Math.round(worldX)}, ${Math.round(worldY)}].`);
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

  function updateMothershipUiStockpile() {
    if (!mothershipBase) return;
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

    const btnToggleFactoryPower = document.getElementById('btn-toggle-factory-power');
    if (btnToggleFactoryPower) {
      if (mothershipBase.factoryActive !== false) {
        btnToggleFactoryPower.textContent = '🟢 FACTORY: ACTIVE';
        btnToggleFactoryPower.style.borderColor = 'var(--color-green)';
        btnToggleFactoryPower.style.color = 'var(--color-green)';
        btnToggleFactoryPower.style.background = 'rgba(0, 255, 102, 0.05)';
        btnToggleFactoryPower.style.textShadow = '0 0 5px rgba(0, 255, 102, 0.3)';
      } else {
        btnToggleFactoryPower.textContent = '🔴 FACTORY: OFFLINE';
        btnToggleFactoryPower.style.borderColor = 'var(--color-red)';
        btnToggleFactoryPower.style.color = 'var(--color-red)';
        btnToggleFactoryPower.style.background = 'rgba(255, 51, 68, 0.05)';
        btnToggleFactoryPower.style.textShadow = '0 0 5px rgba(255, 51, 68, 0.3)';
      }
    }
  }
  window.updateMothershipUiStockpile = updateMothershipUiStockpile;

  function updateDebugUiVisibility() {
    const btnToggleDebugMenu = document.getElementById('btn-toggle-debug-menu');
    const debugWindowOverlay = document.getElementById('debug-window-overlay');
    const debugDeployHud = document.getElementById('debug-deploy-hud-overlay');
    if (btnToggleDebugMenu) btnToggleDebugMenu.classList.toggle('active', debugMenuVisible);
    if (debugWindowOverlay) {
      debugWindowOverlay.style.display = debugMenuVisible ? 'flex' : 'none';
    }
    if (debugDeployHud) {
      debugDeployHud.style.display = (debugMenuVisible && activeMode === 'cosmic') ? 'flex' : 'none';
    }
  }

  // Switch visual mode orchestrator
  function switchMode(newMode) {
    if (newMode === 'grid') {
      newMode = 'cosmic'; // Redirect grid mode to cosmic sector
    }
    activeMode = newMode;
    window.activeMode = newMode;
    window.currentSolarSystem = currentSolarSystem;
    
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
    const sectorRadarContainer = document.getElementById('sector-radar-container');
    const conquestRadarContainer = document.getElementById('conquest-radar-container');
    const controlsOverlay = document.querySelector('.controls-overlay');
    const canvasHud = document.querySelector('.canvas-hud');
    const btnToggleDebugMenu = document.getElementById('btn-toggle-debug-menu');
    
    const mothershipHud = document.getElementById('mothership-hud-overlay');
    const conquestHud = document.getElementById('conquest-hud-overlay');
    const debugDeployHud = document.getElementById('debug-deploy-hud-overlay');
    const solarsystemHud = document.getElementById('solarsystem-hud-overlay');
    const tavernOverlay = document.getElementById('tavern-detail-overlay');
    
    if (solarsystemHud) solarsystemHud.style.display = 'none';
    if (tavernOverlay) tavernOverlay.style.display = 'none';
    
    if (newMode === 'cosmic') {
      if (shipyardHud) shipyardHud.style.display = 'flex';
      if (commandHud) commandHud.style.display = 'flex';
      if (formationHud) formationHud.style.display = 'flex';
      if (sectorRadarContainer) sectorRadarContainer.style.display = 'block';
      if (conquestRadarContainer) conquestRadarContainer.style.display = 'none';
      if (controlsOverlay) controlsOverlay.style.display = 'block';
      if (canvasHud) canvasHud.style.display = 'block';
      if (btnToggleDebugMenu) btnToggleDebugMenu.style.display = 'flex';
      
      updateDebugUiVisibility();
      
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
      if (sectorRadarContainer) sectorRadarContainer.style.display = 'none';
      if (conquestRadarContainer) conquestRadarContainer.style.display = 'none';
      if (controlsOverlay) controlsOverlay.style.display = 'none';
      if (canvasHud) canvasHud.style.display = 'none';
      if (btnToggleDebugMenu) btnToggleDebugMenu.style.display = 'flex';
      
      updateDebugUiVisibility();
      
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
        window.mothershipBase = mothershipBase;
        window.saveGame = () => {
          if (mothershipBase) {
            mothershipBase.inventory.quantumMatter = Math.round(sim.qm);
            mothershipBase.saveToStorage();
          }
        };

        // Sync material stockpile from simulation to mothership
        mothershipBase.inventory.quantumMatter = Math.round(sim.qm);

        // Load progress from IndexedDB
        mothershipBase.loadFromStorage()
          .then(loaded => {
            if (loaded) {
              appendLog("🗄️ DATABASE: Restored Mothership Base layout and progression from offline state!");
              // Update simulation qm with loaded qm
              sim.qm = mothershipBase.inventory.quantumMatter;
            } else {
              appendLog("🗄️ DATABASE: Created new Mothership Base factory matrix core.");
            }
            updateMothershipUiStockpile();
          });
      } else if (mothershipBase) {
        mothershipBase.inventory.quantumMatter = Math.round(sim.qm);
        updateMothershipUiStockpile();
      }
    } 
    else if (newMode === 'conquest') {
      if (shipyardHud) shipyardHud.style.display = 'none';
      if (commandHud) commandHud.style.display = 'none';
      if (formationHud) formationHud.style.display = 'none';
      if (sectorRadarContainer) sectorRadarContainer.style.display = 'none';
      if (conquestRadarContainer) conquestRadarContainer.style.display = 'block';
      if (controlsOverlay) controlsOverlay.style.display = 'none';
      if (canvasHud) canvasHud.style.display = 'none';
      if (btnToggleDebugMenu) btnToggleDebugMenu.style.display = 'flex';
      
      updateDebugUiVisibility();
      
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
    else if (newMode === 'solarsystem') {
      if (shipyardHud) shipyardHud.style.display = 'none';
      if (commandHud) commandHud.style.display = 'none';
      if (formationHud) formationHud.style.display = 'none';
      if (sectorRadarContainer) sectorRadarContainer.style.display = 'none';
      if (conquestRadarContainer) conquestRadarContainer.style.display = 'none';
      if (controlsOverlay) controlsOverlay.style.display = 'none';
      if (canvasHud) canvasHud.style.display = 'none';
      if (btnToggleDebugMenu) btnToggleDebugMenu.style.display = 'none';
      
      updateDebugUiVisibility();
      
      if (mothershipHud) {
        mothershipHud.style.display = 'none';
        mothershipHud.classList.remove('active');
      }
      if (conquestHud) {
        conquestHud.style.display = 'none';
        conquestHud.classList.remove('active');
      }
      if (solarsystemHud) {
        solarsystemHud.style.display = 'block';
      }
      
      if (currentSolarSystem) {
        const titleEl = document.getElementById('solarsystem-title');
        const zodiacEl = document.getElementById('solarsystem-zodiac');
        if (titleEl) titleEl.textContent = currentSolarSystem.star.name.toUpperCase();
        if (zodiacEl) zodiacEl.textContent = `${currentSolarSystem.region.zodiac.toUpperCase()} Domain - ${currentSolarSystem.star.classification}`;
        
        updatePlanetList();
        if (currentSolarSystem.selectedPlanetIndex === -1 && currentSolarSystem.planets.length > 0) {
          currentSolarSystem.selectedPlanetIndex = 0;
        }
        selectPlanet(currentSolarSystem.selectedPlanetIndex);
      }
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
      updateDebugUiVisibility();
      appendLog(`DEBUG_SYSTEM: Spatial deployment overlay ${debugMenuVisible ? "ONLINE" : "OFFLINE"}.`);
    });
  }

  // Close debug button click handler
  const btnCloseDebugConsole = document.getElementById('btn-close-debug-console');
  if (btnCloseDebugConsole) {
    btnCloseDebugConsole.addEventListener('click', () => {
      debugMenuVisible = false;
      updateDebugUiVisibility();
      appendLog("DEBUG_SYSTEM: Spatial deployment overlay OFFLINE.");
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

  // 12 ZODIAC COGNITIVE TECHS DATABASE
  const ZODIAC_TECHS = {
    aries: { name: "Aries", symbol: "♈", title: "The Pioneer - Core Speed Amplification", desc: "Increases conveyor belt item movement speed by 50% throughout the entire factory grid, optimizing throughput for high-rate fabrication.", cost: { quantumMatter: 500, exoticCores: 2 } },
    taurus: { name: "Taurus", symbol: "♉", title: "The Builder - Substrate Efficiency", desc: "Reduces the construction cost of all new conveyor belts and factory machines by 25%.", cost: { quantumMatter: 750, exoticCores: 3 } },
    gemini: { name: "Gemini", symbol: "♊", title: "The Twin - Dual Extractor Matrix", desc: "Extractor drills now draw resources twice as fast, extracting two items per cycle instead of one.", cost: { quantumMatter: 1000, exoticCores: 5 } },
    cancer: { name: "Cancer", symbol: "♋", title: "The Guardian - Structural Fortitude", desc: "All player vehicles deployed in Conquest battlegrounds receive +150 extra maximum shield and armor health.", cost: { quantumMatter: 1200, exoticCores: 6 } },
    leo: { name: "Leo", symbol: "♌", title: "The Commander - Tactical Logistics", desc: "Standing Army limit is unlocked, allowing larger forces to be deployed on planetary surfaces.", cost: { quantumMatter: 1500, exoticCores: 8, airElement: 10 } },
    virgo: { name: "Virgo", symbol: "♍", title: "The Analyst - Yield Maximization", desc: "Planetary Synthesizers achieve 100% molecular transformation efficiency, producing double yield outputs.", cost: { quantumMatter: 1800, exoticCores: 10, waterElement: 15 } },
    libra: { name: "Libra", symbol: "♎", title: "The Architect - Spatial Expansion", desc: "Reduces the Quantum Matter and Exotic Core cost to integrate and unlock adjacent grid sectors by 30%.", cost: { quantumMatter: 2000, exoticCores: 12, earthElement: 15 } },
    scorpio: { name: "Scorpio", symbol: "♏", title: "The Catalyst - Assembly Hyperdrive", desc: "All Assembler fabricators perform construction pipelines 50% faster, converting elements to units rapidly.", cost: { quantumMatter: 2500, exoticCores: 15, metalElement: 20 } },
    sagittarius: { name: "Sagittarius", symbol: "♐", title: "The Explorer - Deep Space Warp-drive", desc: "Warp coordinates stabilized. Reduces Carrier hyperjump recharge delay by 40%.", cost: { quantumMatter: 3000, exoticCores: 18, soilElement: 20 } },
    capricorn: { name: "Capricorn", symbol: "♑", title: "The Overseer - Passive QM Generation", desc: "Passively synthesizes +10 Quantum Matter per second inside the base mainframe, even while idle.", cost: { quantumMatter: 4000, exoticCores: 25, symmetryCrystal: 5 } },
    aquarius: { name: "Aquarius", symbol: "♒", title: "The Innovator - Element Recycling Core", desc: "Recovers 10% of element costs when materials are fed into the central standing army conversion portal.", cost: { quantumMatter: 5000, exoticCores: 30, symmetryCrystal: 10 } },
    pisces: { name: "Pisces", symbol: "♓", title: "The Dreamer - Cosmic Transcendence", desc: "Enables symmetric firing array pulses on the Flagship Carrier, maximizing defensive firepower.", cost: { quantumMatter: 8000, exoticCores: 50, symmetryCrystal: 20 } }
  };

  let selectedTechId = null;

  function updateTechTreeModal() {
    ensureMothershipBase();
    if (!mothershipBase) return;

    const baseInv = mothershipBase.inventory;
    const unlockedList = mothershipBase.unlockedTech || [];

    // Update node status labels
    Object.keys(ZODIAC_TECHS).forEach(techId => {
      const btn = document.getElementById(`tech-${techId}`);
      if (btn) {
        const isUnlocked = unlockedList.includes(techId);
        const statusLabel = btn.querySelector('.tech-status-label');
        if (statusLabel) {
          statusLabel.textContent = isUnlocked ? "ACTIVE" : "LOCKED";
          statusLabel.style.color = isUnlocked ? "var(--color-green)" : "var(--color-text-dim)";
          statusLabel.style.borderColor = isUnlocked ? "rgba(0, 255, 102, 0.4)" : "rgba(255,255,255,0.15)";
          statusLabel.style.background = isUnlocked ? "rgba(0, 255, 102, 0.05)" : "none";
        }
        
        // Highlight active selection
        if (selectedTechId === techId) {
          btn.style.borderColor = "#ff33ff";
          btn.style.boxShadow = "0 0 10px rgba(255, 51, 255, 0.3)";
          btn.style.background = "rgba(255, 51, 255, 0.05)";
        } else {
          btn.style.borderColor = isUnlocked ? "rgba(0, 255, 102, 0.2)" : "rgba(255, 255, 255, 0.1)";
          btn.style.boxShadow = "none";
          btn.style.background = "rgba(255, 255, 255, 0.01)";
        }
      }
    });

    // Update right details panel
    const descTitle = document.getElementById('tech-desc-title');
    const descBody = document.getElementById('tech-desc-body');
    const costBox = document.getElementById('tech-cost-box');
    const costList = document.getElementById('tech-cost-list');
    const unlockBtn = document.getElementById('btn-unlock-tech');

    if (!selectedTechId) {
      if (descTitle) descTitle.textContent = "SELECT BRAIN NODE";
      if (descBody) descBody.textContent = "Click on any Zodiac Brain Core on the left matrix to review its deep cognitive capabilities, operational upgrades, and materials required to unlock the node.";
      if (costBox) costBox.style.display = 'none';
      if (unlockBtn) {
        unlockBtn.textContent = "CHOOSE COGNITIVE BRAIN";
        unlockBtn.style.borderColor = "var(--color-text-dim)";
        unlockBtn.style.color = "var(--color-text-dim)";
        unlockBtn.disabled = true;
        unlockBtn.style.cursor = 'not-allowed';
      }
    } else {
      const tech = ZODIAC_TECHS[selectedTechId];
      const isAlreadyUnlocked = unlockedList.includes(selectedTechId);

      if (descTitle) descTitle.textContent = `${tech.symbol} ${tech.name.toUpperCase()}`;
      if (descBody) descBody.textContent = `[${tech.title}]\n\n${tech.desc}`;

      // Calculate cost string
      if (costBox && costList) {
        costBox.style.display = 'block';
        costList.innerHTML = '';
        
        // Populate cost list
        let canAfford = true;
        const requirements = [];

        if (tech.cost.quantumMatter) {
          const current = Math.round(mothershipBase.inventory.quantumMatter);
          const required = tech.cost.quantumMatter;
          const met = current >= required;
          if (!met) canAfford = false;
          requirements.push(`<div style="color: ${met ? 'var(--color-green)' : 'var(--color-red)'}">• Quantum Matter: ${current} / ${required} QM</div>`);
        }
        if (tech.cost.exoticCores) {
          const current = Math.round(baseInv.exoticCores || 0);
          const required = tech.cost.exoticCores;
          const met = current >= required;
          if (!met) canAfford = false;
          requirements.push(`<div style="color: ${met ? 'var(--color-green)' : 'var(--color-red)'}">• Exotic Cores: ${current} / ${required} Cores</div>`);
        }
        
        // Check elements
        const elementsToCheck = [
          { key: 'earthElement', label: 'Earth Essence' },
          { key: 'airElement', label: 'Air Essence' },
          { key: 'waterElement', label: 'Water Essence' },
          { key: 'metalElement', label: 'Metal Essence' },
          { key: 'soilElement', label: 'Soil Essence' },
          { key: 'symmetryCrystal', label: 'Symmetry Crystals' }
        ];

        elementsToCheck.forEach(el => {
          if (tech.cost[el.key]) {
            const current = Math.round(baseInv[el.key] || 0);
            const required = tech.cost[el.key];
            const met = current >= required;
            if (!met) canAfford = false;
            requirements.push(`<div style="color: ${met ? 'var(--color-green)' : 'var(--color-red)'}">• ${el.label}: ${current} / ${required}</div>`);
          }
        });

        costList.innerHTML = requirements.join('');

        if (unlockBtn) {
          if (isAlreadyUnlocked) {
            unlockBtn.textContent = "COGNITIVE NODE ONLINE";
            unlockBtn.style.borderColor = "var(--color-green)";
            unlockBtn.style.color = "var(--color-green)";
            unlockBtn.style.boxShadow = "0 0 10px rgba(0, 255, 102, 0.2)";
            unlockBtn.disabled = true;
            unlockBtn.style.cursor = 'not-allowed';
          } else if (canAfford) {
            unlockBtn.textContent = "INITIATE BRAIN INTEGRATION";
            unlockBtn.style.borderColor = "#ff33ff";
            unlockBtn.style.color = "#ff33ff";
            unlockBtn.style.boxShadow = "0 0 15px rgba(255, 51, 255, 0.4)";
            unlockBtn.disabled = false;
            unlockBtn.style.cursor = 'pointer';
          } else {
            unlockBtn.textContent = "INSUFFICIENT STOCKPILE";
            unlockBtn.style.borderColor = "var(--color-red)";
            unlockBtn.style.color = "var(--color-red)";
            unlockBtn.style.boxShadow = "none";
            unlockBtn.disabled = true;
            unlockBtn.style.cursor = 'not-allowed';
          }
        }
      }
    }
  }

  // Bind tech modal togglers
  const btnOpenTechTree = document.getElementById('btn-open-tech-tree');
  const btnCloseTechTree = document.getElementById('btn-close-tech-tree');
  const techTreeModal = document.getElementById('tech-tree-modal');

  if (btnOpenTechTree && techTreeModal) {
    btnOpenTechTree.addEventListener('click', () => {
      ensureMothershipBase();
      techTreeModal.style.display = 'flex';
      selectedTechId = null;
      updateTechTreeModal();
      appendLog("🧠 SYSTEM: Cognitive Zodiac Matrix mainframe opened.");
    });
  }

  if (btnCloseTechTree && techTreeModal) {
    btnCloseTechTree.addEventListener('click', () => {
      techTreeModal.style.display = 'none';
      appendLog("🧠 SYSTEM: Zodiac Matrix mainframe offline.");
    });
  }

  // Bind Factory Power Toggle Button
  const btnToggleFactoryPower = document.getElementById('btn-toggle-factory-power');
  if (btnToggleFactoryPower) {
    btnToggleFactoryPower.addEventListener('click', () => {
      ensureMothershipBase().then(() => {
        if (mothershipBase) {
          mothershipBase.factoryActive = !mothershipBase.factoryActive;
          updateMothershipUiStockpile();
          mothershipBase.saveToStorage();
          if (mothershipBase.factoryActive) {
            appendLog("🔌 POWER_GRID: Mothership automation lines online. Extractor units energized.");
          } else {
            appendLog("🔌 POWER_GRID: Mothership automation lines deactivated. Extraction suspended to stockpile resources.");
          }
        }
      });
    });
  }

  // Bind individual tech node buttons
  Object.keys(ZODIAC_TECHS).forEach(techId => {
    const btn = document.getElementById(`tech-${techId}`);
    if (btn) {
      btn.addEventListener('click', () => {
        selectedTechId = techId;
        updateTechTreeModal();
      });
    }
  });

  // Bind unlock button
  const btnUnlockTech = document.getElementById('btn-unlock-tech');
  if (btnUnlockTech) {
    btnUnlockTech.addEventListener('click', () => {
      ensureMothershipBase();
      if (!mothershipBase || !selectedTechId) return;

      const tech = ZODIAC_TECHS[selectedTechId];
      const baseInv = mothershipBase.inventory;
      const unlockedList = mothershipBase.unlockedTech || [];

      if (unlockedList.includes(selectedTechId)) return;

      // Double check costs to deduct
      let canAfford = true;
      if (tech.cost.quantumMatter && mothershipBase.inventory.quantumMatter < tech.cost.quantumMatter) canAfford = false;
      if (tech.cost.exoticCores && (baseInv.exoticCores || 0) < tech.cost.exoticCores) canAfford = false;
      
      const elementsKeys = ['earthElement', 'airElement', 'waterElement', 'metalElement', 'soilElement', 'symmetryCrystal'];
      elementsKeys.forEach(k => {
        if (tech.cost[k] && (baseInv[k] || 0) < tech.cost[k]) canAfford = false;
      });

      if (canAfford) {
        // Deduct
        if (tech.cost.quantumMatter) {
          mothershipBase.inventory.quantumMatter -= tech.cost.quantumMatter;
          sim.qm = mothershipBase.inventory.quantumMatter;
        }
        if (tech.cost.exoticCores) baseInv.exoticCores -= tech.cost.exoticCores;
        
        elementsKeys.forEach(k => {
          if (tech.cost[k]) baseInv[k] -= tech.cost[k];
        });

        // Add to unlocked tech array
        mothershipBase.unlockedTech.push(selectedTechId);
        
        // Spawn glorious celebration particles inside base rendering or log it
        appendLog(`✨ COGNITIVE_BRAIN_UNLOCKED: Integrated Zodiac Core [${tech.name.toUpperCase()}] into central processor neural network! Upgraded: ${tech.title}`);
        
        updateTechTreeModal();
        mothershipBase.updateUiDisplay();
        if (window.saveGame) window.saveGame();
      } else {
        appendLog("❌ UPGRADE_FAILED: Stockpile validation failed.");
      }
    });
  }

  // Bind Cyber Brutalist Debug Panel Override Buttons
  function ensureMothershipBase() {
    if (!mothershipBase && sim) {
      mothershipBase = new MothershipBase(canvas);
      window.mothershipBase = mothershipBase;
      window.saveGame = () => {
        if (mothershipBase) {
          mothershipBase.inventory.quantumMatter = Math.round(sim.qm);
          mothershipBase.saveToStorage();
        }
      };
      mothershipBase.inventory.quantumMatter = Math.round(sim.qm);
      return mothershipBase.loadFromStorage();
    }
    return Promise.resolve();
  }

  const devAddQm = document.getElementById('dev-add-qm');
  if (devAddQm) {
    devAddQm.addEventListener('click', () => {
      ensureMothershipBase();
      sim.qm += 5000;
      if (mothershipBase) {
        mothershipBase.inventory.quantumMatter += 5000;
        mothershipBase.updateUiDisplay();
        if (window.saveGame) window.saveGame();
      }
      appendLog("🚨 DEV_CHEAT: Granted +5,000 Quantum Matter stockpile.");
    });
  }

  const devAddCores = document.getElementById('dev-add-cores');
  if (devAddCores) {
    devAddCores.addEventListener('click', () => {
      ensureMothershipBase();
      if (mothershipBase) {
        mothershipBase.inventory.exoticCores += 50;
        mothershipBase.updateUiDisplay();
        if (window.saveGame) window.saveGame();
      }
      appendLog("🚨 DEV_CHEAT: Granted +50 Exotic Cores core components.");
    });
  }

  const devAddTethers = document.getElementById('dev-add-tethers');
  if (devAddTethers) {
    devAddTethers.addEventListener('click', () => {
      ensureMothershipBase();
      if (mothershipBase) {
        mothershipBase.inventory.zodiacTethers += 10;
        mothershipBase.updateUiDisplay();
        if (window.saveGame) window.saveGame();
      }
      appendLog("🚨 DEV_CHEAT: Granted +10 Zodiac Tethers portal items.");
    });
  }

  const devAddElements = document.getElementById('dev-add-elements');
  if (devAddElements) {
    devAddElements.addEventListener('click', () => {
      ensureMothershipBase();
      if (mothershipBase) {
        mothershipBase.inventory.earthElement = (mothershipBase.inventory.earthElement || 0) + 20;
        mothershipBase.inventory.airElement = (mothershipBase.inventory.airElement || 0) + 20;
        mothershipBase.inventory.waterElement = (mothershipBase.inventory.waterElement || 0) + 20;
        mothershipBase.inventory.metalElement = (mothershipBase.inventory.metalElement || 0) + 20;
        mothershipBase.inventory.soilElement = (mothershipBase.inventory.soilElement || 0) + 20;
        mothershipBase.inventory.symmetryCrystal = (mothershipBase.inventory.symmetryCrystal || 0) + 20;
        mothershipBase.updateUiDisplay();
        if (window.saveGame) window.saveGame();
      }
      appendLog("🚨 DEV_CHEAT: Granted +20 of all basic Planetary Elemental Essences and Symmetry Crystals.");
    });
  }

  const devUnlockTechs = document.getElementById('dev-unlock-techs');
  if (devUnlockTechs) {
    devUnlockTechs.addEventListener('click', () => {
      ensureMothershipBase();
      if (mothershipBase) {
        mothershipBase.unlockedTech = [
          'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
          'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'
        ];
        mothershipBase.updateUiDisplay();
        if (window.saveGame) window.saveGame();
      }
      appendLog("🚨 DEV_CHEAT: Unlocked all 12 Zodiac Brain tech tree nodes!");
    });
  }

  const devUnlockSectors = document.getElementById('dev-unlock-sectors');
  if (devUnlockSectors) {
    devUnlockSectors.addEventListener('click', () => {
      ensureMothershipBase();
      if (mothershipBase) {
        mothershipBase.unlockedSectors = [];
        for (let x = 0; x < 12; x++) {
          for (let y = 0; y < 12; y++) {
            mothershipBase.unlockedSectors.push({ x, y });
          }
        }
        mothershipBase.updateUiDisplay();
        if (window.saveGame) window.saveGame();
      }
      appendLog("🚨 DEV_CHEAT: Unlocked entire 12x12 Mothership grid mainframe matrix!");
    });
  }

  const devResetGame = document.getElementById('dev-reset-game');
  if (devResetGame) {
    let resetStep = 0;
    devResetGame.addEventListener('click', () => {
      if (resetStep === 0) {
        devResetGame.textContent = "SURE?";
        resetStep = 1;
        setTimeout(() => {
          if (resetStep === 1) {
             devResetGame.textContent = "RESET_ALL";
             resetStep = 0;
          }
        }, 3000);
      } else if (resetStep === 1) {
        if (window.GameStorage) {
          window.GameStorage.clear()
            .then(() => {
              window.location.reload();
            });
        }
      }
    });
  }

  // Bind Mothership Building Placer tool buttons
  const baseTools = ['extractor', 'extractor_element', 'belt', 'synthesizer_matter', 'synthesizer_elements', 'synthesizer_zodiac', 'storage', 'assembler', 'factory', 'deployer'];
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

  // Bind Mothership Bottom Dock Category Tab Switching
  const catBtnLogistics = document.getElementById('cat-btn-logistics');
  const catBtnProduction = document.getElementById('cat-btn-production');
  const catBtnElements = document.getElementById('cat-btn-elements');
  const catBtnSystems = document.getElementById('cat-btn-systems');

  const dockGroupLogistics = document.getElementById('dock-group-logistics');
  const dockGroupProduction = document.getElementById('dock-group-production');
  const dockGroupElements = document.getElementById('dock-group-elements');
  const dockGroupSystems = document.getElementById('dock-group-systems');

  const switchCategory = (activeCat) => {
    // Buttons
    if (catBtnLogistics) catBtnLogistics.classList.toggle('active', activeCat === 'logistics');
    if (catBtnProduction) catBtnProduction.classList.toggle('active', activeCat === 'production');
    if (catBtnElements) catBtnElements.classList.toggle('active', activeCat === 'elements');
    if (catBtnSystems) catBtnSystems.classList.toggle('active', activeCat === 'systems');

    // Groups
    if (dockGroupLogistics) dockGroupLogistics.style.display = activeCat === 'logistics' ? 'flex' : 'none';
    if (dockGroupProduction) dockGroupProduction.style.display = activeCat === 'production' ? 'flex' : 'none';
    if (dockGroupElements) dockGroupElements.style.display = activeCat === 'elements' ? 'flex' : 'none';
    if (dockGroupSystems) dockGroupSystems.style.display = activeCat === 'systems' ? 'flex' : 'none';

    appendLog(`MOTHERSHIP_BASE: Switched bottom dock category to [${activeCat.toUpperCase()}].`);
  };

  if (catBtnLogistics) catBtnLogistics.addEventListener('click', () => switchCategory('logistics'));
  if (catBtnProduction) catBtnProduction.addEventListener('click', () => switchCategory('production'));
  if (catBtnElements) catBtnElements.addEventListener('click', () => switchCategory('elements'));
  if (catBtnSystems) catBtnSystems.addEventListener('click', () => switchCategory('systems'));

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
          appendLog(`🏆 VICTORY: Objectives complete! Return to Cosmic Sector and click "FINALIZE CONQUEST" on the flagship control console to claim your rewards.`);
        } else {
          appendLog(`↩ RETREATING: Returned to Orbit. Your planetary bases and units remain active on the conquest field. Re-enter at any time.`);
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
          const baseTools = ['extractor', 'extractor_element', 'belt', 'synthesizer_matter', 'synthesizer_elements', 'synthesizer_zodiac', 'storage', 'assembler', 'factory', 'deployer'];
          baseTools.forEach(t => {
            const btn = document.getElementById(`tool-${t}`);
            if (btn) btn.classList.remove('active');
          });
          const demolishBtn = document.getElementById('tool-demolish');
          if (demolishBtn) demolishBtn.classList.remove('active');
          appendLog("MOTHERSHIP_BASE: Deselected active placer tool.");
        } else {
          isCameraDragging = true;
          dragStartX = e.clientX;
          dragStartY = e.clientY;
          camStartX = mothershipBase.cameraX;
          camStartY = mothershipBase.cameraY;
          clickDistance = 0;
        }
      } else if (e.button === 1) {
        isCameraDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        camStartX = mothershipBase.cameraX;
        camStartY = mothershipBase.cameraY;
        clickDistance = 0;
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
    else if (activeMode === 'solarsystem' && currentSolarSystem) {
      if (e.button === 0) {
        const planetIdx = currentSolarSystem.checkPlanetClick(x, y);
        if (planetIdx !== -1) {
          currentSolarSystem.selectedPlanetIndex = planetIdx;
          selectPlanet(planetIdx);
        }
      }
    }
  });

  window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    mousePos.x = x;
    mousePos.y = y;

    if (activeMode === 'solarsystem' && currentSolarSystem) {
      const hoverIdx = currentSolarSystem.checkPlanetClick(x, y);
      currentSolarSystem.hoveredPlanetIndex = hoverIdx;
    }
    
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
    else if (activeMode === 'mothership' && mothershipBase) {
      if (isCameraDragging) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        mothershipBase.cameraX = camStartX + dx;
        mothershipBase.cameraY = camStartY + dy;
        clickDistance += Math.abs(dx) + Math.abs(dy);
      }
    }
  });

  window.addEventListener('mouseup', (e) => {
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
              const carrier = sim.ships.find(s => s.type === 'carrier');
              if (carrier) {
                if (carrier.deployState === 'deployed' && carrier.dockedTearId === clickedTear.id) {
                  if (!sim.activeTearId) {
                    appendLog(`🔮 VOID_GATEWAY: Commencing Conquest deployment. Drop target theme: [${clickedTear.themeId.toUpperCase()}].`);
                    sim.activeTearId = clickedTear.id;
                    launchConquest(clickedTear.themeId, clickedTear.isSmallGrind);
                  } else {
                    appendLog(`🔮 VOID_GATEWAY: Re-entering active Conquest field [${clickedTear.themeId.toUpperCase()}].`);
                    if (conquestBattle) {
                      switchMode('conquest');
                    } else {
                      launchConquest(clickedTear.themeId, clickedTear.isSmallGrind);
                    }
                  }
                } else if (carrier.deployState === 'deploying' && carrier.dockedTearId === clickedTear.id) {
                  appendLog(`⚓ LOCK-IN: Flagship deployment in progress. Please wait for the tentacles to fully spread before launching the Conquest Drop.`);
                } else {
                  carrier.targetX = clickedTear.x;
                  carrier.targetY = clickedTear.y;
                  appendLog(`🚀 SPACETIME_TEAR: Directing flagship carrier to swim to center of spacetime tear [${clickedTear.themeId.toUpperCase()}].`);
                }
              } else {
                appendLog(`🚀 VOID_TEAR_ENGAGED: Transitioning fleet inside spacetime rip. Drop target theme: [${clickedTear.themeId.toUpperCase()}].`);
                launchConquest(clickedTear.themeId, clickedTear.isSmallGrind);
              }
              sim.selectionStart = null;
              sim.selectionEnd = null;
              return;
            }
          }

          // Check click inside Tavern/Landmark structures
          const clickedStruct = getStructureAt(worldX, worldY);
          if (clickedStruct && (clickedStruct.type === 'tavern' || clickedStruct.type === 'city')) {
            selectedTavern = clickedStruct;
            const carrier = sim.ships.find(s => s.type === 'carrier');
            let dist = 9999;
            if (carrier) {
              const dx = carrier.x - clickedStruct.x;
              const dy = carrier.y - clickedStruct.y;
              dist = Math.round(Math.sqrt(dx * dx + dy * dy));
            }
            
            // Show the Tavern detailed overlay
            const tavernOverlay = document.getElementById('tavern-detail-overlay');
            if (tavernOverlay) {
              tavernOverlay.style.display = 'block';
              document.getElementById('tavern-card-name').textContent = clickedStruct.name.toUpperCase();
              document.getElementById('tavern-card-desc').textContent = clickedStruct.description;
              document.getElementById('tavern-card-dist').textContent = carrier ? `${dist} units` : 'DESTROYED';
              
              const region = sim.getRegionAt(clickedStruct.x, clickedStruct.y);
              document.getElementById('tavern-card-zodiac').textContent = region ? `${region.zodiac} Domain` : 'Unstable Space';
              
              const deployBtn = document.getElementById('btn-deploy-system-probe');
              if (deployBtn) {
                if (dist <= 250) {
                  deployBtn.disabled = false;
                  deployBtn.textContent = '⚡ DOCK & ENTER SYSTEM';
                  deployBtn.style.borderColor = 'var(--color-green)';
                  deployBtn.style.color = 'var(--color-green)';
                  deployBtn.style.background = 'rgba(0, 255, 102, 0.05)';
                  deployBtn.style.cursor = 'pointer';
                } else {
                  deployBtn.disabled = true;
                  deployBtn.textContent = 'MOVE FLAGSHIP CLOSER (REQ. < 250u)';
                  deployBtn.style.borderColor = 'var(--color-text-dim)';
                  deployBtn.style.color = 'var(--color-text-dim)';
                  deployBtn.style.background = 'none';
                  deployBtn.style.cursor = 'not-allowed';
                }
              }
            }
            
            appendLog(`📍 LANDMARK_LOCATED: Focused scanning arrays on ${clickedStruct.name.toUpperCase()}.`);
            sim.selectionStart = null;
            sim.selectionEnd = null;
            return;
          } else {
            const tavernOverlay = document.getElementById('tavern-detail-overlay');
            if (tavernOverlay) tavernOverlay.style.display = 'none';
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
    else if (activeMode === 'mothership' && mothershipBase) {
      if (isCameraDragging) {
        isCameraDragging = false;
        // If they released the right mouse button and didn't move much, cycle building config!
        if (e.button === 2 && clickDistance <= 12) {
          mothershipBase.handleRightClick(x, y);
        }
      } else if (e.button === 2) {
        mothershipBase.handleRightClick(x, y);
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
    } else if (activeMode === 'mothership' && mothershipBase) {
      const zoomSpeed = 0.08;
      const oldZoom = mothershipBase.zoom || 1.0;
      let newZoom = oldZoom;

      if (e.deltaY < 0) {
        newZoom = Math.min(2.5, oldZoom + zoomSpeed);
      } else {
        newZoom = Math.max(0.4, oldZoom - zoomSpeed);
      }

      mothershipBase.zoom = newZoom;
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
      if (key === '1') document.getElementById('tool-belt')?.click();
      if (key === '2') document.getElementById('tool-storage')?.click();
      if (key === '3') document.getElementById('tool-deployer')?.click();
      if (key === '4') {
        const ext = document.getElementById('tool-extractor');
        const extEl = document.getElementById('tool-extractor_element');
        if (ext && ext.parentElement.style.display !== 'none') ext.click();
        else if (extEl && extEl.parentElement.style.display !== 'none') extEl.click();
      }
      if (key === '5') {
        const sm = document.getElementById('tool-synthesizer_matter');
        const se = document.getElementById('tool-synthesizer_elements');
        if (sm && sm.parentElement.style.display !== 'none') sm.click();
        else if (se && se.parentElement.style.display !== 'none') se.click();
      }
      if (key === '6') {
        const am = document.getElementById('tool-assembler');
        const sz = document.getElementById('tool-synthesizer_zodiac');
        if (am && am.parentElement.style.display !== 'none') am.click();
        else if (sz && sz.parentElement.style.display !== 'none') sz.click();
      }
      if (key === '7') document.getElementById('tool-factory')?.click();
      if (key === 'x') document.getElementById('tool-demolish')?.click();
    }
  });

  window.addEventListener('keyup', (e) => {
    keysPressed[e.key.toLowerCase()] = false;
  });

  // Initialize Solar System events
  initSolarSystemEvents();

  // Force initial view and visibility state setup on application start
  switchMode('cosmic');

  // Initialize loop
  tickGameLoop();
}

function getNearbySystem(carrier) {
  if (!carrier) return null;
  const cx = Math.floor(carrier.x / 1500);
  const cy = Math.floor(carrier.y / 1500);
  
  // Check flagship's current chunk and 8 neighbors
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const struct = getStructureInChunk(cx + dx, cy + dy);
      if (struct && (struct.type === 'tavern' || struct.type === 'city')) {
        const dist = Math.hypot(carrier.x - struct.x, carrier.y - struct.y);
        if (dist <= 250) {
          return { struct, dist };
        }
      }
    }
  }
  return null;
}
window.getNearbySystem = getNearbySystem;

function selectPlanet(planetIdx) {
  if (!currentSolarSystem) return;
  currentSolarSystem.selectedPlanetIndex = planetIdx;
  
  const planet = currentSolarSystem.planets[planetIdx];
  const inspectorPanel = document.getElementById('solarsystem-inspector-panel');
  const emptyHelper = document.getElementById('solarsystem-empty-helper');
  
  if (!planet) {
    if (inspectorPanel) inspectorPanel.style.display = 'none';
    if (emptyHelper) emptyHelper.style.display = 'block';
    return;
  }
  
  if (inspectorPanel) inspectorPanel.style.display = 'block';
  if (emptyHelper) emptyHelper.style.display = 'none';
  
  const nameEl = document.getElementById('inspector-planet-name');
  if (nameEl) nameEl.textContent = planet.name.toUpperCase();
  
  const elem = planet.preferredElement;
  const yieldEl = document.getElementById('inspector-planet-yield');
  if (yieldEl) {
    yieldEl.textContent = `${elem.name.toUpperCase()} (${elem.stat})`;
    yieldEl.style.color = elem.color;
  }
  
  const peakEl = document.getElementById('tuner-resonance-peak');
  if (peakEl) peakEl.textContent = `${planet.resonancePeak.toFixed(1)} Hz`;
  
  const slider = document.getElementById('slider-planet-freq');
  if (slider) {
    // Only set slider value if the user is not actively dragging it to prevent fighting
    if (document.activeElement !== slider) {
      slider.value = planet.targetFrequency;
    }
  }
  
  updatePlanetTunerDisplay(planet);
  updateActiveProbesList(planet);
}
window.selectPlanet = selectPlanet;

function updatePlanetTunerDisplay(planet) {
  const currentFreqEl = document.getElementById('tuner-current-freq');
  if (currentFreqEl) currentFreqEl.textContent = `${planet.vibrationFrequency.toFixed(1)} Hz`;
  
  const freqDiff = Math.abs(planet.vibrationFrequency - planet.resonancePeak);
  let matchPct = 0;
  if (freqDiff < 1.5) {
    matchPct = Math.round(((1.5 - freqDiff) / 1.5) * 100);
  }
  
  const matchBar = document.getElementById('tuner-match-bar');
  if (matchBar) {
    const barWidth = 10;
    const filledChars = Math.round((matchPct / 100) * barWidth);
    const emptyChars = barWidth - filledChars;
    const barStr = '[' + '='.repeat(filledChars) + ' '.repeat(emptyChars) + ']';
    matchBar.textContent = `${barStr} ${matchPct}% RESONANT`;
    
    if (matchPct > 80) {
      matchBar.style.color = 'var(--color-green)';
      matchBar.style.borderColor = 'var(--color-green)';
    } else if (matchPct > 40) {
      matchBar.style.color = 'var(--color-cyan)';
      matchBar.style.borderColor = 'var(--color-cyan)';
    } else {
      matchBar.style.color = 'var(--color-text-dim)';
      matchBar.style.borderColor = 'var(--color-border)';
    }
  }
}
window.updatePlanetTunerDisplay = updatePlanetTunerDisplay;

function updateActiveProbesList(planet) {
  const listEl = document.getElementById('inspector-probes-list');
  if (!listEl) return;
  
  listEl.innerHTML = '';
  
  if (planet.plantedSeeds.length === 0) {
    listEl.innerHTML = '<div style="font-size: 9px; color: var(--color-text-dim); font-style: italic; margin-top: 4px;">No active probe cores sown. Deploy one below!</div>';
    return;
  }
  
  planet.plantedSeeds.forEach(seed => {
    const seedRow = document.createElement('div');
    seedRow.style.cssText = 'display: flex; flex-direction: column; border: 1px solid rgba(255,255,255,0.15); padding: 5px; background: rgba(0,0,0,0.3); font-size: 9px; margin-bottom: 4px;';
    
    const progressPct = Math.round(seed.progress);
    
    const topLine = document.createElement('div');
    topLine.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 3px;';
    
    const labelSpan = document.createElement('span');
    labelSpan.textContent = `CRYSTAL_NODE [${seed.id}]`;
    labelSpan.style.color = seed.element.color;
    labelSpan.style.fontWeight = 'bold';
    
    const stateSpan = document.createElement('span');
    stateSpan.textContent = seed.harvestReady ? 'READY TO HARVEST' : `GROWING: ${progressPct}%`;
    stateSpan.style.color = seed.harvestReady ? 'var(--color-green)' : 'var(--color-cyan)';
    stateSpan.style.fontWeight = 'bold';
    
    topLine.appendChild(labelSpan);
    topLine.appendChild(stateSpan);
    seedRow.appendChild(topLine);
    
    const barContainer = document.createElement('div');
    barContainer.style.cssText = 'width: 100%; height: 3px; background: #111; margin-bottom: 4px; border-radius: 1px; overflow: hidden;';
    const barFill = document.createElement('div');
    barFill.style.cssText = `width: ${progressPct}%; height: 100%; background: ${seed.harvestReady ? '#00ff66' : seed.element.color}; transition: width 0.1s linear;`;
    barContainer.appendChild(barFill);
    seedRow.appendChild(barContainer);
    
    const actionLine = document.createElement('div');
    actionLine.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
    
    const yieldInfo = document.createElement('span');
    yieldInfo.textContent = `Est. Yield: +${seed.value} units`;
    yieldInfo.style.color = 'var(--color-text-dim)';
    
    const harvestBtn = document.createElement('button');
    harvestBtn.className = 'tactics-btn font-mono';
    harvestBtn.style.cssText = 'padding: 2px 6px; font-size: 8px; cursor: pointer;';
    
    if (seed.harvestReady) {
      harvestBtn.textContent = 'HARVEST ⚡';
      harvestBtn.style.borderColor = 'var(--color-green)';
      harvestBtn.style.color = '#fff';
      harvestBtn.style.background = 'rgba(0, 255, 102, 0.15)';
      
      harvestBtn.addEventListener('click', () => {
        const harvested = currentSolarSystem.harvestProbe(currentSolarSystem.selectedPlanetIndex, seed.id, mothershipBase);
        if (harvested) {
          if (mothershipBase) {
            sim.qm = mothershipBase.inventory.quantumMatter;
            mothershipBase.updateUiDisplay();
            mothershipBase.saveToStorage();
          }
          appendLog(`⛏️ HARVESTED: Transmuted matured ${harvested.element.name} crystal. Gained +${harvested.value} elements into mothership cargo!`);
          updateActiveProbesList(planet);
          updatePlanetList();
        }
      });
    } else {
      harvestBtn.textContent = 'GROWING';
      harvestBtn.disabled = true;
      harvestBtn.style.borderColor = 'rgba(255,255,255,0.15)';
      harvestBtn.style.color = 'var(--color-text-dim)';
      harvestBtn.style.background = 'none';
      harvestBtn.style.cursor = 'not-allowed';
    }
    
    actionLine.appendChild(yieldInfo);
    actionLine.appendChild(harvestBtn);
    seedRow.appendChild(actionLine);
    
    listEl.appendChild(seedRow);
  });
}
window.updateActiveProbesList = updateActiveProbesList;

function updatePlanetList() {
  const listEl = document.getElementById('solarsystem-planet-list');
  if (!listEl || !currentSolarSystem) return;
  
  listEl.innerHTML = '';
  
  currentSolarSystem.planets.forEach((planet, idx) => {
    const isSelected = idx === currentSolarSystem.selectedPlanetIndex;
    
    const rowBtn = document.createElement('button');
    rowBtn.className = 'tactics-btn font-mono';
    rowBtn.style.cssText = `width: 100%; text-align: left; padding: 6px 8px; font-size: 9.5px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;`;
    
    if (isSelected) {
      rowBtn.style.borderColor = 'var(--color-cyan)';
      rowBtn.style.color = 'var(--color-cyan)';
      rowBtn.style.background = 'rgba(0, 229, 255, 0.08)';
    } else {
      rowBtn.style.borderColor = 'var(--color-border)';
      rowBtn.style.color = '#fff';
      rowBtn.style.background = 'rgba(255, 255, 255, 0.01)';
    }
    
    const leftSide = document.createElement('span');
    leftSide.textContent = `🪐 ${planet.name.toUpperCase()}`;
    
    const rightSide = document.createElement('span');
    rightSide.style.cssText = 'font-size: 8.5px;';
    if (planet.plantedSeeds.length > 0) {
      const readyCount = planet.plantedSeeds.filter(s => s.harvestReady).length;
      if (readyCount > 0) {
        rightSide.textContent = `READY (${readyCount})`;
        rightSide.style.color = 'var(--color-green)';
        rightSide.style.fontWeight = 'bold';
      } else {
        rightSide.textContent = `SOWN (${planet.plantedSeeds.length})`;
        rightSide.style.color = 'var(--color-cyan)';
      }
    } else {
      rightSide.textContent = 'BARREN';
      rightSide.style.color = 'var(--color-text-dim)';
    }
    
    rowBtn.appendChild(leftSide);
    rowBtn.appendChild(rightSide);
    
    rowBtn.addEventListener('click', () => {
      currentSolarSystem.selectedPlanetIndex = idx;
      selectPlanet(idx);
    });
    
    listEl.appendChild(rowBtn);
  });
}
window.updatePlanetList = updatePlanetList;

function initSolarSystemEvents() {
  const returnBtn = document.getElementById('btn-solarsystem-return');
  if (returnBtn) {
    returnBtn.addEventListener('click', () => {
      switchMode('cosmic');
      appendLog("◀ HARMONIZATION_DECK: Returning to Cosmic Sector tactical overview.");
    });
  }
  
  const slider = document.getElementById('slider-planet-freq');
  if (slider) {
    slider.addEventListener('input', () => {
      if (currentSolarSystem && currentSolarSystem.selectedPlanetIndex !== -1) {
        const planet = currentSolarSystem.planets[currentSolarSystem.selectedPlanetIndex];
        if (planet) {
          planet.targetFrequency = parseFloat(slider.value);
          updatePlanetTunerDisplay(planet);
        }
      }
    });
  }
  
  const plantBtn = document.getElementById('btn-plant-probe');
  if (plantBtn) {
    plantBtn.addEventListener('click', () => {
      if (!currentSolarSystem || currentSolarSystem.selectedPlanetIndex === -1) return;
      const planet = currentSolarSystem.planets[currentSolarSystem.selectedPlanetIndex];
      if (!planet) return;
      
      if (planet.plantedSeeds.length >= 3) {
        appendLog("<span class='text-red'>🌱 DEPLOY_BLOCKED: Max active probe slots reached on this planet. (Limit: 3)</span>");
        return;
      }
      
      if (sim.qm >= 30) {
        sim.qm -= 30;
        if (mothershipBase) {
          mothershipBase.inventory.quantumMatter = Math.round(sim.qm);
          mothershipBase.updateUiDisplay();
          mothershipBase.saveToStorage();
        }
        currentSolarSystem.plantProbe(currentSolarSystem.selectedPlanetIndex);
        appendLog(`🌱 SOWN_PROBE: Sowed an advanced bio-resonant probe core into ${planet.name.toUpperCase()}'s atmospheric mantle. (-30 QM)`);
        
        updateActiveProbesList(planet);
        updatePlanetList();
      } else {
        appendLog("<span class='text-red'>🌱 DEPLOY_BLOCKED: Insufficient QM to sow probe core. (30 QM required)</span>");
      }
    });
  }
  
  const deployTavernProbeBtn = document.getElementById('btn-deploy-system-probe');
  if (deployTavernProbeBtn) {
    deployTavernProbeBtn.addEventListener('click', () => {
      if (!selectedTavern) return;
      
      // Instantiate or recover SolarSystem (completely free of QM cost!)
      sim.discoveredSolarSystems = sim.discoveredSolarSystems || {};
      const ssKey = `${selectedTavern.x},${selectedTavern.y}`;
      let solSystem = sim.discoveredSolarSystems[ssKey];
      if (!solSystem) {
        solSystem = new SolarSystem(canvas, selectedTavern.x, selectedTavern.y, selectedTavern, sim.getRegionAt(selectedTavern.x, selectedTavern.y));
        sim.discoveredSolarSystems[ssKey] = solSystem;
      }
      currentSolarSystem = solSystem;
      
      appendLog(`🚀 DOCKING: Successfully docked flagship inside orbital pathways of ${selectedTavern.name.toUpperCase()}! Harmonization deck online.`);
      
      switchMode('solarsystem');
    });
  }
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
  const carrier = sim.ships.find(s => s.type === 'carrier');
  const carrierIsDeployedOrDeploying = carrier && carrier.deployState && carrier.deployState !== 'none';
  const carrierSelected = selectedList.some(s => s.type === 'carrier') || carrierIsDeployedOrDeploying;

  // Toggle standard vs deployed panel elements
  const standardCmds = document.getElementById('tactical-commands-standard');
  const deployedCmds = document.getElementById('tactical-commands-deployed');
  if (standardCmds && deployedCmds) {
    if (carrierIsDeployedOrDeploying) {
      standardCmds.style.display = 'none';
      deployedCmds.style.display = 'grid';
    } else {
      standardCmds.style.display = 'grid';
      deployedCmds.style.display = 'none';
    }
  }

  // Dynamically update deployed panel buttons based on conquest state
  if (carrierIsDeployedOrDeploying && carrier) {
    const btnDeployedLaunch = document.getElementById('btn-deployed-launch');
    const btnDeployedFinalize = document.getElementById('btn-deployed-finalize');
    const btnDeployedUndeploy = document.getElementById('btn-deployed-undeploy');
    const activeConquest = sim.activeTearId;
    const isWon = conquestBattle && conquestBattle.conquestWon;

    if (activeConquest) {
      if (btnDeployedLaunch) {
        btnDeployedLaunch.textContent = "🔮 RE-ENTER CONQUEST FIELD";
        btnDeployedLaunch.style.borderColor = "#9c27b0";
        btnDeployedLaunch.style.color = "#ea80fc";
        btnDeployedLaunch.style.background = "rgba(156, 39, 176, 0.08)";
        btnDeployedLaunch.style.textShadow = "0 0 5px rgba(234,128,252,0.3)";
      }
      if (btnDeployedUndeploy) {
        btnDeployedUndeploy.textContent = "⚠️ ABANDON CONQUEST & UNDOCK";
        btnDeployedUndeploy.style.borderColor = "var(--color-red)";
        btnDeployedUndeploy.style.color = "var(--color-red)";
        btnDeployedUndeploy.style.background = "rgba(255, 51, 68, 0.08)";
      }
      if (btnDeployedFinalize) {
        if (isWon) {
          btnDeployedFinalize.style.display = 'block';
        } else {
          btnDeployedFinalize.style.display = 'none';
        }
      }
    } else {
      if (btnDeployedLaunch) {
        btnDeployedLaunch.textContent = "🚀 LAUNCH CONQUEST DROP";
        btnDeployedLaunch.style.borderColor = "var(--color-green)";
        btnDeployedLaunch.style.color = "var(--color-green)";
        btnDeployedLaunch.style.background = "rgba(0, 255, 102, 0.05)";
        btnDeployedLaunch.style.textShadow = "0 0 5px rgba(0,255,102,0.3)";
      }
      if (btnDeployedUndeploy) {
        btnDeployedUndeploy.textContent = "⚓ RETRACT TENTACLES (UN-DEPLOY)";
        btnDeployedUndeploy.style.borderColor = "var(--color-red)";
        btnDeployedUndeploy.style.color = "var(--color-red)";
        btnDeployedUndeploy.style.background = "rgba(255, 51, 68, 0.05)";
      }
      if (btnDeployedFinalize) {
        btnDeployedFinalize.style.display = 'none';
      }
    }
  }
  
  // Update overall overlay container visibility
  const shipyardPanel = document.getElementById('shipyard-hud-overlay');
  const commandPanel = document.getElementById('command-hud-overlay');
  const formationPanel = document.getElementById('formation-hud-overlay');

  if (selectedList.length > 0 || carrierIsDeployedOrDeploying) {
    if (formationPanel && selectedList.length > 0) formationPanel.classList.add('active');
    
    if (carrierSelected) {
      if (shipyardPanel) {
        if (carrierIsDeployedOrDeploying) {
          shipyardPanel.classList.remove('active');
        } else {
          shipyardPanel.classList.add('active');
        }
      }
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

function drawConquestRadarMinimap() {
  const cRadar = document.getElementById('conquest-radar-canvas');
  if (!cRadar || !conquestBattle) return;
  const ctx = cRadar.getContext('2d');
  const w = cRadar.width;
  const h = cRadar.height;

  // 1. Clear with deep space black
  ctx.fillStyle = '#010204';
  ctx.fillRect(0, 0, w, h);

  // 2. Map dimensions and scaling
  const mapW = conquestBattle.map.width;
  const mapH = conquestBattle.map.height;
  const scaleX = w / mapW;
  const scaleY = h / mapH;
  const scale = Math.min(scaleX, scaleY);

  const drawW = mapW * scale;
  const drawH = mapH * scale;
  const offsetX = (w - drawW) / 2;
  const offsetY = (h - drawH) / 2;

  // 3. Draw map boundaries
  ctx.strokeStyle = 'rgba(255, 51, 68, 0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(offsetX, offsetY, drawW, drawH);

  // 4. Draw mineral vein deposits on minimap
  conquestBattle.map.resources.forEach(res => {
    if (res.type === 'deposit' && res.amount > 0) {
      if (!conquestBattle.isPositionInVision(res.x, res.y)) return;
      const rx = offsetX + res.x * scale;
      const ry = offsetY + res.y * scale;
      ctx.fillStyle = res.color;
      ctx.beginPath();
      ctx.arc(rx, ry, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // 5. Draw player units (green/yellow) and flagship (white)
  conquestBattle.playerUnits.forEach(u => {
    const rx = offsetX + u.x * scale;
    const ry = offsetY + u.y * scale;
    ctx.fillStyle = u.type === 'gatherer' ? '#ffaa00' : '#00ff66';
    ctx.fillRect(rx - 1.5, ry - 1.5, 3, 3);
  });

  const ms = conquestBattle.mothership;
  if (ms) {
    const rx = offsetX + ms.x * scale;
    const ry = offsetY + ms.y * scale;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 6. Draw enemy units & structures (red)
  conquestBattle.enemyUnits.forEach(e => {
    const inVision = conquestBattle.isPositionInVision(e.x, e.y);
    const isBase = e.type === 'citadel' || e.type === 'turret';
    if (!inVision && !isBase) return; // Hidden units stay hidden on radar

    const rx = offsetX + e.x * scale;
    const ry = offsetY + e.y * scale;
    ctx.fillStyle = inVision ? '#ff3344' : 'rgba(255, 51, 68, 0.3)';
    
    if (isBase) {
      ctx.fillRect(rx - 3, ry - 3, 6, 6);
    } else {
      ctx.fillRect(rx - 1.5, ry - 1.5, 3, 3);
    }
  });

  // 7. Draw camera viewport outline (yellow-green/cyan) showing where the player camera is
  const camX = conquestBattle.camera.x;
  const camY = conquestBattle.camera.y;
  const viewW = conquestBattle.canvas.width / conquestBattle.camera.zoom;
  const viewH = conquestBattle.canvas.height / conquestBattle.camera.zoom;

  const cvX = offsetX + camX * scale;
  const cvY = offsetY + camY * scale;
  const cvW = viewW * scale;
  const cvH = viewH * scale;

  ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(cvX, cvY, cvW, cvH);

  // 8. Sweep line
  const sweepAngle = (conquestBattle.time * 1.6) % (Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 51, 68, 0.08)';
  ctx.beginPath();
  ctx.moveTo(w / 2, h / 2);
  ctx.lineTo(w / 2 + Math.cos(sweepAngle) * 75, h / 2 + Math.sin(sweepAngle) * 75);
  ctx.stroke();
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

    // Run mothership tick in background continuously so factory production runs in all modes
    if (mothershipBase) {
      // Sync simulation QM to Mothership Base first so harvested QM is not lost
      mothershipBase.inventory.quantumMatter = Math.round(sim.qm);
      mothershipBase.tick();
      // Keep cosmic map QM in sync with Mothership Base so we share resources in real-time
      sim.qm = mothershipBase.inventory.quantumMatter;
    }

    // 1. Handle Keyboard edge scrollings
    handleCameraScrolling();

    if (activeMode === 'cosmic' || activeMode === 'grid') {
      // 2. Perform core physics tick
      sim.tick();

      // 3. Render Canvas
      sim.render();

      // Check if flagship has arrived inside any spacetime tear
      const carrier = sim.ships.find(s => s.type === 'carrier');
      if (carrier && sim.spaceTears && sim.spaceTears.length > 0) {
        sim.spaceTears.forEach(tear => {
          const dx = carrier.x - tear.x;
          const dy = carrier.y - tear.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 48) {
            if (!carrier.deployCooldown || carrier.deployCooldown <= 0) {
              if (!carrier.deployState || carrier.deployState === 'none') {
                carrier.dockedTearId = tear.id;
                carrier.deployState = 'deploying';
                carrier.deployProgress = 0;
                // Snap carrier to tear center
                carrier.x = tear.x;
                carrier.y = tear.y;
                carrier.targetX = tear.x;
                carrier.targetY = tear.y;
                carrier.vx = 0;
                carrier.vy = 0;
                appendLog(`⚓ DEPLOYING: Flagship has locked in position and is deploying tentacles into the spacetime tear [${tear.themeId.toUpperCase()}]. (2s duration)`);
              }
            }
          }
        });
      }

      // 4. Update HUD and sidebar details
      qmDisplay.textContent = Math.round(sim.qm);
      hudFleetCount.textContent = `${sim.ships.length} / 50`;
      hudCamCoords.textContent = `${Math.round(sim.camera.x + sim.width/2)}, ${Math.round(sim.camera.y + sim.height/2)}`;

      // Update cosmic region info in real-time based on flagship position
      const hudRegionName = document.getElementById('hud-region-name');
      const hudRegionTitle = document.getElementById('hud-region-title');
      const hudFlagshipCoords = document.getElementById('hud-flagship-coords');
      
      if (hudFlagshipCoords) {
        if (carrier) {
          hudFlagshipCoords.textContent = `${Math.round(carrier.x)}, ${Math.round(carrier.y)}`;
        } else {
          hudFlagshipCoords.textContent = 'DESTROYED';
        }
      }

      if (hudRegionName && hudRegionTitle) {
        const trackingX = carrier ? carrier.x : (sim.camera.x + sim.width / 2);
        const trackingY = carrier ? carrier.y : (sim.camera.y + sim.height / 2);
        const region = sim.getRegionAt(trackingX, trackingY);
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

      // Real-time proximal system docking tactical command check
      if (btnTacticalEnterSystem) {
        const nearby = getNearbySystem(carrier);
        if (nearby) {
          btnTacticalEnterSystem.style.display = 'block';
          btnTacticalEnterSystem.textContent = `⚡ ENTER ${nearby.struct.name.toUpperCase()}`;
        } else {
          btnTacticalEnterSystem.style.display = 'none';
        }
      }

      // 5. Render side list cards and real-time clock
      updateSelectionDecks();
      updateRealtimeClock();
      
      // 6. Draw tactical radar Minimap
      drawRadarMinimap();
    } 
    else if (activeMode === 'mothership' && mothershipBase) {
      // Render WebGL backdrop (stars & nebulae) underneath the mothership base!
      if (sim && sim.webglRenderer) {
        // Temporarily sync camera coordinates from mothership base to simulation
        const oldCamX = sim.camera.x;
        const oldCamY = sim.camera.y;
        const oldZoom = sim.camera.zoom;
        
        sim.camera.x = -mothershipBase.cameraX;
        sim.camera.y = -mothershipBase.cameraY;
        sim.camera.zoom = 1.0;
        
        // Render WebGL backdrop
        sim.webglRenderer.updateAndRender(sim, true);
        
        // Restore simulation camera coordinates
        sim.camera.x = oldCamX;
        sim.camera.y = oldCamY;
        sim.camera.zoom = oldZoom;
      }

      // Render mothership (tick is handled globally at start of frame)
      mothershipBase.render();

      // Update Mothership stockpile numbers
      updateMothershipUiStockpile();

      // Keep simulation QM in sync with Mothership Base so we share resources!
      sim.qm = mothershipBase.inventory.quantumMatter;
      qmDisplay.textContent = Math.round(sim.qm);
      
      hudFleetCount.textContent = "N/A";
      hudCamCoords.textContent = "DOCK_O1";
      hudThreatLevel.textContent = "STABLE";
      hudThreatLevel.className = "hud-val text-green";

      const hudFlagshipCoords = document.getElementById('hud-flagship-coords');
      if (hudFlagshipCoords) {
        hudFlagshipCoords.textContent = "DOCKED";
      }

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

      const hudFlagshipCoords = document.getElementById('hud-flagship-coords');
      if (hudFlagshipCoords) {
        hudFlagshipCoords.textContent = "ORBITAL_LOCK";
      }

      updateRealtimeClock();
      drawConquestRadarMinimap();
    }
    else if (activeMode === 'solarsystem' && currentSolarSystem) {
      currentSolarSystem.tick();
      currentSolarSystem.render();
      
      if (mothershipBase) {
        mothershipBase.inventory.quantumMatter = Math.round(sim.qm);
        mothershipBase.tick();
        sim.qm = mothershipBase.inventory.quantumMatter;
      }
      
      qmDisplay.textContent = Math.round(sim.qm);
      hudFleetCount.textContent = "N/A";
      hudCamCoords.textContent = "ORBITAL";
      hudThreatLevel.textContent = "HARMONIC";
      hudThreatLevel.className = "hud-val text-cyan";
      
      const hudFlagshipCoords = document.getElementById('hud-flagship-coords');
      if (hudFlagshipCoords) {
        hudFlagshipCoords.textContent = "HARMONIZED";
      }
      
      if (currentSolarSystem.selectedPlanetIndex !== -1) {
        const planet = currentSolarSystem.planets[currentSolarSystem.selectedPlanetIndex];
        if (planet) {
          updatePlanetTunerDisplay(planet);
          updateActiveProbesList(planet);
        }
      }
      
      updateRealtimeClock();
    }
  }
}

// Spacetime transition state object
window.tearTransitionState = {
  active: false,
  progress: 0,
  themeId: 'aquarius',
  isSmallGrind: false
};

window.startSpacetimeTransition = function(themeId, isSmallGrind) {
  window.tearTransitionState.active = true;
  window.tearTransitionState.progress = 0;
  window.tearTransitionState.themeId = themeId;
  window.tearTransitionState.isSmallGrind = isSmallGrind;
  appendLog(`🌌 TRANSITION: Flagship entering spacetime rift! Spacetime warping started...`);
};

// Canvas drawing animation helper for the spacetime tear transition
function drawTearTransition(ctx, progress) {
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  // Render a dramatic portal vortex effect over the whole viewport
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  // Draw expansion circle
  const maxRadius = Math.sqrt(w*w + h*h) * 0.8;
  const currentRadius = maxRadius * progress;

  // Radiant glitch particles
  const numRays = 24;
  for (let i = 0; i < numRays; i++) {
    const angle = (i / numRays) * Math.PI * 2 + progress * 8;
    const len = currentRadius * (0.8 + Math.random() * 0.4);
    const tx = cx + Math.cos(angle) * len;
    const ty = cy + Math.sin(angle) * len;

    // Glitchy lines spreading outwards
    ctx.strokeStyle = `hsla(${(progress * 360 + i * 15) % 360}, 100%, 70%, ${1 - progress})`;
    ctx.lineWidth = 1 + Math.random() * 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  }

  // Draw central space-tear ripple
  const grad = ctx.createRadialGradient(cx, cy, currentRadius * 0.1, cx, cy, currentRadius);
  grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
  grad.addColorStop(0.3, 'rgba(255, 51, 255, 0.8)');
  grad.addColorStop(0.6, 'rgba(0, 229, 255, 0.5)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, currentRadius, 0, Math.PI * 2);
  ctx.fill();

  // Add retro glitch block overlays as progress gets closer to 100%
  if (progress > 0.5) {
    const glitchIntensity = (progress - 0.5) * 2; // scales from 0 to 1
    const numBlocks = Math.floor(glitchIntensity * 12);
    for (let b = 0; b < numBlocks; b++) {
      const bx = Math.random() * w;
      const by = Math.random() * h;
      const bw = (50 + Math.random() * 150) * glitchIntensity;
      const bh = (10 + Math.random() * 40) * glitchIntensity;
      
      ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '255, 0, 102' : '0, 255, 204'}, ${glitchIntensity * 0.35})`;
      ctx.fillRect(bx, by, bw, bh);
    }
  }

  ctx.restore();

  // Full black-out transition ending
  if (progress > 0.8) {
    const blackAlpha = (progress - 0.8) / 0.2; // 0 to 1
    ctx.fillStyle = `rgba(0, 0, 0, ${blackAlpha})`;
    ctx.fillRect(0, 0, w, h);
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
