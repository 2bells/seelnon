// JRPG Inventory & Equipment System HUD
console.log("game/ui/inventory_ui.js loaded");

import { FloatingTextEffect } from '../combat/effects.js';
import { getAllAbilities, ensureItemAbilityStats } from '../combat/ability_system.js';

class InventoryUI {
    constructor(engine) {
        this.engine = engine;
        this.isOpen = false;
        
        this.bagButton = null;
        this.modal = null;
        this.selectedItemIndex = -1; // Index in engine.player.inventory
        this.selectedAbilityId = null; // Currently clicked ability index in Spellbook list
    }

    init() {
        if (this.bagButton) return;

        // Verify container exist
        const container = document.getElementById('rpg-canvas-container');
        if (!container) {
            console.error("Canvas container elements not found!");
            return;
        }

        // Create Bag absolute button
        const button = document.createElement('button');
        button.id = 'rpg-bag-button';
        button.title = 'Open Character Inventory & Equip [I]';
        button.innerHTML = '🎒';
        button.onclick = (e) => {
            e.stopPropagation();
            this.toggleWindow();
        };

        container.appendChild(button);
        this.bagButton = button;

        // Keyboard bind - 'I' or 'B' keys
        window.addEventListener('keydown', (e) => {
            if (e.key === 'i' || e.key === 'I' || e.key === 'b' || e.key === 'B') {
                // Ignore if writing in input dialogue/editor
                const active = document.activeElement;
                if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA')) {
                    return;
                }
                this.toggleWindow();
            }
        });

        // Initialize empty Modal structure on demand
        this.createModalStructure();

        // Initialize dynamic floating MMO Hotbar overlay
        this.createMmoHotbarHUD();
    }

    createModalStructure() {
        if (this.modal) return;

        const overlay = document.createElement('div');
        overlay.id = 'rpg-inventory-overlay';
        overlay.style.display = 'none';
        overlay.onclick = () => this.toggleWindow();

        const modal = document.createElement('div');
        modal.id = 'rpg-inventory-modal';
        // Prevent click from bubbling up to overlay to close modal
        modal.onclick = (e) => e.stopPropagation();

        // 1. Header Row
        const header = document.createElement('div');
        header.className = 'inventory-header';
        
        const title = document.createElement('h3');
        title.innerHTML = '🛡️ Character Details & Inventory';
        header.appendChild(title);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'inventory-close-btn';
        closeBtn.textContent = '✖';
        closeBtn.onclick = () => this.toggleWindow();
        header.appendChild(closeBtn);

        modal.appendChild(header);

        // 2. Main Wrapper
        const container = document.createElement('div');
        container.className = 'inventory-columns-wrapper';

        // Column 1: Hero Stats / Equipped slots
        const colStats = document.createElement('div');
        colStats.className = 'inventory-col-stats';
        colStats.id = 'inventory-stats-subpanel';
        container.appendChild(colStats);

        // Column 2: Inventory Grid + Spellbook mapping
        const colGrid = document.createElement('div');
        colGrid.className = 'inventory-col-grid';
        
        const gridTitle = document.createElement('h4');
        gridTitle.style.margin = '0 0 10px 0';
        gridTitle.style.color = '#D4C8A0';
        gridTitle.textContent = '🎒 Adventure Bag';
        colGrid.appendChild(gridTitle);

        const gridContainer = document.createElement('div');
        gridContainer.id = 'inventory-slots-grid';
        gridContainer.className = 'inventory-grid-container';
        colGrid.appendChild(gridContainer);
        
        container.appendChild(colGrid);

        // Column 3: Item Description Panel
        const colDetails = document.createElement('div');
        colDetails.className = 'inventory-col-details';
        colDetails.id = 'inventory-details-subpanel';
        container.appendChild(colDetails);

        modal.appendChild(container);
        overlay.appendChild(modal);

        document.body.appendChild(overlay);
        this.modal = overlay;
    }

    createMmoHotbarHUD() {
        let hotbar = document.getElementById('rpg-mmo-hotbar');
        if (hotbar) return;

        const container = document.getElementById('rpg-canvas-container');
        if (!container) return;

        hotbar = document.createElement('div');
        hotbar.id = 'rpg-mmo-hotbar';
        hotbar.style.display = 'flex';
        hotbar.style.flexDirection = 'column';
        hotbar.style.alignItems = 'stretch';
        hotbar.style.gap = '6px';

        // Skills outer row wrapper
        const skillsRow = document.createElement('div');
        skillsRow.style.display = 'flex';
        skillsRow.style.alignItems = 'center';
        skillsRow.style.gap = '12px';
        
        // Label indicator
        const label = document.createElement('div');
        label.className = 'hotbar-label';
        label.textContent = 'HOTBAR & CD';
        skillsRow.appendChild(label);

        const slotKeys = ['Q', 'E', 'R', 'F', 'G'];
        for (let i = 0; i < 5; i++) {
            const slot = document.createElement('div');
            slot.className = 'hotbar-slot';
            slot.dataset.slotIndex = i;
            slot.title = `Press [${slotKeys[i]}] key on keyboard to cast!`;
            slot.onclick = () => {
                this.engine.castPlayerAbility(i);
            };

            const key = document.createElement('span');
            key.className = 'hotbar-key';
            key.textContent = slotKeys[i];
            slot.appendChild(key);

            const icon = document.createElement('span');
            icon.className = 'hotbar-icon';
            icon.textContent = '·';
            slot.appendChild(icon);

            const tracker = document.createElement('div');
            tracker.className = 'hotbar-cooldown';
            tracker.style.display = 'none';
            tracker.textContent = '';
            slot.appendChild(tracker);

            const name = document.createElement('span');
            name.className = 'hotbar-name';
            name.textContent = 'No Skill';
            slot.appendChild(name);

            skillsRow.appendChild(slot);
        }

        hotbar.appendChild(skillsRow);

        // Thin XP progress bar container under skills
        const xpContainer = document.createElement('div');
        xpContainer.id = 'hotbar-xp-bar-container';
        xpContainer.style.height = '6px';
        xpContainer.style.backgroundColor = '#2B231D';
        xpContainer.style.borderRadius = '3px';
        xpContainer.style.border = '1.5px solid #5A4B3E';
        xpContainer.style.overflow = 'hidden';
        xpContainer.style.position = 'relative';
        xpContainer.style.marginTop = '2px';

        const xpFill = document.createElement('div');
        xpFill.id = 'hotbar-xp-bar-fill';
        xpFill.style.backgroundColor = '#3498db';
        xpFill.style.width = '0%';
        xpFill.style.height = '100%';
        xpFill.style.transition = 'width 0.3s ease';

        xpContainer.appendChild(xpFill);
        hotbar.appendChild(xpContainer);

        container.appendChild(hotbar);
    }

    toggleWindow() {
        if (!this.engine.player) return;

        this.isOpen = !this.isOpen;
        const hotbar = document.getElementById('rpg-mmo-hotbar');
        if (this.isOpen) {
            this.modal.style.display = 'flex';
            this.selectedItemIndex = -1;
            this.render();
            // Pause engine update loop in background safely
            this.engine.isPausedForEditor = true;
            if (hotbar) hotbar.style.display = 'none';
        } else {
            this.modal.style.display = 'none';
            this.engine.isPausedForEditor = false;
            // Only show hotbar if dialogue is NOT showing to keep actions clear
            if (hotbar && (!this.engine.dialogueUI || !this.engine.dialogueUI.isVisible)) {
                hotbar.style.display = 'flex';
            }
        }
    }

    render() {
        if (!this.isOpen || !this.engine.player) return;

        this.updateInventoryEquippedStates();
        this.renderStatsPanel();
        this.renderInventoryGrid();
        this.renderDetailsPanel();
    }

    // Helper to extract emoji for item matching names/types
    getItemEmoji(item) {
        if (!item) return '❓';
        if (item.emoji) return item.emoji; // custom icons supported
        
        const name = item.name.toLowerCase();
        
        if (item.type === 'weapon') {
            if (name.includes('axe')) return '🪓';
            if (name.includes('bow')) return '🏹';
            if (name.includes('wand') || name.includes('staff')) return '🔮';
            return '🗡️'; // Default sword
        }
        if (item.type === 'shield') return '🛡️';
        if (item.type === 'armor') return '👕';
        
        if (item.type === 'consumable') {
            if (name.includes('potion')) return '❤️';
            if (name.includes('herb') || name.includes('leaf')) return '🌿';
            return '🍎';
        }
        
        return '📦'; // Loot bag
    }

    // Helper to get ability emojis for hotbar display
    getAbilityEmoji(id) {
        // Query custom items list for matching passive emitter emoji
        const player = this.engine ? this.engine.player : null;
        if (player && Array.isArray(player.inventory)) {
            const matchingItem = player.inventory.find(i => (i.attachedAbility || i.id) === id);
            if (matchingItem && matchingItem.emoji) {
                return matchingItem.emoji;
            }
        }

        if (id === 'slime_leap') return '🐸';
        if (id === 'dash_strike') return '⚔️';
        if (id === 'blood_siphon') return '❤️';
        if (id === 'earth_wall') return '⛰️';
        
        const all = getAllAbilities();
        const ab = all[id];
        if (ab) {
            const labelLower = ab.name.toLowerCase();
            if (labelLower.includes('heal') || labelLower.includes('health') || labelLower.includes('restore') || labelLower.includes('cure')) return '❤️';
            if (labelLower.includes('slash') || labelLower.includes('strike') || labelLower.includes('spear')) return '🗡️';
            if (labelLower.includes('axe') || labelLower.includes('hammer')) return '🔨';
            if (labelLower.includes('fire') || labelLower.includes('burn') || labelLower.includes('flame')) return '🔥';
            if (labelLower.includes('ice') || labelLower.includes('freeze') || labelLower.includes('frost')) return '❄️';
            if (labelLower.includes('def') || labelLower.includes('guard') || labelLower.includes('wall') || labelLower.includes('earth')) return '⛰️';
        }
        return '⚡';
    }

    renderStatsPanel() {
        const statsSub = document.getElementById('inventory-stats-subpanel');
        if (!statsSub) return;

        const player = this.engine.player;
        const weapon = player.inventory.find(i => i.type === 'weapon' && i.equipped) || null;
        const shield = player.inventory.find(i => i.type === 'shield' && i.equipped) || null;
        const armor = player.inventory.find(i => i.type === 'armor' && i.equipped) || null;

        // Base values + dynamic sum
        const totalAtk = player.getAtk();
        const totalDef = player.getDef();

        statsSub.innerHTML = `
            <h4>👤 Attributes</h4>
            <div class="stats-row">
                <span class="attrib-label">Level / Class:</span>
                <span class="attrib-value" style="color: #61b1ff; font-weight: bold;">Lv ${player.stats.level || 1} Hero</span>
            </div>
            
            <div class="stats-row" style="margin-top: 6px;">
                <span class="attrib-label" style="font-size: 0.82em;">XP Progress:</span>
                <span class="attrib-value" style="font-size: 0.82em; color: #3498db;">${player.stats.exp || 0} / ${player.stats.nextLevelExp || 100}</span>
            </div>
            <!-- Live custom mini XP Visual bar -->
            <div style="background-color: #3B322C; height: 6px; border-radius: 3px; position: relative; margin-bottom: 8px; border: 1px solid #5A4B3E; overflow: hidden;">
                <div style="background-color: #3498db; width: ${Math.min(100, Math.floor(((player.stats.exp || 0) / (player.stats.nextLevelExp || 100)) * 100))}%; height: 100%;"></div>
            </div>

            <div class="stats-row">
                <span class="attrib-label">Health (HP):</span>
                <span class="attrib-value">${player.stats.hp} / ${player.stats.maxHp}</span>
            </div>
            <!-- Live custom mini HP Visual bar -->
            <div style="background-color: #3B322C; height: 6px; border-radius: 3px; position: relative; margin-bottom: 12px; border: 1px solid #5A4B3E; overflow: hidden;">
                <div style="background-color: #e74c3c; width: ${(player.stats.hp / player.stats.maxHp) * 100}%; height: 100%;"></div>
            </div>
            
            <div class="stats-row">
                <span class="attrib-label">Gold Wallet:</span>
                <span class="attrib-value" style="color: #FFD700; font-weight: bold;">💰 ${player.gold} G</span>
            </div>
            <hr style="border: none; border-bottom: 1px solid #3B322C; margin: 10px 0;" />
            
            <div class="stats-row">
                <span class="attrib-label">ATK Damage:</span>
                <span class="attrib-value">${totalAtk} <span class="attrib-bonus">${weapon ? `(+${weapon.bonusAtk})` : ''}</span></span>
            </div>
            <div class="stats-row">
                <span class="attrib-label">DEF Guard:</span>
                <span class="attrib-value">${totalDef} <span class="attrib-bonus">${shield || armor ? `(+${(shield?.bonusDef || 0) + (armor?.bonusDef || 0)})` : ''}</span></span>
            </div>

            <h4 style="margin-top: 20px; margin-bottom: 8px;">Active Gear</h4>
            
            <!-- Weapon Frame Slot -->
            <div class="equip-gear-slot ${weapon ? 'has-item' : 'empty'}" id="gear-slot-weapon">
                <div class="gear-slot-icon">🗡️</div>
                <div class="gear-slot-meta">
                    <span class="gear-type-label">WEAPON</span>
                    <span class="gear-item-name">${weapon ? weapon.name : 'Empty Slot'}</span>
                </div>
                ${weapon ? `<button class="equip-gear-unequip-btn" id="unequip-btn-weapon">Unequip</button>` : ''}
            </div>

            <!-- Shield Frame Slot -->
            <div class="equip-gear-slot ${shield ? 'has-item' : 'empty'}" id="gear-slot-shield">
                <div class="gear-slot-icon">🛡️</div>
                <div class="gear-slot-meta">
                    <span class="gear-type-label">OFFHAND</span>
                    <span class="gear-item-name">${shield ? shield.name : 'Empty Slot'}</span>
                </div>
                ${shield ? `<button class="equip-gear-unequip-btn" id="unequip-btn-shield">Unequip</button>` : ''}
            </div>

            <!-- Armor Frame Slot -->
            <div class="equip-gear-slot ${armor ? 'has-item' : 'empty'}" id="gear-slot-armor">
                <div class="gear-slot-icon">👕</div>
                <div class="gear-slot-meta">
                    <span class="gear-type-label">ARMOR</span>
                    <span class="gear-item-name">${armor ? armor.name : 'Empty Slot'}</span>
                </div>
                ${armor ? `<button class="equip-gear-unequip-btn" id="unequip-btn-armor">Unequip</button>` : ''}
            </div>
        `;

        // Attach unequip actions
        if (weapon) {
            document.getElementById('unequip-btn-weapon').onclick = () => this.unequipItem(weapon);
        }
        if (shield) {
            document.getElementById('unequip-btn-shield').onclick = () => this.unequipItem(shield);
        }
        if (armor) {
            document.getElementById('unequip-btn-armor').onclick = () => this.unequipItem(armor);
        }
    }

    renderInventoryGrid() {
        const grid = document.getElementById('inventory-slots-grid');
        if (!grid) return;

        grid.innerHTML = '';
        const player = this.engine.player;

        // Endless dynamic inventory slots (minimum 120 slots, grows dynamically as player gains items)
        const totalSlotsCount = Math.max(120, Math.ceil((player.inventory.length + 6) / 6) * 6);

        for (let i = 0; i < totalSlotsCount; i++) {
            const item = player.inventory[i] || null;
            const slot = document.createElement('div');
            slot.className = 'inventory-item-slot';
            
            if (item) {
                slot.className += ' filled';
                if (item.equipped) slot.className += ' equipped';
                if (this.selectedItemIndex === i) slot.className += ' selected';

                // Render content
                const emoji = document.createElement('span');
                emoji.className = 'item-slot-emoji';
                emoji.textContent = this.getItemEmoji(item);
                slot.appendChild(emoji);

                const countBadge = document.createElement('span');
                countBadge.className = 'item-slot-count';
                countBadge.textContent = item.count > 1 ? `x${item.count}` : '';
                slot.appendChild(countBadge);

                // Small indicator if active
                if (item.equipped) {
                    const eqBadge = document.createElement('span');
                    eqBadge.className = 'item-equipped-indicator';
                    if ((item.type === 'ability' || item.type === 'emitter') && item.equippedSlots && item.equippedSlots.length > 0) {
                        eqBadge.textContent = item.equippedSlots.map(sIdx => ['Q','E','R','F','G'][sIdx]).join(',');
                        eqBadge.style.backgroundColor = '#2980b9'; // Blue accent for slotted spells!
                    } else if (item.type === 'ability' && item.equippedSlot !== undefined) {
                        eqBadge.textContent = ['Q','E','R','F','G'][item.equippedSlot] || 'E';
                        eqBadge.style.backgroundColor = '#2980b9'; // Blue accent for slotted spells!
                    } else {
                        eqBadge.textContent = 'E';
                    }
                    slot.appendChild(eqBadge);
                }

                slot.title = `${item.name}\n${item.description}`;

                // Action binds
                slot.onclick = () => {
                    this.selectedItemIndex = i;
                    this.render();
                };
            } else {
                slot.className += ' empty';
                slot.innerHTML = '<span class="item-slot-dots">·</span>';
            }

            grid.appendChild(slot);
        }
    }



    renderDetailsPanel() {
        const detSub = document.getElementById('inventory-details-subpanel');
        if (!detSub) return;

        const player = this.engine.player;
        const item = player.inventory[this.selectedItemIndex] || null;

        if (!item) {
            detSub.innerHTML = `
                <div class="empty-details-box">
                    <span style="font-size: 2.2em; display: block; margin-bottom: 12px; color: #5A4B3E;">🔍</span>
                    <span>Select any item in your bag to review statistics & equipment controls.</span>
                </div>
            `;
            return;
        }

        const isEquippable = ['weapon', 'shield', 'armor', 'ability', 'emitter'].includes(item.type);
        const emoji = this.getItemEmoji(item);
        
        let statsDescriptor = '';
        if (item.type === 'weapon' && item.bonusAtk) statsDescriptor = `⚔️ Boosts Attack Damage by +${item.bonusAtk}`;
        else if (item.type === 'shield' && item.bonusDef) statsDescriptor = `🛡️ Boosts Defense Guard by +${item.bonusDef}`;
        else if (item.type === 'armor' && item.bonusDef) statsDescriptor = `👕 Boosts Defense Shield by +${item.bonusDef}`;
        else if (item.type === 'consumable' && item.heal) statsDescriptor = `❤️ Restores HP health by +${item.heal}`;
        else if (item.type === 'emitter') {
            const ec = item.emitterConfig || {};
            const playerAtk = player.getAtk();
            const playerDmgVal = Math.floor((ec.damage ?? 15) + 1.0 * playerAtk);
            
            const scalingText = `📡 Cooldown: <b>${ec.cooldown ?? 1.5}s</b> | Range: <b>${ec.range ?? 220}px</b><br/>` + 
                                `💥 Sparks dynamically scale on Owner's ATK!<br/>` +
                                `🔥 Current projectile damage: <strong style="color: #f1c40f;">${playerDmgVal} DMG</strong> (Base ${ec.damage ?? 15} + 100% Owner ATK)`;
                                
            statsDescriptor = `📡 <b>Equipped Autonomous Emitter</b><br/>` +
                              `<span style="color:#e67e22;">${scalingText}</span><br/>` +
                              `<span style="color:#f1c40f; font-size:0.85em; display:block; margin-top:4px;">🔫 Pattern: ${(ec.projectileType || 'standard').toUpperCase()} | Count: ${ec.burstCount ?? 1} ${ec.emoji ? `| Icon: ${ec.emoji}` : ''}</span>`;
        }
        else if (item.type === 'ability' && item.attachedAbility) {
            const allAb = getAllAbilities();
            const ab = allAb[item.attachedAbility];
            
            // Ensure the item has its stats initialized
            ensureItemAbilityStats(item);
            
            const playerAtk = player.getAtk();
            const playerDef = player.getDef();
            const baseDmg = item.baseDmg ?? 12;
            const atkScale = item.atkScale ?? 1.2;
            const cooldown = item.cooldown ?? ((ab && ab.cooldown) || 2.0);
            const range = item.range ?? ((ab && ab.range) || 120);

            let dmgVal = Math.floor(baseDmg + atkScale * playerAtk);
            let scalingText = '';
            
            if (item.attachedAbility === 'slime_leap') {
                scalingText = `💥 Deals <b>${dmgVal} base DMG</b> (${baseDmg} Base + ${Math.round(atkScale * 100)}% ATK)`;
            } else if (item.attachedAbility === 'dash_strike') {
                scalingText = `💥 Deals <b>${dmgVal} base DMG</b> (${baseDmg} Base + ${Math.round(atkScale * 100)}% ATK)`;
            } else if (item.attachedAbility === 'blood_siphon') {
                scalingText = `💥 Deals <b>${dmgVal} base DMG</b> (${baseDmg} Base + ${Math.round(atkScale * 100)}% ATK).<br/>🧪 Costs 15 HP to cast, resolves ❤️ <b>+30 HP heal</b> on hit.`;
            } else if (item.attachedAbility === 'earth_wall') {
                const defScale = item.defScale ?? 0.8;
                dmgVal = Math.floor(baseDmg + atkScale * playerAtk + defScale * playerDef);
                scalingText = `💥 Deals <b>${dmgVal} base DMG</b> (${baseDmg} Base + ${Math.round(atkScale * 100)}% ATK + ${Math.round(defScale * 100)}% DEF).<br/>⛰️ Summons temporary obstacle.`;
            } else {
                scalingText = `💥 Deals <b>${dmgVal} base DMG</b> (${baseDmg} Base + ${Math.round(atkScale * 100)}% ATK)`;
            }
            
            statsDescriptor = `🔮 <b>Grants Skill: ${ab ? ab.name : item.attachedAbility}</b><br/>` +
                              `<span style="color:#e74c3c;">${scalingText}</span><br/>` +
                              `<span style="color:#3498db; font-size:0.9em; display:block; margin-top:4px;">⏱️ Cooldown: ${cooldown}s &nbsp;|&nbsp; 📏 Range: ${range}px</span>`;
        }

        // Addition details: passive or spell attachment descriptor
        let passiveDescriptor = '';
        if (item.passiveAtk || item.passiveDef || item.passiveHp) {
            const parts = [];
            if (item.passiveAtk) parts.push(`+${item.passiveAtk} ATK`);
            if (item.passiveDef) parts.push(`+${item.passiveDef} DEF`);
            if (item.passiveHp) parts.push(`+${item.passiveHp} HP`);
            passiveDescriptor = `💍 Passive Charm: Grants ${parts.join(', ')} just by being in your bag!`;
        }

        let attachDescriptor = '';
        if (item.type === 'emitter') {
            attachDescriptor = `📡 Emitter Core: Auto-shoots projectiles in battlefield!`;
            if (item.equipped) {
                if (item.equippedSlots && item.equippedSlots.length > 0) {
                    attachDescriptor += ` (Equipped to slot(s) ${item.equippedSlots.map(sIdx => ['Q','E','R','F','G'][sIdx]).join(', ')})`;
                } else if (item.equippedSlot !== undefined) {
                    attachDescriptor += ` (Equipped to slot ${['Q','E','R','F','G'][item.equippedSlot]})`;
                }
            }
        } else if (item.attachedAbility) {
            const allAb = getAllAbilities();
            const details = allAb[item.attachedAbility];
            if (details) {
                attachDescriptor = `🔮 Spell: Unlocks casting spell "${details.name}"!`;
                if (item.equipped) {
                    if (item.equippedSlots && item.equippedSlots.length > 0) {
                        attachDescriptor += ` (Equipped to slot(s) ${item.equippedSlots.map(sIdx => ['Q','E','R','F','G'][sIdx]).join(', ')})`;
                    } else if (item.equippedSlot !== undefined) {
                        attachDescriptor += ` (Equipped to slot ${['Q','E','R','F','G'][item.equippedSlot]})`;
                    }
                }
            }
        }

        detSub.innerHTML = `
            <div class="details-main-title">
                <span class="details-avatar-emoji">${emoji}</span>
                <span class="details-name-label">${item.name}</span>
                <span class="details-category-tag">${item.type.toUpperCase()}</span>
            </div>
            
            <div class="details-desc-box">
                <p class="details-text">${item.description || 'No detailed description available.'}</p>
                ${statsDescriptor ? `<div class="details-stat-bullet">${statsDescriptor}</div>` : ''}
                ${passiveDescriptor ? `<div class="details-stat-bullet" style="color:#f1c40f; margin-top:5px;">${passiveDescriptor}</div>` : ''}
                ${attachDescriptor ? `<div class="details-stat-bullet" style="color:#61b1ff; margin-top:5px;">${attachDescriptor}</div>` : ''}
            </div>

            <div class="details-shop-value">
                💰 Recycler Value: <strong style="color: #FFD700;">${item.value || 0}G</strong>
            </div>

            <div class="details-actions-panel">
                ${(item.type === 'ability' || item.type === 'emitter') ? `
                    <div class="ability-slot-equip-container" style="display:flex; flex-direction:column; gap:6px; width:100%; background:rgba(0,0,0,0.22); padding:6px; border-radius:4px; border:1px solid #5A4B3E; box-sizing:border-box; margin-bottom:8px;">
                        <span style="font-size:0.75em; color:#D4C8A0; margin-bottom:2px; display:block; text-align:center;">Equip into Hotbar Slot:</span>
                        <div style="display:flex; gap:4px; justify-content:space-between; width:100%; box-sizing:border-box;">
                            <button class="inventory-action-btn equip-btn" style="flex:1; padding:4px; font-weight:bold; cursor:pointer;" id="equip-slot-q">Q</button>
                            <button class="inventory-action-btn equip-btn" style="flex:1; padding:4px; font-weight:bold; cursor:pointer;" id="equip-slot-e">E</button>
                            <button class="inventory-action-btn equip-btn" style="flex:1; padding:4px; font-weight:bold; cursor:pointer;" id="equip-slot-r">R</button>
                            <button class="inventory-action-btn equip-btn" style="flex:1; padding:4px; font-weight:bold; cursor:pointer;" id="equip-slot-f">F</button>
                            <button class="inventory-action-btn equip-btn" style="flex:1; padding:4px; font-weight:bold; cursor:pointer;" id="equip-slot-g">G</button>
                        </div>
                        ${item.equipped ? `
                            <button class="inventory-action-btn sell-btn" style="width:100%; margin-top:4px; cursor:pointer;" id="action-unequip-ability">Unequip from Hotbar</button>
                        ` : ''}
                    </div>
                ` : (isEquippable ? `
                    <button class="inventory-action-btn equip-btn" id="action-equip-toggle" style="cursor:pointer;">
                        ${item.equipped ? '📥 Unequip item' : '📤 Equip as item'}
                    </button>
                ` : '')}

                ${item.type === 'consumable' ? `
                    <button class="inventory-action-btn consume-btn" id="action-consume-apply" style="cursor:pointer;">
                        ❤️ Use / Eat Item
                    </button>
                ` : ''}

                ${(item.type === 'weapon' || item.type === 'shield' || item.type === 'armor' || item.type === 'ability' || item.type === 'emitter') ? `
                    <button class="inventory-action-btn upgrade-portal-btn" id="action-upgrade-portal" style="cursor:pointer; background-color: #e67e22; color: white; font-weight: bold; border: 2px solid #ffd700; width: 100%; box-shadow: 0 0 6px rgba(230,126,34,0.5); margin-bottom: 4px;">
                        🌀 Upgrade in Portal
                    </button>
                ` : ''}

                <button class="inventory-action-btn sell-btn" id="action-sell-merchant" style="cursor:pointer;">
                    💰 Sell to Recycler (+${item.value}G)
                </button>
            </div>
        `;

        // Direct actions binding
        const upgradeBtn = document.getElementById('action-upgrade-portal');
        if (upgradeBtn) {
            upgradeBtn.onclick = () => {
                // Close/hide inventory UI
                this.toggleWindow();
                // Open Chaos Map Device with current item selected
                const dev = this.engine.editorManager?.editors.chaos_map_device;
                if (dev) {
                    dev.openWithItem(item);
                }
            };
        }

        if (item.type === 'ability' || item.type === 'emitter') {
            document.getElementById('equip-slot-q').onclick = () => this.equipAbilityItemToSlot(item, 0);
            document.getElementById('equip-slot-e').onclick = () => this.equipAbilityItemToSlot(item, 1);
            document.getElementById('equip-slot-r').onclick = () => this.equipAbilityItemToSlot(item, 2);
            document.getElementById('equip-slot-f').onclick = () => this.equipAbilityItemToSlot(item, 3);
            document.getElementById('equip-slot-g').onclick = () => this.equipAbilityItemToSlot(item, 4);
            if (item.equipped) {
                document.getElementById('action-unequip-ability').onclick = () => this.unequipAbilityItem(item);
            }
        } else if (isEquippable) {
            document.getElementById('action-equip-toggle').onclick = () => {
                if (item.equipped) {
                    this.unequipItem(item);
                } else {
                    this.equipItem(item);
                }
            };
        }

        if (item.type === 'consumable') {
            document.getElementById('action-consume-apply').onclick = () => {
                this.consumeConsumable(item);
            };
        }

        document.getElementById('action-sell-merchant').onclick = () => {
            this.sellItemToMerchant(item);
        };
    }

    // EQUIP item
    equipItem(item) {
        const player = this.engine.player;
        if (!player) return;

        // Unequip all items of same category first
        player.inventory.forEach(i => {
            if (i.type === item.type) {
                i.equipped = false;
            }
        });

        // Equip this item
        item.equipped = true;
        
        // Trigger HP updates reactively
        if (player.updateDynamicStats) player.updateDynamicStats();
        
        this.render();

        const total = item.bonusAtk || item.bonusDef || 0;
        const txt = `Equipped: ${item.name} (+${total})`;
        this.addLocalFloatText(txt, '#28a745');
    }

    // UNEQUIP item
    unequipItem(item) {
        item.equipped = false;
        
        const player = this.engine.player;
        if (player && player.updateDynamicStats) player.updateDynamicStats();

        this.render();
        this.addLocalFloatText(`Unequipped: ${item.name}`, '#ffc107');
    }

    updateInventoryEquippedStates() {
        const player = this.engine.player;
        if (!player || !Array.isArray(player.inventory) || !Array.isArray(player.equippedAbilities)) return;

        // Ensure equippedCustomItemIds is initialized
        if (!Array.isArray(player.equippedCustomItemIds)) {
            player.equippedCustomItemIds = [null, null, null, null, null];
            // Backfill from equippedAbilities if some are already configured
            player.equippedAbilities.forEach((abId, idx) => {
                if (abId) {
                    const matchedItem = player.inventory.find(i => (i.type === 'ability' || i.type === 'emitter') && (i.attachedAbility === abId || i.id === abId) && !i.equipped);
                    if (matchedItem) {
                        if (!matchedItem.instanceId) {
                            matchedItem.instanceId = 'inst_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
                        }
                        player.equippedCustomItemIds[idx] = matchedItem.instanceId;
                    }
                }
            });
        }

        player.inventory.forEach(item => {
            if (item.type === 'ability' || item.type === 'emitter') {
                if (!item.instanceId) {
                    item.instanceId = 'inst_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
                }
                const equippedSlots = [];
                player.equippedCustomItemIds.forEach((eqInstId, sIdx) => {
                    if (eqInstId === item.instanceId) {
                        equippedSlots.push(sIdx);
                    }
                });

                if (equippedSlots.length > 0) {
                    item.equipped = true;
                    item.equippedSlot = equippedSlots[0];
                    item.equippedSlots = equippedSlots;
                } else {
                    item.equipped = false;
                    item.equippedSlot = undefined;
                    item.equippedSlots = [];
                }
            }
        });
    }

    // Equip an ability item to a hotbar slot
    equipAbilityItemToSlot(item, slotIndex) {
        const player = this.engine.player;
        if (!player) return;

        // Ensure equippedAbilities is initialized
        if (!Array.isArray(player.equippedAbilities)) {
            player.equippedAbilities = [null, null, null, null, null];
        }
        if (!Array.isArray(player.equippedCustomItemIds)) {
            player.equippedCustomItemIds = [null, null, null, null, null];
        }

        if (!item.instanceId) {
            item.instanceId = 'inst_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        }

        // Dereference this instance from any other slot first
        for (let i = 0; i < player.equippedCustomItemIds.length; i++) {
            if (player.equippedCustomItemIds[i] === item.instanceId) {
                player.equippedCustomItemIds[i] = null;
                player.equippedAbilities[i] = null;
            }
        }

        const abIdentifier = item.attachedAbility || item.id;

        // Assign the ability to this slot
        player.equippedAbilities[slotIndex] = abIdentifier;
        player.equippedCustomItemIds[slotIndex] = item.instanceId;
        item.explicitlyUnequipped = false; // reset explicitly unequipped state!

        this.updateInventoryEquippedStates();

        if (typeof player.rebuildEmitters === 'function') {
            player.rebuildEmitters();
        }

        this.render();
        this.addLocalFloatText(`Equipped ${item.name} to Hotbar Slot ${['Q','E','R','F','G'][slotIndex]}!`, '#2ecc71');
    }

    // Unequip an ability item from any hotbar slots
    unequipAbilityItem(item) {
        const player = this.engine.player;
        if (!player) return;

        if (!item.instanceId) {
            item.instanceId = 'inst_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        }

        if (Array.isArray(player.equippedCustomItemIds)) {
            for (let i = 0; i < player.equippedCustomItemIds.length; i++) {
                if (player.equippedCustomItemIds[i] === item.instanceId) {
                    player.equippedCustomItemIds[i] = null;
                    if (Array.isArray(player.equippedAbilities)) {
                        player.equippedAbilities[i] = null;
                    }
                }
            }
        }
        item.explicitlyUnequipped = true; // explicitly unequipped to prevent automatic re-equipping

        this.updateInventoryEquippedStates();

        if (typeof player.rebuildEmitters === 'function') {
            player.rebuildEmitters();
        }

        this.render();
        this.addLocalFloatText(`Unequipped ${item.name} from Hotbar!`, '#ffc107');
    }

    // USE potions/herbs
    consumeConsumable(item) {
        const player = this.engine.player;
        if (!player) return;

        if (player.stats.hp >= player.stats.maxHp) {
            this.addLocalFloatText("Already at maximum Health!", "#e74c3c");
            return;
        }

        const heal = item.heal || 0;
        const oldHp = player.stats.hp;
        player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + heal);
        const actualHealed = player.stats.hp - oldHp;

        // Subtract count
        item.count--;
        if (item.count <= 0) {
            player.inventory = player.inventory.filter(i => i !== item);
            this.selectedItemIndex = -1; // Reset selection
        }

        this.render();
        this.addLocalFloatText(`+${actualHealed} HP Recovery`, '#2ecc71');
    }

    // SELL logic to make items profitable
    sellItemToMerchant(item) {
        const player = this.engine.player;
        if (!player) return;

        const payout = item.value || 10;
        player.gold = (player.gold || 0) + payout;

        // Subtract count
        item.count--;
        // Unequip automatically if equipped
        if (item.count <= 0) {
            item.equipped = false;
            player.inventory = player.inventory.filter(i => i !== item);
            this.selectedItemIndex = -1; // Reset selection
        }

        if (player.updateDynamicStats) player.updateDynamicStats();

        this.render();
        this.addLocalFloatText(`+${payout} Gold Recycled`, '#FFD700');
    }

    // Real-time HUD cooldown updater called on each engine frame tick
    updateHotbar(deltaTime) {
        const player = this.engine.player;
        if (!player) return;

        const hotbar = document.getElementById('rpg-mmo-hotbar');
        if (!hotbar) return;

        const slots = hotbar.querySelectorAll('.hotbar-slot');
        const allAbilities = getAllAbilities();

        slots.forEach((slot, idx) => {
            const abId = player.equippedAbilities[idx];
            const iconSpan = slot.querySelector('.hotbar-icon');
            const nameSpan = slot.querySelector('.hotbar-name');
            const cdDiv = slot.querySelector('.hotbar-cooldown');

            if (abId) {
                const spec = allAbilities[abId];
                const name = spec ? spec.name : abId;
                iconSpan.textContent = this.getAbilityEmoji(abId);
                nameSpan.textContent = name;

                // Cooldown logic (checks slot-based cooldown key first, then falls back to ability ID)
                const slotCdKey = `slot_${idx}`;
                const remaining = player.abilityCooldowns[slotCdKey] !== undefined ? player.abilityCooldowns[slotCdKey] : (player.abilityCooldowns[abId] || 0);
                if (remaining > 0) {
                    cdDiv.style.display = 'flex';
                    cdDiv.textContent = `${remaining.toFixed(1)}s`;
                } else {
                    cdDiv.style.display = 'none';
                }
            } else {
                iconSpan.textContent = '·';
                nameSpan.textContent = 'Empty';
                cdDiv.style.display = 'none';
            }
        });

        // Live updating of Player XP progress bar below hotbar skills
        const xpFill = document.getElementById('hotbar-xp-bar-fill');
        const xpContainer = document.getElementById('hotbar-xp-bar-container');
        if (xpFill && xpContainer) {
            const currentExp = player.stats.exp || 0;
            const nextLvlExp = player.stats.nextLevelExp || 100;
            const pct = Math.min(100, Math.floor((currentExp / nextLvlExp) * 100));
            xpFill.style.width = `${pct}%`;
            xpContainer.title = `Player Level ${player.stats.level || 1} XP: ${currentExp} / ${nextLvlExp} (${pct}%)`;
        }
    }

    // Helper to spawn floating text over hero in the engine
    addLocalFloatText(text, color) {
        const player = this.engine.player;
        if (!player || !this.engine) return;

        this.engine.addEffect(new FloatingTextEffect(this.engine, {
            text: text,
            position: { x: player.currentPixelX, y: player.currentPixelY - 50 },
            color: color || '#FFD700',
            duration: 1.8
        }));
    }
}

export default InventoryUI;
