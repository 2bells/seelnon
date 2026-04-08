import { init as initCanvas, startDrawingLoop, clearCanvas } from './canvas';
import { init as initEvents } from './events';
import { state } from './state';
import { loadState } from './storage';
import { init as initBrushEditor } from './brush/editor';
import { init as initColorPalette } from './ui/palette';
import { init as initExport } from './export';

function main() {
    const canvas = document.getElementById('drawing-canvas');
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }

    loadState();
    
    // Create status indicator (if not already in index.html)
    // const statusIndicator = document.createElement('div');
    // statusIndicator.id = 'status-indicator';
    // document.body.appendChild(statusIndicator);

    initCanvas(canvas);
    initEvents(canvas); // Initialize events AFTER loading state, as events.js sets the initial zoom indicator
    startDrawingLoop();
    
    initBrushEditor(document.getElementById('brush-editor-container'));
    initColorPalette(document.getElementById('color-palette-container'));
    initExport();
    initUI();

    console.log("Endless Canvas Initialized.");
}

function initUI() {
    const clearCanvasBtn = document.getElementById('clearCanvas');
    const brushEditorToggle = document.getElementById('brushEditorToggle');
    const colorPaletteToggle = document.getElementById('colorPaletteToggle');
    
    const brushToolBtn = document.getElementById('pen-brush-tool');
    const wireframeBrushBtn = document.getElementById('wireframe-brush-tool');
    const pixelBrushBtn = document.getElementById('pixel-brush-tool');
    const sketchyBrushBtn = document.getElementById('sketchy-brush-tool');
    const eraserToolBtn = document.getElementById('eraser-tool');
    const toolColorPicker = document.getElementById('toolColorPicker');
    const selectionToolBtn = document.getElementById('selection-tool');

    const brushEditor = document.getElementById('brush-editor');
    const colorPalette = document.getElementById('color-palette');

    const instructionsToggle = document.getElementById('instructions-toggle');
    const instructionsPanel = document.getElementById('instructions');

    // Get all dropdown items for presets
    const presetButtons = document.querySelectorAll('.tool-dropdown-item');

    // Function to set the active tool and brush preset
    function setActiveTool(toolName, presetId = null) {
        state.activeTool = toolName; // Set the overall active tool (brush, eraser, selection)

        // Clear active class from all main tool buttons and dropdown items
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        presetButtons.forEach(btn => btn.classList.remove('active'));

        if (toolName === 'brush') {
            let actualPresetId = presetId;
            if (!actualPresetId) {
                // If no preset ID is provided, try to find the last active preset for the baseType
                const currentBaseType = state.brushPresets[state.activeBrushPresetId]?.baseType || 'pen';
                actualPresetId = Object.keys(state.brushPresets).find(id => 
                    state.brushPresets[id].baseType === currentBaseType && state.brushPresets[id].name === state.brush.name
                ) || state.activeBrushPresetId; // Fallback to current or default
            }
            
            // Load the new preset into state.brush
            const newPreset = state.brushPresets[actualPresetId];
            if (newPreset) {
                state.brush = structuredClone(newPreset);
                state.activeBrushPresetId = actualPresetId;
            } else {
                // Fallback to default pen if preset not found
                state.brush = structuredClone(state.brushPresets['pen-default']);
                state.activeBrushPresetId = 'pen-default';
            }
            
            // Activate the main button corresponding to the baseType
            const mainButtonId = newPreset ? `${newPreset.baseType}-brush-tool` : 'pen-brush-tool';
            const mainButton = document.getElementById(mainButtonId);
            if (mainButton) mainButton.classList.add('active');

            // Activate the specific preset button if available
            const activePresetButton = document.querySelector(`[data-preset-id="${state.activeBrushPresetId}"]`);
            if (activePresetButton) {
                activePresetButton.classList.add('active');
            } else if (mainButton) {
                // If a preset button wasn't found (e.g. initial load of a custom unsaved brush),
                // ensure the main brush tool is active
                mainButton.classList.add('active');
            }

        } else if (toolName === 'eraser') {
            document.getElementById('eraser-tool')?.classList.add('active');
            // For eraser, load its specific settings but keep activeTool as 'eraser'
            state.brush = structuredClone(state.brushPresets['eraser-default']);
            state.activeBrushPresetId = 'eraser-default';
        } else if (toolName === 'selection') {
            document.getElementById('selection-tool')?.classList.add('active');
            // Selection tool doesn't use brush settings, but keep the activeTool for context
        }

        // Sync editor and color picker with new brush state
        toolColorPicker.value = state.brush.color;
        const mainColorPicker = document.getElementById('colorPicker');
        if (mainColorPicker) mainColorPicker.value = state.brush.color;
        
        // Notify brush editor to update its UI
        window.dispatchEvent(new CustomEvent('activeBrushChanged'));
    }

    // Event Listeners for main tool buttons
    brushToolBtn.addEventListener('click', () => {
        // When main pen button is clicked, activate its default preset (or last active if known)
        setActiveTool('brush', state.activeBrushPresetId.startsWith('pen') ? state.activeBrushPresetId : 'pen-default');
    });
    wireframeBrushBtn.addEventListener('click', () => {
        // When main wireframe button is clicked, check if the currently active preset is wireframe.
        // If not, default to 'wireframe-default'. Otherwise, maintain the current wireframe preset.
        const currentActiveWireframePreset = state.activeBrushPresetId.startsWith('wireframe') ? state.activeBrushPresetId : 'wireframe-default';
        setActiveTool('brush', currentActiveWireframePreset);
    });
    pixelBrushBtn.addEventListener('click', () => {
        setActiveTool('brush', state.activeBrushPresetId.startsWith('pixel') ? state.activeBrushPresetId : 'pixel-default');
    });
    sketchyBrushBtn.addEventListener('click', () => {
        setActiveTool('brush', state.activeBrushPresetId.startsWith('sketchy') ? state.activeBrushPresetId : 'sketchy-static');
    });
    eraserToolBtn.addEventListener('click', () => setActiveTool('eraser'));
    selectionToolBtn.addEventListener('click', () => setActiveTool('selection'));

    // Event Listeners for brush preset dropdown items
    presetButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const presetId = e.target.dataset.presetId;
            if (presetId) {
                setActiveTool('brush', presetId);
            }
        });
    });

    // Panel Toggles (Right side)
    brushEditorToggle.addEventListener('click', () => {
        brushEditor.classList.toggle('visible');
    });

    colorPaletteToggle.addEventListener('click', () => {
        colorPalette.classList.toggle('visible');
    });

    // Color Picker in Toolbar
    toolColorPicker.addEventListener('input', (e) => {
        state.brush.color = e.target.value;
        const mainColorPicker = document.getElementById('colorPicker');
        if (mainColorPicker) {
            mainColorPicker.value = e.target.value;
        }
        window.dispatchEvent(new CustomEvent('activeBrushChanged')); // Update editor if color changes
    });
    
    // Clear Canvas
    clearCanvasBtn.addEventListener('click', () => {
        if(confirm('Are you sure you want to clear the canvas? This cannot be undone.')) {
            clearCanvas();
        }
    });

    // Instructions Toggle
    instructionsToggle.addEventListener('click', () => {
        instructionsPanel.classList.toggle('hidden');
    });

    // Initialize the active tool button and brush settings on load
    // This ensures the correct button is highlighted and state.brush is populated
    setActiveTool(state.activeTool, state.activeBrushPresetId);
}

window.addEventListener('load', main);