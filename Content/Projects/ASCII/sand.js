import { WIDTH, HEIGHT, createGrid } from './utils.js';

export default {
    sand: [],
    frameCount: 0,
    init() {
        // Initialize sand with objects to track life and rake level
        this.sand = Array.from({ length: WIDTH * HEIGHT }, () => ({ life: 0, level: 0, lastFrame: 0 }));
        this.frameCount = 0;
    },
    params: {
        rakeSize: 2,
        rakeLife: 150, // Patterns last longer
        fps: 24
    },
    update(mouse) {
        this.frameCount++;
        
        // 1. Raking Logic
        if (mouse.active) {
            const mx = Math.floor(mouse.x);
            const my = Math.floor(mouse.y);
            const r = this.params.rakeSize;
            
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    const nx = mx + dx;
                    const ny = my + dy;
                    if (nx >= 0 && nx < WIDTH && ny >= 0 && ny < HEIGHT) {
                        const dist = Math.sqrt(dx*dx + dy*dy);
                        if (dist <= r) {
                            const cell = this.sand[ny * WIDTH + nx];
                            if (cell.level === 0) {
                                cell.level = 1;
                                cell.life = this.params.rakeLife;
                            } else if (this.frameCount - cell.lastFrame > 15) {
                                // Increment level if raking over an existing path after a short delay
                                if (cell.level < 4) {
                                    cell.level++;
                                    cell.life = this.params.rakeLife;
                                } else {
                                    // Just refresh top level
                                    cell.life = this.params.rakeLife;
                                }
                            } else {
                                // Refresh current level life
                                cell.life = this.params.rakeLife;
                            }
                            cell.lastFrame = this.frameCount;
                        }
                    }
                }
            }
        }

        // 2. Decay Raked Patterns (Layered)
        for (let i = 0; i < this.sand.length; i++) {
            const cell = this.sand[i];
            if (cell.level > 0) {
                cell.life -= 0.5;
                if (cell.life <= 0) {
                    cell.level--;
                    if (cell.level > 0) {
                        cell.life = this.params.rakeLife; // Reset life for the next layer down
                    }
                }
            }
        }

        // 3. Render to Grid
        const grid = createGrid();
        
        // Draw Sand
        for (let y = 0; y < HEIGHT; y++) {
            for (let x = 0; x < WIDTH; x++) {
                const cell = this.sand[y * WIDTH + x];
                if (cell.level > 0) {
                    // Different patterns for different rake levels
                    let char = ' ';
                    if (cell.level === 1) char = (x + y) % 4 === 0 ? '~' : (x % 4 === 0 ? '-' : ' ');
                    else if (cell.level === 2) char = (x - y) % 4 === 0 ? '≈' : (y % 4 === 0 ? '=' : ' ');
                    else if (cell.level === 3) char = (x * y) % 3 === 0 ? '≡' : ' ';
                    else char = (x + y) % 2 === 0 ? '░' : ' ';
                    
                    grid[y][x] = `<span class="f-mid">${char}</span>`;
                } else {
                    // Flat sand - more dense texture
                    const char = (x % 2 === 0 && y % 2 === 0) ? '·' : ((x + y) % 5 === 0 ? '.' : ' ');
                    grid[y][x] = `<span class="f-low">${char}</span>`;
                }
            }
        }

        return grid.map(row => row.join('')).join('\n');
    },
    fps: 24,
    useHTML: true,
    settings: {
        rakeSize: { label: 'Rake Size', min: 1, max: 5, step: 1 },
        fps: { label: 'Speed', min: 10, max: 60, step: 1 }
    }
};
