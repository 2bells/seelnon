// rpg/game/editor/editor_map_operations.js
console.log("rpg/game/editor/editor_map_operations.js loaded");

const RPG_EDITOR_MAP_PREFIX = 'rpgEditor_map_'; // Prefix for map keys in localStorage

class EditorMapOperations {
    constructor(editor) {
        this.editor = editor; // Reference to the main MapEditor instance
        this.engine = editor.engine;
        // Bound methods for direct use as event handlers
        this.promptNewMap = this._promptNewMap.bind(this);
        this.saveMapToLocal = this._saveMapToLocal.bind(this);
        this.loadMapFromLocal = this._loadMapFromLocal.bind(this);
        this.downloadMapFile = this._downloadMapFile.bind(this);
        this.triggerFileUpload = this._triggerFileUpload.bind(this);
        this.handleFileUpload = this._handleFileUpload.bind(this);
    }

    _promptNewMap() {
        const width = prompt("Enter new map width (in tiles):", this.editor.map.width);
        if (width === null) return;
        const height = prompt("Enter new map height (in tiles):", this.editor.map.height);
        if (height === null) return;

        const newWidth = parseInt(width);
        const newHeight = parseInt(height);

        if (isNaN(newWidth) || isNaN(newHeight) || newWidth <= 0 || newHeight <= 0) {
            alert("Invalid dimensions. Please enter positive numbers.");
            return;
        }
        this.editor.map.initializeNewMap(newWidth, newHeight, 1);
        if (this.engine.player) {
            const newPlayerMapX = Math.floor(newWidth / 2);
            const newPlayerMapY = Math.floor(newHeight / 2);
            const newScreenPos = this.editor.map.mapToScreen(newPlayerMapX, newPlayerMapY);
            this.engine.player.mapX = newPlayerMapX;
            this.engine.player.mapY = newPlayerMapY;
            this.engine.player.currentPixelX = newScreenPos.x;
            this.engine.player.currentPixelY = newScreenPos.y;
        }
        
        // Update light system to clear old masks from view
        const engine = this.editor.engine;
        engine.lightSystem.updateData(engine.map.getLightingData());
        const lightEditor = engine.editorManager.editors.light;
        if (lightEditor) {
            lightEditor.selectedMask = null;
            if (lightEditor.isActive) {
                lightEditor.refreshUI();
            }
        }
        
        alert(`New ${newWidth}x${newHeight} map created.`);
    }

    async _saveMapToLocal() {
        if (!this.editor.uiManager) {
            alert("UI Manager not available to prompt for map name.");
            return;
        }
        try {
            const currentMapName = this.editor.map.currentMapName || ''; // If map has a name, suggest it
            const mapName = await this.editor.uiManager.promptForMapName(currentMapName);

            if (!mapName || mapName.trim() === '') {
                alert("Save cancelled or invalid map name.");
                return;
            }

            const mapData = this.editor.map.serialize();
            mapData.mapName = mapName; // Store the name within the map data itself too
            localStorage.setItem(`${RPG_EDITOR_MAP_PREFIX}${mapName}`, JSON.stringify(mapData));
            this.editor.map.currentMapName = mapName; // Update current map's name
            alert(`Map "${mapName}" saved to local storage!`);

        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.error("Error saving map:", error);
                alert(`Error: Could not save map. The browser's local storage quota has been exceeded. Please delete some saved maps to free up space.`);
            } else {
                console.error("Error saving map to local storage:", error);
                alert(`Error saving map: ${error.message}`);
            }
        }
    }

    _loadMapFromLocal() {
        try {
            const savedMaps = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith(RPG_EDITOR_MAP_PREFIX)) {
                    const mapString = localStorage.getItem(key);
                    if (mapString) {
                        savedMaps.push({
                            name: key.substring(RPG_EDITOR_MAP_PREFIX.length),
                            size: mapString.length // Size in bytes
                        });
                    }
                }
            }
            // Sort maps by name for consistent ordering
            savedMaps.sort((a, b) => a.name.localeCompare(b.name));

            if (savedMaps.length === 0) {
                alert("No saved maps found in local storage.");
                if (this.editor.uiManager && this.editor.uiManager.loadMapsListContainer) {
                     this.editor.uiManager.loadMapsListContainer.remove(); // Clear list if shown
                }
                return;
            }

            if (this.editor.uiManager) {
                this.editor.uiManager.displayLoadableMaps(savedMaps, 
                    (mapName) => { // Load callback
                        this._performLoadFromLocal(mapName);
                    },
                    (mapName) => { // Delete callback
                        this._deleteMapFromLocal(mapName);
                    }
                );
            } else {
                // Fallback if UI manager isn't available for listing (e.g. simple prompt)
                const savedMapNames = savedMaps.map(m => m.name);
                const mapToLoad = prompt(`Enter map name to load from: \n${savedMapNames.join('\n')}`);
                if (mapToLoad && savedMapNames.includes(mapToLoad)) {
                    this._performLoadFromLocal(mapToLoad);
                } else if (mapToLoad) {
                    alert(`Map "${mapToLoad}" not found.`);
                }
            }

        } catch (error) {
            console.error("Error listing maps from local storage:", error);
            alert(`Error listing maps: ${error.message}`);
        }
    }

    _deleteMapFromLocal(mapName) {
        try {
            const mapKey = `${RPG_EDITOR_MAP_PREFIX}${mapName}`;
            localStorage.removeItem(mapKey);
            // alert(`Map "${mapName}" deleted successfully.`); // Optional: can be annoying
            // Refresh the list of maps
            this._loadMapFromLocal();
        } catch (error) {
            console.error(`Error deleting map "${mapName}" from local storage:`, error);
            alert(`Error deleting map: ${error.message}`);
        }
    }

    async _performLoadFromLocal(mapName) {
        try {
            const mapString = localStorage.getItem(`${RPG_EDITOR_MAP_PREFIX}${mapName}`);
            if (!mapString) {
                alert(`Map "${mapName}" not found in local storage.`);
                return;
            }
            const mapData = JSON.parse(mapString);

            // Use the engine's new loadMap function
            const success = await this.engine.loadMap(mapData); // When loading from editor, we use default spawn point logic

            if (success) {
                alert(`Map "${this.engine.map.currentMapName}" loaded from local storage!`);
            } else {
                alert(`Failed to load map "${mapName}" from local storage. Data might be corrupt. Check console.`);
            }
        } catch (error) {
            console.error(`Error loading map "${mapName}" from local storage:`, error);
            alert(`Error loading map "${mapName}": ${error.message}`);
        }
    }

    _downloadMapFile() {
        try {
            const mapData = this.editor.map.serialize();
            const mapJson = JSON.stringify(mapData, null, 2);
            const blob = new Blob([mapJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${mapData.mapName || 'map_data'}_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert("Map download initiated.");
        } catch (error) {
            console.error("Error downloading map file:", error);
            alert(`Error downloading map: ${error.message}`);
        }
    }

    _triggerFileUpload() {
        // Assumes fileInput is on editor.uiManager instance
        if (this.editor.uiManager && this.editor.uiManager.fileInput) {
            this.editor.uiManager.fileInput.click();
        } else {
            console.error("File input not found on UI Manager for triggering upload.");
        }
    }

    _handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const mapData = JSON.parse(e.target.result);
                // Use the engine's new loadMap function
                const success = await this.engine.loadMap(mapData); // When loading from editor, we use default spawn point logic

                if (success) {
                    alert(`Map "${file.name}" loaded successfully!`);
                } else {
                    alert(`Failed to load map "${file.name}". Data might be corrupt or invalid. Check console.`);
                }
            } catch (error) {
                console.error(`Error parsing uploaded map file "${file.name}":`, error);
                alert(`Error parsing map file "${file.name}": ${error.message}`);
            } finally {
                event.target.value = null;
            }
        };
        reader.onerror = (e) => {
            console.error(`Error reading file "${file.name}":`, e);
            alert(`Error reading file "${file.name}".`);
            event.target.value = null;
        };
        reader.readAsText(file);
    }
}

export default EditorMapOperations;