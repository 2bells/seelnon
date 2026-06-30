'use strict';

export function Snapshot(texture, paintingWidth, paintingHeight, resolutionScale, paintingLeft, paintingBottom) {
    this.texture = texture;
    this.paintingWidth = paintingWidth;
    this.paintingHeight = paintingHeight;
    this.resolutionScale = resolutionScale;
    this.paintingLeft = paintingLeft;
    this.paintingBottom = paintingBottom;
}

Snapshot.prototype.getTextureWidth = function () {
    return Math.ceil(this.paintingWidth * this.resolutionScale);
};

Snapshot.prototype.getTextureHeight = function () {
    return Math.ceil(this.paintingHeight * this.resolutionScale);
};

export function saveSnapshot(paint, HISTORY_SIZE) {
    var wgl = paint.wgl;
    if (paint.snapshotIndex === HISTORY_SIZE) { //no more room in the snapshots
        //the last shall be first and the first shall be last...
        var front = paint.snapshots.shift();
        paint.snapshots.push(front);

        paint.snapshotIndex -= 1;
    }

    paint.undoing = false;

    var snapshot = paint.snapshots[paint.snapshotIndex]; //the snapshot to save into

    if (snapshot.getTextureWidth() !== paint.simulator.resolutionWidth || snapshot.getTextureHeight() !== paint.simulator.resolutionHeight) { //if we need to resize the snapshot's texture
        wgl.rebuildTexture(snapshot.texture, wgl.RGBA, wgl.FLOAT, paint.simulator.resolutionWidth, paint.simulator.resolutionHeight, null, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.LINEAR, wgl.LINEAR);
    }

    paint.simulator.copyPaintTexture(snapshot.texture);

    snapshot.paintingWidth = paint.paintingRectangle.width;
    snapshot.paintingHeight = paint.paintingRectangle.height;
    snapshot.paintingLeft = paint.paintingRectangle.left;
    snapshot.paintingBottom = paint.paintingRectangle.bottom;
    snapshot.logicalWidth = paint.logicalWidth;
    snapshot.logicalHeight = paint.logicalHeight;
    snapshot.zoomLevel = paint.zoomLevel;
    snapshot.resolutionScale = paint.resolutionScale;

    paint.snapshotIndex += 1;

    paint.refreshDoButtons();
}

export function applySnapshot(paint, snapshot, QUALITIES) {
    var snapLogicalWidth = snapshot.logicalWidth !== undefined ? snapshot.logicalWidth : snapshot.paintingWidth;
    var snapLogicalHeight = snapshot.logicalHeight !== undefined ? snapshot.logicalHeight : snapshot.paintingHeight;

    // Only restore canvas physical dimensions if the actual canvas size was resized/changed in the snapshot
    if (paint.logicalWidth !== snapLogicalWidth || paint.logicalHeight !== snapLogicalHeight) {
        paint.logicalWidth = snapLogicalWidth;
        paint.logicalHeight = snapLogicalHeight;

        paint.paintingRectangle.width = paint.logicalWidth * paint.zoomLevel;
        paint.paintingRectangle.height = paint.logicalHeight * paint.zoomLevel;
    }

    if (paint.resolutionScale !== snapshot.resolutionScale) {
        for (var i = 0; i < QUALITIES.length; ++i) {
            if (QUALITIES[i].resolutionScale === snapshot.resolutionScale) {
                paint.qualityButtons.setIndex(i);
            }
        }

        paint.resolutionScale = snapshot.resolutionScale;
    }

    if (paint.simulator.width !== paint.getPaintingResolutionWidth() || paint.simulator.height !== paint.getPaintingResolutionHeight()) {
        paint.simulator.changeResolution(paint.getPaintingResolutionWidth(), paint.getPaintingResolutionHeight());
    }

    paint.simulator.applyPaintTexture(snapshot.texture);
    paint.updateZoomUI();
}

export function canUndo(paint) {
    return paint.snapshotIndex >= 1;
}

export function canRedo(paint) {
    return paint.undoing && paint.snapshotIndex <= paint.maxRedoIndex - 1;
}

export function undo(paint, HISTORY_SIZE, QUALITIES) {
    if (paint.currentTool === 'select' && paint.selectionTool && paint.selectionTool.isTransformMode) {
        paint.selectionTool.cancelTransform();
    }

    if (!paint.undoing) {
        paint.saveSnapshot();

        paint.undoing = true;

        paint.snapshotIndex -= 1;

        paint.maxRedoIndex = paint.snapshotIndex;
    }

    if (paint.canUndo()) {
        paint.applySnapshot(paint.snapshots[paint.snapshotIndex - 1]);

        paint.snapshotIndex -= 1;
    }

    paint.refreshDoButtons();

    paint.needsRedraw = true;
    paint.scheduleDebouncedSave(3000);
}

export function redo(paint, QUALITIES) {
    if (paint.canRedo()) {
        paint.applySnapshot(paint.snapshots[paint.snapshotIndex + 1]);

        paint.snapshotIndex += 1;
    }

    paint.refreshDoButtons();

    paint.needsRedraw = true;
    paint.scheduleDebouncedSave(3000);
}

export function refreshDoButtons(paint) {
    if (paint.canUndo()) {
        paint.undoButton.className = 'bar-btn do-button-active';
    } else {
        paint.undoButton.className = 'bar-btn do-button-inactive';
    }

    if (paint.canRedo()) {
        paint.redoButton.className = 'bar-btn do-button-active';
    } else {
        paint.redoButton.className = 'bar-btn do-button-inactive';
    }
}
