import { computeEngineMetrics } from './math.js';

export class Simulation {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Play settings
    this.mediumId = 'A'; // Current line mode
    this.frequency = 1.0; // Wind speed
    this.c = 3.0; // Max speed of dots
    this.h = 6.62607015; // Dot scale
    this.mass = 2.454; // Weight of dots
    this.particleDensity = 3000; // Total dot count
    this.gravity = 6.6743e-11; // Pull strength
    this.clumpThreshold = 545551; // Clump threshold (how many dots make a magnet)
    this.simulationScale = 545551; // Clump scale helper
    this.drag = 0.1; // Slowdown rate (friction)
    this.simSpeed = 1.0; // Game play speed
    this.darkEnergy = 0.0; // Push away strength
    this.orbitalBoost = 1.0; // Swirl speed
    this.gravityRange = 450.0; // Pull reach range
    this.initialAngularVelocity = 2.5; // Starting spin for newly clumped magnets
    this.centerBias = 1.0; // Gentle background pull to center (0.0 to disable)
    this.populationStyle = 'grid'; // How dots start
    this.individualPull = false; // Scale range based on mass of gravity source
    this.intraCollisions = true; // Do dots bump into each other?
    this.waveTrails = true; // Draw tails?
    this.nonDestructibleCores = true; // Magnets don't break when bumping
    this.renderMode = 'grid'; // What to draw ('physics' = dots, 'grid' = wobbly grid, 'vector' = flow arrows)
    this.sectorSize = 120; // Block size for tracking clumps
    this.sectors = []; // Blocks to check for magnets
    
    this.updateClumpThreshold();
    
    // Mouse magnet
    this.attractor = { x: 0, y: 0, active: false, radius: 100, strength: 5.0 };
    
    // State lists
    this.particles = [];
    this.collapsedObjects = []; // Active magnets (clumps)
    this.gridNodes = [];
    this.gridCols = 0;
    this.gridRows = 0;
    this.vortices = []; // Swirl centers for Option B
    this.time = 0;
    this.isPaused = false;
    
    // Screen size tracking
    this.width = canvas.width;
    this.height = canvas.height;
    
    this.init();
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    
    // Re-setup coordinate grid nodes on resize
    this.setupGrid();
  }

  updateClumpThreshold() {
    this.clumpThreshold = Math.sqrt((this.h * this.c) / Math.max(1e-18, this.gravity));
    this.simulationScale = this.clumpThreshold;
  }

  updateCollapsedObjects() {
    if (!this.collapsedObjects) {
      this.collapsedObjects = [];
      return;
    }

    // 1. Clean inactive ones and activeList setup
    this.collapsedObjects = this.collapsedObjects.filter(obj => obj.active);
    const n = this.collapsedObjects.length;
    if (n === 0) return;

    const forces = Array(n).fill(null).map(() => ({ fx: 0, fy: 0 }));

    for (let i = 0; i < n; i++) {
      const o1 = this.collapsedObjects[i];
      if (!o1.active) continue;
      
      for (let j = i + 1; j < n; j++) {
        const o2 = this.collapsedObjects[j];
        if (!o2.active) continue;
        
        const dx = o2.x - o1.x;
        const dy = o2.y - o1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        
        // Merge condition: if they overlap
        const minMergeDist = o1.radius + o2.radius;
        if (dist < minMergeDist * 0.7) {
          if (this.nonDestructibleCores) {
            // Bounce instead of merge!
            // Collision normal
            const nx = dx / dist;
            const ny = dy / dist;

            // Relative velocity
            const rvx = o2.vx - o1.vx;
            const rvy = o2.vy - o1.vy;

            // Relative velocity along normal
            const velAlongNormal = rvx * nx + rvy * ny;

            // Only resolve if velocities are moving towards each other
            if (velAlongNormal < 0) {
              // Restitution (elasticity)
              const restitution = 0.7;
              
              // Mass-weighted impulse
              const impulseScalar = -(1 + restitution) * velAlongNormal / (1 / o1.mass + 1 / o2.mass);
              
              // Apply impulse to velocities
              o1.vx -= (impulseScalar / o1.mass) * nx;
              o1.vy -= (impulseScalar / o1.mass) * ny;
              o2.vx += (impulseScalar / o2.mass) * nx;
              o2.vy += (impulseScalar / o2.mass) * ny;
              
              // Lose particles! Fling nearby orbiting particles outward
              const midX = (o1.x + o2.x) * 0.5;
              const midY = (o1.y + o2.y) * 0.5;
              const flingRadius = minMergeDist * 1.5;
              
              this.particles.forEach(p => {
                const pdx = p.x - midX;
                const pdy = p.y - midY;
                const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
                if (pdist < flingRadius) {
                  const pAngle = Math.atan2(pdy, pdx) + (Math.random() - 0.5) * 1.0;
                  const pSpeed = 3.5 + Math.random() * 4.0;
                  p.vx = Math.cos(pAngle) * pSpeed;
                  p.vy = Math.sin(pAngle) * pSpeed;
                  p.history = [];
                }
              });
              
              // Slightly decrease their mass and particle count as they "shed" mass on bounce
              const massLoss1 = o1.mass * 0.08;
              const massLoss2 = o2.mass * 0.08;
              o1.mass = Math.max(1.0, o1.mass - massLoss1);
              o2.mass = Math.max(1.0, o2.mass - massLoss2);
              o1.pCount = Math.max(1, Math.floor(o1.pCount * 0.92));
              o2.pCount = Math.max(1, Math.floor(o2.pCount * 0.92));
              
              // Recalculate radius based on new mass
              o1.radius = Math.max(12, Math.min(60, 8 + Math.sqrt(o1.mass) * 1.5));
              o2.radius = Math.max(12, Math.min(60, 8 + Math.sqrt(o2.mass) * 1.5));
            }

            // Push them apart to prevent sticking
            const overlap = minMergeDist * 0.7 - dist;
            if (overlap > 0) {
              const totalM = o1.mass + o2.mass;
              const mRatio1 = o2.mass / totalM;
              const mRatio2 = o1.mass / totalM;
              o1.x -= nx * overlap * mRatio1;
              o1.y -= ny * overlap * mRatio1;
              o2.x += nx * overlap * mRatio2;
              o2.y += ny * overlap * mRatio2;
            }
            continue;
          }

          const m1 = o1.mass;
          const m2 = o2.mass;
          const totalMass = m1 + m2;
          
          const comX = (m1 * o1.x + m2 * o2.x) / totalMass;
          const comY = (m1 * o1.y + m2 * o2.y) / totalMass;
          
          const vxNew = (m1 * o1.vx + m2 * o2.vx) / totalMass;
          const vyNew = (m1 * o1.vy + m2 * o2.vy) / totalMass;

          // Angular momentum transfer: orbital angular momentum L_orbit = sum(m_i * r_i x v_rel_i)
          const r1x = o1.x - comX;
          const r1y = o1.y - comY;
          const r2x = o2.x - comX;
          const r2y = o2.y - comY;
          
          const v1xRel = o1.vx - vxNew;
          const v1yRel = o1.vy - vyNew;
          const v2xRel = o2.vx - vxNew;
          const v2yRel = o2.vy - vyNew;
          
          const L_orbit = m1 * (r1x * v1yRel - r1y * v1xRel) + m2 * (r2x * v2yRel - r2y * v2xRel);
          
          // Spin angular momentum S = I * omega = 0.4 * mass * radius^2 * omega
          const S1 = 0.4 * m1 * (o1.radius * o1.radius) * (o1.angularVelocity || 0.0);
          const S2 = 0.4 * m2 * (o2.radius * o2.radius) * (o2.angularVelocity || 0.0);
          
          // Disable orbital transfer spin-up if initial angular velocity is 0
          const spinUpFactor = this.initialAngularVelocity === 0.0 ? 0.0 : 0.01;
          const S_new = S1 + S2 + L_orbit * spinUpFactor; 
          
          o1.vx = vxNew;
          o1.vy = vyNew;
          o1.x = comX;
          o1.y = comY;
          o1.mass = totalMass;
          o1.pCount += o2.pCount;
          o1.radius = Math.max(12, Math.min(60, 8 + Math.sqrt(totalMass) * 1.5));

          const I_new = 0.4 * totalMass * (o1.radius * o1.radius);
          o1.angularVelocity = this.initialAngularVelocity === 0.0 ? 0.0 : Math.max(-15.0, Math.min(15.0, S_new / I_new));

          // Combined stability is lowered by the merger impact
          o1.stability = Math.max(20.0, (o1.stability * o1.mass + o2.stability * o2.mass) / totalMass - 15.0);
          
          o2.active = false;
          continue;
        }
        
        const G = this.gravity * 1e11;
        let force = (G * o1.mass * o2.mass) / (dist * dist); // soft-cored gravity
        
        // Smooth range limit cutoff based on mass-scaled effective gravityRange
        const massScale1 = Math.sqrt(o1.mass / Math.max(1e-18, this.clumpThreshold));
        const massScale2 = Math.sqrt(o2.mass / Math.max(1e-18, this.clumpThreshold));
        const effectiveRange = this.individualPull ? (this.gravityRange + 1 * (0.5 * (massScale1 + massScale2) - 1.0)) : this.gravityRange;
        
        if (dist > effectiveRange) {
          force *= Math.exp(-(dist - effectiveRange) / 40.0);
        }
        
        forces[i].fx += (dx / dist) * force;
        forces[i].fy += (dy / dist) * force;
        
        forces[j].fx -= (dx / dist) * force;
        forces[j].fy -= (dy / dist) * force;
      }
    }
    
    // 2. Apply accelerations, boundaries, stability changes, and disruptions
    const cx = this.width / 2;
    const cy = this.height / 2;

    for (let i = 0; i < n; i++) {
      const obj = this.collapsedObjects[i];
      if (!obj.active) continue;

      const ax = forces[i].fx / obj.mass;
      const ay = forces[i].fy / obj.mass;
      
      obj.vx += ax;
      obj.vy += ay;
      
      // Gentle pull toward center so they don't drift out of view forever
      const dxCenter = cx - obj.x;
      const dyCenter = cy - obj.y;
      const distCenter = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter) || 1;
      
      if (distCenter > 40) {
        obj.vx += (dxCenter / distCenter) * 0.03 * this.centerBias;
        obj.vy += (dyCenter / distCenter) * 0.03 * this.centerBias;
      }
      
      // Decay velocity slightly over time for stable orbits and settling
      obj.vx *= 0.985;
      obj.vy *= 0.985;
      
      obj.x += obj.vx;
      obj.y += obj.vy;
      
      // Wrap-around toroidal boundaries
      if (obj.x < 0) obj.x += this.width;
      if (obj.x > this.width) obj.x -= this.width;
      if (obj.y < 0) obj.y += this.height;
      if (obj.y > this.height) obj.y -= this.height;

      // Stability heal - clamped between 0 and 100
      obj.stability = Math.max(0.0, Math.min(100.0, obj.stability + 0.12));
    }

    // Keep only active magnets
    this.collapsedObjects = this.collapsedObjects.filter(obj => obj.active);
  }

  init() {
    this.setupParticles();
    this.setupGrid();
    this.setupVortices();
    this.shockwaves = [];
  }

  // Set up particles with custom distributions per medium
  setupParticles() {
    this.particles = [];
    this.collapsedObjects = [];
    const count = this.particleDensity;
    const cx = this.width / 2;
    const cy = this.height / 2;
    
    for (let i = 0; i < count; i++) {
      let x, y, vx, vy;
      const angle = Math.random() * Math.PI * 2;
      const radius = 20 + Math.random() * (Math.min(this.width, this.height) * 0.4);
      
      if (this.populationStyle === 'chaos') {
        // Uniform random distribution across full screen
        x = Math.random() * this.width;
        y = Math.random() * this.height;
        vx = (Math.random() - 0.5) * 0.6;
        vy = (Math.random() - 0.5) * 0.6;
      } else if (this.populationStyle === 'spiral') {
        // Swirling galactic spiral
        const spiralAngle = (i / count) * Math.PI * 2 * 12 + Math.random() * 0.4;
        const r = 10 + (i / count) * (Math.min(this.width, this.height) * 0.42);
        x = cx + Math.cos(spiralAngle) * r;
        y = cy + Math.sin(spiralAngle) * r;
        vx = -Math.sin(spiralAngle) * 1.2;
        vy = Math.cos(spiralAngle) * 1.2;
      } else if (this.populationStyle === 'grid') {
        // Evenly spaced grid
        const cols = Math.ceil(Math.sqrt(count));
        const col = i % cols;
        const row = Math.floor(i / cols);
        const spacingX = this.width / (cols + 1);
        const spacingY = this.height / (cols + 1);
        x = spacingX * (col + 1) + (Math.random() - 0.5) * 4;
        y = spacingY * (row + 1) + (Math.random() - 0.5) * 4;
        vx = (Math.random() - 0.5) * 0.1;
        vy = (Math.random() - 0.5) * 0.1;
      } else if (this.populationStyle === 'central') {
        // Heavy center pile
        const coreAngle = Math.random() * Math.PI * 2;
        const coreR = Math.pow(Math.random(), 3.0) * 80;
        x = cx + Math.cos(coreAngle) * coreR;
        y = cy + Math.sin(coreAngle) * coreR;
        vx = -Math.sin(coreAngle) * 0.4;
        vy = Math.cos(coreAngle) * 0.4;
      } else if (this.populationStyle === 'orbital') {
        // Circular starting ring
        const ringRadius = (Math.min(this.width, this.height) * 0.28) + (Math.random() - 0.5) * 20;
        x = cx + Math.cos(angle) * ringRadius;
        y = cy + Math.sin(angle) * ringRadius;
        vx = -Math.sin(angle) * 1.0;
        vy = Math.cos(angle) * 1.0;
      } else {
        // Option specific pattern
        switch(this.mediumId) {
          case 'A': // Option A: Straight lines
            // Distribute along grid tracks
            const trackAngle = Math.floor(Math.random() * 4) * (Math.PI / 2);
            const distOnTrack = Math.random() * (Math.min(this.width, this.height) * 0.45);
            x = cx + Math.cos(trackAngle) * distOnTrack + (Math.random() - 0.5) * 10;
            y = cy + Math.sin(trackAngle) * distOnTrack + (Math.random() - 0.5) * 10;
            vx = -Math.sin(trackAngle) * 0.2;
            vy = Math.cos(trackAngle) * 0.2;
            break;
            
          case 'B': // Option B: Swirling circles
            const angleB = Math.random() * Math.PI * 2;
            const rB = 30 + Math.random() * 220;
            x = cx + Math.cos(angleB) * rB;
            y = cy + Math.sin(angleB) * rB;
            vx = -Math.sin(angleB) * 1.5;
            vy = Math.cos(angleB) * 1.5;
            break;
            
          case 'C': // Option C: Free flowing
          default:
            x = cx + Math.cos(angle) * radius;
            y = cy + Math.sin(angle) * radius;
            vx = -Math.sin(angle) * 0.8;
            vy = Math.cos(angle) * 0.8;
            break;
        }
      }
      
      const pColor = this.getParticleColor(i);
      this.particles.push({
        x: x,
        y: y,
        vx: vx,
        vy: vy,
        baseX: -1.0,
        baseY: 0.0,
        color: pColor,
        originalColor: pColor,
        boundTo: null,
        phase: Math.random() * Math.PI * 2,
        size: 1 + Math.random() * 2,
        history: [] // trail history
      });
    }
  }

  setupGrid() {
    this.gridNodes = [];
    const spacing = 30; // Grid resolution
    
    // Determine number of columns and rows precisely
    this.gridCols = Math.ceil(this.width / spacing) + 1;
    this.gridRows = Math.ceil(this.height / spacing) + 1;
    
    for (let c = 0; c < this.gridCols; c++) {
      const x = c * spacing;
      for (let r = 0; r < this.gridRows; r++) {
        const y = r * spacing;
        this.gridNodes.push({
          ox: x, // Original X
          oy: y, // Original Y
          x: x,  // Current X
          y: y   // Current Y
        });
      }
    }
  }

  setupVortices() {
    this.vortices = [
      { x: this.width * 0.35, y: this.height * 0.4, strength: 3.0 },
      { x: this.width * 0.65, y: this.height * 0.6, strength: -3.0 },
      { x: this.width * 0.5, y: this.height * 0.5, strength: 1.5 }
    ];
  }

  getParticleColor(index) {
    // Return high-contrast colorways based on index and active medium
    if (index % 15 === 0) return '#ff3344'; // Red alarm accent
    if (index % 8 === 0) return '#ffb300';  // Amber hazard accent
    
    switch(this.mediumId) {
      case 'A': return '#00ff66'; // Green phosphor
      case 'B': return '#df73ff'; // Magnetic violet / Vorticity
      case 'C':
      default:
        return '#00e5ff'; // Cyan standard
    }
  }

  // Triggered when "Explode" button is clicked
  explode() {
    const cx = this.width / 2;
    const cy = this.height / 2;
    
    this.particles.forEach(p => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = 10.0 + Math.random() * 8.0;
      p.vx += (dx / dist) * force;
      p.vy += (dy / dist) * force;
    });
  }

  // Trigger manual supernova on any active gravity cores
  triggerSupernova() {
    const activeCores = this.collapsedObjects.filter(obj => obj.active);
    if (activeCores.length === 0) {
      if (typeof window !== 'undefined' && window.appendLog) {
        window.appendLog("NO_ACTIVE_GRAVITY_CORES_TO_DETONATE");
      }
      return;
    }

    activeCores.forEach(obj => {
      obj.active = false;
      
      const isSupernova = obj.mass >= 100.0; // Any manual detonation of a core is spectacular
      const logMsg = `MANUAL_SUPERNOVA_TRIGGERED: DISPERSING_CORE_ID_${obj.id.slice(0, 4).toUpperCase()} (MASS: ${obj.mass.toFixed(1)})`;
      
      // Spawn a physical shockwave that propagates outward, applying real physical force!
      if (!this.shockwaves) this.shockwaves = [];
      this.shockwaves.push({
        id: Math.random().toString(36).substr(2, 9),
        x: obj.x,
        y: obj.y,
        radius: obj.radius,
        maxRadius: 150.0 + Math.sqrt(obj.mass) * 5.0, // expands gently
        energy: obj.mass * 0.3, // much lower explosion energy
        speed: 2.0 + Math.sqrt(obj.mass) * 0.1, // slower, gentler propagation speed
        age: 0,
        maxAge: 60
      });

      // Fling out nearby particles with gentle outward kinetic velocity!
      this.particles.forEach(p => {
        const dx = p.x - obj.x;
        const dy = p.y - obj.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < obj.radius * 4.5) {
          const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.5;
          const speed = 2.5 + Math.random() * 3.5; // Gentler, less violent burst!
          p.vx = obj.vx + Math.cos(angle) * speed;
          p.vy = obj.vy + Math.sin(angle) * speed;
          p.history = [];
          
          // Remnants glow with high-energy colors
          p.color = Math.random() > 0.5 ? '#ffaa00' : '#ff3344';
        }
      });

      if (typeof window !== 'undefined' && window.appendLog) {
        window.appendLog(logMsg);
      }
    });

    // Clean up de-activated cores immediately
    this.collapsedObjects = this.collapsedObjects.filter(obj => obj.active);
  }

  // Physics updates
  tick() {
    if (this.isPaused) return;
    
    this.time += 0.05 * this.simSpeed;

    // Update shockwaves list once per tick
    if (this.shockwaves) {
      this.shockwaves.forEach(sw => {
        sw.radius += sw.speed * this.simSpeed;
        sw.age += this.simSpeed;
      });
      this.shockwaves = this.shockwaves.filter(sw => sw.age < sw.maxAge);
    } else {
      this.shockwaves = [];
    }
    
    const { nodeDensity, clumpThreshold } = computeEngineMetrics(this.mediumId, this.frequency, this.c, this.h, this.gravity * 1e11);
    this.mass = nodeDensity;
    this.clumpThreshold = clumpThreshold;
    const frequency = this.frequency;
    
    const cx = this.width / 2;
    const cy = this.height / 2;

    // 1. Calculate sector densities
    const cols = Math.ceil(this.width / this.sectorSize);
    const rows = Math.ceil(this.height / this.sectorSize);
    
    this.sectors = [];
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        this.sectors.push({
          col: c,
          row: r,
          cx: (c + 0.5) * this.sectorSize,
          cy: (r + 0.5) * this.sectorSize,
          pCount: 0,
          mass: 0,
          isCollapsed: false
        });
      }
    }
    
    const totalParticles = this.particles.length || 1;
    const massPerParticle = this.mass / totalParticles;
    const scaleFactor = 12.0; // Multiplier to trigger local collapse elegantly when grouped
    
    this.particles.forEach(p => {
      let c = Math.floor(p.x / this.sectorSize);
      let r = Math.floor(p.y / this.sectorSize);
      c = Math.max(0, Math.min(cols - 1, c));
      r = Math.max(0, Math.min(rows - 1, r));
      const sIdx = c * rows + r;
      if (sIdx >= 0 && sIdx < this.sectors.length) {
        this.sectors[sIdx].pCount++;
      }
    });
    
    this.sectors.forEach(s => {
      // Check if there is an active shockwave close to this sector
      const inShockwave = this.shockwaves && this.shockwaves.some(sw => {
        const dx = s.cx - sw.x;
        const dy = s.cy - sw.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < sw.radius + 60.0;
      });

      if (inShockwave) {
        s.mass = 0;
        s.pCount = 0;
        return;
      }

      s.mass = s.pCount * massPerParticle * scaleFactor;
      
      // Spawn new magnets when dot density gets too thick
      if (s.mass >= this.clumpThreshold) {
        const nearObj = this.collapsedObjects.find(obj => {
          const dx = obj.x - s.cx;
          const dy = obj.y - s.cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          return dist < this.sectorSize * 1.5;
        });
        
        if (!nearObj) {
          let sumX = 0, sumY = 0, sumVx = 0, sumVy = 0, count = 0;
          this.particles.forEach(p => {
            const col = Math.floor(p.x / this.sectorSize);
            const row = Math.floor(p.y / this.sectorSize);
            if (col === s.col && row === s.row) {
              sumX += p.x;
              sumY += p.y;
              sumVx += p.vx;
              sumVy += p.vy;
              count++;
            }
          });
          
          if (count > 0) {
            const newObj = {
              id: Math.random().toString(36).substr(2, 9),
              x: sumX / count,
              y: sumY / count,
              vx: (sumVx / count) * 0.5,
              vy: (sumVy / count) * 0.5,
              mass: s.mass,
              pCount: count,
              radius: Math.max(12, Math.min(45, 8 + Math.sqrt(s.mass) * 1.5)),
              active: true,
              stability: 100.0,
              angularVelocity: this.initialAngularVelocity
            };
            this.collapsedObjects.push(newObj);

            // Give particles in this sector a tangential orbital velocity!
            const G = this.gravity * 1e11;
            this.particles.forEach(p => {
              const col = Math.floor(p.x / this.sectorSize);
              const row = Math.floor(p.y / this.sectorSize);
              if (col === s.col && row === s.row) {
                const dx = p.x - newObj.x;
                const dy = p.y - newObj.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const nx = dx / dist;
                const ny = dy / dist;
                const orbSpeed = Math.sqrt((G * newObj.mass) / (dist + 5.0)) * 1.2;
                const dir = Math.random() > 0.5 ? 1.0 : -1.0;
                p.vx = newObj.vx - ny * orbSpeed * dir + (Math.random() - 0.5) * 0.2;
                p.vy = newObj.vy + nx * orbSpeed * dir + (Math.random() - 0.5) * 0.2;
                p.history = [];
              }
            });
          }
        } else {
          nearObj.mass = Math.max(nearObj.mass, s.mass);
        }
      }
    });

    // Pull magnets towards each other and merge them if they touch
    this.updateCollapsedObjects();

    // Map collapsed objects back to active sectors so visual HUD is in sync
    this.sectors.forEach(s => {
      const near = this.collapsedObjects.some(obj => {
        const dx = obj.x - s.cx;
        const dy = obj.y - s.cy;
        return Math.sqrt(dx * dx + dy * dy) < this.sectorSize * 0.75;
      });
      s.isCollapsed = near;
    });

    // 2. Update active medium gravity center / vortices
    if (this.mediumId === 'B') {
      // Swirl vortices slowly
      this.vortices.forEach((v, index) => {
        const speed = 0.01 * (index % 2 === 0 ? 1 : -1) * (this.c / 2);
        const dx = v.x - cx;
        const dy = v.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) + speed;
        v.x = cx + Math.cos(angle) * dist;
        v.y = cy + Math.sin(angle) * dist;
      });
    }

    // 3. Compute particle physics
    const numParticles = this.particles.length;
    const hasCollapsed = this.collapsedObjects.length > 0;
    
    for (let i = 0; i < numParticles; i++) {
      const p = this.particles[i];

      p.phase += 0.05;

      const dxCenter = cx - p.x;
      const dyCenter = cy - p.y;
      const distCenter = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter) || 1;

      let ax = 0;
      let ay = 0;

      // 1. Dot vibration (using speed and weight)
      const pFreq = this.frequency * (0.8 + 0.4 * Math.sin(i * 100));
      p.phase += pFreq * 0.03;
      const pMass = (pFreq * this.h) / Math.pow(this.c, 3) * (0.5 + 0.5 * Math.sin(i * 50));
      const vibStrength = Math.sqrt(Math.max(0, pMass + 0.1)) * (this.frequency * 0.15);
      ax += Math.sin(p.phase) * vibStrength;
      ay += Math.cos(p.phase * 1.3) * vibStrength;

      // 2. Gentle background wave wobble
      const scale = 0.03;
      const t = this.time * this.frequency * 0.08;
      
      const phase1 = (p.x * 0.8 + p.y * 0.6) * scale - t;
      const phase2 = (-p.x * 0.5 + p.y * 0.86) * scale + t * 1.2;
      const phase3 = (p.x * 0.3 - p.y * 0.95) * scale - t * 0.7;

      const fx = Math.sin(phase1) * 0.4 + Math.sin(phase3) * 0.3;
      const fy = Math.cos(phase2) * 0.4 + Math.sin(phase1 - phase2) * 0.3;

      const waveForce = this.frequency * 0.06;
      ax += fx * waveForce;
      ay += fy * waveForce;

      // 2b. Explosion blast wave force (push dots outward!)
      if (this.shockwaves && this.shockwaves.length > 0) {
        this.shockwaves.forEach(sw => {
          const dx = p.x - sw.x;
          const dy = p.y - sw.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          
          if (dist < sw.radius + 60.0) {
            // Outward blast wave force based on explosion energy
            const ageRatio = sw.age / sw.maxAge;
            const blastForce = (sw.energy * 3.0) / (dist + 30.0) * (1.0 - ageRatio);
            ax += (dx / dist) * blastForce;
            ay += (dy / dist) * blastForce;
            
            // Remnants glow with high-energy colors
            p.color = Math.random() > 0.5 ? '#ffaa00' : '#ff3344';
          }
        });
      }

      // 3. Pull dots towards active magnets and eat them if they get too close
      if (hasCollapsed) {
        this.collapsedObjects.forEach(obj => {
          const dx = obj.x - p.x;
          const dy = obj.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const G_sim = (this.gravity * 1e11) * 20.0;
          const rs = (2.0 * G_sim * obj.mass) / (this.c * this.c);
          obj.radius = Math.max(12, Math.min(60, rs));

          // Calculate smooth gravity range factor (smoothstep) based on mass-scaled effective range
          const massScale = Math.sqrt(obj.mass / Math.max(1e-18, this.clumpThreshold));
          const effectiveRange = this.individualPull ? (this.gravityRange + 1 * (massScale - 1.0)) : this.gravityRange;

          let rangeFactor = 1.0;
          const startDecay = effectiveRange * 0.5;
          const endDecay = effectiveRange * 1.5;
          if (dist > startDecay) {
            const t = (dist - startDecay) / (endDecay - startDecay || 1);
            const clampedT = Math.max(0.0, Math.min(1.0, t));
            rangeFactor = 1.0 - (clampedT * clampedT * (3.0 - 2.0 * clampedT));
          }

          if (rangeFactor > 0.0) {
            if (dist < 8.0) {
              // Sucked into the magnet!
              // Smooth momentum absorption and mass accretion
              const pMass = 0.05;
              obj.vx = (obj.vx * obj.mass + p.vx * pMass) / (obj.mass + pMass);
              obj.vy = (obj.vy * obj.mass + p.vy * pMass) / (obj.mass + pMass);
              
              // Accretion-based spin-up / spin-down (Angular momentum transfer)
              const rx = p.x - obj.x;
              const ry = p.y - obj.y;
              const L_accreted = rx * p.vy - ry * p.vx;
              const I_old = 0.4 * obj.mass * (obj.radius * obj.radius);
              const S_old = I_old * (obj.angularVelocity || 0.0);
              
              // Scale accretion spin contribution: if initialAngularVelocity is 0, no spin-up can occur
              const spinUpFactor = this.initialAngularVelocity === 0.0 ? 0.0 : 0.001;
              const S_new = S_old + L_accreted * pMass * spinUpFactor;
              
              obj.mass += pMass;
              obj.pCount++;

              // Recalculate moment of inertia and angular velocity
              const rs_new = (2.0 * G_sim * obj.mass) / (this.c * this.c);
              const r_new = Math.max(12, Math.min(60, rs_new));
              const I_new = 0.4 * obj.mass * (r_new * r_new);
              obj.angularVelocity = this.initialAngularVelocity === 0.0 ? 0.0 : Math.max(-15.0, Math.min(15.0, S_new / I_new));

              // Recycle lost dots occasionally
              if (Math.random() < 0.002) {
                p.x = Math.random() * this.width;
                p.y = Math.random() > 0.5 ? 0 : this.height;
                p.vx = (Math.random() - 0.5) * 0.5;
                p.vy = (Math.random() - 0.5) * 0.5;
                p.color = p.originalColor;
                p.history = [];
              } else {
                // Orbit fast near the center
                const speed = 4.0;
                p.vx = -dy / dist * speed + obj.vx;
                p.vy = dx / dist * speed + obj.vy;
                p.color = '#ffffff'; // Glowing white center
              }
            } else {
              // Standard pull toward magnet center
              const rx = p.x - obj.x;
              const ry = p.y - obj.y;
              const rvx = p.vx - obj.vx;
              const rvy = p.vy - obj.vy;
              const L = rx * rvy - ry * rvx;
              const L2 = L * L;
              const c2 = this.c * this.c;
              
              // Pull extra hard when really close
              const grCorrection = 1.0 + (3.0 * L2) / (c2 * (dist * dist + 16.0));
              let force = (G_sim * obj.mass) / (dist * dist + 16.0) * grCorrection;
              
              // Apply smooth gravity range factor
              force *= rangeFactor;

              ax += (dx / dist) * force;
              ay += (dy / dist) * force;

              // Drag dots with the magnet's spin
              const J = 0.4 * obj.mass * (obj.radius * obj.radius) * (obj.angularVelocity || 0.0);
              const vDrag = (2.0 * G_sim * J) / (c2 * (dist * dist));
              const tx = -dy / dist;
              const ty = dx / dist;
              ax += (tx * vDrag - rvx) * 0.15 * rangeFactor;
              ay += (ty * vDrag - rvy) * 0.15 * rangeFactor;

              // Rotate space around the magnet
              if (this.darkEnergy > 0.0) {
                const wellRotationSpeed = this.darkEnergy * (obj.mass / 100.0) * (20.0 / (dist + 30.0));
                ax += -ry * wellRotationSpeed * 0.05 * rangeFactor;
                ay += rx * wellRotationSpeed * 0.05 * rangeFactor;
              }

              // Push dots to swirl around
              if (this.orbitalBoost > 0.0) {
                const tangentialX = -dy / dist;
                const tangentialY = dx / dist;
                ax += tangentialX * this.orbitalBoost * 1.5 * rangeFactor;
                ay += tangentialY * this.orbitalBoost * 1.5 * rangeFactor;
              }

              // Color dots by distance zones - completely smooth gradient!
              const k = dist / obj.radius;
              if (k < 1.0) {
                // Blend from white (#ffffff) to red-orange (#ff3300)
                const t = k;
                const r = 255;
                const g = Math.round(255 - 204 * t);
                const b = Math.round(255 - 255 * t);
                p.color = `rgb(${r},${g},${b})`;
              } else if (k < 2.0) {
                // Blend from red-orange (#ff3300 = rgb(255,51,0)) to orange (#ff9900 = rgb(255,153,0))
                const t = k - 1.0;
                const r = 255;
                const g = Math.round(51 + 102 * t);
                const b = 0;
                p.color = `rgb(${r},${g},${b})`;
              } else if (k < 3.5) {
                // Blend from orange (#ff9900 = rgb(255,153,0)) to yellow (#ffcc00 = rgb(255,204,0))
                const t = (k - 2.0) / 1.5;
                const r = 255;
                const g = Math.round(153 + 51 * t);
                const b = 0;
                p.color = `rgb(${r},${g},${b})`;
              } else if (k < 5.0) {
                // Blend from yellow (#ffcc00 = rgb(255,204,0)) to original color
                const t = (k - 3.5) / 1.5;
                let origR = 0, origG = 255, origB = 102; // default fallback green
                if (p.originalColor.startsWith('#')) {
                  origR = parseInt(p.originalColor.slice(1, 3), 16);
                  origG = parseInt(p.originalColor.slice(3, 5), 16);
                  origB = parseInt(p.originalColor.slice(5, 7), 16);
                }
                const r = Math.round(255 + (origR - 255) * t);
                const g = Math.round(204 + (origG - 204) * t);
                const b = Math.round(0 + (origB - 0) * t);
                p.color = `rgb(${r},${g},${b})`;
              } else {
                p.color = p.originalColor;
              }
            }
          }
        });

        // Add a gentle background drift towards center so orbits stabilize
        const G_sim = (this.gravity * 1e11) * 20.0;
        if (distCenter > 10) {
          ax += (dxCenter / distCenter) * (G_sim * 0.01) * this.centerBias;
          ay += (dyCenter / distCenter) * (G_sim * 0.01) * this.centerBias;
        }
      }

      // Pull dots towards user's mouse magnet
      if (this.attractor.active) {
        const dxAttr = this.attractor.x - p.x;
        const dyAttr = this.attractor.y - p.y;
        const distAttr = Math.sqrt(dxAttr * dxAttr + dyAttr * dyAttr) || 1;
        
        const strengthScale = Math.sqrt(this.attractor.strength / 5.0);
        const effectiveRange = this.individualPull ? (this.gravityRange + 1 * (strengthScale - 1.0)) : this.gravityRange;

        let rangeFactor = 1.0;
        const startDecay = effectiveRange * 0.5;
        const endDecay = effectiveRange * 1.5;
        if (distAttr > startDecay) {
          const t = (distAttr - startDecay) / (endDecay - startDecay || 1);
          const clampedT = Math.max(0.0, Math.min(1.0, t));
          rangeFactor = 1.0 - (clampedT * clampedT * (3.0 - 2.0 * clampedT));
        }

        if (rangeFactor > 0.0) {
          let force = (this.attractor.strength * (this.gravity * 1e11)) / (distAttr * 0.01 + 1);
          force *= rangeFactor;

          ax += (dxAttr / distAttr) * force;
          ay += (dyAttr / distAttr) * force;

          if (this.darkEnergy > 0.0) {
            const repulsion = this.darkEnergy * distAttr * 0.03 * rangeFactor;
            ax -= (dxAttr / distAttr) * repulsion;
            ay -= (dyAttr / distAttr) * repulsion;
          }

          // Orbital velocity boost for user well
          if (this.orbitalBoost > 0.0) {
            const tangentialX = -dyAttr / distAttr;
            const tangentialY = dxAttr / distAttr;
            ax += tangentialX * this.orbitalBoost * 1.5 * rangeFactor;
            ay += tangentialY * this.orbitalBoost * 1.5 * rangeFactor;
          }
        }
      }

      // Option-specific movement forces
      switch(this.mediumId) {
        case 'A': // Option A: Straight lines (Locked on grid with slight vibration)
          if (frequency !== 0) {
            // Constrain particles to horizontal/vertical tracks with snapping
            const snapX = Math.round(p.x / 40) * 40;
            const snapY = Math.round(p.y / 40) * 40;
            
            // Scale constraint force with frequency
            const absFreq = Math.abs(frequency);
            const constraintStrength = 0.05 * Math.min(1.0, absFreq);
            ax += (snapX - p.x) * constraintStrength;
            ay += (snapY - p.y) * constraintStrength;
            
            // Transverse vibrating jerk force (proportional to frequency)
            const vibForce = Math.sin(p.phase * (frequency * 0.01)) * 0.8 * Math.min(1.0, absFreq);
            ax += Math.cos(p.phase) * vibForce;
            ay += Math.sin(p.phase) * vibForce;
          }
          break;

        case 'B': // Option B: Swirling circles (Vortex swirl orbits)
          // Calculate cumulative rotational force from the vortices
          this.vortices.forEach(v => {
            const dx = p.x - v.x;
            const dy = p.y - v.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            
            if (dist < 300) {
              // Spin speed depends on wind speed
              const rotSpeed = (v.strength * frequency * 0.2) / (dist * 0.01 + 2);
              const targetVx = -dy/dist * rotSpeed;
              const targetVy = dx/dist * rotSpeed;
              
              // Apply as a guiding force
              ax += (targetVx - p.vx) * 0.2;
              ay += (targetVy - p.vy) * 0.2;
            }
          });
          break;

        case 'C': // Option C: Free flowing (Smooth waving orbits)
        default:
          // Smooth waving patterns
          const deBroglie = Math.sin(p.phase * (frequency * 0.05)) * 0.1;
          ax += Math.cos(p.phase) * deBroglie;
          ay += Math.sin(p.phase) * deBroglie;
          break;
      }

      // Simple intra-collisions (push away from nearest particles)
      if (this.intraCollisions && i % 4 === 0) {
        const nextParticle = this.particles[(i + 1) % numParticles];
        const dx = nextParticle.x - p.x;
        const dy = nextParticle.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 12) {
          const pushForce = (12 - dist) * 0.08;
          ax -= (dx / dist) * pushForce;
          ay -= (dy / dist) * pushForce;
          nextParticle.vx += (dx / dist) * pushForce;
          nextParticle.vy += (dy / dist) * pushForce;
        }
      }


      if (this.darkEnergy > 0.0) {
        const dxCenterExp = p.x - cx;
        const dyCenterExp = p.y - cy;
        const distCenterExp = Math.sqrt(dxCenterExp * dxCenterExp + dyCenterExp * dyCenterExp) || 1;
        const hubbleAcceleration = this.darkEnergy * distCenterExp * 0.0003;
        ax += (dxCenterExp / distCenterExp) * hubbleAcceleration;
        ay += (dyCenterExp / distCenterExp) * hubbleAcceleration;
      }

      // Apply acceleration and velocity
      p.vx += ax * this.simSpeed;
      p.vy += ay * this.simSpeed;
      
      // Drag/damping
      p.vx *= Math.pow(1 - this.drag, this.simSpeed);
      p.vy *= Math.pow(1 - this.drag, this.simSpeed);

      // Boundary safety
      const maxVel = 18;
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
      if (speed > maxVel) {
        p.vx = (p.vx / speed) * maxVel;
        p.vy = (p.vy / speed) * maxVel;
      }

      p.x += p.vx * this.simSpeed;
      p.y += p.vy * this.simSpeed;

      // Periodic border wrap (Toroidal Space)
      if (p.x < 0) {
        p.x += this.width;
        p.history = [];
      } else if (p.x > this.width) {
        p.x -= this.width;
        p.history = [];
      }
      if (p.y < 0) {
        p.y += this.height;
        p.history = [];
      } else if (p.y > this.height) {
        p.y -= this.height;
        p.history = [];
      }

      // Save history for trails
      if (this.waveTrails && i % 3 === 0) {
        p.history.push({ x: p.x, y: p.y });
        if (p.history.length > 8) {
          p.history.shift();
        }
      } else {
        p.history = [];
      }
    }

    // 3. Compute grid distortion nodes
    this.updateGridDistortion(cx, cy);
  }

  // Update background grid lines based on gravity / parameters
  updateGridDistortion(cx, cy) {
    const hasCollapsed = this.collapsedObjects && this.collapsedObjects.length > 0;

    this.gridNodes.forEach(node => {
      let dxTotal = 0;
      let dyTotal = 0;

      // Always apply gentle background wave wobble
      const scale = 0.025;
      const t = this.time * this.frequency * 0.08;
      
      const phase1 = (node.ox * 0.8 + node.oy * 0.6) * scale - t;
      const phase2 = (-node.ox * 0.5 + node.oy * 0.86) * scale + t * 1.2;
      const phase3 = (node.ox * 0.3 - node.oy * 0.95) * scale - t * 0.7;
      
      const fx = Math.sin(phase1) * 0.4 + Math.sin(phase3) * 0.3;
      const fy = Math.cos(phase2) * 0.4 + Math.sin(phase1 - phase2) * 0.3;
      
      const gridWaveStrength = this.frequency * 1.5;
      dxTotal += fx * gridWaveStrength;
      dyTotal += fy * gridWaveStrength;

      // Warp grid lines towards active magnets
      if (hasCollapsed && this.gravityRange > 0.0) {
        this.collapsedObjects.forEach(obj => {
          const dx = obj.x - node.ox;
          const dy = obj.y - node.oy;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const massScale = Math.sqrt(obj.mass / Math.max(1e-18, this.clumpThreshold));
          const effectiveRange = this.individualPull ? (this.gravityRange + 1 * (massScale - 1.0)) : this.gravityRange;

          let rangeFactor = 1.0;
          const startDecay = effectiveRange * 0.5;
          const endDecay = effectiveRange * 1.5;
          if (dist > startDecay) {
            const t = (dist - startDecay) / (endDecay - startDecay || 1);
            const clampedT = Math.max(0.0, Math.min(1.0, t));
            rangeFactor = 1.0 - (clampedT * clampedT * (3.0 - 2.0 * clampedT));
          }

          if (rangeFactor > 0.0) {
            // Pull grid lines towards magnets
            let pull = (obj.mass * 60.0) / (dist * 0.04 + 1);
            pull *= rangeFactor;

            let pullX = (dx / dist) * pull;
            let pullY = (dy / dist) * pull;

            // Twist grid lines around spinning magnets
            const G_sim = (this.gravity * 1e11) * 20.0;
            const J = 0.4 * obj.mass * (obj.radius * obj.radius) * (obj.angularVelocity || 0.0);
            const c2 = this.c * this.c;
            const omegaDrag = (2.0 * G_sim * J) / (c2 * (dist * dist * dist));

            // Rotational twist based on push away setting
            const deRotation = this.darkEnergy > 0.0 ? (this.darkEnergy * 0.015 * (obj.mass / 100.0) * Math.exp(-dist / 80.0)) : 0.0;
            const totalTwist = ((omegaDrag * 6.0) + deRotation) * rangeFactor; // Amplified multiplier for beautiful 2D rendering

            if (totalTwist > 0.0) {
              const cosT = Math.cos(totalTwist);
              const sinT = Math.sin(totalTwist);
              const rx = pullX;
              const ry = pullY;
              pullX = rx * cosT - ry * sinT;
              pullY = rx * sinT + ry * cosT;
            }

            dxTotal += pullX;
            dyTotal += pullY;
          }
        });
      }

      // Pull grid lines towards mouse magnet
      if (this.attractor.active && this.gravityRange > 0.0) {
        const dxAttr = this.attractor.x - node.ox;
        const dyAttr = this.attractor.y - node.oy;
        const distAttr = Math.sqrt(dxAttr * dxAttr + dyAttr * dyAttr) || 1;
        
        const strengthScale = Math.sqrt(this.attractor.strength / 5.0);
        const effectiveRange = this.individualPull ? (this.gravityRange + 1 * (strengthScale - 1.0)) : this.gravityRange;

        let rangeFactor = 1.0;
        const startDecay = effectiveRange * 0.5;
        const endDecay = effectiveRange * 1.5;
        if (distAttr > startDecay) {
          const t = (distAttr - startDecay) / (endDecay - startDecay || 1);
          const clampedT = Math.max(0.0, Math.min(1.0, t));
          rangeFactor = 1.0 - (clampedT * clampedT * (3.0 - 2.0 * clampedT));
        }

        if (rangeFactor > 0.0) {
          let pull = (this.attractor.strength * 18.0) / (distAttr * 0.04 + 1);
          pull *= rangeFactor;

          dxTotal += (dxAttr / distAttr) * pull;
          dyTotal += (dyAttr / distAttr) * pull;
        }
      }

      // Swirling grid distortion under Option B
      if (this.mediumId === 'B') {
        this.vortices.forEach(v => {
          const dxv = v.x - node.ox;
          const dyv = v.y - node.oy;
          const distv = Math.sqrt(dxv * dxv + dyv * dyv) || 1;
          if (distv < 180) {
            const rotStrength = (v.strength * 4.0 * this.c) / (distv * 0.03 + 1);
            // Twisting offsets perpendicular to radius
            dxTotal += -dyv/distv * rotStrength;
            dyTotal += dxv/distv * rotStrength;
          }
        });
      }

      // Apply dynamic relaxation
      node.x = node.ox + dxTotal;
      node.y = node.oy + dyTotal;
    });
  }

  // 2D Canvas Fallback Rendering
  render() {
    this.ctx.fillStyle = '#030305';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw background lines
    this.drawCoordinates();

    if (this.renderMode === 'grid') {
      this.drawDistortionGrid();
    } else if (this.renderMode === 'vector') {
      this.drawVectorField();
    }

    // Always draw particles in particles mode, or draw them lightly in others
    const particleAlpha = this.renderMode === 'physics' ? 1.0 : 0.35;
    this.drawParticles(particleAlpha);

    // Draw mouse magnet
    this.drawAttractor();
  }

  drawCoordinates() {
    this.ctx.strokeStyle = '#0d0d16';
    this.ctx.lineWidth = 1;
    
    // Draw block lines
    const spacing = this.sectorSize;
    this.ctx.beginPath();
    for (let x = 0; x <= this.width; x += spacing) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
    }
    for (let y = 0; y <= this.height; y += spacing) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
    }
    this.ctx.stroke();

    // Render supernova shockwave blast waves - drawing removed per user request

    // Show dot count inside blocks
    if (this.sectors && this.sectors.length > 0 && this.renderMode === 'physics') {
      this.sectors.forEach(s => {
        if (!s.isCollapsed && s.pCount > 0) {
          this.ctx.fillStyle = 'rgba(0, 229, 255, 0.12)';
          this.ctx.font = '7px monospace';
          this.ctx.fillText(`dots:${s.mass.toFixed(0)}`, s.cx - this.sectorSize/2 + 4, s.cy - this.sectorSize/2 + 10);
        }
      });
    }

    // Small boundary marks in corners
    this.ctx.fillStyle = '#222230';
    this.ctx.font = '9px monospace';
    this.ctx.fillText(`SPEED_LIMIT: ${this.c.toFixed(2)}`, 12, this.height - 12);
    
    const collapsedCount = this.sectors ? this.sectors.filter(s => s.isCollapsed).length : 0;
    this.ctx.fillText(`ACTIVE_MAGNETS: ${collapsedCount}`, 140, this.height - 12);
  }

  drawDistortionGrid() {
    this.ctx.strokeStyle = '#1a1a2b';
    this.ctx.lineWidth = 1;

    const cols = this.gridCols;
    const rows = this.gridRows;

    // Draw vertical lines (down each column)
    for (let c = 0; c < cols; c++) {
      this.ctx.beginPath();
      for (let r = 0; r < rows; r++) {
         const idx = c * rows + r;
         if (idx < this.gridNodes.length) {
           const node = this.gridNodes[idx];
           if (r === 0) this.ctx.moveTo(node.x, node.y);
           else this.ctx.lineTo(node.x, node.y);
         }
      }
      this.ctx.stroke();
    }

    // Draw horizontal lines (across each row)
    for (let r = 0; r < rows; r++) {
      this.ctx.beginPath();
      for (let c = 0; c < cols; c++) {
         const idx = c * rows + r;
         if (idx < this.gridNodes.length) {
           const node = this.gridNodes[idx];
           if (c === 0) this.ctx.moveTo(node.x, node.y);
           else this.ctx.lineTo(node.x, node.y);
         }
      }
      this.ctx.stroke();
    }
  }

  drawVectorField() {
    this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
    this.ctx.lineWidth = 1;
    const spacing = 45;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const { nodeDensity } = computeEngineMetrics(this.mediumId, this.frequency, this.c, this.h);
    this.mass = nodeDensity;
    const frequency = this.frequency;

    for (let x = spacing; x < this.width; x += spacing) {
      for (let y = spacing; y < this.height; y += spacing) {
        const dx = cx - x;
        const dy = cy - y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        // Base vector pointing to center
        let vx = dx / dist;
        let vy = dy / dist;

        // Vector fields twisted by active medium
        if (this.mediumId === 'B') {
          // Swirling vortices
          let swx = 0;
          let swy = 0;
          this.vortices.forEach(v => {
            const vdx = x - v.x;
            const vdy = y - v.y;
            const vdist = Math.sqrt(vdx * vdx + vdy * vdy) || 1;
            if (vdist < 250) {
              const rot = (v.strength * frequency * 0.1) / (vdist * 0.01 + 1);
              swx += -vdy/vdist * rot;
              swy += vdx/vdist * rot;
            }
          });
          vx += swx;
          vy += swy;
        } else if (this.mediumId === 'A') {
          // Grid alignment vectors
          const alignment = Math.sin((x / 40) + (y / 40)) * 0.5;
          vx += alignment;
          vy -= alignment;
        }

        // Normalize and scale arrow length
        const vLen = Math.sqrt(vx * vx + vy * vy) || 1;
        const arrowLen = 14;
        const endX = x + (vx / vLen) * arrowLen;
        const endY = y + (vy / vLen) * arrowLen;

        // Draw arrow shaft
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();

        // Draw tiny arrow head
        this.ctx.fillStyle = 'rgba(0, 229, 255, 0.25)';
        this.ctx.beginPath();
        this.ctx.arc(endX, endY, 1.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }

  drawParticles(alpha) {
    this.ctx.save();
    this.ctx.globalAlpha = alpha;

    const len = this.particles.length;
    for (let i = 0; i < len; i++) {
      const p = this.particles[i];

      // Render Trails
      if (p.history && p.history.length > 1) {
        this.ctx.strokeStyle = p.color;
        this.ctx.lineWidth = p.size * 0.4;
        this.ctx.globalAlpha = alpha * 0.35;
        this.ctx.beginPath();
        this.ctx.moveTo(p.history[0].x, p.history[0].y);
        for (let h = 1; h < p.history.length; h++) {
          const dx = p.history[h].x - p.history[h-1].x;
          const dy = p.history[h].y - p.history[h-1].y;
          if (dx * dx + dy * dy > 1200) {
            this.ctx.moveTo(p.history[h].x, p.history[h].y);
          } else {
            this.ctx.lineTo(p.history[h].x, p.history[h].y);
          }
        }
        this.ctx.stroke();
        this.ctx.globalAlpha = alpha;
      }

      // Render Particle Dots
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();

      // Cosmic filament connection lines (Option A visualizer)
      if (this.mediumId === 'A' && i % 40 === 0 && i < len - 40) {
        const pNext = this.particles[i + 40];
        const dx = pNext.x - p.x;
        const dy = pNext.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 80) {
          this.ctx.strokeStyle = 'rgba(0, 255, 102, 0.12)';
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(pNext.x, pNext.y);
          this.ctx.stroke();
        }
      }
    }

    this.ctx.restore();
  }

  drawAttractor() {
    if (!this.attractor.active) return;
    
    const grad = this.ctx.createRadialGradient(
      this.attractor.x, this.attractor.y, 2,
      this.attractor.x, this.attractor.y, 16
    );
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, '#ff3344');
    grad.addColorStop(1, 'rgba(255, 51, 68, 0)');

    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(this.attractor.x, this.attractor.y, 16, 0, Math.PI * 2);
    this.ctx.fill();

    // Dotted gravity influence boundary
    this.ctx.strokeStyle = 'rgba(255, 51, 68, 0.25)';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([2, 4]);
    this.ctx.beginPath();
    this.ctx.arc(this.attractor.x, this.attractor.y, 60, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }
}
