class HistoryManager {
    constructor(canvasEngine, app) {
        this.canvasEngine = canvasEngine;
        this.app = app;
        this.undoStack = [];
        this.redoStack = [];

        this.isStrokeActive = false;
        this.currentStrokeData = null;

        this.setupListeners();
    }

    setupListeners() {
        const canvas = this.canvasEngine.canvas;
        canvas.addEventListener('historystart', () => this.startStroke());
        canvas.addEventListener('historyend', () => this.endStroke());
        canvas.addEventListener('beforechunkdraw', (e) => this.captureChunkState(e.detail.chunk, e.detail.key));
    }

    startStroke() {
        this.isStrokeActive = true;
        this.currentStrokeData = {
            chunksBefore: new Map(),
            chunksAfter: new Map(),
        };
    }

    captureChunkState(chunk, key) {
        if (this.isStrokeActive && !this.currentStrokeData.chunksBefore.has(key)) {
            const canvasCopy = document.createElement('canvas');
            canvasCopy.width = chunk.canvas.width;
            canvasCopy.height = chunk.canvas.height;
            canvasCopy.getContext('2d').drawImage(chunk.canvas, 0, 0);
            this.currentStrokeData.chunksBefore.set(key, canvasCopy);
        }
    }

    endStroke() {
        if (!this.isStrokeActive || this.currentStrokeData.chunksBefore.size === 0) {
            this.isStrokeActive = false;
            this.currentStrokeData = null; // Clear data if stroke was empty
            return;
        }

        for (const key of this.currentStrokeData.chunksBefore.keys()) {
            const currentChunk = this.canvasEngine.chunks.get(key);
            if (currentChunk) {
                const canvasCopy = document.createElement('canvas');
                canvasCopy.width = currentChunk.canvas.width;
                canvasCopy.height = currentChunk.canvas.height;
                canvasCopy.getContext('2d').drawImage(currentChunk.canvas, 0, 0);
                this.currentStrokeData.chunksAfter.set(key, canvasCopy);
            }
        }
        
        this.addAction(this.currentStrokeData);
        this.isStrokeActive = false;
        this.currentStrokeData = null;
    }

    addAction(action) {
        this.undoStack.push(action);
        this.redoStack = []; // Clear redo stack on new action
        this.app.updateHistoryButtons();
    }

    undo() {
        if (this.undoStack.length === 0) return;
        
        const action = this.undoStack.pop();
        this.redoStack.push(action);
        
        this.applyState(action.chunksBefore);
        this.app.updateHistoryButtons();
    }

    redo() {
        if (this.redoStack.length === 0) return;

        const action = this.redoStack.pop();
        this.undoStack.push(action);
        
        this.applyState(action.chunksAfter);
        this.app.updateHistoryButtons();
    }
    
    applyState(chunkStateMap) {
        for (const [key, stateCanvas] of chunkStateMap.entries()) {
            const chunk = this.canvasEngine.chunks.get(key);
            if (chunk) {
                chunk.ctx.clearRect(0, 0, chunk.canvas.width, chunk.canvas.height);
                chunk.ctx.drawImage(stateCanvas, 0, 0);
                chunk.dirty = true;
            }
        }
        this.canvasEngine.markDirty();
    }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.app.updateHistoryButtons();
    }

    canUndo() {
        return this.undoStack.length > 0;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }
}