import { Vector2 } from './vector2.js';
import { Resource } from './game.js';
import { WoodResource } from './game.js';
import { Projectile } from './game.js';

export class Unit {
  constructor(position, game, isEnemy = false, unitType = 'circle') {
    this.position = position;
    this.game = game;
    this.selected = false;
    this.target = null;
    this.unitType = unitType;
    
    // Unit type specific stats
    if (unitType === 'square') {
      this.speed = 1;
      this.size = 20;
      this.maxHealth = 200;
      this.health = this.maxHealth;
      this.attackRange = 250;
      this.attackDamage = 30 * game.multipliers.damage;  // Base value for square unit
      this.attackCooldownMax = 45;
    } else if (unitType === 'triangle') {
      this.speed = 3;
      this.size = 20;
      this.maxHealth = 80;
      this.health = this.maxHealth;
      this.attackRange = 100;
      this.attackDamage = 15 * game.multipliers.damage;  // Base value for triangle unit
      this.attackCooldownMax = 20;
    } else { // circle
      this.speed = 2;
      this.size = 20;
      this.maxHealth = 100;
      this.health = this.maxHealth;
      this.attackRange = 150;
      this.attackDamage = 10 * game.multipliers.damage;  // Base value for circle unit
      this.attackCooldownMax = 30;
    }
    
    // Store base attack damage and range for upgrades
    this.baseAttackDamage = this.attackDamage;
    this.baseAttackRange = this.attackRange;

    this.isEnemy = isEnemy;
    this.targetUnit = null;
    this.targetBuilding = null;
    this.targetResource = null;
    this.attackCooldown = 0;
    this.isAttacking = false;
    this.isMovingToAttack = false;
    this.isGathering = false;
    this.isMoving = false; // Flag to indicate if the unit is simply moving
    this.currentSpeedMultiplier = 1;

    this.roamPauseTimer = 0;  // Timer for pausing during roaming
    this.roamPauseDuration = 120;  // 2 seconds pause (60 frames per second)
    this.isPaused = false;

    this.aiCooldown = 0; // Cooldown for AI commands
    this.aiCooldownMax = 600; // 10 seconds (60 frames per second)

    if (this.isEnemy) {
      this.setRoamTarget();
    }

    this.captureCommandCooldown = 0;

    // Fix image initialization to use game's assetLoader
    if (game.assetLoader) {
      this.images = {
        triangle: {
          player: game.assetLoader.getImage("triangle_player.png"),
          enemy: game.assetLoader.getImage("triangle_enemy.png"),
          selected: game.assetLoader.getImage("triangle_player_selected.png")
        },
        square: {
          player: game.assetLoader.getImage("square_player.png"),
          enemy: game.assetLoader.getImage("square_enemy.png"),
          selected: game.assetLoader.getImage("square_player_picked.png")
        },
        circle: {
          player: game.assetLoader.getImage("circle_player.png"),
          enemy: game.assetLoader.getImage("circle_enemy.png"),
          selected: game.assetLoader.getImage("circle_player_selected.png")
        }
      };
    } else {
      // Fallback empty images object if no assetLoader
      this.images = {
        triangle: { player: null, enemy: null, selected: null },
        square: { player: null, enemy: null, selected: null },
        circle: { player: null, enemy: null, selected: null }
      };
    }

    this.tier = 1;
    this.experience = 0;
    // Store base values for upgrading
    this.baseSize = this.size;
    this.baseMaxHealth = this.maxHealth;
    this.baseAttackCooldownMax = this.attackCooldownMax;
  }

  addExperience(amount) {
    this.experience += amount;
    if (this.game.expUpgradeManager) {
      this.game.expUpgradeManager.update(this);
    }
  }

  update() {
    if (this.health <= 0) {
      // Let the game know this unit is lost before removing it
      this.game.removeUnit(this);
      return;
    }

    if (this.targetUnit && this.targetUnit.health <= 0) {
      this.targetUnit = null;
      this.target = null;
      this.isAttacking = false;
      this.isMovingToAttack = false;
      this.isGathering = false;
    }

    if (this.targetBuilding && this.targetBuilding.health <= 0) {
      this.targetBuilding = null;
      this.target = null;
      this.isAttacking = false;
      this.isMovingToAttack = false;
      this.isGathering = false;
    }

    if (this.targetResource && this.targetResource.health <= 0) {
      this.targetResource = null;
      this.target = null;
      this.isAttacking = false;
      this.isMovingToAttack = false;
      this.isGathering = false;
    }

    if (this.target) {
      const direction = this.target.subtract(this.position);
      const distance = direction.length();

      if (this.isMovingToAttack) {
        if (distance > this.attackRange) {
          const normalized = direction.normalize();
          const terrainMultiplier = this.currentSpeedMultiplier;
          let moveVector = normalized.multiply(this.speed * terrainMultiplier);

          let collisionAvoidance = this.getCollisionAvoidance();
          if (collisionAvoidance) {
            moveVector = moveVector.add(collisionAvoidance.multiply(0.5));
          }

          this.position = this.position.add(moveVector);

          const newDistance = this.target.subtract(this.position).length();
          if (newDistance > distance) {
            this.position = this.position.subtract(moveVector);
            this.target = null;
            this.isMovingToAttack = false;
            this.isAttacking = false;
            this.isGathering = false;
            this.isMoving = false;
          }
        } else {
          if (this.targetUnit) {
            this.attack(this.targetUnit);
          } else if (this.targetBuilding) {
            this.attackBuilding(this.targetBuilding);
          } else if (this.targetResource) {
            this.harvestResource(this.targetResource);
          }
        }
      } else {
        // Regular move command
        if (distance > 5) {
          const normalized = direction.normalize();
          const terrainMultiplier = this.currentSpeedMultiplier;
          let moveVector = normalized.multiply(this.speed * terrainMultiplier);

          let collisionAvoidance = this.getCollisionAvoidance();
          if (collisionAvoidance) {
            moveVector = moveVector.add(collisionAvoidance.multiply(0.5));
          }

          this.position = this.position.add(moveVector);

          const newDistance = this.target.subtract(this.position).length();
          if (newDistance > distance) {
            this.position = this.position.subtract(moveVector);
            this.target = null;
            this.isMovingToAttack = false;
            this.isAttacking = false;
            this.isGathering = false;
            this.isMoving = false;
          }
        } else {
          this.target = null;
          this.isMovingToAttack = false;
          this.isAttacking = false;
          this.isGathering = false;
          this.isMoving = false;
        }
      }
    } else if (this.targetUnit && !this.target && this.isAttacking) {
      const distanceToTarget = this.position.subtract(this.targetUnit.position).length();
      if (distanceToTarget <= this.attackRange) {
        this.attack(this.targetUnit);
      } else {
        this.setTarget(this.targetUnit);
      }
    } else if (this.targetBuilding && !this.target && this.isAttacking) {
      const distanceToTarget = this.position.subtract(this.targetBuilding.position).length();
      if (distanceToTarget <= this.attackRange) {
        this.attackBuilding(this.targetBuilding);
      } else {
        this.setTarget(this.targetBuilding);
      }
    } else if (this.targetResource && !this.target && this.isAttacking) {
      const distanceToTarget = this.position.subtract(this.targetResource.position).length();
      if (distanceToTarget <= this.attackRange) {
        this.harvestResource(this.targetResource);
      } else {
        this.setTarget(this.targetResource);
      }
    } else {
      if (!this.isEnemy) {
        let closestEnemy = null;
        let closestDistance = Infinity;

        this.game.units.forEach(unit => {
          if (unit.isEnemy) {
            const distance = this.position.subtract(unit.position).length();
            if (distance <= this.attackRange && distance < closestDistance) {
              closestDistance = distance;
              closestEnemy = unit;
            }
          }
        });

        let closestBuilding = null;
        closestDistance = Infinity;

        this.game.buildings.forEach(building => {
          if (building.isEnemy) {
            const distance = this.position.subtract(building.position).length();
            if (distance <= this.attackRange && distance < closestDistance) {
              closestDistance = distance;
              closestBuilding = building;
            }
          }
        });

        let closestResource = null;
        closestDistance = Infinity;

        this.game.resources.forEach(resource => {
          const distance = this.position.subtract(resource.position).length();
          if (distance <= this.attackRange && distance < closestDistance) {
            closestDistance = distance;
            closestResource = resource;
          }
        });

        if (closestEnemy) {
          this.setTarget(closestEnemy);
        } else if (closestBuilding) {
          this.setTarget(closestBuilding);
        } else if (closestResource) {
          this.setTarget(closestResource);
        }
      } else {
        let closestEnemy = null;
        let closestDistance = Infinity;

        this.game.units.forEach(unit => {
          if (!unit.isEnemy) {
            const distance = this.position.subtract(unit.position).length();
            if (distance <= this.attackRange && distance < closestDistance) {
              closestDistance = distance;
              closestEnemy = unit;
            }
          }
        });

        let closestBuilding = null;
        closestDistance = Infinity;

        this.game.buildings.forEach(building => {
          if (!building.isEnemy) {
            const distance = this.position.subtract(building.position).length();
            if (distance <= this.attackRange && distance < closestDistance) {
              closestDistance = distance;
              closestBuilding = building;
            }
          }
        });

        let closestResource = null;
        closestDistance = Infinity;
        let closestWoodResource = null;

        // Prioritize wood gathering if over 500 gold
        if (this.game.enemyGold > 500) {
          this.game.woodResources.forEach(resource => {
            const distance = this.position.subtract(resource.position).length();
            if (distance <= this.attackRange && distance < closestDistance) {
              closestDistance = distance;
              closestWoodResource = resource;
            }
          });
        }

        if (!closestWoodResource) {
            this.game.resources.forEach(resource => {
              const distance = this.position.subtract(resource.position).length();
              if (distance <= this.attackRange && distance < closestDistance) {
                closestDistance = distance;
                closestResource = resource;
              }
            });
        }

        if (closestEnemy) {
          this.setTarget(closestEnemy);
        } else if (closestBuilding) {
          this.setTarget(closestBuilding);
        } else if (closestWoodResource) {
            this.setTarget(closestWoodResource);
        }
        else if (closestResource) {
          this.setTarget(closestResource);
        } else {
          if (this.roamTarget) {
            if (this.isPaused) {
              this.roamPauseTimer++;
              if (this.roamPauseTimer >= this.roamPauseDuration) {
                this.isPaused = false;
                this.roamPauseTimer = 0;
                this.setRoamTarget(); // Set new roam target after pause
              }
            } else {
              const direction = this.roamTarget.subtract(this.position);
              const distance = direction.length();

              if (distance > 5) {
                const normalized = direction.normalize();
                const terrainMultiplier = this.currentSpeedMultiplier;
                let moveVector = normalized.multiply(this.speed * terrainMultiplier);

                let collisionAvoidance = this.getCollisionAvoidance();
                if (collisionAvoidance) {
                  moveVector = moveVector.add(collisionAvoidance.multiply(0.5));
                }

                this.position = this.position.add(moveVector);
              } else {
                this.isPaused = true; // Pause when reached roam target
                this.roamPauseTimer = 0;
                //this.setRoamTarget();  // postpone setting new roam target until paused
              }
            }
          }
        }
      }
    }

    if (this.attackCooldown > 0) {
      this.attackCooldown--;
    }

    if (this.aiCooldown > 0) {
      this.aiCooldown--;
    }

    if (this.captureCommandCooldown > 0) {
      this.captureCommandCooldown--;
    }
  }

  draw(ctx) {
    let image;
    if (this.unitType === 'square') {
      image = this.isEnemy ? this.images.square.enemy : 
              (this.selected ? this.images.square.selected : this.images.square.player);
    } else if (this.unitType === 'triangle') {
      image = this.isEnemy ? this.images.triangle.enemy : 
              (this.selected ? this.images.triangle.selected : this.images.triangle.player);
    } else { // circle
      image = this.isEnemy ? this.images.circle.enemy : 
              (this.selected ? this.images.circle.selected : this.images.circle.player);
    }

    // Draw fallback shape if image is not available
    if (!image) {
      ctx.beginPath();
      if (this.unitType === 'circle') {
        ctx.arc(this.position.x, this.position.y, this.size, 0, Math.PI * 2);
      } else if (this.unitType === 'square') {
        ctx.rect(this.position.x - this.size, this.position.y - this.size, this.size * 2, this.size * 2);
      } else { // triangle
        ctx.moveTo(this.position.x, this.position.y - this.size);
        ctx.lineTo(this.position.x + this.size, this.position.y + this.size);
        ctx.lineTo(this.position.x - this.size, this.position.y + this.size);
        ctx.closePath();
      }
      ctx.fillStyle = this.isEnemy ? 'red' : 'blue';
      ctx.fill();
    } else {
      ctx.drawImage(image, 
        this.position.x - this.size, 
        this.position.y - this.size, 
        this.size * 2, 
        this.size * 2
      );
    }

    // Draw movement line for resource gathering
    if (this.target && this.targetResource) {
      ctx.beginPath();
      ctx.moveTo(this.position.x, this.position.y);
      ctx.lineTo(this.target.x, this.target.y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Restore movement lines for selected units only in standard game mode
    // This will be handled differently in the EndlessGame
    if (this.target && !this.isEnemy && !this.targetResource && 
        !this.game.constructor.name.includes('EndlessGame')) {
      ctx.beginPath();
      ctx.moveTo(this.position.x, this.position.y);
      ctx.lineTo(this.target.x, this.target.y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Rest of drawing code...
    this.drawHealthBar(ctx);
    if (this.game.upgradeManager) {
      this.game.upgradeManager.drawTierIndicator(ctx, this);
    }
    if (this.game.expUpgradeManager) {
      this.game.expUpgradeManager.drawTierIndicator(ctx, this);
    }
  }

  attack(targetUnit) {
    if (this.attackCooldown === 0 && targetUnit && targetUnit.health > 0) {
      if (this.position.subtract(targetUnit.position).length() <= this.attackRange) {
        if (this.unitType === 'circle' || this.unitType === 'square' || this.unitType === 'triangle') {
          this.game.createProjectile(this, targetUnit);
          this.addExperience(10);
        }
        this.attackCooldown = this.attackCooldownMax;
        targetUnit.addExperience(5);
      } else {
        this.setTarget(targetUnit);
      }
    }
  }

  attackBuilding(targetBuilding) {
    if (this.attackCooldown === 0 && targetBuilding && targetBuilding.health > 0) {
      if (this.position.subtract(targetBuilding.position).length() <= this.attackRange) {
        this.game.createProjectile(this, targetBuilding);
        this.addExperience(10);
        this.attackCooldown = this.attackCooldownMax;
      } else {
        this.setTarget(targetBuilding);
      }
    }
  }

  harvestResource(targetResource) {
    if (this.attackCooldown === 0 && targetResource && !targetResource.depleted) {
      if (this.position.subtract(targetResource.position).length() <= this.attackRange) {
        targetResource.takeDamage(10, this.isEnemy);
        this.attackCooldown = this.attackCooldownMax;
        this.isGathering = true;
        this.setTarget(targetResource);
      }
    }
  }

  getCollisionAvoidance() {
    let avoidanceVector = new Vector2(0, 0);
    let nearbyUnits = this.game.units.filter(unit => unit !== this && this.isNearby(unit));

    if (nearbyUnits.length === 0) {
      return null;
    }

    nearbyUnits.forEach(unit => {
      let direction = this.position.subtract(unit.position);
      let distance = direction.length();

      if (distance < this.size) {
        avoidanceVector = avoidanceVector.add(direction.normalize().multiply(this.size - distance));
      }
    });

    return avoidanceVector;
  }

  isNearby(otherUnit) {
    let distance = this.position.subtract(otherUnit.position).length();
    return distance < this.size * 2;
  }

  drawHealthBar(ctx) {
    const barWidth = this.size;
    const barHeight = 5;
    const healthPercentage = this.health / this.maxHealth;

    ctx.fillStyle = 'red';
    ctx.fillRect(this.position.x - barWidth / 2, this.position.y - this.size, barWidth, barHeight);

    ctx.fillStyle = 'green';
    ctx.fillRect(this.position.x - barWidth / 2, this.position.y - this.size, barWidth * healthPercentage, barHeight);
  }

  moveTo(target) {
    // Calculate spread based on the number of selected units
    const selectedUnits = this.game.units.filter(unit => !unit.isEnemy && unit.selected);
    const unitCount = selectedUnits.length;

    // New scaling logic
    const maxSpread = 50; // Current maximum spread
    const minSpread = 0;  // Minimum spread for very few units
    
    // Logarithmic scaling with a specific transition point
    let spread;
    if (unitCount <= 3) {
      spread = minSpread; // Exact point for 3 or fewer units
    } else if (unitCount > 3 && unitCount <= 30) {
      // Gradually increase spread from 0 to maxSpread between 3 and 30 units
      spread = minSpread + (maxSpread - minSpread) * ((unitCount - 3) / 27);
    } else {
      spread = maxSpread; // Maintain maximum spread for more than 30 units
    }

    const offsetX = (Math.random() - 0.5) * spread;
    const offsetY = (Math.random() - 0.5) * spread;
    this.target = new Vector2(target.x + offsetX, target.y + offsetY);
    this.targetUnit = null;
    this.targetBuilding = null;
    this.targetResource = null;
    this.isAttacking = false;
    this.isMovingToAttack = false;
    this.isGathering = false;
    this.isMoving = true; // Set the moving flag
    this.aiCooldown = this.aiCooldownMax; // Set AI cooldown after moving
  }

  contains(point) {
    return this.position.subtract(point).length() < this.size / 2;
  }

  setTarget(targetUnit) {
    this.targetUnit = null;
    this.targetBuilding = null;
    this.targetResource = null;

    if (targetUnit instanceof Unit) {
      this.targetUnit = targetUnit;
      this.target = targetUnit.position;
    } else if (targetUnit instanceof Resource) {
      this.targetResource = targetUnit;
      this.target = targetUnit.position;
    } else {
      this.targetBuilding = targetUnit;
      this.target = targetUnit.position;
    }

    this.isAttacking = true;
    this.isMovingToAttack = true;
    this.isGathering = false;
    this.isMoving = false; // Reset the moving flag
    this.aiCooldown = this.aiCooldownMax; // Set AI cooldown after setting target
  }

  setRoamTarget() {
    const canvasWidth = this.game.canvas.width;
    const canvasHeight = this.game.canvas.height;
    const x = Math.random() * canvasWidth;
    const y = Math.random() * canvasHeight;
    this.roamTarget = new Vector2(x, y);
  }
}