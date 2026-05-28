// JRPG Quest Editor & Importer Panels
console.log("rpg/game/editor/quest_editor.js loaded");

class QuestEditor {
    constructor(engine, modalContentElement) {
        this.engine = engine;
        this.modalContentElement = modalContentElement;
        this.isActive = false;
        this.panel = null;
        
        // Define clean default presets for instantly importing quest lines
        this.presets = {
            slime_menace: [
                {
                    id: "quest_slime_menace",
                    title: "Village Slime Menace",
                    description: "Defeat 3 Slimes around the area to safeguard the tavern perimeter.",
                    npcName: "Shortia",
                    npcBroadType: "merchant",
                    type: "slay",
                    target: "Slime",
                    targetCount: 3,
                    rewardGold: 80,
                    rewardItem: {
                        name: "Steel Shield",
                        type: "shield",
                        bonusDef: 4,
                        description: "+4 Defense steel gear.",
                        value: 100
                    }
                }
            ],
            herb_gather: [
                {
                    id: "quest_herb_gathering",
                    title: "Medicinal Herbs Hunt",
                    description: "Gather 3 Green Herbs from the biome map to brew local cures.",
                    npcName: "Lanna",
                    npcBroadType: "villager",
                    type: "gather",
                    target: "Green Herb",
                    targetCount: 3,
                    rewardGold: 40,
                    rewardItem: {
                        name: "Gold Elixir",
                        type: "consumable",
                        heal: 100,
                        description: "Fully restores health.",
                        value: 60
                    }
                }
            ],
            dragon_duel: [
                {
                    id: "quest_dragon_slayer",
                    title: "Gorgoth The Fire Drake",
                    description: "Slay Gorgoth the red dragon terrorizing the isometric fields.",
                    npcName: "Shortia",
                    npcBroadType: "guard",
                    type: "slay",
                    target: "Dragon",
                    targetCount: 1,
                    rewardGold: 500,
                    rewardItem: {
                        name: "Excalibur",
                        type: "weapon",
                        bonusAtk: 15,
                        description: "The divine holy sword +15 Atk.",
                        value: 1000
                    }
                }
            ],
            iron_smelt: [
                {
                    id: "quest_iron_ore_hunt",
                    title: "Blacksmith Smelting Run",
                    description: "Collect 5 Iron Ores for the village forge to replenish arms steel.",
                    npcName: "Lanna",
                    npcBroadType: "merchant",
                    type: "gather",
                    target: "Iron Ore",
                    targetCount: 5,
                    rewardGold: 150,
                    rewardItem: {
                        name: "Forged Breastplate",
                        type: "armor",
                        bonusDef: 8,
                        description: "Thick hand-forged breastplate +8 Defense.",
                        value: 300
                    }
                }
            ]
        };
    }

    initUI() {
        if (this.panel) return;

        this.panel = document.createElement('div');
        this.panel.id = 'rpg-quest-editor-panel';
        this.panel.style.display = 'none';

        const titleButton = document.createElement('button');
        titleButton.id = 'rpg-quest-editor-toggle';
        titleButton.textContent = '📜 Quest Ledger & JSON Editor';
        titleButton.onclick = () => this.panel.classList.toggle('collapsed');
        this.panel.appendChild(titleButton);

        const content = document.createElement('div');
        content.id = 'rpg-quest-editor-content';

        // --- Active Ledger Progress Section ---
        const ledgerSection = document.createElement('div');
        ledgerSection.className = 'quest-editor-section';
        ledgerSection.innerHTML = '<h4>Active Campaigns & Tasks</h4>';
        const ledgerList = document.createElement('div');
        ledgerList.id = 'rpg-quest-editor-ledger-list';
        ledgerList.style.maxHeight = '140px';
        ledgerList.style.overflowY = 'auto';
        ledgerList.style.border = '1px solid #5A4B3E';
        ledgerList.style.backgroundColor = '#2B231D';
        ledgerList.style.borderRadius = '5px';
        ledgerList.style.padding = '8px';
        ledgerSection.appendChild(ledgerList);
        content.appendChild(ledgerSection);

        // --- Presets Quickload Section ---
        const presetsSection = document.createElement('div');
        presetsSection.className = 'quest-editor-section';
        presetsSection.innerHTML = '<h4>Campaign Presets</h4>';
        
        const presetSelect = document.createElement('select');
        presetSelect.id = 'rpg-quest-editor-preset-select';
        presetSelect.style.width = '100%';
        presetSelect.style.padding = '6px';
        presetSelect.style.backgroundColor = '#3B322C';
        presetSelect.style.color = '#EFEBE0';
        presetSelect.style.border = '1px solid #8C6D56';
        presetSelect.style.borderRadius = '4px';
        presetSelect.style.marginBottom = '8px';
        
        const optDefault = document.createElement('option');
        optDefault.value = '';
        optDefault.textContent = '-- Select Campaign Preset --';
        presetSelect.appendChild(optDefault);

        const optSlime = document.createElement('option');
        optSlime.value = 'slime_menace';
        optSlime.textContent = 'Village Slime Menace';
        presetSelect.appendChild(optSlime);

        const optHerb = document.createElement('option');
        optHerb.value = 'herb_gather';
        optHerb.textContent = 'Medicinal Herbs Hunt';
        presetSelect.appendChild(optHerb);

        const optDragon = document.createElement('option');
        optDragon.value = 'dragon_duel';
        optDragon.textContent = 'Dragon Champion Duel';
        presetSelect.appendChild(optDragon);

        const optSmelt = document.createElement('option');
        optSmelt.value = 'iron_smelt';
        optSmelt.textContent = 'Blacksmith Ore Run';
        presetSelect.appendChild(optSmelt);

        presetSelect.onchange = (e) => {
            const val = e.target.value;
            if (val && this.presets[val]) {
                textarea.value = JSON.stringify(this.presets[val], null, 2);
            }
        };

        presetsSection.appendChild(presetSelect);
        content.appendChild(presetsSection);

        // --- JSON Import/Export Workspace Section ---
        const jsonSection = document.createElement('div');
        jsonSection.className = 'quest-editor-section';
        jsonSection.innerHTML = '<h4>Quest JSON Workspace</h4>';

        const textarea = document.createElement('textarea');
        textarea.id = 'rpg-quest-editor-textarea';
        textarea.placeholder = 'Paste quest JSON or load a preset above...';
        textarea.style.width = '100%';
        textarea.style.height = '120px';
        textarea.style.backgroundColor = '#3B322C';
        textarea.style.color = '#EFEBE0';
        textarea.style.border = '1px solid #8C6D56';
        textarea.style.borderRadius = '4px';
        textarea.style.padding = '8px';
        textarea.style.boxSizing = 'border-box';
        textarea.style.fontFamily = 'monospace';
        textarea.style.fontSize = '11px';
        textarea.style.resize = 'vertical';
        jsonSection.appendChild(textarea);

        // Buttons row
        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.gap = '5px';
        btnRow.style.marginTop = '8px';

        const btnImport = document.createElement('button');
        btnImport.textContent = 'Import Questline';
        btnImport.className = 'rpg-btn-buy';
        btnImport.style.flex = '1';
        btnImport.style.padding = '8px';
        btnImport.onclick = () => {
            const val = textarea.value.trim();
            if (!val) {
                CustomDialog.alert("Please paste some valid quest JSON code first or pick a preset.", "Quest Import");
                return;
            }
            const res = this.engine.questSystem.importQuestline(val);
            if (res.success) {
                CustomDialog.alert(`Successfully imported ${res.count} quest(s)! Try speaking to the matched NPCs to undertake them!`, "Quests Imported");
                this.refreshLedgerList();
            } else {
                CustomDialog.alert(`Import failed: ${res.error}`, "Import Error");
            }
        };

        const btnExport = document.createElement('button');
        btnExport.textContent = 'Export Active';
        btnExport.className = 'rpg-btn-buy';
        btnExport.style.flex = '1';
        btnExport.style.padding = '8px';
        btnExport.onclick = () => {
            const data = this.engine.questSystem.exportQuests();
            textarea.value = data;
            CustomDialog.alert("All active and archived game lines have been exported successfully. Copy them from the text area.", "Quests Exported");
        };

        btnRow.appendChild(btnImport);
        btnRow.appendChild(btnExport);
        jsonSection.appendChild(btnRow);
        content.appendChild(jsonSection);

        this.panel.appendChild(content);
        this.modalContentElement.appendChild(this.panel);
    }

    show() {
        this.initUI();
        this.panel.style.display = 'flex';
        this.isActive = true;
        this.refreshLedgerList();
    }

    hide() {
        if (this.panel) {
            this.panel.style.display = 'none';
        }
        this.isActive = false;
    }

    refreshLedgerList() {
        const listDiv = document.getElementById('rpg-quest-editor-ledger-list');
        if (!listDiv) return;

        listDiv.innerHTML = '';

        const activeQs = this.engine.questSystem.activeQuests || [];
        const availableQs = this.engine.questSystem.availableQuests || [];
        const completedQs = this.engine.questSystem.completedQuests || [];

        if (activeQs.length === 0 && availableQs.length === 0 && completedQs.length === 0) {
            listDiv.innerHTML = '<div style="color: #8C6D56; text-align: center; margin-top: 20px; font-style: italic;">No quests currently loaded. Use the dropdown preset of import tool below!</div>';
            return;
        }

        const buildBlock = (q, statusLabel, color) => {
            const container = document.createElement('div');
            container.style.borderBottom = '1px dashed #5A4B3E';
            container.style.padding = '6px 0';
            container.style.fontSize = '12px';

            const titleRow = document.createElement('div');
            titleRow.style.display = 'flex';
            titleRow.style.justifyContent = 'space-between';
            titleRow.style.color = '#EFEBE0';

            const title = document.createElement('strong');
            title.textContent = q.title;
            titleRow.appendChild(title);

            const status = document.createElement('span');
            status.textContent = statusLabel;
            status.style.color = color;
            status.style.fontWeight = 'bold';
            titleRow.appendChild(status);
            container.appendChild(titleRow);

            const desc = document.createElement('div');
            desc.style.color = '#D4C8A0';
            desc.style.fontSize = '11px';
            desc.style.marginTop = '2px';
            desc.textContent = q.description;
            container.appendChild(desc);

            const meta = document.createElement('div');
            meta.style.color = '#8C6D56';
            meta.style.fontSize = '11px';
            meta.style.marginTop = '3px';
            
            let npcDisplay = q.npcName;
            if (q.npcBroadType && q.npcBroadType !== 'villager') {
                npcDisplay += ` (${q.npcBroadType})`;
            }

            let progressString = '';
            if (statusLabel === 'ACTIVE') {
                progressString = ` | Progress: ${q.currentCount}/${q.targetCount}`;
            }

            meta.textContent = `Assignee: ${npcDisplay}${progressString} | Gold: +${q.rewardGold}`;
            container.appendChild(meta);

            listDiv.appendChild(container);
        };

        activeQs.forEach(q => buildBlock(q, 'ACTIVE', '#00ffff'));
        availableQs.forEach(q => buildBlock(q, 'AVAILABLE', '#8C6D56'));
        completedQs.forEach(q => buildBlock(q, 'COMPLETED', '#00ff00'));
    }
}

export default QuestEditor;
