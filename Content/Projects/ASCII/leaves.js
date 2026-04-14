import { WIDTH, HEIGHT, createGrid } from './utils.js';

export default {
    leaves: [],
    treeStructure: [],
    grass: [],
    groundLeaves: [],
    time: 0,
    init() {
        this.leaves = [];
        this.treeStructure = [];
        this.grass = [];
        this.groundLeaves = [];
        this.time = 0;

        const centerX = Math.floor(WIDTH * 0.5);
        const baseY = HEIGHT - 3;
        
        // 1. Define Tree Structure (Skeleton)
        // Trunk - much smaller and thinner
        const trunkHeight = 3;
        for (let y = baseY; y > baseY - trunkHeight; y--) {
            this.treeStructure.push({ x: centerX, y, char: '#', type: 'trunk', offset: (baseY - y) * 0.02 });
        }
        
        // Branches & Leaf Spawn Points
        const addBranch = (bx, by, length, angle, depth) => {
            if (depth <= 0) return;
            for (let i = 1; i <= length; i++) {
                const lx = bx + Math.cos(angle) * i;
                const ly = by + Math.sin(angle) * i;
                const char = depth > 1 ? (Math.abs(Math.cos(angle)) > 0.5 ? '=' : '|') : 'v';
                this.treeStructure.push({ x: lx, y: ly, char, type: 'branch', offset: (baseY - ly) * 0.08 });
                
                // Spawn initial leaves - dense but scaled down
                const leafDensity = 0.85;
                if (Math.random() < leafDensity) {
                    const numLeaves = depth > 2 ? 3 : 1;
                    for (let j = 0; j < numLeaves; j++) {
                        this.leaves.push({
                            anchorX: lx + (Math.random() - 0.5) * 4,
                            anchorY: ly + (Math.random() - 0.5) * 3,
                            x: lx,
                            y: ly,
                            attached: true,
                            offset: (baseY - ly) * 0.1,
                            distFromBranch: 0,
                            char: '*%&@'[Math.floor(Math.random() * 4)],
                            color: ['f-low', 'f-mid', 'f-high'][Math.floor(Math.random() * 3)]
                        });
                    }
                }
            }
            const newLength = length * 0.7; // Scaled down branches
            addBranch(bx + Math.cos(angle) * length, by + Math.sin(angle) * length, newLength, angle - 0.7, depth - 1);
            addBranch(bx + Math.cos(angle) * length, by + Math.sin(angle) * length, newLength, angle + 0.7, depth - 1);
        };
        
        // Start smaller
        addBranch(centerX, baseY - trunkHeight, 7, -Math.PI / 2, 4);

        // 2. Initialize Grass - more "grassy"
        for (let x = 0; x < WIDTH; x++) {
            if (Math.random() < 0.7) {
                this.grass.push({
                    x,
                    y: HEIGHT - 1,
                    h: 1 + Math.floor(Math.random() * 2),
                    phase: Math.random() * Math.PI * 2,
                    char: [',', 'v', 'w', 'i'][Math.floor(Math.random() * 4)]
                });
            }
        }
    },
    params: {
        wind: 0.4,
        growth: 0.2,
        cycleSpeed: 2, // Slower default cycle
        fps: 20
    },
    update(mouse) {
        this.time += 0.08;
        const baseY = HEIGHT - 3;
        // Global cycle: 0 to 100 (0-50: Recovery/Growth, 50-100: Decay/Fall)
        const cycle = (this.time * this.params.cycleSpeed) % 100;
        const isDecaying = cycle > 50;
        
        const grid = createGrid();
        // Subtle sway instead of "camera shake"
        const windBase = Math.sin(this.time * 0.3) * this.params.wind * 0.3; 
        
        // 1. Draw Grass
        for (const g of this.grass) {
            const sway = Math.sin(this.time + g.phase) * this.params.wind * 1.5;
            for (let i = 0; i < g.h; i++) {
                const gx = Math.floor(g.x + sway * (i / g.h));
                const gy = g.y - i;
                if (gx >= 0 && gx < WIDTH && gy >= 0 && gy < HEIGHT) {
                    grid[gy][gx] = `<span class="f-low">${g.char}</span>`;
                }
            }
        }

        // 2. Draw Tree (Swaying)
        for (const node of this.treeStructure) {
            const sway = windBase * node.offset * 2;
            const tx = Math.floor(node.x + sway);
            const ty = Math.floor(node.y);
            if (tx >= 0 && tx < WIDTH && ty >= 0 && ty < HEIGHT) {
                grid[ty][tx] = `<span class="t-char">${node.char}</span>`;
            }
        }

        // 3. Update and Draw Leaves
        for (let i = this.leaves.length - 1; i >= 0; i--) {
            const l = this.leaves[i];
            
            if (l.attached) {
                // Sway with tree
                const sway = windBase * l.offset * 2;
                l.x = l.anchorX + sway;
                l.y = l.anchorY;
                
                // Chance to fall off - much higher during decay phase and based on distance from branch
                const distFactor = 1 + (l.distFromBranch || 0) * 0.5;
                const fallProb = isDecaying ? 0.02 * distFactor : 0.0005 * distFactor;
                if (Math.random() < fallProb * (1 + this.params.wind)) {
                    l.attached = false;
                    l.vx = windBase * 2 + (Math.random() - 0.5);
                    l.vy = 0;
                    l.angle = Math.random() * Math.PI;
                }
            } else {
                // Falling physics
                l.vx += (windBase - l.vx) * 0.05;
                l.vy += 0.05 + Math.sin(this.time * 2 + l.offset) * 0.05;
                l.x += l.vx;
                l.y += l.vy;
                l.angle += 0.1;
                
                // Mouse interaction
                if (mouse.active) {
                    const dx = l.x - mouse.x;
                    const dy = l.y - mouse.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 10) {
                        l.vx += (dx / dist) * 0.5;
                        l.vy += (dy / dist) * 0.5;
                    }
                }
            }

            const xi = Math.floor(l.x);
            const yi = Math.floor(l.y);

            if (xi >= 0 && xi < WIDTH && yi >= 0 && yi < HEIGHT) {
                const char = l.attached ? l.char : '.,-~'[Math.floor((Math.sin(l.angle) + 1) * 1.5)];
                grid[yi][xi] = `<span class="${l.color}">${char}</span>`;
            }

            // Remove if out of bounds or store if hit ground
            if (xi < -10 || xi > WIDTH + 10 || yi > HEIGHT + 5) {
                this.leaves.splice(i, 1);
            } else if (yi >= HEIGHT - 1 && !l.attached) {
                // Store on ground
                if (this.groundLeaves.length < 300) {
                    this.groundLeaves.push({ x: xi, y: HEIGHT - 1, char: l.char, color: l.color, life: 150 });
                }
                this.leaves.splice(i, 1);
            }
        }

        // 4. Draw Ground Leaves
        for (let i = this.groundLeaves.length - 1; i >= 0; i--) {
            const gl = this.groundLeaves[i];
            if (gl.x >= 0 && gl.x < WIDTH) {
                grid[gl.y][gl.x] = `<span class="${gl.color}">${gl.char}</span>`;
            }
            gl.life -= 0.15;
            if (gl.life <= 0) this.groundLeaves.splice(i, 1);
        }

        // 5. Regrow Leaves - only during recovery phase
        if (!isDecaying && Math.random() < this.params.growth * 2.5) {
            const growOnLeaf = Math.random() < 0.7 && this.leaves.length > 0;
            
            if (growOnLeaf) {
                const parent = this.leaves[Math.floor(Math.random() * this.leaves.length)];
                // Bell curve centered at 70% of tree height (approx baseY - 12)
                const targetY = baseY - 12;
                const distFromTarget = Math.abs(parent.y - targetY);
                // Tighter Gaussian for more focused growth
                const growthProb = Math.exp(-(distFromTarget * distFromTarget) / 30); 
                
                if (parent.attached && (parent.distFromBranch || 0) < 4 && Math.random() < growthProb) {
                    this.leaves.push({
                        anchorX: parent.anchorX + (Math.random() - 0.5) * 4,
                        anchorY: parent.anchorY + (Math.random() - 0.5) * 3,
                        x: parent.x,
                        y: parent.y,
                        attached: true,
                        offset: parent.offset,
                        distFromBranch: (parent.distFromBranch || 0) + 1,
                        char: '*%&@'[Math.floor(Math.random() * 4)],
                        color: ['f-low', 'f-mid', 'f-high'][Math.floor(Math.random() * 3)]
                    });
                }
            } else {
                // Filter for branch nodes, favoring the 70% height area
                const branchNodes = this.treeStructure.filter(n => n.type === 'branch');
                const node = branchNodes[Math.floor(Math.random() * branchNodes.length)];
                
                if (node) {
                    const targetY = baseY - 12;
                    const distFromTarget = Math.abs(node.y - targetY);
                    const growthProb = Math.exp(-(distFromTarget * distFromTarget) / 25);
                    
                    if (Math.random() < growthProb) {
                        this.leaves.push({
                            anchorX: node.x,
                            anchorY: node.y,
                            x: node.x,
                            y: node.y,
                            attached: true,
                            offset: node.offset,
                            distFromBranch: 0,
                            char: '*%&@'[Math.floor(Math.random() * 4)],
                            color: ['f-low', 'f-mid', 'f-high'][Math.floor(Math.random() * 3)]
                        });
                    }
                }
            }
        }

        return grid.map(row => row.join('')).join('\n');
    },
    fps: 20,
    useHTML: true,
    settings: {
        wind: { label: 'Wind', min: 0.1, max: 2.0, step: 0.1 },
        growth: { label: 'Growth', min: 0.0, max: 1.0, step: 0.1 },
        cycleSpeed: { label: 'Cycle Speed', min: 0.5, max: 10, step: 0.5 },
        fps: { label: 'Speed', min: 10, max: 40, step: 1 }
    }
};
