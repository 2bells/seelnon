import { state } from '../state.js';
import { scheduleSave } from '../storage.js';

const INITIAL_PALETTE = [
    '#ffffff', '#c1c1c1', '#6f6f6f', '#000000',
    '#ff453a', '#ff9f0a', '#ffd60a', '#32d74b',
    '#64d2ff', '#0a84ff', '#bf5af2', '#ff4f79',
    '#a2825f', '#8e6c4e', '#5c452b', '#2e2216'
];

function createColorPalette() {
    const palette = document.createElement('div');
    palette.id = 'color-palette';
    palette.innerHTML = `
        <div class="palette-header">
            <h3>Color Palette</h3>
            <div class="palette-header-actions">
                <button id="reset-palette-btn" title="Reset Palette">↺</button>
                <div class="drag-handle"></div>
            </div>
        </div>
        <div id="color-swatches"></div>
        <div id="color-preview-wrapper" style="position: relative;">
            <div id="color-preview-bar" title="Change color"></div>
            <input type="color" id="colorPicker" value="${state.brush.color}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; border: none; padding: 0;">
        </div>
    `;
    return palette;
}

export function init(container) {
    const palette = createColorPalette();
    container.appendChild(palette);

    const colorPicker = palette.querySelector('#colorPicker');
    const colorSwatches = palette.querySelector('#color-swatches');
    const colorPreviewBar = palette.querySelector('#color-preview-bar');
    const dragHandle = palette.querySelector('.drag-handle');
    const resetBtn = palette.querySelector('#reset-palette-btn');

    function renderSwatches() {
        colorSwatches.innerHTML = '';
        state.paletteColors.forEach((color, index) => {
            const swatch = document.createElement('div');
            swatch.className = 'swatch' + (state.selectedSwatchIndex === index ? ' active' : '');
            swatch.style.backgroundColor = color;
            swatch.dataset.index = index;
            colorSwatches.appendChild(swatch);
        });
        updatePreviewBar();
    }

    function updatePreviewBar() {
        if (colorPreviewBar) {
            colorPreviewBar.style.backgroundColor = state.brush.color;
        }
    }

    function updateActiveSwatch(newColor) {
        if (state.selectedSwatchIndex !== null && state.selectedSwatchIndex !== undefined) {
            state.paletteColors[state.selectedSwatchIndex] = newColor;
            const swatches = colorSwatches.querySelectorAll('.swatch');
            const activeSwatch = swatches[state.selectedSwatchIndex];
            if (activeSwatch) {
                activeSwatch.style.backgroundColor = newColor;
            }
            scheduleSave();
        }
    }
    
    function updateColor(newColor, fromPicker = false) {
        state.brush.color = newColor;
        colorPicker.value = newColor;
        updatePreviewBar();
        
        if (fromPicker) {
            updateActiveSwatch(newColor);
        }

        // Also update the toolbar color picker
        const toolColorPicker = document.getElementById('toolColorPicker');
        if (toolColorPicker) {
            toolColorPicker.value = newColor;
        }
        
        // Update brush editor if visible
        window.dispatchEvent(new CustomEvent('activeBrushChanged'));
    }

    // Initial render
    renderSwatches();
    updatePreviewBar();

    // Event Listeners
    colorPicker.addEventListener('input', (e) => {
        updateColor(e.target.value, true);
    });
    
    // Listen for color changes from other sources (eyedropper, toolbar)
    window.addEventListener('activeBrushChanged', () => {
        if (colorPicker.value !== state.brush.color) {
            colorPicker.value = state.brush.color;
            updatePreviewBar();
        }
    });

    colorSwatches.addEventListener('click', (e) => {
        const swatch = e.target.closest('.swatch');
        if (swatch) {
            const index = parseInt(swatch.dataset.index);
            state.selectedSwatchIndex = index;
            
            // Update active class
            colorSwatches.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            
            updateColor(state.paletteColors[index], false);
            scheduleSave();
        }
    });

    resetBtn.addEventListener('click', () => {
        state.paletteColors = [...INITIAL_PALETTE];
        renderSwatches();
        // Sync color with the currently selected swatch after reset
        if (state.selectedSwatchIndex !== null) {
            updateColor(state.paletteColors[state.selectedSwatchIndex], false);
        }
        scheduleSave();
    });

    // Update palette if eyedropper is used
    const mainCanvas = document.getElementById('drawing-canvas');
    mainCanvas.addEventListener('pointerdown', (e) => {
        if (e.altKey) {
            setTimeout(() => {
                colorPicker.value = state.brush.color;
                // When picking with eyedropper, do we want to update the swatch too?
                // The user said "when I pick a color and then adjust it, it also changes the preset color"
                // So if eyedropper is used, we just update the picker, but maybe not the swatch until they adjust it?
                // Let's stick to user's literal request: "pick a color [swatch] and THEN adjust it".
            }, 50);
        }
    });

    // Draggable functionality
    let isDragging = false;
    let offsetX, offsetY;

    const startDrag = (e) => {
        // Only start drag if specifically hitting the handle OR the header text (not buttons)
        if (e.target.closest('#reset-palette-btn')) return;
        
        isDragging = true;
        palette.style.cursor = 'grabbing';
        offsetX = e.clientX - palette.getBoundingClientRect().left;
        offsetY = e.clientY - palette.getBoundingClientRect().top;
        e.preventDefault(); // Prevent text selection
    };

    dragHandle.addEventListener('mousedown', startDrag);
    // Allow dragging by the header too for convenience, but exclude buttons
    palette.querySelector('.palette-header').addEventListener('mousedown', startDrag);

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        // Calculate new position, keep within window bounds
        let newLeft = e.clientX - offsetX;
        let newTop = e.clientY - offsetY;

        // Clamp to window boundaries
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - palette.offsetWidth));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - palette.offsetHeight));

        palette.style.left = `${newLeft}px`;
        palette.style.top = `${newTop}px`;
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            palette.style.cursor = 'grab'; // Or default cursor
        }
    });
}
