// scripts/extensions/rpg/game/editor/npc_creator.js
console.log("rpg/game/editor/npc_creator.js loaded");

import NpcCreatorUI from './npc_creator_ui.js';
import CustomDialog from '../ui/custom_dialog.js';

class NpcCreator {
    constructor(engine, modalContentElement) {
        this.engine = engine;
        this.modalContentElement = modalContentElement;
        this.isActive = false;

        this.ui = new NpcCreatorUI(this);
        this.currentNpcData = this.getEmptyNpcData();

        this._boundHandleImageUpload = this.handleImageUpload.bind(this);
    }

    getEmptyNpcData() {
        return {
            name: "New NPC",
            description: "",
            broadType: "villager",
            stats: {
                level: 1,
                hp: 50,
                maxHp: 50,
                atk: 10,
                def: 5,
                speed: 120
            },
            inventory: [],
            dialogue_branches: [],
            first_mes: "Greetings, traveler!",
            map_sprite: {
                type: "spritesheet", // "spritesheet" or "custom"
                source: 0, // index 0-5 for spritesheet, or dataUrl for custom
            },
            dialogue_avatars: {
                main: null, // dataUrl
                reactive: [], // { keyword: string, dataUrl: string }
            },
        };
    }

    initUI() {
        if (!this.ui.panel) {
            const panel = this.ui.createPanel(this.modalContentElement, this.engine.assets.npcSpritesheet);
            this.modalContentElement.appendChild(panel);
        }
        const npcCreatorButton = document.getElementById('rpg-npc-creator-button');
        if (npcCreatorButton && this.engine.assets.npcCreatorIcon?.complete) {
            const img = this.engine.assets.npcCreatorIcon.cloneNode();
            npcCreatorButton.innerHTML = '';
            npcCreatorButton.appendChild(img);
        }
    }
    
    show() {
        this.initUI();
        this.ui.panel.style.display = 'flex';
        this.isActive = true;
    }
    
    hide() {
        if (this.ui.panel) {
            this.ui.panel.style.display = 'none';
        }
        this.isActive = false;
    }
    
    reset() {
        this.currentNpcData = this.getEmptyNpcData();
        this.ui.populate(this.currentNpcData);
    }

    save() {
        const npcData = this.ui.collectData();
        if (!npcData) return; // UI Validation failed

        const npcJson = JSON.stringify(npcData, null, 2);
        const blob = new Blob([npcJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fileName = (npcData.name || 'unnamed_npc').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        a.download = `${fileName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        CustomDialog.alert(`NPC "${npcData.name}" download initiated.`, "Download Complete");
    }
    
    load(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const npcData = JSON.parse(e.target.result);
                // Basic validation
                if (npcData && npcData.name && npcData.map_sprite && npcData.dialogue_avatars) {
                    // Populate default stats, inventory and options if missing (backwards compatibility)
                    if (!npcData.stats) {
                        npcData.stats = { level: 1, hp: 50, maxHp: 50, atk: 10, def: 5, speed: 120 };
                    }
                    if (!npcData.inventory) {
                        npcData.inventory = [];
                    }
                    if (!npcData.dialogue_branches) {
                        npcData.dialogue_branches = [];
                    }
                    if (!npcData.broadType) {
                        npcData.broadType = npcData.scenario ? "guard" : "villager";
                    }
                    if (!npcData.first_mes) {
                        npcData.first_mes = npcData.personality ? `Hello! I am ${npcData.name}.` : "Greetings, traveler!";
                    }

                    this.currentNpcData = npcData;
                    this.ui.populate(this.currentNpcData);
                    CustomDialog.alert(`NPC "${npcData.name}" loaded successfully.`, "NPC Loaded");
                } else {
                    throw new Error("Invalid or incomplete NPC JSON file.");
                }
            } catch (error) {
                console.error("Error parsing NPC file:", error);
                CustomDialog.alert(`Error parsing NPC file: ${error.message}`, "Import Error");
            }
        };
        reader.readAsText(file);
        
        // Reset file input to allow re-uploading the same file
        event.target.value = null;
    }

    handleImageUpload(event, type, reactiveIndex = -1) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            switch(type) {
                case 'map_sprite':
                    this.currentNpcData.map_sprite.type = 'custom';
                    this.currentNpcData.map_sprite.source = dataUrl;
                    this.ui.updateMapSpritePreview(dataUrl);
                    break;
                case 'main_avatar':
                    this.currentNpcData.dialogue_avatars.main = dataUrl;
                    this.ui.updateMainAvatarPreview(dataUrl);
                    break;
                case 'reactive_avatar':
                    if (reactiveIndex > -1 && this.currentNpcData.dialogue_avatars.reactive[reactiveIndex]) {
                        this.currentNpcData.dialogue_avatars.reactive[reactiveIndex].dataUrl = dataUrl;
                        this.ui.updateReactiveAvatarPreview(reactiveIndex, dataUrl);
                    }
                    break;
            }
        };
        reader.readAsDataURL(file);
        event.target.value = null;
    }
}

export default NpcCreator;