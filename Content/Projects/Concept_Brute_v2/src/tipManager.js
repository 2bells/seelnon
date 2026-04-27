export class TipManager {
  constructor(container, onTipChange, storage = null) {
    this.container = container;
    this.onTipChange = onTipChange;
    this.storage = storage;
    this.tips = []; 
    this.defaults = []; 
    this.activeBankIndex = 0; // The slot in the main 6
    this.selectedTipCanvas = null; // The one actually in use
    this.editorCanvas = document.getElementById('tip-editor-canvas');
    this.editorCtx = this.editorCanvas.getContext('2d');
    this.isEraser = false;
    
    this.init();
  }

  async init() {
    this._createDefaultTips();
    
    if (this.storage) {
        let saved = null;
        try {
            saved = await this.storage.loadGlobalSetting('brushTips');
            if (!saved) {
                const raw = localStorage.getItem('brushTips');
                if (raw) saved = JSON.parse(raw);
            }
        } catch(e) {
            console.error("Failed to load brush tips", e);
        }

        if (saved && Array.isArray(saved)) {
            for (let i = 0; i < saved.length && i < this.tips.length; i++) {
                if (saved[i]) {
                    const tipData = (typeof saved[i] === 'string') ? { src: saved[i], paintHeight: 0, oiliness: 0.5, airbrush: 0 } : saved[i];
                    if (tipData.src) {
                        const img = new Image();
                        await new Promise(r => {
                            img.onload = r;
                            img.onerror = () => {
                                console.error("Failed to load brush tip image", tipData.src.substring(0, 50));
                                r(); 
                            };
                            img.src = tipData.src;
                        });
                        const c = document.createElement('canvas');
                        c.width = 128; c.height = 128;
                        c.getContext('2d').drawImage(img, 0, 0);
                        this.tips[i].canvas = c;
                    }
                    this.tips[i].paintHeight = tipData.paintHeight || 0;
                    this.tips[i].oiliness = tipData.oiliness ?? 0.5;
                    this.tips[i].airbrush = tipData.airbrush || 0;
                }
            }
        }
    }

    this._setupUI();
    this.selectedTipCanvas = this.tips[this.activeBankIndex].canvas;
    this.editorCtx.clearRect(0,0,128,128);
    this.editorCtx.drawImage(this.selectedTipCanvas, 0, 0);
    this._renderPalette();
    this._updateActiveTip();
  }

  _createDefaultTips() {
    this.tips = [];
    this.defaults = [];
    const types = ['rect', 'circle', 'triangle', 'scatter', 'scratchy', 'hollow'];
    types.forEach(type => {
      const canvas = this._createShape(type);
      this.tips.push({ canvas, paintHeight: 0, oiliness: 0.5, airbrush: 0 });
      const backup = document.createElement('canvas');
      backup.width = 128; backup.height = 128;
      backup.getContext('2d').drawImage(canvas, 0, 0);
      this.defaults.push(backup);
    });
  }

  _createShape(type) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'black';
    
    if (type === 'rect') {
      ctx.fillRect(0, 32, 128, 64);
    } else if (type === 'circle') {
      ctx.beginPath(); ctx.arc(64, 64, 60, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'triangle') {
      ctx.beginPath(); ctx.moveTo(64, 10); ctx.lineTo(118, 118); ctx.lineTo(10, 118); ctx.closePath(); ctx.fill();
    } else if (type === 'scatter') {
      for(let i=0; i<30; i++) {
        ctx.beginPath(); ctx.arc(Math.random()*128, Math.random()*128, Math.random()*8, 0, Math.PI*2); ctx.fill();
      }
    } else if (type === 'scratchy') {
      ctx.lineWidth = 2;
      for(let i=0; i<20; i++) {
        ctx.beginPath(); const y = 32 + Math.random()*64; ctx.moveTo(10, y); ctx.lineTo(118, y + (Math.random()-0.5)*10); ctx.stroke();
      }
    } else if (type === 'hollow') {
      ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(64, 64, 54, 0, Math.PI * 2); ctx.stroke();
    }
    return c;
  }

  _setupUI() {
    const editor = document.getElementById('tip-editor-container');
    let drawing = false;

    const startDraw = (e) => {
        drawing = true;
        this._drawEditor(e, true);
    };
    
    const moveDraw = (e) => { if (drawing) this._drawEditor(e); };
    const stopDraw = () => { if (drawing) { drawing = false; this._updateFromEditor(); } };

    editor.onmousedown = startDraw;
    window.addEventListener('mousemove', moveDraw);
    window.addEventListener('mouseup', stopDraw);
    
    document.getElementById('btn-tip-clear').onclick = () => {
        this.editorCtx.clearRect(0,0,128,128);
        this._updateFromEditor();
    };

    document.getElementById('btn-tip-reset').onclick = () => {
        if (this.activeBankIndex < 0) return; // Cannot reset a generated tip to its non-existent default
        const backup = this.defaults[this.activeBankIndex];
        this.editorCtx.save();
        this.editorCtx.globalCompositeOperation = 'source-over';
        this.editorCtx.clearRect(0,0,128,128);
        this.editorCtx.drawImage(backup, 0, 0);
        this.editorCtx.restore();
        this._updateFromEditor();
    };

    document.getElementById('btn-tip-eraser').onclick = () => {
        this.isEraser = !this.isEraser;
        document.getElementById('btn-tip-eraser').classList.toggle('active-btn', this.isEraser);
    };

    document.getElementById('btn-tips-collapse').onclick = () => {
        const content = document.getElementById('tips-content');
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        document.getElementById('btn-tips-collapse').innerText = isHidden ? '_' : '+';
    };

    document.getElementById('btn-tip-capture').onclick = () => {
        // This will be handled by App which coordination engine and tipManager
        if (this.onCaptureRequest) this.onCaptureRequest();
    };
  }

  setTipFromCanvas(canvas) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.drawImage(canvas, 0, 0, 128, 128);
    
    this.selectedTipCanvas = c;
    if (this.activeBankIndex >= 0) {
        this.tips[this.activeBankIndex].canvas = c;
    } else {
        // If we were on generated, we stay on "temporary" selectedTipCanvas
    }
    
    this.editorCtx.save();
    this.editorCtx.globalCompositeOperation = 'source-over';
    this.editorCtx.clearRect(0,0,128,128);
    this.editorCtx.drawImage(c, 0, 0);
    this.editorCtx.restore();
    
    this._renderPalette();
    this._updateActiveTip();
    this._saveToStorage();
  }

  _drawEditor(e, isStart = false) {
    const rect = this.editorCanvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 128;
    const y = ((e.clientY - rect.top) / rect.height) * 128;
    
    this.editorCtx.globalCompositeOperation = this.isEraser ? 'destination-out' : 'source-over';
    this.editorCtx.fillStyle = 'black';
    this.editorCtx.beginPath();
    this.editorCtx.arc(x, y, 6, 0, Math.PI*2);
    this.editorCtx.fill();
  }

  _updateFromEditor() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    c.getContext('2d').drawImage(this.editorCanvas, 0, 0);
    this.selectedTipCanvas = c;
    
    if (this.activeBankIndex >= 0) {
        this.tips[this.activeBankIndex].canvas = c;
    }
    
    this._renderPalette();
    this._updateActiveTip();
    this._saveToStorage();
  }

  _renderPalette() {
    const mainGrid = document.getElementById('tip-main-slots');
    mainGrid.innerHTML = '';
    this.tips.forEach((tip, i) => {
      const slot = document.createElement('div');
      slot.className = 'tip-swatch';
      if (i === this.activeBankIndex) slot.classList.add('active-swatch');
      
      const thumb = document.createElement('canvas');
      thumb.width = 64; thumb.height = 64;
      thumb.getContext('2d').drawImage(tip.canvas, 0, 0, 64, 64);
      slot.appendChild(thumb);
      
      slot.onclick = () => {
        this.activeBankIndex = i;
        this.selectedTipCanvas = tip.canvas;
        this.editorCtx.save();
        this.editorCtx.globalCompositeOperation = 'source-over';
        this.editorCtx.clearRect(0,0,128,128);
        this.editorCtx.drawImage(tip.canvas, 0, 0);
        this.editorCtx.restore();
        this._renderPalette();
        this._updateActiveTip();
      };
      mainGrid.appendChild(slot);
    });

    const genGrid = document.getElementById('tip-generated-slots');
    genGrid.innerHTML = '';
    for(let i=0; i<9; i++) {
        const slot = document.createElement('div');
        slot.className = 'tip-swatch';
        const thumb = document.createElement('canvas');
        thumb.width = 64; thumb.height = 64;
        const tctx = thumb.getContext('2d');
        
        const t1 = this.tips[Math.floor(Math.random()*this.tips.length)];
        const t2 = this.tips[Math.floor(Math.random()*this.tips.length)];
        
        // Random rotation based on slot index
        let rotation = 0;
        if (i < 3) {
            // 90 deg random: 0, 90, 180, 270
            rotation = Math.floor(Math.random() * 4) * 90;
        } else if (i < 6) {
            // 45 deg random: 0, 45, 90, 135, ...
            rotation = Math.floor(Math.random() * 8) * 45;
        } else {
            // 1 deg random
            rotation = Math.floor(Math.random() * 360);
        }
        const angleRad = (rotation * Math.PI) / 180;

        tctx.save();
        tctx.translate(32, 32);
        tctx.rotate(angleRad);
        tctx.globalAlpha = 0.5;
        tctx.drawImage(t1.canvas, -32, -32, 64, 64);
        tctx.drawImage(t2.canvas, -32, -32, 64, 64);
        tctx.restore();
        slot.appendChild(thumb);
        
        slot.onclick = () => {
            const combined = document.createElement('canvas');
            combined.width = 128; combined.height = 128;
            const cctx = combined.getContext('2d');
            
            cctx.save();
            cctx.translate(64, 64);
            cctx.rotate(angleRad);
            cctx.globalAlpha = 0.5;
            cctx.drawImage(t1.canvas, -64, -64);
            cctx.drawImage(t2.canvas, -64, -64);
            cctx.restore();
            
            this.activeBankIndex = -1; // Unselect bank slots
            this.selectedTipCanvas = combined;
            this.editorCtx.save();
            this.editorCtx.globalCompositeOperation = 'source-over';
            this.editorCtx.clearRect(0,0,128,128);
            this.editorCtx.drawImage(combined, 0, 0);
            this.editorCtx.restore();
            
            this._renderPalette();
            this._updateActiveTip();
        };
        genGrid.appendChild(slot);
    }
  }

  updateActiveTipSettings(height, oiliness, airbrush) {
    if (this.activeBankIndex >= 0) {
        const tip = this.tips[this.activeBankIndex];
        if (height !== undefined) tip.paintHeight = height;
        if (oiliness !== undefined) tip.oiliness = oiliness;
        if (airbrush !== undefined) tip.airbrush = airbrush;
        this._saveToStorage();
    }
  }

  _updateActiveTip() {
    if (this.onTipChange) {
      const tip = this.activeBankIndex >= 0 ? this.tips[this.activeBankIndex] : { canvas: this.selectedTipCanvas, paintHeight: 0, oiliness: 0.5, airbrush: 0 };
      this.onTipChange(tip.canvas, tip.paintHeight, tip.oiliness, tip.airbrush);
    }
  }

  _saveToStorage() {
      if (this.storage) {
          const data = this.tips.map(t => ({ 
              src: t.canvas.toDataURL(), 
              paintHeight: t.paintHeight || 0,
              oiliness: t.oiliness ?? 0.5,
              airbrush: t.airbrush || 0
          }));
          this.storage.saveGlobalSetting('brushTips', data);
      }
  }
}

