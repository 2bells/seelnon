import { WIDTH, HEIGHT, createGrid } from './utils.js';

export default {
    particles: [],
    time: 0,
    chars: ['@', '&', '8', '%', '#', '*', '(', ')', '{', '}', '~', '-', '.', ' '],
    params: {
        density: 150,
        speed: 1.0,
        wobble: 1.0
    },
    init() {
        this.particles = [];
        this.time = 0;
    },
    update(mouse) {
        this.time += 0.1;
        const grid = createGrid();

        // Spawn new smoke at bottom
        if (this.particles.length < this.params.density) {
            for (let i = 0; i < 3; i++) {
                this.particles.push({
                    x: WIDTH / 2 + (Math.random() - 0.5) * 12,
                    y: HEIGHT - 1,
                    vx: (Math.random() - 0.5) * 0.1,
                    vy: (0.15 + Math.random() * 0.2) * this.params.speed,
                    life: 1.0,
                    decay: 0.005 + Math.random() * 0.01,
                    wobbleFreq: (0.1 + Math.random() * 0.2) * this.params.wobble,
                    wobbleAmp: (0.2 + Math.random() * 0.5) * this.params.wobble
                });
            }
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            // Rising and swaying
            p.y -= p.vy;
            p.x += Math.sin(p.y * p.wobbleFreq + this.time) * p.wobbleAmp * 0.2;
            p.x += p.vx;
            
            // Life decay
            p.life -= p.decay;

            // Mouse interaction: push smoke away
            if (mouse.active) {
                const dx = p.x - mouse.x;
                const dy = p.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 8) {
                    const force = (8 - dist) * 0.05;
                    p.vx += (dx / dist) * force;
                    p.y -= 0.1; // Push up slightly too
                }
            }

            // Remove dead or out of bounds
            if (p.life <= 0 || p.y < 0 || p.x < 0 || p.x >= WIDTH) {
                this.particles.splice(i, 1);
                continue;
            }

            // Render
            const xi = Math.floor(p.x);
            const yi = Math.floor(p.y);
            if (xi >= 0 && xi < WIDTH && yi >= 0 && yi < HEIGHT) {
                // Determine character based on life
                const charIdx = Math.floor((1 - p.life) * (this.chars.length - 1));
                const char = this.chars[charIdx];
                
                // Color based on thickness/life
                let colorClass = "sm-wisp";
                if (p.life > 0.8) colorClass = "sm-glow";
                else if (p.life > 0.5) colorClass = "sm-thick";

                grid[yi][xi] = `<span class="${colorClass}">${char}</span>`;
            }
        }

        return grid.map(row => row.join('')).join('\n');
    },
    fps: 22,
    useHTML: true,
    settings: {
        density: { label: 'Density', min: 20, max: 400, step: 10 },
        speed: { label: 'Rise Speed', min: 0.2, max: 3.0, step: 0.1 },
        wobble: { label: 'Turbulence', min: 0.0, max: 3.0, step: 0.1 }
    }
};