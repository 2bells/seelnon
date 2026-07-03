import { Simulation } from './simulation.js';
import { WebGPURenderer } from './webgpu.js';
import { MEDIUMS, computeEngineMetrics } from './math.js';

// DOM Elements Selection
const canvas = document.getElementById('sim-canvas');
const gpuStatus = document.getElementById('gpu-status');
const activeEngineLabel = document.getElementById('active-engine');
const vibrationalState = document.getElementById('vibrational-state');
const clockDisplay = document.getElementById('clock-display');

// Control Inputs
const mediumSelect = document.getElementById('medium-select');
const inputFrequency = document.getElementById('input-frequency');
const rangeFrequency = document.getElementById('range-frequency');
const frequencyUnit = document.getElementById('frequency-unit');
const inputDerivedMass = document.getElementById('input-derived-mass');
const inputClumpThreshold = document.getElementById('input-clump-threshold');
const derivedMassUnit = document.getElementById('derived-mass-unit');

// Dynamically toggling and tracking particles density
const rangeParticles = document.getElementById('range-particles');
const particleCountDisplay = document.getElementById('particle-count-display');
const rangeGravity = document.getElementById('range-gravity');
const rangeDrag = document.getElementById('range-drag');
const rangeSimSpeed = document.getElementById('range-sim-speed');
const simSpeedDisplay = document.getElementById('sim-speed-display');
const distributionSelect = document.getElementById('distribution-select');
const gravityValDisplay = document.getElementById('gravity-val-display');
const derivedMpDisplay = document.getElementById('derived-mp-display');
const dragValDisplay = document.getElementById('drag-val-display');

// New dynamic controls
const rangeDarkEnergy = document.getElementById('range-dark-energy');
const darkEnergyValDisplay = document.getElementById('dark-energy-val-display');
const rangeOrbitalBoost = document.getElementById('range-orbital-boost');
const orbitalBoostValDisplay = document.getElementById('orbital-boost-val-display');
const rangeGravityRange = document.getElementById('range-gravity-range');
const gravityRangeValDisplay = document.getElementById('gravity-range-val-display');
const rangeSpinVelocity = document.getElementById('range-spin-velocity');
const spinVelocityValDisplay = document.getElementById('spin-velocity-val-display');

// Action buttons
const btnPause = document.getElementById('btn-pause');
const btnExplode = document.getElementById('btn-explode');
const btnSupernova = document.getElementById('btn-supernova');
const btnReset = document.getElementById('btn-reset');

// Mode Tabs
const tabPhysics = document.getElementById('tab-physics');
const tabGrid = document.getElementById('tab-grid');
const tabVector = document.getElementById('tab-vector');

// Canvas HUD
const hudFreq = document.getElementById('hud-val-freq');
const hudEnergy = document.getElementById('hud-val-energy');
const hudDim = document.getElementById('hud-val-dim');
const hudClumpThreshold = document.getElementById('hud-val-clump-threshold');
const hudSpacetimeState = document.getElementById('hud-val-spacetime-state');

// Right notes and dynamic proofs
const formulaLeft = document.getElementById('formula-left');
const formulaRight = document.getElementById('formula-right');
const solvedEqRaw = document.getElementById('solved-eq-raw');
const dimLogContent = document.getElementById('dim-log-content');
const explanationText = document.getElementById('explanation-text');
const eventLogList = document.getElementById('event-log-list');

// Interactive Toggles
const toggleCollisions = document.getElementById('toggle-collisions');
const toggleWaveforms = document.getElementById('toggle-waveforms');
const toggleNonDestructible = document.getElementById('toggle-non-destructible');

// Core App Instances
let sim = null;
let gpuRenderer = null;
let isWebGPUActive = false;

// Event Log Stream Helper
function appendLog(message) {
  if (!eventLogList) return;
  const line = document.createElement('div');
  line.textContent = `> ${message}`;
  eventLogList.appendChild(line);
  eventLogList.scrollTop = eventLogList.scrollHeight;
}


function formatSci(val) {
  if (val > 1000000) {
    return (val / 1000000).toFixed(2) + 'M';
  }
  if (val > 1000) {
    return (val / 1000).toFixed(2) + 'k';
  }
  if (val < 0.001) {
    return val.toFixed(4);
  }
  return val.toFixed(3);
}

// Update the dynamic sidebar properties
function updateMathExplanation() {
  const activeMedium = MEDIUMS[sim.mediumId];
  
  // 1. Update text tags if they exist
  if (formulaLeft) formulaLeft.textContent = activeMedium.leftFormula;
  if (formulaRight) formulaRight.textContent = activeMedium.rightFormula;
  if (solvedEqRaw) solvedEqRaw.textContent = activeMedium.solvedFormula;
  if (explanationText) explanationText.textContent = activeMedium.description;

  // 2. Set unit labels dynamically if they exist
  if (derivedMassUnit) derivedMassUnit.textContent = activeMedium.massUnit;
  if (frequencyUnit) frequencyUnit.textContent = activeMedium.freqUnit;

  // 3. Clear and populate characteristics log
  if (dimLogContent) {
    dimLogContent.innerHTML = '';
    activeMedium.dimensionalCheck.forEach(item => {
      const line = document.createElement('div');
      line.className = 'log-line';
      
      const label = document.createElement('span');
      label.textContent = item.step;
      
      const val = document.createElement('span');
      val.className = 'log-unit-val';
      val.textContent = item.value;
      
      // Colorize state
      if (item.step.includes('Snap') || item.step.includes('Active') || item.step.includes('Extreme') || item.step.includes('Enabled')) {
        val.className = 'log-unit-solved';
      }

      line.appendChild(label);
      line.appendChild(val);
      dimLogContent.appendChild(line);
    });
  }
}

// Calculate and update HUD panel metrics
function updateHUD() {
  const { nodeDensity, kineticPower, clumpThreshold } = computeEngineMetrics(sim.mediumId, sim.frequency, sim.c, sim.h, sim.gravity);
  const activeMedium = MEDIUMS[sim.mediumId];

  // Set HUD text
  if (hudFreq) hudFreq.textContent = `${formatSci(sim.frequency)} ${activeMedium.freqUnit}`;
  if (hudEnergy) hudEnergy.textContent = `${formatSci(kineticPower)} ${activeMedium.energyUnit}`;
  if (hudDim) hudDim.textContent = activeMedium.id === 'B' ? 'SPINNING' : 'WAVING';
  if (hudClumpThreshold) hudClumpThreshold.textContent = `${formatSci(clumpThreshold)}`;

  const collapsedCount = sim.collapsedObjects ? sim.collapsedObjects.length : 0;
  if (hudSpacetimeState) {
    if (collapsedCount > 0) {
      hudSpacetimeState.textContent = `CRITICAL_CLUMP (${collapsedCount} MAGNETS)`;
      hudSpacetimeState.className = 'hud-val text-red font-bold';
    } else {
      hudSpacetimeState.textContent = 'SMOOTH_FLOW';
      hudSpacetimeState.className = 'hud-val text-cyan font-bold';
    }
  }

  // Set Derived Mass Display
  if (inputDerivedMass) inputDerivedMass.value = formatSci(nodeDensity);
  if (inputClumpThreshold) inputClumpThreshold.value = formatSci(clumpThreshold);

  // Toggle state alerts
  if (vibrationalState) {
    if (collapsedCount > 0) {
      vibrationalState.textContent = 'CRITICAL';
      vibrationalState.className = 'indicator-value text-red';
    } else {
      vibrationalState.textContent = 'STABLE';
      vibrationalState.className = 'indicator-value text-green';
    }
  }
}

// Sync slider handles and raw numerical input decks
function bindSliderWithInput(slider, input, callback) {
  slider.addEventListener('input', (e) => {
    input.value = e.target.value;
    callback(parseFloat(e.target.value));
  });
  input.addEventListener('change', (e) => {
    const val = parseFloat(e.target.value);
    if (isNaN(val)) {
      input.value = slider.value;
      return;
    }
    // Visually clamp the slider handle, but preserve the typed value in the input and callback
    const sliderClamped = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), val));
    slider.value = sliderClamped;
    callback(val);
  });
}

function findClosestIndex(array, targetValue) {
  let closestIdx = 0;
  let minDiff = Math.abs(array[0] - targetValue);
  for (let i = 1; i < array.length; i++) {
    const diff = Math.abs(array[i] - targetValue);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = i;
    }
  }
  return closestIdx;
}

// Initial main loading pipeline
async function main() {
  appendLog("INITIALIZING_SANDBOX...");

  // Progressive step arrays for movement vector, gravity influence, and spin velocity
  const orbitalBoostValues = [];
  {
    const low = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30];
    orbitalBoostValues.push(...low);
    for (let i = 35; i <= 400; i += 5) {
      orbitalBoostValues.push(i);
    }
  }

  const gravityRangeValues = [];
  {
    const low = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30];
    gravityRangeValues.push(...low);
    for (let i = 35; i <= 800; i += 5) {
      gravityRangeValues.push(i);
    }
  }

  const spinVelocityValues = [];
  {
    const positiveMagnitudes = [
      0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 1.2, 1.5, 2.0, 2.5, 3.0,
      3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0
    ];
    const negatives = [...positiveMagnitudes].reverse().map(v => -v);
    spinVelocityValues.push(...negatives, 0, ...positiveMagnitudes);
  }

  // 1. Initialize simulation engine - set canvas dimensions first so particles are populated correctly on load
  const parent = canvas.parentElement;
  canvas.width = parent.clientWidth;
  canvas.height = parent.clientHeight;

  sim = new Simulation(canvas);

  // Synchronize simulation options with initial values from HTML inputs on load
  if (mediumSelect) sim.mediumId = mediumSelect.value;
  if (rangeFrequency) sim.frequency = parseFloat(rangeFrequency.value);
  if (rangeParticles) sim.particleDensity = parseInt(rangeParticles.value);
  if (rangeGravity) {
    sim.gravity = parseFloat(rangeGravity.value) * 1e-11;
    sim.updateClumpThreshold();
  }
  if (rangeDrag) sim.drag = parseFloat(rangeDrag.value);
  if (rangeSimSpeed) sim.simSpeed = parseFloat(rangeSimSpeed.value);
  if (rangeDarkEnergy) sim.darkEnergy = parseFloat(rangeDarkEnergy.value);

  // Configure progressive sliders
  if (rangeOrbitalBoost) {
    const initialRawVal = parseFloat(rangeOrbitalBoost.value) || 105.0;
    rangeOrbitalBoost.min = "0";
    rangeOrbitalBoost.max = (orbitalBoostValues.length - 1).toString();
    rangeOrbitalBoost.step = "1";
    rangeOrbitalBoost.value = findClosestIndex(orbitalBoostValues, initialRawVal).toString();
    sim.orbitalBoost = orbitalBoostValues[parseInt(rangeOrbitalBoost.value)];
  }
  if (rangeGravityRange) {
    const initialRawVal = parseFloat(rangeGravityRange.value) || 70.0;
    rangeGravityRange.min = "0";
    rangeGravityRange.max = (gravityRangeValues.length - 1).toString();
    rangeGravityRange.step = "1";
    rangeGravityRange.value = findClosestIndex(gravityRangeValues, initialRawVal).toString();
    sim.gravityRange = gravityRangeValues[parseInt(rangeGravityRange.value)];
  }
  if (rangeSpinVelocity) {
    const initialRawVal = parseFloat(rangeSpinVelocity.value) || 2.5;
    rangeSpinVelocity.min = "0";
    rangeSpinVelocity.max = (spinVelocityValues.length - 1).toString();
    rangeSpinVelocity.step = "1";
    rangeSpinVelocity.value = findClosestIndex(spinVelocityValues, initialRawVal).toString();
    sim.initialAngularVelocity = spinVelocityValues[parseInt(rangeSpinVelocity.value)];
  }

  if (distributionSelect) sim.populationStyle = distributionSelect.value;
  if (toggleCollisions) sim.intraCollisions = toggleCollisions.checked;
  if (toggleWaveforms) sim.waveTrails = toggleWaveforms.checked;
  if (toggleNonDestructible) sim.nonDestructibleCores = toggleNonDestructible.checked;

  // Re-run simulation initialization with the synchronized values
  sim.init();
  
  // Set dimensions based on client wrapper size
  const handleResize = () => {
    sim.resize(parent.clientWidth, parent.clientHeight);
    if (gpuRenderer && isWebGPUActive) {
      gpuRenderer.syncParticlesToGPU(sim.particles);
    }
  };
  window.addEventListener('resize', handleResize);

  // Initialize display labels for dynamics
  if (particleCountDisplay) particleCountDisplay.value = sim.particleDensity;
  if (simSpeedDisplay) simSpeedDisplay.value = sim.simSpeed.toFixed(1) + 'x';
  gravityValDisplay.value = (sim.gravity * 1e11).toFixed(2);
  dragValDisplay.value = sim.drag.toFixed(3);
  if (darkEnergyValDisplay) darkEnergyValDisplay.value = sim.darkEnergy.toFixed(1);
  if (orbitalBoostValDisplay) orbitalBoostValDisplay.value = sim.orbitalBoost.toFixed(1) + 'x';
  if (gravityRangeValDisplay) gravityRangeValDisplay.value = sim.gravityRange.toFixed(0) + 'px';
  if (spinVelocityValDisplay) spinVelocityValDisplay.value = sim.initialAngularVelocity.toFixed(1) + ' rad/s';

  // 2. Initialize WebGPU
  gpuStatus.textContent = "CHECKING_WEBGPU...";
  gpuStatus.className = "indicator-value status-checking";

  try {
    gpuRenderer = new WebGPURenderer(canvas);
    await gpuRenderer.init();
    
    // Sync starting particles directly to GPU VRAM
    gpuRenderer.syncParticlesToGPU(sim.particles);
    
    // Success: activate WebGPU
    isWebGPUActive = true;
    gpuStatus.textContent = "WEBGPU_ACTIVE [OK]";
    gpuStatus.className = "indicator-value status-active";
    activeEngineLabel.textContent = "WEBGPU_HARDWARE";
    activeEngineLabel.className = "font-mono text-green";
    appendLog("ACCELERATED_PIPELINE_LOADED");
  } catch (err) {
    console.warn("WebGPU initialization failed:", err);
    // Fallback: Use standard 2D canvas simulation
    isWebGPUActive = false;
    gpuStatus.textContent = "WEBGPU_UNAVAILABLE [FALLBACK]";
    gpuStatus.className = "indicator-value status-fallback";
    activeEngineLabel.textContent = "CANVAS_2D_ENGINE";
    activeEngineLabel.className = "font-mono text-cyan";
    appendLog(`STANDARD_PIPELINE_LOADED`);
  }

  // 3. Connect Control Sliders
  bindSliderWithInput(rangeFrequency, inputFrequency, (val) => {
    sim.frequency = val;
    updateHUD();
  });

  // Dynamics controls
  rangeParticles.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    particleCountDisplay.value = val;
    sim.particleDensity = val;
    sim.setupParticles();
    if (isWebGPUActive && gpuRenderer) {
      gpuRenderer.syncParticlesToGPU(sim.particles);
    }
    appendLog(`PARTICLE_COUNT_SET: ${val}`);
  });

  const updateParticlesFromInput = () => {
    let val = parseInt(particleCountDisplay.value);
    if (isNaN(val) || val <= 0) {
      particleCountDisplay.value = sim.particleDensity;
      return;
    }
    sim.particleDensity = val;
    rangeParticles.value = val;
    sim.setupParticles();
    if (isWebGPUActive && gpuRenderer) {
      gpuRenderer.syncParticlesToGPU(sim.particles);
    }
    appendLog(`PARTICLE_COUNT_SET: ${val}`);
  };
  particleCountDisplay.addEventListener('change', updateParticlesFromInput);
  particleCountDisplay.addEventListener('keydown', (e) => { if (e.key === 'Enter') { updateParticlesFromInput(); particleCountDisplay.blur(); } });

  rangeGravity.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    sim.gravity = val * 1e-11;
    sim.updateClumpThreshold();
    gravityValDisplay.value = val.toFixed(2);
    updateHUD();
  });

  const updateGravityFromInput = () => {
    let val = parseFloat(gravityValDisplay.value);
    if (isNaN(val)) {
      gravityValDisplay.value = (sim.gravity * 1e11).toFixed(2);
      return;
    }
    sim.gravity = val * 1e-11;
    sim.updateClumpThreshold();
    rangeGravity.value = val;
    gravityValDisplay.value = val.toFixed(2);
    updateHUD();
  };
  gravityValDisplay.addEventListener('change', updateGravityFromInput);
  gravityValDisplay.addEventListener('keydown', (e) => { if (e.key === 'Enter') { updateGravityFromInput(); gravityValDisplay.blur(); } });

  rangeDrag.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    sim.drag = val;
    dragValDisplay.value = val.toFixed(3);
  });

  const updateDragFromInput = () => {
    let val = parseFloat(dragValDisplay.value);
    if (isNaN(val)) {
      dragValDisplay.value = sim.drag.toFixed(3);
      return;
    }
    sim.drag = val;
    rangeDrag.value = val;
    dragValDisplay.value = val.toFixed(3);
  };
  dragValDisplay.addEventListener('change', updateDragFromInput);
  dragValDisplay.addEventListener('keydown', (e) => { if (e.key === 'Enter') { updateDragFromInput(); dragValDisplay.blur(); } });

  rangeSimSpeed.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    sim.simSpeed = val;
    simSpeedDisplay.value = val.toFixed(1) + 'x';
    appendLog(`SIM_SPEED_SET: ${val.toFixed(1)}x`);
  });

  const updateSimSpeedFromInput = () => {
    let val = parseFloat(simSpeedDisplay.value);
    if (isNaN(val)) {
      simSpeedDisplay.value = sim.simSpeed.toFixed(1) + 'x';
      return;
    }
    sim.simSpeed = val;
    rangeSimSpeed.value = val;
    simSpeedDisplay.value = val.toFixed(1) + 'x';
    appendLog(`SIM_SPEED_SET: ${val.toFixed(1)}x`);
  };
  simSpeedDisplay.addEventListener('change', updateSimSpeedFromInput);
  simSpeedDisplay.addEventListener('keydown', (e) => { if (e.key === 'Enter') { updateSimSpeedFromInput(); simSpeedDisplay.blur(); } });

  rangeDarkEnergy.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    sim.darkEnergy = val;
    darkEnergyValDisplay.value = val.toFixed(1);
    appendLog(`REPEL_FORCE_SET: ${val.toFixed(1)}`);
  });

  const updateDarkEnergyFromInput = () => {
    let val = parseFloat(darkEnergyValDisplay.value);
    if (isNaN(val)) {
      darkEnergyValDisplay.value = sim.darkEnergy.toFixed(1);
      return;
    }
    sim.darkEnergy = val;
    rangeDarkEnergy.value = val;
    darkEnergyValDisplay.value = val.toFixed(1);
    appendLog(`REPEL_FORCE_SET: ${val.toFixed(1)}`);
  };
  darkEnergyValDisplay.addEventListener('change', updateDarkEnergyFromInput);
  darkEnergyValDisplay.addEventListener('keydown', (e) => { if (e.key === 'Enter') { updateDarkEnergyFromInput(); darkEnergyValDisplay.blur(); } });

  rangeOrbitalBoost.addEventListener('input', (e) => {
    const index = parseInt(e.target.value);
    const val = orbitalBoostValues[index];
    sim.orbitalBoost = val;
    orbitalBoostValDisplay.value = val.toFixed(1) + 'x';
    appendLog(`ORBITAL_VELOCITY_SET: ${val.toFixed(1)}x`);
  });

  const updateOrbitalBoostFromInput = () => {
    let val = parseFloat(orbitalBoostValDisplay.value);
    if (isNaN(val)) {
      orbitalBoostValDisplay.value = sim.orbitalBoost.toFixed(1) + 'x';
      return;
    }
    sim.orbitalBoost = val;
    rangeOrbitalBoost.value = findClosestIndex(orbitalBoostValues, val);
    orbitalBoostValDisplay.value = val.toFixed(1) + 'x';
    appendLog(`ORBITAL_VELOCITY_SET: ${val.toFixed(1)}x`);
  };
  orbitalBoostValDisplay.addEventListener('change', updateOrbitalBoostFromInput);
  orbitalBoostValDisplay.addEventListener('keydown', (e) => { if (e.key === 'Enter') { updateOrbitalBoostFromInput(); orbitalBoostValDisplay.blur(); } });

  rangeGravityRange.addEventListener('input', (e) => {
    const index = parseInt(e.target.value);
    const val = gravityRangeValues[index];
    sim.gravityRange = val;
    gravityRangeValDisplay.value = val.toFixed(0) + 'px';
    appendLog(`GRAVITY_RANGE_SET: ${val.toFixed(0)}px`);
  });

  const updateGravityRangeFromInput = () => {
    let val = parseFloat(gravityRangeValDisplay.value);
    if (isNaN(val)) {
      gravityRangeValDisplay.value = sim.gravityRange.toFixed(0) + 'px';
      return;
    }
    sim.gravityRange = val;
    rangeGravityRange.value = findClosestIndex(gravityRangeValues, val);
    gravityRangeValDisplay.value = val.toFixed(0) + 'px';
    appendLog(`GRAVITY_RANGE_SET: ${val.toFixed(0)}px`);
  };
  gravityRangeValDisplay.addEventListener('change', updateGravityRangeFromInput);
  gravityRangeValDisplay.addEventListener('keydown', (e) => { if (e.key === 'Enter') { updateGravityRangeFromInput(); gravityRangeValDisplay.blur(); } });

  rangeSpinVelocity.addEventListener('input', (e) => {
    const index = parseInt(e.target.value);
    const val = spinVelocityValues[index];
    sim.initialAngularVelocity = val;
    spinVelocityValDisplay.value = val.toFixed(1) + ' rad/s';
    appendLog(`INITIAL_SPIN_SET: ${val.toFixed(1)} rad/s`);
  });

  const updateSpinVelocityFromInput = () => {
    let val = parseFloat(spinVelocityValDisplay.value);
    if (isNaN(val)) {
      spinVelocityValDisplay.value = sim.initialAngularVelocity.toFixed(1) + ' rad/s';
      return;
    }
    sim.initialAngularVelocity = val;
    rangeSpinVelocity.value = findClosestIndex(spinVelocityValues, val);
    spinVelocityValDisplay.value = val.toFixed(1) + ' rad/s';
    appendLog(`INITIAL_SPIN_SET: ${val.toFixed(1)} rad/s`);
  };
  spinVelocityValDisplay.addEventListener('change', updateSpinVelocityFromInput);
  spinVelocityValDisplay.addEventListener('keydown', (e) => { if (e.key === 'Enter') { updateSpinVelocityFromInput(); spinVelocityValDisplay.blur(); } });

  // Population Style selector logic
  distributionSelect.addEventListener('change', (e) => {
    const style = e.target.value;
    sim.populationStyle = style;
    sim.init(); // Reseed particles
    if (isWebGPUActive && gpuRenderer) {
      gpuRenderer.syncParticlesToGPU(sim.particles);
    }
    appendLog(`POPULATION_STYLE_SET: ${style.toUpperCase()}`);
  });

  // Medium selector logic
  mediumSelect.addEventListener('change', (e) => {
    const opt = e.target.value;
    sim.mediumId = opt;
    sim.init(); // Reset positions per medium distribution rules
    
    if (isWebGPUActive && gpuRenderer) {
      gpuRenderer.syncParticlesToGPU(sim.particles);
    }
 
    updateMathExplanation();
    updateHUD();
    appendLog(`PRESET_GEOMETRY_SET: ${MEDIUMS[opt].name}`);
  });

  // Action Buttons
  btnPause.addEventListener('click', () => {
    sim.isPaused = !sim.isPaused;
    btnPause.textContent = sim.isPaused ? 'RESUME' : 'PAUSE';
    btnPause.classList.toggle('btn-alert', sim.isPaused);
    appendLog(`PAUSED: ${sim.isPaused}`);
  });

  btnExplode.addEventListener('click', () => {
    sim.explode();
    // For WebGPU, sync exploded velocities
    if (isWebGPUActive && gpuRenderer) {
      gpuRenderer.syncParticlesToGPU(sim.particles);
    }
    appendLog("PARTICLE_EXPLOSION_TRIGGERED");
  });

  btnSupernova.addEventListener('click', () => {
    // If paused, automatically resume flow so simulation is running for the supernova
    if (sim.isPaused) {
      sim.isPaused = false;
      btnPause.textContent = 'PAUSE';
      btnPause.classList.remove('btn-alert');
      appendLog(`RESUMED_FOR_SUPERNOVA`);
    }
    sim.triggerSupernova();
    if (isWebGPUActive && gpuRenderer) {
      gpuRenderer.syncParticlesToGPU(sim.particles);
    }
  });

  btnReset.addEventListener('click', () => {
    sim.init();
    if (isWebGPUActive && gpuRenderer) {
      gpuRenderer.syncParticlesToGPU(sim.particles);
    }
    appendLog("PARTICLE_RESEED_COMPLETED");
  });

  // Viewport Tabs Toggling
  const updateTabs = (activeTab, mode) => {
    tabPhysics.classList.remove('active');
    tabGrid.classList.remove('active');
    tabVector.classList.remove('active');
    
    activeTab.classList.add('active');
    sim.renderMode = mode;
    appendLog(`VIEWPORT_FILTER_UPDATE: ${mode.toUpperCase()}_VIEW`);
  };

  tabPhysics.addEventListener('click', () => updateTabs(tabPhysics, 'physics'));
  tabGrid.addEventListener('click', () => updateTabs(tabGrid, 'grid'));
  tabVector.addEventListener('click', () => updateTabs(tabVector, 'vector'));

  // Toggles
  toggleCollisions.addEventListener('change', (e) => {
    sim.intraCollisions = e.target.checked;
    appendLog(`PARTICLE_INTER_COLLISION_STATE: ${sim.intraCollisions}`);
  });

  toggleWaveforms.addEventListener('change', (e) => {
    sim.waveTrails = e.target.checked;
    appendLog(`FLOW_TRAILS_STATE: ${sim.waveTrails}`);
  });

  toggleNonDestructible.addEventListener('change', (e) => {
    sim.nonDestructibleCores = e.target.checked;
    appendLog(`NON_DESTRUCTIBLE_CORES_STATE: ${sim.nonDestructibleCores}`);
  });

  // Interactive mouse click attractor setup
  const getCanvasMousePos = (e) => {
    const rect = canvas.getBoundingClientRect();
    // Scale appropriately based on high-DPI canvas
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const handlePointerStart = (e) => {
    const pos = getCanvasMousePos(e);
    sim.attractor.x = pos.x;
    sim.attractor.y = pos.y;
    sim.attractor.active = true;
    appendLog(`ATTRACTOR_CORE_DETECTED: x:${Math.round(pos.x)}, y:${Math.round(pos.y)}`);
  };

  const handlePointerMove = (e) => {
    if (sim.attractor.active) {
      const pos = getCanvasMousePos(e);
      sim.attractor.x = pos.x;
      sim.attractor.y = pos.y;
    }
  };

  const handlePointerEnd = () => {
    if (sim.attractor.active) {
      sim.attractor.active = false;
      appendLog("ATTRACTOR_CORE_REMOVED");
    }
  };

  canvas.addEventListener('mousedown', handlePointerStart);
  canvas.addEventListener('mousemove', handlePointerMove);
  window.addEventListener('mouseup', handlePointerEnd);

  // Touch triggers
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
      handlePointerStart(e.touches[0]);
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      handlePointerMove(e.touches[0]);
    }
  }, { passive: true });
  canvas.addEventListener('touchend', handlePointerEnd);

  // Populate dynamic views on startup
  updateMathExplanation();
  updateHUD();

  // 4. Main Animation Frame Loop
  function tick() {
    // Perform numeric integration
    sim.tick();

    if (isWebGPUActive && gpuRenderer) {
      // Hardware accelerated WebGPU pipeline draw
      gpuRenderer.drawFrame(sim);
    } else {
      // Legacy CPU tick & Canvas 2D fallback draw
      sim.render();
    }

    // Dynamic metrics updates
    updateHUD();

    requestAnimationFrame(tick);
  }

  // Run UTC footer clock
  setInterval(() => {
    const now = new Date();
    clockDisplay.textContent = now.toTimeString().split(' ')[0];
  }, 1000);

  // Trigger main ticking loop
  requestAnimationFrame(tick);
  appendLog("SYSTEM_STABILIZED");
}

window.addEventListener('DOMContentLoaded', main);
