class ReferenceImage {
    constructor(id, img, file, handler) {
        this.id = id;
        this.img = img;
        this.filename = file ? file.name : "Ref Image";
        this.handler = handler;
        this.fileBlob = file instanceof Blob ? file : null;
        
        this.width = img.width;
        this.height = img.height;
        
        // Create canvas for rendering the reference image
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.className = 'reference-canvas-item';
        this.ctx = this.canvas.getContext('2d');
        this.ctx.drawImage(img, 0, 0);
        
        document.body.appendChild(this.canvas);
        
        // Initial defaults
        this.scale = 10.0; // Default to 1.0x visual scale (which is 10.0 internally)
        this.opacity = 0.5;
        this.locked = false; // Move mode by default
        this.visible = true; // Visible by default
        
        // Center position relative to painting viewport
        const paint = handler.paint;
        const canvasLeft = paint.paintingRectangle.left;
        const canvasTop = paint.canvas.height - (paint.paintingRectangle.bottom + paint.paintingRectangle.height);
        const currentZoom = paint.zoomLevel || 1.0;
        
        const screenCenterX = window.innerWidth / 2;
        const screenCenterY = window.innerHeight / 2;
        
        this.relX = (screenCenterX - canvasLeft) / currentZoom;
        this.relY = (screenCenterY - canvasTop) / currentZoom;
        
        // Scale down if too large for screen
        if (this.width > window.innerWidth * 0.5 || this.height > window.innerHeight * 0.5) {
            const visualInitScale = Math.min(window.innerWidth * 0.4 / this.width, window.innerHeight * 0.4 / this.height);
            this.scale = Math.max(0.1, Math.min(50.0, visualInitScale * 10.0));
        }
        
        this.initEvents();
    }
    
    initEvents() {
        let isDragging = false;
        let lastMouseX = 0;
        let lastMouseY = 0;
        
        const onStart = (clientX, clientY) => {
            if (this.locked || !this.visible) return;
            this.handler.selectImage(this);
            isDragging = true;
            lastMouseX = clientX;
            lastMouseY = clientY;
            this.canvas.style.cursor = 'grabbing';
        };
        
        const onMove = (clientX, clientY) => {
            if (!isDragging || this.locked || !this.visible) return;
            const dx = clientX - lastMouseX;
            const dy = clientY - lastMouseY;
            
            const paint = this.handler.paint;
            const canvasLeft = paint.paintingRectangle.left;
            const canvasTop = paint.canvas.height - (paint.paintingRectangle.bottom + paint.paintingRectangle.height);
            const currentZoom = paint.zoomLevel || 1.0;
            
            let screenCenterX = canvasLeft + this.relX * currentZoom;
            let screenCenterY = canvasTop + this.relY * currentZoom;
            
            if (paint.isMirrored) {
                screenCenterX = paint.canvas.width - screenCenterX;
            }
            
            screenCenterX += dx;
            screenCenterY += dy;
            
            if (paint.isMirrored) {
                screenCenterX = paint.canvas.width - screenCenterX;
            }
            
            this.relX = (screenCenterX - canvasLeft) / currentZoom;
            this.relY = (screenCenterY - canvasTop) / currentZoom;
            
            lastMouseX = clientX;
            lastMouseY = clientY;
            
            this.updateTransform();
            this.handler.saveImagesToIndexedDBDebounced();
        };
        
        const onEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            this.canvas.style.cursor = 'grab';
            this.handler.saveImagesToIndexedDB();
        };
        
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || !this.visible) return;
            const paint = this.handler.paint;
            if (e.altKey || paint.altDown || paint.currentTool === 'colorpick') {
                e.stopPropagation();
                this.sampleColorAt(e.clientX, e.clientY);
                return;
            }
            if (this.locked) return;
            e.stopPropagation();
            onStart(e.clientX, e.clientY);
        });
        
        document.addEventListener('mousemove', (e) => {
            onMove(e.clientX, e.clientY);
        });
        
        document.addEventListener('mouseup', () => {
            onEnd();
        });
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1 && this.visible) {
                const paint = this.handler.paint;
                if (e.altKey || paint.altDown || paint.currentTool === 'colorpick') {
                    e.stopPropagation();
                    this.sampleColorAt(e.touches[0].clientX, e.touches[0].clientY);
                    return;
                }
                if (this.locked) return;
                e.stopPropagation();
                onStart(e.touches[0].clientX, e.touches[0].clientY);
            }
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && this.visible) {
                onMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        });
        
        this.canvas.addEventListener('touchend', () => {
            onEnd();
        });
        
        // Select & sampling events
        this.canvas.addEventListener('dblclick', (e) => {
            if (!this.visible) return;
            e.stopPropagation();
            this.sampleColorAt(e.clientX, e.clientY);
        });
        
        this.canvas.addEventListener('click', (e) => {
            if (!this.visible) return;
            e.stopPropagation();
            const paint = this.handler.paint;
            if (e.altKey || paint.altDown || paint.currentTool === 'colorpick') {
                return;
            }
            this.handler.selectImage(this);
            if (e.shiftKey) {
                this.sampleColorAt(e.clientX, e.clientY);
            }
        });
    }
    
    sampleColorAt(clientX, clientY) {
        if (!this.visible) return;
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        
        let clickX = ((clientX - rect.left) / rect.width) * this.width;
        const clickY = ((clientY - rect.top) / rect.height) * this.height;
        
        const paint = this.handler.paint;
        if (paint.isMirrored) {
            clickX = this.width - clickX;
        }
        
        const cx = Math.max(0, Math.min(this.width - 1, Math.floor(clickX)));
        const cy = Math.max(0, Math.min(this.height - 1, Math.floor(clickY)));
        
        const imgData = this.ctx.getImageData(cx, cy, 1, 1).data;
        if (imgData[3] === 0) return;
        
        const r = imgData[0];
        const g = imgData[1];
        const b = imgData[2];
        
        const componentToHex = (c) => {
            const hex = c.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        const hexColor = '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
        const hsv = this.handler.rgbToHsv(r, g, b);
        
        paint.brushColorHSVA = [hsv[0], hsv[1], hsv[2], paint.brushColorHSVA[3]];
        
        const activeIndex = paint.paletteManager.activeIndex;
        paint.paletteManager.setBaseColor(activeIndex, hexColor);
        
        paint.needsRedraw = true;
        paint.renderPalette();
    }
    
    updateTransform() {
        const paint = this.handler.paint;
        const canvasLeft = paint.paintingRectangle.left;
        const canvasTop = paint.canvas.height - (paint.paintingRectangle.bottom + paint.paintingRectangle.height);
        const currentZoom = paint.zoomLevel || 1.0;
        
        let screenCenterX = canvasLeft + this.relX * currentZoom;
        const screenCenterY = canvasTop + this.relY * currentZoom;
        
        const scaleFactor = (this.scale * 0.1) * currentZoom;
        
        if (paint.isMirrored) {
            screenCenterX = paint.canvas.width - screenCenterX;
        }
        
        const screenLeft = screenCenterX - (this.width / 2);
        const screenTop = screenCenterY - (this.height / 2);
        
        const scaleFactorX = paint.isMirrored ? -scaleFactor : scaleFactor;
        const scaleFactorY = scaleFactor;
        this.canvas.style.transform = `translate(${screenLeft}px, ${screenTop}px) scale(${scaleFactorX}, ${scaleFactorY})`;
        this.canvas.style.opacity = this.opacity;
        
        if (!this.visible) {
            this.canvas.style.display = 'none';
        } else {
            this.canvas.style.display = 'block';
        }
        
        if (this.locked) {
            this.canvas.style.pointerEvents = 'none';
            this.canvas.style.cursor = 'default';
            this.canvas.style.border = '3px solid #000000';
            this.canvas.style.outline = 'none';
        } else {
            this.canvas.style.pointerEvents = 'auto';
            this.canvas.style.cursor = 'grab';
            
            if (this.handler.selectedImage === this) {
                this.canvas.style.border = '3px solid #ffaa00';
                this.canvas.style.outline = '2px dashed #ffffff';
            } else {
                this.canvas.style.border = '3px solid #000000';
                this.canvas.style.outline = 'none';
            }
        }
    }
    
    destroy() {
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}

export class ImgHandler {
    constructor(paintInstance) {
        this.paint = paintInstance;
        this.images = [];
        this.selectedImage = null;
        
        // Element references
        this.refWindow = document.getElementById('ref-image-window');
        this.uploadBtn = document.getElementById('ref-upload-btn');
        this.fileInput = document.getElementById('ref-file-input');
        this.opacityVal = document.getElementById('val-ref-opacity');
        this.scaleVal = document.getElementById('val-ref-scale');
        this.modeMoveBtn = document.getElementById('ref-mode-move');
        this.modeSampleBtn = document.getElementById('ref-mode-sample');
        this.clearBtn = document.getElementById('ref-clear-btn');
        this.minimizeBtn = document.getElementById('ref-minimize-btn');
        
        this.init();
    }
    
    init() {
        if (this.uploadBtn && this.fileInput) {
            this.uploadBtn.addEventListener('click', () => this.fileInput.click());
            this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }
        
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => {
                if (this.selectedImage) {
                    this.removeImage(this.selectedImage);
                }
            });
        }
        
        const opSliderEl = document.getElementById('ref-opacity-slider');
        if (opSliderEl) {
            this.opacitySlider = new Slider(opSliderEl, 0.5, 0.0, 1.0, (val) => {
                if (this.selectedImage) {
                    this.selectedImage.opacity = val;
                    this.selectedImage.updateTransform();
                    if (this.opacityVal) {
                        this.opacityVal.textContent = Math.round(val * 100) + '%';
                    }
                    this.saveImagesToIndexedDBDebounced();
                }
            });
        }
        
        const scSliderEl = document.getElementById('ref-scale-slider');
        if (scSliderEl) {
            this.scaleSlider = new Slider(scSliderEl, Math.log(10.0 / 0.1) / Math.log(500), 0.0, 1.0, (t) => {
                if (this.selectedImage) {
                    const scale = 0.1 * Math.pow(500, t);
                    this.selectedImage.scale = scale;
                    this.selectedImage.updateTransform();
                    if (this.scaleVal) {
                        this.scaleVal.textContent = scale.toFixed(1) + 'x';
                    }
                    this.saveImagesToIndexedDBDebounced();
                }
            });
        }
        
        if (this.modeMoveBtn) {
            this.modeMoveBtn.addEventListener('click', () => {
                if (this.selectedImage) {
                    this.selectedImage.locked = false;
                    this.selectImage(this.selectedImage);
                    this.saveImagesToIndexedDB();
                }
            });
        }
        if (this.modeSampleBtn) {
            this.modeSampleBtn.addEventListener('click', () => {
                if (this.selectedImage) {
                    this.selectedImage.locked = true;
                    this.selectImage(this.selectedImage);
                    this.saveImagesToIndexedDB();
                }
            });
        }
        
        if (this.minimizeBtn && this.refWindow) {
            const isMin = localStorage.getItem('ref-window-minimized') === 'true';
            if (isMin) {
                this.refWindow.classList.add('minimized');
                this.minimizeBtn.textContent = '▲';
            } else {
                this.minimizeBtn.textContent = '▼';
            }
            
            this.minimizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isCurrentlyMin = this.refWindow.classList.toggle('minimized');
                this.minimizeBtn.textContent = isCurrentlyMin ? '▲' : '▼';
                localStorage.setItem('ref-window-minimized', isCurrentlyMin ? 'true' : 'false');
                if (!isCurrentlyMin) {
                    setTimeout(() => {
                        if (this.opacitySlider) this.opacitySlider.redraw();
                        if (this.scaleSlider) this.scaleSlider.redraw();
                    }, 50);
                }
            });
        }
        
        // Drag over & drop
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                for (let i = 0; i < e.dataTransfer.files.length; i++) {
                    const file = e.dataTransfer.files[i];
                    if (file.type.startsWith('image/')) {
                        this.loadImageFromFile(file);
                    }
                }
            }
        });
        
        // Fade reference images when hovering over the color palette window
        const paletteWindow = document.getElementById('color-palette-window');
        if (paletteWindow) {
            paletteWindow.addEventListener('mouseenter', () => {
                this.images.forEach(img => {
                    if (img.canvas) {
                        img.canvas.style.opacity = 0.05; // Fade out almost completely so color wheel is visible
                    }
                });
            });
            paletteWindow.addEventListener('mouseleave', () => {
                // If we are currently actively dragging/picking color, don't restore opacity yet
                if (this.paint && this.paint.isPickingColorWheel) {
                    return;
                }
                this.images.forEach(img => {
                    if (img.canvas) {
                        img.canvas.style.opacity = img.opacity;
                    }
                });
            });
        }
        
        // Load stored images
        this.loadImagesFromIndexedDB();
    }
    
    restoreImageOpacities() {
        const paletteWindow = document.getElementById('color-palette-window');
        if (paletteWindow && paletteWindow.matches(':hover')) {
            return;
        }
        this.images.forEach(img => {
            if (img.canvas) {
                img.canvas.style.opacity = img.opacity;
            }
        });
    }
    
    handleFileSelect(e) {
        if (e.target.files && e.target.files.length > 0) {
            for (let i = 0; i < e.target.files.length; i++) {
                this.loadImageFromFile(e.target.files[i]);
            }
        }
        e.target.value = '';
    }
    
    loadImageFromFile(file) {
        const img = new Image();
        img.onload = () => {
            const id = Date.now() + Math.random().toString(36).substr(2, 5);
            const refImg = new ReferenceImage(id, img, file, this);
            this.images.push(refImg);
            this.selectImage(refImg);
            this.saveImagesToIndexedDB();
        };
        img.src = URL.createObjectURL(file);
    }
    
    selectImage(img) {
        this.selectedImage = img;
        this.images.forEach(i => i.updateTransform());
        
        if (img) {
            if (this.opacitySlider) {
                this.opacitySlider.setValue(img.opacity);
            }
            if (this.scaleSlider) {
                const t = Math.log(img.scale / 0.1) / Math.log(500);
                this.scaleSlider.setValue(Math.max(0.0, Math.min(1.0, t)));
            }
            if (this.opacityVal) {
                this.opacityVal.textContent = Math.round(img.opacity * 100) + '%';
            }
            if (this.scaleVal) {
                this.scaleVal.textContent = img.scale.toFixed(1) + 'x';
            }
            if (this.modeMoveBtn && this.modeSampleBtn) {
                if (img.locked) {
                    this.modeMoveBtn.classList.remove('active');
                    this.modeSampleBtn.classList.add('active');
                } else {
                    this.modeMoveBtn.classList.add('active');
                    this.modeSampleBtn.classList.remove('active');
                }
            }
        }
        
        this.updateImagesListUI();
    }
    
    removeImage(img) {
        const index = this.images.indexOf(img);
        if (index > -1) {
            img.destroy();
            this.images.splice(index, 1);
            if (this.selectedImage === img) {
                this.selectedImage = this.images.length > 0 ? this.images[this.images.length - 1] : null;
            }
            this.selectImage(this.selectedImage);
            this.saveImagesToIndexedDB();
        }
    }
    
    updateImagesListUI() {
        const listContainer = document.getElementById('ref-images-list');
        const itemsContainer = document.getElementById('ref-images-items');
        if (!listContainer || !itemsContainer) return;
        
        if (this.images.length === 0) {
            listContainer.style.display = 'none';
            return;
        }
        
        listContainer.style.display = 'block';
        
        itemsContainer.innerHTML = '';
        this.images.forEach((img, index) => {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.justifyContent = 'space-between';
            item.style.padding = '3px 6px';
            item.style.border = '2px solid #000000';
            item.style.fontFamily = "'JetBrains Mono', monospace";
            item.style.fontSize = '9px';
            item.style.cursor = 'pointer';
            
            if (this.selectedImage === img) {
                item.style.backgroundColor = '#ffaa00';
                item.style.color = '#000000';
                item.style.fontWeight = 'bold';
            } else {
                item.style.backgroundColor = '#ffffff';
                item.style.color = '#000000';
            }
            
            const nameSpan = document.createElement('span');
            nameSpan.style.whiteSpace = 'nowrap';
            nameSpan.style.overflow = 'hidden';
            nameSpan.style.textOverflow = 'ellipsis';
            nameSpan.style.flex = '1';
            nameSpan.style.marginRight = '4px';
            nameSpan.textContent = `${index + 1}. ${img.filename}`;
            
            item.appendChild(nameSpan);
            
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectImage(img);
            });
            
            // Container for right side controls
            const controlsDiv = document.createElement('div');
            controlsDiv.style.display = 'flex';
            controlsDiv.style.alignItems = 'center';
            controlsDiv.style.gap = '6px';
            controlsDiv.style.flexShrink = '0';
            
            // Lock Toggle Button (Clickable!)
            const toggleLockBtn = document.createElement('button');
            toggleLockBtn.textContent = img.locked ? '🔒' : '⚙️';
            toggleLockBtn.style.border = 'none';
            toggleLockBtn.style.background = 'none';
            toggleLockBtn.style.cursor = 'pointer';
            toggleLockBtn.style.padding = '0 2px';
            toggleLockBtn.style.fontSize = '10px';
            toggleLockBtn.title = img.locked ? 'Locked (Click to unlock/move)' : 'Unlocked/Move mode (Click to lock)';
            toggleLockBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                img.locked = !img.locked;
                img.updateTransform();
                this.selectImage(img);
                this.saveImagesToIndexedDB();
            });
            controlsDiv.appendChild(toggleLockBtn);
            
            // Eye Toggle Button
            const toggleVisibleBtn = document.createElement('button');
            toggleVisibleBtn.textContent = img.visible !== false ? '👁️' : '🙈';
            toggleVisibleBtn.style.border = 'none';
            toggleVisibleBtn.style.background = 'none';
            toggleVisibleBtn.style.cursor = 'pointer';
            toggleVisibleBtn.style.padding = '0 2px';
            toggleVisibleBtn.style.fontSize = '10px';
            toggleVisibleBtn.title = img.visible !== false ? 'Hide image' : 'Show image';
            toggleVisibleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                img.visible = img.visible === false ? true : false;
                img.canvas.style.display = img.visible ? 'block' : 'none';
                if (img.visible) {
                    img.updateTransform();
                }
                this.saveImagesToIndexedDB();
                this.updateImagesListUI();
            });
            controlsDiv.appendChild(toggleVisibleBtn);
            
            // Delete button
            const delBtn = document.createElement('button');
            delBtn.textContent = '✕';
            delBtn.style.border = 'none';
            delBtn.style.background = 'none';
            delBtn.style.cursor = 'pointer';
            delBtn.style.fontWeight = 'bold';
            delBtn.style.padding = '0 2px';
            delBtn.style.fontSize = '9px';
            delBtn.title = 'Remove reference image';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeImage(img);
            });
            controlsDiv.appendChild(delBtn);
            
            item.appendChild(controlsDiv);
            itemsContainer.appendChild(item);
        });
    }
    
    updateAllTransforms() {
        this.images.forEach(img => img.updateTransform());
    }
    
    trySampleColor(clientX, clientY) {
        for (let i = this.images.length - 1; i >= 0; i--) {
            const img = this.images[i];
            if (img.visible === false) continue;
            const rect = img.canvas.getBoundingClientRect();
            if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
                img.sampleColorAt(clientX, clientY);
                return true;
            }
        }
        return false;
    }
    
    saveImagesToIndexedDBDebounced() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            this.saveImagesToIndexedDB();
            this.saveTimeout = null;
        }, 150);
    }
    
    saveImagesToIndexedDB() {
        try {
            const dataURLtoBlob = function(dataurl) {
                var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
                    bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
                while(n--){
                    u8arr[n] = bstr.charCodeAt(n);
                }
                return new Blob([u8arr], {type:mime});
            };

            const dataToSave = this.images.map(img => {
                let blob = img.fileBlob;
                if (!blob && img.img && img.img.src && img.img.src.startsWith('data:')) {
                    try {
                        blob = dataURLtoBlob(img.img.src);
                        img.fileBlob = blob;
                    } catch (e) {
                        console.error('Failed to convert base64 to blob:', e);
                    }
                }
                return {
                    id: img.id,
                    filename: img.filename,
                    scale: img.scale,
                    opacity: img.opacity,
                    locked: img.locked,
                    visible: img.visible !== false,
                    relX: img.relX,
                    relY: img.relY,
                    blob: blob,
                    src: blob ? null : img.img.src
                };
            });
            
            const projectId = this.paint.activeProjectId || 'default';
            const request = indexedDB.open('FluidPaintDB', 1);
            request.onupgradeneeded = function (event) {
                var db = event.target.result;
                if (!db.objectStoreNames.contains('canvas_store')) {
                    db.createObjectStore('canvas_store');
                }
            };
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['canvas_store'], 'readwrite');
                const store = transaction.objectStore('canvas_store');
                store.put(dataToSave, 'reference_images_' + projectId);
            };
        } catch (e) {
            console.error('Error saving reference images to IndexedDB:', e);
        }
    }
    
    loadImagesFromIndexedDB() {
        this.loadImagesFromProject(this.paint.activeProjectId || 'default');
    }

    loadImagesFromProject(projectId) {
        try {
            const request = indexedDB.open('FluidPaintDB', 1);
            request.onupgradeneeded = function (event) {
                var db = event.target.result;
                if (!db.objectStoreNames.contains('canvas_store')) {
                    db.createObjectStore('canvas_store');
                }
            };
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['canvas_store'], 'readonly');
                const store = transaction.objectStore('canvas_store');
                const getRequest = store.get('reference_images_' + projectId);
                getRequest.onsuccess = (e) => {
                    const savedData = e.target.result;
                    if (!savedData && projectId === 'default') {
                        // Fallback to legacy key 'reference_images'
                        const getLegacy = store.get('reference_images');
                        getLegacy.onsuccess = (ev) => {
                            const legacyData = ev.target.result;
                            if (legacyData) {
                                // Save to reference_images_default
                                const writeTrans = db.transaction(['canvas_store'], 'readwrite');
                                writeTrans.objectStore('canvas_store').put(legacyData, 'reference_images_default');
                                this.applyLoadedImages(legacyData);
                            }
                        };
                    } else if (savedData) {
                        this.applyLoadedImages(savedData);
                    }
                };
            };
        } catch (e) {
            console.error('Error loading reference images from IndexedDB:', e);
        }
    }

    applyLoadedImages(savedData) {
        if (savedData && Array.isArray(savedData)) {
            savedData.forEach(data => {
                const img = new Image();
                img.onload = () => {
                    const fileObj = data.blob ? new File([data.blob], data.filename || "Ref Image", { type: data.blob.type }) : { name: data.filename };
                    const refImg = new ReferenceImage(data.id, img, fileObj, this);
                    if (data.blob) {
                        refImg.fileBlob = data.blob;
                    }
                    let loadedScale = data.scale;
                    if (loadedScale <= 5.0) {
                        loadedScale *= 10.0;
                    }
                    refImg.scale = loadedScale;
                    refImg.opacity = data.opacity;
                    refImg.locked = data.locked;
                    refImg.visible = data.visible !== false;
                    refImg.relX = data.relX;
                    refImg.relY = data.relY;
                    
                    if (!refImg.visible) {
                        refImg.canvas.style.display = 'none';
                    }
                    
                    refImg.updateTransform();
                    this.images.push(refImg);
                    this.selectImage(this.selectedImage || refImg);
                };
                if (data.blob) {
                    img.src = URL.createObjectURL(data.blob);
                } else if (data.src) {
                    img.src = data.src;
                }
            });
        }
    }
    
    rgbToHsv(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, v = max;
        
        const d = max - min;
        s = max === 0 ? 0 : d / max;
        
        if (max === min) {
            h = 0;
        } else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return [h, s, v];
    }
}
