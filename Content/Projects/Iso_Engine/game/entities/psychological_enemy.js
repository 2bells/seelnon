// Psychological AI Rival Boss - Acts like a real player with internal psychology metrics
import Enemy from './enemy.js';
import NPC from './npc.js';
import { EnemyPsychology } from '../combat/psychology.js';
import { updateAbilityCycle, executeAbility, getAllAbilities } from '../combat/ability_system.js';
import { FloatingTextEffect, TelegraphEffect, ParticleSplatterEffect } from '../combat/effects.js';
import GameObject from './gameObject.js';

export class PsychologicalEnemy extends Enemy {
    constructor(engine, map, mapX, mapY, npcData) {
        // Build raw enemy data configuration
        const instanceData = {
            id: 'rival_psychological_enemy_' + Date.now(),
            name: npcData.name || "Rival Champion",
            assetName: 'enemy_sprite',  // Uses game/assets/enemy_sprite.png
            visualWidth: 32,
            visualHeight: 48,
            anchorOffsetX: 16,
            anchorOffsetY: 48,
            stats: {
                level: npcData.stats.level || 5,
                hp: npcData.stats.hp || 200,
                maxHp: npcData.stats.maxHp || 200,
                atk: npcData.stats.atk || 14,
                def: npcData.stats.def || 8,
                speed: npcData.stats.speed || 90,
                aggroRange: 320,
                attackRange: 130,
                attackCooldown: 1.5,
            },
            ...npcData
        };

        super(engine, map, mapX, mapY, instanceData);

        // Save base stats for scaling according to psychology multipliers
        this.baseStats = {
            hp: this.stats.hp,
            maxHp: this.stats.maxHp,
            atk: this.stats.atk,
            def: this.stats.def,
            speed: this.stats.speed
        };

        // Initialize Internal Psychology Engine!
        this.psychology = new EnemyPsychology(this);

        // Player-like cooldown state mapping (we need this so we can cast player skills)
        this.abilityCooldowns = {};

        // Custom action decision timers
        this.mindBubbleTimer = 1.5; // Displays mind status emojis above head
        
        // Counter-attack window trigger flags
        this.pendingCounterAttack = false;
        this.counterAttackCooldown = 0;

        // Custom colors/aura for a legendary rival
        this.poeAuraColor = 'rgba(155, 89, 182, 0.3)'; // purple boss ring
        this.poeAuraBorderColor = '#9b59b6';
        this.poeScale = 1.35;
        this.colorTintFilter = 'none'; // natural sprite artwork

        // Custom tracking for resetting HUD when dead
        this.isDeadReported = false;
    }

    takeDamage(amount) {
        if (this.aiState === 'dead') return;

        // Propagate down to psychology sliders (increases caution/defensiveness!)
        this.psychology.onHitTaken(amount);

        // Defensive counter-attack bait mechanic!
        if (this.psychology.defensiveVsOffensive < 45 && this.counterAttackCooldown <= 0) {
            this.pendingCounterAttack = true;
            this.counterAttackCooldown = 3.5; // counter-attack trigger cooldown
        }

        // Parent implementation for visual flash, text floating and death checking
        super.takeDamage(amount);

        // If dead, check for rewards, reset HUD or similar
        if (this.stats.hp <= 0) {
            this.isDeadReported = true;
            this.hideRivalHUD();

            // Save level and stats before death/respawn
            if (this.engine) {
                this.engine.savedRivalStats = {
                    level: this.stats.level || 5,
                    exp: this.stats.exp || 0,
                    nextLevelExp: this.stats.nextLevelExp || 100,
                    hp: this.stats.maxHp || 200,
                    maxHp: this.stats.maxHp || 200,
                    atk: this.stats.atk || 14,
                    def: this.stats.def || 8,
                    speed: this.stats.speed || 90
                };
                this.engine.rivalActive = false;
                this.engine.rivalInstance = null;
                if (typeof this.engine.updateRivalButtonState === 'function') {
                    this.engine.updateRivalButtonState();
                }
            }
            
            // Spawn extra juicy gold
            if (this.engine && this.engine.player) {
                const bounty = 100 + Math.round(Math.random() * 50);
                this.engine.player.gold = (this.engine.player.gold || 0) + bounty;
                this.engine.addEffect(new FloatingTextEffect(this.engine, {
                    text: `🏆 BOUNTY +${bounty} GOLD`,
                    position: { x: this.currentPixelX, y: this.currentPixelY - 60 },
                    color: '#f1c40f'
                }));
            }
        }
    }

    hasAbilityEquipped(abilityId) {
        if (!this.player) return false;
        // Keep abilities 1-to-1: check player's equipped/hotbar abilities
        if (Array.isArray(this.player.equippedAbilities)) {
            return this.player.equippedAbilities.includes(abilityId);
        }
        return false;
    }

    gainExp(amount) {
        if (this.aiState === 'dead') return;

        if (!this.stats.level) {
            this.stats.level = 1;
        }
        if (this.stats.exp === undefined) {
            this.stats.exp = 0;
            this.stats.nextLevelExp = 100;
        }

        this.stats.exp += amount;

        // Level up check matching hero 1 to 1!
        while (this.stats.exp >= this.stats.nextLevelExp) {
            this.stats.exp -= this.stats.nextLevelExp;
            this.stats.level++;
            this.stats.nextLevelExp = Math.floor(this.stats.nextLevelExp * 1.5);

            // Match stat growth formula of player
            this.baseStats.maxHp = Math.floor(this.baseStats.maxHp * 1.15) + 15;
            this.baseStats.hp = this.baseStats.maxHp;
            this.baseStats.atk = Math.floor(this.baseStats.atk * 1.12) + 2;
            this.baseStats.def = Math.floor(this.baseStats.def * 1.10) + 1;

            this.stats.maxHp = this.baseStats.maxHp;
            this.stats.hp = this.stats.maxHp; // Heal to full on level up!

            if (typeof FloatingTextEffect !== 'undefined' && this.engine) {
                this.engine.addEffect(new FloatingTextEffect(this.engine, {
                    text: `👑 RIVAL LEVEL UP! Lvl ${this.stats.level} 👑`,
                    position: { x: this.currentPixelX, y: this.currentPixelY - 70 },
                    color: '#9b59b6'
                }));
            }
        }
    }

    update(deltaTime) {
        if (this.aiState === 'dead') {
            this.hideRivalHUD();
            super.update(deltaTime);
            return;
        }

        // Proximity optimization checks
        const p = this.engine.player;
        if (p) {
            const dx = p.currentPixelX - this.currentPixelX;
            const dy = p.currentPixelY - this.currentPixelY;
            const distSq = dx * dx + dy * dy;
            if (distSq > 800 * 800) {
                this.hideRivalHUD();
                return; // Sleep
            } else {
                this.showRivalHUD();
            }
        }

        // --- LEVEL & CAPABILITY SYNCING WITH HERO 1-TO-1 ---
        if (p && p.stats) {
            const playerLvl = p.stats.level || 1;
            
            // Dynamic catch-up check to keep levels strictly matching or surpassing player
            if (this.stats.level < playerLvl) {
                const levelsNeeded = playerLvl - this.stats.level;
                for (let i = 0; i < levelsNeeded; i++) {
                    const nextExpGoal = this.stats.nextLevelExp || 100;
                    this.gainExp(nextExpGoal);
                }
            }

            // Sync base stats proportional to player stat growth
            const diffLevel = this.engine.aramDifficultyLevel || 1;
            let levelScale = 1.0;
            if (diffLevel === 2) levelScale = 1.15;
            else if (diffLevel === 3) levelScale = 1.30;

            this.baseStats.maxHp = Math.round(p.stats.maxHp * levelScale);
            this.baseStats.atk = Math.round(p.stats.atk * levelScale);
            this.baseStats.def = Math.round(p.stats.def * levelScale);
            this.baseStats.speed = p.pixelSpeed ? p.pixelSpeed * 0.8 : (p.stats.speed || 120); // matching speed
            if (isNaN(this.baseStats.speed) || !this.baseStats.speed) {
                this.baseStats.speed = 120;
            }

            // Sync stats constraints
            if (this.stats.maxHp !== this.baseStats.maxHp) {
                const maxHpDiff = this.baseStats.maxHp - this.stats.maxHp;
                this.stats.maxHp = this.baseStats.maxHp;
                if (maxHpDiff > 0) {
                    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + maxHpDiff);
                } else {
                    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp);
                }
            }
        }

        // Tick internal psychology calculations
        this.psychology.update(deltaTime);

        // Tick custom action cooldowns
        this.counterAttackCooldown = Math.max(0, this.counterAttackCooldown - deltaTime);

        // Apply slider multipliers to gameplay statistics
        this.stats.atk = Math.round(this.baseStats.atk * this.psychology.getStatModifier('atk_mult'));
        this.stats.def = Math.round(this.baseStats.def * this.psychology.getStatModifier('def_mult'));
        this.stats.speed = Math.round(this.baseStats.speed * this.psychology.getStatModifier('speed_mult'));

        // Tick standard action abilities
        updateAbilityCycle(this, deltaTime);

        // Render dynamic psychology floating labels
        this.mindBubbleTimer -= deltaTime;
        if (this.mindBubbleTimer <= 0) {
            this.mindBubbleTimer = 2.0 + Math.random() * 2.0;
            this.triggerMindNotification();
        }

        // Run standard updates (timers, targets)
        super.update(deltaTime);

        // Sync local HUD indicators
        this.syncRivalHUD();
    }

    findCurrentTarget() {
        // PvP focus - target the player first!
        if (this.player && this.player.stats.hp > 0) {
            return this.player;
        }
        // If player is dead, target allied friendly minions/slimes
        let bestTarget = null;
        let bestDist = Infinity;
        if (this.engine && this.engine.gameObjects) {
            for (const obj of this.engine.gameObjects) {
                if (obj instanceof Enemy && obj.friendly === true && obj.stats && obj.stats.hp > 0) {
                    const dist = this.getDistanceTo(obj);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestTarget = obj;
                    }
                }
            }
        }
        return bestTarget;
    }

    triggerMindNotification() {
        const tacticalState = this.currentTacticalState || "PUSH_LANE";
        let emoji = "💭";
        let color = "#efebe0";

        if (tacticalState === "RETREAT_TO_TOWER") {
            const list = ["🛡️ Fall Back!", "😱 Panic!", "🏃 Safety First!", "🛡️ Retreating to cover!"];
            emoji = list[Math.floor(Math.random() * list.length)];
            color = "#e74c3c";
        } else if (tacticalState === "BAITING_UNDER_TOWER") {
            const list = ["🛡️ Baiting! Chase me!", "🛡️ Play Safe", "🔥 Try to dive me!", "🛡️ Under Sentry tower protection"];
            emoji = list[Math.floor(Math.random() * list.length)];
            color = "#3498db";
        } else if (tacticalState === "AGGRESSIVE_ENGAGE") {
            const list = ["⚔️ Focus Hero!", "⚔️ Rushdown!", "🔥 Decimating!", "⚡ Get Zoned!"];
            emoji = list[Math.floor(Math.random() * list.length)];
            color = "#f1c40f";
        } else if (tacticalState === "PUSH_LANE") {
            const list = ["🧹 Clear waves!", "🔥 Pushing lane!", "🏆 No hero in sight!", "🧹 Moving with wave"];
            emoji = list[Math.floor(Math.random() * list.length)];
            color = "#2ecc71";
        }

        this.engine.addEffect(new FloatingTextEffect(this.engine, {
            text: emoji,
            position: { x: this.currentPixelX, y: this.currentPixelY - 55 },
            color: color
        }));
    }

    executeAIState(deltaTime) {
        if (this.stats.hp <= 0) {
            this.hideRivalHUD();
            super.executeAIState(deltaTime);
            return;
        }

        // Decrement stable decision timer to avoid rapid state spam/back-and-forth spasming
        if (this.tacticalDecisionTimer === undefined) {
            this.tacticalDecisionTimer = 0.0;
        } else {
            this.tacticalDecisionTimer = Math.max(0, this.tacticalDecisionTimer - deltaTime);
        }

        // --- GATHER TACTICAL AND ENVIRONMENTAL VARIABLES ---
        const activePlayerTowers = this.engine.gameObjects.filter(
            obj => obj.type === 'tower_player' && obj.stats && !obj.stats.isDestroyed
        );

        const activeEnemyTowers = this.engine.gameObjects.filter(
            obj => obj.type === 'tower_enemy' && obj.stats && !obj.stats.isDestroyed
        );

        // Find closest Player Tower (Hostile to rival)
        let closestPlayerTower = null;
        let distToPlayerTower = Infinity;
        for (const tower of activePlayerTowers) {
            const tdx = tower.currentPixelX - this.currentPixelX;
            const tdy = tower.currentPixelY - this.currentPixelY;
            const tdist = Math.sqrt(tdx * tdx + (tdy * 2.5) * (tdy * 2.5)); // Isometric distance ratio
            if (tdist < distToPlayerTower) {
                distToPlayerTower = tdist;
                closestPlayerTower = tower;
            }
        }

        // Find closest Enemy (our team's defense) Tower
        let closestEnemyTower = null;
        let distToEnemyTower = Infinity;
        for (const tower of activeEnemyTowers) {
            const adx = tower.currentPixelX - this.currentPixelX;
            const ady = tower.currentPixelY - this.currentPixelY;
            const adist = Math.sqrt(adx * adx + ady * ady);
            if (adist < distToEnemyTower) {
                distToEnemyTower = adist;
                closestEnemyTower = tower;
            }
        }

        // Count nearby minion slimes (within range 250)
        const alliedCreeps = this.engine.gameObjects.filter(
            obj => obj instanceof Enemy && obj.friendly !== true && obj !== this && obj.stats && obj.stats.hp > 0 &&
            (Math.sqrt((obj.currentPixelX - this.currentPixelX)**2 + (obj.currentPixelY - this.currentPixelY)**2) < 250)
        );

        const enemyCreeps = this.engine.gameObjects.filter(
            obj => obj instanceof Enemy && obj.friendly === true && obj.stats && obj.stats.hp > 0 &&
            (Math.sqrt((obj.currentPixelX - this.currentPixelX)**2 + (obj.currentPixelY - this.currentPixelY)**2) < 250)
        );

        // Map coordinate and territory checks
        let mapCoords = null;
        if (this.map && typeof this.map.screenToMap === 'function') {
            mapCoords = this.map.screenToMap(this.currentPixelX, this.currentPixelY);
        }
        const currentTerritoryY = mapCoords ? mapCoords.y : 12.0;

        // Player condition
        const isPlayerAlive = this.player && this.player.stats && this.player.stats.hp > 0;
        const playerHPPercent = isPlayerAlive ? (this.player.stats.hp / this.player.stats.maxHp) * 100 : 0;
        const playerDistance = isPlayerAlive ? this.getDistanceTo(this.player) : Infinity;

        // --- STRATEGIC STATE DECIDER ---
        let targetX = this.spawnPoint ? this.spawnPoint.x : 288;
        let targetY = this.spawnPoint ? this.spawnPoint.y : 224;

        // Pre-fetch Scruffy (Red Base Shopkeeper / Guardian)
        let scruffy = null;
        if (this.engine && this.engine.gameObjects) {
            scruffy = this.engine.gameObjects.find(obj => obj instanceof NPC && obj.name.toLowerCase().includes('scruffy'));
        }
        const baseTargetX = scruffy ? scruffy.currentPixelX : (this.spawnPoint ? this.spawnPoint.x : 288);
        const baseTargetY = scruffy ? scruffy.currentPixelY : (this.spawnPoint ? this.spawnPoint.y : 224);

        // Gather psychological profiles for decision thresholds (0 to 100)
        const phyVsMen = this.psychology ? this.psychology.physicalVsMental : 50; 
        const defVsOff = this.psychology ? this.psychology.defensiveVsOffensive : 50; 
        const cauVsRec = this.psychology ? this.psychology.cautiousVsReckless : 50; 
        const confidence = this.psychology ? this.psychology.confidence : 50;

        // 1. HP Thresholds for Retreat (influenced heavily by caution/recklessness and defensiveness)
        // Base is 35%. Highly cautious retreats at 50% HP. Highly reckless only retreats at 15% HP or below.
        let retreatHpThreshold = 0.35;
        if (cauVsRec < 40 || defVsOff < 35) {
            retreatHpThreshold = 0.50; // runs away early
        } else if (cauVsRec > 75) {
            retreatHpThreshold = 0.15; // works up a fight to the bone
        }

        const isLowHpPsychological = this.stats.hp < this.stats.maxHp * retreatHpThreshold;
        const insideHostileTowerZone = closestPlayerTower && (distToPlayerTower < 185);

        // Minions cover: cautious team player wants creep coverage to dive tower
        let miniSlimesNeeded = 2;
        if (cauVsRec > 70) miniSlimesNeeded = 0; // YOLO dive
        else if (cauVsRec < 35) miniSlimesNeeded = 3; // secure dive
        const hasAlliedSlimeCoverInTower = alliedCreeps.length >= miniSlimesNeeded;

        const playerIsDangerousThreat = isPlayerAlive && playerHPPercent >= 15 && playerDistance < (cauVsRec < 40 ? 340 : 280);

        // Define emergency transition indicators (immediately bypasses hysteresis timer)
        const isEmergencyRetreat = isLowHpPsychological || (insideHostileTowerZone && !hasAlliedSlimeCoverInTower);
        const isTargetDeadEmergency = (this.currentTacticalState === "AGGRESSIVE_ENGAGE" && !isPlayerAlive);

        // Always refresh state decision if timer expires OR if an emergency occurs (unless we are already running away in RETREAT_TO_TOWER)
        let shouldEvaluateState = (this.tacticalDecisionTimer <= 0) || isEmergencyRetreat || isTargetDeadEmergency;
        if (this.currentTacticalState === "RETREAT_TO_TOWER" && isEmergencyRetreat) {
            shouldEvaluateState = (this.tacticalDecisionTimer <= 0); // avoid redundant continuous calculation while retreating
        }

        let tacticalState = this.currentTacticalState || "PUSH_LANE";

        if (shouldEvaluateState) {
            // Evaluated State Conditions
            const shouldRetreat = isLowHpPsychological || (insideHostileTowerZone && !hasAlliedSlimeCoverInTower) || (currentTerritoryY > 14.0 && playerIsDangerousThreat && alliedCreeps.length === 0);

            // Baiting preference: high Mental (phyVsMen > 65) or defensive posture (defVsOff < 40)
            const playsDefensivelyY = (defVsOff <= 55 && cauVsRec <= 55) || (phyVsMen > 65);

            if (shouldRetreat) {
                tacticalState = "RETREAT_TO_TOWER";
            } 
            // Baiting Under Tower Condition
            else if (closestEnemyTower && distToEnemyTower < 185 && isPlayerAlive && playerDistance < 320 && !isLowHpPsychological && playsDefensivelyY) {
                tacticalState = "BAITING_UNDER_TOWER";
            } 
            // Aggressive PvP Duel (ranges are extended if highly offensive or reckless)
            else if (isPlayerAlive && playerDistance < (defVsOff > 65 ? 380 : 300) && (!insideHostileTowerZone || hasAlliedSlimeCoverInTower)) {
                // Extremely cautious might still back off if player is healthy and level is high
                const cautionWillFlee = (cauVsRec < 35 && playerHPPercent > 60 && this.stats.hp < this.stats.maxHp * 0.70);

                if (!cautionWillFlee && (!isLowHpPsychological || alliedCreeps.length >= enemyCreeps.length || defVsOff > 70)) {
                    tacticalState = "AGGRESSIVE_ENGAGE";
                } else {
                    tacticalState = "RETREAT_TO_TOWER";
                }
            } 
            // Default: Pushing lane
            else {
                tacticalState = "PUSH_LANE";
            }

            // Commit to the state for 1.4 to 2.2 seconds to prevent shivering/spasming between states!
            this.tacticalDecisionTimer = 1.4 + Math.random() * 0.8;
            this.currentTacticalState = tacticalState;
        }

        // --- MAP STATE TO RUNTIME MOVEMENT TARGET ---
        if (tacticalState === "RETREAT_TO_TOWER") {
            if (closestEnemyTower) {
                targetX = closestEnemyTower.currentPixelX;
                targetY = closestEnemyTower.currentPixelY;
            } else {
                targetX = baseTargetX;
                targetY = baseTargetY;
            }
        } 
        else if (tacticalState === "BAITING_UNDER_TOWER" && closestEnemyTower) {
            const dirX = baseTargetX - closestEnemyTower.currentPixelX;
            const dirY = baseTargetY - closestEnemyTower.currentPixelY;
            const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
            // Stand slightly behind the defender tower
            targetX = closestEnemyTower.currentPixelX + (dirX / len) * 35;
            targetY = closestEnemyTower.currentPixelY + (dirY / len) * 35;
        } 
        else if (tacticalState === "AGGRESSIVE_ENGAGE") {
            if (isPlayerAlive) {
                targetX = this.player.currentPixelX;
                targetY = this.player.currentPixelY;
            } else {
                // Fallback to push lane if player died in the meantime
                tacticalState = "PUSH_LANE";
                this.currentTacticalState = "PUSH_LANE";
            }
        }

        // Pushing lane target mapping (executed separately to catch dynamic minion movements)
        if (tacticalState === "PUSH_LANE") {
            if (enemyCreeps.length > 0) {
                let closestBlueSlime = enemyCreeps[0];
                let minSlimeDist = Infinity;
                for (const slime of enemyCreeps) {
                    const sd = this.getDistanceTo(slime);
                    if (sd < minSlimeDist) {
                        minSlimeDist = sd;
                        closestBlueSlime = slime;
                    }
                }
                targetX = closestBlueSlime.currentPixelX;
                targetY = closestBlueSlime.currentPixelY;
            } else {
                if (closestPlayerTower) {
                    targetX = closestPlayerTower.currentPixelX;
                    targetY = closestPlayerTower.currentPixelY;
                } else {
                    const doran = this.engine.gameObjects.find(obj => obj instanceof NPC && obj.name.toLowerCase().includes('doran'));
                    if (doran) {
                        targetX = doran.currentPixelX;
                        targetY = doran.currentPixelY;
                    } else if (this.map) {
                        const baseCoords = this.map.mapToScreen(10.0, this.map.height - 2.0);
                        targetX = baseCoords.x;
                        targetY = baseCoords.y;
                    } else {
                        targetX = -384;
                        targetY = 464;
                    }
                }
            }
        }

        this.currentTacticalState = tacticalState;
        this.isTowerBaiting = (tacticalState === "BAITING_UNDER_TOWER" || tacticalState === "RETREAT_TO_TOWER");

        // --- EXECUTE PATHFINDING & SPEED RAME ---
        const distToTacticalTarget = Math.sqrt((targetX - this.currentPixelX)**2 + (targetY - this.currentPixelY)**2);
        
        let moveSpeed = this.stats.speed;
        if (tacticalState === "RETREAT_TO_TOWER") {
            moveSpeed *= 1.2;
        } else if (tacticalState === "BAITING_UNDER_TOWER") {
            moveSpeed *= 0.85;
        } else if (tacticalState === "AGGRESSIVE_ENGAGE") {
            moveSpeed *= 1.05;
        } else {
            moveSpeed *= 0.9;
        }

        if (distToTacticalTarget > 15) {
            const step = this.updatePathfinding(deltaTime, targetX, targetY);
            this.moveTowards(deltaTime, step.tx - this.currentPixelX, step.ty - this.currentPixelY, moveSpeed);
        } else {
            this.currentPath = null;
        }

        // --- CAST COMBAT SPELLS AND TRIGGER ATTACKS ---
        if (tacticalState === "RETREAT_TO_TOWER") {
            if (isPlayerAlive && playerDistance < 220) {
                if (this.abilityCooldowns['plasma_orb'] === undefined || this.abilityCooldowns['plasma_orb'] <= 0) {
                    this.castSpell('plasma_orb', this.player);
                }
                if (playerDistance < 130 && (this.abilityCooldowns['earth_wall'] === undefined || this.abilityCooldowns['earth_wall'] <= 0)) {
                    this.castSpell('earth_wall', this.player);
                }
            }
        } 
        else if (tacticalState === "BAITING_UNDER_TOWER") {
            if (isPlayerAlive && playerDistance < 320) {
                if (this.abilityCooldowns['plasma_orb'] === undefined || this.abilityCooldowns['plasma_orb'] <= 0) {
                    this.castSpell('plasma_orb', this.player);
                }
                if (playerDistance > 60 && playerDistance < 155 && (this.abilityCooldowns['dash_strike'] === undefined || this.abilityCooldowns['dash_strike'] <= 0)) {
                    this.castSpell('dash_strike', this.player);
                }
                if (playerDistance <= 45 && this.attackTimer <= 0) {
                    this.executeDirectMelee(this.player);
                }
            }
        } 
        else if (tacticalState === "AGGRESSIVE_ENGAGE") {
            if (isPlayerAlive) {
                if (playerDistance > 110 && playerDistance < 220 && (this.abilityCooldowns['slime_leap'] === undefined || this.abilityCooldowns['slime_leap'] <= 0)) {
                    this.castSpell('slime_leap', this.player);
                }
                else if (playerDistance > 60 && playerDistance < 150 && (this.abilityCooldowns['dash_strike'] === undefined || this.abilityCooldowns['dash_strike'] <= 0)) {
                    this.castSpell('dash_strike', this.player);
                }
                else if (playerDistance > 70 && playerDistance < 190 && (this.abilityCooldowns['plasma_orb'] === undefined || this.abilityCooldowns['plasma_orb'] <= 0)) {
                    this.castSpell('plasma_orb', this.player);
                }
                else if (playerDistance < 100 && (this.abilityCooldowns['blood_siphon'] === undefined || this.abilityCooldowns['blood_siphon'] <= 0)) {
                    this.castSpell('blood_siphon', this.player);
                }
                
                if (playerDistance <= 45 && this.attackTimer <= 0) {
                    this.executeDirectMelee(this.player);
                }
            }
        } 
        else if (tacticalState === "PUSH_LANE") {
            if (enemyCreeps.length > 0) {
                let closestBlueSlime = enemyCreeps[0];
                let minSlimeDist = Infinity;
                for (const slime of enemyCreeps) {
                    const sd = this.getDistanceTo(slime);
                    if (sd < minSlimeDist) {
                        minSlimeDist = sd;
                        closestBlueSlime = slime;
                    }
                }
                const distToSlime = minSlimeDist;
                
                if (distToSlime > 70 && distToSlime < 150 && (this.abilityCooldowns['dash_strike'] === undefined || this.abilityCooldowns['dash_strike'] <= 0)) {
                    this.castSpell('dash_strike', closestBlueSlime);
                } else if (distToSlime > 80 && distToSlime < 170 && (this.abilityCooldowns['plasma_orb'] === undefined || this.abilityCooldowns['plasma_orb'] <= 0)) {
                    this.castSpell('plasma_orb', closestBlueSlime);
                } else if (distToSlime < 90 && (this.abilityCooldowns['blood_siphon'] === undefined || this.abilityCooldowns['blood_siphon'] <= 0)) {
                    this.castSpell('blood_siphon', closestBlueSlime);
                }
                
                if (distToSlime <= 45 && this.attackTimer <= 0) {
                    this.executeDirectMelee(closestBlueSlime);
                }
            } else {
                // Sentry towers and active nexus elements should be aggressively targeted in PUSH_LANE state
                if (closestPlayerTower && distToPlayerTower < 250) {
                    if (distToPlayerTower > 70 && distToPlayerTower < 150 && (this.abilityCooldowns['dash_strike'] === undefined || this.abilityCooldowns['dash_strike'] <= 0)) {
                        this.castSpell('dash_strike', closestPlayerTower);
                    } else if (distToPlayerTower > 80 && distToPlayerTower < 170 && (this.abilityCooldowns['plasma_orb'] === undefined || this.abilityCooldowns['plasma_orb'] <= 0)) {
                        this.castSpell('plasma_orb', closestPlayerTower);
                    } else if (distToPlayerTower < 90 && (this.abilityCooldowns['blood_siphon'] === undefined || this.abilityCooldowns['blood_siphon'] <= 0)) {
                        this.castSpell('blood_siphon', closestPlayerTower);
                    }
                    
                    if (distToPlayerTower <= 55 && this.attackTimer <= 0) {
                        this.executeDirectMelee(closestPlayerTower);
                    }
                } else {
                    const doran = this.engine.gameObjects.find(obj => obj instanceof NPC && obj.name.toLowerCase().includes('doran'));
                    if (doran) {
                        const distToDoran = this.getDistanceTo(doran);
                        if (distToDoran < 250) {
                            if (distToDoran > 70 && distToDoran < 150 && (this.abilityCooldowns['dash_strike'] === undefined || this.abilityCooldowns['dash_strike'] <= 0)) {
                                this.castSpell('dash_strike', doran);
                            } else if (distToDoran > 80 && distToDoran < 170 && (this.abilityCooldowns['plasma_orb'] === undefined || this.abilityCooldowns['plasma_orb'] <= 0)) {
                                this.castSpell('plasma_orb', doran);
                            } else if (distToDoran < 90 && (this.abilityCooldowns['blood_siphon'] === undefined || this.abilityCooldowns['blood_siphon'] <= 0)) {
                                this.castSpell('blood_siphon', doran);
                            }
                            
                            if (distToDoran <= 55 && this.attackTimer <= 0) {
                                this.executeDirectMelee(doran);
                            }
                        }
                    }
                }
            }
        }
    }

    castSpell(abilityId, target) {
        if (this.activeAbility) return; // cannot cast multiple spells in startup/active recovery

        // Abilities match the hero 1 to 1: check if player has this ability equipped/unlocked!
        if (!this.hasAbilityEquipped(abilityId)) {
            return; // Cannot cast if the player does not have it equipped
        }

        // Enforce actual strict ability-range checks to prevent infinite range or spells failing to reach target
        const all = getAllAbilities();
        const abConfig = all[abilityId];
        if (abConfig) {
            const range = abConfig.range || 120;
            const dist = this.getDistanceTo(target);
            if (dist > range + 10) {
                return; // Target is out of this spell's designated range
            }
        }

        // TargetPosition callback resolving
        const getTargetPosFn = () => ({ x: target.currentPixelX, y: target.currentPixelY });
        
        // Execute dynamic action structure
        const result = executeAbility(this, abilityId, getTargetPosFn);
        if (result) {
            // Record hit landing check on psychology!
            this.psychology.onHitLanded();
        }
    }

    executeDirectMelee(target) {
        // Standard direct strike block
        this.attackTimer = this.stats.attackCooldown;
        if (typeof target.takeDamage === 'function') {
            const finalDmg = Math.round(this.stats.atk * 1.1);
            target.takeDamage(finalDmg, this);
            
            // Splash feedback
            this.engine.addEffect(new ParticleSplatterEffect(this.engine, {
                position: { x: target.currentPixelX, y: target.currentPixelY },
                color: '#e74c3c',
                count: 6,
                duration: 0.35
            }));

            this.psychology.onHitLanded();
        }
    }

    // --- HTML RIVAL PSYCHOLOGY OVERLAY HUD ---
    showRivalHUD() {
        if (this.stats.hp <= 0) {
            this.hideRivalHUD();
            return;
        }

        const isCollapsed = this.engine && this.engine.rivalHudCollapsed;
        if (isCollapsed) {
            this.hideRivalHUD();
            return;
        }

        let hud = document.getElementById('rival-psychology-hud');

        if (!hud) {
            hud = document.createElement('div');
            hud.id = 'rival-psychology-hud';
            
            // Apply brutalist pure styles directly (bypassing tailwind)
            hud.style.position = 'absolute';
            hud.style.top = '65px'; // Below the top-right button
            hud.style.right = '15px';
            hud.style.width = '240px';
            hud.style.background = '#3B322C';
            hud.style.border = '3px solid #8C6D56';
            hud.style.padding = '12px';
            hud.style.color = '#EFEBE0';
            hud.style.fontFamily = 'monospace';
            hud.style.fontSize = '12px';
            hud.style.boxShadow = '6px 6px 0px rgba(0,0,0,0.5)';
            hud.style.zIndex = '100';

            const container = document.getElementById('rpg-canvas-container');
            if (container) {
                container.appendChild(hud);
            }
        } else {
            hud.style.display = 'block';
        }

        // Render custom design matching image 2 exactly
        hud.innerHTML = `
            <div style="font-weight: bold; font-size: 1.1em; color: #ffbe76; text-transform: uppercase; border-bottom: 2px solid #8C6D56; padding-bottom: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                <span style="display: flex; align-items: center; gap: 4px;">⚔️ RIVAL MINDSET</span>
                <span id="rival-hud-name" style="color: #efebe0; font-size: 0.9em;">CHAMPION</span>
            </div>
            
            <div id="rival-hud-collapsible-part">
                <div style="font-weight: bold; margin-bottom: 12px; background: #221812; padding: 6px 8px; border-left: 3px solid #f1c40f; font-size:0.95em; line-height: 1.4em;">
                    MIND: <span id="rival-hud-mindset" style="color: #f1c40f;">Balanced</span>
                </div>

                <div style="margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.8em; color: #aaa; margin-bottom: 2px;">
                        <span>🛡️ PHYSICAL</span>
                        <span>⚡ MENTAL</span>
                    </div>
                    <div style="height: 12px; background: #2c2520; border: 1px solid #555; position: relative; overflow: hidden;">
                        <div id="rival-bar-pm" style="width: 50%; height: 100%; background: #fc5c65; transition: width 0.15s ease;"></div>
                        <div style="position: absolute; width: 2px; height: 100%; left: 50%; top: 0; background: #fff;"></div>
                    </div>
                </div>

                <div style="margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.8em; color: #aaa; margin-bottom: 2px;">
                        <span>🛡️ DEFENSIVE</span>
                        <span>💥 OFFENSIVE</span>
                    </div>
                    <div style="height: 12px; background: #2c2520; border: 1px solid #555; position: relative; overflow: hidden;">
                        <div id="rival-bar-do" style="width: 50%; height: 100%; background: #fd9644; transition: width 0.15s ease;"></div>
                        <div style="position: absolute; width: 2px; height: 100%; left: 50%; top: 0; background: #fff;"></div>
                    </div>
                </div>

                <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.8em; color: #aaa; margin-bottom: 2px;">
                        <span>🍃 CAUTIOUS</span>
                        <span>🔥 RECKLESS</span>
                    </div>
                    <div style="height: 12px; background: #2c2520; border: 1px solid #555; position: relative; overflow: hidden;">
                        <div id="rival-bar-cr" style="width: 50%; height: 100%; background: #26de81; transition: width 0.15s ease;"></div>
                        <div style="position: absolute; width: 2px; height: 100%; left: 50%; top: 0; background: #fff;"></div>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 0.85em; background: #221812; padding: 6px; border: 1px dashed #666;">
                    <span>HP: <strong id="rival-hud-hp" style="color: #efebe0;">200/200</strong></span>
                    <span>LEVEL: <strong id="rival-hud-lvl" style="color: #efebe0;">5</strong></span>
                </div>
            </div>
        `;
    }

    syncRivalHUD() {
        const hud = document.getElementById('rival-psychology-hud');
        if (!hud || this.stats.hp <= 0) return;

        // Sync values
        const spanName = document.getElementById('rival-hud-name');
        const spanMind = document.getElementById('rival-hud-mindset');
        const barPM = document.getElementById('rival-bar-pm');
        const barDO = document.getElementById('rival-bar-do');
        const barCR = document.getElementById('rival-bar-cr');
        const textHP = document.getElementById('rival-hud-hp');
        const textLvl = document.getElementById('rival-hud-lvl');

        if (spanName) spanName.textContent = this.name;
        if (spanMind) {
            const tact = this.currentTacticalState || "PUSH_LANE";
            spanMind.textContent = `${tact} (${this.psychology.lastStateLabel})`;
        }
        
        if (barPM) barPM.style.width = `${this.psychology.physicalVsMental}%`;
        if (barDO) barDO.style.width = `${this.psychology.defensiveVsOffensive}%`;
        if (barCR) barCR.style.width = `${this.psychology.cautiousVsReckless}%`;

        if (textHP) textHP.textContent = `${this.stats.hp}/${this.stats.maxHp}`;
        if (textLvl) textLvl.textContent = `${this.stats.level}`;
    }

    hideRivalHUD() {
        const hud = document.getElementById('rival-psychology-hud');
        if (hud) {
            hud.style.display = 'none';
        }
    }
}
