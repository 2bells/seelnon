import { Vector2 } from './vector2.js';

// Dummy WebsimSocket for offline mode
class DummyWebsimSocket {
  constructor() {
    console.log("Using DummyWebsimSocket for offline mode.");
  }

  // Mock collection method
  collection(collectionName) {
    console.log(`DummyWebsimSocket: Accessing collection "${collectionName}"`);
    return {
      filter: (query) => {
        console.log(`DummyWebsimSocket: Filtering with query`, query);
        return {
          getList: async () => {
            // Return empty list for existing scores in offline mode
            return [];
          }
        };
      },
      create: async (data) => {
        console.log(`DummyWebsimSocket: Creating record (offline)`, data);
        // Do nothing in offline mode
        return { id: 'dummy-id', ...data };
      },
      delete: async (id) => {
        console.log(`DummyWebsimSocket: Deleting record with id (offline)`, id);
        // Do nothing in offline mode
      },
      subscribe: (callback) => {
        console.log(`DummyWebsimSocket: Subscribing to collection (offline)`);
        // Immediately call callback with empty data or some dummy data
        callback({
          added: [],
          modified: [],
          removed: []
        });
        // Return an unsubscribe function that does nothing
        return () => console.log('DummyWebsimSocket: Unsubscribed (offline)');
      }
    };
  }
}

export class Leaderboard {
  constructor(offlineMode = false) { // Add offlineMode parameter
    this.offlineMode = offlineMode; // Store offline mode status
    this.room = offlineMode ? new DummyWebsimSocket() : new WebsimSocket(); // Conditionally use WebsimSocket
    this.creatorUsername = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    if (this.offlineMode) {
      this.creatorUsername = 'OfflinePlayer';
      this.initialized = true;
      console.log("Leaderboard initialized in offline mode.");
      return;
    }
    this.creatorUsername = (await window.websim.getCreatedBy()).username;
    this.initialized = true;
  }

  async submitScore(gameStats, playerWins) {
    if (this.offlineMode) {
      console.log("Skipping score submission in offline mode.");
      return;
    }
    
    try {
      // Get AI evaluation of player performance
      const aiEvaluation = await this.getAIEvaluation(gameStats);

      // Get existing scores for this player
      const existingScores = await this.room.collection('scores')
        .filter({ username: this.creatorUsername })
        .getList();

      if (existingScores.length > 0) {
        // Let AI decide whether to keep the new score or not
        const shouldReplace = await this.shouldReplaceScore(aiEvaluation, existingScores[0]);
        
        if (shouldReplace) {
          // Delete old score
          await this.room.collection('scores').delete(existingScores[0].id);
          
          // Create new score
          await this.createNewScore(gameStats, playerWins, aiEvaluation);
        }
      } else {
        // No existing score, create new one
        await this.createNewScore(gameStats, playerWins, aiEvaluation);
      }
    } catch (error) {
      console.error('Error submitting score:', error);
    }
  }

  async createNewScore(gameStats, playerWins, aiEvaluation) {
    if (this.offlineMode) return;
    await this.room.collection('scores').create({
      username: this.creatorUsername,
      timestamp: new Date().toISOString(),
      gameStats: gameStats,
      playerWins: playerWins,
      aiScore: aiEvaluation.score,
      aiComment: aiEvaluation.comment,
      skillRating: aiEvaluation.skillRating,
      playstyle: aiEvaluation.playstyle,
      metrics: {
        efficiency: aiEvaluation.metrics.efficiency,
        aggression: aiEvaluation.metrics.aggression,
        strategy: aiEvaluation.metrics.strategy,
        resourceManagement: aiEvaluation.metrics.resourceManagement
      }
    });
  }

  async shouldReplaceScore(newScore, oldScore) {
    if (this.offlineMode) {
      console.log("Skipping score replacement decision in offline mode. Defaulting to true.");
      return true; // Default to replacing in offline mode if for some reason it's called
    }
    try {
      const response = await fetch('/api/ai_completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          prompt: `You are deciding whether to keep a new game score for a player or keep an old one. You must decide which of the two is the "better" score overall. Respond with true to replace old score, or false if the old score is better.

          Critically, use this rule: Higher aiScore is always better.

          Respond in JSON.
          
          \`\`\`typescript
          interface Args {
            newScore: {
              aiScore: number;
              metrics: {
                  efficiency: number;
                  aggression: number;
                  strategy: number;
                  resourceManagement: number;
              }
            }
            oldScore: {
              aiScore: number;
              metrics: {
                  efficiency: number;
                  aggression: number;
                  strategy: number;
                  resourceManagement: number;
              }
            }
          }
          interface Response {
            replaceOldScore: boolean;
            reason: string;
          }
          \`\`\`
          Example 1:
          \`\`\`json
          {
            "replaceOldScore": true,
            "reason": "New aiScore (67) is greater than old aiScore (55). The new score also demonstrates good resource management."
          }
          \`\`\`
          Example 2:
          \`\`\`json
          {
            "replaceOldScore": false,
            "reason": "Old aiScore (82) is greater than new aiScore (71)."
          }
          \`\`\`
          `,
          data: {
            newScore: newScore,
            oldScore: oldScore
          }
        }),
      });
      const data = await response.json();
      console.log("AI Score Decision:", data.reason);
      return data.replaceOldScore;
    } catch (error) {
      console.error('Error in score comparison:', error);
      return newScore.aiScore > oldScore.aiScore; // Default to keeping new score if there's an error
    }
  }

  async getAIEvaluation(gameStats) {
    if (this.offlineMode) {
      console.log("Returning dummy AI evaluation in offline mode.");
      return {
        score: Math.floor(Math.random() * 100), // Random score for dummy data
        comment: "[Offline] No AI evaluation available. Go online to get real insights!",
        skillRating: "Offline Rank",
        playstyle: "Casual",
        metrics: {
          efficiency: 50,
          aggression: 50,
          strategy: 50,
          resourceManagement: 50
        }
      };
    }
    try {
      const response = await fetch('/api/ai_completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Analyze the player's performance in an RTS game and provide a detailed evaluation.
          Consider resource management, unit composition, aggression levels, and strategic decisions.

          interface Response {
            score: number; // 0-100
            comment: string; // Brief analysis of performance
            skillRating: string; // "Beginner" | "Intermediate" | "Advanced" | "Expert"
            playstyle: string; // "Aggressive" | "Defensive" | "Economic" | "Balanced"
            metrics: {
              efficiency: number; // 0-100
              aggression: number; // 0-100
              strategy: number; // 0-100
              resourceManagement: number; // 0-100
            }
          }

          Example response: {
            "score": 85,
            "comment": "Excellent resource management and strategic unit composition. Could improve early game aggression.",
            "skillRating": "Advanced",
            "playstyle": "Economic",
            "metrics": {
              "efficiency": 90,
              "aggression": 70,
              "strategy": 85,
              "resourceManagement": 95
            }
          }`,
          data: gameStats
        }),
      });
      return await response.json();
    } catch (error) {
      console.error('Error getting AI evaluation:', error);
      return {
        score: 20,
        comment: "[Error getting AI evaluation] Probably boosted by own AI",
        skillRating: "Intermediate",
        playstyle: "Balanced",
        metrics: {
          efficiency: 50,
          aggression: 50,
          strategy: 50,
          resourceManagement: 50
        }
      };
    }
  }

  subscribeToLeaderboard(callback) {
    if (this.offlineMode) {
      console.log("Skipping leaderboard subscription in offline mode.");
      // Provide dummy data immediately
      callback({
        topPlayers: [{ username: "OfflinePlayer", score: 0, skillRating: "N/A", playstyle: "N/A" }],
        playerStyles: [],
        recentGames: [],
        playerProgress: []
      });
      return () => { console.log('Offline leaderboard unsubscribe called.'); }; // Dummy unsubscribe
    }
    return this.room.collection('scores')
      .subscribe(scores => {
        const processedScores = this.processLeaderboardData(scores);
        callback(processedScores);
      });
  }

  processLeaderboardData(scores) {
    const bestScores = this.getBestScoresPerUser(scores);

    return {
      topPlayers: this.getTopPlayers(bestScores),
      playerStyles: this.getPlaystyleDistribution(bestScores),
      recentGames: this.getRecentGames(bestScores),
      playerProgress: this.getPlayerProgress(bestScores)
    };
  }

  getBestScoresPerUser(scores) {
    const bestScores = {};

    scores.forEach(score => {
      if (!bestScores[score.username] || score.aiScore > bestScores[score.username].aiScore) {
        bestScores[score.username] = score;
      }
    });

    return Object.values(bestScores);
  }

  getTopPlayers(scores) {
    return scores
      .sort((a, b) => b.aiScore - a.aiScore)
      .slice(0, 10)
      .map(score => ({
        username: score.username,
        score: score.aiScore,
        skillRating: score.skillRating,
        playstyle: score.playstyle
      }));
  }

  getPlaystyleDistribution(scores) {
    const styles = scores.reduce((acc, score) => {
      acc[score.playstyle] = (acc[score.playstyle] || 0) + 1;
      return acc;
    }, {});

    const total = Object.values(styles).reduce((a, b) => a + b, 0);
    return Object.entries(styles).map(([style, count]) => ({
      style,
      percentage: (count / total) * 100
    }));
  }

  getRecentGames(scores) {
    return scores
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5);
  }

  getPlayerProgress(scores) {
    const playerScores = scores
      .filter(score => score.username === this.creatorUsername)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return playerScores.map(score => ({
      timestamp: score.timestamp,
      score: score.aiScore,
      metrics: score.metrics
    }));
  }
}