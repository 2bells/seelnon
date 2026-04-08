export class ExpUpgradeManager {
  constructor(game) {
    this.game = game;
    this.experienceThreshold = 350; // EXP required to upgrade a unit
    this.maxTier = this.game.mapData?.upgrades?.maxTier || 4;
    this.tierMultipliers = this.game.mapData?.upgrades?.tierMultipliers || {
      1: 1.0,    // Base tier
      2: 1.2,    // 20% increase
      3: 1.44,   // 20% increase from tier 2
      4: 1.728   // 20% increase from tier 3
    };
  }

  update(unit) {
    if (unit.tier < this.maxTier && unit.experience >= this.experienceThreshold) {
      unit.tier++;
      unit.experience -= this.experienceThreshold;
      this.applyUpgrade(unit);
    }
  }

  applyUpgrade(unit) {
    const multiplier = this.tierMultipliers[unit.tier];
    
    // Apply multiplier to base stats
    unit.size = unit.baseSize * (multiplier * 0.9);
    unit.maxHealth = unit.baseMaxHealth * multiplier;
    unit.health = Math.min(unit.health * multiplier, unit.maxHealth);
    
    // Increase damage
    unit.attackDamage = unit.baseAttackDamage * multiplier;
    
    // Increase attack range
    unit.attackRange = unit.baseAttackRange * multiplier;
  }

  getNewUnit(unit) {
    // Initialize base values for damage and other stats
    unit.baseAttackDamage = unit.attackDamage;
    unit.baseAttackRange = unit.attackRange; // Store base attack range
    
    unit.tier = 1; // Start at base tier
    unit.experience = 0;
    unit.baseSize = unit.size;
    unit.baseMaxHealth = unit.maxHealth;
    
    this.applyUpgrade(unit);
    return unit;
  }

  drawTierIndicator(ctx, unit) {
    if (unit.tier <= 1) return; // Don't draw for tier 1

    const shapes = {
      2: () => this.drawTriangle(ctx, unit),
      3: () => this.drawDiamond(ctx, unit),
      4: () => this.drawStar(ctx, unit)
    };

    ctx.save();
    ctx.fillStyle = unit.isEnemy ? 'red' : 'blue';
    
    if (shapes[unit.tier]) {
      shapes[unit.tier]();
    }
    
    ctx.restore();
  }

  drawTriangle(ctx, unit) {
    const size = unit.size * 0.4;
    const x = unit.position.x;
    const y = unit.position.y - unit.size - 10;

    ctx.beginPath();
    ctx.moveTo(x, y - size/2);
    ctx.lineTo(x - size/2, y + size/2);
    ctx.lineTo(x + size/2, y + size/2);
    ctx.closePath();
    ctx.fill();
  }

  drawDiamond(ctx, unit) {
    const size = unit.size * 0.4;
    const x = unit.position.x;
    const y = unit.position.y - unit.size - 10;

    ctx.beginPath();
    ctx.moveTo(x, y - size/2);
    ctx.lineTo(x + size/2, y);
    ctx.lineTo(x, y + size/2);
    ctx.lineTo(x - size/2, y);
    ctx.closePath();
    ctx.fill();
  }

  drawStar(ctx, unit) {
    const outerRadius = unit.size * 0.3;
    const innerRadius = outerRadius * 0.4;
    const x = unit.position.x;
    const y = unit.position.y - unit.size - 10;
    const spikes = 5;

    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const pointX = x + Math.cos(angle) * radius;
      const pointY = y + Math.sin(angle) * radius;
      
      if (i === 0) {
        ctx.moveTo(pointX, pointY);
      } else {
        ctx.lineTo(pointX, pointY);
      }
    }
    ctx.closePath();
    ctx.fill();
  }
}