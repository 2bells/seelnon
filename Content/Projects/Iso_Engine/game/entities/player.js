// Player Character Logic

console.log("rpg/game/entities/player.js loaded");

import Enemy from './enemy.js';
import NPC from './npc.js';
import { GLOBAL_COLLISION_Y_OFFSET } from './gameObject.js'; // Import the constant
import { FloatingTextEffect, ParticleSplatterEffect, SwordSlashEffect } from '../combat/effects.js';
import { updateAbilityCycle, getAllAbilities, ensureItemAbilityStats } from '../combat/ability_system.js';
import { Emitter } from '../combat/projectiles.js';

// Removed PLAYER_DIAMOND_HALF_WIDTH and PLAYER_DIAMOND_HALF_HEIGHT
const INTERACTION_RADIUS_SQ = 30 * 30; // Squared radius for interacting with objects/spawn points
const PLAYER_KNOCKBACK_FORCE = 120; // How much force the player's attack applies

class Player {
    constructor(initialMapX, initialMapY, mapInstance, engineInstance) { 
        this.map = mapInstance;
        this.engine = engineInstance; 
        this.sprite = this.engine.assets.hero;
        
        const initialScreenPos = this.map.mapToScreen(initialMapX, initialMapY);
        this.currentPixelX = initialScreenPos.x; // Anchor point and circle center
        this.currentPixelY = initialScreenPos.y; // Anchor point and circle center

        this.mapX = initialMapX; 
        this.mapY = initialMapY;
        this.targetPixelX = this.currentPixelX; // For smooth movement later
        this.targetPixelY = this.currentPixelY; // For smooth movement later

        this.pixelSpeed = 150; 
        this.characterData = null;
        this.mass = 10; // "Heavier" than enemies for collision resolution

        this.stats = {
            hp: 100,
            maxHp: 100,
            atk: 10,
            def: 5,
            level: 1,
            exp: 0,
            nextLevelExp: 100
        };

        this.gold = 150; // Starting player gold
        this._inventory = [
            { id: 'item_potion_red', name: 'Red Potion', type: 'consumable', heal: 40, description: 'Heals 40 HP.', count: 3, value: 20 },
            { id: 'item_herb_green', name: 'Green Herb', type: 'consumable', heal: 15, description: 'Heals 15 HP.', count: 2, value: 8 },
            { id: 'item_sword_iron', name: 'Iron Sword', type: 'weapon', bonusAtk: 5, description: '+5 ATK. Iron blade.', count: 1, value: 60, equipped: false },
            { id: 'item_slime_leap', name: 'Tome of Slime Leap', emoji: '🐸', type: 'ability', attachedAbility: 'slime_leap', description: 'Imbued with bouncy momentum. Equips Slime Leap skill into a Hotbar slot.', count: 1, value: 50, equipped: false },
            { id: 'item_dash_strike', name: 'Ring of Dash Strike', emoji: '⚔️', type: 'ability', attachedAbility: 'dash_strike', description: 'Imbued with swift wind. Equips Dash Strike skill into a Hotbar slot.', count: 1, value: 50, equipped: false },
            { id: 'item_blood_siphon', name: 'Amulet of Blood Siphon', emoji: '❤️', type: 'ability', attachedAbility: 'blood_siphon', description: 'Imbued with dark blood magic. Equips Blood Siphon skill into a Hotbar slot.', count: 1, value: 50, equipped: false },
            { id: 'item_earth_wall', name: 'Rune of Earth Wall', emoji: '⛰️', type: 'ability', attachedAbility: 'earth_wall', description: 'Imbued with earthen elements. Equips Earth Wall skill into a Hotbar slot.', count: 1, value: 50, equipped: false },
            { id: 'item_plasma_orb', name: 'Tome of Plasma Orb', emoji: '⚡', type: 'ability', attachedAbility: 'plasma_orb', description: 'Charged with volt particles. Equips Plasma Orb skill to discharge a multi-shot sine wave.', count: 1, value: 75, equipped: false }
        ];

        // Ability System properties
        this.activeAbility = null;
        this.abilityState = 'none'; // 'none', 'startup', 'active', 'recovery'
        this.visualYOffset = 0;
        this.landingSquashTimer = 0;
        
        // Combat lunge animation variables
        this.lungeTimer = 0;
        this.lungeTarget = null;
        this.abilityCooldowns = {};
        this.equippedAbilities = [null, null, null, null, null];
        this.emitters = [];
        this.rebuildEmitters();

        // Knockback properties
        this.knockbackVelocity = { x: 0, y: 0 };
        this.knockbackFriction = 4.0;

        // Hit flash properties
        this.isHit = false;
        this.hitFlashTimer = 0;

        // Combat related
        this.attackRange = 50; // pixels
        this.attackCooldown = 1.5; // seconds
        this.attackTimer = 0;
        this.currentTarget = null;

        this.playerVisualWidth = this.sprite ? this.sprite.width : 32; 
        this.playerVisualHeight = this.sprite ? this.sprite.height : 48;
        
        // Circular collision
        this.collisionRadius = 10; // Radius of the player's circular collision

        this.hookInventoryPush();
    }

    get inventory() {
        return this._inventory;
    }

    set inventory(val) {
        this._inventory = val;
        this.hookInventoryPush();
    }

    hookInventoryPush() {
        if (!Array.isArray(this._inventory)) return;
        const originalPush = this._inventory.push;
        if (originalPush && !this._inventory._isHooked) {
            this._inventory._isHooked = true;
            this._inventory.push = (...items) => {
                const result = originalPush.apply(this._inventory, items);
                this.autoEquipAbilities();
                return result;
            };
        }
        this.autoEquipAbilities();
    }

    autoEquipAbilities() {
        if (!Array.isArray(this._inventory) || !Array.isArray(this.equippedAbilities)) return;
        
        let changed = false;
        this._inventory.forEach(item => {
            const abIdentifier = item.attachedAbility || (item.type === 'emitter' ? item.id : null);
            if (item && (item.type === 'ability' || item.type === 'emitter') && abIdentifier && !item.equipped && !item.explicitlyUnequipped) {
                // Find empty slot
                const emptySlotIndex = this.equippedAbilities.indexOf(null);
                if (emptySlotIndex !== -1) {
                    // Equip it!
                    this.equippedAbilities[emptySlotIndex] = abIdentifier;
                    item.equipped = true;
                    item.equippedSlot = emptySlotIndex;
                    changed = true;
                }
            }
        });
        if (changed) {
            this.rebuildEmitters();
        }
    }

    rebuildEmitters() {
        this.emitters = [];
        const abilitiesList = getAllAbilities ? getAllAbilities() : {};
        
        if (Array.isArray(this.equippedAbilities)) {
            this.equippedAbilities.forEach(abId => {
                if (!abId) return;
                
                // Get virtual or actual ability
                const ab = abilitiesList[abId];
                if (ab && ab.hasEmitter && ab.emitterConfig) {
                    const isPassiveEmitter = abId.includes('emitter') || abId.includes('loot_') || abId.startsWith('item_');
                    if (isPassiveEmitter) {
                        this.emitters.push(new Emitter(this.engine, this, { ...ab.emitterConfig, presetId: ab.id }));
                    }
                }
            });
        }
    }

    loadCharacterData(data) {
        this.characterData = data;
        console.log("Player character data loaded:", this.characterData.name);
    }

    updateDynamicStats() {
        let baseMaxHp = 100;
        if (Array.isArray(this.inventory)) {
            this.inventory.forEach(item => {
                if (item.passiveHp) {
                    baseMaxHp += item.passiveHp;
                }
            });
        }
        const hpDiff = baseMaxHp - this.stats.maxHp;
        this.stats.maxHp = baseMaxHp;
        if (hpDiff > 0) {
            this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + hpDiff);
        } else {
            this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp);
        }
    }

    gainExp(amount) {
        if (!this.stats.level) {
            this.stats.level = 1;
            this.stats.exp = 0;
            this.stats.nextLevelExp = 100;
        }

        this.stats.exp += amount;

        // Level up check
        while (this.stats.exp >= this.stats.nextLevelExp) {
            this.stats.exp -= this.stats.nextLevelExp;
            this.stats.level++;
            this.stats.nextLevelExp = Math.floor(this.stats.nextLevelExp * 1.5);
            this.stats.maxHp = Math.floor(this.stats.maxHp * 1.15) + 15;
            this.stats.hp = this.stats.maxHp; // Heal to full on level up
            this.stats.atk = Math.floor(this.stats.atk * 1.12) + 2;
            this.stats.def = Math.floor(this.stats.def * 1.10) + 1;

            const FloatingTextEffectClass = FloatingTextEffect || null;
            if (FloatingTextEffectClass && this.engine) {
                this.engine.addEffect(new FloatingTextEffectClass(this.engine, {
                    text: `⭐ LEVEL UP! Lvl ${this.stats.level} ⭐`,
                    position: { x: this.currentPixelX, y: this.currentPixelY - 60 },
                    color: '#f1c40f'
                }));
            }
        }
    }

    gainItemExp(item, amount) {
        if (!item) return;
        if (!item.level) item.level = 1;
        if (item.xp === undefined) item.xp = 0;
        if (!item.nextLevelXp) item.nextLevelXp = 100;

        item.xp += amount;

        // Level up item
        while (item.xp >= item.nextLevelXp) {
            item.xp -= item.nextLevelXp;
            item.level++;
            item.nextLevelXp = Math.floor(item.nextLevelXp * 1.6);

            // Scale item metrics
            if (item.bonusAtk) item.bonusAtk = Math.floor(item.bonusAtk * 1.2) + 1;
            if (item.bonusDef) item.bonusDef = Math.floor(item.bonusDef * 1.2) + 1;
            if (item.heal) item.heal = Math.floor(item.heal * 1.2) + 5;

            // Ability progression (12 Base + 120% ATK boosted with levels)
            if (item.type === 'ability' || item.attachedAbility) {
                ensureItemAbilityStats(item);
                item.baseDmg = Math.floor(item.baseDmg * 1.15) + 2;
                item.atkScale = Number((item.atkScale + 0.05).toFixed(2));
                if (item.defScale !== undefined) {
                    item.defScale = Number((item.defScale + 0.05).toFixed(2));
                }
            }

            const FloatingTextEffectClass = FloatingTextEffect || null;
            if (FloatingTextEffectClass && this.engine) {
                this.engine.addEffect(new FloatingTextEffectClass(this.engine, {
                    text: `⚔️ ITEM LEVEL UP: ${item.name} Lv ${item.level}! ⚔️`,
                    position: { x: this.currentPixelX, y: this.currentPixelY - 80 },
                    color: '#e67e22'
                }));
            }
        }
    }

    getAtk() {
        let totalAtk = this.stats.atk;
        if (Array.isArray(this.inventory)) {
            const equippedWeapon = this.inventory.find(i => i.type === 'weapon' && i.equipped);
            if (equippedWeapon) {
                totalAtk += equippedWeapon.bonusAtk || 0;
            }
            // Add passive bag bonuses
            this.inventory.forEach(item => {
                if (item.passiveAtk) {
                    totalAtk += item.passiveAtk;
                }
            });
        }
        return totalAtk;
    }

    getDef() {
        let totalDef = this.stats.def;
        if (Array.isArray(this.inventory)) {
            const equippedShield = this.inventory.find(i => i.type === 'shield' && i.equipped);
            if (equippedShield) {
                totalDef += equippedShield.bonusDef || 0;
            }
            const equippedArmor = this.inventory.find(i => i.type === 'armor' && i.equipped);
            if (equippedArmor) {
                totalDef += equippedArmor.bonusDef || 0;
            }
            // Add passive bag bonuses
            this.inventory.forEach(item => {
                if (item.passiveDef) {
                    totalDef += item.passiveDef;
                }
            });
        }
        return totalDef;
    }

    takeDamage(amount, attacker) {
        const damageTaken = Math.max(1, amount - this.getDef());
        this.stats.hp -= damageTaken;
        console.log(`Player took ${damageTaken} damage. HP: ${this.stats.hp}/${this.stats.maxHp}`);
        
        // Trigger hit flash
        this.isHit = true;
        this.hitFlashTimer = 0.15;

        // Add floating damage text
        this.engine.addEffect(new FloatingTextEffect(this.engine, {
            text: damageTaken.toString(),
            position: { x: this.currentPixelX, y: this.currentPixelY - this.playerVisualHeight / 2 },
            color: '#e74c3c' // Red for player damage
        }));

        // Auto-retaliate
        if (!this.currentTarget && attacker instanceof Enemy) {
            this.currentTarget = attacker;
        }

        if (this.stats.hp <= 0) {
            this.stats.hp = 0;
            this.die();
        }
    }

    die() {
        console.log("Player has been defeated.");
        CustomDialog.alert("You have been defeated!", "Defeat");
        // TODO: Respawn logic
        this.stats.hp = this.stats.maxHp; // For now, just reset hp
    }

    applyKnockback(direction, force) {
        const dist = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
        if (dist > 0) {
            this.knockbackVelocity.x += (direction.x / dist) * force;
            this.knockbackVelocity.y += (direction.y / dist) * force;
        }
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

        // Check if player is on empty tile (abyss) or out of bounds, and nudge them back to safe terrain
        const mapCoords = this.map.screenToMap(this.currentPixelX, this.currentPixelY);
        const tileX = Math.floor(mapCoords.x);
        const tileY = Math.floor(mapCoords.y);
        
        if (tileX < 0 || tileX >= this.map.width || tileY < 0 || tileY >= this.map.height || this.map.tiles[tileY][tileX] === 0) {
            let bestTile = null;
            let minDistSq = Infinity;
            
            // Search a small neighborhood for the nearest non-empty tile
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

    // This method might be obsolete or need to return points on the circle if used for general visualization
    getCollisionPolygonVertices(baseX, baseY) {
        // For a circle, we don't have vertices in the same way.
        // Could return an AABB for broader checks, or points on circumference for visualization.
        // For now, let's return a bounding box for the circle.
        return [
            { x: baseX - this.collisionRadius, y: baseY - this.collisionRadius },
            { x: baseX + this.collisionRadius, y: baseY - this.collisionRadius },
            { x: baseX + this.collisionRadius, y: baseY + this.collisionRadius },
            { x: baseX - this.collisionRadius, y: baseY + this.collisionRadius },
        ];
    }
    
    // --- Start of Collision Helper Methods ---
    // These methods are now expected to be in this.map (GameMap instance)
    // _distSq(p1, p2) { ... } // Removed
    // _closestPointOnSegment(p, a, b) { ... } // Removed
    // _circleIntersectsRectangle(circle, rect) { ... } // Removed
    // _circleIntersectsPolygon(circle, polygonVertices) { ... } // Removed
    // --- End of Collision Helper Methods ---


    update(deltaTime, input) {
        // Update physical lunge timer
        if (this.lungeTimer && this.lungeTimer > 0) {
            this.lungeTimer = Math.max(0, this.lungeTimer - deltaTime);
        }

        // Run ability ticks
        updateAbilityCycle(this, deltaTime);

        // Update passive background emitters
        if (this.emitters && this.emitters.length > 0) {
            this.emitters.forEach(em => em.update(deltaTime));
        }

        // Update landing squash decay
        if (this.landingSquashTimer > 0) {
            this.landingSquashTimer = Math.max(0, this.landingSquashTimer - deltaTime);
        }

        // Update hit flash timer
        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer -= deltaTime;
            if (this.hitFlashTimer <= 0) {
                this.isHit = false;
            }
        }

        // Update custom ability flash timers
        if (this.selfDamageFlashTimer && this.selfDamageFlashTimer > 0) {
            this.selfDamageFlashTimer = Math.max(0, this.selfDamageFlashTimer - deltaTime);
        }
        if (this.healingFlashTimer && this.healingFlashTimer > 0) {
            this.healingFlashTimer = Math.max(0, this.healingFlashTimer - deltaTime);
        }

        // Apply knockback friction
        this.knockbackVelocity.x -= this.knockbackVelocity.x * this.knockbackFriction * deltaTime;
        this.knockbackVelocity.y -= this.knockbackVelocity.y * this.knockbackFriction * deltaTime;
        if (Math.abs(this.knockbackVelocity.x) < 1) this.knockbackVelocity.x = 0;
        if (Math.abs(this.knockbackVelocity.y) < 1) this.knockbackVelocity.y = 0;
        
        let totalMovementX = this.knockbackVelocity.x * deltaTime;
        let totalMovementY = this.knockbackVelocity.y * deltaTime;
        
        let inputMovementX = 0;
        let inputMovementY = 0;

        // Block movement input if casting locks movement (BUT recovery phase shouldn't block WASD for player)
        let isMovementLocked = false;
        if (this.activeAbility && this.abilityState !== 'none') {
            const phase = this.activeAbility[this.abilityState];
            if (phase && phase.lockMovement && this.abilityState !== 'recovery') {
                isMovementLocked = true;
            }
        }

        if (!isMovementLocked) {
            if (input.up) inputMovementY -= 0.77; 
            if (input.down) inputMovementY += 0.77;
            if (input.left) inputMovementX -= 1;
            if (input.right) inputMovementX += 1;
        }
        // Action input is handled by engine directly for interactions

        if (inputMovementX !== 0 || inputMovementY !== 0) {
            if (inputMovementX !== 0 && inputMovementY !== 0) {
                const length = Math.sqrt(inputMovementX * inputMovementX + inputMovementY * inputMovementY);
                inputMovementX /= length;
                inputMovementY /= length;
            }

            let activeSpeed = this.pixelSpeed;
            if (this.engine.activeItemWorld && this.engine.activeItemWorld.activeModifiers) {
                let speedMult = 1.0;
                const activeMods = this.engine.activeItemWorld.activeModifiers;
                if (activeMods.some(mod => mod.key === 'player_speed')) {
                    speedMult += 0.25;
                }
                if (activeMods.some(mod => mod.key === 'gravity')) {
                    speedMult -= 0.15;
                }
                activeSpeed *= speedMult;
            }

            totalMovementX += inputMovementX * activeSpeed * deltaTime;
            totalMovementY += inputMovementY * activeSpeed * deltaTime;
        }

        if (totalMovementX !== 0 || totalMovementY !== 0) {
            let potentialPixelX = this.currentPixelX + totalMovementX;
            let potentialPixelY = this.currentPixelY + totalMovementY;
            
            const playerCircle = {
                center: { x: 0, y: 0 }, // Will be updated in checkCollisionAt
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
                // Try moving only along X axis
                if (inputMovementX !== 0 && !checkCollisionAt(potentialPixelX, this.currentPixelY)) {
                    this.currentPixelX = potentialPixelX;
                }
                // Try moving only along Y axis
                else if (inputMovementY !== 0 && !checkCollisionAt(this.currentPixelX, potentialPixelY)) {
                     this.currentPixelY = potentialPixelY;
                }
            }
        }
        
        this.resolveStaticCollisions();
        this.updateMapCoordsFromPixels();

        // --- Combat Logic ---
        this.attackTimer = Math.max(0, this.attackTimer - deltaTime);

        // Target management
        if (this.currentTarget) {
            const isDead = this.currentTarget.stats.hp <= 0;
            const dx = this.currentTarget.currentPixelX - this.currentPixelX;
            const dy = this.currentTarget.currentPixelY - this.currentPixelY;
            const distSq = dx * dx + dy * dy;
            // Lose target if it's dead or moves too far away
            if (isDead || distSq > (this.attackRange * 1.2) ** 2) {
                this.currentTarget = null;
            }
        }

        // Find new target if we don't have one
        if (!this.currentTarget) {
            this.findNewTarget();
        }

        // Attack logic
        if (this.currentTarget && this.attackTimer <= 0) {
            const dx = this.currentTarget.currentPixelX - this.currentPixelX;
            const dy = this.currentTarget.currentPixelY - this.currentPixelY;
            const distSq = dx * dx + dy * dy;
            
            if (distSq <= this.attackRange * this.attackRange) {
                this.attack(this.currentTarget);
                this.attackTimer = this.attackCooldown;
            }
        }
    }

    findNewTarget() {
        let closestEnemy = null;
        let closestDistSq = this.attackRange * this.attackRange;

        for (const obj of this.engine.gameObjects) {
            const isTargetable = (obj instanceof Enemy && obj.friendly !== true) || 
                                 (obj.type === 'tower_enemy') || 
                                 (obj instanceof NPC && obj.name.toLowerCase().includes('scruffy'));
            if (isTargetable && obj.stats && obj.stats.hp > 0) {
                const dx = obj.currentPixelX - this.currentPixelX;
                const dy = obj.currentPixelY - this.currentPixelY;
                const distSq = dx * dx + dy * dy;

                if (distSq < closestDistSq) {
                    closestDistSq = distSq;
                    closestEnemy = obj;
                }
            }
        }
        if (closestEnemy) {
            this.currentTarget = closestEnemy;
        }
    }

    attack(target) {
        console.log(`Player attacks ${target.displayName || target.name}!`);
        target.takeDamage(this.getAtk());
        
        // Apply knockback to target
        const direction = {
            x: target.currentPixelX - this.currentPixelX,
            y: target.currentPixelY - this.currentPixelY,
        };
        if (typeof target.applyKnockback === 'function') {
            target.applyKnockback(direction, PLAYER_KNOCKBACK_FORCE);
        }

        // Trigger physical lunge animation
        this.lungeTimer = 0.2;
        this.lungeTarget = target;

        // Calculate attack sweep angle
        const targetAngle = Math.atan2(direction.y, direction.x);
        
        // Spawn sweeping sword slash visual effect
        const slashPos = {
            x: (this.currentPixelX + target.currentPixelX) / 2,
            y: (this.currentPixelY - 16 + target.currentPixelY - 16) / 2
        };
        this.engine.addEffect(new SwordSlashEffect(this.engine, {
            position: slashPos,
            angle: targetAngle,
            radius: 35
        }));

        // Spawn golden impact sparks
        this.engine.addEffect(new ParticleSplatterEffect(this.engine, {
            position: { x: target.currentPixelX, y: target.currentPixelY },
            color: '#ffd83b',
            count: 5
        }));
    }

    render(ctx, viewOriginX, viewOriginY) {
        // Draw emitter range circles if present
        if (this.emitters && this.emitters.length > 0) {
            this.emitters.forEach(em => em.renderRangeArea(ctx, viewOriginX, viewOriginY));
        }

        let lungeX = 0;
        let lungeY = 0;
        if (this.lungeTimer && this.lungeTimer > 0 && this.lungeTarget) {
            const pct = this.lungeTimer / 0.2; // 1.0 down to 0.0
            const dx = this.lungeTarget.currentPixelX - this.currentPixelX;
            const dy = this.lungeTarget.currentPixelY - this.currentPixelY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 1) {
                const currentLunge = Math.sin(pct * Math.PI) * 5; // 5px lunge
                lungeX = (dx / dist) * currentLunge;
                lungeY = (dy / dist) * currentLunge;
            }
        }

        const drawX = this.currentPixelX + lungeX - viewOriginX; // This is the circle center on canvas
        const drawY = (this.currentPixelY + lungeY + (this.visualYOffset || 0)) - viewOriginY; // This is the circle center on canvas
        
        // Compute organic squash and stretch scaling
        let scaleX = 1.0;
        let scaleY = 1.0;
        if (this.isHit && this.hitFlashTimer > 0) {
            const ratio = this.hitFlashTimer / 0.15; // 1.0 down to 0.0
            scaleX = 1.4 - 0.4 * (1.0 - ratio); // Wide recoil hit
            scaleY = 0.6 + 0.4 * (1.0 - ratio); // Flat recoil hit
        } else if (this.activeAbility && this.activeAbility.id === 'slime_leap' && this.abilityState === 'startup') {
            const ability = this.activeAbility;
            const duration = (ability.startup && ability.startup.duration) || 0.4;
            const progress = Math.max(0, Math.min(1, 1 - (this.abilityTimer / duration)));
            if (progress < 0.15) {
                // Anticipation squash
                const norm = progress / 0.15;
                scaleX = 1.0 + 0.25 * norm;
                scaleY = 1.0 - 0.25 * norm;
            } else if (progress < 0.85) {
                // In-air leap stretch
                const norm = (progress - 0.15) / 0.7;
                const stretch = Math.sin(norm * Math.PI);
                scaleX = 1.0 - 0.3 * stretch;
                scaleY = 1.0 + 0.4 * stretch;
            } else {
                // Landing pre-impact squash
                const norm = (progress - 0.85) / 0.15;
                scaleX = 1.0 + 0.15 * norm;
                scaleY = 1.0 - 0.15 * norm;
            }
        } else if (this.activeAbility && this.activeAbility.id === 'plasma_orb' && this.abilityState === 'startup') {
            const ability = this.activeAbility;
            const duration = (ability.startup && ability.startup.duration) || 0.25;
            const progress = Math.max(0, Math.min(1, 1 - (this.abilityTimer / duration)));
            // Charged squish: slattens wider and shorter
            scaleX = 1.0 + 0.35 * progress;
            scaleY = 1.0 - 0.35 * progress;
        } else if (this.activeAbility && this.activeAbility.id === 'dash_strike') {
            const ability = this.activeAbility;
            if (this.abilityState === 'startup') {
                const progress = Math.max(0, Math.min(1, 1 - (this.abilityTimer / ability.startup.duration)));
                scaleX = 0.75 - 0.15 * progress;
                scaleY = 1.25 + 0.2 * progress;
            } else if (this.abilityState === 'active') {
                scaleX = 1.45;
                scaleY = 0.65;
            } else if (this.abilityState === 'recovery') {
                const ratio = Math.max(0, Math.min(1, this.abilityTimer / ability.recovery.duration));
                scaleX = 1.0 + 0.45 * ratio;
                scaleY = 1.0 - 0.35 * ratio;
            }
        } else if (this.activeAbility && this.activeAbility.id === 'blood_siphon') {
            const ability = this.activeAbility;
            if (this.abilityState === 'startup') {
                const progress = Math.max(0, Math.min(1, 1 - (this.abilityTimer / ability.startup.duration)));
                scaleX = 1.0 + 0.3 * progress;
                scaleY = 1.0 - 0.3 * progress;
            } else if (this.abilityState === 'active') {
                scaleX = 1.3;
                scaleY = 0.7;
            } else if (this.abilityState === 'recovery') {
                const ratio = Math.max(0, Math.min(1, this.abilityTimer / ability.recovery.duration));
                if (this.healingFlashTimer > 0) {
                    scaleX = 1.0 - 0.3 * ratio;
                    scaleY = 1.0 + 0.45 * ratio;
                } else {
                    scaleX = 1.0 + 0.3 * ratio;
                    scaleY = 1.0 - 0.3 * ratio;
                }
            }
        } else if (this.activeAbility && this.activeAbility.id === 'earth_wall') {
            const ability = this.activeAbility;
            if (this.abilityState === 'startup') {
                const progress = Math.max(0, Math.min(1, 1 - (this.abilityTimer / ability.startup.duration)));
                scaleX = 1.0 + 0.35 * progress;
                scaleY = 1.0 - 0.35 * progress;
            } else if (this.abilityState === 'active') {
                scaleX = 0.75;
                scaleY = 1.35;
            } else if (this.abilityState === 'recovery') {
                const ratio = Math.max(0, Math.min(1, this.abilityTimer / ability.recovery.duration));
                scaleX = 1.0 - 0.25 * ratio;
                scaleY = 1.0 + 0.35 * ratio;
            }
        } else if (this.landingSquashTimer > 0 && (
            this.lastAbilityId === 'slime_leap' || 
            this.lastAbilityId === 'plasma_orb' || 
            this.lastAbilityId === 'dash_strike' || 
            this.lastAbilityId === 'blood_siphon' || 
            this.lastAbilityId === 'earth_wall'
        )) {
            const maxAmt = (this.lastAbilityId === 'plasma_orb' || this.lastAbilityId === 'earth_wall') ? 0.3 : 0.4;
            const ratio = this.landingSquashTimer / 0.35;
            const wave = Math.sin(ratio * Math.PI * 3.5) * ratio; // decaying impact bounce
            scaleX = 1.0 + wave * maxAmt;
            scaleY = 1.0 - wave * maxAmt;
        }

        const drawW = this.playerVisualWidth * scaleX;
        const drawH = this.playerVisualHeight * scaleY;
        const spriteDrawX = drawX - drawW / 2;
        const spriteDrawY = drawY - drawH;

        if (this.sprite && this.sprite.complete) {
            ctx.drawImage(this.sprite, spriteDrawX, spriteDrawY, drawW, drawH);

            // Crimson / Red Paint Tint for Self Damage Blood cast
            if (this.selfDamageFlashTimer && this.selfDamageFlashTimer > 0) {
                ctx.save();
                ctx.globalAlpha = 0.65 * (this.selfDamageFlashTimer / 0.4);
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = Math.ceil(drawW) || 1;
                tempCanvas.height = Math.ceil(drawH) || 1;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(this.sprite, 0, 0, tempCanvas.width, tempCanvas.height);
                tempCtx.globalCompositeOperation = 'source-atop';
                tempCtx.fillStyle = '#e74c3c'; // red
                tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                ctx.drawImage(tempCanvas, spriteDrawX, spriteDrawY);
                ctx.restore();
            }

            // Green / Emerald Paint Tint for Healing Siphons
            if (this.healingFlashTimer && this.healingFlashTimer > 0) {
                ctx.save();
                ctx.globalAlpha = 0.65 * (this.healingFlashTimer / 0.45);
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = Math.ceil(drawW) || 1;
                tempCanvas.height = Math.ceil(drawH) || 1;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(this.sprite, 0, 0, tempCanvas.width, tempCanvas.height);
                tempCtx.globalCompositeOperation = 'source-atop';
                tempCtx.fillStyle = '#2ecc71'; // green
                tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                ctx.drawImage(tempCanvas, spriteDrawX, spriteDrawY);
                ctx.restore();
            }
        } else {
            // Placeholder drawing if sprite not loaded
            ctx.fillStyle = '#4A70D4';
            ctx.strokeStyle = '#304A8A';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.rect(spriteDrawX, spriteDrawY, drawW, drawH);
            ctx.fill();
            ctx.stroke();
        }

        // Render Hit Flash
        if (this.isHit) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.8 * (this.hitFlashTimer / 0.15); // Fade the flash
            if (this.sprite && this.sprite.complete) {
                ctx.drawImage(this.sprite, spriteDrawX, spriteDrawY, drawW, drawH);
            }
            ctx.restore();
        }

        if (this.characterData) {
            ctx.fillStyle = '#3498db'; // Faction Blue
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            // Name tag above the visual sprite
            ctx.fillText(this.characterData.name || "Player", drawX, drawY - this.playerVisualHeight - 5);
        }

        // Render sleek over-the-head player HP bar
        if (this.stats && this.stats.hp !== undefined) {
            const barWidth = 40;
            const barHeight = 5;
            const barY = drawY - this.playerVisualHeight - 20;
            const barX = drawX - barWidth / 2;
            
            // Background
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
            
            // Health
            const hpRatio = Math.max(0, this.stats.hp / this.stats.maxHp);
            ctx.fillStyle = '#3498db'; // Royal Blue for player
            ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
        }

        // Debug: Draw player's circular collision shape
        // ctx.strokeStyle = 'lime';
        // ctx.lineWidth = 1 / this.engine.zoomLevel;
        // ctx.beginPath();
        // // Draw the circle at its offsetted collision position
        // ctx.arc(drawX, drawY - GLOBAL_COLLISION_Y_OFFSET, this.collisionRadius, 0, Math.PI * 2);
        // ctx.stroke();
    }

    getSortY() {
        return this.currentPixelY;
    }

    updateMapCoordsFromPixels() {
        const newMapCoords = this.map.screenToMap(this.currentPixelX, this.currentPixelY);
        this.mapX = newMapCoords.x;
        this.mapY = newMapCoords.y;
    }

    // Check for nearby interactable elements (called by engine)
    checkForInteraction() {
        if (!this.engine || !this.map || !this.map.spawnPointsData) return null;

        for (const spawnPoint of this.map.spawnPointsData) {
            // Check only PLAYER_EXIT for now, can expand to other types
            if (spawnPoint.type === 'player_exit') {
                const dx = this.currentPixelX - spawnPoint.x;
                const dy = this.currentPixelY - spawnPoint.y;
                if ((dx * dx + dy * dy) < INTERACTION_RADIUS_SQ) {
                    return { type: 'spawn_point_exit', data: spawnPoint };
                }
            }
            // Add checks for NPCs or other interactables here later
        }
        return null;
    }
}

export default Player;