/**
 * Bonfire Hourly Chime - Holy3f Edition
 * Inspired by Dark Souls, Built with pure JS
 */

// Configuration
const KINDLED_SOUND_URL = '';
const EXTINGUISHED_SOUND_URL = '';
const ALARM_SOUND_URL = '';

class BonfireEngine {
    constructor() {
        this.audioCtx = null;
        this.volume = 0.5;
    }

    init() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    setVolume(val) {
        this.volume = parseFloat(val);
        updateYoutubeVolume(this.volume);
    }

    async playExternalSound(url) {
        if (!url) return false;
        try {
            const audio = new Audio(url);
            audio.volume = this.volume;
            await audio.play();
            return true;
        } catch (e) {
            console.warn("Failed to play external sound:", e);
            return false;
        }
    }

    async playKindledSound() {
        const played = await this.playExternalSound(KINDLED_SOUND_URL);
        if (!played) {
            // Fallback synthesized sound: A single bright chime
            this.init();
            const now = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(380, now); // A3
            osc.frequency.exponentialRampToValueAtTime(440, now + 0.5);
            
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(this.volume * 0.5, now + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
            
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            
            osc.start(now);
            osc.stop(now + 0.5);
        }
    }

    async playExtinguishedSound() {
        const played = await this.playExternalSound(EXTINGUISHED_SOUND_URL);
        if (!played) {
            // Fallback synthesized sound: A low fading hum
            this.init();
            const now = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(110, now); // A2
            osc.frequency.linearRampToValueAtTime(55, now + 1);
            
            gain.gain.setValueAtTime(this.volume * 0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1);
            
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            
            osc.start(now);
            osc.stop(now + 1);
        }
    }

    async playSong() {
        const played = await this.playExternalSound(ALARM_SOUND_URL);
        if (played) {
            duckYoutubeMusic(this.volume);
            return;
        }

        this.init();
        if (this.audioCtx.state === 'suspended') {
            await this.audioCtx.resume();
        }

        duckYoutubeMusic(this.volume);

        const now = this.audioCtx.currentTime;
        const masterGain = this.audioCtx.createGain();
        masterGain.gain.setValueAtTime(this.volume, now);
        masterGain.connect(this.audioCtx.destination);

        // Jazzy Bass Sequence: A1 -> E1 -> G1 -> A1
        const notes = [
            { freq: 55.00, time: 0, duration: 0.8 }, // A1
            { freq: 41.20, time: 0.8, duration: 0.6 }, // E1
            { freq: 49.00, time: 1.4, duration: 0.6 }, // G1
            { freq: 55.00, time: 2.0, duration: 1.5 }  // A1
        ];

        notes.forEach(note => {
            this.playTone(note.freq, now + note.time, note.duration, masterGain);
        });
    }

    playTone(freq, startTime, duration, masterGain) {
        const oscSub = this.audioCtx.createOscillator();
        const oscMid = this.audioCtx.createOscillator();
        const gainSub = this.audioCtx.createGain();
        const gainMid = this.audioCtx.createGain();
        const filter = this.audioCtx.createBiquadFilter();

        // Sub layer (Sine)
        oscSub.type = 'sine';
        oscSub.frequency.setValueAtTime(freq, startTime);
        
        gainSub.gain.setValueAtTime(0, startTime);
        gainSub.gain.linearRampToValueAtTime(0.4, startTime + 0.1);
        gainSub.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        oscSub.connect(gainSub);
        gainSub.connect(masterGain);

        // Mid layer (Triangle with lowpass)
        oscMid.type = 'triangle';
        oscMid.frequency.setValueAtTime(freq * 2, startTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, startTime);
        filter.frequency.exponentialRampToValueAtTime(100, startTime + duration);
        filter.Q.setValueAtTime(6, startTime);

        gainMid.gain.setValueAtTime(0, startTime);
        gainMid.gain.linearRampToValueAtTime(0.2, startTime + 0.1);
        gainMid.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        oscMid.connect(filter);
        filter.connect(gainMid);
        gainMid.connect(masterGain);

        oscSub.start(startTime);
        oscMid.start(startTime);
        oscSub.stop(startTime + duration);
        oscMid.stop(startTime + duration);
    }
}

const engine = new BonfireEngine();

// UI Elements
const timeDisplay = document.getElementById('time-display');
const countdownDisplay = document.getElementById('countdown-display');
const bonfire = document.getElementById('bonfire');
const toggleBtn = document.getElementById('toggle-btn');
const testBtn = document.getElementById('test-btn');
const volumeSlider = document.getElementById('volume-slider');
const statusText = document.getElementById('status-text');
const embersContainer = document.getElementById('embers');
const cycleBgBtn = document.getElementById('cycle-bg-btn');
const playlistSelect = document.getElementById('playlist-select');
const selectTrigger = playlistSelect.querySelector('.select-trigger');
const optionsList = playlistSelect.querySelector('.select-options-list');
const customUrlContainer = document.getElementById('custom-url-container');
const youtubeUrlInput = document.getElementById('youtube-url');
const loadYtBtn = document.getElementById('load-yt-btn');
const ytPlayer = document.getElementById('yt-player');
const asciiFireOuter = document.getElementById('ascii-fire-outer');
const asciiFireMid = document.getElementById('ascii-fire-mid');
const asciiFireCore = document.getElementById('ascii-fire-core');

const fireConfigs = [
    { name: 'Balanced', outerRadius: 7, coreRadius: 4, decayOuter: 0.08, decayCore: 0.3, driftStrength: 0.7 },
    { name: 'Wide', outerRadius: 10, coreRadius: 5, decayOuter: 0.2, decayCore: 0.4, driftStrength: 0.3 },
    { name: 'Tall', outerRadius: 8, coreRadius: 4, decayOuter: 0.05, decayCore: 0.35, driftStrength: 1.1 },
    { name: 'Pointy', outerRadius: 7, coreRadius: 3, decayOuter: 0.05, decayCore: 0.45, driftStrength: 1.3 }
];
let currentFireIndex = 0;

cycleBgBtn.addEventListener('click', () => {
    currentFireIndex = (currentFireIndex + 1) % fireConfigs.length;
    statusText.textContent = `Fire Type: ${fireConfigs[currentFireIndex].name}`;
});

// Playlist Loading
async function loadPlaylist() {
    try {
        const response = await fetch('playlist.json');
        const data = await response.json();
        if (data.playlist) {
            data.playlist.forEach(item => {
                const optDiv = document.createElement('div');
                optDiv.className = 'custom-option';
                optDiv.dataset.value = item.url;
                optDiv.textContent = item.name;
                optionsList.appendChild(optDiv);
            });
            setupCustomSelect();
        }
    } catch (e) {
        console.error("Failed to load playlist:", e);
        setupCustomSelect(); // Setup even if fetch fails to handle default options
    }
}

function setupCustomSelect() {
    selectTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        optionsList.classList.toggle('hidden');
    });

    optionsList.addEventListener('click', (e) => {
        const option = e.target.closest('.custom-option');
        if (!option) return;

        const val = option.dataset.value;
        const text = option.textContent;

        // Update trigger UI
        selectTrigger.textContent = text;
        
        // Highlight selected
        optionsList.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');

        // Logic
        if (val === 'custom') {
            customUrlContainer.classList.remove('hidden');
        } else {
            customUrlContainer.classList.add('hidden');
            if (val) {
                youtubeUrlInput.value = val;
                loadYoutubeFromUrl(val);
            }
        }

        optionsList.classList.add('hidden');
    });

    // Close on click outside
    document.addEventListener('click', () => {
        optionsList.classList.add('hidden');
    });
}

loadPlaylist();

function extractYoutubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function updateYoutubeVolume(volume) {
    if (ytPlayer && ytPlayer.src) {
        // YouTube volume is 0-100
        const ytVol = Math.floor(volume * 100);
        ytPlayer.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: 'setVolume',
            args: [ytVol]
        }), '*');
    }
}

function duckYoutubeMusic(originalVolume) {
    if (!ytPlayer || !ytPlayer.src) return;

    // Duck to 20% of original volume
    updateYoutubeVolume(originalVolume * 0.2);

    // Fade back up after chime (approx 3.5s sequence)
    setTimeout(() => {
        updateYoutubeVolume(originalVolume);
    }, 4000);
}

function loadYoutubeFromUrl(url) {
    const videoId = extractYoutubeId(url);
    if (videoId) {
        // Use autoplay=1 and enablejsapi=1 for better control
        ytPlayer.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&enablejsapi=1`;
        statusText.textContent = "Music Loaded. May the flames guide thee.";
        
        // Wait for player to load then set initial volume
        setTimeout(() => {
            updateYoutubeVolume(engine.volume);
        }, 2000);

        setTimeout(() => {
            statusText.textContent = isEnabled ? "The fire burns bright..." : "The fire fades...";
        }, 3000);
    } else {
        statusText.textContent = "Invalid YouTube Link.";
        setTimeout(() => {
            statusText.textContent = isEnabled ? "The fire burns bright..." : "The fire fades...";
        }, 2000);
    }
}

loadYtBtn.addEventListener('click', () => {
    const url = youtubeUrlInput.value.trim();
    if (!url) return;
    loadYoutubeFromUrl(url);
});

// ASCII Fire Simulation
const fireWidth = 40;
const fireHeight = 60;
const firePixels = new Array(fireWidth * fireHeight).fill(0);
const fireChars = " .:-=+*#%@";

function updateFire() {
    const config = fireConfigs[currentFireIndex];
    // Set bottom row to max intensity, but only in the center
    const baseIntensity = Math.floor(30 * fireIntensity);
    const center = Math.floor(fireWidth / 2);
    
    const outerRadius = config.outerRadius;
    const coreRadius = config.coreRadius;

    for (let x = 0; x < fireWidth; x++) {
        const dist = Math.abs(x - center);
        if (dist < outerRadius) {
            // Center is 100% stable, edges flicker
            const emissionProb = dist < coreRadius ? 1.0 : (1.0 - (dist / outerRadius) * 0.4);
            
            if (Math.random() < emissionProb) {
                // Gradient intensity: hotter in the center, cooler at edges
                const intensityRatio = 1 - Math.pow(dist / outerRadius, 2);
                let intensity = Math.floor(baseIntensity * intensityRatio);
                
                // No flicker in the very center
                const flickerAmount = dist < coreRadius ? 0 : 3;
                intensity -= Math.floor(Math.random() * flickerAmount);
                
                firePixels[(fireHeight - 1) * fireWidth + x] = Math.max(0, Math.min(fireChars.length - 1, intensity));
            } else {
                firePixels[(fireHeight - 1) * fireWidth + x] = 0;
            }
        } else {
            firePixels[(fireHeight - 1) * fireWidth + x] = 0;
        }
    }

    // Propagate fire upwards
    for (let y = 0; y < fireHeight - 1; y++) {
        for (let x = 0; x < fireWidth; x++) {
            const srcIdx = (y + 1) * fireWidth + x;
            const intensity = firePixels[srcIdx];
            
            if (intensity === 0) {
                firePixels[y * fireWidth + x] = 0;
                continue;
            }

            // Different decay for different intensities (heat)
            const decayProb = (intensity < 4) ? config.decayOuter : config.decayCore;
            let decay = (Math.random() < decayProb) ? 1 : 0;
            
            // Horizontal dissipation: pixels further from center lose intensity faster
            const dist = Math.abs(x - center);
            if (dist > coreRadius && Math.random() < 0.1) {
                decay += 1;
            }
            
            // Drift towards center as it goes up, but with more horizontal "noise" for embers
            const drift = (x < center) ? config.driftStrength : (x > center) ? -config.driftStrength : 0;
            
            // Add extra horizontal spread (embers)
            let horizontalShift = Math.floor(Math.random() * 3) - 1;
            if (Math.random() < 0.1) { // 10% chance for a "spark" jump
                horizontalShift += (Math.random() > 0.5 ? 3 : -3);
            }

            const dstX = Math.max(0, Math.min(fireWidth - 1, Math.round(x + drift + horizontalShift)));
            const dstIdx = y * fireWidth + dstX;
            
            const newIntensity = intensity - decay;
            firePixels[dstIdx] = Math.max(0, newIntensity);
            
            // Occasional "spark" that stays at low intensity but moves up faster
            if (Math.random() < 0.08 && intensity > 1 && y > 3) {
                const sparkX = Math.max(0, Math.min(fireWidth - 1, x + (Math.random() > 0.5 ? 4 : -4)));
                firePixels[(y - 3) * fireWidth + sparkX] = 1;
            }
        }
    }

    // Render to elements (layered by intensity)
    let outerOutput = "";
    let midOutput = "";
    let coreOutput = "";

    for (let y = 0; y < fireHeight; y++) {
        for (let x = 0; x < fireWidth; x++) {
            const intensity = firePixels[y * fireWidth + x];
            const char = fireChars[intensity];
            const dist = Math.abs(x - center);
            
            if (intensity >= 7 && dist < coreRadius) {
                coreOutput += char;
                midOutput += " ";
                outerOutput += " ";
            } else if (intensity >= 4 && dist < outerRadius) {
                coreOutput += " ";
                midOutput += char;
                outerOutput += " ";
            } else if (intensity >= 1) {
                // Outer flames and ashes spread more as they go up
                const allowedWidth = outerRadius + Math.floor((fireHeight - y) / 2.5);
                if (dist < allowedWidth) {
                    coreOutput += " ";
                    midOutput += " ";
                    outerOutput += char;
                } else {
                    coreOutput += " ";
                    midOutput += " ";
                    outerOutput += " ";
                }
            } else {
                coreOutput += " ";
                midOutput += " ";
                outerOutput += " ";
            }
        }
        outerOutput += "\n";
        midOutput += "\n";
        coreOutput += "\n";
    }
    
    asciiFireOuter.textContent = outerOutput;
    asciiFireMid.textContent = midOutput;
    asciiFireCore.textContent = coreOutput;
}

setInterval(updateFire, 100);

let isEnabled = false;
let lastChimeHour = null;
let lastChimeMinute = new Date().getMinutes();
let fireIntensity = 0.2;

// Embers System
function createEmber() {
    const ember = document.createElement('div');
    ember.className = 'ember';
    
    const startX = Math.random() * 100;
    const drift = (Math.random() - 0.5) * 200;
    const duration = 2 + Math.random() * 3;
    
    ember.style.left = startX + 'vw';
    ember.style.setProperty('--drift', drift + 'px');
    ember.style.setProperty('--duration', duration + 's');
    
    embersContainer.appendChild(ember);
    setTimeout(() => ember.remove(), duration * 1000);
}

setInterval(() => {
    // Spawn embers if fire is active or being stoked
    if (isEnabled || isPressing || fireIntensity > 0.3) {
        // Base count based on intensity
        let count = Math.max(1, Math.floor(fireIntensity * 2));
        
        // Extra burst if pressing
        if (isPressing) count += 3;
        
        for(let i=0; i<count; i++) createEmber();
    }
}, 300);

let isPressing = false;

// Interaction: Stoke the fire
bonfire.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    isPressing = true;
    document.body.classList.add('kindled');
});

window.addEventListener('pointerup', () => {
    isPressing = false;
});

window.addEventListener('pointercancel', () => {
    isPressing = false;
});

// Loop
function update() {
    const now = new Date();
    
    // Time
    const hours = now.getHours();
    const mins = String(now.getMinutes()).padStart(2, '0');
    timeDisplay.textContent = `${hours % 12 || 12}:${mins}`;

    // Countdown (Hourly)
    const minsToNext = 59 - now.getMinutes();
    const secsToNext = 59 - now.getSeconds();
    countdownDisplay.textContent = `Next lighting in ${String(minsToNext).padStart(2, '0')}:${String(secsToNext).padStart(2, '0')}`;

    // Chime
    const currentSecond = now.getSeconds();
    const currentMinute = now.getMinutes();

    if (isEnabled && currentMinute === 0 && currentSecond === 0 && lastChimeHour !== hours) {
        engine.playSong();
        lastChimeHour = hours;
        
        // Reset state as requested
        isEnabled = false;
        toggleBtn.classList.remove('active');
        document.body.classList.remove('is-kindled');
        toggleBtn.textContent = 'Ignite';
        statusText.textContent = 'The fire fades...';
        fireIntensity = 0.2;
        document.body.style.setProperty('--intensity', fireIntensity);
        
        // Visual Flare on alarm
        const flare = setInterval(() => {
            fireIntensity = 10;
            document.body.style.setProperty('--intensity', fireIntensity);
            setTimeout(() => {
                fireIntensity = 0.2;
                document.body.style.setProperty('--intensity', fireIntensity);
                clearInterval(flare);
            }, 1000);
        }, 100);
    }

    // Intensity Logic
    const baseline = isEnabled ? 0.8 : 0.2;
    if (isPressing) {
        // Grow intensity while pressing, cap at 4 (toned down from 8)
        fireIntensity = Math.min(4, fireIntensity + 0.15);
    } else {
        // Decay back to baseline
        if (fireIntensity > baseline) {
            fireIntensity -= 0.05;
        } else if (fireIntensity < baseline) {
            fireIntensity += 0.05; // Smooth transition if baseline changes
        }
        
        // Remove 'kindled' class when intensity is low enough
        if (fireIntensity <= baseline + 0.1) {
            document.body.classList.remove('kindled');
        }
    }
    document.body.style.setProperty('--intensity', fireIntensity);

    requestAnimationFrame(update);
}

// Drag to Scroll (Panning)
let isDragging = false;
let startY, startScrollTop;

window.addEventListener('mousedown', (e) => {
    // Only initiate drag if clicking on the background elements
    const isBackground = e.target === document.body || 
                         e.target.tagName === 'MAIN' || 
                         e.target.classList.contains('atmosphere') || 
                         e.target.classList.contains('vignette');
                         
    if (isBackground) {
        isDragging = true;
        startY = e.pageY;
        startScrollTop = window.scrollY;
        document.body.style.cursor = 'grabbing';
    }
});

window.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.cursor = 'default';
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const y = e.pageY;
    const walk = (y - startY);
    window.scrollTo(0, startScrollTop - walk);
});

// Controls
toggleBtn.addEventListener('click', () => {
    isEnabled = !isEnabled;
    toggleBtn.classList.toggle('active', isEnabled);
    document.body.classList.toggle('is-kindled', isEnabled);
    toggleBtn.textContent = isEnabled ? 'Kindled' : 'Ignite';
    statusText.textContent = isEnabled ? 'Humanity Restored' : 'The fire fades...';
    
    if (isEnabled) {
        engine.playKindledSound();
        fireIntensity = 0.8; // Small fire while kindled/waiting
    } else {
        engine.playExtinguishedSound();
        fireIntensity = 0.2; // Very small fire when not kindled
    }
    document.body.style.setProperty('--intensity', fireIntensity);
});

testBtn.addEventListener('click', () => {
    engine.playSong();
});

volumeSlider.addEventListener('input', (e) => {
    engine.setVolume(e.target.value);
});

update();