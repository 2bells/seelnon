// A base set of properties for a brush preset to ensure all presets have common properties
const baseBrushProperties = {
    color: '#000000',
    size: 5.0,
    opacity: 1,
    pressureSensitivity: false,
    speedSensitivity: true,
    speedSensitivityFactor: 3.0,
    minSizeFactor: 0.2, // Min size as a percentage of main size for dynamics
    tipShape: 'round', // 'round' or 'square'
    nonCompoundingOpacity: false, // if true, attempts to prevent opacity compounding within a stroke
    pixelSize: 10, // For pixel brush

    // New general smoothing settings
    enableSmoothing: false,
    smoothingFactor: 0.005, // Changed: 0 to 0.1 internally, UI maps 0-100 (0.0% to 10.0%)
    
    // Wireframe specific
    wireframeMeshOpacity: 0.1,
    wireframeLineOpacity: 0.8,
    wireframeHullLineThickness: 5.0,
    wireframeMeshLineThickness: 1.0,
    wireframePointRadius: 0,
    wireframePointOpacity: 1.0,
    wireframePointColor: null,
    wireframeAnimationSpeed: 0,
    wireframeAnimationAmount: 0,
    wireframeIsClosed: true,
    wireframeMaxMeshLength: 200, // New: Max length for mesh lines (world units), or Infinity for no limit
    wireframeGradientMesh: false, // New: Toggle for gradient mesh thickness based on length
    wireframeGradientMeshBoostFactor: 2.0, // New: How much 'extra' thickness the gradient mesh can get at min length (0-5x of base thickness)
};

export const state = {
    isDrawing: false,
    isPanning: false,
    isZoomingWithMouse: false,
    isSelecting: false, // For selection tool
    isErasing: false, // New: For continuous erasing
    spacebarPressed: false,
    zKeyPressed: false,
    altKeyPressed: false,
    activeTool: 'brush', // 'brush', 'eraser', 'selection'
    panOffset: { x: 0, y: 0 },
    zoom: 1,
    lastMousePosition: { x: 0, y: 0 },
    lastDrawPosition: { x: 0, y: 0, timestamp: 0 },
    
    // Drawing data
    strokes: [],
    currentStroke: null,
    currentMirrorStroke: null, // For mirror mode
    
    // Selection rectangle
    selection: null, // { x, y, width, height } in world coordinates

    // History for undo/redo
    history: [],
    historyIndex: -1,
    HISTORY_MAX_SIZE: 100, // Limit history states to prevent excessive storage use

    // All defined brush presets
    brushPresets: {
        'pen-default': {
            name: 'Default Pen',
            baseType: 'pen', // Grouping for UI
            ...baseBrushProperties,
            type: 'pen', // Actual rendering type
            size: 5.0,
            opacity: 1.0,
            tipShape: 'round',
            nonCompoundingOpacity: false,
            pressureSensitivity: false,
            speedSensitivity: true,
            minSizeFactor: 0.2,
            speedSensitivityFactor: 3.0,
            pixelSize: 10, // Ensure pixelSize is always present for consistency
            enableSmoothing: false, // Specific override
            smoothingFactor: 0.005, // Changed
            // For other brush types, these wireframe properties will be present but ignored.
            // Explicitly setting them here ensures they don't override the base for wireframe.
            // If a property isn't relevant to a brush type, its default from baseBrushProperties is usually fine.
        },
        'pen-fineliner': {
            name: 'Fine Liner',
            baseType: 'pen',
            ...baseBrushProperties,
            type: 'pen',
            color: '#333333',
            size: 2.0,
            opacity: 0.8,
            tipShape: 'round',
            nonCompoundingOpacity: true,
            pressureSensitivity: false,
            speedSensitivity: false,
            minSizeFactor: 0.9,
            pixelSize: 10,
            enableSmoothing: false,
            smoothingFactor: 0.005, // Changed
        },
        'wireframe-default': {
            name: 'Default Wireframe',
            baseType: 'wireframe',
            ...baseBrushProperties,
            type: 'wireframe',
            size: 10.0,
            opacity: 0.7, // Overall opacity for the brush, will be multiplied by mesh/line opacities
            tipShape: 'round', // Doesn't really apply to wireframe, but keep for consistency
            pixelSize: 10,
            enableSmoothing: false,
            smoothingFactor: 0.005, // Changed
            
            // Wireframe specific settings
            wireframeMeshOpacity: 0.1, // Opacity for the filled triangles
            wireframeLineOpacity: 0.8, // Opacity for the Delaunay edges
            wireframeHullLineThickness: 5.0, // Thickness of the hull lines
            wireframeMeshLineThickness: 1.0, // Thickness of the internal mesh lines
            wireframePointRadius: 0, // New: Radius of dots at each point (0 to disable)
            wireframePointOpacity: 1.0, // New: Opacity of points
            wireframePointColor: null, // New: null to use stroke color, or specific hex
            wireframeAnimationSpeed: 0, // New: Time in ms between animation updates (0 for static)
            wireframeAnimationAmount: 0, // New: Max displacement for point animation
            wireframeIsClosed: true, // New: Whether the wireframe closes itself with a hull and fills triangles
            wireframeMaxMeshLength: 200, // New default for wireframe: max 200 world units between connected mesh points
            wireframeGradientMesh: false, // New: Gradient mesh thickness off by default
            wireframeGradientMeshBoostFactor: 2.0, // New default for gradient mesh boost factor
        },
        'wireframe-open': { // New preset for open wireframe
            name: 'Open Wireframe',
            baseType: 'wireframe',
            ...baseBrushProperties,
            type: 'wireframe',
            size: 10.0,
            opacity: 0.7,
            tipShape: 'round',
            pixelSize: 10,
            enableSmoothing: false,
            smoothingFactor: 0.005,
            
            // Wireframe specific settings
            wireframeMeshOpacity: 0.0, // No fill for open wireframe
            wireframeLineOpacity: 0.8, 
            wireframeHullLineThickness: 5.0, // Changed from 0.0 to 5.0 for a visible hull
            wireframeMeshLineThickness: 1.0,
            wireframePointRadius: 0,
            wireframePointOpacity: 1.0,
            wireframePointColor: null,
            wireframeAnimationSpeed: 0,
            wireframeAnimationAmount: 0,
            wireframeIsClosed: false, // This is the key difference
            wireframeMaxMeshLength: 200, // New default for wireframe
            wireframeGradientMesh: false, // New: Gradient mesh thickness off by default
            wireframeGradientMeshBoostFactor: 2.0, // New default for gradient mesh boost factor
        },
        'pixel-default': {
            name: 'Default Pixel',
            baseType: 'pixel',
            ...baseBrushProperties,
            type: 'pixel',
            size: 5.0, // Base size, but pixelSize controls actual pixel block size
            opacity: 1.0,
            pixelSize: 10,
            nonCompoundingOpacity: true,
            enableSmoothing: false,
            smoothingFactor: 0.005, // Changed
        },
        'pixel-chunky': {
            name: 'Chunky Pixel',
            baseType: 'pixel',
            ...baseBrushProperties,
            type: 'pixel',
            color: '#ff453a',
            size: 8.0,
            opacity: 0.9,
            pixelSize: 20,
            nonCompoundingOpacity: true,
            enableSmoothing: false,
            smoothingFactor: 0.005, // Changed
        },
        'sketchy-static': { 
            name: 'Sketchy Static',
            baseType: 'sketchy', 
            ...baseBrushProperties,
            type: 'sketchy', // Render type
            size: 15.0,
            opacity: 0.7,
            minSizeFactor: 0.1,
            nonCompoundingOpacity: true,
            pressureSensitivity: false,
            speedSensitivity: false,
            pixelSize: 10,
            enableSmoothing: false,
            smoothingFactor: 0.005, // Changed

            // Sketchy specific settings
            jitterAmount: 0.4, // Multiplier for jitter based on brush size
            jitterDensity: 3, // Number of passes
            animationInterval: 0, // Not animated, set to 0
        },
        'sketchy-animated': {
            name: 'Sketchy Animated',
            baseType: 'sketchy',
            ...baseBrushProperties,
            type: 'sketchy-animated', // Render type
            size: 15.0,
            opacity: 0.7,
            minSizeFactor: 0.1,
            nonCompoundingOpacity: true,
            pressureSensitivity: false,
            speedSensitivity: false,
            pixelSize: 10,
            enableSmoothing: false,
            smoothingFactor: 0.005, // Changed

            // Sketchy specific settings
            jitterAmount: 0.4,
            jitterDensity: 3,
            animationInterval: 1500, // Time in ms between animation updates
        },
        'eraser-default': { 
            name: 'Default Eraser',
            baseType: 'eraser',
            ...baseBrushProperties,
            type: 'pen', // Eraser uses the 'pen' drawing logic, but with clear blend mode (handled in events, not here)
            color: '#ffffff', // This is technically unused since eraser clears, but for consistency.
            size: 20.0,
            opacity: 1.0,
            tipShape: 'round',
            nonCompoundingOpacity: true, // Eraser should typically be non-compounding
            pixelSize: 10,
            enableSmoothing: false,
            smoothingFactor: 0.005, // Changed
        },
    },
    activeBrushPresetId: 'pen-default', // Default active preset on load

    // This 'brush' object will always be a deep copy of the currently active preset.
    // It will be modified directly by the brush editor, and used for new strokes.
    brush: structuredClone(baseBrushProperties), // Initialized with base properties

    // Canvas settings
    canvasSettings: {
        backgroundColor: '#ffffff',
        backgroundType: 'none', // 'none', 'dots', 'grid', 'horizontal', 'vertical'
        backgroundSpacing: 50, // For dots, grid, lines
    },

    // Modes
    mirrorMode: false,
    isCanvasFlipped: false,
};