// UI Logic for NPC Dialogues
import * as aiAdapter from '../ai/novelai_adapter.js';
import NPC from '../entities/npc.js';

class DialogueUI {
    constructor(engine) {
        this.engine = engine;
        this.isVisible = false;
        this.participants = []; // Array of NPCs in the chat
        this.participantData = []; // Array of {npc, imageEl, mainAvatarUrl}
        this.nextSpeakerIndex = 0; // For group chat turn-taking
        this.chatMode = 'public'; // 'public' or 'private'
        this.mapContext = null;
        this.domElement = this._createDom();
        // Append to the main modal overlay instead of the content area
        // to ensure it correctly overlays all content, including the canvas.
                this.engine.modalContentElement.appendChild(this.domElement);
        this.aiErrorMessageCount = 0; // Track consecutive AI errors
        this.MAX_AI_ERROR_RETRIES = 3; // Maximum number of retry attempts
    }

    _createDom() {
        const overlay = document.createElement('div');
        overlay.id = 'rpg-dialogue-overlay';
        overlay.style.display = 'none';

        // Character Image
        const charImage = document.createElement('img');
        charImage.id = 'rpg-dialogue-character-image';

        // NEW: Right-side Character Image
        const charImageRight = document.createElement('img');
        charImageRight.id = 'rpg-dialogue-character-image-right';

        // Dialogue Box
        const dialogueBox = document.createElement('div');
        dialogueBox.id = 'rpg-dialogue-box';

        // === Main content wrapper ===
        const mainContent = document.createElement('div');
        mainContent.id = 'rpg-dialogue-main-content';

        const nameTag = document.createElement('div');
        nameTag.id = 'rpg-dialogue-name-tag';
        
        const messagesArea = document.createElement('div');
        messagesArea.id = 'rpg-dialogue-messages';

        const inputArea = document.createElement('div');
        inputArea.id = 'rpg-dialogue-input-area';
        const inputField = document.createElement('textarea');
        inputField.id = 'rpg-dialogue-input';
        inputField.placeholder = 'Say something...';
        inputField.rows = 1;
        inputField.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this._handleSend();
            }
        };
        const sendButton = document.createElement('button');
        sendButton.id = 'rpg-dialogue-send';
        sendButton.textContent = 'Send';
        sendButton.onclick = () => this._handleSend();
        inputArea.appendChild(inputField);
        inputArea.appendChild(sendButton);

        mainContent.appendChild(nameTag);
        mainContent.appendChild(messagesArea);
        mainContent.appendChild(inputArea);

        // === Controls Panel ===
        const controlsPanel = document.createElement('div');
        controlsPanel.id = 'rpg-dialogue-controls';

        const controlsHeader = document.createElement('h4');
        controlsHeader.textContent = 'Actions';

        const toggleModeButton = document.createElement('button');
        toggleModeButton.id = 'rpg-dialogue-toggle-mode';
        toggleModeButton.textContent = 'Mode: Public';
        toggleModeButton.onclick = () => this._handleToggleMode();

        const clearHistoryButton = document.createElement('button');
        clearHistoryButton.id = 'rpg-dialogue-clear-history';
        clearHistoryButton.textContent = 'Clear History';
        clearHistoryButton.onclick = () => this._handleClearHistory();
        
        controlsPanel.appendChild(controlsHeader);
        controlsPanel.appendChild(toggleModeButton);
        controlsPanel.appendChild(clearHistoryButton);

        dialogueBox.appendChild(mainContent);
        dialogueBox.appendChild(controlsPanel);

        // === Close Button ===
        const closeButton = document.createElement('button');
        closeButton.id = 'rpg-dialogue-close';
        closeButton.innerHTML = '&times';
        closeButton.onclick = () => this.hideDialogue();
        mainContent.appendChild(closeButton);

        // === Other overlay elements ===
        overlay.appendChild(charImage);
        overlay.appendChild(charImageRight);
        overlay.appendChild(dialogueBox);

        const interjectionsContainer = document.createElement('div');
        interjectionsContainer.id = 'rpg-dialogue-interjections-container';
        overlay.appendChild(interjectionsContainer);

        return overlay;
    }

    showDialogue(npc, mapContext) {
        if (!npc || !npc.characterData) {
            console.error("DialogueUI: Cannot show dialogue for NPC without character data.");
            return;
        }
        
        // --- Reset for new conversation ---
        this.participants = [npc];
        this.nextSpeakerIndex = 0;
        this.mapContext = mapContext || null;

        // Reset chat mode to public whenever a new dialogue is opened
        this.chatMode = 'public';
        const toggleButton = this.domElement.querySelector('#rpg-dialogue-toggle-mode');
        toggleButton.textContent = 'Mode: Public';
        const dialogueBox = this.domElement.querySelector('#rpg-dialogue-box');
        dialogueBox.classList.add('public-chat');
        dialogueBox.classList.remove('private-chat');

        const charImageLeft = this.domElement.querySelector('#rpg-dialogue-character-image');
        const charImageRight = this.domElement.querySelector('#rpg-dialogue-character-image-right');
        charImageRight.style.display = 'none'; // Hide right image for new 1-on-1 chats

        // Setup participant data
        this.participantData = [{
            npc: npc,
            imageEl: charImageLeft,
            mainAvatarUrl: (npc.characterData.dialogue_avatars && npc.characterData.dialogue_avatars.main) ? npc.characterData.dialogue_avatars.main : (npc.characterData.avatarUrl || '/scripts/extensions/rpg/game/assets/character_dialogue_image.png')
        }];
        charImageLeft.src = this.participantData[0].mainAvatarUrl;

        const { name, first_mes } = npc.characterData;
        const mapHistory = this.engine.map.chatHistory;

        // Populate Name Tag
        this.domElement.querySelector('#rpg-dialogue-name-tag').textContent = name;
        
        // Reset and show initial message
        const messagesArea = this.domElement.querySelector('#rpg-dialogue-messages');
        messagesArea.innerHTML = '';
        
        // If this NPC hasn't spoken yet on this map, add their greeting.
        const hasNpcSpoken = mapHistory.some(msg => msg.speaker === name);
        if (!hasNpcSpoken) {
            const greeting = first_mes || "Hello there.";
            mapHistory.push({ speaker: name, text: greeting });
        }

        // Render all messages from the map's persistent history
        mapHistory.forEach(msg => {
            this._appendMessage(msg.text, msg.speaker, msg.speaker === 'Player');
        });

        this.domElement.style.display = 'block';
        this.isVisible = true;
    }

    hideDialogue() {
        this.domElement.style.display = 'none';
        this.isVisible = false;
        this.participants = [];
        this.participantData = [];
        this.mapContext = null;
        this.domElement.querySelector('#rpg-dialogue-input').value = '';
    }

    async _inviteToGroupChat(npc) {
        if (this.participants.length >= 2) {
            this._appendSystemMessage(`${npc.name} tries to join, but the conversation is full.`);
            return;
        }
        if (this.participants.find(p => p.id === npc.id)) {
            // Already in chat, do nothing
            return;
        }

        this.participants.push(npc);
        
        const charImageRight = this.domElement.querySelector('#rpg-dialogue-character-image-right');
        const mainAvatarUrl = (npc.characterData.dialogue_avatars && npc.characterData.dialogue_avatars.main) ? npc.characterData.dialogue_avatars.main : (npc.characterData.avatarUrl || '/scripts/extensions/rpg/game/assets/character_dialogue_image.png');
        
        this.participantData.push({
            npc: npc,
            imageEl: charImageRight,
            mainAvatarUrl: mainAvatarUrl
        });

        charImageRight.src = mainAvatarUrl;
        charImageRight.style.display = 'block';

        this._appendSystemMessage(`${npc.name} has joined the conversation.`);

        // Update the main name tag to reflect a group chat
        const nameTag = this.domElement.querySelector('#rpg-dialogue-name-tag');
        nameTag.textContent = this.participants.map(p => p.name).join(' & ');
    }

    _appendSystemMessage(text) {
        const messagesArea = this.domElement.querySelector('#rpg-dialogue-messages');
        const messageEntry = document.createElement('div');
        messageEntry.classList.add('rpg-dialogue-entry', 'system-entry');
        
        const messageText = document.createElement('span');
        messageText.textContent = text;
        
        messageEntry.appendChild(messageText);
        messagesArea.appendChild(messageEntry);
        messagesArea.scrollTop = messagesArea.scrollHeight;
    }

    showInterjection(reactingNpc, text) {
        const container = this.domElement.querySelector('#rpg-dialogue-interjections-container');
        if (!container) return;

        const interjectionElement = document.createElement('div');
        interjectionElement.className = 'rpg-dialogue-interjection';
        interjectionElement.title = `Click to invite ${reactingNpc.name} to the conversation.`;
        interjectionElement.onclick = () => this._inviteToGroupChat(reactingNpc);

        const avatar = document.createElement('img');
        const { avatarUrl, dialogue_avatars } = reactingNpc.characterData;
        const interjectionAvatarUrl = (dialogue_avatars && dialogue_avatars.main) ? dialogue_avatars.main : (avatarUrl || '/scripts/extensions/rpg/game/assets/character_dialogue_image.png');
        avatar.src = interjectionAvatarUrl;

        const bubble = document.createElement('div');
        bubble.className = 'rpg-dialogue-interjection-bubble';

        const nameTag = document.createElement('strong');
        nameTag.textContent = reactingNpc.name;

        const textSpan = document.createElement('span');
        textSpan.textContent = text;

        bubble.appendChild(nameTag);
        bubble.appendChild(textSpan);

        interjectionElement.appendChild(avatar);
        interjectionElement.appendChild(bubble);

        container.appendChild(interjectionElement);

        // Animate in
        requestAnimationFrame(() => {
            interjectionElement.classList.add('show');
        });

        // Animate out and remove after a delay
        setTimeout(() => {
            interjectionElement.classList.remove('show');
            setTimeout(() => {
                if (container.contains(interjectionElement)) {
                    container.removeChild(interjectionElement);
                }
            }, 500); // Matches animation duration
        }, 7000); // Show for 7 seconds
    }

    _appendMessage(text, sender, isUser = false) {
        const messagesArea = this.domElement.querySelector('#rpg-dialogue-messages');
        const messageEntry = document.createElement('div');
        messageEntry.classList.add('rpg-dialogue-entry');
        if (isUser) {
            messageEntry.classList.add('user-entry');
        } else {
            messageEntry.classList.add('npc-entry');
        }

        const senderTag = document.createElement('strong');
        senderTag.textContent = `${sender}: `;
        
        const messageText = document.createElement('span');
        messageText.textContent = text;
        
        messageEntry.appendChild(senderTag);
        messageEntry.appendChild(messageText);
        messagesArea.appendChild(messageEntry);

        messagesArea.scrollTop = messagesArea.scrollHeight; // Auto-scroll
        return messageEntry; // Return the whole entry for streaming
    }

    _updateAvatar(text, npc) {
        const participant = this.participantData.find(p => p.npc.id === npc.id);
        if (!participant || !participant.npc.characterData || !participant.npc.characterData.dialogue_avatars) {
            return;
        }

        const reactiveAvatars = participant.npc.characterData.dialogue_avatars.reactive || [];
        if (reactiveAvatars.length === 0) {
            return;
        }

        const charImage = participant.imageEl;
        let newAvatarSet = false;
        const lowerCaseText = text.toLowerCase();

        // Find the last matching keyword in the text to prioritize it
        let lastMatch = null;
        for (const avatarInfo of reactiveAvatars) {
            if (avatarInfo.keyword) { // The keyword string can be "happy,joy,smile"
                const keywords = avatarInfo.keyword.split(',').map(k => k.trim().toLowerCase());
                for (const keyword of keywords) {
                    if (keyword && lowerCaseText.includes(keyword)) {
                        lastMatch = avatarInfo; // This rule matches
                        break; // No need to check other keywords in the same comma-separated list
                    }
                }
            }
        }

        if (lastMatch) {
            if (charImage.src !== lastMatch.dataUrl) {
                charImage.src = lastMatch.dataUrl;
            }
            newAvatarSet = true;
        }

        // If no keyword matched, or if text is empty, revert to the main avatar
        if (!newAvatarSet && charImage.src !== participant.mainAvatarUrl) {
            charImage.src = participant.mainAvatarUrl;
        }
    }

    _handleToggleMode() {
        const toggleButton = this.domElement.querySelector('#rpg-dialogue-toggle-mode');
        const dialogueBox = this.domElement.querySelector('#rpg-dialogue-box');

        if (this.chatMode === 'public') {
            this.chatMode = 'private';
            toggleButton.textContent = 'Mode: Private';
            dialogueBox.classList.add('private-chat');
            dialogueBox.classList.remove('public-chat');
        } else {
            this.chatMode = 'public';
            toggleButton.textContent = 'Mode: Public';
            dialogueBox.classList.add('public-chat');
            dialogueBox.classList.remove('private-chat');
        }
    }

    _handleClearHistory() {
        if (this.participants.length === 0 || !this.participants[0].characterData) return;

        // 1. Clear the history array on the map
        this.engine.map.chatHistory = [];

        // 2. Clear the messages from the DOM
        const messagesArea = this.domElement.querySelector('#rpg-dialogue-messages');
        messagesArea.innerHTML = '';

        // 3. Add the NPC's first message back
        const { name, first_mes } = this.participants[0].characterData;
        const greeting = first_mes || "Hello there.";
        this.engine.map.chatHistory.push({ speaker: name, text: greeting });

        // 4. Render just the greeting
        this._appendMessage(greeting, name, false);
    }

    async _handleSend() {
        const inputField = this.domElement.querySelector('#rpg-dialogue-input');
        const sendButton = this.domElement.querySelector('#rpg-dialogue-send');
        const userInput = inputField.value.trim();

        if (this.participants.length === 0) return;
        
        const currentSpeakerNpc = this.participants[this.nextSpeakerIndex];
        const mapHistory = this.engine.map.chatHistory;

        // Only add user message to history if it's not empty
        if (userInput) {
            this._appendMessage(userInput, "Player", true);
            const userMessage = { speaker: "Player", text: userInput };
            mapHistory.push(userMessage);
        } else {
            // Log for debugging that we are proceeding with an empty message
            console.log("Empty message sent, proceeding to get AI response.");
        }

        inputField.value = '';
        inputField.disabled = true;
        sendButton.disabled = true;

        // Prepare for AI response
        const npcMessageEntry = this._appendMessage("", currentSpeakerNpc.characterData.name, false);
        const npcMessageSpan = npcMessageEntry.querySelector('span');

        // Construct prompt
        const { name, description, personality, scenario, first_mes, mes_example } = currentSpeakerNpc.characterData;
        let promptParts = [];

        const otherParticipants = this.participants.filter(p => p.id !== currentSpeakerNpc.id);
        const otherParticipantNames = otherParticipants.map(p => `'${p.name}'`).join(' and ');
        
        let systemPrompt;
        if (otherParticipants.length > 0) {
            systemPrompt = `[System: This is a roleplaying group conversation between 'Player', you as '${name}', and ${otherParticipantNames}. Your response must only be what ${name} says. Do not write dialogue or actions for 'Player' or other characters. Your responses should be in character.]`;
        } else {
            systemPrompt = `[System: This is a roleplaying conversation in a fantasy world between 'Player', an adventurer, and '${name}'. You are roleplaying as ${name}. Your response must only be what ${name} says. Do not write dialogue or actions for 'Player'. Your responses should be in character.]`;
        }
        promptParts.push(systemPrompt);
        
        if (this.mapContext) {
            promptParts.push(`[Map Context: ${this.mapContext}]`);
        }
        
        promptParts.push('***');
        
        let charContext = [];
        if (description) charContext.push(`Description: ${description.replace(/{{user}}/g, 'Player')}`);
        if (personality) charContext.push(`Personality: ${personality}`);
        if (scenario) charContext.push(`Scenario: ${scenario}`);
        
        if (charContext.length > 0) {
            promptParts.push(`Character Information for ${name}:\n` + charContext.join('\n'));
        }
        
        if (mes_example) {
            promptParts.push(`\nExample Messages:\n${mes_example.replace(/{{user}}/g, 'Player')}`);
        }
        promptParts.push('***');

        if(mapHistory.length > 0){
            promptParts.push("Conversation History:");
            mapHistory.forEach(msg => {
                promptParts.push(`${msg.speaker}: ${msg.text}`);
            });
        }

        promptParts.push(`${name}:`);
        const prompt = promptParts.join('\n');

        // Get primary NPC response
        let primaryNpcResponse = "";
        try {
            primaryNpcResponse = await aiAdapter.fetchAIResponse(prompt, (streamedChunk) => {
                npcMessageSpan.textContent = streamedChunk;
                this._updateAvatar(streamedChunk, currentSpeakerNpc);
            });
            
            // Reset error count on successful response
            this.aiErrorMessageCount = 0;
            
            this._updateAvatar(primaryNpcResponse, currentSpeakerNpc);
        } catch (error) {
            // Handle AI errors without adding to conversation
            this.aiErrorMessageCount++;
            
            if (this.aiErrorMessageCount <= this.MAX_AI_ERROR_RETRIES) {
                // Create a retry button
                npcMessageSpan.innerHTML = `AI Error. <button id="retry-ai-response">Retry</button>`;
                const retryButton = npcMessageSpan.querySelector('#retry-ai-response');
                
                retryButton.onclick = async () => {
                    // Remove the error message entry
                    npcMessageEntry.remove();
                    // Re-attempt sending the message
                    await this._handleSend();
                };
                
                // Remove the failed message entry from history
                const mapHistory = this.engine.map.chatHistory;
                if (mapHistory.length > 0) {
                    mapHistory.pop(); // Remove the last entry (which would be the error message)
                }
                
                console.error("AI Response Error:", error);
                return; // Stop further processing
            } else {
                // Too many retries, fallback message
                npcMessageSpan.textContent = "I seem to be at a loss for words right now.";
                this.aiErrorMessageCount = 0;
            }
        }
        
        // Only proceed if we have a non-empty response
        if (!primaryNpcResponse || primaryNpcResponse.trim() === '') {
            console.log("Empty NPC response, skipping.");
            npcMessageEntry.remove(); // Remove the empty message entry
            return;
        }

        const nameTagPattern = new RegExp(`^${currentSpeakerNpc.characterData.name}:\\s*`, 'i');
        primaryNpcResponse = primaryNpcResponse.replace(nameTagPattern, '').trim();
        const npcMessage = { speaker: currentSpeakerNpc.characterData.name, text: primaryNpcResponse };
        this.engine.map.chatHistory.push(npcMessage);

        // Update speaker for next turn
        this.nextSpeakerIndex = (this.nextSpeakerIndex + 1) % this.participants.length;

        // Interjection Logic - ONLY in public chat mode and if NOT in a group chat
        if (this.chatMode === 'public' && this.participants.length === 1) {
            const listeners = [];
            const speakerPosition = this.participants[0];
            for (const obj of this.engine.gameObjects) {
                if (obj instanceof NPC && obj !== speakerPosition) {
                    const dx = obj.currentPixelX - speakerPosition.currentPixelX;
                    const dy = obj.currentPixelY - speakerPosition.currentPixelY;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < (obj.hearingRadius * obj.hearingRadius)) {
                        listeners.push(obj);
                    }
                }
            }
            
            if (listeners.length > 0) {
                const historyForContext = this.engine.map.chatHistory; // CHANGE: Send full history instead of just last 5
                for (const listener of listeners) {
                    if (Math.random() <= 0.3) { // 30% chance for a listener to interject
                        try {
                            const interjection = await listener.reactToConversation(npcMessage, this.participants[0], historyForContext);
                            
                            // Only show and add to history if interjection is non-empty
                            if (interjection && interjection.trim() !== '') {
                                this.showInterjection(listener, interjection);
                                this.engine.map.chatHistory.push({ 
                                    speaker: listener.name, 
                                    text: interjection.replace(/^"|"$/g, '').trim() 
                                });
                            }
                        } catch (error) {
                            console.error(`Error during interjection from ${listener.name}:`, error);
                            // Silently handle errors for interjections
                        }
                    }
                }
            }
        }
        
        inputField.disabled = false;
        sendButton.disabled = false;
        inputField.focus();
    }

    async _handleReaction(listener, npcMessage, historyForContext, primaryNpc) {
        try {
            const interjection = await listener.reactToConversation(npcMessage, primaryNpc, historyForContext);
            
            // Only show and add to history if interjection is non-empty
            if (interjection && interjection.trim() !== '') {
                this.showInterjection(listener, interjection);
                this.engine.map.chatHistory.push({ 
                    speaker: listener.name, 
                    text: interjection.replace(/^"|"$/g, '').trim() 
                });
            }
        } catch (error) {
            console.error(`Error during interjection from ${listener.name}:`, error);
            // Silently handle errors for interjections
        }
    }
}

export default DialogueUI;