import { state } from '../state.js';
import { scheduleSave } from '../storage.js';

const INITIAL_PALETTE = [
    '#FF3B30', '#FF9500', '#FFCC00', '#4CD964', 
    '#5AC8FA', '#007AFF', '#5856D6', '#AF52DE', 
    '#FF2D55', '#A2845E', '#FFFFFF', '#D1D1D6', 
    '#8E8E93', '#3A3A3C', '#1C1C1E', '#000000'
];

// Color utilities
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h, s, l };
}

function hslToHex(h, s, l) {
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return rgbToHex(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
}

function mixColors(color1, color2, weight = 0.5) {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    if (!c1 || !c2) return color1;
    const r = Math.round(c1.r * (1 - weight) + c2.r * weight);
    const g = Math.round(c1.g * (1 - weight) + c2.g * weight);
    const b = Math.round(c1.b * (1 - weight) + c2.b * weight);
    return rgbToHex(r, g, b);
}

function adjustSaturation(hex, factor) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return hslToHex(h, s * factor, l);
}

const PALETTE_PRESETS = {
    DEFAULT: INITIAL_PALETTE,
    BW: [
        '#000000', '#222222', '#444444', '#666666', '#888888', '#AAAAAA', '#CCCCCC', '#FFFFFF', // B&W
        '#2D1A12', '#432D1D', '#5D4433', '#7D6452', '#9E8472', '#BFAB9B', '#DFD1C5', '#F5EFEB'  // Sepia
    ],
    SKIN: [
        '#2D1D19', '#3D2B1F', '#4D3B2B', '#5D4B3B', '#7A5A4A', '#8D6E5D', '#A67B5B', '#C68642',
        '#D2996C', '#E0AC69', '#F1C27D', '#FFDBAC', '#FFEDD5', '#FFF5E6', '#FFFFFF', '#000000'
    ],
    LANDSCAPE: [
        '#FFFFFF', // Titanium White
        '#FFF600', // Cadmium Yellow
        '#CB9D06', // Yellow Ochre
        '#E3A857', // Indian Yellow
        '#FF0000', // Bright Red
        '#E32636', // Alizarin Crimson
        '#3C1414', // Dark Sienna
        '#58463E', // Van Dyke Brown
        '#507D2A', // Sap Green
        '#102E3C', // Phthalo Green
        '#003153', // Prussian Blue
        '#000F89', // Phthalo Blue
        '#000000', // Midnight Black
        '#41194B', // Dioxazine Purple (Common extra)
        '#888888', // Neutral Gray (Thinner)
        '#F5EFEB'  // Canvas
    ]
};

function createColorPalette() {
    const palette = document.createElement('div');
    palette.id = 'color-palette';
    palette.className = 'floating-panel';
    
    // Position/Visibility initialization immediately before appending or showing
    const loadSavedState = () => {
        const savedPos = localStorage.getItem('color-palette-pos');
        if (savedPos) {
            try {
                const { left, top } = JSON.parse(savedPos);
                palette.style.left = `${left}px`;
                palette.style.top = `${top}px`;
                palette.style.right = 'auto';
                palette.style.bottom = 'auto';
            } catch (e) {
                console.error("Failed to load palette position", e);
                palette.style.left = '20px';
                palette.style.top = '20px';
            }
        } else {
            palette.style.left = '20px';
            palette.style.top = '20px';
            palette.style.right = 'auto';
            palette.style.bottom = 'auto';
        }

        const savedVisibility = localStorage.getItem('color-palette-visible');
        if (savedVisibility === 'true') {
            palette.classList.add('visible');
            const toggle = document.getElementById('colorPaletteToggle');
            if (toggle) toggle.classList.add('active');
        }
    };

    loadSavedState();

    palette.innerHTML = `
        <div id="color-swatches"></div>
        <div class="palette-bottom-menu">
            <button id="palette-menu-toggle">MENU</button>
            <div id="palette-slide-menu" class="hidden">
                 <div class="palette-preset-icons">
                    <button class="preset-btn" data-preset="DEFAULT" title="Modern Vibrant">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10V6a2 2 0 0 0-2-2h-3.93a2 2 0 0 1-1.66-.9l-.82-1.2a2 2 0 0 0-1.66-.9H12Z"/></svg>
                    </button>
                    <button class="preset-btn" data-preset="BW" title="Monochrome & Sepia">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20z"/></svg>
                    </button>
                    <button class="preset-btn" data-preset="SKIN" title="Professional Skin">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.82-2.82L7 15"/></svg>
                    </button>
                    <button class="preset-btn" data-preset="LANDSCAPE" title="Happy Accidents (Bob Ross)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>
                    </button>
                 </div>
            </div>
        </div>
        <input type="color" id="colorPicker" value="${state.brush.color}" style="position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none;">
    `;
    return palette;
}

export function init(container) {
    const palette = createColorPalette();
    container.appendChild(palette);

    const colorPicker = palette.querySelector('#colorPicker');
    const colorSwatches = palette.querySelector('#color-swatches');
    const menuToggle = palette.querySelector('#palette-menu-toggle');
    const slideMenu = palette.querySelector('#palette-slide-menu');

    function renderSwatches() {
        colorSwatches.innerHTML = '';
        const centerX = 120;
        const centerY = 120;
        const numMain = state.paletteColors.length;

        // Ring 0: Outer (Main colors) - SIZE: 28px
        const r0 = 100;
        state.paletteColors.forEach((color, index) => {
            const angle = (index / numMain) * Math.PI * 2 - Math.PI / 2;
            const x = centerX + Math.cos(angle) * r0;
            const y = centerY + Math.sin(angle) * r0;
            
            const swatch = createSwatch(color, index, x, y, false, 28);
            colorSwatches.appendChild(swatch);
        });

        // Ring 1: In-betweens (Mixed) - SIZE: 22px
        const r1 = 76;
        for (let i = 0; i < numMain; i++) {
            const c1 = state.paletteColors[i];
            const c2 = state.paletteColors[(i + 1) % numMain];
            const mixedColor = mixColors(c1, c2, 0.5);
            
            const angle = ((i + 0.5) / numMain) * Math.PI * 2 - Math.PI / 2;
            const x = centerX + Math.cos(angle) * r1;
            const y = centerY + Math.sin(angle) * r1;
            
            const swatch = createSwatch(mixedColor, null, x, y, true, 22, `Mixed branch`);
            colorSwatches.appendChild(swatch);
        }

        // Ring 2: Desaturated of Ring 0 - SIZE: 18px
        const r2 = 52;
        state.paletteColors.forEach((color, index) => {
            const desatColor = adjustSaturation(color, 0.4);
            const angle = (index / numMain) * Math.PI * 2 - Math.PI / 2;
            const x = centerX + Math.cos(angle) * r2;
            const y = centerY + Math.sin(angle) * r2;
            
            const swatch = createSwatch(desatColor, null, x, y, true, 18, `Toned branch`);
            colorSwatches.appendChild(swatch);
        });

        // Ring 3: Center - SIZE: 14px
        const r3 = 28;
        for (let i = 0; i < numMain; i+=2) {
             const color = state.paletteColors[i];
             const innerMost = adjustSaturation(color, 0.1);
             const angle = (i / numMain) * Math.PI * 2 - Math.PI / 2;
             const x = centerX + Math.cos(angle) * r3;
             const y = centerY + Math.sin(angle) * r3;
             const swatch = createSwatch(innerMost, null, x, y, true, 14, `Neutral core`);
             colorSwatches.appendChild(swatch);
        }
    }

    function createSwatch(color, index, x, y, isGenerated, size, title = '') {
        const swatch = document.createElement('div');
        swatch.className = 'swatch';
        if (isGenerated) swatch.classList.add('generated');
        if (index !== null && state.selectedSwatchIndex === index) swatch.classList.add('active');
        
        swatch.style.backgroundColor = color;
        swatch.style.left = `${x}px`;
        swatch.style.top = `${y}px`;
        swatch.style.width = `${size}px`;
        swatch.style.height = `${size}px`;
        
        if (index !== null) swatch.dataset.index = index;
        if (title) swatch.title = title;
        
        return swatch;
    }

    function updateActiveSwatch(newColor) {
        // "Vertically dependant" coordination: only shift the branch starting from selected swatch
        if (state.selectedSwatchIndex !== null && state.selectedSwatchIndex !== undefined) {
             state.paletteColors[state.selectedSwatchIndex] = newColor;
        }

        renderSwatches();
        scheduleSave();
    }
    
    function updateColor(newColor, fromPicker = false) {
        state.brush.color = newColor;
        
        if (state.activeBrushPresetId) {
            state.brushWorkInProgress[state.activeBrushPresetId] = structuredClone(state.brush);
        }

        colorPicker.value = newColor;
        
        // Vertically dependent: only update the tree branches if it's the selected swatch
        if (fromPicker) {
            updateActiveSwatch(newColor);
        }

        const toolColorPicker = document.getElementById('toolColorPicker');
        if (toolColorPicker) {
            toolColorPicker.value = newColor;
        }
        
        window.dispatchEvent(new CustomEvent('activeBrushChanged'));
    }

    renderSwatches();

    colorPicker.addEventListener('input', (e) => {
        updateColor(e.target.value, true);
    });
    
    window.addEventListener('activeBrushChanged', () => {
        // Always sync the palette tree when color changes, even from outside
        if (colorPicker.value !== state.brush.color) {
            colorPicker.value = state.brush.color;
        }
        updateActiveSwatch(state.brush.color);
    });

    colorSwatches.addEventListener('click', (e) => {
        const swatch = e.target.closest('.swatch');
        if (swatch) {
            const index = swatch.dataset.index ? parseInt(swatch.dataset.index) : null;
            
            colorSwatches.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');

            if (index !== null) {
                state.selectedSwatchIndex = index;
            } else {
                state.selectedSwatchIndex = null;
            }
            
            const color = window.getComputedStyle(swatch).backgroundColor;
            const rgb = color.match(/\d+/g);
            if (rgb) {
                const hex = rgbToHex(parseInt(rgb[0]), parseInt(rgb[1]), parseInt(rgb[2]));
                updateColor(hex, false);
            }
            scheduleSave();
        }
    });

    menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        slideMenu.classList.toggle('hidden');
        menuToggle.textContent = slideMenu.classList.contains('hidden') ? 'MENU' : 'CLOSE';
    });

    palette.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const presetKey = btn.dataset.preset;
            if (PALETTE_PRESETS[presetKey]) {
                state.paletteColors = [...PALETTE_PRESETS[presetKey]];
                renderSwatches();
                // Pick the first color of new palette if we had something selected
                if (state.selectedSwatchIndex !== null) {
                    updateColor(state.paletteColors[state.selectedSwatchIndex], false);
                }
                slideMenu.classList.add('hidden');
                menuToggle.textContent = 'MENU';
                scheduleSave();
            }
        });
    });

    const mainCanvas = document.getElementById('drawing-canvas');
    mainCanvas.addEventListener('pointerdown', (e) => {
        if (e.altKey) {
            setTimeout(() => {
                colorPicker.value = state.brush.color;
            }, 50);
        }
    });

    let isDragging = false;
    let offsetX, offsetY;

    const startDrag = (e) => {
        if (e.target.closest('.palette-bottom-menu') || e.target.closest('.swatch')) return;
        isDragging = true;
        palette.style.cursor = 'grabbing';
        offsetX = e.clientX - palette.getBoundingClientRect().left;
        offsetY = e.clientY - palette.getBoundingClientRect().top;
        e.preventDefault(); 
    };

    palette.addEventListener('mousedown', startDrag);

    // Failsafe to keep palette in view
    const keepInView = () => {
        const rect = palette.getBoundingClientRect();
        if (rect.width === 0) return; // Not visible/rendered yet
        let newLeft = rect.left;
        let newTop = rect.top;

        if (rect.right > window.innerWidth) newLeft = window.innerWidth - rect.width - 20;
        if (rect.bottom > window.innerHeight) newTop = window.innerHeight - rect.height - 20;
        if (rect.left < 0) newLeft = 20;
        if (rect.top < 0) newTop = 20;

        palette.style.left = `${newLeft}px`;
        palette.style.top = `${newTop}px`;
    };

    // Use ResizeObserver for more reliable failsafe instead of just event listener
    const ro = new ResizeObserver(() => {
        if (palette.classList.contains('visible')) {
            keepInView();
        }
    });
    ro.observe(palette);

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let newLeft = e.clientX - offsetX;
        let newTop = e.clientY - offsetY;
        
        // Boundaries
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - palette.offsetWidth));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - palette.offsetHeight));
        
        palette.style.left = `${newLeft}px`;
        palette.style.top = `${newTop}px`;
        
        localStorage.setItem('color-palette-pos', JSON.stringify({ left: newLeft, top: newTop }));
    });

    window.addEventListener('resize', keepInView);
    
    // Watch for visibility changes to save them
    const observer = new MutationObserver(() => {
        const isVisible = palette.classList.contains('visible');
        localStorage.setItem('color-palette-visible', isVisible);
    });
    observer.observe(palette, { attributes: true, attributeFilter: ['class'] });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            palette.style.cursor = ''; 
        }
    });
}
