console.log("rpg/main.js loaded!");

import GameEngine from './engine.js';

const GAME_MODAL_ID = 'rpg-modal-overlay';
const GAME_CANVAS_ID = 'rpg-canvas';
let gameEngineInstance = null;

function createGameModal() {
    // Remove existing modal if any
    const existingModal = document.getElementById(GAME_MODAL_ID);
    if (existingModal) {
        existingModal.remove();
    }
    if (gameEngineInstance) {
        gameEngineInstance.stop(); // Stop previous engine instance if any
        gameEngineInstance = null;
    }

    const modalOverlay = document.createElement('div');
    modalOverlay.id = GAME_MODAL_ID;

    const modalContent = document.createElement('div');
    modalContent.id = 'rpg-modal-content';

    // Header
    const modalHeader = document.createElement('div');
    modalHeader.id = 'rpg-modal-header';
    const title = document.createElement('h2');
    title.id = 'rpg-modal-title';
    title.textContent = 'Tavern MMORPG';

    const editorButton = document.createElement('button');
    editorButton.id = 'rpg-editor-button';
    editorButton.innerHTML = '🛠️'; // Gear icon for editor
    editorButton.title = 'Toggle Map Editor';
    editorButton.onclick = () => {
        if (gameEngineInstance) {
            gameEngineInstance.toggleEditorMode();
        }
    };

    const npcCreatorButton = document.createElement('button');
    npcCreatorButton.id = 'rpg-npc-creator-button';
    npcCreatorButton.innerHTML = '👤'; // Placeholder icon
    npcCreatorButton.title = 'Toggle NPC Creator';
    npcCreatorButton.onclick = () => {
        if (gameEngineInstance) {
            gameEngineInstance.toggleNpcCreator();
        }
    };

    const lightEditorButton = document.createElement('button');
    lightEditorButton.id = 'rpg-light-editor-button';
    lightEditorButton.innerHTML = '💡'; // Lightbulb emoji
    lightEditorButton.title = 'Toggle Light Editor';
    lightEditorButton.onclick = () => {
        if (gameEngineInstance) {
            gameEngineInstance.toggleLightEditor();
        }
    };

    const closeButton = document.createElement('button');
    closeButton.id = 'rpg-close-button';
    closeButton.innerHTML = '&times;'; // "x" character
    closeButton.onclick = () => {
        // The stop() method will handle closing any active editors cleanly.
        modalOverlay.remove();
        if (gameEngineInstance) {
            gameEngineInstance.stop();
            gameEngineInstance = null;
        }
        // Remove the class from the body when the modal is closed
        document.body.classList.remove('game-active'); 
    };

    const headerControls = document.createElement('div');
    headerControls.id = 'rpg-modal-header-controls';
    headerControls.appendChild(editorButton);
    headerControls.appendChild(npcCreatorButton);
    headerControls.appendChild(lightEditorButton);
    headerControls.appendChild(closeButton);

    modalHeader.appendChild(title);
    modalHeader.appendChild(headerControls);

    // Canvas Container
    const canvasContainer = document.createElement('div');
    canvasContainer.id = 'rpg-canvas-container';
    
    const canvas = document.createElement('canvas');
    canvas.id = GAME_CANVAS_ID;
    // Set initial canvas size, can be adjusted
    // These should ideally match the container size or be responsive
    canvas.width = 800; 
    canvas.height = 600;
    
    canvasContainer.appendChild(canvas);

    // Zoom UI Controls
    const zoomControlsContainer = document.createElement('div');
    zoomControlsContainer.id = 'rpg-zoom-controls';
    
    const zoomInButton = document.createElement('button');
    zoomInButton.id = 'rpg-zoom-in';
    zoomInButton.textContent = '+';
    zoomInButton.onclick = () => {
        if (gameEngineInstance) gameEngineInstance.zoomIn();
    };

    const zoomOutButton = document.createElement('button');
    zoomOutButton.id = 'rpg-zoom-out';
    zoomOutButton.textContent = '-';
    zoomOutButton.onclick = () => {
        if (gameEngineInstance) gameEngineInstance.zoomOut();
    };

    zoomControlsContainer.appendChild(zoomInButton);
    zoomControlsContainer.appendChild(zoomOutButton);

    modalContent.appendChild(modalHeader);
    modalContent.appendChild(canvasContainer);
    modalContent.appendChild(zoomControlsContainer); // Add zoom controls to modal
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    
    // Adjust canvas size to fit container after it's in the DOM
    // Small delay to ensure layout is computed
    setTimeout(() => {
        const containerRect = canvasContainer.getBoundingClientRect();
        canvas.width = containerRect.width -2; // -2 for border
        canvas.height = containerRect.height -2; // -2 for border
        console.log(`Canvas resized to: ${canvas.width}x${canvas.height}`);
        
        // Now that canvas is sized, initialize and start the game engine
        if (gameEngineInstance) { // If re-initializing due to resize or something
            gameEngineInstance.stop();
        }
        gameEngineInstance = new GameEngine(canvas);
        gameEngineInstance.setZoom(2.5); // Initial zoom to 250%
        
        // Pass modalContent to gameEngineInstance for editor UI
        if(modalContent && gameEngineInstance) {
            gameEngineInstance.setModalContentElement(modalContent);
        }
        
        gameEngineInstance.start();

    }, 100);


    return canvas; // Return canvas mainly for initial reference, engine manages it now
}

function drawOnCanvas(canvas) {
    // This function is now obsolete as GameEngine handles rendering
    // Kept for historical reference or if needed for pre-engine splash
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error("Could not get 2D context from canvas");
        return;
    }
    ctx.fillStyle = '#D4C8A0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '20px Arial';
    ctx.fillStyle = '#3B322C';
    ctx.textAlign = 'center';
    ctx.fillText('Loading Game Engine...', canvas.width / 2, canvas.height / 2);
    console.log("Canvas placeholder drawing complete.");
}

export function initGameView() {
    console.log("custom/game/main.js: initGameView() called");
    
    const canvas = createGameModal(); // This now also starts the engine
    if (canvas) {
        // Initial placeholder content, GameEngine will take over rendering.
        // drawOnCanvas(canvas); // GameEngine clears and renders immediately
    } else {
        console.error("Failed to create game canvas.");
        document.body.classList.remove('game-active'); // Ensure class is removed if modal creation fails
    }
}

// Example: if you want to load other game modules
// import * as player from './entities/player.js'; // Already imported in engine

console.log("custom/game/main.js loaded and ready.");