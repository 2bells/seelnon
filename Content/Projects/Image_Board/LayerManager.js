export class LayerManager {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.draggedLayerId = null;
        this.layersListContainer = document.getElementById('layersList'); // Store reference
    }
    
    addLayer(item) {
        // Determine the highest existing zIndex to place the new item on top
        const allItems = this.app.imageBoard.getAllItems();
        let maxZIndex = -1;
        if (allItems.length > 0) {
            maxZIndex = Math.max(...allItems.map(i => i.zIndex));
        }
        item.zIndex = maxZIndex + 1;
        item.visible = true; // New items are visible by default

        this.layers.push({
            id: item.id,
            name: item.type === 'image' ? (item.file || 'Image') : item.content?.substring(0, 20) || 'Text',
            type: item.type,
            visible: true, // Layer list entry also tracks visibility
            zIndex: item.zIndex,
            item // Reference to the actual item on the board
        });
        this.sortLayers(); // Keep internal layers array sorted by zIndex
        this.updateLayersList(); // Trigger UI update
    }
    
    removeLayer(itemId) {
        this.layers = this.layers.filter(layer => layer.id !== itemId);
        // Re-index z-order after removal
        this.reindexLayers();
        this.updateLayersList(); // Trigger UI update
    }

    toggleLayerVisibility(itemId) {
        const layer = this.layers.find(l => l.id === itemId);
        const item = this.app.imageBoard.getItem(itemId);
        if (layer && item) {
            layer.visible = !layer.visible;
            item.visible = layer.visible; // Sync with the actual item on the board
            this.app.render(); // Canvas render needed
            this.updateLayersList(); // UI update for eye icon
        }
    }
    
    updateLayersList(selectedId = this.app.imageBoard.selectedId) {
        // Only update if the container exists
        if (!this.layersListContainer) return;

        // Clear existing elements efficiently or manage them. For now, re-render is fine
        // as this method is no longer called on every canvas render cycle.
        this.layersListContainer.innerHTML = '';
        
        // Sort layers for display by their current zIndex (highest zIndex at top of list)
        const sortedLayers = [...this.layers].sort((a, b) => b.zIndex - a.zIndex); // Descending zIndex for visual list order
        
        for (const layer of sortedLayers) { // Iterate directly from the sorted list
            const item = this.app.imageBoard.getItem(layer.id);
            if (!item) continue; // Skip if item no longer exists on board

            const layerEl = document.createElement('div');
            layerEl.className = `layer-item ${item.id === selectedId ? 'active' : ''}`;
            layerEl.dataset.itemId = item.id;
            layerEl.draggable = true; // Enable drag for reordering

            const eyeIcon = layer.visible ? 
                `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>` :
                `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye-off"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.54 18.54 0 0 1 2.21-3.21m3.58-3.58A1.99 1.99 0 0 1 12 8a2 2 0 0 1 2 2c0 .24-.04.48-.12.71l2.41 2.41m-4.55-4.55L14 14m3-3L17 17"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

            layerEl.innerHTML = `
                <div class="layer-thumbnail">
                    ${layer.type === 'image' ? '🖼' : '📝'}
                </div>
                <div class="layer-info">
                    <div class="layer-name">${layer.name}</div>
                    <div class="layer-type">${layer.type}</div>
                </div>
                <div class="layer-controls">
                    <button class="layer-control-btn toggle-visibility-btn">
                        ${eyeIcon}
                    </button>
                </div>
            `;
            
            layerEl.addEventListener('click', (e) => {
                // Prevent selection when clicking on the visibility button
                if (!e.target.closest('.toggle-visibility-btn')) {
                    this.app.imageBoard.selectItem(item.id);
                    this.app.render(); // Only render canvas, updateLayersList is called by selectItem
                }
            });

            layerEl.querySelector('.toggle-visibility-btn').addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent layer selection when clicking eye
                this.toggleLayerVisibility(item.id);
            });

            // Drag and Drop Events
            layerEl.addEventListener('dragstart', (e) => {
                this.draggedLayerId = item.id;
                e.dataTransfer.setData('text/plain', item.id);
                e.target.classList.add('dragging');
            });

            layerEl.addEventListener('dragenter', (e) => {
                e.preventDefault();
                const targetEl = e.target.closest('.layer-item');
                if (targetEl && targetEl.dataset.itemId !== this.draggedLayerId) {
                    targetEl.classList.add('drag-over');
                }
            });

            layerEl.addEventListener('dragleave', (e) => {
                const targetEl = e.target.closest('.layer-item');
                if (targetEl) {
                    targetEl.classList.remove('drag-over');
                }
            });

            layerEl.addEventListener('dragover', (e) => {
                e.preventDefault(); // Allow drop
            });

            layerEl.addEventListener('drop', (e) => {
                e.preventDefault();
                const targetLayerEl = e.target.closest('.layer-item');
                if (targetLayerEl) {
                    const targetItemId = targetLayerEl.dataset.itemId;
                    if (this.draggedLayerId && this.draggedLayerId !== targetItemId) {
                        this.reorderLayer(this.draggedLayerId, targetItemId);
                    }
                    targetLayerEl.classList.remove('drag-over');
                }
            });
            
            layerEl.addEventListener('dragend', (e) => {
                e.target.classList.remove('dragging');
                this.layersListContainer.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
                this.draggedLayerId = null;
            });

            this.layersListContainer.appendChild(layerEl);
        }
    }

    reorderLayer(draggedId, targetId) {
        const draggedLayer = this.layers.find(l => l.id === draggedId);
        if (!draggedLayer) return;

        // Create a copy of the layers array sorted in visual order (highest zIndex at index 0)
        let currentVisualOrder = [...this.layers].sort((a, b) => b.zIndex - a.zIndex);

        // Remove the dragged layer from this visual order array
        currentVisualOrder = currentVisualOrder.filter(l => l.id !== draggedId);

        // Find the index of the target layer in this (now modified) visual order array
        const targetIndexInVisualOrder = currentVisualOrder.findIndex(l => l.id === targetId);

        // Insert the dragged layer back into the temporary array at the new position
        if (targetIndexInVisualOrder !== -1) {
            currentVisualOrder.splice(targetIndexInVisualOrder, 0, draggedLayer);
        } else {
            // Fallback: if target not found (e.g., dragged to empty space or end of list)
            currentVisualOrder.push(draggedLayer); 
        }
        
        // Reassign zIndex values based on this new visual order (highest zIndex at top of list)
        currentVisualOrder.forEach((layer, index) => {
            // The zIndex for items on the canvas should be lowest for the back-most item.
            // The layer list shows items from top (highest zIndex) to bottom (lowest zIndex).
            // So, for the first item in currentVisualOrder (top of list), assign the highest zIndex.
            // For the last item, assign the lowest zIndex (0).
            const newZIndex = currentVisualOrder.length - 1 - index;
            
            layer.zIndex = newZIndex;
            // Update the actual item on the imageBoard
            const item = this.app.imageBoard.getItem(layer.id);
            if (item) {
                item.zIndex = newZIndex;
            }
        });

        // Update the internal `this.layers` array and ensure it's sorted by zIndex for consistency
        this.layers = [...currentVisualOrder]; // Make a copy
        this.sortLayers(); // Sort by ascending zIndex as per internal expectation

        this.app.imageBoard.saveState();
        this.app.render(); // Canvas render needed
        this.updateLayersList(); // UI update for reorder
    }

    sortLayers() {
        this.layers.sort((a, b) => a.zIndex - b.zIndex);
    }

    reindexLayers() {
        // After an item is removed or loaded, re-assign contiguous z-indices
        this.sortLayers(); // Ensure sorted before re-indexing
        this.layers.forEach((layer, index) => {
            layer.zIndex = index;
            const item = this.app.imageBoard.getItem(layer.id);
            if (item) {
                item.zIndex = index;
            }
        });
        this.app.imageBoard.saveState();
        this.app.render();
    }
    
    loadData(layersData) {
        this.layers = layersData.map(layerData => {
            return {
                id: layerData.id,
                name: layerData.name,
                type: layerData.type,
                visible: layerData.visible !== undefined ? layerData.visible : true,
                zIndex: layerData.zIndex !== undefined ? layerData.zIndex : 0,
                item: null // Item reference will be set in App.handleBoardLoad
            };
        });
        this.sortLayers(); // Ensure loaded layers are sorted
        this.reindexLayers(); // Re-index after load to ensure contiguous z-indexes
        this.updateLayersList(); // Trigger UI update after load
    }
}