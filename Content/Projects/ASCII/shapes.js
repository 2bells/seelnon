import { WIDTH, HEIGHT, createGrid } from './utils.js';

export default {
    time: 0,
    pulse: 0,
    shapes: [],
    init() {
        this.time = 0;
        this.pulse = 0;
        this.shapes = [];
        // Initialize more background shapes
        for (let i = 0; i < 30; i++) {
            this.shapes.push({
                x: Math.random() * WIDTH,
                y: Math.random() * HEIGHT,
                size: 3 + Math.random() * 6,
                speed: 0.1 + Math.random() * 0.3,
                type: ['circle', 'square', 'diamond'][Math.floor(Math.random() * 3)],
                hollow: Math.random() < 0.5,
                phase: Math.random() * Math.PI * 2
            });
        }
    },
    params: {
        bpm: 60,
        intensity: 0.1,
        waveSpeed: 15,
        waveWidth: 0.15,
        heartSize: 10,
        fps: 24
    },
    update(mouse) {
        this.time += 0.05;
        
        const grid = createGrid();
        const centerX = WIDTH / 2;
        const centerY = HEIGHT / 2;

        // 1. Draw Background Shapes
        // Background pulse is subtle and global
        const period = 60 / this.params.bpm;
        const t = (this.time % period) / period;
        let globalPulse = 0;
        if (t < 0.15) globalPulse = Math.sin((t / 0.15) * Math.PI) * 0.5;
        else if (t > 0.2 && t < 0.4) globalPulse = Math.sin(((t - 0.2) / 0.2) * Math.PI) * 0.3;
        
        for (const s of this.shapes) {
            s.y -= s.speed;
            if (s.y < -10) s.y = HEIGHT + 10;
            
            const pSize = s.size * (1 + globalPulse * this.params.intensity * 2);
            this.drawShape(grid, s.x, s.y, pSize, s.type, 'f-mid', s.hollow);
        }

        // 2. Draw Central Heart with Interconnected Wave
        this.drawHeart(grid, centerX, centerY, this.params.heartSize, 'f-hot');

        // 3. Mouse Interaction
        if (mouse.active) {
            this.drawShape(grid, mouse.x, mouse.y, 5 * (1 + globalPulse), 'circle', 'f-mid');
        }

        return grid.map(row => row.join('')).join('\n');
    },

    drawShape(grid, cx, cy, size, type, colorClass, hollow = false) {
        const rs = Math.ceil(size);
        for (let dy = -rs; dy <= rs; dy++) {
            for (let dx = -rs * 2; dx <= rs * 2; dx++) {
                const x = Math.floor(cx + dx);
                const y = Math.floor(cy + dy);
                if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
                    const dist = Math.sqrt((dx / 2) * (dx / 2) + dy * dy);
                    let hit = false;
                    if (type === 'circle') hit = dist <= size;
                    else if (type === 'square') hit = Math.abs(dx / 2) <= size && Math.abs(dy) <= size;
                    else if (type === 'diamond') hit = Math.abs(dx / 2) + Math.abs(dy) <= size;

                    if (hit) {
                        if (hollow && dist < size * 0.7) continue;
                        
                        const chars = '.:-=+*#%@';
                        const charIdx = Math.floor((1 - (dist / size)) * (chars.length - 1));
                        const char = chars[Math.max(0, charIdx)] || '.';
                        grid[y][x] = `<span class="${colorClass}">${char}</span>`;
                    }
                }
            }
        }
    },

    drawHeart(grid, cx, cy, baseSize, colorClass) {
        const period = 60 / this.params.bpm;
        const waveSpeed = this.params.waveSpeed; // Speed of propagation
        const rs = Math.ceil(baseSize * 2); // Buffer for expansion

        for (let dy = -rs; dy <= rs; dy++) {
            for (let dx = -rs * 2; dx <= rs * 2; dx++) {
                const x = Math.floor(cx + dx);
                const y = Math.floor(cy + dy);
                if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
                    const dist = Math.sqrt((dx / 2) * (dx / 2) + dy * dy);
                    
                    // Calculate local pulse based on wave propagation
                    const localTime = this.time - (dist / waveSpeed);
                    const t = (localTime % period + period) % period / period;
                    
                    const w = this.params.waveWidth;
                    let localPulse = 0;
                    if (t < w) localPulse = Math.sin((t / w) * Math.PI) * 1.0;
                    else if (t > w * 1.3 && t < w * 2.6) localPulse = Math.sin(((t - w * 1.3) / (w * 1.3)) * Math.PI) * 0.7;
                    
                    const intensity = localPulse * this.params.intensity;
                    const effectiveSize = baseSize * (1 + intensity * 0.5);
                    
                    const nx = (dx / 2) / (effectiveSize * 0.8);
                    const ny = -dy / (effectiveSize * 0.8);
                    const val = Math.pow(nx * nx + ny * ny - 1, 3) - nx * nx * Math.pow(ny, 3);
                    
                    if (val <= 0) {
                        const chars = '#%@*+=-:.';
                        const charIdx = Math.floor((Math.abs(Math.sin(x * 0.5 + y * 0.3 + this.time * 0.2)) * 5) + (localPulse * 8));
                        const char = chars[charIdx % chars.length];
                        const isWaveFront = localPulse > 0.8;
                        const finalColor = isWaveFront ? 'f-hot' : colorClass;
                        grid[y][x] = `<span class="${finalColor}">${char}</span>`;
                    }
                }
            }
        }
    },

    fps: 24,
    useHTML: true,
    settings: {
        bpm: { label: 'Heart Rate (BPM)', min: 40, max: 180, step: 1 },
        intensity: { label: 'Pulse Intensity', min: 0.02, max: 1.0, step: 0.02 },
        waveSpeed: { label: 'Wave Speed', min: 5, max: 40, step: 1 },
        waveWidth: { label: 'Wave Width', min: 0.05, max: 0.4, step: 0.01 },
        heartSize: { label: 'Heart Size', min: 5, max: 20, step: 1 },
        fps: { label: 'Speed', min: 10, max: 60, step: 1 }
    }
};
