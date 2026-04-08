export class AIChat {
  constructor(gameStats, playerWins, offlineMode = false) {
    this.gameStats = gameStats;
    this.playerWins = playerWins;
    this.offlineMode = offlineMode;
    this.chatHistory = [];
    this.isOpen = false;
    this.container = null;
    this.initialAIMessage = null; 
    if (!this.offlineMode) {
      this.setupChatUI();
    }
  }

  setupChatUI() {
    // Remove any existing chat container first
    const existingContainer = document.getElementById('ai-chat-container');
    if (existingContainer) {
      existingContainer.remove();
    }

    this.container = document.createElement('div');
    this.container.id = 'ai-chat-container';
    this.container.style.display = 'none';
    
    this.container.innerHTML = `
      <div class="chat-header">
        <span>Chat with AI</span>
        <button class="close-chat">×</button>
      </div>
      <div class="chat-messages"></div>
      <div class="chat-input">
        <input type="text" placeholder="Type your message...">
        <button class="send-message">Send</button>
      </div>
    `;

    document.body.appendChild(this.container);

    this.container.querySelector('.close-chat').addEventListener('click', () => this.closeChat());
    this.container.querySelector('.send-message').addEventListener('click', () => this.sendMessage());
    this.container.querySelector('input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });
  }

  async openChat() {
    if (this.offlineMode) {
      console.log("AI Chat disabled in offline mode.");
      return;
    }
    this.isOpen = true;
    this.container.style.display = 'flex';
    
    if (this.chatHistory.length === 0) {
      if (this.initialAIMessage) {
        this.addMessage('ai', this.initialAIMessage);
      } else {
        await this.getInitialAIMessage();
      }
    }
  }

  closeChat() {
    if (this.offlineMode) return;
    this.isOpen = false;
    this.container.style.display = 'none';
  }

  async getInitialAIMessage() {
    if (this.offlineMode) {
      this.initialAIMessage = "Offline Chat: Can't connect to the AI brain. Talk to yourself for now!";
      this.addMessage('ai', this.initialAIMessage);
      return;
    }
    try {
      const response = await fetch('/api/ai_completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          prompt: `You are an AI opponent that just finished a game with the player. Create a casual, friendly opening message based on the game results and stats. Keep it short and engaging, encouraging conversation.

          interface Response {
            message: string;
          }
          
          Example: {
            "message": "What a game! Those triangle units of yours really caught me off guard in the mid-game. Want to discuss strategies?"
          }`,
          data: {
            gameStats: this.gameStats,
            playerWins: this.playerWins
          }
        })
      });

      const data = await response.json();
      this.initialAIMessage = data.message; 
      this.addMessage('ai', data.message);
    } catch (error) {
      console.error('Error getting AI message:', error);
      this.initialAIMessage = "Hey there! What an interesting game. Want to chat about it?";
      this.addMessage('ai', "Hey there! What an interesting game. Want to chat about it?");
    }
  }

  async sendMessage() {
    if (this.offlineMode) {
      this.addMessage('player', "Offline Message: " + this.container.querySelector('input').value.trim());
      this.container.querySelector('input').value = '';
      this.addMessage('ai', "Offline Chat: The AI is currently unavailable. Please go online for a proper response.");
      return;
    }
    const input = this.container.querySelector('input');
    const message = input.value.trim();
    
    if (message) {
      this.addMessage('player', message);
      input.value = '';
      
      try {
        const response = await fetch('/api/ai_completion', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            prompt: `You are talking to the player after a game. Respond to their message in a fun, bantering way while considering the game score and previous chat messages. Keep responses concise and engaging.

            interface Response {
              message: string;
            }
            
            Example: {
              "message": "GGs! Wanna run another one, me game, you? I noticed you tried early expansion, but... what's your build order or you just clicking?"
            }`,
            data: {
              gameStats: this.gameStats,
              playerWins: this.playerWins,
              chatHistory: this.chatHistory,
              playerMessage: message
            }
          })
        });

        const data = await response.json();
        this.addMessage('ai', data.message);
      } catch (error) {
        console.error('Error getting AI response:', error);
        this.addMessage('ai', "I'm having trouble responding right now. Can you try again?");
      }
    }
  }

  addMessage(sender, message) {
    this.chatHistory.push({ sender, message });
    
    const messagesContainer = this.container.querySelector('.chat-messages');
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${sender}-message`;
    messageElement.textContent = message;
    
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}