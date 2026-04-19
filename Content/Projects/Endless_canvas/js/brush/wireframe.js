import { Delaunay } from "https://cdn.skypack.dev/d3-delaunay@6";
import { hexToRgba, drawVariableWidthStrokePolygon } from '../utils/drawing.js';

export function drawWireframeStroke(context, stroke, targetScale = 1, isPreview = false) {
    if (stroke.points.length < 3) {
        // Not enough points for a triangle, draw a line for preview or a dot
        if (stroke.points.length === 1 && (stroke.wireframePointRadius || 0) > 0) {
             const p = stroke.points[0];
             context.fillStyle = hexToRgba(stroke.wireframePointColor || stroke.color, stroke.opacity * (stroke.wireframePointOpacity || 1.0));
             context.beginPath();
             context.arc(p.x, p.y, Math.max(0.5, stroke.wireframePointRadius) / 2, 0, Math.PI * 2);
             context.fill();
        } else if (stroke.points.length === 2) {
            // Draw a simple line for short previews
            context.beginPath();
            context.moveTo(stroke.points[0].x, stroke.points[0].y);
            context.lineTo(stroke.points[1].x, stroke.points[1].y);
            context.strokeStyle = hexToRgba(stroke.color, stroke.opacity * (stroke.wireframeLineOpacity || 0.8));
             // Use hull thickness factor * brush size for these simple lines if wireframeIsClosed is false, otherwise mesh thickness
             const baseSize = stroke.points[0].size; // Use the base brush size for calculation
             const thickness = (stroke.wireframeIsClosed === false ? baseSize * (stroke.wireframeHullLineThickness || 1.0) : stroke.wireframeMeshLineThickness || 1.0);
             context.lineWidth = Math.max(0.5, thickness);
             context.stroke();
        }
        return;
    }

    let pointsToDraw = stroke.points;

    // Apply animation (jiggle) only if NOT in preview mode AND animation is enabled
    if (!isPreview && (stroke.wireframeAnimationSpeed || 0) > 0) {
        // Generate animated points based on speed
        const now = performance.now();
        if (!stroke.lastAnimationTime || now - stroke.lastAnimationTime > stroke.wireframeAnimationSpeed) {
             stroke.animatedPoints = stroke.points.map(p => ({
                x: p.x + (Math.random() - 0.5) * (stroke.wireframeAnimationAmount || 0),
                y: p.y + (Math.random() - 0.5) * (stroke.wireframeAnimationAmount || 0),
                pressure: p.pressure,
                size: p.size
            }));
            stroke.lastAnimationTime = now;
            stroke.needsDelaunayUpdate = true; // Flag for delaunay update
        }
        pointsToDraw = stroke.animatedPoints || stroke.points;
    }

    // --- Performance Optimization: Cache Delaunay Triangulation ---
    if (!stroke.cachedDelaunay || stroke.needsDelaunayUpdate || isPreview) {
        stroke.cachedDelaunayPoints = pointsToDraw.map(p => [p.x, p.y]);
        stroke.cachedDelaunay = Delaunay.from(stroke.cachedDelaunayPoints);
        stroke.needsDelaunayUpdate = false;
    }
    
    const delaunayPoints = stroke.cachedDelaunayPoints;
    const delaunay = stroke.cachedDelaunay;

    if (stroke.wireframeIsClosed !== false) { // Default to true if property is missing
        // --- Logic for CLOSED wireframe (original behavior) ---
        // Fill triangles with controlled opacity
        context.fillStyle = hexToRgba(stroke.color, stroke.opacity * (stroke.wireframeMeshOpacity || 0.1));
        const triangles = delaunay.trianglePolygons();
        for (const triangle of triangles) {
            context.beginPath();
            context.moveTo(triangle[0][0], triangle[0][1]);
            context.lineTo(triangle[1][0], triangle[1][1]);
            context.lineTo(triangle[2][0], triangle[2][1]);
            context.closePath();
            context.fill();
        }

        // Draw Delaunay mesh lines (internal connections)
        context.strokeStyle = hexToRgba(stroke.color, stroke.opacity * (stroke.wireframeLineOpacity || 0.8));
        
        context.beginPath();
        // Check for max mesh length
        if (stroke.wireframeMaxMeshLength !== Infinity && (stroke.wireframeMaxMeshLength || 0) > 0) {
            // Apply gradient mesh thickness logic if enabled
            if (stroke.wireframeGradientMesh) {
                const baseSize = stroke.size || 10.0;
                const minRenderedThickness = baseSize * (stroke.wireframeMeshLineThickness || 1.0) / 10.0;
                const gradientBoostFactor = stroke.wireframeGradientMeshBoostFactor || 2.0;
                const maxAddedThickness = minRenderedThickness * gradientBoostFactor; // Max added thickness is a factor of base thickness

                for (let i = 0; i < delaunay.halfedges.length; ++i) {
                    const j = delaunay.halfedges[i];
                    if (j < i) continue; // Only draw each edge once

                    const p0_idx = delaunay.triangles[i];
                    const p1_idx = delaunay.triangles[j];
                    const p0x = delaunayPoints[p0_idx][0];
                    const p0y = delaunayPoints[p0_idx][1];
                    const p1x = delaunayPoints[p1_idx][0];
                    const p1y = delaunayPoints[p1_idx][1];

                    const length = Math.hypot(p1x - p0x, p1y - p0y);
                    if (length <= stroke.wireframeMaxMeshLength) {
                        const lengthRatio = length / stroke.wireframeMaxMeshLength;
                        const clampedLengthRatio = Math.min(1, Math.max(0, lengthRatio));
                        const addedThickness = maxAddedThickness * (1 - clampedLengthRatio);
                        const finalThickness = minRenderedThickness + addedThickness;
                        
                        context.lineWidth = finalThickness;
                        context.beginPath(); // Start a new path for each line to apply individual thickness
                        context.moveTo(p0x, p0y);
                        context.lineTo(p1x, p1y);
                        context.stroke();
                    }
                }
            } else { // No gradient mesh, draw all valid mesh lines with uniform thickness
                const baseSize = stroke.size || 10.0;
                const meshThickness = baseSize * (stroke.wireframeMeshLineThickness || 1.0) / 10.0;
                context.lineWidth = meshThickness; 
                for (let i = 0; i < delaunay.halfedges.length; ++i) {
                    const j = delaunay.halfedges[i];
                    if (j < i) continue; // Only draw each edge once

                    const p0_idx = delaunay.triangles[i];
                    const p1_idx = delaunay.triangles[j];
                    const p0x = delaunayPoints[p0_idx][0];
                    const p0y = delaunayPoints[p0_idx][1];
                    const p1x = delaunayPoints[p1_idx][0];
                    const p1y = delaunayPoints[p1_idx][1];

                    const length = Math.hypot(p1x - p0x, p1y - p0y);
                    if (length <= stroke.wireframeMaxMeshLength) {
                        context.moveTo(p0x, p0y);
                        context.lineTo(p1x, p1y);
                    }
                }
                context.stroke(); // Stroke all segments at once
            }
        } else {
            // No max mesh length, draw all Delaunay edges with uniform thickness
            const baseSize = stroke.size || 10.0;
            const meshThickness = baseSize * (stroke.wireframeMeshLineThickness || 1.0) / 10.0;
            context.lineWidth = meshThickness;
            delaunay.render(context); // Renders all edges if no max length or disabled
            context.stroke();
        }

        // Draw convex hull lines
        context.beginPath();
        delaunay.renderHull(context);
        const baseSize = stroke.size || 10.0;
        const hullThickness = baseSize * (stroke.wireframeHullLineThickness || 5.0) / 10.0;
        context.lineWidth = hullThickness; 
        context.stroke();

    } else {
        // --- Logic for OPEN wireframe (new behavior) ---

        // 1. Draw the "hull" (the user-drawn path) using drawVariableWidthStrokePolygon
        // This creates a continuous, variable-width line that follows the stroke points.
        // We use the new sizeMultiplier parameter to avoid mapping points into a new array.
        drawVariableWidthStrokePolygon(
            context,
            pointsToDraw,
            hexToRgba(stroke.color, stroke.opacity * (stroke.wireframeLineOpacity || 0.8)),
            stroke.minSizeFactor,
            stroke.tipShape,
            0, 0, // No offset
            stroke.wireframeHullLineThickness || 1.0 // sizeMultiplier replaces mapping
        );

        // 2. Draw Delaunay mesh lines (internal connections)
        // This is separate from the hull and uses its own thickness.
        context.strokeStyle = hexToRgba(stroke.color, stroke.opacity * (stroke.wireframeLineOpacity || 0.8));
        
        context.beginPath();
        // Check for max mesh length
        if (stroke.wireframeMaxMeshLength !== Infinity && (stroke.wireframeMaxMeshLength || 0) > 0) {
            // Apply gradient mesh thickness logic if enabled
            if (stroke.wireframeGradientMesh) {
                const baseSize = stroke.size || 10.0;
                const minRenderedThickness = baseSize * (stroke.wireframeMeshLineThickness || 1.0) / 10.0;
                const gradientBoostFactor = stroke.wireframeGradientMeshBoostFactor || 2.0;
                const maxAddedThickness = minRenderedThickness * gradientBoostFactor; // Max added thickness is a factor of base thickness

                for (let i = 0; i < delaunay.halfedges.length; ++i) {
                    const j = delaunay.halfedges[i];
                    if (j < i) continue;

                    const p0_idx = delaunay.triangles[i];
                    const p1_idx = delaunay.triangles[j];
                    const p0x = delaunayPoints[p0_idx][0];
                    const p0y = delaunayPoints[p0_idx][1];
                    const p1x = delaunayPoints[p1_idx][0];
                    const p1y = delaunayPoints[p1_idx][1];

                    const length = Math.hypot(p1x - p0x, p1y - p0y);
                    if (length <= stroke.wireframeMaxMeshLength) {
                        const lengthRatio = length / stroke.wireframeMaxMeshLength;
                        const clampedLengthRatio = Math.min(1, Math.max(0, lengthRatio));
                        const addedThickness = maxAddedThickness * (1 - clampedLengthRatio);
                        const finalThickness = minRenderedThickness + addedThickness;

                        context.lineWidth = finalThickness;
                        context.beginPath(); // Start a new path for each line to apply individual thickness
                        context.moveTo(p0x, p0y);
                        context.lineTo(p1x, p1y);
                        context.stroke();
                    }
                }
            } else { // No gradient mesh, draw all valid mesh lines with uniform thickness
                const baseSize = stroke.size || 10.0;
                const meshThickness = baseSize * (stroke.wireframeMeshLineThickness || 1.0) / 10.0;
                context.lineWidth = meshThickness;
                for (let i = 0; i < delaunay.halfedges.length; ++i) {
                    const j = delaunay.halfedges[i];
                    if (j < i) continue;

                    const p0_idx = delaunay.triangles[i];
                    const p1_idx = delaunay.triangles[j];
                    const p0x = delaunayPoints[p0_idx][0];
                    const p0y = delaunayPoints[p0_idx][1];
                    const p1x = delaunayPoints[p1_idx][0];
                    const p1y = delaunayPoints[p1_idx][1];

                    const length = Math.hypot(p1x - p0x, p1y - p0y);
                    if (length <= stroke.wireframeMaxMeshLength) {
                        context.moveTo(p0x, p0y);
                        context.lineTo(p1x, p1y);
                    }
                }
                context.stroke();
            }
        } else {
            // No max mesh length, draw all Delaunay edges with uniform thickness
            const baseSize = stroke.size || 10.0;
            const meshThickness = baseSize * (stroke.wireframeMeshLineThickness || 1.0) / 10.0;
            context.lineWidth = meshThickness;
            delaunay.render(context); // Renders all edges if no max length or disabled
            context.stroke();
        }

        // No filled triangles for open wireframe (as per wireframeMeshOpacity: 0.0 in preset).
        // No auto-closed convex hull via delaunay.renderHull for open wireframe.
    }

    // Draw points if radius > 0 (applies to both closed and open)
    if ((stroke.wireframePointRadius || 0) > 0) {
        context.fillStyle = hexToRgba(stroke.wireframePointColor || stroke.color, stroke.opacity * (stroke.wireframePointOpacity || 1.0));
        pointsToDraw.forEach(p => {
            context.beginPath();
            context.arc(p.x, p.y, Math.max(0.5, stroke.wireframePointRadius) / 2, 0, Math.PI * 2);
            context.fill();
        });
    }
}
