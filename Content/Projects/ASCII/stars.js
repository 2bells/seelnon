import { WIDTH, HEIGHT, createGrid } from './utils.js';

export default {
    stars: [],
    nebulae: [],
    comets: [],
    viewX: 0,
    viewY: 0,
    params: {
        starCount: 250,
        twinkle: 1.0,
        panSensitivity: 0.5
    },
    init() {
        this.stars = Array.from({ length: Math.floor(this.params.starCount) }, () => {
            const depth = Math.random(); 
            let char = '.';
            if (depth > 0.98) char = '✦';
            else if (depth > 0.92) char = '✧';
            else if (depth > 0.6) char = '·';

            return {
                x: Math.random() * WIDTH * 2,
                y: Math.random() * HEIGHT * 2,
                speed: 0.005 + depth * 0.015,
                char: char,
                brightness: Math.random() * Math.PI * 2,
                twinkleSpeed: (0.005 + Math.random() * 0.015) * this.params.twinkle,
                colorClass: depth > 0.8 ? 's-near' : (depth > 0.5 ? 's-mid' : 's-far'),
                depth: depth
            };
        });

        this.nebulae = Array.from({ length: 8 }, () => ({
            x: Math.random() * WIDTH * 2,
            y: Math.random() * HEIGHT * 2,
            vx: (Math.random() - 0.5) * 0.002,
            vy: (Math.random() - 0.5) * 0.002,
            chars: [',', '.', "'", ' '],
            width: 15 + Math.random() * 20
        }));

        this.comets = [];
        this.viewX = WIDTH / 2;
        this.viewY = HEIGHT / 2;
    },
    update(mouse) {
        const grid = createGrid();

        // Smoothly move the "telescope" towards the mouse
        if (mouse.active) {
            const targetX = mouse.x;
            const targetY = mouse.y;
            this.viewX += (targetX - this.viewX) * 0.05;
            this.viewY += (targetY - this.viewY) * 0.05;
        }

        // Calculate panning offset
        const offsetX = (this.viewX - WIDTH / 2) * this.params.panSensitivity;
        const offsetY = (this.viewY - HEIGHT / 2) * this.params.panSensitivity;

        // Update Nebulae
        this.nebulae.forEach(n => {
            n.x += n.vx;
            n.y += n.vy;
            
            // Render relative to view offset
            const rx = n.x - offsetX;
            const ry = n.y - offsetY;

            for(let i=0; i<15; i++) {
                const ox = Math.floor(rx + (Math.random() - 0.5) * n.width);
                const oy = Math.floor(ry + (Math.random() - 0.5) * (n.width * 0.5));
                if (ox >= 0 && ox < WIDTH && oy >= 0 && oy < HEIGHT) {
                    if (Math.random() > 0.8) grid[oy][ox] = `<span class="s-nebula">${n.chars[Math.floor(Math.random()*n.chars.length)]}</span>`;
                }
            }
        });

        // Shooting stars
        if (Math.random() > 0.98 && this.comets.length < 3) {
            this.comets.push({
                x: Math.random() * WIDTH * 1.5,
                y: Math.random() * HEIGHT,
                vx: 1.5 + Math.random(),
                vy: 0.5 + Math.random() * 0.5,
                life: 1.0
            });
        }

        this.comets.forEach((c, idx) => {
            c.x += c.vx;
            c.y += c.vy;
            c.life -= 0.04;
            const xi = Math.floor(c.x - offsetX);
            const yi = Math.floor(c.y - offsetY);
            if (xi >= 0 && xi < WIDTH && yi >= 0 && yi < HEIGHT) {
                grid[yi][xi] = `<span class="s-comet">☄</span>`;
            }
            if (c.life <= 0) this.comets.splice(idx, 1);
        });

        // Stars
        this.stars.forEach(star => {
            star.brightness += star.twinkleSpeed;
            
            // Apply parallax: further stars move less with the telescope
            const px = star.x - (offsetX * star.depth * 1.5);
            const py = star.y - (offsetY * star.depth * 1.5);
            
            // Wrap coordinates
            let xInt = Math.floor(px) % (WIDTH * 2);
            if (xInt < 0) xInt += (WIDTH * 2);
            let yInt = Math.floor(py) % (HEIGHT * 2);
            if (yInt < 0) yInt += (HEIGHT * 2);

            if (xInt < WIDTH && yInt < HEIGHT) {
                const opacity = (Math.sin(star.brightness) + 1) / 2;
                if (opacity > 0.2) {
                    grid[yInt][xInt] = `<span class="${star.colorClass}">${star.char}</span>`;
                }
            }
        });
        
        return grid.map(row => row.join('')).join('\n');
    },
    fps: 20,
    useHTML: true,
    settings: {
        starCount: { label: 'Star Count', min: 50, max: 1000, step: 50 },
        twinkle: { label: 'Twinkle', min: 0.1, max: 5.0, step: 0.1 },
        panSensitivity: { label: 'Pan', min: 0.0, max: 2.0, step: 0.1 }
    }
};