// Constants for water simulation
const damping = 0.99;
const dt = 0.05;
// Changed charMap to explicitly define space as the first character
const charMap = [' ', '.', ':', '-', '=', '+', '*', '#', '%', '@']; // ASCII characters for water depth (10 chars)
const treeChars = ['♠', '♣', '♧', '☘']; // ASCII characters for trees

// Global state for water simulation (these will be managed within the module)
let water;
let nextWater;
let velocity;
let obstacles = [];
let trees;
let boats = [];
let isRaining = false; 
let isDraining = true; // User requested 'drain' to be on
let colorScheme = 'blue'; // Default color scheme

let asciiCanvas; // Reference to the <pre> element
let gridWidth = 0;
let gridHeight = 0;
let charWidth = 8; // Default value, will be measured
let charHeight = 8; // Default value, will be measured

// --- Helper Classes (from original script) ---
class Obstacle {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
    contains(x, y) {
        return x >= this.x && x < this.x + this.width &&
               y >= this.y && y < this.y + this.height;
    }
}
class Boat { 
    constructor(x, y) {
        if (!gridWidth || !gridHeight) {
            console.warn("Attempted to create boat before grid dimensions are set.");
            this.x = 0; this.y = 0; // Fallback
        } else {
            this.x = x;
            this.y = y;
        }
        this.vx = 0;
        this.vy = 0;
    }
    update() {
        if (!gridWidth || !gridHeight) return; 
        const i = Math.floor(this.y) * gridWidth + Math.floor(this.x);
        if (i < 0 || i >= water.length || isNaN(i)) return; // Added NaN check

        const waterHeight = water[i] || 0;
        
        let waterGradientX = 0, waterGradientY = 0;
        // Ensure bounds checking for gradients to prevent errors at edges
        if (Math.floor(this.x) + 1 < gridWidth && Math.floor(this.x) - 1 >= 0) {
            waterGradientX = (water[i + 1] || 0) - (water[i - 1] || 0);
        }
        if (Math.floor(this.y) + 1 < gridHeight && Math.floor(this.y) - 1 >= 0) {
            waterGradientY = (water[i + gridWidth] || 0) - (water[i - gridWidth] || 0);
        }

        this.vx += waterGradientX * 0.1;
        this.vy += waterGradientY * 0.1;

        this.vx *= 0.98;
        this.vy *= 0.98;

        const newX = this.x + this.vx * dt;
        const newY = this.y + this.vy * dt;

        if (!isCollidingWithObstacle(newX, newY)) {
            this.x = newX;
            this.y = newY;
        } else {
            this.vx *= -0.5;
            this.vy *= -0.5;
        }

        // Boundary check
        this.x = Math.max(1, Math.min(gridWidth - 2, this.x));
        this.y = Math.max(1, Math.min(gridHeight - 2, this.y));

        const disturbanceStrength = 0.5;
        // Apply disturbance to water, with checks to stay within bounds
        if (i >= 0 && i < water.length) water[i] += disturbanceStrength;
        if (i - 1 >= 0 && i - 1 < water.length) water[i - 1] += disturbanceStrength * 0.4;
        if (i + 1 < water.length) water[i + 1] += disturbanceStrength * 0.4;
        if (i - gridWidth >= 0 && i - gridWidth < water.length) water[i - gridWidth] += disturbanceStrength * 0.4;
        if (i + gridWidth < water.length) water[i + gridWidth] += disturbanceStrength * 0.4;
    }
}
// --- End Helper Classes ---

function isCollidingWithObstacle(x, y) {
    return obstacles.some(obstacle => obstacle.contains(Math.floor(x), Math.floor(y)));
}

function updateWater() {
    for (let i = gridWidth + 1; i < gridWidth * gridHeight - gridWidth - 1; i++) {
        const x = i % gridWidth;
        const y = Math.floor(i / gridWidth);
        if (isCollidingWithObstacle(x, y)) continue;
        if (trees[i] > 0) {
            const absorbedWater = Math.min(water[i], 0.1);
            water[i] -= absorbedWater;
            trees[i] += absorbedWater * 0.1;
            continue;
        }
        
        // Use bounds checking for neighbor access to prevent array out-of-bounds errors
        const w_negX = (x > 0) ? water[i - 1] : water[i];
        const w_posX = (x < gridWidth - 1) ? water[i + 1] : water[i];
        const w_negY = (y > 0) ? water[i - gridWidth] : water[i];
        const w_posY = (y < gridHeight - 1) ? water[i + gridWidth] : water[i];

        const avgHeight = (w_negY + w_posY + w_negX + w_posX) * 0.25;
        const acceleration = (avgHeight - water[i]) * 9.81;
        velocity[i] += acceleration * dt;
        velocity[i] *= damping;
        nextWater[i] = water[i] + velocity[i] * dt;

        if (isDraining) {
            nextWater[i] *= 0.99; 
        }
    }

    let temp = water;
    water = nextWater;
    nextWater = temp;

    updateBoats();
}

function handleBoundaries() {
    // Copy values from inner cells to boundary cells to simulate a closed boundary
    for (let x = 0; x < gridWidth; x++) {
        water[x] = water[gridWidth + x]; // Top row from second row
        water[gridWidth * (gridHeight - 1) + x] = water[gridWidth * (gridHeight - 2) + x]; // Bottom row from second to last row
    }
    for (let y = 0; y < gridHeight; y++) {
        water[y * gridWidth] = water[y * gridWidth + 1]; // Leftmost column from second column
        water[y * gridWidth + gridWidth - 1] = water[y * gridWidth + gridWidth - 2]; // Rightmost column from second to last column
    }
}

function updateBoats() {
    boats.forEach(boat => boat.update());
}

/**
 * Adds a ripple to the water at the given (x, y) coordinates in pixel space.
 * These coordinates will be translated to the ASCII grid.
 * @param {number} pixelX - X coordinate in pixels relative to the asciiCanvas.
 * @param {number} pixelY - Y coordinate in pixels relative to the asciiCanvas.
 * @param {number} strength - The strength of the ripple.
 */
function addWaterDropFromPixel(pixelX, pixelY, strength = 5) {
    if (!asciiCanvas || !gridWidth || !gridHeight || !charWidth || !charHeight) return;

    // Shift the pixelX by half a character width to align node center with character cell center
    // This should correct for the ripple appearing slightly to the right of the node by moving target ripple left.
    const effectivePixelX = pixelX - (charWidth / 2); 

    // Convert effective pixel coordinates to grid coordinates
    const gridX = Math.floor(effectivePixelX / charWidth);
    const gridY = Math.floor(pixelY / charHeight); // No vertical adjustment specified by user

    if (gridX > 0 && gridX < gridWidth - 1 && gridY > 0 && gridY < gridHeight - 1) { 
        const i = gridY * gridWidth + gridX;
        if (trees[i] === 0 && !isCollidingWithObstacle(gridX, gridY)) {
            // Apply strength, ensuring it's not below current water level for an additive effect
            water[i] = Math.max(water[i], Math.min(strength, 10)); 
            // Also add a more significant perturbation to neighbors for a more natural and noticeable ripple spread
            const neighborStrengthFactor = 0.3; 
            if (i - 1 >= 0 && i - 1 < water.length) water[i - 1] += strength * neighborStrengthFactor;
            if (i + 1 < water.length) water[i + 1] += strength * neighborStrengthFactor;
            if (i - gridWidth >= 0 && i - gridWidth < water.length) water[i - gridWidth] += strength * neighborStrengthFactor;
            if (i + gridWidth < water.length) water[i + gridWidth] += strength * neighborStrengthFactor;
        }
    }
}

// Changed getAsciiChar logic for explicit deadzone and linear mapping
function getAsciiChar(value) {
    const deadZone = 0.05; // Values smaller than this absolute value are considered "empty"
    const maxDisplayValue = 4; // Max abs value that will map to the last char (excluding space)

    const absValue = Math.abs(value);

    if (absValue < deadZone) {
        return charMap[0]; // Return space for very small values, achieving "no ASCII at all when empty"
    }

    // Scale absValue from [deadZone, maxDisplayValue] to [1, charMap.length - 1]
    // The range of mappable characters is from index 1 to charMap.length - 1 (9 characters).
    // So, we want to map scaledValue from [0, 1] to indices [1, 9].
    const scaleRange = maxDisplayValue - deadZone;
    const scaledValue = Math.min(Math.max(0, absValue - deadZone), scaleRange) / scaleRange;
    
    // Map scaledValue (0 to 1) to charMap indices from 1 to 9
    // `charMap.length - 1 - 1` gives 8, for 9 characters (indices 1 to 9)
    const charIndex = Math.floor(scaledValue * (charMap.length - 1 - 1)) + 1; 

    return charMap[Math.min(charIndex, charMap.length - 1)]; // Ensure index is within bounds (1-9)
}

function getTreeChar(size) {
    if (size < 1.5) return treeChars[0];
    if (size < 3) return treeChars[1];
    if (size < 5) return treeChars[2];
    return treeChars[3];
}

function render() {
    let asciiArt = '';
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const i = y * gridWidth + x;
            if (i < 0 || i >= water.length) { // Basic bounds check
                asciiArt += ' ';
                continue;
            }

            if (trees[i] > 0) {
                asciiArt += getTreeChar(trees[i]);
            } else if (isCollidingWithObstacle(x, y)) {
                asciiArt += '█';
            } else {
                let isBoat = false;
                for (const boat of boats) {
                    // Check if boat is within the current character cell (x,y)
                    if (Math.floor(boat.x) === x && Math.floor(boat.y) === y) {
                        asciiArt += '⛵';
                        isBoat = true;
                        break;
                    }
                }
                if (!isBoat) {
                    asciiArt += getAsciiChar(water[i]);
                }
            }
        }
        asciiArt += '\n';
    }
    asciiCanvas.textContent = asciiArt;
}

function animate() {
    updateWater();
    handleBoundaries(); 
    render();
    requestAnimationFrame(animate);
}

function init(canvasElement) {
    asciiCanvas = canvasElement;
    if (!asciiCanvas) {
        console.error("ASCII water canvas element not found.");
        return;
    }

    // Measure character dimensions accurately using computed styles
    const computedStyle = window.getComputedStyle(asciiCanvas);
    const tempSpan = document.createElement('span');
    tempSpan.style.fontFamily = computedStyle.fontFamily;
    tempSpan.style.fontSize = computedStyle.fontSize;
    tempSpan.style.lineHeight = computedStyle.lineHeight;
    tempSpan.style.letterSpacing = computedStyle.letterSpacing;
    tempSpan.style.position = 'absolute';
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.whiteSpace = 'pre'; // Crucial for accurate measurement of multiple chars without wrapping
    tempSpan.textContent = 'MMMMMMMMMM'; // Use multiple characters for average width
    document.body.appendChild(tempSpan);
    charWidth = tempSpan.offsetWidth / 10; // Divide by 10 for average
    charHeight = tempSpan.offsetHeight; // Height should still be accurate
    document.body.removeChild(tempSpan);

    resizeWaterGrid();
    
    window.addEventListener('resize', resizeWaterGrid); 

    // Initial render to display the water immediately
    render();

    animate();
}

function resizeWaterGrid() {
    if (!asciiCanvas || !charWidth || !charHeight) return;

    const rect = asciiCanvas.getBoundingClientRect();
    const newGridWidth = Math.floor(rect.width / charWidth);
    const newGridHeight = Math.floor(rect.height / charHeight);

    if (newGridWidth <= 0 || newGridHeight <= 0) { // Prevent division by zero or negative grid
        return;
    }
    
    if (newGridWidth === gridWidth && newGridHeight === gridHeight) return;

    const oldWater = water;
    const oldVelocity = velocity;
    const oldTrees = trees;

    gridWidth = newGridWidth;
    gridHeight = newGridHeight;

    water = new Float32Array(gridWidth * gridHeight);
    nextWater = new Float32Array(gridWidth * gridHeight);
    velocity = new Float32Array(gridWidth * gridHeight);
    trees = new Float32Array(gridWidth * gridHeight);

    // Initialize water to 0 to ensure an empty look when no ripples are present
    // Or copy old water values if grid resizes
    if (oldWater) {
        // Correctly handle copying data if grid dimensions change.
        // It's important to use the old gridWidth to calculate old_i
        const oldGridWidth = Math.floor(asciiCanvas.getBoundingClientRect().width / (oldWater.charWidth || charWidth)); // Fallback if old water didn't store its charWidth
        const minCopyWidth = Math.min(oldGridWidth, gridWidth);
        const minCopyHeight = Math.min(Math.floor(oldWater.length / oldGridWidth), gridHeight);

        for (let y = 0; y < minCopyHeight; y++) {
            for (let x = 0; x < minCopyWidth; x++) {
                const old_i = y * oldGridWidth + x;
                const new_i = y * gridWidth + x;
                if (old_i < oldWater.length && new_i < water.length) {
                    water[new_i] = oldWater[old_i];
                    velocity[new_i] = oldVelocity[old_i];
                    trees[new_i] = oldTrees[old_i];
                }
            }
        }
    } else {
        // Initialize water to 0 to ensure an empty look when no ripples are present
        for (let i = 0; i < water.length; i++) {
            water[i] = 0; 
        }
    }

    // Filter out obstacles and boats that are now out of bounds
    obstacles = obstacles.filter(o => (o.x + o.width) < gridWidth && (o.y + o.height) < gridHeight);
    boats = boats.filter(b => b.x < gridWidth && b.y < gridHeight);
}


export { init as initWaterPool, addWaterDropFromPixel };