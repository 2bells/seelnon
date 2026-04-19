import { init as initCanvas, startDrawingLoop, clearCanvas } from './canvas.js';
import { init as initEvents } from './events.js';
import { state } from './state.js';
import { loadState } from './storage.js';
import { init as initBrushEditor } from './brush/editor.js';
import { init as initColorPalette } from './ui/palette.js';
import { init as initExport } from './export.js';

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
    
    initBrushEditor();
    initColorPalette(document.getElementById('color-palette-container'));
    initExport();
    initUI();

    console.log("Endless Canvas Initialized.");
}

function initUI() {
    const deleteAllBtn = document.getElementById('delete-all-btn');
    const clearModal = document.getElementById('clear-modal');
    const closeClearModal = document.getElementById('close-clear-modal');
    const cancelClearBtn = document.getElementById('cancel-clear-btn');
    const confirmClearBtn = document.getElementById('confirm-clear-btn');

    const colorPaletteToggle = document.getElementById('colorPaletteToggle');
    
    const brushToolBtn = document.getElementById('pen-brush-tool');
    const wireframeBrushBtn = document.getElementById('wireframe-brush-tool');
    const pixelBrushBtn = document.getElementById('pixel-brush-tool');
    const sketchyBrushBtn = document.getElementById('sketchy-brush-tool');
    const eraserToolBtn = document.getElementById('eraser-tool');
    const toolColorPicker = document.getElementById('toolColorPicker');
    const selectionToolBtn = document.getElementById('selection-tool');

    const colorPalette = document.getElementById('color-palette');

    const instructionsToggle = document.getElementById('instructions-toggle');
    const instructionsPanel = document.getElementById('instructions');

    // Get all dropdown items for presets
    const presetButtons = document.querySelectorAll('.tool-dropdown-item');

    // Function to set the active tool and brush preset
    function setActiveTool(toolName, presetId = null, preserveColor = true) {
        // Before switching, save the current work-in-progress if it's a brush
        if (state.activeTool === 'brush' && state.activeBrushPresetId && state.brush) {
            state.brushWorkInProgress[state.activeBrushPresetId] = structuredClone(state.brush);
        }

        const previousColor = state.brush ? state.brush.color : '#000000';
        state.activeTool = toolName; 

        // Clear selection when switching tools away from selection
        if (toolName !== 'selection') {
            state.selectedStrokes = [];
            state.selection = null;
        }

        // Clear active class from all main tool buttons and dropdown items
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tool-dropdown-item').forEach(btn => btn.classList.remove('active'));

        if (toolName === 'brush') {
            let actualPresetId = presetId;
            if (!actualPresetId) {
                const currentBaseType = state.brushPresets[state.activeBrushPresetId]?.baseType || 'pen';
                actualPresetId = Object.keys(state.brushPresets).find(id => 
                    state.brushPresets[id].baseType === currentBaseType && state.brushPresets[id].name === state.brush.name
                ) || state.activeBrushPresetId;
            }
            
            // Load from Work-in-Progress if it exists, otherwise from the Preset repository
            const sessionData = state.brushWorkInProgress[actualPresetId];
            const presetData = state.brushPresets[actualPresetId];

            if (sessionData) {
                state.brush = structuredClone(sessionData);
                state.activeBrushPresetId = actualPresetId;
            } else if (presetData) {
                state.brush = structuredClone(presetData);
                state.activeBrushPresetId = actualPresetId;
            } else {
                state.brush = structuredClone(state.brushPresets['pen-default']);
                state.activeBrushPresetId = 'pen-default';
            }

            // Preservation of color across brushes (requested: color should not be baked into brush presets)
            if (preserveColor && toolName === 'brush' && state.brush) {
                state.brush.color = previousColor;
            }
            
            // Activate the main button corresponding to the baseType
            const activePreset = state.brushPresets[state.activeBrushPresetId];
            const mainButtonId = activePreset ? `${activePreset.baseType}-brush-tool` : 'pen-brush-tool';
            const mainButton = document.getElementById(mainButtonId);
            if (mainButton) mainButton.classList.add('active');

            // Activate the specific preset button if available
            const activePresetButton = document.querySelector(`[data-preset-id="${state.activeBrushPresetId}"]`);
            if (activePresetButton) {
                activePresetButton.classList.add('active');
            }
        } else if (toolName === 'eraser') {
            document.getElementById('eraser-tool')?.classList.add('active');
            state.brush = structuredClone(state.brushPresets['eraser-default']);
            // Preserve the active color even for eraser, so we don't lose it when switching back
            if (state.brush) {
                state.brush.color = previousColor;
            }
            state.activeBrushPresetId = 'eraser-default';
        } else if (toolName === 'selection') {
            if (selectionToolBtn) selectionToolBtn.classList.add('active');
            // Ensure state.brush.color remains valid even when in selection mode
            if (state.brush) {
                state.brush.color = previousColor;
            }
        }

        // Sync editor and color picker with new brush state
        if (state.brush) {
            toolColorPicker.value = state.brush.color;
        }
        
        // Notify brush editor to update its UI
        window.dispatchEvent(new CustomEvent('activeBrushChanged'));
        updateBrushCycleIndicators();
    }

    function updateBrushCycleIndicators() {
        // Find all main brush buttons and add cycle dots if they represent a group
        const baseTypes = ['pen', 'wireframe', 'pixel', 'sketchy'];
        baseTypes.forEach(baseType => {
            const btn = document.getElementById(`${baseType}-brush-tool`);
            if (!btn) return;

            // Find all presets for this base type
            const presets = Object.keys(state.brushPresets).filter(id => state.brushPresets[id].baseType === baseType);
            if (presets.length <= 1) return;

            // Create or update indicator container
            let indicator = btn.querySelector('.brush-cycle-indicator');
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.className = 'brush-cycle-indicator';
                btn.style.position = 'relative'; // Ensure button is relative for absolute dots
                btn.appendChild(indicator);
            }

            indicator.innerHTML = '';
            presets.forEach(id => {
                const dot = document.createElement('div');
                dot.className = 'cycle-dot';
                if (state.activeBrushPresetId === id) {
                    dot.classList.add('active');
                }
                indicator.appendChild(dot);
            });
        });
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
            const presetId = e.currentTarget.dataset.presetId;
            if (presetId) {
                setActiveTool('brush', presetId);
            }
        });
    });

    // Panel Toggles (Right side)
    const settingsToggle = document.getElementById('settingsToggle');
    const settingsSidebar = document.getElementById('settings-sidebar');
    const closeSettings = document.getElementById('close-settings');
    // Note: color-palette is created dynamically, so we need to find it after init
    const getColorPalette = () => document.getElementById('color-palette');

    settingsToggle?.addEventListener('click', () => {
        const isVisible = settingsSidebar.classList.toggle('visible');
        settingsToggle.classList.toggle('active', isVisible);
    });

    colorPaletteToggle?.addEventListener('click', () => {
        const palette = getColorPalette();
        const isVisible = palette?.classList.toggle('visible');
        colorPaletteToggle.classList.toggle('active', isVisible);
    });

    closeSettings?.addEventListener('click', () => {
        settingsSidebar.classList.remove('visible');
        settingsToggle.classList.remove('active');
    });

    // Close on escape
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            settingsSidebar?.classList.remove('visible');
            settingsToggle?.classList.remove('active');
            getColorPalette()?.classList.remove('visible');
            colorPaletteToggle?.classList.remove('active');
        }
    });

    // Color Picker in Toolbar
    toolColorPicker.addEventListener('input', (e) => {
        state.brush.color = e.target.value;
        // Keep work-in-progress synced
        if (state.activeBrushPresetId) {
            state.brushWorkInProgress[state.activeBrushPresetId] = structuredClone(state.brush);
        }
        const mainColorPicker = document.getElementById('colorPicker');
        if (mainColorPicker) {
            mainColorPicker.value = e.target.value;
        }
        window.dispatchEvent(new CustomEvent('activeBrushChanged')); // Update editor if color changes
    });

    // Clear Canvas Modal Flow
    deleteAllBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        clearModal?.classList.remove('hidden');
    });

    closeClearModal?.addEventListener('click', () => {
        clearModal?.classList.add('hidden');
    });

    cancelClearBtn?.addEventListener('click', () => {
        clearModal?.classList.add('hidden');
    });

    confirmClearBtn?.addEventListener('click', () => {
        clearCanvas();
        clearModal?.classList.add('hidden');
    });

    // Close modal on clicking outside content
    clearModal?.addEventListener('click', (e) => {
        if (e.target === clearModal) {
            clearModal.classList.add('hidden');
        }
    });

    // Instructions Toggle
    instructionsToggle.addEventListener('click', () => {
        instructionsPanel.classList.toggle('hidden');
    });

    // Listen for requests to set active tool from other components (like brush editor)
    window.addEventListener('requestSetActiveTool', (e) => {
        const { toolName, presetId } = e.detail;
        setActiveTool(toolName, presetId);
    });

    // Initialize the active tool button and brush settings on load
    setActiveTool(state.activeTool, state.activeBrushPresetId);

    // Ensure color palette UI stays in sync if color is picked from canvas (alt+click/eyedropper)
    window.addEventListener('requestSyncUI', () => {
        if (state.brush) {
            toolColorPicker.value = state.brush.color;
        }
        updateBrushCycleIndicators();
    });
}

window.addEventListener('load', main);
