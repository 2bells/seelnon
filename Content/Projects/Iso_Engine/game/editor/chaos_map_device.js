// Portal Map Device (Disgaea-Style Item World & PoE Map System)
console.log("rpg/game/editor/chaos_map_device.js loaded");

import CustomDialog from '../ui/custom_dialog.js';
import NPC from '../entities/npc.js';

// Random funny map modifier generator
const MAP_MODIFIERS = [
    { text: "👹 Boss is Colossal (+50% Boss HP, +20% Boss Size)", key: "colossal_boss", value: 1.5, type: "boss_hp" },
    { text: "⚡ Hasteful Leylines (+25% Player Speed)", key: "player_speed", value: 1.25, type: "player_speed" },
    { text: "🧲 Gravity Anomalies (-15% Player Speed, +30% Item XP)", key: "gravity", value: 1.3, type: "item_xp" },
    { text: "🪙 Tome of Midas (+100% Gold reward drops)", key: "gold_fever", value: 2.0, type: "gold" },
    { text: "🔥 Volatile Sludge (Monsters explode on death dealing 5 damage)", key: "volatile_sludge", value: 1.2, type: "volatile" },
    { text: "🛡️ Hardened Scales (Monsters have +5 Defense)", key: "hardened_scales", value: 5, type: "monster_def" },
    { text: "☄️ Meteor Fallouts (Random meteors falling periodically)", key: "meteors", value: 1.4, type: "meteors" },
    { text: "🔮 Overflowing Mana (+50% Skill damage / shorter cooldowns)", key: "mana_overflow", value: 1.5, type: "cooldown_mod" }
];

export default class ChaosMapDevice {
    constructor(engine, modalContentElement) {
        this.engine = engine;
        this.modalContentElement = modalContentElement;

        this.isActive = false;
        this.panel = null;

        // Current rolling state
        this.selectedItemId = '';
        this.mapTier = 'magic'; // 'normal', 'magic', 'rare', 'legendary'
        this.activeModifiers = [];
        this.itemXPMultiplier = 1.0;

        this.initUI();
    }

    initUI() {
        if (this.panel) return;

        // Create the main absolute panel
        this.panel = document.createElement('div');
        this.panel.id = 'rpg-chaos-map-device-panel';
        this.panel.style.display = 'none';

        // Title and collapse button
        const titleButton = document.createElement('button');
        titleButton.id = 'rpg-chaos-map-device-toggle';
        titleButton.textContent = 'Portal Map Device (Item World)';
        titleButton.onclick = () => this.panel.classList.toggle('collapsed');
        this.panel.appendChild(titleButton);

        const content = document.createElement('div');
        content.id = 'rpg-chaos-map-device-content';
        content.style.padding = '10px';
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.gap = '10px';
        content.style.overflowY = 'auto';
        content.style.flexGrow = '1';

        // --- SECTION 1: Item Socketing ---
        const socketSection = document.createElement('div');
        socketSection.className = 'editor-section';
        
        // Hide Step 1 selector label/dropdown visual, keep it in DOM for programmatic syncing
        const step1Title = document.createElement('h4');
        step1Title.style.marginTop = '0';
        step1Title.style.color = '#ffd700';
        step1Title.textContent = 'Target Upgrade Item:';
        socketSection.appendChild(step1Title);

        const itemSelect = document.createElement('select');
        itemSelect.id = 'chaos-map-device-item-select';
        itemSelect.style.display = 'none'; // <-- HIDDEN completely as we perform selection in inventory
        socketSection.appendChild(itemSelect);

        // Item Card status preview
        const itemCard = document.createElement('div');
        itemCard.id = 'chaos-map-device-item-card';
        itemCard.style.marginTop = '8px';
        itemCard.style.padding = '10px';
        itemCard.style.backgroundColor = 'rgba(20, 15, 10, 0.6)';
        itemCard.style.border = '1px dashed #ffd700';
        itemCard.style.borderRadius = '6px';
        itemCard.innerHTML = '<div style="color: #8C6D56; text-align: center; font-style: italic;">No item slotted in device.</div>';
        socketSection.appendChild(itemCard);

        content.appendChild(socketSection);

        // --- SECTION 2: Map Crafting & Modifiers ---
        const mapSection = document.createElement('div');
        mapSection.className = 'editor-section';
        mapSection.innerHTML = '<h4 style="margin-top: 0; color: #ffd700;">Configure Map Modifiers</h4>';

        // Tier selection row
        const tierRow = document.createElement('div');
        tierRow.style.display = 'flex';
        tierRow.style.gap = '4px';
        tierRow.style.marginBottom = '8px';

        const tiers = [
            { id: 'normal', name: 'Tier I (Easy)', color: '#95a5a6' },
            { id: 'magic', name: 'Tier II (Magic)', color: '#3498db' },
            { id: 'rare', name: 'Tier III (Rare)', color: '#f1c40f' },
            { id: 'legendary', name: 'Tier IV (Boss)', color: '#e74c3c' }
        ];

        tiers.forEach(tier => {
            const btn = document.createElement('button');
            btn.textContent = tier.name;
            btn.id = `chaos-tier-btn-${tier.id}`;
            btn.style.flex = '1';
            btn.style.padding = '4px 2px';
            btn.style.fontSize = '0.78em';
            btn.style.border = '1px solid #8C6D56';
            if (this.mapTier === tier.id) {
                btn.style.backgroundColor = tier.color;
                btn.style.color = 'black';
                btn.style.fontWeight = 'bold';
            } else {
                btn.style.backgroundColor = '#2C241D';
                btn.style.color = '#EFEBE0';
            }
            btn.onclick = () => this.selectTier(tier.id);
            tierRow.appendChild(btn);
        });
        mapSection.appendChild(tierRow);

        // Roll modifier actions
        const rollRow = document.createElement('div');
        rollRow.style.display = 'flex';
        rollRow.style.gap = '6px';
        rollRow.style.marginBottom = '6px';

        const btnRoll = document.createElement('button');
        btnRoll.textContent = '🎲 Roll Modifiers';
        btnRoll.style.flex = '1';
        btnRoll.style.padding = '6px';
        btnRoll.style.backgroundColor = '#9b59b6';
        btnRoll.style.color = 'white';
        btnRoll.style.fontWeight = 'bold';
        btnRoll.style.border = 'none';
        btnRoll.style.borderRadius = '4px';
        btnRoll.style.cursor = 'pointer';
        btnRoll.onclick = () => this.rollModifiers();
        rollRow.appendChild(btnRoll);

        mapSection.appendChild(rollRow);

        // Modifier output log
        const modCard = document.createElement('div');
        modCard.id = 'chaos-map-device-modifiers-list';
        modCard.style.padding = '8px';
        modCard.style.backgroundColor = 'rgba(0,0,0,0.4)';
        modCard.style.border = '1px solid #555';
        modCard.style.borderRadius = '4px';
        modCard.style.fontSize = '0.85em';
        modCard.innerHTML = '<div style="color: #aaa; text-align: center;">Craft modifiers above for additional Item XP scaling!</div>';
        mapSection.appendChild(modCard);

        content.appendChild(mapSection);

        // --- SECTION 3: Activate Portal ---
        const activateSection = document.createElement('div');
        activateSection.style.marginTop = 'auto';

        const btnActivate = document.createElement('button');
        btnActivate.id = 'chaos-map-device-activate-btn';
        btnActivate.innerHTML = '[ Deploy Item Portal! ]';
        btnActivate.style.width = '100%';
        btnActivate.style.padding = '10px';
        btnActivate.style.backgroundColor = '#e67e22';
        btnActivate.style.color = 'white';
        btnActivate.style.fontWeight = 'bold';
        btnActivate.style.fontSize = '1em';
        btnActivate.style.border = 'none';
        btnActivate.style.borderRadius = '6px';
        btnActivate.style.cursor = 'pointer';
        btnActivate.style.boxShadow = '0 0 10px rgba(230,126,34,0.6)';
        btnActivate.onclick = () => this.deployPortal();
        activateSection.appendChild(btnActivate);

        content.appendChild(activateSection);

        this.panel.appendChild(content);
        this.modalContentElement.appendChild(this.panel);

        // Sync with initial load
        this.refreshItemList();
        this.rollModifiers();
    }

    show() {
        this.isActive = true;
        if (!this.panel) this.initUI();
        this.panel.style.display = 'flex';
        this.refreshItemList();
    }

    openWithItem(item) {
        if (!item) return;
        this.isActive = true;
        if (!this.panel) this.initUI();
        
        // Remove 'collapsed' class in case it was collapsed
        this.panel.classList.remove('collapsed');
        this.panel.style.display = 'flex';
        
        // Dynamic centered modal styling for bespoke retro immersive popup look!
        this.panel.style.position = 'absolute';
        this.panel.style.left = '50%';
        this.panel.style.top = '50%';
        this.panel.style.transform = 'translate(-50%, -50%)';
        this.panel.style.right = 'auto'; // Override right orientation of sidebars
        this.panel.style.width = '380px';
        this.panel.style.height = '500px';
        this.panel.style.boxShadow = '0 0 30px rgba(230,126,34,0.45), 0 10px 40px rgba(0,0,0,0.95)';
        this.panel.style.border = '3px solid #e67e22';
        this.panel.style.borderRadius = '10px';
        this.panel.style.zIndex = '50005';
        
        // Pre-select the item
        this.selectedItemId = item.id;
        this.refreshItemList();

        // Ensure there is a stylish red close button
        let closeBtn = this.panel.querySelector('#rpg-chaos-map-device-close-btn');
        if (!closeBtn) {
            closeBtn = document.createElement('button');
            closeBtn.id = 'rpg-chaos-map-device-close-btn';
            closeBtn.textContent = '❌';
            closeBtn.style.position = 'absolute';
            closeBtn.style.top = '4px';
            closeBtn.style.right = '6px';
            closeBtn.style.background = 'transparent';
            closeBtn.style.border = 'none';
            closeBtn.style.color = '#e74c3c';
            closeBtn.style.fontSize = '1em';
            closeBtn.style.cursor = 'pointer';
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                this.hide();
            };
            this.panel.appendChild(closeBtn);
        }
    }

    hide() {
        this.isActive = false;
        if (this.panel) this.panel.style.display = 'none';
    }

    refreshItemList() {
        const itemSelect = document.getElementById('chaos-map-device-item-select');
        if (!itemSelect) return;

        itemSelect.innerHTML = '';

        const player = this.engine.player;
        if (!player || !Array.isArray(player.inventory)) {
            itemSelect.innerHTML = '<option value="">No Hero found.</option>';
            return;
        }

        // Only weapons, shields, armors, and abilities (skills) are eligible
        const eligibles = player.inventory.filter(it => 
            it && (it.type === 'weapon' || it.type === 'shield' || it.type === 'armor' || it.type === 'ability')
        );

        if (eligibles.length === 0) {
            itemSelect.innerHTML = '<option value="">No equippable gear in Backpack!</option>';
            this.selectedItemId = '';
            this.refreshItemCard(null);
            return;
        }

        eligibles.forEach(it => {
            const opt = document.createElement('option');
            opt.value = it.id;
            opt.textContent = `${it.emoji || '🎁'} ${it.name} (Lv ${it.level || 1})`;
            itemSelect.appendChild(opt);
        });

        // Set or keep selected
        if (!this.selectedItemId || !eligibles.find(it => it.id === this.selectedItemId)) {
            this.selectedItemId = eligibles[0].id;
        }
        itemSelect.value = this.selectedItemId;

        const sel = eligibles.find(it => it.id === this.selectedItemId);
        this.refreshItemCard(sel);
    }

    selectItem(itemId) {
        this.selectedItemId = itemId;
        const player = this.engine.player;
        if (!player) return;
        const item = player.inventory.find(it => it.id === itemId);
        this.refreshItemCard(item);
    }

    refreshItemCard(item) {
        const card = document.getElementById('chaos-map-device-item-card');
        if (!card) return;

        if (!item) {
            card.innerHTML = '<div style="color: #8C6D56; text-align: center; font-style: italic;">No item slotted in device.</div>';
            return;
        }

        // Level, XP calculation
        const level = item.level || 1;
        const xp = item.xp || 0;
        const nextXp = item.nextLevelXp || 100;
        const xpPct = Math.min(100, Math.floor((xp / nextXp) * 100));

        let bonusSpec = 'None';
        if (item.bonusAtk) bonusSpec = `<span style="color:#e74c3c; font-weight:bold;">⚔️ +${item.bonusAtk} Weapon ATK</span>`;
        if (item.bonusDef) bonusSpec = `<span style="color:#3498db; font-weight:bold;">🛡️ +${item.bonusDef} Shield DEF</span>`;
        if (item.heal) bonusSpec = `<span style="color:#2ecc71; font-weight:bold;">💚 +${item.heal} HP Recovery</span>`;

        card.innerHTML = `
            <div style="font-weight: bold; font-size: 1.1em; color: #ffd700; margin-bottom: 4px;">
                ${item.emoji || '🎁'} ${item.name}
            </div>
            <div style="font-size: 0.85em; color: #aaa; margin-bottom: 6px;">
                Category: <span style="text-transform: uppercase; color: #EFEBE0; font-weight: bold;">${item.type}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.85em; margin-bottom: 2px;">
                <span>Grade Level: <b>Lv ${level}</b></span>
                <span style="color: #9b59b6;">Item XP: ${xp}/${nextXp} (${xpPct}%)</span>
            </div>
            <div style="background-color: #222; height: 10px; border-radius: 5px; position: relative; margin-bottom: 8px; border: 1px solid #444; overflow: hidden;">
                <div style="background-color: #9b59b6; width: ${xpPct}%; height: 100%;"></div>
            </div>
            <div style="font-size: 0.88em; border-top: 1px solid #33); padding-top: 6px;">
                Attributes Boost: ${bonusSpec}
            </div>
        `;
    }

    selectTier(tierId) {
        this.mapTier = tierId;
        const tiers = ['normal', 'magic', 'rare', 'legendary'];
        tiers.forEach(t => {
            const btn = document.getElementById(`chaos-tier-btn-${t}`);
            if (!btn) return;

            const tColors = { normal: '#95a5a6', magic: '#3498db', rare: '#f1c40f', legendary: '#e74c3c' };
            if (t === tierId) {
                btn.style.backgroundColor = tColors[t];
                btn.style.color = 'black';
                btn.style.fontWeight = 'bold';
            } else {
                btn.style.backgroundColor = '#2C241D';
                btn.style.color = '#EFEBE0';
                btn.style.fontWeight = 'normal';
            }
        });

        this.rollModifiers();
    }

    rollModifiers() {
        // Roll random modifiers depending on tier
        let count = 0;
        let baseMult = 1.0;
        if (this.mapTier === 'normal') { count = 0; baseMult = 1.0; }
        else if (this.mapTier === 'magic') { count = 1; baseMult = 1.35; }
        else if (this.mapTier === 'rare') { count = 3; baseMult = 1.85; }
        else if (this.mapTier === 'legendary') { count = 5; baseMult = 3.0; }

        this.itemXPMultiplier = baseMult;

        // Shuffle modifiers list internally and pick
        const shuffled = [...MAP_MODIFIERS].sort(() => 0.5 - Math.random());
        this.activeModifiers = shuffled.slice(0, count);

        const listDiv = document.getElementById('chaos-map-device-modifiers-list');
        if (!listDiv) return;

        if (this.activeModifiers.length === 0) {
            listDiv.innerHTML = `
                <div style="text-align: center; color: #2ecc71; font-weight: bold; margin-bottom: 4px;">[ Normal Mode Map ]</div>
                <div style="text-align: center; font-size: 0.9em; color: #ddd;">No danger. Bonus Item XP scaling: <b>1.0x (Standard)</b></div>
            `;
            return;
        }

        let innerHTML = `<div style="font-weight: bold; color: #ffd700; margin-bottom: 6px; border-bottom: 1px solid #444; padding-bottom: 4px; display: flex; justify-content: space-between;">
            <span>⚠️ Modifiers (${this.activeModifiers.length}):</span>
            <span style="color: #9b59b6;">+${Math.floor((this.itemXPMultiplier - 1.0) * 100)}% Item XP</span>
        </div>`;

        this.activeModifiers.forEach(m => {
            innerHTML += `<div style="margin-bottom: 4px; color: #ffb6c1;">● ${m.text}</div>`;
        });

        listDiv.innerHTML = innerHTML;
    }

    async deployPortal() {
        const player = this.engine.player;
        if (!player) {
            CustomDialog.alert("Create a character first before attempting portals!", "Error");
            return;
        }

        // Check if there is a selected item
        const eligibleItems = player.inventory.filter(it => 
            it && (it.type === 'weapon' || it.type === 'shield' || it.type === 'armor' || it.type === 'ability')
        );
        if (eligibleItems.length === 0) {
            CustomDialog.alert("Please secure at least 1 weapon, shield, or ability item in your inventory to explore the Item World!", "Slotted Item Missing");
            return;
        }

        const slottedItem = player.inventory.find(it => it.id === this.selectedItemId) || eligibleItems[0];
        if (!slottedItem.level) slottedItem.level = 1;
        if (slottedItem.xp === undefined) slottedItem.xp = 0;
        if (!slottedItem.nextLevelXp) slottedItem.nextLevelXp = 100;

        // Hide editor overlay
        this.engine.editorManager?.hideAll();

        // 1. Back up player's location and base map raw state!
        if (!this.engine.savedBaseMap) {
            console.log("Saving current main map state...");
            const curMapName = this.engine.map.currentMapName || 'town_main';
            this.engine.savedBaseMap = {
                mapName: curMapName,
                data: this.engine.map.serialize(),
                playerCoords: { x: player.mapX, y: player.mapY }
            };
        }

        // 2. Synthesize a procedurally generated Isometric Map!
        console.log(`Generating procedural dungeon map for item "${slottedItem.name}"...`);
        const pSize = 40; // Dimension (40x40 is spacious and magnificent)
        const tilesGrid = [];

        // Initialize with 0s (abyss)
        for (let y = 0; y < pSize; y++) {
            const row = [];
            for (let x = 0; x < pSize; x++) {
                row.push(0);
            }
            tilesGrid.push(row);
        }

        // Define a set of "blobs" (rooms) covering the map
        const blobs = [
            { cx: 8,  cy: 8,  r: 4.5, name: 'player_hub' },       // Near top-left (Starting area)
            { cx: 32, cy: 32, r: 6.0, name: 'boss_arena' },       // Opposite corner (Boss arena)
            { cx: 32, cy: 8,  r: 4.0, name: 'treasure_cavern' },  // Top-right (Chests & loot)
            { cx: 8,  cy: 32, r: 4.0, name: 'monster_den' },      // Bottom-left (Monster nest)
            { cx: 20, cy: 20, r: 5.0, name: 'nexus_crossroad' }  // Central crossroad
        ];

        // Draw organic blobs
        blobs.forEach(blob => {
            // Draw central circle with satellite overlapping blobs to create organic shapes
            const satellites = [
                { dx: 0, dy: 0, r: blob.r }, // Central circle
                { dx: Math.floor(Math.random() * 3) - 1, dy: Math.floor(Math.random() * 3) - 1, r: blob.r * 0.8 },
                { dx: Math.floor(Math.random() * 3) - 1, dy: Math.floor(Math.random() * 3) - 1, r: blob.r * 0.7 }
            ];

            satellites.forEach(sat => {
                const centerGridX = blob.cx + sat.dx;
                const centerGridY = blob.cy + sat.dy;
                const radiusSq = sat.r * sat.r;

                for (let y = Math.floor(centerGridY - sat.r - 1); y <= Math.ceil(centerGridY + sat.r + 1); y++) {
                    for (let x = Math.floor(centerGridX - sat.r - 1); x <= Math.ceil(centerGridX + sat.r + 1); x++) {
                        if (x > 0 && x < pSize - 1 && y > 0 && y < pSize - 1) {
                            const dx = x - centerGridX;
                            const dy = y - centerGridY;
                            if (dx * dx + dy * dy <= radiusSq) {
                                // 85% chance for standard floor (1), 15% for speckled floor (2) to give nice organic variation
                                tilesGrid[y][x] = Math.random() < 0.85 ? 1 : 2;
                            }
                        }
                    }
                }
            });
        });

        // Helper function to carve a corridor between two coordinates
        const carveCorridor = (x1, y1, x2, y2) => {
            let cx = x1;
            let cy = y1;

            const carveTile = (tx, ty) => {
                // Carve a 3x3 brush around (tx, ty) to ensure columns/passageways are wide and walkable
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const nx = tx + dx;
                        const ny = ty + dy;
                        if (nx > 0 && nx < pSize - 1 && ny > 0 && ny < pSize - 1) {
                            if (tilesGrid[ny][nx] === 0) {
                                tilesGrid[ny][nx] = Math.random() < 0.85 ? 1 : 2;
                            }
                        }
                    }
                }
            };

            // Horizontal then vertical movement
            while (cx !== x2) {
                carveTile(cx, cy);
                cx += (x2 > cx) ? 1 : -1;
            }
            while (cy !== y2) {
                carveTile(cx, cy);
                cy += (y2 > cy) ? 1 : -1;
            }
            carveTile(cx, cy); // Final step
        };

        // Connect the blobs to form a guaranteed fully traversable network:
        // Connect player hub to nexus crossroad
        carveCorridor(blobs[0].cx, blobs[0].cy, blobs[4].cx, blobs[4].cy);
        // Connect boss arena to nexus crossroad
        carveCorridor(blobs[1].cx, blobs[1].cy, blobs[4].cx, blobs[4].cy);
        // Connect treasure cavern to nexus crossroad
        carveCorridor(blobs[2].cx, blobs[2].cy, blobs[4].cx, blobs[4].cy);
        // Connect monster den to nexus crossroad
        carveCorridor(blobs[3].cx, blobs[3].cy, blobs[4].cx, blobs[4].cy);

        // Build objects layer
        const objectsLayer = [];

        // Build solid tree/wall boundary sprites around all carved floor tiles!
        // To make it beautiful and "bounded" (preventing players walking into abyss, but also letting them see the edge),
        // we can place a tree at any COORDINATE (x,y) that is 0 (abyss) but ADJACENT to a walkable tile (1 or 2).
        for (let y = 0; y < pSize; y++) {
            for (let x = 0; x < pSize; x++) {
                if (tilesGrid[y][x] === 0) {
                    // Check neighbors to see if this is an edge
                    let hasWalkableNeighbor = false;
                    for (let dy = -1; dy <= 1 && !hasWalkableNeighbor; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx >= 0 && nx < pSize && ny >= 0 && ny < pSize) {
                                if (tilesGrid[ny][nx] === 1 || tilesGrid[ny][nx] === 2) {
                                    hasWalkableNeighbor = true;
                                    break;
                                }
                            }
                        }
                    }

                    if (hasWalkableNeighbor) {
                        objectsLayer.push({
                            id: `border_tree_${x}_${y}`,
                            mapX: x,
                            mapY: y,
                            assetName: 'tree',
                            collidable: true,
                            visualWidth: 64,
                            visualHeight: 64,
                            anchorOffsetX: 32,
                            anchorOffsetY: 64
                        });
                    }
                }
            }
        }

        // Scatter some optional decorative inner obstacles (trees/pillars) inside the blobs, but avoid spawns!
        for (let n = 0; n < 20; n++) {
            const rx = Math.floor(Math.random() * (pSize - 4)) + 2;
            const ry = Math.floor(Math.random() * (pSize - 4)) + 2;

            // Make sure it is a walkable tile and NOT too close to any blob center point (safety margin for spawns)
            if (tilesGrid[ry][rx] === 1 || tilesGrid[ry][rx] === 2) {
                let tooClose = false;
                blobs.forEach(b => {
                    const dx = rx - b.cx;
                    const dy = ry - b.cy;
                    if (dx * dx + dy * dy < 9) { // At least 3 tiles away from any center point
                        tooClose = true;
                    }
                });

                if (!tooClose) {
                    objectsLayer.push({
                        id: `interior_pillar_${n}`,
                        mapX: rx,
                        mapY: ry,
                        assetName: 'tree',
                        collidable: true,
                        visualWidth: 64,
                        visualHeight: 64,
                        anchorOffsetX: 32,
                        anchorOffsetY: 64
                    });
                }
            }
        }

        // 3. Create Spawners & Mob instances
        const spawnPoints = [];

        // Player starting point in center of 'player_hub' Blob 0
        const playerScreen = this.mapToScreenCoords(blobs[0].cx, blobs[0].cy);
        spawnPoints.push({
            id: 'player_start',
            x: playerScreen.x,
            y: playerScreen.y,
            type: 'player_entry'
        });

        // Spawn Chests in the 'treasure_cavern' Blob 2 and some random spots
        const treasureChestsCount = (this.mapTier === 'rare' || this.mapTier === 'legendary' ? 4 : 2);
        for (let chest = 0; chest < treasureChestsCount; chest++) {
            // Chest 0 is always in the center of the Treasure Cavern
            let cx = blobs[2].cx;
            let cy = blobs[2].cy;
            
            if (chest > 0) {
                // Other chests are scattered around the Treasure Cavern or the Monster Den
                const rOffset = () => Math.floor(Math.random() * 3) - 1;
                cx = blobs[2].cx + rOffset();
                cy = blobs[2].cy + rOffset();
            }

            // Ensure tile is inside map and walkable
            if (cx > 0 && cx < pSize - 1 && cy > 0 && cy < pSize - 1 && (tilesGrid[cy][cx] === 1 || tilesGrid[cy][cx] === 2)) {
                const screen = this.mapToScreenCoords(cx, cy);
                spawnPoints.push({
                    id: `chest_${chest}`,
                    x: screen.x,
                    y: screen.y,
                    type: 'chest_gold_spawner',
                    enemyId: null
                });
            }
        }

        // Spawn slimes - distributed across the monster den, nexus crossroad, and boss arena
        const mobCount = Math.floor(12 + slottedItem.level * 1.5 + (this.mapTier === 'rare' ? 6 : (this.mapTier === 'legendary' ? 14 : 0)));
        const spawnAreas = [blobs[3], blobs[4], blobs[1]]; // Monster den, Nexus, and Boss arena

        for (let mob = 0; mob < mobCount; mob++) {
            const area = spawnAreas[mob % spawnAreas.length];
            // Random offset within the area's radius
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * (area.r - 1.5);
            const ex = Math.floor(area.cx + Math.cos(angle) * dist);
            const ey = Math.floor(area.cy + Math.sin(angle) * dist);

            // Verify tile is walkable and not blocking the center of the player hub
            const isNearPlayerStart = (Math.abs(ex - blobs[0].cx) < 3 && Math.abs(ey - blobs[0].cy) < 3);

            if (ex > 0 && ex < pSize - 1 && ey > 0 && ey < pSize - 1 && !isNearPlayerStart && (tilesGrid[ey][ex] === 1 || tilesGrid[ey][ex] === 2)) {
                const screen = this.mapToScreenCoords(ex, ey);
                spawnPoints.push({
                    id: `mob_slime_${mob}`,
                    x: screen.x,
                    y: screen.y,
                    type: 'enemy',
                    enemyId: Math.random() < 0.6 ? 'slime_green' : (Math.random() < 0.75 ? 'slime_blue' : 'slime_red')
                });
            }
        }

        // Spawn ONE giant boss: "Item World Warden" in the center of the boss arena!
        const bossScreen = this.mapToScreenCoords(blobs[1].cx, blobs[1].cy);
        spawnPoints.push({
            id: `item_warden_boss`,
            x: bossScreen.x,
            y: bossScreen.y,
            type: 'enemy',
            enemyId: 'slime_red'
        });

        // Assemble serialized map schema
        const proceduralMapSchema = {
            width: pSize,
            height: pSize,
            mapName: `ItemWorld_${slottedItem.id}`,
            tiles: tilesGrid,
            tileDefinitions: {
                "1": { sourceRect: { x: 0, y: 330, width: 64, height: 64 }, spritesheetIndex: 0, zIndex: 0 },
                "2": { sourceRect: { x: 66, y: 330, width: 64, height: 64 }, spritesheetIndex: 0, zIndex: 0 }
            },
            nextTileId: 3,
            objectLayersData: {
                "object1": objectsLayer,
                "object2": []
            },
            spawnPointsData: spawnPoints,
            lightingData: { masks: [] }
        };

        // Populate active Item World state inside the engine
        this.engine.activeItemWorld = {
            slottedItem: slottedItem,
            mapTier: this.mapTier,
            activeModifiers: this.activeModifiers,
            itemXPMultiplier: this.itemXPMultiplier,
            enemiesTotal: mobCount + 1, // Including Warden Boss
            enemiesKilled: 0,
            hasDefeatedBoss: false,
            chestsLooted: 0,
            originalHp: player.stats.hp
        };

        // Load the procedural map
        const loadResult = await this.engine.loadMap(proceduralMapSchema, 'player_entry');
        if (loadResult) {
            this.hide(); // Hide the Chaos Map Device window menu as we spawn into the map!

            // Apply modifiers and scale enemy/boss stats inside the newborn map!
            // Helper to simulate player stats at a given level
            const getSimulatedPlayerStats = (lvl) => {
                let hp = 100;
                let atk = 10;
                let def = 5;
                for (let i = 1; i < lvl; i++) {
                    hp = Math.floor(hp * 1.15) + 15;
                    atk = Math.floor(atk * 1.12) + 2;
                    def = Math.floor(def * 1.10) + 1;
                }
                return { hp, atk, def };
            };

            this.engine.gameObjects.forEach(obj => {
                if (obj.constructor.name === 'Enemy' || obj.type === 'enemy') {
                    // Enemy level is equal to item level
                    obj.stats.level = slottedItem.level;

                    const simulated = getSimulatedPlayerStats(slottedItem.level);

                    let hpMult = 1.0;
                    let atkMult = 1.0;
                    let defMult = 1.0;
                    
                    // Add tier multiplier
                    if (this.mapTier === 'magic') { hpMult += 0.2; atkMult += 0.15; }
                    else if (this.mapTier === 'rare') { hpMult += 0.5; atkMult += 0.4; }
                    else if (this.mapTier === 'legendary') { hpMult += 1.0; atkMult += 0.8; }
                    
                    // Add active modifier multipliers
                    if (Array.isArray(this.activeModifiers)) {
                        this.activeModifiers.forEach(mod => {
                            const txt = mod.text.toLowerCase();
                            if (txt.includes('health') || txt.includes('hp')) {
                                hpMult += 0.4;
                            }
                            if (txt.includes('damage') || txt.includes('atk') || txt.includes('deal')) {
                                atkMult += 0.3;
                            }
                            if (txt.includes('speed')) {
                                obj.stats.speed = (obj.stats.speed || 80) * 1.25;
                            }
                        });
                    }

                    obj.stats.maxHp = Math.floor(simulated.hp * hpMult);
                    obj.stats.hp = obj.stats.maxHp;
                    obj.stats.atk = Math.floor(simulated.atk * atkMult);
                    obj.stats.def = Math.floor(simulated.def * defMult);

                    // If it is the warden boss
                    if (obj.id.includes('warden')) {
                        obj.name = `👹 Item Warden: ${slottedItem.name}`;
                        obj.stats.maxHp = Math.floor(obj.stats.maxHp * 3.5);
                        obj.stats.hp = obj.stats.maxHp;
                        obj.stats.atk = Math.floor(obj.stats.atk * 1.5);
                        obj.stats.def = Math.floor(obj.stats.def * 2.0);
                        obj.visualHeight = 64; // Scale size
                        obj.visualWidth = 64;
                    }
                }
            });

            this.showHUDWidget();
            // No entry alert notification to avoid aggressive slimes attacking while dialog blocker exists.
        } else {
            CustomDialog.alert("Failed to stabilize portal space.", "Error");
        }
    }

    mapToScreenCoords(mapX, mapY) {
        // Tile dimensions
        const halfTileWidth = 32;
        const halfTileHeight = 16;
        const screenX = (mapX - mapY) * halfTileWidth;
        const screenY = (mapX + mapY) * halfTileHeight;
        return { x: screenX, y: screenY };
    }

    showHUDWidget() {
        // Remove existing widget if any
        let widget = document.getElementById('chaos-item-world-hud');
        if (widget) widget.remove();

        const state = this.engine.activeItemWorld;
        if (!state) return;

        widget = document.createElement('div');
        widget.id = 'chaos-item-world-hud';
        widget.style.position = 'absolute';
        widget.style.top = '10px';
        widget.style.left = '50%';
        widget.style.transform = 'translateX(-50%)';
        widget.style.backgroundColor = 'rgba(18, 14, 13, 0.96)';
        widget.style.border = '1.5px solid #e67e22';
        widget.style.borderRadius = '6px';
        widget.style.color = '#EFEBE0';
        widget.style.zIndex = '50000';
        widget.style.width = '280px';
        widget.style.display = 'flex';
        widget.style.flexDirection = 'column';
        widget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.85)';
        widget.style.fontFamily = 'monospace';
        widget.style.fontSize = '0.85em';
        widget.style.userSelect = 'none';

        // COMPACT ROW (Always visible)
        const compactRow = document.createElement('div');
        compactRow.id = 'chaos-hud-compact-row';
        compactRow.style.display = 'flex';
        compactRow.style.justifyContent = 'space-between';
        compactRow.style.alignItems = 'center';
        compactRow.style.padding = '6px 10px';
        compactRow.style.cursor = 'pointer';

        const clearPct = Math.min(100, Math.floor((state.enemiesKilled / state.enemiesTotal) * 100));
        
        const titleSpan = document.createElement('span');
        titleSpan.innerHTML = `🌀 Clear: <b id="item-world-progress-text" style="color:#2ecc71;">${state.enemiesKilled}/${state.enemiesTotal} (${clearPct}%)</b>`;
        compactRow.appendChild(titleSpan);

        const expandBtn = document.createElement('button');
        expandBtn.id = 'chaos-hud-expand-btn';
        expandBtn.textContent = '▾ Show Info';
        expandBtn.style.background = '#2B231D';
        expandBtn.style.color = '#e67e22';
        expandBtn.style.border = '1px solid #5A4B3E';
        expandBtn.style.borderRadius = '3px';
        expandBtn.style.padding = '2px 6px';
        expandBtn.style.fontSize = '0.82em';
        expandBtn.style.cursor = 'pointer';
        expandBtn.style.fontFamily = 'monospace';
        compactRow.appendChild(expandBtn);

        widget.appendChild(compactRow);

        // Thin progress bar (Subtle and always at the bottom edge)
        const progressContainer = document.createElement('div');
        progressContainer.style.backgroundColor = '#111';
        progressContainer.style.height = '4px';
        progressContainer.style.overflow = 'hidden';
        progressContainer.style.position = 'relative';

        const bar = document.createElement('div');
        bar.id = 'item-world-progress-bar';
        bar.style.backgroundColor = '#2ecc71';
        bar.style.width = `${clearPct}%`;
        bar.style.height = '100%';
        progressContainer.appendChild(bar);
        widget.appendChild(progressContainer);

        // EXPANDED DRAWER (Collapsed by default)
        const expandedDrawer = document.createElement('div');
        expandedDrawer.id = 'chaos-hud-expanded-drawer';
        expandedDrawer.style.display = 'none';
        expandedDrawer.style.padding = '8px 10px';
        expandedDrawer.style.borderTop = '1px dashed #5A4B3E';
        expandedDrawer.style.backgroundColor = 'rgba(0,0,0,0.3)';

        // Detailed Content
        const detailedContent = document.createElement('div');
        detailedContent.style.lineHeight = '1.4em';
        detailedContent.style.marginBottom = '6px';
        detailedContent.style.fontSize = '0.88em';
        detailedContent.innerHTML = `
            <div style="font-weight: bold; color: #ffd700; margin-bottom: 2px;">Item: ${state.slottedItem.emoji || '⚔️'} ${state.slottedItem.name}</div>
            <div style="color: #aaa;">Grade Level: <span style="color:#EFEBE0;">Lv ${state.slottedItem.level || 1}</span></div>
            <div style="color: #aaa;">Map Tier: <span style="color:#e67e22; font-weight:bold;">${state.mapTier.toUpperCase()}</span></div>
            <div style="color: #9b59b6; font-size: 0.9em; margin-top: 4px;">XP Scale: +${Math.floor((state.itemXPMultiplier - 1.0) * 100)}%</div>
        `;
        expandedDrawer.appendChild(detailedContent);

        // Standard actions inside drawer
        const actionsRow = document.createElement('div');
        actionsRow.style.display = 'flex';
        actionsRow.style.gap = '6px';
        actionsRow.style.marginTop = '8px';

        const btnExit = document.createElement('button');
        btnExit.textContent = '🚪 Return Home';
        btnExit.style.flex = '1';
        btnExit.style.padding = '4px';
        btnExit.style.backgroundColor = '#c0392b';
        btnExit.style.color = 'white';
        btnExit.style.border = 'none';
        btnExit.style.fontSize = '0.85em';
        btnExit.style.borderRadius = '3px';
        btnExit.style.cursor = 'pointer';
        btnExit.onclick = () => this.retreatFromItemWorld(false);
        actionsRow.appendChild(btnExit);

        const btnCheatWin = document.createElement('button');
        btnCheatWin.textContent = '🏆 Instaclear';
        btnCheatWin.style.flex = '1';
        btnCheatWin.style.padding = '4px';
        btnCheatWin.style.backgroundColor = '#f39c12';
        btnCheatWin.style.color = 'black';
        btnCheatWin.style.border = 'none';
        btnCheatWin.style.fontSize = '0.85em';
        btnCheatWin.style.borderRadius = '3px';
        btnCheatWin.style.fontWeight = 'bold';
        btnCheatWin.style.cursor = 'pointer';
        btnCheatWin.onclick = () => {
            this.onItemWorldCleared();
        };
        actionsRow.appendChild(btnCheatWin);

        expandedDrawer.appendChild(actionsRow);
        widget.appendChild(expandedDrawer);

        // Toggle state event listener on compactRow click or expandBtn click
        const toggleDrawer = (e) => {
            // Prevent toggling if user clicked buttons inside
            if (e.target.tagName === 'BUTTON' && e.target !== expandBtn) return;
            
            const isShown = expandedDrawer.style.display === 'block';
            expandedDrawer.style.display = isShown ? 'none' : 'block';
            expandBtn.textContent = isShown ? '▾ Show Info' : '▴ Hide Info';
        };

        compactRow.onclick = toggleDrawer;

        const gameContainer = document.getElementById('rpg-canvas-container') || document.body;
        gameContainer.appendChild(widget);
    }

    updateHUDStatus() {
        const state = this.engine.activeItemWorld;
        if (!state) return;

        const widget = document.getElementById('chaos-item-world-hud');
        if (!widget) return;

        const bar = document.getElementById('item-world-progress-bar');
        const clearPct = Math.min(100, Math.floor((state.enemiesKilled / state.enemiesTotal) * 100));
        
        if (bar) bar.style.width = `${clearPct}%`;

        // Update clear texts
        const progressText = document.getElementById('item-world-progress-text');
        if (progressText) {
            progressText.textContent = `${state.enemiesKilled}/${state.enemiesTotal} (${clearPct}%)`;
        }
    }

    async retreatFromItemWorld(claimedBonus = false) {
        const state = this.engine.activeItemWorld;
        if (!state) return;

        if (claimedBonus && !state.isFinishedAndCleared) {
            // Give enormous reward payout to slotted item and characters!
            const itemXPEarned = Math.floor((Math.random() * 80 + 120) * state.itemXPMultiplier);
            const playerXPEarned = Math.floor((Math.random() * 50 + 80) * state.itemXPMultiplier);
            const goldEarned = Math.floor((Math.random() * 100 + 150) * state.itemXPMultiplier);

            // Award player
            const player = this.engine.player;
            if (player) {
                player.gold = (player.gold || 0) + goldEarned;
                if (typeof player.gainExp === 'function') player.gainExp(playerXPEarned);
                if (typeof player.gainItemExp === 'function') player.gainItemExp(state.slottedItem, itemXPEarned);
            }

            CustomDialog.alert(`🌟 Dimensional Victory! 🌟\n\n- Completed Item Map: ${state.slottedItem.name}\n- Recaptured ${itemXPEarned} Item XP!\n- Earned ${playerXPEarned} Character XP!\n- Found 💰 ${goldEarned} Gold!`, `Realm Complete`);
        } else {
            console.log("Exited item world dim without clearing.");
        }

        // Wipe HUD widget
        const widget = document.getElementById('chaos-item-world-hud');
        if (widget) widget.remove();

        // Nullify state
        this.engine.activeItemWorld = null;

        // Restore main base map
        if (this.engine.savedBaseMap) {
            console.log("Restoring previous base map...");
            const restore = this.engine.savedBaseMap;
            const success = await this.engine.loadMap(restore.data);
            if (success && this.engine.player) {
                this.engine.player.mapX = restore.playerCoords.x;
                this.engine.player.mapY = restore.playerCoords.y;
                const screen = this.engine.map.mapToScreen(restore.playerCoords.x, restore.playerCoords.y);
                this.engine.player.currentPixelX = screen.x;
                this.engine.player.currentPixelY = screen.y;
                this.engine.player.targetPixelX = screen.x;
                this.engine.player.targetPixelY = screen.y;
            }
            this.engine.savedBaseMap = null;
        } else {
            // Load starting map automatically
            const defaultName = "2_2_map_1779884179412";
            const mapData = await this.engine.loadMapByName(defaultName);
            if (mapData) {
                await this.engine.loadMap(mapData, 'player_entry');
            }
        }
    }

    onItemWorldCleared() {
        const state = this.engine.activeItemWorld;
        if (!state || state.isFinishedAndCleared) return;

        state.isFinishedAndCleared = true;
        state.hasDefeatedBoss = true;

        // Reward player huge payout once
        const itemXPEarned = Math.floor((Math.random() * 80 + 120) * state.itemXPMultiplier);
        const playerXPEarned = Math.floor((Math.random() * 50 + 80) * state.itemXPMultiplier);
        const goldEarned = Math.floor((Math.random() * 100 + 150) * state.itemXPMultiplier);

        const player = this.engine.player;
        if (player) {
            player.gold = (player.gold || 0) + goldEarned;
            if (typeof player.gainExp === 'function') player.gainExp(playerXPEarned);
            if (typeof player.gainItemExp === 'function') player.gainItemExp(state.slottedItem, itemXPEarned);
        }

        // Show a glorious top announcement
        this.engine.showTopBannerAnnouncement("🏆 Realm Conquered! Merchant Spawned! 🏆", "victory");

        // Show a custom dialog or alert once so user knows
        CustomDialog.alert(`🌟 Dimensional Victory! 🌟\n\n- Completed Item Map: ${state.slottedItem.name}\n- Earned ${itemXPEarned} Item XP!\n- Earned ${playerXPEarned} Character XP!\n- Found 💰 ${goldEarned} Gold!\n\nExplorer, you are free to explore. Speak to the newly arrived Portal Merchant or press "Return Home" in the HUD to head back!`, `Realm Complete`);

        // Spawn Portal Merchant near player coordinates
        const playerMapX = player ? player.mapX : 9;
        const playerMapY = player ? player.mapY : 9;

        // Find a nearby tile that is free
        let spawnX = Math.floor(playerMapX) + 1;
        let spawnY = Math.floor(playerMapY);
        // boundary checks
        if (spawnX >= 16) {
            spawnX = Math.floor(playerMapX) - 1;
        }

        this.spawnFriendlyPortalMerchant(spawnX, spawnY);

        // Update HUD display
        this.updateHUDStatus();
    }

    spawnFriendlyPortalMerchant(mapX, mapY) {
        // Build characterData for friendly Portal Merchant
        const traderData = {
            name: "Portal Merchant",
            broadType: "merchant",
            description: "A friendly interdimensional trader who sells rare goods.",
            personality: "Kind, mysterious and helpful traveler.",
            first_mes: "Aha! Incredible job conquering this item dimension! I have brought some exotic items for you to browse before you return to town.",
            mes_example: "",
            scenario: "Serves as a trade merchant inside solved portal dimensions, and helps players exit.",
            map_sprite: { type: "spritesheet", source: 4 }, // Frame 4 in spritesheet (nice visual)
            stats: { level: 10, hp: 9999, maxHp: 9999, atk: 999, def: 999 },
            inventory: [
                { id: "itm_portal_elixir_1", name: "Dimensional Elixir", type: "consumable", heal: 80, cost: 35, value: 15, description: "Restores 80 HP instantly.", count: 2 },
                { id: "itm_cosmos_ward_1", name: "Astral Ward", type: "shield", bonusDef: 15, cost: 180, value: 80, description: "An ancient shield forged from cosmic essence. +15 DEF.", count: 1 },
                { id: "itm_cosmos_blade_1", name: "Cosmos Blade", type: "weapon", bonusAtk: 22, cost: 200, value: 90, description: "A blade radiating with portal energies. +22 ATK.", count: 1 }
            ]
        };

        const npcOptions = {
            id: 'npc_portal_merchant_cleared',
            name: "Portal Merchant",
            assetName: 'npcSpritesheet',
            spriteSourceRect: { x: 4 * 64, y: 0, width: 64, height: 64 } // Frame 4 in spritesheet (nice wizard/merchant visual)
        };

        const npc = new NPC(this.engine, this.engine.map, mapX, mapY, npcOptions);
        npc.loadCharacterData(traderData);
        this.engine.gameObjects.push(npc);
    }
}
