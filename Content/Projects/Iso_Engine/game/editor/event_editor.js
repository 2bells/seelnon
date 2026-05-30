// JRPG Custom Event Creator & Trigger System
console.log("rpg/game/editor/event_editor.js loaded");

import CustomDialog from '../ui/custom_dialog.js';
import { getAllCustomItems, saveCustomItem, deleteCustomItem } from './item_editor.js';

export const RPG_EVENT_STORAGE_KEY = 'rpg_custom_events';

// Global helper to get all custom events
export function getAllCustomEvents() {
    let custom = {};
    try {
        const stored = localStorage.getItem(RPG_EVENT_STORAGE_KEY);
        if (stored) {
            custom = JSON.parse(stored);
        }
    } catch (e) {
        console.error("Error parsing custom events:", e);
    }
    return custom;
}

// Global helper to save custom event
export function saveCustomEvent(evt) {
    let custom = getAllCustomEvents();
    custom[evt.id] = evt;
    localStorage.setItem(RPG_EVENT_STORAGE_KEY, JSON.stringify(custom));
    
    // Auto-create matching event key/item in the custom items library
    const eventItem = {
        id: `item_evt_${evt.id}`,
        name: evt.name,
        type: 'event',
        emoji: evt.emoji || '🔑',
        description: evt.description || `Event item that triggers event: ${evt.name}`,
        cost: evt.cost || 0,
        value: 0,
        count: 1,
        attachedEvent: evt.id
    };
    saveCustomItem(eventItem);
    
    console.log(`Saved custom event "${evt.name}" and auto-created matching Key Item.`);
}

// Global helper to delete custom event
export function deleteCustomEvent(evtId) {
    let custom = getAllCustomEvents();
    if (custom[evtId]) {
        delete custom[evtId];
        localStorage.setItem(RPG_EVENT_STORAGE_KEY, JSON.stringify(custom));
        
        // Also remove auto-created event item
        deleteCustomItem(`item_evt_${evtId}`);
        console.log(`Deleted custom event "${evtId}" and its matching Key Item.`);
    }
}

class EventEditor {
    constructor(engine, modalContentElement) {
        this.engine = engine;
        this.modalContentElement = modalContentElement;
        this.isActive = false;
        this.panel = null;
        this.selectedEventId = '';
        
        this.fields = {};
    }

    initUI() {
        if (this.panel) return;

        this.panel = document.createElement('div');
        this.panel.id = 'rpg-event-editor-panel';
        this.panel.className = 'collapsed'; // Start collapsed
        this.panel.style.display = 'none';

        // Toggle panel title
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'rpg-event-editor-toggle';
        toggleBtn.textContent = 'Event Designer';
        toggleBtn.onclick = () => this.toggleCollapse();
        this.panel.appendChild(toggleBtn);

        // Content
        const content = document.createElement('div');
        content.id = 'rpg-event-editor-content';
        
        // Form & Header
        const formTitle = document.createElement('h3');
        formTitle.textContent = 'Design Custom Progression Events';
        formTitle.style.margin = '0 0 10px 0';
        formTitle.style.fontFamily = 'monospace';
        formTitle.style.color = '#F2C12E';
        content.appendChild(formTitle);

        const formGrid = document.createElement('div');
        formGrid.style.display = 'flex';
        formGrid.style.flexDirection = 'column';
        formGrid.style.gap = '8px';

        // --- ID Field ---
        const idContainer = document.createElement('div');
        const idLabel = document.createElement('label');
        idLabel.textContent = 'Event Unique ID:';
        idLabel.style.display = 'block';
        idLabel.style.fontWeight = 'bold';
        this.fields.idInput = document.createElement('input');
        this.fields.idInput.type = 'text';
        this.fields.idInput.readOnly = true;
        this.fields.idInput.placeholder = 'Generated on New';
        this.fields.idInput.style.width = '100%';
        this.fields.idInput.style.boxSizing = 'border-box';
        this.fields.idInput.style.backgroundColor = '#2c221a';
        this.fields.idInput.style.border = '1px solid #555';
        this.fields.idInput.style.color = '#aaa';
        this.fields.idInput.style.padding = '5px';
        idContainer.appendChild(idLabel);
        idContainer.appendChild(this.fields.idInput);
        formGrid.appendChild(idContainer);

        // --- Name Field ---
        const nameContainer = document.createElement('div');
        const nameLabel = document.createElement('label');
        nameLabel.textContent = 'Event / Trigger Name:';
        nameLabel.style.display = 'block';
        nameLabel.style.fontWeight = 'bold';
        this.fields.nameInput = document.createElement('input');
        this.fields.nameInput.type = 'text';
        this.fields.nameInput.placeholder = 'e.g., Gate of Doom Unlock';
        this.fields.nameInput.style.width = '100%';
        this.fields.nameInput.style.boxSizing = 'border-box';
        this.fields.nameInput.style.backgroundColor = '#1e1e1e';
        this.fields.nameInput.style.border = '1px solid #8C6D56';
        this.fields.nameInput.style.color = '#fff';
        this.fields.nameInput.style.padding = '5px';
        this.fields.nameInput.oninput = () => {
            if (!this.selectedEventId) {
                // Generate chronological ID if editing name from blank state
                this.generateNewId();
            }
        };
        nameContainer.appendChild(nameLabel);
        nameContainer.appendChild(this.fields.nameInput);
        formGrid.appendChild(nameContainer);

        // --- Description Field ---
        const descContainer = document.createElement('div');
        const descLabel = document.createElement('label');
        descLabel.textContent = 'Item/Event Description:';
        descLabel.style.display = 'block';
        descLabel.style.fontWeight = 'bold';
        this.fields.descInput = document.createElement('textarea');
        this.fields.descInput.placeholder = 'What does having this key or pulling this lever do in world?';
        this.fields.descInput.style.width = '100%';
        this.fields.descInput.style.height = '42px';
        this.fields.descInput.style.boxSizing = 'border-box';
        this.fields.descInput.style.backgroundColor = '#1e1e1e';
        this.fields.descInput.style.border = '1px solid #8C6D56';
        this.fields.descInput.style.color = '#fff';
        this.fields.descInput.style.padding = '5px';
        this.fields.descInput.style.resize = 'none';
        descContainer.appendChild(descLabel);
        descContainer.appendChild(this.fields.descInput);
        formGrid.appendChild(descContainer);

        // --- Row for Symbol / Cost ---
        const metaRow = document.createElement('div');
        metaRow.style.display = 'flex';
        metaRow.style.gap = '8px';

        const emojiContainer = document.createElement('div');
        emojiContainer.style.flex = '1';
        const emojiLabel = document.createElement('label');
        emojiLabel.textContent = 'Key/Item Symbol:';
        emojiLabel.style.display = 'block';
        this.fields.emojiSelect = document.createElement('select');
        this.fields.emojiSelect.style.width = '100%';
        this.fields.emojiSelect.style.backgroundColor = '#1e1e1e';
        this.fields.emojiSelect.style.border = '1px solid #8C6D56';
        this.fields.emojiSelect.style.color = '#fff';
        this.fields.emojiSelect.style.padding = '5px';
        
        const emojis = ['🔑', '⚡', '💎', '🎟️', '📜', '📦', '🚪', '🟢', '👑', '🏮', '🔥', '🔮', '🛡️', '⚔️', '💀'];
        emojis.forEach(e => {
            const opt = document.createElement('option');
            opt.value = e;
            opt.textContent = `${e} Icon`;
            this.fields.emojiSelect.appendChild(opt);
        });
        emojiContainer.appendChild(emojiLabel);
        emojiContainer.appendChild(this.fields.emojiSelect);
        metaRow.appendChild(emojiContainer);

        const costContainer = document.createElement('div');
        costContainer.style.flex = '1';
        const costLabel = document.createElement('label');
        costLabel.textContent = 'Store Cost (G):';
        costLabel.style.display = 'block';
        this.fields.costInput = document.createElement('input');
        this.fields.costInput.type = 'number';
        this.fields.costInput.value = '100';
        this.fields.costInput.style.width = '100%';
        this.fields.costInput.style.boxSizing = 'border-box';
        this.fields.costInput.style.backgroundColor = '#1e1e1e';
        this.fields.costInput.style.border = '1px solid #8C6D56';
        this.fields.costInput.style.color = '#fff';
        this.fields.costInput.style.padding = '5px';
        costContainer.appendChild(costLabel);
        costContainer.appendChild(this.fields.costInput);
        metaRow.appendChild(costContainer);

        formGrid.appendChild(metaRow);

        // --- Event Action Pattern/Type ---
        const modeContainer = document.createElement('div');
        const modeLabel = document.createElement('label');
        modeLabel.textContent = 'Core Action Behavior:';
        modeLabel.style.display = 'block';
        modeLabel.style.fontWeight = 'bold';
        this.fields.modeSelect = document.createElement('select');
        this.fields.modeSelect.style.width = '100%';
        this.fields.modeSelect.style.backgroundColor = '#1e1e1e';
        this.fields.modeSelect.style.border = '1px solid #8C6D56';
        this.fields.modeSelect.style.color = '#fff';
        this.fields.modeSelect.style.padding = '5px';
        
        const modes = [
            { val: 'unlock_remove', label: 'Unlock Gate/Door (Requires Item, removes block)' },
            { val: 'give_item', label: 'Loot Container / Interactive (Gives Item on click)' }
        ];
        modes.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.val;
            opt.textContent = m.label;
            this.fields.modeSelect.appendChild(opt);
        });
        modeContainer.appendChild(modeLabel);
        modeContainer.appendChild(this.fields.modeSelect);
        formGrid.appendChild(modeContainer);

        // --- Action Buttons ---
        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.gap = '4px';
        btnRow.style.marginTop = '10px';
        btnRow.style.width = '100%';
        btnRow.style.alignItems = 'center';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = '💾 Save';
        saveBtn.style.flex = '1.2';
        saveBtn.style.backgroundColor = '#2ecc71';
        saveBtn.style.color = '#fff';
        saveBtn.style.border = 'none';
        saveBtn.style.height = '28px';
        saveBtn.style.fontSize = '11px';
        saveBtn.style.fontWeight = 'bold';
        saveBtn.style.cursor = 'pointer';
        saveBtn.style.borderRadius = '4px';
        saveBtn.onclick = () => this.saveEvent();
        btnRow.appendChild(saveBtn);

        const exportBtn = document.createElement('button');
        exportBtn.textContent = '📤 Export';
        exportBtn.style.flex = '1';
        exportBtn.style.backgroundColor = '#2980b9';
        exportBtn.style.color = '#fff';
        exportBtn.style.border = 'none';
        exportBtn.style.height = '28px';
        exportBtn.style.fontSize = '11px';
        exportBtn.style.fontWeight = 'bold';
        exportBtn.style.cursor = 'pointer';
        exportBtn.style.borderRadius = '4px';
        exportBtn.onclick = () => this.exportCurrentEvent();
        btnRow.appendChild(exportBtn);

        const evFileId = 'rpg-event-editor-single-import-input';
        const fileInput = document.createElement('input');
        fileInput.id = evFileId;
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        fileInput.onchange = (e) => this.importEventFile(e);
        btnRow.appendChild(fileInput);

        const importLabel = document.createElement('label');
        importLabel.htmlFor = evFileId;
        importLabel.textContent = '📥 Import';
        importLabel.style.flex = '1';
        importLabel.style.display = 'inline-block';
        importLabel.style.color = '#fff';
        importLabel.style.border = '1px solid #5A4B3E';
        importLabel.style.height = '28px';
        importLabel.style.lineHeight = '26px';
        importLabel.style.borderRadius = '4px';
        importLabel.style.fontWeight = 'bold';
        importLabel.style.textAlign = 'center';
        importLabel.style.cursor = 'pointer';
        importLabel.style.backgroundColor = '#8c765c';
        importLabel.style.fontSize = '11px';
        importLabel.style.boxSizing = 'border-box';
        importLabel.style.margin = '0';
        importLabel.style.padding = '0';
        btnRow.appendChild(importLabel);

        const clearBtn = document.createElement('button');
        clearBtn.textContent = '🗑️';
        clearBtn.style.flex = '0.4';
        clearBtn.style.backgroundColor = '#e74c3c';
        clearBtn.style.color = '#fff';
        clearBtn.style.border = 'none';
        clearBtn.style.height = '28px';
        clearBtn.style.fontWeight = 'bold';
        clearBtn.style.cursor = 'pointer';
        clearBtn.style.borderRadius = '4px';
        clearBtn.style.display = 'flex';
        clearBtn.style.alignItems = 'center';
        clearBtn.style.justifyContent = 'center';
        clearBtn.onclick = () => {
            if (this.selectedEventId) {
                this.deleteEvent(this.selectedEventId);
            } else {
                this.clearForm();
            }
        };
        btnRow.appendChild(clearBtn);

        formGrid.appendChild(btnRow);

        content.appendChild(formGrid);

        // Divider
        const divider = document.createElement('hr');
        divider.style.border = 'none';
        divider.style.borderTop = '1px solid #5A4B3E';
        divider.style.margin = '15px 0 10px 0';
        content.appendChild(divider);

        // Event library header list
        const libHeader = document.createElement('h4');
        libHeader.textContent = 'Stored Events Library';
        libHeader.style.margin = '0 0 8px 0';
        libHeader.style.fontFamily = 'monospace';
        libHeader.style.color = '#8cd';
        content.appendChild(libHeader);

        // Dynamic List Container
        this.listContainer = document.createElement('div');
        this.listContainer.style.maxHeight = '140px';
        this.listContainer.style.overflowY = 'auto';
        this.listContainer.style.display = 'flex';
        this.listContainer.style.flexDirection = 'column';
        this.listContainer.style.gap = '6px';
        this.listContainer.style.padding = '4px';
        this.listContainer.style.backgroundColor = '#181412';
        this.listContainer.style.border = '1px solid #5A4B3E';
        this.listContainer.style.borderRadius = '4px';
        content.appendChild(this.listContainer);

        this.panel.appendChild(content);
        this.modalContentElement.appendChild(this.panel);

        // Initial Load
        this.refreshEventsList();
    }

    generateNewId() {
        const timestamp = Date.now();
        this.selectedEventId = `evt_${timestamp}`;
        this.fields.idInput.value = this.selectedEventId;
    }

    saveEvent() {
        const name = this.fields.nameInput.value.trim();
        if (!name) {
            CustomDialog.alert('Please specify a friendly name for this Event.', 'Missing Name');
            return;
        }

        if (!this.selectedEventId) {
            this.generateNewId();
        }

        const evt = {
            id: this.selectedEventId,
            name: name,
            description: this.fields.descInput.value.trim(),
            emoji: this.fields.emojiSelect.value,
            cost: Number(this.fields.costInput.value) || 0,
            mode: this.fields.modeSelect.value,
            timestamp: Date.now()
        };

        saveCustomEvent(evt);
        this.clearForm();
        this.refreshEventsList();
        
        CustomDialog.alert(`Saved "${evt.name}" successfully! An attached Key Item (ID: item_evt_${evt.id}) was auto-generated for the library.`, 'Event Created');
    }

    deleteEvent(id) {
        const custom = getAllCustomEvents();
        const config = custom[id];
        if (!config) return;

        CustomDialog.confirm(
            `Are you sure you want to permanently delete event "${config.name}"? This will also delete its auto-created library item.`,
            (agreed) => {
                if (agreed) {
                    deleteCustomEvent(id);
                    this.clearForm();
                    this.refreshEventsList();
                }
            }
        );
    }

    clearForm() {
        this.selectedEventId = '';
        this.fields.idInput.value = '';
        this.fields.nameInput.value = '';
        this.fields.descInput.value = '';
        this.fields.emojiSelect.selectedIndex = 0;
        this.fields.costInput.value = '100';
        this.fields.modeSelect.selectedIndex = 0;
    }

    exportCurrentEvent() {
        const name = this.fields.nameInput.value.trim();
        if (!name) {
            CustomDialog.alert('Please design or load an Event first to export.', 'Missing Name');
            return;
        }
        const evt = {
            id: this.selectedEventId || `evt_${Date.now()}`,
            name: name,
            description: this.fields.descInput.value.trim(),
            emoji: this.fields.emojiSelect.value,
            cost: Number(this.fields.costInput.value) || 0,
            mode: this.fields.modeSelect.value,
            timestamp: Date.now()
        };
        const json = JSON.stringify(evt, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fileName = name.toLowerCase().replace(/[^a-z0-9]/gi, '_');
        a.download = `event_${fileName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    importEventFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (!importedData || !importedData.id || !importedData.name) {
                    CustomDialog.alert("JSON file does not appear to be a valid Event config.", "Import Failed");
                    return;
                }

                saveCustomEvent(importedData);
                this.loadEventIntoForm(importedData);
                this.refreshEventsList();
                
                CustomDialog.alert(`Successfully imported Custom Event "${importedData.name}"!`, "Import Complete");
            } catch (err) {
                console.error(err);
                CustomDialog.alert("Could not load Event JSON: file format is invalid.", "Import Error");
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    loadEventIntoForm(evt) {
        this.selectedEventId = evt.id;
        this.fields.idInput.value = evt.id;
        this.fields.nameInput.value = evt.name;
        this.fields.descInput.value = evt.description || '';
        this.fields.emojiSelect.value = evt.emoji || '🔑';
        this.fields.costInput.value = evt.cost || 0;
        this.fields.modeSelect.value = evt.mode || 'unlock_remove';
    }

    refreshEventsList() {
        if (!this.listContainer) return;

        this.listContainer.innerHTML = '';
        const custom = getAllCustomEvents();
        const keys = Object.keys(custom).sort((a,b) => (custom[b].timestamp || 0) - (custom[a].timestamp || 0));

        if (keys.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No events designed yet.';
            empty.style.color = '#777';
            empty.style.textAlign = 'center';
            empty.style.fontStyle = 'italic';
            empty.style.padding = '10px';
            this.listContainer.appendChild(empty);
            return;
        }

        keys.forEach(key => {
            const evt = custom[key];
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.padding = '5px';
            item.style.backgroundColor = '#2c221a';
            item.style.border = '1px solid #4a3c30';
            item.style.borderRadius = '3px';
            item.style.justifyContent = 'space-between';
            item.style.gap = '5px';

            const left = document.createElement('div');
            left.style.display = 'flex';
            left.style.alignItems = 'center';
            left.style.gap = '8px';
            left.style.cursor = 'pointer';
            left.onclick = () => this.loadEventIntoForm(evt);

            const em = document.createElement('span');
            em.textContent = evt.emoji || '🔑';
            em.style.fontSize = '1.3em';
            left.appendChild(em);

            const info = document.createElement('div');
            const nameSpan = document.createElement('div');
            nameSpan.textContent = evt.name;
            nameSpan.style.fontWeight = 'bold';
            nameSpan.style.color = '#fff';
            
            const idSpan = document.createElement('div');
            idSpan.textContent = evt.id;
            idSpan.style.fontSize = '0.75em';
            idSpan.style.color = '#888';
            idSpan.style.fontFamily = 'monospace';

            info.appendChild(nameSpan);
            info.appendChild(idSpan);
            left.appendChild(info);

            const right = document.createElement('div');
            right.style.display = 'flex';
            right.style.gap = '4px';

            // Give to Hero Bag button (handy for testing!)
            const giveBtn = document.createElement('button');
            giveBtn.textContent = '👜';
            giveBtn.title = 'Add 1x Key Item to Hero Bag';
            giveBtn.style.padding = '3px';
            giveBtn.style.cursor = 'pointer';
            giveBtn.style.backgroundColor = '#8C6D56';
            giveBtn.style.border = 'none';
            giveBtn.style.color = '#fff';
            giveBtn.style.borderRadius = '3px';
            giveBtn.onclick = () => this.giveKeyItemToHero(evt);

            const delBtn = document.createElement('button');
            delBtn.textContent = '🗑️';
            delBtn.title = 'Delete Event';
            delBtn.style.padding = '3px';
            delBtn.style.cursor = 'pointer';
            delBtn.style.backgroundColor = '#e14';
            delBtn.style.border = 'none';
            delBtn.style.color = '#fff';
            delBtn.style.borderRadius = '3px';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                this.deleteEvent(evt.id);
            };

            right.appendChild(giveBtn);
            right.appendChild(delBtn);

            item.appendChild(left);
            item.appendChild(right);
            this.listContainer.appendChild(item);
        });
    }

    giveKeyItemToHero(evt) {
        if (!this.engine.player) {
            CustomDialog.alert('Hero player is not active currently.', 'Error');
            return;
        }

        // Search the custom item
        const customItems = getAllCustomItems();
        const itemId = `item_evt_${evt.id}`;
        const config = customItems[itemId];

        if (config) {
            if (!this.engine.player.inventory) this.engine.player.inventory = [];
            
            // Increment if already exists, else add
            const existing = this.engine.player.inventory.find(it => it.id === config.id);
            if (existing) {
                existing.count = (existing.count || 0) + 1;
            } else {
                this.engine.player.inventory.push({
                    id: config.id,
                    name: config.name,
                    type: config.type,
                    emoji: config.emoji || '🔑',
                    description: config.description,
                    cost: config.cost || 0,
                    value: 0,
                    count: 1,
                    attachedEvent: config.attachedEvent
                });
            }
            
            // Save & reload bags
            this.engine.player.saveToStorage();
            if (this.engine.inventoryUI) {
                this.engine.inventoryUI.refresh();
            }

            CustomDialog.alert(`Gave 1x "${config.name}" item directly to the Hero's inventory bag!`, 'Item Obtained');
        } else {
            console.error('Expected auto-created event item does not exist:', itemId);
        }
    }

    toggleCollapse() {
        if (this.panel.classList.contains('collapsed')) {
            this.panel.classList.remove('collapsed');
            this.isActive = true;
            this.refreshEventsList();
        } else {
            this.panel.classList.add('collapsed');
            this.isActive = false;
        }
    }

    show() {
        this.initUI();
        this.panel.style.display = 'block';
        this.panel.classList.remove('collapsed');
        this.isActive = true;
        this.refreshEventsList();
    }

    hide() {
        if (this.panel) {
            this.panel.style.display = 'none';
            this.panel.classList.add('collapsed');
        }
        this.isActive = false;
    }
}

export default EventEditor;
