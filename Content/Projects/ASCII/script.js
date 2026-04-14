import stars from './stars.js';
import rain from './rain.js';
import waterfall from './waterfall.js';
import fire from './fire.js';
import fire2 from './fire_2nd_type.js';
import smoke from './smoke.js';
import typewriter from './typewriter.js';
import donut from './donut.js';
import ripples from './ripples.js';
import leaves from './leaves.js';
import sand from './sand.js';
import shapes from './shapes.js';
import shapes2 from './shapes_2.js';
import { WIDTH, HEIGHT } from './utils.js';

const canvas = document.getElementById('ascii-canvas');
const statusScene = document.getElementById('status-scene');
const navBtns = document.querySelectorAll('.nav-btn[data-scene]');

// Navigation Elements
const settingsToggle = document.getElementById('settings-toggle');
const settingsSidebar = document.getElementById('settings-sidebar');
const settingsClose = document.getElementById('settings-close');
const sceneNavToggle = document.getElementById('scene-nav-toggle');
const sceneNavClose = document.getElementById('scene-nav-close');
const verticalNav = document.getElementById('vertical-nav');
const settingsContent = document.getElementById('settings-content');
const globalColorPicker = document.getElementById('global-color-picker');
const applyColorBtn = document.getElementById('apply-color-btn');
const clearColorBtn = document.getElementById('clear-color-btn');
const ytLinkInput = document.getElementById('yt-link-input');
const loadYtBtn = document.getElementById('load-yt-btn');
const toggleYtBtn = document.getElementById('toggle-yt-btn');
const ytPlayerContainer = document.getElementById('yt-player-container');
const volumeSlider = document.getElementById('global-volume');
const volumeVal = document.getElementById('val-volume');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');

const ambienceMap = {
    stars: 'https://youtu.be/jfKfPfyJRdk',
    rain: 'https://youtu.be/mPZkdNFkNps?si=hMfgo3ih2HLuWK3c',
    waterfall: 'https://youtu.be/mI9m_Z-tZ-I',
    fire: 'https://youtu.be/L_LUpnjuyP0',
    fire2: 'https://youtu.be/L_LUpnjuyP0',
    smoke: 'https://youtu.be/H-0cEclMils',
    typewriter: 'https://youtu.be/5wRWniH7rt8',
    donut: 'https://youtu.be/4xDzrJKXOOY',
    ripples: 'https://youtu.be/77ZozI0rw7w',
    leaves: 'https://youtu.be/mX7Xv_6Yv_Y',
    sand: 'https://youtu.be/2OEL4P1Rz04',
    shapes: 'https://youtu.be/8_X2_X_X_X8',
    shapes2: 'https://youtu.be/8_X2_X_X_X8'
};

const scenes = { stars, rain, waterfall, fire, fire2, smoke, typewriter, donut, ripples, leaves, sand, shapes, shapes2 };

let currentSceneId = 'stars';
let intervalId = null;
let zoomLevel = 1.0;
let ytPlaying = true;

// Mouse tracking
const mouse = { x: -100, y: -100, active: false };

function buildSettingsUI(sceneId) {
    const scene = scenes[sceneId];
    settingsContent.innerHTML = '';
    
    if (!scene.settings) {
        settingsContent.innerHTML = '<p style="font-size: 10px; color: #52525b;">NO PARAMETERS AVAILABLE</p>';
        return;
    }

    Object.entries(scene.settings).forEach(([key, config]) => {
        const group = document.createElement('div');
        group.className = 'setting-group';
        
        const currentValue = scene.params ? scene.params[key] : 0;

        if (config.options) {
            // Dropdown for discrete options
            group.innerHTML = `
                <label>${config.label}</label>
                <select id="select-${key}" class="scene-select">
                    ${config.options.map(opt => `<option value="${opt}" ${opt === currentValue ? 'selected' : ''}>${opt.toUpperCase()}</option>`).join('')}
                </select>
            `;
            const select = group.querySelector('select');
            select.addEventListener('change', (e) => {
                if (scene.params) {
                    scene.params[key] = e.target.value;
                    // Re-init if needed
                    if (scene.init) scene.init();
                }
            });
        } else {
            // Range slider for numeric values
            group.innerHTML = `
                <label>
                    ${config.label}
                    <span id="val-${key}">${typeof currentValue === 'number' ? currentValue.toFixed(2) : currentValue}</span>
                </label>
                <input type="range" 
                       min="${config.min}" 
                       max="${config.max}" 
                       step="${config.step}" 
                       value="${currentValue}">
            `;

            const input = group.querySelector('input');
            input.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                if (scene.params) {
                    scene.params[key] = val;
                    group.querySelector(`#val-${key}`).textContent = val.toFixed(2);
                    
                    if (key === 'density' || key === 'starCount') {
                        scene.init();
                    }

                    if (key === 'fps') {
                        scene.fps = val;
                        switchScene(currentSceneId);
                    }
                }
            });
        }

        settingsContent.appendChild(group);
    });
}

function switchScene(sceneId) {
    if (intervalId) clearInterval(intervalId);
    currentSceneId = sceneId;

    // Initialize audio context on first interaction
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    navBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.scene === sceneId);
    });
    statusScene.textContent = `SCENE: ${sceneId.toUpperCase()}`;
    canvas.className = `scene-${sceneId}`;

    // Load default ambience if available
    if (ambienceMap[sceneId]) {
        ytLinkInput.value = ambienceMap[sceneId];
        loadYouTube();
    }

    const scene = scenes[sceneId];
    scene.init();
    
    buildSettingsUI(sceneId);
    
    intervalId = setInterval(() => {
        const output = scene.update(mouse, { playSound });
        if (scene.useHTML) {
            canvas.innerHTML = output;
        } else {
            canvas.textContent = output;
        }
    }, 1000 / scene.fps);
}

// --- AUDIO SYSTEM ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const soundBuffers = {};
let globalVolume = 0.5;

async function loadSound(name, url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength === 0) throw new Error('Empty audio file');
        soundBuffers[name] = await audioCtx.decodeAudioData(arrayBuffer);
    } catch (e) {
        console.warn(`Failed to load sound "${name}", using procedural fallback.`, e);
    }
}

function playProceduralSound(type, playbackRate = 1.0) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    if (type === 'keyboard_key') {
        // Cello-like plucked bass sound
        osc.type = 'sawtooth';
        // Low C (C2) adjusted by playback rate
        const baseFreq = 65.41; 
        osc.frequency.setValueAtTime(baseFreq * playbackRate, audioCtx.currentTime);
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, audioCtx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.4);
        
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(globalVolume * 0.4, audioCtx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
    } else if (type === 'type_swipe') {
        // White noise "whoosh"
        const bufferSize = audioCtx.sampleRate * 0.3;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, audioCtx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3);
        
        gain.gain.setValueAtTime(globalVolume * 0.1, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        noise.start();
    }
}

function playSound(name, playbackRate = 1.0) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    if (soundBuffers[name]) {
        const source = audioCtx.createBufferSource();
        source.buffer = soundBuffers[name];
        source.playbackRate.value = playbackRate;
        
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = globalVolume;
        
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        source.start(0);
    } else {
        // Fallback to procedural sounds
        playProceduralSound(name, playbackRate);
    }
}

// Preload sounds
loadSound('keyboard_key', 'keyboard_key.mp3');
loadSound('type_swipe', 'type_swipe.mp3');

// --- EVENT LISTENERS ---

globalColorPicker.addEventListener('input', (e) => {
    document.documentElement.style.setProperty('--user-color', e.target.value);
});

applyColorBtn.addEventListener('click', () => {
    canvas.classList.add('override-colors');
});

clearColorBtn.addEventListener('click', () => {
    canvas.classList.remove('override-colors');
});

volumeSlider.addEventListener('input', (e) => {
    globalVolume = parseFloat(e.target.value);
    volumeVal.textContent = `${Math.round(globalVolume * 100)}%`;
    updateYoutubeVolume(globalVolume);
});

function updateYoutubeVolume(volume) {
    const iframe = ytPlayerContainer.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
        const ytVol = Math.floor(volume * 100);
        iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: 'setVolume',
            args: [ytVol]
        }), '*');
    }
}

function duckYoutubeMusic() {
    const iframe = ytPlayerContainer.querySelector('iframe');
    if (!iframe) return;

    // Duck to 20% of original volume
    updateYoutubeVolume(globalVolume * 0.2);

    // Fade back up after chime (approx 4s)
    setTimeout(() => {
        updateYoutubeVolume(globalVolume);
    }, 4000);
}

function loadYouTube() {
    const val = ytLinkInput.value.trim();
    if (!val) {
        ytPlayerContainer.innerHTML = '';
        return;
    }

    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = val.match(regExp);
    let videoId = (match && match[2].length === 11) ? match[2] : null;

    // Fallback: if no match but value is 11 chars, assume it's the ID
    if (!videoId && val.length === 11) {
        videoId = val;
    }

    if (videoId) {
        ytPlayerContainer.innerHTML = '';
        ytPlaying = true;
        const iframe = document.createElement('iframe');
        iframe.width = "1";
        iframe.height = "1";
        // Use youtube-nocookie.com for better compatibility and privacy
        // Add mute=1 to prevent jump scares, then unmute after setting volume
        iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&enablejsapi=1&mute=1`;
        iframe.frameBorder = "0";
        iframe.allow = "autoplay; encrypted-media";
        ytPlayerContainer.appendChild(iframe);

        // Set initial volume and unmute after a short delay to ensure API is ready
        setTimeout(() => {
            updateYoutubeVolume(globalVolume);
            // Unmute command
            const iframeEl = ytPlayerContainer.querySelector('iframe');
            if (iframeEl && iframeEl.contentWindow) {
                iframeEl.contentWindow.postMessage(JSON.stringify({
                    event: 'command',
                    func: 'unMute',
                    args: []
                }), '*');
            }
        }, 1500);
    } else {
        console.warn("Invalid YouTube ID/URL");
    }
}

loadYtBtn.addEventListener('click', loadYouTube);

toggleYtBtn.addEventListener('click', () => {
    const iframe = ytPlayerContainer.querySelector('iframe');
    if (!iframe || !iframe.contentWindow) return;
    
    ytPlaying = !ytPlaying;
    const command = ytPlaying ? 'playVideo' : 'pauseVideo';
    
    iframe.contentWindow.postMessage(JSON.stringify({
        event: 'command',
        func: command,
        args: []
    }), '*');
});

ytLinkInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadYouTube();
});

settingsToggle.addEventListener('click', () => {
    settingsSidebar.classList.add('open');
    settingsToggle.classList.add('hidden');
});

settingsClose.addEventListener('click', () => {
    settingsSidebar.classList.remove('open');
    settingsToggle.classList.remove('hidden');
});

sceneNavToggle.addEventListener('click', () => {
    verticalNav.classList.add('open');
    sceneNavToggle.classList.add('hidden');
});

sceneNavClose.addEventListener('click', () => {
    verticalNav.classList.remove('open');
    sceneNavToggle.classList.remove('hidden');
});

navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        switchScene(btn.dataset.scene);
        // Auto-close nav on mobile or for cleaner feel
        if (window.innerWidth < 768) {
            verticalNav.classList.remove('open');
            sceneNavToggle.classList.remove('hidden');
        }
    });
});

zoomInBtn.addEventListener('click', () => {
    zoomLevel = Math.min(3.0, zoomLevel + 0.1);
    canvas.style.transform = `scale(${zoomLevel})`;
});

zoomOutBtn.addEventListener('click', () => {
    zoomLevel = Math.max(0.5, zoomLevel - 0.1);
    canvas.style.transform = `scale(${zoomLevel})`;
});

// Update mouse coordinates relative to the canvas
document.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    // Convert screen pixels to ASCII grid units
    mouse.x = ((e.clientX - rect.left) / rect.width) * WIDTH;
    mouse.y = ((e.clientY - rect.top) / rect.height) * HEIGHT;
    mouse.active = true;
});

document.addEventListener('mouseleave', () => {
    mouse.active = false;
});

// Start with default scene
switchScene('stars');
