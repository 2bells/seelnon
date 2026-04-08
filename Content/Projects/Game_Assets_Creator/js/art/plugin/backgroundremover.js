export class BackgroundRemover {
  autoRemoveBackground(imageData, width, height, helpers) {
    console.time('autoRemoveBackground');
    const data = imageData.data;
    
    console.log(`Starting background removal process on ${width}x${height} image`);
    
    // Apply settings from artTuner if available
    let threshold = 30; // Default threshold
    let offsetFactor = 10; // Default offset
    
    if (helpers.generator && helpers.generator.artTuner && helpers.generator.artTuner.settings) {
      threshold = helpers.generator.artTuner.settings.edgeFinder.threshold;
      offsetFactor = helpers.generator.artTuner.settings.edgeFinder.expandOffset;
      console.log("Using art tuner settings:", { threshold, offsetFactor });
    }
    
    // Custom find edges with custom threshold
    const edges = helpers.findEdges(imageData, threshold);
    
    // Custom expand with custom offset
    const expandedEdges = helpers.expandSprite(width, height, edges, offsetFactor);
    
    const externalPixels = helpers.floodFillFromEdges(width, height, expandedEdges);
    
    // Use Uint8Array for better performance when setting transparency
    const length = data.length;
    for (let i = 3; i < length; i += 4) {
      // If the pixel is determined to be outside the sprite, make it fully transparent
      if (externalPixels[(i - 3) / 4]) {
        data[i] = 0; 
      }
    }
    
    console.timeEnd('autoRemoveBackground');
    return imageData;
  }

  removeWhiteBackground(img) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(img, 0, 0, 32, 32);
    
    const imageData = ctx.getImageData(0, 0, 32, 32);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      if (r > 230 && g > 230 && b > 230) {
        data[i + 3] = 0;
      }
      
      if (data[i + 3] < 128) {
        data[i + 3] = 0;
      } else {
        data[i] = Math.round(r / 32) * 32;
        data[i + 1] = Math.round(g / 32) * 32;
        data[i + 2] = Math.round(b / 32) * 32;
        data[i + 3] = 255;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    return canvas.toDataURL('image/png');
  }
}