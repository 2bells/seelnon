// Projectiles & Autonomous Emitter Systems for Bullet-Hell Turrets and Custom Abilities

export class CreativeProjectile {
    constructor(engine, options) {
        this.engine = engine;
        this.id = `creative_proj_${Date.now()}_${Math.random()}`;
        this.isHighZ = true;
        
        this.startX = options.startX ?? options.position?.x ?? 0;
        this.startY = options.startY ?? options.position?.y ?? 0;
        this.position = { x: this.startX, y: this.startY };
        
        this.target = options.target ?? null; // For homing
        this.speed = options.speed ?? 180;
        this.angle = options.angle ?? 0;
        this.damage = options.damage ?? 15;
        this.color = options.color ?? '#e74c3c';
        this.radius = options.radius ?? 8;
        this.owner = options.owner ?? null; // Who fired it
        
        this.emoji = options.emoji ?? null;
        this.renderType = options.renderType ?? 'glow';
        
        // Behaviors: 'standard', 'seeking', 'circular', 'sinewave'
        this.type = options.type ?? 'standard';
        
        // Circular / Spiral Properties
        this.circularSpeed = options.circularSpeed ?? 3; // Rotational velocity
        this.radiusDistance = options.radiusDistance ?? 0;
        
        // Sine Wave Properties
        this.sinFrequency = options.sinFrequency ?? 8;
        this.sinAmplitude = options.sinAmplitude ?? 30;
        
        this.lifeTime = options.lifeTime ?? 6.0; // 6 seconds before self-destruction
        this.age = 0;
        this.turnAfterShot = options.turnAfterShot ?? 0;
    }

    update(deltaTime) {
        this.age += deltaTime;
        if (this.age >= this.lifeTime) {
            this.engine.removeEffect(this);
            return;
        }

        // Apply movement depending on projectile type
        if (this.type === 'seeking' && this.target && this.target.stats && this.target.stats.hp > 0) {
            // Homing tracking: turn slowly or directly home
            const targetY = this.target.currentPixelY - 16;
            const dx = this.target.currentPixelX - this.position.x;
            const dy = targetY - this.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 0) {
                // Direct interpolation with speed
                const targetAngle = Math.atan2(dy, dx);
                // Simple turning angle limit could be applied, but direct tracking is awesome
                this.angle = targetAngle;
                this.position.x += Math.cos(this.angle) * this.speed * deltaTime;
                this.position.y += Math.sin(this.angle) * this.speed * deltaTime;
            }
        } 
        else if (this.type === 'circular') {
            // Spiral orbit pattern
            this.angle += this.circularSpeed * deltaTime;
            this.radiusDistance += this.speed * deltaTime;
            
            this.position.x = this.startX + Math.cos(this.angle) * this.radiusDistance;
            this.position.y = this.startY + Math.sin(this.angle) * this.radiusDistance;
        } 
        else if (this.type === 'sinewave') {
            // Waves perpendicular to forward angle line
            const forwardX = Math.cos(this.angle) * this.speed * this.age;
            const forwardY = Math.sin(this.angle) * this.speed * this.age;
            
            const normalX = -Math.sin(this.angle);
            const normalY = Math.cos(this.angle);
            const lateral = Math.sin(this.age * this.sinFrequency) * this.sinAmplitude;
            
            this.position.x = this.startX + forwardX + normalX * lateral;
            this.position.y = this.startY + forwardY + normalY * lateral;
        } 
        else {
            // Standard straight line projectile
            if (this.turnAfterShot && this.turnAfterShot !== 0) {
                this.angle += this.turnAfterShot * deltaTime;
            }
            this.position.x += Math.cos(this.angle) * this.speed * deltaTime;
            this.position.y += Math.sin(this.angle) * this.speed * deltaTime;
        }

        // Collision Check: Check hits on the opposite team
        // If owner is player/allied, we target enemies. If owner is enemy, we target player/allied.
        const isFriendly = (obj) => {
            if (!obj) return false;
            return (
                obj === this.engine.player ||
                obj.friendly === true ||
                (obj.constructor && obj.constructor.name === 'Player') ||
                obj.type === 'tower_player' ||
                obj.broadType === 'player_ability' ||
                (obj.name && (
                    obj.name.toLowerCase().includes('allied') ||
                    obj.name.toLowerCase().includes('doran')
                ))
            );
        };

        const isHostile = (obj) => {
            if (!obj) return false;
            return (
                obj.type === 'tower_enemy' ||
                obj.broadType === 'enemy' ||
                (obj.constructor && obj.constructor.name === 'Enemy' && obj.friendly !== true) ||
                (obj.name && (
                    obj.name.toLowerCase().includes('scruffy') ||
                    (obj.name.toLowerCase().includes('slime') && !obj.name.toLowerCase().includes('allied'))
                ))
            );
        };

        const isPlayerFired = isFriendly(this.owner);
        const gameObjects = this.engine.gameObjects || [];

        for (const obj of gameObjects) {
            if (obj !== this.owner && obj.takeDamage && obj.stats && obj.stats.hp > 0) {
                const isValidTarget = isPlayerFired ? isHostile(obj) : isFriendly(obj);
                if (isValidTarget) {
                    const targetY = obj.currentPixelY - 16;
                    const dx = obj.currentPixelX - this.position.x;
                    const dy = targetY - this.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const collisionRadius = obj.collisionRadius || 16;
                    
                    if (dist < collisionRadius) {
                        obj.takeDamage(this.damage, this.owner);
                        this.engine.removeEffect(this);
                        return;
                    }
                }
            }
        }
    }

    render(ctx, viewOriginX, viewOriginY) {
        const drawX = this.position.x - viewOriginX;
        const drawY = this.position.y - viewOriginY;

        ctx.save();
        
        if (this.emoji) {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = this.radius * 1.5;
            ctx.font = `${this.radius * 2.5}px Arial, Helvetica, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            ctx.translate(drawX, drawY);
            // Apply fun spinning rotation for non-homing emojis, and face-target rotation for homing!
            const rot = this.type === 'seeking' ? this.angle + Math.PI / 2 : (this.age * 5);
            ctx.rotate(rot);
            ctx.fillText(this.emoji, 0, 0);
        } else {
            // Radial outer glow
            ctx.beginPath();
            const gradient = ctx.createRadialGradient(drawX, drawY, 2, drawX, drawY, this.radius * 2.5);
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.3, this.color);
            gradient.addColorStop(0.7, this.color);
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gradient;
            ctx.arc(drawX, drawY, this.radius * 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Core dot
            ctx.beginPath();
            ctx.fillStyle = '#ffffff';
            ctx.arc(drawX, drawY, this.radius * 0.7, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    getSortY() {
        return this.position.y;
    }

    getCollisionBounds() {
        return null;
    }
}

export class Emitter {
    constructor(engine, owner, config = {}) {
        this.engine = engine;
        this.owner = owner; // NPC or Ability object
        
        // Load settings from a global preset database if referenced
        if (config.presetId) {
            const presets = getAllProjectiles();
            const pr = presets[config.presetId];
            if (pr) {
                config = {
                    ...config,
                    projectileType: pr.emitter?.type || pr.projectileType || 'standard',
                    projectileSpeed: pr.emitter?.projectileSpeed || pr.speed || 160,
                    projectileColor: pr.color || '#ff3333',
                    projectileRadius: pr.radius || 8,
                    emoji: pr.emoji || '',
                    renderType: pr.renderType || 'glow',
                    damage: pr.emitter?.damage || pr.damage || 15,
                    burstCount: pr.emitter?.burstCount || pr.burstCount || 1,
                    sinFrequency: pr.emitter?.sinFrequency || pr.sinFrequency || 8,
                    sinAmplitude: pr.emitter?.sinAmplitude || pr.sinAmplitude || 30,
                    circularSpeed: pr.emitter?.circularSpeed || pr.circularSpeed || 3,
                    showArea: pr.emitter?.showArea ?? pr.showArea ?? true,
                    notify: pr.emitter?.notify ?? pr.notify ?? false,
                    cooldown: pr.emitter?.cooldown || pr.cooldown || 1.5,
                    range: pr.emitter?.range || pr.range || 220,
                    spacing: pr.emitter?.spacing ?? pr.spacing ?? 0.5,
                    spinning: pr.emitter?.spinning ?? pr.spinning ?? 0,
                    turnAfterShot: pr.emitter?.turnAfterShot ?? pr.turnAfterShot ?? 0,
                    burstDelay: pr.emitter?.burstDelay ?? pr.burstDelay ?? 0,
                };
            }
        }

        this.enabled = config.enabled ?? true;
        this.range = config.range ?? 220;
        this.cooldown = config.cooldown ?? 1.5;
        this.timer = 0;
        
        // Projectile options
        this.projectileType = config.projectileType ?? 'standard'; // 'standard', 'seeking', 'circular', 'sinewave', 'starburst'
        this.projectileSpeed = config.projectileSpeed ?? 160;
        this.projectileColor = config.projectileColor ?? '#ff3333';
        this.projectileRadius = config.projectileRadius ?? 8;
        this.emoji = config.emoji ?? '';
        this.renderType = config.renderType ?? 'glow';
        this.damage = config.damage ?? 15;
        this.burstCount = config.burstCount ?? 1; // Number of bullets fired (e.g. spread)
        this.spiralOffset = 0; // Incremented over shots for spiraling nova patterns
        
        // Sine wave modifiers
        this.sinFrequency = config.sinFrequency ?? 8;
        this.sinAmplitude = config.sinAmplitude ?? 30;
        
        // Spiral modifiers
        this.circularSpeed = config.circularSpeed ?? 3;
        
        // Telegraph option
        this.showArea = config.showArea ?? true;
        this.notify = config.notify ?? false;

        // Custom features additions
        this.spacing = config.spacing ?? 0.5;
        this.spinning = config.spinning ?? 0;
        this.turnAfterShot = config.turnAfterShot ?? 0;
        this.burstDelay = config.burstDelay ?? 0;

        this.burstQueue = [];
        this.burstQueueTimer = 0;
    }

    spawnProjectile(options) {
        if (!this.engine) return;
        const proj = new CreativeProjectile(this.engine, options);
        this.engine.addEffect(proj);
    }

    update(deltaTime) {
        if (!this.enabled) return;

        if (this.burstQueue && this.burstQueue.length > 0) {
            this.burstQueueTimer -= deltaTime;
            if (this.burstQueueTimer <= 0) {
                this.burstQueueTimer = this.burstDelay || 0.1;
                const nextShot = this.burstQueue.shift();
                if (nextShot) {
                    this.spawnProjectile(nextShot);
                }
            }
        }

        this.timer -= deltaTime;
        if (this.timer <= 0) {
            this.timer = this.cooldown;
            this.fire();
        }
    }

    fire() {
        // Check friendliness using robust criteria matching players, friendly structures or doran
        const checkIsFriendly = (obj) => {
            if (!obj) return false;
            return (
                obj === this.engine.player ||
                obj.friendly === true ||
                (obj.constructor && obj.constructor.name === 'Player') ||
                obj.type === 'tower_player' ||
                obj.broadType === 'player_ability' ||
                (obj.name && (
                    obj.name.toLowerCase().includes('allied') ||
                    obj.name.toLowerCase().includes('doran') ||
                    obj.name.toLowerCase().includes('player')
                ))
            );
        };

        const checkIsHostile = (obj) => {
            if (!obj) return false;
            // Exclude everything friendly
            if (checkIsFriendly(obj)) return false;
            return (
                obj.type === 'tower_enemy' ||
                obj.broadType === 'enemy' ||
                obj.broadType === 'turret' ||
                (obj.constructor && obj.constructor.name === 'Enemy') ||
                (obj.name && (
                    obj.name.toLowerCase().includes('scruffy') ||
                    (obj.name.toLowerCase().includes('slime') && !obj.name.toLowerCase().includes('allied'))
                ))
            );
        };

        const isFriendly = checkIsFriendly(this.owner);
        let target = null;
        
        let closestDist = this.range;
        const gameObjects = this.engine.gameObjects || [];

        // Dynamic targeting scan of ARAM or standard custom elements
        for (const obj of gameObjects) {
            if (obj !== this.owner && obj.stats && obj.stats.hp > 0) {
                const wantsHostile = isFriendly ? checkIsHostile(obj) : checkIsFriendly(obj);
                if (wantsHostile) {
                    const dx = obj.currentPixelX - this.owner.currentPixelX;
                    const dy = obj.currentPixelY - this.owner.currentPixelY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < closestDist) {
                        closestDist = dist;
                        target = obj;
                    }
                }
            }
        }

        if (!target) {
            if (isFriendly && this.owner && this.owner.abilityTargetPos) {
                target = {
                    currentPixelX: this.owner.abilityTargetPos.x,
                    currentPixelY: this.owner.abilityTargetPos.y + 16,
                    stats: { hp: 1 }
                };
            } else {
                return; // No targets in range and no abilities target position
            }
        }

        const startX = this.owner.currentPixelX;
        const startY = this.owner.currentPixelY - 24; // Fired from chest height
        
        const targetY = target.currentPixelY - 16;
        const baseAngle = Math.atan2(targetY - startY, target.currentPixelX - startX);
        
        // Apply Notify text
        if (this.notify && this.engine) {
            const FloatingTextClazz = this.engine.FloatingTextEffect || null;
            if (FloatingTextClazz) {
                this.engine.addEffect(new FloatingTextClazz(this.engine, {
                    text: `⚠️ Discharge!`,
                    position: { x: this.owner.currentPixelX, y: this.owner.currentPixelY - 64 },
                    color: '#f39c12',
                    duration: 0.8
                }));
            }
        }

        // Support dynamic firing behaviors
        const count = this.burstCount;
        const spacing = this.spacing ?? 0.5; // Custom angle-spread in radians
        const spinningVal = this.spinning ?? 0;

        let finalDamage = this.damage;
        if (this.owner) {
            let ownerAtk = 10;
            if (typeof this.owner.getAtk === 'function') {
                ownerAtk = this.owner.getAtk();
            } else if (this.owner.stats && this.owner.stats.atk !== undefined) {
                ownerAtk = this.owner.stats.atk;
            }
            // Standard scale: Base damage + 100% of Owner ATK
            finalDamage = Math.floor(this.damage + 1.0 * ownerAtk);
        }

        const shotsToSchedule = [];

        if (this.projectileType === 'starburst') {
            // Fires a full starburst ring of bullets
            for (let i = 0; i < count; i++) {
                const angle = baseAngle + (i * (Math.PI * 2) / count) + this.spiralOffset;
                shotsToSchedule.push({
                    startX, startY,
                    angle: angle,
                    speed: this.projectileSpeed,
                    damage: finalDamage,
                    color: this.projectileColor,
                    radius: this.projectileRadius,
                    owner: this.owner,
                    emoji: this.emoji,
                    renderType: this.renderType,
                    type: 'standard',
                    turnAfterShot: this.turnAfterShot
                });
            }
            this.spiralOffset += (spinningVal !== 0 ? spinningVal : 0.25);
        } 
        else if (count > 1) {
            // Spread shot pattern
            const spreadAngle = spacing;
            const angleStep = spreadAngle / (count - 1);
            const startAngle = baseAngle - spreadAngle / 2;
            
            for (let i = 0; i < count; i++) {
                const angle = startAngle + (angleStep * i);
                shotsToSchedule.push({
                    startX, startY,
                    angle: angle,
                    speed: this.projectileSpeed,
                    damage: finalDamage,
                    color: this.projectileColor,
                    radius: this.projectileRadius,
                    owner: this.owner,
                    target: target,
                    emoji: this.emoji,
                    renderType: this.renderType,
                    type: this.projectileType,
                    circularSpeed: this.circularSpeed,
                    sinFrequency: this.sinFrequency,
                    sinAmplitude: this.sinAmplitude,
                    turnAfterShot: this.turnAfterShot
                });
            }
            this.spiralOffset += spinningVal;
        } 
        else {
            // Single shot
            shotsToSchedule.push({
                startX, startY,
                angle: baseAngle,
                speed: this.projectileSpeed,
                damage: finalDamage,
                color: this.projectileColor,
                radius: this.projectileRadius,
                owner: this.owner,
                target: target,
                emoji: this.emoji,
                renderType: this.renderType,
                type: this.projectileType,
                circularSpeed: this.circularSpeed,
                sinFrequency: this.sinFrequency,
                sinAmplitude: this.sinAmplitude,
                turnAfterShot: this.turnAfterShot
            });
            this.spiralOffset += spinningVal;
        }

        // If burst delay is configured, queue these shots!
        if (this.burstDelay && this.burstDelay > 0 && shotsToSchedule.length > 1) {
            this.burstQueue = shotsToSchedule;
            this.burstQueueTimer = 0; // Fire first shot immediately
        } else {
            // Otherwise, spawn all immediately
            shotsToSchedule.forEach(opt => this.spawnProjectile(opt));
        }
    }

    renderRangeArea(ctx, viewOriginX, viewOriginY) {
        if (!this.enabled || !this.showArea) return;

        const drawX = this.owner.currentPixelX - viewOriginX;
        const drawY = this.owner.currentPixelY - viewOriginY;

        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = this.projectileColor;
        ctx.fillStyle = this.projectileColor + '10'; // 10 is very translucent alpha hex
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        
        // Draw ellipse reflecting perspective
        ctx.ellipse(drawX, drawY, this.range, this.range * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

const RPG_PROJECTILE_STORAGE_KEY = 'rpg_custom_projectiles';

export const DEFAULT_PROJECTILES = {
    'spark_bullet': {
        id: 'spark_bullet',
        name: 'Red Spark Bullet',
        renderType: 'glow',
        emoji: '',
        color: '#ff3333',
        radius: 8,
        emitter: {
            type: 'standard',
            cooldown: 1.5,
            projectileSpeed: 160,
            burstCount: 1,
            range: 220,
            sinFrequency: 8,
            sinAmplitude: 30,
            circularSpeed: 3,
            showArea: true,
            notify: false,
            damage: 15
        }
    },
    'homing_flame': {
        id: 'homing_flame',
        name: 'Homing Flame Spark',
        renderType: 'emoji',
        emoji: '🔥',
        color: '#ff6600',
        radius: 12,
        emitter: {
            type: 'seeking',
            cooldown: 1.2,
            projectileSpeed: 140,
            burstCount: 1,
            range: 240,
            sinFrequency: 8,
            sinAmplitude: 30,
            circularSpeed: 3,
            showArea: true,
            notify: true,
            damage: 20
        }
    },
    'toxic_spiral': {
        id: 'toxic_spiral',
        name: 'Toxic Acid Spiral',
        renderType: 'emoji',
        emoji: '☣️',
        color: '#2ecc71',
        radius: 10,
        emitter: {
            type: 'circular',
            cooldown: 0.8,
            projectileSpeed: 120,
            burstCount: 3,
            range: 200,
            sinFrequency: 8,
            sinAmplitude: 30,
            circularSpeed: 4,
            showArea: true,
            notify: false,
            damage: 12
        }
    },
    'electric_sine': {
        id: 'electric_sine',
        name: 'Electric Sine Shock',
        renderType: 'emoji',
        emoji: '⚡',
        color: '#f1c40f',
        radius: 10,
        emitter: {
            type: 'sinewave',
            cooldown: 1.0,
            projectileSpeed: 180,
            burstCount: 2,
            range: 220,
            sinFrequency: 10,
            sinAmplitude: 40,
            circularSpeed: 3,
            showArea: true,
            notify: false,
            damage: 18
        }
    },
    'nova_frost': {
        id: 'nova_frost',
        name: 'Nova Frost Blast',
        renderType: 'emoji',
        emoji: '❄️',
        color: '#3498db',
        radius: 14,
        emitter: {
            type: 'starburst',
            cooldown: 2.0,
            projectileSpeed: 150,
            burstCount: 12,
            range: 250,
            sinFrequency: 8,
            sinAmplitude: 30,
            circularSpeed: 3,
            showArea: true,
            notify: true,
            damage: 25
        }
    },
    'sentry_orb_allied': {
        id: 'sentry_orb_allied',
        name: 'Allied Sentry Orb',
        renderType: 'glow',
        emoji: '',
        color: '#3498db',
        radius: 10,
        emitter: {
            type: 'seeking',
            cooldown: 1.6,
            projectileSpeed: 150,
            burstCount: 1,
            range: 140,
            sinFrequency: 8,
            sinAmplitude: 30,
            circularSpeed: 3,
            showArea: true,
            notify: false,
            damage: 25
        }
    },
    'sentry_orb_hostile': {
        id: 'sentry_orb_hostile',
        name: 'Hostile Sentry Orb',
        renderType: 'glow',
        emoji: '',
        color: '#e74c3c',
        radius: 10,
        emitter: {
            type: 'seeking',
            cooldown: 1.6,
            projectileSpeed: 150,
            burstCount: 1,
            range: 140,
            sinFrequency: 8,
            sinAmplitude: 30,
            circularSpeed: 3,
            showArea: true,
            notify: false,
            damage: 25
        }
    },
    'plasma_orb_bullet': {
        id: 'plasma_orb_bullet',
        name: 'Plasma Orb Spark',
        renderType: 'glow',
        emoji: '',
        color: '#f1c40f',
        radius: 5,
        emitter: {
            type: 'starburst',
            cooldown: 1.5,
            projectileSpeed: 180,
            burstCount: 5,
            range: 220,
            sinFrequency: 10,
            sinAmplitude: 40,
            circularSpeed: 3,
            showArea: false,
            notify: false,
            damage: 18
        }
    }
};

export function getAllProjectiles() {
    let custom = {};
    try {
        const stored = localStorage.getItem(RPG_PROJECTILE_STORAGE_KEY);
        if (stored) {
            custom = JSON.parse(stored);
        }
    } catch (e) {
        console.error("Error parsing custom projectile presets:", e);
    }
    return { ...DEFAULT_PROJECTILES, ...custom };
}

export function saveCustomProjectile(preset) {
    let custom = {};
    try {
        const stored = localStorage.getItem(RPG_PROJECTILE_STORAGE_KEY);
        if (stored) {
            custom = JSON.parse(stored);
        }
    } catch (e) {
        console.error("Error parsing custom projectile presets before save:", e);
    }
    custom[preset.id] = preset;
    localStorage.setItem(RPG_PROJECTILE_STORAGE_KEY, JSON.stringify(custom));
    console.log(`Saved custom projectile preset "${preset.name}" to localStorage.`);
}

export function deleteCustomProjectile(id) {
    let custom = {};
    try {
        const stored = localStorage.getItem(RPG_PROJECTILE_STORAGE_KEY);
        if (stored) {
            custom = JSON.parse(stored);
        }
    } catch (e) {
        console.error("Error parsing custom projectile presets before delete:", e);
    }
    if (custom[id]) {
        delete custom[id];
        localStorage.setItem(RPG_PROJECTILE_STORAGE_KEY, JSON.stringify(custom));
        return true;
    }
    return false;
}
