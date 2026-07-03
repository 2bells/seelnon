
import { computeEngineMetrics } from './math.js';

export class WebGPURenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.device = null;
    this.context = null;
    
    // WebGPU Pipelines & BindGroups
    this.computePipeline = null;
    this.renderPipeline = null;
    this.particleBuffer = null;
    this.uniformBuffer = null;
    this.bindGroupCompute = null;
    this.bindGroupRender = null;
    
    // Track initialization
    this.isReady = false;
  }

  // Detect and initialize WebGPU
  async init() {
    if (!navigator.gpu) {
      throw new Error("WebGPU is not supported by this browser.");
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("No compatible graphics adapter found.");
    }

    this.device = await adapter.requestDevice();
    this.context = this.canvas.getContext("webgpu");
    if (!this.context) {
      throw new Error("WebGPU context could not be created on this canvas.");
    }

    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;

    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: presentationFormat,
      alphaMode: "opaque"
    });

    await this.setupPipelines(presentationFormat);
    this.isReady = true;
    console.log("WebGPU: Pipeline successfully initialized on GPU Device.");
  }

  resize(width, height) {
    if (!this.isReady) return;
    this.canvas.width = width;
    this.canvas.height = height;

    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: presentationFormat,
      alphaMode: "opaque"
    });
  }

  async setupPipelines(presentationFormat) {
    // 1. WGSL Shader Source Code (Compute + Render)
    const shaderSource = `
      struct SimParams {
        mass: f32,
        c: f32,
        h: f32,
        gravity: f32,
        drag: f32,
        frequency: f32,
        particleCount: u32,
        time: f32,
        attractorActive: u32,
        attractorX: f32,
        attractorY: f32,
        mediumId: u32, // 0=A, 1=B, 2=C
        width: f32,
        height: f32,
        simSpeed: f32,
        darkEnergy: f32,
        orbitalBoost: f32,
        gravityRange: f32,
        initialAngularVelocity: f32,
        centerBias: f32,
      }

      struct Particle {
        pos: vec2<f32>,
        vel: vec2<f32>,
        orig_r: f32,
        orig_g: f32,
        phase: f32,
        size: f32,
        color_r: f32,
        color_g: f32,
        color_b: f32,
        orig_b: f32,
      }

      @group(0) @binding(0) var<uniform> params: SimParams;
      @group(0) @binding(1) var<storage, read_write> particles: array<Particle>;

      struct Singularity {
        pos: vec2<f32>,
        mass: f32,
        radius: f32,
        active: u32,
        spin: f32,
        pad2: f32,
        pad3: f32,
      }

      @group(0) @binding(2) var<uniform> singularities: array<Singularity, 16>;

      // Random generator for fractal jitter
      fn hash(value: u32) -> f32 {
        var x = value;
        x = ((x >> 16u) ^ x) * 0x45d9f3bu;
        x = ((x >> 16u) ^ x) * 0x45d9f3bu;
        x = (x >> 16u) ^ x;
        return f32(x) / 4294967295.0;
      }

      @compute @workgroup_size(64)
      fn computeMain(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let index = global_id.x;
        if (index >= params.particleCount) {
          return;
        }

        var p = particles[index];

        p.phase += 0.05 * params.simSpeed;

        let cx = params.width / 2.0;
        let cy = params.height / 2.0;
        var ax = 0.0;
        var ay = 0.0;

        // Central gravity well vs quantum waves
        let dxCenter = cx - p.pos.x;
        let dyCenter = cy - p.pos.y;
        let distCenter = max(1.0, length(vec2<f32>(dxCenter, dyCenter)));
        
        // 1. Quantum vibration per-particle (using particle's unique local frequency and mass)
        let pFreq = params.frequency * (0.8 + 0.4 * sin(f32(index) * 100.0));
        p.phase += pFreq * 0.03 * params.simSpeed;
        let pMass = (pFreq * params.h) / (params.c * params.c * params.c) * (0.5 + 0.5 * sin(f32(index) * 50.0));
        let vibStrength = sqrt(max(0.0, pMass + 0.1)) * (params.frequency * 0.15);
        ax += sin(p.phase) * vibStrength;
        ay += cos(p.phase * 1.3) * vibStrength;

        // 2. Translation-invariant background Quantum Wave State (true chaotic boiling vacuum)
        let scale: f32 = 0.03;
        let t: f32 = params.time * params.frequency * 0.08;
        
        let phase1 = (p.pos.x * 0.8 + p.pos.y * 0.6) * scale - t;
        let phase2 = (-p.pos.x * 0.5 + p.pos.y * 0.86) * scale + t * 1.2;
        let phase3 = (p.pos.x * 0.3 - p.pos.y * 0.95) * scale - t * 0.7;

        let fx = sin(phase1) * 0.4 + sin(phase3) * 0.3;
        let fy = cos(phase2) * 0.4 + sin(phase1 - phase2) * 0.3;

        let waveForce = params.frequency * 0.06;
        ax += fx * waveForce;
        ay += fy * waveForce;

        // 3. Gravitational attraction & absorption from dynamic singularities/collapsed objects
        var anyCollapsed = false;
        
        for (var sIdx: u32 = 0u; sIdx < 16u; sIdx = sIdx + 1u) {
          let sing = singularities[sIdx];
          if (sing.active == 1u) {
            anyCollapsed = true;
            let dx = sing.pos.x - p.pos.x;
            let dy = sing.pos.y - p.pos.y;
            let dist = max(1.0, length(vec2<f32>(dx, dy)));

            if (dist < params.gravityRange) {
              let G_sim = (params.gravity * 100000000000.0) * 20.0;
              let rs = (2.0 * G_sim * sing.mass) / (params.c * params.c);
              let eventHorizon = max(12.0, min(60.0, rs));

              if (dist < 8.0) {
                // Plunged into the central singularity core!
                let seed = index + u32(params.time * 1337.0);
                if (hash(seed) < 0.002) {
                  // Hawking radiation evaporation / recycling
                  p.pos.x = hash(seed + 1u) * params.width;
                  p.pos.y = select(0.0, params.height, hash(seed + 2u) > 0.5);
                  p.vel = vec2<f32>((hash(seed + 3u) - 0.5) * 0.5, (hash(seed + 4u) - 0.5) * 0.5);
                  p.color_r = p.orig_r;
                  p.color_g = p.orig_g;
                  p.color_b = p.orig_b;
                } else {
                  // Tight orbital spin in core
                  let speed = 4.0;
                  p.vel = vec2<f32>(-dy / dist, dx / dist) * speed;
                  p.color_r = 1.0;
                  p.color_g = 1.0;
                  p.color_b = 1.0; // White hot central singularity point
                }
              } else {
                // Gravitational pull with Einstein General Relativity correction (Schwarzschild potential)
                let rx = p.pos.x - sing.pos.x;
                let ry = p.pos.y - sing.pos.y;
                let rvx = p.vel.x;
                let rvy = p.vel.y;
                
                // Specific angular momentum L = r x v
                let L = rx * rvy - ry * rvx;
                let L2 = L * L;
                let c2 = params.c * params.c;
                
                // Relativistic correction factor (attractive force increases dramatically near event horizon)
                let grCorrection = 1.0 + (3.0 * L2) / (c2 * (dist * dist + 16.0));
                var force = (G_sim * sing.mass) / (dist * dist + 16.0) * grCorrection;
                
                // Smooth range cutoff at gravityRange boundaries
                if (dist > params.gravityRange * 0.8) {
                  let rangeFactor = 1.0 - (dist - params.gravityRange * 0.8) / (params.gravityRange * 0.2);
                  force = force * max(0.0, rangeFactor);
                }

                ax += (dx / dist) * force;
                ay += (dy / dist) * force;

                // Relativistic Lense-Thirring frame dragging in WebGPU
                let J = 0.4 * sing.mass * (sing.radius * sing.radius) * sing.spin;
                let vDrag = (2.0 * G_sim * J) / (c2 * (dist * dist + 100.0));
                let tx = -dy / dist;
                let ty = dx / dist;
                ax += (tx * vDrag - rvx) * 0.15;
                ay += (ty * vDrag - rvy) * 0.15;

                // Instead of dark energy repulsion, rotate space around the collapsed object (rotating the spacetime well)
                if (params.darkEnergy > 0.0) {
                  let wellRotationSpeed = params.darkEnergy * (sing.mass / 100.0) * (20.0 / (dist + 30.0));
                  ax += -ry * wellRotationSpeed * 0.05;
                  ay += rx * wellRotationSpeed * 0.05;
                }

                // Centrifugal/Orbital Tangential Velocity Injection
                if (params.orbitalBoost > 0.0) {
                  let tangentialX = -dy / dist;
                  let tangentialY = dx / dist;
                  ax += tangentialX * params.orbitalBoost * 1.5;
                  ay += tangentialY * params.orbitalBoost * 1.5;
                }

                // Color particles based on accretion disk zones
                if (dist < eventHorizon) {
                  p.color_r = 1.0;
                  p.color_g = 0.2;
                  p.color_b = 0.0; // #ff3300 inside Schwarzschild event horizon
                } else if (dist < eventHorizon * 2.0) {
                  p.color_r = 1.0;
                  p.color_g = 0.6;
                  p.color_b = 0.0; // #ff9900 inner accretion disk
                } else if (dist < eventHorizon * 3.5) {
                  p.color_r = 1.0;
                  p.color_g = 0.8;
                  p.color_b = 0.0; // #ffcc00 outer accretion disk
                } else {
                  p.color_r = p.orig_r;
                  p.color_g = p.orig_g;
                  p.color_b = p.orig_b;
                }
              }
            }
          }
        }

        if (anyCollapsed) {
          let G_sim = (params.gravity * 100000000000.0) * 20.0;
          if (distCenter > 10.0) {
            ax += (dxCenter / distCenter) * (G_sim * 0.01) * params.centerBias;
            ay += (dyCenter / distCenter) * (G_sim * 0.01) * params.centerBias;
          }
        }

        // Active Singularity Attractor
        if (params.attractorActive == 1u) {
          let dxAttr = params.attractorX - p.pos.x;
          let dyAttr = params.attractorY - p.pos.y;
          let distAttr = max(1.0, length(vec2<f32>(dxAttr, dyAttr)));

          if (distAttr < params.gravityRange) {
            var force = (5.0 * (params.gravity * 100000000000.0)) / (distAttr * 0.01 + 1.0);

            if (distAttr > params.gravityRange * 0.8) {
              let rangeFactor = 1.0 - (distAttr - params.gravityRange * 0.8) / (params.gravityRange * 0.2);
              force = force * max(0.0, rangeFactor);
            }

            ax += (dxAttr / distAttr) * force;
            ay += (dyAttr / distAttr) * force;

            // Dark Energy Repulsion for user well (Einstein Cosmological Constant: proportional to distance)
            if (params.darkEnergy > 0.0) {
              let repulsion = params.darkEnergy * distAttr * 0.03;
              ax -= (dxAttr / distAttr) * repulsion;
              ay -= (dyAttr / distAttr) * repulsion;
            }

            // Orbital velocity boost for user well
            if (params.orbitalBoost > 0.0) {
              let tangentialX = -dyAttr / distAttr;
              let tangentialY = dxAttr / distAttr;
              ax += tangentialX * params.orbitalBoost * 1.5;
              ay += tangentialY * params.orbitalBoost * 1.5;
            }
          }
        }

        // Medium specific speculative forces
        if (params.mediumId == 0u) { // Option A: Cosmic Filament
          // Snap particles to tracks
          let spacing: f32 = 40.0;
          let snapX = round(p.pos.x / spacing) * spacing;
          let snapY = round(p.pos.y / spacing) * spacing;

          ax += (snapX - p.pos.x) * 0.05;
          ay += (snapY - p.pos.y) * 0.05;

          // Vibrating transverse wave
          let vibForce = sin(p.phase * (params.frequency * 0.01)) * 0.8;
          ax += cos(p.phase) * vibForce;
          ay += sin(p.phase) * vibForce;

        } else if (params.mediumId == 1u) { // Option B: Volumetric Twist
          // Twisting orbit forces representing vorticity
          let dx = p.pos.x - cx;
          let dy = p.pos.y - cy;
          let dist = max(1.0, length(vec2<f32>(dx, dy)));
          
          if (dist < 300.0) {
            let rotSpeed = (3.0 * params.frequency * 0.5) / (dist * 0.01 + 2.0);
            let targetVx = -dy/dist * rotSpeed;
            let targetVy = dx/dist * rotSpeed;

            ax += (targetVx - p.vel.x) * 0.2;
            ay += (targetVy - p.vel.y) * 0.2;
          }

        } else { // Option C: Standard Relativistic comparison (E=mc²)
          let deBroglie = sin(p.phase * (params.frequency * 0.05)) * 0.1;
          ax += cos(p.phase) * deBroglie;
          ay += sin(p.phase) * deBroglie;
        }

        // Global Cosmological Space Expansion (Hubble's Law: v = H * d)
        if (params.darkEnergy > 0.0) {
          let dxCenterExp = p.pos.x - cx;
          let dyCenterExp = p.pos.y - cy;
          let distCenterExp = max(1.0, length(vec2<f32>(dxCenterExp, dyCenterExp)));
          let hubbleAcceleration = params.darkEnergy * distCenterExp * 0.0003;
          ax += (dxCenterExp / distCenterExp) * hubbleAcceleration;
          ay += (dyCenterExp / distCenterExp) * hubbleAcceleration;
        }

        // Apply velocities and drag
        p.vel.x += ax * params.simSpeed;
        p.vel.y += ay * params.simSpeed;
        p.vel *= pow(1.0 - params.drag, params.simSpeed);

        // Cap speed
        let maxVel = 18.0;
        let velLen = length(p.vel);
        if (velLen > maxVel) {
          p.vel = (p.vel / velLen) * maxVel;
        }

        p.pos += p.vel * params.simSpeed;

        // Periodic border wrap (Toroidal Space)
        if (p.pos.x < 0.0) {
          p.pos.x += params.width;
        } else if (p.pos.x > params.width) {
          p.pos.x -= params.width;
        }
        if (p.pos.y < 0.0) {
          p.pos.y += params.height;
        } else if (p.pos.y > params.height) {
          p.pos.y -= params.height;
        }

        particles[index] = p;
      }

      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) color: vec3<f32>,
      }

      @vertex
      fn renderVertex(@builtin(vertex_index) vertex_index: u32, @builtin(instance_index) instance_index: u32) -> VertexOutput {
        let p = particles[instance_index];

        // Convert coords to clip space (-1 to 1)
        let nx = (p.pos.x / params.width) * 2.0 - 1.0;
        let ny = 1.0 - (p.pos.y / params.height) * 2.0;

        // Build a tiny square billboard for the particle
        var offsets = array<vec2<f32>, 4>(
          vec2<f32>(-1.0, -1.0),
          vec2<f32>(1.0, -1.0),
          vec2<f32>(-1.0, 1.0),
          vec2<f32>(1.0, 1.0)
        );

        let offset = offsets[vertex_index] * (p.size / max(params.width, params.height)) * 4.0;

        var output: VertexOutput;
        output.position = vec4<f32>(nx + offset.x, ny + offset.y, 0.0, 1.0);
        output.color = vec3<f32>(p.color_r, p.color_g, p.color_b);
        return output;
      }

      @fragment
      fn renderFragment(input: VertexOutput) -> @location(0) vec4<f32> {
        // Output clean bright particle
        return vec4<f32>(input.color, 1.0);
      }
    `;

    const shaderModule = this.device.createShaderModule({
      code: shaderSource
    });

    // 2. Setup storage and uniform buffers
    this.uniformBuffer = this.device.createBuffer({
      size: 80, // 20 floats/ints (80 bytes)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.singularityBuffer = this.device.createBuffer({
      size: 512, // 16 slots * 32 bytes (struct size) = 512 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // 3. Setup Pipelines layouts
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          uniform: {}
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX,
          buffer: { type: "storage" }
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          uniform: {}
        }
      ]
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout]
    });

    // 4. Create pipelines
    this.computePipeline = this.device.createComputePipeline({
      layout: pipelineLayout,
      compute: {
        module: shaderModule,
        entryPoint: "computeMain"
      }
    });

    this.renderPipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: "renderVertex"
      },
      fragment: {
        module: shaderModule,
        entryPoint: "renderFragment",
        targets: [{ format: presentationFormat }]
      },
      primitive: {
        topology: "triangle-strip",
        stripIndexFormat: undefined
      }
    });

    this.bindGroupLayout = bindGroupLayout;
  }

  // Bind the current CPU simulation's particles to the GPU Buffer
  syncParticlesToGPU(simParticles) {
    if (!this.isReady) return;

    const count = simParticles.length;
    const stride = 12; // 12 floats per Particle struct (48 bytes)
    const data = new Float32Array(count * stride);

    for (let i = 0; i < count; i++) {
      const p = simParticles[i];
      const offset = i * stride;

      data[offset + 0] = p.x;
      data[offset + 1] = p.y;
      data[offset + 2] = p.vx;
      data[offset + 3] = p.vy;

      // Extract raw RGB from hexadecimal colors
      const colorHex = p.color;
      let r = 0.0, g = 1.0, b = 0.4;
      if (colorHex.startsWith('#')) {
        r = parseInt(colorHex.slice(1, 3), 16) / 255;
        g = parseInt(colorHex.slice(3, 5), 16) / 255;
        b = parseInt(colorHex.slice(5, 7), 16) / 255;
      }

      data[offset + 4] = r; // orig_r
      data[offset + 5] = g; // orig_g
      data[offset + 6] = p.phase;
      data[offset + 7] = p.size;
      data[offset + 8] = r; // color_r
      data[offset + 9] = g; // color_g
      data[offset + 10] = b; // color_b
      data[offset + 11] = b; // orig_b
    }

    this.particleBuffer = this.device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
      mappedAtCreation: true
    });

    new Float32Array(this.particleBuffer.getMappedRange()).set(data);
    this.particleBuffer.unmap();

    // Create bind group
    this.bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.particleBuffer } },
        { binding: 2, resource: { buffer: this.singularityBuffer } }
      ]
    });
  }

  // Dispatch WebGPU compute pass & render pass
  drawFrame(sim) {
    if (!this.isReady || !this.bindGroup) return;

    // 1. Map medium letter key to integer ID for the shader
    let mediumInt = 0;
    if (sim.mediumId === 'B') mediumInt = 1;
    else if (sim.mediumId === 'C') mediumInt = 2;

    const frequency = sim.frequency;

    // 2. Update uniform values on the GPU
    const uniformData = new ArrayBuffer(80);
    const viewF32 = new Float32Array(uniformData);
    const viewU32 = new Uint32Array(uniformData);

    viewF32[0] = sim.mass;
    viewF32[1] = sim.c;
    viewF32[2] = sim.h;
    viewF32[3] = sim.gravity;
    viewF32[4] = sim.drag;
    viewF32[5] = frequency;
    viewU32[6] = sim.particles.length;
    viewF32[7] = sim.time;
    viewU32[8] = sim.attractor.active ? 1 : 0;
    viewF32[9] = sim.attractor.x;
    viewF32[10] = sim.attractor.y;
    viewU32[11] = mediumInt;
    viewF32[12] = sim.width;
    viewF32[13] = sim.height;
    viewF32[14] = sim.simSpeed;
    viewF32[15] = sim.darkEnergy;
    viewF32[16] = sim.orbitalBoost;
    viewF32[17] = sim.gravityRange;
    viewF32[18] = sim.initialAngularVelocity || 0.0;
    viewF32[19] = sim.centerBias !== undefined ? sim.centerBias : 1.0;

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

    // Update dynamic singularities on the GPU
    const singData = new ArrayBuffer(512);
    const singViewF32 = new Float32Array(singData);
    const singViewU32 = new Uint32Array(singData);

    const activeObjects = sim.collapsedObjects || [];
    for (let i = 0; i < 16; i++) {
      const obj = activeObjects[i];
      const offset = i * 8; // 8 floats/ints per struct = 32 bytes
      
      if (obj && obj.active !== false) {
        singViewF32[offset + 0] = obj.x;
        singViewF32[offset + 1] = obj.y;
        singViewF32[offset + 2] = obj.mass;
        singViewF32[offset + 3] = obj.radius;
        singViewU32[offset + 4] = 1; // active
        singViewF32[offset + 5] = obj.angularVelocity || 0.0;
        singViewF32[offset + 6] = 0.0;
        singViewF32[offset + 7] = 0.0;
      } else {
        singViewF32[offset + 0] = 0.0;
        singViewF32[offset + 1] = 0.0;
        singViewF32[offset + 2] = 0.0;
        singViewF32[offset + 3] = 0.0;
        singViewU32[offset + 4] = 0; // inactive
        singViewU32[offset + 5] = 0;
        singViewU32[offset + 6] = 0;
        singViewU32[offset + 7] = 0;
      }
    }
    this.device.queue.writeBuffer(this.singularityBuffer, 0, singData);

    // 3. Encode GPU Commands
    const commandEncoder = this.device.createCommandEncoder();

    // Compute Shader Dispatch
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(this.computePipeline);
    computePass.setBindGroup(0, this.bindGroup);
    const workgroups = Math.ceil(sim.particles.length / 64);
    computePass.dispatchWorkgroups(workgroups);
    computePass.end();

    // Render Shader Pass
    const renderPassDescriptor = {
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0.01, g: 0.01, b: 0.02, a: 1.0 },
          loadOp: "clear",
          storeOp: "store"
        }
      ]
    };

    const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    // Draw 4 vertices per instance (to make the tiny billboards)
    renderPass.draw(4, sim.particles.length, 0, 0);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }
}
