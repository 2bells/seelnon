import { EdgeFinder } from './edgefinder.js';
import { PaletteFinder } from './palletfinder.js';
import { Downscaler } from './downscaler.js';
import { BackgroundRemover } from './backgroundremover.js';

export class BackgroundRemovalPlugin {
  constructor(generator) {
    this.generator = generator;
    this.currentDownscaleLevel = 1;
    this.expansionOffset = 1; // Default expansion offset
    
    // Initialize sub-modules
    this.edgeFinder = new EdgeFinder();
    this.paletteFinder = new PaletteFinder();
    this.downscaler = new Downscaler(generator);
    this.backgroundRemover = new BackgroundRemover();
  }

  autoRemoveBackground(imageData, width, height, settings = null) {
    console.time('autoRemoveBackground');
    const data = imageData.data;
    
    console.log(`Starting background removal process on ${width}x${height} image`);
    
    // Use settings from artTuner if provided, otherwise use defaults
    let threshold = settings?.edgeFinder?.threshold || 50;
    let expandOffset = settings?.edgeFinder?.expandOffset || 2;
    
    // Log the actual values being used
    console.log("Using settings:", { threshold, expandOffset });
    
    // Find edges with current threshold
    const edges = this.findEdges(imageData, threshold);
    
    // Expand edges with current offset
    const expandedEdges = this.expandSprite(width, height, edges, expandOffset);
    
    const externalPixels = this.floodFillFromEdges(width, height, expandedEdges);
    
    // Use Uint8Array for better performance when setting transparency
    const length = data.length;
    for (let i = 3; i < length; i += 4) {
      if (externalPixels[(i - 3) / 4]) {
        data[i] = 0;
      }
    }
    
    console.timeEnd('autoRemoveBackground');
    return imageData;
  }

  expandSprite(width, height, edges, expandOffset) {
    // Use the expandOffset directly instead of calculating from width
    return this.edgeFinder.expandSprite(width, height, edges, expandOffset);
  }

  findEdges(imageData, threshold) {
    return this.edgeFinder.findEdges(imageData, threshold);
  }

  floodFillFromEdges(width, height, edges) {
    return this.edgeFinder.floodFillFromEdges(width, height, edges);
  }

  smartDownscale(sourceData, sourceWidth, sourceHeight) {
    return this.downscaler.smartDownscale(
      sourceData, 
      sourceWidth, 
      sourceHeight, 
      {
        selectColorPalette: this.selectColorPalette.bind(this),
        findClosestColor: this.findClosestColor.bind(this)
      }
    );
  }

  selectColorPalette(sourceData, sourceWidth, sourceHeight, paletteSize = 8) {
    return this.paletteFinder.selectColorPalette(sourceData, sourceWidth, sourceHeight, paletteSize);
  }

  findClosestColor(r, g, b, palette) {
    return this.paletteFinder.findClosestColor(r, g, b, palette);
  }

  removeWhiteBackground(img) {
    return this.backgroundRemover.removeWhiteBackground(img);
  }

  analyzeColorDiversity(sourceData, sourceWidth, sourceHeight) {
    return this.paletteFinder.analyzeColorDiversity(sourceData, sourceWidth, sourceHeight);
  }
}