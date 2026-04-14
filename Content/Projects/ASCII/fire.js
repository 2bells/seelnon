import { WIDTH, HEIGHT, createGrid } from './utils.js';

export default {
    buffer: [],
    embers: [],
    chars: ' .:-=+*#%@',
    init() {
        this.buffer = new Array(WIDTH * HEIGHT).fill(0);
        this.embers = [];
    },
    params: {
        intensity: 0.4,
        height: 4.05,
        width: 0.6,
        embers: 0.5,
        fps: 20
    },
    update(mouse) {
        const center = (WIDTH - 1) / 2;
        const outerRadius = (WIDTH * this.params.width) / 2;
        const maxIntensity = this.chars.length - 1;

        // 1. Seed the bottom row (The Source)
        // We use multiple peaks for wider fires to simulate multiple logs/sources
        const numSources = Math.max(1, Math.floor(this.params.width * 3));
        const sourceSpacing = (outerRadius * 2) / (numSources + 1);
        
        for (let x = 0; x < WIDTH; x++) {
            const distToCenter = Math.abs(x - center);
            if (distToCenter < outerRadius) {
                let maxProb = 0;
                let isCore = false;
                for (let i = 1; i <= numSources; i++) {
                    const sourceX = (center - outerRadius) + i * sourceSpacing;
                    const distToSource = Math.abs(x - sourceX);
                    // Each source has a localized influence
                    const sourceInfluence = Math.pow(1 - Math.min(1, distToSource / (outerRadius * 0.6)), 2);
                    if (sourceInfluence > maxProb) {
                        maxProb = sourceInfluence;
                        if (distToSource < 1.5) isCore = true; // Very close to a source center
                    }
                }

                const prob = maxProb * this.params.intensity * 2.5;
                // Stable root: less random, more "simmering"
                if (Math.random() < prob) {
                    // Cores are always max intensity for visual stability
                    this.buffer[(HEIGHT - 1) * WIDTH + x] = isCore ? maxIntensity : (maxIntensity - Math.floor(Math.random() * 2));
                } else {
                    // Maintain heat longer at the base
                    this.buffer[(HEIGHT - 1) * WIDTH + x] = Math.max(0, this.buffer[(HEIGHT - 1) * WIDTH + x] - 1);
                }
            } else {
                this.buffer[(HEIGHT - 1) * WIDTH + x] = 0;
            }
        }

        // 2. Propagate Heat Upwards
        for (let y = 0; y < HEIGHT - 1; y++) {
            for (let x = 0; x < WIDTH; x++) {
                const dist = x - center;
                const drift = dist > 0 ? -1 : dist < 0 ? 1 : 0;
                
                // Random horizontal spread - reduced for lower turbulence
                const rand = Math.random();
                let offsetX = 0;
                if (rand < 0.15) offsetX = -1;
                else if (rand < 0.3) offsetX = 1;
                
                // Drift towards center - more stable
                if (Math.random() < 0.3) offsetX += drift;
                
                const srcX = Math.max(0, Math.min(WIDTH - 1, x + offsetX));
                const srcIntensity = this.buffer[(y + 1) * WIDTH + srcX];
                
                // Decay logic - linked to intensity to control vertical progress
                const distRatio = Math.abs(x - center) / outerRadius;
                const heightFactor = (HEIGHT - y) / HEIGHT; // 0 at bottom, 1 at top
                
                // Lower intensity = higher decay probability = shorter fire
                const intensityFactor = 1.0 - this.params.intensity;
                const decayBase = distRatio > 0.7 ? 2 : 1;
                
                // Dynamic decay probability based on height and user-set intensity
                const decayProb = 0.2 + (intensityFactor * 0.5) + (heightFactor * 0.4);
                const decay = Math.random() < decayProb ? decayBase : 0;
                
                this.buffer[y * WIDTH + x] = Math.max(0, srcIntensity - decay);
            }
        }

        // 3. Mouse Interaction
        if (mouse.active) {
            const mx = mouse.x;
            const my = mouse.y;
            const radius = 6;
            const innerRadius = 2.5;
            
            for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy++) {
                for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
                    const nx = Math.floor(mx + dx);
                    const ny = Math.floor(my + dy);
                    
                    if (nx >= 0 && nx < WIDTH && ny >= 0 && ny < HEIGHT) {
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < innerRadius) {
                            this.buffer[ny * WIDTH + nx] = 0;
                        } else if (dist < radius) {
                            // Fall-off: reduce intensity based on distance from center
                            // Closer to innerRadius = more extinguished
                            const falloff = (dist - innerRadius) / (radius - innerRadius);
                            this.buffer[ny * WIDTH + nx] = Math.min(
                                this.buffer[ny * WIDTH + nx], 
                                Math.floor(maxIntensity * falloff)
                            );
                        }
                    }
                }
            }
        }

        // 4. Render to Grid
        const grid = createGrid();
        for (let y = 0; y < HEIGHT; y++) {
            for (let x = 0; x < WIDTH; x++) {
                const val = this.buffer[y * WIDTH + x];
                if (val > 0) {
                    const char = this.chars[Math.min(val, maxIntensity)];
                    
                    // Find distance to nearest source for localized hotness
                    let minDistToSource = WIDTH;
                    for (let i = 1; i <= numSources; i++) {
                        const sourceX = (center - outerRadius) + i * sourceSpacing;
                        minDistToSource = Math.min(minDistToSource, Math.abs(x - sourceX));
                    }
                    
                    // Shrink hot zones for a more compact look
                    let color = 'f-low';
                    if (val >= 7 && minDistToSource < outerRadius * 0.25) color = 'f-hot';
                    else if (val >= 4 && minDistToSource < outerRadius * 0.5) color = 'f-high';
                    else if (val >= 1) color = 'f-mid';
                    
                    grid[y][x] = `<span class="${color}">${char}</span>`;
                }
            }
        }

        // 5. Embers
        if (Math.random() < this.params.embers * 0.3) {
            this.embers.push({
                x: center + (Math.random() - 0.5) * outerRadius * 1.5,
                y: HEIGHT - 2,
                vx: (Math.random() - 0.5) * 0.5,
                vy: -0.2 - Math.random() * 0.3,
                life: 40 + Math.random() * 40
            });
        }

        for (let i = this.embers.length - 1; i >= 0; i--) {
            const e = this.embers[i];
            e.x += e.vx;
            e.y += e.vy;
            e.vy *= 0.99;
            e.vx += (Math.random() - 0.5) * 0.1;
            e.life--;

            const xi = Math.floor(e.x);
            const yi = Math.floor(e.y);
            
            if (yi >= 0 && yi < HEIGHT && xi >= 0 && xi < WIDTH && e.life > 0) {
                grid[yi][xi] = `<span class="f-ember">${Math.random() > 0.5 ? '°' : '·'}</span>`;
            } else {
                this.embers.splice(i, 1);
            }
        }

        return grid.map(row => row.join('')).join('\n');
    },
    fps: 20,
    useHTML: true,
    settings: {
        intensity: { label: 'Intensity', min: 0.1, max: 0.9, step: 0.05 },
        width: { label: 'Width', min: 0.1, max: 1.0, step: 0.05 },
        embers: { label: 'Embers', min: 0.0, max: 1.0, step: 0.05 },
        fps: { label: 'Speed', min: 10, max: 40, step: 1 }
    }
};
