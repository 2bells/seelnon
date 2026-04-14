import { WIDTH, HEIGHT } from './utils.js';

export default {
    A: 0, 
    B: 0,
    init() { this.A = 0; this.B = 0; },
    update(mouse) {
        const b = [];
        const z = [];
        
        let mouseA = 0;
        let mouseB = 0;
        if (mouse.active) {
            mouseA = (mouse.x / WIDTH - 0.5) * 2;
            mouseB = (mouse.y / HEIGHT - 0.5) * 2;
        }

        this.A += 0.04;
        this.B += 0.02;
        const curA = this.A + mouseA;
        const curB = this.B + mouseB;

        const cA = Math.cos(curA), sA = Math.sin(curA);
        const cB = Math.cos(curB), sB = Math.sin(curB);

        // Clear buffers
        for (let k = 0; k < WIDTH * HEIGHT; k++) {
            b[k] = k % WIDTH === WIDTH - 1 ? '\n' : ' ';
            z[k] = 0;
        }

        for (let j = 0; j < 6.28; j += 0.07) {
            const ct = Math.cos(j), st = Math.sin(j);
            for (let i = 0; i < 6.28; i += 0.02) {
                const sp = Math.sin(i), cp = Math.cos(i);
                const h = ct + 2;
                const D = 1 / (sp * h * sA + st * cA + 5);
                const t = sp * h * cA - st * sA;
                const x = Math.floor(WIDTH / 2 + (WIDTH * 0.35) * D * (cp * h * cB - t * sB));
                const y = Math.floor(HEIGHT / 2 + (HEIGHT * 0.6) * D * (cp * h * sB + t * cB));
                const o = x + WIDTH * y;
                const N = Math.floor(8 * ((st * sA - sp * ct * cA) * cB - sp * ct * sA - st * cA - cp * ct * sB));

                if (y < HEIGHT && y >= 0 && x >= 0 && x < WIDTH - 1 && D > z[o]) {
                    z[o] = D;
                    b[o] = '.,-~:;=!*#$@'[N > 0 ? N : 0];
                }
            }
        }
        return b.join('');
    },
    fps: 25,
    useHTML: false
};
