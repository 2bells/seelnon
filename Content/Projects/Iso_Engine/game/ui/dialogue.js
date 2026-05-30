// UI Logic for NPC Dialogues, Shops, and Quests
// Supports pure bottom dialogue, floating slide-up panes, in-sync vendor inventories, gear inspect, and JSON quest lines.
import NPC from '../entities/npc.js';
import Enemy from '../entities/enemy.js';

// Global item definitions
const BASE_ITEMS = {
    'Red Potion': { type: 'consumable', heal: 40, cost: 20, description: 'Restores 40 HP' },
    'Green Herb': { type: 'consumable', heal: 15, cost: 8, description: 'Restores 15 HP' },
    'Gold Elixir': { type: 'consumable', heal: 100, cost: 60, description: 'Fully restores health' },
    'Iron Sword': { type: 'weapon', bonusAtk: 5, cost: 120, description: '+5 Weapon attack power' },
    'Steel Shield': { type: 'shield', bonusDef: 4, cost: 100, description: '+4 Defense gear' }
};

class DialogueUI {
    constructor(engine) {
        this.engine = engine;
        this.isVisible = false;
        this.participants = []; // Array of NPCs in the chat
        this.participantData = []; // Array of {npc, imageEl, mainAvatarUrl}
        this.nextSpeakerIndex = 0; // For group chat turn-taking
        this.chatMode = 'public'; // 'public' or 'private'
        this.mapContext = null;
        this.dialogueMode = 'talk'; // 'talk', 'shop', 'inventory', 'quests'
        
        this.domElement = this._createDom();
        // Append to the main modal overlay
        this.engine.modalContentElement.appendChild(this.domElement);
    }

    _createDom() {
        const overlay = document.createElement('div');
        overlay.id = 'rpg-dialogue-overlay';
        overlay.style.display = 'none';

        // Core avatars
        const charImage = document.createElement('img');
        charImage.id = 'rpg-dialogue-character-image';

        const charImageRight = document.createElement('img');
        charImageRight.id = 'rpg-dialogue-character-image-right';

        // ------------------ DIALOGUE BOX (PURE BOTTOM PANEL) ------------------
        const dialogueBox = document.createElement('div');
        dialogueBox.id = 'rpg-dialogue-box';

        const mainContent = document.createElement('div');
        mainContent.id = 'rpg-dialogue-main-content';

        const nameTag = document.createElement('div');
        nameTag.id = 'rpg-dialogue-name-tag';
        
        const messagesArea = document.createElement('div');
        messagesArea.id = 'rpg-dialogue-messages';

        const inputArea = document.createElement('div');
        inputArea.id = 'rpg-dialogue-input-area';

        // Anchor the nametag directly onto the dialogueBox bounding box so it never scrolls
        dialogueBox.appendChild(nameTag);

        mainContent.appendChild(messagesArea);
        mainContent.appendChild(inputArea);

        // Sidebar Control Actions
        const controlsPanel = document.createElement('div');
        controlsPanel.id = 'rpg-dialogue-controls';

        const controlsHeader = document.createElement('h4');
        controlsHeader.textContent = 'Actions';

        // "Open" (Talk) Button
        const openButton = document.createElement('button');
        openButton.id = 'rpg-dialogue-action-open';
        openButton.textContent = '💬 Gossip';
        openButton.title = 'Open standard dialogue options';
        openButton.onclick = () => this.setDialogueMode('talk');

        // "Shop" Button
        const shopButton = document.createElement('button');
        shopButton.id = 'rpg-dialogue-action-shop';
        shopButton.textContent = '🛒 Shop';
        shopButton.title = 'Buy and sell merchant goods';
        shopButton.onclick = () => this.setDialogueMode('shop');

        // "Inventory" Button
        const inventoryButton = document.createElement('button');
        inventoryButton.id = 'rpg-dialogue-action-inventory';
        inventoryButton.textContent = '🎒 Inventory';
        inventoryButton.title = 'View personal bag and NPC equipment';
        inventoryButton.onclick = () => this.setDialogueMode('inventory');

        // "Quests" Button
        const questsButton = document.createElement('button');
        questsButton.id = 'rpg-dialogue-action-quests';
        questsButton.textContent = '📜 Quests';
        questsButton.title = 'Manage active quests and track progress';
        questsButton.onclick = () => this.setDialogueMode('quests');

        controlsPanel.appendChild(controlsHeader);
        controlsPanel.appendChild(openButton);
        controlsPanel.appendChild(shopButton);
        controlsPanel.appendChild(inventoryButton);
        controlsPanel.appendChild(questsButton);

        dialogueBox.appendChild(mainContent);
        dialogueBox.appendChild(controlsPanel);

        // Close Conversation Button
        const closeButton = document.createElement('button');
        closeButton.id = 'rpg-dialogue-close';
        closeButton.innerHTML = '&times;';
        closeButton.onclick = () => this.hideDialogue();
        mainContent.appendChild(closeButton);

        // ------------------ THREE FLOATING SLIDE-UP WINDOWS ------------------
        
        // Window 1: Shop
        this.shopWindow = document.createElement('div');
        this.shopWindow.className = 'rpg-slideup-window';
        this.shopWindow.innerHTML = `
            <div class="rpg-window-header">
                <span class="rpg-window-title">🛒 Merchant Shop</span>
                <button class="rpg-window-close">&times;</button>
            </div>
            <div class="rpg-window-content" id="rpg-shop-content"></div>
        `;
        this.shopWindow.querySelector('.rpg-window-close').onclick = () => this.setDialogueMode('talk');

        // Window 2: Inventory
        this.inventoryWindow = document.createElement('div');
        this.inventoryWindow.className = 'rpg-slideup-window';
        this.inventoryWindow.innerHTML = `
            <div class="rpg-window-header">
                <span class="rpg-window-title">🎒 Equipment Inspect</span>
                <button class="rpg-window-close">&times;</button>
            </div>
            <div class="rpg-window-content" id="rpg-inventory-content"></div>
        `;
        this.inventoryWindow.querySelector('.rpg-window-close').onclick = () => this.setDialogueMode('talk');

        // Window 3: Quests
        this.questsWindow = document.createElement('div');
        this.questsWindow.className = 'rpg-slideup-window';
        this.questsWindow.innerHTML = `
            <div class="rpg-window-header">
                <span class="rpg-window-title">📜 Quest Tracking Ledger</span>
                <button class="rpg-window-close">&times;</button>
            </div>
            <div class="rpg-window-content" id="rpg-quests-content"></div>
        `;
        this.questsWindow.querySelector('.rpg-window-close').onclick = () => this.setDialogueMode('talk');

        // Glue overlay together
        overlay.appendChild(charImage);
        overlay.appendChild(charImageRight);
        overlay.appendChild(this.shopWindow);
        overlay.appendChild(this.inventoryWindow);
        overlay.appendChild(this.questsWindow);
        overlay.appendChild(dialogueBox);

        const interjectionsContainer = document.createElement('div');
        interjectionsContainer.id = 'rpg-dialogue-interjections-container';
        overlay.appendChild(interjectionsContainer);

        return overlay;
    }

    // Assigns standard inventory mockups matching broad NPC roles
    _ensureNpcInventory(npc) {
        if (!npc.inventory) {
            const broadType = (npc.characterData && npc.characterData.broadType) || npc.broadType || 'villager';
            console.log(`Initializing custom inventory for ${npc.name} of type: ${broadType}`);
            
            const nameLower = npc.name.toLowerCase();
            if (broadType.toLowerCase() === 'merchant' || nameLower.includes('doran') || nameLower.includes('shopkeeper') || nameLower === 'shortia') {
                npc.inventory = [
                    { id: 'std_red_potion', name: 'Red Potion', type: 'consumable', emoji: '❤️', heal: 40, cost: 20, value: 14, description: 'Restores 40 HP', count: 5 },
                    { id: 'std_gold_elixir', name: 'Gold Elixir', type: 'consumable', emoji: '🍵', heal: 100, cost: 60, value: 42, description: 'Fully restores health', count: 2 },
                    { id: 'std_iron_sword', name: 'Iron Sword', type: 'weapon', emoji: '🗡️', bonusAtk: 5, cost: 120, value: 84, description: '+5 Weapon attack power', count: 1 },
                    { id: 'std_steel_shield', name: 'Steel Shield', type: 'shield', emoji: '🛡️', bonusDef: 4, cost: 100, value: 70, description: '+4 Defense gear', count: 1 },
                    { id: 'item_emitter_plasma_orb', name: 'Plasma Orb Emitter Core', type: 'emitter', emoji: '⚡', cost: 150, value: 75, description: "Passive core. Shoots elegant Plasma Orb starburst rings automatically.", count: 1, emitterConfig: { projectileType: "starburst", cooldown: 1.5, range: 220, projectileSpeed: 180, burstCount: 5, damage: 18, projectileColor: "#f1c40f", renderType: "glow" } }
                ];
                npc.equippedWeapon = null;
                npc.equippedShield = null;
            } else if (broadType.toLowerCase() === 'guard') {
                npc.inventory = [
                    { id: 'std_iron_sword', name: 'Iron Sword', type: 'weapon', emoji: '🗡️', bonusAtk: 5, cost: 120, value: 84, description: '+5 Weapon attack power', count: 1 },
                    { id: 'std_red_potion', name: 'Red Potion', type: 'consumable', emoji: '❤️', heal: 40, cost: 20, value: 14, description: 'Restores 40 HP', count: 2 }
                ];
                npc.equippedWeapon = { id: 'std_iron_sword', name: 'Iron Sword', type: 'weapon', bonusAtk: 5, description: '+5 Weapon attack power' };
                npc.equippedShield = { id: 'std_steel_shield', name: 'Steel Shield', type: 'shield', bonusDef: 4, description: '+4 Defense gear' };
            } else {
                // Default villager / Lanna
                npc.inventory = [
                    { id: 'std_green_herb', name: 'Green Herb', type: 'consumable', emoji: '🌿', heal: 15, cost: 8, value: 5, description: 'Restores 15 HP', count: 3 },
                    { id: 'std_red_potion', name: 'Red Potion', type: 'consumable', emoji: '❤️', heal: 40, cost: 20, value: 14, description: 'Restores 40 HP', count: 1 }
                ];
                npc.equippedWeapon = null;
                npc.equippedShield = null;
            }
        }
    }

    showDialogue(npc, mapContext) {
        if (!npc || !npc.characterData) {
            console.error("DialogueUI: Cannot launch dialogue.");
            return;
        }
        
        // Reset properties
        this.participants = [npc];
        this.nextSpeakerIndex = 0;
        this.mapContext = mapContext || null;

        this._ensureNpcInventory(npc);

        const charImageLeft = this.domElement.querySelector('#rpg-dialogue-character-image');
        const charImageRight = this.domElement.querySelector('#rpg-dialogue-character-image-right');
        if (charImageRight) charImageRight.style.display = 'none';

        // Setup speaker data array
        this.participantData = [{
            npc: npc,
            imageEl: charImageLeft,
            mainAvatarUrl: (npc.characterData.dialogue_avatars && npc.characterData.dialogue_avatars.main) ? npc.characterData.dialogue_avatars.main : (npc.characterData.avatarUrl || './game/assets/character_dialogue_image.png')
        }];
        if (charImageLeft) charImageLeft.src = this.participantData[0].mainAvatarUrl;

        const { name, first_mes } = npc.characterData;
        const mapHistory = this.engine.map.chatHistory;

        // Populate name display
        const nameTagEl = this.domElement.querySelector('#rpg-dialogue-name-tag');
        if (nameTagEl) nameTagEl.textContent = name;
        
        // Reset text boxes
        const messagesArea = this.domElement.querySelector('#rpg-dialogue-messages');
        if (messagesArea) {
            messagesArea.innerHTML = '';
            
            const hasNpcSpoken = mapHistory.some(msg => msg.speaker === name);
            if (!hasNpcSpoken) {
                const greeting = first_mes || "Hello traveler!";
                mapHistory.push({ speaker: name, text: greeting });
            }

            // Restore from map logs
            mapHistory.forEach(msg => {
                this._appendMessage(msg.text, msg.speaker, msg.speaker === 'Player');
            });
        }

        // Set state to talk and animate in
        const isChest = npc.broadType === 'chest' || (npc.characterData && npc.characterData.broadType === 'chest');
        this.setDialogueMode(isChest ? 'inventory' : 'talk');
        this.domElement.style.display = 'block';
        this.isVisible = true;

        // Hide hotbar
        const hotbar = document.getElementById('rpg-mmo-hotbar');
        if (hotbar) hotbar.style.display = 'none';

        if (this.engine.questSystem) {
             this.engine.questSystem.checkGatherQuests();
        }
    }

    hideDialogue() {
        this.domElement.style.display = 'none';
        this.isVisible = false;
        this.participants = [];
        this.participantData = [];
        this.mapContext = null;

        // Show hotbar again
        const hotbar = document.getElementById('rpg-mmo-hotbar');
        if (hotbar) hotbar.style.display = 'flex';

        // Slide away panels on close
        this.shopWindow.classList.remove('show');
        this.inventoryWindow.classList.remove('show');
        this.questsWindow.classList.remove('show');
    }

    setDialogueMode(mode) {
        this.dialogueMode = mode; 
        
        // Sync active border rings on Sidebar control buttons
        const btnOpen = this.domElement.querySelector('#rpg-dialogue-action-open');
        const btnShop = this.domElement.querySelector('#rpg-dialogue-action-shop');
        const btnInv = this.domElement.querySelector('#rpg-dialogue-action-inventory');
        const btnQst = this.domElement.querySelector('#rpg-dialogue-action-quests');
        
        if (btnOpen) btnOpen.style.borderColor = (mode === 'talk') ? '#D4C8A0' : '#5A4B3E';
        if (btnShop) btnShop.style.borderColor = (mode === 'shop') ? '#D4C8A0' : '#5A4B3E';
        if (btnInv) btnInv.style.borderColor = (mode === 'inventory') ? '#D4C8A0' : '#5A4B3E';
        if (btnQst) btnQst.style.borderColor = (mode === 'quests') ? '#D4C8A0' : '#5A4B3E';
        
        if (btnOpen) btnOpen.style.backgroundColor = (mode === 'talk') ? '#A07D65' : '#8C6D56';
        if (btnShop) btnShop.style.backgroundColor = (mode === 'shop') ? '#A07D65' : '#8C6D56';
        if (btnInv) btnInv.style.backgroundColor = (mode === 'inventory') ? '#A07D65' : '#8C6D56';
        if (btnQst) btnQst.style.backgroundColor = (mode === 'quests') ? '#A07D65' : '#8C6D56';

        if (btnOpen) btnOpen.style.fontWeight = (mode === 'talk') ? 'bold' : 'normal';
        if (btnShop) btnShop.style.fontWeight = (mode === 'shop') ? 'bold' : 'normal';
        if (btnInv) btnInv.style.fontWeight = (mode === 'inventory') ? 'bold' : 'normal';
        if (btnQst) btnQst.style.fontWeight = (mode === 'quests') ? 'bold' : 'normal';

        const inputArea = this.domElement.querySelector('#rpg-dialogue-input-area');
        if (!inputArea) return;
        
        // Bottom dialogue inputs stay pure and independent
        inputArea.style.display = 'flex';
        inputArea.style.flexDirection = 'column';
        inputArea.style.minHeight = '145px';
        inputArea.style.maxHeight = '145px';
        inputArea.style.height = '145px';
        inputArea.style.gap = '8px';
        inputArea.style.padding = '10px';
        inputArea.style.overflowY = 'auto';
        inputArea.style.boxSizing = 'border-box';
        
        inputArea.innerHTML = '';

        if (mode === 'talk') {
            this.renderTalkMode(inputArea);
        } else if (mode === 'shop') {
            this.renderShopTalkMode(inputArea);
        } else if (mode === 'inventory') {
            this.renderInventoryTalkMode(inputArea);
        } else if (mode === 'quests') {
            this.renderQuestsTalkMode(inputArea);
        }

        // Slide up windows toggle
        this.shopWindow.classList.remove('show');
        this.inventoryWindow.classList.remove('show');
        this.questsWindow.classList.remove('show');

        const npc = this.participants[0];

        if (mode === 'shop') {
            this.shopWindow.classList.add('show');
            this.renderShopWindow();
            if (npc) {
                this._appendSystemMessage(`${npc.name} opened her store catalog.`);
                this._triggerNpcResponse(`Welcome to my shop! Here is my current inventory stock and values. What can I get you?`);
            }
        } else if (mode === 'inventory') {
            this.inventoryWindow.classList.add('show');
            this.renderInventoryWindow();
            if (npc) {
                this._appendSystemMessage(`Comparing payloads with ${npc.name}.`);
                this._triggerNpcResponse(`Take a look at what we're packing. If there's an item in my bag that you desperately need, ask me for it!`);
            }
        } else if (mode === 'quests') {
            this.questsWindow.classList.add('show');
            this.renderQuestWindow();
            if (npc) {
                this._appendSystemMessage(`Consulting active local objectives.`);
                this._triggerNpcResponse(`Checking regional campaigns? Here is our active campaign tasks checklist.`);
            }
        }
    }

    renderTalkMode(container) {
        const npc = this.participants[0];
        if (!npc) return;

        // Clear container completely to prevent double rendering under any circumstance
        container.innerHTML = '';

        let choices = [];
        const nameLower = npc.name.toLowerCase();
        const isPortalMerchant = nameLower.includes('portal merchant') || npc.id === 'npc_portal_merchant_cleared';

        if (isPortalMerchant) {
            // No custom gossip or map editor guides for interdimensional merchant
            choices = [];
        } else if (npc.characterData && Array.isArray(npc.characterData.dialogue_branches) && npc.characterData.dialogue_branches.length > 0) {
            choices = npc.characterData.dialogue_branches.map(branch => {
                return {
                    text: branch.text || "...",
                    action: () => {
                        this._appendPlayerChoice(branch.text || "...");
                        this._triggerNpcResponse(branch.reply || "...", () => {
                            this._executeBranchAction(branch, npc);
                        });
                    }
                };
            });
        } else {
            choices = [
                {
                    text: "🛠️ Ask about Map Editor",
                    action: () => {
                        this._appendPlayerChoice("Tell me about the Map Editor.");
                        this._triggerNpcResponse("The Map Editor (🛠️) on the top bar lets you paint dirt/grass tiles, clear blockages, select decorations, and expand boundaries. Try saving local layout presets!");
                    }
                },
                {
                    text: "💡 Ask about Light Editor",
                    action: () => {
                        this._appendPlayerChoice("How does the Light Editor work?");
                        this._triggerNpcResponse("The Light Editor (💡) controls dynamic day, twilight, and night cycles, paints real-time floating light source rays, and creates highly atmospheric dark fields.");
                    }
                },
                {
                    text: "👤 Ask about NPC Creator",
                    action: () => {
                        this._appendPlayerChoice("Can I summon custom residents?");
                        this._triggerNpcResponse("Indeed! Fire up the NPC Creator (👤) in the top menu to sculpt characters with distinct skin options, personal dialogue scenarios, and custom trade goods!");
                    }
                }
            ];
        }

        // Add standard RPG role integration buttons
        const broadType = npc.broadType || (npc.characterData && npc.characterData.broadType) || 'villager';
        if (broadType === 'merchant' || nameLower.includes('doran') || nameLower.includes('shopkeeper') || isPortalMerchant) {
            choices.unshift({
                text: "🏪 Barter / Open Shop",
                action: () => {
                    this._appendPlayerChoice("Show me your trade stocks.");
                    this.setDialogueMode('shop');
                }
            });
        }

        if (isPortalMerchant) {
            choices.push({
                text: "🚪 Return Home",
                action: () => {
                    this._appendPlayerChoice("I'm ready to head back to town.");
                    this.hideDialogue();
                    const dev = this.engine.editorManager?.editors.chaos_map_device;
                    if (dev && typeof dev.retreatFromItemWorld === 'function') {
                        dev.retreatFromItemWorld(false); // Dimensional Victory already claimed instantly
                    }
                }
            });
        }

        // Add task consultant check
        choices.push({
            text: "⚔️ Consult Quests",
            action: () => {
                this._appendPlayerChoice("Do you have any tasks for me?");
                
                if (this.engine.questSystem) {
                    const qObj = this.engine.questSystem.getNpcQuests(npc);
                    if (qObj.offered.length > 0) {
                        const q = qObj.offered[0];
                        this._triggerNpcResponse(`Actually yes, check out "${q.title}". Objective: ${q.description}. Will you help?`, () => {
                            this.renderQuestOfferDialogue(q);
                        });
                        return;
                    } else if (qObj.active.length > 0) {
                        const q = qObj.active[0];
                        const canComplete = this.engine.questSystem.canComplete(q);
                        if (canComplete) {
                            this._triggerNpcResponse(`Excellent! You completed my task: "${q.title}". Here are your rewards!`, () => {
                                this.engine.questSystem.completeQuest(q.id);
                                this._appendSystemMessage(`Completed: "${q.title}". Received gold & equipment!`);
                                this.setDialogueMode('talk');
                            });
                        } else {
                            this._triggerNpcResponse(`You're working on my task: "${q.title}". Progress: ${q.currentCount}/${q.targetCount}. Come back when done!`);
                        }
                        return;
                    }
                }

                const fallbackText = (npc.characterData && npc.characterData.description) || "No specific campaigns right now! Beat up some map slimes to gain power.";
                this._triggerNpcResponse(fallbackText);
            }
        });

        // Add part ways parting option
        choices.push({
            text: "❌ Part Ways",
            action: () => {
                this._appendPlayerChoice("I'll be going now. Farewell!");
                this._triggerNpcResponse("Travel safely, wanderer!", () => {
                    setTimeout(() => this.hideDialogue(), 800);
                });
            }
        });

        this._createTalkGrid(container, choices);
    }

    _executeBranchAction(branch, npc) {
        if (!branch.action || branch.action === 'none') return;

        const actionType = branch.action;
        const actionVal = branch.actionValue || '';

        if (actionType === 'give_item') {
            const itemName = actionVal || 'Red Potion';
            let itemToGive = null;

            // Strip count/index from NPC inventory if matching name
            if (Array.isArray(npc.inventory)) {
                const idx = npc.inventory.findIndex(it => it.name.trim().toLowerCase() === itemName.trim().toLowerCase());
                if (idx !== -1) {
                    itemToGive = { ...npc.inventory[idx] };
                    if (npc.inventory[idx].count > 1) {
                        npc.inventory[idx].count--;
                    } else {
                        npc.inventory.splice(idx, 1);
                    }
                }
            }

            // Create fallback custom item if not in stock
            if (!itemToGive) {
                itemToGive = {
                    name: itemName,
                    type: 'consumable',
                    heal: 25,
                    cost: 15,
                    value: 10,
                    description: 'A gifted resource.',
                    count: 1
                };
            }

            const player = this.engine.player;
            if (!player.inventory) player.inventory = [];
            
            // Assign a unique item runtime ID
            itemToGive.id = 'branch_item_' + Date.now() + Math.floor(Math.random() * 1000);
            player.inventory.push(itemToGive);
            this._appendSystemMessage(`Received: ${itemToGive.name} x${itemToGive.count || 1}`);

            // Update open screens
            if (this.dialogueMode === 'merchant' || this.dialogueMode === 'inventory') {
                this.renderInventoryWindow();
            }
        } 
        else if (actionType === 'heal') {
            const player = this.engine.player;
            if (player && player.stats) {
                player.stats.hp = player.stats.maxHp || player.stats.hp || 100;
                this._appendSystemMessage(`Health fully restored by ${npc.name}.`);
            }
        } 
        else if (actionType === 'combat') {
            this._appendSystemMessage(`Entering battle with ${npc.name}!`);
            setTimeout(() => {
                this.hideDialogue();

                // Get NPC map positions
                const mapX = npc.mapX;
                const mapY = npc.mapY;

                // Load custom enemy instance attributes
                const stats = npc.stats || { level: 1, hp: 50, maxHp: 50, atk: 10, def: 5, speed: 120 };
                const enemyInstanceData = {
                    name: npc.name,
                    stats: {
                        level: stats.level || 1,
                        hp: stats.hp || 50,
                        maxHp: stats.maxHp || 50,
                        atk: stats.atk || 10,
                        def: stats.def || 5,
                        speed: stats.speed || 120
                    },
                    visualWidth: 64,
                    visualHeight: 64,
                    anchorOffsetX: 32,
                    anchorOffsetY: 64,
                };

                // Add mapsprite options
                const enemyOptions = {
                    id: `enemy_transformed_${Date.now()}`,
                    name: npc.name,
                    stats: enemyInstanceData.stats,
                    visualWidth: 64,
                    visualHeight: 64,
                    anchorOffsetX: 32,
                    anchorOffsetY: 64,
                };

                if (npc.characterData && npc.characterData.map_sprite) {
                    const mapSpriteData = npc.characterData.map_sprite;
                    if (mapSpriteData.type === 'spritesheet') {
                        enemyOptions.assetName = 'npcSpritesheet';
                        enemyOptions.spriteSourceRect = { x: (mapSpriteData.source || 0) * 64, y: 0, width: 64, height: 64 };
                    } else if (mapSpriteData.type === 'custom' && typeof mapSpriteData.source === 'string') {
                        const customSprite = new Image();
                        customSprite.src = mapSpriteData.source;
                        enemyOptions.spriteImage = customSprite;
                    }
                }

                // Remove the NPC and spawn our battle-ready Enemy in its place
                const enemy = new Enemy(this.engine, this.engine.map, mapX, mapY, enemyOptions);
                this.engine.gameObjects = this.engine.gameObjects.filter(obj => obj !== npc);
                this.engine.gameObjects.push(enemy);

                // Set AI state to hunt down the user instantly
                enemy.aiState = 'chasing';
                console.log(`Successfully transformed NPC ${npc.name} into combat-hostile Enemy.`);
            }, 800);
        }
    }

    renderShopTalkMode(container) {
        const npc = this.participants[0];
        if (!npc) return;
        container.innerHTML = '';

        const choices = [
            {
                text: "🏪 Ask about prices",
                action: () => {
                    this._appendPlayerChoice("Who determines the shop prices around here?");
                    this._triggerNpcResponse(`All trade goods are priced at standard market values. I'll buy your backup weapons or gear at 70% of standard rates!`);
                }
            },
            {
                text: "🍯 Ask about supplies",
                action: () => {
                    this._appendPlayerChoice("Is there anything special you recommend?");
                    this._triggerNpcResponse(`Healing Red Potions and Green Herbs are extremely vital. Be sure to stay stocked up before engaging in combat with slimes!`);
                }
            }
        ];

        this._createTalkGrid(container, choices);
    }

    renderInventoryTalkMode(container) {
        const npc = this.participants[0];
        if (!npc) return;
        container.innerHTML = '';

        const choices = [
            {
                text: "⚔️ Ask about equipment",
                action: () => {
                    this._appendPlayerChoice("How do I boost my character stats with gear?");
                    this._triggerNpcResponse(`Equipping active weapons boosts your Attack (Atk) rating, and Shield slots increase Defense (Def). Swap and compare gear using this window!`);
                }
            },
            {
                text: "🎒 Ask about item requests",
                action: () => {
                    this._appendPlayerChoice("How do I request an item from your bag?");
                    this._triggerNpcResponse(`Just select any item in my backpack and click the requested action buttons to trade or negotiate item gifts!`);
                }
            }
        ];

        this._createTalkGrid(container, choices);
    }

    renderQuestsTalkMode(container) {
        const npc = this.participants[0];
        if (!npc) return;
        container.innerHTML = '';

        const choices = [
            {
                text: "📜 Ask about campaigns",
                action: () => {
                    this._appendPlayerChoice("What are active campaigns?");
                    this._triggerNpcResponse(`Campaigns are regional milestones! Complete local tasks (like beating slimes) and check back to gain gold and rare equipment items.`);
                }
            },
            {
                text: "🛠️ Ask about building",
                action: () => {
                    this._appendPlayerChoice("Can I modify this isometric town?");
                    this._triggerNpcResponse(`Indeed! Fire up the Map Editor (🛠️) on the top bar to expand map bounds, paint rich layers, or spawn houses and characters anytime!`);
                }
            }
        ];

        this._createTalkGrid(container, choices);
    }

    _createTalkGrid(container, choices) {
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = '1fr 1fr';
        grid.style.gap = '8px';
        grid.style.width = '100%';

        choices.forEach(c => {
            const btn = document.createElement('button');
            btn.textContent = c.text;
            btn.style.backgroundColor = '#8C6D56';
            btn.style.color = '#FFFFFF';
            btn.style.border = '2px solid #3B322C';
            btn.style.borderRadius = '6px';
            btn.style.padding = '6px 10px';
            btn.style.fontSize = '0.9em';
            btn.style.cursor = 'pointer';
            btn.style.textAlign = 'left';
            btn.style.fontWeight = 'bold';
            btn.style.transition = 'background-color 0.15s ease';
            
            btn.onmouseover = () => btn.style.backgroundColor = '#A07D65';
            btn.onmouseout = () => btn.style.backgroundColor = '#8C6D56';
            btn.onclick = () => {
                const allButtons = grid.querySelectorAll('button');
                allButtons.forEach(b => b.disabled = true);
                c.action();
            };
            grid.appendChild(btn);
        });

        container.appendChild(grid);
    }

    renderQuestOfferDialogue(quest) {
        const inputArea = this.domElement.querySelector('#rpg-dialogue-input-area');
        if (!inputArea) return;
        inputArea.innerHTML = '';

        const offerDiv = document.createElement('div');
        offerDiv.style.display = 'flex';
        offerDiv.style.flexDirection = 'column';
        offerDiv.style.gap = '8px';
        offerDiv.style.width = '100%';

        const desc = document.createElement('div');
        desc.style.fontSize = '0.9em';
        desc.style.color = '#FFD700';
        desc.style.fontWeight = 'bold';
        desc.textContent = `Offer: ${quest.title} (Reward: ${quest.rewardGold}G + ${quest.rewardItem ? quest.rewardItem.name : "None"})`;
        offerDiv.appendChild(desc);

        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.gap = '10px';

        const btnAccept = document.createElement('button');
        btnAccept.className = 'rpg-btn-buy';
        btnAccept.style.padding = '6px 20px';
        btnAccept.textContent = 'Accept Task';
        btnAccept.onclick = () => {
            btnAccept.disabled = true;
            btnDecline.disabled = true;
            this.engine.questSystem.acceptQuest(quest.id);
            this._appendSystemMessage(`Accepted Quest: ${quest.title}`);
            this._triggerNpcResponse("Splendid! I will await your victory.", () => {
                this.setDialogueMode('talk');
            });
        };

        const btnDecline = document.createElement('button');
        btnDecline.className = 'rpg-btn-sell';
        btnDecline.style.padding = '6px 20px';
        btnDecline.textContent = 'Decline';
        btnDecline.onclick = () => {
            btnAccept.disabled = true;
            btnDecline.disabled = true;
            this._triggerNpcResponse("Ah, what a shame. Let me know if you change your mind.", () => {
                this.setDialogueMode('talk');
            });
        };

        btnRow.appendChild(btnAccept);
        btnRow.appendChild(btnDecline);
        offerDiv.appendChild(btnRow);
        inputArea.appendChild(offerDiv);
    }

    // ------------------ RENDER DIALOGUE QUESTS PANEL (SLIDE-UP) ------------------
    renderQuestWindow() {
        const content = this.questsWindow.querySelector('#rpg-quests-content');
        if (!content) return;
        content.innerHTML = '';

        if (!this.engine.questSystem) {
            content.innerHTML = `<div style="padding: 15px; color: #ff6b6b; font-size: 0.9em; text-align: center;">Quest system not available.</div>`;
            return;
        }

        const layout = document.createElement('div');
        layout.className = 'rpg-scroll-section';
        layout.style.width = '100%';
        layout.style.height = '100%';
        layout.style.boxSizing = 'border-box';
        layout.style.display = 'flex';
        layout.style.flexDirection = 'column';
        layout.style.gap = '10px';

        const title = document.createElement('div');
        title.className = 'rpg-section-title';
        title.textContent = '📜 Active Campaign Tasks';
        title.style.marginBottom = '5px';
        layout.appendChild(title);

        const actives = this.engine.questSystem.activeQuests || [];
        if (actives.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = "No active campaign tasks right now. Speak to Lanna or Shortia, click 'Request Special Task' or 'Ask For Item' to undertake objectives!";
            empty.style.color = '#BCA893';
            empty.style.fontSize = '0.9em';
            empty.style.textAlign = 'center';
            empty.style.padding = '25px 15px';
            layout.appendChild(empty);
        } else {
            actives.forEach(q => {
                const row = document.createElement('div');
                row.className = 'rpg-item-row';
                row.style.flexDirection = 'column';
                row.style.alignItems = 'flex-start';
                row.style.gap = '6px';
                row.style.padding = '12px';
                row.style.border = '2px solid #5A4B3E';
                row.style.backgroundColor = 'rgba(74, 59, 48, 0.4)';
                row.style.borderRadius = '5px';

                // Title
                const qTitle = document.createElement('strong');
                qTitle.style.color = '#FFD700';
                qTitle.style.fontSize = '0.95em';
                qTitle.textContent = q.title;

                // Description
                const qDesc = document.createElement('span');
                qDesc.style.color = '#EFEBE0';
                qDesc.style.fontSize = '0.85em';
                qDesc.textContent = q.description;

                // Progress + Rewards Row
                const progressRow = document.createElement('div');
                progressRow.style.display = 'flex';
                progressRow.style.justifyContent = 'space-between';
                progressRow.style.width = '100%';
                progressRow.style.marginTop = '6px';
                progressRow.style.borderTop = '1px solid rgba(255, 255, 255, 0.1)';
                progressRow.style.paddingTop = '6px';

                const progress = document.createElement('strong');
                progress.style.color = '#2ecc71';
                progress.style.fontSize = '0.85em';
                progress.textContent = `Progress: ${q.currentCount} / ${q.targetCount}`;

                const rewards = document.createElement('span');
                rewards.style.color = '#f1c40f';
                rewards.style.fontSize = '0.85em';
                rewards.textContent = `Reward: ${q.rewardGold} G` + (q.rewardItem ? ` + ${q.rewardItem.name}` : '');

                progressRow.appendChild(progress);
                progressRow.appendChild(rewards);

                row.appendChild(qTitle);
                row.appendChild(qDesc);
                row.appendChild(progressRow);
                layout.appendChild(row);
            });
        }

        content.appendChild(layout);
    }

    _getItemEmoji(item) {
        if (!item) return '❓';
        if (item.emoji) return item.emoji;
        const name = item.name.toLowerCase();
        if (item.type === 'weapon') {
            if (name.includes('axe')) return '🪓';
            if (name.includes('bow')) return '🏹';
            if (name.includes('wand') || name.includes('staff')) return '🔮';
            return '🗡️';
        }
        if (item.type === 'shield') return '🛡️';
        if (item.type === 'armor') return '👕';
        if (item.type === 'consumable') {
            if (name.includes('potion')) return '❤️';
            if (name.includes('herb') || name.includes('leaf')) return '🌿';
            return '🍎';
        }
        return '📦';
    }

    // ------------------ RENDER DIALOGUE SHOP PANEL (SLIDE-UP) ------------------
    renderShopWindow() {
        const content = this.shopWindow.querySelector('#rpg-shop-content');
        if (!content) return;
        content.innerHTML = '';

        const player = this.engine.player;
        const npc = this.participants[0];
        if (!npc) return;

        // Initialize display indices
        if (this.selectedShopVendorIndex === undefined) this.selectedShopVendorIndex = 0;
        if (this.selectedShopPlayerIndex === undefined) this.selectedShopPlayerIndex = 0;

        // Check bounds
        const npcInv = npc.inventory || [];
        if (this.selectedShopVendorIndex >= npcInv.length) {
            this.selectedShopVendorIndex = npcInv.length - 1;
        }
        if (npcInv.length === 0) this.selectedShopVendorIndex = -1;

        const playerInv = player.inventory || [];
        if (this.selectedShopPlayerIndex >= playerInv.length) {
            this.selectedShopPlayerIndex = playerInv.length - 1;
        }
        if (playerInv.length === 0) this.selectedShopPlayerIndex = -1;

        // Two-column structure
        const layout = document.createElement('div');
        layout.className = 'rpg-two-column-layout';

        // LEFT COLUMN: MERCHANT INVENTORY (TO BUY)
        const leftCol = document.createElement('div');
        leftCol.className = 'rpg-scroll-section';

        const leftTitle = document.createElement('div');
        leftTitle.className = 'rpg-section-title';
        leftTitle.innerHTML = `<span>🏪 ${npc.name}'s Catalog Stock</span> <span>Vendor Stock</span>`;
        leftCol.appendChild(leftTitle);

        const vendorGrid = document.createElement('div');
        vendorGrid.className = 'inventory-grid-container';
        vendorGrid.style.gridTemplateColumns = 'repeat(6, 1fr)';
        vendorGrid.style.gap = '6px';
        vendorGrid.style.padding = '6px';
        vendorGrid.style.minHeight = '120px';
        vendorGrid.style.marginBottom = '8px';

        const gridSlotsCount = 18; // 6 cols * 3 rows
        for (let i = 0; i < gridSlotsCount; i++) {
            const it = npcInv[i] || null;
            const slot = document.createElement('div');
            slot.className = 'inventory-item-slot';
            if (it) {
                slot.className += ' filled';
                if (this.selectedShopVendorIndex === i) slot.className += ' selected';

                const emoji = document.createElement('span');
                emoji.className = 'item-slot-emoji';
                emoji.style.fontSize = '1.4em';
                emoji.textContent = this._getItemEmoji(it);
                slot.appendChild(emoji);

                const countBadge = document.createElement('span');
                countBadge.className = 'item-slot-count';
                countBadge.textContent = it.count > 1 ? `x${it.count}` : '';
                slot.appendChild(countBadge);

                const priceBadge = document.createElement('span');
                priceBadge.className = 'item-slot-price-badge';
                priceBadge.textContent = `${it.cost}G`;
                slot.appendChild(priceBadge);

                slot.title = `${it.name}\n${it.description}\nCost: ${it.cost}G`;

                slot.onclick = () => {
                    this.selectedShopVendorIndex = i;
                    this.selectedShopPlayerIndex = -1; // Deselect player item
                    this.renderShopWindow();
                };

                slot.ondblclick = (e) => {
                    e.stopPropagation();
                    this.selectedShopVendorIndex = i;
                    this.selectedShopPlayerIndex = -1;

                    if (player.gold < it.cost) {
                        CustomDialog.alert("Not enough gold!", "Empty Pockets");
                        return;
                    }

                    player.gold -= it.cost;
                    it.count--;

                    // Deliver to player bag
                    if (!player.inventory) player.inventory = [];
                    const playerExisting = player.inventory.find(invIt => invIt.name === it.name);
                    if (playerExisting) {
                        playerExisting.count++;
                    } else {
                        player.inventory.push({
                             id: `item_${Date.now()}_bought`,
                             name: it.name,
                             type: it.type,
                             heal: it.heal || 0,
                             bonusAtk: it.bonusAtk || 0,
                             bonusDef: it.bonusDef || 0,
                             description: it.description,
                             value: it.value || Math.floor(it.cost * 0.7),
                             count: 1,
                             equipped: false
                        });
                    }

                    if (it.count <= 0) {
                         npc.inventory = npc.inventory.filter(obj => obj.name !== it.name);
                         this.selectedShopVendorIndex = 0;
                    }

                    this._appendSystemMessage(`Purchased 1x ${it.name} for ${it.cost} G.`);
                    this.renderShopWindow();
                };
            } else {
                slot.className += ' empty';
                slot.innerHTML = '<span class="item-slot-dots">·</span>';
            }
            vendorGrid.appendChild(slot);
        }
        leftCol.appendChild(vendorGrid);

        // VENDOR ITEM DETAILS CARD BELOW GRID
        const vendorDetails = document.createElement('div');
        vendorDetails.className = 'rpg-item-row';
        vendorDetails.style.flexDirection = 'column';
        vendorDetails.style.alignItems = 'stretch';
        vendorDetails.style.marginTop = 'auto';
        vendorDetails.style.padding = '8px 10px';
        vendorDetails.style.gap = '4px';
        vendorDetails.style.minHeight = '64px';

        const selVendorItem = npcInv[this.selectedShopVendorIndex];
        if (selVendorItem) {
            const dNameRow = document.createElement('div');
            dNameRow.style.display = 'flex';
            dNameRow.style.justifyContent = 'space-between';
            dNameRow.style.alignItems = 'center';
            dNameRow.style.fontWeight = 'bold';
            dNameRow.style.fontSize = '0.85em';

            const nameSpan = document.createElement('span');
            nameSpan.style.color = '#FFD700';
            nameSpan.textContent = `${this._getItemEmoji(selVendorItem)} ${selVendorItem.name} (x${selVendorItem.count})`;

            const statSpan = document.createElement('span');
            statSpan.style.fontSize = '0.9em';
            statSpan.style.color = '#2ecc71';
            let statText = '';
            if (selVendorItem.bonusAtk) statText = `+${selVendorItem.bonusAtk} ATK`;
            else if (selVendorItem.bonusDef) statText = `+${selVendorItem.bonusDef} DEF`;
            else if (selVendorItem.heal) statText = `+${selVendorItem.heal} HP`;
            statSpan.textContent = statText;

            dNameRow.appendChild(nameSpan);
            dNameRow.appendChild(statSpan);

            const dDesc = document.createElement('div');
            dDesc.style.fontSize = '0.75em';
            dDesc.style.color = '#D4C8A0';
            dDesc.style.lineHeight = '1.2';
            dDesc.textContent = selVendorItem.description || 'No description.';

            const dActionRow = document.createElement('div');
            dActionRow.style.display = 'flex';
            dActionRow.style.justifyContent = 'space-between';
            dActionRow.style.alignItems = 'center';
            dActionRow.style.marginTop = '4px';

            const dPrice = document.createElement('span');
            dPrice.style.fontSize = '0.85em';
            dPrice.style.color = '#FFD700';
            dPrice.style.fontWeight = 'bold';
            dPrice.textContent = `${selVendorItem.cost}G`;

            const dBuyBtn = document.createElement('button');
            dBuyBtn.className = 'rpg-btn-buy';
            dBuyBtn.style.padding = '3px 12px';
            dBuyBtn.textContent = 'Buy';
            dBuyBtn.onclick = (e) => {
                e.stopPropagation();
                if (player.gold < selVendorItem.cost) {
                    CustomDialog.alert("Not enough gold!", "Empty Pockets");
                    return;
                }

                player.gold -= selVendorItem.cost;
                selVendorItem.count--;

                // Deliver to player bag
                if (!player.inventory) player.inventory = [];
                const playerExisting = player.inventory.find(invIt => invIt.name === selVendorItem.name);
                if (playerExisting) {
                    playerExisting.count++;
                } else {
                    player.inventory.push({
                         id: `item_${Date.now()}_bought`,
                         name: selVendorItem.name,
                         type: selVendorItem.type,
                         heal: selVendorItem.heal || 0,
                         bonusAtk: selVendorItem.bonusAtk || 0,
                         bonusDef: selVendorItem.bonusDef || 0,
                         description: selVendorItem.description,
                         value: selVendorItem.value || Math.floor(selVendorItem.cost * 0.7),
                         count: 1,
                         equipped: false
                    });
                }

                if (selVendorItem.count <= 0) {
                     npc.inventory = npc.inventory.filter(obj => obj.name !== selVendorItem.name);
                     this.selectedShopVendorIndex = 0;
                }

                this._appendSystemMessage(`Purchased 1x ${selVendorItem.name} for ${selVendorItem.cost} G.`);
                this.renderShopWindow();
            };

            dActionRow.appendChild(dPrice);
            dActionRow.appendChild(dBuyBtn);

            vendorDetails.appendChild(dNameRow);
            vendorDetails.appendChild(dDesc);
            vendorDetails.appendChild(dActionRow);
        } else {
            const dHint = document.createElement('div');
            dHint.style.color = '#A07D65';
            dHint.style.fontSize = '0.75em';
            dHint.style.textAlign = 'center';
            dHint.style.padding = '15px 0';
            dHint.style.fontStyle = 'italic';
            dHint.textContent = "Select a vendor item to buy.";
            vendorDetails.appendChild(dHint);
        }
        leftCol.appendChild(vendorDetails);

        // RIGHT COLUMN: PLAYER BACKPACK (TO SELL)
        const rightCol = document.createElement('div');
        rightCol.className = 'rpg-scroll-section';

        const rightTitle = document.createElement('div');
        rightTitle.className = 'rpg-section-title';
        rightTitle.innerHTML = `<span>🎒 Your Backpack</span> <span style="color:#FFD700">💰 Gold: ${player.gold} G</span>`;
        rightCol.appendChild(rightTitle);

        const playerGrid = document.createElement('div');
        playerGrid.className = 'inventory-grid-container';
        playerGrid.style.gridTemplateColumns = 'repeat(6, 1fr)';
        playerGrid.style.gap = '6px';
        playerGrid.style.padding = '6px';
        playerGrid.style.minHeight = '120px';
        playerGrid.style.marginBottom = '8px';

        for (let i = 0; i < gridSlotsCount; i++) {
            const it = playerInv[i] || null;
            const slot = document.createElement('div');
            slot.className = 'inventory-item-slot';
            if (it) {
                slot.className += ' filled';
                if (it.equipped) slot.className += ' equipped';
                if (this.selectedShopPlayerIndex === i) slot.className += ' selected';

                const emoji = document.createElement('span');
                emoji.className = 'item-slot-emoji';
                emoji.style.fontSize = '1.4em';
                emoji.textContent = this._getItemEmoji(it);
                slot.appendChild(emoji);

                const countBadge = document.createElement('span');
                countBadge.className = 'item-slot-count';
                countBadge.textContent = it.count > 1 ? `x${it.count}` : '';
                slot.appendChild(countBadge);

                if (it.equipped) {
                    const eqBadge = document.createElement('span');
                    eqBadge.className = 'item-equipped-indicator';
                    eqBadge.textContent = 'E';
                    slot.appendChild(eqBadge);
                }

                const priceBadge = document.createElement('span');
                priceBadge.className = 'item-slot-price-badge';
                const sellValue = it.value || Math.floor((it.cost || 20) * 0.7);
                priceBadge.textContent = `${sellValue}G`;
                slot.appendChild(priceBadge);

                slot.title = `${it.name}\n${it.description}`;

                slot.onclick = () => {
                    this.selectedShopPlayerIndex = i;
                    this.selectedShopVendorIndex = -1; // Deselect vendor item
                    this.renderShopWindow();
                };

                slot.ondblclick = (e) => {
                    e.stopPropagation();
                    this.selectedShopPlayerIndex = i;
                    this.selectedShopVendorIndex = -1;

                    const sellValue = it.value || Math.floor((it.cost || 20) * 0.7);
                    player.gold += sellValue;
                    it.count--;

                    // Deliver stock back to shopkeeper
                    const shopExisting = npc.inventory.find(idxIt => idxIt.name === it.name);
                    if (shopExisting) {
                        shopExisting.count++;
                    } else {
                        npc.inventory.push({
                            name: it.name,
                            type: it.type,
                            heal: it.heal || 0,
                            bonusAtk: it.bonusAtk || 0,
                            bonusDef: it.bonusDef || 0,
                            description: it.description || '',
                            cost: it.cost || Math.floor(sellValue / 0.7),
                            value: sellValue,
                            count: 1
                        });
                    }

                    if (it.count <= 0) {
                        player.inventory = player.inventory.filter(pi => pi.id !== it.id);
                        this.selectedShopPlayerIndex = 0;
                    }

                    this._appendSystemMessage(`Sold 1x ${it.name} for ${sellValue} G.`);
                    this.renderShopWindow();
                };
            } else {
                slot.className += ' empty';
                slot.innerHTML = '<span class="item-slot-dots">·</span>';
            }
            playerGrid.appendChild(slot);
        }
        rightCol.appendChild(playerGrid);

        // PLAYER BACKPACK ITEM DETAILS CARD BELOW GRID
        const playerDetails = document.createElement('div');
        playerDetails.className = 'rpg-item-row';
        playerDetails.style.flexDirection = 'column';
        playerDetails.style.alignItems = 'stretch';
        playerDetails.style.marginTop = 'auto';
        playerDetails.style.padding = '8px 10px';
        playerDetails.style.gap = '4px';
        playerDetails.style.minHeight = '64px';

        const selPlayerItem = playerInv[this.selectedShopPlayerIndex];
        if (selPlayerItem) {
            const dNameRow = document.createElement('div');
            dNameRow.style.display = 'flex';
            dNameRow.style.justifyContent = 'space-between';
            dNameRow.style.alignItems = 'center';
            dNameRow.style.fontWeight = 'bold';
            dNameRow.style.fontSize = '0.85em';

            const nameSpan = document.createElement('span');
            nameSpan.style.color = '#FFF';
            nameSpan.textContent = `${this._getItemEmoji(selPlayerItem)} ${selPlayerItem.name} (x${selPlayerItem.count})${selPlayerItem.equipped ? ' [E]' : ''}`;

            const statSpan = document.createElement('span');
            statSpan.style.fontSize = '0.9em';
            statSpan.style.color = '#2ecc71';
            let statText = '';
            if (selPlayerItem.bonusAtk) statText = `+${selPlayerItem.bonusAtk} ATK`;
            else if (selPlayerItem.bonusDef) statText = `+${selPlayerItem.bonusDef} DEF`;
            else if (selPlayerItem.heal) statText = `+${selPlayerItem.heal} HP`;
            statSpan.textContent = statText;

            dNameRow.appendChild(nameSpan);
            dNameRow.appendChild(statSpan);

            const dDesc = document.createElement('div');
            dDesc.style.fontSize = '0.75em';
            dDesc.style.color = '#D4C8A0';
            dDesc.style.lineHeight = '1.2';
            dDesc.textContent = selPlayerItem.description || 'No description.';

            const dActionRow = document.createElement('div');
            dActionRow.style.display = 'flex';
            dActionRow.style.justifyContent = 'space-between';
            dActionRow.style.alignItems = 'center';
            dActionRow.style.marginTop = '4px';

            const sellValue = selPlayerItem.value || Math.floor((selPlayerItem.cost || 20) * 0.7);

            const dPrice = document.createElement('span');
            dPrice.style.fontSize = '0.85em';
            dPrice.style.color = '#FFD700';
            dPrice.style.fontWeight = 'bold';
            dPrice.textContent = `${sellValue}G`;

            const dSellBtn = document.createElement('button');
            dSellBtn.className = 'rpg-btn-sell';
            dSellBtn.style.padding = '3px 12px';
            dSellBtn.textContent = 'Sell';
            dSellBtn.onclick = (e) => {
                e.stopPropagation();
                player.gold += sellValue;
                selPlayerItem.count--;

                // Deliver stock back to shopkeeper
                const shopExisting = npc.inventory.find(i => i.name === selPlayerItem.name);
                if (shopExisting) {
                    shopExisting.count++;
                } else {
                    npc.inventory.push({
                        name: selPlayerItem.name,
                        type: selPlayerItem.type,
                        heal: selPlayerItem.heal || 0,
                        bonusAtk: selPlayerItem.bonusAtk || 0,
                        bonusDef: selPlayerItem.bonusDef || 0,
                        description: selPlayerItem.description || '',
                        cost: selPlayerItem.cost || Math.floor(sellValue / 0.7),
                        value: sellValue,
                        count: 1
                    });
                }

                if (selPlayerItem.count <= 0) {
                    player.inventory = player.inventory.filter(pi => pi.id !== selPlayerItem.id);
                    this.selectedShopPlayerIndex = 0;
                }

                this._appendSystemMessage(`Sold 1x ${selPlayerItem.name} for ${sellValue} G.`);
                this.renderShopWindow();
            };

            dActionRow.appendChild(dPrice);
            dActionRow.appendChild(dSellBtn);

            playerDetails.appendChild(dNameRow);
            playerDetails.appendChild(dDesc);
            playerDetails.appendChild(dActionRow);
        } else {
            const dHint = document.createElement('div');
            dHint.style.color = '#A07D65';
            dHint.style.fontSize = '0.75em';
            dHint.style.textAlign = 'center';
            dHint.style.padding = '15px 0';
            dHint.style.fontStyle = 'italic';
            dHint.textContent = "Select backpack item to sell.";
            playerDetails.appendChild(dHint);
        }
        rightCol.appendChild(playerDetails);

        layout.appendChild(leftCol);
        layout.appendChild(rightCol);
        content.appendChild(layout);
    }

    // ------------------ RENDER DIAGUE INVENTORY GEAR PANEL ------------------
    renderInventoryWindow() {
        const content = this.inventoryWindow.querySelector('#rpg-inventory-content');
        if (!content) return;
        content.innerHTML = '';

        const player = this.engine.player;
        const npc = this.participants[0];
        if (!npc) return;

        // Initialize display indices
        if (this.selectedInspectPlayerIndex === undefined) this.selectedInspectPlayerIndex = 0;
        if (this.selectedInspectNpcIndex === undefined) this.selectedInspectNpcIndex = 0;

        // Calculate combat power stats
        const activeWeapon = player.inventory.find(i => i.type === 'weapon' && i.equipped);
        const activeShield = player.inventory.find(i => i.type === 'shield' && i.equipped);

        const currentAtk = 10 + (activeWeapon ? (activeWeapon.bonusAtk || 0) : 0);
        const currentDef = 5 + (activeShield ? (activeShield.bonusDef || 0) : 0);

        player.stats.atk = currentAtk;
        player.stats.def = currentDef;

        const playerInv = player.inventory || [];
        if (this.selectedInspectPlayerIndex >= playerInv.length) {
            this.selectedInspectPlayerIndex = playerInv.length - 1;
        }
        if (playerInv.length === 0) this.selectedInspectPlayerIndex = -1;

        const npcInv = npc.inventory || [];
        if (this.selectedInspectNpcIndex >= npcInv.length) {
            this.selectedInspectNpcIndex = npcInv.length - 1;
        }
        if (npcInv.length === 0) this.selectedInspectNpcIndex = -1;

        // Two-column comparative inspect grid
        const layout = document.createElement('div');
        layout.className = 'rpg-two-column-layout';

        // LEFT COLUMN: PLAYER STATUS & WEAPONS
        const leftCol = document.createElement('div');
        leftCol.className = 'rpg-scroll-section';

        const leftTitle = document.createElement('div');
        leftTitle.className = 'rpg-section-title';
        leftTitle.innerHTML = `<span>🎒 Player Backpack</span> <span style="color:#C0392B; font-weight:bold">HP: ${player.stats.hp}/${player.stats.maxHp} HP</span>`;
        leftCol.appendChild(leftTitle);

        const statsRow = document.createElement('div');
        statsRow.style.fontSize = '0.8em';
        statsRow.style.fontWeight = 'bold';
        statsRow.style.marginBottom = '6px';
        statsRow.innerHTML = `⚔️ ATK: <span style="color:#f39c12">${currentAtk}</span> | 🛡️ DEF: <span style="color:#2ecc71">${currentDef}</span>`;
        leftCol.appendChild(statsRow);

        const playerGrid = document.createElement('div');
        playerGrid.className = 'inventory-grid-container';
        playerGrid.style.gridTemplateColumns = 'repeat(6, 1fr)';
        playerGrid.style.gap = '6px';
        playerGrid.style.padding = '6px';
        playerGrid.style.minHeight = '120px';
        playerGrid.style.marginBottom = '8px';

        const gridSlotsCount = 18;
        for (let i = 0; i < gridSlotsCount; i++) {
            const it = playerInv[i] || null;
            const slot = document.createElement('div');
            slot.className = 'inventory-item-slot';
            if (it) {
                slot.className += ' filled';
                if (it.equipped) slot.className += ' equipped';
                if (this.selectedInspectPlayerIndex === i) slot.className += ' selected';

                const emoji = document.createElement('span');
                emoji.className = 'item-slot-emoji';
                emoji.style.fontSize = '1.4em';
                emoji.textContent = this._getItemEmoji(it);
                slot.appendChild(emoji);

                const countBadge = document.createElement('span');
                countBadge.className = 'item-slot-count';
                countBadge.textContent = it.count > 1 ? `x${it.count}` : '';
                slot.appendChild(countBadge);

                if (it.equipped) {
                    const eqBadge = document.createElement('span');
                    eqBadge.className = 'item-equipped-indicator';
                    eqBadge.textContent = 'E';
                    slot.appendChild(eqBadge);
                }

                slot.title = `${it.name}\n${it.description}`;

                slot.onclick = () => {
                    this.selectedInspectPlayerIndex = i;
                    this.selectedInspectNpcIndex = -1; // Deselect NPC item
                    this.renderInventoryWindow();
                };
            } else {
                slot.className += ' empty';
                slot.innerHTML = '<span class="item-slot-dots">·</span>';
            }
            playerGrid.appendChild(slot);
        }
        leftCol.appendChild(playerGrid);

        // PLAYER INSPECT DETAILS SHEET BELOW GRID
        const playerDetails = document.createElement('div');
        playerDetails.className = 'rpg-item-row';
        playerDetails.style.flexDirection = 'column';
        playerDetails.style.alignItems = 'stretch';
        playerDetails.style.marginTop = 'auto';
        playerDetails.style.padding = '8px 10px';
        playerDetails.style.gap = '4px';
        playerDetails.style.minHeight = '64px';

        const selInspectItem = playerInv[this.selectedInspectPlayerIndex];
        if (selInspectItem) {
            const dNameRow = document.createElement('div');
            dNameRow.style.display = 'flex';
            dNameRow.style.justifyContent = 'space-between';
            dNameRow.style.alignItems = 'center';
            dNameRow.style.fontWeight = 'bold';
            dNameRow.style.fontSize = '0.85em';

            const nameSpan = document.createElement('span');
            nameSpan.style.color = selInspectItem.equipped ? '#2ecc71' : '#FFF';
            nameSpan.textContent = `${this._getItemEmoji(selInspectItem)} ${selInspectItem.name} (x${selInspectItem.count})${selInspectItem.equipped ? ' [E]' : ''}`;

            const statSpan = document.createElement('span');
            statSpan.style.fontSize = '0.9em';
            statSpan.style.color = '#2ecc71';
            let statText = '';
            if (selInspectItem.bonusAtk) statText = `+${selInspectItem.bonusAtk} ATK`;
            else if (selInspectItem.bonusDef) statText = `+${selInspectItem.bonusDef} DEF`;
            else if (selInspectItem.heal) statText = `+${selInspectItem.heal} HP`;
            statSpan.textContent = statText;

            dNameRow.appendChild(nameSpan);
            dNameRow.appendChild(statSpan);

            const dDesc = document.createElement('div');
            dDesc.style.fontSize = '0.75em';
            dDesc.style.color = '#D4C8A0';
            dDesc.style.lineHeight = '1.2';
            dDesc.textContent = selInspectItem.description || 'No description.';

            const dActionRow = document.createElement('div');
            dActionRow.style.display = 'flex';
            dActionRow.style.justifyContent = 'flex-end';
            dActionRow.style.marginTop = '4px';

            const btn = document.createElement('button');
            btn.style.fontSize = '0.75em';
            btn.style.padding = '3px 12px';

            if (selInspectItem.type === 'consumable') {
                btn.className = 'rpg-btn-use';
                btn.textContent = 'Use';
                btn.onclick = (e) => {
                    e.stopPropagation();
                    if (player.stats.hp >= player.stats.maxHp) {
                        CustomDialog.alert("Your HP is fully topped!", "Full Vitality");
                        return;
                    }
                    const hpHealed = Math.min(player.stats.maxHp - player.stats.hp, selInspectItem.heal || 15);
                    player.stats.hp += hpHealed;
                    selInspectItem.count--;
                    if (selInspectItem.count <= 0) {
                        player.inventory = player.inventory.filter(obj => obj.id !== selInspectItem.id);
                        this.selectedInspectPlayerIndex = 0;
                    }
                    this._appendSystemMessage(`Consumed ${selInspectItem.name}. Restored +${hpHealed} HP.`);
                    this.renderInventoryWindow();
                };
            } else {
                btn.className = selInspectItem.equipped ? 'rpg-btn-sell' : 'rpg-btn-equip';
                btn.textContent = selInspectItem.equipped ? 'Unequip' : 'Equip';
                btn.onclick = (e) => {
                    e.stopPropagation();
                    if (selInspectItem.equipped) {
                        selInspectItem.equipped = false;
                        this._appendSystemMessage(`Unequipped ${selInspectItem.name}.`);
                    } else {
                        // Slot locking checks
                        if (selInspectItem.type === 'weapon') {
                            player.inventory.forEach(other => { if (other.type === 'weapon') other.equipped = false; });
                        } else if (selInspectItem.type === 'shield' || selInspectItem.type === 'armor') {
                            player.inventory.forEach(other => { if (other.type === 'shield' || other.type === 'armor') other.equipped = false; });
                        }
                        selInspectItem.equipped = true;
                        this._appendSystemMessage(`Equipped ${selInspectItem.name}!`);
                    }
                    this.renderInventoryWindow();
                };
            }
            dActionRow.appendChild(btn);

            playerDetails.appendChild(dNameRow);
            playerDetails.appendChild(dDesc);
            playerDetails.appendChild(dActionRow);
        } else {
            const dHint = document.createElement('div');
            dHint.style.color = '#A07D65';
            dHint.style.fontSize = '0.75em';
            dHint.style.textAlign = 'center';
            dHint.style.padding = '15px 0';
            dHint.style.fontStyle = 'italic';
            dHint.textContent = "Select backpack item to inspect.";
            playerDetails.appendChild(dHint);
        }
        leftCol.appendChild(playerDetails);

        // RIGHT COLUMN: NPC INVENTORY & EQUIPMENT (SOCIALLY INTERACTIVE)
        const rightCol = document.createElement('div');
        rightCol.className = 'rpg-scroll-section';

        const rightTitle = document.createElement('div');
        rightTitle.className = 'rpg-section-title';
        rightTitle.innerHTML = `<span>👑 ${npc.name}'s Payload Pack</span> <span>Broad: ${npc.broadType || (npc.characterData && npc.characterData.broadType) || 'villager'}</span>`;
        rightCol.appendChild(rightTitle);

        // Status Weapon lines
        const eqWeaponStr = npc.equippedWeapon ? `${npc.equippedWeapon.name} (+${npc.equippedWeapon.bonusAtk} Atk)` : 'None';
        const eqShieldStr = npc.equippedShield ? `${npc.equippedShield.name} (+${npc.equippedShield.bonusDef} Def)` : 'None';

        const eqDiv = document.createElement('div');
        eqDiv.style.fontSize = '0.75em';
        eqDiv.style.color = '#D4C8A0';
        eqDiv.style.marginBottom = '6px';
        eqDiv.style.borderBottom = '1px dashed #5A4B3E';
        eqDiv.style.paddingBottom = '4px';
        eqDiv.innerHTML = `⚔️ Weapon: <span style="color:#FFF">${eqWeaponStr}</span> | 🛡️ Offhand: <span style="color:#FFF">${eqShieldStr}</span>`;
        rightCol.appendChild(eqDiv);

        const npcGrid = document.createElement('div');
        npcGrid.className = 'inventory-grid-container';
        npcGrid.style.gridTemplateColumns = 'repeat(6, 1fr)';
        npcGrid.style.gap = '6px';
        npcGrid.style.padding = '6px';
        npcGrid.style.minHeight = '120px';
        npcGrid.style.marginBottom = '8px';

        for (let i = 0; i < gridSlotsCount; i++) {
            const it = npcInv[i] || null;
            const slot = document.createElement('div');
            slot.className = 'inventory-item-slot';
            if (it) {
                slot.className += ' filled';
                if (this.selectedInspectNpcIndex === i) slot.className += ' selected';

                const emoji = document.createElement('span');
                emoji.className = 'item-slot-emoji';
                emoji.style.fontSize = '1.4em';
                emoji.textContent = this._getItemEmoji(it);
                slot.appendChild(emoji);

                const countBadge = document.createElement('span');
                countBadge.className = 'item-slot-count';
                countBadge.textContent = it.count > 1 ? `x${it.count}` : '';
                slot.appendChild(countBadge);

                slot.title = `${it.name}\n${it.description}`;

                slot.onclick = () => {
                    this.selectedInspectNpcIndex = i;
                    this.selectedInspectPlayerIndex = -1; // Deselect Player item
                    this.renderInventoryWindow();
                };
            } else {
                slot.className += ' empty';
                slot.innerHTML = '<span class="item-slot-dots">·</span>';
            }
            npcGrid.appendChild(slot);
        }
        rightCol.appendChild(npcGrid);

        // NPC INSPECT DETAILS SHEET BELOW GRID
        const npcDetails = document.createElement('div');
        npcDetails.className = 'rpg-item-row';
        npcDetails.style.flexDirection = 'column';
        npcDetails.style.alignItems = 'stretch';
        npcDetails.style.marginTop = 'auto';
        npcDetails.style.padding = '8px 10px';
        npcDetails.style.gap = '4px';
        npcDetails.style.minHeight = '64px';

        const selNpcItem = npcInv[this.selectedInspectNpcIndex];
        if (selNpcItem) {
            const dNameRow = document.createElement('div');
            dNameRow.style.display = 'flex';
            dNameRow.style.justifyContent = 'space-between';
            dNameRow.style.alignItems = 'center';
            dNameRow.style.fontWeight = 'bold';
            dNameRow.style.fontSize = '0.85em';

            const nameSpan = document.createElement('span');
            nameSpan.style.color = '#FFF';
            nameSpan.textContent = `${this._getItemEmoji(selNpcItem)} ${selNpcItem.name} (x${selNpcItem.count})`;

            const statSpan = document.createElement('span');
            statSpan.style.fontSize = '0.9em';
            statSpan.style.color = '#2ecc71';
            let statText = '';
            if (selNpcItem.bonusAtk) statText = `+${selNpcItem.bonusAtk} ATK`;
            else if (selNpcItem.bonusDef) statText = `+${selNpcItem.bonusDef} DEF`;
            else if (selNpcItem.heal) statText = `+${selNpcItem.heal} HP`;
            statSpan.textContent = statText;

            dNameRow.appendChild(nameSpan);
            dNameRow.appendChild(statSpan);

            const dDesc = document.createElement('div');
            dDesc.style.fontSize = '0.75em';
            dDesc.style.color = '#D4C8A0';
            dDesc.style.lineHeight = '1.2';
            dDesc.textContent = selNpcItem.description || 'No description.';

            const dActionRow = document.createElement('div');
            dActionRow.style.display = 'flex';
            dActionRow.style.justifyContent = 'flex-end';
            dActionRow.style.marginTop = '4px';

            const btn = document.createElement('button');
            const isChest = npc.broadType === 'chest' || (npc.characterData && npc.characterData.broadType === 'chest');
            
            if (isChest) {
                btn.className = 'rpg-btn-quest';
                btn.style.fontSize = '0.75em';
                btn.style.padding = '3px 12px';
                btn.textContent = 'Take Item';
                btn.title = `Take ${selNpcItem.name} from the container chest.`;
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const player = this.engine.player;
                    
                    // Add item to player inventory or increase its count
                    if (!player.inventory) player.inventory = [];
                    const playerExisting = player.inventory.find(invIt => invIt.name === selNpcItem.name);
                    
                    const itemToGive = { ...selNpcItem };
                    if (playerExisting) {
                        playerExisting.count++;
                    } else {
                        itemToGive.id = 'chest_item_' + Date.now() + Math.floor(Math.random() * 1000);
                        itemToGive.count = 1;
                        itemToGive.equipped = false;
                        player.inventory.push(itemToGive);
                    }
                    
                    // Subtract or remove from npc inventory
                    if (selNpcItem.count > 1) {
                        selNpcItem.count--;
                    } else {
                        npcInv.splice(this.selectedInspectNpcIndex, 1);
                        this.selectedInspectNpcIndex = 0;
                    }
                    
                    this._appendSystemMessage(`Looted: 1x ${itemToGive.name} from the chest.`);
                    this._triggerNpcResponse(`*Click-click*... You took 1x ${itemToGive.name}.`);
                    this.renderInventoryWindow();
                };
            } else {
                btn.className = 'rpg-btn-quest';
                btn.style.fontSize = '0.75em';
                btn.style.padding = '3px 12px';
                btn.textContent = 'Ask For Item';
                btn.title = `Ask ${npc.name} to grant you this item in exchange for a local task.`;
                btn.onclick = (e) => {
                    e.stopPropagation();
                    this._appendPlayerChoice(`Could I have your "${selNpcItem.name}"?`);

                    if (this.engine.questSystem) {
                        const customQuest = this.engine.questSystem.generateItemQuest(npc, selNpcItem);
                        this._triggerNpcResponse(`Well, I can't just part with my ${selNpcItem.name} for free. But if you helper me with "${customQuest.title}", I'll give it to you! Will you help?`, () => {
                            this.renderQuestOfferDialogue(customQuest);
                        });
                    } else {
                        this._triggerNpcResponse(`I am sorry, my quest trackers appear offline. Try again later!`);
                    }
                };
            }
            dActionRow.appendChild(btn);

            npcDetails.appendChild(dNameRow);
            npcDetails.appendChild(dDesc);
            npcDetails.appendChild(dActionRow);
        } else {
            const dHint = document.createElement('div');
            dHint.style.color = '#A07D65';
            dHint.style.fontSize = '0.75em';
            dHint.style.textAlign = 'center';
            dHint.style.padding = '15px 0';
            dHint.style.fontStyle = 'italic';
            dHint.textContent = "Select their backpack item to ask for.";
            npcDetails.appendChild(dHint);
        }
        rightCol.appendChild(npcDetails);

        layout.appendChild(leftCol);
        layout.appendChild(rightCol);
        content.appendChild(layout);
    }

    _appendPlayerChoice(text) {
        this._appendMessage(text, "Player", true);
        this.engine.map.chatHistory.push({ speaker: "Player", text: text });
    }

    _triggerNpcResponse(replyText, onComplete) {
        const npc = this.participants[0];
        if (!npc) return;

        const npcMessageEntry = this._appendMessage("", npc.characterData.name, false);
        const npcMessageSpan = npcMessageEntry.querySelector('span');
        
        // Disable actions buttons during typewriter sequence to maintain state stability
        const actionButtons = this.domElement.querySelectorAll('#rpg-dialogue-controls button');
        actionButtons.forEach(b => b.disabled = true);

        let i = 0;
        const intervalId = setInterval(() => {
            if (i < replyText.length) {
                const chunk = replyText.slice(0, i + 1);
                npcMessageSpan.textContent = chunk;
                this._updateAvatar(chunk, npc);
                i += Math.max(1, Math.floor(replyText.length / 32));
            } else {
                clearInterval(intervalId);
                npcMessageSpan.textContent = replyText;
                this._updateAvatar(replyText, npc);
                
                // Add to history
                this.engine.map.chatHistory.push({ speaker: npc.characterData.name, text: replyText });
                
                // Re-enable actions buttons
                actionButtons.forEach(b => b.disabled = false);

                // ALSO re-enable the actual player dialogue choices or options in the input area!
                const inputArea = this.domElement.querySelector('#rpg-dialogue-input-area');
                if (inputArea && !onComplete) {
                    // Re-enable existing talk choices inside the input area if no state transition is happening
                    const inlineButtons = inputArea.querySelectorAll('button');
                    inlineButtons.forEach(b => b.disabled = false);
                }

                if (onComplete) {
                    onComplete();
                }
            }
        }, 15);
    }

    _inviteToGroupChat(npc) {
        if (this.participants.length >= 2) {
            this._appendSystemMessage(`${npc.name} tries to join, but the conversation is full.`);
            return;
        }
        if (this.participants.find(p => p.id === npc.id)) return;

        this.participants.push(npc);
        this._ensureNpcInventory(npc);
        
        const charImageRight = this.domElement.querySelector('#rpg-dialogue-character-image-right');
        const mainAvatarUrl = (npc.characterData.dialogue_avatars && npc.characterData.dialogue_avatars.main) ? npc.characterData.dialogue_avatars.main : (npc.characterData.avatarUrl || './game/assets/character_dialogue_image.png');
        
        this.participantData.push({
            npc: npc,
            imageEl: charImageRight,
            mainAvatarUrl: mainAvatarUrl
        });

        if (charImageRight) {
            charImageRight.src = mainAvatarUrl;
            charImageRight.style.display = 'block';
        }

        this._appendSystemMessage(`${npc.name} has joined the conversation.`);

        const nameTag = this.domElement.querySelector('#rpg-dialogue-name-tag');
        if (nameTag) nameTag.textContent = this.participants.map(p => p.name).join(' & ');
    }

    _appendSystemMessage(text) {
        const messagesArea = this.domElement.querySelector('#rpg-dialogue-messages');
        if (!messagesArea) return;
        const messageEntry = document.createElement('div');
        messageEntry.classList.add('rpg-dialogue-entry', 'system-entry');
        
        const messageText = document.createElement('span');
        messageText.textContent = text;
        
        messageEntry.appendChild(messageText);
        messagesArea.appendChild(messageEntry);
        messagesArea.scrollTop = messagesArea.scrollHeight;
    }

    showInterjection(reactingNpc, text) {
        const container = this.domElement.querySelector('#rpg-dialogue-interjections-container');
        if (!container) return;

        this._ensureNpcInventory(reactingNpc);

        const interjectionElement = document.createElement('div');
        interjectionElement.className = 'rpg-dialogue-interjection';
        interjectionElement.title = `Click to invite ${reactingNpc.name} to the conversation.`;
        interjectionElement.onclick = () => this._inviteToGroupChat(reactingNpc);

        const avatar = document.createElement('img');
        const { avatarUrl, dialogue_avatars } = reactingNpc.characterData;
        const interjectionAvatarUrl = (dialogue_avatars && dialogue_avatars.main) ? dialogue_avatars.main : (avatarUrl || './game/assets/character_dialogue_image.png');
        avatar.src = interjectionAvatarUrl;

        const bubble = document.createElement('div');
        bubble.className = 'rpg-dialogue-interjection-bubble';

        const nameTag = document.createElement('strong');
        nameTag.textContent = reactingNpc.name;

        const textSpan = document.createElement('span');
        textSpan.textContent = text;

        bubble.appendChild(nameTag);
        bubble.appendChild(textSpan);

        interjectionElement.appendChild(avatar);
        interjectionElement.appendChild(bubble);

        container.appendChild(interjectionElement);

        requestAnimationFrame(() => {
            interjectionElement.classList.add('show');
        });

        setTimeout(() => {
            interjectionElement.classList.remove('show');
            setTimeout(() => {
                if (container.contains(interjectionElement)) {
                    container.removeChild(interjectionElement);
                }
            }, 500);
        }, 7000);
    }

    _appendMessage(text, sender, isUser = false) {
        const messagesArea = this.domElement.querySelector('#rpg-dialogue-messages');
        if (!messagesArea) return document.createElement('div');
        const messageEntry = document.createElement('div');
        messageEntry.classList.add('rpg-dialogue-entry');
        if (isUser) {
            messageEntry.classList.add('user-entry');
        } else {
            messageEntry.classList.add('npc-entry');
        }

        const senderTag = document.createElement('strong');
        senderTag.textContent = `${sender}: `;
        
        const messageText = document.createElement('span');
        messageText.textContent = text;
        
        messageEntry.appendChild(senderTag);
        messageEntry.appendChild(messageText);
        messagesArea.appendChild(messageEntry);

        messagesArea.scrollTop = messagesArea.scrollHeight; // Auto-scroll
        return messageEntry;
    }

    _updateAvatar(text, npc) {
        const participant = this.participantData.find(p => p.npc.id === npc.id);
        if (!participant || !participant.npc.characterData || !participant.npc.characterData.dialogue_avatars) {
            return;
        }

        const reactiveAvatars = participant.npc.characterData.dialogue_avatars.reactive || [];
        if (reactiveAvatars.length === 0) {
            return;
        }

        const charImage = participant.imageEl;
        let newAvatarSet = false;
        const lowerCaseText = text.toLowerCase();

        let lastMatch = null;
        for (const avatarInfo of reactiveAvatars) {
            if (avatarInfo.keyword) {
                const keywords = avatarInfo.keyword.split(',').map(k => k.trim().toLowerCase());
                for (const keyword of keywords) {
                    if (keyword && lowerCaseText.includes(keyword)) {
                        lastMatch = avatarInfo;
                        break;
                    }
                }
            }
        }

        if (lastMatch && charImage) {
            if (charImage.src !== lastMatch.dataUrl) {
                charImage.src = lastMatch.dataUrl;
            }
            newAvatarSet = true;
        }

        if (!newAvatarSet && charImage && charImage.src !== participant.mainAvatarUrl) {
            charImage.src = participant.mainAvatarUrl;
        }
    }
}

export default DialogueUI;
