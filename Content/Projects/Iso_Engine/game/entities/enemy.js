// scripts/extensions/rpg/game/entities/enemy.js
import Player from './player.js';
import GameObject from './gameObject.js';
import NPC from './npc.js';
import { GLOBAL_COLLISION_Y_OFFSET } from './gameObject.js';
import { TelegraphEffect, FloatingTextEffect } from '../combat/effects.js';

const AI_STATE = {
    IDLE: 'idle',
    CHASING: 'chasing',
    ATTACKING: 'attacking',
    RETURNING: 'returning',
    DEAD: 'dead' // New state for respawning
};

class Enemy extends GameObject {
    constructor(engine, map, mapX, mapY, enemyData) {
        // We pass the full enemyData object to the GameObject constructor
        // It will pick up assetName, collisionShape, visual sizes, etc.
        super(engine, map, mapX, mapY, enemyData);

        this.stats = { ...enemyData.stats }; // Copy stats
        this.name = enemyData.name;
        this.aiState = AI_STATE.IDLE;
        this.player = this.engine.player; // Keep a reference to the player
        this.attackTimer = 0;
        this.mass = 1; // For collision weight

        // Knockback properties
        this.knockbackVelocity = { x: 0, y: 0 };
        this.knockbackFriction = 5.0;

        // Hit flash properties
        this.isHit = false;
        this.hitFlashTimer = 0;

        // Attack sequence properties
        this.attackSubState = 'none'; // 'none', 'startup', 'active', 'recovery'
        this.attackAction = {
            timer: 0,
            startPos: null, // For jump animation
            targetPos: null,
            aoeShape: { type: 'ellipse', radiusX: 40, radiusY: 20 }, // Ellipse for isometric view
            startupDuration: 0.8, // Duration of the jump
            activeDuration: 0.2,
            recoveryDuration: 1.0,
            knockbackForce: 150, // Force to push the player
        };
        this.visualYOffset = 0; // For jump animation
        this.hasDealtDamage = false; // Per-attack flag

        // Ensure stats have defaults
        this.stats.aggroRange = this.stats.aggroRange || 200;
        this.stats.attackRange = 120; // 120px allows launching beautiful, dynamic leaps
        this.stats.attackCooldown = this.stats.attackCooldown || 2;
        this.stats.speed = this.stats.speed || 80;

        this.spawnPoint = { x: this.currentPixelX, y: this.currentPixelY };
        this.leashRangeSq = Infinity; // Standard waves on ARAM never leash!
        
        this.collisionRadius = 12; // For dynamic collision checks

        // New properties for respawning
        this.respawnTimer = 0;
        this.RESPAWN_TIME = 15; // 15 seconds
    }

    update(deltaTime) {
        if (this.aiState === AI_STATE.DEAD) {
            this.respawnTimer -= deltaTime;
            if (this.respawnTimer <= 0) {
                this.respawn();
            }
            return; // Do nothing else if dead
        }

        // Update timers
        this.attackTimer = Math.max(0, this.attackTimer - deltaTime);
        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer -= deltaTime;
            if (this.hitFlashTimer <= 0) {
                this.isHit = false;
            }
        }

        // Apply knockback friction
        this.knockbackVelocity.x -= this.knockbackVelocity.x * this.knockbackFriction * deltaTime;
        this.knockbackVelocity.y -= this.knockbackVelocity.y * this.knockbackFriction * deltaTime;
        if (Math.abs(this.knockbackVelocity.x) < 1) this.knockbackVelocity.x = 0;
        if (Math.abs(this.knockbackVelocity.y) < 1) this.knockbackVelocity.y = 0;

        // Dynamic targeting evaluation
        const target = this.findCurrentTarget();
        this.currentTarget = target;

        if (!target) {
            if (this.aiState !== AI_STATE.RETURNING && this.aiState !== AI_STATE.DEAD) {
                this.aiState = AI_STATE.RETURNING;
                 // If returning, ensure collidable is true (in case it was mid-jump)
                if (this.attackSubState !== 'none') {
                    this.collidable = true;
                    this.visualYOffset = 0;
                    this.attackSubState = 'none';
                    this.attackAction.targetPos = null;
                }
            }
        } else {
             const dx = target.currentPixelX - this.currentPixelX;
             const dy = target.currentPixelY - this.currentPixelY;
             const distSq = dx * dx + dy * dy;
             this.updateAIState(distSq);
        }

        this.executeAIState(deltaTime);
    }

    findCurrentTarget() {
        let possibleTargets = [];

        // 1. Target Player
        if (this.player && this.player.stats.hp > 0) {
            const dist = this.getDistanceTo(this.player);
            possibleTargets.push({
                obj: this.player,
                type: 'player',
                priority: 2, // Players are high priority
                distance: dist
            });
        }

        // 2. Scan for other friendly objects (towers, shopkeeper)
        if (this.engine && this.engine.gameObjects) {
            for (const obj of this.engine.gameObjects) {
                if (obj.stats && obj.stats.hp > 0) {
                    if (obj.type === 'tower_player' && !obj.stats.isDestroyed) {
                        const dist = this.getDistanceTo(obj);
                        possibleTargets.push({
                            obj: obj,
                            type: 'tower',
                            priority: 1, // Towers block lanes
                            distance: dist
                        });
                    } else if (obj instanceof NPC && obj.name.toLowerCase().includes('doran')) {
                        const dist = this.getDistanceTo(obj);
                        possibleTargets.push({
                            obj: obj,
                            type: 'shopkeeper',
                            priority: 3, // Nexus priority
                            distance: dist
                        });
                    }
                }
            }
        }

        if (possibleTargets.length === 0) return null;

        // Sort: Sentry Towers block progress (strong priority pull). Player is secondary, then Shopkeeper.
        possibleTargets.sort((a, b) => {
            const scoreA = a.distance - (a.type === 'tower' ? 180 : (a.type === 'player' ? 100 : 0));
            const scoreB = b.distance - (b.type === 'tower' ? 180 : (b.type === 'player' ? 100 : 0));
            return scoreA - scoreB;
        });

        return possibleTargets[0].obj;
    }

    getDistanceTo(target) {
        if (!target) return Infinity;
        const dx = target.currentPixelX - this.currentPixelX;
        const dy = target.currentPixelY - this.currentPixelY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    updateAIState(targetDistSq) {
        if (this.aiState === AI_STATE.DEAD) return;
        const distToSpawnSq = (this.currentPixelX - this.spawnPoint.x)**2 + (this.currentPixelY - this.spawnPoint.y)**2;

        // If locked in an attack, only check for leashing (which is Infinity for Waves)
        if (this.aiState === AI_STATE.ATTACKING && this.attackSubState !== 'none') {
            if (distToSpawnSq > this.leashRangeSq) {
                this.aiState = AI_STATE.RETURNING;
                this.attackSubState = 'none'; // Cancel attack
                this.attackAction.targetPos = null;
                this.collidable = true; // Ensure collision is re-enabled if attack is cancelled
                this.visualYOffset = 0;
            }
            return; // Don't run other state transition checks
        }

        switch (this.aiState) {
            case AI_STATE.IDLE:
            case AI_STATE.RETURNING:
                if (targetDistSq < this.stats.aggroRange ** 2) {
                    this.aiState = AI_STATE.CHASING;
                }
                break;
            case AI_STATE.CHASING:
                if (distToSpawnSq > this.leashRangeSq) {
                    this.aiState = AI_STATE.RETURNING;
                } else if (targetDistSq < this.stats.attackRange ** 2 && this.attackTimer <= 0) {
                    this.aiState = AI_STATE.ATTACKING;
                }
                break;
            case AI_STATE.ATTACKING:
                if (targetDistSq > (this.stats.attackRange * 1.5) ** 2) { // Give leeway to chase
                    this.aiState = AI_STATE.CHASING;
                }
                 if (distToSpawnSq > this.leashRangeSq) {
                    this.aiState = AI_STATE.RETURNING;
                }
                break;
        }
    }

    executeAIState(deltaTime) {
        let targetX, targetY;

        switch (this.aiState) {
            case AI_STATE.IDLE:
                // March down the bridge towards the Allied player entry base!
                if (this.engine && this.engine.map && this.engine.map.spawnPointsData) {
                    const playerSpawn = this.engine.map.spawnPointsData.find(sp => sp.type === 'player_entry');
                    if (playerSpawn) {
                        this.moveTowards(deltaTime, playerSpawn.x - this.currentPixelX, playerSpawn.y - this.currentPixelY, this.stats.speed * 0.65);
                    } else {
                        this.moveTowards(deltaTime, -320 - this.currentPixelX, 528 - this.currentPixelY, this.stats.speed * 0.45);
                    }
                } else {
                    this.moveTowards(deltaTime, -320 - this.currentPixelX, 528 - this.currentPixelY, this.stats.speed * 0.45);
                }
                break;
            case AI_STATE.RETURNING:
                targetX = this.spawnPoint.x;
                targetY = this.spawnPoint.y;
                const distToSpawnSq = (this.currentPixelX - targetX)**2 + (this.currentPixelY - targetY)**2;
                if (distToSpawnSq < 25) { // Close enough to spawn
                    this.aiState = AI_STATE.IDLE;
                    this.stats.hp = this.stats.maxHp; // Reset HP when returning
                } else {
                    this.moveTowards(deltaTime, targetX - this.currentPixelX, targetY - this.currentPixelY, this.stats.speed * 0.7);
                }
                break;
            case AI_STATE.CHASING:
                if (this.currentTarget) {
                    targetX = this.currentTarget.currentPixelX;
                    targetY = this.currentTarget.currentPixelY;
                    this.moveTowards(deltaTime, targetX - this.currentPixelX, targetY - this.currentPixelY, this.stats.speed);
                } else {
                    this.aiState = AI_STATE.IDLE;
                }
                break;
            case AI_STATE.ATTACKING:
                this.updateAttackSequence(deltaTime);
                break;
        }
    }

    updateAttackSequence(deltaTime) {
        // If not in a sequence and ready, start one
        if (this.attackSubState === 'none' && this.attackTimer <= 0) {
            const activeTarget = this.currentTarget || this.player;
            if (!activeTarget) return;

            this.attackSubState = 'startup';
            this.attackAction.timer = this.attackAction.startupDuration;
            this.attackAction.startPos = { x: this.currentPixelX, y: this.currentPixelY };
            this.attackAction.targetPos = { x: activeTarget.currentPixelX, y: activeTarget.currentPixelY };
            this.hasDealtDamage = false;
            this.collidable = false; // Disable collision during jump

            // Create the telegraph immediately at the target location. It will last for the duration of the jump.
            this.engine.addEffect(new TelegraphEffect(this.engine, {
                type: 'telegraph',
                position: this.attackAction.targetPos,
                shape: this.attackAction.aoeShape,
                duration: this.attackAction.startupDuration,
                owner: this
            }));
            return;
        }
    
        // Process the current attack sequence state
        if (this.attackSubState !== 'none') {
            this.attackAction.timer -= deltaTime;
    
            if (this.attackSubState === 'startup') {
                const progress = 1 - (this.attackAction.timer / this.attackAction.startupDuration);
                
                // Move the enemy along the jump arc
                if (this.attackAction.startPos && this.attackAction.targetPos) {
                    this.currentPixelX = this.attackAction.startPos.x + (this.attackAction.targetPos.x - this.attackAction.startPos.x) * progress;
                    this.currentPixelY = this.attackAction.startPos.y + (this.attackAction.targetPos.y - this.attackAction.startPos.y) * progress;
                    // Animate Y-offset for height using a sine wave for the arc
                    this.visualYOffset = -Math.sin(progress * Math.PI) * 45; // nice leap arc
                }

                if (this.attackAction.timer <= 0) {
                    // Jump finished, transition to active
                    this.currentPixelX = this.attackAction.targetPos.x; // Snap to final position
                    this.currentPixelY = this.attackAction.targetPos.y;
                    this.updateMapCoordsFromPixels();
                    this.visualYOffset = 0;
                    this.collidable = true; // Re-enable collision on landing

                    this.attackSubState = 'active';
                    this.attackAction.timer = this.attackAction.activeDuration;

                    // Create the 'hit' effect
                    this.engine.addEffect(new TelegraphEffect(this.engine, {
                        type: 'active_aoe',
                        position: this.attackAction.targetPos,
                        shape: this.attackAction.aoeShape,
                        duration: this.attackAction.activeDuration,
                        owner: this
                    }));
                }
            } else if (this.attackSubState === 'active') {
                // Deal damage to any allied target in landing AoE
                if (!this.hasDealtDamage) {
                    const ellipseCenter = { x: this.attackAction.targetPos.x, y: this.attackAction.targetPos.y - GLOBAL_COLLISION_Y_OFFSET };
                    const radiusX = this.attackAction.aoeShape.radiusX;
                    const radiusY = this.attackAction.aoeShape.radiusY;

                    // 1. Check Player
                    if (this.player && this.player.stats.hp > 0) {
                        const playerCollisionCenter = { x: this.player.currentPixelX, y: this.player.currentPixelY - GLOBAL_COLLISION_Y_OFFSET };
                        const dx = playerCollisionCenter.x - ellipseCenter.x;
                        const dy = playerCollisionCenter.y - ellipseCenter.y;
                        if (((dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY)) <= 1.1) {
                            this.player.takeDamage(this.stats.atk, this);
                            this.hasDealtDamage = true;

                            // Apply knockback to player
                            const knockbackDirection = {
                                x: this.player.currentPixelX - this.currentPixelX,
                                y: this.player.currentPixelY - this.currentPixelY
                            };
                            this.player.applyKnockback(knockbackDirection, this.attackAction.knockbackForce);
                        }
                    }

                    // 2. Check general Allied GameObjects (Towers and Shopkeeper)
                    if (this.engine && this.engine.gameObjects) {
                        for (const obj of this.engine.gameObjects) {
                            if (obj.stats && obj.stats.hp > 0) {
                                if (obj.type === 'tower_player' && !obj.stats.isDestroyed) {
                                    const tdx = obj.currentPixelX - ellipseCenter.x;
                                    const tdy = (obj.currentPixelY - 16) - ellipseCenter.y;
                                    if (((tdx * tdx) / (radiusX * radiusX) + (tdy * tdy) / (radiusY * radiusY)) <= 1.25) {
                                        obj.takeDamage(this.stats.atk, this);
                                        this.hasDealtDamage = true;
                                    }
                                } else if (obj instanceof NPC && obj.name.toLowerCase().includes('doran')) {
                                    const tdx = obj.currentPixelX - ellipseCenter.x;
                                    const tdy = (obj.currentPixelY - 16) - ellipseCenter.y;
                                    if (((tdx * tdx) / (radiusX * radiusX) + (tdy * tdy) / (radiusY * radiusY)) <= 1.25) {
                                        obj.takeDamage(this.stats.atk, this);
                                        this.hasDealtDamage = true;
                                    }
                                }
                            }
                        }
                    }
                }

                if (this.attackAction.timer <= 0) {
                    this.attackSubState = 'recovery';
                    this.attackAction.timer = this.attackAction.recoveryDuration;
                }
            } else if (this.attackSubState === 'recovery') {
                if (this.attackAction.timer <= 0) {
                    this.attackSubState = 'none';
                    this.attackAction.targetPos = null;
                    this.attackAction.startPos = null;
                    this.attackTimer = this.stats.attackCooldown;
                    this.aiState = AI_STATE.CHASING; // Re-evaluate state from new position
                    // Ensure collidable is true if somehow missed
                    if (!this.collidable) this.collidable = true; 
                    if (this.visualYOffset !== 0) this.visualYOffset = 0;
                }
            }
        }
    }

    moveTowards(deltaTime, dx, dy, speed) {
        if (this.aiState === AI_STATE.ATTACKING && this.attackSubState === 'startup') { // No standard movement during jump startup
            return; 
        }
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1 && this.knockbackVelocity.x === 0 && this.knockbackVelocity.y === 0) return;

        let totalMoveX = this.knockbackVelocity.x * deltaTime;
        let totalMoveY = this.knockbackVelocity.y * deltaTime;

        if (dist >= 1) {
            totalMoveX += (dx / dist) * speed * deltaTime;
            totalMoveY += (dy / dist) * speed * deltaTime;
        }
        
        let potentialPixelX = this.currentPixelX + totalMoveX;
        let potentialPixelY = this.currentPixelY + totalMoveY;

        // If this enemy instance is currently non-collidable (e.g., mid-jump for attack),
        // skip its own collision checks. It will still be blocked by *other* collidable objects if they are solid.
        // However, standard movement should respect its own collidable flag for consistency.
        // So, if this.collidable is true, it performs full checks. If false, it might still be blocked by static terrain.
        // For the jump, we are setting currentPixelX/Y directly, bypassing this.
        // This function is for normal chase/return movement.
        
        // This check is for when THIS enemy tries to move based on its AI (chase/return)
        // If it's currently collidable, it performs full checks.
        if (this.collidable) {
            const enemyCircle = {
                center: { x: 0, y: 0 },
                radius: this.collisionRadius
            };

            const checkCollisionAt = (targetPx, targetPy) => {
                enemyCircle.center.x = targetPx;
                enemyCircle.center.y = targetPy - GLOBAL_COLLISION_Y_OFFSET;

                // Check against static GameObjects
                for (const obj of this.engine.gameObjects) {
                    if (obj.collidable && obj !== this && !(obj instanceof Player) && !(obj instanceof Enemy)) {
                        const objCollisionShape = obj.getCollisionBounds();
                        if (objCollisionShape) {
                            if (objCollisionShape.type === 'rectangle') {
                                if (this.map._circleIntersectsRectangle(enemyCircle, objCollisionShape.data)) return true;
                            } else if (objCollisionShape.type === 'polygon') {
                                if (this.map._circleIntersectsPolygon(enemyCircle, objCollisionShape.data)) return true;
                            }
                        }
                    }
                }

                // Check against custom collision polygons
                if (this.map && this.map.collisionLayerData) {
                    for (const customShape of this.map.collisionLayerData) {
                        if (this.map._circleIntersectsPolygon(enemyCircle, customShape.vertices)) return true;
                    }
                }

                return false;
            };
            
            if (!checkCollisionAt(potentialPixelX, potentialPixelY)) {
                this.currentPixelX = potentialPixelX;
                this.currentPixelY = potentialPixelY;
            } else {
                // Sliding logic
                if (totalMoveX !== 0 && !checkCollisionAt(potentialPixelX, this.currentPixelY)) {
                    this.currentPixelX = potentialPixelX;
                }
                else if (totalMoveY !== 0 && !checkCollisionAt(this.currentPixelX, potentialPixelY)) {
                    this.currentPixelY = potentialPixelY;
                }
            }
        } else {
             // If this enemy is non-collidable (e.g. mid-jump), it moves freely UNLESS blocked by static map collision
             // This part might need adjustment if non-collidable enemies should pass through static objects too.
             // For now, let's assume they only ignore other dynamic entities but not map.
             // Simplified check against just map static collision (game objects with collidable true, and custom collision layer)
             // This is a subtle point: if an enemy jumps, should it pass through walls? Probably not.
             // The direct setting of currentPixelX/Y in updateAttackSequence bypasses this for the jump itself.
             // This path is for when moveTowards is called while this.collidable is false for other reasons (not currently used).

            // If we allow movement when non-collidable, it means currentPixelX/Y can be updated
            // This is generally handled by the attack sequence directly setting X/Y.
            // If normal AI movement is triggered while non-collidable, it would move freely.
            // This is unlikely given the current AI state logic.
        }


        this.updateMapCoordsFromPixels();
    }

    attack() {
        if (this.player && this.player.stats.hp > 0) {
            this.player.takeDamage(this.stats.atk, this);
        }
    }
    
    takeDamage(amount) {
        if (this.aiState === AI_STATE.DEAD) return; // Can't take damage while dead

        this.stats.hp -= amount;
        
        // Trigger hit flash
        this.isHit = true;
        this.hitFlashTimer = 0.15; // seconds

        // Add floating damage text
        this.engine.addEffect(new FloatingTextEffect(this.engine, {
            text: amount.toString(),
            position: { x: this.currentPixelX, y: this.currentPixelY - this.visualHeight },
            color: '#ffc107' // Yellow damage text for enemies
        }));

        if (this.stats.hp <= 0) {
            this.stats.hp = 0;
            this.die();
        }
    }

    die() {
        this.aiState = AI_STATE.DEAD;
        this.collidable = false; // Become non-collidable
        this.respawnTimer = this.RESPAWN_TIME;
        this.attackSubState = 'none'; // Cancel any ongoing attack
        this.attackAction.targetPos = null;
        this.visualYOffset = 0; // Reset visual offset
        this.isHit = false; // Turn off hit flash on death

        // If player is targeting this enemy, clear their target
        if (this.player && this.player.currentTarget === this) {
            this.player.currentTarget = null;
        }

        // Reward Gold
        const goldReward = Math.floor(Math.random() * 8) + 12; // 12-19 gold
        if (this.player) {
            this.player.gold = (this.player.gold || 0) + goldReward;
            
            // Bring FloatingTextEffect locally
            const FloatingTextEffectClass = FloatingTextEffect || null;
            if (FloatingTextEffectClass) {
                this.engine.addEffect(new FloatingTextEffectClass(this.engine, {
                    text: `+${goldReward} Gold`,
                    position: { x: this.currentPixelX, y: this.currentPixelY - 40 },
                    color: '#FFD700'
                }));
            }
        }

        // Notify the quest system
        if (this.engine.questSystem) {
            this.engine.questSystem.onEnemyKilled(this.name);
        }
    }

    respawn() {
        this.stats.hp = this.stats.maxHp;
        this.currentPixelX = this.spawnPoint.x;
        this.currentPixelY = this.spawnPoint.y;
        
        this.updateMapCoordsFromPixels();

        this.aiState = AI_STATE.IDLE;
        this.collidable = true; // Make sure it's collidable on respawn
        this.visualYOffset = 0;
    }

    applyKnockback(direction, force) {
        const dist = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
        if (dist > 0) {
            this.knockbackVelocity.x += (direction.x / dist) * force;
            this.knockbackVelocity.y += (direction.y / dist) * force;
        }
    }

    render(ctx, viewOriginX, viewOriginY) {
        if (this.aiState === AI_STATE.DEAD) return;

        // --- RENDER SPRITE (with offset) ---
        // This logic is copied and modified from GameObject.render to handle visualYOffset
        if (!this.sprite || !this.sprite.complete) {
            const placeholderDrawX = this.currentPixelX - viewOriginX - 10;
            const placeholderDrawY = (this.currentPixelY + this.visualYOffset) - viewOriginY - 20;
            ctx.fillStyle = 'gray';
            ctx.fillRect(placeholderDrawX, placeholderDrawY, 20, 20);
            return;
        }
    
        const anchorCanvasX = this.currentPixelX - viewOriginX;
        const anchorCanvasY = (this.currentPixelY + this.visualYOffset) - viewOriginY;
    
        const spriteDrawX = anchorCanvasX - this.anchorOffsetX;
        const spriteDrawY = anchorCanvasY - this.anchorOffsetY;
    
        if (this.spriteSourceRect) {
            ctx.drawImage(
                this.sprite,
                this.spriteSourceRect.x, this.spriteSourceRect.y,
                this.spriteSourceRect.width, this.spriteSourceRect.height,
                spriteDrawX, spriteDrawY,
                this.visualWidth, this.visualHeight
            );
        } else {
            ctx.drawImage(
                this.sprite,
                spriteDrawX, spriteDrawY,
                this.visualWidth, this.visualHeight
            );
        }

        // --- Render Hit Flash ---
        if (this.isHit) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.8 * (this.hitFlashTimer / 0.15); // Fade the flash out
            
            // Re-draw the sprite with the effect
            if (this.spriteSourceRect) {
                ctx.drawImage(
                    this.sprite,
                    this.spriteSourceRect.x, this.spriteSourceRect.y,
                    this.spriteSourceRect.width, this.spriteSourceRect.height,
                    spriteDrawX, spriteDrawY,
                    this.visualWidth, this.visualHeight
                );
            } else {
                ctx.drawImage(
                    this.sprite,
                    spriteDrawX, spriteDrawY,
                    this.visualWidth, this.visualHeight
                );
            }
            ctx.restore();
        }

        // --- RENDER HP BAR and NAME (with offset) ---
        const drawX = this.currentPixelX - viewOriginX;
        const drawY = (this.currentPixelY + this.visualYOffset) - viewOriginY;

        // --- Render HP bar ---
        const hpBarYOffset = this.visualHeight + 15;
        if (this.stats.hp > 0 && this.stats.hp < this.stats.maxHp) {
            const barWidth = 40;
            const barHeight = 5;
            const barY = drawY - hpBarYOffset;
            const barX = drawX - barWidth / 2;
            
            // Background
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
            
            // Health
            const hpRatio = this.stats.hp / this.stats.maxHp;
            ctx.fillStyle = '#e74c3c'; // Red for HP
            ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
        }

        // --- Render Name ---
        const nameYOffset = this.visualHeight + 5;
        ctx.fillStyle = '#EFEBE0';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(this.name, drawX, drawY - nameYOffset);
    }
}

export default Enemy;