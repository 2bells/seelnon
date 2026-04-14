import { WIDTH, HEIGHT, createGrid } from './utils.js';

export default {
    drops: [],
    splashes: [],
    fallenDrops: [],
    params: {
        density: 120,
        speed: 1.0,
        puddleLife: 1.0
    },
    init() {
        this.drops = Array.from({ length: Math.floor(this.params.density) }, () => this.createDrop());
        this.drops = Array.from({ length: 120 }, () => this.createDrop());
        this.splashes = [];
        this.fallenDrops = [];
    },
    createDrop() {
        const depth = Math.random();
        const baseSpeed = 0.6 + depth * 0.9;
        return {
            x: Math.random() * WIDTH,
            y: Math.random() * -HEIGHT,
            vx: 0,
            vy: (0.3 + depth * 0.7) * this.params.speed,
            speed: baseSpeed * this.params.speed,
            char: depth > 0.7 ? '!' : (depth > 0.4 ? '|' : 'i'),
            colorClass: depth > 0.7 ? 'r-near' : (depth > 0.4 ? 'r-mid' : 'r-far'),
            depth: depth
        };
    },
    update(mouse) {
        const grid = createGrid();
        const uHeight = 4; // Flatter triangle
        const uWidth = 15; // Wider umbrella
        
        // Update drops
        this.drops.forEach(drop => {
            let dy_next = drop.y + drop.vy;
            let dx_next = drop.x + drop.vx;

            // Invisible Umbrella logic
            if (mouse.active) {
                const dx = dx_next - mouse.x;
                const dy = dy_next - mouse.y;

                // Fatter triangle using square root for non-linear slope
                const progress = Math.sqrt(Math.max(0, (dy + uHeight) / uHeight)); 
                const currentHalfWidth = progress * uWidth;

                if (dy > -uHeight && dy < 0.5 && Math.abs(dx) < currentHalfWidth) {
                    // Collision! Slide down with friction
                    const side = dx > 0 ? 1 : -1;
                    drop.x = mouse.x + (currentHalfWidth + 0.2) * side;
                    
                    // Added friction: small incremental horizontal velocity instead of a big boost
                    drop.vx += side * 0.12;
                    // Viscous slide: slow vertical fall significantly
                    drop.vy *= 0.4;
                    drop.y += 0.1; 
                }
            }

            drop.y += drop.vy;
            drop.x += drop.vx;

            // Friction/Gravity recovery
            drop.vx *= 0.85;
            drop.vy = drop.vy * 0.9 + drop.speed * 0.1;

            const xInt = Math.floor(drop.x);
            const yInt = Math.floor(drop.y);

            if (yInt >= HEIGHT - 1) {
                if (xInt >= 0 && xInt < WIDTH) {
                    this.splashes.push({
                        x: xInt,
                        y: HEIGHT - 1,
                        life: 4,
                        chars: ['v', '.', ' '],
                        colorClass: drop.colorClass
                    });

                    // Puddle growth logic - faster evaporation
                    const existing = this.fallenDrops.find(f => f.x === xInt && f.y === HEIGHT - 1);
                    if (existing) {
                        existing.life += 15 * this.params.puddleLife;
                        if (existing.life > 120) existing.life = 120;
                        if (existing.life > 80) existing.char = '≈';
                        else if (existing.life > 40) existing.char = '≡';
                    } else {
                        this.fallenDrops.push({
                            x: xInt,
                            y: HEIGHT - 1,
                            life: (20 + Math.random() * 20) * this.params.puddleLife,
                            char: '_',
                            colorClass: 'r-puddle'
                        });
                    }
                }
                Object.assign(drop, this.createDrop());
            } else if (xInt >= 0 && xInt < WIDTH && yInt >= 0) {
                grid[yInt][xInt] = `<span class="${drop.colorClass}">${drop.char}</span>`;
            }

            if (drop.x < -5) drop.x = WIDTH + 5;
            if (drop.x >= WIDTH + 5) drop.x = -5;
        });

        // Update fallen drops with drainage visual
        for (let i = this.fallenDrops.length - 1; i >= 0; i--) {
            const f = this.fallenDrops[i];
            f.life -= 1.5; // Drain faster

            if (f.life <= 0) {
                this.fallenDrops.splice(i, 1);
            } else {
                // Update char based on dying life
                if (f.life < 20) f.char = '.';
                else if (f.life < 40) f.char = '_';
                
                if (grid[f.y][f.x] === ' ') {
                    grid[f.y][f.x] = `<span class="${f.colorClass}">${f.char}</span>`;
                }
            }
        }

        // Update splashes
        for (let i = this.splashes.length - 1; i >= 0; i--) {
            const s = this.splashes[i];
            const charIdx = Math.floor((1 - s.life / 4) * s.chars.length);
            const char = s.chars[charIdx] || ' ';
            if (s.y >= 0 && s.y < HEIGHT && s.x >= 0 && s.x < WIDTH) {
                grid[s.y][s.x] = `<span class="${s.colorClass}">${char}</span>`;
            }
            s.life--;
            if (s.life <= 0) this.splashes.splice(i, 1);
        }

        return grid.map(row => row.join('')).join('\n');
    },
    fps: 24,
    useHTML: true,
    settings: {
        density: { label: 'Density', min: 10, max: 400, step: 10 },
        speed: { label: 'Speed', min: 0.2, max: 3.0, step: 0.1 },
        puddleLife: { label: 'Puddles', min: 0.1, max: 5.0, step: 0.1 }
    }
};