// scripts/extensions/rpg/game/combat/effects.js
console.log("rpg/game/combat/effects.js loaded");

class FloatingTextEffect {
    constructor(engine, options) {
        this.engine = engine;
        this.id = `floating_text_${Date.now()}_${Math.random()}`;

        this.text = options.text;
        this.position = { ...options.position };
        this.color = options.color || 'yellow';
        this.font = options.font || 'bold 16px Arial';
        
        this.duration = options.duration || 1.2; // 1.2 seconds
        this.lifeTimer = this.duration;

        this.velocity = { x: 0, y: -40 }; // Moves up
        this.alpha = 1.0;
    }

    update(deltaTime) {
        this.lifeTimer -= deltaTime;
        if (this.lifeTimer <= 0) {
            this.engine.removeEffect(this);
            return;
        }

        // Move the text
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;

        // Fade out in the last part of its life
        const fadeStartTime = this.duration * 0.4;
        if (this.lifeTimer < fadeStartTime) {
            this.alpha = this.lifeTimer / fadeStartTime;
        }
    }

    render(ctx, viewOriginX, viewOriginY) {
        ctx.save();
        
        const drawX = this.position.x - viewOriginX;
        const drawY = this.position.y - viewOriginY;

        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.font = this.font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        
        // Add a simple black stroke for readability
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.strokeText(this.text, drawX, drawY);
        ctx.fillText(this.text, drawX, drawY);
        
        ctx.restore();
    }
    
    getSortY() {
        return this.position.y;
    }

    getCollisionBounds() {
        return null;
    }
}

class TelegraphEffect {
    constructor(engine, options) {
        this.engine = engine;
        this.type = options.type; // 'telegraph' or 'active_aoe'
        this.shape = options.shape; // e.g. { type: 'circle', radius: 30 }
        this.position = options.position; // { x, y }
        this.lifeTimer = options.duration;
        this.id = `telegraph_${Date.now()}`;
        this.owner = options.owner;
    }

    update(deltaTime) {
        this.lifeTimer -= deltaTime;
        if (this.lifeTimer <= 0) {
            this.engine.removeEffect(this);
        }
    }

    render(ctx, viewOriginX, viewOriginY) {
        if (this.shape.type === 'ellipse') {
            ctx.save();
            const aoe_x = this.position.x - viewOriginX;
            const aoe_y = this.position.y - viewOriginY;
            const radiusX = this.shape.radiusX;
            const radiusY = this.shape.radiusY;

            if (this.type === 'telegraph') {
                ctx.strokeStyle = 'rgba(255, 150, 0, 0.8)';
                ctx.fillStyle = 'rgba(255, 150, 0, 0.3)';
                ctx.lineWidth = 2 / this.engine.zoomLevel;
                ctx.setLineDash([10, 5]);
            } else { // active_aoe
                ctx.strokeStyle = 'rgba(255, 50, 0, 0.9)';
                ctx.fillStyle = 'rgba(255, 50, 0, 0.6)';
                ctx.lineWidth = 3 / this.engine.zoomLevel;
                ctx.setLineDash([]);
            }

            ctx.beginPath();
            ctx.ellipse(aoe_x, aoe_y, radiusX, radiusY, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
    }

    getSortY() {
        // Sort the effect on the ground at its Y position.
        // Add radiusY to make sure the whole effect is considered for sorting.
        return this.position.y + (this.shape.radiusY || 0);
    }

    // Add a placeholder for getCollisionBounds to avoid errors if something tries to collide with it
    getCollisionBounds() {
        return null;
    }
}

export { TelegraphEffect, FloatingTextEffect };