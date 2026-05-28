// Core Game Logic
// This file will handle the main game loop, state management,
// and coordinate updates between different game modules.

import GameMap from './world/map.js';
import Player from './entities/player.js';
import NPC from './entities/npc.js'; // Future
import Enemy from './entities/enemy.js';
import { GLOBAL_COLLISION_Y_OFFSET } from './entities/gameObject.js';
import EditorManager from './editor/editor_manager.js';
import { SPAWN_TYPES } from './editor/map_editor.js';
import LightSystem from './light_shaders.js';
import DialogueUI from './ui/dialogue.js';
import { extractCharacterDataFromPng } from './utils/char_card_importer.js';
import * as aiAdapter from './ai/novelai_adapter.js';

console.log("rpg/game/engine.js loaded");

const PLAYER_INTERACTION_RADIUS_SQ = 30 * 30; // Squared radius for interaction with spawn points (30px)


class GameEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        if (this.ctx) {
            // Attempt to disable image smoothing immediately upon getting context
            this.ctx.imageSmoothingEnabled = false;
            // Also for cross-browser compatibility, though non-standard
            // this.ctx.mozImageSmoothingEnabled = false;
            // this.ctx.webkitImageSmoothingEnabled = false;
            // this.ctx.msImageSmoothingEnabled = false;
        } else {
             console.error("Failed to get canvas context.");
        }

        this.gameState = {}; // To store current game state
        this.lastTimestamp = 0;
        this.isRunning = false;
        this.isPausedForEditor = false; // For editor pausing game updates
        this.isEditing = false; // For map editor state
        this.zoomLevel = 1.0; // Default zoom level

        this.inputState = {
            left: false,
            right: false,
            up: false,
            down: false,
            action: false
        };

        this.aiAdapter = aiAdapter;
        this.assets = {};
        this.assetPaths = {
            hero: '/scripts/extensions/rpg/game/assets/hero_sprite.png',
            tree: '/scripts/extensions/rpg/game/assets/tree_srite.png',
            buildingSpritesheet: '/scripts/extensions/rpg/game/assets/iso-64x64-building_2.png',
            pencil_icon: '/scripts/extensions/rpg/game/assets/pencil_icon.png',
            eraser_icon: '/scripts/extensions/rpg/game/assets/eraser_icon.png',
            npcSpritesheet: '/scripts/extensions/rpg/game/assets/npc_spritesheet_64x64_6frames.png',
            note_icon: '/scripts/extensions/rpg/game/assets/note_icon.png',
            enemy_slime: '/scripts/extensions/rpg/game/assets/enemy_slime.png',
        };
        this.assetsLoaded = false;
        this.gameObjects = []; // This will now be populated by the map's runtimeGameObjects
        this.effects = []; // For temporary visual effects like telegraphs
        this.editorManager = null;
        this.lightSystem = null;
        this.currentInteractable = null; // To track interactable entities
        this.modalContentElement = null; // For editor UI
        this.dialogueUI = null; // For NPC conversations

        // AI reaction queue is no longer needed here
        // this.npcReactionQueue = [];
        // this.isProcessingNpcReaction = false;
        
        // Bind gameLoop to this instance to maintain context
        this.gameLoop = this.gameLoop.bind(this);
        this._handleKeyDown = this._handleKeyDown.bind(this);
        this._handleKeyUp = this._handleKeyUp.bind(this);
    }

    addEffect(effect) {
        this.effects.push(effect);
    }

    removeEffect(effect) {
        const index = this.effects.indexOf(effect);
        if (index > -1) {
            this.effects.splice(index, 1);
        }
    }

    setModalContentElement(element) {
        this.modalContentElement = element;
    }

    async _loadAssets() {
        const loadImage = (path) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = (err) => {
                    console.error(`Failed to load image: ${path}`, err);
                    reject(new Error(`Failed to load image: ${path}`));
                };
                img.src = path;
            });
        };

        try {
            // Destructure assignments need to match the order of promises
            const loadedAssets = await Promise.all([
                loadImage(this.assetPaths.hero),
                loadImage(this.assetPaths.tree),
                loadImage(this.assetPaths.buildingSpritesheet),
                loadImage(this.assetPaths.pencil_icon),
                loadImage(this.assetPaths.eraser_icon),
                loadImage(this.assetPaths.npcSpritesheet),
                loadImage(this.assetPaths.note_icon),
                loadImage(this.assetPaths.enemy_slime),
            ]);
            this.assets.hero = loadedAssets[0];
            this.assets.tree = loadedAssets[1];
            this.assets.buildingSpritesheet = loadedAssets[2];
            this.assets.pencil_icon = loadedAssets[3];
            this.assets.eraser_icon = loadedAssets[4];
            this.assets.npcSpritesheet = loadedAssets[5];
            this.assets.note_icon = loadedAssets[6];
            this.assets.enemy_slime = loadedAssets[7];

            this.assetsLoaded = true;
            console.log("All game assets loaded successfully.");
        } catch (error) {
            console.error("Error loading game assets:", error);
            if (this.ctx) { // Ensure ctx is available before drawing
                this.ctx.fillStyle = 'red';
                this.ctx.font = '16px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(`Error loading assets. Check console. ${error.message}`, this.canvas.width / 2, this.canvas.height / 2);
            }
        }
    }

    setZoom(level) {
        // Clamp zoom level (e.g., 50% to 400%)
        this.zoomLevel = Math.max(0.5, Math.min(4, level)); 
        // If map exists, update its understanding of effective canvas size if needed
        if (this.map) {
           // The camera centering logic will use this.zoomLevel directly
        }
    }

    zoomIn() {
        this.setZoom(this.zoomLevel + 0.1);
    }

    zoomOut() {
        this.setZoom(this.zoomLevel - 0.1);
    }

    _initInputHandlers() {
        window.addEventListener('keydown', this._handleKeyDown);
        window.addEventListener('keyup', this._handleKeyUp);
    }

    _removeInputHandlers() {
        window.removeEventListener('keydown', this._handleKeyDown);
        window.removeEventListener('keyup', this._handleKeyUp);
    }

    _handleKeyDown(event) {
        // Prevent default browser action for arrow keys, space, etc.
        // Allow text input if an input field is focused (e.g. map name prompt)
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(event.code)) {
            event.preventDefault();
        }
        switch (event.code) {
            case 'ArrowLeft': case 'KeyA': this.inputState.left = true; break;
            case 'ArrowRight': case 'KeyD': this.inputState.right = true; break;
            case 'ArrowUp': case 'KeyW': this.inputState.up = true; break;
            case 'ArrowDown': case 'KeyS': this.inputState.down = true; break;
            case 'Space': case 'Enter': this.inputState.action = true; break;
        }
    }

    _handleKeyUp(event) {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }
        switch (event.code) {
            case 'ArrowLeft': case 'KeyA': this.inputState.left = false; break;
            case 'ArrowRight': case 'KeyD': this.inputState.right = false; break;
            case 'ArrowUp': case 'KeyW': this.inputState.up = false; break;
            case 'ArrowDown': case 'KeyS': this.inputState.down = false; break;
            case 'Space': case 'Enter': this.inputState.action = false; break;
        }
    }

    checkForInteractables() {
        this.currentInteractable = null; // Reset every frame
        if (!this.player || !this.map || (this.editorManager && this.editorManager.isEditorActive())) return;

        // Find the closest interactable within range
        let closestInteractable = null;
        let closestDistSq = PLAYER_INTERACTION_RADIUS_SQ;

        // Check spawn points
        if (this.map.spawnPointsData) {
            for (const spawnPoint of this.map.spawnPointsData) {
                if (spawnPoint.type === SPAWN_TYPES.PLAYER_EXIT) {
                    const dx = this.player.currentPixelX - spawnPoint.x;
                    const dy = this.player.currentPixelY - spawnPoint.y;
                    const distSq = dx * dx + dy * dy;

                    if (distSq < closestDistSq) {
                        closestDistSq = distSq;
                        closestInteractable = {
                            type: 'spawn_point',
                            data: spawnPoint
                        };
                    }
                }
            }
        }

        // Check NPCs
        for (const obj of this.gameObjects) {
            if (obj instanceof NPC) {
                const dx = this.player.currentPixelX - obj.currentPixelX;
                const dy = this.player.currentPixelY - obj.currentPixelY;
                const distSq = dx * dx + dy * dy;

                if (distSq < closestDistSq) {
                    closestDistSq = distSq;
                    closestInteractable = {
                        type: 'npc',
                        data: obj // The NPC instance itself
                    };
                }
            }
        }

        // Check Note objects
        for (const obj of this.gameObjects) {
            // The type is defined in the palette.
            if (obj.type === 'note') {
                const dx = this.player.currentPixelX - obj.currentPixelX;
                const dy = this.player.currentPixelY - obj.currentPixelY;
                const distSq = dx * dx + dy * dy;

                if (distSq < closestDistSq) {
                    closestDistSq = distSq;
                    closestInteractable = {
                        type: 'note_object',
                        data: obj
                    };
                }
            }
        }

        this.currentInteractable = closestInteractable;
    }

    pauseGameUpdates() {
        this.isPausedForEditor = true;
        console.log("Game updates paused for editor.");
    }

    resumeGameUpdates() {
        this.isPausedForEditor = false;
        this.lastTimestamp = performance.now(); // Reset timestamp to avoid large deltaTime jump
        console.log("Game updates resumed.");
    }

    toggleEditorMode() {
        this.editorManager.toggle('map');
    }

    isEditorActive() {
        return this.editorManager ? this.editorManager.isEditorActive() : false;
    }

    toggleNpcCreator() {
        this.editorManager.toggle('npc');
    }

    isNpcCreatorActive() {
        return this.editorManager ? this.editorManager.isEditorActive('npc') : false;
    }

    toggleLightEditor() {
        this.editorManager.toggle('light');
    }

    isLightEditorActive() {
        return this.editorManager ? this.editorManager.isEditorActive('light') : false;
    }

    /*
    // These methods are no longer used as NPC reactions are handled directly in DialogueUI
    queueNpcReaction(npc, latestMessage, primaryNpc, history) {
        // this.npcReactionQueue.push({ npc, latestMessage, primaryNpc, history });
        // // If not already processing, start.
        // if (!this.isProcessingNpcReaction) {
        //     this._processNpcReactionQueue();
        // }
        console.warn("engine.queueNpcReaction called, but this system is deprecated.");
    }

    async _processNpcReactionQueue() {
        // if (this.npcReactionQueue.length === 0) {
        //     this.isProcessingNpcReaction = false;
        //     return;
        // }
    
        // this.isProcessingNpcReaction = true;
        // const request = this.npcReactionQueue.shift(); // Get the first request
    
        // try {
        //     // The NPC's reactToConversation is async and will await the AI response
        //     await request.npc.reactToConversation(request.latestMessage, request.primaryNpc, request.history);
        // } catch (error) {
        //     console.error(`Error processing NPC reaction for ${request.npc.name}:`, error);
        // }
    
        // // Process the next item in the queue.
        // // Using a small timeout to prevent locking up the event loop if many reactions are queued.
        // setTimeout(() => this._processNpcReactionQueue(), 100);
        console.warn("engine._processNpcReactionQueue called, but this system is deprecated.");
    }
    */

    async start() {
        if (!this.ctx) {
            console.error("Engine: Canvas context not available, cannot start.");
            return;
        }

        await this._loadAssets();
        if (!this.assetsLoaded) {
            console.error("Assets not loaded, cannot start game engine.");
            // Error message is drawn in _loadAssets if canvas context was available
            return;
        }

        this.isRunning = true;
        this.lastTimestamp = performance.now();

        this.map = new GameMap(20, 20, this); // Map initializes its own objects now
        this.editorManager = new EditorManager(this, this.modalContentElement);
        this.lightSystem = new LightSystem(this, this.map.getLightingData());
        this.dialogueUI = new DialogueUI(this);
        // GameObjects will be loaded by map.deserialize or map.initializeNewMap
        // For a new map, it will be empty of objects until placed by editor.
        // If a default map with objects is desired, map.initializeNewMap should handle it or load from a default JSON.
        this.gameObjects = this.map.getRuntimeGameObjects();

        // Player initialization: find a 'player_entry' spawn point
        let playerInitialMapX = this.map.width / 2;
        let playerInitialMapY = this.map.height / 2;

        const playerEntrySpawn = this.map.spawnPointsData.find(sp => sp.type === SPAWN_TYPES.PLAYER_ENTRY);
        if (playerEntrySpawn) {
            const spawnMapCoords = this.map.screenToMap(playerEntrySpawn.x, playerEntrySpawn.y);
            playerInitialMapX = spawnMapCoords.x;
            playerInitialMapY = spawnMapCoords.y;
            console.log(`Player starting at PLAYER_ENTRY spawn: Map(${playerInitialMapX.toFixed(2)}, ${playerInitialMapY.toFixed(2)}), World(${playerEntrySpawn.x}, ${playerEntrySpawn.y})`);
        } else {
            console.warn("No PLAYER_ENTRY spawn point found on map. Defaulting player to map center.");
        }
        
        this.player = new Player(playerInitialMapX, playerInitialMapY, this.map, this);
        this.player.loadCharacterData({ name: "Hero" });
        
        await this._initializeNPCs();
        await this._initializeEnemies();

        // _addGameObjects() is removed, map handles its objects.
        // If you need initial objects for a fresh map, they should be added via map.addGameObject
        // or be part of a default map JSON that gets loaded.
        // For testing, we can manually add some if the map doesn't load them:
        if (this.map.getRuntimeGameObjects().length === 0) {
            this._addDefaultObjectsForTesting(); // Add this method for now
        }

        this._initInputHandlers();

        const effectiveCanvasWidth = this.canvas.width / this.zoomLevel;
        const effectiveCanvasHeight = this.canvas.height / this.zoomLevel;
        this.map.centerOn(this.player.currentPixelX, this.player.currentPixelY, effectiveCanvasWidth, effectiveCanvasHeight);

        console.log("Game Engine Started. Player and Map initialized.");
        requestAnimationFrame(this.gameLoop);
    }

    // Temporary method to add some default objects if map loads empty
    _addDefaultObjectsForTesting() {
        console.log("Adding default objects for testing as map is empty.");
        const SPRITE_SIZE = 64;
        const PADDING = 2;
        const tableSpriteSourceRect = { 
            x: 1 * (SPRITE_SIZE + PADDING), 
            y: 5 * (SPRITE_SIZE + PADDING), 
            width: SPRITE_SIZE, 
            height: SPRITE_SIZE 
        };
        const tableConfig = {
            assetName: 'buildingSpritesheet',
            spriteSourceRect: tableSpriteSourceRect,
            collidable: true,
            collisionShape: { type: 'rectangle', width: 30, height: 16, xOffset: -15, yOffset: -16 },
            anchorOffsetX: 32,
            anchorOffsetY: 64,
            visualWidth: 64,
            visualHeight: 64,
        };
        this.map.addGameObject('object1', tableConfig, 7.5, 7.5);

        const treeSpriteAsset = this.assets.tree;
        const treeScaleFactor = 2; // Assuming this scaling is desired for visual
        const scaledTreeWidth = treeSpriteAsset.width * treeScaleFactor;
        const scaledTreeHeight = treeSpriteAsset.height * treeScaleFactor;

        // Define tree base for collision diamond relative to the *original* sprite size,
        // as visual scaling doesn't change the fundamental proportions for collision.
        // Or, if collision should scale, use scaled dimensions. Let's assume collision based on original sprite.
        const treeBaseSpriteWidth = treeSpriteAsset.width * 0.5; // Effective width of the trunk area
        const treeBaseSpriteHeight = treeSpriteAsset.height * 0.2; // Effective height of the trunk/root area for diamond
        
        const treeCollisionHalfWidth = treeBaseSpriteWidth / 2;
        const treeCollisionHalfHeight = treeBaseSpriteHeight / 2;

        const treeConfig = {
            assetName: 'tree',
            collidable: true,
            collisionShape: { 
                type: 'polygon', 
                vertices: [ // Vertices are relative to the anchor point
                    { x: 0, y: -treeCollisionHalfHeight },    // Top of diamond
                    { x: treeCollisionHalfWidth, y: 0 },    // Right of diamond
                    { x: 0, y: treeCollisionHalfHeight },   // Bottom of diamond
                    { x: -treeCollisionHalfWidth, y: 0 }    // Left of diamond
                ]
            },
            visualWidth: scaledTreeWidth, // Scaled for rendering
            visualHeight: scaledTreeHeight, // Scaled for rendering
            anchorOffsetX: scaledTreeWidth / 2, // Anchor relative to scaled visual
            anchorOffsetY: scaledTreeHeight * 0.95, // Anchor near base of scaled visual
        };
        this.map.addGameObject('object1', treeConfig, 10, 7);
        this.gameObjects = this.map.getRuntimeGameObjects(); // Refresh engine's list
    }

    stop() {
        this.isRunning = false;
        if (this.editorManager) {
            this.editorManager.hideAll();
        }
        this._removeInputHandlers();
        console.log("Game Engine Stopped");
    }

    gameLoop(timestamp) {
        if (!this.isRunning) return;

        const deltaTime = (timestamp - this.lastTimestamp) / 1000;
        this.lastTimestamp = timestamp;

        if (!this.isPausedForEditor) { // Only update if not paused by editor
            this.update(deltaTime);
        }
        this.render();

        requestAnimationFrame(this.gameLoop);
    }

    update(deltaTime) {
        // Player updates regardless of editor state, allowing movement while editing.
        // Player collision now uses this.gameObjects which is this.map.getRuntimeGameObjects()
        // and map.collisionLayerData
        this.player.update(deltaTime, this.inputState);

        this.checkForInteractables();

        // Player interaction with spawn points
        if (this.inputState.action && this.editorManager && !this.editorManager.isEditorActive() && this.currentInteractable) { // Only interact if not editing and something is interactable
            this.handlePlayerInteraction();
            this.inputState.action = false; // Consume action
        }

        const effectiveCanvasWidth = this.canvas.width / this.zoomLevel;
        const effectiveCanvasHeight = this.canvas.height / this.zoomLevel;
        this.map.centerOn(this.player.currentPixelX, this.player.currentPixelY, effectiveCanvasWidth, effectiveCanvasHeight);

        // Update game objects (e.g., for animations, though not used yet)
        // Iterate over a copy of the array to allow for safe removal during the loop.
        for (const obj of [...this.gameObjects]) {
            obj.update(deltaTime);
        }

        // Update effects
        for (const effect of [...this.effects]) {
            effect.update(deltaTime);
        }

        // Update light system for animations like flicker
        if (this.lightSystem) {
            this.lightSystem.update(deltaTime);
        }

        // NEW: Resolve collisions between dynamic entities to prevent stacking
        this.resolveDynamicCollisions();
    }

    resolveDynamicCollisions() {
        const dynamicEntities = [];
        if (this.player && this.player.stats.hp > 0) {
            dynamicEntities.push(this.player);
        }
        for (const obj of this.gameObjects) {
            if (obj instanceof Enemy && obj.collidable && obj.stats.hp > 0) {
                dynamicEntities.push(obj);
            }
        }

        const iterations = 4; // Multiple iterations help settle complex overlaps
        for (let iter = 0; iter < iterations; iter++) {
            for (let i = 0; i < dynamicEntities.length; i++) {
                for (let j = i + 1; j < dynamicEntities.length; j++) {
                    const entityA = dynamicEntities[i];
                    const entityB = dynamicEntities[j];

                    const centerA = { x: entityA.currentPixelX, y: entityA.currentPixelY - GLOBAL_COLLISION_Y_OFFSET };
                    const centerB = { x: entityB.currentPixelX, y: entityB.currentPixelY - GLOBAL_COLLISION_Y_OFFSET };

                    const dx = centerB.x - centerA.x;
                    const dy = centerB.y - centerA.y;
                    const distSq = dx * dx + dy * dy;
                    const combinedRadius = entityA.collisionRadius + entityB.collisionRadius;

                    if (distSq < combinedRadius * combinedRadius && distSq > 0) {
                        const dist = Math.sqrt(distSq);
                        const overlap = combinedRadius - dist;
                        const pushX = (dx / dist) * overlap;
                        const pushY = (dy / dist) * overlap;
                        
                        const massA = entityA.mass || 1;
                        const massB = entityB.mass || 1;
                        const totalMass = massA + massB;

                        const pushRatioA = massB / totalMass;
                        const pushRatioB = massA / totalMass;
                        
                        entityA.currentPixelX -= pushX * pushRatioA;
                        entityA.currentPixelY -= pushY * pushRatioA;
                        if (typeof entityA.updateMapCoordsFromPixels === 'function') entityA.updateMapCoordsFromPixels();

                        entityB.currentPixelX += pushX * pushRatioB;
                        entityB.currentPixelY += pushY * pushRatioB;
                        if (typeof entityB.updateMapCoordsFromPixels === 'function') entityB.updateMapCoordsFromPixels();

                    } else if (distSq === 0) {
                        // Entities are exactly on top of each other. Push them apart on a default axis.
                        entityA.currentPixelX -= 0.5;
                        entityB.currentPixelX += 0.5;
                        if (typeof entityA.updateMapCoordsFromPixels === 'function') entityA.updateMapCoordsFromPixels();
                        if (typeof entityB.updateMapCoordsFromPixels === 'function') entityB.updateMapCoordsFromPixels();
                    }
                }
            }
        }
    }

    render() {
        if (!this.ctx) {
            console.error("Engine: Canvas context not available for rendering.");
            return;
        }

        this.ctx.fillStyle = '#3B322C';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.scale(this.zoomLevel, this.zoomLevel);

        this.ctx.imageSmoothingEnabled = false;

        // Saturation filter is removed, handled by light masks if desired
        const effectiveCanvasWidth = this.canvas.width / this.zoomLevel;
        const effectiveCanvasHeight = this.canvas.height / this.zoomLevel;
        const viewOriginX = this.map.cameraX - effectiveCanvasWidth / 2;
        const viewOriginY = this.map.cameraY - effectiveCanvasHeight / 2;

        if (this.map) {
            // Map render will handle its own alpha for tile layer if editor is on object layer
            this.map.render(this.ctx, this.canvas, viewOriginX, viewOriginY);
        }

        const renderables = [this.player, ...this.gameObjects, ...this.effects]; // gameObjects from map, plus effects

        renderables.sort((a, b) => {
            const yA = a.getSortY ? a.getSortY() : (a.currentPixelY || 0);
            const yB = b.getSortY ? b.getSortY() : (b.currentPixelY || 0);
            return yA - yB;
        });

        const activeEditor = this.editorManager.getActiveEditor();
        const currentEditorLayer = (activeEditor && activeEditor.currentLayer) ? activeEditor.currentLayer : null;

        for (const entity of renderables) {
            this.ctx.save();
            let applyAlpha = false;
            if (activeEditor && entity !== this.player) { // Don't fade player
                const objectLayerKey = entity.layerKey; 
                if (objectLayerKey) { 
                    if (currentEditorLayer === 'object1' || currentEditorLayer === 'object2') {
                        if (objectLayerKey !== currentEditorLayer) {
                            applyAlpha = true; 
                        }
                    } else if (currentEditorLayer === 'collision') {
                        // When on collision layer, game objects are not faded by this logic,
                        // their collision bounds are drawn by the editor overlay.
                        // The tile layer is already faded by map.render().
                    }
                }
            }
            if (applyAlpha) {
                this.ctx.globalAlpha = 0.5;
            }
            entity.render(this.ctx, viewOriginX, viewOriginY);
            this.ctx.restore(); // Restore alpha for next entity
        }
        
        // Render light system overlay after the main world drawing but before editor overlays
        if (this.lightSystem) {
            this.lightSystem.render(viewOriginX, viewOriginY);
        }


        // Editor overlays are drawn in world space, but translated by viewOrigin in the editor's renderOverlay method
        // The context is already scaled by zoomLevel at this point.
        if (activeEditor) {
            this.ctx.save();
            this.ctx.translate(-viewOriginX, -viewOriginY);
            this.editorManager.renderOverlay(this.ctx);
            this.ctx.restore();
        }

        this.ctx.restore(); 

        // RENDER UI on top of everything, in screen space
        if (this.currentInteractable && this.editorManager && !this.editorManager.isEditorActive()) {
            this.renderInteractPrompt();
        }

        this.renderPlayerUI();

        this.ctx.font = '12px Arial';
        this.ctx.fillStyle = 'white'; 
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Player Map Coords: ${this.player.mapX.toFixed(2)}, ${this.player.mapY.toFixed(2)}`, 10, 20);
        this.ctx.fillText(`Player Pixel Coords: ${this.player.currentPixelX.toFixed(0)}, ${this.player.currentPixelY.toFixed(0)}`, 10, 40);
        this.ctx.fillText(`Camera World Coords: ${this.map.cameraX.toFixed(0)}, ${this.map.cameraY.toFixed(0)}`, 10, 60);
        this.ctx.fillText(`Zoom: ${this.zoomLevel.toFixed(2)}x`, 10, 80);
        if (activeEditor) {
            const editorName = Object.keys(this.editorManager.editors).find(key => this.editorManager.editors[key] === activeEditor);
            this.ctx.fillText(`Editor: ${editorName}`, 10, 100);

            if (editorName === 'map') {
                const mapEditor = activeEditor;
                this.ctx.fillText(`Layer: ${mapEditor.currentLayer}`, 10, 120);
                if (mapEditor.currentLayer === 'spawn' && mapEditor.currentTool === 'place') {
                    const selectedSpawnType = mapEditor.uiManager.getSelectedSpawnType();
                    let spawnInfo = `Placing: ${selectedSpawnType}`;
                    if (selectedSpawnType === SPAWN_TYPES.PLAYER_EXIT) {
                        const targetMap = mapEditor.uiManager.getTargetMapValue();
                        spawnInfo += ` -> ${targetMap || '(No target map specified)'}`;
                    }
                    this.ctx.fillText(spawnInfo, 10, 140);
                }
            }
        }
    }

    renderPlayerUI() {
        if (!this.player) return;

        // HP Bar
        const hpBarX = 10;
        const hpBarY = this.canvas.height - 30;
        const hpBarWidth = 200;
        const hpBarHeight = 20;

        // Background
        this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
        this.ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);
        
        // Health
        const hpRatio = this.player.stats.hp / this.player.stats.maxHp;
        this.ctx.fillStyle = '#e74c3c'; // Red for HP
        this.ctx.fillRect(hpBarX, hpBarY, hpBarWidth * hpRatio, hpBarHeight);

        // Text
        this.ctx.fillStyle = 'white';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(`HP: ${this.player.stats.hp} / ${this.player.stats.maxHp}`, hpBarX + hpBarWidth / 2, hpBarY + hpBarHeight / 2);

    }

    renderInteractPrompt() {
        if (!this.currentInteractable) return;

        let promptText = '';
        const { type, data } = this.currentInteractable;
        const actionKey = 'Action'; // Could be configured later, maps to Enter/Space

        switch (type) {
            case 'npc':
                promptText = `[${actionKey}] Talk to ${data.name}`;
                break;
            case 'spawn_point':
                if (data.type === SPAWN_TYPES.PLAYER_EXIT) {
                    promptText = `[${actionKey}] Go to ${data.targetMap || '???'}`;
                }
                break;
            case 'note_object':
                promptText = `[${actionKey}] Read note`;
                break;
            default:
                // Don't show a prompt for unknown or unhandled types
                return;
        }

        if (!promptText) return;

        // Draw this text at the bottom center of the screen
        const x = this.canvas.width / 2;
        const y = this.canvas.height - 60; // Position above the player HP bar

        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        const textWidth = this.ctx.measureText(promptText).width;
        const boxWidth = textWidth + 20;
        const boxHeight = 30;
        const boxX = x - boxWidth / 2;
        const boxY = y - boxHeight / 2;
        
        this.ctx.fillStyle = 'rgba(44, 36, 29, 0.85)';
        this.ctx.strokeStyle = '#8C6D56';
        this.ctx.lineWidth = 2;
        
        // Use a standard rect as roundRect might not be universally supported
        this.ctx.beginPath();
        this.ctx.rect(boxX, boxY, boxWidth, boxHeight);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.fillStyle = '#EFEBE0';
        this.ctx.fillText(promptText, x, y);
    }

    handlePlayerInteraction() {
        if (!this.currentInteractable) return;

        const { type, data } = this.currentInteractable;

        if (type === 'spawn_point' && data.type === SPAWN_TYPES.PLAYER_EXIT) {
            console.log(`Player interacted with PLAYER_EXIT: ${data.id}, targetMap: ${data.targetMap}`);
            if (data.targetMap) {
                this.requestMapTransition(data.targetMap);
            } else {
                console.warn(`PLAYER_EXIT point ${data.id} has no targetMap defined.`);
                // Optionally, provide feedback to player: e.g., "This exit leads nowhere yet."
            }
            return; // Handle one interaction at a time
        }

        if (type === 'npc') {
            // Find notes on the map to build context for the conversation
            const notes = this.gameObjects.filter(obj => obj.type === 'note' && obj.customData && obj.customData.text);
            const mapContext = notes.map(note => note.customData.text).join('\n\n');
            data.onInteract(mapContext || null); // Pass context to NPC
            return;
        }

        if (type === 'note_object') {
            alert(`A note reads:\n\n"${data.customData.text}"`);
            return;
        }
    }

    async requestMapTransition(targetMapName, targetSpawnId = null) {
        console.log(`Requesting transition to map: ${targetMapName}`);
        // Show loading indicator
        this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = 'white';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Loading ${targetMapName}...`, this.canvas.width / 2, this.canvas.height / 2);


        const newMapData = await this.loadMapByName(targetMapName);

        if (newMapData) {
            await this.loadMap(newMapData, 'player_entry', targetSpawnId);
        } else {
            console.error(`Failed to find map data for ${targetMapName}.`);
             // Revert or show error to player
        }
        // Hide loading indicator implicitly by next render cycle
    }

    async loadMap(mapData, newPlayerSpawnType = 'player_entry', targetSpawnId = null) {
        if (!mapData) {
            console.error("loadMap called with null or undefined map data.");
            return false;
        }

        // Create a new map instance and deserialize the data into it.
        const newMapInstance = new GameMap(mapData.width, mapData.height, this);
        const success = await newMapInstance.deserialize(mapData);

        if (!success) {
            console.error("Failed to deserialize map data during loadMap.");
            return false;
        }

        // --- MAP IS LOADED, NOW UPDATE ENGINE/PLAYER STATE ---

        // Find spawn point and determine new player coordinates
        let playerNewMapX = newMapInstance.width / 2;
        let playerNewMapY = newMapInstance.height / 2;
        let entrySpawn = null;
        if (targetSpawnId) {
            entrySpawn = newMapInstance.spawnPointsData.find(sp => sp.id === targetSpawnId && sp.type === newPlayerSpawnType);
        }
        if (!entrySpawn) { // Fallback to any spawn of the correct type
            entrySpawn = newMapInstance.spawnPointsData.find(sp => sp.type === newPlayerSpawnType);
        }
        
        if (entrySpawn) {
            const spawnMapCoords = newMapInstance.screenToMap(entrySpawn.x, entrySpawn.y);
            playerNewMapX = spawnMapCoords.x;
            playerNewMapY = spawnMapCoords.y;
        } else {
            console.warn(`No spawn point of type '${newPlayerSpawnType}' (or specified ID ${targetSpawnId}) found on map. Defaulting player to map center.`);
        }

        // Update player's state with new coordinates and map reference
        this.player.map = newMapInstance;
        this.player.mapX = playerNewMapX;
        this.player.mapY = playerNewMapY;
        const newPlayerScreenPos = newMapInstance.mapToScreen(playerNewMapX, playerNewMapY);
        this.player.currentPixelX = newPlayerScreenPos.x;
        this.player.currentPixelY = newPlayerScreenPos.y;

        // Update engine's state
        this.map = newMapInstance;
        this.gameObjects = this.map.getRuntimeGameObjects();
        
        // Recenter camera immediately
        const effectiveCanvasWidth = this.canvas.width / this.zoomLevel;
        const effectiveCanvasHeight = this.canvas.height / this.zoomLevel;
        this.map.centerOn(this.player.currentPixelX, this.player.currentPixelY, effectiveCanvasWidth, effectiveCanvasHeight);

        // Update editor states for the new map
        if (this.editorManager) {
            // Update Map Editor instance
            const mapEditor = this.editorManager.editors.map;
            if (mapEditor) {
                mapEditor.map = this.map;
                mapEditor.initializeSpritesheets();
                mapEditor.clearBrushes();
                mapEditor.currentPolygonVertices = [];
                if (this.editorManager.isEditorActive('map')) {
                    mapEditor.updateLayerDisplay();
                }
            }
            // Update Light Editor instance
            const lightEditor = this.editorManager.editors.light;
            if (lightEditor) {
                lightEditor.map = this.map;
                lightEditor.selectedMask = null; // Deselect any mask from old map
                if (this.editorManager.isEditorActive('light')) {
                    lightEditor.refreshUI();
                }
            }
        }

        // Update Light System renderer
        this.lightSystem.updateData(this.map.getLightingData());
        
        // Initialize NPCs and Enemies
        await this._initializeNPCs();
        await this._initializeEnemies();

        console.log(`Successfully loaded map: ${this.map.currentMapName}`);
        return true;
    }

    async loadMapByName(mapName) {
        // For now, only loads from localStorage. Future: could check server, etc.
        const mapKey = `rpgEditor_map_${mapName}`; // Matches EditorMapOperations prefix
        const mapString = localStorage.getItem(mapKey);
        if (mapString) {
            try {
                return JSON.parse(mapString);
            } catch (e) {
                console.error(`Error parsing map data from localStorage for ${mapName}:`, e);
                return null;
            }
        } else {
            console.warn(`Map ${mapName} not found in localStorage.`);
            return null;
        }
    }

    // --- NPC Management ---
    async _fetchCharacterData(characterFileName) {
        // In production, this would use SillyTavern's API
        // For mock, we parse the provided character card.
        const characterUrl = `/scripts/extensions/rpg/data/characters/${characterFileName}`;
        try {
            const data = await extractCharacterDataFromPng(characterUrl);
            if (data) {
                console.log(`Successfully parsed character data for ${characterFileName}`);
                // Add the avatar URL to the data object so the UI can use it
                data.avatarUrl = characterUrl;
                // Use `char_name` if `name` is not present, which is common in cards
                data.name = data.name || data.char_name;
                data.first_mes = data.first_mes || "Hello.";
                // Pave the way for reactive avatars
                data.dialogue_avatars = {
                    main: data.avatarUrl,
                    reactive: data.dialogue_avatars ? (data.dialogue_avatars.reactive || []).map(ra => ({
                        keyword: ra.keyword || '',
                        dataUrl: ra.dataUrl || null // Ensure dataUrl is present
                    })) : [] // Initialize reactive avatars from loaded data if they exist
                };
                 // Ensure main avatar is set correctly from loaded data if it exists
                if (data.dialogue_avatars.main) {
                     data.avatarUrl = data.dialogue_avatars.main;
                }


                return data;
            } else {
                console.warn(`Could not parse character data from ${characterFileName}. Using fallback "Lanna".`);
                // Fallback to default character "Lanna"
                const fallbackData = {
                    name: "Lanna",
                    description: "A cheerful and helpful guide who seems to know a lot about this world. She has bright, curious eyes and a warm smile.",
                    personality: "Bubbly, optimistic, knowledgeable, eager to help",
                    first_mes: "Hey there, stranger! You look a bit new to these parts. Don't you worry, Lanna's here to help! What's on your mind?",
                    mes_example: "{{user}}: Where can I find a good sword?\nLanna: Ooh, a sword! You should check out the blacksmith down by the town square. He's a bit grumpy, but his steel is the best around!",
                    avatarUrl: '/scripts/extensions/rpg/game/assets/character_dialogue_image.png', // Use a default image for Lanna
                };
                fallbackData.dialogue_avatars = {
                    main: fallbackData.avatarUrl,
                    reactive: []
                };
                return fallbackData;
            }
        } catch (error) {
            console.error(`Error fetching or parsing character card ${characterFileName}:`, error);
            // Return Lanna on error as well
            const fallbackData = {
                name: "Lanna",
                description: "A cheerful and helpful guide who seems to know a lot about this world. She has bright, curious eyes and a warm smile.",
                personality: "Bubbly, optimistic, knowledgeable, eager to help",
                first_mes: "Hey there, stranger! You look a bit new to these parts. Don't you worry, Lanna's here to help! What's on your mind?",
                mes_example: "{{user}}: Where can I find a good sword?\nLanna: Ooh, a sword! You should check out the blacksmith down by the town square. He's a bit grumpy, but his steel is the best around!",
                avatarUrl: '/scripts/extensions/rpg/game/assets/character_dialogue_image.png',
            };
            fallbackData.dialogue_avatars = {
                main: fallbackData.avatarUrl,
                reactive: []
            };
            return fallbackData;
        }
    }

    async _initializeNPCs() {
        // Import character list dynamically for random NPCs
        let availableCharacters = [];
        try {
            const characterListModule = await import('../data/character-list.js');
            availableCharacters = characterListModule.character_cards || [];
            console.log("Loaded available characters from character-list.js:", availableCharacters);
        } catch (error) {
            console.error("Error loading character list for random NPCs:", error);
            availableCharacters = ['Test Chara.png']; // Fallback
        }

        // 1. Clear any existing NPCs from the previous map
        this.gameObjects = this.gameObjects.filter(obj => !(obj instanceof NPC));

        // 2. Spawn permanent NPCs from map data
        const permanentNpcSpawns = this.map.spawnPointsData.filter(sp => sp.type === SPAWN_TYPES.NPC_PERMANENT && sp.npcData);
        console.log(`Found ${permanentNpcSpawns.length} permanent NPC spawn points.`);
        for (const spawnPoint of permanentNpcSpawns) {
            const characterData = spawnPoint.npcData;
            const mapCoords = this.map.screenToMap(spawnPoint.x, spawnPoint.y);
            
            let npcOptions = {
                id: `npc_permanent_${spawnPoint.id}`,
                name: characterData.name
            };

            const mapSpriteData = characterData.map_sprite;
            if (mapSpriteData.type === 'spritesheet') {
                npcOptions.assetName = 'npcSpritesheet';
                npcOptions.spriteSourceRect = { x: (mapSpriteData.source || 0) * 64, y: 0, width: 64, height: 64 };
            } else if (mapSpriteData.type === 'custom' && typeof mapSpriteData.source === 'string') {
                const customSprite = new Image();
                customSprite.src = mapSpriteData.source; // dataUrl
                // Pass the image object directly; GameObject constructor will handle it.
                // The image will render once it's loaded by the browser.
                npcOptions.spriteImage = customSprite;
            }

            const npc = new NPC(this, this.map, mapCoords.x, mapCoords.y, npcOptions);
            npc.loadCharacterData(characterData);
            this.gameObjects.push(npc);
            console.log(`Spawned permanent NPC '${npc.name}' at map coords (${mapCoords.x.toFixed(2)}, ${mapCoords.y.toFixed(2)}).`);
        }

        // 3. Spawn random NPCs at generic NPC spawn points
        const randomNpcSpawns = this.map.spawnPointsData.filter(sp => sp.type === SPAWN_TYPES.NPC);
        console.log(`Found ${randomNpcSpawns.length} random NPC spawn points.`);

        if (randomNpcSpawns.length > 0 && availableCharacters.length === 0) {
            console.warn("Found random NPC spawn points, but no characters are available in character-list.js.");
        }

        for (const spawnPoint of randomNpcSpawns) {
            if (availableCharacters.length === 0) continue;
            
            // Pick a random character for the spawn point
            const charFileName = availableCharacters[Math.floor(Math.random() * availableCharacters.length)];
            const characterData = await this._fetchCharacterData(charFileName);
            if (characterData) {
                const mapCoords = this.map.screenToMap(spawnPoint.x, spawnPoint.y);
                const frameIndex = Math.floor(Math.random() * 6); // Randomly pick one of the 6 sprites

                const npcOptions = {
                    id: `npc_random_${spawnPoint.id}`,
                    name: characterData.name,
                    assetName: 'npcSpritesheet',
                    spriteSourceRect: { x: frameIndex * 64, y: 0, width: 64, height: 64 },
                };
                
                const npc = new NPC(this, this.map, mapCoords.x, mapCoords.y, npcOptions);
                npc.loadCharacterData(characterData);
                
                this.gameObjects.push(npc);
                console.log(`Spawned random NPC '${npc.name}' at map coords (${mapCoords.x.toFixed(2)}, ${mapCoords.y.toFixed(2)}) with sprite frame ${frameIndex}.`);
            }
        }
    }

    async _initializeEnemies() {
        let enemyTypes = {};
        try {
            const enemyListModule = await import('../data/enemy-list.js');
            enemyTypes = enemyListModule.enemy_types || {};
            console.log("Loaded enemy types from enemy-list.js:", Object.keys(enemyTypes));
        } catch (error) {
            console.error("Error loading enemy list:", error);
            return;
        }

        const enemyTypeKeys = Object.keys(enemyTypes);
        if (enemyTypeKeys.length === 0) {
            console.log("No enemy types defined, skipping enemy initialization.");
            return;
        }

        // Clear existing enemies before spawning new ones
        this.gameObjects = this.gameObjects.filter(obj => !(obj instanceof Enemy));

        const enemySpawns = this.map.spawnPointsData.filter(sp => sp.type === SPAWN_TYPES.ENEMY);
        console.log(`Found ${enemySpawns.length} enemy spawn points.`);
        
        for (const spawnPoint of enemySpawns) {
            let enemyKey = spawnPoint.enemyId;

            // Fallback for older maps or unassigned spawn points
            if (!enemyKey || !enemyTypes[enemyKey]) {
                if (enemyTypeKeys.length > 0) {
                    console.warn(`Spawn point ${spawnPoint.id} has no valid enemyId. Spawning random enemy.`);
                    enemyKey = enemyTypeKeys[Math.floor(Math.random() * enemyTypeKeys.length)];
                } else {
                    console.warn(`Spawn point ${spawnPoint.id} has no enemyId and no enemy types are available to spawn randomly.`);
                    continue; // Skip this spawn point
                }
            }
            
            const enemyData = enemyTypes[enemyKey];

            if (enemyData) {
                const mapCoords = this.map.screenToMap(spawnPoint.x, spawnPoint.y);
                // Deep copy enemyData to avoid modifying the template in enemy-list.js
                const enemyInstanceData = JSON.parse(JSON.stringify(enemyData));
                const enemy = new Enemy(this, this.map, mapCoords.x, mapCoords.y, enemyInstanceData);
                this.gameObjects.push(enemy);
                console.log(`Spawned enemy '${enemy.name}' from key '${enemyKey}' at map coords (${mapCoords.x.toFixed(2)}, ${mapCoords.y.toFixed(2)}).`);
            }
        }
    }
}

export default GameEngine;