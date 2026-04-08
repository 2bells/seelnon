import { state } from 'app/state';

const defaultColors = [
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
            <span class="drag-handle"></span>
        </div>
        <div id="color-swatches"></div>
        <div id="color-picker-wrapper">
            <input type="color" id="colorPicker" value="${state.brush.color}">
        </div>
    `;
    return palette;
}

export function init(container) {
    const palette = createColorPalette();
    container.appendChild(palette);

    const colorPicker = palette.querySelector('#colorPicker');
    const colorSwatches = palette.querySelector('#color-swatches');
    const dragHandle = palette.querySelector('.drag-handle');

    // Populate swatches
    defaultColors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'swatch';
        swatch.style.backgroundColor = color;
        swatch.dataset.color = color;
        colorSwatches.appendChild(swatch);
    });
    
    function updateColor(newColor) {
        state.brush.color = newColor;
        colorPicker.value = newColor;
        // Also update the toolbar color picker
        const toolColorPicker = document.getElementById('toolColorPicker');
        if (toolColorPicker) {
            toolColorPicker.value = newColor;
        }
    }

    // Event Listeners
    colorPicker.addEventListener('input', (e) => {
        updateColor(e.target.value);
    });

    colorSwatches.addEventListener('click', (e) => {
        if (e.target.classList.contains('swatch')) {
            updateColor(e.target.dataset.color);
        }
    });

    // Update palette if eyedropper is used
    const mainCanvas = document.getElementById('drawing-canvas');
    mainCanvas.addEventListener('pointerdown', (e) => {
        if (e.altKey) {
            setTimeout(() => {
                colorPicker.value = state.brush.color;
            }, 50);
        }
    });

    // Draggable functionality
    let isDragging = false;
    let offsetX, offsetY;

    dragHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        palette.style.cursor = 'grabbing';
        offsetX = e.clientX - palette.getBoundingClientRect().left;
        offsetY = e.clientY - palette.getBoundingClientRect().top;
        e.preventDefault(); // Prevent text selection
    });

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