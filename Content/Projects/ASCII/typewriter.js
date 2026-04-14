import { WIDTH, HEIGHT, createGrid } from './utils.js';

export default {
    fallingChars: [],
    currentText: "",
    targetText: "",
    typingIndex: 0,
    typingTimer: 0,
    state: 'TYPING', // TYPING, WAITING, SWIPING
    waitTimer: 0,
    
    phrases: [
        "the quick brown fox jumps over the lazy dog.",
        "all those moments will be lost in time, like tears in rain.",
        "silence is a source of great strength.",
        "code is like poetry; most of it is bad.",
        "be the change you wish to see in the world.",
        "do not go gentle into that good night.",
        "stay hungry, stay foolish.",
        "winter is coming, but the coffee is warm.",
        "just another line in the terminal of life.",
        "zen is not some kind of excitement, but concentration on our usual everyday routine.",
        "everything has beauty, but not everyone sees it.",
        "simplicity is the ultimate sophistication."
    ],

    params: {
        speed: 1.0,
        gravity: 0.15,
        bounce: 0.4,
        colorVariety: 0.5
    },

    init() {
        this.fallingChars = [];
        this.currentText = "";
        this.typingIndex = 0;
        this.typingTimer = 0;
        this.waitTimer = 0;
        this.state = 'TYPING';
        this.pickNewPhrase();
    },

    pickNewPhrase() {
        this.targetText = this.phrases[Math.floor(Math.random() * this.phrases.length)];
        this.currentText = "";
        this.typingIndex = 0;
    },

    update(mouse) {
        const grid = createGrid();
        const centerX = Math.floor(WIDTH / 2);
        const startX = Math.max(0, centerX - Math.floor(this.targetText.length / 2));
        const lineY = Math.floor(HEIGHT / 3);

        // --- Logic State Machine ---
        if (this.state === 'TYPING') {
            this.typingTimer += this.params.speed;
            
            // Check current character to determine typing rhythm
            const currentChar = this.targetText[this.typingIndex];
            const isPunctuation = /[.,!?;]/.test(currentChar);
            const isSpace = currentChar === ' ';
            
            // Rhythm logic: spaces and punctuation take longer ("thinking")
            let threshold = 1.5;
            if (isSpace) threshold = 4.0;
            if (isPunctuation) threshold = 6.0;

            if (this.typingTimer >= threshold) {
                if (this.typingIndex < this.targetText.length) {
                    this.currentText += this.targetText[this.typingIndex];
                    this.typingIndex++;
                } else {
                    this.state = 'WAITING';
                    this.waitTimer = 0;
                }
                this.typingTimer = 0;
            }
        } else if (this.state === 'WAITING') {
            this.waitTimer += 0.1;
            if (this.waitTimer > 1.5) {
                this.state = 'SWIPING';
            }
        } else if (this.state === 'SWIPING') {
            // Convert current line to falling particles
            for (let i = 0; i < this.currentText.length; i++) {
                if (this.currentText[i] !== " ") {
                    this.fallingChars.push({
                        char: this.currentText[i],
                        x: startX + i,
                        y: lineY,
                        vx: (Math.random() - 0.5) * 0.5,
                        vy: -Math.random() * 0.5,
                        life: 1.0,
                        hue: Math.random()
                    });
                }
            }
            this.state = 'TYPING';
            this.pickNewPhrase();
        }

        // --- Physics Update ---
        for (let i = this.fallingChars.length - 1; i >= 0; i--) {
            const p = this.fallingChars[i];
            
            // Mouse interaction (repel)
            if (mouse.active) {
                const dx = p.x - mouse.x;
                const dy = p.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 6) {
                    const force = (6 - dist) * 0.05;
                    p.vx += (dx / dist) * force;
                    p.vy += (dy / dist) * force;
                }
            }

            p.vy += this.params.gravity;
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.005;

            // Bounce on floor
            if (p.y >= HEIGHT - 1) {
                p.y = HEIGHT - 1;
                p.vy *= -this.params.bounce;
                p.vx *= 0.8;
            }

            // Bounds and decay
            if (p.life <= 0 || p.x < 0 || p.x >= WIDTH) {
                this.fallingChars.splice(i, 1);
                continue;
            }

            // Render falling
            const xi = Math.floor(p.x);
            const yi = Math.floor(p.y);
            if (xi >= 0 && xi < WIDTH && yi >= 0 && yi < HEIGHT) {
                let colorClass = "t-char";
                if (this.params.colorVariety > 0.5 && p.hue > 0.7) colorClass = "t-accent";
                grid[yi][xi] = `<span class="${colorClass}">${p.char}</span>`;
            }
        }

        // --- Render Active Line ---
        for (let i = 0; i < this.currentText.length; i++) {
            const xi = startX + i;
            if (xi >= 0 && xi < WIDTH) {
                grid[lineY][xi] = `<span class="t-typing">${this.currentText[i]}</span>`;
            }
        }
        
        // Render Cursor
        if (this.state === 'TYPING' && Math.floor(Date.now() / 300) % 2 === 0) {
            const cursorX = startX + this.currentText.length;
            if (cursorX < WIDTH) {
                grid[lineY][cursorX] = `<span class="t-cursor">_</span>`;
            }
        }

        return grid.map(row => row.join('')).join('\n');
    },
    fps: 24,
    useHTML: true,
    settings: {
        speed: { label: 'Typing Speed', min: 0.5, max: 5.0, step: 0.1 },
        gravity: { label: 'Gravity', min: 0.01, max: 0.5, step: 0.01 },
        bounce: { label: 'Elasticity', min: 0.0, max: 0.9, step: 0.05 },
        colorVariety: { label: 'Colors', min: 0.0, max: 1.0, step: 0.1 }
    }
};