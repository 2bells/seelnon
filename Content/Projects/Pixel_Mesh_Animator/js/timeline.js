import { EasingFunctions } from './easing.js';

export default class Timeline {
  constructor(frameCount, puppetTool, app) {
    this.frameCount = frameCount;
    this.currentFrame = 1;
    this.puppetTool = puppetTool;
    this.app = app;
    this.keyframes = {}; 
    this.pinKeyframes = {}; 
    this.easingTypes = {}; 
    this.isPlaying = false;
    this.playbackInterval = null;
    this.draggedKeyframe = null;
    this.isExpanded = false; 
    this.timelineElement = null; 
    this.mainFramesContainer = null;
    this.pinTracksContainerElement = null;
    this.draggedPinKeyframeInfo = null; // To store { pinIndex, sourceFrame, data: { state, easing } }
    this.activeEditingTrack = null; // null for master, pinIndex for pin track

    // this.keyImages is managed by app.js, timeline accesses it via this.app.keyImages
  }

  _updateTimelineButtonsUI() {
    const addKeyframeButton = document.getElementById('addKeyframe');
    const updatePinKeyframeButton = document.getElementById('updatePinKeyframe');

    if (addKeyframeButton) {
        if (this.activeEditingTrack === null) { // Master track active
            if (this.keyframes[this.currentFrame]) {
                addKeyframeButton.textContent = 'Update Master KF';
                addKeyframeButton.title = `Update master keyframe at frame ${this.currentFrame}`;
            } else {
                addKeyframeButton.textContent = 'Add Master KF';
                addKeyframeButton.title = `Add master keyframe at frame ${this.currentFrame}`;
            }
        } else { // Pin track active
            const pinIndex = this.activeEditingTrack;
            if (this.pinKeyframes[this.currentFrame]?.[pinIndex]) {
                addKeyframeButton.textContent = 'Update Pin KF';
                addKeyframeButton.title = `Update keyframe for Pin ${pinIndex} at frame ${this.currentFrame}`;
            } else {
                addKeyframeButton.textContent = 'Add Pin KF';
                addKeyframeButton.title = `Add keyframe for Pin ${pinIndex} at frame ${this.currentFrame}`;
            }
        }
    }

    if (updatePinKeyframeButton) {
        const canUpdatePinKF = this.activeEditingTrack !== null && 
                               this.pinKeyframes[this.currentFrame]?.[this.activeEditingTrack];
        updatePinKeyframeButton.disabled = !canUpdatePinKF;
        if (canUpdatePinKF) {
            updatePinKeyframeButton.title = `Update keyframe for Pin ${this.activeEditingTrack} at frame ${this.currentFrame}`;
        } else {
            updatePinKeyframeButton.title = 'Select a pin track and a frame with an existing pin keyframe to update it.';
        }
    }
  }

  setTotalFrames(newCount) {
    const maxFrames = 128; // Define a reasonable maximum
    const minFrames = 1;
    newCount = Math.max(minFrames, Math.min(newCount, maxFrames));

    if (newCount === this.frameCount) return; // No change

    const oldFrameCount = this.frameCount;

    // Prune keyframes beyond the new count
    Object.keys(this.keyframes).forEach(frameNumStr => {
        const frameNum = parseInt(frameNumStr);
        if (frameNum > newCount) {
            delete this.keyframes[frameNum];
            delete this.easingTypes[frameNum]; // Master easing types
        }
    });
    Object.keys(this.pinKeyframes).forEach(frameNumStr => {
        const frameNum = parseInt(frameNumStr);
        if (frameNum > newCount) {
            delete this.pinKeyframes[frameNum];
        }
    });


    this.frameCount = newCount;
    const totalFramesDisplay = document.getElementById('totalFrames');
    if (totalFramesDisplay) totalFramesDisplay.textContent = this.frameCount;
    
    const totalFramesInput = document.getElementById('totalFramesInput');
    if (totalFramesInput) totalFramesInput.value = this.frameCount;


    if (this.currentFrame > this.frameCount) {
        this.goToFrame(this.frameCount);
    }

    // If timeline was already initialized, re-render it.
    // Check if mainFramesContainer exists as a proxy for initDOM having run.
    if (this.mainFramesContainer) {
        if (newCount > oldFrameCount) { // Add new frame elements
            for (let i = oldFrameCount + 1; i <= newCount; i++) {
                const frame = document.createElement('div');
                frame.className = 'frame';
                frame.dataset.frame = i;
                const frameNumberSpan = document.createElement('span');
                frameNumberSpan.textContent = i;
                frame.appendChild(frameNumberSpan);
                frame.addEventListener('click', () => this.goToFrame(i));
                frame.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    const frameNumber = parseInt(frame.dataset.frame);
                    if (this.keyframes[frameNumber]) {
                        if (confirm(`Delete master keyframe at frame ${frameNumber}?`)) {
                            this.deleteKeyframe(frameNumber);
                        }
                    } else {
                         if (confirm(`Add master keyframe at frame ${frameNumber}?`)) {
                            this.addKeyframeAt(frameNumber);
                        }
                    }
                  });
                frame.setAttribute('draggable', 'true');
                frame.addEventListener('dragstart', (e) => {
                    if (!this.keyframes[i]) { e.preventDefault(); return; }
                    this.startDragKeyframe(i);
                    frame.classList.add('dragging');
                    e.dataTransfer.setData('text/plain', i.toString());
                    e.dataTransfer.effectAllowed = 'move';
                });
                frame.addEventListener('dragend', () => { frame.classList.remove('dragging'); this.cancelDrag(); });
                frame.addEventListener('dragover', (e) => { e.preventDefault(); frame.classList.add('drag-over'); });
                frame.addEventListener('dragleave', () => frame.classList.remove('drag-over'));
                frame.addEventListener('drop', (e) => {
                    e.preventDefault();
                    frame.classList.remove('drag-over');
                    const sourceFrame = parseInt(e.dataTransfer.getData('text/plain'));
                    const targetFrame = i;
                    if (this.dropKeyframe(targetFrame)) { /* console.log(...) */ }
                });
                this.mainFramesContainer.appendChild(frame);
            }
        } else { // Remove frame elements
             const masterFrames = this.mainFramesContainer.querySelectorAll('.frame');
             masterFrames.forEach(frameElement => {
                if (parseInt(frameElement.dataset.frame) > newCount) {
                    frameElement.remove();
                }
             });
        }
    } else if (this.timelineElement) {
         this.initDOM(this.timelineElement); // Full re-init if not partially updatable
    }
    
    if (this.app) {
        this.app.updateExportFrameOptions(); 
        this.app.renderKeyImagesList(); 
    }
    this.updateTimelineUI(); 
    this._updateTimelineButtonsUI(); 
  }

  initDOM(containerElement) {
    this.timelineElement = containerElement;
    this.timelineElement.innerHTML = ''; 

    this.mainFramesContainer = document.createElement('div');
    this.mainFramesContainer.className = 'timeline-main-frames';
    this.timelineElement.appendChild(this.mainFramesContainer);

    const masterTrackLabel = document.createElement('div');
    masterTrackLabel.className = 'timeline-track-label master-track-label';
    masterTrackLabel.textContent = 'All';
    masterTrackLabel.addEventListener('click', () => {
        this.setActiveEditingTrack(null); // null for master track
    });
    this.mainFramesContainer.appendChild(masterTrackLabel);

    for (let i = 1; i <= this.frameCount; i++) {
      const frame = document.createElement('div');
      frame.className = 'frame';
      frame.dataset.frame = i;
      
      const frameNumberSpan = document.createElement('span');
      frameNumberSpan.textContent = i;
      frame.appendChild(frameNumberSpan);
      
      frame.addEventListener('click', () => {
        this.goToFrame(i);
      });

      frame.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const frameNumber = parseInt(frame.dataset.frame);
        if (this.keyframes[frameNumber]) {
            if (confirm(`Delete master keyframe at frame ${frameNumber}?`)) {
                this.deleteKeyframe(frameNumber);
            }
        } else {
             if (confirm(`Add master keyframe at frame ${frameNumber}?`)) {
                this.addKeyframeAt(frameNumber);
            }
        }
      });

      frame.setAttribute('draggable', 'true');
      frame.addEventListener('dragstart', (e) => {
        if (!this.keyframes[i]) { e.preventDefault(); return; }
        this.startDragKeyframe(i);
        frame.classList.add('dragging');
        e.dataTransfer.setData('text/plain', i.toString());
        e.dataTransfer.effectAllowed = 'move';
      });
      frame.addEventListener('dragend', () => {
        frame.classList.remove('dragging');
        this.cancelDrag();
      });
      frame.addEventListener('dragover', (e) => { e.preventDefault(); frame.classList.add('drag-over'); });
      frame.addEventListener('dragleave', () => frame.classList.remove('drag-over'));
      frame.addEventListener('drop', (e) => {
        e.preventDefault();
        frame.classList.remove('drag-over');
        const sourceFrame = parseInt(e.dataTransfer.getData('text/plain'));
        const targetFrame = i;
        if (this.dropKeyframe(targetFrame)) {
          // console.log(`Moved keyframe from ${sourceFrame} to ${targetFrame}`);
        }
      });
      this.mainFramesContainer.appendChild(frame);
    }

    this.pinTracksContainerElement = document.createElement('div');
    this.pinTracksContainerElement.className = 'timeline-pin-tracks-container';
    this.timelineElement.appendChild(this.pinTracksContainerElement);

    this.updateTimelineUI();
    this._updateTimelineButtonsUI(); // Initial setup of the button text
  }
  
  addKeyframe() { 
    if (this.activeEditingTrack === null) { // Master track
        this.addKeyframeAt(this.currentFrame); // Adds or updates master
    } else { // Pin track
        const pinIndex = this.activeEditingTrack;
        const currentPinObject = (this.puppetTool.pins && this.puppetTool.pins[pinIndex]) 
            ? this.puppetTool.pins[pinIndex] 
            : null;

        if (!currentPinObject) {
            this.app.setStatus(`Cannot add/update Pin ${pinIndex} keyframe: Pin data not found.`);
            console.warn(`Pin ${pinIndex} not found in puppetTool.pins when trying to add/update keyframe.`);
            return;
        }
        const pinStateForKf = { 
            x: currentPinObject.x, 
            y: currentPinObject.y, 
            originalX: currentPinObject.originalX, 
            originalY: currentPinObject.originalY 
        };
        
        // addPinKeyframe internally handles add vs update and history.
        // It uses current puppet pin state (passed as pinStateForKf) and current easing dropdown.
        this.addPinKeyframe(pinIndex, this.currentFrame, pinStateForKf, document.getElementById('easingType').value || 'linear', false);
    }
  }

  addKeyframeAt(frameNumber, keyframeData = null, easing = null, isInternal = false) { 
    const actualKeyframeData = keyframeData ? JSON.parse(JSON.stringify(keyframeData)) : this.puppetTool.getPinStates(); 
    const actualEasing = easing || document.getElementById('easingType').value || 'linear';

    if (!isInternal) {
        const existingKeyframeData = this.keyframes[frameNumber] ? JSON.parse(JSON.stringify(this.keyframes[frameNumber])) : null;
        const existingEasingType = this.keyframes[frameNumber] ? (this.easingTypes[frameNumber] || null) : null; // Get easing only if keyframe exists

        if (existingKeyframeData) { // Keyframe already exists, this is an update
            if (JSON.stringify(existingKeyframeData) === JSON.stringify(actualKeyframeData) && existingEasingType === actualEasing) {
                // console.log("Skipping redundant keyframe update to history.");
            } else {
                this.app.addHistoryAction({
                    module: 'timeline',
                    actionType: 'updateKeyframe', 
                    undoData: {
                        frameNumber,
                        previousKeyframeData: existingKeyframeData, 
                        previousEasingType: existingEasingType 
                    },
                    redoData: {
                        frameNumber,
                        keyframeData: JSON.parse(JSON.stringify(actualKeyframeData)), 
                        easingType: actualEasing
                    },
                    description: `Update Keyframe at ${frameNumber}`
                });
            }
        } else { // Keyframe does not exist, this is an add
            this.app.addHistoryAction({
                module: 'timeline',
                actionType: 'addKeyframe',
                undoData: { frameNumber }, // Corrected: Undo for add is to know which frame to delete.
                redoData: { frameNumber, keyframeData: JSON.parse(JSON.stringify(actualKeyframeData)), easingType: actualEasing },
                description: `Add Keyframe at ${frameNumber}`
            });
        }
    }
    
    this.keyframes[frameNumber] = actualKeyframeData; 
    this.easingTypes[frameNumber] = actualEasing;
    this.updateTimelineUI();
    if (frameNumber === this.currentFrame) {
        this.updatePuppetToolState();
        this.updateEasingDropdownForCurrentSelection(); 
        this._updateTimelineButtonsUI(); // Update button state/text
    }
  }
  
  deleteKeyframe(frameNumber, isInternal = false) { 
    if (this.activeEditingTrack === null) { // Master track
        if (this.keyframes[frameNumber]) {
            if (!isInternal) {
                const deletedKeyframeData = JSON.parse(JSON.stringify(this.keyframes[frameNumber]));
                const deletedEasingType = this.easingTypes[frameNumber];
                this.app.addHistoryAction({
                    module: 'timeline',
                    actionType: 'deleteKeyframe',
                    undoData: { frameNumber, keyframeData: deletedKeyframeData, easingType: deletedEasingType },
                    redoData: { frameNumber },
                    description: `Delete Master Keyframe at ${frameNumber}`
                });
            }
            delete this.keyframes[frameNumber];
            delete this.easingTypes[frameNumber];
            this.app.setStatus(`Master keyframe at frame ${frameNumber} deleted.`);
        } else {
            this.app.setStatus(`No master keyframe at frame ${frameNumber} to delete.`);
            return false;
        }
    } else { // Pin track
        const pinIndex = this.activeEditingTrack;
        if (this.pinKeyframes[frameNumber]?.[pinIndex]) {
            // deletePinKeyframe handles its own history and status message
            this.deletePinKeyframe(pinIndex, frameNumber, isInternal);
        } else {
            this.app.setStatus(`No keyframe for Pin ${pinIndex} at frame ${frameNumber} to delete.`);
            return false;
        }
    }

    this.updateTimelineUI();
    this.updatePuppetToolState();
    if (frameNumber === this.currentFrame) {
        this.updateEasingDropdownForCurrentSelection();
        this._updateTimelineButtonsUI(); // Update button state/text
    }
    return true;
  }

  addPinKeyframe(pinIndex, frameNumber, pinState = null, easing = null, isInternal = false) {
    const currentPinInPuppet = (this.puppetTool.pins && this.puppetTool.pins[pinIndex]) 
        ? this.puppetTool.pins[pinIndex]
        : null;

    // If pinState is explicitly provided, use it. Otherwise, use currentPinInPuppet.
    // Ensure originalX/Y are preserved if pinState only has x/y.
    let actualPinState;
    if (pinState) {
        actualPinState = { ...pinState };
        // If the provided pinState doesn't have originalX/Y, try to get them from currentPinInPuppet
        if (currentPinInPuppet && actualPinState.originalX === undefined) {
            actualPinState.originalX = currentPinInPuppet.originalX;
        }
        if (currentPinInPuppet && actualPinState.originalY === undefined) {
            actualPinState.originalY = currentPinInPuppet.originalY;
        }
    } else if (currentPinInPuppet) {
        actualPinState = { ...currentPinInPuppet }; // This includes originalX/Y
    } else {
        // This case should ideally be prevented by callers if the pin doesn't exist.
        console.warn(`Cannot add pin keyframe for pin ${pinIndex} at frame ${frameNumber}: no state provided and pin doesn't exist in puppet tool.`);
        this.app.setStatus(`Error: Pin ${pinIndex} data not found.`);
        return;
    }
    
    // Ensure originalX/Y are numbers, default to 0 if somehow undefined.
    actualPinState.originalX = typeof actualPinState.originalX === 'number' ? actualPinState.originalX : 0;
    actualPinState.originalY = typeof actualPinState.originalY === 'number' ? actualPinState.originalY : 0;


    const actualEasing = easing || document.getElementById('easingType').value || 'linear';
    const actionDescriptionBase = `Pin ${pinIndex} Keyframe at ${frameNumber}`;

    if (!isInternal) {
        const existingPinKf = this.pinKeyframes[frameNumber]?.[pinIndex];
        if (existingPinKf &&
            JSON.stringify(existingPinKf.state) === JSON.stringify(actualPinState) &&
            existingPinKf.easing === actualEasing) {
            // console.log("Skipping redundant pin keyframe add/update.");
            this.app.setStatus(`No changes to ${actionDescriptionBase}.`);
        } else {
            this.app.addHistoryAction({
                module: 'timeline',
                actionType: 'addPinKeyframe',
                undoData: { frameNumber, pinIndex,
                            previousData: existingPinKf ? { state: { ...existingPinKf.state }, easing: existingPinKf.easing } : null },
                redoData: { frameNumber, pinIndex, data: { state: { ...actualPinState }, easing: actualEasing } },
                description: existingPinKf ? `Update ${actionDescriptionBase}` : `Add ${actionDescriptionBase}`
            });
            this.app.setStatus(existingPinKf ? `Updated ${actionDescriptionBase}.` : `Added ${actionDescriptionBase}.`);
        }
    }

    if (!this.pinKeyframes[frameNumber]) {
      this.pinKeyframes[frameNumber] = {};
    }
    this.pinKeyframes[frameNumber][pinIndex] = { state: actualPinState, easing: actualEasing };
    this.updateTimelineUI();
    if (frameNumber === this.currentFrame) {
        this.updatePuppetToolState();
        this.updateEasingDropdownForCurrentSelection(); 
        this._updateTimelineButtonsUI(); 
    }
  }

  deletePinKeyframe(pinIndex, frameNumber, isInternal = false) {
    if (this.pinKeyframes[frameNumber] && this.pinKeyframes[frameNumber][pinIndex]) {
      const actionDescriptionBase = `Pin ${pinIndex} Keyframe at ${frameNumber}`;
      if (!isInternal) {
        const deletedPinData = { ...this.pinKeyframes[frameNumber][pinIndex] }; // {state, easing}
        this.app.addHistoryAction({
            module: 'timeline',
            actionType: 'deletePinKeyframe',
            undoData: { frameNumber, pinIndex, data: deletedPinData },
            redoData: { frameNumber, pinIndex },
            description: `Delete ${actionDescriptionBase}`
        });
        this.app.setStatus(`Deleted ${actionDescriptionBase}.`);
      }

      delete this.pinKeyframes[frameNumber][pinIndex];
      if (Object.keys(this.pinKeyframes[frameNumber]).length === 0) {
        delete this.pinKeyframes[frameNumber];
      }
      this.updateTimelineUI();
      if (frameNumber === this.currentFrame) {
          this.updatePuppetToolState();
          this.updateEasingDropdownForCurrentSelection(); 
          this._updateTimelineButtonsUI(); 
      }
      return true;
    }
    this.app.setStatus(`No keyframe for Pin ${pinIndex} at frame ${frameNumber} to delete.`);
    return false;
  }

  togglePinKeyframe(pinIndex, frameNumber) { 
    if (this.pinKeyframes[frameNumber] && this.pinKeyframes[frameNumber][pinIndex]) {
      this.deletePinKeyframe(pinIndex, frameNumber, false); 
    } else {
      if (this.puppetTool.pins && pinIndex < this.puppetTool.pins.length) {
        // Use current main easing dropdown value when toggling to add
        const currentEasing = document.getElementById('easingType').value || 'linear';
        this.addPinKeyframe(pinIndex, frameNumber, null, currentEasing, false); 
      } else {
        console.warn(`Cannot add pin keyframe: Pin ${pinIndex} does not exist.`);
      }
    }
  }

  toggleExpand() {
    this.isExpanded = !this.isExpanded;
    this.updateTimelineUI();
  }
  
  moveKeyframe(fromFrame, toFrame, isInternal = false, providedKeyframeData = null, providedEasingType = null) {
    const sourceMasterKf = this.keyframes[fromFrame];
    const sourceEasing = this.easingTypes[fromFrame];

    // Determine the actual data to move. If provided (undo/redo), use that. Otherwise, use current state.
    const kfDataToMove = providedKeyframeData 
        ? providedKeyframeData.map(p => ({ ...p })) 
        : (sourceMasterKf ? sourceMasterKf.map(p => ({ ...p })) : null);
    
    const easingToMove = providedEasingType !== null ? providedEasingType : sourceEasing;
    
    if (!kfDataToMove) { 
        if (!isInternal) console.warn(`No master keyframe at source ${fromFrame} to move.`);
        return false;
    }
    if (!isInternal && this.keyframes[toFrame]) { 
      console.warn(`Cannot move master keyframe to ${toFrame}, it already has a keyframe.`);
      return false; 
    }
    
    if (!isInternal) {
        this.app.addHistoryAction({
            module: 'timeline',
            actionType: 'moveKeyframe', // Master keyframe move
            undoData: { 
                sourceMoveFrame: toFrame,       
                targetMoveFrame: fromFrame,     
                keyframeData: kfDataToMove.map(p => ({ ...p })), 
                easingType: easingToMove,
            },
            redoData: { 
                sourceMoveFrame: fromFrame,     
                targetMoveFrame: toFrame,       
                keyframeData: kfDataToMove.map(p => ({ ...p })), 
                easingType: easingToMove,
            },
            description: `Move Master Keyframe from ${fromFrame} to ${toFrame}`
        });
    }
    
    // Clear the source frame for master data
    delete this.keyframes[fromFrame];
    delete this.easingTypes[fromFrame];
    // Explicit pin keyframes at fromFrame are NOT touched or moved with the master keyframe.

    // Set the destination frame for master data
    this.keyframes[toFrame] = kfDataToMove; 
    this.easingTypes[toFrame] = easingToMove;
    // Explicit pin keyframes at toFrame are NOT touched by this master keyframe move.
    
    this.updateTimelineUI();
    this.updatePuppetToolState(); 
    if (toFrame === this.currentFrame || fromFrame === this.currentFrame) {
        this.updateEasingDropdownForCurrentSelection();
    }
    return true;
  }

  movePinKeyframe(pinIndex, fromFrame, toFrame, isInternal = false, movedPinKeyframeDataOverride = null) { // data is {state, easing}
    const dataBeingMoved = movedPinKeyframeDataOverride 
        ? { state: { ...movedPinKeyframeDataOverride.state }, easing: movedPinKeyframeDataOverride.easing }
        : (this.pinKeyframes[fromFrame]?.[pinIndex] ? { ...this.pinKeyframes[fromFrame][pinIndex] } : null);

    if (!dataBeingMoved) {
        if (!isInternal) console.warn(`No pin keyframe for Pin ${pinIndex} at Frame ${fromFrame} to move.`);
        return false;
    }

    const dataAtTargetBeforeMove = this.pinKeyframes[toFrame]?.[pinIndex] 
        ? { ...this.pinKeyframes[toFrame][pinIndex] } 
        : null;

    if (!isInternal) {
        this.app.addHistoryAction({
            module: 'timeline',
            actionType: 'movePinKeyframe',
            undoData: { 
                pinIndex: pinIndex,
                currentFrameOfMovedKeyframe: toFrame,
                originalFrameOfMovedKeyframe: fromFrame,
                movedData: { ...dataBeingMoved }, // data = {state, easing}
                dataThatWasAtTarget: dataAtTargetBeforeMove ? { ...dataAtTargetBeforeMove } : null
            },
            redoData: { 
                pinIndex: pinIndex,
                originalFrameOfMovedKeyframe: fromFrame,
                targetFrameForKeyframe: toFrame,
                movedData: { ...dataBeingMoved },
                dataThatWillBeOverwritten: dataAtTargetBeforeMove ? { ...dataAtTargetBeforeMove } : null
            },
            description: `Move Pin ${pinIndex} Keyframe from ${fromFrame} to ${toFrame}`
        });
    }

    // Delete from source
    if (this.pinKeyframes[fromFrame] && this.pinKeyframes[fromFrame][pinIndex]) {
        delete this.pinKeyframes[fromFrame][pinIndex];
        if (Object.keys(this.pinKeyframes[fromFrame]).length === 0) {
            delete this.pinKeyframes[fromFrame];
        }
    }

    // Set at target
    if (!this.pinKeyframes[toFrame]) {
        this.pinKeyframes[toFrame] = {};
    }
    this.pinKeyframes[toFrame][pinIndex] = { ...dataBeingMoved };

    this.updateTimelineUI();
    this.updatePuppetToolState();
    if (toFrame === this.currentFrame || fromFrame === this.currentFrame) {
        this.updateEasingDropdownForCurrentSelection();
    }
    return true;
  }
  
  setEasingType(frameNumber, easingType, isInternal = false) {
    if (this.activeEditingTrack !== null) { // Editing a pin track
        const pinIndex = this.activeEditingTrack;
        if (this.pinKeyframes[frameNumber] && this.pinKeyframes[frameNumber][pinIndex]) {
            const oldEasing = this.pinKeyframes[frameNumber][pinIndex].easing;
            if (oldEasing === easingType) return;

            if (!isInternal) {
                this.app.addHistoryAction({
                    module: 'timeline',
                    actionType: 'setPinKeyframeEasing',
                    undoData: { frameNumber, pinIndex, easingType: oldEasing },
                    redoData: { frameNumber, pinIndex, easingType: easingType },
                    description: `Set Easing for Pin ${pinIndex} at Frame ${frameNumber} to ${easingType}`
                });
            }
            this.pinKeyframes[frameNumber][pinIndex].easing = easingType;
            this.updateTimelineUI();
            this.updatePuppetToolState(); // Interpolation might change
        } else {
            if (!isInternal) console.warn(`No pin keyframe for Pin ${pinIndex} at Frame ${frameNumber} to set easing.`);
        }
    } else { // Editing master track
        if (this.keyframes[frameNumber]) { 
            if (!isInternal) {
                const oldEasingType = this.easingTypes[frameNumber];
                if (oldEasingType === easingType) return; 
                this.app.addHistoryAction({
                    module: 'timeline',
                    actionType: 'setMasterKeyframeEasing', // Changed actionType for clarity
                    undoData: { frameNumber, easingType: oldEasingType },
                    redoData: { frameNumber, easingType: easingType },
                    description: `Set Master Easing to ${easingType} for Frame ${frameNumber}`
                });
            }
            this.easingTypes[frameNumber] = easingType;
            this.updateTimelineUI(); 
            this.updatePuppetToolState(); 
        } else {
             if (!isInternal) console.warn(`No master keyframe at Frame ${frameNumber} to set easing.`);
        }
    }
  }

  setActiveEditingTrack(trackId) { // trackId is null for master, or pinIndex
    if (this.activeEditingTrack === trackId) { // Clicked same track again
        this.activeEditingTrack = null; // Default to master
    } else {
        this.activeEditingTrack = trackId;
    }
    this.updateTimelineUI(); // To update highlighting of track labels and buttons
    this.updateEasingDropdownForCurrentSelection(); // Update dropdown based on new selection
    this._updateTimelineButtonsUI(); // Ensure buttons reflect new active track
  }

  updateEasingDropdownForCurrentSelection() {
    const easingSelect = document.getElementById('easingType');
    let foundEasing = 'linear'; // Default

    if (this.activeEditingTrack !== null) { // A pin track is selected
        const pinKf = this.pinKeyframes[this.currentFrame]?.[this.activeEditingTrack];
        if (pinKf) {
            foundEasing = pinKf.easing;
        } else {
            // If no pin keyframe at current frame for selected pin, what should dropdown show?
            // Option 1: Show 'linear' or disable. Option 2: Show easing of previous pin kf for this track.
            // For now, 'linear' if no direct keyframe.
            // To make it more intuitive, it should reflect the easing that *would apply* if a keyframe *were* here.
            // This means finding the previous pin keyframe on this track.
            const pinKeyframeTimes = Object.keys(this.pinKeyframes)
                .filter(f => this.pinKeyframes[f]?.[this.activeEditingTrack])
                .map(Number).sort((a, b) => a - b);
            const prevPinKfTime = this.findPreviousKeyframeTime(this.currentFrame, pinKeyframeTimes);
            if (prevPinKfTime > 0 && this.pinKeyframes[prevPinKfTime]?.[this.activeEditingTrack]) {
                foundEasing = this.pinKeyframes[prevPinKfTime][this.activeEditingTrack].easing;
            }
        }
    } else { // Master track is selected
        const masterKfTime = this.findPreviousKeyframeTime(this.currentFrame, Object.keys(this.keyframes).map(Number));
        if (this.keyframes[masterKfTime]) {
            foundEasing = this.easingTypes[masterKfTime] || 'linear';
        }
    }
    easingSelect.value = foundEasing;
  }
  
  prevFrame() {
    if (this.currentFrame > 1) {
      this.goToFrame(this.currentFrame - 1);
    }
  }
  
  nextFrame() {
    if (this.currentFrame < this.frameCount) {
      this.goToFrame(this.currentFrame + 1);
    }
  }
  
  goToFrame(frameNumber) {
    if (frameNumber < 1 || frameNumber > this.frameCount) return;
    
    this.currentFrame = frameNumber;
    document.getElementById('currentFrame').textContent = frameNumber;
    const totalFramesDisplay = document.getElementById('totalFrames');
    if (totalFramesDisplay) totalFramesDisplay.textContent = this.frameCount;
    const totalFramesInput = document.getElementById('totalFramesInput');
    if (totalFramesInput) totalFramesInput.value = this.frameCount;
    
    this.updateEasingDropdownForCurrentSelection();
    
    this.updateTimelineUI(); // This will call _updateTimelineButtonsUI
    this.updatePuppetToolState();
  }
  
  updateTimelineUI() {
    if (!this.timelineElement || !this.mainFramesContainer) return; 

    // Update master track label active state
    const masterTrackLabel = this.mainFramesContainer.querySelector('.master-track-label');
    if (masterTrackLabel) {
        if (this.activeEditingTrack === null) {
            masterTrackLabel.classList.add('active-editing');
        } else {
            masterTrackLabel.classList.remove('active-editing');
        }
    }

    const masterFrames = this.mainFramesContainer.querySelectorAll('.frame');
    masterFrames.forEach(frameElement => {
        const frameNumber = parseInt(frameElement.dataset.frame);
        if (frameNumber > this.frameCount) { // Remove frames that are no longer valid
             frameElement.remove();
             return;
        }

        frameElement.classList.remove('current', 'keyframe');
        if (frameNumber === this.currentFrame) {
            frameElement.classList.add('current');
        }
        if (this.keyframes[frameNumber]) {
            frameElement.classList.add('keyframe');
            
            let easingIndicator = frameElement.querySelector('.easing-indicator');
            if (!easingIndicator) {
                easingIndicator = document.createElement('div');
                easingIndicator.className = 'easing-indicator';
                const span = frameElement.querySelector('span'); 
                if (span) span.insertAdjacentElement('afterend', easingIndicator);
                else frameElement.appendChild(easingIndicator); 
            }
            easingIndicator.className = `easing-indicator easing-${this.easingTypes[frameNumber] || 'linear'}`;
            easingIndicator.title = `Easing: ${this.easingTypes[frameNumber] || 'linear'}`;
        } else {
            const easingIndicator = frameElement.querySelector('.easing-indicator');
            if (easingIndicator) easingIndicator.remove();
        }
    });
    
    if (this.isExpanded) {
      this.pinTracksContainerElement.style.display = 'flex'; 
      this.pinTracksContainerElement.innerHTML = ''; 

      const numPins = this.puppetTool.pins ? this.puppetTool.pins.length : 0;
      for (let pinIdx = 0; pinIdx < numPins; pinIdx++) {
        const pinTrackDiv = document.createElement('div');
        pinTrackDiv.className = 'pin-track';
        pinTrackDiv.dataset.pinIndex = pinIdx;

        const label = document.createElement('div');
        label.className = 'timeline-track-label pin-track-label'; 
        label.textContent = `Pin ${pinIdx}`;
        label.addEventListener('click', () => {
            this.setActiveEditingTrack(pinIdx);
        });
        if (this.activeEditingTrack === pinIdx) {
            label.classList.add('active-editing');
        } else {
            label.classList.remove('active-editing');
        }
        pinTrackDiv.appendChild(label);

        const cellsContainer = document.createElement('div');
        cellsContainer.className = 'pin-track-cells';
        pinTrackDiv.appendChild(cellsContainer);

        for (let frameNum = 1; frameNum <= this.frameCount; frameNum++) {
          const cell = document.createElement('div');
          cell.className = 'pin-frame-cell';
          cell.dataset.frame = frameNum;
          cell.dataset.pinIndex = pinIdx; // Keep track of which pin this cell belongs to

          // Clear previous easing indicator if any
          const existingIndicator = cell.querySelector('.easing-indicator');
          if (existingIndicator) existingIndicator.remove();

          const pinKfData = this.pinKeyframes[frameNum]?.[pinIdx];
          if (pinKfData) {
            cell.classList.add('pin-keyframe');
            cell.draggable = true; // Draggable if it's a keyframe

            // Add easing indicator for pin keyframe
            const easingIndicator = document.createElement('div');
            const easing = pinKfData.easing || 'linear';
            easingIndicator.className = `easing-indicator easing-${easing}`;
            easingIndicator.title = `Easing: ${easing}`;
            cell.appendChild(easingIndicator);

            cell.addEventListener('dragstart', (e) => {
              const currentPinKfData = this.pinKeyframes[frameNum]?.[pinIdx]; // Re-fetch at drag start
              if (!currentPinKfData) return; 
              this.draggedPinKeyframeInfo = { 
                pinIndex: pinIdx, 
                sourceFrame: frameNum, 
                data: { ...currentPinKfData } // data = {state, easing}
              };
              e.dataTransfer.setData('application/x-pixelpuppet-pinkeyframe', JSON.stringify(this.draggedPinKeyframeInfo));
              e.dataTransfer.effectAllowed = 'move';
              cell.classList.add('dragging');
            });

            cell.addEventListener('dragend', () => {
              cell.classList.remove('dragging');
              this.draggedPinKeyframeInfo = null;
            });
          } else {
            cell.classList.remove('pin-keyframe');
            cell.draggable = false; // Not draggable if not a keyframe
          }

          if (frameNum === this.currentFrame) {
            cell.classList.add('current');
          }

          cell.addEventListener('click', () => {
            this.goToFrame(frameNum); 
            this.togglePinKeyframe(pinIdx, frameNum); 
          });

          // Drag and drop listeners for all cells in this pin's track
          cell.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (this.draggedPinKeyframeInfo && this.draggedPinKeyframeInfo.pinIndex === pinIdx) {
              if (parseInt(cell.dataset.frame) !== this.draggedPinKeyframeInfo.sourceFrame) {
                cell.classList.add('drag-over');
              }
              e.dataTransfer.dropEffect = 'move';
            } else {
              e.dataTransfer.dropEffect = 'none';
            }
          });

          cell.addEventListener('dragleave', () => {
            cell.classList.remove('drag-over');
          });

          cell.addEventListener('drop', (e) => {
            e.preventDefault();
            cell.classList.remove('drag-over');
            
            if (this.draggedPinKeyframeInfo && this.draggedPinKeyframeInfo.pinIndex === pinIdx) {
              const targetFrame = frameNum;
              const sourceFrame = this.draggedPinKeyframeInfo.sourceFrame;
              const draggedPinIndex = this.draggedPinKeyframeInfo.pinIndex;
              const draggedPinData = this.draggedPinKeyframeInfo.data; // from closure {state, easing}

              if (sourceFrame !== targetFrame) {
                // Check if target already has a pin keyframe. For now, allow overwrite.
                // const existingTargetState = this.pinKeyframes[targetFrame]?.[draggedPinIndex];
                // if (existingTargetState && !confirm(`Overwrite pin keyframe at frame ${targetFrame} for Pin ${draggedPinIndex}?`)) {
                //     this.draggedPinKeyframeInfo = null;
                //     return;
                // }
                this.movePinKeyframe(draggedPinIndex, sourceFrame, targetFrame, false, draggedPinData);
              }
            }
            this.draggedPinKeyframeInfo = null;
          });
          cellsContainer.appendChild(cell);
        }
        this.pinTracksContainerElement.appendChild(pinTrackDiv);
      }
    } else {
      this.pinTracksContainerElement.style.display = 'none';
      this.pinTracksContainerElement.innerHTML = ''; 
    }
    this.timelineElement.style.height = this.isExpanded ? 'auto' : ''; 
    this._updateTimelineButtonsUI(); // Update button after any UI change that might affect current frame context
  }

  findPreviousKeyframeTime(currentFrame, keyframeTimes) {
    let previousTime = 0;
    keyframeTimes.map(Number).sort((a, b) => a - b).forEach(time => {
        if (time <= currentFrame) {
            previousTime = time;
        }
    });
    return previousTime;
  }

  findNextKeyframeTime(currentFrame, keyframeTimes) {
    let nextTime = this.frameCount + 1;
    keyframeTimes.map(Number).sort((a, b) => a - b).forEach(time => {
        if (time > currentFrame && time < nextTime) {
            nextTime = time;
        }
    });
    return nextTime;
  }
  
  updatePuppetToolState() {
    if (!this.puppetTool) return; // Early exit if no puppet tool

    let activeKeyImageObject = null; // This will be an unscaled HTMLImageElement
    let unscaledSourceForPuppet; // The unscaled source (Image) for the puppet tool
    let imageForPuppet; // The image/canvas scaled to working resolution for puppet tool

    // --- Determine unscaled source and potentially active key image ---
    if (this.app.keyImages && this.app.keyImages.length > 0) {
        const sortedKeyImages = [...this.app.keyImages]
            .filter(ki => ki.activeFrame > 0 && ki.imageObject)
            .sort((a, b) => a.activeFrame - b.activeFrame);

        for (const ki of sortedKeyImages) {
            if (ki.activeFrame <= this.currentFrame) {
                activeKeyImageObject = ki.imageObject; // This is an unscaled Image
            } else {
                break;
            }
        }
    }

    if (activeKeyImageObject) {
        unscaledSourceForPuppet = activeKeyImageObject;
        imageForPuppet = this.app.scaleImageToResolution(activeKeyImageObject, this.app.puppetWorkingResolution);
    } else {
        unscaledSourceForPuppet = this.app.uploadedImageOriginalData; // Could be null if nothing loaded
        imageForPuppet = this.app.getBasePuppetImage(); // Already scaled, or null
    }

    // --- Load sprite into puppet tool if needed ---
    if (imageForPuppet) {
        let needsLoad = false;
        // Condition 1: The unscaled source image is different from what the puppet tool currently has.
        if (this.puppetTool.currentOriginalSpriteSource !== unscaledSourceForPuppet) {
            needsLoad = true;
        }
        // Condition 2: The resolution of the puppet tool's current sprite differs from the target resolution.
        // This typically happens if app.puppetWorkingResolution changes.
        else if (this.puppetTool.originalSprite &&
                   (this.puppetTool.originalSprite.width !== imageForPuppet.width ||
                    this.puppetTool.originalSprite.height !== imageForPuppet.height)) {
            needsLoad = true;
        }
        // Condition 3: Puppet tool has no sprite loaded, but we have one to load now.
        else if (!this.puppetTool.originalSprite) {
            needsLoad = true;
        }


        if (needsLoad) {
            let preservePins = true; // Default: preserve pins when timeline triggers a sprite load.

            if (!this.puppetTool.originalSprite) {
                // Case: Puppet tool is empty. This is effectively an initial load for it.
                // Pins must be initialized, not preserved.
                preservePins = false;
            } else if (this.puppetTool.originalSprite &&
                       (this.puppetTool.originalSprite.width !== imageForPuppet.width ||
                        this.puppetTool.originalSprite.height !== imageForPuppet.height)) {
                // Case: The target resolution for the puppet tool has changed.
                // Pin coordinates are relative to the resolution, so they must be reset.
                preservePins = false;
            }
            // Otherwise (if it's just a texture swap for an existing setup, like changing key images
            // or switching between a key image and the base image, without resolution change),
            // preservePins remains true.

            this.puppetTool.loadSprite(imageForPuppet, unscaledSourceForPuppet, preservePins);
        }
    } else if (this.puppetTool.originalSprite) {
        // No imageForPuppet (e.g., no base image loaded and no key image active for this frame),
        // but the puppetTool currently has a sprite.
        // Optional: Clear the puppet tool display. For now, this is not changed to focus on the bug.
        // If clearing: this.puppetTool.loadSprite(null, null, false);
    }
    // --- End sprite loading ---


    if (!this.puppetTool.pins || this.puppetTool.pins.length === 0) {
        // If an image is loaded but no pins (e.g., after resolution change),
        // loadSprite would have set corner pins. If no image, pins array is empty.
        // Set to empty state just in case, or rely on loadSprite's behavior.
        // this.puppetTool.setPinStates([], true); 
        return;
    }
    
    const masterKeyframeTimes = Object.keys(this.keyframes).map(Number).sort((a,b) => a - b);
    if (masterKeyframeTimes.length === 0 && !Object.keys(this.pinKeyframes).length) {
        // No keyframes, puppet should be in its base pose (defined by its current pins)
        // This might mean re-applying its current pins if they were derived from interpolation before
        if (this.puppetTool.originalSprite) {
             // If the pins are already in their default state for the loaded sprite, this is redundant.
             // If they might have been interpolated, this ensures they reset to the base state for this frame.
             const currentPinStates = this.puppetTool.getPinStates(); // Get whatever state it's in
             this.puppetTool.setPinStates(currentPinStates, true); // Re-apply, mostly for visual update / consistency
        }
        return;
    }
    
    let calculatedPinStates = [];

    for (let pinIndex = 0; pinIndex < this.puppetTool.pins.length; pinIndex++) {
        // Priority: Pin-specific keyframe at current frame
        const currentPinKf = this.pinKeyframes[this.currentFrame]?.[pinIndex];
        if (currentPinKf) {
            calculatedPinStates[pinIndex] = { ...currentPinKf.state };
            continue; 
        }

        // Then, master keyframe at current frame (if no pin-specific)
        if (this.keyframes[this.currentFrame] && this.keyframes[this.currentFrame][pinIndex]) {
             calculatedPinStates[pinIndex] = { ...this.keyframes[this.currentFrame][pinIndex] };
             continue;
        }
        
        // Interpolation logic:
        // 1. Try to interpolate between pin-specific keyframes for this pin.
        // 2. If not possible, try to interpolate between master keyframes.
        // 3. If still not possible, use base/default state.

        let pinState;
        const pinKeyframeTimes = Object.keys(this.pinKeyframes)
            .filter(f => this.pinKeyframes[f]?.[pinIndex])
            .map(Number).sort((a,b) => a - b);

        let pinBeforeFrame = 0, pinAfterFrame = this.frameCount + 1;
        let usingPinSpecificInterpolation = false;

        if (pinKeyframeTimes.length > 0) {
            pinBeforeFrame = this.findPreviousKeyframeTime(this.currentFrame, pinKeyframeTimes);
            pinAfterFrame = this.findNextKeyframeTime(this.currentFrame, pinKeyframeTimes);

            if (pinBeforeFrame > 0 && pinAfterFrame <= this.frameCount && pinBeforeFrame !== pinAfterFrame) {
                 const beforePinData = this.pinKeyframes[pinBeforeFrame][pinIndex];
                 const afterPinData = this.pinKeyframes[pinAfterFrame][pinIndex];
                 
                 const easingType = beforePinData.easing || 'linear'; 
                 const easingFunction = EasingFunctions[easingType] || EasingFunctions.linear;
                 const linearT = (this.currentFrame - pinBeforeFrame) / (pinAfterFrame - pinBeforeFrame);
                 const t = easingFunction(linearT);
                 pinState = {
                    x: beforePinData.state.x + (afterPinData.state.x - beforePinData.state.x) * t,
                    y: beforePinData.state.y + (afterPinData.state.y - beforePinData.state.y) * t,
                    originalX: beforePinData.state.originalX, 
                    originalY: beforePinData.state.originalY
                };
                usingPinSpecificInterpolation = true;
            } else if (pinBeforeFrame > 0) { // Only a before pin keyframe, hold its value
                 pinState = {...this.pinKeyframes[pinBeforeFrame][pinIndex].state};
                 usingPinSpecificInterpolation = true; // Technically holding, but counts as pin-defined
            } else if (pinAfterFrame <= this.frameCount) { // Only an after pin keyframe, hold its value (or interpolate from start of timeline if desired)
                 pinState = {...this.pinKeyframes[pinAfterFrame][pinIndex].state};
                 usingPinSpecificInterpolation = true; // Holding
            }
        }
        
        if (!usingPinSpecificInterpolation) { // Fallback to master keyframe interpolation
            const masterKeyframeTimes = Object.keys(this.keyframes).map(Number).sort((a,b) => a - b);
            let beforeFrame = this.findPreviousKeyframeTime(this.currentFrame, masterKeyframeTimes);
            let afterFrame = this.findNextKeyframeTime(this.currentFrame, masterKeyframeTimes);

            if (beforeFrame === 0 && afterFrame === this.frameCount + 1) { // No master keyframes at all
                 pinState = {...this.puppetTool.pins[pinIndex]}; 
            } else if (beforeFrame === 0) { // Before first master keyframe
                pinState = (this.keyframes[afterFrame] && this.keyframes[afterFrame][pinIndex]) ? 
                           {...this.keyframes[afterFrame][pinIndex]} : 
                           {...this.puppetTool.pins[pinIndex]};
            } else if (afterFrame === this.frameCount + 1) { // After last master keyframe
                pinState = (this.keyframes[beforeFrame] && this.keyframes[beforeFrame][pinIndex]) ? 
                           {...this.keyframes[beforeFrame][pinIndex]} : 
                           {...this.puppetTool.pins[pinIndex]};
            } else if (beforeFrame === afterFrame ) { // Exactly on a master keyframe
                 pinState = (this.keyframes[beforeFrame] && this.keyframes[beforeFrame][pinIndex]) ? 
                            {...this.keyframes[beforeFrame][pinIndex]} : 
                            {...this.puppetTool.pins[pinIndex]};
            } else { // Interpolate between master keyframes
                const beforeStates = this.keyframes[beforeFrame];
                const afterStates = this.keyframes[afterFrame];

                if (!beforeStates || !afterStates || !beforeStates[pinIndex] || !afterStates[pinIndex]) {
                     pinState = {...this.puppetTool.pins[pinIndex]};
                } else {
                    const beforePin = beforeStates[pinIndex];
                    const afterPin = afterStates[pinIndex];
                    
                    const easingType = this.easingTypes[beforeFrame] || 'linear'; 
                    const easingFunction = EasingFunctions[easingType] || EasingFunctions.linear;
                    
                    const linearT = (this.currentFrame - beforeFrame) / (afterFrame - beforeFrame);
                    const t = easingFunction(linearT);
                    
                    pinState = {
                        x: beforePin.x + (afterPin.x - beforePin.x) * t,
                        y: beforePin.y + (afterPin.y - beforePin.y) * t,
                        originalX: beforePin.originalX, 
                        originalY: beforePin.originalY
                    };
                }
            }
        }
        calculatedPinStates[pinIndex] = pinState;
    }
    
    if(calculatedPinStates.length > 0){
        this.puppetTool.setPinStates(calculatedPinStates, true); // true to skip history
    } else if (this.puppetTool.pins.length > 0 && masterKeyframeTimes.length === 0 && Object.keys(this.pinKeyframes).length === 0) {
        // No keyframes, puppet should be in its base pose (corner pins usually)
        // This might already be handled by loadSprite if called.
        // If puppetTool has pins, ensure they are set to their original positions.
        const basePins = this.puppetTool.pins.map(p => ({...p, x: p.originalX, y: p.originalY }));
        this.puppetTool.setPinStates(basePins, true);
    }
  }
  
  startPlayback() {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.playbackInterval = setInterval(() => {
      if (this.currentFrame >= this.frameCount) {
        this.goToFrame(1);
      } else {
        this.nextFrame();
      }
    }, 100); 
  }
  
  stopPlayback() {
    if (!this.isPlaying) return;
    
    this.isPlaying = false;
    clearInterval(this.playbackInterval);
  }
  
  startDragKeyframe(frameNumber) {
    if (this.keyframes[frameNumber]) {
      this.draggedKeyframe = frameNumber; // Stores only frame number for master keyframe
      return true;
    }
    return false;
  }
  
  dropKeyframe(targetFrame) {
    if (this.draggedKeyframe !== null && this.draggedKeyframe !== targetFrame) {
      if (this.keyframes[targetFrame]) {
        console.warn(`Cannot move master keyframe to ${targetFrame}, it already has a keyframe.`);
        this.draggedKeyframe = null; 
        this.updateTimelineUI(); 
        return false;
      }
      // Master keyframe move doesn't pass data override here because it's simpler.
      // moveKeyframe will fetch current data.
      const success = this.moveKeyframe(this.draggedKeyframe, targetFrame, false);
      this.draggedKeyframe = null; 
      return success;
    }
    this.draggedKeyframe = null; 
    return false;
  }
  
  cancelDrag() {
    this.draggedKeyframe = null;
    this.draggedPinKeyframeInfo = null; // Also cancel pin keyframe drag
  }
  
  getFrameCount() {
    return this.frameCount;
  }
  
  async generateSpritesheet(resolution, frameCount) {
    const initialCurrentFrame = this.currentFrame; 
    const wasPlaying = this.isPlaying;
    if (wasPlaying) this.stopPlayback();

    this.goToFrame(1); 
    
    const originalSprite = this.puppetTool.originalSprite;
    if (!originalSprite) {
        if(wasPlaying) this.startPlayback();
        this.goToFrame(initialCurrentFrame);
        return null;
    }
    
    const hasKeyframes = Object.keys(this.keyframes).length > 0;
    if (!hasKeyframes) {
      console.warn('No master keyframes found for spritesheet generation.');
      // Allow exporting current state even without keyframes for single frame if frameCount is 1
      if (frameCount > 1) {
        // return null; // Or handle as a single frame export
      }
    }
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    
    const framesToRender = Math.min(frameCount, this.frameCount); // Use the smaller of requested or available
    const spriteWidth = resolution;
    const spriteHeight = resolution;
    
    canvas.width = spriteWidth * framesToRender;
    canvas.height = spriteHeight;
    
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    
    for (let i = 0; i < framesToRender; i++) {
      this.goToFrame(i + 1); 
      await delay(20); 
      
      const spriteImage = await this.getPuppetToolFrame(spriteWidth, spriteHeight);
      ctx.drawImage(spriteImage, i * spriteWidth, 0, spriteWidth, spriteHeight);
    }
    
    this.goToFrame(initialCurrentFrame); 
    if (wasPlaying) this.startPlayback();
    
    return canvas.toDataURL('image/png');
  }

  async getPuppetToolFrame(width, height, transparencyKeyColorHex = null) {
    return new Promise(resolve => {
      if (this.puppetTool.currentSprite) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.imageSmoothingEnabled = false;
        
        if (transparencyKeyColorHex) {
            tempCtx.fillStyle = transparencyKeyColorHex;
            tempCtx.fillRect(0, 0, width, height);
        }

        tempCtx.drawImage(this.puppetTool.currentSprite, 0, 0, width, height);
        
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => { 
            console.error("Error loading puppet tool frame into image.");
            const blankCanvas = document.createElement('canvas');
            blankCanvas.width = width; blankCanvas.height = height;
            resolve(blankCanvas); 
        }
        img.src = tempCanvas.toDataURL();
      } else {
        console.warn("No current sprite in puppet tool to get frame.");
        const blankCanvas = document.createElement('canvas');
        blankCanvas.width = width; blankCanvas.height = height;
        resolve(blankCanvas); 
      }
    });
  }

  updateActivePinKeyframe() {
    if (this.activeEditingTrack !== null && this.pinKeyframes[this.currentFrame]?.[this.activeEditingTrack]) {
        const pinIndex = this.activeEditingTrack;
        const currentPinObject = (this.puppetTool.pins && this.puppetTool.pins[pinIndex]) 
            ? this.puppetTool.pins[pinIndex] 
            : null;

        if (!currentPinObject) {
            this.app.setStatus(`Error: Pin ${pinIndex} data not found in puppet tool for update.`);
            console.warn(`Pin ${pinIndex} not found in puppetTool.pins when trying to update keyframe.`);
            return;
        }
        
        const pinStateToUpdate = { 
            x: currentPinObject.x, 
            y: currentPinObject.y, 
            originalX: currentPinObject.originalX, 
            originalY: currentPinObject.originalY 
        };
        
        // addPinKeyframe will handle the update logic and history.
        // It uses the current puppet pin state (passed as pinStateToUpdate) and current easing dropdown.
        this.addPinKeyframe(pinIndex, this.currentFrame, pinStateToUpdate, document.getElementById('easingType').value || 'linear', false);
        // Status messages are handled within addPinKeyframe.
    } else {
        this.app.setStatus('Cannot update: No pin track selected or no pin keyframe at current frame for the selected pin.');
    }
  }
}