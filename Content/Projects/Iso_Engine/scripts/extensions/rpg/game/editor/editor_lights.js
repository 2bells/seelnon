// rpg/game/editor/editor_lights.js
console.log("rpg/game/editor/editor_lights.js loaded");

import { drawCardinalSpline } from '../light_shaders.js';

const POLYGON_CLOSE_DISTANCE_SQ = 100; // Squared distance (10px) to auto-close polygon
const HANDLE_RADIUS_SQ = (5 * 5); // Squared radius for clicking on vertex handles

class LightEditor {
    constructor(engine) {
        this.engine = engine;
        this.map = engine.map;
        this.modalContentElement = engine.modalContentElement;
        this.isActive = false;

        this.panel = null;
        this.maskListPanel = null; // Panel for the mask list
        this.maskListContent = null; // Content area for the mask list
        this.propertiesSection = null; // Store reference to properties section
        this.selectedMask = null;
        this.currentTool = 'select'; // 'select', 'place_mask', 'edit_points'
        
        this.currentMaskType = 'light'; // 'light' or 'shadow'
        this.currentPolygonVertices = [];
        this.currentMouseWorldPos = { x: 0, y: 0 };

        // New properties for editing
        this.snapToGrid = true;
        this.isDragging = false;
        this.draggedVertexInfo = null; // { mask, vertexIndex }

        this._boundHandleMouseDown = this.handleMouseDown.bind(this);
        this._boundHandleMouseUp = this.handleMouseUp.bind(this);
        this._boundHandleMapClick = this.handleMapClick.bind(this);
        this._boundHandleMouseMove = this.handleMouseMove.bind(this);
        this._boundFinalizePolygon = this.finalizeCurrentPolygon.bind(this);
    }

    initUI() {
        if (this.panel) return;

        // --- Right-side Properties Panel ---
        this.panel = document.createElement('div');
        this.panel.id = 'rpg-light-editor-panel';

        const titleButton = document.createElement('button');
        titleButton.id = 'rpg-light-editor-toggle';
        titleButton.textContent = 'Light Mask Editor';
        titleButton.onclick = () => this.panel.classList.toggle('collapsed');
        this.panel.appendChild(titleButton);

        const content = document.createElement('div');
        content.id = 'rpg-light-editor-content';

        // --- Tools Section ---
        const toolsSection = this._createSection(content, 'Tools');
        
        const addLightBtn = document.createElement('button');
        addLightBtn.textContent = 'Add Light Area';
        addLightBtn.onclick = () => { this.currentTool = 'place_mask'; this.currentMaskType = 'light'; this.selectedMask = null; this.updatePropertiesPanel(); };
        toolsSection.appendChild(addLightBtn);
        
        const addShadowBtn = document.createElement('button');
        addShadowBtn.textContent = 'Add Shadow Area';
        addShadowBtn.onclick = () => { this.currentTool = 'place_mask'; this.currentMaskType = 'shadow'; this.selectedMask = null; this.updatePropertiesPanel(); };
        toolsSection.appendChild(addShadowBtn);
        
        // Snap to Grid Checkbox
        this._createCheckbox(toolsSection, 'Snap to Grid', this.snapToGrid, (val) => {
            this.snapToGrid = val;
        });

        const infoText = document.createElement('p');
        infoText.className = 'rpg-editor-info';
        infoText.textContent = 'Click on the map to add vertices. Double-click or click near the start point to finish a shape.';
        toolsSection.appendChild(infoText);

        // --- Selected Mask Properties ---
        this.propertiesSection = this._createSection(content, 'Mask Properties');
        this.propertiesSection.style.display = 'none'; // Hide until a mask is selected

        this.panel.appendChild(content);

        // --- Left-side Mask List Panel ---
        this.maskListPanel = document.createElement('div');
        this.maskListPanel.id = 'rpg-light-mask-list-panel';

        const listTitleButton = document.createElement('button');
        listTitleButton.id = 'rpg-light-mask-list-toggle';
        listTitleButton.textContent = 'Masks';
        listTitleButton.onclick = () => this.maskListPanel.classList.toggle('collapsed');
        this.maskListPanel.appendChild(listTitleButton);

        this.maskListContent = document.createElement('div');
        this.maskListContent.id = 'rpg-light-mask-list-content';
        this.maskListPanel.appendChild(this.maskListContent);

        this.modalContentElement.appendChild(this.maskListPanel);
        this.modalContentElement.appendChild(this.panel);
    }

    show() {
        this.initUI();
        this.panel.style.display = 'flex';
        this.maskListPanel.style.display = 'flex';
        this.isActive = true;
        
        this.engine.canvas.addEventListener('mousedown', this._boundHandleMouseDown);
        this.engine.canvas.addEventListener('mouseup', this._boundHandleMouseUp);
        this.engine.canvas.addEventListener('click', this._boundHandleMapClick);
        this.engine.canvas.addEventListener('dblclick', this._boundFinalizePolygon);
        this.engine.canvas.addEventListener('mousemove', this._boundHandleMouseMove);
        
        this.refreshUI();
    }

    hide() {
        if (this.panel) {
            this.panel.style.display = 'none';
        }
        if (this.maskListPanel) {
            this.maskListPanel.style.display = 'none';
        }
        this.isActive = false;
        this.selectedMask = null;
        this.currentPolygonVertices = [];
        this.isDragging = false;
        this.draggedVertexInfo = null;

        this.engine.canvas.removeEventListener('mousedown', this._boundHandleMouseDown);
        this.engine.canvas.removeEventListener('mouseup', this._boundHandleMouseUp);
        this.engine.canvas.removeEventListener('click', this._boundHandleMapClick);
        this.engine.canvas.removeEventListener('dblclick', this._boundFinalizePolygon);
        this.engine.canvas.removeEventListener('mousemove', this._boundHandleMouseMove);
    }
    
    refreshUI() {
        if (!this.panel) return;
        this.updatePropertiesPanel();
        this.updateMaskList();
    }

    updatePropertiesPanel() {
        if (!this.propertiesSection) return;

        this.propertiesSection.innerHTML = ''; // Clear previous properties
        
        if (this.currentTool === 'edit_points' && this.selectedMask) {
            this.propertiesSection.style.display = 'flex';
            // Show only Finish button and properties when editing
        } else if (this.currentTool === 'select' && this.selectedMask) {
            this.propertiesSection.style.display = 'flex';
        } else {
            this.propertiesSection.style.display = 'none';
            return;
        }

        if (this.selectedMask) {
            const title = document.createElement('h4');
            title.textContent = `${this.selectedMask.type.charAt(0).toUpperCase() + this.selectedMask.type.slice(1)} Mask Properties`;
            this.propertiesSection.appendChild(title);
            
            // Add Edit/Finish buttons
            if (this.currentTool === 'edit_points') {
                const finishBtn = document.createElement('button');
                finishBtn.textContent = 'Finish Editing Shape';
                finishBtn.onclick = () => {
                    this.currentTool = 'select';
                    this.isDragging = false;
                    this.draggedVertexInfo = null;
                    this.updatePropertiesPanel();
                };
                this.propertiesSection.appendChild(finishBtn);
            } else {
                const editBtn = document.createElement('button');
                editBtn.textContent = 'Edit Shape';
                editBtn.onclick = () => {
                    this.currentTool = 'edit_points';
                    this.updatePropertiesPanel();
                };
                this.propertiesSection.appendChild(editBtn);
            }

            this._createColorInput(this.propertiesSection, 'Color', this.selectedMask.color || '#FFFFFF', (val) => {
                this.map.updateLightMask(this.selectedMask.id, { color: val });
            });
            
            this._createRangeInput(this.propertiesSection, 'Intensity', 0, 1, 0.01, this.selectedMask.intensity, (val) => {
                this.map.updateLightMask(this.selectedMask.id, { intensity: parseFloat(val) });
            });

            this._createRangeInput(this.propertiesSection, 'Blur/Falloff', 0, 250, 1, this.selectedMask.blur, (val) => {
                this.map.updateLightMask(this.selectedMask.id, { blur: parseInt(val) });
            });

            this._createSelect(
                this.propertiesSection, 'Blend Mode', 
                ['source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'add', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'],
                this.selectedMask.blendMode,
                (val) => { this.map.updateLightMask(this.selectedMask.id, { blendMode: val }); }
            );

            this._createCheckbox(this.propertiesSection, 'Visible', this.selectedMask.visible !== false, (val) => {
                this.map.updateLightMask(this.selectedMask.id, { visible: val });
            });

            // --- Smoothing Controls ---
            this._createCheckbox(this.propertiesSection, 'Smooth Shape', this.selectedMask.smoothing, (val) => {
                this.map.updateLightMask(this.selectedMask.id, { smoothing: val });
                this.selectedMask.smoothing = val; // Update local state
                this.updatePropertiesPanel(); // Re-render to show/hide tension slider
            });

            if (this.selectedMask.smoothing) {
                this._createRangeInput(this.propertiesSection, 'Smoothing Tension', 0, 1, 0.1, this.selectedMask.smoothingTension || 0.5, (val) => {
                    this.map.updateLightMask(this.selectedMask.id, { smoothingTension: parseFloat(val) });
                });
            }

            // --- Flicker Controls ---
            this._createCheckbox(this.propertiesSection, 'Flicker', this.selectedMask.flicker, (val) => {
                this.map.updateLightMask(this.selectedMask.id, { flicker: val });
                this.selectedMask.flicker = val; // Update local state
                this.updatePropertiesPanel(); // Re-render to show/hide flicker controls
            });

            if (this.selectedMask.flicker) {
                this._createRangeInput(this.propertiesSection, 'Flicker Intensity', 0, 0.5, 0.01, this.selectedMask.flickerIntensity || 0.1, (val) => {
                    this.map.updateLightMask(this.selectedMask.id, { flickerIntensity: parseFloat(val) });
                });
                this._createRangeInput(this.propertiesSection, 'Flicker Speed', 1, 30, 1, this.selectedMask.flickerSpeed || 5, (val) => {
                    this.map.updateLightMask(this.selectedMask.id, { flickerSpeed: parseInt(val) });
                });
            }

            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'Delete Mask';
            removeBtn.style.backgroundColor = '#c0392b';
            removeBtn.onclick = () => {
                this.map.removeLightMask(this.selectedMask.id);
                this.selectedMask = null;
                this.currentTool = 'select'; // Revert to select tool after deletion
                this.updatePropertiesPanel();
                this.updateMaskList(); // Update list to show selection
            };
            this.propertiesSection.appendChild(removeBtn);
        }
    }

    handleMouseDown(event) {
        if (!this.isActive || this.currentTool !== 'edit_points' || !this.selectedMask) return;

        const { worldX, worldY } = this._getMouseWorldCoords(event);
        const handleRadius = 5 / this.engine.zoomLevel;
        const handleRadiusSq = handleRadius * handleRadius;

        for (let i = 0; i < this.selectedMask.vertices.length; i++) {
            const vertex = this.selectedMask.vertices[i];
            const dx = worldX - vertex.x;
            const dy = worldY - vertex.y;
            if ((dx * dx + dy * dy) < handleRadiusSq) {
                this.isDragging = true;
                this.draggedVertexInfo = {
                    mask: this.selectedMask,
                    vertexIndex: i
                };
                event.stopPropagation(); // Prevent click from selecting another mask
                return;
            }
        }
    }

    handleMouseUp(event) {
        if (!this.isActive) return;
        this.isDragging = false;
        this.draggedVertexInfo = null;
    }

    handleMapClick(event) {
        if (!this.isActive || this.isDragging) return;

        const { worldX, worldY } = this._getMouseWorldCoords(event);

        if (this.currentTool === 'place_mask') {
            let vertexToAddX = worldX;
            let vertexToAddY = worldY;

            if (this.snapToGrid) {
                const mapCoords = this.map.screenToMap(worldX, worldY);
                const snappedMapX = Math.round(mapCoords.x);
                const snappedMapY = Math.round(mapCoords.y);
                const snappedWorldPos = this.map.mapToScreen(snappedMapX, snappedMapY);
                vertexToAddX = snappedWorldPos.x;
                vertexToAddY = snappedWorldPos.y;
            }

            const newVertex = { x: vertexToAddX, y: vertexToAddY };
            this.currentPolygonVertices.push(newVertex);

            if (this.currentPolygonVertices.length >= 3) {
                const firstVertex = this.currentPolygonVertices[0];
                const dx = newVertex.x - firstVertex.x;
                const dy = newVertex.y - firstVertex.y;
                if ((dx * dx + dy * dy) < POLYGON_CLOSE_DISTANCE_SQ) {
                    this.finalizeCurrentPolygon();
                }
            }
        } else if (this.currentTool === 'select') {
            const clickedMask = this.map.findLightMaskAt(worldX, worldY);
            this.selectedMask = clickedMask;
            this.updatePropertiesPanel();
            this.updateMaskList(); // Update list to show selection
        }
    }

    finalizeCurrentPolygon() {
        if (this.currentTool !== 'place_mask' || this.currentPolygonVertices.length < 3) {
            this.currentPolygonVertices = [];
            return;
        }

        const verticesToSave = [...this.currentPolygonVertices];
        // Remove the last point if it was the one used to close the shape
        const lastV = verticesToSave[verticesToSave.length - 1];
        const firstV = verticesToSave[0];
        const dx = lastV.x - firstV.x;
        const dy = lastV.y - firstV.y;
        if ((dx * dx + dy * dy) < POLYGON_CLOSE_DISTANCE_SQ) {
            verticesToSave.pop();
        }

        if (verticesToSave.length >= 3) {
            this.map.addLightMask({
                type: this.currentMaskType,
                vertices: verticesToSave,
                color: this.currentMaskType === 'light' ? '#ffffcc' : '#000000',
                intensity: this.currentMaskType === 'light' ? 0.3 : 0.4,
                blur: 15,
                blendMode: this.currentMaskType === 'light' ? 'add' : 'multiply',
                visible: true,
                smoothing: false,
                smoothingTension: 0.5,
                flicker: false,
                flickerIntensity: 0.1,
                flickerSpeed: 5,
            });
        }
        
        this.currentPolygonVertices = []; // Reset for next polygon
        this.currentTool = 'select'; // Revert to select tool
        this.updateMaskList(); // Refresh list to show new mask
    }

    handleMouseMove(event) {
        if (!this.isActive) return;
        const { worldX, worldY } = this._getMouseWorldCoords(event);

        if (this.isDragging && this.draggedVertexInfo) {
            let newX = worldX;
            let newY = worldY;

            if (this.snapToGrid) {
                const mapCoords = this.map.screenToMap(worldX, worldY);
                const snappedMapX = Math.round(mapCoords.x);
                const snappedMapY = Math.round(mapCoords.y);
                const snappedWorldPos = this.map.mapToScreen(snappedMapX, snappedMapY);
                newX = snappedWorldPos.x;
                newY = snappedWorldPos.y;
            }

            // Update the vertex position in the selected mask's data
            const { mask, vertexIndex } = this.draggedVertexInfo;
            mask.vertices[vertexIndex] = { x: newX, y: newY };

            // Tell the map to update, which will trigger a re-render by the light system
            this.map.updateLightMask(mask.id, { vertices: mask.vertices });

        } else {
             // For previewing placement of new vertices
             if (this.snapToGrid && this.currentTool === 'place_mask') {
                const mapCoords = this.map.screenToMap(worldX, worldY);
                const snappedMapX = Math.round(mapCoords.x);
                const snappedMapY = Math.round(mapCoords.y);
                const snappedWorldPos = this.map.mapToScreen(snappedMapX, snappedMapY);
                this.currentMouseWorldPos = snappedWorldPos;
             } else {
                this.currentMouseWorldPos = { x: worldX, y: worldY };
             }
        }
    }

    renderOverlay(ctx) {
        if (!this.isActive) return;

        // Draw existing light/shadow mask polygons
        for (const mask of this.map.getLightingData().masks) {
            if (!mask.vertices || mask.vertices.length < 2) continue;
            
            ctx.strokeStyle = (this.selectedMask && this.selectedMask.id === mask.id) ? 'yellow' : (mask.type === 'light' ? 'cyan' : 'magenta');
            ctx.lineWidth = 1.5 / this.engine.zoomLevel;
            ctx.setLineDash([5, 5]);

            ctx.beginPath();
            if (mask.smoothing) {
                drawCardinalSpline(ctx, mask.vertices, mask.smoothingTension || 0.5, true);
            } else {
                ctx.moveTo(mask.vertices[0].x, mask.vertices[0].y);
                for(let i = 1; i < mask.vertices.length; i++) {
                    ctx.lineTo(mask.vertices[i].x, mask.vertices[i].y);
                }
                ctx.closePath();
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw handles if editing a selected mask
        if (this.currentTool === 'edit_points' && this.selectedMask) {
            ctx.fillStyle = 'white';
            const handleRadius = 4 / this.engine.zoomLevel;
            for (const vertex of this.selectedMask.vertices) {
                ctx.beginPath();
                ctx.arc(vertex.x, vertex.y, handleRadius, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Draw polygon being created
        if (this.currentTool === 'place_mask' && this.currentPolygonVertices.length > 0) {
            ctx.strokeStyle = this.currentMaskType === 'light' ? 'rgba(0, 255, 255, 0.8)' : 'rgba(255, 0, 255, 0.8)';
            ctx.lineWidth = 2 / this.engine.zoomLevel;

            ctx.beginPath();
            ctx.moveTo(this.currentPolygonVertices[0].x, this.currentPolygonVertices[0].y);
            for (let i = 1; i < this.currentPolygonVertices.length; i++) {
                ctx.lineTo(this.currentPolygonVertices[i].x, this.currentPolygonVertices[i].y);
            }
            ctx.lineTo(this.currentMouseWorldPos.x, this.currentMouseWorldPos.y);
            ctx.stroke();

            // Draw vertices
            ctx.fillStyle = 'white';
            for (const vertex of this.currentPolygonVertices) {
                ctx.beginPath();
                ctx.arc(vertex.x, vertex.y, 3 / this.engine.zoomLevel, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    _getMouseWorldCoords(event) {
        const canvasRect = this.engine.canvas.getBoundingClientRect();
        const clickX = (event.clientX - canvasRect.left) / this.engine.zoomLevel;
        const clickY = (event.clientY - canvasRect.top) / this.engine.zoomLevel;

        const effectiveCanvasWidth = this.engine.canvas.width / this.engine.zoomLevel;
        const effectiveCanvasHeight = this.engine.canvas.height / this.engine.zoomLevel;
        const viewOriginX = this.map.cameraX - effectiveCanvasWidth / 2;
        const viewOriginY = this.map.cameraY - effectiveCanvasHeight / 2;
        
        return { 
            worldX: clickX + viewOriginX, 
            worldY: clickY + viewOriginY 
        };
    }

    // --- New UI Methods for Mask List ---
    updateMaskList() {
        if (!this.maskListContent) return;
        this.maskListContent.innerHTML = '';
        const masks = this.map.getLightingData().masks;

        if (masks.length === 0) {
            const emptyText = document.createElement('p');
            emptyText.textContent = 'No masks on this map.';
            emptyText.style.textAlign = 'center';
            emptyText.style.fontSize = '0.9em';
            this.maskListContent.appendChild(emptyText);
            return;
        }

        const list = document.createElement('ul');
        list.style.listStyle = 'none';
        list.style.padding = '0';
        list.style.margin = '0';

        // Iterate in reverse to show top layers first
        for (let i = masks.length - 1; i >= 0; i--) {
            const mask = masks[i];
            const item = document.createElement('li');
            item.className = 'light-mask-list-item';
            if (this.selectedMask && this.selectedMask.id === mask.id) {
                item.classList.add('selected');
            }

            const nameSpan = document.createElement('span');
            nameSpan.textContent = `Mask ${i + 1} (${mask.type})`;
            nameSpan.style.cursor = 'pointer';
            nameSpan.onclick = () => {
                this.selectedMask = mask;
                this.currentTool = 'select';
                this.updatePropertiesPanel();
                this.updateMaskList(); // to update selection style
            };

            const controlsDiv = document.createElement('div');
            const upBtn = document.createElement('button');
            upBtn.textContent = '↑';
            if (i === masks.length - 1) upBtn.disabled = true;
            upBtn.onclick = () => this.moveMask(mask.id, 'up');

            const downBtn = document.createElement('button');
            downBtn.textContent = '↓';
            if (i === 0) downBtn.disabled = true;
            downBtn.onclick = () => this.moveMask(mask.id, 'down');

            controlsDiv.appendChild(upBtn);
            controlsDiv.appendChild(downBtn);
            item.appendChild(nameSpan);
            item.appendChild(controlsDiv);
            list.appendChild(item);
        }

        this.maskListContent.appendChild(list);
    }
    
    moveMask(maskId, direction) {
        const masks = this.map.getLightingData().masks;
        const index = masks.findIndex(m => m.id === maskId);

        if (index === -1) return;

        // Note: 'up' in the UI means a higher index in the array (rendered later/on top)
        if (direction === 'up' && index < masks.length - 1) {
            [masks[index], masks[index + 1]] = [masks[index + 1], masks[index]];
        } else if (direction === 'down' && index > 0) {
            [masks[index], masks[index - 1]] = [masks[index - 1], masks[index]];
        }

        this.engine.lightSystem.updateData(this.map.getLightingData());
        this.updateMaskList();
    }

    // --- UI Helper Methods ---
    _createSection(parent, title) {
        const section = document.createElement('div');
        section.className = 'light-editor-section';
        const h4 = document.createElement('h4');
        h4.textContent = title;
        section.appendChild(h4);
        parent.appendChild(section);
        return section;
    }

    _createColorInput(parent, labelText, value, callback) {
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'color';
        input.value = this._rgbToHex(value);
        input.oninput = (e) => callback(e.target.value);
        label.appendChild(input);
        parent.appendChild(label);
    }
    
    _createRangeInput(parent, labelText, min, max, step, value, callback) {
        const label = document.createElement('label');
        const valueSpan = document.createElement('span');
        valueSpan.textContent = ` ${parseFloat(value).toFixed(2)}`;
        
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'range';
        input.min = min;
        input.max = max;
        input.step = step;
        input.value = value;
        input.oninput = (e) => {
            callback(e.target.value);
            valueSpan.textContent = ` ${parseFloat(e.target.value).toFixed(2)}`;
        };
        label.appendChild(input);
        label.appendChild(valueSpan);
        parent.appendChild(label);
    }
    
    _createCheckbox(parent, labelText, isChecked, callback) {
        const label = document.createElement('label');
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.cursor = 'pointer';
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = isChecked;
        input.style.marginRight = '8px';
        input.onchange = (e) => callback(e.target.checked);

        const text = document.createElement('span');
        text.textContent = labelText;
        
        label.appendChild(input);
        label.appendChild(text);
        parent.appendChild(label);
    }

    _createSelect(parent, labelText, options, value, callback) {
        const label = document.createElement('label');
        label.textContent = labelText;
        const select = document.createElement('select');
        select.style.width = '100%';
        select.style.backgroundColor = '#3B322C';
        select.style.color = '#EFEBE0';
        select.style.border = '1px solid #8C6D56';
        select.style.padding = '4px';

        options.forEach(opt => {
            const optionEl = document.createElement('option');
            optionEl.value = opt;
            optionEl.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
            if (opt === value) optionEl.selected = true;
            select.appendChild(optionEl);
        });

        select.onchange = (e) => callback(e.target.value);
        label.appendChild(select);
        parent.appendChild(label);
    }
    
    _rgbToHex(rgba) {
        if (!rgba || typeof rgba !== 'string') return '#ffffff';
        if (rgba.startsWith('#')) return rgba;
        const parts = rgba.match(/(\d+)/g);
        if (!parts || parts.length < 3) return '#000000';
        return '#' + parts.slice(0, 3).map(part => {
            const hex = parseInt(part).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }
}

export default LightEditor;