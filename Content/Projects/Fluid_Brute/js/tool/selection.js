function isPointInPolygon(px, py, polygon) {
    var inside = false;
    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        var xi = polygon[i].x, yi = polygon[i].y;
        var xj = polygon[j].x, yj = polygon[j].y;
        
        var intersect = ((yi > py) !== (yj > py))
            && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function bleedColors(pixels, sw, sh) {
    var totalPixels = sw * sh;
    var queue = new Int32Array(totalPixels);
    var head = 0;
    var tail = 0;
    
    var visited = new Uint8Array(totalPixels);
    var colorR = new Float32Array(totalPixels);
    var colorG = new Float32Array(totalPixels);
    var colorB = new Float32Array(totalPixels);

    // Initialize with all pixels that have some paint (a > 0.0)
    for (var i = 0; i < totalPixels; ++i) {
        var pIdx = i * 4;
        if (pixels[pIdx + 3] > 0.001) {
            visited[i] = 1;
            colorR[i] = pixels[pIdx];
            colorG[i] = pixels[pIdx + 1];
            colorB[i] = pixels[pIdx + 2];
            queue[tail++] = i;
        }
    }

    while (head < tail) {
        var idx = queue[head++];
        var cx = idx % sw;
        var cy = (idx / sw) | 0;
        var r = colorR[idx];
        var g = colorG[idx];
        var b = colorB[idx];

        for (var d = 0; d < 8; ++d) {
            var nx = cx;
            var ny = cy;
            if (d === 0) nx--;
            else if (d === 1) nx++;
            else if (d === 2) ny--;
            else if (d === 3) ny++;
            else if (d === 4) { nx--; ny--; }
            else if (d === 5) { nx++; ny--; }
            else if (d === 6) { nx--; ny++; }
            else if (d === 7) { nx++; ny++; }

            if (nx >= 0 && nx < sw && ny >= 0 && ny < sh) {
                var nIdx = ny * sw + nx;
                if (visited[nIdx] === 0) {
                    visited[nIdx] = 1;
                    colorR[nIdx] = r;
                    colorG[nIdx] = g;
                    colorB[nIdx] = b;
                    queue[tail++] = nIdx;
                }
            }
        }
    }

    // Write back to pixels array where alpha was 0.0
    for (var i = 0; i < totalPixels; ++i) {
        var pIdx = i * 4;
        if (pixels[pIdx + 3] <= 0.001 && visited[i] === 1) {
            pixels[pIdx] = colorR[i];
            pixels[pIdx + 1] = colorG[i];
            pixels[pIdx + 2] = colorB[i];
        }
    }
}

function weldPaintBoundary(allPixels, W, H, minX, maxX, minY, maxY, isPasted, skipGapFilling) {
    var minX_weld = Math.max(0, minX - 5);
    var maxX_weld = Math.min(W - 1, maxX + 5);
    var minY_weld = Math.max(0, minY - 5);
    var maxY_weld = Math.min(H - 1, maxY + 5);

    var localW = maxX_weld - minX_weld + 1;
    var localH = maxY_weld - minY_weld + 1;

    var isSeam = new Uint8Array(localW * localH);

    // 1. Detect the seam
    for (var dy = minY_weld; dy <= maxY_weld; ++dy) {
        for (var dx = minX_weld; dx <= maxX_weld; ++dx) {
            var localIdx = (dy - minY_weld) * localW + (dx - minX_weld);
            var pasted = isPasted[localIdx];

            var hasDifferentNeighbor = false;
            for (var ny = -1; ny <= 1; ny++) {
                for (var nx = -1; nx <= 1; nx++) {
                    if (nx === 0 && ny === 0) continue;
                    var gX = dx + nx;
                    var gY = dy + ny;
                    if (gX >= minX_weld && gX <= maxX_weld && gY >= minY_weld && gY <= maxY_weld) {
                        var nLocalIdx = (gY - minY_weld) * localW + (gX - minX_weld);
                        if (isPasted[nLocalIdx] !== pasted) {
                            hasDifferentNeighbor = true;
                            break;
                        }
                    } else {
                        if (pasted === 1) {
                            hasDifferentNeighbor = true;
                            break;
                        }
                    }
                }
                if (hasDifferentNeighbor) break;
            }
            if (hasDifferentNeighbor) {
                isSeam[localIdx] = 1;
            }
        }
    }

    // 2. Dilate the seam to form the weld zone
    var weldZone = new Uint8Array(localW * localH);
    var DILATION_RADIUS = 2;
    for (var dy = minY_weld; dy <= maxY_weld; ++dy) {
        for (var dx = minX_weld; dx <= maxX_weld; ++dx) {
            var localIdx = (dy - minY_weld) * localW + (dx - minX_weld);
            if (isSeam[localIdx] === 1) {
                for (var ny = -DILATION_RADIUS; ny <= DILATION_RADIUS; ny++) {
                    for (var nx = -DILATION_RADIUS; nx <= DILATION_RADIUS; nx++) {
                        var gX = dx + nx;
                        var gY = dy + ny;
                        if (gX >= minX_weld && gX <= maxX_weld && gY >= minY_weld && gY <= maxY_weld) {
                            var nLocalIdx = (gY - minY_weld) * localW + (gX - minX_weld);
                            weldZone[nLocalIdx] = 1;
                        }
                    }
                }
            }
        }
    }

    // 3. Stage 1: Gap/Hole Filling (bridge any sudden unpainted pixels)
    if (!skipGapFilling) {
        for (var dy = minY_weld; dy <= maxY_weld; ++dy) {
            for (var dx = minX_weld; dx <= maxX_weld; ++dx) {
                var localIdx = (dy - minY_weld) * localW + (dx - minX_weld);
                if (weldZone[localIdx] === 1) {
                    var destIdx = (dy * W + dx) * 4;
                    if (allPixels[destIdx + 3] < 0.005) {
                        var sumR = 0, sumG = 0, sumB = 0, sumA = 0, count = 0;
                        for (var ny = -2; ny <= 2; ny++) {
                            for (var nx = -2; nx <= 2; nx++) {
                                var gX = dx + nx;
                                var gY = dy + ny;
                                if (gX >= 0 && gX < W && gY >= 0 && gY < H) {
                                    var nIdx = (gY * W + gX) * 4;
                                    var nThick = allPixels[nIdx + 3];
                                    if (nThick >= 0.005) {
                                        sumR += allPixels[nIdx];
                                        sumG += allPixels[nIdx + 1];
                                        sumB += allPixels[nIdx + 2];
                                        sumA += nThick;
                                        count++;
                                    }
                                }
                            }
                        }
                        if (count > 0) {
                            allPixels[destIdx] = sumR / count;
                            allPixels[destIdx + 1] = sumG / count;
                            allPixels[destIdx + 2] = sumB / count;
                            allPixels[destIdx + 3] = sumA / count;
                        }
                    }
                }
            }
        }
    }

    // 4. Stage 2: Smoothing / Welder
    var smoothedPixels = new Float32Array(localW * localH * 4);
    for (var dy = minY_weld; dy <= maxY_weld; ++dy) {
        for (var dx = minX_weld; dx <= maxX_weld; ++dx) {
            var localIdx = (dy - minY_weld) * localW + (dx - minX_weld);
            if (weldZone[localIdx] === 1) {
                var sumR = 0, sumG = 0, sumB = 0, sumA = 0, totalWeight = 0;
                for (var ny = -2; ny <= 2; ny++) {
                    for (var nx = -2; nx <= 2; nx++) {
                        var gX = dx + nx;
                        var gY = dy + ny;
                        if (gX >= 0 && gX < W && gY >= 0 && gY < H) {
                            var nIdx = (gY * W + gX) * 4;
                            var nThick = allPixels[nIdx + 3];
                            if (nThick > 0.0) {
                                var distSq = nx * nx + ny * ny;
                                var weight = Math.exp(-distSq / 2.0);
                                sumR += allPixels[nIdx] * weight;
                                sumG += allPixels[nIdx + 1] * weight;
                                sumB += allPixels[nIdx + 2] * weight;
                                sumA += nThick * weight;
                                totalWeight += weight;
                            }
                        }
                    }
                }
                var sIdx = localIdx * 4;
                if (totalWeight > 0) {
                    smoothedPixels[sIdx] = sumR / totalWeight;
                    smoothedPixels[sIdx + 1] = sumG / totalWeight;
                    smoothedPixels[sIdx + 2] = sumB / totalWeight;
                    smoothedPixels[sIdx + 3] = sumA / totalWeight;
                } else {
                    var destIdx = (dy * W + dx) * 4;
                    smoothedPixels[sIdx] = allPixels[destIdx];
                    smoothedPixels[sIdx + 1] = allPixels[destIdx + 1];
                    smoothedPixels[sIdx + 2] = allPixels[destIdx + 2];
                    smoothedPixels[sIdx + 3] = allPixels[destIdx + 3];
                }
            }
        }
    }

    // 5. Apply feathered blend back to allPixels
    for (var dy = minY_weld; dy <= maxY_weld; ++dy) {
        for (var dx = minX_weld; dx <= maxX_weld; ++dx) {
            var localIdx = (dy - minY_weld) * localW + (dx - minX_weld);
            if (weldZone[localIdx] === 1) {
                var destIdx = (dy * W + dx) * 4;
                var sIdx = localIdx * 4;

                var minDist = DILATION_RADIUS + 1;
                for (var ny = -DILATION_RADIUS; ny <= DILATION_RADIUS; ny++) {
                    for (var nx = -DILATION_RADIUS; nx <= DILATION_RADIUS; nx++) {
                        var gX = dx + nx;
                        var gY = dy + ny;
                        if (gX >= minX_weld && gX <= maxX_weld && gY >= minY_weld && gY <= maxY_weld) {
                            var nLocalIdx = (gY - minY_weld) * localW + (gX - minX_weld);
                            if (isSeam[nLocalIdx] === 1) {
                                var dist = Math.sqrt(nx * nx + ny * ny);
                                if (dist < minDist) {
                                    minDist = dist;
                                }
                            }
                        }
                    }
                }

                var blendFactor = 0.8 * (1.0 - minDist / (DILATION_RADIUS + 1));
                blendFactor = Math.max(0.0, Math.min(0.8, blendFactor));

                allPixels[destIdx] = smoothedPixels[sIdx] * blendFactor + allPixels[destIdx] * (1.0 - blendFactor);
                allPixels[destIdx + 1] = smoothedPixels[sIdx + 1] * blendFactor + allPixels[destIdx + 1] * (1.0 - blendFactor);
                allPixels[destIdx + 2] = smoothedPixels[sIdx + 2] * blendFactor + allPixels[destIdx + 2] * (1.0 - blendFactor);
                allPixels[destIdx + 3] = smoothedPixels[sIdx + 3] * blendFactor + allPixels[destIdx + 3] * (1.0 - blendFactor);
            }
        }
    }
}

export class SelectionTool {
    constructor(paintInstance) {
        this.paint = paintInstance;
        this.id = 'select';
        this.name = 'Select';
        this.icon = '⛶';

        this.selectMode = 'rect'; // 'rect' or 'lasso'
        this.lassoPoints = [];

        this.selectionActive = false;
        this.isDrawingSelection = false;
        this.isTransformMode = false;

        // Selection bounds in normalized coordinates [0, 1]
        this.selX1 = 0;
        this.selY1 = 0;
        this.selX2 = 0;
        this.selY2 = 0;

        // Starting point of selection drag in normalized coordinates
        this.startNormalizedX = 0;
        this.startNormalizedY = 0;

        // Raw float pixels of selection area
        this.rawSelectedPixels = null;
        this.originalWidth = 0;
        this.originalHeight = 0;
        this.originalPx1 = 0;
        this.originalPy1 = 0;

        // Transformation state
        this.transformState = {
            x: 0,       // current translation X in screen pixels
            y: 0,       // current translation Y in screen pixels
            scaleX: 1.0,
            scaleY: 1.0,
            rotation: 0.0 // in radians
        };

        // DOM elements
        this.selectionOverlay = null;
        this.transformContainer = null;
        this.floatingCanvas = null;

        this.init();
    }

    init() {
        // Ensure elements are created/updated
        this.createSelectionOverlay();
    }

    onActivate(paint) {
        if (paint.canvas) {
            paint.canvas.style.cursor = 'crosshair';
        }
        this.update();
    }

    onDeactivate(paint) {
        if (paint.canvas) {
            paint.canvas.style.cursor = '';
        }
        // Commit any active transform before leaving
        if (this.isTransformMode) {
            this.commitTransform();
        }
        this.isDrawingSelection = false;
        this.selectionActive = false;
        this.lassoPoints = [];
        this.update();
    }

    createSelectionOverlay() {
        if (!this.selectionOverlay) {
            this.selectionOverlay = document.createElement('div');
            this.selectionOverlay.className = 'selection-overlay';
            this.selectionOverlay.style.display = 'none';
            document.body.appendChild(this.selectionOverlay);
        }
        if (!this.lassoCanvas) {
            this.lassoCanvas = document.createElement('canvas');
            this.lassoCanvas.className = 'lasso-overlay';
            this.lassoCanvas.style.position = 'absolute';
            this.lassoCanvas.style.top = '0';
            this.lassoCanvas.style.left = '0';
            this.lassoCanvas.style.width = '100%';
            this.lassoCanvas.style.height = '100%';
            this.lassoCanvas.style.zIndex = '1000';
            this.lassoCanvas.style.pointerEvents = 'none';
            this.lassoCanvas.style.display = 'none';
            document.body.appendChild(this.lassoCanvas);
        }
    }

    toggleTransformMode() {
        if (this.isTransformMode) {
            this.commitTransform();
        } else if (this.selectionActive) {
            this.enterTransformMode();
        }
    }

    enterTransformMode() {
        if (this.isTransformMode || !this.selectionActive) return;

        var paint = this.paint;
        var wgl = paint.wgl;
        var W = paint.simulator.resolutionWidth;
        var H = paint.simulator.resolutionHeight;

        // 1. Calculate selection bounding box in texture pixels
        var px1 = Math.floor(this.selX1 * W);
        var py1 = Math.floor(this.selY1 * H);
        var px2 = Math.floor(this.selX2 * W);
        var py2 = Math.floor(this.selY2 * H);

        var sw = px2 - px1;
        var sh = py2 - py1;

        if (sw <= 1 || sh <= 1) {
            this.selectionActive = false;
            this.update();
            return;
        }

        // Snap selection coordinates to match exact integer pixel boundaries
        this.selX1 = px1 / W;
        this.selY1 = py1 / H;
        this.selX2 = px2 / W;
        this.selY2 = py2 / H;

        // Save snapshot before we modify the texture
        paint.saveSnapshot();

        this.originalWidth = sw;
        this.originalHeight = sh;
        this.originalPx1 = px1;
        this.originalPy1 = py1;
        this.originalScreenWidth = (this.selX2 - this.selX1) * paint.paintingRectangle.width;
        this.originalScreenHeight = (this.selY2 - this.selY1) * paint.paintingRectangle.height;

        // 2. Read full paint texture
        var allPixels = paint.getPaintTextureData();

        // Allocate the isPasted array for cutout welding
        var minX_weld = Math.max(0, px1 - 5);
        var maxX_weld = Math.min(W - 1, px2 + 5);
        var minY_weld = Math.max(0, py1 - 5);
        var maxY_weld = Math.min(H - 1, py2 + 5);
        var localW = maxX_weld - minX_weld + 1;
        var localH = maxY_weld - minY_weld + 1;
        var isPasted = new Uint8Array(localW * localH);

        // 3. Extract sub-region into rawSelectedPixels
        this.rawSelectedPixels = new Float32Array(sw * sh * 4);
        for (var y = 0; y < sh; ++y) {
            for (var x = 0; x < sw; ++x) {
                var tx = px1 + x;
                var ty = py1 + y;
                var srcIdx = (ty * W + tx) * 4;
                var destIdx = (y * sw + x) * 4;

                var isInside = true;
                if (this.selectMode === 'lasso' && this.lassoPoints && this.lassoPoints.length > 2) {
                    var normX = tx / W;
                    var normY = ty / H;
                    isInside = isPointInPolygon(normX, normY, this.lassoPoints);
                }

                if (isInside) {
                    this.rawSelectedPixels[destIdx] = allPixels[srcIdx];
                    this.rawSelectedPixels[destIdx + 1] = allPixels[srcIdx + 1];
                    this.rawSelectedPixels[destIdx + 2] = allPixels[srcIdx + 2];
                    this.rawSelectedPixels[destIdx + 3] = allPixels[srcIdx + 3];

                    // Clear/erase this region in the main texture
                    allPixels[srcIdx] = 0;
                    allPixels[srcIdx + 1] = 0;
                    allPixels[srcIdx + 2] = 0;
                    allPixels[srcIdx + 3] = 0;

                    // Mark as cutout for welding
                    var localIdx = (ty - minY_weld) * localW + (tx - minX_weld);
                    isPasted[localIdx] = 1;
                } else {
                    // Outside lasso: keep in main, set selection pixel to 0
                    this.rawSelectedPixels[destIdx] = 0;
                    this.rawSelectedPixels[destIdx + 1] = 0;
                    this.rawSelectedPixels[destIdx + 2] = 0;
                    this.rawSelectedPixels[destIdx + 3] = 0;
                }
            }
        }

        // Bleed the colors of rawSelectedPixels to prevent white lines at boundaries
        bleedColors(this.rawSelectedPixels, sw, sh);

        // Weld the cutout boundary by feathering the remaining paint (skipGapFilling = true)
        weldPaintBoundary(allPixels, W, H, px1, px2, py1, py2, isPasted, true);

        // Write cleared texture back to WebGL
        paint.setPaintTextureData(allPixels, W, H);

        // 4. Create WebGL textures for rendering the selection
        var tempSelectTexture = wgl.buildTexture(wgl.RGBA, wgl.FLOAT, sw, sh, this.rawSelectedPixels, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.LINEAR, wgl.LINEAR);
        var tempRGBTexture = wgl.buildTexture(wgl.RGBA, wgl.UNSIGNED_BYTE, sw, sh, null, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.NEAREST, wgl.NEAREST);
        var tempFramebuffer = wgl.createFramebuffer();
        wgl.framebufferTexture2D(tempFramebuffer, wgl.FRAMEBUFFER, wgl.COLOR_ATTACHMENT0, wgl.TEXTURE_2D, tempRGBTexture, 0);

        // Render selection offscreen with the correct painting shader (RYB/RGB + Light + Normals)
        var NORMAL_SCALE = 7.0;
        var ROUGHNESS = 0.075;
        var DIFFUSE_SCALE = 0.15;
        var SPECULAR_SCALE = 0.5;
        var F0 = 0.05;
        var LIGHT_DIRECTION = [0, 1, 1];

        var paintingProgram = paint.colorModel === 0 ? paint.savePaintingProgram : paint.savePaintingProgramRGB; // RYB is 0, RGB is 1

        var saveDrawState = wgl.createDrawState()
            .bindFramebuffer(tempFramebuffer)
            .viewport(0, 0, sw, sh)
            .vertexAttribPointer(paint.quadVertexBuffer, paintingProgram.getAttribLocation('a_position'), 2, wgl.FLOAT, false, 0, 0)
            .useProgram(paintingProgram)
            .uniform2f('u_paintingSize', sw, sh)
            .uniform2f('u_paintingResolution', sw, sh)
            .uniform2f('u_screenResolution', sw, sh)
            .uniform2f('u_paintingPosition', 0, 0)
            .uniformTexture('u_paintTexture', 0, wgl.TEXTURE_2D, tempSelectTexture)
            .uniform1f('u_mirror', 0.0)
            .uniform1f('u_normalScale', NORMAL_SCALE / paint.resolutionScale)
            .uniform1f('u_roughness', ROUGHNESS)
            .uniform1f('u_diffuseScale', DIFFUSE_SCALE)
            .uniform1f('u_specularScale', SPECULAR_SCALE)
            .uniform1f('u_F0', F0)
            .uniform3f('u_lightDirection', LIGHT_DIRECTION[0], LIGHT_DIRECTION[1], LIGHT_DIRECTION[2]);

        wgl.drawArrays(saveDrawState, wgl.TRIANGLE_STRIP, 0, 4);

        // Read pixels back as unsigned bytes
        var bytePixels = new Uint8Array(sw * sh * 4);
        wgl.readPixels(wgl.createReadState().bindFramebuffer(tempFramebuffer), 0, 0, sw, sh, wgl.RGBA, wgl.UNSIGNED_BYTE, bytePixels);

        // Clean up WebGL offscreen resources
        wgl.deleteTexture(tempSelectTexture);
        wgl.deleteTexture(tempRGBTexture);
        wgl.deleteFramebuffer(tempFramebuffer);

        // 5. Build HTML floating 2D Canvas
        this.floatingCanvas = document.createElement('canvas');
        this.floatingCanvas.width = sw;
        this.floatingCanvas.height = sh;
        this.floatingCanvas.className = 'transform-canvas';
        var ctx = this.floatingCanvas.getContext('2d');

        var imageData = ctx.createImageData(sw, sh);
        imageData.data.set(bytePixels);
        ctx.putImageData(imageData, 0, 0);

        // Reset transform state
        this.transformState = {
            nx: 0,
            ny: 0,
            scaleX: 1.0,
            scaleY: 1.0,
            rotation: 0.0
        };

        this.isTransformMode = true;

        // 6. Build DOM Transform Widget Container
        this.createTransformUI();
    }

    createTransformUI() {
        var canvasRef = this.floatingCanvas;
        this.destroyTransformUI();
        this.floatingCanvas = canvasRef;

        this.transformContainer = document.createElement('div');
        this.transformContainer.className = 'transform-container';
        this.transformContainer.appendChild(this.floatingCanvas);

        // Add corners and middle handlers
        var handles = ['tl', 'tm', 'tr', 'ml', 'mr', 'bl', 'bm', 'br'];
        handles.forEach(h => {
            var el = document.createElement('div');
            el.className = 'transform-handle ' + h;
            this.transformContainer.appendChild(el);
            this.bindHandleEvents(el, h);
        });

        // Add rotate pin
        var line = document.createElement('div');
        line.className = 'rotate-pin-line';
        this.transformContainer.appendChild(line);

        var rotatePin = document.createElement('div');
        rotatePin.className = 'rotate-pin-handle';
        this.transformContainer.appendChild(rotatePin);
        this.bindRotateEvents(rotatePin);

        document.body.appendChild(this.transformContainer);

        // Bind main move drag events on the container
        this.bindMoveEvents(this.transformContainer);

        this.updateDOMTransformBox();
    }

    destroyTransformUI() {
        if (this.transformContainer && this.transformContainer.parentNode) {
            this.transformContainer.parentNode.removeChild(this.transformContainer);
        }
        this.transformContainer = null;
        this.floatingCanvas = null;
    }

    bindMoveEvents(el) {
        var self = this;
        var startX = 0;
        var startY = 0;
        var origNX = 0;
        var origNY = 0;
        var isDragging = false;

        function onDown(e) {
            // Only left mouse clicks
            if (e.button !== undefined && e.button !== 0) return;
            if (e.target.classList.contains('transform-handle') || e.target.classList.contains('rotate-pin-handle')) {
                return; // Let handle events handle it
            }
            e.stopPropagation();
            e.preventDefault();

            isDragging = true;
            var clientX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
            var clientY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;

            startX = clientX;
            startY = clientY;
            origNX = self.transformState.nx;
            origNY = self.transformState.ny;

            document.addEventListener('mousemove', onMove, { passive: false });
            document.addEventListener('mouseup', onUp);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onUp);
        }

        function onMove(e) {
            if (!isDragging) return;
            e.preventDefault();

            var clientX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
            var clientY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;

            var dx = clientX - startX;
            var dy = clientY - startY;

            // Adjust translation based on mirroring
            if (self.paint.isMirrored) {
                dx = -dx;
            }

            self.transformState.nx = origNX + dx / self.paint.paintingRectangle.width;
            self.transformState.ny = origNY + dy / self.paint.paintingRectangle.height;

            self.updateDOMTransformBox();
            self.paint.needsRedraw = true;
        }

        function onUp() {
            if (isDragging) {
                isDragging = false;
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('touchend', onUp);
            }
        }

        el.addEventListener('mousedown', onDown);
        el.addEventListener('touchstart', onDown, { passive: false });
    }

    bindHandleEvents(el, type) {
        var self = this;
        var isScaling = false;

        function onDown(e) {
            e.stopPropagation();
            e.preventDefault();

            isScaling = true;

            document.addEventListener('mousemove', onMove, { passive: false });
            document.addEventListener('mouseup', onUp);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onUp);
        }

        function onMove(e) {
            if (!isScaling) return;
            e.preventDefault();

            var clientX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
            var clientY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;

            // Calculate center of transform container
            var rect = self.transformContainer.getBoundingClientRect();
            var cx = rect.left + rect.width / 2;
            var cy = rect.top + rect.height / 2;

            // Map mouse offset from center into the rotated local axes of the selection box
            var rx = clientX - cx;
            var ry = clientY - cy;

            if (self.paint.isMirrored) {
                rx = -rx;
            }

            var rot = self.transformState.rotation;
            var cosA = Math.cos(rot);
            var sinA = Math.sin(rot);

            // Projections along rotated local coordinate axes
            var projX = rx * cosA + ry * sinA;
            var projY = -rx * sinA + ry * cosA;

            var currentHalfW = ((self.selX2 - self.selX1) * self.paint.paintingRectangle.width) / 2;
            var currentHalfH = ((self.selY2 - self.selY1) * self.paint.paintingRectangle.height) / 2;

            // Handle scaling math depending on which handle is dragged
            if (type.indexOf('r') !== -1) {
                self.transformState.scaleX = Math.max(0.05, projX / currentHalfW);
            } else if (type.indexOf('l') !== -1) {
                self.transformState.scaleX = Math.max(0.05, -projX / currentHalfW);
            }

            if (type.indexOf('b') !== -1) {
                self.transformState.scaleY = Math.max(0.05, projY / currentHalfH);
            } else if (type.indexOf('t') !== -1) {
                self.transformState.scaleY = Math.max(0.05, -projY / currentHalfH);
            }

            self.updateDOMTransformBox();
            self.paint.needsRedraw = true;
        }

        function onUp() {
            if (isScaling) {
                isScaling = false;
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('touchend', onUp);
            }
        }

        el.addEventListener('mousedown', onDown);
        el.addEventListener('touchstart', onDown, { passive: false });
    }

    bindRotateEvents(el) {
        var self = this;
        var isRotating = false;
        var startRot = 0;
        var startAngle = 0;

        function onDown(e) {
            e.stopPropagation();
            e.preventDefault();

            isRotating = true;
            var clientX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
            var clientY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;

            var rect = self.transformContainer.getBoundingClientRect();
            var cx = rect.left + rect.width / 2;
            var cy = rect.top + rect.height / 2;

            var rx = clientX - cx;
            var ry = clientY - cy;

            startAngle = Math.atan2(ry, rx);
            startRot = self.transformState.rotation;

            document.addEventListener('mousemove', onMove, { passive: false });
            document.addEventListener('mouseup', onUp);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onUp);
        }

        function onMove(e) {
            if (!isRotating) return;
            e.preventDefault();

            var clientX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
            var clientY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;

            var rect = self.transformContainer.getBoundingClientRect();
            var cx = rect.left + rect.width / 2;
            var cy = rect.top + rect.height / 2;

            var rx = clientX - cx;
            var ry = clientY - cy;

            var currAngle = Math.atan2(ry, rx);
            var delta = currAngle - startAngle;

            self.transformState.rotation = startRot + delta;

            self.updateDOMTransformBox();
            self.paint.needsRedraw = true;
        }

        function onUp() {
            if (isRotating) {
                isRotating = false;
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('touchend', onUp);
            }
        }

        el.addEventListener('mousedown', onDown);
        el.addEventListener('touchstart', onDown, { passive: false });
    }

    commitTransform() {
        if (!this.isTransformMode) return;
        this.isTransformMode = false;

        if (!this.rawSelectedPixels || !this.floatingCanvas) {
            this.destroyTransformUI();
            this.selectionActive = false;
            this.update();
            return;
        }

        var paint = this.paint;
        var W = paint.simulator.resolutionWidth;
        var H = paint.simulator.resolutionHeight;

        // 1. Read current paint texture data
        var allPixels = paint.getPaintTextureData();

        // 2. Compute parameters for inverse transformation
        var zoom = paint.zoomLevel || 1.0;

        // Scale factor between screen pixels and WebGL texture coordinates
        var tx_dx = this.transformState.nx * W;
        var tx_dy = -this.transformState.ny * H;
        if (paint.isMirrored) {
            tx_dx = -tx_dx;
        }

        var sw = this.originalWidth;
        var sh = this.originalHeight;
        var origCenterX = this.originalPx1 + sw / 2;
        var origCenterY = this.originalPy1 + sh / 2;

        var destCenterX = origCenterX + tx_dx;
        var destCenterY = origCenterY + tx_dy;

        var scaleX = this.transformState.scaleX;
        var scaleY = this.transformState.scaleY;
        var angle = this.transformState.rotation;
        if (paint.isMirrored) {
            angle = -angle;
        }

        var cosA = Math.cos(angle);
        var sinA = Math.sin(angle);

        // 3. Find bounding box of transformed selection in destination coordinates
        var halfW = sw / 2;
        var halfH = sh / 2;
        var corners = [
            { x: -halfW, y: -halfH },
            { x: halfW, y: -halfH },
            { x: -halfW, y: halfH },
            { x: halfW, y: halfH }
        ];

        var destCorners = corners.map(c => {
            var sx = c.x * scaleX;
            var sy = c.y * scaleY;
            var rx = sx * cosA - sy * sinA;
            var ry = sx * sinA + sy * cosA;
            return {
                x: rx + destCenterX,
                y: ry + destCenterY
            };
        });

        var minX = Math.floor(Math.min(...destCorners.map(c => c.x)));
        var maxX = Math.ceil(Math.max(...destCorners.map(c => c.x)));
        var minY = Math.floor(Math.min(...destCorners.map(c => c.y)));
        var maxY = Math.ceil(Math.max(...destCorners.map(c => c.y)));

        // Clamp to painting boundaries
        minX = Math.max(0, minX);
        maxX = Math.min(W - 1, maxX);
        minY = Math.max(0, minY);
        maxY = Math.min(H - 1, maxY);

        // Allocate the isPasted array for welding
        var minX_weld = Math.max(0, minX - 5);
        var maxX_weld = Math.min(W - 1, maxX + 5);
        var minY_weld = Math.max(0, minY - 5);
        var maxY_weld = Math.min(H - 1, maxY + 5);
        var localW = maxX_weld - minX_weld + 1;
        var localH = maxY_weld - minY_weld + 1;
        var isPasted = new Uint8Array(localW * localH);

        // 4. Interpolate and blend pixels back with high-fidelity bilinear scaling
        var selectedPixels = this.rawSelectedPixels;
        for (var dy = minY; dy <= maxY; ++dy) {
            for (var dx = minX; dx <= maxX; ++dx) {
                // Inverse translate
                var x = dx - destCenterX;
                var y = dy - destCenterY;

                // Inverse rotate
                var rx = x * cosA + y * sinA;
                var ry = -x * sinA + y * cosA;

                // Inverse scale
                var sx = rx / scaleX + halfW;
                var sy = ry / scaleY + halfH;

                if (sx >= 0 && sx < sw && sy >= 0 && sy < sh) {
                    var x0 = Math.floor(sx);
                    var x1 = Math.min(sw - 1, x0 + 1);
                    var y0 = Math.floor(sy);
                    var y1 = Math.min(sh - 1, y0 + 1);
                    var tx = sx - x0;
                    var ty = sy - y0;

                    var idx00 = (y0 * sw + x0) * 4;
                    var idx10 = (y0 * sw + x1) * 4;
                    var idx01 = (y1 * sw + x0) * 4;
                    var idx11 = (y1 * sw + x1) * 4;

                    var destIdx = (dy * W + dx) * 4;
                    var valThickness = (1 - tx) * (1 - ty) * selectedPixels[idx00 + 3] +
                                       tx * (1 - ty) * selectedPixels[idx10 + 3] +
                                       (1 - tx) * ty * selectedPixels[idx01 + 3] +
                                       tx * ty * selectedPixels[idx11 + 3];

                    if (valThickness > 0.0) {
                        var isDestEmpty = (allPixels[destIdx + 3] === 0.0);
                        var srcAlpha = Math.min(1.0, valThickness * 30.0);

                        // Mark as pasted/modified for welding
                        var localIdx = (dy - minY_weld) * localW + (dx - minX_weld);
                        isPasted[localIdx] = 1;

                        for (var c = 0; c < 4; ++c) {
                            var val = (1 - tx) * (1 - ty) * selectedPixels[idx00 + c] +
                                      tx * (1 - ty) * selectedPixels[idx10 + c] +
                                      (1 - tx) * ty * selectedPixels[idx01 + c] +
                                      tx * ty * selectedPixels[idx11 + c];

                            if (isDestEmpty) {
                                allPixels[destIdx + c] = val;
                            } else {
                                if (c === 3) {
                                    // Add thickness instead of averaging to prevent "denting"
                                    allPixels[destIdx + 3] = allPixels[destIdx + 3] + val;
                                } else {
                                    allPixels[destIdx + c] = val * srcAlpha + allPixels[destIdx + c] * (1.0 - srcAlpha);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Run the weld pass on the committed paste boundary!
        weldPaintBoundary(allPixels, W, H, minX, maxX, minY, maxY, isPasted);

        // Commit full state back to WebGL texture and trigger redraw
        paint.setPaintTextureData(allPixels, W, H);
        paint.saveSnapshot(); // Save snapshot after committing the finished transformation!

        // Destroy widgets
        this.destroyTransformUI();
        this.rawSelectedPixels = null;
        this.selectionActive = false;
        this.update();
        paint.needsRedraw = true;
    }

    cancelTransform() {
        if (!this.isTransformMode) return;
        this.isTransformMode = false;
        this.destroyTransformUI();
        this.rawSelectedPixels = null;
        this.selectionActive = false;
        this.update();
        this.paint.needsRedraw = true;
    }

    copy() {
        if (this.isTransformMode) {
            if (this.rawSelectedPixels) {
                window.paintClipboard = {
                    pixels: new Float32Array(this.rawSelectedPixels),
                    width: this.originalWidth,
                    height: this.originalHeight
                };
            }
        } else if (this.selectionActive) {
            var paint = this.paint;
            var W = paint.simulator.resolutionWidth;
            var H = paint.simulator.resolutionHeight;
            var px1 = Math.floor(this.selX1 * W);
            var py1 = Math.floor(this.selY1 * H);
            var px2 = Math.floor(this.selX2 * W);
            var py2 = Math.floor(this.selY2 * H);
            var sw = px2 - px1;
            var sh = py2 - py1;

            if (sw > 1 && sh > 1) {
                var allPixels = paint.getPaintTextureData();
                var copiedPixels = new Float32Array(sw * sh * 4);
                for (var y = 0; y < sh; ++y) {
                    for (var x = 0; x < sw; ++x) {
                        var srcIdx = ((py1 + y) * W + (px1 + x)) * 4;
                        var destIdx = (y * sw + x) * 4;
                        copiedPixels[destIdx] = allPixels[srcIdx];
                        copiedPixels[destIdx + 1] = allPixels[srcIdx + 1];
                        copiedPixels[destIdx + 2] = allPixels[srcIdx + 2];
                        copiedPixels[destIdx + 3] = allPixels[srcIdx + 3];
                    }
                }
                window.paintClipboard = {
                    pixels: copiedPixels,
                    width: sw,
                    height: sh
                };
            }
        }
    }

    paste() {
        if (!window.paintClipboard) return;

        // Commit active transform if there's one
        if (this.isTransformMode) {
            this.commitTransform();
        }

        var clipboard = window.paintClipboard;
        var paint = this.paint;
        var W = paint.simulator.resolutionWidth;
        var H = paint.simulator.resolutionHeight;

        var sw = clipboard.width;
        var sh = clipboard.height;

        sw = Math.min(sw, W);
        sh = Math.min(sh, H);

        var px1 = Math.floor((W - sw) / 2);
        var py1 = Math.floor((H - sh) / 2);
        var px2 = px1 + sw;
        var py2 = py1 + sh;

        this.selX1 = px1 / W;
        this.selY1 = py1 / H;
        this.selX2 = px2 / W;
        this.selY2 = py2 / H;

        this.selectionActive = true;
        this.originalWidth = sw;
        this.originalHeight = sh;
        this.originalPx1 = px1;
        this.originalPy1 = py1;
        this.originalScreenWidth = (this.selX2 - this.selX1) * paint.paintingRectangle.width;
        this.originalScreenHeight = (this.selY2 - this.selY1) * paint.paintingRectangle.height;

        this.rawSelectedPixels = new Float32Array(clipboard.pixels);
        bleedColors(this.rawSelectedPixels, sw, sh);

        paint.saveSnapshot();

        var wgl = paint.wgl;
        var tempSelectTexture = wgl.buildTexture(wgl.RGBA, wgl.FLOAT, sw, sh, this.rawSelectedPixels, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.LINEAR, wgl.LINEAR);
        var tempRGBTexture = wgl.buildTexture(wgl.RGBA, wgl.UNSIGNED_BYTE, sw, sh, null, wgl.CLAMP_TO_EDGE, wgl.CLAMP_TO_EDGE, wgl.NEAREST, wgl.NEAREST);
        var tempFramebuffer = wgl.createFramebuffer();
        wgl.framebufferTexture2D(tempFramebuffer, wgl.FRAMEBUFFER, wgl.COLOR_ATTACHMENT0, wgl.TEXTURE_2D, tempRGBTexture, 0);

        var NORMAL_SCALE = 7.0;
        var ROUGHNESS = 0.075;
        var DIFFUSE_SCALE = 0.15;
        var SPECULAR_SCALE = 0.5;
        var F0 = 0.05;
        var LIGHT_DIRECTION = [0, 1, 1];

        var paintingProgram = paint.colorModel === 0 ? paint.savePaintingProgram : paint.savePaintingProgramRGB;

        var saveDrawState = wgl.createDrawState()
            .bindFramebuffer(tempFramebuffer)
            .viewport(0, 0, sw, sh)
            .vertexAttribPointer(paint.quadVertexBuffer, paintingProgram.getAttribLocation('a_position'), 2, wgl.FLOAT, false, 0, 0)
            .useProgram(paintingProgram)
            .uniform2f('u_paintingSize', sw, sh)
            .uniform2f('u_paintingResolution', sw, sh)
            .uniform2f('u_screenResolution', sw, sh)
            .uniform2f('u_paintingPosition', 0, 0)
            .uniformTexture('u_paintTexture', 0, wgl.TEXTURE_2D, tempSelectTexture)
            .uniform1f('u_mirror', 0.0)
            .uniform1f('u_normalScale', NORMAL_SCALE / paint.resolutionScale)
            .uniform1f('u_roughness', ROUGHNESS)
            .uniform1f('u_diffuseScale', DIFFUSE_SCALE)
            .uniform1f('u_specularScale', SPECULAR_SCALE)
            .uniform1f('u_F0', F0)
            .uniform3f('u_lightDirection', LIGHT_DIRECTION[0], LIGHT_DIRECTION[1], LIGHT_DIRECTION[2]);

        wgl.drawArrays(saveDrawState, wgl.TRIANGLE_STRIP, 0, 4);

        var bytePixels = new Uint8Array(sw * sh * 4);
        wgl.readPixels(wgl.createReadState().bindFramebuffer(tempFramebuffer), 0, 0, sw, sh, wgl.RGBA, wgl.UNSIGNED_BYTE, bytePixels);

        wgl.deleteTexture(tempSelectTexture);
        wgl.deleteTexture(tempRGBTexture);
        wgl.deleteFramebuffer(tempFramebuffer);

        this.floatingCanvas = document.createElement('canvas');
        this.floatingCanvas.width = sw;
        this.floatingCanvas.height = sh;
        this.floatingCanvas.className = 'transform-canvas';
        var ctx = this.floatingCanvas.getContext('2d');

        var imageData = ctx.createImageData(sw, sh);
        imageData.data.set(bytePixels);
        ctx.putImageData(imageData, 0, 0);

        this.transformState = {
            nx: 0,
            ny: 0,
            scaleX: 1.0,
            scaleY: 1.0,
            rotation: 0.0
        };

        this.isTransformMode = true;
        this.createTransformUI();

        paint.currentTool = 'select';
        var selectBtn = document.getElementById('select-button');
        if (selectBtn) {
            var barButtons = document.querySelectorAll('.bar-btn');
            barButtons.forEach(btn => btn.classList.remove('tool-active'));
            selectBtn.classList.add('tool-active');
        }

        paint.needsRedraw = true;
    }

    update() {
        this.updateDOMSelectionBox();
        this.updateDOMTransformBox();
    }

    updateDOMSelectionBox() {
        if (!this.selectionOverlay) return;

        var paint = this.paint;

        if (this.selectionActive && !this.isTransformMode && paint.currentTool === 'select') {
            if (this.selectMode === 'lasso') {
                this.selectionOverlay.style.display = 'none';
                if (this.lassoCanvas) {
                    this.lassoCanvas.style.display = 'block';
                    this.lassoCanvas.width = paint.canvas.width;
                    this.lassoCanvas.height = paint.canvas.height;
                    
                    var ctx = this.lassoCanvas.getContext('2d');
                    ctx.clearRect(0, 0, this.lassoCanvas.width, this.lassoCanvas.height);
                    
                    if (this.lassoPoints && this.lassoPoints.length > 1) {
                        ctx.beginPath();
                        for (var i = 0; i < this.lassoPoints.length; i++) {
                            var p = this.lassoPoints[i];
                            var px = paint.paintingRectangle.left + p.x * paint.paintingRectangle.width;
                            var py = paint.paintingRectangle.bottom + p.y * paint.paintingRectangle.height;
                            
                            if (paint.isMirrored) {
                                px = paint.canvas.width - px;
                            }
                            
                            var screenX = px;
                            var screenY = paint.canvas.height - py;
                            
                            if (i === 0) {
                                ctx.moveTo(screenX, screenY);
                            } else {
                                ctx.lineTo(screenX, screenY);
                            }
                        }
                        
                        if (!this.isDrawingSelection) {
                            ctx.closePath();
                        }
                        
                        ctx.strokeStyle = '#0055ff';
                        ctx.lineWidth = 1.5;
                        ctx.setLineDash([4, 4]);
                        ctx.stroke();
                    }
                }
            } else {
                if (this.lassoCanvas) {
                    this.lassoCanvas.style.display = 'none';
                }
                var left = paint.paintingRectangle.left + this.selX1 * paint.paintingRectangle.width;
                var bottom = paint.paintingRectangle.bottom + this.selY1 * paint.paintingRectangle.height;
                var width = (this.selX2 - this.selX1) * paint.paintingRectangle.width;
                var height = (this.selY2 - this.selY1) * paint.paintingRectangle.height;

                var cssTop = paint.canvas.height - (bottom + height);

                var screenLeft = left;
                if (paint.isMirrored) {
                    screenLeft = paint.canvas.width - left - width;
                }

                this.selectionOverlay.style.left = screenLeft + 'px';
                this.selectionOverlay.style.top = cssTop + 'px';
                this.selectionOverlay.style.width = width + 'px';
                this.selectionOverlay.style.height = height + 'px';
                this.selectionOverlay.style.display = 'block';
            }
        } else {
            this.selectionOverlay.style.display = 'none';
            if (this.lassoCanvas) {
                this.lassoCanvas.style.display = 'none';
            }
        }
    }

    updateDOMTransformBox() {
        if (!this.transformContainer || !this.isTransformMode) return;

        var paint = this.paint;
        var zoom = paint.zoomLevel || 1.0;

        // Position center of transform relative to original selection bounding box
        var left = paint.paintingRectangle.left + this.selX1 * paint.paintingRectangle.width;
        var bottom = paint.paintingRectangle.bottom + this.selY1 * paint.paintingRectangle.height;
        var width = (this.selX2 - this.selX1) * paint.paintingRectangle.width;
        var height = (this.selY2 - this.selY1) * paint.paintingRectangle.height;

        // Apply visual scale and rotation
        var scaleX = paint.isMirrored ? -this.transformState.scaleX : this.transformState.scaleX;
        var scaleY = this.transformState.scaleY;
        var rot = this.transformState.rotation;

        var currentW = Math.round(width * Math.abs(scaleX));
        var currentH = Math.round(height * Math.abs(scaleY));

        // Center of the unscaled selection box in screen coordinates
        var centerX = left + width / 2 + this.transformState.nx * paint.paintingRectangle.width;
        if (paint.isMirrored) {
            centerX = paint.canvas.width - centerX;
        }
        var centerY = paint.canvas.height - (bottom + height / 2) + this.transformState.ny * paint.paintingRectangle.height;

        var cssLeft = Math.round(centerX - currentW / 2);
        var cssTop = Math.round(centerY - currentH / 2);

        this.transformContainer.style.left = cssLeft + 'px';
        this.transformContainer.style.top = cssTop + 'px';
        this.transformContainer.style.width = currentW + 'px';
        this.transformContainer.style.height = currentH + 'px';
        this.transformContainer.style.transform = `rotate(${rot}rad)`;

        if (this.floatingCanvas) {
            this.floatingCanvas.style.transform = `scale(${scaleX < 0 ? -1 : 1}, ${scaleY < 0 ? -1 : 1})`;
        }
    }

    handleMouseDown(mouseX, mouseY) {
        if (this.isTransformMode) return; // Ignore drawing selection when active transform

        var paint = this.paint;
        this.isDrawingSelection = true;
        this.selectionActive = true;

        // Convert starting screen coordinate to [0, 1] normalized texture coordinate
        var normX = (mouseX - paint.paintingRectangle.left) / paint.paintingRectangle.width;
        var normY = (mouseY - paint.paintingRectangle.bottom) / paint.paintingRectangle.height;

        this.startNormalizedX = Math.max(0, Math.min(1, normX));
        this.startNormalizedY = Math.max(0, Math.min(1, normY));

        if (this.selectMode === 'lasso') {
            this.lassoPoints = [{ x: this.startNormalizedX, y: this.startNormalizedY }];
            this.selX1 = this.startNormalizedX;
            this.selY1 = this.startNormalizedY;
            this.selX2 = this.startNormalizedX;
            this.selY2 = this.startNormalizedY;
        } else {
            this.selX1 = this.startNormalizedX;
            this.selY1 = this.startNormalizedY;
            this.selX2 = this.startNormalizedX;
            this.selY2 = this.startNormalizedY;
        }

        this.update();
    }

    handleMouseMove(mouseX, mouseY) {
        if (!this.isDrawingSelection) return;

        var paint = this.paint;
        var normX = (mouseX - paint.paintingRectangle.left) / paint.paintingRectangle.width;
        var normY = (mouseY - paint.paintingRectangle.bottom) / paint.paintingRectangle.height;

        normX = Math.max(0, Math.min(1, normX));
        normY = Math.max(0, Math.min(1, normY));

        if (this.selectMode === 'lasso') {
            this.lassoPoints.push({ x: normX, y: normY });
            
            // Recompute bounding box of lasso points
            var minX = 1.0, maxX = 0.0, minY = 1.0, maxY = 0.0;
            for (var i = 0; i < this.lassoPoints.length; i++) {
                var p = this.lassoPoints[i];
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            }
            this.selX1 = minX;
            this.selY1 = minY;
            this.selX2 = maxX;
            this.selY2 = maxY;
        } else {
            this.selX1 = Math.min(this.startNormalizedX, normX);
            this.selY1 = Math.min(this.startNormalizedY, normY);
            this.selX2 = Math.max(this.startNormalizedX, normX);
            this.selY2 = Math.max(this.startNormalizedY, normY);
        }

        this.update();
    }

    handleMouseUp() {
        if (!this.isDrawingSelection) return;
        this.isDrawingSelection = false;

        // If selection is too tiny, deactivate it
        if ((this.selX2 - this.selX1) < 0.002 || (this.selY2 - this.selY1) < 0.002) {
            this.selectionActive = false;
            this.lassoPoints = [];
        }

        this.update();
    }
}
