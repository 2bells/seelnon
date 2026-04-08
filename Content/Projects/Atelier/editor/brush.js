class BrushEditorApp {
    constructor() {
        this.brushes = [];
        this.activeBrush = null;
        this.previewCtx = null;

        this.STORAGE_KEY = 'atelier-brushes';
        this.init();
    }

    init() {
        this.loadBrushes();
        this.initPreviewCanvas();
        this.setupUIListeners();

        if (this.brushes.length > 0) {
            this.selectBrush(this.brushes[0]);
        } else {
            this.createNewBrush();
        }
    }

    initPreviewCanvas() {
        const canvas = document.getElementById('preview-canvas');
        const container = document.getElementById('preview-canvas-container');
        const dpr = window.devicePixelRatio || 1;
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        this.previewCtx = canvas.getContext('2d');
        this.previewCtx.scale(dpr, dpr);
    }

    loadBrushes() {
        try {
            const storedBrushes = localStorage.getItem(this.STORAGE_KEY);
            if (storedBrushes) {
                this.brushes = JSON.parse(storedBrushes);
                // Ensure all loaded brushes have the new smudgeStrength property
                this.brushes.forEach(brush => {
                    if (brush.smudgeStrength === undefined) {
                        brush.smudgeStrength = 0;
                    }
                });
            } else {
                // Add default brushes if none exist
                this.brushes = [
                    { id: Date.now(), name: 'Simple Round', size: 20, opacity: 100, blending: 'source-over', hardness: 80, pressureSize: 50, pressureOpacity: 0, smoothing: 20, tip: 'round', smudgeStrength: 0 },
                    { id: Date.now() + 1, name: 'Soft Airbrush', size: 50, opacity: 60, blending: 'source-over', hardness: 10, pressureSize: 80, pressureOpacity: 70, smoothing: 30, tip: 'round', smudgeStrength: 0 },
                    { id: Date.now() + 2, name: 'Basic Eraser', size: 40, opacity: 100, blending: 'destination-out', hardness: 90, pressureSize: 60, pressureOpacity: 0, smoothing: 10, tip: 'round', smudgeStrength: 0 },
                ];
                this.saveBrushes();
            }
        } catch (e) {
            console.error("Failed to load brushes from localStorage", e);
            this.brushes = [];
        }
        this.renderBrushList();
    }

    saveBrushes() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.brushes));
    }

    renderBrushList() {
        const listEl = document.getElementById('brush-list');
        listEl.innerHTML = '';
        this.brushes.forEach(brush => {
            const item = document.createElement('div');
            item.className = 'brush-item';
            item.textContent = brush.name;
            item.dataset.id = brush.id;
            if (this.activeBrush && brush.id === this.activeBrush.id) {
                item.classList.add('active');
            }
            item.addEventListener('click', () => this.selectBrush(brush));
            listEl.appendChild(item);
        });
    }
    
    selectBrush(brush) {
        if (!brush) return;
        this.activeBrush = brush;
        this.updateUIFromBrush();
        this.renderBrushList();
        this.drawPreview();
    }

    updateUIFromBrush() {
        if (!this.activeBrush) return;
        document.getElementById('brush-name').value = this.activeBrush.name;
        
        document.getElementById('brush-size').value = this.activeBrush.size;
        document.getElementById('size-display').textContent = this.activeBrush.size;

        document.getElementById('brush-opacity').value = this.activeBrush.opacity;
        document.getElementById('opacity-display').textContent = this.activeBrush.opacity + '%';

        document.getElementById('blending-mode').value = this.activeBrush.blending;

        document.getElementById('shape-hardness').value = this.activeBrush.hardness;
        document.getElementById('hardness-display').textContent = this.activeBrush.hardness + '%';
        
        document.getElementById('pressure-size').value = this.activeBrush.pressureSize;
        document.getElementById('pressure-size-display').textContent = this.activeBrush.pressureSize + '%';

        document.getElementById('pressure-opacity').value = this.activeBrush.pressureOpacity;
        document.getElementById('pressure-opacity-display').textContent = this.activeBrush.pressureOpacity + '%';

        document.getElementById('brush-smoothing').value = this.activeBrush.smoothing || 0;
        document.getElementById('smoothing-display').textContent = (this.activeBrush.smoothing || 0) + '%';
        
        document.getElementById('tip-shape').value = this.activeBrush.tip || 'round';

        document.getElementById('smudge-strength').value = this.activeBrush.smudgeStrength || 0;
        document.getElementById('smudge-strength-display').textContent = (this.activeBrush.smudgeStrength || 0) + '%';
    }

    updateBrushFromUI() {
        if (!this.activeBrush) return;
        this.activeBrush.name = document.getElementById('brush-name').value;
        this.activeBrush.size = parseInt(document.getElementById('brush-size').value);
        this.activeBrush.opacity = parseInt(document.getElementById('brush-opacity').value);
        this.activeBrush.blending = document.getElementById('blending-mode').value;
        this.activeBrush.hardness = parseInt(document.getElementById('shape-hardness').value);
        this.activeBrush.pressureSize = parseInt(document.getElementById('pressure-size').value);
        this.activeBrush.pressureOpacity = parseInt(document.getElementById('pressure-opacity').value);
        this.activeBrush.smoothing = parseInt(document.getElementById('brush-smoothing').value);
        this.activeBrush.tip = document.getElementById('tip-shape').value;
        this.activeBrush.smudgeStrength = parseInt(document.getElementById('smudge-strength').value); // Update smudge strength
        
        this.saveBrushes();
        this.renderBrushList();
        this.drawPreview();
    }
    
    setupUIListeners() {
        // Brush list actions
        document.getElementById('new-brush-btn').addEventListener('click', () => this.createNewBrush());
        document.getElementById('delete-brush-btn').addEventListener('click', () => this.deleteSelectedBrush());

        // Settings panel
        document.getElementById('brush-name').addEventListener('input', () => this.updateBrushFromUI());
        
        const sliders = [
            { id: 'brush-size', display: 'size-display', suffix: '' },
            { id: 'brush-opacity', display: 'opacity-display', suffix: '%' },
            { id: 'shape-hardness', display: 'hardness-display', suffix: '%' },
            { id: 'pressure-size', display: 'pressure-size-display', suffix: '%' },
            { id: 'pressure-opacity', display: 'pressure-opacity-display', suffix: '%' },
            { id: 'brush-smoothing', display: 'smoothing-display', suffix: '%' },
            { id: 'smudge-strength', display: 'smudge-strength-display', suffix: '%' }, // Add smudge slider
        ];
        sliders.forEach(s => {
            const input = document.getElementById(s.id);
            const display = document.getElementById(s.display);
            input.addEventListener('input', () => {
                display.textContent = input.value + s.suffix;
                this.updateBrushFromUI();
            });
        });
        
        document.getElementById('blending-mode').addEventListener('change', () => this.updateBrushFromUI());
        document.getElementById('tip-shape').addEventListener('change', () => this.updateBrushFromUI());

        // Import/Export
        document.getElementById('export-brush-btn').addEventListener('click', () => this.exportBrush());
        document.getElementById('import-brush-btn').addEventListener('click', () => document.getElementById('import-file-input').click());
        document.getElementById('import-file-input').addEventListener('change', (e) => this.importBrush(e));
    }
    
    createNewBrush() {
        const newBrush = {
            id: Date.now(),
            name: 'New Brush',
            size: 20,
            opacity: 100,
            blending: 'source-over',
            hardness: 80,
            pressureSize: 50,
            pressureOpacity: 0,
            smoothing: 20,
            tip: 'round',
            smudgeStrength: 0 // Default for new brushes
        };
        this.brushes.push(newBrush);
        this.saveBrushes();
        this.selectBrush(newBrush);
    }
    
    deleteSelectedBrush() {
        if (!this.activeBrush || !confirm(`Are you sure you want to delete "${this.activeBrush.name}"?`)) return;
        
        this.brushes = this.brushes.filter(b => b.id !== this.activeBrush.id);
        this.saveBrushes();
        this.renderBrushList();
        
        if (this.brushes.length > 0) {
            this.selectBrush(this.brushes[0]);
        } else {
            this.activeBrush = null;
            // Clear UI or show placeholder
        }
    }
    
    exportBrush() {
        if (!this.activeBrush) return;
        const brushData = JSON.stringify(this.activeBrush, null, 2);
        const blob = new Blob([brushData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.activeBrush.name.replace(/ /g, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    importBrush(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedBrush = JSON.parse(e.target.result);
                // Basic validation and ensure new properties exist
                if (importedBrush.name && importedBrush.size) {
                    importedBrush.id = Date.now(); // Assign new unique ID
                    if (importedBrush.smudgeStrength === undefined) importedBrush.smudgeStrength = 0; // Default if missing
                    this.brushes.push(importedBrush);
                    this.saveBrushes();
                    this.selectBrush(importedBrush);
                } else {
                    alert('Invalid brush file format.');
                }
            } catch (err) {
                alert('Error reading brush file.');
                console.error(err);
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset file input
    }
    
    drawPreview() {
        if (!this.activeBrush || !this.previewCtx) return;
        
        const ctx = this.previewCtx;
        const { width, height } = ctx.canvas;
        const dpr = window.devicePixelRatio || 1;
        
        ctx.clearRect(0, 0, width / dpr, height / dpr);
        
        const points = [];
        const numPoints = 100;
        const pathWidth = (width / dpr) * 0.8;
        const pathHeight = (height / dpr) * 0.4;
        
        for (let i = 0; i < numPoints; i++) {
            const t = i / (numPoints - 1);
            const angle = t * Math.PI * 2;
            const x = (width / dpr) * 0.1 + t * pathWidth;
            const y = (height / dpr) * 0.5 + Math.sin(angle) * pathHeight;
            const pressure = 0.1 + (Math.sin(t * Math.PI) * 0.9);
            points.push({ x, y, pressure });
        }
        
        ctx.globalCompositeOperation = this.activeBrush.blending;

        for (let i = 1; i < points.length; i++) {
            const p1 = points[i-1];
            const p2 = points[i];

            const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
            const steps = Math.max(1, Math.ceil(dist / 2));
            
            for(let j = 0; j < steps; j++) {
                const t = j / steps;
                const x = p1.x + (p2.x - p1.x) * t;
                const y = p1.y + (p2.y - p1.y) * t;
                const pressure = p1.pressure + (p2.pressure - p1.pressure) * t;

                const sizeMod = 1.0 - (this.activeBrush.pressureSize / 100) * (1.0 - pressure);
                const opacityMod = 1.0 - (this.activeBrush.pressureOpacity / 100) * (1.0 - pressure);
                
                const size = this.activeBrush.size * sizeMod;
                const opacity = (this.activeBrush.opacity / 100) * opacityMod;
                const hardness = this.activeBrush.hardness / 100;
                const tip = this.activeBrush.tip || 'round';

                // For preview, we don't simulate actual canvas picking for smudge.
                // Just use a static color.
                const previewDrawColor = 'rgba(44, 62, 80, 1)'; 

                if (tip === 'square') {
                    ctx.globalAlpha = opacity;
                    ctx.fillStyle = previewDrawColor;
                    ctx.fillRect(x - size / 2, y - size / 2, size, size);
                    ctx.globalAlpha = 1;
                } else { // round tip
                    const gradient = ctx.createRadialGradient(x, y, 0, x, y, size / 2);
                    const color = `rgba(44, 62, 80, `;
                    gradient.addColorStop(0, color + opacity + ')');
                    gradient.addColorStop(Math.max(0, hardness - 0.1), color + opacity + ')');
                    gradient.addColorStop(Math.min(1, hardness + 0.1), color + (opacity * 0.5) + ')');
                    gradient.addColorStop(1, color + '0)');

                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new BrushEditorApp();
});