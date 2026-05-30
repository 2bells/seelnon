// JRPG Quest System
// Handles modular JSON quests, NPC broad types matching, dynamic item-requesting and slay/gather goals.

export class QuestSystem {
    constructor(engine) {
        this.engine = engine;
        this.activeQuests = [];
        this.completedQuests = [];
        this.availableQuests = []; // Quests loaded and waiting to be offered

        this.initDefaultQuests();
    }

    initDefaultQuests() {
        // Built-in starter modular quests with broad-type fallbacks
        this.availableQuests = [
            {
                id: "quest_slime_menace",
                title: "Village Slime Menace",
                description: "Defeat 3 Slimes around the area to safeguard the tavern perimeter.",
                status: "available",
                npcName: "Shortia", // 1st pick named character
                npcBroadType: "merchant", // Fallback broad type
                type: "slay",
                target: "Slime",
                targetCount: 3,
                currentCount: 0,
                rewardGold: 80,
                rewardItem: {
                    name: "Steel Shield",
                    type: "shield",
                    bonusDef: 4,
                    description: "+4 Defense steel gear.",
                    value: 100
                }
            },
            {
                id: "quest_herb_gathering",
                title: "Medicinal Herbs Hunt",
                description: "Gather 3 Green Herbs from the biome map to brew local cures.",
                status: "available",
                npcName: "Lanna", // 1st pick named character
                npcBroadType: "villager", // Fallback broad type
                type: "gather",
                target: "Green Herb",
                targetCount: 3,
                currentCount: 0,
                rewardGold: 40,
                rewardItem: {
                    name: "Gold Elixir",
                    type: "consumable",
                    heal: 100,
                    description: "Fully restores health.",
                    value: 60
                }
            }
        ];
    }

    // Identifies which NPC on the map should receive/manage this quest.
    resolveNpcForQuest(quest) {
        const npcs = this.engine.gameObjects.filter(obj => obj.constructor.name === 'NPC' || (obj.characterData));
        if (npcs.length === 0) return null;

        // Choice 1: Specific Name (1st pick)
        let matched = npcs.find(npc => npc.name === quest.npcName);
        if (matched) return matched;

        // Choice 2: Broad Type Match (merchant, guard, villager, etc.)
        matched = npcs.find(npc => {
            const bt = (npc.characterData && npc.characterData.broadType) || 'villager';
            return bt.toLowerCase() === quest.npcBroadType.toLowerCase();
        });
        if (matched) return matched;

        // Choice 3: Complete fallback - first available NPC so quest line works out!
        return npcs[0];
    }

    // Fetches all quests associated with a specific NPC
    getNpcQuests(npc) {
        const offered = this.availableQuests.filter(q => {
            const resolved = this.resolveNpcForQuest(q);
            return resolved && resolved.name === npc.name;
        });

        const active = this.activeQuests.filter(q => {
            const resolved = this.resolveNpcForQuest(q);
            return resolved && resolved.name === npc.name;
        });

        return { offered, active };
    }

    acceptQuest(questId) {
        const idx = this.availableQuests.findIndex(q => q.id === questId);
        if (idx !== -1) {
            const quest = this.availableQuests.splice(idx, 1)[0];
            quest.status = "active";
            quest.currentCount = 0;
            this.activeQuests.push(quest);
            console.log(`Quest active: ${quest.title}`);
            this.updateGatherQuestCount(quest);
            return quest;
        }
        return null;
    }

    updateGatherQuestCount(quest) {
        if (quest.type === 'gather') {
            const items = this.engine.player.inventory || [];
            const item = items.find(i => i.name === quest.target);
            quest.currentCount = item ? item.count : 0;
        }
    }

    checkGatherQuests() {
        this.activeQuests.forEach(q => {
            if (q.type === 'gather') {
                this.updateGatherQuestCount(q);
            }
        });
    }

    onEnemyKilled(enemyName) {
        this.activeQuests.forEach(q => {
            const matchExact = q.target.toLowerCase() === enemyName.toLowerCase();
            const matchContains = enemyName.toLowerCase().includes(q.target.toLowerCase()) || q.target.toLowerCase().includes(enemyName.toLowerCase());
            if (q.type === 'slay' && (matchExact || matchContains)) {
                q.currentCount++;
                if (q.currentCount > q.targetCount) {
                    q.currentCount = q.targetCount;
                }
                console.log(`Quest progress: ${q.title} (${q.currentCount}/${q.targetCount})`);

                // Create nice floating text effect if game supports effects
                if (this.engine.addEffect) {
                    try {
                        // Check if FloatingTextEffect is loaded on engine, else mock
                        const FloatingTextEffect = this.engine.FloatingTextEffect || null;
                        if (FloatingTextEffect) {
                            this.engine.addEffect(new FloatingTextEffect(this.engine, {
                                text: `${q.title}: ${q.currentCount}/${q.targetCount}`,
                                position: { x: this.engine.player.currentPixelX, y: this.engine.player.currentPixelY - 80 },
                                color: '#00ffff'
                            }));
                        }
                    } catch (e) {
                        console.log("Floating text feedback skipped:", e);
                    }
                }
            }
        });
    }

    canComplete(quest) {
        if (quest.type === 'slay') {
            return quest.currentCount >= quest.targetCount;
        } else if (quest.type === 'gather') {
            const items = this.engine.player.inventory || [];
            const item = items.find(i => i.name === quest.target);
            return item && item.count >= quest.targetCount;
        }
        return true;
    }

    completeQuest(questId) {
        const idx = this.activeQuests.findIndex(q => q.id === questId);
        if (idx !== -1) {
            const quest = this.activeQuests[idx];

            if (!this.canComplete(quest)) {
                return false;
            }

            // Consume items for gather quests
            if (quest.type === 'gather') {
                const item = this.engine.player.inventory.find(i => i.name === quest.target);
                if (item) {
                     item.count -= quest.targetCount;
                     if (item.count <= 0) {
                         this.engine.player.inventory = this.engine.player.inventory.filter(i => i.id !== item.id);
                     }
                }
            }

            // Retract quest
            this.activeQuests.splice(idx, 1);
            quest.status = "completed";
            this.completedQuests.push(quest);

            // Pay Cash
            this.engine.player.gold = (this.engine.player.gold || 0) + quest.rewardGold;

            // Deliver Item Reward
            if (quest.rewardItem) {
                const existing = this.engine.player.inventory.find(i => i.name === quest.rewardItem.name);
                if (existing) {
                    existing.count++;
                } else {
                    const rItem = { ...quest.rewardItem };
                    rItem.id = `item_${Date.now()}_generic_${Math.floor(Math.random() * 99999)}`;
                    rItem.count = 1;
                    rItem.equipped = false;
                    this.engine.player.inventory.push(rItem);
                }
            }

            console.log(`Quest complete! Title: ${quest.title}`);
            return true;
        }
        return false;
    }

    importQuestline(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            const list = Array.isArray(data) ? data : [data];
            let count = 0;
            list.forEach(q => {
                if (q.title && q.type) {
                    const newQ = {
                        id: q.id || `quest_imported_${Date.now()}_${count}_${Math.floor(Math.random() * 9999)}`,
                        title: q.title,
                        description: q.description || "No description provided.",
                        status: "available",
                        npcName: q.npcName || "Shortia",
                        npcBroadType: q.npcBroadType || "villager",
                        type: q.type,
                        target: q.target || "Slime",
                        targetCount: parseInt(q.targetCount) || 1,
                        currentCount: 0,
                        rewardGold: parseInt(q.rewardGold) || 50,
                        rewardItem: q.rewardItem || null
                    };
                    this.availableQuests.push(newQ);
                    count++;
                }
            });
            return { success: true, count };
        } catch (e) {
            console.error("Failed importing JSON questline:", e);
            return { success: false, error: e.message };
        }
    }

    exportQuests() {
        const fullList = [...this.availableQuests, ...this.activeQuests, ...this.completedQuests];
        return JSON.stringify(fullList, null, 2);
    }

    // Triggers and returns a dynamic quest based on inspecting/asking for any items in an NPC's backpack!
    generateItemQuest(npc, item) {
        let qType = 'gather';
        let targetName = 'Green Herb';
        let amount = 3;
        let summaryTask = 'Gather 3 Green Herbs';

        if (item.type === 'weapon' || item.type === 'shield' || item.type === 'armor') {
            qType = 'slay';
            targetName = 'Slime';
            amount = Math.floor(Math.random() * 2) + 2; 
            summaryTask = `Defeat ${amount} Slimes`;
        } else {
            // Consumable / Herb
            qType = 'gather';
            const targets = ['Green Herb', 'Red Potion'];
            targetName = targets[Math.floor(Math.random() * targets.length)];
            amount = Math.floor(Math.random() * 2) + 2;
            summaryTask = `Collect and deliver ${amount} ${targetName}s`;
        }

        const quest = {
            id: `quest_ask_${Date.now()}_${Math.floor(Math.random() * 99999)}`,
            title: `${npc.name}'s task: ${item.name}`,
            description: `Earn the coveted "${item.name}" from ${npc.name}'s backpack. Task: ${summaryTask}.`,
            status: "available",
            npcName: npc.name,
            npcBroadType: (npc.characterData && npc.characterData.broadType) || "merchant",
            type: qType,
            target: targetName,
            targetCount: amount,
            currentCount: 0,
            rewardGold: 15,
            rewardItem: {
                name: item.name,
                type: item.type,
                heal: item.heal || 0,
                bonusAtk: item.bonusAtk || 0,
                bonusDef: item.bonusDef || 0,
                description: item.description,
                value: item.value || Math.floor((item.cost || 50) * 0.7)
            }
        };

        this.availableQuests.push(quest);
        return quest;
    }
}
export default QuestSystem;
