// Enemy Psychology System for Tactical/Rival Bosses
import { FloatingTextEffect, ParticleSplatterEffect } from './effects.js';

export class EnemyPsychology {
    constructor(enemy) {
        this.enemy = enemy;

        // Base states (0 = Left Side, 100 = Right Side)
        // 1. Physical (0) vs Mental (100)
        this.physicalVsMental = 50; 
        
        // 2. Defensive (0) vs Offensive (100)
        this.defensiveVsOffensive = 50; 
        
        // 3. Cautious (0) vs Reckless (100)
        this.cautiousVsReckless = 50;

        // Dynamic State Tracking
        this.confidence = 50; // 0 (Panic/Flee) to 100 (Supreme Focus)
        this.cleanseTimer = 0; // Tick-down for mental reset
        this.CLEANSE_COOLDOWN = 5.0; // 5 seconds of calm/no engagement triggers cleanse

        this.lastStateLabel = "Balanced";
    }

    onHitLanded() {
        // Landing hit increases Offensive, Reckless and overall Confidence
        this.defensiveVsOffensive = Math.min(100, this.defensiveVsOffensive + 15);
        this.cautiousVsReckless = Math.min(100, this.cautiousVsReckless + 10);
        this.confidence = Math.min(100, this.confidence + 12);
        
        // Reset the calm cleanse timer when active fighting occurs
        this.cleanseTimer = 0;
    }

    onHitTaken(amount) {
        // Taking hits increases Defensive, Cautious and lowers Confidence
        this.defensiveVsOffensive = Math.max(0, this.defensiveVsOffensive - 18);
        this.cautiousVsReckless = Math.max(0, this.cautiousVsReckless - 12);
        this.confidence = Math.max(0, this.confidence - 15);
        
        // Dynamic shifting between Physical and Mental focus on response
        if (Math.random() > 0.5) {
            // Focus on Mental defenses/special escapes
            this.physicalVsMental = Math.min(100, this.physicalVsMental + 8);
        } else {
            // Focus on physical rush/stamina counter
            this.physicalVsMental = Math.max(0, this.physicalVsMental - 8);
        }

        this.cleanseTimer = 0;
    }

    update(deltaTime) {
        // Slowly drift extreme sliders back towards balanced (50) to avoid getting perma-stuck
        const driftSpeed = 1.8; // slider units per second
        
        if (this.physicalVsMental > 50) this.physicalVsMental = Math.max(50, this.physicalVsMental - driftSpeed * deltaTime);
        if (this.physicalVsMental < 50) this.physicalVsMental = Math.min(50, this.physicalVsMental + driftSpeed * deltaTime);

        if (this.defensiveVsOffensive > 50) this.defensiveVsOffensive = Math.max(50, this.defensiveVsOffensive - driftSpeed * deltaTime);
        if (this.defensiveVsOffensive < 50) this.defensiveVsOffensive = Math.min(50, this.defensiveVsOffensive + driftSpeed * deltaTime);

        if (this.cautiousVsReckless > 50) this.cautiousVsReckless = Math.max(50, this.cautiousVsReckless - driftSpeed * deltaTime);
        if (this.cautiousVsReckless < 50) this.cautiousVsReckless = Math.min(50, this.cautiousVsReckless + driftSpeed * deltaTime);

        // Standard decay for general confidence
        if (this.confidence > 50) this.confidence = Math.max(50, this.confidence - 1.0 * deltaTime);
        if (this.confidence < 50) this.confidence = Math.min(50, this.confidence + 1.2 * deltaTime);

        // Check if confidence is lost / highly defensive & cautious (fleeing state)
        const isPanicking = (this.defensiveVsOffensive < 25 && this.cautiousVsReckless < 25);
        
        if (isPanicking) {
            this.cleanseTimer += deltaTime;
            if (this.cleanseTimer >= this.CLEANSE_COOLDOWN) {
                this.performMentalCleanse();
            }
        } else {
            this.cleanseTimer = Math.max(0, this.cleanseTimer - deltaTime * 0.5);
        }

        // Return state label for HUD
        this.updateMindsetLabel();
    }

    performMentalCleanse() {
        this.cleanseTimer = 0;
        
        // Reset and empower the rival!
        this.defensiveVsOffensive = 70; // highly motivated offense
        this.physicalVsMental = 50; 
        this.cautiousVsReckless = 65; // confident reckless action
        this.confidence = 85; 

        // Visual effects
        const engine = this.enemy.engine;
        if (engine) {
            engine.addEffect(new FloatingTextEffect(engine, {
                text: "✨ DETERMINATION Reset! ✨",
                position: { x: this.enemy.currentPixelX, y: this.enemy.currentPixelY - 45 },
                color: '#f1c40f' // Gold text
            }));

            // Golden sparks splurge
            engine.addEffect(new ParticleSplatterEffect(engine, {
                position: { x: this.enemy.currentPixelX, y: this.enemy.currentPixelY },
                color: '#f1c40f',
                count: 18,
                duration: 0.6
            }));

            // Mini heals as rebound
            if (this.enemy.stats && this.enemy.stats.hp > 0) {
                const healAmt = Math.round(this.enemy.stats.maxHp * 0.15); // Heals 15% max hp on mental reset!
                this.enemy.stats.hp = Math.min(this.enemy.stats.maxHp, this.enemy.stats.hp + healAmt);
                engine.addEffect(new FloatingTextEffect(engine, {
                    text: `+${healAmt} HP (Rebound)`,
                    position: { x: this.enemy.currentPixelX, y: this.enemy.currentPixelY - 25 },
                    color: '#2ecc71'
                }));
            }
        }
    }

    updateMindsetLabel() {
        if (this.defensiveVsOffensive < 25 && this.cautiousVsReckless < 25) {
            this.lastStateLabel = "Fleeing & Terrified";
        } else if (this.defensiveVsOffensive > 70 && this.cautiousVsReckless > 70) {
            this.lastStateLabel = "Reckless Assault";
        } else if (this.defensiveVsOffensive < 30) {
            this.lastStateLabel = "Defensive Baiting";
        } else if (this.physicalVsMental > 65) {
            this.lastStateLabel = "Mental Zoning";
        } else if (this.physicalVsMental < 35) {
            this.lastStateLabel = "Physical Rushdown";
        } else {
            this.lastStateLabel = "Tactical Balancing";
        }
    }

    // Apply modifiers to stats based on sliders
    getStatModifier(statKey) {
        switch (statKey) {
            case 'atk_mult':
                // Higher offensive increases damage. (up to +50%)
                // Offensive slider is 0 to 100. (50 is neutral 1.0)
                const offRatio = (this.defensiveVsOffensive - 50) / 50; // -1 to +1
                return 1.0 + (offRatio > 0 ? offRatio * 0.5 : offRatio * 0.1); 

            case 'def_mult':
                // Lower offensive (defensive) increases defense (up to +100%)
                const defRatio = (50 - this.defensiveVsOffensive) / 50; // -1 to +1
                return 1.0 + (defRatio > 0 ? defRatio * 1.0 : defRatio * 0.3); // decreases defence if highly offensive

            case 'speed_mult':
                // High Physical improves rushing / moving speed
                const phyRatio = (50 - this.physicalVsMental) / 50; // -1 (mental) to +1 (physical)
                return 1.0 + (phyRatio > 0 ? phyRatio * 0.25 : phyRatio * 0.1);

            case 'cooldown_mult':
                // High Mental improves agility and strategy, making cooldowns up to 50% shorter
                const menRatio = (this.physicalVsMental - 50) / 50; // -1 (physical) to +1 (mental)
                return menRatio > 0 ? Math.max(0.5, 1.0 - menRatio * 0.45) : 1.0;

            default:
                return 1.0;
        }
    }
}
