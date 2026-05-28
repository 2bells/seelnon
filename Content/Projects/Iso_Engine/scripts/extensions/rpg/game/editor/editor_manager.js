// scripts/extensions/rpg/game/editor/editor_manager.js
console.log("rpg/game/editor/editor_manager.js loaded");

import MapEditor from './map_editor.js';
import NpcCreator from './npc_creator.js';
import LightEditor from './editor_lights.js';

class EditorManager {
    constructor(engine, modalContentElement) {
        this.engine = engine;
        this.modalContentElement = modalContentElement;

        this.editors = {};
        this.activeEditor = null;

        this._initEditors();
    }

    _initEditors() {
        this.editors.map = new MapEditor(this.engine, this.modalContentElement);
        this.editors.npc = new NpcCreator(this.engine, this.modalContentElement);
        this.editors.light = new LightEditor(this.engine);
        // Future editors will be added here
        // this.editors.enemy = new EnemyEditor(this.engine);
        // this.editors.quest = new QuestEditor(this.engine);
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
}

export default EditorManager;