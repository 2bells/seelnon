// JRPG Global Item Library & Bulk Vault Manager
console.log("rpg/game/editor/bank_editor.js loaded");

import CustomDialog from '../ui/custom_dialog.js';
import { getAllCustomItems, saveCustomItem, deleteCustomItem } from './item_editor.js';

const STANDARD_ITEMS = [
    {
        id: "std_red_potion",
        name: "Red Potion",
        type: "consumable",
        emoji: "❤️",
        heal: 40,
        cost: 20,
        value: 14,
        description: "Restores 40 Health Points.",
        count: 1
    },
    {
        id: "std_gold_elixir",
        name: "Gold Elixir",
        type: "consumable",
        emoji: "🍵",
        heal: 100,
        cost: 60,
        value: 42,
        description: "A golden elixir that fully restores health and vitality.",
        count: 1
    },
    {
        id: "std_green_herb",
        name: "Green Herb",
        type: "consumable",
        emoji: "🌿",
        heal: 15,
        cost: 8,
        value: 5,
        description: "Restores 15 Health Points.",
        count: 1
    },
    {
        id: "std_iron_sword",
        name: "Iron Sword",
        type: "weapon",
        emoji: "🗡️",
        bonusAtk: 5,
        cost: 120,
        value: 84,
        description: "+5 Weapon attack power.",
        count: 1
    },
    {
        id: "std_steel_shield",
        name: "Steel Shield",
        type: "shield",
        emoji: "🛡️",
        bonusDef: 4,
        cost: 100,
        value: 70,
        description: "+4 Defense combat gear.",
        count: 1
    },
    {
        id: "std_lucky_ring",
        name: "Lucky Charm Ring",
        type: "passive",
        emoji: "💍",
        passiveAtk: 2,
        passiveDef: 2,
        passiveHp: 20,
        cost: 300,
        value: 150,
        description: "Grants +2 ATK, +2 DEF, and +20 HP passively while resting in inventory.",
        count: 1
    }
];

export function resolveItemEmoji(item) {
    if (!item) return '🎁';
    if (item.emoji) return item.emoji;
    
    const name = item.name.toLowerCase();
    
    if (item.type === 'weapon' || name.includes('sword') || name.includes('blade') || name.includes('saber') || name.includes('dagger') || name.includes('edge')) {
        if (name.includes('axe')) return '🪓';
        if (name.includes('bow')) return '🏹';
        if (name.includes('wand') || name.includes('staff')) return '🔮';
        return '🗡️';
    }
    
    if (item.type === 'shield' || name.includes('shield')) return '🛡️';
    
    if (item.type === 'armor' || name.includes('armor') || name.includes('breastplate') || name.includes('plate') || name.includes('robe') || name.includes('mail')) return '👕';
    
    if (name.includes('ring')) return '💍';
    if (name.includes('charm') || name.includes('amulet') || name.includes('pendant')) return '💍';
    
    if (item.type === 'consumable' || name.includes('potion') || name.includes('elixir') || name.includes('herb') || name.includes('leaf') || name.includes('food') || name.includes('apple')) {
        if (name.includes('potion')) return '❤️';
        if (name.includes('herb') || name.includes('leaf')) return '🌿';
        if (name.includes('elixir')) return '🍵';
        return '🍎';
    }
    
    if (name.includes('tome') || name.includes('rune') || name.includes('book') || name.includes('scroll')) {
        if (name.includes('leap') || name.includes('frog') || name.includes('bounce')) return '🐸';
        if (name.includes('strike') || name.includes('sword') || name.includes('dash')) return '⚔️';
        if (name.includes('siphon') || name.includes('blood') || name.includes('drain')) return '❤️';
        if (name.includes('wall') || name.includes('earth') || name.includes('mountain') || name.includes('stone')) return '⛰️';
        return '📜';
    }
    
    if (item.type === 'event' || name.includes('key') || name.includes('gate') || name.includes('lock')) {
        return '🔑';
    }
    
    if (item.type === 'material') return '📦';
    
    return '🎁';
}

export function getMapItems(engine) {
    const items = [];
    if (engine.player && Array.isArray(engine.player.inventory)) {
        engine.player.inventory.forEach(it => {
            if (it && it.name) items.push(it);
        });
    }
    engine.gameObjects.forEach(obj => {
        if (obj && (obj.constructor.name === 'Npc' || obj.constructor.name === 'NPC' || obj.type === 'npc_permanent') && Array.isArray(obj.inventory)) {
            obj.inventory.forEach(it => {
                if (it && it.name) items.push(it);
            });
        }
    });
    return items;
}

export function getGlobalItemDatabase(engine) {
    const custom = getAllCustomItems();
    const mapItems = getMapItems(engine);
    const db = {};

    // 1. Load starting presets
    STANDARD_ITEMS.forEach(it => {
        db[it.id] = { ...it };
    });

    // 2. Discover map items
    mapItems.forEach(it => {
        const cleanName = it.name.trim().toLowerCase().replace(/\s+/g, '_');
        const key = it.id || `map_${cleanName}`;
        if (!db[key]) {
            // Find a standard template with the same name to copy nice attributes
            const matchingStd = STANDARD_ITEMS.find(std => std.name.toLowerCase() === it.name.toLowerCase());
            
            // Hardcoded special fallbacks for starting items or merchant/special items
            let fallbackCost = it.cost || 20;
            let fallbackValue = it.value || 14;
            let fallbackEmoji = it.emoji || '🎁';
            let fallbackType = it.type || 'material';

            if (matchingStd) {
                fallbackCost = matchingStd.cost;
                fallbackValue = matchingStd.value;
                fallbackEmoji = matchingStd.emoji;
                fallbackType = matchingStd.type;
            } else {
                // Parse properties for specialized items
                const nameLower = it.name.toLowerCase();
                if (nameLower.includes('infinity edge')) {
                    fallbackCost = 400;
                    fallbackValue = 280;
                    fallbackEmoji = '🗡️';
                    fallbackType = 'weapon';
                } else if (nameLower.includes("warmog's armor")) {
                    fallbackCost = 350;
                    fallbackValue = 245;
                    fallbackEmoji = '👕';
                    fallbackType = 'shield';
                } else if (nameLower.includes('slime leap') || nameLower.includes('tome of slime')) {
                    fallbackCost = 50;
                    fallbackValue = 25;
                    fallbackEmoji = '🐸';
                    fallbackType = 'ability';
                } else if (nameLower.includes('dash strike') || nameLower.includes('ring of dash')) {
                    fallbackCost = 50;
                    fallbackValue = 25;
                    fallbackEmoji = '⚔️';
                    fallbackType = 'ability';
                } else if (nameLower.includes('blood siphon') || nameLower.includes('amulet of blood')) {
                    fallbackCost = 50;
                    fallbackValue = 25;
                    fallbackEmoji = '❤️';
                    fallbackType = 'ability';
                } else if (nameLower.includes('earth wall') || nameLower.includes('rune of earth')) {
                    fallbackCost = 50;
                    fallbackValue = 25;
                    fallbackEmoji = '⛰️';
                    fallbackType = 'ability';
                } else {
                    fallbackEmoji = resolveItemEmoji(it);
                }
            }

            db[key] = {
                id: key,
                name: it.name,
                type: it.type || fallbackType,
                emoji: it.emoji || fallbackEmoji,
                description: it.description || '',
                cost: it.cost || fallbackCost,
                value: it.value || fallbackValue,
                bonusAtk: it.bonusAtk || 0,
                bonusDef: it.bonusDef || 0,
                passiveAtk: it.passiveAtk || 0,
                passiveDef: it.passiveDef || 0,
                passiveHp: it.passiveHp || 0,
                heal: it.heal || 0,
                curseHp: it.curseHp || 0,
                attachedAbility: it.attachedAbility || null
            };
        }
    });

    // 3. Load custom blueprints
    Object.keys(custom).forEach(id => {
        const it = custom[id];
        db[id] = { ...it, id };
    });

    return db;
}

class BankEditor {
    constructor(engine, modalContentElement) {
        this.engine = engine;
        this.modalContentElement = modalContentElement;
        this.isActive = false;
        this.panel = null;
        this.selectedItemId = 'std_red_potion';
        this.checkedItemIds = new Set();
    }

    initUI() {
        if (this.panel) return;

        this.panel = document.createElement('div');
        this.panel.id = 'rpg-bank-editor-panel';
        this.panel.style.display = 'none';

        // Floating Header Tool Title
        const headerBtn = document.createElement('button');
        headerBtn.id = 'rpg-bank-editor-toggle';
        headerBtn.textContent = '🏦 Global Item Library Database & Vault';
        headerBtn.onclick = () => this.panel.classList.toggle('collapsed');
        this.panel.appendChild(headerBtn);

        const content = document.createElement('div');
        content.id = 'rpg-bank-editor-content';

        // Split columns layout inside editor (Spacious design!)
        const splitLayout = document.createElement('div');
        splitLayout.id = 'rpg-bank-cols';
        splitLayout.style.display = 'grid';
        splitLayout.style.gridTemplateColumns = '1.6fr 1fr';
        splitLayout.style.gap = '10px';
        splitLayout.style.height = '100%';
        splitLayout.style.boxSizing = 'border-box';

        // --- LEFT PANEL: Large Interactive Grid & Bulk buttons ---
        const leftBox = document.createElement('div');
        leftBox.style.display = 'flex';
        leftBox.style.flexDirection = 'column';
        leftBox.style.gap = '8px';

        const gridTitle = document.createElement('div');
        gridTitle.style.fontSize = '0.9em';
        gridTitle.style.fontWeight = 'bold';
        gridTitle.style.color = '#D4C8A0';
        gridTitle.textContent = '📦 Global Blueprints Grid Database';
        leftBox.appendChild(gridTitle);

        // Grid Container
        const gridContainer = document.createElement('div');
        gridContainer.id = 'rpg-bank-grid-scroller';
        gridContainer.className = 'inventory-grid-container';
        gridContainer.style.gridTemplateColumns = 'repeat(7, 1fr)';
        gridContainer.style.gap = '5px';
        gridContainer.style.padding = '6px';
        gridContainer.style.maxHeight = '390px';
        gridContainer.style.overflowY = 'auto';
        leftBox.appendChild(gridContainer);
        this.gridContainer = gridContainer;

        // Selection Ops row
        const selectOps = document.createElement('div');
        selectOps.style.display = 'flex';
        selectOps.style.justifyContent = 'space-between';
        selectOps.style.alignItems = 'center';
        selectOps.style.marginTop = '4px';

        const labelPrompt = document.createElement('span');
        labelPrompt.style.fontSize = '0.72em';
        labelPrompt.style.color = '#A09580';
        labelPrompt.textContent = 'Toggle check marks for bulk ops:';
        selectOps.appendChild(labelPrompt);

        const btnToggleAll = document.createElement('button');
        btnToggleAll.textContent = 'Toggle All';
        btnToggleAll.className = 'item-btn-action';
        btnToggleAll.style.fontSize = '0.75em';
        btnToggleAll.style.padding = '2px 6px';
        btnToggleAll.onclick = () => this.toggleAllCheckboxSelections();
        selectOps.appendChild(btnToggleAll);
        leftBox.appendChild(selectOps);

        // Action Buttons Row 1: IO JSON Files
        const row1 = document.createElement('div');
        row1.style.display = 'flex';
        row1.style.gap = '5px';

        const btnExport = document.createElement('button');
        btnExport.textContent = '📤 Export (.json)';
        btnExport.className = 'item-btn-action';
        btnExport.style.flex = '1';
        btnExport.style.backgroundColor = '#2980b9';
        btnExport.style.color = 'white';
        btnExport.onclick = () => this.exportCheckedItems();
        row1.appendChild(btnExport);

        const fileInputId = 'rpg-bank-bulk-file-upload';
        const fileInput = document.createElement('input');
        fileInput.id = fileInputId;
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        fileInput.onchange = (e) => this.importBulkBlueprints(e);
        row1.appendChild(fileInput);

        const btnImport = document.createElement('label');
        btnImport.htmlFor = fileInputId;
        btnImport.textContent = '📥 Import Bulk';
        btnImport.className = 'item-btn-action rpg-file-label';
        btnImport.style.flex = '1';
        btnImport.style.display = 'inline-block';
        btnImport.style.textAlign = 'center';
        btnImport.style.cursor = 'pointer';
        btnImport.style.backgroundColor = '#8c765c';
        btnImport.style.color = 'white';
        row1.appendChild(btnImport);
        leftBox.appendChild(row1);

        // Action Buttons Row 2: Bulk Deliveries
        const row2 = document.createElement('div');
        row2.style.display = 'flex';
        row2.style.gap = '5px';

        const btnSpawnSelectedBag = document.createElement('button');
        btnSpawnSelectedBag.textContent = '🎒 Bag Checked';
        btnSpawnSelectedBag.className = 'item-btn-action';
        btnSpawnSelectedBag.style.flex = '1';
        btnSpawnSelectedBag.onclick = () => this.bulkSpawnInPlayerInventory();
        row2.appendChild(btnSpawnSelectedBag);

        const btnSpawnSelectedShop = document.createElement('button');
        btnSpawnSelectedShop.textContent = '🏪 Shop Checked';
        btnSpawnSelectedShop.className = 'item-btn-action';
        btnSpawnSelectedShop.style.flex = '1';
        btnSpawnSelectedShop.onclick = () => this.bulkAddSelectedToShopkeeper();
        row2.appendChild(btnSpawnSelectedShop);
        leftBox.appendChild(row2);

        splitLayout.appendChild(leftBox);

        // --- RIGHT PANEL: Item Inspector Card ---
        const rightBox = document.createElement('div');
        rightBox.id = 'rpg-bank-inspector-card';
        rightBox.style.display = 'flex';
        rightBox.style.flexDirection = 'column';
        rightBox.style.backgroundColor = '#251E1A';
        rightBox.style.border = '1px solid #5A4B3E';
        rightBox.style.borderRadius = '6px';
        rightBox.style.padding = '8px';
        rightBox.style.gap = '6px';
        rightBox.style.boxSizing = 'border-box';
        this.inspectorBox = rightBox;

        splitLayout.appendChild(rightBox);
        content.appendChild(splitLayout);
        this.panel.appendChild(content);

        this.modalContentElement.appendChild(this.panel);

        // Build database view
        this.renderDatabaseView();
    }

    renderDatabaseView() {
        if (!this.gridContainer) return;
        this.gridContainer.innerHTML = '';

        const db = getGlobalItemDatabase(this.engine);
        const keys = Object.keys(db);

        if (keys.length === 0) {
            const emptyLabel = document.createElement('div');
            emptyLabel.style.gridColumn = 'span 7';
            emptyLabel.style.fontSize = '0.75em';
            emptyLabel.style.color = '#A09580';
            emptyLabel.style.fontStyle = 'italic';
            emptyLabel.style.textAlign = 'center';
            emptyLabel.style.padding = '20px 0';
            emptyLabel.textContent = 'Empty database.';
            this.gridContainer.appendChild(emptyLabel);
            return;
        }

        keys.forEach(id => {
            const it = db[id];
            
            const slot = document.createElement('div');
            slot.className = 'inventory-item-slot filled';
            if (this.selectedItemId === id) slot.className += ' selected';

            // Top-left checkbox for bulk actions
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.style.position = 'absolute';
            chk.style.top = '2px';
            chk.style.left = '2px';
            chk.style.zIndex = '5';
            chk.style.cursor = 'pointer';
            chk.style.accentColor = '#FFD700';
            chk.style.width = '11px';
            chk.style.height = '11px';
            chk.checked = this.checkedItemIds.has(id);
            chk.onclick = (e) => {
                e.stopPropagation();
                if (chk.checked) {
                    this.checkedItemIds.add(id);
                } else {
                    this.checkedItemIds.delete(id);
                }
            };
            slot.appendChild(chk);

            // Icon
            const emoji = document.createElement('span');
            emoji.className = 'item-slot-emoji';
            emoji.textContent = it.emoji || '🎁';
            slot.appendChild(emoji);

            // Cost tag
            const costBadge = document.createElement('span');
            costBadge.className = 'item-slot-price-badge';
            costBadge.textContent = `${it.cost || 0}G`;
            slot.appendChild(costBadge);

            // Tooltip title
            slot.title = `${it.name}\n${it.description || ''}`;

            // Select item handler
            slot.onclick = () => {
                this.selectedItemId = id;
                this.renderDatabaseView();
                this.renderInspector();
            };

            this.gridContainer.appendChild(slot);
        });

        this.renderInspector();
    }

    renderInspector() {
        if (!this.inspectorBox) return;
        this.inspectorBox.innerHTML = '';

        const db = getGlobalItemDatabase(this.engine);
        const it = db[this.selectedItemId];

        if (!it) {
            this.inspectorBox.innerHTML = `
                <div style="font-size: 0.8em; color: #A09580; text-align: center; margin: auto; padding: 10px;">
                    Select any item blueprint in the left grid library to review statistics.
                </div>
            `;
            return;
        }

        // Title and Description
        const header = document.createElement('div');
        header.style.textAlign = 'center';
        header.style.borderBottom = '1px solid #5A4B3E';
        header.style.paddingBottom = '4px';

        const emojiDiv = document.createElement('span');
        emojiDiv.style.fontSize = '1.8em';
        emojiDiv.style.display = 'block';
        emojiDiv.textContent = it.emoji || '🎁';
        header.appendChild(emojiDiv);

        const title = document.createElement('div');
        title.style.fontSize = '0.9em';
        title.style.fontWeight = 'bold';
        title.style.color = '#FFD700';
        title.textContent = it.name;
        header.appendChild(title);

        const typeLabel = document.createElement('div');
        typeLabel.style.fontSize = '0.68em';
        typeLabel.style.textTransform = 'uppercase';
        typeLabel.style.color = '#A09580';
        typeLabel.style.marginTop = '2px';
        typeLabel.textContent = `Type: ${it.type || 'None'}`;
        header.appendChild(typeLabel);

        this.inspectorBox.appendChild(header);

        // Stats Box
        const statsScroll = document.createElement('div');
        statsScroll.style.overflowY = 'auto';
        statsScroll.style.maxHeight = '140px';
        statsScroll.style.display = 'flex';
        statsScroll.style.flexDirection = 'column';
        statsScroll.style.gap = '3px';
        statsScroll.style.fontSize = '0.75em';
        statsScroll.style.color = '#EFEBE0';

        const makeStatRow = (label, val, color = '#EFEBE0') => {
            const r = document.createElement('div');
            r.style.display = 'flex';
            r.style.justifyContent = 'space-between';
            r.style.borderBottom = '1px solid #2D231D';
            r.style.padding = '1px 0';
            r.innerHTML = `<span>${label}</span><span style="font-weight: bold; color: ${color};">${val}</span>`;
            statsScroll.appendChild(r);
        };

        makeStatRow('Library ID Slug:', it.id, '#ffffff');
        makeStatRow('Buy Cost:', `${it.cost || 0} G`, '#FFD700');
        makeStatRow('Sell Value:', `${it.value || 0} G`, '#D4C8A0');

        if (it.bonusAtk) makeStatRow('Weapon Bonus Damage:', `+${it.bonusAtk} ATK`, '#e74c3c');
        if (it.bonusDef) makeStatRow('Armor/Shield Guard:', `+${it.bonusDef} DEF`, '#3498db');
        if (it.passiveAtk) makeStatRow('Passive Charm ATK:', `+${it.passiveAtk} ATK`, '#e67e22');
        if (it.passiveDef) makeStatRow('Passive Charm DEF:', `+${it.passiveDef} DEF`, '#2ecc71');
        if (it.passiveHp) makeStatRow('Passive Charm Max HP:', `+${it.passiveHp} HP`, '#2ecc71');
        if (it.heal) makeStatRow('Consumable HP Recovery:', `+${it.heal} HP`, '#2ecc71');
        if (it.curseHp) makeStatRow('Consumable Poison Damage:', `${it.curseHp} Curse`, '#9b59b6');
        if (it.attachedAbility) makeStatRow('Spell Granted:', `🔮 ${it.attachedAbility}`, '#2980b9');

        const descDiv = document.createElement('div');
        descDiv.style.fontStyle = 'italic';
        descDiv.style.color = '#D4C8A0';
        descDiv.style.padding = '4px';
        descDiv.style.backgroundColor = '#1F1915';
        descDiv.style.borderRadius = '4px';
        descDiv.style.lineHeight = '1.3';
        descDiv.style.marginTop = '4px';
        descDiv.textContent = it.description || 'No blueprint description provided.';
        statsScroll.appendChild(descDiv);

        this.inspectorBox.appendChild(statsScroll);

        // Actions Footer inside Inspector
        const footActions = document.createElement('div');
        footActions.style.display = 'flex';
        footActions.style.flexDirection = 'column';
        footActions.style.gap = '4px';
        footActions.style.marginTop = 'auto';

        const rowSpawn = document.createElement('div');
        rowSpawn.style.display = 'flex';
        rowSpawn.style.gap = '4px';

        const btnBag = document.createElement('button');
        btnBag.className = 'item-btn-action';
        btnBag.textContent = '🎒 Bag 1x';
        btnBag.style.backgroundColor = '#27ae60';
        btnBag.style.flex = '1';
        btnBag.onclick = () => this.spawnSingleInBag(it);
        rowSpawn.appendChild(btnBag);

        const btnShop = document.createElement('button');
        btnShop.className = 'item-btn-action';
        btnShop.textContent = '🏪 Shop 5x';
        btnShop.style.backgroundColor = '#e67e22';
        btnShop.style.flex = '1';
        btnShop.onclick = () => this.stockSingleInShop(it);
        rowSpawn.appendChild(btnShop);
        footActions.appendChild(rowSpawn);

        const rowEditDel = document.createElement('div');
        rowEditDel.style.display = 'flex';
        rowEditDel.style.gap = '4px';

        // Load in creator button
        const btnEditInCreator = document.createElement('button');
        btnEditInCreator.className = 'item-btn-action';
        btnEditInCreator.textContent = '📝 Load in Creator';
        btnEditInCreator.style.backgroundColor = '#2980b9';
        btnEditInCreator.style.flex = '2';
        btnEditInCreator.title = 'Send this blueprint to the Custom Creator panel to tweak parameters';
        btnEditInCreator.onclick = () => {
            // Switch to item creator editor
            const itemEditor = this.engine.editorManager.editors.item;
            if (itemEditor) {
                // Ensure custom save file knows about items selected
                const isCustom = getAllCustomItems()[it.id] !== undefined;
                if (!isCustom) {
                    // Pre-save it to custom database if it is a standard item so it can be customized
                    saveCustomItem(it);
                }
                itemEditor.selectedItemId = it.id;
                this.engine.editorManager.toggle('item');
                itemEditor.show();
                itemEditor.loadItemIntoForm();
                itemEditor.refreshItemDropdown();
                itemEditor.refreshBankList();
                
                if (this.engine.inventoryUI) {
                    this.engine.inventoryUI.addLocalFloatText(`Loaded blueprint to custom creator!`, '#00e5ff');
                }
            }
        };
        rowEditDel.appendChild(btnEditInCreator);

        // Delete custom blueprint
        const customDb = getAllCustomItems();
        if (customDb[it.id]) {
            const btnDel = document.createElement('button');
            btnDel.className = 'item-btn-action';
            btnDel.textContent = '🗑️';
            btnDel.style.backgroundColor = '#c0392b';
            btnDel.style.flex = '0.5';
            btnDel.title = 'Delete this custom blueprint from the bank';
            btnDel.onclick = () => {
                CustomDialog.confirm(`Are you sure you want to delete custom inventory blueprint "${it.name}"?`, "Confirm Delete").then(res => {
                    if (res) {
                        deleteCustomItem(it.id);
                        this.selectedItemId = 'std_red_potion';
                        this.renderDatabaseView();
                        CustomDialog.alert("Blueprint deleted from storage.", "Deleted");
                    }
                });
            };
            rowEditDel.appendChild(btnDel);
        }

        footActions.appendChild(rowEditDel);
        this.inspectorBox.appendChild(footActions);
    }

    spawnSingleInBag(it) {
        const player = this.engine.player;
        if (!player) {
            CustomDialog.alert("Hero actor is not spawned on map yet.", "Spawn Failed");
            return;
        }

        const spawnedItem = {
            id: it.id + '_' + Date.now() + '_' + Math.floor(Math.random() * 100),
            name: it.name,
            type: it.type,
            emoji: it.emoji || '🎁',
            description: it.description || '',
            cost: it.cost || 0,
            value: it.value || 0,
            count: 1,
            bonusAtk: it.bonusAtk || 0,
            bonusDef: it.bonusDef || 0,
            passiveAtk: it.passiveAtk || 0,
            passiveDef: it.passiveDef || 0,
            passiveHp: it.passiveHp || 0,
            heal: it.heal || 0,
            curseHp: it.curseHp || 0,
            attachedAbility: it.attachedAbility || null
        };

        if (!player.inventory) player.inventory = [];
        player.inventory.push(spawnedItem);

        if (player.updateDynamicStats) player.updateDynamicStats();

        const inventoryUI = this.engine.inventoryUI;
        if (inventoryUI) {
            inventoryUI.addLocalFloatText(`Added ${spawnedItem.emoji} ${spawnedItem.name} 🎒`, '#2ecc71');
            if (inventoryUI.isOpen) inventoryUI.render();
        }

        // Show silent status banner instead of annoying Alert dialogues for single clicks!
        this.engine.showTopBannerAnnouncement(`Added ${spawnedItem.emoji} ${spawnedItem.name} to Hero bag!`, 'success');
    }

    getMapNPCs() {
        return this.engine.gameObjects.filter(obj => 
            obj && 
            (obj.constructor.name === 'NPC' || 
             obj.constructor.name === 'Npc' || 
             obj.characterData || 
             obj.type === 'npc_permanent' || 
             obj.type === 'npc' ||
             (obj.name && (obj.name.toLowerCase().includes('doran') || obj.name.toLowerCase().includes('shopkeeper'))))
        );
    }

    stockSingleInShop(it) {
        const npcs = this.getMapNPCs();
        if (npcs.length === 0) {
            CustomDialog.alert("Could not locate any active NPCs/Shopkeepers on the current map.", "Shopkeeper Not Found");
            return;
        }

        if (npcs.length === 1) {
            this.deliverItemToNpc(npcs[0], it);
        } else {
            let optionsHtml = npcs.map((npc, idx) => {
                const role = npc.broadType || (npc.characterData && npc.characterData.broadType) || 'NPC';
                return `<option value="${idx}">${npc.name} [Role: ${role}]</option>`;
            }).join('');

            const html = `
                <div class="rpg-dialog-header">
                    <span>🏪 Select NPC Merchant</span>
                </div>
                <div class="rpg-dialog-body">
                    <p style="margin-bottom:12px;">Which NPC on the map should receive 5x copies of "${it.name}"?</p>
                    <select id="rpg-dialog-npc-select" style="width:100%; background:#3B322C; color:#EFEBE0; padding:8px; border:1px solid #8C6D56; border-radius:4px; font-family:inherit;">
                        ${optionsHtml}
                    </select>
                </div>
                <div class="rpg-dialog-footer">
                    <button class="rpg-dialog-btn rpg-dialog-btn-secondary" id="rpg-dialog-cancel-btn">Cancel</button>
                    <button class="rpg-dialog-btn rpg-dialog-btn-primary" id="rpg-dialog-confirm-btn">Deliver Stock</button>
                </div>
            `;

            CustomDialog.show(html, (overlay, close) => {
                const select = overlay.querySelector('#rpg-dialog-npc-select');
                const btnConfirm = overlay.querySelector('#rpg-dialog-confirm-btn');
                const btnCancel = overlay.querySelector('#rpg-dialog-cancel-btn');

                btnConfirm.onclick = () => {
                    const selectedIdx = parseInt(select.value, 10);
                    close(npcs[selectedIdx]);
                };
                btnCancel.onclick = () => close(null);
            }).then(chosenNpc => {
                if (chosenNpc) {
                    this.deliverItemToNpc(chosenNpc, it);
                }
            });
        }
    }

    deliverItemToNpc(npcNpc, it) {
        if (!Array.isArray(npcNpc.inventory)) {
            npcNpc.inventory = [];
        }

        const existing = npcNpc.inventory.find(invIt => invIt.name === it.name);
        if (existing) {
            existing.count = (existing.count || 0) + 5;
        } else {
            npcNpc.inventory.push({
                id: it.id,
                name: it.name,
                type: it.type,
                emoji: it.emoji || '🎁',
                description: it.description || '',
                cost: it.cost || 0,
                value: it.value || 0,
                count: 5,
                bonusAtk: it.bonusAtk || 0,
                bonusDef: it.bonusDef || 0,
                passiveAtk: it.passiveAtk || 0,
                passiveDef: it.passiveDef || 0,
                passiveHp: it.passiveHp || 0,
                heal: it.heal || 0,
                curseHp: it.curseHp || 0,
                attachedAbility: it.attachedAbility || null
            });
        }

        this.engine.showTopBannerAnnouncement(`Supplied 5x copies of "${it.name}" to ${npcNpc.name}!`, 'success');
    }

    toggleAllCheckboxSelections() {
        const db = getGlobalItemDatabase(this.engine);
        const keys = Object.keys(db);
        if (keys.length === 0) return;

        // If not all are selected, select all. Else clear them.
        const allChecked = keys.every(id => this.checkedItemIds.has(id));
        if (allChecked) {
            this.checkedItemIds.clear();
        } else {
            keys.forEach(id => this.checkedItemIds.add(id));
        }

        this.renderDatabaseView();
    }

    exportCheckedItems() {
        const checkedList = Array.from(this.checkedItemIds);
        if (checkedList.length === 0) {
            CustomDialog.alert("Check mark at least one item slot in the grid above to export dynamic blueprints.", "Export Blocked");
            return;
        }

        const db = getGlobalItemDatabase(this.engine);
        const exportObj = {};
        checkedList.forEach(id => {
            if (db[id]) {
                exportObj[id] = db[id];
            }
        });

        const jsonStr = JSON.stringify(exportObj, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `item_vault_blueprints_${checkedList.length}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        CustomDialog.alert(`Successfully exported ${checkedList.length} blueprint designs!`, "Export Success");
    }

    importBulkBlueprints(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                let count = 0;

                const itemsToSave = [];
                if (Array.isArray(importedData)) {
                    importedData.forEach(it => {
                        if (it && it.name) {
                            it.id = it.id || 'imported_' + it.name.trim().toLowerCase().replace(/\s+/g, '_') + '_' + Math.floor(Math.random() * 1000);
                            itemsToSave.push(it);
                        }
                    });
                } else if (typeof importedData === 'object' && importedData !== null) {
                    Object.keys(importedData).forEach(k => {
                        const val = importedData[k];
                        if (val && typeof val === 'object') {
                            val.id = val.id || k;
                            itemsToSave.push(val);
                        }
                    });
                }

                if (itemsToSave.length === 0) {
                    CustomDialog.alert("No valid item blueprints detected in the selected JSON.", "Corrupted File");
                    return;
                }

                itemsToSave.forEach(it => {
                    saveCustomItem(it);
                    count++;
                });

                CustomDialog.alert(`Successfully loaded ${count} blueprints into the Library bank database!`, "Database Restored");
                this.renderDatabaseView();

                // Refresh creator select elements too
                const itemEditor = this.engine.editorManager.editors.item;
                if (itemEditor) {
                    itemEditor.refreshItemDropdown();
                    itemEditor.refreshBankList();
                }

            } catch (err) {
                console.error(err);
                CustomDialog.alert("File read format corrupted. Confirm standard database JSON template.", "Import Failed");
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    bulkSpawnInPlayerInventory() {
        const player = this.engine.player;
        if (!player) {
            CustomDialog.alert("Hero actor is not spawned on map yet.", "Spawn Failed");
            return;
        }

        const checkedList = Array.from(this.checkedItemIds);
        if (checkedList.length === 0) {
            CustomDialog.alert("Please check-select at least one item slot first.", "No Checked Selection");
            return;
        }

        const db = getGlobalItemDatabase(this.engine);
        let count = 0;

        checkedList.forEach(id => {
            const it = db[id];
            if (it) {
                const spawnedItem = {
                    id: it.id + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                    name: it.name,
                    type: it.type,
                    emoji: it.emoji || '🎁',
                    description: it.description || '',
                    cost: it.cost || 0,
                    value: it.value || 0,
                    count: 1,
                    bonusAtk: it.bonusAtk || 0,
                    bonusDef: it.bonusDef || 0,
                    passiveAtk: it.passiveAtk || 0,
                    passiveDef: it.passiveDef || 0,
                    passiveHp: it.passiveHp || 0,
                    heal: it.heal || 0,
                    curseHp: it.curseHp || 0,
                    attachedAbility: it.attachedAbility || null
                };
                if (!player.inventory) player.inventory = [];
                player.inventory.push(spawnedItem);
                count++;
            }
        });

        if (player.updateDynamicStats) player.updateDynamicStats();

        const inventoryUI = this.engine.inventoryUI;
        if (inventoryUI) {
            if (inventoryUI.isOpen) inventoryUI.render();
            inventoryUI.addLocalFloatText(`Added ${count} items to Bag 🎒`, '#2ecc71');
        }

        CustomDialog.alert(`Successfully spawned ${count} selected item templates into Hero bag!`, "Deliveries Succeeded");
    }

    bulkAddSelectedToShopkeeper() {
        const checkedList = Array.from(this.checkedItemIds);
        if (checkedList.length === 0) {
            CustomDialog.alert("Please check-select at least one item slot first.", "No Checked Selection");
            return;
        }

        const npcs = this.getMapNPCs();
        if (npcs.length === 0) {
            CustomDialog.alert("Could not locate any active NPCs/Shopkeepers on the current map.", "Shopkeeper Not Found");
            return;
        }

        if (npcs.length === 1) {
            this.deliverBulkToNpc(npcs[0], checkedList);
        } else {
            let optionsHtml = npcs.map((npc, idx) => {
                const role = npc.broadType || (npc.characterData && npc.characterData.broadType) || 'NPC';
                return `<option value="${idx}">${npc.name} [Role: ${role}]</option>`;
            }).join('');

            const html = `
                <div class="rpg-dialog-header">
                    <span>🏪 Select NPC Merchant</span>
                </div>
                <div class="rpg-dialog-body">
                    <p style="margin-bottom:12px;">Which NPC on the map should receive 5x copies of the checked items (${checkedList.length} total types)?</p>
                    <select id="rpg-dialog-npc-select" style="width:100%; background:#3B322C; color:#EFEBE0; padding:8px; border:1px solid #8C6D56; border-radius:4px; font-family:inherit;">
                        ${optionsHtml}
                    </select>
                </div>
                <div class="rpg-dialog-footer">
                    <button class="rpg-dialog-btn rpg-dialog-btn-secondary" id="rpg-dialog-cancel-btn">Cancel</button>
                    <button class="rpg-dialog-btn rpg-dialog-btn-primary" id="rpg-dialog-confirm-btn">Deliver Stock</button>
                </div>
            `;

            CustomDialog.show(html, (overlay, close) => {
                const select = overlay.querySelector('#rpg-dialog-npc-select');
                const btnConfirm = overlay.querySelector('#rpg-dialog-confirm-btn');
                const btnCancel = overlay.querySelector('#rpg-dialog-cancel-btn');

                btnConfirm.onclick = () => {
                    const selectedIdx = parseInt(select.value, 10);
                    close(npcs[selectedIdx]);
                };
                btnCancel.onclick = () => close(null);
            }).then(chosenNpc => {
                if (chosenNpc) {
                    this.deliverBulkToNpc(chosenNpc, checkedList);
                }
            });
        }
    }

    deliverBulkToNpc(npcNpc, checkedList) {
        if (!Array.isArray(npcNpc.inventory)) {
            npcNpc.inventory = [];
        }

        const db = getGlobalItemDatabase(this.engine);
        let count = 0;

        checkedList.forEach(id => {
            const it = db[id];
            if (it) {
                const existing = npcNpc.inventory.find(invIt => invIt.name === it.name);
                if (existing) {
                    existing.count = (existing.count || 0) + 5;
                } else {
                    npcNpc.inventory.push({
                        id: it.id,
                        name: it.name,
                        type: it.type,
                        emoji: it.emoji || '🎁',
                        description: it.description || '',
                        cost: it.cost || 0,
                        value: it.value || 0,
                        count: 5,
                        bonusAtk: it.bonusAtk || 0,
                        bonusDef: it.bonusDef || 0,
                        passiveAtk: it.passiveAtk || 0,
                        passiveDef: it.passiveDef || 0,
                        passiveHp: it.passiveHp || 0,
                        heal: it.heal || 0,
                        curseHp: it.curseHp || 0,
                        attachedAbility: it.attachedAbility || null
                    });
                }
                count++;
            }
        });

        CustomDialog.alert(`Successfully customized ${npcNpc.name}'s supply stacks! Stocked 5x copies of ${count} items.`, "Shop Stocked");
    }

    show() {
        this.initUI();
        this.panel.style.display = 'flex';
        this.isActive = true;
        this.renderDatabaseView();
    }

    hide() {
        if (this.panel) {
            this.panel.style.display = 'none';
        }
        this.isActive = false;
    }
}

export default BankEditor;
