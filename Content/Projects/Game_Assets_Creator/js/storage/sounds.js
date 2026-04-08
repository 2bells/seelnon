export class SoundStorage {
  constructor() {
    this.sounds = {};
    this.currentId = null;
    this.generator = null;
    this.soundsPerSprite = {}; // Track multiple sounds per sprite ID
  }

  createSound(id) {
    if (!this.sounds[id]) {
      this.sounds[id] = {
        wav: null,     // WAV data
        type: null,    // Sound type (jump, attack, etc.)
        params: null   // Parameters used to generate sound
      };
      this.currentId = id;
    }
    
    // Make sure we're tracking this sprite ID
    if (!this.soundsPerSprite[id.split('_sound_')[0]]) {
      this.soundsPerSprite[id.split('_sound_')[0]] = [];
    }
    
    return this.sounds[id];
  }

  storeSound(spriteId, wavData, type, params) {
    // First check if we already have this sound type for this sprite
    const existingSoundId = this.soundsPerSprite[spriteId]?.find(soundId => 
      this.sounds[soundId].type === type
    );

    // If found, update the existing sound
    if (existingSoundId) {
      this.sounds[existingSoundId].wav = wavData;
      this.sounds[existingSoundId].params = params;
      return existingSoundId;
    }

    // If not found, create a new sound entry
    const timestamp = Date.now();
    const soundId = `${spriteId}_sound_${timestamp}`;
    
    if (!this.sounds[soundId]) {
      this.createSound(soundId);
    }
    
    this.sounds[soundId].wav = wavData;
    this.sounds[soundId].type = type;
    this.sounds[soundId].params = params;
    
    // Track this sound for its sprite
    if (!this.soundsPerSprite[spriteId]) {
      this.soundsPerSprite[spriteId] = [];
    }
    
    // Add to the list if not already present
    if (!this.soundsPerSprite[spriteId].includes(soundId)) {
      this.soundsPerSprite[spriteId].push(soundId);
    }
    
    return soundId;
  }

  // Get all sounds for a specific sprite
  getSoundsForSprite(spriteId) {
    return this.soundsPerSprite[spriteId] || [];
  }
  
  getSound(id) {
    return this.sounds[id] ? this.sounds[id] : null;
  }

  getAllSounds() {
    return this.sounds;
  }

  setCurrentId(id) {
    if (this.sounds[id]) {
      this.currentId = id;
    }
  }

  getCurrentId() {
    return this.currentId;
  }

  getCurrentSound() {
    return this.currentId ? this.sounds[this.currentId] : null;
  }

  clear(id) {
    if (id && this.sounds[id]) {
      this.sounds[id] = null;
    }
  }
}