// ARAM (All Random All Mid) Wave Spawning and Sentry Tower AI Systems

import NPC from '../entities/npc.js';
import Enemy from '../entities/enemy.js';
import { FloatingTextEffect, TowerOrbEffect } from '../combat/effects.js';
import { enemy_types } from '../../data/enemy-list.js';

export function isARAMMap(map) {
    if (!map) return false;
    const name = (map.currentMapName || "").toLowerCase();
    return name === "2_2_map" || name === "aram_level2_map";
}

export function checkAndSpawnARAMNPCs(engine) {
    if (!isARAMMap(engine.map)) return;

    // 1. Doran placement tweak: find Shopkeeper Doran runtime instance or reposition
    for (const obj of engine.gameObjects) {
        if (obj instanceof NPC && obj.name.toLowerCase().includes('doran')) {
            const yCoord = engine.map.height - 1.0; // Dynamic based on height (23 for height 24, 35 for height 36)
            obj.mapX = 10.0;
            obj.mapY = yCoord;
            const updatedPxScreen = engine.map.mapToScreen(obj.mapX, obj.mapY);
            obj.currentPixelX = updatedPxScreen.x;
            obj.currentPixelY = updatedPxScreen.y;
        }
    }

    // 2. Programmatically spawn Merchant Scruffy if not loaded (representing the Red Faction Nexus / boss objective)
    const isItemWorld = engine.map && engine.map.currentMapName && engine.map.currentMapName.startsWith('ItemWorld');
    const hasScruffy = engine.gameObjects.some(obj => obj instanceof NPC && obj.name.toLowerCase().includes('scruffy'));
    if (!hasScruffy && !isItemWorld) {
        const scruffyMapCoords = { x: 10.0, y: 2.0 }; // Symmetrically offsetted and moved down from the wall
        const scruffyOptions = {
            id: 'npc_permanent_scruffy',
            name: "Merchant Scruffy",
            assetName: 'npcSpritesheet',
            spriteSourceRect: { x: 128, y: 0, width: 64, height: 64 } // Frame 2 in spritesheet (nice wizard/merchant visual)
        };

        const diffLevel = engine.aramDifficultyLevel || 1;
        const playerLvl = engine.player && engine.player.stats ? engine.player.stats.level : 1;
        
        let scaleFactor;
        if (diffLevel >= 2) {
            scaleFactor = 1 + (diffLevel - 1) * 0.75 + (playerLvl - 1) * 0.35; // Drastic scaling for Level 2+
        } else {
            scaleFactor = 1 + (diffLevel - 1) * 0.4 + (playerLvl - 1) * 0.16;
        }

        const scruffyData = {
            name: "Merchant Scruffy",
            description: "Scurrilous rival merchant and guardian of the Red Faction Nexus.",
            personality: "Calls Blue Faction peasants trash, boasts about his ultimate defensive elixirs.",
            first_mes: "Aha! You think you can conquer the Red Faction?! Beat my Red Sentry and my loyal slimes first, or buy my Infinity Edge!",
            mes_example: "",
            scenario: "Sells elite battle gear, weapons and shields to player for coin.",
            map_sprite: { type: "spritesheet", source: 2 },
            stats: { 
                level: Math.round(12 + (diffLevel - 1) * 3 + (playerLvl - 1) * 0.5), 
                hp: Math.round(550 * scaleFactor), 
                maxHp: Math.round(550 * scaleFactor), 
                atk: Math.round(45 * scaleFactor), 
                def: Math.round(12 * scaleFactor), 
                speed: 120 
            },
            inventory: [
                {
                    name: "Infinity Edge",
                    type: "weapon",
                    bonusAtk: 45,
                    cost: 400,
                    description: "+45 Attack. Guaranteed critical blow multiplier.",
                    count: 1
                },
                {
                    name: "Warmog's Armor",
                    type: "shield",
                    bonusDef: 30,
                    cost: 350,
                    description: "+30 Defense. Scurrilous ultimate protection barrier.",
                    count: 1
                }
            ]
        };
        const scruffyNpc = new NPC(engine, engine.map, scruffyMapCoords.x, scruffyMapCoords.y, scruffyOptions);
        scruffyNpc.loadCharacterData(scruffyData);
        engine.gameObjects.push(scruffyNpc);
        console.log(`Spawned Merchant Scruffy programmatically at map coords (${scruffyMapCoords.x}, ${scruffyMapCoords.y}).`);
    }
}

export function scaleARAMEnemyStats(engine, enemyInstanceData) {
    if (!isARAMMap(engine.map)) return;

    const diffLevel = engine.aramDifficultyLevel || 1;
    const playerLvl = engine.player && engine.player.stats ? engine.player.stats.level : 1;
    
    let scaleFactor;
    if (diffLevel >= 2) {
        scaleFactor = 1 + (diffLevel - 1) * 0.75 + (playerLvl - 1) * 0.35; // Drastic enemy scaling for Level 2+
    } else {
        scaleFactor = 1 + (diffLevel - 1) * 0.35 + (playerLvl - 1) * 0.15;
    }

    if (enemyInstanceData.stats) {
        enemyInstanceData.stats.level = playerLvl + (diffLevel - 1) * 2;
        enemyInstanceData.stats.maxHp = Math.round((enemyInstanceData.stats.maxHp || 40) * scaleFactor);
        enemyInstanceData.stats.hp = enemyInstanceData.stats.maxHp;
        enemyInstanceData.stats.atk = Math.round((enemyInstanceData.stats.atk || 10) * scaleFactor);
        enemyInstanceData.stats.def = Math.round((enemyInstanceData.stats.def || 5) * scaleFactor);
    }
}

export function updateARAMSystems(engine, deltaTime) {
    if (!isARAMMap(engine.map)) return;

    // Wave Spawning System
    if (engine.waveSpawnTimer === undefined) {
        engine.waveSpawnTimer = 1.0; // Fast first wave spawn (1s) after setup
    }
    engine.waveSpawnTimer -= deltaTime;

    if (engine.waveSpawnTimer <= 0) {
        engine.waveSpawnTimer = 22.0; // Wave cooldown (seconds)

        // Faction survival checks
        let scruffyAlive = false;
        let doranAlive = false;
        for (const obj of engine.gameObjects) {
            if (obj instanceof NPC) {
                const nameLower = obj.name.toLowerCase();
                if (nameLower.includes('scruffy') && obj.stats && obj.stats.hp > 0) {
                    scruffyAlive = true;
                }
                if (nameLower.includes('doran') && obj.stats && obj.stats.hp > 0) {
                    doranAlive = true;
                }
            }
        }

        if (engine.map) {
            // 1. Spawn Hostile red slimes (staggered)
            if (scruffyAlive) {
                const enemySpawn = engine.map.spawnPointsData.find(sp => sp.id === 'spawn_pt_enemy_base');
                if (enemySpawn) {
                    const mapCoords = engine.map.screenToMap(enemySpawn.x, enemySpawn.y);
                    mapCoords.x = 13.2; // Move spawn 1 tile below turret line
                    
                    const slimeData = enemy_types['slime'];
                    if (slimeData) {
                        for (let i = 0; i < 3; i++) {
                            setTimeout(() => {
                                if (!engine.player || engine.player.stats.hp <= 0) return;
                                // Ensure Scruffy is still alive upon spawn
                                if (!engine.gameObjects.some(o => o.name && o.name.toLowerCase().includes('scruffy') && o.stats && o.stats.hp > 0)) return;

                                const enemyInstanceData = JSON.parse(JSON.stringify(slimeData));
                                
                                const diffLevel = engine.aramDifficultyLevel || 1;
                                const playerLvl = engine.player && engine.player.stats ? engine.player.stats.level : 1;
                                
                                let scaleFactor;
                                let damageMultiplier = 1.0;
                                if (diffLevel >= 2) {
                                    scaleFactor = 1 + (diffLevel - 1) * 0.8 + (playerLvl - 1) * 0.4;
                                    damageMultiplier = 1.75; // Red slimes do drastically higher damage on level 2
                                } else {
                                    scaleFactor = 1 + (diffLevel - 1) * 0.35 + (playerLvl - 1) * 0.15;
                                }
                                
                                enemyInstanceData.stats.speed = 65;
                                enemyInstanceData.stats.maxHp = Math.round(40 * scaleFactor);
                                enemyInstanceData.stats.hp = enemyInstanceData.stats.maxHp;
                                enemyInstanceData.stats.atk = Math.round((enemyInstanceData.stats.atk || 8) * scaleFactor * damageMultiplier);
                                enemyInstanceData.stats.level = playerLvl + (diffLevel - 1) * 2;
                                
                                const enemy = new Enemy(engine, engine.map, mapCoords.x, mapCoords.y, enemyInstanceData);
                                enemy.friendly = false;
                                engine.gameObjects.push(enemy);
                            }, i * 1500); // Stagger by 1.5s
                        }
                    }
                }
            }

            // 2. Spawn Friendly blue slimes (staggered)
            if (doranAlive) {
                const playerSpawn = engine.map.spawnPointsData.find(sp => sp.type === 'player_entry');
                if (playerSpawn) {
                    const mapCoords = engine.map.screenToMap(playerSpawn.x, playerSpawn.y);
                    mapCoords.x = 13.2; // Move spawn 1 tile below turret line
                    
                    const slimeData = enemy_types['slime'];
                    if (slimeData) {
                        for (let i = 0; i < 3; i++) {
                            setTimeout(() => {
                                if (!engine.player || engine.player.stats.hp <= 0) return;
                                // Ensure Doran is still alive upon spawn
                                if (!engine.gameObjects.some(o => o.name && o.name.toLowerCase().includes('doran') && o.stats && o.stats.hp > 0)) return;

                                const friendlyInstanceData = JSON.parse(JSON.stringify(slimeData));
                                
                                const diffLevel = engine.aramDifficultyLevel || 1;
                                const playerLvl = engine.player && engine.player.stats ? engine.player.stats.level : 1;
                                
                                let scaleFactor;
                                if (diffLevel >= 2) {
                                    scaleFactor = 1 + (diffLevel - 1) * 0.8 + (playerLvl - 1) * 0.4;
                                } else {
                                    scaleFactor = 1 + (diffLevel - 1) * 0.35 + (playerLvl - 1) * 0.15;
                                }
                                
                                friendlyInstanceData.stats.speed = 65;
                                friendlyInstanceData.stats.maxHp = Math.round(40 * scaleFactor);
                                friendlyInstanceData.stats.hp = friendlyInstanceData.stats.maxHp;
                                friendlyInstanceData.stats.atk = Math.round((friendlyInstanceData.stats.atk || 8) * scaleFactor);
                                friendlyInstanceData.stats.level = playerLvl + (diffLevel - 1) * 2;
                                friendlyInstanceData.name = "Allied Slime"; // Rename to Allied Slime
                                
                                const alliedSlime = new Enemy(engine, engine.map, mapCoords.x, mapCoords.y, friendlyInstanceData);
                                alliedSlime.friendly = true;
                                engine.gameObjects.push(alliedSlime);
                            }, i * 1500); // Stagger by 1.5s
                        }
                    }
                }
            }
        }
    }

    // Tower Behavior & Combat Update
    for (const obj of engine.gameObjects) {
        const isTowerBlue = obj.type === 'tower_player';
        const isTowerRed = obj.type === 'tower_enemy';

        if (isTowerBlue || isTowerRed) {
            // Sentry Auto-initialization with ARAM level scaling
            if (!obj.stats) {
                const diffLevel = engine.aramDifficultyLevel || 1;
                const playerLvl = engine.player && engine.player.stats ? engine.player.stats.level : 1;
                
                let scaleFactor;
                if (diffLevel >= 2) {
                    scaleFactor = 1 + (diffLevel - 1) * 0.85 + (playerLvl - 1) * 0.35; // Drastic tower scaling
                } else {
                    scaleFactor = 1 + (diffLevel - 1) * 0.35 + (playerLvl - 1) * 0.15;
                }

                obj.stats = {
                    hp: Math.round(450 * scaleFactor),
                    maxHp: Math.round(450 * scaleFactor),
                    atk: Math.round(25 * scaleFactor),
                    attackRange: 140, // Balanced range synchronized perfectly with bridges
                    attackCooldown: 1.0, 
                    isDestroyed: false
                };
                obj.currentTargetLock = null;

                // Range Rendering Override (Fades in on proximity or cursor hover)
                const originalRender = obj.render ? obj.render.bind(obj) : null;
                obj.render = (ctx, viewOriginX, viewOriginY) => {
                    if (!obj.stats.isDestroyed) {
                        const anchorCanvasX = obj.currentPixelX - viewOriginX;
                        const anchorCanvasY = obj.currentPixelY - viewOriginY;
                        const radius = obj.stats.attackRange;

                        let targetAlpha = 0.0;

                        // Proximity check
                        if (engine.player) {
                            const pDx = engine.player.currentPixelX - obj.currentPixelX;
                            const pDy = engine.player.currentPixelY - obj.currentPixelY;
                            const pDist = Math.sqrt(pDx * pDx + (pDy * 2.0) * (pDy * 2.0));
                            if (pDist < radius + 60) {
                                targetAlpha = Math.max(targetAlpha, 1.0 - Math.max(0, (pDist - radius) / 60));
                            }
                        }

                        // Cursor hover check
                        if (engine.mousePos) {
                            const zoom = engine.zoomLevel || 1.0;
                            const mouseWorldX = (engine.mousePos.x / zoom) + viewOriginX;
                            const mouseWorldY = (engine.mousePos.y / zoom) + viewOriginY;
                            const mDx = mouseWorldX - obj.currentPixelX;
                            const mDy = mouseWorldY - obj.currentPixelY;
                            const mDist = Math.sqrt(mDx * mDx + (mDy * 2.0) * (mDy * 2.0));
                            if (mDist < 100) {
                                targetAlpha = Math.max(targetAlpha, 1.0 - (mDist / 100));
                            }
                        }

                        if (targetAlpha > 0.02) {
                            ctx.save();
                            ctx.globalAlpha = targetAlpha;

                            // Ground visual fill
                            ctx.beginPath();
                            ctx.fillStyle = isTowerBlue ? 'rgba(52, 152, 219, 0.05)' : 'rgba(231, 76, 60, 0.05)';
                            ctx.ellipse(anchorCanvasX, anchorCanvasY, radius, radius * 0.5, 0, 0, Math.PI * 2);
                            ctx.fill();

                            // Ground visual border
                            ctx.strokeStyle = isTowerBlue ? 'rgba(52, 152, 219, 0.45)' : 'rgba(231, 76, 60, 0.45)';
                            ctx.lineWidth = 1.5;
                            ctx.setLineDash([8, 4]);
                            ctx.beginPath();
                            ctx.ellipse(anchorCanvasX, anchorCanvasY, radius, radius * 0.5, 0, 0, Math.PI * 2);
                            ctx.stroke();
                            ctx.restore();
                        }
                    }

                    if (originalRender) {
                        originalRender(ctx, viewOriginX, viewOriginY);
                    }
                };

                // Health Bar rendering support decoration
                obj.drawHealthBar = (ctx, viewOriginX, viewOriginY) => {
                    if (obj.stats.isDestroyed) return;
                    const barWidth = 32;
                    const barHeight = 4;
                    const drawX = obj.currentPixelX - viewOriginX - (barWidth / 2);
                    const drawY = obj.currentPixelY - viewOriginY - 58; // Draw above tower sprite

                    // Background
                    ctx.fillStyle = 'rgba(0,0,0,0.65)';
                    ctx.fillRect(drawX, drawY, barWidth, barHeight);

                    // Fill color (Blue for allied, Red for enemy)
                    ctx.fillStyle = isTowerBlue ? '#3498db' : '#e74c3c';
                    const fillWidth = (obj.stats.hp / obj.stats.maxHp) * barWidth;
                    ctx.fillRect(drawX, drawY, fillWidth, barHeight);

                    // Border
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(drawX, drawY, barWidth, barHeight);

                    // Draw warning laser and exclamation mark if locked on actively
                    if (obj.currentTargetLock && obj.currentTargetLock.target && obj.currentTargetLock.target.stats.hp > 0) {
                        const currentTarget = obj.currentTargetLock.target;
                        const tx = currentTarget.currentPixelX - viewOriginX;
                        const ty = currentTarget.currentPixelY - viewOriginY - 16;
                        const hx = obj.currentPixelX - viewOriginX;
                        const hy = obj.currentPixelY - viewOriginY - 48;

                        ctx.save();
                        // 1. Draw elegant warning laser
                        ctx.strokeStyle = isTowerBlue ? 'rgba(52, 152, 219, 0.6)' : 'rgba(231, 76, 60, 0.7)';
                        ctx.lineWidth = 1.5;
                        ctx.setLineDash([4, 4]);
                        ctx.beginPath();
                        ctx.moveTo(hx, hy);
                        ctx.lineTo(tx, ty);
                        ctx.stroke();

                        // 2. Draw warning exclamation mark over the tower
                        const warningX = obj.currentPixelX - viewOriginX;
                        const warningY = drawY - 18; // 18px above the health bar
                        
                        // Pulse warning icon vertically
                        const pulse = Math.sin(Date.now() / 70) * 2;
                        ctx.beginPath();
                        ctx.arc(warningX, warningY + pulse, 10, 0, Math.PI * 2);
                        ctx.fillStyle = '#e67e22'; // Bold Orange
                        ctx.shadowColor = '#e67e22';
                        ctx.shadowBlur = 8;
                        ctx.fill();

                        ctx.shadowBlur = 0; // Turn off shadow for text sharpness
                        ctx.fillStyle = '#ffffff';
                        ctx.font = 'bold 13px Arial';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('!', warningX, warningY + pulse);

                        ctx.restore();
                    }
                };

                // Implement customized takeDamage on the Tower Game Object dynamically
                obj.takeDamage = (amount, attacker) => {
                    if (obj.stats.isDestroyed) return;
                    const damage = Math.max(1, amount - 4); // Flat armor reduction
                    obj.stats.hp -= damage;

                    // Float damage on combat canvas
                    engine.addEffect(new FloatingTextEffect(engine, {
                        text: damage.toFixed(0),
                        position: { x: obj.currentPixelX, y: obj.currentPixelY - 45 },
                        color: isTowerBlue ? '#3498db' : '#e74c3c'
                    }));

                    if (obj.stats.hp <= 0) {
                        obj.stats.hp = 0;
                        obj.stats.isDestroyed = true;
                        obj.collidable = false; // Allow passing over ruin rubble
                        // Mutate map representation
                        obj.spriteSourceRect = { x: 66, y: 132, width: 64, height: 64 }; // Pile of bricks frame

                        // Trigger full-screen floating text announcements
                        const isVictory = isTowerRed;
                        const text = isVictory ? "🏆 ENEMY TOWER CRUMBLED! GG!" : "⚠️ ALLIED SENTRY TOWER DOWN!";
                        const textColor = isVictory ? '#2ecc71' : '#f39c12';

                        engine.addEffect(new FloatingTextEffect(engine, {
                            text: text,
                            position: { x: obj.currentPixelX, y: obj.currentPixelY - 100 },
                            color: textColor,
                            font: 'bold 24px Arial',
                            duration: 5
                        }));

                        // Clear any active targeting to our destroyed tower
                        if (engine.player.currentTarget === obj) {
                            engine.player.currentTarget = null;
                        }

                        setTimeout(() => {
                            const bannerText = isVictory ? "TOWER FALLEN! An enemy tower has fallen!" : "TOWER DOWN! The Allied Sentry has fallen! Protect Shopkeeper Doran!";
                            const bannerType = isVictory ? "victory" : "warning";
                            engine.showTopBannerAnnouncement(bannerText, bannerType);
                        }, 1500);
                    }
                };
            }

            // If tower is alive, cool down and target enemies
            if (!obj.stats.isDestroyed) {
                if (obj.stats.attackCooldown > 0) {
                    obj.stats.attackCooldown = Math.max(0, obj.stats.attackCooldown - deltaTime);
                    // Clear active lock while strictly warming down/recharging internal weapon capacity
                    obj.currentTargetLock = null;
                } else {
                    let currentTarget = null;
                    let bestDist = obj.stats.attackRange;

                    if (isTowerBlue) {
                        // Target closest hostile slime minion in range
                        for (const targetObj of engine.gameObjects) {
                            if (targetObj instanceof Enemy && targetObj.friendly !== true && targetObj.stats && targetObj.stats.hp > 0) {
                                const dx = targetObj.currentPixelX - obj.currentPixelX;
                                const dy = targetObj.currentPixelY - obj.currentPixelY;
                                const dist = Math.sqrt(dx * dx + (dy * 2.0) * (dy * 2.0));
                                if (dist < bestDist) {
                                    bestDist = dist;
                                    currentTarget = targetObj;
                                }
                            }
                        }
                    } else if (isTowerRed) {
                        // Target player or allied friendly slime
                        if (engine.player && engine.player.stats.hp > 0) {
                            const dx = engine.player.currentPixelX - obj.currentPixelX;
                            const dy = engine.player.currentPixelY - obj.currentPixelY;
                            const dist = Math.sqrt(dx * dx + (dy * 2.0) * (dy * 2.0));
                            if (dist < bestDist) {
                                bestDist = dist;
                                currentTarget = engine.player;
                            }
                        }
                        for (const targetObj of engine.gameObjects) {
                            if (targetObj instanceof Enemy && targetObj.friendly === true && targetObj.stats && targetObj.stats.hp > 0) {
                                const dx = targetObj.currentPixelX - obj.currentPixelX;
                                const dy = targetObj.currentPixelY - obj.currentPixelY;
                                const dist = Math.sqrt(dx * dx + (dy * 2.0) * (dy * 2.0));
                                if (dist < bestDist) {
                                    bestDist = dist;
                                    currentTarget = targetObj;
                                }
                            }
                        }
                    }

                    // Locked target loading/discharge delay logic
                    if (currentTarget) {
                        if (!obj.currentTargetLock || obj.currentTargetLock.target !== currentTarget) {
                            obj.currentTargetLock = {
                                target: currentTarget,
                                timer: 1.0 // 1.0 seconds targeting delay before fire discharge
                            };
                        } else {
                            obj.currentTargetLock.timer -= deltaTime;
                            if (obj.currentTargetLock.timer <= 0) {
                                // Lock fully charged! Discharge!
                                obj.stats.attackCooldown = 1.6; // Fire rate speed
                                obj.currentTargetLock = null;

                                const projectileColor = isTowerBlue ? '#3498db' : '#e74c3c';
                                engine.addEffect(new TowerOrbEffect(engine, {
                                    position: { x: obj.currentPixelX, y: obj.currentPixelY - 48 },
                                    target: currentTarget,
                                    color: projectileColor,
                                    damage: obj.stats.atk,
                                    owner: obj
                                }));
                            }
                        }
                    } else {
                        obj.currentTargetLock = null;
                    }
                }
            }
        }
    }
}
