console.log("game/main.js: Standalone engine loader loaded!");

import GameEngine from './engine.js';

let gameEngineInstance = null;

export function initStandaloneGame() {
    console.log("Initializing Standalone Isometric Game Engine...");

    const canvas = document.getElementById('rpg-canvas');
    const canvasContainer = document.getElementById('rpg-canvas-container');
    const appContainer = document.getElementById('rpg-app-container');

    if (!canvas || !canvasContainer || !appContainer) {
        console.error("Critical game container or canvas DOM elements are missing in index.html.");
        return;
    }

    // Double check scaling and bounds on container size
    const resizeCanvas = () => {
        const rect = canvasContainer.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        console.log(`Canvas scaled dynamically to: ${canvas.width}x${canvas.height}`);
    };

    // Calculate initial size
    resizeCanvas();

    // Set up resize observer to adjust the stage dynamically (Responsive Design)
    const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
            resizeCanvas();
            if (gameEngineInstance && gameEngineInstance.isRunning && gameEngineInstance.player && gameEngineInstance.map) {
                // Ensure proper camera update on resize
                const effectiveCanvasWidth = canvas.width / gameEngineInstance.zoomLevel;
                const effectiveCanvasHeight = canvas.height / gameEngineInstance.zoomLevel;
                gameEngineInstance.map.centerOn(
                    gameEngineInstance.player.currentPixelX,
                    gameEngineInstance.player.currentPixelY,
                    effectiveCanvasWidth,
                    effectiveCanvasHeight
                );
            }
        }
    });
    resizeObserver.observe(canvasContainer);

    // Initialize Game Engine instance
    if (gameEngineInstance) {
        gameEngineInstance.stop();
    }
    gameEngineInstance = new GameEngine(canvas);
    gameEngineInstance.setZoom(2.5); // Initial zoom to 250%

    // Bind the panels to overlay inside our app container
    gameEngineInstance.setModalContentElement(appContainer);

    // Start the game loop and render assets
    gameEngineInstance.start();

    // Hook up top-level control bar actions
    const editorBtn = document.getElementById('rpg-editor-button');
    if (editorBtn) {
        editorBtn.onclick = () => {
            if (gameEngineInstance) gameEngineInstance.toggleEditorMode();
        };
    }

    const npcCreatorBtn = document.getElementById('rpg-npc-creator-button');
    if (npcCreatorBtn) {
        npcCreatorBtn.onclick = () => {
            if (gameEngineInstance) gameEngineInstance.toggleNpcCreator();
        };
    }

    const lightEditorBtn = document.getElementById('rpg-light-editor-button');
    if (lightEditorBtn) {
        lightEditorBtn.onclick = () => {
            if (gameEngineInstance) gameEngineInstance.toggleLightEditor();
        };
    }

    const questEditorBtn = document.getElementById('rpg-quest-editor-button');
    if (questEditorBtn) {
        questEditorBtn.onclick = () => {
            if (gameEngineInstance) gameEngineInstance.toggleQuestEditor();
        };
    }

    const abilitiesEditorBtn = document.getElementById('rpg-abilities-editor-button');
    if (abilitiesEditorBtn) {
        abilitiesEditorBtn.onclick = () => {
            if (gameEngineInstance) gameEngineInstance.toggleAbilitiesEditor();
        };
    }

    const itemEditorBtn = document.getElementById('rpg-item-editor-button');
    if (itemEditorBtn) {
        itemEditorBtn.onclick = () => {
            if (gameEngineInstance) gameEngineInstance.toggleItemEditor();
        };
    }

    // Zoom Button Binds
    const zoomInBtn = document.getElementById('rpg-zoom-in');
    if (zoomInBtn) {
        zoomInBtn.onclick = () => {
            if (gameEngineInstance) gameEngineInstance.zoomIn();
        };
    }

    const zoomOutBtn = document.getElementById('rpg-zoom-out');
    if (zoomOutBtn) {
        zoomOutBtn.onclick = () => {
            if (gameEngineInstance) gameEngineInstance.zoomOut();
        };
    }

    console.log("Standalone Isometric Game Engine initialized successfully!");
}

// Map old initGameView to the standalone initialization for backward compatibility
export function initGameView() {
    initStandaloneGame();
}
