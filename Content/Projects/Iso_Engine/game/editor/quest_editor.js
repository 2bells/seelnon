// JRPG Quest Editor & Importer Panels
console.log("rpg/game/editor/quest_editor.js loaded");

import { getGlobalItemDatabase } from './bank_editor.js';

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
        titleButton.textContent = 'Quest Editor';
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
        ledgerList.style.maxHeight = '100px';
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

        presetsSection.appendChild(presetSelect);
        content.appendChild(presetsSection);

        // --- Specific Blocks for Quest Edit Formulation ---
        const formSection = document.createElement('div');
        formSection.className = 'quest-editor-section';
        formSection.style.display = 'flex';
        formSection.style.flexDirection = 'column';
        formSection.style.gap = '8px';
        formSection.style.backgroundColor = '#2B231D';
        formSection.style.padding = '8px';
        formSection.style.borderRadius = '5px';
        formSection.style.border = '1px dashed #5A4B3E';
        formSection.style.marginBottom = '8px';
        formSection.innerHTML = '<h4 style="margin-top: 0; margin-bottom: 6px; border-bottom: 1px solid #725c4d; padding-bottom: 4px; color: #D4C8A0;">Quest Attribute Composer</h4>';

        const createFormRow = (lblText, element) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.flexDirection = 'column';
            const lbl = document.createElement('label');
            lbl.textContent = lblText;
            lbl.style.fontSize = '0.75em';
            lbl.style.fontWeight = 'bold';
            lbl.style.color = '#D4C8A0';
            lbl.style.marginBottom = '2px';
            row.appendChild(lbl);
            row.appendChild(element);
            return row;
        };

        const createFormRowHorizontal = (lblText, element) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '8px';
            row.style.margin = '4px 0';
            row.appendChild(element);
            const lbl = document.createElement('label');
            lbl.textContent = lblText;
            lbl.style.fontSize = '0.8em';
            lbl.style.fontWeight = 'bold';
            lbl.style.color = '#D4C8A0';
            row.appendChild(lbl);
            return row;
        };

        // Form Fields
        const fTitle = document.createElement('input');
        fTitle.type = 'text';
        fTitle.placeholder = 'e.g. Defeat the Slime Threat';
        formSection.appendChild(createFormRow('Quest Title', fTitle));

        const fId = document.createElement('input');
        fId.type = 'text';
        fId.placeholder = 'e.g. quest_slime_peril';
        formSection.appendChild(createFormRow('Unique Quest ID Slug', fId));

        const fNpcName = document.createElement('input');
        fNpcName.type = 'text';
        fNpcName.placeholder = 'e.g. Shortia';
        formSection.appendChild(createFormRow('Assignee NPC Name', fNpcName));

        const fNpcType = document.createElement('select');
        fNpcType.innerHTML = `
            <option value="villager">Villager (Lanna)</option>
            <option value="merchant">Merchant (Shortia)</option>
            <option value="guard">Guard / Hero</option>
        `;
        formSection.appendChild(createFormRow('Assignee NPC Broad Type', fNpcType));

        const fType = document.createElement('select');
        fType.innerHTML = `
            <option value="slay">Slay Monsters</option>
            <option value="gather">Gather Collectables</option>
        `;
        formSection.appendChild(createFormRow('Objective Goal Type', fType));

        const fTarget = document.createElement('input');
        fTarget.type = 'text';
        fTarget.placeholder = 'e.g. Slime, Green Herb, Ore';
        formSection.appendChild(createFormRow('Target Objective Name', fTarget));

        const fCount = document.createElement('input');
        fCount.type = 'number';
        fCount.min = '1';
        fCount.value = '3';
        formSection.appendChild(createFormRow('Target Objective Count', fCount));

        const fDesc = document.createElement('textarea');
        fDesc.placeholder = 'Enter dialogue details of the job...';
        fDesc.rows = 2;
        fDesc.style.resize = 'vertical';
        formSection.appendChild(createFormRow('Dialogue / Tracker Description', fDesc));

        const fGold = document.createElement('input');
        fGold.type = 'number';
        fGold.min = '0';
        fGold.value = '50';
        formSection.appendChild(createFormRow('Reward Gold Coins', fGold));

        // Reward Item section
        const fHasItem = document.createElement('input');
        fHasItem.type = 'checkbox';
        fHasItem.style.width = '16px';
        fHasItem.style.height = '16px';
        fHasItem.style.cursor = 'pointer';
        formSection.appendChild(createFormRowHorizontal('Has Reward Item?', fHasItem));

        const itemSubContainer = document.createElement('div');
        itemSubContainer.style.display = 'none';
        itemSubContainer.style.flexDirection = 'column';
        itemSubContainer.style.gap = '6px';
        itemSubContainer.style.paddingLeft = '10px';
        itemSubContainer.style.borderLeft = '2px solid #8C6D56';
        itemSubContainer.style.marginTop = '4px';

        const fBankItemSelect = document.createElement('select');
        fBankItemSelect.style.width = '100%';
        fBankItemSelect.style.padding = '6px';
        fBankItemSelect.style.backgroundColor = '#3B322C';
        fBankItemSelect.style.color = '#EFEBE0';
        fBankItemSelect.style.border = '1px solid #8C6D56';
        fBankItemSelect.style.borderRadius = '4px';
        fBankItemSelect.style.marginBottom = '6px';
        itemSubContainer.appendChild(createFormRow('Or Link Existing Item from Bank Database', fBankItemSelect));

        const fItemName = document.createElement('input');
        fItemName.type = 'text';
        fItemName.placeholder = 'e.g. Steel Shield';
        itemSubContainer.appendChild(createFormRow('Reward Item Name', fItemName));

        const fItemType = document.createElement('select');
        fItemType.innerHTML = `
            <option value="weapon">Weapon (Atk Power)</option>
            <option value="shield">Shield (Def Defense)</option>
            <option value="armor">Armor (Health / Def)</option>
            <option value="consumable">Consumable (Healing Health)</option>
        `;
        itemSubContainer.appendChild(createFormRow('Reward Item Type', fItemType));

        const fItemPower = document.createElement('input');
        fItemPower.type = 'number';
        fItemPower.value = '5';
        itemSubContainer.appendChild(createFormRow('Reward Item Attribute Value', fItemPower));

        const fItemDesc = document.createElement('input');
        fItemDesc.type = 'text';
        fItemDesc.placeholder = 'Description of the item';
        itemSubContainer.appendChild(createFormRow('Reward Item Description', fItemDesc));

        const populateBankItemSelect = () => {
            fBankItemSelect.innerHTML = '<option value="">-- Manual/Custom Entry --</option>';
            const db = getGlobalItemDatabase(this.engine);
            Object.keys(db).forEach(key => {
                const item = db[key];
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = `${item.emoji || '🎁'} ${item.name} (${item.type})`;
                fBankItemSelect.appendChild(opt);
            });
        };

        fBankItemSelect.onchange = () => {
            const db = getGlobalItemDatabase(this.engine);
            const selectedItem = db[fBankItemSelect.value];
            if (selectedItem) {
                fItemName.value = selectedItem.name;
                fItemType.value = selectedItem.type || 'weapon';
                fItemDesc.value = selectedItem.description || '';
                // Use fallback properties
                fItemPower.value = selectedItem.bonusAtk || selectedItem.bonusDef || selectedItem.heal || selectedItem.passiveAtk || 5;
            }
        };

        fHasItem.onchange = () => {
            const isChecked = fHasItem.checked;
            itemSubContainer.style.display = isChecked ? 'flex' : 'none';
            if (isChecked) {
                populateBankItemSelect();
            }
        };

        formSection.appendChild(itemSubContainer);

        // Action Buttons Row for Composer Control
        const composerActionsRow = document.createElement('div');
        composerActionsRow.style.display = 'flex';
        composerActionsRow.style.gap = '4px';
        composerActionsRow.style.marginTop = '8px';
        composerActionsRow.style.width = '100%';
        composerActionsRow.style.alignItems = 'center';

        // Action Save Button for blocks UI
        const btnSaveForm = document.createElement('button');
        btnSaveForm.textContent = '💾 Save';
        btnSaveForm.style.flex = '1.2';
        btnSaveForm.style.backgroundColor = '#27ae60';
        btnSaveForm.style.color = 'white';
        btnSaveForm.style.border = 'none';
        btnSaveForm.style.height = '28px';
        btnSaveForm.style.borderRadius = '4px';
        btnSaveForm.style.cursor = 'pointer';
        btnSaveForm.style.fontWeight = 'bold';
        btnSaveForm.style.fontSize = '11px';
        btnSaveForm.onclick = () => {
            const titleVal = fTitle.value.trim();
            const idVal = fId.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
            if (!titleVal || !idVal) {
                CustomDialog.alert('Quest Title and Unique ID Slug are required to compile.', 'Input Error');
                return;
            }

            const questObj = {
                id: idVal,
                title: titleVal,
                description: fDesc.value.trim(),
                npcName: fNpcName.value.trim() || 'Hero',
                npcBroadType: fNpcType.value,
                type: fType.value,
                target: fTarget.value.trim() || 'Slime',
                targetCount: parseInt(fCount.value, 10) || 1,
                rewardGold: parseInt(fGold.value, 10) || 0
            };

            if (fHasItem.checked) {
                const itemName = fItemName.value.trim() || 'Mystic Token';
                const itemType = fItemType.value;
                const powerVal = parseInt(fItemPower.value, 10) || 1;
                questObj.rewardItem = {
                    name: itemName,
                    type: itemType,
                    description: fItemDesc.value.trim() || `${itemName} awarded for completing quest.`,
                    value: powerVal * 15
                };
                if (itemType === 'weapon') {
                    questObj.rewardItem.bonusAtk = powerVal;
                } else if (itemType === 'shield' || itemType === 'armor') {
                    questObj.rewardItem.bonusDef = powerVal;
                } else if (itemType === 'consumable') {
                    questObj.rewardItem.heal = powerVal;
                }
            }

            // Put compiled JSON into raw editor
            textarea.value = JSON.stringify([questObj], null, 2);

            // Import automatically!
            const importRes = this.engine.questSystem.importQuestline(textarea.value);
            if (importRes.success) {
                CustomDialog.alert(`Successfully built and loaded Quest "${questObj.title}"! Talk to ${questObj.npcName} to receive this quest!`, "Quest Compiled");
                this.refreshLedgerList();
            } else {
                CustomDialog.alert(`Import failed: ${importRes.error}`, "Syntax Error");
            }
        };
        composerActionsRow.appendChild(btnSaveForm);

        // Export Quest Button
        const btnExportQuest = document.createElement('button');
        btnExportQuest.textContent = '📤 Export';
        btnExportQuest.style.flex = '1';
        btnExportQuest.style.backgroundColor = '#2980b9';
        btnExportQuest.style.color = '#fff';
        btnExportQuest.style.border = 'none';
        btnExportQuest.style.height = '28px';
        btnExportQuest.style.borderRadius = '4px';
        btnExportQuest.style.cursor = 'pointer';
        btnExportQuest.style.fontWeight = 'bold';
        btnExportQuest.style.fontSize = '11px';
        btnExportQuest.onclick = () => {
            const titleVal = fTitle.value.trim();
            const idVal = fId.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
            if (!titleVal || !idVal) {
                CustomDialog.alert('Quest Title and Unique ID Slug are required to export.', 'Input Error');
                return;
            }
            const questObj = {
                id: idVal,
                title: titleVal,
                description: fDesc.value.trim(),
                npcName: fNpcName.value.trim() || 'Hero',
                npcBroadType: fNpcType.value,
                type: fType.value,
                target: fTarget.value.trim() || 'Slime',
                targetCount: parseInt(fCount.value, 10) || 1,
                rewardGold: parseInt(fGold.value, 10) || 0
            };
            if (fHasItem.checked) {
                const itemName = fItemName.value.trim() || 'Mystic Token';
                const itemType = fItemType.value;
                const powerVal = parseInt(fItemPower.value, 10) || 1;
                questObj.rewardItem = {
                    name: itemName,
                    type: itemType,
                    description: fItemDesc.value.trim() || `${itemName} awarded for completing quest.`,
                    value: powerVal * 15
                };
                if (itemType === 'weapon') {
                    questObj.rewardItem.bonusAtk = powerVal;
                } else if (itemType === 'shield' || itemType === 'armor') {
                    questObj.rewardItem.bonusDef = powerVal;
                } else if (itemType === 'consumable') {
                    questObj.rewardItem.heal = powerVal;
                }
            }
            const blob = new Blob([JSON.stringify(questObj, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `quest_${idVal}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };
        composerActionsRow.appendChild(btnExportQuest);

        // Import Quest Button
        const questFileInputId = 'rpg-quest-editor-single-import';
        const fileInputQuest = document.createElement('input');
        fileInputQuest.id = questFileInputId;
        fileInputQuest.type = 'file';
        fileInputQuest.accept = '.json';
        fileInputQuest.style.display = 'none';
        fileInputQuest.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const imported = JSON.parse(evt.target.result);
                    const questObj = Array.isArray(imported) ? imported[0] : imported;
                    if (!questObj || !questObj.id || !questObj.title) {
                        CustomDialog.alert("JSON does not appear to be a valid Quest configuration.", "Import Quest");
                        return;
                    }
                    fTitle.value = questObj.title || '';
                    fId.value = questObj.id || '';
                    fNpcName.value = questObj.npcName || '';
                    fNpcType.value = questObj.npcBroadType || 'villager';
                    fType.value = questObj.type || 'slay';
                    fTarget.value = questObj.target || '';
                    fCount.value = questObj.targetCount || '1';
                    fDesc.value = questObj.description || '';
                    fGold.value = questObj.rewardGold || '0';

                    if (questObj.rewardItem) {
                        fHasItem.checked = true;
                        itemSubContainer.style.display = 'flex';
                        populateBankItemSelect();
                        fItemName.value = questObj.rewardItem.name || '';
                        fItemType.value = questObj.rewardItem.type || 'weapon';
                        fItemDesc.value = questObj.rewardItem.description || '';
                        fItemPower.value = questObj.rewardItem.bonusAtk || questObj.rewardItem.bonusDef || questObj.rewardItem.heal || '5';
                    } else {
                        fHasItem.checked = false;
                        itemSubContainer.style.display = 'none';
                    }
                    CustomDialog.alert(`Quest "${questObj.title}" loaded into composer! Make changes and click 'Build & Load Quest' to register!`, "Quest Loaded");
                } catch(err) {
                    console.error(err);
                    CustomDialog.alert("Could not load Quest JSON: File format is corrupted.", "Import Quest");
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        };
        composerActionsRow.appendChild(fileInputQuest);

        const labelImportQuest = document.createElement('label');
        labelImportQuest.htmlFor = questFileInputId;
        labelImportQuest.textContent = '📥 Import';
        labelImportQuest.style.flex = '1';
        labelImportQuest.style.display = 'inline-block';
        labelImportQuest.style.textAlign = 'center';
        labelImportQuest.style.cursor = 'pointer';
        labelImportQuest.style.backgroundColor = '#8c765c';
        labelImportQuest.style.color = 'white';
        labelImportQuest.style.border = '1px solid #5A4B3E';
        labelImportQuest.style.height = '28px';
        labelImportQuest.style.lineHeight = '26px';
        labelImportQuest.style.borderRadius = '4px';
        labelImportQuest.style.fontWeight = 'bold';
        labelImportQuest.style.fontSize = '11px';
        labelImportQuest.style.boxSizing = 'border-box';
        labelImportQuest.style.margin = '0';
        labelImportQuest.style.padding = '0';
        composerActionsRow.appendChild(labelImportQuest);

        const btnDeleteQuest = document.createElement('button');
        btnDeleteQuest.textContent = '🗑️';
        btnDeleteQuest.style.flex = '0.4';
        btnDeleteQuest.style.backgroundColor = '#c0392b';
        btnDeleteQuest.style.color = 'white';
        btnDeleteQuest.style.border = 'none';
        btnDeleteQuest.style.height = '28px';
        btnDeleteQuest.style.borderRadius = '4px';
        btnDeleteQuest.style.cursor = 'pointer';
        btnDeleteQuest.style.display = 'flex';
        btnDeleteQuest.style.alignItems = 'center';
        btnDeleteQuest.style.justifyContent = 'center';
        btnDeleteQuest.style.fontWeight = 'bold';
        btnDeleteQuest.onclick = () => {
            const idVal = fId.value.trim().toLowerCase();
            if (!idVal) {
                // Just clear form fields
                fTitle.value = '';
                fId.value = '';
                fNpcName.value = '';
                fDesc.value = '';
                fGold.value = '50';
                fCount.value = '1';
                fHasItem.checked = false;
                itemSubContainer.style.display = 'none';
                return;
            }
            CustomDialog.confirm(`Delete Quest "${idVal}" from game memory campaigns?`, (yes) => {
                if (yes) {
                    if (this.engine.questSystem) {
                        this.engine.questSystem.availableQuests = this.engine.questSystem.availableQuests.filter(q => q.id !== idVal);
                        this.engine.questSystem.activeQuests = this.engine.questSystem.activeQuests.filter(q => q.id !== idVal);
                        this.engine.questSystem.completedQuests = this.engine.questSystem.completedQuests.filter(q => q.id !== idVal);
                    }
                    this.refreshLedgerList();
                    fTitle.value = '';
                    fId.value = '';
                    fNpcName.value = '';
                    fDesc.value = '';
                    fGold.value = '50';
                    fCount.value = '1';
                    fHasItem.checked = false;
                    itemSubContainer.style.display = 'none';
                    CustomDialog.alert(`Quest "${idVal}" deleted.`, "Quest Deleted");
                }
            });
        };
        composerActionsRow.appendChild(btnDeleteQuest);

        formSection.appendChild(composerActionsRow);
        content.appendChild(formSection);

        // --- JSON Import/Export Workspace Section (Advanced Collapsible) ---
        const jsonHeader = document.createElement('div');
        jsonHeader.style.display = 'flex';
        jsonHeader.style.justifyContent = 'space-between';
        jsonHeader.style.alignItems = 'center';
        jsonHeader.style.cursor = 'pointer';
        jsonHeader.style.borderBottom = '1px solid #5A4B3E';
        jsonHeader.style.paddingBottom = '4px';
        jsonHeader.style.marginBottom = '6px';
        
        const jsonTitle = document.createElement('h4');
        jsonTitle.textContent = 'Advanced Code Workspace';
        jsonTitle.style.margin = '0';
        jsonHeader.appendChild(jsonTitle);

        const expandSign = document.createElement('span');
        expandSign.textContent = '[ Expand ]';
        expandSign.style.fontSize = '0.75em';
        expandSign.style.color = '#8C6D56';
        jsonHeader.appendChild(expandSign);

        const jsonSection = document.createElement('div');
        jsonSection.className = 'quest-editor-section';
        jsonSection.appendChild(jsonHeader);

        const jsonInner = document.createElement('div');
        jsonInner.style.display = 'none';
        jsonInner.style.flexDirection = 'column';
        jsonInner.style.gap = '4px';

        jsonHeader.onclick = () => {
            const isColl = jsonInner.style.display === 'none';
            jsonInner.style.display = isColl ? 'flex' : 'none';
            expandSign.textContent = isColl ? '[ Collapse ]' : '[ Expand ]';
        };

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
        jsonInner.appendChild(textarea);

        // Buttons row
        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.gap = '5px';
        btnRow.style.marginTop = '4px';

        const btnImport = document.createElement('button');
        btnImport.textContent = 'Import JSON';
        btnImport.className = 'rpg-btn-buy';
        btnImport.style.flex = '1';
        btnImport.style.padding = '6px';
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
        btnExport.textContent = 'Export JSON';
        btnExport.className = 'rpg-btn-buy';
        btnExport.style.flex = '1';
        btnExport.style.padding = '6px';
        btnExport.onclick = () => {
            const data = this.engine.questSystem.exportQuests();
            textarea.value = data;
            CustomDialog.alert("All active and archived game lines have been exported successfully. Copy them from the text area.", "Quests Exported");
        };

        btnRow.appendChild(btnImport);
        btnRow.appendChild(btnExport);
        jsonInner.appendChild(btnRow);
        jsonSection.appendChild(jsonInner);
        content.appendChild(jsonSection);

        this.panel.appendChild(content);
        this.modalContentElement.appendChild(this.panel);

        // Bind quickloads to populate BOTH form & raw JSON
        presetSelect.onchange = (e) => {
            const val = e.target.value;
            if (val && this.presets[val]) {
                const questData = this.presets[val][0];
                textarea.value = JSON.stringify(this.presets[val], null, 2);

                // Populate individual form fields!
                fTitle.value = questData.title || '';
                fId.value = questData.id || '';
                fNpcName.value = questData.npcName || '';
                if (questData.npcBroadType) fNpcType.value = questData.npcBroadType;
                if (questData.type) fType.value = questData.type;
                fTarget.value = questData.target || '';
                fCount.value = questData.targetCount || '3';
                fDesc.value = questData.description || '';
                fGold.value = questData.rewardGold || '50';

                if (questData.rewardItem) {
                    fHasItem.checked = true;
                    itemSubContainer.style.display = 'flex';
                    populateBankItemSelect();
                    fItemName.value = questData.rewardItem.name || '';
                    fItemType.value = questData.rewardItem.type || 'weapon';
                    fItemDesc.value = questData.rewardItem.description || '';
                    fItemPower.value = questData.rewardItem.bonusAtk || questData.rewardItem.bonusDef || questData.rewardItem.heal || '5';
                } else {
                    fHasItem.checked = false;
                    itemSubContainer.style.display = 'none';
                }
            }
        };
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
