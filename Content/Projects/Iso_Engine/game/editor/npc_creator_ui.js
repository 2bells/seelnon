// scripts/extensions/rpg/game/editor/npc_creator_ui.js
console.log("rpg/game/editor/npc_creator_ui.js loaded");

import { getAllProjectiles } from '../combat/projectiles.js';
import { getGlobalItemDatabase } from './bank_editor.js';
import { getAllAbilities } from '../combat/ability_system.js';

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
        opsButtons.style.gap = '6px';
        opsButtons.style.width = '100%';
        opsButtons.style.alignItems = 'center';
        
        const newButton = document.createElement('button');
        newButton.textContent = 'New';
        newButton.className = 'abilities-btn';
        newButton.style.flex = '1';
        newButton.style.padding = '5px';
        newButton.onclick = () => this.creator.reset();
        opsButtons.appendChild(newButton);

        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save (.json)';
        saveButton.className = 'abilities-btn';
        saveButton.style.flex = '1';
        saveButton.style.padding = '5px';
        saveButton.onclick = () => this.creator.save();
        opsButtons.appendChild(saveButton);
        
        const npcLoadId = 'rpg-npc-load-file-upload-input';
        const loadInput = document.createElement('input');
        loadInput.id = npcLoadId;
        loadInput.type = 'file';
        loadInput.accept = '.json';
        loadInput.style.display = 'none';
        loadInput.onchange = (e) => this.creator.load(e);
        this.fields.loadInput = loadInput;
        opsButtons.appendChild(loadInput);
        
        const loadButton = document.createElement('label');
        loadButton.htmlFor = npcLoadId;
        loadButton.className = 'abilities-btn';
        loadButton.style.flex = '1';
        loadButton.style.display = 'inline-block';
        loadButton.style.textAlign = 'center';
        loadButton.style.cursor = 'pointer';
        loadButton.style.padding = '5px 0';
        loadButton.style.fontSize = '12px';
        loadButton.style.lineHeight = 'normal';
        loadButton.style.margin = '0';
        loadButton.textContent = 'Load (.json)';
        opsButtons.appendChild(loadButton);
        opsSection.appendChild(opsButtons);

        // --- Core Info ---
        const coreSection = this._createSection(content, 'Core Information');
        this.fields.name = this._createFormRow(coreSection, 'Name', 'text', 'name');
        this.fields.description = this._createFormRow(coreSection, 'Description', 'textarea', 'description', { minHeight: '52px' });
        this.fields.first_mes = this._createFormRow(coreSection, 'Greeting / First Message', 'textarea', 'first_mes', { minHeight: '52px' });

        // --- Stats & Role ---
        const statsSection = this._createSection(content, 'Stats & Role');
        this.fields.broadType = this._createFormRow(statsSection, 'Role', 'select', 'broadType', {
            options: [
                { value: 'villager', text: 'Villager' },
                { value: 'merchant', text: 'Merchant' },
                { value: 'guard', text: 'Guard' },
                { value: 'enemy', text: 'Enemy' },
                { value: 'chest', text: 'Chest / Loot Container' },
                { value: 'turret', text: 'Turret / Emitter' }
            ]
        });

        this.fields.level = this._createFormRow(statsSection, 'Level', 'number', 'level', { min: 1, max: 100 });
        this.fields.hp = this._createFormRow(statsSection, 'HP', 'number', 'hp', { min: 1 });
        this.fields.maxHp = this._createFormRow(statsSection, 'Max HP', 'number', 'maxHp', { min: 1 });
        this.fields.atk = this._createFormRow(statsSection, 'Attack', 'number', 'atk', { min: 0 });
        this.fields.def = this._createFormRow(statsSection, 'Defense', 'number', 'def', { min: 0 });
        this.fields.speed = this._createFormRow(statsSection, 'Speed', 'number', 'speed', { min: 1 });

        // --- Emitter & Projectile Settings ---
        const emitterSection = this._createSection(content, 'Emitter & Projectile Settings');
        emitterSection.id = 'npc-creator-emitter-section';
        emitterSection.style.display = 'none';

        this.fields.presetId = this._createFormRow(emitterSection, 'Link Emitter Preset', 'select', 'presetId', { options: [] });
        this.fields.showArea = this._createFormRow(emitterSection, 'Show Range Circle', 'checkbox', 'showArea', { checked: true });
        this.fields.notify = this._createFormRow(emitterSection, 'Notify/Warn Discharge', 'checkbox', 'notify', { checked: false });
        this.fields.cooldown = this._createFormRow(emitterSection, 'Cooldown Interval (s)', 'number', 'cooldown', { min: 0.1, step: 0.1 });
        this.fields.range = this._createFormRow(emitterSection, 'Detection Range (px)', 'number', 'range', { min: 20 });
        
        this.fields.projectileType = this._createFormRow(emitterSection, 'Projectile Behavior', 'select', 'projectileType', {
            options: [
                { value: 'standard', text: 'Standard Linear Shot' },
                { value: 'seeking', text: 'Scurrilous Homing/Seeking' },
                { value: 'circular', text: 'Spiral / Orbital Orbit' },
                { value: 'sinewave', text: 'Oscillating Sine Wave' },
                { value: 'starburst', text: 'Starburst Nova Ring' }
            ]
        });

        this.fields.projectileSpeed = this._createFormRow(emitterSection, 'Projectile Velocity', 'number', 'projectileSpeed', { min: 10 });
        this.fields.burstCount = this._createFormRow(emitterSection, 'Burst Bullet Count', 'number', 'burstCount', { min: 1 });
        this.fields.damage = this._createFormRow(emitterSection, 'Damage Rating', 'number', 'damage', { min: 1 });
        this.fields.projectileColor = this._createFormRow(emitterSection, 'Glow Spark Color Hex', 'text', 'projectileColor');

        // Toggle on Role Select Change
        this.fields.broadType.addEventListener('change', () => {
            if (this.fields.broadType.value === 'turret') {
                emitterSection.style.display = 'block';
            } else {
                emitterSection.style.display = 'none';
            }
        });

        // --- Starting Inventory & Abilities ---
        const invSection = this._createSection(content, 'Starting Inventory & Abilities');
        this._createInventoryManager(invSection);
        this._createSlottedAbilitiesManager(invSection);

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
        section.className = 'abilities-editor-section'; // Unified with ability creator section aesthetic
        const h4 = document.createElement('h4');
        h4.textContent = title;
        section.appendChild(h4);
        parent.appendChild(section);
        return section;
    }

    _createFormRow(parent, labelText, inputType, fieldId, props = {}) {
        const row = document.createElement('div');
        row.className = 'abilities-form-row';

        const label = document.createElement('label');
        label.textContent = labelText;
        label.htmlFor = `npc-creator-${fieldId}`;
        label.style.fontSize = '0.85em';
        label.style.color = '#D4C8A0';
        label.style.flex = '1';
        row.appendChild(label);

        let input;
        if (inputType === 'select') {
            input = document.createElement('select');
            if (props.options) {
                props.options.forEach(o => {
                    const opt = document.createElement('option');
                    opt.value = o.value;
                    opt.textContent = o.text;
                    input.appendChild(opt);
                });
            }
        } else if (inputType === 'checkbox') {
            input = document.createElement('input');
            input.type = 'checkbox';
            if (props.checked !== undefined) input.checked = props.checked;
        } else if (inputType === 'textarea') {
            const areaRow = document.createElement('div');
            areaRow.style.display = 'flex';
            areaRow.style.flexDirection = 'column';
            areaRow.style.gap = '4px';
            areaRow.style.marginBottom = '6px';
            areaRow.style.width = '100%';

            const areaLabel = document.createElement('label');
            areaLabel.style.fontSize = '0.85em';
            areaLabel.style.color = '#D4C8A0';
            areaLabel.style.fontWeight = 'bold';
            areaLabel.textContent = labelText;
            areaLabel.htmlFor = `npc-creator-${fieldId}`;
            areaRow.appendChild(areaLabel);

            input = document.createElement('textarea');
            input.id = `npc-creator-${fieldId}`;
            input.style.width = '100%';
            input.style.background = '#3B322C';
            input.style.color = '#EFEBE0';
            input.style.border = '1px solid #8C6D56';
            input.style.borderRadius = '4px';
            input.style.padding = '5px';
            input.style.boxSizing = 'border-box';
            input.style.fontSize = '0.9em';
            input.style.minHeight = props.minHeight || '52px';
            input.style.resize = 'vertical';
            input.style.fontFamily = 'inherit';

            areaRow.appendChild(input);
            parent.appendChild(areaRow);
            this.fields[fieldId] = input;
            return input;
        } else {
            input = document.createElement('input');
            input.type = inputType;
            if (props.step) input.step = props.step;
            if (props.min !== undefined) input.min = props.min;
            if (props.max !== undefined) input.max = props.max;
        }

        input.id = `npc-creator-${fieldId}`;
        
        if (inputType === 'select' || inputType === 'text' || inputType === 'number') {
            input.style.background = '#3B322C';
            input.style.color = '#EFEBE0';
            input.style.border = '1px solid #8C6D56';
            input.style.borderRadius = '4px';
            input.style.padding = '3px 6px';
            input.style.fontSize = '0.9em';
            input.style.boxSizing = 'border-box';
            input.style.flex = '1.2';
        } else if (inputType === 'checkbox') {
            input.style.cursor = 'pointer';
            input.style.width = '16px';
            input.style.height = '16px';
            input.style.accentColor = '#8C6D56';
        }

        row.appendChild(input);
        parent.appendChild(row);
        this.fields[fieldId] = input;
        return input;
    }
    
    _createMapSpritePicker(parent) {
        const containerLabel = document.createElement('label');
        containerLabel.style.fontSize = '0.85em';
        containerLabel.style.color = '#D4C8A0';
        containerLabel.style.fontWeight = 'bold';
        containerLabel.style.marginTop = '8px';
        containerLabel.textContent = "Map Sprite (64x64)";
        parent.appendChild(containerLabel);

        const container = document.createElement('div');
        container.className = 'npc-creator-sprite-picker';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.gap = '10px';
        container.style.marginTop = '4px';
        
        const previewDiv = document.createElement('div');
        previewDiv.className = 'npc-sprite-preview-container';
        previewDiv.title = 'Click to select from spritesheet';
        previewDiv.style.cursor = 'pointer';
        previewDiv.style.width = '64px';
        previewDiv.style.height = '64px';
        previewDiv.style.border = '1px dashed #8C6D56';
        previewDiv.style.borderRadius = '4px';
        previewDiv.style.backgroundColor = '#2C2420';
        previewDiv.style.display = 'flex';
        previewDiv.style.justifyContent = 'center';
        previewDiv.style.alignItems = 'center';

        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = SPRITE_SIZE;
        previewCanvas.height = SPRITE_SIZE;
        previewCanvas.style.maxWidth = '100%';
        previewCanvas.style.maxHeight = '100%';
        previewDiv.appendChild(previewCanvas);
        this.fields.mapSpritePreview = previewCanvas;
        
        previewDiv.onclick = () => this._showSpriteSelectorPopup();
        
        const uploadDiv = document.createElement('div');
        uploadDiv.style.display = 'flex';
        uploadDiv.style.flexDirection = 'column';
        uploadDiv.style.justifyContent = 'center';
        uploadDiv.style.gap = '5px';
        
        const npcMapSpriteId = 'rpg-npc-map-sprite-file-upload-input';
        const uploadInput = document.createElement('input');
        uploadInput.id = npcMapSpriteId;
        uploadInput.type = 'file';
        uploadInput.accept = 'image/png';
        uploadInput.style.display = 'none';
        uploadInput.onchange = (e) => this.creator.handleImageUpload(e, 'map_sprite');
        
        const uploadButton = document.createElement('label');
        uploadButton.htmlFor = npcMapSpriteId;
        uploadButton.className = 'abilities-btn';
        uploadButton.style.padding = '4px 8px';
        uploadButton.style.fontSize = '10px';
        uploadButton.style.display = 'inline-block';
        uploadButton.style.textAlign = 'center';
        uploadButton.style.cursor = 'pointer';
        uploadButton.style.margin = '0';
        uploadButton.textContent = 'Upload Custom';
        
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

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                closePopup();
            }
        };

        selectorCanvas.onclick = (e) => {
            const rect = selectorCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const spriteIndex = Math.floor(x / SPRITE_SIZE);
            
            this.creator.currentNpcData.map_sprite = { type: 'spritesheet', source: spriteIndex };
            this.updateMapSpritePreview();
            closePopup();
        };

        overlay.appendChild(popup);
        document.body.appendChild(overlay);
    }

    _createMainAvatarPicker(parent) {
        const containerLabel = document.createElement('label');
        containerLabel.style.fontSize = '0.85em';
        containerLabel.style.color = '#D4C8A0';
        containerLabel.style.fontWeight = 'bold';
        containerLabel.style.marginTop = '8px';
        containerLabel.textContent = "Main Dialogue Avatar";
        parent.appendChild(containerLabel);
        
        const container = document.createElement('div');
        container.className = 'npc-creator-avatar-picker';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.gap = '10px';
        container.style.marginTop = '4px';

        const previewDiv = document.createElement('div');
        previewDiv.className = 'npc-avatar-preview-container';
        previewDiv.style.width = '64px';
        previewDiv.style.height = '64px';
        previewDiv.style.border = '1px dashed #8C6D56';
        previewDiv.style.borderRadius = '4px';
        previewDiv.style.backgroundColor = '#2C2420';
        previewDiv.style.display = 'flex';
        previewDiv.style.justifyContent = 'center';
        previewDiv.style.alignItems = 'center';
        previewDiv.style.overflow = 'hidden';

        const img = document.createElement('img');
        img.alt = 'Main Avatar';
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        previewDiv.appendChild(img);
        this.fields.mainAvatarPreview = img;
        
        const npcMainAvatarId = 'rpg-npc-main-avatar-file-upload-input';
        const uploadInput = document.createElement('input');
        uploadInput.id = npcMainAvatarId;
        uploadInput.type = 'file';
        uploadInput.accept = 'image/png, image/jpeg, image/webp';
        uploadInput.style.display = 'none';
        uploadInput.onchange = (e) => this.creator.handleImageUpload(e, 'main_avatar');

        const uploadButton = document.createElement('label');
        uploadButton.htmlFor = npcMainAvatarId;
        uploadButton.className = 'abilities-btn';
        uploadButton.style.padding = '4px 8px';
        uploadButton.style.fontSize = '10px';
        uploadButton.style.display = 'inline-block';
        uploadButton.style.textAlign = 'center';
        uploadButton.style.cursor = 'pointer';
        uploadButton.style.margin = '0';
        uploadButton.textContent = 'Upload Main Avatar';

        container.appendChild(previewDiv);
        container.appendChild(uploadButton);
        container.appendChild(uploadInput);
        parent.appendChild(container);
    }
    
    _createReactiveAvatarManager(parent) {
        const label = document.createElement('label');
        label.textContent = "Reactive Avatars";
        label.style.marginTop = '8px';
        parent.appendChild(label);

        this.reactiveAvatarContainer = document.createElement('div');
        this.reactiveAvatarContainer.style.display = 'flex';
        this.reactiveAvatarContainer.style.flexDirection = 'column';
        this.reactiveAvatarContainer.style.gap = '6px';
        this.reactiveAvatarContainer.style.marginTop = '4px';
        parent.appendChild(this.reactiveAvatarContainer);

        const addButton = document.createElement('button');
        addButton.textContent = '+ Add Reactive Avatar';
        addButton.className = 'abilities-btn';
        addButton.style.marginTop = '6px';
        addButton.style.width = '100%';
        addButton.style.padding = '5px';
        addButton.style.fontSize = '11px';
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
        entryDiv.style.display = 'flex';
        entryDiv.style.alignItems = 'center';
        entryDiv.style.gap = '8px';
        entryDiv.style.backgroundColor = '#2C2420';
        entryDiv.style.border = '1px solid #5A4B3E';
        entryDiv.style.padding = '5px';
        entryDiv.style.borderRadius = '4px';
        
        const npcReactiveId = `rpg-npc-reactive-avatar-file-upload-input-${index}-${Date.now()}`;
        const previewDiv = document.createElement('label');
        previewDiv.htmlFor = npcReactiveId;
        previewDiv.className = 'npc-avatar-preview-container';
        previewDiv.style.width = '32px';
        previewDiv.style.height = '32px';
        previewDiv.style.border = '1px dashed #8C6D56';
        previewDiv.style.borderRadius = '3px';
        previewDiv.style.backgroundColor = '#3B322C';
        previewDiv.style.display = 'flex';
        previewDiv.style.justifyContent = 'center';
        previewDiv.style.alignItems = 'center';
        previewDiv.style.cursor = 'pointer';
        previewDiv.style.overflow = 'hidden';
        previewDiv.title = "Click to upload avatar";

        const img = document.createElement('img');
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        if (data.dataUrl) img.src = data.dataUrl;
        previewDiv.appendChild(img);
        
        const uploadInput = document.createElement('input');
        uploadInput.id = npcReactiveId;
        uploadInput.type = 'file';
        uploadInput.accept = 'image/png, image/jpeg, image/webp';
        uploadInput.style.display = 'none';
        uploadInput.onchange = (e) => this.creator.handleImageUpload(e, 'reactive_avatar', index);

        const keywordInput = document.createElement('input');
        keywordInput.type = 'text';
        keywordInput.placeholder = 'Keywords (comma-separated)';
        keywordInput.value = data.keyword;
        keywordInput.style.flex = '1';
        keywordInput.style.background = '#3B322C';
        keywordInput.style.color = '#EFEBE0';
        keywordInput.style.border = '1px solid #8C6D56';
        keywordInput.style.borderRadius = '3px';
        keywordInput.style.padding = '3px 6px';
        keywordInput.style.fontSize = '11px';
        keywordInput.style.fontFamily = 'inherit';
        keywordInput.onchange = (e) => {
            this.creator.currentNpcData.dialogue_avatars.reactive[index].keyword = e.target.value;
        };
        
        const removeButton = document.createElement('button');
        removeButton.textContent = '✖';
        removeButton.title = 'Remove Avatar';
        removeButton.style.padding = '3px 6px';
        removeButton.style.fontSize = '11px';
        removeButton.style.backgroundColor = '#5C2C28';
        removeButton.style.color = '#FFDADA';
        removeButton.style.border = '1px solid #7D3833';
        removeButton.style.borderRadius = '3px';
        removeButton.style.cursor = 'pointer';
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
                ctx.fillStyle = '#2C2420';
                ctx.fillRect(0,0,SPRITE_SIZE, SPRITE_SIZE);
                ctx.fillStyle = 'white';
                ctx.font = '10px Arial';
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
        label.style.display = 'block';
        label.style.fontSize = '12px';
        label.style.color = '#D4C8A0';
        parent.appendChild(label);

        this.inventoryContainer = document.createElement('div');
        this.inventoryContainer.id = 'npc-creator-inventory';
        this.inventoryContainer.style.display = 'flex';
        this.inventoryContainer.style.flexDirection = 'column';
        this.inventoryContainer.style.gap = '6px';
        this.inventoryContainer.style.marginTop = '4px';
        parent.appendChild(this.inventoryContainer);

        const addButton = document.createElement('button');
        addButton.textContent = '+ Add Item';
        addButton.className = 'abilities-btn';
        addButton.style.marginTop = '6px';
        addButton.style.width = '100%';
        addButton.style.padding = '5px';
        addButton.style.fontSize = '11px';
        addButton.onclick = () => this._addInventoryCard();
        parent.appendChild(addButton);
    }

    _createSlottedAbilitiesManager(parent) {
        const titleLabel = document.createElement('label');
        titleLabel.textContent = "Slotted Equipped Abilities (Enemies/Allies/NPCs)";
        titleLabel.style.marginTop = '12px';
        titleLabel.style.display = 'block';
        titleLabel.style.fontSize = '12px';
        titleLabel.style.color = '#D4C8A0';
        parent.appendChild(titleLabel);

        this.abilitySlotsContainer = document.createElement('div');
        this.abilitySlotsContainer.id = 'npc-creator-ability-slots';
        this.abilitySlotsContainer.style.display = 'flex';
        this.abilitySlotsContainer.style.flexDirection = 'column';
        this.abilitySlotsContainer.style.gap = '6px';
        this.abilitySlotsContainer.style.marginTop = '4px';
        parent.appendChild(this.abilitySlotsContainer);

        this.fields.abilitySlots = [];

        const addAbilityButton = document.createElement('button');
        addAbilityButton.textContent = '+ Add Custom Ability/Emitter';
        addAbilityButton.className = 'abilities-btn';
        addAbilityButton.style.marginTop = '6px';
        addAbilityButton.style.width = '100%';
        addAbilityButton.style.padding = '6px';
        addAbilityButton.style.fontFamily = 'inherit';
        addAbilityButton.style.fontSize = '11px';
        addAbilityButton.style.fontWeight = 'bold';
        addAbilityButton.onclick = () => {
            this._addAbilitySlotRow();
        };
        parent.appendChild(addAbilityButton);

        const designAbilitiesButton = document.createElement('button');
        designAbilitiesButton.textContent = '⚙️ Design Custom Ability Blueprints';
        designAbilitiesButton.style.marginTop = '6px';
        designAbilitiesButton.style.width = '100%';
        designAbilitiesButton.style.padding = '4px 6px';
        designAbilitiesButton.style.fontFamily = 'inherit';
        designAbilitiesButton.style.fontSize = '10px';
        designAbilitiesButton.style.backgroundColor = '#4A3D35';
        designAbilitiesButton.style.color = '#D4C8A0';
        designAbilitiesButton.style.border = '1px solid #5A4B3E';
        designAbilitiesButton.style.borderRadius = '4px';
        designAbilitiesButton.style.cursor = 'pointer';
        designAbilitiesButton.onclick = () => {
            if (this.creator.engine && this.creator.engine.editorManager) {
                this.creator.engine.editorManager.toggle('abilities');
            }
        };
        parent.appendChild(designAbilitiesButton);
    }

    _addAbilitySlotRow(initialValue = '') {
        const slotDiv = document.createElement('div');
        slotDiv.className = 'npc-ability-slot-row';
        slotDiv.style.display = 'flex';
        slotDiv.style.alignItems = 'center';
        slotDiv.style.gap = '6px';
        slotDiv.style.width = '100%';

        const slotLabel = document.createElement('span');
        slotLabel.className = 'slot-index-label';
        slotLabel.style.fontSize = '10px';
        slotLabel.style.color = '#8C6D56';
        slotLabel.style.width = '42px';
        slotLabel.style.fontWeight = 'bold';
        slotLabel.style.fontFamily = 'monospace';
        slotDiv.appendChild(slotLabel);

        const selectEl = document.createElement('select');
        selectEl.style.flex = '1';
        selectEl.style.background = '#2C2420';
        selectEl.style.color = '#EFEBE0';
        selectEl.style.border = '1px solid #725C4D';
        selectEl.style.borderRadius = '3px';
        selectEl.style.fontSize = '11px';
        selectEl.style.padding = '3px';
        selectEl.onfocus = () => this.refreshAbilityOptionDropdowns();

        const abilitiesList = getAllAbilities ? getAllAbilities() : {};
        selectEl.innerHTML = '<option value="">-- No Ability Slotted --</option>';
        Object.keys(abilitiesList).forEach(id => {
            const ab = abilitiesList[id];
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = `${ab.emoji || '☄️'} ${ab.name || id}`;
            selectEl.appendChild(opt);
        });
        selectEl.value = initialValue;

        const delBtn = document.createElement('button');
        delBtn.textContent = '✖';
        delBtn.title = 'Remove Slot';
        delBtn.style.padding = '2px 6px';
        delBtn.style.fontSize = '10px';
        delBtn.style.backgroundColor = '#5C2C28';
        delBtn.style.color = '#FFDADA';
        delBtn.style.border = '1px solid #7D3833';
        delBtn.style.borderRadius = '3px';
        delBtn.style.cursor = 'pointer';
        delBtn.style.display = 'flex';
        delBtn.style.alignItems = 'center';
        delBtn.style.justifyContent = 'center';
        delBtn.onclick = () => {
            slotDiv.remove();
            this.fields.abilitySlots = this.fields.abilitySlots.filter(s => s !== selectEl);
            this._updateAbilitySlotLabels();
        };

        slotDiv.appendChild(selectEl);
        slotDiv.appendChild(delBtn);

        this.abilitySlotsContainer.appendChild(slotDiv);
        this.fields.abilitySlots.push(selectEl);
        
        this._updateAbilitySlotLabels();
    }

    _updateAbilitySlotLabels() {
        const rows = this.abilitySlotsContainer.querySelectorAll('.npc-ability-slot-row');
        rows.forEach((row, i) => {
            const labelSpan = row.querySelector('.slot-index-label');
            if (labelSpan) {
                labelSpan.textContent = `Slot ${i + 1}`;
            }
        });
    }

    refreshAbilityOptionDropdowns() {
        if (!this.fields.abilitySlots) return;
        const abilitiesList = getAllAbilities ? getAllAbilities() : {};
        this.fields.abilitySlots.forEach((selectEl) => {
            const currentSelectedValue = selectEl.value;
            selectEl.innerHTML = '<option value="">-- No Ability Slotted --</option>';
            Object.keys(abilitiesList).forEach(id => {
                const ab = abilitiesList[id];
                const opt = document.createElement('option');
                opt.value = id;
                const prefix = ab.hasEmitter ? '[EMITTER]' : '[ABILITY]';
                opt.textContent = `${ab.emoji || '☄️'} ${prefix} ${ab.name || id}`;
                selectEl.appendChild(opt);
            });
            selectEl.value = currentSelectedValue;
        });
    }

    _addInventoryCard(data = { name: 'Red Potion', type: 'consumable', heal: 20, bonusAtk: 0, bonusDef: 0, cost: 20, value: 14, description: 'Heals some HP', count: 1 }) {
        const card = document.createElement('div');
        card.className = 'npc-inventory-card';
        card.style.border = '1px solid #5A4B3E';
        card.style.padding = '6px';
        card.style.borderRadius = '4px';
        card.style.background = '#2C2420';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '5px';

        const styleCardInput = (el) => {
            el.style.background = '#3B322C';
            el.style.color = '#EFEBE0';
            el.style.border = '1px solid #8C6D56';
            el.style.borderRadius = '3px';
            el.style.padding = '3px 4px';
            el.style.fontSize = '11px';
            el.style.fontFamily = 'inherit';
            el.style.boxSizing = 'border-box';
        };

        // Row 0: Bank Item Selector
        const row0 = document.createElement('div');
        row0.style.display = 'flex';
        row0.style.flexDirection = 'column';
        row0.style.marginBottom = '2px';

        const bankLabel = document.createElement('label');
        bankLabel.textContent = 'Or Template from Bank:';
        bankLabel.style.fontSize = '0.75em';
        bankLabel.style.color = '#D4C8A0';
        bankLabel.style.marginBottom = '2px';
        row0.appendChild(bankLabel);

        const bankSelect = document.createElement('select');
        bankSelect.style.width = '100%';
        styleCardInput(bankSelect);

        bankSelect.innerHTML = '<option value="">-- Manual/Custom Item --</option>';
        const engineCtx = this.creator ? this.creator.engine : window.engine;
        const db = getGlobalItemDatabase(engineCtx);
        if (db) {
            Object.keys(db).forEach(key => {
                const item = db[key];
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = `${item.emoji || '🎁'} ${item.name} (${item.type})`;
                bankSelect.appendChild(opt);
            });
        }
        row0.appendChild(bankSelect);
        card.appendChild(row0);

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
        styleCardInput(nameInput);
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
        styleCardInput(typeSelect);

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
        styleCardInput(countInput);
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
        styleCardInput(valInput);
        row3.appendChild(valInput);

        const costInput = document.createElement('input');
        costInput.type = 'number';
        costInput.placeholder = 'Cost';
        costInput.value = data.cost || 0;
        costInput.style.width = '50%';
        styleCardInput(costInput);
        row3.appendChild(costInput);
        card.appendChild(row3);

        // Desc line
        const descInput = document.createElement('input');
        descInput.type = 'text';
        descInput.placeholder = 'Description';
        descInput.value = data.description || '';
        descInput.style.width = '100%';
        styleCardInput(descInput);
        card.appendChild(descInput);

        bankSelect.onchange = () => {
            const val = bankSelect.value;
            if (val && db && db[val]) {
                const item = db[val];
                nameInput.value = item.name;
                typeSelect.value = item.type || 'consumable';
                valInput.value = item.heal || item.bonusAtk || item.bonusDef || item.passiveAtk || 0;
                costInput.value = item.cost || 0;
                descInput.value = item.description || '';
            }
        };

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
        label.style.display = 'block';
        label.style.fontSize = '12px';
        label.style.color = '#D4C8A0';
        parent.appendChild(label);

        this.branchesContainer = document.createElement('div');
        this.branchesContainer.id = 'npc-creator-branches';
        this.branchesContainer.style.display = 'flex';
        this.branchesContainer.style.flexDirection = 'column';
        this.branchesContainer.style.gap = '6px';
        this.branchesContainer.style.marginTop = '4px';
        parent.appendChild(this.branchesContainer);

        const addButton = document.createElement('button');
        addButton.textContent = '+ Add Choice Option';
        addButton.className = 'abilities-btn';
        addButton.style.marginTop = '6px';
        addButton.style.width = '100%';
        addButton.style.padding = '5px';
        addButton.style.fontSize = '11px';
        addButton.onclick = () => this._addBranchCard();
        parent.appendChild(addButton);
    }

    _addBranchCard(data = { text: 'Ask about path', reply: 'Follow the river to the north.', action: 'none', actionValue: '' }) {
        const card = document.createElement('div');
        card.className = 'npc-branch-card';
        card.style.border = '1px solid #5A4B3E';
        card.style.padding = '6px';
        card.style.borderRadius = '4px';
        card.style.background = '#2C2420';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '5px';

        const styleCardInput = (el) => {
            el.style.background = '#3B322C';
            el.style.color = '#EFEBE0';
            el.style.border = '1px solid #8C6D56';
            el.style.borderRadius = '3px';
            el.style.padding = '3px 4px';
            el.style.fontSize = '11px';
            el.style.fontFamily = 'inherit';
            el.style.boxSizing = 'border-box';
        };

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
        trashBtn.style.fontSize = '1.1em';
        trashBtn.style.cursor = 'pointer';
        trashBtn.onclick = () => card.remove();
        row1.appendChild(trashBtn);
        card.appendChild(row1);

        // Row 2: Choices Text
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.placeholder = 'Choice Text (e.g. Ask for power)';
        textInput.value = data.text || '';
        styleCardInput(textInput);
        textInput.style.width = '100%';
        card.appendChild(textInput);

        // Row 3: Reply Text
        const replyText = document.createElement('textarea');
        replyText.placeholder = 'NPC Reply Message';
        replyText.value = data.reply || '';
        styleCardInput(replyText);
        replyText.style.width = '100%';
        replyText.style.minHeight = '38px';
        replyText.style.resize = 'vertical';
        card.appendChild(replyText);

        // Row 4: Action & Value
        const row4 = document.createElement('div');
        row4.style.display = 'flex';
        row4.style.gap = '4px';
        row4.style.alignItems = 'center';

        const actionSelect = document.createElement('select');
        actionSelect.style.width = '50%';
        styleCardInput(actionSelect);

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
        styleCardInput(valInput);
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

        // emitter settings
        const emitterConfig = npcData.emitterConfig || {};

        const prSelect = this.fields.presetId;
        if (prSelect) {
            prSelect.innerHTML = '<option value="">-- Manual (Raw Fields) --</option>';
            const presets = getAllProjectiles();
            Object.keys(presets).forEach(k => {
                const opt = document.createElement('option');
                opt.value = k;
                opt.textContent = presets[k].name;
                prSelect.appendChild(opt);
            });
            prSelect.value = emitterConfig.presetId || '';
        }

        this.fields.showArea.checked = emitterConfig.showArea !== false;
        this.fields.notify.checked = !!emitterConfig.notify;
        this.fields.cooldown.value = emitterConfig.cooldown ?? 1.5;
        this.fields.range.value = emitterConfig.range ?? 220;
        this.fields.projectileType.value = emitterConfig.projectileType ?? 'standard';
        this.fields.projectileSpeed.value = emitterConfig.projectileSpeed ?? 160;
        this.fields.burstCount.value = emitterConfig.burstCount ?? 1;
        this.fields.damage.value = emitterConfig.damage ?? 15;
        this.fields.projectileColor.value = emitterConfig.projectileColor ?? '#ff3333';

        this.updateEmitterFieldsVisibility();

        const emPanel = document.getElementById('npc-creator-emitter-section');
        if (emPanel) {
            emPanel.style.display = npcData.broadType === 'turret' ? 'block' : 'none';
        }

        // items
        this.inventoryContainer.innerHTML = '';
        (npcData.inventory || []).forEach(it => {
            this._addInventoryCard(it);
        });

        // load slotted abilities
        const slotsVal = npcData.equippedAbilities || [];
        this.abilitySlotsContainer.innerHTML = '';
        this.fields.abilitySlots = [];
        slotsVal.forEach(val => {
            this._addAbilitySlotRow(val);
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
        if (data.broadType === 'turret') {
            data.emitterConfig = {
                presetId: this.fields.presetId.value || undefined,
                showArea: this.fields.showArea.checked,
                notify: this.fields.notify.checked,
                cooldown: parseFloat(this.fields.cooldown.value) || 1.5,
                range: parseInt(this.fields.range.value, 10) || 220,
                projectileType: this.fields.projectileType.value,
                projectileSpeed: parseInt(this.fields.projectileSpeed.value, 10) || 160,
                burstCount: parseInt(this.fields.burstCount.value, 10) || 1,
                damage: parseInt(this.fields.damage.value, 10) || 15,
                projectileColor: this.fields.projectileColor.value || '#ff3333'
            };
        } else {
            delete data.emitterConfig;
        }

        data.stats = {
            level: parseInt(this.fields.level.value, 10) || 1,
            hp: parseInt(this.fields.hp.value, 10) || 50,
            maxHp: parseInt(this.fields.maxHp.value, 10) || 50,
            atk: parseInt(this.fields.atk.value, 10) || 10,
            def: parseInt(this.fields.def.value, 10) || 5,
            speed: parseInt(this.fields.speed.value, 10) || 120
        };

        // serialize equipped/slotted abilities
        if (this.fields.abilitySlots) {
            data.equippedAbilities = this.fields.abilitySlots.map(selectEl => selectEl.value);
        }

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

    updateEmitterFieldsVisibility() {
        const presetId = this.fields.presetId ? this.fields.presetId.value : '';
        const manualFields = [
            'projectileType',
            'projectileSpeed',
            'burstCount',
            'damage',
            'projectileColor',
            'cooldown',
            'range',
            'showArea',
            'notify'
        ];
        manualFields.forEach(k => {
            const f = this.fields[k];
            if (f && f.parentElement) {
                f.parentElement.style.display = presetId ? 'none' : 'block';
            }
        });
    }
}

export default NpcCreatorUI;
