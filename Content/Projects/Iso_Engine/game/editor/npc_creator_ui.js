// scripts/extensions/rpg/game/editor/npc_creator_ui.js
console.log("rpg/game/editor/npc_creator_ui.js loaded");

const SPRITE_SIZE = 64;

class NpcCreatorUI {
    constructor(creator) {
        this.creator = creator;
        this.panel = null;
        this.fields = {};
        this.reactiveAvatarContainer = null;
        this.spriteSheetAsset = null;
    }

    createPanel(modalContentElement, npcSpriteSheet) {
        this.spriteSheetAsset = npcSpriteSheet;
        // Add an onload to the asset itself to handle async loading
        if (this.spriteSheetAsset && !this.spriteSheetAsset.complete) {
            this.spriteSheetAsset.onload = () => {
                // When it loads, if we have NPC data loaded that uses a spritesheet, refresh its preview
                if (this.creator.currentNpcData && this.creator.currentNpcData.map_sprite.type === 'spritesheet') {
                    this.updateMapSpritePreview();
                }
            };
        }
        this.panel = document.createElement('div');
        this.panel.id = 'rpg-npc-creator-panel';
        this.panel.style.display = 'none';

        const titleButton = document.createElement('button');
        titleButton.id = 'rpg-npc-creator-toggle';
        titleButton.textContent = 'NPC Creator';
        titleButton.onclick = () => this.panel.classList.toggle('collapsed');
        this.panel.appendChild(titleButton);

        const content = document.createElement('div');
        content.id = 'rpg-npc-creator-content';

        // --- File Operations ---
        const opsSection = this._createSection(content, 'Operations');
        const opsButtons = document.createElement('div');
        opsButtons.style.display = 'flex';
        opsButtons.style.gap = '5px';
        
        const newButton = document.createElement('button');
        newButton.textContent = 'New';
        newButton.onclick = () => this.creator.reset();
        opsButtons.appendChild(newButton);

        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save (.json)';
        saveButton.onclick = () => this.creator.save();
        opsButtons.appendChild(saveButton);
        
        const loadInput = document.createElement('input');
        loadInput.type = 'file';
        loadInput.accept = '.json';
        loadInput.style.display = 'none';
        loadInput.onchange = (e) => this.creator.load(e);
        this.fields.loadInput = loadInput;
        
        const loadButton = document.createElement('button');
        loadButton.textContent = 'Load (.json)';
        loadButton.onclick = () => loadInput.click();
        opsButtons.appendChild(loadButton);
        opsSection.appendChild(opsButtons);

        // --- Core Info ---
        const coreSection = this._createSection(content, 'Core Information');
        this.fields.name = this._createTextField(coreSection, 'name', 'Name');
        this.fields.description = this._createTextArea(coreSection, 'description', 'Description');
        this.fields.first_mes = this._createTextArea(coreSection, 'first_mes', 'Greeting / First Message');

        // --- Stats & Role ---
        const statsSection = this._createSection(content, 'Stats & Role');
        const statsGrid = document.createElement('div');
        statsGrid.style.display = 'grid';
        statsGrid.style.gridTemplateColumns = '1fr 1fr';
        statsGrid.style.gap = '6px';

        // Role Dropdown
        const roleDiv = document.createElement('div');
        const roleLabel = document.createElement('label');
        roleLabel.style.fontSize = '0.8em';
        roleLabel.textContent = 'Role';
        const roleSelect = document.createElement('select');
        roleSelect.id = 'npc-creator-broadType';
        roleSelect.style.width = '100%';
        roleSelect.style.background = '#3B322C';
        roleSelect.style.color = '#EFEBE0';
        roleSelect.style.border = '1px solid #8C6D56';
        roleSelect.style.borderRadius = '4px';
        roleSelect.style.padding = '4px';
        roleSelect.style.fontSize = '0.9em';

        const optVil = document.createElement('option');
        optVil.value = 'villager';
        optVil.textContent = 'Villager';
        const optMer = document.createElement('option');
        optMer.value = 'merchant';
        optMer.textContent = 'Merchant';
        const optGrd = document.createElement('option');
        optGrd.value = 'guard';
        optGrd.textContent = 'Guard';
        const optEny = document.createElement('option');
        optEny.value = 'enemy';
        optEny.textContent = 'Enemy';

        roleSelect.appendChild(optVil);
        roleSelect.appendChild(optMer);
        roleSelect.appendChild(optGrd);
        roleSelect.appendChild(optEny);
        roleDiv.appendChild(roleLabel);
        roleDiv.appendChild(roleSelect);
        statsGrid.appendChild(roleDiv);
        this.fields.broadType = roleSelect;

        // Level Input
        const lvlDiv = document.createElement('div');
        const lvlLabel = document.createElement('label');
        lvlLabel.style.fontSize = '0.8em';
        lvlLabel.textContent = 'Level';
        const lvlInput = document.createElement('input');
        lvlInput.type = 'number';
        lvlInput.value = '1';
        lvlInput.min = '1';
        lvlInput.max = '100';
        lvlInput.style.width = '100%';
        lvlInput.style.background = '#3B322C';
        lvlInput.style.color = '#EFEBE0';
        lvlInput.style.border = '1px solid #8C6D56';
        lvlInput.style.borderRadius = '4px';
        lvlInput.style.padding = '4px';
        lvlInput.style.boxSizing = 'border-box';
        lvlDiv.appendChild(lvlLabel);
        lvlDiv.appendChild(lvlInput);
        statsGrid.appendChild(lvlDiv);
        this.fields.level = lvlInput;

        // HP Input
        const hpDiv = document.createElement('div');
        const hpLabel = document.createElement('label');
        hpLabel.style.fontSize = '0.8em';
        hpLabel.textContent = 'HP';
        const hpInput = document.createElement('input');
        hpInput.type = 'number';
        hpInput.value = '50';
        hpInput.min = '1';
        hpInput.style.width = '100%';
        hpInput.style.background = '#3B322C';
        hpInput.style.color = '#EFEBE0';
        hpInput.style.border = '1px solid #8C6D56';
        hpInput.style.borderRadius = '4px';
        hpInput.style.padding = '4px';
        hpInput.style.boxSizing = 'border-box';
        hpDiv.appendChild(hpLabel);
        hpDiv.appendChild(hpInput);
        statsGrid.appendChild(hpDiv);
        this.fields.hp = hpInput;

        // Max HP Input
        const mhpDiv = document.createElement('div');
        const mhpLabel = document.createElement('label');
        mhpLabel.style.fontSize = '0.8em';
        mhpLabel.textContent = 'Max HP';
        const mhpInput = document.createElement('input');
        mhpInput.type = 'number';
        mhpInput.value = '50';
        mhpInput.min = '1';
        mhpInput.style.width = '100%';
        mhpInput.style.background = '#3B322C';
        mhpInput.style.color = '#EFEBE0';
        mhpInput.style.border = '1px solid #8C6D56';
        mhpInput.style.borderRadius = '4px';
        mhpInput.style.padding = '4px';
        mhpInput.style.boxSizing = 'border-box';
        mhpDiv.appendChild(mhpLabel);
        mhpDiv.appendChild(mhpInput);
        statsGrid.appendChild(mhpDiv);
        this.fields.maxHp = mhpInput;

        // Atk Input
        const atkDiv = document.createElement('div');
        const atkLabel = document.createElement('label');
        atkLabel.style.fontSize = '0.8em';
        atkLabel.textContent = 'Attack';
        const atkInput = document.createElement('input');
        atkInput.type = 'number';
        atkInput.value = '10';
        atkInput.min = '0';
        atkInput.style.width = '100%';
        atkInput.style.background = '#3B322C';
        atkInput.style.color = '#EFEBE0';
        atkInput.style.border = '1px solid #8C6D56';
        atkInput.style.borderRadius = '4px';
        atkInput.style.padding = '4px';
        atkInput.style.boxSizing = 'border-box';
        atkDiv.appendChild(atkLabel);
        atkDiv.appendChild(atkInput);
        statsGrid.appendChild(atkDiv);
        this.fields.atk = atkInput;

        // Def Input
        const defDiv = document.createElement('div');
        const defLabel = document.createElement('label');
        defLabel.style.fontSize = '0.8em';
        defLabel.textContent = 'Defense';
        const defInput = document.createElement('input');
        defInput.type = 'number';
        defInput.value = '5';
        defInput.min = '0';
        defInput.style.width = '100%';
        defInput.style.background = '#3B322C';
        defInput.style.color = '#EFEBE0';
        defInput.style.border = '1px solid #8C6D56';
        defInput.style.borderRadius = '4px';
        defInput.style.padding = '4px';
        defInput.style.boxSizing = 'border-box';
        defDiv.appendChild(defLabel);
        defDiv.appendChild(defInput);
        statsGrid.appendChild(defDiv);
        this.fields.def = defInput;

        // Speed Input
        const spdDiv = document.createElement('div');
        spdDiv.style.gridColumn = 'span 2';
        const spdLabel = document.createElement('label');
        spdLabel.style.fontSize = '0.8em';
        spdLabel.textContent = 'Speed';
        const spdInput = document.createElement('input');
        spdInput.type = 'number';
        spdInput.value = '120';
        spdInput.min = '1';
        spdInput.style.width = '100%';
        spdInput.style.background = '#3B322C';
        spdInput.style.color = '#EFEBE0';
        spdInput.style.border = '1px solid #8C6D56';
        spdInput.style.borderRadius = '4px';
        spdInput.style.padding = '4px';
        spdInput.style.boxSizing = 'border-box';
        spdDiv.appendChild(spdLabel);
        spdDiv.appendChild(spdInput);
        statsGrid.appendChild(spdDiv);
        this.fields.speed = spdInput;

        statsSection.appendChild(statsGrid);

        // --- Starting Inventory ---
        const invSection = this._createSection(content, 'Starting Inventory');
        this._createInventoryManager(invSection);

        // --- Custom Conversation Branches ---
        const branchSection = this._createSection(content, 'Dialogue Options / Branches');
        this._createDialogueBranchesManager(branchSection);

        // --- Visuals ---
        const visualsSection = this._createSection(content, 'Visuals');
        this._createMapSpritePicker(visualsSection);
        this._createMainAvatarPicker(visualsSection);
        this._createReactiveAvatarManager(visualsSection);

        this.panel.appendChild(content);
        return this.panel;
    }
    
    _createSection(parent, title) {
        const section = document.createElement('div');
        section.className = 'npc-creator-section';
        const h4 = document.createElement('h4');
        h4.textContent = title;
        section.appendChild(h4);
        parent.appendChild(section);
        return section;
    }

    _createTextField(parent, id, labelText) {
        const label = document.createElement('label');
        label.htmlFor = `npc-creator-${id}`;
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `npc-creator-${id}`;
        parent.appendChild(label);
        parent.appendChild(input);
        return input;
    }

    _createTextArea(parent, id, labelText) {
        const label = document.createElement('label');
        label.htmlFor = `npc-creator-${id}`;
        label.textContent = labelText;
        const textarea = document.createElement('textarea');
        textarea.id = `npc-creator-${id}`;
        parent.appendChild(label);
        parent.appendChild(textarea);
        return textarea;
    }
    
    _createMapSpritePicker(parent) {
        const label = document.createElement('label');
        label.textContent = "Map Sprite (64x64)";
        parent.appendChild(label);

        const container = document.createElement('div');
        container.className = 'npc-creator-sprite-picker';
        
        const previewDiv = document.createElement('div');
        previewDiv.className = 'npc-sprite-preview-container';
        previewDiv.title = 'Click to select from spritesheet';
        previewDiv.style.cursor = 'pointer';
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = SPRITE_SIZE;
        previewCanvas.height = SPRITE_SIZE;
        previewDiv.appendChild(previewCanvas);
        this.fields.mapSpritePreview = previewCanvas;
        
        previewDiv.onclick = () => this._showSpriteSelectorPopup();
        
        const uploadDiv = document.createElement('div');
        uploadDiv.style.display = 'flex';
        uploadDiv.style.flexDirection = 'column';
        uploadDiv.style.justifyContent = 'center';
        uploadDiv.style.gap = '5px';
        
        const uploadInput = document.createElement('input');
        uploadInput.type = 'file';
        uploadInput.accept = 'image/png';
        uploadInput.style.display = 'none';
        uploadInput.onchange = (e) => this.creator.handleImageUpload(e, 'map_sprite');
        
        const uploadButton = document.createElement('button');
        uploadButton.textContent = 'Upload Custom';
        uploadButton.onclick = () => uploadInput.click();
        uploadDiv.appendChild(uploadInput);
        uploadDiv.appendChild(uploadButton);

        container.appendChild(previewDiv);
        container.appendChild(uploadDiv);
        parent.appendChild(container);
    }

    _showSpriteSelectorPopup() {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'npc-sprite-selector-overlay';
        
        // Create popup
        const popup = document.createElement('div');
        popup.id = 'npc-sprite-selector-popup';
        
        const title = document.createElement('h4');
        title.textContent = 'Select a Sprite';
        popup.appendChild(title);
        
        const selectorCanvas = document.createElement('canvas');
        selectorCanvas.id = 'npc-sprite-selector-popup-canvas';
        selectorCanvas.width = SPRITE_SIZE * 6;
        selectorCanvas.height = SPRITE_SIZE;
        
        if (this.spriteSheetAsset?.complete) {
            selectorCanvas.getContext('2d').drawImage(this.spriteSheetAsset, 0, 0);
        } else if (this.spriteSheetAsset) {
            this.spriteSheetAsset.onload = () => selectorCanvas.getContext('2d').drawImage(this.spriteSheetAsset, 0, 0);
        }
        popup.appendChild(selectorCanvas);
        
        const closePopup = () => {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
        };

        // Close when clicking overlay
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                closePopup();
            }
        };

        // Handle selection
        selectorCanvas.onclick = (e) => {
            const rect = selectorCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const spriteIndex = Math.floor(x / SPRITE_SIZE);
            
            // Update NPC data
            this.creator.currentNpcData.map_sprite = { type: 'spritesheet', source: spriteIndex };
            
            // Update the preview on the main UI
            this.updateMapSpritePreview();

            // Close popup
            closePopup();
        };

        overlay.appendChild(popup);
        document.body.appendChild(overlay);
    }

    _createMainAvatarPicker(parent) {
        const label = document.createElement('label');
        label.textContent = "Main Dialogue Avatar";
        parent.appendChild(label);
        
        const container = document.createElement('div');
        container.className = 'npc-creator-avatar-picker';

        const previewDiv = document.createElement('div');
        previewDiv.className = 'npc-avatar-preview-container';
        const img = document.createElement('img');
        img.alt = 'Main Avatar';
        previewDiv.appendChild(img);
        this.fields.mainAvatarPreview = img;
        
        const uploadInput = document.createElement('input');
        uploadInput.type = 'file';
        uploadInput.accept = 'image/png, image/jpeg, image/webp';
        uploadInput.style.display = 'none';
        uploadInput.onchange = (e) => this.creator.handleImageUpload(e, 'main_avatar');

        const uploadButton = document.createElement('button');
        uploadButton.textContent = 'Upload Main Avatar';
        uploadButton.onclick = () => uploadInput.click();

        container.appendChild(previewDiv);
        container.appendChild(uploadButton);
        container.appendChild(uploadInput);
        parent.appendChild(container);
    }
    
    _createReactiveAvatarManager(parent) {
        const label = document.createElement('label');
        label.textContent = "Reactive Avatars";
        parent.appendChild(label);

        this.reactiveAvatarContainer = document.createElement('div');
        this.reactiveAvatarContainer.style.display = 'flex';
        this.reactiveAvatarContainer.style.flexDirection = 'column';
        this.reactiveAvatarContainer.style.gap = '5px';
        parent.appendChild(this.reactiveAvatarContainer);

        const addButton = document.createElement('button');
        addButton.textContent = '+ Add Reactive Avatar';
        addButton.onclick = () => this._addReactiveAvatarEntry();
        parent.appendChild(addButton);
    }

    _addReactiveAvatarEntry(data = { keyword: '', dataUrl: null }) {
        const index = this.creator.currentNpcData.dialogue_avatars.reactive.length;
        if (!data.keyword) { // Only push if it's a new entry
            this.creator.currentNpcData.dialogue_avatars.reactive.push({ ...data });
        }
        
        const entryDiv = document.createElement('div');
        entryDiv.className = 'npc-reactive-avatar-entry';
        
        const previewDiv = document.createElement('div');
        previewDiv.className = 'npc-avatar-preview-container';
        previewDiv.style.width = '32px';
        previewDiv.style.height = '32px';
        const img = document.createElement('img');
        if (data.dataUrl) img.src = data.dataUrl;
        previewDiv.appendChild(img);
        
        const uploadInput = document.createElement('input');
        uploadInput.type = 'file';
        uploadInput.accept = 'image/png, image/jpeg, image/webp';
        uploadInput.style.display = 'none';
        uploadInput.onchange = (e) => this.creator.handleImageUpload(e, 'reactive_avatar', index);
        
        previewDiv.onclick = () => uploadInput.click();
        previewDiv.title = "Click to upload avatar";
        previewDiv.style.cursor = 'pointer';

        const keywordInput = document.createElement('input');
        keywordInput.type = 'text';
        keywordInput.placeholder = 'Keywords (comma-separated)';
        keywordInput.value = data.keyword;
        keywordInput.onchange = (e) => {
            this.creator.currentNpcData.dialogue_avatars.reactive[index].keyword = e.target.value;
        };
        
        const removeButton = document.createElement('button');
        removeButton.textContent = 'X';
        removeButton.onclick = () => {
            this.creator.currentNpcData.dialogue_avatars.reactive.splice(index, 1);
            this.updateReactiveAvatarList();
        };
        
        entryDiv.appendChild(previewDiv);
        entryDiv.appendChild(uploadInput);
        entryDiv.appendChild(keywordInput);
        entryDiv.appendChild(removeButton);
        
        this.reactiveAvatarContainer.appendChild(entryDiv);
    }

    updateReactiveAvatarList() {
        this.reactiveAvatarContainer.innerHTML = '';
        this.creator.currentNpcData.dialogue_avatars.reactive.forEach(data => {
            this._addReactiveAvatarEntry(data);
        });
    }

    updateMapSpritePreview(customUrl = null) {
        const ctx = this.fields.mapSpritePreview.getContext('2d');
        ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
        const spriteData = this.creator.currentNpcData.map_sprite;

        if (spriteData.type === 'custom' && (customUrl || (typeof spriteData.source === 'string' && spriteData.source.startsWith('data:')))) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0, SPRITE_SIZE, SPRITE_SIZE);
            img.src = customUrl || spriteData.source;
        } else if (spriteData.type === 'spritesheet') {
            if (this.spriteSheetAsset?.complete) {
                const sx = spriteData.source * SPRITE_SIZE;
                ctx.drawImage(this.spriteSheetAsset, sx, 0, SPRITE_SIZE, SPRITE_SIZE, 0, 0, SPRITE_SIZE, SPRITE_SIZE);
            } else {
                // Spritesheet not loaded yet, draw a placeholder
                ctx.fillStyle = '#3B322C';
                ctx.fillRect(0,0,SPRITE_SIZE, SPRITE_SIZE);
                ctx.fillStyle = 'white';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('Loading...', SPRITE_SIZE/2, SPRITE_SIZE/2);
            }
        }
    }

    updateMainAvatarPreview(dataUrl) {
        if (dataUrl) {
            this.fields.mainAvatarPreview.src = dataUrl;
        } else {
            this.fields.mainAvatarPreview.src = '';
        }
    }
    
    updateReactiveAvatarPreview(index, dataUrl) {
        const entry = this.reactiveAvatarContainer.children[index];
        if (entry) {
            const img = entry.querySelector('img');
            img.src = dataUrl;
        }
    }

    _createInventoryManager(parent) {
        const label = document.createElement('label');
        label.textContent = "Starting Inventory";
        parent.appendChild(label);

        this.inventoryContainer = document.createElement('div');
        this.inventoryContainer.id = 'npc-creator-inventory';
        this.inventoryContainer.style.display = 'flex';
        this.inventoryContainer.style.flexDirection = 'column';
        this.inventoryContainer.style.gap = '6px';
        parent.appendChild(this.inventoryContainer);

        const addButton = document.createElement('button');
        addButton.textContent = '+ Add Item';
        addButton.style.marginTop = '4px';
        addButton.onclick = () => this._addInventoryCard();
        parent.appendChild(addButton);
    }

    _addInventoryCard(data = { name: 'Red Potion', type: 'consumable', heal: 20, bonusAtk: 0, bonusDef: 0, cost: 20, value: 14, description: 'Heals some HP', count: 1 }) {
        const card = document.createElement('div');
        card.className = 'npc-inventory-card';
        card.style.border = '1px solid #725c4d';
        card.style.padding = '6px';
        card.style.borderRadius = '4px';
        card.style.background = '#3c322c';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '4px';

        // Row 1: Name & Trash
        const row1 = document.createElement('div');
        row1.style.display = 'flex';
        row1.style.justifyContent = 'space-between';
        row1.style.alignItems = 'center';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Item Name';
        nameInput.value = data.name || '';
        nameInput.style.width = '80%';
        nameInput.style.fontSize = '0.85em';
        nameInput.style.padding = '2px 4px';
        row1.appendChild(nameInput);

        const trashBtn = document.createElement('button');
        trashBtn.textContent = '🗑️';
        trashBtn.style.background = 'transparent';
        trashBtn.style.border = 'none';
        trashBtn.style.padding = '0';
        trashBtn.style.color = '#ff8888';
        trashBtn.style.fontSize = '1em';
        trashBtn.style.cursor = 'pointer';
        trashBtn.onclick = () => card.remove();
        row1.appendChild(trashBtn);
        card.appendChild(row1);

        // Row 2: Type & Count
        const row2 = document.createElement('div');
        row2.style.display = 'flex';
        row2.style.gap = '4px';

        const typeSelect = document.createElement('select');
        typeSelect.style.width = '55%';
        typeSelect.style.background = '#2c2420';
        typeSelect.style.color = '#efebe0';
        typeSelect.style.border = '1px solid #725c4d';
        typeSelect.style.borderRadius = '3px';
        typeSelect.style.fontSize = '0.8em';
        typeSelect.style.padding = '2px';

        const optCons = document.createElement('option');
        optCons.value = 'consumable';
        optCons.textContent = 'Consumable';
        const optWep = document.createElement('option');
        optWep.value = 'weapon';
        optWep.textContent = 'Weapon';
        const optShld = document.createElement('option');
        optShld.value = 'shield';
        optShld.textContent = 'Shield';

        typeSelect.appendChild(optCons);
        typeSelect.appendChild(optWep);
        typeSelect.appendChild(optShld);
        typeSelect.value = data.type || 'consumable';
        row2.appendChild(typeSelect);

        const countInput = document.createElement('input');
        countInput.type = 'number';
        countInput.placeholder = 'Count';
        countInput.value = data.count || 1;
        countInput.min = '1';
        countInput.style.width = '45%';
        countInput.style.background = '#2c2420';
        countInput.style.color = '#efebe0';
        countInput.style.border = '1px solid #725c4d';
        countInput.style.borderRadius = '3px';
        countInput.style.fontSize = '0.8em';
        countInput.style.padding = '2px';
        row2.appendChild(countInput);
        card.appendChild(row2);

        // Row 3: Stat & Cost
        const row3 = document.createElement('div');
        row3.style.display = 'flex';
        row3.style.gap = '4px';

        const valInput = document.createElement('input');
        valInput.type = 'number';
        valInput.placeholder = 'Heal/Atk/Def';
        const statValue = data.heal || data.bonusAtk || data.bonusDef || 0;
        valInput.value = statValue;
        valInput.style.width = '50%';
        valInput.style.background = '#2c2420';
        valInput.style.color = '#efebe0';
        valInput.style.border = '1px solid #725c4d';
        valInput.style.borderRadius = '3px';
        valInput.style.fontSize = '0.8em';
        valInput.style.padding = '2px';
        row3.appendChild(valInput);

        const costInput = document.createElement('input');
        costInput.type = 'number';
        costInput.placeholder = 'Cost';
        costInput.value = data.cost || 0;
        costInput.style.width = '50%';
        costInput.style.background = '#2c2420';
        costInput.style.color = '#efebe0';
        costInput.style.border = '1px solid #725c4d';
        costInput.style.borderRadius = '3px';
        costInput.style.fontSize = '0.8em';
        costInput.style.padding = '2px';
        row3.appendChild(costInput);
        card.appendChild(row3);

        // Desc line
        const descInput = document.createElement('input');
        descInput.type = 'text';
        descInput.placeholder = 'Description';
        descInput.value = data.description || '';
        descInput.style.width = '100%';
        descInput.style.borderRadius = '3px';
        descInput.style.fontSize = '0.8em';
        descInput.style.padding = '2px';
        descInput.style.background = '#2c2420';
        descInput.style.color = '#efebe0';
        descInput.style.border = '1px solid #725c4d';
        descInput.style.boxSizing = 'border-box';
        card.appendChild(descInput);

        card.inputs = {
            nameInput,
            typeSelect,
            countInput,
            valInput,
            costInput,
            descInput
        };

        this.inventoryContainer.appendChild(card);
    }

    _createDialogueBranchesManager(parent) {
        const label = document.createElement('label');
        label.textContent = "Dialogue Branches";
        parent.appendChild(label);

        this.branchesContainer = document.createElement('div');
        this.branchesContainer.id = 'npc-creator-branches';
        this.branchesContainer.style.display = 'flex';
        this.branchesContainer.style.flexDirection = 'column';
        this.branchesContainer.style.gap = '6px';
        parent.appendChild(this.branchesContainer);

        const addButton = document.createElement('button');
        addButton.textContent = '+ Add Choice Option';
        addButton.style.marginTop = '4px';
        addButton.onclick = () => this._addBranchCard();
        parent.appendChild(addButton);
    }

    _addBranchCard(data = { text: 'Ask about path', reply: 'Follow the river to the north.', action: 'none', actionValue: '' }) {
        const card = document.createElement('div');
        card.className = 'npc-branch-card';
        card.style.border = '1px solid #725c4d';
        card.style.padding = '6px';
        card.style.borderRadius = '4px';
        card.style.background = '#40342c';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '4px';

        // Row 1: Header/Trash
        const row1 = document.createElement('div');
        row1.style.display = 'flex';
        row1.style.justifyContent = 'space-between';
        row1.style.alignItems = 'center';

        const headerSpan = document.createElement('strong');
        headerSpan.textContent = 'Choice Branch';
        headerSpan.style.fontSize = '0.8em';
        headerSpan.style.color = '#d4c8a0';
        row1.appendChild(headerSpan);

        const trashBtn = document.createElement('button');
        trashBtn.textContent = '🗑️';
        trashBtn.style.background = 'transparent';
        trashBtn.style.border = 'none';
        trashBtn.style.padding = '0';
        trashBtn.style.color = '#ff8888';
        trashBtn.style.fontSize = '1em';
        trashBtn.style.cursor = 'pointer';
        trashBtn.onclick = () => card.remove();
        row1.appendChild(trashBtn);
        card.appendChild(row1);

        // Row 2: Choices Text
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.placeholder = 'Choice Text (e.g. Ask for power)';
        textInput.value = data.text || '';
        textInput.style.fontSize = '0.85em';
        textInput.style.padding = '2px 4px';
        textInput.style.boxSizing = 'border-box';
        card.appendChild(textInput);

        // Row 3: Reply Text
        const replyText = document.createElement('textarea');
        replyText.placeholder = 'NPC Reply Message';
        replyText.value = data.reply || '';
        replyText.style.fontSize = '0.8em';
        replyText.style.padding = '2px 4px';
        replyText.style.minHeight = '35px';
        replyText.style.boxSizing = 'border-box';
        card.appendChild(replyText);

        // Row 4: Action & Value
        const row4 = document.createElement('div');
        row4.style.display = 'flex';
        row4.style.gap = '4px';
        row4.style.alignItems = 'center';

        const actionSelect = document.createElement('select');
        actionSelect.style.width = '50%';
        actionSelect.style.background = '#2c2420';
        actionSelect.style.color = '#efebe0';
        actionSelect.style.border = '1px solid #725c4d';
        actionSelect.style.borderRadius = '3px';
        actionSelect.style.fontSize = '0.8em';
        actionSelect.style.padding = '2px';

        const optNone = document.createElement('option');
        optNone.value = 'none';
        optNone.textContent = 'Talk Only';
        const optGive = document.createElement('option');
        optGive.value = 'give_item';
        optGive.textContent = 'Give Item';
        const optHeal = document.createElement('option');
        optHeal.value = 'heal';
        optHeal.textContent = 'Heal Player';
        const optCombat = document.createElement('option');
        optCombat.value = 'combat';
        optCombat.textContent = 'Trigger Combat';

        actionSelect.appendChild(optNone);
        actionSelect.appendChild(optGive);
        actionSelect.appendChild(optHeal);
        actionSelect.appendChild(optCombat);
        actionSelect.value = data.action || 'none';
        row4.appendChild(actionSelect);

        const valInput = document.createElement('input');
        valInput.type = 'text';
        valInput.placeholder = 'Item Name';
        valInput.value = data.actionValue || '';
        valInput.style.width = '50%';
        valInput.style.background = '#2c2420';
        valInput.style.color = '#efebe0';
        valInput.style.border = '1px solid #725c4d';
        valInput.style.borderRadius = '3px';
        valInput.style.fontSize = '0.8em';
        valInput.style.padding = '2px';
        row4.appendChild(valInput);

        card.appendChild(row4);

        const toggleValInput = () => {
            if (actionSelect.value === 'give_item') {
                valInput.style.display = 'block';
            } else {
                valInput.style.display = 'none';
            }
        };
        actionSelect.onchange = toggleValInput;
        toggleValInput();

        card.inputs = {
            textInput,
            replyText,
            actionSelect,
            valInput
        };

        this.branchesContainer.appendChild(card);
    }

    populate(npcData) {
        this.fields.name.value = npcData.name || '';
        this.fields.description.value = npcData.description || '';
        this.fields.first_mes.value = npcData.first_mes || '';

        // stats
        const stats = npcData.stats || { level: 1, hp: 50, maxHp: 50, atk: 10, def: 5, speed: 120 };
        this.fields.broadType.value = npcData.broadType || 'villager';
        this.fields.level.value = stats.level ?? 1;
        this.fields.hp.value = stats.hp ?? 50;
        this.fields.maxHp.value = stats.maxHp ?? 50;
        this.fields.atk.value = stats.atk ?? 10;
        this.fields.def.value = stats.def ?? 5;
        this.fields.speed.value = stats.speed ?? 120;

        // items
        this.inventoryContainer.innerHTML = '';
        (npcData.inventory || []).forEach(it => {
            this._addInventoryCard(it);
        });

        // branches
        this.branchesContainer.innerHTML = '';
        (npcData.dialogue_branches || []).forEach(br => {
            this._addBranchCard(br);
        });

        this.updateMapSpritePreview(npcData.map_sprite.type === 'custom' ? npcData.map_sprite.source : null);
        this.updateMainAvatarPreview(npcData.dialogue_avatars.main);
        
        this.reactiveAvatarContainer.innerHTML = '';
        (npcData.dialogue_avatars.reactive || []).forEach(entryData => {
            this._addReactiveAvatarEntry(entryData);
        });
    }

    collectData() {
        const data = this.creator.currentNpcData; // Preserve imagery DataURLs
        data.name = this.fields.name.value;
        data.description = this.fields.description.value;
        data.first_mes = this.fields.first_mes.value;

        // collector role and stats
        data.broadType = this.fields.broadType.value;
        data.stats = {
            level: parseInt(this.fields.level.value, 10) || 1,
            hp: parseInt(this.fields.hp.value, 10) || 50,
            maxHp: parseInt(this.fields.maxHp.value, 10) || 50,
            atk: parseInt(this.fields.atk.value, 10) || 10,
            def: parseInt(this.fields.def.value, 10) || 5,
            speed: parseInt(this.fields.speed.value, 10) || 120
        };

        // collector inventory starting items
        data.inventory = [];
        if (this.inventoryContainer) {
            const cards = this.inventoryContainer.querySelectorAll('.npc-inventory-card');
            cards.forEach(card => {
                if (card.inputs) {
                    const itemName = card.inputs.nameInput.value;
                    if (!itemName) return;
                    const itemType = card.inputs.typeSelect.value;
                    const count = parseInt(card.inputs.countInput.value, 10) || 1;
                    const valValue = parseInt(card.inputs.valInput.value, 10) || 0;
                    const costAmt = parseInt(card.inputs.costInput.value, 10) || 0;
                    const resaleVal = Math.floor(costAmt * 0.7);
                    const itemDesc = card.inputs.descInput.value;

                    const itemObj = {
                        name: itemName,
                        type: itemType,
                        cost: costAmt,
                        value: resaleVal,
                        description: itemDesc,
                        count: count
                    };
                    if (itemType === 'consumable') {
                        itemObj.heal = valValue;
                    } else if (itemType === 'weapon') {
                        itemObj.bonusAtk = valValue;
                    } else if (itemType === 'shield') {
                        itemObj.bonusDef = valValue;
                    }

                    data.inventory.push(itemObj);
                }
            });
        }

        // collector dialogue branches options
        data.dialogue_branches = [];
        if (this.branchesContainer) {
            const cards = this.branchesContainer.querySelectorAll('.npc-branch-card');
            cards.forEach(card => {
                if (card.inputs) {
                    const choiceText = card.inputs.textInput.value;
                    const replyText = card.inputs.replyText.value;
                    if (!choiceText || !replyText) return;

                    data.dialogue_branches.push({
                        text: choiceText,
                        reply: replyText,
                        action: card.inputs.actionSelect.value,
                        actionValue: card.inputs.valInput.value
                    });
                }
            });
        }
        
        if (!data.name) {
            CustomDialog.alert("NPC Name is required.", "Validation Error");
            return null;
        }
        return data;
    }
}

export default NpcCreatorUI;