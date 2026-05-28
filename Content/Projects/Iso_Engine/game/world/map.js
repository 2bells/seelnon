// Game World and Map Logic

console.log("rpg/game/world/map.js loaded");

import GameObject from '../entities/gameObject.js'; // Import GameObject

class GameMap {
    constructor(width, height, engine) {
        this.width = width; // In tiles
        this.height = height; // In tiles
        this.engine = engine; // Store engine reference for assets

        // Isometric tile dimensions
        this.tileWidth = 64;
        this.tileHeight = 32;
        this.halfTileWidth = this.tileWidth / 2;
        this.halfTileHeight = this.tileHeight / 2;

        this.tiles = []; // 2D array for tile data (stores tile IDs)
        
        // Data for game objects on different layers
        // Stores object configuration data, not instances, for serialization
        this.objectLayersData = {
            'object1': [],
            'object2': []
            // Potentially more layers in the future
        };
        // Runtime instances of GameObjects
        this.runtimeGameObjects = [];
        
        // Spritesheet data
        this.customSpritesheets = []; // Stores {name, dataUrl} for serialization
        this.runtimeSpritesheets = []; // Stores loaded HTMLImageElements

        // Layer data for custom shapes
        this.collisionLayerData = []; // Polygons: [{ id: string, vertices: [{x,y}, ...] }, ...]
        this.occlusionLayerData = []; // Polygons: [{ id: string, vertices: [{x,y}, ...] }, ...]
        // Spawn Points: [{ id:string, x, y, type: string, targetMap?: string }, ...]
        this.spawnPointsData = [];    


        // Lighting Data
        this.lightingData = {
            masks: [] // { id, type, vertices, color, intensity, blur, blendMode, visible }
        };

        // Shared chat history for this map
        this.chatHistory = [];

        // Camera/viewport offset
        this.cameraX = 0;
        this.cameraY = 0;

        this.tileSpriteSheet = this.engine.assets.buildingSpritesheet;
        if (this.tileSpriteSheet) {
            this.runtimeSpritesheets.push(this.tileSpriteSheet);
        } else {
            console.error("Default building spritesheet not found in engine assets!");
        }
        this.currentMapName = null; // To store the name of the currently loaded/saved map

        // Tile definitions: maps tile ID to { sourceRect }
        this.tileDefinitions = {};
        this.nextTileId = 1; // Counter for new tile definitions

        this._initDefaultTileDefinitions();
        this.initializeNewMap(width, height, 1); // Initialize with a default floor tile
    }

    _initDefaultTileDefinitions() {
        this.tileDefinitions = {}; // Clear existing, if any
        this.nextTileId = 1;
        // Base/Default floor tile (1st column, 6th row -> 0-indexed: col 0, row 5)
        // Add 2px padding for each sprite and row/column index
        const SPRITE_SIZE = 64;
        const PADDING = 2; // Default padding used historically if not specified
        this.addTileDefinitionInternal(1, { 
            x: (0 * (SPRITE_SIZE + PADDING)), 
            y: (5 * (SPRITE_SIZE + PADDING)), 
            width: SPRITE_SIZE, 
            height: SPRITE_SIZE 
        }, 0); // Default floor 1
        // A slightly different floor tile for variation (e.g., 2nd from col 0, row 5 - if available, or use same)
        this.addTileDefinitionInternal(2, { 
            x: (1 * (SPRITE_SIZE + PADDING)), 
            y: (5 * (SPRITE_SIZE + PADDING)), 
            width: SPRITE_SIZE, 
            height: SPRITE_SIZE 
        }, 0); // Default floor 2 
        // Left edge wall/border (2nd column, 5th row -> 0-indexed: col 1, row 4)
        this.addTileDefinitionInternal(3, { 
            x: (1 * (SPRITE_SIZE + PADDING)), 
            y: (4 * (SPRITE_SIZE + PADDING)), 
            width: SPRITE_SIZE, 
            height: SPRITE_SIZE 
        }, 0); // Left Edge
        // Top edge wall/border (1st column, 5th row -> 0-indexed: col 0, row 4)
        this.addTileDefinitionInternal(4, { 
            x: (0 * (SPRITE_SIZE + PADDING)), 
            y: (4 * (SPRITE_SIZE + PADDING)), 
            width: SPRITE_SIZE, 
            height: SPRITE_SIZE 
        }, 0); // Top Edge
        // Top-left corner wall/border (2nd column, 4th row -> 0-indexed: col 1, row 3)
        this.addTileDefinitionInternal(5, { 
            x: (1 * (SPRITE_SIZE + PADDING)), 
            y: (3 * (SPRITE_SIZE + PADDING)), 
            width: SPRITE_SIZE, 
            height: SPRITE_SIZE 
        }, 0); // Top-Left Corner
        console.log("Default tile definitions initialized. Next ID:", this.nextTileId);
    }
    
    // Internal method to add definitions without checking for existing sourceRects
    addTileDefinitionInternal(id, sourceRect, spritesheetIndex = 0) {
        this.tileDefinitions[id] = { sourceRect: sourceRect, spritesheetIndex: spritesheetIndex };
        if (id >= this.nextTileId) {
            this.nextTileId = id + 1;
        }
    }

    // Public method for editor to add new tile types
    // Returns the tile ID for the given sourceRect (either existing or newly created)
    ensureTileDefinition(sourceRect, spritesheetIndex = 0) { // Added padding parameter, default to 2
        // Check if a definition with this sourceRect AND spritesheetIndex already exists
        for (const id in this.tileDefinitions) {
            const def = this.tileDefinitions[id];
            if (def.spritesheetIndex === spritesheetIndex &&
                def.sourceRect.x === sourceRect.x &&
                def.sourceRect.y === sourceRect.y &&
                def.sourceRect.width === sourceRect.width &&
                def.sourceRect.height === sourceRect.height) {
                return parseInt(id); // Found existing, return its ID
            }
        }
        // Not found, create a new one
        const newId = this.nextTileId;
        this.tileDefinitions[newId] = { sourceRect: sourceRect, spritesheetIndex: spritesheetIndex };
        this.nextTileId++;
        console.log(`New tile definition created: ID ${newId} for spritesheet ${spritesheetIndex}, sourceRect`, sourceRect);
        return newId;
    }

    initializeNewMap(width, height, defaultTileId = 1) {
        this.width = parseInt(width) || 20;
        this.height = parseInt(height) || 20;
        this.tiles = [];
        for (let y = 0; y < this.height; y++) {
            this.tiles[y] = [];
            for (let x = 0; x < this.width; x++) {
                // Simple border logic for new maps
                if (x === 0 && y === 0) {
                    this.tiles[y][x] = 5; // Top-left corner
                } else if (x === 0) {
                    this.tiles[y][x] = 3; // Left edge
                } else if (y === 0) {
                    this.tiles[y][x] = 4; // Top edge
                } else if (x === this.width -1 && y === this.height - 1){ // Bottom-right (needs specific sprite)
                     this.tiles[y][x] = defaultTileId; // Placeholder for now
                } else if (x === this.width -1) { // Right edge (needs specific sprite)
                     this.tiles[y][x] = defaultTileId; // Placeholder for now
                } else if (y === this.height -1) { // Bottom edge (needs specific sprite)
                    this.tiles[y][x] = defaultTileId; // Placeholder for now
                }
                 else {
                    this.tiles[y][x] = defaultTileId; // Fill with default
                }
            }
        }
        // Clear game objects for a new map
        this.objectLayersData = { 'object1': [], 'object2': [] };
        this.runtimeGameObjects = [];
        this.customSpritesheets = []; // Also clear custom spritesheets
        this.runtimeSpritesheets = [this.engine.assets.buildingSpritesheet]; // Reset to default
        this.collisionLayerData = []; 
        this.occlusionLayerData = [];
        this.spawnPointsData = [];
        this.lightingData = { masks: [] };
        this.chatHistory = []; // Clear chat history for new map
        this.engine.gameObjects = this.runtimeGameObjects; // Update engine's reference

        console.log(`New map initialized: ${this.width}x${this.height} with default tile ID ${defaultTileId}. All layers cleared.`);
    }

    getTileId(x, y) {
        const gridX = Math.floor(x);
        const gridY = Math.floor(y);
        if (gridX >= 0 && gridX < this.width && gridY >= 0 && gridY < this.height) {
            return this.tiles[gridY][gridX];
        }
        return 0; // 0 for void or impassable (out of bounds)
    }

    setTileId(mapX, mapY, tileId) {
        const gridX = Math.floor(mapX);
        const gridY = Math.floor(mapY);
        if (gridX >= 0 && gridX < this.width && gridY >= 0 && gridY < this.height) {
            this.tiles[gridY][gridX] = tileId;
            // If setting tile ID to 0 (empty), ensure it's handled correctly.
            // Tile ID 0 means no sprite will be drawn for that tile by current render logic.
        } else {
            console.warn(`Attempted to set tile outside map bounds: ${gridX}, ${gridY}`);
        }
    }

    // Convert map (grid) coordinates to screen (pixel) coordinates (world space)
    // This calculates the pixel coordinate of the TOP point of the isometric tile rhombus
    mapToScreen(mapX, mapY) {
        const screenX = (mapX - mapY) * this.halfTileWidth;
        const screenY = (mapX + mapY) * this.halfTileHeight;
        return { x: screenX, y: screenY };
    }

    // Convert screen (pixel) coordinates (world space) to map (grid) coordinates
    screenToMap(screenX, screenY) {
        const mapX = (screenX / this.halfTileWidth + screenY / this.halfTileHeight) / 2;
        const mapY = (screenY / this.halfTileHeight - screenX / this.halfTileWidth) / 2;
        return { x: mapX, y: mapY };
    }

    // Center camera on a specific world pixel coordinate
    centerOn(targetWorldX, targetWorldY, effectiveCanvasWidth, effectiveCanvasHeight) {
        this.cameraX = targetWorldX;
        this.cameraY = targetWorldY;
        // The map doesn't need to store effectiveCanvasWidth/Height,
        // they are used by the engine to calculate viewOrigin.
    }

    render(ctx, canvas, viewOriginX, viewOriginY) {
        const editorActive = this.engine.isEditing && this.engine.mapEditor;
        const currentEditorLayer = editorActive ? this.engine.mapEditor.currentLayer : null;
        const isObjectLayerActive = editorActive && (currentEditorLayer === 'object1' || currentEditorLayer === 'object2');
        const isSpecialLayerActive = editorActive && (currentEditorLayer === 'collision' || currentEditorLayer === 'occlusion' || currentEditorLayer === 'spawn');

        ctx.save();
        if (editorActive && (isObjectLayerActive || isSpecialLayerActive)) {
            ctx.globalAlpha = 0.5; // Desaturate tile layer if an object or special layer is active in editor
        }

        // Iterate through tiles using y then x for correct isometric rendering order (painter's algorithm)
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const tileType = this.tiles[y][x];
                // screenPos is the world coordinate of the tile's top point
                const screenPos = this.mapToScreen(x, y);

                // drawX/drawY are the canvas coordinates for the tile's top point,
                // relative to the current view origin.
                const drawX = screenPos.x - viewOriginX;
                const drawY = screenPos.y - viewOriginY;

                // --- Culling ---
                const cullCanvasWidth = canvas.width / this.engine.zoomLevel;
                const cullCanvasHeight = canvas.height / this.engine.zoomLevel;

                // Estimate max tile visual height for culling. Sprites can be taller than tileHeight.
                // Using tileHeight * 4 as a generous estimate for max sprite height relative to anchor.
                if (drawX + this.tileWidth < 0 || drawX - this.tileWidth > cullCanvasWidth || 
                    drawY + this.tileHeight * 4 < 0 || drawY - this.tileHeight > cullCanvasHeight) {
                    continue; 
                }

                // --- Tile Drawing ---
                ctx.save();
                ctx.translate(drawX, drawY);

                let currentTileSourceRect = null;
                const tileDef = this.tileDefinitions[tileType];
                if (tileDef) {
                    currentTileSourceRect = tileDef.sourceRect;
                } else if (tileType !== 0) { 
                    ctx.fillStyle = 'magenta'; 
                    ctx.fillRect(0 - this.halfTileWidth/2, 0, this.halfTileWidth, this.halfTileHeight); 
                }

                const spritesheet = this.runtimeSpritesheets[tileDef ? tileDef.spritesheetIndex || 0 : 0];
                if (spritesheet && spritesheet.complete && currentTileSourceRect) {
                    const source = currentTileSourceRect;
                    const imgRenderWidth = source.width;   
                    const imgRenderHeight = source.height; 
                    
                    const imgDrawX = 0 - this.halfTileWidth;
                    let imgDrawY = 0; 
                    
                    // If the sprite is taller than the logical tile height (e.g., a 64x64 floor tile for a 32px high diamond base),
                    // offset it upwards so its visual base aligns with the diamond's base.
                    // This primarily applies to floor-like tiles. Walls might have different anchoring.
                    // For now, this generic rule for sprites taller than base diamond.
                    if (imgRenderHeight > this.tileHeight) {
                        // Example: 64px tall sprite, 32px tileHeight. Offset by 64-32 = 32px upwards.
                        imgDrawY = 0 - (imgRenderHeight - this.tileHeight);
                    }
                    
                    ctx.drawImage(
                        spritesheet,
                        source.x, source.y, source.width, source.height,
                        imgDrawX, imgDrawY, 
                        imgRenderWidth, imgRenderHeight 
                    );
                }
                ctx.restore(); 
            }
        }
        ctx.restore(); 
    }

    addGameObject(layerKey, objectConfig, mapX, mapY) {
        if (!this.objectLayersData[layerKey]) {
            console.warn(`Attempted to add object to non-existent layer: ${layerKey}`);
            return null;
        }

        const fullObjectData = {
            ...objectConfig, 
            mapX: mapX,
            mapY: mapY,
            id: `obj_${layerKey}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            layerKey: layerKey,
            spritesheetIndex: objectConfig.spritesheetIndex || 0, // Ensure spritesheetIndex is stored
        };
        
        this.objectLayersData[layerKey].push(fullObjectData);
        
        const gameObjectInstance = new GameObject(this.engine, this, mapX, mapY, fullObjectData);
        gameObjectInstance.layerKey = layerKey; 
        this.runtimeGameObjects.push(gameObjectInstance);
        this.engine.gameObjects = this.runtimeGameObjects; 

        console.log(`Added GameObject to layer ${layerKey}:`, gameObjectInstance);
        return gameObjectInstance;
    }

    removeGameObject(gameObjectInstance) {
        const layerKey = gameObjectInstance.layerKey;
        if (layerKey && this.objectLayersData[layerKey]) {
            this.objectLayersData[layerKey] = this.objectLayersData[layerKey].filter(
                data => data.id !== gameObjectInstance.id
            );
        }
        this.runtimeGameObjects = this.runtimeGameObjects.filter(
            obj => obj.id !== gameObjectInstance.id
        );
        this.engine.gameObjects = this.runtimeGameObjects;
        console.log(`Removed GameObject ${gameObjectInstance.id} from layer ${layerKey}`);
    }
    
    getRuntimeGameObjects() {
        return this.runtimeGameObjects;
    }

    // --- Light Mask Methods ---
    getLightingData() {
        return this.lightingData;
    }

    addLightMask(maskData) { // { type, vertices, color, intensity, blur, blendMode }
        if (!maskData || !Array.isArray(maskData.vertices) || maskData.vertices.length < 3) {
            console.warn("Attempted to add invalid light mask shape:", maskData);
            return null;
        }
        const newMask = {
            id: `light_mask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...maskData
        };
        this.lightingData.masks.push(newMask);
        if (this.engine.lightSystem) {
            this.engine.lightSystem.updateData(this.lightingData);
        }
        return newMask;
    }

    updateLightMask(maskId, properties) {
        const mask = this.lightingData.masks.find(m => m.id === maskId);
        if (mask) {
            Object.assign(mask, properties);
            if (this.engine.lightSystem) {
                this.engine.lightSystem.updateData(this.lightingData);
            }
        }
    }

    removeLightMask(maskId) {
        this.lightingData.masks = this.lightingData.masks.filter(m => m.id !== maskId);
        if (this.engine.lightSystem) {
            this.engine.lightSystem.updateData(this.lightingData);
        }
    }

    findLightMaskAt(worldX, worldY) {
        const clickPoint = { x: worldX, y: worldY };
        // Find topmost mask
        for (let i = this.lightingData.masks.length - 1; i >= 0; i--) {
            const mask = this.lightingData.masks[i];
            if (this.pointInPolygonBoundingBox(clickPoint, mask.vertices) &&
                this.pointInPolygon(clickPoint, mask.vertices)) {
                return mask;
            }
        }
        return null;
    }


    // --- Collision Layer Methods ---
    addCustomCollisionShape(polygonData) {
        if (!polygonData || !Array.isArray(polygonData.vertices) || polygonData.vertices.length < 3) {
            console.warn("Attempted to add invalid collision polygon shape:", polygonData);
            return null;
        }
        const newShape = {
            id: `custom_coll_poly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            vertices: polygonData.vertices 
        };
        this.collisionLayerData.push(newShape);
        console.log("Added custom collision polygon:", newShape);
        return newShape;
    }

    removeCustomCollisionShape(shapeId) {
        this.collisionLayerData = this.collisionLayerData.filter(shape => shape.id !== shapeId);
        console.log("Removed custom collision shape with ID:", shapeId);
    }

    findCustomCollisionShapeAt(worldX, worldY) {
        const clickPoint = { x: worldX, y: worldY };
        for (let i = this.collisionLayerData.length - 1; i >= 0; i--) {
            const shape = this.collisionLayerData[i];
            if (this.pointInPolygonBoundingBox(clickPoint, shape.vertices) &&
                this.pointInPolygon(clickPoint, shape.vertices)) {
                return shape;
            }
        }
        return null;
    }
    
    // --- Occlusion Layer Methods ---
    addOcclusionShape(polygonData) {
        if (!polygonData || !Array.isArray(polygonData.vertices) || polygonData.vertices.length < 3) {
            console.warn("Attempted to add invalid occlusion polygon shape:", polygonData);
            return null;
        }
        const newShape = {
            id: `occlusion_poly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            vertices: polygonData.vertices 
        };
        this.occlusionLayerData.push(newShape);
        console.log("Added occlusion polygon:", newShape);
        return newShape;
    }

    removeOcclusionShape(shapeId) {
        this.occlusionLayerData = this.occlusionLayerData.filter(shape => shape.id !== shapeId);
        console.log("Removed occlusion shape with ID:", shapeId);
    }

    findOcclusionShapeAt(worldX, worldY) {
        const clickPoint = { x: worldX, y: worldY };
        for (let i = this.occlusionLayerData.length - 1; i >= 0; i--) {
            const shape = this.occlusionLayerData[i];
             if (this.pointInPolygonBoundingBox(clickPoint, shape.vertices) &&
                this.pointInPolygon(clickPoint, shape.vertices)) {
                return shape;
            }
        }
        return null;
    }

    // --- Spawn Points Methods ---
    addSpawnPoint(pointData) { // pointData: {x, y, type (string), targetMap? (string), npcData? (object)}
        if (pointData.x === undefined || pointData.y === undefined) {
            console.warn("Attempted to add invalid spawn point data (missing x/y):", pointData);
            return null;
        }
        const newPoint = {
            id: `spawn_pt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            x: pointData.x,
            y: pointData.y,
            type: pointData.type || 'default', // Ensure type is always set
            targetMap: pointData.targetMap || null, // Store targetMap if provided
            npcData: pointData.npcData || null, // Store full NPC data if provided
            enemyId: pointData.enemyId || null
        };
        this.spawnPointsData.push(newPoint);
        console.log("Added spawn point:", newPoint);
        return newPoint;
    }

    removeSpawnPointAt(worldX, worldY, clickRadius = 10) {
        const clickRadiusSq = clickRadius * clickRadius;
        let removed = false;
        this.spawnPointsData = this.spawnPointsData.filter(point => {
            if (removed) return true; // Keep remaining points if one already removed in this call
            const dx = point.x - worldX;
            const dy = point.y - worldY;
            if ((dx * dx + dy * dy) <= clickRadiusSq) {
                console.log("Removed spawn point:", point.id);
                removed = true;
                return false; // Remove this point
            }
            return true; // Keep this point
        });
        return removed;
    }
    
    // --- General Polygon/Point Helpers ---
    pointInPolygonBoundingBox(point, polygonVertices) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        polygonVertices.forEach(v => {
            minX = Math.min(minX, v.x);
            minY = Math.min(minY, v.y);
            maxX = Math.max(maxX, v.x);
            maxY = Math.max(maxY, v.y);
        });
        return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
    }

    pointInPolygon(point, polygonVertices) {
        const { x, y } = point;
        let isInside = false;
        const n = polygonVertices.length;
        if (n < 3) return false; 

        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = polygonVertices[i].x, yi = polygonVertices[i].y;
            const xj = polygonVertices[j].x, yj = polygonVertices[j].y;

            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) isInside = !isInside;
        }
        return isInside;
    }

    pointInRectangle(point, rect) { 
        return point.x >= rect.x && point.x <= rect.x + rect.width &&
               point.y >= rect.y && point.y <= rect.y + rect.height;
    }

    // --- Circle Collision Helper Methods (moved from Player/Enemy) ---
    _distSq(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return dx * dx + dy * dy;
    }

    _closestPointOnSegment(p, a, b) {
        const ab = { x: b.x - a.x, y: b.y - a.y };
        const ap = { x: p.x - a.x, y: p.y - a.y };
        
        const abLenSq = ab.x * ab.x + ab.y * ab.y;
        if (abLenSq === 0) return { ...a }; // Segment is a point, return a copy

        let t = (ap.x * ab.x + ap.y * ab.y) / abLenSq;
        t = Math.max(0, Math.min(1, t)); // Clamp t to [0, 1]

        return { x: a.x + t * ab.x, y: a.y + t * ab.y };
    }
    
    _circleIntersectsRectangle(circle, rect) { // circle: {center, radius}, rect: {x,y,width,height}
        const closestX = Math.max(rect.x, Math.min(circle.center.x, rect.x + rect.width));
        const closestY = Math.max(rect.y, Math.min(circle.center.y, rect.y + rect.height));
        const distanceSquared = this._distSq(circle.center, {x: closestX, y: closestY});
        return distanceSquared <= (circle.radius * circle.radius);
    }

    _circleIntersectsPolygon(circle, polygonVertices) { // circle: {center, radius}
        if (this.pointInPolygon(circle.center, polygonVertices)) {
            return true; // Circle center is inside polygon
        }

        for (let i = 0; i < polygonVertices.length; i++) {
            const p1 = polygonVertices[i];
            const p2 = polygonVertices[(i + 1) % polygonVertices.length]; // Next vertex, wraps around
            
            const closestPoint = this._closestPointOnSegment(circle.center, p1, p2);
            if (this._distSq(circle.center, closestPoint) <= (circle.radius * circle.radius)) {
                return true; // Circle intersects an edge
            }
        }
        return false;
    }

    getStaticPushVector(circleCenter, radius, gameObjects) {
        let pushX = 0;
        let pushY = 0;
        let collisionCount = 0;

        const circle = { center: { ...circleCenter }, radius };

        // 1. Check against custom collision layer polygons
        if (this.collisionLayerData) {
            for (const customShape of this.collisionLayerData) {
                const poly = customShape.vertices;
                if (this._circleIntersectsPolygon(circle, poly)) {
                    let closestPt = null;
                    let minDistSq = Infinity;
                    for (let i = 0; i < poly.length; i++) {
                        const p1 = poly[i];
                        const p2 = poly[(i + 1) % poly.length];
                        const pt = this._closestPointOnSegment(circleCenter, p1, p2);
                        const dSq = this._distSq(circleCenter, pt);
                        if (dSq < minDistSq) {
                            minDistSq = dSq;
                            closestPt = pt;
                        }
                    }
                    if (closestPt) {
                        const dist = Math.sqrt(minDistSq);
                        let dx = circleCenter.x - closestPt.x;
                        let dy = circleCenter.y - closestPt.y;
                        
                        let dirX = dx;
                        let dirY = dy;
                        if (dist > 0.1) {
                            dirX /= dist;
                            dirY /= dist;
                        } else {
                            // Point is directly on or extremely close to edge
                            dirX = 0;
                            dirY = -1;
                        }
                        if (this.pointInPolygon(circleCenter, poly)) {
                            // If inside, push away from closest boundary point means we go opposite of pointing back inside
                            dirX = -dirX;
                            dirY = -dirY;
                        }
                        
                        const overlap = radius - dist;
                        const pushAmount = this.pointInPolygon(circleCenter, poly) ? (radius + dist + 1) : (overlap + 1);
                        pushX += dirX * pushAmount;
                        pushY += dirY * pushAmount;
                        collisionCount++;
                    }
                }
            }
        }

        // 2. Check against collidable gameObjects (excluding dynamic ones like player/enemies)
        if (gameObjects) {
            for (const obj of gameObjects) {
                if (obj.collidable && obj.type !== 'player' && obj.type !== 'enemy' && obj.constructor.name !== 'Player' && obj.constructor.name !== 'Enemy') {
                    const shape = obj.getCollisionBounds();
                    if (shape) {
                        if (shape.type === 'rectangle') {
                            const rect = shape.data;
                            if (this._circleIntersectsRectangle(circle, rect)) {
                                const closestX = Math.max(rect.x, Math.min(circleCenter.x, rect.x + rect.width));
                                const closestY = Math.max(rect.y, Math.min(circleCenter.y, rect.y + rect.height));
                                const dSq = this._distSq(circleCenter, { x: closestX, y: closestY });
                                const dist = Math.sqrt(dSq);
                                
                                let dx = circleCenter.x - closestX;
                                let dy = circleCenter.y - closestY;
                                let dirX = dx;
                                let dirY = dy;
                                if (dist > 0.1) {
                                    dirX /= dist;
                                    dirY /= dist;
                                } else {
                                    dirX = 0;
                                    dirY = -1;
                                }

                                const isInsideX = circleCenter.x > rect.x && circleCenter.x < rect.x + rect.width;
                                const isInsideY = circleCenter.y > rect.y && circleCenter.y < rect.y + rect.height;
                                if (isInsideX && isInsideY) {
                                    const distL = circleCenter.x - rect.x;
                                    const distR = (rect.x + rect.width) - circleCenter.x;
                                    const distT = circleCenter.y - rect.y;
                                    const distB = (rect.y + rect.height) - circleCenter.y;
                                    const minDist = Math.min(distL, distR, distT, distB);
                                    if (minDist === distL) { dirX = -1; dirY = 0; }
                                    else if (minDist === distR) { dirX = 1; dirY = 0; }
                                    else if (minDist === distT) { dirX = 0; dirY = -1; }
                                    else { dirX = 0; dirY = 1; }
                                    
                                    const pushAmount = radius + minDist + 1;
                                    pushX += dirX * pushAmount;
                                    pushY += dirY * pushAmount;
                                } else {
                                    const overlap = radius - dist;
                                    pushX += dirX * (overlap + 1);
                                    pushY += dirY * (overlap + 1);
                                }
                                collisionCount++;
                            }
                        } else if (shape.type === 'polygon') {
                            const poly = shape.data;
                            if (this._circleIntersectsPolygon(circle, poly)) {
                                let closestPt = null;
                                let minDistSq = Infinity;
                                for (let i = 0; i < poly.length; i++) {
                                    const p1 = poly[i];
                                    const p2 = poly[(i + 1) % poly.length];
                                    const pt = this._closestPointOnSegment(circleCenter, p1, p2);
                                    const dSq = this._distSq(circleCenter, pt);
                                    if (dSq < minDistSq) {
                                        minDistSq = dSq;
                                        closestPt = pt;
                                    }
                                }
                                if (closestPt) {
                                    const dist = Math.sqrt(minDistSq);
                                    let dx = circleCenter.x - closestPt.x;
                                    let dy = circleCenter.y - closestPt.y;
                                    let dirX = dx;
                                    let dirY = dy;
                                    if (dist > 0.1) {
                                        dirX /= dist;
                                        dirY /= dist;
                                    } else {
                                        dirX = 0;
                                        dirY = -1;
                                    }
                                    if (this.pointInPolygon(circleCenter, poly)) {
                                        dirX = -dirX;
                                        dirY = -dirY;
                                    }
                                    const overlap = radius - dist;
                                    const pushAmount = this.pointInPolygon(circleCenter, poly) ? (radius + dist + 1) : (overlap + 1);
                                    pushX += dirX * pushAmount;
                                    pushY += dirY * pushAmount;
                                    collisionCount++;
                                }
                            }
                        }
                    }
                }
            }
        }

        return { x: pushX, y: pushY, count: collisionCount };
    }

    isValTile(tx, ty) {
        if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) return false;
        if (this.tiles[ty] === undefined || this.tiles[ty][tx] === undefined) return false;
        if (this.tiles[ty][tx] === 0) return false;

        // Block static collidables standing on this exact tile (like Towers)
        if (this.engine && this.engine.gameObjects) {
            for (const obj of this.engine.gameObjects) {
                if (obj.collidable && obj.type !== 'player' && obj.type !== 'enemy' && obj.constructor.name !== 'Player' && obj.constructor.name !== 'Enemy') {
                    if (Math.round(obj.mapX) === tx && Math.round(obj.mapY) === ty) {
                        return false;
                    }
                }
            }
        }

        const centerScreen = this.mapToScreen(tx + 0.5, ty + 0.5);
        const circle = {
            center: { x: centerScreen.x, y: centerScreen.y - 12 },
            radius: 4 // Responsive, smaller checking radius prevents lane blocking
        };

        if (this.collisionLayerData) {
            for (const customShape of this.collisionLayerData) {
                if (this._circleIntersectsPolygon(circle, customShape.vertices)) {
                    return false;
                }
            }
        }

        return true;
    }

    findTilePath(startTX, startTY, endTX, endTY) {
        startTX = Math.max(0, Math.min(this.width - 1, Math.floor(startTX)));
        startTY = Math.max(0, Math.min(this.height - 1, Math.floor(startTY)));
        endTX = Math.max(0, Math.min(this.width - 1, Math.floor(endTX)));
        endTY = Math.max(0, Math.min(this.height - 1, Math.floor(endTY)));

        if (startTX === endTX && startTY === endTY) return [{ x: startTX, y: startTY }];

        const openSet = [];
        const closedSet = new Set();
        const getKey = (x, y) => `${x},${y}`;

        // Heuristic: Euclidean distance
        const h = (x1, y1) => Math.sqrt((x1 - endTX)**2 + (y1 - endTY)**2);

        const openMap = new Map();
        
        const startNode = {
            x: startTX,
            y: startTY,
            g: 0,
            f: h(startTX, startTY),
            parent: null
        };
        openSet.push(startNode);
        openMap.set(getKey(startTX, startTY), 0);

        let closestNode = startNode;
        let minH = startNode.f;

        let iterations = 0;
        const maxIterations = 500;

        while (openSet.length > 0 && iterations < maxIterations) {
            iterations++;
            // Find lowest f
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
            const currKey = getKey(current.x, current.y);
            closedSet.add(currKey);

            if (current.x === endTX && current.y === endTY) {
                closestNode = current;
                break;
            }

            const currentH = h(current.x, current.y);
            if (currentH < minH) {
                minH = currentH;
                closestNode = current;
            }

            // 8-directional neighbors
            const dirs = [
                { x: 0, y: -1, cost: 1 }, { x: 0, y: 1, cost: 1 },
                { x: -1, y: 0, cost: 1 }, { x: 1, y: 0, cost: 1 },
                { x: -1, y: -1, cost: 1.41 }, { x: 1, y: -1, cost: 1.41 },
                { x: -1, y: 1, cost: 1.41 }, { x: 1, y: 1, cost: 1.41 }
            ];

            for (const dir of dirs) {
                const nx = current.x + dir.x;
                const ny = current.y + dir.y;

                if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;

                const isEnd = (nx === endTX && ny === endTY);
                if (!isEnd && !this.isValTile(nx, ny)) continue;

                const neighborKey = getKey(nx, ny);
                if (closedSet.has(neighborKey)) continue;

                const tentativeG = current.g + dir.cost;
                const existingG = openMap.has(neighborKey) ? openMap.get(neighborKey) : Infinity;

                if (tentativeG < existingG) {
                    openMap.set(neighborKey, tentativeG);
                    const nNode = {
                        x: nx,
                        y: ny,
                        g: tentativeG,
                        f: tentativeG + h(nx, ny),
                        parent: current
                    };

                    const idx = openSet.findIndex(n => n.x === nx && n.y === ny);
                    if (idx !== -1) {
                         openSet.splice(idx, 1);
                    }
                    openSet.push(nNode);
                }
            }
        }

        const path = [];
        let curr = closestNode;
        while (curr) {
            path.unshift({ x: curr.x, y: curr.y });
            curr = curr.parent;
        }

        return path;
    }

    findPixelPath(startPx, startPy, endPx, endPy) {
        const startCoords = this.screenToMap(startPx, startPy);
        const endCoords = this.screenToMap(endPx, endPy);

        const tilePath = this.findTilePath(startCoords.x, startCoords.y, endCoords.x, endCoords.y);
        const pixelPath = [];

        for (let i = 1; i < tilePath.length; i++) {
            const center = this.mapToScreen(tilePath[i].x + 0.5, tilePath[i].y + 0.5);
            pixelPath.push({ x: center.x, y: center.y });
        }

        pixelPath.push({ x: endPx, y: endPy });
        return pixelPath;
    }
    // --- End Circle Collision Helper Methods ---


    serialize() {
        // Helper to cleanly copy an object while removing cyclic/engine/DOM elements
        const cleanObj = (obj, seen = new WeakSet()) => {
            if (!obj || typeof obj !== 'object') return obj;
            if (obj instanceof HTMLElement || obj instanceof Image || obj instanceof HTMLCanvasElement) return null;
            if (obj.constructor && obj.constructor !== Object && obj.constructor !== Array && obj.constructor !== Date) {
                return null;
            }
            if (seen.has(obj)) {
                // Break circular references by returning null
                return null;
            }
            seen.add(obj);

            if (Array.isArray(obj)) {
                return obj.map(item => cleanObj(item, seen));
            }
            
            const clean = {};
            for (const key in obj) {
                if (
                    key === 'engine' || 
                    key === 'map' || 
                    key === 'sprite' || 
                    key === 'spriteImage' ||
                    typeof obj[key] === 'function' ||
                    obj[key] instanceof HTMLElement ||
                    obj[key] instanceof Image ||
                    obj[key] instanceof HTMLCanvasElement
                ) {
                    continue;
                }
                clean[key] = cleanObj(obj[key], seen);
            }
            return clean;
        };

        const serializableObjectLayersData = {};
        for (const key in this.objectLayersData) {
            serializableObjectLayersData[key] = this.objectLayersData[key].map(objData => {
                return cleanObj(objData);
            });
        }

        return {
            mapName: this.currentMapName || `UnnamedMap_${Date.now()}`,
            width: this.width,
            height: this.height,
            tiles: cleanObj(this.tiles), 
            customSpritesheets: cleanObj(this.customSpritesheets),
            tileDefinitions: cleanObj(this.tileDefinitions), 
            nextTileId: this.nextTileId,
            objectLayersData: serializableObjectLayersData, 
            collisionLayerData: cleanObj(this.collisionLayerData.map(shape => ({
                id: shape.id, 
                vertices: shape.vertices 
            }))),
            occlusionLayerData: cleanObj(this.occlusionLayerData.map(shape => ({
                id: shape.id,
                vertices: shape.vertices
            }))),
            spawnPointsData: cleanObj(this.spawnPointsData.map(point => ({
                id: point.id,
                x: point.x,
                y: point.y,
                type: point.type,
                targetMap: point.targetMap || null,
                npcData: point.npcData || null,
                enemyId: point.enemyId || null
            }))),
            lightingData: cleanObj(this.lightingData)
        };
    }

    async deserialize(data) {
        try {
            if (!data || typeof data.width !== 'number' || typeof data.height !== 'number' || !Array.isArray(data.tiles) || typeof data.tileDefinitions !== 'object') {
                console.error("Invalid map data for deserialization (core map structure).", data);
                this._initDefaultTileDefinitions();
                this.initializeNewMap(this.width || 20, this.height || 20, 1);
                return false;
            }

            // Before anything else, load custom spritesheets
            this.runtimeSpritesheets = [this.engine.assets.buildingSpritesheet];
            this.customSpritesheets = [];
            const loadingPromises = [];

            if (data.customSpritesheets && Array.isArray(data.customSpritesheets)) {
                this.customSpritesheets = data.customSpritesheets;
                for (const sheetData of this.customSpritesheets) {
                    const img = new Image();
                    const loadPromise = new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = (err) => {
                            console.error(`Failed to load custom spritesheet image: ${sheetData.name}`, err);
                            // Resolve anyway so Promise.all doesn't fail, but sprite will be broken
                            resolve(); 
                        };
                    });
                    loadingPromises.push(loadPromise);
                    img.src = sheetData.dataUrl;
                    this.runtimeSpritesheets.push(img);
                }
            }
            if (loadingPromises.length > 0) {
                await Promise.all(loadingPromises);
                console.log("All custom spritesheets loaded for map.");
            }

            this.width = data.width;
            this.height = data.height;
            this.tiles = JSON.parse(JSON.stringify(data.tiles)); 
            this.currentMapName = data.mapName || null; 

            this.tileDefinitions = {};
            this.nextTileId = 1; 

            for (const id in data.tileDefinitions) {
                if (data.tileDefinitions.hasOwnProperty(id)) {
                    this.addTileDefinitionInternal(parseInt(id), data.tileDefinitions[id].sourceRect, data.tileDefinitions[id].spritesheetIndex || 0);
                }
            }
            if (data.nextTileId && data.nextTileId > this.nextTileId) {
                this.nextTileId = data.nextTileId;
            }
            
            this.objectLayersData = { 'object1': [], 'object2': [] }; 
            this.runtimeGameObjects = [];
            this.collisionLayerData = []; 
            this.occlusionLayerData = [];
            this.spawnPointsData = [];
            this.lightingData = { masks: [] };
            this.chatHistory = []; // Clear chat history on map load

            if (data.objectLayersData && typeof data.objectLayersData === 'object') {
                for (const layerKey in data.objectLayersData) {
                    if (!this.objectLayersData.hasOwnProperty(layerKey)) {
                         console.warn(`Map data contains unknown object layer "${layerKey}". Creating it.`);
                         this.objectLayersData[layerKey] = [];
                    }
                    if (Array.isArray(data.objectLayersData[layerKey])) {
                        data.objectLayersData[layerKey].forEach(objData => {
                            this.objectLayersData[layerKey].push(objData); 
                            const instance = new GameObject(this.engine, this, objData.mapX, objData.mapY, objData);
                            instance.layerKey = layerKey; 
                            this.runtimeGameObjects.push(instance);
                        });
                    }
                }
            }
            this.engine.gameObjects = this.runtimeGameObjects; 

            if (Array.isArray(data.collisionLayerData)) {
                this.collisionLayerData = data.collisionLayerData.map(shapeData => {
                    // Basic validation
                    if (shapeData && shapeData.vertices && Array.isArray(shapeData.vertices)) {
                        return {
                            id: shapeData.id || `custom_coll_poly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            vertices: shapeData.vertices
                        };
                    }
                    return null;
                }).filter(shape => shape !== null);
            }

            if (Array.isArray(data.occlusionLayerData)) {
                this.occlusionLayerData = data.occlusionLayerData.map(shapeData => {
                     if (shapeData && shapeData.vertices && Array.isArray(shapeData.vertices)) {
                        return {
                            id: shapeData.id || `occlusion_poly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            vertices: shapeData.vertices
                        };
                    }
                    return null;
                }).filter(shape => shape !== null);
            }

            if (Array.isArray(data.spawnPointsData)) {
                this.spawnPointsData = data.spawnPointsData.map(pointData => {
                    if (pointData && pointData.x !== undefined && pointData.y !== undefined) {
                        return {
                            id: pointData.id || `spawn_pt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            x: pointData.x,
                            y: pointData.y,
                            type: pointData.type || 'default',
                            targetMap: pointData.targetMap || null,
                            npcData: pointData.npcData || null,
                            enemyId: pointData.enemyId || null
                        };
                    }
                    return null;
                }).filter(point => point !== null);
            }

            if (data.lightingData) {
                this.lightingData = data.lightingData;
                // Ensure new properties exist on loaded masks for backward compatibility
                if (this.lightingData.masks && Array.isArray(this.lightingData.masks)) {
                    this.lightingData.masks.forEach(mask => {
                        mask.smoothing = mask.smoothing === true; // Coerce to boolean
                        mask.smoothingTension = mask.smoothingTension || 0.5;
                        mask.flicker = mask.flicker === true; // Coerce to boolean
                        mask.flickerIntensity = mask.flickerIntensity || 0.1;
                        mask.flickerSpeed = mask.flickerSpeed || 5;
                        mask.visible = mask.visible !== false; // Default to true
                    });
                }
            } else if (data.lightData) {
                console.warn("Map file contains old 'lightData'. This data is ignored by the new lighting system.");
            }

            console.log("Map deserialized successfully. Dimensions:", this.width, "x", this.height, ". Next tile ID:", this.nextTileId, "Objects loaded:", this.runtimeGameObjects.length, "Custom Collisions:", this.collisionLayerData.length, "Occlusion Zones:", this.occlusionLayerData.length, "Spawn Points:", this.spawnPointsData.length);
            return true;
        } catch (error) {
            console.error("Error during map deserialization:", error);
            this._initDefaultTileDefinitions();
            this.initializeNewMap(this.width || 20, this.height || 20, 1);
            return false;
        }
    }
}

export default GameMap;