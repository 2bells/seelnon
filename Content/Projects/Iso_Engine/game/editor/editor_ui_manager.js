// rpg/game/editor/editor_ui_manager.js
console.log("rpg/game/editor/editor_ui_manager.js loaded");

// Import SPAWN_TYPES from MapEditor directly if they are exported there, or define locally.
// Assuming MapEditor exports SPAWN_TYPES:
import { SPAWN_TYPES } from './map_editor.js';

const SPRITESHEET_TILE_SIZE = 64; // Must match MapEditor's constant

// Define standard object configurations for the palette
const OBJECT_PALETTE_DEFINITIONS = {
    tree: {
        type: 'tree',
        displayName: 'Tree',
        assetName: 'tree', // Engine.assets key
        // visualWidth, visualHeight determined by asset or can be overridden
        // anchorOffsetX/Y, collisionShape determined by asset or can be overridden
        // For tree, these are calculated dynamically based on asset size in MapEditor for now
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

        // New UI elements for spritesheets
        this.spritesheetControlsContainer = null;
        this.uploadSpritesheetButton = null;
        this.prevSpritesheetButton = null;
        this.nextSpritesheetButton = null;
        this.spritesheetFileInput = null;
        this.spritesheetNameDisplay = null;
    }

    createPanels() {
        this._createOperationsPanel();
        this._createToolsPanel();
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
        this.toolsPanel.appendChild(layerNavContainer); 
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
        toolSelectionContainer.appendChild(this.undoToolButton);
        toolSelectionContainer.appendChild(this.redoToolButton);
        this.toolsPanel.appendChild(toolSelectionContainer); 

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
        this.uploadSpritesheetButton.style.display = 'inline-flex';
        this.uploadSpritesheetButton.style.justifyContent = 'center';
        this.uploadSpritesheetButton.style.alignItems = 'center';
        this.uploadSpritesheetButton.style.width = '24px';
        this.uploadSpritesheetButton.style.height = '18px';
        this.uploadSpritesheetButton.style.margin = '0 5px';
        this.uploadSpritesheetButton.style.padding = '5px 8px';
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

        this.toolsPanel.appendChild(this.spritesheetControlsContainer);

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
        this.toolsPanel.appendChild(this.snapToGridLabel); 

        // --- Spritesheet Name Display ---
        this.spritesheetNameDisplay = document.createElement('div');
        this.spritesheetNameDisplay.className = 'rpg-editor-info';
        this.spritesheetNameDisplay.style.textAlign = 'center';
        this.spritesheetNameDisplay.style.marginBottom = '5px';
        this.toolsPanel.appendChild(this.spritesheetNameDisplay);

        // --- Tile Spritesheet (shown for 'tile' and 'object1' layers) ---
        this.spritesheetContainerElement = document.createElement('div'); 
        this.spritesheetContainerElement.id = 'rpg-editor-spritesheet-container';
        this.spritesheetCanvas = document.createElement('canvas');
        this.spritesheetCanvas.id = 'rpg-editor-spritesheet-canvas';
        this.spritesheetCtx = this.spritesheetCanvas.getContext('2d');
        this.spritesheetContainerElement.appendChild(this.spritesheetCanvas);
        this.toolsPanel.appendChild(this.spritesheetContainerElement); 

        // --- Selected Tile Preview (shown for 'tile' and 'object1' layers) ---
        this.previewContainerElement = document.createElement('div'); 
        this.previewContainerElement.id = 'rpg-editor-tile-preview-container';
        this.previewCanvas = document.createElement('canvas');
        this.previewCanvas.id = 'rpg-editor-tile-preview-canvas';
        this.previewCanvas.width = SPRITESHEET_TILE_SIZE;
        this.previewCanvas.height = SPRITESHEET_TILE_SIZE;
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.previewContainerElement.appendChild(this.previewCanvas);
        this.toolsPanel.appendChild(this.previewContainerElement); 
        
        // --- Object Palette (shown for 'object2' layers) ---
        this.objectPaletteContainer = document.createElement('div');
        this.objectPaletteContainer.id = 'rpg-editor-object-palette';
        this.objectPaletteContainer.style.display = 'none'; // Initially hidden

        const paletteTitle = document.createElement('h4');
        paletteTitle.textContent = 'Object Palette';
        this.objectPaletteContainer.appendChild(paletteTitle);

        for (const key in OBJECT_PALETTE_DEFINITIONS) {
            const objDef = OBJECT_PALETTE_DEFINITIONS[key];
            const button = document.createElement('button');
            button.textContent = objDef.displayName;
            button.onclick = () => this.editor.selectObjectForPlacing(objDef); 
            this.objectPaletteContainer.appendChild(button);
        }
        
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
        this.toolsPanel.appendChild(collidableLabel); 

        this.toolsPanel.appendChild(this.objectPaletteContainer);

        // --- Spawn Layer Specific Controls ---
        this.spawnTypeContainer = document.createElement('div');
        this.spawnTypeContainer.id = 'rpg-editor-spawn-controls';
        this.spawnTypeContainer.style.display = 'none'; // Hidden by default

        const spawnTypeLabel = document.createElement('label');
        spawnTypeLabel.textContent = 'Spawn Type: ';
        spawnTypeLabel.style.display = 'block';
        spawnTypeLabel.style.marginBottom = '5px';
        
        this.spawnTypeSelect = document.createElement('select');
        this.spawnTypeSelect.id = 'rpg-editor-spawn-type-select';
        for (const typeKey in SPAWN_TYPES) {
            const option = document.createElement('option');
            option.value = SPAWN_TYPES[typeKey];
            option.textContent = SPAWN_TYPES[typeKey].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); // Format for display
            this.spawnTypeSelect.appendChild(option);
        }
        this.spawnTypeSelect.onchange = () => this.updateToolPanelVisibility(); // Re-check visibility for targetMapInput
        spawnTypeLabel.appendChild(this.spawnTypeSelect);
        this.spawnTypeContainer.appendChild(spawnTypeLabel);

        const targetMapLabel = document.createElement('label');
        targetMapLabel.textContent = 'Target Map Name: ';
        targetMapLabel.style.display = 'block'; // Will be controlled by visibility logic
        targetMapLabel.style.marginBottom = '5px';
        this.spawnTargetMapInput = document.createElement('input');
        this.spawnTargetMapInput.type = 'text';
        this.spawnTargetMapInput.id = 'rpg-editor-spawn-targetmap-input';
        this.spawnTargetMapInput.placeholder = 'e.g., next_level';
        targetMapLabel.appendChild(this.spawnTargetMapInput);
        this.spawnTypeContainer.appendChild(targetMapLabel);

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

        const uploadNpcButton = document.createElement('label');
        uploadNpcButton.htmlFor = npcBrushUploadId;
        uploadNpcButton.className = 'rpg-file-label';
        uploadNpcButton.style.display = 'block';
        uploadNpcButton.style.width = '100%';
        uploadNpcButton.style.marginBottom = '6px';
        uploadNpcButton.textContent = 'Upload NPC (.json)';

        this.spawnNpcBrushInfo = document.createElement('p');
        this.spawnNpcBrushInfo.className = 'rpg-editor-info';
        this.spawnNpcBrushInfo.style.textAlign = 'center';
        this.spawnNpcBrushInfo.textContent = 'No NPC loaded.';

        this.spawnPermanentNpcContainer.appendChild(this.npcJsonInput);
        this.spawnPermanentNpcContainer.appendChild(uploadNpcButton);
        this.spawnPermanentNpcContainer.appendChild(this.spawnNpcBrushInfo);
        this.spawnTypeContainer.appendChild(this.spawnPermanentNpcContainer);

        // --- Container for enemy selection ---
        this.spawnEnemyContainer = document.createElement('div');
        this.spawnEnemyContainer.id = 'rpg-editor-spawn-enemy-controls';
        this.spawnEnemyContainer.style.marginTop = '10px';

        const enemyTypeLabel = document.createElement('label');
        enemyTypeLabel.textContent = 'Enemy Type:';
        this.spawnEnemySelect = document.createElement('select');
        this.spawnEnemySelect.id = 'rpg-editor-spawn-enemy-select';
        
        this.spawnEnemyContainer.appendChild(enemyTypeLabel);
        this.spawnEnemyContainer.appendChild(this.spawnEnemySelect);
        this.spawnTypeContainer.appendChild(this.spawnEnemyContainer);

        this.toolsPanel.appendChild(this.spawnTypeContainer);


        // --- Info Text ---
        this.layerInfoTextElement = document.createElement('p');
        this.layerInfoTextElement.className = 'rpg-editor-info';
        this.toolsPanel.appendChild(this.layerInfoTextElement);

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
        
        // Spritesheet (for tile and object1)
        this.spritesheetContainerElement.style.display = isTileSelectionLayer ? 'block' : 'none';
        this.spritesheetControlsContainer.style.display = isTileSelectionLayer ? 'flex' : 'none';
        this.spritesheetNameDisplay.style.display = isTileSelectionLayer ? 'block' : 'none';

        // Preview (for everything EXCEPT tile/object1 layers, unless erasing)
        this.previewContainerElement.style.display = (!isTileSelectionLayer || this.editor.currentTool === 'erase') ? 'block' : 'none';

        // Object Palette (for object2)
        this.objectPaletteContainer.style.display = (currentLayer === 'object2') ? 'block' : 'none';

        // Collidable Checkbox (for all object layers)
        if(collidableLabel) collidableLabel.style.display = isObjectLayer ? 'flex' : 'none';

        // Snap to Grid (for objects, shapes, spawns)
        this.snapToGridLabel.style.display = (isObjectLayer || isShapeLayer || isSpawnLayer) ? 'flex' : 'none';

        // Spawn Controls (for spawn layer)
        this.spawnTypeContainer.style.display = isSpawnLayer ? 'block' : 'none';

        // --- Update state of visible controls ---
        if (isObjectLayer && collidableLabel && collidableLabel.style.display !== 'none') {
            if (this.editor.selectedObjectBrush) {
                this.collidableCheckbox.checked = this.editor.selectedObjectBrush.collidable !== undefined ? this.editor.selectedObjectBrush.collidable : true;
            } else {
                this.collidableCheckbox.checked = true;
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

    updateToolButtonsState() {
        if (!this.pencilToolButton || !this.eraserToolButton) return;
        if (this.editor.currentTool === 'place') {
            this.pencilToolButton.classList.add('active');
            this.eraserToolButton.classList.remove('active');
        } else if (this.editor.currentTool === 'erase') {
            this.eraserToolButton.classList.add('active');
            this.pencilToolButton.classList.remove('active');
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

    renderPlayerUI() {
        if (!this.player) return;
        const ctx = this.player.ctx;
        const spawnInfo = this.editor.currentTool === 'place' ? this.editor.selectedObjectBrush : null;
        if (spawnInfo) {
            ctx.font = '16px Arial';
            ctx.fillText(spawnInfo, 10, 120);
        }
    }
}

export default EditorUIManager;