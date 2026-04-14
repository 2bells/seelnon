export const WIDTH = 80;
export const HEIGHT = 24;

export const createGrid = () => Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(' '));

export const renderGrid = (grid) => grid.map(row => row.join('')).join('\n');