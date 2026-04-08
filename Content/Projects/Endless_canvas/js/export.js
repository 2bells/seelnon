import { state } from 'app/state.js';
import {
    drawBackgroundPattern,
} from 'app/canvas.js'; // Keep drawBackgroundPattern from canvas.js

// Import drawing utilities
import { hexToRgba, getPolygonPathData } from 'app/utils/drawing.js';
// Import d3-delaunay
import { Delaunay } from 'd3-delaunay';

// Import brush drawing functions for export
import { drawPenStroke } from 'app/brush/pen.js';
import { drawWireframeStroke } from 'app/brush/wireframe.js';
import { drawPixelStroke } from 'app/brush/pixel.js';
import { drawSketchyStroke, drawAnimatedSketchyStroke } from 'app/brush/sketchy.js';


// This function will be called from canvas.js to render strokes on an offscreen canvas for PNG export
// It's a simplified version of the main draw loop
function renderStrokesToContext(context, strokes, worldBounds, targetWidth, targetHeight) {
    
    // Calculate scale and offset to fit worldBounds into the target dimensions
    const scaleX = targetWidth / worldBounds.width;
    const scaleY = targetHeight / worldBounds.height;
    const exportScale = Math.min(scaleX, scaleY); // This is the effective 'zoom' for drawing lines on the export canvas

    // The entire drawing needs to be scaled and translated to fit the export canvas.
    // The drawing functions themselves operate in world coordinates, so the context handles the transformation.
    context.save();
    context.fillStyle = state.canvasSettings.backgroundColor;
    context.fillRect(0, 0, targetWidth, targetHeight);

    // Apply transformations to center and scale the worldBounds within the target canvas
    context.translate((targetWidth - worldBounds.width * exportScale) / 2, (targetHeight - worldBounds.height * exportScale) / 2);
    context.scale(exportScale, exportScale);
    context.translate(-worldBounds.x, -worldBounds.y);

    // Draw background pattern for the exported area
    drawBackgroundPattern(context, state.canvasSettings.backgroundType, state.canvasSettings.backgroundSpacing, 
                          worldBounds.x, worldBounds.y, worldBounds.width, worldBounds.height, exportScale);

    // Draw all strokes
    strokes.forEach(stroke => {
        // Dispatch based on stroke type, passing exportScale for line widths if needed.
        // For export, we don't use 'isPreview' or cached bitmaps; we draw fresh geometry.
        switch (stroke.type) {
            case 'wireframe':
                // For export, treat as not preview, as it's a final render.
                // The `stroke.wireframeIsClosed` property will be used by drawWireframeStroke.
                drawWireframeStroke(context, stroke, exportScale, false); 
                break;
            case 'pixel':
                drawPixelStroke(context, stroke); // Pixel brush doesn't use targetScale for line width
                break;
            case 'sketchy':
                drawSketchyStroke(context, stroke); // Sketchy also doesn't rely on lineWidth for its jittered passes
                break;
            case 'sketchy-animated':
                drawAnimatedSketchyStroke(context, stroke); // Animated sketchy also doesn't rely on lineWidth
                break;
            case 'pen':
            default:
                // For pen, we call drawPenStroke, passing the exportScale.
                // isPreview=false as this is a final render for export.
                drawPenStroke(context, stroke, false, exportScale); 
                break;
        }
    });

    context.restore();
}

function exportPNG(width, height, worldBounds) {
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const offscreenCtx = offscreenCanvas.getContext('2d');

    // Filter strokes to only include those within the bounds
    const strokesToRender = state.strokes.filter(stroke => {
        // Simple bounding box check for performance
        // If stroke.bounds is not available, we assume it needs to be rendered.
        if (!stroke.bounds) return true; 

        const { minX, minY, maxX, maxY } = stroke.bounds;
        // Check for overlap with worldBounds
        return maxX > worldBounds.x && minX < worldBounds.x + worldBounds.width &&
               maxY > worldBounds.y && minY < worldBounds.y + worldBounds.height;
    });

    renderStrokesToContext(offscreenCtx, strokesToRender, worldBounds, width, height);
    
    const dataUrl = offscreenCanvas.toDataURL('image/png');
    downloadData(dataUrl, 'canvas-export.png');
}

function exportSVG(worldBounds) {
    let svgPaths = '';

    // Filter strokes to only include those within the bounds
     const strokesToRender = state.strokes.filter(stroke => {
        // If stroke.bounds is not available, we assume it needs to be rendered.
        if (!stroke.bounds) return true;

        const { minX, minY, maxX, maxY } = stroke.bounds;
        return maxX > worldBounds.x && minX < worldBounds.x + worldBounds.width &&
               maxY > worldBounds.y && minY < worldBounds.y + worldBounds.height;
    });

    strokesToRender.forEach(stroke => {
        if (stroke.points.length < 1) return;

        let pathData = '';
        let fillOpacity = stroke.opacity;

        switch (stroke.type) {
            case 'wireframe':
                // For SVG export, always use the original points, not animated ones.
                const wireframePoints = stroke.points; 

                // Draw single point or line for SVG if not enough for triangulation
                if (wireframePoints.length < 3) {
                     if (wireframePoints.length === 1 && (stroke.wireframePointRadius || 0) > 0) {
                        const p = wireframePoints[0];
                        svgPaths += `<circle cx="${p.x}" cy="${p.y}" r="${(stroke.wireframePointRadius || 0) / 2}" fill="${stroke.wireframePointColor || stroke.color}" fill-opacity="${stroke.opacity * (stroke.wireframePointOpacity || 1.0)}" />\n`;
                    } else if (wireframePoints.length === 2) {
                        const p1 = wireframePoints[0];
                        const p2 = wireframePoints[1];
                        // Apply hull thickness factor for short lines in open wireframe mode
                        const baseSize = wireframePoints[0].size; // Use the base brush size for calculation
                        const thickness = (stroke.wireframeIsClosed === false ? baseSize * (stroke.wireframeHullLineThickness || 1.0) : stroke.wireframeMeshLineThickness || 1.0);
                        svgPaths += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${stroke.color}" stroke-opacity="${stroke.opacity * (stroke.wireframeLineOpacity || 0.8)}" stroke-width="${Math.max(0.5, thickness)}" />\n`;
                    }
                    return; // Skip full wireframe logic if not enough points
                }

                const delaunayData = wireframePoints.map(p => [p.x, p.y]);
                const delaunay = Delaunay.from(delaunayData);

                // Triangles for fill - only if wireframeIsClosed is true
                if (stroke.wireframeIsClosed !== false) {
                    const triangles = delaunay.trianglePolygons(); // This gives an array of [ [x,y], [x,y], [x,y] ] for each triangle
                    for (const triangle of triangles) {
                        svgPaths += `<polygon points="${triangle.map(p => p.join(',')).join(' ')}" fill="${hexToRgba(stroke.color, stroke.opacity * (stroke.wireframeMeshOpacity || 0.1))}" />\n`;
                    }
                }

                // Mesh lines (edges of the Delaunay triangulation)
                const meshEdgesPath = [];
                const meshEdgesIndividualLines = []; // For gradient mesh

                // Apply max mesh length logic for SVG too
                if (stroke.wireframeMaxMeshLength !== Infinity && (stroke.wireframeMaxMeshLength || 0) > 0) {
                     for (let i = 0; i < delaunay.halfedges.length; ++i) {
                        const j = delaunay.halfedges[i];
                        if (j < i) continue;

                        const p0_idx = delaunay.triangles[i];
                        const p1_idx = delaunay.triangles[j];
                        const p0x = delaunayData[p0_idx][0];
                        const p0y = delaunayData[p0_idx][1];
                        const p1x = delaunayData[p1_idx][0];
                        const p1y = delaunayData[p1_idx][1];

                        const length = Math.hypot(p1x - p0x, p1y - p0y);
                        if (length <= stroke.wireframeMaxMeshLength) {
                            if (stroke.wireframeGradientMesh) {
                                // Calculate gradient thickness
                                const minRenderedThickness = stroke.wireframeMeshLineThickness || 1.0;
                                const gradientBoostFactor = stroke.wireframeGradientMeshBoostFactor || 2.0;
                                const maxAddedThickness = minRenderedThickness * gradientBoostFactor; // Max added thickness is a factor of base thickness
                                const lengthRatio = length / stroke.wireframeMaxMeshLength;
                                const clampedLengthRatio = Math.min(1, Math.max(0, lengthRatio));
                                const addedThickness = maxAddedThickness * (1 - clampedLengthRatio);
                                const finalThickness = minRenderedThickness + addedThickness;
                                meshEdgesIndividualLines.push(`<line x1="${p0x}" y1="${p0y}" x2="${p1x}" y2="${p1y}" stroke="${hexToRgba(stroke.color, stroke.opacity * (stroke.wireframeLineOpacity || 0.8))}" stroke-width="${finalThickness}" />`);
                            } else {
                                meshEdgesPath.push(`M${p0x},${p0y}L${p1x},${p1y}`);
                            }
                        }
                    }
                } else {
                    // Original d3-delaunay logic if no max length constraint
                    // For SVG, we cannot apply variable thickness to a single path, so always draw as individual lines
                    // or single path with uniform thickness.
                    if (stroke.wireframeGradientMesh) {
                        // If no maxMeshLength, gradient mesh doesn't make sense as there's no reference length.
                        // Fallback to uniform thickness.
                        for (let i = 0; i < delaunay.triangles.length; i += 3) {
                            const p0_idx = delaunay.triangles[i];
                            const p1_idx = delaunay.triangles[i+1];
                            const p2_idx = delaunay.triangles[i+2];

                            const p0 = delaunayData[p0_idx];
                            const p1 = delaunayData[p1_idx];
                            const p2 = delaunayData[p2_idx];

                            meshEdgesIndividualLines.push(`<line x1="${p0[0]}" y1="${p0[1]}" x2="${p1[0]}" y2="${p1[1]}" stroke="${hexToRgba(stroke.color, stroke.opacity * (stroke.wireframeLineOpacity || 0.8))}" stroke-width="${(stroke.wireframeMeshLineThickness || 1.0)}" />`);
                            meshEdgesIndividualLines.push(`<line x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}" stroke="${hexToRgba(stroke.color, stroke.opacity * (stroke.wireframeLineOpacity || 0.8))}" stroke-width="${(stroke.wireframeMeshLineThickness || 1.0)}" />`);
                            meshEdgesIndividualLines.push(`<line x1="${p2[0]}" y1="${p2[1]}" x2="${p0[0]}" y2="${p0[1]}" stroke="${hexToRgba(stroke.color, stroke.opacity * (stroke.wireframeLineOpacity || 0.8))}" stroke-width="${(stroke.wireframeMeshLineThickness || 1.0)}" />`);
                        }
                    } else {
                        // Original d3-delaunay logic if no max length constraint and no gradient mesh
                        for (let i = 0; i < delaunay.triangles.length; i += 3) {
                            const p0 = delaunay.points.slice(delaunay.triangles[i] * 2, delaunay.triangles[i] * 2 + 2);
                            const p1 = delaunay.points.slice(delaunay.triangles[i+1] * 2, delaunay.triangles[i+1] * 2 + 2);
                            const p2 = delaunay.points.slice(delaunay.triangles[i+2] * 2, delaunay.triangles[i+2] * 2 + 2);

                            meshEdgesPath.push(`M${p0[0]},${p0[1]}L${p1[0]},${p1[1]}`);
                            meshEdgesPath.push(`M${p1[0]},${p1[1]}L${p2[0]},${p2[1]}`);
                            meshEdgesPath.push(`M${p2[0]},${p2[1]}L${p0[0]},${p0[1]}`);
                        }
                    }
                }

                if (meshEdgesIndividualLines.length > 0) {
                     svgPaths += meshEdgesIndividualLines.join('\n');
                } else if (meshEdgesPath.length > 0) {
                     svgPaths += `<path d="${meshEdgesPath.join('')}" stroke="${hexToRgba(stroke.color, stroke.opacity * (stroke.wireframeLineOpacity || 0.8))}" stroke-width="${(stroke.wireframeMeshLineThickness || 1.0)}" fill="none" />\n`;
                }
                
                // Hull lines - if wireframeIsClosed is true, it's drawn by delaunay.renderHull.
                // If wireframeIsClosed is false, it's drawn as a polygon path (variable width).
                if (stroke.wireframeIsClosed !== false) {
                    const hullPathData = delaunay.renderHull(); // This returns an SVG path string like "M x,y L x,y ..."
                    svgPaths += `<path d="${hullPathData}" stroke="${hexToRgba(stroke.color, stroke.opacity * (stroke.wireframeLineOpacity || 0.8))}" stroke-width="${(stroke.wireframeHullLineThickness || 5.0)}" fill="none" />\n`;
                } else {
                    // For open wireframe, the hull is a variable width polygon,
                    // which uses `getPolygonPathData` with dynamic `p.size` and `p.pressure`.
                    // The `stroke.wireframeHullLineThickness` acts as the base `p.size`.
                    const hullPointsForPolygon = wireframePoints.map(p => ({
                        x: p.x,
                        y: p.y,
                        pressure: p.pressure, // Use actual pressure from the stroke point
                        size: p.size * (stroke.wireframeHullLineThickness || 1.0) // Use the dedicated hull thickness as a factor of base size
                    }));
                    const dynamicHullPathData = getPolygonPathData({
                        points: hullPointsForPolygon,
                        minSizeFactor: stroke.minSizeFactor, // Use the actual stroke's minSizeFactor
                        tipShape: stroke.tipShape // Not strictly needed for polygon path data, but good to include
                    });
                    svgPaths += `<path d="${dynamicHullPathData}" fill="${hexToRgba(stroke.color, stroke.opacity * (stroke.wireframeLineOpacity || 0.8))}" />\n`;

                    // If tip shape is round for open wireframe hull, add circles for caps (similar to pen)
                    if (stroke.tipShape === 'round' && hullPointsForPolygon.length > 0) {
                        const firstPoint = hullPointsForPolygon[0];
                        const lastPoint = hullPointsForPolygon[hullPointsForPolygon.length - 1];
                        let firstWidth = Math.max(0.5, firstPoint.size * stroke.minSizeFactor + (firstPoint.size - firstPoint.size * stroke.minSizeFactor) * (firstPoint.pressure || 1.0));
                        let lastWidth = Math.max(0.5, lastPoint.size * stroke.minSizeFactor + (lastPoint.size - lastPoint.size * stroke.minSizeFactor) * (lastPoint.pressure || 1.0));
                        
                        svgPaths += `<circle cx="${firstPoint.x}" cy="${firstPoint.y}" r="${firstWidth/2}" fill="${hexToRgba(stroke.color, stroke.opacity * (stroke.wireframeLineOpacity || 0.8))}" />\n`;
                        if (hullPointsForPolygon.length > 1) {
                            svgPaths += `<circle cx="${lastPoint.x}" cy="${lastPoint.y}" r="${lastWidth/2}" fill="${hexToRgba(stroke.color, stroke.opacity * (stroke.wireframeLineOpacity || 0.8))}" />\n`;
                        }
                    }
                }

                // Draw points if radius > 0
                if ((stroke.wireframePointRadius || 0) > 0) {
                    wireframePoints.forEach(p => {
                        svgPaths += `<circle cx="${p.x}" cy="${p.y}" r="${(stroke.wireframePointRadius || 0) / 2}" fill="${stroke.wireframePointColor || stroke.color}" fill-opacity="${stroke.opacity * (stroke.wireframePointOpacity || 1.0)}" />\n`;
                    });
                }
                break;

            case 'pixel':
                const pixelSize = stroke.pixelSize;
                const drawnCells = new Set();
                const rects = [];

                function addPixelRect(gridX, gridY) {
                    const key = `${gridX},${gridY}`;
                    if (!drawnCells.has(key)) {
                        rects.push(`<rect x="${gridX * pixelSize}" y="${gridY * pixelSize}" width="${pixelSize}" height="${pixelSize}" />`);
                        drawnCells.add(key);
                    }
                }

                // Bresenham's line algorithm to fill cells between points
                function drawLine(x0, y0, x1, y1) {
                    const dx = Math.abs(x1 - x0);
                    const dy = -Math.abs(y1 - y0);
                    const sx = x0 < x1 ? 1 : -1;
                    const sy = y0 < y1 ? 1 : -1;
                    let err = dx + dy;

                    while (true) {
                        addPixelRect(x0, y0);
                        if (x0 === x1 && y0 === y1) break;
                        let e2 = 2 * err;
                        if (e2 >= dy) {
                            err += dy;
                            x0 += sx;
                        }
                        if (e2 <= dx) {
                            err += dx;
                            y0 += sy;
                        }
                    }
                }

                for (let i = 0; i < stroke.points.length; i++) {
                    const p = stroke.points[i];
                    const gridX = Math.floor(p.x / pixelSize);
                    const gridY = Math.floor(p.y / pixelSize);

                    if (i > 0) {
                        const prevP = stroke.points[i-1];
                        const prevGridX = Math.floor(prevP.x / pixelSize);
                        const prevGridY = Math.floor(prevP.y / pixelSize);
                        drawLine(prevGridX, prevGridY, gridX, gridY);
                    } else {
                        addPixelRect(gridX, gridY);
                    }
                }
                svgPaths += `<g fill="${stroke.color}" fill-opacity="${fillOpacity}">${rects.join('')}</g>\n`;
                return; // Skip default path for pixel
            
            case 'sketchy':
            case 'sketchy-animated':
                // For SVG, we cannot easily animate a sketchy brush or apply random jitter per pass.
                // We will render a single, solid version of the stroke using the polygon method.
                pathData = getPolygonPathData(stroke);
                svgPaths += `<path d="${pathData}" fill="${stroke.color}" fill-opacity="${stroke.opacity}" />\n`;
                return; // Skip default path for sketchy
            
            case 'pen':
            default:
                if (stroke.nonCompoundingOpacity) {
                    pathData = getPolygonPathData(stroke);
                    svgPaths += `<path d="${pathData}" fill="${stroke.color}" fill-opacity="${stroke.opacity}" />\n`;
                    // If tip shape is round, add circles for caps
                    if (stroke.tipShape === 'round') {
                        const firstPoint = stroke.points[0];
                        const lastPoint = stroke.points[stroke.points.length - 1];
                        let firstWidth = Math.max(0.5, firstPoint.size * stroke.minSizeFactor + (firstPoint.size - firstPoint.size * stroke.minSizeFactor) * (firstPoint.pressure || 1.0));
                        let lastWidth = Math.max(0.5, lastPoint.size * stroke.minSizeFactor + (lastPoint.size - lastPoint.size * stroke.minSizeFactor) * (lastPoint.pressure || 1.0));
                        
                        svgPaths += `<circle cx="${firstPoint.x}" cy="${firstPoint.y}" r="${firstWidth/2}" fill="${stroke.color}" fill-opacity="${stroke.opacity}" />\n`;
                        if (stroke.points.length > 1) {
                            svgPaths += `<circle cx="${lastPoint.x}" cy="${lastPoint.y}" r="${lastWidth/2}" fill="${stroke.color}" fill-opacity="${stroke.opacity}" />\n`;
                        }
                    }
                } else {
                    // Approximate the quadratic bezier curves for SVG
                    pathData = `M ${stroke.points[0].x} ${stroke.points[0].y} `;
                    for (let i = 1; i < stroke.points.length - 1; i++) {
                        const p2 = stroke.points[i];
                        const p3 = stroke.points[i + 1];
                        // Quadratic Bezier segment (approximating with midpoint control points)
                        pathData += `Q ${p2.x} ${p2.y}, ${(p2.x + p3.x) / 2} ${(p2.y + p3.y) / 2} `;
                    }
                    const lastPoint = stroke.points[stroke.points.length - 1];
                    pathData += `L ${lastPoint.x} ${lastPoint.y}`;

                    // SVG stroke-width for variable width is complex. For simplicity, use average or first point size.
                    const averageSize = stroke.points.reduce((acc, p) => acc + p.size, 0) / stroke.points.length;
                    svgPaths += `<path d="${pathData}" fill="none" stroke="${stroke.color}" stroke-opacity="${fillOpacity}" stroke-width="${averageSize}" stroke-linecap="${stroke.tipShape}" stroke-linejoin="${stroke.tipShape}" />\n`;
                }
                break;
        }
    });

    // Generate SVG background for pattern if applicable
    let svgBackgroundPattern = '';
    const bgSpacing = state.canvasSettings.backgroundSpacing;
    const bgPatternColor = hexToRgba('000000', 0.1); // Using hexToRgba for consistency

    // Simple implementation for SVG patterns - not as dynamic as canvas, but functional.
    if (state.canvasSettings.backgroundType === 'dots') {
        svgBackgroundPattern = `<pattern id="dotPattern" x="0" y="0" width="${bgSpacing}" height="${bgSpacing}" patternUnits="userSpaceOnUse">
            <circle cx="${bgSpacing/2}" cy="${bgSpacing/2}" r="${2/1}" fill="${bgPatternColor}" />
        </pattern>`;
    } else if (state.canvasSettings.backgroundType === 'grid') {
        svgBackgroundPattern = `<pattern id="gridPattern" x="0" y="0" width="${bgSpacing}" height="${bgSpacing}" patternUnits="userSpaceOnUse">
            <path d="M ${bgSpacing} 0 L 0 0 L 0 ${bgSpacing}" fill="none" stroke="${bgPatternColor}" stroke-width="1" />
        </pattern>`;
    } else if (state.canvasSettings.backgroundType === 'horizontal') {
        svgBackgroundPattern = `<pattern id="horizontalPattern" x="0" y="0" width="${bgSpacing}" height="${bgSpacing}" patternUnits="userSpaceOnUse">
            <line x1="0" y1="${bgSpacing/2}" x2="${bgSpacing}" y2="${bgSpacing/2}" stroke="${bgPatternColor}" stroke-width="1" />
        </pattern>`;
    } else if (state.canvasSettings.backgroundType === 'vertical') {
        svgBackgroundPattern = `<pattern id="verticalPattern" x="0" y="0" width="${bgSpacing}" height="${bgSpacing}" patternUnits="userSpaceOnUse">
            <line x1="${bgSpacing/2}" y1="0" x2="${bgSpacing/2}" y2="${bgSpacing}" stroke="${bgPatternColor}" stroke-width="1" />
        </pattern>`;
    }


    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${worldBounds.x} ${worldBounds.y} ${worldBounds.width} ${worldBounds.height}">
        <defs>${svgBackgroundPattern}</defs>
        <rect x="${worldBounds.x}" y="${worldBounds.y}" width="${worldBounds.width}" height="${worldBounds.height}" fill="${state.canvasSettings.backgroundColor}" />
        ${state.canvasSettings.backgroundType !== 'none' ? `<rect x="${worldBounds.x}" y="${worldBounds.y}" width="${worldBounds.width}" height="${worldBounds.height}" fill="url(#${state.canvasSettings.backgroundType}Pattern)" />` : ''}
        ${svgPaths}
    </svg>`;

    const svgBlob = new Blob([svgContent], {type: 'image/svg+xml;charset=utf-8'});
    const svgUrl = URL.createObjectURL(svgBlob);
    downloadData(svgUrl, 'canvas-export.svg');
    URL.revokeObjectURL(svgUrl);
}

function downloadData(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function init() {
    const modal = document.getElementById('export-modal');
    const openBtn = document.getElementById('export-btn');
    const closeBtn = document.getElementById('close-export-modal');
    const exportBtn = document.getElementById('trigger-export-btn');

    const formatSelect = document.getElementById('export-format');
    const pngOptions = document.getElementById('png-options');
    const svgOptions = document.getElementById('svg-options');
    const areaSelect = document.getElementById('export-area');

    const widthInput = document.getElementById('export-width');
    const heightInput = document.getElementById('export-height');
    const aspectRatioToggle = document.getElementById('export-aspect-ratio');
    let aspectRatio = 16 / 9; // Default to common aspect ratio

    // Function to update export dimensions based on selected area and aspect ratio
    function updateExportDimensions(source = 'initial') {
        const canvas = document.getElementById('drawing-canvas');
        
        let targetWorldWidth, targetWorldHeight;

        if (areaSelect.value === 'selection' && state.selection && state.selection.width > 0 && state.selection.height > 0) {
            aspectRatio = state.selection.width / state.selection.height;
            targetWorldWidth = state.selection.width;
            targetWorldHeight = state.selection.height;
        } else { // viewport
            aspectRatio = canvas.width / canvas.height;
            targetWorldWidth = canvas.width / state.zoom;
            targetWorldHeight = canvas.height / state.zoom;
        }

        // Set initial pixel dimensions based on target world dimensions at a reasonable scale
        // Only update initial width/height if it's the first time opening or if switching area.
        // If user manually typed a value, don't override unless aspect ratio is checked.
        if (source === 'initial' || source === 'areaChange') {
            const defaultPxWidth = 1920; // Maintain a standard default export width
            const defaultPxHeight = Math.round(defaultPxWidth / aspectRatio);

            widthInput.value = defaultPxWidth;
            heightInput.value = defaultPxHeight;
        }

        if (aspectRatioToggle.checked) {
            // If aspect ratio is checked, always enforce it based on the current width input.
            heightInput.value = Math.round(parseInt(widthInput.value, 10) / aspectRatio);
        }
    }

    openBtn.addEventListener('click', () => {
        modal.classList.remove('hidden');

        // Make sure the selection option is enabled/disabled correctly
        const selectionOption = areaSelect.querySelector('option[value="selection"]');
        if (state.selection && state.selection.width > 0 && state.selection.height > 0) {
            selectionOption.disabled = false;
        } else {
            selectionOption.disabled = true;
            if (areaSelect.value === 'selection') {
                areaSelect.value = 'viewport'; // Fallback to viewport if no valid selection
            }
        }
        updateExportDimensions('initial'); // Adjust width/height based on selected area and aspect ratio
    });
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

    formatSelect.addEventListener('change', () => {
        if (formatSelect.value === 'png') {
            pngOptions.classList.remove('hidden');
            svgOptions.classList.add('hidden');
        } else {
            pngOptions.classList.add('hidden');
            svgOptions.classList.remove('hidden');
        }
    });

    areaSelect.addEventListener('change', () => updateExportDimensions('areaChange')); // Listen for area changes
    aspectRatioToggle.addEventListener('change', () => updateExportDimensions('toggleChange')); // Listen for toggle changes

    widthInput.addEventListener('input', () => {
        if (aspectRatioToggle.checked) {
            heightInput.value = Math.round(widthInput.value / aspectRatio);
        }
    });
    heightInput.addEventListener('input', () => {
        if (aspectRatioToggle.checked) {
            widthInput.value = Math.round(heightInput.value * aspectRatio);
        }
    });

    exportBtn.addEventListener('click', () => {
        const format = formatSelect.value;
        const area = areaSelect.value;
        
        let worldBounds;
        const canvas = document.getElementById('drawing-canvas');

        if (area === 'selection' && state.selection) {
            worldBounds = state.selection;
        } else { // viewport
            worldBounds = {
                x: -state.panOffset.x / state.zoom,
                y: -state.panOffset.y / state.zoom,
                width: canvas.width / state.zoom,
                height: canvas.height / state.zoom
            };
        }
        
        if (format === 'png') {
            const width = parseInt(widthInput.value, 10);
            const height = parseInt(heightInput.value, 10);
            if (width > 0 && height > 0) {
                exportPNG(width, height, worldBounds);
            }
        } else if (format === 'svg') {
            exportSVG(worldBounds);
        }

        modal.classList.add('hidden');
    });
}
