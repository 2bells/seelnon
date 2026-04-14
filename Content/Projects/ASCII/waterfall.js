import { WIDTH, HEIGHT, createGrid } from './utils.js';

export default {
    drops: [],
    splashes: [],
    mist: [],
    params: {
        density: 12,
        speed: 1.0,
        width: 28,
        mistLevel: 0.3
    },
    init() {
        this.drops = [];
        this.splashes = [];
        this.mist = [];
    },
    update(mouse) {
        const center = Math.floor(WIDTH / 2);
        const w = this.params.width;

        // Density for "wall of water"
        for(let k = 0; k < Math.floor(this.params.density); k++) {
            this.drops.push({
                x: center - (w/2) + Math.random() * w,
                y: -Math.random() * 2,
                speed: (0.7 + Math.random() * 0.5) * this.params.speed,
                char: ['|', '!', 'i', ':', '¦'][Math.floor(Math.random() * 5)]
            });
        }

        const grid = createGrid();

        for (let i = this.drops.length - 1; i >= 0; i--) {
            const d = this.drops[i];

            // Mouse interaction - Increased radius
            if (mouse.active) {
                const dx = d.x - mouse.x;
                const dy = d.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 12) {
                    const force = (12 - dist) * 0.12;
                    d.x += (dx / dist) * force;
                }
            }

            d.y += d.speed;
            const xi = Math.floor(d.x);
            const yi = Math.floor(d.y);

            if (yi >= HEIGHT - 1) {
                // Splash on hit
                for(let j=0; j<2; j++) {
                    this.splashes.push({
                        x: d.x + (Math.random() - 0.5) * 4,
                        y: HEIGHT - 1,
                        vx: (Math.random() - 0.5) * 1.5,
                        vy: -Math.random() * 0.8,
                        life: 1.0,
                        char: ['*', '°', '.', 'o'][Math.floor(Math.random() * 4)]
                    });
                }
                this.drops.splice(i, 1);
            } else if (xi >= 0 && xi < WIDTH && yi >= 0) {
                grid[yi][xi] = `<span class="w-drop">${d.char}</span>`;
            }
        }

        for (let i = this.splashes.length - 1; i >= 0; i--) {
            const s = this.splashes[i];
            s.x += s.vx; s.y += s.vy; s.vy += 0.1; s.life -= 0.08;
            if (s.life <= 0 || s.y >= HEIGHT) {
                this.splashes.splice(i, 1);
                continue;
            }
            const xi = Math.floor(s.x);
            const yi = Math.floor(s.y);
            if (xi >= 0 && xi < WIDTH && yi >= 0 && yi < HEIGHT) {
                grid[yi][xi] = `<span class="w-foam">${s.char}</span>`;
            }
        }

        if (Math.random() > (1.0 - this.params.mistLevel)) {
            this.mist.push({
                x: center - 20 + Math.random() * 40,
                y: HEIGHT - 1,
                vx: (Math.random() - 0.5) * 0.4,
                vy: -Math.random() * 0.25,
                life: 1.0
            });
        }
        for (let i = this.mist.length - 1; i >= 0; i--) {
            const m = this.mist[i];
            m.x += m.vx; m.y += m.vy; m.life -= 0.025;
            if (m.life <= 0) {
                this.mist.splice(i, 1);
                continue;
            }
            const xi = Math.floor(m.x);
            const yi = Math.floor(m.y);
            if (xi >= 0 && xi < WIDTH && yi >= 0 && yi < HEIGHT) {
                if (Math.random() > 0.2) {
                    grid[yi][xi] = `<span class="w-mist">.</span>`;
                }
            }
        }

        return grid.map(row => row.join('')).join('\n');
    },
    fps: 22,
    useHTML: true,
    settings: {
        density: { label: 'Density', min: 2, max: 40, step: 1 },
        speed: { label: 'Gravity', min: 0.2, max: 3.0, step: 0.1 },
        width: { label: 'Width', min: 5, max: 70, step: 1 },
        mistLevel: { label: 'Mist', min: 0.0, max: 1.0, step: 0.05 }
    }
};