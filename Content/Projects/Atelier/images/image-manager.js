class ImageManagerPanel {
    constructor(panelElementId, app) {
        this.app = app;
        this.panel = document.getElementById(panelElementId);
        this.contentContainer = this.panel.querySelector('.panel-content');
        this.dragHandle = this.panel.querySelector('.drag-handle');
        this.closeBtn = this.panel.querySelector('.panel-close-btn');

        this.images = []; // [{ id, name, dataUrl, width, height }]

        this.isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;

        this.init();
    }

    init() {
        this.render();
        this.attachListeners();
        this.loadPosition();
    }

    render() {
        this.contentContainer.innerHTML = `
            <div id="image-inventory">
                <!-- Image items will be rendered here -->
            </div>
            <div class="image-upload-area">
                <input type="file" id="image-file-input" accept="image/*" style="display: none;">
                <button id="upload-image-btn" class="action-btn icon-btn" title="Import Image">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </button>
                <button id="clear-all-images-btn" class="action-btn icon-btn danger" title="Clear All Images">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </div>
        `;
        this.renderInventory();
    }

    renderInventory() {
        const inventoryList = this.contentContainer.querySelector('#image-inventory');
        inventoryList.innerHTML = ''; // Clear existing list

        if (this.images.length === 0) {
            inventoryList.innerHTML = '<p style="text-align: center; color: #868e96; font-size: 13px; padding: 16px;">No images imported yet.</p>';
            return;
        }

        this.images.forEach(img => {
            const item = document.createElement('div');
            item.className = 'image-item';
            item.dataset.id = img.id;

            const thumbnail = document.createElement('img');
            thumbnail.className = 'thumbnail';
            thumbnail.src = img.dataUrl;
            thumbnail.alt = img.name;

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'image-item-actions';

            const viewBtn = document.createElement('button');
            viewBtn.className = 'action-btn icon-btn mini-btn';
            viewBtn.title = 'View Image';
            viewBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
            viewBtn.addEventListener('click', () => this.app.showImageViewer(img.id));

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn icon-btn danger mini-btn';
            deleteBtn.title = 'Delete Image';
            deleteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
            deleteBtn.addEventListener('click', () => this.deleteImage(img.id));

            actionsDiv.appendChild(viewBtn);
            actionsDiv.appendChild(deleteBtn);

            item.appendChild(thumbnail);
            item.appendChild(actionsDiv);

            inventoryList.appendChild(item);
        });
    }

    attachListeners() {
        // Draggable functionality
        this.dragHandle.addEventListener('mousedown', (e) => this.startDrag(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.endDrag());

        // Close button
        this.closeBtn.addEventListener('click', () => this.hide());

        // Import image
        const fileInput = this.contentContainer.querySelector('#image-file-input');
        const uploadBtn = this.contentContainer.querySelector('#upload-image-btn');

        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.importImage(e.target.files[0]));

        // Clear all images
        this.contentContainer.querySelector('#clear-all-images-btn').addEventListener('click', () => this.clearAllImages());

        // Prevent dragging when interacting with panel content, except for scrollbar
        this.contentContainer.addEventListener('mousedown', (e) => {
            // Allow dragging if it's explicitly on a scrollbar area
            const isScrollbarClick = e.offsetX > e.target.clientWidth || e.offsetY > e.target.clientHeight;
            if (!isScrollbarClick) {
                e.stopPropagation();
            }
        });

        // Bring panel to front when drag handle is clicked
        this.dragHandle.addEventListener('mousedown', () => {
            this.app.bringPanelToFront(this.panel);
        });
    }

    startDrag(e) {
        this.isDragging = true;
        this.dragOffsetX = e.clientX - this.panel.getBoundingClientRect().left;
        this.dragOffsetY = e.clientY - this.panel.getBoundingClientRect().top;
        this.panel.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
    }

    drag(e) {
        if (!this.isDragging) return;

        let newX = e.clientX - this.dragOffsetX;
        let newY = e.clientY - this.dragOffsetY;

        const toolbar = document.getElementById('toolbar');
        const toolbarHeight = toolbar ? toolbar.offsetHeight : 0;

        newX = Math.max(0, Math.min(newX, window.innerWidth - this.panel.offsetWidth));
        newY = Math.max(toolbarHeight, Math.min(newY, window.innerHeight - this.panel.offsetHeight));

        this.panel.style.left = `${newX}px`;
        this.panel.style.top = `${newY}px`;
    }

    endDrag() {
        this.isDragging = false;
        this.panel.style.cursor = 'grab';
        document.body.style.userSelect = 'auto';
        this.savePosition();
    }

    importImage(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            const img = new Image();
            img.onload = () => {
                const newImage = {
                    id: Date.now(),
                    name: file.name,
                    dataUrl: dataUrl,
                    width: img.width,
                    height: img.height
                };
                this.images.push(newImage);
                this.renderInventory();
            };
            img.onerror = () => {
                alert('Could not load image file.');
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    }

    deleteImage(id) {
        if (!confirm('Are you sure you want to delete this image?')) return;

        const initialLength = this.images.length;
        this.images = this.images.filter(img => img.id !== id);
        if (this.images.length < initialLength) {
            this.renderInventory();
            this.app.imageDeleted(id); // Notify app
        }
    }

    clearAllImages() {
        if (!confirm('Are you sure you want to delete ALL imported images?')) {
            return;
        }
        this.images = [];
        this.renderInventory();
        this.app.clearAllImages(); // Notify app
    }

    getImageById(id) {
        return this.images.find(img => img.id === id);
    }

    savePosition() {
        const position = {
            left: this.panel.style.left,
            top: this.panel.style.top,
            width: this.panel.style.width,
            height: this.panel.style.height,
            zIndex: this.panel.style.zIndex // Save z-index
        };
        localStorage.setItem(`${this.STORAGE_KEY}-position`, JSON.stringify(position));
    }

    loadPosition() {
        const savedPosition = localStorage.getItem(`${this.STORAGE_KEY}-position`);
        const toolbar = document.getElementById('toolbar');
        const toolbarHeight = toolbar ? toolbar.offsetHeight : 0;

        if (savedPosition) {
            const position = JSON.parse(savedPosition);
            this.panel.style.left = position.left;
            this.panel.style.top = `${Math.max(toolbarHeight, parseFloat(position.top))}px`;
            this.panel.style.width = position.width || '';
            this.panel.style.height = position.height || '';
            this.panel.style.zIndex = position.zIndex || this.app.nextZIndex; // Restore z-index
        } else {
            // Default position if not saved
            this.panel.style.left = '20px';
            this.panel.style.top = `${toolbarHeight + 20}px`;
            this.panel.style.zIndex = this.app.nextZIndex; // Assign initial z-index
            this.savePosition(); // Save this default position
        }
    }

    show() {
        this.panel.classList.remove('hidden');
        this.loadPosition(); // Ensure position is loaded on show
        this.renderInventory(); // Re-render in case anything changed
        this.app.bringPanelToFront(this.panel); // Bring to front when shown
    }

    hide() {
        this.panel.classList.add('hidden');
        this.savePosition();
    }
}