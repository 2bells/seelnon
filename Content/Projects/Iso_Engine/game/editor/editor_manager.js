// scripts/extensions/rpg/game/editor/editor_manager.js
console.log("rpg/game/editor/editor_manager.js loaded");

import MapEditor from './map_editor.js';
import NpcCreator from './npc_creator.js';
import LightEditor from './editor_lights.js';
import QuestEditor from './quest_editor.js';
import AbilitiesEditor from './abilities_editor.js';
import ItemEditor from './item_editor.js';
import BankEditor from './bank_editor.js';
import EventEditor from './event_editor.js';
import ProjectileCreator from './projectile_creator.js';

class EditorManager {
    constructor(engine, modalContentElement) {
        this.engine = engine;
        this.modalContentElement = modalContentElement;

        this.editors = {};
        this.activeEditor = null;

        this._initEditors();
        this._setupDynamicPanelResizers();
    }

    _initEditors() {
        this.editors.map = new MapEditor(this.engine, this.modalContentElement);
        this.editors.npc = new NpcCreator(this.engine, this.modalContentElement);
        this.editors.light = new LightEditor(this.engine);
        this.editors.quest = new QuestEditor(this.engine, this.modalContentElement);
        this.editors.abilities = new AbilitiesEditor(this.engine, this.modalContentElement);
        this.editors.item = new ItemEditor(this.engine, this.modalContentElement);
        this.editors.bank = new BankEditor(this.engine, this.modalContentElement);
        this.editors.event = new EventEditor(this.engine, this.modalContentElement);
        this.editors.projectile = new ProjectileCreator(this.engine, this.modalContentElement);
    }

    toggle(editorName) {
        const editorToToggle = this.editors[editorName];
        if (!editorToToggle) {
            console.error(`Editor "${editorName}" not found.`);
            return;
        }

        const isAlreadyActive = (this.activeEditor === editorToToggle);

        // Hide the currently active editor if it's not the one we are toggling
        if (this.activeEditor && !isAlreadyActive) {
            this.activeEditor.hide();
        }

        if (isAlreadyActive) {
            // Hide the active editor
            this.activeEditor.hide();
            this.activeEditor = null;
            this.engine.isEditing = false;
        } else {
            // Show the new editor
            editorToToggle.show();
            this.activeEditor = editorToToggle;
            this.engine.isEditing = true;
        }
    }

    isEditorActive(editorName) {
        if (editorName) {
            return this.activeEditor === this.editors[editorName];
        }
        return !!this.activeEditor;
    }
    
    getActiveEditor() {
        return this.activeEditor;
    }

    renderOverlay(ctx) {
        if (this.activeEditor && typeof this.activeEditor.renderOverlay === 'function') {
            this.activeEditor.renderOverlay(ctx);
        }
    }

    hideAll() {
        if (this.activeEditor) {
            this.activeEditor.hide();
            this.activeEditor = null;
            this.engine.isEditing = false;
        }
    }

    _setupDynamicPanelResizers() {
        // Set up a MutationObserver to instantly configure any panels added in the future
        const observer = new MutationObserver((mutations) => {
            for (let i = 0; i < mutations.length; i++) {
                const mutation = mutations[i];
                for (let j = 0; j < mutation.addedNodes.length; j++) {
                    const node = mutation.addedNodes[j];
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this._checkAndSetupResizer(node);
                        const descendants = node.querySelectorAll('[id$="-panel"]');
                        for (let k = 0; k < descendants.length; k++) {
                            this._checkAndSetupResizer(descendants[k]);
                        }
                    }
                }
            }
        });

        observer.observe(this.modalContentElement, {
            childList: true,
            subtree: true
        });

        // Configure any existing panels right away
        const existingPanels = this.modalContentElement.querySelectorAll('[id$="-panel"]');
        for (let i = 0; i < existingPanels.length; i++) {
            this._checkAndSetupResizer(existingPanels[i]);
        }
    }

    _checkAndSetupResizer(el) {
        if (!el || !el.id || !el.id.endsWith('-panel')) return;
        if (el.querySelector('.rpg-panel-resizer')) return;

        const rightSideIds = [
            'rpg-editor-tools-panel',
            'rpg-npc-creator-panel',
            'rpg-light-editor-panel',
            'rpg-quest-editor-panel',
            'rpg-abilities-editor-panel',
            'rpg-item-editor-panel',
            'rpg-event-editor-panel',
            'rpg-bank-editor-panel',
            'rpg-projectile-editor-panel'
        ];
        const isRightSide = rightSideIds.includes(el.id);
        this._applyPanelResizer(el, isRightSide);
    }

    _applyPanelResizer(panel, isRightSide) {
        if (!panel) return;
        
        // Remove native browser resize interface if any
        panel.style.resize = 'none';

        if (panel.querySelector('.rpg-panel-resizer')) return;

        const resizer = document.createElement('div');
        resizer.className = `rpg-panel-resizer ${isRightSide ? 'bottom-left' : 'bottom-right'}`;
        panel.appendChild(resizer);

        const startResize = (clientX, clientY) => {
            const rect = panel.getBoundingClientRect();
            const startWidth = rect.width;
            const startHeight = rect.height;

            const onMove = (moveX, moveY) => {
                const deltaX = moveX - clientX;
                const deltaY = moveY - clientY;

                let newWidth, newHeight;
                if (isRightSide) {
                    newWidth = startWidth - deltaX;
                } else {
                    newWidth = startWidth + deltaX;
                }
                newHeight = startHeight + deltaY;

                const minWidth = (panel.id === 'rpg-bank-editor-panel') ? 400 : 200;
                const maxWidth = window.innerWidth - 20;
                const maxHeight = window.innerHeight - 20;

                newWidth = Math.min(maxWidth, Math.max(minWidth, newWidth));
                newHeight = Math.min(maxHeight, Math.max(40, newHeight));

                panel.style.width = `${newWidth}px`;
                panel.style.height = `${newHeight}px`;

                // Dispatch a window resize event so sub-layout canvas or list item columns adapt smoothly
                window.dispatchEvent(new Event('resize'));
            };

            const onPointerMove = (moveEvent) => {
                onMove(moveEvent.clientX, moveEvent.clientY);
            };

            const onPointerUp = () => {
                document.removeEventListener('pointermove', onPointerMove);
                document.removeEventListener('pointerup', onPointerUp);
            };

            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp);
        };

        resizer.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startResize(e.clientX, e.clientY);
        });
    }
}

export default EditorManager;