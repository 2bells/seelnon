export class Downscaler {
  constructor(generator) {
    this.generator = generator;
  }

  smartDownscale(sourceData, sourceWidth, sourceHeight, helpers) {
    const outputWidth = this.generator.outputWidth;  
    const outputHeight = this.generator.outputHeight;
    const paletteSize = this.generator.paletteSize;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = outputWidth;
    tempCanvas.height = outputHeight;
    const tempCtx = tempCanvas.getContext('2d');
    
    const imageData = tempCtx.createImageData(outputWidth, outputHeight);
    const data = imageData.data;

    // Select color palette based on the full-size source image
    const colorPalette = helpers.selectColorPalette(sourceData, sourceWidth, sourceHeight, paletteSize);
  
    const scaleFactor = Math.floor(sourceWidth / outputWidth);
  
    for (let y = 0; y < outputHeight; y++) {
      for (let x = 0; x < outputWidth; x++) {
        const srcX = x * scaleFactor;
        const srcY = y * scaleFactor;
        
        let colorBuckets = {};
        let totalNonTransparent = 0;
        
        for (let sy = 0; sy < scaleFactor; sy++) {
          for (let sx = 0; sx < scaleFactor; sx++) {
            const sourceX = srcX + sx;
            const sourceY = srcY + sy;
            
            if (sourceX < sourceWidth && sourceY < sourceHeight) {
              const sourceIndex = (sourceY * sourceWidth + sourceX) * 4;
              const r = sourceData.data[sourceIndex];
              const g = sourceData.data[sourceIndex + 1];
              const b = sourceData.data[sourceIndex + 2];
              const a = sourceData.data[sourceIndex + 3];
              
              if (a > 0) {
                const closestColor = helpers.findClosestColor(r, g, b, colorPalette);
                const colorKey = closestColor.join(',');
                colorBuckets[colorKey] = (colorBuckets[colorKey] || 0) + 1;
                totalNonTransparent++;
              }
            }
          }
        }
        
        const targetIndex = (y * outputWidth + x) * 4;
        
        if (totalNonTransparent > 0) {
          // Find the most frequent color from the palette
          const mostFrequentColor = Object.entries(colorBuckets).reduce((a, b) => 
            b[1] > a[1] ? b : a
          )[0].split(',').map(Number);
          
          data[targetIndex] = mostFrequentColor[0];
          data[targetIndex + 1] = mostFrequentColor[1];
          data[targetIndex + 2] = mostFrequentColor[2];
          data[targetIndex + 3] = 255;
        } else {
          data[targetIndex + 3] = 0; 
        }
      }
    }
    
    tempCtx.putImageData(imageData, 0, 0);
    const outputDataUrl = tempCanvas.toDataURL();
    
    // Store the downscaled sprite in storage with the current asset ID
    this.generator.spriteStorage.storeSprite(
      this.generator.currentAssetId, 
      String(outputWidth), 
      outputDataUrl
    );
    
    // Update the library panel to show the new sprite
    this.generator.updateLibraryPanel();
    
    // Trigger pixel editor grid update
    if (this.generator.pixelEditor) {
      const gridSize = parseInt(document.getElementById('pixel-grid-size')?.value || '32');
      this.generator.pixelEditor.loadSpriteForEditing(
        this.generator.currentAssetId, 
        gridSize
      );
    }
    
    return outputDataUrl;
  }
}