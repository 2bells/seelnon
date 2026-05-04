import { TOOLS } from './constants.js';

export class ImgHandler {
  constructor(engine, onUpdate = null) {
    this.engine = engine;
    this.onUpdate = onUpdate;
    this.active = false;
    
    // UI Elements
    this.topBarMain = document.getElementById('top-bar');
    this.topBarRef = document.getElementById('top-bar-ref');
    this.btnBack = document.getElementById('btn-ref-back');
    this.btnDelete = document.getElementById('btn-ref-delete');
    this.opacitySlider = document.getElementById('ref-opacity');
    this.opacityVal = document.getElementById('ref-opacity-val');

    // Ref specific tool buttons
    this.refTools = {
      MOVE: document.getElementById('btn-ref-move'),
      CROP: document.getElementById('btn-ref-crop'),
      EXTRACT: document.getElementById('btn-ref-extract'),
      KNIFE: document.getElementById('btn-ref-knife'),
      COLOR: document.getElementById('btn-ref-color')
    };

    this._initEvents();
  }

  activate() {
    this.active = true;
    this.topBarMain.classList.add('hidden');
    this.topBarRef.classList.remove('hidden');
    this.syncUI();
  }

  deactivate() {
    this.active = false;
    this.topBarMain.classList.remove('hidden');
    this.topBarRef.classList.add('hidden');
  }

  syncUI() {
    const selected = this.engine.referenceImages[this.engine.selectedRefIndex];
    if (selected) {
      const val = Math.round(selected.opacity * 100);
      if (this.opacitySlider) this.opacitySlider.value = val;
      if (this.opacityVal) this.opacityVal.innerText = `${val}%`;
    }
  }

  _initEvents() {
    // Back to painting
    this.btnBack.onclick = () => {
       const layer1 = document.getElementById('layer-btn-1');
       if (layer1) layer1.click();
    };

    // Delete selected image
    this.btnDelete.onclick = () => {
        if (this.engine.selectedRefIndex >= 0) {
            this.engine.removeReferenceImage(this.engine.selectedRefIndex);
            if (this.onUpdate) this.onUpdate();
        }
    };

    // Opacity
    this.opacitySlider.oninput = (e) => {
        const val = parseInt(e.target.value);
        this.opacityVal.innerText = `${val}%`;
        const selected = this.engine.referenceImages[this.engine.selectedRefIndex];
        if (selected) {
            selected.opacity = val / 100;
            this.engine.refresh();
        }
    };

    // Tool selection
    Object.entries(this.refTools).forEach(([id, btn]) => {
      if (!btn) return;
      btn.onclick = () => {
        this._setRefTool(id);

        // Additional actions after setting tool if needed
        if (id === 'EXTRACT') {
            if (this.engine.selectedRefIndex >= 0) {
                this.engine.extractPaletteFromRef(this.engine.selectedRefIndex).then(() => {
                    if (this.onUpdate) this.onUpdate();
                });
            }
        } else if (id === 'CROP') {
            if (this.engine.selectedRefIndex >= 0) this.engine.cropRefImage(this.engine.selectedRefIndex);
        } else if (id === 'KNIFE') {
            if (this.engine.selectedRefIndex >= 0) this.engine.knifeRefImage(this.engine.selectedRefIndex);
        } else if (id === 'COLOR') {
            if (this.engine.selectedRefIndex >= 0) this.engine.colorCorrectRefImage(this.engine.selectedRefIndex);
        }
      };
    });
  }

  _setRefTool(toolId) {
    // Boilerplate for now
    Object.values(this.refTools).forEach(b => b?.classList.remove('active-tool'));
    this.refTools[toolId]?.classList.add('active-tool');
    
    if (toolId === 'MOVE') {
        // Force engine to move tool if it wasn't already
        this.engine.brush.type = TOOLS.REF_MOVE;
    }

    console.log(`Switching to REF Tool: ${toolId}`);
  }
}
