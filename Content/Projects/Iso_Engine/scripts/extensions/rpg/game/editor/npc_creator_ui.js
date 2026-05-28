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
        this.fields.personality = this._createTextArea(coreSection, 'personality', 'Personality');
        this.fields.scenario = this._createTextArea(coreSection, 'scenario', 'Scenario');
        this.fields.first_mes = this._createTextArea(coreSection, 'first_mes', 'First Message');
        this.fields.mes_example = this._createTextArea(coreSection, 'mes_example', 'Message Examples');

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

    populate(npcData) {
        this.fields.name.value = npcData.name || '';
        this.fields.description.value = npcData.description || '';
        this.fields.personality.value = npcData.personality || '';
        this.fields.first_mes.value = npcData.first_mes || '';
        this.fields.mes_example.value = npcData.mes_example || '';
        this.fields.scenario.value = npcData.scenario || '';

        this.updateMapSpritePreview(npcData.map_sprite.type === 'custom' ? npcData.map_sprite.source : null);
        this.updateMainAvatarPreview(npcData.dialogue_avatars.main);
        
        this.reactiveAvatarContainer.innerHTML = '';
        (npcData.dialogue_avatars.reactive || []).forEach(entryData => {
            this._addReactiveAvatarEntry(entryData);
        });
    }

    collectData() {
        const data = this.creator.currentNpcData; // Start with current data to preserve image dataURLs
        data.name = this.fields.name.value;
        data.description = this.fields.description.value;
        data.personality = this.fields.personality.value;
        data.first_mes = this.fields.first_mes.value;
        data.mes_example = this.fields.mes_example.value;
        data.scenario = this.fields.scenario.value;

        // Reactive keywords are already updated on change.
        
        if (!data.name) {
            alert("NPC Name is required.");
            return null;
        }
        return data;
    }
}

export default NpcCreatorUI;