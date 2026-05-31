// Game Map Editor Logic
console.log("rpg/game/editor/map_editor.js loaded");

import EditorUIManager from './editor_ui_manager.js';
import EditorMapOperations from './editor_map_operations.js';
import { enemy_types } from '../../data/enemy-list.js';
import { db, STORES } from '../utils/db.js';
// GameObject is not directly instantiated here anymore by editor, but by Map
// import GameObject from '../entities/gameObject.js';

const SPRITESHEET_TILE_SIZE = 64; // Tiles in the spritesheet are 64x64
const SPRITESHEET_PADDING = 2; // Padding between sprites
const POLYGON_CLOSE_DISTANCE_SQ = 100; // Squared distance (10px) to auto-close polygon
const SPAWN_POINT_RADIUS = 10; // Visual radius for spawn points in editor

// Default diamond collision shape for 64x64 base objects
const OBJECT_DIAMOND_HALF_WIDTH = 32;
const OBJECT_DIAMOND_HALF_HEIGHT = 16;
const DEFAULT_OBJECT_DIAMOND_VERTICES = [
    { x: 0, y: -OBJECT_DIAMOND_HALF_HEIGHT }, // Top
    { x: OBJECT_DIAMOND_HALF_WIDTH, y: 0 },   // Right
    { x: 0, y: OBJECT_DIAMOND_HALF_HEIGHT },  // Bottom
    { x: -OBJECT_DIAMOND_HALF_WIDTH, y: 0 }   // Left
];

export const SPAWN_TYPES = {
    PLAYER_ENTRY: 'player_entry',
    PLAYER_EXIT: 'player_exit',
    NPC: 'npc',
    NPC_PERMANENT: 'npc_permanent',
    ENEMY: 'enemy',
    EVENT: 'event',
    DEFAULT: 'default'
};

export const SPAWN_TYPE_COLORS = {
    [SPAWN_TYPES.PLAYER_ENTRY]: { fill: 'rgba(0, 255, 0, 0.4)', stroke: 'rgba(0, 200, 0, 0.8)' }, // Bright Green
    [SPAWN_TYPES.PLAYER_EXIT]:  { fill: 'rgba(0, 0, 255, 0.4)', stroke: 'rgba(0, 0, 200, 0.8)' },  // Bright Blue
    [SPAWN_TYPES.NPC]:          { fill: 'rgba(255, 255, 0, 0.4)', stroke: 'rgba(200, 200, 0, 0.8)' },// Yellow
    [SPAWN_TYPES.NPC_PERMANENT]:{ fill: 'rgba(255, 165, 0, 0.4)', stroke: 'rgba(220, 140, 0, 0.8)' },// Orange
    [SPAWN_TYPES.ENEMY]:        { fill: 'rgba(255, 0, 0, 0.4)', stroke: 'rgba(200, 0, 0, 0.8)' },    // Red
    [SPAWN_TYPES.EVENT]:        { fill: 'rgba(255, 0, 255, 0.4)', stroke: 'rgba(200, 0, 200, 0.8)' },// Magenta
    [SPAWN_TYPES.DEFAULT]:      { fill: 'rgba(128, 128, 128, 0.4)', stroke: 'rgba(100, 100, 100, 0.8)' } // Grey for default
};


class MapEditor {
    constructor(engine, modalContentElement) {
        this.engine = engine;
        this.map = engine.map;
        this.assets = engine.assets;
        this.modalContentElement = modalContentElement; 

        this.isActive = false;
        
        this.mapOperations = new EditorMapOperations(this);
        this.uiManager = new EditorUIManager(this, this.modalContentElement);

        this.selectedTileBrush = null; 
        this.selectedObjectBrush = null; // Stores config for placing object like { type: 'tree', assetName: 'tree', ... }
        this.selectedElements = []; // Items in the bulk selection grouping
        this.isSelectingDrag = false; // Mouse drag select active flag
        this.dragStartWorldPos = null; // World starting coordinates of drag select

        // Spritesheet management
        this.spritesheets = []; // { name, image, dataUrl?, isCustom }
        this.currentSpriteSheetIndex = 0;

        this.currentLayer = 'tile';
        this.availableLayers = ['tile', 'object1', 'object2', 'collision', 'occlusion', 'spawn'];
        this.currentLayerIndex = 0;

        this.currentTool = 'place'; // 'place' or 'erase'
        this.snapToGrid = true;

        this.enemyTypes = enemy_types; // Store enemy types for the editor UI
        this.loadedNpcData = null;

        this.currentPolygonVertices = []; // For drawing collision/occlusion {worldX, worldY}
        this.currentMouseWorldPos = { x: 0, y: 0 }; // To store current mouse position in world coordinates

        this.undoStack = [];
        this.redoStack = [];

        this._boundHandleSpritesheetClick = this.handleSpritesheetClick.bind(this);
        this._boundHandleMapClick = this.handleMapClick.bind(this);
        this._boundHandleMouseMove = this.handleMouseMove.bind(this);
        this._boundHandleMouseDown = this.handleMouseDown.bind(this);
        this._boundHandleMouseUp = this.handleMouseUp.bind(this);
        this._boundHandleKeyDown = this.handleKeyDown.bind(this);
        this._boundNextLayer = this.nextLayer.bind(this);
        this._boundPrevLayer = this.prevLayer.bind(this);
    }

    initUI() {
        // Check if UI manager has already initialized panels
        if (this.uiManager.toolsPanel && this.uiManager.operationsPanel) return;

        this.uiManager.createPanels();
        this.uiManager.populateEnemySelector(this.enemyTypes); // Populate the new enemy dropdown
        this.initializeSpritesheets();
    }

    initializeSpritesheets() {
        // Clear existing
        this.spritesheets = [];
        this.currentSpriteSheetIndex = 0;
        this.clearHistory();

        // Add default spritesheet from the map's runtime list
        if (this.map.runtimeSpritesheets[0]) {
             this.spritesheets.push({
                name: 'default_buildings.png',
                image: this.map.runtimeSpritesheets[0],
                isCustom: false,
            });
        }
        if (this.map.runtimeSpritesheets[1]) {
             this.spritesheets.push({
                name: 'iso-64x64-outdoors.png',
                image: this.map.runtimeSpritesheets[1],
                isCustom: false,
            });
        }
        
        // Add custom spritesheets from the map
        const defaultCount = 2;
        if (this.map.customSpritesheets) {
            this.map.customSpritesheets.forEach((sheetData, index) => {
                const image = this.map.runtimeSpritesheets[defaultCount + index];
                if (image) {
                     this.spritesheets.push({
                        name: sheetData.name,
                        image: image,
                        isCustom: true,
                        dataUrl: sheetData.dataUrl
                    });
                }
            });
        }

        // Now that spritesheets are initialized, load the view
        this.reloadSpritesheetView();
    }

    updateLayerDisplay() {
        if (this.uiManager.layerDisplayElement) {
            this.currentLayer = this.availableLayers[this.currentLayerIndex];
            this.uiManager.layerDisplayElement.textContent = this.currentLayer.charAt(0).toUpperCase() + this.currentLayer.slice(1) + " Layer";
            
            let infoTextContent = '';
            if (this.currentLayer === 'tile') {
                infoTextContent = 'Select a tile from spritesheet. Click on map to place.';
            } else if (this.currentLayer === 'object1') {
                infoTextContent = 'Select a sprite from spritesheet to place as an object. Objects get a default diamond collision. Toggle collidability. Click on map to place.';
            } else if (this.currentLayer === 'object2') {
                infoTextContent = `Select a predefined object from palette. Toggle collidability. Click on map to place on ${this.currentLayer}.`;
            } else if (this.currentLayer === 'collision') {
                infoTextContent = 'Collision Layer: Click to add polygon vertices. Click near start point (or double-click last point) to finalize polygon. Eraser removes polygons. Snap-to-grid snaps vertices to tile corners.';
            } else if (this.currentLayer === 'occlusion') {
                infoTextContent = 'Occlusion Layer: Draw semi-transparent blue polygons. These zones mark areas where entities might be rendered differently (e.g., behind foreground elements - effect TBD). Drawing mechanics are similar to Collision Layer.';
            } else if (this.currentLayer === 'spawn') {
                infoTextContent = 'Spawn Layer: Select spawn type. Click to place spawn points. For "Player Exit", specify target map. Eraser removes points. Snap-to-grid snaps to tile centers.';
            }
             else {
                infoTextContent = `Editing ${this.currentLayer} layer. (Functionality pending)`;
            }
            this.uiManager.updateLayerInfoText(infoTextContent);
            this.uiManager.updateToolPanelVisibility(); // Show/hide relevant tool panels
        }
    }

    nextLayer() {
        this.currentLayerIndex = (this.currentLayerIndex + 1) % this.availableLayers.length;
        this.clearBrushes();
        this.currentPolygonVertices = []; // Reset collision/occlusion drawing state
        this.updateLayerDisplay();
    }

    prevLayer() {
        this.currentLayerIndex = (this.currentLayerIndex - 1 + this.availableLayers.length) % this.availableLayers.length;
        this.clearBrushes();
        this.currentPolygonVertices = []; // Reset collision/occlusion drawing state
        this.updateLayerDisplay();
    }

    clearBrushes() {
        this.selectedTileBrush = null;
        this.selectedObjectBrush = null;
        // The call to update visuals will be handled by the code that calls clearBrushes,
        // typically as part of a larger UI update (e.g., changing layer or tool).
    }

    updateBrushVisuals() {
        this.reloadSpritesheetView();
        this.updatePreview();
    }

    reloadSpritesheetView() {
        if (!this.uiManager.spritesheetCanvas || !this.uiManager.spritesheetCtx) {
            // Silently return if UI hasn't been created/initialized yet
            return;
        }

        if (this.spritesheets.length === 0) {
            // Handle case where no spritesheets are available
            this.uiManager.spritesheetCtx.clearRect(0, 0, this.uiManager.spritesheetCanvas.width, this.uiManager.spritesheetCanvas.height);
            this.uiManager.updateSpritesheetName("No Spritesheet");
            return;
        }
        
        this.currentSpriteSheetIndex = (this.currentSpriteSheetIndex + this.spritesheets.length) % this.spritesheets.length;
        const currentSheet = this.spritesheets[this.currentSpriteSheetIndex];
        const spritesheetImage = currentSheet.image;

        if (spritesheetImage && spritesheetImage.complete) {
            this.uiManager.spritesheetCanvas.width = spritesheetImage.width;
            this.uiManager.spritesheetCanvas.height = spritesheetImage.height;
            this.uiManager.spritesheetCtx.imageSmoothingEnabled = false; 
            this.uiManager.spritesheetCtx.drawImage(spritesheetImage, 0, 0);
            this.uiManager.updateSpritesheetName(currentSheet.name);

            // --- DRAW SELECTION HIGHLIGHT ---
            this._drawSpritesheetSelectionHighlight(this.uiManager.spritesheetCtx);
            // --- END HIGHLIGHT ---

        } else if (spritesheetImage) {
            spritesheetImage.onload = () => { 
                this.uiManager.spritesheetCanvas.width = spritesheetImage.width;
                this.uiManager.spritesheetCanvas.height = spritesheetImage.height;
                this.uiManager.spritesheetCtx.imageSmoothingEnabled = false;
                this.uiManager.spritesheetCtx.drawImage(spritesheetImage, 0, 0);
                this.uiManager.updateSpritesheetName(currentSheet.name);
                
                // --- DRAW SELECTION HIGHLIGHT ---
                this._drawSpritesheetSelectionHighlight(this.uiManager.spritesheetCtx);
                 // --- END HIGHLIGHT ---
            };
            spritesheetImage.onerror = () => {
                console.error(`Editor: Spritesheet asset ${currentSheet.name} failed to load.`);
            };
        } else {
            console.error(`Editor: Spritesheet asset ${currentSheet.name} not found or loaded.`);
            if(this.uiManager.spritesheetCtx) { 
                this.uiManager.spritesheetCtx.clearRect(0, 0, this.uiManager.spritesheetCanvas.width, this.uiManager.spritesheetCanvas.height);
                this.uiManager.spritesheetCtx.fillStyle = 'red';
                this.uiManager.spritesheetCtx.fillRect(0,0,100,100);
                this.uiManager.spritesheetCtx.fillStyle = 'white';
                this.uiManager.spritesheetCtx.fillText("Error",10,10);
            }
        }
    }

    _drawSpritesheetSelectionHighlight(ctx) {
        if (!ctx || !this.isActive || (this.currentLayer !== 'tile' && this.currentLayer !== 'object1') || this.currentTool !== 'place') {
            return;
        }
    
        let brush = null;
        if (this.currentLayer === 'tile' && this.selectedTileBrush) {
            brush = this.selectedTileBrush;
        } else if (this.currentLayer === 'object1' && this.selectedObjectBrush && this.selectedObjectBrush.spriteSourceRect) {
            brush = this.selectedObjectBrush;
        }
    
        if (brush && brush.spritesheetIndex === this.currentSpriteSheetIndex) {
            const rect = brush.sourceRect || brush.spriteSourceRect;
            if (rect) { // Ensure rect exists
                const { x, y, width, height } = rect;
                ctx.strokeStyle = 'yellow';
                ctx.lineWidth = 3;
                // Adjust for line width so stroke is fully visible within the rect bounds
                ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth);
            }
        }
    }

    nextSpritesheet() {
        if (this.spritesheets.length > 1) {
            this.currentSpriteSheetIndex = (this.currentSpriteSheetIndex + 1) % this.spritesheets.length;
            this.clearBrushes();
            this.reloadSpritesheetView();
        }
    }

    prevSpritesheet() {
        if (this.spritesheets.length > 1) {
            this.currentSpriteSheetIndex = (this.currentSpriteSheetIndex - 1 + this.spritesheets.length) % this.spritesheets.length;
            this.clearBrushes();
            this.reloadSpritesheetView();
        }
    }

    handleSpritesheetUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            const newImage = new Image();
            newImage.onload = () => {
                const newSheet = {
                    name: file.name,
                    image: newImage,
                    isCustom: true,
                    dataUrl: dataUrl,
                };
                this.spritesheets.push(newSheet);
                this.currentSpriteSheetIndex = this.spritesheets.length - 1;

                // Update the map's spritesheet data
                this.updateMapSpritesheets();

                this.clearBrushes();
                this.reloadSpritesheetView();
                CustomDialog.alert(`Spritesheet "${file.name}" uploaded successfully.`, "Spritesheet Uploaded");
            };
            newImage.onerror = () => {
                CustomDialog.alert(`Failed to load the uploaded image file: ${file.name}`, "Load Error");
            };
            newImage.src = dataUrl;
        };
        reader.readAsDataURL(file);
        
        // Reset file input to allow uploading the same file again
        event.target.value = null;
    }

    handleNpcJsonUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const npcData = JSON.parse(e.target.result);
                // Basic validation
                if (npcData && npcData.name && npcData.map_sprite && npcData.dialogue_avatars) {
                    this.loadedNpcData = npcData;
                    CustomDialog.alert(`Loaded NPC "${npcData.name}". Click on the map to place.`, "NPC Loaded");
                    this.uiManager.updateNpcBrushInfo(npcData.name);
                } else {
                    throw new Error("Invalid or incomplete NPC JSON file.");
                }
            } catch (error) {
                console.error("Error parsing NPC file for map editor:", error);
                CustomDialog.alert(`Error parsing NPC file: ${error.message}`, "Import Error");
                this.loadedNpcData = null;
                this.uiManager.updateNpcBrushInfo(null);
            }
        };
        reader.readAsText(file);

        event.target.value = null; // Allow re-upload
    }

    updateMapSpritesheets() {
        this.map.runtimeSpritesheets = this.spritesheets.map(s => s.image);
        this.map.customSpritesheets = this.spritesheets
            .filter(s => s.isCustom)
            .map(s => ({ name: s.name, dataUrl: s.dataUrl }));
    }

    async loadCustomPrefabsFromDB() {
        try {
            const list = await db.getAll(STORES.PREFABS);
            this.map.customPaletteDefinitions = this.map.customPaletteDefinitions || {};
            list.forEach(prefab => {
                if (prefab && prefab.assetName) {
                    this.map.customPaletteDefinitions[prefab.assetName] = prefab;
                }
            });
            if (this.uiManager) {
                this.uiManager.refreshObjectPalette();
            }
        } catch (e) {
            console.error("Failed to load prefabs from DB:", e);
        }
    }

    show() {
        if (!this.uiManager.toolsPanel || !this.uiManager.operationsPanel) {
            this.initUI();
        }
        this.uiManager.showPanels();
        this.isActive = true;
        
        // Load custom prefabs from IndexedDB
        this.loadCustomPrefabsFromDB();
        
        if (this.uiManager.spritesheetCanvas) {
            this.uiManager.spritesheetCanvas.addEventListener('click', this._boundHandleSpritesheetClick);
        }
        this.engine.canvas.addEventListener('click', this._boundHandleMapClick);
        this.engine.canvas.addEventListener('mousemove', this._boundHandleMouseMove);
        this.engine.canvas.addEventListener('mousedown', this._boundHandleMouseDown);
        this.engine.canvas.addEventListener('mouseup', this._boundHandleMouseUp);
        window.addEventListener('keydown', this._boundHandleKeyDown);

        if (this.engine && this.engine.canvas) {
            const toolName = this.currentTool;
            if (toolName === 'select' || toolName === 'deselect' || toolName === 'erase') {
                this.engine.canvas.style.cursor = 'crosshair';
            } else {
                this.engine.canvas.style.cursor = 'default';
            }
        }
    }

    hide() {
        this.uiManager.hidePanels();
        this.isActive = false;
        this.currentPolygonVertices = []; // Clear any in-progress polygon

        if (this.uiManager.spritesheetCanvas) {
            this.uiManager.spritesheetCanvas.removeEventListener('click', this._boundHandleSpritesheetClick);
        }
        this.engine.canvas.removeEventListener('click', this._boundHandleMapClick);
        this.engine.canvas.removeEventListener('mousemove', this._boundHandleMouseMove);
        this.engine.canvas.removeEventListener('mousedown', this._boundHandleMouseDown);
        this.engine.canvas.removeEventListener('mouseup', this._boundHandleMouseUp);
        window.removeEventListener('keydown', this._boundHandleKeyDown);

        if (this.engine && this.engine.canvas) {
            this.engine.canvas.style.cursor = 'default';
        }
    }

    handleSpritesheetClick(event) {
        if (!this.uiManager.spritesheetCanvas) return; 

        if (this.currentTool === 'erase') {
            this.selectTool('place');
        }

        const rect = this.uiManager.spritesheetCanvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const tileX = Math.floor(x / (SPRITESHEET_TILE_SIZE + SPRITESHEET_PADDING));
        const tileY = Math.floor(y / (SPRITESHEET_TILE_SIZE + SPRITESHEET_PADDING));
        
        const clickedSourceRect = {
            x: tileX * (SPRITESHEET_TILE_SIZE + SPRITESHEET_PADDING),
            y: tileY * (SPRITESHEET_TILE_SIZE + SPRITESHEET_PADDING),
            width: SPRITESHEET_TILE_SIZE,
            height: SPRITESHEET_TILE_SIZE
        };

        if (this.currentLayer === 'tile') {
            this.selectedObjectBrush = null; 
            const activeZIndex = this.uiManager && this.uiManager.tileZIndexInput ? Number(this.uiManager.tileZIndexInput.value) : 0;
            this.selectedTileBrush = { 
                sourceRect: clickedSourceRect,
                spritesheetIndex: this.currentSpriteSheetIndex,
                zIndex: activeZIndex,
                anchorOffsetX: SPRITESHEET_TILE_SIZE / 2,
                anchorOffsetY: SPRITESHEET_TILE_SIZE / 2
            };
            console.log("Selected tile brush:", this.selectedTileBrush);
       
        } else if (this.currentLayer === 'object1') {
            this.selectedTileBrush = null; 
            const currentSheet = this.spritesheets[this.currentSpriteSheetIndex];
            const assetNameForBrush = currentSheet.isCustom ? `custom_spritesheet_${this.currentSpriteSheetIndex}` : 'buildingSpritesheet'; 
            this.selectedObjectBrush = {
                type: 'spriteObject', 
                displayName: `Object (${tileX},${tileY})`, 
                assetName: assetNameForBrush, // Use the determined asset name
                spritesheetIndex: this.currentSpriteSheetIndex,
                spriteSourceRect: clickedSourceRect,
                visualWidth: SPRITESHEET_TILE_SIZE,
                visualHeight: SPRITESHEET_TILE_SIZE,
                anchorOffsetX: SPRITESHEET_TILE_SIZE / 2,   
                anchorOffsetY: SPRITESHEET_TILE_SIZE,       
                collidable: this.uiManager.collidableCheckbox ? this.uiManager.collidableCheckbox.checked : true,
                collisionShape: { 
                    type: 'polygon', 
                    vertices: DEFAULT_OBJECT_DIAMOND_VERTICES // Use default diamond for object1
                }
            };
            console.log("Selected object brush (from spritesheet for Object1):", this.selectedObjectBrush);
        } else {
            this.clearBrushes();
        }
        this.updateBrushVisuals();
    }

    selectObjectForPlacing(objectDefinition) {
        this.selectedTileBrush = null; 
        this.selectedObjectBrush = { ...objectDefinition }; 
        // Ensure collidable and collisionShape are present from OBJECT_PALETTE_DEFINITIONS
        // or set sensible defaults if not.
        this.selectedObjectBrush.collidable = this.uiManager.collidableCheckbox ? 
                                              this.uiManager.collidableCheckbox.checked : 
                                              (objectDefinition.collidable !== undefined ? objectDefinition.collidable : true);
        
        if (this.selectedObjectBrush.scale) {
            const asset = this.assets[this.selectedObjectBrush.assetName];
            if (asset && asset.complete) {
                this.selectedObjectBrush.visualWidth = asset.width * this.selectedObjectBrush.scale;
                this.selectedObjectBrush.visualHeight = asset.height * this.selectedObjectBrush.scale;
                this.selectedObjectBrush.anchorOffsetX = this.selectedObjectBrush.visualWidth * (this.selectedObjectBrush.anchorOffsetXFactor !== undefined ? this.selectedObjectBrush.anchorOffsetXFactor : 0.5);
                this.selectedObjectBrush.anchorOffsetY = this.selectedObjectBrush.visualHeight * (this.selectedObjectBrush.anchorOffsetYFactor !== undefined ? this.selectedObjectBrush.anchorOffsetYFactor : 1.0);
            }
        }

        if (!this.selectedObjectBrush.collisionShape && this.selectedObjectBrush.collidable) {
            // If object is collidable but has no shape defined (e.g. new palette items), give it a default diamond
            console.warn(`Object ${this.selectedObjectBrush.displayName} from palette is collidable but has no collisionShape. Assigning default diamond.`);
            this.selectedObjectBrush.collisionShape = {
                type: 'polygon',
                vertices: DEFAULT_OBJECT_DIAMOND_VERTICES
            };
        } else if (this.selectedObjectBrush.collisionShape && this.selectedObjectBrush.collisionShape.type === 'rectangle' && !this.selectedObjectBrush.collisionShape.xOffset) {
            // if it's a rect from palette, ensure xOffset/yOffset are set (as GameObject constructor would do)
             this.selectedObjectBrush.collisionShape.xOffset = this.selectedObjectBrush.collisionShape.xOffset !== undefined ? this.selectedObjectBrush.collisionShape.xOffset : -this.selectedObjectBrush.collisionShape.width / 2;
             this.selectedObjectBrush.collisionShape.yOffset = this.selectedObjectBrush.collisionShape.yOffset !== undefined ? this.selectedObjectBrush.collisionShape.yOffset : -this.selectedObjectBrush.collisionShape.height;
        }

        if (this.currentTool === 'erase') {
            this.selectTool('place');
        }

        console.log("Selected object brush (from palette for Object2):", this.selectedObjectBrush);
        this.updateBrushVisuals();
        if (this.uiManager.collidableCheckbox){
            this.uiManager.collidableCheckbox.checked = this.selectedObjectBrush.collidable;
        }
    }

    updatePreview() {
        if (!this.uiManager.previewCtx || !this.uiManager.previewCanvas) return;
        this.uiManager.previewCtx.clearRect(0, 0, this.uiManager.previewCanvas.width, this.uiManager.previewCanvas.height);
        this.uiManager.previewCtx.imageSmoothingEnabled = false;

        // If the preview canvas is hidden by the UI manager, no need to draw anything.
        if (this.uiManager.previewContainerElement && this.uiManager.previewContainerElement.style.display === 'none') {
            return;
        }

        if (this.currentTool === 'erase') {
            const eraserIcon = this.engine.assets.eraser_icon;
            if (eraserIcon && eraserIcon.complete) {
                 this.uiManager.previewCtx.drawImage(eraserIcon, 0, 0, this.uiManager.previewCanvas.width, this.uiManager.previewCanvas.height);
            } else {
                this.uiManager.previewCtx.fillStyle = 'white';
                this.uiManager.previewCtx.strokeStyle = 'black';
                this.uiManager.previewCtx.lineWidth = 2;
                this.uiManager.previewCtx.fillRect(this.uiManager.previewCanvas.width * 0.2, this.uiManager.previewCanvas.height * 0.4, this.uiManager.previewCanvas.width * 0.6, this.uiManager.previewCanvas.height * 0.2);
                this.uiManager.previewCtx.strokeRect(this.uiManager.previewCanvas.width * 0.2, this.uiManager.previewCanvas.height * 0.4, this.uiManager.previewCanvas.width * 0.6, this.uiManager.previewCanvas.height * 0.2);
                this.uiManager.previewCtx.fillText("Erase", 10, 10);
            }
            return;
        }
        
        // Previews are now only for layers/tools that DON'T use the spritesheet for selection.
        // Tile and Object1 layers have their selection highlighted on the spritesheet canvas itself.

        if (this.selectedObjectBrush && this.currentLayer === 'object2') {
            if (this.selectedObjectBrush.isCustomBaked && this.selectedObjectBrush.customData) {
                const elements = this.selectedObjectBrush.customData.elements || [];
                const midX = this.uiManager.previewCanvas.width / 2;
                const midY = this.uiManager.previewCanvas.height / 2;

                // Draw nice background
                this.uiManager.previewCtx.fillStyle = '#2c241d';
                this.uiManager.previewCtx.fillRect(0, 0, this.uiManager.previewCanvas.width, this.uiManager.previewCanvas.height);
                
                // Draw a nice golden border
                this.uiManager.previewCtx.strokeStyle = '#f1c40f';
                this.uiManager.previewCtx.lineWidth = 1;
                this.uiManager.previewCtx.strokeRect(0, 0, this.uiManager.previewCanvas.width, this.uiManager.previewCanvas.height);

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
                    // Draw each tile
                    elements.forEach(el => {
                        if (el.type === 'tile') {
                            const xOffset = el.relX - (minRX + maxRX)/2;
                            const yOffset = el.relY - (minRY + maxRY)/2;
                            
                            const miniW = 24;
                            const miniH = 12;
                            
                            const cx = midX + (xOffset - yOffset) * (miniW / 2);
                            const cy = midY + (xOffset + yOffset) * (miniH / 2);

                            this.uiManager.previewCtx.fillStyle = '#8C6D56'; 
                            this.uiManager.previewCtx.strokeStyle = '#5A4B3E';
                            this.uiManager.previewCtx.beginPath();
                            this.uiManager.previewCtx.moveTo(cx, cy - miniH/2);
                            this.uiManager.previewCtx.lineTo(cx + miniW/2, cy);
                            this.uiManager.previewCtx.lineTo(cx, cy + miniH/2);
                            this.uiManager.previewCtx.lineTo(cx - miniW/2, cy);
                            this.uiManager.previewCtx.closePath();
                            this.uiManager.previewCtx.fill();
                            this.uiManager.previewCtx.stroke();
                        }
                    });

                    // Draw objects on top
                    elements.forEach(el => {
                        if (el.type === 'object') {
                            const xOffset = el.relX - (minRX + maxRX)/2;
                            const yOffset = el.relY - (minRY + maxRY)/2;
                            
                            const miniW = 24;
                            const miniH = 12;
                            
                            const cx = midX + (xOffset - yOffset) * (miniW / 2);
                            const cy = midY + (xOffset + yOffset) * (miniH / 2);

                            this.uiManager.previewCtx.fillStyle = '#e74c3c';
                            this.uiManager.previewCtx.fillRect(cx - 3, cy - 10, 6, 10);
                            this.uiManager.previewCtx.strokeStyle = '#fff';
                            this.uiManager.previewCtx.strokeRect(cx - 3, cy - 10, 6, 10);
                        }
                    });
                } else {
                    // Fallback
                    this.uiManager.previewCtx.fillStyle = '#ffffff';
                    this.uiManager.previewCtx.font = 'bold 8px monospace';
                    this.uiManager.previewCtx.textAlign = 'center';
                    this.uiManager.previewCtx.fillText('BAKED', midX, midY + 3);
                }
                return;
            }

            let asset = null;
            if (this.selectedObjectBrush.spritesheetIndex !== undefined && this.spritesheets[this.selectedObjectBrush.spritesheetIndex]) {
                 asset = this.spritesheets[this.selectedObjectBrush.spritesheetIndex].image;
            } else if (this.map?.runtimeSpritesheets && this.selectedObjectBrush.spritesheetIndex !== undefined && this.map.runtimeSpritesheets[this.selectedObjectBrush.spritesheetIndex]) {
                 asset = this.map.runtimeSpritesheets[this.selectedObjectBrush.spritesheetIndex];
            } else if (this.selectedObjectBrush.assetName) {
                 asset = this.assets[this.selectedObjectBrush.assetName];
            }
            if (asset && asset.complete) {
                if (this.selectedObjectBrush.spriteSourceRect) { 
                    const { x, y, width, height } = this.selectedObjectBrush.spriteSourceRect;
                     this.uiManager.previewCtx.drawImage(
                        asset, x, y, width, height,
                        0, 0, this.uiManager.previewCanvas.width, this.uiManager.previewCanvas.height
                    );
                } else { 
                     this.uiManager.previewCtx.drawImage(
                        asset, 0, 0, asset.width, asset.height, 
                        0, 0, this.uiManager.previewCanvas.width, this.uiManager.previewCanvas.height
                    );
                }
            } else {
                 this.uiManager.previewCtx.fillStyle = 'grey';
                 this.uiManager.previewCtx.fillText(this.selectedObjectBrush.displayName || 'Obj', 5, 32);
            }
        } else if (this.currentLayer === 'collision' && this.currentTool === 'place') {
            this.uiManager.previewCtx.strokeStyle = 'rgba(255,0,0,0.7)';
            this.uiManager.previewCtx.lineWidth = 2;
            this.uiManager.previewCtx.beginPath();
            this.uiManager.previewCtx.moveTo(this.uiManager.previewCanvas.width * 0.2, this.uiManager.previewCanvas.height * 0.8);
            this.uiManager.previewCtx.lineTo(this.uiManager.previewCanvas.width * 0.5, this.uiManager.previewCanvas.height * 0.2);
            this.uiManager.previewCtx.lineTo(this.uiManager.previewCanvas.width * 0.8, this.uiManager.previewCanvas.height * 0.8);
            this.uiManager.previewCtx.closePath();
            this.uiManager.previewCtx.stroke();
        } else if (this.currentLayer === 'occlusion' && this.currentTool === 'place') {
            this.uiManager.previewCtx.strokeStyle = 'rgba(0,0,255,0.7)'; // Blue for occlusion
            this.uiManager.previewCtx.fillStyle = 'rgba(0,0,255,0.3)';
            this.uiManager.previewCtx.lineWidth = 2;
            this.uiManager.previewCtx.beginPath();
            this.uiManager.previewCtx.moveTo(this.uiManager.previewCanvas.width * 0.2, this.uiManager.previewCanvas.height * 0.8);
            this.uiManager.previewCtx.lineTo(this.uiManager.previewCanvas.width * 0.5, this.uiManager.previewCanvas.height * 0.2);
            this.uiManager.previewCtx.lineTo(this.uiManager.previewCanvas.width * 0.8, this.uiManager.previewCanvas.height * 0.8);
            this.uiManager.previewCtx.closePath();
            this.uiManager.previewCtx.fill();
            this.uiManager.previewCtx.stroke();
        } else if (this.currentLayer === 'spawn' && this.currentTool === 'place') {
            const selectedSpawnType = this.uiManager.getSelectedSpawnType();
            const colors = SPAWN_TYPE_COLORS[selectedSpawnType] || SPAWN_TYPE_COLORS.default;
            this.uiManager.previewCtx.strokeStyle = colors.stroke;
            this.uiManager.previewCtx.fillStyle = colors.fill;
            this.uiManager.previewCtx.lineWidth = 2;
            this.uiManager.previewCtx.beginPath();
            const previewRadius = Math.min(this.uiManager.previewCanvas.width, this.uiManager.previewCanvas.height) * 0.3;
            this.uiManager.previewCtx.arc(
                this.uiManager.previewCanvas.width / 2, 
                this.uiManager.previewCanvas.height / 2, 
                previewRadius, 
                0, Math.PI * 2
            );
            this.uiManager.previewCtx.fill();
            this.uiManager.previewCtx.stroke();
        }
    }

    async handleMapClick(event) {
        if (!this.isActive) return;

        const canvasRect = this.engine.canvas.getBoundingClientRect();
        const clickX = (event.clientX - canvasRect.left) / this.engine.zoomLevel;
        const clickY = (event.clientY - canvasRect.top) / this.engine.zoomLevel;

        const effectiveCanvasWidth = this.engine.canvas.width / this.engine.zoomLevel;
        const effectiveCanvasHeight = this.engine.canvas.height / this.engine.zoomLevel;
        const viewOriginX = this.map.cameraX - effectiveCanvasWidth / 2;
        const viewOriginY = this.map.cameraY - effectiveCanvasHeight / 2;
        
        let worldX = clickX + viewOriginX;
        let worldY = clickY + viewOriginY;
        
        if (this.currentTool === 'select' || this.currentTool === 'deselect') {
            this.handlePointSelection(worldX, worldY);
            return;
        }
        
        if (this.currentLayer === 'tile') {
            const mapCoords = this.map.screenToMap(worldX, worldY);
            const roundedMapX = Math.floor(mapCoords.x);
            const roundedMapY = Math.floor(mapCoords.y);
            if (!this.selectedTileBrush && this.currentTool === 'place') return;

            if (this.currentTool === 'place') {
                if (roundedMapX >= 0 && roundedMapX < this.map.width &&
                    roundedMapY >= 0 && roundedMapY < this.map.height) {
                    
                    this.saveState();
                    const tileZIndex = (this.selectedTileBrush && this.selectedTileBrush.zIndex !== undefined) ? this.selectedTileBrush.zIndex : 0;
                    const tileIdToPlace = this.map.ensureTileDefinition(
                        this.selectedTileBrush.sourceRect,
                        this.selectedTileBrush.spritesheetIndex,
                        tileZIndex
                    );
                    this.map.setTileId(roundedMapX, roundedMapY, tileIdToPlace);
                } else {
                    console.log("Clicked outside map bounds for tile placement.");
                }
            } else if (this.currentTool === 'erase') {
                if (roundedMapX >= 0 && roundedMapX < this.map.width &&
                    roundedMapY >= 0 && roundedMapY < this.map.height) {
                    this.saveState();
                    this.map.setTileId(roundedMapX, roundedMapY, 0); 
                    console.log(`Erased tile at ${roundedMapX}, ${roundedMapY}`);
                }
            }
        } else if ((this.currentLayer === 'object1' || this.currentLayer === 'object2')) {
            const mapCoords = this.map.screenToMap(worldX, worldY);
            let placementMapX = mapCoords.x;
            let placementMapY = mapCoords.y;

            if (this.snapToGrid) {
                if (this.selectedObjectBrush && this.selectedObjectBrush.isCustomBaked) {
                    placementMapX = Math.floor(mapCoords.x);
                    placementMapY = Math.floor(mapCoords.y);
                } else {
                    placementMapX = Math.floor(mapCoords.x) + 1;
                    placementMapY = Math.floor(mapCoords.y) + 1; 
                }
            }

            if (this.currentTool === 'place' && this.selectedObjectBrush) {
                if (this.selectedObjectBrush.isCustomBaked) {
                    this.placeCustomBakedPrefab(this.selectedObjectBrush, placementMapX, placementMapY);
                    return;
                }
                let finalObjectConfig = { ...this.selectedObjectBrush };
                finalObjectConfig.collidable = this.uiManager.collidableCheckbox.checked;
                finalObjectConfig.disableYSorting = this.uiManager.disableYSortCheckbox ? this.uiManager.disableYSortCheckbox.checked : false;
                finalObjectConfig.zIndex = this.uiManager.objectZIndexInput ? Number(this.uiManager.objectZIndexInput.value) : 0;

                if (this.currentLayer === 'object1' && finalObjectConfig.collidable && !finalObjectConfig.collisionShape) {
                     console.warn("Assigning default diamond collision to object1 object at placement time.");
                     finalObjectConfig.collisionShape = { type: 'polygon', vertices: DEFAULT_OBJECT_DIAMOND_VERTICES };
                }

                if (finalObjectConfig.type === 'note') {
                    const noteText = await CustomDialog.promptNoteText("");
                    if (noteText === null || noteText.trim() === '') return; // User cancelled
                    finalObjectConfig.customData = { text: noteText };
                }
                
                // For object1, the spritesheetIndex is already in the brush.
                // For object2 (from palette), it uses default spritesheet (index 0).
                finalObjectConfig.spritesheetIndex = this.selectedObjectBrush.spritesheetIndex || 0;

                if (finalObjectConfig.type === 'tree') { 
                    const treeSpriteAsset = this.assets.tree;
                    if (treeSpriteAsset) {
                        const treeScaleFactor = 2; 
                        const scaledTreeWidth = treeSpriteAsset.width * treeScaleFactor;
                        const scaledTreeHeight = treeSpriteAsset.height * treeScaleFactor;
                        
                        finalObjectConfig.visualWidth = scaledTreeWidth;
                        finalObjectConfig.visualHeight = scaledTreeHeight;
                        finalObjectConfig.anchorOffsetX = scaledTreeWidth / 2;
                        finalObjectConfig.anchorOffsetY = scaledTreeHeight * 0.95;
                        const treeBaseSpriteWidth = treeSpriteAsset.width * 0.5; 
                        const treeBaseSpriteHeight = treeSpriteAsset.height * 0.2; 
                        const treeCollisionHalfWidth = treeBaseSpriteWidth / 2;
                        const treeCollisionHalfHeight = treeBaseSpriteHeight / 2;
                        finalObjectConfig.collisionShape = { 
                            type: 'polygon', 
                            vertices: [
                                { x: 0, y: -treeCollisionHalfHeight },
                                { x: treeCollisionHalfWidth, y: 0 },
                                { x: 0, y: treeCollisionHalfHeight },
                                { x: -treeCollisionHalfWidth, y: 0 }
                            ]
                        };
                    }
                }
                this.saveState();
                this.map.addGameObject(this.currentLayer, finalObjectConfig, placementMapX, placementMapY);
            } else if (this.currentTool === 'erase') {
                const objectToRemove = this._getObjectAtWorldCoords(worldX, worldY, this.currentLayer);
                if (objectToRemove) {
                    this.saveState();
                    this.map.removeGameObject(objectToRemove);
                    console.log(`Erased object ${objectToRemove.id}`);
                } else {
                    console.log("Eraser: No object found at click location.");
                }
            }
        } else if (this.currentLayer === 'collision' || this.currentLayer === 'occlusion') {
            let vertexToAddX = worldX;
            let vertexToAddY = worldY;

            if (this.snapToGrid && this.currentTool === 'place') {
                const mapCoords = this.map.screenToMap(worldX, worldY);
                // Snap to tile corners (integer map coords) for collision/occlusion polygons
                const snappedMapX = Math.round(mapCoords.x);
                const snappedMapY = Math.round(mapCoords.y);
                const snappedWorldPos = this.map.mapToScreen(snappedMapX, snappedMapY);
                vertexToAddX = snappedWorldPos.x;
                vertexToAddY = snappedWorldPos.y;
            }

            if (this.currentTool === 'place') {
                const newVertex = { x: vertexToAddX, y: vertexToAddY };
                // We don't saveState on individual vertices because they're temporary until finalized.
                this.currentPolygonVertices.push(newVertex);
                console.log(`Added vertex to current ${this.currentLayer} polygon:`, newVertex, "Total:", this.currentPolygonVertices.length);

                if (this.currentPolygonVertices.length >= 3) {
                    const firstVertex = this.currentPolygonVertices[0];
                    const dx = newVertex.x - firstVertex.x;
                    const dy = newVertex.y - firstVertex.y;
                    if ((dx * dx + dy * dy) < POLYGON_CLOSE_DISTANCE_SQ) {
                        this.finalizeCurrentPolygon();
                    }
                }
            } else if (this.currentTool === 'erase') {
                const shapeToRemove = (this.currentLayer === 'collision') ?
                    this.map.findCustomCollisionShapeAt(worldX, worldY) :
                    this.map.findOcclusionShapeAt(worldX, worldY);
                
                if (shapeToRemove) {
                    this.saveState();
                    if (this.currentLayer === 'collision') this.map.removeCustomCollisionShape(shapeToRemove.id);
                    else if (this.currentLayer === 'occlusion') this.map.removeOcclusionShape(shapeToRemove.id);
                    console.log(`Erased ${this.currentLayer} polygon:`, shapeToRemove.id);
                } else {
                    console.log(`Eraser: No ${this.currentLayer} polygon found at click location.`);
                }
            }
        } else if (this.currentLayer === 'spawn') {
            let spawnX = worldX;
            let spawnY = worldY;

            if (this.snapToGrid) {
                // Snap to tile centers for spawn points
                const mapCoords = this.map.screenToMap(worldX, worldY);
                const snappedMapX = Math.floor(mapCoords.x) + 0.5; // Center of tile
                const snappedMapY = Math.floor(mapCoords.y) + 0.5; // Center of tile
                const snappedWorldPos = this.map.mapToScreen(snappedMapX, snappedMapY);
                spawnX = snappedWorldPos.x;
                spawnY = snappedWorldPos.y;
            }

            if (this.currentTool === 'place') {
                const spawnType = this.uiManager.getSelectedSpawnType();
                const spawnData = { x: spawnX, y: spawnY, type: spawnType };
                
                if (spawnType === SPAWN_TYPES.PLAYER_EXIT) {
                    spawnData.targetMap = this.uiManager.getTargetMapValue();
                    const params = this.uiManager.getSelectedEventParams();
                    if (params.eventId) {
                        spawnData.eventId = params.eventId;
                    }
                } else if (spawnType === SPAWN_TYPES.NPC_PERMANENT) {
                    if (this.loadedNpcData) {
                        spawnData.npcData = this.loadedNpcData;
                    } else {
                        CustomDialog.alert("No NPC JSON loaded. Please use the 'Upload NPC' button first.", "NPC Placement Error");
                        return;
                    }
                } else if (spawnType === SPAWN_TYPES.ENEMY) {
                    const selectedEnemyId = this.uiManager.getSelectedEnemyType();
                    if (selectedEnemyId) {
                        spawnData.enemyId = selectedEnemyId;
                    } else {
                        CustomDialog.alert("Please select an enemy type.", "Enemy Type Missing");
                        return;
                    }
                    const params = this.uiManager.getSelectedEventParams();
                    if (params.eventId) {
                        spawnData.eventId = params.eventId;
                        spawnData.triggerType = params.triggerType;
                    }
                    const spawnerSettings = this.uiManager.getSpawnerSettings();
                    if (spawnerSettings.procedural) {
                        spawnData.procedural = true;
                        spawnData.interval = spawnerSettings.interval;
                        spawnData.limit = spawnerSettings.limit;
                    }
                } else if (spawnType === SPAWN_TYPES.EVENT) {
                    const params = this.uiManager.getSelectedEventParams();
                    if (!params.eventId) {
                        CustomDialog.alert("Please create and select a Custom Event first.", "Event Missing");
                        return;
                    }
                    spawnData.eventId = params.eventId;
                    spawnData.triggerType = params.triggerType;
                    spawnData.message = params.message;
                    spawnData.emoji = params.emoji;
                }
                
                this.saveState();
                this.map.addSpawnPoint(spawnData);

            } else if (this.currentTool === 'erase') {
                const pointToRemove = this.map.spawnPointsData.find(pt => {
                    const dx = pt.x - spawnX;
                    const dy = pt.y - spawnY;
                    return (dx * dx + dy * dy) < SPAWN_POINT_RADIUS * SPAWN_POINT_RADIUS * 2;
                });
                if (pointToRemove) {
                    this.saveState();
                    this.map.removeSpawnPointAt(spawnX, spawnY, SPAWN_POINT_RADIUS);
                }
            }
        }
    }

    finalizeCurrentPolygon() {
        if (this.currentPolygonVertices.length >= 3) {
            const lastV = this.currentPolygonVertices[this.currentPolygonVertices.length - 1];
            const firstVertex = this.currentPolygonVertices[0]; 
            const dx = lastV.x - firstVertex.x; 
            const dy = lastV.y - firstVertex.y; 
            if ((dx * dx + dy * dy) < POLYGON_CLOSE_DISTANCE_SQ && this.currentPolygonVertices.length > 1) { 
                this.currentPolygonVertices.pop(); 
            }
            
            if (this.currentPolygonVertices.length >= 3) { 
                this.saveState();
                if (this.currentLayer === 'collision') {
                    this.map.addCustomCollisionShape({ vertices: [...this.currentPolygonVertices] });
                    console.log("Finalized collision polygon with vertices:", this.currentPolygonVertices);
                } else if (this.currentLayer === 'occlusion') {
                    this.map.addOcclusionShape({ vertices: [...this.currentPolygonVertices] });
                    console.log("Finalized occlusion polygon with vertices:", this.currentPolygonVertices);
                }
            } else {
                console.log("Not enough vertices to finalize polygon after removing closing point.");
            }
        } else {
            console.log("Not enough vertices to finalize polygon.");
        }
        this.currentPolygonVertices = []; // Reset for next polygon
    }
    
    handleMouseMove(event) {
        if (!this.isActive) return;

        const canvasRect = this.engine.canvas.getBoundingClientRect();
        const moveX = (event.clientX - canvasRect.left) / this.engine.zoomLevel;
        const moveY = (event.clientY - canvasRect.top) / this.engine.zoomLevel;

        const effectiveCanvasWidth = this.engine.canvas.width / this.engine.zoomLevel;
        const effectiveCanvasHeight = this.engine.canvas.height / this.engine.zoomLevel;
        const viewOriginX = this.map.cameraX - effectiveCanvasWidth / 2;
        const viewOriginY = this.map.cameraY - effectiveCanvasHeight / 2;
        
        const rawWorldX = moveX + viewOriginX;
        const rawWorldY = moveY + viewOriginY;

        if (this.currentTool === 'select') {
            this.currentMouseWorldPos.x = rawWorldX;
            this.currentMouseWorldPos.y = rawWorldY;
            return;
        }

        if (this.currentTool === 'place' && this.snapToGrid) {
            const mapCoords = this.map.screenToMap(rawWorldX, rawWorldY);
            let snappedMapX, snappedMapY;

            if (this.currentLayer === 'collision' || this.currentLayer === 'occlusion') {
                snappedMapX = Math.round(mapCoords.x);
                snappedMapY = Math.round(mapCoords.y);
            } else if (this.currentLayer === 'spawn') {
                snappedMapX = Math.floor(mapCoords.x) + 0.5;
                snappedMapY = Math.floor(mapCoords.y) + 0.5;
            } else if (this.currentLayer === 'tile') {
                snappedMapX = Math.floor(mapCoords.x);
                snappedMapY = Math.floor(mapCoords.y);
            } else if (this.currentLayer === 'object1' || this.currentLayer === 'object2') {
                const brush = this.selectedObjectBrush;
                if (brush && brush.isCustomBaked) {
                    snappedMapX = Math.floor(mapCoords.x);
                    snappedMapY = Math.floor(mapCoords.y);
                } else {
                    snappedMapX = Math.floor(mapCoords.x) + 1;
                    snappedMapY = Math.floor(mapCoords.y) + 1;
                }
            } else {
                 this.currentMouseWorldPos.x = rawWorldX;
                 this.currentMouseWorldPos.y = rawWorldY;
                 return;
            }
            const snappedWorldPos = this.map.mapToScreen(snappedMapX, snappedMapY);
            this.currentMouseWorldPos.x = snappedWorldPos.x;
            this.currentMouseWorldPos.y = snappedWorldPos.y;
        } else {
            this.currentMouseWorldPos.x = rawWorldX;
            this.currentMouseWorldPos.y = rawWorldY;
        }
    }

    _getObjectAtWorldCoords(worldX, worldY, targetLayer) {
        // Check against object's collision shape instead of just anchor point
        const clickPoint = { x: worldX, y: worldY };
        let closestObject = null;
        let minDistanceToAnchorSq = Infinity; // Still use anchor for "closest" tie-breaking if needed

        for (const obj of this.map.getRuntimeGameObjects()) {
            if (obj.layerKey !== targetLayer) continue; 

            if (obj.collidable && obj.collisionShape) {
                const objShape = obj.getCollisionBounds(); // { type, data }
                let hit = false;
                if (objShape.type === 'rectangle') {
                    if (this.map.pointInRectangle(clickPoint, objShape.data)) {
                        hit = true;
                    }
                } else if (objShape.type === 'polygon') {
                    if (this.map.pointInPolygon(clickPoint, objShape.data)) {
                        hit = true;
                    }
                }

                if (hit) {
                    const dx = worldX - obj.currentPixelX;
                    const dy = worldY - obj.currentPixelY;
                    const distanceSq = dx * dx + dy * dy;
                    if (distanceSq < minDistanceToAnchorSq) {
                        closestObject = obj;
                        minDistanceToAnchorSq = distanceSq;
                    }
                }
            } else { 
                 const dx = worldX - obj.currentPixelX;
                 const dy = worldY - obj.currentPixelY;
                 const distanceSq = dx * dx + dy * dy;
                 const CLICK_RADIUS_SQUARED = 20 * 20; 
                 if (distanceSq < CLICK_RADIUS_SQUARED && distanceSq < minDistanceToAnchorSq) {
                     closestObject = obj;
                     minDistanceToAnchorSq = distanceSq;
                 }
            }
        }
        return closestObject;
    }

    selectTool(toolName) {
        if (toolName === this.currentTool) return; 

        this.currentTool = toolName;
        console.log(`Selected tool: ${this.currentTool}`);

        if (this.currentLayer === 'collision' || this.currentLayer === 'occlusion') {
            this.currentPolygonVertices = []; // Clear polygon if tool changes
        }
        this.updateBrushVisuals();
        if (this.uiManager) {
            this.uiManager.updateToolButtonsState();
        }
        this.updateLayerDisplay();

        if (this.engine && this.engine.canvas) {
            if (toolName === 'select' || toolName === 'deselect' || toolName === 'erase') {
                this.engine.canvas.style.cursor = 'crosshair';
            } else {
                this.engine.canvas.style.cursor = 'default';
            }
        }
    }

    toggleSnapToGrid(isSnapping) {
        this.snapToGrid = isSnapping;
        console.log(`Snap to grid: ${this.snapToGrid}`);
        if(this.uiManager && this.uiManager.snapToGridCheckbox) {
            this.uiManager.snapToGridCheckbox.checked = this.snapToGrid;
        }
    }

    renderOverlay(ctx) {
        if (!this.isActive) return;
        ctx.save();
        
        // --- Ghost Preview ---
        if (this.currentTool === 'place' && (this.currentLayer === 'tile' || this.currentLayer === 'object1' || this.currentLayer === 'object2')) {
            const brush = (this.currentLayer === 'tile') ? this.selectedTileBrush : this.selectedObjectBrush;
            
            if (brush && brush.isCustomBaked && brush.customData && Array.isArray(brush.customData.elements)) {
                ctx.save();
                ctx.globalAlpha = 0.5;

                const parentMapCoords = this.map.screenToMap(this.currentMouseWorldPos.x, this.currentMouseWorldPos.y);
                const parentMapX = Math.floor(parentMapCoords.x);
                const parentMapY = Math.floor(parentMapCoords.y);
                const parentWorldPos = this.map.mapToScreen(parentMapX, parentMapY);

                brush.customData.elements.forEach(el => {
                    if (el.type === 'tile') {
                        const tileWorldPos = this.map.mapToScreen(parentMapX + el.relX, parentMapY + el.relY);
                        const halfW = this.map.halfTileWidth;
                        const halfH = this.map.halfTileHeight;

                        // Draw actual tile sprite preview if sourceRect is present
                        const sourceRect = el.sourceRect || this.map.tileDefinitions[el.tileId]?.sourceRect;
                        const spritesheetIndex = el.spritesheetIndex !== undefined ? el.spritesheetIndex : (this.map.tileDefinitions[el.tileId]?.spritesheetIndex || 0);
                        if (sourceRect) {
                            const subAsset = this.spritesheets[spritesheetIndex]?.image || this.map.runtimeSpritesheets[spritesheetIndex];
                            if (subAsset && subAsset.complete) {
                                const imgRenderWidth = sourceRect.width;
                                const imgRenderHeight = sourceRect.height;
                                
                                const imgDrawX = tileWorldPos.x - halfW;
                                let imgDrawY = tileWorldPos.y;
                                if (imgRenderHeight > this.map.tileHeight) {
                                    imgDrawY = tileWorldPos.y - (imgRenderHeight - this.map.tileHeight);
                                }
                                ctx.drawImage(
                                    subAsset,
                                    sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height,
                                    imgDrawX, imgDrawY,
                                    imgRenderWidth, imgRenderHeight
                                );
                            }
                        }

                        ctx.strokeStyle = '#00f0ff';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(tileWorldPos.x, tileWorldPos.y);
                        ctx.lineTo(tileWorldPos.x + halfW, tileWorldPos.y + halfH);
                        ctx.lineTo(tileWorldPos.x, tileWorldPos.y + halfH * 2);
                        ctx.lineTo(tileWorldPos.x - halfW, tileWorldPos.y + halfH);
                        ctx.closePath();
                        ctx.stroke();
                    } else if (el.type === 'object') {
                        const targetWorldPos = this.map.mapToScreen(parentMapX + el.relX, parentMapY + el.relY);
                        const oConfig = el.config || {};
                        let subAsset = null;
                        if (oConfig.spritesheetIndex !== undefined && this.map.runtimeSpritesheets[oConfig.spritesheetIndex]) {
                            subAsset = this.map.runtimeSpritesheets[oConfig.spritesheetIndex];
                        }
                        if (!subAsset && oConfig.spritesheetIndex !== undefined && this.spritesheets[oConfig.spritesheetIndex]) {
                            subAsset = this.spritesheets[oConfig.spritesheetIndex].image;
                        }
                        if (!subAsset && oConfig.assetName) {
                            subAsset = this.assets[oConfig.assetName];
                        }
                        if (subAsset && subAsset.complete) {
                            const rect = oConfig.spriteSourceRect;
                            const drawX = targetWorldPos.x - (oConfig.anchorOffsetX || ((oConfig.visualWidth || 32) / 2));
                            const drawY = targetWorldPos.y - (oConfig.anchorOffsetY || (oConfig.visualHeight || 32));
                            if (rect) {
                                ctx.drawImage(subAsset, rect.x, rect.y, rect.width, rect.height, drawX, drawY, oConfig.visualWidth || rect.width, oConfig.visualHeight || rect.height);
                            } else {
                                ctx.drawImage(subAsset, drawX, drawY, oConfig.visualWidth || 32, oConfig.visualHeight || 32);
                            }
                        }
                    } else if (el.type === 'collision' || el.type === 'occlusion' || el.type === 'light_mask') {
                        ctx.strokeStyle = el.type === 'collision' ? '#ff3333' : (el.type === 'occlusion' ? '#999999' : '#ffea00');
                        ctx.lineWidth = 1.5;
                        if (el.vertices && el.vertices.length > 0) {
                            ctx.beginPath();
                            const v0 = el.vertices[0];
                            ctx.moveTo(parentWorldPos.x + v0.x, parentWorldPos.y + v0.y);
                            for (let i = 1; i < el.vertices.length; i++) {
                                const vi = el.vertices[i];
                                ctx.lineTo(parentWorldPos.x + vi.x, parentWorldPos.y + vi.y);
                            }
                            ctx.closePath();
                            ctx.stroke();
                        }
                    }
                });
                ctx.restore();
            } else if (brush) {
                ctx.save();
                ctx.globalAlpha = 0.5;
                
                let asset;
                if (brush.spritesheetIndex !== undefined && this.spritesheets[brush.spritesheetIndex]) {
                     asset = this.spritesheets[brush.spritesheetIndex].image;
                } else if (brush.assetName) {
                     asset = this.assets[brush.assetName];
                }

                if (asset && asset.complete) {
                    const rect = brush.sourceRect || brush.spriteSourceRect;
                    // Need to adjust position based on anchor offset if it's an object
                    let drawX = this.currentMouseWorldPos.x;
                    let drawY = this.currentMouseWorldPos.y;
                    
                    if (brush.anchorOffsetX) drawX -= brush.anchorOffsetX;
                    if (brush.anchorOffsetY) drawY -= brush.anchorOffsetY;

                    if (rect) {
                        ctx.drawImage(asset, rect.x, rect.y, rect.width, rect.height, drawX, drawY, rect.width, rect.height);
                    } else if (brush.visualWidth && brush.visualHeight) {
                         ctx.drawImage(asset, drawX, drawY, brush.visualWidth, brush.visualHeight);
                    } else {
                        ctx.drawImage(asset, drawX, drawY);
                    }
                }
                ctx.restore();
            }
        }
        // --- END Ghost Preview ---

        // --- Selection Elements Outline Highlight ---
        if (this.selectedElements && this.selectedElements.length > 0) {
            ctx.save();
            ctx.lineWidth = 2;
            
            this.selectedElements.forEach(el => {
                ctx.strokeStyle = '#f1c40f';
                ctx.fillStyle = 'rgba(241, 196, 15, 0.15)';
                
                if (el.type === 'tile') {
                    const screenPos = this.map.mapToScreen(el.mapX, el.mapY);
                    const halfW = this.map.halfTileWidth;
                    const halfH = this.map.halfTileHeight;
                    
                    ctx.beginPath();
                    ctx.moveTo(screenPos.x, screenPos.y);
                    ctx.lineTo(screenPos.x + halfW, screenPos.y + halfH);
                    ctx.lineTo(screenPos.x, screenPos.y + halfH * 2);
                    ctx.lineTo(screenPos.x - halfW, screenPos.y + halfH);
                    ctx.closePath();
                    ctx.stroke();
                    ctx.fill();
                } else if (el.type === 'object') {
                    const liveObj = this.map.runtimeGameObjects.find(o => o.id === el.id);
                    if (liveObj) {
                        const rectX = liveObj.currentPixelX - (liveObj.anchorOffsetX || (liveObj.visualWidth / 2));
                        const rectY = liveObj.currentPixelY - (liveObj.anchorOffsetY || liveObj.visualHeight);
                        ctx.strokeRect(rectX, rectY, liveObj.visualWidth, liveObj.visualHeight);
                        ctx.fillRect(rectX, rectY, liveObj.visualWidth, liveObj.visualHeight);
                    }
                } else if (el.type === 'collision' || el.type === 'occlusion' || el.type === 'light_mask') {
                    if (el.vertices && el.vertices.length > 0) {
                        ctx.beginPath();
                        ctx.moveTo(el.vertices[0].x, el.vertices[0].y);
                        for (let i = 1; i < el.vertices.length; i++) {
                            ctx.lineTo(el.vertices[i].x, el.vertices[i].y);
                        }
                        ctx.closePath();
                        ctx.stroke();
                        ctx.fill();
                    }
                } else if (el.type === 'spawn') {
                    ctx.beginPath();
                    ctx.arc(el.x, el.y, SPAWN_POINT_RADIUS + 3, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.fill();
                }
            });
            ctx.restore();
        }

        // --- Drag Marquee Selection Box ---
        if ((this.currentTool === 'select' || this.currentTool === 'deselect') && this.isSelectingDrag && this.dragStartWorldPos) {
            ctx.save();
            ctx.strokeStyle = this.currentTool === 'deselect' ? '#e74c3c' : '#f1c40f';
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1.5;
            ctx.fillStyle = this.currentTool === 'deselect' ? 'rgba(231, 76, 60, 0.1)' : 'rgba(241, 196, 15, 0.1)';
            
            const rx = this.dragStartWorldPos.x;
            const ry = this.dragStartWorldPos.y;
            const rw = this.currentMouseWorldPos.x - rx;
            const rh = this.currentMouseWorldPos.y - ry;
            
            ctx.strokeRect(rx, ry, rw, rh);
            ctx.fillRect(rx, ry, rw, rh);
            ctx.restore();
        }

        // --- Eraser Preview ---
        if (this.currentTool === 'erase') {
            ctx.save();
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = 'red';
            
            if (this.currentLayer === 'tile') {
                const mapCoords = this.map.screenToMap(this.currentMouseWorldPos.x, this.currentMouseWorldPos.y);
                const tileX = Math.floor(mapCoords.x);
                const tileY = Math.floor(mapCoords.y);
                
                if (tileX >= 0 && tileX < this.map.width && tileY >= 0 && tileY < this.map.height) {
                    const screenPos = this.map.mapToScreen(tileX, tileY);
                    const halfW = this.map.halfTileWidth;
                    const halfH = this.map.halfTileHeight;
                    
                    ctx.beginPath();
                    ctx.moveTo(screenPos.x, screenPos.y);
                    ctx.lineTo(screenPos.x + halfW, screenPos.y + halfH);
                    ctx.lineTo(screenPos.x, screenPos.y + halfH * 2);
                    ctx.lineTo(screenPos.x - halfW, screenPos.y + halfH);
                    ctx.closePath();
                    ctx.fill();
                }
            } else if (this.currentLayer === 'object1' || this.currentLayer === 'object2') {
                const object = this._getObjectAtWorldCoords(this.currentMouseWorldPos.x, this.currentMouseWorldPos.y, this.currentLayer);
                if (object) {
                     // Draw over the object's estimated footprint
                     const rectX = object.currentPixelX - (object.visualWidth || 64) / 2;
                     const rectY = object.currentPixelY - (object.visualHeight || 64);
                     ctx.fillRect(rectX, rectY, object.visualWidth || 64, object.visualHeight || 64);
                }
            } else if (this.currentLayer === 'collision' || this.currentLayer === 'occlusion') {
                const shape = (this.currentLayer === 'collision') ?
                    this.map.findCustomCollisionShapeAt(this.currentMouseWorldPos.x, this.currentMouseWorldPos.y) :
                    this.map.findOcclusionShapeAt(this.currentMouseWorldPos.x, this.currentMouseWorldPos.y);
                
                if (shape) {
                    ctx.beginPath();
                    ctx.moveTo(shape.vertices[0].x, shape.vertices[0].y);
                    for (let i = 1; i < shape.vertices.length; i++) {
                        ctx.lineTo(shape.vertices[i].x, shape.vertices[i].y);
                    }
                    ctx.closePath();
                    ctx.fill();
                }
            }
            ctx.restore();
        }
        // --- END Eraser Preview ---

        // Draw Grid Lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1 / this.engine.zoomLevel; 

        const mapPixelWidth = (this.map.width + this.map.height) * this.map.halfTileWidth;
        const mapPixelHeight = (this.map.width + this.map.height) * this.map.halfTileHeight;

        for (let i = 0; i <= this.map.width; i++) { 
            const start = this.map.mapToScreen(i, 0);
            const end = this.map.mapToScreen(i, this.map.height);
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        }
        for (let j = 0; j <= this.map.height; j++) { 
            const start = this.map.mapToScreen(0, j);
            const end = this.map.mapToScreen(this.map.width, j);
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        }

        // --- Collision Layer Specific Drawing ---
        if (this.currentLayer === 'collision') {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'; 
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
            ctx.lineWidth = 1.5 / this.engine.zoomLevel;

            // Draw collision bounds of GameObjects
            for (const obj of this.map.getRuntimeGameObjects()) {
                if (obj.collidable && obj.collisionShape) { 
                    const shape = obj.getCollisionBounds(); // { type, data }
                    if (shape) {
                        ctx.beginPath();
                        if (shape.type === 'rectangle') {
                            ctx.rect(shape.data.x, shape.data.y, shape.data.width, shape.data.height);
                        } else if (shape.type === 'polygon') {
                            ctx.moveTo(shape.data[0].x, shape.data[0].y);
                            for (let i = 1; i < shape.data.length; i++) {
                                ctx.lineTo(shape.data[i].x, shape.data[i].y);
                            }
                            ctx.closePath();
                        }
                        ctx.fill();
                        ctx.stroke();
                    }
                }
            }

            // Draw custom collision polygons from map.collisionLayerData
            for (const shape of this.map.collisionLayerData) { 
                if (shape.vertices.length > 1) {
                    ctx.beginPath();
                    ctx.moveTo(shape.vertices[0].x, shape.vertices[0].y);
                    for (let i = 1; i < shape.vertices.length; i++) {
                        ctx.lineTo(shape.vertices[i].x, shape.vertices[i].y);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                }
            }
        }

        // --- Occlusion Layer Specific Drawing ---
        if (this.currentLayer === 'occlusion') {
            ctx.fillStyle = 'rgba(0, 0, 255, 0.3)';   // Blue for occlusion
            ctx.strokeStyle = 'rgba(0, 0, 255, 0.7)';
            ctx.lineWidth = 1.5 / this.engine.zoomLevel;

            for (const shape of this.map.occlusionLayerData) { // shape is { id, vertices: [{x,y},...] }
                if (shape.vertices.length > 1) {
                    ctx.beginPath();
                    ctx.moveTo(shape.vertices[0].x, shape.vertices[0].y);
                    for (let i = 1; i < shape.vertices.length; i++) {
                        ctx.lineTo(shape.vertices[i].x, shape.vertices[i].y);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                }
            }
        }
        
        // --- Ghost Preview for Start Point ---
        if ((this.currentLayer === 'collision' || this.currentLayer === 'occlusion') && this.currentPolygonVertices.length === 0 && this.currentTool === 'place') {
            const isCollision = this.currentLayer === 'collision';
            ctx.fillStyle = isCollision ? 'rgba(255, 0, 0, 0.5)' : 'rgba(0, 0, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(this.currentMouseWorldPos.x, this.currentMouseWorldPos.y, 5 / this.engine.zoomLevel, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Polygon Preview for Collision or Occlusion Layer ---
        if ((this.currentLayer === 'collision' || this.currentLayer === 'occlusion') && this.currentPolygonVertices.length > 0 && this.currentTool === 'place') {
            const isCollision = this.currentLayer === 'collision';
            ctx.strokeStyle = isCollision ? 'rgba(255, 0, 0, 0.5)' : 'rgba(0, 0, 255, 0.5)';
            ctx.fillStyle = isCollision ? 'rgba(255, 0, 0, 0.2)' : 'rgba(0, 0, 255, 0.2)';

            ctx.beginPath();
            ctx.moveTo(this.currentPolygonVertices[0].x, this.currentPolygonVertices[0].y);
            for (let i = 1; i < this.currentPolygonVertices.length; i++) {
                ctx.lineTo(this.currentPolygonVertices[i].x, this.currentPolygonVertices[i].y);
            }
            ctx.lineTo(this.currentMouseWorldPos.x, this.currentMouseWorldPos.y);
            
            if (this.currentPolygonVertices.length >= 2) { 
                 ctx.lineTo(this.currentPolygonVertices[0].x, this.currentPolygonVertices[0].y);
            }

            if (this.currentPolygonVertices.length >= 2) { 
                ctx.fill();
            }
            ctx.stroke();

            ctx.fillStyle = isCollision ? 'rgba(255, 100, 100, 0.8)' : 'rgba(100, 100, 255, 0.8)';
            for (const vertex of this.currentPolygonVertices) {
                ctx.beginPath();
                ctx.arc(vertex.x, vertex.y, 3 / this.engine.zoomLevel, 0, Math.PI * 2);
                ctx.fill();
            }
            if (this.currentPolygonVertices.length >=2) {
                const firstVertex = this.currentPolygonVertices[0];
                const dx = this.currentMouseWorldPos.x - firstVertex.x; 
                const dy = this.currentMouseWorldPos.y - firstVertex.y;
                 if ((dx * dx + dy * dy) < POLYGON_CLOSE_DISTANCE_SQ) {
                    ctx.fillStyle = 'rgba(100, 255, 100, 0.9)'; 
                    ctx.beginPath();
                    ctx.arc(firstVertex.x, firstVertex.y, 5 / this.engine.zoomLevel, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // --- Spawn Layer Specific Drawing ---
        if (this.currentLayer === 'spawn') {
            ctx.lineWidth = 1.5 / this.engine.zoomLevel;

            for (const point of this.map.spawnPointsData) {
                const colors = SPAWN_TYPE_COLORS[point.type] || SPAWN_TYPE_COLORS.default;
                ctx.fillStyle = colors.fill;
                ctx.strokeStyle = colors.stroke;
                
                ctx.beginPath();
                ctx.arc(point.x, point.y, SPAWN_POINT_RADIUS / this.engine.zoomLevel, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                if (point.type === SPAWN_TYPES.EVENT && point.emoji) {
                    ctx.save();
                    ctx.font = `${14 / this.engine.zoomLevel}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(point.emoji, point.x, point.y);
                    ctx.restore();
                }

                // Optionally, draw a small letter or icon for type if desired
                // ctx.fillStyle = 'black';
                // ctx.font = `${8 / this.engine.zoomLevel}px Arial`;
                // ctx.textAlign = 'center';
                // ctx.textBaseline = 'middle';
                // let typeInitial = point.type.substring(0,1).toUpperCase();
                // if (point.type === SPAWN_TYPES.PLAYER_ENTRY) typeInitial = "E↓";
                // if (point.type === SPAWN_TYPES.PLAYER_EXIT) typeInitial = "E↑";
                // ctx.fillText(typeInitial, point.x, point.y);
            }

            // Draw preview of spawn point at mouse if placing
            if (this.currentTool === 'place') {
                const selectedSpawnType = this.uiManager.getSelectedSpawnType();
                const previewColors = SPAWN_TYPE_COLORS[selectedSpawnType] || SPAWN_TYPE_COLORS.default;
                ctx.fillStyle = previewColors.fill;
                ctx.strokeStyle = previewColors.stroke;

                ctx.beginPath();
                ctx.arc(this.currentMouseWorldPos.x, this.currentMouseWorldPos.y, SPAWN_POINT_RADIUS / this.engine.zoomLevel, 0, Math.PI * 2);
                ctx.globalAlpha = 0.7;
                ctx.fill();
                ctx.stroke();
                ctx.globalAlpha = 1.0;

                if (selectedSpawnType === SPAWN_TYPES.NPC_PERMANENT && this.loadedNpcData) {
                    ctx.fillStyle = 'white';
                    ctx.font = `${10 / this.engine.zoomLevel}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.fillText(this.loadedNpcData.name, this.currentMouseWorldPos.x, this.currentMouseWorldPos.y - (15 / this.engine.zoomLevel));
                }
            }
        }

        // --- Custom Cursor badges for selection and deselection ---
        if (this.currentTool === 'select' || this.currentTool === 'deselect' || this.currentTool === 'erase') {
            ctx.save();
            const cx = this.currentMouseWorldPos.x + 14 / this.engine.zoomLevel;
            const cy = this.currentMouseWorldPos.y + 14 / this.engine.zoomLevel;
            
            // Draw a subtle dark pill container
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.strokeStyle = this.currentTool === 'select' ? '#2ecc71' : (this.currentTool === 'deselect' ? '#e74c3c' : '#95a5a6');
            ctx.lineWidth = 1 / this.engine.zoomLevel;
            
            const pWidth = 56 / this.engine.zoomLevel;
            const pHeight = 16 / this.engine.zoomLevel;
            const radius = 4 / this.engine.zoomLevel;
            
            // Draw rounded rect
            ctx.beginPath();
            ctx.moveTo(cx + radius, cy);
            ctx.lineTo(cx + pWidth - radius, cy);
            ctx.quadraticCurveTo(cx + pWidth, cy, cx + pWidth, cy + radius);
            ctx.lineTo(cx + pWidth, cy + pHeight - radius);
            ctx.quadraticCurveTo(cx + pWidth, cy + pHeight, cx + pWidth - radius, cy + pHeight);
            ctx.lineTo(cx + radius, cy + pHeight);
            ctx.quadraticCurveTo(cx, cy + pHeight, cx, cy + pHeight - radius);
            ctx.lineTo(cx, cy + radius);
            ctx.quadraticCurveTo(cx, cy, cx + radius, cy);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            // Draw text indicator
            ctx.fillStyle = '#ffffff';
            ctx.font = `${8.5 / this.engine.zoomLevel}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const labelText = this.currentTool === 'select' ? '🔍 SEL+' : (this.currentTool === 'deselect' ? '❌ DES-' : '🗑️ DEL');
            ctx.fillText(labelText, cx + pWidth / 2, cy + pHeight / 2);
            ctx.restore();
        }

        ctx.restore();
    }

    saveState() {
        if (!this.map) return;
        const serialized = this.map.serialize();
        const copy = JSON.parse(JSON.stringify(serialized));
        this.undoStack.push(copy);
        if (this.undoStack.length > 100) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }

    async undo() {
        if (this.undoStack.length === 0) {
            console.log("Nothing to undo.");
            return;
        }
        const currentState = JSON.parse(JSON.stringify(this.map.serialize()));
        this.redoStack.push(currentState);
        
        const prevState = this.undoStack.pop();
        await this.map.deserialize(prevState);
        
        // Re-align objects list in the engine
        this.engine.gameObjects = this.map.getRuntimeGameObjects();
        this.engine.lightSystem.updateData(this.map.getLightingData());
        
        console.log("Undo success. Stack sizes: Undo:", this.undoStack.length, "Redo:", this.redoStack.length);
        this.updateBrushVisuals();
    }

    async redo() {
        if (this.redoStack.length === 0) {
            console.log("Nothing to redo.");
            return;
        }
        const currentState = JSON.parse(JSON.stringify(this.map.serialize()));
        this.undoStack.push(currentState);
        
        const nextState = this.redoStack.pop();
        await this.map.deserialize(nextState);
        
        // Re-align objects list in the engine
        this.engine.gameObjects = this.map.getRuntimeGameObjects();
        this.engine.lightSystem.updateData(this.map.getLightingData());

        console.log("Redo success. Stack sizes: Undo:", this.undoStack.length, "Redo:", this.redoStack.length);
        this.updateBrushVisuals();
    }

    clearHistory() {
        this.undoStack = [];
        this.redoStack = [];
    }

    handleKeyDown(event) {
        if (!this.isActive) return;
        
        // Don't intercept when writing text inside inputs/textareas
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }

        // Support Esc to cancel current polygon drawing
        if (event.key === 'Escape') {
             this.currentPolygonVertices = [];
             console.log("Cancelled current polygon drawing.");
        }

        // Support Ctrl+Z / Cmd+Z (Undo)
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
            event.preventDefault();
            this.undo();
        }
        // Support Ctrl+Y / Cmd+Y (Redo)
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
            event.preventDefault();
            this.redo();
        }
    }

    handleMouseDown(event) {
        if (!this.isActive || (this.currentTool !== 'select' && this.currentTool !== 'deselect')) return;

        const canvasRect = this.engine.canvas.getBoundingClientRect();
        const mouseX = (event.clientX - canvasRect.left) / this.engine.zoomLevel;
        const mouseY = (event.clientY - canvasRect.top) / this.engine.zoomLevel;

        const effectiveCanvasWidth = this.engine.canvas.width / this.engine.zoomLevel;
        const effectiveCanvasHeight = this.engine.canvas.height / this.engine.zoomLevel;
        const viewOriginX = this.map.cameraX - effectiveCanvasWidth / 2;
        const viewOriginY = this.map.cameraY - effectiveCanvasHeight / 2;

        this.dragStartWorldPos = {
            x: mouseX + viewOriginX,
            y: mouseY + viewOriginY
        };
        this.isSelectingDrag = true;
    }

    handleMouseUp(event) {
        if (!this.isActive || !this.isSelectingDrag || !this.dragStartWorldPos) return;
        this.isSelectingDrag = false;

        const canvasRect = this.engine.canvas.getBoundingClientRect();
        const mouseX = (event.clientX - canvasRect.left) / this.engine.zoomLevel;
        const mouseY = (event.clientY - canvasRect.top) / this.engine.zoomLevel;

        const effectiveCanvasWidth = this.engine.canvas.width / this.engine.zoomLevel;
        const effectiveCanvasHeight = this.engine.canvas.height / this.engine.zoomLevel;
        const viewOriginX = this.map.cameraX - effectiveCanvasWidth / 2;
        const viewOriginY = this.map.cameraY - effectiveCanvasHeight / 2;

        const dragEndWorldPos = {
            x: mouseX + viewOriginX,
            y: mouseY + viewOriginY
        };

        const dx = Math.abs(dragEndWorldPos.x - this.dragStartWorldPos.x);
        const dy = Math.abs(dragEndWorldPos.y - this.dragStartWorldPos.y);

        if (dx > 5 || dy > 5) {
            // It's a drag area selection! Let's collect all elements in the box
            this.handleAreaSelection(this.dragStartWorldPos, dragEndWorldPos);
        }

        this.dragStartWorldPos = null;
    }

    handlePointSelection(worldX, worldY) {
        const found = [];

        // 1. Tile Check (under mouse screen position)
        const mapCoords = this.map.screenToMap(worldX, worldY);
        const tx = Math.floor(mapCoords.x);
        const ty = Math.floor(mapCoords.y);
        if (tx >= 0 && tx < this.map.width && ty >= 0 && ty < this.map.height) {
            const tileId = this.map.getTileId(tx, ty);
            if (tileId > 0) {
                found.push({
                    type: 'tile',
                    mapX: tx,
                    mapY: ty,
                    tileId: tileId
                });
            }
        }

        // 2. Game Objects
        this.map.runtimeGameObjects.forEach(obj => {
            const dx = worldX - obj.currentPixelX;
            const dy = worldY - obj.currentPixelY;
            if (Math.abs(dx) < (obj.visualWidth || 32) / 2 && dy < 0 && dy > -(obj.visualHeight || 32)) {
                found.push({
                    type: 'object',
                    id: obj.id,
                    layerKey: obj.layerKey,
                    mapX: obj.mapX,
                    mapY: obj.mapY,
                    displayName: obj.type,
                    assetName: obj.assetName,
                    config: {
                        type: obj.type,
                        assetName: obj.assetName,
                        spritesheetIndex: obj.spritesheetIndex,
                        spriteSourceRect: obj.spriteSourceRect,
                        visualWidth: obj.visualWidth,
                        visualHeight: obj.visualHeight,
                        anchorOffsetX: obj.anchorOffsetX,
                        anchorOffsetY: obj.anchorOffsetY,
                        collidable: obj.collidable,
                        collisionShape: obj.originalCollisionShape || obj.collisionShape,
                        zIndex: obj.zIndex,
                        disableYSorting: obj.disableYSorting,
                        customData: obj.customData
                    }
                });
            }
        });

        // 3. Collision boundary curves
        const collisionShape = this.map.findCustomCollisionShapeAt(worldX, worldY);
        if (collisionShape) {
            found.push({
                type: 'collision',
                id: collisionShape.id,
                vertices: collisionShape.vertices
            });
        }

        // 4. Overpass occlusion shapes
        const occlusionShape = this.map.findOcclusionShapeAt(worldX, worldY);
        if (occlusionShape) {
            found.push({
                type: 'occlusion',
                id: occlusionShape.id,
                vertices: occlusionShape.vertices
            });
        }

        // 5. Spawn points
        this.map.spawnPointsData.forEach(pt => {
            const dx = worldX - pt.x;
            const dy = worldY - pt.y;
            if (dx * dx + dy * dy < SPAWN_POINT_RADIUS * SPAWN_POINT_RADIUS) {
                found.push({
                    type: 'spawn',
                    id: pt.id,
                    x: pt.x,
                    y: pt.y,
                    spawnType: pt.type,
                    targetMap: pt.targetMap,
                    npcData: pt.npcData,
                    enemyId: pt.enemyId
                });
            }
        });

        // 6. Lighting / Darkness layers
        const lightMask = this._getLightMaskAt(worldX, worldY);
        if (lightMask) {
            found.push({
                type: 'light_mask',
                id: lightMask.id,
                maskType: lightMask.type,
                vertices: lightMask.vertices,
                color: lightMask.color,
                intensity: lightMask.intensity,
                blur: lightMask.blur,
                blendMode: lightMask.blendMode,
                smoothing: lightMask.smoothing,
                flicker: lightMask.flicker
            });
        }

        if (this.currentTool === 'deselect') {
            found.forEach(item => {
                this.selectedElements = this.selectedElements.filter(el => {
                    if (el.type === 'tile' && item.type === 'tile') {
                        return !(el.mapX === item.mapX && el.mapY === item.mapY);
                    }
                    if (el.id && item.id && el.id === item.id) {
                        return false;
                    }
                    return true;
                });
            });
        } else {
            found.forEach(item => {
                const exists = this.selectedElements.some(el => {
                    if (el.type === 'tile' && item.type === 'tile') {
                        return el.mapX === item.mapX && el.mapY === item.mapY;
                    }
                    return el.id && item.id && el.id === item.id;
                });
                if (!exists) {
                    this.selectedElements.push(item);
                }
            });
        }

        this.uiManager.updateSelectionListUI(this.selectedElements);
    }

    handleAreaSelection(start, end) {
        const xMin = Math.min(start.x, end.x);
        const xMax = Math.max(start.x, end.x);
        const yMin = Math.min(start.y, end.y);
        const yMax = Math.max(start.y, end.y);

        if (this.currentTool === 'deselect') {
            this.selectedElements = this.selectedElements.filter(el => {
                if (el.type === 'tile') {
                    const screen = this.map.mapToScreen(el.mapX + 0.5, el.mapY + 0.5);
                    const inside = (screen.x >= xMin && screen.x <= xMax && screen.y >= yMin && screen.y <= yMax);
                    return !inside;
                }
                if (el.type === 'object') {
                    const obj = this.map.runtimeGameObjects.find(o => o.id === el.id);
                    if (obj) {
                        const inside = (obj.currentPixelX >= xMin && obj.currentPixelX <= xMax && obj.currentPixelY >= yMin && obj.currentPixelY <= yMax);
                        return !inside;
                    }
                    return true;
                }
                if (el.type === 'collision' || el.type === 'occlusion' || el.type === 'light_mask') {
                    const inside = el.vertices && el.vertices.some(v => v.x >= xMin && v.x <= xMax && v.y >= yMin && v.y <= yMax);
                    return !inside;
                }
                if (el.type === 'spawn') {
                    const inside = (el.x >= xMin && el.x <= xMax && el.y >= yMin && el.y <= yMax);
                    return !inside;
                }
                return true;
            });
            this.uiManager.updateSelectionListUI(this.selectedElements);
            return;
        }

        // 1. Scan tiles which reside inside box coordinates
        for (let x = 0; x < this.map.width; x++) {
            for (let y = 0; y < this.map.height; y++) {
                const screen = this.map.mapToScreen(x + 0.5, y + 0.5);
                if (screen.x >= xMin && screen.x <= xMax && screen.y >= yMin && screen.y <= yMax) {
                    const tileId = this.map.getTileId(x, y);
                    if (tileId > 0) {
                        const exists = this.selectedElements.some(el => el.type === 'tile' && el.mapX === x && el.mapY === y);
                        if (!exists) {
                            this.selectedElements.push({
                                type: 'tile',
                                mapX: x,
                                mapY: y,
                                tileId: tileId
                            });
                        }
                    }
                }
            }
        }

        // 2. Objects
        this.map.runtimeGameObjects.forEach(obj => {
            if (obj.currentPixelX >= xMin && obj.currentPixelX <= xMax && obj.currentPixelY >= yMin && obj.currentPixelY <= yMax) {
                const exists = this.selectedElements.some(el => el.type === 'object' && el.id === obj.id);
                if (!exists) {
                    this.selectedElements.push({
                        type: 'object',
                        id: obj.id,
                        layerKey: obj.layerKey,
                        mapX: obj.mapX,
                        mapY: obj.mapY,
                        displayName: obj.type,
                        assetName: obj.assetName,
                        config: {
                            type: obj.type,
                            assetName: obj.assetName,
                            spritesheetIndex: obj.spritesheetIndex,
                            spriteSourceRect: obj.spriteSourceRect,
                            visualWidth: obj.visualWidth,
                            visualHeight: obj.visualHeight,
                            anchorOffsetX: obj.anchorOffsetX,
                            anchorOffsetY: obj.anchorOffsetY,
                            collidable: obj.collidable,
                            collisionShape: obj.originalCollisionShape || obj.collisionShape,
                            zIndex: obj.zIndex,
                            disableYSorting: obj.disableYSorting,
                            customData: obj.customData
                        }
                    });
                }
            }
        });

        // 3. Custom Physics polygon collisions
        this.map.collisionLayerData.forEach(shape => {
            const anyVertexIn = shape.vertices.some(v => v.x >= xMin && v.x <= xMax && v.y >= yMin && v.y <= yMax);
            if (anyVertexIn) {
                const exists = this.selectedElements.some(el => el.type === 'collision' && el.id === shape.id);
                if (!exists) {
                    this.selectedElements.push({
                        type: 'collision',
                        id: shape.id,
                        vertices: shape.vertices
                    });
                }
            }
        });

        // 4. Occlusion Shapes
        this.map.occlusionLayerData.forEach(shape => {
            const anyVertexIn = shape.vertices.some(v => v.x >= xMin && v.x <= xMax && v.y >= yMin && v.y <= yMax);
            if (anyVertexIn) {
                const exists = this.selectedElements.some(el => el.type === 'occlusion' && el.id === shape.id);
                if (!exists) {
                    this.selectedElements.push({
                        type: 'occlusion',
                        id: shape.id,
                        vertices: shape.vertices
                    });
                }
            }
        });

        // 5. Spawners
        this.map.spawnPointsData.forEach(pt => {
            if (pt.x >= xMin && pt.x <= xMax && pt.y >= yMin && pt.y <= yMax) {
                const exists = this.selectedElements.some(el => el.type === 'spawn' && el.id === pt.id);
                if (!exists) {
                    this.selectedElements.push({
                        type: 'spawn',
                        id: pt.id,
                        x: pt.x,
                        y: pt.y,
                        spawnType: pt.type,
                        targetMap: pt.targetMap,
                        npcData: pt.npcData,
                        enemyId: pt.enemyId
                    });
                }
            }
        });

        // 6. Lighting polylines
        if (this.map.lightingData && Array.isArray(this.map.lightingData.masks)) {
            this.map.lightingData.masks.forEach(mask => {
                const anyVertexIn = mask.vertices.some(v => v.x >= xMin && v.x <= xMax && v.y >= yMin && v.y <= yMax);
                if (anyVertexIn) {
                    const exists = this.selectedElements.some(el => el.type === 'light_mask' && el.id === mask.id);
                    if (!exists) {
                        this.selectedElements.push({
                            type: 'light_mask',
                            id: mask.id,
                            maskType: mask.type,
                            vertices: mask.vertices,
                            color: mask.color,
                            intensity: mask.intensity,
                            blur: mask.blur,
                            blendMode: mask.blendMode,
                            smoothing: mask.smoothing,
                            flicker: mask.flicker
                        });
                    }
                }
            });
        }

        this.uiManager.updateSelectionListUI(this.selectedElements);
    }

    _getLightMaskAt(worldX, worldY) {
        if (!this.map.lightingData || !Array.isArray(this.map.lightingData.masks)) return null;
        for (let i = this.map.lightingData.masks.length - 1; i >= 0; i--) {
            const mask = this.map.lightingData.masks[i];
            if (mask.vertices && this._pointInPolygon({ x: worldX, y: worldY }, mask.vertices)) {
                return mask;
            }
        }
        return null;
    }

    _pointInPolygon(point, vs) {
        if (!vs || vs.length < 3) return false;
        const x = point.x, y = point.y;
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            const xi = vs[i].x, yi = vs[i].y;
            const xj = vs[j].x, yj = vs[j].y;
            const intersect = ((yi > y) !== (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    clearSelection() {
        this.selectedElements = [];
        this.uiManager.updateSelectionListUI(this.selectedElements);
    }

    deselectElement(index) {
        if (index >= 0 && index < this.selectedElements.length) {
            this.selectedElements.splice(index, 1);
            this.uiManager.updateSelectionListUI(this.selectedElements);
        }
    }

    async bakeSelectionToPrefab() {
        if (this.selectedElements.length === 0) {
            CustomDialog.alert("Please select elements first using the Selection Tool (🔍).", "No Selection");
            return;
        }

        const rawName = await CustomDialog.prompt("Enter name for custom Object2 Room Prefab:", "cozy_dungeon_room", "Bake Prefab");
        if (!rawName || rawName.trim() === '') return;

        const prefabName = rawName.trim();
        const prefabKey = `baked_prefab_${prefabName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;

        // Find min/max coordinate ranges of selected elements
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        this.selectedElements.forEach(el => {
            if (el.type === 'tile' || el.type === 'object') {
                const screen = this.map.mapToScreen(el.mapX, el.mapY);
                minX = Math.min(minX, screen.x);
                maxX = Math.max(maxX, screen.x);
                minY = Math.min(minY, screen.y);
                maxY = Math.max(maxY, screen.y);
            } else if (el.type === 'spawn') {
                minX = Math.min(minX, el.x);
                maxX = Math.max(maxX, el.x);
                minY = Math.min(minY, el.y);
                maxY = Math.max(maxY, el.y);
            } else if (el.type === 'collision' || el.type === 'occlusion' || el.type === 'light_mask') {
                el.vertices.forEach(v => {
                    minX = Math.min(minX, v.x);
                    maxX = Math.max(maxX, v.x);
                    minY = Math.min(minY, v.y);
                    maxY = Math.max(maxY, v.y);
                });
            }
        });

        // Find parent grid anchor mapping by calculating the exact average map coordinates of building blocks
        let sumMapX = 0, sumMapY = 0, countGrid = 0;
        this.selectedElements.forEach(el => {
            if (el.type === 'tile' || el.type === 'object') {
                sumMapX += el.mapX;
                sumMapY += el.mapY;
                countGrid++;
            }
        });

        let snappedGridX = 0;
        let snappedGridY = 0;
        if (countGrid > 0) {
            snappedGridX = Math.round(sumMapX / countGrid);
            snappedGridY = Math.round(sumMapY / countGrid);
        } else {
            // Fallback grid mapping anchor using visual screen coordinates
            const midWorldX = (minX + maxX) / 2;
            const midWorldY = (minY + maxY) / 2;
            const gridAnchor = this.map.screenToMap(midWorldX, midWorldY);
            snappedGridX = Math.round(gridAnchor.x);
            snappedGridY = Math.round(gridAnchor.y);
        }
        const anchorWorldPos = this.map.mapToScreen(snappedGridX, snappedGridY);

        const elementsData = [];

        this.selectedElements.forEach(el => {
            if (el.type === 'tile') {
                const tileDef = this.map.tileDefinitions[el.tileId] || {};
                elementsData.push({
                    type: 'tile',
                    relX: el.mapX - snappedGridX,
                    relY: el.mapY - snappedGridY,
                    tileId: el.tileId,
                    sourceRect: tileDef.sourceRect || null,
                    spritesheetIndex: tileDef.spritesheetIndex !== undefined ? tileDef.spritesheetIndex : 0,
                    zIndex: tileDef.zIndex !== undefined ? tileDef.zIndex : 0
                });
            } else if (el.type === 'object') {
                elementsData.push({
                    type: 'object',
                    layerKey: el.layerKey,
                    relX: el.mapX - snappedGridX,
                    relY: el.mapY - snappedGridY,
                    config: el.config
                });
            } else if (el.type === 'spawn') {
                elementsData.push({
                    type: 'spawn',
                    relX: el.x - anchorWorldPos.x,
                    relY: el.y - anchorWorldPos.y,
                    pointType: el.spawnType,
                    targetMap: el.targetMap,
                    npcData: el.npcData,
                    enemyId: el.enemyId
                });
            } else if (el.type === 'collision') {
                elementsData.push({
                    type: 'collision',
                    vertices: el.vertices.map(v => ({
                        x: v.x - anchorWorldPos.x,
                        y: v.y - anchorWorldPos.y
                    }))
                });
            } else if (el.type === 'occlusion') {
                elementsData.push({
                    type: 'occlusion',
                    vertices: el.vertices.map(v => ({
                        x: v.x - anchorWorldPos.x,
                        y: v.y - anchorWorldPos.y
                    }))
                });
            } else if (el.type === 'light_mask') {
                elementsData.push({
                    type: 'light_mask',
                    maskType: el.maskType,
                    vertices: el.vertices.map(v => ({
                        x: v.x - anchorWorldPos.x,
                        y: v.y - anchorWorldPos.y
                    })),
                    color: el.color,
                    intensity: el.intensity,
                    blur: el.blur,
                    blendMode: el.blendMode,
                    smoothing: el.smoothing,
                    flicker: el.flicker
                });
            }
        });

        const bakedDefinition = {
            type: 'baked_prefab',
            displayName: prefabName,
            assetName: prefabKey,
            isCustomBaked: true,
            customData: {
                elements: elementsData
            }
        };

        this.map.customPaletteDefinitions = this.map.customPaletteDefinitions || {};
        this.map.customPaletteDefinitions[prefabKey] = bakedDefinition;

        // Auto-save to IndexedDB (STORES.PREFABS)
        try {
            await db.set(STORES.PREFABS, prefabKey, bakedDefinition);
            console.log(`Saved baked prefab "${prefabName}" to IndexedDB.`);
        } catch (dbErr) {
            console.error("Failed to save baked prefab to DB:", dbErr);
        }

        // Clear selection, update list and reload ui
        this.clearSelection();
        this.uiManager.refreshObjectPalette();

        CustomDialog.alert(`Prefab "${prefabName}" crafted securely containing ${elementsData.length} stacked elements. Saved to database! Ready to build on Object2 layer.`, "Bake Complete");
    }

    placeCustomBakedPrefab(prefab, placementMapX, placementMapY) {
        if (!prefab || !prefab.customData || !Array.isArray(prefab.customData.elements)) return;
        
        this.saveState();
        
        const parentMapX = Math.floor(placementMapX);
        const parentMapY = Math.floor(placementMapY);
        const parentWorldPos = this.map.mapToScreen(parentMapX, parentMapY);

        prefab.customData.elements.forEach(el => {
            try {
                if (el.type === 'tile') {
                    const targetX = parentMapX + el.relX;
                    const targetY = parentMapY + el.relY;
                    if (targetX >= 0 && targetX < this.map.width && targetY >= 0 && targetY < this.map.height) {
                        let tileIdToSet = el.tileId;
                        if (el.sourceRect) {
                            tileIdToSet = this.map.ensureTileDefinition(
                                el.sourceRect,
                                el.spritesheetIndex || 0,
                                el.zIndex || 0
                            );
                        }
                        this.map.setTileId(targetX, targetY, tileIdToSet);
                    }
                } else if (el.type === 'object') {
                    const targetX = parentMapX + el.relX;
                    const targetY = parentMapY + el.relY;
                    if (targetX >= 0 && targetX < this.map.width && targetY >= 0 && targetY < this.map.height) {
                        const originalConfig = el.config || {};
                        const config = { ...originalConfig, id: `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
                        const finalLayerKey = el.layerKey || this.currentLayer || 'object2';
                        this.map.addGameObject(finalLayerKey, config, targetX, targetY);
                    }
                } else if (el.type === 'collision') {
                    if (Array.isArray(el.vertices)) {
                        const offsetVertices = el.vertices.map(v => ({
                            x: parentWorldPos.x + v.x,
                            y: parentWorldPos.y + v.y
                        }));
                        this.map.addCustomCollisionShape({
                            id: `custom_coll_poly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            vertices: offsetVertices
                        });
                    }
                } else if (el.type === 'occlusion') {
                    if (Array.isArray(el.vertices)) {
                        const offsetVertices = el.vertices.map(v => ({
                            x: parentWorldPos.x + v.x,
                            y: parentWorldPos.y + v.y
                        }));
                        this.map.addOcclusionShape({
                            id: `occlusion_poly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            vertices: offsetVertices
                        });
                    }
                } else if (el.type === 'spawn') {
                    const targetX = parentWorldPos.x + el.relX;
                    const targetY = parentWorldPos.y + el.relY;
                    this.map.spawnPointsData.push({
                        id: `spawn_pt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        x: targetX,
                        y: targetY,
                        type: el.pointType,
                        targetMap: el.targetMap || null,
                        npcData: el.npcData || null,
                        enemyId: el.enemyId || null
                    });
                } else if (el.type === 'light_mask') {
                    if (Array.isArray(el.vertices)) {
                        const offsetVertices = el.vertices.map(v => ({
                            x: parentWorldPos.x + v.x,
                            y: parentWorldPos.y + v.y
                        }));
                        this.map.addLightMask({
                            type: el.maskType,
                            vertices: offsetVertices,
                            color: el.color,
                            intensity: el.intensity,
                            blur: el.blur,
                            blendMode: el.blendMode,
                            smoothing: el.smoothing,
                            flicker: el.flicker
                        });
                    }
                }
            } catch (err) {
                console.error("Error placing custom element in prefab:", el, err);
            }
        });
        
        // Refresh game view
        this.engine.gameObjects = this.map.getRuntimeGameObjects();
        this.engine.lightSystem.updateData(this.map.getLightingData());
        this.updateBrushVisuals();
    }

    explodeAndEditCustomPrefab(prefab) {
        if (!prefab || !prefab.customData || !Array.isArray(prefab.customData.elements)) {
            CustomDialog.alert("Invalid prefab data", "Error");
            return;
        }

        // 1. Compute view center in map coordinates
        const centerMapCoords = this.map.screenToMap(this.map.cameraX, this.map.cameraY);
        const spawnX = Math.floor(centerMapCoords.x);
        const spawnY = Math.floor(centerMapCoords.y);
        const centerWorldPos = this.map.mapToScreen(spawnX, spawnY);

        this.saveState();
        this.clearSelection();

        const addedElements = [];

        // 2. Transcribe elements into active layers centered at view location
        prefab.customData.elements.forEach(el => {
            try {
                if (el.type === 'tile') {
                    const targetX = spawnX + el.relX;
                    const targetY = spawnY + el.relY;
                    if (targetX >= 0 && targetX < this.map.width && targetY >= 0 && targetY < this.map.height) {
                        let tileIdToSet = el.tileId;
                        if (el.sourceRect) {
                            tileIdToSet = this.map.ensureTileDefinition(
                                el.sourceRect,
                                el.spritesheetIndex || 0,
                                el.zIndex || 0
                            );
                        }
                        this.map.setTileId(targetX, targetY, tileIdToSet);
                        addedElements.push({
                            type: 'tile',
                            mapX: targetX,
                            mapY: targetY,
                            tileId: tileIdToSet
                        });
                    }
                } else if (el.type === 'object') {
                    const targetX = spawnX + el.relX;
                    const targetY = spawnY + el.relY;
                    if (targetX >= 0 && targetX < this.map.width && targetY >= 0 && targetY < this.map.height) {
                        const originalConfig = el.config || {};
                        const finalLayerKey = el.layerKey || 'object2';
                        const addedObj = this.map.addGameObject(finalLayerKey, originalConfig, targetX, targetY);
                        
                        if (addedObj) {
                            addedElements.push({
                                type: 'object',
                                layerKey: finalLayerKey,
                                id: addedObj.id,
                                displayName: addedObj.displayName || addedObj.name || addedObj.type,
                                assetName: addedObj.assetName,
                                mapX: targetX,
                                mapY: targetY,
                                config: originalConfig
                            });
                        }
                    }
                } else if (el.type === 'collision') {
                    if (Array.isArray(el.vertices)) {
                        const collId = `custom_coll_poly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        const offsetVertices = el.vertices.map(v => ({
                            x: centerWorldPos.x + v.x,
                            y: centerWorldPos.y + v.y
                        }));
                        this.map.addCustomCollisionShape({
                            id: collId,
                            vertices: offsetVertices
                        });
                        addedElements.push({
                            type: 'collision',
                            id: collId,
                            vertices: offsetVertices
                        });
                    }
                } else if (el.type === 'occlusion') {
                    if (Array.isArray(el.vertices)) {
                        const occId = `occlusion_poly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        const offsetVertices = el.vertices.map(v => ({
                            x: centerWorldPos.x + v.x,
                            y: centerWorldPos.y + v.y
                        }));
                        this.map.addOcclusionShape({
                            id: occId,
                            vertices: offsetVertices
                        });
                        addedElements.push({
                            type: 'occlusion',
                            id: occId,
                            vertices: offsetVertices
                        });
                    }
                } else if (el.type === 'spawn') {
                    const spawnId = `spawn_pt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    const targetX = centerWorldPos.x + el.relX;
                    const targetY = centerWorldPos.y + el.relY;
                    const ptData = {
                        id: spawnId,
                        x: targetX,
                        y: targetY,
                        type: el.pointType,
                        targetMap: el.targetMap || null,
                        npcData: el.npcData || null,
                        enemyId: el.enemyId || null
                    };
                    this.map.spawnPointsData.push(ptData);
                    addedElements.push({
                        type: 'spawn',
                        id: spawnId,
                        x: targetX,
                        y: targetY,
                        spawnType: el.pointType,
                        targetMap: el.targetMap,
                        npcData: el.npcData,
                        enemyId: el.enemyId
                    });
                } else if (el.type === 'light_mask') {
                    if (Array.isArray(el.vertices)) {
                        const offsetVertices = el.vertices.map(v => ({
                            x: centerWorldPos.x + v.x,
                            y: centerWorldPos.y + v.y
                        }));
                        const maskId = `light_mask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        const maskData = {
                            id: maskId,
                            type: el.maskType,
                            vertices: offsetVertices,
                            color: el.color,
                            intensity: el.intensity,
                            blur: el.blur,
                            blendMode: el.blendMode,
                            smoothing: el.smoothing,
                            flicker: el.flicker
                        };
                        this.map.addLightMask(maskData);
                        addedElements.push({
                            type: 'light_mask',
                            id: maskId,
                            maskType: el.maskType,
                            vertices: offsetVertices,
                            color: el.color,
                            intensity: el.intensity,
                            blur: el.blur,
                            blendMode: el.blendMode,
                            smoothing: el.smoothing,
                            flicker: el.flicker
                        });
                    }
                }
            } catch (err) {
                console.error("Error reconstituting element:", el, err);
            }
        });

        // 3. Update the editor's selected grouping and set tool to Select
        this.selectedElements = addedElements;
        this.currentTool = 'select';
        
        if (this.uiManager) {
            this.uiManager.updateSelectionListUI(this.selectedElements);
            this.uiManager.updateToolButtonsState();
            this.uiManager.updateToolPanelVisibility();
        }

        // Recompile working sprites
        this.engine.gameObjects = this.map.getRuntimeGameObjects();
        this.engine.lightSystem.updateData(this.map.getLightingData());
        this.updateBrushVisuals();

        CustomDialog.alert(`💥 Prefab elements exploded at map coordinates (${spawnX}, ${spawnY}) and automatically selected! All vertices across all layers (collisions, lights, spawn triggers) are fully alive and editable.`, "Prefab Exploded");
    }

    async updateExistingPrefab(prefabKey) {
        if (this.selectedElements.length === 0) {
            CustomDialog.alert("Please make a selection first using the Selection Tool (🔍) to update the prefab with.", "No Selection");
            return;
        }

        this.map.customPaletteDefinitions = this.map.customPaletteDefinitions || {};
        const prefab = this.map.customPaletteDefinitions[prefabKey];
        if (!prefab) {
            CustomDialog.alert("Prefab not find.", "Error");
            return;
        }

        // Standard bounds compilation
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        this.selectedElements.forEach(el => {
            if (el.type === 'tile' || el.type === 'object') {
                const screen = this.map.mapToScreen(el.mapX, el.mapY);
                minX = Math.min(minX, screen.x);
                maxX = Math.max(maxX, screen.x);
                minY = Math.min(minY, screen.y);
                maxY = Math.max(maxY, screen.y);
            } else if (el.type === 'spawn') {
                minX = Math.min(minX, el.x);
                maxX = Math.max(maxX, el.x);
                minY = Math.min(minY, el.y);
                maxY = Math.max(maxY, el.y);
            } else if (el.type === 'collision' || el.type === 'occlusion' || el.type === 'light_mask') {
                el.vertices.forEach(v => {
                    minX = Math.min(minX, v.x);
                    maxX = Math.max(maxX, v.x);
                    minY = Math.min(minY, v.y);
                    maxY = Math.max(maxY, v.y);
                });
            }
        });

        let sumMapX = 0, sumMapY = 0, countGrid = 0;
        this.selectedElements.forEach(el => {
            if (el.type === 'tile' || el.type === 'object') {
                sumMapX += el.mapX;
                sumMapY += el.mapY;
                countGrid++;
            }
        });

        let snappedGridX = 0;
        let snappedGridY = 0;
        if (countGrid > 0) {
            snappedGridX = Math.round(sumMapX / countGrid);
            snappedGridY = Math.round(sumMapY / countGrid);
        } else {
            const midWorldX = (minX + maxX) / 2;
            const midWorldY = (minY + maxY) / 2;
            const gridAnchor = this.map.screenToMap(midWorldX, midWorldY);
            snappedGridX = Math.round(gridAnchor.x);
            snappedGridY = Math.round(gridAnchor.y);
        }
        const anchorWorldPos = this.map.mapToScreen(snappedGridX, snappedGridY);

        const elementsData = [];

        this.selectedElements.forEach(el => {
            if (el.type === 'tile') {
                const tileDef = this.map.tileDefinitions[el.tileId] || {};
                elementsData.push({
                    type: 'tile',
                    relX: el.mapX - snappedGridX,
                    relY: el.mapY - snappedGridY,
                    tileId: el.tileId,
                    sourceRect: tileDef.sourceRect || null,
                    spritesheetIndex: tileDef.spritesheetIndex !== undefined ? tileDef.spritesheetIndex : 0,
                    zIndex: tileDef.zIndex !== undefined ? tileDef.zIndex : 0
                });
            } else if (el.type === 'object') {
                elementsData.push({
                    type: 'object',
                    layerKey: el.layerKey,
                    relX: el.mapX - snappedGridX,
                    relY: el.mapY - snappedGridY,
                    config: el.config
                });
            } else if (el.type === 'spawn') {
                elementsData.push({
                    type: 'spawn',
                    relX: el.x - anchorWorldPos.x,
                    relY: el.y - anchorWorldPos.y,
                    pointType: el.spawnType,
                    targetMap: el.targetMap,
                    npcData: el.npcData,
                    enemyId: el.enemyId
                });
            } else if (el.type === 'collision') {
                elementsData.push({
                    type: 'collision',
                    vertices: el.vertices.map(v => ({
                        x: v.x - anchorWorldPos.x,
                        y: v.y - anchorWorldPos.y
                    }))
                });
            } else if (el.type === 'occlusion') {
                elementsData.push({
                    type: 'occlusion',
                    vertices: el.vertices.map(v => ({
                        x: v.x - anchorWorldPos.x,
                        y: v.y - anchorWorldPos.y
                    }))
                });
            } else if (el.type === 'light_mask') {
                elementsData.push({
                    type: 'light_mask',
                    maskType: el.maskType,
                    vertices: el.vertices.map(v => ({
                        x: v.x - anchorWorldPos.x,
                        y: v.y - anchorWorldPos.y
                    })),
                    color: el.color,
                    intensity: el.intensity,
                    blur: el.blur,
                    blendMode: el.blendMode,
                    smoothing: el.smoothing,
                    flicker: el.flicker
                });
            }
        });

        prefab.customData = { elements: elementsData };

        try {
            await db.set(STORES.PREFABS, prefabKey, prefab);
            console.log(`Updated custom prefab "${prefab.displayName}" in IndexedDB.`);
        } catch (dbErr) {
            console.error("Failed to update prefab in DB:", dbErr);
        }

        this.clearSelection();
        if (this.uiManager) {
            this.uiManager.refreshObjectPalette();
            this.uiManager.hideSelectedPrefabDetails();
        }
        CustomDialog.alert(`Prefab "${prefab.displayName}" updated successfully containing ${elementsData.length} new elements!`, "Update Success");
    }

    async deleteCustomPrefabByKey(prefabKey) {
        if (!this.map.customPaletteDefinitions || !this.map.customPaletteDefinitions[prefabKey]) return;
        
        const prefab = this.map.customPaletteDefinitions[prefabKey];
        const confirmResult = await CustomDialog.confirm(`Are you sure you want to delete the custom prefab "${prefab.displayName}"?`);
        if (!confirmResult) return;

        // Eliminate from RAM
        delete this.map.customPaletteDefinitions[prefabKey];

        // Eliminate from DB
        try {
            await db.delete(STORES.PREFABS, prefabKey);
            console.log(`Deleted custom prefab "${prefabKey}" from IndexedDB.`);
        } catch (dbErr) {
            console.error("Failed to delete prefab from DB:", dbErr);
        }

        // Safely unset active brush
        if (this.selectedObjectBrush && this.selectedObjectBrush.assetName === prefabKey) {
            this.selectedObjectBrush = null;
        }

        // Re-draw
        if (this.uiManager) {
            this.uiManager.refreshObjectPalette();
            this.uiManager.hideSelectedPrefabDetails();
        }
        CustomDialog.alert(`Prefab "${prefab.displayName}" deleted successfully.`, "Delete Complete");
    }
}

export default MapEditor;