// NPC (Non-Player Character) Logic
import GameObject from './gameObject.js';
import { FloatingTextEffect } from '../combat/effects.js';
import { Emitter } from '../combat/projectiles.js';

const NPC_COLLISION_WIDTH = 20;
const NPC_COLLISION_HEIGHT = 10;

class NPC extends GameObject {
    constructor(engine, map, mapX, mapY, options = {}) {
        const defaultOptions = {
            collidable: true,
            collisionShape: {
                type: 'rectangle',
                width: NPC_COLLISION_WIDTH,
                height: NPC_COLLISION_HEIGHT,
            },
            visualWidth: 64,
            visualHeight: 64,
            anchorOffsetX: 32,
            anchorOffsetY: 64, // Assumes feet are at the bottom of the 64x64 sprite
        };

        const npcOptions = { ...defaultOptions, ...options };

        super(engine, map, mapX, mapY, npcOptions);

        this.name = options.name || "Stranger";
        this.characterData = null;
        this.hearingRadius = 250; // pixels
        this.isReacting = false; // Flag to prevent reacting multiple times at once
        this.isHit = false;
        this.hitFlashTimer = 0;
        this.emitter = null;
    }

    update(deltaTime) {
        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer -= deltaTime;
            if (this.hitFlashTimer <= 0) {
                this.isHit = false;
            }
        }
        if (this.emitter) {
            this.emitter.update(deltaTime);
        }
    }

    takeDamage(amount, attacker = null) {
        if (!this.stats) {
            this.stats = { level: 1, hp: 50, maxHp: 50, atk: 10, def: 5, speed: 120 };
        }
        
        const isDoran = this.name.toLowerCase().includes('doran') || this.name.toLowerCase().includes('shopkeeper');
        if (isDoran && this.stats.hp === 50 && this.stats.maxHp === 50) {
            this.stats.hp = 350;
            this.stats.maxHp = 350;
            this.stats.def = 8;
        }

        const damage = Math.max(1, amount - (this.stats.def || 0));
        this.stats.hp = Math.max(0, this.stats.hp - damage);
        console.log(`NPC ${this.name} took ${damage} damage. HP: ${this.stats.hp}/${this.stats.maxHp}`);

        this.isHit = true;
        this.hitFlashTimer = 0.15;

        // Floating Damage text
        if (this.engine) {
            this.engine.addEffect(new FloatingTextEffect(this.engine, {
                text: damage.toFixed(0),
                position: { x: this.currentPixelX, y: this.currentPixelY - this.visualHeight },
                color: '#e74c3c'
            }));
        }

        if (this.stats.hp <= 0) {
            this.die();
        }
    }

    die() {
        console.log(`NPC ${this.name} has been defeated.`);

        // Handle turret transition into searchable chest wreckage
        if (this.broadType === 'turret') {
            const emitterConfig = this.characterData?.emitterConfig || {};
            const presetId = emitterConfig.presetId || 'spark_bullet';
            const emitterName = this.characterData?.name || 'Turret';
            
            // Turn off shooting
            this.emitter = null;
            this.broadType = 'chest';
            this.name = `Wreckage of ${emitterName}`;
            
            // Re-inflate stats so we can interact with it as a chest
            this.stats.hp = 999;
            this.stats.maxHp = 999;
            
            // Setup items list to contain the custom lootable emitter core!
            const baseSlug = presetId;
            const abilitySlug = `bullet_hell_${baseSlug}`;
            const itemSlug = `loot_core_${baseSlug}`;
            
            this.inventory = [{
                id: itemSlug,
                name: `Core: ${emitterName} Emitter`,
                type: 'ability',
                attachedAbility: abilitySlug,
                count: 1,
                cost: 150,
                description: `Deactivated Core of the defeated ${emitterName}. Equip to Slot 1-4 to discharge its custom emitter!`,
                symbol: '☄️',
                equipped: false
            }];
            
            // Spawn an epic visual shatter and notice text!
            if (this.engine) {
                const FloatingTextEffectClass = FloatingTextEffect || null;
                if (FloatingTextEffectClass) {
                    this.engine.addEffect(new FloatingTextEffectClass(this.engine, {
                        text: `TURRET DEACTIVATED! SEARCH CORE!`,
                        position: { x: this.currentPixelX, y: this.currentPixelY - 40 },
                        color: '#e67e22'
                    }));
                }
                
                if (typeof ParticleSplatterEffect !== 'undefined') {
                    this.engine.addEffect(new ParticleSplatterEffect(this.engine, {
                        position: { x: this.currentPixelX, y: this.currentPixelY },
                        color: '#f39c12',
                        count: 18,
                        duration: 0.8
                    }));
                }
            }
            return;
        }

        const nameLower = this.name.toLowerCase();
        if (nameLower.includes('doran') || nameLower.includes('shopkeeper')) {
            CustomDialog.alert("GAME OVER! Shopkeeper Doran has been defeated!", "Game Over").then(() => {
                window.location.reload();
            });
        } else if (nameLower.includes('scruffy')) {
            CustomDialog.alert("🏆 VICTORY! Merchant Scruffy has been defeated! You have conquered the bridge! GG WP!", "Conquered!").then(() => {
                window.location.reload();
            });
        }
    }

    loadCharacterData(data) {
        this.characterData = data;
        if (data) {
            if (data.name) {
                this.name = data.name;
            }
            this.broadType = data.broadType || 'villager';
            const isDoran = this.name.toLowerCase().includes('doran') || this.name.toLowerCase().includes('shopkeeper');
            if (data.stats) {
                this.stats = { ...data.stats };
            } else {
                this.stats = { 
                    level: 1, 
                    hp: isDoran ? 350 : 50, 
                    maxHp: isDoran ? 350 : 50, 
                    atk: 10, 
                    def: isDoran ? 8 : 5, 
                    speed: 120 
                };
            }
            if (Array.isArray(data.inventory)) {
                this.inventory = JSON.parse(JSON.stringify(data.inventory));
            }
            if (this.broadType === 'turret' || data.emitterConfig) {
                const config = data.emitterConfig || {};
                this.emitter = new Emitter(this.engine, this, config);
            }
        }
        console.log(`NPC ${this.name} character data loaded with role: ${this.broadType || 'villager'}`);
    }

    onInteract(mapContext) {
        console.log(`Interacted with ${this.name}.`);
        if (this.characterData) {
            console.log("Character Data:", this.characterData);
            // Trigger the proper dialogue UI via the engine, passing map context
            this.engine.dialogueUI.showDialogue(this, mapContext);
        } else {
            console.log("No character data available for this NPC.");
            CustomDialog.alert(`You see a person named ${this.name}, but they don't seem to have much to say.`, "Mute NPC");
        }
    }

    async reactToConversation(latestMessage, primaryNpc, history) {
        if (this.isReacting || !this.characterData) return null;

        this.isReacting = true;

        try {
            const { name, personality } = this.characterData;
            
            // Standard offline RPG interjections based on personality
            const interjections = [
                "Hmm, that makes sense.",
                "Wait, is that true?",
                "Fascinating...",
                "I see what you mean.",
                "Let's focus on our quest first.",
                "Indeed! The road ahead is long.",
                "I agree with that.",
                "Don't let your guard down is all I'm saying."
            ];
            
            const choice = interjections[Math.floor(Math.random() * interjections.length)];
            return choice;

        } catch (error) {
            console.error(`Error during NPC reaction for ${this.name}:`, error);
        } finally {
            // Add a cooldown before this NPC can react again
            setTimeout(() => {
                this.isReacting = false;
            }, 10000); // 10 second cooldown
        }

        return null; // Return null if no valid interjection was generated.
    }

    render(ctx, viewOriginX, viewOriginY) {
        // Render Range circle first so it layer-draws underneath the NPC sprite!
        if (this.emitter) {
            this.emitter.renderRangeArea(ctx, viewOriginX, viewOriginY);
        }

        // Call parent render to draw the sprite itself
        super.render(ctx, viewOriginX, viewOriginY);

        const drawX = this.currentPixelX - viewOriginX;
        const drawY = this.currentPixelY - viewOriginY;

        // --- Render Hit Flash ---
        if (this.isHit) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.8 * (this.hitFlashTimer / 0.15); // Fade the flash out
            
            const anchorCanvasX = this.currentPixelX - viewOriginX;
            const anchorCanvasY = this.currentPixelY - viewOriginY;
        
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
            } else if (this.sprite) {
                ctx.drawImage(
                    this.sprite,
                    spriteDrawX, spriteDrawY,
                    this.visualWidth, this.visualHeight
                );
            }
            ctx.restore();
        }

        // Then, draw the name tag on top
        const isDoran = this.name.toLowerCase().includes('doran') || this.name.toLowerCase().includes('shopkeeper');
        const isScruffy = this.name.toLowerCase().includes('scruffy');
        ctx.fillStyle = isScruffy ? '#e74c3c' : (isDoran ? '#3498db' : '#EFEBE0');
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        
        // Position the name tag above the visual sprite.
        ctx.fillText(this.name, drawX, drawY - this.visualHeight - 5);

        // Render health bar if damaged or if they are one of the core shopkeeper objectives
        if (this.stats && this.stats.hp !== undefined && (this.stats.hp < this.stats.maxHp || isDoran || isScruffy)) {
            const barWidth = 40;
            const barHeight = 5;
            const barY = drawY - this.visualHeight - 20;
            const barX = drawX - barWidth / 2;
            
            // Background
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
            
            // Health
            const hpRatio = Math.max(0, this.stats.hp / this.stats.maxHp);
            ctx.fillStyle = isScruffy ? '#e74c3c' : '#3498db'; // Royal Blue for Doran/Allies, Crimson Red for Scruffy
            ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
        }
    }
}

export default NPC;