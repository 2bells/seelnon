/**
 * TETRI-SHOT -  Classic Pixel Edition
 */

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const BLOCK_SIZE = 28;
const PANIC_TIME_START = 5.0;

const COLORS = {
    'I': '#2ABCFF',
    'J': '#6A14FF',
    'L': '#FA6B37',
    'O': '#FFF019',
    'S': '#28FC4B',
    'T': '#F7C138',
    'Z': '#F83882'
};

const COLORS_ALTUS = {
    'I': '#ffcc00', // Gold
    'J': '#c0c0c0', // Silver
    'L': '#cd7f32', // Bronze
    'O': '#b8860b', // Dark Goldenrod
    'S': '#8b4513', // Saddle Brown
    'T': '#daa520', // Goldenrod
    'Z': '#a0522d'  // Sienna
};

const SHAPES = {
    'I': [[1, 1, 1, 1]],
    'J': [[1, 0, 0], [1, 1, 1]],
    'L': [[0, 0, 1], [1, 1, 1]],
    'O': [[1, 1], [1, 1]],
    'S': [[0, 1, 1], [1, 1, 0]],
    'T': [[0, 1, 0], [1, 1, 1]],
    'Z': [[1, 1, 0], [0, 1, 1]]
};

/**
 * BRUTALIST 8-BIT AUDIO ENGINE
 */
class AudioManager {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    playSfx(type) {
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime;

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        switch (type) {
            case 'spawn':
                osc.type = 'square';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;

            case 'panic':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.linearRampToValueAtTime(110, now + 0.15);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.linearRampToValueAtTime(0.001, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.15);
                break;

            case 'land':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(80, now);
                osc.frequency.linearRampToValueAtTime(40, now + 0.15);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.15);
                break;

            case 'clear':
                this.playTone(110, 0.15, 'square');
                setTimeout(() => this.playTone(147, 0.15, 'square'), 50);
                break;

            case 'tetris':
                [82, 110, 138, 165].forEach((f, i) => {
                    setTimeout(() => this.playTone(f, 0.25, 'square'), i * 100);
                });
                break;

            case 'click':
                osc.type = 'square';
                osc.frequency.setValueAtTime(1200, now);
                gain.gain.setValueAtTime(0.03, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                osc.start(now);
                osc.stop(now + 0.05);
                break;

            case 'rotate':
                osc.type = 'square';
                osc.frequency.setValueAtTime(330, now);
                osc.frequency.linearRampToValueAtTime(660, now + 0.05);
                gain.gain.setValueAtTime(0.03, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                osc.start(now);
                osc.stop(now + 0.05);
                break;

            case 'gameover':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.linearRampToValueAtTime(55, now + 0.5);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.linearRampToValueAtTime(0.001, now + 0.5);
                osc.start(now);
                osc.stop(now + 0.5);
                break;
        }
    }

    playTone(freq, dur, type = 'square') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime;
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + dur);
    }
}

class Game {
    constructor() {
        this.audio = new AudioManager();
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Load Theme Preference
        const savedTheme = localStorage.getItem('tetri-shot-theme');
        if (savedTheme === 'altus') {
            document.body.classList.add('altus');
            const themeBtn = document.getElementById('theme-toggle');
            if (themeBtn) themeBtn.innerText = 'RETRO MODE';
        }

        this.nextCanvas = document.getElementById('next-canvas');
        this.nextCtx = this.nextCanvas.getContext('2d');
        
        this.holdCanvas = document.getElementById('hold-canvas');
        this.holdCtx = this.holdCanvas.getContext('2d');

        this.controlCanvas = document.getElementById('control-canvas');
        this.controlCtx = this.controlCanvas?.getContext('2d');

        // Load Highscore
        this.highscore = parseInt(localStorage.getItem('tetri-shot-highscore')) || 0;
        document.getElementById('highscore-val').innerText = this.highscore.toLocaleString();

        this.canvas.width = BOARD_WIDTH * BLOCK_SIZE;
        this.canvas.height = BOARD_HEIGHT * BLOCK_SIZE;

        this.grid = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));
        this.score = 0;
        this.lines = 0;
        this.multiplier = 1.0;
        this.panicTime = PANIC_TIME_START;
        this.gameTime = 0;
        this.state = 'START';
        this.isPracticeMode = false;
        this.wasPracticeUsedInRun = false;
        
        // Juice & FX
        this.shake = 0;
        this.particles = [];
        this.flashes = []; // [{y, time}]
        this.popups = []; // [{x, y, text, life, color}]

        this.currentPiece = this.generatePiece();
        this.nextPieces = [this.generatePiece(), this.generatePiece(), this.generatePiece()];
        this.holdPiece = null;
        
        this.handX = 4;
        this.handY = 0;
        this.activePieces = [];

        this.mousePos = { x: 0, y: 0 };
        this.initEvents();
        this.loop();
    }

    generatePiece() {
        const types = Object.keys(SHAPES);
        const type = types[Math.floor(Math.random() * types.length)];
        const isAltus = document.body.classList.contains('altus');
        const colorSet = isAltus ? COLORS_ALTUS : COLORS;
        return {
            type,
            matrix: SHAPES[type],
            color: colorSet[type]
        };
    }

    rotateMatrix(matrix) {
        return matrix[0].map((_, i) => matrix.map(row => row[i]).reverse());
    }

    rotateMatrixCCW(matrix) {
        return matrix[0].map((_, i) => matrix.map(row => row[i])).reverse();
    }

    rotateCurrent(clockwise = true) {
        if (this.state !== 'PLAYING') return;
        this.currentPiece.matrix = clockwise 
            ? this.rotateMatrix(this.currentPiece.matrix)
            : this.rotateMatrixCCW(this.currentPiece.matrix);
        
        this.audio.playSfx('rotate');
        this.updateUI();
        // Ensure visual bounds
        const pw = this.currentPiece.matrix[0].length;
        const ph = this.currentPiece.matrix.length;
        this.handX = Math.max(0, Math.min(BOARD_WIDTH - pw, this.handX));
        this.handY = Math.max(0, Math.min(BOARD_HEIGHT - ph, this.handY));
    }

    holdAction() {
        if (this.state !== 'PLAYING') return;
        this.audio.playSfx('click');
        
        const isAltus = document.body.classList.contains('altus');
        const colorSet = isAltus ? COLORS_ALTUS : COLORS;
        
        if (this.holdPiece === null) {
            this.holdPiece = { type: this.currentPiece.type, matrix: SHAPES[this.currentPiece.type], color: colorSet[this.currentPiece.type] };
            this.currentPiece = this.nextPieces.shift();
            this.nextPieces.push(this.generatePiece());
        } else {
            const temp = { type: this.currentPiece.type, matrix: SHAPES[this.currentPiece.type], color: colorSet[this.currentPiece.type] };
            const oldType = this.holdPiece.type;
            this.currentPiece = { type: oldType, matrix: SHAPES[oldType], color: colorSet[oldType] };
            this.holdPiece = temp;
        }
        this.updateUI();
    }

    initEvents() {
        window.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            // Using logical coordinates for the state update
            const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
            this.mousePos.x = x;
            this.mousePos.y = y;
            if (this.state === 'PLAYING') {
                const matrix = this.currentPiece.matrix;
                const ph = matrix.length;
                const pw = matrix[0].length;
                this.handX = Math.floor(x / BLOCK_SIZE - (pw - 1) / 2);
                this.handY = Math.floor(y / BLOCK_SIZE - (ph - 1) / 2);
                this.handX = Math.max(0, Math.min(BOARD_WIDTH - pw, this.handX));
                this.handY = Math.max(0, Math.min(BOARD_HEIGHT - ph, this.handY));
            }
        });

        this.canvas.addEventListener('mousedown', () => {
            if (this.state === 'PLAYING') this.shoot();
        });

        // Initialize Audio on first interaction
        window.addEventListener('mousedown', () => this.audio.init(), { once: true });
        window.addEventListener('keydown', () => this.audio.init(), { once: true });

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.key === 'e' || e.key === 'E' || e.key === 'ArrowUp') {
                this.rotateCurrent(true);
            }
            if (e.key === 'w' || e.key === 'W') {
                this.rotateCurrent(false);
            }
            if (e.key === 'c' || e.key === 'C' || e.shiftKey) {
                this.holdAction();
            }
            if (e.key === 'Escape') {
                this.togglePause();
            }
        });

        document.getElementById('start-btn').onclick = () => {
            this.audio.init();
            this.audio.playSfx('click');
            document.getElementById('start-screen').classList.add('hidden');
            this.reset();
            this.state = 'PLAYING';
        };

        document.getElementById('restart-btn').onclick = () => {
            this.audio.playSfx('click');
            document.getElementById('game-over').classList.add('hidden');
            this.reset();
            this.state = 'PLAYING';
        };

        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.onclick = () => this.togglePause();
        }

        const resumeBtn = document.getElementById('resume-btn');
        if (resumeBtn) {
            resumeBtn.onclick = () => this.togglePause();
        }

        const pauseRestartBtn = document.getElementById('pause-restart-btn');
        if (pauseRestartBtn) {
            pauseRestartBtn.onclick = () => {
                this.audio.playSfx('click');
                document.getElementById('pause-screen').classList.add('hidden');
                this.reset();
                this.state = 'PLAYING';
                document.getElementById('pause-btn').innerText = 'PAUSE';
            };
        }

        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.onclick = () => {
                this.audio.playSfx('click');
                const isAltus = document.body.classList.toggle('altus');
                themeBtn.innerText = isAltus ? 'RETRO MODE' : 'NIGHT MODE';
                localStorage.setItem('tetri-shot-theme', isAltus ? 'altus' : 'retro');
                // Refresh colors for existing pieces
                this.refreshPieceColors();
            };
        }

        const rotCw = document.getElementById('rot-cw');
        const rotCcw = document.getElementById('rot-ccw');
        if (rotCw) rotCw.onclick = () => this.rotateCurrent(true);
        if (rotCcw) rotCcw.onclick = () => this.rotateCurrent(false);

        const practiceBtn = document.getElementById('practice-btn');
        if (practiceBtn) {
            practiceBtn.onclick = () => {
                this.audio.playSfx('click');
                this.isPracticeMode = !this.isPracticeMode;
                if (this.isPracticeMode) {
                    this.wasPracticeUsedInRun = true;
                    document.body.classList.add('practice-mode');
                } else {
                    document.body.classList.remove('practice-mode');
                }
                practiceBtn.innerText = this.isPracticeMode ? 'PRACTICE: ON' : 'PRACTICE: OFF';
                this.updateUI();
            };
        }
    }

    togglePause() {
        if (this.state === 'START' || this.state === 'GAMEOVER') return;
        this.audio.playSfx('click');
        this.state = this.state === 'PAUSED' ? 'PLAYING' : 'PAUSED';
        const pauseBtn = document.getElementById('pause-btn');
        const pauseScreen = document.getElementById('pause-screen');
        
        if (this.state === 'PAUSED') {
            pauseBtn.innerText = 'RESUME';
            pauseScreen.classList.remove('hidden');
        } else {
            pauseBtn.innerText = 'PAUSE';
            pauseScreen.classList.add('hidden');
        }
    }

    refreshPieceColors() {
        const isAltus = document.body.classList.contains('altus');
        const colorSet = isAltus ? COLORS_ALTUS : COLORS;
        if (this.currentPiece) this.currentPiece.color = colorSet[this.currentPiece.type];
        if (this.holdPiece) this.holdPiece.color = colorSet[this.holdPiece.type];
        this.nextPieces.forEach(p => p.color = colorSet[p.type]);
        this.activePieces.forEach(p => p.color = colorSet[p.type]);
        this.updateUI();
    }

    reset() {
        this.grid = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));
        this.score = 0;
        this.lines = 0;
        this.multiplier = 1.0;
        this.gameTime = 0;
        this.panicTime = PANIC_TIME_START;
        this.wasPracticeUsedInRun = this.isPracticeMode; // Carry over if still ON, but resets if starting clean
        this.currentPiece = this.generatePiece();
        this.nextPieces = [this.generatePiece(), this.generatePiece(), this.generatePiece()];
        this.holdPiece = null;
        this.activePieces = [];
        this.updateUI();
    }

    shoot() {
        if (!this.currentPiece) return;
        this.audio.playSfx('spawn');
        const targetX = this.handX;
        const targetY = this.handY;

        if (this.checkCollision(targetX, targetY, this.currentPiece.matrix)) return;
        
        // Immediate settle ONLY if it hits the STATIC GRID.
        // If it hits an active piece, it should stay active to fall with it.
        if (this.checkCollision(targetX, targetY + 1, this.currentPiece.matrix, -1, false)) {
            this.placePiece(targetX, targetY, this.currentPiece);
        } else {
            this.activePieces.push({
                ...this.currentPiece,
                x: targetX,
                y: targetY,
                fallTimer: 0
            });
        }
        
        this.currentPiece = this.nextPieces.shift();
        this.nextPieces.push(this.generatePiece());
        this.panicTime = this.getPanicDuration();
        this.updateUI();
    }

    getPanicDuration() {
        // Decreases as multiplier goes up. 
        // At x1.0 = 5s, x2.0 = 3.3s, x3.0 = 2.5s. Clamped at 1s.
        return Math.max(1.0, PANIC_TIME_START / (1 + (this.multiplier - 1) * 0.5));
    }

    findLandingPoint(col, startY, matrix) {
        let testY = startY;
        while (testY < BOARD_HEIGHT) {
            if (this.checkCollision(col, testY + 1, matrix)) return { x: col, y: testY };
            testY++;
        }
        return { x: col, y: BOARD_HEIGHT - matrix.length };
    }

    checkCollision(x, y, matrix, excludeIdx = -1, hitActive = true) {
        for (let r = 0; r < matrix.length; r++) {
            for (let c = 0; c < matrix[r].length; c++) {
                if (matrix[r][c] !== 0) {
                    const nx = x + c;
                    const ny = Math.floor(y + r);
                    if (nx < 0 || nx >= BOARD_WIDTH || ny >= BOARD_HEIGHT) return true;
                    if (ny < 0) continue;
                    if (this.grid[ny][nx] !== 0) return true;

                    if (hitActive) {
                        // Active pieces collision (ONLY if the other piece is actually taking up that space)
                        for (let i = 0; i < this.activePieces.length; i++) {
                            if (i === excludeIdx) continue;
                            const other = this.activePieces[i];
                            const om = other.matrix;
                            const ox = other.x;
                            const oy = Math.floor(other.y);
                            for (let or = 0; or < om.length; or++) {
                                for (let oc = 0; oc < om[or].length; oc++) {
                                    if (om[or][oc] !== 0 && nx === ox + oc && ny === oy + or) return true;
                                }
                            }
                        }
                    }
                }
            }
        }
        return false;
    }

    autoDump() {
        if (this.nextPieces.length === 0) return;
        this.audio.playSfx('panic');
        
        const dumpPiece = this.nextPieces.shift();
        this.nextPieces.push(this.generatePiece());

        const randomX = Math.max(0, Math.min(BOARD_WIDTH - dumpPiece.matrix[0].length, Math.floor(Math.random() * BOARD_WIDTH)));
        
        if (this.checkCollision(randomX, 0, dumpPiece.matrix)) {
            this.gameOver();
            return;
        }

        this.activePieces.push({ ...dumpPiece, x: randomX, y: 0, fallTimer: 0 });
        this.panicTime = this.getPanicDuration();
        this.updateUI();
    }

    placePiece(x, y, piece) {
        if (!piece) return;
        this.audio.playSfx('land');
        
        // "Just in case" - ensure piece is actually supported before placing
        let finalY = Math.floor(y);
        while (finalY < BOARD_HEIGHT - 1 && !this.checkCollision(x, finalY + 1, piece.matrix, -1, false)) {
            finalY++;
        }

        const { matrix, type, color } = piece;
        for (let r = 0; r < matrix.length; r++) {
            for (let c = 0; c < matrix[r].length; c++) {
                if (matrix[r][c] !== 0) {
                    const ny = Math.floor(finalY + r);
                    const nx = x + c;
                    if (ny >= 0 && ny < BOARD_HEIGHT) {
                        this.grid[ny][nx] = type;
                        // Landing particles
                        this.spawnParticles(nx * BLOCK_SIZE + BLOCK_SIZE/2, ny * BLOCK_SIZE + BLOCK_SIZE, color, 3);
                    }
                }
            }
        }
        
        this.shake = 5; // Trigger shake
        this.clearLines();
        if (this.checkOverflow()) this.gameOver();
    }

    spawnParticles(x, y, color, count) {
        for(let i=0; i<count; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10 - 2,
                life: 1.0,
                color
            });
        }
    }

    checkOverflow() {
        for (let c = 0; c < BOARD_WIDTH; c++) if (this.grid[0][c] !== 0) return true;
        return false;
    }

    clearLines() {
        let linesCleared = 0;
        for (let r = BOARD_HEIGHT - 1; r >= 0; r--) {
            if (this.grid[r].every(cell => cell !== 0)) {
                // Line clear FX
                const isAltus = document.body.classList.contains('altus');
                const colorSet = isAltus ? COLORS_ALTUS : COLORS;
                for(let c=0; c<BOARD_WIDTH; c++) {
                    this.spawnParticles(c * BLOCK_SIZE + BLOCK_SIZE/2, r * BLOCK_SIZE + BLOCK_SIZE/2, colorSet[this.grid[r][c]], 8);
                }
                this.flashes.push({ y: r, life: 1.0 });

                this.grid.splice(r, 1);
                this.grid.unshift(Array(BOARD_WIDTH).fill(0));
                linesCleared++;
                r++;
            }
        }
        
        if (linesCleared > 0) {
            if (linesCleared === 4) {
                this.audio.playSfx('tetris');
                this.shake = 40;
                const isAltus = document.body.classList.contains('altus');
                this.popups.push({
                    x: this.canvas.width / 2,
                    y: BOARD_HEIGHT * BLOCK_SIZE / 2,
                    text: 'TETRIS!',
                    life: 1.5,
                    color: isAltus ? '#ffd700' : '#f82d97'
                });
            } else {
                this.audio.playSfx('clear');
                this.shake = 15;
            }
            this.lines += linesCleared;
            this.score += Math.floor([0, 100, 300, 500, 1000][linesCleared] * this.multiplier);
            this.multiplier += linesCleared * 0.1;
            if (this.isPracticeMode) {
                // Keep multiplier frozen in practice mode
                this.multiplier -= linesCleared * 0.1;
            }
            this.updateUI();
        }
    }

    gameOver() {
        this.audio.playSfx('gameover');
        this.state = 'GAMEOVER';
        document.getElementById('game-over').classList.remove('hidden');
        document.getElementById('final-score').innerText = this.wasPracticeUsedInRun ? 'N/A' : this.score;

        if (this.score > this.highscore && !this.wasPracticeUsedInRun) {
            this.highscore = this.score;
            localStorage.setItem('tetri-shot-highscore', this.highscore);
            document.getElementById('highscore-val').innerText = this.highscore.toLocaleString();
        }
    }

    updateUI() {
        const scoreVal = document.getElementById('score-val');
        if (this.wasPracticeUsedInRun) {
            scoreVal.innerText = 'N/A';
        } else {
            scoreVal.innerText = this.score.toLocaleString();
        }
        document.getElementById('lines-val').innerText = this.lines.toString();
        document.getElementById('multiplier-val').innerText = `X${this.multiplier.toFixed(1)}`;
        this.drawNext();
        this.drawHold();
        this.drawControl();
    }

    drawNext() {
        this.nextCtx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        this.nextPieces.forEach((p, idx) => {
            const size = 15;
            const matrix = p.matrix;
            const px = (this.nextCanvas.width - matrix[0].length * size) / 2;
            const py = 10 + idx * 40;
            this.drawMatrix(this.nextCtx, matrix, px, py, size, p.color);
        });
    }

    drawHold() {
        this.holdCtx.clearRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);
        if (!this.holdPiece) return;
        const size = 15;
        const matrix = this.holdPiece.matrix;
        const px = (this.holdCanvas.width - matrix[0].length * size) / 2;
        const py = (this.holdCanvas.height - matrix.length * size) / 2;
        this.drawMatrix(this.holdCtx, matrix, px, py, size, this.holdPiece.color);
    }

    drawControl() {
        if (!this.controlCtx) return;
        this.controlCtx.clearRect(0, 0, this.controlCanvas.width, this.controlCanvas.height);
        if (!this.currentPiece) return;
        const size = 12;
        const matrix = this.currentPiece.matrix;
        const px = (this.controlCanvas.width - matrix[0].length * size) / 2;
        const py = (this.controlCanvas.height - matrix.length * size) / 2;
        this.drawMatrix(this.controlCtx, matrix, px, py, size, this.currentPiece.color);
    }

    drawMatrix(ctx, matrix, x, y, size, color) {
        ctx.fillStyle = color;
        for (let r = 0; r < matrix.length; r++) {
            for (let c = 0; c < matrix[r].length; c++) {
                if (matrix[r][c]) {
                    ctx.fillRect(x + c * size, y + r * size, size, size);
                    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x + c * size, y + r * size, size, size);
                }
            }
        }
    }

    update(dt) {
        if (this.state !== 'PLAYING' && this.state !== 'GAMEOVER') return;

        // Juice updates
        if (this.shake > 0) this.shake *= 0.9;
        
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.5; // gravity
            p.life -= dt / 1000;
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        for (let i = this.flashes.length - 1; i >= 0; i--) {
            this.flashes[i].life -= dt / 500;
            if (this.flashes[i].life <= 0) this.flashes.splice(i, 1);
        }

        for (let i = this.popups.length - 1; i >= 0; i--) {
            const p = this.popups[i];
            p.life -= dt / 1000;
            p.y -= 1; // Float up
            if (p.life <= 0) this.popups.splice(i, 1);
        }

        if (this.state !== 'PLAYING') return;

        this.gameTime += dt;
        const sec = Math.floor(this.gameTime / 1000);
        const min = Math.floor(sec / 60);
        const s = sec % 60;
        document.getElementById('time-val').innerText = `${min}:${s.toString().padStart(2, '0')}`;

        if (!this.isPracticeMode) {
            this.panicTime -= dt / 1000;
            if (this.panicTime <= 0) this.autoDump();
        }
        
        const currentMax = this.getPanicDuration();
        const panicPercent = Math.max(0, 1 - (this.panicTime / currentMax));
        
        const timerVal = document.getElementById('timer-val');
        const clockHand = document.getElementById('clock-hand');
        const panicClock = document.getElementById('panic-clock');
        const isAltus = document.body.classList.contains('altus');
        
        timerVal.innerText = `${Math.floor(panicPercent * 100)}%`;
        clockHand.style.transform = `translateX(-50%) rotate(${panicPercent * 360}deg)`;

        // Color shift logic
        if (panicPercent > 0.8) {
            const color = '#ff3333';
            timerVal.style.color = color;
            clockHand.style.backgroundColor = color;
            panicClock.style.borderColor = color;
        } else if (panicPercent > 0.6) {
            const color = isAltus ? '#cc7722' : '#ff9900';
            timerVal.style.color = color;
            clockHand.style.backgroundColor = color;
            panicClock.style.borderColor = color;
        } else {
            // Reset to defaults
            timerVal.style.color = '';
            clockHand.style.backgroundColor = '';
            panicClock.style.borderColor = '';
        }

        const FALL_SPEED = Math.max(50, 400 / this.multiplier);
        this.activePieces.sort((a, b) => b.y - a.y);

        for (let i = this.activePieces.length - 1; i >= 0; i--) {
            const p = this.activePieces[i];
            p.fallTimer += dt;
            if (p.fallTimer >= FALL_SPEED) {
                p.fallTimer = 0;
                
                // Move down logic
                const hitsGrid = this.checkCollision(p.x, Math.floor(p.y) + 1, p.matrix, i, false);
                const hitsAny = this.checkCollision(p.x, Math.floor(p.y) + 1, p.matrix, i, true);

                if (hitsGrid) {
                    // Only settle if we hit the static grid or floor for 3 consecutive checks
                    p.settleTicks = (p.settleTicks || 0) + 1;
                    if (p.settleTicks >= 3) {
                        this.placePiece(p.x, Math.floor(p.y), p);
                        this.activePieces.splice(i, 1);
                    }
                } else if (!hitsAny) {
                    // Only move if we aren't blocked by another active piece
                    p.y += 1;
                    p.settleTicks = 0;
                }
                // If hitsAny but not hitsGrid, we just wait (stay active)
            }
        }
    }

    draw() {
        this.ctx.save();
        if (this.shake > 0.1) {
            const sx = (Math.random() - 0.5) * this.shake;
            const sy = (Math.random() - 0.5) * this.shake;
            this.ctx.translate(sx, sy);
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid
        const isAltus = document.body.classList.contains('altus');
        const gridColor = isAltus ? 'rgba(218, 165, 32, 0.05)' : 'rgba(255,255,255,0.03)';
        const colorSet = isAltus ? COLORS_ALTUS : COLORS;

        for (let r = 0; r < BOARD_HEIGHT; r++) {
            for (let c = 0; c < BOARD_WIDTH; c++) {
                if (this.grid[r][c]) {
                    this.drawBlock(c, r, colorSet[this.grid[r][c]]);
                } else {
                    this.ctx.strokeStyle = gridColor;
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                }
            }
        }

        // Draw Line Flashes
        const flashColor = isAltus ? '218, 165, 32' : '255, 255, 255';
        this.flashes.forEach(f => {
            this.ctx.fillStyle = `rgba(${flashColor}, ${f.life * 0.5})`;
            this.ctx.fillRect(0, f.y * BLOCK_SIZE, this.canvas.width, BLOCK_SIZE);
        });

        if (this.state === 'PLAYING') {
            const matrix = this.currentPiece.matrix;
            const ghostColor = isAltus ? 'rgba(218, 165, 32, 0.15)' : 'rgba(255, 255, 255, 0.1)';
            
            // Ghost at spawn
            this.drawPiece(this.handX, this.handY, matrix, ghostColor, true);
            // Loaded piece indicator at top
            this.drawPiece(this.handX, -1, matrix, this.currentPiece.color);
        }

        this.activePieces.forEach(p => this.drawPiece(p.x, p.y, p.matrix, p.color));

        // Draw particles
        this.particles.forEach(p => {
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.life;
            this.ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
        });
        this.ctx.globalAlpha = 1.0;

        // Draw Popups
        this.popups.forEach(p => {
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = Math.min(1.0, p.life * 2);
            this.ctx.font = 'bold 40px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
            this.ctx.shadowBlur = 10;
            this.ctx.fillText(p.text, p.x, p.y);
            this.ctx.shadowBlur = 0;
        });
        this.ctx.globalAlpha = 1.0;

        this.ctx.restore();
    }

    drawBlock(x, y, color, isGhost = false) {
        const px = x * BLOCK_SIZE;
        const py = y * BLOCK_SIZE;
        this.ctx.fillStyle = color;
        this.ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
        if (!isGhost) {
            // Pixel art highlight
            this.ctx.fillStyle = 'rgba(255,255,255,0.3)';
            this.ctx.fillRect(px, py, BLOCK_SIZE, 3); // top
            this.ctx.fillRect(px, py, 3, BLOCK_SIZE); // left
            
            this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
            this.ctx.fillRect(px, py + BLOCK_SIZE - 3, BLOCK_SIZE, 3); // bottom
            this.ctx.fillRect(px + BLOCK_SIZE - 3, py, 3, BLOCK_SIZE); // right

            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
        }
    }

    drawPiece(x, y, matrix, color, isGhost = false) {
        for (let r = 0; r < matrix.length; r++) {
            for (let c = 0; c < matrix[r].length; c++) {
                if (matrix[r][c]) this.drawBlock(x + c, y + r, color, isGhost);
            }
        }
    }

    loop(time = 0) {
        const dt = time - this.lastTime || 0;
        this.lastTime = time;
        this.update(dt);
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }
}

new Game();
