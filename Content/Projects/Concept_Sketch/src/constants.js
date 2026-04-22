export const CHUNK_SIZE = 1024;
export const MAX_CHUNKS = 64; // 64 * 1024 = 65536px
export const LAYERS_COUNT = 4; // 3 Draw + 1 Image
export const STORAGE_KEY = 'BRUT_SKETCH_DATA';

export const COLORS = [
  '#000000', '#1a1a1a', '#333333', '#4d4d4d', '#666666', '#808080',
  '#999999', '#b3b3b3', '#cccccc', '#e5e5e5', '#f2f2f2', '#ffffff',
  '#2d1e1e', '#4a2c2c', '#7c4b4b', '#b36b6b', '#d19292', '#e8caca',
  '#1e2d1e', '#2c4a2c', '#4b7c4b', '#6bb36b', '#92d192', '#cae8ca',
  '#1e1e2d', '#2c2c4a', '#4b4b7c', '#6b6bb3', '#9292d1', '#cacae8',
  '#2d2d1e', '#4a4a2c', '#7c7c4b', '#b3b36b', '#d1d192', '#e8e8ca'
];

export const TOOLS = {
  BRUSH: 'brush',
  ERASER: 'eraser',
  WIREFRAME: 'wireframe',
  LASSO: 'lasso',
  PICKER: 'picker'
};
