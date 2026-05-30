// Projectile Creator & Interactive Bullet Hell Emitter Modeler
console.log("rpg/game/editor/projectile_creator.js loaded");

import CustomDialog from '../ui/custom_dialog.js';
import { getAllProjectiles, saveCustomProjectile, deleteCustomProjectile, Emitter } from '../combat/projectiles.js';
import { saveCustomAbility } from '../combat/ability_system.js';
import { saveCustomItem } from './item_editor.js';

class ProjectileCreator {
    constructor(engine, modalContentElement) {
        this.engine = engine;
        this.modalContentElement = modalContentElement;
        this.isActive = false;
        this.panel = null;
        this.selectedPresetId = 'spark_bullet';
        
        // Form field references
        this.fields = {};
        
        // Preview particle structures
        this.previewParticles = [];
        this.previewTimer = 0;
        this.targetDriftAngle = 0;
        this.spawnAccumulator = 0;
    }

    initUI() {
        if (this.panel) return;

        // Container panel
        this.panel = document.createElement('div');
        this.panel.id = 'rpg-projectile-editor-panel';
        this.panel.style.display = 'none';

        // Title / Header
        const titleButton = document.createElement('button');
        titleButton.id = 'rpg-projectile-editor-toggle';
        titleButton.textContent = 'Projectile Creator';
        titleButton.onclick = () => this.panel.classList.toggle('collapsed');
        this.panel.appendChild(titleButton);

        const content = document.createElement('div');
        content.id = 'rpg-projectile-editor-content';

        // --- SECTION 1: Selector / Template Trigger ---
        const selectorSection = document.createElement('div');
        selectorSection.className = 'abilities-editor-section';
        selectorSection.innerHTML = '<h4>Select or Create Projectile</h4>';

        const selRow = document.createElement('div');
        selRow.style.display = 'flex';
        selRow.style.gap = '6px';
        selRow.style.marginBottom = '8px';

        const presetSelect = document.createElement('select');
        presetSelect.id = 'rpg-projectile-editor-select';
        presetSelect.style.flex = '1';
        presetSelect.style.padding = '5px';
        presetSelect.style.backgroundColor = '#3B322C';
        presetSelect.style.color = '#EFEBE0';
        presetSelect.style.border = '1px solid #8C6D56';
        presetSelect.style.borderRadius = '4px';
        presetSelect.onchange = (e) => {
            this.selectedPresetId = e.target.value;
            this.loadPresetIntoForm();
        };
        selRow.appendChild(presetSelect);
        this.presetSelectDropdown = presetSelect;

        const btnNew = document.createElement('button');
        btnNew.textContent = '+ New';
        btnNew.className = 'abilities-btn';
        btnNew.style.backgroundColor = '#8C6D56';
        btnNew.style.color = '#FFFFFF';
        btnNew.style.border = 'none';
        btnNew.style.padding = '5px 12px';
        btnNew.style.borderRadius = '4px';
        btnNew.style.cursor = 'pointer';
        btnNew.onclick = () => this.createNewPresetTemplate();
        selRow.appendChild(btnNew);

        selectorSection.appendChild(selRow);
        content.appendChild(selectorSection);

        // --- SECTION 2: Interactive Vector Simulation Screen ---
        const previewSection = document.createElement('div');
        previewSection.className = 'abilities-editor-section';
        previewSection.innerHTML = '<h4>Interactive Trajectory Preview</h4>';

        const previewCanvas = document.createElement('canvas');
        previewCanvas.id = 'rpg-projectile-preview-canvas';
        previewCanvas.width = 296;
        previewCanvas.height = 140;
        previewCanvas.style.backgroundColor = '#251E1A';
        previewCanvas.style.border = '1px solid #5A4B3E';
        previewCanvas.style.borderRadius = '4px';
        previewCanvas.style.display = 'block';
        previewSection.appendChild(previewCanvas);
        this.ctxPreview = previewCanvas.getContext('2d');
        this.previewCanvas = previewCanvas;

        content.appendChild(previewSection);

        // --- SECTION 3: Visual & Render Parameters ---
        const visualFormSection = document.createElement('div');
        visualFormSection.className = 'abilities-editor-section';
        visualFormSection.innerHTML = '<h4>Visual Configurations</h4>';

        const makeRow = (label, inputType, key, props = {}) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'space-between';
            row.style.margin = '6px 0';
            row.style.gap = '8px';
            
            const lbl = document.createElement('label');
            lbl.textContent = label;
            lbl.style.fontSize = '0.85em';
            lbl.style.color = '#D4C8A0';
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

            input.id = `rpg-projectile-field-${key}`;
            input.style.background = '#3B322C';
            input.style.color = '#EFEBE0';
            input.style.border = '1px solid #8C6D56';
            input.style.borderRadius = '4px';
            input.style.padding = '4px';
            if (inputType === 'checkbox') {
                input.style.width = 'auto';
                input.style.cursor = 'pointer';
            } else {
                input.style.width = '140px';
                input.style.boxSizing = 'border-box';
            }

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

        visualFormSection.appendChild(makeRow('Preset Name', 'text', 'name'));
        visualFormSection.appendChild(makeRow('ID Slug', 'text', 'id'));
        visualFormSection.appendChild(makeRow('Render Mode', 'select', 'renderType', {
            options: [
                { value: 'glow', text: 'Glowing Core Spark' },
                { value: 'emoji', text: 'Classic Retro Emoji' }
            ]
        }));
        visualFormSection.appendChild(makeRow('Emoji Character', 'text', 'emoji'));
        visualFormSection.appendChild(makeRow('Glow color hex', 'text', 'color'));
        visualFormSection.appendChild(makeRow('Core Size (px)', 'number', 'radius', { step: 1, min: 2 }));

        content.appendChild(visualFormSection);

        // --- SECTION 4: Emitter & Movement Behaviors ---
        const emitterFormSection = document.createElement('div');
        emitterFormSection.className = 'abilities-editor-section';
        emitterFormSection.innerHTML = '<h4>Movement & Emitter Behaviors</h4>';

        emitterFormSection.appendChild(makeRow('Shooter Trajectory', 'select', 'emitterType', {
            options: [
                { value: 'standard', text: 'Standard Straight Shot' },
                { value: 'seeking', text: 'Smart Homings Target' },
                { value: 'circular', text: 'Orbital Spirals Core' },
                { value: 'sinewave', text: 'Oscillating Sine Wave' },
                { value: 'starburst', text: 'Starburst Ring Barrage' }
            ]
        }));
        emitterFormSection.appendChild(makeRow('Firing Interval (s)', 'number', 'cooldown', { step: 0.1, min: 0.05 }));
        emitterFormSection.appendChild(makeRow('Bullet Speed (px/s)', 'number', 'speed', { step: 10, min: 20 }));
        emitterFormSection.appendChild(makeRow('Bullets Per Shot', 'number', 'burstCount', { step: 1, min: 1 }));
        emitterFormSection.appendChild(makeRow('Bullet Damage HP', 'number', 'damage', { step: 1, min: 1 }));
        emitterFormSection.appendChild(makeRow('Max Discharge Range', 'number', 'range', { step: 10, min: 50 }));

        // Dynamic extra behavior modifiers
        emitterFormSection.appendChild(makeRow('Sine Osc Amplitude', 'number', 'sinAmplitude', { step: 5, min: 0 }));
        emitterFormSection.appendChild(makeRow('Sine Osc Frequency', 'number', 'sinFrequency', { step: 1, min: 1 }));
        emitterFormSection.appendChild(makeRow('Orbit Spiral Speed', 'number', 'circularSpeed', { step: 0.5, min: 0.1 }));

        content.appendChild(emitterFormSection);

        // --- SECTION 5: Controls & Core Spawning Mod ---
        const actionsSection = document.createElement('div');
        actionsSection.className = 'abilities-editor-section';
        actionsSection.style.display = 'flex';
        actionsSection.style.flexDirection = 'column';
        actionsSection.style.gap = '8px';

        const btnLootable = document.createElement('button');
        btnLootable.textContent = '⚔️ Generate Core Ability & Lootable Item!';
        btnLootable.style.backgroundColor = '#d35400';
        btnLootable.style.color = '#fff';
        btnLootable.style.border = '1px solid #e67e22';
        btnLootable.style.padding = '10px';
        btnLootable.style.borderRadius = '4px';
        btnLootable.style.fontWeight = 'bold';
        btnLootable.style.cursor = 'pointer';
        btnLootable.onclick = () => this.generateAbilityAndCoreLootItem();
        actionsSection.appendChild(btnLootable);

        const projIORow = document.createElement('div');
        projIORow.style.display = 'flex';
        projIORow.style.gap = '4px';
        projIORow.style.marginTop = '4px';
        projIORow.style.width = '100%';
        projIORow.style.alignItems = 'center';

        const btnSave = document.createElement('button');
        btnSave.textContent = '💾 Save';
        btnSave.style.backgroundColor = '#2c3e50';
        btnSave.style.color = '#fff';
        btnSave.style.border = '1px solid #34495e';
        btnSave.style.height = '28px';
        btnSave.style.fontSize = '11px';
        btnSave.style.flex = '1.2';
        btnSave.style.borderRadius = '4px';
        btnSave.style.fontWeight = 'bold';
        btnSave.style.cursor = 'pointer';
        btnSave.onclick = () => this.saveCurrentPreset();
        projIORow.appendChild(btnSave);

        const btnExportProj = document.createElement('button');
        btnExportProj.textContent = '📤 Export';
        btnExportProj.style.flex = '1';
        btnExportProj.style.backgroundColor = '#2980b9';
        btnExportProj.style.color = '#fff';
        btnExportProj.style.border = 'none';
        btnExportProj.style.height = '28px';
        btnExportProj.style.fontSize = '11px';
        btnExportProj.style.borderRadius = '4px';
        btnExportProj.style.fontWeight = 'bold';
        btnExportProj.style.cursor = 'pointer';
        btnExportProj.onclick = () => this.exportCurrentProjectile();
        projIORow.appendChild(btnExportProj);

        const projImportInputId = 'rpg-projectile-editor-single-import-input';
        const fileInputProj = document.createElement('input');
        fileInputProj.id = projImportInputId;
        fileInputProj.type = 'file';
        fileInputProj.accept = '.json';
        fileInputProj.style.display = 'none';
        fileInputProj.onchange = (e) => this.importProjectileFile(e);
        projIORow.appendChild(fileInputProj);

        const labelImportProj = document.createElement('label');
        labelImportProj.htmlFor = projImportInputId;
        labelImportProj.textContent = '📥 Import';
        labelImportProj.style.flex = '1';
        labelImportProj.style.display = 'inline-block';
        labelImportProj.style.textAlign = 'center';
        labelImportProj.style.cursor = 'pointer';
        labelImportProj.style.backgroundColor = '#8c765c';
        labelImportProj.style.color = '#fff';
        labelImportProj.style.border = '1px solid #5A4B3E';
        labelImportProj.style.height = '28px';
        labelImportProj.style.lineHeight = '26px';
        labelImportProj.style.borderRadius = '4px';
        labelImportProj.style.fontWeight = 'bold';
        labelImportProj.style.fontSize = '11px';
        labelImportProj.style.boxSizing = 'border-box';
        labelImportProj.style.margin = '0';
        labelImportProj.style.padding = '0';
        projIORow.appendChild(labelImportProj);

        const btnDel = document.createElement('button');
        btnDel.textContent = '🗑️';
        btnDel.style.backgroundColor = '#c0392b';
        btnDel.style.color = '#fff';
        btnDel.style.border = '1px solid #962d22';
        btnDel.style.height = '28px';
        btnDel.style.flex = '0.4';
        btnDel.style.borderRadius = '4px';
        btnDel.style.cursor = 'pointer';
        btnDel.style.fontWeight = 'bold';
        btnDel.style.display = 'flex';
        btnDel.style.alignItems = 'center';
        btnDel.style.justifyContent = 'center';
        btnDel.onclick = () => this.deleteSelectedPreset();
        projIORow.appendChild(btnDel);

        actionsSection.appendChild(projIORow);

        content.appendChild(actionsSection);
        this.panel.appendChild(content);

        // Inject into modal element
        this.modalContentElement.appendChild(this.panel);

        // Start local animation loop for canvas
        this.startPreviewAnimationLoop();

        // Initial setup
        this.refreshPresetList();
        this.loadPresetIntoForm();
    }

    show() {
        this.initUI();
        this.panel.style.display = 'flex';
        this.isActive = true;
        this.refreshPresetList();
    }

    hide() {
        if (this.panel) {
            this.panel.style.display = 'none';
        }
        this.isActive = false;
    }

    refreshPresetList() {
        if (!this.presetSelectDropdown) return;
        const list = getAllProjectiles();
        
        // Retain selection if valid, else fallback
        if (!list[this.selectedPresetId]) {
            this.selectedPresetId = Object.keys(list)[0] || 'spark_bullet';
        }

        this.presetSelectDropdown.innerHTML = '';
        Object.keys(list).forEach(key => {
            const opt = document.createElement('option');
            opt.value = list[key].id;
            opt.textContent = `${list[key].name} (${list[key].emitter?.type || 'standard'})`;
            this.presetSelectDropdown.appendChild(opt);
        });

        this.presetSelectDropdown.value = this.selectedPresetId;
    }

    loadPresetIntoForm() {
        const list = getAllProjectiles();
        const pr = list[this.selectedPresetId] || list['spark_bullet'];
        if (!pr) return;

        this.fields.name.value = pr.name || 'Spark Cannon';
        this.fields.id.value = pr.id || 'spark_bullet';
        this.fields.renderType.value = pr.renderType || 'glow';
        this.fields.emoji.value = pr.emoji || '';
        this.fields.color.value = pr.color || '#ff3333';
        this.fields.radius.value = pr.radius || 8;

        const em = pr.emitter || {};
        this.fields.emitterType.value = em.type || 'standard';
        this.fields.cooldown.value = em.cooldown ?? 1.5;
        this.fields.speed.value = em.projectileSpeed || 160;
        this.fields.burstCount.value = em.burstCount || 1;
        this.fields.damage.value = em.damage || 15;
        this.fields.range.value = em.range || 220;

        // Modifier defaults
        this.fields.sinAmplitude.value = em.sinAmplitude ?? 30;
        this.fields.sinFrequency.value = em.sinFrequency ?? 8;
        this.fields.circularSpeed.value = em.circularSpeed ?? 3;

        this.updateFormVisibility();
        this.previewParticles = []; // Flush active previews
    }

    updateFormVisibility() {
        const type = this.fields.emitterType.value;
        const renderType = this.fields.renderType.value;

        // Show/hide sine mods
        const isSine = type === 'sinewave';
        this.fields.sinAmplitude.parentElement.style.display = isSine ? 'flex' : 'none';
        this.fields.sinFrequency.parentElement.style.display = isSine ? 'flex' : 'none';

        // Show/hide circular speed
        const isCircular = type === 'circular';
        this.fields.circularSpeed.parentElement.style.display = isCircular ? 'flex' : 'none';

        // Show/hide emoji input based on render mode
        const isEmoji = renderType === 'emoji';
        this.fields.emoji.parentElement.style.display = isEmoji ? 'flex' : 'none';
    }

    updateFormPreview() {
        this.updateFormVisibility();
    }

    createNewPresetTemplate() {
        const id = `custom_proj_${Math.floor(100 + Math.random() * 900)}`;
        const preset = {
            id: id,
            name: "Viper Spit",
            renderType: 'emoji',
            emoji: '🐍',
            color: '#2ecc71',
            radius: 12,
            emitter: {
                type: 'sinewave',
                cooldown: 0.6,
                projectileSpeed: 200,
                burstCount: 1,
                range: 220,
                damage: 18,
                sinFrequency: 12,
                sinAmplitude: 25,
                circularSpeed: 3,
                showArea: true,
                notify: false
            }
        };

        saveCustomProjectile(preset);
        this.selectedPresetId = id;
        this.refreshPresetList();
        this.loadPresetIntoForm();
        CustomDialog.alert("New customizable projectile template spawned! Fill in details and click Save!", "Template Loaded");
    }

    saveCurrentPreset() {
        const valId = this.fields.id.value.trim();
        if (!valId) {
            CustomDialog.alert("Preset ID Slug cannot be blank.", "Error");
            return;
        }

        const preset = {
            id: valId,
            name: this.fields.name.value.trim() || 'Custom Projectile',
            renderType: this.fields.renderType.value,
            emoji: this.fields.emoji.value.trim(),
            color: this.fields.color.value.trim() || '#ff0000',
            radius: parseInt(this.fields.radius.value, 10) || 8,
            emitter: {
                type: this.fields.emitterType.value,
                cooldown: parseFloat(this.fields.cooldown.value) || 1.5,
                projectileSpeed: parseInt(this.fields.speed.value, 10) || 160,
                burstCount: parseInt(this.fields.burstCount.value, 10) || 1,
                damage: parseInt(this.fields.damage.value, 10) || 15,
                range: parseInt(this.fields.range.value, 10) || 220,
                sinAmplitude: parseInt(this.fields.sinAmplitude.value, 10) || 30,
                sinFrequency: parseInt(this.fields.sinFrequency.value, 10) || 8,
                circularSpeed: parseFloat(this.fields.circularSpeed.value) || 3,
                showArea: true,
                notify: false
            }
        };

        saveCustomProjectile(preset);
        this.selectedPresetId = valId;
        this.refreshPresetList();
        
        // Auto-generate active equippable ability and loot core item silently on every save!
        this.generateAbilityAndCoreLootItem(true);
        
        CustomDialog.alert(`Preset "${preset.name}" stored securely. Its active Core Emitter ability and equippable slot item have been generated/updated automatically!`, "Saved!");
    }

    deleteSelectedPreset() {
        const id = this.selectedPresetId;
        if (['spark_bullet', 'homing_flame', 'toxic_spiral', 'electric_sine', 'nova_frost'].includes(id)) {
            CustomDialog.alert("Cannot delete engine default presets.", "Restricted Action");
            return;
        }

        const runDelete = () => {
            deleteCustomProjectile(id);
            this.selectedPresetId = 'spark_bullet';
            this.refreshPresetList();
            this.loadPresetIntoForm();
            CustomDialog.alert("Custom projectile registry deleted successfully.", "Done");
        };

        CustomDialog.confirm("Delete this custom projectile preset permanently from local registry?", "Confirm Wipe").then(res => {
            if (res) runDelete();
        });
    }

    exportCurrentProjectile() {
        const valId = this.fields.id.value.trim();
        if (!valId) {
            CustomDialog.alert("Please save or load a custom projectile preset first.", "Validation Error");
            return;
        }

        const preset = {
            id: valId,
            name: this.fields.name.value.trim() || 'Custom Projectile',
            renderType: this.fields.renderType.value,
            emoji: this.fields.emoji.value.trim(),
            color: this.fields.color.value.trim() || '#ff0000',
            radius: parseInt(this.fields.radius.value, 10) || 8,
            emitter: {
                type: this.fields.emitterType.value,
                cooldown: parseFloat(this.fields.cooldown.value) || 1.5,
                projectileSpeed: parseInt(this.fields.speed.value, 10) || 160,
                burstCount: parseInt(this.fields.burstCount.value, 10) || 1,
                damage: parseInt(this.fields.damage.value, 10) || 15,
                range: parseInt(this.fields.range.value, 10) || 220,
                sinAmplitude: parseInt(this.fields.sinAmplitude.value, 10) || 30,
                sinFrequency: parseInt(this.fields.sinFrequency.value, 10) || 8,
                circularSpeed: parseFloat(this.fields.circularSpeed.value) || 3,
                showArea: true,
                notify: false
            }
        };

        const json = JSON.stringify(preset, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fileName = preset.name.toLowerCase().replace(/[^a-z0-9]/gi, '_');
        a.download = `emitter_${fileName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        CustomDialog.alert(`Exported custom projectile preset designs successfully!`, "Export Success");
    }

    importProjectileFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (!importedData || !importedData.id || !importedData.name) {
                    CustomDialog.alert("JSON file does not appear to be a valid Projectile Emitter configuration.", "Import Failed");
                    return;
                }

                saveCustomProjectile(importedData);
                this.selectedPresetId = importedData.id;
                this.refreshPresetList();
                this.loadPresetIntoForm();
                
                // Auto-generate active equippable ability and loot core item silently on every save/load import!
                this.generateAbilityAndCoreLootItem(true);

                CustomDialog.alert(`Successfully imported Projectile Emitter "${importedData.name}"! Attached Ability and Core Lootable item generated!`, "Import Complete");
            } catch (err) {
                console.error(err);
                CustomDialog.alert("Could not load Projectile Emitter JSON: format is invalid.", "Import Error");
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    // Automatically generates an epically usable Bullet Hell Ability AND corresponding looting Core Item!
    generateAbilityAndCoreLootItem(silent = false) {
        const presetId = this.selectedPresetId;
        const list = getAllProjectiles();
        const pr = list[presetId];
        if (!pr) return;

        const baseSlug = pr.id;
        const abilitySlug = `bullet_hell_${baseSlug}`;
        const itemSlug = `loot_core_${baseSlug}`;

        // 1. Create and Save the custom equippable active Ability!
        const abConfig = {
            id: abilitySlug,
            name: `${pr.name} Emitter`,
            cooldown: Math.max(0.4, pr.emitter?.cooldown || 1.0),
            range: pr.emitter?.range || 220,
            targetType: 'direction_mouse',
            costHp: 0,
            healing: 0,
            startup: {
                duration: 0.1,
                lockMovement: false,
                lockTurn: false,
                dashSpeed: 0,
                jumpHeight: 0
            },
            active: {
                duration: 0.2,
                damage: pr.emitter?.damage || 15,
                knockbackForce: 10,
                hitboxShape: { type: 'circle', radiusX: pr.radius || 10 },
                createObstacle: false
            },
            recovery: {
                duration: 0.1,
                lockMovement: false,
                lockTurn: false,
                slideSpeed: 0
            },
            // Hook up the emitter configuration!
            hasEmitter: true,
            emitterConfig: {
                presetId: presetId
            }
        };

        saveCustomAbility(abConfig);

        // 2. Create and Save the corresponding lootable/merchant Item!
        const emojiSymbol = pr.emoji || '☄️';
        const itemConfig = {
            id: itemSlug,
            name: `Core: ${pr.name} Emitter`,
            type: 'ability', // Category allows equipping onto Slot 1-4!
            attachedAbility: abilitySlug,
            cost: Math.floor(45 + (pr.emitter?.burstCount || 1) * 15 + (pr.emitter?.damage || 10) * 2), // Cool formula!
            resaleValue: 20,
            description: `Attachable Turret core containing [${pr.name}]. Press Hotbar Slot to fire a Bullet-Hell barrage! Behavior: ${pr.emitter?.type || 'standard'}.`,
            customSymbol: emojiSymbol
        };

        saveCustomItem(itemConfig);

        if (!silent) {
            CustomDialog.alert(
                `🚀 CORE GENERATED SUCCESSFULLY!\n\n` +
                `- Custom Ability "${abConfig.name}" configured.\n` +
                `- Equippable Item "${itemConfig.name}" added to the shop / campaign registries!\n\n` +
                `Take a Turret item from chest looting, or trade with Doran. Press key 1-4 to discharge this custom menace in isometric fields!`,
                "Core Mod Spawned!"
            );
        }
    }

    // Interactive canvas vector-movement rendering
    startPreviewAnimationLoop() {
        let lastTime = performance.now();
        
        const frame = (timestamp) => {
            if (!this.panel || this.panel.style.display === 'none') {
                requestAnimationFrame(frame);
                return;
            }

            const dt = (timestamp - lastTime) / 1000;
            lastTime = timestamp;

            this.updatePreviewState(dt);
            this.renderPreviewCanvas();

            requestAnimationFrame(frame);
        };

        requestAnimationFrame(frame);
    }

    updatePreviewState(dt) {
        const type = this.fields.emitterType ? this.fields.emitterType.value : 'standard';
        const bulletSpeed = parseFloat(this.fields.speed ? this.fields.speed.value : 160);
        const cdValue = parseFloat(this.fields.cooldown ? this.fields.cooldown.value : 1.5);
        const burstCount = parseInt(this.fields.burstCount ? this.fields.burstCount.value : 1, 10);
        
        // Circular mods
        const circSpeed = parseFloat(this.fields.circularSpeed ? this.fields.circularSpeed.value : 3);
        
        // Sine wave mods
        const sinFreq = parseFloat(this.fields.sinFrequency ? this.fields.sinFrequency.value : 8);
        const sinAmp = parseFloat(this.fields.sinAmplitude ? this.fields.sinAmplitude.value : 30);

        this.spawnAccumulator += dt;

        // Firing spawn check
        if (this.spawnAccumulator >= cdValue) {
            this.spawnAccumulator = 0;
            
            // Spawn mini preview projectile data
            const startX = this.previewCanvas.width / 2;
            const startY = this.previewCanvas.height / 2;
            const baseAngle = this.targetDriftAngle; // slow rotates directions for visual elegance

            if (type === 'starburst') {
                for (let i = 0; i < burstCount; i++) {
                    const ang = baseAngle + (i * Math.PI * 2 / burstCount);
                    this.previewParticles.push({
                        startX, startY,
                        x: startX, y: startY,
                        angle: ang,
                        speed: bulletSpeed,
                        type: 'standard',
                        age: 0,
                        circularSpeed: circSpeed,
                        radiusDistance: 0,
                        sinFrequency: sinFreq,
                        sinAmplitude: sinAmp
                    });
                }
            } 
            else if (burstCount > 1) {
                const spreadAngle = 0.6;
                const step = spreadAngle / (burstCount - 1);
                const startAngle = baseAngle - spreadAngle / 2;
                for (let i = 0; i < burstCount; i++) {
                    const ang = startAngle + step * i;
                    this.previewParticles.push({
                        startX, startY,
                        x: startX, y: startY,
                        angle: ang,
                        speed: bulletSpeed,
                        type: type,
                        age: 0,
                        circularSpeed: circSpeed,
                        radiusDistance: 0,
                        sinFrequency: sinFreq,
                        sinAmplitude: sinAmp
                    });
                }
            } 
            else {
                this.previewParticles.push({
                    startX, startY,
                    x: startX, y: startY,
                    angle: baseAngle,
                    speed: bulletSpeed,
                    type: type,
                    age: 0,
                    circularSpeed: circSpeed,
                    radiusDistance: 0,
                    sinFrequency: sinFreq,
                    sinAmplitude: sinAmp
                });
            }
        }

        // Drifting target angle
        this.targetDriftAngle += 0.5 * dt;

        // Homing fake drift target coordinate
        const homingTargetX = this.previewCanvas.width / 2 + Math.cos(this.targetDriftAngle * 1.5) * 80;
        const homingTargetY = this.previewCanvas.height / 2 + Math.sin(this.targetDriftAngle * 1.5) * 45;
        this.homingTarget = { x: homingTargetX, y: homingTargetY };

        // Update active particles
        for (let i = this.previewParticles.length - 1; i >= 0; i--) {
            const p = this.previewParticles[i];
            p.age += dt;

            const maxLifetime = 1.8; // seconds in small canvas preview
            if (p.age >= maxLifetime) {
                this.previewParticles.splice(i, 1);
                continue;
            }

            // Move particle inside canvas bounds
            if (p.type === 'seeking') {
                const dx = this.homingTarget.x - p.x;
                const dy = this.homingTarget.y - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 2) {
                    p.angle = Math.atan2(dy, dx);
                }
                p.x += Math.cos(p.angle) * p.speed * dt * 0.45; // scale to fit canvas
                p.y += Math.sin(p.angle) * p.speed * dt * 0.45;
            } 
            else if (p.type === 'circular') {
                p.angle += p.circularSpeed * dt;
                p.radiusDistance += p.speed * dt * 0.45;
                p.x = p.startX + Math.cos(p.angle) * p.radiusDistance;
                p.y = p.startY + Math.sin(p.angle) * p.radiusDistance;
            } 
            else if (p.type === 'sinewave') {
                const forward = p.speed * p.age * 0.45;
                const forwardX = Math.cos(p.angle) * forward;
                const forwardY = Math.sin(p.angle) * forward;
                
                const lateral = Math.sin(p.age * p.sinFrequency) * p.sinAmplitude * 0.5;
                const normalX = -Math.sin(p.angle);
                const normalY = Math.cos(p.angle);

                p.x = p.startX + forwardX + normalX * lateral;
                p.y = p.startY + forwardY + normalY * lateral;
            } 
            else {
                // Standard straight line
                p.x += Math.cos(p.angle) * p.speed * dt * 0.45;
                p.y += Math.sin(p.angle) * p.speed * dt * 0.45;
            }
        }
    }

    renderPreviewCanvas() {
        if (!this.ctxPreview) return;
        const ctx = this.ctxPreview;
        const w = this.previewCanvas.width;
        const h = this.previewCanvas.height;

        ctx.clearRect(0, 0, w, h);

        // Grid lines
        ctx.strokeStyle = '#251E1A';
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

        // Draw virtual center source point representing shooter turret/player
        const cx = w / 2;
        const cy = h / 2;

        ctx.fillStyle = '#8C6D56';
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#D4C8A0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 9, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#D4C8A0';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText("SHOOTER", cx, cy - 14);

        // Draw homing target if seeking is active
        const type = this.fields.emitterType ? this.fields.emitterType.value : 'standard';
        if (type === 'seeking' && this.homingTarget) {
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.arc(this.homingTarget.x, this.homingTarget.y, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(231,76,60,0.5)';
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.arc(this.homingTarget.x, this.homingTarget.y, 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = '#e74c3c';
            ctx.font = '8px sans-serif';
            ctx.fillText("TARGET TARGET", this.homingTarget.x, this.homingTarget.y - 10);
        }

        // Draw particles using current Visual Configuration settings
        const renderMode = this.fields.renderType ? this.fields.renderType.value : 'glow';
        const color = this.fields.color ? this.fields.color.value.trim() : '#ff3333';
        const radius = parseInt(this.fields.radius ? this.fields.radius.value : 8, 10);
        const emoji = this.fields.emoji ? this.fields.emoji.value : '';

        this.previewParticles.forEach(p => {
            ctx.save();
            if (renderMode === 'emoji' && emoji) {
                ctx.shadowColor = color;
                ctx.shadowBlur = radius * 1.5;
                ctx.font = `${radius * 2.2}px Arial, Helvetica, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.translate(p.x, p.y);
                const rot = p.type === 'seeking' ? p.angle + Math.PI / 2 : (p.age * 5);
                ctx.rotate(rot);
                ctx.fillText(emoji, 0, 0);
            } 
            else {
                ctx.beginPath();
                const grad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, radius * 2.5);
                grad.addColorStop(0, '#ffffff');
                grad.addColorStop(0.3, color);
                grad.addColorStop(0.7, color);
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = grad;
                ctx.arc(p.x, p.y, radius * 2.5, 0, Math.PI * 2);
                ctx.fill();

                ctx.beginPath();
                ctx.fillStyle = '#ffffff';
                ctx.arc(p.x, p.y, radius * 0.7, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        });
    }
}

export default ProjectileCreator;
