export class PaletteFinder {
  selectColorPalette(sourceData, sourceWidth, sourceHeight, paletteSize = 8) {
    // Ensure black and white are always in the palette
    const palette = [
      [0, 0, 0],    // Black
      [255, 255, 255]  // White
    ];

    // Color frequency tracking
    const colorFrequency = new Map();

    // Analyze image for color frequencies
    for (let y = 0; y < sourceHeight; y++) {
      for (let x = 0; x < sourceWidth; x++) {
        const sourceIndex = (y * sourceWidth + x) * 4;
        const r = sourceData.data[sourceIndex];
        const g = sourceData.data[sourceIndex + 1];
        const b = sourceData.data[sourceIndex + 2];
        const a = sourceData.data[sourceIndex + 3];

        // Skip transparent pixels
        if (a === 0) continue;

        // Quantize colors to reduce variation
        const quantizedColor = [
          Math.min(255, Math.round(r / 32) * 32),
          Math.min(255, Math.round(g / 32) * 32),
          Math.min(255, Math.round(b / 32) * 32)
        ];

        const colorKey = quantizedColor.join(',');
        const currentFreq = colorFrequency.get(colorKey) || 0;
        colorFrequency.set(colorKey, currentFreq + 1);
      }
    }

    // Sort colors by frequency
    const sortedColors = Array.from(colorFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0].split(',').map(Number));

    // Add colors to palette up to desired size
    for (const color of sortedColors) {
      if (palette.length < paletteSize) {
        // Ensure we don't add duplicate colors
        if (!palette.some(p => p[0] === color[0] && p[1] === color[1] && p[2] === color[2])) {
          palette.push(color);
        }
      } else {
        break;
      }
    }

    return palette;
  }

  findClosestColor(r, g, b, palette) {
    let minDistance = Infinity;
    let closestColor = palette[0];

    for (const paletteColor of palette) {
      const distance = Math.sqrt(
        Math.pow(r - paletteColor[0], 2) +
        Math.pow(g - paletteColor[1], 2) +
        Math.pow(b - paletteColor[2], 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestColor = paletteColor;
      }
    }

    return closestColor;
  }

  analyzeColorDiversity(sourceData, sourceWidth, sourceHeight) {
    console.time('analyzeColorDiversity');
    const colorSpace = [];
    const colorFrequency = new Map();

    // Collect unique colors, ignoring fully transparent pixels
    for (let y = 0; y < sourceHeight; y++) {
      for (let x = 0; x < sourceWidth; x++) {
        const sourceIndex = (y * sourceWidth + x) * 4;
        const r = sourceData.data[sourceIndex];
        const g = sourceData.data[sourceIndex + 1];
        const b = sourceData.data[sourceIndex + 2];
        const a = sourceData.data[sourceIndex + 3];

        // Skip fully transparent pixels
        if (a === 0) continue;

        // Quantize colors to reduce variation
        const quantizedColor = [
          Math.min(255, Math.round(r / 32) * 32),
          Math.min(255, Math.round(g / 32) * 32),
          Math.min(255, Math.round(b / 32) * 32)
        ];

        const colorKey = quantizedColor.join(',');
        const currentFreq = colorFrequency.get(colorKey) || 0;
        colorFrequency.set(colorKey, currentFreq + 1);
      }
    }

    // Convert color frequencies to color space
    const sortedColors = Array.from(colorFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0].split(',').map(Number));

    // Compute color diversity using color wheel distance
    const computeColorDiversity = (colors) => {
      let totalDiversity = 0;
      let comparisonCount = 0;

      for (let i = 0; i < colors.length; i++) {
        for (let j = i + 1; j < colors.length; j++) {
          const distance = Math.sqrt(
            Math.pow(colors[i][0] - colors[j][0], 2) +
            Math.pow(colors[i][1] - colors[j][1], 2) +
            Math.pow(colors[i][2] - colors[j][2], 2)
          );
          totalDiversity += distance;
          comparisonCount++;
        }
      }

      return totalDiversity / comparisonCount;
    };

    // Determine suggested palette size based on color diversity
    const diversity = computeColorDiversity(sortedColors.slice(0, 16));
    
    let suggestedPaletteSize = 8;
    if (diversity > 175) suggestedPaletteSize = 16;
    if (diversity > 250) suggestedPaletteSize = 32;
    if (diversity > 350) suggestedPaletteSize = 64;

    console.timeEnd('analyzeColorDiversity');
    return {
      diversity: diversity,
      suggestedPaletteSize: suggestedPaletteSize,
      topColors: sortedColors
    };
  }
}