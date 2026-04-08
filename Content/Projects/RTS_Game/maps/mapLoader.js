// This file will handle loading and managing different maps
import { balancedMap } from './balanced.js';
import { wetlandsMap } from './wetlands.js';
import { randomMap } from './random.js';
import { mountainPassMap } from './mountain_pass.js';
import { agesMap } from './ages.js';
import { forestNothingMap } from './forest_nothing.js';

export class MapLoader {
  constructor() {
    this.maps = {
      balanced: balancedMap,
      random: randomMap,
      wetlands: wetlandsMap,
      mountain_pass: mountainPassMap,
      ages: agesMap,
      forest_nothing: forestNothingMap  // Add the new map
    };
    this.currentMap = null;
  }

  loadMap(mapName, canvas) {
    if (!this.maps[mapName]) {
      console.error(`Map ${mapName} not found`);
      return null;
    }

    this.currentMap = this.maps[mapName];
    
    return {
      goldPositions: this.currentMap.getResourcePositions(canvas).goldPositions,
      woodPositions: this.currentMap.getResourcePositions(canvas).woodPositions,
      terrain: this.currentMap.getTerrainData ? this.currentMap.getTerrainData(canvas) : null,
      walls: this.currentMap.getWallData ? this.currentMap.getWallData(canvas) : null,
      getInitialBuildingPositions: this.currentMap.getInitialBuildingPositions 
    };
  }

  getCurrentMap() {
    return this.currentMap;
  }
}