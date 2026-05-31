// Represents static objects on the map like boxes, trees,  etc.
console.log("game/entities/gameObject.js loaded");

export const GLOBAL_COLLISION_Y_OFFSET = 16; // Pixels to shift collision shapes upwards

class GameObject {
    constructor(engine, map, mapX, mapY, options = {}) {
        this.engine = engine;
        this.map = map;
        this.id = options.id || `obj_${Date.now()}_${Math.random()}`;

        this.mapX = mapX; // Logical map grid X
        this.mapY = mapY; // Logical map grid Y

        this.type = options.type || 'generic';
        this.customData = options.customData || null;

        this.assetName = options.assetName; // e.g., 'tree' or 'buildingSpritesheet'
        this.spritesheetIndex = options.spritesheetIndex || 0;

        // The logic for `this.sprite` needs to change. It's not always from `engine.assets`.
        if (options.spriteImage) { // If a direct image object is provided
            this.sprite = options.spriteImage;
        } else if (this.spritesheetIndex > 0 && this.map.runtimeSpritesheets[this.spritesheetIndex]) {
            // It's a custom spritesheet from the map
            this.sprite = this.map.runtimeSpritesheets[this.spritesheetIndex];
        } else {
            // It's a built-in asset
            this.sprite = this.engine.assets[this.assetName];
        }
        
        this.spriteSourceRect = options.spriteSourceRect || null; // {x, y, width, height} if using part of a spritesheet

        if (!this.sprite) {
            console.error(`Asset for assetName "${this.assetName}" or spritesheetIndex ${this.spritesheetIndex} not found for GameObject ${this.id}.`);
        }
        
        // Visual dimensions for rendering on canvas.
        // Priority: explicit options.visualWidth/Height -> spriteSourceRect dimensions -> full sprite dimensions.
        this.visualWidth = options.visualWidth !== undefined 
            ? options.visualWidth 
            : (this.spriteSourceRect ? this.spriteSourceRect.width : (this.sprite ? this.sprite.width : 32));
        this.visualHeight = options.visualHeight !== undefined 
            ? options.visualHeight
            : (this.spriteSourceRect ? this.spriteSourceRect.height : (this.sprite ? this.sprite.height : 32));


        // Anchor point: offset from the sprite's top-left to its logical ground position.
        // E.g., for bottom-center anchor: anchorOffsetX = visualWidth / 2, anchorOffsetY = visualHeight.
        this.anchorOffsetX = options.anchorOffsetX !== undefined ? options.anchorOffsetX : this.visualWidth / 2;
        this.anchorOffsetY = options.anchorOffsetY !== undefined ? options.anchorOffsetY : this.visualHeight;

        this.layerKey = options.layerKey || null;
        this.collidable = !!options.collidable;
        
        // collisionShape: 
        // { type: 'rectangle', width, height, xOffset, yOffset } (offsets relative to anchor)
        // OR { type: 'polygon', vertices: [{x,y}, ...] } (vertices relative to anchor)

        // Deep clone options.collisionShape to prevent modifying the original object in the brush/template.
        this.collisionShape = options.collisionShape ? JSON.parse(JSON.stringify(options.collisionShape)) : null;
        this.originalCollisionShape = options.collisionShape ? JSON.parse(JSON.stringify(options.collisionShape)) : null;
        
        const isCustomSprite = (this.assetName && this.assetName.startsWith('pixel_sprite_')) || 
                               (this.type && this.type.startsWith('pixel_sprite_')) ||
                               (this.spritesheetIndex > 0 && this.map && this.map.runtimeSpritesheets && this.map.runtimeSpritesheets[this.spritesheetIndex] && this.map.runtimeSpritesheets[this.spritesheetIndex].isCustom);
        const yOffsetToApply = isCustomSprite ? 0 : GLOBAL_COLLISION_Y_OFFSET;

        if (this.collisionShape) {
            if (this.collisionShape.type === 'rectangle') {
                // If xOffset/yOffset are not provided in collisionShape, default to center horizontally & bottom align for feet-level collision.
                this.collisionShape.xOffset = this.collisionShape.xOffset !== undefined ? this.collisionShape.xOffset : -this.collisionShape.width / 2;
                // Default yOffset places top of collision box at anchor's Y. Then apply global offset.
                this.collisionShape.yOffset = (this.collisionShape.yOffset !== undefined ? this.collisionShape.yOffset : -this.collisionShape.height) - yOffsetToApply; 
            } else if (this.collisionShape.type === 'polygon') {
                // Apply global offset to all polygon vertices' y-coordinates.
                // .map creates a new array, so this is safe for the cloned this.collisionShape.vertices
                this.collisionShape.vertices = this.collisionShape.vertices.map(v => ({
                    x: v.x,
                    y: v.y - yOffsetToApply
                }));
            }
        }


        // Calculate initial screen pixel coordinates for the anchor point
        const screenPos = this.map.mapToScreen(this.mapX, this.mapY);
        this.currentPixelX = screenPos.x;
        this.currentPixelY = screenPos.y;

        this.zIndex = options.zIndex !== undefined ? Number(options.zIndex) : 0;
        this.disableYSorting = options.disableYSorting !== undefined ? Boolean(options.disableYSorting) : false;
        this.flippedX = options.flippedX !== undefined ? Boolean(options.flippedX) : false;
        this.rotation = options.rotation !== undefined ? Number(options.rotation) : 0;
    }

    update(deltaTime) {
        // For animated objects or objects with behavior later
        // For static objects, this might re-calculate currentPixelX/Y if mapX/Y could change (they don't for now)
    }

    updateMapCoordsFromPixels() {
        if (!this.map) return;
        const newMapCoords = this.map.screenToMap(this.currentPixelX, this.currentPixelY);
        this.mapX = newMapCoords.x;
        this.mapY = newMapCoords.y;
    }

    render(ctx, viewOriginX, viewOriginY) {
        if (!this.sprite || !this.sprite.complete) {
            // Draw a placeholder if sprite not loaded
            const placeholderDrawX = this.currentPixelX - viewOriginX - 10; // Simple placeholder
            const placeholderDrawY = this.currentPixelY - viewOriginY - 20;
            ctx.fillStyle = 'gray';
            ctx.fillRect(placeholderDrawX, placeholderDrawY, 20, 20);
            ctx.fillStyle = 'white';
            ctx.textAlign = 'left'; // Ensure text alignment
            ctx.fillText(this.assetName || '?', placeholderDrawX + 2, placeholderDrawY + 12);
            return;
        }

        // currentPixelX/Y is the world coordinate of the object's anchor point.
        // Adjust by viewOrigin to get canvas coordinates for the anchor.
        const anchorCanvasX = this.currentPixelX - viewOriginX;
        const anchorCanvasY = this.currentPixelY - viewOriginY;

        ctx.save();
        ctx.translate(anchorCanvasX, anchorCanvasY);

        if (this.rotation) {
            ctx.rotate(this.rotation);
        }
        if (this.flippedX) {
            ctx.scale(-1, 1);
        }

        if (this.spriteSourceRect) {
            // Draw a portion of a spritesheet
            ctx.drawImage(
                this.sprite, // The full spritesheet image
                this.spriteSourceRect.x,    // Source X from spritesheet
                this.spriteSourceRect.y,    // Source Y from spritesheet
                this.spriteSourceRect.width,// Source width from spritesheet
                this.spriteSourceRect.height,// Source height from spritesheet
                -this.anchorOffsetX,        // Destination X relative to anchor
                -this.anchorOffsetY,        // Destination Y relative to anchor
                this.visualWidth,           // Destination width on canvas (can be scaled)
                this.visualHeight           // Destination height on canvas (can be scaled)
            );
        } else {
            // Draw a full sprite (not from a spritesheet part, e.g. hero, standalone tree)
            ctx.drawImage(
                this.sprite,
                -this.anchorOffsetX,
                -this.anchorOffsetY,
                this.visualWidth,
                this.visualHeight
            );
        }

        ctx.restore();

        // Debug: Draw collision bounds
        // if (this.collidable && this.collisionShape) {
        //     const shape = this.getCollisionBounds(); // returns { type, data } which are already offset
        //     if (shape) {
        //         ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        //         ctx.lineWidth = 1 / this.engine.zoomLevel;
        //         ctx.beginPath(); // Ensure path is started for both types
        //         if (shape.type === 'rectangle') {
        //             ctx.rect(
        //                 shape.data.x - viewOriginX, 
        //                 shape.data.y - viewOriginY, 
        //                 shape.data.width, 
        //                 shape.data.height
        //             );
        //         } else if (shape.type === 'polygon') {
        //             ctx.moveTo(shape.data[0].x - viewOriginX, shape.data[0].y - viewOriginY);
        //             for (let i = 1; i < shape.data.length; i++) {
        //                 ctx.lineTo(shape.data[i].x - viewOriginX, shape.data[i].y - viewOriginY);
        //             }
        //             ctx.closePath();
        //         }
        //         ctx.stroke(); // Stroke after defining path
        //     }
        // }
        // Debug: Draw anchor point
        // ctx.fillStyle = 'cyan';
    }

    getSortY() {
        // Y-coordinate for depth sorting, typically the "feet" position.
        return this.currentPixelY;
    }

    getCollisionBounds() {
        if (!this.collidable || !this.collisionShape) {
            return null;
        }

        if (this.collisionShape.type === 'rectangle') {
            return {
                type: 'rectangle',
                data: { // data is the AABB in world coordinates
                    x: this.currentPixelX + this.collisionShape.xOffset,
                    y: this.currentPixelY + this.collisionShape.yOffset,
                    width: this.collisionShape.width,
                    height: this.collisionShape.height
                }
            };
        } else if (this.collisionShape.type === 'polygon') {
            const worldVertices = this.collisionShape.vertices.map(v => ({
                x: this.currentPixelX + v.x,
                y: this.currentPixelY + v.y
            }));
            return {
                type: 'polygon',
                data: worldVertices // data is an array of world coordinate vertices
            };
        }
        return null;
    }
}

export default GameObject;
