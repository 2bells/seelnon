// JRPG Isometric Game Engine Ability System
console.log("game/combat/ability_system.js loaded");

import { FloatingTextEffect, TelegraphEffect } from './effects.js';
import GameObject from '../entities/gameObject.js';

export const DEFAULT_ABILITIES = {
    'slime_leap': {
        id: 'slime_leap',
        name: 'Slime Leap',
        cooldown: 2.0,
        range: 120,
        costHp: 0,
        healing: 0,
        targetType: 'closest_enemy',
        startup: {
            duration: 0.8,
            lockMovement: true,
            lockTurn: false,
            disableCollision: true,
            dashSpeed: 100, // moves on arc
            jumpHeight: 45,
            hpChange: 0
        },
        active: {
            duration: 0.2,
            damage: 12,
            knockbackForce: 150,
            hpChange: 0,
            healing: 0,
            hitboxShape: { type: 'ellipse', radiusX: 40, radiusY: 20 },
            createObstacle: false
        },
        recovery: {
            duration: 1.0,
            lockMovement: true,
            lockTurn: true,
            slideSpeed: 0
        }
    },
    'dash_strike': {
        id: 'dash_strike',
        name: 'Dash Strike',
        cooldown: 3.0,
        range: 150,
        costHp: 0,
        healing: 0,
        targetType: 'direction_mouse',
        startup: {
            duration: 0.2,
            lockMovement: true,
            lockTurn: false,
            disableCollision: false,
            dashSpeed: 450,
            jumpHeight: 0,
            hpChange: 0
        },
        active: {
            duration: 0.15,
            damage: 15,
            knockbackForce: 80,
            hpChange: 0,
            healing: 0,
            hitboxShape: { type: 'ellipse', radiusX: 50, radiusY: 30 },
            createObstacle: false
        },
        recovery: {
            duration: 0.3,
            lockMovement: true,
            lockTurn: false,
            slideSpeed: 50
        }
    },
    'blood_siphon': {
        id: 'blood_siphon',
        name: 'Blood Siphon',
        cooldown: 5.0,
        range: 100,
        costHp: 15, // Costs 15 HP to cast (blood magic)
        healing: 30, // Heals 30 on hit
        targetType: 'closest_enemy',
        startup: {
            duration: 0.4,
            lockMovement: true,
            lockTurn: true,
            disableCollision: false,
            dashSpeed: 50,
            jumpHeight: 10,
            hpChange: -15
        },
        active: {
            duration: 0.3,
            damage: 28, // High damage high reward
            knockbackForce: 50,
            hpChange: 0,
            healing: 30,
            hitboxShape: { type: 'ellipse', radiusX: 35, radiusY: 35 },
            createObstacle: false
        },
        recovery: {
            duration: 0.4,
            lockMovement: false,
            lockTurn: false,
            slideSpeed: 0
        }
    },
    'earth_wall': {
        id: 'earth_wall',
        name: 'Earth Wall',
        cooldown: 6.0,
        range: 100,
        costHp: 0,
        healing: 0,
        targetType: 'direction_mouse',
        startup: {
            duration: 0.4,
            lockMovement: true,
            lockTurn: false,
            disableCollision: false,
            dashSpeed: 0,
            jumpHeight: 0,
            hpChange: 0
        },
        active: {
            duration: 0.25,
            damage: 6,
            knockbackForce: 100,
            hpChange: 0,
            healing: 0,
            hitboxShape: { type: 'ellipse', radiusX: 30, radiusY: 20 },
            createObstacle: true
        },
        recovery: {
            duration: 0.5,
            lockMovement: true,
            lockTurn: true,
            slideSpeed: -60 // slide backwards away from the wall
        }
    }
};

const RPG_ABILITY_STORAGE_KEY = 'rpg_custom_abilities';

// Get all custom + default abilities
export function getAllAbilities() {
    let custom = {};
    try {
        const stored = localStorage.getItem(RPG_ABILITY_STORAGE_KEY);
        if (stored) {
            custom = JSON.parse(stored);
        }
    } catch (e) {
        console.error("Error parsing custom abilities:", e);
    }
    return { ...DEFAULT_ABILITIES, ...custom };
}

// Save custom abilities to local storage
export function saveCustomAbility(ability) {
    let custom = {};
    try {
        const stored = localStorage.getItem(RPG_ABILITY_STORAGE_KEY);
        if (stored) {
            custom = JSON.parse(stored);
        }
    } catch (e) {
        console.error("Error parsing custom abilities before save:", e);
    }
    custom[ability.id] = ability;
    localStorage.setItem(RPG_ABILITY_STORAGE_KEY, JSON.stringify(custom));
    console.log(`Saved custom ability "${ability.name}" to localStorage.`);
}

// Delete custom ability
export function deleteCustomAbility(abilityId) {
    let custom = {};
    try {
        const stored = localStorage.getItem(RPG_ABILITY_STORAGE_KEY);
        if (stored) {
            custom = JSON.parse(stored);
        }
    } catch (e) {
        console.error("Error parsing custom abilities before delete:", e);
    }
    if (custom[abilityId]) {
        delete custom[abilityId];
        localStorage.setItem(RPG_ABILITY_STORAGE_KEY, JSON.stringify(custom));
        return true;
    }
    return false;
}

// Temporary Rock/Obstacle spawned by Earth Wall
class TemporaryObstacle extends GameObject {
    constructor(engine, map, mapX, mapY) {
        // Create matching specs for a stone block
        const options = {
            id: `stone_wall_block_${Date.now()}_${Math.random()}`,
            type: 'generic',
            assetName: 'buildingSpritesheet',
            spriteSourceRect: {
                x: 66,
                y: 132,
                width: 64,
                height: 64
            },
            collidable: true,
            visualWidth: 64,
            visualHeight: 64,
            anchorOffsetX: 32,
            anchorOffsetY: 64,
            collisionShape: {
                type: 'rectangle',
                width: 48,
                height: 24
            }
        };
        super(engine, map, mapX, mapY, options);
        this.lifetime = 4.0; // last 4 seconds
    }

    update(deltaTime) {
        this.lifetime -= deltaTime;
        if (this.lifetime <= 0) {
            // Remove from engine gameObjects
            const index = this.engine.gameObjects.indexOf(this);
            if (index !== -1) {
                this.engine.gameObjects.splice(index, 1);
            }
        }
    }

    render(ctx, viewOriginX, viewOriginY) {
        // Draw standard plus a crumbling overlay based on lifetime
        super.render(ctx, viewOriginX, viewOriginY);
        
        // draw a cute red timer dot/fading outline on ground
        ctx.save();
        const ax = this.currentPixelX - viewOriginX;
        const ay = this.currentPixelY - viewOriginY;
        ctx.strokeStyle = `rgba(140, 109, 86, ${Math.min(1, this.lifetime)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(ax, ay - 8, 12, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

// Trigger ability casting
export function executeAbility(caster, abilityId, getTargetPosFn) {
    if (!caster || !abilityId) return false;

    // Fast cooldown validation
    caster.abilityCooldowns = caster.abilityCooldowns || {};
    if (caster.abilityCooldowns[abilityId] && caster.abilityCooldowns[abilityId] > 0) {
        console.log(`Ability "${abilityId}" is still on cooldown.`);
        return false;
    }

    const all = getAllAbilities();
    const ability = all[abilityId];
    if (!ability) {
        console.error(`Ability "${abilityId}" not found in lookup.`);
        return false;
    }

    // Resolve target position
    const targetPos = getTargetPosFn(ability);
    if (!targetPos) {
        console.warn(`Could not resolve target position for skill "${ability.name}"`);
        return false;
    }

    // Pay health cost
    if (ability.costHp && ability.costHp > 0) {
        if (caster.stats.hp <= ability.costHp) {
            // Too low health to cast
            if (caster === caster.engine.player) {
                caster.engine.addEffect(new FloatingTextEffect(caster.engine, {
                    text: "NOT ENOUGH HP!",
                    position: { x: caster.currentPixelX, y: caster.currentPixelY - 30 },
                    color: '#e74c3c'
                }));
            }
            return false;
        }
        caster.stats.hp -= ability.costHp;
        caster.engine.addEffect(new FloatingTextEffect(caster.engine, {
            text: `-${ability.costHp} HP`,
            position: { x: caster.currentPixelX, y: caster.currentPixelY - 20 },
            color: '#ff3333'
        }));
    }

    // Put on cooldown
    caster.abilityCooldowns[abilityId] = ability.cooldown;

    // Set caster variables
    caster.activeAbility = ability;
    caster.abilityState = 'startup';
    caster.abilityTimer = ability.startup.duration;
    caster.abilityStartPos = { x: caster.currentPixelX, y: caster.currentPixelY };
    caster.abilityTargetPos = { x: targetPos.x, y: targetPos.y };
    caster.abilityDealtDamage = false;

    if (ability.startup.disableCollision) {
        caster.collidable = false;
    }

    // Add Telegraph Ring
    caster.engine.addEffect(new TelegraphEffect(caster.engine, {
        type: 'telegraph',
        position: caster.abilityTargetPos,
        shape: ability.active.hitboxShape || { type: 'ellipse', radiusX: 30, radiusY: 15 },
        duration: ability.startup.duration,
        owner: caster
    }));

    console.log(`${caster.name || 'Caster'} is casting ability "${ability.name}"`);
    return true;
}

// Update caster ability ticks inside standard update loop
export function updateAbilityCycle(caster, deltaTime) {
    // 1. Tick Cooldowns
    caster.abilityCooldowns = caster.abilityCooldowns || {};
    for (const id in caster.abilityCooldowns) {
        if (caster.abilityCooldowns[id] > 0) {
            caster.abilityCooldowns[id] = Math.max(0, caster.abilityCooldowns[id] - deltaTime);
        }
    }

    // If no active ability, we have nothing to progress
    if (!caster.activeAbility || caster.abilityState === 'none') {
        return;
    }

    const ability = caster.activeAbility;
    caster.abilityTimer -= deltaTime;

    // 2. Startup Phase Progress
    if (caster.abilityState === 'startup') {
        const progress = Math.max(0, Math.min(1, 1 - (caster.abilityTimer / ability.startup.duration)));
        
        // Progress movement towards target pos
        const dx = caster.abilityTargetPos.x - caster.abilityStartPos.x;
        const dy = caster.abilityTargetPos.y - caster.abilityStartPos.y;
        
        // Sub-physics leap arc
        if (ability.startup.jumpHeight && ability.startup.jumpHeight > 0) {
            caster.visualYOffset = -Math.sin(progress * Math.PI) * ability.startup.jumpHeight;
        }

        // Apply motion
        if (ability.startup.dashSpeed && ability.startup.dashSpeed > 0) {
            caster.currentPixelX = caster.abilityStartPos.x + dx * progress;
            caster.currentPixelY = caster.abilityStartPos.y + dy * progress;
        }

        // Phase finished, trigger Active / Impact Phase
        if (caster.abilityTimer <= 0) {
            caster.currentPixelX = caster.abilityTargetPos.x;
            caster.currentPixelY = caster.abilityTargetPos.y;
            caster.visualYOffset = 0;
            caster.collidable = true; // guarantee solid landing

            if (typeof caster.updateMapCoordsFromPixels === 'function') {
                caster.updateMapCoordsFromPixels();
            }

            // Start active hitbox timer
            caster.abilityState = 'active';
            caster.abilityTimer = ability.active.duration;

            // Trigger visual hit effect
            caster.engine.addEffect(new TelegraphEffect(caster.engine, {
                type: 'active_aoe',
                position: caster.abilityTargetPos,
                shape: ability.active.hitboxShape || { type: 'ellipse', radiusX: 30, radiusY: 15 },
                duration: ability.active.duration,
                owner: caster
            }));

            // Deal Hit Damage/Knockback on victims
            triggerHitboxScanAndResolve(caster, ability);
        }
    }
    // 3. Active Phase Progress
    else if (caster.abilityState === 'active') {
        if (caster.abilityTimer <= 0) {
            // Transition to recovery
            caster.abilityState = 'recovery';
            caster.abilityTimer = ability.recovery.duration;
        }
    }
    // 4. Recovery Phase Progress
    else if (caster.abilityState === 'recovery') {
        // Apply slide movement along casting angle
        const dx = caster.abilityTargetPos.x - caster.abilityStartPos.x;
        const dy = caster.abilityTargetPos.y - caster.abilityStartPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0 && ability.recovery.slideSpeed && ability.recovery.slideSpeed !== 0) {
            const slideX = (dx / dist) * ability.recovery.slideSpeed * deltaTime;
            const slideY = (dy / dist) * ability.recovery.slideSpeed * deltaTime;
            
            // Check collisions before sliding, or let them slide slightly
            caster.currentPixelX += slideX;
            caster.currentPixelY += slideY;
            if (typeof caster.updateMapCoordsFromPixels === 'function') {
                caster.updateMapCoordsFromPixels();
            }
        }

        if (caster.abilityTimer <= 0) {
            // Ability complete, unlock!
            caster.activeAbility = null;
            caster.abilityState = 'none';
        }
    }
}

// Scans around the impact center and deals hits
function triggerHitboxScanAndResolve(caster, ability) {
    if (caster.abilityDealtDamage) return;
    caster.abilityDealtDamage = true;

    const center = caster.abilityTargetPos;
    const shape = ability.active.hitboxShape || { type: 'ellipse', radiusX: 30, radiusY: 15 };
    const radiusXSq = (shape.radiusX || shape.width / 2 || 30) ** 2;
    const radiusYSq = (shape.radiusY || shape.height / 2 || 15) ** 2;

    const isPlayerCaster = (caster === caster.engine.player);
    let hitOpponents = [];

    // Find valid victims (Dynamic items)
    for (const obj of caster.engine.gameObjects) {
        if (obj === caster || (obj.stats && obj.stats.hp <= 0)) continue;

        // Is it an enemy of the caster?
        const isEnemyVictim = (obj instanceof GameObject && obj.type && obj.type.includes('tower_player') === false);
        const shouldHit = isPlayerCaster 
            ? (obj.constructor.name === 'Enemy' || obj.type === 'tower_enemy')
            : (obj === caster.engine.player || obj.type === 'tower_player' || (obj.name && obj.name.toLowerCase().includes('doran')));
        
        if (shouldHit) {
            const dx = obj.currentPixelX - center.x;
            const dy = (obj.currentPixelY - 16) - center.y; // Match collision heights shifting
            
            // Ellipse coverage metric
            const coverage = (dx * dx) / radiusXSq + (dy * dy) / radiusYSq;
            if (coverage <= 1.0) {
                hitOpponents.push(obj);
            }
        }
    }

    // Also include Player if caster is an Enemy
    if (!isPlayerCaster && caster.engine.player) {
        const player = caster.engine.player;
        const dx = player.currentPixelX - center.x;
        const dy = (player.currentPixelY - 16) - center.y;
        const coverage = (dx * dx) / radiusXSq + (dy * dy) / radiusYSq;
        if (coverage <= 1.0) {
            hitOpponents.push(player);
        }
    }

    let dealDamageMultiplier = 1;
    // Apply HP changes
    if (hitOpponents.length > 0) {
        for (const victim of hitOpponents) {
            // Apply damage
            const dmg = ability.active.damage || 0;
            if (typeof victim.takeDamage === 'function') {
                victim.takeDamage(dmg, caster);
            } else if (victim.stats) {
                victim.stats.hp = Math.max(0, victim.stats.hp - dmg);
                caster.engine.addEffect(new FloatingTextEffect(caster.engine, {
                    text: `-${dmg}`,
                    position: { x: victim.currentPixelX, y: victim.currentPixelY - 20 },
                    color: '#ff4444'
                }));
            }

            // Apply push-out knockback vector
            const pushDir = {
                x: victim.currentPixelX - center.x,
                y: victim.currentPixelY - center.y
            };
            if (ability.active.knockbackForce && typeof victim.applyKnockback === 'function') {
                victim.applyKnockback(pushDir, ability.active.knockbackForce);
            }
        }

        // Apply health healing siphons
        if (ability.active.healing && ability.active.healing > 0) {
            caster.stats.hp = Math.min(caster.stats.maxHp, caster.stats.hp + ability.active.healing);
            caster.engine.addEffect(new FloatingTextEffect(caster.engine, {
                text: `+${ability.active.healing} HP`,
                position: { x: caster.currentPixelX, y: caster.currentPixelY - 30 },
                color: '#2ecc71'
            }));
        }
    } else {
        console.log(`Ability impact swept cleanly. No entities in range.`);
    }

    // "collisions that are created as well": Earth Wall rocks
    if (ability.active.createObstacle) {
        try {
            const mapCoords = caster.engine.map.screenToMap(center.x, center.y);
            // Spawn standard temporary solid rock obstacle on mapped tiles
            const stone = new TemporaryObstacle(caster.engine, caster.engine.map, Math.floor(mapCoords.x) + 0.5, Math.floor(mapCoords.y) + 0.5);
            caster.engine.gameObjects.push(stone);
            caster.engine.addEffect(new FloatingTextEffect(caster.engine, {
                text: "BARRIER CREATED!",
                position: { x: center.x, y: center.y - 20 },
                color: '#f39c12'
            }));
        } catch (e) {
            console.error("Collision placement failed:", e);
        }
    }
}
