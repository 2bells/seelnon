// JRPG Custom Item Creator & Library Manager
console.log("rpg/game/editor/item_editor.js loaded");

import CustomDialog from '../ui/custom_dialog.js';
import { getAllAbilities } from '../combat/ability_system.js';

const RPG_ITEM_STORAGE_KEY = 'rpg_custom_items';

// Global helper to get all custom items
export function getAllCustomItems() {
    let custom = {};
    try {
        const stored = localStorage.getItem(RPG_ITEM_STORAGE_KEY);
        if (stored) {
            custom = JSON.parse(stored);
        }
    } catch (e) {
        console.error("Error parsing custom items:", e);
    }
    return custom;
}

// Global helper to save custom item
export function saveCustomItem(item) {
    let custom = getAllCustomItems();
    custom[item.id] = item;
    localStorage.setItem(RPG_ITEM_STORAGE_KEY, JSON.stringify(custom));
    console.log(`Saved custom item "${item.name}" to localStorage.`);
}

// Global helper to delete custom item
export function deleteCustomItem(itemId) {
    let custom = getAllCustomItems();
    if (custom[itemId]) {
        delete custom[itemId];
        localStorage.setItem(RPG_ITEM_STORAGE_KEY, JSON.stringify(custom));
        console.log(`Deleted custom item "${itemId}" from localStorage.`);
    }
}

class ItemEditor {
    constructor(engine, modalContentElement) {
        this.engine = engine;
        this.modalContentElement = modalContentElement;
        this.isActive = false;
        this.panel = null;
        this.selectedItemId = '';
        
        // Form field references
        this.fields = {};
        
        // Bank elements
        this.bankListContainer = null;
        this.bankImportInput = null;
    }

    initUI() {
        if (this.panel) return;

        this.panel = document.createElement('div');
        this.panel.id = 'rpg-item-editor-panel';
        this.panel.style.display = 'none';

        const titleButton = document.createElement('button');
        titleButton.id = 'rpg-item-editor-toggle';
        titleButton.textContent = '💎 Custom Item Creator & Bank';
        titleButton.onclick = () => this.panel.classList.toggle('collapsed');
        this.panel.appendChild(titleButton);

        const content = document.createElement('div');
        content.id = 'rpg-item-editor-content';

        // --- SECTION 1: Selector / Quick Spawn Row ---
        const selectorSection = document.createElement('div');
        selectorSection.className = 'item-editor-section';
        selectorSection.innerHTML = '<h4>Select or Create Item Blueprint</h4>';

        const selRow = document.createElement('div');
        selRow.style.display = 'flex';
        selRow.style.gap = '6px';
        selRow.style.marginBottom = '8px';

        const itemSelect = document.createElement('select');
        itemSelect.id = 'rpg-item-editor-select';
        itemSelect.style.flex = '1';
        itemSelect.style.minWidth = '0';
        itemSelect.style.padding = '5px';
        itemSelect.style.backgroundColor = '#3B322C';
        itemSelect.style.color = '#EFEBE0';
        itemSelect.style.border = '1px solid #8C6D56';
        itemSelect.style.borderRadius = '4px';
        itemSelect.onchange = (e) => {
            this.selectedItemId = e.target.value;
            this.loadItemIntoForm();
        };
        selRow.appendChild(itemSelect);
        this.itemSelectDropdown = itemSelect;

        const btnNew = document.createElement('button');
        btnNew.textContent = '+ New Template';
        btnNew.className = 'item-btn';
        btnNew.style.backgroundColor = '#8C6D56';
        btnNew.style.color = 'white';
        btnNew.style.border = 'none';
        btnNew.style.padding = '4px 8px';
        btnNew.style.borderRadius = '4px';
        btnNew.style.cursor = 'pointer';
        btnNew.style.fontSize = '0.85em';
        btnNew.style.flexShrink = '0';
        btnNew.style.whiteSpace = 'nowrap';
        btnNew.onclick = () => this.createNewItemTemplate();
        selRow.appendChild(btnNew);

        selectorSection.appendChild(selRow);

        // Spawn actions
        const spawnRow = document.createElement('div');
        spawnRow.style.display = 'flex';
        spawnRow.style.gap = '4px';
        spawnRow.style.marginTop = '6px';

        const btnSpawnPlayer = document.createElement('button');
        btnSpawnPlayer.textContent = '🎒 Add to Bag';
        btnSpawnPlayer.className = 'item-btn-action';
        btnSpawnPlayer.style.flex = '1';
        btnSpawnPlayer.onclick = () => this.spawnItemInPlayerInventory();
        spawnRow.appendChild(btnSpawnPlayer);

        const btnSpawnVendor = document.createElement('button');
        btnSpawnVendor.textContent = '🏪 Put in Shop';
        btnSpawnVendor.className = 'item-btn-action';
        btnSpawnVendor.style.flex = '1';
        btnSpawnVendor.onclick = () => this.addItemToShopkeeper();
        spawnRow.appendChild(btnSpawnVendor);

        selectorSection.appendChild(spawnRow);
        content.appendChild(selectorSection);

        // --- SECTION 1.5: Item Bank (Vault) ---
        this.createItemBankSection(content);

        // --- SECTION 2: Form Configurations (NPC style layout) ---
        const formSection = document.createElement('div');
        formSection.className = 'item-editor-section';
        formSection.innerHTML = '<h4>Item Blueprint Parameters</h4>';

        const form = document.createElement('div');
        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.gap = '8px';

        // Helper to format consistent 2-column or 3-column layouts inside cards
        const colGrid2 = (parent) => {
            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = '1fr 1fr';
            grid.style.gap = '6px';
            parent.appendChild(grid);
            return grid;
        };
        
        const colGrid3 = (parent) => {
            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = '1fr 1fr 1fr';
            grid.style.gap = '4px';
            parent.appendChild(grid);
            return grid;
        };

        const makeField = (parent, labelText, inputType, key, props = {}) => {
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'item-editor-field';
            fieldDiv.style.display = 'flex';
            fieldDiv.style.flexDirection = 'column';
            fieldDiv.style.marginBottom = '6px';

            const lbl = document.createElement('label');
            lbl.style.fontSize = '0.8em';
            lbl.style.fontWeight = 'bold';
            lbl.style.color = '#D4C8A0';
            lbl.style.marginBottom = '2px';
            lbl.textContent = labelText;
            fieldDiv.appendChild(lbl);

            let input;
            if (inputType === 'select') {
                input = document.createElement('select');
                input.style.width = '100%';
                input.style.backgroundColor = '#3B322C';
                input.style.color = '#EFEBE0';
                input.style.border = '1px solid #8C6D56';
                input.style.borderRadius = '4px';
                input.style.padding = '4px';
                input.style.fontSize = '0.9em';
                input.style.boxSizing = 'border-box';
                if (props.options) {
                    props.options.forEach(o => {
                        const opt = document.createElement('option');
                        opt.value = o.val || o.value;
                        opt.textContent = o.label || o.text;
                        input.appendChild(opt);
                    });
                }
            } else if (inputType === 'textarea') {
                input = document.createElement('textarea');
                input.rows = 2;
                input.style.resize = 'vertical';
                input.style.minHeight = '45px';
                input.style.width = '100%';
                input.style.backgroundColor = '#3B322C';
                input.style.color = '#EFEBE0';
                input.style.border = '1px solid #8C6D56';
                input.style.borderRadius = '4px';
                input.style.padding = '4px';
                input.style.fontSize = '0.9em';
                input.style.boxSizing = 'border-box';
            } else {
                input = document.createElement('input');
                input.type = inputType;
                input.style.width = '100%';
                input.style.backgroundColor = '#3B322C';
                input.style.color = '#EFEBE0';
                input.style.border = '1px solid #8C6D56';
                input.style.borderRadius = '4px';
                input.style.padding = '4px';
                input.style.fontSize = '0.9em';
                input.style.boxSizing = 'border-box';
                if (props.placeholder) input.placeholder = props.placeholder;
                if (props.min !== undefined) input.min = props.min;
            }

            fieldDiv.appendChild(input);
            this.fields[key] = input;
            parent.appendChild(fieldDiv);
            return fieldDiv;
        };

        // Name and ID Slug Grid
        const nameIdGrid = colGrid2(form);
        makeField(nameIdGrid, 'Display Name', 'text', 'name', { placeholder: 'e.g. Iron Axe' });
        makeField(nameIdGrid, 'ID Slug', 'text', 'id_slug', { placeholder: 'e.g. item_iron_axe' });
        
        // Item Class Type and Icon Preset Grid
        const classPresetGrid = colGrid2(form);
        makeField(classPresetGrid, 'Item Class Type', 'select', 'type', {
            options: [
                { val: 'weapon', label: '⚔️ Weapon (Equippable)' },
                { val: 'shield', label: '🛡️ Shield (Equippable)' },
                { val: 'armor', label: '👕 Armor (Equippable)' },
                { val: 'consumable', label: '❤️ Potions / Consumable' },
                { val: 'material', label: '💰 Material / Quest Loot' },
                { val: 'passive', label: '💍 Charm / Relic' }
            ]
        });

        // Icon Preset
        makeField(classPresetGrid, 'Icon Preset', 'select', 'emoji_preset', {
            options: [
                { val: '🗡️', label: '🗡️ Sword' },
                { val: '⚔️', label: '⚔️ Cross Swords' },
                { val: '🏹', label: '🏹 Bow' },
                { val: '🛡️', label: '🛡️ Shield' },
                { val: '👕', label: '👕 Armor' },
                { val: '❤️', label: '❤️ Red Potion/Heal' },
                { val: '🍵', label: '🍵 Brew/Flask' },
                { val: '🌿', label: '🌿 Green Herb' },
                { val: '🍎', label: '🍎 Apple' },
                { val: '🍖', label: '🍖 Meat' },
                { val: '📜', label: '📜 Scroll' },
                { val: '💎', label: '💎 Diamond' },
                { val: '💍', label: '💍 Ring' },
                { val: '💰', label: '💰 Money Bag' },
                { val: '🔑', label: '🔑 Key' },
                { val: '💀', label: '💀 Skull' },
                { val: '🔮', label: '🔮 Magic Sphere' },
                { val: '⚡', label: '⚡ Lightning' },
                { val: '🔥', label: '🔥 Fire' },
                { val: '❄️', label: '❄️ Frost' },
                { val: '🔨', label: '🔨 Hammer' },
                { val: '⭐', label: '⭐ Star' },
                { val: '🍁', label: '🍁 Leaf' },
                { val: '🔔', label: '🔔 Bell' }
            ]
        });

        // Custom Visual Icon Emoji Textfield (Editable directly)
        makeField(form, 'Visual Icon Emoji (Type/Edit Custom)', 'text', 'emoji', { placeholder: 'Type or choose preset...' });

        // Wire preset changes to emoji field text directly
        this.fields.emoji_preset.onchange = (e) => {
            this.fields.emoji.value = e.target.value;
        };

        // Buy/Sell Costs Grid
        const goldGrid = colGrid2(form);
        makeField(goldGrid, 'Buy Cost (Gold)', 'number', 'cost', { min: 0 });
        makeField(goldGrid, 'Sell Value (Gold)', 'number', 'value', { min: 0 });
        
        // Description text area (spans full width)
        makeField(form, 'Item Description', 'textarea', 'description');

        // 5. Active Gear Bonus (when equipped)
        const gearStatsGroup = document.createElement('div');
        gearStatsGroup.style.display = 'flex';
        gearStatsGroup.style.flexDirection = 'column';
        gearStatsGroup.style.backgroundColor = '#251E1A';
        gearStatsGroup.style.padding = '8px';
        gearStatsGroup.style.borderRadius = '5px';
        gearStatsGroup.style.border = '1px solid #3B322C';
        
        const grpTitleActive = document.createElement('div');
        grpTitleActive.style.fontSize = '0.8em';
        grpTitleActive.style.fontWeight = 'bold';
        grpTitleActive.style.color = '#D4C8A0';
        grpTitleActive.style.marginBottom = '4px';
        grpTitleActive.textContent = '⚔️ Active Equipment Bonuses';
        gearStatsGroup.appendChild(grpTitleActive);

        const gearGrid = colGrid2(gearStatsGroup);
        makeField(gearGrid, 'Bonus ATK DMG', 'number', 'bonusAtk', { min: 0 });
        makeField(gearGrid, 'Bonus GUARD DEF', 'number', 'bonusDef', { min: 0 });
        form.appendChild(gearStatsGroup);

        // 6. Passive Inventory Bonus
        const passiveStatsGroup = document.createElement('div');
        passiveStatsGroup.style.display = 'flex';
        passiveStatsGroup.style.flexDirection = 'column';
        passiveStatsGroup.style.backgroundColor = '#251E1A';
        passiveStatsGroup.style.padding = '8px';
        passiveStatsGroup.style.borderRadius = '5px';
        passiveStatsGroup.style.border = '1px solid #3B322C';

        const grpTitlePassive = document.createElement('div');
        grpTitlePassive.style.fontSize = '0.8em';
        grpTitlePassive.style.fontWeight = 'bold';
        grpTitlePassive.style.color = '#FFD700';
        grpTitlePassive.style.marginBottom = '4px';
        grpTitlePassive.textContent = '💍 Passive Charm Attributes (Sit in bag)';
        passiveStatsGroup.appendChild(grpTitlePassive);

        const passiveGrid = colGrid3(passiveStatsGroup);
        makeField(passiveGrid, 'Passive ATK', 'number', 'passiveAtk', { min: 0 });
        makeField(passiveGrid, 'Passive DEF', 'number', 'passiveDef', { min: 0 });
        makeField(passiveGrid, 'Passive HP', 'number', 'passiveHp', { min: 0 });
        form.appendChild(passiveStatsGroup);

        // 7. Consumable Actions (Heal & Curse)
        const consumableGroup = document.createElement('div');
        consumableGroup.style.display = 'flex';
        consumableGroup.style.flexDirection = 'column';
        consumableGroup.style.backgroundColor = '#251E1A';
        consumableGroup.style.padding = '8px';
        consumableGroup.style.borderRadius = '5px';
        consumableGroup.style.border = '1px solid #3B322C';

        const grpTitleConsumable = document.createElement('div');
        grpTitleConsumable.style.fontSize = '0.8em';
        grpTitleConsumable.style.fontWeight = 'bold';
        grpTitleConsumable.style.color = '#e74c3c';
        grpTitleConsumable.style.marginBottom = '4px';
        grpTitleConsumable.textContent = '❤️ Consumable Health Powers';
        consumableGroup.appendChild(grpTitleConsumable);

        const consumableGrid = colGrid2(consumableGroup);
        makeField(consumableGrid, 'HP Recovery Heals', 'number', 'heal', { min: 0 });
        makeField(consumableGrid, 'Curse Deals Damage', 'number', 'curseHp', { min: 0 });
        form.appendChild(consumableGroup);

        // 8. Dynamic Spell / Ability Attachment
        const spellBox = document.createElement('div');
        spellBox.style.display = 'flex';
        spellBox.style.flexDirection = 'column';
        spellBox.style.backgroundColor = '#251E1A';
        spellBox.style.padding = '8px';
        spellBox.style.borderRadius = '5px';
        spellBox.style.border = '1px solid #3B322C';
        
        const grpTitleSpell = document.createElement('div');
        grpTitleSpell.style.fontSize = '0.8em';
        grpTitleSpell.style.fontWeight = 'bold';
        grpTitleSpell.style.color = '#61b1ff';
        grpTitleSpell.style.marginBottom = '4px';
        grpTitleSpell.textContent = '🔮 Grant Action Spell on Cast';
        spellBox.appendChild(grpTitleSpell);

        makeField(spellBox, 'Select Spell', 'select', 'attachedAbility');
        form.appendChild(spellBox);

        // 9. Initial Owner/Spawn Allocation
        const allocationBox = document.createElement('div');
        allocationBox.style.display = 'flex';
        allocationBox.style.flexDirection = 'column';
        allocationBox.style.backgroundColor = '#251E1A';
        allocationBox.style.padding = '8px';
        allocationBox.style.borderRadius = '5px';
        allocationBox.style.border = '1px solid #3B322C';
        
        const grpTitleAlloc = document.createElement('div');
        grpTitleAlloc.style.fontSize = '0.8em';
        grpTitleAlloc.style.fontWeight = 'bold';
        grpTitleAlloc.style.color = '#ffd700';
        grpTitleAlloc.style.marginBottom = '4px';
        grpTitleAlloc.textContent = '👑 Initial Owner Assignment';
        allocationBox.appendChild(grpTitleAlloc);

        makeField(allocationBox, 'Where to Spawn upon Save:', 'select', 'spawn_target', {
            options: [
                { val: 'database_only', label: '💾 Database Library Only (No spawn)' },
                { val: 'spawn_bag', label: '🎒 Spawn 1x copy directly to Hero Bag' },
                { val: 'spawn_shop', label: '🏪 Spawn 5x copies to Doran Shop' }
            ]
        });
        form.appendChild(allocationBox);
        
        formSection.appendChild(form);
        content.appendChild(formSection);

        // --- SECTION 3: Save / Delete Library Row ---
        const actionsSection = document.createElement('div');
        actionsSection.className = 'item-editor-section';
        actionsSection.style.border = 'none';

        const actionBtns = document.createElement('div');
        actionBtns.style.display = 'flex';
        actionBtns.style.gap = '8px';

        const btnSave = document.createElement('button');
        btnSave.textContent = '💾 Save to Game';
        btnSave.style.flex = '2';
        btnSave.style.backgroundColor = '#27ae60';
        btnSave.style.color = 'white';
        btnSave.style.border = 'none';
        btnSave.style.padding = '8px';
        btnSave.style.fontWeight = 'bold';
        btnSave.style.borderRadius = '4px';
        btnSave.style.cursor = 'pointer';
        btnSave.onclick = () => this.saveCurrentFormToLibrary();
        actionBtns.appendChild(btnSave);

        const btnDelete = document.createElement('button');
        btnDelete.textContent = '🗑️ Delete';
        btnDelete.style.flex = '1';
        btnDelete.style.backgroundColor = '#c0392b';
        btnDelete.style.color = 'white';
        btnDelete.style.border = 'none';
        btnDelete.style.padding = '8px';
        btnDelete.style.borderRadius = '4px';
        btnDelete.style.cursor = 'pointer';
        btnDelete.onclick = () => this.deleteSelectedItem();
        actionBtns.appendChild(btnDelete);

        actionsSection.appendChild(actionBtns);
        content.appendChild(actionsSection);

        this.panel.appendChild(content);
        this.modalContentElement.appendChild(this.panel);

        // Prepopulate spell select initially
        this.populateAttachedAbilityDropdown();
        
        // Initial bank list reload
        this.refreshBankList();
        
        // Setup initial empty or template
        this.createNewItemTemplate(true);
    }

    createItemBankSection(parent) {
        const bankSection = document.createElement('div');
        bankSection.className = 'item-editor-section';
        
        // Header
        const h4 = document.createElement('h4');
        h4.textContent = '📚 Custom Item Bank & Bulk Vault';
        h4.style.marginBottom = '6px';
        bankSection.appendChild(h4);

        // Scrollable item list containers
        const listContainer = document.createElement('div');
        listContainer.style.maxHeight = '120px';
        listContainer.style.overflowY = 'auto';
        listContainer.style.backgroundColor = '#1F1915';
        listContainer.style.border = '1px solid #5A4B3E';
        listContainer.style.borderRadius = '4px';
        listContainer.style.padding = '5px';
        listContainer.style.marginBottom = '8px';
        listContainer.id = 'rpg-item-bank-list';
        bankSection.appendChild(listContainer);
        this.bankListContainer = listContainer;

        // Selection Ops row
        const selectOps = document.createElement('div');
        selectOps.style.display = 'flex';
        selectOps.style.justifyContent = 'space-between';
        selectOps.style.alignItems = 'center';
        selectOps.style.marginBottom = '8px';

        const labelPrompt = document.createElement('span');
        labelPrompt.style.fontSize = '0.75em';
        labelPrompt.style.color = '#A09580';
        labelPrompt.textContent = 'Select blueprints below for bulk ops:';
        selectOps.appendChild(labelPrompt);

        const btnToggleAll = document.createElement('button');
        btnToggleAll.textContent = 'Toggle All';
        btnToggleAll.className = 'item-btn-action';
        btnToggleAll.style.fontSize = '0.75em';
        btnToggleAll.style.padding = '2px 6px';
        btnToggleAll.onclick = () => this.toggleAllBankSelections();
        selectOps.appendChild(btnToggleAll);
        
        bankSection.appendChild(selectOps);

        // Action Buttons Row 1 (Import/Export JSON)
        const row1 = document.createElement('div');
        row1.style.display = 'flex';
        row1.style.gap = '5px';
        row1.style.marginBottom = '6px';

        const btnExport = document.createElement('button');
        btnExport.textContent = '📤 Export (.json)';
        btnExport.className = 'item-btn-action';
        btnExport.style.flex = '1';
        btnExport.style.backgroundColor = '#2980b9';
        btnExport.style.color = 'white';
        btnExport.onclick = () => this.exportSelectedBlueprints();
        row1.appendChild(btnExport);

        const itemBulkImportId = 'rpg-item-bulk-file-upload-input';
        // Hidden file input
        const fileInput = document.createElement('input');
        fileInput.id = itemBulkImportId;
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        fileInput.onchange = (e) => this.importBulkBlueprints(e);
        this.bankImportInput = fileInput;
        row1.appendChild(fileInput);

        const btnImport = document.createElement('label');
        btnImport.htmlFor = itemBulkImportId;
        btnImport.textContent = '📥 Import Bulk (.json)';
        btnImport.className = 'item-btn-action rpg-file-label';
        btnImport.style.flex = '1';
        btnImport.style.display = 'inline-block';
        btnImport.style.backgroundColor = '#8c765c';
        btnImport.style.color = 'white';
        row1.appendChild(btnImport);

        bankSection.appendChild(row1);

        // Action Buttons Row 2 (Bulk spawning)
        const row2 = document.createElement('div');
        row2.style.display = 'flex';
        row2.style.gap = '5px';

        const btnSpawnSelectedBag = document.createElement('button');
        btnSpawnSelectedBag.textContent = '🎒 Bag Selected';
        btnSpawnSelectedBag.className = 'item-btn-action';
        btnSpawnSelectedBag.style.flex = '1';
        btnSpawnSelectedBag.onclick = () => this.bulkSpawnInPlayerInventory();
        row2.appendChild(btnSpawnSelectedBag);

        const btnSpawnSelectedShop = document.createElement('button');
        btnSpawnSelectedShop.textContent = '🏪 Shop Selected';
        btnSpawnSelectedShop.className = 'item-btn-action';
        btnSpawnSelectedShop.style.flex = '1';
        btnSpawnSelectedShop.onclick = () => this.bulkAddSelectedToShopkeeper();
        row2.appendChild(btnSpawnSelectedShop);

        bankSection.appendChild(row2);
        parent.appendChild(bankSection);
    }

    refreshBankList() {
        if (!this.bankListContainer) return;
        this.bankListContainer.innerHTML = '';

        const customItems = getAllCustomItems();
        const keys = Object.keys(customItems);

        if (keys.length === 0) {
            const emptyLabel = document.createElement('span');
            emptyLabel.style.fontSize = '0.75em';
            emptyLabel.style.color = '#A09580';
            emptyLabel.style.fontStyle = 'italic';
            emptyLabel.textContent = 'Bank is empty. Create & save blueprints below to fill your vault!';
            this.bankListContainer.appendChild(emptyLabel);
            return;
        }

        keys.forEach(id => {
            const item = customItems[id];
            
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'space-between';
            row.style.padding = '3px 0';
            row.style.borderBottom = '1px solid #3B322C';
            
            const leftPart = document.createElement('div');
            leftPart.style.display = 'flex';
            leftPart.style.alignItems = 'center';
            leftPart.style.gap = '6px';
            leftPart.style.overflow = 'hidden';

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.className = 'rpg-item-bank-chk';
            chk.dataset.itemId = id;
            chk.style.cursor = 'pointer';
            chk.style.accentColor = '#8C6D56';
            leftPart.appendChild(chk);

            const displaySpan = document.createElement('span');
            displaySpan.style.fontSize = '0.85em';
            displaySpan.style.whiteSpace = 'nowrap';
            displaySpan.style.textOverflow = 'ellipsis';
            displaySpan.style.overflow = 'hidden';
            displaySpan.textContent = `${item.emoji || '🎁'} ${item.name}`;
            leftPart.appendChild(displaySpan);

            row.appendChild(leftPart);

            // Right slot info for preview load
            const btnLoad = document.createElement('span');
            btnLoad.textContent = '📝';
            btnLoad.title = 'Edit this blueprint';
            btnLoad.style.cursor = 'pointer';
            btnLoad.style.fontSize = '0.85em';
            btnLoad.onclick = () => {
                this.selectedItemId = id;
                this.refreshItemDropdown();
                this.loadItemIntoForm();
            };
            row.appendChild(btnLoad);

            this.bankListContainer.appendChild(row);
        });
    }

    toggleAllBankSelections() {
        const checkboxes = this.bankListContainer.querySelectorAll('.rpg-item-bank-chk');
        if (checkboxes.length === 0) return;
        
        // If some are unchecked, check all. Else uncheck all.
        const anyUnchecked = Array.from(checkboxes).some(c => !c.checked);
        checkboxes.forEach(c => c.checked = anyUnchecked);
    }

    exportSelectedBlueprints() {
        const checkboxes = this.bankListContainer.querySelectorAll('.rpg-item-bank-chk');
        const selectedIds = Array.from(checkboxes)
            .filter(c => c.checked)
            .map(c => c.dataset.itemId);

        if (selectedIds.length === 0) {
            CustomDialog.alert("Select at least one custom item from the bank list above to export.", "Export Blocked");
            return;
        }

        const customItems = getAllCustomItems();
        const exportObj = {};
        selectedIds.forEach(id => {
            if (customItems[id]) {
                exportObj[id] = customItems[id];
            }
        });

        const jsonStr = JSON.stringify(exportObj, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bulk_items_library_${selectedIds.length}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        CustomDialog.alert(`Successfully exported ${selectedIds.length} custom item blueprints.`, "Export Success");
    }

    importBulkBlueprints(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                let count = 0;

                // We support both a list of items OR a dictionary of items!
                const itemsToSave = [];
                if (Array.isArray(importedData)) {
                    importedData.forEach(it => {
                        if (it && it.id) itemsToSave.push(it);
                    });
                } else if (typeof importedData === 'object' && importedData !== null) {
                    // Try to see if it is a list of item objects or dictionary
                    Object.keys(importedData).forEach(k => {
                        const val = importedData[k];
                        if (val && typeof val === 'object') {
                            if (val.id) {
                                itemsToSave.push(val);
                            } else {
                                // If key is id, inject it
                                val.id = k;
                                itemsToSave.push(val);
                            }
                        }
                    });
                }

                if (itemsToSave.length === 0) {
                    CustomDialog.alert("No valid custom item blueprints found in selected JSON file.", "Import Error");
                    return;
                }

                itemsToSave.forEach(item => {
                    saveCustomItem(item);
                    count++;
                });

                CustomDialog.alert(`Successfully imported ${count} custom blueprints into the library vault!`, "Vault Imported");
                
                // Refresh list and dropdowns
                this.refreshBankList();
                this.refreshItemDropdown();
            } catch (err) {
                console.error(err);
                CustomDialog.alert("Failed to parse JSON file or invalid file content.", "Import File Corrupted");
            }
        };
        reader.readAsText(file);
        // Clear value to allow reselection of same file
        event.target.value = '';
    }

    bulkSpawnInPlayerInventory() {
        const player = this.engine.player;
        if (!player) {
            CustomDialog.alert("Hero actor is not spawned on map yet.", "Spawn Failed");
            return;
        }

        const checkboxes = this.bankListContainer.querySelectorAll('.rpg-item-bank-chk');
        const selectedIds = Array.from(checkboxes)
            .filter(c => c.checked)
            .map(c => c.dataset.itemId);

        if (selectedIds.length === 0) {
            CustomDialog.alert("Select at least one custom item from the bank list above.", "Bulk Action Blocked");
            return;
        }

        const customItems = getAllCustomItems();
        let addedCount = 0;

        selectedIds.forEach(id => {
            const config = customItems[id];
            if (config) {
                // Prepare item structure for bag
                const spawnedItem = {
                    id: config.id + '_' + Date.now() + '_' + Math.floor(Math.random() * 100),
                    name: config.name,
                    type: config.type,
                    emoji: config.emoji || '🎁',
                    description: config.description,
                    cost: config.cost || 0,
                    value: config.value || 0,
                    count: 1,
                    bonusAtk: config.bonusAtk || 0,
                    bonusDef: config.bonusDef || 0,
                    passiveAtk: config.passiveAtk || 0,
                    passiveDef: config.passiveDef || 0,
                    passiveHp: config.passiveHp || 0,
                    heal: config.heal || 0,
                    curseHp: config.curseHp || 0,
                    attachedAbility: config.attachedAbility || null
                };
                
                player.inventory.push(spawnedItem);
                addedCount++;
            }
        });

        // Trigger HP updates reactively
        if (player.updateDynamicStats) player.updateDynamicStats();

        // Save state of engine player or refresh inventory UI if open
        const inventoryUI = this.engine.inventoryUI;
        if (inventoryUI && inventoryUI.isOpen) {
            inventoryUI.render();
        }

        CustomDialog.alert(`Successfully spawned ${addedCount} custom items directly to Hero bag!`, "Spawning Complete");
    }

    bulkAddSelectedToShopkeeper() {
        // Find shopkeeper NPC spawned on map
        let shopkeeperNpc = null;
        for (const obj of this.engine.gameObjects) {
            if (obj.constructor.name === 'Npc' && (obj.name.toLowerCase().includes('doran') || obj.name.toLowerCase().includes('shopkeeper'))) {
                shopkeeperNpc = obj;
                break;
            }
        }

        if (!shopkeeperNpc) {
            CustomDialog.alert("Could not locate active Shopkeeper Doran on the current map.", "Vendor Not Found");
            return;
        }

        const checkboxes = this.bankListContainer.querySelectorAll('.rpg-item-bank-chk');
        const selectedIds = Array.from(checkboxes)
            .filter(c => c.checked)
            .map(c => c.dataset.itemId);

        if (selectedIds.length === 0) {
            CustomDialog.alert("Select at least one custom item from the bank list above.", "Bulk Action Blocked");
            return;
        }

        if (!Array.isArray(shopkeeperNpc.inventory)) {
            shopkeeperNpc.inventory = [];
        }

        const customItems = getAllCustomItems();
        let addedCount = 0;

        selectedIds.forEach(id => {
            const config = customItems[id];
            if (config) {
                // For shops we just push unique ID or reference blueprint config
                // Check if shop already has an item with this blueprint ID
                const existing = shopkeeperNpc.inventory.find(it => it.id === config.id);
                if (existing) {
                    existing.count = (existing.count || 0) + 5;
                } else {
                    shopkeeperNpc.inventory.push({
                        id: config.id, // blueprints keep the original ID in shop!
                        name: config.name,
                        type: config.type,
                        emoji: config.emoji || '🎁',
                        description: config.description,
                        cost: config.cost || 0,
                        value: config.value || 0,
                        count: 5, // starting stack
                        bonusAtk: config.bonusAtk || 0,
                        bonusDef: config.bonusDef || 0,
                        passiveAtk: config.passiveAtk || 0,
                        passiveDef: config.passiveDef || 0,
                        passiveHp: config.passiveHp || 0,
                        heal: config.heal || 0,
                        curseHp: config.curseHp || 0,
                        attachedAbility: config.attachedAbility || null
                    });
                }
                addedCount++;
            }
        });

        CustomDialog.alert(`Successfully supplied ${addedCount} selected item types (5 counts each) to Shopkeeper Doran's sell store!`, "Shop Stock Updated");
    }

    populateAttachedAbilityDropdown() {
        if (!this.fields.attachedAbility) return;
        const select = this.fields.attachedAbility;
        select.innerHTML = '<option value="">None (No Spell attached)</option>';

        // Get all abilities from engine system
        const abilitiesList = getAllAbilities();
        Object.keys(abilitiesList).forEach(abilityKey => {
            const ab = abilitiesList[abilityKey];
            const opt = document.createElement('option');
            opt.value = ab.id;
            opt.textContent = `🔮 ${ab.name} (CD: ${ab.cooldown}s)`;
            select.appendChild(opt);
        });
    }

    show() {
        this.initUI();
        this.panel.style.display = 'flex';
        this.isActive = true;
        this.populateAttachedAbilityDropdown();
        this.refreshItemDropdown();
        this.refreshBankList();
    }

    hide() {
        if (this.panel) {
            this.panel.style.display = 'none';
        }
        this.isActive = false;
    }

    refreshItemDropdown() {
        if (!this.itemSelectDropdown) return;

        const currentSelectedVal = this.selectedItemId;
        this.itemSelectDropdown.innerHTML = '';

        const defOpt = document.createElement('option');
        defOpt.value = '';
        defOpt.textContent = '-- Choose Item --';
        this.itemSelectDropdown.appendChild(defOpt);

        // 1. Gather all default presets
        const STANDARD_PRESETS_MUTABLE = [
            { id: "std_red_potion", name: "Red Potion", emoji: "❤️" },
            { id: "std_gold_elixir", name: "Gold Elixir", emoji: "🍵" },
            { id: "std_green_herb", name: "Green Herb", emoji: "🌿" },
            { id: "std_iron_sword", name: "Iron Sword", emoji: "🗡️" },
            { id: "std_steel_shield", name: "Steel Shield", emoji: "🛡️" },
            { id: "std_lucky_ring", name: "Lucky Charm Ring", emoji: "💍" }
        ];

        // Unique map of ID -> display properties
        const dbItems = {};
        STANDARD_PRESETS_MUTABLE.forEach(it => {
            dbItems[it.id] = it;
        });

        // 2. Gather custom items
        const customItems = getAllCustomItems();
        Object.keys(customItems).forEach(id => {
            dbItems[id] = customItems[id];
        });

        Object.keys(dbItems).forEach(id => {
            const it = dbItems[id];
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = `${it.emoji || '🎁'} ${it.name} [ID: ${id}]`;
            this.itemSelectDropdown.appendChild(opt);
        });

        if (dbItems[currentSelectedVal]) {
            this.itemSelectDropdown.value = currentSelectedVal;
        } else {
            this.itemSelectDropdown.value = '';
        }
    }

    createNewItemTemplate(silent = false) {
        // Build a nice default structure
        const randomId = 'item_' + Math.floor(Math.random() * 9000 + 1000);
        
        this.fields.id_slug.value = randomId;
        this.fields.name.value = 'Runic Emblem';
        this.fields.type.value = 'passive';
        this.fields.emoji.value = '💍';
        this.fields.description.value = 'Gives the player passive +3 ATK and +2 DEF while in the bag.';
        this.fields.cost.value = '250';
        this.fields.value.value = '125';
        
        this.fields.bonusAtk.value = '0';
        this.fields.bonusDef.value = '0';
        
        this.fields.passiveAtk.value = '3';
        this.fields.passiveDef.value = '2';
        this.fields.passiveHp.value = '0';
        
        this.fields.heal.value = '0';
        this.fields.curseHp.value = '0';
        this.fields.attachedAbility.value = '';
        
        if (this.fields.spawn_target) {
            this.fields.spawn_target.value = 'database_only';
        }

        this.selectedItemId = '';
        this.refreshItemDropdown();

        if (!silent) {
            CustomDialog.alert("New item blueprint template initialized! Fill in parameters and click 'Save to Game'!", "Blueprint Initialized");
        }
    }

    loadItemIntoForm() {
        if (!this.selectedItemId) return;

        const customItems = getAllCustomItems();
        let item = customItems[this.selectedItemId];
        
        if (!item) {
            // Find in starting standard presets
            const STANDARD_PRESETS_FULL = [
                { id: "std_red_potion", name: "Red Potion", type: "consumable", emoji: "❤️", heal: 40, cost: 20, value: 14, description: "Restores 40 Health Points." },
                { id: "std_gold_elixir", name: "Gold Elixir", type: "consumable", emoji: "🍵", heal: 100, cost: 60, value: 42, description: "A golden elixir that fully restores health and vitality." },
                { id: "std_green_herb", name: "Green Herb", type: "consumable", emoji: "🌿", heal: 15, cost: 8, value: 5, description: "Restores 15 Health Points." },
                { id: "std_iron_sword", name: "Iron Sword", type: "weapon", emoji: "🗡️", bonusAtk: 5, cost: 120, value: 84, description: "+5 Weapon attack power." },
                { id: "std_steel_shield", name: "Steel Shield", type: "shield", emoji: "🛡️", bonusDef: 4, cost: 100, value: 70, description: "+4 Defense combat gear." },
                { id: "std_lucky_ring", name: "Lucky Charm Ring", type: "passive", emoji: "💍", passiveAtk: 2, passiveDef: 2, passiveHp: 20, cost: 300, value: 150, description: "Grants +2 ATK, +2 DEF, and +20 HP passively while resting in inventory." }
            ];
            item = STANDARD_PRESETS_FULL.find(it => it.id === this.selectedItemId);
        }

        if (!item) return;

        this.fields.id_slug.value = item.id || '';
        this.fields.name.value = item.name || '';
        this.fields.type.value = item.type || 'weapon';
        this.fields.emoji.value = item.emoji || '🗡️';
        this.fields.description.value = item.description || '';
        this.fields.cost.value = item.cost ?? '100';
        this.fields.value.value = item.value ?? '50';
        
        this.fields.bonusAtk.value = item.bonusAtk ?? '0';
        this.fields.bonusDef.value = item.bonusDef ?? '0';
        
        this.fields.passiveAtk.value = item.passiveAtk ?? '0';
        this.fields.passiveDef.value = item.passiveDef ?? '0';
        this.fields.passiveHp.value = item.passiveHp ?? '0';
        
        this.fields.heal.value = item.heal ?? '0';
        this.fields.curseHp.value = item.curseHp ?? '0';
        this.fields.attachedAbility.value = item.attachedAbility || '';
    }

    getCurrentFormConfig() {
        return {
            id: this.fields.id_slug.value.trim().toLowerCase(),
            name: this.fields.name.value.trim() || 'Custom Item',
            type: this.fields.type.value,
            emoji: this.fields.emoji.value,
            description: this.fields.description.value.trim(),
            cost: parseInt(this.fields.cost.value, 10) || 0,
            value: parseInt(this.fields.value.value, 10) || 0,
            
            bonusAtk: parseInt(this.fields.bonusAtk.value, 10) || 0,
            bonusDef: parseInt(this.fields.bonusDef.value, 10) || 0,
            
            passiveAtk: parseInt(this.fields.passiveAtk.value, 10) || 0,
            passiveDef: parseInt(this.fields.passiveDef.value, 10) || 0,
            passiveHp: parseInt(this.fields.passiveHp.value, 10) || 0,
            
            heal: parseInt(this.fields.heal.value, 10) || 0,
            curseHp: parseInt(this.fields.curseHp.value, 10) || 0,
            attachedAbility: this.fields.attachedAbility.value || null
        };
    }

    saveCurrentFormToLibrary() {
        const config = this.getCurrentFormConfig();
        if (!config.id) {
            CustomDialog.alert("ID slug is required to persist the custom item.", "Validation Failure");
            return;
        }

        saveCustomItem(config);
        this.selectedItemId = config.id;
        
        this.refreshItemDropdown();
        this.refreshBankList();
        this.loadItemIntoForm();

        // Refresh sibling Bank & Vault Editor view if active!
        const bankEditor = this.engine.editorManager ? this.engine.editorManager.editors.bank : null;
        if (bankEditor) {
            bankEditor.renderDatabaseView();
        }

        // Process spawn allocation targets
        const spawnTarget = this.fields.spawn_target.value;
        if (spawnTarget === 'spawn_bag') {
            this.spawnItemInPlayerInventory(true);
        } else if (spawnTarget === 'spawn_shop') {
            this.addItemToShopkeeper(true);
        }
        
        let allocDesc = "Saved to Library blueprints database.";
        if (spawnTarget === 'spawn_bag') allocDesc = "Saved to Library and gave 1x copy to Hero bag.";
        if (spawnTarget === 'spawn_shop') allocDesc = "Saved to Library and stocked 5x copies in Doran's Shop.";

        CustomDialog.alert(`Item blueprint "${config.name}" saved successfully!\n\nAllocation: ${allocDesc}`, "Save Success");
    }

    deleteSelectedItem() {
        const id = this.selectedItemId;
        if (!id) {
            CustomDialog.alert("Please choose a custom item to delete.", "Delete Failed");
            return;
        }

        CustomDialog.confirm(`Are you sure you want to delete "${this.fields.name.value}"?`, "Confirm Deletion").then(res => {
            if (res) {
                deleteCustomItem(id);
                this.selectedItemId = '';
                this.refreshItemDropdown();
                this.refreshBankList();
                this.createNewItemTemplate(true);
                CustomDialog.alert("Item blueprint deleted from campaign.", "Delete Succeeded");
            }
        });
    }

    spawnItemInPlayerInventory(silent = false) {
        const player = this.engine.player;
        if (!player) {
            if (!silent) CustomDialog.alert("Hero actor is not spawned on map yet.", "Spawn Failed");
            return;
        }

        const config = this.getCurrentFormConfig();
        
        // Format to push into bag
        const newItem = {
            id: config.id + '_' + Date.now(),
            name: config.name,
            type: config.type,
            emoji: config.emoji,
            description: config.description,
            cost: config.cost,
            value: config.value,
            count: 1,
            bonusAtk: config.bonusAtk,
            bonusDef: config.bonusDef,
            passiveAtk: config.passiveAtk,
            passiveDef: config.passiveDef,
            passiveHp: config.passiveHp,
            heal: config.heal,
            curseHp: config.curseHp,
            attachedAbility: config.attachedAbility
        };

        // Put in bag
        player.inventory.push(newItem);
        
        // Trigger HP updates reactively
        if (player.updateDynamicStats) player.updateDynamicStats();
        
        // Update live HUD
        if (this.engine.inventoryUI && this.engine.inventoryUI.isOpen) {
            this.engine.inventoryUI.render();
        }

        // Floating popup in workspace
        if (this.engine.inventoryUI) {
            this.engine.inventoryUI.addLocalFloatText(`Added ${newItem.emoji} ${newItem.name} to adventure bag!`, '#3498db');
        }

        if (!silent) {
            CustomDialog.alert(`Spawned a copy of "${newItem.name}" directly inside the player bag! Press [I] to review stat bonuses.`, "Item Spawned");
        }
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

    addItemToShopkeeper(silent = false) {
        const config = this.getCurrentFormConfig();
        const catalogItem = {
            id: config.id,
            name: config.name,
            type: config.type,
            cost: config.cost,
            value: config.value,
            emoji: config.emoji,
            description: config.description,
            count: 5,
            bonusAtk: config.bonusAtk,
            bonusDef: config.bonusDef,
            passiveAtk: config.passiveAtk,
            passiveDef: config.passiveDef,
            passiveHp: config.passiveHp,
            heal: config.heal,
            curseHp: config.curseHp,
            attachedAbility: config.attachedAbility
        };

        const npcs = this.getMapNPCs();
        if (npcs.length === 0) {
            if (!silent) {
                CustomDialog.alert("Could not locate any active NPCs/Shopkeepers on the current map.", "Shopkeeper Not Found");
            }
            return;
        }

        if (silent || npcs.length === 1) {
            // Deliver to first vendor/NPC silently (either silent mode, or on map there's only 1 target)
            const chosen = npcs[0];
            this.deliverFormItemToNpc(chosen, catalogItem, silent);
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
                    <p style="margin-bottom:12px;">Which NPC on the map should receive 5x copies of "${config.name}"?</p>
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
                    this.deliverFormItemToNpc(chosenNpc, catalogItem, silent);
                }
            });
        }
    }

    deliverFormItemToNpc(npcNpc, catalogItem, silent) {
        if (!Array.isArray(npcNpc.inventory)) {
            npcNpc.inventory = [];
        }

        const existing = npcNpc.inventory.find(i => i.name === catalogItem.name);
        if (existing) {
            existing.count += 5;
        } else {
            npcNpc.inventory.push(catalogItem);
        }

        if (!silent) {
            CustomDialog.alert(`Successfully delivered 5 copies of "${catalogItem.name}" to ${npcNpc.name}'s Merchant Catalog! Open dialogue to trade.`, "Stock Delivered");
        }
    }
}

export default ItemEditor;
