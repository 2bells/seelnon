export class SpriteStorage {
  constructor() {
    this.sprites = {};
    this.currentId = null;
    this.generator = null; 
    this.animations = {}; // Store animations for sprites
  }

  createSprite(id) {
    if (!this.sprites[id]) {
      this.sprites[id] = {
        '32': null,  // 32x32 sprite
        '64': null,  // 64x64 sprite
        '128': null, // 128x128 sprite
        '256': null,  // 256x256 sprite (original)
        'EDIT': null, // Editor size (typically 256x256)
        'ORIGINAL': null // Original full resolution image
      };
      this.currentId = id;
    }
    return this.sprites[id];
  }

  storeSprite(id, size, dataUrl) {
    if (!this.sprites[id]) {
      this.createSprite(id);
    }
    if (this.sprites[id].hasOwnProperty(size)) {
      this.sprites[id][size] = dataUrl;
    }
  }

  getSprite(id, size) {
    return this.sprites[id] && this.sprites[id][size] ? this.sprites[id][size] : null;
  }

  getAllSprites() {
    return this.sprites;
  }

  setCurrentId(id) {
    if (this.sprites[id]) {
      this.currentId = id;
    }
  }

  getCurrentId() {
    return this.currentId;
  }

  getCurrentSprite(size) {
    return this.currentId && this.sprites[this.currentId] ? 
      this.sprites[this.currentId][size] : null;
  }

  clear(id) {
    if (id && this.sprites[id]) {
      for (const size in this.sprites[id]) {
        this.sprites[id][size] = null;
      }
    }
  }

  storeAnimation(id, animationType, frames, fps) {
    if (!this.animations[id]) {
      this.animations[id] = {};
    }
    this.animations[id][animationType] = {
      frames: frames.map(frame => typeof frame === 'string' ? frame : frame.src), // Handle both string URLs and Image objects
      fps: fps
    };
  }

  getAnimation(id, animationType) {
    return this.animations[id] && this.animations[id][animationType] 
      ? this.animations[id][animationType] 
      : null;
  }

  getAnimationTypes(id) {
    return this.animations[id] ? Object.keys(this.animations[id]) : [];
  }
}