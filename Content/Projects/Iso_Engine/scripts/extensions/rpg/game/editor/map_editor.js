// Game Map Editor Logic
console.log("rpg/game/editor/map_editor.js loaded");

import EditorUIManager from './editor_ui_manager.js';
import EditorMapOperations from './editor_map_operations.js';
import { enemy_types } from '../../data/enemy-list.js';
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

        this._boundHandleSpritesheetClick = this.handleSpritesheetClick.bind(this);
        this._boundHandleMapClick = this.handleMapClick.bind(this);
        this._boundHandleMouseMove = this.handleMouseMove.bind(this);
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

        // Add default spritesheet from the map's runtime list
        if (this.map.runtimeSpritesheets[0]) {
             this.spritesheets.push({
                name: 'default_buildings.png',
                image: this.map.runtimeSpritesheets[0],
                isCustom: false,
            });
        }
        
        // Add custom spritesheets from the map
        if (this.map.customSpritesheets) {
            this.map.customSpritesheets.forEach((sheetData, index) => {
                const image = this.map.runtimeSpritesheets[index + 1];
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
            console.error("Editor: Spritesheet canvas/context not ready for loading.");
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
                alert(`Spritesheet "${file.name}" uploaded successfully.`);
            };
            newImage.onerror = () => {
                alert(`Failed to load the uploaded image file: ${file.name}`);
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
                    alert(`Loaded NPC "${npcData.name}". Click on the map to place.`);
                    this.uiManager.updateNpcBrushInfo(npcData.name);
                } else {
                    throw new Error("Invalid or incomplete NPC JSON file.");
                }
            } catch (error) {
                console.error("Error parsing NPC file for map editor:", error);
                alert(`Error parsing NPC file: ${error.message}`);
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

    show() {
        if (!this.uiManager.toolsPanel || !this.uiManager.operationsPanel) {
            this.initUI();
        }
        this.uiManager.showPanels();
        this.isActive = true;
        
        if (this.uiManager.spritesheetCanvas) {
            this.uiManager.spritesheetCanvas.addEventListener('click', this._boundHandleSpritesheetClick);
        }
        this.engine.canvas.addEventListener('click', this._boundHandleMapClick);
        this.engine.canvas.addEventListener('mousemove', this._boundHandleMouseMove);
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
            this.selectedTileBrush = { 
                sourceRect: clickedSourceRect,
                spritesheetIndex: this.currentSpriteSheetIndex
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
            let asset;
            if (this.selectedObjectBrush.spritesheetIndex !== undefined && this.spritesheets[this.selectedObjectBrush.spritesheetIndex]) {
                 asset = this.spritesheets[this.selectedObjectBrush.spritesheetIndex].image;
            } else {
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

    handleMapClick(event) {
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
        
        if (this.currentLayer === 'tile') {
            const mapCoords = this.map.screenToMap(worldX, worldY);
            const roundedMapX = Math.floor(mapCoords.x);
            const roundedMapY = Math.floor(mapCoords.y);
            if (!this.selectedTileBrush && this.currentTool === 'place') return;

            if (this.currentTool === 'place') {
                if (roundedMapX >= 0 && roundedMapX < this.map.width &&
                    roundedMapY >= 0 && roundedMapY < this.map.height) {
                    
                    const tileIdToPlace = this.map.ensureTileDefinition(
                        this.selectedTileBrush.sourceRect,
                        this.selectedTileBrush.spritesheetIndex
                    );
                    this.map.setTileId(roundedMapX, roundedMapY, tileIdToPlace);
                } else {
                    console.log("Clicked outside map bounds for tile placement.");
                }
            } else if (this.currentTool === 'erase') {
                if (roundedMapX >= 0 && roundedMapX < this.map.width &&
                    roundedMapY >= 0 && roundedMapY < this.map.height) {
                    this.map.setTileId(roundedMapX, roundedMapY, 0); 
                    console.log(`Erased tile at ${roundedMapX}, ${roundedMapY}`);
                }
            }
        } else if ((this.currentLayer === 'object1' || this.currentLayer === 'object2')) {
            const mapCoords = this.map.screenToMap(worldX, worldY);
            let placementMapX = mapCoords.x;
            let placementMapY = mapCoords.y;

            if (this.snapToGrid) {
                placementMapX = Math.floor(mapCoords.x) + 1;
                placementMapY = Math.floor(mapCoords.y) + 1; 
            }

            if (this.currentTool === 'place' && this.selectedObjectBrush) {
                let finalObjectConfig = { ...this.selectedObjectBrush };
                finalObjectConfig.collidable = this.uiManager.collidableCheckbox.checked;

                if (this.currentLayer === 'object1' && finalObjectConfig.collidable && !finalObjectConfig.collisionShape) {
                     console.warn("Assigning default diamond collision to object1 object at placement time.");
                     finalObjectConfig.collisionShape = { type: 'polygon', vertices: DEFAULT_OBJECT_DIAMOND_VERTICES };
                }

                if (finalObjectConfig.type === 'note') {
                    const noteText = prompt("Enter the text for this note (this will provide context to NPCs on this map):", "");
                    if (noteText === null) return; // User cancelled
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
                this.map.addGameObject(this.currentLayer, finalObjectConfig, placementMapX, placementMapY);
            } else if (this.currentTool === 'erase') {
                const objectToRemove = this._getObjectAtWorldCoords(worldX, worldY, this.currentLayer);
                if (objectToRemove) {
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
                } else if (spawnType === SPAWN_TYPES.NPC_PERMANENT) {
                    if (this.loadedNpcData) {
                        spawnData.npcData = this.loadedNpcData;
                    } else {
                        alert("No NPC JSON loaded. Please use the 'Upload NPC' button first.");
                        return;
                    }
                } else if (spawnType === SPAWN_TYPES.ENEMY) {
                    const selectedEnemyId = this.uiManager.getSelectedEnemyType();
                    if (selectedEnemyId) {
                        spawnData.enemyId = selectedEnemyId;
                    } else {
                        alert("Please select an enemy type.");
                        return;
                    }
                }
                
                this.map.addSpawnPoint(spawnData);

            } else if (this.currentTool === 'erase') {
                this.map.removeSpawnPointAt(spawnX, spawnY, SPAWN_POINT_RADIUS);
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

        if ((this.currentLayer === 'collision' || this.currentLayer === 'occlusion') && this.snapToGrid && this.currentTool === 'place') {
            const mapCoords = this.map.screenToMap(rawWorldX, rawWorldY);
            // Snap to tile corners (integer map coords) for collision/occlusion polygons
            const snappedMapX = Math.round(mapCoords.x);
            const snappedMapY = Math.round(mapCoords.y);
            const snappedWorldPos = this.map.mapToScreen(snappedMapX, snappedMapY);
            this.currentMouseWorldPos.x = snappedWorldPos.x;
            this.currentMouseWorldPos.y = snappedWorldPos.y;
        } else if (this.currentLayer === 'spawn' && this.snapToGrid && this.currentTool === 'place') {
            const mapCoords = this.map.screenToMap(rawWorldX, rawWorldY);
            const snappedMapX = Math.floor(mapCoords.x) + 0.5; // Center of tile
            const snappedMapY = Math.floor(mapCoords.y) + 0.5; // Center of tile
            const snappedWorldPos = this.map.mapToScreen(snappedMapX, snappedMapY);
            this.currentMouseWorldPos.x = snappedWorldPos.x;
            this.currentMouseWorldPos.y = snappedWorldPos.y;
        }
         else {
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

        ctx.restore();
    }
}

export default MapEditor;