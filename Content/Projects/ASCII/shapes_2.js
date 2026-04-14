import { WIDTH, HEIGHT, createGrid } from './utils.js';

export default {
    time: 0,
    pulse: 0,
    shapes: [],
    init() {
        this.time = 0;
        this.pulse = 0;
        this.shapes = [];
        // Softer, fewer background shapes for cozy feel
        for (let i = 0; i < 20; i++) {
            this.shapes.push({
                x: Math.random() * WIDTH,
                y: Math.random() * HEIGHT,
                size: 2 + Math.random() * 4,
                speed: 0.05 + Math.random() * 0.15,
                type: ['circle', 'diamond'][Math.floor(Math.random() * 2)],
                hollow: Math.random() < 0.3,
                phase: Math.random() * Math.PI * 2
            });
        }
    },
    params: {
        rhythm: 'steady',
        bpm: 50, // Slower default for cozy
        intensity: 0.5,
        heartSize: 12,
        fps: 20
    },
    update(mouse) {
        this.time += 0.04;
        
        const grid = createGrid();
        const centerX = WIDTH / 2;
        const centerY = HEIGHT / 2;

        // 1. Draw Background Shapes - very subtle
        const period = 60 / this.params.bpm;
        const t = (this.time % period) / period;
        
        // Pulse logic based on rhythm
        let pulse = 0;
        if (this.params.rhythm === 'calm') {
            // Very slow, single soft pulse
            if (t < 0.3) pulse = Math.sin((t / 0.3) * Math.PI) * 0.3;
        } else if (this.params.rhythm === 'steady') {
            // Classic lub-dub
            if (t < 0.15) pulse = Math.sin((t / 0.15) * Math.PI) * 0.5;
            else if (t > 0.2 && t < 0.4) pulse = Math.sin(((t - 0.2) / 0.2) * Math.PI) * 0.25;
        } else if (this.params.rhythm === 'anxious') {
            // Sharper, faster double pulse
            if (t < 0.1) pulse = Math.sin((t / 0.1) * Math.PI) * 0.6;
            else if (t > 0.12 && t < 0.22) pulse = Math.sin(((t - 0.12) / 0.1) * Math.PI) * 0.4;
        }
        
        const currentIntensity = pulse * this.params.intensity;

        for (const s of this.shapes) {
            s.y -= s.speed;
            if (s.y < -10) s.y = HEIGHT + 10;
            
            const pSize = s.size * (1 + currentIntensity * 0.5);
            this.drawShape(grid, s.x, s.y, pSize, s.type, 'f-low', s.hollow);
        }

        // 2. Draw Central Heart
        this.drawCozyHeart(grid, centerX, centerY, this.params.heartSize, 'f-hot', currentIntensity);

        // 3. Mouse Interaction
        if (mouse.active) {
            this.drawShape(grid, mouse.x, mouse.y, 4 * (1 + currentIntensity), 'circle', 'f-low');
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
                    else if (type === 'diamond') hit = Math.abs(dx / 2) + Math.abs(dy) <= size;

                    if (hit) {
                        if (hollow && dist < size * 0.7) continue;
                        const chars = '.:· ';
                        const charIdx = Math.floor((1 - (dist / size)) * (chars.length - 1));
                        const char = chars[Math.max(0, charIdx)] || '.';
                        grid[y][x] = `<span class="${colorClass}">${char}</span>`;
                    }
                }
            }
        }
    },

    drawCozyHeart(grid, cx, cy, baseSize, colorClass, intensity) {
        const effectiveSize = baseSize * (1 + intensity * 1.5);
        const rs = Math.ceil(effectiveSize * 1.5);

        for (let dy = -rs; dy <= rs; dy++) {
            for (let dx = -rs * 2; dx <= rs * 2; dx++) {
                const x = Math.floor(cx + dx);
                const y = Math.floor(cy + dy);
                if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
                    const nx = (dx / 2) / (effectiveSize * 0.8);
                    const ny = -dy / (effectiveSize * 0.8);
                    const val = Math.pow(nx * nx + ny * ny - 1, 3) - nx * nx * Math.pow(ny, 3);
                    
                    if (val <= 0) {
                        const dist = Math.sqrt(nx*nx + ny*ny);
                        // Softer characters for cozy feel
                        const chars = '.:*+';
                        const charIdx = Math.floor((1 - dist) * (chars.length - 1) + Math.abs(Math.sin(this.time * 0.5 + x * 0.1)) * 0.5);
                        const char = chars[Math.max(0, Math.min(chars.length - 1, charIdx))];
                        
                        // Warm color variations
                        const color = intensity > 0.02 ? 'f-hot' : 'f-mid';
                        grid[y][x] = `<span class="${color}">${char}</span>`;
                    }
                }
            }
        }
    },

    fps: 20,
    useHTML: true,
    settings: {
        rhythm: { label: 'Rhythm', options: ['calm', 'steady', 'anxious'] },
        bpm: { label: 'Heart Rate (BPM)', min: 30, max: 120, step: 1 },
        intensity: { label: 'Pulse Intensity', min: 0.1, max: 2.0, step: 0.1 },
        heartSize: { label: 'Heart Size', min: 5, max: 25, step: 1 },
        fps: { label: 'Speed', min: 10, max: 40, step: 1 }
    }
};
