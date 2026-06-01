// JRPG Isometric Game Engine Ability System
console.log("game/combat/ability_system.js loaded");

import { FloatingTextEffect, TelegraphEffect, ParticleSplatterEffect } from './effects.js';
import GameObject from '../entities/gameObject.js';
import { Emitter } from './projectiles.js';

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
            hitboxShape: { type: 'ellipse', radiusX: 60, radiusY: 30 },
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
            duration: 0.15,
            lockMovement: true,
            lockTurn: true,
            disableCollision: false,
            dashSpeed: 450,
            jumpHeight: 0,
            hpChange: 0
        },
        active: {
            duration: 0.1,
            damage: 15,
            knockbackForce: 80,
            hpChange: 0,
            healing: 0,
            hitboxShape: { type: 'ellipse', radiusX: 50, radiusY: 25 },
            createObstacle: false
        },
        recovery: {
            duration: 0.15,
            lockMovement: true,
            lockTurn: true,
            slideSpeed: 0
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
            duration: 0.2,
            lockMovement: true,
            lockTurn: true,
            disableCollision: false,
            dashSpeed: 50,
            jumpHeight: 10,
            hpChange: -15
        },
        active: {
            duration: 0.15,
            damage: 28, // High damage high reward
            knockbackForce: 50,
            hpChange: 0,
            healing: 30,
            hitboxShape: { type: 'ellipse', radiusX: 60, radiusY: 30 },
            createObstacle: false
        },
        recovery: {
            duration: 0.2,
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
            duration: 0.18,
            lockMovement: true,
            lockTurn: true,
            disableCollision: false,
            dashSpeed: 0,
            jumpHeight: 0,
            hpChange: 0
        },
        active: {
            duration: 0.12,
            damage: 6,
            knockbackForce: 100,
            hpChange: 0,
            healing: 0,
            hitboxShape: { type: 'ellipse', radiusX: 30, radiusY: 15 },
            createObstacle: true
        },
        recovery: {
            duration: 0.25,
            lockMovement: true,
            lockTurn: true,
            slideSpeed: -350 // fast backdash
        }
    },
    'plasma_orb': {
        id: 'plasma_orb',
        name: 'Plasma Orb',
        cooldown: 1.5,
        range: 220,
        costHp: 0,
        healing: 0,
        targetType: 'direction_mouse',
        hasEmitter: true,
        emitterConfig: {
            projectileType: 'starburst',
            projectileSpeed: 180,
            projectileColor: '#f1c40f',
            projectileRadius: 5,
            emoji: '',
            renderType: 'glow',
            damage: 18,
            burstCount: 5,
            sinFrequency: 10,
            sinAmplitude: 40
        },
        startup: {
            duration: 0.25,
            lockMovement: false,
            lockTurn: false,
            disableCollision: false,
            dashSpeed: 0,
            jumpHeight: 0,
            hpChange: 0
        },
        active: {
            duration: 0.1,
            damage: 0,
            knockbackForce: 10,
            hpChange: 0,
            healing: 0,
            hitboxShape: { type: 'ellipse', radiusX: 20, radiusY: 10 },
            createObstacle: false
        },
        recovery: {
            duration: 0.2,
            lockMovement: false,
            lockTurn: false,
            slideSpeed: 0
        }
    }
};

export function ensureItemAbilityStats(item) {
    if (!item) return;
    if (item.type !== 'ability' && !item.attachedAbility) return;
    
    // Default values
    let defaultBaseDmg = 12;
    let defaultAtkScale = 1.2;
    let defaultCooldown = 2.0;
    let defaultRange = 120;
    let defaultDefScale = 0;
    
    const abId = item.attachedAbility || item.id;
    if (abId === 'slime_leap') {
        defaultBaseDmg = 12;
        defaultAtkScale = 1.2;
        defaultCooldown = 2.0;
        defaultRange = 120;
    } else if (abId === 'dash_strike') {
        defaultBaseDmg = 15;
        defaultAtkScale = 1.5;
        defaultCooldown = 3.0;
        defaultRange = 150;
    } else if (abId === 'blood_siphon') {
        defaultBaseDmg = 28;
        defaultAtkScale = 2.0;
        defaultCooldown = 5.0;
        defaultRange = 100;
    } else if (abId === 'earth_wall') {
        defaultBaseDmg = 6;
        defaultAtkScale = 0.5;
        defaultCooldown = 6.0;
        defaultRange = 100;
        defaultDefScale = 0.8;
    } else if (abId === 'plasma_orb') {
        defaultBaseDmg = 15;
        defaultAtkScale = 1.0;
        defaultCooldown = 1.5;
        defaultRange = 220;
    } else {
        // Fallback for custom creator abilities
        const all = getAllAbilities();
        const ab = all[abId];
        if (ab) {
            defaultBaseDmg = (ab.active && ab.active.damage) || 12;
            defaultAtkScale = 1.0;
            defaultCooldown = ab.cooldown || 3.0;
            defaultRange = ab.range || 120;
        }
    }
    
    if (item.baseDmg === undefined) item.baseDmg = defaultBaseDmg;
    if (item.atkScale === undefined) item.atkScale = defaultAtkScale;
    if (item.cooldown === undefined) {
        // Looted differently! Add some variance: -20% to +10% cooldown (lower = better)
        const mult = 0.8 + Math.random() * 0.3; // 0.8 to 1.1
        item.cooldown = Number((defaultCooldown * mult).toFixed(1));
    }
    if (item.range === undefined) {
        // Looted differently! Add variance: +0% to +30% range
        const mult = 1.0 + Math.random() * 0.3; // 1.0 to 1.3
        item.range = Math.floor(defaultRange * mult);
    }
    if (defaultDefScale && item.defScale === undefined) {
        item.defScale = defaultDefScale;
    }
    if (!item.level) item.level = 1;
}

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
    const merged = { ...DEFAULT_ABILITIES, ...custom };

    // Inject all standard, custom and inventory emitters as virtual abilities
    try {
        const engine = (window && window.engine) ? window.engine : null;
        const itemDb = {};

        // 1. Standard emitter presets
        const standardEmitters = [
            {
                id: "item_emitter_plasma_orb",
                name: "Plasma Orb Emitter Core",
                type: "emitter",
                emoji: "⚡",
                emitterConfig: {
                    projectileType: 'starburst',
                    cooldown: 1.5,
                    range: 220,
                    projectileSpeed: 180,
                    burstCount: 5,
                    damage: 18,
                    projectileColor: '#f1c40f',
                    renderType: 'glow'
                }
            },
            {
                id: "item_emitter_sentry_tower",
                name: "Ancient Sentry Emitter",
                type: "emitter",
                emoji: "📡",
                emitterConfig: {
                    projectileType: 'seeking',
                    cooldown: 1.6,
                    range: 250,
                    projectileSpeed: 200,
                    burstCount: 1,
                    damage: 25,
                    projectileColor: '#e74c3c',
                    renderType: 'glow'
                }
            }
        ];
        standardEmitters.forEach(it => {
            itemDb[it.id] = it;
        });

        // 2. Discover custom library items
        const itemStored = localStorage.getItem('rpg_custom_items');
        if (itemStored) {
            const customItems = JSON.parse(itemStored);
            Object.keys(customItems).forEach(itemId => {
                const item = customItems[itemId];
                if (item && item.type === 'emitter') {
                    itemDb[itemId] = item;
                }
            });
        }

        // 3. Discover active player live inventory emitters
        if (engine && engine.player && Array.isArray(engine.player.inventory)) {
            engine.player.inventory.forEach(item => {
                if (item && item.type === 'emitter') {
                    itemDb[item.id] = item;
                }
            });
        }

        // Render them as slottable virtual abilities
        Object.keys(itemDb).forEach(itemId => {
            const item = itemDb[itemId];
            if (item && item.emitterConfig && !merged[itemId]) {
                merged[itemId] = {
                    id: itemId,
                    name: item.name,
                    cooldown: item.emitterConfig.cooldown || 1.5,
                    range: item.emitterConfig.range || 220,
                    hasEmitter: true,
                    emoji: item.emoji || '📡',
                    emitterConfig: item.emitterConfig,
                    startup: { duration: 0.01 },
                    active: { duration: 0.01, damage: item.emitterConfig.damage || 0 },
                    recovery: { duration: 0.01 }
                };
            }
        });
    } catch (e) {
        console.error("Error integrating item emitters into abilities:", e);
    }

    return merged;
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
export function executeAbility(caster, abilityId, getTargetPosFn, slotIndex = null) {
    if (!caster || !abilityId) return false;

    // Fast cooldown validation (use slot index for players to allow independent cooldowns per slot)
    caster.abilityCooldowns = caster.abilityCooldowns || {};
    const cdKey = (slotIndex !== null && caster === caster.engine.player) ? `slot_${slotIndex}` : abilityId;
    if (caster.abilityCooldowns[cdKey] && caster.abilityCooldowns[cdKey] > 0) {
        console.log(`Ability "${abilityId}" (key: ${cdKey}) is still on cooldown.`);
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
    let finalCooldown = ability.cooldown;
    if (caster === caster.engine.player && caster.inventory) {
        const equippedItem = caster.inventory.find(i => i.type === 'ability' && i.equipped && (i.attachedAbility === abilityId || i.id === abilityId));
        if (equippedItem) {
            ensureItemAbilityStats(equippedItem);
            if (equippedItem.cooldown !== undefined) {
                finalCooldown = equippedItem.cooldown;
            }
        }
    }
    if (caster === caster.engine.player && caster.engine.activeItemWorld && caster.engine.activeItemWorld.activeModifiers) {
        const hasMana = caster.engine.activeItemWorld.activeModifiers.some(mod => mod.key === 'mana_overflow');
        if (hasMana) {
            finalCooldown *= 0.5; // 50% shorter cooldowns from Overflowing Mana!
        }
    }
    caster.abilityCooldowns[cdKey] = finalCooldown;

    // Set caster variables
    caster.activeAbility = ability;
    caster.lastAbilityId = abilityId;
    caster.abilityState = 'startup';
    caster.abilityTimer = ability.startup.duration;
    caster.abilityStartPos = { x: caster.currentPixelX, y: caster.currentPixelY };
    caster.abilityTargetPos = { x: targetPos.x, y: targetPos.y };
    caster.abilityDealtDamage = false;

    // Custom startup aesthetic particles and squeeze flashes
    if (abilityId === 'dash_strike') {
        const isPinkSlime = caster.friendly === true || (caster.name && caster.name.toLowerCase().includes('allied')) || caster === caster.engine.player;
        const dustColor = isPinkSlime ? '#e91e63' : '#8bc34a';
        caster.engine.addEffect(new ParticleSplatterEffect(caster.engine, {
            position: { x: caster.currentPixelX, y: caster.currentPixelY },
            color: '#ffffff', // sharp white whoosh wind cuts
            count: 12,
            duration: 0.3
        }));
        caster.engine.addEffect(new ParticleSplatterEffect(caster.engine, {
            position: { x: caster.currentPixelX, y: caster.currentPixelY },
            color: dustColor, // base slime trail dust
            count: 8,
            duration: 0.35
        }));
    } else if (abilityId === 'blood_siphon') {
        caster.selfDamageFlashTimer = 0.4;
        caster.engine.addEffect(new ParticleSplatterEffect(caster.engine, {
            position: { x: caster.currentPixelX, y: caster.currentPixelY },
            color: '#e74c3c', // deep crimson blood splatter
            count: 15,
            duration: 0.45
        }));
    } else if (abilityId === 'earth_wall') {
        caster.engine.addEffect(new ParticleSplatterEffect(caster.engine, {
            position: { x: caster.currentPixelX, y: caster.currentPixelY },
            color: '#95a5a6', // dusty gray gravel rubble
            count: 10,
            duration: 0.35
        }));
    }

    if (ability.startup.disableCollision) {
        caster.collidable = false;
    }

    // Add Telegraph Ring (skip for plasma_orb)
    if (abilityId !== 'plasma_orb') {
        caster.engine.addEffect(new TelegraphEffect(caster.engine, {
            type: 'telegraph',
            position: caster.abilityTargetPos,
            shape: ability.active.hitboxShape || { type: 'ellipse', radiusX: 30, radiusY: 15 },
            duration: ability.startup.duration,
            owner: caster
        }));
    }

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
            const nextX = caster.abilityStartPos.x + dx * progress;
            const nextY = caster.abilityStartPos.y + dy * progress;

            if (ability.startup.disableCollision) {
                // If collision is disabled (e.g. leap), we can teleport/leaps over walls
                caster.currentPixelX = nextX;
                caster.currentPixelY = nextY;
            } else {
                // Ground motion - we must predict collision ahead of time!
                const circleCenter = { x: nextX, y: nextY - 16 }; // shift upward by 16 for GLOBAL_COLLISION_Y_OFFSET
                const isColliding = caster.map.checkStaticCollisionAt(circleCenter, caster.collisionRadius, caster.engine.gameObjects);
                
                if (!isColliding) {
                    caster.currentPixelX = nextX;
                    caster.currentPixelY = nextY;
                } else {
                    // Collision predicted! Let's stop permanently at the wall boundary.
                    caster.abilityTargetPos = { x: caster.currentPixelX, y: caster.currentPixelY };
                }
            }
        }

        // Phase finished, trigger Active / Impact Phase
        if (caster.abilityTimer <= 0) {
            if (ability.startup.dashSpeed && ability.startup.dashSpeed > 0) {
                caster.currentPixelX = caster.abilityTargetPos.x;
                caster.currentPixelY = caster.abilityTargetPos.y;
            }
            caster.visualYOffset = 0;
            if ((ability.startup && ability.startup.jumpHeight > 0) || ability.id === 'plasma_orb') {
                caster.landingSquashTimer = 0.35; // Trigger bounciness on landing
            }
            caster.collidable = true; // guarantee solid landing

            if (typeof caster.updateMapCoordsFromPixels === 'function') {
                caster.updateMapCoordsFromPixels();
            }

            // Start active hitbox timer
            caster.abilityState = 'active';
            caster.abilityTimer = ability.active.duration;

            // Trigger visual hit effect (skip for plasma_orb)
            if (ability.id !== 'plasma_orb') {
                caster.engine.addEffect(new TelegraphEffect(caster.engine, {
                    type: 'active_aoe',
                    position: caster.abilityTargetPos,
                    shape: ability.active.hitboxShape || { type: 'ellipse', radiusX: 30, radiusY: 15 },
                    duration: ability.active.duration,
                    owner: caster
                }));
            }

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
            let currentSlideSpeed = ability.recovery.slideSpeed;
            // Decay slide speed linearly to simulate high-friction organic stop / crisp backdash deceleration
            if (ability.id === 'dash_strike' || ability.id === 'earth_wall' || ability.recovery.decaySlide) {
                const ratio = Math.max(0, Math.min(1, caster.abilityTimer / ability.recovery.duration)); // 1.0 down to 0.0
                currentSlideSpeed = ability.recovery.slideSpeed * ratio;
            }
            
            const slideX = (dx / dist) * currentSlideSpeed * deltaTime;
            const slideY = (dy / dist) * currentSlideSpeed * deltaTime;
            
            // Check collisions before sliding, or let them slide slightly
            const nextX = caster.currentPixelX + slideX;
            const nextY = caster.currentPixelY + slideY;
            const circleCenter = { x: nextX, y: nextY - 16 };
            if (!caster.map.checkStaticCollisionAt(circleCenter, caster.collisionRadius, caster.engine.gameObjects)) {
                caster.currentPixelX = nextX;
                caster.currentPixelY = nextY;
            }
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

    // Fire projectiles if the ability has an attached emitter
    if (ability.hasEmitter && ability.emitterConfig) {
        let casterAtk = 10;
        if (caster) {
            if (typeof caster.getAtk === 'function') {
                casterAtk = caster.getAtk();
            } else if (caster.stats && caster.stats.atk !== undefined) {
                casterAtk = caster.stats.atk;
            }
        }
        const baseDmg = ability.emitterConfig.damage || 15;
        const scaledDmg = Math.floor(baseDmg + 1.0 * casterAtk);

        const config = {
            ...ability.emitterConfig,
            enabled: true,
            showArea: false,
            notify: false,
            cooldown: 0.01,
            range: ability.range || 220,
            damage: scaledDmg
        };
        const tempEmitter = new Emitter(caster.engine, caster, config);
        tempEmitter.fire();

        if (ability.id === 'plasma_orb') {
            const isPinkSlime = caster.friendly === true || (caster.name && caster.name.toLowerCase().includes('allied'));
            const pColor = isPinkSlime ? '#e91e63' : '#8bc34a';
            if (typeof ParticleSplatterEffect !== 'undefined') {
                // Physical slime matter debris splatters
                caster.engine.addEffect(new ParticleSplatterEffect(caster.engine, {
                    position: { x: caster.currentPixelX, y: caster.currentPixelY },
                    color: pColor,
                    count: 14,
                    duration: 0.55
                }));
                // Arc/plasma gold burst sparks
                caster.engine.addEffect(new ParticleSplatterEffect(caster.engine, {
                    position: { x: caster.currentPixelX, y: caster.currentPixelY },
                    color: '#f1c40f',
                    count: 12,
                    duration: 0.45
                }));
            }
        }
    }

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
            ? ((obj.constructor.name === 'Enemy' && obj.friendly !== true) || obj.type === 'tower_enemy' || (obj.name && obj.name.toLowerCase().includes('scruffy')))
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
        // Trigger extra impact particle splatters for Dash Strike
        if (ability.id === 'dash_strike') {
            caster.engine.addEffect(new ParticleSplatterEffect(caster.engine, {
                position: { x: center.x, y: center.y },
                color: '#f1c40f', // gold spark pop
                count: 15,
                duration: 0.45
            }));
            caster.engine.addEffect(new ParticleSplatterEffect(caster.engine, {
                position: { x: center.x, y: center.y },
                color: '#ffffff', // sharp white cut
                count: 10,
                duration: 0.35
            }));
        }

        for (const victim of hitOpponents) {
            // Apply damage with character attribute scaling!
            let dmg = ability.active.damage || 0;
            
            let casterAtk = 10;
            let casterDef = 5;
            if (caster) {
                if (typeof caster.getAtk === 'function') {
                    casterAtk = caster.getAtk();
                } else if (caster.stats && caster.stats.atk !== undefined) {
                    casterAtk = caster.stats.atk;
                }
                if (typeof caster.getDef === 'function') {
                    casterDef = caster.getDef();
                } else if (caster.stats && caster.stats.def !== undefined) {
                    casterDef = caster.stats.def;
                }
            }

            const abId = ability.id;
            let equippedItem = null;
            if (caster === caster.engine.player && caster.inventory) {
                equippedItem = caster.inventory.find(i => i.type === 'ability' && i.equipped && (i.attachedAbility === abId || i.id === abId));
            }

            if (equippedItem) {
                ensureItemAbilityStats(equippedItem);
                const baseD = equippedItem.baseDmg !== undefined ? equippedItem.baseDmg : (abId === 'slime_leap' ? 12 : abId === 'dash_strike' ? 15 : abId === 'blood_siphon' ? 28 : abId === 'earth_wall' ? 6 : (ability.active.damage || 10));
                const scaleA = equippedItem.atkScale !== undefined ? equippedItem.atkScale : (abId === 'slime_leap' ? 1.2 : abId === 'dash_strike' ? 1.5 : abId === 'blood_siphon' ? 2.0 : abId === 'earth_wall' ? 0.5 : 1.0);
                dmg = Math.floor(baseD + scaleA * casterAtk);
                if (abId === 'earth_wall') {
                    const scaleD = equippedItem.defScale !== undefined ? equippedItem.defScale : 0.8;
                    dmg += Math.floor(scaleD * casterDef);
                }
            } else {
                if (abId === 'slime_leap') {
                    dmg = Math.floor(12 + 1.2 * casterAtk);
                } else if (abId === 'dash_strike') {
                    dmg = Math.floor(15 + 1.5 * casterAtk);
                } else if (abId === 'blood_siphon') {
                    dmg = Math.floor(28 + 2.0 * casterAtk);
                } else if (abId === 'earth_wall') {
                    dmg = Math.floor(6 + 0.5 * casterAtk + 0.8 * casterDef);
                } else {
                    dmg = Math.floor(dmg + 1.0 * casterAtk);
                }
            }

            // Apply scale multiplier for Overflowing Mana (+50% skill damage!)
            if (caster === caster.engine.player && caster.engine.activeItemWorld && caster.engine.activeItemWorld.activeModifiers) {
                const hasMana = caster.engine.activeItemWorld.activeModifiers.some(mod => mod.key === 'mana_overflow');
                if (hasMana) {
                    dmg = Math.floor(dmg * 1.5);
                }
            }

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
            
            // Trigger beautiful green healing organic flash
            caster.healingFlashTimer = 0.45;
            caster.engine.addEffect(new ParticleSplatterEffect(caster.engine, {
                position: { x: caster.currentPixelX, y: caster.currentPixelY },
                color: '#2ecc71', // pure healing green sparkles
                count: 15,
                duration: 0.5
            }));

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

            // Dynamic dirt & rocky gray stone debris splattering upwards on wall raise!
            caster.engine.addEffect(new ParticleSplatterEffect(caster.engine, {
                position: { x: center.x, y: center.y },
                color: '#7f8c8d', // dark granite gray
                count: 12,
                duration: 0.65
            }));
            caster.engine.addEffect(new ParticleSplatterEffect(caster.engine, {
                position: { x: center.x, y: center.y },
                color: '#d35400', // dusty clay brown
                count: 10,
                duration: 0.5
            }));

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
