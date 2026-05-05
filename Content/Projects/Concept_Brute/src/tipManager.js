export class TipManager {
  constructor(container, onTipChange, storage = null) {
    this.container = container;
    this.onTipChange = onTipChange;
    this.storage = storage;
    this.tips = []; 
    this.defaults = []; 
    this.generatedTips = []; // Store generated tips persistently
    this.activeBankIndex = 0; // >= 0 for main slots, < 0 for generated or custom
    this.activeGeneratedIndex = -1; // Index in generatedTips if active
    this.selectedTipCanvas = null; // The one actually in use
    this.editorCanvas = document.getElementById('tip-editor-canvas');
    this.editorCtx = this.editorCanvas.getContext('2d');
    this.isEraser = false;
    
    this.init();
  }

  async init() {
    this._createDefaultTips();
    
    // Create initial empty generated tips
    for (let i = 0; i < 9; i++) {
        this.generatedTips.push({ canvas: null, paintHeight: 0, oiliness: 0.5, airbrush: 0 });
    }

    if (this.storage) {
        // Load main tips
        let savedMain = null;
        try {
            const raw = localStorage.getItem('brushTips');
            if (raw) savedMain = JSON.parse(raw);
        } catch(e) {}

        if (savedMain && Array.isArray(savedMain)) {
            for (let i = 0; i < savedMain.length && i < this.tips.length; i++) {
                if (savedMain[i]) {
                    const tipData = (typeof savedMain[i] === 'string') ? { src: savedMain[i] } : savedMain[i];
                    const img = new Image();
                    await new Promise(r => { img.onload = r; img.src = tipData.src; });
                    const c = document.createElement('canvas');
                    c.width = 128; c.height = 128;
                    c.getContext('2d').drawImage(img, 0, 0);
                    this.tips[i].canvas = c;
                    this.tips[i].paintHeight = tipData.paintHeight || 0;
                    this.tips[i].oiliness = tipData.oiliness ?? 0.5;
                    this.tips[i].airbrush = tipData.airbrush || 0;
                }
            }
        }

        // Load generated tips
        let savedGen = null;
        try {
            const raw = localStorage.getItem('brushTips_generated');
            if (raw) savedGen = JSON.parse(raw);
        } catch(e) {}

        if (savedGen && Array.isArray(savedGen)) {
            for (let i = 0; i < savedGen.length && i < this.generatedTips.length; i++) {
                if (savedGen[i] && savedGen[i].src) {
                    const img = new Image();
                    await new Promise(r => { img.onload = r; img.src = savedGen[i].src; });
                    const c = document.createElement('canvas');
                    c.width = 128; c.height = 128;
                    c.getContext('2d').drawImage(img, 0, 0);
                    this.generatedTips[i].canvas = c;
                    this.generatedTips[i].paintHeight = savedGen[i].paintHeight || 0;
                    this.generatedTips[i].oiliness = savedGen[i].oiliness ?? 0.5;
                    this.generatedTips[i].airbrush = savedGen[i].airbrush || 0;
                }
            }
        }

        // Fill missing generated tips
        for (let i = 0; i < 9; i++) {
            if (!this.generatedTips[i].canvas) {
                this._regenerateSlot(i, false);
            }
        }

        // Load active indices
        const savedBankIdx = localStorage.getItem('activeTipBankIndex');
        if (savedBankIdx !== null) this.activeBankIndex = parseInt(savedBankIdx);
        const savedGenIdx = localStorage.getItem('activeTipGenIndex');
        if (savedGenIdx !== null) this.activeGeneratedIndex = parseInt(savedGenIdx);
    } else {
        // No storage, just generate
        for (let i = 0; i < 9; i++) this._regenerateSlot(i, false);
    }

    this._setupUI();
    
    if (this.activeGeneratedIndex >= 0) {
        this.selectedTipCanvas = this.generatedTips[this.activeGeneratedIndex].canvas;
        this.activeBankIndex = -1;
    } else {
        this.selectedTipCanvas = this.tips[Math.max(0, this.activeBankIndex)].canvas;
        this.activeGeneratedIndex = -1;
    }

    this.editorCtx.clearRect(0,0,128,128);
    this.editorCtx.drawImage(this.selectedTipCanvas, 0, 0);
    this._renderPalette();
    this._updateActiveTip();
  }

  _regenerateSlot(i, save = true) {
    const t1 = this.tips[Math.floor(Math.random() * this.tips.length)];
    const t2 = this.tips[Math.floor(Math.random() * this.tips.length)];
    
    let rotation = 0;
    if (i % 3 === 0) rotation = Math.floor(Math.random() * 4) * 90;
    else if (i % 3 === 1) rotation = Math.floor(Math.random() * 8) * 45;
    else rotation = Math.floor(Math.random() * 360);

    let baseAlpha = 1.0;
    if (i % 3 === 0) baseAlpha = 1.0;
    else if (i % 3 === 1) baseAlpha = 0.5 + Math.random() * 0.5;
    else baseAlpha = Math.random();

    const combined = document.createElement('canvas');
    combined.width = 128; combined.height = 128;
    const cctx = combined.getContext('2d');
    cctx.save();
    cctx.translate(64, 64);
    cctx.rotate((rotation * Math.PI) / 180);
    cctx.globalAlpha = baseAlpha;
    cctx.drawImage(t1.canvas, -64, -64);
    cctx.drawImage(t2.canvas, -64, -64);
    cctx.restore();

    this.generatedTips[i].canvas = combined;
    // Don't reset settings on regeneration if we want them saved? 
    // Usually regeneration means new brush entirely, but user said "saved". 
    // Let's reset settings on REFRESH specifically.
    this.generatedTips[i].paintHeight = 0;
    this.generatedTips[i].oiliness = 0.5;
    this.generatedTips[i].airbrush = 0;

    if (save) this._saveToStorage();
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
        if (this.activeBankIndex < 0) return; 
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
        if (this.onCaptureRequest) this.onCaptureRequest();
    };

    // Refresh Buttons
    for (let col = 0; col < 3; col++) {
        const btn = document.getElementById(`btn-refresh-col-${col}`);
        if (btn) {
            btn.onclick = () => {
                for (let row = 0; row < 3; row++) {
                    this._regenerateSlot(row * 3 + col);
                }
                this._renderPalette();
                if (this.activeGeneratedIndex >= 0 && (this.activeGeneratedIndex % 3 === col)) {
                    this.selectedTipCanvas = this.generatedTips[this.activeGeneratedIndex].canvas;
                    this.editorCtx.clearRect(0,0,128,128);
                    this.editorCtx.drawImage(this.selectedTipCanvas, 0, 0);
                    this._updateActiveTip();
                }
            };
        }
    }
  }

  setTipFromCanvas(canvas) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.drawImage(canvas, 0, 0, 128, 128);
    
    this.selectedTipCanvas = c;
    if (this.activeBankIndex >= 0) {
        this.tips[this.activeBankIndex].canvas = c;
    } else if (this.activeGeneratedIndex >= 0) {
        this.generatedTips[this.activeGeneratedIndex].canvas = c;
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
    } else if (this.activeGeneratedIndex >= 0) {
        this.generatedTips[this.activeGeneratedIndex].canvas = c;
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
      if (this.activeBankIndex === i) slot.classList.add('active-swatch');
      
      const thumb = document.createElement('canvas');
      thumb.width = 64; thumb.height = 64;
      thumb.getContext('2d').drawImage(tip.canvas, 0, 0, 64, 64);
      slot.appendChild(thumb);
      
      slot.onclick = () => {
        this.activeBankIndex = i;
        this.activeGeneratedIndex = -1;
        this.selectedTipCanvas = tip.canvas;
        this.editorCtx.save();
        this.editorCtx.globalCompositeOperation = 'source-over';
        this.editorCtx.clearRect(0,0,128,128);
        this.editorCtx.drawImage(tip.canvas, 0, 0);
        this.editorCtx.restore();
        this._renderPalette();
        this._updateActiveTip();
        this._saveToStorage();
      };
      mainGrid.appendChild(slot);
    });

    const genGrid = document.getElementById('tip-generated-slots');
    genGrid.innerHTML = '';
    this.generatedTips.forEach((tip, i) => {
        const slot = document.createElement('div');
        slot.className = 'tip-swatch';
        if (this.activeGeneratedIndex === i) slot.classList.add('active-swatch');
        const thumb = document.createElement('canvas');
        thumb.width = 64; thumb.height = 64;
        thumb.getContext('2d').drawImage(tip.canvas, 0, 0, 64, 64);
        slot.appendChild(thumb);
        
        slot.onclick = () => {
            this.activeGeneratedIndex = i;
            this.activeBankIndex = -1;
            this.selectedTipCanvas = tip.canvas;
            this.editorCtx.save();
            this.editorCtx.globalCompositeOperation = 'source-over';
            this.editorCtx.clearRect(0,0,128,128);
            this.editorCtx.drawImage(tip.canvas, 0, 0);
            this.editorCtx.restore();
            
            this._renderPalette();
            this._updateActiveTip();
            this._saveToStorage();
        };
        genGrid.appendChild(slot);
    });
  }

  updateActiveTipSettings(height, oiliness, airbrush) {
    let target = null;
    if (this.activeBankIndex >= 0) {
        target = this.tips[this.activeBankIndex];
    } else if (this.activeGeneratedIndex >= 0) {
        target = this.generatedTips[this.activeGeneratedIndex];
    }
    
    if (target) {
        if (height !== undefined) target.paintHeight = height;
        if (oiliness !== undefined) target.oiliness = oiliness;
        if (airbrush !== undefined) target.airbrush = airbrush;
        this._saveToStorage();
    }
  }

  _updateActiveTip() {
    this.refreshTip();
  }

  refreshTip() {
    if (this.onTipChange) {
      let tip = null;
      if (this.activeBankIndex >= 0) {
          tip = this.tips[this.activeBankIndex];
      } else if (this.activeGeneratedIndex >= 0) {
          tip = this.generatedTips[this.activeGeneratedIndex];
      } else {
          tip = { canvas: this.selectedTipCanvas, paintHeight: 0, oiliness: 0.5, airbrush: 0 };
      }
      this.onTipChange(tip.canvas, tip.paintHeight, tip.oiliness, tip.airbrush);
    }
  }

  _saveToStorage() {
      if (!this.storage) return;
      
      const mainData = this.tips.map(t => ({ 
          src: t.canvas.toDataURL(), 
          paintHeight: t.paintHeight || 0,
          oiliness: t.oiliness ?? 0.5,
          airbrush: t.airbrush || 0
      }));
      localStorage.setItem('brushTips', JSON.stringify(mainData));

      const genData = this.generatedTips.map(t => ({
          src: t.canvas ? t.canvas.toDataURL() : null,
          paintHeight: t.paintHeight || 0,
          oiliness: t.oiliness ?? 0.5,
          airbrush: t.airbrush || 0
      }));
      localStorage.setItem('brushTips_generated', JSON.stringify(genData));

      localStorage.setItem('activeTipBankIndex', this.activeBankIndex);
      localStorage.setItem('activeTipGenIndex', this.activeGeneratedIndex);
  }
}

