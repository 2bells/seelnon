export function _disposeAction(action) {
  if (!action) return;
  if (action.chunks) {
      action.chunks.forEach(data => {
          if (data.canvas) {
              data.canvas.width = 1;
              data.canvas.height = 1;
              data.canvas = null;
          }
      });
      action.chunks.clear();
  }
  if (action.selection && action.selection.canvas) {
      if (this && this.floatingSelection && (action.selection === this.floatingSelection || action.selection.canvas === this.floatingSelection.canvas)) {
          // Do not destroy the canvas as it is currently being used by the active floatingSelection!
      } else {
          action.selection.canvas.width = 1;
          action.selection.canvas.height = 1;
          action.selection.canvas = null;
      }
  }
}

export function _pushHistory(action) {
  this.history.push(action);
  if (this.history.length > 50) {
      const oldest = this.history.shift();
      this._disposeAction(oldest);
  }
}

export function _clearStack(stack) {
  if (!stack) return;
  while (stack.length > 0) {
      this._disposeAction(stack.pop());
  }
}

export function compact() {
  // Clear redo stack on save to free up memory
  this._clearStack(this.redoStack);
}

export function undo() {
  if (this.history.length === 0) return;
  
  const action = this.history.pop();
  const redoAction = {
      type: action.type,
      chunks: new Map(),
      path: this.activeSelectionPath ? [...this.activeSelectionPath] : null,
      selection: this.floatingSelection ? { ...this.floatingSelection } : null
  };

  // Restore chunks
  if (action.chunks) {
      action.chunks.forEach((data, id) => {
          const chunk = this.chunks.get(id);
          if (chunk) {
              const srcCanvas = chunk.canvases[data.layer];
              const redoBackup = document.createElement('canvas');
              redoBackup.width = srcCanvas.width;
              redoBackup.height = srcCanvas.height;
              redoBackup.getContext('2d').drawImage(srcCanvas, 0, 0);
              redoAction.chunks.set(id, { layer: data.layer, canvas: redoBackup });

              const ctx = chunk.ctxs[data.layer];
              ctx.save();
              ctx.setTransform(1, 0, 0, 1, 0, 0);
              ctx.clearRect(0, 0, srcCanvas.width, srcCanvas.height);
              ctx.drawImage(data.canvas, 0, 0);
              ctx.restore();
              this._markDirty(id, data.layer);
          }
      });
  }

  // Restore Selection/Transform state
  if (action.type === 'selection') {
      this.activeSelectionPath = action.path;
  } else if (action.type === 'transform') {
      this.floatingSelection = null;
      this.activeSelectionPath = action.path;
  } else if (action.type === 'stroke') {
      if (action.selection) this.floatingSelection = action.selection;
  }

  // Dispose action containing selection only after restoring it to this.floatingSelection
  if (action.chunks) {
      this._disposeAction(action);
  }

  this.redoStack.push(redoAction);
  this._updateSelectionPreview();
  this.refresh();
  this._status('UNDO');
  if (this.onDrawEnd) this.onDrawEnd();
}

export function redo() {
  if (this.redoStack.length === 0) return;
  
  const action = this.redoStack.pop();
  const undoAction = {
      type: action.type,
      chunks: new Map(),
      path: this.activeSelectionPath ? [...this.activeSelectionPath] : null,
      selection: this.floatingSelection ? { ...this.floatingSelection } : null
  };

  if (action.chunks) {
      action.chunks.forEach((data, id) => {
          const chunk = this.chunks.get(id);
          if (chunk) {
              const srcCanvas = chunk.canvases[data.layer];
              const undoBackup = document.createElement('canvas');
              undoBackup.width = srcCanvas.width;
              undoBackup.height = srcCanvas.height;
              undoBackup.getContext('2d').drawImage(srcCanvas, 0, 0);
              undoAction.chunks.set(id, { layer: data.layer, canvas: undoBackup });

              const ctx = chunk.ctxs[data.layer];
              ctx.save();
              ctx.setTransform(1, 0, 0, 1, 0, 0);
              ctx.clearRect(0, 0, srcCanvas.width, srcCanvas.height);
              ctx.drawImage(data.canvas, 0, 0);
              ctx.restore();
              this._markDirty(id, data.layer);
          }
      });
  }

  if (action.type === 'selection') {
      this.activeSelectionPath = action.path;
  } else if (action.type === 'transform') {
      this.floatingSelection = action.selection;
      this.activeSelectionPath = null;
  } else if (action.type === 'stroke') {
      if (action.selection) this.floatingSelection = null; // Re-applying stroke clears the "source" floating selection
  }

  this._pushHistory(undoAction);
  this._disposeAction(action);
  this._updateSelectionPreview();
  this.refresh();
  this._status('REDO');
  if (this.onDrawEnd) this.onDrawEnd();
}
