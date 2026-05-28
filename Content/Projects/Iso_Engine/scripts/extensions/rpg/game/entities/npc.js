// NPC (Non-Player Character) Logic
import GameObject from './gameObject.js';

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
    }

    loadCharacterData(data) {
        this.characterData = data;
        if (data && data.name) {
            this.name = data.name;
        }
        console.log(`NPC ${this.name} character data loaded.`);
    }

    onInteract(mapContext) {
        console.log(`Interacted with ${this.name}.`);
        if (this.characterData) {
            console.log("Character Data:", this.characterData);
            // Trigger the proper dialogue UI via the engine, passing map context
            this.engine.dialogueUI.showDialogue(this, mapContext);
        } else {
            console.log("No character data available for this NPC.");
            alert(`You see a person named ${this.name}, but they don't seem to have much to say.`);
        }
    }

    async reactToConversation(latestMessage, primaryNpc, history) {
        if (this.isReacting || !this.characterData) return null;

        // The random chance to react is now handled by the dialogue UI.
        
        this.isReacting = true;

        try {
            const { name, description, personality } = this.characterData;
            const promptParts = [];

            promptParts.push(`[System: This is a roleplaying scenario. You are ${name}. Your personality is: ${personality}. Your description is: ${description}.]`);
            promptParts.push(`You are standing nearby and you overhear a conversation between 'Player' and '${primaryNpc.characterData.name}'.`);
            
            if (history && history.length > 1) {
                promptParts.push('Here is the recent context of their conversation:');
                // All but the last message, which is the "latestMessage"
                history.slice(0, -1).forEach(msg => {
                    promptParts.push(`${msg.speaker}: "${msg.text}"`);
                });
            }

            promptParts.push(`You just heard this most recent line:\n${latestMessage.speaker}: "${latestMessage.text}"`);
            promptParts.push(`Based on your personality and the context, you decide to interject with a single, short sentence. Your response must be concise and in character. It must be only what you would say out loud. Do not describe your actions. If you have nothing relevant to say, return an empty response.`);
            promptParts.push('***');
            promptParts.push(`${name}:`);
            
            const prompt = promptParts.join('\n');

            // Use a shorter max length for interjections
            const interjection = await this.engine.aiAdapter.fetchAIResponse(prompt, null, 50);

            if (interjection && interjection.trim().length > 0) {
                // Return the cleaned text. The DialogueUI will handle showing it and adding it to history.
                return interjection.trim().replace(/^"|"$/g, '');
            }

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
        // Call parent render to draw the sprite itself
        super.render(ctx, viewOriginX, viewOriginY);

        // Then, draw the name tag on top
        const drawX = this.currentPixelX - viewOriginX;
        const drawY = this.currentPixelY - viewOriginY;

        ctx.fillStyle = '#EFEBE0'; // Light cream color for text
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        
        // Position the name tag above the visual sprite.
        ctx.fillText(this.name, drawX, drawY - this.visualHeight - 5);
    }
}

export default NPC;