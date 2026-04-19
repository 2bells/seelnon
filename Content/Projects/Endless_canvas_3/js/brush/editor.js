import { state } from '../state.js';
import { scheduleSave } from '../storage.js';

function createBrushEditor() {
    const editor = document.createElement('div');
    editor.id = 'brush-editor';
    editor.innerHTML = `
        <div class="brush-editor-tabs">
            <button class="brush-editor-tab-button active" data-tab="brush-main">Brush</button>
            <button class="brush-editor-tab-button" data-tab="brush-advanced">Advanced</button>
            <button class="brush-editor-tab-button" data-tab="canvas-settings">Canvas</button>
        </div>

        <div id="brush-main-tab-content" class="brush-editor-tab-content active">
            <h4>Brush Settings</h4>
            <div class="brush-setting">
                <div class="label-group">
                    <label>Active Preset:</label>
                    <span id="activeBrushPresetName"></span>
                </div>
            </div>

            <div class="brush-preset-actions">
                <button id="saveCurrentPresetBtn" title="Save current settings as the new default for this brush">Save Preset</button>
                <button id="resetBrushBtn" title="Reset brush settings to the saved preset">Reset Brush</button>
            </div>

            <div class="brush-setting">
                <div class="label-group">
                    <label for="brushSize">Size</label>
                    <span id="brushSizeValue">5.0</span>
                </div>
                <input type="range" id="brushSize" min="1" max="100" value="5" step="0.1">
            </div>
            
            <div class="brush-setting">
                <div class="label-group">
                    <label for="brushOpacity">Opacity</label>
                    <span id="brushOpacityValue">1.0</span>
                </div>
                <input type="range" id="brushOpacity" min="0.05" max="1" step="0.05" value="1">
            </div>

             <div class="brush-setting">
                 <div class="label-group">
                    <label for="minSizeFactor">Size Jitter</label>
                    <span id="minSizeFactorValue">20%</span>
                </div>
                <input type="range" id="minSizeFactor" min="0" max="1" value="0.2" step="0.01">
            </div>

            <div class="brush-setting">
                 <div class="label-group">
                    <label for="speedSensitivityFactor">Speed Sensitivity</label>
                    <span id="speedSensitivityFactorValue">3.0</span>
                </div>
                <input type="range" id="speedSensitivityFactor" min="0.5" max="10" value="3" step="0.1">
            </div>
            
            <div class="brush-toggle">
                <input type="checkbox" id="pressureSensitivityToggle">
                <label for="pressureSensitivityToggle">Enable Pressure Sensitivity</label>
            </div>
            
            <div class="brush-toggle">
                <input type="checkbox" id="speedSensitivityToggle">
                <label for="speedSensitivityToggle">Enable Speed Sensitivity</label>
            </div>

            <div class="brush-setting">
                <label for="brushTipShape">Brush Tip</label>
                <select id="brushTipShape">
                    <option value="round">Round</option>
                    <option value="square">Square</option>
                </select>
            </div>

            <div class="brush-toggle">
                <input type="checkbox" id="nonCompoundingOpacityToggle">
                <label for="nonCompoundingOpacityToggle">Non-Compounding Opacity</label>
            </div>

            <div class="brush-setting" id="pixel-size-setting">
                <div class="label-group">
                    <label for="pixelSize">Pixel Size</label>
                    <span id="pixelSizeValue">10</span>
                </div>
                <input type="range" id="pixelSize" min="1" max="50" value="10" step="1">
            </div>
        </div>

        <div id="brush-advanced-tab-content" class="brush-editor-tab-content">
            <h4>Advanced Brush Settings</h4>
            <div class="brush-toggle">
                <input type="checkbox" id="enableSmoothingToggle">
                <label for="enableSmoothingToggle">Enable Stroke Smoothing</label>
            </div>
            <div class="brush-setting" id="smoothing-factor-setting">
                <div class="label-group">
                    <label for="smoothingFactor">Smoothing Factor</label>
                    <span id="smoothingFactorValue">0.5%</span>
                </div>
                <input type="range" id="smoothingFactor" min="0" max="100" value="5" step="1">
            </div>

            <div class="brush-setting hidden-setting" id="wireframe-mesh-opacity-setting">
                <div class="label-group">
                    <label for="wireframeMeshOpacity">Mesh Opacity</label>
                    <span id="wireframeMeshOpacityValue">10%</span>
                </div>
                <input type="range" id="wireframeMeshOpacity" min="0" max="1" value="0.1" step="0.01">
            </div>
            <div class="brush-setting hidden-setting" id="wireframe-line-opacity-setting">
                <div class="label-group">
                    <label for="wireframeLineOpacity">Line Opacity</label>
                    <span id="wireframeLineOpacityValue">80%</span>
                </div>
                <input type="range" id="wireframeLineOpacity" min="0" max="1" value="0.8" step="0.01">
            </div>
            <div class="brush-setting hidden-setting" id="wireframe-hull-thickness-setting">
                <div class="label-group">
                    <label for="wireframeHullThickness">Hull Thickness</label>
                    <span id="wireframeHullThicknessValue">1.0x</span>
                </div>
                <input type="range" id="wireframeHullThickness" min="0.1" max="5" value="1" step="0.1">
            </div>
            <div class="brush-setting hidden-setting" id="wireframe-mesh-thickness-setting">
                <div class="label-group">
                    <label for="wireframeMeshThickness">Mesh Thickness</label>
                    <span id="wireframeMeshThicknessValue">1.0</span>
                </div>
                <input type="range" id="wireframeMeshThickness" min="0.1" max="10" value="1" step="0.1">
            </div>
            <div class="brush-setting hidden-setting" id="wireframe-max-mesh-length-setting">
                <div class="label-group">
                    <label for="wireframeMaxMeshLength">Max Mesh Length</label>
                    <span id="wireframeMaxMeshLengthValue">200</span>
                </div>
                <input type="range" id="wireframeMaxMeshLength" min="10" max="500" value="200" step="10">
            </div>

            <div class="brush-setting hidden-setting" id="wireframe-point-radius-setting">
                <div class="label-group">
                    <label for="wireframePointRadius">Point Radius</label>
                    <span id="wireframePointRadiusValue">0</span>
                </div>
                <input type="range" id="wireframePointRadius" min="0" max="10" value="0" step="0.1">
            </div>
            <div class="brush-setting hidden-setting" id="wireframe-point-opacity-setting">
                <div class="label-group">
                    <label for="wireframePointOpacity">Point Opacity</label>
                    <span id="wireframePointOpacityValue">100%</span>
                </div>
                <input type="range" id="wireframePointOpacity" min="0" max="1" value="1" step="0.01">
            </div>
            <div class="brush-setting hidden-setting" id="wireframe-animation-speed-setting">
                <div class="label-group">
                    <label for="wireframeAnimationSpeed">Animation Speed</label>
                    <span id="wireframeAnimationSpeedValue">0s</span>
                </div>
                <input type="range" id="wireframeAnimationSpeed" min="0" max="5000" value="0" step="100">
            </div>
            <div class="brush-setting hidden-setting" id="wireframe-animation-amount-setting">
                <div class="label-group">
                    <label for="wireframeAnimationAmount">Animation Amount</label>
                    <span id="wireframeAnimationAmountValue">0px</span>
                </div>
                <input type="range" id="wireframeAnimationAmount" min="0" max="20" value="0" step="0.5">
            </div>
            <div class="brush-toggle hidden-setting" id="wireframe-gradient-mesh-setting">
                <input type="checkbox" id="wireframeGradientMeshToggle">
                <label for="wireframeGradientMeshToggle">Gradient Mesh Thickness</label>
            </div>
            <div class="brush-setting hidden-setting" id="wireframe-gradient-mesh-boost-setting">
                <div class="label-group">
                    <label for="wireframeGradientMeshBoostFactor">Gradient Boost</label>
                    <span id="wireframeGradientMeshBoostFactorValue">2.0x</span>
                </div>
                <input type="range" id="wireframeGradientMeshBoostFactor" min="0" max="100" value="2" step="0.1">
            </div>

            <div class="brush-setting hidden-setting" id="sketchy-jitter-amount-setting">
                <div class="label-group">
                    <label for="sketchyJitterAmount">Jitter Amount</label>
                    <span id="sketchyJitterAmountValue">40%</span>
                </div>
                <input type="range" id="sketchyJitterAmount" min="0" max="1" value="0.4" step="0.01">
            </div>
            <div class="brush-setting hidden-setting" id="sketchy-jitter-density-setting">
                <div class="label-group">
                    <label for="sketchyJitterDensity">Jitter Density</label>
                    <span id="sketchyJitterDensityValue">3</span>
                </div>
                <input type="range" id="sketchyJitterDensity" min="1" max="10" value="3" step="1">
            </div>
            <div class="brush-setting hidden-setting" id="sketchy-animation-interval-setting">
                <div class="label-group">
                    <label for="sketchyAnimationInterval">Animation Interval</label>
                    <span id="sketchyAnimationIntervalValue">1.5s</span>
                </div>
                <input type="range" id="sketchyAnimationInterval" min="0" max="5000" value="1500" step="100">
            </div>
        </div>

        <div id="canvas-settings-tab-content" class="brush-editor-tab-content">
            <h4>Canvas Settings</h4>
            <div class="canvas-setting">
                <label for="canvasBgColor">Background Color</label>
                <input type="color" id="canvasBgColor" class="settings-color-input" value="${state.canvasSettings.backgroundColor}">
            </div>

            <div class="canvas-setting">
                <label for="canvasBgType">Background Pattern</label>
                <select id="canvasBgType">
                    <option value="none">None</option>
                    <option value="dots">Dots</option>
                    <option value="grid">Grid</option>
                    <option value="horizontal">Horizontal Lines</option>
                    <option value="vertical">Vertical Lines</option>
                </select>
            </div>

            <div class="canvas-setting">
                <div class="label-group">
                    <label for="canvasBgSpacing">Pattern Spacing</label>
                    <span id="canvasBgSpacingValue">${state.canvasSettings.backgroundSpacing}px</span>
                </div>
                <input type="range" id="canvasBgSpacing" min="10" max="200" value="${state.canvasSettings.backgroundSpacing}" step="5">
            </div>

            <div class="canvas-setting">
                <label for="canvasBgLineColor">Pattern Color</label>
                <input type="color" id="canvasBgLineColor" class="settings-color-input" value="${state.canvasSettings.backgroundLineColor || '#D1D1D1'}">
            </div>

            <div class="canvas-setting">
                <div class="label-group">
                    <label for="canvasBgLineWidth">Pattern Thickness</label>
                    <span id="canvasBgLineWidthValue">${state.canvasSettings.backgroundLineWidth || 1}px</span>
                </div>
                <input type="range" id="canvasBgLineWidth" min="0.5" max="20" value="${state.canvasSettings.backgroundLineWidth || 1}" step="0.5">
            </div>

            <div class="toolbar-separator" style="margin: 15px 0 10px 0; opacity: 0.2;"></div>

            <div class="canvas-setting">
                <label for="renderMode">Render Engine</label>
                <select id="renderMode">
                    <option value="bitmap">Optimized (Chunks)</option>
                    <option value="vector">Raw (Full Vector)</option>
                </select>
                <div class="setting-hint" style="font-size: 10px; opacity: 0.5; margin-top: 6px; line-height: 1.3;">
                    'Optimized' caches parts of the canvas to keep things smooth. 
                    'Raw' redraws every single point every frame—true to the holy trinity, but can get laggy.
                </div>
            </div>
        </div>
    `;
    return editor;
}

export function init() {
    const container = document.getElementById('brush-settings-container');
    if (!container) return;

    const editor = createBrushEditor();
    container.appendChild(editor);

    // Get all UI elements
    const activeBrushPresetName = editor.querySelector('#activeBrushPresetName');
    const saveCurrentPresetBtn = editor.querySelector('#saveCurrentPresetBtn');
    const resetBrushBtn = editor.querySelector('#resetBrushBtn');
    const brushSize = editor.querySelector('#brushSize');
    const brushSizeValue = editor.querySelector('#brushSizeValue');
    const brushOpacity = editor.querySelector('#brushOpacity');
    const brushOpacityValue = editor.querySelector('#brushOpacityValue');
    const pressureSensitivityToggle = editor.querySelector('#pressureSensitivityToggle');
    const speedSensitivityToggle = editor.querySelector('#speedSensitivityToggle');
    const speedSensitivityFactor = editor.querySelector('#speedSensitivityFactor');
    const speedSensitivityFactorValue = editor.querySelector('#speedSensitivityFactorValue');
    const minSizeFactor = editor.querySelector('#minSizeFactor');
    const minSizeFactorValue = editor.querySelector('#minSizeFactorValue');
    const brushTipShape = editor.querySelector('#brushTipShape');
    const nonCompoundingOpacityToggle = editor.querySelector('#nonCompoundingOpacityToggle');
    const pixelSizeSetting = editor.querySelector('#pixel-size-setting');
    const pixelSize = editor.querySelector('#pixelSize');
    const pixelSizeValue = editor.querySelector('#pixelSizeValue');

    // Canvas Settings elements
    const canvasBgColor = editor.querySelector('#canvasBgColor');
    const canvasBgType = editor.querySelector('#canvasBgType');
    const canvasBgSpacing = editor.querySelector('#canvasBgSpacing');
    const canvasBgSpacingValue = editor.querySelector('#canvasBgSpacingValue');
    const canvasBgLineColor = editor.querySelector('#canvasBgLineColor');
    const canvasBgLineWidth = editor.querySelector('#canvasBgLineWidth');
    const canvasBgLineWidthValue = editor.querySelector('#canvasBgLineWidthValue');
    const renderMode = editor.querySelector('#renderMode');

    // Advanced Brush Settings elements (now in their own tab)
    const enableSmoothingToggle = editor.querySelector('#enableSmoothingToggle');
    const smoothingFactorSetting = editor.querySelector('#smoothing-factor-setting');
    const smoothingFactor = editor.querySelector('#smoothingFactor');
    const smoothingFactorValue = editor.querySelector('#smoothingFactorValue');

    const wireframeMeshOpacitySetting = editor.querySelector('#wireframe-mesh-opacity-setting');
    const wireframeMeshOpacity = editor.querySelector('#wireframeMeshOpacity');
    const wireframeMeshOpacityValue = editor.querySelector('#wireframeMeshOpacityValue');
    const wireframeLineOpacitySetting = editor.querySelector('#wireframe-line-opacity-setting');
    const wireframeLineOpacity = editor.querySelector('#wireframeLineOpacity');
    const wireframeLineOpacityValue = editor.querySelector('#wireframeLineOpacityValue');
    const wireframeHullThicknessSetting = editor.querySelector('#wireframe-hull-thickness-setting');
    const wireframeHullThickness = editor.querySelector('#wireframeHullThickness');
    const wireframeHullThicknessValue = editor.querySelector('#wireframeHullThicknessValue');
    const wireframeMeshThicknessSetting = editor.querySelector('#wireframe-mesh-thickness-setting');
    const wireframeMeshThickness = editor.querySelector('#wireframeMeshThickness');
    const wireframeMeshThicknessValue = editor.querySelector('#wireframeMeshThicknessValue');
    const wireframeMaxMeshLengthSetting = editor.querySelector('#wireframe-max-mesh-length-setting');
    const wireframeMaxMeshLength = editor.querySelector('#wireframeMaxMeshLength');
    const wireframeMaxMeshLengthValue = editor.querySelector('#wireframeMaxMeshLengthValue');

    const wireframePointRadiusSetting = editor.querySelector('#wireframe-point-radius-setting');
    const wireframePointRadius = editor.querySelector('#wireframePointRadius');
    const wireframePointRadiusValue = editor.querySelector('#wireframePointRadiusValue');
    const wireframePointOpacitySetting = editor.querySelector('#wireframe-point-opacity-setting');
    const wireframePointOpacity = editor.querySelector('#wireframePointOpacity');
    const wireframePointOpacityValue = editor.querySelector('#wireframePointOpacityValue');
    const wireframeAnimationSpeedSetting = editor.querySelector('#wireframe-animation-speed-setting');
    const wireframeAnimationSpeed = editor.querySelector('#wireframeAnimationSpeed');
    const wireframeAnimationSpeedValue = editor.querySelector('#wireframeAnimationSpeedValue');
    const wireframeAnimationAmountSetting = editor.querySelector('#wireframe-animation-amount-setting');
    const wireframeAnimationAmount = editor.querySelector('#wireframeAnimationAmount');
    const wireframeAnimationAmountValue = editor.querySelector('#wireframeAnimationAmountValue');
    const wireframeGradientMeshSetting = editor.querySelector('#wireframe-gradient-mesh-setting');
    const wireframeGradientMeshToggle = editor.querySelector('#wireframeGradientMeshToggle');
    const wireframeGradientMeshBoostSetting = editor.querySelector('#wireframe-gradient-mesh-boost-setting');
    const wireframeGradientMeshBoostFactor = editor.querySelector('#wireframeGradientMeshBoostFactor');
    const wireframeGradientMeshBoostFactorValue = editor.querySelector('#wireframeGradientMeshBoostFactorValue');

    const sketchyJitterAmountSetting = editor.querySelector('#sketchy-jitter-amount-setting');
    const sketchyJitterAmount = editor.querySelector('#sketchyJitterAmount');
    const sketchyJitterAmountValue = editor.querySelector('#sketchyJitterAmountValue');
    const sketchyJitterDensitySetting = editor.querySelector('#sketchy-jitter-density-setting');
    const sketchyJitterDensity = editor.querySelector('#sketchyJitterDensity');
    const sketchyJitterDensityValue = editor.querySelector('#sketchyJitterDensityValue');
    const sketchyAnimationIntervalSetting = editor.querySelector('#sketchy-animation-interval-setting');
    const sketchyAnimationInterval = editor.querySelector('#sketchyAnimationInterval');
    const sketchyAnimationIntervalValue = editor.querySelector('#sketchyAnimationIntervalValue');

    // Tab related elements
    const tabButtons = editor.querySelectorAll('.brush-editor-tab-button');
    const tabContents = editor.querySelectorAll('.brush-editor-tab-content');

    // Function to handle tab switching
    function switchTab(tabId) {
        tabButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tabId);
        });
        tabContents.forEach(content => {
            content.classList.toggle('active', content.id === `${tabId}-tab-content`);
        });
        syncUiWithState(); // Re-sync UI to show relevant settings for the new tab
    }

    // Helper to sync current modifications to the session-wide work-in-progress state
    function syncWorkInProgress() {
        if (state.activeBrushPresetId && state.brush) {
            state.brushWorkInProgress[state.activeBrushPresetId] = structuredClone(state.brush);
        }
    }

    // Function to update visibility of brush-specific settings
    function updateBrushSpecificSettingsVisibility() {
        // Reset all specific settings to hidden first
        pixelSizeSetting.classList.add('hidden-setting');
        smoothingFactorSetting.classList.add('hidden-setting'); // Always hidden unless smoothing is enabled
        wireframeMeshOpacitySetting.classList.add('hidden-setting');
        wireframeLineOpacitySetting.classList.add('hidden-setting');
        wireframeHullThicknessSetting.classList.add('hidden-setting');
        wireframeMeshThicknessSetting.classList.add('hidden-setting');
        wireframeMaxMeshLengthSetting.classList.add('hidden-setting');
        wireframePointRadiusSetting.classList.add('hidden-setting');
        wireframePointOpacitySetting.classList.add('hidden-setting');
        wireframeAnimationSpeedSetting.classList.add('hidden-setting');
        wireframeAnimationAmountSetting.classList.add('hidden-setting');
        wireframeGradientMeshSetting.classList.add('hidden-setting');
        wireframeGradientMeshBoostSetting.classList.add('hidden-setting');
        sketchyJitterAmountSetting.classList.add('hidden-setting');
        sketchyJitterDensitySetting.classList.add('hidden-setting');
        sketchyAnimationIntervalSetting.classList.add('hidden-setting');

        // Show smoothing settings if enabled
        if (state.brush.enableSmoothing) {
            smoothingFactorSetting.classList.remove('hidden-setting');
        }

        // Show brush type specific settings
        switch (state.brush.baseType) {
            case 'pixel':
                pixelSizeSetting.classList.remove('hidden-setting');
                break;
            case 'wireframe':
                wireframeMeshOpacitySetting.classList.remove('hidden-setting');
                wireframeLineOpacitySetting.classList.remove('hidden-setting');
                wireframeHullThicknessSetting.classList.remove('hidden-setting');
                wireframeMeshThicknessSetting.classList.remove('hidden-setting');
                wireframeMaxMeshLengthSetting.classList.remove('hidden-setting');
                wireframePointRadiusSetting.classList.remove('hidden-setting');
                wireframePointOpacitySetting.classList.remove('hidden-setting');
                wireframeAnimationSpeedSetting.classList.remove('hidden-setting');
                wireframeAnimationAmountSetting.classList.remove('hidden-setting');
                wireframeGradientMeshSetting.classList.remove('hidden-setting');
                if (state.brush.wireframeGradientMesh) {
                    wireframeGradientMeshBoostSetting.classList.remove('hidden-setting');
                }
                break;
            case 'sketchy':
                sketchyJitterAmountSetting.classList.remove('hidden-setting');
                sketchyJitterDensitySetting.classList.remove('hidden-setting');
                if (state.brush.type === 'sketchy-animated') {
                    sketchyAnimationIntervalSetting.classList.remove('hidden-setting');
                }
                break;
        }
    }

    // Function to update dropdowns in the main UI (left toolbar)
    function updateToolDropdowns() {
        const brushContainers = {
            'pen': document.getElementById('brush-tool-container'),
            'wireframe': document.getElementById('wireframe-brush-container'),
            'pixel': document.getElementById('pixel-brush-container'),
            'sketchy': document.getElementById('sketchy-brush-container'),
        };

        for (const baseType in brushContainers) {
            const container = brushContainers[baseType];
            if (!container) { // Defensive check: if container is null, skip this baseType
                console.warn(`Brush container not found for baseType: ${baseType}`);
                continue; 
            }

            const dropdown = container.querySelector('.tool-dropdown-inner');
            if (dropdown) {
                // Remove dynamic items that are no longer in state
                Array.from(dropdown.children).forEach(child => {
                    const pid = child.dataset.presetId;
                    if (pid && !state.brushPresets[pid]) {
                        child.remove();
                    }
                });

                // Add all presets (default and custom)
                for (const presetId in state.brushPresets) {
                    const preset = state.brushPresets[presetId];
                    if (preset.baseType === baseType) {
                        // Check if a button for this presetId already exists (for hardcoded ones)
                        if (!dropdown.querySelector(`[data-preset-id="${presetId}"]`)) {
                            const button = document.createElement('button');
                            button.id = `${presetId}-tool`;
                            button.className = 'tool-dropdown-item';
                            button.dataset.presetId = presetId;
                            button.title = preset.name;
                            button.textContent = preset.name;
                            
                            button.addEventListener('click', (e) => {
                                const clickedPresetId = e.target.dataset.presetId;
                                if (clickedPresetId) {
                                    // Use the centralized event-based switching to ensure color preservation
                                    window.dispatchEvent(new CustomEvent('requestSetActiveTool', {
                                        detail: { toolName: 'brush', presetId: clickedPresetId }
                                    }));
                                }
                            });
                            dropdown.appendChild(button);
                        }
                    }
                }
            }
        }
        // Ensure the currently active preset is marked 'active' in the dropdown
        document.querySelectorAll('.tool-dropdown-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.presetId === state.activeBrushPresetId);
        });
        // Ensure the current active main button is marked active (only if tool is brush)
        if (state.activeTool === 'brush') {
            const activeBaseType = state.brushPresets[state.activeBrushPresetId]?.baseType || 'pen';
            const mainToolButton = document.getElementById(`${activeBaseType}-brush-tool`);
            if (mainToolButton) {
                document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
                mainToolButton.classList.add('active');
            }
        }
    }

    // Sync UI with initial state
    function syncUiWithState() {
        // Update brush preset display
        let presetDisplayName = state.brushPresets[state.activeBrushPresetId]?.name;
        if (!presetDisplayName) {
            // If active preset isn't found or is a "custom" modification of a default
            presetDisplayName = 'Custom';
        }
        activeBrushPresetName.textContent = presetDisplayName;

        // Update brush settings (main tab)
        brushSize.value = state.brush.size;
        brushSizeValue.textContent = state.brush.size.toFixed(1);
        brushOpacity.value = state.brush.opacity;
        brushOpacityValue.textContent = state.brush.opacity.toFixed(2);
        pressureSensitivityToggle.checked = state.brush.pressureSensitivity;
        speedSensitivityToggle.checked = state.brush.speedSensitivity;
        speedSensitivityFactor.value = state.brush.speedSensitivityFactor;
        speedSensitivityFactorValue.textContent = state.brush.speedSensitivityFactor.toFixed(1);
        minSizeFactor.value = state.brush.minSizeFactor;
        minSizeFactorValue.textContent = `${Math.round(state.brush.minSizeFactor * 100)}%`;
        brushTipShape.value = state.brush.tipShape;
        nonCompoundingOpacityToggle.checked = state.brush.nonCompoundingOpacity;
        pixelSize.value = state.brush.pixelSize;
        pixelSizeValue.textContent = pixelSize.value; // Use element's value, not state's, as state could be undefined for older presets

        // Update advanced settings (advanced tab)
        enableSmoothingToggle.checked = state.brush.enableSmoothing;
        smoothingFactor.value = (state.brush.smoothingFactor * 1000).toFixed(0);
        smoothingFactorValue.textContent = `${(state.brush.smoothingFactor * 100).toFixed(1)}%`;

        wireframeMeshOpacity.value = state.brush.wireframeMeshOpacity ?? 0.1;
        wireframeMeshOpacityValue.textContent = `${Math.round((state.brush.wireframeMeshOpacity ?? 0.1) * 100)}%`;
        wireframeLineOpacity.value = state.brush.wireframeLineOpacity ?? 0.8;
        wireframeLineOpacityValue.textContent = `${Math.round((state.brush.wireframeLineOpacity ?? 0.8) * 100)}%`;
        wireframeHullThickness.value = state.brush.wireframeHullLineThickness ?? 1.0;
        wireframeHullThicknessValue.textContent = `${(state.brush.wireframeHullLineThickness ?? 1.0).toFixed(1)}x`;
        wireframeMeshThickness.value = state.brush.wireframeMeshLineThickness ?? 1.0;
        wireframeMeshThicknessValue.textContent = (state.brush.wireframeMeshLineThickness ?? 1.0).toFixed(1);
        
        // Safely handle wireframeMaxMeshLength
        const currentMaxMeshLength = state.brush.wireframeMaxMeshLength ?? 200; // Provide a default if null/undefined
        wireframeMaxMeshLength.value = currentMaxMeshLength === Infinity ? wireframeMaxMeshLength.max : currentMaxMeshLength;
        wireframeMaxMeshLengthValue.textContent = currentMaxMeshLength === Infinity ? '∞' : currentMaxMeshLength.toFixed(0);

        wireframePointRadius.value = state.brush.wireframePointRadius ?? 0;
        wireframePointRadiusValue.textContent = (state.brush.wireframePointRadius ?? 0).toFixed(1);
        wireframePointOpacity.value = state.brush.wireframePointOpacity ?? 1.0;
        wireframePointOpacityValue.textContent = `${Math.round((state.brush.wireframePointOpacity ?? 1.0) * 100)}%`;
        wireframeAnimationSpeed.value = state.brush.wireframeAnimationSpeed ?? 0;
        wireframeAnimationSpeedValue.textContent = `${(state.brush.wireframeAnimationSpeed ?? 0) / 1000}s`;
        wireframeAnimationAmount.value = state.brush.wireframeAnimationAmount ?? 0;
        wireframeAnimationAmountValue.textContent = `${(state.brush.wireframeAnimationAmount ?? 0).toFixed(1)}px`;
        wireframeGradientMeshToggle.checked = state.brush.wireframeGradientMesh ?? false;
        wireframeGradientMeshBoostFactor.value = state.brush.wireframeGradientMeshBoostFactor ?? 2.0;
        wireframeGradientMeshBoostFactorValue.textContent = `${(state.brush.wireframeGradientMeshBoostFactor ?? 2.0).toFixed(1)}x`;

        sketchyJitterAmount.value = state.brush.jitterAmount ?? 0.4;
        sketchyJitterAmountValue.textContent = `${Math.round((state.brush.jitterAmount ?? 0.4) * 100)}%`;
        sketchyJitterDensity.value = state.brush.jitterDensity ?? 3;
        sketchyJitterDensityValue.textContent = sketchyJitterDensity.value;
        sketchyAnimationInterval.value = state.brush.animationInterval ?? 0;
        sketchyAnimationIntervalValue.textContent = `${(state.brush.animationInterval ?? 0) / 1000}s`;

        updateBrushSpecificSettingsVisibility();
        updateToolDropdowns();

        // Update canvas settings (canvas tab)
        canvasBgColor.value = state.canvasSettings.backgroundColor;
        canvasBgType.value = state.canvasSettings.backgroundType;
        canvasBgSpacing.value = state.canvasSettings.backgroundSpacing;
        canvasBgSpacingValue.textContent = `${state.canvasSettings.backgroundSpacing}px`;
        canvasBgLineColor.value = state.canvasSettings.backgroundLineColor || '#D1D1D1';
        canvasBgLineWidth.value = state.canvasSettings.backgroundLineWidth || 1;
        canvasBgLineWidthValue.textContent = `${state.canvasSettings.backgroundLineWidth || 1}px`;
        renderMode.value = state.renderMode || 'bitmap';
    }
    
    syncUiWithState();

    // Add event listeners for tabs
    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            switchTab(e.target.dataset.tab);
        });
    });

    // Add event listeners for brush settings (main tab)
    brushSize.addEventListener('input', (e) => {
        const newSize = parseFloat(e.target.value);
        state.brush.size = newSize;
        brushSizeValue.textContent = newSize.toFixed(1);
        syncWorkInProgress();
    });

    brushOpacity.addEventListener('input', (e) => {
        const newOpacity = parseFloat(e.target.value);
        state.brush.opacity = newOpacity;
        brushOpacityValue.textContent = newOpacity.toFixed(2);
        syncWorkInProgress();
    });
    
    speedSensitivityFactor.addEventListener('input', (e) => {
        const newFactor = parseFloat(e.target.value);
        state.brush.speedSensitivityFactor = newFactor;
        speedSensitivityFactorValue.textContent = newFactor.toFixed(1);
        syncWorkInProgress();
    });

    minSizeFactor.addEventListener('input', (e) => {
        const newFactor = parseFloat(e.target.value);
        state.brush.minSizeFactor = newFactor;
        minSizeFactorValue.textContent = `${Math.round(newFactor * 100)}%`;
        syncWorkInProgress();
    });

    pressureSensitivityToggle.addEventListener('change', (e) => {
        state.brush.pressureSensitivity = e.target.checked;
        syncWorkInProgress();
    });

    speedSensitivityToggle.addEventListener('change', (e) => {
        state.brush.speedSensitivity = e.target.checked;
        syncWorkInProgress();
    });

    brushTipShape.addEventListener('change', (e) => {
        state.brush.tipShape = e.target.value;
        syncWorkInProgress();
    });

    nonCompoundingOpacityToggle.addEventListener('change', (e) => {
        state.brush.nonCompoundingOpacity = e.target.checked;
        syncWorkInProgress();
    });

    pixelSize.addEventListener('input', (e) => {
        const newPixelSize = parseFloat(e.target.value);
        state.brush.pixelSize = newPixelSize;
        pixelSizeValue.textContent = newPixelSize;
        syncWorkInProgress();
    });

    // Advanced Brush Settings Listeners (advanced tab)
    enableSmoothingToggle.addEventListener('change', (e) => {
        state.brush.enableSmoothing = e.target.checked;
        updateBrushSpecificSettingsVisibility(); // Update visibility of smoothing factor
        syncWorkInProgress();
    });

    smoothingFactor.addEventListener('input', (e) => {
        // UI value 0-100, internal value 0-0.1
        const newFactor = parseFloat(e.target.value) / 1000;
        state.brush.smoothingFactor = newFactor;
        smoothingFactorValue.textContent = `${(newFactor * 100).toFixed(1)}%`;
        syncWorkInProgress();
    });

    wireframeMeshOpacity.addEventListener('input', (e) => {
        const newOpacity = parseFloat(e.target.value);
        state.brush.wireframeMeshOpacity = newOpacity;
        wireframeMeshOpacityValue.textContent = `${Math.round(newOpacity * 100)}%`;
        syncWorkInProgress();
    });
    wireframeLineOpacity.addEventListener('input', (e) => {
        const newOpacity = parseFloat(e.target.value);
        state.brush.wireframeLineOpacity = newOpacity;
        wireframeLineOpacityValue.textContent = `${Math.round(newOpacity * 100)}%`;
        syncWorkInProgress();
    });
    wireframeHullThickness.addEventListener('input', (e) => {
        const newThicknessFactor = parseFloat(e.target.value);
        state.brush.wireframeHullLineThickness = newThicknessFactor;
        wireframeHullThicknessValue.textContent = `${newThicknessFactor.toFixed(1)}x`;
        syncWorkInProgress();
    });
    wireframeMeshThickness.addEventListener('input', (e) => {
        const newThickness = parseFloat(e.target.value);
        state.brush.wireframeMeshLineThickness = newThickness;
        wireframeMeshThicknessValue.textContent = newThickness.toFixed(1);
        syncWorkInProgress();
    });
    wireframeMaxMeshLength.addEventListener('input', (e) => {
        let newLength = parseFloat(e.target.value);
        // If the slider is at its max, consider it 'Infinity' for practical purposes
        if (newLength === parseFloat(e.target.max)) {
            state.brush.wireframeMaxMeshLength = Infinity;
            wireframeMaxMeshLengthValue.textContent = '∞';
        } else {
            state.brush.wireframeMaxMeshLength = newLength;
            wireframeMaxMeshLengthValue.textContent = newLength.toFixed(0);
        }
        syncWorkInProgress();
    });

    wireframePointRadius.addEventListener('input', (e) => {
        const newRadius = parseFloat(e.target.value);
        state.brush.wireframePointRadius = newRadius;
        wireframePointRadiusValue.textContent = newRadius.toFixed(1);
        syncWorkInProgress();
    });
    wireframePointOpacity.addEventListener('input', (e) => {
        const newOpacity = parseFloat(e.target.value);
        state.brush.wireframePointOpacity = newOpacity;
        wireframePointOpacityValue.textContent = `${Math.round(newOpacity * 100)}%`;
        syncWorkInProgress();
    });
    wireframeAnimationSpeed.addEventListener('input', (e) => {
        const newSpeed = parseInt(e.target.value, 10);
        state.brush.wireframeAnimationSpeed = newSpeed;
        wireframeAnimationSpeedValue.textContent = `${newSpeed / 1000}s`;
        if (state.currentStroke && state.currentStroke.type === 'wireframe') {
            state.currentStroke.needsJitterUpdate = true;
        }
        syncWorkInProgress();
    });
    wireframeAnimationAmount.addEventListener('input', (e) => {
        const newAmount = parseFloat(e.target.value);
        state.brush.wireframeAnimationAmount = newAmount;
        wireframeAnimationAmountValue.textContent = `${newAmount.toFixed(1)}px`;
        if (state.currentStroke && state.currentStroke.type === 'wireframe') {
            state.currentStroke.needsJitterUpdate = true;
        }
        syncWorkInProgress();
    });
    wireframeGradientMeshToggle.addEventListener('change', (e) => {
        state.brush.wireframeGradientMesh = e.target.checked;
        updateBrushSpecificSettingsVisibility(); // To show/hide the boost factor slider
        syncWorkInProgress();
    });
    wireframeGradientMeshBoostFactor.addEventListener('input', (e) => {
        const newFactor = parseFloat(e.target.value);
        state.brush.wireframeGradientMeshBoostFactor = newFactor;
        wireframeGradientMeshBoostFactorValue.textContent = `${newFactor.toFixed(1)}x`;
        syncWorkInProgress();
    });

    sketchyJitterAmount.addEventListener('input', (e) => {
        const newAmount = parseFloat(e.target.value);
        state.brush.jitterAmount = newAmount;
        sketchyJitterAmountValue.textContent = `${Math.round(newAmount * 100)}%`;
        // Trigger jitter update for active stroke if animated sketchy
        if (state.currentStroke && state.currentStroke.type === 'sketchy-animated') {
            state.currentStroke.needsJitterUpdate = true;
        }
        syncWorkInProgress();
    });
    sketchyJitterDensity.addEventListener('input', (e) => {
        const newDensity = parseInt(e.target.value, 10);
        state.brush.jitterDensity = newDensity;
        sketchyJitterDensityValue.textContent = newDensity;
        // Trigger jitter update for active stroke if animated sketchy
        if (state.currentStroke && state.currentStroke.type === 'sketchy-animated') {
            state.currentStroke.needsJitterUpdate = true;
        }
        syncWorkInProgress();
    });
    sketchyAnimationInterval.addEventListener('input', (e) => {
        const newInterval = parseInt(e.target.value, 10);
        state.brush.animationInterval = newInterval;
        sketchyAnimationIntervalValue.textContent = `${newInterval / 1000}s`;
        syncWorkInProgress();
    });

    // Canvas settings Listeners (canvas tab)
    canvasBgColor.addEventListener('input', (e) => {
        state.canvasSettings.backgroundColor = e.target.value;
        scheduleSave();
    });

    canvasBgType.addEventListener('change', (e) => {
        state.canvasSettings.backgroundType = e.target.value;
        scheduleSave();
    });

    canvasBgSpacing.addEventListener('input', (e) => {
        const newSpacing = parseFloat(e.target.value);
        state.canvasSettings.backgroundSpacing = newSpacing;
        canvasBgSpacingValue.textContent = `${newSpacing}px`;
        scheduleSave();
    });

    canvasBgLineColor.addEventListener('input', (e) => {
        state.canvasSettings.backgroundLineColor = e.target.value;
        scheduleSave();
    });

    canvasBgLineWidth.addEventListener('input', (e) => {
        const newWidth = parseFloat(e.target.value);
        state.canvasSettings.backgroundLineWidth = newWidth;
        canvasBgLineWidthValue.textContent = `${newWidth}px`;
        scheduleSave();
    });

    renderMode.addEventListener('change', (e) => {
        state.renderMode = e.target.value;
        scheduleSave();
        
        // If switching to bitmap, we might need a visual refresh of chunks
        if (state.renderMode === 'bitmap') {
            window.dispatchEvent(new CustomEvent('rebuildChunksRequest'));
        }
    });

    // Preset save/load functionality
    saveCurrentPresetBtn.addEventListener('click', () => {
        const activePresetId = state.activeBrushPresetId;
        if (activePresetId && state.brushPresets[activePresetId]) {
            // Save current state as the new permanent preset, but STRIP color 
            // so it doesn't get baked into the preset definition.
            const brushToSave = structuredClone(state.brush);
            delete brushToSave.color;
            
            state.brushPresets[activePresetId] = brushToSave;
            scheduleSave();
            syncUiWithState();
            console.log(`Preset "${state.brushPresets[activePresetId].name}" saved without color-baking.`);
        }
    });

    resetBrushBtn.addEventListener('click', () => {
        const activePresetId = state.activeBrushPresetId;
        if (activePresetId && state.brushPresets[activePresetId]) {
            // Reset to the saved preset but preserve current color
            const previousColor = state.brush.color;
            state.brush = structuredClone(state.brushPresets[activePresetId]);
            state.brush.color = previousColor;

            // Clear any WIP settings for this brush
            state.brushWorkInProgress[activePresetId] = structuredClone(state.brush);
            syncUiWithState();
            console.log(`Brush "${state.brushPresets[activePresetId].name}" reset to preset (color preserved).`);
        }
    });

    // This is a bit of a hack to make sure the toolbar updates if the eyedropper is used
    // A more robust solution would be a proper event system or state manager.
    const mainCanvas = document.getElementById('drawing-canvas');
    mainCanvas.addEventListener('pointerdown', () => {
        // A short delay to allow the state to update from the eyedropper
        setTimeout(syncUiWithState, 50);
    });
    
    // Also sync on E/W key presses for brush size
    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'e' || e.key.toLowerCase() === 'w') { // Changed from [ / ] to E / W
            setTimeout(syncUiWithState, 10);
        }
    });

    // Listen for custom event to update UI when active brush changes
    window.addEventListener('activeBrushChanged', syncUiWithState);
}
