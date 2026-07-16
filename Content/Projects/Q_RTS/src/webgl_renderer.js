// WebGL Spacetime Fabric Renderer
// Accelerates the rendering of grid distortions, gaseous storm nebulae,
// and cosmic starfields with dynamic gravitational lensing entirely on the GPU.

export class WebglRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { alpha: false, depth: false, antialias: true });
    
    if (!this.gl) {
      console.error('WebGL is not supported in this browser environment.');
      return;
    }

    const gl = this.gl;
    
    // Enable blending for transparent glowing elements (like grid lines and stars)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.shaders = {};
    this.buffers = {};
    this.starfield = [];
    
    this.initShaders();
    this.initBuffers();
    this.generateStarfield(1500);
  }

  // Helper to compile a WebGL Shader
  compileShader(source, type) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Error compiling shader:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  // Create a full WebGL program
  createProgram(vertexSource, fragmentSource) {
    const gl = this.gl;
    const vs = this.compileShader(vertexSource, gl.VERTEX_SHADER);
    const fs = this.compileShader(fragmentSource, gl.FRAGMENT_SHADER);
    const program = gl.createProgram();
    
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Error linking program:', gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }

  // Initialise shaders for background nebulae, the coordinate grid, and lensing stars
  initShaders() {
    const gl = this.gl;

    // 1. NEBULAE BACKGROUND SHADER (Noise & Weather gas)
    const vsNebulae = `
      attribute vec2 a_quadPos;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_quadPos, 0.0, 1.0);
        v_texCoord = a_quadPos * 0.5 + 0.5;
      }
    `;

    const fsNebulae = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform vec2 u_resolution;
      uniform vec2 u_camera;
      uniform float u_zoom;
      uniform float u_time;
      uniform vec4 u_weatherClouds[8];
      uniform vec3 u_cloudColors[8];
      uniform int u_cloudCount;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                   mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
      }

      void main() {
        vec2 center = u_resolution / 2.0;
        vec2 screenPos = gl_FragCoord.xy;
        screenPos.y = u_resolution.y - screenPos.y; // Correct Y orientation
        vec2 worldPos = u_camera + (screenPos - center) / u_zoom + center;

        // Base cosmic deep vacuum dark purple/blue
        vec3 finalColor = vec3(0.012, 0.012, 0.02);

        // Add gaseous storm clouds
        for (int i = 0; i < 8; i++) {
          if (i >= 8) break; // Static limit safety
          // Uniform array bounds safety check
          vec4 cloud = u_weatherClouds[i];
          if (cloud.w <= 0.0) continue;

          vec2 cPos = cloud.xy;
          float radius = cloud.z;
          float intensity = cloud.w;
          vec3 color = u_cloudColors[i];

          float dist = length(worldPos - cPos);
          if (dist < radius * 3.0) {
            float factor = 1.0 - (dist / (radius * 3.0));
            factor = clamp(factor, 0.0, 1.0);
            factor = pow(factor, 1.8);

            vec2 noiseCoord = worldPos * 0.0035 + vec2(u_time * 0.03, -u_time * 0.02);
            float n = noise(noiseCoord) * 0.45 + noise(noiseCoord * 2.2 + vec2(0.0, u_time * 0.06)) * 0.25;

            finalColor += color * (factor * (0.2 + n * 0.8) * intensity * 0.55);
          }
        }

        // Ambient dark stardust background noise texture
        vec2 cosmicNoiseCoord = worldPos * 0.0006;
        float dust = noise(cosmicNoiseCoord) * 0.06;
        finalColor += vec3(dust * 0.5, dust * 0.3, dust * 0.7);

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    this.shaders.nebulae = {
      program: this.createProgram(vsNebulae, fsNebulae),
      attribs: {},
      uniforms: {}
    };

    // 2. GRID LINES SHADER
    const vsGrid = `
      attribute vec2 a_position;
      attribute vec4 a_color;
      uniform vec2 u_resolution;
      uniform vec2 u_camera;
      uniform float u_zoom;
      varying vec4 v_color;
      void main() {
        vec2 screenPos = a_position - u_camera;
        vec2 center = u_resolution / 2.0;
        vec2 pos = (screenPos - center) * u_zoom + center;
        vec2 clipPos = (pos / u_resolution) * 2.0 - 1.0;
        gl_Position = vec4(clipPos.x, -clipPos.y, 0.0, 1.0);
        v_color = a_color;
      }
    `;

    const fsGrid = `
      precision mediump float;
      varying vec4 v_color;
      void main() {
        gl_FragColor = v_color;
      }
    `;

    this.shaders.grid = {
      program: this.createProgram(vsGrid, fsGrid),
      attribs: {},
      uniforms: {}
    };

    // 3. LENSING STARS SHADER
    const vsStars = `
      attribute vec2 a_starPos;
      attribute float a_brightness;
      uniform vec2 u_resolution;
      uniform vec2 u_camera;
      uniform float u_zoom;
      uniform float u_time;
      uniform vec4 u_gravSources[16];
      uniform int u_gravCount;
      varying float v_brightness;
      varying float v_fade;

      void main() {
        vec2 pos = a_starPos;
        
        // Minor background celestial drift
        pos.x += sin(u_time * 0.04 + a_starPos.y * 0.002) * 4.0;
        pos.y += cos(u_time * 0.04 + a_starPos.x * 0.002) * 4.0;

        // Apply dynamic Gravitational Lensing! Bends light vectors around intense black hole wells
        for (int i = 0; i < 16; i++) {
          if (i >= 16) break;
          vec4 source = u_gravSources[i];
          if (source.z <= 0.0) continue;

          vec2 gPos = source.xy;
          float mass = source.z;
          float range = source.w;

          vec2 d = pos - gPos;
          float dist = length(d);
          if (dist < range && dist > 2.0) {
            float rangeFactor = (range - dist) / range;
            // Radial light distortion sag pull
            float pull = (mass * 16.0 * rangeFactor) / (dist * 0.015 + 5.0);
            pos -= normalize(d) * pull;
          }
        }

        vec2 screenPos = pos - u_camera;
        vec2 center = u_resolution / 2.0;
        vec2 zoomedPos = (screenPos - center) * u_zoom + center;
        vec2 clipPos = (zoomedPos / u_resolution) * 2.0 - 1.0;

        gl_Position = vec4(clipPos.x, -clipPos.y, 0.0, 1.0);
        gl_PointSize = (1.5 + a_brightness * 2.5) * (u_zoom * 0.4 + 0.6);
        v_brightness = a_brightness;
        v_fade = 0.6 + 0.4 * sin(u_time * 1.5 + a_starPos.x * 0.1);
      }
    `;

    const fsStars = `
      precision mediump float;
      varying float v_brightness;
      varying float v_fade;
      void main() {
        // Draw starry circular neon particles
        vec2 coord = gl_PointCoord - vec2(0.5);
        if (length(coord) > 0.5) discard;
        
        float alpha = (1.0 - length(coord) * 2.0) * v_fade;
        vec3 starColor = vec3(0.85, 0.95, 1.0); // Bright celestial light blue
        
        gl_FragColor = vec4(starColor * v_brightness, alpha);
      }
    `;

    this.shaders.stars = {
      program: this.createProgram(vsStars, fsStars),
      attribs: {},
      uniforms: {}
    };

    // Cache attributes and uniforms coordinates
    for (const key in this.shaders) {
      const p = this.shaders[key].program;
      if (!p) continue;
      
      const pObj = this.shaders[key];
      
      // Get all active uniforms
      const numUniforms = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < numUniforms; i++) {
        const info = gl.getActiveUniform(p, i);
        pObj.uniforms[info.name] = gl.getUniformLocation(p, info.name);
      }

      // Get all active attributes
      const numAttribs = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
      for (let i = 0; i < numAttribs; i++) {
        const info = gl.getActiveAttrib(p, i);
        pObj.attribs[info.name] = gl.getAttribLocation(p, info.name);
      }
    }
  }

  // Pre-allocate WebGL Vertex Buffers for pipeline
  initBuffers() {
    const gl = this.gl;
    if (!gl) return;

    this.buffers.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0
    ]), gl.STATIC_DRAW);

    this.buffers.grid = gl.createBuffer();
    this.buffers.stars = gl.createBuffer();
  }

  // Static infinite star positions generated around origin coordinates
  generateStarfield(count) {
    const data = [];
    for (let i = 0; i < count; i++) {
      // Wide grid spreading stars over active sectors
      const worldX = (Math.random() - 0.5) * 8000;
      const worldY = (Math.random() - 0.5) * 8000;
      const brightness = 0.2 + Math.random() * 0.8;
      
      data.push(worldX, worldY, brightness);
    }
    this.starfieldData = new Float32Array(data);

    const gl = this.gl;
    if (gl) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.stars);
      gl.bufferData(gl.ARRAY_BUFFER, this.starfieldData, gl.STATIC_DRAW);
    }
  }

  // Bind WebGL canvas size to container matching 2D canvas size
  resize(width, height) {
    if (!this.gl) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  // Core update and draw pipeline: transfers CPU simulations coordinates
  // and renders the high-fidelity space-time canvas backplate
  updateAndRender(sim, ignoreGrid = false) {
    const gl = this.gl;
    if (!gl) return;

    // Clear WebGL color buffers
    gl.clearColor(0.01, 0.01, 0.015, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const width = this.canvas.width;
    const height = this.canvas.height;
    const camX = sim.camera.x;
    const camY = sim.camera.y;
    const zoom = sim.camera.zoom || 1.0;
    const time = sim.time;

    // 1. RENDER BACKGROUND NEBULAE GAS
    this.renderNebulae(gl, width, height, camX, camY, zoom, time, sim);

    // 2. RENDER THE GRAVITATIONAL LENSING CELESTIAL STARFIELD
    this.renderStars(gl, width, height, camX, camY, zoom, time, sim);

    // 3. RENDER THE COORDINATE FABRIC GRID
    if (!ignoreGrid) {
      this.renderGrid(gl, width, height, camX, camY, zoom, sim);
    }
  }

  // Renders beautiful shader-based nebulae conforming to stormy storm centers
  renderNebulae(gl, width, height, camX, camY, zoom, time, sim) {
    const sh = this.shaders.nebulae;
    if (!sh || !sh.program) return;

    gl.useProgram(sh.program);

    // Pass standard variables
    gl.uniform2f(sh.uniforms['u_resolution'], width, height);
    gl.uniform2f(sh.uniforms['u_camera'], camX, camY);
    gl.uniform1f(sh.uniforms['u_zoom'], zoom);
    gl.uniform1f(sh.uniforms['u_time'], time);

    // Gather weather cloud storm centers in viewport proximity
    const clouds = sim.weatherClouds || [];
    const maxClouds = 8;
    const cloudArray = new Float32Array(maxClouds * 4);
    const colorArray = new Float32Array(maxClouds * 3);
    let count = 0;

    for (let i = 0; i < clouds.length; i++) {
      if (count >= maxClouds) break;
      const c = clouds[i];
      if (c.intensity > 0.01) {
        const idx = count * 4;
        cloudArray[idx] = c.x;
        cloudArray[idx + 1] = c.y;
        cloudArray[idx + 2] = c.radius;
        cloudArray[idx + 3] = c.intensity;

        // Parse hex color string to float vector RGB
        let r = 0.0, g = 0.5, b = 1.0; // default blue
        if (c.color) {
          const hex = c.color.replace('#', '');
          if (hex.length === 6) {
            r = parseInt(hex.substr(0, 2), 16) / 255;
            g = parseInt(hex.substr(2, 2), 16) / 255;
            b = parseInt(hex.substr(4, 2), 16) / 255;
          }
        }
        const cIdx = count * 3;
        colorArray[cIdx] = r;
        colorArray[cIdx + 1] = g;
        colorArray[cIdx + 2] = b;

        count++;
      }
    }

    gl.uniform1i(sh.uniforms['u_cloudCount'], count);
    if (count > 0) {
      gl.uniform4fv(sh.uniforms['u_weatherClouds[0]'], cloudArray);
      gl.uniform3fv(sh.uniforms['u_cloudColors[0]'], colorArray);
    }

    // Draw full-screen quad background plate
    const posAttrib = sh.attribs['a_quadPos'];
    gl.enableVertexAttribArray(posAttrib);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.quad);
    gl.vertexAttribPointer(posAttrib, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disableVertexAttribArray(posAttrib);
  }

  // Renders dynamic stars subjected to gravitational lens calculations
  renderStars(gl, width, height, camX, camY, zoom, time, sim) {
    const sh = this.shaders.stars;
    if (!sh || !sh.program) return;

    gl.useProgram(sh.program);

    gl.uniform2f(sh.uniforms['u_resolution'], width, height);
    gl.uniform2f(sh.uniforms['u_camera'], camX, camY);
    gl.uniform1f(sh.uniforms['u_zoom'], zoom);
    gl.uniform1f(sh.uniforms['u_time'], time);

    // Extract gravity sources that bend light paths (e.g. black holes and warp anomalies)
    const gravitySources = [];
    
    // Add black holes
    if (sim.blackHoles) {
      sim.blackHoles.forEach(bh => {
        gravitySources.push({ x: bh.x, y: bh.y, mass: bh.mass || 350, range: bh.gravityRange || 400 });
      });
    }

    // Add vortices
    if (sim.vortices) {
      sim.vortices.forEach(v => {
        gravitySources.push({ x: v.x, y: v.y, mass: 180 * v.foldingProgress, range: v.gravityRange || 300 });
      });
    }

    // Add massive flagship carrier or dreadnoughts
    if (sim.ships) {
      sim.ships.forEach(s => {
        if (s.type === 'carrier' || s.type === 'dreadnought') {
          gravitySources.push({ x: s.x, y: s.y, mass: (s.mass || 100) * 0.4, range: s.gravityRange || 200 });
        }
      });
    }

    const maxSources = 16;
    const gravArray = new Float32Array(maxSources * 4);
    let gCount = 0;

    for (let i = 0; i < gravitySources.length; i++) {
      if (gCount >= maxSources) break;
      const src = gravitySources[i];
      const idx = gCount * 4;
      gravArray[idx] = src.x;
      gravArray[idx + 1] = src.y;
      gravArray[idx + 2] = src.mass;
      gravArray[idx + 3] = src.range;
      gCount++;
    }

    gl.uniform1i(sh.uniforms['u_gravCount'], gCount);
    if (gCount > 0) {
      gl.uniform4fv(sh.uniforms['u_gravSources[0]'], gravArray);
    }

    // Draw the particle starfield buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.stars);
    
    const posAttrib = sh.attribs['a_starPos'];
    gl.enableVertexAttribArray(posAttrib);
    gl.vertexAttribPointer(posAttrib, 2, gl.FLOAT, false, 3 * Float32Array.BYTES_PER_ELEMENT, 0);

    const brightnessAttrib = sh.attribs['a_brightness'];
    gl.enableVertexAttribArray(brightnessAttrib);
    gl.vertexAttribPointer(brightnessAttrib, 1, gl.FLOAT, false, 3 * Float32Array.BYTES_PER_ELEMENT, 2 * Float32Array.BYTES_PER_ELEMENT);

    gl.drawArrays(gl.POINTS, 0, this.starfieldData.length / 3);

    gl.disableVertexAttribArray(posAttrib);
    gl.disableVertexAttribArray(brightnessAttrib);
  }

  // Renders the glowing biome-coloured coordinate grid lines
  renderGrid(gl, width, height, camX, camY, zoom, sim) {
    const sh = this.shaders.grid;
    if (!sh || !sh.program) return;

    // Check if gridNodes are initialized on simulation
    if (!sim.gridNodes || sim.gridNodes.length === 0) return;

    const cols = sim.gridCols;
    const rows = sim.gridRows;

    // We build a single dynamic buffer containing all grid lines to draw in a single call!
    // Vertices needed: (cols * (rows - 1) + rows * (cols - 1)) * 2
    // Each vertex has: x (float), y (float), r (float), g (float), b (float), a (float) = 6 floats
    const maxVertices = (cols * rows * 2) * 2;
    const gridData = new Float32Array(maxVertices * 6);
    let offset = 0;

    const REGIONS = sim.REGIONS || [
      { index: 0, color: '#ff1133' },
      { index: 1, color: '#ff33ff' },
      { index: 2, color: '#00e5ff' }
    ];

    // Helper to extract rgba from hex / CSS color
    const hexColorCache = {};
    const parseColor = (colStr, alpha = 1.0) => {
      const cacheKey = `${colStr}||${alpha.toFixed(2)}`;
      if (hexColorCache[cacheKey]) return hexColorCache[cacheKey];

      let r = 0.0, g = 0.8, b = 1.0, a = alpha;

      if (colStr.startsWith('rgba')) {
        const parts = colStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (parts) {
          r = parseInt(parts[1]) / 255;
          g = parseInt(parts[2]) / 255;
          b = parseInt(parts[3]) / 255;
          a = parts[4] !== undefined ? parseFloat(parts[4]) * alpha : alpha;
        }
      } else {
        const hex = colStr.replace('#', '');
        if (hex.length === 6) {
          r = parseInt(hex.substr(0, 2), 16) / 255;
          g = parseInt(hex.substr(2, 2), 16) / 255;
          b = parseInt(hex.substr(4, 2), 16) / 255;
        }
      }

      const res = [r, g, b, a];
      hexColorCache[cacheKey] = res;
      return res;
    };

    const addSegment = (n1, n2) => {
      // Space Tear grid line culling - pre-filter inside tears
      let insideTear = false;
      if (sim.spaceTears && sim.spaceTears.length > 0) {
        for (let i = 0; i < sim.spaceTears.length; i++) {
          const tear = sim.spaceTears[i];
          const dx1 = n1.worldX - tear.x;
          const dy1 = n1.worldY - tear.y;
          const dx2 = n2.worldX - tear.x;
          const dy2 = n2.worldY - tear.y;
          const rSq = tear.radius * tear.radius;
          if (dx1 * dx1 + dy1 * dy1 < rSq || dx2 * dx2 + dy2 * dy2 < rSq) {
            insideTear = true;
            break;
          }
        }
      }
      if (insideTear) return;

      const biome = n1.biome;
      if (!biome) return;

      const isRevealed = n1.isRevealed;
      const region1 = n1.region || REGIONS[0];
      const region2 = n2.region || REGIONS[0];
      const isBorder = (region1.index !== region2.index);

      let strokeColorStr = sim.blendBiomeAndRegion(biome.gridColor, region1.color, isRevealed);
      let strokeAlpha = isRevealed ? 0.35 : 0.08;
      
      if (isRevealed && isBorder) {
        strokeAlpha = 0.7;
        strokeColorStr = region1.color; // Vibrant region borders
      }

      // Add storm lighting weight glow
      let stormColorStr = n1.stormColor;
      let stormWeight = n1.stormWeight || 0.0;
      
      const [r1, g1, b1, a1] = parseColor(strokeColorStr, strokeAlpha);
      
      let fr1 = r1, fg1 = g1, fb1 = b1, fa1 = a1;
      if (stormColorStr && stormWeight > 0.05) {
        const [sr, sg, sb, sa] = parseColor(stormColorStr, stormWeight * 0.8);
        fr1 = mix(r1, sr, stormWeight);
        fg1 = mix(g1, sg, stormWeight);
        fb1 = mix(b1, sb, stormWeight);
        fa1 = mix(a1, sa, stormWeight);
      }

      // Vertex 1
      gridData[offset++] = n1.worldX;
      gridData[offset++] = n1.worldY;
      gridData[offset++] = fr1;
      gridData[offset++] = fg1;
      gridData[offset++] = fb1;
      gridData[offset++] = fa1;

      // Vertex 2
      gridData[offset++] = n2.worldX;
      gridData[offset++] = n2.worldY;
      gridData[offset++] = fr1;
      gridData[offset++] = fg1;
      gridData[offset++] = fb1;
      gridData[offset++] = fa1;
    };

    function mix(val1, val2, ratio) {
      return val1 + (val2 - val1) * ratio;
    }

    // 1. Column lines
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows - 1; r++) {
        const idx1 = c * rows + r;
        const idx2 = c * rows + (r + 1);
        const n1 = sim.gridNodes[idx1];
        const n2 = sim.gridNodes[idx2];
        if (n1 && n2) {
          addSegment(n1, n2);
        }
      }
    }

    // 2. Row lines
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const idx1 = c * rows + r;
        const idx2 = (c + 1) * rows + r;
        const n1 = sim.gridNodes[idx1];
        const n2 = sim.gridNodes[idx2];
        if (n1 && n2) {
          addSegment(n1, n2);
        }
      }
    }

    if (offset === 0) return;

    gl.useProgram(sh.program);

    gl.uniform2f(sh.uniforms['u_resolution'], width, height);
    gl.uniform2f(sh.uniforms['u_camera'], camX, camY);
    gl.uniform1f(sh.uniforms['u_zoom'], zoom);

    // Upload vertices
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.grid);
    gl.bufferData(gl.ARRAY_BUFFER, gridData.subarray(0, offset), gl.DYNAMIC_DRAW);

    // Setup attributes
    const stride = 6 * Float32Array.BYTES_PER_ELEMENT;
    
    const posAttrib = sh.attribs['a_position'];
    gl.enableVertexAttribArray(posAttrib);
    gl.vertexAttribPointer(posAttrib, 2, gl.FLOAT, false, stride, 0);

    const colAttrib = sh.attribs['a_color'];
    gl.enableVertexAttribArray(colAttrib);
    gl.vertexAttribPointer(colAttrib, 4, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);

    // Draw lines
    gl.drawArrays(gl.LINES, 0, offset / 6);

    gl.disableVertexAttribArray(posAttrib);
    gl.disableVertexAttribArray(colAttrib);
  }

  // Initialise resources for Conquest RTS mode dynamically on-demand
  initConquest() {
    if (this.conquestInitialized) return;
    const gl = this.gl;
    if (!gl) return;

    // 1. CONQUEST MAP SHADER (Textured quad representing the entire generated RTS terrain)
    const vsMap = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      uniform vec2 u_resolution;
      uniform vec2 u_camera;
      uniform float u_zoom;
      uniform vec2 u_mapSize;
      void main() {
        vec2 screenPos = a_position - u_camera;
        vec2 center = u_resolution / 2.0;
        vec2 pos = (screenPos - center) * u_zoom + center;
        vec2 clipPos = (pos / u_resolution) * 2.0 - 1.0;
        gl_Position = vec4(clipPos.x, -clipPos.y, 0.0, 1.0);
        v_texCoord = a_position / u_mapSize;
      }
    `;

    const fsMap = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_texture;
      void main() {
        gl_FragColor = texture2D(u_texture, v_texCoord);
      }
    `;

    this.shaders.conquestMap = {
      program: this.createProgram(vsMap, fsMap),
      attribs: {},
      uniforms: {}
    };

    // 2. CONQUEST GEOMETRY SHADER (High performance filled triangles for rts ships, turrets, and structures)
    const vsGeom = `
      attribute vec2 a_position;
      attribute vec4 a_color;
      uniform vec2 u_resolution;
      uniform vec2 u_camera;
      uniform float u_zoom;
      varying vec4 v_color;
      void main() {
        vec2 screenPos = a_position - u_camera;
        vec2 center = u_resolution / 2.0;
        vec2 pos = (screenPos - center) * u_zoom + center;
        vec2 clipPos = (pos / u_resolution) * 2.0 - 1.0;
        gl_Position = vec4(clipPos.x, -clipPos.y, 0.0, 1.0);
        v_color = a_color;
      }
    `;

    const fsGeom = `
      precision mediump float;
      varying vec4 v_color;
      void main() {
        gl_FragColor = v_color;
      }
    `;

    this.shaders.conquestGeom = {
      program: this.createProgram(vsGeom, fsGeom),
      attribs: {},
      uniforms: {}
    };

    // 3. CONQUEST POINTS SHADER (Circular particles and high-velocity projectile rounds)
    const vsPoints = `
      attribute vec2 a_position;
      attribute vec4 a_color;
      attribute float a_size;
      uniform vec2 u_resolution;
      uniform vec2 u_camera;
      uniform float u_zoom;
      varying vec4 v_color;
      void main() {
        vec2 screenPos = a_position - u_camera;
        vec2 center = u_resolution / 2.0;
        vec2 pos = (screenPos - center) * u_zoom + center;
        vec2 clipPos = (pos / u_resolution) * 2.0 - 1.0;
        gl_Position = vec4(clipPos.x, -clipPos.y, 0.0, 1.0);
        gl_PointSize = a_size * u_zoom;
        v_color = a_color;
      }
    `;

    const fsPoints = `
      precision mediump float;
      varying vec4 v_color;
      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        if (length(coord) > 0.5) discard;
        float alpha = (1.0 - length(coord) * 2.0) * v_color.a;
        gl_FragColor = vec4(v_color.rgb, alpha);
      }
    `;

    this.shaders.conquestPoints = {
      program: this.createProgram(vsPoints, fsPoints),
      attribs: {},
      uniforms: {}
    };

    // Dynamically retrieve and map all uniforms and attributes coordinates for conquest shaders
    const shaderKeys = ['conquestMap', 'conquestGeom', 'conquestPoints'];
    shaderKeys.forEach(key => {
      const p = this.shaders[key].program;
      if (!p) return;
      const pObj = this.shaders[key];
      
      const numUniforms = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < numUniforms; i++) {
        const info = gl.getActiveUniform(p, i);
        pObj.uniforms[info.name] = gl.getUniformLocation(p, info.name);
      }

      const numAttribs = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
      for (let i = 0; i < numAttribs; i++) {
        const info = gl.getActiveAttrib(p, i);
        pObj.attribs[info.name] = gl.getAttribLocation(p, info.name);
      }
    });

    // Allocate WebGL Vertex Buffers for conquest pipeline
    this.buffers.conquestQuad = gl.createBuffer();
    this.buffers.conquestTriangles = gl.createBuffer();
    this.buffers.conquestPoints = gl.createBuffer();
    this.buffers.conquestLines = gl.createBuffer();

    this.mapTexture = null;
    this.mapSize = { width: 0, height: 0 };
    this.conquestInitialized = true;
  }

  // Upload off-screen generated RTS procedural terrain canvas to GPU as high-res 2D texture
  setConquestMap(width, height, mapCanvas) {
    this.initConquest();
    const gl = this.gl;
    if (!gl) return;

    this.mapSize = { width, height };

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.conquestQuad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 0,
      width, 0,
      0, height,
      0, height,
      width, 0,
      width, height
    ]), gl.STATIC_DRAW);

    if (this.mapTexture) {
      gl.deleteTexture(this.mapTexture);
    }

    this.mapTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.mapTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mapCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }

  // Core WebGL Draw Pipeline for Conquest Battle Mode. Takes ConquestBattle simulation state.
  renderConquest(cb) {
    const gl = this.gl;
    if (!gl || !this.conquestInitialized) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const camX = cb.camera.x;
    const camY = cb.camera.y;
    const zoom = cb.camera.zoom;

    // 1. Clear WebGL to deep black
    gl.viewport(0, 0, width, height);
    gl.clearColor(0.004, 0.008, 0.015, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 2. Draw procedural map background texture
    if (this.mapTexture && this.mapSize.width > 0) {
      const sh = this.shaders.conquestMap;
      gl.useProgram(sh.program);

      gl.uniform2f(sh.uniforms['u_resolution'], width, height);
      gl.uniform2f(sh.uniforms['u_camera'], camX, camY);
      gl.uniform1f(sh.uniforms['u_zoom'], zoom);
      gl.uniform2f(sh.uniforms['u_mapSize'], this.mapSize.width, this.mapSize.height);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.mapTexture);
      gl.uniform1i(sh.uniforms['u_texture'], 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.conquestQuad);
      const posAttrib = sh.attribs['a_position'];
      gl.enableVertexAttribArray(posAttrib);
      gl.vertexAttribPointer(posAttrib, 2, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disableVertexAttribArray(posAttrib);
    }

    // Help helper function to parse colors
    const parseColor = (hexStr) => {
      if (!hexStr) return [1, 1, 1, 1];
      if (hexStr.startsWith('rgba')) {
        const parts = hexStr.match(/[\d\.]+/g);
        if (parts) {
          return [
            parseFloat(parts[0]) / 255,
            parseFloat(parts[1]) / 255,
            parseFloat(parts[2]) / 255,
            parts[3] ? parseFloat(parts[3]) : 1.0
          ];
        }
      }
      let hex = hexStr.replace('#', '');
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      return [r, g, b, 1.0];
    };

    // Create batches for filled triangles
    let triOffset = 0;
    const triData = new Float32Array(150000); // Massive batch buffer: 25000 vertices * 6 items

    const addTriangle = (x1, y1, x2, y2, x3, y3, r, g, b, a) => {
      if (triOffset + 18 > triData.length) return;
      triData[triOffset++] = x1; triData[triOffset++] = y1; triData[triOffset++] = r; triData[triOffset++] = g; triData[triOffset++] = b; triData[triOffset++] = a;
      triData[triOffset++] = x2; triData[triOffset++] = y2; triData[triOffset++] = r; triData[triOffset++] = g; triData[triOffset++] = b; triData[triOffset++] = a;
      triData[triOffset++] = x3; triData[triOffset++] = y3; triData[triOffset++] = r; triData[triOffset++] = g; triData[triOffset++] = b; triData[triOffset++] = a;
    };

    const addRotatedTriangle = (tx, ty, angle, lx1, ly1, lx2, ly2, lx3, ly3, r, g, b, a) => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const x1 = tx + lx1 * cos - ly1 * sin;
      const y1 = ty + lx1 * sin + ly1 * cos;
      const x2 = tx + lx2 * cos - ly2 * sin;
      const y2 = ty + lx2 * sin + ly2 * cos;
      const x3 = tx + lx3 * cos - ly3 * sin;
      const y3 = ty + lx3 * sin + ly3 * cos;
      addTriangle(x1, y1, x2, y2, x3, y3, r, g, b, a);
    };

    const addRotatedRect = (tx, ty, angle, w, h, r, g, b, a) => {
      const hw = w / 2;
      const hh = h / 2;
      addRotatedTriangle(tx, ty, angle, -hw, -hh, hw, -hh, -hw, hh, r, g, b, a);
      addRotatedTriangle(tx, ty, angle, hw, -hh, hw, hh, -hw, hh, r, g, b, a);
    };

    const addCircleTriangles = (cx, cy, radius, r, g, b, a, segments = 8) => {
      const step = (Math.PI * 2) / segments;
      for (let i = 0; i < segments; i++) {
        const a1 = i * step;
        const a2 = (i + 1) * step;
        addTriangle(
          cx, cy,
          cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius,
          cx + Math.cos(a2) * radius, cy + Math.sin(a2) * radius,
          r, g, b, a
        );
      }
    };

    // 3. Collect and Batch Player Units
    cb.playerUnits.forEach(u => {
      // Screen-space viewport culling
      const sX = width/2 + (u.x - camX - width/2) * zoom;
      const sY = height/2 + (u.y - camY - height/2) * zoom;
      if (sX < -50 || sX > width + 50 || sY < -50 || sY > height + 50) return;

      let col = [0.0, 1.0, 0.4, 1.0];
      if (u.type === 'gatherer') {
        col = u.cargo > 0 ? [1.0, 0.66, 0.0, 1.0] : [0.0, 1.0, 1.0, 1.0];
      } else if (u.type === 'tank') {
        col = [1.0, 0.7, 0.0, 1.0];
      } else if (u.type === 'gunship') {
        col = [0.9, 0.2, 1.0, 1.0];
      }
      const r = col[0], g = col[1], b = col[2], a = col[3];

      if (u.type === 'gatherer') {
        const dr = r * 0.08, dg = g * 0.08, db = b * 0.08;
        const s = 0.72;
        // High fidelity diamond scarab with dual wing nodes (Outer)
        addRotatedTriangle(u.x, u.y, u.angle, u.radius * 1.2, 0, -u.radius * 0.5, -u.radius * 0.6, -u.radius * 0.6, 0, r, g, b, a);
        addRotatedTriangle(u.x, u.y, u.angle, u.radius * 1.2, 0, -u.radius * 0.6, 0, -u.radius * 0.6, u.radius * 0.6, r, g, b, a);
        // Inner darker block
        addRotatedTriangle(u.x, u.y, u.angle, u.radius * 1.2 * s, 0, -u.radius * 0.5 * s, -u.radius * 0.6 * s, -u.radius * 0.6 * s, 0, dr, dg, db, a);
        addRotatedTriangle(u.x, u.y, u.angle, u.radius * 1.2 * s, 0, -u.radius * 0.6 * s, 0, -u.radius * 0.6 * s, u.radius * 0.6 * s, dr, dg, db, a);
      } else if (u.type === 'raider') {
        const dr = r * 0.08, dg = g * 0.08, db = b * 0.08;
        const s = 0.72;
        // Delta wing fighter (Outer)
        addRotatedTriangle(u.x, u.y, u.angle, u.radius * 1.2, 0, -u.radius * 0.8, -u.radius * 0.8, -u.radius * 0.4, 0, r, g, b, a);
        addRotatedTriangle(u.x, u.y, u.angle, u.radius * 1.2, 0, -u.radius * 0.4, 0, -u.radius * 0.8, u.radius * 0.8, r, g, b, a);
        // Inner darker block
        addRotatedTriangle(u.x, u.y, u.angle, u.radius * 1.2 * s, 0, -u.radius * 0.8 * s, -u.radius * 0.8 * s, -u.radius * 0.4 * s, 0, dr, dg, db, a);
        addRotatedTriangle(u.x, u.y, u.angle, u.radius * 1.2 * s, 0, -u.radius * 0.4 * s, 0, -u.radius * 0.8 * s, u.radius * 0.8 * s, dr, dg, db, a);
      } else if (u.type === 'tank') {
        const dr = r * 0.08, dg = g * 0.08, db = b * 0.08;
        // Hexagonal tank body outline matching 2D Canvas & Assembler
        addRotatedTriangle(u.x, u.y, u.angle, 0, 0, u.radius * 1.2, 0, u.radius * 0.4, -u.radius, r, g, b, a);
        addRotatedTriangle(u.x, u.y, u.angle, 0, 0, u.radius * 0.4, -u.radius, -u.radius * 0.8, -u.radius * 0.8, r, g, b, a);
        addRotatedTriangle(u.x, u.y, u.angle, 0, 0, -u.radius * 0.8, -u.radius * 0.8, -u.radius, 0, r, g, b, a);
        addRotatedTriangle(u.x, u.y, u.angle, 0, 0, -u.radius, 0, -u.radius * 0.8, u.radius * 0.8, r, g, b, a);
        addRotatedTriangle(u.x, u.y, u.angle, 0, 0, -u.radius * 0.8, u.radius * 0.8, u.radius * 0.4, u.radius, r, g, b, a);
        addRotatedTriangle(u.x, u.y, u.angle, 0, 0, u.radius * 0.4, u.radius, u.radius * 1.2, 0, r, g, b, a);

        // Inner darker body block
        const s = 0.82;
        addRotatedTriangle(u.x, u.y, u.angle, 0, 0, u.radius * 1.2 * s, 0, u.radius * 0.4 * s, -u.radius * s, dr, dg, db, a);
        addRotatedTriangle(u.x, u.y, u.angle, 0, 0, u.radius * 0.4 * s, -u.radius * s, -u.radius * 0.8 * s, -u.radius * 0.8 * s, dr, dg, db, a);
        addRotatedTriangle(u.x, u.y, u.angle, 0, 0, -u.radius * 0.8 * s, -u.radius * 0.8 * s, -u.radius * s, 0, dr, dg, db, a);
        addRotatedTriangle(u.x, u.y, u.angle, 0, 0, -u.radius * s, 0, -u.radius * 0.8 * s, u.radius * 0.8 * s, dr, dg, db, a);
        addRotatedTriangle(u.x, u.y, u.angle, 0, 0, -u.radius * 0.8 * s, u.radius * 0.8 * s, u.radius * 0.4 * s, u.radius * s, dr, dg, db, a);
        addRotatedTriangle(u.x, u.y, u.angle, 0, 0, u.radius * 0.4 * s, u.radius * s, u.radius * 1.2 * s, 0, dr, dg, db, a);

        // Dual white gun barrels extending forward
        const bw = 2.2;
        const bOffset = u.radius * 0.35;
        const bLen = u.radius * 1.5;

        // Left/Top barrel
        addRotatedTriangle(u.x, u.y, u.angle, 0, -bOffset - bw/2, bLen, -bOffset - bw/2, 0, -bOffset + bw/2, 1.0, 1.0, 1.0, 1.0);
        addRotatedTriangle(u.x, u.y, u.angle, bLen, -bOffset - bw/2, bLen, -bOffset + bw/2, 0, -bOffset + bw/2, 1.0, 1.0, 1.0, 1.0);

        // Right/Bottom barrel
        addRotatedTriangle(u.x, u.y, u.angle, 0, bOffset - bw/2, bLen, bOffset - bw/2, 0, bOffset + bw/2, 1.0, 1.0, 1.0, 1.0);
        addRotatedTriangle(u.x, u.y, u.angle, bLen, bOffset - bw/2, bLen, bOffset + bw/2, 0, bOffset + bw/2, 1.0, 1.0, 1.0, 1.0);
      } else if (u.type === 'gunship') {
        const dr = r * 0.08, dg = g * 0.08, db = b * 0.08;
        const s = 0.72;
        // Support split-wing flyer in purple (Outer)
        addRotatedTriangle(u.x, u.y, u.angle, u.radius, 0, -u.radius * 0.8, -u.radius * 0.8, -u.radius * 0.4, 0, r, g, b, a);
        addRotatedTriangle(u.x, u.y, u.angle, u.radius, 0, -u.radius * 0.4, 0, -u.radius * 0.8, u.radius * 0.8, r, g, b, a);
        // Inner darker body
        addRotatedTriangle(u.x, u.y, u.angle, u.radius * s, 0, -u.radius * 0.8 * s, -u.radius * 0.8 * s, -u.radius * 0.4 * s, 0, dr, dg, db, a);
        addRotatedTriangle(u.x, u.y, u.angle, u.radius * s, 0, -u.radius * 0.4 * s, 0, -u.radius * 0.8 * s, u.radius * 0.8 * s, dr, dg, db, a);
      }
    });

    // 4. Collect and Batch Enemy Units & Citadels
    cb.enemyUnits.forEach(e => {
      const inVision = cb.isPositionInVision(e.x, e.y);
      const isBase = e.type === 'citadel' || e.type === 'turret';
      const isExplored = cb.isPositionExplored ? cb.isPositionExplored(e.x, e.y) : false;
      if (!inVision && !(isBase && isExplored)) return; // Hidden dynamic units and unexplored bases are completely culled

      // Screen-space viewport culling
      const sX = width/2 + (e.x - camX - width/2) * zoom;
      const sY = height/2 + (e.y - camY - height/2) * zoom;
      if (sX < -100 || sX > width + 100 || sY < -100 || sY > height + 100) return;

      // Color coding: red for enemies, semi-transparent hologram red if unseen base
      const col = inVision ? [1.0, 0.2, 0.27, 1.0] : [1.0, 0.2, 0.27, 0.28];
      const r = col[0], g = col[1], b = col[2], a = col[3];
      const dr = r * 0.08, dg = g * 0.08, db = b * 0.08;

      if (e.type === 'citadel') {
        // Pentagonal star base with soft force-field barrier bubble glow
        addCircleTriangles(e.x, e.y, e.radius * 1.25, r, g, b, a * 0.18, 16);
        addCircleTriangles(e.x, e.y, e.radius, r, g, b, a, 5);
        addCircleTriangles(e.x, e.y, e.radius * 0.72, dr, dg, db, a, 5);
        if (inVision) {
          addCircleTriangles(e.x, e.y, e.radius * 0.3, 1.0, 0.2, 0.27, 1.0, 8);
        }
      } else if (e.type === 'turret') {
        // Heavy octagonal defensive fort tower with heavy vector cannon barrel
        addCircleTriangles(e.x, e.y, e.radius, r, g, b, a, 8);
        addCircleTriangles(e.x, e.y, e.radius * 0.72, dr, dg, db, a, 8);
        addRotatedRect(e.x + Math.cos(e.angle) * (e.radius * 0.6), e.y + Math.sin(e.angle) * (e.radius * 0.6), e.angle, e.radius * 1.3, 3.5, 1.0, 1.0, 1.0, 1.0);
        addCircleTriangles(e.x, e.y, 4.5, 1.0, 0.2, 0.27, 1.0, 8);
      } else if (e.type === 'crawler') {
        const s = 0.72;
        // Jagged interceptor red crawler (Outer)
        addRotatedTriangle(e.x, e.y, e.angle, e.radius * 1.2, 0, -e.radius * 0.6, -e.radius * 0.7, -e.radius * 0.3, 0, r, g, b, a);
        addRotatedTriangle(e.x, e.y, e.angle, e.radius * 1.2, 0, -e.radius * 0.3, 0, -e.radius * 0.6, e.radius * 0.7, r, g, b, a);
        // Inner darker body
        addRotatedTriangle(e.x, e.y, e.angle, e.radius * 1.2 * s, 0, -e.radius * 0.6 * s, -e.radius * 0.7 * s, -e.radius * 0.3 * s, 0, dr, dg, db, a);
        addRotatedTriangle(e.x, e.y, e.angle, e.radius * 1.2 * s, 0, -e.radius * 0.3 * s, 0, -e.radius * 0.6 * s, e.radius * 0.7 * s, dr, dg, db, a);
      }
    });

    // 5. Draw Flagship Mothership core
    const ms = cb.mothership;
    if (ms) {
      addCircleTriangles(ms.x, ms.y, ms.radius, 0.0, 0.9, 1.0, 0.15, 12);
      addCircleTriangles(ms.x, ms.y, ms.radius - 12, 0.0, 0.9, 1.0, 0.35, 12);
      addCircleTriangles(ms.x, ms.y, ms.radius - 22, 0.05, 0.09, 0.13, 1.0, 12);
    }

    // 6. Draw active mineral veins (only if in vision)
    cb.map.resources.forEach(res => {
      if (res.type === 'deposit' && res.amount > 0) {
        if (!cb.isPositionInVision(res.x, res.y)) return;
        const col = parseColor(res.color);
        addCircleTriangles(res.x, res.y, zoom < 0.45 ? 5 : 8, col[0], col[1], col[2], 1.0, 6);
      }
    });

    // 7. Draw geometric selections box
    if (cb.isDragging && cb.selectionStart && cb.selectionEnd) {
      const p1 = cb.screenToWorld(cb.selectionStart.x, cb.selectionStart.y);
      const p2 = cb.screenToWorld(cb.selectionEnd.x, cb.selectionEnd.y);
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);

      // WebGL filled rect
      addTriangle(minX, minY, maxX, minY, minX, maxY, 0.0, 1.0, 0.4, 0.15);
      addTriangle(maxX, minY, maxX, maxY, minX, maxY, 0.0, 1.0, 0.4, 0.15);
    }

    // Draw triangles batch
    if (triOffset > 0) {
      const sh = this.shaders.conquestGeom;
      gl.useProgram(sh.program);

      gl.uniform2f(sh.uniforms['u_resolution'], width, height);
      gl.uniform2f(sh.uniforms['u_camera'], camX, camY);
      gl.uniform1f(sh.uniforms['u_zoom'], zoom);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.conquestTriangles);
      gl.bufferData(gl.ARRAY_BUFFER, triData.subarray(0, triOffset), gl.DYNAMIC_DRAW);

      const stride = 6 * Float32Array.BYTES_PER_ELEMENT;
      const posAttrib = sh.attribs['a_position'];
      const colAttrib = sh.attribs['a_color'];

      gl.enableVertexAttribArray(posAttrib);
      gl.vertexAttribPointer(posAttrib, 2, gl.FLOAT, false, stride, 0);

      gl.enableVertexAttribArray(colAttrib);
      gl.vertexAttribPointer(colAttrib, 4, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);

      gl.drawArrays(gl.TRIANGLES, 0, triOffset / 6);

      gl.disableVertexAttribArray(posAttrib);
      gl.disableVertexAttribArray(colAttrib);
    }

    // 8. Collect and draw Projectiles and Particles (Point drawing)
    let ptOffset = 0;
    const ptData = new Float32Array(180000); // Dynamic points: position(2) + color(4) + size(1) = 7 elements

    const addPoint = (x, y, r, g, b, a, size) => {
      if (ptOffset + 7 > ptData.length) return;
      ptData[ptOffset++] = x;
      ptData[ptOffset++] = y;
      ptData[ptOffset++] = r;
      ptData[ptOffset++] = g;
      ptData[ptOffset++] = b;
      ptData[ptOffset++] = a;
      ptData[ptOffset++] = size;
    };

    // Gather Projectiles
    cb.projectiles.forEach(p => {
      if (!cb.isPositionInVision(p.x, p.y)) return;
      const col = parseColor(p.color);
      addPoint(p.x, p.y, col[0], col[1], col[2], 1.0, p.isPlayer ? 5.5 : 7.5);
    });

    // Gather Explosion Particles
    cb.explosions.forEach(exp => {
      const col = parseColor(exp.color);
      exp.particles.forEach(p => {
        if (!cb.isPositionInVision(p.x, p.y)) return;
        addPoint(p.x, p.y, col[0], col[1], col[2], p.alpha, p.size);
      });
    });

    // Draw Points batch
    if (ptOffset > 0) {
      const sh = this.shaders.conquestPoints;
      gl.useProgram(sh.program);

      gl.uniform2f(sh.uniforms['u_resolution'], width, height);
      gl.uniform2f(sh.uniforms['u_camera'], camX, camY);
      gl.uniform1f(sh.uniforms['u_zoom'], zoom);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.conquestPoints);
      gl.bufferData(gl.ARRAY_BUFFER, ptData.subarray(0, ptOffset), gl.DYNAMIC_DRAW);

      const stride = 7 * Float32Array.BYTES_PER_ELEMENT;
      const posAttrib = sh.attribs['a_position'];
      const colAttrib = sh.attribs['a_color'];
      const sizeAttrib = sh.attribs['a_size'];

      gl.enableVertexAttribArray(posAttrib);
      gl.vertexAttribPointer(posAttrib, 2, gl.FLOAT, false, stride, 0);

      gl.enableVertexAttribArray(colAttrib);
      gl.vertexAttribPointer(colAttrib, 4, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);

      gl.enableVertexAttribArray(sizeAttrib);
      gl.vertexAttribPointer(sizeAttrib, 1, gl.FLOAT, false, stride, 6 * Float32Array.BYTES_PER_ELEMENT);

      gl.drawArrays(gl.POINTS, 0, ptOffset / 7);

      gl.disableVertexAttribArray(posAttrib);
      gl.disableVertexAttribArray(colAttrib);
      gl.disableVertexAttribArray(sizeAttrib);
    }
  }
}
