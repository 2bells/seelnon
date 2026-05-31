// rpg/game/editor/editor_ui_manager.js
console.log("rpg/game/editor/editor_ui_manager.js loaded");

// Import SPAWN_TYPES from MapEditor directly if they are exported there, or define locally.
// Assuming MapEditor exports SPAWN_TYPES:
import { SPAWN_TYPES } from './map_editor.js';
import { getAllCustomEvents } from './event_editor.js';
import { db, STORES } from '../utils/db.js';

const SPRITESHEET_TILE_SIZE = 64; // Must match MapEditor's constant

// Define standard object configurations for the palette
const OBJECT_PALETTE_DEFINITIONS = {
    tree: {
        type: 'tree',
        displayName: 'Tree',
        assetName: 'tree', // Engine.assets key
        scale: 2,
        anchorOffsetXFactor: 0.5,
        anchorOffsetYFactor: 0.95,
        collidable: true, // Default
    },
    table: {
        type: 'table',
        displayName: 'Table',
        assetName: 'buildingSpritesheet',
        spriteSourceRect: { x: 1 * (SPRITESHEET_TILE_SIZE + 2), y: 5 * (SPRITESHEET_TILE_SIZE + 2), width: SPRITESHEET_TILE_SIZE, height: SPRITESHEET_TILE_SIZE },
        visualWidth: SPRITESHEET_TILE_SIZE,
        visualHeight: SPRITESHEET_TILE_SIZE,
        anchorOffsetX: SPRITESHEET_TILE_SIZE / 2,
        anchorOffsetY: SPRITESHEET_TILE_SIZE, // Anchor at bottom-center of the small sprite
        collidable: true,
        collisionShape: { type: 'rectangle', width: 30, height: 16, xOffset: -15, yOffset: -16 }, // Relative to anchor
    },
    note: {
        type: 'note',
        displayName: 'Context Note',
        assetName: 'note_icon',
        visualWidth: 32,
        visualHeight: 32,
        anchorOffsetX: 16,
        anchorOffsetY: 32, // Anchor at bottom-center of the small sprite
        collidable: false,
    }
};


class EditorUIManager {
    constructor(editor, modalContentElement) {
        this.editor = editor; // Reference to the main MapEditor instance
        this.mapOperations = editor.mapOperations; // Reference to EditorMapOperations instance
        this.modalContentElement = modalContentElement;

        // Panel elements
        this.toolsPanel = null;
        this.operationsPanel = null;
        this.operationsPanelContent = null;
        this.objectPaletteContainer = null; // For object selection
        this.collidableCheckbox = null; // Checkbox for object collidability

        // Containers for tile/preview tools (captured during creation)
        this.spritesheetContainerElement = null;
        this.previewContainerElement = null;

        // Canvas elements for tileset and preview
        this.spritesheetCanvas = null;
        this.spritesheetCtx = null;
        this.previewCanvas = null;
        this.previewCtx = null;

        // Layer display
        this.layerDisplayElement = null;
        this.layerInfoTextElement = null; // For layer-specific instructions
        
        this.fileInput = null; // For map uploads, managed here as it's a UI element

        // New UI elements for tools
        this.pencilToolButton = null;
        this.eraserToolButton = null;
        this.undoToolButton = null;
        this.redoToolButton = null;
        this.snapToGridCheckbox = null;
        this.snapToGridLabel = null;

        // Container for loadable map list
        this.loadMapsListContainer = null;

        // UI Elements for Spawn Layer
        this.spawnTypeSelect = null;
        this.spawnTargetMapInput = null;
        this.spawnTypeContainer = null; // Container for spawn-specific controls
        this.spawnPermanentNpcContainer = null;
        this.spawnNpcBrushInfo = null;
        this.npcJsonInput = null;
        this.spawnEnemyContainer = null; // New container for enemy selection
        this.spawnEnemySelect = null; // New dropdown for enemies

        this.spawnEventContainer = null;
        this.spawnEventSelect = null;
        this.spawnEventModeSelect = null;
        this.spawnEventMessageInput = null;
        this.spawnEventEmojiSelect = null;

        // New UI elements for spritesheets
        this.spritesheetControlsContainer = null;
        this.uploadSpritesheetButton = null;
        this.prevSpritesheetButton = null;
        this.nextSpritesheetButton = null;
        this.spritesheetFileInput = null;
        this.spritesheetNameDisplay = null;

        // Custom sprite and selection tool components
        this.selectToolButton = null;
        this.deselectToolButton = null;
        this.spriteConfigPanel = null;
        this.bulkSelectionPanel = null;
    }

    createPanels() {
        this._createOperationsPanel();
        this._createToolsPanel();
        this._createSpriteConfiguratorPanel();
        this._createBulkSelectionPanel();
        this.setupStyles(); // Apply common styles
        this._setToolIcons(); // Set icons after creating buttons
    }

    _createOperationsPanel() {
        this.operationsPanel = document.createElement('div');
        this.operationsPanel.id = 'rpg-editor-operations-panel';

        const opTitleButton = document.createElement('button');
        opTitleButton.id = 'rpg-editor-operations-toggle';
        opTitleButton.textContent = 'Map Operations ';
        opTitleButton.onclick = () => this.toggleOperationsPanel();
        this.operationsPanel.appendChild(opTitleButton);
        
        this.operationsPanelContent = document.createElement('div');
        this.operationsPanelContent.id = 'rpg-editor-operations-content';

        const newMapButton = document.createElement('button');
        newMapButton.textContent = 'New Map';
        newMapButton.onclick = this.mapOperations.promptNewMap;
        this.operationsPanelContent.appendChild(newMapButton);

        const saveLocalButton = document.createElement('button');
        saveLocalButton.textContent = 'Save Local';
        saveLocalButton.onclick = this.mapOperations.saveMapToLocal;
        this.operationsPanelContent.appendChild(saveLocalButton);
        
        const loadLocalButton = document.createElement('button');
        loadLocalButton.textContent = 'Load Local';
        loadLocalButton.onclick = this.mapOperations.loadMapFromLocal;
        this.operationsPanelContent.appendChild(loadLocalButton);

        const downloadMapButton = document.createElement('button');
        downloadMapButton.textContent = 'Download Map';
        downloadMapButton.onclick = this.mapOperations.downloadMapFile;
        this.operationsPanelContent.appendChild(downloadMapButton);

        const mapUploadId = 'rpg-map-file-upload-input';
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.id = mapUploadId;
        this.fileInput.accept = '.json';
        this.fileInput.style.display = 'none';
        this.fileInput.onchange = this.mapOperations.handleFileUpload; // Event handled by mapOperations
        this.operationsPanelContent.appendChild(this.fileInput); 

        const uploadMapButton = document.createElement('label');
        uploadMapButton.htmlFor = mapUploadId;
        uploadMapButton.className = 'rpg-file-label';
        uploadMapButton.style.display = 'block';
        uploadMapButton.style.width = '100%';
        uploadMapButton.style.marginBottom = '6px';
        uploadMapButton.textContent = 'Upload Map (.json)';
        this.operationsPanelContent.appendChild(uploadMapButton);
        
        this.operationsPanel.appendChild(this.operationsPanelContent);
        this.modalContentElement.appendChild(this.operationsPanel);
    }

    _createToolsPanel() {
        this.toolsPanel = document.createElement('div');
        this.toolsPanel.id = 'rpg-editor-tools-panel';

        // --- Title / Collapsible Header Toggle ---
        const titleButton = document.createElement('button');
        titleButton.id = 'rpg-editor-tools-toggle';
        titleButton.textContent = 'Tile & Object Palette';
        titleButton.onclick = () => this.toolsPanel.classList.toggle('collapsed');
        this.toolsPanel.appendChild(titleButton);

        // --- Panel Content Wrapper ---
        this.toolsContent = document.createElement('div');
        this.toolsContent.id = 'rpg-editor-tools-content';
        this.toolsPanel.appendChild(this.toolsContent);

        // --- Layer Navigation ---
        const layerNavContainer = document.createElement('div');
        layerNavContainer.className = 'rpg-editor-layer-nav';
        const prevLayerButton = document.createElement('button');
        prevLayerButton.textContent = '<'; // Use text for now
        prevLayerButton.onclick = this.editor._boundPrevLayer; // Calls MapEditor's method
        this.layerDisplayElement = document.createElement('span');
        this.layerDisplayElement.className = 'rpg-editor-layer-display';
        const nextLayerButton = document.createElement('button');
        nextLayerButton.textContent = '>'; // Use text for now
        nextLayerButton.onclick = this.editor._boundNextLayer; // Calls MapEditor's method
        layerNavContainer.appendChild(prevLayerButton);
        layerNavContainer.appendChild(this.layerDisplayElement);
        layerNavContainer.appendChild(nextLayerButton);
        this.toolsContent.appendChild(layerNavContainer); 
        this.editor.updateLayerDisplay(); // Initial display update

        // --- Tool Selection (Pencil/Eraser/Undo/Redo) ---
        const toolSelectionContainer = document.createElement('div');
        toolSelectionContainer.className = 'rpg-editor-tool-selection';
        
        this.pencilToolButton = document.createElement('button');
        this.pencilToolButton.id = 'rpg-editor-pencil-tool';
        this.pencilToolButton.onclick = () => this.editor.selectTool('place');
        this.pencilToolButton.title = 'Place Tile/Object';
        
        this.eraserToolButton = document.createElement('button');
        this.eraserToolButton.id = 'rpg-editor-eraser-tool';
        this.eraserToolButton.onclick = () => this.editor.selectTool('erase');
        this.eraserToolButton.title = 'Erase Tile/Object';

        this.selectToolButton = document.createElement('button');
        this.selectToolButton.id = 'rpg-editor-select-tool';
        this.selectToolButton.onclick = () => this.editor.selectTool('select');
        this.selectToolButton.title = 'Select & Group Elements (🔍)';
        this.selectToolButton.innerHTML = '🔍';
        this.selectToolButton.style.fontSize = '1em';

        this.deselectToolButton = document.createElement('button');
        this.deselectToolButton.id = 'rpg-editor-deselect-tool';
        this.deselectToolButton.onclick = () => this.editor.selectTool('deselect');
        this.deselectToolButton.title = 'Deselect Elements (❌)';
        this.deselectToolButton.innerHTML = '❌';
        this.deselectToolButton.style.fontSize = '1em';

        this.undoToolButton = document.createElement('button');
        this.undoToolButton.id = 'rpg-editor-undo-tool';
        this.undoToolButton.onclick = () => this.editor.undo();
        this.undoToolButton.title = 'Undo Action (Ctrl+Z)';
        this.undoToolButton.innerHTML = '&#8630;'; // Unicode ↶ Undo
        this.undoToolButton.style.fontSize = '1.2em';

        this.redoToolButton = document.createElement('button');
        this.redoToolButton.id = 'rpg-editor-redo-tool';
        this.redoToolButton.onclick = () => this.editor.redo();
        this.redoToolButton.title = 'Redo Action (Ctrl+Y)';
        this.redoToolButton.innerHTML = '&#8631;'; // Unicode ↷ Redo
        this.redoToolButton.style.fontSize = '1.2em';

        toolSelectionContainer.appendChild(this.pencilToolButton);
        toolSelectionContainer.appendChild(this.eraserToolButton);
        toolSelectionContainer.appendChild(this.selectToolButton);
        toolSelectionContainer.appendChild(this.deselectToolButton);
        toolSelectionContainer.appendChild(this.undoToolButton);
        toolSelectionContainer.appendChild(this.redoToolButton);
        this.toolsContent.appendChild(toolSelectionContainer); 

        // --- Spritesheet Controls ---
        this.spritesheetControlsContainer = document.createElement('div');
        this.spritesheetControlsContainer.className = 'rpg-editor-tool-selection'; // Reuse style
        this.spritesheetControlsContainer.style.marginTop = '10px';

        this.prevSpritesheetButton = document.createElement('button');
        this.prevSpritesheetButton.textContent = '←';
        this.prevSpritesheetButton.onclick = () => this.editor.prevSpritesheet();
        this.prevSpritesheetButton.title = 'Previous Spritesheet';
        
        const sheetUploadId = 'rpg-sheet-file-upload-input';
        this.spritesheetFileInput = document.createElement('input');
        this.spritesheetFileInput.id = sheetUploadId;
        this.spritesheetFileInput.type = 'file';
        this.spritesheetFileInput.accept = 'image/png, image/jpeg';
        this.spritesheetFileInput.style.display = 'none';
        this.spritesheetFileInput.onchange = (event) => this.editor.handleSpritesheetUpload(event);
        
        this.uploadSpritesheetButton = document.createElement('label');
        this.uploadSpritesheetButton.htmlFor = sheetUploadId;
        this.uploadSpritesheetButton.className = 'rpg-file-label';
        this.uploadSpritesheetButton.innerHTML = '&#11014;'; // Up arrow emoji
        this.uploadSpritesheetButton.title = 'Upload Spritesheet';

        this.nextSpritesheetButton = document.createElement('button');
        this.nextSpritesheetButton.textContent = '→';
        this.nextSpritesheetButton.onclick = () => this.editor.nextSpritesheet();
        this.nextSpritesheetButton.title = 'Next Spritesheet';

        this.spritesheetControlsContainer.appendChild(this.prevSpritesheetButton);
        this.spritesheetControlsContainer.appendChild(this.uploadSpritesheetButton);
        this.spritesheetControlsContainer.appendChild(this.nextSpritesheetButton);
        this.spritesheetControlsContainer.appendChild(this.spritesheetFileInput);

        // --- Snap to Grid Checkbox ---
        this.snapToGridLabel = document.createElement('label');
        this.snapToGridLabel.className = 'rpg-editor-snap-label';
        this.snapToGridCheckbox = document.createElement('input');
        this.snapToGridCheckbox.type = 'checkbox';
        this.snapToGridCheckbox.id = 'rpg-editor-snap-checkbox';
        this.snapToGridCheckbox.checked = this.editor.snapToGrid; 
        this.snapToGridCheckbox.onchange = () => this.editor.toggleSnapToGrid(this.snapToGridCheckbox.checked);
        this.snapToGridLabel.appendChild(this.snapToGridCheckbox);
        const snapToGridText = document.createElement('span');
        snapToGridText.textContent = ' Snap to Grid';
        this.snapToGridLabel.appendChild(snapToGridText);

        // --- Spritesheet Name Display ---
        this.spritesheetNameDisplay = document.createElement('div');
        this.spritesheetNameDisplay.className = 'rpg-editor-info';
        this.spritesheetNameDisplay.style.textAlign = 'center';
        this.spritesheetNameDisplay.style.marginBottom = '5px';
        this.toolsContent.appendChild(this.spritesheetNameDisplay);

        // --- Tile Spritesheet (shown for 'tile' and 'object1' layers) ---
        this.spritesheetContainerElement = document.createElement('div'); 
        this.spritesheetContainerElement.id = 'rpg-editor-spritesheet-container';
        this.spritesheetCanvas = document.createElement('canvas');
        this.spritesheetCanvas.id = 'rpg-editor-spritesheet-canvas';
        this.spritesheetCtx = this.spritesheetCanvas.getContext('2d');
        this.spritesheetContainerElement.appendChild(this.spritesheetCanvas);
        this.toolsContent.appendChild(this.spritesheetContainerElement); 

        // Arrows, upload, and snap to grid placed BELOW the spritesheet window
        this.toolsContent.appendChild(this.spritesheetControlsContainer);
        this.toolsContent.appendChild(this.snapToGridLabel); 

        // --- Selected Tile Preview (shown for 'tile' and 'object1' layers) ---
        this.previewContainerElement = document.createElement('div'); 
        this.previewContainerElement.id = 'rpg-editor-tile-preview-container';
        this.previewContainerElement.style.marginBottom = '25px';
        this.previewCanvas = document.createElement('canvas');
        this.previewCanvas.id = 'rpg-editor-tile-preview-canvas';
        this.previewCanvas.width = SPRITESHEET_TILE_SIZE;
        this.previewCanvas.height = SPRITESHEET_TILE_SIZE;
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.previewContainerElement.appendChild(this.previewCanvas);
        this.toolsContent.appendChild(this.previewContainerElement); 
        
        // --- Object Palette (shown for 'object2' layers) ---
        this.objectPaletteWrapper = document.createElement('div');
        this.objectPaletteWrapper.id = 'rpg-editor-object-palette-wrapper';
        this.objectPaletteWrapper.style.display = 'none'; // Initially hidden
        this.toolsContent.appendChild(this.objectPaletteWrapper);

        const paletteTitle = document.createElement('h4');
        paletteTitle.textContent = 'Object Palette';
        this.objectPaletteWrapper.appendChild(paletteTitle);

        // Uploader & Configurator Toggle Button
        const openSpriteCreatorBtn = document.createElement('button');
        openSpriteCreatorBtn.textContent = '🖼️ Create Custom Sprite';
        openSpriteCreatorBtn.style.width = '100%';
        openSpriteCreatorBtn.style.padding = '8px';
        openSpriteCreatorBtn.style.marginBottom = '12px';
        openSpriteCreatorBtn.style.backgroundColor = '#d35400';
        openSpriteCreatorBtn.style.color = 'white';
        openSpriteCreatorBtn.style.border = 'none';
        openSpriteCreatorBtn.style.borderRadius = '4px';
        openSpriteCreatorBtn.style.fontWeight = 'bold';
        openSpriteCreatorBtn.style.cursor = 'pointer';
        openSpriteCreatorBtn.onclick = () => {
            if (this.spriteConfigPanel) {
                const isShowing = this.spriteConfigPanel.style.display === 'none';
                this.spriteConfigPanel.style.display = isShowing ? 'block' : 'none';
                if (isShowing && typeof this.resetSpriteCreator === 'function') {
                    this.resetSpriteCreator();
                }
            }
        };
        this.objectPaletteWrapper.appendChild(openSpriteCreatorBtn);

        // --- Prefab Import Row ---
        const prefabImportRow = document.createElement('div');
        prefabImportRow.id = 'rpg-editor-prefab-import-row';
        prefabImportRow.style.display = 'flex';
        prefabImportRow.style.gap = '8px';
        prefabImportRow.style.marginBottom = '12px';

        const importPrefabBtn = document.createElement('button');
        importPrefabBtn.textContent = '📁 Import Prefab (.json)';
        importPrefabBtn.style.flex = '1';
        importPrefabBtn.style.padding = '8px';
        importPrefabBtn.style.backgroundColor = '#1abc9c';
        importPrefabBtn.style.color = 'white';
        importPrefabBtn.style.border = 'none';
        importPrefabBtn.style.borderRadius = '4px';
        importPrefabBtn.style.fontWeight = 'bold';
        importPrefabBtn.style.cursor = 'pointer';

        const importPrefabInput = document.createElement('input');
        importPrefabInput.type = 'file';
        importPrefabInput.accept = '.json';
        importPrefabInput.style.display = 'none';
        importPrefabInput.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const parsed = JSON.parse(e.target.result);
                    if (parsed && parsed.isCustomBaked && parsed.assetName && parsed.customData) {
                        this.editor.map.customPaletteDefinitions = this.editor.map.customPaletteDefinitions || {};
                        this.editor.map.customPaletteDefinitions[parsed.assetName] = parsed;
                        
                        // Import in IndexedDB (STORES.PREFABS)
                        await db.set(STORES.PREFABS, parsed.assetName, parsed);
                        
                        this.refreshObjectPalette();
                        CustomDialog.alert(`Prefab "${parsed.displayName}" loaded & stored permanently in IndexedDB!`, "Import Success");
                    } else {
                        CustomDialog.alert("JSON structure is incompatible. Make sure it is exported from this Map Editor.", "Format Error");
                    }
                } catch(err) {
                    CustomDialog.alert("Could not load prefab: " + err.message, "Parsing Error");
                }
            };
            reader.readAsText(file);
        };
        importPrefabBtn.onclick = () => importPrefabInput.click();

        prefabImportRow.appendChild(importPrefabBtn);
        prefabImportRow.appendChild(importPrefabInput);
        this.objectPaletteWrapper.appendChild(prefabImportRow);

        this.objectPaletteContainer = document.createElement('div');
        this.objectPaletteContainer.id = 'rpg-editor-object-palette';
        this.objectPaletteWrapper.appendChild(this.objectPaletteContainer);

        // --- Custom Prefab Controls Panel ---
        this.customPrefabDetailsWrapper = document.createElement('div');
        this.customPrefabDetailsWrapper.id = 'rpg-editor-custom-prefab-details';
        this.customPrefabDetailsWrapper.style.display = 'none'; // Initially hidden
        this.customPrefabDetailsWrapper.style.marginTop = '15px';
        this.customPrefabDetailsWrapper.style.padding = '12px';
        this.customPrefabDetailsWrapper.style.border = '1px solid #5A4B3E';
        this.customPrefabDetailsWrapper.style.borderRadius = '5px';
        this.customPrefabDetailsWrapper.style.backgroundColor = '#2c241d';
        this.customPrefabDetailsWrapper.style.fontSize = '12px';
        this.objectPaletteWrapper.appendChild(this.customPrefabDetailsWrapper);

        this.refreshObjectPalette();
        
        // Collidable checkbox for objects - moved outside objectPaletteContainer to be shown for obj1 & obj2
        const collidableLabel = document.createElement('label');
        collidableLabel.style.display = 'flex'; 
        collidableLabel.style.alignItems = 'center';
        collidableLabel.style.marginTop = '10px';
        this.collidableCheckbox = document.createElement('input');
        this.collidableCheckbox.type = 'checkbox';
        this.collidableCheckbox.id = 'rpg-editor-collidable-checkbox';
        this.collidableCheckbox.checked = true; // Default to true
        this.collidableCheckbox.onchange = () => {
            if (this.editor.selectedObjectBrush) {
                this.editor.selectedObjectBrush.collidable = this.collidableCheckbox.checked;
            }
        };
        collidableLabel.appendChild(this.collidableCheckbox);
        const collidableText = document.createElement('span');
        collidableText.textContent = ' Collidable';
        collidableText.style.marginLeft = '5px';
        collidableLabel.appendChild(collidableText);
        this.toolsContent.appendChild(collidableLabel); 

        // Disable Y-Sorting checkbox for objects
        this.disableYSortLabel = document.createElement('label');
        this.disableYSortLabel.style.display = 'flex'; 
        this.disableYSortLabel.style.alignItems = 'center';
        this.disableYSortLabel.style.marginTop = '10px';
        this.disableYSortCheckbox = document.createElement('input');
        this.disableYSortCheckbox.type = 'checkbox';
        this.disableYSortCheckbox.id = 'rpg-editor-disable-y-sort-checkbox';
        this.disableYSortCheckbox.checked = false; // Default is false (Y-sorted)
        this.disableYSortCheckbox.onchange = () => {
            if (this.editor.selectedObjectBrush) {
                this.editor.selectedObjectBrush.disableYSorting = this.disableYSortCheckbox.checked;
            }
        };
        this.disableYSortLabel.appendChild(this.disableYSortCheckbox);
        const disableYSortText = document.createElement('span');
        disableYSortText.textContent = ' Disable Y-Sorting (render behind)';
        disableYSortText.style.marginLeft = '5px';
        this.disableYSortLabel.appendChild(disableYSortText);
        this.toolsContent.appendChild(this.disableYSortLabel);

        // Z-Index number input for objects
        this.zIndexContainer = document.createElement('div');
        this.zIndexContainer.style.display = 'flex';
        this.zIndexContainer.style.alignItems = 'center';
        this.zIndexContainer.style.marginTop = '10px';
        this.zIndexContainer.style.marginBottom = '10px';
        
        const zIndexLabel = document.createElement('span');
        zIndexLabel.textContent = 'Object Z-Index: ';
        zIndexLabel.style.marginRight = '10px';
        this.zIndexContainer.appendChild(zIndexLabel);

        this.objectZIndexInput = document.createElement('input');
        this.objectZIndexInput.type = 'number';
        this.objectZIndexInput.id = 'rpg-editor-object-zindex-input';
        this.objectZIndexInput.value = '0';
        this.objectZIndexInput.style.width = '60px';
        this.objectZIndexInput.style.padding = '4px';
        this.objectZIndexInput.style.backgroundColor = '#1e1e1e';
        this.objectZIndexInput.style.color = '#fff';
        this.objectZIndexInput.style.border = '1px solid #444';
        this.objectZIndexInput.style.borderRadius = '3px';
        this.objectZIndexInput.onchange = () => {
            if (this.editor.selectedObjectBrush) {
                this.editor.selectedObjectBrush.zIndex = Number(this.objectZIndexInput.value);
            }
        };
        this.zIndexContainer.appendChild(this.objectZIndexInput);
        this.toolsContent.appendChild(this.zIndexContainer);

        // Z-Index number input for tiles
        this.tileZIndexContainer = document.createElement('div');
        this.tileZIndexContainer.style.display = 'flex';
        this.tileZIndexContainer.style.alignItems = 'center';
        this.tileZIndexContainer.style.marginTop = '10px';
        this.tileZIndexContainer.style.marginBottom = '10px';
        
        const tileZIndexLabel = document.createElement('span');
        tileZIndexLabel.textContent = 'Tile Z-Index: ';
        tileZIndexLabel.style.marginRight = '10px';
        this.tileZIndexContainer.appendChild(tileZIndexLabel);

        this.tileZIndexInput = document.createElement('input');
        this.tileZIndexInput.type = 'number';
        this.tileZIndexInput.id = 'rpg-editor-tile-zindex-input';
        this.tileZIndexInput.value = '0';
        this.tileZIndexInput.style.width = '60px';
        this.tileZIndexInput.style.padding = '4px';
        this.tileZIndexInput.style.backgroundColor = '#1e1e1e';
        this.tileZIndexInput.style.color = '#fff';
        this.tileZIndexInput.style.border = '1px solid #444';
        this.tileZIndexInput.style.borderRadius = '3px';
        this.tileZIndexInput.onchange = () => {
            if (this.editor.selectedTileBrush) {
                this.editor.selectedTileBrush.zIndex = Number(this.tileZIndexInput.value);
            }
        };
        this.tileZIndexContainer.appendChild(this.tileZIndexInput);
        this.toolsContent.appendChild(this.tileZIndexContainer);

        // --- Spawn Layer Specific Controls ---
        this.spawnTypeContainer = document.createElement('div');
        this.spawnTypeContainer.id = 'rpg-editor-spawn-controls';
        this.spawnTypeContainer.style.display = 'none'; // Hidden by default

        // Elegant inline helper for abilities-style row form inputs
        const makeFormRow = (labelText, inputElement, parentContainer) => {
            const row = document.createElement('div');
            row.className = 'abilities-form-row';
            row.style.marginBottom = '8px';
            const lbl = document.createElement('label');
            lbl.textContent = labelText;
            row.appendChild(lbl);
            row.appendChild(inputElement);
            parentContainer.appendChild(row);
            return row;
        };

        this.spawnTypeSelect = document.createElement('select');
        this.spawnTypeSelect.id = 'rpg-editor-spawn-type-select';
        for (const typeKey in SPAWN_TYPES) {
            const option = document.createElement('option');
            option.value = SPAWN_TYPES[typeKey];
            option.textContent = SPAWN_TYPES[typeKey].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); // Format for display
            this.spawnTypeSelect.appendChild(option);
        }
        this.spawnTypeSelect.onchange = () => this.updateToolPanelVisibility(); // Re-check visibility for targetMapInput
        makeFormRow('Spawn Type', this.spawnTypeSelect, this.spawnTypeContainer);

        this.spawnTargetMapInput = document.createElement('input');
        this.spawnTargetMapInput.type = 'text';
        this.spawnTargetMapInput.id = 'rpg-editor-spawn-targetmap-input';
        this.spawnTargetMapInput.placeholder = 'e.g., next_level';
        makeFormRow('Target Map Name', this.spawnTargetMapInput, this.spawnTypeContainer);

        // --- Container for permanent NPC upload ---
        this.spawnPermanentNpcContainer = document.createElement('div');
        this.spawnPermanentNpcContainer.id = 'rpg-editor-spawn-permanent-npc-controls';
        this.spawnPermanentNpcContainer.style.marginTop = '10px';

        const npcBrushUploadId = 'rpg-npc-brush-file-upload-input';
        this.npcJsonInput = document.createElement('input');
        this.npcJsonInput.id = npcBrushUploadId;
        this.npcJsonInput.type = 'file';
        this.npcJsonInput.accept = '.json';
        this.npcJsonInput.style.display = 'none';
        this.npcJsonInput.onchange = (event) => this.editor.handleNpcJsonUpload(event);

        const uploadNpcRow = document.createElement('div');
        uploadNpcRow.className = 'abilities-form-row';
        uploadNpcRow.style.marginBottom = '6px';
        const uploadNpcLabel = document.createElement('label');
        uploadNpcLabel.textContent = 'NPC Blueprint';
        
        const uploadNpcButton = document.createElement('label');
        uploadNpcButton.htmlFor = npcBrushUploadId;
        uploadNpcButton.className = 'rpg-file-label';
        uploadNpcButton.style.display = 'block';
        uploadNpcButton.style.padding = '4.5px 8px';
        uploadNpcButton.style.fontSize = '0.9em';
        uploadNpcButton.style.textAlign = 'center';
        uploadNpcButton.style.cursor = 'pointer';
        uploadNpcButton.style.backgroundColor = '#3B322C';
        uploadNpcButton.style.border = '1px solid #8C6D56';
        uploadNpcButton.style.borderRadius = '4px';
        uploadNpcButton.style.color = '#EFEBE0';
        uploadNpcButton.textContent = 'Upload (.json)';

        uploadNpcRow.appendChild(uploadNpcLabel);
        uploadNpcRow.appendChild(uploadNpcButton);
        this.spawnPermanentNpcContainer.appendChild(this.npcJsonInput);
        this.spawnPermanentNpcContainer.appendChild(uploadNpcRow);

        this.spawnNpcBrushInfo = document.createElement('p');
        this.spawnNpcBrushInfo.className = 'rpg-editor-info';
        this.spawnNpcBrushInfo.style.textAlign = 'center';
        this.spawnNpcBrushInfo.style.fontSize = '0.85em';
        this.spawnNpcBrushInfo.style.color = '#e67e22';
        this.spawnNpcBrushInfo.style.marginTop = '4px';
        this.spawnNpcBrushInfo.textContent = 'No NPC loaded.';
        this.spawnPermanentNpcContainer.appendChild(this.spawnNpcBrushInfo);
        
        this.spawnTypeContainer.appendChild(this.spawnPermanentNpcContainer);

        // --- Container for enemy selection ---
        this.spawnEnemyContainer = document.createElement('div');
        this.spawnEnemyContainer.id = 'rpg-editor-spawn-enemy-controls';
        this.spawnEnemyContainer.style.marginTop = '10px';

        this.spawnEnemySelect = document.createElement('select');
        this.spawnEnemySelect.id = 'rpg-editor-spawn-enemy-select';
        makeFormRow('Enemy Type', this.spawnEnemySelect, this.spawnEnemyContainer);

        this.spawnTypeContainer.appendChild(this.spawnEnemyContainer);

        // --- Container for custom Event selection and parameters ---
        this.spawnEventContainer = document.createElement('div');
        this.spawnEventContainer.id = 'rpg-editor-spawn-event-controls';
        this.spawnEventContainer.style.marginTop = '10px';
        this.spawnEventContainer.style.display = 'none';

        this.spawnEventSelect = document.createElement('select');
        makeFormRow('Linked Event', this.spawnEventSelect, this.spawnEventContainer);

        this.spawnEventModeSelect = document.createElement('select');
        const optUnlock = document.createElement('option');
        optUnlock.value = 'unlock_remove';
        optUnlock.textContent = '🚪 Lock Obstacle (Requires Item)';
        const optGive = document.createElement('option');
        optGive.value = 'give_item';
        optGive.textContent = '📦 Interact Loot (Gives Item)';
        this.spawnEventModeSelect.appendChild(optUnlock);
        this.spawnEventModeSelect.appendChild(optGive);
        this.spawnEventModeRow = makeFormRow('Trigger Type', this.spawnEventModeSelect, this.spawnEventContainer);

        this.spawnEventMessageInput = document.createElement('input');
        this.spawnEventMessageInput.type = 'text';
        this.spawnEventMessageInput.placeholder = 'Dialogue prompt...';
        this.spawnEventMessageRow = makeFormRow('Dialogue Message', this.spawnEventMessageInput, this.spawnEventContainer);

        this.spawnEventEmojiSelect = document.createElement('select');
        const eventSymbols = ['🚪', '📦', '🔑', '⚡', '🟢', '💎', '🎟️', '📜', '💀', '🔮', '🛡️', '⚔️', '⭐', 'None'];
        eventSymbols.forEach(sym => {
            const opt = document.createElement('option');
            opt.value = sym === 'None' ? '' : sym;
            opt.textContent = sym;
            this.spawnEventEmojiSelect.appendChild(opt);
        });
        this.spawnEventEmojiRow = makeFormRow('Visual Icon', this.spawnEventEmojiSelect, this.spawnEventContainer);

        this.spawnTypeContainer.appendChild(this.spawnEventContainer);

        // --- Spawner Settings (Collapsible) ---
        this.spawnSettingsContainer = document.createElement('div');
        this.spawnSettingsContainer.id = 'rpg-editor-spawn-settings-controls';
        this.spawnSettingsContainer.style.marginTop = '10px';
        this.spawnSettingsContainer.style.border = '1px solid #8C6D56';
        this.spawnSettingsContainer.style.padding = '8px';
        this.spawnSettingsContainer.style.borderRadius = '4px';
        this.spawnSettingsContainer.style.backgroundColor = '#2c1e16';
        this.spawnSettingsContainer.style.display = 'none';

        const settingsHeader = document.createElement('div');
        settingsHeader.style.fontWeight = 'bold';
        settingsHeader.style.fontSize = '12px';
        settingsHeader.style.color = '#e67e22';
        settingsHeader.style.cursor = 'pointer';
        settingsHeader.style.display = 'flex';
        settingsHeader.style.justifyContent = 'space-between';
        settingsHeader.style.alignItems = 'center';
        settingsHeader.style.padding = '2px 0';
        settingsHeader.innerHTML = '<span>⚙️ Procedural Spawner Settings</span> <span id="rpg-spawn-settings-arrow">▼</span>';
        
        const settingsBody = document.createElement('div');
        settingsBody.id = 'rpg-spawn-settings-body';
        settingsBody.style.display = 'flex';
        settingsBody.style.flexDirection = 'column';
        settingsBody.style.gap = '8px';
        settingsBody.style.marginTop = '8px';

        settingsHeader.onclick = () => {
            if (settingsBody.style.display === 'none') {
                settingsBody.style.display = 'flex';
                document.getElementById('rpg-spawn-settings-arrow').textContent = '▼';
            } else {
                settingsBody.style.display = 'none';
                document.getElementById('rpg-spawn-settings-arrow').textContent = '►';
            }
        };

        // Respawner enabled
        this.spawnRespawnCheckbox = document.createElement('input');
        this.spawnRespawnCheckbox.type = 'checkbox';
        this.spawnRespawnCheckbox.id = 'rpg-editor-spawn-respawn-check';
        makeFormRow('Procedural Spawn', this.spawnRespawnCheckbox, settingsBody);

        // Respawn delay (seconds)
        this.spawnRespawnDelayInput = document.createElement('input');
        this.spawnRespawnDelayInput.type = 'number';
        this.spawnRespawnDelayInput.id = 'rpg-editor-spawn-respawn-delay';
        this.spawnRespawnDelayInput.value = '10';
        this.spawnRespawnDelayInput.min = '1';
        makeFormRow('Respawn Delay (s)', this.spawnRespawnDelayInput, settingsBody);

        // Max concurrent spawns
        this.spawnLimitInput = document.createElement('input');
        this.spawnLimitInput.type = 'number';
        this.spawnLimitInput.id = 'rpg-editor-spawn-limit';
        this.spawnLimitInput.value = '1';
        this.spawnLimitInput.min = '1';
        makeFormRow('Max Active Limit', this.spawnLimitInput, settingsBody);

        this.spawnSettingsContainer.appendChild(settingsHeader);
        this.spawnSettingsContainer.appendChild(settingsBody);
        this.spawnTypeContainer.appendChild(this.spawnSettingsContainer);

        this.toolsContent.appendChild(this.spawnTypeContainer);


        // --- Info Text ---
        this.layerInfoTextElement = document.createElement('p');
        this.layerInfoTextElement.className = 'rpg-editor-info';
        this.toolsContent.appendChild(this.layerInfoTextElement);

        this.modalContentElement.appendChild(this.toolsPanel);
        this.updateToolPanelVisibility(); 
    }
    
    setupStyles() {
        // Style buttons within panels
        this.operationsPanel.querySelectorAll('button:not(#rpg-editor-operations-toggle)').forEach(button => {
            button.style.width = '100%'; button.style.padding = '8px'; button.style.marginBottom = '5px';
            button.style.backgroundColor = '#8C6D56'; button.style.color = 'white';
            button.style.border = '1px solid #5A4B3E'; button.style.borderRadius = '4px';
            button.style.cursor = 'pointer';
        });
         this.toolsPanel.querySelectorAll('button').forEach(button => {
            if (button.parentElement.className === 'rpg-editor-layer-nav') {
                 button.style.padding = '5px 8px'; button.style.margin = '0 5px';
            } else {
                 button.style.width = '100%'; button.style.padding = '8px'; button.style.marginBottom = '5px';
            }
            button.style.backgroundColor = '#8C6D56'; button.style.color = 'white';
            button.style.border = '1px solid #5A4B3E'; button.style.borderRadius = '4px';
            button.style.cursor = 'pointer';
        });

        // Style for tool selection buttons
        const toolButtons = this.toolsPanel.querySelectorAll('.rpg-editor-tool-selection button');
        toolButtons.forEach(button => {
            button.style.padding = '5px';
            button.style.margin = '0 2px';
            button.minWidth = '30px'; 
             button.style.width = 'auto'; 
        });
    }

    toggleOperationsPanel() {
        if (this.operationsPanelContent && this.operationsPanel) {
            const isCollapsed = this.operationsPanel.classList.toggle('collapsed');
            this.operationsPanelContent.style.display = isCollapsed ? 'none' : 'block';
        }
    }

    showPanels() {
        if (this.toolsPanel) this.toolsPanel.style.display = 'flex';
        if (this.operationsPanel) this.operationsPanel.style.display = 'flex';
    }

    hidePanels() {
        if (this.toolsPanel) this.toolsPanel.style.display = 'none';
        if (this.operationsPanel) this.operationsPanel.style.display = 'none';
    }

    updateLayerInfoText(text) {
        if (this.layerInfoTextElement) {
            this.layerInfoTextElement.textContent = text;
        }
    }

    updateToolPanelVisibility() {
        if (!this.toolsPanel || !this.spritesheetContainerElement || !this.previewContainerElement || !this.objectPaletteContainer || !this.collidableCheckbox || !this.snapToGridLabel || !this.pencilToolButton || !this.eraserToolButton) {
             console.warn("Editor UI elements not fully initialized for visibility update."); 
             return; 
        }
        const collidableLabel = this.collidableCheckbox.parentElement; 

        const currentLayer = this.editor.currentLayer;
        const isTileSelectionLayer = (currentLayer === 'tile' || currentLayer === 'object1');
        const isObjectLayer = (currentLayer === 'object1' || currentLayer === 'object2');
        const isShapeLayer = (currentLayer === 'collision' || currentLayer === 'occlusion');
        const isSpawnLayer = (currentLayer === 'spawn');
        
        // --- Manage visibility based on layer ---
        const isSelecting = (this.editor.currentTool === 'select' || this.editor.currentTool === 'deselect');
        
        // Spritesheet (for tile and object1)
        this.spritesheetContainerElement.style.display = (isTileSelectionLayer && !isSelecting) ? 'block' : 'none';
        this.spritesheetControlsContainer.style.display = (isTileSelectionLayer && !isSelecting) ? 'flex' : 'none';
        this.spritesheetNameDisplay.style.display = (isTileSelectionLayer && !isSelecting) ? 'block' : 'none';

        // Preview (for everything EXCEPT tile/object1 layers)
        this.previewContainerElement.style.display = (!isTileSelectionLayer && !isSelecting) ? 'block' : 'none';

        // Object Palette (for object2)
        this.objectPaletteWrapper.style.display = (currentLayer === 'object2' && !isSelecting) ? 'block' : 'none';

        // Bulk Selection Panel (only when selecting)
        if (this.bulkSelectionPanel) {
            this.bulkSelectionPanel.style.display = isSelecting ? 'block' : 'none';
        }

        // Collidable Checkbox (for all object layers)
        if(collidableLabel) collidableLabel.style.display = (isObjectLayer && !isSelecting) ? 'flex' : 'none';

        // Disable Y-Sorting and Z-Index controls visibility
        if (this.disableYSortLabel) this.disableYSortLabel.style.display = (isObjectLayer && !isSelecting) ? 'flex' : 'none';
        if (this.zIndexContainer) this.zIndexContainer.style.display = (isObjectLayer && !isSelecting) ? 'flex' : 'none';
        if (this.tileZIndexContainer) this.tileZIndexContainer.style.display = (currentLayer === 'tile' && !isSelecting) ? 'flex' : 'none';

        // Snap to Grid (for objects, shapes, spawns)
        this.snapToGridLabel.style.display = ((isObjectLayer || isShapeLayer || isSpawnLayer) && !isSelecting) ? 'flex' : 'none';

        // Spawn Controls (for spawn layer)
        this.spawnTypeContainer.style.display = (isSpawnLayer && !isSelecting) ? 'block' : 'none';

        // --- Update state of visible controls ---
        if (currentLayer === 'tile') {
            if (this.editor.selectedTileBrush) {
                if (this.tileZIndexInput) {
                    this.tileZIndexInput.value = this.editor.selectedTileBrush.zIndex !== undefined ? this.editor.selectedTileBrush.zIndex : 0;
                }
            } else {
                if (this.tileZIndexInput) this.tileZIndexInput.value = 0;
            }
        }

        if (isObjectLayer) {
            if (this.editor.selectedObjectBrush) {
                if (collidableLabel && collidableLabel.style.display !== 'none') {
                    this.collidableCheckbox.checked = this.editor.selectedObjectBrush.collidable !== undefined ? this.editor.selectedObjectBrush.collidable : true;
                }
                if (this.disableYSortCheckbox) {
                    this.disableYSortCheckbox.checked = this.editor.selectedObjectBrush.disableYSorting !== undefined ? this.editor.selectedObjectBrush.disableYSorting : false;
                }
                if (this.objectZIndexInput) {
                    this.objectZIndexInput.value = this.editor.selectedObjectBrush.zIndex !== undefined ? this.editor.selectedObjectBrush.zIndex : 0;
                }
            } else {
                this.collidableCheckbox.checked = true;
                if (this.disableYSortCheckbox) this.disableYSortCheckbox.checked = false;
                if (this.objectZIndexInput) this.objectZIndexInput.value = 0;
            }
        }
        if (this.snapToGridLabel.style.display !== 'none') {
            this.snapToGridCheckbox.checked = this.editor.snapToGrid;
        }
        if (isSpawnLayer) {
            const selectedSpawnType = this.getSelectedSpawnType();
            if (this.spawnTargetMapInput && this.spawnTargetMapInput.parentElement) {
                 this.spawnTargetMapInput.parentElement.style.display = (selectedSpawnType === SPAWN_TYPES.PLAYER_EXIT) ? 'block' : 'none';
            }
            if (this.spawnPermanentNpcContainer) {
                this.spawnPermanentNpcContainer.style.display = (selectedSpawnType === SPAWN_TYPES.NPC_PERMANENT) ? 'block' : 'none';
            }
            if (this.spawnEnemyContainer) {
                this.spawnEnemyContainer.style.display = (selectedSpawnType === SPAWN_TYPES.ENEMY) ? 'block' : 'none';
            }
            if (this.spawnSettingsContainer) {
                this.spawnSettingsContainer.style.display = (selectedSpawnType === SPAWN_TYPES.ENEMY) ? 'block' : 'none';
            }
            if (this.spawnEventContainer) {
                const showsEvent = (selectedSpawnType === SPAWN_TYPES.EVENT || selectedSpawnType === SPAWN_TYPES.ENEMY || selectedSpawnType === SPAWN_TYPES.PLAYER_EXIT);
                this.spawnEventContainer.style.display = showsEvent ? 'block' : 'none';
                if (showsEvent) {
                    this.populateEventSelect();
                }
                const isExit = (selectedSpawnType === SPAWN_TYPES.PLAYER_EXIT);
                if (this.spawnEventModeRow) this.spawnEventModeRow.style.display = isExit ? 'none' : 'block';
                if (this.spawnEventMessageRow) this.spawnEventMessageRow.style.display = isExit ? 'none' : 'block';
                if (this.spawnEventEmojiRow) this.spawnEventEmojiRow.style.display = isExit ? 'none' : 'block';
            }
        }

        this.editor.updateBrushVisuals();
        this.updateToolButtonsState(); 
    }

    // --- UI for Save/Load Operations ---
    promptForMapName(currentName = '') {
        return CustomDialog.prompt("Enter a name for this map:", currentName || `MyMap_${Date.now()}`, "Save Map");
    }

    displayLoadableMaps(maps, loadCallback, deleteCallback) {
        if (this.loadMapsListContainer) {
            this.loadMapsListContainer.remove(); 
        }
        if (!this.operationsPanelContent) {
            console.error("Operations panel content not found for displaying maps.");
            return;
        }

        this.loadMapsListContainer = document.createElement('div');
        this.loadMapsListContainer.id = 'rpg-editor-load-maps-list';
        this.loadMapsListContainer.style.border = '1px solid #8C6D56';
        this.loadMapsListContainer.style.marginTop = '10px';
        this.loadMapsListContainer.style.padding = '5px';
        this.loadMapsListContainer.style.maxHeight = '150px';
        this.loadMapsListContainer.style.overflowY = 'auto';
        this.loadMapsListContainer.style.backgroundColor = '#4a3c30'; // Added for consistency


        if (maps.length === 0) {
            const noMapsText = document.createElement('p');
            noMapsText.textContent = 'No saved maps found.';
            noMapsText.style.textAlign = 'center';
            this.loadMapsListContainer.appendChild(noMapsText);
        } else {
            maps.forEach(mapInfo => {
                const mapItemContainer = document.createElement('div');
                mapItemContainer.className = 'rpg-editor-load-map-item';

                const mapButton = document.createElement('button');
                const fileSizeKB = (mapInfo.size / 1024).toFixed(2);
                const fileSizeMB = (mapInfo.size / (1024 * 1024)).toFixed(2);
                const displaySize = fileSizeKB > 1000 ? `${fileSizeMB} MB` : `${fileSizeKB} KB`;
                mapButton.innerHTML = `${mapInfo.name} <span class="map-file-size">(${displaySize})</span>`;
                mapButton.onclick = () => {
                    loadCallback(mapInfo.name);
                    if (this.loadMapsListContainer) this.loadMapsListContainer.remove(); 
                };
                
                const deleteButton = document.createElement('button');
                deleteButton.className = 'rpg-editor-delete-map-button';
                deleteButton.textContent = '✖';
                deleteButton.title = `Delete map '${mapInfo.name}'`;
                deleteButton.onclick = async (e) => {
                    e.stopPropagation();
                    const confirmed = await CustomDialog.confirm(`Are you sure you want to delete the map "${mapInfo.name}"? This cannot be undone.`, "Delete Map");
                    if (confirmed) {
                        deleteCallback(mapInfo.name);
                    }
                };

                mapItemContainer.appendChild(mapButton);
                mapItemContainer.appendChild(deleteButton);
                this.loadMapsListContainer.appendChild(mapItemContainer);
            });
        }
        const loadLocalButton = Array.from(this.operationsPanelContent.querySelectorAll('button')).find(b => b.textContent === 'Load Local');
        if (loadLocalButton && loadLocalButton.nextSibling) {
            this.operationsPanelContent.insertBefore(this.loadMapsListContainer, loadLocalButton.nextSibling);
        } else {
            this.operationsPanelContent.appendChild(this.loadMapsListContainer);
        }
    }

    updateSpritesheetName(name) {
        if (this.spritesheetNameDisplay) {
            this.spritesheetNameDisplay.textContent = name;
        }
    }

    updateNpcBrushInfo(npcName) {
        if (this.spawnNpcBrushInfo) {
            if (npcName) {
                this.spawnNpcBrushInfo.textContent = `Ready to place: ${npcName}`;
            } else {
                this.spawnNpcBrushInfo.textContent = 'No NPC loaded.';
            }
        }
    }

    _setToolIcons() {
        if (this.pencilToolButton) {
            const pencilImg = this.editor.engine.assets.pencil_icon;
            if (pencilImg && pencilImg.complete){
                const imgClone = pencilImg.cloneNode();
                imgClone.alt = 'Place';
                imgClone.style.width = '16px';
                imgClone.style.height = '16px';
                this.pencilToolButton.innerHTML = ''; 
                this.pencilToolButton.appendChild(imgClone);
            } else {
                this.pencilToolButton.textContent = 'P'; // Fallback
            }
        }
        if (this.eraserToolButton) {
            const eraserImg = this.editor.engine.assets.eraser_icon;
             if (eraserImg && eraserImg.complete){
                const imgClone = eraserImg.cloneNode();
                imgClone.alt = 'Erase';
                imgClone.style.width = '16px';
                imgClone.style.height = '16px';
                this.eraserToolButton.innerHTML = ''; 
                this.eraserToolButton.appendChild(imgClone);
            } else {
                this.eraserToolButton.textContent = 'E'; // Fallback
            }
        }
    }

    // --- Getter methods for spawn layer controls ---
    getSelectedSpawnType() {
        return this.spawnTypeSelect ? this.spawnTypeSelect.value : SPAWN_TYPES.DEFAULT;
    }

    getTargetMapValue() {
        return this.spawnTargetMapInput ? this.spawnTargetMapInput.value.trim() : null;
    }

    getSelectedEnemyType() {
        return this.spawnEnemySelect ? this.spawnEnemySelect.value : null;
    }

    populateEnemySelector(enemyTypes) {
        if (!this.spawnEnemySelect) return;
        this.spawnEnemySelect.innerHTML = '';
        if (!enemyTypes || Object.keys(enemyTypes).length === 0) {
            const option = document.createElement('option');
            option.textContent = 'No enemies defined';
            option.disabled = true;
            this.spawnEnemySelect.appendChild(option);
            return;
        }

        for (const enemyId in enemyTypes) {
            const option = document.createElement('option');
            option.value = enemyId;
            option.textContent = enemyTypes[enemyId].name || enemyId;
            this.spawnEnemySelect.appendChild(option);
        }
    }

    populateEventSelect() {
        if (!this.spawnEventSelect) return;
        this.spawnEventSelect.innerHTML = '';
        const events = getAllCustomEvents();
        const keys = Object.keys(events);
        if (keys.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = '-- Create Event first! --';
            this.spawnEventSelect.appendChild(opt);
            return;
        }
        keys.forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = `${events[k].emoji || '🔑'} ${events[k].name}`;
            this.spawnEventSelect.appendChild(opt);
        });
    }

    getSelectedEventParams() {
        return {
            eventId: this.spawnEventSelect ? this.spawnEventSelect.value : '',
            triggerType: this.spawnEventModeSelect ? this.spawnEventModeSelect.value : 'unlock_remove',
            message: this.spawnEventMessageInput ? this.spawnEventMessageInput.value : '',
            emoji: this.spawnEventEmojiSelect ? this.spawnEventEmojiSelect.value : ''
        };
    }

    getSpawnerSettings() {
        return {
            procedural: this.spawnRespawnCheckbox ? this.spawnRespawnCheckbox.checked : false,
            interval: this.spawnRespawnDelayInput ? parseFloat(this.spawnRespawnDelayInput.value) || 10 : 10,
            limit: this.spawnLimitInput ? parseInt(this.spawnLimitInput.value) || 1 : 1
        };
    }

    renderPlayerUI() {
        if (!this.player) return;
        const ctx = this.player.ctx;
        const spawnInfo = this.editor.currentTool === 'place' ? this.editor.selectedObjectBrush : null;
        if (spawnInfo) {
            ctx.font = '16px Arial';
            ctx.fillText(spawnInfo, 10, 120);
        }
    }

    _createSpriteConfiguratorPanel() {
        this.spriteConfigPanel = document.createElement('div');
        this.spriteConfigPanel.id = 'rpg-sprite-configurator-panel';
        this.spriteConfigPanel.style.display = 'none'; // Toggle on clicking button
        this.spriteConfigPanel.style.maxHeight = 'calc(100% - 70px)';
        this.spriteConfigPanel.style.overflowY = 'auto';

        const bar = document.createElement('div');
        bar.style.display = 'flex';
        bar.style.justifyContent = 'space-between';
        bar.style.alignItems = 'center';
        bar.style.padding = '8px 12px';
        bar.style.backgroundColor = '#4a3c30';
        bar.style.borderBottom = '1px solid #8C6D56';

        const title = document.createElement('span');
        title.textContent = '🖼️ Sprite Creator & Pixelizer';
        title.style.fontWeight = 'bold';
        title.style.fontSize = '12px';
        title.style.color = '#EFEBE0';
        bar.appendChild(title);

        const closeBtn = document.createElement('span');
        closeBtn.innerHTML = '✖';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.color = '#EFEBE0';
        closeBtn.style.fontWeight = 'bold';
        closeBtn.style.fontSize = '12px';
        closeBtn.onclick = () => { this.spriteConfigPanel.style.display = 'none'; };
        bar.appendChild(closeBtn);

        this.spriteConfigPanel.appendChild(bar);

        const content = document.createElement('div');
        content.style.padding = '12px';
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.gap = '10px';
        content.style.boxSizing = 'border-box';
        content.style.width = '100%';

        // 1. File Upload input
        const fileRow = document.createElement('div');
        fileRow.style.display = 'flex';
        fileRow.style.flexDirection = 'column';
        fileRow.style.gap = '4px';

        const label = document.createElement('span');
        label.textContent = 'Upload Source Image:';
        label.style.fontSize = '11px';
        label.style.fontWeight = 'bold';
        label.style.color = '#d4c8a0';
        fileRow.appendChild(label);

        const spriteUploadId = 'rpg-sprite-file-upload-input';
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = spriteUploadId;
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        fileRow.appendChild(fileInput);

        const uploadBtn = document.createElement('label');
        uploadBtn.htmlFor = spriteUploadId;
        uploadBtn.className = 'rpg-file-label';
        uploadBtn.style.display = 'block';
        uploadBtn.style.width = '100%';
        uploadBtn.style.padding = '6px';
        uploadBtn.style.fontSize = '12px';
        uploadBtn.textContent = '📁 Choose Source Image';
        fileRow.appendChild(uploadBtn);

        content.appendChild(fileRow);

        // 2. Custom Sizes Row
        const sizeRow = document.createElement('div');
        sizeRow.style.display = 'flex';
        sizeRow.style.gap = '12px';
        sizeRow.style.width = '100%';
        sizeRow.style.boxSizing = 'border-box';

        const wCol = document.createElement('div');
        wCol.style.flex = '1';
        wCol.style.display = 'flex';
        wCol.style.flexDirection = 'column';
        wCol.style.gap = '4px';
        const wLabel = document.createElement('span');
        wLabel.textContent = 'Width (px):';
        wLabel.style.fontSize = '11px';
        wLabel.style.fontWeight = 'bold';
        wLabel.style.color = '#d4c8a0';
        wCol.appendChild(wLabel);
        const wInput = document.createElement('input');
        wInput.type = 'number';
        wInput.value = '64';
        wCol.appendChild(wInput);
        sizeRow.appendChild(wCol);

        const hCol = document.createElement('div');
        hCol.style.flex = '1';
        hCol.style.display = 'flex';
        hCol.style.flexDirection = 'column';
        hCol.style.gap = '4px';
        const hLabel = document.createElement('span');
        hLabel.textContent = 'Height (px):';
        hLabel.style.fontSize = '11px';
        hLabel.style.fontWeight = 'bold';
        hLabel.style.color = '#d4c8a0';
        hCol.appendChild(hLabel);
        const hInput = document.createElement('input');
        hInput.type = 'number';
        hInput.value = '64';
        hCol.appendChild(hInput);
        sizeRow.appendChild(hCol);

        content.appendChild(sizeRow);

        // 3. Pixelization Select Dropdown
        const pixRow = document.createElement('div');
        pixRow.style.display = 'flex';
        pixRow.style.flexDirection = 'column';
        pixRow.style.gap = '4px';
        pixRow.style.width = '100%';
        pixRow.style.boxSizing = 'border-box';

        const pixLabel = document.createElement('span');
        pixLabel.textContent = 'Pixelize Pattern Level:';
        pixLabel.style.fontSize = '11px';
        pixLabel.style.fontWeight = 'bold';
        pixLabel.style.color = '#d4c8a0';
        pixRow.appendChild(pixLabel);

        const pixSelect = document.createElement('select');
        
        const optNone = document.createElement('option');
        optNone.value = '0'; optNone.textContent = 'Pure Source (None)';
        pixSelect.appendChild(optNone);

        const optLow = document.createElement('option');
        optLow.value = '0.35'; optLow.textContent = 'Low Retro (35% scale)';
        pixSelect.appendChild(optLow);

        const optMed = document.createElement('option');
        optMed.value = '0.2'; optMed.textContent = 'Chunky 16-Bit (20% scale)';
        pixSelect.appendChild(optMed);

        const optHigh = document.createElement('option');
        optHigh.value = '0.1'; optHigh.textContent = 'Classic 8-Bit (10% scale)';
        pixSelect.appendChild(optHigh);

        pixRow.appendChild(pixSelect);
        content.appendChild(pixRow);

        // 4. Anchor adjustments
        const anchorRow = document.createElement('div');
        anchorRow.style.display = 'flex';
        anchorRow.style.gap = '12px';
        anchorRow.style.width = '100%';
        anchorRow.style.boxSizing = 'border-box';

        const axCol = document.createElement('div');
        axCol.style.flex = '1';
        axCol.style.display = 'flex';
        axCol.style.flexDirection = 'column';
        axCol.style.gap = '4px';
        const axLabel = document.createElement('span');
        axLabel.textContent = 'Anchor X Offset %:';
        axLabel.style.fontSize = '11px';
        axLabel.style.fontWeight = 'bold';
        axLabel.style.color = '#d4c8a0';
        axCol.appendChild(axLabel);
        const axInput = document.createElement('input');
        axInput.type = 'number';
        axInput.value = '50';
        axCol.appendChild(axInput);
        anchorRow.appendChild(axCol);

        const ayCol = document.createElement('div');
        ayCol.style.flex = '1';
        ayCol.style.display = 'flex';
        ayCol.style.flexDirection = 'column';
        ayCol.style.gap = '4px';
        const ayLabel = document.createElement('span');
        ayLabel.textContent = 'Anchor Y Offset %:';
        ayLabel.style.fontSize = '11px';
        ayLabel.style.fontWeight = 'bold';
        ayLabel.style.color = '#d4c8a0';
        ayCol.appendChild(ayLabel);
        const ayInput = document.createElement('input');
        ayInput.type = 'number';
        ayInput.value = '90';
        ayCol.appendChild(ayInput);
        anchorRow.appendChild(ayCol);

        content.appendChild(anchorRow);

        // 5. Preview Display
        const prevLabel = document.createElement('span');
        prevLabel.textContent = 'Result Preview:';
        prevLabel.style.fontSize = '11px';
        prevLabel.style.fontWeight = 'bold';
        prevLabel.style.color = '#d4c8a0';
        content.appendChild(prevLabel);

        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = 120;
        previewCanvas.height = 120;
        previewCanvas.style.border = '1px solid #8C6D56';
        previewCanvas.style.backgroundColor = '#251E1A';
        previewCanvas.style.padding = '4px';
        previewCanvas.style.borderRadius = '4px';
        previewCanvas.style.alignSelf = 'center';
        previewCanvas.style.cursor = 'crosshair';
        previewCanvas.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.5)';
        content.appendChild(previewCanvas);

        let imgSource = null;
        let currentDrawW = 0;
        let currentDrawH = 0;

        const renderPixelated = () => {
            const ctx = previewCanvas.getContext('2d');
            ctx.clearRect(0, 0, 120, 120);
            if (!imgSource) {
                ctx.fillStyle = '#8C6D56';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('No image selected', 60, 60);
                return;
            }

            const targetW = Number(wInput.value) || 64;
            const targetH = Number(hInput.value) || 64;
            const factor = Number(pixSelect.value);

            ctx.imageSmoothingEnabled = false;

            // Fit targetW and targetH proportionally inside 110x110 preview bounds
            currentDrawW = targetW;
            currentDrawH = targetH;
            const maxBound = 110;
            if (currentDrawW > maxBound || currentDrawH > maxBound) {
                const scale = Math.min(maxBound / currentDrawW, maxBound / currentDrawH);
                currentDrawW = currentDrawW * scale;
                currentDrawH = currentDrawH * scale;
            }

            if (factor > 0) {
                // Pixelated scaling pipeline
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = Math.max(1, Math.round(targetW * factor));
                tempCanvas.height = Math.max(1, Math.round(targetH * factor));
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.imageSmoothingEnabled = false;
                tempCtx.drawImage(imgSource, 0, 0, tempCanvas.width, tempCanvas.height);

                ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 60 - currentDrawW/2, 60 - currentDrawH/2, currentDrawW, currentDrawH);
            } else {
                ctx.drawImage(imgSource, 60 - currentDrawW/2, 60 - currentDrawH/2, currentDrawW, currentDrawH);
            }

            // Draw a stylish glowy target/crosshair representing the selected anchor offset
            const pctX = Number(axInput.value) || 50;
            const pctY = Number(ayInput.value) || 90;
            const xStart = 60 - currentDrawW / 2;
            const yStart = 60 - currentDrawH / 2;
            const anchorX = xStart + (pctX / 100) * currentDrawW;
            const anchorY = yStart + (pctY / 100) * currentDrawH;

            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 4;

            // Glow ring
            ctx.strokeStyle = '#00f6ff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(anchorX, anchorY, 6, 0, Math.PI * 2);
            ctx.stroke();

            // Core center dot
            ctx.fillStyle = '#ff3838';
            ctx.beginPath();
            ctx.arc(anchorX, anchorY, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Hair lines
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(anchorX - 10, anchorY);
            ctx.lineTo(anchorX - 3, anchorY);
            ctx.moveTo(anchorX + 3, anchorY);
            ctx.lineTo(anchorX + 10, anchorY);
            ctx.moveTo(anchorX, anchorY - 10);
            ctx.lineTo(anchorX, anchorY - 3);
            ctx.moveTo(anchorX, anchorY + 3);
            ctx.lineTo(anchorX, anchorY + 10);
            ctx.stroke();

            ctx.restore();
        };

        // Add interactive anchor picking by clicking on preview canvas
        previewCanvas.onmousedown = (e) => {
            if (!imgSource) return;
            const rect = previewCanvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            const xStart = 60 - currentDrawW / 2;
            const yStart = 60 - currentDrawH / 2;

            if (clickX >= xStart && clickX <= xStart + currentDrawW &&
                clickY >= yStart && clickY <= yStart + currentDrawH) {
                const pctX = ((clickX - xStart) / currentDrawW) * 100;
                const pctY = ((clickY - yStart) / currentDrawH) * 100;

                axInput.value = Math.max(0, Math.min(100, Math.round(pctX)));
                ayInput.value = Math.max(0, Math.min(100, Math.round(pctY)));

                renderPixelated();
            }
        };

        this.resetSpriteCreator = () => {
            imgSource = null;
            fileInput.value = '';
            uploadBtn.textContent = '📁 Choose Source Image';
            wInput.value = '64';
            hInput.value = '64';
            pixSelect.value = '0';
            axInput.value = '50';
            ayInput.value = '90';
            renderPixelated();
        };

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) {
                uploadBtn.textContent = '📁 Choose Source Image';
                return;
            }
            uploadBtn.textContent = '📁 ' + file.name;
            const r = new FileReader();
            r.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    imgSource = img;
                    wInput.value = img.width;
                    hInput.value = img.height;
                    renderPixelated();
                };
                img.src = event.target.result;
            };
            r.readAsDataURL(file);
        };

        wInput.oninput = renderPixelated;
        hInput.oninput = renderPixelated;
        axInput.oninput = renderPixelated;
        ayInput.oninput = renderPixelated;
        pixSelect.onchange = renderPixelated;

        const actionBtn = document.createElement('button');
        actionBtn.textContent = '💾 Push to Object2 Palette';
        actionBtn.style.padding = '8px 12px';
        actionBtn.style.backgroundColor = '#8C6D56';
        actionBtn.style.color = '#fff';
        actionBtn.style.border = '1px solid #5A4B3E';
        actionBtn.style.cursor = 'pointer';
        actionBtn.style.borderRadius = '4px';
        actionBtn.style.fontWeight = 'bold';
        actionBtn.style.boxSizing = 'border-box';
        actionBtn.style.width = '100%';
        actionBtn.style.marginTop = '6px';
        actionBtn.onmouseover = () => { actionBtn.style.backgroundColor = '#A07D65'; };
        actionBtn.onmouseout = () => { actionBtn.style.backgroundColor = '#8C6D56'; };
        actionBtn.onclick = () => {
            if (!imgSource) {
                CustomDialog.alert("Please upload a source image first.", "Validation Failed");
                return;
            }

            // Create offscreen baked canvas
            const targetW = Number(wInput.value) || 64;
            const targetH = Number(hInput.value) || 64;
            const factor = Number(pixSelect.value);

            const outCanvas = document.createElement('canvas');
            outCanvas.width = targetW;
            outCanvas.height = targetH;
            const outCtx = outCanvas.getContext('2d');
            outCtx.imageSmoothingEnabled = false;

            if (factor > 0) {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = Math.max(1, Math.round(targetW * factor));
                tempCanvas.height = Math.max(1, Math.round(targetH * factor));
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.imageSmoothingEnabled = false;
                tempCtx.drawImage(imgSource, 0, 0, tempCanvas.width, tempCanvas.height);
                outCtx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, targetW, targetH);
            } else {
                outCtx.drawImage(imgSource, 0, 0, targetW, targetH);
            }

            const customDataUrl = outCanvas.toDataURL('image/png');
            const customLoadedImage = new Image();
            customLoadedImage.onload = () => {
                // Register in spritesheets
                const customSpritesheetName = `pixel_sprite_${Date.now()}`;
                this.editor.spritesheets.push({
                    name: customSpritesheetName,
                    image: customLoadedImage,
                    isCustom: true,
                    dataUrl: customDataUrl
                });
                this.editor.updateMapSpritesheets();

                const axOffset = (targetW * Number(axInput.value)) / 100;
                const ayOffset = (targetH * Number(ayInput.value)) / 100;

                const customKey = `custom_sprite_obj_${Date.now()}`;
                const newObjDef = {
                    type: customSpritesheetName,
                    displayName: `Pixelated Sprite #${Math.round(Math.random()*1000)}`,
                    assetName: customSpritesheetName,
                    spritesheetIndex: this.editor.spritesheets.length - 1,
                    visualWidth: targetW,
                    visualHeight: targetH,
                    anchorOffsetX: axOffset,
                    anchorOffsetY: ayOffset,
                    collidable: true
                };

                // Add to standard definitions so it shows up in EditorUIManager
                this.editor.map.customPaletteDefinitions = this.editor.map.customPaletteDefinitions || {};
                this.editor.map.customPaletteDefinitions[customKey] = newObjDef;

                // Close panel, clear uploader, refresh palette
                this.spriteConfigPanel.style.display = 'none';
                imgSource = null;
                fileInput.value = '';
                uploadBtn.textContent = '📁 Choose Source Image';
                this.refreshObjectPalette();

                CustomDialog.alert("Pixelated Sprite generated and added successfully to Palette!", "Asset Saved");
            };
            customLoadedImage.src = customDataUrl;
        };

        content.appendChild(actionBtn);
        this.spriteConfigPanel.appendChild(content);

        this.modalContentElement.appendChild(this.spriteConfigPanel);
    }

    _createBulkSelectionPanel() {
        this.bulkSelectionPanel = document.createElement('div');
        this.bulkSelectionPanel.id = 'rpg-editor-bulk-selection-panel';
        this.bulkSelectionPanel.className = 'abilities-editor-section'; // Unified with ability creator section style
        this.bulkSelectionPanel.style.display = 'none'; // Only visible while using select tool
        this.toolsContent.appendChild(this.bulkSelectionPanel);

        const header = document.createElement('h4');
        header.textContent = '🔍 Stacked Selection';
        this.bulkSelectionPanel.appendChild(header);

        const desc = document.createElement('p');
        desc.textContent = 'Drag on map or click elements to select/deselect them. Baked selections form multi-layered modular Object2 prefabricated placements.';
        desc.style.fontSize = '11px';
        desc.style.color = '#BDC3C7';
        desc.style.lineHeight = '1.3';
        desc.style.margin = '4px 0 10px 0';
        this.bulkSelectionPanel.appendChild(desc);

        // Buttons row
        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.gap = '8px';
        btnRow.style.marginBottom = '12px';

        const bakeBtn = document.createElement('button');
        bakeBtn.textContent = '📦 Bake Prefab';
        bakeBtn.className = 'abilities-btn';
        bakeBtn.style.flex = '1';
        bakeBtn.onclick = () => this.editor.bakeSelectionToPrefab();
        btnRow.appendChild(bakeBtn);

        const clearBtn = document.createElement('button');
        clearBtn.textContent = '✕ Clear';
        clearBtn.className = 'abilities-btn-danger';
        clearBtn.onclick = () => this.editor.clearSelection();
        btnRow.appendChild(clearBtn);

        this.bulkSelectionPanel.appendChild(btnRow);

        this.selectionListContainer = document.createElement('div');
        this.selectionListContainer.id = 'rpg-selection-list-container';
        this.selectionListContainer.style.backgroundColor = '#1C1612';
        this.selectionListContainer.style.border = '1px solid #5A4B3E';
        this.selectionListContainer.style.borderRadius = '4px';
        this.selectionListContainer.style.padding = '6px';
        this.selectionListContainer.style.maxHeight = '200px';
        this.selectionListContainer.style.overflowY = 'auto';
        this.selectionListContainer.style.display = 'flex';
        this.selectionListContainer.style.flexDirection = 'column';
        this.selectionListContainer.style.gap = '4px';
        this.bulkSelectionPanel.appendChild(this.selectionListContainer);

        this.updateSelectionListUI([]);
    }

    updateSelectionListUI(selectedElements) {
        if (!this.selectionListContainer) return;
        this.selectionListContainer.innerHTML = '';

        if (!selectedElements || selectedElements.length === 0) {
            const emptyText = document.createElement('span');
            emptyText.textContent = 'No elements selected. Drag on map to group.';
            emptyText.style.fontSize = '11px';
            emptyText.style.color = '#7f8c8d';
            emptyText.style.fontStyle = 'italic';
            emptyText.style.textAlign = 'center';
            emptyText.style.padding = '12px 12px';
            this.selectionListContainer.appendChild(emptyText);
            return;
        }

        selectedElements.forEach((el, index) => {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            item.style.padding = '4px 6px';
            item.style.backgroundColor = '#2c241d';
            item.style.border = '1px solid #3c342d';
            item.style.borderRadius = '3px';
            item.style.fontSize = '11px';

            const left = document.createElement('div');
            left.style.display = 'flex';
            left.style.alignItems = 'center';
            left.style.gap = '6px';

            const badge = document.createElement('span');
            badge.style.padding = '1px 4px';
            badge.style.borderRadius = '2px';
            badge.style.fontSize = '9px';
            badge.style.fontWeight = 'bold';
            badge.style.textTransform = 'uppercase';

            let labelText = '';
            if (el.type === 'tile') {
                badge.textContent = 'Tile';
                badge.style.backgroundColor = '#2980b9';
                badge.style.color = 'white';
                labelText = `Tile (${el.mapX}, ${el.mapY})`;
            } else if (el.type === 'object') {
                badge.textContent = 'Obj';
                badge.style.backgroundColor = '#8e44ad';
                badge.style.color = 'white';
                labelText = `${el.displayName || el.assetName} (${el.mapX}, ${el.mapY})`;
            } else if (el.type === 'collision') {
                badge.textContent = 'Coll';
                badge.style.backgroundColor = '#c0392b';
                badge.style.color = 'white';
                labelText = `Collision shape (${el.vertices.length} pts)`;
            } else if (el.type === 'occlusion') {
                badge.textContent = 'Occl';
                badge.style.backgroundColor = '#7f8c8d';
                badge.style.color = 'white';
                labelText = `Occlusion shape (${el.vertices.length} pts)`;
            } else if (el.type === 'spawn') {
                badge.textContent = 'Spwn';
                badge.style.backgroundColor = '#27ae60';
                badge.style.color = 'white';
                labelText = `Spawn (${Math.round(el.x)}, ${Math.round(el.y)})`;
            } else if (el.type === 'light_mask') {
                badge.textContent = 'Light';
                badge.style.backgroundColor = '#f1c40f';
                badge.style.color = '#333';
                labelText = `Shadow/LightMask (${el.maskType})`;
            }

            left.appendChild(badge);
            const textSpan = document.createElement('span');
            textSpan.textContent = labelText;
            textSpan.style.color = '#eee';
            left.appendChild(textSpan);

            const removeBtn = document.createElement('span');
            removeBtn.innerHTML = '✖';
            removeBtn.style.color = '#e74c3c';
            removeBtn.style.fontWeight = 'bold';
            removeBtn.style.fontSize = '10px';
            removeBtn.style.cursor = 'pointer';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                this.editor.deselectElement(index);
            };

            item.appendChild(left);
            item.appendChild(removeBtn);
            this.selectionListContainer.appendChild(item);
        });
    }

    refreshObjectPalette() {
        if (!this.objectPaletteContainer) return;
        this.objectPaletteContainer.innerHTML = '';

        const allDefs = { ...OBJECT_PALETTE_DEFINITIONS, ...(this.editor.map.customPaletteDefinitions || {}) };

        for (const key in allDefs) {
            const objDef = allDefs[key];
            const button = document.createElement('button');
            button.title = objDef.displayName;
            button.style.border = '1px solid #5A4B3E';
            button.style.borderRadius = '4px';
            button.style.backgroundColor = '#4A3C30';
            button.style.padding = '4px';
            button.style.display = 'flex';
            button.style.alignItems = 'center';
            button.style.justifyContent = 'center';
            button.style.cursor = 'pointer';
            
            const canvas = document.createElement('canvas');
            canvas.width = 32; 
            canvas.height = 32;
            const ctx = canvas.getContext('2d');
            
            if (objDef.isCustomBaked) {
                // Draw background
                ctx.fillStyle = '#2c241d';
                ctx.fillRect(0, 0, 32, 32);

                const elements = objDef.customData?.elements || [];
                
                // Draw a nice golden frame
                ctx.strokeStyle = '#f1c40f';
                ctx.lineWidth = 1;
                ctx.strokeRect(0, 0, 32, 32);

                let minRX = Infinity, maxRX = -Infinity, minRY = Infinity, maxRY = -Infinity;
                elements.forEach(el => {
                    if (el.type === 'tile' || el.type === 'object') {
                        minRX = Math.min(minRX, el.relX || 0);
                        maxRX = Math.max(maxRX, el.relX || 0);
                        minRY = Math.min(minRY, el.relY || 0);
                        maxRY = Math.max(maxRY, el.relY || 0);
                    }
                });

                if (isFinite(minRX)) {
                    const rangeX = maxRX - minRX;
                    const rangeY = maxRY - minRY;
                    
                    // Draw each tile
                    elements.forEach(el => {
                        if (el.type === 'tile') {
                            const xOffset = el.relX - (minRX + maxRX)/2;
                            const yOffset = el.relY - (minRY + maxRY)/2;
                            
                            const miniW = 12;
                            const miniH = 6;
                            
                            const cx = 16 + (xOffset - yOffset) * (miniW / 2);
                            const cy = 16 + (xOffset + yOffset) * (miniH / 2);

                            ctx.fillStyle = '#8C6D56'; 
                            ctx.strokeStyle = '#5A4B3E';
                            ctx.beginPath();
                            ctx.moveTo(cx, cy - miniH/2);
                            ctx.lineTo(cx + miniW/2, cy);
                            ctx.lineTo(cx, cy + miniH/2);
                            ctx.lineTo(cx - miniW/2, cy);
                            ctx.closePath();
                            ctx.fill();
                            ctx.stroke();
                        }
                    });

                    // Draw objects on top
                    elements.forEach(el => {
                        if (el.type === 'object') {
                            const xOffset = el.relX - (minRX + maxRX)/2;
                            const yOffset = el.relY - (minRY + maxRY)/2;
                            
                            const miniW = 12;
                            const miniH = 6;
                            
                            const cx = 16 + (xOffset - yOffset) * (miniW / 2);
                            const cy = 16 + (xOffset + yOffset) * (miniH / 2);

                            ctx.fillStyle = '#e74c3c';
                            ctx.fillRect(cx - 2, cy - 8, 4, 8);
                            ctx.strokeStyle = '#fff';
                            ctx.strokeRect(cx - 2, cy - 8, 4, 8);
                        }
                    });
                } else {
                    // Fallback blueprint
                    ctx.fillStyle = '#2c3e50';
                    ctx.fillRect(1, 1, 30, 30);
                    ctx.strokeStyle = '#f1c40f';
                    ctx.strokeRect(1, 1, 30, 30);
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 8px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText('BAKED', 16, 18);
                }
            } else {
                let asset = null;
                if (objDef.spritesheetIndex !== undefined && this.editor.spritesheets[objDef.spritesheetIndex]) {
                    asset = this.editor.spritesheets[objDef.spritesheetIndex].image;
                } else if (this.editor.map?.runtimeSpritesheets && objDef.spritesheetIndex !== undefined && this.editor.map.runtimeSpritesheets[objDef.spritesheetIndex]) {
                    asset = this.editor.map.runtimeSpritesheets[objDef.spritesheetIndex];
                } else if (this.editor.assets) {
                    asset = this.editor.assets[objDef.assetName];
                }

                if (asset && asset.complete) {
                    if (objDef.spriteSourceRect) {
                        ctx.drawImage(asset, objDef.spriteSourceRect.x, objDef.spriteSourceRect.y, objDef.spriteSourceRect.width, objDef.spriteSourceRect.height, 0, 0, 32, 32);
                    } else {
                        ctx.drawImage(asset, 0, 0, 32, 32);
                    }
                } else {
                    ctx.fillStyle = '#8C6D56';
                    ctx.font = '8px Arial';
                    ctx.fillText(objDef.displayName || 'Obj', 2, 16);
                }
            }
            
            button.appendChild(canvas);
            button.onclick = () => {
                this.editor.selectObjectForPlacing(objDef);
                if (objDef.isCustomBaked) {
                    this.showSelectedPrefabDetails(objDef);
                } else {
                    this.hideSelectedPrefabDetails();
                }
            };
            this.objectPaletteContainer.appendChild(button);
        }
    }

    updateToolButtonsState() {
        if (!this.pencilToolButton || !this.eraserToolButton || !this.selectToolButton) return;
        this.pencilToolButton.classList.remove('active');
        this.eraserToolButton.classList.remove('active');
        this.selectToolButton.classList.remove('active');
        if (this.deselectToolButton) this.deselectToolButton.classList.remove('active');

        if (this.editor.currentTool === 'place') {
            this.pencilToolButton.classList.add('active');
        } else if (this.editor.currentTool === 'erase') {
            this.eraserToolButton.classList.add('active');
        } else if (this.editor.currentTool === 'select') {
            this.selectToolButton.classList.add('active');
        } else if (this.editor.currentTool === 'deselect') {
            if (this.deselectToolButton) this.deselectToolButton.classList.add('active');
        }
    }

    showSelectedPrefabDetails(prefab) {
        if (!this.customPrefabDetailsWrapper) return;
        this.customPrefabDetailsWrapper.innerHTML = '';
        this.customPrefabDetailsWrapper.style.display = 'block';

        const title = document.createElement('h5');
        title.style.margin = '0 0 8px 0';
        title.style.color = '#D4C8A0';
        title.style.fontWeight = 'bold';
        title.style.fontSize = '12px';
        title.textContent = `🛠️ Prefab: ${prefab.displayName}`;
        this.customPrefabDetailsWrapper.appendChild(title);

        const elements = prefab.customData?.elements || [];
        const tilesCount = elements.filter(el => el.type === 'tile').length;
        const objectsCount = elements.filter(el => el.type === 'object').length;
        const collisionsCount = elements.filter(el => el.type === 'collision').length;
        const occlusionsCount = elements.filter(el => el.type === 'occlusion').length;
        const spawnsCount = elements.filter(el => el.type === 'spawn').length;
        const lightMasksCount = elements.filter(el => el.type === 'light_mask').length;

        const info = document.createElement('div');
        info.style.marginBottom = '12px';
        info.style.lineHeight = '1.4';
        info.style.color = '#bdc3c7';
        
        const counts = [];
        if (tilesCount > 0) counts.push(`${tilesCount} Tile`);
        if (objectsCount > 0) counts.push(`${objectsCount} Obj`);
        if (collisionsCount > 0) counts.push(`${collisionsCount} Coll`);
        if (occlusionsCount > 0) counts.push(`${occlusionsCount} Occl`);
        if (spawnsCount > 0) counts.push(`${spawnsCount} Spwn`);
        if (lightMasksCount > 0) counts.push(`${lightMasksCount} Light`);

        info.textContent = counts.length > 0 ? `Stacked: ${counts.join(', ')}` : 'Empty blueprint';
        this.customPrefabDetailsWrapper.appendChild(info);

        // Action Buttons Grid
        const btnGroup = document.createElement('div');
        btnGroup.style.display = 'grid';
        btnGroup.style.gridTemplateColumns = '1fr 1fr';
        btnGroup.style.gap = '6px';
        btnGroup.style.marginBottom = '6px';

        // 1. Unpack/Explode
        const explodeBtn = document.createElement('button');
        explodeBtn.className = 'abilities-btn';
        explodeBtn.style.fontSize = '11.5px';
        explodeBtn.style.padding = '5px';
        explodeBtn.innerHTML = '💥 Explode &amp; Edit';
        explodeBtn.title = 'Plop all components at screen center and select them for editing';
        explodeBtn.onclick = () => this.editor.explodeAndEditCustomPrefab(prefab);
        btnGroup.appendChild(explodeBtn);

        // 2. Overwrite / Update
        const updateBtn = document.createElement('button');
        updateBtn.className = 'abilities-btn';
        updateBtn.style.fontSize = '11.5px';
        updateBtn.style.padding = '5px';
        updateBtn.innerHTML = '✏️ Overwrite';
        updateBtn.title = 'Overwrite this prefab with your active selection buffer';
        updateBtn.onclick = () => this.editor.updateExistingPrefab(prefab.assetName);
        btnGroup.appendChild(updateBtn);

        // 3. Export
        const exportBtn = document.createElement('button');
        exportBtn.className = 'abilities-btn';
        exportBtn.style.fontSize = '11.5px';
        exportBtn.style.padding = '5px';
        exportBtn.innerHTML = '📥 Export (.json)';
        exportBtn.title = 'Download this prefab as a JSON file';
        exportBtn.onclick = () => {
            const dataStr = JSON.stringify(prefab, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `${prefab.assetName}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };
        btnGroup.appendChild(exportBtn);

        // 4. Delete
        const deleteBtn = document.createElement('button');
        deleteBtn.style.padding = '6px';
        deleteBtn.style.fontSize = '11px';
        deleteBtn.style.backgroundColor = '#c0392b';
        deleteBtn.style.color = 'white';
        deleteBtn.style.border = 'none';
        deleteBtn.style.borderRadius = '4px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.fontWeight = 'bold';
        deleteBtn.innerHTML = '❌ Delete';
        deleteBtn.title = 'Delete this prefab from local storage database';
        deleteBtn.onclick = () => this.editor.deleteCustomPrefabByKey(prefab.assetName);
        btnGroup.appendChild(deleteBtn);

        this.customPrefabDetailsWrapper.appendChild(btnGroup);
    }

    hideSelectedPrefabDetails() {
        if (this.customPrefabDetailsWrapper) {
            this.customPrefabDetailsWrapper.style.display = 'none';
            this.customPrefabDetailsWrapper.innerHTML = '';
        }
    }
}

export default EditorUIManager;