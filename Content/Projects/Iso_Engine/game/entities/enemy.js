// scripts/extensions/rpg/game/entities/enemy.js
import Player from './player.js';
import GameObject from './gameObject.js';
import NPC from './npc.js';
import { GLOBAL_COLLISION_Y_OFFSET } from './gameObject.js';
import { TelegraphEffect, FloatingTextEffect, ParticleSplatterEffect } from '../combat/effects.js';

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
        this.landingSquashTimer = 0; // Elastic squash & stretch rebound on landing
        this.hasDealtDamage = false; // Per-attack flag

        const isItemWorld = this.map && this.map.currentMapName && this.map.currentMapName.startsWith('ItemWorld');
        this.isItemWorld = isItemWorld;

        // Ensure stats have defaults
        this.stats.aggroRange = this.stats.aggroRange || 200;
        if (isItemWorld) {
            // Cap aggro range on procedural maps so they act as territory-based guardians
            this.stats.aggroRange = Math.min(this.stats.aggroRange, 160);
        }
        
        this.stats.attackRange = 120; // 120px allows launching beautiful, dynamic leaps
        this.stats.attackCooldown = this.stats.attackCooldown || 2;
        this.stats.speed = this.stats.speed || 80;

        this.spawnPoint = { x: this.currentPixelX, y: this.currentPixelY };
        this.leashRangeSq = isItemWorld ? (240 * 240) : Infinity; // Leash to spawn territory on ItemWorld maps
        
        this.collisionRadius = isItemWorld ? 9 : 12; // For dynamic collision checks

        // Stuck detection and rough pathfinding
        this.stuckTimer = 0;
        this.lastPixelPos = { x: this.currentPixelX, y: this.currentPixelY };
        this.stuckThreshold = 0.5; // seconds before initiating pathfinding
        this.pathfindingCooldown = 0; // cooldown in seconds before re-calculating path
        this.currentPath = null;
        this.pathIndex = 0;
        this.backingUpTimer = 0;
        this.backupDirection = { x: 0, y: 0 };

        // New properties for respawning
        this.respawnTimer = 0;
        this.RESPAWN_TIME = 15; // 15 seconds

        // Custom ability paint flash timers
        this.selfDamageFlashTimer = 0;
        this.healingFlashTimer = 0;
    }

    update(deltaTime) {
        if (this.engine.dialogueUI && this.engine.dialogueUI.isVisible && this.engine.dialogueUI.participants && this.engine.dialogueUI.participants.length > 0) {
            const activeNpc = this.engine.dialogueUI.participants[0];
            const nameLower = activeNpc && activeNpc.name ? activeNpc.name.toLowerCase() : '';
            if (nameLower.includes('portal merchant') || (activeNpc && activeNpc.id === 'npc_portal_merchant_cleared')) {
                // Pause enemy AI, updates, and movement completely while talking to Portal Merchant in the rift
                return;
            }
        }

        if (this.aiState === AI_STATE.DEAD) {
            this.respawnTimer -= deltaTime;
            if (this.respawnTimer <= 0) {
                this.respawn();
            }
            return; // Do nothing else if dead
        }

        // Proximity Wake-Up Optimization:
        // Skip AI tick, pathfinding, and expensive static collision checks (which iterate through all map gameObjects)
        // when the enemy is outside the active screen wake-up radius of the player (700px).
        if (this.player) {
            const pdx = this.player.currentPixelX - this.currentPixelX;
            const pdy = this.player.currentPixelY - this.currentPixelY;
            const distSq = pdx * pdx + pdy * pdy;
            if (distSq > 700 * 700) {
                return; // Sleep
            }
        }

        // Update timers
        this.attackTimer = Math.max(0, this.attackTimer - deltaTime);
        if (this.landingSquashTimer > 0) {
            this.landingSquashTimer = Math.max(0, this.landingSquashTimer - deltaTime);
        }
        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer -= deltaTime;
            if (this.hitFlashTimer <= 0) {
                this.isHit = false;
            }
        }
        if (this.selfDamageFlashTimer > 0) {
            this.selfDamageFlashTimer = Math.max(0, this.selfDamageFlashTimer - deltaTime);
        }
        if (this.healingFlashTimer > 0) {
            this.healingFlashTimer = Math.max(0, this.healingFlashTimer - deltaTime);
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

        // Ensure we resolve static collisions on landing or while grounded,
        // even during the attack active/recovery phase when normal movement is locked!
        if (this.aiState === AI_STATE.ATTACKING && this.attackSubState !== 'startup') {
            this.resolveStaticCollisions();
        }
    }

    findCurrentTarget() {
        let possibleTargets = [];

        if (this.friendly === true) {
            // Friendly minions scan for Enemy Minions, Enemy Sentry Towers, and Enemy Merchant Scruffy
            if (this.engine && this.engine.gameObjects) {
                for (const obj of this.engine.gameObjects) {
                    if (obj.stats && obj.stats.hp > 0) {
                        if (obj instanceof Enemy && obj.friendly !== true) {
                            const dist = this.getDistanceTo(obj);
                            possibleTargets.push({
                                obj: obj,
                                type: 'enemy_slime',
                                priority: 2,
                                distance: dist
                            });
                        } else if (obj.type === 'tower_enemy' && !obj.stats.isDestroyed) {
                            const dist = this.getDistanceTo(obj);
                            possibleTargets.push({
                                obj: obj,
                                type: 'tower',
                                priority: 1,
                                distance: dist
                            });
                        } else if (obj instanceof NPC && obj.name.toLowerCase().includes('scruffy')) {
                            const dist = this.getDistanceTo(obj);
                            possibleTargets.push({
                                obj: obj,
                                type: 'nexus_shopkeeper',
                                priority: 3,
                                distance: dist
                            });
                        }
                    }
                }
            }
        } else {
            // Standard enemy minions scan for Player, Friendly Allied Minions, Allied Sentry Towers, and Shopkeeper Doran
            if (this.player && this.player.stats.hp > 0) {
                const dist = this.getDistanceTo(this.player);
                possibleTargets.push({
                    obj: this.player,
                    type: 'player',
                    priority: 2,
                    distance: dist
                });
            }

            if (this.engine && this.engine.gameObjects) {
                for (const obj of this.engine.gameObjects) {
                    if (obj.stats && obj.stats.hp > 0) {
                        if (obj instanceof Enemy && obj.friendly === true) {
                            const dist = this.getDistanceTo(obj);
                            possibleTargets.push({
                                obj: obj,
                                type: 'friendly_slime',
                                priority: 2,
                                distance: dist
                            });
                        } else if (obj.type === 'tower_player' && !obj.stats.isDestroyed) {
                            const dist = this.getDistanceTo(obj);
                            possibleTargets.push({
                                obj: obj,
                                type: 'tower',
                                priority: 1,
                                distance: dist
                            });
                        } else if (obj instanceof NPC && obj.name.toLowerCase().includes('doran')) {
                            const dist = this.getDistanceTo(obj);
                            possibleTargets.push({
                                obj: obj,
                                type: 'nexus_shopkeeper',
                                priority: 3,
                                distance: dist
                            });
                        }
                    }
                }
            }
        }

        if (possibleTargets.length === 0) return null;

        // Sort: Sentry Towers block progress with high pull bias, standard units next, Nexuses last
        possibleTargets.sort((a, b) => {
            const scoreA = a.distance - (a.type === 'tower' ? 180 : (a.type === 'player' || a.type === 'enemy_slime' || a.type === 'friendly_slime' ? 100 : 0));
            const scoreB = b.distance - (b.type === 'tower' ? 180 : (b.type === 'player' || b.type === 'enemy_slime' || b.type === 'friendly_slime' ? 100 : 0));
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

    updatePathfinding(deltaTime, targetX, targetY) {
        if (this.pathfindingCooldown > 0) {
            this.pathfindingCooldown -= deltaTime;
        }

        // Performance & Combat Clustering Optimization:
        // Skip pathfinding and wiggling/stuck-recalculations entirely when chasing and close to target.
        // Slimes in combat have leaps and abilities to get out and can slide around each other cleanly.
        if (this.aiState === AI_STATE.CHASING && this.currentTarget && !this.currentPath) {
            const tdx = targetX - this.currentPixelX;
            const tdy = targetY - this.currentPixelY;
            const distToTarget = Math.sqrt(tdx * tdx + tdy * tdy);
            if (distToTarget < 80) {
                this.stuckTimer = 0;
                return { tx: targetX, ty: targetY };
            }
        }

        // Handle backing up if active (to steer away from the obstacle/group)
        if (this.backingUpTimer > 0) {
            this.backingUpTimer -= deltaTime;
            // Guide towards the backed-up/sidestepped target
            return { tx: this.currentPixelX + this.backupDirection.x * 30, ty: this.currentPixelY + this.backupDirection.y * 30 };
        }

        // Track actual movement behavior
        const dx = this.currentPixelX - this.lastPixelPos.x;
        const dy = this.currentPixelY - this.lastPixelPos.y;
        const distMoved = Math.sqrt(dx * dx + dy * dy);

        this.lastPixelPos.x = this.currentPixelX;
        this.lastPixelPos.y = this.currentPixelY;

        const expectedMoveDist = this.stats.speed * deltaTime;
        const wantsToMove = (this.aiState === AI_STATE.CHASING || this.aiState === AI_STATE.RETURNING || this.aiState === AI_STATE.IDLE);

        if (wantsToMove && distMoved < expectedMoveDist * 0.2) {
            this.stuckTimer += deltaTime;
        } else {
            this.stuckTimer = Math.max(0, this.stuckTimer - deltaTime * 0.5);
        }

        // Trigger pathfind query and backup mode if stuck
        if (this.stuckTimer > this.stuckThreshold) {
            // Determine a neat backup angle opposite of where we want to go
            const tdx = targetX - this.currentPixelX;
            const tdy = targetY - this.currentPixelY;
            const dist = Math.sqrt(tdx * tdx + tdy * tdy);
            
            if (dist > 0.1) {
                const oppositeAngle = Math.atan2(-tdy, -tdx);
                // Sidestep rotated by +/- 45 to 90 degrees
                const rotation = (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 4 + Math.random() * Math.PI / 4);
                const backupAngle = oppositeAngle + rotation;
                this.backupDirection = {
                    x: Math.cos(backupAngle),
                    y: Math.sin(backupAngle)
                };
            } else {
                const randAngle = Math.random() * Math.PI * 2;
                this.backupDirection = {
                    x: Math.cos(randAngle),
                    y: Math.sin(randAngle)
                };
            }

            this.backingUpTimer = 0.4 + Math.random() * 0.4; // back away for 0.4s to 0.8s
            this.stuckTimer = 0;
            this.currentPath = null; // Clear old stuck path to recalculate beautifully

            if (this.pathfindingCooldown <= 0) {
                this.currentPath = this.map.findPixelPath(this.currentPixelX, this.currentPixelY, targetX, targetY);
                this.pathIndex = 0;
                this.pathfindingCooldown = 1.0; // Cooldown to avoid high query frequency
            }
        }

        // Direct path checkpoints override
        if (this.currentPath && this.currentPath.length > 0) {
            const nextNode = this.currentPath[this.pathIndex];
            if (nextNode) {
                const ndx = nextNode.x - this.currentPixelX;
                const ndy = nextNode.y - this.currentPixelY;
                const distToNode = Math.sqrt(ndx * ndx + ndy * ndy);

                if (distToNode < 18) {
                    this.pathIndex++;
                    if (this.pathIndex >= this.currentPath.length) {
                        this.currentPath = null;
                    }
                } else {
                    targetX = nextNode.x;
                    targetY = nextNode.y;
                }
            } else {
                this.currentPath = null;
            }
        }

        return { tx: targetX, ty: targetY };
    }

    resolveStaticCollisions() {
        if (!this.map) return;
        
        let center = { x: this.currentPixelX, y: this.currentPixelY - GLOBAL_COLLISION_Y_OFFSET };
        let push = this.map.getStaticPushVector(center, this.collisionRadius, this.engine.gameObjects);
        
        if (push.count > 0) {
            this.currentPixelX += push.x;
            this.currentPixelY += push.y;
            this.updateMapCoordsFromPixels();
        }

        // Check if enemy is on empty tile (abyss) or out of bounds, and nudge them back to safe terrain
        const mapCoords = this.map.screenToMap(this.currentPixelX, this.currentPixelY);
        const tileX = Math.floor(mapCoords.x);
        const tileY = Math.floor(mapCoords.y);
        
        if (tileX < 0 || tileX >= this.map.width || tileY < 0 || tileY >= this.map.height || this.map.tiles[tileY][tileX] === 0) {
            let bestTile = null;
            let minDistSq = Infinity;
            
            // Search a small neighborhood for safe terrain
            for (let dy = -4; dy <= 4; dy++) {
                for (let dx = -4; dx <= 4; dx++) {
                    const tx = tileX + dx;
                    const ty = tileY + dy;
                    if (tx >= 0 && tx < this.map.width && ty >= 0 && ty < this.map.height) {
                        if (this.map.tiles[ty][tx] !== 0) {
                            const tileCenterScreen = this.map.mapToScreen(tx + 0.5, ty + 0.5);
                            const dSq = (tileCenterScreen.x - this.currentPixelX)**2 + (tileCenterScreen.y - this.currentPixelY)**2;
                            if (dSq < minDistSq) {
                                minDistSq = dSq;
                                bestTile = tileCenterScreen;
                            }
                        }
                    }
                }
            }
            if (bestTile) {
                const dx = bestTile.x - this.currentPixelX;
                const dy = bestTile.y - this.currentPixelY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    this.currentPixelX += dx;
                    this.currentPixelY += dy;
                    this.updateMapCoordsFromPixels();
                }
            }
        }
    }

    executeAIState(deltaTime) {
        let targetX, targetY;

        switch (this.aiState) {
            case AI_STATE.IDLE:
                if (this.isItemWorld) {
                    // On ItemWorld maps, idle monsters just stay near their spawn point and guard it
                    this.currentPath = null;
                    break;
                }
                let marchX = -320;
                let marchY = 528;
                if (this.engine && this.engine.map && this.engine.map.spawnPointsData) {
                    if (this.friendly === true) {
                        // Friendly minions march towards Enemy Spawn/Base at mapX = 13.2
                        const enemySpawn = this.engine.map.spawnPointsData.find(sp => sp.id === 'spawn_pt_enemy_base');
                        if (enemySpawn) {
                            const enemyMapCoords = this.map.screenToMap(enemySpawn.x, enemySpawn.y);
                            const alignedScreen = this.map.mapToScreen(13.2, enemyMapCoords.y);
                            marchX = alignedScreen.x;
                            marchY = alignedScreen.y;
                        } else {
                            marchX = 288;
                            marchY = 224;
                        }
                    } else {
                        // Hostile minions march towards Allied Base at mapX = 13.2
                        const playerSpawn = this.engine.map.spawnPointsData.find(sp => sp.type === 'player_entry');
                        if (playerSpawn) {
                            const playerMapCoords = this.map.screenToMap(playerSpawn.x, playerSpawn.y);
                            const alignedScreen = this.map.mapToScreen(13.2, playerMapCoords.y);
                            marchX = alignedScreen.x;
                            marchY = alignedScreen.y;
                        }
                    }
                }
                const marchTarget = this.updatePathfinding(deltaTime, marchX, marchY);
                this.moveTowards(deltaTime, marchTarget.tx - this.currentPixelX, marchTarget.ty - this.currentPixelY, this.stats.speed * 0.65);
                break;
            case AI_STATE.RETURNING:
                targetX = this.spawnPoint.x;
                targetY = this.spawnPoint.y;
                const distToSpawnSq = (this.currentPixelX - targetX)**2 + (this.currentPixelY - targetY)**2;
                if (distToSpawnSq < 25) { // Close enough to spawn
                    this.aiState = AI_STATE.IDLE;
                    this.stats.hp = this.stats.maxHp; // Reset HP when returning
                    this.currentPath = null;
                } else {
                    const returnTarget = this.updatePathfinding(deltaTime, targetX, targetY);
                    this.moveTowards(deltaTime, returnTarget.tx - this.currentPixelX, returnTarget.ty - this.currentPixelY, this.stats.speed * 0.7);
                }
                break;
            case AI_STATE.CHASING:
                if (this.currentTarget) {
                    targetX = this.currentTarget.currentPixelX;
                    targetY = this.currentTarget.currentPixelY;
                    const chaseTarget = this.updatePathfinding(deltaTime, targetX, targetY);
                    this.moveTowards(deltaTime, chaseTarget.tx - this.currentPixelX, chaseTarget.ty - this.currentPixelY, this.stats.speed);
                } else {
                    this.aiState = AI_STATE.IDLE;
                    this.currentPath = null;
                }
                break;
            case AI_STATE.ATTACKING:
                this.currentPath = null;
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
                    this.landingSquashTimer = 0.35; // Trigger bounciness on landing
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
                // Deal damage to appropriate targets in landing AoE
                if (!this.hasDealtDamage) {
                    const ellipseCenter = { x: this.attackAction.targetPos.x, y: this.attackAction.targetPos.y - GLOBAL_COLLISION_Y_OFFSET };
                    const radiusX = this.attackAction.aoeShape.radiusX;
                    const radiusY = this.attackAction.aoeShape.radiusY;

                    const targets = [];
                    if (this.friendly === true) {
                        // Allied friendly slime targets enemy units/structures
                        if (this.engine && this.engine.gameObjects) {
                            for (const obj of this.engine.gameObjects) {
                                if (obj.stats && obj.stats.hp > 0) {
                                    if (obj instanceof Enemy && obj.friendly !== true) {
                                        targets.push(obj);
                                    } else if (obj.type === 'tower_enemy' && !obj.stats.isDestroyed) {
                                        targets.push(obj);
                                    } else if (obj instanceof NPC && obj.name.toLowerCase().includes('scruffy')) {
                                        targets.push(obj);
                                    }
                                }
                            }
                        }
                    } else {
                        // Hostile slime targets player, allied slimes, and allied structures
                        if (this.player && this.player.stats.hp > 0) {
                            targets.push(this.player);
                        }
                        if (this.engine && this.engine.gameObjects) {
                            for (const obj of this.engine.gameObjects) {
                                if (obj.stats && obj.stats.hp > 0) {
                                    if (obj instanceof Enemy && obj.friendly === true) {
                                        targets.push(obj);
                                    } else if (obj.type === 'tower_player' && !obj.stats.isDestroyed) {
                                        targets.push(obj);
                                    } else if (obj instanceof NPC && obj.name.toLowerCase().includes('doran')) {
                                        targets.push(obj);
                                    }
                                }
                            }
                        }
                    }

                    // Scan and resolve hits caught in the AoE ellipse
                    for (const victim of targets) {
                        const victimX = victim.currentPixelX;
                        const victimY = victim.currentPixelY - 16;
                        const vdx = victimX - ellipseCenter.x;
                        const vdy = victimY - ellipseCenter.y;

                        if (((vdx * vdx) / (radiusX * radiusX) + (vdy * vdy) / (radiusY * radiusY)) <= 1.25) {
                            if (victim === this.player) {
                                this.player.takeDamage(this.stats.atk, this);
                                // Apply knockback to player
                                const knockbackDirection = {
                                    x: this.player.currentPixelX - this.currentPixelX,
                                    y: this.player.currentPixelY - this.currentPixelY
                                };
                                this.player.applyKnockback(knockbackDirection, this.attackAction.knockbackForce);
                            } else {
                                victim.takeDamage(this.stats.atk, this);
                            }
                            this.hasDealtDamage = true;
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
                const center = { x: targetPx, y: targetPy - GLOBAL_COLLISION_Y_OFFSET };
                return this.map.checkStaticCollisionAt(center, this.collisionRadius, this.engine.gameObjects);
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

        this.resolveStaticCollisions();
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

        // Add physical splatter particle effect
        const isPinkSlime = this.friendly === true || (this.name && this.name.toLowerCase().includes('allied'));
        const pColor = isPinkSlime ? '#e91e63' : '#8bc34a';
        if (typeof ParticleSplatterEffect !== 'undefined') {
            this.engine.addEffect(new ParticleSplatterEffect(this.engine, {
                position: { x: this.currentPixelX, y: this.currentPixelY },
                color: pColor,
                count: 8,
                duration: 0.45
            }));
        }

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
        // Volatile Sludge modifier: explode on death!
        const itemWorldState = this.engine.activeItemWorld;
        if (itemWorldState && Array.isArray(itemWorldState.activeModifiers)) {
            const hasVolatile = itemWorldState.activeModifiers.some(mod => mod.key === 'volatile_sludge');
            if (hasVolatile) {
                // Spawn a gorgeous fire ring effect
                if (typeof ParticleSplatterEffect !== 'undefined') {
                    this.engine.addEffect(new ParticleSplatterEffect(this.engine, {
                        position: { x: this.currentPixelX, y: this.currentPixelY },
                        color: '#ff4500', // Fire orange
                        count: 36,
                        duration: 0.9,
                        spread: 4.0
                    }));
                }
                
                // Deal 5 damage to player if they are close!
                if (this.player && this.player.stats && this.player.stats.hp > 0) {
                    const dx = this.player.currentPixelX - this.currentPixelX;
                    const dy = this.player.currentPixelY - this.currentPixelY;
                    const distSq = dx*dx + dy*dy;
                    const explosionRadius = 90; // pixels
                    if (distSq < explosionRadius * explosionRadius) {
                        this.player.takeDamage(5); // Deal 5 volatile explosion damage!
                        
                        // Add floating red text for feedback
                        if (typeof FloatingTextEffect !== 'undefined') {
                            this.engine.addEffect(new FloatingTextEffect(this.engine, {
                                text: "💥 Volatile Sludge! -5 HP",
                                position: { x: this.player.currentPixelX, y: this.player.currentPixelY - 40 },
                                color: '#e74c3c'
                            }));
                        }
                    }
                }
            }
        }

        this.aiState = AI_STATE.DEAD;
        this.collidable = false; // Become non-collidable
        this.respawnTimer = this.RESPAWN_TIME;
        this.attackSubState = 'none'; // Cancel any ongoing attack
        this.attackAction.targetPos = null;
        this.visualYOffset = 0; // Reset visual offset
        this.isHit = false; // Turn off hit flash on death

        // Add massive physical splatter particle explosion on death
        const isPinkSlime = this.friendly === true || (this.name && this.name.toLowerCase().includes('allied'));
        const pColor = isPinkSlime ? '#e91e63' : '#8bc34a';
        if (typeof ParticleSplatterEffect !== 'undefined') {
            this.engine.addEffect(new ParticleSplatterEffect(this.engine, {
                position: { x: this.currentPixelX, y: this.currentPixelY },
                color: pColor,
                count: 24,
                duration: 0.75
            }));
        }

        // If player is targeting this enemy, clear their target
        if (this.player && this.player.currentTarget === this) {
            this.player.currentTarget = null;
        }

        // Reward Gold & XP only for hostile slimes & boss
        const isSlimeOrWarden = (this.name && (this.name.toLowerCase().includes('slime') || this.name.toLowerCase().includes('warden')));
        const isHostile = !this.friendly;

        if (this.player && isHostile && isSlimeOrWarden) {
            let finalGoldReward = Math.floor(Math.random() * 8) + 12; // 12-19 gold
            
            const itemWorldState = this.engine.activeItemWorld;
            if (itemWorldState && Array.isArray(itemWorldState.activeModifiers)) {
                const hasGoldFever = itemWorldState.activeModifiers.some(mod => mod.key === 'gold_fever');
                if (hasGoldFever) {
                    finalGoldReward *= 2; // Tome of Midas double gold drops!
                }
            }

            const goldReward = finalGoldReward;
            const xpReward = Math.floor(Math.random() * 6) + 15; // 15-20 XP

            const isAlreadyFullyCleared = itemWorldState && (itemWorldState.isFinishedAndCleared || itemWorldState.enemiesKilled >= itemWorldState.enemiesTotal);

            if (!isAlreadyFullyCleared) {
                this.player.gold = (this.player.gold || 0) + goldReward;
                
                // Bring FloatingTextEffect locally
                const FloatingTextEffectClass = FloatingTextEffect || null;
                if (FloatingTextEffectClass && this.engine) {
                    this.engine.addEffect(new FloatingTextEffectClass(this.engine, {
                        text: `+${goldReward} Gold`,
                        position: { x: this.currentPixelX, y: this.currentPixelY - 40 },
                        color: '#FFD700'
                    }));
                }

                // Grant Character XP
                if (typeof this.player.gainExp === 'function') {
                    this.player.gainExp(xpReward);
                }

                // Core Item World logic integration
                if (itemWorldState) {
                    itemWorldState.enemiesKilled++;
                    
                    // Grant Item XP
                    const itemXPReward = Math.floor((Math.random() * 10 + 20) * itemWorldState.itemXPMultiplier);
                    if (typeof this.player.gainItemExp === 'function') {
                        this.player.gainItemExp(itemWorldState.slottedItem, itemXPReward);
                    }

                    // Auto claim victory when all slimes killed or Warden defeated
                    const isNowCleared = itemWorldState.enemiesKilled >= itemWorldState.enemiesTotal;
                    const isWarden = this.name && this.name.includes("Warden");

                    if (isNowCleared || isWarden) {
                        const dev = this.engine.editorManager?.editors.chaos_map_device;
                        if (dev && typeof dev.onItemWorldCleared === 'function') {
                            dev.onItemWorldCleared();
                        }
                    } else {
                        // Update HUD status display
                        const dev = this.engine.editorManager?.editors.chaos_map_device;
                        if (dev && typeof dev.updateHUDStatus === 'function') {
                            dev.updateHUDStatus();
                        }
                    }
                }
            } else {
                // Diminishing returns: play zero-outcome gray floating indicator
                const FloatingTextEffectClass = FloatingTextEffect || null;
                if (FloatingTextEffectClass && this.engine) {
                    this.engine.addEffect(new FloatingTextEffectClass(this.engine, {
                        text: `0 XP / 0 Gold (Realm Cleared)`,
                        position: { x: this.currentPixelX, y: this.currentPixelY - 40 },
                        color: '#7f8c8d'
                    }));
                }
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

        // Draw PoE-style colored ground circlet/aura
        if (this.poeAuraColor) {
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(anchorCanvasX, anchorCanvasY - 4, 18 * (this.poeScale || 1.0), 9 * (this.poeScale || 1.0), 0, 0, Math.PI * 2);
            ctx.fillStyle = this.poeAuraColor;
            ctx.fill();
            ctx.strokeStyle = this.poeAuraBorderColor || '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
        }

        // Draw trailing PoE elemental particle orbits!
        if (this.poeModifiers && this.poeModifiers.length > 0) {
            ctx.save();
            const numParticles = 3;
            const radiusX = 14 * (this.poeScale || 1.0);
            const radiusY = 7 * (this.poeScale || 1.0);
            const time = (this.engine.lastTimestamp || Date.now()) / 400; // time factor
            
            for (let i = 0; i < numParticles; i++) {
                const angle = time + (i * Math.PI * 2 / numParticles);
                const px = anchorCanvasX + Math.cos(angle) * radiusX;
                const py = anchorCanvasY - 12 - Math.sin(angle) * radiusY + Math.sin(time * 3 + i) * 3; // orbit slightly above floor
                
                ctx.beginPath();
                ctx.arc(px, py, 3, 0, Math.PI * 2);
                ctx.fillStyle = this.poeParticleColor || '#ffd700';
                ctx.shadowColor = this.poeParticleColor || '#ffd700';
                ctx.shadowBlur = 4;
                ctx.fill();
            }
            ctx.restore();
        }
    
        let scaleX = 1.0;
        let scaleY = 1.0;
        if (this.isHit && this.hitFlashTimer > 0) {
            const ratio = this.hitFlashTimer / 0.15; // 1.0 down to 0.0
            scaleX = 1.4 - 0.4 * (1.0 - ratio); // Wide hit impact (anticipation/recoil)
            scaleY = 0.6 + 0.4 * (1.0 - ratio); // Flat hit impact
        } else if (this.attackSubState === 'startup') {
            const progress = 1.0 - (this.attackAction.timer / this.attackAction.startupDuration);
            if (progress < 0.15) {
                // 1. Anticipation squash (0.0 to 0.15): charging up the power
                const norm = progress / 0.15;
                scaleX = 1.0 + 0.3 * norm;
                scaleY = 1.0 - 0.3 * norm;
            } else if (progress < 0.85) {
                // 2. Flight stretch (0.15 to 0.85): vertical elongation
                const norm = (progress - 0.15) / 0.7;
                const stretch = Math.sin(norm * Math.PI);
                scaleX = 1.0 - 0.35 * stretch;
                scaleY = 1.0 + 0.45 * stretch;
            } else {
                // 3. Ready to impact squash (0.85 to 1.0)
                const norm = (progress - 0.85) / 0.15;
                scaleX = 1.0 + 0.15 * norm;
                scaleY = 1.0 - 0.15 * norm;
            }
        } else if (this.landingSquashTimer > 0) {
            // Organic decay wave oscillation (ballooning / bouncy material simulation)
            const ratio = this.landingSquashTimer / 0.35; // 1.0 down to 0.0
            const wave = Math.sin(ratio * Math.PI * 3.5) * ratio; // dampening wave
            scaleX = 1.0 + wave * 0.45;
            scaleY = 1.0 - wave * 0.45;
        }

        const drawW = this.visualWidth * scaleX;
        const drawH = this.visualHeight * scaleY;
        const spriteDrawX = anchorCanvasX - (this.anchorOffsetX * scaleX);
        const spriteDrawY = anchorCanvasY - (this.anchorOffsetY * scaleY);
    
        ctx.save();
        if (this.friendly === true) {
            ctx.filter = 'hue-rotate(240deg)';
        } else if (this.colorTintFilter) {
            ctx.filter = this.colorTintFilter;
        }
        if (this.spriteSourceRect) {
            ctx.drawImage(
                this.sprite,
                this.spriteSourceRect.x, this.spriteSourceRect.y,
                this.spriteSourceRect.width, this.spriteSourceRect.height,
                spriteDrawX, spriteDrawY,
                drawW, drawH
            );
        } else {
            ctx.drawImage(
                this.sprite,
                spriteDrawX, spriteDrawY,
                drawW, drawH
            );
        }
        ctx.restore();

        // Crimson / Red Paint Tint for Self Damage Blood cast
        if (this.selfDamageFlashTimer && this.selfDamageFlashTimer > 0) {
            ctx.save();
            if (this.friendly === true) {
                ctx.filter = 'hue-rotate(240deg)';
            }
            ctx.globalAlpha = 0.65 * (this.selfDamageFlashTimer / 0.4);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = Math.ceil(drawW) || 1;
            tempCanvas.height = Math.ceil(drawH) || 1;
            const tempCtx = tempCanvas.getContext('2d');
            if (this.spriteSourceRect) {
                tempCtx.drawImage(
                    this.sprite,
                    this.spriteSourceRect.x, this.spriteSourceRect.y,
                    this.spriteSourceRect.width, this.spriteSourceRect.height,
                    0, 0, tempCanvas.width, tempCanvas.height
                );
            } else {
                tempCtx.drawImage(this.sprite, 0, 0, tempCanvas.width, tempCanvas.height);
            }
            tempCtx.globalCompositeOperation = 'source-atop';
            tempCtx.fillStyle = '#e74c3c'; // red
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            ctx.drawImage(tempCanvas, spriteDrawX, spriteDrawY);
            ctx.restore();
        }

        // Green / Emerald Paint Tint for Healing Siphons
        if (this.healingFlashTimer && this.healingFlashTimer > 0) {
            ctx.save();
            if (this.friendly === true) {
                ctx.filter = 'hue-rotate(240deg)';
            }
            ctx.globalAlpha = 0.65 * (this.healingFlashTimer / 0.45);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = Math.ceil(drawW) || 1;
            tempCanvas.height = Math.ceil(drawH) || 1;
            const tempCtx = tempCanvas.getContext('2d');
            if (this.spriteSourceRect) {
                tempCtx.drawImage(
                    this.sprite,
                    this.spriteSourceRect.x, this.spriteSourceRect.y,
                    this.spriteSourceRect.width, this.spriteSourceRect.height,
                    0, 0, tempCanvas.width, tempCanvas.height
                );
            } else {
                tempCtx.drawImage(this.sprite, 0, 0, tempCanvas.width, tempCanvas.height);
            }
            tempCtx.globalCompositeOperation = 'source-atop';
            tempCtx.fillStyle = '#2ecc71'; // green
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            ctx.drawImage(tempCanvas, spriteDrawX, spriteDrawY);
            ctx.restore();
        }

        // --- Render Hit Flash ---
        if (this.isHit) {
            ctx.save();
            if (this.friendly === true) {
                ctx.filter = 'hue-rotate(240deg)';
            }
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.8 * (this.hitFlashTimer / 0.15); // Fade the flash out
            
            // Re-draw the sprite with the same squeeze effect
            if (this.spriteSourceRect) {
                ctx.drawImage(
                    this.sprite,
                    this.spriteSourceRect.x, this.spriteSourceRect.y,
                    this.spriteSourceRect.width, this.spriteSourceRect.height,
                    spriteDrawX, spriteDrawY,
                    drawW, drawH
                );
            } else {
                ctx.drawImage(
                    this.sprite,
                    spriteDrawX, spriteDrawY,
                    drawW, drawH
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
            ctx.fillStyle = (this.friendly === true) ? '#3498db' : '#e74c3c'; // Faction Blue for Allied friendly minions, Red for enemies
            ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
        }

        // --- Render Name ---
        const nameYOffset = this.visualHeight + 5;
        ctx.fillStyle = (this.friendly === true) ? '#3498db' : '#EFEBE0';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(this.name, drawX, drawY - nameYOffset);

        // Render PoE golden sub-details
        if (this.poeModifiers && this.poeModifiers.length > 0) {
            ctx.save();
            ctx.fillStyle = '#f1c40f'; // Golden rare color
            ctx.font = 'bold 8px Arial';
            ctx.fillText(this.poeModifiers.join(', '), drawX, drawY - nameYOffset - 11);
            ctx.restore();
        }
    }
}

export default Enemy;