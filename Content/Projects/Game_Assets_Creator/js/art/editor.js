export class EditorPlugin {
  constructor(generator) {
    this.generator = generator;
    this.editorCanvas = null;
    this.editorCtx = null;
  }

  bindEditorEvents() {
    // Wrap in a comprehensive check to prevent null reference errors
    requestAnimationFrame(() => {
      const editorCanvas = document.getElementById('editor-canvas');
      const autoRemoveBtn = document.getElementById('auto-remove-bg');
      const downscaleBtn = document.getElementById('downscale-btn');
      
      // Check all critical elements before proceeding
      if (!editorCanvas || !autoRemoveBtn || !downscaleBtn) {
        console.warn('Editor elements not found. Retrying binding...', {
          editorCanvas: !!editorCanvas,
          autoRemoveBtn: !!autoRemoveBtn,
          downscaleBtn: !!downscaleBtn
        });
        
        // Optional: Retry binding after a short delay
        setTimeout(() => this.bindEditorEvents(), 500);
        return;
      }

      // Safe event binding
      try {
        editorCanvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        editorCanvas.addEventListener('mousemove', (e) => this.draw(e));
        editorCanvas.addEventListener('mouseup', () => this.stopDrawing());
        editorCanvas.addEventListener('mouseleave', () => this.stopDrawing());
        
        autoRemoveBtn.addEventListener('click', () => this.autoRemoveBackground());
        downscaleBtn.addEventListener('click', () => this.smartDownscale());
        
        this.editorCanvas = editorCanvas;
        this.editorCtx = editorCanvas.getContext('2d');
      } catch (error) {
        console.error('Error binding editor events:', error);
      }
    });
  }

  startDrawing(e) {
    if (!this.editorCanvas) return;
    this.generator.isDrawing = true;
    this.draw(e);
  }

  draw(e) {
    if (!this.generator.isDrawing || !this.editorCanvas) return;
    
    const rect = this.editorCanvas.getBoundingClientRect();
    const scaleX = this.editorCanvas.width / rect.width;
    const scaleY = this.editorCanvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX / this.generator.editorZoom;
    const y = (e.clientY - rect.top) * scaleY / this.generator.editorZoom;
    
    if (this.generator.isErasing) {
      this.editorCtx.clearRect(x - 5, y - 5, 10, 10);
    }
  }

  stopDrawing() {
    this.generator.isDrawing = false;
  }

  autoRemoveBackground() {
    const canvas = this.editorCanvas;
    const ctx = this.editorCtx;
    
    if (!canvas || !ctx) {
      console.warn('Cannot remove background: Canvas or context not initialized');
      return;
    }
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    const processedImageData = this.generator.backgroundPlugin.autoRemoveBackground(imageData, canvas.width, canvas.height);
    
    ctx.putImageData(processedImageData, 0, 0);
  }

  smartDownscale() {
    const sourceCanvas = this.editorCanvas;
    const sourceCtx = this.editorCtx;
    
    if (!sourceCanvas || !sourceCtx) {
      console.warn('Cannot downscale: Canvas or context not initialized');
      return;
    }
    
    const sourceData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    
    const processedImage = this.generator.backgroundPlugin.smartDownscale(
      sourceData, 
      sourceCanvas.width, 
      sourceCanvas.height
    );
    
    const processedImg = document.getElementById('processed-img');
    if (processedImg) {
      processedImg.src = processedImage;
      this.generator.processedImage = processedImage;
      
      const downloadBtn = document.getElementById('download-processed');
      if (downloadBtn) {
        downloadBtn.disabled = false;
      }
    }
  }
}