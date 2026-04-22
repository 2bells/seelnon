import { Engine } from './engine.js';
import { SketchStorage } from './storage.js';
import { COLORS, TOOLS, LAYERS_COUNT } from './constants.js';

class App {
  constructor() {
    this.engine = new Engine(document.getElementById('canvas-container'));
    this.engine.onColorPicked = (color) => this.setColor(color);
    this.engine.onStatus = (text) => this._status(text);
    this.storage = new SketchStorage();
    this.activeTool = TOOLS.BRUSH;
    
    this.init();
  }

  async init() {
    await this.storage.init();
    this._setupUI();
    this._setupHotkeys();
    
    // Load existing data
    await this.load();
    
    this._status('READY');
    this.engine.onDrawEnd = () => this._triggerAutoSave();
    this.engine.onZoomChange = () => this._updateZoomUI();
  }

  _triggerAutoSave() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.save(), 4000);
  }

  _setupUI() {
    // Toolbar buttons
    document.getElementById('btn-brush').onclick = () => this.setTool(TOOLS.BRUSH);
    document.getElementById('btn-eraser').onclick = () => this.setTool(TOOLS.ERASER);
    document.getElementById('btn-wireframe').onclick = () => this.setTool(TOOLS.WIREFRAME);
    document.getElementById('btn-lasso').onclick = () => this.setTool(TOOLS.LASSO);
    document.getElementById('btn-undo').onclick = () => this.engine.undo();
    document.getElementById('btn-redo').onclick = () => this.engine.redo();
    document.getElementById('btn-clear').onclick = () => this.engine.clear();
    document.getElementById('btn-fullscreen').onclick = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    document.getElementById('btn-import').onclick = () => document.getElementById('file-import').click();
    document.getElementById('file-import').onchange = (e) => this._handleImport(e);

    // Zoom controls
    document.getElementById('btn-zoom-in').onclick = () => {
        this.engine.setZoom(this.engine.zoom * 1.2);
        this._updateZoomUI();
    };
    document.getElementById('btn-zoom-out').onclick = () => {
        this.engine.setZoom(this.engine.zoom / 1.2);
        this._updateZoomUI();
    };
    document.getElementById('btn-zoom-fit').onclick = () => {
        this.engine.fitZoom();
        this._updateZoomUI();
    };

    // Palette
    const paletteEl = document.getElementById('palette');
    paletteEl.innerHTML = '';
    
    COLORS.forEach(color => {
      const btn = document.createElement('button');
      btn.className = 'aspect-square w-full border border-black hover:scale-110 transition-transform active:bg-white';
      btn.style.backgroundColor = color;
      btn.title = color;
      btn.onclick = () => this.setColor(color);
      paletteEl.appendChild(btn);
    });

    document.getElementById('btn-reset-palette').onclick = () => {
        this.setColor('#333333');
    };

    // Layers
    const layerStack = document.getElementById('layer-stack');
    layerStack.innerHTML = '';
    // Reverse UI display: Index 3 at top, Index 0 at bottom
    // Index 0 is IMG REF, Indices 1-3 are PAINT LAYERS
    for (let i = LAYERS_COUNT - 1; i >= 0; i--) {
      const btn = document.createElement('button');
      btn.className = `layer-btn w-full ${i === 1 ? 'bg-black text-white active-tool' : 'bg-white text-black'}`;
      btn.id = `layer-btn-${i}`;
      btn.innerHTML = i === 0 ? 'IMG REF' : `PAINT ${i}`;
      btn.onclick = () => this.setLayer(i);
      layerStack.appendChild(btn);
    }
    this.engine.activeLayer = 1; // Default to first paint layer

    // Settings
    const sizeSlider = document.getElementById('brush-size');
    const sizeVal = document.getElementById('size-val');
    sizeSlider.oninput = (e) => {
      const val = parseInt(e.target.value);
      this.engine.brush.size = val;
      sizeVal.innerText = val;
    };

    const opacitySlider = document.getElementById('brush-opacity');
    const opacityVal = document.getElementById('opacity-val');
    if (opacitySlider) {
        opacitySlider.oninput = (e) => {
          const val = parseInt(e.target.value);
          this.engine.brush.opacity = val / 100;
          opacityVal.innerText = `${val}%`;
        };
    }

    const flowSlider = document.getElementById('brush-flow');
    const flowVal = document.getElementById('flow-val');
    if (flowSlider) {
        flowSlider.oninput = (e) => {
          const val = parseInt(e.target.value);
          this.engine.brush.flow = val / 100;
          flowVal.innerText = `${val}%`;
        };
    }

    // Speed Sliders - sensitivity tuning
    const sSize = document.getElementById('speed-size');
    const sOpac = document.getElementById('speed-opacity');
    const sVal = document.getElementById('speed-value');
    const sHue = document.getElementById('speed-hue');

    if (sSize) sSize.oninput = (e) => this.engine.brush.speedSize = parseInt(e.target.value) / 100;
    if (sOpac) sOpac.oninput = (e) => this.engine.brush.speedOpacity = parseInt(e.target.value) / 100;
    if (sVal) sVal.oninput = (e) => this.engine.brush.speedValue = parseInt(e.target.value) / 100;
    if (sHue) sHue.oninput = (e) => this.engine.brush.speedHue = parseInt(e.target.value) / 100;

    // Draggable Panels
    this._makeDraggable(document.getElementById('panel-color'), document.getElementById('handle-color'));
    this._makeDraggable(document.getElementById('panel-images'), document.getElementById('handle-images'));
  }

  _makeDraggable(el, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      el.style.top = (el.offsetTop - pos2) + "px";
      el.style.left = (el.offsetLeft - pos1) + "px";
      el.style.right = 'auto'; // Disable right-anchor if it was there
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  _updateZoomUI() {
      document.getElementById('zoom-val').innerText = `${Math.round(this.engine.zoom * 100)}%`;
  }

  _setupHotkeys() {
    window.onkeydown = (e) => {
      if (e.repeat && ['z', 'y'].includes(e.key.toLowerCase())) return;
      
      const key = e.key.toLowerCase();
      switch (key) {
        case '1': this.setTool(TOOLS.BRUSH); break;
        case '2': this.setTool(TOOLS.ERASER); break;
        case '3': this.setTool(TOOLS.WIREFRAME); break;
        case '4': this.setTool(TOOLS.LASSO); break;
        case 'b': this.setTool(TOOLS.BRUSH); break;
        case 'x': this.setTool(TOOLS.ERASER); break; 
        case 's': this._adjOpacity(-5); break; // S lowers opacity
        case 'd': 
          if (e.ctrlKey) {
            this.engine.clearSelection();
            e.preventDefault();
          } else {
            this._adjOpacity(5); 
          }
          break;
        case 't':
          this.engine.startTransform();
          break;
        case 'l': this.setTool(TOOLS.LASSO); break;
        case 'z': 
          if (e.ctrlKey) {
              if (e.shiftKey) this.engine.redo();
              else this.engine.undo();
              e.preventDefault();
          }
          break;
        case 'y': if (e.ctrlKey) { this.engine.redo(); e.preventDefault(); } break;
        case 'w': this._adjSize(-8); break; 
        case 'e': this._adjSize(8); break;  
        case '[': this._adjSize(-5); break;
        case ']': this._adjSize(5); break;
      }
    };
  }

  _adjSize(delta) {
    const el = document.getElementById('brush-size');
    const valEl = document.getElementById('size-val');
    const newVal = Math.max(1, Math.min(500, parseInt(el.value) + delta));
    el.value = newVal;
    this.engine.brush.size = newVal;
    if (valEl) valEl.innerText = newVal;
  }

  _adjOpacity(delta) {
    const el = document.getElementById('brush-opacity');
    const valEl = document.getElementById('opacity-val');
    const newVal = Math.max(0, Math.min(100, parseInt(el.value) + delta));
    el.value = newVal;
    this.engine.brush.opacity = newVal / 100;
    if (valEl) valEl.innerText = `${newVal}%`;
  }

  _handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        this.engine.importImage(img);
        this._updateImageList(file.name);
        this._status('IMAGE IMPORTED');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  _updateImageList(name) {
      const list = document.getElementById('image-list');
      if (list && list.children[0]?.classList.contains('opacity-40')) list.innerHTML = '';
      
      const item = document.createElement('div');
      item.className = 'image-item group';
      item.innerHTML = `
        <span class="truncate w-32 font-black tracking-tighter uppercase">${name}</span>
        <button class="btn-del-img text-black hover:text-red-600 font-black px-1" title="Clear Image Layer">X</button>
      `;
      
      item.querySelector('.btn-del-img').onclick = () => {
          this.engine.clearLayer(0); // Clear reference layer
          item.remove();
          if (list.children.length === 0) {
            list.innerHTML = '<div class="text-[9px] text-center py-2 uppercase opacity-40">Empty</div>';
          }
      };
      
      list.appendChild(item);
  }

  setTool(tool) {
    this.activeTool = tool;
    this.engine.brush.type = tool;
    
    // Update UI
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.remove('active-tool', 'bg-black', 'text-white');
      btn.classList.add('bg-white', 'text-black');
    });

    const activeBtnId = `btn-${tool}`;
    const btn = document.getElementById(activeBtnId);
    if (btn) {
      btn.classList.remove('bg-white', 'text-black');
      btn.classList.add('active-tool', 'bg-black', 'text-white');
    }

    this._status(tool);
  }

  setColor(color) {
    this.engine.brush.color = color;
    const preview = document.getElementById('current-color-preview');
    if (preview) preview.style.backgroundColor = color;
    this._status(color);
  }

  setLayer(index) {
    this.engine.activeLayer = index;
    // Update UI
    for (let i = 0; i < LAYERS_COUNT; i++) {
        const btn = document.getElementById(`layer-btn-${i}`);
        if (btn) {
            btn.classList.remove('active-tool', 'bg-black', 'text-white');
            btn.classList.add('bg-white', 'text-black');
        }
    }
    const active = document.getElementById(`layer-btn-${index}`);
    if (active) {
        active.classList.remove('bg-white', 'text-black');
        active.classList.add('active-tool', 'bg-black', 'text-white');
    }
    this._status(`L${index + 1}`);
  }

  async load() {
    this._status('LOADING...');
    try {
        const layersToLoad = [0, 1, 2, 3];
        // We scan a reasonable area or have a manifest? 
        // For now, let's just use the current chunks in engine if we save them to a list
        // Or better: SketchStorage could just return all IDs.
        // Actually, we can just load chunks when requested. 
        // But for initial load, we need to know WHICH were saved.
        const allKeys = await this.storage.getAllKeys();
        for (const key of allKeys) {
            const [layerId, cx, cy] = key.split('_').map(Number);
            const dataUrl = await this.storage.loadChunk(layerId, cx, cy);
            if (dataUrl) {
                const img = new Image();
                await new Promise(r => {
                    img.onload = r;
                    img.src = dataUrl;
                });
                const chunk = this.engine._getChunk(cx, cy);
                chunk.ctxs[layerId].drawImage(img, 0, 0);
            }
        }
        this.engine.refresh();
        this._status('READY');
    } catch (e) {
        console.error("Load failed", e);
        this._status('LOAD ERROR');
    }
  }

  async save() {
    if (this.engine.dirtyChunks.size === 0) return;

    this._status('SAVING...');
    try {
        const dirty = Array.from(this.engine.dirtyChunks);
        this.engine.dirtyChunks.clear(); // Clear immediately to capture new changes during save

        const promises = [];
        for (const item of dirty) {
            const [chunkId, layerStr] = item.split('|');
            const l = parseInt(layerStr);
            const [cx, cy] = chunkId.split(',').map(Number);
            
            const chunk = this.engine.chunks.get(chunkId);
            if (chunk) {
                const dataUrl = chunk.canvases[l].toDataURL('image/webp', 0.8);
                promises.push(this.storage.saveChunk(l, cx, cy, dataUrl));
            }
        }
        
        await Promise.all(promises);
        this._status('SAVED');
    } catch (e) {
        console.error("Save failed", e);
        this._status('SAVE ERROR');
    }
  }

  _status(text) {
    const el = document.getElementById('status');
    if (el) el.innerText = text;
  }
}

new App();
