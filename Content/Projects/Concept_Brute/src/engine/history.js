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
  // Track 30 actions to conserve IndexDB storage
  if (this.history.length > 30) {
      const oldest = this.history.shift();
      this._disposeAction(oldest);
  }
  if (action && action.type === 'stroke' && this.app && this.app.recorder) {
      this.app.recorder.onStrokeCommitted();
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
  // Handle nested/transform-only history first if there's an active floating selection
  if (this.floatingSelection) {
      if (this.transformHistory && this.transformHistory.length > 0) {
          const adj = this.transformHistory.pop();
          if (!this.transformRedoHistory) this.transformRedoHistory = [];
          this.transformRedoHistory.push(adj);
          this.restoreFloatingSelectionState(adj.before);
          this._status('UNDO ADJUSTMENT');
          if (this.onDrawEnd) this.onDrawEnd();
          return;
      }
  }

  if (this.history.length === 0) return;
  
  const action = this.history.pop();
  if (action && action.type === 'stroke' && this.app && this.app.recorder) {
      this.app.recorder.onUndoCommitted();
  }
  let redoAction;

  if (action.type === 'reference_change') {
      redoAction = {
          type: 'reference_change',
          referenceImagesState: this.captureReferenceImagesState()
      };
      this.restoreReferenceImagesState(action.referenceImagesState);
  } else {
      redoAction = {
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
  }

  this.redoStack.push(redoAction);
  this._updateSelectionPreview();
  this.refresh();
  this._status('UNDO');
  if (this.onDrawEnd) this.onDrawEnd();
}

export function redo() {
  // Handle nested/transform-only redo first if there's an active floating selection
  if (this.floatingSelection) {
      if (this.transformRedoHistory && this.transformRedoHistory.length > 0) {
          const adj = this.transformRedoHistory.pop();
          if (!this.transformHistory) this.transformHistory = [];
          this.transformHistory.push(adj);
          this.restoreFloatingSelectionState(adj.after);
          this._status('REDO ADJUSTMENT');
          if (this.onDrawEnd) this.onDrawEnd();
          return;
      }
  }

  if (this.redoStack.length === 0) return;
  
  const action = this.redoStack.pop();
  if (action && action.type === 'stroke' && this.app && this.app.recorder) {
      this.app.recorder.onRedoCommitted();
  }
  let undoAction;

  if (action.type === 'reference_change') {
      undoAction = {
          type: 'reference_change',
          referenceImagesState: this.captureReferenceImagesState()
      };
      this.restoreReferenceImagesState(action.referenceImagesState);
  } else {
      undoAction = {
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

      this._disposeAction(action);
  }

  this._pushHistory(undoAction);
  this._updateSelectionPreview();
  this.refresh();
  this._status('REDO');
  if (this.onDrawEnd) this.onDrawEnd();
}

// -------------------------------------------------------------
// NESTED SELECTION TRANSFORM STATE HELPERS
// -------------------------------------------------------------

export function captureFloatingSelectionState() {
  if (!this.floatingSelection) return null;
  const sel = this.floatingSelection;
  return {
    x: sel.x,
    y: sel.y,
    scale: sel.scale !== undefined ? sel.scale : 1,
    scaleX: sel.scaleX !== undefined ? sel.scaleX : (sel.scale ?? 1),
    scaleY: sel.scaleY !== undefined ? sel.scaleY : (sel.scale ?? 1),
    rotation: sel.rotation || 0,
    opacity: sel.opacity !== undefined ? sel.opacity : 1,
    mirrorX: !!sel.mirrorX,
    mirrorY: !!sel.mirrorY
  };
}

export function restoreFloatingSelectionState(state) {
  if (!this.floatingSelection || !state) return;
  const sel = this.floatingSelection;
  sel.x = state.x;
  sel.y = state.y;
  sel.scale = state.scale;
  sel.scaleX = state.scaleX;
  sel.scaleY = state.scaleY;
  sel.rotation = state.rotation;
  sel.opacity = state.opacity;
  sel.mirrorX = state.mirrorX;
  sel.mirrorY = state.mirrorY;
  this._updateSelectionPreview();
  this.refresh();
}

export function recordTransformAdjustment(actionFn) {
  if (!this.floatingSelection) {
      actionFn();
      return;
  }
  const before = this.captureFloatingSelectionState();
  actionFn();
  const after = this.captureFloatingSelectionState();
  if (JSON.stringify(before) !== JSON.stringify(after)) {
      if (!this.transformHistory) this.transformHistory = [];
      this.transformHistory.push({ before, after });
      this.transformRedoHistory = []; 
  }
}

export function toggleFloatingSelectionMirrorX() {
  if (!this.floatingSelection) return;
  this.recordTransformAdjustment(() => {
      this.floatingSelection.mirrorX = !this.floatingSelection.mirrorX;
  });
  this.refresh();
}

// -------------------------------------------------------------
// HISTORY STORAGE CACHE / INDEXDB SERIALIZATION
// -------------------------------------------------------------

function canvasToDataURLAsync(canvas, type = 'image/png', quality) {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(canvas.toDataURL(type, quality));
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result);
        };
        reader.onerror = () => {
          resolve(canvas.toDataURL(type, quality));
        };
        reader.readAsDataURL(blob);
      }, type, quality);
    } catch (e) {
      resolve(canvas.toDataURL(type, quality));
    }
  });
}

async function serializeHistoryState(historyArray) {
  if (!historyArray) return [];
  const serialized = [];
  for (const action of historyArray) {
    const act = {
      type: action.type,
      path: action.path ? JSON.parse(JSON.stringify(action.path)) : null,
      zoom: action.zoom,
      pan: action.pan ? { ...action.pan } : null,
    };

    if (action.referenceImagesState) {
      act.referenceImagesState = action.referenceImagesState.map(ref => ({
        id: ref.id,
        name: ref.name,
        img: { 
          src: ref.img ? (ref.img.src || ref.img) : '', 
          width: ref.img ? (ref.img.width || 100) : 100, 
          height: ref.img ? (ref.img.height || 100) : 100 
        },
        x: ref.x,
        y: ref.y,
        rotation: ref.rotation,
        scale: ref.scale,
        opacity: ref.opacity,
        mirrorX: ref.mirrorX,
        mirrorY: ref.mirrorY,
        extractedPalette: ref.extractedPalette ? [...ref.extractedPalette] : null
      }));
    }

    if (action.chunks) {
      const chunksArr = [];
      for (const [chunkId, data] of action.chunks.entries()) {
        const dataUrl = data.canvas ? await canvasToDataURLAsync(data.canvas, 'image/png') : null;
        chunksArr.push({
          chunkId,
          layer: data.layer,
          dataUrl,
          width: data.canvas ? data.canvas.width : 1024,
          height: data.canvas ? data.canvas.height : 1024
        });
      }
      act.chunks = chunksArr;
    }

    if (action.selection) {
      const canvasDataUrl = action.selection.canvas ? await canvasToDataURLAsync(action.selection.canvas, 'image/png') : null;
      act.selection = {
        x: action.selection.x,
        y: action.selection.y,
        width: action.selection.width,
        height: action.selection.height,
        scale: action.selection.scale,
        scaleX: action.selection.scaleX,
        scaleY: action.selection.scaleY,
        rotation: action.selection.rotation,
        opacity: action.selection.opacity,
        mirrorX: action.selection.mirrorX,
        mirrorY: action.selection.mirrorY,
        canvasDataUrl: canvasDataUrl
      };
    }

    serialized.push(act);
  }
  return serialized;
}

async function deserializeHistoryState(serializedArray) {
  if (!serializedArray) return [];
  const deserialized = [];
  for (const act of serializedArray) {
    const action = {
      type: act.type,
      path: act.path ? JSON.parse(JSON.stringify(act.path)) : null,
      zoom: act.zoom,
      pan: act.pan ? { ...act.pan } : null,
    };

    if (act.referenceImagesState) {
      action.referenceImagesState = [];
      for (const ref of act.referenceImagesState) {
        const img = new Image();
        img.src = ref.img.src;
        img.width = ref.img.width;
        img.height = ref.img.height;
        await new Promise(resolve => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          if (!ref.img.src) resolve();
        });
        action.referenceImagesState.push({
          id: ref.id,
          name: ref.name,
          img: img,
          x: ref.x,
          y: ref.y,
          rotation: ref.rotation,
          scale: ref.scale,
          opacity: ref.opacity,
          mirrorX: ref.mirrorX,
          mirrorY: ref.mirrorY,
          extractedPalette: ref.extractedPalette ? [...ref.extractedPalette] : null
        });
      }
    }

    if (act.chunks) {
      const chunksMap = new Map();
      for (const chunkItem of act.chunks) {
        const cv = document.createElement('canvas');
        cv.width = chunkItem.width;
        cv.height = chunkItem.height;
        const ctx = cv.getContext('2d');
        if (chunkItem.dataUrl) {
          const img = new Image();
          await new Promise(resolve => {
            img.onload = () => {
              ctx.drawImage(img, 0, 0);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = chunkItem.dataUrl;
          });
        }
        chunksMap.set(chunkItem.chunkId, {
          layer: chunkItem.layer,
          canvas: cv
        });
      }
      action.chunks = chunksMap;
    }

    if (act.selection) {
      const cv = document.createElement('canvas');
      cv.width = act.selection.width || 100;
      cv.height = act.selection.height || 100;
      const ctx = cv.getContext('2d');
      if (act.selection.canvasDataUrl) {
        const img = new Image();
        await new Promise(resolve => {
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = act.selection.canvasDataUrl;
        });
      }
      action.selection = {
        x: act.selection.x,
        y: act.selection.y,
        width: act.selection.width,
        height: act.selection.height,
        scale: act.selection.scale,
        scaleX: act.selection.scaleX !== undefined ? act.selection.scaleX : act.selection.scale,
        scaleY: act.selection.scaleY !== undefined ? act.selection.scaleY : act.selection.scale,
        rotation: act.selection.rotation,
        opacity: act.selection.opacity,
        mirrorX: act.selection.mirrorX,
        mirrorY: act.selection.mirrorY,
        canvas: cv
      };
    }

    deserialized.push(action);
  }
  return deserialized;
}

export async function saveHistoryStackToStorage() {
  if (!this.storage) return;

  try {
    const serializedHistory = await serializeHistoryState(this.history);
    const serializedRedo = await serializeHistoryState(this.redoStack);

    await this.storage.saveSetting('historyStack', serializedHistory);
    await this.storage.saveSetting('redoStack', serializedRedo);
  } catch (err) {
    console.warn('Failed to save history stacks to storage:', err);
  }
}

export async function loadHistoryStackFromStorage() {
  if (!this.storage) return;

  try {
    const serializedHistory = await this.storage.loadSetting('historyStack');
    const serializedRedo = await this.storage.loadSetting('redoStack');

    if (serializedHistory && Array.isArray(serializedHistory)) {
      this._clearStack(this.history);
      this.history = await deserializeHistoryState(serializedHistory);
    } else {
      this._clearStack(this.history);
      this.history = [];
    }

    if (serializedRedo && Array.isArray(serializedRedo)) {
      this._clearStack(this.redoStack);
      this.redoStack = await deserializeHistoryState(serializedRedo);
    } else {
      this._clearStack(this.redoStack);
      this.redoStack = [];
    }
  } catch (err) {
    console.warn('Failed to load history stacks from storage:', err);
  }
}
