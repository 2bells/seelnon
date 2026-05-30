// JRPG Abilities Creator & Equipment Panel Manager
console.log("rpg/game/editor/abilities_editor.js loaded");

import CustomDialog from '../ui/custom_dialog.js';
import { getAllAbilities, saveCustomAbility, deleteCustomAbility } from '../combat/ability_system.js';
import { getAllProjectiles } from '../combat/projectiles.js';

class AbilitiesEditor {
    constructor(engine, modalContentElement) {
        this.engine = engine;
        this.modalContentElement = modalContentElement;
        this.isActive = false;
        this.panel = null;
        this.selectedAbilityId = 'slime_leap';
        
        // Form field references
        this.fields = {};
    }

    initUI() {
        if (this.panel) return;

        this.panel = document.createElement('div');
        this.panel.id = 'rpg-abilities-editor-panel';
        this.panel.style.display = 'none';

        const titleButton = document.createElement('button');
        titleButton.id = 'rpg-abilities-editor-toggle';
        titleButton.textContent = 'Abilities Creator';
        titleButton.onclick = () => this.panel.classList.toggle('collapsed');
        this.panel.appendChild(titleButton);

        const content = document.createElement('div');
        content.id = 'rpg-abilities-editor-content';

        // --- SECTION 1: Selector / Create Tool ---
        const selectorSection = document.createElement('div');
        selectorSection.className = 'abilities-editor-section';
        selectorSection.innerHTML = '<h4>Select or Create Ability</h4>';

        const selRow = document.createElement('div');
        selRow.style.display = 'flex';
        selRow.style.gap = '6px';
        selRow.style.marginBottom = '8px';

        const abilitySelect = document.createElement('select');
        abilitySelect.id = 'rpg-ability-editor-select';
        abilitySelect.style.flex = '1';
        abilitySelect.style.padding = '5px';
        abilitySelect.style.backgroundColor = '#3B322C';
        abilitySelect.style.color = '#EFEBE0';
        abilitySelect.style.border = '1px solid #8C6D56';
        abilitySelect.style.borderRadius = '4px';
        abilitySelect.onchange = (e) => {
            this.selectedAbilityId = e.target.value;
            this.loadAbilityIntoForm();
        };
        selRow.appendChild(abilitySelect);
        this.abilitySelectDropdown = abilitySelect;

        const btnNew = document.createElement('button');
        btnNew.textContent = '+ New';
        btnNew.className = 'abilities-btn';
        btnNew.onclick = () => this.createNewAbilityTemplate();
        selRow.appendChild(btnNew);

        selectorSection.appendChild(selRow);
        content.appendChild(selectorSection);

        // --- SECTION 2: Hitbox Live Preview Canvas ---
        const previewSection = document.createElement('div');
        previewSection.className = 'abilities-editor-section';
        previewSection.innerHTML = '<h4>Hitbox Vector Graph</h4>';

        const previewCanvas = document.createElement('canvas');
        previewCanvas.id = 'rpg-ability-hitbox-canvas';
        previewCanvas.width = 296;
        previewCanvas.height = 110;
        previewCanvas.style.backgroundColor = '#251E1A';
        previewCanvas.style.border = '1px solid #5A4B3E';
        previewCanvas.style.borderRadius = '4px';
        previewCanvas.style.display = 'block';
        previewSection.appendChild(previewCanvas);

        const indicatorDiv = document.createElement('div');
        indicatorDiv.id = 'rpg-ability-preview-hud';
        indicatorDiv.style.display = 'flex';
        indicatorDiv.style.justifyContent = 'space-between';
        indicatorDiv.style.alignItems = 'center';
        indicatorDiv.style.background = '#2C2420';
        indicatorDiv.style.border = '1px dashed #5A4B3E';
        indicatorDiv.style.padding = '4px 8px';
        indicatorDiv.style.marginTop = '4px';
        indicatorDiv.style.borderRadius = '3px';
        indicatorDiv.style.fontSize = '9px';
        indicatorDiv.style.fontWeight = 'bold';
        indicatorDiv.style.fontFamily = 'monospace';
        indicatorDiv.style.color = '#EFEBE0';
        
        const phaseSpan = document.createElement('span');
        phaseSpan.id = 'rpg-ability-preview-phase';
        phaseSpan.textContent = 'PHASE: STANDBY IDLE';
        phaseSpan.style.color = '#ffaa00';
        indicatorDiv.appendChild(phaseSpan);

        const timeSpan = document.createElement('span');
        timeSpan.id = 'rpg-ability-preview-time';
        timeSpan.textContent = 'TIME: 0.00s';
        timeSpan.style.color = '#D4C8A0';
        indicatorDiv.appendChild(timeSpan);

        previewSection.appendChild(indicatorDiv);

        this.ctxPreview = previewCanvas.getContext('2d');
        this.previewCanvas = previewCanvas;

        content.appendChild(previewSection);

        // --- SECTION 3: General Parameters Form ---
        const formSection = document.createElement('div');
        formSection.className = 'abilities-editor-section';
        formSection.innerHTML = '<h4>Ability Attributes</h4>';

        const makeRow = (label, inputType, key, props = {}) => {
            const row = document.createElement('div');
            row.className = 'abilities-form-row';
            
            const lbl = document.createElement('label');
            lbl.textContent = label;
            row.appendChild(lbl);

            let input;
            if (inputType === 'select') {
                input = document.createElement('select');
                if (props.options) {
                    props.options.forEach(o => {
                        const opt = document.createElement('option');
                        opt.value = o.value;
                        opt.textContent = o.text;
                        input.appendChild(opt);
                    });
                }
            } else if (inputType === 'checkbox') {
                input = document.createElement('input');
                input.type = 'checkbox';
            } else {
                input = document.createElement('input');
                input.type = inputType;
                if (props.step) input.step = props.step;
                if (props.min !== undefined) input.min = props.min;
            }

            input.id = `rpg-ability-field-${key}`;
            input.oninput = () => {
                this.updateFormPreview();
            };
            if (inputType === 'select') {
                input.onchange = () => {
                    this.updateFormPreview();
                };
            }
            row.appendChild(input);
            this.fields[key] = input;
            return row;
        };

        // Populate fields
        formSection.appendChild(makeRow('Ability Name', 'text', 'name'));
        formSection.appendChild(makeRow('ID Slug', 'text', 'id_slug'));
        formSection.appendChild(makeRow('Cooldown (s)', 'number', 'cooldown', { step: 0.1, min: 0 }));
        formSection.appendChild(makeRow('Max Range (px)', 'number', 'range', { step: 5, min: 20 }));
        formSection.appendChild(makeRow('Cast Target', 'select', 'targetType', {
            options: [
                { value: 'closest_enemy', text: 'Closest Enemy' },
                { value: 'direction_mouse', text: 'Towards Mouse' }
            ]
        }));
        formSection.appendChild(makeRow('Sells HP (cost)', 'number', 'costHp', { step: 1, min: 0 }));
        formSection.appendChild(makeRow('Siphons HP (heal)', 'number', 'healing', { step: 1, min: 0 }));

        content.appendChild(formSection);

        // --- SECTION 4: Startup Phase Parameters Form ---
        const startupSection = document.createElement('div');
        startupSection.className = 'abilities-editor-section';
        startupSection.innerHTML = '<h4>1. Startup Phase (Animation / Leap)</h4>';
        startupSection.appendChild(makeRow('Startup (s)', 'number', 'startup_duration', { step: 0.05, min: 0.05 }));
        startupSection.appendChild(makeRow('Lock WASD?', 'checkbox', 'startup_lockMovement'));
        startupSection.appendChild(makeRow('Lock Turn?', 'checkbox', 'startup_lockTurn'));
        startupSection.appendChild(makeRow('No Collisions?', 'checkbox', 'startup_disableCollision'));
        startupSection.appendChild(makeRow('Speed (px/s)', 'number', 'startup_dashSpeed', { step: 10, min: 0 }));
        startupSection.appendChild(makeRow('Leap Height (px)', 'number', 'startup_jumpHeight', { step: 5, min: 0 }));
        content.appendChild(startupSection);

        // --- SECTION 5: Active Phase Parameters Form ---
        const activeSection = document.createElement('div');
        activeSection.className = 'abilities-editor-section';
        activeSection.innerHTML = '<h4>2. Active Phase (Hitbox / Damage)</h4>';
        activeSection.appendChild(makeRow('Active (s)', 'number', 'active_duration', { step: 0.05, min: 0.05 }));
        activeSection.appendChild(makeRow('Damage', 'number', 'active_damage', { step: 1, min: 0 }));
        activeSection.appendChild(makeRow('Knockback', 'number', 'active_knockbackForce', { step: 10, min: 0 }));
        activeSection.appendChild(makeRow('Hit shape', 'select', 'active_hitboxType', {
            options: [
                { value: 'ellipse', text: 'Isometric Ellipse' },
                { value: 'circle', text: 'Radial Circle' },
                { value: 'rectangle', text: 'AABB Rectangle' }
            ]
        }));
        activeSection.appendChild(makeRow('Shape Width / R_X', 'number', 'active_hitboxRX', { step: 5, min: 5 }));
        activeSection.appendChild(makeRow('Shape Height / R_Y', 'number', 'active_hitboxRY', { step: 5, min: 5 }));
        activeSection.appendChild(makeRow('Create Rock Wall?', 'checkbox', 'active_createObstacle'));
        content.appendChild(activeSection);

        // --- SECTION 6: Recovery Phase Parameters Form ---
        const recoverySection = document.createElement('div');
        recoverySection.className = 'abilities-editor-section';
        recoverySection.innerHTML = '<h4>3. Recovery Phase (Winddown / Slide)</h4>';
        recoverySection.appendChild(makeRow('Recovery (s)', 'number', 'recovery_duration', { step: 0.05, min: 0.05 }));
        recoverySection.appendChild(makeRow('Lock WASD?', 'checkbox', 'recovery_lockMovement'));
        recoverySection.appendChild(makeRow('Lock Turn?', 'checkbox', 'recovery_lockTurn'));
        recoverySection.appendChild(makeRow('Slide Speed (px/s)', 'number', 'recovery_slideSpeed', { step: 10 }));
        content.appendChild(recoverySection);

        // --- SECTION 6.5: Projectile Emitter Attachment ---
        const bSection = document.createElement('div');
        bSection.className = 'abilities-editor-section';
        bSection.innerHTML = '<h4>⚡ Projectile Emitter Attachment</h4>';
        bSection.appendChild(makeRow('Attach Emitter?', 'checkbox', 'emitter_enabled'));
        bSection.appendChild(makeRow('Link Preset', 'select', 'emitter_presetId', { options: [] }));
        bSection.appendChild(makeRow('Projectile Type', 'select', 'emitter_type', {
            options: [
                { value: 'standard', text: 'Standard Linear' },
                { value: 'seeking', text: 'Seeking / Homing' },
                { value: 'circular', text: 'Circular Spiral' },
                { value: 'sinewave', text: 'Sine Wave Oscillation' },
                { value: 'starburst', text: 'Starburst Ring' }
            ]
        }));
        bSection.appendChild(makeRow('Spars/Nova Bullets', 'number', 'emitter_burstCount', { step: 1, min: 1 }));
        bSection.appendChild(makeRow('Emitter Speed', 'number', 'emitter_speed', { step: 10, min: 10 }));
        bSection.appendChild(makeRow('Emitter Damage', 'number', 'emitter_damage', { step: 1, min: 1 }));
        bSection.appendChild(makeRow('Spars Color Hex', 'text', 'emitter_color'));
        content.appendChild(bSection);

        // --- SECTION 7: Workspace Actions ---
        const actionsSection = document.createElement('div');
        actionsSection.className = 'abilities-editor-section';
        actionsSection.style.borderBottom = 'none';

        const actionBtns = document.createElement('div');
        actionBtns.style.display = 'flex';
        actionBtns.style.gap = '4px';
        actionBtns.style.marginTop = '4px';
        actionBtns.style.width = '100%';
        actionBtns.style.alignItems = 'center';

        const btnSave = document.createElement('button');
        btnSave.textContent = '💾 Save';
        btnSave.className = 'abilities-btn';
        btnSave.style.flex = '1.2';
        btnSave.style.height = '28px';
        btnSave.style.padding = '0 6px';
        btnSave.style.fontSize = '11px';
        btnSave.onclick = () => this.saveCurrentFormToLibrary();
        actionBtns.appendChild(btnSave);

        const btnExport = document.createElement('button');
        btnExport.textContent = '📤 Export';
        btnExport.className = 'abilities-btn';
        btnExport.style.flex = '1';
        btnExport.style.height = '28px';
        btnExport.style.padding = '0 6px';
        btnExport.style.fontSize = '11px';
        btnExport.style.backgroundColor = '#2980b9';
        btnExport.style.borderColor = '#1f618d';
        btnExport.onclick = () => this.exportCurrentAbility();
        actionBtns.appendChild(btnExport);

        const abFileId = 'rpg-ability-editor-import-input';
        const fileInput = document.createElement('input');
        fileInput.id = abFileId;
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        fileInput.onchange = (e) => this.importAbilityFile(e);
        actionBtns.appendChild(fileInput);

        const labelImport = document.createElement('label');
        labelImport.htmlFor = abFileId;
        labelImport.textContent = '📥 Import';
        labelImport.className = 'abilities-btn';
        labelImport.style.flex = '1';
        labelImport.style.display = 'inline-block';
        labelImport.style.textAlign = 'center';
        labelImport.style.cursor = 'pointer';
        labelImport.style.backgroundColor = '#8c765c';
        labelImport.style.borderColor = '#5A4B3E';
        labelImport.style.lineHeight = '26px';
        labelImport.style.fontSize = '11px';
        labelImport.style.height = '28px';
        labelImport.style.boxSizing = 'border-box';
        labelImport.style.margin = '0';
        labelImport.style.padding = '0';
        actionBtns.appendChild(labelImport);

        const btnDel = document.createElement('button');
        btnDel.textContent = '🗑️';
        btnDel.className = 'abilities-btn-danger';
        btnDel.style.flex = '0.4';
        btnDel.style.height = '28px';
        btnDel.style.padding = '0';
        btnDel.style.fontSize = '12px';
        btnDel.style.display = 'flex';
        btnDel.style.alignItems = 'center';
        btnDel.style.justifyContent = 'center';
        btnDel.onclick = () => this.deleteSelectedAbility();
        actionBtns.appendChild(btnDel);

        actionsSection.appendChild(actionBtns);
        content.appendChild(actionsSection);

        this.panel.appendChild(content);
        this.modalContentElement.appendChild(this.panel);

        // Draw active outline initially
        this.loadAbilityIntoForm();
        if (!this.animationLoopStarted) {
            this.startPreviewAnimationLoop();
        }
    }

    show() {
        this.initUI();
        this.panel.style.display = 'flex';
        this.isActive = true;
        this.refreshAbilityDropdown();
        this.loadAbilityIntoForm();
    }

    hide() {
        if (this.panel) {
            this.panel.style.display = 'none';
        }
        this.isActive = false;
    }

    refreshAbilityDropdown() {
        if (!this.abilitySelectDropdown) return;

        // Keep index
        const currentSelectedVal = this.selectedAbilityId;
        this.abilitySelectDropdown.innerHTML = '';

        const abilitiesList = getAllAbilities();
        for (const key in abilitiesList) {
            const ab = abilitiesList[key];
            const opt = document.createElement('option');
            opt.value = ab.id;
            opt.textContent = ab.name;
            this.abilitySelectDropdown.appendChild(opt);
        }

        // Reselect
        if (abilitiesList[currentSelectedVal]) {
            this.abilitySelectDropdown.value = currentSelectedVal;
        } else {
            this.selectedAbilityId = Object.keys(abilitiesList)[0] || '';
            this.abilitySelectDropdown.value = this.selectedAbilityId;
        }
    }

    loadAbilityIntoForm() {
        const list = getAllAbilities();
        const ab = list[this.selectedAbilityId];
        if (!ab) return;

        // Populate fields
        this.fields.name.value = ab.name || '';
        this.fields.id_slug.value = ab.id || '';
        this.fields.id_slug.disabled = ['slime_leap', 'dash_strike', 'blood_siphon', 'earth_wall'].includes(ab.id);
        
        this.fields.cooldown.value = ab.cooldown || 0;
        this.fields.range.value = ab.range || 100;
        this.fields.targetType.value = ab.targetType || 'closest_enemy';
        this.fields.costHp.value = ab.costHp || 0;
        this.fields.healing.value = ab.healing || 0;

        // Startup params
        const st = ab.startup || {};
        this.fields.startup_duration.value = st.duration || 0.4;
        this.fields.startup_lockMovement.checked = !!st.lockMovement;
        this.fields.startup_lockTurn.checked = !!st.lockTurn;
        this.fields.startup_disableCollision.checked = !!st.disableCollision;
        this.fields.startup_dashSpeed.value = st.dashSpeed || 0;
        this.fields.startup_jumpHeight.value = st.jumpHeight || 0;

        // Active params
        const ac = ab.active || {};
        this.fields.active_duration.value = ac.duration || 0.2;
        this.fields.active_damage.value = ac.damage || 0;
        this.fields.active_knockbackForce.value = ac.knockbackForce || 0;
        const sh = ac.hitboxShape || { type: 'ellipse', radiusX: 30, radiusY: 15 };
        this.fields.active_hitboxType.value = sh.type || 'ellipse';
        this.fields.active_hitboxRX.value = sh.radiusX || sh.width || 30;
        this.fields.active_hitboxRY.value = sh.radiusY || sh.height || 15;
        this.fields.active_createObstacle.checked = !!ac.createObstacle;

        // Recovery params
        const rc = ab.recovery || {};
        this.fields.recovery_duration.value = rc.duration || 0.4;
        this.fields.recovery_lockMovement.checked = !!rc.lockMovement;
        this.fields.recovery_lockTurn.checked = !!rc.lockTurn;
        this.fields.recovery_slideSpeed.value = rc.slideSpeed || 0;

        // Emitter params
        const em = ab.emitterConfig || {};
        this.fields.emitter_enabled.checked = !!ab.hasEmitter;

        // Populate Emitter Preset select dropdown dynamically
        const presetSelect = this.fields.emitter_presetId;
        if (presetSelect) {
            presetSelect.innerHTML = '<option value="">-- Manual (Raw Fields) --</option>';
            const presets = getAllProjectiles();
            Object.keys(presets).forEach(k => {
                const opt = document.createElement('option');
                opt.value = k;
                opt.textContent = presets[k].name;
                presetSelect.appendChild(opt);
            });
            presetSelect.value = em.presetId || '';
        }

        this.fields.emitter_type.value = em.projectileType || 'standard';
        this.fields.emitter_burstCount.value = em.burstCount || 1;
        this.fields.emitter_speed.value = em.projectileSpeed || 160;
        this.fields.emitter_damage.value = em.damage || 15;
        this.fields.emitter_color.value = em.projectileColor || '#ff3333';

        this.updateFormPreview();
    }

    // Capture values from Form and build standard config
    getSelectedAbilityConfig() {
        const id = this.fields.id_slug.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        const name = this.fields.name.value.trim() || 'New Ability';

        const config = {
            id: id || `custom_${Date.now()}`,
            name: name,
            cooldown: parseFloat(this.fields.cooldown.value) || 0,
            range: parseFloat(this.fields.range.value) || 100,
            targetType: this.fields.targetType.value,
            costHp: parseInt(this.fields.costHp.value, 10) || 0,
            healing: parseInt(this.fields.healing.value, 10) || 0,
            startup: {
                duration: parseFloat(this.fields.startup_duration.value) || 0.4,
                lockMovement: this.fields.startup_lockMovement.checked,
                lockTurn: this.fields.startup_lockTurn.checked,
                disableCollision: this.fields.startup_disableCollision.checked,
                dashSpeed: parseFloat(this.fields.startup_dashSpeed.value) || 0,
                jumpHeight: parseFloat(this.fields.startup_jumpHeight.value) || 0,
                hpChange: -(parseInt(this.fields.costHp.value, 10) || 0)
            },
            active: {
                duration: parseFloat(this.fields.active_duration.value) || 0.2,
                damage: parseInt(this.fields.active_damage.value, 10) || 0,
                knockbackForce: parseFloat(this.fields.active_knockbackForce.value) || 0,
                hpChange: 0,
                healing: parseInt(this.fields.healing.value, 10) || 0,
                hitboxShape: {
                    type: this.fields.active_hitboxType.value,
                    radiusX: parseFloat(this.fields.active_hitboxRX.value) || 30,
                    radiusY: parseFloat(this.fields.active_hitboxRY.value) || 15,
                    width: parseFloat(this.fields.active_hitboxRX.value) * 2,
                    height: parseFloat(this.fields.active_hitboxRY.value) * 2
                },
                createObstacle: this.fields.active_createObstacle.checked
            },
            recovery: {
                duration: parseFloat(this.fields.recovery_duration.value) || 0.4,
                lockMovement: this.fields.recovery_lockMovement.checked,
                lockTurn: this.fields.recovery_lockTurn.checked,
                slideSpeed: parseFloat(this.fields.recovery_slideSpeed.value) || 0
            },
            hasEmitter: this.fields.emitter_enabled.checked,
            emitterConfig: {
                presetId: this.fields.emitter_presetId.value || undefined,
                projectileType: this.fields.emitter_type.value,
                burstCount: parseInt(this.fields.emitter_burstCount.value, 10) || 1,
                projectileSpeed: parseInt(this.fields.emitter_speed.value, 10) || 160,
                damage: parseInt(this.fields.emitter_damage.value, 10) || 15,
                projectileColor: this.fields.emitter_color.value || '#ff3333'
            }
        };

        return config;
    }

    createNewAbilityTemplate() {
        const id = `custom_skill_${Math.floor(100 + Math.random() * 900)}`;
        const list = getAllAbilities();
        
        let templ = {
            id: id,
            name: "Super Strike",
            cooldown: 3.0,
            range: 120,
            targetType: 'direction_mouse',
            costHp: 0,
            healing: 0,
            startup: {
                duration: 0.3,
                lockMovement: true,
                lockTurn: false,
                disableCollision: false,
                dashSpeed: 200,
                jumpHeight: 25,
                hpChange: 0
            },
            active: {
                duration: 0.2,
                damage: 15,
                knockbackForce: 120,
                hpChange: 0,
                healing: 0,
                hitboxShape: { type: 'ellipse', radiusX: 45, radiusY: 22 },
                createObstacle: false
            },
            recovery: {
                duration: 0.5,
                lockMovement: true,
                lockTurn: true,
                slideSpeed: 0
            }
        };

        this.selectedAbilityId = id;
        saveCustomAbility(templ);
        this.refreshAbilityDropdown();
        this.loadAbilityIntoForm();
        this.notifyNpcSelectorRefresh();
        CustomDialog.alert(`Created new custom template ${templ.name}! Set fields and save!`, "Template Spawned");
    }

    saveCurrentFormToLibrary() {
        const valId = this.fields.id_slug.value.trim();
        if (!valId) {
            CustomDialog.alert("ID Slug is required for abilities registration.", "Validation Error");
            return;
        }

        const config = this.getSelectedAbilityConfig();
        saveCustomAbility(config);
        
        this.selectedAbilityId = config.id;
        this.refreshAbilityDropdown();
        this.loadAbilityIntoForm();
        this.notifyNpcSelectorRefresh();

        // Feed message
        CustomDialog.alert(`Action Ability "${config.name}" saved successfully to campaign settings!`, "Ability Saved");
    }

    deleteSelectedAbility() {
        const id = this.selectedAbilityId;
        if (['slime_leap', 'dash_strike', 'blood_siphon', 'earth_wall'].includes(id)) {
            CustomDialog.alert("Standard default abilities cannot be deleted.", "Restricted Action");
            return;
        }

        const confirmed = () => {
            deleteCustomAbility(id);
            this.selectedAbilityId = 'slime_leap';
            this.refreshAbilityDropdown();
            this.loadAbilityIntoForm();
            this.notifyNpcSelectorRefresh();
            CustomDialog.alert("Ability deleted successfully.", "Action Complete");
        };

        CustomDialog.confirm("Are you sure you want to permanently delete this custom ability from local settings?", "Confirm Delete").then(res => {
            if (res) confirmed();
        });
    }

    exportCurrentAbility() {
        const config = this.getSelectedAbilityConfig();
        const json = JSON.stringify(config, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fileName = (config.name || 'custom_ability').toLowerCase().replace(/[^a-z0-9]/gi, '_');
        a.download = `ability_${fileName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        CustomDialog.alert(`Export template for "${config.name}" downloaded!`, "Export Succeeded");
    }

    importAbilityFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (!importedData || !importedData.id || !importedData.name) {
                    CustomDialog.alert("JSON file does not appear to be a valid Custom Ability config. The file must contain both an 'id' and an 'name'.", "Import Failed");
                    return;
                }

                saveCustomAbility(importedData);
                this.selectedAbilityId = importedData.id;
                this.refreshAbilityDropdown();
                this.loadAbilityIntoForm();
                this.notifyNpcSelectorRefresh();
                
                CustomDialog.alert(`Successfully imported Custom Ability "${importedData.name}"!`, "Import Complete");
            } catch (err) {
                console.error(err);
                CustomDialog.alert("Could not load ability JSON: format is invalid.", "Import Error");
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    notifyNpcSelectorRefresh() {
        const npcEditor = this.engine.editorManager ? this.engine.editorManager.editors.npc : null;
        if (npcEditor && npcEditor.ui) {
            npcEditor.ui.refreshAbilityOptionDropdowns();
        }
    }

    equipSelectedOnSlot(slotIndex) {
        if (!this.engine.player) {
            CustomDialog.alert("Caster character is not spawned on map.", "Equip Failure");
            return;
        }

        const ability = getAllAbilities()[this.selectedAbilityId];
        if (!ability) return;

        // Equip onto slot (0, 1, 2, or 3)
        const idx = slotIndex - 1;
        this.engine.player.equippedAbilities[idx] = ability.id;
        
        CustomDialog.alert(`Successfully equipped "${ability.name}" on Slot ${slotIndex}! Try pressing key "${slotIndex}" during dynamic combat!`, "Ability Equipped");
        console.log(`Equipped slot ${slotIndex}:`, this.engine.player.equippedAbilities);
    }

    startPreviewAnimationLoop() {
        this.animationLoopStarted = true;
        this.animTime = 0;
        this.previewParticles = [];
        this.emitterFired = false;
        
        let lastTime = performance.now();
        const frame = (timestamp) => {
            if (!this.panel || this.panel.style.display === 'none') {
                requestAnimationFrame(frame);
                return;
            }
            const dt = Math.min((timestamp - lastTime) / 1000, 0.1); // cap dt to prevent huge jumps
            lastTime = timestamp;

            this.updatePreviewState(dt);
            this.updateFormPreview();

            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    }

    updatePreviewState(dt) {
        // Safe form value parsers
        const getVal = (name, fallback) => {
            const f = this.fields[name];
            return f ? parseFloat(f.value) || fallback : fallback;
        };

        const startup = getVal('startup_duration', 0.4);
        const active = getVal('active_duration', 0.2);
        const recovery = getVal('recovery_duration', 0.4);
        const cooldown = 1.0; // Rest interval

        const totalCycle = startup + active + recovery + cooldown;
        const prevAnimTime = this.animTime || 0;
        this.animTime = (prevAnimTime + dt) % totalCycle;

        // Reset particles if cycle restarted
        if (this.animTime < prevAnimTime) {
            this.previewParticles = [];
            this.emitterFired = false;
        }

        // Handle Projectile Emitter trigger exactly when Active Hitbox matches
        const hasEmitter = this.fields.emitter_enabled ? this.fields.emitter_enabled.checked : false;
        if (hasEmitter && !this.emitterFired && this.animTime >= startup && this.animTime < (startup + active)) {
            this.emitterFired = true;
            
            const w = this.previewCanvas.width;
            const h = this.previewCanvas.height;
            const cx = w / 2;
            const cy = h / 2 + 10;
            const targetOffsetScalar = 35;
            const tax = cx;
            const tay = cy - targetOffsetScalar; // impact core point

            const burstCount = parseInt(getVal('emitter_burstCount', 1), 10);
            const rawSpeed = getVal('emitter_speed', 160);
            const speed = rawSpeed * 0.45; // Scale speed down to canvas size
            const emitterType = this.fields.emitter_type ? this.fields.emitter_type.value : 'standard';
            const color = (this.fields.emitter_color && this.fields.emitter_color.value.trim()) || '#f1c40f';

            for (let i = 0; i < burstCount; i++) {
                const ang = -Math.PI / 2 + (i * Math.PI * 2 / burstCount);
                this.previewParticles.push({
                    startX: tax,
                    startY: tay,
                    x: tax,
                    y: tay,
                    angle: ang,
                    speed: speed,
                    type: emitterType,
                    color: color,
                    age: 0,
                    circularSpeed: 4,
                    radiusDistance: 0,
                    sinFrequency: 10,
                    sinAmplitude: 28
                });
            }
        }

        // Update active particles frame
        if (this.previewParticles) {
            this.previewParticles.forEach(p => {
                p.age += dt;
                if (p.type === 'standard') {
                    p.x += Math.cos(p.angle) * p.speed * dt;
                    p.y += Math.sin(p.angle) * p.speed * dt;
                } else if (p.type === 'seeking') {
                    // Drift/seek slightly to center of screen
                    const targetX = this.previewCanvas.width / 2;
                    const targetY = this.previewCanvas.height / 2 - 35;
                    const dx = targetX - p.x;
                    const dy = targetY - p.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist > 5) {
                        const seekAngle = Math.atan2(dy, dx);
                        p.angle += (seekAngle - p.angle) * 3 * dt;
                    }
                    p.x += Math.cos(p.angle) * p.speed * dt;
                    p.y += Math.sin(p.angle) * p.speed * dt;
                } else if (p.type === 'circular') {
                    p.angle += p.circularSpeed * dt;
                    p.radiusDistance += p.speed * dt;
                    p.x = p.startX + Math.cos(p.angle) * p.radiusDistance * 0.7;
                    p.y = p.startY + Math.sin(p.angle) * p.radiusDistance * 0.7;
                } else if (p.type === 'sinewave') {
                    p.radiusDistance += p.speed * dt;
                    const perpAngle = p.angle + Math.PI / 2;
                    const sineOffset = Math.sin(p.age * p.sinFrequency) * p.sinAmplitude;
                    const mainX = p.startX + Math.cos(p.angle) * p.radiusDistance;
                    const mainY = p.startY + Math.sin(p.angle) * p.radiusDistance;
                    p.x = mainX + Math.cos(perpAngle) * sineOffset * 0.5;
                    p.y = mainY + Math.sin(perpAngle) * sineOffset * 0.5;
                } else {
                    p.x += Math.cos(p.angle) * p.speed * dt;
                    p.y += Math.sin(p.angle) * p.speed * dt;
                }
            });
            this.previewParticles = this.previewParticles.filter(p => p.age < 1.6);
        }
    }

    // Redraws the hitbox shape preview with smooth real time cyclic animation loops
    updateFormPreview() {
        this.updateEmitterFieldsVisibility();
        if (!this.ctxPreview) return;

        const ctx = this.ctxPreview;
        const w = this.previewCanvas.width;
        const h = this.previewCanvas.height;

        // Clear and draw grid
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = '#2B231D';
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 15) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y < h; y += 15) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        const getVal = (name, fallback) => {
            const f = this.fields[name];
            return f ? parseFloat(f.value) || fallback : fallback;
        };

        const startup = getVal('startup_duration', 0.4);
        const active = getVal('active_duration', 0.2);
        const recovery = getVal('recovery_duration', 0.4);

        const cx = w / 2;
        const cy = h / 2 + 10;
        const targetOffsetScalar = 35;
        const tax = cx;
        const tay = cy - targetOffsetScalar; // impact point

        // Compute phases and caster location
        let phaseText = "STANDBY Idle";
        let casterX = cx;
        let casterY = cy;
        let casterRadius = 6;
        let casterColor = '#8C6D56';
        let isHitboxActive = false;
        let leapOffsetProgress = 0;

        const time = this.animTime || 0;

        // Leap/Jump variables
        const jumpHeight = getVal('startup_jumpHeight', 0);
        const dashSpeed = getVal('startup_dashSpeed', 0);
        const slideSpeed = getVal('recovery_slideSpeed', 0);
        let verticalJumpOffset = 0;

        if (time < startup) {
            phaseText = "STARTUP charging";
            casterColor = '#5D9CEC';
            const progressRatio = time / startup;
            
            // If dash speed is specified, slide closer to the target
            if (dashSpeed > 0) {
                leapOffsetProgress = Math.min(progressRatio * (dashSpeed / 100), 1.0);
                casterX = cx + (tax - cx) * leapOffsetProgress;
                casterY = cy + (tay - cy) * leapOffsetProgress;
            }

            // Calc parabole jump offset
            if (jumpHeight > 0) {
                verticalJumpOffset = Math.sin(progressRatio * Math.PI) * jumpHeight * 0.45;
            }

            // Draw a spinning charge aura around caster
            ctx.strokeStyle = 'rgba(93, 156, 236, 0.5)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(casterX, casterY, casterRadius + 6, time * 10, time * 10 + Math.PI * 1.5);
            ctx.stroke();
            ctx.setLineDash([]);
        } else if (time >= startup && time < (startup + active)) {
            phaseText = "ACTIVE hit release!";
            casterColor = '#e74c3c';
            casterX = tax;
            casterY = tay;
            isHitboxActive = true;
        } else if (time >= (startup + active) && time < (startup + active + recovery)) {
            phaseText = "RECOVERY winddown";
            casterColor = '#A0D468';
            const recoveryRatio = (time - (startup + active)) / recovery;
            
            // Recovery sliding recoil
            if (slideSpeed > 0) {
                const slideDist = (slideSpeed / 10) * recoveryRatio;
                casterX = tax;
                casterY = tay + slideDist;
            } else {
                casterX = tax;
                casterY = tay;
            }
        }

        // Draw Shadows first at caster base positions
        if (verticalJumpOffset > 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(casterX, casterY, casterRadius + 2, casterRadius/2 + 1, 0, 0, Math.PI*2);
            ctx.fill();
        }

        // Draw Caster body (incorporating jump arc height)
        ctx.fillStyle = casterColor;
        ctx.beginPath();
        ctx.arc(casterX, casterY - verticalJumpOffset, casterRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#EFEBE0';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText("Caster Code Unit", casterX, casterY - verticalJumpOffset - 10);

        // Draw Target Core Point
        ctx.fillStyle = 'rgba(231, 76, 60, 0.4)';
        ctx.beginPath();
        ctx.arc(tax, tay, 3, 0, Math.PI * 2);
        ctx.fill();

        // Draw skills limit range radius
        const range = getVal('range', 100);
        ctx.strokeStyle = 'rgba(140, 109, 86, 0.3)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        const drawScale = 0.45; 
        ctx.arc(cx, cy, range * drawScale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#8C6D56';
        ctx.fillText(`Range Area Limit Circle: ${range}px`, cx, cy + (range * drawScale) + 12);

        // Render Hitbox scan overlay if active
        if (isHitboxActive) {
            const shapeType = this.fields.active_hitboxType ? this.fields.active_hitboxType.value : 'ellipse';
            const rx = getVal('active_hitboxRX', 30);
            const ry = getVal('active_hitboxRY', 15);

            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#e74c3c';
            
            // Add a pulsating scale factor code
            const pulse = 0.9 + Math.sin(time * 30) * 0.1;
            ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';

            ctx.beginPath();
            if (shapeType === 'ellipse') {
                ctx.ellipse(tax, tay, rx * pulse, ry * pulse, 0, 0, Math.PI * 2);
            } else if (shapeType === 'circle') {
                ctx.arc(tax, tay, rx * pulse, 0, Math.PI * 2);
            } else {
                ctx.rect(tax - rx * pulse, tay - ry * pulse, rx * pulse * 2, ry * pulse * 2);
            }
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#e74c3c';
            ctx.font = 'bold 10px monospace';
            ctx.fillText("ACTIVE DAMAGE TRIGGER SCAN", tax, tay - ry * pulse - 8);

            // Obstacles grow visual
            if (this.fields.active_createObstacle && this.fields.active_createObstacle.checked) {
                ctx.fillStyle = '#967ADC';
                ctx.beginPath();
                ctx.moveTo(tax - 8, tay + 2);
                ctx.lineTo(tax, tay - 12);
                ctx.lineTo(tax + 8, tay + 2);
                ctx.fill();
            }
        }

        // Render projectiles particles
        if (this.previewParticles) {
            this.previewParticles.forEach(p => {
                ctx.fillStyle = p.color || '#f1c40f';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
                ctx.fill();
                
                // particle tail
                ctx.fillStyle = 'rgba(241, 196, 15, 0.2)';
                ctx.beginPath();
                ctx.arc(p.x - Math.cos(p.angle)*5, p.y - Math.sin(p.angle)*5, 2.5, 0, Math.PI*2);
                ctx.fill();
            });
        }

        // Update Bottom HUD elements instead of canvas texts to prevent occlusion
        const phaseUI = document.getElementById('rpg-ability-preview-phase');
        const timeUI = document.getElementById('rpg-ability-preview-time');
        if (phaseUI) phaseUI.textContent = `PHASE: ${phaseText.toUpperCase()}`;
        if (timeUI) timeUI.textContent = `TIME: ${time.toFixed(2)}s / Cycle`;
    }

    updateEmitterFieldsVisibility() {
        const hasEmitter = this.fields.emitter_enabled ? this.fields.emitter_enabled.checked : false;
        const presetId = this.fields.emitter_presetId ? this.fields.emitter_presetId.value : '';

        const presetRow = this.fields.emitter_presetId ? this.fields.emitter_presetId.parentElement : null;
        if (presetRow) {
            presetRow.style.display = hasEmitter ? 'flex' : 'none';
        }

        const manualKeys = [
            'emitter_type',
            'emitter_burstCount',
            'emitter_speed',
            'emitter_damage',
            'emitter_color'
        ];

        manualKeys.forEach(k => {
            const f = this.fields[k];
            if (f && f.parentElement) {
                f.parentElement.style.display = (hasEmitter && !presetId) ? 'flex' : 'none';
            }
        });
    }
}

export default AbilitiesEditor;
