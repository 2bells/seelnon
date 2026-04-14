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
        intensity: 0.35,
        height: 4.02,
        width: 0.5,
        embers: 0.4,
        fps: 22
    },
    update(mouse) {
        const center = (WIDTH - 1) / 2;
        const outerRadius = (WIDTH * this.params.width) / 2;
        const maxIntensity = this.chars.length - 1;

        // 1. Seed the bottom row (The Source)
        // More stable source
        for (let x = 0; x < WIDTH; x++) {
            const dist = Math.abs(x - center);
            if (dist < outerRadius) {
                const prob = Math.pow(1 - dist / outerRadius, 2) * this.params.intensity * 2.2;
                if (Math.random() < prob) {
                    this.buffer[(HEIGHT - 1) * WIDTH + x] = maxIntensity;
                } else {
                    // Maintain base heat more consistently
                    this.buffer[(HEIGHT - 1) * WIDTH + x] = Math.max(0, this.buffer[(HEIGHT - 1) * WIDTH + x] - 1);
                }
            } else {
                this.buffer[(HEIGHT - 1) * WIDTH + x] = 0;
            }
        }

        // 2. Propagate Heat Upwards (Smoothing logic)
        // Using a weighted average for a more "chill", liquid-like fire
        const decay = Math.max(4.001, this.params.height);
        for (let y = 0; y < HEIGHT - 1; y++) {
            for (let x = 0; x < WIDTH; x++) {
                const idx = y * WIDTH + x;
                
                // Pull from below with horizontal smoothing
                const b = this.buffer[(y + 1) * WIDTH + x];
                const bl = x > 0 ? this.buffer[(y + 1) * WIDTH + (x - 1)] : 0;
                const br = x < WIDTH - 1 ? this.buffer[(y + 1) * WIDTH + (x + 1)] : 0;
                const bb = y < HEIGHT - 2 ? this.buffer[(y + 2) * WIDTH + x] : 0;

                // Weighted average for smoother vertical flow
                const avg = (b * 2 + bl + br + bb) / (decay + 1);
                
                // Very slight random flicker instead of heavy drift
                const flicker = Math.random() < 0.1 ? 1 : 0;
                this.buffer[idx] = Math.max(0, Math.floor(avg - flicker));
            }
        }

        // 3. Mouse Interaction
        if (mouse.active) {
            const mx = Math.floor(mouse.x);
            const my = Math.floor(mouse.y);
            for (let dy = -3; dy <= 3; dy++) {
                for (let dx = -4; dx <= 4; dx++) {
                    const nx = mx + dx;
                    const ny = my + dy;
                    if (nx >= 0 && nx < WIDTH && ny >= 0 && ny < HEIGHT) {
                        const d = Math.sqrt(dx*dx + dy*dy);
                        if (d < 4) this.buffer[ny * WIDTH + nx] = 0;
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
                    const dist = Math.abs(x - center);
                    
                    let color = 'f-low';
                    if (val >= 8 && dist < outerRadius * 0.3) color = 'f-hot';
                    else if (val >= 5 && dist < outerRadius * 0.6) color = 'f-high';
                    else if (val >= 2) color = 'f-mid';
                    
                    grid[y][x] = `<span class="${color}">${char}</span>`;
                }
            }
        }

        // 5. Embers
        if (Math.random() < this.params.embers * 0.2) {
            this.embers.push({
                x: center + (Math.random() - 0.5) * outerRadius * 1.2,
                y: HEIGHT - 2,
                vx: (Math.random() - 0.5) * 0.3,
                vy: -0.15 - Math.random() * 0.2,
                life: 60 + Math.random() * 60
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
