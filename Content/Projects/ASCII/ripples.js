import { WIDTH, HEIGHT, createGrid } from './utils.js';

export default {
    ripples: [],
    init() {
        this.ripples = [];
        this.time = 0;
    },
    params: {
        speed: 0.5,
        rain: 0.1, // Increased base rain
        fps: 24
    },
    update(mouse) {
        if (this.time === undefined) this.time = 0; // Safety initialization
        this.time += 0.05;
        // Global cycle: 0 to 100 (0-50: Filling, 50-100: Draining)
        const cycle = (this.time * 5) % 100;
        const fillLevel = cycle < 50 ? (cycle / 50) : (1 - (cycle - 50) / 50);
        
        // 1. Mouse Interaction (Create ripples)
        if (mouse.active && Math.random() < 0.3) {
            this.ripples.push({
                x: mouse.x,
                y: mouse.y,
                r: 0,
                life: 1.0
            });
        }

        // 2. Random Rain Drops - frequency increases with fillLevel
        if (Math.random() < this.params.rain * (0.5 + fillLevel)) {
            this.ripples.push({
                x: Math.random() * WIDTH,
                y: Math.random() * HEIGHT,
                r: 0,
                life: 1.0
            });
        }

        // 3. Update Ripples
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];
            r.r += this.params.speed;
            r.life -= 0.015;
            if (r.life <= 0) {
                this.ripples.splice(i, 1);
            }
        }

        // 4. Render to Grid using an additive height-map
        const grid = createGrid();
        const heightMap = new Float32Array(WIDTH * HEIGHT).fill(0);
        const chars = '.:-=+*#%@';
        
        // Background water level effect
        for (let y = 0; y < HEIGHT; y++) {
            for (let x = 0; x < WIDTH; x++) {
                // Subtle background texture that fills up
                if (Math.random() < fillLevel * 0.1) {
                    heightMap[y * WIDTH + x] = fillLevel * 0.2;
                }
            }
        }

        for (const ripple of this.ripples) {
            const r = ripple.r;
            const life = ripple.life;
            
            // Draw multiple concentric rings for each ripple
            for (let ring = 0; ring < 3; ring++) {
                const ringR = r - (ring * 2.5);
                if (ringR < 0) continue;
                
                // Outer rings (ring 0) are now more intense/sparkly
                const ringLife = life * (0.4 + (2 - ring) * 0.3);
                if (ringLife <= 0) continue;
                
                const numPoints = Math.floor(ringR * 6) + 12;
                for (let i = 0; i < numPoints; i++) {
                    const angle = (i / numPoints) * Math.PI * 2;
                    const x = Math.floor(ripple.x + Math.cos(angle) * ringR * 2.2);
                    const y = Math.floor(ripple.y + Math.sin(angle) * ringR);
                    
                    if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
                        heightMap[y * WIDTH + x] += ringLife * 0.5;
                    }
                }
            }
        }

        // Final render from heightmap
        for (let y = 0; y < HEIGHT; y++) {
            for (let x = 0; x < WIDTH; x++) {
                const val = heightMap[y * WIDTH + x];
                if (val > 0.05) {
                    const charIdx = Math.min(chars.length - 1, Math.floor(val * (chars.length - 1)));
                    const char = chars[charIdx];
                    
                    let color = 'r-far';
                    if (val > 0.6) color = 'r-near';
                    else if (val > 0.3) color = 'r-mid';
                    
                    grid[y][x] = `<span class="${color}">${char}</span>`;
                }
            }
        }

        return grid.map(row => row.join('')).join('\n');
    },
    fps: 24,
    useHTML: true,
    settings: {
        speed: { label: 'Expansion', min: 0.1, max: 1.0, step: 0.05 },
        rain: { label: 'Rain', min: 0.0, max: 0.2, step: 0.01 },
        fps: { label: 'Speed', min: 10, max: 60, step: 1 }
    }
};
