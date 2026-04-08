export class PaletteStorage {
  constructor() {
    this.palettes = {};
    this.currentId = null;
  }

  createPalette(id) {
    if (!this.palettes[id]) {
      this.palettes[id] = {
        '8': null,   // 8 colors palette
        '16': null,  // 16 colors palette
        '32': null,  // 32 colors palette
        '64': null   // 64 colors palette
      };
      this.currentId = id;
    }
    return this.palettes[id];
  }

  storePalette(id, size, colorArray) {
    if (!this.palettes[id]) {
      this.createPalette(id);
    }
    if (this.palettes[id].hasOwnProperty(size)) {
      this.palettes[id][size] = colorArray;
    }
  }

  getPalette(id, size) {
    return this.palettes[id] && this.palettes[id][size] ? this.palettes[id][size] : null;
  }

  getAllPalettes() {
    return this.palettes;
  }

  setCurrentId(id) {
    if (this.palettes[id]) {
      this.currentId = id;
    }
  }

  getCurrentId() {
    return this.currentId;
  }

  getCurrentPalette(size) {
    return this.currentId && this.palettes[this.currentId] ? 
      this.palettes[this.currentId][size] : null;
  }

  clear(id) {
    if (id && this.palettes[id]) {
      for (const size in this.palettes[id]) {
        this.palettes[id][size] = null;
      }
    }
  }
}