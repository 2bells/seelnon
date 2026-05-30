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
import QuestSystem from './quest_system.js';
import { FloatingTextEffect, TowerOrbEffect } from './combat/effects.js';
import CustomDialog from './ui/custom_dialog.js';
import { executeAbility, getAllAbilities } from './combat/ability_system.js';
import InventoryUI from './ui/inventory_ui.js';
import { updateARAMSystems, isARAMMap, checkAndSpawnARAMNPCs, scaleARAMEnemyStats } from './world/aram.js';

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
        this.aramDifficultyLevel = 1; // Tracks growing ARAM mode difficulty levels
        this.lastTimestamp = 0;
        this.isRunning = false;
        this.isPausedForEditor = false; // For editor pausing game updates
        this.isEditing = false; // For map editor state
        this.zoomLevel = 1.0; // Default zoom level
        this.mousePos = { x: 0, y: 0 }; // Track canvas relative mouse position

        this.inputState = {
            left: false,
            right: false,
            up: false,
            down: false,
            action: false
        };

        this.aiAdapter = null;
        this.assets = {};
        this.assetPaths = {
            hero: './game/assets/hero_sprite.png',
            tree: './game/assets/tree_srite.png',
            buildingSpritesheet: './game/assets/iso-64x64-building_2.png',
            outdoorsSpritesheet: './game/assets/iso-64x64-outdoors.png',
            pencil_icon: './game/assets/pencil_icon.png',
            eraser_icon: './game/assets/eraser_icon.png',
            npcSpritesheet: './game/assets/npc_spritesheet_64x64_6frames.png',
            note_icon: './game/assets/note_icon.png',
            enemy_slime: './game/assets/enemy_slime.png',
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
        window.engine = this;
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
                loadImage(this.assetPaths.outdoorsSpritesheet),
                loadImage(this.assetPaths.pencil_icon),
                loadImage(this.assetPaths.eraser_icon),
                loadImage(this.assetPaths.npcSpritesheet),
                loadImage(this.assetPaths.note_icon),
                loadImage(this.assetPaths.enemy_slime),
            ]);
            this.assets.hero = loadedAssets[0];
            this.assets.tree = loadedAssets[1];
            this.assets.buildingSpritesheet = loadedAssets[2];
            this.assets.outdoorsSpritesheet = loadedAssets[3];
            this.assets.pencil_icon = loadedAssets[4];
            this.assets.eraser_icon = loadedAssets[5];
            this.assets.npcSpritesheet = loadedAssets[6];
            this.assets.note_icon = loadedAssets[7];
            this.assets.enemy_slime = loadedAssets[8];

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
        
        this._boundWindowBlur = () => {
            // Reset input state when the window/iframe loses focus to prevent stuck keys
            this.inputState.left = false;
            this.inputState.right = false;
            this.inputState.up = false;
            this.inputState.down = false;
            this.inputState.action = false;
        };
        window.addEventListener('blur', this._boundWindowBlur);

        this._boundCanvasClick = () => {
            window.focus();
        };
        this.canvas.addEventListener('mousedown', this._boundCanvasClick);

        this._boundHandleMouseMove = (event) => {
            const canvasRect = this.canvas.getBoundingClientRect();
            this.mousePos.x = event.clientX - canvasRect.left;
            this.mousePos.y = event.clientY - canvasRect.top;
        };
        this.canvas.addEventListener('mousemove', this._boundHandleMouseMove);
    }

    _removeInputHandlers() {
        window.removeEventListener('keydown', this._handleKeyDown);
        window.removeEventListener('keyup', this._handleKeyUp);
        if (this._boundWindowBlur) {
            window.removeEventListener('blur', this._boundWindowBlur);
        }
        if (this._boundCanvasClick) {
            this.canvas.removeEventListener('mousedown', this._boundCanvasClick);
        }
        if (this._boundHandleMouseMove) {
            this.canvas.removeEventListener('mousemove', this._boundHandleMouseMove);
        }
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
            case 'KeyQ': this.castPlayerAbility(0); break;
            case 'KeyE': this.castPlayerAbility(1); break;
            case 'KeyR': this.castPlayerAbility(2); break;
            case 'KeyF': this.castPlayerAbility(3); break;
            case 'KeyG': this.castPlayerAbility(4); break;
            case 'Digit1': this.castPlayerAbility(0); break;
            case 'Digit2': this.castPlayerAbility(1); break;
            case 'Digit3': this.castPlayerAbility(2); break;
            case 'Digit4': this.castPlayerAbility(3); break;
            case 'Digit5': this.castPlayerAbility(4); break;
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

    castPlayerAbility(slotIndex) {
        if (!this.player || this.isPausedForEditor || this.isEditing) return;
        const abilityId = this.player.equippedAbilities[slotIndex];
        if (!abilityId) return;

        // Resolve target position based on ability preferences
        const getTargetPos = (ability) => {
            if (ability.targetType === 'closest_enemy') {
                let closest = null;
                let minDist = ability.range || 120;
                
                const isHostileToPlayer = (obj) => {
                    if (!obj || obj === this.player) return false;
                    
                    // Exclude player towers, shopkeepers, allied slimes
                    if (obj.friendly === true) return false;
                    if (obj.type === 'tower_player') return false;
                    if (obj.broadType === 'player_ability') return false;
                    if (obj.name && (
                        obj.name.toLowerCase().includes('allied') ||
                        obj.name.toLowerCase().includes('doran') ||
                        obj.name.toLowerCase().includes('player')
                    )) {
                        return false;
                    }
                    
                    // Include hostile enemies, hostile towers, or scruffy slimes
                    return (
                        obj.type === 'tower_enemy' ||
                        obj.broadType === 'enemy' ||
                        obj.broadType === 'turret' ||
                        (obj.constructor && obj.constructor.name === 'Enemy') ||
                        (obj.name && (
                            obj.name.toLowerCase().includes('scruffy') ||
                            (obj.name.toLowerCase().includes('slime') && !obj.name.toLowerCase().includes('allied'))
                        ))
                    );
                };

                for (const obj of this.gameObjects) {
                    if (isHostileToPlayer(obj) && obj.stats && obj.stats.hp > 0) {
                        const dx = obj.currentPixelX - this.player.currentPixelX;
                        const dy = obj.currentPixelY - this.player.currentPixelY;
                        const d = Math.sqrt(dx * dx + dy * dy);
                        if (d < minDist) {
                            minDist = d;
                            closest = obj;
                        }
                    }
                }
                if (closest) {
                    return { x: closest.currentPixelX, y: closest.currentPixelY };
                }
            }

            // Fallback/Direct: direction mouse
            const effectiveCanvasWidth = this.canvas.width / this.zoomLevel;
            const effectiveCanvasHeight = this.canvas.height / this.zoomLevel;
            const viewOriginX = this.map.cameraX - effectiveCanvasWidth / 2;
            const viewOriginY = this.map.cameraY - effectiveCanvasHeight / 2;
            
            const mouseWorldX = (this.mousePos.x / this.zoomLevel) + viewOriginX;
            const mouseWorldY = (this.mousePos.y / this.zoomLevel) + viewOriginY;

            const dx = mouseWorldX - this.player.currentPixelX;
            const dy = mouseWorldY - this.player.currentPixelY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxRange = ability.range || 120;

            if (dist > maxRange) {
                return {
                    x: this.player.currentPixelX + (dx / dist) * maxRange,
                    y: this.player.currentPixelY + (dy / dist) * maxRange
                };
            }
            return { x: mouseWorldX, y: mouseWorldY };
        };

        executeAbility(this.player, abilityId, getTargetPos);
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
                } else if (spawnPoint.type === SPAWN_TYPES.EVENT) {
                    // Check if event already completed
                    let isCompleted = false;
                    try {
                        const stored = localStorage.getItem('rpg_completed_events');
                        if (stored) {
                            const completed = JSON.parse(stored);
                            isCompleted = !!completed[spawnPoint.eventId];
                        }
                    } catch (e) {}

                    if (!isCompleted) {
                        const dx = this.player.currentPixelX - spawnPoint.x;
                        const dy = this.player.currentPixelY - spawnPoint.y;
                        const distSq = dx * dx + dy * dy;

                        if (distSq < closestDistSq) {
                            closestDistSq = distSq;
                            closestInteractable = {
                                type: 'event_spawn',
                                data: spawnPoint
                            };
                        }
                    }
                }
            }
        }

        // Check NPCs
        for (const obj of this.gameObjects) {
            if (obj instanceof NPC) {
                const broadType = obj.broadType || (obj.characterData && obj.characterData.broadType) || 'villager';
                if (broadType === 'turret') continue; // Turrets are non-interactable emitters!

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

    toggleQuestEditor() {
        this.editorManager.toggle('quest');
    }

    isQuestEditorActive() {
        return this.editorManager ? this.editorManager.isEditorActive('quest') : false;
    }

    toggleAbilitiesEditor() {
        this.editorManager.toggle('abilities');
    }

    isAbilitiesEditorActive() {
        return this.editorManager ? this.editorManager.isEditorActive('abilities') : false;
    }

    toggleProjectileCreator() {
        this.editorManager.toggle('projectile');
    }

    isProjectileCreatorActive() {
        return this.editorManager ? this.editorManager.isEditorActive('projectile') : false;
    }

    toggleItemEditor() {
        this.editorManager.toggle('item');
    }

    isItemEditorActive() {
        return this.editorManager ? this.editorManager.isEditorActive('item') : false;
    }

    toggleBankEditor() {
        this.editorManager.toggle('bank');
    }

    isBankEditorActive() {
        return this.editorManager ? this.editorManager.isEditorActive('bank') : false;
    }

    toggleEventEditor() {
        this.editorManager.toggle('event');
    }

    isEventEditorActive() {
        return this.editorManager ? this.editorManager.isEditorActive('event') : false;
    }

    toggleChaosMapDevice() {
        this.editorManager.toggle('chaos_map_device');
    }

    isChaosMapDeviceActive() {
        return this.editorManager ? this.editorManager.isEditorActive('chaos_map_device') : false;
    }

    showTopBannerAnnouncement(text, type) {
        const container = document.getElementById('rpg-canvas-container');
        if (!container) return;

        // Try to remove old banner if exists
        const oldBanner = document.getElementById('rpg-active-banner-toast');
        if (oldBanner) {
            oldBanner.remove();
        }

        const banner = document.createElement('div');
        banner.id = 'rpg-active-banner-toast';
        banner.className = `rpg-top-banner-announcement ${type}`;
        
        // Icon
        const iconSpan = document.createElement('span');
        iconSpan.style.fontSize = '1.3em';
        iconSpan.textContent = type === 'victory' ? '🏆' : (type === 'warning' ? '⚠️' : '💀');
        banner.appendChild(iconSpan);

        // Text
        const textSpan = document.createElement('span');
        textSpan.textContent = text;
        banner.appendChild(textSpan);

        container.appendChild(banner);

        // Reflow to animate
        void banner.offsetWidth;

        // Animate in
        banner.classList.add('show');

        // Remove after 6 seconds
        setTimeout(() => {
            banner.classList.remove('show');
            setTimeout(() => {
                banner.remove();
            }, 500);
        }, 6000);
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
        this.questSystem = new QuestSystem(this);
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
        
        // Initialize Inventory system
        this.inventoryUI = new InventoryUI(this);
        this.inventoryUI.init();

        // Try to load the user's custom startup map from the json file automatically
        let mapLoaded = false;
        try {
            const response = await fetch('./game/world/2_2_map_1779884179412.json');
            if (response.ok) {
                const mapData = await response.json();
                mapLoaded = await this.loadMap(mapData);
            }
        } catch (error) {
            console.error("Failed to load startup map from json file:", error);
        }

        if (!mapLoaded) {
            await this._initializeNPCs();
            await this._initializeEnemies();
            // If you need initial objects for a fresh map, they should be added via map.addGameObject
            // or be part of a default map JSON that gets loaded.
            // For testing, we can manually add some if the map doesn't load them:
            if (this.map.getRuntimeGameObjects().length === 0) {
                this._addDefaultObjectsForTesting(); // Add this method for now
            }
        }

        this._initInputHandlers();

        const effectiveCanvasWidth = this.canvas.width / this.zoomLevel;
        const effectiveCanvasHeight = this.canvas.height / this.zoomLevel;
        this.map.centerOn(this.player.currentPixelX, this.player.currentPixelY, effectiveCanvasWidth, effectiveCanvasHeight, true);

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
        if (this.inventoryUI) {
            this.inventoryUI.updateHotbar(deltaTime);
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

        // If a dialogue window is active, check if the player moved too far away
        if (this.dialogueUI && this.dialogueUI.isVisible && this.dialogueUI.participants && this.dialogueUI.participants.length > 0) {
            const activeNpc = this.dialogueUI.participants[0];
            const dx = this.player.currentPixelX - activeNpc.currentPixelX;
            const dy = this.player.currentPixelY - activeNpc.currentPixelY;
            const distSq = dx * dx + dy * dy;
            if (distSq > 80 * 80) {
                this.dialogueUI.hideDialogue();
            }
        }

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

        // Update custom ARAM systems (towers & waves)
        this.updateARAMSystems(deltaTime);

        // Update custom procedural spawners from the editor Map
        this.updateProceduralSpawners(deltaTime);
    }

    updateARAMSystems(deltaTime) {
        updateARAMSystems(this, deltaTime);
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
                        
                        // Add some small random angle Jitter to the push direction to break line stacking or queues!
                        // This causes entities to slide sideways past each other rather than form perfectly straight lines.
                        const randAngle = (Math.random() - 0.5) * 0.45; // ~25 degrees max random rotation
                        const cosA = Math.cos(randAngle);
                        const sinA = Math.sin(randAngle);
                        
                        const basePushX = dx / dist;
                        const basePushY = dy / dist;
                        
                        // Rotate the normalized push vector by the random angle
                        const dirX = basePushX * cosA - basePushY * sinA;
                        const dirY = basePushX * sinA + basePushY * cosA;

                        // Linear instant pushback separation
                        const pushX = dirX * overlap;
                        const pushY = dirY * overlap;
                        
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
                        // Avoid perfect overlap by nudging in a random direction
                        const nudgeAngle = Math.random() * Math.PI * 2;
                        const nudgeDist = 1;
                        entityA.currentPixelX -= Math.cos(nudgeAngle) * nudgeDist;
                        entityA.currentPixelY -= Math.sin(nudgeAngle) * nudgeDist;
                        if (typeof entityA.updateMapCoordsFromPixels === 'function') entityA.updateMapCoordsFromPixels();

                        entityB.currentPixelX += Math.cos(nudgeAngle) * nudgeDist;
                        entityB.currentPixelY += Math.sin(nudgeAngle) * nudgeDist;
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
            // Pass false for renderOverhead to render ground tile layers (zIndex <= 0)
            this.map.render(this.ctx, this.canvas, viewOriginX, viewOriginY, false);
        }

        const groundEffects = [];
        const topEffects = [];
        for (const eff of this.effects) {
            if (eff.isHighZ) {
                topEffects.push(eff);
            } else {
                groundEffects.push(eff);
            }
        }

        const renderables = [this.player, ...this.gameObjects, ...groundEffects]; // gameObjects from map, plus effects

        renderables.sort((a, b) => {
            // Sort by zIndex first (default 0)
            const zA = a.zIndex !== undefined ? a.zIndex : 0;
            const zB = b.zIndex !== undefined ? b.zIndex : 0;
            if (zA !== zB) {
                return zA - zB;
            }

            // Check if Y-sorting is disabled
            const ySortingDisabledA = a.disableYSorting || false;
            const ySortingDisabledB = b.disableYSorting || false;
            if (ySortingDisabledA && !ySortingDisabledB) {
                return -1;
            }
            if (!ySortingDisabledA && ySortingDisabledB) {
                return 1;
            }
            if (ySortingDisabledA && ySortingDisabledB) {
                return 0; // maintain relative creation order
            }

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
            if (typeof entity.drawHealthBar === 'function') {
                entity.drawHealthBar(this.ctx, viewOriginX, viewOriginY);
            }
            this.ctx.restore(); // Restore alpha for next entity
        }

        // Render custom Event interactive symbols
        if (this.map && this.map.spawnPointsData) {
            for (const pt of this.map.spawnPointsData) {
                if (pt.type === 'event') {
                    let isCompleted = false;
                    try {
                        const stored = localStorage.getItem('rpg_completed_events');
                        if (stored) {
                            const completed = JSON.parse(stored);
                            isCompleted = !!completed[pt.eventId];
                        }
                    } catch (e) {}

                    if (!isCompleted) {
                        const emoji = pt.emoji || '⚡';
                        const drawX = pt.x - viewOriginX;
                        const drawY = pt.y - viewOriginY;

                        this.ctx.save();
                        this.ctx.font = '24px Arial';
                        this.ctx.textAlign = 'center';
                        this.ctx.textBaseline = 'middle';
                        
                        this.ctx.shadowColor = 'rgba(0,0,0,0.6)';
                        this.ctx.shadowBlur = 4;
                        this.ctx.shadowOffsetX = 1;
                        this.ctx.shadowOffsetY = 2;
                        
                        this.ctx.fillText(emoji, drawX, drawY);
                        this.ctx.restore();
                    } else if (pt.triggerType === 'give_item') {
                        const drawX = pt.x - viewOriginX;
                        const drawY = pt.y - viewOriginY;
                        this.ctx.save();
                        this.ctx.font = '16px Arial';
                        this.ctx.textAlign = 'center';
                        this.ctx.textBaseline = 'middle';
                        this.ctx.globalAlpha = 0.5;
                        this.ctx.fillText('💨', drawX, drawY);
                        this.ctx.restore();
                    }
                }
            }
        }

        if (this.map) {
            // Draw overhead / overlay tile layers (zIndex > 0)
            this.map.render(this.ctx, this.canvas, viewOriginX, viewOriginY, true);
        }
        
        // Render light system overlay after the main world drawing but before editor overlays
        if (this.lightSystem) {
            this.lightSystem.render(viewOriginX, viewOriginY);
        }

        // Render high-Z flying projectiles, particle splatters, and floating head text notifications on topmost visual layer
        for (const eff of topEffects) {
            this.ctx.save();
            eff.render(this.ctx, viewOriginX, viewOriginY);
            this.ctx.restore();
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
                    let isLocked = false;
                    if (data.eventId) {
                        try {
                            const stored = localStorage.getItem('rpg_completed_events');
                            if (stored) {
                                const completed = JSON.parse(stored);
                                isLocked = !completed[data.eventId];
                            } else {
                                isLocked = true;
                            }
                        } catch (e) {
                            isLocked = true;
                        }
                    }
                    if (isLocked) {
                        promptText = `[${actionKey}] Go to ${data.targetMap || '???'} (Locked 🔒)`;
                    } else {
                        promptText = `[${actionKey}] Go to ${data.targetMap || '???'}`;
                    }
                }
                break;
            case 'event_spawn':
                if (data.triggerType === 'give_item') {
                    promptText = `[${actionKey}] ${data.message || 'Search container'}`;
                } else {
                    promptText = `[${actionKey}] ${data.message || 'Unlock/activate obstacle'}`;
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
        const y = this.canvas.height - 145; // Position above the skill hot bar and player HP bar

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
            if (data.eventId) {
                let isCompleted = false;
                try {
                    const stored = localStorage.getItem('rpg_completed_events');
                    if (stored) {
                        const completed = JSON.parse(stored);
                        isCompleted = !!completed[data.eventId];
                    }
                } catch (e) {}

                if (!isCompleted) {
                    let eventName = "Linked Event";
                    try {
                        const stored = localStorage.getItem('rpg_custom_events');
                        if (stored) {
                            const custom = JSON.parse(stored);
                            if (custom[data.eventId]) {
                                eventName = custom[data.eventId].name;
                            }
                        }
                    } catch (e) {}

                    CustomDialog.alert(`The exit is locked tight! You must complete or activate the event first:\n\n🔒 "${eventName}"`, "Locked Exit");
                    return;
                }
            }

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
            CustomDialog.alert(`A note reads:\n\n"${data.customData.text}"`, "Reading Note");
            return;
        }

        if (type === 'event_spawn') {
            this.triggerEventSpawnPoint(data);
            return;
        }
    }

    triggerEventSpawnPoint(spawnPoint) {
        if (!spawnPoint || !spawnPoint.eventId) return;

        // Auto-generated key item identifier is `item_evt_${eventId}`
        const requiredItemId = `item_evt_${spawnPoint.eventId}`;

        // Get friendly event name for display prompts
        let eventName = "Event Key";
        try {
            const stored = localStorage.getItem('rpg_custom_events');
            if (stored) {
                const custom = JSON.parse(stored);
                if (custom[spawnPoint.eventId]) {
                    eventName = custom[spawnPoint.eventId].name;
                }
            }
        } catch (e) {}

        if (spawnPoint.triggerType === 'give_item') {
            if (!this.player.inventory) this.player.inventory = [];

            // Add standard or key item
            let itemToAdd = null;
            try {
                const itemsStored = localStorage.getItem('rpg_custom_items');
                if (itemsStored) {
                     const customItems = JSON.parse(itemsStored);
                     if (customItems[requiredItemId]) {
                          itemToAdd = customItems[requiredItemId];
                     }
                }
            } catch (e) {}

            if (!itemToAdd) {
                itemToAdd = {
                    id: requiredItemId,
                    name: eventName,
                    type: 'event',
                    emoji: spawnPoint.emoji || '🔑',
                    description: `Event key item`,
                    count: 1
                };
            }

            const existing = this.player.inventory.find(it => it.id === itemToAdd.id);
            if (existing) {
                existing.count = (existing.count || 0) + 1;
            } else {
                this.player.inventory.push({
                    id: itemToAdd.id,
                    name: itemToAdd.name,
                    type: itemToAdd.type || 'event',
                    emoji: itemToAdd.emoji || '🔑',
                    description: itemToAdd.description || '',
                    cost: itemToAdd.cost || 0,
                    value: 0,
                    count: 1,
                    attachedEvent: spawnPoint.eventId
                });
            }

            // Save & Sync bags
            this.player.saveToStorage();
            if (this.inventoryUI) {
                this.inventoryUI.refresh();
            }

            // Persistence
            const completed = JSON.parse(localStorage.getItem('rpg_completed_events') || '{}');
            completed[spawnPoint.eventId] = { completed: true, timestamp: Date.now() };
            localStorage.setItem('rpg_completed_events', JSON.stringify(completed));

            CustomDialog.alert(`You found: ${itemToAdd.emoji || '🔑'} 1x "${itemToAdd.name}"!`, "Loot Container");
            this.currentInteractable = null;
            return;
        }

        if (spawnPoint.triggerType === 'unlock_remove') {
            if (!this.player.inventory) this.player.inventory = [];
            
            // Check possession
            const hasItem = this.player.inventory.find(it => it.id === requiredItemId && it.count > 0);
            if (!hasItem) {
                CustomDialog.alert(`The obstacle is locked tight! You must find the correct Key Item:\n\n🔑 "${eventName}"`, "Locked Obstacle");
                return;
            }

            // Consume or keep? Always consume key item for doors/progression of single usage!
            hasItem.count--;
            if (hasItem.count <= 0) {
                this.player.inventory = this.player.inventory.filter(it => it.id !== requiredItemId);
            }

            this.player.saveToStorage();
            if (this.inventoryUI) {
                this.inventoryUI.refresh();
            }

            // Persist as unlocked
            const completed = JSON.parse(localStorage.getItem('rpg_completed_events') || '{}');
            completed[spawnPoint.eventId] = { completed: true, timestamp: Date.now() };
            localStorage.setItem('rpg_completed_events', JSON.stringify(completed));

            CustomDialog.alert(`Using ${hasItem.emoji || '🔑'} "${eventName}"...\n\nThe path/door is now permanently unlocked!`, "Path Unlocked!");
            this.currentInteractable = null;
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
        this.map.centerOn(this.player.currentPixelX, this.player.currentPixelY, effectiveCanvasWidth, effectiveCanvasHeight, true);

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
        const characterUrl = `/data/characters/${characterFileName}`;
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
                    avatarUrl: './game/assets/character_dialogue_image.png', // Use a default image for Lanna
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
                avatarUrl: './game/assets/character_dialogue_image.png',
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
            let mapCoords = this.map.screenToMap(spawnPoint.x, spawnPoint.y);
            
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

        // Post-process ARAM specific NPCs and adjustments safely in aram.js
        checkAndSpawnARAMNPCs(this);

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
            this.loadedEnemyTypes = enemyTypes;
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
        
        const isItemWorld = this.map && this.map.currentMapName && this.map.currentMapName.startsWith('ItemWorld');

        const doSpawn = () => {
            // Verify current map hasn't changed during the delay
            if (isItemWorld && (!this.map || !this.map.currentMapName || !this.map.currentMapName.startsWith('ItemWorld'))) {
                return;
            }

            for (const spawnPoint of enemySpawns) {
                // Check custom event conditions if attached
                if (spawnPoint.eventId) {
                    let isCompleted = false;
                    try {
                        const stored = localStorage.getItem('rpg_completed_events');
                        if (stored) {
                            const completed = JSON.parse(stored);
                            isCompleted = !!completed[spawnPoint.eventId];
                        }
                    } catch (e) {}

                    if (spawnPoint.triggerType === 'unlock_remove') {
                        // "Stop spawning if Event is completed" (cleansed!)
                        if (isCompleted) {
                            console.log(`Bypassing enemy spawn at point ${spawnPoint.id} because cleansing Event "${spawnPoint.eventId}" is completed.`);
                            continue;
                        }
                    } else if (spawnPoint.triggerType === 'give_item') {
                        // "Spawn only if Event is completed" (boss target unlocked!)
                        if (!isCompleted) {
                            console.log(`Bypassing enemy spawn at point ${spawnPoint.id} because trigger Event "${spawnPoint.eventId}" has not occurred yet.`);
                            continue;
                        }
                    }
                }

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

                    // Apply scaling for ARAM based on ARAM difficulty and player level
                    scaleARAMEnemyStats(this, enemyInstanceData);

                    const enemy = new Enemy(this, this.map, mapCoords.x, mapCoords.y, enemyInstanceData);
                    enemy.spawnerId = spawnPoint.id || `spawner_${spawnPoint.x}_${spawnPoint.y}`;
                    this.gameObjects.push(enemy);
                    console.log(`Spawned enemy '${enemy.name}' from key '${enemyKey}' at map coords (${mapCoords.x.toFixed(2)}, ${mapCoords.y.toFixed(2)}).`);
                }
            }
        };

        if (isItemWorld) {
            this.showTopBannerAnnouncement("Stabilizing dimensional zone... Grace Period active!", "victory");
            setTimeout(() => {
                doSpawn();
            }, 1000);
        } else {
            doSpawn();
        }
    }

    updateProceduralSpawners(deltaTime) {
        if (this.isEditing || !this.map || !this.map.spawnPointsData) return;
        if (!this.loadedEnemyTypes) return;

        // Find all enemy spawn points with procedural config
        const proceduralSpawns = this.map.spawnPointsData.filter(sp => sp.type === SPAWN_TYPES.ENEMY && sp.procedural);
        if (proceduralSpawns.length === 0) return;

        for (const spawnPoint of proceduralSpawns) {
            // Check custom event conditions if attached
            if (spawnPoint.eventId) {
                let isCompleted = false;
                try {
                    const stored = localStorage.getItem('rpg_completed_events');
                    if (stored) {
                        const completed = JSON.parse(stored);
                        isCompleted = !!completed[spawnPoint.eventId];
                    }
                } catch (e) {}

                if (spawnPoint.triggerType === 'unlock_remove') {
                    if (isCompleted) continue; // Cleansed, disabled
                } else if (spawnPoint.triggerType === 'give_item') {
                    if (!isCompleted) continue; // Requires event complete to start spawning
                }
            }

            const spawnerId = spawnPoint.id || `spawner_${spawnPoint.x}_${spawnPoint.y}`;

            // Count current alive enemies spawned by this spawner
            const countAlive = this.gameObjects.filter(obj => 
                obj instanceof Enemy && 
                obj.spawnerId === spawnerId && 
                obj.stats && 
                obj.stats.hp > 0
            ).length;

            const limit = spawnPoint.limit || 1;

            if (countAlive < limit) {
                if (spawnPoint.cooldownTimer === undefined) {
                    // Start immediately if there are absolutely no alive units
                    spawnPoint.cooldownTimer = countAlive === 0 ? 0.5 : (spawnPoint.interval || 10);
                }

                spawnPoint.cooldownTimer -= deltaTime;

                if (spawnPoint.cooldownTimer <= 0) {
                    spawnPoint.cooldownTimer = spawnPoint.interval || 10;
                    this.spawnOneEnemyFromPoint(spawnPoint, spawnerId);
                }
            } else {
                // Keep reset timer ready if count is maxed out
                spawnPoint.cooldownTimer = spawnPoint.interval || 10;
            }
        }
    }

    spawnOneEnemyFromPoint(spawnPoint, spawnerId) {
        const enemyKey = spawnPoint.enemyId;
        if (!enemyKey || !this.loadedEnemyTypes || !this.loadedEnemyTypes[enemyKey]) return;

        const enemyData = this.loadedEnemyTypes[enemyKey];
        const mapCoords = this.map.screenToMap(spawnPoint.x, spawnPoint.y);
        const enemyInstanceData = JSON.parse(JSON.stringify(enemyData));

        scaleARAMEnemyStats(this, enemyInstanceData);

        const enemy = new Enemy(this, this.map, mapCoords.x, mapCoords.y, enemyInstanceData);
        enemy.spawnerId = spawnerId;
        this.gameObjects.push(enemy);
        console.log(`Procedurally spawned enemy '${enemy.name}' from spawner '${spawnerId}' at (${mapCoords.x.toFixed(2)}, ${mapCoords.y.toFixed(2)}).`);
    }
}

export default GameEngine;