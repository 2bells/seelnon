import { LayerManager } from './LayerManager.js'; // Ensure LayerManager is imported if needed for zIndex calculation here

export class ImageBoard {
    constructor() {
        this.items = new Map();
        this.selectedId = null;
        this.panX = 0;
        this.panY = 0;
        this.history = [];
        this.historyIndex = -1;
        this.zoom = 1; // Added zoom to imageBoard state for saving/loading

        this.onSelectionChange = null; // Callback for app
    }
    
    addImage(imageData) {
        const id = Date.now() + Math.random();
        const initialBoardWidth = 512; // Default width for images placed on the board
        const scaleFactor = initialBoardWidth / imageData.width;
        
        // Determine the highest existing zIndex to place the new item on top
        const allItems = this.getAllItems();
        const maxZIndex = allItems.length > 0 ? Math.max(...allItems.map(i => i.zIndex)) : -1;

        const item = {
            id,
            type: 'image',
            ...imageData,
            originalWidth: imageData.width,
            originalHeight: imageData.height,
            width: initialBoardWidth, // Actual displayed width on board
            height: imageData.height * scaleFactor, // Actual displayed height on board
            x: Math.random() * 300 + 100, // Spawn randomly on board
            y: Math.random() * 300 + 100,
            crop: null,
            zIndex: maxZIndex + 1, // Assign zIndex on creation to be on top
            visible: true // Images are visible by default
        };
        
        this.items.set(id, item);
        this.saveState();
        return id;
    }
    
    addText(textData) {
        const id = Date.now() + Math.random();
        
        // Determine the highest existing zIndex to place the new item on top
        const allItems = this.getAllItems();
        const maxZIndex = allItems.length > 0 ? Math.max(...allItems.map(i => i.zIndex)) : -1;

        const item = {
            id,
            type: 'text',
            ...textData,
            zIndex: maxZIndex + 1, // Assign zIndex on creation to be on top
            visible: true // Text is visible by default
        };
        
        this.items.set(id, item);
        this.saveState();
        return id;
    }
    
    removeItem(itemId) {
        this.items.delete(itemId);
        if (this.selectedId === itemId) {
            this.selectedId = null;
            if (this.onSelectionChange) this.onSelectionChange(null);
        }
        this.saveState();
        // LayerManager will re-index z-order after item removal
    }
    
    getItem(itemId) {
        return this.items.get(itemId);
    }
    
    getAllItems() {
        return Array.from(this.items.values());
    }
    
    getSelected() {
        return this.items.get(this.selectedId);
    }
    
    selectItem(itemId) {
        if (this.selectedId !== itemId) {
            this.selectedId = itemId;
            if (this.onSelectionChange) this.onSelectionChange(itemId);
        }
    }
    
    moveItem(itemId, deltaX, deltaY) {
        const item = this.items.get(itemId);
        if (item) {
            item.x += deltaX;
            item.y += deltaY;
            // No saveState here, will be called by App's handleMouseUp
        }
    }
    
    resizeItem(itemId, newWidth, newHeight) {
        const item = this.items.get(itemId);
        if (item) {
            item.width = newWidth;
            item.height = newHeight;
            // No saveState here, will be called by App's handleMouseUp
        }
    }
    
    cropItem(itemId, cropData) {
        const item = this.items.get(itemId);
        if (item && item.type === 'image') {
            if (cropData === null) {
                // Reset crop
                item.crop = null;
            } else {
                item.crop = cropData;
            }
            this.saveState();
        }
    }
    
    pan(deltaX, deltaY) {
        this.panX += deltaX;
        this.panY += deltaY;
    }
    
    saveState() {
        const state = {
            items: Array.from(this.items.entries()),
            panX: this.panX,
            panY: this.panY,
            zoom: this.zoom // Save current zoom level
        };
        
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(JSON.stringify(state));
        this.historyIndex++;
        
        // Limit history size
        if (this.history.length > 50) {
            this.history.shift();
            this.historyIndex--;
        }
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState();
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState();
        }
    }
    
    restoreState() {
        const state = JSON.parse(this.history[this.historyIndex]);
        
        const restoredItems = new Map();
        for (const [id, itemData] of state.items) {
            // Restore Image elements if they were serialized as dataURLs
            if (itemData.type === 'image' && typeof itemData.element === 'string') { 
                const img = new Image();
                img.src = itemData.element; 
                itemData.element = img;
            }
            // Ensure zIndex and visible properties are restored
            if (itemData.zIndex === undefined) itemData.zIndex = 0;
            if (itemData.visible === undefined) itemData.visible = true;
            restoredItems.set(id, itemData);
        }
        
        this.items = restoredItems;
        this.panX = state.panX;
        this.panY = state.panY;
        this.zoom = state.zoom !== undefined ? state.zoom : 1; // Restore zoom or default to 1
        
        if (this.onSelectionChange) this.onSelectionChange(this.selectedId); // Trigger UI update for layers
    }
    
    loadData(data) {
        this.items = new Map(data.map(item => [item.id, item]));
        this.selectedId = null; 
        this.panX = data.panX !== undefined ? data.panX : 0; 
        this.panY = data.panY !== undefined ? data.panY : 0;
        this.zoom = data.zoom !== undefined ? data.zoom : 1; // Restore zoom here
        this.saveState(); // Save the loaded state as the first history entry
        if (this.onSelectionChange) this.onSelectionChange(null); // Trigger UI update for layers
    }
}